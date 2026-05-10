/**
 * Scheduling-domain clock used by Studio Editor 2 (`animationTick`, `pauseTransport`, 25ms transport tick).
 * Keep this file in lock-step with `StudioEditor2Screen.tsx` comments — Creation Station imports it so both
 * surfaces cannot drift apart.
 */
import type { MutableRefObject } from 'react';

/** @see StudioEditor2Screen `AUDIO_START_FLOOR_SEC` */
export const SE2_AUDIO_START_FLOOR_SEC = 0.008;

export function updateSchedAnchor(
  ctx: AudioContext,
  anchorTimeRef: MutableRefObject<number>,
  anchorPerfRef: MutableRefObject<number>,
): void {
  const t = ctx.currentTime;
  if (t > anchorTimeRef.current) {
    anchorTimeRef.current = t;
    anchorPerfRef.current = performance.now();
  }
}

export function smoothSchedNow(
  anchorTimeRef: MutableRefObject<number>,
  anchorPerfRef: MutableRefObject<number>,
  ctx: AudioContext,
): number {
  if (anchorTimeRef.current > 0) {
    return anchorTimeRef.current + (performance.now() - anchorPerfRef.current) / 1000;
  }
  return Math.max(0, ctx.currentTime);
}
