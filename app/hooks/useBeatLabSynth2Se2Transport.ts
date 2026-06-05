/**
 * NEW SYNTH transport — Groove Lab mirror: one playhead WAAPI + 25 ms audio pump.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useBeatLabSe2TransportMirror } from '@/app/hooks/useBeatLabSe2TransportMirror';
import {
  beatLabSnapBeatToQuarterGrid,
  beatLabAudioNow,
  beatLabDisplayBeatFromAudioClock,
  SE2_AUDIO_START_FLOOR_SEC,
} from '@/app/lib/creationStation/beatLabSe2TransportEngine';
import {
  reanchorNextStepWhileRunning,
  type CreationTransportRefillOpts,
} from '@/app/lib/creationStation/creationTransportSystem';
import {
  beatLabSynthQuarterCellW,
  beatLabStepsPerQuarter,
} from '@/app/lib/creationStation/beatLabChordPianoRollAdapter';
import {
  beatLabSynth2BeatFromPlaylineWapiAnim,
  beatLabSynth2BeatToQuarterColF,
  beatLabSynth2QuarterColFToPx,
  cancelBeatLabSynth2PlaylineWapi,
  createBeatLabSynth2PlaylineWapiRefs,
  launchBeatLabSynth2PlaylineWapi,
  seekRunningBeatLabSynth2PlaylineWapi,
  snapBeatLabSynth2PlaylineStatic,
  type BeatLabSynth2PlaylineWapiRefs,
} from '@/app/lib/creationStation/beatLabSynth2PlaylineWapi';
import {
  refillBeatLabSynth2Schedule,
  seedBeatLabSynth2TransportOnPlay,
  type BeatLabSynth2TransportClock,
  type BeatLabSynth2TransportData,
} from '@/app/lib/creationStation/beatLabSynth2Transport';
import { CB_PIANO_LABEL_W } from '@/app/lib/creationStation/chordBuilderPianoRollTheme';
import { setCreationBeatLabTransportRunning } from '@/app/lib/creationStation/creationTransportSync';
import { ensureBeatLabMelodicInstrumentsReady } from '@/app/lib/creationStation/beatLabMelodicSoundfont';
import { smoothSchedNow, updateSchedAnchor } from '@/app/lib/studio/se2TransportClock';
import { publishCreationTransportBeat } from '@/app/lib/creationStation/creationTransportBeatExternal';

export type BeatLabSynth2TransportUiState = 'stopped' | 'playing' | 'paused' | 'recording';

export type UseBeatLabSynth2Se2TransportOptions = {
  active: boolean;
  getOrCreateAudioContext: () => AudioContext;
  data: BeatLabSynth2TransportData;
  playheadElRef: React.RefObject<HTMLDivElement | null>;
  playlineWapiRefs: BeatLabSynth2PlaylineWapiRefs;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  followRef: React.MutableRefObject<boolean>;
  followPausedRef: React.MutableRefObject<boolean>;
  programmaticScrollRef: React.MutableRefObject<boolean>;
  metroOnRef: React.MutableRefObject<boolean>;
  paintReadouts: (beats: number, paused: boolean) => void;
  onHarmonyPulse?: (midis: number[], ms: number) => void;
  scheduleMetronomeClickAt: (
    ctx: AudioContext,
    idealT: number,
    downbeat: boolean,
    ctSnap: number,
  ) => void;
  beatsPerBarRef: React.MutableRefObject<number>;
  haltMelodicVoices: () => void;
  cancelMetroNodes: () => void;
  stopMetronomeLoop: () => void;
  metronomeEnabled: boolean;
  drumStepSubdiv: number;
  bpm: number;
  loopOn: boolean;
  loopStartBeat: number;
  loopEndBeat: number;
};

export { createBeatLabSynth2PlaylineWapiRefs } from '@/app/lib/creationStation/beatLabSynth2PlaylineWapi';

export function useBeatLabSynth2Se2Transport(options: UseBeatLabSynth2Se2TransportOptions) {
  const {
    active,
    getOrCreateAudioContext,
    data,
    playheadElRef,
    playlineWapiRefs,
    scrollRef,
    followRef,
    followPausedRef,
    programmaticScrollRef,
    metroOnRef,
    paintReadouts,
    onHarmonyPulse,
    scheduleMetronomeClickAt,
    beatsPerBarRef: beatsPerBarRefOpt,
    haltMelodicVoices,
    cancelMetroNodes,
    stopMetronomeLoop,
    metronomeEnabled,
    drumStepSubdiv,
    bpm,
    loopOn,
    loopStartBeat,
    loopEndBeat,
  } = options;

  const [transport, setTransport] = useState<BeatLabSynth2TransportUiState>('stopped');
  const startGenRef = useRef(0);
  const lastScrollColRef = useRef(-1);

  const runningRef = useRef(false);
  const sessionStartRef = useRef(0);
  const originBeatRef = useRef(0);
  const cursorBeatRef = useRef(0);
  const displayBeatRef = useRef(0);
  const seekBeatRef = useRef(0);
  const bpmRef = data.bpmRef;
  const nextStepBeatRef = useRef(0);
  const nextStepTimeRef = useRef(0);
  const nextMetroKRef = useRef(0);
  const lastScheduledQuarterRef = useRef(Number.NEGATIVE_INFINITY);
  const schedAnchorTimeRef = useRef(0);
  const schedAnchorPerfRef = useRef(0);
  const perfSessionStartMsRef = useRef(0);
  const creationRefillCtSnapRef = useRef(0);
  const ctxRef = useRef<AudioContext | null>(null);

  const clock: BeatLabSynth2TransportClock = useMemo(
    () => ({
      runningRef,
      sessionStartRef,
      originBeatRef,
      cursorBeatRef,
      displayBeatRef,
      bpmRef,
      nextStepBeatRef,
      nextStepTimeRef,
      nextMetroKRef,
      lastScheduledQuarterRef,
      schedAnchorTimeRef,
      schedAnchorPerfRef,
      perfSessionStartMsRef,
      creationRefillCtSnapRef,
    }),
    [bpmRef],
  );

  const geomRef = useRef({ quarterCols: 1, totalBeats: 1, colsPerBar: 4, subdiv: 4 });
  geomRef.current = {
    quarterCols: Math.max(
      1,
      Math.ceil(
        (Math.max(1e-9, data.patternColsDrumsBeatsRef.current) *
          data.measuresPerBar) /
          Math.max(1, data.beatsPerBarRef.current),
      ),
    ),
    totalBeats: Math.max(1e-9, data.patternColsDrumsBeatsRef.current),
    colsPerBar: data.measuresPerBar,
    subdiv: Math.max(1, Math.round(data.drumStepSubdivRef.current)),
  };

  const playMetro = useCallback(
    (k: number, idealT: number, ctx: AudioContext) => {
      const bpb = Math.max(2, Math.min(16, Math.round(beatsPerBarRefOpt.current)));
      const orgQ = Math.floor(Math.max(0, originBeatRef.current) + 1e-8);
      const downbeat = (((k - orgQ) % bpb) + bpb) % bpb === 0;
      scheduleMetronomeClickAt(ctx, idealT, downbeat, creationRefillCtSnapRef.current);
    },
    [beatsPerBarRefOpt, scheduleMetronomeClickAt],
  );

  const isPlaying = transport === 'playing' || transport === 'recording';
  const transportNotStopped = transport !== 'stopped';

  const playlineOpts = useCallback(
    (beatNow: number, play: boolean, immediateCompositorStart?: boolean) => {
      const g = geomRef.current;
      return {
        el: playheadElRef.current,
        beatNow,
        play,
        bpm: bpmRef.current,
        totalBeats: g.totalBeats,
        quarterCols: g.quarterCols,
        colsPerBar: g.colsPerBar,
        immediateCompositorStart,
      };
    },
    [bpmRef, playheadElRef],
  );

  const launchPlayline = useCallback(
    (beatNow: number, play: boolean, immediateCompositorStart?: boolean) => {
      try {
        launchBeatLabSynth2PlaylineWapi(
          playlineWapiRefs,
          playlineOpts(beatNow, play, immediateCompositorStart),
        );
      } catch {
        /* playhead not mounted */
      }
    },
    [playlineOpts, playlineWapiRefs],
  );

  const snapPlaylineStatic = useCallback(
    (beatNow: number) => {
      snapBeatLabSynth2PlaylineStatic(playlineOpts(beatNow, false));
    },
    [playlineOpts],
  );

  const scrollFollowBeat = useCallback(
    (beat: number) => {
      const scrollEl = scrollRef.current;
      if (!scrollEl) return;
      const g = geomRef.current;
      const spq = beatLabStepsPerQuarter(g.subdiv, data.beatsPerBarRef.current, g.colsPerBar);
      const col = Math.floor(Math.max(0, beat) * spq / Math.max(1, g.subdiv));
      if (col === lastScrollColRef.current) return;
      lastScrollColRef.current = col;
      const cellW = beatLabSynthQuarterCellW(g.colsPerBar);
      const colF = beatLabSynth2BeatToQuarterColF(beat, g.totalBeats, g.quarterCols);
      const px = CB_PIANO_LABEL_W + beatLabSynth2QuarterColFToPx(colF, cellW) - 0.5;
      const margin = scrollEl.clientWidth * 0.28;
      const left = scrollEl.scrollLeft;
      const right = left + scrollEl.clientWidth;
      if (px < left + margin || px > right - margin) {
        programmaticScrollRef.current = true;
        scrollEl.scrollLeft = Math.max(0, px - scrollEl.clientWidth * 0.35);
        programmaticScrollRef.current = false;
      }
    },
    [data.beatsPerBarRef, programmaticScrollRef, scrollRef],
  );

  const refillRef = useRef((_ctx: AudioContext, _ct: number, _opts?: CreationTransportRefillOpts) => {});
  refillRef.current = (ctx, ctSnap, opts?) => {
    refillBeatLabSynth2Schedule(
      ctx,
      ctSnap,
      clock,
      data,
      playMetro,
      () => metroOnRef.current,
      onHarmonyPulse,
      opts,
    );
  };

  const onFrameRef = useRef((_displayBeat: number) => {});
  onFrameRef.current = () => {
    const g = geomRef.current;
    let displayBeat = displayBeatRef.current;
    const ctx = ctxRef.current;

    if (runningRef.current && ctx && ctx.state === 'running' && sessionStartRef.current > 0) {
      displayBeat = beatLabDisplayBeatFromAudioClock(
        ctx,
        { schedAnchorTimeRef, schedAnchorPerfRef },
        sessionStartRef.current,
        originBeatRef.current,
        bpmRef.current,
        g.totalBeats,
      );
      displayBeatRef.current = displayBeat;
    }

    if (!runningRef.current) return;

    const anim = playlineWapiRefs.animRef.current;
    let visualBeat = displayBeat;
    if (anim && anim.playState !== 'idle') {
      visualBeat = beatLabSynth2BeatFromPlaylineWapiAnim(
        Number(anim.currentTime ?? 0),
        playlineWapiRefs.wapiSegStateRef.current,
      );
    }
    cursorBeatRef.current = visualBeat;

    if (followRef.current && !followPausedRef.current) {
      scrollFollowBeat(visualBeat);
    }

    publishCreationTransportBeat();
    paintReadouts(displayBeat, false);
  };

  const ensureCtx = useCallback(async () => {
    let ctx = ctxRef.current ?? getOrCreateAudioContext();
    ctxRef.current = ctx;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        /* autoplay */
      }
    }
    return ctx;
  }, [getOrCreateAudioContext]);

  const primePlaylineInGesture = useCallback(() => {
    launchPlayline(cursorBeatRef.current, true, true);
  }, [launchPlayline]);

  const relaunchPlaylineIfRunning = useCallback(() => {
    if (!runningRef.current) return;
    launchPlayline(cursorBeatRef.current, true, true);
    seekRunningBeatLabSynth2PlaylineWapi(playlineWapiRefs, cursorBeatRef.current);
  }, [launchPlayline, playlineWapiRefs]);

  const start = useCallback(
    async (mode: 'play' | 'record' = 'play') => {
      const gen = ++startGenRef.current;
      const tb = Math.max(1e-9, data.patternColsDrumsBeatsRef.current);
      const origin = beatLabSnapBeatToQuarterGrid(Math.max(0, seekBeatRef.current), tb);

      try {
        const ctx = await ensureCtx();
        if (gen !== startGenRef.current) return;

        stopMetronomeLoop();
        cancelMetroNodes();
        haltMelodicVoices();

        originBeatRef.current = origin;
        cursorBeatRef.current = origin;
        displayBeatRef.current = origin;
        seekBeatRef.current = origin;

        const tAnchor = beatLabAudioNow(ctx);
        sessionStartRef.current = tAnchor + SE2_AUDIO_START_FLOOR_SEC;
        schedAnchorTimeRef.current = tAnchor;
        schedAnchorPerfRef.current = performance.now();
        perfSessionStartMsRef.current = performance.now() + SE2_AUDIO_START_FLOOR_SEC * 1000;

        const spb = 60 / Math.max(1, bpmRef.current);
        seedBeatLabSynth2TransportOnPlay(clock, origin, sessionStartRef.current, spb);
        lastScrollColRef.current = -1;

        runningRef.current = true;
        setCreationBeatLabTransportRunning(true);
        setTransport(mode === 'record' ? 'recording' : 'playing');

        if (playheadElRef.current) playheadElRef.current.style.opacity = '1';
        launchPlayline(origin, true, true);
        refillRef.current(ctx, tAnchor);
        seekRunningBeatLabSynth2PlaylineWapi(playlineWapiRefs, origin);
        queueMicrotask(() => {
          if (!runningRef.current) return;
          const c = ctxRef.current;
          if (!c || c.state === 'closed') return;
          refillRef.current(c, beatLabAudioNow(c));
        });

        void ensureBeatLabMelodicInstrumentsReady(ctx, [
          ...data.melodicInstrumentsRef.current,
          data.beatLabSynth2PianoInstrumentRef.current,
        ]);
        paintReadouts(origin, false);
      } catch {
        runningRef.current = false;
        setCreationBeatLabTransportRunning(false);
        setTransport('stopped');
        snapPlaylineStatic(cursorBeatRef.current);
      }
    },
    [
      bpmRef,
      cancelMetroNodes,
      clock,
      data,
      ensureCtx,
      haltMelodicVoices,
      launchPlayline,
      paintReadouts,
      playheadElRef,
      playlineWapiRefs,
      snapPlaylineStatic,
      stopMetronomeLoop,
    ],
  );

  const pause = useCallback(() => {
    const ctx = ctxRef.current;
    let pauseBeat = cursorBeatRef.current;
    if (ctx && ctx.state !== 'closed' && sessionStartRef.current > 0) {
      updateSchedAnchor(ctx, schedAnchorTimeRef, schedAnchorPerfRef);
      const tNow = smoothSchedNow(schedAnchorTimeRef, schedAnchorPerfRef, ctx);
      const tb = Math.max(1e-9, data.patternColsDrumsBeatsRef.current);
      pauseBeat = beatLabDisplayBeatFromAudioClock(
        ctx,
        { schedAnchorTimeRef, schedAnchorPerfRef },
        sessionStartRef.current,
        originBeatRef.current,
        bpmRef.current,
        tb,
      );
    }
    startGenRef.current += 1;
    runningRef.current = false;
    sessionStartRef.current = 0;
    setCreationBeatLabTransportRunning(false);
    stopMetronomeLoop();
    cancelMetroNodes();
    haltMelodicVoices();
    lastScrollColRef.current = -1;

    seekBeatRef.current = pauseBeat;
    originBeatRef.current = pauseBeat;
    cursorBeatRef.current = pauseBeat;
    displayBeatRef.current = pauseBeat;
    setTransport('paused');
    launchPlayline(pauseBeat, false);
    paintReadouts(pauseBeat, true);
  }, [bpmRef, cancelMetroNodes, data, haltMelodicVoices, launchPlayline, paintReadouts, stopMetronomeLoop]);

  const stop = useCallback(() => {
    startGenRef.current += 1;
    runningRef.current = false;
    sessionStartRef.current = 0;
    setCreationBeatLabTransportRunning(false);
    stopMetronomeLoop();
    cancelMetroNodes();
    haltMelodicVoices();
    lastScrollColRef.current = -1;

    seekBeatRef.current = 0;
    originBeatRef.current = 0;
    cursorBeatRef.current = 0;
    displayBeatRef.current = 0;
    setTransport('stopped');
    cancelBeatLabSynth2PlaylineWapi(playlineWapiRefs, playheadElRef.current);
    snapPlaylineStatic(0);
    paintReadouts(0, false);
  }, [
    cancelMetroNodes,
    haltMelodicVoices,
    paintReadouts,
    playheadElRef,
    playlineWapiRefs,
    snapPlaylineStatic,
    stopMetronomeLoop,
  ]);

  const seekToBeat = useCallback(
    (beat: number) => {
      const tb = Math.max(1e-9, data.patternColsDrumsBeatsRef.current);
      const b = Math.max(0, Math.min(tb, beat));
      seekBeatRef.current = b;
      originBeatRef.current = b;
      cursorBeatRef.current = b;
      displayBeatRef.current = b;
      lastScrollColRef.current = -1;

      const ctx = ctxRef.current;
      if (runningRef.current && ctx && ctx.state !== 'closed') {
        const tCapture = beatLabAudioNow(ctx);
        sessionStartRef.current = tCapture + SE2_AUDIO_START_FLOOR_SEC;
        schedAnchorTimeRef.current = tCapture;
        schedAnchorPerfRef.current = performance.now();
        const spb = 60 / Math.max(1, bpmRef.current);
        reanchorNextStepWhileRunning(
          {
            nextStepBeatRef,
            nextStepTimeRef,
            sessionStartRef,
            originBeatRef,
            lastScheduledQuarterRef,
          },
          sessionStartRef.current,
          b,
          spb,
        );
        nextMetroKRef.current = beatLabSnapBeatToQuarterGrid(b, tb);
        cancelMetroNodes();
        haltMelodicVoices();
        launchPlayline(b, true, true);
        seekRunningBeatLabSynth2PlaylineWapi(playlineWapiRefs, b);
        refillRef.current(ctx, tCapture, { skipOverdueCatchUp: true });
      } else {
        snapPlaylineStatic(b);
      }
      paintReadouts(b, transport === 'paused');
    },
    [
      bpmRef,
      cancelMetroNodes,
      data,
      haltMelodicVoices,
      launchPlayline,
      paintReadouts,
      playlineWapiRefs,
      snapPlaylineStatic,
      transport,
    ],
  );

  useBeatLabSe2TransportMirror(
    {
      ctxRef,
      runningRef,
      sessionStartRef,
      originBeatRef,
      displayBeatRef,
      bpmRef,
      lastScheduledQuarterRef,
      schedAnchorTimeRef,
      schedAnchorPerfRef,
      totalBeatsRef: data.patternColsDrumsBeatsRef,
      perfSessionStartMsRef,
    },
    {
      isScreenActive: active,
      isPlaying,
      getOrCreateAudioContext,
      refillRef,
      onFrameRef,
    },
  );

  useEffect(() => {
    if (!active || !runningRef.current) return;
    launchPlayline(cursorBeatRef.current, true, true);
    seekRunningBeatLabSynth2PlaylineWapi(playlineWapiRefs, cursorBeatRef.current);
  }, [active, bpm, drumStepSubdiv, launchPlayline, loopEndBeat, loopOn, loopStartBeat, playlineWapiRefs]);

  useEffect(() => {
    if (!active || !runningRef.current) return;
    const ctx = ctxRef.current;
    if (!ctx || ctx.state === 'closed') return;
    stopMetronomeLoop();
    cancelMetroNodes();
    refillRef.current(ctx, Math.max(0, ctx.currentTime), { skipOverdueCatchUp: true });
  }, [active, metronomeEnabled, cancelMetroNodes, stopMetronomeLoop]);

  useEffect(() => {
    if (active) return;
    if (runningRef.current) pause();
  }, [active, pause]);

  return {
    transport,
    isPlaying,
    transportNotStopped,
    runningRef,
    cursorBeatRef,
    displayBeatRef,
    start,
    pause,
    stop,
    seekToBeat,
    relaunchPlaylineIfRunning,
    primePlaylineInGesture,
  };
}
