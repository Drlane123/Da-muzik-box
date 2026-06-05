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
  SE2_AUDIO_START_FLOOR_SEC,
} from '@/app/lib/creationStation/creationTransportSystem';
import { beatAtSessionTime } from '@/app/lib/creationStation/creationTransportSync';
import {
  beatFromCreationPlaylineWapiAnim,
  type CreationPlaylineWapiSegState,
} from '@/app/lib/creationStation/creationPlaylineWapi';
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
    const seamless =
      seg.seamlessLoop &&
      input.loopOn &&
      seg.active &&
      loopEnd > loopStart &&
      loopEnd === seg.loopEndBeat &&
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

/** Wall time the compositor ran before `ensureCtx()` finished (Play starts WAAPI first). */
export function beatLabCompositorLeadSec(playStartPerfMs: number, maxSec = 0.2): number {
  if (playStartPerfMs <= 0) return 0;
  return Math.min(maxSec, Math.max(0, (performance.now() - playStartPerfMs) / 1000));
}

/**
 * Backdate `sessionStart` so the audio clock matches the compositor position when the context wakes up.
 * First click still schedules at `max(sessionStart, ctSnap + floor)` — cannot play in the past.
 */
export function beatLabSessionStartAfterCompositorFirst(
  tNow: number,
  compositorLeadSec: number,
): number {
  return tNow + SE2_AUDIO_START_FLOOR_SEC - compositorLeadSec;
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
};

/** SE2 seamless-loop cycle bump (~4470–4516). */
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
  const bVis = Math.max(
    seg.loopStartBeat,
    Math.min(seg.loopEndBeat, seg.loopStartBeat + (phaseMs / d) * span),
  );

  const tCapture = beatLabAudioNow(ctx);
  refs.sessionStartRef.current = tCapture + SE2_AUDIO_START_FLOOR_SEC;
  refs.schedAnchorTimeRef.current = tCapture;
  refs.schedAnchorPerfRef.current = performance.now();
  refs.perfSessionStartMsRef.current =
    performance.now() + SE2_AUDIO_START_FLOOR_SEC * 1000;

  const rate = Math.max(1, bpm) / 60;
  let bDisplay = bVis;
  if (refs.schedAnchorTimeRef.current > 0) {
    const tSmoothSnap = smoothSchedNow(
      refs.schedAnchorTimeRef,
      refs.schedAnchorPerfRef,
      ctx,
    );
    refs.originBeatRef.current =
      bVis - (tSmoothSnap - refs.sessionStartRef.current) * rate;
    bDisplay = beatAtSessionTime(
      tSmoothSnap,
      refs.sessionStartRef.current,
      refs.originBeatRef.current,
      bpm,
    );
  } else {
    refs.originBeatRef.current = bVis;
  }

  const tb = Math.max(1e-9, totalBeats);
  refs.nextMetroKRef.current = beatLabSnapBeatToQuarterGrid(
    Math.min(tb, Math.max(0, bVis)),
    tb,
  );
  refs.cursorBeatRef.current = bVis;
  refs.displayBeatRef.current = bDisplay;
  return bDisplay;
}
