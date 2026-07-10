/** Mastering Bay meter ballistics + dB → UI mapping (-60 … +3 dBFS).
 *
 * Peak / true-peak follow ITU-R BS.1770 practice:
 * - Sample peak = max |x[n]| in the analyser window
 * - True peak (dBTP) = max |x| after 4× oversampling (Catmull-Rom),
 *   so inter-sample peaks are visible on the TP meters and can drive the limiter readout.
 */

export const METER_DB_FLOOR = -60;
export const METER_DB_CEIL = 3;
/** Classic VU integration time (rise and fall). */
export const VU_INTEGRATION_SEC = 0.3;
/** Peak-hold fall rate (dB per second). */
export const PEAK_HOLD_FALL_DB_PER_SEC = 12;
/** Gain-reduction column range (0 … max GR). */
export const GR_METER_MAX_DB = 24;

export function linToDb(amplitude: number): number {
  if (!Number.isFinite(amplitude) || amplitude <= 1e-10) return Number.NEGATIVE_INFINITY;
  return 20 * Math.log10(amplitude);
}

export function dbToLin(db: number): number {
  if (!Number.isFinite(db)) return 0;
  return 10 ** (db / 20);
}

/** Map dB linearly to 0–100% across the mastering meter range. */
export function dbToVuPct(db: number, floorDb = METER_DB_FLOOR, ceilDb = METER_DB_CEIL): number {
  if (!Number.isFinite(db)) return 0;
  const clamped = Math.max(floorDb, Math.min(ceilDb, db));
  return ((clamped - floorDb) / (ceilDb - floorDb)) * 100;
}

/** Gain-reduction bar: 0 dB GR → 0%, max GR → 100% (fills as the limiter works). */
export function grToMeterPct(grDb: number, maxGrDb = GR_METER_MAX_DB): number {
  if (!Number.isFinite(grDb) || grDb <= 0) return 0;
  return Math.max(0, Math.min(100, (grDb / maxGrDb) * 100));
}

/**
 * One-pole VU ballistics — 300 ms integration for rise and fall.
 * `dtSec` comes from the rAF clock, not the audio thread.
 */
export function vuBallisticsStep(currentDb: number, targetDb: number, dtSec: number): number {
  const dt = Math.max(0.001, Math.min(0.1, dtSec));
  const alpha = 1 - Math.exp(-dt / VU_INTEGRATION_SEC);
  if (!Number.isFinite(targetDb) || targetDb <= METER_DB_FLOOR - 6) {
    if (!Number.isFinite(currentDb)) return METER_DB_FLOOR;
    return currentDb + (METER_DB_FLOOR - currentDb) * alpha;
  }
  if (!Number.isFinite(currentDb)) return targetDb;
  return currentDb + (targetDb - currentDb) * alpha;
}

export function peakHoldStep(holdDb: number, instantDb: number, dtSec: number): number {
  const dt = Math.max(0.001, Math.min(0.1, dtSec));
  if (Number.isFinite(instantDb) && instantDb > holdDb) return instantDb;
  const next = holdDb - PEAK_HOLD_FALL_DB_PER_SEC * dt;
  return Number.isFinite(next) ? Math.max(METER_DB_FLOOR, next) : METER_DB_FLOOR;
}

export type ChannelMeterSample = {
  peakLin: number;
  rmsLin: number;
  /** Inter-sample (true) peak linear amplitude. */
  truePeakLin: number;
  peakDb: number;
  rmsDb: number;
  truePeakDb: number;
};

/** Centripetal Catmull-Rom sample at t∈[0,1] between p1 and p2. */
function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

/**
 * 4× oversampled true-peak from a time-domain window (ITU-R BS.1770 style).
 * Catmull-Rom is a practical real-time stand-in for the BS.1770 FIR phases.
 */
export function truePeakFromSamples(buf: Float32Array, n: number): number {
  if (n < 2) return 0;
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const v = Math.abs(buf[i] ?? 0);
    if (v > peak) peak = v;
  }
  for (let i = 0; i < n - 1; i++) {
    const p0 = buf[i === 0 ? 0 : i - 1] ?? 0;
    const p1 = buf[i] ?? 0;
    const p2 = buf[i + 1] ?? 0;
    const p3 = buf[i + 2 < n ? i + 2 : n - 1] ?? 0;
    for (let k = 1; k < 4; k++) {
      const v = Math.abs(catmullRom(p0, p1, p2, p3, k * 0.25));
      if (v > peak) peak = v;
    }
  }
  return peak;
}

export function readChannelMeter(analyser: AnalyserNode, buf: Float32Array): ChannelMeterSample {
  const n = analyser.fftSize;
  if (buf.length < n) {
    return {
      peakLin: 0,
      rmsLin: 0,
      truePeakLin: 0,
      peakDb: Number.NEGATIVE_INFINITY,
      rmsDb: Number.NEGATIVE_INFINITY,
      truePeakDb: Number.NEGATIVE_INFINITY,
    };
  }
  analyser.getFloatTimeDomainData(buf);
  let sum = 0;
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const v = Math.abs(buf[i] ?? 0);
    sum += v * v;
    if (v > peak) peak = v;
  }
  const rmsLin = Math.sqrt(sum / Math.max(1, n));
  const truePeakLin = truePeakFromSamples(buf, n);
  return {
    peakLin: peak,
    rmsLin,
    truePeakLin,
    peakDb: linToDb(peak),
    rmsDb: linToDb(rmsLin),
    truePeakDb: linToDb(truePeakLin),
  };
}

/**
 * BS.1770-ish momentary loudness from stereo mean-square.
 * Uses the −0.691 LKFS offset from the recommendation (stereo channel sum).
 */
export function stereoMomentaryLufs(lRmsLin: number, rRmsLin: number): number {
  const meanSq = (lRmsLin * lRmsLin + rRmsLin * rRmsLin) * 0.5;
  if (meanSq <= 1e-20) return Number.NEGATIVE_INFINITY;
  return -0.691 + 10 * Math.log10(meanSq);
}
