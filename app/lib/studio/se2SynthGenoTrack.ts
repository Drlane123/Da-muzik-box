/**
 * Studio Editor 2 — Synth Geno dedicated lane.
 */
import { se2SynthGenoDefaultVoice } from '@/app/lib/studio/se2SynthGenoPresets';
import type { Se2SynthGenoVoiceParams } from '@/app/lib/studio/se2SynthGenoTypes';
import type { StudioEditor2MidiTrack } from '@/app/lib/studio/studioEditor2Midi';

export type Se2SynthGenoTrackFields = {
  kind: 'synthGeno';
  /** Last prompt used in the generator. */
  synthGenoPrompt?: string;
  /** Geno Compose — Staccato-style MIDI prompt. */
  synthGenoComposePrompt?: string;
  /** Display name from generator (patch label). */
  synthGenoPatchLabel?: string;
  /** Linked Groove Lead lane — chord-locked from this Geno progression. */
  synthGenoGrooveLeadTrackId?: string;
};

export type Se2SynthGenoTrack = StudioEditor2MidiTrack & Se2SynthGenoTrackFields;

export function studioTrackIsSynthGenoChannel(
  tr: { kind?: string } | undefined,
): tr is Se2SynthGenoTrack {
  return tr?.kind === 'synthGeno';
}

export function se2SynthGenoVoiceFromTrack(
  tr: Se2SynthGenoTrack,
  storedVoice: Se2SynthGenoVoiceParams | undefined,
): Se2SynthGenoVoiceParams {
  const label = tr.synthGenoPatchLabel?.trim() || 'Synth Geno';
  const base = se2SynthGenoDefaultVoice(label);
  return storedVoice ? { ...base, ...storedVoice, label: storedVoice.label || label } : base;
}

export function nextSynthGenoTrackName(tracks: readonly { kind?: string; name?: string }[]): string {
  const n = tracks.filter((t) => t.kind === 'synthGeno').length + 1;
  return n === 1 ? 'Synth Geno' : `Synth Geno ${n}`;
}

export function se2DefaultSynthGenoTrack(partial?: {
  id: string;
  name: string;
  colorHex: string;
  midiChannel?: number;
}): Se2SynthGenoTrack & {
  id: string;
  name: string;
  colorHex: string;
  notes: [];
  audioClips: [];
} {
  const voice = se2SynthGenoDefaultVoice('Init Geno');
  return {
    id: partial?.id ?? 't-synth-geno',
    name: partial?.name ?? 'Synth Geno',
    colorHex: partial?.colorHex ?? '#00E5CC',
    kind: 'synthGeno',
    synthGenoPrompt: 'warm keys with soft attack',
    synthGenoComposePrompt: 'melody 4 bars in project key',
    synthGenoPatchLabel: voice.label,
    midiChannel: partial?.midiChannel,
    notes: [],
    audioClips: [],
  };
}
