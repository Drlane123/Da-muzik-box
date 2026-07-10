import { useCallback, useEffect, useRef, useState } from 'react';
import { clampGrooveLabBpm } from '@/app/lib/creationStation/grooveLabTempo';
import type { ProgressionAuditionOpts } from '@/app/lib/creationStation/grooveLabProgressionPreview';
import {
  haltProgressionAuditionVoices,
  withProgressionAuditionBus,
  type ChordVoiceId,
} from '@/app/lib/creationStation/chordSequencerVoices';
import type { OrchidPerformanceMode } from '@/app/lib/creationStation/orchidChordEngine';
import {
  genoLoopRollBeatAtElapsed,
  genoLoopRollTotalBeats,
  scheduleGenoLoopRollAudition,
} from '@/app/lib/studio/genoLoopRollAudition';
import type { GenoLoopPianoRollNote } from '@/app/lib/studio/se2SynthGenoLoopPianoRoll';

type RollNotePick = Pick<GenoLoopPianoRollNote, 'pitch' | 'startBeat' | 'durationBeats' | 'velocity'>;

export function useGenoLoopRollPreview(opts: {
  getAudioContext?: () => AudioContext | null;
  bpm: number;
  beatsPerBar: number;
  barCount: number;
  chordVoice?: ChordVoiceId;
  perfMode?: OrchidPerformanceMode;
  volume?: number;
  genreId?: string;
  loop?: boolean;
}) {
  const [playheadBeat, setPlayheadBeat] = useState(0);
  const [playing, setPlaying] = useState(false);
  const sessionRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const loopRef = useRef(opts.loop ?? true);
  loopRef.current = opts.loop ?? true;

  const clearTimers = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    sessionRef.current += 1;
    clearTimers();
    haltProgressionAuditionVoices();
    setPlaying(false);
  }, [clearTimers]);

  useEffect(() => () => stop(), [stop]);

  const buildAuditionOpts = useCallback(
    (): ProgressionAuditionOpts => ({
      bpm: clampGrooveLabBpm(opts.bpm),
      chordVoice: opts.chordVoice ?? 'grand',
      perfMode: opts.perfMode ?? 'block',
      volume: opts.volume ?? 0.82,
      genreId: opts.genreId,
    }),
    [opts.bpm, opts.chordVoice, opts.genreId, opts.perfMode, opts.volume],
  );

  const play = useCallback(
    (notes: readonly RollNotePick[], fromBeat?: number) => {
      if (!opts.getAudioContext || notes.length === 0) return;
      const totalBeats = genoLoopRollTotalBeats(opts.barCount, opts.beatsPerBar);
      const initialBeat = Math.max(0, Math.min(totalBeats, fromBeat ?? playheadBeat));
      const getCtx = opts.getAudioContext;
      if (!getCtx) return;
      const sessionId = (sessionRef.current += 1);
      clearTimers();
      haltProgressionAuditionVoices();
      setPlaying(true);

      const runSegment = (segmentStartBeat: number, isLoopWrap: boolean) => {
        if (sessionRef.current !== sessionId) return;
        const ctx = getCtx();
        if (!ctx) {
          setPlaying(false);
          return;
        }
        const when = Math.max(ctx.currentTime, 0) + 0.02;
        const auditionOpts = buildAuditionOpts();
        const secPerBeat = 60 / Math.max(40, auditionOpts.bpm);
        const durationSec = withProgressionAuditionBus(ctx, () =>
          scheduleGenoLoopRollAudition(
            ctx,
            notes,
            when,
            segmentStartBeat,
            totalBeats,
            auditionOpts,
          ),
        );

          const tick = () => {
            if (sessionRef.current !== sessionId) return;
            const elapsedBeats = Math.max(0, ctx.currentTime - when) / secPerBeat;
            const beat = genoLoopRollBeatAtElapsed(
              segmentStartBeat,
              elapsedBeats,
              totalBeats,
              loopRef.current && isLoopWrap,
            );
            setPlayheadBeat(beat);
            if (!loopRef.current && segmentStartBeat + elapsedBeats >= totalBeats - 1e-6) {
              setPlaying(false);
              return;
            }
            rafRef.current = requestAnimationFrame(tick);
          };
          rafRef.current = requestAnimationFrame(tick);

          const ms = Math.max(350, durationSec * 1000 + 120);
          timerRef.current = window.setTimeout(() => {
            if (sessionRef.current !== sessionId) return;
            if (loopRef.current) {
              setPlayheadBeat(0);
              runSegment(0, true);
            } else {
              sessionRef.current += 1;
              clearTimers();
              setPlaying(false);
            }
          }, ms);
      };

      setPlayheadBeat(initialBeat);
      runSegment(initialBeat, false);
    },
    [
      buildAuditionOpts,
      clearTimers,
      opts.barCount,
      opts.beatsPerBar,
      opts.getAudioContext,
      playheadBeat,
    ],
  );

  return {
    playheadBeat,
    setPlayheadBeat,
    playing,
    play,
    stop,
  };
}
