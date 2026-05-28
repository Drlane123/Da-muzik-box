/**
 * Beat Lab pattern automation — FL Piano roll “Event / note property” style.
 * Volume lane = per-column multiplier (0–127) applied on top of per-note velocity.
 */

import type { BeatLabMidiNote } from './beatLabMidiRoll';
import { beatLabSplitMidiNoteAt, clampBeatLabNoteLen } from './beatLabMidiRoll';

export const BEAT_LAB_AUTOMATION_LANE_H = 48;
/** VOL + PITCH stacked event lanes under the piano roll. */
export const BEAT_LAB_AUTOMATION_BLOCK_H = BEAT_LAB_AUTOMATION_LANE_H * 2;

/** Micro-steps per pattern column — edit tiny spots inside one step. */
export const BEAT_LAB_AUTOMATION_TICKS_PER_COL = 8;

/** Neutral pitch automation value (0 semitones). */
export const BEAT_LAB_PITCH_AUTOMATION_CENTER = 64;

/** Default volume lane level (quieter baseline; drag up for accents). */
export const BEAT_LAB_VOL_AUTOMATION_DEFAULT = 80;

export function beatLabAutomationFineCols(patternCols: number): number {
  return Math.max(1, Math.round(patternCols) * BEAT_LAB_AUTOMATION_TICKS_PER_COL);
}

export function beatLabAutomationFineIndex(patternCol: number, tickInCol = 0): number {
  const col = Math.max(0, Math.round(patternCol));
  const tick = Math.max(
    0,
    Math.min(BEAT_LAB_AUTOMATION_TICKS_PER_COL - 1, Math.round(tickInCol)),
  );
  return col * BEAT_LAB_AUTOMATION_TICKS_PER_COL + tick;
}

export function beatLabPatternColFromFineIndex(fineIdx: number): number {
  return Math.floor(Math.max(0, fineIdx) / BEAT_LAB_AUTOMATION_TICKS_PER_COL);
}

function upsampleBeatLabAutomation(
  raw: number[],
  fineCols: number,
  patternCols: number,
  fill: number,
): number[] {
  const ticks = BEAT_LAB_AUTOMATION_TICKS_PER_COL;
  const out = new Array<number>(fineCols).fill(fill);
  if (raw.length === fineCols) {
    for (let i = 0; i < fineCols; i++) {
      const v = Math.round(Number(raw[i]));
      out[i] = Number.isFinite(v) ? Math.max(0, Math.min(127, v)) : fill;
    }
    return out;
  }
  const coarse = Math.max(1, Math.round(patternCols));
  for (let fc = 0; fc < fineCols; fc++) {
    const col = Math.min(coarse - 1, Math.floor(fc / ticks));
    const nextCol = Math.min(coarse - 1, col + 1);
    const t = (fc % ticks) / ticks;
    const v0 = raw[Math.min(raw.length - 1, col)] ?? fill;
    const v1 = raw[Math.min(raw.length - 1, nextCol)] ?? fill;
    const v = Math.round(v0 + (v1 - v0) * t);
    out[fc] = Number.isFinite(v) ? Math.max(0, Math.min(127, v)) : fill;
  }
  return out;
}

/** Normalize volume automation to fine columns (default quiet baseline). */
export function normalizeBeatLabVolAutomation(raw: unknown, patternCols: number): number[] {
  const fineCols = beatLabAutomationFineCols(patternCols);
  const fill = BEAT_LAB_VOL_AUTOMATION_DEFAULT;
  if (!Array.isArray(raw)) return new Array<number>(fineCols).fill(fill);
  const nums = raw.map((x) => Math.round(Number(x)));
  return upsampleBeatLabAutomation(nums, fineCols, patternCols, fill);
}

function beatLabAutomationAtFine(
  automation: number[] | undefined,
  fineIdx: number,
  fallback: number,
): number {
  if (!automation?.length) return fallback;
  const c = Math.max(0, Math.min(automation.length - 1, Math.round(fineIdx)));
  return automation[c] ?? fallback;
}

export function beatLabVolAt(automation: number[] | undefined, col: number): number {
  return beatLabAutomationAtFine(
    automation,
    beatLabAutomationFineIndex(col, 0),
    BEAT_LAB_VOL_AUTOMATION_DEFAULT,
  );
}

/** 0…1 gain for a pattern column. */
export function beatLabVolMulAt(automation: number[] | undefined, col: number): number {
  return beatLabVolAt(automation, col) / 127;
}

export function beatLabEffectiveVelocity(
  noteVel: number | undefined,
  automation: number[] | undefined,
  col: number,
): number {
  const base = Math.max(1, Math.min(127, Math.round(noteVel ?? 100)));
  return Math.max(1, Math.min(127, Math.round(base * beatLabVolMulAt(automation, col))));
}

/** Normalize pitch automation (64 = 0 st, 0 = −12 st, 127 = +12 st). */
export function normalizeBeatLabPitchAutomation(raw: unknown, patternCols: number): number[] {
  const fineCols = beatLabAutomationFineCols(patternCols);
  const fill = BEAT_LAB_PITCH_AUTOMATION_CENTER;
  if (!Array.isArray(raw)) return new Array<number>(fineCols).fill(fill);
  const nums = raw.map((x) => Math.round(Number(x)));
  return upsampleBeatLabAutomation(nums, fineCols, patternCols, fill);
}

export function beatLabPitchAutomationAt(automation: number[] | undefined, col: number): number {
  return beatLabAutomationAtFine(
    automation,
    beatLabAutomationFineIndex(col, 0),
    BEAT_LAB_PITCH_AUTOMATION_CENTER,
  );
}

/** Semitone offset from pitch automation (−12…+12, fractional). */
export function beatLabPitchSemiFromAutomation(automationVal: number): number {
  const v = Math.max(0, Math.min(127, automationVal));
  return ((v - BEAT_LAB_PITCH_AUTOMATION_CENTER) / 64) * 12;
}

/** Display string for pitch HUD (−12…+12 st). */
export function beatLabFormatPitchSemi(semi: number): string {
  if (Math.abs(semi) < 0.05) return '0 st';
  const sign = semi > 0 ? '+' : '';
  return `${sign}${semi.toFixed(1)} st`;
}

export function beatLabFineColsPerBar(patternColsPerBar: number): number {
  return Math.max(1, Math.round(patternColsPerBar) * BEAT_LAB_AUTOMATION_TICKS_PER_COL);
}

export function beatLabBarFineStart(patternCol: number, patternColsPerBar: number): number {
  const cpb = Math.max(1, Math.round(patternColsPerBar));
  const bar = Math.floor(Math.max(0, patternCol) / cpb);
  return bar * beatLabFineColsPerBar(cpb);
}

export function beatLabCopyAutomationSegment(
  values: number[],
  fineLo: number,
  fineHi: number,
): number[] {
  const lo = Math.max(0, Math.min(Math.floor(fineLo), Math.floor(fineHi)));
  const hi = Math.min(values.length - 1, Math.max(Math.floor(fineLo), Math.floor(fineHi)));
  if (hi < lo) return [];
  return values.slice(lo, hi + 1);
}

export function beatLabPasteAutomationSegment(
  values: number[],
  segment: number[],
  fineDestStart: number,
): number[] {
  if (!segment.length) return values;
  const next = [...values];
  const start = Math.max(0, Math.floor(fineDestStart));
  for (let i = 0; i < segment.length; i++) {
    const idx = start + i;
    if (idx >= next.length) break;
    next[idx] = segment[i]!;
  }
  return next;
}

export function beatLabPitchSemiAtColumn(
  pitchAutomation: number[] | undefined,
  col: number,
  notePitchSemi = 0,
): number {
  return clampBeatLabPitchSemi(
    beatLabPitchSemiFromAutomation(beatLabPitchAutomationAt(pitchAutomation, col)) + notePitchSemi,
  );
}

/** Clamp per-note pitch offset (semitones, fractional OK). */
export function clampBeatLabPitchSemi(semi: number): number {
  return Math.max(-24, Math.min(24, semi));
}

/**
 * FL Slice (C) + pitch staircase: split at `splitCol`, right segment gains +1 semitone
 * (and each further slice from the same parent stacks — see caller).
 */
export function beatLabPitchSliceMidiNoteAt(
  notes: BeatLabMidiNote[],
  lane: number,
  headCol: number,
  splitCol: number,
  maxCol: number,
): BeatLabMidiNote[] {
  const note = notes.find((n) => n.lane === lane && n.col === headCol);
  if (!note || splitCol <= headCol || splitCol >= headCol + note.len) return notes;
  const leftLen = splitCol - headCol;
  const rightLen = note.len - leftLen;
  const rest = notes.filter((n) => !(n.lane === lane && n.col === headCol));
  const vel = note.vel ?? 100;
  const muted = note.muted;
  const basePitch = note.pitchSemi ?? 0;
  return [
    ...rest,
    {
      lane,
      col: headCol,
      len: leftLen,
      vel,
      pitchSemi: basePitch,
      ...(muted ? { muted: true } : {}),
    },
    {
      lane,
      col: splitCol,
      len: clampBeatLabNoteLen(rightLen, splitCol, maxCol),
      vel,
      pitchSemi: clampBeatLabPitchSemi(basePitch + 1),
      ...(muted ? { muted: true } : {}),
    },
  ];
}

/** Interpolate automation between two columns (FL-style line). */
export function beatLabPaintVolAutomationLine(
  automation: number[],
  colA: number,
  valA: number,
  colB: number,
  valB: number,
): number[] {
  const next = [...automation];
  const c0 = Math.max(0, Math.min(next.length - 1, Math.round(colA)));
  const c1 = Math.max(0, Math.min(next.length - 1, Math.round(colB)));
  const lo = Math.min(c0, c1);
  const hi = Math.max(c0, c1);
  const v0 = Math.max(0, Math.min(127, Math.round(valA)));
  const v1 = Math.max(0, Math.min(127, Math.round(valB)));
  for (let c = lo; c <= hi; c++) {
    const t = hi === lo ? 0 : (c - lo) / (hi - lo);
    next[c] = Math.round(v0 + (v1 - v0) * t);
  }
  return next;
}
