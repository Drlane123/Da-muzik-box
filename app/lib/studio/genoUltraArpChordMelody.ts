/**
 * Geno Ultra ARP — chord-locked melody grid generation.
 * Builds sparse arp patterns whose rows map to imported chord tones per step.
 */
import {
  GENO_ARP_ACTIVE_ROW_SPAN,
  GENO_ARP_MAX_COLS,
  GENO_ARP_ROWS,
  genoArpCenterPresetRow,
  genoArpGridCols,
  genoArpOrderRow,
  genoArpOrderRowForGridCol,
  genoArpRowBandRelative,
  genoArpSanitizePhraseSteps,
  genoArpStepInBar,
  genoArpStepMaskIsBlank,
  type GenoArpBarLength,
  type GenoArpOrder,
  type GenoArpVariation,
} from '@/app/lib/studio/genoUltraArpPattern';
import {
  genoUltraArpBeatForGridCol,
  genoUltraArpChordSegmentAtBeat,
  genoUltraArpTotalPatternBeats,
} from '@/app/lib/studio/genoUltraArpChordPitch';
import {
  genoArpResolveEffectiveTimeline,
  type GenoUltraArpHarmonyContext,
} from '@/app/lib/studio/genoUltraArpHarmony';
import type { GenoUltraArpChordSegment } from '@/app/lib/studio/genoUltraArpState';

function seededUnit(step: number, seed: number): number {
  const x = Math.sin(step * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function uniqueSortedPitches(pitches: readonly number[]): number[] {
  return [...new Set(pitches.map((p) => Math.round(p)))].sort((a, b) => a - b);
}

function toneIndexToPresetRow(toneIdx: number, toneCount: number): number {
  if (toneCount <= 1) return genoArpCenterPresetRow(Math.floor(GENO_ARP_ACTIVE_ROW_SPAN / 2));
  const rel =
    toneCount <= GENO_ARP_ACTIVE_ROW_SPAN
      ? Math.min(toneIdx, GENO_ARP_ACTIVE_ROW_SPAN - 1)
      : Math.round((toneIdx / Math.max(1, toneCount - 1)) * (GENO_ARP_ACTIVE_ROW_SPAN - 1));
  return genoArpCenterPresetRow(rel);
}

function isNearChordBoundary(
  timeline: readonly GenoUltraArpChordSegment[],
  beat: number,
  totalBeats: number,
  epsilon = 0.02,
): boolean {
  const wrapped = ((beat % totalBeats) + totalBeats) % totalBeats;
  for (const seg of timeline) {
    if (Math.abs(seg.startBeat - wrapped) < epsilon) return true;
  }
  return false;
}

function melodyStepActive(
  col: number,
  stepInBar: number,
  melodySeed: number,
  atChordChange: boolean,
): boolean {
  if (atChordChange || stepInBar === 0 || stepInBar === 8) return true;
  if (stepInBar % 4 === 0) return seededUnit(col, melodySeed + 3) > 0.28;
  if (stepInBar % 2 === 0) return seededUnit(col, melodySeed + 7) > 0.55;
  return seededUnit(col, melodySeed + 11) > 0.78;
}

/** Sparse melody grid — rows follow chord tones at each step (playback uses chordTimeline). */
export function buildGenoArpMelodyFromChordTimeline(opts: {
  barLength: GenoArpBarLength;
  order: GenoArpOrder;
  variation?: GenoArpVariation;
  randSeed?: number;
  melodySeed?: number;
  chordTimeline: readonly GenoUltraArpChordSegment[];
  harmony: GenoUltraArpHarmonyContext;
}): boolean[][] {
  const cols = genoArpGridCols(opts.barLength);
  const g = Array.from({ length: GENO_ARP_ROWS }, () => Array(GENO_ARP_MAX_COLS).fill(false));
  const totalBeats = genoUltraArpTotalPatternBeats(opts.barLength);
  const melodySeed = opts.melodySeed ?? Math.floor(Math.random() * 99999);
  const orderSeed = opts.randSeed ?? 0;
  const variation = opts.variation ?? 0;

  const timeline = genoArpResolveEffectiveTimeline(opts.harmony, opts.barLength, 60);

  for (let col = 0; col < cols; col += 1) {
    const stepInBar = genoArpStepInBar(col);
    const beat = genoUltraArpBeatForGridCol(col, opts.barLength);
    const atBoundary = isNearChordBoundary(timeline, beat, totalBeats);
    if (!melodyStepActive(col, stepInBar, melodySeed, atBoundary)) continue;

    const seg = genoUltraArpChordSegmentAtBeat(timeline, beat, totalBeats);
    const toneCount = Math.max(1, uniqueSortedPitches(seg?.pitches ?? []).length);

    let row: number;
    if (atBoundary) {
      row = toneIndexToPresetRow(0, toneCount);
    } else if (opts.order === 'RAND') {
      const toneIdx = Math.floor(seededUnit(col, orderSeed + variation * 131) * toneCount);
      row = toneIndexToPresetRow(toneIdx, toneCount);
    } else {
      const orderRow = genoArpOrderRowForGridCol(col, opts.order, orderSeed, variation);
      const rel = genoArpRowBandRelative(orderRow);
      row = toneIndexToPresetRow(rel % toneCount, toneCount);
    }

    g[row]![col] = true;
  }

  return g;
}

/** Velocity accents aligned with generated melody hits. */
export function buildGenoArpMelodyVelLevels(cols: number, melodySeed: number): number[] {
  const levels = Array(GENO_ARP_MAX_COLS).fill(0.62);
  for (let col = 0; col < cols; col += 1) {
    const stepInBar = genoArpStepInBar(col);
    if (stepInBar === 0) levels[col] = 0.95;
    else if (stepInBar === 8) levels[col] = 0.88;
    else if (stepInBar % 4 === 0) levels[col] = 0.78;
    else levels[col] = 0.55 + seededUnit(col, melodySeed) * 0.25;
  }
  return levels;
}

/** Columns to regenerate — armed STEP pads, or existing note rhythm when mask is blank. */
export function genoArpRegenTargetCols(
  phraseLen: number,
  stepMask: readonly boolean[],
  currentGrid: boolean[][],
): number[] {
  const maskBlank = genoArpStepMaskIsBlank(stepMask);
  const targets: number[] = [];
  let hasRhythmNotes = false;
  if (maskBlank) {
    for (let col = 0; col < phraseLen; col += 1) {
      if (currentGrid.some((r) => r[col])) {
        hasRhythmNotes = true;
        break;
      }
    }
  }
  for (let col = 0; col < phraseLen; col += 1) {
    if (!maskBlank) {
      if (stepMask[col] !== false) targets.push(col);
      continue;
    }
    if (hasRhythmNotes) {
      if (currentGrid.some((r) => r[col])) targets.push(col);
    } else {
      targets.push(col);
    }
  }
  return targets;
}

/** Unique grid rows that already have notes (sorted low → high). */
export function genoArpCollectActiveRows(
  grid: boolean[][],
  colIndices: readonly number[],
): number[] {
  const rows = new Set<number>();
  for (const col of colIndices) {
    if (col < 0) continue;
    for (let r = 0; r < GENO_ARP_ROWS; r += 1) {
      if (grid[r]?.[col]) rows.add(r);
    }
  }
  return [...rows].sort((a, b) => a - b);
}

const POOL_RUN_LENS = [2, 3, 4, 5, 3, 2] as const;

type PoolMelodyStyle = 'longRuns' | 'sporadic' | 'tripleJump' | 'pingPong' | 'scatter' | 'arpMix';

const POOL_MELODY_STYLES: readonly PoolMelodyStyle[] = [
  'longRuns',
  'sporadic',
  'tripleJump',
  'pingPong',
  'scatter',
  'arpMix',
];

function clampPoolIdx(idx: number, poolLen: number): number {
  if (poolLen <= 0) return 0;
  if (!Number.isFinite(idx)) return 0;
  return ((Math.floor(idx) % poolLen) + poolLen) % poolLen;
}

function normalizePoolIndices(indices: number[], steps: number, poolLen: number): number[] {
  const out = indices.slice(0, steps).map((idx) => clampPoolIdx(idx, poolLen));
  while (out.length < steps) {
    out.push(out.length > 0 ? out[out.length - 1]! : 0);
  }
  return out;
}

function pickSporadicRunLen(runIndex: number, melodySeed: number): number {
  const idx = Math.floor(seededUnit(runIndex, melodySeed + 41) * POOL_RUN_LENS.length);
  return POOL_RUN_LENS[idx]!;
}

function sporadicPoolStep(cur: number, poolLen: number, runIndex: number, melodySeed: number): number {
  const u = seededUnit(runIndex, melodySeed + 67);
  if (u < 0.32) return clampPoolIdx(cur - 1, poolLen);
  if (u < 0.64) return clampPoolIdx(cur + 1, poolLen);
  return clampPoolIdx(Math.floor(seededUnit(runIndex, melodySeed + 89) * poolLen), poolLen);
}

function fillPoolIndicesByRuns(
  steps: number,
  poolLen: number,
  startIdx: number,
  melodySeed: number,
  runLenFn: (runIndex: number, seed: number) => number,
  idxStepFn: (runIndex: number, cur: number, poolLen: number, seed: number) => number,
): { indices: number[]; endIdx: number } {
  const indices: number[] = [];
  let poolIdx = ((startIdx % poolLen) + poolLen) % poolLen;
  let runIndex = 0;
  while (indices.length < steps) {
    const runLen = Math.max(1, runLenFn(runIndex, melodySeed));
    for (let i = 0; i < runLen && indices.length < steps; i += 1) {
      indices.push(poolIdx);
    }
    poolIdx = idxStepFn(runIndex, poolIdx, poolLen, melodySeed);
    runIndex += 1;
  }
  return { indices: normalizePoolIndices(indices, steps, poolLen), endIdx: poolIdx };
}

function buildPoolStyleChunk(
  style: PoolMelodyStyle,
  steps: number,
  poolLen: number,
  startIdx: number,
  melodySeed: number,
  order: GenoArpOrder,
): { indices: number[]; endIdx: number } {
  switch (style) {
    case 'longRuns':
      return fillPoolIndicesByRuns(
        steps,
        poolLen,
        startIdx,
        melodySeed,
        (r, s) => (seededUnit(r, s + 41) < 0.5 ? 4 : 5),
        (r, cur, len) => (cur + 1) % len,
      );
    case 'sporadic':
      return fillPoolIndicesByRuns(
        steps,
        poolLen,
        startIdx,
        melodySeed,
        pickSporadicRunLen,
        sporadicPoolStep,
      );
    case 'tripleJump':
      return fillPoolIndicesByRuns(
        steps,
        poolLen,
        startIdx,
        melodySeed,
        (r, s) => {
          const u = seededUnit(r, s + 51);
          if (u < 0.55) return 3;
          if (u < 0.8) return 2;
          return 4;
        },
        (r, cur, len, s) => {
          const u = seededUnit(r, s + 71);
          if (u < 0.45) return clampPoolIdx(cur - 1, len);
          if (u < 0.9) return clampPoolIdx(cur + 1, len);
          return clampPoolIdx(Math.floor(seededUnit(r, s + 91) * len), len);
        },
      );
    case 'pingPong': {
      const indices: number[] = [];
      let poolIdx = ((startIdx % poolLen) + poolLen) % poolLen;
      let dir = seededUnit(0, melodySeed + 31) < 0.5 ? 1 : -1;
      for (let i = 0; i < steps; i += 1) {
        indices.push(poolIdx);
        const hold = seededUnit(i, melodySeed + 53) < 0.42;
        if (!hold) {
          const next = poolIdx + dir;
          if (next >= poolLen - 1) {
            poolIdx = poolLen - 1;
            dir = -1;
          } else if (next <= 0) {
            poolIdx = 0;
            dir = 1;
          } else {
            poolIdx = next;
          }
        }
      }
      return { indices: normalizePoolIndices(indices, steps, poolLen), endIdx: poolIdx };
    }
    case 'scatter': {
      const indices: number[] = [];
      let poolIdx = ((startIdx % poolLen) + poolLen) % poolLen;
      for (let i = 0; i < steps; i += 1) {
        indices.push(poolIdx);
        const u = seededUnit(i, melodySeed + 61);
        if (u < 0.38) poolIdx = poolIdx;
        else if (u < 0.62) poolIdx = clampPoolIdx(poolIdx + 1, poolLen);
        else if (u < 0.82) poolIdx = clampPoolIdx(poolIdx - 1, poolLen);
        else poolIdx = clampPoolIdx(Math.floor(seededUnit(i, melodySeed + 83) * poolLen), poolLen);
      }
      return { indices: normalizePoolIndices(indices, steps, poolLen), endIdx: poolIdx };
    }
    case 'arpMix': {
      const indices: number[] = [];
      let poolIdx = ((startIdx % poolLen) + poolLen) % poolLen;
      const regenVar = (melodySeed % 4) as GenoArpVariation;
      for (let i = 0; i < steps; i += 1) {
        const u = seededUnit(i, melodySeed + 97);
        if (u < 0.28) {
          const run = 2 + Math.floor(seededUnit(i, melodySeed + 101) * 4);
          for (let k = 0; k < run && i + k < steps; k += 1) {
            indices.push(poolIdx);
          }
          i += run - 1;
          poolIdx = sporadicPoolStep(poolIdx, poolLen, i, melodySeed);
        } else {
          const orderRow = genoArpOrderRow(i, order, melodySeed, regenVar);
          poolIdx = clampPoolIdx(genoArpRowBandRelative(orderRow) % poolLen, poolLen);
          indices.push(poolIdx);
        }
      }
      return { indices: normalizePoolIndices(indices, steps, poolLen), endIdx: poolIdx };
    }
    default:
      return fillPoolIndicesByRuns(steps, poolLen, startIdx, melodySeed, pickSporadicRunLen, sporadicPoolStep);
  }
}

/** Guided regen — several melody shapes, always within the user's note pool. */
function buildGuidedPoolMelody(
  steps: number,
  pool: readonly number[],
  melodySeed: number,
  order: GenoArpOrder,
): number[] {
  if (pool.length === 1) return Array.from({ length: steps }, () => pool[0]!);

  const rows: number[] = [];
  let poolIdx = melodySeed % pool.length;
  let pos = 0;
  let seg = 0;

  while (pos < steps && seg < 64) {
    const style = POOL_MELODY_STYLES[Math.floor(seededUnit(seg, melodySeed + 11) * POOL_MELODY_STYLES.length)]!;
    const segLen = Math.max(1, Math.min(steps - pos, 2 + Math.floor(seededUnit(seg, melodySeed + 23) * 7)));
    const chunk = buildPoolStyleChunk(style, segLen, pool.length, poolIdx, melodySeed + seg * 997, order);
    for (const idx of chunk.indices) {
      rows.push(pool[clampPoolIdx(idx, pool.length)]!);
    }
    poolIdx = clampPoolIdx(chunk.endIdx, pool.length);
    pos += segLen;
    seg += 1;
  }

  while (rows.length < steps) {
    rows.push(pool[clampPoolIdx(poolIdx, pool.length)]!);
  }

  return rows.slice(0, steps);
}

function rowFromNotePool(
  stepIndex: number,
  pool: readonly number[],
  melodySeed: number,
  order: GenoArpOrder,
  melodyMap: readonly number[] | null,
): number {
  if (melodyMap && stepIndex < melodyMap.length) return melodyMap[stepIndex]!;
  if (pool.length === 1) return pool[0]!;
  return pool[melodySeed % pool.length]!;
}

function rowForRegenCol(opts: {
  col: number;
  barLength: GenoArpBarLength;
  order: GenoArpOrder;
  variation: GenoArpVariation;
  orderSeed: number;
  melodySeed: number;
  randomMode: boolean;
  rowPool: readonly number[] | null;
  stepIndex: number;
  melodyMap: readonly number[] | null;
  timeline: readonly GenoUltraArpChordSegment[];
  totalBeats: number;
}): number {
  const {
    col,
    barLength,
    order,
    variation,
    orderSeed,
    melodySeed,
    randomMode,
    rowPool,
    stepIndex,
    melodyMap,
    timeline,
    totalBeats,
  } = opts;

  if (randomMode) {
    const rel = Math.floor(seededUnit(col, melodySeed + 19) * GENO_ARP_ACTIVE_ROW_SPAN);
    return genoArpCenterPresetRow(rel);
  }

  if (rowPool && rowPool.length > 0) {
    return rowFromNotePool(stepIndex, rowPool, melodySeed, order, melodyMap);
  }

  const beat = genoUltraArpBeatForGridCol(col, barLength);
  const atBoundary = isNearChordBoundary(timeline, beat, totalBeats);

  if (timeline.length > 0) {
    const seg = genoUltraArpChordSegmentAtBeat(timeline, beat, totalBeats);
    const toneCount = Math.max(1, uniqueSortedPitches(seg?.pitches ?? []).length);
    if (atBoundary) return toneIndexToPresetRow(0, toneCount);
    const orderRow = genoArpOrderRowForGridCol(
      col,
      order,
      orderSeed,
      ((variation + (melodySeed % 4)) % 4) as GenoArpVariation,
    );
    const rel = genoArpRowBandRelative(orderRow);
    const toneIdx = Math.floor(seededUnit(col, melodySeed + 3) * toneCount);
    return toneIndexToPresetRow(
      order === 'RAND' ? toneIdx : rel % toneCount,
      toneCount,
    );
  }

  return Math.max(
    0,
    Math.min(
      GENO_ARP_ROWS - 1,
      genoArpOrderRowForGridCol(
        col,
        order,
        orderSeed + melodySeed,
        ((variation + (melodySeed % 4)) % 4) as GenoArpVariation,
      ),
    ),
  );
}

/**
 * Regenerate note pattern within the user's STEP phrase — keeps armed pads / rhythm columns.
 * Guided mode reuses only pitches already on the grid; random mode is unrestricted.
 */
export function regenerateGenoArpGridFromSteps(opts: {
  barLength: GenoArpBarLength;
  phraseSteps: number;
  stepMask: readonly boolean[];
  currentGrid: boolean[][];
  order: GenoArpOrder;
  variation?: GenoArpVariation;
  randSeed?: number;
  melodySeed: number;
  randomMode?: boolean;
  chordTimeline?: readonly GenoUltraArpChordSegment[];
  harmony?: GenoUltraArpHarmonyContext;
}): boolean[][] {
  const cols = genoArpGridCols(opts.barLength);
  const phraseLen = genoArpSanitizePhraseSteps(opts.phraseSteps, cols);
  const targets = genoArpRegenTargetCols(phraseLen, opts.stepMask, opts.currentGrid);
  const randomMode = opts.randomMode === true;
  const phraseCols = Array.from({ length: phraseLen }, (_, i) => i);
  const rowPool = randomMode
    ? null
    : genoArpCollectActiveRows(opts.currentGrid, phraseCols);
  const variation = opts.variation ?? 0;
  const orderSeed = opts.randSeed ?? 0;
  const order = randomMode ? 'RAND' : opts.order;
  const totalBeats = genoUltraArpTotalPatternBeats(opts.barLength);
  const timeline =
    opts.chordTimeline?.length && opts.harmony
      ? genoArpResolveEffectiveTimeline(opts.harmony, opts.barLength, 60)
      : [];

  const next = opts.currentGrid.map((r) => [...r]);
  for (let col = 0; col < phraseLen; col += 1) {
    for (let r = 0; r < GENO_ARP_ROWS; r += 1) {
      next[r]![col] = false;
    }
  }

  const guidedMelody =
    !randomMode && rowPool && rowPool.length > 1
      ? buildGuidedPoolMelody(targets.length, rowPool, opts.melodySeed, opts.order)
      : null;

  for (let ti = 0; ti < targets.length; ti += 1) {
    const col = targets[ti]!;
    const row = rowForRegenCol({
      col,
      barLength: opts.barLength,
      order,
      variation,
      orderSeed: randomMode ? opts.melodySeed : orderSeed,
      melodySeed: opts.melodySeed,
      randomMode,
      rowPool,
      stepIndex: ti,
      melodyMap: guidedMelody,
      timeline,
      totalBeats,
    });
    if (!Number.isFinite(row) || row < 0 || row >= GENO_ARP_ROWS) continue;
    next[row]![col] = true;
  }

  return next;
}