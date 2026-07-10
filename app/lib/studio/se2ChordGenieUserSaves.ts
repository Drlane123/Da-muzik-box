/**
 * SE2 Chord Generator — user-saved chord progressions (localStorage).
 */
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import { clampGrooveLabBpm } from '@/app/lib/creationStation/grooveLabTempo';
import type { GrooveProgressionStep } from '@/app/lib/creationStation/grooveLabProgressionBuilder';
import { newProgressionStepId } from '@/app/lib/creationStation/grooveLabProgressionBuilder';
import {
  studioNormalizeHarmonyLoopBars,
  type StudioHarmonyLoopBars,
} from '@/app/lib/studio/studioInstrumentHarmony';

export const SE2_CHORD_GENIE_USER_PATTERN_PREFIX = 'user::';
const STORAGE_KEY = 'damusic-se2-chord-genie-user-patterns-v1';
const MAX_PATTERNS = 32;

export type Se2ChordGenieSavedPattern = {
  id: string;
  name: string;
  savedAt: number;
  steps: GrooveProgressionStep[];
  keyRoot: number;
  keyMode: ChordMode;
  loopBars: StudioHarmonyLoopBars;
  styleGenreId: string;
  /** Factory preset id when this pattern was saved (optional reference). */
  sourcePresetId: string;
  bpm: number;
  /** Explicit user Save — only these rows may be deleted from the UI. */
  userCreated?: boolean;
};

type Se2ChordGenieUserSaveStore = {
  patterns: Se2ChordGenieSavedPattern[];
};

function emptyStore(): Se2ChordGenieUserSaveStore {
  return { patterns: [] };
}

function readStore(): Se2ChordGenieUserSaveStore {
  if (typeof localStorage === 'undefined') return emptyStore();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Se2ChordGenieUserSaveStore;
    return {
      patterns: Array.isArray(parsed.patterns) ? parsed.patterns : [],
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(store: Se2ChordGenieUserSaveStore): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota */
  }
}

function newUserId(): string {
  return `cg-user-${Date.now()}-${Math.floor(Math.random() * 99999)}`;
}

/** True only for rows the user created via Save (never factory preset catalog entries). */
export function se2ChordGenieIsDeletableUserPattern(pattern: Se2ChordGenieSavedPattern): boolean {
  if (!pattern.id.startsWith('cg-user-')) return false;
  return pattern.userCreated !== false;
}

function trimList<T>(list: T[], max: number): T[] {
  return list.length <= max ? list : list.slice(0, max);
}

function sanitizeStep(step: GrooveProgressionStep): GrooveProgressionStep {
  const beats = Math.max(0.25, Number(step.beats) || 4);
  const barBeats = step.barBeats?.length
    ? step.barBeats.filter((b) => b >= 1 && b <= 4).map((b) => Math.round(b))
    : undefined;
  return {
    id: typeof step.id === 'string' && step.id.trim() ? step.id : newProgressionStepId(),
    label: typeof step.label === 'string' ? step.label.trim() : '',
    beats,
    rest: !!step.rest,
    hitsPerBar:
      step.hitsPerBar != null
        ? Math.max(1, Math.min(4, Math.round(step.hitsPerBar)))
        : undefined,
    barBeats: barBeats?.length ? barBeats : undefined,
  };
}

function sanitizePattern(p: Se2ChordGenieSavedPattern): Se2ChordGenieSavedPattern {
  return {
    ...p,
    name: (p.name || 'My Chords').trim().slice(0, 48),
    steps: (p.steps ?? []).map(sanitizeStep),
    keyRoot: ((Math.round(p.keyRoot) % 12) + 12) % 12,
    keyMode: p.keyMode === 'minor' ? 'minor' : 'major',
    loopBars: studioNormalizeHarmonyLoopBars(p.loopBars),
    styleGenreId: (p.styleGenreId || '').trim(),
    sourcePresetId: (p.sourcePresetId || '').trim(),
    bpm: clampGrooveLabBpm(Number(p.bpm) || 120),
  };
}

export function se2ChordGenieUserPatternOptionId(id: string): string {
  return `${SE2_CHORD_GENIE_USER_PATTERN_PREFIX}${id}`;
}

export function se2ChordGenieIsUserPatternOptionId(value: string): boolean {
  return value.startsWith(SE2_CHORD_GENIE_USER_PATTERN_PREFIX);
}

export function se2ChordGenieUserPatternIdFromOption(value: string): string {
  return value.slice(SE2_CHORD_GENIE_USER_PATTERN_PREFIX.length);
}

export function listSe2ChordGenieSavedPatterns(): readonly Se2ChordGenieSavedPattern[] {
  return readStore()
    .patterns.slice()
    .sort((a, b) => b.savedAt - a.savedAt)
    .map((p) => sanitizePattern(p));
}

export function saveSe2ChordGeniePattern(
  name: string,
  payload: Omit<Se2ChordGenieSavedPattern, 'id' | 'name' | 'savedAt'>,
): Se2ChordGenieSavedPattern {
  const trimmed = name.trim().slice(0, 48) || 'My Chords';
  const entry = sanitizePattern({
    id: newUserId(),
    name: trimmed,
    savedAt: Date.now(),
    userCreated: true,
    ...payload,
    steps: payload.steps.map((s) => sanitizeStep({ ...s, id: s.id || newProgressionStepId() })),
  });
  const store = readStore();
  store.patterns = trimList([entry, ...store.patterns], MAX_PATTERNS);
  writeStore(store);
  return entry;
}

export function getSe2ChordGenieSavedPattern(id: string): Se2ChordGenieSavedPattern | undefined {
  return listSe2ChordGenieSavedPatterns().find((p) => p.id === id);
}

export function deleteSe2ChordGenieSavedPattern(id: string): void {
  const store = readStore();
  const row = store.patterns.find((p) => p.id === id);
  if (!row || !se2ChordGenieIsDeletableUserPattern(sanitizePattern(row))) return;
  store.patterns = store.patterns.filter((p) => p.id !== id);
  writeStore(store);
}

export function renameSe2ChordGenieSavedPattern(id: string, name: string): Se2ChordGenieSavedPattern | undefined {
  const trimmed = name.trim().slice(0, 48);
  if (!trimmed) return undefined;
  const store = readStore();
  const idx = store.patterns.findIndex((p) => p.id === id);
  if (idx < 0) return undefined;
  const cur = sanitizePattern(store.patterns[idx]!);
  const next = { ...cur, name: trimmed, savedAt: Date.now() };
  store.patterns[idx] = next;
  writeStore(store);
  return next;
}

export function se2ChordGenieSavedPatternBpm(
  presetId: string,
  fallback = 120,
): number | undefined {
  if (!se2ChordGenieIsUserPatternOptionId(presetId)) return undefined;
  const saved = getSe2ChordGenieSavedPattern(se2ChordGenieUserPatternIdFromOption(presetId));
  return saved?.bpm ?? fallback;
}

export function se2ChordGenieSavedPatternLabel(
  presetId: string,
  fallback = 'My pattern',
): string | undefined {
  if (!se2ChordGenieIsUserPatternOptionId(presetId)) return undefined;
  const saved = getSe2ChordGenieSavedPattern(se2ChordGenieUserPatternIdFromOption(presetId));
  return saved?.name ?? fallback;
}
