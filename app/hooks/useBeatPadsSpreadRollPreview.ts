'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { beatPadsStepDurationSec, type BeatPadsGridStepsPerBar } from '@/app/lib/creationStation/beatLabDrumMachineSequencer';
import {
  beatPadsSpreadNotesAtColumn,
  beatPadsSpreadPatternCols,
  type BeatPadsSpreadLoopBars,
  type BeatPadsSpreadNote,
} from '@/app/lib/creationStation/beatPadsSpreadTrack';
import { SE2_AUDIO_START_FLOOR_SEC } from '@/app/lib/studio/se2TransportClock';

const SPREAD_PREVIEW_SCHEDULE_AHEAD_SEC = 2.5;
const SPREAD_PREVIEW_LOOKAHEAD_MS = 25;

export type UseBeatPadsSpreadRollPreviewOpts = {
  bpm: number;
  loopBars: BeatPadsSpreadLoopBars;
  stepsPerBar?: BeatPadsGridStepsPerBar;
  notes: BeatPadsSpreadNote[];
  onStrikeRow?: (row: number, col: number, whenSec: number) => void;
  onWarmAudio?: () => void | Promise<void>;
  getAudioContext?: () => AudioContext | null;
};

export function useBeatPadsSpreadRollPreview({
  bpm,
  loopBars,
  stepsPerBar = 16,
  notes,
  onStrikeRow,
  onWarmAudio,
  getAudioContext,
}: UseBeatPadsSpreadRollPreviewOpts) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playCol, setPlayCol] = useState<number | null>(null);

  const runningRef = useRef(false);
  const sessionStartRef = useRef(0);
  const nextStepIndexRef = useRef(0);
  const firedThroughRef = useRef(-1);
  const lookaheadRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playColRafRef = useRef(0);

  const bpmRef = useRef(bpm);
  const loopBarsRef = useRef(loopBars);
  const stepsPerBarRef = useRef(stepsPerBar);
  const notesRef = useRef(notes);
  const onStrikeRowRef = useRef(onStrikeRow);
  const loopColsRef = useRef(beatPadsSpreadPatternCols(loopBars, stepsPerBar));

  bpmRef.current = bpm;
  loopBarsRef.current = loopBars;
  stepsPerBarRef.current = stepsPerBar;
  notesRef.current = notes;
  onStrikeRowRef.current = onStrikeRow;
  loopColsRef.current = beatPadsSpreadPatternCols(loopBars, stepsPerBar);

  const clearLookahead = useCallback(() => {
    if (lookaheadRef.current != null) {
      clearInterval(lookaheadRef.current);
      lookaheadRef.current = null;
    }
    if (playColRafRef.current) {
      cancelAnimationFrame(playColRafRef.current);
      playColRafRef.current = 0;
    }
  }, []);

  const syncPlayCol = useCallback(() => {
    if (!runningRef.current) return;
    const ctx = getAudioContext?.();
    const cols = loopColsRef.current;
    if (!ctx || cols <= 0 || sessionStartRef.current <= 0) return;
    const stepSec = beatPadsStepDurationSec(bpmRef.current, stepsPerBarRef.current);
    const elapsed = Math.max(0, ctx.currentTime - sessionStartRef.current);
    const col = Math.floor(elapsed / stepSec) % cols;
    setPlayCol(col);
    playColRafRef.current = requestAnimationFrame(syncPlayCol);
  }, [getAudioContext]);

  const fireStepAt = useCallback((stepIndex: number, whenSec: number) => {
    const cols = loopColsRef.current;
    if (cols <= 0) return;
    const col = ((stepIndex % cols) + cols) % cols;
    const strike = onStrikeRowRef.current;
    if (!strike) return;
    for (const note of beatPadsSpreadNotesAtColumn(notesRef.current, col)) {
      strike(note.row, col, whenSec);
    }
  }, []);

  const refillSchedule = useCallback(() => {
    if (!runningRef.current) return;
    const ctx = getAudioContext?.();
    if (!ctx || ctx.state === 'closed') return;
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }
    if (ctx.state !== 'running') return;

    const now = ctx.currentTime;
    const sessionStart = sessionStartRef.current;
    if (sessionStart <= 0) return;

    const cols = loopColsRef.current;
    if (cols <= 0) return;

    const stepSec = beatPadsStepDurationSec(bpmRef.current, stepsPerBarRef.current);
    const horizon = now + SPREAD_PREVIEW_SCHEDULE_AHEAD_SEC;

    while (true) {
      const stepIndex = nextStepIndexRef.current;
      const whenSec = sessionStart + stepIndex * stepSec;
      if (whenSec > horizon) break;
      if (stepIndex > firedThroughRef.current) {
        fireStepAt(stepIndex, whenSec);
        firedThroughRef.current = stepIndex;
      }
      nextStepIndexRef.current = stepIndex + 1;
    }
  }, [fireStepAt, getAudioContext]);

  const stop = useCallback(() => {
    runningRef.current = false;
    setIsPlaying(false);
    setPlayCol(null);
    clearLookahead();
    sessionStartRef.current = 0;
    nextStepIndexRef.current = 0;
    firedThroughRef.current = -1;
  }, [clearLookahead]);

  const start = useCallback(async () => {
    if (!onStrikeRowRef.current || !notesRef.current.length) return;
    await Promise.resolve(onWarmAudio?.());
    if (runningRef.current) return;

    const ctx = getAudioContext?.();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }
    if (ctx.state !== 'running') return;

    const tCapture = ctx.currentTime;
    sessionStartRef.current = tCapture + SE2_AUDIO_START_FLOOR_SEC;
    nextStepIndexRef.current = 0;
    firedThroughRef.current = -1;
    runningRef.current = true;
    setIsPlaying(true);
    setPlayCol(0);

    refillSchedule();
    queueMicrotask(() => {
      if (!runningRef.current) return;
      const c = getAudioContext?.();
      if (c && c.state === 'running') refillSchedule();
    });
    lookaheadRef.current = setInterval(() => refillSchedule(), SPREAD_PREVIEW_LOOKAHEAD_MS);
    playColRafRef.current = requestAnimationFrame(syncPlayCol);
  }, [getAudioContext, onWarmAudio, refillSchedule, syncPlayCol]);

  const toggle = useCallback(() => {
    if (runningRef.current) stop();
    else void start();
  }, [start, stop]);

  useEffect(() => {
    if (!runningRef.current) return;
    const ctx = getAudioContext?.();
    if (!ctx || ctx.state !== 'running') return;
    const cols = loopColsRef.current;
    if (cols <= 0 || sessionStartRef.current <= 0) return;
    const stepSec = beatPadsStepDurationSec(bpm, stepsPerBar);
    const elapsed = Math.max(0, ctx.currentTime - sessionStartRef.current);
    const globalStep = Math.floor(elapsed / stepSec);
    const tNow = ctx.currentTime;
    sessionStartRef.current = tNow + SE2_AUDIO_START_FLOOR_SEC - globalStep * stepSec;
    nextStepIndexRef.current = globalStep + 1;
    firedThroughRef.current = globalStep;
    refillSchedule();
  }, [bpm, getAudioContext, refillSchedule, stepsPerBar]);

  useEffect(() => {
    loopColsRef.current = beatPadsSpreadPatternCols(loopBars, stepsPerBar);
    if (!runningRef.current) return;
    stop();
  }, [loopBars, stepsPerBar, stop]);

  useEffect(() => () => stop(), [stop]);

  return {
    isPlaying,
    playCol,
    start,
    stop,
    toggle,
    canPlay: notes.length > 0 && typeof onStrikeRow === 'function',
  };
}
