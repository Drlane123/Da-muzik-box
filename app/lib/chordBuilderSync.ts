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

/** Total length of a synced progression loop in quarter-note beats. */
export function chordSyncLoopLengthBeats(blocks: ChordSyncBlock[]): number {
  return blocks.reduce((sum, b) => sum + Math.max(0, b.durationBeats), 0);
}

/** Which chord block is active at `beat` (loops). */
export function chordBlockAtBeat(
  blocks: ChordSyncBlock[],
  beat: number,
): { index: number; startBeat: number; block: ChordSyncBlock } | null {
  const len = chordSyncLoopLengthBeats(blocks);
  if (len <= 0) return null;
  const pos = ((beat % len) + len) % len;
  let acc = 0;
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!;
    const start = acc;
    if (pos >= start && pos < start + block.durationBeats) {
      return { index: i, startBeat: start, block };
    }
    acc += block.durationBeats;
  }
  return null;
}

/** True when `beat` is on the first quarter of a chord block (within tolerance). */
export function isChordBlockDownbeat(
  blocks: ChordSyncBlock[],
  beat: number,
  epsilon = 0.02,
): boolean {
  const hit = chordBlockAtBeat(blocks, beat);
  if (!hit) return false;
  const pos = ((beat % chordSyncLoopLengthBeats(blocks)) + chordSyncLoopLengthBeats(blocks)) % chordSyncLoopLengthBeats(blocks);
  return pos - hit.startBeat < epsilon;
}
