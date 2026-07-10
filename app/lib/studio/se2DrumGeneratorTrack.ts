/**
 * Studio Editor 2 — dedicated Drum Generator lane (pattern presets + procedural grooves).
 */
import type { BeatLabProducerKitId } from '@/app/lib/creationStation/beatLabProducerKits';
import type { Se2DrumPadOverride } from '@/app/lib/studio/se2DrumPadOverrides';
import type { GenoChordStyle } from '@/app/lib/studio/se2SynthGenoComposePrompt';
import { se2HarmonySourceSteps } from '@/app/lib/studio/se2GlideBassHarmony';
import { se2TrackHasProgressionSteps } from '@/app/lib/studio/se2GlideBassTrack';
import type { GrooveProgressionStep } from '@/app/lib/creationStation/grooveLabProgressionBuilder';
import type { StudioEditor2MidiTrack } from '@/app/lib/studio/studioEditor2Midi';
import { studioTrackIsDrumChannel } from '@/app/lib/studio/studioEditor2DrumPatterns';

/** Which Geno build the matched cards came from (B01 Live Chords vs B02 stack). */
export type Se2DrumGenGenoBuildSlot = 'b01' | 'b02';

export type Se2DrumGenStyle = GenoChordStyle;

export type Se2DrumGeneratorTrackFields = {
  kind: 'drumGenerator';
  drumGenStyle?: Se2DrumGenStyle;
  drumGenSeed?: number;
  drumGenTemperature?: number;
  drumGenHarmonyTrackId?: string;
  /** Geno Build 1 vs Build 2 — metadata for the linked card lane. */
  drumGenGenoBuildSlot?: Se2DrumGenGenoBuildSlot;
  drumPatternPresetId?: string;
  beatLabPatternPresetId?: string;
  /** Bank 2 — chord-matched modern generator (Drill / Lo-Fi / Dance / K-pop). */
  drumGenModernPresetId?: string;
  drumGenModernGenre?: string;
  /** Per-pad sample overrides (0–15) — swap kick, snare, clap, etc. */
  drumPadOverrides?: Partial<Record<number, Se2DrumPadOverride>>;
  drumProducerKitId?: BeatLabProducerKitId;
};

export type Se2DrumGeneratorTrack = StudioEditor2MidiTrack & Se2DrumGeneratorTrackFields;

export type Se2DrumGenHarmonySourceTrack = {
  id: string;
  name: string;
  laneNumber?: number;
  kind: string;
  notes?: readonly unknown[];
  harmonySteps?: readonly GrooveProgressionStep[];
  rhythmSteps?: readonly GrooveProgressionStep[];
  synthGenoComposePrompt?: string;
  synthGenoPrompt?: string;
  glideBassHarmonyTrackId?: string;
  grooveLeadHarmonyTrackId?: string;
};

export const SE2_DRUM_GEN_DEFAULT_STYLE: Se2DrumGenStyle = 'pop';

/** 1.0 = preset as-is; higher = more ghost notes / syncopation (see magentaPatternGenerator). */
export const SE2_DRUM_GEN_DEFAULT_TEMPERATURE = 1;

export function se2NormalizeDrumGenTemperature(raw: number | undefined): number {
  const v = raw ?? SE2_DRUM_GEN_DEFAULT_TEMPERATURE;
  if (Math.abs(v - 1.15) < 0.001) return SE2_DRUM_GEN_DEFAULT_TEMPERATURE;
  return Math.max(1, Math.min(2, v));
}

export const SE2_DRUM_GEN_STYLE_CHIPS: readonly { id: Se2DrumGenStyle; label: string }[] = [
  { id: 'pop', label: 'Pop' },
  { id: 'rnb', label: 'R&B' },
  { id: 'trap', label: 'Trap' },
  { id: 'kpop', label: 'K-pop' },
  { id: 'gospel', label: 'Gospel' },
  { id: 'dance', label: 'Dance' },
  { id: 'disco', label: 'Disco' },
  { id: 'dark', label: 'Dark' },
];

export function studioTrackIsDrumGeneratorChannel(
  tr: { kind?: string } | undefined,
): tr is Se2DrumGeneratorTrack {
  return tr?.kind === 'drumGenerator';
}

export function se2NormalizeDrumGenStyle(raw: string | undefined): Se2DrumGenStyle {
  const hit = SE2_DRUM_GEN_STYLE_CHIPS.find((c) => c.id === raw);
  return hit?.id ?? SE2_DRUM_GEN_DEFAULT_STYLE;
}

export function nextDrumGeneratorTrackName(tracks: readonly { kind?: string; name?: string }[]): string {
  const n = tracks.filter((t) => t.kind === 'drumGenerator').length + 1;
  return n === 1 ? 'Drum Generator' : `Drum Generator ${n}`;
}

export function se2DrumGenHarmonyKindLabel(kind: string): string {
  switch (kind) {
    case 'synthGeno':
      return 'Synth Geno';
    case 'glideBass':
      return 'Bass Glide';
    case 'grooveLead':
      return 'Groove Lead';
    case 'rhythm':
      return 'Rhythm Edit';
    case 'midi':
      return 'Progression+';
    default:
      return kind;
  }
}

/** Same breadth as Bass Glide chord source — every melodic lane you might stack with drums. */
export function se2DrumGenHarmonySourceCandidates<T extends Se2DrumGenHarmonySourceTrack>(
  tracks: readonly T[],
  drumGenTrackId: string,
): T[] {
  return tracks.filter((t) => {
    if (t.id === drumGenTrackId) return false;
    if (t.kind === 'drumGenerator' || t.kind === 'audio' || t.kind === 'a2m') return false;
    if (t.kind === 'synthGeno' || t.kind === 'rhythm') return true;
    if (t.kind === 'glideBass' || t.kind === 'grooveLead') return true;
    if (t.kind === 'genoChordCreator' || t.kind === 'chordGenie') return true;
    if (t.kind === 'midi' && !studioTrackIsDrumChannel(t)) return true;
    return false;
  });
}

export function se2DrumGenTrackHarmonyReady(tr: Se2DrumGenHarmonySourceTrack): boolean {
  if (tr.kind === 'synthGeno') {
    return (tr.notes?.length ?? 0) > 0;
  }
  if (se2HarmonySourceSteps(tr).length > 0) return true;
  if (tr.kind === 'genoChordCreator' || tr.kind === 'chordGenie') {
    return se2HarmonySourceSteps(tr).length > 0 || (tr.notes?.length ?? 0) > 0;
  }
  if (tr.kind === 'midi' || tr.kind === 'glideBass' || tr.kind === 'grooveLead' || tr.kind === 'rhythm') {
    return (tr.notes?.length ?? 0) > 0;
  }
  return se2TrackHasProgressionSteps(tr);
}

export function se2DrumGenHarmonyReadyCandidates<T extends Se2DrumGenHarmonySourceTrack>(
  tracks: readonly T[],
  drumGenTrackId: string,
): T[] {
  return se2DrumGenHarmonySourceCandidates(tracks, drumGenTrackId).filter((t) =>
    se2DrumGenTrackHarmonyReady(t),
  );
}

export function se2SortDrumGenHarmonyCandidates<T extends Se2DrumGenHarmonySourceTrack>(
  tracks: readonly T[],
): T[] {
  return [...tracks].sort((a, b) => {
    const ra = se2DrumGenTrackHarmonyReady(a) ? 0 : 1;
    const rb = se2DrumGenTrackHarmonyReady(b) ? 0 : 1;
    if (ra !== rb) return ra - rb;
    return (a.laneNumber ?? 999) - (b.laneNumber ?? 999);
  });
}

export function se2DrumGenHarmonyOptionHint(tr: Se2DrumGenHarmonySourceTrack): string {
  const steps = se2HarmonySourceSteps(tr).length;
  const notes = tr.notes?.length ?? 0;
  if (tr.kind === 'synthGeno') {
    if (notes > 0) return `${notes} notes on roll — ready`;
    return 'Apply MIDI on Geno first';
  }
  if (steps > 0) return `${steps} chord steps`;
  if (notes > 0) return `${notes} MIDI notes`;
  return 'needs chords';
}

export function se2ResolveDrumGenHarmonyTrack<
  T extends Se2DrumGenHarmonySourceTrack & { drumGenHarmonyTrackId?: string },
>(tracks: readonly T[], drumGen: { drumGenHarmonyTrackId?: string }, drumGenId: string): T | undefined {
  const want = drumGen.drumGenHarmonyTrackId?.trim();
  if (want) {
    const picked = tracks.find((t) => t.id === want);
    if (picked && picked.id !== drumGenId && picked.kind !== 'drumGenerator' && picked.kind !== 'audio') {
      return picked;
    }
  }
  return se2DrumGenHarmonyReadyCandidates(tracks, drumGenId)[0];
}
