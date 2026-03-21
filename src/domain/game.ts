import type { Game, Player } from "./types";
import { newGameId, newPlayerId } from "./id";
import { generatePlots } from "./plot";

type CreateGameParams = {
  sessionDurationMs: number;
  initialFunds: number;
};

export function createGame({ sessionDurationMs, initialFunds }: CreateGameParams): Game {
  const player: Player = {
    id: newPlayerId(),
    funds: initialFunds,
    totalFundsSpent: 0,
    completedResearch: new Map(),
    activeResearchJobs: [],
  };

  return {
    id: newGameId(),
    player,
    plots: generatePlots(),
    facilities: new Map(),
    sessionDurationMs,
    startedAt: null,
    status: "setup",
    score: 0,
  };
}
