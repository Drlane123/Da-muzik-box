/**
 * AI Music Match → Studio Editor 2 export payload.
 */
import { buildAiMatchGenoDraft } from '@/app/lib/aiMusicMatch/aiMusicMatchGenoDraft';
import type { AiMatchGenre, AiMatchMood } from '@/app/lib/aiMusicMatch/aiMusicMatch';
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import type { MelodyProgressionCandidate } from '@/app/lib/creationStation/melodyToChordProgression';
import { se2SynthGenoBuildPluginApplyStack } from '@/app/lib/studio/se2SynthGenoPluginApplyStack';
import type { Se2SynthGenoStackPart } from '@/app/lib/studio/se2SynthGenoCompose';
import type { GenoLoopBarCount } from '@/app/lib/studio/se2SynthGenoLoopBarCount';
import type { Se2ComposeResolvedKey } from '@/app/lib/studio/se2SynthGenoKeyLock';
import { studioKeyLabel } from '@/app/lib/studio/studioAudioClipAnalysis';
import type { StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';

export type PendingAiMatchStudioImport = {
  stack: Se2SynthGenoStackPart[];
  bars: number;
  keyRoot: number;
  keyMode: StudioDetectedKeyMode;
  audioBlob: Blob;
  trackName: string;
  bpm: number;
};

export function buildAiMatchStudioExportPayload(opts: {
  candidate: MelodyProgressionCandidate;
  keyRoot: number;
  mode: ChordMode;
  barCount: GenoLoopBarCount;
  genre: AiMatchGenre;
  mood: AiMatchMood;
  bpm: number;
  audioBlob: Blob;
  trackName?: string;
}): PendingAiMatchStudioImport | null {
  const built = buildAiMatchGenoDraft({
    candidate: opts.candidate,
    keyRoot: opts.keyRoot,
    mode: opts.mode,
    barCount: opts.barCount,
    genre: opts.genre,
    mood: opts.mood,
    bpm: opts.bpm,
  });

  const resolvedKey: Se2ComposeResolvedKey = {
    keyRoot: opts.keyRoot,
    keyMode: built.keyMode,
    source: 'song',
    label: studioKeyLabel(opts.keyRoot, built.keyMode),
  };

  const stack = se2SynthGenoBuildPluginApplyStack({
    draft: built.draft,
    sounds: built.sounds,
    resolvedKey,
    beatsPerBar: 4,
    bpm: opts.bpm,
    enableChords: true,
    enableMelody: false,
    enableBass: true,
    barChordSpecs: built.barSpecs,
  });

  if (stack.length === 0) return null;

  return {
    stack,
    bars: built.barCount,
    keyRoot: opts.keyRoot,
    keyMode: built.keyMode,
    audioBlob: opts.audioBlob,
    trackName: opts.trackName ?? 'AI Music Match',
    bpm: opts.bpm,
  };
}
