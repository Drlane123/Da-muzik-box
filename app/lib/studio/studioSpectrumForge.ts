/**
 * Studio Editor 2 — Spectrum Forge: center-zero L/M/H EQ on a log spectrum axis.
 */
export const SPECTRUM_FORGE_MIN_HZ = 20;
export const SPECTRUM_FORGE_MAX_HZ = 16000;

export const SPECTRUM_FORGE_LOW_HZ_MIN = 40;
export const SPECTRUM_FORGE_LOW_HZ_MAX = 400;
export const SPECTRUM_FORGE_MID_HZ_MIN = 180;
export const SPECTRUM_FORGE_MID_HZ_MAX = 5000;
export const SPECTRUM_FORGE_HIGH_HZ_MIN = 2000;
export const SPECTRUM_FORGE_HIGH_HZ_MAX = 16000;

/** ±dB — standard gentle insert range. */
export const SPECTRUM_FORGE_BOOST_MAX_DB = 6;
export const SPECTRUM_FORGE_SUB_DRIVE_MAX = 1;

export type StudioSpectrumForgeBandId = 'low' | 'mid' | 'high';

export type StudioSpectrumForgeBand = {
  centerHz: number;
  boostDb: number;
  /** Visual low-end emphasis hint only (not in audio path). */
  subDrive: number;
};

export type StudioSpectrumForgeFx = {
  enabled: boolean;
  /** Dry/wet — scales band gain on the EQ path (1 = full band amount). */
  mix: number;
  outputDb: number;
  low: StudioSpectrumForgeBand;
  mid: StudioSpectrumForgeBand;
  high: StudioSpectrumForgeBand;
};

export function spectrumForgeHzToNorm(hz: number): number {
  const clamped = Math.max(SPECTRUM_FORGE_MIN_HZ, Math.min(SPECTRUM_FORGE_MAX_HZ, hz));
  const logMin = Math.log10(SPECTRUM_FORGE_MIN_HZ);
  const logMax = Math.log10(SPECTRUM_FORGE_MAX_HZ);
  return (Math.log10(clamped) - logMin) / (logMax - logMin);
}

export function spectrumForgeNormToHz(norm: number): number {
  const t = Math.max(0, Math.min(1, norm));
  const logMin = Math.log10(SPECTRUM_FORGE_MIN_HZ);
  const logMax = Math.log10(SPECTRUM_FORGE_MAX_HZ);
  return Math.pow(10, logMin + t * (logMax - logMin));
}

function clampBandHz(id: StudioSpectrumForgeBandId, hz: number): number {
  if (id === 'low') return Math.max(SPECTRUM_FORGE_LOW_HZ_MIN, Math.min(SPECTRUM_FORGE_LOW_HZ_MAX, hz));
  if (id === 'mid') return Math.max(SPECTRUM_FORGE_MID_HZ_MIN, Math.min(SPECTRUM_FORGE_MID_HZ_MAX, hz));
  return Math.max(SPECTRUM_FORGE_HIGH_HZ_MIN, Math.min(SPECTRUM_FORGE_HIGH_HZ_MAX, hz));
}

function normalizeBand(
  raw: Partial<StudioSpectrumForgeBand> | null | undefined,
  id: StudioSpectrumForgeBandId,
  defaults: StudioSpectrumForgeBand,
): StudioSpectrumForgeBand {
  return {
    centerHz: clampBandHz(id, raw?.centerHz ?? defaults.centerHz),
    boostDb: Math.max(
      -SPECTRUM_FORGE_BOOST_MAX_DB,
      Math.min(SPECTRUM_FORGE_BOOST_MAX_DB, raw?.boostDb ?? defaults.boostDb),
    ),
    subDrive:
      id === 'low'
        ? Math.max(0, Math.min(SPECTRUM_FORGE_SUB_DRIVE_MAX, raw?.subDrive ?? defaults.subDrive))
        : 0,
  };
}

export function defaultStudioSpectrumForgeFx(): StudioSpectrumForgeFx {
  return {
    enabled: false,
    mix: 1,
    outputDb: 0,
    low: { centerHz: 120, boostDb: 0, subDrive: 0 },
    mid: { centerHz: 1000, boostDb: 0, subDrive: 0 },
    high: { centerHz: 10000, boostDb: 0, subDrive: 0 },
  };
}

export function normalizeStudioSpectrumForgeFx(
  raw: Partial<StudioSpectrumForgeFx> | null | undefined,
): StudioSpectrumForgeFx {
  const d = defaultStudioSpectrumForgeFx();
  return {
    enabled: false,
    mix: Math.max(0, Math.min(1, raw?.mix ?? d.mix)),
    outputDb: Math.max(-12, Math.min(12, raw?.outputDb ?? d.outputDb)),
    low: normalizeBand(raw?.low, 'low', d.low),
    mid: normalizeBand(raw?.mid, 'mid', d.mid),
    high: normalizeBand(raw?.high, 'high', d.high),
  };
}

export function cloneStudioSpectrumForgeFx(fx: StudioSpectrumForgeFx): StudioSpectrumForgeFx {
  return normalizeStudioSpectrumForgeFx(fx);
}

/** Power on — EQ may be spliced into the lane bus. */
export function studioSpectrumForgeActive(fx: StudioSpectrumForgeFx): boolean {
  return fx.enabled;
}

/** dB threshold below which a band counts as center / unity. */
export const SPECTRUM_FORGE_UNITY_DB_THRESH = 0.05;

export function studioSpectrumForgeBandAdjusted(
  fx: StudioSpectrumForgeFx,
  id: StudioSpectrumForgeBandId,
): boolean {
  return Math.abs(fx[id].boostDb) > SPECTRUM_FORGE_UNITY_DB_THRESH;
}

export function spectrumForgeFormatHz(hz: number): string {
  if (hz >= 1000) return `${(hz / 1000).toFixed(hz >= 10000 ? 0 : 1)}k`;
  return `${Math.round(hz)}`;
}

export const SPECTRUM_FORGE_BAND_COLORS: Record<StudioSpectrumForgeBandId, string> = {
  low: '#ff8c42',
  mid: '#7cf4c6',
  high: '#a78bfa',
};

export const SPECTRUM_FORGE_BAND_LABELS: Record<StudioSpectrumForgeBandId, string> = {
  low: 'LOWS',
  mid: 'MIDS',
  high: 'HIGHS',
};
