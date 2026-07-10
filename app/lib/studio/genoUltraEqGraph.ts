/**
 * Geno Ultra — 4-band EQ curve math + grid helpers (UI + docs).
 */
import type { GenoUltraFxParams } from '@/app/lib/studio/genoUltraSynthTypes';

export const GENO_ULTRA_EQ_DB_MIN = -12;
export const GENO_ULTRA_EQ_DB_MAX = 12;
export const GENO_ULTRA_EQ_GRAPH_W = 400;
export const GENO_ULTRA_EQ_GRAPH_H = 168;
export const GENO_ULTRA_EQ_PAD_L = 36;
export const GENO_ULTRA_EQ_PAD_R = 36;
export const GENO_ULTRA_EQ_PAD_T = 14;
export const GENO_ULTRA_EQ_PAD_B = 22;
export const GENO_ULTRA_EQ_NYQUIST_HZ = 20000;

export const GENO_ULTRA_EQ_LOW_HZ = 120;
export const GENO_ULTRA_EQ_LO_MID_HZ = 480;
export const GENO_ULTRA_EQ_HI_MID_HZ = 2400;
export const GENO_ULTRA_EQ_HIGH_HZ = 8000;

export type GenoUltraEqBandId = 'low' | 'loMid' | 'hiMid' | 'high';

export type GenoUltraEqFxSlice = Pick<
  GenoUltraFxParams,
  | 'eqEnabled'
  | 'eqLowDb'
  | 'eqLoMidDb'
  | 'eqHiMidDb'
  | 'eqHighDb'
  | 'eqLowHz'
  | 'eqLoMidHz'
  | 'eqHiMidHz'
  | 'eqHighHz'
>;

export const GENO_ULTRA_EQ_BANDS: readonly {
  id: GenoUltraEqBandId;
  label: string;
  defaultHz: number;
  kind: BiquadFilterType;
  q: number;
  gainKey: keyof Pick<GenoUltraFxParams, 'eqLowDb' | 'eqLoMidDb' | 'eqHiMidDb' | 'eqHighDb'>;
  hzKey: keyof Pick<GenoUltraFxParams, 'eqLowHz' | 'eqLoMidHz' | 'eqHiMidHz' | 'eqHighHz'>;
}[] = [
  { id: 'low', label: 'LOW', defaultHz: GENO_ULTRA_EQ_LOW_HZ, kind: 'lowshelf', q: 0.707, gainKey: 'eqLowDb', hzKey: 'eqLowHz' },
  { id: 'loMid', label: 'LO MID', defaultHz: GENO_ULTRA_EQ_LO_MID_HZ, kind: 'peaking', q: 1.15, gainKey: 'eqLoMidDb', hzKey: 'eqLoMidHz' },
  { id: 'hiMid', label: 'HI MID', defaultHz: GENO_ULTRA_EQ_HI_MID_HZ, kind: 'peaking', q: 1.05, gainKey: 'eqHiMidDb', hzKey: 'eqHiMidHz' },
  { id: 'high', label: 'HIGH', defaultHz: GENO_ULTRA_EQ_HIGH_HZ, kind: 'highshelf', q: 0.707, gainKey: 'eqHighDb', hzKey: 'eqHighHz' },
];

const EQ_HZ_LIMITS: Record<GenoUltraEqBandId, { min: number; max: number }> = {
  low: { min: 30, max: 500 },
  loMid: { min: 100, max: 2500 },
  hiMid: { min: 400, max: 10000 },
  high: { min: 2000, max: 20000 },
};

const FREQ_MAG_LEN = 96;
const EQ_HZ_ORDER_GAP = 20;

function buildLogFreqs(n: number): Float32Array {
  const out = new Float32Array(n);
  const f0 = 20;
  const f1 = GENO_ULTRA_EQ_NYQUIST_HZ;
  for (let i = 0; i < n; i += 1) {
    const t = i / (n - 1 || 1);
    out[i] = f0 * (f1 / f0) ** t;
  }
  return out;
}

const LOG_FREQS = buildLogFreqs(FREQ_MAG_LEN);

export function roundGenoUltraEqHz(hz: number): number {
  if (hz < 100) return Math.round(hz);
  if (hz < 1000) return Math.round(hz / 5) * 5;
  return Math.round(hz / 10) * 10;
}

export function getGenoUltraEqBandHz(bandId: GenoUltraEqBandId, fx: GenoUltraEqFxSlice): number {
  const band = GENO_ULTRA_EQ_BANDS.find((b) => b.id === bandId);
  if (!band) return GENO_ULTRA_EQ_LO_MID_HZ;
  const raw = fx[band.hzKey];
  return Number.isFinite(raw) ? raw : band.defaultHz;
}

/** Clamp Hz for drag — respects per-band range and neighbor ordering. */
export function clampGenoUltraEqBandHz(bandId: GenoUltraEqBandId, hz: number, fx: GenoUltraEqFxSlice): number {
  const lim = EQ_HZ_LIMITS[bandId];
  const low = getGenoUltraEqBandHz('low', fx);
  const loMid = getGenoUltraEqBandHz('loMid', fx);
  const hiMid = getGenoUltraEqBandHz('hiMid', fx);
  const high = getGenoUltraEqBandHz('high', fx);
  const gap = EQ_HZ_ORDER_GAP;
  let v = Math.max(lim.min, Math.min(lim.max, hz));
  if (bandId === 'low') v = Math.min(v, loMid - gap);
  if (bandId === 'loMid') v = Math.max(low + gap, Math.min(v, hiMid - gap));
  if (bandId === 'hiMid') v = Math.max(loMid + gap, Math.min(v, high - gap));
  if (bandId === 'high') v = Math.max(v, hiMid + gap);
  return roundGenoUltraEqHz(v);
}

export function genoUltraEqHzToX(hz: number, w = GENO_ULTRA_EQ_GRAPH_W): number {
  const innerW = w - GENO_ULTRA_EQ_PAD_L - GENO_ULTRA_EQ_PAD_R;
  return GENO_ULTRA_EQ_PAD_L + (Math.log(Math.max(20, hz) / 20) / Math.log(GENO_ULTRA_EQ_NYQUIST_HZ / 20)) * innerW;
}

export function genoUltraEqXToHz(x: number, w = GENO_ULTRA_EQ_GRAPH_W): number {
  const innerW = w - GENO_ULTRA_EQ_PAD_L - GENO_ULTRA_EQ_PAD_R;
  const t = Math.max(0, Math.min(1, (x - GENO_ULTRA_EQ_PAD_L) / Math.max(1, innerW)));
  return 20 * (GENO_ULTRA_EQ_NYQUIST_HZ / 20) ** t;
}

export function genoUltraEqDbToY(db: number, h = GENO_ULTRA_EQ_GRAPH_H): number {
  const innerH = h - GENO_ULTRA_EQ_PAD_T - GENO_ULTRA_EQ_PAD_B;
  const clamped = Math.max(GENO_ULTRA_EQ_DB_MIN, Math.min(GENO_ULTRA_EQ_DB_MAX, db));
  return GENO_ULTRA_EQ_PAD_T + ((GENO_ULTRA_EQ_DB_MAX - clamped) / (GENO_ULTRA_EQ_DB_MAX - GENO_ULTRA_EQ_DB_MIN)) * innerH;
}

export function genoUltraEqYToDb(y: number, h = GENO_ULTRA_EQ_GRAPH_H): number {
  const innerH = h - GENO_ULTRA_EQ_PAD_T - GENO_ULTRA_EQ_PAD_B;
  const t = Math.max(0, Math.min(1, (y - GENO_ULTRA_EQ_PAD_T) / Math.max(1, innerH)));
  return GENO_ULTRA_EQ_DB_MAX - t * (GENO_ULTRA_EQ_DB_MAX - GENO_ULTRA_EQ_DB_MIN);
}

function magDbAtHz(freqs: Float32Array, mags: Float32Array, hz: number): number {
  if (freqs.length === 0) return 0;
  const target = Math.max(freqs[0]!, Math.min(freqs[freqs.length - 1]!, hz));
  let i = 0;
  while (i < freqs.length - 1 && freqs[i + 1]! < target) i += 1;
  const f0 = freqs[i]!;
  const f1 = freqs[Math.min(i + 1, freqs.length - 1)]!;
  if (f1 <= f0) return mags[i] ?? 0;
  const u = (Math.log(target) - Math.log(f0)) / (Math.log(f1) - Math.log(f0));
  return (mags[i] ?? 0) * (1 - u) + (mags[Math.min(i + 1, mags.length - 1)] ?? 0) * u;
}

export function computeGenoUltraEqMagDb(fx: GenoUltraEqFxSlice): Float32Array {
  return computeGenoUltraEqBandsMagDb(fx, GENO_ULTRA_EQ_BANDS.map((b) => b.id));
}

/** Per-band magnitude (dB) for stacked colored fills on the analyzer. */
export function computeGenoUltraEqSingleBandMagDb(bandId: GenoUltraEqBandId, fx: GenoUltraEqFxSlice): Float32Array {
  return computeGenoUltraEqBandsMagDb(fx, [bandId]);
}

function computeGenoUltraEqBandsMagDb(fx: GenoUltraEqFxSlice, bandIds: readonly GenoUltraEqBandId[]): Float32Array {
  if (!fx.eqEnabled || bandIds.length === 0) {
    return Float32Array.from({ length: FREQ_MAG_LEN }, () => 0);
  }
  if (typeof window === 'undefined') {
    return Float32Array.from({ length: FREQ_MAG_LEN }, () => 0);
  }
  try {
    const ac = new AudioContext({ sampleRate: 48000 });
    const phase = new Float32Array(FREQ_MAG_LEN);
    const combined = new Float32Array(FREQ_MAG_LEN);
    combined.fill(1);
    for (const band of GENO_ULTRA_EQ_BANDS) {
      if (!bandIds.includes(band.id)) continue;
      const f = ac.createBiquadFilter();
      f.type = band.kind;
      f.frequency.value = getGenoUltraEqBandHz(band.id, fx);
      f.gain.value = fx[band.gainKey];
      f.Q.value = band.kind === 'peaking' ? band.q : 0.707;
      const mag = new Float32Array(FREQ_MAG_LEN);
      f.getFrequencyResponse(LOG_FREQS, mag, phase);
      for (let i = 0; i < FREQ_MAG_LEN; i += 1) combined[i] = (combined[i] ?? 1) * (mag[i] ?? 1);
    }
    const out = new Float32Array(FREQ_MAG_LEN);
    for (let i = 0; i < FREQ_MAG_LEN; i += 1) {
      out[i] = 20 * Math.log10(Math.max(1e-8, combined[i] ?? 1));
    }
    void ac.close().catch(() => {});
    return out;
  } catch {
    return Float32Array.from({ length: FREQ_MAG_LEN }, () => 0);
  }
}

export function genoUltraEqBandFillPath(
  magDb: Float32Array,
  w = GENO_ULTRA_EQ_GRAPH_W,
  h = GENO_ULTRA_EQ_GRAPH_H,
): string {
  const curve = genoUltraEqCurvePath(magDb, w, h);
  if (!curve) return '';
  const zeroY = genoUltraEqDbToY(0, h);
  const xR = w - GENO_ULTRA_EQ_PAD_R;
  const xL = GENO_ULTRA_EQ_PAD_L;
  return `${curve} L ${xR} ${zeroY} L ${xL} ${zeroY} Z`;
}

export function genoUltraEqCurvePath(
  magDb: Float32Array,
  w = GENO_ULTRA_EQ_GRAPH_W,
  h = GENO_ULTRA_EQ_GRAPH_H,
): string {
  if (magDb.length < 2) return '';
  const pts: string[] = [];
  for (let i = 0; i < magDb.length; i += 1) {
    const hz = LOG_FREQS[i] ?? 20;
    const x = genoUltraEqHzToX(hz, w);
    const y = genoUltraEqDbToY(magDb[i] ?? 0, h);
    pts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return pts.join(' ');
}

export function genoUltraEqBandDotY(
  bandId: GenoUltraEqBandId,
  fx: GenoUltraEqFxSlice,
  magDb: Float32Array,
  h = GENO_ULTRA_EQ_GRAPH_H,
): number {
  const bandHz = getGenoUltraEqBandHz(bandId, fx);
  const atHz = magDbAtHz(LOG_FREQS, magDb, bandHz);
  return genoUltraEqDbToY(fx.eqEnabled ? atHz : 0, h);
}

export function genoUltraEqGridFreqLines(): readonly { hz: number; label: string }[] {
  return [
    { hz: 20, label: '20' },
    { hz: 50, label: '50' },
    { hz: 100, label: '100' },
    { hz: 200, label: '200' },
    { hz: 500, label: '500' },
    { hz: 1000, label: '1k' },
    { hz: 2000, label: '2k' },
    { hz: 5000, label: '5k' },
    { hz: 10000, label: '10k' },
    { hz: 20000, label: '20k' },
  ];
}

export function genoUltraEqGridDbLines(): readonly number[] {
  return [-12, -9, -6, -3, 0, 3, 6, 9, 12];
}

export function formatGenoUltraEqHz(hz: number): string {
  if (hz >= 1000) return `${(hz / 1000).toFixed(hz >= 10000 ? 0 : 1)}k`;
  return hz < 100 ? hz.toFixed(1) : `${Math.round(hz)}`;
}
