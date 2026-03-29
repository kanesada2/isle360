/**
 * 離散イベントシミュレーションのコアループ。
 * 決定点を計算し、tickFacilities で時刻をジャンプしながら decide を呼ぶ。
 */
import { buildFacility, computeFundsPerSecond, demolishFacility, getResearchCost, startResearch, tickFacilities } from '../domain/facility-actions';
import { FACILITY_CATALOG } from '../domain/facility-catalog';
import { RESEARCH_CATALOG } from '../domain/research-catalog';
import { getAvailableFacilityKeys } from '../domain/research-unlock';
import type { Game } from '../domain/types';
import { decide } from './policy';
import { effectiveBuildMs, isResearchAvailable } from './roi';
import type { Action } from './types';

// ── メインループ ─────────────────────────────────────────────────

export function runAgent(game: Game): Game {
  const startAt = game.startedAt!;
  const endAt   = startAt + game.sessionDurationMs;
  let now = startAt;

  while (now <= endAt) {
    // まずアクションを貪欲に実行（tick より先に decide → t=0 から即座に動く）
    const action = decide(game, now);
    if (action) game = applyAction(game, action, now);

    if (now >= endAt) break;

    // 次の決定点まで時刻をジャンプ
    const nextAt = Math.min(nextDecisionTime(game, now, endAt), endAt);
    if (nextAt <= now) break; // 安全弁：無限ループ防止
    game = tickFacilities(game, nextAt);
    now  = nextAt + 17; // 1フレーム待つ
  }
  return game;
}

// ── 次の決定点を計算 ─────────────────────────────────────────────

function nextDecisionTime(game: Game, now: number, endAt: number): number {
  let next = endAt;

  // 1. ジョブ完了時刻
  for (const f of game.facilities.values()) {
    if (f.currentJob) {
      const completeAt = f.currentJob.startedAt + f.currentJob.durationMs;
      if (completeAt > now) next = Math.min(next, completeAt);
    }
  }

  // 2. 次に買える最安アクションに資金が達する時刻
  const fps = computeFundsPerSecond(game);
  if (fps > 0) {
    const nextCost = cheapestAffordableNext(game);
    if (nextCost > game.player.funds) {
      const waitMs = ((nextCost - game.player.funds) / fps) * 1000;
      next = Math.min(next, now + waitMs);
    }
  }

  // 3. Monument 建設可能数が減る時刻（window が閉じていく監視）
  const effBuild  = effectiveBuildMs(game);
  const remaining = endAt - now;
  const remainder = remaining % effBuild;
  const untilCountDown = remainder > 0 ? remainder : effBuild;
  next = Math.min(next, now + untilCountDown);

  // 4. 1秒後
  next = Math.min(next, now + 1000);

  return next;
}

/** 現在アクション可能なアイテムの最低コスト */
function cheapestAffordableNext(game: Game): number {
  let min = Infinity;

  // 研究コスト（前提・スキップ条件を確認）
  for (const entry of RESEARCH_CATALOG) {
    if (!isResearchAvailable(entry, game)) continue;
    const cost = getResearchCost(entry, game.player.completedResearch);
    if (cost < min) min = cost;
  }

  // 施設建設コスト
  const available = getAvailableFacilityKeys(game.player.completedResearch);
  for (const entry of FACILITY_CATALOG) {
    if (!available.has(entry.key)) continue;
    if (entry.buildCost < min) min = entry.buildCost;
  }

  return min;
}

// ── アクション適用 ───────────────────────────────────────────────

export function applyAction(game: Game, action: Action, now: number): Game {
  switch (action.kind) {
    case 'build':
      return buildFacility(game, action.plotIndex, action.entry, now);
    case 'demolish':
      return demolishFacility(game, action.plotIndex, now);
    case 'research':
      return startResearch(game, action.labId, action.entry, now);
  }
}
