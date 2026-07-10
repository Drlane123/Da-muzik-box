/**
 * Vocal Enhancement Suite — browser DSP chain with hard auto-tune (T-Pain style).
 */
import {
  audioBufferToWavBlob,
  decodeAudioBlob,
} from '@/app/lib/vocalLab/rvcVoiceConverter';

export type VocalEnhancementSettings = {
  autotuneOn: boolean;
  /** 0..100 — 90+ = hard chromatic snap */
  autotune: number;
  noise: number;
  deess: number;
  clarity: number;
  smooth: number;
  /** 0 warm .. 100 bright */
  eq: number;
};

export type VocalEnhancementResult = {
  audioBuffer: AudioBuffer;
  wavBlob: Blob;
  durationSec: number;
  /** True when only a short preview segment was rendered. */
  isPreview: boolean;
  sourceDurationSec: number;
};

export const VOCAL_ENHANCE_PREVIEW_SEC = 20;

export type EnhanceVocalOptions = {
  /** Process only the first N seconds (fast preview). */
  maxDurationSec?: number;
  startSec?: number;
};

function sliceDecodedBuffer(decoded: AudioBuffer, startSec: number, maxDurationSec: number): AudioBuffer {
  const sr = decoded.sampleRate;
  const startSample = Math.max(0, Math.floor(startSec * sr));
  const maxSamples = Math.floor(maxDurationSec * sr);
  const length = Math.min(maxSamples, decoded.length - startSample);
  if (length <= 0) return decoded;

  const ctx = new OfflineAudioContext(decoded.numberOfChannels, length, sr);
  const out = ctx.createBuffer(decoded.numberOfChannels, length, sr);
  for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
    const src = decoded.getChannelData(ch);
    const dest = out.getChannelData(ch);
    for (let i = 0; i < length; i++) dest[i] = src[startSample + i] ?? 0;
  }
  return out;
}

const F_MIN = 60;
const F_MAX = 1400;
const PITCH_FRAME = 2048;
const PITCH_HOP = 128;

function hzToMidi(hz: number): number {
  return 69 + 12 * Math.log2(hz / 440);
}


function hann(i: number, n: number): number {
  return 0.5 * (1 - Math.cos((2 * Math.PI * i) / Math.max(1, n - 1)));
}

function frameRms(frame: Float32Array): number {
  let s = 0;
  for (let i = 0; i < frame.length; i++) s += frame[i]! * frame[i]!;
  return Math.sqrt(s / frame.length);
}

function autocorrPitchHz(samples: Float32Array, start: number, sr: number): number {
  const lagMin = Math.max(2, Math.floor(sr / F_MAX));
  const lagMax = Math.min(PITCH_FRAME - 2, Math.floor(sr / F_MIN));
  if (lagMax <= lagMin + 2) return 0;

  const win = new Float32Array(PITCH_FRAME);
  for (let i = 0; i < PITCH_FRAME; i++) {
    const x = samples[start + i] ?? 0;
    win[i] = x * hann(i, PITCH_FRAME);
  }

  let r0 = 0;
  for (let i = 0; i < PITCH_FRAME; i++) r0 += win[i]! * win[i]!;
  if (r0 < 1e-12) return 0;

  let bestLag = -1;
  let best = -Infinity;
  for (let lag = lagMin; lag <= lagMax; lag++) {
    let sum = 0;
    for (let i = 0; i < PITCH_FRAME - lag; i++) sum += win[i]! * win[i + lag]!;
    if (sum > best) {
      best = sum;
      bestLag = lag;
    }
  }
  if (bestLag < 2 || best <= 0) return 0;

  const f = sr / bestLag;
  if (!Number.isFinite(f) || f < F_MIN || f > F_MAX) return 0;
  return f;
}

function bufferToMono(buffer: AudioBuffer): Float32Array {
  const ch0 = buffer.getChannelData(0);
  if (buffer.numberOfChannels === 1) return ch0.slice();
  const ch1 = buffer.getChannelData(1);
  const out = new Float32Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) out[i] = (ch0[i]! + ch1[i]!) * 0.5;
  return out;
}

function linearAt(samples: Float32Array, idx: number): number {
  const i0 = Math.floor(idx);
  const i1 = Math.min(samples.length - 1, i0 + 1);
  const f = idx - i0;
  return samples[i0]! * (1 - f) + samples[i1]! * f;
}

type PitchNode = { sample: number; midi: number; voiced: boolean };

function analyzePitchNodes(samples: Float32Array, sr: number): PitchNode[] {
  const nodes: PitchNode[] = [];
  let gate = 0.002;
  const rmsList: number[] = [];
  for (let start = 0; start + PITCH_FRAME <= samples.length; start += PITCH_HOP) {
    rmsList.push(frameRms(samples.subarray(start, start + PITCH_FRAME)));
  }
  const sorted = rmsList.filter((r) => r > 0.0004).sort((a, b) => a - b);
  if (sorted.length > 0) {
    gate = Math.max(0.0015, Math.min(0.008, sorted[Math.floor(sorted.length * 0.12)]! * 0.35));
  }

  for (let fi = 0, start = 0; start + PITCH_FRAME <= samples.length; start += PITCH_HOP, fi++) {
    const rms = rmsList[fi] ?? 0;
    if (rms < gate) {
      nodes.push({ sample: start + PITCH_FRAME * 0.5, midi: NaN, voiced: false });
      continue;
    }
    const hz = autocorrPitchHz(samples, start, sr);
    nodes.push({
      sample: start + PITCH_FRAME * 0.5,
      midi: hz > 0 ? hzToMidi(hz) : NaN,
      voiced: hz > 0,
    });
  }
  return nodes;
}

/**
 * Hard / T-Pain style auto-tune — chromatic snap, fast retune at high strength.
 */
function applyAutotune(samples: Float32Array, sr: number, strengthPct: number): Float32Array {
  const strength = Math.max(0, Math.min(1, strengthPct / 100));
  if (strength < 0.02) return samples.slice();

  const nodes = analyzePitchNodes(samples, sr);
  const hardSnap = strength >= 0.88;

  const targets: number[] = nodes.map((n) => {
    if (!n.voiced || !Number.isFinite(n.midi)) return NaN;
    const snapped = Math.round(n.midi);
    let target = n.midi + (snapped - n.midi) * Math.min(1, strength * 1.08);
    if (hardSnap) target = snapped;
    return target;
  });

  if (!hardSnap && strength < 0.72) {
    for (let i = 1; i < targets.length - 1; i++) {
      const a = targets[i - 1]!;
      const b = targets[i]!;
      const c = targets[i + 1]!;
      if (Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(c)) {
        targets[i] = (a + b + c) / 3;
      }
    }
  }

  const out = new Float32Array(Math.ceil(samples.length * 1.15));
  let readIdx = 0;
  let outIdx = 0;
  const maxRead = samples.length - 2;

  const hopRates = new Float32Array(Math.ceil(samples.length / PITCH_HOP) + 1);
  for (let hi = 0; hi < hopRates.length; hi++) {
    const sampleAt = hi * PITCH_HOP;
    const nodeIdx = Math.min(nodes.length - 1, Math.max(0, Math.round(sampleAt / PITCH_HOP)));
    const n = nodes[nodeIdx];
    let rate = 1;
    if (n?.voiced && Number.isFinite(n.midi)) {
      const targetMidi = targets[nodeIdx];
      if (Number.isFinite(targetMidi)) {
        rate = Math.pow(2, (targetMidi! - n.midi) / 12);
        rate = Math.max(0.5, Math.min(2, rate));
      }
    }
    hopRates[hi] = rate;
  }

  while (outIdx < out.length - 1 && readIdx < maxRead) {
    const hopIdx = Math.min(hopRates.length - 1, Math.max(0, Math.floor(readIdx / PITCH_HOP)));
    out[outIdx] = linearAt(samples, readIdx);
    readIdx += hopRates[hopIdx] ?? 1;
    outIdx++;
  }

  return out.subarray(0, outIdx);
}

function applyNoiseReduction(samples: Float32Array, amountPct: number): Float32Array {
  const k = Math.max(0, Math.min(1, amountPct / 100));
  if (k < 0.02) return samples;

  const win = 512;
  const out = samples.slice();
  let floor = 0.0008;
  const rmses: number[] = [];
  for (let i = 0; i < samples.length; i += win) {
    const end = Math.min(samples.length, i + win);
    rmses.push(frameRms(samples.subarray(i, end)));
  }
  const sorted = [...rmses].sort((a, b) => a - b);
  if (sorted.length > 0) floor = Math.max(0.0003, sorted[Math.floor(sorted.length * 0.08)]!);

  for (let i = 0, wi = 0; i < samples.length; i += win, wi++) {
    const end = Math.min(samples.length, i + win);
    const rms = rmses[wi] ?? 0;
    const gate = floor * (1.8 + (1 - k) * 2.5);
    const gain = rms < gate ? Math.max(0.02, 1 - k * 0.92) : 1;
    for (let j = i; j < end; j++) out[j] = out[j]! * gain;
  }
  return out;
}

async function renderFxChain(
  samples: Float32Array,
  sr: number,
  settings: VocalEnhancementSettings,
): Promise<AudioBuffer> {
  const offline = new OfflineAudioContext(1, samples.length, sr);
  const buf = offline.createBuffer(1, samples.length, sr);
  buf.copyToChannel(samples, 0);

  const src = offline.createBufferSource();
  src.buffer = buf;

  const deessAmt = settings.deess / 100;
  const deess = offline.createBiquadFilter();
  deess.type = 'highshelf';
  deess.frequency.value = 6500;
  deess.gain.value = -deessAmt * 9;

  const clarityAmt = settings.clarity / 100;
  const clarity = offline.createBiquadFilter();
  clarity.type = 'peaking';
  clarity.frequency.value = 3600;
  clarity.Q.value = 1.1;
  clarity.gain.value = clarityAmt * 10;

  const eqT = (settings.eq - 50) / 50;
  const eqLow = offline.createBiquadFilter();
  eqLow.type = 'lowshelf';
  eqLow.frequency.value = 320;
  eqLow.gain.value = -eqT * 5;

  const eqHigh = offline.createBiquadFilter();
  eqHigh.type = 'highshelf';
  eqHigh.frequency.value = 5200;
  eqHigh.gain.value = eqT * 6;

  const comp = offline.createDynamicsCompressor();
  const smooth = settings.smooth / 100;
  comp.threshold.value = -18 - smooth * 14;
  comp.ratio.value = 2 + smooth * 5;
  comp.attack.value = 0.004;
  comp.release.value = 0.08 + smooth * 0.14;

  const limiter = offline.createDynamicsCompressor();
  limiter.threshold.value = -3;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.06;

  const outG = offline.createGain();
  outG.gain.value = 1.05;

  src.connect(deess);
  deess.connect(clarity);
  clarity.connect(eqLow);
  eqLow.connect(eqHigh);
  eqHigh.connect(comp);
  comp.connect(limiter);
  limiter.connect(outG);
  outG.connect(offline.destination);
  src.start(0);

  return offline.startRendering();
}

export async function enhanceVocal(
  liveCtx: AudioContext,
  sourceBlob: Blob,
  settings: VocalEnhancementSettings,
  options?: EnhanceVocalOptions,
): Promise<VocalEnhancementResult> {
  let decoded = await decodeAudioBlob(liveCtx, sourceBlob);
  if (decoded.duration < 0.15) {
    throw new Error('Audio is too short — import at least a few seconds of vocal.');
  }

  const sourceDurationSec = decoded.duration;
  const startSec = options?.startSec ?? 0;
  const maxDur = options?.maxDurationSec;
  const isPreview = maxDur != null && sourceDurationSec > maxDur + 0.5;

  if (isPreview) {
    decoded = sliceDecodedBuffer(decoded, startSec, maxDur);
  }

  const sr = decoded.sampleRate;
  let mono = bufferToMono(decoded);

  if (settings.autotuneOn && settings.autotune > 0) {
    mono = applyAutotune(mono, sr, settings.autotune);
  }

  if (settings.noise > 0) {
    mono = applyNoiseReduction(mono, settings.noise);
  }

  const audioBuffer = await renderFxChain(mono, sr, settings);
  const wavBlob = audioBufferToWavBlob(audioBuffer);

  return {
    audioBuffer,
    wavBlob,
    durationSec: audioBuffer.duration,
    isPreview,
    sourceDurationSec,
  };
}

export function downloadEnhancedVocalWav(blob: Blob, label = 'enhanced-vocal'): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${label}.wav`;
  a.click();
  URL.revokeObjectURL(url);
}
