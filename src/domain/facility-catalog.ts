import type { Facility, FacilityId, ResearchId, ResourceType } from "./types";

export type FacilityCatalogEntry = {
  /** カタログ内での一意キー */
  key: string;
  kind: Facility["kind"];
  /** Extractor の場合のみ */
  resourceType?: ResourceType;
  name: string;
  description: string;
  buildCost: number;
  demolishCost: number;
  /** 建設時間（ms）。未指定なら BUILD_DURATION_MS を使用 */
  buildDurationMs?: number;
  /** 建設に必要な研究カタログキー。未指定なら初期から建設可能 */
  requiredResearchKey?: ResearchId;
};

/** 割引率を適用した実際の建設コストを返す */
export function getActualBuildCost(entry: FacilityCatalogEntry, discountRate: number): number {
  return Math.round(entry.buildCost * (1 - discountRate));
}

/**
 * 指定した施設が建設可能かどうかを返す。
 * - 前提研究完了済み
 * - 資金が足りている
 * - monument が建設中でない（monument の場合）
 */
export function isFacilityAvailable(
  entry: FacilityCatalogEntry,
  completedResearch: Map<ResearchId, number>,
  funds: number,
  discountRate: number,
  facilities: Map<FacilityId, Facility>,
): boolean {
  if (entry.requiredResearchKey && !completedResearch.has(entry.requiredResearchKey)) return false;
  if (getActualBuildCost(entry, discountRate) > funds) return false;
  if (entry.kind === 'monument' && [...facilities.values()].some((f) => f.kind === 'monument' && f.state === 'constructing')) return false;
  return true;
}

const r = (s: string) => s as ResearchId;

export const FACILITY_CATALOG: readonly FacilityCatalogEntry[] = [
  {
    key: "extractor-agriculture",
    kind: "extractor",
    resourceType: "agriculture",
    name: "農場",
    description:
      "農産資源を継続的に採集する施設。低コストで建設できる。",
    buildCost: 200,
    demolishCost: 50,
  },
  {
    key: "extractor-mineral",
    kind: "extractor",
    resourceType: "mineral",
    name: "鉱山",
    description:
      "鉱物資源を掘削する施設。建設のためには研究が必要。農場より建設コストが高いが、単価の高い資源を産出できる。",
    buildCost: 400,
    demolishCost: 100,
    requiredResearchKey: r("mineral-survey"),
  },
  {
    key: "extractor-energy",
    kind: "extractor",
    resourceType: "energy",
    name: "エネルギー生産場",
    description:
      "エネルギー資源を回収する施設。建設のためには研究が必要。建設コストが最も高いが、最も高い単価の資源を採集できる。",
    buildCost: 600,
    demolishCost: 150,
    requiredResearchKey: r("energy-survey"),
  },
  {
    key: "refinery",
    kind: "refinery",
    name: "精製工場",
    description:
      "採集された資源に付加価値を加えて売却価格を高める施設。",
    buildCost: 300,
    demolishCost: 70,
  },
  {
    key: "laboratory",
    kind: "laboratory",
    name: "研究所",
    description:
      "新技術の研究を進める施設。複数建設すると研究を並列化・加速できる。",
    buildCost: 500,
    demolishCost: 120,
  },
  {
    key: "subdivision",
    kind: "subdivision",
    name: "開発区画",
    description: "民間が使用できる区画。建設完了すると資源残存量に応じて即座に資金を得られるが、買い戻すと割高。",
    buildCost: 0,
    demolishCost: 1000
  },
  {
    key: "monument",
    kind: "monument",
    name: "繁栄の象徴",
    description:
      "島の繁栄を示す建造物。一つの建設が完了するまで、次を建設開始できない。スコアに大きく貢献する。",
    buildCost: 3000,
    demolishCost: 0,
  },
] as const;
