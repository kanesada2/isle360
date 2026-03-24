import { describe, it, expect } from "vitest";
import { generatePlots } from "../../src/domain/plot";
import { createRng } from "../../src/domain/rng";

const RUNS = 1000;

// plot.ts の定数と合わせる
const BASE_TOTAL = 1500;   // BASE_TOTAL_ABUNDANCE * 1000
const VARIANCE = 150;       // ABUNDANCE_VARIANCE * 1000
const PLOT_COUNT = 9;
const EXPECTED_PER_RESOURCE = (BASE_TOTAL / 3) * PLOT_COUNT; // 4500

describe("generatePlots", () => {
  it("9マスが返り、各マスに agriculture/mineral/energy の3資源が揃っている", () => {
    const plots = generatePlots();
    expect(plots).toHaveLength(PLOT_COUNT);

    for (const plot of plots) {
      expect(plot.deposits).toHaveLength(3);
      expect(plot.deposits[0].type).toBe("agriculture");
      expect(plot.deposits[0].phase).toBe(1);
      expect(plot.deposits[1].type).toBe("mineral");
      expect(plot.deposits[1].phase).toBe(2);
      expect(plot.deposits[2].type).toBe("energy");
      expect(plot.deposits[2].phase).toBe(3);
    }
  });

  it("abundance が 0〜1000 の範囲内、current === abundance", () => {
    for (let r = 0; r < RUNS; r++) {
      const plots = generatePlots();
      for (const plot of plots) {
        for (const d of plot.deposits) {
          expect(d.abundance).toBeGreaterThanOrEqual(0);
          expect(d.abundance).toBeLessThanOrEqual(1000);
          expect(d.current).toBe(d.abundance);
        }
      }
    }
  });

  it("マスごとの合計資源量が BASE_TOTAL ± VARIANCE の範囲内（丸め・クランプ誤差を許容）", () => {
    // 上限は total の計算通り厳密に守られる
    // 下限は1資源に集中してクランプ(max 1000)が発生すると下振れするため緩め
    const MIN = BASE_TOTAL / 2; // ~750：クランプ最悪ケースを許容
    const MAX = BASE_TOTAL + VARIANCE + 20; // 1670（round2 の丸め上振れ ±0.005×3成分を許容）

    for (let r = 0; r < RUNS; r++) {
      const plots = generatePlots();
      for (const plot of plots) {
        const plotTotal = plot.deposits.reduce((s, d) => s + d.abundance, 0);
        expect(plotTotal).toBeGreaterThanOrEqual(MIN);
        expect(plotTotal).toBeLessThanOrEqual(MAX);
      }
    }
  });

  it("1ゲーム内で資源バランスが極端に偏らない（最大/最小 < 3）", () => {
    for (let r = 0; r < RUNS; r++) {
      const plots = generatePlots();
      const totals = [0, 0, 0];
      for (const plot of plots) {
        totals[0] += plot.deposits[0].abundance;
        totals[1] += plot.deposits[1].abundance;
        totals[2] += plot.deposits[2].abundance;
      }
      const max = Math.max(...totals);
      const min = Math.min(...totals);
      // min が 0 になることはないはずだが念のためガード
      if (min > 0) {
        expect(max / min).toBeLessThan(3);
      }
    }
  });

  it("同じシードで生成した結果が完全に一致する", () => {
    const plots1 = generatePlots(createRng(42));
    const plots2 = generatePlots(createRng(42));
    expect(plots1).toEqual(plots2);
  });

  it("異なるシードで生成した結果は異なる", () => {
    const plots1 = generatePlots(createRng(1));
    const plots2 = generatePlots(createRng(2));
    expect(plots1).not.toEqual(plots2);
  });

  it("1000回の平均で各資源の合計量が期待値（4500）の ±20% 以内かつ互いに均等", () => {
    const totals = [0, 0, 0];

    for (let r = 0; r < RUNS; r++) {
      const plots = generatePlots();
      totals[0] += plots.reduce((s, p) => s + p.deposits[0].abundance, 0);
      totals[1] += plots.reduce((s, p) => s + p.deposits[1].abundance, 0);
      totals[2] += plots.reduce((s, p) => s + p.deposits[2].abundance, 0);
    }

    const means = totals.map((t) => t / RUNS);
    const grandMean = means.reduce((s, m) => s + m, 0) / 3;

    // 各資源の平均が期待値の ±20% 以内
    for (const mean of means) {
      expect(mean).toBeGreaterThan(EXPECTED_PER_RESOURCE * 0.8);
      expect(mean).toBeLessThan(EXPECTED_PER_RESOURCE * 1.2);
    }

    // 3資源の平均が互いに ±20% 以内（バランス効果の確認）
    for (const mean of means) {
      expect(Math.abs(mean - grandMean)).toBeLessThan(grandMean * 0.2);
    }
  });
});
