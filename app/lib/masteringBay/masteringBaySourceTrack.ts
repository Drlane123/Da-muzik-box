/** Mastering Bay — stereo source lane (file drop / SE2 import hooks). */

export type MasteringBaySourceKind = 'empty' | 'file' | 'se2-master' | 'se2-track';

export type MasteringBaySourceMeta = {
  name: string;
  durationSec: number;
  sampleRate: number;
  channels: 1 | 2;
  sourceKind: MasteringBaySourceKind;
  /** SE2 track name or "Master" when imported from Studio Editor 2 */
  sourceLabel?: string;
};

export type MasteringBaySourcePayload = {
  meta: MasteringBaySourceMeta;
  buffer: AudioBuffer;
};

/** Fixed Mastering Bay source timeline length (time ruler + grid). */
export const MASTERING_BAY_TIMELINE_DURATION_SEC = 480;

/** Major ruler labels every minute on the 8-minute mastering timeline. */
export const MASTERING_BAY_RULER_MAJOR_STEP_SEC = 60;

/** Minimum pixels per second so 6:00 stays readable (enables horizontal scroll when narrow). */
export const MASTERING_BAY_TIMELINE_PX_PER_SEC = 4;

export function resolveMasteringBayTimelineDurationSec(clipDurationSec = 0): number {
  const clip = Number.isFinite(clipDurationSec) ? Math.max(0, clipDurationSec) : 0;
  return Math.max(MASTERING_BAY_TIMELINE_DURATION_SEC, clip);
}

export type MasteringBayRulerTick = { sec: number; major: boolean };

/** Deterministic 0:00 … 6:00 ruler — never ends at clip length. */
export function buildMasteringBayRulerTicks(timelineDurationSec: number): MasteringBayRulerTick[] {
  const dur = Math.max(MASTERING_BAY_TIMELINE_DURATION_SEC, timelineDurationSec);
  const majorStep = MASTERING_BAY_RULER_MAJOR_STEP_SEC;
  const minorStep = majorStep / 4;
  const ticks: MasteringBayRulerTick[] = [];
  for (let i = 0; i * minorStep <= dur + 0.001; i++) {
    const sec = Math.min(dur, i * minorStep);
    ticks.push({ sec, major: i % 4 === 0 });
  }
  const last = ticks[ticks.length - 1];
  if (!last || last.sec < dur - 0.01) {
    ticks.push({ sec: dur, major: true });
  }
  return ticks;
}

export function masteringBayTimelineMinWidthPx(timelineDurationSec: number): number {
  const dur = resolveMasteringBayTimelineDurationSec(timelineDurationSec);
  return Math.ceil(dur * MASTERING_BAY_TIMELINE_PX_PER_SEC);
}

export const MASTERING_BAY_AUDIO_ACCEPT =
  'audio/*,.wav,.mp3,.m4a,.ogg,.flac,.aif,.aiff,.webm,.aac';

const AUDIO_EXT = /\.(wav|mp3|m4a|ogg|flac|aif|aiff|webm|aac)$/i;

export function isMasteringBayAudioFile(file: File): boolean {
  if (file.type.startsWith('audio/')) return true;
  return AUDIO_EXT.test(file.name);
}

export async function decodeMasteringBayAudioFile(
  file: File,
  ctx: BaseAudioContext,
): Promise<AudioBuffer> {
  const raw = await file.arrayBuffer();
  return ctx.decodeAudioData(raw.slice(0));
}

export function metaFromAudioBuffer(
  buffer: AudioBuffer,
  name: string,
  sourceKind: MasteringBaySourceKind,
  sourceLabel?: string,
): MasteringBaySourceMeta {
  return {
    name,
    durationSec: buffer.duration,
    sampleRate: buffer.sampleRate,
    channels: buffer.numberOfChannels >= 2 ? 2 : 1,
    sourceKind,
    sourceLabel,
  };
}

function buildChannelPeaks(buffer: AudioBuffer, channel: number, columns: number): Float32Array {
  const peaks = new Float32Array(Math.max(8, columns));
  const data = buffer.getChannelData(Math.min(channel, buffer.numberOfChannels - 1));
  const step = Math.max(1, Math.floor(data.length / peaks.length));
  for (let i = 0; i < peaks.length; i++) {
    const start = i * step;
    const end = Math.min(data.length, start + step);
    let peak = 0;
    for (let s = start; s < end; s++) {
      const v = Math.abs(data[s] ?? 0);
      if (v > peak) peak = v;
    }
    peaks[i] = peak;
  }
  let max = 0;
  for (let i = 0; i < peaks.length; i++) max = Math.max(max, peaks[i] ?? 0);
  if (max > 0) {
    for (let i = 0; i < peaks.length; i++) peaks[i] = (peaks[i] ?? 0) / max;
  }
  return peaks;
}

/** Peak envelope for waveform paint — one value per column, 0–1. */
export function buildWaveformPeaks(buffer: AudioBuffer, columns: number): Float32Array {
  const ch0 = buffer.getChannelData(0);
  const ch1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : ch0;
  const peaks = new Float32Array(Math.max(8, columns));
  const step = Math.max(1, Math.floor(ch0.length / peaks.length));
  for (let i = 0; i < peaks.length; i++) {
    const start = i * step;
    const end = Math.min(ch0.length, start + step);
    let peak = 0;
    for (let s = start; s < end; s++) {
      const v = Math.max(Math.abs(ch0[s] ?? 0), Math.abs(ch1[s] ?? 0));
      if (v > peak) peak = v;
    }
    peaks[i] = peak;
  }
  let max = 0;
  for (let i = 0; i < peaks.length; i++) max = Math.max(max, peaks[i] ?? 0);
  if (max > 0) {
    for (let i = 0; i < peaks.length; i++) peaks[i] = (peaks[i] ?? 0) / max;
  }
  return peaks;
}

export type StereoWaveformPeaks = { left: Float32Array; right: Float32Array };

export function buildStereoWaveformPeaks(buffer: AudioBuffer, columns: number): StereoWaveformPeaks {
  const left = buildChannelPeaks(buffer, 0, columns);
  const right = buffer.numberOfChannels > 1 ? buildChannelPeaks(buffer, 1, columns) : left;
  return { left, right };
}

const RULER_MAJOR_STEPS_SEC = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600];

/** Major tick interval (seconds) for a time ruler of given width and duration. */
export function pickTimeRulerMajorStep(durationSec: number, widthPx: number): number {
  const dur = Math.max(1, durationSec);
  const w = Math.max(80, widthPx);
  const targetPx = 96;
  let best = RULER_MAJOR_STEPS_SEC[0]!;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const step of RULER_MAJOR_STEPS_SEC) {
    const tickCount = dur / step;
    const px = w / tickCount;
    const score = Math.abs(px - targetPx);
    if (score < bestScore) {
      bestScore = score;
      best = step;
    }
  }
  return best;
}

export function formatSourceDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Keep audio before cut time (discard the right side). */
export function sliceAudioBufferBefore(
  ctx: BaseAudioContext,
  buffer: AudioBuffer,
  cutSec: number,
): AudioBuffer | null {
  const dur = buffer.duration;
  const cut = Math.max(0, Math.min(dur, cutSec));
  if (cut <= 0.001) return null;
  const endSample = Math.max(1, Math.floor(cut * buffer.sampleRate));
  const out = ctx.createBuffer(buffer.numberOfChannels, endSample, buffer.sampleRate);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    out.getChannelData(ch).set(buffer.getChannelData(ch).subarray(0, endSample));
  }
  return out;
}

export function secToTimelinePct(sec: number, durationSec: number): number {
  const dur = Math.max(0.001, durationSec);
  return Math.max(0, Math.min(100, (sec / dur) * 100));
}

export function timelinePctToSec(pct: number, durationSec: number): number {
  const dur = Math.max(0.001, durationSec);
  return Math.max(0, Math.min(dur, (pct / 100) * dur));
}
