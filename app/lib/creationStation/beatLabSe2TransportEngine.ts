/**
 * Beat Lab transport — **Studio Editor 2 mirror** (Creation Station only).
 * Do not import `StudioEditor2Screen`. Match SE2 contracts only.
 */

import type { MutableRefObject } from 'react';

import {
  CREATION_LOOP_CHAIN_FLOOR_SEC,
  CREATION_MAX_CATCHUP_QUARTERS_PER_REFILL,
  CREATION_MAX_SCHEDULE_PER_CALL,
  CREATION_METRO_NODE_EPS_SEC,
  CREATION_SCHEDULE_AHEAD_SEC,
  reanchorNextStepWhileRunning,
  SE2_AUDIO_START_FLOOR_SEC,
} from '@/app/lib/creationStation/creationTransportSystem';
import { beatAtSessionTime } from '@/app/lib/creationStation/creationTransportSync';
import {
  beatFromCreationPlaylineWapiAnim,
  type CreationPlaylineWapiSegState,
} from '@/app/lib/creationStation/creationPlaylineWapi';
import type { BeatLabSynth2PlaylineWapiSegState } from '@/app/lib/creationStation/beatLabSynth2PlaylineWapi';
import { beatLabSynth2PlaylineWapiLoopWrapped } from '@/app/lib/creationStation/beatLabSynth2PlaylineWapi';
import { smoothSchedNow, updateSchedAnchor } from '@/app/lib/studio/se2TransportClock';

export {
  CREATION_LOOP_CHAIN_FLOOR_SEC,
  CREATION_MAX_CATCHUP_QUARTERS_PER_REFILL,
  CREATION_MAX_SCHEDULE_PER_CALL,
  CREATION_METRO_NODE_EPS_SEC,
  CREATION_SCHEDULE_AHEAD_SEC,
  SE2_AUDIO_START_FLOOR_SEC,
  beatAtSessionTime,
  beatFromCreationPlaylineWapiAnim,
  smoothSchedNow,
  updateSchedAnchor,
};

export const BEAT_LAB_LOOKAHEAD_INTERVAL_MS = 25;

/** Ignore loop-wrap / splice while transport is settling right after Play (beat-lab-se2-transport-lock). */
export const BEAT_LAB_LOOP_WRAP_IGNORE_MS = 150;

/**
 * After a compositor cycle bump, WAAPI phase is often a few ms past the downbeat.
 * Without snapping, `ceil(bVis)` skips quarter 0 and the loop downbeat goes silent.
 */
export const BEAT_LAB_LOOP_SPLICE_DOWNBEAT_SNAP_BEATS = 0.125;

/** Scheduling beat at loop splice — snap to loop top when compositor phase is still near downbeat. */
export function beatLabLoopSpliceSchedBeat(
  bVis: number,
  loopStartBeat: number,
  loopSpanBeats: number,
): number {
  const span = Math.max(1e-9, loopSpanBeats);
  const phase = bVis - loopStartBeat;
  if (phase >= 0 && phase < BEAT_LAB_LOOP_SPLICE_DOWNBEAT_SNAP_BEATS) {
    return loopStartBeat;
  }
  return bVis;
}

/** Skip post-`ensureCtx` WAAPI re-seek when compositor is already within this many beats of anchor. */
export const BEAT_LAB_COMPOSITOR_RESEEK_EPS_BEATS = 0.04;

export type BeatLabSchedAnchorRefs = {
  schedAnchorTimeRef: MutableRefObject<number>;
  schedAnchorPerfRef: MutableRefObject<number>;
};

/** SE2 `animationTick` display beat — audio clock via sched anchor. */
export function beatLabDisplayBeatFromAudioClock(
  ctx: AudioContext,
  anchors: BeatLabSchedAnchorRefs,
  sessionStart: number,
  originBeat: number,
  bpm: number,
  totalBeats = Number.POSITIVE_INFINITY,
): number {
  const t =
    anchors.schedAnchorTimeRef.current > 0
      ? smoothSchedNow(anchors.schedAnchorTimeRef, anchors.schedAnchorPerfRef, ctx)
      : Math.max(0, ctx.currentTime);
  const b = beatAtSessionTime(t, sessionStart, originBeat, bpm);
  return Math.max(0, Math.min(totalBeats, b));
}

export type BeatLabAnimationTickInputs = {
  running: boolean;
  ctx: AudioContext | null;
  anchors: BeatLabSchedAnchorRefs;
  sessionStart: number;
  originBeat: number;
  bpm: number;
  totalBeats: number;
  loopOn: boolean;
  loopStartBeat: number;
  loopEndBeat: number;
  animMs: number | null;
  seg: CreationPlaylineWapiSegState;
  wapiBpm: number;
};

/** SE2 `animationTick` read half (~4411–4450) — exact mirror. */
export function beatLabAnimationTickBeats(input: BeatLabAnimationTickInputs): {
  b: number;
  bDisplay: number;
} {
  const tb = Math.max(1e-9, input.totalBeats);
  let b: number;
  let bDisplay: number;

  const hasWapi =
    input.running &&
    input.animMs != null &&
    Number.isFinite(input.animMs) &&
    input.animMs >= 0;
  /** When compositor stalls, fall back to audio beat for scroll/HUD — never a frozen WAAPI phase. */

  if (hasWapi) {
    const animMs = input.animMs!;
    const seg = input.seg;
    const loopStart = input.loopStartBeat;
    const loopEnd = input.loopEndBeat;
    const leEffective = Math.min(loopEnd, tb);
    const seamless =
      seg.seamlessLoop &&
      input.loopOn &&
      seg.active &&
      leEffective > loopStart &&
      leEffective === seg.loopEndBeat &&
      loopStart === seg.loopStartBeat;

    if (seamless) {
      const d = Math.max(1e-9, seg.durMs);
      const span = seg.loopEndBeat - seg.loopStartBeat;
      const phaseMs = ((animMs % d) + d) % d;
      b = seg.loopStartBeat + (phaseMs / d) * span;
    } else if (seg.active && input.loopOn) {
      const d = Math.max(1e-9, seg.durMs);
      const tClamped = Math.max(0, Math.min(seg.durMs, animMs));
      const span = seg.loopEndBeat - seg.loopStartBeat;
      b = Math.min(
        seg.loopEndBeat,
        Math.max(seg.loopStartBeat, seg.loopStartBeat + (tClamped / d) * span),
      );
    } else {
      /** Open pattern — infinite WAAPI phase maps to 0…totalBeats (matches column wrap in scheduler). */
      const d = Math.max(1e-9, seg.durMs);
      const phaseMs = ((animMs % d) + d) % d;
      b = Math.max(0, Math.min(tb, (phaseMs / d) * tb));
    }

    const ctx = input.ctx;
    if (
      ctx &&
      ctx.state === 'running' &&
      input.anchors.schedAnchorTimeRef.current > 0 &&
      input.sessionStart > 0
    ) {
      bDisplay = beatLabDisplayBeatFromAudioClock(
        ctx,
        input.anchors,
        input.sessionStart,
        input.originBeat,
        input.bpm,
        tb,
      );
      if (seamless) {
        const span = leEffective - loopStart;
        if (span > 1e-9) {
          bDisplay =
            loopStart +
            (((bDisplay - loopStart) % span) + span) % span;
        }
      } else if (!input.loopOn) {
        /** Loop brace off — pattern repeats in the scheduler; wrap HUD to pattern span (no audio splice). */
        bDisplay = ((bDisplay % tb) + tb) % tb;
      }
    } else {
      bDisplay = b;
    }
  } else {
    const ctx = input.ctx;
    if (
      ctx &&
      ctx.state !== 'closed' &&
      input.anchors.schedAnchorTimeRef.current > 0 &&
      input.sessionStart > 0
    ) {
      bDisplay = beatLabDisplayBeatFromAudioClock(
        ctx,
        input.anchors,
        input.sessionStart,
        input.originBeat,
        input.bpm,
        tb,
      );
    } else {
      bDisplay = Math.max(0, Math.min(tb, input.originBeat));
    }
    b = bDisplay;
  }

  return { b, bDisplay };
}

export function beatLabVisualBeatFromWapi(
  animMs: number,
  seg: CreationPlaylineWapiSegState,
  bpm: number,
  fallbackBeat: number,
): number {
  if (!Number.isFinite(animMs) || animMs < 0) return fallbackBeat;
  return beatFromCreationPlaylineWapiAnim(animMs, seg, bpm);
}

export function beatLabAudioNow(ctx: AudioContext): number {
  return Math.max(0, ctx.currentTime);
}

/** SE2 `quarterIndexFromBeat` / `snapBeatToQuarterGrid` — metro `nextMetroK` on loop splice. */
export function beatLabQuarterIndexFromBeat(b: number, totalBeats: number): number {
  return Math.max(0, Math.min(Math.floor(b + 1e-9), totalBeats));
}

export function beatLabSnapBeatToQuarterGrid(b: number, totalBeats: number): number {
  return Math.max(0, Math.min(beatLabQuarterIndexFromBeat(b, totalBeats), totalBeats));
}

export function beatLabTransportPlayStartAgeMs(playStartPerfMs: number): number {
  return playStartPerfMs > 0 ? performance.now() - playStartPerfMs : Number.POSITIVE_INFINITY;
}

export function beatLabShouldIgnoreLoopWrap(playStartPerfMs: number): boolean {
  return beatLabTransportPlayStartAgeMs(playStartPerfMs) < BEAT_LAB_LOOP_WRAP_IGNORE_MS;
}

/** Skip-back / return-to-start — loop brace active → loop start beat, else 0. */
export function beatLabRewindTargetBeat(loopOn: boolean, loopStartBeat: number): number {
  return loopOn ? Math.max(0, loopStartBeat) : 0;
}

export type BeatLabSeamlessLoopSpliceRefs = BeatLabSchedAnchorRefs & {
  sessionStartRef: MutableRefObject<number>;
  originBeatRef: MutableRefObject<number>;
  nextMetroKRef: MutableRefObject<number>;
  cursorBeatRef: MutableRefObject<number>;
  displayBeatRef: MutableRefObject<number>;
  perfSessionStartMsRef: MutableRefObject<number>;
  /** Keep drum step scheduler aligned after session re-anchor (Beat Lab only). */
  nextStepBeatRef?: MutableRefObject<number>;
  nextStepTimeRef?: MutableRefObject<number>;
  lastScheduledQuarterRef?: MutableRefObject<number>;
};

/**
 * SE2 seamless-loop cycle bump — re-anchor `sessionStart` + solve `originBeat` from compositor
 * phase (StudioEditor2Screen `animationTick`). Keeping sessionStart continuous drifts the step
 * grid across repeats and causes an audible skip at the loop downbeat.
 */
export function applyBeatLabSeamlessLoopSplice(
  ctx: AudioContext,
  seg: CreationPlaylineWapiSegState,
  animMs: number,
  bpm: number,
  totalBeats: number,
  refs: BeatLabSeamlessLoopSpliceRefs,
): number {
  const d = Math.max(1e-9, seg.durMs);
  const span = seg.loopEndBeat - seg.loopStartBeat;
  const phaseMs = ((animMs % d) + d) % d;
  /** Match compositor phase — never snap to loop start (that puts audio behind the playhead). */
  const bVis = Math.max(
    seg.loopStartBeat,
    Math.min(seg.loopEndBeat, seg.loopStartBeat + (phaseMs / d) * span),
  );

  const tCapture = beatLabAudioNow(ctx);
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
  if (tSmoothSnap !== null) {
    refs.originBeatRef.current = bVis - (tSmoothSnap - sessionStart) * rate;
  } else {
    refs.originBeatRef.current = bVis;
  }

  const tb = Math.max(1e-9, totalBeats);
  const bSched = beatLabLoopSpliceSchedBeat(bVis, seg.loopStartBeat, span);
  const kNext = Math.max(0, Math.floor(bSched + 1e-8));
  refs.nextMetroKRef.current = beatLabSnapBeatToQuarterGrid(
    Math.min(tb, Math.max(0, bSched)),
    tb,
  );
  refs.cursorBeatRef.current = bVis;
  refs.displayBeatRef.current = bVis;

  const spb = 60 / Math.max(1, bpm);
  if (refs.nextStepBeatRef && refs.nextStepTimeRef) {
    refs.nextStepBeatRef.current = kNext;
    refs.nextStepTimeRef.current =
      sessionStart + (kNext - refs.originBeatRef.current) * spb;
    if (refs.lastScheduledQuarterRef) {
      refs.lastScheduledQuarterRef.current = kNext - 1;
    }
  }

  if (tSmoothSnap !== null) {
    return Math.max(
      0,
      Math.min(
        tb,
        refs.originBeatRef.current +
          (tSmoothSnap - sessionStart) * rate,
      ),
    );
  }
  return bVis;
}

/** SE2 `animationTick` loop-wrap block (~4452–4584) — seamless cycle bump + discrete wrap. */
export type BeatLabAnimationTickLoopWrapInput = {
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
  seg: CreationPlaylineWapiSegState;
  playStartPerfMs: number;
  refs: BeatLabSeamlessLoopSpliceRefs & {
    nextStepBeatRef: MutableRefObject<number>;
    nextStepTimeRef: MutableRefObject<number>;
  };
  wapiLoopCycleSeenRef: MutableRefObject<number>;
  wapiPrevPhaseMsRef: MutableRefObject<number>;
  onSeamlessSplice: (ctx: AudioContext, tCapture: number) => void;
  onDiscreteWrap: (ctx: AudioContext, tCapture: number, loopStart: number) => void;
  relaunchPlaylineAtLoopStart: (loopStart: number) => void;
};

export function beatLabAnimationTickLoopWrap(
  input: BeatLabAnimationTickLoopWrapInput,
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

    if (
      (cycleBumped || phaseRewind) &&
      !beatLabShouldIgnoreLoopWrap(input.playStartPerfMs)
    ) {
      const ctxLoop = ctx;
      if (ctxLoop && ctxLoop.state !== 'closed') {
        const tCapture = beatLabAudioNow(ctxLoop);
        bDisplay = applyBeatLabSeamlessLoopSplice(
          ctxLoop,
          seg,
          animMs,
          input.bpm,
          tb,
          input.refs,
        );
        input.onSeamlessSplice(ctxLoop, tCapture);
      }

      if (ctx && ctx.state === 'running' && input.refs.schedAnchorTimeRef.current > 0) {
        const tSmoothAfter = smoothSchedNow(
          input.refs.schedAnchorTimeRef,
          input.refs.schedAnchorPerfRef,
          ctx,
        );
        bDisplay = Math.max(
          0,
          Math.min(
            tb,
            input.refs.originBeatRef.current +
              (tSmoothAfter - input.refs.sessionStartRef.current) * (input.bpm / 60),
          ),
        );
        const spanWrap = loopEnd - loopStart;
        if (spanWrap > 1e-9) {
          bDisplay =
            loopStart +
            (((bDisplay - loopStart) % spanWrap) + spanWrap) % spanWrap;
        }
      } else {
        bDisplay = bVis;
      }
      // Exact loop re-entry on the wrap frame: start at bar-1 downbeat.
      b = loopStart;
      bDisplay = loopStart;

      if (phaseRewind && !cycleBumped) {
        input.wapiLoopCycleSeenRef.current = Math.max(
          input.wapiLoopCycleSeenRef.current,
          cycle,
        );
      } else {
        input.wapiLoopCycleSeenRef.current = cycle;
      }
    }
    input.wapiPrevPhaseMsRef.current = phaseMs;
  }

  const loopBeatEps = 1e-6;
  const loopEndMsEps = 0.65;
  const segEnds =
    seg.active &&
    loopOn &&
    loopEnd === seg.loopEndBeat &&
    animMs >= Math.max(0, seg.durMs - loopEndMsEps);
  const audioPastLoopEnd = bDisplay >= loopEnd - loopBeatEps;
  const compositorPastLoopEnd = b >= loopEnd - loopBeatEps || segEnds;
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
    const ls = loopStart;
    input.refs.originBeatRef.current = ls;
    input.refs.cursorBeatRef.current = ls;
    input.refs.displayBeatRef.current = ls;
    input.refs.nextMetroKRef.current = beatLabSnapBeatToQuarterGrid(ls, tb);

    const ctxLoop = ctx;
    if (ctxLoop && ctxLoop.state !== 'closed') {
      const tCapture = beatLabAudioNow(ctxLoop);
      input.refs.sessionStartRef.current = tCapture + SE2_AUDIO_START_FLOOR_SEC;
      input.refs.schedAnchorTimeRef.current = tCapture;
      input.refs.schedAnchorPerfRef.current = performance.now();
      input.refs.perfSessionStartMsRef.current =
        performance.now() + SE2_AUDIO_START_FLOOR_SEC * 1000;
      const spb = 60 / Math.max(1, input.bpm);
      const kNext = Math.max(0, Math.floor(ls + 1e-8));
      if (input.refs.nextStepBeatRef && input.refs.nextStepTimeRef) {
        input.refs.nextStepBeatRef.current = kNext;
        input.refs.nextStepTimeRef.current =
          input.refs.sessionStartRef.current + (kNext - ls) * spb;
        if (input.refs.lastScheduledQuarterRef) {
          input.refs.lastScheduledQuarterRef.current = kNext - 1;
        }
      }
      input.onDiscreteWrap(ctxLoop, tCapture, ls);
    }

    input.relaunchPlaylineAtLoopStart(ls);
    b = ls;
    bDisplay = ls;
  }

  return { b, bDisplay };
}

/** Re-anchor audio session when NEW SYNTH infinite WAAPI repeats (Groove Lab mirror). */
export function applyBeatLabSynth2PatternLoopSplice(
  ctx: AudioContext,
  seg: BeatLabSynth2PlaylineWapiSegState,
  animMs: number,
  bpm: number,
  refs: BeatLabSeamlessLoopSpliceRefs,
): number {
  const d = Math.max(1e-9, seg.durMs);
  const tb = Math.max(1e-9, seg.totalBeats);
  const phaseMs = ((animMs % d) + d) % d;
  const bVis = Math.max(0, Math.min(tb, (phaseMs / d) * tb));

  const tCapture = beatLabAudioNow(ctx);
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
  if (tSmoothSnap !== null) {
    refs.originBeatRef.current = bVis - (tSmoothSnap - sessionStart) * rate;
  } else {
    refs.originBeatRef.current = bVis;
  }

  refs.nextMetroKRef.current = beatLabSnapBeatToQuarterGrid(Math.min(tb, Math.max(0, bVis)), tb);
  refs.cursorBeatRef.current = bVis;
  refs.displayBeatRef.current = bVis;

  const spb = 60 / Math.max(1, bpm);
  if (refs.nextStepBeatRef && refs.nextStepTimeRef) {
    reanchorNextStepWhileRunning(
      {
        nextStepBeatRef: refs.nextStepBeatRef,
        nextStepTimeRef: refs.nextStepTimeRef,
        sessionStartRef: refs.sessionStartRef,
        originBeatRef: refs.originBeatRef,
        lastScheduledQuarterRef:
          refs.lastScheduledQuarterRef ?? ({ current: Math.ceil(bVis - 1e-8) - 1 } as MutableRefObject<number>),
      },
      sessionStart,
      bVis,
      spb,
    );
    if (refs.lastScheduledQuarterRef) {
      refs.lastScheduledQuarterRef.current = Math.ceil(bVis - 1e-8) - 1;
    }
  }

  if (tSmoothSnap !== null) {
    return Math.max(
      0,
      Math.min(tb, refs.originBeatRef.current + (tSmoothSnap - sessionStart) * rate),
    );
  }
  return bVis;
}

export type BeatLabSynth2AnimationTickLoopWrapInput = {
  ctx: AudioContext | null;
  anim: Animation | null;
  seg: BeatLabSynth2PlaylineWapiSegState;
  b: number;
  bDisplay: number;
  totalBeats: number;
  bpm: number;
  loopOn: boolean;
  loopStartBeat: number;
  loopEndBeat: number;
  playStartPerfMs: number;
  refs: BeatLabSeamlessLoopSpliceRefs & {
    nextStepBeatRef: MutableRefObject<number>;
    nextStepTimeRef: MutableRefObject<number>;
    lastScheduledQuarterRef: MutableRefObject<number>;
  };
  wapiPrevPhaseMsRef: MutableRefObject<number>;
  wapiLoopCycleSeenRef: MutableRefObject<number>;
  onPatternCycle: (ctx: AudioContext, tCapture: number) => void;
  onDiscreteLoopWrap: (ctx: AudioContext, tCapture: number, loopStart: number) => void;
  seekPlaylineToBeat: (beat: number) => void;
};

/** NEW SYNTH loop handling — infinite WAAPI cycle + optional loop-brace discrete wrap. */
export function beatLabSynth2AnimationTickLoopWrap(
  input: BeatLabSynth2AnimationTickLoopWrapInput,
): { b: number; bDisplay: number } {
  let { b, bDisplay } = input;
  const {
    anim,
    seg,
    ctx,
    totalBeats: tb,
    loopOn,
    loopStartBeat: loopStart,
    loopEndBeat: loopEnd,
    playStartPerfMs,
  } = input;

  if (
    anim &&
    anim.playState === 'running' &&
    beatLabSynth2PlaylineWapiLoopWrapped(anim, input.wapiPrevPhaseMsRef, input.wapiLoopCycleSeenRef) &&
    !beatLabShouldIgnoreLoopWrap(playStartPerfMs)
  ) {
    const ctxLoop = ctx;
    if (ctxLoop && ctxLoop.state !== 'closed') {
      const animMs = Number(anim.currentTime ?? 0);
      const tCapture = beatLabAudioNow(ctxLoop);
      bDisplay = applyBeatLabSynth2PatternLoopSplice(
        ctxLoop,
        seg,
        animMs,
        input.bpm,
        input.refs,
      );
      input.onPatternCycle(ctxLoop, tCapture);
      if (ctxLoop.state === 'running' && input.refs.schedAnchorTimeRef.current > 0) {
        const tSmoothAfter = smoothSchedNow(
          input.refs.schedAnchorTimeRef,
          input.refs.schedAnchorPerfRef,
          ctxLoop,
        );
        bDisplay = Math.max(
          0,
          Math.min(
            tb,
            input.refs.originBeatRef.current +
              (tSmoothAfter - input.refs.sessionStartRef.current) * (input.bpm / 60),
          ),
        );
      }
      const d = Math.max(1e-9, seg.durMs);
      const phaseMs = ((animMs % d) + d) % d;
      b = Math.max(0, Math.min(tb, (phaseMs / d) * tb));
    }
  }

  const loopBeatEps = 1e-6;
  const le = Math.min(loopEnd, tb);
  /** Partial loop brace only — full-pattern repeat uses WAAPI cycle splice above. */
  if (loopOn && le > loopStart && le < tb - 1e-6 && bDisplay >= le - loopBeatEps) {
    const ls = loopStart;
    input.refs.originBeatRef.current = ls;
    input.refs.cursorBeatRef.current = ls;
    input.refs.displayBeatRef.current = ls;
    input.refs.nextMetroKRef.current = beatLabSnapBeatToQuarterGrid(ls, tb);

    const ctxLoop = ctx;
    if (ctxLoop && ctxLoop.state !== 'closed') {
      const tCapture = beatLabAudioNow(ctxLoop);
      input.refs.sessionStartRef.current = tCapture + SE2_AUDIO_START_FLOOR_SEC;
      input.refs.schedAnchorTimeRef.current = tCapture;
      input.refs.schedAnchorPerfRef.current = performance.now();
      input.refs.perfSessionStartMsRef.current =
        performance.now() + SE2_AUDIO_START_FLOOR_SEC * 1000;
      const spb = 60 / Math.max(1, input.bpm);
      reanchorNextStepWhileRunning(
        {
          nextStepBeatRef: input.refs.nextStepBeatRef,
          nextStepTimeRef: input.refs.nextStepTimeRef,
          sessionStartRef: input.refs.sessionStartRef,
          originBeatRef: input.refs.originBeatRef,
          lastScheduledQuarterRef: input.refs.lastScheduledQuarterRef,
        },
        input.refs.sessionStartRef.current,
        ls,
        spb,
      );
      input.onDiscreteLoopWrap(ctxLoop, tCapture, ls);
    }

    input.seekPlaylineToBeat(ls);
    b = ls;
    bDisplay = ls;
  }

  return { b, bDisplay };
}
