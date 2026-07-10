/**
 * Sample-accurate drum step clock for Beat Lab.
 *
 * Loop boundaries and grid lines are computed in **integer audio samples** (not
 * floating seconds) so loop wraps preserve sub-sample phase — the same contract as
 * a hardware buffer callback sequencer:
 *
 * - `nextBeatSample = round(beatIndex × samplesPerBeat)` on the session grid
 * - on loop wrap: subtract `totalLoopSamples` (do **not** zero the clock)
 * - schedule floor: at least one render-quantum ahead of `currentTime`
 */

import type { MutableRefObject } from 'react';

/** Web Audio default render quantum — minimum one-buffer lookahead. */
export const BEAT_LAB_RENDER_QUANTUM_SAMPLES = 128;

export type BeatLabSampleLoopBoundary = {
  loopOn: boolean;
  loopStartBeat: number;
  loopEndBeat: number;
};

export type BeatLabSampleDrumClockRefs = {
  nextStepSampleRef: MutableRefObject<number>;
};

export function beatLabSamplesPerBeat(bpm: number, sampleRate: number): number {
  return (60 / Math.max(1, bpm)) * sampleRate;
}

export function beatLabLoopSpanSamples(
  loopSpanBeats: number,
  bpm: number,
  sampleRate: number,
): number {
  return Math.round(Math.max(1, loopSpanBeats) * beatLabSamplesPerBeat(bpm, sampleRate));
}

/** Absolute sample index for quarter `k` on the live session grid. */
export function beatLabGridSampleFromBeat(
  sessionStartSec: number,
  originBeat: number,
  k: number,
  bpm: number,
  sampleRate: number,
): number {
  const sessionStartSample = Math.round(sessionStartSec * sampleRate);
  const beatOffset = k - originBeat;
  return sessionStartSample + Math.round(beatOffset * beatLabSamplesPerBeat(bpm, sampleRate));
}

export function beatLabGridTimeFromSample(sampleIndex: number, sampleRate: number): number {
  return sampleIndex / sampleRate;
}

export function beatLabGridTimeFromBeat(
  sessionStartSec: number,
  originBeat: number,
  k: number,
  bpm: number,
  sampleRate: number,
): number {
  return beatLabGridTimeFromSample(
    beatLabGridSampleFromBeat(sessionStartSec, originBeat, k, bpm, sampleRate),
    sampleRate,
  );
}

/** Schedule floor: SE2 chain floor or one render quantum — whichever is later. */
export function beatLabSampleScheduleFloorSec(
  ctSnap: number,
  sampleRate: number,
  chainFloorSec: number,
): number {
  const quantumSec = BEAT_LAB_RENDER_QUANTUM_SAMPLES / Math.max(1, sampleRate);
  return ctSnap + Math.max(chainFloorSec, quantumSec);
}

/**
 * Loop reset via sample subtraction (phase compensation).
 * Do not reset the session clock to zero — subtract exact loop length in samples.
 */
export function beatLabPhaseCompensateLoopWrap(
  k: number,
  nextStepSample: number,
  boundary: BeatLabSampleLoopBoundary,
  bpm: number,
  sampleRate: number,
): { k: number; nextStepSample: number; wrapped: boolean } {
  if (!boundary.loopOn || boundary.loopEndBeat <= boundary.loopStartBeat) {
    return { k, nextStepSample, wrapped: false };
  }
  const ls = Math.floor(boundary.loopStartBeat);
  const le = Math.floor(boundary.loopEndBeat);
  const span = Math.max(1, le - ls);
  if (k < le) return { k, nextStepSample, wrapped: false };

  const laps = Math.floor((k - ls) / span);
  const wrappedK = ls + ((k - ls) % span);
  const loopSamples = beatLabLoopSpanSamples(span, bpm, sampleRate);
  return {
    k: wrappedK,
    nextStepSample: nextStepSample - laps * loopSamples,
    wrapped: true,
  };
}

export function seedBeatLabSampleDrumClock(
  refs: BeatLabSampleDrumClockRefs,
  sessionStartSec: number,
  originBeat: number,
  k: number,
  bpm: number,
  sampleRate: number,
): void {
  refs.nextStepSampleRef.current = beatLabGridSampleFromBeat(
    sessionStartSec,
    originBeat,
    k,
    bpm,
    sampleRate,
  );
}

export function resetBeatLabSampleDrumClock(refs: BeatLabSampleDrumClockRefs): void {
  refs.nextStepSampleRef.current = 0;
}

/** Re-anchor sample grid after seek / loop splice (keeps integer phase). */
export function syncBeatLabSampleDrumClockToBeat(
  refs: BeatLabSampleDrumClockRefs,
  sessionStartSec: number,
  originBeat: number,
  k: number,
  bpm: number,
  sampleRate: number,
): void {
  refs.nextStepSampleRef.current = beatLabGridSampleFromBeat(
    sessionStartSec,
    originBeat,
    k,
    bpm,
    sampleRate,
  );
}

export function beatLabSampleDrumLoopBoundary(
  loopOn: boolean,
  loopStartBeat: number,
  loopEndBeat: number,
): BeatLabSampleLoopBoundary {
  return { loopOn, loopStartBeat, loopEndBeat };
}

/**
 * Advance one quarter on the sample grid.
 * `k` stays monotonic (global quarter index) — pattern wrap is handled in `fireStepAt`;
 * wrapping `k` here desynced the metronome and tripped `lastScheduledQuarterRef`.
 */
export function beatLabAdvanceSampleDrumQuarter(
  k: number,
  sessionStartSec: number,
  originBeat: number,
  bpm: number,
  sampleRate: number,
): { k: number; nextStepSample: number; tGrid: number } {
  const nextK = k + 1;
  const nextSample = beatLabGridSampleFromBeat(
    sessionStartSec,
    originBeat,
    nextK,
    bpm,
    sampleRate,
  );
  return {
    k: nextK,
    nextStepSample: nextSample,
    tGrid: beatLabGridTimeFromSample(nextSample, sampleRate),
  };
}
