/**
 * Offline speech envelope analysis — drives vocoder + auto-tune gates (follows words, not steady beep).
 */
import { VOCALBOX_VOCODER_BANDS_HZ } from '@/app/lib/creationStation/grooveLabVocalBoxVocoder';

const FRAME = 1024;
const HOP = 256;

function goertzelMag(samples: Float32Array, start: number, len: number, sr: number, freq: number): number {
  const k = Math.floor(0.5 + (len * freq) / sr);
  const w = (2 * Math.PI * k) / len;
  const coeff = 2 * Math.cos(w);
  let s1 = 0;
  let s2 = 0;
  for (let i = start; i < start + len && i < samples.length; i++) {
    const s0 = samples[i]! + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  const p = s1 * s1 + s2 * s2 - coeff * s1 * s2;
  return Math.sqrt(Math.max(0, p)) / len;
}

function normalizeEnvelope(env: Float32Array): Float32Array {
  let peak = 0.0001;
  for (let i = 0; i < env.length; i++) {
    peak = Math.max(peak, env[i]!);
  }
  const out = new Float32Array(env.length);
  for (let i = 0; i < env.length; i++) {
    out[i] = env[i]! / peak;
  }
  return smoothEnvelope(out, 2);
}

function smoothEnvelope(env: Float32Array, passes: number): Float32Array {
  let cur = env;
  for (let p = 0; p < passes; p++) {
    const next = new Float32Array(cur.length);
    for (let i = 0; i < cur.length; i++) {
      const a = cur[Math.max(0, i - 1)]!;
      const b = cur[i]!;
      const c = cur[Math.min(cur.length - 1, i + 1)]!;
      next[i] = (a + b * 2 + c) / 4;
    }
    cur = next;
  }
  return cur;
}

/** Overall loudness envelope — gates auto-tune buzz to syllables. */
export function extractSpeechRmsEnvelope(buffer: AudioBuffer): Float32Array {
  return extractSpeechRmsEnvelopeRange(buffer, 0, buffer.duration);
}

/** RMS envelope for a slice of a buffer (mic phrase segment). */
export function extractSpeechRmsEnvelopeRange(
  buffer: AudioBuffer,
  startSec: number,
  endSec: number,
): Float32Array {
  const sr = buffer.sampleRate;
  const ch = buffer.getChannelData(0);
  const i0 = Math.max(0, Math.floor(startSec * sr));
  const i1 = Math.min(ch.length, Math.ceil(endSec * sr));
  if (i1 - i0 < FRAME) {
    const env = new Float32Array(1);
    let sum = 0;
    for (let i = i0; i < i1; i++) sum += ch[i]! * ch[i]!;
    env[0] = Math.sqrt(sum / Math.max(1, i1 - i0));
    return normalizeEnvelope(env);
  }
  const frames = Math.max(1, Math.floor((i1 - i0 - FRAME) / HOP));
  const env = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    const start = i0 + f * HOP;
    let sum = 0;
    for (let i = start; i < start + FRAME && i < i1; i++) {
      const s = ch[i]!;
      sum += s * s;
    }
    env[f] = Math.sqrt(sum / FRAME);
  }
  return normalizeEnvelope(env);
}

/** Per-band envelopes for multiband vocoder modulator. */
export function extractSpeechBandEnvelopes(buffer: AudioBuffer): Float32Array[] {
  return extractSpeechBandEnvelopesRange(buffer, 0, buffer.duration);
}

export function extractSpeechBandEnvelopesRange(
  buffer: AudioBuffer,
  startSec: number,
  endSec: number,
): Float32Array[] {
  const sr = buffer.sampleRate;
  const ch = buffer.getChannelData(0);
  const i0 = Math.max(0, Math.floor(startSec * sr));
  const i1 = Math.min(ch.length, Math.ceil(endSec * sr));
  const frames = Math.max(1, Math.floor((i1 - i0 - FRAME) / HOP));
  return VOCALBOX_VOCODER_BANDS_HZ.map((hz) => {
    const env = new Float32Array(Math.max(1, frames));
    for (let f = 0; f < env.length; f++) {
      env[f] = goertzelMag(ch, i0 + f * HOP, FRAME, sr, hz);
    }
    return normalizeEnvelope(env);
  });
}

export function envelopeFrameDurationSec(buffer: AudioBuffer): number {
  const frames = Math.max(1, Math.floor((buffer.getChannelData(0).length - FRAME) / HOP));
  return buffer.duration / frames;
}

/** Write envelope to GainNode automation (syllable-following gate). */
export function scheduleGainEnvelope(
  param: AudioParam,
  when: number,
  slotDur: number,
  envelope: Float32Array,
  scale: number,
  floor = 0.0001,
): void {
  const n = envelope.length;
  if (n === 0) {
    param.setValueAtTime(floor, when);
    return;
  }
  const step = slotDur / n;
  param.cancelScheduledValues(when);
  param.setValueAtTime(floor, when);
  for (let i = 0; i < n; i++) {
    const v = floor + envelope[i]! * scale;
    param.setValueAtTime(v, when + i * step);
  }
  param.setValueAtTime(floor, when + slotDur);
}
