import { useEffect } from 'react';
import type { MutableRefObject, RefObject } from 'react';

import {
  GROOVE_LAB_LOOKAHEAD_INTERVAL_MS,
  grooveLabDisplaySlotFromAudioClock,
  updateSchedAnchor,
} from '@/app/lib/creationStation/grooveLabSe2TransportEngine';
import { setGrooveLabTransportRunning } from '@/app/lib/creationStation/creationTransportSync';
import { tickGrooveLabChannelMeters } from '@/app/lib/creationStation/grooveLabChannelMeters';

const fallbackSchedAnchorTimeRef = { current: 0 };
const fallbackSchedAnchorPerfRef = { current: 0 };

function resolveGrooveLabAudioContext(
  ctxRef: MutableRefObject<AudioContext | null>,
  getOrCreateAudioContext: () => AudioContext | null,
): AudioContext | null {
  const prev = ctxRef.current;
  if (prev && prev.state !== 'closed') return prev;
  const ctx = getOrCreateAudioContext();
  if (!ctx) return null;
  ctxRef.current = ctx;
  return ctx;
}

export type GrooveLabTransportPumpRefs = {
  ctxRef: RefObject<AudioContext | null>;
  runningRef: MutableRefObject<boolean>;
  sessionStartRef: MutableRefObject<number>;
  originSlotRef: MutableRefObject<number>;
  displaySlotRef: MutableRefObject<number>;
  bpmRef: MutableRefObject<number>;
  loopSlotsRef: MutableRefObject<number>;
  schedAnchorTimeRef?: MutableRefObject<number>;
  schedAnchorPerfRef?: MutableRefObject<number>;
};

export type GrooveLabTransportPumpOptions = {
  isScreenActive: boolean;
  getOrCreateAudioContext: () => AudioContext | null;
  refillRef: MutableRefObject<(ctx: AudioContext, ctSnap: number) => void>;
  onFrameRef: MutableRefObject<(displaySlot: number) => void>;
};

/** rAF display slot + 25 ms audio lookahead (mirrors {@link useCreationTransportPump}). */
export function useGrooveLabTransportPump(
  refs: GrooveLabTransportPumpRefs,
  options: GrooveLabTransportPumpOptions,
): void {
  const {
    ctxRef,
    runningRef,
    sessionStartRef,
    originSlotRef,
    displaySlotRef,
    bpmRef,
    loopSlotsRef,
    schedAnchorTimeRef,
    schedAnchorPerfRef,
  } = refs;
  const { isScreenActive, getOrCreateAudioContext, refillRef, onFrameRef } = options;

  useEffect(() => {
    if (!isScreenActive) return;
    let raf = 0;
    const tick = () => {
      const ctx =
        ctxRef.current && ctxRef.current.state !== 'closed' ? ctxRef.current : null;
      if (ctx) {
        tickGrooveLabChannelMeters(ctx.currentTime, runningRef.current);
      }
      if (runningRef.current && ctx) {
        setGrooveLabTransportRunning(true);
        if (ctx.state === 'suspended') {
          void ctx.resume().catch(() => {});
        }
        const sat = schedAnchorTimeRef ?? fallbackSchedAnchorTimeRef;
        const sap = schedAnchorPerfRef ?? fallbackSchedAnchorPerfRef;
        if (schedAnchorTimeRef && schedAnchorPerfRef) {
          updateSchedAnchor(ctx, sat, sap);
        }
        const displaySlot = grooveLabDisplaySlotFromAudioClock(
          ctx,
          { schedAnchorTimeRef: sat, schedAnchorPerfRef: sap },
          sessionStartRef.current,
          originSlotRef.current,
          bpmRef.current,
          loopSlotsRef.current,
        );
        displaySlotRef.current = displaySlot;
        onFrameRef.current(displaySlot);
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
    originSlotRef,
    displaySlotRef,
    bpmRef,
    loopSlotsRef,
    onFrameRef,
    schedAnchorTimeRef,
    schedAnchorPerfRef,
  ]);

  useEffect(() => {
    if (!isScreenActive) return;
    const tick = () => {
      if (!runningRef.current) return;
      setGrooveLabTransportRunning(true);
      const ctx = resolveGrooveLabAudioContext(
        ctxRef as MutableRefObject<AudioContext | null>,
        getOrCreateAudioContext,
      );
      if (!ctx || ctx.state === 'closed') return;
      const t = Math.max(0, ctx.currentTime);
      if (schedAnchorTimeRef && schedAnchorPerfRef) {
        schedAnchorTimeRef.current = t;
        schedAnchorPerfRef.current = performance.now();
      }
      const runRefill = () => {
        if (!runningRef.current || ctx.state === 'closed') return;
        refillRef.current(ctx, Math.max(0, ctx.currentTime));
      };
      if (ctx.state === 'suspended') {
        void ctx.resume().then(runRefill).catch(() => {
          if (ctx.state === 'running') runRefill();
        });
        return;
      }
      runRefill();
    };
    tick();
    const id = window.setInterval(tick, GROOVE_LAB_LOOKAHEAD_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [isScreenActive, ctxRef, runningRef, getOrCreateAudioContext, refillRef, schedAnchorTimeRef, schedAnchorPerfRef]);
}
