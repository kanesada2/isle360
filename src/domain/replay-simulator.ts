import { applyReplayEvent, computeScore, ScoreBreakdown, startGame, tickFacilities } from './facility-actions';
import { createGame } from './game';
import { decodeLogs } from './log-codec';
import type { Game, GameLogEntry } from './types';

const SESSION_DURATION_MS = 360_000;
const INITIAL_FUNDS = 1_000;

/**
 * 1フレームあたりの仮想時間刻み幅（ms）。
 * game-screen.tsx の SUBTICK_MS と同値にすることで、
 * UI リプレイと同一の計算結果を保証する。
 */
const SUBTICK_MS = 16;

/**
 * デコード済みログからゲーム進行をシミュレートし、終了状態の Game を返す。
 * React / UI に依存しない純粋な同期処理。
 */
export function simulateReplay(logs: GameLogEntry[]): Game {
  const mapSeed = logs.find((e) => e.kind === 'game-start')?.mapSeed;

  // 仮想時刻の基点を 0 に固定してゲームを初期化・開始
  const startedAt = 0;
  let game = startGame(
    createGame({ sessionDurationMs: SESSION_DURATION_MS, initialFunds: INITIAL_FUNDS, mapSeed }),
    startedAt,
  );

  // construction-start / demolish-start / research-start のみ再適用対象
  const dispatchableEvents = logs.filter(
    (e) =>
      e.kind === 'construction-start' ||
      e.kind === 'demolish-start' ||
      e.kind === 'research-start',
  );

  let eventIndex = 0;

  // SUBTICK_MS 刻みで SESSION_DURATION_MS まで tick を回す
  for (let virtualMs = SUBTICK_MS; virtualMs <= SESSION_DURATION_MS; virtualMs += SUBTICK_MS) {
    const virtualNow = startedAt + virtualMs;
    game = tickFacilities(game, virtualNow);

    // この tick 時点までに発生すべきイベントをまとめて適用
    while (
      eventIndex < dispatchableEvents.length &&
      dispatchableEvents[eventIndex].elapsedMs <= virtualMs
    ) {
      game = applyReplayEvent(game, dispatchableEvents[eventIndex], virtualNow);
      eventIndex++;
    }
  }

  return { ...game, status: 'finished' };
}

/**
 * ログエントリからスコアを計算する。
 * simulateReplay のシンプルなラッパー。
 */
export function scoreFromLogs(logs: GameLogEntry[]): ScoreBreakdown {
  const finalGame = simulateReplay(logs);
  return computeScore(finalGame);
}

/**
 * エンコード済みリプレイトークンからスコアを計算する。
 */
export function scoreFromToken(token: string): ScoreBreakdown {
  return scoreFromLogs(decodeLogs(token));
}
