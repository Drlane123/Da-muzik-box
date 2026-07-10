/**
 * SE2 piano-roll notes ↔ Hum Capture melody roll.
 */
import {
  NEURAL_HUM_QUANTIZE_DEFAULT,
  NEURAL_HUM_ROLL_SLOTS_PER_BAR,
  enforceMonophonicRollNotes,
  newNeuralHumRollNoteId,
  rollNotesToTimed,
  timedNotesToRollNotes,
  type NeuralHumRollBarCount,
  type NeuralHumRollNote,
  type NeuralHumRollQuantize,
} from '@/app/lib/vocalLab/neuralHumMelodyRoll';
import { timedNotesToStudioMidiNotes } from '@/app/lib/vocalLab/neuralHumStudioExport';

export type Se2HumCaptureMockNote = {
  pitch: number;
  startBeat: number;
  durationBeats: number;
  velocity: number;
};

/** Hum Capture lead register — C4–C6. */
export const SE2_HUM_CAPTURE_PITCH_DEFAULT_LO = 60;
export const SE2_HUM_CAPTURE_PITCH_DEFAULT_HI = 84;

export function se2HumCaptureEmptyPitchRange(): { min: number; max: number } {
  return { min: SE2_HUM_CAPTURE_PITCH_DEFAULT_LO, max: SE2_HUM_CAPTURE_PITCH_DEFAULT_HI };
}

export function se2HumCapturePitchSpanNotes(): Se2HumCaptureMockNote[] {
  const { min, max } = se2HumCaptureEmptyPitchRange();
  return [
    { pitch: min, startBeat: 0, durationBeats: 1, velocity: 100 },
    { pitch: max, startBeat: 0, durationBeats: 1, velocity: 100 },
  ];
}

export function se2MockNotesToHumRollNotes(
  notes: readonly Se2HumCaptureMockNote[],
  bpm: number,
  _beatsPerBar: number,
  bars: NeuralHumRollBarCount,
  quantize: NeuralHumRollQuantize = NEURAL_HUM_QUANTIZE_DEFAULT,
): NeuralHumRollNote[] {
  if (notes.length === 0) return [];
  const secPerBeat = 60 / Math.max(30, Math.min(300, bpm));
  const timed = notes.map((n) => ({
    pitch: n.pitch,
    startSec: n.startBeat * secPerBeat,
    durationSec: Math.max(secPerBeat / NEURAL_HUM_ROLL_SLOTS_PER_BAR, n.durationBeats * secPerBeat),
    velocity: n.velocity,
  }));
  return timedNotesToRollNotes(timed, bpm, bars, quantize);
}

export function se2HumRollNotesToMockNotes(
  rollNotes: readonly NeuralHumRollNote[],
  bpm: number,
  transposeSemis = 0,
): Se2HumCaptureMockNote[] {
  if (rollNotes.length === 0) return [];
  const timed = rollNotesToTimed(rollNotes, bpm);
  return timedNotesToStudioMidiNotes(timed, bpm, transposeSemis);
}

/** Seed roll from lane notes when the panel opens (preserves ids when possible). */
export function se2HumCaptureSeedRollNotes(
  notes: readonly Se2HumCaptureMockNote[],
  bpm: number,
  beatsPerBar: number,
  bars: NeuralHumRollBarCount,
  quantize: NeuralHumRollQuantize,
): NeuralHumRollNote[] {
  const mapped = se2MockNotesToHumRollNotes(notes, bpm, beatsPerBar, bars, quantize);
  return enforceMonophonicRollNotes(
    mapped.map((n) => ({ ...n, id: n.id || newNeuralHumRollNoteId() })),
  );
}
