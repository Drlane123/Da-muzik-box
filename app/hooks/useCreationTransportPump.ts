import { useEffect } from 'react';
import type { MutableRefObject, RefObject } from 'react';

import { beatAtSessionTime } from '@/app/lib/creationStation/creationTransportSync';

/** Must match `creationTransportSystem` lookahead cadence (DAW sync rules). */
const CREATION_LOOKAHEAD_INTERVAL_MS = 25;

/**
 * **Single** Creation Station transport pump: one `requestAnimationFrame` loop + one `setInterval` for lookahead.
 * Mirrors SE2’s “audio clock drives readouts / lookahead” split: display beat from `ctx.currentTime`
 * (same domain as scheduling). **Does not** import Studio Editor 2 — Creation-only.
 */
export type CreationTransportPumpRefs = {
  ctxRef: RefObject<AudioContext | null>;
  runningRef: MutableRefObject<boolean>;
  sessionStartRef: MutableRefObject<number>;
  originBeatRef: MutableRefObject<number>;
  displayBeatRef: MutableRefObject<number>;
  bpmRef: MutableRefObject<number>;
  lastScheduledQuarterRef: MutableRefObject<number>;
};

export type CreationTransportPumpOptions = {
  isScreenActive: boolean;
  isPlaying: boolean;
  getOrCreateAudioContext: () => AudioContext;
  /** Same pattern as `refillCreationScheduleRef` — always latest `(ctx, ctSnap) => void`. */
  refillRef: MutableRefObject<(ctx: AudioContext, ctSnap: number) => void>;
  /** Invoked every rAF while audio is running; playline + HUD + React churn live here only. */
  onFrameRef: MutableRefObject<(bDisplay: number) => void>;
};

export function useCreationTransportPump(
  refs: CreationTransportPumpRefs,
  options: CreationTransportPumpOptions,
): void {
  const {
    ctxRef,
    runningRef,
    sessionStartRef,
    originBeatRef,
    displayBeatRef,
    bpmRef,
    lastScheduledQuarterRef,
  } = refs;
  const { isScreenActive, isPlaying, getOrCreateAudioContext, refillRef, onFrameRef } = options;

  useEffect(() => {
    if (!isScreenActive) return;
    let raf = 0;
    const tick = () => {
      const ctx = ctxRef.current;
      if (runningRef.current && ctx && ctx.state === 'running') {
        const t = Math.max(0, ctx.currentTime);
        const b = beatAtSessionTime(t, sessionStartRef.current, originBeatRef.current, bpmRef.current);
        displayBeatRef.current = b;
        onFrameRef.current(b);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isScreenActive, ctxRef, runningRef, sessionStartRef, originBeatRef, displayBeatRef, bpmRef, onFrameRef]);

  useEffect(() => {
    if (!isScreenActive || !isPlaying) {
      lastScheduledQuarterRef.current = Number.NEGATIVE_INFINITY;
      return;
    }
    const tick = () => {
      const ctx = ctxRef.current ?? getOrCreateAudioContext();
      if (!ctx || ctx.state === 'closed') return;
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => {});
        return;
      }
      const t = Math.max(0, ctx.currentTime);
      refillRef.current(ctx, t);
    };
    tick();
    const id = window.setInterval(tick, CREATION_LOOKAHEAD_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [
    isScreenActive,
    isPlaying,
    ctxRef,
    getOrCreateAudioContext,
    refillRef,
    lastScheduledQuarterRef,
  ]);
}
