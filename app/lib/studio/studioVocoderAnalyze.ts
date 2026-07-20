/**
 * Offline modulator analysis for Studio pro vocoder — per-band envelopes with ATK/REL + companding.
 */

/** Must match STUDIO_VOCODER_BANDS_HZ in studioVocoder.ts */
const VOCODER_BANDS_HZ = [
  100, 150, 220, 320, 470, 680, 980, 1400, 2000, 2800, 3800, 5000, 6400, 8000, 10000, 12000,
] as const;

/** Larger hop keeps offline renders interactive — was 256 and froze on long takes. */
const FRAME = 1024;
const HOP = 1024;
const YIELD_EVERY_FRAMES = 48;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function yieldToMain(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

function goertzelMag(samples: Float32Array, start: number, len: number, sr: number, freq: number): number {
  const k = Math.floor(0.5 + (len * freq) / sr);
  const w = (2 * Math.PI * k) / len;
  const coeff = 2 * Math.cos(w);
  let s1 = 0;
  let s2 = 0;
  const end = Math.min(samples.length, start + len);
  for (let i = start; i < end; i++) {
    const s0 = samples[i]! + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  const p = s1 * s1 + s2 * s2 - coeff * s1 * s2;
  return Math.sqrt(Math.max(0, p)) / len;
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

function normalizeEnvelope(env: Float32Array): Float32Array {
  let peak = 0.0001;
  for (let i = 0; i < env.length; i++) peak = Math.max(peak, env[i]!);
  const out = new Float32Array(env.length);
  for (let i = 0; i < env.length; i++) out[i] = env[i]! / peak;
  return smoothEnvelope(out, 2);
}

/** TAL-style companding — lift quiet modulator bands for intelligibility. */
export function studioVocoderCompandEnvelope(env: Float32Array, amount: number): Float32Array {
  const k = clamp(amount, 0, 1);
  if (k < 0.02) return env;
  const exp = 0.55 + (1 - k) * 0.35;
  const out = new Float32Array(env.length);
  for (let i = 0; i < env.length; i++) {
    out[i] = Math.pow(clamp(env[i]!, 0, 1), exp);
  }
  return out;
}

/** Asymmetric attack/release follower (pro vocoder envelope per band). */
export function studioVocoderShapeEnvelope(
  raw: Float32Array,
  frameDurSec: number,
  attackMs: number,
  releaseMs: number,
): Float32Array {
  const dt = Math.max(1e-5, frameDurSec);
  const atk = clamp(attackMs, 1, 120);
  const rel = clamp(releaseMs, 8, 320);
  const attackCoef = Math.exp(-dt / (atk / 1000));
  const releaseCoef = Math.exp(-dt / (rel / 1000));
  const out = new Float32Array(raw.length);
  let env = 0;
  for (let i = 0; i < raw.length; i++) {
    const x = raw[i]!;
    const coef = x > env ? attackCoef : releaseCoef;
    env = coef * env + (1 - coef) * x;
    out[i] = env;
  }
  return out;
}

export function studioVocoderEnvelopeFrameDurSec(buffer: AudioBuffer): number {
  const ch = buffer.getChannelData(0);
  const frames = Math.max(1, Math.floor((ch.length - FRAME) / HOP));
  return buffer.duration / frames;
}

function bandEnvelopeSync(ch: Float32Array, sr: number, hz: number, frames: number): Float32Array {
  const env = new Float32Array(Math.max(1, frames));
  for (let f = 0; f < env.length; f++) {
    env[f] = goertzelMag(ch, f * HOP, FRAME, sr, hz);
  }
  return normalizeEnvelope(env);
}

/** Per-band modulator envelopes aligned to STUDIO_VOCODER_BANDS_HZ. */
export function extractStudioVocoderBandEnvelopes(buffer: AudioBuffer): Float32Array[] {
  const sr = buffer.sampleRate;
  const ch = buffer.getChannelData(0);
  const frames = Math.max(1, Math.floor((ch.length - FRAME) / HOP));
  return VOCODER_BANDS_HZ.map((hz) => bandEnvelopeSync(ch, sr, hz, frames));
}

/**
 * Same as {@link extractStudioVocoderBandEnvelopes} but yields so toggling Vocoder DSP
 * does not freeze the UI on long clips.
 */
export async function extractStudioVocoderBandEnvelopesAsync(
  buffer: AudioBuffer,
): Promise<Float32Array[]> {
  const sr = buffer.sampleRate;
  const ch = buffer.getChannelData(0);
  const frames = Math.max(1, Math.floor((ch.length - FRAME) / HOP));
  const out: Float32Array[] = [];
  let work = 0;
  for (const hz of VOCODER_BANDS_HZ) {
    const env = new Float32Array(Math.max(1, frames));
    for (let f = 0; f < env.length; f++) {
      env[f] = goertzelMag(ch, f * HOP, FRAME, sr, hz);
      work += 1;
      if (work % YIELD_EVERY_FRAMES === 0) await yieldToMain();
    }
    out.push(normalizeEnvelope(env));
  }
  return out;
}

export function scheduleStudioVocoderGainEnvelope(
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
  /* Cap automation points — browsers choke on tens of thousands of setValueAtTime calls. */
  const maxPoints = 512;
  const stride = Math.max(1, Math.ceil(n / maxPoints));
  for (let i = 0; i < n; i += stride) {
    param.setValueAtTime(floor + envelope[i]! * scale, when + i * step);
  }
  const last = envelope[n - 1]!;
  param.setValueAtTime(floor + last * scale, when + (n - 1) * step);
  param.setValueAtTime(floor, when + slotDur);
}
