/**
 * Studio Editor 2 — dedicated Guitar MIDI lane (smplr sampled guitars).
 */
import type { StudioEditor2MidiTrack } from '@/app/lib/studio/studioEditor2Midi';
import {
  SE2_GUITAR_DEFAULT_INSTRUMENT,
  se2GuitarInstrumentLabel,
  se2SanitizeGuitarInstrumentId,
  type Se2GuitarInstrumentId,
} from '@/app/lib/studio/se2GuitarInstruments';

export const SE2_GUITAR_ACCENT = '#E8A040';

export type Se2GuitarMockNote = {
  pitch: number;
  startBeat: number;
  durationBeats: number;
  velocity: number;
};

export type Se2GuitarTrackFields = {
  kind: 'guitar';
  guitarInstrumentId?: Se2GuitarInstrumentId;
  /** Semitone offset applied to piano-roll notes + preview. */
  guitarTranspose?: number;
  /** Inline channel FX 0–100 — drive, chorus, reverb. */
  guitarFxDrive?: number;
  guitarFxChorus?: number;
  guitarFxReverb?: number;
  guitarFxTone?: number;
  guitarFxComp?: number;
};

export type Se2GuitarTrack = StudioEditor2MidiTrack & Se2GuitarTrackFields;

export function studioTrackIsGuitarChannel(tr: { kind?: string } | undefined): tr is Se2GuitarTrack {
  return tr?.kind === 'guitar';
}

export function nextGuitarTrackName(tracks: readonly { kind?: string; name?: string }[]): string {
  const n = tracks.filter((t) => t.kind === 'guitar').length + 1;
  return n === 1 ? 'Guitar' : `Guitar ${n}`;
}

export function se2DefaultGuitarTrackFields(): Se2GuitarTrackFields {
  return {
    kind: 'guitar',
    guitarInstrumentId: SE2_GUITAR_DEFAULT_INSTRUMENT,
    guitarTranspose: 0,
    guitarFxDrive: 0,
    guitarFxChorus: 22,
    guitarFxReverb: 18,
    guitarFxTone: 55,
    guitarFxComp: 42,
  };
}

export function se2GuitarInstrumentLabelFromTrack(tr: Se2GuitarTrack): string {
  return se2GuitarInstrumentLabel(se2SanitizeGuitarInstrumentId(tr.guitarInstrumentId));
}

/** Guitar-friendly piano roll — low E string through high E (E2–E5). */
export const SE2_GUITAR_PITCH_LO = 40;
export const SE2_GUITAR_PITCH_HI = 76;

export function se2GuitarEmptyPitchRange(): { min: number; max: number } {
  return { min: SE2_GUITAR_PITCH_LO, max: SE2_GUITAR_PITCH_HI };
}

export function se2GuitarPitchSpanNotes(): {
  pitch: number;
  startBeat: number;
  durationBeats: number;
  velocity: number;
}[] {
  const out: { pitch: number; startBeat: number; durationBeats: number; velocity: number }[] = [];
  for (let p = SE2_GUITAR_PITCH_LO; p <= SE2_GUITAR_PITCH_HI; p += 1) {
    out.push({ pitch: p, startBeat: 0, durationBeats: 0.25, velocity: 1 });
  }
  return out;
}
