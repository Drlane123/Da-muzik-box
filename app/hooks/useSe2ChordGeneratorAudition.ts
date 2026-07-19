/**
 * SE2 Chord Generator progression audition — follows the lane Instrument dropdown.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { runWithGrooveLabAudio } from '@/app/lib/creationStation/grooveLabAudio';
import { clampGrooveLabBpm } from '@/app/lib/creationStation/grooveLabTempo';
import type { GrooveProgressionStep } from '@/app/lib/creationStation/grooveLabProgressionBuilder';
import {
  chordMidisForStepLabel,
  progressionTotalBeats,
  stepIndexAtElapsedBeats,
} from '@/app/lib/creationStation/grooveLabProgressionPreview';
import {
  haltSe2ChordGeneratorAudition,
  scheduleSe2ChordGeneratorProgression,
  scheduleSe2ChordGeneratorStep,
  se2ChordGeneratorAuditionTrackIndex,
  warmupSe2ChordGeneratorInstrument,
  type Se2ChordGeneratorAuditionOpts,
} from '@/app/lib/studio/se2ChordGeneratorAudition';

function playableTimelineSteps(steps: readonly GrooveProgressionStep[]): GrooveProgressionStep[] {
  return steps.filter((s) => !s.rest && s.label.trim() && chordMidisForStepLabel(s.label));
}

export function useSe2ChordGeneratorAudition(opts: {
  getAudioContext?: () => AudioContext | null | undefined;
  bpm: number;
  midiInstrumentId?: string;
  trackId?: string;
  linkedChordVolume?: number;
}) {
  const [playing, setPlaying] = useState(false);
  const [looping, setLooping] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);
  const sessionRef = useRef(0);
  const shouldLoopRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const bpmRef = useRef(opts.bpm);
  const instrumentRef = useRef(opts.midiInstrumentId);
  const trackIdRef = useRef(opts.trackId);
  const volumeRef = useRef(opts.linkedChordVolume ?? 0.82);
  bpmRef.current = opts.bpm;
  instrumentRef.current = opts.midiInstrumentId;
  trackIdRef.current = opts.trackId;
  volumeRef.current = opts.linkedChordVolume ?? 0.82;

  const resolveAuditionBpm = useCallback(
    (override?: number) => clampGrooveLabBpm(override ?? bpmRef.current),
    [],
  );

  const buildOpts = useCallback(
    (bpmOverride?: number, genreId?: string): Se2ChordGeneratorAuditionOpts => ({
      bpm: resolveAuditionBpm(bpmOverride),
      instrumentId: instrumentRef.current,
      trackIndex: se2ChordGeneratorAuditionTrackIndex(trackIdRef.current),
      volume: volumeRef.current,
      genreId,
      perfMode: 'block',
    }),
    [resolveAuditionBpm],
  );

  const clearPlaybackPosition = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setActiveStepIndex(null);
  }, []);

  const stopPlayback = useCallback(() => {
    sessionRef.current += 1;
    shouldLoopRef.current = false;
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    haltSe2ChordGeneratorAudition();
    clearPlaybackPosition();
    setPlaying(false);
    setLooping(false);
  }, [clearPlaybackPosition]);

  const prepareAuditionPlayback = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    sessionRef.current += 1;
    haltSe2ChordGeneratorAudition();
    return sessionRef.current;
  }, []);

  const interruptForExternalPlayback = useCallback(() => {
    sessionRef.current += 1;
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    haltSe2ChordGeneratorAudition();
    clearPlaybackPosition();
  }, [clearPlaybackPosition]);

  const startPlaybackPositionTracking = useCallback(
    (
      ctx: AudioContext,
      anchorWhen: number,
      steps: readonly GrooveProgressionStep[],
      sessionId: number,
      bpmOverride?: number,
    ) => {
      clearPlaybackPosition();
      const secPerBeat = 60 / Math.max(40, resolveAuditionBpm(bpmOverride));
      const totalBeats = progressionTotalBeats(steps);

      const tick = () => {
        if (sessionRef.current !== sessionId) return;
        const elapsedSec = Math.max(0, ctx.currentTime - anchorWhen);
        const elapsedBeats = elapsedSec / secPerBeat;
        const posBeats =
          shouldLoopRef.current && totalBeats > 0 ? elapsedBeats % totalBeats : elapsedBeats;
        setActiveStepIndex(stepIndexAtElapsedBeats(steps, posBeats));
        if (!shouldLoopRef.current && elapsedBeats >= totalBeats) {
          clearPlaybackPosition();
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      };

      setActiveStepIndex(0);
      rafRef.current = requestAnimationFrame(tick);
    },
    [resolveAuditionBpm, clearPlaybackPosition],
  );

  useEffect(() => () => stopPlayback(), [stopPlayback]);

  useEffect(() => {
    const getCtx = opts.getAudioContext;
    if (!getCtx || !opts.midiInstrumentId) return;
    const ctx = getCtx();
    if (ctx && ctx.state !== 'closed') {
      warmupSe2ChordGeneratorInstrument(ctx, opts.midiInstrumentId);
    }
  }, [opts.getAudioContext, opts.midiInstrumentId]);

  const resolveCtx = useCallback((): (() => AudioContext) | null => {
    const getCtx = opts.getAudioContext;
    if (!getCtx) return null;
    return () => {
      const ctx = getCtx();
      if (!ctx || ctx.state === 'closed') {
        throw new Error('SE2 Chord Generator audition: no AudioContext');
      }
      return ctx;
    };
  }, [opts.getAudioContext]);

  const startTimelinePlayback = useCallback(
    (steps: readonly GrooveProgressionStep[], loop: boolean, bpmOverride?: number, genreId?: string) => {
      const playable = playableTimelineSteps(steps);
      const getCtx = resolveCtx();
      if (!getCtx || playable.length === 0) return;

      const sessionId = prepareAuditionPlayback();
      const playBpm = resolveAuditionBpm(bpmOverride);
      shouldLoopRef.current = loop;
      setPlaying(true);
      setLooping(loop);

      const runOnce = () => {
        if (sessionRef.current !== sessionId) return;
        haltSe2ChordGeneratorAudition();
        runWithGrooveLabAudio(getCtx, (ctx, when) => {
          if (sessionRef.current !== sessionId) return;
          warmupSe2ChordGeneratorInstrument(ctx, instrumentRef.current);
          const durationSec = scheduleSe2ChordGeneratorProgression(
            ctx,
            steps,
            when,
            buildOpts(playBpm, genreId),
          );
          startPlaybackPositionTracking(ctx, when, steps, sessionId, playBpm);
          const ms = Math.max(350, durationSec * 1000 + 100);
          timerRef.current = window.setTimeout(() => {
            if (sessionRef.current !== sessionId) return;
            if (shouldLoopRef.current) {
              runOnce();
            } else {
              sessionRef.current += 1;
              setPlaying(false);
              setLooping(false);
              clearPlaybackPosition();
            }
          }, ms);
        });
      };

      runOnce();
    },
    [
      resolveCtx,
      buildOpts,
      resolveAuditionBpm,
      prepareAuditionPlayback,
      startPlaybackPositionTracking,
      clearPlaybackPosition,
    ],
  );

  const refreshTimelineLoop = useCallback(
    (steps: readonly GrooveProgressionStep[]) => {
      if (!shouldLoopRef.current) return;
      startTimelinePlayback(steps, true);
    },
    [startTimelinePlayback],
  );

  const previewStep = useCallback(
    (
      step: GrooveProgressionStep,
      options?: { keepTimelineLoop?: boolean; auditionBpm?: number; genreId?: string },
    ) => {
      const getCtx = resolveCtx();
      if (!getCtx || !chordMidisForStepLabel(step.label)) return;
      if (!options?.keepTimelineLoop) {
        stopPlayback();
      } else {
        haltSe2ChordGeneratorAudition();
      }
      runWithGrooveLabAudio(getCtx, (ctx, when) => {
        warmupSe2ChordGeneratorInstrument(ctx, instrumentRef.current);
        scheduleSe2ChordGeneratorStep(
          ctx,
          step,
          when,
          buildOpts(options?.auditionBpm, options?.genreId),
        );
      });
    },
    [resolveCtx, buildOpts, stopPlayback],
  );

  const playProgressionOnce = useCallback(
    (steps: readonly GrooveProgressionStep[], bpmOverride?: number, genreId?: string) =>
      startTimelinePlayback(steps, false, bpmOverride, genreId),
    [startTimelinePlayback],
  );

  const playProgressionLoop = useCallback(
    (steps: readonly GrooveProgressionStep[], bpmOverride?: number, genreId?: string) =>
      startTimelinePlayback(steps, true, bpmOverride, genreId),
    [startTimelinePlayback],
  );

  const progressionDurationSec = useCallback(
    (steps: readonly GrooveProgressionStep[]) =>
      (progressionTotalBeats(steps) * 60) / Math.max(40, opts.bpm),
    [opts.bpm],
  );

  return {
    playing,
    looping,
    activeStepIndex,
    previewStep,
    playProgressionOnce,
    playProgressionLoop,
    refreshTimelineLoop,
    stopPlayback,
    interruptForExternalPlayback,
    progressionDurationSec,
  };
}
