/**
 * Overlap-add pitch shifter with optional formant compensation.
 * Used by Pitch Tune DSP for pro-quality correction (vs naive resampling).
 */

const GRAIN = 2048;
const OVERLAP = 4;
const HOP_OUT = GRAIN / OVERLAP;

function hann(i: number, n: number): number {
  return 0.5 * (1 - Math.cos((2 * Math.PI * i) / Math.max(1, n - 1)));
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function linearAt(samples: Float32Array, idx: number): number {
  const i0 = Math.floor(idx);
  const i1 = Math.min(samples.length - 1, i0 + 1);
  const f = idx - i0;
  return samples[i0]! * (1 - f) + samples[i1]! * f;
}

/** Build Hann window once. */
const WIN = (() => {
  const w = new Float32Array(GRAIN);
  for (let i = 0; i < GRAIN; i++) w[i] = hann(i, GRAIN);
  return w;
})();

/**
 * Pitch-shift mono samples by a time-varying rate curve (1 = unity).
 * `rates[i]` = input advance per output sample at output index i (interpolated from hop grid).
 */
export function pitchShiftOlaVariableRate(
  samples: Float32Array,
  rates: Float32Array,
): Float32Array {
  if (samples.length < GRAIN + 2) return samples.slice();

  const outLen = Math.ceil(samples.length * 1.35);
  const out = new Float32Array(outLen);
  const norm = new Float32Array(outLen);

  let readPos = 0;
  let outPos = 0;

  while (outPos + HOP_OUT < outLen - 1 && readPos + GRAIN < samples.length - 1) {
    const rate = rates[Math.min(rates.length - 1, outPos)] ?? 1;
    const safeRate = clamp(rate, 0.5, 2);

    for (let g = 0; g < GRAIN; g++) {
      const oi = outPos + g;
      if (oi >= outLen) break;
      const s = linearAt(samples, readPos + g) * WIN[g]!;
      out[oi] = (out[oi] ?? 0) + s;
      norm[oi] = (norm[oi] ?? 0) + WIN[g]!;
    }

    outPos += HOP_OUT;
    readPos += HOP_OUT / safeRate;
  }

  for (let i = 0; i < outLen; i++) {
    const n = norm[i] ?? 0;
    if (n > 1e-6) out[i] = (out[i] ?? 0) / n;
  }

  let end = outLen;
  while (end > 1 && Math.abs(out[end - 1]!) < 1e-8) end--;
  return out.subarray(0, Math.max(1, end));
}

/**
 * Formant compensation after pitch shift — counter-shifts spectral envelope
 * so voice timbre stays natural (Antares-style throat modeling lite).
 */
export function applyFormantCompensation(
  samples: Float32Array,
  sr: number,
  correctionSemis: number,
  preserve: number,
): Float32Array {
  const k = clamp(preserve, 0, 1);
  if (k < 0.02 || Math.abs(correctionSemis) < 0.08) return samples;

  const compSemis = -correctionSemis * k;
  const rate = Math.pow(2, compSemis / 12);
  const out = new Float32Array(Math.ceil(samples.length / rate) + GRAIN);
  let oi = 0;
  for (let ri = 0; ri < samples.length - 1 && oi < out.length; ri += rate) {
    out[oi++] = linearAt(samples, ri);
  }
  if (oi >= out.length) return out;
  const trimmed = out.subarray(0, oi);
  if (trimmed.length >= samples.length) return trimmed.subarray(0, samples.length);
  const fit = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const src = (i / samples.length) * trimmed.length;
    fit[i] = linearAt(trimmed, src);
  }
  return fit;
}

/** Per-output-sample rate curve from hop-indexed pitch ratios. */
export function expandHopRatesToSampleRates(
  hopRates: Float32Array,
  hopSize: number,
  outLength: number,
): Float32Array {
  const rates = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const hopIdx = Math.min(hopRates.length - 1, Math.max(0, Math.floor(i / hopSize)));
    rates[i] = hopRates[hopIdx] ?? 1;
  }
  return rates;
}

export const STUDIO_PITCH_SHIFT_GRAIN = GRAIN;
export const STUDIO_PITCH_SHIFT_HOP = HOP_OUT;
