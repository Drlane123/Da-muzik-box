import { useCallback, useEffect, useRef, useState } from 'react';
import { withProgressionAuditionOutput } from '@/app/lib/creationStation/chordSequencerVoices';
import {
  armGrooveLabPlayback,
  runWithGrooveLabAudio,
  silenceGrooveLabPlayback,
  withGrooveLabPlaybackSink,
  getOrCreateGrooveLabPlaybackBus,
} from '@/app/lib/creationStation/grooveLabAudio';
import type { GrooveProgressionStep } from '@/app/lib/creationStation/grooveLabProgressionBuilder';
import {
  chordMidisForStepLabel,
  progressionTotalBeats,
  scheduleProgressionAudition,
  scheduleSingleStepAudition,
  stepIndexAtElapsedBeats,
  type ProgressionAuditionOpts,
} from '@/app/lib/creationStation/grooveLabProgressionPreview';
import type { ChordVoiceId } from '@/app/lib/creationStation/chordSequencerVoices';
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

  const auditionOpts = useCallback((): ProgressionAuditionOpts => ({
    bpm: opts.bpm,
    chordVoice: opts.chordVoice,
    perfMode: opts.perfMode,
    volume: opts.linkedChordVolume,
  }), [opts.bpm, opts.chordVoice, opts.perfMode, opts.linkedChordVolume]);

  const clearPlaybackPosition = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setActiveStepIndex(null);
  }, []);

  const silenceNow = useCallback(() => {
    if (!opts.getAudioContext) return;
    try {
      silenceGrooveLabPlayback(opts.getAudioContext());
    } catch {
      /* context not ready */
    }
  }, [opts.getAudioContext]);

  const stopPlayback = useCallback(() => {
    sessionRef.current += 1;
    shouldLoopRef.current = false;
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    clearPlaybackPosition();
    silenceNow();
    setPlaying(false);
    setLooping(false);
  }, [clearPlaybackPosition, silenceNow]);

  const startPlaybackPositionTracking = useCallback(
    (
      ctx: AudioContext,
      anchorWhen: number,
      steps: readonly GrooveProgressionStep[],
      sessionId: number,
    ) => {
      clearPlaybackPosition();
      const secPerBeat = 60 / Math.max(40, opts.bpm);
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
    [opts.bpm, clearPlaybackPosition],
  );

  useEffect(() => () => stopPlayback(), [stopPlayback]);

  const startTimelinePlayback = useCallback(
    (steps: readonly GrooveProgressionStep[], loop: boolean) => {
      const playable = playableTimelineSteps(steps);
      if (!opts.getAudioContext || playable.length === 0) return;

      sessionRef.current += 1;
      const sessionId = sessionRef.current;
      shouldLoopRef.current = loop;
      setPlaying(true);
      setLooping(loop);

      const runOnce = () => {
        if (sessionRef.current !== sessionId) return;
        runWithGrooveLabAudio(opts.getAudioContext!, (ctx, when) => {
          if (sessionRef.current !== sessionId) return;
          const bus = getOrCreateGrooveLabPlaybackBus(ctx);
          armGrooveLabPlayback(ctx);
          const durationSec = withGrooveLabPlaybackSink(bus, () =>
            withProgressionAuditionOutput(bus, () =>
              scheduleProgressionAudition(ctx, steps, when, auditionOpts()),
            ),
          );
          startPlaybackPositionTracking(ctx, when, steps, sessionId);
          const ms = Math.max(350, durationSec * 1000 + 100);
          timerRef.current = window.setTimeout(() => {
            if (sessionRef.current !== sessionId) return;
            if (shouldLoopRef.current) {
              runOnce();
            } else {
              sessionRef.current += 1;
              silenceGrooveLabPlayback(ctx);
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
      auditionOpts,
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
    (step: GrooveProgressionStep, options?: { keepTimelineLoop?: boolean }) => {
      if (!opts.getAudioContext || !chordMidisForStepLabel(step.label)) return;
      if (!options?.keepTimelineLoop) stopPlayback();
      runWithGrooveLabAudio(opts.getAudioContext, (ctx, when) => {
        const bus = getOrCreateGrooveLabPlaybackBus(ctx);
        armGrooveLabPlayback(ctx);
        withGrooveLabPlaybackSink(bus, () =>
          withProgressionAuditionOutput(bus, () =>
            scheduleSingleStepAudition(ctx, step, when, auditionOpts()),
          ),
        );
      });
    },
    [opts.getAudioContext, auditionOpts, stopPlayback],
  );

  const playProgressionOnce = useCallback(
    (steps: readonly GrooveProgressionStep[]) => startTimelinePlayback(steps, false),
    [startTimelinePlayback],
  );

  const playProgressionLoop = useCallback(
    (steps: readonly GrooveProgressionStep[]) => startTimelinePlayback(steps, true),
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
    progressionDurationSec,
  };
}
