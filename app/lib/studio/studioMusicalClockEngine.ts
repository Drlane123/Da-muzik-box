/**
 * Studio musical clock — **rebuilt session layer** (grid phase only).
 *
 * MasterClock owns the audio engine, `mapGlobalTickToAudioTime`, metronome clicks, and
 * `getStudioTimelineBeatFloatGridLockedAtAudioNow`. This module defines **only** how Studio
 * derives *displayed* quarter-beat floats from that engine plus session ticks — one place, no
 * duplicate formulas in `StudioEditorScreen`.
 *
 * Playhead math here must stay tied to **AudioContext.currentTime** via MasterClock’s grid APIs — not to
 * `performance.now()` or `setInterval(60/BPM)` — so the arranger stays phase-locked with scheduled metronome clicks.
 */

export type PrecountTimeline = {
  playheadTick: number;
  totalBeats: number;
};

/** Virtual quarter-beat during local precount (before MasterClock transport runs). */
export function precountQuarterFloat(
  timeline: PrecountTimeline | null,
  beat1Based: number | null,
  ppq: number,
): number | null {
  if (!timeline || beat1Based == null) return null;
  const { playheadTick, totalBeats } = timeline;
  return playheadTick / ppq - (totalBeats - (beat1Based - 1));
}

/** Linear session anchor for **clip** alignment when not in transport (unwrapped tick ÷ PPQ). */
export function editClipBeatFloatUnwrapped(positionTicks: number, ppq: number): number {
  return Math.max(0, positionTicks / ppq);
}

/** Ruler / scrub line when stopped or paused — **display** tick after loop wrap. */
export function editScrubBeatFloatWrapped(
  wrapGlobalTickToDisplayTick: (tick: number) => number,
  positionTicks: number,
  ppq: number,
): number {
  const tickDisp = wrapGlobalTickToDisplayTick(Math.max(0, Math.floor(positionTicks)));
  return Math.max(0, tickDisp / ppq);
}

/** Grid-locked quarter at `audioNow` (must be MasterClock’s studio grid API). */
export function transportBeatFloatFromAudio(
  audioCtx: AudioContext | null,
  gridAtAudioNow: (audioNowSec: number) => number,
  snapGridBeatFloat: number,
): number {
  if (audioCtx && audioCtx.state !== 'closed') {
    try {
      return Math.max(0, gridAtAudioNow(audioCtx.currentTime));
    } catch {
      /* use snapshot */
    }
  }
  return Math.max(0, snapGridBeatFloat);
}

/**
 * Synchronous “where is the playhead in quarter-beats?” — precount, then audio transport, then wrapped edit scrub.
 * Used by rAF, recording shade, and clip scheduling.
 */
export function readPlayheadGridBeatFloatSync(input: {
  ppq: number;
  /** Precount active and timeline is set (`beat` may be null → treat as 1). */
  isPrecountActive: boolean;
  precountBeat: number | null;
  precountTimeline: PrecountTimeline | null;
  transportIsRunning: boolean;
  audioCtx: AudioContext | null;
  gridAtAudioNow: (audioNowSec: number) => number;
  snapGridBeatFloat: number;
  positionTicks: number;
  wrapGlobalTickToDisplayTick: (tick: number) => number;
}): number {
  if (input.isPrecountActive && input.precountTimeline) {
    const beat = input.precountBeat ?? 1;
    const v = precountQuarterFloat(input.precountTimeline, beat, input.ppq);
    return Math.max(0, v ?? 0);
  }
  if (input.transportIsRunning) {
    return transportBeatFloatFromAudio(
      input.audioCtx,
      input.gridAtAudioNow,
      input.snapGridBeatFloat,
    );
  }
  return editScrubBeatFloatWrapped(
    input.wrapGlobalTickToDisplayTick,
    input.positionTicks,
    input.ppq,
  );
}

/**
 * Clip / paste anchor quarter-beat for React render: precount → transport → **unwrapped** session tick.
 */
export function clipAnchorBeatFloatForRender(input: {
  ppq: number;
  isPrecounting: boolean;
  precountBeat: number | null;
  precountTimeline: PrecountTimeline | null;
  transportIsRunning: boolean;
  audioCtx: AudioContext | null;
  gridAtAudioNow: (audioNowSec: number) => number;
  snapGridBeatFloat: number;
  positionTicks: number;
}): number {
  if (input.isPrecounting && input.precountTimeline) {
    const beat = input.precountBeat ?? 1;
    return Math.max(0, precountQuarterFloat(input.precountTimeline, beat, input.ppq) ?? 0);
  }
  if (input.transportIsRunning) {
    return transportBeatFloatFromAudio(
      input.audioCtx,
      input.gridAtAudioNow,
      input.snapGridBeatFloat,
    );
  }
  return editClipBeatFloatUnwrapped(input.positionTicks, input.ppq);
}

/** Integer quarter index (0-based) when stopped — `wrap` on raw session tick (no pre-floor). */
export function editRulerQuarterIndex0(
  wrapGlobalTickToDisplayTick: (tick: number) => number,
  positionTicks: number,
  ppq: number,
): number {
  const td = wrapGlobalTickToDisplayTick(Math.max(0, positionTicks));
  return Math.max(0, Math.floor(td / ppq + 1e-9));
}
