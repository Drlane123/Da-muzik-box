/**
 * Chord Builder preview transport — mirrors Beat Lab / Creation Station scheduling:
 * audio-clock lookahead for chord changes + WAAPI playline driven from `beatAtSessionTime`.
 */

import type { MutableRefObject } from 'react';

import type { ChordSymbol } from '@/app/lib/creationStation/chordBuilder';
import {
  blocksToScheduleEvents,
  scheduleEventStartBeats,
  timelineToScheduleEvents,
  totalScheduleBeats,
  type ChordBlock,
  type ChordScheduleEvent,
  type TimelineSlot,
} from '@/app/lib/creationStation/chordBlocks';
import {
  CREATION_METRO_NODE_EPS_SEC,
  CREATION_SCHEDULE_AHEAD_SEC,
  SE2_AUDIO_START_FLOOR_SEC,
} from '@/app/lib/creationStation/creationTransportSystem';

export const CHORD_BUILDER_PLAYLINE_WAPI_LEAD_SEC = 0.052;

export const CHORD_BUILDER_DEFAULT_LOAD_BARS = 8;

export const CHORD_BUILDER_BEATS_PER_BAR = 4;

const CHORD_MAX_EMIT_OVERDUE_PER_CALL = 8;
const CHORD_MAX_SCHEDULE_PER_CALL = 64;

export function chordBuilderPlaylineDacLeadSec(ctx: AudioContext | null): number {
  if (!ctx || ctx.state === 'closed') return 0;
  const ol = typeof ctx.outputLatency === 'number' && ctx.outputLatency > 0 ? ctx.outputLatency : 0;
  const bl = typeof ctx.baseLatency === 'number' && ctx.baseLatency > 0 ? ctx.baseLatency : 0;
  return Math.min(0.12, ol + bl);
}

/** Lay chords across `totalBars` with a fixed number of bars per chord. */
export function expandProgressionToBars(
  chords: ReadonlyArray<ChordSymbol>,
  totalBars = CHORD_BUILDER_DEFAULT_LOAD_BARS,
  barsPerChord?: number,
): TimelineSlot[] {
  const bars = Math.max(1, totalBars);
  if (chords.length === 0) {
    return Array.from({ length: bars }, () => ({ chord: null }));
  }
  const bpc =
    barsPerChord ?? Math.max(1, Math.floor(bars / Math.max(1, chords.length)));
  if (chords.length * bpc > bars && chords.length >= bars) {
    return Array.from({ length: bars }, (_, i) => ({ chord: chords[i] ?? null }));
  }
  const out: TimelineSlot[] = Array.from({ length: bars }, () => ({ chord: null }));
  let bar = 0;
  for (const c of chords) {
    for (let b = 0; b < bpc && bar < bars; b++, bar++) {
      out[bar] = { chord: c };
    }
  }
  return out;
}

export function buildScheduleEventsFromBlocks(
  blocks: ReadonlyArray<ChordBlock>,
): ChordScheduleEvent[] {
  return blocksToScheduleEvents(blocks);
}

export function buildScheduleEventsFromTimeline(
  timeline: ReadonlyArray<TimelineSlot>,
  totalBars: number,
  beatsPerBar = CHORD_BUILDER_BEATS_PER_BAR,
): ChordScheduleEvent[] {
  return timelineToScheduleEvents(timeline, totalBars, beatsPerBar);
}

export interface ChordBuilderTransportRefs {
  sessionStartRef: MutableRefObject<number>;
  originBeatRef: MutableRefObject<number>;
  nextEventRef: MutableRefObject<number>;
  nextTimeRef: MutableRefObject<number>;
}

export function resetChordBuilderStepClock(
  refs: Pick<ChordBuilderTransportRefs, 'nextEventRef' | 'nextTimeRef'>,
): void {
  refs.nextEventRef.current = 0;
  refs.nextTimeRef.current = 0;
}

export function seedChordBuilderOnPlay(
  refs: ChordBuilderTransportRefs,
  originBeat: number,
  sessionStartAudio: number,
  spb: number,
  events: ReadonlyArray<ChordScheduleEvent>,
): void {
  if (events.length === 0) {
    refs.nextEventRef.current = 0;
    refs.nextTimeRef.current = 0;
    return;
  }
  const starts = scheduleEventStartBeats(events);
  const loopLen = Math.max(1, totalScheduleBeats(events));
  let eventIdx = 0;
  for (let i = starts.length - 1; i >= 0; i--) {
    if (starts[i]! <= originBeat + 1e-6) {
      eventIdx = i;
      break;
    }
  }
  const loopPass = Math.floor(originBeat / loopLen);
  refs.nextEventRef.current = eventIdx + loopPass * events.length;
  const absBeat = starts[eventIdx]! + loopPass * loopLen;
  refs.nextTimeRef.current = sessionStartAudio + (absBeat - originBeat) * spb;
}

/**
 * Lookahead refill — one fire per schedule event (per bar).
 */
export function refillChordBuilderLookahead(
  ctx: AudioContext,
  ctSnap: number,
  spb: number,
  events: ReadonlyArray<ChordScheduleEvent>,
  refs: ChordBuilderTransportRefs,
  fireChord: (
    chord: ChordSymbol,
    t0: number,
    ctx: AudioContext,
    sustainSec: number,
    eventIndex: number,
  ) => void,
  isRunning: () => boolean,
): void {
  if (!isRunning() || events.length === 0) return;

  const starts = scheduleEventStartBeats(events);
  const loopLen = Math.max(1, totalScheduleBeats(events));
  const horizon = ctSnap + CREATION_SCHEDULE_AHEAD_SEC;
  let chain = ctSnap + SE2_AUDIO_START_FLOOR_SEC;
  let event = refs.nextEventRef.current;
  let tGrid = refs.nextTimeRef.current;
  const origin = refs.originBeatRef.current;
  const sessionStart = refs.sessionStartRef.current;

  if (!Number.isFinite(tGrid) || tGrid <= 0) {
    seedChordBuilderOnPlay(refs, origin, sessionStart, spb, events);
    event = refs.nextEventRef.current;
    tGrid = refs.nextTimeRef.current;
  }

  const advanceEvent = () => {
    event += 1;
    const nextIdx = event % events.length;
    const nextLoopPass = Math.floor(event / events.length);
    const nextAbsBeat = starts[nextIdx]! + nextLoopPass * loopLen;
    tGrid = sessionStart + (nextAbsBeat - origin) * spb;
  };

  if (tGrid <= ctSnap) {
    const ev = events[event % events.length]!;
    const durSec = Math.max(spb * 0.25, ev.durationBeats * spb);
    const overdue = Math.floor((ctSnap - tGrid) / durSec) + 1;
    const drop = Math.max(0, overdue - CHORD_MAX_EMIT_OVERDUE_PER_CALL);
    if (drop > 0) {
      event += drop;
      const idx = event % events.length;
      const loopPass = Math.floor(event / events.length);
      const absBeat = starts[idx]! + loopPass * loopLen;
      tGrid = sessionStart + (absBeat - origin) * spb;
    }
  }

  let overdueEmitted = 0;
  while (tGrid <= ctSnap && overdueEmitted < CHORD_MAX_EMIT_OVERDUE_PER_CALL) {
    const idx = event % events.length;
    const ev = events[idx]!;
    const t0 = Math.max(tGrid, chain);
    const sustainSec = Math.max(0.12, ev.durationBeats * spb * 0.92);
    fireChord(ev.chord, t0, ctx, sustainSec, event);
    chain = t0 + CREATION_METRO_NODE_EPS_SEC;
    advanceEvent();
    overdueEmitted += 1;
  }

  let scheduled = 0;
  while (tGrid <= horizon && scheduled < CHORD_MAX_SCHEDULE_PER_CALL) {
    const idx = event % events.length;
    const ev = events[idx]!;
    const t0 = Math.max(tGrid, chain);
    const sustainSec = Math.max(0.12, ev.durationBeats * spb * 0.92);
    fireChord(ev.chord, t0, ctx, sustainSec, event);
    chain = t0 + CREATION_METRO_NODE_EPS_SEC;
    advanceEvent();
    scheduled += 1;
  }

  refs.nextEventRef.current = event;
  refs.nextTimeRef.current = tGrid;
}
