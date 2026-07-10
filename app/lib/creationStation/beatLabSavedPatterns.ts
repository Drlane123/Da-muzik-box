/**
 * User-saved Beat Lab drum patterns (grid A/B + tempo) — optional kit pairing.
 */
import type { StoredPadSample } from '@/app/lib/padSampleStorage';
import {
  captureBeatLabSongSnapshot,
  type BeatLabSavedSongSequence,
  type CaptureBeatLabSongInput,
} from '@/app/lib/creationStation/beatLabSavedSongs';

export const BEAT_LAB_SAVED_PATTERNS_STORAGE_KEY = 'beatLab_savedPatterns_v1';

export type BeatLabSavedPattern = {
  id: string;
  name: string;
  savedAt: number;
  sequence: BeatLabSavedSongSequence;
  /** When saved with kit — full pad snapshot on the bank. */
  kit?: {
    pads: Record<string, StoredPadSample>;
    label?: string;
  };
};

export function loadBeatLabSavedPatterns(): BeatLabSavedPattern[] {
  try {
    const raw = localStorage.getItem(BEAT_LAB_SAVED_PATTERNS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isBeatLabSavedPattern);
  } catch {
    return [];
  }
}

export function persistBeatLabSavedPatterns(patterns: BeatLabSavedPattern[]): boolean {
  try {
    localStorage.setItem(BEAT_LAB_SAVED_PATTERNS_STORAGE_KEY, JSON.stringify(patterns));
    return true;
  } catch {
    return false;
  }
}

function isBeatLabSavedPattern(v: unknown): v is BeatLabSavedPattern {
  if (!v || typeof v !== 'object') return false;
  const o = v as BeatLabSavedPattern;
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    typeof o.savedAt === 'number' &&
    o.sequence != null &&
    typeof o.sequence === 'object' &&
    Array.isArray(o.sequence.patternA) &&
    Array.isArray(o.sequence.patternB)
  );
}

export function sanitizePatternName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, 48);
}

export function countPatternSteps(sequence: BeatLabSavedSongSequence): number {
  let n = 0;
  for (const slot of [sequence.patternA, sequence.patternB] as const) {
    for (const row of slot) {
      if (!Array.isArray(row)) continue;
      for (const cell of row) if (cell) n++;
    }
  }
  return n;
}

export function captureBeatLabPatternSnapshot(
  input: CaptureBeatLabSongInput,
  includeKit: boolean,
): Pick<BeatLabSavedPattern, 'sequence' | 'kit'> {
  const snap = captureBeatLabSongSnapshot(input);
  return {
    sequence: snap.sequence,
    kit: includeKit ? snap.kit : undefined,
  };
}

export function upsertBeatLabSavedPattern(
  patterns: BeatLabSavedPattern[],
  name: string,
  sequence: BeatLabSavedSongSequence,
  kit?: BeatLabSavedPattern['kit'],
): { patterns: BeatLabSavedPattern[]; pattern: BeatLabSavedPattern; persisted: boolean } {
  const displayName = sanitizePatternName(name) || 'My pattern';
  const existing = patterns.find((p) => p.name.toLowerCase() === displayName.toLowerCase());
  const pattern: BeatLabSavedPattern = {
    id: existing?.id ?? `pat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    name: displayName,
    savedAt: Date.now(),
    sequence,
    kit: kit && Object.keys(kit.pads).length > 0 ? kit : undefined,
  };
  const next = existing
    ? patterns.map((p) => (p.id === existing.id ? pattern : p))
    : [...patterns, pattern];
  const persisted = persistBeatLabSavedPatterns(next);
  return { patterns: next, pattern, persisted };
}

export function renameBeatLabSavedPattern(
  patterns: BeatLabSavedPattern[],
  id: string,
  name: string,
): BeatLabSavedPattern[] {
  const displayName = sanitizePatternName(name) || 'My pattern';
  const next = patterns.map((p) =>
    p.id === id ? { ...p, name: displayName, savedAt: Date.now() } : p,
  );
  persistBeatLabSavedPatterns(next);
  return next;
}

export function deleteBeatLabSavedPattern(patterns: BeatLabSavedPattern[], id: string): BeatLabSavedPattern[] {
  const next = patterns.filter((p) => p.id !== id);
  persistBeatLabSavedPatterns(next);
  return next;
}

export function findBeatLabSavedPattern(
  patterns: BeatLabSavedPattern[],
  id: string,
): BeatLabSavedPattern | undefined {
  return patterns.find((p) => p.id === id);
}
