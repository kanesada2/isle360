import type { Facility, ResourceType } from "./types";

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
  /** 建設に必要な研究カタログキー。未指定なら初期から建設可能 */
  requiredResearchKey?: string;
};

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
      "鉱物資源を掘削する施設。農業採集所より建設コストが高いが、単価の高い資源を産出できる。",
    buildCost: 400,
    demolishCost: 100,
    requiredResearchKey: "mineral-survey",
  },
  {
    key: "extractor-energy",
    kind: "extractor",
    resourceType: "energy",
    name: "エネルギー生産場",
    description:
      "エネルギー資源を回収する施設。Phase 3 解放後に建設可能。高効率だが建設コストが最も高い。",
    buildCost: 600,
    demolishCost: 150,
    requiredResearchKey: "energy-survey",
  },
  {
    key: "refinery",
    kind: "refinery",
    name: "精製工場",
    description:
      "採集された資源に付加価値を加えて売却価格を高める施設。隣接する最大8マスに効果を与える。",
    buildCost: 500,
    demolishCost: 120,
  },
  {
    key: "laboratory",
    kind: "laboratory",
    name: "研究所",
    description:
      "新技術の研究を進める施設。複数建設すると研究を並列化・加速できる。長期戦略に不可欠。",
    buildCost: 500,
    demolishCost: 120,
  },
] as const;
