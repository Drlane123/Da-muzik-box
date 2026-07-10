/**
 * Studio Editor 2 — dedicated Bass Glide lane (mirrors Beat Lab NEW SYNTH bass + GLIDE FX).
 */
import {
  BEAT_LAB_DEFAULT_SYNTH_PRESET_ID,
  beatLabBassSynthPresetById,
} from '@/app/lib/creationStation/beatLabMelodicSynthPresets';
import {
  beatLabBassSynthVoiceParamsFromPresetId,
  type BeatLabBassSynthVoiceParams,
} from '@/app/lib/creationStation/beatLabMelodicSynthV2State';
import type { StudioEditor2MidiTrack } from '@/app/lib/studio/studioEditor2Midi';
import { studioTrackIsDrumChannel } from '@/app/lib/studio/studioEditor2DrumPatterns';

export type Se2GlideBassTrackFields = {
  kind: 'glideBass';
  /** Synth preset id from Beat Lab bass bank. */
  glideBassPresetId?: string;
  /** Another SE2 track id — progression / chords source (instrument or rhythm). */
  glideBassHarmonyTrackId?: string;
};

export type Se2GlideBassTrack = StudioEditor2MidiTrack & Se2GlideBassTrackFields;

export function studioTrackIsGlideBassChannel(
  tr: { kind?: string } | undefined,
): tr is Se2GlideBassTrack {
  return tr?.kind === 'glideBass';
}

export function se2NormalizeGlideBassPresetId(raw: string | undefined): string {
  const id = (raw ?? '').trim();
  return beatLabBassSynthPresetById(id).id;
}

export function se2GlideBassVoiceFromTrack(
  tr: Se2GlideBassTrack,
  storedVoice: BeatLabBassSynthVoiceParams | undefined,
): BeatLabBassSynthVoiceParams {
  const presetId = se2NormalizeGlideBassPresetId(tr.glideBassPresetId);
  const base = beatLabBassSynthVoiceParamsFromPresetId(presetId);
  return storedVoice ? { ...base, ...storedVoice } : base;
}

export function se2DefaultGlideBassTrack(partial?: {
  id: string;
  name: string;
  colorHex: string;
  midiChannel?: number;
}): Se2GlideBassTrack & {
  id: string;
  name: string;
  colorHex: string;
  notes: [];
  audioClips: [];
} {
  return {
    id: partial?.id ?? 't-glide-bass',
    name: partial?.name ?? 'Bass Glide',
    colorHex: partial?.colorHex ?? '#9B6BFF',
    kind: 'glideBass',
    glideBassPresetId: BEAT_LAB_DEFAULT_SYNTH_PRESET_ID,
    glideBassHarmonyTrackId: '',
    midiChannel: partial?.midiChannel,
    notes: [],
    audioClips: [],
  };
}

export function nextGlideBassTrackName(tracks: readonly { kind?: string; name?: string }[]): string {
  const n = tracks.filter((t) => t.kind === 'glideBass').length + 1;
  return n === 1 ? 'Bass Glide' : `Bass Glide ${n}`;
}

export function se2TrackHasProgressionSteps(tr: {
  harmonySteps?: readonly unknown[];
  rhythmSteps?: readonly unknown[];
}): boolean {
  return (tr.harmonySteps?.length ?? 0) > 0 || (tr.rhythmSteps?.length ?? 0) > 0;
}

/** Instrument / rhythm lanes the user can link as a chord source (Progression+ or rhythm steps). */
export function se2GlideBassHarmonySourceCandidates<
  T extends {
    id: string;
    name: string;
    laneNumber?: number;
    kind: string;
    midiInstrumentId?: string;
    harmonySteps?: readonly unknown[];
    rhythmSteps?: readonly unknown[];
  },
>(tracks: readonly T[], glideBassTrackId: string): T[] {
  return tracks.filter((t) => {
    if (t.id === glideBassTrackId) return false;
    if (t.kind === 'glideBass' || t.kind === 'audio') return false;
    if (t.kind === 'rhythm') return true;
    if (t.kind === 'midi' && !studioTrackIsDrumChannel(t)) return true;
    return false;
  });
}

/** Lanes that already have progression / rhythm steps ready for bass + chord glide. */
export function se2GlideBassHarmonyReadyCandidates<
  T extends {
    id: string;
    harmonySteps?: readonly unknown[];
    rhythmSteps?: readonly unknown[];
  },
>(tracks: readonly T[], glideBassTrackId: string): T[] {
  return se2GlideBassHarmonySourceCandidates(tracks, glideBassTrackId).filter((t) =>
    se2TrackHasProgressionSteps(t),
  );
}
