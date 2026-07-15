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
  setBeatPadsPlaylineAtCol,
  type BeatPadsPlaylineWapiRefs,
} from '@/app/lib/creationStation/beatPadsPlaylineWapi';
import { setBeatPadsScreenActive, setBeatPadsTransportRunning } from '@/app/lib/creationStation/creationTransportSync';
import { haltOrchestraHitPlayback } from '@/app/lib/creationStation/grooveLabOrchestraHitBank';
import { haltPadSamplePlayback } from '@/app/lib/creationStation/padSamplePlayback';
import { refillSe2Lab808DrumOnTransport } from '@/app/lib/studio/se2Lab808DrumTransport';
import { refillSe2Lab808PercOnTransport } from '@/app/lib/studio/se2Lab808PercTransport';
import type { Se2Lab808VoiceParams } from '@/app/lib/studio/se2Lab808Types';
import { refillBeatPadsOrchHitsOnTransport } from '@/app/lib/studio/se2BeatPadsOrchHitsTransport';
import type { BeatPadsOrchHitsVoice } from '@/app/lib/studio/se2BeatPadsOrchHitsVoice';
import { SE2_AUDIO_START_FLOOR_SEC } from '@/app/lib/studio/se2TransportClock';

/** Match Beat Lab lookahead — 120 ms was starving the 16th-note grid. */
const BEAT_PADS_SCHEDULE_AHEAD_SEC = 2.5;
const BEAT_PADS_LOOKAHEAD_MS = 25;
const BEAT_PADS_COL_W = BEAT_PADS_GRID_COL_W;
/** Lane label column — playline lives in the grid column to the right of this. */
const BEAT_PADS_LANE_LABEL_W = 72;

export type BeatPads808LabTransportLink = {
  synced: boolean;
  trackId: string;
  voice: Se2Lab808VoiceParams;
  getDestination: (ctx: AudioContext) => AudioNode | null;
};

export type BeatPadsOrchHitsTransportLink = {
  synced: boolean;
  trackId: string;
  voice: BeatPadsOrchHitsVoice;
  getDestination: (ctx: AudioContext) => AudioNode | null;
};

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
  /** Miniature 808 Lab — plays on the same clock when Sync to BeatPads is on. */
  lab808Link?: BeatPads808LabTransportLink | null;
  /** ORCH hits Lab — plays on the same clock when Sync to BeatPads is on. */
  orchHitsLink?: BeatPadsOrchHitsTransportLink | null;
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
  lab808Link = null,
  orchHitsLink = null,
  onWarmAudio,
  getAudioContext,
}: UseBeatPadsLocalTransportOpts) {
  const [isPlaying, setIsPlaying] = useState(false);

  const runningRef = useRef(false);
  const sessionStartRef = useRef(0);
  const nextStepIndexRef = useRef(0);
  const firedThroughRef = useRef(-1);
  /** Parked grid column for Stop-in-place → Play resumes here. */
  const parkedColRef = useRef(0);
  const lookaheadRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRafRef = useRef(0);
  const lab808ScheduledRef = useRef(new Set<string>());
  const orchHitsScheduledRef = useRef(new Set<string>());

  const patternRef = useRef(pattern);
  const bpmRef = useRef(bpm);
  const stepsPerBarRef = useRef(stepsPerBar);
  const loopColsRef = useRef(beatPadsPatternCols(loopBars, stepsPerBar));
  const onStrikeStepRef = useRef(onStrikeStep);
  const spreadNotesRef = useRef(spreadNotes);
  const spreadLoopBarsRef = useRef(spreadLoopBars);
  const spreadActiveRef = useRef(spreadActive);
  const onStrikeSpreadRowRef = useRef(onStrikeSpreadRow);
  const lab808LinkRef = useRef(lab808Link);
  const orchHitsLinkRef = useRef(orchHitsLink);

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
  lab808LinkRef.current = lab808Link;
  orchHitsLinkRef.current = orchHitsLink;

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

    const lab = lab808LinkRef.current;
    if (lab?.synced) {
      const stripIn = lab.getDestination(ctx);
      if (stripIn) {
        const spb = 60 / Math.max(1, bpmRef.current);
        const trackId = `${lab.trackId}__beatPads808Lab`;
        refillSe2Lab808DrumOnTransport({
          ctx,
          ctSnap: now,
          horizon,
          chainFloor: SE2_AUDIO_START_FLOOR_SEC,
          trackId,
          voice: lab.voice,
          toneGridSteps: lab.voice.toneGridSteps,
          stripIn,
          originBeat: 0,
          sessionStart,
          spb,
          bpm: bpmRef.current,
          beatsPerBar: 4,
          trackVolume127: 127,
          scheduled: lab808ScheduledRef.current,
        });
        refillSe2Lab808PercOnTransport({
          ctx,
          ctSnap: now,
          horizon,
          chainFloor: SE2_AUDIO_START_FLOOR_SEC,
          trackId,
          voice: lab.voice,
          stripIn,
          originBeat: 0,
          sessionStart,
          spb,
          beatsPerBar: 4,
          scheduled: lab808ScheduledRef.current,
        });
      }
    }

    const orch = orchHitsLinkRef.current;
    if (orch?.synced) {
      const stripIn = orch.getDestination(ctx);
      if (stripIn) {
        const spb = 60 / Math.max(1, bpmRef.current);
        refillBeatPadsOrchHitsOnTransport({
          ctx,
          ctSnap: now,
          horizon,
          chainFloor: SE2_AUDIO_START_FLOOR_SEC,
          trackId: `${orch.trackId}__beatPadsOrchHits`,
          voice: orch.voice,
          stripIn,
          originBeat: 0,
          sessionStart,
          spb,
          scheduled: orchHitsScheduledRef.current,
        });
      }
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
    const cols = Math.max(1, loopColsRef.current);
    let parkCol = parkedColRef.current;
    if (runningRef.current) {
      const anim = wapiRefs.current.animRef.current;
      const seg = wapiRefs.current.wapiSegStateRef.current;
      if (anim && seg.durMs > 0) {
        const colF = beatPadsPlayColFFromWapiAnim(Number(anim.currentTime ?? 0), seg);
        parkCol = Math.max(0, Math.min(cols - 1, Math.floor(colF)));
      }
    }
    parkedColRef.current = parkCol;

    runningRef.current = false;
    setIsPlaying(false);
    setBeatPadsTransportRunning(false);
    clearLookahead();
    cancelBeatPadsPlaylineWapi(wapiRefs.current, playlineElRef.current, { parkColF: parkCol });
    sessionStartRef.current = 0;
    // Keep scheduler indices aligned with the parked column for the next Play.
    nextStepIndexRef.current = parkCol;
    firedThroughRef.current = parkCol - 1;
    playlineLoopPrevPhaseRef.current = -1;
    playlineLoopCycleRef.current = 0;
    lab808ScheduledRef.current.clear();
    orchHitsScheduledRef.current.clear();
    // Cut ~2.5s lookahead pad hits + synced ORCH tails immediately.
    haltPadSamplePlayback();
    haltOrchestraHitPlayback(getAudioContext?.() ?? null);
  }, [clearLookahead, getAudioContext, playlineElRef]);

  /** Explicit return to grid start (does not auto-play). */
  const resetToStart = useCallback(() => {
    const wasRunning = runningRef.current;
    if (wasRunning) {
      runningRef.current = false;
      setIsPlaying(false);
      setBeatPadsTransportRunning(false);
      clearLookahead();
      haltPadSamplePlayback();
      haltOrchestraHitPlayback(getAudioContext?.() ?? null);
    }
    parkedColRef.current = 0;
    sessionStartRef.current = 0;
    nextStepIndexRef.current = 0;
    firedThroughRef.current = -1;
    playlineLoopPrevPhaseRef.current = -1;
    playlineLoopCycleRef.current = 0;
    lab808ScheduledRef.current.clear();
    orchHitsScheduledRef.current.clear();
    cancelBeatPadsPlaylineWapi(wapiRefs.current, playlineElRef.current, { resetToStart: true });
    setBeatPadsPlaylineAtCol(playlineElRef.current, 0, BEAT_PADS_COL_W);
  }, [clearLookahead, getAudioContext, playlineElRef]);

  const start = useCallback(async () => {
    await Promise.resolve(onWarmAudio?.());
    if (runningRef.current) return;

    const ctx = getAudioContext?.();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }
    if (ctx.state !== 'running') return;

    const cols = Math.max(1, loopColsRef.current);
    const startCol = Math.max(0, Math.min(cols - 1, Math.floor(parkedColRef.current)));
    const stepSec = beatPadsStepDurationSec(bpmRef.current, stepsPerBarRef.current);
    const tCapture = ctx.currentTime;
    // Anchor so the parked column fires at audio start floor (resume in place).
    sessionStartRef.current = tCapture + SE2_AUDIO_START_FLOOR_SEC - startCol * stepSec;
    nextStepIndexRef.current = startCol;
    firedThroughRef.current = startCol - 1;
    playlineLoopPrevPhaseRef.current = -1;
    playlineLoopCycleRef.current = 0;
    lab808ScheduledRef.current.clear();
    orchHitsScheduledRef.current.clear();
    runningRef.current = true;
    setIsPlaying(true);
    setBeatPadsTransportRunning(true);

    launchBeatPadsPlaylineWapi(wapiRefs.current, {
      el: playlineElRef.current,
      colNow: startCol,
      play: true,
      bpm: bpmRef.current,
      cols,
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
    resetToStart();
    if (wasRunning) await start();
  }, [resetToStart, start]);

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
    if (cols === prevCols) return;
    // Grid length changed — park at bar 1 (matches sequencer layout reset).
    parkedColRef.current = 0;
    nextStepIndexRef.current = 0;
    firedThroughRef.current = -1;
    if (!runningRef.current) return;
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
    lab808ScheduledRef.current.clear();
    orchHitsScheduledRef.current.clear();
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
        lab808ScheduledRef.current.clear();
        orchHitsScheduledRef.current.clear();
        refillSchedule();
      }
    }
  }, [bpm, playlineElRef, getAudioContext, refillSchedule]);

  useEffect(() => () => stop(), [stop]);

  /** Stop parks in place; Stop again while already stopped returns to bar 1. */
  const stopOrResetToStart = useCallback(() => {
    if (runningRef.current) {
      stop();
      return;
    }
    resetToStart();
  }, [resetToStart, stop]);

  return {
    isPlaying,
    start,
    stop,
    stopOrResetToStart,
    resetToStart,
    restartFromBarOne,
    togglePlay: () => (runningRef.current ? stop() : void start()),
  };
}

