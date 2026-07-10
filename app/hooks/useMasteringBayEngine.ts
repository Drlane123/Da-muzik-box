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
import type { MasteringBayRackState } from '@/app/lib/masteringBay/masteringBayPresets';
import type { MasteringBaySourcePayload } from '@/app/lib/masteringBay/masteringBaySourceTrack';
import {
  clipEditTimelineSpanSec,
  createClipEditFromBuffer,
  type MasteringBayClipEditState,
} from '@/app/lib/masteringBay/masteringBayClipEdit';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type MasteringBayTransport = {
  isPlaying: boolean;
  playheadSec: number;
  onPlay: () => void;
  onStop: () => void;
  onRewind: () => void;
};

const PLAYHEAD_PUSH_MS = 80;
const PLAYHEAD_EPS_SEC = 0.04;

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
  const [multiSnap, setMultiSnap] = useState<MultiMeterSnap>(() => idleMultiMeterSnap());
  const [nugenSnap, setNugenSnap] = useState<NugenMeterSnap>(() => idleNugenMeterSnap());
  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadSec, setPlayheadSec] = useState(0);

  rackStateRef.current = rackState;

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

  useEffect(() => {
    ensureEngine();
  }, [ensureEngine]);

  useEffect(() => {
    engineRef.current?.setRackState(rackState);
  }, [rackState]);

  /** Keep AudioContext alive — meters resume when context unsuspends. */
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

    const publishSnaps = (eng: MasteringBayEngine) => {
      const nextMulti = eng.getMultiSnap();
      const nextNugen = eng.getNugenSnap();
      const playingNow = eng.isPlaying();
      if (
        playingNow ||
        shouldPublishMeterSnaps(lastMultiRef.current, nextMulti, lastNugenRef.current, nextNugen)
      ) {
        lastMultiRef.current = nextMulti;
        lastNugenRef.current = nextNugen;
        setMultiSnap({ ...nextMulti, bands: [...nextMulti.bands] });
        setNugenSnap({
          ...nextNugen,
          l: { ...nextNugen.l },
          r: { ...nextNugen.r },
          source: { ...nextNugen.source },
          target: { ...nextNugen.target },
          history: [...nextNugen.history],
          tpHistory: [...nextNugen.tpHistory],
          histogram: [...nextNugen.histogram],
        });
      }
    };

    const tick = (now: number) => {
      const eng = engineRef.current;
      if (eng) {
        const dtMs = Math.max(1, Math.min(50, now - lastFrameMsRef.current));
        lastFrameMsRef.current = now;

        eng.tickMeters(dtMs);
        publishSnaps(eng);

        const playing = eng.isPlaying();
        if (playing && !isScrubbingRef.current) {
          const t = eng.getPlayheadSec();
          playheadSecRef.current = t;
          if (now - lastPlayheadPush >= PLAYHEAD_PUSH_MS) {
            lastPlayheadPush = now;
            setPlayheadSec((prev) => (Math.abs(prev - t) >= PLAYHEAD_EPS_SEC ? t : prev));
          }
          wasPlayingRef.current = true;
          setIsPlaying(true);
        } else if (playing && isScrubbingRef.current) {
          wasPlayingRef.current = true;
          setIsPlaying(true);
        } else {
          if (wasPlayingRef.current) {
            wasPlayingRef.current = false;
            const t = eng.getPlayheadSec();
            playheadSecRef.current = t;
            setPlayheadSec(t);
          }
          setIsPlaying(false);
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
    (payload: MasteringBaySourcePayload) => {
      const eng = ensureEngine();
      eng.resetMeters();
      eng.setSourceBuffer(payload.buffer);
      const edit = createClipEditFromBuffer(payload.buffer);
      syncClipEdit(edit, edit.clips[0]?.id ?? null);
      durationRef.current = clipEditTimelineSpanSec(edit);
      lastMultiRef.current = null;
      lastNugenRef.current = null;
      lastFrameMsRef.current = performance.now();
      setPlayhead(0);
      setIsPlaying(false);
    },
    [ensureEngine, setPlayhead, syncClipEdit],
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
    setMultiSnap(idleMultiMeterSnap());
    setNugenSnap(idleNugenMeterSnap());
  }, [setPlayhead]);

  const onPlay = useCallback(async () => {
    const eng = ensureEngine();
    const ctx = getOrCreateAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    const offset = playheadSecRef.current;
    eng.play(offset);
    lastFrameMsRef.current = performance.now();
    setIsPlaying(true);
  }, [ensureEngine, getOrCreateAudioContext]);

  const onStop = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    const t = eng.stop();
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
    setMultiSnap(idleMultiMeterSnap());
    setNugenSnap(idleNugenMeterSnap());
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
    multiSnap,
    nugenSnap,
    transport,
    onSourceLoaded,
    onSourceCleared,
    onSeek,
    onScrubActive,
    syncClipEdit,
    onResetMeters,
  };
}
