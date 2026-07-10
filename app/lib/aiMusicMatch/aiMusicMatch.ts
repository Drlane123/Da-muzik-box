/**
 * AI Music Match — standalone harmonic matching module (no AI Song Generator code).
 */
import {
  GENRES,
  chordSymbolToName,
  getGenre,
  type ChordMode,
  type ChordSymbol,
} from '@/app/lib/creationStation/chordBuilder';
import { diatonicBassRootMidi } from '@/app/lib/creationStation/grooveLabOrchidMatch';
import {
  generateGrooveLabBasslineFromChordAnchors,
  GROOVE_LAB_BASS_GROOVE_DEFAULT,
  type GrooveLabBassGrooveId,
} from '@/app/lib/creationStation/grooveLabBassGrooves';
import {
  newProgressionStepId,
  progressionStepsToGrooveHits,
  type GrooveProgressionStep,
} from '@/app/lib/creationStation/grooveLabProgressionBuilder';
import { grooveLabClampBassRootMidi } from '@/app/lib/creationStation/grooveLabPitch';
import {
  GROOVE_LAB_QUANTIZE_DEFAULT,
  grooveLabChannelIds,
  grooveLabChordAnchorsFromHits,
  grooveLabPickChordChannel,
  sanitizeGrooveLabChordChannelHits,
  type GrooveLabBarCount,
  type GrooveRollHit,
} from '@/app/lib/creationStation/grooveLabRoll';
import {
  analyzeMelodyToProgressions,
  expandProgressionToBars,
  type MelodyAnalysisResult,
  type MelodyProgressionCandidate,
} from '@/app/lib/creationStation/melodyToChordProgression';
import { mixSeed } from '@/app/lib/groovePatternEngine';
import type { PitchEvent } from '@/app/lib/pitchDetection';

export type AiMatchSource = 'full' | 'vocals' | 'instruments' | 'bass';

export const AI_MATCH_GENRES = [
  'Hip-Hop',
  'R&B',
  'Pop',
  'Trap',
  'Lo-Fi',
  'Electronic',
  'Jazz',
  'Rock',
  'Soul',
  'Afrobeats',
] as const;

export type AiMatchGenre = (typeof AI_MATCH_GENRES)[number];

export const AI_MATCH_MOODS = [
  'Chill',
  'Hype',
  'Dark',
  'Romantic',
  'Uplifting',
  'Melancholic',
  'Aggressive',
  'Dreamy',
] as const;

export type AiMatchMood = (typeof AI_MATCH_MOODS)[number];

export const AI_MATCH_SOURCE_OPTIONS: {
  id: AiMatchSource;
  label: string;
  hint: string;
}[] = [
  { id: 'vocals', label: 'Vocals', hint: 'Build chords around a vocal stem (Music Match default)' },
  { id: 'instruments', label: 'Instruments', hint: 'Melody / keys / guitar (~100 Hz–2 kHz)' },
  { id: 'bass', label: 'Bass', hint: 'Low end only (~40–250 Hz)' },
  { id: 'full', label: 'Full mix', hint: 'Analyze everything in the clip' },
];

const KEY_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

const GENRE_LABEL_TO_ID: Record<AiMatchGenre, string> = {
  'Hip-Hop': 'hiphop',
  'R&B': 'rnb',
  Pop: 'pop',
  Trap: 'trap',
  'Lo-Fi': 'lofi',
  Electronic: 'house',
  Jazz: 'jazz',
  Rock: 'rock',
  Soul: 'gospel',
  Afrobeats: 'afrobeat',
};

const MOOD_BASS_GROOVES: Record<AiMatchMood, readonly GrooveLabBassGrooveId[]> = {
  Chill: ['gtr-trap-pluck', 'gtr-rnb-pocket', 'trap-808'],
  Hype: ['trap-808-slide', 'drill-808', 'hiphop-808-bounce'],
  Dark: ['drill-808', 'moog-pulse', 'trap-808'],
  Romantic: ['gtr-trap-pluck', 'gtr-rnb-pocket', 'rnb-808-silk'],
  Uplifting: ['pop-808-sub', 'gtr-trap-pluck', 'trap-808'],
  Melancholic: ['gtr-trap-pluck', 'gtr-rnb-pocket', 'moog-pulse'],
  Aggressive: ['drill-808', 'trap-808-slide', 'hiphop-808-bounce'],
  Dreamy: ['gtr-rnb-pocket', 'gtr-trap-pluck', 'rnb-808-silk'],
};

const GENRE_BASS_GROOVES: Partial<Record<AiMatchGenre, readonly GrooveLabBassGrooveId[]>> = {
  'Hip-Hop': ['trap-808', 'trap-808-slide', 'hiphop-808-bounce'],
  Trap: ['drill-808', 'trap-808-slide', 'trap-808'],
  'R&B': ['gtr-trap-pluck', 'gtr-rnb-pocket', 'rnb-808-silk'],
  Pop: ['gtr-trap-pluck', 'pop-808-sub', 'gtr-pop-8ths'],
  Jazz: ['gtr-walk', 'gtr-rnb-pocket', 'moog-pulse'],
  Rock: ['gtr-rock-root5', 'gtr-pop-8ths', 'moog-pulse'],
  Soul: ['gtr-rnb-pocket', 'gtr-trap-pluck', 'rnb-808-silk'],
  Afrobeats: ['trap-808', 'gtr-trap-pluck', 'clave-332'],
  'Lo-Fi': ['gtr-rnb-pocket', 'gtr-trap-pluck', 'trap-808'],
  Electronic: ['pop-808-sub', 'syncopated', 'trap-808'],
};

export function keyModeLabel(keyRoot: number, mode: ChordMode): string {
  const k = ((keyRoot % 12) + 12) % 12;
  return `${KEY_NAMES[k]!} ${mode}`;
}

export function resolveMatchGenreDef(genre: AiMatchGenre) {
  const id = GENRE_LABEL_TO_ID[genre];
  return getGenre(id) ?? GENRES.find((g) => g.label === genre);
}

export function filterPitchEventsForMatchSource(
  events: readonly PitchEvent[],
  source: AiMatchSource,
): PitchEvent[] {
  if (source === 'full') return [...events];
  return events.filter((e) => {
    const f = e.frequency;
    if (f <= 0) return false;
    switch (source) {
      case 'bass':
        return f >= 40 && f <= 250;
      case 'vocals':
        return f >= 150 && f <= 1200;
      case 'instruments':
        return f >= 100 && f <= 2000;
      default:
        return true;
    }
  });
}

export function formatAudioDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
}

function pickFromPool(pool: readonly GrooveLabBassGrooveId[], seed: number): GrooveLabBassGrooveId {
  if (pool.length === 0) return GROOVE_LAB_BASS_GROOVE_DEFAULT;
  const idx = Math.abs(seed) % pool.length;
  return pool[idx] ?? GROOVE_LAB_BASS_GROOVE_DEFAULT;
}

export function pickBassGrooveForStyle(
  genre: AiMatchGenre,
  mood: AiMatchMood,
  seed: number,
): GrooveLabBassGrooveId {
  const genrePool = GENRE_BASS_GROOVES[genre];
  const moodPool = MOOD_BASS_GROOVES[mood];
  const merged = [...(genrePool ?? []), ...moodPool];
  const unique = [...new Set(merged)];
  return pickFromPool(unique.length > 0 ? unique : [GROOVE_LAB_BASS_GROOVE_DEFAULT], seed);
}

function boostCandidatesForGenre(
  candidates: MelodyProgressionCandidate[],
  genre: AiMatchGenre,
  topK: number,
): MelodyProgressionCandidate[] {
  const genreDef = resolveMatchGenreDef(genre);
  if (!genreDef) return candidates.slice(0, topK);

  const genreKeys = new Set(genreDef.progressions.map((p) => p.chords.join('|')));
  const boosted = candidates
    .map((c) => ({
      ...c,
      score: c.score + (genreKeys.has(c.chords.join('|')) ? 0.55 : 0),
      label: genreKeys.has(c.chords.join('|')) ? `${genre} · ${c.label}` : c.label,
    }))
    .sort((a, b) => b.score - a.score);

  const deduped: MelodyProgressionCandidate[] = [];
  const seen = new Set<string>();
  for (const c of boosted) {
    const k = c.chords.join('|');
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(c);
    if (deduped.length >= topK) break;
  }
  return deduped;
}

export function analyzeAudioForMatch(
  events: PitchEvent[],
  bpm: number,
  opts: {
    genre: AiMatchGenre;
    mood: AiMatchMood;
    topK?: number;
  },
): MelodyAnalysisResult | null {
  if (events.length < 8) return null;

  const genreDef = resolveMatchGenreDef(opts.genre);
  const modeHint =
    genreDef?.mode === 'major' || genreDef?.mode === 'minor' ? genreDef.mode : undefined;

  const result = analyzeMelodyToProgressions(events, bpm, {
    topK: Math.max(8, (opts.topK ?? 6) + 4),
    modeHint,
  });
  if (!result) return null;

  return {
    ...result,
    candidates: boostCandidatesForGenre(result.candidates, opts.genre, opts.topK ?? 6),
  };
}

export function buildGrooveLabMatchSession(opts: {
  candidate: MelodyProgressionCandidate;
  keyRoot: number;
  mode: ChordMode;
  barCount: number;
  genre: AiMatchGenre;
  mood: AiMatchMood;
}): { notesByChannel: Record<number, GrooveRollHit[]>; barCount: number } | { message: string } {
  const { candidate, keyRoot, mode, barCount, genre, mood } = opts;
  const tiled = expandProgressionToBars(candidate.chords, barCount);
  const steps: GrooveProgressionStep[] = tiled.map((sym) => ({
    id: newProgressionStepId(),
    label: chordSymbolToName(sym, keyRoot, mode),
    beats: 4,
  }));

  const built = progressionStepsToGrooveHits(steps, {
    quantize: GROOVE_LAB_QUANTIZE_DEFAULT,
    barCount: barCount as GrooveLabBarCount,
    sustainSlots: 8,
  });
  if ('message' in built) return built;

  const chordHits = sanitizeGrooveLabChordChannelHits(built.chordHits, built.barCount);
  const refMidi = grooveLabClampBassRootMidi(diatonicBassRootMidi(keyRoot, mode, 0, 36));
  const chordAnchors = grooveLabChordAnchorsFromHits(chordHits, {
    keyRoot,
    mode,
    referenceMidi: refMidi,
  });

  const seed = mixSeed([keyRoot, mode, genre, mood, candidate.id]);
  const bassHits = generateGrooveLabBasslineFromChordAnchors({
    grooveId: pickBassGrooveForStyle(genre, mood, seed),
    chordAnchors,
    fallbackRootMidi: refMidi,
    mode: mode as 'major' | 'minor',
    barCount: built.barCount,
    quantize: GROOVE_LAB_QUANTIZE_DEFAULT,
    seed,
  });

  const chordCh = grooveLabPickChordChannel();
  const notesByChannel: Record<number, GrooveRollHit[]> = {};
  for (const ch of grooveLabChannelIds()) notesByChannel[ch] = [];
  notesByChannel[chordCh] = [...chordHits, ...bassHits];

  return { notesByChannel, barCount: built.barCount };
}

export function chordSymbolsToDisplay(
  chords: readonly ChordSymbol[],
  keyRoot: number,
  mode: ChordMode,
): string {
  return chords.map((sym) => chordSymbolToName(sym, keyRoot, mode)).join(' → ');
}
