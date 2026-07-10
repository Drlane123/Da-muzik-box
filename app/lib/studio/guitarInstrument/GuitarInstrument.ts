/**
 * Top-level six-string guitar instrument — composes matrix, hand, voicing, strum.
 * Pure structural model: no audio, no sample triggers.
 */
import { GuitarHandPosition } from '@/app/lib/studio/guitarInstrument/GuitarHandPosition';
import { GuitarStringMatrix } from '@/app/lib/studio/guitarInstrument/GuitarStringMatrix';
import {
  assignMidisToStrings,
  voiceChordOnMatrix,
  voiceSingleNoteOnMatrix,
  type VoicingEngineOpts,
} from '@/app/lib/studio/guitarInstrument/GuitarVoicingEngine';
import {
  buildStrumSchedule,
  type StrumVectorOpts,
} from '@/app/lib/studio/guitarInstrument/GuitarStrumVector';
import {
  GUITAR_STANDARD_OPEN_MIDI,
  type GuitarStrumSchedule,
  type GuitarVoicingResult,
  type StrumDirection,
} from '@/app/lib/studio/guitarInstrument/types';

export type GuitarInstrumentConfig = {
  openMidis?: readonly number[];
  handPosition?: number;
  capo?: number;
};

export class GuitarInstrument {
  readonly matrix: GuitarStringMatrix;
  readonly hand: GuitarHandPosition;
  readonly capo: number;

  constructor(config?: GuitarInstrumentConfig) {
    const openMidis = config?.openMidis ?? GUITAR_STANDARD_OPEN_MIDI;
    this.matrix = new GuitarStringMatrix(openMidis);
    this.hand = new GuitarHandPosition(config?.handPosition ?? 0);
    this.capo = config?.capo ?? 0;
  }

  private voicingOpts(): VoicingEngineOpts {
    return { capo: this.capo, openMidis: this.matrix.snapshot().map((s) => s.openMidi) };
  }

  /** Single MIDI note → one string, monophonic kill on that string. */
  triggerNote(midi: number): GuitarVoicingResult {
    return voiceSingleNoteOnMatrix(this.matrix, this.hand, midi, this.voicingOpts());
  }

  /** Chord — simultaneous midis parsed into unique string assignments. */
  triggerChord(midis: readonly number[]): GuitarVoicingResult {
    return voiceChordOnMatrix(this.matrix, this.hand, midis, this.voicingOpts());
  }

  /**
   * Strum chord — voicing + right-hand sequential strike vector.
   * Returns structural schedule only (offsetMs per string).
   */
  triggerStrum(
    midis: readonly number[],
    direction: StrumDirection,
    originMs: number,
    strumOpts?: StrumVectorOpts,
  ): { voicing: GuitarVoicingResult; strum: GuitarStrumSchedule } {
    const voicing = this.triggerChord(midis);
    const strum = buildStrumSchedule(voicing.placements, direction, originMs, strumOpts);
    return { voicing, strum };
  }

  /** Preview voicing without mutating matrix (assignment loop only). */
  previewVoicing(midis: readonly number[]): GuitarVoicingResult['placements'] {
    const { placements } = assignMidisToStrings(midis, this.hand, this.voicingOpts());
    return placements;
  }

  setHandPosition(fret: number): void {
    this.hand.setHandPosition(fret);
  }

  killAll(): void {
    this.matrix.killAll();
  }

  reset(): void {
    this.matrix.reset();
    this.hand.setHandPosition(0);
  }
}
