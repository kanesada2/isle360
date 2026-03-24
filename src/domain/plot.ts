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

function generateDeposits(acc: [number, number, number], rng: Rng): ResourceDeposit[] {
  // マスごとの合計量：基準値 ± ばらつき（従来通り独立して生成）
  const total = BASE_TOTAL_ABUNDANCE + (rng() * 2 - 1) * ABUNDANCE_VARIANCE;

  // 累積量が多い資源ほど重みが小さくなるよう逆数で補正
  const raw = [
    rng() / (acc[0] + BALANCE_EPSILON),
    rng() / (acc[1] + BALANCE_EPSILON),
    rng() / (acc[2] + BALANCE_EPSILON),
  ];
  const sum = raw[0] + raw[1] + raw[2];
  const [agri, mineral, energy] = raw.map((v) =>
    Math.min(1.0, Math.max(0.0, round2((v / sum) * total)))
  );

  return [
    { type: "agriculture", phase: 1, abundance: agri,    current: agri    },
    { type: "mineral",     phase: 2, abundance: mineral, current: mineral },
    { type: "energy",      phase: 3, abundance: energy,  current: energy  },
  ];
}

export function generatePlots(rng: Rng = Math.random): readonly Plot[] {
  // 各資源の累積合計（0〜1スケール）を追跡し、generateDeposits に渡す
  const acc: [number, number, number] = [0, 0, 0];

  const plots = PLOT_INDICES.map((): Plot => {
    const deposits = generateDeposits(acc, rng);
    acc[0] += deposits[0].abundance;
    acc[1] += deposits[1].abundance;
    acc[2] += deposits[2].abundance;
    return { deposits, facilityId: null };
  }).map((plot: Plot): Plot => {
    plot.deposits.forEach((deposit) => {
      deposit.abundance *= 1000; // 0-1スケールで生成しているので、埋蔵量としてちょうどいい水準に
      deposit.current = deposit.abundance;
    });
    return plot;
  });

  // Fisher-Yates シャッフル（累積補正の生成順バイアスを除去）
  for (let i = plots.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [plots[i], plots[j]] = [plots[j], plots[i]];
  }

  return plots;
}
