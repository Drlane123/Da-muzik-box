/**
 * Beat Lab transport — **Studio Editor 2 mirror** (Creation Station only).
 *
 * Do not import `StudioEditor2Screen` or share transport state with SE2.
 * Parity is by matching contracts:
 *
 * | SE2 | Beat Lab |
 * |-----|----------|
 * | `AUDIO_START_FLOOR_SEC` | `SE2_AUDIO_START_FLOOR_SEC` |
 * | `METRO_SCHEDULE_AHEAD_SEC` (3s) | `CREATION_SCHEDULE_AHEAD_SEC` |
 * | `updateSchedAnchor` + `smoothSchedNow` | same (`se2TransportClock`) |
 * | `animationTick` `b` / `bDisplay` split | `creationTransportOnFrame` + `useCreationTransportPump` |
 * | `launchWapiAnims` pause→seek→play | `launchCreationPlaylineWapi` |
 * | `refillMetronome` chain from `ctSnap` | `refillCreationMetronome` |
 * | 25ms lookahead interval | `CREATION_LOOKAHEAD_INTERVAL_MS` |
 */

import type { MutableRefObject } from 'react';

import {
  CREATION_LOOP_CHAIN_FLOOR_SEC,
  CREATION_MAX_CATCHUP_QUARTERS_PER_REFILL,
  CREATION_MAX_SCHEDULE_PER_CALL,
  CREATION_METRO_NODE_EPS_SEC,
  CREATION_SCHEDULE_AHEAD_SEC,
  SE2_AUDIO_START_FLOOR_SEC,
} from '@/app/lib/creationStation/creationTransportSystem';
import { beatAtSessionTime } from '@/app/lib/creationStation/creationTransportSync';
import {
  beatFromCreationPlaylineWapiAnim,
  type CreationPlaylineWapiSegState,
} from '@/app/lib/creationStation/creationPlaylineWapi';
import { smoothSchedNow, updateSchedAnchor } from '@/app/lib/studio/se2TransportClock';

export {
  CREATION_LOOP_CHAIN_FLOOR_SEC,
  CREATION_MAX_CATCHUP_QUARTERS_PER_REFILL,
  CREATION_MAX_SCHEDULE_PER_CALL,
  CREATION_METRO_NODE_EPS_SEC,
  CREATION_SCHEDULE_AHEAD_SEC,
  SE2_AUDIO_START_FLOOR_SEC,
  beatAtSessionTime,
  beatFromCreationPlaylineWapiAnim,
  smoothSchedNow,
  updateSchedAnchor,
};

/** Beat Lab lookahead pump cadence — same as SE2 transport tick (~25ms). */
export const BEAT_LAB_LOOKAHEAD_INTERVAL_MS = 25;

export type BeatLabSchedAnchorRefs = {
  schedAnchorTimeRef: MutableRefObject<number>;
  schedAnchorPerfRef: MutableRefObject<number>;
};

/**
 * SE2 `animationTick` display beat (`bDisplay`) — audio clock extrapolated via sched anchor.
 * Call `updateSchedAnchor` on the same RAF frame before this when transport is running.
 */
export function beatLabDisplayBeatFromAudioClock(
  ctx: AudioContext,
  anchors: BeatLabSchedAnchorRefs,
  sessionStart: number,
  originBeat: number,
  bpm: number,
  totalBeats = Number.POSITIVE_INFINITY,
): number {
  const t =
    anchors.schedAnchorTimeRef.current > 0
      ? smoothSchedNow(anchors.schedAnchorTimeRef, anchors.schedAnchorPerfRef, ctx)
      : Math.max(0, ctx.currentTime);
  const b = beatAtSessionTime(t, sessionStart, originBeat, bpm);
  return Math.max(0, Math.min(totalBeats, b));
}

/**
 * SE2 `animationTick` visual beat (`b`) — compositor WAAPI when running; else audio display beat.
 */
export function beatLabVisualBeatFromWapi(
  animMs: number,
  seg: CreationPlaylineWapiSegState,
  bpm: number,
  fallbackBeat: number,
): number {
  if (!Number.isFinite(animMs) || animMs < 0) return fallbackBeat;
  return beatFromCreationPlaylineWapiAnim(animMs, seg, bpm);
}

/** Same as SE2 `audioNow(ctx)`. */
export function beatLabAudioNow(ctx: AudioContext): number {
  return Math.max(0, ctx.currentTime);
}

export type BeatLabSeamlessLoopSpliceRefs = BeatLabSchedAnchorRefs & {
  sessionStartRef: MutableRefObject<number>;
  originBeatRef: MutableRefObject<number>;
  nextMetroKRef: MutableRefObject<number>;
  cursorBeatRef: MutableRefObject<number>;
  displayBeatRef: MutableRefObject<number>;
  perfSessionStartMsRef: MutableRefObject<number>;
};

/**
 * SE2 `animationTick` seamless-loop cycle bump — re-anchor session + origin from WAAPI phase
 * and audio `smoothSchedNow` (no metronome cancel; Beat Lab refill uses `loopContinuation`).
 */
export function applyBeatLabSeamlessLoopSplice(
  ctx: AudioContext,
  seg: CreationPlaylineWapiSegState,
  animMs: number,
  bpm: number,
  refs: BeatLabSeamlessLoopSpliceRefs,
): number {
  const d = Math.max(1e-9, seg.durMs);
  const span = seg.loopEndBeat - seg.loopStartBeat;
  const phaseMs = ((animMs % d) + d) % d;
  const bVis = Math.max(
    seg.loopStartBeat,
    Math.min(seg.loopEndBeat, seg.loopStartBeat + (phaseMs / d) * span),
  );

  const tCapture = beatLabAudioNow(ctx);
  refs.sessionStartRef.current = tCapture + SE2_AUDIO_START_FLOOR_SEC;
  refs.schedAnchorTimeRef.current = tCapture;
  refs.schedAnchorPerfRef.current = performance.now();
  refs.perfSessionStartMsRef.current =
    performance.now() + SE2_AUDIO_START_FLOOR_SEC * 1000;

  const rate = Math.max(1, bpm) / 60;
  let bDisplay = bVis;
  if (refs.schedAnchorTimeRef.current > 0) {
    const tSmoothSnap = smoothSchedNow(
      refs.schedAnchorTimeRef,
      refs.schedAnchorPerfRef,
      ctx,
    );
    refs.originBeatRef.current =
      bVis - (tSmoothSnap - refs.sessionStartRef.current) * rate;
    bDisplay = beatAtSessionTime(
      tSmoothSnap,
      refs.sessionStartRef.current,
      refs.originBeatRef.current,
      bpm,
    );
  } else {
    refs.originBeatRef.current = bVis;
  }

  refs.nextMetroKRef.current = Math.ceil(bVis - 1e-8);
  refs.cursorBeatRef.current = bVis;
  refs.displayBeatRef.current = bDisplay;
  return bDisplay;
}
