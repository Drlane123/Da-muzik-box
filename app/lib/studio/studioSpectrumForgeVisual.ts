/**
 * Spectrum Forge display math — band influence + EQ curve overlay.
 */
import {
  SPECTRUM_FORGE_BAND_COLORS,
  SPECTRUM_FORGE_BOOST_MAX_DB,
  SPECTRUM_FORGE_MAX_HZ,
  SPECTRUM_FORGE_MIN_HZ,
  spectrumForgeHzToNorm,
  type StudioSpectrumForgeBandId,
  type StudioSpectrumForgeFx,
} from '@/app/lib/studio/studioSpectrumForge';

const BAND_SIGMA_OCT: Record<StudioSpectrumForgeBandId, number> = {
  low: 0.92,
  mid: 0.72,
  high: 0.88,
};

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function spectrumForgeHzAtNorm(norm: number): number {
  const t = Math.max(0, Math.min(1, norm));
  const logMin = Math.log10(SPECTRUM_FORGE_MIN_HZ);
  const logMax = Math.log10(SPECTRUM_FORGE_MAX_HZ);
  return Math.pow(10, logMin + t * (logMax - logMin));
}

export function spectrumForgeBandWeightAtHz(
  hz: number,
  centerHz: number,
  band: StudioSpectrumForgeBandId,
): number {
  if (hz <= 0 || centerHz <= 0) return 0;
  const logDist = Math.log2(hz / centerHz);
  const sigma = BAND_SIGMA_OCT[band];
  return Math.exp(-0.5 * (logDist / sigma) ** 2);
}

export type SpectrumForgeEnhanceSample = {
  r: number;
  g: number;
  b: number;
  amount: number;
};

export function spectrumForgeEnhanceAtHz(
  hz: number,
  fx: StudioSpectrumForgeFx,
  inputLinear: number,
): SpectrumForgeEnhanceSample {
  if (!fx.enabled || inputLinear <= 0.001) {
    return { r: 0, g: 0, b: 0, amount: 0 };
  }

  const mix = Math.max(0, Math.min(1, fx.mix));
  let r = 0;
  let g = 0;
  let b = 0;
  let amount = 0;

  const bands: StudioSpectrumForgeBandId[] = ['low', 'mid', 'high'];
  for (const id of bands) {
    const band = fx[id];
    const boost = band.boostDb / SPECTRUM_FORGE_BOOST_MAX_DB;
    const strength = Math.abs(boost) * mix;
    if (strength < 0.02) continue;

    const w = spectrumForgeBandWeightAtHz(hz, band.centerHz, id);
    if (w < 0.04) continue;

    const contrib = w * strength * inputLinear;
    const [cr, cg, cb] = hexToRgb(SPECTRUM_FORGE_BAND_COLORS[id]);
    r += cr * contrib;
    g += cg * contrib;
    b += cb * contrib;
    amount += contrib;
  }

  if (amount > 0.001) {
    const scale = 1 / amount;
    r = Math.min(255, r * scale);
    g = Math.min(255, g * scale);
    b = Math.min(255, b * scale);
  }

  return { r, g, b, amount: Math.min(1, amount * 1.8) };
}

export function spectrumForgeNormForBandCenter(centerHz: number): number {
  return spectrumForgeHzToNorm(centerHz);
}

/**
 * EQ curve overlay from center line — matches audio: +dB up, −dB down.
 * No input-signal coupling (avoids backwards / random-looking motion).
 */
export function spectrumForgeBandLiftAtColumn(
  _preAtColumn: number,
  hz: number,
  band: { centerHz: number; boostDb: number; subDrive: number },
  bandId: StudioSpectrumForgeBandId,
  mix: number,
  halfSpan: number,
): number {
  const wBand = spectrumForgeBandWeightAtHz(hz, band.centerHz, bandId);
  if (wBand < 0.02) return 0;

  let boostDb = band.boostDb;
  if (bandId === 'low' && band.subDrive > 0.03 && boostDb > 0) {
    boostDb += band.subDrive * SPECTRUM_FORGE_BOOST_MAX_DB * 0.35;
  }

  const boostN = boostDb / SPECTRUM_FORGE_BOOST_MAX_DB;
  if (Math.abs(boostN) < 0.02) return 0;

  return wBand * boostN * halfSpan * Math.max(0, Math.min(1, mix)) * 0.9;
}

export function spectrumForgeTotalBoostDbAtHz(hz: number, fx: StudioSpectrumForgeFx): number {
  if (!fx.enabled) return 0;
  let db = 0;
  const bands: StudioSpectrumForgeBandId[] = ['low', 'mid', 'high'];
  for (const id of bands) {
    const band = fx[id];
    const w = spectrumForgeBandWeightAtHz(hz, band.centerHz, id);
    if (w < 0.03) continue;
    db += band.boostDb * w;
  }
  return db * Math.max(0, Math.min(1, fx.mix));
}
