'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
  BEAT_PADS_STEPS_PER_BAR,
} from '@/app/lib/creationStation/beatLabDrumMachineSequencer';
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
  se2Lab808NormalizeToneGridLoopBars,
  se2Lab808ToneGridStepCount,
  type Se2Lab808ToneGridPattern,
} from '@/app/lib/studio/se2Lab808DrumPattern';
import { refillSe2Lab808DrumOnTransport } from '@/app/lib/studio/se2Lab808DrumTransport';
import { refillSe2Lab808PercOnTransport } from '@/app/lib/studio/se2Lab808PercTransport';
import { SE2_AUDIO_START_FLOOR_SEC } from '@/app/lib/studio/se2TransportClock';
import type { Se2Lab808VoiceParams } from '@/app/lib/studio/se2Lab808Types';

/** Beat Lab / SE2 transport mirror — same horizon as Creation Station. */
const LAB808_TONE_GRID_SCHEDULE_AHEAD_SEC = 3.0;
const LAB808_TONE_GRID_LOOKAHEAD_MS = 25;
const LAB808_LOCAL_TRACK_ID = 'lab808-tone-grid-local';

export type UseSe2Lab808ToneGridTransportArgs = {
  stepCount: number;
  bpm: number;
  voice: Se2Lab808VoiceParams;
  pattern: readonly (readonly boolean[])[];
  disabled?: boolean;
  colWidthPx: number;
  playlineElRef: RefObject<HTMLElement | null>;
  getAudioContext: () => AudioContext;
  getPreviewDestination: (ctx: AudioContext) => AudioNode;
};

/** Local tone-grid loop — SE2 `refillSe2Lab808DrumOnTransport` + WAAPI playline (Beat Pads mirror). */
export function useSe2Lab808ToneGridTransport({
  stepCount,
  bpm,
  voice,
  pattern,
  disabled = false,
  colWidthPx,
  playlineElRef,
  getAudioContext,
  getPreviewDestination,
}: UseSe2Lab808ToneGridTransportArgs) {
  const [playing, setPlaying] = useState(false);
  const [playheadCol, setPlayheadCol] = useState(0);

  const runningRef = useRef(false);
  const sessionStartRef = useRef(0);
  const originBeatRef = useRef(0);
  const scheduledRef = useRef(new Set<string>());
  const lookaheadRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playheadColRef = useRef(0);

  const voiceRef = useRef(voice);
  const patternRef = useRef(pattern);
  const bpmRef = useRef(bpm);
  const stepCountRef = useRef(stepCount);
  const colWidthRef = useRef(colWidthPx);

  const animRef = useRef<Animation | null>(null);
  const wapiSegStateRef = useRef({ ...BEAT_PADS_PLAYLINE_WAPI_SEG_IDLE });
  const wapiRefs = useRef<BeatPadsPlaylineWapiRefs>({ animRef, wapiSegStateRef });

  voiceRef.current = voice;
  patternRef.current = pattern;
  bpmRef.current = bpm;
  stepCountRef.current = stepCount;
  colWidthRef.current = colWidthPx;
  playheadColRef.current = playheadCol;

  const loopBeatsForVoice = useCallback((v: Se2Lab808VoiceParams) => {
    const loopBars = se2Lab808NormalizeToneGridLoopBars(v.toneGridLoopBars);
    return loopBars * 4;
  }, []);

  const stepBeatsForVoice = useCallback(
    (v: Se2Lab808VoiceParams) => {
      const totalSteps = se2Lab808ToneGridStepCount(v.toneGridLoopBars);
      return loopBeatsForVoice(v) / Math.max(1, totalSteps);
    },
    [loopBeatsForVoice],
  );

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
    const col = Math.floor(colF);
    playheadColRef.current = colF;
    setPlayheadCol(colF);
  }, []);

  const refillSchedule = useCallback(() => {
    if (!runningRef.current) return;
    const ctx = getAudioContext();
    if (ctx.state === 'closed') return;
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }
    if (ctx.state !== 'running') return;

    const sessionStart = sessionStartRef.current;
    if (sessionStart <= 0) return;

    const ctSnap = ctx.currentTime;
    const horizon = ctSnap + LAB808_TONE_GRID_SCHEDULE_AHEAD_SEC;
    const spb = 60 / Math.max(1, bpmRef.current);
    const v = voiceRef.current;

    refillSe2Lab808DrumOnTransport({
      ctx,
      ctSnap,
      horizon,
      chainFloor: SE2_AUDIO_START_FLOOR_SEC,
      trackId: LAB808_LOCAL_TRACK_ID,
      voice: v,
      toneGridSteps: patternRef.current as Se2Lab808ToneGridPattern,
      stripIn: getPreviewDestination(ctx),
      originBeat: originBeatRef.current,
      sessionStart,
      spb,
      bpm: bpmRef.current,
      beatsPerBar: 4,
      trackVolume127: 127,
      scheduled: scheduledRef.current,
    });
    refillSe2Lab808PercOnTransport({
      ctx,
      ctSnap,
      horizon,
      chainFloor: SE2_AUDIO_START_FLOOR_SEC,
      trackId: LAB808_LOCAL_TRACK_ID,
      voice: v,
      stripIn: getPreviewDestination(ctx),
      originBeat: originBeatRef.current,
      sessionStart,
      spb,
      beatsPerBar: 4,
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
        stepsPerBar: BEAT_PADS_STEPS_PER_BAR,
        immediateCompositorStart,
      });
    },
    [playlineElRef],
  );

  const reanchorAudioAtCol = useCallback(
    (col: number) => {
      const ctx = getAudioContext();
      if (ctx.state !== 'running' && ctx.state !== 'suspended') return;
      const clamped = Math.max(0, Math.min(stepCountRef.current - 1, Math.floor(col)));
      const v = voiceRef.current;
      originBeatRef.current = clamped * stepBeatsForVoice(v);
      sessionStartRef.current = ctx.currentTime + SE2_AUDIO_START_FLOOR_SEC;
      scheduledRef.current.clear();
      playheadColRef.current = clamped;
      setPlayheadCol(clamped);
      refillSchedule();
    },
    [getAudioContext, refillSchedule, stepBeatsForVoice],
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
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }
    if (ctx.state !== 'running') return;

    scheduledRef.current.clear();
    runningRef.current = true;
    setPlaying(true);

    const startCol = Math.floor(playheadColRef.current);
    const v = voiceRef.current;
    originBeatRef.current = startCol * stepBeatsForVoice(v);
    sessionStartRef.current = ctx.currentTime + SE2_AUDIO_START_FLOOR_SEC;

    launchPlayline(startCol, true, true);
    refillSchedule();
    queueMicrotask(() => {
      if (!runningRef.current) return;
      if (getAudioContext().state === 'running') refillSchedule();
    });
    clearLookahead();
    lookaheadRef.current = setInterval(() => {
      refillSchedule();
      syncPlayheadColFromWapi();
    }, LAB808_TONE_GRID_LOOKAHEAD_MS);
  }, [
    disabled,
    getAudioContext,
    launchPlayline,
    refillSchedule,
    clearLookahead,
    stepBeatsForVoice,
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
      stepsPerBar: BEAT_PADS_STEPS_PER_BAR,
      colF,
      immediateCompositorStart: true,
    });

    const ctx = getAudioContext();
    if (ctx.state === 'running') {
      const clampedCol = Math.floor(colF);
      const v = voiceRef.current;
      originBeatRef.current = clampedCol * stepBeatsForVoice(v);
      sessionStartRef.current = ctx.currentTime + SE2_AUDIO_START_FLOOR_SEC;
      scheduledRef.current.clear();
      refillSchedule();
    }
  }, [bpm, getAudioContext, playlineElRef, refillSchedule, stepBeatsForVoice]);

  useEffect(() => {
    if (disabled && runningRef.current) stop();
  }, [disabled, stop]);

  useEffect(() => () => stop(), [stop]);

  return { playing, playheadCol, play, stop, seekCol };
}
