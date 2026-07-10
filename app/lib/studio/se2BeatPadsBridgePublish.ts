/**
 * Publish SE2 session snapshot for Beat Pads / Geno sync bridge.
 */
import { publishBeatPadsSe2BridgeSnapshot, type BeatPadsSe2BridgeSnapshot } from '@/app/lib/creationStation/beatPadsSe2Bridge';
import { studioTrackIsBeatPadsChannel } from '@/app/lib/studio/se2BeatPadsTrack';
import {
  se2GenoUltraPatchLabelFromTrack,
  studioTrackIsGenoUltraSynthChannel,
} from '@/app/lib/studio/se2GenoUltraSynthTrack';
import { studioTrackIsSynthGenoChannel } from '@/app/lib/studio/se2SynthGenoTrack';

export type Se2BeatPadsBridgePublishInput = {
  se2Active: boolean;
  bpm: number;
  loopBars: number;
  beatsPerBar: number;
  loopStartBeat: number;
  loopEndBeat: number;
  transport: 'stopped' | 'playing' | 'paused';
  tracks: readonly {
    id: string;
    name: string;
    laneNumber: number;
    kind?: string;
    synthGenoPatchLabel?: string;
    genoUltraPresetId?: string;
    genoUltraPatchLabel?: string;
    trackKeyRoot?: number;
    trackKeyMode?: 'major' | 'minor';
    rhythmLoopBars?: number;
    harmonyLoopBars?: number;
  }[];
};

export function se2PublishBeatPadsBridgeSnapshot(input: Se2BeatPadsBridgePublishInput): void {
  const synthGenoLanes = input.tracks
    .filter((t) => studioTrackIsSynthGenoChannel(t))
    .map((t) => ({
      trackId: t.id,
      name: t.name,
      laneNumber: t.laneNumber,
      kind: 'synthGeno' as const,
      patchLabel: t.synthGenoPatchLabel,
      loopBars: input.loopBars,
      beatsPerBar: input.beatsPerBar,
      bpm: input.bpm,
      keyRoot: t.trackKeyRoot,
      keyMode: t.trackKeyMode,
    }));

  const genoUltraLanes = input.tracks
    .filter((t) => studioTrackIsGenoUltraSynthChannel(t))
    .map((t) => ({
      trackId: t.id,
      name: t.name,
      laneNumber: t.laneNumber,
      kind: 'genoUltraSynth' as const,
      patchLabel: t.genoUltraPatchLabel ?? se2GenoUltraPatchLabelFromTrack(t),
      loopBars: input.loopBars,
      beatsPerBar: input.beatsPerBar,
      bpm: input.bpm,
      keyRoot: t.trackKeyRoot,
      keyMode: t.trackKeyMode,
    }));

  const genoLanes = [...synthGenoLanes, ...genoUltraLanes];

  const beatPadsLanes = input.tracks
    .filter((t) => studioTrackIsBeatPadsChannel(t))
    .map((t) => ({
      trackId: t.id,
      name: t.name,
      laneNumber: t.laneNumber,
    }));

  const snapshot: BeatPadsSe2BridgeSnapshot = {
    updatedAt: Date.now(),
    se2Active: input.se2Active,
    bpm: input.bpm,
    loopBars: input.loopBars,
    beatsPerBar: input.beatsPerBar,
    loopStartBeat: input.loopStartBeat,
    loopEndBeat: input.loopEndBeat,
    transport: input.transport,
    genoLanes,
    beatPadsLanes,
  };

  publishBeatPadsSe2BridgeSnapshot(snapshot);
}
