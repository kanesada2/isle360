import type { ResearchId, ResourcePhase } from './types';

export type ResearchCatalogEntry = {
  key: ResearchId;
  name: string;
  description: string;
  baseCost: number;
  /** true の場合、研究するたびにコストが 50% 増加 */
  repeatable: boolean;
  /** 前提研究のキー一覧 */
  prerequisites: ResearchId[];
  /** この研究を完了するとアンロックされる資源フェーズ */
  unlocksPhase?: ResourcePhase;
  /** 指定した場合、デフォルトの RESEARCH_DURATION_MS の代わりにこの時間（ms）を使用する */
  researchDurationMs?: number;
  /** true の場合、特別な研究としてUIで強調表示する */
  special?: boolean;
};

export const MAX_RESEARCH_LEVEL = 5;

/**
 * 繰り返し研究の現在コストを返す（baseCost × 1.5^currentLevel）。
 * 非繰り返し研究はそのまま baseCost を返す。
 */
export function getResearchCost(
  entry: ResearchCatalogEntry,
  completedResearch: Map<ResearchId, number>,
): number {
  if (!entry.repeatable) return entry.baseCost;
  const currentLevel = completedResearch.get(entry.key) ?? 0;
  return Math.round(entry.baseCost * Math.pow(1.5, currentLevel));
}

const r = (s: string) => s as ResearchId;

export const RESEARCH_CATALOG: readonly ResearchCatalogEntry[] = [
  {
    key: r("agri-efficiency"),
    name: "農産物採集効率上昇",
    description:
      "農場の採集速度が 20% 向上する。Lv.5まで繰り返し研究可能だが、コストは毎回 50% 増加する。",
    baseCost: 100,
    repeatable: true,
    prerequisites: [],
  },
  {
    key: r("mineral-survey"),
    name: "鉱物調査",
    description:
      "各マスの鉱物埋蔵量が可視化され、鉱山の建設が可能になる。農産物採集効率上昇の研究完了が前提。",
    baseCost: 200,
    repeatable: false,
    prerequisites: [r("agri-efficiency")],
    unlocksPhase: 2,
  },
  {
    key: r("mineral-efficiency"),
    name: "鉱物採掘効率向上",
    description:
      "鉱山の採掘速度が 20% 向上する。Lv.5まで繰り返し研究可能だがコストは毎回 50% 増加。鉱物調査の完了が前提。",
    baseCost: 200,
    repeatable: true,
    prerequisites: [r("mineral-survey")],
  },
  {
    key: r("energy-survey"),
    name: "エネルギー資源調査",
    description:
      "各マスのエネルギー資源埋蔵量が可視化され、エネルギー生産場の建設が可能になる。鉱物採掘効率向上の研究完了が前提。",
    baseCost: 300,
    repeatable: false,
    prerequisites: [r("mineral-efficiency")],
    unlocksPhase: 3,
  },
  {
    key: r("energy-efficiency"),
    name: "エネルギー獲得効率向上",
    description:
      "エネルギー生産場の速度が 20% 向上する。Lv.5まで繰り返し研究可能だがコストは毎回 50% 増加。エネルギー資源調査の完了が前提。",
    baseCost: 300,
    repeatable: true,
    prerequisites: [r("energy-survey")],
  },
  {
    key: r("refinery-efficiency"),
    name: "精製効率向上",
    description:
      "精製工場によって高まる付加価値が 20% 向上する。Lv.5まで繰り返し研究可能だがコストは毎回 50% 増加する。",
    baseCost: 200,
    repeatable: true,
    prerequisites: [],
  },
  {
    key: r("construction-efficiency"),
    name: "建築速度向上",
    description:
      "施設の建造・破壊にかかる時間が 10% 短縮される。Lv.5まで繰り返し研究可能だがコストは毎回 50% 増加する。",
    baseCost: 300,
    repeatable: true,
    prerequisites: [],
  },
  {
    key: r("sustainable-farming"),
    name: "再生栽培",
    description:
      "農産資源が自然再生するようになる。研究完了に75秒かかる。",
    baseCost: 500,
    repeatable: false,
    prerequisites: [],
    researchDurationMs: 75_000,
    special: true,
  },
  {
    key: r("regen-efficiency"),
    name: "再生効率向上",
    description:
      "農産資源の再生速度が 20% 向上する。Lv.5まで繰り返し研究可能だがコストは毎回 50% 増加する。再生栽培の研究完了が前提。",
    baseCost: 200,
    repeatable: true,
    prerequisites: [r("sustainable-farming")],
  },
  {
    key: r("alternative-building"),
    name: "鉱物活用建築",
    description:
      "そのマスに埋蔵された鉱物資源の量に応じて建築に必要な資金が減少する。研究完了に75秒かかる。",
    baseCost: 500,
    repeatable: false,
    prerequisites: [],
    researchDurationMs: 75_000,
    special: true,
  },
  {
    key: r("alternativity-efficiency"),
    name: "鉱物活用率向上",
    description:
      "建築に必要な資源の減少率が20%向上する。Lv.5まで繰り返し研究可能だがコストは毎回 50% 増加する。鉱物活用建築の研究完了が前提。",
    baseCost: 200,
    repeatable: true,
    prerequisites: [r("alternative-building")],
  },
];
