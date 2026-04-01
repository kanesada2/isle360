import { describe, expect, it } from 'vitest';
import { runAgent } from '../../src/agent/index';
import type { ScoreBreakdown } from '../../src/domain/facility-actions';
import { computeScore, startGame } from '../../src/domain/facility-actions';
import { createGame } from '../../src/domain/game';
import { encodeLogs } from '../../src/domain/log-codec';
import type { Game } from '../../src/domain/types';

const SESSION_MS = 360_000;
const INITIAL_FUNDS = 1_000;

// ── テスト ───────────────────────────────────────────────────────

describe('agent', () => {
  it('ランダムなシードで一定スコア以上を達成し、内訳をログ出力する', () => {
    const seed = Math.floor(Math.random() * 100000);

    let game = createGame({ sessionDurationMs: SESSION_MS, initialFunds: INITIAL_FUNDS, mapSeed: seed });
    game = startGame(game, 0);
    game = runAgent(game);

    const scoreDetail = computeScore(game);
    printRunResult(seed, game, scoreDetail);

    expect(scoreDetail.total).toBeGreaterThan(10_000);
  });
});

// ── 出力ヘルパー ─────────────────────────────────────────────────

function printRunResult(seed: number, game: Game, score: ScoreBreakdown): void {
  console.log(`\n=== Agent Run: seed=${seed} ===`);
  console.log("Plots:");
  console.log(`${game.plots[0].deposits[0].abundance} ${game.plots[1].deposits[0].abundance} ${game.plots[2].deposits[0].abundance}`)
  console.log(`${game.plots[3].deposits[0].abundance} ${game.plots[4].deposits[0].abundance} ${game.plots[5].deposits[0].abundance}`)
  console.log(`${game.plots[6].deposits[0].abundance} ${game.plots[7].deposits[0].abundance} ${game.plots[8].deposits[0].abundance}`)
  console.log(`Score: ${score.total}`);
  console.log(`  - totalMined:     ${score.resourcesMined}`);
  console.log(`  - researchSpent:  ${score.researchSpent}`);
  console.log(`  - monumentBonus:  ${score.monumentBonus} (${score.monumentCount} monuments)`);
  console.log(`FundsRemain: ${game.player.funds}`)

  const token = encodeLogs(game.logs);
  console.log(`\nReplay token: ${token}`);

  console.log('\nTimeline:');
  const relevantKinds = new Set([
    'game-start',
    'construction-start',
    'demolish-start',
    'research-complete',
  ]);
  for (const log of game.logs) {
    if (!relevantKinds.has(log.kind)) continue;
    const label = formatLogLabel(log.kind, log.facilityKind, log.facilityKey, log.researchKey);
    const plot  = log.plotIndex !== undefined ? ` @ plot ${log.plotIndex}` : '';
    console.log(`  t=${String(log.elapsedMs).padStart(7)}ms  ${label}${plot}  [score: ${log.score}]`);
  }
}

function formatLogLabel(
  kind: string,
  facilityKind?: string,
  facilityKey?: string,
  researchKey?: string,
): string {
  switch (kind) {
    case 'game-start':            return 'GAME START';
    case 'construction-start': return `BUILDING ${facilityKey ?? facilityKind ?? '?'}`;
    case 'demolish-start':     return `DEMOLISHING ${facilityKind ?? '?'}`;
    case 'research-complete':     return `RESEARCH DONE: ${researchKey ?? '?'}`;
    default:                      return kind;
  }
}
