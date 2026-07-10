/**
 * Beat Pads spread roll (SE2 only) — 808-in-key follows chord roots on a chosen studio MIDI track.
 * Separate from the harmony-strip kick / match-card 808-in-key — do not mix those code paths.
 */
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import {
  beatPadsSpreadChordRootPcAtBar,
  clampBeatPadsSpreadLoopBars,
  type BeatPadsSpreadLoopBars,
} from '@/app/lib/creationStation/beatPadsSpreadTrack';
import type { BeatPadsGridStepsPerBar } from '@/app/lib/creationStation/beatLabDrumMachineSequencer';
import { grooveLabClampBassRootMidi } from '@/app/lib/creationStation/grooveLabPitch';
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';
import { studioTrackOutputsMidi } from '@/app/lib/studio/studioEditor2Midi';
import { se2TrackIsAudioClipLane } from '@/app/lib/studio/se2TrackAlign';
import { se2BeatPadsHarmonyKey } from '@/app/lib/studio/se2BeatPadsHarmony';
import { se2GlideBassChordRailFromSource, se2HarmonySourceSteps } from '@/app/lib/studio/se2GlideBassHarmony';
import { se2BeatPadsKickKeySemitones } from '@/app/lib/studio/se2BeatPadsKickMatch';
import type { Se2BeatPadsHarmonySourceTrack } from '@/app/lib/studio/se2BeatPadsHarmony';
import { se2TrackNumberedName } from '@/app/lib/studio/se2StudioTrackNumber';


export type Se2BeatPadsSpreadSourceTrack = Se2BeatPadsHarmonySourceTrack;

export type Se2BeatPadsSpreadMatchOption = {
  trackIndex: number;
  label: string;
  noteCount: number;
};

export function se2BeatPadsSpreadTrackNoteCount(tr: Se2BeatPadsSpreadSourceTrack): number {
  const steps = se2HarmonySourceSteps(tr);
  if (steps.length > 0) return steps.length;
  return tr.notes?.length ?? 0;
}

export type Se2BeatPadsSpreadExportTrackOption = {
  trackIndex: number;
  label: string;
};

/** All timeline lanes — spread export labels (T01…). */
export function se2BeatPadsSpreadExportTrackOptions(
  tracks: readonly { name?: string; laneNumber?: number }[],
  lanePad: number,
): Se2BeatPadsSpreadExportTrackOption[] {
  return tracks.map((tr, trackIndex) => ({
    trackIndex,
    label: se2TrackNumberedName(tr.laneNumber, tr.name ?? 'Track', lanePad),
  }));
}

/** SE2 instrument lane — piano-roll / MIDI notes (not plain Audio lanes). */
export function se2BeatPadsSpreadCanReceiveSpreadMidi(
  tr: Pick<Se2BeatPadsSpreadSourceTrack, 'kind'> | undefined,
): boolean {
  if (!tr?.kind) return false;
  if (se2TrackIsAudioClipLane(tr.kind)) return false;
  return studioTrackOutputsMidi(tr);
}

/** SE2 audio clip lane — Audio or Track Align only. */
export function se2BeatPadsSpreadCanReceiveSpreadWav(kind: string | undefined): boolean {
  return se2TrackIsAudioClipLane(kind);
}

/** Lanes that accept spread MIDI export (any SE2 instrument track). */
export function se2BeatPadsSpreadMidiExportTrackOptions(
  tracks: readonly Se2BeatPadsSpreadSourceTrack[],
  lanePad: number,
): Se2BeatPadsSpreadExportTrackOption[] {
  const out: Se2BeatPadsSpreadExportTrackOption[] = [];
  for (let i = 0; i < tracks.length; i += 1) {
    const tr = tracks[i]!;
    if (!se2BeatPadsSpreadCanReceiveSpreadMidi(tr)) continue;
    out.push({
      trackIndex: i,
      label: `${se2TrackNumberedName(tr.laneNumber, tr.name ?? 'Track', lanePad)} · MIDI`,
    });
  }
  return out;
}

/** Lanes that accept spread WAV export (SE2 Audio / Track Align). */
export function se2BeatPadsSpreadWavExportTrackOptions(
  tracks: readonly { name?: string; laneNumber?: number; kind?: string }[],
  lanePad: number,
): Se2BeatPadsSpreadExportTrackOption[] {
  const out: Se2BeatPadsSpreadExportTrackOption[] = [];
  for (let i = 0; i < tracks.length; i += 1) {
    const tr = tracks[i]!;
    if (!se2BeatPadsSpreadCanReceiveSpreadWav(tr.kind)) continue;
    out.push({
      trackIndex: i,
      label: `${se2TrackNumberedName(tr.laneNumber, tr.name ?? 'Track', lanePad)} · Audio`,
    });
  }
  return out;
}

export function se2BeatPadsSpreadDefaultMidiExportTrackIndex(
  tracks: readonly Se2BeatPadsSpreadSourceTrack[],
  beatPadsTrackId: string,
  lanePad: number,
): number | undefined {
  const opts = se2BeatPadsSpreadMidiExportTrackOptions(tracks, lanePad);
  const plainMidi = opts.find((o) => tracks[o.trackIndex]?.kind === 'midi');
  const prefer = opts.find((o) => {
    const tr = tracks[o.trackIndex];
    return tr && tr.id !== beatPadsTrackId && tr.kind !== 'beatPads';
  });
  return plainMidi?.trackIndex ?? prefer?.trackIndex ?? opts[0]?.trackIndex;
}

export function se2BeatPadsSpreadDefaultWavExportTrackIndex(
  tracks: readonly { kind?: string }[],
  lanePad: number,
): number | undefined {
  const opts = se2BeatPadsSpreadWavExportTrackOptions(tracks, lanePad);
  const plainAudio = opts.find((o) => tracks[o.trackIndex]?.kind === 'audio');
  return plainAudio?.trackIndex ?? opts[0]?.trackIndex;
}


/** All instrument lanes (except this Beat Pads lane) eligible for spread-roll match. */
export function se2BeatPadsSpreadMatchTrackOptions(
  tracks: readonly Se2BeatPadsSpreadSourceTrack[],
  beatPadsTrackId: string,
  lanePad: number,
): Se2BeatPadsSpreadMatchOption[] {
  const out: Se2BeatPadsSpreadMatchOption[] = [];
  for (let i = 0; i < tracks.length; i += 1) {
    const tr = tracks[i]!;
    if (tr.id === beatPadsTrackId) continue;
    if (tr.kind === 'audio' || tr.kind === 'beatPads') continue;
    if (!studioTrackOutputsMidi(tr)) continue;
    const noteCount = se2BeatPadsSpreadTrackNoteCount(tr);
    out.push({
      trackIndex: i,
      noteCount,
      label:
        noteCount > 0
          ? `${se2TrackNumberedName(tr.laneNumber, tr.name ?? 'Track', lanePad)} · ${noteCount} hits`
          : `${se2TrackNumberedName(tr.laneNumber, tr.name ?? 'Track', lanePad)} · empty`,
    });
  }
  return out;
}

/** Pick a Match value that exists in the current option list (prevents stuck <select>). */
export function se2BeatPadsSpreadResolveMatchTrackIndex(
  options: readonly Pick<Se2BeatPadsSpreadMatchOption, 'trackIndex'>[],
  harmonyTrackIndex: number | undefined,
): number | undefined {
  if (!options.length) return undefined;
  if (
    harmonyTrackIndex != null &&
    options.some((o) => o.trackIndex === harmonyTrackIndex)
  ) {
    return harmonyTrackIndex;
  }
  return options[0]!.trackIndex;
}

export function se2BeatPadsSpreadDefaultMatchTrackIndex(
  tracks: readonly Se2BeatPadsSpreadSourceTrack[],
  beatPadsTrackId: string,
  lanePad: number,
): number | undefined {
  const opts = se2BeatPadsSpreadMatchTrackOptions(tracks, beatPadsTrackId, lanePad);
  const withNotes = opts.find((o) => o.noteCount > 0);
  return withNotes?.trackIndex ?? opts[0]?.trackIndex;
}

function se2BeatPadsSpreadRootsFromNotes(
  notes: readonly StudioEditor2GenNote[],
  beatsPerBar: number,
  layoutBars: number,
  keyRoot: number,
): { roots: number[]; hasHarmony: boolean } {
  let prev = grooveLabClampBassRootMidi(12 * 3 + (((Math.round(keyRoot) % 12) + 12) % 12));
  let hasHarmony = false;
  const roots: number[] = [];
  for (let bar = 0; bar < layoutBars; bar += 1) {
    const b0 = bar * beatsPerBar;
    const b1 = (bar + 1) * beatsPerBar;
    const pitches: number[] = [];
    for (const n of notes) {
      const start = n.startBeat ?? 0;
      const end = start + Math.max(1 / 64, n.durationBeats ?? 0);
      if (start < b1 && end > b0) pitches.push(n.pitch);
    }
    if (pitches.length > 0) {
      hasHarmony = true;
      prev = Math.min(...pitches);
      roots.push(prev);
    } else {
      roots.push(prev);
    }
  }
  return { roots, hasHarmony };
}

function se2BeatPadsSpreadRootsFromHarmonySteps(
  tr: Se2BeatPadsSpreadSourceTrack,
  beatsPerBar: number,
  layoutBars: number,
  songKeyRoot: number,
  songKeyMode: ChordMode,
): number[] | null {
  const rail = se2GlideBassChordRailFromSource(tr, beatsPerBar, songKeyRoot, songKeyMode);
  if (!rail?.timeline?.length) return null;
  const roots: number[] = [];
  for (let bar = 0; bar < layoutBars; bar += 1) {
    const pc = beatPadsSpreadChordRootPcAtBar(rail, bar);
    roots.push(grooveLabClampBassRootMidi(12 * 3 + pc));
  }
  return roots;
}

export function se2BeatPadsSpreadRootMidiAtBar(opts: {
  track: Se2BeatPadsSpreadSourceTrack | undefined;
  barIndex: number;
  beatsPerBar: number;
  layoutBars: number;
  songKeyRoot: number;
  songKeyMode: ChordMode;
}): number | null {
  const tr = opts.track;
  if (!tr) return null;
  const layoutBars = Math.max(1, Math.round(opts.layoutBars));
  const bar = Math.max(0, Math.floor(opts.barIndex));
  const { keyRoot, keyMode } = se2BeatPadsHarmonyKey(tr, opts.songKeyRoot, opts.songKeyMode);

  const fromSteps = se2BeatPadsSpreadRootsFromHarmonySteps(
    tr,
    opts.beatsPerBar,
    layoutBars,
    keyRoot,
    keyMode,
  );
  if (fromSteps?.length) {
    return fromSteps[Math.min(bar, fromSteps.length - 1)] ?? null;
  }

  const notes = (tr.notes ?? []) as readonly StudioEditor2GenNote[];
  if (notes.length === 0) return null;
  const roll = se2BeatPadsSpreadRootsFromNotes(notes, opts.beatsPerBar, layoutBars, keyRoot);
  if (!roll.hasHarmony) return null;
  return roll.roots[Math.min(bar, roll.roots.length - 1)] ?? null;
}

/** Semitones for spread-roll 808-in-key at a grid column (SE2 chord-track roots only). */
export function se2BeatPadsSpreadKeyLockSemiAtCol(opts: {
  voiceRootMidi: number;
  track: Se2BeatPadsSpreadSourceTrack | undefined;
  gridCol: number;
  stepsPerBar: BeatPadsGridStepsPerBar;
  loopBars: BeatPadsSpreadLoopBars;
  beatsPerBar: number;
  keyLockEnabled: boolean;
  songKeyRoot: number;
  songKeyMode: ChordMode;
}): number {
  if (!opts.keyLockEnabled || !opts.track) return 0;
  const stepsPerBar = Math.max(1, opts.stepsPerBar);
  const bar = Math.floor(opts.gridCol / stepsPerBar);
  const layoutBars = Math.max(clampBeatPadsSpreadLoopBars(opts.loopBars), bar + 1);
  const rootMidi = se2BeatPadsSpreadRootMidiAtBar({
    track: opts.track,
    barIndex: bar,
    beatsPerBar: opts.beatsPerBar,
    layoutBars,
    songKeyRoot: opts.songKeyRoot,
    songKeyMode: opts.songKeyMode,
  });
  if (rootMidi == null) return 0;
  const chordPc = ((Math.round(rootMidi) % 12) + 12) % 12;
  const voicePc = ((Math.round(opts.voiceRootMidi) % 12) + 12) % 12;
  return se2BeatPadsKickKeySemitones(chordPc, voicePc);
}
