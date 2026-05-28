/**
 * Professional chord-progression library for Chord Sequencer.
 * Aggregates every curated pack in {@link GENRES} plus a dedicated
 * Emotional Core set — complete Roman-numeral loops ready to load and edit.
 */

import {
  GENRES,
  progressionResolvesInMode,
  resolveProgressionMode,
  type ChordMode,
  type ChordSymbol,
  type GenreDef,
  type ProgressionDef,
} from '@/app/lib/creationStation/chordBuilder';

export interface ProProgressionEntry {
  id: string;
  name: string;
  chords: ChordSymbol[];
  genreId: string;
  genreLabel: string;
  mode: ChordMode;
  /** Emotional Core only — human tag for browsing. */
  emotion?: string;
}

export interface ProProgressionCategory {
  id: string;
  label: string;
  description: string;
}

/** Canonical progressions every producer should have one click away. */
export const EMOTIONAL_CORE_PROGRESSIONS: (ProgressionDef & { emotion: string })[] = [
  { id: 'core-hope', emotion: 'Hopeful', name: 'Axis · Hopeful Lift', chords: ['I', 'V', 'vi', 'IV'] },
  { id: 'core-nostalgia', emotion: 'Nostalgic', name: '50s · Ice Cream Changes', chords: ['I', 'vi', 'IV', 'V'] },
  { id: 'core-yearn', emotion: 'Yearning', name: 'Sensitive · Relative Minor', chords: ['vi', 'IV', 'I', 'V'] },
  { id: 'core-anthem', emotion: 'Anthemic', name: 'Stadium · IV Loop', chords: ['I', 'IV', 'V', 'IV'] },
  { id: 'core-power', emotion: 'Power', name: 'Power Ballad · vi Lead', chords: ['vi', 'V', 'IV', 'V'] },
  { id: 'core-prayer', emotion: 'Prayerful', name: 'Prayer Lift · vi Start', chords: ['vi', 'IV', 'I', 'V'] },
  { id: 'core-circle', emotion: 'Resolving', name: 'Circle · ii-V Home', chords: ['I', 'vi', 'ii', 'V'] },
  { id: 'core-soul', emotion: 'Soulful', name: 'Soul Turn · Maj7 Walk', chords: ['Imaj7', 'vi7', 'ii7', 'V7'] },
  { id: 'core-gospel', emotion: 'Gospel', name: 'Church Turn · Amen', chords: ['vi', 'ii', 'V', 'I'] },
  { id: 'core-jazz', emotion: 'Jazz', name: '2-5-1 · Standards', chords: ['ii7', 'V7', 'Imaj7', 'Imaj7'] },
  { id: 'core-lush', emotion: 'Lush', name: 'Quiet Storm · Maj7 Fall', chords: ['Imaj7', 'IVmaj7', 'iii7', 'vi7'] },
  { id: 'core-borrow', emotion: 'Bittersweet', name: 'Borrowed · bVII Lift', chords: ['Imaj7', 'bVII', 'IVmaj7', 'V7'] },
  { id: 'core-indie', emotion: 'Indie', name: 'Indie · iii Color', chords: ['I', 'iii', 'vi', 'IV'] },
  { id: 'core-emo', emotion: 'Melancholy', name: 'Emo · vi Loop', chords: ['vi', 'V', 'IV', 'V'] },
  { id: 'core-rise', emotion: 'Rising', name: 'Pre-Chorus · IV Push', chords: ['I', 'V', 'IV', 'V'] },
  { id: 'core-dark', emotion: 'Dark Pop', name: 'Dark Dance · Modal Borrow', chords: ['vi', 'bVI', 'bVII', 'V'] },
];

/** Progressions behind countless chart hits — named by era and feel. */
export const HIT_SONG_CORE_PROGRESSIONS: (ProgressionDef & { era: string })[] = [
  { id: 'hit-axis', era: '2000s–Today', name: 'The Axis · I-V-vi-IV', chords: ['I', 'V', 'vi', 'IV'] },
  { id: 'hit-50s', era: '50s–60s', name: 'Doo-Wop · I-vi-IV-V', chords: ['I', 'vi', 'IV', 'V'] },
  { id: 'hit-sensitive', era: '90s–Today', name: 'Sensitive · vi-IV-I-V', chords: ['vi', 'IV', 'I', 'V'] },
  { id: 'hit-3chord', era: 'Rock/Country', name: 'Three-Chord Rock · I-IV-V', chords: ['I', 'IV', 'V', 'I'] },
  { id: 'hit-anthem', era: 'Arena Pop', name: 'Stadium Loop · I-IV-V-IV', chords: ['I', 'IV', 'V', 'IV'] },
  { id: 'hit-power', era: '80s Ballad', name: 'Power Ballad · vi-V-IV-V', chords: ['vi', 'V', 'IV', 'V'] },
  { id: 'hit-soul', era: '70s Soul', name: 'Soul Turn · Imaj7-vi7-ii7-V7', chords: ['Imaj7', 'vi7', 'ii7', 'V7'] },
  { id: 'hit-quiet', era: 'Quiet Storm', name: 'Maj7 Fall · Imaj7-IVmaj7-iii7-vi7', chords: ['Imaj7', 'IVmaj7', 'iii7', 'vi7'] },
  { id: 'hit-gospel', era: 'Gospel/Soul', name: 'Church Turn · vi-ii-V-I', chords: ['vi', 'ii', 'V', 'I'] },
  { id: 'hit-jazz251', era: 'Jazz/Standards', name: '2-5-1 · ii7-V7-Imaj7', chords: ['ii7', 'V7', 'Imaj7', 'Imaj7'] },
  { id: 'hit-indie', era: 'Indie/Alt', name: 'Indie Color · I-iii-vi-IV', chords: ['I', 'iii', 'vi', 'IV'] },
  { id: 'hit-hiphop', era: 'Hip-Hop/Trap', name: 'Minor Loop · i-VI-III-VII', chords: ['i', 'VI', 'III', 'VII'] },
  { id: 'hit-disco', era: 'Disco/House', name: 'Four-on-Floor · Imaj7-vi7-ii7-V7', chords: ['Imaj7', 'vi7', 'ii7', 'V7'] },
  { id: 'hit-borrow', era: 'Modern Pop', name: 'Borrowed Lift · Imaj7-bVII-IV-V', chords: ['Imaj7', 'bVII', 'IV', 'V'] },
  { id: 'hit-blues', era: 'Blues/Rock', name: '12-Bar Blues', chords: ['I7', 'I7', 'I7', 'I7', 'IV7', 'IV7', 'I7', 'I7', 'V7', 'IV7', 'I7', 'V7'] },
  { id: 'hit-circle', era: 'Classic Pop', name: 'Circle · I-vi-ii-V', chords: ['I', 'vi', 'ii', 'V'] },
  { id: 'hit-ascend', era: 'Pre-Chorus', name: 'Lift · I-V-vi-iii-IV', chords: ['I', 'V', 'vi', 'iii', 'IV'] },
  { id: 'hit-darkpop', era: 'Dark Pop/Dance', name: 'Modal Shadow · vi-bVI-bVII-V', chords: ['vi', 'bVI', 'bVII', 'V'] },
  { id: 'hit-rnb90', era: '90s R&B', name: 'Diva Turn · vi7-V-IV-V', chords: ['vi7', 'V', 'IV', 'V'] },
  { id: 'hit-kpop', era: 'K-Pop/Dance', name: 'Chant Hook · vi-IV-I-V', chords: ['vi', 'IV', 'I', 'V'] },
];

export const PRO_PROGRESSION_CATEGORIES: ProProgressionCategory[] = [
  {
    id: 'emotional-core',
    label: 'Emotional Core',
    description: 'The main harmonic feels — hope, soul, prayer, power, jazz, dark pop.',
  },
  {
    id: 'hit-songs',
    label: 'Hit Song Core',
    description: 'The progressions behind most chart hits — load complete loops and edit on the roll.',
  },
  {
    id: 'all',
    label: 'All Eras',
    description: 'Every professional progression across all genre packs.',
  },
  ...GENRES.map((g) => ({
    id: g.id,
    label: g.label,
    description: `Complete ${g.label} progression pack — load and edit in the step sequencer.`,
  })),
];

function progressionToEntry(g: GenreDef, p: ProgressionDef): ProProgressionEntry {
  const mode = resolveProgressionMode(p, g);
  return {
    id: `${g.id}__${p.id}`,
    name: p.name,
    chords: [...p.chords],
    genreId: g.id,
    genreLabel: g.label,
    mode,
  };
}

function flattenGenreProgressions(): ProProgressionEntry[] {
  const out: ProProgressionEntry[] = [];
  for (const g of GENRES) {
    for (const p of g.progressions) {
      const entry = progressionToEntry(g, p);
      if (progressionResolvesInMode(entry.chords, entry.mode)) {
        out.push(entry);
      }
    }
  }
  return out;
}

const ALL_FLAT = flattenGenreProgressions();

function emotionalCoreEntries(): ProProgressionEntry[] {
  return EMOTIONAL_CORE_PROGRESSIONS.map((p) => ({
    id: p.id,
    name: p.name,
    chords: [...p.chords],
    genreId: 'pop',
    genreLabel: 'Emotional Core',
    mode: 'major' as ChordMode,
    emotion: p.emotion,
  }));
}

function hitSongCoreEntries(): ProProgressionEntry[] {
  return HIT_SONG_CORE_PROGRESSIONS.map((p) => {
    const minor = p.chords.some((c) => /^i/.test(c));
    return {
      id: p.id,
      name: p.name,
      chords: [...p.chords],
      genreId: minor ? 'hiphop' : 'pop',
      genreLabel: `Hit Core · ${p.era}`,
      mode: (minor ? 'minor' : 'major') as ChordMode,
      emotion: p.era,
    };
  });
}

/** Full professional bank (genres + emotional core, deduped by chord string). */
export function getAllProfessionalProgressions(): ProProgressionEntry[] {
  const seen = new Set<string>();
  const merged = [...emotionalCoreEntries(), ...ALL_FLAT];
  return merged.filter((e) => {
    const key = e.chords.join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getProgressionsByCategory(categoryId: string): ProProgressionEntry[] {
  if (categoryId === 'emotional-core') return emotionalCoreEntries();
  if (categoryId === 'hit-songs') return hitSongCoreEntries();
  if (categoryId === 'all') return getAllProfessionalProgressions();
  const g = GENRES.find((x) => x.id === categoryId);
  if (!g) return emotionalCoreEntries();
  return g.progressions
    .map((p) => progressionToEntry(g, p))
    .filter((e) => progressionResolvesInMode(e.chords, e.mode));
}
