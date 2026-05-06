/**
 * Master transport sync — **single** Web Audio timebase (pure functions).
 *
 * One rule: musical position = `originBeatFloat + max(0, audioNow - startAudioTimeSec) * (bpm / 60)`.
 * Integer PPQ ticks, quarter grid, loop wrap, and tick→audio mapping all derive from that.
 *
 * `MasterClockContext` holds live refs and calls into this module; screens should use the context API,
 * not duplicate tempo math.
 */

const EPS = 1e-9;

export type TransportClock = {
  startAudioTimeSec: number;
  originBeatFloat: number;
  bpm: number;
  ppq: number;
};

/** Loop region in **bars** (1-based start) + engine `ticksPerBar` (from time sig). */
export type LoopWindow = {
  enabled: boolean;
  ticksPerBar: number;
  loopStartBar: number;
  loopBars: number;
};

export type MasterSyncFrame = {
  audioNowSec: number;
  startAudioTimeSec: number;
  originBeatFloat: number;
  bpm: number;
  ppq: number;
  secondsPerBeat: number;
  beatFloat: number;
  tickFloat: number;
  tickInt: number;
  quarterIndex0: number;
  quarterTick: number;
  nextQuarterTick: number;
};

/** Everything in {@link MasterSyncFrame} plus loop-wrapped display phase (shared by RAF + metronome). */
export type MasterTransportPhase = MasterSyncFrame & {
  displayBeats: number;
  displayTickFloat: number;
  transportBeatFloatGrid: number;
};

export function createMasterSyncFrame(args: {
  audioNowSec: number;
  startAudioTimeSec: number;
  originBeatFloat: number;
  bpm: number;
  ppq: number;
}): MasterSyncFrame {
  const bpm = Math.max(1, args.bpm);
  const ppq = Math.max(1, Math.round(args.ppq));
  const secondsPerBeat = 60 / bpm;
  const elapsedSec = Math.max(0, args.audioNowSec - args.startAudioTimeSec);
  const beatFloat = Math.max(
    0,
    args.originBeatFloat + elapsedSec / secondsPerBeat,
  );
  const tickFloat = beatFloat * ppq;
  const tickInt = Math.max(0, Math.round(tickFloat));
  const quarterIndex0 = Math.max(0, Math.floor(beatFloat + EPS));
  const quarterTick = quarterIndex0 * ppq;
  const nextQuarterTick = Math.max(
    0,
    Math.ceil(tickFloat / ppq - EPS) * ppq,
  );

  return {
    audioNowSec: args.audioNowSec,
    startAudioTimeSec: args.startAudioTimeSec,
    originBeatFloat: args.originBeatFloat,
    bpm,
    ppq,
    secondsPerBeat,
    beatFloat,
    tickFloat,
    tickInt,
    quarterIndex0,
    quarterTick,
    nextQuarterTick,
  };
}

/** Inverse of {@link createMasterSyncFrame} tick stream — grid-locked audio instant for integer PPQ tick. */
export function mapMasterSyncTickToAudioTime(args: {
  globalTick: number;
  startAudioTimeSec: number;
  originBeatFloat: number;
  bpm: number;
  ppq: number;
}): number {
  const bpm = Math.max(1, args.bpm);
  const ppq = Math.max(1, Math.round(args.ppq));
  const targetBeats = Math.max(0, args.globalTick) / ppq;
  const deltaBeats = targetBeats - args.originBeatFloat;
  return args.startAudioTimeSec + (deltaBeats * 60) / bpm;
}

/** Stable fractional quarter index from a (possibly loop-wrapped) display tick. */
export function transportBeatFloatFromDisplayTick(
  displayTick: number,
  ppq: number,
): number {
  const q = Math.floor(displayTick / ppq);
  return q + (displayTick - q * ppq) / ppq;
}

export function wrapGlobalBeatsForLoop(
  globalBeats: number,
  loop: LoopWindow,
  ppq: number,
): number {
  if (!loop.enabled) return globalBeats;
  const qpb = loop.ticksPerBar / ppq;
  const loopStartBeats = (loop.loopStartBar - 1) * qpb;
  const loopLenBeats = Math.max(1, loop.loopBars * qpb);
  const rel = globalBeats - loopStartBeats;
  return loopStartBeats + ((rel % loopLenBeats) + loopLenBeats) % loopLenBeats;
}

export function wrapGlobalTickIntForLoop(
  tickInt: number,
  loop: LoopWindow,
): number {
  if (!loop.enabled) return tickInt;
  const tb = loop.ticksPerBar;
  const loopStartTick = (loop.loopStartBar - 1) * tb;
  const loopLenTicks = Math.max(1, loop.loopBars * tb);
  const rel = tickInt - loopStartTick;
  return loopStartTick + ((rel % loopLenTicks) + loopLenTicks) % loopLenTicks;
}

export function wrapGlobalTickFloatForLoop(
  tickFloat: number,
  loop: LoopWindow,
  ppq: number,
): number {
  return wrapGlobalBeatsForLoop(tickFloat / ppq, loop, ppq) * ppq;
}

/** One audio-instant snapshot: core frame + display wrap (use everywhere RAF/metronome need the same phase). */
export function computeMasterTransportPhase(
  clock: TransportClock,
  loop: LoopWindow,
  audioNowSec: number,
): MasterTransportPhase {
  const frame = createMasterSyncFrame({
    audioNowSec,
    startAudioTimeSec: clock.startAudioTimeSec,
    originBeatFloat: clock.originBeatFloat,
    bpm: clock.bpm,
    ppq: clock.ppq,
  });
  /**
   * Wrap in **tick** space first, then ÷ ppq — same space as MET `nextTick` / `mapGlobalTickToAudioTime`.
   * Wrapping `beatFloat` then multiplying by ppq can differ by a tick at loop boundaries from wrapping
   * the graph tick float, which showed up as the cyan playhead “skipping” vs quarter columns + clicks.
   */
  const displayTickFloat = wrapGlobalTickFloatForLoop(
    frame.tickFloat,
    loop,
    clock.ppq,
  );
  const displayBeats = displayTickFloat / clock.ppq;
  const transportBeatFloatGrid = displayBeats;
  return {
    ...frame,
    displayBeats,
    displayTickFloat,
    transportBeatFloatGrid,
  };
}

/**
 * Metronome lookahead: only treat a quarter as “too stale to sound” when its grid time is far behind `now`.
 * Centralized so tuning isn’t scattered across the context.
 */
export function metronomeMaxStaleGridSec(secondsPerBeat: number): number {
  const spb = Math.max(1 / 1000, secondsPerBeat);
  return Math.min(2, Math.max(0.5, spb * 2.25));
}
