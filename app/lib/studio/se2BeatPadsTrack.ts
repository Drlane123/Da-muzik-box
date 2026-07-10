/**
 * Studio Editor 2 — dedicated Beat Pads drum-machine lane.
 */
import type { BeatLabProducerKitId } from '@/app/lib/creationStation/beatLabProducerKits';
import type {
  BeatPadsDrumPattern,
  BeatPadsGridStepsPerBar,
} from '@/app/lib/creationStation/beatLabDrumMachineSequencer';
import type { BeatPadsGenoBuildSlot } from '@/app/lib/creationStation/beatPadsSe2Bridge';
import type { StudioEditor2MidiTrack } from '@/app/lib/studio/studioEditor2Midi';
import type { Se2DrumGenStyle } from '@/app/lib/studio/se2DrumGeneratorTrack';
import type { Se2BeatPadsKickFollowMode } from '@/app/lib/studio/se2BeatPadsKickMatch';
import type { Se2BeatPadsSpreadSnapshot } from '@/app/lib/studio/se2BeatPadsSpreadStore';

export type Se2BeatPadsTrackFields = {
  kind: 'beatPads';
  beatPadsLoopBars?: number;
  beatPadsStepsPerBar?: BeatPadsGridStepsPerBar;
  /** Serialized note-lane pattern (full 16-lane grid). */
  beatPadsPattern?: BeatPadsDrumPattern;
  /** Linked chord / Geno / card lane — tempo, key, and groove style follow when locked. */
  beatPadsHarmonyTrackId?: string;
  /** Which Geno build tab to prefer when triggering. */
  beatPadsGenoBuildSlot?: BeatPadsGenoBuildSlot;
  /** Lock BPM, loop bars, and song key to the linked harmony lane. */
  beatPadsHarmonyLocked?: boolean;
  /** Style chip for pattern bank / matched groove (Pop, Trap, R&B, …). */
  beatPadsPatternStyle?: Se2DrumGenStyle;
  /** Last pattern-bank preset loaded via Match chords. */
  beatPadsMatchedPresetId?: string;
  /** Tune kick / 808 pads to linked song key (C-root sample → key root). */
  beatPadsKickKeyLock?: boolean;
  /** How kick lane aligns to chord cards when loading / applying match. */
  beatPadsKickFollowMode?: Se2BeatPadsKickFollowMode;
  /** Selected pad (0–15) for Apply kick + 808 in key — UI Pad N = index N−1. */
  beatPadsKickTargetPad?: number;
  /** @deprecated Use beatPadsSe2SyncMode — true meant transport linked (legacy master). */
  beatPadsSyncLocked?: boolean;
  /** SE2 transport link + tempo direction: master = pads drive SE2 BPM, slave = follow SE2 BPM. */
  beatPadsSe2SyncMode?: Se2BeatPadsSe2SyncMode;
  beatPadsProducerKitId?: BeatLabProducerKitId;
  /** Spread roll (CH 17) — notes + match track; survives lane deselect. */
  beatPadsSpread?: Se2BeatPadsSpreadSnapshot;
};

export type Se2BeatPadsTrack = StudioEditor2MidiTrack & Se2BeatPadsTrackFields;

export type Se2BeatPadsSe2SyncMode = 'off' | 'master' | 'slave';

export function se2BeatPadsSe2SyncMode(
  tr: Pick<Se2BeatPadsTrackFields, 'beatPadsSe2SyncMode' | 'beatPadsSyncLocked'>,
): Se2BeatPadsSe2SyncMode {
  if (tr.beatPadsSe2SyncMode === 'master' || tr.beatPadsSe2SyncMode === 'slave') {
    return tr.beatPadsSe2SyncMode;
  }
  return tr.beatPadsSyncLocked ? 'master' : 'off';
}

export function se2BeatPadsSe2TransportLinked(
  tr: Pick<Se2BeatPadsTrackFields, 'beatPadsSe2SyncMode' | 'beatPadsSyncLocked'>,
): boolean {
  return se2BeatPadsSe2SyncMode(tr) !== 'off';
}

export function studioTrackIsBeatPadsChannel(
  tr: { kind?: string } | undefined,
): tr is Se2BeatPadsTrack {
  return tr?.kind === 'beatPads';
}

export function nextBeatPadsTrackName(tracks: readonly { kind?: string; name?: string }[]): string {
  const n = tracks.filter((t) => t.kind === 'beatPads').length + 1;
  return n === 1 ? 'Beat Pads' : `Beat Pads ${n}`;
}

export function se2DefaultBeatPadsTrack(partial?: {
  id: string;
  name: string;
  colorHex: string;
}): Se2BeatPadsTrack & {
  id: string;
  name: string;
  colorHex: string;
  notes: [];
  audioClips: [];
} {
  return {
    id: partial?.id ?? 't-beat-pads',
    name: partial?.name ?? 'Beat Pads',
    colorHex: partial?.colorHex ?? '#7cf4c6',
    kind: 'beatPads',
    midiChannel: 10,
    beatPadsLoopBars: 8,
    beatPadsStepsPerBar: 16,
    beatPadsPattern: Array.from({ length: 16 }, () => []),
    beatPadsHarmonyTrackId: '',
    beatPadsGenoBuildSlot: 'b01',
    beatPadsHarmonyLocked: false,
    beatPadsPatternStyle: 'pop',
    beatPadsMatchedPresetId: undefined,
    beatPadsKickKeyLock: false,
    beatPadsKickFollowMode: 'card',
    beatPadsKickTargetPad: 0,
    beatPadsSyncLocked: false,
    beatPadsSe2SyncMode: 'off',
    beatPadsProducerKitId: 'trapDarkVault',
    notes: [],
    audioClips: [],
  };
}
