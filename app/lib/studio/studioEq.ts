/**
 * Studio FX Suite — 8-band parametric EQ (default grid anchors, bands draggable on graph).
 */

import type { PadSamplerEqFx } from '@/app/lib/creationStation/padSamplerFxRack';
import type { GrooveLabEqBand } from '@/app/lib/creationStation/grooveLabChannelFxEq';

export const STUDIO_EQ_BAND_COUNT = 8;

/** Default band centers — graph grid anchors; each band may be dragged horizontally. */
export const STUDIO_EQ_GRID_FREQS = [50, 100, 200, 500, 1000, 2000, 5000, 10000] as const;

export type StudioEqBand = GrooveLabEqBand;
export type StudioEqFx = {
  enabled: boolean;
  bands: StudioEqBand[];
};

export const STUDIO_EQ_GRAPH_W = 488;
export const STUDIO_EQ_GRAPH_H = 112;
export const STUDIO_EQ_PAD_L = 32;
export const STUDIO_EQ_PAD_R = 12;
export const STUDIO_EQ_PAD_T = 14;
export const STUDIO_EQ_PAD_B = 22;

export const STUDIO_EQ_BAND_LABELS = ['50', '100', '200', '500', '1K', '2K', '5K', '10K'] as const;

const STUDIO_EQ_BAND_COLORS = [
  '#6366f1',
  '#6d72ee',
  '#818cf8',
  '#9498f8',
  '#a78bfa',
  '#7dd3fc',
  '#5eead4',
  '#34d399',
] as const;
const STUDIO_EQ_BAND_STROKES = [
  '#a5b4fc',
  '#b0b8fc',
  '#c7d2fe',
  '#d4d8fe',
  '#e9d5ff',
  '#a5f3fc',
  '#99f6e4',
  '#7cf4c6',
] as const;

export function studioEqBandColor(i: number): { fill: string; stroke: string } {
  return {
    fill: STUDIO_EQ_BAND_COLORS[i % STUDIO_EQ_BAND_COLORS.length]!,
    stroke: STUDIO_EQ_BAND_STROKES[i % STUDIO_EQ_BAND_STROKES.length]!,
  };
}

export function defaultStudioEqBands(): StudioEqBand[] {
  return STUDIO_EQ_GRID_FREQS.map((freqHz) => ({
    kind: 'peaking' as const,
    gainDb: 0,
    freqHz,
    q: 1.1,
  }));
}

export function defaultStudioEq(): StudioEqFx {
  return { enabled: false, bands: defaultStudioEqBands() };
}

export function studioEqFormatBandHz(hz: number): string {
  if (hz >= 1000) return `${(hz / 1000).toFixed(hz >= 10000 ? 0 : 1)}K`;
  return String(Math.round(hz));
}

function clampStudioEqBand(band: StudioEqBand, index: number): StudioEqBand {
  const defaultFreq = STUDIO_EQ_GRID_FREQS[index] ?? 1000;
  const freqHz = Math.max(30, Math.min(18000, band.freqHz || defaultFreq));
  return {
    kind: 'peaking',
    gainDb: Math.max(-12, Math.min(12, band.gainDb)),
    freqHz,
    q: Math.max(0.35, Math.min(12, band.q)),
  };
}

export function clampStudioEqBands(bands: StudioEqBand[]): StudioEqBand[] {
  const defaults = defaultStudioEqBands();
  const out = STUDIO_EQ_GRID_FREQS.map((_, i) =>
    clampStudioEqBand({ ...defaults[i]!, ...bands[i] }, i),
  );
  const minGap = 28;
  for (let i = 1; i < out.length; i += 1) {
    if (out[i]!.freqHz < out[i - 1]!.freqHz + minGap) {
      out[i] = { ...out[i]!, freqHz: Math.min(18000, out[i - 1]!.freqHz + minGap) };
    }
  }
  for (let i = out.length - 2; i >= 0; i -= 1) {
    if (out[i]!.freqHz > out[i + 1]!.freqHz - minGap) {
      out[i] = { ...out[i]!, freqHz: Math.max(30, out[i + 1]!.freqHz - minGap) };
    }
  }
  return out;
}

export function clampStudioEq(eq: StudioEqFx): StudioEqFx {
  return {
    enabled: Boolean(eq.enabled),
    bands: clampStudioEqBands(eq.bands ?? defaultStudioEqBands()),
  };
}

/** Map legacy 3/5-band state onto the 8 grid bands by nearest frequency. */
function migrateBandsToStudio8(bands: StudioEqBand[]): StudioEqBand[] {
  const out = defaultStudioEqBands();
  if (bands.length === STUDIO_EQ_BAND_COUNT) {
    return clampStudioEqBands(bands);
  }
  for (const band of bands) {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < STUDIO_EQ_GRID_FREQS.length; i += 1) {
      const dist = Math.abs(Math.log(Math.max(20, band.freqHz) / STUDIO_EQ_GRID_FREQS[i]!));
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    out[best] = {
      kind: 'peaking',
      gainDb: band.gainDb,
      freqHz: band.freqHz,
      q: band.q,
    };
  }
  return clampStudioEqBands(out);
}

function migratePadEqToStudio8(old: PadSamplerEqFx): StudioEqFx {
  const mid = old.midFreqHz;
  return clampStudioEq({
    enabled: old.enabled,
    bands: migrateBandsToStudio8([
      { kind: 'lowshelf', gainDb: old.lowGainDb, freqHz: old.lowFreqHz, q: 0.71 },
      { kind: 'peaking', gainDb: 0, freqHz: Math.max(120, Math.round(mid * 0.35)), q: 1 },
      { kind: 'peaking', gainDb: old.midGainDb, freqHz: mid, q: old.midQ },
      { kind: 'peaking', gainDb: 0, freqHz: Math.min(12000, Math.round(mid * 2.8)), q: 1.1 },
      { kind: 'highshelf', gainDb: old.highGainDb, freqHz: old.highFreqHz, q: 0.71 },
    ]),
  });
}

/** Accept legacy 3-band pad EQ or partial older band counts. */
export function normalizeStudioEq(raw: Partial<StudioEqFx> | PadSamplerEqFx | null | undefined): StudioEqFx {
  if (!raw) return defaultStudioEq();
  if ('bands' in raw && Array.isArray(raw.bands) && raw.bands.length > 0) {
    return clampStudioEq({
      enabled: raw.enabled ?? false,
      bands: migrateBandsToStudio8(raw.bands),
    });
  }
  if ('lowGainDb' in raw) {
    return migratePadEqToStudio8(raw as PadSamplerEqFx);
  }
  return defaultStudioEq();
}

export function studioEqHzToX(hz: number, w = STUDIO_EQ_GRAPH_W): number {
  const innerW = w - STUDIO_EQ_PAD_L - STUDIO_EQ_PAD_R;
  const nyquist = 20000;
  return STUDIO_EQ_PAD_L + (Math.log(Math.max(20, hz) / 20) / Math.log(nyquist / 20)) * innerW;
}

export function studioEqXToHz(x: number, w = STUDIO_EQ_GRAPH_W): number {
  const innerW = w - STUDIO_EQ_PAD_L - STUDIO_EQ_PAD_R;
  const nyquist = 20000;
  const t = Math.max(0, Math.min(1, (x - STUDIO_EQ_PAD_L) / Math.max(1, innerW)));
  return 20 * Math.pow(nyquist / 20, t);
}

export function studioEqDbToY(db: number, h = STUDIO_EQ_GRAPH_H): number {
  const dbMin = -12;
  const dbMax = 12;
  const innerH = h - STUDIO_EQ_PAD_T - STUDIO_EQ_PAD_B;
  return STUDIO_EQ_PAD_T + ((dbMax - Math.max(dbMin, Math.min(dbMax, db))) / (dbMax - dbMin)) * innerH;
}

export function studioEqYToDb(y: number, h = STUDIO_EQ_GRAPH_H): number {
  const dbMin = -12;
  const dbMax = 12;
  const innerH = h - STUDIO_EQ_PAD_T - STUDIO_EQ_PAD_B;
  const t = Math.max(0, Math.min(1, (y - STUDIO_EQ_PAD_T) / Math.max(1, innerH)));
  return dbMax - t * (dbMax - dbMin);
}

export function computeStudioEqMagDb(freqs: Float32Array, eq: StudioEqFx): Float32Array {
  if (typeof window === 'undefined') {
    return Float32Array.from({ length: freqs.length }, () => 0);
  }
  try {
    const ac = new AudioContext({ sampleRate: 48000 });
    const phase = new Float32Array(freqs.length);
    const chain: BiquadFilterNode[] = [];
    if (eq.enabled) {
      for (const band of eq.bands) {
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

export function patchStudioEqBands(eq: StudioEqFx, bands: StudioEqBand[]): StudioEqFx {
  return clampStudioEq({ ...eq, bands: clampStudioEqBands(bands) });
}

export const STUDIO_EQ_PRESETS: { id: string; label: string; bands: StudioEqBand[] }[] = [
  {
    id: 'flat',
    label: 'Flat',
    bands: defaultStudioEqBands(),
  },
  {
    id: 'vocal',
    label: 'Vocal',
    bands: [
      { kind: 'peaking', gainDb: -2, freqHz: 50, q: 1.1 },
      { kind: 'peaking', gainDb: -1.5, freqHz: 100, q: 1.1 },
      { kind: 'peaking', gainDb: 0, freqHz: 200, q: 1 },
      { kind: 'peaking', gainDb: 0.5, freqHz: 500, q: 1 },
      { kind: 'peaking', gainDb: 1, freqHz: 1000, q: 1.1 },
      { kind: 'peaking', gainDb: 2.5, freqHz: 2000, q: 1.2 },
      { kind: 'peaking', gainDb: 2, freqHz: 5000, q: 1.1 },
      { kind: 'peaking', gainDb: 3, freqHz: 10000, q: 1 },
    ],
  },
  {
    id: 'warm',
    label: 'Warm',
    bands: [
      { kind: 'peaking', gainDb: +2.5, freqHz: 50, q: 1.1 },
      { kind: 'peaking', gainDb: 2, freqHz: 100, q: 1.1 },
      { kind: 'peaking', gainDb: 1, freqHz: 200, q: 1 },
      { kind: 'peaking', gainDb: 0, freqHz: 500, q: 1 },
      { kind: 'peaking', gainDb: -0.5, freqHz: 1000, q: 1 },
      { kind: 'peaking', gainDb: -1, freqHz: 2000, q: 1 },
      { kind: 'peaking', gainDb: -1.5, freqHz: 5000, q: 1 },
      { kind: 'peaking', gainDb: -2, freqHz: 10000, q: 1 },
    ],
  },
  {
    id: 'bright',
    label: 'Bright',
    bands: [
      { kind: 'peaking', gainDb: -1.5, freqHz: 50, q: 1 },
      { kind: 'peaking', gainDb: -1, freqHz: 100, q: 1 },
      { kind: 'peaking', gainDb: 0, freqHz: 200, q: 1 },
      { kind: 'peaking', gainDb: 0.5, freqHz: 500, q: 1 },
      { kind: 'peaking', gainDb: 1, freqHz: 1000, q: 1 },
      { kind: 'peaking', gainDb: 2, freqHz: 2000, q: 1.1 },
      { kind: 'peaking', gainDb: 3.5, freqHz: 5000, q: 1.15 },
      { kind: 'peaking', gainDb: 4.5, freqHz: 10000, q: 1 },
    ],
  },
  {
    id: 'phone',
    label: 'Phone',
    bands: [
      { kind: 'peaking', gainDb: -8, freqHz: 50, q: 1.2 },
      { kind: 'peaking', gainDb: -7, freqHz: 100, q: 1.2 },
      { kind: 'peaking', gainDb: -4, freqHz: 200, q: 1.1 },
      { kind: 'peaking', gainDb: 1, freqHz: 500, q: 1.2 },
      { kind: 'peaking', gainDb: 3, freqHz: 1000, q: 1.3 },
      { kind: 'peaking', gainDb: 4, freqHz: 2000, q: 1.3 },
      { kind: 'peaking', gainDb: -2, freqHz: 5000, q: 1.1 },
      { kind: 'peaking', gainDb: -6, freqHz: 10000, q: 1 },
    ],
  },
  {
    id: 'bass',
    label: 'Bass+',
    bands: [
      { kind: 'peaking', gainDb: 5, freqHz: 50, q: 1.1 },
      { kind: 'peaking', gainDb: 4, freqHz: 100, q: 1.1 },
      { kind: 'peaking', gainDb: 2, freqHz: 200, q: 1 },
      { kind: 'peaking', gainDb: 0.5, freqHz: 500, q: 1 },
      { kind: 'peaking', gainDb: 0, freqHz: 1000, q: 1 },
      { kind: 'peaking', gainDb: -1, freqHz: 2000, q: 1 },
      { kind: 'peaking', gainDb: -1.5, freqHz: 5000, q: 1 },
      { kind: 'peaking', gainDb: -2, freqHz: 10000, q: 1 },
    ],
  },
];

/** @deprecated Use STUDIO_EQ_PRESETS */
export const STUDIO_EQ_PRESETS_5 = STUDIO_EQ_PRESETS;
