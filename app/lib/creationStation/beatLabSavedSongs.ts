/**
 * Beat Lab saved songs — drum sequence (A/B slots) + bundled kit (samples + FX edits).
 */
import type { StoredPadSample } from '@/app/lib/padSampleStorage';
import { captureActiveBankKitPads } from '@/app/lib/creationStation/beatLabSavedKits';

export const BEAT_LAB_SAVED_SONGS_STORAGE_KEY = 'beatLab_savedSongs_v1';

export type BeatLabPatternSlotId = 'A' | 'B';

export type BeatLabSavedSongSequence = {
  patternA: boolean[][];
  patternB: boolean[][];
  activePatternSlot: BeatLabPatternSlotId;
  bpm: number;
  drumStepSubdiv: number;
  loopBars: number;
  beatsPerBar: number;
  patternPlayMode: 'single' | 'chainAB';
};

export type BeatLabSavedSong = {
  id: string;
  name: string;
  savedAt: number;
  kit: {
    pads: Record<string, StoredPadSample>;
    label?: string;
  };
  sequence: BeatLabSavedSongSequence;
};

export function loadBeatLabSavedSongs(): BeatLabSavedSong[] {
  try {
    const raw = localStorage.getItem(BEAT_LAB_SAVED_SONGS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isBeatLabSavedSong);
  } catch {
    return [];
  }
}

export function persistBeatLabSavedSongs(songs: BeatLabSavedSong[]): void {
  try {
    localStorage.setItem(BEAT_LAB_SAVED_SONGS_STORAGE_KEY, JSON.stringify(songs));
  } catch {
    /* quota */
  }
}

function isBeatLabSavedSong(v: unknown): v is BeatLabSavedSong {
  if (!v || typeof v !== 'object') return false;
  const o = v as BeatLabSavedSong;
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    typeof o.savedAt === 'number' &&
    o.kit != null &&
    typeof o.kit === 'object' &&
    o.sequence != null &&
    typeof o.sequence === 'object' &&
    Array.isArray(o.sequence.patternA) &&
    Array.isArray(o.sequence.patternB)
  );
}

export function sanitizeSongName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, 56);
}

function clonePattern(pat: boolean[][]): boolean[][] {
  return pat.map((row) => (Array.isArray(row) ? row.map(Boolean) : []));
}

export function upsertBeatLabSavedSong(
  songs: BeatLabSavedSong[],
  name: string,
  kit: BeatLabSavedSong['kit'],
  sequence: BeatLabSavedSongSequence,
): { songs: BeatLabSavedSong[]; song: BeatLabSavedSong } {
  const displayName = sanitizeSongName(name) || 'My song';
  const existing = songs.find((s) => s.name.toLowerCase() === displayName.toLowerCase());
  const song: BeatLabSavedSong = {
    id: existing?.id ?? `song_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    name: displayName,
    savedAt: Date.now(),
    kit,
    sequence,
  };
  const next = existing
    ? songs.map((s) => (s.id === existing.id ? song : s))
    : [...songs, song];
  persistBeatLabSavedSongs(next);
  return { songs: next, song };
}

export function renameBeatLabSavedSong(
  songs: BeatLabSavedSong[],
  id: string,
  name: string,
): BeatLabSavedSong[] {
  const displayName = sanitizeSongName(name) || 'My song';
  const next = songs.map((s) => (s.id === id ? { ...s, name: displayName, savedAt: Date.now() } : s));
  persistBeatLabSavedSongs(next);
  return next;
}

export function deleteBeatLabSavedSong(songs: BeatLabSavedSong[], id: string): BeatLabSavedSong[] {
  const next = songs.filter((s) => s.id !== id);
  persistBeatLabSavedSongs(next);
  return next;
}

export function findBeatLabSavedSong(songs: BeatLabSavedSong[], id: string): BeatLabSavedSong | undefined {
  return songs.find((s) => s.id === id);
}

export function countSequenceSteps(sequence: BeatLabSavedSongSequence): number {
  let n = 0;
  const pat = sequence.activePatternSlot === 'B' ? sequence.patternB : sequence.patternA;
  for (const row of pat) {
    if (!Array.isArray(row)) continue;
    for (const cell of row) if (cell) n++;
  }
  return n;
}

export type CaptureBeatLabSongInput = {
  bankIndex: number;
  bankPatternSlots: Array<Record<BeatLabPatternSlotId, boolean[][]>>;
  patternSlot: BeatLabPatternSlotId;
  bpm: number;
  drumStepSubdiv: number;
  loopBars: number;
  beatsPerBar: number;
  patternPlayMode: 'single' | 'chainAB';
  kitLabel?: string;
};

export function captureBeatLabSongSnapshot(input: CaptureBeatLabSongInput): {
  kit: BeatLabSavedSong['kit'];
  sequence: BeatLabSavedSongSequence;
} {
  const slots = input.bankPatternSlots[input.bankIndex];
  return {
    kit: {
      pads: captureActiveBankKitPads(input.bankIndex),
      label: input.kitLabel,
    },
    sequence: {
      patternA: clonePattern(slots?.A ?? []),
      patternB: clonePattern(slots?.B ?? []),
      activePatternSlot: input.patternSlot,
      bpm: input.bpm,
      drumStepSubdiv: input.drumStepSubdiv,
      loopBars: input.loopBars,
      beatsPerBar: input.beatsPerBar,
      patternPlayMode: input.patternPlayMode,
    },
  };
}
