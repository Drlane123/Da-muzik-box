/** Non-destructive clip timeline — trim, move, split, erase. */

import { dbToLin } from '@/app/lib/masteringBay/masteringBayMeterAnalysis';

export const MIN_CLIP_GAP_SEC = 0.01;
export const MIN_TRIM_SEC = 0.05;
export const MIN_FADE_SEC = 0.02;
export const MAX_FADE_SEC = 120;
/** Pre-master clip input gain (Studio One event gain) — applied before the rack. */
export const SOURCE_GAIN_DB_MIN = -24;
export const SOURCE_GAIN_DB_MAX = 24;
export const SOURCE_GAIN_DB_DEFAULT = 0;

let clipIdSeq = 0;
export function nextClipId(): string {
  clipIdSeq += 1;
  return `mb-clip-${clipIdSeq}`;
}

export type MasteringBayTimelineClip = {
  id: string;
  buffer: AudioBuffer;
  /** Absolute start on the mastering timeline ruler (seconds). */
  timelineStartSec: number;
  trimStartSec: number;
  trimEndSec: number;
  /** Linear fade-in duration from clip start (seconds). */
  fadeInSec: number;
  /** Linear fade-out duration before clip end (seconds). */
  fadeOutSec: number;
  /** Pre-rack clip level in dB (0 = unity). */
  sourceGainDb: number;
};

export type MasteringBayClipEditState = {
  clips: MasteringBayTimelineClip[];
};

export type MasteringBayPlaybackSegment = {
  clipId: string;
  buffer: AudioBuffer;
  bufferOffsetSec: number;
  durationSec: number;
  timelineStartSec: number;
  timelineEndSec: number;
  fadeInSec: number;
  fadeOutSec: number;
  sourceGainDb: number;
};

export function clampSourceGainDb(db: number): number {
  if (!Number.isFinite(db)) return SOURCE_GAIN_DB_DEFAULT;
  return Math.max(SOURCE_GAIN_DB_MIN, Math.min(SOURCE_GAIN_DB_MAX, db));
}

export function sourceGainLinForClip(clip: MasteringBayTimelineClip): number {
  return dbToLin(clampSourceGainDb(clip.sourceGainDb ?? SOURCE_GAIN_DB_DEFAULT));
}

export function applySourceGainToClip(
  clip: MasteringBayTimelineClip,
  gainDb: number,
): MasteringBayTimelineClip {
  return { ...clip, sourceGainDb: clampSourceGainDb(gainDb) };
}

export function formatSourceGainDb(db: number): string {
  const g = clampSourceGainDb(db);
  if (Math.abs(g) < 0.05) return '0 dB';
  const sign = g > 0 ? '+' : '';
  return `${sign}${g.toFixed(1)} dB`;
}

/** True when trim, position, or fades changed — not source gain alone. */
export function clipTimelineStructureChanged(
  prev: MasteringBayTimelineClip[],
  next: MasteringBayTimelineClip[],
): boolean {
  if (prev.length !== next.length) return true;
  for (let i = 0; i < prev.length; i++) {
    const a = prev[i]!;
    const b = next[i]!;
    if (
      a.id !== b.id ||
      a.timelineStartSec !== b.timelineStartSec ||
      a.trimStartSec !== b.trimStartSec ||
      a.trimEndSec !== b.trimEndSec ||
      a.fadeInSec !== b.fadeInSec ||
      a.fadeOutSec !== b.fadeOutSec
    ) {
      return true;
    }
  }
  return false;
}

/** Gain applied to the source bus — active clip when set, otherwise first clip. */
export function resolveTimelineSourceGainDb(
  clips: MasteringBayTimelineClip[],
  activeClipId?: string | null,
): number {
  if (clips.length === 0) return SOURCE_GAIN_DB_DEFAULT;
  if (activeClipId) {
    const active = clips.find((c) => c.id === activeClipId);
    if (active) return clampSourceGainDb(active.sourceGainDb ?? SOURCE_GAIN_DB_DEFAULT);
  }
  return clampSourceGainDb(clips[0]!.sourceGainDb ?? SOURCE_GAIN_DB_DEFAULT);
}

export function clipVisibleDurationSec(clip: MasteringBayTimelineClip): number {
  return Math.max(0, clip.trimEndSec - clip.trimStartSec);
}

export function clipTimelineEndSec(clip: MasteringBayTimelineClip): number {
  return clip.timelineStartSec + clipVisibleDurationSec(clip);
}

export function clipEditTimelineSpanSec(state: MasteringBayClipEditState): number {
  let end = 0;
  for (const c of state.clips) end = Math.max(end, clipTimelineEndSec(c));
  return end;
}

export function maxFadeSecForClip(clip: MasteringBayTimelineClip): number {
  const vis = clipVisibleDurationSec(clip);
  return Math.max(0, vis - MIN_TRIM_SEC);
}

export function clampFadesForClip(clip: MasteringBayTimelineClip): MasteringBayTimelineClip {
  const vis = clipVisibleDurationSec(clip);
  const maxFade = Math.max(0, vis - MIN_TRIM_SEC);
  let fadeIn = Math.max(0, Math.min(maxFade, clip.fadeInSec));
  let fadeOut = Math.max(0, Math.min(maxFade, clip.fadeOutSec));
  if (fadeIn + fadeOut > vis - MIN_TRIM_SEC) {
    const scale = (vis - MIN_TRIM_SEC) / Math.max(MIN_FADE_SEC, fadeIn + fadeOut);
    fadeIn *= scale;
    fadeOut *= scale;
  }
  return { ...clip, fadeInSec: fadeIn, fadeOutSec: fadeOut };
}

export function createClipFromBuffer(
  buffer: AudioBuffer,
  timelineStartSec = 0,
): MasteringBayTimelineClip {
  return {
    id: nextClipId(),
    buffer,
    timelineStartSec: Math.max(0, timelineStartSec),
    trimStartSec: 0,
    trimEndSec: buffer.duration,
    fadeInSec: 0,
    fadeOutSec: 0,
    sourceGainDb: SOURCE_GAIN_DB_DEFAULT,
  };
}

export function createClipEditFromBuffer(buffer: AudioBuffer): MasteringBayClipEditState {
  return {
    clips: [createClipFromBuffer(buffer, 0)],
  };
}

export function findClipAtTimelineSec(
  clips: MasteringBayTimelineClip[],
  timelineSec: number,
): MasteringBayTimelineClip | null {
  for (const c of clips) {
    const start = c.timelineStartSec;
    const end = clipTimelineEndSec(c);
    if (timelineSec >= start - 0.0001 && timelineSec <= end + 0.0001) return c;
  }
  return null;
}

/** Map timeline seconds → in-buffer seconds for a clip. */
export function timelineSecToBufferSec(clip: MasteringBayTimelineClip, timelineSec: number): number {
  const rel = timelineSec - clip.timelineStartSec;
  return clip.trimStartSec + Math.max(0, Math.min(clipVisibleDurationSec(clip), rel));
}

export function buildPlaybackSchedule(clips: MasteringBayTimelineClip[]): MasteringBayPlaybackSegment[] {
  return clips
    .map((c) => {
      const dur = clipVisibleDurationSec(c);
      return {
        clipId: c.id,
        buffer: c.buffer,
        bufferOffsetSec: c.trimStartSec,
        durationSec: dur,
        timelineStartSec: c.timelineStartSec,
        timelineEndSec: c.timelineStartSec + dur,
        fadeInSec: c.fadeInSec,
        fadeOutSec: c.fadeOutSec,
        sourceGainDb: clampSourceGainDb(c.sourceGainDb ?? SOURCE_GAIN_DB_DEFAULT),
      };
    })
    .filter((s) => s.durationSec > MIN_TRIM_SEC)
    .sort((a, b) => a.timelineStartSec - b.timelineStartSec);
}

export function resolvePlaybackAtTimeline(
  schedule: MasteringBayPlaybackSegment[],
  timelineSec: number,
): { segment: MasteringBayPlaybackSegment; bufferOffsetSec: number } | null {
  for (const seg of schedule) {
    if (timelineSec >= seg.timelineStartSec && timelineSec < seg.timelineEndSec - 0.0001) {
      const rel = timelineSec - seg.timelineStartSec;
      return { segment: seg, bufferOffsetSec: seg.bufferOffsetSec + rel };
    }
  }
  return null;
}

export function extractBufferRegion(
  ctx: BaseAudioContext,
  buffer: AudioBuffer,
  startSec: number,
  endSec: number,
): AudioBuffer {
  const start = Math.max(0, Math.min(buffer.duration, startSec));
  const end = Math.max(start + MIN_TRIM_SEC, Math.min(buffer.duration, endSec));
  const startSample = Math.floor(start * buffer.sampleRate);
  const endSample = Math.min(buffer.length, Math.ceil(end * buffer.sampleRate));
  const len = Math.max(1, endSample - startSample);
  const out = ctx.createBuffer(buffer.numberOfChannels, len, buffer.sampleRate);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    out.getChannelData(ch).set(buffer.getChannelData(ch).subarray(startSample, startSample + len));
  }
  return out;
}

/** Remove one clip from the edit state. Returns null when no clips remain. */
export function deleteClipById(
  state: MasteringBayClipEditState,
  clipId: string,
): MasteringBayClipEditState | null {
  const nextClips = state.clips.filter((c) => c.id !== clipId);
  if (nextClips.length === 0) return null;
  return { clips: nextClips };
}

export function splitClipAtTimelineSec(
  clip: MasteringBayTimelineClip,
  timelineSec: number,
): [MasteringBayTimelineClip, MasteringBayTimelineClip] | null {
  const cutBuf = timelineSecToBufferSec(clip, timelineSec);
  if (
    cutBuf <= clip.trimStartSec + MIN_TRIM_SEC ||
    cutBuf >= clip.trimEndSec - MIN_TRIM_SEC
  ) {
    return null;
  }
  const left: MasteringBayTimelineClip = clampFadesForClip({
    ...clip,
    id: nextClipId(),
    trimEndSec: cutBuf,
    fadeOutSec: Math.min(clip.fadeOutSec, (cutBuf - clip.trimStartSec) * 0.5),
  });
  const rightDur = clip.trimEndSec - cutBuf;
  const right: MasteringBayTimelineClip = clampFadesForClip({
    ...clip,
    id: nextClipId(),
    timelineStartSec: timelineSec,
    trimStartSec: cutBuf,
    fadeInSec: Math.min(clip.fadeInSec, rightDur * 0.5),
  });
  return [left, right];
}

export function applyTrimToClip(
  clip: MasteringBayTimelineClip,
  edge: 'start' | 'end',
  bufferSec: number,
): MasteringBayTimelineClip {
  const dur = clip.buffer.duration;
  let trimStart = clip.trimStartSec;
  let trimEnd = clip.trimEndSec;
  if (edge === 'start') {
    trimStart = Math.max(0, Math.min(trimEnd - MIN_TRIM_SEC, bufferSec));
  } else {
    trimEnd = Math.max(trimStart + MIN_TRIM_SEC, Math.min(dur, bufferSec));
  }
  const delta = trimStart - clip.trimStartSec;
  return clampFadesForClip({
    ...clip,
    timelineStartSec: clip.timelineStartSec + delta,
    trimStartSec: trimStart,
    trimEndSec: trimEnd,
  });
}

export function applyFadeToClip(
  clip: MasteringBayTimelineClip,
  edge: 'in' | 'out',
  timelineSec: number,
): MasteringBayTimelineClip {
  const vis = clipVisibleDurationSec(clip);
  const rel = Math.max(0, Math.min(vis, timelineSec - clip.timelineStartSec));
  if (edge === 'in') {
    const fadeIn = Math.max(0, Math.min(vis - clip.fadeOutSec - MIN_TRIM_SEC, rel));
    return clampFadesForClip({ ...clip, fadeInSec: fadeIn });
  }
  const fadeOut = Math.max(0, Math.min(vis - clip.fadeInSec - MIN_TRIM_SEC, vis - rel));
  return clampFadesForClip({ ...clip, fadeOutSec: fadeOut });
}
