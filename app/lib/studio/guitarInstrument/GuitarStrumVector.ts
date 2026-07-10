/**
 * Right-hand engine — strum micro-delay vector (structural timing only).
 */
import {
  GUITAR_STRING_COUNT,
  stringIndexToNumber,
  type GuitarStrumSchedule,
  type GuitarStrumStrike,
  type GuitarStringPlacement,
  type StrumDirection,
} from '@/app/lib/studio/guitarInstrument/types';

export type StrumVectorOpts = {
  /** Milliseconds between consecutive string strikes (default 12). */
  stringSpacingMs?: number;
  /** Clamp spacing to this range. */
  minSpacingMs?: number;
  maxSpacingMs?: number;
};

const DEFAULT_SPACING_MS = 12;
const DEFAULT_MIN_MS = 5;
const DEFAULT_MAX_MS = 30;

function clampSpacing(ms: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, ms));
}

/**
 * Downstrum order: string 6 → 1 (low E → high e) = stringIndex 0 → 5.
 * Upstrum order: string 1 → 6 = stringIndex 5 → 0.
 */
export function strumStringOrder(direction: StrumDirection): number[] {
  const indices = Array.from({ length: GUITAR_STRING_COUNT }, (_, i) => i);
  return direction === 'down' ? indices : [...indices].reverse();
}

/**
 * Build per-string strike schedule from a voicing.
 * Only plucked strings receive entries; order follows strum direction.
 */
export function buildStrumSchedule(
  placements: readonly GuitarStringPlacement[],
  direction: StrumDirection,
  originMs: number,
  opts?: StrumVectorOpts,
): GuitarStrumSchedule {
  const minMs = opts?.minSpacingMs ?? DEFAULT_MIN_MS;
  const maxMs = opts?.maxSpacingMs ?? DEFAULT_MAX_MS;
  const spacing = clampSpacing(opts?.stringSpacingMs ?? DEFAULT_SPACING_MS, minMs, maxMs);

  const byString = new Map<number, GuitarStringPlacement>();
  for (const p of placements) {
    byString.set(p.stringIndex, p);
  }

  const order = strumStringOrder(direction);
  const strikes: GuitarStrumStrike[] = [];
  let strikeIndex = 0;

  for (const stringIndex of order) {
    const placement = byString.get(stringIndex);
    if (!placement) continue;

    strikes.push({
      ...placement,
      stringNumber: stringIndexToNumber(stringIndex),
      offsetMs: strikeIndex * spacing,
      strikeIndex,
    });
    strikeIndex += 1;
  }

  return {
    direction,
    originMs,
    stringSpacingMs: spacing,
    strikes,
  };
}

/**
 * Chord strum helper — voicing placements → timed strike vector.
 */
export function strumPlacements(
  placements: readonly GuitarStringPlacement[],
  direction: StrumDirection,
  originMs: number,
  opts?: StrumVectorOpts,
): GuitarStrumSchedule {
  return buildStrumSchedule(placements, direction, originMs, opts);
}

/** Absolute wall-clock ms for each strike. */
export function resolveStrumStrikeTimes(schedule: GuitarStrumSchedule): number[] {
  return schedule.strikes.map((s) => schedule.originMs + s.offsetMs);
}
