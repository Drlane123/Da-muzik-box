/**
 * SE2 piano-roll pitch range for 808 Lab — C1–C6 (matches Creation Station 808 roll).
 */
import { EIGHT_ZERO_EIGHT_KICK_ROOT_MIDI } from '@/app/lib/creationStation/eightZeroEightVoice';

export type Se2MockMidiNote = {
  pitch: number;
  startBeat: number;
  durationBeats: number;
  velocity: number;
};

/** 808 Lab register — C1 root through C6. */
export const SE2_LAB808_PITCH_LO = EIGHT_ZERO_EIGHT_KICK_ROOT_MIDI;
export const SE2_LAB808_PITCH_HI = 84;

export function se2Lab808EmptyPitchRange(): { min: number; max: number } {
  return { min: SE2_LAB808_PITCH_LO, max: SE2_LAB808_PITCH_HI };
}

export function se2Lab808PitchSpanNotes(): Se2MockMidiNote[] {
  const { min, max } = se2Lab808EmptyPitchRange();
  return [
    { pitch: min, startBeat: 0, durationBeats: 1, velocity: 100 },
    { pitch: max, startBeat: 0, durationBeats: 1, velocity: 100 },
  ];
}

export function se2Lab808PitchRangeForNotes(
  notes: readonly { pitch: number }[],
): { min: number; max: number } {
  const base = se2Lab808EmptyPitchRange();
  if (notes.length === 0) return base;
  const lo = Math.min(...notes.map((n) => Math.round(n.pitch)));
  const hi = Math.max(...notes.map((n) => Math.round(n.pitch)));
  return {
    min: Math.max(SE2_LAB808_PITCH_LO, Math.min(base.min, lo - 2)),
    max: Math.min(SE2_LAB808_PITCH_HI, Math.max(base.max, hi + 2)),
  };
}
