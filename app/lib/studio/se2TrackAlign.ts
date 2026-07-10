/**
 * SE2 Track Align — dedicated audio lane with tempo-locked time stretch.
 */
import { beatLabPadPlaybackRateDetune } from '@/app/lib/creationStation/beatLabMidiRoll';
import { detectBpmForTrackAlign } from '@/app/lib/studio/studioAudioClipAnalysis';

export function se2TrackIsTrackAlign(kind: string | undefined): boolean {
  return kind === 'trackAlign';
}

/** Audio clip lanes (plain audio + Track Align). */
export function se2TrackIsAudioClipLane(kind: string | undefined): boolean {
  return kind === 'audio' || kind === 'trackAlign';
}

export function se2TrackUsesTimeStretchAlign(kind: string | undefined): boolean {
  return kind === 'trackAlign';
}

/** Lanes that accept audio clip drag-and-drop (Audio ↔ Track Align). */
export function se2TrackCanReceiveAudioClipDrag(kind: string | undefined): boolean {
  return se2TrackIsAudioClipLane(kind);
}

/** Lanes with draggable audio regions on the timeline (includes A2M / Synth Geno strips). */
export function se2TrackHasDraggableAudioClips(kind: string | undefined): boolean {
  return kind === 'audio' || kind === 'trackAlign' || kind === 'a2m' || kind === 'synthGeno';
}

export type Se2AlignClipMeta = {
  sourceBpm?: number;
  /** When true (default on Track Align), clip wall length is pitch-stable time-stretch. */
  alignTempoLock?: boolean;
  /** Trim mode — fixed buffer↔timeline ratio (edge drag without Shift). */
  alignWallStretchRate?: number;
};

export function se2ClipUsesAlignStretchPlayback(
  trackKind: string | undefined,
  clip: Se2AlignClipMeta,
): boolean {
  return se2TrackUsesTimeStretchAlign(trackKind) && clip.alignTempoLock !== false;
}

export function se2PrepareClipForAlignLane<T extends Se2AlignClipMeta & { durationBeats: number }>(
  clip: T,
  buffer: AudioBuffer | null | undefined,
  projectBpm: number,
): T {
  const sourceBpm =
    clip.sourceBpm ??
    (buffer ? se2TrackAlignDetectSourceBpm(buffer, projectBpm) : Math.max(30, projectBpm));
  return {
    ...clip,
    sourceBpm,
    alignTempoLock: clip.alignTempoLock !== false,
  };
}

export function se2TrackAlignDetectSourceBpm(buffer: AudioBuffer, projectBpm: number): number {
  return detectBpmForTrackAlign(buffer, projectBpm);
}

export function se2TrackAlignClipDurationBeats(durationSec: number, sourceBpm: number): number {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return 1 / 16;
  const bpm = Math.max(30, Math.min(300, sourceBpm));
  return Math.max(1 / 16, durationSec / (60 / bpm));
}

/** After manual source BPM fix — resize clip beats to match buffer at new tempo. */
export function se2TrackAlignRescaleClipForSourceBpm<T extends Se2AlignClipMeta & { durationBeats: number }>(
  clip: T,
  bufferDurationSec: number,
  newSourceBpm: number,
): T {
  const bpm = Math.max(40, Math.min(300, Math.round(newSourceBpm)));
  return {
    ...clip,
    sourceBpm: bpm,
    durationBeats: se2TrackAlignClipDurationBeats(bufferDurationSec, bpm),
    alignWallStretchRate: undefined,
  };
}

/** Pitch-stable stretch ratio: audible buffer span ÷ timeline wall seconds. */
export function se2TrackAlignStretchRate(opts: {
  bufferDurationSec: number;
  sourceOffsetSec: number;
  clipWallDurationSec: number;
}): number {
  const usableBuf = Math.max(0.02, opts.bufferDurationSec - Math.max(0, opts.sourceOffsetSec));
  const wallDur = Math.max(0.02, opts.clipWallDurationSec);
  return usableBuf / wallDur;
}

/** Left-edge trim on a stretched clip — advance source offset in stored beat units. */
export function se2TrackAlignSourceOffsetBeatDelta(
  timelineDeltaBeats: number,
  stretchRate: number,
): number {
  return timelineDeltaBeats * Math.max(0.02, stretchRate);
}

export function se2TrackAlignClipStretchRateFromClip(
  clip: { durationBeats: number; sourceOffsetBeats?: number },
  bufferDurationSec: number,
  projectBpm: number,
): number {
  const spb = 60 / Math.max(1, projectBpm);
  const sourceOffsetSec = Math.max(0, clip.sourceOffsetBeats ?? 0) * spb;
  return se2TrackAlignStretchRate({
    bufferDurationSec,
    sourceOffsetSec,
    clipWallDurationSec: Math.max(1 / 16, clip.durationBeats) * spb,
  });
}

export function se2TrackAlignMaxDurationBeatsAtLockedRate(
  bufferDurationSec: number,
  sourceOffsetSec: number,
  lockedStretchRate: number,
  projectBpm: number,
): number {
  const usable = Math.max(0.02, bufferDurationSec - Math.max(0, sourceOffsetSec));
  const rate = Math.max(0.02, lockedStretchRate);
  const wallSec = usable / rate;
  const spb = 60 / Math.max(1, projectBpm);
  return Math.max(1 / 16, wallSec / spb);
}

/** Schedule dedupe key — must change when clip wall geometry or stretch mode changes. */
export function se2AudioClipPreviewScheduleKey(
  trackId: string,
  clip: {
    id: string;
    startBeat: number;
    durationBeats: number;
    sourceOffsetBeats?: number;
    alignWallStretchRate?: number;
  },
  timeStretchAlign: boolean,
): string {
  const off = Math.max(0, clip.sourceOffsetBeats ?? 0);
  const lock = clip.alignWallStretchRate ?? 0;
  return `${trackId}:${clip.id}:${clip.startBeat}:${clip.durationBeats}:${off}:${lock}:${timeStretchAlign ? 1 : 0}`;
}

export type Se2TrackAlignPlaybackSegment = {
  playbackRate: number;
  detuneCents: number;
  bufferOffsetSec: number;
  bufferPlaySec: number;
};

/** Map timeline wall time ↔ buffer with pitch-stable stretch. */
export function se2TrackAlignPlaybackForWallSegment(opts: {
  bufferDurationSec: number;
  sourceOffsetSec: number;
  clipWallDurationSec: number;
  timelineOffsetSec: number;
  wallRemainSec: number;
  /** Trim mode — keep this buffer↔wall ratio instead of fitting the whole buffer. */
  lockedStretchRate?: number;
}): Se2TrackAlignPlaybackSegment {
  const sourceOffsetSec = Math.max(0, opts.sourceOffsetSec);
  const wallDur = Math.max(0.02, opts.clipWallDurationSec);
  const stretchRate =
    opts.lockedStretchRate != null && opts.lockedStretchRate > 0
      ? opts.lockedStretchRate
      : se2TrackAlignStretchRate({
          bufferDurationSec: opts.bufferDurationSec,
          sourceOffsetSec,
          clipWallDurationSec: wallDur,
        });
  const timelineOff = Math.max(0, opts.timelineOffsetSec);
  const wallRemain = Math.max(0.02, opts.wallRemainSec);
  const bufStart = sourceOffsetSec + timelineOff * stretchRate;
  const bufPlay = Math.min(wallRemain * stretchRate, Math.max(0.02, opts.bufferDurationSec - bufStart));
  const { playbackRate, detuneCents } = beatLabPadPlaybackRateDetune(stretchRate, 0, true);
  return {
    playbackRate,
    detuneCents,
    bufferOffsetSec: bufStart,
    bufferPlaySec: Math.max(0.02, bufPlay),
  };
}
