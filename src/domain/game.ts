import type { Game, Player } from "./types";
import { newGameId, newPlayerId } from "./id";
import { generatePlots } from "./plot";
import { createRng } from "./rng";

type CreateGameParams = {
  sessionDurationMs: number;
  initialFunds: number;
  mapSeed?: number;
};

export function createGame({ sessionDurationMs, initialFunds, mapSeed: seedParam }: CreateGameParams): Game {
  const player: Player = {
    id: newPlayerId(),
    funds: initialFunds,
    completedResearch: new Map(),
    activeResearchIds: new Set(),
    patentTickAt: null,
  };

  const mapSeed = seedParam ?? Math.floor(Math.random() * 0xFFFFFFFF);

  return {
    id: newGameId(),
    player,
    plots: generatePlots(createRng(mapSeed)),
    facilities: new Map(),
    mapSeed,
    sessionDurationMs,
    startedAt: null,
    status: "setup",
    logs: [],
  };
}
