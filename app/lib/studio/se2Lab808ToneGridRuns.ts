/**
 * Consecutive ON steps on one tone-grid lane = one sustained 808 note (held hum / bass).
 */
import {
  SE2_LAB808_TONE_GRID_LANES,
  type Se2Lab808ToneGridPattern,
} from '@/app/lib/studio/se2Lab808DrumPattern';

/** Steps remaining in a run starting at `col` (inclusive), stopping at first OFF or end. */
export function se2Lab808ToneGridRunLengthFrom(
  pattern: Se2Lab808ToneGridPattern,
  lane: number,
  col: number,
  totalSteps: number,
): number {
  if (lane < 0 || lane >= SE2_LAB808_TONE_GRID_LANES) return 0;
  if (col < 0 || col >= totalSteps) return 0;
  if (!pattern[lane]?.[col]) return 0;
  let len = 0;
  for (let c = col; c < totalSteps && pattern[lane]![c]; c += 1) len += 1;
  return len;
}

/** True when this column starts a new held run (previous step off or bar-0). */
export function se2Lab808ToneGridIsRunStart(
  pattern: Se2Lab808ToneGridPattern,
  lane: number,
  col: number,
): boolean {
  if (!pattern[lane]?.[col]) return false;
  if (col <= 0) return true;
  return !pattern[lane]![col - 1];
}

/** Column where the current run began (scan left while ON). */
export function se2Lab808ToneGridRunStartCol(
  pattern: Se2Lab808ToneGridPattern,
  lane: number,
  col: number,
): number {
  if (!pattern[lane]?.[col]) return col;
  let c = col;
  while (c > 0 && pattern[lane]![c - 1]) c -= 1;
  return c;
}
