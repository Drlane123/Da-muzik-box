/**
 * Neural Hum → Studio Editor 2 / standard MIDI file export.
 * MIDI is the editable path; WAV is optional preview alongside import.
 */
import {
  buildStandardMidiFile,
  downloadBytes,
  safeFilename,
  type MidiNoteEvent,
} from '@/app/lib/creationStation/midiExport';
import type { TimedMonophonicNote } from '@/app/lib/studio/audioToMidiNotes';

export type NeuralHumStudioMidiNote = {
  pitch: number;
  startBeat: number;
  durationBeats: number;
  velocity: number;
};

/** Payload passed from Vocal Lab → app → Studio Editor 2. */
export type PendingNeuralHumStudioImport = {
  notes: NeuralHumStudioMidiNote[];
  /** Optional rendered instrument WAV (reference clip on audio track). */
  wavBlob?: Blob | null;
  trackName?: string;
};

const SMF_PPQ = 480;

export function timedNotesToStudioMidiNotes(
  notes: readonly TimedMonophonicNote[],
  bpm: number,
  transposeSemis = 0,
): NeuralHumStudioMidiNote[] {
  const b = Math.max(30, Math.min(300, bpm));
  const spb = 60 / b;
  return notes.map((n) => ({
    pitch: Math.max(0, Math.min(127, Math.round(n.pitch + transposeSemis))),
    startBeat: Math.max(0, n.startSec / spb),
    durationBeats: Math.max(1 / 128, n.durationSec / spb),
    velocity: Math.max(1, Math.min(127, Math.round(n.velocity))),
  }));
}

export function studioMidiNotesToSmfEvents(
  notes: readonly NeuralHumStudioMidiNote[],
  bpm: number,
): MidiNoteEvent[] {
  const b = Math.max(30, Math.min(300, bpm));
  const spb = 60 / b;
  return notes.map((n) => ({
    midi: n.pitch,
    startTick: Math.max(0, Math.round(n.startBeat * SMF_PPQ)),
    durationTicks: Math.max(1, Math.round(n.durationBeats * SMF_PPQ)),
    velocity: n.velocity,
  }));
}

export function downloadNeuralHumMidiFile(
  notes: readonly TimedMonophonicNote[],
  bpm: number,
  instrumentLabel: string,
  transposeSemis = 0,
): void {
  const studioNotes = timedNotesToStudioMidiNotes(notes, bpm, transposeSemis);
  const smf = buildStandardMidiFile({
    notes: studioMidiNotesToSmfEvents(studioNotes, bpm),
    bpm,
    ticksPerQuarter: SMF_PPQ,
    trackName: `Neural Hum · ${instrumentLabel}`,
  });
  const base = safeFilename(instrumentLabel, 'neural-hum');
  downloadBytes(smf, `neural-hum-${base.toLowerCase().replace(/\s+/g, '-')}.mid`, 'audio/midi');
}
