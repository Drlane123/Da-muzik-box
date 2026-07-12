/**
 * Scheduling-domain clock used by Studio Editor 2 (`animationTick`, `pauseTransport`, 25ms transport tick).
 * Keep this file in lock-step with `StudioEditor2Screen.tsx` comments — Creation Station imports it so both
 * surfaces cannot drift apart.
 */
import type { MutableRefObject } from 'react';

type AnimationPlayState = 'idle' | 'running' | 'paused' | 'finished';

/** @see StudioEditor2Screen `AUDIO_START_FLOOR_SEC` */
export const SE2_AUDIO_START_FLOOR_SEC = 0.008;

/** @see StudioEditor2Screen `LOOP_METRO_CHAIN_FLOOR_SEC` */
export const SE2_LOOP_METRO_CHAIN_FLOOR_SEC = 0.002;

/**
 * After a compositor cycle bump, WAAPI phase is often a few ms past the downbeat.
 * Snap scheduling to loop top so beat 0 / kick is not skipped (Beat Lab mirror).
 */
export const SE2_LOOP_SPLICE_DOWNBEAT_SNAP_BEATS = 0.125;

/** Ignore compositor loop-wrap glitches briefly after Play (Beat Lab mirror). */
export const SE2_LOOP_WRAP_IGNORE_MS = 150;

export function se2ShouldIgnoreLoopWrap(playStartPerfMs: number): boolean {
  return playStartPerfMs > 0 && performance.now() - playStartPerfMs < SE2_LOOP_WRAP_IGNORE_MS;
}

export function se2LoopSpliceSchedBeat(
  bVis: number,
  loopStartBeat: number,
  _loopSpanBeats: number,
): number {
  const phase = bVis - loopStartBeat;
  if (phase >= 0 && phase < SE2_LOOP_SPLICE_DOWNBEAT_SNAP_BEATS) {
    return loopStartBeat;
  }
  return bVis;
}

/** SE2 `snapBeatToQuarterGrid` — metro `nextMetroK` on loop splice. */
export function se2SnapBeatToQuarterGrid(b: number, totalBeats: number): number {
  const tb = Math.max(1e-9, totalBeats);
  return Math.max(0, Math.min(Math.floor(b + 1e-9), tb));
}

/** Exact audio time when the transport crosses `loopEndBeat` on the current session grid. */
export function se2LoopWrapGridTime(
  sessionStart: number,
  originBeat: number,
  loopEndBeat: number,
  spb: number,
): number {
  return sessionStart + (loopEndBeat - originBeat) * spb;
}

/** Which lap (0-based) the unwrapped beat position is in for `[loopStart, loopEnd)`. */
export function se2MetroLoopLapIndex(
  beatNow: number,
  loopStartBeat: number,
  loopSpanBeats: number,
): number {
  const span = Math.max(1e-9, loopSpanBeats);
  return Math.max(0, Math.floor((beatNow - loopStartBeat + 1e-9) / span));
}

export type Se2MetroGridLoopSpliceRefs = Se2SeamlessLoopSpliceRefs;

/**
 * Re-anchor session on the metronome grid at loop top — fires at beat `loopEnd` (bar 5 downbeat
 * becomes bar 1). Uses the computed wrap time, not compositor phase.
 */
export function applySe2MetroGridLoopSplice(
  ctx: AudioContext,
  tWrap: number,
  loopStartBeat: number,
  bpm: number,
  totalBeats: number,
  refs: Se2MetroGridLoopSpliceRefs,
): { bDisplay: number } {
  const chainFloor = SE2_LOOP_METRO_CHAIN_FLOOR_SEC;
  const sessionStart = tWrap + chainFloor;
  const rate = Math.max(1, bpm) / 60;
  const tCapture = Math.max(0, ctx.currentTime);

  refs.sessionStartRef.current = sessionStart;
  refs.schedAnchorTimeRef.current = tCapture;
  refs.schedAnchorPerfRef.current = performance.now();
  refs.perfSessionStartMsRef.current =
    performance.now() + (sessionStart - tCapture) * 1000;

  /** At `sessionStart`, audio beat equals `loopStartBeat`. */
  refs.originBeatRef.current = loopStartBeat - chainFloor * rate;

  const tb = Math.max(1e-9, totalBeats);
  if (refs.nextMetroKRef) {
    refs.nextMetroKRef.current = se2SnapBeatToQuarterGrid(loopStartBeat, tb);
  }
  refs.cursorBeatRef.current = loopStartBeat;
  refs.displayBeatRef.current = loopStartBeat;

  const tSmoothSnap =
    refs.schedAnchorTimeRef.current > 0
      ? smoothSchedNow(refs.schedAnchorTimeRef, refs.schedAnchorPerfRef, ctx)
      : null;

  let bDisplay = loopStartBeat;
  if (tSmoothSnap !== null) {
    bDisplay = Math.max(
      0,
      Math.min(
        tb,
        refs.originBeatRef.current + (tSmoothSnap - sessionStart) * rate,
      ),
    );
  }
  return { bDisplay };
}

export function updateSchedAnchor(
  ctx: AudioContext,
  anchorTimeRef: MutableRefObject<number>,
  anchorPerfRef: MutableRefObject<number>,
): void {
  const t = ctx.currentTime;
  if (t > anchorTimeRef.current) {
    anchorTimeRef.current = t;
    anchorPerfRef.current = performance.now();
  }
}

export function smoothSchedNow(
  anchorTimeRef: MutableRefObject<number>,
  anchorPerfRef: MutableRefObject<number>,
  ctx: AudioContext,
): number {
  if (anchorTimeRef.current > 0) {
    return anchorTimeRef.current + (performance.now() - anchorPerfRef.current) / 1000;
  }
  return Math.max(0, ctx.currentTime);
}

export type Se2WapiSegLoopState = {
  loopStartBeat: number;
  loopEndBeat: number;
  durMs: number;
};

export type Se2SeamlessLoopSpliceRefs = {
  sessionStartRef: MutableRefObject<number>;
  schedAnchorTimeRef: MutableRefObject<number>;
  schedAnchorPerfRef: MutableRefObject<number>;
  perfSessionStartMsRef: MutableRefObject<number>;
  originBeatRef: MutableRefObject<number>;
  cursorBeatRef: MutableRefObject<number>;
  displayBeatRef: MutableRefObject<number>;
  nextMetroKRef?: MutableRefObject<number>;
};

/**
 * Seamless compositor lap — re-anchor `sessionStart` + solve `originBeat` from WAAPI phase
 * (Beat Lab `applyBeatLabSeamlessLoopSplice` mirror). Without this, preview schedulers keep
 * first-lap keys and audio/MIDI go silent on repeat.
 */
export function applySe2SeamlessLoopSplice(
  ctx: AudioContext,
  seg: Se2WapiSegLoopState,
  loopStartBeat: number,
  animMs: number,
  bpm: number,
  totalBeats: number,
  refs: Se2SeamlessLoopSpliceRefs,
): { bDisplay: number; bSched: number } {
  const d = Math.max(1e-9, seg.durMs);
  const span = seg.loopEndBeat - seg.loopStartBeat;
  const phaseMs = ((animMs % d) + d) % d;
  const bVis = Math.max(
    seg.loopStartBeat,
    Math.min(seg.loopEndBeat, seg.loopStartBeat + (phaseMs / d) * span),
  );

  const tCapture = Math.max(0, ctx.currentTime);
  const tSmoothSnap =
    refs.schedAnchorTimeRef.current > 0
      ? smoothSchedNow(refs.schedAnchorTimeRef, refs.schedAnchorPerfRef, ctx)
      : null;

  refs.sessionStartRef.current = tCapture + SE2_AUDIO_START_FLOOR_SEC;
  refs.schedAnchorTimeRef.current = tCapture;
  refs.schedAnchorPerfRef.current = performance.now();
  refs.perfSessionStartMsRef.current =
    performance.now() + SE2_AUDIO_START_FLOOR_SEC * 1000;

  const rate = Math.max(1, bpm) / 60;
  const sessionStart = refs.sessionStartRef.current;
  const tb = Math.max(1e-9, totalBeats);
  const loopStart = Math.max(0, loopStartBeat);
  const bSched = loopStart;
  if (tSmoothSnap !== null) {
    refs.originBeatRef.current = bVis - (tSmoothSnap - sessionStart) * rate;
  } else {
    refs.originBeatRef.current = bVis;
  }

  if (refs.nextMetroKRef) {
    const kNext = Math.max(0, Math.floor(bSched + 1e-8));
    refs.nextMetroKRef.current = se2SnapBeatToQuarterGrid(Math.min(tb, Math.max(0, kNext)), tb);
  }

  refs.cursorBeatRef.current = loopStart;
  refs.displayBeatRef.current = loopStart;

  // Hard reset the visual playhead directly to the left loop start.
  const bDisplay = loopStart;

  return { bDisplay, bSched };
}

export type Se2AnimationTickLoopWrapInput = {
  ctx: AudioContext | null;
  animMs: number;
  wapiPlayState: AnimationPlayState | 'idle';
  b: number;
  bDisplay: number;
  totalBeats: number;
  bpm: number;
  loopOn: boolean;
  loopStartBeat: number;
  loopEndBeat: number;
  seg: Se2WapiSegLoopState;
  playStartPerfMs: number;
  refs: Se2SeamlessLoopSpliceRefs;
  wapiLoopCycleSeenRef: MutableRefObject<number>;
  wapiPrevPhaseMsRef: MutableRefObject<number>;
  /** Prevents double audio splice when RAF and metro tick fire in the same lap. */
  lastCompositorLoopLapRef?: MutableRefObject<number>;
  onSeamlessSplice: (ctx: AudioContext, tCapture: number) => void;
  onDiscreteWrap: (ctx: AudioContext, tCapture: number, loopStart: number) => void;
  relaunchPlaylineAtLoopStart: (loopStart: number) => void;
};

function se2AudioNow(ctx: AudioContext): number {
  return Math.max(0, ctx.currentTime);
}

/**
 * SE2 `animationTick` loop wrap — compositor seamless cycle bump + discrete fallback.
 * Mirrors Beat Lab `beatLabAnimationTickLoopWrap` using `applySe2SeamlessLoopSplice`.
 */
export function se2AnimationTickLoopWrap(
  input: Se2AnimationTickLoopWrapInput,
): { b: number; bDisplay: number } {
  let { b, bDisplay } = input;
  const {
    animMs,
    wapiPlayState,
    totalBeats: tb,
    loopOn,
    loopStartBeat: loopStart,
    loopEndBeat: loopEnd,
    seg,
    ctx,
  } = input;

  const seamless =
    seg.seamlessLoop &&
    loopOn &&
    seg.active &&
    Math.min(loopEnd, tb) > loopStart &&
    Math.min(loopEnd, tb) === seg.loopEndBeat &&
    loopStart === seg.loopStartBeat;

  if (seamless && wapiPlayState === 'running' && loopOn) {
    const d = Math.max(1e-9, seg.durMs);
    const span = seg.loopEndBeat - seg.loopStartBeat;
    const phaseMs = ((animMs % d) + d) % d;
    const bVis = Math.max(loopStart, Math.min(loopEnd, loopStart + (phaseMs / d) * span));
    const prevPh = input.wapiPrevPhaseMsRef.current;
    const cycle = Math.floor(animMs / d);
    const cycleBumped = cycle > input.wapiLoopCycleSeenRef.current;
    const phaseRewind = prevPh >= 0 && phaseMs < prevPh - d * 0.25;

    if ((cycleBumped || phaseRewind) && !se2ShouldIgnoreLoopWrap(input.playStartPerfMs)) {
      const lapKey = cycleBumped ? cycle : input.wapiLoopCycleSeenRef.current + 1;
      const alreadySpliced =
        input.lastCompositorLoopLapRef != null &&
        lapKey <= input.lastCompositorLoopLapRef.current;
      if (!alreadySpliced) {
        const ctxLoop = ctx;
        if (ctxLoop && ctxLoop.state !== 'closed') {
          const tCapture = se2AudioNow(ctxLoop);
          const spliceResult = applySe2SeamlessLoopSplice(
            ctxLoop,
            seg,
            loopStart,
            animMs,
            input.bpm,
            tb,
            input.refs,
          );
          // Force the timeline to ONLY use our fixed return values.
          bDisplay = spliceResult.bDisplay;
          input.onSeamlessSplice(ctxLoop, tCapture);
          if (input.lastCompositorLoopLapRef) {
            input.lastCompositorLoopLapRef.current = lapKey;
          }
        }

        if (phaseRewind && !cycleBumped) {
          input.wapiLoopCycleSeenRef.current = Math.max(
            input.wapiLoopCycleSeenRef.current,
            cycle,
          );
        } else {
          input.wapiLoopCycleSeenRef.current = cycle;
        }
      }
    }
    input.wapiPrevPhaseMsRef.current = phaseMs;
  }

  // Trigger discrete wrap slightly before absolute loop end to avoid right-edge overshoot.
  const loopWrapLeadBeats = 0.25;
  const loopEndMsEps = 0.65;
  const segEnds =
    seg.active &&
    loopOn &&
    loopEnd === seg.loopEndBeat &&
    animMs >= Math.max(0, seg.durMs - loopEndMsEps);
  const audioPastLoopEnd = bDisplay >= loopEnd - loopWrapLeadBeats;
  const compositorPastLoopEnd = b >= loopEnd - loopWrapLeadBeats || segEnds;
  const segmentTimedToLoopBar =
    seg.active && loopOn && loopEnd === seg.loopEndBeat && loopEnd > loopStart;
  const shouldWrapLoopNow =
    !seamless &&
    !(loopOn && seg.seamlessLoop && seg.active) &&
    loopOn &&
    loopEnd > loopStart &&
    (segmentTimedToLoopBar
      ? audioPastLoopEnd && compositorPastLoopEnd
      : audioPastLoopEnd || compositorPastLoopEnd);

  if (shouldWrapLoopNow) {
    const wrapTargetBeat = Math.max(0, loopStart + loopWrapLeadBeats);
    input.refs.originBeatRef.current = wrapTargetBeat;
    input.refs.cursorBeatRef.current = wrapTargetBeat;
    input.refs.displayBeatRef.current = wrapTargetBeat;
    if (input.refs.nextMetroKRef) {
      input.refs.nextMetroKRef.current = se2SnapBeatToQuarterGrid(wrapTargetBeat, tb);
    }

    const ctxLoop = ctx;
    if (ctxLoop && ctxLoop.state !== 'closed') {
      const tCapture = se2AudioNow(ctxLoop);
      const spliceFloor = SE2_LOOP_METRO_CHAIN_FLOOR_SEC;
      const loopDurationBeats = Math.max(0, loopEnd - loopStart);
      const secondsPerBeat = 60 / Math.max(1, input.bpm);
      const loopDurationSec = loopDurationBeats * secondsPerBeat;
      input.refs.sessionStartRef.current = tCapture + spliceFloor - loopDurationSec;
      input.refs.schedAnchorTimeRef.current = tCapture - loopDurationSec;
      input.refs.schedAnchorPerfRef.current = performance.now();
      input.refs.perfSessionStartMsRef.current =
        performance.now() + spliceFloor * 1000;
      input.onDiscreteWrap(ctxLoop, tCapture, wrapTargetBeat);
    }

    input.relaunchPlaylineAtLoopStart(wrapTargetBeat);
    b = wrapTargetBeat;
    bDisplay = wrapTargetBeat;
  }

  return { b, bDisplay };
}
