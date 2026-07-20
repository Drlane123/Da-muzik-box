/**
 * Studio Editor 2 — peak normalize + timeline consolidate (bounce to grid-locked clips).
 */
import {
  invalidateSe2AudioWaveformPeaks,
} from '@/app/lib/studio/se2AudioWaveformPeaks';
import {
  se2AudioClipSourceOffsetBeats,
  se2NewAudioClipId,
  type Se2TimelineAudioClip,
} from '@/app/lib/studio/se2TimelineAudioClips';
import { se2ClipGainDbToLin } from '@/app/lib/studio/se2AudioClipGain';
import {
  se2ClipUsesAlignStretchPlayback,
  se2TrackAlignPlaybackForWallSegment,
} from '@/app/lib/studio/se2TrackAlign';

const DEFAULT_TARGET_PEAK = 0.95;

/** Peak-normalize every channel — standard DAW normalize to ~−0.5 dBFS. */
export function normalizeSe2AudioBufferPeak(
  buf: AudioBuffer,
  targetPeak = DEFAULT_TARGET_PEAK,
): number {
  let peak = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const ch = buf.getChannelData(c);
    for (let i = 0; i < ch.length; i++) peak = Math.max(peak, Math.abs(ch[i]!));
  }
  if (peak <= 1e-8) return 1;
  const scale = targetPeak / peak;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const ch = buf.getChannelData(c);
    for (let i = 0; i < ch.length; i++) ch[i] = ch[i]! * scale;
  }
  return scale;
}

export type Se2ConsolidateTrackInput = {
  kind: string;
  name: string;
  audioClips: readonly Se2TimelineAudioClip[];
};

export type Se2ConsolidateRange = {
  startBeat: number;
  endBeat: number;
  durationBeats: number;
};

export function se2ClipOverlapsBeatRange(
  clip: Se2TimelineAudioClip,
  rangeStartBeat: number,
  rangeEndBeat: number,
): boolean {
  const clipEnd = clip.startBeat + clip.durationBeats;
  return clipEnd > rangeStartBeat + 1e-9 && clip.startBeat < rangeEndBeat - 1e-9;
}

/** Loop / ruler highlight → bar-snapped consolidate window. */
export function se2ConsolidateRangeFromLoop(
  loopStartBeat: number,
  loopEndBeat: number,
  totalBeats: number,
  beatsPerBar: number,
): Se2ConsolidateRange | null {
  const bpb = Math.max(2, Math.min(16, Math.round(beatsPerBar)));
  let startBeat = Math.max(0, loopStartBeat);
  let endBeat = Math.min(totalBeats, loopEndBeat);
  if (endBeat <= startBeat + 1 / 16) return null;
  startBeat = Math.floor(startBeat / bpb) * bpb;
  endBeat = Math.ceil(endBeat / bpb) * bpb;
  endBeat = Math.min(totalBeats, Math.max(endBeat, startBeat + bpb));
  if (endBeat <= startBeat + 1 / 16) return null;
  return { startBeat, endBeat, durationBeats: endBeat - startBeat };
}

/** Bar numbers (1-based) → consolidate beat range, clamped to arrangement length. */
export function se2ConsolidateRangeFromBars(
  startBar: number,
  endBar: number,
  maxBars: number,
  beatsPerBar: number,
): Se2ConsolidateRange | null {
  const bpb = Math.max(2, Math.min(16, Math.round(beatsPerBar)));
  const maxB = Math.max(1, Math.round(maxBars));
  const sBar = Math.max(1, Math.min(maxB, Math.round(startBar)));
  const eBar = Math.max(sBar, Math.min(maxB, Math.round(endBar)));
  const startBeat = (sBar - 1) * bpb;
  const endBeat = eBar * bpb;
  if (endBeat <= startBeat + 1 / 16) return null;
  return { startBeat, endBeat, durationBeats: endBeat - startBeat };
}

/** Minutes at project BPM → bar count (rounded up). */
export function se2ConsolidateBarsForMinutes(
  minutes: number,
  bpm: number,
  beatsPerBar: number,
  maxBars: number,
): number {
  const bpb = Math.max(2, Math.min(16, Math.round(beatsPerBar)));
  const beats = Math.max(bpb, minutes * Math.max(40, bpm));
  const bars = Math.ceil(beats / bpb);
  return Math.max(1, Math.min(maxBars, bars));
}

export function formatSe2ConsolidateRangeLabel(
  range: Se2ConsolidateRange,
  bpm: number,
  beatsPerBar: number,
): string {
  const bpb = Math.max(2, Math.min(16, Math.round(beatsPerBar)));
  const barA = Math.floor(range.startBeat / bpb) + 1;
  const barB = Math.max(barA, Math.ceil(range.endBeat / bpb));
  const sec = (range.durationBeats * 60) / Math.max(1, bpm);
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const time = m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `0:${String(s).padStart(2, '0')}`;
  return `Bars ${barA}–${barB} · ${time}`;
}

export type Se2ConsolidatedClipResult = {
  sourceId: string;
  clip: Se2TimelineAudioClip;
  buffer: AudioBuffer;
};

/**
 * Bounce lane regions inside `[rangeStartBeat, rangeEndBeat)` into one bar-locked clip.
 * Uses the loop / ruler highlight — not the full song length.
 */
export async function consolidateSe2TrackClips(
  ctx: BaseAudioContext,
  track: Se2ConsolidateTrackInput,
  buffers: ReadonlyMap<string, AudioBuffer>,
  opts: { bpm: number; rangeStartBeat: number; rangeEndBeat: number },
): Promise<Se2ConsolidatedClipResult | null> {
  if (track.audioClips.length === 0) return null;
  const bpm = Math.max(40, Math.min(240, opts.bpm));
  const rangeStart = Math.max(0, opts.rangeStartBeat);
  const rangeEnd = Math.max(rangeStart + 1 / 16, opts.rangeEndBeat);
  const rangeBeats = rangeEnd - rangeStart;
  const spb = 60 / bpm;
  const durationSec = rangeBeats * spb;
  const sampleRate = ctx.sampleRate;
  const frameCount = Math.max(1, Math.ceil(durationSec * sampleRate));

  const offline = new OfflineAudioContext(2, frameCount, sampleRate);
  let mixed = false;

  for (const clip of track.audioClips) {
    if (!se2ClipOverlapsBeatRange(clip, rangeStart, rangeEnd)) continue;

    const buf = buffers.get(clip.sourceId);
    if (!buf) continue;

    const clipEnd = clip.startBeat + clip.durationBeats;
    const overlapStart = Math.max(clip.startBeat, rangeStart);
    const overlapEnd = Math.min(clipEnd, rangeEnd);
    const overlapBeats = overlapEnd - overlapStart;
    const wallDur = Math.max(1 / 256, overlapBeats * spb);
    const timelineOffInClipBeats = overlapStart - clip.startBeat;
    const clipStartSec = (overlapStart - rangeStart) * spb;
    const baseSrcOffSec = se2AudioClipSourceOffsetBeats(clip) * spb;

    const source = offline.createBufferSource();
    source.buffer = buf;
    const gain = offline.createGain();
    gain.gain.value = se2ClipGainDbToLin(clip.gainDb ?? 0);
    source.connect(gain);
    gain.connect(offline.destination);

    const timeStretch = se2ClipUsesAlignStretchPlayback(track.kind, clip);
    if (timeStretch) {
      const seg = se2TrackAlignPlaybackForWallSegment({
        bufferDurationSec: buf.duration,
        sourceOffsetSec: baseSrcOffSec,
        clipWallDurationSec: Math.max(1 / 256, clip.durationBeats * spb),
        timelineOffsetSec: timelineOffInClipBeats * spb,
        wallRemainSec: wallDur,
        lockedStretchRate: (clip as { alignWallStretchRate?: number }).alignWallStretchRate,
      });
      source.playbackRate.value = seg.playbackRate;
      source.detune.value = seg.detuneCents;
      const playSec = Math.min(seg.bufferPlaySec, durationSec - clipStartSec);
      if (playSec > 0.001) {
        source.start(clipStartSec, seg.bufferOffsetSec, playSec);
        mixed = true;
      }
    } else {
      const srcOffSec = baseSrcOffSec + timelineOffInClipBeats * spb;
      const playSec = Math.min(
        wallDur,
        Math.max(0, buf.duration - srcOffSec),
        durationSec - clipStartSec,
      );
      if (playSec > 0.001) {
        source.start(clipStartSec, srcOffSec, playSec);
        mixed = true;
      }
    }
  }

  if (!mixed) return null;

  const rendered = await offline.startRendering();
  const sourceId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? `src-${crypto.randomUUID()}`
      : `src-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const clip: Se2TimelineAudioClip = {
    id: se2NewAudioClipId(),
    sourceId,
    startBeat: rangeStart,
    durationBeats: rangeBeats,
    name: `${track.name} · consolidated`,
    sourceBpm: bpm,
    alignTempoLock: false,
  };

  return { sourceId, clip, buffer: rendered };
}

export function applySe2NormalizeToSourceIds(
  buffers: Map<string, AudioBuffer>,
  sourceIds: readonly string[],
  targetPeak = DEFAULT_TARGET_PEAK,
): number {
  let touched = 0;
  for (const id of sourceIds) {
    const buf = buffers.get(id);
    if (!buf) continue;
    normalizeSe2AudioBufferPeak(buf, targetPeak);
    invalidateSe2AudioWaveformPeaks(id);
    touched += 1;
  }
  return touched;
}
