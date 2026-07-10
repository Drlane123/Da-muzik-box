/**
 * Piano Roll — local transport (25 ms audio + rAF playhead). Standalone from master clock.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import {
  beatLabAudioNow,
  beatLabDisplayBeatFromAudioClock,
  beatLabSnapBeatToQuarterGrid,
  BEAT_LAB_LOOKAHEAD_INTERVAL_MS,
  SE2_AUDIO_START_FLOOR_SEC,
} from '@/app/lib/creationStation/beatLabSe2TransportEngine';
import { resolveBeatLabAudioContext } from '@/app/lib/creationStation/beatLabStepScheduler';
import {
  cancelCreationScheduledMetroNodes,
  ensureCreationMetronomeClickBuffers,
  scheduleCreationMetronomeClickAt,
  type CreationMetronomeClickBuffers,
  type CreationScheduledMetroNode,
} from '@/app/lib/creationStation/creationTransportSync';
import type { CreationTransportRefillOpts } from '@/app/lib/creationStation/creationTransportSystem';
import { paintPianoRollPlayheadBeat } from '@/app/lib/pianoRoll/pianoRollPlayheadPaint';
import {
  formatPianoRollBarsBeatsTicks,
  formatPianoRollTimeMmSsFf,
  PIANO_ROLL_BEATS_PER_BAR,
  PIANO_ROLL_STEPS_PER_BAR,
  refillPianoRollSchedule,
  seedPianoRollTransportOnPlay,
  type PianoRollTransportClock,
  type PianoRollTransportData,
} from '@/app/lib/pianoRoll/pianoRollSe2Scheduler';
import { setPianoRollTransportRunning } from '@/app/lib/pianoRoll/pianoRollTransportSync';
import { reanchorNextStepWhileRunning } from '@/app/lib/creationStation/creationTransportSystem';
import { updateSchedAnchor } from '@/app/lib/studio/se2TransportClock';
import { beatLabSynth2BeatToQuarterColF } from '@/app/lib/creationStation/beatLabSynth2PlaylineWapi';

export type PianoRollTransportUiState = 'stopped' | 'playing' | 'paused' | 'recording';

export type UsePianoRollSe2TransportOptions = {
  active: boolean;
  bpm: number;
  bars: number;
  pxPer16th: number;
  loopEnabled: boolean;
  loopStartBar: number;
  loopBars: number;
  metronomeEnabled: boolean;
  getOrCreateAudioContext: () => AudioContext;
  stopMasterMetronomeLoop: () => void;
  masterOutputLinear: number;
  data: PianoRollTransportData;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  playheadElRef: React.RefObject<HTMLDivElement | null>;
  keyW: number;
  autoScroll: boolean;
};

export function usePianoRollSe2Transport(options: UsePianoRollSe2TransportOptions) {
  const {
    active,
    bpm,
    bars,
    pxPer16th,
    loopEnabled,
    loopStartBar,
    loopBars,
    metronomeEnabled,
    getOrCreateAudioContext,
    stopMasterMetronomeLoop,
    masterOutputLinear,
    data,
    scrollRef,
    playheadElRef,
    keyW,
    autoScroll,
  } = options;

  const [transport, setTransport] = useState<PianoRollTransportUiState>('stopped');
  const runningRef = useRef(false);
  const sessionStartRef = useRef(0);
  const originBeatRef = useRef(0);
  const cursorBeatRef = useRef(0);
  const displayBeatRef = useRef(0);
  const seekBeatRef = useRef(0);
  const bpmRef = useRef(bpm);
  const ctxRef = useRef<AudioContext | null>(null);
  const nextStepBeatRef = useRef(0);
  const nextStepTimeRef = useRef(0);
  const nextMetroKRef = useRef(0);
  const lastScheduledQuarterRef = useRef(Number.NEGATIVE_INFINITY);
  const schedAnchorTimeRef = useRef(0);
  const schedAnchorPerfRef = useRef(0);
  const perfSessionStartMsRef = useRef(0);
  const creationRefillCtSnapRef = useRef(0);
  const metroOnRef = useRef(metronomeEnabled);
  const loopOnRef = useRef(loopEnabled);
  const loopStartBeatRef = useRef(0);
  const loopEndBeatRef = useRef(0);
  const patternColsRef = useRef(bars * PIANO_ROLL_STEPS_PER_BAR);
  const patternBeatsRef = useRef(bars * PIANO_ROLL_BEATS_PER_BAR);
  const pxPer16thRef = useRef(pxPer16th);
  const metroBuffersRef = useRef<CreationMetronomeClickBuffers | null>(null);
  const scheduledMetroRef = useRef<CreationScheduledMetroNode[]>([]);

  bpmRef.current = bpm;
  pxPer16thRef.current = pxPer16th;
  metroOnRef.current = metronomeEnabled;
  loopOnRef.current = loopEnabled;
  loopStartBeatRef.current = (Math.max(1, loopStartBar) - 1) * PIANO_ROLL_BEATS_PER_BAR;
  loopEndBeatRef.current = loopStartBeatRef.current + Math.max(1, loopBars) * PIANO_ROLL_BEATS_PER_BAR;
  patternColsRef.current = bars * PIANO_ROLL_STEPS_PER_BAR;
  patternBeatsRef.current = bars * PIANO_ROLL_BEATS_PER_BAR;
  data.patternColsRef.current = patternColsRef.current;
  data.patternBeatsRef.current = patternBeatsRef.current;
  data.loopOnRef.current = loopEnabled;
  data.loopStartBeatRef.current = loopStartBeatRef.current;
  data.loopEndBeatRef.current = loopEndBeatRef.current;

  const isPlaying = transport === 'playing' || transport === 'recording';
  const transportRef = useRef(transport);
  transportRef.current = transport;

  const clock: PianoRollTransportClock = {
    runningRef,
    sessionStartRef,
    originBeatRef,
    bpmRef,
    nextStepBeatRef,
    nextStepTimeRef,
    nextMetroKRef,
    lastScheduledQuarterRef,
    perfSessionStartMsRef,
    creationRefillCtSnapRef,
  };

  const cancelMetroNodes = useCallback(() => {
    cancelCreationScheduledMetroNodes(scheduledMetroRef.current);
  }, []);

  const playMetro = useCallback((k: number, idealT: number, ctx: AudioContext) => {
    if (!metroOnRef.current) return;
    const buffers = ensureCreationMetronomeClickBuffers(ctx, metroBuffersRef.current);
    metroBuffersRef.current = buffers;
    const orgQ = Math.floor(Math.max(0, originBeatRef.current) + 1e-8);
    const downbeat = (((k - orgQ) % PIANO_ROLL_BEATS_PER_BAR) + PIANO_ROLL_BEATS_PER_BAR) % PIANO_ROLL_BEATS_PER_BAR === 0;
    scheduleCreationMetronomeClickAt(
      ctx,
      idealT,
      downbeat,
      creationRefillCtSnapRef.current,
      buffers,
      () => null,
      scheduledMetroRef.current,
    );
  }, []);

  const paintPlayhead = useCallback((beat: number) => {
    paintPianoRollPlayheadBeat(
      playheadElRef.current,
      beat,
      patternBeatsRef.current,
      patternColsRef.current,
      pxPer16thRef.current,
    );
  }, [playheadElRef]);

  const paintReadouts = useCallback((beats: number, paused: boolean) => {
    const db = Math.max(0, beats);
    const barsText = formatPianoRollBarsBeatsTicks(db);
    const time = formatPianoRollTimeMmSsFf(db, bpmRef.current);
    const elBars = document.querySelector('[data-piano-roll-bars-readout]');
    const elTime = document.querySelector('[data-piano-roll-time-readout]');
    if (elBars) elBars.textContent = paused ? `pause ${barsText}` : barsText;
    if (elTime) elTime.textContent = time;
  }, []);

  const scrollFollowBeat = useCallback(
    (beat: number) => {
      if (!autoScroll) return;
      const scrollEl = scrollRef.current;
      if (!scrollEl) return;
      const colF = beatLabSynth2BeatToQuarterColF(beat, patternBeatsRef.current, patternColsRef.current);
      const px = keyW + colF * pxPer16thRef.current;
      const margin = scrollEl.clientWidth * 0.28;
      const left = scrollEl.scrollLeft;
      const right = left + scrollEl.clientWidth;
      if (px < left + margin || px > right - margin) {
        scrollEl.scrollLeft = Math.max(0, px - scrollEl.clientWidth * 0.35);
      }
    },
    [autoScroll, keyW, scrollRef],
  );

  const wrapDisplayBeat = useCallback((beat: number): number => {
    const tb = Math.max(1e-9, patternBeatsRef.current);
    let b = beat;
    if (loopOnRef.current && loopEndBeatRef.current > loopStartBeatRef.current) {
      const ls = loopStartBeatRef.current;
      const le = loopEndBeatRef.current;
      const span = Math.max(1e-9, le - ls);
      if (b >= le - 1e-6) b = ls + (((b - ls) % span) + span) % span;
    } else if (b >= tb) {
      b = b % tb;
    }
    return Math.max(0, Math.min(tb, b));
  }, []);

  const runningDisplayBeat = useCallback((): number => {
    const ctx = ctxRef.current;
    const tb = patternBeatsRef.current;
    let b = displayBeatRef.current;

    if (ctx && ctx.state === 'running' && sessionStartRef.current > 0) {
      b = beatLabDisplayBeatFromAudioClock(
        ctx,
        { schedAnchorTimeRef, schedAnchorPerfRef },
        sessionStartRef.current,
        originBeatRef.current,
        bpmRef.current,
        tb,
      );
    } else if (perfSessionStartMsRef.current > 0) {
      const elapsed = (performance.now() - perfSessionStartMsRef.current) / 1000;
      b = originBeatRef.current + elapsed / (60 / Math.max(1, bpmRef.current));
    }

    b = wrapDisplayBeat(b);
    displayBeatRef.current = b;
    return b;
  }, [wrapDisplayBeat]);

  const refillRef = useRef((_ctx: AudioContext, _ct: number, _opts?: CreationTransportRefillOpts) => {});
  refillRef.current = (ctx, ctSnap, opts?) => {
    refillPianoRollSchedule(ctx, ctSnap, clock, data, playMetro, () => metroOnRef.current, opts);
  };

  const [hudBeat, setHudBeat] = useState(0);
  const [active16Col, setActive16Col] = useState(-1);

  const onFrame = useCallback(() => {
    if (!runningRef.current) return;
    const visualBeat = runningDisplayBeat();
    cursorBeatRef.current = visualBeat;
    paintPlayhead(visualBeat);
    const col = Math.floor(
      Math.max(0, beatLabSynth2BeatToQuarterColF(visualBeat, patternBeatsRef.current, patternColsRef.current)),
    );
    setHudBeat((prev) => (Math.abs(prev - visualBeat) < 0.0005 ? prev : visualBeat));
    setActive16Col((prev) => (prev === col ? prev : col));
    scrollFollowBeat(visualBeat);
    paintReadouts(visualBeat, false);
  }, [paintPlayhead, paintReadouts, runningDisplayBeat, scrollFollowBeat]);

  const unmuteMasterGain = useCallback(
    (ctx: AudioContext) => {
      const masterGain = (window as unknown as { __daMusicMasterGain?: GainNode | null })
        .__daMusicMasterGain;
      if (!masterGain || masterGain.context !== ctx) return;
      const now = ctx.currentTime;
      const target = Math.max(0, Math.min(1, masterOutputLinear));
      try {
        masterGain.gain.cancelScheduledValues(now);
        masterGain.gain.setValueAtTime(target, now);
      } catch {
        masterGain.gain.value = target;
      }
    },
    [masterOutputLinear],
  );

  const primeAudio = useCallback(() => {
    try {
      const ctx = getOrCreateAudioContext();
      ctxRef.current = ctx;
      if (ctx.state === 'suspended') void ctx.resume();
      unmuteMasterGain(ctx);
    } catch {
      /* ignore */
    }
  }, [getOrCreateAudioContext, unmuteMasterGain]);

  const armTransportRunning = useCallback(
    (origin: number) => {
      runningRef.current = true;
      setPianoRollTransportRunning(true);
      setTransport('playing');
      perfSessionStartMsRef.current = performance.now() + SE2_AUDIO_START_FLOOR_SEC * 1000;
      paintPlayhead(origin);
      onFrame();
      setHudBeat(origin);
      setActive16Col(
        Math.floor(beatLabSynth2BeatToQuarterColF(origin, patternBeatsRef.current, patternColsRef.current)),
      );
      paintReadouts(origin, false);
    },
    [onFrame, paintPlayhead, paintReadouts],
  );

  const start = useCallback(() => {
    const tb = Math.max(1e-9, patternBeatsRef.current);
    const origin = beatLabSnapBeatToQuarterGrid(Math.max(0, seekBeatRef.current), tb);
    originBeatRef.current = origin;
    cursorBeatRef.current = origin;
    displayBeatRef.current = origin;
    seekBeatRef.current = origin;

    stopMasterMetronomeLoop();
    armTransportRunning(origin);

    void (async () => {
      try {
        let ctx = ctxRef.current;
        if (!ctx || ctx.state === 'closed') {
          ctx = getOrCreateAudioContext();
          ctxRef.current = ctx;
        }
        if (ctx.state === 'suspended') await ctx.resume();
        if (!runningRef.current) return;

        unmuteMasterGain(ctx);
        cancelMetroNodes();

        const tAnchor = beatLabAudioNow(ctx);
        sessionStartRef.current = tAnchor + SE2_AUDIO_START_FLOOR_SEC;
        schedAnchorTimeRef.current = tAnchor;
        schedAnchorPerfRef.current = performance.now();
        perfSessionStartMsRef.current = performance.now() + SE2_AUDIO_START_FLOOR_SEC * 1000;

        const spb = 60 / Math.max(1, bpmRef.current);
        seedPianoRollTransportOnPlay(clock, origin, sessionStartRef.current, spb);

        refillRef.current(ctx, tAnchor);
        queueMicrotask(() => {
          if (!runningRef.current || !ctxRef.current) return;
          refillRef.current(ctxRef.current, beatLabAudioNow(ctxRef.current));
        });
      } catch (err) {
        console.warn('[PianoRoll] transport start failed', err);
        runningRef.current = false;
        sessionStartRef.current = 0;
        perfSessionStartMsRef.current = 0;
        setPianoRollTransportRunning(false);
        setTransport('stopped');
        paintPlayhead(cursorBeatRef.current);
      }
    })();
  }, [armTransportRunning, cancelMetroNodes, getOrCreateAudioContext, stopMasterMetronomeLoop, unmuteMasterGain]);

  const pause = useCallback(() => {
    const pauseBeat = runningRef.current ? runningDisplayBeat() : cursorBeatRef.current;
    runningRef.current = false;
    sessionStartRef.current = 0;
    perfSessionStartMsRef.current = 0;
    setPianoRollTransportRunning(false);
    stopMasterMetronomeLoop();
    cancelMetroNodes();

    seekBeatRef.current = pauseBeat;
    originBeatRef.current = pauseBeat;
    cursorBeatRef.current = pauseBeat;
    displayBeatRef.current = pauseBeat;
    setTransport('paused');
    paintPlayhead(pauseBeat);
    setHudBeat(pauseBeat);
    setActive16Col(
      Math.floor(
        beatLabSynth2BeatToQuarterColF(pauseBeat, patternBeatsRef.current, patternColsRef.current),
      ),
    );
    paintReadouts(pauseBeat, true);
  }, [cancelMetroNodes, paintPlayhead, paintReadouts, runningDisplayBeat, stopMasterMetronomeLoop]);

  const stop = useCallback(() => {
    runningRef.current = false;
    sessionStartRef.current = 0;
    perfSessionStartMsRef.current = 0;
    setPianoRollTransportRunning(false);
    stopMasterMetronomeLoop();
    cancelMetroNodes();

    seekBeatRef.current = 0;
    originBeatRef.current = 0;
    cursorBeatRef.current = 0;
    displayBeatRef.current = 0;
    setTransport('stopped');
    paintPlayhead(0);
    setHudBeat(0);
    setActive16Col(-1);
    paintReadouts(0, false);
  }, [cancelMetroNodes, paintPlayhead, paintReadouts, stopMasterMetronomeLoop]);

  const returnToZero = useCallback(() => {
    stop();
  }, [stop]);

  const nudgeBeats = useCallback(
    (delta: number) => {
      if (runningRef.current) return;
      const tb = Math.max(1e-9, patternBeatsRef.current);
      const nb = Math.max(0, Math.min(tb, seekBeatRef.current + delta));
      seekBeatRef.current = nb;
      originBeatRef.current = nb;
      cursorBeatRef.current = nb;
      displayBeatRef.current = nb;
      paintPlayhead(nb);
      setHudBeat(nb);
      setActive16Col(
        Math.floor(beatLabSynth2BeatToQuarterColF(nb, tb, patternColsRef.current)),
      );
      paintReadouts(nb, transportRef.current === 'paused');
    },
    [paintPlayhead, paintReadouts],
  );

  const togglePlay = useCallback(() => {
    primeAudio();
    if (runningRef.current) {
      pause();
      return;
    }
    start();
  }, [pause, primeAudio, start]);

  /** rAF playhead + HUD */
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!runningRef.current) return;
      onFrame();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, onFrame]);

  /** 25 ms audio lookahead */
  useEffect(() => {
    if (!active) return;
    const tick = () => {
      if (!runningRef.current || sessionStartRef.current <= 0) return;
      const ctx = resolveBeatLabAudioContext(ctxRef, getOrCreateAudioContext);
      if (ctx.state === 'closed') return;
      if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
      if (ctx.state !== 'running') return;
      setPianoRollTransportRunning(true);
      const t = beatLabAudioNow(ctx);
      if (sessionStartRef.current > 0) {
        perfSessionStartMsRef.current = performance.now() + (sessionStartRef.current - t) * 1000;
      }
      updateSchedAnchor(ctx, schedAnchorTimeRef, schedAnchorPerfRef);
      refillRef.current(ctx, t);
    };
    tick();
    const id = window.setInterval(tick, BEAT_LAB_LOOKAHEAD_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [active, getOrCreateAudioContext]);

  useEffect(() => {
    if (!active || !runningRef.current) return;
    const ctx = ctxRef.current;
    if (!ctx || ctx.state === 'closed') return;
    stopMasterMetronomeLoop();
    cancelMetroNodes();
    refillRef.current(ctx, Math.max(0, ctx.currentTime), { skipOverdueCatchUp: true });
  }, [active, metronomeEnabled, cancelMetroNodes, stopMasterMetronomeLoop]);

  useEffect(() => {
    if (active) return;
    if (runningRef.current) pause();
  }, [active, pause]);

  useLayoutEffect(() => {
    if (!active || runningRef.current) return;
    const beat = seekBeatRef.current;
    paintPlayhead(beat);
    setHudBeat(beat);
    setActive16Col(
      beat > 0
        ? Math.floor(
            beatLabSynth2BeatToQuarterColF(beat, patternBeatsRef.current, patternColsRef.current),
          )
        : -1,
    );
    paintReadouts(beat, transportRef.current === 'paused');
  }, [active, bars, paintPlayhead, paintReadouts, pxPer16th]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!active) return;
      const typing = (e.target as HTMLElement)?.closest(
        'input, textarea, select, [contenteditable="true"]',
      );
      if (typing) return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
        return;
      }
      if (e.key.toLowerCase() === 's' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        stop();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, stop, togglePlay]);

  return {
    transport,
    isPlaying,
    runningRef,
    cursorBeatRef,
    displayBeatRef,
    hudBeat,
    active16Col,
    start,
    pause,
    stop,
    togglePlay,
    primeAudio,
    returnToZero,
    nudgeBeats,
    seekToBeat: (beat: number) => {
      const tb = Math.max(1e-9, patternBeatsRef.current);
      const b = Math.max(0, Math.min(tb, beat));
      seekBeatRef.current = b;
      originBeatRef.current = b;
      cursorBeatRef.current = b;
      displayBeatRef.current = b;
      if (runningRef.current && ctxRef.current && ctxRef.current.state !== 'closed') {
        const ctx = ctxRef.current;
        const tCapture = beatLabAudioNow(ctx);
        sessionStartRef.current = tCapture + SE2_AUDIO_START_FLOOR_SEC;
        schedAnchorTimeRef.current = tCapture;
        schedAnchorPerfRef.current = performance.now();
        perfSessionStartMsRef.current = performance.now() + SE2_AUDIO_START_FLOOR_SEC * 1000;
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
        paintPlayhead(b);
        refillRef.current(ctx, tCapture, { skipOverdueCatchUp: true });
      } else {
        paintPlayhead(b);
      }
      setHudBeat(b);
      setActive16Col(
        Math.floor(beatLabSynth2BeatToQuarterColF(b, tb, patternColsRef.current)),
      );
      paintReadouts(b, transportRef.current === 'paused');
    },
  };
}
