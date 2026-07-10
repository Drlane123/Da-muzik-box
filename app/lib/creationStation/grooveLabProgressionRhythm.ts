/**
 * How fast genre-pack loops move in the progression audition / LOAD ALL path.
 * Separate from session BPM — step length + doubled holds define the groove feel.
 */

import { GROOVE_PROGRESSION_BEATS_PER_BAR } from '@/app/lib/creationStation/grooveLabProgressionBuilder';

export type GenrePackRhythm = {
  /** Beats each chord step is held during pack preview / timeline load. */
  stepBeats: number;
  /** Repeat each chord twice (reggae skank / UKG double-up). */
  doubleHold: boolean;
};

const DEFAULT_RHYTHM: GenrePackRhythm = {
  stepBeats: GROOVE_PROGRESSION_BEATS_PER_BAR,
  doubleHold: false,
};

/** Per-genre harmonic rhythm for pack loops. */
export const GENRE_PACK_RHYTHM: Record<string, GenrePackRhythm> = {
  reggae: { stepBeats: 1, doubleHold: true },
  'uk-garage': { stepBeats: 2, doubleHold: true },
  afrobeat: { stepBeats: 2, doubleHold: false },
  house: { stepBeats: 4, doubleHold: false },
  disco: { stepBeats: 4, doubleHold: false },
  dance: { stepBeats: 4, doubleHold: false },
  trap: { stepBeats: 2, doubleHold: false },
  funk: { stepBeats: 2, doubleHold: false },
  hiphop: { stepBeats: 4, doubleHold: false },
  pop: { stepBeats: 4, doubleHold: false },
  rock: { stepBeats: 4, doubleHold: false },
  jazz: { stepBeats: 4, doubleHold: false },
  gospel: { stepBeats: 4, doubleHold: false },
  country: { stepBeats: 4, doubleHold: false },
  lofi: { stepBeats: 4, doubleHold: false },
  blues: { stepBeats: 4, doubleHold: false },
};

export function rhythmForGenrePack(genreId: string): GenrePackRhythm {
  return GENRE_PACK_RHYTHM[genreId] ?? DEFAULT_RHYTHM;
}

export function buildGenrePackStepLabels(chordLabels: string[], genreId: string): string[] {
  const { doubleHold } = rhythmForGenrePack(genreId);
  if (!doubleHold) return chordLabels;
  return chordLabels.flatMap((label) => [label, label]);
}
