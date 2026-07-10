/**
 * Groove Lab CH FX — 5-band parametric EQ + HPF/LPF cutoff (Fat Channel style).
 */

import type { PadSamplerCompressorFx, PadSamplerEqFx } from '@/app/lib/creationStation/padSamplerFxRack';
import { DEESSER_AMOUNT_MAX, DEESSER_FREQ_MAX_HZ, DEESSER_FREQ_MIN_HZ } from '@/app/lib/creationStation/padSamplerFxRack';

export type GrooveLabEqBandKind = 'lowshelf' | 'peaking' | 'highshelf';

export type GrooveLabEqBand = {
  kind: GrooveLabEqBandKind;
  gainDb: number;
  freqHz: number;
  q: number;
};

export const GROOVE_LAB_EQ_BAND_COUNT = 5;

export type GrooveLabChannelEqFx = {
  enabled: boolean;
  bands: GrooveLabEqBand[];
};

export type GrooveLabChannelCutoffFx = {
  enabled: boolean;
  /** HPF — rolls off below this Hz */
  lowCutHz: number;
  /** LPF — rolls off above this Hz */
  highCutHz: number;
};

export type GrooveLabChannelFxRack = {
  cutoff: GrooveLabChannelCutoffFx;
  eq: GrooveLabChannelEqFx;
  compressor: PadSamplerCompressorFx;
};

export const GROOVE_LAB_FX_GRAPH_W = 300;
export const GROOVE_LAB_FX_GRAPH_H = 132;
export const GROOVE_LAB_FX_PAD_L = 28;
export const GROOVE_LAB_FX_PAD_R = 10;
export const GROOVE_LAB_FX_PAD_T = 12;
export const GROOVE_LAB_FX_PAD_B = 18;
export const GROOVE_LAB_FX_DB_MIN = -12;
export const GROOVE_LAB_FX_DB_MAX = 12;
export const GROOVE_LAB_FX_NYQUIST_HZ = 20000;

const BAND_COLORS = ['#6366f1', '#818cf8', '#a78bfa', '#67e8f9', '#34d399'] as const;
const BAND_STROKES = ['#a5b4fc', '#c7d2fe', '#e9d5ff', '#a5f3fc', '#7cf4c6'] as const;

export function grooveLabEqBandColor(i: number): { fill: string; stroke: string } {
  return { fill: BAND_COLORS[i % BAND_COLORS.length]!, stroke: BAND_STROKES[i % BAND_STROKES.length]! };
}

export function defaultGrooveLabEqBands(): GrooveLabEqBand[] {
  return [
    { kind: 'lowshelf', gainDb: 0, freqHz: 90, q: 0.71 },
    { kind: 'peaking', gainDb: 0, freqHz: 280, q: 1.1 },
    { kind: 'peaking', gainDb: 0, freqHz: 1000, q: 1 },
    { kind: 'peaking', gainDb: 0, freqHz: 3200, q: 1.15 },
    { kind: 'highshelf', gainDb: 0, freqHz: 9000, q: 0.71 },
  ];
}

export function defaultGrooveLabChannelCutoff(): GrooveLabChannelCutoffFx {
  return { enabled: false, lowCutHz: 40, highCutHz: 16000 };
}

export function defaultGrooveLabChannelEq(): GrooveLabChannelEqFx {
  return { enabled: false, bands: defaultGrooveLabEqBands() };
}

export function defaultGrooveLabChannelCompressor(): PadSamplerCompressorFx {
  return {
    enabled: false,
    thresholdDb: -22,
    ratio: 4,
    attackSec: 0.003,
    releaseSec: 0.22,
    kneeDb: 8,
    makeupDb: 0,
  };
}

export function defaultGrooveLabChannelFxRack(): GrooveLabChannelFxRack {
  return {
    cutoff: defaultGrooveLabChannelCutoff(),
    eq: defaultGrooveLabChannelEq(),
    compressor: defaultGrooveLabChannelCompressor(),
  };
}

/** Upgrade legacy 3-band pad EQ rack slice → 5-band Groove Lab EQ. */
export function migratePadEqToGrooveLabEq(old: PadSamplerEqFx): GrooveLabChannelEqFx {
  const mid = old.midFreqHz;
  return {
    enabled: old.enabled,
    bands: [
      { kind: 'lowshelf', gainDb: old.lowGainDb, freqHz: old.lowFreqHz, q: 0.71 },
      { kind: 'peaking', gainDb: 0, freqHz: Math.max(120, Math.round(mid * 0.35)), q: 1 },
      { kind: 'peaking', gainDb: old.midGainDb, freqHz: mid, q: old.midQ },
      { kind: 'peaking', gainDb: 0, freqHz: Math.min(12000, Math.round(mid * 2.8)), q: 1.1 },
      { kind: 'highshelf', gainDb: old.highGainDb, freqHz: old.highFreqHz, q: 0.71 },
    ],
  };
}

function clampBand(b: GrooveLabEqBand, index: number): GrooveLabEqBand {
  const kind = b.kind === 'peaking' || b.kind === 'highshelf' ? b.kind : 'lowshelf';
  const freqMin = kind === 'lowshelf' ? 30 : kind === 'highshelf' ? 1200 : 60;
  const freqMax = kind === 'highshelf' ? 18000 : kind === 'lowshelf' ? 900 : 14000;
  let freqHz = Math.max(freqMin, Math.min(freqMax, b.freqHz));
  if (index === 0) freqHz = Math.max(30, Math.min(900, freqHz));
  if (index === GROOVE_LAB_EQ_BAND_COUNT - 1) freqHz = Math.max(1500, Math.min(18000, freqHz));
  return {
    kind,
    gainDb: Math.max(-12, Math.min(12, b.gainDb)),
    freqHz,
    q: Math.max(0.35, Math.min(12, b.q)),
  };
}

export function clampGrooveLabEqBands(bands: GrooveLabEqBand[]): GrooveLabEqBand[] {
  const defaults = defaultGrooveLabEqBands();
  const out = bands.slice(0, GROOVE_LAB_EQ_BAND_COUNT).map((b, i) => clampBand({ ...defaults[i]!, ...b }, i));
  while (out.length < GROOVE_LAB_EQ_BAND_COUNT) out.push(defaults[out.length]!);
  for (let i = 1; i < out.length; i += 1) {
    if (out[i]!.freqHz < out[i - 1]!.freqHz + 40) {
      out[i] = { ...out[i]!, freqHz: out[i - 1]!.freqHz + 40 };
    }
  }
  return out;
}

export function clampGrooveLabChannelEq(eq: GrooveLabChannelEqFx): GrooveLabChannelEqFx {
  return {
    enabled: Boolean(eq.enabled),
    bands: clampGrooveLabEqBands(eq.bands ?? defaultGrooveLabEqBands()),
  };
}

export function clampGrooveLabChannelCutoff(c: GrooveLabChannelCutoffFx): GrooveLabChannelCutoffFx {
  let lowCutHz = Math.max(20, Math.min(800, c.lowCutHz));
  let highCutHz = Math.max(400, Math.min(18000, c.highCutHz));
  if (highCutHz < lowCutHz + 200) highCutHz = lowCutHz + 200;
  return { enabled: Boolean(c.enabled), lowCutHz, highCutHz };
}

function clampCompressor(c: PadSamplerCompressorFx): PadSamplerCompressorFx {
  return {
    enabled: Boolean(c.enabled),
    thresholdDb: Math.max(-48, Math.min(0, c.thresholdDb)),
    ratio: Math.max(1, Math.min(20, c.ratio)),
    attackSec: Math.max(0.0005, Math.min(0.55, c.attackSec)),
    releaseSec: Math.max(0.02, Math.min(1.2, c.releaseSec)),
    kneeDb: Math.max(0, Math.min(40, c.kneeDb)),
    makeupDb: Math.max(0, Math.min(18, c.makeupDb)),
    deEsserEnabled: Boolean(c.deEsserEnabled),
    deEsserFreqHz: Math.max(DEESSER_FREQ_MIN_HZ, Math.min(DEESSER_FREQ_MAX_HZ, c.deEsserFreqHz ?? 6500)),
    deEsserAmount: Math.max(0, Math.min(DEESSER_AMOUNT_MAX, c.deEsserAmount ?? 0.55)),
  };
}

export function normalizeGrooveLabChannelFxRack(
  raw: Partial<GrooveLabChannelFxRack> | null | undefined,
): GrooveLabChannelFxRack {
  const d = defaultGrooveLabChannelFxRack();
  if (!raw) return d;
  const legacyEq = raw as { eq?: PadSamplerEqFx & { bands?: GrooveLabEqBand[] } };
  let eq = d.eq;
  if (legacyEq.eq) {
    if (Array.isArray(legacyEq.eq.bands) && legacyEq.eq.bands.length > 0) {
      eq = clampGrooveLabChannelEq({
        enabled: legacyEq.eq.enabled ?? false,
        bands: legacyEq.eq.bands,
      });
    } else if ('lowGainDb' in legacyEq.eq) {
      eq = migratePadEqToGrooveLabEq(legacyEq.eq as PadSamplerEqFx);
    }
  }
  return {
    cutoff: clampGrooveLabChannelCutoff({ ...d.cutoff, ...(raw.cutoff ?? {}) }),
    eq,
    compressor: clampCompressor({ ...d.compressor, ...(raw.compressor ?? {}) }),
  };
}

export function grooveLabChannelFxActive(rack: GrooveLabChannelFxRack): boolean {
  return rack.cutoff.enabled || rack.eq.enabled || rack.compressor.enabled;
}

export function grooveLabFxHzToX(hz: number, w = GROOVE_LAB_FX_GRAPH_W): number {
  const innerW = w - GROOVE_LAB_FX_PAD_L - GROOVE_LAB_FX_PAD_R;
  return GROOVE_LAB_FX_PAD_L + (Math.log(Math.max(20, hz) / 20) / Math.log(GROOVE_LAB_FX_NYQUIST_HZ / 20)) * innerW;
}

export function grooveLabFxXToHz(x: number, w = GROOVE_LAB_FX_GRAPH_W): number {
  const innerW = w - GROOVE_LAB_FX_PAD_L - GROOVE_LAB_FX_PAD_R;
  const t = Math.max(0, Math.min(1, (x - GROOVE_LAB_FX_PAD_L) / Math.max(1, innerW)));
  return 20 * Math.pow(GROOVE_LAB_FX_NYQUIST_HZ / 20, t);
}

export function grooveLabFxDbToY(db: number, h = GROOVE_LAB_FX_GRAPH_H): number {
  const innerH = h - GROOVE_LAB_FX_PAD_T - GROOVE_LAB_FX_PAD_B;
  return GROOVE_LAB_FX_PAD_T + ((GROOVE_LAB_FX_DB_MAX - Math.max(GROOVE_LAB_FX_DB_MIN, Math.min(GROOVE_LAB_FX_DB_MAX, db))) / (GROOVE_LAB_FX_DB_MAX - GROOVE_LAB_FX_DB_MIN)) * innerH;
}

export function grooveLabFxYToDb(y: number, h = GROOVE_LAB_FX_GRAPH_H): number {
  const innerH = h - GROOVE_LAB_FX_PAD_T - GROOVE_LAB_FX_PAD_B;
  const t = Math.max(0, Math.min(1, (y - GROOVE_LAB_FX_PAD_T) / Math.max(1, innerH)));
  return GROOVE_LAB_FX_DB_MAX - t * (GROOVE_LAB_FX_DB_MAX - GROOVE_LAB_FX_DB_MIN);
}

const FREQ_MAG_LEN = 120;

export function buildLogFreqs(n: number): Float32Array {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = i / (n - 1 || 1);
    out[i] = 20 * Math.pow(GROOVE_LAB_FX_NYQUIST_HZ / 20, t);
  }
  return out;
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

export function computeGrooveLabFxMagDb(
  freqs: Float32Array,
  rack: Pick<GrooveLabChannelFxRack, 'cutoff' | 'eq'>,
): Float32Array {
  if (typeof window === 'undefined') {
    return Float32Array.from({ length: freqs.length }, () => 0);
  }
  try {
    const ac = new AudioContext({ sampleRate: 48000 });
    const phase = new Float32Array(freqs.length);
    const chain: BiquadFilterNode[] = [];

    const hp = ac.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = rack.cutoff.enabled ? rack.cutoff.lowCutHz : 20;
    hp.Q.value = 0.707;
    chain.push(hp);

    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = rack.cutoff.enabled ? rack.cutoff.highCutHz : 20000;
    lp.Q.value = 0.707;
    chain.push(lp);

    if (rack.eq.enabled) {
      for (const band of rack.eq.bands) {
        const f = ac.createBiquadFilter();
        f.type = band.kind;
        f.frequency.value = band.freqHz;
        f.gain.value = band.gainDb;
        f.Q.value = band.kind === 'peaking' ? band.q : 0.707;
        chain.push(f);
      }
    }

    const combined = new Float32Array(freqs.length);
    combined.fill(1);
    for (const node of chain) {
      const mag = new Float32Array(freqs.length);
      node.getFrequencyResponse(freqs, mag, phase);
      for (let i = 0; i < freqs.length; i += 1) combined[i] = (combined[i] ?? 1) * (mag[i] ?? 1);
    }

    const out = new Float32Array(freqs.length);
    for (let i = 0; i < freqs.length; i += 1) {
      out[i] = 20 * Math.log10(Math.max(1e-8, combined[i] ?? 1));
    }
    void ac.close().catch(() => {});
    return out;
  } catch {
    return Float32Array.from({ length: freqs.length }, () => 0);
  }
}

export function grooveLabFxGridFreqs(): number[] {
  return [50, 100, 200, 500, 1000, 2000, 5000, 10000];
}

export function grooveLabFxGridDbLines(): number[] {
  return [-12, -9, -6, -3, 0, 3, 6, 9, 12];
}

export { FREQ_MAG_LEN, magDbAtHz };
