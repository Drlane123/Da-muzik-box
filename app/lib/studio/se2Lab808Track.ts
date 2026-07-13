/**
 * Studio Editor 2 — dedicated 808 Lab lane (trap kick / bass synth — standalone, not linked to Creation Station).
 */
import type { Lab808SoundLane } from '@/app/lib/creationStation/eightZeroEightVoice';
import type { StudioEditor2MidiTrack } from '@/app/lib/studio/studioEditor2Midi';
import {
  normalizeSe2Lab808ToneGridPattern,
  se2Lab808NormalizeToneGridLoopBars,
} from '@/app/lib/studio/se2Lab808DrumPattern';
import { normalizeSe2Lab808PercBar } from '@/app/lib/studio/se2Lab808PercPattern';
import {
  se2Lab808DefaultVoice,
  se2Lab808PatchLabel,
  se2Lab808VoiceFromTrackFields,
  type Se2Lab808VoiceParams,
} from '@/app/lib/studio/se2Lab808Types';
import { se2Lab808ChordLockFromTrackFields } from '@/app/lib/studio/se2Lab808ChordLock';

export type Se2Lab808TrackFields = {
  kind: 'lab808';
  /** Kick or bass lane timbre. */
  lab808SoundLane?: Lab808SoundLane;
  lab808KickPresetId?: string;
  lab808BassPresetId?: string;
  lab808TonePadBaseMidi?: number;
  lab808ToneGridLoopBars?: number;
  lab808ToneGridSteps?: boolean[][];
  lab808ChordLockEnabled?: boolean;
  lab808ChordLockSourceKind?: string;
  lab808ChordLockHarmonyTrackId?: string;
  lab808ChordLockKeyRoot?: number;
  lab808ChordLockKeyMode?: string;
  lab808RootGenSeed?: number;
  lab808ToneGridZoom?: number;
  /** 1-bar snare / clap (16ths) — repeats every bar. */
  lab808PercSnareSteps?: boolean[];
  lab808PercClapSteps?: boolean[];
  lab808PercLevel?: number;
  /** @deprecated Migrated to tone grid — still read for old sessions. */
  lab808DrumSteps?: boolean[][];
};

export type Se2Lab808Track = StudioEditor2MidiTrack & Se2Lab808TrackFields;

export function studioTrackIsLab808Channel(tr: { kind?: string } | undefined): tr is Se2Lab808Track {
  return tr?.kind === 'lab808';
}

export function se2Lab808VoiceFromTrack(
  tr: Se2Lab808Track & { lab808SoundLane?: Lab808SoundLane },
  storedVoice: Se2Lab808VoiceParams | undefined,
): Se2Lab808VoiceParams {
  const base = se2Lab808VoiceFromTrackFields(tr);
  if (!storedVoice) return base;
  const loopBars = se2Lab808NormalizeToneGridLoopBars(storedVoice.toneGridLoopBars ?? base.toneGridLoopBars);
  return {
    ...base,
    ...storedVoice,
    soundLane: storedVoice.soundLane ?? base.soundLane,
    toneGridLoopBars: loopBars,
    toneGridSteps: normalizeSe2Lab808ToneGridPattern(storedVoice.toneGridSteps ?? base.toneGridSteps, loopBars),
    toneGridZoom: storedVoice.toneGridZoom ?? base.toneGridZoom,
    rootGenSeed: storedVoice.rootGenSeed ?? base.rootGenSeed,
    percSnareSteps: normalizeSe2Lab808PercBar(storedVoice.percSnareSteps ?? base.percSnareSteps),
    percClapSteps: normalizeSe2Lab808PercBar(storedVoice.percClapSteps ?? base.percClapSteps),
    percLevel: storedVoice.percLevel ?? base.percLevel,
  };
}

export function se2Lab808PatchLabelFromTrack(tr: Se2Lab808Track, storedVoice?: Se2Lab808VoiceParams): string {
  return se2Lab808PatchLabel(se2Lab808VoiceFromTrack(tr, storedVoice));
}

export function nextLab808TrackName(tracks: readonly { kind?: string; name?: string }[]): string {
  const n = tracks.filter((t) => t.kind === 'lab808').length + 1;
  return n === 1 ? '808 Lab' : `808 Lab ${n}`;
}

export function se2DefaultLab808Track(partial?: {
  id: string;
  name: string;
  colorHex: string;
  midiChannel?: number;
}): Se2Lab808Track & {
  id: string;
  name: string;
  colorHex: string;
  notes: [];
  audioClips: [];
} {
  const voice = se2Lab808DefaultVoice();
  return {
    id: partial?.id ?? 't-lab808',
    name: partial?.name ?? '808 Lab',
    colorHex: partial?.colorHex ?? '#E8784A',
    kind: 'lab808',
    lab808SoundLane: voice.soundLane,
    lab808KickPresetId: voice.kickPresetId,
    lab808BassPresetId: voice.bassPresetId,
    lab808TonePadBaseMidi: voice.tonePadBaseMidi,
    lab808ToneGridLoopBars: voice.toneGridLoopBars,
    lab808ToneGridSteps: voice.toneGridSteps.map((row) => [...row]),
    lab808PercSnareSteps: [...voice.percSnareSteps],
    lab808PercClapSteps: [...voice.percClapSteps],
    lab808PercLevel: voice.percLevel,
    midiChannel: partial?.midiChannel,
    notes: [],
    audioClips: [],
  };
}
