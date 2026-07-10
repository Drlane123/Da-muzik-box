/**
 * Single guitar string — monophonic fret state machine.
 */
import {
  GUITAR_MAX_FRET,
  type GuitarStringTransition,
} from '@/app/lib/studio/guitarInstrument/types';

export type GuitarStringState = {
  stringIndex: number;
  openMidi: number;
  activeFret: number | null;
  activeMidi: number | null;
};

export class GuitarString {
  readonly stringIndex: number;
  readonly openMidi: number;

  private activeFret: number | null = null;

  constructor(stringIndex: number, openMidi: number) {
    this.stringIndex = stringIndex;
    this.openMidi = openMidi;
  }

  get state(): GuitarStringState {
    return {
      stringIndex: this.stringIndex,
      openMidi: this.openMidi,
      activeFret: this.activeFret,
      activeMidi: this.activeFret == null ? null : this.openMidi + this.activeFret,
    };
  }

  isActive(): boolean {
    return this.activeFret != null;
  }

  /** MIDI pitch currently held on this string (null if open / silent). */
  currentMidi(): number | null {
    if (this.activeFret == null) return null;
    return this.openMidi + this.activeFret;
  }

  /**
   * Assign a new fret. Kills any previous fret on this string (monophony).
   * `capo` shifts the effective nut without changing stored fret integer.
   */
  assignFret(fret: number, capo = 0): GuitarStringTransition {
    const clamped = Math.max(0, Math.min(GUITAR_MAX_FRET, Math.round(fret)));
    const previousFret = this.activeFret;
    this.activeFret = clamped;
    return {
      stringIndex: this.stringIndex,
      previousFret,
      nextFret: clamped,
      midi: this.openMidi + clamped + capo,
    };
  }

  /** Clear sustain — string returns to silent. */
  kill(): GuitarStringTransition | null {
    if (this.activeFret == null) return null;
    const prev = this.activeFret;
    this.activeFret = null;
    return {
      stringIndex: this.stringIndex,
      previousFret: prev,
      nextFret: -1,
      midi: -1,
    };
  }

  reset(): void {
    this.activeFret = null;
  }
}
