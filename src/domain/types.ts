// ── Branded IDs ──────────────────────────────────────────────────
type Brand<T, B> = T & { readonly _brand: B };
export type GameId      = Brand<string, "GameId">;
export type PlayerId    = Brand<string, "PlayerId">;
export type FacilityId  = Brand<string, "FacilityId">;
export type ResearchId  = Brand<string, "ResearchId">;

// ── Resource ─────────────────────────────────────────────────────
export type ResourcePhase = 1 | 2 | 3;

export type resourceGain = 1 | 2 | 4;

// Phase 1=農産 / Phase 2=鉱物 / Phase 3=エネルギー
export type ResourceType = "agriculture" | "mineral" | "energy";

export type ResourceDeposit = {
  type:         ResourceType;
  phase:        ResourcePhase;
  gain:         resourceGain;
  abundance:    number;  // 最大量（マップ表示のヒントにも使う）
  current:      number;  // 現在の残量（採掘により減少）
  totalMined:   number;  // 累積採掘量（再生分も含めた正確な採掘合計）
  lastRegenAt?: number;  // 再生栽培研究後の最終再生時刻（ms）
  // 可視性は player.completedResearch から導出するため、ここには持たない
};

// ── Plot（グリッドの1マス）────────────────────────────────────────
export type PlotIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type Plot = {
  deposits:   ResourceDeposit[];
  facilityId: FacilityId | null;
};

// ── Processing Job（施設の処理キュー）────────────────────────────
export type ProcessingJob = {
  startedAt:  number;  // ms timestamp
  durationMs: number;
};

// ── Facility（施設の共通基底）────────────────────────────────────
export type FacilityBase = {
  id:           FacilityId;
  plotIndex:    PlotIndex;
  buildCost:    number;
  demolishCost: number;
  // 建設・撤去中は currentJob に工事ジョブが入る
  state:        "constructing" | "demolishing" | "idle" | "processing";
  currentJob:   ProcessingJob | null;
};

// Extractor: 資源採集所（農産/鉱物/エネルギーで1種ずつ）
export type Extractor = FacilityBase & {
  kind:            "extractor";
  resourceType:    ResourceType;
  outputPerCycle:  number;   // 1サイクルあたりの採掘量（基本値）
  cycleDurationMs: number;   // サイクル時間（ms）
  lastCycleAt:     number | null;  // 採掘サイクル基準時刻（null = 未開始）
};

// Refinery: 付加価値工場（資源種類を問わず汎用）
export type Refinery = FacilityBase & {
  kind:            "refinery";
  valueMultiplier: number;
};

// Laboratory: ラボ（複数建てると研究を並列・加速できる）
export type Laboratory = FacilityBase & {
  kind:             "laboratory";
  activeResearchId: ResearchId | null;
};

// Monument: 特殊な建造物（高コスト・長時間建設）
export type Monument = FacilityBase & {
  kind: "monument";
};

export type Facility = Extractor | Refinery | Laboratory | Monument;

// ── Player ───────────────────────────────────────────────────────
export type Player = {
  id:                PlayerId;
  funds:             number;
  completedResearch: Map<ResearchId, number>;  // researchId → 到達レベル
  activeResearchIds: Set<ResearchId>;          // 現在処理中の研究キー
  patentTickAt:      number | null;            // 特許収入の最終計算時刻（ms）
};

// ── GameLog ───────────────────────────────────────────────────
export type GameEventKind =
  | "game-start"
  | "construction-start"
  | "construction-complete"
  | "demolish-start"
  | "demolish-complete"
  | "research-start"
  | "research-complete";

export type GameLogEntry = {
  kind:            GameEventKind;
  elapsedMs:       number;   // ゲーム開始からの経過時間（ms）
  score:           number;   // その時点の総スコア
  fundsPerSecond:  number;   // その時点の資金/秒
  facilityKind?:   Facility["kind"];  // 建設開始・完了・破壊開始時
  facilityKey?:    string;            // 建設開始時のカタログキー（リプレイ用）
  resourceType?:   ResourceType;      // extractor の demolish-complete 時
  researchKey?:    string;            // 研究開始・完了時
  plotIndex?:      PlotIndex;         // 建設・破壊・研究開始時のプロット（リプレイ用）
  mapSeed?:        number;            // game-start エントリのみ
};

// ── Game（セッション全体）────────────────────────────────────────
export type GameStatus = "setup" | "playing" | "finished";

export type Game = {
  id:                GameId;
  player:            Player;
  plots:             readonly Plot[];
  facilities:        Map<FacilityId, Facility>;
  mapSeed:           number;
  sessionDurationMs: number;
  startedAt:         number | null;
  status:            GameStatus;
  logs:              GameLogEntry[];
};
