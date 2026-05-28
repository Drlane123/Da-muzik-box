import type { MutableRefObject } from 'react';

import { CREATION_PIANO_PLAYLINE_CENTER_X } from '@/app/lib/creationStation/creationPlaylineWapi';
import { SE2_AUDIO_START_FLOOR_SEC } from '@/app/lib/studio/se2TransportClock';
import { grooveLabColFToPx, grooveLabSlotToColF } from '@/app/lib/creationStation/grooveLabTransportSync';
import { grooveLabSecPerSlot } from '@/app/lib/creationStation/grooveLabTransport';

const GROOVE_PLAYLINE_CENTER_X = CREATION_PIANO_PLAYLINE_CENTER_X;

export type GrooveLabPlaylineWapiRefs = {
  animRef: MutableRefObject<Animation | null>;
  wapiSegStateRef?: MutableRefObject<GrooveLabPlaylineWapiSegState>;
};

/** Mirrors Beat Lab `CreationPlaylineWapiSegState` for transport rAF. */
export type GrooveLabPlaylineWapiSegState = {
  durMs: number;
  loopSlots: number;
  snapStep: number;
  seekMs: number;
};

export const GROOVE_PLAYLINE_WAPI_SEG_IDLE: GrooveLabPlaylineWapiSegState = {
  durMs: 0,
  loopSlots: 1,
  snapStep: 1,
  seekMs: 0,
};

const fallbackWapiSegRef: MutableRefObject<GrooveLabPlaylineWapiSegState> = {
  current: { ...GROOVE_PLAYLINE_WAPI_SEG_IDLE },
};

function resolveSegRef(refs: GrooveLabPlaylineWapiRefs): MutableRefObject<GrooveLabPlaylineWapiSegState> {
  return refs.wapiSegStateRef ?? fallbackWapiSegRef;
}

/** Visual slot from compositor `Animation.currentTime` (SE2 `b` / Beat Lab playline). */
export function beatFromGrooveLabPlaylineWapiAnim(
  animMs: number,
  seg: GrooveLabPlaylineWapiSegState,
): number {
  const d = Math.max(1e-9, seg.durMs);
  const phaseMs = ((animMs % d) + d) % d;
  return (phaseMs / d) * Math.max(1, seg.loopSlots);
}

/** Compositor loop segment repeated — same edge test as Beat Lab / SE2. */
export function grooveLabPlaylineWapiLoopWrapped(
  anim: Animation | null,
  prevPhaseMsRef: MutableRefObject<number>,
  cycleSeenRef: MutableRefObject<number>,
): boolean {
  if (!anim) return false;
  const timing = anim.effect?.getComputedTiming?.() ?? anim.effect?.getTiming?.();
  const rawDur = timing?.duration;
  const durMs = typeof rawDur === 'number' ? rawDur : rawDur != null ? Number(rawDur) : NaN;
  if (!Number.isFinite(durMs) || durMs < 16) return false;
  const phaseMs = anim.currentTime ?? 0;
  const prev = prevPhaseMsRef.current;
  const cycle = Math.floor(phaseMs / durMs);
  const cycleBumped = cycle > cycleSeenRef.current;
  const phaseRewind = prev >= 0 && phaseMs < prev - durMs * 0.25;
  prevPhaseMsRef.current = phaseMs;
  if (cycleBumped || phaseRewind) {
    if (phaseRewind && !cycleBumped) {
      cycleSeenRef.current = Math.max(cycleSeenRef.current, cycle);
    } else {
      cycleSeenRef.current = cycle;
    }
    return true;
  }
  return false;
}

export function cancelGrooveLabPlaylineWapi(refs: GrooveLabPlaylineWapiRefs, el: HTMLElement | null): void {
  refs.animRef.current = null;
  if (!el) return;
  el.getAnimations().forEach((a) => a.cancel());
  el.style.removeProperty('will-change');
}

export type GrooveLabPlaylineWapiOpts = {
  el: HTMLElement | null;
  slotNow: number;
  play: boolean;
  bpm: number;
  loopSlots: number;
  snapStep: number;
  pxPerCol: number;
  /** Delay WAAPI `play` to match `sessionStart` (SE2 floor). Beat Lab transport uses `immediateCompositorStart` instead. */
  audioStartLeadSec?: number;
  immediateCompositorStart?: boolean;
};

/**
 * Compositor playline — pause → seek → play (Beat Lab / SE2 contract).
 * No visual lead on transport — audio uses real grid slot.
 */
export function launchGrooveLabPlaylineWapi(refs: GrooveLabPlaylineWapiRefs, o: GrooveLabPlaylineWapiOpts): void {
  const { el, slotNow, play, bpm, loopSlots, snapStep, pxPerCol } = o;
  const wapiSegStateRef = resolveSegRef(refs);
  cancelGrooveLabPlaylineWapi(refs, el);
  if (!el) return;

  el.style.removeProperty('transform');
  if (play) el.style.willChange = 'transform';
  else el.style.removeProperty('will-change');

  const totalCols = Math.max(1, Math.ceil(loopSlots / Math.max(1, snapStep)));
  if (totalCols <= 1) {
    el.style.transform = `translate3d(${-GROOVE_PLAYLINE_CENTER_X}px, 0, 0)`;
    wapiSegStateRef.current = { ...GROOVE_PLAYLINE_WAPI_SEG_IDLE, loopSlots };
    return;
  }

  const secPerSlot = grooveLabSecPerSlot(bpm);
  const loopSec = Math.max(secPerSlot, loopSlots * secPerSlot);
  const durationMs = Math.max(16, loopSec * 1000);
  const xEnd = (totalCols - 1) * pxPerCol;
  const colF = grooveLabSlotToColF(slotNow, snapStep);
  const seekRatio = Math.min(1, Math.max(0, colF / Math.max(totalCols - 1, 1e-9)));
  const seekMs = seekRatio * durationMs;
  const playDelayMs =
    play && !o.immediateCompositorStart
      ? Math.max(0, (o.audioStartLeadSec ?? SE2_AUDIO_START_FLOOR_SEC) * 1000)
      : 0;

  wapiSegStateRef.current = {
    durMs: durationMs,
    loopSlots,
    snapStep,
    seekMs,
  };

  el.getAnimations().forEach((a) => a.cancel());
  const anim = el.animate(
    [
      { transform: `translate3d(${-GROOVE_PLAYLINE_CENTER_X}px, 0, 0)` },
      { transform: `translate3d(${xEnd - GROOVE_PLAYLINE_CENTER_X}px, 0, 0)` },
    ],
    { duration: durationMs, delay: playDelayMs, easing: 'linear', fill: 'forwards', iterations: Infinity },
  );
  anim.pause();
  anim.currentTime = Math.min(Math.max(seekMs, 0), durationMs);
  if (play) {
    anim.play();
    void el.offsetWidth;
  }
  refs.animRef.current = anim;
}

/** Re-seek running WAAPI without cancel/rebuild (post-`ensureCtx` lock). */
export function seekRunningGrooveLabPlaylineWapi(
  refs: GrooveLabPlaylineWapiRefs,
  slotNow: number,
  bpm: number,
  snapStep: number,
): void {
  const seg = resolveSegRef(refs).current;
  const anim = refs.animRef.current;
  if (!anim || anim.playState === 'idle' || seg.durMs <= 0) return;
  const totalCols = Math.max(1, Math.ceil(seg.loopSlots / Math.max(1, snapStep)));
  const colF = grooveLabSlotToColF(slotNow, snapStep);
  const seekRatio = Math.min(1, Math.max(0, colF / Math.max(totalCols - 1, 1e-9)));
  const seekMs = seekRatio * seg.durMs;
  const sm = Math.min(Math.max(seekMs, 0), seg.durMs);
  anim.pause();
  anim.currentTime = sm;
  anim.play();
  seg.seekMs = sm;
}

/** Imperative snap when stopped, paused, or scrubbing (WAAPI not running). */
export function setGrooveLabPlaylineTransformStatic(o: Omit<GrooveLabPlaylineWapiOpts, 'play' | 'bpm'>): void {
  const { el, slotNow, loopSlots, snapStep, pxPerCol } = o;
  if (!el) return;
  el.getAnimations().forEach((a) => a.cancel());
  el.style.removeProperty('will-change');
  const colF = grooveLabSlotToColF(slotNow, snapStep);
  const x = grooveLabColFToPx(colF, pxPerCol);
  el.style.transform = `translate3d(${x - GROOVE_PLAYLINE_CENTER_X}px, 0, 0)`;
}
