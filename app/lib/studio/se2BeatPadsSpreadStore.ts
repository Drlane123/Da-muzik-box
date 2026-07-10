/**
 * SE2 Beat Pads — spread roll persisted on the lane (survives track deselect / remount).
 */
import type { BeatPadsSpreadDirection } from '@/app/lib/creationStation/beatPadsHitSpread';
import type {
  BeatPadsSpreadLoopBars,
  BeatPadsSpreadNote,
  BeatPadsSpreadTrackState,
} from '@/app/lib/creationStation/beatPadsSpreadTrack';
import type { BeatPadsGridStepsPerBar } from '@/app/lib/creationStation/beatLabDrumMachineSequencer';

export type Se2BeatPadsSpreadSnapshot = {
  sourcePad: number;
  direction: BeatPadsSpreadDirection;
  rootMidi: number;
  baseLabel: string;
  loopBars: BeatPadsSpreadLoopBars;
  stepsPerBar: BeatPadsGridStepsPerBar;
  mixerChannel: number;
  keyLockEnabled?: boolean;
  harmonyTrackIndex?: number;
  notes: BeatPadsSpreadNote[];
};

export function se2BeatPadsSpreadSnapshotFromTrack(
  track: BeatPadsSpreadTrackState,
): Se2BeatPadsSpreadSnapshot {
  return {
    sourcePad: track.sourcePad,
    direction: track.direction,
    rootMidi: track.rootMidi,
    baseLabel: track.baseLabel,
    loopBars: track.loopBars,
    stepsPerBar: track.stepsPerBar,
    mixerChannel: track.mixerChannel,
    keyLockEnabled: track.keyLockEnabled ?? false,
    harmonyTrackIndex: track.harmonyTrackIndex,
    notes: track.notes,
  };
}

export function se2BeatPadsSpreadTrackFromSnapshot(
  snap: Se2BeatPadsSpreadSnapshot,
  sample: BeatPadsSpreadTrackState['sample'],
): BeatPadsSpreadTrackState {
  return {
    bank: 0,
    sourcePad: snap.sourcePad,
    direction: snap.direction,
    rootMidi: snap.rootMidi,
    baseLabel: snap.baseLabel,
    loopBars: snap.loopBars,
    stepsPerBar: snap.stepsPerBar,
    mixerChannel: snap.mixerChannel,
    keyLockEnabled: snap.keyLockEnabled ?? false,
    harmonyTrackIndex: snap.harmonyTrackIndex,
    notes: snap.notes,
    sample,
  };
}
