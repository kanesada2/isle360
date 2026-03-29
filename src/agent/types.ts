import type { FacilityCatalogEntry } from '../domain/facility-catalog';
import type { ResearchCatalogEntry } from '../domain/research-catalog';
import type { FacilityId, PlotIndex } from '../domain/types';

export type BuildAction    = { kind: 'build';    plotIndex: PlotIndex; entry: FacilityCatalogEntry };
export type DemolishAction = { kind: 'demolish'; plotIndex: PlotIndex };
export type ResearchAction = { kind: 'research'; labId: FacilityId;    entry: ResearchCatalogEntry };

export type Action = BuildAction | DemolishAction | ResearchAction;
