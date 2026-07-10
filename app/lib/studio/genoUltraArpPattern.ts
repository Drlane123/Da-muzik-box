/** ANA 2 — 11-slot polyphonic step arp pattern helpers (UI + preview). */

export const GENO_ARP_ROWS = 11;
/** Sixteenth-note steps per bar in 4/4 at 1/16 rate (baseline grid). */
export const GENO_ARP_STEPS_PER_BAR = 16;
/** Legacy alias — one bar at 1/16. */
export const GENO_ARP_COLS = GENO_ARP_STEPS_PER_BAR;
/** Max columns: 8 bars × 16 steps @ 1/16 (128). Finer rates share the same bar window. */
export const GENO_ARP_MAX_COLS = 128;
/** Max bars in pattern + per-bar octave lane. */
export const GENO_ARP_MAX_BARS = 8;

/** Fixed piano-roll cell size (matches Beat Lab roll row height + step column width). */
export const GENO_ARP_CELL_ROW_H_PX = 17;
export const GENO_ARP_CELL_COL_W_PX = 14;

export type GenoArpBarOctShift = -2 | -1 | 0 | 1 | 2;

/** Global OCT lane shift for whole arp pattern (±2 octaves). */
export type GenoArpGlobalOctShift = GenoArpBarOctShift;

export const GENO_ARP_BAR_OCT_VALUES: readonly GenoArpBarOctShift[] = [-2, -1, 0, 1, 2];

export function genoArpSanitizeBarOctShift(n: number): GenoArpBarOctShift {
  if (n >= 2) return 2;
  if (n <= -2) return -2;
  if (n === 1 || n === -1) return n;
  return 0;
}

export type GenoArpBarLength = 1 | 2 | 4 | 8;
export const GENO_ARP_BAR_LENGTHS: readonly GenoArpBarLength[] = [1, 2, 4, 8];

export type GenoArpOrder = 'UP' | 'DOWN' | 'UP/DN' | 'DN/UP' | 'OUT-IN' | 'RAND';

/** Logic-style variation index (0 = V1 … 3 = V4). */
export type GenoArpVariation = 0 | 1 | 2 | 3;

/** Logic Oct Range — spread chord tones across 1–4 octaves. */
export type GenoArpOctRange = 1 | 2 | 3 | 4;

export const GENO_ARP_VARIATIONS: readonly GenoArpVariation[] = [0, 1, 2, 3];
export const GENO_ARP_OCT_RANGES: readonly GenoArpOctRange[] = [1, 2, 3, 4];

export function genoArpSanitizeVariation(n: number): GenoArpVariation {
  const v = Math.round(n);
  if (v <= 0) return 0;
  if (v >= 3) return 3;
  return v as GenoArpVariation;
}

export function genoArpSanitizeOctRange(n: number): GenoArpOctRange {
  const v = Math.round(n);
  if (v <= 1) return 1;
  if (v >= 4) return 4;
  return v as GenoArpOctRange;
}

/** Preset / order modes cycle this many rows (legacy 6-row literature). */
export const GENO_ARP_ACTIVE_ROW_SPAN = 6;

/** Dead-center row index (N6 on an 11-row grid — row 0 = bottom). */
export const GENO_ARP_MIDDLE_ROW = Math.floor((GENO_ARP_ROWS - 1) / 2);

/** Offset so legacy row 0…5 land on rows 3…8 (middle preset row = GENO_ARP_MIDDLE_ROW). */
export const GENO_ARP_PRESET_ROW_OFFSET =
  GENO_ARP_MIDDLE_ROW - Math.floor((GENO_ARP_ACTIVE_ROW_SPAN - 1) / 2);

/** Map a relative row (0 … span−1) into the centered band on the 11-row grid. */
export function genoArpCenterPresetRow(relativeRow: number): number {
  return Math.max(
    0,
    Math.min(GENO_ARP_ROWS - 1, Math.round(relativeRow) + GENO_ARP_PRESET_ROW_OFFSET),
  );
}

/** Rows below / above the preset band — exactly ±12 semitones (one octave). */
export function genoArpRowZoneOctOffset(row: number): -12 | 0 | 12 {
  const bandLo = GENO_ARP_PRESET_ROW_OFFSET;
  const bandHi = bandLo + GENO_ARP_ACTIVE_ROW_SPAN - 1;
  if (row < bandLo) return -12;
  if (row > bandHi) return 12;
  return 0;
}

/** Map any grid row to 0…span−1 for chord-tone lookup (clamped to preset band). */
export function genoArpRowBandRelative(row: number): number {
  const bandLo = GENO_ARP_PRESET_ROW_OFFSET;
  const bandHi = bandLo + GENO_ARP_ACTIVE_ROW_SPAN - 1;
  const r = Math.max(0, Math.min(GENO_ARP_ROWS - 1, row));
  if (r < bandLo) return 0;
  if (r > bandHi) return GENO_ARP_ACTIVE_ROW_SPAN - 1;
  return r - bandLo;
}

/**
 * Semitone offsets per row — centered on GENO_ARP_MIDDLE_ROW (±12 semis at grid edges).
 * Row 5 = 0 (root); row 0 = −12; row 10 = +12.
 */
export const GENO_ARP_ROW_SEMIS: readonly number[] = Object.freeze(
  Array.from({ length: GENO_ARP_ROWS }, (_, r) =>
    Math.round(((r - GENO_ARP_MIDDLE_ROW) / Math.max(1, GENO_ARP_MIDDLE_ROW)) * 12),
  ),
);

const PING_PONG_REL = [0, 1, 2, 3, 4, 5, 5, 4, 3, 2, 1] as const;
/** Down-then-up — mirror of UP/DN (starts high, dips, returns). */
const PONG_PING_REL = [5, 4, 3, 2, 1, 0, 0, 1, 2, 3, 4] as const;

function outsideInOrder(span: number): number[] {
  const order: number[] = [];
  let lo = 0;
  let hi = span - 1;
  while (lo <= hi) {
    if (lo === hi) {
      order.push(lo);
      break;
    }
    order.push(hi);
    order.push(lo);
    lo += 1;
    hi -= 1;
  }
  return order;
}

function seededRelativeRow(step: number, seed: number): number {
  const x = Math.sin(step * 12.9898 + seed * 78.233) * 43758.5453;
  return Math.floor((x - Math.floor(x)) * GENO_ARP_ACTIVE_ROW_SPAN);
}

export function genoArpSanitizeBarLength(n: number): GenoArpBarLength {
  if (n >= 8) return 8;
  if (n >= 4) return 4;
  if (n >= 2) return 2;
  return 1;
}

/** Step columns per bar at the current rate (1/16 baseline × rate mult). */
export function genoArpColsPerBar(rateIdx: number): number {
  const mult = 2 ** (1 - rateIdx);
  return Math.max(2, Math.round(GENO_ARP_STEPS_PER_BAR * mult));
}

/** Fixed UI grid width — always 16 steps per bar regardless of rate. */
export function genoArpGridCols(barLength: number): number {
  const bars = genoArpSanitizeBarLength(barLength);
  return bars * GENO_ARP_STEPS_PER_BAR;
}

/** Playback step count — rate changes note division, not grid column count. */
export function genoArpPlaybackCols(barLength: number, rateIdx: number): number {
  const bars = genoArpSanitizeBarLength(barLength);
  const perBar = genoArpColsPerBar(rateIdx);
  return Math.max(2, Math.min(GENO_ARP_MAX_COLS, bars * perBar));
}

/** @deprecated Use genoArpGridCols for UI; genoArpPlaybackCols for scheduler. */
export function genoArpDisplayCols(barLength: number, rateIdx?: number): number {
  if (rateIdx != null) return genoArpPlaybackCols(barLength, rateIdx);
  return genoArpGridCols(barLength);
}

/** Step index within a bar (0–15) from a grid column. */
export function genoArpStepInBar(gridCol: number): number {
  return ((gridCol % GENO_ARP_STEPS_PER_BAR) + GENO_ARP_STEPS_PER_BAR) % GENO_ARP_STEPS_PER_BAR;
}

/** Arp row for one grid column — order restarts at the start of every bar. */
export function genoArpOrderRowForGridCol(
  gridCol: number,
  order: GenoArpOrder,
  seed = 0,
  variation: GenoArpVariation = 0,
): number {
  const barIdx = genoArpGridColToBarIndex(gridCol);
  const stepInBar = genoArpStepInBar(gridCol);
  const barSeed = order === 'RAND' ? seed + barIdx * 9973 : seed;
  return genoArpOrderRow(stepInBar, order, barSeed, variation);
}

export function genoArpPlaybackStepToGridCol(
  playbackStep: number,
  barLength: number,
  rateIdx: number,
): number {
  const bars = genoArpSanitizeBarLength(barLength);
  const colsPerBarPlayback = genoArpColsPerBar(rateIdx);
  if (colsPerBarPlayback <= 0) return 0;
  const barIdx = Math.max(0, Math.min(bars - 1, Math.floor(playbackStep / colsPerBarPlayback)));
  const stepInBar = playbackStep % colsPerBarPlayback;
  const barStartGrid = barIdx * GENO_ARP_STEPS_PER_BAR;
  const colInBar = Math.min(
    GENO_ARP_STEPS_PER_BAR - 1,
    Math.floor((stepInBar * GENO_ARP_STEPS_PER_BAR) / colsPerBarPlayback),
  );
  return barStartGrid + colInBar;
}

export function genoArpGridColToBarIndex(col: number): number {
  return Math.max(0, Math.min(GENO_ARP_MAX_BARS - 1, Math.floor(col / GENO_ARP_STEPS_PER_BAR)));
}

/** Visual row after per-bar octave shift — one grid row per octave (not semitone snap). */
export function genoArpDisplayRowForBarOct(storedRow: number, barOct: number): number {
  return Math.max(0, Math.min(GENO_ARP_ROWS - 1, storedRow + barOct));
}

/** Inverse of display row — map clicked cell back to stored pattern row. */
export function genoArpStoredRowForBarOct(displayRow: number, barOct: number): number {
  return Math.max(0, Math.min(GENO_ARP_ROWS - 1, displayRow - barOct));
}

function emptyArpGrid(): boolean[][] {
  return Array.from({ length: GENO_ARP_ROWS }, () => Array(GENO_ARP_MAX_COLS).fill(false));
}

/** Reflow pattern when rate/bar length change so notes stay inside grid blocks (piano-roll style). */
export function resampleGenoArpGrid(grid: boolean[][], fromCols: number, toCols: number): boolean[][] {
  const next = emptyArpGrid();
  if (fromCols <= 0 || toCols <= 0) return next;

  for (let r = 0; r < GENO_ARP_ROWS; r += 1) {
    for (let tc = 0; tc < toCols; tc += 1) {
      const srcStart = (tc / toCols) * fromCols;
      const srcEnd = ((tc + 1) / toCols) * fromCols;
      let on = false;
      for (let sc = Math.floor(srcStart); sc < Math.ceil(srcEnd) && sc < fromCols; sc += 1) {
        if (grid[r]?.[sc]) {
          on = true;
          break;
        }
      }
      next[r]![tc] = on;
    }
  }
  return next;
}

/** Keep existing bar columns note-for-note when bar length changes (1→2 bar keeps bar 1). */
export function resizeGenoArpGridByBars(grid: boolean[][], fromCols: number, toCols: number): boolean[][] {
  const next = emptyArpGrid();
  if (fromCols <= 0 || toCols <= 0) return next;
  const copyCols = Math.min(fromCols, toCols);
  for (let r = 0; r < GENO_ARP_ROWS; r += 1) {
    for (let c = 0; c < copyCols; c += 1) {
      next[r]![c] = !!grid[r]?.[c];
    }
  }
  return next;
}

/** Row index for a step column based on ANA note-order modes (centered band). */
export function genoArpOrderRow(
  step: number,
  order: GenoArpOrder,
  seed = 0,
  variation: GenoArpVariation = 0,
): number {
  const span = GENO_ARP_ACTIVE_ROW_SPAN;
  const phased = step + variation;
  let relative = 0;
  switch (order) {
    case 'UP':
      relative = phased % span;
      break;
    case 'DOWN':
      relative = span - 1 - (phased % span);
      break;
    case 'UP/DN':
      relative = PING_PONG_REL[phased % PING_PONG_REL.length]!;
      break;
    case 'DN/UP':
      relative = PONG_PING_REL[phased % PONG_PING_REL.length]!;
      break;
    case 'OUT-IN': {
      const cycle = outsideInOrder(span);
      relative = cycle[phased % cycle.length] ?? 0;
      break;
    }
    case 'RAND':
      relative = seededRelativeRow(phased, seed + variation * 131);
      break;
    default:
      relative = phased % span;
  }
  return genoArpCenterPresetRow(relative);
}

/** Pad legacy grids when row count increases. */
export function padGenoArpGridRows(grid: boolean[][], targetRows = GENO_ARP_ROWS): boolean[][] {
  if (grid.length >= targetRows) return grid;
  const cols = grid[0]?.length ?? GENO_ARP_MAX_COLS;
  const next = grid.map((r) => [...r]);
  while (next.length < targetRows) {
    next.push(Array(cols).fill(false));
  }
  return next;
}

/** Build a fresh 11×N grid from arp settings (ANA auto-pattern when not locked). */
export function buildGenoArpGridPattern(opts: {
  barLength: number;
  order: GenoArpOrder;
  octShift: GenoArpGlobalOctShift;
  rateIdx?: number;
  randSeed?: number;
  variation?: GenoArpVariation;
}): boolean[][] {
  const cols = genoArpGridCols(opts.barLength);
  const g = emptyArpGrid();
  const variation = opts.variation ?? 0;
  const seed =
    opts.order === 'RAND'
      ? (opts.randSeed ?? Math.floor(Math.random() * 99999))
      : 0;

  for (let col = 0; col < cols; col += 1) {
    const row = Math.max(
      0,
      Math.min(GENO_ARP_ROWS - 1, genoArpOrderRowForGridCol(col, opts.order, seed, variation)),
    );
    g[row]![col] = true;
  }
  return g;
}

export function genoArpActiveRowsAtStep(grid: boolean[][], step: number): number[] {
  const rows: number[] = [];
  for (let r = 0; r < GENO_ARP_ROWS; r += 1) {
    if (grid[r]?.[step]) rows.push(r);
  }
  return rows;
}

export function genoArpRowToPitch(basePitch: number, row: number, octShift: number): number {
  const semi = GENO_ARP_ROW_SEMIS[row] ?? 0;
  return Math.max(0, Math.min(127, Math.round(basePitch + semi + octShift * 12)));
}

export function emptyGenoArpBarOctShifts(): GenoArpBarOctShift[] {
  return Array(GENO_ARP_MAX_BARS).fill(0) as GenoArpBarOctShift[];
}

export function genoArpBarIndexForStep(step: number, colsPerBar: number): number {
  if (colsPerBar <= 0) return 0;
  return Math.max(0, Math.min(GENO_ARP_MAX_BARS - 1, Math.floor(step / colsPerBar)));
}

/** Global OCT + per-bar offset from grid column (bar boundary aligned). */
export function genoArpTotalOctShiftForGridCol(
  gridCol: number,
  globalOct: number,
  barOctShifts: readonly number[],
): number {
  const barIdx = genoArpGridColToBarIndex(gridCol);
  const barOct = barOctShifts[barIdx] ?? 0;
  return globalOct + barOct;
}

/** Global OCT + per-bar offset for arpeggiator playback. */
export function genoArpTotalOctShiftForStep(
  step: number,
  colsPerBar: number,
  globalOct: number,
  barOctShifts: readonly number[],
): number {
  const barIdx = genoArpBarIndexForStep(step, colsPerBar);
  const barOct = barOctShifts[barIdx] ?? 0;
  return globalOct + barOct;
}

export function genoArpGridPixelSize(cols: number, rows: number = GENO_ARP_ROWS): {
  width: number;
  height: number;
} {
  return {
    width: cols * GENO_ARP_CELL_COL_W_PX,
    height: rows * GENO_ARP_CELL_ROW_H_PX,
  };
}

export const GENO_ARP_RATE_LABELS = ['1/32', '1/16', '1/8', '1/4', '1/2'] as const;
export const GENO_ARP_RATE_BEATS = [0.125, 0.25, 0.5, 1, 2] as const;
export const GENO_ARP_ORDERS: GenoArpOrder[] = ['UP', 'DOWN', 'UP/DN', 'DN/UP', 'OUT-IN', 'RAND'];

export function genoArpStepMs(bpm: number, rateIdx: number): number {
  const beatMs = 60000 / Math.max(40, bpm);
  return beatMs * (GENO_ARP_RATE_BEATS[rateIdx] ?? 0.25);
}

/** Swing pushes every 2nd step later (ANA 50–72% style; we map 0–0.5 knob → 0–22% delay). */
export function genoArpSwingDelayMs(stepMs: number, swing: number, stepIndex: number): number {
  if (stepIndex % 2 !== 1) return 0;
  return stepMs * swing * 0.44;
}

/**
 * Gate knob (0–1) → note hold within one step.
 * Honest mapping: gate 1.0 fills most of the step (tiny gap so mono can re-trigger cleanly).
 * Older code used `* 0.82` and a hard `0.72` cap — that silenced ~30% of every step.
 */
export function genoArpGateSecForStep(stepDurSec: number, gateKnob: number): number {
  const g = Math.max(0.05, Math.min(1, gateKnob));
  const maxFill = 0.94;
  return Math.max(0.012, stepDurSec * g * maxFill);
}

/** Per-step sub-lane level 0–1 (MOD / VEL rows map to 6 slots). */
export function emptyGenoArpLaneLevels(defaultLevel = 0): number[] {
  return Array(GENO_ARP_MAX_COLS).fill(defaultLevel);
}

/** Retrologue-style step enable mask — lit dots fire, dark dots rest. */
export function emptyGenoArpStepMask(enabled = true): boolean[] {
  return Array(GENO_ARP_MAX_COLS).fill(enabled);
}

/**
 * Per-step hit count (ratchet) — how many times the note fires inside one step.
 * Retrologue-style “pick how many times”: 0 = off, 1–4 = repeats.
 */
export type GenoArpStepHits = 0 | 1 | 2 | 3 | 4;

export function emptyGenoArpStepHits(hits: GenoArpStepHits = 1): GenoArpStepHits[] {
  return Array(GENO_ARP_MAX_COLS).fill(hits) as GenoArpStepHits[];
}

/**
 * Blank step-sequencer state (Retrologue init) — user programs STEP / HITS / VEL / CTRL.
 * Mask all-off and hits all-0 mean “no programming yet” (playback treats as all steps ×1).
 */
export type GenoArpBlankStepSequencer = {
  stepMask: boolean[];
  stepHits: GenoArpStepHits[];
  velLevels: number[];
  mod1Levels: number[];
  mod2Levels: number[];
  mod3Levels: number[];
  ctrl1On: boolean;
  ctrl2On: boolean;
  ctrl3On: boolean;
  ctrl1Depth: number;
  ctrl2Depth: number;
  ctrl3Depth: number;
  ctrl1Dest: 'filterCutoff';
  ctrl2Dest: 'filterRes';
  ctrl3Dest: 'ampLevel';
  phraseSteps: number;
};

export function blankGenoArpStepSequencer(phraseSteps = 16): GenoArpBlankStepSequencer {
  return {
    stepMask: emptyGenoArpStepMask(false),
    stepHits: emptyGenoArpStepHits(0),
    velLevels: emptyGenoArpLaneLevels(0),
    mod1Levels: emptyGenoArpLaneLevels(0),
    mod2Levels: emptyGenoArpLaneLevels(0),
    mod3Levels: emptyGenoArpLaneLevels(0),
    ctrl1On: false,
    ctrl2On: false,
    ctrl3On: false,
    ctrl1Depth: 0.5,
    ctrl2Depth: 0.5,
    ctrl3Depth: 0.5,
    ctrl1Dest: 'filterCutoff',
    ctrl2Dest: 'filterRes',
    ctrl3Dest: 'ampLevel',
    phraseSteps: genoArpSanitizePhraseSteps(phraseSteps, GENO_ARP_MAX_COLS),
  };
}

/** True when no STEP pads have been armed (factory blank). */
export function genoArpStepMaskIsBlank(mask: readonly boolean[]): boolean {
  return mask.every((on) => !on);
}

/** True when no HITS have been programmed (factory blank). */
export function genoArpStepHitsIsBlank(hits: readonly number[]): boolean {
  return hits.every((h) => !h || h <= 0);
}

export function genoArpSanitizeStepHits(n: number): GenoArpStepHits {
  const v = Math.round(n);
  if (v <= 0) return 0;
  if (v >= 4) return 4;
  return v as GenoArpStepHits;
}

export function genoArpCycleStepHits(current: number): GenoArpStepHits {
  const c = genoArpSanitizeStepHits(current);
  if (c >= 4) return 0;
  return (c + 1) as GenoArpStepHits;
}

/** Phrase length in steps (how many dots are in the loop). */
export function genoArpSanitizePhraseSteps(n: number, maxCols: number): number {
  const m = Math.max(1, Math.min(GENO_ARP_MAX_COLS, maxCols));
  return Math.max(1, Math.min(m, Math.round(n)));
}

/** Common phrase lengths for the step-operator strip. */
export const GENO_ARP_PHRASE_STEP_PRESETS = [4, 8, 12, 16] as const;

export function genoArpLaneRowForLevel(level: number): number {
  const clamped = Math.max(0, Math.min(1, level));
  if (clamped <= 0.001) return -1;
  return Math.max(0, Math.min(GENO_ARP_ROWS - 1, Math.round(clamped * (GENO_ARP_ROWS - 1))));
}

export function genoArpLevelFromRow(row: number): number {
  const r = Math.max(0, Math.min(GENO_ARP_ROWS - 1, row));
  if (GENO_ARP_ROWS <= 1) return 0;
  return r / (GENO_ARP_ROWS - 1);
}

export function resampleGenoArpLaneLevels(levels: number[], fromCols: number, toCols: number): number[] {
  const next = emptyGenoArpLaneLevels();
  if (fromCols <= 0 || toCols <= 0) return next;
  for (let tc = 0; tc < toCols; tc += 1) {
    const srcIdx = Math.min(fromCols - 1, Math.floor((tc / toCols) * fromCols));
    next[tc] = levels[srcIdx] ?? 0;
  }
  return next;
}

/** Copy lane columns verbatim when bar length changes — new bars start blank/default. */
export function resizeGenoArpLaneLevelsByBars(levels: number[], fromCols: number, toCols: number): number[] {
  const next = emptyGenoArpLaneLevels();
  if (fromCols <= 0 || toCols <= 0) return next;
  const copyCols = Math.min(fromCols, toCols);
  for (let c = 0; c < copyCols; c += 1) {
    next[c] = levels[c] ?? 0;
  }
  return next;
}

/** Blank VEL (0) = default velocity 100 — user draws bars to customize. */
export function genoArpLaneLevelToVelocity(level: number): number {
  if (level <= 0.001) return 100;
  return Math.max(1, Math.min(127, Math.round(24 + level * 103)));
}

export type GenoArpGridCellKey = `${number},${number}`;

export function genoArpGridCellKey(row: number, col: number): GenoArpGridCellKey {
  return `${row},${col}`;
}

/**
 * Copy notes from `sourceBar` into the next bar, clearing the destination bar first.
 * When `selectedCells` is set, only those stored-row/column keys are copied (same in-bar offsets).
 */
export function duplicateGenoArpSelectionToNextBar(
  grid: boolean[][],
  opts: {
    sourceBar: number;
    selectedCells?: ReadonlySet<GenoArpGridCellKey>;
    stepsPerBar?: number;
  },
): boolean[][] | null {
  const stepsPerBar = opts.stepsPerBar ?? GENO_ARP_STEPS_PER_BAR;
  const destBar = opts.sourceBar + 1;
  const cols = grid[0]?.length ?? 0;
  const totalBars = Math.floor(cols / stepsPerBar);
  if (opts.sourceBar < 0 || destBar >= totalBars) return null;

  const next = grid.map((row) => [...row]);
  const srcStart = opts.sourceBar * stepsPerBar;
  const dstStart = destBar * stepsPerBar;

  for (let c = dstStart; c < dstStart + stepsPerBar; c += 1) {
    for (let r = 0; r < GENO_ARP_ROWS; r += 1) {
      next[r]![c] = false;
    }
  }

  const placeNote = (row: number, srcCol: number) => {
    const inBar = ((srcCol % stepsPerBar) + stepsPerBar) % stepsPerBar;
    const destCol = dstStart + inBar;
    if (destCol < 0 || destCol >= cols) return;
    for (let r = 0; r < GENO_ARP_ROWS; r += 1) {
      next[r]![destCol] = false;
    }
    next[row]![destCol] = true;
  };

  if (opts.selectedCells && opts.selectedCells.size > 0) {
    for (const key of opts.selectedCells) {
      const comma = key.indexOf(',');
      if (comma < 0) continue;
      const row = Number(key.slice(0, comma));
      const col = Number(key.slice(comma + 1));
      if (!Number.isFinite(row) || !Number.isFinite(col)) continue;
      if (genoArpGridColToBarIndex(col) !== opts.sourceBar) continue;
      if (!grid[row]?.[col]) continue;
      placeNote(row, col);
    }
  } else {
    for (let c = 0; c < stepsPerBar; c += 1) {
      const sc = srcStart + c;
      const dc = dstStart + c;
      for (let r = 0; r < GENO_ARP_ROWS; r += 1) {
        next[r]![dc] = grid[r]?.[sc] ?? false;
      }
    }
  }

  return next;
}
