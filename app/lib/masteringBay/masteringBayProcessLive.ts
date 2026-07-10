import type { NugenMeterSnap } from '@/app/lib/masteringBay/masteringBayMeterIdle';
import { isNugenMeterSilent } from '@/app/lib/masteringBay/masteringBayMeterIdle';

/** Live feed for rack process displays — derived from LM-CORRECT / ISL meters. */
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
};

export function processLiveFromNugen(snap: NugenMeterSnap): ProcessLiveFeed {
  const silent = isNugenMeterSilent(snap);
  return {
    active: !silent,
    inputLevel: Math.max(snap.l.input, snap.r.input) / 100,
    level: Math.max(snap.l.output, snap.r.output) / 100,
    peak: Math.max(snap.l.outputPeak, snap.r.outputPeak) / 100,
    reduction: Math.max(snap.l.reduction, snap.r.reduction) / 100,
  };
}

export const IDLE_PROCESS_LIVE: ProcessLiveFeed = {
  active: false,
  inputLevel: 0,
  level: 0,
  peak: 0,
  reduction: 0,
};
