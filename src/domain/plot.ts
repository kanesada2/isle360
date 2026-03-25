import { type Rng } from "./rng";
import type { Plot, PlotIndex, ResourceDeposit } from "./types";

const PLOT_INDICES = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const satisfies PlotIndex[];

/** 全マスの abundance 合計の基準値 */
const BASE_TOTAL_ABUNDANCE = 1.5;

/** 基準値からのばらつき幅（±） */
const ABUNDANCE_VARIANCE = 0.15;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** 逆重み付きサンプリングで使うスムージング定数（累積量が0でも極端にならないよう）*/
const BALANCE_EPSILON = BASE_TOTAL_ABUNDANCE / 3;

function generateDeposits(_index: PlotIndex, rng: Rng): ResourceDeposit[] {
  // マスごとの合計量：基準値 ± ばらつき
  const total = BASE_TOTAL_ABUNDANCE + (rng() * 2 - 1) * ABUNDANCE_VARIANCE;

  // 3つの乱数を正規化して合計が total になるよう配分
  const raw = [rng(), rng(), rng()];
  const sum = raw[0] + raw[1] + raw[2];
  const [agri, mineral, energy] = raw.map((v) =>
    Math.min(1.0, Math.max(0.0, round2((v / sum) * total))) * 1000
  );

  return [
    { type: "agriculture", phase: 1, abundance: agri,    current: agri,    totalMined: 0 },
    { type: "mineral",     phase: 2, abundance: mineral, current: mineral, totalMined: 0 },
    { type: "energy",      phase: 3, abundance: energy,  current: energy,  totalMined: 0 },
  ];
}

export function generatePlots(rng: Rng = Math.random): readonly Plot[] {
  return PLOT_INDICES.map((index): Plot => ({
    deposits: generateDeposits(index, rng),
    facilityId: null,
  }));
}
