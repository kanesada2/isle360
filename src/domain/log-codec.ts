import pako from 'pako';
import type { GameLogEntry, GameEventKind, PlotIndex } from './types';
import type { Facility } from './types';

// ── インデックステーブル ──────────────────────────────────────

const KIND_LIST: GameEventKind[] = [
  'game-start',
  'construction-start',
  'construction-complete',
  'demolish-start',
  'research-start',
  'research-complete',
];

const FACILITY_KIND_LIST: (Facility['kind'] | null)[] = [
  null, 'extractor', 'refinery', 'laboratory', 'monument',
];

// ── エンコード ────────────────────────────────────────────────

// Row: [kindIdx, elapsedMs, score, fps, facilityKindIdx|null, researchKey|null, mapSeed|null, plotIndex|null, facilityKey|null]
type Row = (number | string | null)[];

function encodeEntry(entry: GameLogEntry): Row {
  const kindIdx = KIND_LIST.indexOf(entry.kind);
  const facIdx = entry.facilityKind !== undefined
    ? FACILITY_KIND_LIST.indexOf(entry.facilityKind)
    : -1;
  return [
    kindIdx,
    entry.elapsedMs,
    entry.score,
    Math.round(entry.fundsPerSecond * 100) / 100,
    facIdx >= 0 ? facIdx : null,
    entry.researchKey ?? null,
    entry.mapSeed ?? null,
    entry.plotIndex ?? null,
    entry.facilityKey ?? null,
  ];
}

export function encodeLogs(logs: GameLogEntry[]): string {
  const rows = logs.map(encodeEntry);
  const json = JSON.stringify(rows);
  const compressed = pako.deflate(json);
  let binary = '';
  for (let i = 0; i < compressed.length; i++) {
    binary += String.fromCharCode(compressed[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ── デコード ──────────────────────────────────────────────────

function decodeEntry(row: Row): GameLogEntry {
  const [kindIdx, elapsedMs, score, fps, facIdx, researchKey, mapSeed, plotIndex, facilityKey] = row;
  const entry: GameLogEntry = {
    kind: KIND_LIST[kindIdx as number],
    elapsedMs: elapsedMs as number,
    score: score as number,
    fundsPerSecond: fps as number,
  };
  if (typeof facIdx === 'number' && facIdx >= 0) {
    const fk = FACILITY_KIND_LIST[facIdx];
    if (fk !== null) entry.facilityKind = fk;
  }
  if (typeof researchKey === 'string') entry.researchKey = researchKey;
  if (typeof mapSeed === 'number') entry.mapSeed = mapSeed;
  if (typeof plotIndex === 'number') entry.plotIndex = plotIndex as PlotIndex;
  if (typeof facilityKey === 'string') entry.facilityKey = facilityKey;
  return entry;
}

export function decodeLogs(token: string): GameLogEntry[] {
  const base64 = token.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const json = pako.inflate(bytes, { to: 'string' });
  const rows: Row[] = JSON.parse(json);
  return rows.map(decodeEntry);
}
