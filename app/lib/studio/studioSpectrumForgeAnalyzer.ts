/**
 * Honest spectrum readout for Spectrum Forge — Web Audio AnalyserNode FFT only.
 *
 * Per MDN: getFloatFrequencyData() returns dB per linear FFT bin (0 … Nyquist).
 * Display uses a log frequency axis (20 Hz–20 kHz); each column samples the
 * FFT bin(s) that correspond to that Hz — no synthetic shaping or regional inflate.
 */
import {
  STUDIO_ANALYSER_SPECTRUM_FLOOR_DB,
  studioAnalyserDbToLinear,
} from '@/app/lib/studio/studioTrackAnalyserBus';
import type { StudioSpectrumForgeBandId } from '@/app/lib/studio/studioSpectrumForge';
import { spectrumForgeBandWeightAtHz } from '@/app/lib/studio/studioSpectrumForgeVisual';

export const SPECTRUM_FORGE_DISPLAY_MIN_HZ = 20;
export const SPECTRUM_FORGE_DISPLAY_MAX_HZ = 20000;

/** SPAN-style dB range for analyser tap (honest FFT capture). */
export const SPECTRUM_FORGE_ANALYSER_MIN_DB = -70;
export const SPECTRUM_FORGE_ANALYSER_MAX_DB = -6;
/** UI-only gain so VU bars reach useful height on typical lane levels. */
export const SPECTRUM_FORGE_METER_DISPLAY_GAIN = 5.5;

/**
 * Display Y-axis — narrower than analyser range so normal mix levels lift visibly.
 * Shape stays honest; only the vertical scale is expanded for readability.
 */
export const SPECTRUM_FORGE_PLOT_FLOOR_DB = -78;
export const SPECTRUM_FORGE_PLOT_CEIL_DB = -16;
/** Moderate lift — shape stays honest; soft knee handles peaks (no flat wall). */
export const SPECTRUM_FORGE_DISPLAY_GAIN = 1.35;

/** Honest log-column read with perceptual tilt so lows/mids/highs read level on the graph. */
export function spectrumForgeApplyDisplayTilt(linear: number, hz: number): number {
  if (linear <= 0 || hz <= 0) return 0;
  const refHz = 1000;
  return linear * Math.sqrt(hz / refHz);
}

/** Map column magnitude to height above center line (0…halfSpan). */
export function spectrumForgeLinearToPlotNorm(linear: number, halfSpan = 0.4): number {
  if (!Number.isFinite(linear) || linear <= 0) return 0;
  const db = 20 * Math.log10(linear);
  if (db <= SPECTRUM_FORGE_PLOT_FLOOR_DB) return 0;
  const span = SPECTRUM_FORGE_PLOT_CEIL_DB - SPECTRUM_FORGE_PLOT_FLOOR_DB;
  const t = (db - SPECTRUM_FORGE_PLOT_FLOOR_DB) / span;
  const raw = t * SPECTRUM_FORGE_DISPLAY_GAIN * halfSpan;
  const knee = halfSpan * 0.82;
  if (raw <= knee) return raw;
  const headroom = Math.max(0.001, halfSpan - knee);
  const excess = raw - knee;
  const compressed = knee + headroom * (1 - Math.exp(-excess / headroom));
  return Math.min(halfSpan * 0.98, compressed);
}

export function spectrumForgeConfigureAnalyser(analyser: AnalyserNode): void {
  analyser.minDecibels = SPECTRUM_FORGE_ANALYSER_MIN_DB;
  analyser.maxDecibels = SPECTRUM_FORGE_ANALYSER_MAX_DB;
  analyser.smoothingTimeConstant = 0.35;
}

/** Expand FFT linear magnitudes for Spectrum Forge VU display. */
export function spectrumForgeMeterDisplayLinear(linear: number): number {
  if (linear <= 0) return 0;
  return Math.min(1, linear * SPECTRUM_FORGE_METER_DISPLAY_GAIN);
}

export function spectrumForgeHzToNorm(hz: number): number {
  const clamped = Math.max(
    SPECTRUM_FORGE_DISPLAY_MIN_HZ,
    Math.min(SPECTRUM_FORGE_DISPLAY_MAX_HZ, hz),
  );
  const logMin = Math.log10(SPECTRUM_FORGE_DISPLAY_MIN_HZ);
  const logMax = Math.log10(SPECTRUM_FORGE_DISPLAY_MAX_HZ);
  return (Math.log10(clamped) - logMin) / (logMax - logMin);
}

export function spectrumForgeNormToHz(norm: number): number {
  const t = Math.max(0, Math.min(1, norm));
  const logMin = Math.log10(SPECTRUM_FORGE_DISPLAY_MIN_HZ);
  const logMax = Math.log10(SPECTRUM_FORGE_DISPLAY_MAX_HZ);
  return 10 ** (logMin + t * (logMax - logMin));
}

/** Linear FFT bin for a frequency (AnalyserNode bins are linear 0…Nyquist). */
export function spectrumForgeHzToFftBin(hz: number, binCount: number, nyquistHz: number): number {
  return Math.min(binCount - 1, Math.max(0, Math.round((hz / nyquistHz) * binCount)));
}

/**
 * Read one log-spaced display column from an FFT magnitude buffer (linear 0–1).
 * Averages the FFT bins that fall inside this column's Hz window.
 */
export function spectrumForgeReadLogColumn(
  spectrumLinear: Float32Array,
  columnNorm: number,
  columnCount: number,
  nyquistHz: number,
): number {
  const n = Math.max(2, columnCount);
  const t = columnNorm * (n - 1);
  const hz = spectrumForgeNormToHz(columnNorm);
  const hzLo = spectrumForgeNormToHz(Math.max(0, (t - 0.5) / (n - 1)));
  const hzHi = spectrumForgeNormToHz(Math.min(1, (t + 0.5) / (n - 1)));
  const binLo = spectrumForgeHzToFftBin(hzLo, spectrumLinear.length, nyquistHz);
  const binHi = spectrumForgeHzToFftBin(hzHi, spectrumLinear.length, nyquistHz);
  let sum = 0;
  let count = 0;
  for (let b = binLo; b <= binHi; b++) {
    sum += spectrumLinear[b] ?? 0;
    count++;
  }
  return count > 0 ? sum / count : 0;
}

/** Direct read from analyser float dB buffer (bypasses pre-normalized spectrum if needed). */
export function spectrumForgeReadLogColumnFromDb(
  dbBuf: Float32Array,
  columnNorm: number,
  columnCount: number,
  nyquistHz: number,
): number {
  const n = Math.max(2, columnCount);
  const t = columnNorm * (n - 1);
  const hzLo = spectrumForgeNormToHz(Math.max(0, (t - 0.5) / (n - 1)));
  const hzHi = spectrumForgeNormToHz(Math.min(1, (t + 0.5) / (n - 1)));
  const binLo = spectrumForgeHzToFftBin(hzLo, dbBuf.length, nyquistHz);
  const binHi = spectrumForgeHzToFftBin(hzHi, dbBuf.length, nyquistHz);
  let sum = 0;
  let count = 0;
  for (let b = binLo; b <= binHi; b++) {
    const lin = studioAnalyserDbToLinear(dbBuf[b] ?? SPECTRUM_FORGE_ANALYSER_MIN_DB);
    sum += lin;
    count++;
  }
  if (count <= 0) return 0;
  return sum / count;
}

/** Average dB in a log column (power-domain: convert each bin to linear, mean, return dB). */
export function spectrumForgeReadLogColumnDbAvg(
  dbBuf: Float32Array,
  columnNorm: number,
  columnCount: number,
  nyquistHz: number,
): number {
  const linear = spectrumForgeReadLogColumnFromDb(dbBuf, columnNorm, columnCount, nyquistHz);
  if (linear <= 0) return SPECTRUM_FORGE_ANALYSER_MIN_DB;
  const db = 20 * Math.log10(linear);
  return Math.max(SPECTRUM_FORGE_ANALYSER_MIN_DB, Math.min(SPECTRUM_FORGE_ANALYSER_MAX_DB, db));
}

/** Default analyser nyquist when sample rate is unknown (48 kHz context). */
export const SPECTRUM_FORGE_DEFAULT_NYQUIST_HZ = 24000;

/** Live level 0–1 for one L/M/H band from an FFT magnitude buffer. */
export function spectrumForgeBandLiveLevel(
  spectrumLinear: Float32Array,
  centerHz: number,
  bandId: StudioSpectrumForgeBandId,
  nyquistHz = SPECTRUM_FORGE_DEFAULT_NYQUIST_HZ,
): number {
  if (spectrumLinear.length <= 0) return 0;
  let weighted = 0;
  let weightSum = 0;
  for (let i = 0; i < spectrumLinear.length; i++) {
    const hz = ((i + 0.5) / spectrumLinear.length) * nyquistHz;
    const w = spectrumForgeBandWeightAtHz(hz, centerHz, bandId);
    if (w < 0.03) continue;
    weighted += (spectrumLinear[i] ?? 0) * w;
    weightSum += w;
  }
  if (weightSum <= 0) {
    const norm = spectrumForgeHzToNorm(centerHz);
    return spectrumForgeReadLogColumn(spectrumLinear, norm, 48, nyquistHz);
  }
  return weighted / weightSum;
}

const SIGNAL_FFT_ACTIVE_DB = -66;
const SIGNAL_HOLD_FRAMES = 20;

/** Stable live gate — hysteresis + hold so the spectrum does not flicker on/off. */
export function spectrumForgeSignalDisplayLive(
  snap: { hasSignal: boolean; peak: number; rms: number } | null,
  dbBuf: Float32Array | null,
  holdRef: { current: number },
): boolean {
  let fftPeakDb = SPECTRUM_FORGE_ANALYSER_MIN_DB;
  if (dbBuf && dbBuf.length > 0) {
    for (let i = 0; i < dbBuf.length; i++) {
      const db = dbBuf[i] ?? SPECTRUM_FORGE_ANALYSER_MIN_DB;
      if (Number.isFinite(db) && db > fftPeakDb) fftPeakDb = db;
    }
  }
  const meterLive = snap?.hasSignal ?? false;
  const fftLive = fftPeakDb > SIGNAL_FFT_ACTIVE_DB;
  const softMeter =
    (snap?.peak ?? 0) >= 0.004 || (snap?.rms ?? 0) >= 0.0025;
  if (meterLive || fftLive || softMeter) {
    holdRef.current = SIGNAL_HOLD_FRAMES;
  } else if (holdRef.current > 0) {
    holdRef.current -= 1;
  }
  return holdRef.current > 0;
}
