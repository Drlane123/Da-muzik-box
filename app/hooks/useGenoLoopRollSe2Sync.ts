import { useEffect, useRef } from 'react';
import { clampGrooveLabBpm } from '@/app/lib/creationStation/grooveLabTempo';
import {
  haltProgressionAuditionVoices,
  type ChordVoiceId,
} from '@/app/lib/creationStation/chordSequencerVoices';
import type { OrchidPerformanceMode } from '@/app/lib/creationStation/orchidChordEngine';
import {
  createGenoLoopRollAuditionBus,
  genoLoopRollTotalBeats,
  genoLoopRollWrapBeat,
  refillGenoLoopRollSe2Sync,
  type GenoLoopRollAuditionOpts,
} from '@/app/lib/studio/genoLoopRollAudition';
import type { GenoLoopPianoRollNote } from '@/app/lib/studio/se2SynthGenoLoopPianoRoll';
import {
  haltSe2ChordGeneratorAudition,
  se2ChordGeneratorAuditionTrackIndex,
  warmupSe2ChordGeneratorInstrument,
} from '@/app/lib/studio/se2ChordGeneratorAudition';

type RollNotePick = Pick<GenoLoopPianoRollNote, 'pitch' | 'startBeat' | 'durationBeats' | 'velocity'>;

export function useGenoLoopRollSe2Sync(opts: {
  enabled: boolean;
  transportPlaying: boolean;
  audioOn: boolean;
  getSe2TransportBeat?: () => number;
  getAudioContext?: () => AudioContext | null;
  notes: readonly RollNotePick[];
  bpm: number;
  beatsPerBar: number;
  barCount: number;
  genreId?: string;
  chordVoice?: ChordVoiceId;
  perfMode?: OrchidPerformanceMode;
  volume?: number;
  midiInstrumentId?: string;
  trackId?: string;
  onPlayheadBeat: (beat: number) => void;
}) {
  const scheduledRef = useRef(new Set<string>());
  const lastLoopBeatRef = useRef(-1);
  const wasPlayingRef = useRef(false);
  const busRef = useRef<GainNode | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const disposeBus = () => {
    const bus = busRef.current;
    busRef.current = null;
    if (!bus) return;
    try {
      bus.disconnect();
    } catch {
      /* */
    }
  };

  const {
    enabled,
    transportPlaying,
    audioOn,
    barCount,
    beatsPerBar,
    bpm,
    genreId,
    chordVoice,
    perfMode,
    volume,
  } = opts;

  useEffect(() => {
    if (!enabled) return;

    let raf = 0;
    let seekPoll = 0;
    let lastPublishedBeat = Number.NaN;

    const publishPlayhead = (loopBeat: number) => {
      const snapped = Math.round(loopBeat * 32) / 32;
      if (Math.abs(snapped - lastPublishedBeat) < 1 / 256) return;
      lastPublishedBeat = snapped;
      optsRef.current.onPlayheadBeat(snapped);
    };

    const syncPlayhead = () => {
      const getBeat = optsRef.current.getSe2TransportBeat;
      if (!getBeat) return 0;
      const { barCount: bars, beatsPerBar: bpb } = optsRef.current;
      const totalBeats = genoLoopRollTotalBeats(bars, bpb);
      const loopBeat = genoLoopRollWrapBeat(getBeat(), totalBeats);
      publishPlayhead(loopBeat);
      return loopBeat;
    };

    const tick = () => {
      const o = optsRef.current;
      const getBeat = o.getSe2TransportBeat;
      if (!getBeat) return;

      const totalBeats = genoLoopRollTotalBeats(o.barCount, o.beatsPerBar);
      const loopBeat = syncPlayhead();

      if (o.transportPlaying && !wasPlayingRef.current) {
        scheduledRef.current.clear();
        disposeBus();
      }
      wasPlayingRef.current = o.transportPlaying;

      if (o.transportPlaying && o.audioOn && o.getAudioContext && o.notes.length > 0) {
        const prev = lastLoopBeatRef.current;
        if (prev >= 0 && loopBeat + 1e-6 < prev) {
          scheduledRef.current.clear();
        }
        lastLoopBeatRef.current = loopBeat;
        const ctx = o.getAudioContext();
        if (ctx && ctx.state !== 'closed') {
          if (!busRef.current) {
            busRef.current = createGenoLoopRollAuditionBus(ctx, o.volume ?? 0.82);
            if (o.midiInstrumentId) {
              warmupSe2ChordGeneratorInstrument(ctx, o.midiInstrumentId, busRef.current);
            }
          }
          const auditionOpts: GenoLoopRollAuditionOpts = {
            bpm: clampGrooveLabBpm(o.bpm),
            chordVoice: o.chordVoice ?? 'grand',
            perfMode: o.perfMode ?? 'block',
            volume: o.volume ?? 0.82,
            genreId: o.genreId,
            instrumentId: o.midiInstrumentId,
            trackIndex: se2ChordGeneratorAuditionTrackIndex(o.trackId),
            auditionBus: busRef.current,
          };
          refillGenoLoopRollSe2Sync(
            ctx,
            o.notes,
            loopBeat,
            totalBeats,
            auditionOpts,
            scheduledRef.current,
          );
        }
      }

      raf = requestAnimationFrame(tick);
    };

    syncPlayhead();

    if (transportPlaying) {
      raf = requestAnimationFrame(tick);
    } else {
      seekPoll = window.setInterval(syncPlayhead, 120);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(seekPoll);
      haltSe2ChordGeneratorAudition();
      haltProgressionAuditionVoices();
      disposeBus();
      scheduledRef.current.clear();
      lastLoopBeatRef.current = -1;
      wasPlayingRef.current = false;
    };
  }, [
    audioOn,
    barCount,
    beatsPerBar,
    bpm,
    chordVoice,
    enabled,
    genreId,
    perfMode,
    transportPlaying,
    volume,
    opts.midiInstrumentId,
    opts.trackId,
  ]);

  useEffect(() => {
    if (!transportPlaying) {
      haltSe2ChordGeneratorAudition();
      haltProgressionAuditionVoices();
      disposeBus();
      scheduledRef.current.clear();
      lastLoopBeatRef.current = -1;
    }
  }, [transportPlaying]);
}
