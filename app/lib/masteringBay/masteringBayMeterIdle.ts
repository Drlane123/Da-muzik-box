/** Idle meter snapshots — no audio routed until mastering bus is wired. */

import { METER_DB_FLOOR } from '@/app/lib/masteringBay/masteringBayMeterBallistics';

export const MULTIMETER_BAND_COUNT = 63;
export const NUGEN_HISTORY_LENGTH = 64;
export const NUGEN_HISTOGRAM_LENGTH = 12;

/** dB tick marks for vertical VU strips (-60 … +3 dBFS). */
export const VU_METER_DB_TICKS = [3, 0, -6, -12, -18, -24, -30, -36, -42, -48, -54, -60] as const;

/** Gain-reduction column uses a shorter -24 … 0 range. */
export const VU_REDUCTION_DB_TICKS = [0, -3, -6, -9, -12, -15, -18, -21, -24] as const;

/** Horizontal level strip ticks (master range). */
export const HORIZONTAL_METER_DB_TICKS = [-60, -48, -36, -24, -18, -12, -6, 0, 3] as const;

/** LUFS sidebar mini-meter ticks. */
export const LUFS_METER_DB_TICKS = [0, -6, -12, -18, -24] as const;

export type MultiMeterSnap = {
  bands: number[];
  luI: number;
  luS: number;
  lPeak: number;
  lRms: number;
  rPeak: number;
  rRms: number;
  lPeakHold: number;
  rPeakHold: number;
  lLevel: number;
  rLevel: number;
  lRmsLevel: number;
  rRmsLevel: number;
  correlation: number;
  /** Stereo balance in dB — negative = left, positive = right. */
  balanceDb: number;
};

export type ChannelMeters = {
  input: number;
  inputPeak: number;
  reduction: number;
  output: number;
  outputPeak: number;
};

export type NugenMeterSnap = {
  l: ChannelMeters;
  r: ChannelMeters;
  source: { tpMax: number; integrated: number; sMax: number };
  target: { tpMax: number; integrated: number; sMax: number };
  /** Short-term loudness history (0–100% for VisLM graph). */
  history: number[];
  /** True-peak history (0–100% for VisLM True-Peak graph). */
  tpHistory: number[];
  histogram: number[];
};

const zeroChannel: ChannelMeters = {
  input: 0,
  inputPeak: 0,
  reduction: 0,
  output: 0,
  outputPeak: 0,
};

export function idleMultiMeterSnap(): MultiMeterSnap {
  return {
    bands: Array(MULTIMETER_BAND_COUNT).fill(0),
    luI: Number.NEGATIVE_INFINITY,
    luS: Number.NEGATIVE_INFINITY,
    lPeak: Number.NEGATIVE_INFINITY,
    lRms: Number.NEGATIVE_INFINITY,
    rPeak: Number.NEGATIVE_INFINITY,
    rRms: Number.NEGATIVE_INFINITY,
    lPeakHold: Number.NEGATIVE_INFINITY,
    rPeakHold: Number.NEGATIVE_INFINITY,
    lLevel: 0,
    rLevel: 0,
    lRmsLevel: 0,
    rRmsLevel: 0,
    correlation: 0,
    balanceDb: 0,
  };
}

export function idleNugenMeterSnap(): NugenMeterSnap {
  return {
    l: { ...zeroChannel },
    r: { ...zeroChannel },
    source: {
      tpMax: Number.NEGATIVE_INFINITY,
      integrated: Number.NEGATIVE_INFINITY,
      sMax: Number.NEGATIVE_INFINITY,
    },
    target: {
      tpMax: Number.NEGATIVE_INFINITY,
      integrated: Number.NEGATIVE_INFINITY,
      sMax: Number.NEGATIVE_INFINITY,
    },
    history: Array(NUGEN_HISTORY_LENGTH).fill(0),
    tpHistory: Array(NUGEN_HISTORY_LENGTH).fill(0),
    histogram: Array(NUGEN_HISTOGRAM_LENGTH).fill(0),
  };
}

export function formatMeterDb(value: number): string {
  return Number.isFinite(value) ? value.toFixed(1) : '—';
}

export function isMultiMeterSilent(m: MultiMeterSnap): boolean {
  const floor = METER_DB_FLOOR + 3;
  const lHot = Number.isFinite(m.lPeak) && m.lPeak > floor;
  const rHot = Number.isFinite(m.rPeak) && m.rPeak > floor;
  const rmsHot =
    (Number.isFinite(m.lRms) && m.lRms > floor) || (Number.isFinite(m.rRms) && m.rRms > floor);
  const bandHot = m.bands.some((b) => b > 1);
  return !lHot && !rHot && !rmsHot && !bandHot;
}

export function isNugenMeterSilent(m: NugenMeterSnap): boolean {
  const floor = METER_DB_FLOOR + 3;
  const srcHot = Number.isFinite(m.source.tpMax) && m.source.tpMax > floor;
  const outHot =
    (Number.isFinite(m.target.tpMax) && m.target.tpMax > floor) ||
    m.l.output > 0.5 ||
    m.r.output > 0.5;
  return !srcHot && !outHot;
}

/** Map LUFS-style dB (-24 … 0) to 0–100% for the mini loudness strip. */
export function lufsToMeterPct(lufsDb: number, floorDb = -24): number {
  if (!Number.isFinite(lufsDb)) return 0;
  return Math.max(0, Math.min(100, ((lufsDb - floorDb) / -floorDb) * 100));
}
