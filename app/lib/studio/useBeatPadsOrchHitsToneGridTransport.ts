'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
  BEAT_PADS_PLAYLINE_WAPI_SEG_IDLE,
  beatPadsPlayColFFromWapiAnim,
  cancelBeatPadsPlaylineWapi,
  launchBeatPadsPlaylineWapi,
  relaunchBeatPadsPlaylineWapiForBpm,
  setBeatPadsPlaylineAtCol,
  type BeatPadsPlaylineWapiRefs,
} from '@/app/lib/creationStation/beatPadsPlaylineWapi';
import {
  BEAT_PADS_ORCH_HITS_STEPS_PER_BAR,
  beatPadsOrchHitsNormalizeLoopBars,
  beatPadsOrchHitsStepCount,
  type BeatPadsOrchHitsVoice,
} from '@/app/lib/studio/se2BeatPadsOrchHitsVoice';
import { refillBeatPadsOrchHitsOnTransport } from '@/app/lib/studio/se2BeatPadsOrchHitsTransport';
import { SE2_AUDIO_START_FLOOR_SEC } from '@/app/lib/studio/se2TransportClock';

const ORCH_HITS_SCHEDULE_AHEAD_SEC = 3.0;
const ORCH_HITS_LOOKAHEAD_MS = 25;
const ORCH_HITS_LOCAL_TRACK_ID = 'beat-pads-orch-hits-local';

export type UseBeatPadsOrchHitsToneGridTransportArgs = {
  stepCount: number;
  bpm: number;
  voice: BeatPadsOrchHitsVoice;
  disabled?: boolean;
  colWidthPx: number;
  playlineElRef: RefObject<HTMLElement | null>;
  getAudioContext: () => AudioContext | null;
  getPreviewDestination: (ctx: AudioContext) => AudioNode | null;
};

/** Local ORCH hits loop — WAAPI playline + lookahead refill (808 Lab tone-grid mirror). */
export function useBeatPadsOrchHitsToneGridTransport({
  stepCount,
  bpm,
  voice,
  disabled = false,
  colWidthPx,
  playlineElRef,
  getAudioContext,
  getPreviewDestination,
}: UseBeatPadsOrchHitsToneGridTransportArgs) {
  const [playing, setPlaying] = useState(false);
  const [playheadCol, setPlayheadCol] = useState(0);

  const runningRef = useRef(false);
  const sessionStartRef = useRef(0);
  const originBeatRef = useRef(0);
  const scheduledRef = useRef(new Set<string>());
  const lookaheadRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playheadColRef = useRef(0);

  const voiceRef = useRef(voice);
  const bpmRef = useRef(bpm);
  const stepCountRef = useRef(stepCount);
  const colWidthRef = useRef(colWidthPx);

  const animRef = useRef<Animation | null>(null);
  const wapiSegStateRef = useRef({ ...BEAT_PADS_PLAYLINE_WAPI_SEG_IDLE });
  const wapiRefs = useRef<BeatPadsPlaylineWapiRefs>({ animRef, wapiSegStateRef });

  voiceRef.current = voice;
  bpmRef.current = bpm;
  stepCountRef.current = stepCount;
  colWidthRef.current = colWidthPx;
  playheadColRef.current = playheadCol;

  const stepBeats = useCallback((v: BeatPadsOrchHitsVoice) => {
    const bars = beatPadsOrchHitsNormalizeLoopBars(v.loopBars);
    const cols = beatPadsOrchHitsStepCount(bars);
    const loopBeats = bars * 4;
    return loopBeats / Math.max(1, cols);
  }, []);

  const clearLookahead = useCallback(() => {
    if (lookaheadRef.current != null) {
      clearInterval(lookaheadRef.current);
      lookaheadRef.current = null;
    }
  }, []);

  const syncPlayheadColFromWapi = useCallback(() => {
    const anim = wapiRefs.current.animRef.current;
    if (!anim) return;
    const seg = wapiRefs.current.wapiSegStateRef.current;
    const colF = beatPadsPlayColFFromWapiAnim(anim.currentTime ?? 0, seg);
    playheadColRef.current = colF;
    setPlayheadCol(colF);
  }, []);

  const refillSchedule = useCallback(() => {
    if (!runningRef.current) return;
    const ctx = getAudioContext();
    if (!ctx || ctx.state === 'closed') return;
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }
    if (ctx.state !== 'running') return;

    const sessionStart = sessionStartRef.current;
    if (sessionStart <= 0) return;

    const dest = getPreviewDestination(ctx) ?? ctx.destination;
    const ctSnap = ctx.currentTime;
    const horizon = ctSnap + ORCH_HITS_SCHEDULE_AHEAD_SEC;
    const spb = 60 / Math.max(1, bpmRef.current);

    refillBeatPadsOrchHitsOnTransport({
      ctx,
      ctSnap,
      horizon,
      chainFloor: SE2_AUDIO_START_FLOOR_SEC,
      trackId: ORCH_HITS_LOCAL_TRACK_ID,
      voice: voiceRef.current,
      stripIn: dest,
      originBeat: originBeatRef.current,
      sessionStart,
      spb,
      scheduled: scheduledRef.current,
    });
  }, [getAudioContext, getPreviewDestination]);

  const launchPlayline = useCallback(
    (colNow: number, play: boolean, immediateCompositorStart = true) => {
      launchBeatPadsPlaylineWapi(wapiRefs.current, {
        el: playlineElRef.current,
        colNow,
        play,
        bpm: bpmRef.current,
        cols: stepCountRef.current,
        colW: colWidthRef.current,
        stepsPerBar: BEAT_PADS_ORCH_HITS_STEPS_PER_BAR,
        immediateCompositorStart,
      });
    },
    [playlineElRef],
  );

  const reanchorAudioAtCol = useCallback(
    (col: number) => {
      const ctx = getAudioContext();
      if (!ctx || (ctx.state !== 'running' && ctx.state !== 'suspended')) return;
      const clamped = Math.max(0, Math.min(stepCountRef.current - 1, Math.floor(col)));
      originBeatRef.current = clamped * stepBeats(voiceRef.current);
      sessionStartRef.current = ctx.currentTime + SE2_AUDIO_START_FLOOR_SEC;
      scheduledRef.current.clear();
      playheadColRef.current = clamped;
      setPlayheadCol(clamped);
      refillSchedule();
    },
    [getAudioContext, refillSchedule, stepBeats],
  );

  const stop = useCallback(() => {
    runningRef.current = false;
    setPlaying(false);
    clearLookahead();
    cancelBeatPadsPlaylineWapi(wapiRefs.current, playlineElRef.current);
    scheduledRef.current.clear();
    sessionStartRef.current = 0;
    originBeatRef.current = 0;
    playheadColRef.current = 0;
    setPlayheadCol(0);
    setBeatPadsPlaylineAtCol(playlineElRef.current, 0, colWidthRef.current);
  }, [clearLookahead, playlineElRef]);

  const play = useCallback(async () => {
    if (disabled || stepCountRef.current < 1) return;

    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }
    if (ctx.state !== 'running') return;

    scheduledRef.current.clear();
    runningRef.current = true;
    setPlaying(true);

    const startCol = Math.floor(playheadColRef.current);
    originBeatRef.current = startCol * stepBeats(voiceRef.current);
    sessionStartRef.current = ctx.currentTime + SE2_AUDIO_START_FLOOR_SEC;

    launchPlayline(startCol, true, true);
    refillSchedule();
    queueMicrotask(() => {
      if (!runningRef.current) return;
      const c = getAudioContext();
      if (c?.state === 'running') refillSchedule();
    });
    clearLookahead();
    lookaheadRef.current = setInterval(() => {
      refillSchedule();
      syncPlayheadColFromWapi();
    }, ORCH_HITS_LOOKAHEAD_MS);
  }, [
    disabled,
    getAudioContext,
    launchPlayline,
    refillSchedule,
    clearLookahead,
    stepBeats,
    syncPlayheadColFromWapi,
  ]);

  const seekCol = useCallback(
    (col: number) => {
      const clamped = Math.max(0, Math.min(stepCountRef.current - 1, col));
      playheadColRef.current = clamped;
      setPlayheadCol(clamped);
      if (runningRef.current) {
        launchPlayline(clamped, true, true);
        reanchorAudioAtCol(clamped);
        return;
      }
      setBeatPadsPlaylineAtCol(playlineElRef.current, clamped, colWidthRef.current);
    },
    [launchPlayline, playlineElRef, reanchorAudioAtCol],
  );

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
      cols: stepCountRef.current,
      colW: colWidthRef.current,
      stepsPerBar: BEAT_PADS_ORCH_HITS_STEPS_PER_BAR,
      colF,
      immediateCompositorStart: true,
    });

    const ctx = getAudioContext();
    if (ctx?.state === 'running') {
      const clampedCol = Math.floor(colF);
      originBeatRef.current = clampedCol * stepBeats(voiceRef.current);
      sessionStartRef.current = ctx.currentTime + SE2_AUDIO_START_FLOOR_SEC;
      scheduledRef.current.clear();
      refillSchedule();
    }
  }, [bpm, getAudioContext, playlineElRef, refillSchedule, stepBeats]);

  useEffect(() => {
    if (disabled && runningRef.current) stop();
  }, [disabled, stop]);

  useEffect(() => () => stop(), [stop]);

  return { playing, playheadCol, play, stop, seekCol };
}
