# Island 360 - CLAUDE.md

## プロジェクト概要

React Native (Expo) 製のターン制リアルタイム経営ゲーム。
3×3 グリッドのマスに施設を建設し、資源を採掘・精製して資金を稼ぐ。セッション時間は360秒（6分）。

**技術スタック**
- React Native + Expo Router
- react-native-gesture-handler（スワイプ操作）
- react-native-reanimated / react-native-worklets
- TypeScript strict モード

---

## ディレクトリ構成

```
src/
  app/
    _layout.tsx        # GestureHandlerRootView + AnimatedSplashOverlay
    index.tsx          # ゲーム本体（唯一の画面）
  components/
    animated-icon.tsx  # スプラッシュオーバーレイ（_layout で使用）
    build-modal.tsx    # 建設モーダル（CatalogModal のラッパー）
    catalog-modal.tsx  # 共通リスト選択モーダル（建設・研究で共有）
    phase-resource-bar.tsx  # フェーズ別資源バー（1フェーズ分）
    research-modal.tsx # 研究モーダル（CatalogModal のラッパー）
    start-overlay.tsx  # ゲームスタートオーバーレイ
    timer-bar.tsx      # タイマーバー
  domain/
    types.ts           # 全型定義
    id.ts              # ULID ベースの ID 生成
    game.ts            # createGame()
    plot.ts            # generatePlots()（9マス生成）
    facility-catalog.ts    # 建設可能施設の静的カタログ
    facility-actions.ts    # buildFacility / demolishFacility / tickFacilities
    research-catalog.ts    # 研究の静的カタログ
    research-unlock.ts     # getUnlockedPhases / getAvailableFacilityKeys（純粋導出関数）
  hooks/
    use-game-loop.ts   # requestAnimationFrame ベースの 60fps ゲームループ
    use-theme.ts       # テーマ取得フック
  constants/
    theme.ts           # Colors / Spacing / Fonts
```

---

## ゲームの核心型（domain/types.ts）

```
Game
├── player: Player（funds, completedResearch）
├── plots: [Plot × 9]（各マスの deposits + facilityId）
├── facilities: Map<FacilityId, Facility>
├── sessionDurationMs: 900_000
├── startedAt: number | null
└── status: "setup" | "playing" | "finished"

Plot（index 0〜8、3×3グリッド）
├── deposits: ResourceDeposit[]（agriculture/mineral/energy の3種）
│   ├── abundance: number  # 最大量（初期 ≈0〜1000）
│   └── current: number    # 残量（採掘により減少）
└── facilityId: FacilityId | null

Facility = Extractor | Refinery | Laboratory | Booster
Extractor 追加フィールド:
  resourceType, outputPerCycle, cycleDurationMs, lastCycleAt
```

**重要**: `ResourceDeposit.unlocked` は存在しない。可視性は `player.completedResearch` から `getUnlockedPhases()` で導出する（Single Source of Truth）。

---

## ゲームロジック

### グリッド座標
```
0 1 2
3 4 5   ← index = row*3 + col
6 7 8
```

### 採掘（Extractor）
- 建設完了（20秒）→ state: `constructing` → `idle`、`lastCycleAt = now` セット
- 毎フレーム `tickFacilities` が `cyclesElapsed = floor((now - lastCycleAt) / 200)` を計算
- 採掘量 = `cyclesElapsed × 1 × 1.2^(採掘効率研究レベル)`
- 資金加算 = `採掘量 × フェーズ数 × 精製倍率`
- **採掘効率研究は速度を上げるが総収益は変わらない**（資源量は固定）

### 精製（Refinery）
- 効果範囲：周囲**8マス**（斜め含む）の稼働中 Extractor に適用
- 有効倍率 = `1.2^(L+1)`（L = `refinery-efficiency` 研究レベル）
- 複数 Refinery が隣接している場合は積算（乗算）
- 最適配置：**中央（Plot 4）が唯一の全8マスカバー位置**

### 建設・破壊
- 建設: 20秒、コスト = `entry.buildCost`
- 破壊: 10秒、コスト = `facility.demolishCost`
- 建設中・破壊中は両ボタン無効（idle のみ破壊可能）

### アンロックロジック（research-unlock.ts）
- `getUnlockedPhases(completedResearch)` → フェーズ1は常に開放、2は`mineral-survey`、3は`energy-survey`完了後
- `getAvailableFacilityKeys(completedResearch)` → `requiredResearchKey` を参照

---

## 研究カタログ（research-catalog.ts）

| key | 繰返 | コスト | 前提 | 効果 |
|---|:---:|---:|---|---|
| agri-efficiency | ✓ | 100G | なし | 農場速度+20% |
| mineral-survey | - | 200G | agri-efficiency | Phase 2 解放 |
| mineral-efficiency | ✓ | 200G | mineral-survey | 鉱山速度+20% |
| energy-survey | - | 300G | mineral-efficiency | Phase 3 解放 |
| energy-efficiency | ✓ | 300G | energy-survey | エネルギー生産場速度+20% |
| refinery-efficiency | ✓ | 100G | なし | 精製倍率+20% |

繰り返し研究のコストは毎回 **50% 増加**。

---

## 施設カタログ（facility-catalog.ts）

| kind / key | 建設費 | 解放条件 |
|---|---:|---|
| extractor / agri | 200G | なし |
| extractor / mineral | 400G | mineral-survey |
| extractor / energy | 600G | energy-survey |
| refinery | 500G | なし |
| laboratory | 500G | なし |

---

## UIアーキテクチャ（index.tsx）

**状態管理**
- `game` / `setGame`: ゲーム全体の immutable state
- `startedAt`: ゲーム開始時刻（null = 未開始）
- `now`: 現在時刻（60fps で更新）
- `selectedPlotIndex`: 現在表示中のプロット

**ゲームループ**
```ts
useGameLoop((currentNow) => {
  setNow(currentNow);
  setGame(g => tickFacilities(g, currentNow));  // 変化なし時は同一参照
}, gameStarted);
```

**導出値（useMemo）**
- `unlockedPhases` ← `getUnlockedPhases(completedResearch)`
- `availableFacilityKeys` ← `getAvailableFacilityKeys(completedResearch)`
- `phaseTotals` / `phaseCurrents` / `phaseUnlocked` ← unlocked phases × deposits

**ゲームスタートオーバーレイ**
- スタート前は時間経過なし・ボタン無効
- 絶対配置の View（`pointerEvents="box-none"`）でスワイプは背後に通過
- スタートボタンで `startedAt` を設定

---

## 設計上の重要な決定

1. **資源の可視性は `completedResearch` から導出**（`deposit.unlocked` フィールドは存在しない）
2. **`tickFacilities` は変化なし時に同一参照を返す**（不要な再レンダリング防止）
3. **`CatalogModal`** が建設・研究モーダルの共通 UI を担う
4. **採掘効率研究 = タイミング効果のみ**（総収益は資源量×フェーズ×精製倍率で決まる）
5. **精製工場の中央配置が支配的戦略**（全8マスカバー、精製研究Lv1+ で2基目も採算）

---

## 未実装（今後の課題）

- 研究の実行処理（ResearchModal は存在するが Game に接続されていない）
- Laboratory の効果（研究速度向上）
- Booster の効果
- ゲーム終了処理（status: "finished"）
- スコア計算
