/**
 * Studio Editor 2 — Geno Chord Creator lane (4/8 card sketch → export harmony + MIDI to track).
 */
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import type { GrooveProgressionStep } from '@/app/lib/creationStation/grooveLabProgressionBuilder';
import {
  STUDIO_HARMONY_LOOP_BARS,
  studioNormalizeHarmonyLoopBars,
  type StudioHarmonyLoopBars,
} from '@/app/lib/studio/studioInstrumentHarmony';
import type { StudioEditor2MidiTrack } from '@/app/lib/studio/studioEditor2Midi';
import type { StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';

export type Se2GenoChordCreatorTrackFields = {
  kind: 'genoChordCreator';
  /** Curated pack id (`genre::progression`) from the progression catalog. */
  genoChordCreatorPresetId?: string;
  /** Audition cards in the generator before export. */
  genoChordCreatorAudioOn?: boolean;
  /** Follow SE2 transport playhead + preview roll chords on session Play. */
  genoChordCreatorSe2Sync?: boolean;
  /** Working chord cards — edit here, export to piano roll when ready. */
  harmonySteps?: GrooveProgressionStep[];
  harmonyLoopBars?: StudioHarmonyLoopBars;
  trackKeyRoot?: number;
  trackKeyMode?: StudioDetectedKeyMode;
  /** @deprecated Renamed — loaded from saved sessions only. */
  chordGeniePresetId?: string;
  chordGenieAudioOn?: boolean;
};

export type Se2GenoChordCreatorTrack = StudioEditor2MidiTrack & Se2GenoChordCreatorTrackFields;

/** @deprecated Use Se2GenoChordCreatorTrack */
export type Se2ChordGenieTrack = Se2GenoChordCreatorTrack;

export const SE2_GENO_CHORD_CREATOR_ACCENT = '#4DA8FF';
/** Default track / UI label for this lane. */
export const SE2_CHORD_GENERATOR_LABEL = 'SE2 Chord Generator';

const LEGACY_GENO_CHORD_CREATOR_NAME_BASES = new Set([
  'chord genie',
  'se2 chord genie',
  'geno chord creator',
  'se2 geno chord creator',
  'chord generator',
  'se2 chord generator',
  'card genie',
  'card generator',
]);

/** Rename saved rows that still use Chord Genie / Geno Chord Creator / SE2 Chord Generator. */
export function se2NormalizeGenoChordCreatorTrackName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return SE2_CHORD_GENERATOR_LABEL;
  const numMatch = trimmed.match(/^(.*?)(?:\s+(\d+))$/);
  const base = (numMatch?.[1] ?? trimmed).trim();
  const suffix = numMatch?.[2] ? ` ${numMatch[2]}` : '';
  if (!LEGACY_GENO_CHORD_CREATOR_NAME_BASES.has(base.toLowerCase())) return trimmed;
  return `${SE2_CHORD_GENERATOR_LABEL}${suffix}`;
}

/** Session load — normalize kind + legacy track name + deprecated fields. */
export function se2MigrateGenoChordCreatorTrackRow(
  track: Record<string, unknown>,
): Record<string, unknown> {
  const kind = track.kind;
  if (kind !== 'genoChordCreator' && kind !== 'chordGenie') return track;

  const out: Record<string, unknown> = { ...track, kind: 'genoChordCreator' };
  const name = typeof track.name === 'string' ? track.name : '';
  out.name = se2NormalizeGenoChordCreatorTrackName(name);

  if (out.genoChordCreatorPresetId == null && typeof track.chordGeniePresetId === 'string') {
    out.genoChordCreatorPresetId = track.chordGeniePresetId;
  }
  if (out.genoChordCreatorAudioOn == null && typeof track.chordGenieAudioOn === 'boolean') {
    out.genoChordCreatorAudioOn = track.chordGenieAudioOn;
  }

  return out;
}
/** @deprecated */
export const SE2_CHORD_GENIE_ACCENT = SE2_GENO_CHORD_CREATOR_ACCENT;

export function studioTrackIsGenoChordCreatorChannel(
  tr: { kind?: string } | undefined,
): tr is Se2GenoChordCreatorTrack {
  return tr?.kind === 'genoChordCreator' || tr?.kind === 'chordGenie';
}

/** @deprecated Use studioTrackIsGenoChordCreatorChannel */
export const studioTrackIsChordGenieChannel = studioTrackIsGenoChordCreatorChannel;

export function nextGenoChordCreatorTrackName(
  tracks: readonly { kind?: string; name?: string }[],
): string {
  const n = tracks.filter((t) => t.kind === 'genoChordCreator' || t.kind === 'chordGenie').length + 1;
  return n === 1 ? SE2_CHORD_GENERATOR_LABEL : `${SE2_CHORD_GENERATOR_LABEL} ${n}`;
}

/** @deprecated */
export const nextChordGenieTrackName = nextGenoChordCreatorTrackName;

export function se2GenoChordCreatorPresetId(tr: {
  genoChordCreatorPresetId?: string;
  chordGeniePresetId?: string;
}): string {
  return (tr.genoChordCreatorPresetId ?? tr.chordGeniePresetId ?? '').trim();
}

export function se2GenoChordCreatorAudioOn(tr: {
  genoChordCreatorAudioOn?: boolean;
  chordGenieAudioOn?: boolean;
}): boolean {
  const v = tr.genoChordCreatorAudioOn ?? tr.chordGenieAudioOn;
  return v !== false;
}

export function se2GenoChordCreatorSe2Sync(tr: {
  genoChordCreatorSe2Sync?: boolean;
}): boolean {
  return tr.genoChordCreatorSe2Sync === true;
}

export function se2DefaultGenoChordCreatorTrack(partial?: {
  id: string;
  name: string;
  colorHex: string;
  midiChannel?: number;
}): Se2GenoChordCreatorTrack & {
  id: string;
  name: string;
  colorHex: string;
  notes: [];
  audioClips: [];
} {
  return {
    id: partial?.id ?? 't-geno-chord-creator',
    name: partial?.name ?? SE2_CHORD_GENERATOR_LABEL,
    colorHex: partial?.colorHex ?? SE2_GENO_CHORD_CREATOR_ACCENT,
    kind: 'genoChordCreator',
    midiChannel: partial?.midiChannel,
    genoChordCreatorPresetId: '',
    genoChordCreatorAudioOn: true,
    genoChordCreatorSe2Sync: false,
    harmonySteps: [],
    harmonyLoopBars: STUDIO_HARMONY_LOOP_BARS,
    trackKeyRoot: 0,
    trackKeyMode: 'major',
    notes: [],
    audioClips: [],
  };
}

/** @deprecated */
export const se2DefaultChordGenieTrack = se2DefaultGenoChordCreatorTrack;

export function se2NormalizeGenoChordCreatorKeyRoot(raw: number | undefined): number {
  return ((Math.round(raw ?? 0) % 12) + 12) % 12;
}

export function se2NormalizeGenoChordCreatorMode(raw: string | undefined): ChordMode {
  return raw === 'minor' ? 'minor' : 'major';
}

export function se2GenoChordCreatorLoopBars(
  tr: Se2GenoChordCreatorTrack | undefined,
): StudioHarmonyLoopBars {
  return studioNormalizeHarmonyLoopBars(tr?.harmonyLoopBars);
}

/** @deprecated */
export const se2ChordGenieLoopBars = se2GenoChordCreatorLoopBars;
