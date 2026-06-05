/**
 * Beat Lab transport — single SE2 mirror (`StudioEditor2Screen` ~6229–6285).
 * rAF visual tick (WAAPI read in `creationTransportOnFrameRef`) + 25 ms audio refill.
 */
import { useEffect } from 'react';

import {
  BEAT_LAB_LOOKAHEAD_INTERVAL_MS,
  beatLabAudioNow,
} from '@/app/lib/creationStation/beatLabSe2TransportEngine';
import { resolveBeatLabAudioContext } from '@/app/lib/creationStation/beatLabStepScheduler';
import { setCreationBeatLabTransportRunning } from '@/app/lib/creationStation/creationTransportSync';
import { updateSchedAnchor } from '@/app/lib/studio/se2TransportClock';

import type {
  CreationTransportPumpOptions,
  CreationTransportPumpRefs,
} from '@/app/hooks/useCreationTransportPump';

export function useBeatLabSe2TransportMirror(
  refs: CreationTransportPumpRefs,
  options: CreationTransportPumpOptions,
): void {
  const {
    ctxRef,
    runningRef,
    sessionStartRef,
    originBeatRef,
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

  /** SE2 `useEffect([running])` — compositor read + HUD via `onFrameRef`. */
  useEffect(() => {
    if (!isScreenActive || !isPlaying) return;
    let transportRaf = 0;
    const transportFrame = () => {
      transportRaf = 0;
      if (!runningRef.current) return;
      try {
        const ctx = resolveBeatLabAudioContext(ctxRef, getOrCreateAudioContext);
        if (ctx.state !== 'closed') {
          if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
          if (
            schedAnchorTimeRef &&
            schedAnchorPerfRef &&
            ctx.state === 'running' &&
            schedAnchorTimeRef.current > 0
          ) {
            updateSchedAnchor(ctx, schedAnchorTimeRef, schedAnchorPerfRef);
          }
        }
        onFrameRef.current(0);
      } catch {
        /* */
      }
      if (runningRef.current) transportRaf = requestAnimationFrame(transportFrame);
    };
    transportRaf = requestAnimationFrame(transportFrame);
    return () => {
      if (transportRaf) cancelAnimationFrame(transportRaf);
    };
  }, [
    isScreenActive,
    isPlaying,
    ctxRef,
    runningRef,
    getOrCreateAudioContext,
    onFrameRef,
    schedAnchorTimeRef,
    schedAnchorPerfRef,
  ]);

  /**
   * SE2 dedicated 25 ms audio loop — gated by `runningRef` + `sessionStartRef`, not React
   * `isPlaying` alone, so Stop can halt lookahead on the same tick (no 5–6× presses).
   */
  useEffect(() => {
    if (!isScreenActive) {
      lastScheduledQuarterRef.current = Number.NEGATIVE_INFINITY;
      setCreationBeatLabTransportRunning(false);
      return;
    }
    const tick = () => {
      if (!runningRef.current || sessionStartRef.current <= 0) {
        setCreationBeatLabTransportRunning(false);
        return;
      }
      const prevCtx = ctxRef.current;
      const ctx = resolveBeatLabAudioContext(ctxRef, getOrCreateAudioContext);
      if (ctx.state === 'closed') return;
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => {});
      }
      if (
        prevCtx &&
        prevCtx !== ctx &&
        prevCtx.state === 'closed' &&
        onAudioContextRebuiltRef?.current
      ) {
        onAudioContextRebuiltRef.current(ctx);
      }
      if (ctx.state !== 'running') return;
      setCreationBeatLabTransportRunning(true);
      const t = beatLabAudioNow(ctx);
      if (perfSessionStartMsRef && sessionStartRef.current > 0) {
        perfSessionStartMsRef.current =
          performance.now() + (sessionStartRef.current - t) * 1000;
      }
      if (schedAnchorTimeRef && schedAnchorPerfRef) {
        schedAnchorTimeRef.current = t;
        schedAnchorPerfRef.current = performance.now();
      }
      refillRef.current(ctx, t);
    };
    if (isPlaying) tick();
    const id = window.setInterval(tick, BEAT_LAB_LOOKAHEAD_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [
    isScreenActive,
    isPlaying,
    ctxRef,
    runningRef,
    sessionStartRef,
    getOrCreateAudioContext,
    refillRef,
    lastScheduledQuarterRef,
    onAudioContextRebuiltRef,
    perfSessionStartMsRef,
    schedAnchorTimeRef,
    schedAnchorPerfRef,
  ]);
}
