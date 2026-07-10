/**
 * AI Music Match → Geno Build 1 draft (chords + auto bass, 4–8 bars).
 */
import {
  type AiMatchGenre,
  type AiMatchMood,
} from '@/app/lib/aiMusicMatch/aiMusicMatch';
import type { ChordMode, ChordSymbol } from '@/app/lib/creationStation/chordBuilder';
import { expandProgressionToBars } from '@/app/lib/creationStation/melodyToChordProgression';
import type { MelodyProgressionCandidate } from '@/app/lib/creationStation/melodyToChordProgression';
import type { GenoBassPattern } from '@/app/lib/studio/se2SynthGenoBassEngine';
import {
  SE2_SYNTH_GENO_CHORD_DEFAULTS,
  se2SynthGenoRegeneratePluginPart,
  type Se2SynthGenoChordPluginState,
  type Se2SynthGenoPluginDraft,
} from '@/app/lib/studio/se2SynthGenoChordPlugin';
import type { GenoBarChordSpec } from '@/app/lib/studio/se2SynthGenoChordEngine';
import type { GenoChordStyle } from '@/app/lib/studio/se2SynthGenoComposePrompt';
import { se2SynthGenoSoundSelectionForChordStyle } from '@/app/lib/studio/se2SynthGenoGenreSoundBank';
import {
  se2SynthGenoLiveChordModeToKeyMode,
  se2SynthGenoLiveRomansToSpecs,
} from '@/app/lib/studio/se2SynthGenoLiveChordRoman';
import type { Se2SynthGenoLiveGenreId } from '@/app/lib/studio/se2SynthGenoLiveChordTypes';
import { genoCoerceLoopBarCount, type GenoLoopBarCount } from '@/app/lib/studio/se2SynthGenoLoopBarCount';
import type { Se2SynthGenoPluginSoundSelection } from '@/app/lib/studio/se2SynthGenoSoundBank';
import type { StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';
import { mixSeed } from '@/app/lib/groovePatternEngine';

const GENRE_TO_LIVE: Record<AiMatchGenre, Se2SynthGenoLiveGenreId> = {
  'Hip-Hop': 'hip-hop',
  'R&B': 'rnb',
  Pop: 'pop',
  Trap: 'trap',
  'Lo-Fi': 'lofi',
  Electronic: 'house-dance',
  Jazz: 'jazz',
  Rock: 'boom-bap',
  Soul: 'neo-soul',
  Afrobeats: 'afrobeats',
};

const GENRE_TO_STYLE: Record<AiMatchGenre, GenoChordStyle> = {
  'Hip-Hop': 'dark',
  'R&B': 'rnb',
  Pop: 'pop',
  Trap: 'trap',
  'Lo-Fi': 'dark',
  Electronic: 'dance',
  Jazz: 'jazz',
  Rock: 'bright',
  Soul: 'gospel',
  Afrobeats: 'pop',
};

const MOOD_BASS: Record<AiMatchMood, GenoBassPattern> = {
  Chill: 'root-fifth',
  Hype: 'funk',
  Dark: 'root',
  Romantic: 'root-fifth',
  Uplifting: 'kpop',
  Melancholic: 'root-fifth',
  Aggressive: 'funk',
  Dreamy: 'walk',
};

function moodBassPattern(mood: AiMatchMood): GenoBassPattern {
  return MOOD_BASS[mood];
}

export function aiMatchCoerceLoopBars(analysisBarCount: number): GenoLoopBarCount {
  if (analysisBarCount <= 4) return 4;
  if (analysisBarCount >= 12) return 8;
  return genoCoerceLoopBarCount(analysisBarCount <= 6 ? 4 : 8);
}

export type AiMatchGenoDraftResult = {
  draft: Se2SynthGenoPluginDraft;
  barSpecs: GenoBarChordSpec[];
  barCount: GenoLoopBarCount;
  sounds: Se2SynthGenoPluginSoundSelection;
  keyMode: StudioDetectedKeyMode;
  liveGenreId: Se2SynthGenoLiveGenreId;
  stylePreset: GenoChordStyle;
};

export function buildAiMatchPlaceholderDraft(opts: {
  keyRoot: number;
  mode: ChordMode;
  barCount?: GenoLoopBarCount;
  genre: AiMatchGenre;
  mood: AiMatchMood;
  bpm: number;
}): AiMatchGenoDraftResult {
  return buildAiMatchGenoDraft({
    candidate: {
      id: 'ai-match-placeholder',
      label: 'I–V–vi–IV (preview grid)',
      chords: ['I', 'V', 'vi', 'IV'],
      score: 0,
    },
    keyRoot: opts.keyRoot,
    mode: opts.mode,
    barCount: opts.barCount ?? 4,
    genre: opts.genre,
    mood: opts.mood,
    bpm: opts.bpm,
  });
}

export function buildAiMatchGenoDraft(opts: {
  candidate: MelodyProgressionCandidate;
  keyRoot: number;
  mode: ChordMode;
  barCount?: GenoLoopBarCount;
  genre: AiMatchGenre;
  mood: AiMatchMood;
  bpm: number;
  beatsPerBar?: number;
}): AiMatchGenoDraftResult {
  const barCount = opts.barCount ?? aiMatchCoerceLoopBars(8);
  const beatsPerBar = opts.beatsPerBar ?? 4;
  const liveGenreId = GENRE_TO_LIVE[opts.genre];
  const stylePreset = GENRE_TO_STYLE[opts.genre];
  const keyMode = se2SynthGenoLiveChordModeToKeyMode(opts.mode);
  const sounds = se2SynthGenoSoundSelectionForChordStyle(stylePreset);

  const romans = expandProgressionToBars(opts.candidate.chords, barCount) as ChordSymbol[];
  const barSpecs = se2SynthGenoLiveRomansToSpecs(romans, opts.mode, liveGenreId);

  const state: Se2SynthGenoChordPluginState = {
    ...SE2_SYNTH_GENO_CHORD_DEFAULTS,
    barCount,
    stylePreset,
    enableChords: true,
    enableMelody: false,
    enableBass: true,
    bassPattern: moodBassPattern(opts.mood),
    barChordSpecs: barSpecs,
    progressionRomans: opts.candidate.chords,
    progressionLoop: barSpecs.map((s) => ({ ...s })),
    accordBankId: sounds.accordBankId,
    melodyBankId: sounds.melodyBankId,
    bassBankId: sounds.bassBankId,
  };

  const seed = mixSeed([opts.keyRoot, opts.mode, opts.genre, opts.mood, opts.candidate.id, barCount]);
  const draft = se2SynthGenoRegeneratePluginPart({
    draft: null,
    state,
    part: 'all',
    seeds: { chords: seed, melody: seed + 11, bass: seed + 23 },
    keyRoot: opts.keyRoot,
    keyMode,
    beatsPerBar,
    bpm: opts.bpm,
    stableVoicing: true,
    freshDraft: true,
  });

  return {
    draft,
    barSpecs,
    barCount,
    sounds,
    keyMode,
    liveGenreId,
    stylePreset,
  };
}
