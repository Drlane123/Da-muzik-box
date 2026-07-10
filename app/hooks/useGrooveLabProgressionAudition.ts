import { useCallback, useEffect, useRef, useState } from 'react';
import { runWithGrooveLabAudio } from '@/app/lib/creationStation/grooveLabAudio';
import { clampGrooveLabBpm } from '@/app/lib/creationStation/grooveLabTempo';
import type { GrooveProgressionStep } from '@/app/lib/creationStation/grooveLabProgressionBuilder';
import {
  chordMidisForStepLabel,
  progressionTotalBeats,
  scheduleProgressionAudition,
  scheduleSingleStepAudition,
  stepIndexAtElapsedBeats,
  type ProgressionAuditionOpts,
} from '@/app/lib/creationStation/grooveLabProgressionPreview';
import {
  haltProgressionAuditionVoices,
  withProgressionAuditionBus,
  type ChordVoiceId,
} from '@/app/lib/creationStation/chordSequencerVoices';
import type { OrchidPerformanceMode } from '@/app/lib/creationStation/orchidChordEngine';

function playableTimelineSteps(steps: readonly GrooveProgressionStep[]): GrooveProgressionStep[] {
  return steps.filter((s) => !s.rest && s.label.trim() && chordMidisForStepLabel(s.label));
}

export function useGrooveLabProgressionAudition(opts: {
  getAudioContext?: () => AudioContext;
  bpm: number;
  chordVoice: ChordVoiceId;
  perfMode: OrchidPerformanceMode;
  linkedChordVolume: number;
}) {
  const [playing, setPlaying] = useState(false);
  const [looping, setLooping] = useState(false);
  /** Index into the steps array last passed to play/loop (null when idle). */
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);
  const sessionRef = useRef(0);
  const shouldLoopRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const bpmRef = useRef(opts.bpm);
  bpmRef.current = opts.bpm;

  const resolveAuditionBpm = useCallback(
    (override?: number) => clampGrooveLabBpm(override ?? bpmRef.current),
    [],
  );

  const buildAuditionOpts = useCallback(
    (bpmOverride?: number, genreId?: string): ProgressionAuditionOpts => ({
      bpm: resolveAuditionBpm(bpmOverride),
      chordVoice: opts.chordVoice,
      perfMode: opts.perfMode,
      volume: opts.linkedChordVolume,
      genreId,
    }),
    [resolveAuditionBpm, opts.chordVoice, opts.perfMode, opts.linkedChordVolume],
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
    haltProgressionAuditionVoices();
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
    haltProgressionAuditionVoices();
    return sessionRef.current;
  }, []);

  /** SE2 transport — kill timers + bus; keep loop armed in the builder UI. */
  const interruptForExternalPlayback = useCallback(() => {
    sessionRef.current += 1;
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    haltProgressionAuditionVoices();
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
          shouldLoopRef.current && totalBeats > 0
            ? elapsedBeats % totalBeats
            : elapsedBeats;
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

  const startTimelinePlayback = useCallback(
    (steps: readonly GrooveProgressionStep[], loop: boolean, bpmOverride?: number, genreId?: string) => {
      const playable = playableTimelineSteps(steps);
      if (!opts.getAudioContext || playable.length === 0) return;

      const sessionId = prepareAuditionPlayback();
      const playBpm = resolveAuditionBpm(bpmOverride);
      shouldLoopRef.current = loop;
      setPlaying(true);
      setLooping(loop);

      const runOnce = () => {
        if (sessionRef.current !== sessionId) return;
        haltProgressionAuditionVoices();
        runWithGrooveLabAudio(opts.getAudioContext!, (ctx, when) => {
          if (sessionRef.current !== sessionId) return;
          const durationSec = withProgressionAuditionBus(ctx, () =>
            scheduleProgressionAudition(ctx, steps, when, buildAuditionOpts(playBpm, genreId)),
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
      opts.getAudioContext,
      buildAuditionOpts,
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
      if (!opts.getAudioContext || !chordMidisForStepLabel(step.label)) return;
      if (!options?.keepTimelineLoop) {
        stopPlayback();
      } else {
        haltProgressionAuditionVoices();
      }
      runWithGrooveLabAudio(opts.getAudioContext, (ctx, when) => {
        withProgressionAuditionBus(ctx, () => {
          scheduleSingleStepAudition(
            ctx,
            step,
            when,
            buildAuditionOpts(options?.auditionBpm, options?.genreId),
          );
        });
      });
    },
    [opts.getAudioContext, buildAuditionOpts, stopPlayback],
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
