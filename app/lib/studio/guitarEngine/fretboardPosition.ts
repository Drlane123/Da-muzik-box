/**
 * Automatic fretboard position logic — minimizes hand shifts (guitarist realism).
 */
import { SE2_GUITAR_OPEN_STRING_MIDI } from '@/app/lib/studio/se2GuitarFretboard';
import type { GuitarNeckPosition, GuitarSampleZone } from '@/app/lib/studio/guitarEngine/types';

export const GUITAR_NECK_POSITIONS: readonly GuitarNeckPosition[] = [
  { id: 'pos_open', fretLo: 0, fretHi: 4, label: 'Open' },
  { id: 'pos_5th', fretLo: 3, fretHi: 8, label: '5th pos' },
  { id: 'pos_7th', fretLo: 5, fretHi: 10, label: '7th pos' },
  { id: 'pos_9th', fretLo: 7, fretHi: 12, label: '9th pos' },
  { id: 'pos_mid', fretLo: 0, fretHi: 12, label: 'Mid neck' },
] as const;

export type GuitarPositionState = {
  activePositionId: string;
  lastMidi: number | null;
};

export function createGuitarPositionState(): GuitarPositionState {
  return { activePositionId: 'pos_mid', lastMidi: null };
}

/** Best fret for a MIDI note on a given string (open-string tuning). */
export function guitarMidiToFretOnString(midi: number, stringIndex: number): number {
  const open = SE2_GUITAR_OPEN_STRING_MIDI[stringIndex] ?? 40;
  return midi - open;
}

/** Pick lowest-fret playable position across strings. */
export function guitarPreferredFretForMidi(midi: number): { stringIndex: number; fret: number } {
  let best = { stringIndex: 0, fret: 99 };
  for (let s = 0; s < SE2_GUITAR_OPEN_STRING_MIDI.length; s += 1) {
    const fret = guitarMidiToFretOnString(midi, s);
    if (fret >= 0 && fret <= 12 && fret < best.fret) {
      best = { stringIndex: s, fret };
    }
  }
  if (best.fret === 99) return { stringIndex: 0, fret: 0 };
  return best;
}

/**
 * Shift position when the next note would fall outside the current span.
 * Emulates a guitarist sliding the hand up/down the neck.
 */
export function guitarUpdateNeckPosition(
  state: GuitarPositionState,
  midi: number,
): GuitarNeckPosition {
  const { fret } = guitarPreferredFretForMidi(midi);
  const current = GUITAR_NECK_POSITIONS.find((p) => p.id === state.activePositionId)
    ?? GUITAR_NECK_POSITIONS.find((p) => p.id === 'pos_mid')!;

  if (fret >= current.fretLo && fret <= current.fretHi) {
    state.lastMidi = midi;
    return current;
  }

  let bestPos = current;
  let bestCost = Infinity;
  for (const pos of GUITAR_NECK_POSITIONS) {
    if (fret < pos.fretLo || fret > pos.fretHi) continue;
    const shiftCost = Math.abs(pos.fretLo - current.fretLo);
    if (shiftCost < bestCost) {
      bestCost = shiftCost;
      bestPos = pos;
    }
  }

  state.activePositionId = bestPos.id;
  state.lastMidi = midi;
  return bestPos;
}

/** Prefer zones whose root fret falls inside the active position span. */
export function guitarFilterZonesByPosition(
  zones: readonly GuitarSampleZone[],
  position: GuitarNeckPosition,
): GuitarSampleZone[] {
  const matched = zones.filter(
    (z) => z.fretAtRoot >= position.fretLo && z.fretAtRoot <= position.fretHi,
  );
  return matched.length ? matched : [...zones];
}
