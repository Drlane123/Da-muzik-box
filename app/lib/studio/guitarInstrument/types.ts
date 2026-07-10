/**
 * Six-string guitar instrument — pure data model (no audio).
 *
 * Index convention (matches SE2 fretboard):
 *   stringIndex 0 = guitar string 6 (low E)
 *   stringIndex 5 = guitar string 1 (high e)
 */

export const GUITAR_STRING_COUNT = 6;
export const GUITAR_MAX_FRET = 24;
export const GUITAR_MIN_HAND_POSITION = 0;
export const GUITAR_MAX_HAND_POSITION = 19;

/** Standard tuning open-string MIDI: E2 A2 D3 G3 B3 E4 (low → high). */
export const GUITAR_STANDARD_OPEN_MIDI: readonly number[] = [40, 45, 50, 55, 59, 64];

export const GUITAR_STANDARD_LABELS = ['E', 'A', 'D', 'G', 'B', 'e'] as const;

/** Player-facing string number: 6 = low E, 1 = high e. */
export type GuitarStringNumber = 1 | 2 | 3 | 4 | 5 | 6;

export function stringIndexToNumber(stringIndex: number): GuitarStringNumber {
  const n = GUITAR_STRING_COUNT - stringIndex;
  return Math.max(1, Math.min(6, n)) as GuitarStringNumber;
}

export function stringNumberToIndex(stringNumber: GuitarStringNumber): number {
  return GUITAR_STRING_COUNT - stringNumber;
}

/** One physical string + fret assignment (structural only). */
export type GuitarStringPlacement = {
  stringIndex: number;
  stringNumber: GuitarStringNumber;
  fret: number;
  midi: number;
};

/** Result of assigning a chord — includes kill events for monophonic string transitions. */
export type GuitarStringTransition = {
  stringIndex: number;
  previousFret: number | null;
  nextFret: number;
  midi: number;
};

export type GuitarVoicingResult = {
  handPosition: number;
  placements: GuitarStringPlacement[];
  transitions: GuitarStringTransition[];
  unassignedMidis: number[];
};

export type StrumDirection = 'down' | 'up';

/** Scheduled structural strike (timing only — no audio nodes). */
export type GuitarStrumStrike = GuitarStringPlacement & {
  /** Milliseconds after strum origin. */
  offsetMs: number;
  /** Order index in the strum (0 = first plucked). */
  strikeIndex: number;
};

export type GuitarStrumSchedule = {
  direction: StrumDirection;
  originMs: number;
  stringSpacingMs: number;
  strikes: GuitarStrumStrike[];
};
