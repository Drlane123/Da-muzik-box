import { useCallback, useEffect, useRef, useState } from 'react';

import type { AiMatchGenre, AiMatchMood } from '@/app/lib/aiMusicMatch/aiMusicMatch';
import {
  AI_MATCH_PREVIEW_MIX_DEFAULT,
  startAiMusicMatchPreview,
  stopAiMusicMatchPreview,
  updateAiMusicMatchPreviewMix,
  type AiMatchPreviewMix,
} from '@/app/lib/aiMusicMatch/aiMusicMatchPreview';
import type { MatchLoopBarCount } from '@/app/lib/aiMusicMatch/aiMusicMatchRollData';
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import type { MelodyProgressionCandidate } from '@/app/lib/creationStation/melodyToChordProgression';

export const AI_MATCH_PLACEHOLDER_CANDIDATE: MelodyProgressionCandidate = {
  id: 'placeholder',
  label: 'Preview grid',
  chords: ['I', 'V', 'vi', 'IV'],
  score: 0,
};

export function useAiMusicMatchPlayback(opts: {
  audioBuffer: AudioBuffer | null;
  candidate: MelodyProgressionCandidate | null;
  keyRoot: number;
  mode: ChordMode;
  loopBarCount: MatchLoopBarCount;
  genre: AiMatchGenre;
  mood: AiMatchMood;
  bpm: number;
  getOrCreateAudioContext: () => AudioContext;
}) {
  const { audioBuffer, candidate, keyRoot, mode, loopBarCount, genre, mood, bpm, getOrCreateAudioContext } =
    opts;

  const [playing, setPlaying] = useState(false);
  const [previewBeat, setPreviewBeat] = useState<number | null>(null);
  const [mix, setMix] = useState<AiMatchPreviewMix>(AI_MATCH_PREVIEW_MIX_DEFAULT);
  const previewStartRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const stopPlayhead = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    previewStartRef.current = null;
    setPreviewBeat(null);
    setPlaying(false);
  }, []);

  const stopAll = useCallback(() => {
    stopAiMusicMatchPreview();
    stopPlayhead();
  }, [stopPlayhead]);

  const startPlayhead = useCallback(() => {
    previewStartRef.current = performance.now();
    const loopBeats = loopBarCount * 4;
    const beatMs = 60_000 / Math.max(40, bpm);
    const tick = () => {
      const t0 = previewStartRef.current;
      if (t0 == null) return;
      setPreviewBeat(((performance.now() - t0) / beatMs) % loopBeats);
      rafRef.current = requestAnimationFrame(tick);
    };
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }, [bpm, loopBarCount]);

  const startPlayback = useCallback(() => {
    if (!audioBuffer) return;
    stopAll();
    const ctx = getOrCreateAudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const previewCandidate = candidate ?? AI_MATCH_PLACEHOLDER_CANDIDATE;
    const handle = startAiMusicMatchPreview(
      getOrCreateAudioContext,
      {
        audioBuffer,
        candidate: previewCandidate,
        keyRoot,
        mode,
        barCount: loopBarCount,
        genre,
        mood,
        bpm,
        mix,
      },
      () => stopPlayhead(),
    );
    if (!handle) return;
    setPlaying(true);
    startPlayhead();
  }, [
    audioBuffer,
    bpm,
    candidate,
    genre,
    getOrCreateAudioContext,
    keyRoot,
    loopBarCount,
    mode,
    mood,
    mix,
    startPlayhead,
    stopAll,
    stopPlayhead,
  ]);

  const togglePlayback = useCallback(() => {
    if (playing) stopAll();
    else startPlayback();
  }, [playing, startPlayback, stopAll]);

  useEffect(() => () => stopAll(), [stopAll]);

  useEffect(() => {
    if (!playing) return;
    startPlayhead();
  }, [loopBarCount, playing, startPlayhead]);

  const setMixPartial = useCallback((partial: Partial<AiMatchPreviewMix>) => {
    setMix((prev) => {
      const next = { ...prev, ...partial };
      if (playing) updateAiMusicMatchPreviewMix(next);
      return next;
    });
  }, [playing]);

  useEffect(() => {
    if (!playing) return;
    updateAiMusicMatchPreviewMix(mix);
  }, [mix, playing]);

  return {
    playing,
    previewBeat,
    togglePlayback,
    startPlayback,
    stopAll,
    hasMatchedChords: Boolean(candidate),
    mix,
    setMixPartial,
  };
}
