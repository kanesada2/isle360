import { describe, it, expect } from "vitest";
import {
  buildFacility,
  demolishFacility,
  tickFacilities,
  startResearch,
  getResearchCost,
  computeScore,
  BUILD_DURATION_MS,
  DEMOLISH_DURATION_MS,
  RESEARCH_DURATION_MS,
} from "../../src/domain/facility-actions";
import { FACILITY_CATALOG } from "../../src/domain/facility-catalog";
import { RESEARCH_CATALOG } from "../../src/domain/research-catalog";
import { getUnlockedPhases, getAvailableFacilityKeys } from "../../src/domain/research-unlock";
import type { Game, GameId, PlayerId, Plot, ResearchId } from "../../src/domain/types";

// ── ヘルパー ──────────────────────────────────────────────────

const NOW = 1_000_000;

const r = (s: string) => s as ResearchId;

function research(...pairs: [string, number][]): Map<ResearchId, number> {
  return new Map(pairs.map(([k, v]) => [r(k), v]));
}

function makeGame(
  funds = 10_000,
  completedResearch = new Map<ResearchId, number>(),
): Game {
  const plots: Plot[] = Array.from({ length: 9 }, () => ({
    deposits: [
      { type: "agriculture" as const, phase: 1 as const, abundance: 1000, current: 1000 },
      { type: "mineral" as const,     phase: 2 as const, abundance: 500,  current: 500  },
      { type: "energy" as const,      phase: 3 as const, abundance: 300,  current: 300  },
    ],
    facilityId: null,
  }));
  return {
    id: "g1" as GameId,
    player: { id: "p1" as PlayerId, funds, completedResearch },
    plots,
    facilities: new Map(),
    sessionDurationMs: 360_000,
    startedAt: NOW,
    status: "playing",
  };
}

// カタログエントリ
const AGRI_ENTRY     = FACILITY_CATALOG.find((e) => e.key === "extractor-agriculture")!;
const REFINERY_ENTRY = FACILITY_CATALOG.find((e) => e.key === "refinery")!;
const LAB_ENTRY      = FACILITY_CATALOG.find((e) => e.key === "laboratory")!;
const MONUMENT_ENTRY = FACILITY_CATALOG.find((e) => e.key === "monument")!;

const AGRI_RESEARCH  = RESEARCH_CATALOG.find((e) => e.key === "agri-efficiency")!;
const MINERAL_SURVEY = RESEARCH_CATALOG.find((e) => e.key === "mineral-survey")!;

// ── buildFacility ─────────────────────────────────────────────

describe("buildFacility", () => {
  it("建設コストが引かれ、施設が constructing 状態で plot にセットされる", () => {
    let game = makeGame(1000);
    game = buildFacility(game, 0, AGRI_ENTRY, NOW);

    expect(game.player.funds).toBe(1000 - AGRI_ENTRY.buildCost);
    const fac = [...game.facilities.values()][0];
    expect(fac.state).toBe("constructing");
    expect(fac.plotIndex).toBe(0);
    expect(game.plots[0].facilityId).toBe(fac.id);
  });

  it("BUILD_DURATION_MS 後のティックで Extractor が idle になり lastCycleAt がセットされる", () => {
    let game = makeGame();
    game = buildFacility(game, 0, AGRI_ENTRY, NOW);
    game = tickFacilities(game, NOW + BUILD_DURATION_MS);

    const fac = [...game.facilities.values()][0];
    expect(fac.state).toBe("idle");
    expect(fac.kind === "extractor" ? fac.lastCycleAt : null).toBe(NOW + BUILD_DURATION_MS);
  });

  it("建設時間未満のティックでは constructing のまま", () => {
    let game = makeGame();
    game = buildFacility(game, 0, AGRI_ENTRY, NOW);
    game = tickFacilities(game, NOW + BUILD_DURATION_MS - 1);

    expect([...game.facilities.values()][0].state).toBe("constructing");
  });
});

// ── demolishFacility ──────────────────────────────────────────

describe("demolishFacility", () => {
  it("破壊コストが引かれ施設が demolishing 状態になる", () => {
    let game = makeGame();
    game = buildFacility(game, 0, AGRI_ENTRY, NOW);
    game = tickFacilities(game, NOW + BUILD_DURATION_MS);
    const fundsBefore = game.player.funds;

    game = demolishFacility(game, 0, NOW + BUILD_DURATION_MS);

    expect(game.player.funds).toBe(fundsBefore - AGRI_ENTRY.demolishCost);
    expect([...game.facilities.values()][0].state).toBe("demolishing");
  });

  it("DEMOLISH_DURATION_MS 後のティックで施設が削除され plot が空になる", () => {
    let game = makeGame();
    game = buildFacility(game, 0, AGRI_ENTRY, NOW);
    game = tickFacilities(game, NOW + BUILD_DURATION_MS);
    const t = NOW + BUILD_DURATION_MS;
    game = demolishFacility(game, 0, t);
    game = tickFacilities(game, t + DEMOLISH_DURATION_MS);

    expect(game.facilities.size).toBe(0);
    expect(game.plots[0].facilityId).toBeNull();
  });
});

// ── Extractor 採掘 ────────────────────────────────────────────

describe("Extractor 採掘", () => {
  it("idle 後に5サイクル経過すると5単位採掘・農産フェーズ1分の資金が加算される", () => {
    let game = makeGame(1000);
    game = buildFacility(game, 0, AGRI_ENTRY, NOW);
    game = tickFacilities(game, NOW + BUILD_DURATION_MS);
    const fundsAfterBuild = game.player.funds;

    // 200ms × 5 = 5サイクル
    game = tickFacilities(game, NOW + BUILD_DURATION_MS + 200 * 5);

    expect(game.player.funds).toBe(fundsAfterBuild + 5); // 5cycles × phase1 × no_refinery
    expect(game.plots[0].deposits[0].current).toBe(995);
  });

  it("残量を超える採掘は残量で頭打ちになる", () => {
    let game = makeGame(1000);
    // 農産資源の残量を3に設定
    game = {
      ...game,
      plots: game.plots.map((p, i) =>
        i === 0
          ? { ...p, deposits: p.deposits.map((d) => (d.type === "agriculture" ? { ...d, current: 3 } : d)) }
          : p,
      ),
    };
    game = buildFacility(game, 0, AGRI_ENTRY, NOW);
    game = tickFacilities(game, NOW + BUILD_DURATION_MS);
    const fundsAfterBuild = game.player.funds;

    game = tickFacilities(game, NOW + BUILD_DURATION_MS + 200 * 10); // 10サイクル要求

    expect(game.player.funds).toBe(fundsAfterBuild + 3); // 残量3で頭打ち
    expect(game.plots[0].deposits[0].current).toBe(0);
  });

  it("残量が0の場合は採掘しない", () => {
    let game = makeGame(1000);
    game = {
      ...game,
      plots: game.plots.map((p, i) =>
        i === 0
          ? { ...p, deposits: p.deposits.map((d) => (d.type === "agriculture" ? { ...d, current: 0 } : d)) }
          : p,
      ),
    };
    game = buildFacility(game, 0, AGRI_ENTRY, NOW);
    game = tickFacilities(game, NOW + BUILD_DURATION_MS);
    const fundsAfterBuild = game.player.funds;

    game = tickFacilities(game, NOW + BUILD_DURATION_MS + 200 * 5);

    expect(game.player.funds).toBe(fundsAfterBuild);
  });

  it("agri-efficiency Lv1 で採掘量が1.2倍になる（5サイクル → 6単位分の資金）", () => {
    let game = makeGame(1000, research(["agri-efficiency", 1]));
    game = buildFacility(game, 0, AGRI_ENTRY, NOW);
    game = tickFacilities(game, NOW + BUILD_DURATION_MS);
    const fundsAfterBuild = game.player.funds;

    game = tickFacilities(game, NOW + BUILD_DURATION_MS + 200 * 5);

    // 5 × 1.2(研究) × phase1 = 6
    expect(game.player.funds).toBe(fundsAfterBuild + 6);
  });
});

// ── Refinery 精製倍率 ─────────────────────────────────────────

describe("Refinery 精製倍率", () => {
  it("稼働中の精製工場が採集所の収益を1.2倍にする", () => {
    let game = makeGame(2000);
    game = buildFacility(game, 0, AGRI_ENTRY,     NOW);
    game = buildFacility(game, 1, REFINERY_ENTRY,  NOW);
    game = tickFacilities(game, NOW + BUILD_DURATION_MS); // 両施設が idle に
    const fundsAfterBuild = game.player.funds;

    game = tickFacilities(game, NOW + BUILD_DURATION_MS + 200 * 5);

    // 5 × phase1 × 1.2(refinery) = 6
    expect(game.player.funds).toBe(fundsAfterBuild + 6);
  });

  it("refinery-efficiency Lv1 で精製倍率が 1.2 × 1.2 = 1.44 になる", () => {
    let game = makeGame(2000, research(["refinery-efficiency", 1]));
    game = buildFacility(game, 0, AGRI_ENTRY,    NOW);
    game = buildFacility(game, 1, REFINERY_ENTRY, NOW);
    game = tickFacilities(game, NOW + BUILD_DURATION_MS);
    const fundsAfterBuild = game.player.funds;

    game = tickFacilities(game, NOW + BUILD_DURATION_MS + 200 * 5);

    // 5 × phase1 × (1.2 × 1.2^1) = 7.2
    expect(game.player.funds).toBe(fundsAfterBuild + 7.2);
  });

  it("精製工場2基の倍率は加算ではなく乗算される（1.2 × 1.2 = 1.44）", () => {
    let game = makeGame(3000);
    game = buildFacility(game, 0, AGRI_ENTRY,    NOW);
    game = buildFacility(game, 1, REFINERY_ENTRY, NOW);
    game = buildFacility(game, 2, REFINERY_ENTRY, NOW);
    game = tickFacilities(game, NOW + BUILD_DURATION_MS);
    const fundsAfterBuild = game.player.funds;

    game = tickFacilities(game, NOW + BUILD_DURATION_MS + 200 * 5);

    // 5 × phase1 × 1.2 × 1.2 = 7.2
    expect(game.player.funds).toBe(fundsAfterBuild + 7.2);
  });

  it("建設中の精製工場は倍率に寄与しない", () => {
    let game = makeGame(2000);
    // 採集所だけ先に完成させ、精製工場はまだ建設中
    game = buildFacility(game, 0, AGRI_ENTRY, NOW);
    game = tickFacilities(game, NOW + BUILD_DURATION_MS);
    game = buildFacility(game, 1, REFINERY_ENTRY, NOW + BUILD_DURATION_MS); // 精製工場は後から建設開始
    const fundsAfterBuild = game.player.funds;

    // 精製工場の建設が終わる前に採掘
    game = tickFacilities(game, NOW + BUILD_DURATION_MS + 200 * 5);

    // 精製工場が constructing なので倍率なし: 5 × phase1 = 5
    expect(game.player.funds).toBe(fundsAfterBuild + 5);
  });
});

// ── 建築技術向上 ──────────────────────────────────────────────

describe("建築技術向上", () => {
  it("construction-efficiency Lv1 で建設時間が10%短縮される", () => {
    const game = makeGame(1000, research(["construction-efficiency", 1]));
    const g = buildFacility(game, 0, AGRI_ENTRY, NOW);
    const fac = [...g.facilities.values()][0];

    // 20000ms × 0.9 = 18000ms
    expect(fac.currentJob?.durationMs).toBe(Math.round(BUILD_DURATION_MS * 0.9));
  });

  it("短縮後の時刻でティックすると建設が完了する", () => {
    let game = makeGame(1000, research(["construction-efficiency", 1]));
    game = buildFacility(game, 0, AGRI_ENTRY, NOW);
    game = tickFacilities(game, NOW + Math.round(BUILD_DURATION_MS * 0.9));

    expect([...game.facilities.values()][0].state).toBe("idle");
  });
});

// ── startResearch / 研究完了 ──────────────────────────────────

describe("startResearch / 研究完了", () => {
  function setupIdleLab(funds = 5000) {
    let game = makeGame(funds);
    game = buildFacility(game, 0, LAB_ENTRY, NOW);
    game = tickFacilities(game, NOW + BUILD_DURATION_MS);
    const labId = game.plots[0].facilityId!;
    return { game, labId, researchStart: NOW + BUILD_DURATION_MS };
  }

  it("研究コストが引かれ Laboratory が processing 状態になる", () => {
    const { game: g0, labId, researchStart } = setupIdleLab();
    const fundsBefore = g0.player.funds;

    const game = startResearch(g0, labId, AGRI_RESEARCH, researchStart);

    expect(game.player.funds).toBe(fundsBefore - AGRI_RESEARCH.baseCost);
    const lab = game.facilities.get(labId)!;
    expect(lab.state).toBe("processing");
    expect(lab.kind === "laboratory" ? lab.activeResearchId : null).toBe(r("agri-efficiency"));
  });

  it("資金不足の場合は研究を開始しない", () => {
    // LAB_ENTRY.buildCost = 500 → 残り0
    const { game: g0, labId, researchStart } = setupIdleLab(500);

    const game = startResearch(g0, labId, AGRI_RESEARCH, researchStart); // 100G 必要

    expect(game.player.funds).toBe(0); // 変化なし
    expect(game.facilities.get(labId)!.state).toBe("idle");
  });

  it("RESEARCH_DURATION_MS 後のティックで研究レベルが1上がる", () => {
    const { game: g0, labId, researchStart } = setupIdleLab();
    let game = startResearch(g0, labId, AGRI_RESEARCH, researchStart);
    game = tickFacilities(game, researchStart + RESEARCH_DURATION_MS);

    expect(game.player.completedResearch.get(r("agri-efficiency"))).toBe(1);
    expect(game.facilities.get(labId)!.state).toBe("idle");
  });

  it("同じ研究を繰り返すとレベルが累積される", () => {
    const { game: g0, labId, researchStart } = setupIdleLab(10_000);
    let game = startResearch(g0, labId, AGRI_RESEARCH, researchStart);
    game = tickFacilities(game, researchStart + RESEARCH_DURATION_MS);
    game = startResearch(game, labId, AGRI_RESEARCH, researchStart + RESEARCH_DURATION_MS);
    game = tickFacilities(game, researchStart + RESEARCH_DURATION_MS * 2);

    expect(game.player.completedResearch.get(r("agri-efficiency"))).toBe(2);
  });
});

// ── getResearchCost ───────────────────────────────────────────

describe("getResearchCost", () => {
  it("繰り返し研究のコストはレベルごとに1.5倍になる", () => {
    const cr = new Map<ResearchId, number>();
    expect(getResearchCost(AGRI_RESEARCH, cr)).toBe(100); // 100 × 1.5^0
    cr.set(r("agri-efficiency"), 1);
    expect(getResearchCost(AGRI_RESEARCH, cr)).toBe(150); // 100 × 1.5^1
    cr.set(r("agri-efficiency"), 2);
    expect(getResearchCost(AGRI_RESEARCH, cr)).toBe(225); // 100 × 1.5^2
  });

  it("非繰り返し研究はレベルに関わらず baseCost のまま", () => {
    const cr = new Map<ResearchId, number>();
    expect(getResearchCost(MINERAL_SURVEY, cr)).toBe(200);
    cr.set(r("mineral-survey"), 1);
    expect(getResearchCost(MINERAL_SURVEY, cr)).toBe(200);
  });
});

// ── getUnlockedPhases ─────────────────────────────────────────

describe("getUnlockedPhases", () => {
  it("研究なしでは Phase 1 のみ開放", () => {
    expect(getUnlockedPhases(new Map())).toEqual(new Set([1]));
  });

  it("mineral-survey 完了で Phase 2 が追加される", () => {
    expect(getUnlockedPhases(research(["mineral-survey", 1]))).toEqual(new Set([1, 2]));
  });

  it("energy-survey 完了で Phase 3 が追加される", () => {
    expect(
      getUnlockedPhases(research(["mineral-survey", 1], ["energy-survey", 1])),
    ).toEqual(new Set([1, 2, 3]));
  });
});

// ── getAvailableFacilityKeys ──────────────────────────────────

describe("getAvailableFacilityKeys", () => {
  it("研究なしでは農場・精製工場・研究所・繁栄の象徴が建設可能", () => {
    const keys = getAvailableFacilityKeys(new Map());
    expect(keys.has("extractor-agriculture")).toBe(true);
    expect(keys.has("refinery")).toBe(true);
    expect(keys.has("laboratory")).toBe(true);
    expect(keys.has("monument")).toBe(true);
    expect(keys.has("extractor-mineral")).toBe(false);
    expect(keys.has("extractor-energy")).toBe(false);
  });

  it("mineral-survey 完了で鉱山が建設可能になる", () => {
    const keys = getAvailableFacilityKeys(research(["mineral-survey", 1]));
    expect(keys.has("extractor-mineral")).toBe(true);
  });

  it("energy-survey 完了でエネルギー生産場が建設可能になる", () => {
    const keys = getAvailableFacilityKeys(research(["energy-survey", 1]));
    expect(keys.has("extractor-energy")).toBe(true);
  });
});

// ── computeScore ─────────────────────────────────────────────

describe("computeScore", () => {
  it("採掘・研究・モニュメントがない場合はすべて0", () => {
    const score = computeScore(makeGame());
    expect(score.total).toBe(0);
    expect(score.resourcesMined).toBe(0);
    expect(score.researchSpent).toBe(0);
    expect(score.monumentBonus).toBe(0);
  });

  it("採掘量（abundance - current の合計）がスコアに反映される", () => {
    let game = makeGame();
    // plot[0] の農産を100単位採掘済みにする
    game = {
      ...game,
      plots: game.plots.map((p, i) =>
        i === 0
          ? { ...p, deposits: p.deposits.map((d) => (d.type === "agriculture" ? { ...d, current: 900 } : d)) }
          : p,
      ),
    };
    const score = computeScore(game);

    expect(score.resourcesMined).toBe(100);
    expect(score.resourcesByType.agriculture).toBe(100);
    expect(score.total).toBe(100);
  });

  it("複数資源の採掘量が resourcesByType に分類される", () => {
    let game = makeGame();
    game = {
      ...game,
      plots: game.plots.map((p, i) =>
        i === 0
          ? {
              ...p,
              deposits: p.deposits.map((d) => {
                if (d.type === "agriculture") return { ...d, current: 800 }; // 200採掘
                if (d.type === "mineral")     return { ...d, current: 400 }; // 100採掘
                return d;
              }),
            }
          : p,
      ),
    };
    const score = computeScore(game);

    expect(score.resourcesByType.agriculture).toBe(200);
    expect(score.resourcesByType.mineral).toBe(100);
    expect(score.resourcesByType.energy).toBe(0);
    expect(score.resourcesMined).toBe(300);
  });

  it("研究消費額がスコアに加算される（agri-efficiency Lv2: 100 + 150 = 250）", () => {
    const game = makeGame(1000, research(["agri-efficiency", 2]));
    const score = computeScore(game);

    expect(score.researchSpent).toBe(100 + 150);
    expect(score.total).toBe(250);
  });

  it("完成済みモニュメント1基で +5000", () => {
    let game = makeGame(10_000);
    game = buildFacility(game, 0, MONUMENT_ENTRY, NOW);
    game = tickFacilities(game, NOW + BUILD_DURATION_MS);
    const score = computeScore(game);

    expect(score.monumentCount).toBe(1);
    expect(score.monumentBonus).toBe(5000);
    expect(score.total).toBe(5000);
  });

  it("建設中のモニュメントはスコアに含まれない", () => {
    let game = makeGame(10_000);
    game = buildFacility(game, 0, MONUMENT_ENTRY, NOW);
    // 建設完了前
    const score = computeScore(game);

    expect(score.monumentCount).toBe(0);
    expect(score.monumentBonus).toBe(0);
  });

  it("total は floor(resourcesMined) + researchSpent + monumentBonus", () => {
    let game = makeGame(10_000, research(["agri-efficiency", 1]));
    // 採掘: 農産50.7単位
    game = {
      ...game,
      plots: game.plots.map((p, i) =>
        i === 0
          ? { ...p, deposits: p.deposits.map((d) => (d.type === "agriculture" ? { ...d, current: 949.3 } : d)) }
          : p,
      ),
    };
    game = buildFacility(game, 0, MONUMENT_ENTRY, NOW);
    game = tickFacilities(game, NOW + BUILD_DURATION_MS);
    const score = computeScore(game);

    // floor(50.7) + 100 + 5000 = 50 + 100 + 5000 = 5150
    expect(score.total).toBe(5150);
  });
});
