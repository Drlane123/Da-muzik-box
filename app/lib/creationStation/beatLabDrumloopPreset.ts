/**
 * DrumloopAI-style Beat Lab grid: 4/4, 1/16 steps, short loop, full grid + fit.
 * @see https://www.drumloopai.com — interactive 16th-note step sequencer feel.
 */

import { PIANO_SNAP_SUBDIV_DEFAULT } from '@/app/lib/sharedPianoSnapSubdiv';

/** Cells per quarter → 1/16 (16 steps per 4/4 bar). */
export const BEAT_LAB_DRUMLOOP_SNAP_SUBDIV = PIANO_SNAP_SUBDIV_DEFAULT;

/** Default loop length — eight-bar phrase (128 steps at 1/16). */
export const BEAT_LAB_DRUMLOOP_LOOP_BARS = 8;

/** Sixteen-bar arrangement span. */
export const BEAT_LAB_DRUMLOOP_LOOP_BARS_WIDE = 16;

/** Classic one-bar / 16-step machine view. */
export const BEAT_LAB_DRUMLOOP_LOOP_BARS_CLASSIC = 1;

/** Two-bar hook / half-phrase. */
export const BEAT_LAB_DRUMLOOP_LOOP_BARS_HALF = 2;

export type BeatLabDrumloopPresetVariant = '8bar' | '16bar' | '2bar' | '1bar';

export function drumloopLoopBarsForVariant(v: BeatLabDrumloopPresetVariant): number {
  if (v === '1bar') return BEAT_LAB_DRUMLOOP_LOOP_BARS_CLASSIC;
  if (v === '2bar') return BEAT_LAB_DRUMLOOP_LOOP_BARS_HALF;
  if (v === '16bar') return BEAT_LAB_DRUMLOOP_LOOP_BARS_WIDE;
  return BEAT_LAB_DRUMLOOP_LOOP_BARS;
}
