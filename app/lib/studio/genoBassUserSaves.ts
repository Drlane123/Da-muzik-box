/**
 * Geno Bass 52 — user-saved sounds + groove patterns (localStorage).
 */
import type { GenoBassGroovePreset, GenoBassGrooveQuantize } from '@/app/lib/studio/genoBassGroovePresets';
import {
  GENO_BASS_LOOP_EDITOR_MAX,
  GENO_BASS_LOOP_EDITOR_MIN,
  type GenoBassLoopBarLength,
} from '@/app/lib/studio/genoBassLoopExport';
import { genoBassSanitizePresetId } from '@/app/lib/studio/genoBassSynthPresets';
import { cloneGenoUltraVoice } from '@/app/lib/studio/genoUltraArpUserSaves';
import type { GenoUltraArpChordSegment } from '@/app/lib/studio/genoUltraArpState';
import type { GenoUltraSynthVoiceParams } from '@/app/lib/studio/genoUltraSynthTypes';
import { genoWrapMidiToRange } from '@/app/lib/studio/se2SynthGenoRanges';
import type { StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';

const STORAGE_KEY = 'damusic-geno-bass-52-user-saves-v1';
const MAX_SOUNDS = 32;
const MAX_PATTERNS = 32;

export type GenoBassSavedSound = {
  id: string;
  name: string;
  savedAt: number;
  voice: GenoUltraSynthVoiceParams;
  soundPresetId: string;
  patchLabel: string;
};

/** Groove piano roll + harmony + edited synth voice. */
export type GenoBassSavedPattern = {
  id: string;
  name: string;
  savedAt: number;
  voice: GenoUltraSynthVoiceParams;
  soundPresetId: string;
  patchLabel: string;
  templateNotes: StudioEditor2GenNote[];
  barLength: GenoBassLoopBarLength;
  presetId: string;
  presetGroup: '808' | 'synth' | 'funk' | 'pop' | 'hits' | 'rnb' | 'electro';
  gate: number;
  grooveQuantize: GenoBassGrooveQuantize;
  basePitch: number;
  chordLocked: boolean;
  chordTimeline: GenoUltraArpChordSegment[] | null;
  chordTotalBeats: number;
  chordKeyRoot: number;
  chordKeyMode: StudioDetectedKeyMode;
  randSeed: number;
  /** Pattern-only recall — groove roll without replacing the current synth patch. */
  patternOnly?: boolean;
};

type GenoBassUserSaveStore = {
  sounds: GenoBassSavedSound[];
  patterns: GenoBassSavedPattern[];
};

function emptyStore(): GenoBassUserSaveStore {
  return { sounds: [], patterns: [] };
}

function readStore(): GenoBassUserSaveStore {
  if (typeof localStorage === 'undefined') return emptyStore();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as GenoBassUserSaveStore;
    return {
      sounds: Array.isArray(parsed.sounds) ? parsed.sounds : [],
      patterns: Array.isArray(parsed.patterns) ? parsed.patterns : [],
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(store: GenoBassUserSaveStore): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota */
  }
}

function newUserId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 99999)}`;
}

function trimList<T>(list: T[], max: number): T[] {
  return list.length <= max ? list : list.slice(0, max);
}

function sanitizeNote(n: StudioEditor2GenNote): StudioEditor2GenNote {
  return {
    ...n,
    pitch: genoWrapMidiToRange(Math.round(n.pitch), GENO_BASS_LOOP_EDITOR_MIN, GENO_BASS_LOOP_EDITOR_MAX),
    startBeat: Math.max(0, n.startBeat),
    durationBeats: Math.max(1 / 32, n.durationBeats),
    velocity: Math.max(1, Math.min(127, Math.round(n.velocity))),
  };
}

function sanitizeChordTimeline(
  timeline: GenoUltraArpChordSegment[] | null,
): GenoUltraArpChordSegment[] | null {
  if (!timeline?.length) return null;
  return timeline.map((s) => ({
    ...s,
    pitches: [...s.pitches],
  }));
}

function sanitizePattern(p: GenoBassSavedPattern): GenoBassSavedPattern {
  const barLength: GenoBassLoopBarLength = p.barLength === 8 ? 8 : 4;
  const group = p.presetGroup;
  const presetGroup: GenoBassSavedPattern['presetGroup'] =
    group === '808' ||
    group === 'synth' ||
    group === 'funk' ||
    group === 'pop' ||
    group === 'hits' ||
    group === 'rnb' ||
    group === 'electro'
      ? group
      : 'hits';
  return {
    ...p,
    voice: cloneGenoUltraVoice(p.voice),
    soundPresetId: genoBassSanitizePresetId(p.soundPresetId),
    patchLabel: (p.patchLabel || p.voice.label || 'My Bass').slice(0, 48),
    templateNotes: (p.templateNotes ?? []).map(sanitizeNote),
    barLength,
    gate: Math.max(0.35, Math.min(1, p.gate)),
    grooveQuantize: p.grooveQuantize === '8' || p.grooveQuantize === '32' ? p.grooveQuantize : '16',
    basePitch: genoWrapMidiToRange(Math.round(p.basePitch), GENO_BASS_LOOP_EDITOR_MIN, GENO_BASS_LOOP_EDITOR_MAX),
    chordLocked: !!p.chordLocked,
    chordTimeline: sanitizeChordTimeline(p.chordTimeline),
    chordTotalBeats: Math.max(4, p.chordTotalBeats),
    chordKeyRoot: ((Math.round(p.chordKeyRoot) % 12) + 12) % 12,
    chordKeyMode: p.chordKeyMode === 'minor' ? 'minor' : 'major',
    randSeed: Math.max(0, Math.floor(p.randSeed)),
    patternOnly: !!p.patternOnly,
  };
}

export function listGenoBassSavedSounds(): readonly GenoBassSavedSound[] {
  return readStore()
    .sounds.slice()
    .sort((a, b) => b.savedAt - a.savedAt)
    .map((s) => ({
      ...s,
      voice: cloneGenoUltraVoice(s.voice),
      soundPresetId: genoBassSanitizePresetId(s.soundPresetId),
    }));
}

export function listGenoBassSavedPatterns(): readonly GenoBassSavedPattern[] {
  return readStore()
    .patterns.slice()
    .sort((a, b) => b.savedAt - a.savedAt)
    .map((p) => sanitizePattern(p));
}

/** Groove roll only — keeps your current bass sound on load. */
export function listGenoBassSavedPatternsOnly(): readonly GenoBassSavedPattern[] {
  return listGenoBassSavedPatterns().filter((p) => p.patternOnly);
}

/** Sound + groove — listed under My Grooves in the preset browser. */
export function listGenoBassSavedSoundAndPatterns(): readonly GenoBassSavedPattern[] {
  return listGenoBassSavedPatterns().filter((p) => !p.patternOnly);
}

export const GENO_BASS_USER_GROOVE_PRESET_PREFIX = 'user-save:';

export function genoBassUserGroovePresetId(patternId: string): string {
  return `${GENO_BASS_USER_GROOVE_PRESET_PREFIX}${patternId}`;
}

export function genoBassPatternIdFromUserGroovePresetId(id: string): string | null {
  if (!id.startsWith(GENO_BASS_USER_GROOVE_PRESET_PREFIX)) return null;
  return id.slice(GENO_BASS_USER_GROOVE_PRESET_PREFIX.length) || null;
}

export function genoBassUserGroovePresetsFromSaves(
  patterns: readonly GenoBassSavedPattern[],
): GenoBassGroovePreset[] {
  return patterns.map((p) => ({
    id: genoBassUserGroovePresetId(p.id),
    label: p.name,
    genre: 'My Grooves',
    group: 'my',
    bpm: 120,
    steps: [],
  }));
}

export function saveGenoBassSound(
  name: string,
  voice: GenoUltraSynthVoiceParams,
  soundPresetId: string,
  patchLabel: string,
): GenoBassSavedSound {
  const trimmed = name.trim().slice(0, 48) || patchLabel.trim().slice(0, 48) || 'My Bass Sound';
  const entry: GenoBassSavedSound = {
    id: newUserId('bass-sound'),
    name: trimmed,
    savedAt: Date.now(),
    voice: cloneGenoUltraVoice(voice),
    soundPresetId: genoBassSanitizePresetId(soundPresetId),
    patchLabel: patchLabel.trim().slice(0, 48) || trimmed,
  };
  const store = readStore();
  store.sounds = trimList([entry, ...store.sounds], MAX_SOUNDS);
  writeStore(store);
  return entry;
}

export function saveGenoBassPattern(
  name: string,
  payload: Omit<GenoBassSavedPattern, 'id' | 'name' | 'savedAt'>,
): GenoBassSavedPattern {
  const trimmed = name.trim().slice(0, 48) || payload.patchLabel.trim().slice(0, 48) || 'My Bass Pattern';
  const entry = sanitizePattern({
    id: newUserId('bass-pattern'),
    name: trimmed,
    savedAt: Date.now(),
    ...payload,
  });
  const store = readStore();
  store.patterns = trimList([entry, ...store.patterns], MAX_PATTERNS);
  writeStore(store);
  return entry;
}

export function getGenoBassSavedSound(id: string): GenoBassSavedSound | undefined {
  return listGenoBassSavedSounds().find((s) => s.id === id);
}

export function getGenoBassSavedPattern(id: string): GenoBassSavedPattern | undefined {
  return listGenoBassSavedPatterns().find((p) => p.id === id);
}

export function deleteGenoBassSavedSound(id: string): void {
  const store = readStore();
  store.sounds = store.sounds.filter((s) => s.id !== id);
  writeStore(store);
}

export function deleteGenoBassSavedPattern(id: string): void {
  const store = readStore();
  store.patterns = store.patterns.filter((p) => p.id !== id);
  writeStore(store);
}
