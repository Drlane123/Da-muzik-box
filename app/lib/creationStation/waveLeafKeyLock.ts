/**
 * Key lock from imported chord stacks — Melody Sauce 3 detects key from MIDI chords.
 */
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import { GROOVE_LAB_CHORD_HARMONY_MIDI_MIN } from '@/app/lib/creationStation/grooveLabPitch';
import type { GrooveRollHit } from '@/app/lib/creationStation/grooveLabRoll';

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];

function triadPcsForDegree(keyRoot: number, degreeIndex: number, mode: ChordMode): number[] {
  const scale = mode === 'minor' ? MINOR_SCALE : MAJOR_SCALE;
  const r = (keyRoot + scale[degreeIndex % 7]!) % 12;
  const t = (keyRoot + scale[(degreeIndex + 2) % 7]!) % 12;
  const f = (keyRoot + scale[(degreeIndex + 4) % 7]!) % 12;
  return [r, t, f];
}

function columnScoreAgainstKey(pcs: Set<number>, keyRoot: number, mode: ChordMode): number {
  let best = 0;
  for (let d = 0; d < 7; d += 1) {
    const triad = triadPcsForDegree(keyRoot, d, mode);
    let overlap = 0;
    for (const pc of triad) {
      if (pcs.has(pc)) overlap += 1;
    }
    if (overlap > best) best = overlap;
  }
  return best;
}

/**
 * Vote key + mode from green chord stacks (MS3-style key lock on import).
 * Falls back to UI key when stacks are sparse or ambiguous.
 */
export function inferWaveLeafKeyFromChordHits(
  chordHits: readonly GrooveRollHit[],
  fallbackKey: number,
  fallbackMode: ChordMode,
): { keyRoot: number; mode: ChordMode } {
  const bySlot = new Map<number, Set<number>>();
  for (const h of chordHits) {
    if (h.midi < GROOVE_LAB_CHORD_HARMONY_MIDI_MIN) continue;
    const pc = ((Math.round(h.midi) % 12) + 12) % 12;
    const set = bySlot.get(h.slot) ?? new Set<number>();
    set.add(pc);
    bySlot.set(h.slot, set);
  }
  if (bySlot.size === 0) {
    return { keyRoot: ((fallbackKey % 12) + 12) % 12, mode: fallbackMode };
  }

  let bestKey = ((fallbackKey % 12) + 12) % 12;
  let bestMode: ChordMode = fallbackMode;
  let bestScore = -1;

  for (const mode of ['major', 'minor'] as const) {
    for (let keyRoot = 0; keyRoot < 12; keyRoot += 1) {
      let score = 0;
      for (const pcs of bySlot.values()) {
        score += columnScoreAgainstKey(pcs, keyRoot, mode);
      }
      if (score > bestScore) {
        bestScore = score;
        bestKey = keyRoot;
        bestMode = mode;
      }
    }
  }

  const fbKey = ((fallbackKey % 12) + 12) % 12;
  const fbScore = [...bySlot.values()].reduce(
    (s, pcs) => s + columnScoreAgainstKey(pcs, fbKey, fallbackMode),
    0,
  );
  if (bestScore < fbScore + 1) {
    return { keyRoot: fbKey, mode: fallbackMode };
  }
  return { keyRoot: bestKey, mode: bestMode };
}
