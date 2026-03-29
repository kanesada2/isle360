import type { Facility, FacilityId, ResearchId, ResourcePhase } from './types';
import { FACILITY_CATALOG } from './facility-catalog';
import { RESEARCH_CATALOG, MAX_RESEARCH_LEVEL, getResearchCost, type ResearchCatalogEntry } from './research-catalog';

/**
 * 完了した研究から「可視化されているフェーズ」のSetを導出する。
 * Phase 1 (農産) は常に開放済み。
 */
export function getUnlockedPhases(
  completedResearch: Map<ResearchId, number>,
): Set<ResourcePhase> {
  const phases = new Set<ResourcePhase>([1]);
  for (const entry of RESEARCH_CATALOG) {
    if (entry.unlocksPhase && completedResearch.has(entry.key)) {
      phases.add(entry.unlocksPhase);
    }
  }
  return phases;
}

/**
 * 完了した研究から「現在研究可能なエントリ一覧」を導出する。
 * - 非繰り返し研究：未完了のもののみ
 * - 繰り返し研究：MAX_RESEARCH_LEVEL 未満のもののみ
 */
export function getAvailableResearch(
  completedResearch: Map<ResearchId, number>,
): ResearchCatalogEntry[] {
  return RESEARCH_CATALOG.filter((e) => {
    const level = completedResearch.get(e.key) ?? 0;
    return e.repeatable ? level < MAX_RESEARCH_LEVEL : level === 0;
  });
}

/**
 * 指定した研究が実行可能かどうかを返す。
 * - 前提研究完了済み
 * - 資金が足りている
 * - いずれかの研究所で同じ研究が進行中でない
 */
export function isResearchAvailable(
  entry: ResearchCatalogEntry,
  completedResearch: Map<ResearchId, number>,
  funds: number,
  facilities: Map<FacilityId, Facility>,
): boolean {
  const level = completedResearch.get(entry.key) ?? 0;
  if (entry.repeatable ? level >= MAX_RESEARCH_LEVEL : level > 0) return false;
  if (!entry.prerequisites.every((prereq) => (completedResearch.get(prereq) ?? 0) >= 1)) return false;
  if (getResearchCost(entry, completedResearch) > funds) return false;
  if ([...facilities.values()].some((f) => f.kind === 'laboratory' && f.state === 'processing' && f.activeResearchId === entry.key)) return false;
  return true;
}


/**
 * 完了した研究から「建設可能な施設キー」のSetを導出する。
 * requiredResearchKey が未設定の施設は初期から建設可能。
 */
export function getAvailableFacilityKeys(
  completedResearch: Map<ResearchId, number>,
): Set<string> {
  const available = new Set<string>();
  for (const entry of FACILITY_CATALOG) {
    if (
      !entry.requiredResearchKey ||
      completedResearch.has(entry.requiredResearchKey)
    ) {
      available.add(entry.key);
    }
  }
  return available;
}
