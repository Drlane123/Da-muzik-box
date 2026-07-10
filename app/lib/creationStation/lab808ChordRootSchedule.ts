/**
 * Schedule locked 808 roots on exact audio grid times (not MPC step tolerance).
 */
import {
  CREATION_METRO_NODE_EPS_SEC,
  CREATION_SCHEDULE_AHEAD_SEC,
  SE2_AUDIO_START_FLOOR_SEC,
} from '@/app/lib/creationStation/creationTransportSystem';
import {
  lab808AudioTimeAtChordBeat,
  readLab808GrooveClock,
  type Lab808GrooveClockSnap,
} from '@/app/lib/creationStation/lab808GrooveClock';
import type { Lab808ProgressionRoot } from '@/app/lib/creationStation/lab808ChordRoots';
import type { Lab808ToneRollNote } from '@/app/lib/creationStation/lab808ToneRollEdit';
import { grooveLabSecPerSlot } from '@/app/lib/creationStation/grooveLabTransport';

export type Lab808MpcTransportSnap = {
  sessionStart: number;
  originStepBeat: number;
  stepSpb: number;
  stepsPerBar: number;
};

export type RefillLab808LockedRootsOpts = {
  ctx: AudioContext;
  ctSnap: number;
  loopBeats: number;
  useGrooveClock: boolean;
  lockedRoots: readonly Lab808ProgressionRoot[];
  manualNotes: readonly Lab808ToneRollNote[];
  firedKeys: Set<string>;
  mpc: Lab808MpcTransportSnap;
  onRoot: (index: number, when: number, cycle: number) => void;
  onManual: (note: Lab808ToneRollNote, when: number, cycle: number) => void;
};

function mpcAudioTimeAtQuarterBeat(
  startBeat: number,
  cycle: number,
  loopBeats: number,
  mpc: Lab808MpcTransportSnap,
): number {
  const spb = Math.max(1, mpc.stepsPerBar);
  const rootStep = (startBeat * spb) / 4;
  const loopSteps = (loopBeats * spb) / 4;
  const globalStep = cycle * loopSteps + rootStep;
  return mpc.sessionStart + (globalStep - mpc.originStepBeat) * mpc.stepSpb;
}

function loopSecForRefill(
  loopBeats: number,
  clock: Lab808GrooveClockSnap | null,
  mpc: Lab808MpcTransportSnap,
): number {
  if (clock) {
    return clock.loopSlots * grooveLabSecPerSlot(clock.bpm);
  }
  const loopSteps = (loopBeats * Math.max(1, mpc.stepsPerBar)) / 4;
  return loopSteps * mpc.stepSpb;
}

function sessionStartForRefill(
  clock: Lab808GrooveClockSnap | null,
  mpc: Lab808MpcTransportSnap,
): number {
  return clock?.sessionStart ?? mpc.sessionStart;
}

export function refillLab808LockedRoots(opts: RefillLab808LockedRootsOpts): void {
  const { ctx, ctSnap, loopBeats, firedKeys, lockedRoots, manualNotes, onRoot, onManual } = opts;
  const sessionStart = sessionStartForRefill(
    opts.useGrooveClock ? readLab808GrooveClock() : null,
    opts.mpc,
  );
  if (sessionStart <= 0) return;

  const clock = opts.useGrooveClock ? readLab808GrooveClock() : null;
  const loopLen = Math.max(1e-6, loopBeats);
  const loopSec = loopSecForRefill(loopLen, clock, opts.mpc);
  const now = ctSnap;
  const horizon = now + CREATION_SCHEDULE_AHEAD_SEC;
  const cycleNow = Math.max(0, Math.floor((now - sessionStart + 1e-6) / loopSec));

  for (const key of firedKeys) {
    const c = Number(key.split(':').pop());
    if (!Number.isFinite(c) || c < cycleNow - 1) firedKeys.delete(key);
  }

  const chainFloor = SE2_AUDIO_START_FLOOR_SEC;
  let chain = now + chainFloor;
  let scheduled = 0;
  const maxPerCall = 64;

  const pastSkipSec = 0.08;
  const minWhen = now + chainFloor;

  const timeAt = (startBeat: number, cycle: number): number => {
    if (clock) return lab808AudioTimeAtChordBeat(startBeat, cycle, clock);
    return mpcAudioTimeAtQuarterBeat(startBeat, cycle, loopLen, opts.mpc);
  };

  /** Never schedule in the audio past — avoids silent drops that still consume `firedKeys`. */
  const resolveWhen = (t: number, cycle: number): number | null => {
    if (t >= horizon) return null;
    let when = Math.max(t, chain, minWhen);
    if (t >= now - pastSkipSec) return when;
    if (!clock) return null;
    const cycleStart = sessionStart + cycle * loopSec;
    const cycleEnd = cycleStart + loopSec;
    if (t < cycleStart - 1e-6 || t >= cycleEnd - 1e-6 || now >= cycleEnd - 1e-6) return null;
    return when;
  };

  for (let cycle = cycleNow; cycle <= cycleNow + 2 && scheduled < maxPerCall; cycle += 1) {
    for (let i = 0; i < lockedRoots.length; i += 1) {
      const n = lockedRoots[i]!;
      const t = timeAt(n.startBeat, cycle);
      const when = resolveWhen(t, cycle);
      if (when == null) continue;
      const key = `root:${i}:${cycle}`;
      if (firedKeys.has(key)) continue;
      firedKeys.add(key);
      onRoot(i, when, cycle);
      chain = when + CREATION_METRO_NODE_EPS_SEC;
      scheduled += 1;
      if (scheduled >= maxPerCall) return;
    }
    for (const note of manualNotes) {
      const t = timeAt(note.startBeat, cycle);
      const when = resolveWhen(t, cycle);
      if (when == null) continue;
      const key = `${note.id}:${cycle}`;
      if (firedKeys.has(key)) continue;
      firedKeys.add(key);
      onManual(note, when, cycle);
      chain = when + CREATION_METRO_NODE_EPS_SEC;
      scheduled += 1;
      if (scheduled >= maxPerCall) return;
    }
  }
}

/**
 * Groove Lab PLAY → 808 mirror: beat-0 is at `sessionStart`, which is already past when 808
 * joins. Prime any roots in the active cycle that should have sounded in the last ~450 ms.
 */
export function primeLab808GrooveCycleCatchup(opts: {
  ctx: AudioContext;
  ctSnap: number;
  lockedRoots: readonly Lab808ProgressionRoot[];
  firedKeys: Set<string>;
  onRoot: (index: number, when: number, cycle: number) => void;
  catchAheadSec?: number;
}): void {
  const clock = readLab808GrooveClock();
  if (!clock || clock.sessionStart <= 0 || opts.lockedRoots.length === 0) return;

  const now = opts.ctSnap;
  const sessionStart = clock.sessionStart;
  const loopSec = clock.loopSlots * grooveLabSecPerSlot(clock.bpm);
  const cycleNow = Math.max(0, Math.floor((now - sessionStart + 1e-6) / loopSec));
  const chainFloor = SE2_AUDIO_START_FLOOR_SEC;
  const minWhen = now + chainFloor;
  const window = opts.catchAheadSec ?? 0.75;
  let chain = minWhen;

  for (let i = 0; i < opts.lockedRoots.length; i += 1) {
    const n = opts.lockedRoots[i]!;
    const t = lab808AudioTimeAtChordBeat(n.startBeat, cycleNow, clock);
    if (t < sessionStart - 1e-6 || t > now + window) continue;
    const key = `root:${i}:${cycleNow}`;
    if (opts.firedKeys.has(key)) continue;
    const when = Math.max(t, chain, minWhen);
    if (when >= now + CREATION_SCHEDULE_AHEAD_SEC) continue;
    opts.firedKeys.add(key);
    opts.onRoot(i, when, cycleNow);
    chain = when + CREATION_METRO_NODE_EPS_SEC;
  }
}
