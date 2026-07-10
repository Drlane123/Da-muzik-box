/**
 * Piano Roll — SE2-mirror audio scheduling (metronome + 16th-step pattern playback).
 */

import type { MutableRefObject } from 'react';

import { SE2_AUDIO_START_FLOOR_SEC } from '@/app/lib/creationStation/beatLabSe2TransportEngine';
import {
  refillCreationMetronome,
  refillCreationTransportLookahead,
  seedCreationTransportOnPlay,
  type CreationMetronomeClockRefs,
  type CreationTransportClockRefs,
  type CreationTransportRefillOpts,
} from '@/app/lib/creationStation/creationTransportSystem';
import {
  triggerPianoRollDrumPad,
  type PianoRollDrumKitSession,
} from '@/app/lib/pianoRoll/pianoRollDrumEngine';

export const PIANO_ROLL_BEATS_PER_BAR = 4;
export const PIANO_ROLL_SUBDIV = 4;
export const PIANO_ROLL_STEPS_PER_BAR = PIANO_ROLL_BEATS_PER_BAR * PIANO_ROLL_SUBDIV;

export type PianoRollNote = { row: number; col: number };

export type PianoRollTransportClock = {
  runningRef: MutableRefObject<boolean>;
  sessionStartRef: MutableRefObject<number>;
  originBeatRef: MutableRefObject<number>;
  bpmRef: MutableRefObject<number>;
  nextStepBeatRef: MutableRefObject<number>;
  nextStepTimeRef: MutableRefObject<number>;
  nextMetroKRef: MutableRefObject<number>;
  lastScheduledQuarterRef: MutableRefObject<number>;
  perfSessionStartMsRef: MutableRefObject<number>;
  creationRefillCtSnapRef: MutableRefObject<number>;
};

export type PianoRollTransportData = {
  patternColsRef: MutableRefObject<number>;
  patternBeatsRef: MutableRefObject<number>;
  drumModeRef: MutableRefObject<boolean>;
  drumNotesRef: MutableRefObject<readonly PianoRollNote[]>;
  notesRef: MutableRefObject<readonly PianoRollNote[]>;
  drumKitSessionRef: MutableRefObject<PianoRollDrumKitSession | null>;
  loopOnRef: MutableRefObject<boolean>;
  loopStartBeatRef: MutableRefObject<number>;
  loopEndBeatRef: MutableRefObject<number>;
  playPianoAtRef: MutableRefObject<(row: number, when: number, ctx: AudioContext) => void>;
};

export function firePianoRollTransportStep(
  k: number,
  idealGridT: number,
  ctx: AudioContext,
  clock: PianoRollTransportClock,
  data: PianoRollTransportData,
  ctSnap: number,
): boolean {
  if (!clock.runningRef.current || clock.sessionStartRef.current <= 0) return false;

  const subdiv = PIANO_ROLL_SUBDIV;
  const gridCols = Math.max(1, Math.round(data.patternColsRef.current));
  const spbQ = 60 / Math.max(1, clock.bpmRef.current);
  const subSpb = spbQ / subdiv;

  let posInPattern = k;
  if (data.loopOnRef.current && data.loopEndBeatRef.current > data.loopStartBeatRef.current) {
    const ls = Math.floor(data.loopStartBeatRef.current + 1e-8);
    const le = Math.floor(data.loopEndBeatRef.current + 1e-8);
    const span = Math.max(1, le - ls);
    posInPattern = ((k - ls) % span + span) % span + ls;
  }

  const whenBase = Math.max(idealGridT, ctSnap + SE2_AUDIO_START_FLOOR_SEC);

  for (let s = 0; s < subdiv; s += 1) {
    const colInPattern = ((posInPattern * subdiv + s) % gridCols + gridCols) % gridCols;
    const when = whenBase + s * subSpb;

    if (data.drumModeRef.current) {
      for (const n of data.drumNotesRef.current) {
        if (n.col !== colInPattern) continue;
        triggerPianoRollDrumPad(data.drumKitSessionRef.current, n.row, ctx, 100, when);
      }
    } else {
      for (const n of data.notesRef.current) {
        if (n.col !== colInPattern) continue;
        data.playPianoAtRef.current(n.row, when, ctx);
      }
    }
  }
  return true;
}

export function refillPianoRollSchedule(
  ctx: AudioContext,
  ctSnap: number,
  clock: PianoRollTransportClock,
  data: PianoRollTransportData,
  playMetro: (k: number, idealT: number, c: AudioContext) => void,
  metroOn: () => boolean,
  opts?: CreationTransportRefillOpts,
): void {
  if (!clock.runningRef.current || clock.sessionStartRef.current <= 0) return;
  clock.creationRefillCtSnapRef.current = ctSnap;
  if (clock.runningRef.current && clock.sessionStartRef.current > 0) {
    clock.perfSessionStartMsRef.current =
      performance.now() + (clock.sessionStartRef.current - ctSnap) * 1000;
  }

  const spb = 60 / Math.max(1, clock.bpmRef.current);
  const tb = Math.max(1e-9, data.patternBeatsRef.current);

  const metroRefs: CreationMetronomeClockRefs = {
    nextMetroKRef: clock.nextMetroKRef,
    sessionStartRef: clock.sessionStartRef,
    originBeatRef: clock.originBeatRef,
  };
  refillCreationMetronome(
    ctx,
    ctSnap,
    spb,
    metroRefs,
    playMetro,
    () => clock.runningRef.current,
    metroOn,
    opts,
    tb,
  );

  const stepRefs: CreationTransportClockRefs = {
    nextStepBeatRef: clock.nextStepBeatRef,
    nextStepTimeRef: clock.nextStepTimeRef,
    sessionStartRef: clock.sessionStartRef,
    originBeatRef: clock.originBeatRef,
    lastScheduledQuarterRef: clock.lastScheduledQuarterRef,
  };
  refillCreationTransportLookahead(
    ctx,
    ctSnap,
    spb,
    stepRefs,
    (stepK, idealT, c) => firePianoRollTransportStep(stepK, idealT, c, clock, data, ctSnap),
    () => clock.runningRef.current,
    opts,
  );
}

export function seedPianoRollTransportOnPlay(
  clock: PianoRollTransportClock,
  originBeat: number,
  sessionStartAudio: number,
  spb: number,
): void {
  seedCreationTransportOnPlay(
    { nextStepBeatRef: clock.nextStepBeatRef, nextStepTimeRef: clock.nextStepTimeRef },
    originBeat,
    sessionStartAudio,
    spb,
  );
  clock.nextMetroKRef.current = Math.floor(originBeat + 1e-8);
  clock.lastScheduledQuarterRef.current = Math.ceil(originBeat - 1e-8) - 1;
}

export function formatPianoRollBarsBeatsTicks(displayBeats: number, beatsPerBar = PIANO_ROLL_BEATS_PER_BAR): string {
  const bpb = Math.max(1, beatsPerBar);
  const b = Math.max(0, displayBeats);
  const bar = Math.floor(b / bpb) + 1;
  const beat = Math.floor(b % bpb) + 1;
  const tick = Math.round((b % 1) * 960);
  return `${bar}.${beat}.${String(tick).padStart(3, '0')}`;
}

export function formatPianoRollTimeMmSsFf(beats: number, bpm: number): string {
  const sec = (Math.max(0, beats) * 60) / Math.max(1, bpm);
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const f = Math.floor((sec % 1) * 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(f).padStart(2, '0')}`;
}
