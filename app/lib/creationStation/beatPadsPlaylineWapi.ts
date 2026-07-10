/**
 * Beat Pads overlay — compositor play line (Groove Lab / SE2 WAAPI mirror).
 * Linear infinite loop over grid columns (16 or 32 steps per bar).
 */
import type { MutableRefObject } from 'react';

import {
  BEAT_PADS_STEPS_PER_BAR,
  beatPadsStepDurationSec,
  type BeatPadsGridStepsPerBar,
} from '@/app/lib/creationStation/beatLabDrumMachineSequencer';
import { SE2_AUDIO_START_FLOOR_SEC } from '@/app/lib/studio/se2TransportClock';

/** 2px playline — WAAPI translate targets the **left edge** of each step column (beat start). */
export const BEAT_PADS_PLAYLINE_W_PX = 2;

/** Must match {@link BeatLabDrumMachineSequencer} `COL_W`. */
export const BEAT_PADS_GRID_COL_W = 16;

/** @deprecated Left-edge alignment — kept for import stability. */
export const BEAT_PADS_PLAYLINE_CENTER_X = 0;

export type BeatPadsPlaylineWapiSegState = {
  durMs: number;
  cols: number;
  seekMs: number;
};

export const BEAT_PADS_PLAYLINE_WAPI_SEG_IDLE: BeatPadsPlaylineWapiSegState = {
  durMs: 0,
  cols: 1,
  seekMs: 0,
};

export type BeatPadsPlaylineWapiRefs = {
  animRef: MutableRefObject<Animation | null>;
  wapiSegStateRef: MutableRefObject<BeatPadsPlaylineWapiSegState>;
};

export function beatPadsPlaylineXForCol(colF: number, colW: number): number {
  const cw = Math.max(1, colW);
  return colF * cw;
}

/** Park compositor playline at a grid column (step 0 = loop start). */
export function setBeatPadsPlaylineAtCol(
  el: HTMLElement | null,
  colF: number,
  colW: number,
): void {
  if (!el) return;
  el.style.transform = `translate3d(${beatPadsPlaylineXForCol(colF, colW)}px, 0, 0)`;
}

export function resetBeatPadsPlaylineToStart(el: HTMLElement | null, colW: number): void {
  setBeatPadsPlaylineAtCol(el, 0, colW);
}

export function beatPadsPlayColFFromWapiAnim(
  animMs: number,
  seg: BeatPadsPlaylineWapiSegState,
): number {
  const d = Math.max(1e-9, seg.durMs);
  const phaseMs = ((animMs % d) + d) % d;
  const cols = Math.max(1, seg.cols);
  const colF = (phaseMs / d) * cols;
  return colF >= cols ? 0 : colF;
}

/** True when the compositor playline just wrapped to loop start. */
export function beatPadsPlaylineWapiLoopWrapped(
  anim: Animation | null,
  prevPhaseMsRef: { current: number },
  cycleSeenRef: { current: number },
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

export function cancelBeatPadsPlaylineWapi(refs: BeatPadsPlaylineWapiRefs, el: HTMLElement | null): void {
  const anim = refs.animRef.current;
  refs.animRef.current = null;
  if (anim) {
    try {
      anim.cancel();
    } catch {
      /* already cancelled */
    }
  }
  if (!el) return;
  el.getAnimations().forEach((a) => a.cancel());
  el.style.removeProperty('will-change');
  resetBeatPadsPlaylineToStart(el, BEAT_PADS_GRID_COL_W);
}

export type BeatPadsPlaylineWapiOpts = {
  el: HTMLElement | null;
  colNow: number;
  play: boolean;
  bpm: number;
  cols: number;
  colW: number;
  stepsPerBar?: BeatPadsGridStepsPerBar;
  immediateCompositorStart?: boolean;
  audioStartLeadSec?: number;
};

/** Pause → seek → play — same contract as Groove Lab / Beat Lab transport. */
export function launchBeatPadsPlaylineWapi(
  refs: BeatPadsPlaylineWapiRefs,
  o: BeatPadsPlaylineWapiOpts,
): void {
  const { el, colNow, play, bpm, cols, colW } = o;
  cancelBeatPadsPlaylineWapi(refs, el);
  if (!el) return;

  if (play) el.style.willChange = 'transform';
  else el.style.removeProperty('will-change');

  const totalCols = Math.max(1, Math.round(cols));
  if (totalCols <= 1) {
    el.style.transform = `translate3d(${beatPadsPlaylineXForCol(0, colW)}px, 0, 0)`;
    refs.wapiSegStateRef.current = { ...BEAT_PADS_PLAYLINE_WAPI_SEG_IDLE, cols: totalCols };
    return;
  }

  const stepsPerBar = o.stepsPerBar ?? BEAT_PADS_STEPS_PER_BAR;
  const stepSec = beatPadsStepDurationSec(bpm, stepsPerBar);
  const loopSec = Math.max(stepSec, totalCols * stepSec);
  const durationMs = Math.max(16, loopSec * 1000);
  const x0 = beatPadsPlaylineXForCol(0, colW);
  const xEnd = beatPadsPlaylineXForCol(totalCols, colW);
  const clampedCol = Math.min(Math.max(0, colNow), totalCols - 1);
  const seekRatio = clampedCol / Math.max(totalCols, 1);
  const seekMs = seekRatio * durationMs;
  const playDelayMs =
    play && !o.immediateCompositorStart
      ? Math.max(0, (o.audioStartLeadSec ?? SE2_AUDIO_START_FLOOR_SEC) * 1000)
      : 0;

  refs.wapiSegStateRef.current = {
    durMs: durationMs,
    cols: totalCols,
    seekMs,
  };

  el.getAnimations().forEach((a) => a.cancel());
  const anim = el.animate(
    [
      { transform: `translate3d(${x0}px, 0, 0)` },
      { transform: `translate3d(${xEnd}px, 0, 0)` },
    ],
    {
      duration: durationMs,
      delay: playDelayMs,
      easing: 'linear',
      fill: 'forwards',
      iterations: Infinity,
    },
  );
  anim.pause();
  anim.currentTime = Math.min(Math.max(seekMs, 0), durationMs);
  if (play) {
    anim.play();
    void el.offsetWidth;
  } else {
    el.style.transform = `translate3d(${beatPadsPlaylineXForCol(clampedCol, colW)}px, 0, 0)`;
  }
  refs.animRef.current = anim;
}

export function relaunchBeatPadsPlaylineWapiForBpm(
  refs: BeatPadsPlaylineWapiRefs,
  o: Omit<BeatPadsPlaylineWapiOpts, 'colNow'> & { colF: number },
): void {
  if (!refs.animRef.current || refs.animRef.current.playState !== 'running') return;
  const seg = refs.wapiSegStateRef.current;
  const colNow = beatPadsPlayColFFromWapiAnim(refs.animRef.current.currentTime ?? seg.seekMs, seg);
  launchBeatPadsPlaylineWapi(refs, { ...o, colNow: Math.round(colNow) });
  if (o.play && refs.animRef.current) {
    const nextSeg = refs.wapiSegStateRef.current;
    const ratio = colNow / Math.max(nextSeg.cols, 1);
    refs.animRef.current.currentTime = ratio * nextSeg.durMs;
    refs.animRef.current.play();
  }
}
