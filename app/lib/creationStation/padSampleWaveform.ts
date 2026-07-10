/** Decimated peaks for pad sample waveform display (absolute magnitudes 0–1 per bucket). */
export function computePadSampleWaveformPeaks(buf: AudioBuffer, bucketCount = 220): number[] {
  const channels = Math.min(buf.numberOfChannels, 2);
  const len = buf.length;
  if (len <= 0 || bucketCount <= 0) {
    return Array.from({ length: Math.max(1, bucketCount) }, () => 0);
  }
  const step = len / bucketCount;
  const peaks: number[] = new Array(bucketCount);
  for (let i = 0; i < bucketCount; i++) {
    let max = 0;
    const j0 = Math.floor(i * step);
    const j1 = Math.min(Math.floor((i + 1) * step), len);
    for (let c = 0; c < channels; c++) {
      const ch = buf.getChannelData(c);
      for (let j = j0; j < j1; j++) {
        const v = Math.abs(ch[j]!);
        if (v > max) max = v;
      }
    }
    peaks[i] = max;
  }
  return peaks;
}

const FREQ_N = 80;
const FREQ_MIN = 20;
const FREQ_MAX = 20000;

export function padWaveformHzToX(hz: number, w: number, padL = 0, padR = 0): number {
  const innerW = Math.max(1, w - padL - padR);
  const clamped = Math.max(FREQ_MIN, Math.min(FREQ_MAX, hz));
  const t = Math.log(clamped / FREQ_MIN) / Math.log(FREQ_MAX / FREQ_MIN);
  return padL + t * innerW;
}

function buildLogFreqs(n: number): Float32Array {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1 || 1);
    out[i] = FREQ_MIN * Math.pow(FREQ_MAX / FREQ_MIN, t);
  }
  return out;
}

/** Reused for EQ curve plotting — avoid spawning AudioContext per paint. */
let padWaveformEqCtx: AudioContext | null = null;

function getPadWaveformEqContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!padWaveformEqCtx || padWaveformEqCtx.state === 'closed') {
      padWaveformEqCtx = new AudioContext({ sampleRate: 48000 });
    }
    return padWaveformEqCtx;
  } catch {
    return null;
  }
}

/** Combined EQ magnitude (dB) for the mini spectrum strip. */
export function padWaveformEqMagDb(eq: {
  lowGainDb: number;
  midGainDb: number;
  highGainDb: number;
  lowFreqHz: number;
  midFreqHz: number;
  highFreqHz: number;
  midQ: number;
}): Float32Array {
  const freqs = buildLogFreqs(FREQ_N);
  const ac = getPadWaveformEqContext();
  if (!ac) {
    return Float32Array.from({ length: FREQ_N }, () => 0);
  }
  try {
    const l = ac.createBiquadFilter();
    l.type = 'lowshelf';
    l.frequency.value = eq.lowFreqHz;
    l.gain.value = eq.lowGainDb;
    const m = ac.createBiquadFilter();
    m.type = 'peaking';
    m.frequency.value = eq.midFreqHz;
    m.Q.value = eq.midQ;
    m.gain.value = eq.midGainDb;
    const h = ac.createBiquadFilter();
    h.type = 'highshelf';
    h.frequency.value = eq.highFreqHz;
    h.gain.value = eq.highGainDb;
    const ml = new Float32Array(FREQ_N);
    const mm = new Float32Array(FREQ_N);
    const mh = new Float32Array(FREQ_N);
    const phase = new Float32Array(FREQ_N);
    l.getFrequencyResponse(freqs, ml, phase);
    m.getFrequencyResponse(freqs, mm, phase);
    h.getFrequencyResponse(freqs, mh, phase);
    const out = new Float32Array(FREQ_N);
    for (let i = 0; i < FREQ_N; i++) {
      const lin = ml[i]! * mm[i]! * mh[i]!;
      out[i] = 20 * Math.log10(Math.max(1e-8, lin));
    }
    return out;
  } catch {
    return Float32Array.from({ length: FREQ_N }, () => 0);
  }
}

export function padWaveformXToHz(x: number, w: number, padL = 0, padR = 0): number {
  const innerW = Math.max(1, w - padL - padR);
  const t = Math.max(0, Math.min(1, (x - padL) / innerW));
  return FREQ_MIN * Math.pow(FREQ_MAX / FREQ_MIN, t);
}

export function clampPadSampleTrimPair(t0: number, t1: number): { trim0: number; trim1: number } {
  let trim0 = Math.max(0, Math.min(0.95, t0));
  let trim1 = Math.max(0.05, Math.min(1, t1));
  if (trim1 <= trim0 + 0.02) {
    trim1 = Math.min(1, trim0 + 0.08);
  }
  if (trim1 <= trim0 + 0.02) {
    trim0 = Math.max(0, trim1 - 0.08);
  }
  return { trim0, trim1 };
}

export const PAD_FX_WAVE_H = 84;
export const PAD_FX_STRIP_H = 46;
export const PAD_FX_WAVE_PAD_X = 6;

/** Log-spaced frequency grid for the EQ / filter strip (matches Groove Lab FX graph). */
export function padWaveformGridFreqs(): number[] {
  return [50, 100, 200, 500, 1000, 2000, 5000, 10000];
}

export function padWaveformFormatGridHz(hz: number): string {
  if (hz >= 1000) return `${hz / 1000}K`;
  return String(hz);
}

export function padWaveformDbToY(db: number, h: number, dbMin = -12, dbMax = 12): number {
  const t = (dbMax - Math.max(dbMin, Math.min(dbMax, db))) / (dbMax - dbMin);
  return t * h;
}
