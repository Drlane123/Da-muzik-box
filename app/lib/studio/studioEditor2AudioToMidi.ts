/**
 * Studio Editor 2 — clip-level Audio → MIDI (not full-song stem separation).
 */

import {
  audioBufferToBassMidiNotes,
  audioBufferToMonophonicMidiNotes,
  audioBufferToPercussiveMidiNotes,
  type AudioToMidiNote,
} from '@/app/lib/studio/audioToMidiNotes';
import { studioDefaultMidiInstrumentForTrackName } from '@/app/lib/studio/studioEditor2Instruments';

export type StudioA2mMode = 'melodic' | 'bass' | 'drums';

export const STUDIO_A2M_MODE_LABELS: Record<StudioA2mMode, string> = {
  melodic: 'Melodic',
  bass: 'Bass line',
  drums: 'Drums',
};

export const STUDIO_A2M_MODE_ORDER: StudioA2mMode[] = ['melodic', 'bass', 'drums'];

export const STUDIO_A2M_DEFAULT_MODE: StudioA2mMode = 'melodic';

export function studioNormalizeA2mMode(raw: string | undefined): StudioA2mMode {
  if (raw === 'bass' || raw === 'drums' || raw === 'melodic') return raw;
  return STUDIO_A2M_DEFAULT_MODE;
}

export function studioDefaultInstrumentForA2mMode(mode: StudioA2mMode): string {
  if (mode === 'drums') return studioDefaultMidiInstrumentForTrackName('Drums');
  if (mode === 'bass') return studioDefaultMidiInstrumentForTrackName('Bass');
  return studioDefaultMidiInstrumentForTrackName('Instrument');
}

/** Convert one decoded audio clip to beat-quantized MIDI notes (local clip time = beat 0). */
export function studioConvertAudioBufferToMidiNotes(
  buffer: AudioBuffer,
  bpm: number,
  mode: StudioA2mMode,
): AudioToMidiNote[] {
  if (mode === 'drums') return audioBufferToPercussiveMidiNotes(buffer, bpm);
  if (mode === 'bass') return audioBufferToBassMidiNotes(buffer, bpm);
  return audioBufferToMonophonicMidiNotes(buffer, bpm);
}

export type StudioClipMidiNote = {
  pitch: number;
  startBeat: number;
  durationBeats: number;
  velocity: number;
};

/** Replace MIDI in a clip's timeline span, offset new notes by clip start. */
export function studioMergeClipMidiNotes(
  existing: StudioClipMidiNote[],
  clipStartBeat: number,
  clipDurationBeats: number,
  clipLocalNotes: StudioClipMidiNote[],
): StudioClipMidiNote[] {
  const clipEnd = clipStartBeat + clipDurationBeats;
  const kept = existing.filter(
    (n) => n.startBeat + n.durationBeats <= clipStartBeat + 1e-6 || n.startBeat >= clipEnd - 1e-6,
  );
  const offset = clipLocalNotes.map((n) => ({
    ...n,
    startBeat: n.startBeat + clipStartBeat,
  }));
  const merged = [...kept, ...offset];
  merged.sort((a, b) => (a.startBeat !== b.startBeat ? a.startBeat - b.startBeat : a.pitch - b.pitch));
  return merged;
}

/** Map note beats analyzed at `detectedBpm` onto the project tempo grid. */
export function studioMapA2mNotesToProjectBpm(
  notes: AudioToMidiNote[],
  detectedBpm: number,
  projectBpm: number,
): AudioToMidiNote[] {
  const proj = Math.max(30, Math.min(300, projectBpm));
  const det = Math.max(30, Math.min(300, detectedBpm));
  const ratio = det / proj;
  if (Math.abs(ratio - 1) < 0.008) return notes;
  return notes.map((n) => ({
    ...n,
    startBeat: n.startBeat * ratio,
    durationBeats: n.durationBeats * ratio,
  }));
}

export function studioClampMidiNotesToTimeline(
  notes: StudioClipMidiNote[],
  totalBeats: number,
): StudioClipMidiNote[] {
  return notes
    .map((n) => {
      const startBeat = Math.max(0, Math.min(totalBeats - 1 / 128, n.startBeat));
      const durationBeats = Math.max(1 / 128, Math.min(totalBeats - startBeat, n.durationBeats));
      return { ...n, startBeat, durationBeats };
    })
    .filter((n) => n.durationBeats >= 1 / 64);
}
