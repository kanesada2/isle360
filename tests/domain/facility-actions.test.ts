import { describe, it, expect } from "vitest";
import {
  buildFacility,
  demolishFacility,
  tickFacilities,
  startResearch,
  getResearchCost,
  computeScore,
  computeFundsPerSecond,
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
      { type: "agriculture" as const, phase: 1 as const, abundance: 1000, current: 1000, totalMined: 0 },
      { type: "mineral" as const,     phase: 2 as const, abundance: 500,  current: 500,  totalMined: 0 },
      { type: "energy" as const,      phase: 3 as const, abundance: 300,  current: 300,  totalMined: 0 },
    ],
    facilityId: null,
  }));
  return {
    id: "g1" as GameId,
    player: { id: "p1" as PlayerId, funds, completedResearch, activeResearchIds: new Set() },
    plots,
    facilities: new Map(),
    sessionDurationMs: 360_000,
    startedAt: NOW,
    status: "playing",
    logs: [],
  };
}

// カタログエントリ
const AGRI_ENTRY     = FACILITY_CATALOG.find((e) => e.key === "extractor-agriculture")!;
const REFINERY_ENTRY = FACILITY_CATALOG.find((e) => e.key === "refinery")!;
const LAB_ENTRY      = FACILITY_CATALOG.find((e) => e.key === "laboratory")!;
const MONUMENT_ENTRY = FACILITY_CATALOG.find((e) => e.key === "monument")!;

const AGRI_RESEARCH           = RESEARCH_CATALOG.find((e) => e.key === "agri-efficiency")!;
const MINERAL_SURVEY          = RESEARCH_CATALOG.find((e) => e.key === "mineral-survey")!;
const SUSTAINABLE_FARMING     = RESEARCH_CATALOG.find((e) => e.key === "sustainable-farming")!;
const ALTERNATIVE_BUILDING    = RESEARCH_CATALOG.find((e) => e.key === "alternative-building")!;
const ALTERNATIVITY_EFFICIENCY = RESEARCH_CATALOG.find((e) => e.key === "alternativity-efficiency")!;

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

// ── 再生栽培 ──────────────────────────────────────────────────

describe("再生栽培", () => {
  function setupIdleLab(funds = 5000) {
    let game = makeGame(funds);
    game = buildFacility(game, 0, LAB_ENTRY, NOW);
    game = tickFacilities(game, NOW + BUILD_DURATION_MS);
    const labId = game.plots[0].facilityId!;
    return { game, labId, researchStart: NOW + BUILD_DURATION_MS };
  }

  it("researchDurationMs が 60_000ms である", () => {
    expect(SUSTAINABLE_FARMING.researchDurationMs).toBe(60_000);
  });

  it("special フラグが true である", () => {
    expect(SUSTAINABLE_FARMING.special).toBe(true);
  });

  it("研究開始時のジョブ時間が researchDurationMs（60_000ms）になる", () => {
    const { game: g0, labId, researchStart } = setupIdleLab(10_000);
    const game = startResearch(g0, labId, SUSTAINABLE_FARMING, researchStart);
    const lab = game.facilities.get(labId)!;
    expect(lab.currentJob?.durationMs).toBe(60_000);
  });

  it("15_000ms 後のティックでは研究が完了しない（通常の RESEARCH_DURATION_MS より長い）", () => {
    const { game: g0, labId, researchStart } = setupIdleLab(10_000);
    let game = startResearch(g0, labId, SUSTAINABLE_FARMING, researchStart);
    game = tickFacilities(game, researchStart + RESEARCH_DURATION_MS); // 15秒

    expect(game.player.completedResearch.get(r("sustainable-farming"))).toBeUndefined();
    expect(game.facilities.get(labId)!.state).toBe("processing");
  });

  it("60_000ms 後のティックで研究が完了し completedResearch に登録される", () => {
    const { game: g0, labId, researchStart } = setupIdleLab(10_000);
    let game = startResearch(g0, labId, SUSTAINABLE_FARMING, researchStart);
    game = tickFacilities(game, researchStart + 60_000);

    expect(game.player.completedResearch.get(r("sustainable-farming"))).toBe(1);
    expect(game.facilities.get(labId)!.state).toBe("idle");
  });

  it("研究完了後、農産資源が abundance × 0.005 / 秒 のペースで再生する", () => {
    // 農産資源を0まで枯渇させてから sustainable-farming を適用
    let game = makeGame(10_000, research(["sustainable-farming", 1]));
    game = {
      ...game,
      plots: game.plots.map((p, i) =>
        i === 0
          ? { ...p, deposits: p.deposits.map((d) => (d.type === "agriculture" ? { ...d, current: 0 } : d)) }
          : p,
      ),
    };

    // 1回目のティックで lastRegenAt が初期化される
    game = tickFacilities(game, NOW);
    // 1秒後のティック
    game = tickFacilities(game, NOW + 1_000);

    // abundance=1000, rate=0.005/s, 1s → +5
    expect(game.plots[0].deposits[0].current).toBeCloseTo(5, 1);
  });

  it("再生量は abundance を上限とする（上限を超えない）", () => {
    let game = makeGame(10_000, research(["sustainable-farming", 1]));
    // 農産資源がほぼ満タン（abundance=1000, current=999）
    game = {
      ...game,
      plots: game.plots.map((p, i) =>
        i === 0
          ? { ...p, deposits: p.deposits.map((d) => (d.type === "agriculture" ? { ...d, current: 999 } : d)) }
          : p,
      ),
    };

    game = tickFacilities(game, NOW);             // lastRegenAt 初期化
    game = tickFacilities(game, NOW + 10_000);    // 10秒後 → +50 になるが上限で1000

    expect(game.plots[0].deposits[0].current).toBe(1000);
  });

  it("再生研究なしでは農産資源は再生しない", () => {
    let game = makeGame(10_000);
    game = {
      ...game,
      plots: game.plots.map((p, i) =>
        i === 0
          ? { ...p, deposits: p.deposits.map((d) => (d.type === "agriculture" ? { ...d, current: 0 } : d)) }
          : p,
      ),
    };

    game = tickFacilities(game, NOW);
    game = tickFacilities(game, NOW + 10_000);

    expect(game.plots[0].deposits[0].current).toBe(0);
  });

  it("農産以外の資源（mineral/energy）は再生しない", () => {
    let game = makeGame(10_000, research(["sustainable-farming", 1]));
    game = {
      ...game,
      plots: game.plots.map((p, i) =>
        i === 0
          ? {
              ...p,
              deposits: p.deposits.map((d) => {
                if (d.type === "mineral") return { ...d, current: 0 };
                if (d.type === "energy")  return { ...d, current: 0 };
                return d;
              }),
            }
          : p,
      ),
    };

    game = tickFacilities(game, NOW);
    game = tickFacilities(game, NOW + 10_000);

    const mineral = game.plots[0].deposits.find((d) => d.type === "mineral")!;
    const energy  = game.plots[0].deposits.find((d) => d.type === "energy")!;
    expect(mineral.current).toBe(0);
    expect(energy.current).toBe(0);
  });

  it("再生ペースは abundance に比例する（abundance=500 なら +2.5/秒）", () => {
    let game = makeGame(10_000, research(["sustainable-farming", 1]));
    game = {
      ...game,
      plots: game.plots.map((p, i) =>
        i === 0
          ? { ...p, deposits: p.deposits.map((d) => (d.type === "agriculture" ? { ...d, abundance: 500, current: 0 } : d)) }
          : p,
      ),
    };

    game = tickFacilities(game, NOW);
    game = tickFacilities(game, NOW + 1_000);

    // 500 × 0.005 × 1 = 2.5
    expect(game.plots[0].deposits[0].current).toBeCloseTo(2.5, 1);
  });
});

// ── 再生効率向上 ──────────────────────────────────────────────

describe("再生効率向上", () => {
  const REGEN_RESEARCH = RESEARCH_CATALOG.find((e) => e.key === "regen-efficiency")!;

  it("前提研究が sustainable-farming である", () => {
    expect(REGEN_RESEARCH.prerequisites).toContain("sustainable-farming");
  });

  it("baseCost が 200 である", () => {
    expect(REGEN_RESEARCH.baseCost).toBe(200);
  });

  it("繰り返し研究である", () => {
    expect(REGEN_RESEARCH.repeatable).toBe(true);
  });

  it("regen-efficiency Lv1 で再生速度が 1.2 倍になる", () => {
    let game = makeGame(10_000, research(["sustainable-farming", 1], ["regen-efficiency", 1]));
    game = {
      ...game,
      plots: game.plots.map((p, i) =>
        i === 0
          ? { ...p, deposits: p.deposits.map((d) => (d.type === "agriculture" ? { ...d, current: 0 } : d)) }
          : p,
      ),
    };

    game = tickFacilities(game, NOW);
    game = tickFacilities(game, NOW + 1_000);

    // 1000 × 0.005 × 1.2^1 × 1s = 6
    expect(game.plots[0].deposits[0].current).toBeCloseTo(6, 1);
  });

  it("regen-efficiency Lv2 で再生速度が 1.44 倍になる", () => {
    let game = makeGame(10_000, research(["sustainable-farming", 1], ["regen-efficiency", 2]));
    game = {
      ...game,
      plots: game.plots.map((p, i) =>
        i === 0
          ? { ...p, deposits: p.deposits.map((d) => (d.type === "agriculture" ? { ...d, current: 0 } : d)) }
          : p,
      ),
    };

    game = tickFacilities(game, NOW);
    game = tickFacilities(game, NOW + 1_000);

    // 1000 × 0.005 × 1.2^2 × 1s = 7.2
    expect(game.plots[0].deposits[0].current).toBeCloseTo(7.2, 1);
  });

  it("sustainable-farming なしでは regen-efficiency があっても再生しない", () => {
    let game = makeGame(10_000, research(["regen-efficiency", 1]));
    game = {
      ...game,
      plots: game.plots.map((p, i) =>
        i === 0
          ? { ...p, deposits: p.deposits.map((d) => (d.type === "agriculture" ? { ...d, current: 0 } : d)) }
          : p,
      ),
    };

    game = tickFacilities(game, NOW);
    game = tickFacilities(game, NOW + 1_000);

    expect(game.plots[0].deposits[0].current).toBe(0);
  });

  it("コストはレベルに応じて 1.5 倍ずつ増加する（Lv0: 200, Lv1: 300, Lv2: 450）", () => {
    const cr = new Map<ResearchId, number>();
    expect(getResearchCost(REGEN_RESEARCH, cr)).toBe(200);
    cr.set(r("regen-efficiency"), 1);
    expect(getResearchCost(REGEN_RESEARCH, cr)).toBe(300);
    cr.set(r("regen-efficiency"), 2);
    expect(getResearchCost(REGEN_RESEARCH, cr)).toBe(450);
  });
});

// ── 鉱物活用建築 ──────────────────────────────────────────────

describe("鉱物活用建築", () => {
  /** mineral abundance=500 の plot を持つゲームを生成するヘルパー */
  function makeGameWithMineral(mineralAbundance: number, funds = 10_000, completedResearch = new Map<ResearchId, number>()): Game {
    const plots: Plot[] = Array.from({ length: 9 }, (_, i) => ({
      deposits: [
        { type: "agriculture" as const, phase: 1 as const, abundance: 1000, current: 1000, totalMined: 0 },
        { type: "mineral" as const,     phase: 2 as const, abundance: i === 0 ? mineralAbundance : 500, current: i === 0 ? mineralAbundance : 500, totalMined: 0 },
        { type: "energy" as const,      phase: 3 as const, abundance: 300,  current: 300,  totalMined: 0 },
      ],
      facilityId: null,
    }));
    return {
      id: "g1" as GameId,
      player: { id: "p1" as PlayerId, funds, completedResearch, activeResearchIds: new Set() },
      plots,
      facilities: new Map(),
      sessionDurationMs: 360_000,
      startedAt: NOW,
      status: "playing",
      logs: [],
    };
  }

  it("前提研究が alternative-building である（alternativity-efficiency）", () => {
    expect(ALTERNATIVITY_EFFICIENCY.prerequisites).toContain("alternative-building");
  });

  it("special フラグが true である（alternative-building）", () => {
    expect(ALTERNATIVE_BUILDING.special).toBe(true);
  });

  it("research なしでは割引なし（通常コストが引かれる）", () => {
    const game = makeGameWithMineral(1000);
    const g = buildFacility(game, 0, AGRI_ENTRY, NOW);
    expect(g.player.funds).toBe(10_000 - AGRI_ENTRY.buildCost);
  });

  it("alternative-building Lv1 で mineral_abundance × 0.0002 の割引が適用される", () => {
    // mineral abundance=1000 → 割引率 = 1000 × 0.0002 = 0.2 (20%)
    const game = makeGameWithMineral(1000, 10_000, research(["alternative-building", 1]));
    const g = buildFacility(game, 0, AGRI_ENTRY, NOW);
    const expectedCost = Math.round(AGRI_ENTRY.buildCost * (1 - 0.2));
    expect(g.player.funds).toBe(10_000 - expectedCost);
  });

  it("mineral abundance が低いほど割引率が小さい", () => {
    // abundance=200 → 割引率 = 200 × 0.0002 = 0.04 (4%)
    const game = makeGameWithMineral(200, 10_000, research(["alternative-building", 1]));
    const g = buildFacility(game, 0, AGRI_ENTRY, NOW);
    const expectedCost = Math.round(AGRI_ENTRY.buildCost * (1 - 0.04));
    expect(g.player.funds).toBe(10_000 - expectedCost);
  });

  it("alternativity-efficiency Lv1 で割引率が 1.2 倍になる", () => {
    // abundance=1000, effLv=1 → 割引率 = 1000 × 0.0002 × 1.2 = 0.24 (24%)
    const game = makeGameWithMineral(1000, 10_000, research(["alternative-building", 1], ["alternativity-efficiency", 1]));
    const g = buildFacility(game, 0, AGRI_ENTRY, NOW);
    const expectedCost = Math.round(AGRI_ENTRY.buildCost * (1 - 0.24));
    expect(g.player.funds).toBe(10_000 - expectedCost);
  });

  it("alternativity-efficiency Lv2 で割引率が 1.44 倍になる", () => {
    // abundance=1000, effLv=2 → 割引率 = 1000 × 0.0002 × 1.44 = 0.288 (28.8%)
    const game = makeGameWithMineral(1000, 10_000, research(["alternative-building", 1], ["alternativity-efficiency", 2]));
    const g = buildFacility(game, 0, AGRI_ENTRY, NOW);
    const rate = 1000 * 0.0002 * Math.pow(1.2, 2);
    const expectedCost = Math.round(AGRI_ENTRY.buildCost * (1 - rate));
    expect(g.player.funds).toBe(10_000 - expectedCost);
  });

  it("割引率は最大1.0（コストが0未満にならない）", () => {
    // abundance=5000 × 0.0002 = 1.0 → コスト0
    const game = makeGameWithMineral(5000, 10_000, research(["alternative-building", 1]));
    const g = buildFacility(game, 0, AGRI_ENTRY, NOW);
    expect(g.player.funds).toBe(10_000); // コスト0
  });

  it("alternativity-efficiency のコストは 1.5 倍ずつ増加する（Lv0: 200, Lv1: 300）", () => {
    const cr = new Map<ResearchId, number>();
    expect(getResearchCost(ALTERNATIVITY_EFFICIENCY, cr)).toBe(200);
    cr.set(r("alternativity-efficiency"), 1);
    expect(getResearchCost(ALTERNATIVITY_EFFICIENCY, cr)).toBe(300);
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

  it("totalMined の合計がスコアに反映される", () => {
    let game = makeGame();
    game = {
      ...game,
      plots: game.plots.map((p, i) =>
        i === 0
          ? { ...p, deposits: p.deposits.map((d) => (d.type === "agriculture" ? { ...d, current: 900, totalMined: 100 } : d)) }
          : p,
      ),
    };
    const score = computeScore(game);

    expect(score.resourcesMined).toBe(100);
    expect(score.resourcesByType.agriculture).toBe(100);
    expect(score.total).toBe(100);
  });

  it("複数資源の totalMined が resourcesByType に分類される", () => {
    let game = makeGame();
    game = {
      ...game,
      plots: game.plots.map((p, i) =>
        i === 0
          ? {
              ...p,
              deposits: p.deposits.map((d) => {
                if (d.type === "agriculture") return { ...d, current: 800, totalMined: 200 };
                if (d.type === "mineral")     return { ...d, current: 400, totalMined: 100 };
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

  it("再生後に再採掘した分も totalMined に加算されスコアに反映される", () => {
    // abundance=100 の資源を全採掘 → 再生で50回復 → さらに50採掘
    // totalMined=150, current=50 になるケース
    let game = makeGame();
    game = {
      ...game,
      plots: game.plots.map((p, i) =>
        i === 0
          ? { ...p, deposits: p.deposits.map((d) => (d.type === "agriculture" ? { ...d, abundance: 100, current: 50, totalMined: 150 } : d)) }
          : p,
      ),
    };
    const score = computeScore(game);

    // abundance - current = 50 だが totalMined = 150 が正確な採掘量
    expect(score.resourcesByType.agriculture).toBe(150);
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
          ? { ...p, deposits: p.deposits.map((d) => (d.type === "agriculture" ? { ...d, current: 949.3, totalMined: 50.7 } : d)) }
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

// ── ゲームログ ────────────────────────────────────────────────

describe("ゲームログ", () => {
  it("初期状態ではログが空", () => {
    expect(makeGame().logs).toHaveLength(0);
  });

  it("建設完了時に construction-complete ログが追加される", () => {
    let game = makeGame();
    game = buildFacility(game, 0, AGRI_ENTRY, NOW);
    game = tickFacilities(game, NOW + BUILD_DURATION_MS);

    expect(game.logs).toHaveLength(1);
    expect(game.logs[0].kind).toBe("construction-complete");
    expect(game.logs[0].facilityKind).toBe("extractor");
  });

  it("demolishFacility 呼び出し時に demolish-start ログが追加される", () => {
    let game = makeGame();
    game = buildFacility(game, 0, AGRI_ENTRY, NOW);
    game = tickFacilities(game, NOW + BUILD_DURATION_MS);
    game = demolishFacility(game, 0, NOW + BUILD_DURATION_MS);

    expect(game.logs).toHaveLength(2); // construction-complete + demolish-start
    expect(game.logs[1].kind).toBe("demolish-start");
    expect(game.logs[1].facilityKind).toBe("extractor");
  });

  it("研究完了時に research-complete ログが追加される", () => {
    let game = makeGame(5000);
    game = buildFacility(game, 0, LAB_ENTRY, NOW);
    game = tickFacilities(game, NOW + BUILD_DURATION_MS);
    const labId = game.plots[0].facilityId!;
    game = startResearch(game, labId, AGRI_RESEARCH, NOW + BUILD_DURATION_MS);
    const logsBefore = game.logs.length;
    game = tickFacilities(game, NOW + BUILD_DURATION_MS + RESEARCH_DURATION_MS);

    const researchLog = game.logs.find((l) => l.kind === "research-complete");
    expect(researchLog).toBeDefined();
    expect(researchLog!.researchKey).toBe("agri-efficiency");
    expect(game.logs.length).toBe(logsBefore + 1);
  });

  it("各ログエントリに elapsedMs / score / fundsPerSecond が記録される", () => {
    let game = makeGame(5000);
    game = buildFacility(game, 0, AGRI_ENTRY, NOW);
    game = tickFacilities(game, NOW + BUILD_DURATION_MS);

    const log = game.logs[0];
    expect(log.elapsedMs).toBe(BUILD_DURATION_MS);
    expect(typeof log.score).toBe("number");
    expect(typeof log.fundsPerSecond).toBe("number");
  });

  it("稼働中の Extractor がある場合 fundsPerSecond > 0 が記録される", () => {
    let game = makeGame(5000);
    game = buildFacility(game, 0, AGRI_ENTRY, NOW);
    game = tickFacilities(game, NOW + BUILD_DURATION_MS);
    game = buildFacility(game, 1, LAB_ENTRY, NOW + BUILD_DURATION_MS);
    game = tickFacilities(game, NOW + BUILD_DURATION_MS * 2);

    const labLog = game.logs.find(
      (l) => l.kind === "construction-complete" && l.facilityKind === "laboratory",
    )!;
    expect(labLog.fundsPerSecond).toBeGreaterThan(0);
  });

  it("computeFundsPerSecond: 稼働中 Extractor なしなら 0", () => {
    expect(computeFundsPerSecond(makeGame())).toBe(0);
  });

  it("computeFundsPerSecond: idle の農場1基（phase1, no refinery）は 5 G/s", () => {
    let game = makeGame();
    game = buildFacility(game, 0, AGRI_ENTRY, NOW);
    game = tickFacilities(game, NOW + BUILD_DURATION_MS);
    // 1 unit/cycle × 1000ms/s ÷ 200ms/cycle × phase1 = 5
    expect(computeFundsPerSecond(game)).toBe(5);
  });
});
