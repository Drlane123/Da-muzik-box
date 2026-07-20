/**
 * SE2 Chord Generator mini-roll local preview — WAAPI playhead + 25ms audio lookahead
 * (mirrors SE2 transport; does not schedule the whole loop at once — GM/smplr ~3.25s limit).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { clampGrooveLabBpm } from '@/app/lib/creationStation/grooveLabTempo';
import {
  haltProgressionAuditionVoices,
  type ChordVoiceId,
} from '@/app/lib/creationStation/chordSequencerVoices';
import type { OrchidPerformanceMode } from '@/app/lib/creationStation/orchidChordEngine';
import {
  createGenoLoopRollAuditionBus,
  genoLoopRollBeatAtElapsed,
  genoLoopRollTotalBeats,
  genoLoopRollWrapBeat,
  refillGenoLoopRollSe2Sync,
  type GenoLoopRollAuditionOpts,
} from '@/app/lib/studio/genoLoopRollAudition';
import {
  cancelGenoLoopRollPlaylineWapi,
  launchGenoLoopRollPlaylineWapi,
  setGenoLoopRollPlaylineStatic,
} from '@/app/lib/studio/genoLoopRollPlaylineWapi';
import type { GenoLoopPianoRollNote } from '@/app/lib/studio/se2SynthGenoLoopPianoRoll';
import {
  haltSe2ChordGeneratorAudition,
  se2ChordGeneratorAuditionTrackIndex,
  warmupSe2ChordGeneratorInstrument,
} from '@/app/lib/studio/se2ChordGeneratorAudition';
import { SE2_AUDIO_START_FLOOR_SEC } from '@/app/lib/studio/se2TransportClock';

type RollNotePick = Pick<GenoLoopPianoRollNote, 'pitch' | 'startBeat' | 'durationBeats' | 'velocity'>;

const LOOKAHEAD_PUMP_MS = 25;
/** Soft-publish beat for key lighting — not for playhead paint (WAAPI owns that). */
const PLAYHEAD_PUBLISH_BEAT_EPS = 1 / 16;

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
  /** SE2 Chord Generator track Instrument — play through picker sound, not Orchid Grand. */
  midiInstrumentId?: string;
  trackId?: string;
  /** Mini-roll playhead element for WAAPI compositor motion. */
  getPlayheadEl?: () => HTMLElement | null;
}) {
  const [playheadBeat, setPlayheadBeatState] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [compositorActive, setCompositorActive] = useState(false);
  const playheadBeatRef = useRef(0);
  const playingRef = useRef(false);
  const sessionRef = useRef(0);
  const pumpRef = useRef<number | null>(null);
  const animRef = useRef<Animation | null>(null);
  const scheduledRef = useRef(new Set<string>());
  const lastLoopBeatRef = useRef(-1);
  const lastPublishedBeatRef = useRef(Number.NaN);
  const busRef = useRef<GainNode | null>(null);
  const notesRef = useRef<readonly RollNotePick[]>([]);
  const loopRef = useRef(opts.loop ?? true);
  loopRef.current = opts.loop ?? true;
  const getPlayheadElRef = useRef(opts.getPlayheadEl);
  getPlayheadElRef.current = opts.getPlayheadEl;
  const barCountRef = useRef(opts.barCount);
  const beatsPerBarRef = useRef(opts.beatsPerBar);
  barCountRef.current = opts.barCount;
  beatsPerBarRef.current = opts.beatsPerBar;
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const clearPump = useCallback(() => {
    if (pumpRef.current != null) {
      window.clearInterval(pumpRef.current);
      pumpRef.current = null;
    }
  }, []);

  const disposeBus = useCallback(() => {
    const bus = busRef.current;
    busRef.current = null;
    if (!bus) return;
    try {
      bus.disconnect();
    } catch {
      /* */
    }
  }, []);

  const parkPlayhead = useCallback((beat: number) => {
    const totalBeats = genoLoopRollTotalBeats(barCountRef.current, beatsPerBarRef.current);
    setGenoLoopRollPlaylineStatic(getPlayheadElRef.current?.() ?? null, beat, totalBeats);
  }, []);

  const stop = useCallback(() => {
    sessionRef.current += 1;
    clearPump();
    cancelGenoLoopRollPlaylineWapi({ animRef }, getPlayheadElRef.current?.() ?? null);
    haltSe2ChordGeneratorAudition();
    haltProgressionAuditionVoices();
    disposeBus();
    scheduledRef.current.clear();
    lastLoopBeatRef.current = -1;
    playingRef.current = false;
    setPlaying(false);
    setCompositorActive(false);
    parkPlayhead(playheadBeatRef.current);
  }, [clearPump, disposeBus, parkPlayhead]);

  useEffect(() => () => stop(), [stop]);

  const buildAuditionOpts = useCallback((bus?: GainNode): GenoLoopRollAuditionOpts => {
    const o = optsRef.current;
    return {
      bpm: clampGrooveLabBpm(o.bpm),
      chordVoice: o.chordVoice ?? 'grand',
      perfMode: o.perfMode ?? 'block',
      volume: o.volume ?? 0.82,
      genreId: o.genreId,
      instrumentId: o.midiInstrumentId,
      trackIndex: se2ChordGeneratorAuditionTrackIndex(o.trackId),
      auditionBus: bus,
    };
  }, []);

  const setPlayheadBeat = useCallback(
    (beat: number) => {
      if (playingRef.current) stop();
      playheadBeatRef.current = beat;
      setPlayheadBeatState(beat);
      parkPlayhead(beat);
    },
    [parkPlayhead, stop],
  );

  const play = useCallback(
    (notes: readonly RollNotePick[], fromBeat?: number) => {
      const o = optsRef.current;
      if (!o.getAudioContext || notes.length === 0) return;
      const getCtx = o.getAudioContext;
      const ctx = getCtx();
      if (!ctx || ctx.state === 'closed') return;

      const totalBeats = genoLoopRollTotalBeats(o.barCount, o.beatsPerBar);
      const initialBeat = Math.max(0, Math.min(totalBeats, fromBeat ?? playheadBeatRef.current));
      const sessionId = (sessionRef.current += 1);
      clearPump();
      cancelGenoLoopRollPlaylineWapi({ animRef }, getPlayheadElRef.current?.() ?? null);
      haltSe2ChordGeneratorAudition();
      haltProgressionAuditionVoices();
      disposeBus();
      scheduledRef.current.clear();
      lastLoopBeatRef.current = -1;
      lastPublishedBeatRef.current = Number.NaN;
      notesRef.current = notes;

      const vol = o.volume ?? 0.82;
      const bus = createGenoLoopRollAuditionBus(ctx, vol);
      busRef.current = bus;
      const auditionOpts = buildAuditionOpts(bus);
      if (auditionOpts.instrumentId) {
        warmupSe2ChordGeneratorInstrument(ctx, auditionOpts.instrumentId, bus);
      }

      const bpm = auditionOpts.bpm;
      const secPerBeat = 60 / Math.max(40, bpm);
      const tCapture = ctx.currentTime;
      const sessionStart = tCapture + SE2_AUDIO_START_FLOOR_SEC;

      playheadBeatRef.current = initialBeat;
      setPlayheadBeatState(initialBeat);
      playingRef.current = true;
      setPlaying(true);
      setCompositorActive(true);

      launchGenoLoopRollPlaylineWapi(
        { animRef },
        {
          el: getPlayheadElRef.current?.() ?? null,
          fromBeat: initialBeat,
          totalBeats,
          bpm,
          play: true,
          loop: loopRef.current,
          immediateCompositorStart: true,
          audioStartLeadSec: SE2_AUDIO_START_FLOOR_SEC,
        },
      );

      const publishBeat = (beat: number) => {
        if (
          Number.isFinite(lastPublishedBeatRef.current) &&
          Math.abs(beat - lastPublishedBeatRef.current) < PLAYHEAD_PUBLISH_BEAT_EPS
        ) {
          return;
        }
        lastPublishedBeatRef.current = beat;
        playheadBeatRef.current = beat;
        setPlayheadBeatState(beat);
      };

      const refill = () => {
        if (sessionRef.current !== sessionId) return;
        const liveCtx = getCtx();
        if (!liveCtx || liveCtx.state === 'closed') {
          stop();
          return;
        }
        const elapsedBeats = Math.max(0, liveCtx.currentTime - sessionStart) / secPerBeat;
        const loop = loopRef.current;
        const beat = genoLoopRollBeatAtElapsed(initialBeat, elapsedBeats, totalBeats, loop);
        const wrapped = genoLoopRollWrapBeat(beat, totalBeats);

        if (!loop && initialBeat + elapsedBeats >= totalBeats - 1e-6) {
          sessionRef.current += 1;
          clearPump();
          cancelGenoLoopRollPlaylineWapi({ animRef }, getPlayheadElRef.current?.() ?? null);
          haltSe2ChordGeneratorAudition();
          haltProgressionAuditionVoices();
          disposeBus();
          scheduledRef.current.clear();
          lastLoopBeatRef.current = -1;
          playingRef.current = false;
          setPlaying(false);
          setCompositorActive(false);
          playheadBeatRef.current = totalBeats;
          setPlayheadBeatState(totalBeats);
          parkPlayhead(totalBeats);
          return;
        }

        const prev = lastLoopBeatRef.current;
        if (prev >= 0 && wrapped + 1e-6 < prev) {
          scheduledRef.current.clear();
        }
        lastLoopBeatRef.current = wrapped;
        publishBeat(wrapped);

        refillGenoLoopRollSe2Sync(
          liveCtx,
          notesRef.current,
          loop ? initialBeat + elapsedBeats : wrapped,
          totalBeats,
          { ...auditionOpts, auditionBus: busRef.current ?? undefined },
          scheduledRef.current,
        );
      };

      refill();
      queueMicrotask(() => {
        if (sessionRef.current !== sessionId) return;
        refill();
      });
      pumpRef.current = window.setInterval(refill, LOOKAHEAD_PUMP_MS);
    },
    [buildAuditionOpts, clearPump, disposeBus, parkPlayhead, stop],
  );

  return {
    playheadBeat,
    setPlayheadBeat,
    playing,
    compositorActive,
    play,
    stop,
  };
}
