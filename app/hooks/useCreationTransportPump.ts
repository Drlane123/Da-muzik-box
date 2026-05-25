import { useEffect } from 'react';
import type { MutableRefObject, RefObject } from 'react';

import { resolveBeatLabAudioContext } from '@/app/lib/creationStation/beatLabStepScheduler';
import {
  beatAtSessionTime,
  setCreationBeatLabTransportRunning,
} from '@/app/lib/creationStation/creationTransportSync';
import { smoothSchedNow, updateSchedAnchor } from '@/app/lib/studio/se2TransportClock';

/** Must match `creationTransportSystem` lookahead cadence (DAW sync rules). */
const CREATION_LOOKAHEAD_INTERVAL_MS = 25;

const fallbackSchedAnchorTimeRef = { current: 0 };
const fallbackSchedAnchorPerfRef = { current: 0 };

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
  /** Optional — Beat Lab passes these for `smoothSchedNow`; other screens omit. */
  schedAnchorTimeRef?: MutableRefObject<number>;
  schedAnchorPerfRef?: MutableRefObject<number>;
};

export type CreationTransportPumpOptions = {
  isScreenActive: boolean;
  isPlaying: boolean;
  getOrCreateAudioContext: () => AudioContext;
  /** Same pattern as `refillCreationScheduleRef` — always latest `(ctx, ctSnap) => void`. */
  refillRef: MutableRefObject<(ctx: AudioContext, ctSnap: number) => void>;
  /** Invoked every rAF while audio is running; playline + HUD + React churn live here only. */
  onFrameRef: MutableRefObject<(bDisplay: number) => void>;
  /** When the shared graph is rebuilt after `closed`, re-anchor transport + refill lookahead. */
  onAudioContextRebuiltRef?: MutableRefObject<((ctx: AudioContext) => void) | undefined>;
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
    schedAnchorTimeRef,
    schedAnchorPerfRef,
  } = refs;
  const { isScreenActive, getOrCreateAudioContext, refillRef, onFrameRef, onAudioContextRebuiltRef } =
    options;

  useEffect(() => {
    if (!isScreenActive) return;
    let raf = 0;
    const tick = () => {
      const ctx =
        ctxRef.current && ctxRef.current.state !== 'closed'
          ? ctxRef.current
          : null;
      if (runningRef.current && ctx && ctx.state !== 'closed') {
        setCreationBeatLabTransportRunning(true);
        if (ctx.state === 'suspended') {
          void ctx.resume().catch(() => {});
        }
        const sat = schedAnchorTimeRef ?? fallbackSchedAnchorTimeRef;
        const sap = schedAnchorPerfRef ?? fallbackSchedAnchorPerfRef;
        if (schedAnchorTimeRef && schedAnchorPerfRef) {
          updateSchedAnchor(ctx, sat, sap);
        }
        const t =
          schedAnchorTimeRef && sat.current > 0
            ? smoothSchedNow(sat, sap, ctx)
            : Math.max(0, ctx.currentTime);
        const b = beatAtSessionTime(t, sessionStartRef.current, originBeatRef.current, bpmRef.current);
        onFrameRef.current(b);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [
    isScreenActive,
    ctxRef,
    runningRef,
    sessionStartRef,
    originBeatRef,
    displayBeatRef,
    bpmRef,
    onFrameRef,
    schedAnchorTimeRef,
    schedAnchorPerfRef,
  ]);

  /**
   * Lookahead refill while `runningRef` is true — do not gate on React `isPlaying` alone;
   * `startTransport` sets `runningRef` before `setTransport('playing')`, and a stale
   * `isPlaying` effect teardown clears the interval and leaves ~3s of audio then silence.
   */
  useEffect(() => {
    if (!isScreenActive) {
      lastScheduledQuarterRef.current = Number.NEGATIVE_INFINITY;
      return;
    }
    const tick = () => {
      if (!runningRef.current) return;
      setCreationBeatLabTransportRunning(true);
      const prevCtx = ctxRef.current;
      const ctx = resolveBeatLabAudioContext(ctxRef, getOrCreateAudioContext);
      if (ctx.state === 'closed') return;
      if (
        prevCtx &&
        prevCtx !== ctx &&
        prevCtx.state === 'closed' &&
        onAudioContextRebuiltRef?.current
      ) {
        onAudioContextRebuiltRef.current(ctx);
      }
      const t = Math.max(0, ctx.currentTime);
      if (schedAnchorTimeRef && schedAnchorPerfRef) {
        schedAnchorTimeRef.current = t;
        schedAnchorPerfRef.current = performance.now();
      }
      const runRefill = () => {
        if (!runningRef.current || ctx.state === 'closed') return;
        /** Schedule ahead even while suspended — events queue and play on resume (skipping refill caused ~3s gaps). */
        refillRef.current(ctx, Math.max(0, ctx.currentTime));
      };
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => {});
      }
      runRefill();
    };
    tick();
    const id = window.setInterval(tick, CREATION_LOOKAHEAD_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [
    isScreenActive,
    ctxRef,
    runningRef,
    getOrCreateAudioContext,
    refillRef,
    lastScheduledQuarterRef,
    onAudioContextRebuiltRef,
  ]);

}
