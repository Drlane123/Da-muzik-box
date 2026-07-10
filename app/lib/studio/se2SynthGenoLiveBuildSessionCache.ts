/**
 * Geno Build 1 — in-memory live loop draft per Synth Geno track (for cross-panel chord import).
 */
import { notifyGenoBuildSessionChanged } from '@/app/lib/studio/genoBuildSessionNotify';
import type { GenoBarChordSpec } from '@/app/lib/studio/se2SynthGenoChordEngine';
import type { Se2SynthGenoPluginDraft } from '@/app/lib/studio/se2SynthGenoChordPlugin';
import type { GenoLoopBarCount } from '@/app/lib/studio/se2SynthGenoLoopBarCount';
import type { StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';
import type { ChordSymbol } from '@/app/lib/creationStation/chordBuilder';

/** Enough state to rebuild B01 chord voicings after the panel closes. */
export type Se2SynthGenoLiveBuildB01Snapshot = {
  presetId: string;
  editRomans: ChordSymbol[];
  orderedSpecs: GenoBarChordSpec[];
  barCount: GenoLoopBarCount;
  playOrder: number[];
  liveBarSpecPatches: Record<number, GenoBarChordSpec>;
  keyRoot: number;
  keyMode: StudioDetectedKeyMode;
  beatsPerBar: number;
  bpm: number;
  enableChords: boolean;
};

export type Se2SynthGenoLiveBuildSession = {
  draft: Se2SynthGenoPluginDraft;
  label: string;
  keyRoot: number;
  keyMode: StudioDetectedKeyMode;
  bpm: number;
  beatsPerBar: number;
  updatedAt: number;
  b01Snapshot?: Se2SynthGenoLiveBuildB01Snapshot;
};

const liveBuildByTrack = new Map<number, Se2SynthGenoLiveBuildSession>();

export function readSe2SynthGenoLiveBuildSession(trackIndex: number): Se2SynthGenoLiveBuildSession | undefined {
  return liveBuildByTrack.get(trackIndex);
}

export function writeSe2SynthGenoLiveBuildSession(
  trackIndex: number,
  session: Se2SynthGenoLiveBuildSession,
): void {
  liveBuildByTrack.set(trackIndex, session);
  notifyGenoBuildSessionChanged();
}

export function clearSe2SynthGenoLiveBuildSession(trackIndex: number): void {
  if (!liveBuildByTrack.delete(trackIndex)) return;
  notifyGenoBuildSessionChanged();
}
