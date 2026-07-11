import type { MultiMeterSnap, NugenMeterSnap } from '@/app/lib/masteringBay/masteringBayMeterIdle';
import {
  MULTIMETER_BAND_COUNT,
  isMultiMeterSilent,
  isNugenMeterSilent,
} from '@/app/lib/masteringBay/masteringBayMeterIdle';

/** Live feed for rack process displays — levels + real master-bus FFT bands. */
export type ProcessLiveFeed = {
  /** Audio is present on the mastering bus. */
  active: boolean;
  /** Dry input level 0–1. */
  inputLevel: number;
  /** Post-master output level 0–1. */
  level: number;
  /** True-peak hold 0–1. */
  peak: number;
  /** Limiter / compressor gain reduction 0–1. */
  reduction: number;
  /** Master L/R bar levels 0–1 (from multi-meter). */
  lLevel: number;
  rLevel: number;
  /**
   * Real spectrum from the master `AnalyserNode` (0–100% per band).
   * Same bands as the ANALYZER panel — not decorative.
   */
  bands: number[];
};

export function processLiveFromMeters(
  nugen: NugenMeterSnap,
  multi: MultiMeterSnap,
): ProcessLiveFeed {
  const silent = isNugenMeterSilent(nugen) && isMultiMeterSilent(multi);
  return {
    active: !silent,
    inputLevel: Math.max(nugen.l.input, nugen.r.input) / 100,
    level: Math.max(nugen.l.output, nugen.r.output) / 100,
    peak: Math.max(nugen.l.outputPeak, nugen.r.outputPeak) / 100,
    reduction: Math.max(nugen.l.reduction, nugen.r.reduction) / 100,
    lLevel: Math.max(0, Math.min(1, multi.lLevel / 100)),
    rLevel: Math.max(0, Math.min(1, multi.rLevel / 100)),
    bands: multi.bands.length ? [...multi.bands] : Array(MULTIMETER_BAND_COUNT).fill(0),
  };
}

/** @deprecated Prefer {@link processLiveFromMeters} (includes real FFT bands). */
export function processLiveFromNugen(snap: NugenMeterSnap): ProcessLiveFeed {
  return {
    active: !isNugenMeterSilent(snap),
    inputLevel: Math.max(snap.l.input, snap.r.input) / 100,
    level: Math.max(snap.l.output, snap.r.output) / 100,
    peak: Math.max(snap.l.outputPeak, snap.r.outputPeak) / 100,
    reduction: Math.max(snap.l.reduction, snap.r.reduction) / 100,
    lLevel: Math.max(snap.l.output, snap.l.input) / 100,
    rLevel: Math.max(snap.r.output, snap.r.input) / 100,
    bands: Array(MULTIMETER_BAND_COUNT).fill(0),
  };
}

export const IDLE_PROCESS_LIVE: ProcessLiveFeed = {
  active: false,
  inputLevel: 0,
  level: 0,
  peak: 0,
  reduction: 0,
  lLevel: 0,
  rLevel: 0,
  bands: Array(MULTIMETER_BAND_COUNT).fill(0),
};
