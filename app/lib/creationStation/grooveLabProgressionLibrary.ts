/**
 * Groove Lab progression library — curated Pop / R&B / Soul packs (same canon as
 * Chord Builder / Song Engine). Letter-name steps for the piano-roll builder.
 */

import type { ChordMode, ChordSymbol } from '@/app/lib/creationStation/chordBuilder';
import {
  GENRES,
  chordSymbolToMidi,
  chordSymbolToName,
  coerceChordSymbolForMode,
  getGenre,
  getModeChordSymbols,
  getModeDefaultChord,
  suggestLikelyNextChords,
} from '@/app/lib/creationStation/chordBuilder';
import { parseChordSymbolToken } from '@/app/lib/creationStation/chordProgressionParse';
import type { GrooveProgressionStep } from '@/app/lib/creationStation/grooveLabProgressionBuilder';
import { newProgressionStepId } from '@/app/lib/creationStation/grooveLabProgressionBuilder';
import {
  resolveProgressionBpm,
  type ResolvedProgressionTempo,
} from '@/app/lib/creationStation/genreTempoProfiles';
import { clampGrooveLabBpm } from '@/app/lib/creationStation/grooveLabTempo';

export type GrooveProgressionPackId = string;

export type GrooveProgressionPresetEntry = {
  id: GrooveProgressionPackId;
  genreId: string;
  genreLabel: string;
  progressionId: string;
  label: string;
  steps: { label: string; beats: number; rest?: boolean }[];
};

export type GrooveNextChordSuggestion = {
  label: string;
  roman: ChordSymbol;
  /** 0–100 display strength (strongest first). */
  strength: number;
};

/** Flat list of every curated progression in the app (~100+ loops). */
export function buildGrooveProgressionPresetCatalog(keyRoot = 0): GrooveProgressionPresetEntry[] {
  const out: GrooveProgressionPresetEntry[] = [];
  for (const genre of GENRES) {
    for (const prog of genre.progressions) {
      const mode = (prog.mode ?? genre.mode) as ChordMode;
      const steps = prog.chords.map((sym) => {
        const coerced = coerceChordSymbolForMode(sym, mode, genre.mode);
        const label = chordSymbolToName(coerced, keyRoot, mode);
        return { label, beats: 1 };
      });
      out.push({
        id: `${genre.id}::${prog.id}`,
        genreId: genre.id,
        genreLabel: genre.label,
        progressionId: prog.id,
        label: `${genre.label} · ${prog.name}`,
        steps,
      });
    }
  }
  return out;
}

export const GROOVE_PROGRESSION_GENRE_PACKS = GENRES.map((g) => ({
  id: g.id,
  label: g.label,
}));

export const GROOVE_CHORD_PALETTE: { title: string; chords: string[] }[] = [
  {
    title: 'Major / add9',
    chords: ['C', 'G', 'F', 'Am', 'Dm', 'Em', 'Cmaj7', 'Gmaj7', 'Fmaj7', 'Cadd9', 'Gsus4'],
  },
  {
    title: 'Minor / m7',
    chords: ['Am', 'Dm', 'Em', 'Gm', 'Cm', 'Fm', 'Am7', 'Dm7', 'Em7', 'Gm7', 'Cm7', 'Fm7'],
  },
  {
    title: 'Dominant / soul',
    chords: ['G7', 'C7', 'F7', 'D7', 'A7', 'E7', 'B7', 'G9', 'C9', 'F9', 'Am9', 'Dm9'],
  },
  {
    title: 'R&B color',
    chords: [
      'Cmaj7', 'Am7', 'Dm7', 'G7', 'Fmaj7', 'Em7', 'Bm7', 'E7', 'Amaj7', 'F#m7', 'B7',
      'Bbmaj7', 'Gm7', 'Cm7', 'F7', 'Ebmaj7', 'Abmaj7', 'Dbmaj7',
    ],
  },
  {
    title: 'T&B Edition',
    chords: [
      'Cmaj7', 'Cmaj9', 'Am7', 'Am9', 'Dm7', 'Dm9', 'G7', 'G13', 'Fmaj7', 'Fm7', 'Em7', 'E7',
      'A7', 'D7', 'Bbmaj7', 'Ebmaj7', 'Abmaj7', 'Gsus4', 'Bm7b5',
    ],
  },
  {
    title: 'Neo / borrowed',
    chords: ['Bbm', 'Eb', 'Ab', 'Fm', 'Bbm7', 'Ebmaj7', 'Abmaj7', 'Fsus4', 'Csus4', 'Dsus4'],
  },
  {
    title: 'Pop rock ballad',
    chords: [
      'C', 'Am', 'F', 'G', 'Cadd9', 'Am7', 'Fmaj7', 'Gsus4', 'Em7', 'Dm7', 'Bb', 'Cmaj7',
    ],
  },
  {
    title: 'K-pop color',
    chords: [
      'Cmaj7', 'Am7', 'Fmaj7', 'G7', 'Dm7', 'Em7', 'Abmaj7', 'Bbmaj7', 'E7', 'A7', 'F', 'G',
    ],
  },
  {
    title: 'Southern soul',
    chords: ['C7', 'F7', 'G7', 'A7', 'D7', 'Eb7', 'Fm7', 'Cmaj7', 'Am7', 'Dm7'],
  },
  {
    title: 'Lo-fi / jazz hop',
    chords: [
      'Cmaj7', 'Cmaj9', 'Am7', 'Am9', 'Dm7', 'Dm9', 'G7', 'G13', 'Fmaj7', 'Em7', 'Abmaj7', 'Bbmaj7',
    ],
  },
  {
    title: '90s / 2000s dance',
    chords: [
      'Am', 'Am7', 'G', 'F', 'Em', 'Dm', 'E7', 'C', 'Fmaj7', 'Gsus4', 'G7', 'Cmaj7', 'Dm7', 'Bb',
    ],
  },
  {
    title: 'Horror cinema',
    chords: [
      'Am', 'Am7', 'Dm', 'E', 'E7', 'F', 'G', 'Bdim', 'Bm7b5', 'Bb', 'Ab', 'C', 'Em', 'F#dim',
    ],
  },
  {
    title: 'Sci-fi cinema',
    chords: [
      'Am9', 'Am7', 'Fmaj7', 'Cmaj7', 'G', 'Dm7', 'Em7', 'Bb', 'Ab', 'Eb', 'Csus2', 'Fsus4', 'A7',
    ],
  },
  {
    title: 'Phrygian / evil cinematic',
    chords: [
      'Am', 'Am7', 'Bb', 'Bdim', 'Bm7b5', 'Ab', 'G', 'F', 'E', 'E7', 'Eb', 'Bbmaj7', 'C', 'Dm',
    ],
  },
  {
    title: 'Horror icons · hold (4 bars)',
    chords: ['Am', 'Dm', 'G', 'F', 'E', 'E7', 'Ab', 'Bb', 'Bdim', 'C'],
  },
];

export type Groove8BarSongKind = 'full8' | 'full4' | 'loop4x2';

export type Groove8BarSongCategory =
  | 'rnb'
  | 'general'
  | 'pop-rock'
  | 'kpop'
  | 'southern-soul'
  | 'lofi'
  | 'dance-90s'
  | 'horror'
  | 'scifi'
  | 'phrygian'
  | 'horror-icon'
  | 'tb-edition';

export type Groove8BarSongPreset = {
  id: string;
  label: string;
  /** One symbol per bar — length 4 (cinematic chop) or 8 (full phrase / loop×2). */
  chords: string[];
  kind: Groove8BarSongKind;
  category?: Groove8BarSongCategory;
  /** Target audition BPM — omit to resolve from category + label heuristics. */
  bpm?: number;
};

/** Genre pack used when resolving song-bank tempo from category. */
const SONG_BANK_CATEGORY_GENRE: Record<Groove8BarSongCategory, string> = {
  rnb: 'rnb-90s',
  'tb-edition': 'rnb-90s',
  'pop-rock': 'rock',
  kpop: 'dance',
  'southern-soul': 'rnb-70s80s',
  lofi: 'lofi',
  'dance-90s': 'dance',
  horror: 'blues',
  scifi: 'lofi',
  phrygian: 'dance',
  'horror-icon': 'blues',
  general: 'pop',
};

function genreIdFor8BarSongPreset(preset: Groove8BarSongPreset): string {
  if (preset.category) return SONG_BANK_CATEGORY_GENRE[preset.category];
  const label = preset.label.toLowerCase();
  if (/\b(lo[- ]?fi|jazz hop|chill)\b/.test(label)) return 'lofi';
  if (/\b(k-pop|kpop|k-ballad)\b/.test(label)) return 'dance';
  if (/\b(horror|phrygian|evil|halloween|jason|alien)\b/.test(label)) return 'blues';
  if (/\b(dance|club|90s dance|2000s)\b/.test(label)) return 'dance';
  if (/\b(soul|stax|shoals|southern)\b/.test(label)) return 'rnb-70s80s';
  if (/\b(r&b|rnb|neo|ballad|quiet storm|slow jam)\b/.test(label)) return 'rnb-90s';
  if (/\b(rock|arena|power)\b/.test(label)) return 'rock';
  return 'pop';
}

/** BPM + note for an 8-bar song-bank preset (every bank entry resolves a tempo). */
export function resolve8BarSongPresetTempo(preset: Groove8BarSongPreset): ResolvedProgressionTempo {
  const genreId = genreIdFor8BarSongPreset(preset);
  const resolved = resolveProgressionBpm(genreId, { progressionName: preset.label });
  if (preset.bpm == null) return resolved;
  return {
    ...resolved,
    bpm: clampGrooveLabBpm(preset.bpm),
  };
}

export function bpmFor8BarSongPreset(preset: Groove8BarSongPreset): number {
  return resolve8BarSongPresetTempo(preset).bpm;
}

export function format8BarSongPresetLabel(preset: Groove8BarSongPreset): string {
  return `${preset.label} · ${bpmFor8BarSongPreset(preset)} BPM`;
}

/** R&B & soul — full 8-bar phrases (70s · 80s · 90s maj7 / min7 colors). */
export const GROOVE_8BAR_SONG_BANK_RNB: Groove8BarSongPreset[] = [
  {
    id: 'rnb-90s-ballad-8',
    label: '90s ballad · maj9 slow jam',
    kind: 'full8',
    category: 'rnb',
    chords: ['Cmaj9', 'Am9', 'Dm9', 'G7', 'Fmaj9', 'Em7', 'Am7', 'Dm7'],
  },
  {
    id: 'rnb-90s-quiet-8',
    label: '90s quiet storm · I–vi–IV–V',
    kind: 'full8',
    category: 'rnb',
    chords: ['Cmaj7', 'Am7', 'Fmaj7', 'G7', 'Dm7', 'Bbmaj7', 'Am7', 'G7'],
  },
  {
    id: 'rnb-90s-iv-fm-8',
    label: '90s · IV then iv (Fm7)',
    kind: 'full8',
    category: 'rnb',
    chords: ['Cmaj7', 'Am7', 'Fmaj7', 'Fm7', 'Bbmaj7', 'Gm7', 'Fmaj7', 'G7'],
  },
  {
    id: 'rnb-90s-bVII-8',
    label: '90s · bVII (Bb) lift',
    kind: 'full8',
    category: 'rnb',
    chords: ['Cmaj7', 'Am7', 'Dm7', 'G7', 'Bbmaj7', 'Fmaj7', 'Am7', 'G7'],
  },
  {
    id: 'rnb-90s-gospel-8',
    label: '90s gospel R&B · A7 turns',
    kind: 'full8',
    category: 'rnb',
    chords: ['Cmaj7', 'A7', 'Dm7', 'G7', 'Fmaj7', 'Fm7', 'Em7', 'A7'],
  },
  {
    id: 'rnb-90s-group-8',
    label: '90s group · vi–IV with bVII',
    kind: 'full8',
    category: 'rnb',
    chords: ['Cmaj7', 'Am7', 'Fmaj7', 'G7', 'Em7', 'Am7', 'Dm7', 'Bbmaj7'],
  },
  {
    id: 'rnb-90s-neo-bVI-8',
    label: '90s neo · Abmaj7 (bVI) color',
    kind: 'full8',
    category: 'rnb',
    chords: ['Cmaj7', 'Am7', 'Dm7', 'G7', 'Abmaj7', 'Fm7', 'Bbmaj7', 'Ebmaj7'],
  },
  {
    id: 'rnb-90s-harmony-8',
    label: '90s harmony · iii–vi–ii–V',
    kind: 'full8',
    category: 'rnb',
    chords: ['Cmaj7', 'Em7', 'Am7', 'Dm7', 'G7', 'Fmaj7', 'Em7', 'A7'],
  },
  {
    id: 'rnb-90s-keylift-8',
    label: '90s · Bb–Eb lift (modal)',
    kind: 'full8',
    category: 'rnb',
    chords: ['Cmaj7', 'Fmaj7', 'Am7', 'Dm7', 'Bbmaj7', 'Ebmaj7', 'Abmaj7', 'Dm7'],
  },
  {
    id: 'rnb-80s-quiet-8',
    label: '80s quiet storm · maj7 cycle',
    kind: 'full8',
    category: 'rnb',
    chords: ['Cmaj7', 'Am7', 'Fmaj7', 'G7', 'Dm7', 'Bbmaj7', 'Gm7', 'Fmaj7'],
  },
  {
    id: 'rnb-80s-debarge-8',
    label: '80s · I to i (Cm7) shift',
    kind: 'full8',
    category: 'rnb',
    chords: ['Cmaj7', 'Cm7', 'Fmaj7', 'Bbmaj7', 'Ebmaj7', 'Abmaj7', 'Dm7', 'G7'],
  },
  {
    id: 'rnb-80s-heatwave-8',
    label: '80s soul · A7 secondary',
    kind: 'full8',
    category: 'rnb',
    chords: ['Cmaj7', 'A7', 'Dm7', 'G7', 'Fmaj7', 'Em7', 'Am7', 'D7'],
  },
  {
    id: 'rnb-80s-descend-8',
    label: '80s · descending maj7 line',
    kind: 'full8',
    category: 'rnb',
    chords: ['Cmaj7', 'Bm7b5', 'Am7', 'Abmaj7', 'Gmaj7', 'Fmaj7', 'Em7', 'Dm7'],
  },
  {
    id: 'rnb-80s-synth-8',
    label: '80s synth-soul · bVI–bVII',
    kind: 'full8',
    category: 'rnb',
    chords: ['Cmaj7', 'Am7', 'Fmaj7', 'G7', 'Abmaj7', 'Bbmaj7', 'Gm7', 'C7'],
  },
  {
    id: 'rnb-80s-anita-8',
    label: '80s R&B · IV–iv–I turn',
    kind: 'full8',
    category: 'rnb',
    chords: ['Cmaj7', 'Fmaj7', 'Fm7', 'Cmaj7', 'Bbmaj7', 'Gm7', 'Fmaj7', 'G7'],
  },
  {
    id: 'rnb-80s-sade-8',
    label: '80s smooth · min7 walk down',
    kind: 'full8',
    category: 'rnb',
    chords: ['Cmaj7', 'Am7', 'Dm7', 'G7', 'Em7', 'Am7', 'Dm7', 'Gmaj7'],
  },
  {
    id: 'rnb-70s-philly-8',
    label: '70s Philly · I–vi–ii–V + iv',
    kind: 'full8',
    category: 'rnb',
    chords: ['Cmaj7', 'Am7', 'Dm7', 'G7', 'Fmaj7', 'Fm7', 'Em7', 'A7'],
  },
  {
    id: 'rnb-70s-stevie-8',
    label: '70s · E7–Am7 (III7–vi)',
    kind: 'full8',
    category: 'rnb',
    chords: ['Cmaj7', 'E7', 'Am7', 'Dm7', 'G7', 'Cmaj7', 'Fmaj7', 'G7'],
  },
  {
    id: 'rnb-70s-ewf-8',
    label: '70s · Earth Wind colors',
    kind: 'full8',
    category: 'rnb',
    chords: ['Cmaj7', 'Fmaj7', 'Am7', 'Dm7', 'Bbmaj7', 'Gm7', 'Am7', 'Fmaj7'],
  },
  {
    id: 'rnb-70s-marvin-8',
    label: '70s Marvin · IV–bVII–III7',
    kind: 'full8',
    category: 'rnb',
    chords: ['Cmaj7', 'Fmaj7', 'Bbmaj7', 'Ebmaj7', 'Abmaj7', 'Dm7', 'G7', 'Cmaj7'],
  },
  {
    id: 'rnb-70s-chic-8',
    label: '70s disco-soul · IV–V–iii–vi',
    kind: 'full8',
    category: 'rnb',
    chords: ['Cmaj7', 'Fmaj7', 'G7', 'Em7', 'Am7', 'Dm7', 'G7', 'Cmaj7'],
  },
  {
    id: 'rnb-70s-cm7-8',
    label: '70s minor gospel · Cm7 cycle',
    kind: 'full8',
    category: 'rnb',
    chords: ['Cm7', 'Fm7', 'Bbmaj7', 'Ebmaj7', 'Abmaj7', 'Dm7b5', 'G7', 'Cm7'],
  },
  {
    id: 'rnb-70s-isis-8',
    label: '70s soul · bIII–bVI maj7',
    kind: 'full8',
    category: 'rnb',
    chords: ['Cmaj7', 'Ebmaj7', 'Abmaj7', 'Dm7', 'G7', 'Cmaj7', 'Fmaj7', 'Fm7'],
  },
  {
    id: 'neo-fall-8',
    label: 'Neo soul · maj7 line down',
    kind: 'full8',
    category: 'rnb',
    chords: ['Cmaj7', 'Bm7b5', 'Am7', 'Abmaj7', 'G7', 'Fmaj7', 'Em7', 'Dm7'],
  },
  {
    id: 'rnb-line-8',
    label: 'R&B line · maj7 + secondary dominants',
    kind: 'full8',
    category: 'rnb',
    chords: ['Cmaj7', 'A7', 'Dm7', 'G7', 'Fmaj7', 'Em7', 'Am7', 'D7'],
  },
  {
    id: 'soul-turn-8',
    label: 'Soul · Imaj7–vi–ii–V + Fm turn',
    kind: 'full8',
    category: 'rnb',
    chords: ['Cmaj7', 'Am7', 'Dm7', 'G7', 'Fmaj7', 'Fm', 'C', 'G7'],
  },
];

/** T&B Edition — 90s new jack + quiet storm R&B harmony (inspired, no artist names). */
export const GROOVE_8BAR_SONG_BANK_TB_EDITION: Groove8BarSongPreset[] = [
  {
    id: 'tb-slowjam-e7vi-8',
    label: 'T&B · Slow jam · E7–vi',
    kind: 'full8',
    category: 'tb-edition',
    bpm: 68,
    chords: ['Cmaj7', 'E7', 'Am7', 'Dm7', 'G7', 'Fmaj7', 'Fm7', 'Bbmaj7'],
  },
  {
    id: 'tb-ballad-iv-turn-8',
    label: 'T&B · Ballad · iv turn',
    kind: 'full8',
    category: 'tb-edition',
    bpm: 64,
    chords: ['Cmaj7', 'Am7', 'Dm7', 'G7', 'Cmaj7', 'Fmaj7', 'Fm7', 'Cmaj7'],
  },
  {
    id: 'tb-iii7-lift-8',
    label: 'T&B · III7 lift · vi color',
    kind: 'full8',
    category: 'tb-edition',
    bpm: 70,
    chords: ['Cmaj7', 'E7', 'Am7', 'Fmaj7', 'Dm7', 'G7', 'Em7', 'A7'],
  },
  {
    id: 'tb-newjack-iiv-8',
    label: 'T&B · New jack · ii–V swing',
    kind: 'full8',
    category: 'tb-edition',
    bpm: 102,
    chords: ['Am7', 'Dm7', 'G7', 'Cmaj7', 'Fmaj7', 'Dm7', 'G7', 'G13'],
  },
  {
    id: 'tb-bvii-stack-8',
    label: 'T&B · Group harmony · bVII stack',
    kind: 'full8',
    category: 'tb-edition',
    bpm: 94,
    chords: ['Cmaj7', 'Am7', 'Dm7', 'G7', 'Bbmaj7', 'Gm7', 'Fmaj7', 'G7'],
  },
  {
    id: 'tb-a7-iiv-8',
    label: 'T&B · Slick ii–V · A7 turn',
    kind: 'full8',
    category: 'tb-edition',
    bpm: 88,
    chords: ['Cmaj7', 'A7', 'Dm7', 'G7', 'Cmaj7', 'Fmaj7', 'Em7', 'A7'],
  },
  {
    id: 'tb-d7-turn-8',
    label: 'T&B · Upbeat swing · D7 turn',
    kind: 'full8',
    category: 'tb-edition',
    bpm: 100,
    chords: ['Cmaj7', 'Fmaj7', 'Dm7', 'G7', 'Em7', 'Am7', 'D7', 'G7'],
  },
  {
    id: 'tb-quiet-storm-maj9-8',
    label: 'T&B · Quiet storm · maj9 line',
    kind: 'full8',
    category: 'tb-edition',
    bpm: 72,
    chords: ['Cmaj9', 'Am9', 'Dm9', 'G13', 'Fmaj9', 'Em7', 'Am7', 'Dm7'],
  },
  {
    id: 'tb-secondary-climb-8',
    label: 'T&B · Secondary climb · D7–G7',
    kind: 'full8',
    category: 'tb-edition',
    bpm: 96,
    chords: ['Cmaj7', 'D7', 'G7', 'Cmaj7', 'A7', 'Dm7', 'G7', 'E7'],
  },
  {
    id: 'tb-iv-ballad-8',
    label: 'T&B · Ballad · iv–bVI–bII',
    kind: 'full8',
    category: 'tb-edition',
    bpm: 66,
    chords: ['Cmaj7', 'Am7', 'Fmaj7', 'G7', 'Fm7', 'Abmaj7', 'Ebmaj7', 'Dm7'],
  },
  {
    id: 'tb-newjack-bVII-8',
    label: 'T&B · New jack · bVII lift',
    kind: 'full8',
    category: 'tb-edition',
    bpm: 104,
    chords: ['Cmaj7', 'Am7', 'Dm7', 'G7', 'Bbmaj7', 'Fmaj7', 'Am7', 'G7'],
  },
  {
    id: 'tb-turnaround-8',
    label: 'T&B · Turnaround · iiø–V–vi',
    kind: 'full8',
    category: 'tb-edition',
    bpm: 90,
    chords: ['Cmaj7', 'E7', 'Am7', 'Dm7', 'Bm7b5', 'E7', 'Am7', 'D7'],
  },
];

/** Pop / rock power ballads — arena, acoustic, post-grunge colors. */
export const GROOVE_8BAR_SONG_BANK_POP_ROCK: Groove8BarSongPreset[] = [
  {
    id: 'pop-rock-journey-8',
    label: 'Pop rock · I–V–vi–IV journey',
    kind: 'full8',
    category: 'pop-rock',
    chords: ['C', 'G', 'Am', 'F', 'C', 'Am', 'F', 'G'],
  },
  {
    id: 'pop-rock-power-8',
    label: 'Power ballad · vi–IV–I–V arc',
    kind: 'full8',
    category: 'pop-rock',
    chords: ['Am', 'F', 'C', 'G', 'F', 'C', 'G', 'Am'],
  },
  {
    id: 'pop-rock-sus-8',
    label: 'Rock ballad · sus4 lifts',
    kind: 'full8',
    category: 'pop-rock',
    chords: ['C', 'Csus4', 'C', 'G', 'Am', 'F', 'Gsus4', 'G'],
  },
  {
    id: 'pop-rock-bVII-8',
    label: 'Classic rock · bVII (Bb) color',
    kind: 'full8',
    category: 'pop-rock',
    chords: ['C', 'Bb', 'F', 'C', 'Am', 'Bb', 'F', 'G'],
  },
  {
    id: 'pop-rock-acoustic-8',
    label: 'Acoustic rock · add9 / maj7',
    kind: 'full8',
    category: 'pop-rock',
    chords: ['Cadd9', 'Am7', 'Fmaj7', 'G', 'Em7', 'Am7', 'Dm7', 'G'],
  },
  {
    id: 'pop-rock-arena-8',
    label: 'Arena · IV–V turnaround',
    kind: 'full8',
    category: 'pop-rock',
    chords: ['C', 'G', 'Am', 'F', 'Dm', 'F', 'G', 'C'],
  },
  {
    id: 'pop-rock-unplugged-8',
    label: 'Unplugged · vi–iii–IV walk',
    kind: 'full8',
    category: 'pop-rock',
    chords: ['C', 'Am', 'Em', 'F', 'C', 'G', 'Am', 'F'],
  },
  {
    id: 'pop-rock-emo-8',
    label: 'Emo rock · vi–V–IV–V cycle',
    kind: 'full8',
    category: 'pop-rock',
    chords: ['Am', 'G', 'F', 'G', 'Am', 'F', 'C', 'G'],
  },
];

/** K-pop / K-ballad — emotional chorus loops + borrowed maj7 lifts. */
export const GROOVE_8BAR_SONG_BANK_KPOP: Groove8BarSongPreset[] = [
  {
    id: 'kpop-ballad-8',
    label: 'K-ballad · maj7 slow chorus',
    kind: 'full8',
    category: 'kpop',
    chords: ['Cmaj7', 'Am7', 'Fmaj7', 'G7', 'Dm7', 'G7', 'Em7', 'Am7'],
  },
  {
    id: 'kpop-sensitive-8',
    label: 'K-pop · vi–IV–I–V (sensitive)',
    kind: 'full8',
    category: 'kpop',
    chords: ['Am7', 'Fmaj7', 'Cmaj7', 'G7', 'Fmaj7', 'G7', 'Em7', 'Am7'],
  },
  {
    id: 'kpop-lift-8',
    label: 'K-pop · bVI–bVII lift (Ab–Bb)',
    kind: 'full8',
    category: 'kpop',
    chords: ['Cmaj7', 'Am7', 'Fmaj7', 'G7', 'Abmaj7', 'Bbmaj7', 'Fmaj7', 'G7'],
  },
  {
    id: 'kpop-drama-8',
    label: 'K-drama · vi with E7 turn',
    kind: 'full8',
    category: 'kpop',
    chords: ['Am7', 'G', 'F', 'E7', 'Am7', 'Dm7', 'G7', 'Cmaj7'],
  },
  {
    id: 'kpop-boygroup-8',
    label: 'Boy group · iii–vi–IV–V',
    kind: 'full8',
    category: 'kpop',
    chords: ['Cmaj7', 'Em7', 'Am7', 'Fmaj7', 'Dm7', 'G7', 'Em7', 'A7'],
  },
  {
    id: 'kpop-girlgroup-8',
    label: 'Girl group · IV–V–iii–vi',
    kind: 'full8',
    category: 'kpop',
    chords: ['Fmaj7', 'G7', 'Em7', 'Am7', 'Dm7', 'Bbmaj7', 'Fmaj7', 'G7'],
  },
  {
    id: 'kpop-anthem-8',
    label: 'K-pop anthem · axis + tag',
    kind: 'full8',
    category: 'kpop',
    chords: ['C', 'G', 'Am', 'F', 'Em', 'Am', 'Dm7', 'G7'],
  },
  {
    id: 'kpop-bridge-8',
    label: 'K-ballad bridge · ii–V–I–vi',
    kind: 'full8',
    category: 'kpop',
    chords: ['Dm7', 'G7', 'Cmaj7', 'Am7', 'Fmaj7', 'Em7', 'A7', 'Dm7'],
  },
];

/** Southern soul — Memphis / Muscle Shoals / Stax dominant-7 vocabulary. */
export const GROOVE_8BAR_SONG_BANK_SOUTHERN_SOUL: Groove8BarSongPreset[] = [
  {
    id: 'south-stax-8',
    label: 'Stax · I7–IV7–turnaround',
    kind: 'full8',
    category: 'southern-soul',
    chords: ['C7', 'F7', 'C7', 'G7', 'F7', 'Fm7', 'C7', 'G7'],
  },
  {
    id: 'south-shoals-8',
    label: 'Muscle Shoals · maj7 + A7',
    kind: 'full8',
    category: 'southern-soul',
    chords: ['Cmaj7', 'Fmaj7', 'Dm7', 'G7', 'Cmaj7', 'A7', 'Dm7', 'G7'],
  },
  {
    id: 'south-memphis-8',
    label: 'Memphis · bluesy 8-bar',
    kind: 'full8',
    category: 'southern-soul',
    chords: ['C7', 'C7', 'F7', 'F7', 'C7', 'A7', 'Dm7', 'G7'],
  },
  {
    id: 'south-al-green-8',
    label: 'Southern gospel-soul · E7–Am7',
    kind: 'full8',
    category: 'southern-soul',
    chords: ['Cmaj7', 'E7', 'Am7', 'Dm7', 'G7', 'Cmaj7', 'Fmaj7', 'G7'],
  },
  {
    id: 'south-bb-blues-8',
    label: 'Deep south · Eb7 color',
    kind: 'full8',
    category: 'southern-soul',
    chords: ['C7', 'Eb7', 'F7', 'C7', 'F7', 'Fm7', 'C7', 'G7'],
  },
  {
    id: 'south-organ-8',
    label: 'Church organ soul · I7–IV7 vamp',
    kind: 'full8',
    category: 'southern-soul',
    chords: ['C7', 'F7', 'C7', 'G7', 'Am7', 'Dm7', 'G7', 'C7'],
  },
  {
    id: 'south-otis-8',
    label: 'Otis walk · I–IV–I–V',
    kind: 'full8',
    category: 'southern-soul',
    chords: ['C', 'F', 'C', 'G', 'Am', 'Dm', 'G', 'C'],
  },
  {
    id: 'south-gospel-walk-8',
    label: 'Gospel south · I–IV–vi–IV',
    kind: 'full8',
    category: 'southern-soul',
    chords: ['C', 'F', 'Am', 'F', 'C', 'G', 'Dm', 'G'],
  },
];

/** Lo-fi / jazz-hop — mellow m7 loops and borrowed maj7 pads. */
export const GROOVE_8BAR_SONG_BANK_LOFI: Groove8BarSongPreset[] = [
  {
    id: 'lofi-study-8',
    label: 'Lo-fi study · ii–V–Imaj7 loop',
    kind: 'full8',
    category: 'lofi',
    chords: ['Cmaj7', 'Am7', 'Dm7', 'G7', 'Cmaj7', 'Am7', 'Fmaj7', 'G7'],
  },
  {
    id: 'lofi-rain-8',
    label: 'Rainy window · Am7 cycle',
    kind: 'full8',
    category: 'lofi',
    chords: ['Am7', 'Dm7', 'G7', 'Cmaj7', 'Fmaj7', 'Em7', 'Am7', 'Dm7'],
  },
  {
    id: 'lofi-nujabes-8',
    label: 'Jazz-hop · Dm7–G7–Cmaj7',
    kind: 'full8',
    category: 'lofi',
    chords: ['Dm7', 'G7', 'Cmaj7', 'Am7', 'Dm7', 'G7', 'Em7', 'Am7'],
  },
  {
    id: 'lofi-vamp-8',
    label: 'Chill vamp · Imaj7–vi7 hold',
    kind: 'full8',
    category: 'lofi',
    chords: ['Cmaj7', 'Cmaj7', 'Am7', 'Am7', 'Dm7', 'G7', 'Em7', 'Am7'],
  },
  {
    id: 'lofi-jazzhop-8',
    label: 'Jazz-hop · maj9 / 13 colors',
    kind: 'full8',
    category: 'lofi',
    chords: ['Cmaj9', 'Am9', 'Dm9', 'G13', 'Cmaj7', 'A7', 'Dm7', 'G7'],
  },
  {
    id: 'lofi-dusk-8',
    label: 'Dusk · IV–iii–ii–V fall',
    kind: 'full8',
    category: 'lofi',
    chords: ['Fmaj7', 'Em7', 'Am7', 'Dm7', 'G7', 'Cmaj7', 'Am7', 'Dm7'],
  },
  {
    id: 'lofi-borrowed-8',
    label: 'Lo-fi · Abmaj7 modal pad',
    kind: 'full8',
    category: 'lofi',
    chords: ['Cmaj7', 'Abmaj7', 'Fm7', 'G7', 'Bbmaj7', 'Ebmaj7', 'Abmaj7', 'G7'],
  },
  {
    id: 'lofi-loop-8',
    label: 'Tape loop · vi–IV–I–V soft',
    kind: 'full8',
    category: 'lofi',
    chords: ['Am7', 'Fmaj7', 'Cmaj7', 'G7', 'Am7', 'Dm7', 'G7', 'Cmaj7'],
  },
];

/** 90s / early-2000s dance — house, euro, trance-pop, chart club loops. */
export const GROOVE_8BAR_SONG_BANK_DANCE_90S: Groove8BarSongPreset[] = [
  {
    id: 'dance-house-pluck-8',
    label: 'House pluck · Am–G–F–Em',
    kind: 'full8',
    category: 'dance-90s',
    chords: ['Am7', 'G', 'F', 'Em', 'Am7', 'G', 'F', 'G'],
  },
  {
    id: 'dance-euro-anthem-8',
    label: 'Euro dance · I–V–vi–IV anthem',
    kind: 'full8',
    category: 'dance-90s',
    chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F'],
  },
  {
    id: 'dance-club-solid-8',
    label: 'Club solid · vi–V–IV–V',
    kind: 'full8',
    category: 'dance-90s',
    chords: ['Am', 'G', 'F', 'G', 'Am', 'G', 'F', 'Em'],
  },
  {
    id: 'dance-trance-pop-8',
    label: 'Trance-pop · build with E7',
    kind: 'full8',
    category: 'dance-90s',
    chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'Dm', 'E7'],
  },
  {
    id: 'dance-filter-house-8',
    label: 'Filter house · Am7 / Fmaj7 vamp',
    kind: 'full8',
    category: 'dance-90s',
    chords: ['Am7', 'Am7', 'Fmaj7', 'Fmaj7', 'C', 'G', 'Am7', 'Am7'],
  },
  {
    id: 'dance-euro-minor-8',
    label: 'Eurodance minor · Am pedal',
    kind: 'full8',
    category: 'dance-90s',
    chords: ['Am', 'G', 'F', 'G', 'Am', 'G', 'F', 'E'],
  },
  {
    id: 'dance-pop2000-8',
    label: '2000s pop-dance · maj7 lift',
    kind: 'full8',
    category: 'dance-90s',
    chords: ['Cmaj7', 'G', 'Am7', 'F', 'Dm7', 'G', 'C', 'G'],
  },
  {
    id: 'dance-garage-8',
    label: 'UK garage · ii–V–I in C',
    kind: 'full8',
    category: 'dance-90s',
    chords: ['Am7', 'Dm7', 'G7', 'Cmaj7', 'Fmaj7', 'Dm7', 'E7', 'Am7'],
  },
  {
    id: 'dance-hands-up-8',
    label: 'Hands-up · IV–I–V–vi',
    kind: 'full8',
    category: 'dance-90s',
    chords: ['F', 'C', 'G', 'Am', 'F', 'C', 'G', 'G'],
  },
  {
    id: 'dance-chart-build-8',
    label: 'Chart build · vi–IV with E7 tag',
    kind: 'full8',
    category: 'dance-90s',
    chords: ['Am', 'F', 'C', 'G', 'F', 'C', 'Dm', 'E7'],
  },
  {
    id: 'dance-disco-house-8',
    label: 'Disco-house · Am7–Dm7–G7',
    kind: 'full8',
    category: 'dance-90s',
    chords: ['Am7', 'Dm7', 'G7', 'C', 'Am7', 'Dm7', 'G7', 'G'],
  },
  {
    id: 'dance-superclub-8',
    label: 'Superclub · bVII (Bb) drop',
    kind: 'full8',
    category: 'dance-90s',
    chords: ['Am', 'F', 'C', 'G', 'Bb', 'F', 'C', 'G'],
  },
];

/** Horror cinema — dark minor, Phrygian, dim / half-dim tension. */
export const GROOVE_8BAR_SONG_BANK_HORROR: Groove8BarSongPreset[] = [
  {
    id: 'horror-carpenter-8',
    label: 'Synth horror · Am–F–E stalk',
    kind: 'full8',
    category: 'horror',
    chords: ['Am', 'Am', 'F', 'E', 'Am', 'G', 'F', 'E'],
  },
  {
    id: 'horror-phrygian-8',
    label: 'Phrygian dread · bII (Bb)',
    kind: 'full8',
    category: 'horror',
    chords: ['Am', 'Bb', 'Am', 'E', 'Am', 'F', 'E', 'Am'],
  },
  {
    id: 'horror-andalusian-8',
    label: 'Andalusian creep · Am–G–F–E',
    kind: 'full8',
    category: 'horror',
    chords: ['Am', 'G', 'F', 'E', 'Am', 'G', 'F', 'E'],
  },
  {
    id: 'horror-gothic-8',
    label: 'Gothic hall · Am–C–Dm',
    kind: 'full8',
    category: 'horror',
    chords: ['Am', 'C', 'Dm', 'Am', 'F', 'E7', 'Am', 'Am'],
  },
  {
    id: 'horror-dim-8',
    label: 'Diminished stalk · Bdim turns',
    kind: 'full8',
    category: 'horror',
    chords: ['Am', 'Bdim', 'Am', 'E7', 'Am', 'F', 'Bdim', 'E7'],
  },
  {
    id: 'horror-halfdim-8',
    label: 'Thriller · Bm7b5–E7',
    kind: 'full8',
    category: 'horror',
    chords: ['Am', 'Bm7b5', 'E7', 'Am', 'Dm', 'Bm7b5', 'E7', 'Am'],
  },
  {
    id: 'horror-lurker-8',
    label: 'Chromatics · Ab descent',
    kind: 'full8',
    category: 'horror',
    chords: ['Am', 'Ab', 'G', 'F', 'E', 'F', 'G', 'Am'],
  },
  {
    id: 'horror-jump-8',
    label: 'Jump scare · E7 hit',
    kind: 'full8',
    category: 'horror',
    chords: ['Am', 'F', 'Dm', 'E7', 'Am', 'Bdim', 'E7', 'Am'],
  },
  {
    id: 'horror-fog-8',
    label: 'Fog bank · m7 to E7',
    kind: 'full8',
    category: 'horror',
    chords: ['Am7', 'Fmaj7', 'Em7', 'E7', 'Am7', 'Dm7', 'Bm7b5', 'E7'],
  },
  {
    id: 'horror-ritual-8',
    label: 'Ritual minor · Dm–E pedal',
    kind: 'full8',
    category: 'horror',
    chords: ['Am', 'F', 'Dm', 'E', 'Am', 'C', 'Dm', 'E7'],
  },
];

/** Sci-fi cinema — ethereal maj7, modal pads, dystopian minor. */
export const GROOVE_8BAR_SONG_BANK_SCIFI: Groove8BarSongPreset[] = [
  {
    id: 'scifi-blade-8',
    label: 'Neo-noir · Am9–Fmaj7 pad',
    kind: 'full8',
    category: 'scifi',
    chords: ['Am9', 'Fmaj7', 'Cmaj7', 'G', 'Am7', 'Fmaj7', 'C', 'G'],
  },
  {
    id: 'scifi-vangelis-8',
    label: 'Analog score · Dm7–Bbmaj7',
    kind: 'full8',
    category: 'scifi',
    chords: ['Dm7', 'Bbmaj7', 'Fmaj7', 'Cmaj7', 'Dm7', 'Gm7', 'Am7', 'A7'],
  },
  {
    id: 'scifi-void-8',
    label: 'Deep void · bVI Eb color',
    kind: 'full8',
    category: 'scifi',
    chords: ['Am', 'F', 'C', 'G', 'Am', 'Eb', 'Bb', 'F'],
  },
  {
    id: 'scifi-tron-8',
    label: 'Synth grid · Fsus4 lift',
    kind: 'full8',
    category: 'scifi',
    chords: ['Am', 'G', 'F', 'E', 'Am', 'G', 'Fsus4', 'E'],
  },
  {
    id: 'scifi-alien-8',
    label: 'Alien tension · Ab–Bb clash',
    kind: 'full8',
    category: 'scifi',
    chords: ['Am', 'Ab', 'Bb', 'C', 'Am', 'F', 'G', 'Am'],
  },
  {
    id: 'scifi-interstellar-8',
    label: 'Cosmic swell · vi–IV build',
    kind: 'full8',
    category: 'scifi',
    chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'Dm', 'E7'],
  },
  {
    id: 'scifi-arpeggio-8',
    label: 'Arp bed · Am7–Em7–Fmaj7',
    kind: 'full8',
    category: 'scifi',
    chords: ['Am7', 'Em7', 'Fmaj7', 'Cmaj7', 'Dm7', 'Am7', 'Fmaj7', 'G'],
  },
  {
    id: 'scifi-outer-8',
    label: 'Outer space · Csus2 open',
    kind: 'full8',
    category: 'scifi',
    chords: ['Csus2', 'Am', 'Fmaj7', 'G', 'Csus2', 'Am', 'Dm7', 'G'],
  },
  {
    id: 'scifi-dystopia-8',
    label: 'Dystopia · Am–C–Dm hold',
    kind: 'full8',
    category: 'scifi',
    chords: ['Am', 'C', 'Dm', 'Am', 'F', 'E7', 'Am', 'Bm7b5'],
  },
  {
    id: 'scifi-warp-8',
    label: 'Warp drive · maj7–6 shimmer',
    kind: 'full8',
    category: 'scifi',
    chords: ['Fmaj7', 'G6', 'Em7', 'Am7', 'Dm7', 'G7', 'Cmaj7', 'Bm7b5'],
  },
];

/**
 * Phrygian / evil cinematic — **4 bars**, one chord per bar.
 * House & dance producers chop these slow pads/stabs (bII · Andalusian · chromatic).
 */
export const GROOVE_4BAR_PHRYGIAN_CINEMATIC: Groove8BarSongPreset[] = [
  {
    id: 'phryg-andalusian-4',
    label: 'Andalusian · Am–G–F–E (chop classic)',
    kind: 'full4',
    category: 'phrygian',
    chords: ['Am', 'G', 'F', 'E'],
  },
  {
    id: 'phryg-cinematic-4',
    label: 'Cinematic evil · Am–Bb–F–E',
    kind: 'full4',
    category: 'phrygian',
    chords: ['Am', 'Bb', 'F', 'E'],
  },
  {
    id: 'phryg-bII-4',
    label: 'Phrygian bII · Am–Bb–G–Am',
    kind: 'full4',
    category: 'phrygian',
    chords: ['Am', 'Bb', 'G', 'Am'],
  },
  {
    id: 'phryg-stab-4',
    label: 'Evil stab · Am–Bb vamp',
    kind: 'full4',
    category: 'phrygian',
    chords: ['Am', 'Bb', 'Am', 'Bb'],
  },
  {
    id: 'phryg-chromatic-4',
    label: 'Dark slide · Am–Ab–G–F',
    kind: 'full4',
    category: 'phrygian',
    chords: ['Am', 'Ab', 'G', 'F'],
  },
  {
    id: 'phryg-house-pad-4',
    label: 'Slow house pad · Am7–Bbmaj7',
    kind: 'full4',
    category: 'phrygian',
    chords: ['Am7', 'Bbmaj7', 'Am7', 'G7'],
  },
  {
    id: 'phryg-walk-4',
    label: 'Phrygian walk · Am–Bb–C–G',
    kind: 'full4',
    category: 'phrygian',
    chords: ['Am', 'Bb', 'C', 'G'],
  },
  {
    id: 'phryg-d-phrygian-4',
    label: 'D Phrygian · Dm–Eb–F–Dm',
    kind: 'full4',
    category: 'phrygian',
    chords: ['Dm', 'Eb', 'F', 'Dm'],
  },
  {
    id: 'phryg-dim-hit-4',
    label: 'Dim stab · Am–Bdim–Bb–E7',
    kind: 'full4',
    category: 'phrygian',
    chords: ['Am', 'Bdim', 'Bb', 'E7'],
  },
  {
    id: 'phryg-modal-4',
    label: 'Modal evil · Am–C–Bb–Am',
    kind: 'full4',
    category: 'phrygian',
    chords: ['Am', 'C', 'Bb', 'Am'],
  },
  {
    id: 'phryg-tritone-4',
    label: 'Tritone fog · Am–Bb–Eb–Ab',
    kind: 'full4',
    category: 'phrygian',
    chords: ['Am', 'Bb', 'Eb', 'Ab'],
  },
  {
    id: 'phryg-suspense-4',
    label: 'Suspense drop · Am–Bb–G–F',
    kind: 'full4',
    category: 'phrygian',
    chords: ['Am', 'Bb', 'G', 'F'],
  },
  {
    id: 'phryg-techno-4',
    label: 'Dark techno · Am–Bb–Am–G',
    kind: 'full4',
    category: 'phrygian',
    chords: ['Am', 'Bb', 'Am', 'G'],
  },
  {
    id: 'phryg-spanish-4',
    label: 'Spanish evil · Am–F–E–Am',
    kind: 'full4',
    category: 'phrygian',
    chords: ['Am', 'F', 'E', 'Am'],
  },
];

/**
 * Horror icon holds — 4-bar cinematic pads (Halloween · slasher · Alien).
 * Slow one-chord-per-bar cards for sustain, chop, or stinger on bar 4.
 */
export const GROOVE_4BAR_HORROR_ICONS: Groove8BarSongPreset[] = [
  {
    id: 'icon-halloween-4',
    label: 'Halloween · Myers piano stalk',
    kind: 'full4',
    category: 'horror-icon',
    chords: ['Am', 'G', 'F', 'G'],
  },
  {
    id: 'icon-friday-jason-4',
    label: 'Friday the 13th · Jason camp hold',
    kind: 'full4',
    category: 'horror-icon',
    chords: ['Am', 'Am', 'F', 'E'],
  },
  {
    id: 'icon-crystal-lake-4',
    label: 'Crystal Lake · woods chase',
    kind: 'full4',
    category: 'horror-icon',
    chords: ['Am', 'F', 'Dm', 'E'],
  },
  {
    id: 'icon-mask-sting-4',
    label: 'Slasher · mask pedal → E7 sting',
    kind: 'full4',
    category: 'horror-icon',
    chords: ['Am', 'Am', 'Am', 'E7'],
  },
  {
    id: 'icon-alien-nostromo-4',
    label: 'Alien · Nostromo void',
    kind: 'full4',
    category: 'horror-icon',
    chords: ['Am', 'Ab', 'Bb', 'Am'],
  },
  {
    id: 'icon-alien-airlock-4',
    label: 'Alien · airlock dread',
    kind: 'full4',
    category: 'horror-icon',
    chords: ['Dm', 'Bb', 'Ab', 'G'],
  },
  {
    id: 'icon-ripley-4',
    label: 'Alien · escape stinger',
    kind: 'full4',
    category: 'horror-icon',
    chords: ['Am', 'C', 'Bdim', 'E7'],
  },
  {
    id: 'icon-final-chase-4',
    label: 'Final girl · Andalusian run',
    kind: 'full4',
    category: 'horror-icon',
    chords: ['Am', 'G', 'F', 'E'],
  },
];

/** Pop, rock, jazz & other full 8-bar phrases. */
export const GROOVE_8BAR_SONG_BANK_GENERAL: Groove8BarSongPreset[] = [
  {
    id: 'diatonic-climb-8',
    label: 'Diatonic climb · C up the scale',
    kind: 'full8',
    category: 'general',
    chords: ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim', 'C'],
  },
  {
    id: 'pop-journey-8',
    label: 'Pop journey · I–V–vi–IV + walk back',
    kind: 'full8',
    category: 'general',
    chords: ['C', 'G', 'Am', 'F', 'Dm', 'Em', 'G', 'C'],
  },
  {
    id: 'ballad-arc-8',
    label: 'Ballad arc · I–vi–IV–V then turn',
    kind: 'full8',
    category: 'general',
    chords: ['C', 'Am', 'F', 'G', 'Em', 'Am', 'Dm', 'G'],
  },
  {
    id: 'beatles-turn-8',
    label: 'Classic turn · I / Imaj7 / IV / V',
    kind: 'full8',
    category: 'general',
    chords: ['C', 'Cmaj7', 'F', 'G', 'C', 'Am', 'Dm', 'G'],
  },
  {
    id: 'rock-bVII-8',
    label: 'Rock · I–bVII–IV + vi–ii–V',
    kind: 'full8',
    category: 'general',
    chords: ['C', 'Bb', 'F', 'G', 'Am', 'Dm', 'G', 'C'],
  },
  {
    id: 'minor-wave-8',
    label: 'Minor wave · vi descent + V',
    kind: 'full8',
    category: 'general',
    chords: ['Am', 'G', 'F', 'Em', 'Dm', 'C', 'Bdim', 'E7'],
  },
  {
    id: 'andalusian-8',
    label: 'Andalusian · vi–V–IV–iii–ii–I–V–vi',
    kind: 'full8',
    category: 'general',
    chords: ['Am', 'G', 'F', 'Em', 'Dm', 'C', 'G', 'Am'],
  },
  {
    id: 'jazz-std-8',
    label: 'Jazz standard · I–III7–vi–bVI7–V',
    kind: 'full8',
    category: 'general',
    chords: ['Cmaj7', 'E7', 'Am7', 'Abmaj7', 'G7', 'Fmaj7', 'Em7', 'A7'],
  },
  {
    id: 'rhythm-a-8',
    label: 'Rhythm changes · A section (8 bars)',
    kind: 'full8',
    category: 'general',
    chords: ['Cmaj7', 'Am7', 'Dm7', 'G7', 'Em7', 'A7', 'Dm7', 'G7'],
  },
  {
    id: 'gospel-walk-8',
    label: 'Gospel walk · I–IV–vi–IV–I–V–ii–V',
    kind: 'full8',
    category: 'general',
    chords: ['C', 'F', 'Am', 'F', 'C', 'G', 'Dm', 'G'],
  },
  {
    id: 'house-pluck-8',
    label: 'House · vi–V–IV–iii–ii–IV–V–vi',
    kind: 'full8',
    category: 'general',
    chords: ['Am', 'G', 'F', 'Em', 'Dm', 'F', 'G', 'Am'],
  },
  {
    id: 'blues-8',
    label: 'Blues · classic 8-bar changes',
    kind: 'full8',
    category: 'general',
    chords: ['C7', 'C7', 'C7', 'C7', 'F7', 'F7', 'C7', 'G7'],
  },
];

/** Eight-bar phrases with eight harmonic steps (not a 4-chord loop copied twice). */
export const GROOVE_8BAR_SONG_BANK_FULL: Groove8BarSongPreset[] = [
  ...GROOVE_8BAR_SONG_BANK_RNB,
  ...GROOVE_8BAR_SONG_BANK_TB_EDITION,
  ...GROOVE_8BAR_SONG_BANK_POP_ROCK,
  ...GROOVE_8BAR_SONG_BANK_KPOP,
  ...GROOVE_8BAR_SONG_BANK_SOUTHERN_SOUL,
  ...GROOVE_8BAR_SONG_BANK_LOFI,
  ...GROOVE_8BAR_SONG_BANK_DANCE_90S,
  ...GROOVE_8BAR_SONG_BANK_HORROR,
  ...GROOVE_8BAR_SONG_BANK_SCIFI,
  ...GROOVE_8BAR_SONG_BANK_GENERAL,
];

/** Familiar four-chord loops repeated for eight bars (use PACK → 8 BARS for genre packs). */
export const GROOVE_8BAR_SONG_BANK_LOOP: Groove8BarSongPreset[] = [
  {
    id: 'pop-8',
    label: 'Pop · C–G–Am–F ×2',
    kind: 'loop4x2',
    chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F'],
  },
  {
    id: '50s-8',
    label: '50s · C–Am–F–G ×2',
    kind: 'loop4x2',
    chords: ['C', 'Am', 'F', 'G', 'C', 'Am', 'F', 'G'],
  },
  {
    id: 'vi-iv-8',
    label: 'vi–IV–I–V ×2 (Am)',
    kind: 'loop4x2',
    chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G'],
  },
  {
    id: 'rnb-8',
    label: 'R&B · maj7 loop ×2',
    kind: 'loop4x2',
    chords: ['Cmaj7', 'Am7', 'Dm7', 'G7', 'Cmaj7', 'Am7', 'Dm7', 'G7'],
  },
  {
    id: 'soul-8',
    label: 'Soul · I–vi–IV–V ×2',
    kind: 'loop4x2',
    chords: ['Cmaj7', 'Am7', 'Fmaj7', 'G7', 'Cmaj7', 'Am7', 'Fmaj7', 'G7'],
  },
  {
    id: 'jazz-8',
    label: 'Jazz · ii–V–I–vi ×2',
    kind: 'loop4x2',
    chords: ['Dm7', 'G7', 'Cmaj7', 'Am7', 'Dm7', 'G7', 'Cmaj7', 'Am7'],
  },
  {
    id: 'doo-wop-8',
    label: 'Doo-wop · I–vi–IV–V ×2',
    kind: 'loop4x2',
    chords: ['C', 'Am', 'F', 'G', 'C', 'Am', 'F', 'G'],
  },
  {
    id: 'dance-house-loop-8',
    label: 'House · Am–G–F–Em ×2',
    kind: 'loop4x2',
    chords: ['Am7', 'G', 'F', 'Em', 'Am7', 'G', 'F', 'Em'],
  },
  {
    id: 'dance-euro-loop-8',
    label: 'Euro club · Am–G–F–G ×2',
    kind: 'loop4x2',
    chords: ['Am', 'G', 'F', 'G', 'Am', 'G', 'F', 'G'],
  },
  {
    id: 'dance-anthem-loop-8',
    label: 'Dance anthem · C–G–Am–F ×2',
    kind: 'loop4x2',
    chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F'],
  },
  {
    id: 'horror-andalusian-loop-8',
    label: 'Horror · Am–G–F–E ×2',
    kind: 'loop4x2',
    chords: ['Am', 'G', 'F', 'E', 'Am', 'G', 'F', 'E'],
  },
  {
    id: 'scifi-pad-loop-8',
    label: 'Sci-fi · Am7–Fmaj7–C–G ×2',
    kind: 'loop4x2',
    chords: ['Am7', 'Fmaj7', 'C', 'G', 'Am7', 'Fmaj7', 'C', 'G'],
  },
  {
    id: 'phryg-andalusian-loop-8',
    label: 'Phrygian · Am–G–F–E ×2',
    kind: 'loop4x2',
    chords: ['Am', 'G', 'F', 'E', 'Am', 'G', 'F', 'E'],
  },
  {
    id: 'phryg-cinematic-loop-8',
    label: 'Evil cinematic · Am–Bb–F–E ×2',
    kind: 'loop4x2',
    chords: ['Am', 'Bb', 'F', 'E', 'Am', 'Bb', 'F', 'E'],
  },
  {
    id: 'phryg-bII-loop-8',
    label: 'Phrygian bII · Am–Bb–G–Am ×2',
    kind: 'loop4x2',
    chords: ['Am', 'Bb', 'G', 'Am', 'Am', 'Bb', 'G', 'Am'],
  },
  {
    id: 'phryg-stab-loop-8',
    label: 'Evil stab · Am–Bb ×2',
    kind: 'loop4x2',
    chords: ['Am', 'Bb', 'Am', 'Bb', 'Am', 'Bb', 'Am', 'Bb'],
  },
  {
    id: 'phryg-chromatic-loop-8',
    label: 'Dark slide · Am–Ab–G–F ×2',
    kind: 'loop4x2',
    chords: ['Am', 'Ab', 'G', 'F', 'Am', 'Ab', 'G', 'F'],
  },
];

export const GROOVE_8BAR_SONG_BANK: Groove8BarSongPreset[] = [
  ...GROOVE_8BAR_SONG_BANK_FULL,
  ...GROOVE_4BAR_PHRYGIAN_CINEMATIC,
  ...GROOVE_4BAR_HORROR_ICONS,
  ...GROOVE_8BAR_SONG_BANK_LOOP,
];

/** Song bank dropdown sections (8-chord sketch). */
export const GROOVE_8BAR_SONG_BANK_SECTIONS: ReadonlyArray<{
  label: string;
  banks: readonly Groove8BarSongPreset[];
}> = [
  { label: 'R&B & Soul — 90s · 80s · 70s (8 chords)', banks: GROOVE_8BAR_SONG_BANK_RNB },
  {
    label: 'T&B Edition (8 chords)',
    banks: GROOVE_8BAR_SONG_BANK_TB_EDITION,
  },
  { label: 'Pop rock ballads (8 chords)', banks: GROOVE_8BAR_SONG_BANK_POP_ROCK },
  { label: 'K-pop / K-ballad (8 chords)', banks: GROOVE_8BAR_SONG_BANK_KPOP },
  { label: 'Southern soul — Stax · Shoals (8 chords)', banks: GROOVE_8BAR_SONG_BANK_SOUTHERN_SOUL },
  { label: 'Lo-fi / jazz-hop (8 chords)', banks: GROOVE_8BAR_SONG_BANK_LOFI },
  { label: '90s / 2000s dance (8 chords)', banks: GROOVE_8BAR_SONG_BANK_DANCE_90S },
  { label: 'Horror cinema (8 chords)', banks: GROOVE_8BAR_SONG_BANK_HORROR },
  { label: 'Sci-fi cinema (8 chords)', banks: GROOVE_8BAR_SONG_BANK_SCIFI },
  {
    label: 'Phrygian / evil cinematic (4 bars · chop)',
    banks: GROOVE_4BAR_PHRYGIAN_CINEMATIC,
  },
  {
    label: 'Horror icons · Halloween · Jason · Alien (4 bars)',
    banks: GROOVE_4BAR_HORROR_ICONS,
  },
  { label: 'More 8-chord songs', banks: GROOVE_8BAR_SONG_BANK_GENERAL },
  { label: '4-chord loop ×2', banks: GROOVE_8BAR_SONG_BANK_LOOP },
];

export const DEFAULT_GROOVE_8BAR_SONG_ID = GROOVE_8BAR_SONG_BANK_FULL[0]?.id ?? 'diatonic-climb-8';

export type EightBarSketchSlot = { label: string; rest: boolean };

/** Load a song-bank preset — one chord per bar, no tiling. */
export function songBankToEightBarSketch(
  chords: readonly string[],
  barCount = 8,
): EightBarSketchSlot[] {
  const out = Array.from({ length: barCount }, () => ({ label: '', rest: false }));
  const playable = chords.map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < Math.min(barCount, playable.length); i++) {
    out[i] = { label: playable[i]!, rest: false };
  }
  return out;
}

/** Tile a short loop across exactly eight bars (fills 4-chord packs to full phrase). */
export function chordLabelsToEightBarSketch(
  labels: readonly string[],
  barCount = 8,
): EightBarSketchSlot[] {
  const out = Array.from({ length: barCount }, () => ({ label: '', rest: false }));
  const playable = labels.map((l) => l.trim()).filter(Boolean);
  if (playable.length === 0) return out;
  for (let i = 0; i < barCount; i++) {
    out[i] = { label: playable[i % playable.length]!, rest: false };
  }
  return out;
}

export function presetToGrooveSteps(
  presetId: GrooveProgressionPackId,
  keyRoot = 0,
): GrooveProgressionStep[] {
  const cat = buildGrooveProgressionPresetCatalog(keyRoot);
  const def = cat.find((p) => p.id === presetId);
  if (!def) return [];
  return def.steps.map((s) => ({
    id: newProgressionStepId(),
    label: s.rest ? '' : s.label,
    beats: s.beats,
    rest: s.rest,
  }));
}

export function inferRomanFromLabel(
  label: string,
  keyRoot: number,
  mode: ChordMode,
): ChordSymbol | null {
  if (!label.trim()) return null;
  const parsed = parseChordSymbolToken(label);
  if (!parsed) return null;
  const targetRootPc = parsed.rootPc;
  const parsedPcs = new Set(parsed.notes.map((m) => m % 12));
  let best: ChordSymbol | null = null;
  let bestScore = -1;
  for (const sym of getModeChordSymbols(mode)) {
    const midis = chordSymbolToMidi(sym, keyRoot, mode);
    if (!midis?.length) continue;
    if (midis[0]! % 12 !== targetRootPc) continue;
    const symPcs = new Set(midis.map((m) => m % 12));
    let overlap = 0;
    for (const pc of parsedPcs) if (symPcs.has(pc)) overlap++;
    if (overlap > bestScore) {
      bestScore = overlap;
      best = sym;
    }
  }
  return best;
}

/** Ranked next-chord ideas (strong → weak) from the active genre pack. */
export function suggestNextChordLabels(
  steps: readonly GrooveProgressionStep[],
  opts: { keyRoot: number; mode: ChordMode; genreId: string; topK?: number },
): GrooveNextChordSuggestion[] {
  const genre = getGenre(opts.genreId) ?? GENRES[0]!;
  const topK = opts.topK ?? 10;
  const played = steps.filter((s) => !s.rest && s.label.trim());
  const last = played.length > 0 ? played[played.length - 1]! : null;
  const lastRoman = last
    ? inferRomanFromLabel(last.label, opts.keyRoot, opts.mode)
    : null;

  if (!lastRoman) {
    const startCounts: Record<string, number> = {};
    for (const prog of genre.progressions) {
      const first = coerceChordSymbolForMode(prog.chords[0]!, genre.mode, genre.mode);
      startCounts[first] = (startCounts[first] ?? 0) + 1;
    }
    const total = Object.values(startCounts).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(startCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK)
      .map(([roman, count]) => ({
        roman: roman as ChordSymbol,
        label: chordSymbolToName(roman as ChordSymbol, opts.keyRoot, opts.mode),
        strength: Math.round((count / total) * 100),
      }));
  }

  const likely = suggestLikelyNextChords(lastRoman, genre, topK);
  const weights = likely.map((l) => l.weight);
  const maxW = Math.max(...weights, 1);
  const minW = Math.min(...weights, 0);
  const span = maxW - minW || 1;
  return likely.map(({ chord, weight }) => ({
    roman: coerceChordSymbolForMode(chord, opts.mode, genre.mode),
    label: chordSymbolToName(
      coerceChordSymbolForMode(chord, opts.mode, genre.mode),
      opts.keyRoot,
      opts.mode,
    ),
    strength: Math.max(
      8,
      Math.round(18 + ((weight - minW) / span) * 82),
    ),
  }));
}

export function defaultGenrePackForMode(mode: ChordMode): string {
  if (mode === 'minor') return 'hiphop';
  return 'rnb-true';
}

/** BPM that matches a catalog preset (`genreId::progressionId`). */
export function bpmForProgressionPreset(
  presetId: GrooveProgressionPackId,
  keyRoot = 0,
): number {
  const cat = buildGrooveProgressionPresetCatalog(keyRoot);
  const entry = cat.find((p) => p.id === presetId);
  if (!entry) return resolveProgressionBpm('pop').bpm;
  const loopLabel = entry.label.replace(/^[^·]+·\s*/, '');
  return resolveProgressionBpm(entry.genreId, {
    progressionId: entry.progressionId,
    progressionName: loopLabel,
  }).bpm;
}

export function bpmForGenrePack(genreId: string): number {
  return resolveProgressionBpm(genreId).bpm;
}