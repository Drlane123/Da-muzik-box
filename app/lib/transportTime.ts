/**
 * Single source transport math: ticks + AudioContext.currentTime anchors.
 * Examples in product docs sometimes use ticksPerBeat=480; this DAW uses PPQ 960 — pass it explicitly.
 */

export function ticksToSecondsAtBpm(
  ticks: number,
  bpm: number,
  ticksPerBeat: number,
): number {
  const beats = ticks / ticksPerBeat;
  return (beats * 60) / Math.max(1, bpm);
}

export function secondsToTicksAtBpm(
  seconds: number,
  bpm: number,
  ticksPerBeat: number,
): number {
  const beats = (seconds * Math.max(1, bpm)) / 60;
  return Math.round(beats * ticksPerBeat);
}

/**
 * Integer transport tick at `audioNow` while anchored at `(startTimeSec, startTick)`.
 * Uses `Math.round` on elapsed ticks so this stays consistent with `secondsToTicksAtBpm`
 * (inverse of `ticksToSecondsAtBpm`). `floor` here systematically lagged the quantized
 * grid used by lookahead schedulers / `mapGlobalTickToAudioTime`, which made playhead vs
 * drum triggers disagree by a tick near boundaries.
 */
export function getCurrentTransportTick(
  audioNow: number,
  startTimeSec: number,
  startTick: number,
  bpm: number,
  ticksPerBeat: number,
): number {
  const elapsedSec = Math.max(0, audioNow - startTimeSec);
  const elapsedBeats = (elapsedSec * Math.max(1, bpm)) / 60;
  const elapsedTicks = Math.round(elapsedBeats * ticksPerBeat);
  return Math.max(0, startTick + elapsedTicks);
}

/**
 * Wall seconds for one notated measure at `bpm` when the bar has `quartersPerBar` quarter-note beats.
 * Transport position in this DAW is still anchored with {@link getCurrentTransportTick} and
 * `AudioContext.currentTime` — this is the equivalent “(60/bpm)*beatsPerBar” helper for reasoning / debug.
 */
export function secondsPerMeasureAtBpm(
  bpm: number,
  quartersPerBar: number,
): number {
  return (60 / Math.max(1, bpm)) * Math.max(1, quartersPerBar);
}

/**
 * 0-based monotonic measure index along the timeline from a **global quarter index** each frame.
 * Feed `transportBeat` = `Math.floor(wrappedDisplayTick / PPQ)` from {@link getCurrentTransportTick} —
 * never `if (beat > 4) { measure++; beat = 1; }`.
 */
export function monotonicMeasure0FromTransportBeat(
  transportBeat: number,
  beatOffset: number,
  quartersPerBar: number,
): number {
  const rel = transportBeat - beatOffset;
  const q = Math.max(1e-9, quartersPerBar);
  return Math.max(0, Math.floor(rel / q + 1e-9));
}

/**
 * 1-based MPC-style phrase counter: phrase 1 = measures 0…`phraseMeasures-1`.
 * Use `Math.floor((measure0) / phraseMeasures) + 1`, not `measure % 2` hacks.
 */
export function phraseCount1FromMonotonicMeasure0(
  monotonicMeasure0: number,
  phraseMeasures: number,
): number {
  const n = Math.max(1, phraseMeasures);
  return Math.floor(monotonicMeasure0 / n) + 1;
}

/** Simple X/4 style bar/beat from global tick (time-sig–aware display may use tickToBarBeat instead). */
export function barBeatFromGlobalTickSimple(
  tick: number,
  beatsPerBar: number,
  ticksPerBeat: number,
): { bar: number; beat: number } {
  const beatsTotal = tick / ticksPerBeat;
  const bar = Math.floor(beatsTotal / beatsPerBar) + 1;
  const beat = (Math.floor(beatsTotal) % beatsPerBar) + 1;
  return { bar, beat };
}
