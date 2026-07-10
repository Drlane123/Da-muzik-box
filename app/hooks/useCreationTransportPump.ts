import { useEffect } from 'react';
import type { MutableRefObject, RefObject } from 'react';

import {
  BEAT_LAB_LOOKAHEAD_INTERVAL_MS,
  beatLabDisplayBeatFromAudioClock,
} from '@/app/lib/creationStation/beatLabSe2TransportEngine';
import { resolveBeatLabAudioContext } from '@/app/lib/creationStation/beatLabStepScheduler';
import { updateSchedAnchor } from '@/app/lib/studio/se2TransportClock';

const fallbackSchedAnchorTimeRef = { current: 0 };
const fallbackSchedAnchorPerfRef = { current: 0 };

export type CreationTransportPumpRefs = {
  ctxRef: RefObject<AudioContext | null>;
  runningRef: MutableRefObject<boolean>;
  sessionStartRef: MutableRefObject<number>;
  originBeatRef: MutableRefObject<number>;
  displayBeatRef: MutableRefObject<number>;
  bpmRef: MutableRefObject<number>;
  lastScheduledQuarterRef: MutableRefObject<number>;
  schedAnchorTimeRef?: MutableRefObject<number>;
  schedAnchorPerfRef?: MutableRefObject<number>;
  totalBeatsRef?: MutableRefObject<number>;
  perfSessionStartMsRef?: MutableRefObject<number>;
};

export type CreationTransportPumpOptions = {
  isScreenActive: boolean;
  isPlaying: boolean;
  getOrCreateAudioContext: () => AudioContext;
  refillRef: MutableRefObject<(ctx: AudioContext, ctSnap: number) => void>;
  /** Beat Lab recomputes inside `onFrame`; Chord Builder / 808 use the passed `bDisplay`. */
  onFrameRef: MutableRefObject<(bDisplay: number) => void>;
  onAudioContextRebuiltRef?: MutableRefObject<((ctx: AudioContext) => void) | undefined>;
  /** Beat Lab — keep master-clock oscillator MET off while local buffer-click lookahead runs. */
  stopMasterMetronomeLoop?: () => void;
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
    totalBeatsRef,
    perfSessionStartMsRef,
  } = refs;
  const {
    isScreenActive,
    isPlaying,
    getOrCreateAudioContext,
    refillRef,
    onFrameRef,
    onAudioContextRebuiltRef,
  } = options;

  /** SE2: visual rAF only while transport is running (not while screen is merely open). */
  useEffect(() => {
    if (!isScreenActive || !isPlaying) return;
    let raf = 0;
    const tick = () => {
      if (!runningRef.current) {
        raf = 0;
        return;
      }
      const ctx = resolveBeatLabAudioContext(ctxRef, getOrCreateAudioContext);
      if (ctx.state !== 'closed') {
        if (ctx.state === 'suspended') {
          void ctx.resume().catch(() => {});
        }
        const sat = schedAnchorTimeRef ?? fallbackSchedAnchorTimeRef;
        const sap = schedAnchorPerfRef ?? fallbackSchedAnchorPerfRef;
        if (schedAnchorTimeRef && schedAnchorPerfRef && ctx.state === 'running') {
          updateSchedAnchor(ctx, sat, sap);
        }
        const tb = totalBeatsRef?.current ?? Number.POSITIVE_INFINITY;
        const bDisplay = beatLabDisplayBeatFromAudioClock(
          ctx,
          { schedAnchorTimeRef: sat, schedAnchorPerfRef: sap },
          sessionStartRef.current,
          originBeatRef.current,
          bpmRef.current,
          tb,
        );
        onFrameRef.current(bDisplay);
      }
      if (runningRef.current) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [
    isScreenActive,
    isPlaying,
    ctxRef,
    runningRef,
    sessionStartRef,
    originBeatRef,
    displayBeatRef,
    bpmRef,
    onFrameRef,
    schedAnchorTimeRef,
    schedAnchorPerfRef,
    totalBeatsRef,
    getOrCreateAudioContext,
  ]);

  /** SE2: 25 ms audio scheduling loop — only while running. */
  useEffect(() => {
    if (!isScreenActive || !isPlaying) {
      lastScheduledQuarterRef.current = Number.NEGATIVE_INFINITY;
      return;
    }
    const tick = () => {
      if (!runningRef.current) return;
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
      if (perfSessionStartMsRef && sessionStartRef.current > 0) {
        perfSessionStartMsRef.current =
          performance.now() + (sessionStartRef.current - t) * 1000;
      }
      const runRefill = () => {
        if (!runningRef.current || ctx.state === 'closed') return;
        refillRef.current(ctx, Math.max(0, ctx.currentTime));
      };
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => {});
      }
      runRefill();
    };
    tick();
    const id = window.setInterval(tick, BEAT_LAB_LOOKAHEAD_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [
    isScreenActive,
    isPlaying,
    ctxRef,
    runningRef,
    getOrCreateAudioContext,
    refillRef,
    lastScheduledQuarterRef,
    onAudioContextRebuiltRef,
    perfSessionStartMsRef,
    sessionStartRef,
  ]);
}
