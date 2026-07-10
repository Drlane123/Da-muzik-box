/**
 * SE2 808 Lab — tone step grid (16th steps per bar, 16 chromatic tone lanes = tone pads).
 */
import { LAB808_TONE_PAD_COUNT, lab808TonePadMidi } from '@/app/lib/creationStation/lab808TonePads';

export const SE2_LAB808_TONE_GRID_STEPS_PER_BAR = 16;
export const SE2_LAB808_TONE_GRID_LANES = LAB808_TONE_PAD_COUNT;

export const SE2_LAB808_TONE_GRID_LOOP_BARS_OPTIONS = [4, 8, 16] as const;
export type Se2Lab808ToneGridLoopBars = (typeof SE2_LAB808_TONE_GRID_LOOP_BARS_OPTIONS)[number];
export const SE2_LAB808_TONE_GRID_DEFAULT_LOOP_BARS: Se2Lab808ToneGridLoopBars = 8;

/** @deprecated Alias — same 16 tone lanes as tone pads. */
export const SE2_LAB808_DRUM_STEPS_PER_BAR = SE2_LAB808_TONE_GRID_STEPS_PER_BAR;
/** @deprecated Alias */
export const SE2_LAB808_DRUM_LANES = SE2_LAB808_TONE_GRID_LANES;

export type Se2Lab808ToneGridPattern = boolean[][];
/** @deprecated */
export type Se2Lab808DrumPattern = Se2Lab808ToneGridPattern;

export function se2Lab808NormalizeToneGridLoopBars(raw: unknown): Se2Lab808ToneGridLoopBars {
  const n = typeof raw === 'number' && Number.isFinite(raw) ? Math.round(raw) : 0;
  if (n === 4) return 4;
  if (n === 16) return 16;
  if (n === 12) return 8;
  return 8;
}

export function se2Lab808ToneGridStepCount(loopBars: number): number {
  const bars = se2Lab808NormalizeToneGridLoopBars(loopBars);
  return bars * SE2_LAB808_TONE_GRID_STEPS_PER_BAR;
}

/** One 16th-note column duration (tone grid is 16 steps per bar). */
export function se2Lab808ToneGridStepDurationSec(bpm: number): number {
  return (60 / Math.max(1, bpm)) / 4;
}

export function se2Lab808ToneMidiForLane(tonePadBaseMidi: number, lane: number): number {
  return lab808TonePadMidi(tonePadBaseMidi, lane);
}

export function emptySe2Lab808ToneGridPattern(
  loopBars: Se2Lab808ToneGridLoopBars = SE2_LAB808_TONE_GRID_DEFAULT_LOOP_BARS,
): Se2Lab808ToneGridPattern {
  const stepCount = se2Lab808ToneGridStepCount(loopBars);
  return Array.from({ length: SE2_LAB808_TONE_GRID_LANES }, () => Array<boolean>(stepCount).fill(false));
}

/** @deprecated */
export const emptySe2Lab808DrumPattern = emptySe2Lab808ToneGridPattern;

export function normalizeSe2Lab808ToneGridPattern(
  raw: readonly (readonly boolean[])[] | undefined,
  loopBars: Se2Lab808ToneGridLoopBars = SE2_LAB808_TONE_GRID_DEFAULT_LOOP_BARS,
): Se2Lab808ToneGridPattern {
  const bars = se2Lab808NormalizeToneGridLoopBars(loopBars);
  const stepCount = se2Lab808ToneGridStepCount(bars);
  const base = Array.from({ length: SE2_LAB808_TONE_GRID_LANES }, () =>
    Array<boolean>(stepCount).fill(false),
  );
  if (!raw?.length) return base;
  for (let lane = 0; lane < SE2_LAB808_TONE_GRID_LANES; lane += 1) {
    const row = raw[lane];
    if (!row?.length) continue;
    const copyLen = Math.min(stepCount, row.length);
    for (let col = 0; col < copyLen; col += 1) {
      base[lane]![col] = Boolean(row[col]);
    }
  }
  return base;
}

/** @deprecated */
export const normalizeSe2Lab808DrumPattern = normalizeSe2Lab808ToneGridPattern;

export function resizeSe2Lab808ToneGridPattern(
  pattern: Se2Lab808ToneGridPattern,
  fromLoopBars: Se2Lab808ToneGridLoopBars,
  toLoopBars: Se2Lab808ToneGridLoopBars,
): Se2Lab808ToneGridPattern {
  if (fromLoopBars === toLoopBars) return pattern;
  const fromSteps = se2Lab808ToneGridStepCount(fromLoopBars);
  const toSteps = se2Lab808ToneGridStepCount(toLoopBars);
  const next = emptySe2Lab808ToneGridPattern(toLoopBars);
  for (let lane = 0; lane < SE2_LAB808_TONE_GRID_LANES; lane += 1) {
    const row = pattern[lane] ?? [];
    const copyLen = Math.min(fromSteps, toSteps, row.length);
    for (let col = 0; col < copyLen; col += 1) {
      next[lane]![col] = Boolean(row[col]);
    }
  }
  return next;
}

export function se2Lab808ToneGridHasHits(pattern: Se2Lab808ToneGridPattern): boolean {
  return pattern.some((row) => row.some(Boolean));
}

/** @deprecated */
export const se2Lab808DrumPatternHasHits = se2Lab808ToneGridHasHits;

export function se2Lab808ToneGridToggleStep(
  pattern: Se2Lab808ToneGridPattern,
  lane: number,
  col: number,
  loopBars: Se2Lab808ToneGridLoopBars = SE2_LAB808_TONE_GRID_DEFAULT_LOOP_BARS,
): Se2Lab808ToneGridPattern {
  const stepCount = se2Lab808ToneGridStepCount(loopBars);
  const next = pattern.map((row) => {
    if (row.length === stepCount) return [...row];
    return normalizeSe2Lab808ToneGridPattern([row], loopBars)[0]!;
  });
  const li = Math.max(0, Math.min(SE2_LAB808_TONE_GRID_LANES - 1, lane));
  const ci = Math.max(0, Math.min(stepCount - 1, col));
  next[li]![ci] = !next[li]![ci];
  return next;
}

/** @deprecated */
export const se2Lab808DrumToggleStep = se2Lab808ToneGridToggleStep;

/** Move or swap a single step hit (select tool). */
export function moveSe2Lab808ToneGridStep(
  pattern: Se2Lab808ToneGridPattern,
  fromLane: number,
  fromCol: number,
  toLane: number,
  toCol: number,
  loopBars: Se2Lab808ToneGridLoopBars = SE2_LAB808_TONE_GRID_DEFAULT_LOOP_BARS,
): Se2Lab808ToneGridPattern {
  if (fromLane === toLane && fromCol === toCol) return pattern;
  const stepCount = se2Lab808ToneGridStepCount(loopBars);
  const next = normalizeSe2Lab808ToneGridPattern(pattern, loopBars);
  const fl = Math.max(0, Math.min(SE2_LAB808_TONE_GRID_LANES - 1, fromLane));
  const fc = Math.max(0, Math.min(stepCount - 1, fromCol));
  const tl = Math.max(0, Math.min(SE2_LAB808_TONE_GRID_LANES - 1, toLane));
  const tc = Math.max(0, Math.min(stepCount - 1, toCol));
  if (!next[fl]![fc]) return pattern;
  const dst = next[tl]![tc];
  next[fl]![fc] = dst;
  next[tl]![tc] = true;
  return next;
}
