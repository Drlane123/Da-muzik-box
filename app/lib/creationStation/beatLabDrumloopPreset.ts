/**
 * DrumloopAI-style Beat Lab grid: 4/4, 1/16 steps, short loop, full grid + fit.
 * @see https://www.drumloopai.com — interactive 16th-note step sequencer feel.
 */

import { PIANO_SNAP_SUBDIV_DEFAULT } from '@/app/lib/sharedPianoSnapSubdiv';

/** Cells per quarter → 1/16 (16 steps per 4/4 bar). */
export const BEAT_LAB_DRUMLOOP_SNAP_SUBDIV = PIANO_SNAP_SUBDIV_DEFAULT;

/** Default loop length matching Drumloop-style 4-bar patterns. */
export const BEAT_LAB_DRUMLOOP_LOOP_BARS = 4;

/** Classic one-bar / 16-step machine view. */
export const BEAT_LAB_DRUMLOOP_LOOP_BARS_CLASSIC = 1;

/** Two-bar hook / half-phrase before doubling to 4 or 8. */
export const BEAT_LAB_DRUMLOOP_LOOP_BARS_HALF = 2;

export type BeatLabDrumloopPresetVariant = '4bar' | '2bar' | '1bar';

export function drumloopLoopBarsForVariant(v: BeatLabDrumloopPresetVariant): number {
  if (v === '1bar') return BEAT_LAB_DRUMLOOP_LOOP_BARS_CLASSIC;
  if (v === '2bar') return BEAT_LAB_DRUMLOOP_LOOP_BARS_HALF;
  return BEAT_LAB_DRUMLOOP_LOOP_BARS;
}
