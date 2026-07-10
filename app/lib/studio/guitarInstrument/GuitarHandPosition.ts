/**
 * Left-hand engine — capo / hand position on the neck (0–19).
 */
import {
  GUITAR_MAX_FRET,
  GUITAR_MAX_HAND_POSITION,
  GUITAR_MIN_HAND_POSITION,
  GUITAR_STANDARD_OPEN_MIDI,
  GUITAR_STRING_COUNT,
} from '@/app/lib/studio/guitarInstrument/types';

/** Frets covered by four fingers under the current hand anchor (inclusive). */
export const GUITAR_HAND_SPAN_FRETS = 4;

export type GuitarHandPositionState = {
  /** Virtual capo / left-hand anchor fret (0 = nut). */
  handPosition: number;
  /** Usable fret window [lo, hi] for finger assignments. */
  windowLo: number;
  windowHi: number;
};

export class GuitarHandPosition {
  private handPosition: number;

  constructor(initial = 0) {
    this.handPosition = clampHandPosition(initial);
  }

  get value(): number {
    return this.handPosition;
  }

  get state(): GuitarHandPositionState {
    return {
      handPosition: this.handPosition,
      windowLo: this.handPosition,
      windowHi: Math.min(GUITAR_MAX_FRET, this.handPosition + GUITAR_HAND_SPAN_FRETS),
    };
  }

  setHandPosition(fret: number): void {
    this.handPosition = clampHandPosition(fret);
  }

  /** Shift hand to cover a target fret with minimal movement. */
  moveToCoverFret(targetFret: number): void {
    const f = Math.max(0, Math.min(GUITAR_MAX_FRET, targetFret));
    const { windowLo, windowHi } = this.state;
    if (f >= windowLo && f <= windowHi) return;

    if (f < windowLo) {
      this.handPosition = f;
      return;
    }

    this.handPosition = Math.max(
      GUITAR_MIN_HAND_POSITION,
      f - GUITAR_HAND_SPAN_FRETS,
    );
  }

  isFretInWindow(fret: number): boolean {
    const { windowLo, windowHi } = this.state;
    return fret >= windowLo && fret <= windowHi;
  }
}

export function clampHandPosition(fret: number): number {
  return Math.max(GUITAR_MIN_HAND_POSITION, Math.min(GUITAR_MAX_HAND_POSITION, Math.round(fret)));
}

/** All legal (stringIndex, fret) pairs — strict fret = midi - openMidi. */
export function enumerateStringFretCandidates(
  midi: number,
  _hand: GuitarHandPosition,
  openMidis: readonly number[] = GUITAR_STANDARD_OPEN_MIDI,
  _capo = 0,
): { stringIndex: number; fret: number }[] {
  const out: { stringIndex: number; fret: number }[] = [];

  for (let stringIndex = GUITAR_STRING_COUNT - 1; stringIndex >= 0; stringIndex -= 1) {
    const open = openMidis[stringIndex];
    if (open == null) continue;
    const fret = midi - open;
    if (fret < 0 || fret > GUITAR_MAX_FRET) continue;
    out.push({ stringIndex, fret });
  }

  return out;
}
