/**
 * Creation Station drum/piano **playline** — Web Animations API (compositor) while playing.
 *
 * All motion **durations** are derived from `bpm` (`spb = 60/bpm`) like the metronome / transport lookahead.
 * When tempo or pattern width changes during play, `CreationStationScreen` relaunches this so rate stays
 * locked to BPM (same contract as SE2 `launchWapiAnims`, documentation-only).
 *
 * **Pause → seek → play** (never play → seek) to avoid a one-frame flash at the from-keyframe.
 */
import type { MutableRefObject } from 'react';

/** Half of Creation Station drum playline `width` (2) — math is column **center**, transform is **left**. */
export const CREATION_DRUM_PLAYLINE_CENTER_X = 1;
/** Half of piano playline `width` (1). */
export const CREATION_PIANO_PLAYLINE_CENTER_X = 0.5;

/** X shift so a `drumColW`-wide quant glow strip’s center tracks the drum playline center (same WAAPI keyframes + offset). */
export function creationDrumQuantGlowKeyframeOffsetPx(drumColW: number): number {
  const cw = Math.max(1, drumColW);
  return CREATION_DRUM_PLAYLINE_CENTER_X - cw / 2;
}

export type CreationPlaylineWapiOpts = {
  drumEl: HTMLElement | null;
  pianoEl: HTMLElement | null;
  /** Beat-lab quant row highlight — same translate timeline as `drumEl` with {@link creationDrumQuantGlowKeyframeOffsetPx}. */
  drumQuantGlowEl: HTMLElement | null;
  beatNow: number;
  play: boolean;
  bpm: number;
  subdiv: number;
  pcols: number;
  drumColW: number;
  pianoColW: number;
  loopOn: boolean;
  loopStartBeat: number;
  loopEndBeat: number;
  playMode: 'single' | 'chainAB';
};

export type CreationPlaylineWapiRefs = {
  drumAnimRef: MutableRefObject<Animation | null>;
  pianoAnimRef: MutableRefObject<Animation | null>;
  drumQuantGlowAnimRef: MutableRefObject<Animation | null>;
};

/** Fractional pattern column + pixel X (same mapping as legacy `updateCreationPlaylineTransforms`). */
export function creationPlaylineColFAndPx(
  beatNow: number,
  subdiv: number,
  pcols: number,
  loopOn: boolean,
  loopStartBeat: number,
  loopEndBeat: number,
  playMode: 'single' | 'chainAB',
  drumColW: number,
  pianoColW: number,
): { colF: number; drumX: number; pianoX: number } {
  const sub = Math.max(1, Math.min(64, Math.round(subdiv)));
  const pc = Math.max(1, Math.round(pcols));
  const stepF = Math.max(0, beatNow) * sub;
  const loopActive = loopOn && loopEndBeat > loopStartBeat;
  let colF: number;
  if (loopActive) {
    const ls = Math.floor(loopStartBeat + 1e-8);
    const le = Math.floor(loopEndBeat + 1e-8);
    const lsStep = ls * sub;
    const leStep = le * sub;
    const spanSteps = Math.max(1, leStep - lsStep);
    const pos = ((stepF - lsStep) % spanSteps + spanSteps) % spanSteps;
    colF = ((pos % pc) + pc) % pc;
  } else {
    const drumColOff = Math.floor(Math.max(0, loopOn ? loopStartBeat * sub : 0) + 1e-8);
    const rel = stepF - drumColOff;
    if (playMode === 'chainAB') {
      colF = ((rel % pc) + pc) % pc;
    } else {
      colF = Math.max(0, Math.min(pc - 1, rel));
    }
  }
  const cw = Math.max(1, drumColW);
  const pcw = Math.max(1, pianoColW);
  return { colF, drumX: colF * cw, pianoX: colF * pcw };
}

export function cancelCreationPlaylineWapi(
  refs: CreationPlaylineWapiRefs,
  drumEl: HTMLElement | null,
  pianoEl: HTMLElement | null,
  drumQuantGlowEl: HTMLElement | null,
): void {
  refs.drumAnimRef.current = null;
  refs.pianoAnimRef.current = null;
  refs.drumQuantGlowAnimRef.current = null;
  for (const el of [drumEl, pianoEl, drumQuantGlowEl]) {
    if (!el) continue;
    el.getAnimations().forEach((a) => a.cancel());
    el.style.removeProperty('will-change');
  }
}

/**
 * Start (or re-seek) compositor playline motion. When `play` is false, leaves the animation **paused**
 * at the correct `beatNow` position (pause / scrub while stopped).
 */
export function launchCreationPlaylineWapi(refs: CreationPlaylineWapiRefs, o: CreationPlaylineWapiOpts): void {
  const { drumEl, pianoEl, drumQuantGlowEl, beatNow, play, bpm, subdiv, pcols } = o;
  const sub = Math.max(1, Math.min(64, Math.round(subdiv)));
  const pc = Math.max(1, Math.round(pcols));
  const cw = Math.max(1, o.drumColW);
  const pcw = Math.max(1, o.pianoColW);
  const spb = 60 / Math.max(1, bpm);
  const glowKfOff = creationDrumQuantGlowKeyframeOffsetPx(cw);

  cancelCreationPlaylineWapi(refs, drumEl, pianoEl, drumQuantGlowEl);
  /** Imperative `transform` from static snap can otherwise fight the first compositor keyframe for a frame. */
  for (const el of [drumEl, pianoEl, drumQuantGlowEl]) {
    if (!el) continue;
    el.style.removeProperty('transform');
    if (play) el.style.willChange = 'transform';
    else el.style.removeProperty('will-change');
  }

  if (!drumEl && !pianoEl) return;

  if (pc <= 1) {
    if (drumEl) drumEl.style.transform = `translate3d(${-CREATION_DRUM_PLAYLINE_CENTER_X}px, 0, 0)`;
    if (pianoEl) pianoEl.style.transform = `translate3d(${-CREATION_PIANO_PLAYLINE_CENTER_X}px, 0, 0)`;
    if (drumQuantGlowEl) {
      drumQuantGlowEl.style.transform = `translate3d(${-CREATION_DRUM_PLAYLINE_CENTER_X + glowKfOff}px, 0, 0)`;
    }
    return;
  }

  const xEndDrum = (pc - 1) * cw;
  const xEndPiano = (pc - 1) * pcw;

  const makeAnim01 = (
    el: HTMLElement | null,
    xEnd: number,
    durationMs: number,
    seekMs: number,
    iterations: number,
    centerX: number,
    kfExtra = 0,
  ): Animation | null => {
    if (!el) return null;
    el.getAnimations().forEach((a) => a.cancel());
    const dSafe = Math.max(16, durationMs);
    const a = el.animate(
      [
        { transform: `translate3d(${-centerX + kfExtra}px, 0, 0)` },
        { transform: `translate3d(${xEnd - centerX + kfExtra}px, 0, 0)` },
      ],
      { duration: dSafe, delay: 0, easing: 'linear', fill: 'forwards', iterations },
    );
    a.pause();
    const sm = Math.min(Math.max(seekMs, 0), dSafe);
    a.currentTime = sm;
    if (play) a.play();
    return a;
  };

  const makeAnimSeg = (
    el: HTMLElement | null,
    x0: number,
    x1: number,
    durationMs: number,
    seekMs: number,
    iterations: number,
    centerX: number,
    kfExtra = 0,
  ): Animation | null => {
    if (!el) return null;
    el.getAnimations().forEach((a) => a.cancel());
    const dSafe = Math.max(16, durationMs);
    const a = el.animate(
      [
        { transform: `translate3d(${x0 - centerX + kfExtra}px, 0, 0)` },
        { transform: `translate3d(${x1 - centerX + kfExtra}px, 0, 0)` },
      ],
      { duration: dSafe, delay: 0, easing: 'linear', fill: 'forwards', iterations },
    );
    a.pause();
    const sm = Math.min(Math.max(seekMs, 0), dSafe);
    a.currentTime = sm;
    if (play) a.play();
    return a;
  };

  /**
   * Same branch as SE2 `launchWapiAnims` `useSegment`:
   * `play && loopOn && le > ls && ls >= 0` → one segment over `(le − ls)` beats, infinite iterations.
   * Maps timeline beats → pattern-column pixels via `creationPlaylineColFAndPx`.
   */
  const useSegment =
    play && o.loopOn && o.loopEndBeat > o.loopStartBeat && o.loopStartBeat >= 0;

  if (useSegment) {
    const lsLoop = o.loopStartBeat;
    const leLoop = o.loopEndBeat;
    const spanBeats = Math.max(1e-9, leLoop - lsLoop);
    const durMs = Math.max(16, (spanBeats / (bpm / 60)) * 1000);
    /** End keyframe just inside `le` so pattern-wrap doesn’t collapse x0≈x1 (zero-motion segment). */
    const endBeat = Math.max(lsLoop + 1e-9, leLoop - 1e-6);
    const bn = Math.min(Math.max(beatNow, lsLoop), endBeat);
    const seekMs = Math.max(0, Math.min(((bn - lsLoop) / Math.max(1e-9, bpm / 60)) * 1000, durMs));
    const x0d = creationPlaylineColFAndPx(lsLoop, sub, pc, o.loopOn, o.loopStartBeat, o.loopEndBeat, o.playMode, cw, pcw).drumX;
    let x1d = creationPlaylineColFAndPx(endBeat, sub, pc, o.loopOn, o.loopStartBeat, o.loopEndBeat, o.playMode, cw, pcw).drumX;
    const x0p = creationPlaylineColFAndPx(lsLoop, sub, pc, o.loopOn, o.loopStartBeat, o.loopEndBeat, o.playMode, cw, pcw).pianoX;
    let x1p = creationPlaylineColFAndPx(endBeat, sub, pc, o.loopOn, o.loopStartBeat, o.loopEndBeat, o.playMode, cw, pcw).pianoX;
    if (Math.abs(x1d - x0d) < 0.5) {
      const midB = lsLoop + spanBeats * 0.5;
      x1d = creationPlaylineColFAndPx(midB, sub, pc, o.loopOn, o.loopStartBeat, o.loopEndBeat, o.playMode, cw, pcw).drumX;
    }
    if (Math.abs(x1p - x0p) < 0.5) {
      const midB = lsLoop + spanBeats * 0.5;
      x1p = creationPlaylineColFAndPx(midB, sub, pc, o.loopOn, o.loopStartBeat, o.loopEndBeat, o.playMode, cw, pcw).pianoX;
    }
    const iters = Number.POSITIVE_INFINITY;
    refs.drumAnimRef.current = makeAnimSeg(drumEl, x0d, x1d, durMs, seekMs, iters, CREATION_DRUM_PLAYLINE_CENTER_X);
    refs.pianoAnimRef.current = makeAnimSeg(pianoEl, x0p, x1p, durMs, seekMs, iters, CREATION_PIANO_PLAYLINE_CENTER_X);
    refs.drumQuantGlowAnimRef.current = makeAnimSeg(
      drumQuantGlowEl,
      x0d,
      x1d,
      durMs,
      seekMs,
      iters,
      CREATION_DRUM_PLAYLINE_CENTER_X,
      glowKfOff,
    );
    return;
  }

  /** Non-segment: repeating pattern / chain — one 0→last-column sweep every `pc/sub` beats (SE2 “open song” analogue). */
  const { colF } = creationPlaylineColFAndPx(
    beatNow,
    sub,
    pc,
    o.loopOn,
    o.loopStartBeat,
    o.loopEndBeat,
    o.playMode,
    cw,
    pcw,
  );
  const periodBeats = pc / sub;
  const durationMs = Math.max(32, periodBeats * spb * 1000);
  const seekRatio = Math.min(1, Math.max(0, colF / Math.max(pc - 1, 1e-9)));
  const seekMs = seekRatio * durationMs;
  const iters = play ? Number.POSITIVE_INFINITY : 1;

  refs.drumAnimRef.current = makeAnim01(drumEl, xEndDrum, durationMs, seekMs, iters, CREATION_DRUM_PLAYLINE_CENTER_X);
  refs.pianoAnimRef.current = makeAnim01(pianoEl, xEndPiano, durationMs, seekMs, iters, CREATION_PIANO_PLAYLINE_CENTER_X);
  refs.drumQuantGlowAnimRef.current = makeAnim01(
    drumQuantGlowEl,
    xEndDrum,
    durationMs,
    seekMs,
    iters,
    CREATION_DRUM_PLAYLINE_CENTER_X,
    glowKfOff,
  );
}

/** Imperative snap when WAAPI is not driving the line (scrub, zoom, etc.). */
export function setCreationPlaylineTransformStatic(
  o: Omit<CreationPlaylineWapiOpts, 'play' | 'bpm'>,
): void {
  const { drumEl, pianoEl, drumQuantGlowEl, beatNow, subdiv, pcols } = o;
  const cw = Math.max(1, o.drumColW);
  const pcw = Math.max(1, o.pianoColW);
  const glowKfOff = creationDrumQuantGlowKeyframeOffsetPx(cw);
  const { drumX, pianoX } = creationPlaylineColFAndPx(
    beatNow,
    subdiv,
    pcols,
    o.loopOn,
    o.loopStartBeat,
    o.loopEndBeat,
    o.playMode,
    cw,
    pcw,
  );
  if (drumEl) drumEl.style.transform = `translate3d(${drumX - CREATION_DRUM_PLAYLINE_CENTER_X}px, 0, 0)`;
  if (pianoEl) pianoEl.style.transform = `translate3d(${pianoX - CREATION_PIANO_PLAYLINE_CENTER_X}px, 0, 0)`;
  if (drumQuantGlowEl) {
    drumQuantGlowEl.style.transform = `translate3d(${drumX - CREATION_DRUM_PLAYLINE_CENTER_X + glowKfOff}px, 0, 0)`;
  }
}
