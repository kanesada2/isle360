import { computeFundsPerSecond, getMineralBuildDiscountRate, getResearchCost } from '../domain/facility-actions';
import { FACILITY_CATALOG } from '../domain/facility-catalog';
import { RESEARCH_CATALOG } from '../domain/research-catalog';
import { getAvailableFacilityKeys } from '../domain/research-unlock';
import type { FacilityId, Game, Laboratory, PlotIndex, ResearchId } from '../domain/types';
import {
  bestExtractorIncomeForPlot,
  currentRefineryMult,
  effectiveBuildMs,
  effectiveDemolishMs,
  extractorROI,
  isResearchAvailable,
  refineryROI,
  researchROI,
  researchScoreGain,
} from './roi';
import type { Action } from './types';

const MONUMENT_ROI = 5_000 / 3_000; // ≈1.667
/**
 * globalBestGain × WAIT_FACTOR 未満の bestAffordableGain なら資金を温存する。
 * 研究・建設を統一比較するため gain（絶対収益増加量）ベースで適用。
 */
const WAIT_FACTOR = 1.5;

// ── エントリポイント ─────────────────────────────────────────────

export function decide(game: Game, now: number): Action | null {
  const remaining = game.sessionDurationMs - (now - game.startedAt!);
  if (remaining <= 0) return null;

  if (shouldBuildMonument(game, remaining)) {
    return decideMonumentAction(game, remaining);
  }

  return pickBestAction(game, remaining);
}

// ── 統一アクション選択 ────────────────────────────────────────────

/**
 * 研究・建設の全候補を「絶対収益増加量（G）」で統一評価し、最良を選ぶ。
 *
 * - 研究と建設は独立リソース（lab vs 空マス）なので並行実行可能。
 *   simulator のループが decide() を複数回呼ぶことで両方が実行される。
 * - 資金競合がある場合は gain の高い方を優先（WAIT_FACTOR で待ち判断）。
 */
function pickBestAction(game: Game, remaining: number): Action | null {
  type Candidate = { action: Action; gain: number; cost: number };
  const candidates: Candidate[] = [];

  // ── 研究候補（lab が idle の場合のみ実行可能）────────────────
  for (const entry of RESEARCH_CATALOG) {
      if (!isResearchAvailable(entry, game)) continue;
      const cost = getResearchCost(entry, game.player.completedResearch);
      const gain = researchScoreGain(game, entry, remaining);
      if (gain > 0) {
        const lab = findLab(game);
        if (lab) {
          candidates.push({ action: { kind: 'research', labId: lab.id, entry }, gain, cost });
        }
      }
    }

  // ── 建設候補 ───────────────────────────────────────────────────
  const available = getAvailableFacilityKeys(game.player.completedResearch);
  const labExists  = hasAnyLab(game);
  for (let i = 0; i < game.plots.length; i++) {
    const plotIndex = i as PlotIndex;
    if (game.plots[plotIndex].facilityId !== null) continue;
    for (const entry of FACILITY_CATALOG) {
      if (!available.has(entry.key)) continue;
      if (entry.kind === 'monument') continue;
      if (entry.kind === 'laboratory' && labExists) continue;
      const discountRate = getMineralBuildDiscountRate(plotIndex, game.plots, game.player.completedResearch);
      const cost = Math.max(1, entry.buildCost * (1 - discountRate));
      const roi  = calcFacilityROI(game, entry, plotIndex, remaining);
      // gain = roi × cost で ROI を絶対収益量（G）に変換して研究と同一スケールで比較
      const gain = roi * cost;
      if (gain > 0) {
        candidates.push({ action: { kind: 'build', plotIndex, entry }, gain, cost });
      }
    }
  }
  // ── 解体候補
  for (const [id, f] of game.facilities) {
    if(f.kind !== 'extractor') continue;
    if(f.state !== 'idle') continue;
    const extractingResource = game.plots[f.plotIndex].deposits.find(deposit => deposit.type == f.resourceType);
    if(extractingResource?.current === 0){
      candidates.push({ action: { kind: 'demolish', plotIndex: f.plotIndex }, gain: Infinity, cost: f.demolishCost });
    }
  }

  if (candidates.length === 0) return null;

  // gain の高い順に並べる
  candidates.sort((a, b) => b.gain - a.gain);

  const globalBest     = candidates[0];
  const bestAffordable = candidates.find(c => game.player.funds >= c.cost) ?? null;

  if (bestAffordable === null) return null;
  // 研究したいができない、ならキャンセル
  if(bestAffordable.action.kind === "research" && findLab(game)?.state !== "idle") return null;


  // より高価値な unaffordable 候補があれば資金を温存
  if (
    game.player.funds < globalBest.cost &&
    globalBest.gain > bestAffordable.gain * WAIT_FACTOR &&
    computeFundsPerSecond(game) > 0
  ) {
    return null;
  }

  return bestAffordable.action;
}

// ── Monument フェーズ ────────────────────────────────────────────

function shouldBuildMonument(game: Game, remaining: number): boolean {
  return optimalMonumentCount(game, remaining) > 0;
}

/**
 * 現在の状況で建設可能（かつ資金的に実現可能）な Monument の最大基数を返す。
 * 大きい基数から試し、afford できる最初の数を返す。
 */
export function optimalMonumentCount(game: Game, remaining: number): number {
  const effBuild    = effectiveBuildMs(game);
  const effDemolish = effectiveDemolishMs(game);
  const emptyPlots  = countEmptyPlots(game);
  const totalPlots  = game.plots.length;
  const demolishable = countDemolishable(game);
  const fps          = computeFundsPerSecond(game);

  const maxByTime     = Math.min(Math.floor(remaining / effBuild), totalPlots);
  const maxByTimeDemo = Math.min(Math.floor((remaining - effDemolish) / effBuild), totalPlots);

  for (let count = maxByTime; count >= 1; count--) {
    const needDemo     = count > emptyPlots;
    const demoCount    = Math.min(Math.max(0, count - emptyPlots), demolishable);
    const actualCount  = Math.min(count, emptyPlots + demolishable);
    if (actualCount < count) continue;
    if (needDemo && count > maxByTimeDemo) continue;

    // 解体候補を「残存価値の低い順」で選ぶ
    const demoCandidates = lowestValueDemolishCandidates(game, demoCount, remaining);
    const demoCost   = demoCandidates.reduce((s, c) => s + c.demolishCost, 0);

    const buildStartMs = demoCount > 0 ? effDemolish : 0;
    const projected    = game.player.funds + (buildStartMs / 1000) * fps;

    if (projected >= (count * 3_000 + demoCost)) return count;
  }
  return 0;
}

function decideMonumentAction(game: Game, remaining: number): Action | null {
  const isBuilding = [...game.facilities.values()].some(
    f => f.kind === 'monument' && f.state === 'constructing',
  );
  const isDemolishing = [...game.facilities.values()].some(
    f => f.state === 'demolishing',
  );
  if (isBuilding) return null;

  if (game.player.funds >= 3_000) {
    const emptyPlot     = findFirstEmptyPlot(game);
    const monumentEntry = FACILITY_CATALOG.find(e => e.key === 'monument')!;
    if (emptyPlot !== null) {
      return { kind: 'build', plotIndex: emptyPlot, entry: monumentEntry };
    }
    const plotIndex = findLowestValueNonMonumentPlot(game, remaining);
    if (plotIndex !== null && !isDemolishing) {
      return { kind: 'demolish', plotIndex };
    }
  }
  return null;
}

// ── 施設 ROI ─────────────────────────────────────────────────────

/**
 * 施設の ROI を計算する（gain = ROI × cost で絶対収益量に変換される）。
 * Laboratory の ROI は人工的に大きな値を設定し、必ず最優先で建設されるようにする。
 * ただしプロット間では機会費用で優先順位をつける。
 */
function calcFacilityROI(
  game: Game,
  entry: (typeof FACILITY_CATALOG)[number],
  plotIndex: PlotIndex,
  remaining: number,
): number {
  switch (entry.kind) {
    case 'extractor':  return extractorROI(game, plotIndex, entry, remaining);
    case 'refinery':   return refineryROI(game, entry, plotIndex, remaining);
    case 'laboratory': {
      const operatingMs     = Math.max(0, remaining - effectiveBuildMs(game));
      const opportunityCost = bestExtractorIncomeForPlot(game, plotIndex, operatingMs);
      // 1基目: gain = 1_000 × cost − opportunityCost （常に他候補を上回る大きさ）
      if (!hasAnyLab(game)) return 1_000 - opportunityCost / entry.buildCost;
      return bestAvailableResearchROI(game, operatingMs) - opportunityCost / entry.buildCost;
    }
    default: return 0;
  }
}

// ── ヘルパー ─────────────────────────────────────────────────────

export function findLab(game: Game): Laboratory | null {
  for (const f of game.facilities.values()) {
    if (f.kind === 'laboratory') return f as Laboratory;
  }
  return null;
}

function hasAnyLab(game: Game): boolean {
  return [...game.facilities.values()].some(
    f => f.kind === 'laboratory' &&
        (f.state === 'idle' || f.state === 'constructing' || f.state === 'processing'),
  );
}

function countEmptyPlots(game: Game): number {
  return game.plots.filter(p => p.facilityId === null).length;
}

function countDemolishable(game: Game): number {
  return [...game.facilities.values()].filter(
    f => f.kind !== 'monument' && f.state === 'idle',
  ).length;
}

function findFirstEmptyPlot(game: Game): PlotIndex | null {
  for (let i = 0; i < game.plots.length; i++) {
    if (game.plots[i].facilityId === null) return i as PlotIndex;
  }
  return null;
}

function findLowestValueNonMonumentPlot(game: Game, remaining: number): PlotIndex | null {
  let worst: { plotIndex: PlotIndex; value: number } | null = null;
  for (const [id, f] of game.facilities) {
    if (f.kind === 'monument' || f.state !== 'idle') continue;
    const idx = game.plots.findIndex(p => p.facilityId === id);
    if (idx === -1) continue;
    const plotIndex = idx as PlotIndex;
    const value     = facilityRemainingValue(game, id, plotIndex, remaining);
    if (!worst || value < worst.value) worst = { plotIndex, value };
  }
  return worst?.plotIndex ?? null;
}

function facilityRemainingValue(
  game: Game,
  id: FacilityId,
  plotIndex: PlotIndex,
  remaining: number,
): number {
  const f = game.facilities.get(id)!;
  if (f.kind === 'extractor') {
    const deposit = game.plots[plotIndex].deposits.find(d => d.type === f.resourceType);
    if (!deposit) return 0;
    return deposit.current * deposit.gain * currentRefineryMult(game);
  }
  if (f.kind === 'refinery') {
    const effLevel    = game.player.completedResearch.get('refinery-efficiency' as ResearchId) ?? 0;
    const singleMult  = Math.pow(1.2, 1 + effLevel);
    const curMult     = currentRefineryMult(game);
    const multWithout = curMult / singleMult;
    const fps         = computeFundsPerSecond(game);
    return fps * (curMult / Math.max(multWithout, 1e-9) - 1) * (remaining / 1000);
  }
  return Infinity; // Laboratory は解体しない
}

/**
 * 解体候補を残存価値の低い順に最大 count 件返す。
 * 残存価値 = 解体せずそのまま稼働させた場合の残り収入推定値。
 */
function lowestValueDemolishCandidates(
  game: Game,
  count: number,
  remaining: number,
): { demolishCost: number; remainingValue: number; plotIndex: PlotIndex }[] {
  if (count <= 0) return [];
  const candidates: { demolishCost: number; remainingValue: number; plotIndex: PlotIndex }[] = [];
  for (const [id, f] of game.facilities) {
    if (f.kind === 'monument' || f.state !== 'idle') continue;
    const idx = game.plots.findIndex(p => p.facilityId === id);
    if (idx === -1) continue;
    const plotIndex = idx as PlotIndex;
    candidates.push({
      demolishCost:   f.demolishCost,
      remainingValue: facilityRemainingValue(game, id, plotIndex, remaining),
      plotIndex,
    });
  }
  return candidates
    .sort((a, b) => a.remainingValue - b.remainingValue)
    .slice(0, count);
}


function bestAvailableResearchROI(game: Game, remaining: number): number {
  let best = 1.0;
  for (const entry of RESEARCH_CATALOG) {
    if (!isResearchAvailable(entry, game)) continue;
    const roi = researchROI(game, entry, remaining);
    if (roi > best) best = roi;
  }
  return best;
}
