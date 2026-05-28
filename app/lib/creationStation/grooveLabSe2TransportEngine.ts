/**
 * Groove Lab transport — **Studio Editor 2 / Beat Lab mirror** (Groove Lab only).
 *
 * Same contracts as `beatLabSe2TransportEngine.ts`, adapted to slot-based grid timing.
 */

import type { MutableRefObject } from 'react';

import {
  CREATION_LOOP_CHAIN_FLOOR_SEC,
  CREATION_METRO_NODE_EPS_SEC,
  CREATION_SCHEDULE_AHEAD_SEC,
  SE2_AUDIO_START_FLOOR_SEC,
} from '@/app/lib/creationStation/creationTransportSystem';
import {
  beatFromGrooveLabPlaylineWapiAnim,
  type GrooveLabPlaylineWapiSegState,
} from '@/app/lib/creationStation/grooveLabPlaylineWapi';
import { grooveLabOriginBeatFromSlot, grooveLabSecPerSlot } from '@/app/lib/creationStation/grooveLabTransport';
import { loopSlotIndex, slotAtSessionTime } from '@/app/lib/creationStation/grooveLabTransportSync';
import { smoothSchedNow, updateSchedAnchor } from '@/app/lib/studio/se2TransportClock';

export {
  CREATION_LOOP_CHAIN_FLOOR_SEC,
  CREATION_METRO_NODE_EPS_SEC,
  CREATION_SCHEDULE_AHEAD_SEC,
  SE2_AUDIO_START_FLOOR_SEC,
  smoothSchedNow,
  updateSchedAnchor,
};

/** Same as Beat Lab / SE2 transport tick (~25 ms). */
export const GROOVE_LAB_LOOKAHEAD_INTERVAL_MS = 25;

export type GrooveLabSchedAnchorRefs = {
  schedAnchorTimeRef: MutableRefObject<number>;
  schedAnchorPerfRef: MutableRefObject<number>;
};

/** SE2 `animationTick` display slot — audio clock via sched anchor. */
export function grooveLabDisplaySlotFromAudioClock(
  ctx: AudioContext,
  anchors: GrooveLabSchedAnchorRefs,
  sessionStart: number,
  originSlot: number,
  bpm: number,
  loopSlots: number,
): number {
  const t =
    anchors.schedAnchorTimeRef.current > 0
      ? smoothSchedNow(anchors.schedAnchorTimeRef, anchors.schedAnchorPerfRef, ctx)
      : Math.max(0, ctx.currentTime);
  const slot = slotAtSessionTime(t, sessionStart, originSlot, bpm);
  return loopSlotIndex(slot, loopSlots);
}

/** SE2 visual slot — compositor WAAPI when running. */
export function grooveLabVisualSlotFromWapi(
  animMs: number,
  seg: GrooveLabPlaylineWapiSegState,
  fallbackSlot: number,
): number {
  if (!Number.isFinite(animMs) || animMs < 0) return fallbackSlot;
  return beatFromGrooveLabPlaylineWapiAnim(animMs, seg);
}

export function grooveLabAudioNow(ctx: AudioContext): number {
  return Math.max(0, ctx.currentTime);
}

export type GrooveLabSeamlessLoopSpliceRefs = GrooveLabSchedAnchorRefs & {
  sessionStartRef: MutableRefObject<number>;
  originSlotRef: MutableRefObject<number>;
  seekSlotRef: MutableRefObject<number>;
  displaySlotRef: MutableRefObject<number>;
  nextMetroKRef: MutableRefObject<number>;
};

/** SE2 seamless-loop cycle bump — slot grid (infinite pattern loop). */
export function applyGrooveLabSeamlessLoopSplice(
  ctx: AudioContext,
  seg: GrooveLabPlaylineWapiSegState,
  animMs: number,
  bpm: number,
  loopSlots: number,
  refs: GrooveLabSeamlessLoopSpliceRefs,
): number {
  const slotVis = loopSlotIndex(
    beatFromGrooveLabPlaylineWapiAnim(animMs, seg),
    loopSlots,
  );

  const tCapture = grooveLabAudioNow(ctx);
  refs.sessionStartRef.current = tCapture + SE2_AUDIO_START_FLOOR_SEC;
  refs.schedAnchorTimeRef.current = tCapture;
  refs.schedAnchorPerfRef.current = performance.now();

  const secPerSlot = grooveLabSecPerSlot(bpm);
  let displaySlot = slotVis;
  if (refs.schedAnchorTimeRef.current > 0) {
    const tSmoothSnap = smoothSchedNow(
      refs.schedAnchorTimeRef,
      refs.schedAnchorPerfRef,
      ctx,
    );
    refs.originSlotRef.current =
      slotVis - (tSmoothSnap - refs.sessionStartRef.current) / secPerSlot;
    displaySlot = loopSlotIndex(
      slotAtSessionTime(
        tSmoothSnap,
        refs.sessionStartRef.current,
        refs.originSlotRef.current,
        bpm,
      ),
      loopSlots,
    );
  } else {
    refs.originSlotRef.current = slotVis;
  }

  refs.nextMetroKRef.current = Math.ceil(grooveLabOriginBeatFromSlot(slotVis) - 1e-8) - 1;
  refs.seekSlotRef.current = slotVis;
  refs.displaySlotRef.current = displaySlot;
  return displaySlot;
}
