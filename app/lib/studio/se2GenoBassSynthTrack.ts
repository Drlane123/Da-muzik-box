/**
 * Studio Editor 2 — Geno Bass Synth dedicated lane (classic synth bass).
 */
import { genoBassPresetById, genoBassSanitizePresetId } from '@/app/lib/studio/genoBassSynthPresets';
import { genoBassPlaybackVoice } from '@/app/lib/studio/genoBassMixReadyVoice';
import type { GenoUltraSynthVoiceParams } from '@/app/lib/studio/genoUltraSynthTypes';
import type { StudioEditor2MidiTrack } from '@/app/lib/studio/studioEditor2Midi';

/** Beat Pads–style warm tan lane accent. */
export const SE2_GENO_BASS_SYNTH_ACCENT = '#c9a86a';

export type Se2GenoBassSynthTrackFields = {
  kind: 'genoBassSynth';
  genoBassPresetId?: string;
  genoBassPatchLabel?: string;
};

export type Se2GenoBassSynthTrack = StudioEditor2MidiTrack & Se2GenoBassSynthTrackFields;

export function studioTrackIsGenoBassSynthChannel(
  tr: { kind?: string } | undefined,
): tr is Se2GenoBassSynthTrack {
  return tr?.kind === 'genoBassSynth';
}

export function se2GenoBassVoiceFromTrack(
  tr: Se2GenoBassSynthTrack,
  storedVoice: GenoUltraSynthVoiceParams | undefined,
): GenoUltraSynthVoiceParams {
  const presetId = genoBassSanitizePresetId(tr.genoBassPresetId);
  const base = genoBassPresetById(presetId);
  const label = tr.genoBassPatchLabel?.trim() || base.label;
  if (!storedVoice) {
    return genoBassPlaybackVoice({ ...base, label }, base.bassGroup);
  }
  const merged: GenoUltraSynthVoiceParams = {
    ...base,
    ...storedVoice,
    label: storedVoice.label || label,
    modSlots: storedVoice.modSlots?.length
      ? storedVoice.modSlots.map((s) => ({ ...s }))
      : base.modSlots.map((s) => ({ ...s })),
    fx: { ...base.fx, ...storedVoice.fx },
    osc1: { ...base.osc1, ...storedVoice.osc1 },
    osc2: { ...base.osc2, ...storedVoice.osc2 },
    osc3: { ...base.osc3, ...storedVoice.osc3 },
  };
  return genoBassPlaybackVoice(merged, base.bassGroup);
}

export function se2GenoBassPatchLabelFromTrack(tr: Se2GenoBassSynthTrack): string {
  return tr.genoBassPatchLabel?.trim() || se2GenoBassVoiceFromTrack(tr, undefined).label;
}

export function nextGenoBassSynthTrackName(tracks: readonly { kind?: string; name?: string }[]): string {
  const n = tracks.filter((t) => t.kind === 'genoBassSynth').length + 1;
  return n === 1 ? 'Geno Bass Synth' : `Geno Bass Synth ${n}`;
}

export function se2DefaultGenoBassSynthTrack(partial?: {
  id: string;
  name: string;
  colorHex: string;
  midiChannel?: number;
}): Se2GenoBassSynthTrack & {
  id: string;
  name: string;
  colorHex: string;
  notes: [];
  audioClips: [];
} {
  const voice = genoBassPresetById(genoBassSanitizePresetId(undefined));
  return {
    id: partial?.id ?? 't-geno-bass',
    name: partial?.name ?? 'Geno Bass Synth',
    colorHex: partial?.colorHex ?? SE2_GENO_BASS_SYNTH_ACCENT,
    kind: 'genoBassSynth',
    genoBassPresetId: voice.id,
    genoBassPatchLabel: voice.label,
    midiChannel: partial?.midiChannel,
    notes: [],
    audioClips: [],
  };
}

/** Piano-roll default register — C2–C4 (matches Geno Bass groove editor). */
export const SE2_GENO_BASS_PITCH_DEFAULT_LO = 36;
export const SE2_GENO_BASS_PITCH_DEFAULT_HI = 60;

export function se2GenoBassEmptyPitchRange(): { min: number; max: number } {
  return { min: SE2_GENO_BASS_PITCH_DEFAULT_LO, max: SE2_GENO_BASS_PITCH_DEFAULT_HI };
}

export function se2GenoBassPitchSpanNotes(): {
  pitch: number;
  startBeat: number;
  durationBeats: number;
  velocity: number;
}[] {
  const lo = SE2_GENO_BASS_PITCH_DEFAULT_LO;
  const hi = SE2_GENO_BASS_PITCH_DEFAULT_HI;
  const out: { pitch: number; startBeat: number; durationBeats: number; velocity: number }[] = [];
  for (let p = lo; p <= hi; p += 1) {
    out.push({ pitch: p, startBeat: 0, durationBeats: 0.25, velocity: 1 });
  }
  return out;
}
