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
 * - **Catch-up**: if the main thread stalls and `idealGridT` is already past `ctSnap`, we still call
 *   `fireStep` for each missed quarter (capped per refill) so beats are not silently dropped — `fireStep`
 *   clamps to `ctx.currentTime` for audible time.
 * - **SE2 chain rule**: `chain = ctSnap + SE2_AUDIO_START_FLOOR_SEC`, each event
 *   `t0 = max(tGrid, chain)`, then `chain = t0 + METRO_NODE_EPS` (see project DAW sync rules).
 *
 * UI playhead / grid: `beatAtSessionTime(ctx.currentTime)` in the RAF pump (see `useCreationTransportPump`).
 */

import type { MutableRefObject } from 'react';

import { SE2_AUDIO_START_FLOOR_SEC } from '@/app/lib/studio/se2TransportClock';

export { SE2_AUDIO_START_FLOOR_SEC };

/** Must stay aligned with Studio Editor 2 metronome lookahead. */
export const CREATION_SCHEDULE_AHEAD_SEC = 3.0;

/** Same spacing as SE2 `refillMetronome` — prevents stacked oscillator starts. */
export const CREATION_METRO_NODE_EPS_SEC = 1e-5;

export const CREATION_MAX_SCHEDULE_PER_CALL = 256;

/**
 * Max overdue quarters we actually emit per refill when JS was late.
 * Too low → we jump the step clock forward without firing (feels like a skip). Too high → bursty catch-up.
 */
/** SE2-style catch-up tail; too small → step clock jumps without audible steps (felt as skip). */
const CREATION_MAX_EMIT_OVERDUE_PER_CALL = 12;

export interface CreationTransportClockRefs {
  nextStepBeatRef: MutableRefObject<number>;
  nextStepTimeRef: MutableRefObject<number>;
  sessionStartRef: MutableRefObject<number>;
  originBeatRef: MutableRefObject<number>;
  lastScheduledQuarterRef: MutableRefObject<number>;
}

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
 * Lookahead refill. `fireStep(k, t0, ctx)` schedules one quarter: return `false` to stop chaining.
 */
export function refillCreationTransportLookahead(
  ctx: AudioContext,
  ctSnap: number,
  spb: number,
  refs: CreationTransportClockRefs,
  fireStep: (k: number, idealGridT: number, ctx: AudioContext) => boolean,
  isRunning: () => boolean,
): void {
  if (!isRunning()) return;

  const horizon = ctSnap + CREATION_SCHEDULE_AHEAD_SEC;
  let chain = ctSnap + SE2_AUDIO_START_FLOOR_SEC;
  let k = refs.nextStepBeatRef.current;
  let tGrid = refs.nextStepTimeRef.current;

  if (!Number.isFinite(tGrid) || tGrid <= 0) {
    const sessionStart = refs.sessionStartRef.current;
    const origin = refs.originBeatRef.current;
    k = Math.ceil(origin - 1e-8);
    tGrid = sessionStart + (k - origin) * spb;
  }

  /**
   * If we're far behind, drop old backlog first (can't schedule in the past anyway),
   * then emit only a tiny overdue tail so timing recovers without bursty "machine-gun" hits.
   */
  if (tGrid <= ctSnap) {
    const overdue = Math.floor((ctSnap - tGrid) / spb) + 1;
    const drop = Math.max(0, overdue - CREATION_MAX_EMIT_OVERDUE_PER_CALL);
    if (drop > 0) {
      k += drop;
      tGrid += drop * spb;
    }
  }

  let overdueEmitted = 0;
  while (tGrid <= ctSnap && overdueEmitted < CREATION_MAX_EMIT_OVERDUE_PER_CALL) {
    const t0 = Math.max(tGrid, chain);
    if (!fireStep(k, t0, ctx)) {
      refs.nextStepBeatRef.current = k;
      refs.nextStepTimeRef.current = tGrid;
      return;
    }
    chain = t0 + CREATION_METRO_NODE_EPS_SEC;
    refs.lastScheduledQuarterRef.current = k;
    k += 1;
    tGrid += spb;
    overdueEmitted += 1;
  }

  let n = 0;
  while (n < CREATION_MAX_SCHEDULE_PER_CALL) {
    if (tGrid >= horizon) break;
    const t0 = Math.max(tGrid, chain);
    if (!fireStep(k, t0, ctx)) break;
    chain = t0 + CREATION_METRO_NODE_EPS_SEC;
    refs.lastScheduledQuarterRef.current = k;
    k += 1;
    tGrid += spb;
    n += 1;
  }
  refs.nextStepBeatRef.current = k;
  refs.nextStepTimeRef.current = tGrid;
}
