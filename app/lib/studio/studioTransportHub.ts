/**
 * Studio transport hub — **single authority** for how Studio reads master transport (web analogue of
 * musio-create’s `DAWCore`: one clock, one phase sample per paint/schedule).
 *
 * Rules (same spirit as [musio-create](https://github.com/mpatti/musio-create), adapted to Web Audio):
 * - Sample phase with `getStudioTransportSyncSnapshotAtAudioNow(t)` using the **same** `t` the master
 *   uses (`AudioContext.currentTime`, or the `t` passed from `subscribeStudioPlayheadFrame`).
 * - **Never** monotonic-clamp quarter-float for display (`Math.max(lastBeat, trueBeat)`): the metronome
 *   and `tickFloat` follow the real clock; clamping only makes the cyan line **late** vs clicks.
 *
 * MasterClock still owns `originBeatFloat`, `mapGlobalTickToAudioTime`, and MET — this module is only
 * the Studio-facing façade so every reader goes through one place.
 */
import type { StudioTransportSyncSnapshot } from '@/app/context/MasterClockContext';
import { PPQ } from '@/app/context/MasterClockContext';
import { readStudioTransportSnapshotForUi } from '@/app/lib/studioPlayheadSharedFrame';

/**
 * Continuous quarter-beat on the Studio **pixel** grid (cyan line, 1–4 ruler) — same **display**
 * phase as main transport HUD + MET downbeat math (`transportBeatFloatGrid` / loop wrap), not raw
 * unwrapped `tickFloat` (which can diverge from the audible 1–2–3–4 count when loop is on).
 */
export function studioGridBeatFloatFromSnapshot(
  snap: StudioTransportSyncSnapshot,
): number {
  if (Number.isFinite(snap.displayTickFloat) && snap.displayTickFloat >= 0) {
    return Math.max(0, snap.displayTickFloat / PPQ);
  }
  if (Number.isFinite(snap.displayBeatFloatGrid)) {
    return Math.max(0, snap.displayBeatFloatGrid);
  }
  if (Number.isFinite(snap.tickFloat)) {
    return Math.max(0, snap.tickFloat) / PPQ;
  }
  return Number.isFinite(snap.beatFloat) ? Math.max(0, snap.beatFloat) : 0;
}

/** Canonical beat from graph tick float — phase checks vs `metronomeNextQuarterTick`. */
export function studioCanonicalBeatFromSnapshot(
  snap: StudioTransportSyncSnapshot,
): number {
  if (Number.isFinite(snap.tickFloat)) return Math.max(0, snap.tickFloat) / PPQ;
  return Math.max(0, snap.beatFloat);
}

export function readStudioTransportPhaseForEngine(input: {
  getAtAudioNow: (audioNowSec: number) => StudioTransportSyncSnapshot;
  getIdle: () => StudioTransportSyncSnapshot;
  audioCtx: AudioContext | null | undefined;
}): StudioTransportSyncSnapshot {
  return readStudioTransportSnapshotForUi(
    input.getAtAudioNow,
    input.getIdle,
    input.audioCtx,
  );
}

export function readStudioTimelineTickFloatForEngine(input: {
  getAtAudioNow: (audioNowSec: number) => StudioTransportSyncSnapshot;
  getIdle: () => StudioTransportSyncSnapshot;
  audioCtx: AudioContext | null | undefined;
}): number {
  const snap = readStudioTransportPhaseForEngine(input);
  return Math.max(0, snap.tickFloat);
}

export type StudioTransportClock = {
  /** Explicit audio instant (e.g. `t` from {@link subscribeStudioPlayheadFrame}). */
  frameAt: (audioNowSec: number) => StudioTransportSyncSnapshot;
  /** Live `AudioContext.currentTime` when running; else idle snapshot. */
  frameNow: () => StudioTransportSyncSnapshot;
  tickFloatNow: () => number;
  gridBeatFloatNow: () => number;
};

export function createStudioTransportClock(deps: {
  getAtAudioNow: (audioNowSec: number) => StudioTransportSyncSnapshot;
  getIdle: () => StudioTransportSyncSnapshot;
  getAudioCtx: () => AudioContext | null;
}): StudioTransportClock {
  return {
    frameAt: (audioNowSec: number) => deps.getAtAudioNow(audioNowSec),
    frameNow: () =>
      readStudioTransportPhaseForEngine({
        getAtAudioNow: deps.getAtAudioNow,
        getIdle: deps.getIdle,
        audioCtx: deps.getAudioCtx(),
      }),
    tickFloatNow: () =>
      Math.max(
        0,
        readStudioTransportPhaseForEngine({
          getAtAudioNow: deps.getAtAudioNow,
          getIdle: deps.getIdle,
          audioCtx: deps.getAudioCtx(),
        }).tickFloat,
      ),
    gridBeatFloatNow: () =>
      studioGridBeatFloatFromSnapshot(
        readStudioTransportPhaseForEngine({
          getAtAudioNow: deps.getAtAudioNow,
          getIdle: deps.getIdle,
          audioCtx: deps.getAudioCtx(),
        }),
      ),
  };
}
