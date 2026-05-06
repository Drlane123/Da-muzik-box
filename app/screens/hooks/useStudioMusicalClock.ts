/**
 * Studio Editor — simple recording-grid clock.
 *
 * While transport runs, phase uses `getStudioTransportSyncSnapshotAtAudioNow(t).tickFloat / PPQ`
 * (same grid as MET, cyan playhead ingest, and Studio clip `getGridBeatFloat`).
 * Subscribes to {@link subscribeTransportBeatUi} so grid/clip beat memos advance every RAF
 * (same cadence as `publishTransportBeatUi` / metronome lookahead) — `positionTicks` alone can stay
 * frozen in Studio perf playback mode while audio still runs.
 */
import {
  useMemo,
  useCallback,
  useRef,
  useSyncExternalStore,
  type MutableRefObject,
} from 'react';
import type {
  StudioTransportSyncSnapshot,
  TimeSigEvent,
  TransportBeatUiSnapshot,
  TransportState,
} from '@/app/context/MasterClockContext';
import { formatBbtFromFloatTick, formatPositionClock } from '@/app/lib/studioDawClockDisplay';
import { readStudioTransportPhaseForEngine } from '@/app/lib/studio/studioTransportHub';

export type UseStudioMusicalClockArgs = {
  positionTicks: number;
  songTotalBars: number;
  ticksPerBar: number;
  ticksToSeconds: (tick: number) => number;
  timeSigs: TimeSigEvent[];
  transport: TransportState;
  getTransportBeatUiSnapshot: () => TransportBeatUiSnapshot;
  /** MasterClock RAF beat store — bumps every `publishTransportVisualFrameAtAudioNow` while transport runs. */
  subscribeTransportBeatUi: (onStoreChange: () => void) => () => void;
  getStudioTransportSyncSnapshot: () => StudioTransportSyncSnapshot;
  /** Same snapshot as master `emitTransportAudioFrame` / shared playhead ingest when available. */
  getStudioTransportSyncSnapshotAtAudioNow: (
    audioNowSec: number,
  ) => StudioTransportSyncSnapshot;
  /** Same instant as `startTimer` / `isRunningRef` — React `transport` can lag one commit behind audio. */
  getIsAudioTransportRunning: () => boolean;
  audioCtxRef: MutableRefObject<AudioContext | null>;
  isStudioPrecounting: boolean;
  studioPrecountBeat: number | null;
  studioPrecountTimelineRef: MutableRefObject<{
    playheadTick: number;
    totalBeats: number;
  } | null>;
  PPQ: number;
};

/** Stable shape for `StudioEditorScreen` + playhead children (drop-in vs legacy hook). */
export type StudioMusicalClock = {
  transportBeatFloatForClips: number;
  runningGridBeatFloat: number;
  studioPlayheadQuarterIdx0: number;
  effectiveRulerQuarterIdx0: number;
  studioLineBeatForPixel: number;
  studioPlayheadTickFloatForTiming: number;
  studioTimingReadout: { bbt: string; time: string };
  getStudioTransportBeatFloat: () => number;
  studioTransportReadRef: MutableRefObject<{ getGridBeatFloat: () => number }>;
};

function precountBeatFloat(
  timeline: { playheadTick: number; totalBeats: number } | null,
  beat1Based: number | null,
  ppq: number,
): number | null {
  if (!timeline || beat1Based == null) return null;
  return timeline.playheadTick / ppq - (timeline.totalBeats - (beat1Based - 1));
}

export function useStudioMusicalClock(args: UseStudioMusicalClockArgs): StudioMusicalClock {
  const {
    positionTicks,
    songTotalBars,
    ticksPerBar,
    ticksToSeconds,
    timeSigs,
    transport,
    getTransportBeatUiSnapshot,
    subscribeTransportBeatUi,
    getStudioTransportSyncSnapshot,
    getStudioTransportSyncSnapshotAtAudioNow,
    getIsAudioTransportRunning,
    audioCtxRef,
    isStudioPrecounting,
    studioPrecountBeat,
    studioPrecountTimelineRef,
    PPQ,
  } = args;

  const isTransportRunning = transport === 'playing' || transport === 'recording';
  /** `counting` = master count-in bars — still use live audio phase for clips / readouts. */
  const liveClockRunning =
    isTransportRunning ||
    transport === 'counting' ||
    getIsAudioTransportRunning();
  const lastRunningBeatRef = useRef(0);

  const beatUiFrameSeq = useSyncExternalStore(
    subscribeTransportBeatUi,
    () => getTransportBeatUiSnapshot().frameSeq,
    () => 0,
  );

  const readTransportSnapshot = useCallback((): StudioTransportSyncSnapshot => {
    return readStudioTransportPhaseForEngine({
      getAtAudioNow: getStudioTransportSyncSnapshotAtAudioNow,
      getIdle: getStudioTransportSyncSnapshot,
      audioCtx: audioCtxRef.current,
    });
  }, [
    audioCtxRef,
    getStudioTransportSyncSnapshot,
    getStudioTransportSyncSnapshotAtAudioNow,
  ]);

  const readStudioBeatFloat = useCallback((): number => {
    if (liveClockRunning) {
      const snap = readTransportSnapshot();
      if (Number.isFinite(snap.displayTickFloat) && snap.displayTickFloat >= 0) {
        const b = Math.max(0, snap.displayTickFloat / PPQ);
        lastRunningBeatRef.current = b;
        return b;
      }
      if (Number.isFinite(snap.displayBeatFloatGrid)) {
        const b = Math.max(0, snap.displayBeatFloatGrid);
        lastRunningBeatRef.current = b;
        return b;
      }
      if (Number.isFinite(snap.beatFloat)) {
        const b = Math.max(0, snap.beatFloat);
        lastRunningBeatRef.current = b;
        return b;
      }
      if (
        Number.isFinite(snap.audioNowSec) &&
        Number.isFinite(snap.startAudioTimeSec) &&
        Number.isFinite(snap.originBeatFloat) &&
        Number.isFinite(snap.bpm)
      ) {
        const derived =
          Math.max(0, snap.originBeatFloat) +
          Math.max(0, snap.audioNowSec - snap.startAudioTimeSec) *
            (Math.max(1, snap.bpm) / 60);
        lastRunningBeatRef.current = derived;
        return derived;
      }
      return lastRunningBeatRef.current;
    }
    const idleSnap = getStudioTransportSyncSnapshot();
    let out: number;
    if (idleSnap.running && Number.isFinite(idleSnap.beatFloat)) {
      out = Math.max(0, idleSnap.beatFloat);
    } else {
      const published = getTransportBeatUiSnapshot();
      if (
        published.frameSeq > 0 &&
        Number.isFinite(published.studioTimelineBeatFloat)
      ) {
        out = Math.max(0, published.studioTimelineBeatFloat);
      } else {
        out = Math.max(0, idleSnap.beatFloat);
      }
    }
    /* Sync after pause/stop/seek so the next play() does not clamp with a stale high-water mark. */
    lastRunningBeatRef.current = out;
    return out;
  }, [
    getTransportBeatUiSnapshot,
    getStudioTransportSyncSnapshot,
    readTransportSnapshot,
    liveClockRunning,
  ]);

  const transportBeatFloatForClips = useMemo(() => {
    if (isStudioPrecounting) {
      return Math.max(
        0,
        precountBeatFloat(
          studioPrecountTimelineRef.current,
          studioPrecountBeat,
          PPQ,
        ) ?? 0,
      );
    }
    if (liveClockRunning) return readStudioBeatFloat();
    return Math.max(0, positionTicks / PPQ);
  }, [
    isStudioPrecounting,
    studioPrecountBeat,
    liveClockRunning,
    positionTicks,
    readStudioBeatFloat,
    studioPrecountTimelineRef,
    PPQ,
    beatUiFrameSeq,
  ]);

  const runningGridBeatFloat = useMemo(
    () =>
      liveClockRunning
        ? readStudioBeatFloat()
        : Math.max(0, positionTicks / PPQ),
    [
      liveClockRunning,
      positionTicks,
      readStudioBeatFloat,
      PPQ,
      beatUiFrameSeq,
    ],
  );

  const studioPlayheadQuarterIdx0 = useMemo(() => {
    if (isStudioPrecounting && studioPrecountTimelineRef.current) {
      const pre = precountBeatFloat(
        studioPrecountTimelineRef.current,
        studioPrecountBeat ?? 1,
        PPQ,
      );
      return Math.max(0, Math.floor((pre ?? 0) + 1e-9));
    }
    if (liveClockRunning) {
      return Math.max(
        0,
        Math.floor(readStudioBeatFloat() + 1e-9),
      );
    }
    return Math.floor(Math.max(0, positionTicks / PPQ) + 1e-9);
  }, [
    isStudioPrecounting,
    studioPrecountBeat,
    liveClockRunning,
    positionTicks,
    readStudioBeatFloat,
    studioPrecountTimelineRef,
    PPQ,
    beatUiFrameSeq,
  ]);

  const studioLineBeatForPixel = useMemo(() => {
    if (isStudioPrecounting && studioPrecountTimelineRef.current) {
      const pre = precountBeatFloat(
        studioPrecountTimelineRef.current,
        studioPrecountBeat ?? 1,
        PPQ,
      );
      return Math.max(0, pre ?? 0);
    }
    if (liveClockRunning) return Math.max(0, readStudioBeatFloat());
    return Math.max(0, positionTicks / PPQ);
  }, [
    isStudioPrecounting,
    studioPrecountBeat,
    liveClockRunning,
    readStudioBeatFloat,
    positionTicks,
    studioPrecountTimelineRef,
    PPQ,
    beatUiFrameSeq,
  ]);

  const readPlayheadGridBeatFloat = useCallback((): number => {
    if (liveClockRunning) return readStudioBeatFloat();
    if (isStudioPrecounting && studioPrecountTimelineRef.current) {
      return Math.max(
        0,
        precountBeatFloat(
          studioPrecountTimelineRef.current,
          studioPrecountBeat,
          PPQ,
        ) ?? 0,
      );
    }
    return Math.max(0, positionTicks / PPQ);
  }, [
    PPQ,
    liveClockRunning,
    readStudioBeatFloat,
    isStudioPrecounting,
    studioPrecountBeat,
    positionTicks,
    studioPrecountTimelineRef,
  ]);

  const studioTransportReadRef = useRef({ getGridBeatFloat: (): number => 0 });
  studioTransportReadRef.current.getGridBeatFloat = readPlayheadGridBeatFloat;

  const studioPlayheadTickFloatForTiming = useMemo(
    () => Math.max(0, transportBeatFloatForClips * PPQ),
    [transportBeatFloatForClips, PPQ],
  );

  const studioTimingReadout = useMemo(() => {
    const maxTick = Math.max(0, Math.round(songTotalBars * ticksPerBar));
    const tickForSec = Math.max(
      0,
      Math.min(maxTick, Math.round(studioPlayheadTickFloatForTiming)),
    );
    const sec = ticksToSeconds(tickForSec);
    return {
      bbt: formatBbtFromFloatTick(studioPlayheadTickFloatForTiming, timeSigs),
      time: formatPositionClock(sec),
    };
  }, [
    studioPlayheadTickFloatForTiming,
    ticksToSeconds,
    timeSigs,
    songTotalBars,
    ticksPerBar,
  ]);

  return {
    transportBeatFloatForClips,
    runningGridBeatFloat,
    studioPlayheadQuarterIdx0,
    effectiveRulerQuarterIdx0: studioPlayheadQuarterIdx0,
    studioLineBeatForPixel,
    studioPlayheadTickFloatForTiming,
    studioTimingReadout,
    getStudioTransportBeatFloat: readPlayheadGridBeatFloat,
    studioTransportReadRef,
  };
}
