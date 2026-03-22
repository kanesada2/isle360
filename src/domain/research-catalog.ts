import type { ResourcePhase } from './types';

export type ResearchCatalogEntry = {
  key: string;
  name: string;
  description: string;
  baseCost: number;
  /** true の場合、研究するたびにコストが 50% 増加 */
  repeatable: boolean;
  /** 前提研究のキー一覧 */
  prerequisites: string[];
  /** この研究を完了するとアンロックされる資源フェーズ */
  unlocksPhase?: ResourcePhase;
};

export const RESEARCH_CATALOG: readonly ResearchCatalogEntry[] = [
  {
    key: "agri-efficiency",
    name: "農産物採集効率上昇",
    description:
      "農場の採集速度が 20% 向上する。繰り返し研究するたびにさらに 20% 積み重ねられるが、研究コストは毎回 50% 増加する。",
    baseCost: 100,
    repeatable: true,
    prerequisites: [],
  },
  {
    key: "mineral-survey",
    name: "鉱物調査",
    description:
      "各マスの鉱物埋蔵量が可視化され、鉱山の建設が可能になる。農産物採集効率上昇の研究完了が前提。",
    baseCost: 200,
    repeatable: false,
    prerequisites: ["agri-efficiency"],
    unlocksPhase: 2,
  },
  {
    key: "mineral-efficiency",
    name: "鉱物採掘効率向上",
    description:
      "鉱山の採掘速度が 20% 向上する。繰り返し研究可能だがコストは毎回 50% 増加。鉱物調査の完了が前提。",
    baseCost: 200,
    repeatable: true,
    prerequisites: ["mineral-survey"],
  },
  {
    key: "energy-survey",
    name: "エネルギー資源調査",
    description:
      "各マスのエネルギー資源埋蔵量が可視化され、エネルギー生産場の建設が可能になる。鉱物採掘効率向上の研究完了が前提。",
    baseCost: 300,
    repeatable: false,
    prerequisites: ["mineral-efficiency"],
    unlocksPhase: 3,
  },
  {
    key: "energy-efficiency",
    name: "エネルギー獲得効率向上",
    description:
      "エネルギー生産場の速度が 20% 向上する。繰り返し研究可能だがコストは毎回 50% 増加。エネルギー資源調査の完了が前提。",
    baseCost: 300,
    repeatable: true,
    prerequisites: ["energy-survey"],
  },
  {
    key: "refinery-efficiency",
    name: "精製技術向上",
    description:
      "精製工場によって高まる付加価値が 20% 向上する。繰り返し研究可能だがコストは毎回 50% 増加する。",
    baseCost: 200,
    repeatable: true,
    prerequisites: [],
  },
  {
    key: "construction-efficiency",
    name: "建築技術向上",
    description:
      "施設の建造・破壊にかかる時間が 10% 短縮される。繰り返し研究可能だがコストは毎回 50% 増加する。",
    baseCost: 300,
    repeatable: true,
    prerequisites: [],
  },
] as const;
