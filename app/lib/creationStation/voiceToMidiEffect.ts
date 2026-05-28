/**
 * Built-in voice → MIDI (Dubler-style): monophonic pitch track + live note output.
 * Uses mic + ACF pitch detection — no external hardware or Web MIDI.
 */
import { frequencyToMidiNote, type PitchEvent } from '@/app/lib/pitchDetection';

export const VOICE_MIDI_MIN_CONFIDENCE = 0.16;
/** Min time between triggered notes (avoids retrigger chatter). */
export const VOICE_MIDI_MIN_NOTE_GAP_MS = 55;

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export function midiNoteLabel(midi: number): string {
  const m = Math.max(0, Math.min(127, Math.round(midi)));
  return `${NOTE_NAMES[m % 12]!}${Math.floor(m / 12) - 1}`;
}

/**
 * Returns a new stable MIDI note when pitch moves by ≥1 semitone; null if below confidence.
 */
export function voiceMidiNoteFromFrequency(
  frequency: number,
  confidence: number,
  prevMidi: number | null,
  minConfidence = VOICE_MIDI_MIN_CONFIDENCE,
): { midi: number; changed: boolean } | null {
  if (confidence < minConfidence || frequency <= 0) return null;
  const midi = frequencyToMidiNote(frequency);
  if (prevMidi == null) return { midi, changed: true };
  if (Math.abs(midi - prevMidi) >= 1) return { midi, changed: true };
  return { midi, changed: false };
}

export function voiceMidiPitchEvent(timeMs: number, midi: number, velocity: number): PitchEvent {
  const semitones = midi - 69;
  const frequency = 440 * Math.pow(2, semitones / 12);
  return {
    time: timeMs,
    frequency,
    confidence: Math.max(0.5, velocity / 127),
    velocity,
  };
}

/**
 * ScriptProcessor must stay in the audio graph; route through a zero-gain node so the
 * mic monitor does not feed back into the input while pitch analysis runs.
 */
export function connectScriptProcessorSilentMonitor(
  ctx: BaseAudioContext,
  sourceNode: AudioNode,
  processor: ScriptProcessorNode,
): GainNode {
  const sink = ctx.createGain();
  sink.gain.value = 0;
  sourceNode.connect(processor);
  processor.connect(sink);
  sink.connect(ctx.destination);
  return sink;
}
