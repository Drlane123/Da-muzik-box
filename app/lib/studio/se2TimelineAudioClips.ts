/**
 * Studio Editor 2 — timeline WAV clip helpers (split, trim, peaks slice).
 */

export type Se2TimelineAudioClip = {
  id: string;
  sourceId: string;
  startBeat: number;
  durationBeats: number;
  name?: string;
  /** Trim into shared `sourceId` buffer, in quarter-note beats at project BPM. */
  sourceOffsetBeats?: number;
};

export const SE2_MIN_AUDIO_CLIP_DURATION_BEATS = 1 / 16;

export function se2AudioClipSourceOffsetBeats(clip: Se2TimelineAudioClip): number {
  return Math.max(0, clip.sourceOffsetBeats ?? 0);
}

export function se2AudioClipEndBeat(clip: Se2TimelineAudioClip): number {
  return clip.startBeat + clip.durationBeats;
}

function se2AudioClipsOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Drop or trim existing timeline clips covered by a new recording range — punch-replace
 * so re-recording at the same playhead does not stack takes on top of each other.
 */
export function se2PunchReplaceAudioClipsUnderRange(
  clips: readonly Se2TimelineAudioClip[],
  recordStartBeat: number,
  recordDurationBeats: number,
): Se2TimelineAudioClip[] {
  const eps = 1e-5;
  const r0 = Math.max(0, recordStartBeat);
  const r1 = Math.max(r0 + SE2_MIN_AUDIO_CLIP_DURATION_BEATS, r0 + recordDurationBeats);
  const out: Se2TimelineAudioClip[] = [];

  for (const clip of clips) {
    const c0 = clip.startBeat;
    const c1 = se2AudioClipEndBeat(clip);
    if (!se2AudioClipsOverlap(c0, c1, r0, r1)) {
      out.push(clip);
      continue;
    }

    if (c0 < r0 - eps) {
      const leftDur = Math.min(c1, r0) - c0;
      if (leftDur >= SE2_MIN_AUDIO_CLIP_DURATION_BEATS) {
        out.push({ ...clip, id: se2NewAudioClipId(), durationBeats: leftDur });
      }
    }

    if (c1 > r1 + eps) {
      const rightStart = Math.max(c0, r1);
      const rightDur = c1 - rightStart;
      if (rightDur >= SE2_MIN_AUDIO_CLIP_DURATION_BEATS) {
        const trimBeats = rightStart - c0;
        out.push({
          ...clip,
          id: se2NewAudioClipId(),
          startBeat: rightStart,
          durationBeats: rightDur,
          sourceOffsetBeats: se2AudioClipSourceOffsetBeats(clip) + trimBeats,
        });
      }
    }
  }

  return out;
}

export function se2NewAudioClipId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? `ac-${crypto.randomUUID()}`
    : `ac-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function se2SplitAudioClipAtBeat(
  clip: Se2TimelineAudioClip,
  splitBeat: number,
  opts?: { sourceOffsetBeatScale?: number },
): [Se2TimelineAudioClip, Se2TimelineAudioClip] | null {
  const eps = 1e-5;
  const srcOff = se2AudioClipSourceOffsetBeats(clip);
  if (splitBeat <= clip.startBeat + eps || splitBeat >= se2AudioClipEndBeat(clip) - eps) return null;
  const leftDur = splitBeat - clip.startBeat;
  const rightDur = se2AudioClipEndBeat(clip) - splitBeat;
  if (leftDur < SE2_MIN_AUDIO_CLIP_DURATION_BEATS || rightDur < SE2_MIN_AUDIO_CLIP_DURATION_BEATS) {
    return null;
  }
  const offScale = opts?.sourceOffsetBeatScale ?? 1;
  return [
    { ...clip, id: se2NewAudioClipId(), durationBeats: leftDur },
    {
      ...clip,
      id: se2NewAudioClipId(),
      startBeat: splitBeat,
      durationBeats: rightDur,
      sourceOffsetBeats: srcOff + leftDur * offScale,
    },
  ];
}

export function se2SliceWaveformPeaksForClip(
  peaks: number[],
  sourceOffsetBeats: number,
  clipDurationBeats: number,
  sourceDurationBeats: number,
  bucketCount: number,
): number[] {
  const buckets = Math.max(8, Math.floor(bucketCount));
  if (peaks.length === 0 || sourceDurationBeats <= 0) {
    return Array.from({ length: buckets }, () => 0.08);
  }
  const startFrac = Math.max(0, Math.min(1, sourceOffsetBeats / sourceDurationBeats));
  const endFrac = Math.max(startFrac, Math.min(1, (sourceOffsetBeats + clipDurationBeats) / sourceDurationBeats));
  const i0 = Math.floor(startFrac * peaks.length);
  const i1 = Math.max(i0 + 1, Math.ceil(endFrac * peaks.length));
  const slice = peaks.slice(i0, i1);
  if (slice.length === 0) return Array.from({ length: buckets }, () => 0.08);
  const out: number[] = new Array(buckets);
  const step = slice.length / buckets;
  for (let i = 0; i < buckets; i++) {
    const a = Math.floor(i * step);
    const b = Math.min(slice.length, Math.floor((i + 1) * step));
    let peak = 0;
    for (let j = a; j < b; j++) peak = Math.max(peak, slice[j] ?? 0);
    out[i] = peak;
  }
  return out;
}

export function se2BufferDurationBeats(buffer: AudioBuffer, bpm: number): number {
  const spb = 60 / Math.max(1, bpm);
  return Math.max(SE2_MIN_AUDIO_CLIP_DURATION_BEATS, buffer.duration / spb);
}
