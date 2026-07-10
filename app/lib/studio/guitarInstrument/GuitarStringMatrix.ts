/**
 * Six-string matrix — exactly six independent monophonic string objects.
 */
import { GuitarString } from '@/app/lib/studio/guitarInstrument/GuitarString';
import {
  GUITAR_STANDARD_OPEN_MIDI,
  GUITAR_STRING_COUNT,
  stringIndexToNumber,
  type GuitarStringPlacement,
  type GuitarStringTransition,
} from '@/app/lib/studio/guitarInstrument/types';

export class GuitarStringMatrix {
  private readonly strings: GuitarString[];

  constructor(openMidis: readonly number[] = GUITAR_STANDARD_OPEN_MIDI) {
    if (openMidis.length !== GUITAR_STRING_COUNT) {
      throw new Error(`GuitarStringMatrix requires exactly ${GUITAR_STRING_COUNT} tuning pitches`);
    }
    this.strings = openMidis.map((openMidi, stringIndex) => new GuitarString(stringIndex, openMidi));
  }

  getString(stringIndex: number): GuitarString {
    const s = this.strings[stringIndex];
    if (!s) throw new RangeError(`Invalid stringIndex ${stringIndex}`);
    return s;
  }

  /** Snapshot of all six string states. */
  snapshot(): ReturnType<GuitarString['state']>[] {
    return this.strings.map((s) => s.state);
  }

  /**
   * Apply one placement. Enforces per-string monophony via kill-then-assign.
   * Returns transition metadata for the affected string only.
   */
  applyPlacement(placement: GuitarStringPlacement, capo = 0): GuitarStringTransition {
    return this.getString(placement.stringIndex).assignFret(placement.fret, capo);
  }

  /** Apply a full voicing (chord). Each string receives at most one fret. */
  applyVoicing(placements: readonly GuitarStringPlacement[], capo = 0): GuitarStringTransition[] {
    const out: GuitarStringTransition[] = [];
    for (const p of placements) {
      out.push(this.applyPlacement(p, capo));
    }
    return out;
  }

  killString(stringIndex: number): GuitarStringTransition | null {
    return this.getString(stringIndex).kill();
  }

  killAll(): GuitarStringTransition[] {
    const out: GuitarStringTransition[] = [];
    for (let i = 0; i < GUITAR_STRING_COUNT; i += 1) {
      const t = this.killString(i);
      if (t) out.push(t);
    }
    return out;
  }

  reset(): void {
    for (const s of this.strings) s.reset();
  }

  /** Which strings are currently sounding. */
  activePlacements(capo = 0): GuitarStringPlacement[] {
    const out: GuitarStringPlacement[] = [];
    for (const s of this.strings) {
      const fret = s.state.activeFret;
      if (fret == null) continue;
      out.push({
        stringIndex: s.stringIndex,
        stringNumber: stringIndexToNumber(s.stringIndex),
        fret,
        midi: s.openMidi + fret + capo,
      });
    }
    return out;
  }
}
