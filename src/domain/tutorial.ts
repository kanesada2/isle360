import { FACILITY_CATALOG } from './facility-catalog';
import { newFacilityId, newGameId, newPlayerId } from './id';
import type { Extractor, Facility, FacilityId, Game, Monument, Player, Plot, PlotIndex, ResearchId, ResourceType } from './types';

// ── Deposit Spec ───────────────────────────────────────────────────

export type DepositSpec = {
  abundance: number;
  /** 省略時は abundance と同値（満タン） */
  current?: number;
};

export type PlotDepositSpec = {
  agriculture?: DepositSpec;
  mineral?: DepositSpec;
  energy?: DepositSpec;
};

// ── Plot Setup ─────────────────────────────────────────────────────

export type PreBuiltFacilitySpec = {
  facilityKey: string; // FACILITY_CATALOG のキー
  /** 省略時は 'idle'（建設完了済み） */
  state?: 'idle' | 'constructing';
};

export type PlotSetup = {
  plotIndex: PlotIndex;
  /** 省略したマスの埋蔵量は 0 */
  deposits?: PlotDepositSpec;
  preBuildFacility?: PreBuiltFacilitySpec;
};

// ── Mission ────────────────────────────────────────────────────────

export type ConstructFacilityMission = {
  kind: 'construct-facility';
  facilityKind: Facility['kind'];
  /** extractor の場合に資源種別まで絞り込む。省略時は種別を問わず全 extractor をカウント */
  resourceType?: ResourceType;
  count: number;
  label: string;
  completionMessage?: string;
};

export type CompleteResearchMission = {
  kind: 'complete-research';
  researchKey: ResearchId;
  /** 達成に必要な完了レベル（繰り返し研究なら Lv.N 到達） */
  level: number;
  label: string;
  completionMessage?: string;
};

export type DemolishFacilityMission = {
  kind: 'demolish-facility';
  facilityKind: Facility['kind'];
  /** extractor の場合に資源種別まで絞り込む。省略時は種別を問わず全 extractor をカウント */
  resourceType?: ResourceType;
  count: number;
  label: string;
  completionMessage?: string;
};

export type Mission = ConstructFacilityMission | CompleteResearchMission | DemolishFacilityMission;

export type MissionStatus = {
  mission: Mission;
  completed: boolean;
};

// ── PlotViewTrigger ────────────────────────────────────────────────

export type PlotViewTrigger = {
  /** このプロットが表示されたらトリガー */
  plotIndex: PlotIndex;
  /**
   * トリガー条件：指定インデックス（0-based）までの全ミッションが達成済みであること。
   * 0 を指定すると「ミッション 0 が完了後」、省略すると「ミッション達成状況を問わない」。
   */
  afterMissionIndex?: number;
  title?: string;
  body: string;
  buttonLabel?: string;
};

// ── TutorialStage ──────────────────────────────────────────────────

export type TutorialStage = {
  id: string;

  /**
   * プロット設定。未指定のプロットは埋蔵量ゼロ。
   * 9マス全部指定することでマップを完全に制御できる。
   */
  plotSetups?: PlotSetup[];

  /** 初期所持資金。省略時は 1000G */
  initialFunds?: number;

  /** ゲーム開始時点で完了済みとする研究 */
  initialResearch?: Array<{ researchKey: ResearchId; level: number }>;

  /** ゲーム開始前オーバーレイの文言 */
  startOverlay: {
    title?: string;
    body: string;
    buttonLabel?: string;
  };

  /** ミッション一覧（達成判定・進捗表示に使う） */
  missions: Mission[];

  /** プロット表示トリガー（ログに記録されない） */
  plotTriggers?: PlotViewTrigger[];

  /** 全ミッション達成時に表示するモーダルの文言 */
  completionModal?: {
    title?: string;
    body?: string;
    buttonLabel?: string;
  };

  /**
   * セッション時間（ms）。
   * 省略または 0 → 時間無制限（全ミッション達成でゲーム終了）。
   */
  sessionDurationMs?: number;
};

// ── createTutorialGame ─────────────────────────────────────────────

const UNLIMITED_DURATION = Number.MAX_SAFE_INTEGER;

function buildDeposits(spec?: PlotDepositSpec) {
  const agri    = spec?.agriculture;
  const mineral = spec?.mineral;
  const energy  = spec?.energy;
  return [
    { type: 'agriculture' as const, phase: 1 as const, gain: 1 as const,
      abundance: agri?.abundance    ?? 0, current: agri?.current    ?? agri?.abundance    ?? 0, totalMined: 0 },
    { type: 'mineral'     as const, phase: 2 as const, gain: 2 as const,
      abundance: mineral?.abundance ?? 0, current: mineral?.current ?? mineral?.abundance ?? 0, totalMined: 0 },
    { type: 'energy'      as const, phase: 3 as const, gain: 4 as const,
      abundance: energy?.abundance  ?? 0, current: energy?.current  ?? energy?.abundance  ?? 0, totalMined: 0 },
  ];
}

/**
 * TutorialStage からゲーム初期状態を生成する。
 * - 指定のプロット設定でマップを構築（未指定マスは埋蔵量ゼロ）
 * - 指定の研究を完了済みとしてセット
 * - 指定の施設を事前建設済みとして配置
 */
export function createTutorialGame(stage: TutorialStage): Game {
  const player: Player = {
    id: newPlayerId(),
    funds: stage.initialFunds ?? 1_000,
    completedResearch: new Map(
      (stage.initialResearch ?? []).map(({ researchKey, level }) => [researchKey, level]),
    ),
    activeResearchIds: new Set(),
  };

  // 全9マスを構築（指定なしは埋蔵量ゼロ）
  const plotsData: Plot[] = Array.from({ length: 9 }, (_, i) => {
    const setup = stage.plotSetups?.find(s => s.plotIndex === (i as PlotIndex));
    return { deposits: buildDeposits(setup?.deposits), facilityId: null };
  });

  // 事前建設施設を配置
  const facilities = new Map<FacilityId, Facility>();
  for (const setup of stage.plotSetups ?? []) {
    if (!setup.preBuildFacility) continue;
    const { facilityKey, state = 'idle' } = setup.preBuildFacility;
    const entry = FACILITY_CATALOG.find(e => e.key === facilityKey);
    if (!entry) continue;

    const facilityId = newFacilityId();
    const base = {
      id: facilityId,
      plotIndex: setup.plotIndex,
      buildCost: entry.buildCost,
      demolishCost: entry.demolishCost,
      state: state as 'idle' | 'constructing',
      currentJob: state === 'constructing'
        ? { startedAt: 0, durationMs: entry.buildDurationMs ?? 20_000 }
        : null,
    };

    let facility: Facility;
    switch (entry.kind) {
      case 'extractor':
        facility = {
          ...base,
          kind: 'extractor',
          resourceType: entry.resourceType!,
          outputPerCycle: 1,
          cycleDurationMs: 200,
          // null のまま → tickFacilities 初回 tick でゲーム開始時刻に初期化される
          lastCycleAt: null,
        } as Extractor;
        break;
      case 'refinery':
        facility = { ...base, kind: 'refinery', valueMultiplier: 1.2 };
        break;
      case 'laboratory':
        facility = { ...base, kind: 'laboratory', activeResearchId: null };
        break;
      case 'monument':
        facility = { ...base, kind: 'monument' } as Monument;
        break;
      default:
        continue;
    }

    facilities.set(facilityId, facility);
    plotsData[setup.plotIndex] = { ...plotsData[setup.plotIndex], facilityId };
  }

  return {
    id: newGameId(),
    player,
    plots: plotsData,
    facilities,
    mapSeed: 0,
    sessionDurationMs: stage.sessionDurationMs || UNLIMITED_DURATION,
    startedAt: null,
    status: 'setup',
    logs: [],
  };
}

// ── evaluateMissions ───────────────────────────────────────────────

/** 現在のゲーム状態に対してミッションの達成状況を評価する（純粋関数）*/
export function evaluateMissions(missions: Mission[], game: Game): MissionStatus[] {
  return missions.map(mission => ({ mission, completed: checkMission(mission, game) }));
}

function checkMission(mission: Mission, game: Game): boolean {
  switch (mission.kind) {
    case 'construct-facility': {
      const count = [...game.facilities.values()].filter(f => {
        if (f.kind !== mission.facilityKind || f.state !== 'idle') return false;
        if (mission.resourceType && f.kind === 'extractor') {
          return (f as Extractor).resourceType === mission.resourceType;
        }
        return true;
      }).length;
      return count >= mission.count;
    }
    case 'complete-research': {
      const level = game.player.completedResearch.get(mission.researchKey) ?? 0;
      return level >= mission.level;
    }
    case 'demolish-facility': {
      const count = game.logs.filter(l => {
        if (l.kind !== 'demolish-complete' || l.facilityKind !== mission.facilityKind) return false;
        if (mission.resourceType && l.facilityKind === 'extractor') {
          return l.resourceType === mission.resourceType;
        }
        return true;
      }).length;
      return count >= mission.count;
    }
    default: {
      const _exhaustive: never = mission;
      return _exhaustive;
    }
  }
}
