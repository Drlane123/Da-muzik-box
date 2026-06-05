/**
 * Live Groove Lab audio clock — 808 Lab reads this when Session Link / PLAY → Groove
 * is active so kick/bass roots hit the same grid times as Orchid chords.
 */
import { GROOVE_LAB_SLOTS_PER_BAR } from '@/app/lib/creationStation/grooveLabRoll';
import { grooveLabSecPerSlot } from '@/app/lib/creationStation/grooveLabTransport';

export type Lab808GrooveClockSnap = {
  sessionStart: number;
  originSlot: number;
  bpm: number;
  loopSlots: number;
};

let grooveClockSnap: Lab808GrooveClockSnap | null = null;

export function publishLab808GrooveClock(snap: Lab808GrooveClockSnap | null): void {
  grooveClockSnap = snap;
}

export function readLab808GrooveClock(): Lab808GrooveClockSnap | null {
  return grooveClockSnap;
}

/** Same `when` as `refillGrooveLabTransport` chord events at `startBeat` (quarter notes). */
export function lab808AudioTimeAtChordBeat(
  startBeat: number,
  cycle: number,
  clock: Lab808GrooveClockSnap,
): number {
  const slotsPerBeat = GROOVE_LAB_SLOTS_PER_BAR / 4;
  const slot = Math.round(Math.max(0, startBeat) * slotsPerBeat);
  const delta = (slot - clock.originSlot + clock.loopSlots) % clock.loopSlots;
  const secPerSlot = grooveLabSecPerSlot(clock.bpm);
  const loopSec = clock.loopSlots * secPerSlot;
  return clock.sessionStart + cycle * loopSec + delta * secPerSlot;
}
