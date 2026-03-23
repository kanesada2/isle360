import type { FacilityCatalogEntry } from './facility-catalog';
import { FACILITY_CATALOG } from './facility-catalog';
import { newFacilityId } from './id';
import { RESEARCH_CATALOG, type ResearchCatalogEntry } from './research-catalog';
import type { Extractor, Facility, FacilityId, Game, Laboratory, Monument, PlotIndex, Refinery, ResearchId, ResourceType } from './types';

export const BUILD_DURATION_MS = 20_000;
export const DEMOLISH_DURATION_MS = 10_000;
export const RESEARCH_DURATION_MS = 15_000;

/**
 * 繰り返し研究の現在コストを返す（baseCost × 1.5^currentLevel）。
 * 非繰り返し研究はそのまま baseCost を返す。
 */
export function getResearchCost(
  entry: ResearchCatalogEntry,
  completedResearch: Map<ResearchId, number>,
): number {
  if (!entry.repeatable) return entry.baseCost;
  const currentLevel = completedResearch.get(entry.key as ResearchId) ?? 0;
  return Math.round(entry.baseCost * Math.pow(1.5, currentLevel));
}

/** 指定 Laboratory で研究を開始する（state: processing） */
export function startResearch(
  game: Game,
  facilityId: FacilityId,
  entry: ResearchCatalogEntry,
  now: number,
): Game {
  const facility = game.facilities.get(facilityId);
  if (!facility || facility.kind !== 'laboratory' || facility.state !== 'idle') return game;

  const cost = getResearchCost(entry, game.player.completedResearch);
  if (game.player.funds < cost) return game;

  const newFacilities = new Map(game.facilities);
  newFacilities.set(facilityId, {
    ...(facility as Laboratory),
    state: 'processing' as const,
    currentJob: { startedAt: now, durationMs: RESEARCH_DURATION_MS },
    activeResearchId: entry.key as ResearchId,
  });

  const newPlayer = {
    ...game.player,
    funds: Math.round((game.player.funds - cost) * 100) / 100,
  };

  return { ...game, player: newPlayer, facilities: newFacilities };
}

/** 採掘の基本設定 */
const CYCLE_DURATION_MS = 200;    // 0.2秒ごとに1サイクル
const OUTPUT_PER_CYCLE = 1;       // 1サイクルあたりの採掘量（基本値）

/** 施設の表示名を返す */
export function getFacilityDisplayName(facility: Facility): string {
  if (facility.kind === 'extractor') {
    return FACILITY_CATALOG.find(
      (e) => e.kind === 'extractor' && e.resourceType === facility.resourceType,
    )?.name ?? '採集所';
  }
  return FACILITY_CATALOG.find((e) => e.kind === facility.kind)?.name ?? facility.kind;
}

/**
 * 上下左右に隣接するプロットのインデックスを返す（3×3 グリッド）。
 */
export function getAdjacentIndices(index: PlotIndex): PlotIndex[] {
  const row = Math.floor(index / 3);
  const col = index % 3;
  const adjacent: PlotIndex[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r = row + dr;
      const c = col + dc;
      if (r >= 0 && r < 3 && c >= 0 && c < 3) {
        adjacent.push((r * 3 + c) as PlotIndex);
      }
    }
  }
  return adjacent;
}

/**
 * 効率研究によるレベルから採掘倍率を計算する。
 * 対応する効率研究 1 レベルごとに +20%（複利）。
 */
function getExtractionMultiplier(
  resourceType: ResourceType,
  completedResearch: Map<ResearchId, number>,
): number {
  const keyMap: Record<ResourceType, string> = {
    agriculture: 'agri-efficiency',
    mineral:     'mineral-efficiency',
    energy:      'energy-efficiency',
  };
  const level = completedResearch.get(keyMap[resourceType] as ResearchId) ?? 0;
  return Math.pow(1.2, level);
}

/**
 * 建築技術研究によるレベルから建造・破壊時間の短縮倍率を計算する。
 * 1 レベルごとに -10%（複利）。
 */
function getConstructionMultiplier(completedResearch: Map<ResearchId, number>): number {
  const level = completedResearch.get('construction-efficiency' as ResearchId) ?? 0;
  return Math.pow(0.9, level);
}

/**
 * 精製技術研究によるレベルから精製工場の追加倍率を計算する。
 * 1 レベルごとに +20%（複利）。
 */
function getRefineryResearchMultiplier(completedResearch: Map<ResearchId, number>): number {
  const level = completedResearch.get('refinery-efficiency' as ResearchId) ?? 0;
  return Math.pow(1.2, level);
}

/**
 * 指定 Extractor の採掘で適用される精製倍率を計算する。
 * グリッド全体の稼働中 Refinery それぞれの有効倍率を積算する。
 */
function calcRefineryMultiplier(
  extractorPlotIndex: PlotIndex,
  plots: Game['plots'],
  facilities: Map<FacilityId, Facility>,
  completedResearch: Map<ResearchId, number>,
): number {
  let multiplier = 1.0;
  for (let i = 0; i < plots.length; i++) {
    if (i === extractorPlotIndex) continue;
    const facilityId = plots[i].facilityId;
    if (!facilityId) continue;
    const facility = facilities.get(facilityId);
    if (!facility || facility.kind !== 'refinery' || facility.state !== 'idle') continue;
    multiplier *= (facility as Refinery).valueMultiplier * getRefineryResearchMultiplier(completedResearch);
  }
  return multiplier;
}

/** 指定 plot に施設を建設開始する（state: constructing） */
export function buildFacility(
  game: Game,
  plotIndex: PlotIndex,
  entry: FacilityCatalogEntry,
  now: number,
): Game {
  const facilityId = newFacilityId();
  const base = {
    id: facilityId,
    plotIndex,
    buildCost: entry.buildCost,
    demolishCost: entry.demolishCost,
    state: 'constructing' as const,
    currentJob: { startedAt: now, durationMs: Math.round((entry.buildDurationMs ?? BUILD_DURATION_MS) * getConstructionMultiplier(game.player.completedResearch)) },
  };

  let facility: Facility;
  switch (entry.kind) {
    case 'extractor':
      facility = {
        ...base,
        kind: 'extractor',
        resourceType: entry.resourceType!,
        outputPerCycle: OUTPUT_PER_CYCLE,
        cycleDurationMs: CYCLE_DURATION_MS,
        lastCycleAt: null,
      };
      break;
    case 'refinery':
      facility = { ...base, kind: 'refinery', valueMultiplier: 1.2, cycleDurationMs: 8_000 };
      break;
    case 'laboratory':
      facility = { ...base, kind: 'laboratory', researchSpeedMultiplier: 1.0, activeResearchId: null };
      break;
    case 'booster':
      facility = { ...base, kind: 'booster', efficiencyBonus: 0.2, affectedIndices: [] };
      break;
    case 'monument':
      facility = { ...base, kind: 'monument' } as Monument;
      break;
  }

  const newFacilities = new Map(game.facilities);
  newFacilities.set(facilityId, facility);
  const newPlots = game.plots.map((p, i) =>
    i === plotIndex ? { ...p, facilityId } : p,
  ) as unknown as typeof game.plots;
  const newPlayer = {
    ...game.player,
    funds: game.player.funds - entry.buildCost,
  };

  return { ...game, player: newPlayer, facilities: newFacilities, plots: newPlots };
}

/** 指定 plot の施設を破壊開始する（state: demolishing） */
export function demolishFacility(game: Game, plotIndex: PlotIndex, now: number): Game {
  const facilityId = game.plots[plotIndex].facilityId;
  if (!facilityId) return game;

  const facility = game.facilities.get(facilityId);
  if (!facility) return game;

  const newFacilities = new Map(game.facilities);
  newFacilities.set(facilityId, {
    ...facility,
    state: 'demolishing' as const,
    currentJob: { startedAt: now, durationMs: Math.round(DEMOLISH_DURATION_MS * getConstructionMultiplier(game.player.completedResearch)) },
  });
  const newPlayer = {
    ...game.player,
    funds: game.player.funds - facility.demolishCost,
  };

  return { ...game, player: newPlayer, facilities: newFacilities };
}

/**
 * 毎フレーム呼ばれるゲームティック処理。
 * - 建設・破壊ジョブの完了判定
 * - Extractor の採掘サイクル処理
 * 変化がなければ同一参照を返す。
 */
export function tickFacilities(game: Game, now: number): Game {
  let changed = false;
  const newFacilities = new Map(game.facilities);
  let newPlots = game.plots;
  let newPlayer = game.player;

  for (const [id, facility] of game.facilities) {
    // ── 建設・破壊ジョブの完了チェック ──────────────────────────
    if (facility.currentJob) {
      const elapsed = now - facility.currentJob.startedAt;
      if (elapsed >= facility.currentJob.durationMs) {
        if (facility.state === 'constructing') {
          // Extractor は完了と同時に採掘タイマーを開始
          if (facility.kind === 'extractor') {
            newFacilities.set(id, { ...facility, state: 'idle' as const, currentJob: null, lastCycleAt: now });
          } else {
            newFacilities.set(id, { ...facility, state: 'idle' as const, currentJob: null });
          }
          changed = true;
          continue; // 同フレームで採掘処理はしない
        } else if (facility.state === 'processing' && facility.kind === 'laboratory') {
          const lab = facility as Laboratory;
          if (lab.activeResearchId) {
            const newCompletedResearch = new Map(newPlayer.completedResearch);
            const currentLevel = newCompletedResearch.get(lab.activeResearchId) ?? 0;
            newCompletedResearch.set(lab.activeResearchId, currentLevel + 1);
            newPlayer = { ...newPlayer, completedResearch: newCompletedResearch };
          }
          newFacilities.set(id, {
            ...lab,
            state: 'idle' as const,
            currentJob: null,
            activeResearchId: null,
          });
          changed = true;
          continue;
        } else if (facility.state === 'demolishing') {
          newFacilities.delete(id);
          newPlots = newPlots.map((p, i) =>
            i === facility.plotIndex ? { ...p, facilityId: null } : p,
          ) as unknown as typeof game.plots;
          changed = true;
          continue;
        }
      }
    }

    // ── Extractor 採掘処理 ────────────────────────────────────────
    if (facility.state !== 'idle' || facility.kind !== 'extractor') continue;
    const extractor = facility as Extractor;
    if (extractor.lastCycleAt === null) continue;

    const cyclesElapsed = Math.floor((now - extractor.lastCycleAt) / extractor.cycleDurationMs);
    if (cyclesElapsed <= 0) continue;

    // 対象 plot のデポジットを取得
    const plot = newPlots[extractor.plotIndex];
    const depositIdx = plot.deposits.findIndex((d) => d.type === extractor.resourceType);
    if (depositIdx === -1) continue;

    const deposit = plot.deposits[depositIdx];
    if (deposit.current <= 0) continue;

    // 研究倍率を適用した採掘量
    const multiplier = getExtractionMultiplier(extractor.resourceType, newPlayer.completedResearch);
    const wantToExtract = cyclesElapsed * extractor.outputPerCycle * multiplier;
    const actualExtract = Math.min(wantToExtract, deposit.current);

    // デポジット更新
    const newDeposits = plot.deposits.map((d, i) =>
      i === depositIdx ? { ...d, current: Math.round((d.current - actualExtract) * 100) / 100 } : d,
    );
    newPlots = newPlots.map((p, i) =>
      i === extractor.plotIndex ? { ...p, deposits: newDeposits } : p,
    ) as unknown as typeof game.plots;

    // 隣接する稼働中 Refinery の精製倍率を計算して資金加算
    const refineryMult = calcRefineryMultiplier(
      extractor.plotIndex,
      newPlots,
      newFacilities,
      newPlayer.completedResearch,
    );
    const fundsGained = actualExtract * deposit.phase * refineryMult;
    newPlayer = {
      ...newPlayer,
      funds: Math.round((newPlayer.funds + fundsGained) * 100) / 100,
    };

    // サイクル基準時刻を進める
    newFacilities.set(id, {
      ...extractor,
      lastCycleAt: extractor.lastCycleAt + cyclesElapsed * extractor.cycleDurationMs,
    });
    changed = true;
  }

  if (!changed) return game;
  return { ...game, player: newPlayer, facilities: newFacilities, plots: newPlots };
}

export type ResearchBreakdownItem = {
  name: string;
  level: number;
  cost: number;
  repeatable: boolean;
};

export type ScoreBreakdown = {
  total: number;
  resourcesMined: number;
  resourcesByType: Record<ResourceType, number>;
  researchSpent: number;
  researchBreakdown: ResearchBreakdownItem[];
  monumentBonus: number;
  monumentCount: number;
};

/**
 * ゲーム終了時のスコア内訳を計算する。
 */
export function computeScore(game: Game): ScoreBreakdown {
  let resourcesMined = 0;
  const resourcesByType: Record<ResourceType, number> = { agriculture: 0, mineral: 0, energy: 0 };
  for (const plot of game.plots) {
    for (const deposit of plot.deposits) {
      const mined = deposit.abundance - deposit.current;
      resourcesMined += mined;
      resourcesByType[deposit.type] += mined;
    }
  }

  let researchSpent = 0;
  const researchBreakdown: ResearchBreakdownItem[] = [];
  for (const [researchId, level] of game.player.completedResearch) {
    const entry = RESEARCH_CATALOG.find((e) => e.key === researchId);
    if (!entry) continue;
    for (let i = 0; i < level; i++) {
      const cost = Math.round(entry.baseCost * Math.pow(1.5, i));
      researchSpent += cost;
      researchBreakdown.push({ name: entry.name, level: i + 1, cost, repeatable: entry.repeatable });
    }
  }

  const monumentCount = [...game.facilities.values()].filter(
    (f) => f.kind === 'monument' && f.state === 'idle',
  ).length;
  const monumentBonus = monumentCount * 5000;

  const total = Math.floor(resourcesMined) + researchSpent + monumentBonus;

  return {
    total,
    resourcesMined: Math.floor(resourcesMined),
    resourcesByType: {
      agriculture: Math.floor(resourcesByType.agriculture),
      mineral: Math.floor(resourcesByType.mineral),
      energy: Math.floor(resourcesByType.energy),
    },
    researchSpent,
    researchBreakdown,
    monumentBonus,
    monumentCount,
  };
}
