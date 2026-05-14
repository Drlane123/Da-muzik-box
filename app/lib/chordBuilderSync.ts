/**
 * Chord Builder → Bass Station sync.
 *
 * ChordBuilderTab writes its live key / mode / progression to
 * localStorage under `DA_CHORD_SYNC_KEY` whenever those values change.
 * BassStationScreen reads this on mount and before generating, so the
 * bassline is always in the same key as what the user built in Chord
 * Builder — and when "Follow Chords" is on, each bass note follows the
 * root of the chord that's active at that moment in the progression.
 */

export const DA_CHORD_SYNC_KEY = 'da_chord_builder_sync_v1';

/** One chord block from the active Chord Builder progression. */
export interface ChordSyncBlock {
  /** Roman-numeral chord symbol, e.g. "I", "IVmaj7", "V7". */
  chord: string;
  /** Duration in beats (quarter notes). */
  durationBeats: number;
}

/** Full snapshot written by ChordBuilderTab. */
export interface ChordBuilderSyncData {
  /** 0–11, C = 0. */
  keyRoot: number;
  /** 'major' | 'minor' (or any ChordMode string). */
  mode: string;
  /** Ordered list of chord blocks in the active progression. */
  blocks: ChordSyncBlock[];
  /** Display name of the active progression (e.g. "Verse"). */
  progressionName: string;
  /** BPM at time of write. */
  bpm: number;
}

export function writeChordSync(data: ChordBuilderSyncData): void {
  try {
    localStorage.setItem(DA_CHORD_SYNC_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage errors (private browsing, quota, etc.)
  }
}

export function readChordSync(): ChordBuilderSyncData | null {
  try {
    const raw = localStorage.getItem(DA_CHORD_SYNC_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ChordBuilderSyncData>;
    if (
      typeof parsed.keyRoot !== 'number' ||
      typeof parsed.mode !== 'string' ||
      !Array.isArray(parsed.blocks)
    ) return null;
    return parsed as ChordBuilderSyncData;
  } catch {
    return null;
  }
}
