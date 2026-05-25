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

import { creationPlaylineBankColFFromBeat } from '@/app/lib/creationStation/creationDrumGridAdaptive';

/** Compositor lead for **Chord Builder / 808 Lab** playlines only — not Beat Lab transport. */
export const CREATION_PLAYLINE_WAPI_LEAD_SEC = 0.052;

export function creationPlaylineOutputDacLeadSec(ctx: AudioContext | null): number {
  if (!ctx || ctx.state === 'closed') return 0;
  const ol = typeof ctx.outputLatency === 'number' && ctx.outputLatency > 0 ? ctx.outputLatency : 0;
  const bl = typeof ctx.baseLatency === 'number' && ctx.baseLatency > 0 ? ctx.baseLatency : 0;
  return Math.min(0.12, ol + bl);
}

/** WAAPI `beatNow` while playing — do **not** use on Beat Lab transport (audio uses real `beatNow`). */
export function creationPlaylineBeatForWapi(
  beatNow: number,
  play: boolean,
  bpm: number,
  ctx: AudioContext | null,
): number {
  if (!play) return beatNow;
  const leadSec = CREATION_PLAYLINE_WAPI_LEAD_SEC + creationPlaylineOutputDacLeadSec(ctx);
  return beatNow + leadSec * (Math.max(1, bpm) / 60);
}

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
  /** Pattern length in beats (SE2 `totalBeatsRef` analogue). Defaults to `pcols / subdiv`. */
  totalBeats?: number;
  /** Delay WAAPI `play` to match `sessionStart` (SE2 `AUDIO_START_FLOOR_SEC`). */
  audioStartLeadSec?: number;
  /** Play click — start compositor immediately (audio session still uses `audioStartLeadSec`). */
  immediateCompositorStart?: boolean;
};

/** Mirrors SE2 `wapiSegLoopRef` — read in transport rAF to map compositor time → beat. */
export type CreationPlaylineWapiSegState = {
  active: boolean;
  loopStartBeat: number;
  loopEndBeat: number;
  durMs: number;
  seamlessLoop: boolean;
  /** Non-segment pattern period in beats (`pcols / subdiv`). */
  periodBeats: number;
  beatAtLaunch: number;
  /** Compositor seek into the active WAAPI (ms) — for open infinite iterations. */
  seekMs: number;
};

export const CREATION_PLAYLINE_WAPI_SEG_IDLE: CreationPlaylineWapiSegState = {
  active: false,
  loopStartBeat: 0,
  loopEndBeat: 0,
  durMs: 0,
  seamlessLoop: false,
  periodBeats: 0,
  beatAtLaunch: 0,
  seekMs: 0,
};

const fallbackWapiSegRef: MutableRefObject<CreationPlaylineWapiSegState> = {
  current: { ...CREATION_PLAYLINE_WAPI_SEG_IDLE },
};
const fallbackWapiBpmRef: MutableRefObject<number> = { current: 120 };

export type CreationPlaylineWapiRefs = {
  drumAnimRef: MutableRefObject<Animation | null>;
  pianoAnimRef: MutableRefObject<Animation | null>;
  drumQuantGlowAnimRef: MutableRefObject<Animation | null>;
  /** Beat Lab only — optional for Chord Builder / 808 / Orchid playlines. */
  wapiSegStateRef?: MutableRefObject<CreationPlaylineWapiSegState>;
  wapiBpmRef?: MutableRefObject<number>;
};

function resolvePlaylineWapiRefs(refs: CreationPlaylineWapiRefs): {
  wapiSegStateRef: MutableRefObject<CreationPlaylineWapiSegState>;
  wapiBpmRef: MutableRefObject<number>;
} {
  return {
    wapiSegStateRef: refs.wapiSegStateRef ?? fallbackWapiSegRef,
    wapiBpmRef: refs.wapiBpmRef ?? fallbackWapiBpmRef,
  };
}

/** Visual beat from compositor `Animation.currentTime` (SE2 `animationTick` `b`). */
export function beatFromCreationPlaylineWapiAnim(
  animMs: number,
  seg: CreationPlaylineWapiSegState,
  bpm: number,
): number {
  const rate = bpm / 60;
  if (seg.active && seg.seamlessLoop) {
    const d = Math.max(1e-9, seg.durMs);
    const span = seg.loopEndBeat - seg.loopStartBeat;
    const phaseMs = ((animMs % d) + d) % d;
    return seg.loopStartBeat + (phaseMs / d) * span;
  }
  if (seg.active) {
    const d = Math.max(1e-9, seg.durMs);
    const t = Math.max(0, Math.min(seg.durMs, animMs));
    const span = seg.loopEndBeat - seg.loopStartBeat;
    return Math.min(
      seg.loopEndBeat,
      Math.max(seg.loopStartBeat, seg.loopStartBeat + (t / d) * span),
    );
  }
  /** Open pattern — SE2: linear compositor beat (infinite iterations still advance in ms). */
  const totalBeats = Math.max(1e-9, seg.periodBeats);
  return Math.max(0, Math.min(totalBeats, (animMs / 1000) * (bpm / 60)));
}

/** Re-seek running WAAPI playlines without cancel/rebuild (playhead-only drift / post-`ensureCtx` lock). */
export function seekRunningCreationPlaylineWapi(
  refs: CreationPlaylineWapiRefs,
  beatNow: number,
  bpm: number,
): void {
  const { wapiSegStateRef } = resolvePlaylineWapiRefs(refs);
  const seg = wapiSegStateRef.current;
  const spb = 60 / Math.max(1, bpm);
  let seekMs: number;
  if (seg.active && seg.seamlessLoop) {
    const ls = seg.loopStartBeat;
    const le = seg.loopEndBeat;
    const endBeat = Math.max(ls + 1e-9, le - 1e-6);
    const bn = Math.min(Math.max(beatNow, ls), endBeat);
    seekMs = Math.max(0, Math.min(((bn - ls) / spb) * 1000, seg.durMs));
  } else if (seg.active) {
    seekMs = Math.max(0, Math.min(seg.durMs, ((beatNow - seg.loopStartBeat) / spb) * 1000));
  } else {
    seekMs = Math.max(0, Math.min(beatNow * spb * 1000, seg.durMs));
  }
  const dCap = Math.max(16, seg.durMs || seekMs + 16);
  const sm = Math.min(Math.max(seekMs, 0), dCap);
  for (const anim of [
    refs.drumAnimRef.current,
    refs.pianoAnimRef.current,
    refs.drumQuantGlowAnimRef.current,
  ]) {
    if (!anim || anim.playState === 'idle') continue;
    anim.pause();
    anim.currentTime = sm;
    anim.play();
  }
}

/** Fractional pattern column + pixel X — absolute bank steps (MEASURES / metronome grid). */
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
  void pcols;
  void loopEndBeat;
  void playMode;
  const sub = Math.max(1, Math.min(64, Math.round(subdiv)));
  const drumColOffset = Math.floor(Math.max(0, loopOn ? loopStartBeat * sub : 0) + 1e-8);
  const colF = creationPlaylineBankColFFromBeat(beatNow, sub, drumColOffset);
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

  const { wapiSegStateRef, wapiBpmRef } = resolvePlaylineWapiRefs(refs);
  wapiBpmRef.current = bpm;

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

  const playDelayMs =
    play && !o.immediateCompositorStart
      ? Math.max(0, (o.audioStartLeadSec ?? 0) * 1000)
      : 0;

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
      { duration: dSafe, delay: playDelayMs, easing: 'linear', fill: 'forwards', iterations },
    );
    a.pause();
    const sm = Math.min(Math.max(seekMs, 0), dSafe);
    a.currentTime = sm;
    if (play) {
      a.play();
      if (el) void el.offsetWidth;
    }
    return a;
  };

  /**
   * Same branch as SE2 `launchWapiAnims` `useSegment`:
   * `play && loopOn && le > ls && ls >= 0` → one segment over `(le − ls)` beats, infinite iterations.
   * Maps timeline beats → pattern-column pixels via `creationPlaylineColFAndPx`.
   */
  /** Same gate as SE2 `launchWapiAnims` — segment loop while `loopOn` (no “wait until loop brace”). */
  const useSegment =
    play &&
    o.loopOn &&
    o.loopEndBeat > o.loopStartBeat &&
    o.loopStartBeat >= 0;

  if (useSegment) {
    const lsLoop = o.loopStartBeat;
    const leLoop = o.loopEndBeat;
    const spanBeats = Math.max(1e-9, leLoop - lsLoop);
    const durMs = Math.max(16, (spanBeats / (bpm / 60)) * 1000);
    /** End keyframe just inside `le` so pattern-wrap doesn’t collapse x0≈x1 (zero-motion segment). */
    const endBeat = Math.max(lsLoop + 1e-9, leLoop - 1e-6);
    const bn = Math.min(Math.max(beatNow, lsLoop), endBeat);
    const seekMs = Math.max(0, Math.min(((bn - lsLoop) / Math.max(1e-9, bpm / 60)) * 1000, durMs));
    wapiSegStateRef.current = {
      active: true,
      loopStartBeat: lsLoop,
      loopEndBeat: leLoop,
      durMs,
      seamlessLoop: true,
      periodBeats: 0,
      beatAtLaunch: beatNow,
      seekMs,
    };
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

  /**
   * Open pattern — mirrors SE2 `launchWapiAnims` non-segment branch:
   * `durMs = totalBeats × spb`, `seekMs = beatNow × spb`, `iterations = 1`, pause → seek → play.
   */
  const totalBeats = Math.max(1e-9, o.totalBeats ?? pc / sub);
  const durMs = Math.max(16, totalBeats * spb * 1000);
  const seekMs = Math.max(0, Math.min(beatNow * spb * 1000, durMs));
  const x0d = creationPlaylineColFAndPx(0, sub, pc, o.loopOn, o.loopStartBeat, o.loopEndBeat, o.playMode, cw, pcw).drumX;
  const x1d = creationPlaylineColFAndPx(totalBeats, sub, pc, o.loopOn, o.loopStartBeat, o.loopEndBeat, o.playMode, cw, pcw).drumX;
  const x0p = creationPlaylineColFAndPx(0, sub, pc, o.loopOn, o.loopStartBeat, o.loopEndBeat, o.playMode, cw, pcw).pianoX;
  const x1p = creationPlaylineColFAndPx(totalBeats, sub, pc, o.loopOn, o.loopStartBeat, o.loopEndBeat, o.playMode, cw, pcw).pianoX;
  wapiSegStateRef.current = {
    active: false,
    loopStartBeat: o.loopStartBeat,
    loopEndBeat: o.loopEndBeat,
    durMs,
    seamlessLoop: false,
    periodBeats: totalBeats,
    beatAtLaunch: beatNow,
    seekMs,
  };
  const iters = play ? Number.POSITIVE_INFINITY : 1;

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
