/**
 * Geno Ultra ARP — constrain grid drawing to the active key + scale.
 * Uses chromatic row→semitone mapping (piano-roll lanes), not chord voicing remap.
 */
import type { GenoUltraArpHarmonyContext } from '@/app/lib/studio/genoUltraArpHarmony';
import {
  GENO_ARP_ROWS,
  genoArpRowToPitch,
  genoArpTotalOctShiftForGridCol,
  type GenoArpBarLength,
  type GenoArpBarOctShift,
} from '@/app/lib/studio/genoUltraArpPattern';
import {
  neuralHumScalePitchClasses,
  snapMidiToNeuralHumScale,
  type NeuralHumScaleId,
} from '@/app/lib/vocalLab/neuralHumKeyLock';

export type GenoArpDrawInKeyOpts = {
  basePitch: number;
  globalOctShift: number;
  barOctShifts: readonly GenoArpBarOctShift[];
  barLength: GenoArpBarLength;
  harmony: GenoUltraArpHarmonyContext;
};

/** Chromatic MIDI for a stored grid row (matches vertical piano-roll lanes). */
export function genoArpChromaticMidiForStoredRowAtCol(
  opts: GenoArpDrawInKeyOpts,
  storedRow: number,
  col: number,
): number {
  const totalOct = genoArpTotalOctShiftForGridCol(col, opts.globalOctShift, opts.barOctShifts);
  return genoArpRowToPitch(opts.basePitch, storedRow, totalOct);
}

export function genoArpMidiIsInScale(
  midi: number,
  keyRoot: number,
  scaleId: NeuralHumScaleId,
): boolean {
  const scaleSet = new Set(neuralHumScalePitchClasses(keyRoot, scaleId));
  const pc = ((Math.round(midi) % 12) + 12) % 12;
  return scaleSet.has(pc);
}

export function genoArpStoredRowIsInKey(
  opts: GenoArpDrawInKeyOpts,
  storedRow: number,
  col: number,
): boolean {
  const midi = genoArpChromaticMidiForStoredRowAtCol(opts, storedRow, col);
  return genoArpMidiIsInScale(midi, opts.harmony.keyRoot, opts.harmony.scaleId);
}

/** True when painting may turn this cell on (in-key rows only). */
export function genoArpCanPaintStoredRowInKey(
  opts: GenoArpDrawInKeyOpts,
  storedRow: number,
  col: number,
): boolean {
  return genoArpStoredRowIsInKey(opts, storedRow, col);
}

/** Nearest in-scale stored row at this column — only considers rows already in key. */
export function genoArpSnapStoredRowToKey(
  opts: GenoArpDrawInKeyOpts,
  storedRow: number,
  col: number,
): number | null {
  const midi = genoArpChromaticMidiForStoredRowAtCol(opts, storedRow, col);
  const snappedMidi = snapMidiToNeuralHumScale(midi, opts.harmony.keyRoot, opts.harmony.scaleId);

  let bestRow: number | null = null;
  let bestDist = Infinity;
  let bestRowDist = Infinity;
  for (let r = 0; r < GENO_ARP_ROWS; r += 1) {
    if (!genoArpStoredRowIsInKey(opts, r, col)) continue;
    const candidateMidi = genoArpChromaticMidiForStoredRowAtCol(opts, r, col);
    const dist = Math.abs(candidateMidi - snappedMidi);
    const rowDist = Math.abs(r - storedRow);
    if (dist < bestDist || (dist === bestDist && rowDist < bestRowDist)) {
      bestDist = dist;
      bestRowDist = rowDist;
      bestRow = r;
    }
  }
  return bestRow;
}
