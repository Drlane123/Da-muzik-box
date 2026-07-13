'use client';

import { useMasterClock } from '@/app/context/MasterClockContext';
import { createMasteringBayEngine, type MasteringBayEngine } from '@/app/lib/masteringBay/masteringBayEngine';
import {
  idleMultiMeterSnap,
  idleNugenMeterSnap,
  type MultiMeterSnap,
  type NugenMeterSnap,
} from '@/app/lib/masteringBay/masteringBayMeterIdle';
import { shouldPublishMeterSnaps } from '@/app/lib/masteringBay/masteringBayMeterPublish';
import {
  publishMasteringBayMeterSnaps,
  resetMasteringBayMeterStore,
} from '@/app/lib/masteringBay/masteringBayMeterStore';
import type { MasteringBayRackState } from '@/app/lib/masteringBay/masteringBayPresets';
import type { MasteringBaySourcePayload } from '@/app/lib/masteringBay/masteringBaySourceTrack';
import {
  clipEditTimelineSpanSec,
  createClipEditFromBuffer,
  type MasteringBayClipEditState,
} from '@/app/lib/masteringBay/masteringBayClipEdit';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  setMasteringBayScreenActive,
  setMasteringBayTransportRunning,
} from '@/app/lib/creationStation/creationTransportSync';

export type MasteringBayTransport = {
  isPlaying: boolean;
  playheadSec: number;
  onPlay: () => void;
  onStop: () => void;
  onRewind: () => void;
};

const PLAYHEAD_PUSH_MS = 80;
const PLAYHEAD_EPS_SEC = 0.04;
/** VU / analyzer UI refresh — ~45 Hz keeps needles smooth without thrashing React. */
const METER_UI_MS = 22;

function cloneMultiSnap(src: MultiMeterSnap): MultiMeterSnap {
  return { ...src, bands: src.bands.slice() };
}

function cloneNugenSnap(src: NugenMeterSnap): NugenMeterSnap {
  return {
    ...src,
    l: { ...src.l },
    r: { ...src.r },
    source: { ...src.source },
    target: { ...src.target },
    history: src.history.slice(),
    tpHistory: src.tpHistory.slice(),
    histogram: src.histogram.slice(),
  };
}

export function useMasteringBayEngine(rackState: MasteringBayRackState) {
  const { getOrCreateAudioContext } = useMasterClock();
  const engineRef = useRef<MasteringBayEngine | null>(null);
  const rackStateRef = useRef(rackState);
  const playheadSecRef = useRef(0);
  const isScrubbingRef = useRef(false);
  const durationRef = useRef(0);
  const wasPlayingRef = useRef(false);
  const lastMultiRef = useRef<MultiMeterSnap | null>(null);
  const lastNugenRef = useRef<NugenMeterSnap | null>(null);
  const lastFrameMsRef = useRef(performance.now());
  const lastMeterUiMsRef = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadSec, setPlayheadSec] = useState(0);

  rackStateRef.current = rackState;

  useEffect(() => {
    setMasteringBayScreenActive(true);
    return () => {
      setMasteringBayScreenActive(false);
      setMasteringBayTransportRunning(false);
      resetMasteringBayMeterStore();
    };
  }, []);

  const setPlayhead = useCallback((sec: number) => {
    const dur = durationRef.current;
    const clamped = dur > 0 ? Math.max(0, Math.min(dur, sec)) : Math.max(0, sec);
    playheadSecRef.current = clamped;
    setPlayheadSec(clamped);
    engineRef.current?.seek(clamped);
  }, []);

  const ensureEngine = useCallback(() => {
    const ctx = getOrCreateAudioContext();
    if (!engineRef.current) {
      engineRef.current = createMasteringBayEngine(ctx);
    }
    engineRef.current.setRackState(rackStateRef.current);
    return engineRef.current;
  }, [getOrCreateAudioContext]);

  /** Do not build the audio graph on first paint — wait for load / play. */
  useEffect(() => {
    engineRef.current?.setRackState(rackState);
  }, [rackState]);

  /** Keep AudioContext alive once the bay is open — meters resume when context unsuspends. */
  useEffect(() => {
    const ctx = getOrCreateAudioContext();
    const resumeIfNeeded = () => {
      if (ctx.state === 'suspended') void ctx.resume();
    };
    ctx.addEventListener('statechange', resumeIfNeeded);
    const onVisible = () => {
      if (document.visibilityState === 'visible') resumeIfNeeded();
    };
    document.addEventListener('visibilitychange', onVisible);
    resumeIfNeeded();
    return () => {
      ctx.removeEventListener('statechange', resumeIfNeeded);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [getOrCreateAudioContext]);

  useEffect(() => {
    let raf = 0;
    let lastPlayheadPush = 0;

    const publishToStore = (eng: MasteringBayEngine, force: boolean) => {
      const nextMulti = eng.getMultiSnap();
      const nextNugen = eng.getNugenSnap();
      if (
        !force &&
        !shouldPublishMeterSnaps(lastMultiRef.current, nextMulti, lastNugenRef.current, nextNugen)
      ) {
        return;
      }
      const multi = cloneMultiSnap(nextMulti);
      const nugen = cloneNugenSnap(nextNugen);
      lastMultiRef.current = multi;
      lastNugenRef.current = nugen;
      publishMasteringBayMeterSnaps(multi, nugen);
    };

    const tick = (now: number) => {
      const eng = engineRef.current;
      if (eng) {
        const dtMs = Math.max(1, Math.min(50, now - lastFrameMsRef.current));
        lastFrameMsRef.current = now;

        eng.tickMeters(dtMs);

        const playing = eng.isPlaying();
        if (playing !== wasPlayingRef.current) {
          wasPlayingRef.current = playing;
          setIsPlaying(playing);
          if (!playing) {
            setMasteringBayTransportRunning(false);
            const t = eng.getPlayheadSec();
            playheadSecRef.current = t;
            setPlayheadSec(t);
          }
        }

        const dueUi = now - lastMeterUiMsRef.current >= METER_UI_MS;
        if (dueUi) {
          lastMeterUiMsRef.current = now;
          // While playing always push; while idle only if needles moved.
          publishToStore(eng, playing);
        }

        if (playing && !isScrubbingRef.current) {
          const t = eng.getPlayheadSec();
          playheadSecRef.current = t;
          if (now - lastPlayheadPush >= PLAYHEAD_PUSH_MS) {
            lastPlayheadPush = now;
            setPlayheadSec((prev) => (Math.abs(prev - t) >= PLAYHEAD_EPS_SEC ? t : prev));
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const syncClipEdit = useCallback((edit: MasteringBayClipEditState, activeClipId: string | null = null) => {
    const eng = ensureEngine();
    eng.setClipTimeline(edit.clips, activeClipId);
    durationRef.current = Math.max(
      clipEditTimelineSpanSec(edit),
      eng.getTimelineDurationSec(),
    );
  }, [ensureEngine]);

  const onSourceLoaded = useCallback(
    async (payload: MasteringBaySourcePayload) => {
      const eng = ensureEngine();
      const ctx = getOrCreateAudioContext();
      if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
      eng.resetMeters();
      eng.setSourceBuffer(payload.buffer);
      const edit = createClipEditFromBuffer(payload.buffer);
      syncClipEdit(edit, edit.clips[0]?.id ?? null);
      durationRef.current = clipEditTimelineSpanSec(edit);
      lastMultiRef.current = null;
      lastNugenRef.current = null;
      lastFrameMsRef.current = performance.now();
      lastMeterUiMsRef.current = 0;
      resetMasteringBayMeterStore();
      setPlayhead(0);
      setIsPlaying(false);
      setMasteringBayTransportRunning(false);
    },
    [ensureEngine, getOrCreateAudioContext, setPlayhead, syncClipEdit],
  );

  const onSourceCleared = useCallback(() => {
    const eng = engineRef.current;
    if (eng) {
      eng.stop();
      eng.setSourceBuffer(null);
      eng.resetMeters();
    }
    durationRef.current = 0;
    lastMultiRef.current = null;
    lastNugenRef.current = null;
    setPlayhead(0);
    setIsPlaying(false);
    setMasteringBayTransportRunning(false);
    resetMasteringBayMeterStore();
  }, [setPlayhead]);

  const onPlay = useCallback(async () => {
    const eng = ensureEngine();
    const ctx = getOrCreateAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    setMasteringBayTransportRunning(true);
    const offset = playheadSecRef.current;
    eng.play(offset);
    lastFrameMsRef.current = performance.now();
    lastMeterUiMsRef.current = 0;
    setIsPlaying(true);
    wasPlayingRef.current = true;
  }, [ensureEngine, getOrCreateAudioContext]);

  const onStop = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    const t = eng.stop();
    setMasteringBayTransportRunning(false);
    wasPlayingRef.current = false;
    setPlayhead(t);
    setIsPlaying(false);
  }, [setPlayhead]);

  const onSeek = useCallback(
    (sec: number) => {
      if (engineRef.current?.isPlaying()) onStop();
      setPlayhead(sec);
    },
    [onStop, setPlayhead],
  );

  const onRewind = useCallback(() => {
    if (engineRef.current?.isPlaying()) onStop();
    setPlayhead(0);
  }, [onStop, setPlayhead]);

  const onResetMeters = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.resetMeters();
    lastMultiRef.current = null;
    lastNugenRef.current = null;
    resetMasteringBayMeterStore();
  }, []);

  const onScrubActive = useCallback(
    (active: boolean) => {
      isScrubbingRef.current = active;
      if (active && engineRef.current?.isPlaying()) onStop();
    },
    [onStop],
  );

  useEffect(
    () => () => {
      setMasteringBayTransportRunning(false);
      setMasteringBayScreenActive(false);
      resetMasteringBayMeterStore();
      engineRef.current?.dispose();
      engineRef.current = null;
    },
    [],
  );

  const transport = useMemo<MasteringBayTransport>(
    () => ({
      isPlaying,
      playheadSec,
      onPlay,
      onStop,
      onRewind,
    }),
    [isPlaying, playheadSec, onPlay, onStop, onRewind],
  );

  return {
    transport,
    onSourceLoaded,
    onSourceCleared,
    onSeek,
    onScrubActive,
    syncClipEdit,
    onResetMeters,
  };
}
