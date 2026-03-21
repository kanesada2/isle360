// ── Branded IDs ──────────────────────────────────────────────────
type Brand<T, B> = T & { readonly _brand: B };
export type GameId      = Brand<string, "GameId">;
export type PlayerId    = Brand<string, "PlayerId">;
export type FacilityId  = Brand<string, "FacilityId">;
export type ResearchId  = Brand<string, "ResearchId">;

// ── Resource ─────────────────────────────────────────────────────
export type ResourcePhase = 1 | 2 | 3;

// Phase 1=農産 / Phase 2=鉱物 / Phase 3=エネルギー
export type ResourceType = "agriculture" | "mineral" | "energy";

export type ResourceDeposit = {
  type:      ResourceType;
  phase:     ResourcePhase;
  abundance: number;  // 最大量（マップ表示のヒントにも使う）
  current:   number;  // 現在の残量（採掘により減少）
  // 可視性は player.completedResearch から導出するため、ここには持たない
};

// ── Plot（グリッドの1マス）────────────────────────────────────────
export type PlotIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type Plot = {
  index:      PlotIndex;
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
  cycleDurationMs: number;
};

// Laboratory: ラボ（複数建てると研究を並列・加速できる）
export type Laboratory = FacilityBase & {
  kind:                    "laboratory";
  researchSpeedMultiplier: number;
  activeResearchId:        ResearchId | null;
};

// Booster: 効率増幅施設（無産・周囲に効果）
export type Booster = FacilityBase & {
  kind:            "booster";
  efficiencyBonus: number;  // 加算値
  affectedIndices: PlotIndex[];
};

export type Facility = Extractor | Refinery | Laboratory | Booster;

// ── Research Effect（研究の効果）─────────────────────────────────
export type ResearchEffect =
  | { kind: "extractorEfficiency"; resourceType: ResourceType; multiplier: number }
  | { kind: "refineryEfficiency";  multiplier: number }
  | { kind: "researchSpeed";       multiplier: number }
  | { kind: "unlockPhase";         phase: ResourcePhase };

// ── Research（研究ノード）────────────────────────────────────────
export type Research = {
  id:              ResearchId;
  label:           string;
  effect:          ResearchEffect;
  prerequisites:   ResearchId[];  // これが全てcompleteになるまで着手不可
  baseCost:        number;        // 繰り返し研究時はゲームロジック側でコストを逓増させる
  baseDurationMs:  number;
  maxLevel:        number;        // unlock系は1、efficiency系は複数
};

// ── Research Job（進行中の研究）──────────────────────────────────
export type ResearchJob = {
  researchId:           ResearchId;
  targetLevel:          number;
  startedAt:            number;
  endsAt:               number;
  contributingLabCount: number;  // ラボ棟数で短縮される
};

// ── Player ───────────────────────────────────────────────────────
export type Player = {
  id:                 PlayerId;
  funds:              number;
  totalFundsSpent:    number;  // ゲーム開始からの累計支出
  completedResearch:  Map<ResearchId, number>;  // researchId → 到達レベル
  activeResearchJobs: ResearchJob[];            // 並列研究（ラボ複数時）
};

// ── Game（セッション全体）────────────────────────────────────────
export type GameStatus = "setup" | "playing" | "finished";

export type Game = {
  id:                GameId;
  player:            Player;
  plots:             readonly [Plot, Plot, Plot, Plot, Plot, Plot, Plot, Plot, Plot];
  facilities:        Map<FacilityId, Facility>;
  sessionDurationMs: number;  // 900_000 or 1_200_000
  startedAt:         number | null;
  status:            GameStatus;
  score:             number;
};
