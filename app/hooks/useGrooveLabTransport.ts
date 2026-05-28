import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { ChordVoiceId } from '@/app/lib/creationStation/chordSequencerVoices';
import type { GrooveLabBassSoundId } from '@/app/lib/creationStation/grooveLabBassSounds';
import { CB_PIANO_METRICS } from '@/app/lib/creationStation/chordBuilderPianoRollTheme';
import { grooveLabSlotToGlobalCol } from '@/app/lib/creationStation/grooveLabGrid';
import {
  grooveLabAudioNow,
  grooveLabVisualSlotFromWapi,
  smoothSchedNow,
  updateSchedAnchor,
} from '@/app/lib/creationStation/grooveLabSe2TransportEngine';
import {
  cancelGrooveLabPlaylineWapi,
  GROOVE_PLAYLINE_WAPI_SEG_IDLE,
  launchGrooveLabPlaylineWapi,
  seekRunningGrooveLabPlaylineWapi,
  setGrooveLabPlaylineTransformStatic,
  type GrooveLabPlaylineWapiRefs,
  type GrooveLabPlaylineWapiSegState,
} from '@/app/lib/creationStation/grooveLabPlaylineWapi';
import {
  GROOVE_LAB_SLOTS_PER_BAR,
  grooveLabSlotsPerCell,
  grooveLabTotalSlots,
  type GrooveLabQuantize,
  type GrooveRollHit,
} from '@/app/lib/creationStation/grooveLabRoll';
import { grooveLabColFToPx, loopSlotIndex, slotAtSessionTime } from '@/app/lib/creationStation/grooveLabTransportSync';
import { useMasterClock } from '@/app/context/MasterClockContext';
import {
  ensureCreationMetronomeClickBuffers,
  scheduleGrooveLabMetronomeClickAt,
  setGrooveLabTransportRunning,
  type CreationMetronomeClickBuffers,
  type CreationScheduledMetroNode,
} from '@/app/lib/creationStation/creationTransportSync';
import {
  buildGrooveLabTransportEvents,
  grooveLabOriginBeatFromSlot,
  grooveLabSecPerSlot,
  grooveLabTransportSessionStart,
  refillGrooveLabMetronome,
  refillGrooveLabTransport,
} from '@/app/lib/creationStation/grooveLabTransport';
import type { OrchidPerformanceMode } from '@/app/lib/creationStation/orchidChordEngine';
import {
  armGrooveLabPlayback,
  ensureGrooveLabAudioReady,
  getOrCreateGrooveLabPlaybackBus,
  resetGrooveLabPlaybackBus,
  silenceGrooveLabPlayback,
  withGrooveLabPlaybackSink,
} from '@/app/lib/creationStation/grooveLabAudio';
import { SE2_AUDIO_START_FLOOR_SEC } from '@/app/lib/studio/se2TransportClock';
import { useGrooveLabTransportPump } from '@/app/hooks/useGrooveLabTransportPump';

export type GrooveLabTransportState = 'stopped' | 'playing' | 'paused';

export interface UseGrooveLabTransportOpts {
  getAudioContext?: () => AudioContext;
  isScreenActive?: boolean;
  bpm: number;
  barCount: number;
  quantize: GrooveLabQuantize;
  pxPerCol: number;
  bassHits: GrooveRollHit[];
  chordHits: GrooveRollHit[];
  melodyHits: GrooveRollHit[];
  bassSoundId: GrooveLabBassSoundId;
  melodySoundId: GrooveLabBassSoundId;
  chordVoice: ChordVoiceId;
  chordVolume: number;
  chordsMuted: boolean;
  bassMuted: boolean;
  perfMode: OrchidPerformanceMode;
  metronomeEnabled: boolean;
  playheadElRef: RefObject<HTMLDivElement | null>;
  rollScrollRef?: RefObject<HTMLDivElement | null>;
  onPlayheadSlot?: (slot: number) => void;
}

const GROOVE_PLAYLINE_CENTER_X = 0.5;

export function useGrooveLabTransport(opts: UseGrooveLabTransportOpts) {
  const { stopMetronomeLoop } = useMasterClock();
  const {
    getAudioContext,
    isScreenActive = true,
    bpm,
    barCount,
    quantize,
    pxPerCol,
    bassHits,
    chordHits,
    melodyHits,
    bassSoundId,
    melodySoundId,
    chordVoice,
    chordVolume,
    chordsMuted,
    bassMuted,
    perfMode,
    metronomeEnabled,
    playheadElRef,
    rollScrollRef,
    onPlayheadSlot,
  } = opts;

  const [transportState, setTransportState] = useState<GrooveLabTransportState>('stopped');
  const [playheadSlot, setPlayheadSlot] = useState(0);

  const ctxRef = useRef<AudioContext | null>(null);
  const runningRef = useRef(false);
  const sessionStartRef = useRef(0);
  const originSlotRef = useRef(0);
  const displaySlotRef = useRef(0);
  const seekSlotRef = useRef(0);
  const firedTransportKeysRef = useRef(new Set<string>());
  const grooveRefillCtSnapRef = useRef(0);
  const schedAnchorTimeRef = useRef(0);
  const schedAnchorPerfRef = useRef(0);
  const wapiSegStateRef = useRef<GrooveLabPlaylineWapiSegState>({ ...GROOVE_PLAYLINE_WAPI_SEG_IDLE });
  const startGenRef = useRef(0);
  const bpmRef = useRef(bpm);
  const quantizeRef = useRef(quantize);
  const snapStepRef = useRef(grooveLabSlotsPerCell(quantize));
  const pxPerColRef = useRef(pxPerCol);
  const playlineAnimRef = useRef<Animation | null>(null);
  const playlineRefs: GrooveLabPlaylineWapiRefs = {
    animRef: playlineAnimRef,
    wapiSegStateRef,
  };
  const lastPublishedColRef = useRef(-1);
  const lastScrollColRef = useRef(-1);

  const bassSoundIdRef = useRef(bassSoundId);
  const melodySoundIdRef = useRef(melodySoundId);
  const chordVoiceRef = useRef(chordVoice);
  const chordVolumeRef = useRef(chordVolume);
  const chordsMutedRef = useRef(chordsMuted);
  const bassMutedRef = useRef(bassMuted);
  const perfModeRef = useRef(perfMode);
  const metronomeEnabledRef = useRef(metronomeEnabled);
  const nextMetroKRef = useRef(0);
  const metroClickBuffersRef = useRef<CreationMetronomeClickBuffers | null>(null);
  const scheduledMetroNodesRef = useRef<CreationScheduledMetroNode[]>([]);

  const events = useMemo(
    () => buildGrooveLabTransportEvents(bassHits, chordHits, melodyHits),
    [bassHits, chordHits, melodyHits],
  );
  const eventsRef = useRef(events);
  eventsRef.current = events;

  bpmRef.current = bpm;
  quantizeRef.current = quantize;
  snapStepRef.current = grooveLabSlotsPerCell(quantize);
  pxPerColRef.current = pxPerCol;
  bassSoundIdRef.current = bassSoundId;
  melodySoundIdRef.current = melodySoundId;
  chordVoiceRef.current = chordVoice;
  chordVolumeRef.current = chordVolume;
  chordsMutedRef.current = chordsMuted;
  bassMutedRef.current = bassMuted;
  perfModeRef.current = perfMode;
  metronomeEnabledRef.current = metronomeEnabled;

  const loopSlots = useMemo(() => grooveLabTotalSlots(barCount), [barCount]);
  const loopSlotsRef = useRef(loopSlots);
  loopSlotsRef.current = loopSlots;

  const transportDisabled = events.length === 0 && !metronomeEnabledRef.current;
  const transportNotStopped = transportState !== 'stopped';

  const playlineOpts = useCallback(
    (slotNow: number, play: boolean, immediateCompositorStart?: boolean) => ({
      el: playheadElRef.current,
      slotNow,
      play,
      bpm: bpmRef.current,
      loopSlots: loopSlotsRef.current,
      snapStep: snapStepRef.current,
      pxPerCol: pxPerColRef.current,
      immediateCompositorStart,
    }),
    [playheadElRef],
  );

  /** WAAPI playline — compositor on the click; audio uses real grid slot (Beat Lab / SE2). */
  const launchPlaylineNow = useCallback(
    (slotNow: number, play: boolean, opts?: { immediateCompositorStart?: boolean }) => {
      try {
        launchGrooveLabPlaylineWapi(
          playlineRefs,
          playlineOpts(slotNow, play, opts?.immediateCompositorStart),
        );
      } catch {
        /* playhead node may not be mounted yet */
      }
    },
    [playlineOpts],
  );

  const snapPlaylineStatic = useCallback(
    (slotNow: number) => {
      setGrooveLabPlaylineTransformStatic(playlineOpts(slotNow, false));
    },
    [playlineOpts],
  );

  const scrollFollowSlot = useCallback((slotNow: number) => {
    const scrollEl = rollScrollRef?.current;
    if (!scrollEl) return;
    const col = grooveLabSlotToGlobalCol(slotNow, quantizeRef.current);
    if (col === lastScrollColRef.current) return;
    lastScrollColRef.current = col;
    const colF = col + 0.5 / Math.max(1, snapStepRef.current);
    const px =
      CB_PIANO_METRICS.labelW + grooveLabColFToPx(colF, pxPerColRef.current) - GROOVE_PLAYLINE_CENTER_X;
    const margin = scrollEl.clientWidth * 0.28;
    const left = scrollEl.scrollLeft;
    const right = left + scrollEl.clientWidth;
    if (px < left + margin || px > right - margin) {
      scrollEl.scrollLeft = Math.max(0, px - scrollEl.clientWidth * 0.35);
    }
  }, [rollScrollRef]);

  const scrollFollowRef = useRef(scrollFollowSlot);
  scrollFollowRef.current = scrollFollowSlot;

  const publishSeekSlotRef = useRef<(s: number) => void>(() => {});

  const onFrameRef = useRef<(displaySlot: number) => void>(() => {});
  /** SE2 split: WAAPI scroll; `displaySlotIn` = audio clock (BAR/playhead readouts). */
  onFrameRef.current = (displaySlotIn: number) => {
    const n = loopSlotsRef.current;
    const displaySlot = loopSlotIndex(displaySlotIn, n);
    displaySlotRef.current = displaySlot;

    if (!runningRef.current) return;

    const anim = playlineAnimRef.current;
    let visualSlot = displaySlot;
    if (anim && anim.playState !== 'idle') {
      const animMs = Number(anim.currentTime ?? 0);
      visualSlot = loopSlotIndex(
        grooveLabVisualSlotFromWapi(animMs, wapiSegStateRef.current, displaySlot),
        n,
      );
    }
    scrollFollowRef.current(visualSlot);
    const col = Math.floor(visualSlot / Math.max(1, snapStepRef.current));
    if (col !== lastPublishedColRef.current) {
      lastPublishedColRef.current = col;
      publishSeekSlotRef.current(displaySlot);
    }
  };

  const cancelScheduledMetroNodes = useCallback(() => {
    const list = scheduledMetroNodesRef.current;
    if (list.length === 0) return;
    for (const entry of list.splice(0, list.length)) {
      try {
        entry.src.stop();
      } catch {
        /* already ended */
      }
      try {
        entry.src.disconnect();
        entry.gain.disconnect();
      } catch {
        /* already disconnected */
      }
    }
  }, []);

  const scheduleMetronomeClickAt = useCallback(
    (ctx: AudioContext, idealGridT: number, downbeat: boolean) => {
      if (!metronomeEnabledRef.current) return;
      const buffers = ensureCreationMetronomeClickBuffers(ctx, metroClickBuffersRef.current);
      metroClickBuffersRef.current = buffers;
      const bus = getOrCreateGrooveLabPlaybackBus(ctx);
      scheduleGrooveLabMetronomeClickAt(
        ctx,
        idealGridT,
        downbeat,
        grooveRefillCtSnapRef.current,
        buffers,
        bus,
        scheduledMetroNodesRef.current,
      );
    },
    [],
  );

  const scheduleAhead = useCallback(
    (ctx: AudioContext, ctSnap: number, pumpOpts?: { loopContinuation?: boolean }) => {
      if (!runningRef.current || sessionStartRef.current <= 0) return;
      grooveRefillCtSnapRef.current = ctSnap;
      const evs = eventsRef.current;
      if (evs.length === 0 && !metronomeEnabledRef.current) return;

      const bus = getOrCreateGrooveLabPlaybackBus(ctx);
      withGrooveLabPlaybackSink(bus, () => {
        if (evs.length > 0) {
          refillGrooveLabTransport(ctx, ctSnap, evs, firedTransportKeysRef.current, {
            loopSlots: loopSlotsRef.current,
            secPerSlot: grooveLabSecPerSlot(bpmRef.current),
            sessionStart: sessionStartRef.current,
            seekSlot: originSlotRef.current,
            bpm: bpmRef.current,
            bassSoundId: bassSoundIdRef.current,
            melodySoundId: melodySoundIdRef.current,
            chordVoice: chordVoiceRef.current,
            chordVolume: chordVolumeRef.current,
            chordsMuted: chordsMutedRef.current,
            bassMuted: bassMutedRef.current,
            perfMode: perfModeRef.current,
          });
        }
        refillGrooveLabMetronome(
          ctx,
          ctSnap,
          nextMetroKRef,
          scheduleMetronomeClickAt,
          {
            sessionStart: sessionStartRef.current,
            originSlot: originSlotRef.current,
            bpm: bpmRef.current,
            loopSlots: loopSlotsRef.current,
            beatsPerBar: 4,
            metronomeEnabled: metronomeEnabledRef.current,
          },
          pumpOpts,
        );
      });
    },
    [scheduleMetronomeClickAt],
  );

  const refillRef = useRef(scheduleAhead);
  refillRef.current = scheduleAhead;

  const getOrCreateAudioContext = useCallback(() => {
    const ctx = getAudioContext?.() ?? null;
    if (!ctx) return null;
    ctxRef.current = ctx;
    return ctx;
  }, [getAudioContext]);

  useGrooveLabTransportPump(
    {
      ctxRef,
      runningRef,
      sessionStartRef,
      originSlotRef,
      displaySlotRef,
      bpmRef,
      loopSlotsRef,
      schedAnchorTimeRef,
      schedAnchorPerfRef,
    },
    {
      isScreenActive,
      getOrCreateAudioContext,
      refillRef,
      onFrameRef,
    },
  );

  const stopTransport = useCallback(() => {
    startGenRef.current += 1;
    runningRef.current = false;
    setGrooveLabTransportRunning(false);
    firedTransportKeysRef.current.clear();
    cancelScheduledMetroNodes();
    lastScrollColRef.current = -1;
    const ctx = ctxRef.current ?? getAudioContext?.() ?? null;
    if (ctx) silenceGrooveLabPlayback(ctx);
    setTransportState('stopped');
    cancelGrooveLabPlaylineWapi(playlineRefs, playheadElRef.current);
    snapPlaylineStatic(seekSlotRef.current);
  }, [cancelScheduledMetroNodes, getAudioContext, playheadElRef, snapPlaylineStatic]);

  const publishSeekSlot = useCallback(
    (s: number) => {
      lastPublishedColRef.current = Math.floor(s / Math.max(1, snapStepRef.current));
      setPlayheadSlot(s);
      onPlayheadSlot?.(s);
    },
    [onPlayheadSlot],
  );
  publishSeekSlotRef.current = publishSeekSlot;

  const seekToSlot = useCallback(
    (slot: number) => {
      const n = loopSlotsRef.current;
      const s = loopSlotIndex(Math.floor(slot), n);
      seekSlotRef.current = s;
      originSlotRef.current = s;
      displaySlotRef.current = s;
      lastScrollColRef.current = -1;
      publishSeekSlot(s);

      const ctx = getAudioContext?.();
      if (ctx && transportState === 'playing') {
        silenceGrooveLabPlayback(ctx);
        resetGrooveLabPlaybackBus(ctx);
        armGrooveLabPlayback(ctx);
        const tCapture = grooveLabAudioNow(ctx);
        sessionStartRef.current = grooveLabTransportSessionStart(tCapture, SE2_AUDIO_START_FLOOR_SEC);
        schedAnchorTimeRef.current = tCapture;
        schedAnchorPerfRef.current = performance.now();
        originSlotRef.current = loopSlotIndex(s, loopSlotsRef.current);
        nextMetroKRef.current = Math.ceil(grooveLabOriginBeatFromSlot(s) - 1e-8) - 1;
        firedTransportKeysRef.current.clear();
        cancelScheduledMetroNodes();
        launchPlaylineNow(s, true, { immediateCompositorStart: true });
        seekRunningGrooveLabPlaylineWapi(playlineRefs, s, bpmRef.current, snapStepRef.current);
        scheduleAhead(ctx, tCapture);
      } else {
        snapPlaylineStatic(s);
      }
    },
    [
      cancelScheduledMetroNodes,
      getAudioContext,
      launchPlaylineNow,
      publishSeekSlot,
      scheduleAhead,
      snapPlaylineStatic,
      transportState,
    ],
  );

  const startTransport = useCallback(async () => {
    const evs = buildGrooveLabTransportEvents(bassHits, chordHits, melodyHits);
    eventsRef.current = evs;
    if (evs.length === 0 && !metronomeEnabledRef.current) return;

    const gen = ++startGenRef.current;
    const ctx = await ensureGrooveLabAudioReady(getAudioContext);
    if (!ctx || gen !== startGenRef.current) return;

    const origin = seekSlotRef.current;
    originSlotRef.current = origin;
    displaySlotRef.current = origin;
    setGrooveLabTransportRunning(true);
    stopMetronomeLoop();

    ctxRef.current = ctx;
    silenceGrooveLabPlayback(ctx);
    resetGrooveLabPlaybackBus(ctx);
    armGrooveLabPlayback(ctx);

    const tAnchor = grooveLabAudioNow(ctx);
    sessionStartRef.current = grooveLabTransportSessionStart(tAnchor, SE2_AUDIO_START_FLOOR_SEC);
    schedAnchorTimeRef.current = tAnchor;
    schedAnchorPerfRef.current = performance.now();
    seekSlotRef.current = origin;
    nextMetroKRef.current = Math.ceil(grooveLabOriginBeatFromSlot(origin) - 1e-8) - 1;
    lastPublishedColRef.current = Math.floor(origin / Math.max(1, snapStepRef.current));
    lastScrollColRef.current = -1;
    firedTransportKeysRef.current.clear();
    cancelScheduledMetroNodes();
    runningRef.current = true;

    if (playheadElRef.current) playheadElRef.current.style.opacity = '1';
    launchPlaylineNow(origin, true, { immediateCompositorStart: true });
    refillRef.current(ctx, tAnchor);
    seekRunningGrooveLabPlaylineWapi(
      playlineRefs,
      origin,
      bpmRef.current,
      snapStepRef.current,
    );
    queueMicrotask(() => {
      if (!runningRef.current) return;
      const c = ctxRef.current;
      if (!c || c.state === 'closed') return;
      refillRef.current(c, grooveLabAudioNow(c));
    });

    setTransportState('playing');

    window.setTimeout(() => {
      if (!runningRef.current) return;
      scrollFollowRef.current(origin);
      publishSeekSlot(origin);
    }, 0);
  }, [
    bassHits,
    cancelScheduledMetroNodes,
    chordHits,
    melodyHits,
    getAudioContext,
    launchPlaylineNow,
    playheadElRef,
    publishSeekSlot,
    stopMetronomeLoop,
  ]);

  const pauseTransport = useCallback(() => {
    const ctx = getAudioContext?.();
    if (!ctx || transportState !== 'playing') return;
    updateSchedAnchor(ctx, schedAnchorTimeRef, schedAnchorPerfRef);
    const tNow = smoothSchedNow(schedAnchorTimeRef, schedAnchorPerfRef, ctx);
    const slot = loopSlotIndex(
      slotAtSessionTime(tNow, sessionStartRef.current, originSlotRef.current, bpmRef.current),
      loopSlotsRef.current,
    );
    setGrooveLabTransportRunning(false);
    startGenRef.current += 1;
    runningRef.current = false;
    lastScrollColRef.current = -1;
    firedTransportKeysRef.current.clear();
    cancelScheduledMetroNodes();
    silenceGrooveLabPlayback(ctx);
    resetGrooveLabPlaybackBus(ctx);
    seekSlotRef.current = slot;
    originSlotRef.current = slot;
    displaySlotRef.current = slot;
    publishSeekSlot(slot);
    setTransportState('paused');
    launchPlaylineNow(slot, false);
  }, [cancelScheduledMetroNodes, getAudioContext, launchPlaylineNow, publishSeekSlot, transportState]);

  const togglePlayPause = useCallback(() => {
    if (transportState === 'playing') {
      pauseTransport();
      return;
    }
    if (transportState === 'paused') {
      startTransport();
      return;
    }
    startTransport();
  }, [pauseTransport, startTransport, transportState]);

  const rewind = useCallback(() => {
    const wasPlaying = transportState === 'playing';
    if (wasPlaying) runningRef.current = false;
    seekToSlot(0);
    if (wasPlaying) void startTransport();
  }, [seekToSlot, startTransport, transportState]);

  const fastForward = useCallback(() => {
    const wasPlaying = transportState === 'playing';
    const next = (seekSlotRef.current + GROOVE_LAB_SLOTS_PER_BAR) % loopSlotsRef.current;
    if (wasPlaying) runningRef.current = false;
    seekToSlot(next);
    if (wasPlaying) void startTransport();
  }, [seekToSlot, startTransport, transportState]);

  useEffect(() => {
    if (transportState === 'playing') return;
    firedTransportKeysRef.current.clear();
  }, [events, transportState]);

  /** Tempo/grid changes during playback — resync timeline without a second hit on play. */
  useEffect(() => {
    if (transportState !== 'playing' || !runningRef.current) return;
    const ctx = getAudioContext?.();
    if (!ctx) return;
    silenceGrooveLabPlayback(ctx);
    resetGrooveLabPlaybackBus(ctx);
    armGrooveLabPlayback(ctx);
    const tCapture = grooveLabAudioNow(ctx);
    sessionStartRef.current = grooveLabTransportSessionStart(tCapture, SE2_AUDIO_START_FLOOR_SEC);
    schedAnchorTimeRef.current = tCapture;
    schedAnchorPerfRef.current = performance.now();
    originSlotRef.current = loopSlotIndex(displaySlotRef.current, loopSlotsRef.current);
    nextMetroKRef.current = Math.ceil(grooveLabOriginBeatFromSlot(originSlotRef.current) - 1e-8) - 1;
    firedTransportKeysRef.current.clear();
    cancelScheduledMetroNodes();
    launchPlaylineNow(displaySlotRef.current, true, { immediateCompositorStart: true });
    seekRunningGrooveLabPlaylineWapi(
      playlineRefs,
      displaySlotRef.current,
      bpmRef.current,
      snapStepRef.current,
    );
    scheduleAhead(ctx, tCapture);
  }, [pxPerCol, quantize, bpm, cancelScheduledMetroNodes, getAudioContext, launchPlaylineNow, scheduleAhead]);

  useEffect(() => {
    if (!isScreenActive && transportState !== 'stopped') {
      runningRef.current = false;
      cancelScheduledMetroNodes();
      setTransportState('stopped');
      cancelGrooveLabPlaylineWapi(playlineRefs, playheadElRef.current);
    }
  }, [cancelScheduledMetroNodes, isScreenActive, playheadElRef, transportState]);

  useEffect(() => {
    return () => {
      runningRef.current = false;
      cancelScheduledMetroNodes();
      cancelGrooveLabPlaylineWapi(playlineRefs, playheadElRef.current);
    };
  }, [cancelScheduledMetroNodes, playheadElRef]);

  useEffect(() => {
    if (transportNotStopped) return;
    snapPlaylineStatic(seekSlotRef.current);
  }, [snapPlaylineStatic, transportNotStopped]);

  return {
    transportState,
    playing: transportState === 'playing',
    paused: transportState === 'paused',
    transportNotStopped,
    playheadSlot,
    transportDisabled,
    rewind,
    stop: stopTransport,
    pause: pauseTransport,
    togglePlayPause,
    fastForward,
    seekToSlot,
  };
}
