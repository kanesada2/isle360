/**
 * 純粋な ROI・収益計算ユーティリティ。
 * ゲーム状態を受け取り数値を返すだけで副作用なし。
 */
import {
  BUILD_DURATION_MS,
  DEMOLISH_DURATION_MS,
  EXTRACTION_RESEARCH_KEYS,
  RESEARCH_DURATION_MS,
  computeFundsPerSecond,
  getMineralBuildDiscountRate,
  getResearchCost,
} from '../domain/facility-actions';
import type { FacilityCatalogEntry } from '../domain/facility-catalog';
import type { ResearchCatalogEntry } from '../domain/research-catalog';
import { RESEARCH_CATALOG } from '../domain/research-catalog';
import { isResearchAvailable as domainIsResearchAvailable } from '../domain/research-unlock';
import type { Extractor, Game, PlotIndex, ResearchId, ResourceType } from '../domain/types';

const r = (s: string) => s as ResearchId;

// ── 建設時間 ────────────────────────────────────────────────────

export function effectiveBuildMs(game: Game): number {
  const level = game.player.completedResearch.get(r('construction-efficiency')) ?? 0;
  return BUILD_DURATION_MS * Math.pow(0.9, level);
}

export function effectiveDemolishMs(game: Game): number {
  const level = game.player.completedResearch.get(r('construction-efficiency')) ?? 0;
  return DEMOLISH_DURATION_MS * Math.pow(0.9, level);
}

// ── Refinery 乗数 ───────────────────────────────────────────────

export function currentRefineryMult(game: Game): number {
  const effLevel = 1//一番資金効率がいいレベルで計算しておく game.player.completedResearch.get(r('refinery-efficiency')) ?? 0;
  const singleMult = Math.pow(1.1, 1 + effLevel);
  const count = [...game.facilities.values()].filter(
    f => f.kind === 'refinery' && f.state === 'idle',
  ).length;
  return Math.pow(singleMult, count);
}

/** Refinery を1基追加した場合の乗数 */
export function refineryMultForNew(game: Game): number {
  const effLevel = 1//一番資金効率がいいレベルで計算しておく game.player.completedResearch.get(r('refinery-efficiency')) ?? 0;
  const singleMult = Math.pow(1.1, 1 + effLevel);
  return currentRefineryMult(game) * singleMult;
}

// ── 収入計算 ────────────────────────────────────────────────────

/** 指定資源タイプの稼働中 Extractor 合計収入（資金/秒） */
export function incomeByResourceType(game: Game, resourceType: ResourceType): number {
  let total = 0;
  for (const f of game.facilities.values()) {
    if (f.kind !== 'extractor' || f.resourceType !== resourceType || f.state !== 'idle') continue;
    const extractor = f as Extractor;
    const deposit = game.plots[extractor.plotIndex].deposits.find(d => d.type === resourceType);
    if (!deposit || deposit.current <= 0) continue;
    const effLevel = game.player.completedResearch.get(EXTRACTION_RESEARCH_KEYS[resourceType]) ?? 0;
    const unitsPerSec = Math.pow(1.2, effLevel) * 5; // OUTPUT_PER_CYCLE / (CYCLE_DURATION_MS/1000)
    total += unitsPerSec * deposit.gain * currentRefineryMult(game);
  }
  return total;
}

// ── 施設 ROI ────────────────────────────────────────────────────

export function extractorROI(
  game: Game,
  plotIndex: PlotIndex,
  entry: FacilityCatalogEntry,
  remainingMs: number,
): number {
  if (!entry.resourceType) return 0;
  const deposit = game.plots[plotIndex].deposits.find(d => d.type === entry.resourceType);
  if (!deposit || deposit.current <= 0) return 0;

  const effLevel = game.player.completedResearch.get(EXTRACTION_RESEARCH_KEYS[entry.resourceType]) ?? 0;
  const unitsPerSec = Math.pow(1.2, effLevel) * 5;
  const refineMult = currentRefineryMult(game);
  const incomePerSec = unitsPerSec * deposit.gain * refineMult;

  const operatingMs = Math.max(0, remainingMs - effectiveBuildMs(game));
  // 実際の採掘量は deposit.current で上限
  const projectedIncome = Math.min(
    incomePerSec * (operatingMs / 1000),
    deposit.current * deposit.gain * refineMult,
  );

  const discountRate = getMineralBuildDiscountRate(plotIndex, game.plots, game.player.completedResearch);
  const cost = Math.max(1, entry.buildCost * (1 - discountRate));

  // 機会費用補正: マス内の全資源の価値（abundance × gain）を比較し、
  // 対象資源がそのマスで最も価値が低いほど ROI を減衰させる。
  // フェーズ未解放の鉱物・エネルギー deposit も含めて判断する。
  const dominance = plotResourceDominance(game.plots[plotIndex].deposits, entry.resourceType);

  return (projectedIncome / cost) * dominance;
}

/**
 * マス内の全 deposit の中で対象資源が占める価値の割合。
 * 価値 = abundance × gain（フェーズ倍率を込みで比較する）。
 * 0.0〜1.0 を返す（1.0 = そのマスで最も価値ある資源）。
 */
function plotResourceDominance(deposits: { type: ResourceType; phase: number; gain: number, abundance: number }[], resourceType: ResourceType): number {
  const targetValue = (deposits.find(d => d.type === resourceType)?.abundance ?? 0) *
    (deposits.find(d => d.type === resourceType)?.gain ?? 1);
  const maxValue = Math.max(...deposits.map(d => d.abundance * d.gain), 1);
  return targetValue / maxValue;
}

export function refineryROI(
  game: Game,
  entry: FacilityCatalogEntry,
  plotIndex: PlotIndex,
  remainingMs: number,
): number {
  const operatingMs = Math.max(0, remainingMs - effectiveBuildMs(game));
  const currentIncome = computeFundsPerSecond(game);
  if (currentIncome <= 0) return 0;

  const curMult = currentRefineryMult(game);
  const newMult = refineryMultForNew(game);
  const incomeIncrease = currentIncome * (newMult / Math.max(curMult, 1e-9) - 1);
  const scoreGain = incomeIncrease * (operatingMs / 1000);

  // 機会費用: このマスに Extractor を建てていたら得られた最大収入を差し引く
  const opportunityCost = bestExtractorIncomeForPlot(game, plotIndex, operatingMs);

  return (scoreGain - opportunityCost) / entry.buildCost;
}

/**
 * マスの最良 Extractor が生む収入（deposit 枯渇上限込み）。
 * フェーズ未解放の資源も含める（「将来あのマスに鉱山を建てる」という判断を可能にする）。
 * フェーズ未解放の資源も含めて比較する。
 * 「鉱物豊富なマスには将来鉱山を建てる」という判断を refineryROI に反映するため。
 */
export function bestExtractorIncomeForPlot(game: Game, plotIndex: PlotIndex, operatingMs: number): number {
  const refineMult = currentRefineryMult(game);
  let best = 0;
  for (const deposit of game.plots[plotIndex].deposits) {
    if (deposit.current <= 0) continue;
    const effLevel   = game.player.completedResearch.get(EXTRACTION_RESEARCH_KEYS[deposit.type]) ?? 0;
    const ratePerSec = Math.pow(1.2, effLevel) * 5;
    const income = Math.min(ratePerSec * (operatingMs / 1000), deposit.current) * deposit.gain * refineMult;
    if (income > best) best = income;
  }
  return best;
}

// ── 研究 ROI ────────────────────────────────────────────────────

/** 初期実装でスキップする研究（ROI計算が複雑な special 系） */
const SKIP_RESEARCH_KEYS = new Set([
  'sustainable-farming',
  'alternative-building',
  'regen-efficiency',
  'alternativity-efficiency',
]);

export function isResearchAvailable(entry: ResearchCatalogEntry, game: Game): boolean {
  if (SKIP_RESEARCH_KEYS.has(entry.key as string)) return false;
  if (game.player.activeResearchIds.has(entry.key)) return false;
  return domainIsResearchAvailable(entry, game.player.completedResearch, game.player.funds, game.facilities);
}

/**
 * 研究による収入増加の総額を返す（researchSpent 加算分は含めない）。
 *
 * チェーン伝播: この研究を完了することで新たにアンロックされる研究の価値も加算する。
 * 例: agri-efficiency の gain ≈ 0 に見えても、完了後に mineral-survey が使えるようになるため
 *     mineral-survey（→ mineral-efficiency → energy-survey → …）の価値が加算される。
 *
 * @param completedResearch チェーン再帰時にシミュレート済み完了状態を渡す（外部呼び出しは省略可）
 */
export function researchScoreGain(
  game: Game,
  entry: ResearchCatalogEntry,
  remainingMs: number,
  completedResearch?: Map<ResearchId, number>,
): number {
  const completed = completedResearch ?? game.player.completedResearch;
  const durationMs = entry.researchDurationMs ?? RESEARCH_DURATION_MS;
  const remainingAfter = remainingMs - durationMs;
  if (remainingAfter <= 0) return 0;

  // ── 対応施設なし guard ────────────────────────────────────────
  // 効率系研究は対応施設が存在しない場合、chain gain も含めてスキップ。
  // こうすることで「Extractor を建てる → 効率研究 → survey 解放」という
  // 正しい順序が保たれる。
  if (!entry.unlocksPhase && !hasFacilityForEfficiency(game, entry)) return 0;

  // ── 直接 gain ────────────────────────────────────────────────
  let gain: number;
  if (entry.unlocksPhase) {
    // フェーズ解放研究: 上位2プロットの新資源 Extractor 建設価値を推定
    const resourceType: ResourceType = entry.unlocksPhase === 2 ? 'mineral' : 'energy';
    const effLevel   = game.player.completedResearch.get(EXTRACTION_RESEARCH_KEYS[resourceType]) ?? 0;
    const unitsPerSec = Math.pow(1.2, effLevel) * 5;
    const refineMult  = currentRefineryMult(game);
    const phase       = entry.unlocksPhase as number;
    const effBuildMs  = effectiveBuildMs(game);

    const topDeposits = [...game.plots]
      .map(p => p.deposits.find(d => d.type === resourceType)?.current ?? 0)
      .sort((a, b) => b - a)
      .slice(0, 2);

    gain = 0;
    for (const depositCurrent of topDeposits) {
      if (depositCurrent <= 0) continue;
      const operatingMs = Math.max(0, remainingAfter - effBuildMs);
      const projected   = Math.min(unitsPerSec * (operatingMs / 1000), depositCurrent);
      gain += projected * phase * refineMult;
    }
  } else {
    // 効率系研究: deposit の枯渇上限を考慮した実際の収入増加量
    gain = estimateEfficiencyGain(game, entry, remainingAfter);
  }

  // ── チェーン gain ─────────────────────────────────────────────
  // この研究を完了した後に新たにアンロックされる研究の最大 gain を加算する
  const newCompleted = new Map(completed);
  newCompleted.set(entry.key, (newCompleted.get(entry.key) ?? 0) + 1);

  let chainGain = 0;
  for (const other of RESEARCH_CATALOG) {
    if (SKIP_RESEARCH_KEYS.has(other.key as string)) continue;
    if (other.key === entry.key) continue;
    // 一度完了した非繰り返し研究は二重カウントしない
    if (!other.repeatable && (newCompleted.get(other.key) ?? 0) > 0) continue;
    // この研究を完了する「前」は利用不可だったか
    const wasAvailable = other.prerequisites.every((p: ResearchId) => (completed.get(p) ?? 0) > 0);
    if (wasAvailable) continue;
    // この研究を完了した「後」は利用可能になるか
    const isNowAvailable = other.prerequisites.every((p: ResearchId) => (newCompleted.get(p) ?? 0) > 0);
    if (!isNowAvailable) continue;

    const otherGain = researchScoreGain(game, other, remainingAfter, newCompleted);
    if (otherGain > chainGain) chainGain = otherGain;
  }

  return gain + chainGain;
}

/**
 * ROI = 収入増加総額 / コスト
 * 1.0 超 = 研究コストより多く稼げる（survey 系・前提研究が突出して高くなる）
 * 1.0 未満 = 収入増加がコストを下回るため原則スキップ
 */
export function researchROI(
  game: Game,
  entry: ResearchCatalogEntry,
  remainingMs: number,
): number {
  const cost = getResearchCost(entry, game.player.completedResearch);
  const scoreGain = researchScoreGain(game, entry, remainingMs);
  return scoreGain / cost;
}

/**
 * 効率系研究による実際の収入増加量（deposit の枯渇上限を考慮）。
 *
 * 採掘効率: 速度が上がっても deposit が先に枯渇する場合は増加ゼロ。
 * 精製効率: 採掘速度は変わらず単価だけ上がるため、将来の採掘量 × 単価差が増加分。
 */
function estimateEfficiencyGain(game: Game, entry: ResearchCatalogEntry, remainingAfterMs: number): number {
  const resourceTypeMap: Record<string, ResourceType> = {
    'agri-efficiency':    'agriculture',
    'mineral-efficiency': 'mineral',
    'energy-efficiency':  'energy',
  };
  const resourceType = resourceTypeMap[entry.key as string];
  const operatingSec = remainingAfterMs / 1000;
  const refineMult   = currentRefineryMult(game);

  if (resourceType) {
    const effLevel = game.player.completedResearch.get(EXTRACTION_RESEARCH_KEYS[resourceType]) ?? 0;
    const rateNow  = Math.pow(1.2, effLevel) * 5;   // units/sec（現在）
    const rateNew  = rateNow * 1.2;                  // units/sec（研究後）
    // sustainable-farming 研究済みの場合、農産資源は再生するため枯渇上限を無視する
    const sfResearched = resourceType === 'agriculture' &&
      (game.player.completedResearch.get(r('sustainable-farming')) ?? 0) > 0;
    let gain = 0;
    for (const f of game.facilities.values()) {
      if (f.kind !== 'extractor' || (f as Extractor).resourceType !== resourceType || f.state !== 'idle') continue;
      const deposit = game.plots[(f as Extractor).plotIndex].deposits.find(d => d.type === resourceType);
      if (!deposit || deposit.current <= 0) continue;
      const totalNow = sfResearched ? rateNow * operatingSec : Math.min(rateNow * operatingSec, deposit.current);
      const totalNew = sfResearched ? rateNew * operatingSec : Math.min(rateNew * operatingSec, deposit.current);
      gain += (totalNew - totalNow) * deposit.gain * refineMult;
    }
    return gain;
  }

  if ((entry.key as string) === 'refinery-efficiency') {
    const refineryCount = [...game.facilities.values()].filter(
      f => f.kind === 'refinery' && f.state === 'idle',
    ).length;
    const curMult  = currentRefineryMult(game);
    // 研究後: 各 Refinery の singleMult が ×1.2 になるため積が 1.2^count 倍になる
    const newMult  = curMult * Math.pow(1.1, refineryCount);
    if (newMult <= curMult) return 0;

    // 精製効率は採掘速度を変えない → 将来採掘量は同じ、単価差だけが増加分
    let gain = 0;
    for (const f of game.facilities.values()) {
      if (f.kind !== 'extractor' || f.state !== 'idle') continue;
      const extractor = f as Extractor;
      const deposit = game.plots[extractor.plotIndex].deposits.find(d => d.type === extractor.resourceType);
      if (!deposit || deposit.current <= 0) continue;
      const effKey    = EXTRACTION_RESEARCH_KEYS[extractor.resourceType];
      const level     = game.player.completedResearch.get(effKey) ?? 0;
      const ratePerSec = Math.pow(1.1, level) * 5;
      const futureMined = Math.min(ratePerSec * operatingSec, deposit.current);
      gain += futureMined * deposit.gain * (newMult - curMult);
    }
    return gain;
  }

  return 0;
}

/** 効率系研究に対応する施設が一基でも存在するか（建設中・idle 問わず）
 * extractorは二基でいく
*/
function hasFacilityForEfficiency(game: Game, entry: ResearchCatalogEntry): boolean {
  const resourceTypeMap: Record<string, ResourceType> = {
    'agri-efficiency':    'agriculture',
    'mineral-efficiency': 'mineral',
    'energy-efficiency':  'energy',
  };
  const resourceType = resourceTypeMap[entry.key as string];
  if (resourceType) {
    return [...game.facilities.values()].filter(
      f => f.kind === 'extractor' && (f as Extractor).resourceType === resourceType,
    ).length >= 2;
  }
  if ((entry.key as string) === 'refinery-efficiency') {
    return [...game.facilities.values()].some(f => f.kind === 'refinery');
  }
  return true; // construction-efficiency など: 制約なし
}
