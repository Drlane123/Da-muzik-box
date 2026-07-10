import type { MutableRefObject } from 'react';

import {
  beatLabSampleDrumLoopBoundary,
  resetBeatLabSampleDrumClock,
  seedBeatLabSampleDrumClock,
  syncBeatLabSampleDrumClockToBeat,
  type BeatLabSampleDrumClockRefs,
  type BeatLabSampleLoopBoundary,
} from '@/app/lib/creationStation/beatLabSampleAccurateDrumClock';
import type { CreationTransportRefillOpts } from '@/app/lib/creationStation/creationTransportSystem';

export {
  BEAT_LAB_RENDER_QUANTUM_SAMPLES,
  beatLabAdvanceSampleDrumQuarter,
  beatLabGridSampleFromBeat,
  beatLabGridTimeFromBeat,
  beatLabGridTimeFromSample,
  beatLabLoopSpanSamples,
  beatLabPhaseCompensateLoopWrap,
  beatLabSampleDrumLoopBoundary,
  beatLabSampleScheduleFloorSec,
  beatLabSamplesPerBeat,
  resetBeatLabSampleDrumClock,
  seedBeatLabSampleDrumClock,
  syncBeatLabSampleDrumClockToBeat,
  type BeatLabSampleDrumClockRefs,
  type BeatLabSampleLoopBoundary,
} from '@/app/lib/creationStation/beatLabSampleAccurateDrumClock';

/** Recreate shared graph when Beat Lab's context was closed (Creation transport pump). */
export function resolveBeatLabAudioContext(
  ctxRef: MutableRefObject<AudioContext | null>,
  getOrCreateAudioContext: () => AudioContext,
): AudioContext {
  const prev = ctxRef.current;
  if (prev && prev.state !== 'closed') return prev;
  const ctx = getOrCreateAudioContext();
  ctxRef.current = ctx;
  return ctx;
}

export type BeatLabSampleDrumTransportOpts = BeatLabSampleDrumClockRefs & {
  sampleRate: number;
  loopBoundary: BeatLabSampleLoopBoundary;
};

/** Attach sample-accurate drum clock opts to a transport refill call. */
export function beatLabSampleDrumRefillOpts(
  ctx: AudioContext,
  sampleRefs: BeatLabSampleDrumClockRefs,
  loopOn: boolean,
  loopStartBeat: number,
  loopEndBeat: number,
  base?: CreationTransportRefillOpts,
): CreationTransportRefillOpts {
  return {
    ...base,
    sampleDrum: {
      sampleRate: ctx.sampleRate,
      nextStepSampleRef: sampleRefs.nextStepSampleRef,
      loopBoundary: beatLabSampleDrumLoopBoundary(loopOn, loopStartBeat, loopEndBeat),
    },
  };
}
