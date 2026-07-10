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
 * - **Limited catch-up**: a few overdue in-session quarters are still scheduled (near `ctSnap`)
 *   so pad hits are not dropped when the UI thread hiccups; very late steps are fast-forwarded.
 * - **SE2 chain rule**: `chain = ctSnap + SE2_AUDIO_START_FLOOR_SEC`, each event
 *   `t0 = max(tGrid, chain)`, then `chain = t0 + METRO_NODE_EPS` (see project DAW sync rules).
 *
 * UI BAR/MSR/time: `smoothSchedNow` → `beatAtSessionTime` in the RAF pump (SE2 `bDisplay` contract).
 * Playline motion: WAAPI compositor only (`creationPlaylineWapi`).
 */

import type { MutableRefObject } from 'react';

import {
  beatLabAdvanceSampleDrumQuarter,
  beatLabGridSampleFromBeat,
  beatLabGridTimeFromBeat,
  beatLabGridTimeFromSample,
  beatLabSampleScheduleFloorSec,
  beatLabSamplesPerBeat,
  type BeatLabSampleLoopBoundary,
} from '@/app/lib/creationStation/beatLabSampleAccurateDrumClock';
import { SE2_AUDIO_START_FLOOR_SEC } from '@/app/lib/studio/se2TransportClock';

export { SE2_AUDIO_START_FLOOR_SEC };

/** Must stay aligned with Studio Editor 2 metronome lookahead. */
export const CREATION_SCHEDULE_AHEAD_SEC = 3.0;

/** Same spacing as SE2 `refillMetronome` — prevents stacked oscillator starts. */
export const CREATION_METRO_NODE_EPS_SEC = 1e-5;

/** SE2 `LOOP_METRO_CHAIN_FLOOR_SEC` — tighter chain after loop wrap refill (no session reanchor). */
export const CREATION_LOOP_CHAIN_FLOOR_SEC = 0.002;

export type CreationTransportSampleDrumOpts = {
  sampleRate: number;
  nextStepSampleRef: MutableRefObject<number>;
  loopBoundary: BeatLabSampleLoopBoundary;
};

export type CreationTransportRefillOpts = {
  loopContinuation?: boolean;
  /** @deprecated Always silent fast-forward; kept for call-site compatibility. */
  skipOverdueCatchUp?: boolean;
  /** Beat Lab drum grid — integer sample grid + phase-compensated loop wrap. */
  sampleDrum?: CreationTransportSampleDrumOpts;
};

export const CREATION_MAX_SCHEDULE_PER_CALL = 256;

/** Max lateness (in beats) before a quarter is fast-forwarded instead of burst-scheduled at `now`. */
const CREATION_CATCHUP_MAX_LATE_BEATS = 0.125;

/** Max overdue quarters considered per refill (each must be only slightly late — see lateness gate). */
export const CREATION_MAX_CATCHUP_QUARTERS_PER_REFILL = 4;

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
 * Map a pattern step column → `AudioContext` time from the live session anchor.
 * Use this for MIDI-roll voices (chords / bass) so they cannot drift from `nextStepBeat`
 * corrections while still looking correct on the piano roll grid.
 */
export function creationPatternColAudioTime(
  colInPattern: number,
  subdiv: number,
  spb: number,
  sessionStart: number,
  originBeat: number,
  patternStartBeat: number,
): number {
  if (sessionStart <= 0) return 0;
  const s = Math.max(1, Math.round(subdiv));
  const globalBeat = patternStartBeat + colInPattern / s;
  return sessionStart + (globalBeat - originBeat) * spb;
}

/**
 * Keep `nextStepBeat` / `nextStepTime` tied to the audio session clock. Drift (BPM change, heavy
 * frames, loop wrap) can leave the scheduler far ahead (silence) or behind (burst at `currentTime`).
 */
function alignCreationTransportStepClock(
  ctSnap: number,
  spb: number,
  refs: CreationTransportClockRefs,
  sampleDrum?: CreationTransportSampleDrumOpts,
  loopContinuation = false,
): { k: number; tGrid: number } {
  const sessionStart = refs.sessionStartRef.current;
  const origin = refs.originBeatRef.current;
  const bpm = 60 / Math.max(1e-9, spb);
  const sampleRate = sampleDrum?.sampleRate ?? 0;
  const useSamples = sampleDrum != null && sampleRate > 0;

  if (sessionStart <= 0) {
    const k = Math.ceil(Math.max(0, origin) - 1e-8);
    return { k, tGrid: 0 };
  }

  const beatNow = origin + Math.max(0, ctSnap - sessionStart) / spb;
  const kAudio = Math.ceil(beatNow - 1e-8);
  let k = refs.nextStepBeatRef.current;
  let tGrid = refs.nextStepTimeRef.current;

  const gridTimeForK = (beatIndex: number): number =>
    useSamples
      ? beatLabGridTimeFromSample(
          beatLabGridSampleFromBeat(sessionStart, origin, beatIndex, bpm, sampleRate),
          sampleRate,
        )
      : sessionStart + (beatIndex - origin) * spb;

  if (!Number.isFinite(tGrid) || tGrid <= 0) {
    k = kAudio;
    tGrid = gridTimeForK(k);
    if (useSamples && sampleDrum) {
      sampleDrum.nextStepSampleRef.current = beatLabGridSampleFromBeat(
        sessionStart,
        origin,
        k,
        bpm,
        sampleRate,
      );
    }
    return { k, tGrid };
  }

  const expectedTGrid = gridTimeForK(k);
  const driftThreshold = useSamples
    ? beatLabSamplesPerBeat(bpm, sampleRate) * 0.02 / sampleRate
    : spb * 0.02;
  /*
   * Loop splice / seek re-seeds `sessionStart` + `originBeat` but can leave a stale absolute
   * `nextStepTime` from the prior session — drums then sit silent until that old timestamp.
   */
  if (Math.abs(tGrid - expectedTGrid) > driftThreshold) {
    tGrid = expectedTGrid;
    if (useSamples && sampleDrum) {
      sampleDrum.nextStepSampleRef.current = beatLabGridSampleFromBeat(
        sessionStart,
        origin,
        k,
        bpm,
        sampleRate,
      );
    }
  }

  const maxAheadBeats = Math.ceil(CREATION_SCHEDULE_AHEAD_SEC / spb) + 4;
  /*
   * Never jump `k` forward over unplayed quarters (farBehind fast-forward caused audible skips).
   * Lookahead refill catch-up schedules overdue steps; only reset runaway *ahead* state.
   */
  if (k > kAudio + maxAheadBeats || tGrid > ctSnap + CREATION_SCHEDULE_AHEAD_SEC + spb * 2) {
    k = kAudio;
    tGrid = gridTimeForK(k);
    refs.lastScheduledQuarterRef.current = k - 1;
    if (useSamples && sampleDrum) {
      sampleDrum.nextStepSampleRef.current = beatLabGridSampleFromBeat(
        sessionStart,
        origin,
        k,
        bpm,
        sampleRate,
      );
    }
  } else if (
    loopContinuation &&
    k > kAudio + 1 &&
    tGrid > ctSnap + spb * 0.125
  ) {
    /** Loop wrap only — stale lap index after session re-anchor; never snap during normal lookahead. */
    k = kAudio;
    tGrid = gridTimeForK(k);
    refs.lastScheduledQuarterRef.current = k - 1;
    if (useSamples && sampleDrum) {
      sampleDrum.nextStepSampleRef.current = beatLabGridSampleFromBeat(
        sessionStart,
        origin,
        k,
        bpm,
        sampleRate,
      );
    }
  } else if (tGrid < ctSnap - spb * 0.125) {
    /** Lagging grid time — keep `k`, re-derive `tGrid` so refill can emit catch-up hits. */
    tGrid = gridTimeForK(k);
    if (useSamples && sampleDrum) {
      sampleDrum.nextStepSampleRef.current = beatLabGridSampleFromBeat(
        sessionStart,
        origin,
        k,
        bpm,
        sampleRate,
      );
    }
  } else if (useSamples && sampleDrum) {
    sampleDrum.nextStepSampleRef.current = beatLabGridSampleFromBeat(
      sessionStart,
      origin,
      k,
      bpm,
      sampleRate,
    );
    tGrid = beatLabGridTimeFromSample(sampleDrum.nextStepSampleRef.current, sampleRate);
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

  const sampleDrum = opts?.sampleDrum;
  const sampleRate = sampleDrum?.sampleRate ?? 0;
  const useSamples = sampleDrum != null && sampleRate > 0;
  const bpm = 60 / Math.max(1e-9, spb);

  const horizon = ctSnap + CREATION_SCHEDULE_AHEAD_SEC;
  const chainFloor = opts?.loopContinuation ? CREATION_LOOP_CHAIN_FLOOR_SEC : SE2_AUDIO_START_FLOOR_SEC;
  let chain = useSamples
    ? beatLabSampleScheduleFloorSec(ctSnap, sampleRate, chainFloor)
    : ctSnap + chainFloor;
  let { k, tGrid } = alignCreationTransportStepClock(
    ctSnap,
    spb,
    refs,
    sampleDrum,
    opts?.loopContinuation === true,
  );

  const scheduleFloor = useSamples
    ? beatLabSampleScheduleFloorSec(ctSnap, sampleRate, chainFloor)
    : ctSnap + chainFloor;
  const sessionStart = refs.sessionStartRef.current;
  const origin = refs.originBeatRef.current;
  let n = 0;
  let catchUpQuarters = 0;

  const advanceQuarter = (): void => {
    if (useSamples && sampleDrum) {
      const next = beatLabAdvanceSampleDrumQuarter(k, sessionStart, origin, bpm, sampleRate);
      k = next.k;
      tGrid = next.tGrid;
      sampleDrum.nextStepSampleRef.current = next.nextStepSample;
      return;
    }
    k += 1;
    tGrid = sessionStart + (k - origin) * spb;
  };
  /** Metro uses tighter chain on loop wrap; drums still catch up the live quarter (SE2 `refillMetronome` pattern). */
  const skipCatchUp = opts?.skipOverdueCatchUp === true;
  /**
   * Strict `<` for beat-0 at `sessionStart` (`<=` skipped beat-0 → silence then burst).
   */
  while (
    !skipCatchUp &&
    tGrid < scheduleFloor &&
    catchUpQuarters < CREATION_MAX_CATCHUP_QUARTERS_PER_REFILL
  ) {
    if (sessionStart > 0 && tGrid >= sessionStart - 1e-6) {
      const latenessBeats = (ctSnap - tGrid) / Math.max(1e-9, spb);
      if (latenessBeats > CREATION_CATCHUP_MAX_LATE_BEATS) {
        advanceQuarter();
        continue;
      }
      const catchFloor = useSamples ? scheduleFloor : ctSnap + chainFloor;
      const t0 = Math.max(tGrid, catchFloor);
      if (!fireStep(k, t0, ctx)) break;
      refs.lastScheduledQuarterRef.current = k;
      catchUpQuarters += 1;
      n += 1;
    }
    advanceQuarter();
  }
  while (!skipCatchUp && tGrid < scheduleFloor) {
    advanceQuarter();
  }

  while (n < CREATION_MAX_SCHEDULE_PER_CALL) {
    if (tGrid >= horizon) break;
    const t0 = Math.max(tGrid, chain);
    if (!fireStep(k, t0, ctx)) break;
    chain = t0 + CREATION_METRO_NODE_EPS_SEC;
    refs.lastScheduledQuarterRef.current = k;
    advanceQuarter();
    n += 1;
  }
  refs.nextStepBeatRef.current = k;
  refs.nextStepTimeRef.current = tGrid;
}

/**
 * SE2 `refillMetronome` — dedicated quarter click queue (not tied to drum `fireStep`).
 */
function beatLabMetroLoopActive(boundary?: BeatLabSampleLoopBoundary): boolean {
  return (
    boundary?.loopOn === true &&
    boundary.loopEndBeat > boundary.loopStartBeat
  );
}

function beatLabMetroGridTime(
  k: number,
  sessionStart: number,
  origin: number,
  spb: number,
  sampleDrum?: CreationTransportSampleDrumOpts,
): number {
  if (sampleDrum && sampleDrum.sampleRate > 0) {
    const bpm = 60 / Math.max(1e-9, spb);
    return beatLabGridTimeFromBeat(
      sessionStart,
      origin,
      k,
      bpm,
      sampleDrum.sampleRate,
    );
  }
  return sessionStart + (k - origin) * spb;
}

export function refillCreationMetronome(
  ctx: AudioContext,
  ctSnap: number,
  spb: number,
  refs: CreationMetronomeClockRefs,
  playClick: (k: number, idealGridT: number, ctx: AudioContext) => void,
  isRunning: () => boolean,
  isMetroOn: () => boolean,
  opts?: CreationTransportRefillOpts,
  totalBeats = Number.POSITIVE_INFINITY,
): void {
  if (!isRunning() || !isMetroOn()) return;

  const sampleDrum = opts?.sampleDrum;
  const sampleRate = sampleDrum?.sampleRate ?? 0;
  const useSamples = sampleDrum != null && sampleRate > 0;
  const loopActive = beatLabMetroLoopActive(sampleDrum?.loopBoundary);

  const origin = refs.originBeatRef.current;
  const sessionStart = refs.sessionStartRef.current;
  const horizon = ctSnap + CREATION_SCHEDULE_AHEAD_SEC;
  const tb = Math.max(0, totalBeats);
  const chainFloor = opts?.loopContinuation ? CREATION_LOOP_CHAIN_FLOOR_SEC : SE2_AUDIO_START_FLOOR_SEC;
  let chain = useSamples
    ? beatLabSampleScheduleFloorSec(ctSnap, sampleRate, chainFloor)
    : ctSnap + chainFloor;
  let n = 0;

  const gridTime = (k: number): number =>
    beatLabMetroGridTime(k, sessionStart, origin, spb, sampleDrum);

  /** Looping patterns repeat — do not stop metro at `totalBeats` (that silenced lap 2+). */
  while (loopActive || refs.nextMetroKRef.current <= tb) {
    const tNextQuarter = gridTime(refs.nextMetroKRef.current + 1);
    if (tNextQuarter > ctSnap) break;
    refs.nextMetroKRef.current += 1;
    if (!loopActive && refs.nextMetroKRef.current > tb) break;
  }

  while (n < CREATION_MAX_METRO_SCHEDULE_PER_CALL) {
    const k = refs.nextMetroKRef.current;
    if (!loopActive && k > tb) break;
    const tGrid = gridTime(k);
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
