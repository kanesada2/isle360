import type { ResearchId, ResourcePhase } from './types';
import { FACILITY_CATALOG } from './facility-catalog';
import { RESEARCH_CATALOG } from './research-catalog';

/**
 * 完了した研究から「可視化されているフェーズ」のSetを導出する。
 * Phase 1 (農産) は常に開放済み。
 */
export function getUnlockedPhases(
  completedResearch: Map<ResearchId, number>,
): Set<ResourcePhase> {
  const phases = new Set<ResourcePhase>([1]);
  for (const entry of RESEARCH_CATALOG) {
    if (entry.unlocksPhase && completedResearch.has(entry.key as ResearchId)) {
      phases.add(entry.unlocksPhase);
    }
  }
  return phases;
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
      completedResearch.has(entry.requiredResearchKey as ResearchId)
    ) {
      available.add(entry.key);
    }
  }
  return available;
}
