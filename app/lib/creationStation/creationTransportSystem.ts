/**
 * Creation Station transport — **behavioral mirror** of Studio Editor 2 scheduling rules, implemented
 * **only** under `app/lib/creationStation/` + `CreationStationScreen`. Do **not** import or edit
 * `StudioEditor2Screen.tsx` from here; parity is maintained by matching contracts (e.g. chain floor,
 * lookahead seconds) and the shared numeric constant `SE2_AUDIO_START_FLOOR_SEC` from
 * `@/app/lib/studio/se2TransportClock` (constants only — not the SE2 UI).
 *
 * Creation Station transport (new):
 * - **Audio master**: `AudioContext.currentTime` + lookahead refill.
 * - **Monotonic step clock**: `nextStepBeat` + `nextStepTime` advance in lockstep after scheduling.
 * - **No audible catch-up**: overdue quarters are skipped (step clock fast-forwards to audio time).
 *   Emitting overdue steps at `ctx.currentTime` caused silence-then-burst / off-tempo drum piles.
 * - **SE2 chain rule**: `chain = ctSnap + SE2_AUDIO_START_FLOOR_SEC`, each event
 *   `t0 = max(tGrid, chain)`, then `chain = t0 + METRO_NODE_EPS` (see project DAW sync rules).
 *
 * UI BAR/MSR/time: `smoothSchedNow` → `beatAtSessionTime` in the RAF pump (SE2 `bDisplay` contract).
 * Playline motion: WAAPI compositor only (`creationPlaylineWapi`).
 */

import type { MutableRefObject } from 'react';

import { SE2_AUDIO_START_FLOOR_SEC } from '@/app/lib/studio/se2TransportClock';

export { SE2_AUDIO_START_FLOOR_SEC };

/** Must stay aligned with Studio Editor 2 metronome lookahead. */
export const CREATION_SCHEDULE_AHEAD_SEC = 3.0;

/** Same spacing as SE2 `refillMetronome` — prevents stacked oscillator starts. */
export const CREATION_METRO_NODE_EPS_SEC = 1e-5;

/** SE2 `LOOP_METRO_CHAIN_FLOOR_SEC` — tighter chain after loop wrap refill (no session reanchor). */
export const CREATION_LOOP_CHAIN_FLOOR_SEC = 0.002;

export type CreationTransportRefillOpts = {
  loopContinuation?: boolean;
  /** @deprecated Always silent fast-forward; kept for call-site compatibility. */
  skipOverdueCatchUp?: boolean;
};

export const CREATION_MAX_SCHEDULE_PER_CALL = 256;

export interface CreationTransportClockRefs {
  nextStepBeatRef: MutableRefObject<number>;
  nextStepTimeRef: MutableRefObject<number>;
  sessionStartRef: MutableRefObject<number>;
  originBeatRef: MutableRefObject<number>;
  lastScheduledQuarterRef: MutableRefObject<number>;
}

export interface CreationMetronomeClockRefs {
  nextMetroKRef: MutableRefObject<number>;
  sessionStartRef: MutableRefObject<number>;
  originBeatRef: MutableRefObject<number>;
}

const CREATION_MAX_METRO_SCHEDULE_PER_CALL = 256;

export function resetCreationTransportStepClock(refs: Pick<CreationTransportClockRefs, 'nextStepBeatRef' | 'nextStepTimeRef'>): void {
  refs.nextStepBeatRef.current = 0;
  refs.nextStepTimeRef.current = 0;
}

/** Call after `sessionStartRef` is set for play. */
export function seedCreationTransportOnPlay(
  refs: Pick<CreationTransportClockRefs, 'nextStepBeatRef' | 'nextStepTimeRef'>,
  originBeat: number,
  sessionStartAudio: number,
  spb: number,
): void {
  const k = Math.ceil(originBeat - 1e-8);
  refs.nextStepBeatRef.current = k;
  refs.nextStepTimeRef.current = sessionStartAudio + (k - originBeat) * spb;
}

/** While transport is running and user seeks — keeps next step aligned with new origin / session start. */
export function reanchorNextStepWhileRunning(
  refs: CreationTransportClockRefs,
  sessionStartAudio: number,
  seekBeat: number,
  spb: number,
): void {
  const k = Math.ceil(seekBeat - 1e-8);
  refs.nextStepBeatRef.current = k;
  refs.nextStepTimeRef.current = sessionStartAudio + (k - refs.originBeatRef.current) * spb;
}

export function reanchorNextStepWhileStopped(
  refs: Pick<CreationTransportClockRefs, 'nextStepBeatRef' | 'nextStepTimeRef'>,
  seekBeat: number,
): void {
  refs.nextStepBeatRef.current = Math.floor(seekBeat + 1e-8);
  refs.nextStepTimeRef.current = 0;
}

/**
 * Keep `nextStepBeat` / `nextStepTime` tied to the audio session clock. Drift (BPM change, heavy
 * frames, loop wrap) can leave the scheduler far ahead (silence) or behind (burst at `currentTime`).
 */
function alignCreationTransportStepClock(
  ctSnap: number,
  spb: number,
  refs: CreationTransportClockRefs,
): { k: number; tGrid: number } {
  const sessionStart = refs.sessionStartRef.current;
  const origin = refs.originBeatRef.current;

  if (sessionStart <= 0) {
    const k = Math.ceil(Math.max(0, origin) - 1e-8);
    return { k, tGrid: 0 };
  }

  const beatNow = origin + Math.max(0, ctSnap - sessionStart) / spb;
  const kAudio = Math.ceil(beatNow - 1e-8);
  let k = refs.nextStepBeatRef.current;
  let tGrid = refs.nextStepTimeRef.current;

  if (!Number.isFinite(tGrid) || tGrid <= 0) {
    k = kAudio;
    tGrid = sessionStart + (k - origin) * spb;
    return { k, tGrid };
  }

  const maxAheadBeats = Math.ceil(CREATION_SCHEDULE_AHEAD_SEC / spb) + 4;
  if (k < kAudio - 1 || k > kAudio + maxAheadBeats || tGrid > ctSnap + CREATION_SCHEDULE_AHEAD_SEC + spb * 2) {
    k = kAudio;
    tGrid = sessionStart + (k - origin) * spb;
  } else if (tGrid < ctSnap - spb * 0.125) {
    /** More than ~1/8 beat behind audio — catch up without resetting on every boundary touch. */
    k = kAudio;
    tGrid = sessionStart + (k - origin) * spb;
  }

  return { k, tGrid };
}

/**
 * Lookahead refill. `fireStep(k, t0, ctx)` schedules one quarter: return `false` to stop chaining.
 */
export function refillCreationTransportLookahead(
  ctx: AudioContext,
  ctSnap: number,
  spb: number,
  refs: CreationTransportClockRefs,
  fireStep: (k: number, idealGridT: number, ctx: AudioContext) => boolean,
  isRunning: () => boolean,
  opts?: CreationTransportRefillOpts,
): void {
  if (!isRunning()) return;

  const horizon = ctSnap + CREATION_SCHEDULE_AHEAD_SEC;
  const chainFloor = opts?.loopContinuation ? CREATION_LOOP_CHAIN_FLOOR_SEC : SE2_AUDIO_START_FLOOR_SEC;
  let chain = ctSnap + chainFloor;
  let { k, tGrid } = alignCreationTransportStepClock(ctSnap, spb, refs);

  const scheduleFloor = ctSnap + chainFloor;
  /** Strict `<` — `tGrid === scheduleFloor` is beat-0 at `sessionStart`; `<=` skipped it → silence then burst. */
  while (tGrid < scheduleFloor) {
    k += 1;
    tGrid = sessionStart + (k - origin) * spb;
  }

  let n = 0;
  while (n < CREATION_MAX_SCHEDULE_PER_CALL) {
    if (tGrid >= horizon) break;
    const t0 = Math.max(tGrid, chain);
    if (!fireStep(k, t0, ctx)) break;
    chain = t0 + CREATION_METRO_NODE_EPS_SEC;
    refs.lastScheduledQuarterRef.current = k;
    k += 1;
    tGrid = sessionStart + (k - origin) * spb;
    n += 1;
  }
  refs.nextStepBeatRef.current = k;
  refs.nextStepTimeRef.current = tGrid;
}

/**
 * SE2 `refillMetronome` — dedicated quarter click queue (not tied to drum `fireStep`).
 */
export function refillCreationMetronome(
  ctx: AudioContext,
  ctSnap: number,
  spb: number,
  refs: CreationMetronomeClockRefs,
  playClick: (k: number, idealGridT: number, ctx: AudioContext) => void,
  isRunning: () => boolean,
  isMetroOn: () => boolean,
  opts?: CreationTransportRefillOpts,
): void {
  if (!isRunning() || !isMetroOn()) return;

  const origin = refs.originBeatRef.current;
  const sessionStart = refs.sessionStartRef.current;
  const horizon = ctSnap + CREATION_SCHEDULE_AHEAD_SEC;
  const chainFloor = opts?.loopContinuation ? CREATION_LOOP_CHAIN_FLOOR_SEC : SE2_AUDIO_START_FLOOR_SEC;
  let chain = ctSnap + chainFloor;
  let n = 0;

  while (true) {
    const tNextQuarter = sessionStart + (refs.nextMetroKRef.current + 1 - origin) * spb;
    if (tNextQuarter > ctSnap) break;
    refs.nextMetroKRef.current += 1;
  }

  while (n < CREATION_MAX_METRO_SCHEDULE_PER_CALL) {
    const k = refs.nextMetroKRef.current;
    const tGrid = sessionStart + (k - origin) * spb;
    if (tGrid >= horizon) break;
    const t0 = Math.max(tGrid, chain);
    try {
      playClick(k, t0, ctx);
    } catch {
      break;
    }
    chain = t0 + CREATION_METRO_NODE_EPS_SEC;
    refs.nextMetroKRef.current = k + 1;
    n += 1;
  }
}
