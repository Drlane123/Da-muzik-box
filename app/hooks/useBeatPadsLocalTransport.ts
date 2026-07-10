'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
  BEAT_PADS_LANE_COUNT,
  BEAT_PADS_STEPS_PER_BAR,
  beatPadsPatternCols,
  beatPadsStepDurationSec,
  type BeatPadsDrumPattern,
  type BeatPadsGridStepsPerBar,
} from '@/app/lib/creationStation/beatLabDrumMachineSequencer';
import { beatPadsLaneActiveAtStep } from '@/app/lib/creationStation/beatPadsPatternEdit';
import {
  beatPadsSpreadNotesAtColumn,
  beatPadsSpreadPatternCols,
  type BeatPadsSpreadNote,
} from '@/app/lib/creationStation/beatPadsSpreadTrack';
import {
  BEAT_PADS_GRID_COL_W,
  BEAT_PADS_PLAYLINE_WAPI_SEG_IDLE,
  beatPadsPlayColFFromWapiAnim,
  beatPadsPlaylineWapiLoopWrapped,
  beatPadsPlaylineXForCol,
  cancelBeatPadsPlaylineWapi,
  launchBeatPadsPlaylineWapi,
  relaunchBeatPadsPlaylineWapiForBpm,
  type BeatPadsPlaylineWapiRefs,
} from '@/app/lib/creationStation/beatPadsPlaylineWapi';
import { setBeatPadsScreenActive, setBeatPadsTransportRunning } from '@/app/lib/creationStation/creationTransportSync';
import { SE2_AUDIO_START_FLOOR_SEC } from '@/app/lib/studio/se2TransportClock';

/** Match Beat Lab lookahead — 120 ms was starving the 16th-note grid. */
const BEAT_PADS_SCHEDULE_AHEAD_SEC = 2.5;
const BEAT_PADS_LOOKAHEAD_MS = 25;
const BEAT_PADS_COL_W = BEAT_PADS_GRID_COL_W;
/** Lane label column — playline lives in the grid column to the right of this. */
const BEAT_PADS_LANE_LABEL_W = 72;

export type UseBeatPadsLocalTransportOpts = {
  open: boolean;
  pattern: BeatPadsDrumPattern;
  loopBars: number;
  stepsPerBar?: import('@/app/lib/creationStation/beatLabDrumMachineSequencer').BeatPadsGridStepsPerBar;
  bpm: number;
  playlineElRef: RefObject<HTMLElement | null>;
  onStrikeStep: (lane: number, col: number, whenSec: number) => void;
  /** CH 17 spread roll — same grid clock as the step sequencer. */
  spreadNotes?: BeatPadsSpreadNote[];
  spreadLoopBars?: number;
  spreadActive?: boolean;
  onStrikeSpreadRow?: (row: number, col: number, whenSec: number) => void;
  onWarmAudio?: () => void | Promise<void>;
  getAudioContext?: () => AudioContext | null;
};

export function useBeatPadsLocalTransport({
  open,
  pattern,
  loopBars,
  stepsPerBar = BEAT_PADS_STEPS_PER_BAR,
  bpm,
  playlineElRef,
  onStrikeStep,
  spreadNotes,
  spreadLoopBars,
  spreadActive = false,
  onStrikeSpreadRow,
  onWarmAudio,
  getAudioContext,
}: UseBeatPadsLocalTransportOpts) {
  const [isPlaying, setIsPlaying] = useState(false);

  const runningRef = useRef(false);
  const sessionStartRef = useRef(0);
  const nextStepIndexRef = useRef(0);
  const firedThroughRef = useRef(-1);
  const lookaheadRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRafRef = useRef(0);

  const patternRef = useRef(pattern);
  const bpmRef = useRef(bpm);
  const stepsPerBarRef = useRef(stepsPerBar);
  const loopColsRef = useRef(beatPadsPatternCols(loopBars, stepsPerBar));
  const onStrikeStepRef = useRef(onStrikeStep);
  const spreadNotesRef = useRef(spreadNotes);
  const spreadLoopBarsRef = useRef(spreadLoopBars);
  const spreadActiveRef = useRef(spreadActive);
  const onStrikeSpreadRowRef = useRef(onStrikeSpreadRow);

  const animRef = useRef<Animation | null>(null);
  const wapiSegStateRef = useRef({ ...BEAT_PADS_PLAYLINE_WAPI_SEG_IDLE });
  const wapiRefs = useRef<BeatPadsPlaylineWapiRefs>({
    animRef,
    wapiSegStateRef,
  });
  const playlineLoopPrevPhaseRef = useRef(-1);
  const playlineLoopCycleRef = useRef(0);

  patternRef.current = pattern;
  bpmRef.current = bpm;
  stepsPerBarRef.current = stepsPerBar;
  loopColsRef.current = beatPadsPatternCols(loopBars, stepsPerBar);
  onStrikeStepRef.current = onStrikeStep;
  spreadNotesRef.current = spreadNotes;
  spreadLoopBarsRef.current = spreadLoopBars;
  spreadActiveRef.current = spreadActive;
  onStrikeSpreadRowRef.current = onStrikeSpreadRow;

  const clearLookahead = useCallback(() => {
    if (lookaheadRef.current != null) {
      clearInterval(lookaheadRef.current);
      lookaheadRef.current = null;
    }
    if (scrollRafRef.current) {
      cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = 0;
    }
  }, []);

  const fireStepAt = useCallback((stepIndex: number, whenSec: number) => {
    const cols = loopColsRef.current;
    if (cols <= 0) return;
    const col = ((stepIndex % cols) + cols) % cols;
    const pat = patternRef.current;
    for (let lane = 0; lane < BEAT_PADS_LANE_COUNT; lane++) {
      if (beatPadsLaneActiveAtStep(pat[lane], col)) {
        onStrikeStepRef.current(lane, col, whenSec);
      }
    }
    const spread = spreadNotesRef.current ?? [];
    const spreadBars = spreadLoopBarsRef.current;
    const strikeSpread = onStrikeSpreadRowRef.current;
    if (spreadActiveRef.current && spreadBars != null && strikeSpread) {
      const spreadCols = beatPadsSpreadPatternCols(spreadBars, stepsPerBarRef.current);
      if (spreadCols > 0) {
        // Same grid column as the main pattern — spread loops inside its 4/8-bar roll.
        const spreadCol = ((col % spreadCols) + spreadCols) % spreadCols;
        for (const note of beatPadsSpreadNotesAtColumn(spread, spreadCol)) {
          strikeSpread(note.row, spreadCol, whenSec);
        }
      }
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
    const horizon = now + BEAT_PADS_SCHEDULE_AHEAD_SEC;

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

  const syncPlaylineScroll = useCallback(() => {
    const el = playlineElRef.current;
    const anim = wapiRefs.current.animRef.current;
    const seg = wapiRefs.current.wapiSegStateRef.current;
    if (!runningRef.current || !el || !anim || seg.durMs <= 0) return;

    const scrollHost =
      (el.closest('.beat-pads-grid-h-scroll-inner') as HTMLElement | null)
      ?? (el.closest('.beat-pads-grid-h-scroll') as HTMLElement | null);
    if (!scrollHost) return;

    const applyScrollLeft = (left: number) => {
      scrollHost.scrollLeft = left;
      const bar = scrollHost.closest('.beat-pads-grid-scroll-host')?.querySelector(
        '.beat-pads-grid-h-scroll',
      );
      if (bar instanceof HTMLElement && bar !== scrollHost) bar.scrollLeft = left;
      const inner = scrollHost.closest('.beat-pads-grid-scroll-host')?.querySelector(
        '.beat-pads-grid-h-scroll-inner',
      );
      if (inner instanceof HTMLElement && inner !== scrollHost) inner.scrollLeft = left;
    };

    if (beatPadsPlaylineWapiLoopWrapped(anim, playlineLoopPrevPhaseRef, playlineLoopCycleRef)) {
      applyScrollLeft(0);
    }

    const colF = beatPadsPlayColFFromWapiAnim(anim.currentTime ?? 0, seg);
    const playheadX = BEAT_PADS_LANE_LABEL_W + beatPadsPlaylineXForCol(colF, BEAT_PADS_COL_W);
    const viewLeft = scrollHost.scrollLeft;
    const viewRight = viewLeft + scrollHost.clientWidth;
    const margin = BEAT_PADS_COL_W * 2;
    if (playheadX < viewLeft + margin) {
      applyScrollLeft(Math.max(0, playheadX - margin));
    } else if (playheadX + BEAT_PADS_COL_W > viewRight - margin) {
      applyScrollLeft(playheadX + BEAT_PADS_COL_W + margin - scrollHost.clientWidth);
    }
  }, [playlineElRef]);

  const startScrollFollow = useCallback(() => {
    const tick = () => {
      if (!runningRef.current) return;
      syncPlaylineScroll();
      scrollRafRef.current = requestAnimationFrame(tick);
    };
    scrollRafRef.current = requestAnimationFrame(tick);
  }, [syncPlaylineScroll]);

  const stop = useCallback(() => {
    runningRef.current = false;
    setIsPlaying(false);
    setBeatPadsTransportRunning(false);
    clearLookahead();
    cancelBeatPadsPlaylineWapi(wapiRefs.current, playlineElRef.current);
    sessionStartRef.current = 0;
    nextStepIndexRef.current = 0;
    firedThroughRef.current = -1;
    playlineLoopPrevPhaseRef.current = -1;
    playlineLoopCycleRef.current = 0;
  }, [clearLookahead, playlineElRef]);

  const start = useCallback(async () => {
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
    playlineLoopPrevPhaseRef.current = -1;
    playlineLoopCycleRef.current = 0;
    runningRef.current = true;
    setIsPlaying(true);
    setBeatPadsTransportRunning(true);

    launchBeatPadsPlaylineWapi(wapiRefs.current, {
      el: playlineElRef.current,
      colNow: 0,
      play: true,
      bpm: bpmRef.current,
      cols: loopColsRef.current,
      colW: BEAT_PADS_COL_W,
      stepsPerBar: stepsPerBarRef.current,
      immediateCompositorStart: true,
    });

    refillSchedule();
    queueMicrotask(() => {
      if (!runningRef.current) return;
      const c = getAudioContext?.();
      if (c && c.state === 'running') refillSchedule();
    });
    lookaheadRef.current = setInterval(() => refillSchedule(), BEAT_PADS_LOOKAHEAD_MS);
    startScrollFollow();
  }, [getAudioContext, onWarmAudio, playlineElRef, refillSchedule, startScrollFollow]);

  const restartFromBarOne = useCallback(async () => {
    const wasRunning = runningRef.current;
    stop();
    if (wasRunning) await start();
  }, [start, stop]);

  useEffect(() => {
    setBeatPadsScreenActive(open);
    return () => setBeatPadsScreenActive(false);
  }, [open]);

  useEffect(() => {
    if (!open) stop();
  }, [open, stop]);

  const prevLoopColsRef = useRef(beatPadsPatternCols(loopBars, stepsPerBar));
  useEffect(() => {
    const cols = beatPadsPatternCols(loopBars, stepsPerBar);
    const prevCols = prevLoopColsRef.current;
    prevLoopColsRef.current = cols;
    loopColsRef.current = cols;
    if (!runningRef.current || cols === prevCols) return;
    relaunchBeatPadsPlaylineWapiForBpm(wapiRefs.current, {
      el: playlineElRef.current,
      play: true,
      bpm: bpmRef.current,
      cols,
      colW: BEAT_PADS_COL_W,
      stepsPerBar: stepsPerBarRef.current,
      colF: 0,
      immediateCompositorStart: true,
    });
    nextStepIndexRef.current = 0;
    firedThroughRef.current = -1;
    const ctx = getAudioContext?.();
    if (ctx && ctx.state === 'running') {
      sessionStartRef.current = ctx.currentTime + SE2_AUDIO_START_FLOOR_SEC;
      refillSchedule();
    }
  }, [loopBars, stepsPerBar, playlineElRef, getAudioContext, refillSchedule]);

  useEffect(() => {
    if (!runningRef.current) return;

    const colF = beatPadsPlayColFFromWapiAnim(
      wapiRefs.current.animRef.current?.currentTime ?? 0,
      wapiRefs.current.wapiSegStateRef.current,
    );
    relaunchBeatPadsPlaylineWapiForBpm(wapiRefs.current, {
      el: playlineElRef.current,
      play: true,
      bpm,
      cols: loopColsRef.current,
      colW: BEAT_PADS_COL_W,
      stepsPerBar: stepsPerBarRef.current,
      colF,
      immediateCompositorStart: true,
    });

    const ctx = getAudioContext?.();
    if (ctx && ctx.state === 'running') {
      const cols = loopColsRef.current;
      if (cols > 0) {
        const stepSec = beatPadsStepDurationSec(bpm, stepsPerBarRef.current);
        const stepInLoop = Math.floor(colF);
        const globalStep = playlineLoopCycleRef.current * cols + stepInLoop;
        const tNow = ctx.currentTime;
        sessionStartRef.current = tNow + SE2_AUDIO_START_FLOOR_SEC - globalStep * stepSec;
        nextStepIndexRef.current = globalStep + 1;
        firedThroughRef.current = globalStep;
        refillSchedule();
      }
    }
  }, [bpm, playlineElRef, getAudioContext, refillSchedule]);

  useEffect(() => () => stop(), [stop]);

  return {
    isPlaying,
    start,
    stop,
    restartFromBarOne,
    togglePlay: () => (runningRef.current ? stop() : void start()),
  };
}

