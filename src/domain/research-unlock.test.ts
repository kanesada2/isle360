import { describe, expect, it } from 'vitest';
import type { ResearchId } from './types';
import { getAvailableResearch, isResearchAvailable } from './research-unlock';

const r = (s: string) => s as ResearchId;

const noFacilities = new Map();
const highFunds = 999_999;

function makeCompleted(entries: [string, number][]): Map<ResearchId, number> {
  return new Map(entries.map(([k, v]) => [r(k), v]));
}

describe('getAvailableResearch', () => {
  it('Lv.4の繰り返し研究はリストに含まれる', () => {
    const completed = makeCompleted([['agri-efficiency', 4]]);
    const keys = getAvailableResearch(completed).map((e) => e.key);
    expect(keys).toContain('agri-efficiency');
  });

  it('Lv.5の繰り返し研究はリストから消える', () => {
    const completed = makeCompleted([['agri-efficiency', 5]]);
    const keys = getAvailableResearch(completed).map((e) => e.key);
    expect(keys).not.toContain('agri-efficiency');
  });

  it('Lv.5を超えてもリストから消えたまま', () => {
    const completed = makeCompleted([['agri-efficiency', 6]]);
    const keys = getAvailableResearch(completed).map((e) => e.key);
    expect(keys).not.toContain('agri-efficiency');
  });

  it('非繰り返し研究は前提完了済みなら含まれる', () => {
    const completed = makeCompleted([['agri-efficiency', 1]]);
    const keys = getAvailableResearch(completed).map((e) => e.key);
    expect(keys).toContain('mineral-survey');
  });

  it('hideUntilAvailable な研究は前提未完了なら含まれない', () => {
    const completed = makeCompleted([]);
    const keys = getAvailableResearch(completed).map((e) => e.key);
    expect(keys).not.toContain('agri-patent');
  });

  it('hideUntilAvailable な研究は前提完了後に含まれる', () => {
    const completed = makeCompleted([['agri-efficiency', 5]]);
    const keys = getAvailableResearch(completed).map((e) => e.key);
    expect(keys).toContain('agri-patent');
  });

  it('非繰り返し研究は完了後リストから消える', () => {
    const completed = makeCompleted([['agri-efficiency', 1], ['mineral-survey', 1]]);
    const keys = getAvailableResearch(completed).map((e) => e.key);
    expect(keys).not.toContain('mineral-survey');
  });
});

describe('isResearchAvailable', () => {
  const agriBuilt = new Set(['extractor-agriculture']);

  it('前提研究未完了なら false', () => {
    const mineralSurveyEntry = { key: r('mineral-survey'), name: '', description: '', baseCost: 200, repeatable: false, prerequisites: [{ key: r('agri-efficiency'), level: 1 }] };
    const result = isResearchAvailable(mineralSurveyEntry, new Map(), highFunds, noFacilities, new Set());
    expect(result).toBe(false);
  });

  it('前提研究完了済みなら true', () => {
    const completed = makeCompleted([['agri-efficiency', 1]]);
    const mineralSurveyEntry = { key: r('mineral-survey'), name: '', description: '', baseCost: 200, repeatable: false, prerequisites: [{ key: r('agri-efficiency'), level: 1 }] };
    const result = isResearchAvailable(mineralSurveyEntry, completed, highFunds, noFacilities, new Set());
    expect(result).toBe(true);
  });

  it('資金不足なら false', () => {
    const entry = getAvailableResearch(new Map()).find((e) => e.key === 'agri-efficiency')!;
    const result = isResearchAvailable(entry, new Map(), 50, noFacilities, agriBuilt);
    expect(result).toBe(false);
  });

  it('同じ研究が進行中なら false', () => {
    const entry = getAvailableResearch(new Map()).find((e) => e.key === 'agri-efficiency')!;
    const facilities = new Map([
      ['lab-1' as any, {
        kind: 'laboratory' as const,
        state: 'processing' as const,
        activeResearchId: r('agri-efficiency'),
        currentJob: { startedAt: 0, durationMs: 15_000 },
      } as any],
    ]);
    const result = isResearchAvailable(entry, new Map(), highFunds, facilities, agriBuilt);
    expect(result).toBe(false);
  });

  it('別の研究が進行中なら影響しない', () => {
    const entry = getAvailableResearch(new Map()).find((e) => e.key === 'agri-efficiency')!;
    const facilities = new Map([
      ['lab-1' as any, {
        kind: 'laboratory' as const,
        state: 'processing' as const,
        activeResearchId: r('refinery-efficiency'),
        currentJob: { startedAt: 0, durationMs: 15_000 },
      } as any],
    ]);
    const result = isResearchAvailable(entry, new Map(), highFunds, facilities, agriBuilt);
    expect(result).toBe(true);
  });

  it('施設前提が未建設なら false', () => {
    const entry = getAvailableResearch(new Map()).find((e) => e.key === 'agri-efficiency')!;
    const result = isResearchAvailable(entry, new Map(), highFunds, noFacilities, new Set());
    expect(result).toBe(false);
  });

  it('施設前提が建設済みなら通過する', () => {
    const entry = getAvailableResearch(new Map()).find((e) => e.key === 'agri-efficiency')!;
    const result = isResearchAvailable(entry, new Map(), highFunds, noFacilities, agriBuilt);
    expect(result).toBe(true);
  });

  it('精製効率向上は精製工場が未建設なら false', () => {
    const entry = getAvailableResearch(new Map()).find((e) => e.key === 'refinery-efficiency')!;
    expect(isResearchAvailable(entry, new Map(), highFunds, noFacilities, new Set())).toBe(false);
    expect(isResearchAvailable(entry, new Map(), highFunds, noFacilities, new Set(['refinery']))).toBe(true);
  });
});
