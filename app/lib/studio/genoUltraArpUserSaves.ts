/**
 * Geno Ultra ARP — user-saved sounds + patterns (localStorage, E: project browser).
 */
import { padGenoArpGridRows, genoArpSanitizeBarLength, genoArpSanitizeBarOctShift, genoArpSanitizeVariation, genoArpSanitizeOctRange } from '@/app/lib/studio/genoUltraArpPattern';
import {
  GENO_ULTRA_ARP_MELODY_TAGS,
  type GenoUltraArpMelodyTag,
} from '@/app/lib/studio/genoUltraArpMelodyPresets';
import { clampGenoUltraArpBpm, type GenoUltraArpSnapshot } from '@/app/lib/studio/genoUltraArpState';
import type { GenoUltraSynthVoiceParams } from '@/app/lib/studio/genoUltraSynthTypes';
import { sanitizeGenoUltraFxParams } from '@/app/lib/studio/genoUltraSynthTypes';

const STORAGE_KEY = 'damusic-geno-ultra-arp-user-saves-v1';
const MAX_SOUNDS = 32;
const MAX_PATTERNS = 32;

/** Browser id prefix for user patterns listed under ARP Melodies. */
export const GENO_ULTRA_USER_PATTERN_ID_PREFIX = 'user-pattern:';

const MELODY_TAG_IDS = new Set<string>(GENO_ULTRA_ARP_MELODY_TAGS.map((t) => t.id));

export function isGenoUltraArpMelodyTag(value: unknown): value is GenoUltraArpMelodyTag {
  return typeof value === 'string' && MELODY_TAG_IDS.has(value);
}

export function genoUltraUserPatternBrowserId(patternId: string): string {
  return `${GENO_ULTRA_USER_PATTERN_ID_PREFIX}${patternId}`;
}

export function parseGenoUltraUserPatternBrowserId(id: string): string | null {
  if (!id.startsWith(GENO_ULTRA_USER_PATTERN_ID_PREFIX)) return null;
  const patternId = id.slice(GENO_ULTRA_USER_PATTERN_ID_PREFIX.length);
  return patternId || null;
}

export type GenoUltraArpSavedSound = {
  id: string;
  name: string;
  savedAt: number;
  voice: GenoUltraSynthVoiceParams;
};

/** Full arp panel state — pattern always includes the edited voice snapshot. */
export type GenoUltraArpSavedPattern = {
  id: string;
  name: string;
  savedAt: number;
  voice: GenoUltraSynthVoiceParams;
  orderIdx: number;
  modDepth: number;
  modRate: number;
  randSeed: number;
  presetLock: boolean;
  cardPresetId: string;
  snapshot: GenoUltraArpSnapshot;
  /** ARP Melodies category this pattern was saved from (e.g. trap, 70s). */
  melodyTag?: GenoUltraArpMelodyTag;
  /** True = arp grid/sequencer only — load keeps the current synth patch. */
  patternOnly?: boolean;
};

type GenoUltraArpUserSaveStore = {
  sounds: GenoUltraArpSavedSound[];
  patterns: GenoUltraArpSavedPattern[];
};

function emptyStore(): GenoUltraArpUserSaveStore {
  return { sounds: [], patterns: [] };
}

function readStore(): GenoUltraArpUserSaveStore {
  if (typeof localStorage === 'undefined') return emptyStore();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as GenoUltraArpUserSaveStore;
    return {
      sounds: Array.isArray(parsed.sounds) ? parsed.sounds : [],
      patterns: Array.isArray(parsed.patterns) ? parsed.patterns : [],
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(store: GenoUltraArpUserSaveStore): void {
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

export function cloneGenoUltraVoice(v: GenoUltraSynthVoiceParams): GenoUltraSynthVoiceParams {
  return {
    ...v,
    osc1: { ...v.osc1 },
    osc2: { ...v.osc2 },
    osc3: { ...v.osc3 },
    modSlots: v.modSlots.map((s) => ({ ...s })),
    fx: sanitizeGenoUltraFxParams({ ...v.fx }),
  };
}

export function sanitizeGenoUltraArpSnapshot(snap: GenoUltraArpSnapshot): GenoUltraArpSnapshot {
  return {
    ...snap,
    barLength: genoArpSanitizeBarLength(snap.barLength),
    bpm: snap.bpm != null ? clampGenoUltraArpBpm(snap.bpm) : undefined,
    grid: padGenoArpGridRows(snap.grid.map((r) => [...r])),
    barOctShifts: snap.barOctShifts.map((o) => genoArpSanitizeBarOctShift(o)),
    arpVariation: snap.arpVariation != null ? genoArpSanitizeVariation(snap.arpVariation) : undefined,
    octRange: snap.octRange != null ? genoArpSanitizeOctRange(snap.octRange) : undefined,
    orderInversion: !!snap.orderInversion,
    mod1Levels: [...snap.mod1Levels],
    mod2Levels: [...snap.mod2Levels],
    velLevels: [...snap.velLevels],
    chordTimeline: snap.chordTimeline?.map((s) => ({
      ...s,
      pitches: [...s.pitches],
    })),
  };
}

export function listGenoUltraArpSavedSounds(): readonly GenoUltraArpSavedSound[] {
  return readStore().sounds
    .slice()
    .sort((a, b) => b.savedAt - a.savedAt)
    .map((s) => ({ ...s, voice: cloneGenoUltraVoice(s.voice) }));
}

export function listGenoUltraArpSavedPatterns(): readonly GenoUltraArpSavedPattern[] {
  return readStore().patterns
    .slice()
    .sort((a, b) => b.savedAt - a.savedAt)
    .map((p) => ({
      ...p,
      voice: cloneGenoUltraVoice(p.voice),
      snapshot: sanitizeGenoUltraArpSnapshot(p.snapshot),
      melodyTag: isGenoUltraArpMelodyTag(p.melodyTag) ? p.melodyTag : undefined,
      patternOnly: !!p.patternOnly,
    }));
}

/** User patterns for one ARP Melodies category (sound + pattern saves only). */
export function listGenoUltraArpSavedPatternsForMelodyTag(
  tag: GenoUltraArpMelodyTag | 'mine',
): readonly GenoUltraArpSavedPattern[] {
  return listGenoUltraArpSavedPatterns().filter((p) => {
    if (p.patternOnly) return false;
    return tag === 'mine' ? !p.melodyTag : p.melodyTag === tag;
  });
}

/** Pattern-only saves (arp grid — no melody browser listing). */
export function listGenoUltraArpSavedPatternsOnly(): readonly GenoUltraArpSavedPattern[] {
  return listGenoUltraArpSavedPatterns().filter((p) => p.patternOnly);
}

/** Sound + pattern saves (Melodies browser + load dropdown). */
export function listGenoUltraArpSavedSoundAndPatterns(): readonly GenoUltraArpSavedPattern[] {
  return listGenoUltraArpSavedPatterns().filter((p) => !p.patternOnly);
}

function trimList<T>(list: T[], max: number): T[] {
  return list.length <= max ? list : list.slice(0, max);
}

export function saveGenoUltraArpSound(name: string, voice: GenoUltraSynthVoiceParams): GenoUltraArpSavedSound {
  const trimmed = name.trim().slice(0, 48) || 'My Sound';
  const entry: GenoUltraArpSavedSound = {
    id: newUserId('sound'),
    name: trimmed,
    savedAt: Date.now(),
    voice: cloneGenoUltraVoice(voice),
  };
  const store = readStore();
  store.sounds = trimList([entry, ...store.sounds], MAX_SOUNDS);
  writeStore(store);
  return entry;
}

export function saveGenoUltraArpPattern(
  name: string,
  voice: GenoUltraSynthVoiceParams,
  payload: Omit<GenoUltraArpSavedPattern, 'id' | 'name' | 'savedAt' | 'voice'>,
): GenoUltraArpSavedPattern {
  const trimmed = name.trim().slice(0, 48) || 'My Pattern';
  const melodyTag =
    payload.patternOnly || !isGenoUltraArpMelodyTag(payload.melodyTag)
      ? undefined
      : payload.melodyTag;
  const entry: GenoUltraArpSavedPattern = {
    id: newUserId('pattern'),
    name: trimmed,
    savedAt: Date.now(),
    voice: cloneGenoUltraVoice({ ...voice, label: trimmed }),
    orderIdx: payload.orderIdx,
    modDepth: payload.modDepth,
    modRate: payload.modRate,
    randSeed: payload.randSeed,
    presetLock: payload.presetLock,
    cardPresetId: payload.cardPresetId,
    snapshot: sanitizeGenoUltraArpSnapshot(payload.snapshot),
    melodyTag,
    patternOnly: !!payload.patternOnly,
  };
  const store = readStore();
  store.patterns = trimList([entry, ...store.patterns], MAX_PATTERNS);
  writeStore(store);
  return entry;
}

export function getGenoUltraArpSavedSound(id: string): GenoUltraArpSavedSound | undefined {
  return listGenoUltraArpSavedSounds().find((s) => s.id === id);
}

export function getGenoUltraArpSavedPattern(id: string): GenoUltraArpSavedPattern | undefined {
  return listGenoUltraArpSavedPatterns().find((p) => p.id === id);
}

export function deleteGenoUltraArpSavedSound(id: string): void {
  const store = readStore();
  store.sounds = store.sounds.filter((s) => s.id !== id);
  writeStore(store);
}

export function deleteGenoUltraArpSavedPattern(id: string): void {
  const store = readStore();
  store.patterns = store.patterns.filter((p) => p.id !== id);
  writeStore(store);
}
