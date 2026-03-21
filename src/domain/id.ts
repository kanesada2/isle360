import { ulid } from "ulid";
import type { GameId, PlayerId, FacilityId, ResearchId } from "./types";

export const newGameId     = (): GameId     => ulid() as GameId;
export const newPlayerId   = (): PlayerId   => ulid() as PlayerId;
export const newFacilityId = (): FacilityId => ulid() as FacilityId;
export const newResearchId = (): ResearchId => ulid() as ResearchId;
