import type { MultiMeterSnap, NugenMeterSnap } from '@/app/lib/masteringBay/masteringBayMeterIdle';

const DB_EPS = 0.25;
/** Slightly tighter so idle decay still animates smoothly. */
const PCT_EPS = 0.75;

function dbChanged(a: number, b: number): boolean {
  const aOk = Number.isFinite(a);
  const bOk = Number.isFinite(b);
  if (aOk !== bOk) return true;
  if (!aOk) return false;
  return Math.abs(a - b) > DB_EPS;
}

/** Skip meter bus publishes when nothing moved enough to matter visually. */
export function shouldPublishMeterSnaps(
  prevMulti: MultiMeterSnap | null,
  nextMulti: MultiMeterSnap,
  prevNugen: NugenMeterSnap | null,
  nextNugen: NugenMeterSnap,
): boolean {
  if (!prevMulti || !prevNugen) return true;

  if (
    dbChanged(prevMulti.lPeak, nextMulti.lPeak) ||
    dbChanged(prevMulti.rPeak, nextMulti.rPeak) ||
    dbChanged(prevMulti.lRms, nextMulti.lRms) ||
    dbChanged(prevMulti.rRms, nextMulti.rRms) ||
    Math.abs(prevMulti.balanceDb - nextMulti.balanceDb) > 0.15 ||
    Math.abs(prevMulti.correlation - nextMulti.correlation) > 0.03
  ) {
    return true;
  }

  if (
    Math.abs(prevMulti.lLevel - nextMulti.lLevel) > PCT_EPS ||
    Math.abs(prevMulti.rLevel - nextMulti.rLevel) > PCT_EPS ||
    Math.abs(prevMulti.lRmsLevel - nextMulti.lRmsLevel) > PCT_EPS ||
    Math.abs(prevMulti.rRmsLevel - nextMulti.rRmsLevel) > PCT_EPS
  ) {
    return true;
  }

  for (let i = 0; i < nextMulti.bands.length; i++) {
    if (Math.abs((prevMulti.bands[i] ?? 0) - (nextMulti.bands[i] ?? 0)) > PCT_EPS) return true;
  }

  if (
    Math.abs(prevNugen.l.input - nextNugen.l.input) > PCT_EPS ||
    Math.abs(prevNugen.r.input - nextNugen.r.input) > PCT_EPS ||
    Math.abs(prevNugen.l.output - nextNugen.l.output) > PCT_EPS ||
    Math.abs(prevNugen.r.output - nextNugen.r.output) > PCT_EPS ||
    Math.abs(prevNugen.l.inputPeak - nextNugen.l.inputPeak) > PCT_EPS ||
    Math.abs(prevNugen.r.inputPeak - nextNugen.r.inputPeak) > PCT_EPS ||
    Math.abs(prevNugen.l.outputPeak - nextNugen.l.outputPeak) > PCT_EPS ||
    Math.abs(prevNugen.r.outputPeak - nextNugen.r.outputPeak) > PCT_EPS ||
    Math.abs(prevNugen.l.reduction - nextNugen.l.reduction) > PCT_EPS ||
    Math.abs(prevNugen.r.reduction - nextNugen.r.reduction) > PCT_EPS ||
    dbChanged(prevNugen.source.tpMax, nextNugen.source.tpMax) ||
    dbChanged(prevNugen.target.tpMax, nextNugen.target.tpMax) ||
    dbChanged(prevNugen.source.integrated, nextNugen.source.integrated) ||
    dbChanged(prevNugen.target.integrated, nextNugen.target.integrated) ||
    dbChanged(prevNugen.source.sMax, nextNugen.source.sMax) ||
    dbChanged(prevNugen.target.sMax, nextNugen.target.sMax)
  ) {
    return true;
  }

  return false;
}
