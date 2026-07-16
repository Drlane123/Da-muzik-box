/**
 * Studio Editor 2 — dedicated Groove Lead lane (WaveLeaf synth from Groove Lab).
 */
import { waveLeafNormalizePresetId, type WaveLeafPresetId } from '@/app/lib/creationStation/waveLeafPresets';
import type { StudioEditor2MidiTrack } from '@/app/lib/studio/studioEditor2Midi';
import {
  se2GrooveLeadDefaultVoice,
  se2GrooveLeadPatchLabel,
  se2GrooveLeadVoiceFromPresetId,
  type Se2GrooveLeadVoiceParams,
} from '@/app/lib/studio/se2GrooveLeadTypes';
import {
  se2ResolveGlideBassHarmonyTrack,
  type Se2HarmonySourceTrack,
} from '@/app/lib/studio/se2GlideBassHarmony';
import { se2GrooveLeadCanFollowHarmonySource } from '@/app/lib/studio/se2GrooveLeadHarmonyMelody';
import type { GenoUltraArpSe2TrackChordInput } from '@/app/lib/studio/genoUltraArpSe2TrackImport';

export type Se2GrooveLeadTrackFields = {
  kind: 'grooveLead';
  /** WaveLeaf preset id — display + transport fallback. */
  grooveLeadPresetId?: WaveLeafPresetId;
  /** Progression+ / rhythm track id for melody generator chord context. */
  grooveLeadHarmonyTrackId?: string;
  /** Regenerate seed for Mellodo-style lead variations. */
  grooveLeadMelodySeed?: number;
};

export type Se2GrooveLeadTrack = StudioEditor2MidiTrack & Se2GrooveLeadTrackFields;

export function studioTrackIsGrooveLeadChannel(
  tr: { kind?: string } | undefined,
): tr is Se2GrooveLeadTrack {
  return tr?.kind === 'grooveLead';
}

export function se2NormalizeGrooveLeadPresetId(raw: string | undefined): WaveLeafPresetId {
  return waveLeafNormalizePresetId(raw);
}

export function se2GrooveLeadVoiceFromTrack(
  tr: Se2GrooveLeadTrack,
  storedVoice: Se2GrooveLeadVoiceParams | undefined,
): Se2GrooveLeadVoiceParams {
  const presetId = se2NormalizeGrooveLeadPresetId(tr.grooveLeadPresetId);
  const base = se2GrooveLeadVoiceFromPresetId(presetId);
  return storedVoice ? { ...base, ...storedVoice, presetId: storedVoice.presetId || presetId } : base;
}

export function nextGrooveLeadTrackName(tracks: readonly { kind?: string; name?: string }[]): string {
  const n = tracks.filter((t) => t.kind === 'grooveLead').length + 1;
  return n === 1 ? 'Groove Lead' : `Groove Lead ${n}`;
}

export function se2DefaultGrooveLeadTrack(partial?: {
  id: string;
  name: string;
  colorHex: string;
  midiChannel?: number;
}): Se2GrooveLeadTrack & {
  id: string;
  name: string;
  colorHex: string;
  notes: [];
  audioClips: [];
} {
  const voice = se2GrooveLeadDefaultVoice();
  return {
    id: partial?.id ?? 't-groove-lead',
    name: partial?.name ?? 'Groove Lead',
    colorHex: partial?.colorHex ?? '#4EC8E8',
    kind: 'grooveLead',
    grooveLeadPresetId: voice.presetId,
    grooveLeadHarmonyTrackId: '',
    midiChannel: partial?.midiChannel,
    notes: [],
    audioClips: [],
  };
}

export function se2GrooveLeadPatchLabelFromTrack(tr: Se2GrooveLeadTrack): string {
  return se2GrooveLeadPatchLabel(se2GrooveLeadVoiceFromTrack(tr, undefined));
}

export function se2ResolveGrooveLeadHarmonyTrack<
  T extends Se2HarmonySourceTrack & {
    id: string;
    kind: string;
    grooveLeadHarmonyTrackId?: string;
    notes?: readonly { pitch: number }[];
  },
>(tracks: readonly T[], grooveLead: { grooveLeadHarmonyTrackId?: string }, grooveLeadId: string): T | undefined {
  const want = grooveLead.grooveLeadHarmonyTrackId?.trim();
  if (want) {
    const picked = tracks.find((t) => t.id === want);
    if (
      picked &&
      picked.id !== grooveLeadId &&
      picked.kind !== 'grooveLead' &&
      picked.kind !== 'audio'
    ) {
      return picked;
    }
  }
  return tracks.find(
    (t) =>
      t.id !== grooveLeadId &&
      t.kind !== 'grooveLead' &&
      t.kind !== 'audio' &&
      se2GrooveLeadCanFollowHarmonySource(t as GenoUltraArpSe2TrackChordInput),
  );
}

/** Re-export glide-bass helper shape for harmony pickers in the Groove Lead panel. */
export { se2ResolveGlideBassHarmonyTrack as se2GrooveLeadHarmonyCandidates };
