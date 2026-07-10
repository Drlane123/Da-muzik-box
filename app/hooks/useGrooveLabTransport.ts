import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { ChordVoiceId } from '@/app/lib/creationStation/chordSequencerVoices';
import type { GrooveLabBassSoundId } from '@/app/lib/creationStation/grooveLabBassSounds';
import type { GrooveLabAnyLeadSoundId } from '@/app/lib/creationStation/grooveLabLeadSounds';
import type { GrooveLabGuitarFxSettings } from '@/app/lib/creationStation/grooveLabGuitarFx';
import {
  restoreChordSequencerTransportVoices,
  haltGrooveLabTransportChordVoices,
  haltProgressionAuditionVoices,
} from '@/app/lib/creationStation/chordSequencerVoices';
import {
  applyGrooveLabChannelVolumes,
  haltGrooveLabTransportGuitarBus,
  haltGrooveLabTransportMelodyBus,
  muteAllGrooveLabChannelBuses,
  restoreGrooveLabTransportGuitarBus,
  restoreGrooveLabTransportMelodyBus,
} from '@/app/lib/creationStation/grooveLabAudio';
import { truncateKickKeyboardVoice } from '@/app/lib/creationStation/eightZeroEightVoice';
import { haltAllGrooveLabLeadVoices } from '@/app/lib/creationStation/grooveLabLeadVoices';
import { haltGrooveLabMelodyLeadVoices } from '@/app/lib/creationStation/grooveLabLeadMono';
import { preloadGuitarLickBank } from '@/app/lib/creationStation/grooveLabGuitarLickBank';
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
import { syncLab808GrooveClockFromGrooveTransport } from '@/app/lib/creationStation/lab808GrooveClock';
import { dispatchGrooveLabBeatlabPlayMirror } from '@/app/lib/creationStation/creationSessionLink';
import { dispatchGrooveLabTransportMirror } from '@/app/lib/creationStation/lab808Sync';
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
import {
  bypassWaveLeafLeadChopGate,
  refillWaveLeafLeadChop,
  resetWaveLeafLeadChopScheduler,
} from '@/app/lib/creationStation/waveLeafLeadChop';
import { haltWaveLeafVoices } from '@/app/lib/creationStation/waveLeafEngine';
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
  guitarHits?: GrooveRollHit[];
  sampleHits?: GrooveRollHit[];
  bassSoundId: GrooveLabBassSoundId;
  melodySoundId: GrooveLabBassSoundId;
  chordVoice: ChordVoiceId;
  chordVolume: number;
  chordsMuted: boolean;
  bassMuted: boolean;
  leadMuted?: boolean;
  perfMode: OrchidPerformanceMode;
  metronomeEnabled: boolean;
  chordChannel?: number;
  melodyChannel?: number;
  guitarChannel?: number;
  sampleChannel?: number;
  orchestraHitId?: string;
  guitarSoundId?: GrooveLabAnyLeadSoundId;
  guitarFxSettings?: GrooveLabGuitarFxSettings;
  channelVolumes?: Record<number, number>;
  playheadElRef: RefObject<HTMLDivElement | null>;
  rollScrollRef?: RefObject<HTMLDivElement | null>;
  onPlayheadSlot?: (slot: number) => void;
  /** When 808 PLAY mirrored Groove in — skip echo dispatch back to 808. */
  skip808OutboundMirrorRef?: RefObject<boolean>;
  /** When Beat Lab PLAY mirrored Groove in — skip echo dispatch back to Beat Lab. */
  skipBeatLabOutboundMirrorRef?: RefObject<boolean>;
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
    guitarHits = [],
    sampleHits = [],
    bassSoundId,
    melodySoundId,
    chordVoice,
    chordVolume,
    chordsMuted,
    bassMuted,
    leadMuted = false,
    perfMode,
    metronomeEnabled,
    chordChannel,
    melodyChannel,
    guitarChannel,
    sampleChannel,
    orchestraHitId,
    guitarSoundId,
    guitarFxSettings,
    channelVolumes,
    playheadElRef,
    rollScrollRef,
    onPlayheadSlot,
    skip808OutboundMirrorRef,
    skipBeatLabOutboundMirrorRef,
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
  const leadMutedRef = useRef(leadMuted);
  const perfModeRef = useRef(perfMode);
  const metronomeEnabledRef = useRef(metronomeEnabled);
  const chordChannelRef = useRef(chordChannel);
  const melodyChannelRef = useRef(melodyChannel);
  const guitarChannelRef = useRef(guitarChannel);
  const sampleChannelRef = useRef(sampleChannel);
  const orchestraHitIdRef = useRef(orchestraHitId);
  const guitarSoundIdRef = useRef(guitarSoundId);
  const guitarFxSettingsRef = useRef(guitarFxSettings);
  const channelVolumesRef = useRef(channelVolumes);
  const nextMetroKRef = useRef(0);
  const nextChopStepRef = useRef(0);
  const metroClickBuffersRef = useRef<CreationMetronomeClickBuffers | null>(null);
  const scheduledMetroNodesRef = useRef<CreationScheduledMetroNode[]>([]);

  const events = useMemo(
    () =>
      buildGrooveLabTransportEvents(
        bassHits,
        chordHits,
        melodyHits,
        quantize,
        guitarHits,
        sampleHits,
      ),
    [bassHits, chordHits, melodyHits, quantize, guitarHits, sampleHits],
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
  leadMutedRef.current = leadMuted;
  perfModeRef.current = perfMode;
  metronomeEnabledRef.current = metronomeEnabled;
  chordChannelRef.current = chordChannel;
  melodyChannelRef.current = melodyChannel;
  guitarChannelRef.current = guitarChannel;
  sampleChannelRef.current = sampleChannel;
  orchestraHitIdRef.current = orchestraHitId;
  guitarSoundIdRef.current = guitarSoundId;
  guitarFxSettingsRef.current = guitarFxSettings;
  channelVolumesRef.current = channelVolumes;

  const loopSlots = useMemo(() => grooveLabTotalSlots(barCount), [barCount]);
  const loopSlotsRef = useRef(loopSlots);
  loopSlotsRef.current = loopSlots;

  const transportDisabled =
    events.length === 0 && guitarHits.length === 0 && !metronomeEnabledRef.current;
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
            leadMuted: leadMutedRef.current,
            perfMode: perfModeRef.current,
            guitarSoundId: guitarSoundIdRef.current,
            guitarFx: guitarFxSettingsRef.current,
            guitarChannel: guitarChannelRef.current,
            chordChannel: chordChannelRef.current,
            melodyChannel: melodyChannelRef.current,
            sampleChannel: sampleChannelRef.current,
            orchestraHitId: orchestraHitIdRef.current,
            channelVolumes: channelVolumesRef.current,
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
        const melodyCh = melodyChannelRef.current;
        if (melodyCh != null && Number.isFinite(melodyCh)) {
          refillWaveLeafLeadChop(ctx, ctSnap, nextChopStepRef, {
            sessionStart: sessionStartRef.current,
            bpm: bpmRef.current,
            melodyChannel: melodyCh,
            loopContinuation: pumpOpts?.loopContinuation,
          });
        }
      });
    },
    [scheduleMetronomeClickAt],
  );

  const refillRef = useRef(scheduleAhead);
  refillRef.current = scheduleAhead;

  const publish808GrooveClock = useCallback(() => {
    if (!runningRef.current || sessionStartRef.current <= 0) {
      syncLab808GrooveClockFromGrooveTransport(null);
      return;
    }
    syncLab808GrooveClockFromGrooveTransport({
      sessionStart: sessionStartRef.current,
      originSlot: originSlotRef.current,
      bpm: bpmRef.current,
      loopSlots: loopSlotsRef.current,
    });
  }, []);

  const mirror808Transport = useCallback((action: 'play' | 'pause' | 'stop') => {
    if (skip808OutboundMirrorRef?.current) {
      skip808OutboundMirrorRef.current = false;
      // Stop must always reach linked 808 — suppress is only for play/pause echo.
      if (action !== 'stop') return;
    }
    dispatchGrooveLabTransportMirror(action);
  }, [skip808OutboundMirrorRef]);

  const mirrorBeatLabTransport = useCallback((action: 'play' | 'pause' | 'stop') => {
    if (skipBeatLabOutboundMirrorRef?.current) {
      skipBeatLabOutboundMirrorRef.current = false;
      if (action !== 'stop') return;
    }
    dispatchGrooveLabBeatlabPlayMirror(action);
  }, [skipBeatLabOutboundMirrorRef]);

  const anchorGrooveSessionAndMirror808 = useCallback((ctx: AudioContext, origin: number) => {
    const tCapture = grooveLabAudioNow(ctx);
    sessionStartRef.current = grooveLabTransportSessionStart(tCapture, SE2_AUDIO_START_FLOOR_SEC);
    originSlotRef.current = origin;
    schedAnchorTimeRef.current = tCapture;
    schedAnchorPerfRef.current = performance.now();
    syncLab808GrooveClockFromGrooveTransport({
      sessionStart: sessionStartRef.current,
      originSlot: originSlotRef.current,
      bpm: bpmRef.current,
      loopSlots: loopSlotsRef.current,
    });
  }, []);

  const haltGrooveLabTransportAudio = useCallback(
    (ctx: AudioContext | null, opts?: { zeroSession?: boolean }) => {
      if (opts?.zeroSession) {
        sessionStartRef.current = 0;
        schedAnchorTimeRef.current = 0;
        schedAnchorPerfRef.current = 0;
      }
      haltGrooveLabTransportChordVoices();
      haltProgressionAuditionVoices();
      haltGrooveLabTransportGuitarBus();
      haltGrooveLabTransportMelodyBus();
      cancelScheduledMetroNodes();
      resetWaveLeafLeadChopScheduler(nextChopStepRef);
      stopMetronomeLoop();
      if (ctx) {
        const t = ctx.currentTime;
        truncateKickKeyboardVoice(ctx, t);
        muteAllGrooveLabChannelBuses(ctx, t);
        haltAllGrooveLabLeadVoices(t);
        haltGrooveLabMelodyLeadVoices(t);
        haltWaveLeafVoices();
        silenceGrooveLabPlayback(ctx);
        resetGrooveLabPlaybackBus(ctx);
        const melodyCh = melodyChannelRef.current;
        if (melodyCh != null && Number.isFinite(melodyCh)) {
          bypassWaveLeafLeadChopGate(ctx, melodyCh);
        }
      }
    },
    [cancelScheduledMetroNodes, stopMetronomeLoop],
  );

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
    setTransportState('stopped');
    syncLab808GrooveClockFromGrooveTransport(null);
    firedTransportKeysRef.current.clear();
    lastScrollColRef.current = -1;
    const ctx = ctxRef.current ?? getAudioContext?.() ?? null;
    haltGrooveLabTransportAudio(ctx, { zeroSession: true });
    wapiSegStateRef.current = { ...GROOVE_PLAYLINE_WAPI_SEG_IDLE };
    launchPlaylineNow(seekSlotRef.current, false);
    mirror808Transport('stop');
    mirrorBeatLabTransport('stop');
  }, [
    getAudioContext,
    haltGrooveLabTransportAudio,
    launchPlaylineNow,
    mirror808Transport,
    mirrorBeatLabTransport,
  ]);

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
        publish808GrooveClock();
        nextMetroKRef.current = Math.ceil(grooveLabOriginBeatFromSlot(s) - 1e-8) - 1;
        resetWaveLeafLeadChopScheduler(nextChopStepRef);
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
      publish808GrooveClock,
    ],
  );

  const startTransport = useCallback(async () => {
    const evs = buildGrooveLabTransportEvents(
      bassHits,
      chordHits,
      melodyHits,
      quantizeRef.current,
      guitarHits,
      sampleHits,
    );
    eventsRef.current = evs;
    if (evs.length === 0 && guitarHits.length === 0 && !metronomeEnabledRef.current) return;

    const gen = ++startGenRef.current;
    const origin = seekSlotRef.current;
    originSlotRef.current = origin;
    displaySlotRef.current = origin;

    // SE2 pattern: capture audio anchor + tell 808 before any await (preload must not delay 808).
    try {
      const earlyCtx = getAudioContext?.() ?? null;
      if (earlyCtx && earlyCtx.state !== 'closed') {
        anchorGrooveSessionAndMirror808(earlyCtx, origin);
      }
    } catch {
      /* ctx not unlocked yet — anchored after ensure below */
    }

    const ctx = await ensureGrooveLabAudioReady(getAudioContext);
    if (!ctx || gen !== startGenRef.current) return;

    if (sessionStartRef.current <= 0) {
      anchorGrooveSessionAndMirror808(ctx, origin);
    }

    restoreChordSequencerTransportVoices();
    restoreGrooveLabTransportGuitarBus();
    restoreGrooveLabTransportMelodyBus();
    applyGrooveLabChannelVolumes(ctx, channelVolumesRef.current);

    if (guitarHits.length > 0) {
      await preloadGuitarLickBank(ctx);
    }
    if (!ctx || gen !== startGenRef.current) return;

    setGrooveLabTransportRunning(true);
    stopMetronomeLoop();

    ctxRef.current = ctx;
    silenceGrooveLabPlayback(ctx);
    resetGrooveLabPlaybackBus(ctx);
    armGrooveLabPlayback(ctx);

    const melodyCh = melodyChannelRef.current;
    if (melodyCh != null && Number.isFinite(melodyCh)) {
      bypassWaveLeafLeadChopGate(ctx, melodyCh);
    }

    const tRefill = grooveLabAudioNow(ctx);
    publish808GrooveClock();
    seekSlotRef.current = origin;
    nextMetroKRef.current = Math.ceil(grooveLabOriginBeatFromSlot(origin) - 1e-8) - 1;
    resetWaveLeafLeadChopScheduler(nextChopStepRef);
    lastPublishedColRef.current = Math.floor(origin / Math.max(1, snapStepRef.current));
    lastScrollColRef.current = -1;
    firedTransportKeysRef.current.clear();
    cancelScheduledMetroNodes();
    if (gen !== startGenRef.current) {
      setGrooveLabTransportRunning(false);
      return;
    }

    runningRef.current = true;

    if (playheadElRef.current) playheadElRef.current.style.opacity = '1';
    launchPlaylineNow(origin, true, { immediateCompositorStart: true });
    refillRef.current(ctx, tRefill);
    seekRunningGrooveLabPlaylineWapi(
      playlineRefs,
      origin,
      bpmRef.current,
      snapStepRef.current,
    );
    queueMicrotask(() => {
      if (!runningRef.current || gen !== startGenRef.current) return;
      const c = ctxRef.current;
      if (!c || c.state === 'closed') return;
      refillRef.current(c, grooveLabAudioNow(c));
    });

    if (gen !== startGenRef.current || !runningRef.current) {
      runningRef.current = false;
      setGrooveLabTransportRunning(false);
      cancelGrooveLabPlaylineWapi(playlineRefs, playheadElRef.current);
      return;
    }

    mirror808Transport('play');
    mirrorBeatLabTransport('play');
    setTransportState('playing');

    window.setTimeout(() => {
      if (!runningRef.current || gen !== startGenRef.current) return;
      scrollFollowRef.current(origin);
      publishSeekSlot(origin);
    }, 0);
  }, [
    bassHits,
    cancelScheduledMetroNodes,
    chordHits,
    guitarHits,
    melodyHits,
    sampleHits,
    getAudioContext,
    launchPlaylineNow,
    mirror808Transport,
    mirrorBeatLabTransport,
    playheadElRef,
    publishSeekSlot,
    stopMetronomeLoop,
    publish808GrooveClock,
    anchorGrooveSessionAndMirror808,
  ]);

  const pauseTransport = useCallback(() => {
    if (transportState !== 'playing') return;
    const ctx = getAudioContext?.() ?? ctxRef.current ?? null;
    let slot = seekSlotRef.current;
    if (ctx && sessionStartRef.current > 0) {
      updateSchedAnchor(ctx, schedAnchorTimeRef, schedAnchorPerfRef);
      const tNow = smoothSchedNow(schedAnchorTimeRef, schedAnchorPerfRef, ctx);
      slot = loopSlotIndex(
        slotAtSessionTime(tNow, sessionStartRef.current, originSlotRef.current, bpmRef.current),
        loopSlotsRef.current,
      );
    }
    startGenRef.current += 1;
    runningRef.current = false;
    setGrooveLabTransportRunning(false);
    syncLab808GrooveClockFromGrooveTransport(null);
    lastScrollColRef.current = -1;
    firedTransportKeysRef.current.clear();
    haltGrooveLabTransportAudio(ctx, { zeroSession: true });
    seekSlotRef.current = slot;
    originSlotRef.current = slot;
    displaySlotRef.current = slot;
    publishSeekSlot(slot);
    setTransportState('paused');
    launchPlaylineNow(slot, false);
    mirror808Transport('pause');
    mirrorBeatLabTransport('pause');
  }, [
    getAudioContext,
    haltGrooveLabTransportAudio,
    launchPlaylineNow,
    mirror808Transport,
    mirrorBeatLabTransport,
    publishSeekSlot,
    transportState,
  ]);

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
    publish808GrooveClock();
    schedAnchorTimeRef.current = tCapture;
    schedAnchorPerfRef.current = performance.now();
    originSlotRef.current = loopSlotIndex(displaySlotRef.current, loopSlotsRef.current);
    nextMetroKRef.current = Math.ceil(grooveLabOriginBeatFromSlot(originSlotRef.current) - 1e-8) - 1;
    resetWaveLeafLeadChopScheduler(nextChopStepRef);
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
  }, [pxPerCol, quantize, bpm, cancelScheduledMetroNodes, getAudioContext, launchPlaylineNow, publish808GrooveClock, scheduleAhead]);

  useEffect(() => {
    if (!isScreenActive && transportState !== 'stopped') {
      startGenRef.current += 1;
      runningRef.current = false;
      setGrooveLabTransportRunning(false);
      syncLab808GrooveClockFromGrooveTransport(null);
      firedTransportKeysRef.current.clear();
      const ctx = ctxRef.current ?? getAudioContext?.() ?? null;
      haltGrooveLabTransportAudio(ctx, { zeroSession: true });
      mirror808Transport('stop');
      mirrorBeatLabTransport('stop');
      setTransportState('stopped');
      cancelGrooveLabPlaylineWapi(playlineRefs, playheadElRef.current);
    }
  }, [
    getAudioContext,
    haltGrooveLabTransportAudio,
    isScreenActive,
    mirror808Transport,
    mirrorBeatLabTransport,
    playheadElRef,
    transportState,
  ]);

  useEffect(() => {
    return () => {
      runningRef.current = false;
      syncLab808GrooveClockFromGrooveTransport(null);
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
