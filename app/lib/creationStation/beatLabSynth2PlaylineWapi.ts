/**
 * NEW SYNTH piano-roll playhead — mirrors {@link grooveLabPlaylineWapi}.
 * One element, forward infinite WAAPI (no Beat Lab loop-segment keyframes).
 */
import type { MutableRefObject } from 'react';

import { beatLabSynthQuarterCellW } from '@/app/lib/creationStation/beatLabChordPianoRollAdapter';
import { CREATION_PIANO_PLAYLINE_CENTER_X } from '@/app/lib/creationStation/creationPlaylineWapi';
import { SE2_AUDIO_START_FLOOR_SEC } from '@/app/lib/studio/se2TransportClock';

const PLAYLINE_CENTER_X = CREATION_PIANO_PLAYLINE_CENTER_X;

export type BeatLabSynth2PlaylineWapiSegState = {
  durMs: number;
  totalBeats: number;
  quarterCols: number;
  seekMs: number;
};

export const BEAT_LAB_SYNTH2_PLAYLINE_WAPI_SEG_IDLE: BeatLabSynth2PlaylineWapiSegState = {
  durMs: 0,
  totalBeats: 1,
  quarterCols: 1,
  seekMs: 0,
};

export type BeatLabSynth2PlaylineWapiRefs = {
  animRef: MutableRefObject<Animation | null>;
  wapiSegStateRef: MutableRefObject<BeatLabSynth2PlaylineWapiSegState>;
};

export function createBeatLabSynth2PlaylineWapiRefs(): BeatLabSynth2PlaylineWapiRefs {
  return {
    animRef: { current: null },
    wapiSegStateRef: { current: { ...BEAT_LAB_SYNTH2_PLAYLINE_WAPI_SEG_IDLE } },
  };
}

/** Fractional quarter column 0 … quarterCols−1 from beat position. */
export function beatLabSynth2BeatToQuarterColF(
  beat: number,
  totalBeats: number,
  quarterCols: number,
): number {
  const tb = Math.max(1e-9, totalBeats);
  const qc = Math.max(1, quarterCols);
  const b = Math.max(0, Math.min(tb, beat));
  return (b / tb) * Math.max(0, qc - 1);
}

export function beatLabSynth2QuarterColFToPx(colF: number, quarterCellW: number): number {
  return colF * quarterCellW;
}

/** Visual beat from compositor time (Groove Lab `beatFromGrooveLabPlaylineWapiAnim`). */
export function beatLabSynth2BeatFromPlaylineWapiAnim(
  animMs: number,
  seg: BeatLabSynth2PlaylineWapiSegState,
): number {
  const d = Math.max(1e-9, seg.durMs);
  const phaseMs = ((animMs % d) + d) % d;
  return (phaseMs / d) * Math.max(1e-9, seg.totalBeats);
}

export function cancelBeatLabSynth2PlaylineWapi(
  refs: BeatLabSynth2PlaylineWapiRefs,
  el: HTMLElement | null,
): void {
  refs.animRef.current = null;
  if (!el) return;
  el.getAnimations().forEach((a) => a.cancel());
  el.style.removeProperty('will-change');
}

export type BeatLabSynth2PlaylineWapiOpts = {
  el: HTMLElement | null;
  beatNow: number;
  play: boolean;
  bpm: number;
  totalBeats: number;
  quarterCols: number;
  colsPerBar: number;
  immediateCompositorStart?: boolean;
};

export function launchBeatLabSynth2PlaylineWapi(
  refs: BeatLabSynth2PlaylineWapiRefs,
  o: BeatLabSynth2PlaylineWapiOpts,
): void {
  const { el, beatNow, play, bpm, totalBeats, quarterCols, colsPerBar } = o;
  cancelBeatLabSynth2PlaylineWapi(refs, el);
  if (!el) return;

  el.style.removeProperty('transform');
  if (play) el.style.willChange = 'transform';
  else el.style.removeProperty('will-change');

  const qc = Math.max(1, quarterCols);
  if (qc <= 1) {
    el.style.transform = `translate3d(${-PLAYLINE_CENTER_X}px, 0, 0)`;
    refs.wapiSegStateRef.current = { ...BEAT_LAB_SYNTH2_PLAYLINE_WAPI_SEG_IDLE, totalBeats, quarterCols: qc };
    return;
  }

  const spb = 60 / Math.max(1, bpm);
  const tb = Math.max(1e-9, totalBeats);
  const durationMs = Math.max(16, tb * spb * 1000);
  const cellW = beatLabSynthQuarterCellW(colsPerBar);
  const xEnd = (qc - 1) * cellW;
  const colF = beatLabSynth2BeatToQuarterColF(beatNow, tb, qc);
  const seekRatio = Math.min(1, Math.max(0, colF / Math.max(qc - 1, 1e-9)));
  const seekMs = seekRatio * durationMs;
  const playDelayMs =
    play && !o.immediateCompositorStart
      ? Math.max(0, SE2_AUDIO_START_FLOOR_SEC * 1000)
      : 0;

  refs.wapiSegStateRef.current = {
    durMs: durationMs,
    totalBeats: tb,
    quarterCols: qc,
    seekMs,
  };

  const anim = el.animate(
    [
      { transform: `translate3d(${-PLAYLINE_CENTER_X}px, 0, 0)` },
      { transform: `translate3d(${xEnd - PLAYLINE_CENTER_X}px, 0, 0)` },
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

export function seekRunningBeatLabSynth2PlaylineWapi(
  refs: BeatLabSynth2PlaylineWapiRefs,
  beatNow: number,
): void {
  const seg = refs.wapiSegStateRef.current;
  const anim = refs.animRef.current;
  if (!anim || anim.playState === 'idle' || seg.durMs <= 0) return;
  const colF = beatLabSynth2BeatToQuarterColF(beatNow, seg.totalBeats, seg.quarterCols);
  const seekRatio = Math.min(1, Math.max(0, colF / Math.max(seg.quarterCols - 1, 1e-9)));
  const seekMs = seekRatio * seg.durMs;
  const sm = Math.min(Math.max(seekMs, 0), seg.durMs);
  anim.pause();
  anim.currentTime = sm;
  anim.play();
  seg.seekMs = sm;
}

export function snapBeatLabSynth2PlaylineStatic(o: Omit<BeatLabSynth2PlaylineWapiOpts, 'play' | 'bpm'>): void {
  const { el, beatNow, totalBeats, quarterCols, colsPerBar } = o;
  if (!el) return;
  el.getAnimations().forEach((a) => a.cancel());
  el.style.removeProperty('will-change');
  const cellW = beatLabSynthQuarterCellW(colsPerBar);
  const colF = beatLabSynth2BeatToQuarterColF(beatNow, totalBeats, quarterCols);
  const x = beatLabSynth2QuarterColFToPx(colF, cellW);
  el.style.transform = `translate3d(${x - PLAYLINE_CENTER_X}px, 0, 0)`;
}
