import { ERA_POP_RNB_DISCO_GENRES } from '@/app/lib/creationStation/eraPopRnbDiscoProgressions';
import { ERA_SOUL_RNB_NEO_GENRES } from '@/app/lib/creationStation/eraSoulRnbNeoProgressions';
import { ERA_BLUES_LATIN_KPOP_GENRES } from '@/app/lib/creationStation/eraBluesLatinKpopProgressions';
import { GENRE_MINOR_EXPANSIONS } from '@/app/lib/creationStation/genreMinorExpansions';

/**
 * Chord Builder — Creation Station chord-progression engine.
 *
 * Two complementary engines wrapped in one module:
 *
 *  1. **Genre Packs** (Soundtrap / Musia style): a curated table of well-known
 *     Roman-numeral progressions per genre. Picking a genre + progression
 *     deterministically expands to MIDI in the user's key + pattern.
 *
 *  2. **Suggest Next** (ChordSeqAI style, rule-based): given the last chord on
 *     the user's chord lane and the active genre, derive a weighted
 *     next-chord proposal by mining transitions out of that genre's existing
 *     progressions. No neural network — the curated data drives the suggestion.
 *
 * Pure data + pure functions only. UI lives in {@link ChordBuilderModal} and
 * the host writes the returned `{ midi, col }[]` into the shared piano notes
 * store. Both engines work in either `major` or `minor` keys.
 */

export type ChordSymbol = string;

/** Diatonic modes the chord builder understands. `major` = Ionian and `minor` =
 *  Aeolian (natural minor); next come the church-mode variants of each, then a
 *  handful of "standalone" scales (Locrian, Melodic Minor, Phrygian Dominant)
 *  whose tonic chord doesn't behave like a standard major or minor. */
export type ChordMode =
  | 'major'
  | 'minor'
  | 'dorian'
  | 'phrygian'
  | 'lydian'
  | 'mixolydian'
  | 'harmonicMinor'
  | 'locrian'
  | 'melodicMinor'
  | 'phrygianDominant';

/** Friendly mode labels for the UI mode dropdown. Major and Minor stand alone
 *  as their own simple entries; the other names are mode *variants* that get
 *  grouped under their parent family by {@link MODE_FAMILY}. The "Other"
 *  family is for standalone scales whose tonic is neither plain major nor
 *  plain minor. */
export const MODE_LABELS: Record<ChordMode, string> = {
  major: 'Major',
  minor: 'Minor',
  dorian: 'Dorian (minor variant)',
  phrygian: 'Phrygian (minor variant)',
  lydian: 'Lydian (major variant)',
  mixolydian: 'Mixolydian (major variant)',
  harmonicMinor: 'Harmonic Minor',
  locrian: 'Locrian',
  melodicMinor: 'Melodic Minor (jazz)',
  phrygianDominant: 'Phrygian Dominant (Spanish)',
};

/** Each mode's "parent family" — used by the UI to group major-flavored modes
 *  separately from minor-flavored modes in the dropdown. `other` is reserved
 *  for standalone scales (Locrian, Melodic Minor, Phrygian Dominant). */
export const MODE_FAMILY: Record<ChordMode, 'major' | 'minor' | 'other'> = {
  major: 'major',
  lydian: 'major',
  mixolydian: 'major',
  minor: 'minor',
  dorian: 'minor',
  phrygian: 'minor',
  harmonicMinor: 'minor',
  locrian: 'other',
  melodicMinor: 'other',
  phrygianDominant: 'other',
};

/** Ordered list of modes per family, with the plain "Major" / "Minor" entry
 *  first followed by the variants. Drives the optgroup ordering in the UI. */
export const MODES_BY_FAMILY: {
  major: ChordMode[];
  minor: ChordMode[];
  other: ChordMode[];
} = {
  major: ['major', 'lydian', 'mixolydian'],
  minor: ['minor', 'dorian', 'phrygian', 'harmonicMinor'],
  other: ['locrian', 'melodicMinor', 'phrygianDominant'],
};

export interface ProgressionDef {
  id: string;
  name: string;
  chords: ChordSymbol[];
  /** Overrides {@link GenreDef.mode} for this progression (e.g. minor blues in major pack). */
  mode?: ChordMode;
}

export interface GenreDef {
  id: string;
  label: string;
  mode: ChordMode;
  progressions: ProgressionDef[];
}

export interface PatternDef {
  id: string;
  label: string;
  /** Events per chord bar, expressed in quarter-note offsets within the bar. */
  events: PatternEvent[];
}

export interface PatternEvent {
  /** Quarter-note offset inside the chord's allotted bar(s) (0..barsPerChord*4). */
  beatOffset: number;
  /** Which voice to play: full chord, bass note only, or top note only. */
  voice: 'chord' | 'bass' | 'top';
}

export interface ChordEventOut {
  /** MIDI pitch (0..127). */
  midi: number;
  /** Quarter-note column index (matches CreationStation `MEASURES_PER_BAR`). */
  col: number;
}

export const KEY_ROOTS = [
  { value: 0,  label: 'C'  },
  { value: 1,  label: 'C#' },
  { value: 2,  label: 'D'  },
  { value: 3,  label: 'D#' },
  { value: 4,  label: 'E'  },
  { value: 5,  label: 'F'  },
  { value: 6,  label: 'F#' },
  { value: 7,  label: 'G'  },
  { value: 8,  label: 'G#' },
  { value: 9,  label: 'A'  },
  { value: 10, label: 'A#' },
  { value: 11, label: 'B'  },
] as const;

/** One table entry per mode covering everything the chord builder needs to
 *  know about that mode: chord-symbol → semitone intervals, chord-symbol →
 *  display-name (interval/quality), the default chord pad strip, and the
 *  fallback chord {@link suggestNextChord} returns when no transitions match. */
interface ModeTable {
  /** Roman numeral → semitone intervals over the key root. */
  semitones: Record<ChordSymbol, number[]>;
  /** Roman numeral → display-name interval + quality (e.g. "m7", "maj7"). */
  info: Record<ChordSymbol, { interval: number; quality: string }>;
  /** Pad symbols shown on the chord rail for this mode, in display order. */
  defaultPads: ChordSymbol[];
  /** Tonic symbol used as the fallback when suggestNextChord can't decide. */
  defaultStart: ChordSymbol;
}

const MODE_TABLES: Record<ChordMode, ModeTable> = {
  // ── Major (Ionian) — bright pop / rock / R&B home base ──────────────────
  major: {
    semitones: {
      I:      [0, 4, 7],
      ii:     [2, 5, 9],
      iii:    [4, 7, 11],
      IV:     [5, 9, 12],
      V:      [7, 11, 14],
      vi:     [9, 12, 16],
      'vii°': [11, 14, 17],
      Imaj7:  [0, 4, 7, 11],
      I7:     [0, 4, 7, 10],
      ii7:    [2, 5, 9, 12],
      iii7:   [4, 7, 11, 14],
      IV7:    [5, 9, 12, 15],
      IVmaj7: [5, 9, 12, 16],
      V7:     [7, 11, 14, 17],
      vi7:    [9, 12, 16, 19],
      iiø7:   [2, 5, 8, 12],
      bVI:    [8, 12, 15],
      bVII:   [10, 14, 17],
      bIII:   [3, 7, 10],
      bIIImaj7: [3, 7, 10, 14],
      bVImaj7: [8, 12, 15, 19],
      bVIImaj7: [10, 14, 17, 21],
      bIImaj7: [1, 5, 8, 12],
      Isus4:  [0, 5, 7],
      Vsus4:  [7, 12, 14],
      /** Borrowed minor iv — gospel / pop back-door cadence. */
      iv:     [5, 8, 12],
    },
    info: {
      'I':      { interval: 0,  quality: '' },
      'ii':     { interval: 2,  quality: 'm' },
      'iii':    { interval: 4,  quality: 'm' },
      'IV':     { interval: 5,  quality: '' },
      'V':      { interval: 7,  quality: '' },
      'vi':     { interval: 9,  quality: 'm' },
      'vii°':   { interval: 11, quality: '°' },
      'Imaj7':  { interval: 0,  quality: 'maj7' },
      'I7':     { interval: 0,  quality: '7' },
      'ii7':    { interval: 2,  quality: 'm7' },
      'iii7':   { interval: 4,  quality: 'm7' },
      'IV7':    { interval: 5,  quality: '7' },
      'IVmaj7': { interval: 5,  quality: 'maj7' },
      'V7':     { interval: 7,  quality: '7' },
      'vi7':    { interval: 9,  quality: 'm7' },
      'iiø7':   { interval: 2,  quality: 'ø7' },
      'bIII':   { interval: 3,  quality: '' },
      'bIIImaj7': { interval: 3, quality: 'maj7' },
      'bVI':    { interval: 8,  quality: '' },
      'bVImaj7': { interval: 8, quality: 'maj7' },
      'bVII':   { interval: 10, quality: '' },
      'bVIImaj7': { interval: 10, quality: 'maj7' },
      'bIImaj7': { interval: 1, quality: 'maj7' },
      'Isus4':  { interval: 0,  quality: 'sus4' },
      'Vsus4':  { interval: 7,  quality: 'sus4' },
      'iv':     { interval: 5,  quality: 'm' },
    },
    defaultPads: [
      'I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°',
      'Imaj7', 'ii7', 'iii7', 'IV7', 'IVmaj7', 'V7', 'vi7',
      'bIII', 'bIIImaj7', 'bVI', 'bVImaj7', 'bVII', 'bVIImaj7', 'bIImaj7',
      'Isus4', 'Vsus4', 'iv',
    ],
    defaultStart: 'I',
  },

  // ── Aeolian / Natural Minor — darker pop, ballad, hip-hop, trap ──────────
  minor: {
    semitones: {
      i:      [0, 3, 7],
      'ii°':  [2, 5, 8],
      III:    [3, 7, 10],
      iv:     [5, 8, 12],
      v:      [7, 10, 14],
      V:      [7, 11, 14],
      VI:     [8, 12, 15],
      VII:    [10, 14, 17],
      i7:     [0, 3, 7, 10],
      I7:     [0, 4, 7, 10],
      iv7:    [5, 8, 12, 15],
      IV7:    [5, 9, 12, 15],
      V7:     [7, 11, 14, 17],
      VImaj7: [8, 12, 15, 19],
      VII7:   [10, 14, 17, 20],
      iiø7:   [2, 5, 8, 12],
      bVII:   [10, 14, 17],
      bVI:    [8, 12, 15],
      bVImaj7: [8, 12, 15, 19],
      bIIImaj7: [3, 7, 10, 14],
      bIImaj7: [1, 5, 8, 12],
    },
    info: {
      'i':      { interval: 0,  quality: 'm' },
      'ii°':    { interval: 2,  quality: '°' },
      'III':    { interval: 3,  quality: '' },
      'iv':     { interval: 5,  quality: 'm' },
      'v':      { interval: 7,  quality: 'm' },
      'V':      { interval: 7,  quality: '' },
      'VI':     { interval: 8,  quality: '' },
      'VII':    { interval: 10, quality: '' },
      'i7':     { interval: 0,  quality: 'm7' },
      'I7':     { interval: 0,  quality: '7' },
      'iv7':    { interval: 5,  quality: 'm7' },
      'IV7':    { interval: 5,  quality: '7' },
      'V7':     { interval: 7,  quality: '7' },
      'VImaj7': { interval: 8,  quality: 'maj7' },
      'VII7':   { interval: 10, quality: '7' },
      'iiø7':   { interval: 2,  quality: 'ø7' },
      'bVII':   { interval: 10, quality: '' },
      'bVI':    { interval: 8,  quality: '' },
      'bVImaj7': { interval: 8, quality: 'maj7' },
      'bIIImaj7': { interval: 3, quality: 'maj7' },
      'bIImaj7': { interval: 1, quality: 'maj7' },
    },
    defaultPads: [
      'i', 'ii°', 'III', 'iv', 'v', 'V', 'VI', 'VII',
      'i7', 'iv7', 'V7', 'VImaj7', 'VII7', 'bVII', 'bVI', 'bVImaj7', 'bIIImaj7', 'iiø7',
    ],
    defaultStart: 'i',
  },

  // ── Dorian — minor i with a bright IV. Jazz, funk, soul, modal jams ─────
  dorian: {
    semitones: {
      i:      [0, 3, 7],
      ii:     [2, 5, 9],
      bIII:   [3, 7, 10],
      IV:     [5, 9, 12],
      v:      [7, 10, 14],
      'vi°':  [9, 12, 15],
      bVII:   [10, 14, 17],
      i7:     [0, 3, 7, 10],
      ii7:    [2, 5, 9, 12],
      IV7:    [5, 9, 12, 15],
      bIIImaj7: [3, 7, 10, 14],
      bVIImaj7: [10, 14, 17, 21],
    },
    info: {
      'i':        { interval: 0,  quality: 'm' },
      'ii':       { interval: 2,  quality: 'm' },
      'bIII':     { interval: 3,  quality: '' },
      'IV':       { interval: 5,  quality: '' },
      'v':        { interval: 7,  quality: 'm' },
      'vi°':      { interval: 9,  quality: '°' },
      'bVII':     { interval: 10, quality: '' },
      'i7':       { interval: 0,  quality: 'm7' },
      'ii7':      { interval: 2,  quality: 'm7' },
      'IV7':      { interval: 5,  quality: '7' },
      'bIIImaj7': { interval: 3,  quality: 'maj7' },
      'bVIImaj7': { interval: 10, quality: 'maj7' },
    },
    defaultPads: [
      'i', 'ii', 'bIII', 'IV', 'v', 'vi°', 'bVII',
      'i7', 'ii7', 'IV7', 'bIIImaj7', 'bVIImaj7',
    ],
    defaultStart: 'i',
  },

  // ── Phrygian — dark, Spanish/flamenco/metal sound built on bII signature ─
  phrygian: {
    semitones: {
      i:      [0, 3, 7],
      bII:    [1, 5, 8],
      bIII:   [3, 7, 10],
      iv:     [5, 8, 12],
      'v°':   [7, 10, 13],
      bVI:    [8, 12, 15],
      bvii:   [10, 13, 17],
      i7:     [0, 3, 7, 10],
      bIImaj7:[1, 5, 8, 12],
      iv7:    [5, 8, 12, 15],
      bVImaj7:[8, 12, 15, 19],
    },
    info: {
      'i':       { interval: 0,  quality: 'm' },
      'bII':     { interval: 1,  quality: '' },
      'bIII':    { interval: 3,  quality: '' },
      'iv':      { interval: 5,  quality: 'm' },
      'v°':      { interval: 7,  quality: '°' },
      'bVI':     { interval: 8,  quality: '' },
      'bvii':    { interval: 10, quality: 'm' },
      'i7':      { interval: 0,  quality: 'm7' },
      'bIImaj7': { interval: 1,  quality: 'maj7' },
      'iv7':     { interval: 5,  quality: 'm7' },
      'bVImaj7': { interval: 8,  quality: 'maj7' },
    },
    defaultPads: [
      'i', 'bII', 'bIII', 'iv', 'v°', 'bVI', 'bvii',
      'i7', 'bIImaj7', 'iv7', 'bVImaj7',
    ],
    defaultStart: 'i',
  },

  // ── Lydian — major I with #4. Dreamy, cinematic, "Simpsons theme" feel ──
  lydian: {
    semitones: {
      I:      [0, 4, 7],
      II:     [2, 6, 9],
      iii:    [4, 7, 11],
      '#iv°': [6, 9, 12],
      V:      [7, 11, 14],
      vi:     [9, 12, 16],
      vii:    [11, 14, 18],
      Imaj7:  [0, 4, 7, 11],
      II7:    [2, 6, 9, 12],
      iii7:   [4, 7, 11, 14],
      vi7:    [9, 12, 16, 19],
    },
    info: {
      'I':     { interval: 0,  quality: '' },
      'II':    { interval: 2,  quality: '' },
      'iii':   { interval: 4,  quality: 'm' },
      '#iv°':  { interval: 6,  quality: '°' },
      'V':     { interval: 7,  quality: '' },
      'vi':    { interval: 9,  quality: 'm' },
      'vii':   { interval: 11, quality: 'm' },
      'Imaj7': { interval: 0,  quality: 'maj7' },
      'II7':   { interval: 2,  quality: '7' },
      'iii7':  { interval: 4,  quality: 'm7' },
      'vi7':   { interval: 9,  quality: 'm7' },
    },
    defaultPads: [
      'I', 'II', 'iii', '#iv°', 'V', 'vi', 'vii',
      'Imaj7', 'II7', 'iii7', 'vi7',
    ],
    defaultStart: 'I',
  },

  // ── Mixolydian — major I with bVII. Rock, blues, funk, Celtic, gospel ──
  mixolydian: {
    semitones: {
      I:      [0, 4, 7],
      ii:     [2, 5, 9],
      'iii°': [4, 7, 10],
      IV:     [5, 9, 12],
      v:      [7, 10, 14],
      vi:     [9, 12, 16],
      bVII:   [10, 14, 17],
      I7:     [0, 4, 7, 10],
      ii7:    [2, 5, 9, 12],
      IV7:    [5, 9, 12, 15],
      bVIImaj7: [10, 14, 17, 21],
    },
    info: {
      'I':        { interval: 0,  quality: '' },
      'ii':       { interval: 2,  quality: 'm' },
      'iii°':     { interval: 4,  quality: '°' },
      'IV':       { interval: 5,  quality: '' },
      'v':        { interval: 7,  quality: 'm' },
      'vi':       { interval: 9,  quality: 'm' },
      'bVII':     { interval: 10, quality: '' },
      'I7':       { interval: 0,  quality: '7' },
      'ii7':      { interval: 2,  quality: 'm7' },
      'IV7':      { interval: 5,  quality: '7' },
      'bVIImaj7': { interval: 10, quality: 'maj7' },
    },
    defaultPads: [
      'I', 'ii', 'iii°', 'IV', 'v', 'vi', 'bVII',
      'I7', 'ii7', 'IV7', 'bVIImaj7',
    ],
    defaultStart: 'I',
  },

  // ── Harmonic Minor — raised 7 gives a major V and the V7→i cadence ─────
  harmonicMinor: {
    semitones: {
      i:      [0, 3, 7],
      'ii°':  [2, 5, 8],
      'bIII+':[3, 7, 11],
      iv:     [5, 8, 12],
      V:      [7, 11, 14],
      bVI:    [8, 12, 15],
      'vii°': [11, 14, 17],
      i7:     [0, 3, 7, 10],
      'i(maj7)': [0, 3, 7, 11],
      iv7:    [5, 8, 12, 15],
      V7:     [7, 11, 14, 17],
      'vii°7':[11, 14, 17, 20],
    },
    info: {
      'i':      { interval: 0,  quality: 'm' },
      'ii°':    { interval: 2,  quality: '°' },
      'bIII+':  { interval: 3,  quality: '+' },
      'iv':     { interval: 5,  quality: 'm' },
      'V':      { interval: 7,  quality: '' },
      'bVI':    { interval: 8,  quality: '' },
      'vii°':   { interval: 11, quality: '°' },
      'i7':     { interval: 0,  quality: 'm7' },
      'i(maj7)': { interval: 0, quality: 'm(maj7)' },
      'iv7':    { interval: 5,  quality: 'm7' },
      'V7':     { interval: 7,  quality: '7' },
      'vii°7':  { interval: 11, quality: '°7' },
    },
    defaultPads: [
      'i', 'ii°', 'bIII+', 'iv', 'V', 'bVI', 'vii°',
      'i7', 'i(maj7)', 'iv7', 'V7', 'vii°7',
    ],
    defaultStart: 'i',
  },

  // ── Locrian — diminished tonic. Completes the 7 church modes; mostly used
  // for tension passages and "outside" jazz. The i° feels unstable, which is
  // exactly its appeal. ──────────────────────────────────────────────────────
  locrian: {
    semitones: {
      'i°':     [0, 3, 6],
      bII:      [1, 5, 8],
      biii:     [3, 6, 10],
      iv:       [5, 8, 12],
      bv:       [6, 10, 13],
      bVI:      [8, 12, 15],
      bvii:     [10, 13, 17],
      'iø7':    [0, 3, 6, 10],
      bIImaj7:  [1, 5, 8, 12],
      iv7:      [5, 8, 12, 15],
    },
    info: {
      'i°':      { interval: 0,  quality: '°' },
      'bII':     { interval: 1,  quality: '' },
      'biii':    { interval: 3,  quality: 'm' },
      'iv':      { interval: 5,  quality: 'm' },
      'bv':      { interval: 6,  quality: '' },
      'bVI':     { interval: 8,  quality: '' },
      'bvii':    { interval: 10, quality: 'm' },
      'iø7':     { interval: 0,  quality: 'ø7' },
      'bIImaj7': { interval: 1,  quality: 'maj7' },
      'iv7':     { interval: 5,  quality: 'm7' },
    },
    defaultPads: [
      'i°', 'bII', 'biii', 'iv', 'bv', 'bVI', 'bvii',
      'iø7', 'bIImaj7', 'iv7',
    ],
    defaultStart: 'i°',
  },

  // ── Melodic Minor (jazz ascending) — minor scale with raised 6 and 7. The
  // signature tonic chord is m(maj7), and the V chord is major (V7→i works).
  // The vocabulary of jazz / fusion / cinematic chord writing. ───────────────
  melodicMinor: {
    semitones: {
      i:        [0, 3, 7],
      'i(maj7)':[0, 3, 7, 11],
      ii:       [2, 5, 9],
      'bIII+':  [3, 7, 11],
      IV:       [5, 9, 12],
      V:        [7, 11, 14],
      V7:       [7, 11, 14, 17],
      'vi°':    [9, 12, 15],
      'vii°':   [11, 14, 17],
      ii7:      [2, 5, 9, 12],
      IV7:      [5, 9, 12, 15],
    },
    info: {
      'i':       { interval: 0,  quality: 'm' },
      'i(maj7)': { interval: 0,  quality: 'm(maj7)' },
      'ii':      { interval: 2,  quality: 'm' },
      'bIII+':   { interval: 3,  quality: '+' },
      'IV':      { interval: 5,  quality: '' },
      'V':       { interval: 7,  quality: '' },
      'V7':      { interval: 7,  quality: '7' },
      'vi°':     { interval: 9,  quality: '°' },
      'vii°':    { interval: 11, quality: '°' },
      'ii7':     { interval: 2,  quality: 'm7' },
      'IV7':     { interval: 5,  quality: '7' },
    },
    defaultPads: [
      'i', 'ii', 'bIII+', 'IV', 'V', 'vi°', 'vii°',
      'i(maj7)', 'ii7', 'IV7', 'V7',
    ],
    defaultStart: 'i',
  },

  // ── Phrygian Dominant (a.k.a. Spanish Phrygian, Freygish, Mixolydian b2-b6)
  // — phrygian with a raised 3rd. Major tonic with a flat-second and minor
  // sixth makes the unmistakable flamenco / klezmer / Middle-Eastern sound. ──
  phrygianDominant: {
    semitones: {
      I:        [0, 4, 7],
      bII:      [1, 5, 8],
      'iii°':   [4, 7, 10],
      iv:       [5, 8, 12],
      'v°':     [7, 10, 13],
      'bVI+':   [8, 12, 16],
      bvii:     [10, 13, 17],
      I7:       [0, 4, 7, 10],
      bIImaj7:  [1, 5, 8, 12],
    },
    info: {
      'I':       { interval: 0,  quality: '' },
      'bII':     { interval: 1,  quality: '' },
      'iii°':    { interval: 4,  quality: '°' },
      'iv':      { interval: 5,  quality: 'm' },
      'v°':      { interval: 7,  quality: '°' },
      'bVI+':    { interval: 8,  quality: '+' },
      'bvii':    { interval: 10, quality: 'm' },
      'I7':      { interval: 0,  quality: '7' },
      'bIImaj7': { interval: 1,  quality: 'maj7' },
    },
    defaultPads: [
      'I', 'bII', 'iii°', 'iv', 'v°', 'bVI+', 'bvii',
      'I7', 'bIImaj7',
    ],
    defaultStart: 'I',
  },
};

/** Public read-only view of {@link MODE_TABLES.defaultPads}. The chord-rail UI
 *  uses this to decide which pads to display for the active mode. */
export function getModePads(mode: ChordMode): ChordSymbol[] {
  return MODE_TABLES[mode].defaultPads;
}

/** All Roman-numeral symbols defined for a mode (for analysis / matching). */
export function getModeChordSymbols(mode: ChordMode): ChordSymbol[] {
  return Object.keys(MODE_TABLES[mode].semitones) as ChordSymbol[];
}

/** Tonic fallback chord when no better match exists. */
export function getModeDefaultChord(mode: ChordMode): ChordSymbol {
  return MODE_TABLES[mode].defaultStart;
}

/**
 * Convert a Roman numeral chord symbol in the active mode to a set of MIDI
 * pitches over the given key root. Returns null if the symbol is unknown.
 *
 * Octave anchor is C4 (MIDI 60). The caller can octave-shift in
 * {@link buildChordEvents} to keep notes inside the piano-roll's visible band.
 */
export function chordSymbolToMidi(
  symbol: ChordSymbol,
  keyRoot: number,
  mode: ChordMode,
  baseOctave = 4,
): number[] | null {
  const intervals = chordSymbolIntervalMap(symbol, mode);
  if (!intervals) return null;
  const base = (baseOctave + 1) * 12 + keyRoot;
  return intervals.map((iv) => base + iv);
}

/** Semitone intervals from key root for a Roman symbol (major table fallback). */
export function chordSymbolIntervalMap(
  symbol: ChordSymbol,
  mode: ChordMode,
): readonly number[] | null {
  return MODE_TABLES[mode].semitones[symbol] ?? MODE_TABLES.major.semitones[symbol] ?? null;
}

/** Bass/root pitch for a Roman numeral — uses the mode's scale degree, not voicing order. */
export function chordSymbolToRootMidi(
  symbol: ChordSymbol,
  keyRoot: number,
  mode: ChordMode,
  baseOctave = 4,
): number | null {
  const info = MODE_TABLES[mode].info[symbol];
  if (!info) return null;
  return (baseOctave + 1) * 12 + keyRoot + info.interval;
}

/**
 * Map a chord symbol from another mode / casing (e.g. major `IV` → minor `iv`)
 * onto a symbol that exists in `mode`.
 */
export function coerceChordSymbolForMode(
  symbol: ChordSymbol,
  mode: ChordMode,
  hintMode?: ChordMode,
): ChordSymbol {
  if (MODE_TABLES[mode].semitones[symbol]) return symbol;
  const hint = hintMode ?? mode;
  const fromHint = MODE_TABLES[hint].info[symbol];
  if (fromHint) {
    const exact = Object.entries(MODE_TABLES[mode].info).find(
      ([, v]) => v.interval === fromHint.interval && v.quality === fromHint.quality,
    );
    if (exact) return exact[0];
    const byDegree = Object.entries(MODE_TABLES[mode].info).find(
      ([, v]) => v.interval === fromHint.interval,
    );
    if (byDegree) return byDegree[0];
  }
  return getModeDefaultChord(mode);
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Convert a Roman-numeral chord symbol into a concrete chord name (e.g. "Am7",
 * "Bm", "Gmaj7", "F#°", "G+") under the active key + mode. Falls back to the
 * input symbol if it's not in the table.
 *
 * Quality strings follow the popular chord-chart conventions producers expect:
 *   '' = major triad, 'm' = minor, '°' = dim, '+' = aug, 'maj7' = major 7,
 *   '7' = dom 7, 'm7' = minor 7, 'ø7' = half-dim 7, '°7' = full dim 7,
 *   'sus4' = suspended 4.
 */
/** True when every symbol maps to MIDI in the given mode. */
export function progressionResolvesInMode(
  chords: ReadonlyArray<ChordSymbol>,
  mode: ChordMode,
  keyRoot = 0,
): boolean {
  if (chords.length === 0) return false;
  return chords.every((c) => chordSymbolToMidi(c, keyRoot, mode) !== null);
}

export function resolveProgressionMode(
  progression: Pick<ProgressionDef, 'mode'>,
  genre: Pick<GenreDef, 'mode'>,
): ChordMode {
  return progression.mode ?? genre.mode;
}

export function chordSymbolToName(
  symbol: ChordSymbol,
  keyRoot: number,
  mode: ChordMode,
): string {
  const info = MODE_TABLES[mode].info[symbol];
  if (!info) return symbol;
  const noteIdx = ((keyRoot + info.interval) % 12 + 12) % 12;
  return `${NOTE_NAMES[noteIdx]}${info.quality}`;
}

/** Strum / rhythm templates applied to each chord in the progression. */
export const PATTERNS: PatternDef[] = [
  {
    id: 'block',
    label: 'Block',
    events: [{ beatOffset: 0, voice: 'chord' }],
  },
  {
    id: 'sustain',
    label: 'Sustain',
    events: [{ beatOffset: 0, voice: 'chord' }],
  },
  {
    id: 'strum',
    label: 'Strum (1 per beat)',
    events: [
      { beatOffset: 0, voice: 'chord' },
      { beatOffset: 1, voice: 'chord' },
      { beatOffset: 2, voice: 'chord' },
      { beatOffset: 3, voice: 'chord' },
    ],
  },
  {
    id: 'on-air',
    label: 'On Air (bass + chord)',
    events: [
      { beatOffset: 0, voice: 'bass' },
      { beatOffset: 1, voice: 'chord' },
      { beatOffset: 2, voice: 'chord' },
      { beatOffset: 3, voice: 'chord' },
    ],
  },
  {
    id: 'syncopated',
    label: 'Syncopated',
    events: [
      { beatOffset: 0,   voice: 'chord' },
      { beatOffset: 1.5, voice: 'chord' },
      { beatOffset: 2,   voice: 'bass'  },
      { beatOffset: 3.5, voice: 'chord' },
    ],
  },
  {
    id: 'arpeggio',
    label: 'Arpeggio',
    events: [
      { beatOffset: 0, voice: 'bass'  },
      { beatOffset: 1, voice: 'chord' },
      { beatOffset: 2, voice: 'top'   },
      { beatOffset: 3, voice: 'chord' },
    ],
  },
];

/**
 * Curated Genre Packs. Every genre supplies progressions in its native mode;
 * the user's selected key just shifts the resulting MIDI pitches.
 *
 * Sources distilled from common pop/R&B/hip-hop/gospel/jazz literature plus the
 * canon used by Soundtrap's Chord Trigger and Captain Chords.
 */
export const GENRES: GenreDef[] = [
  ...ERA_POP_RNB_DISCO_GENRES,
  ...ERA_SOUL_RNB_NEO_GENRES,
  ...ERA_BLUES_LATIN_KPOP_GENRES,
  {
    id: 'pop',
    label: 'Pop',
    mode: 'major',
    progressions: [
      { id: 'pop-axis',     name: 'Axis (I-V-vi-IV)',      chords: ['I', 'V', 'vi', 'IV'] },
      { id: 'pop-fifties',  name: '50s (I-vi-IV-V)',       chords: ['I', 'vi', 'IV', 'V'] },
      { id: 'pop-flip',     name: 'Sensitive (vi-IV-I-V)', chords: ['vi', 'IV', 'I', 'V'] },
      { id: 'pop-anthem',   name: 'Anthem (I-IV-V-IV)',    chords: ['I', 'IV', 'V', 'IV'] },
      { id: 'pop-rise',     name: 'Rise (I-V-IV-V)',       chords: ['I', 'V', 'IV', 'V'] },
      { id: 'pop-emo',      name: 'Emo (vi-V-IV-V)',       chords: ['vi', 'V', 'IV', 'V'] },
    ],
  },
  // The "ice cream changes" + canon-of-doo-wop progressions everyone from
  // The Platters, The Drifters, Frankie Lymon, Dion & the Belmonts, and the
  // Marcels built their hits on. I-vi-IV-V (and I-vi-ii-V) is THE 50s sound.
  {
    id: 'doowop',
    label: '50s / 60s Doo-Wop',
    mode: 'major',
    progressions: [
      { id: 'doowop-ice',     name: 'Ice Cream Changes (I-vi-IV-V)', chords: ['I', 'vi', 'IV', 'V'] },
      { id: 'doowop-stand',   name: 'Steady Ballad (I-vi-IV-V)',     chords: ['I', 'vi', 'IV', 'V'] },
      { id: 'doowop-circle',  name: 'Circle (I-vi-ii-V)',            chords: ['I', 'vi', 'ii', 'V'] },
      { id: 'doowop-blue',    name: 'Crooner (I-vi-ii-V)',           chords: ['I', 'vi', 'ii', 'V'] },
      { id: 'doowop-earth',   name: 'Sweetheart (I-vi-IV-V)',        chords: ['I', 'vi', 'IV', 'V'] },
      { id: 'doowop-teenage', name: 'Teenager (I-IV-V-IV)',          chords: ['I', 'IV', 'V', 'IV'] },
      { id: 'doowop-duke',    name: 'Street Corner (I-vi-IV-V)',     chords: ['I', 'vi', 'IV', 'V'] },
      { id: 'doowop-shoop',   name: 'Hook Loop (I-IV-ii-V)',         chords: ['I', 'IV', 'ii', 'V'] },
      { id: 'doowop-gospel',  name: 'Gospel Bridge (vi-ii-V-I)',     chords: ['vi', 'ii', 'V', 'I'] },
      { id: 'doowop-spotlite',name: 'Spotlight (I-iii-vi-V)',        chords: ['I', 'iii', 'vi', 'V'] },
    ],
  },
  // The big late-70s / 80s pop-ballad and quiet-storm sound — Lionel Richie,
  // Whitney Houston, Air Supply, Phil Collins, Peabo Bryson territory.
  // Lots of major 7s, gentle ii-V cadences, and the "Endless Love" loop.
  {
    id: 'ballad-80s',
    label: '70s / 80s Pop Ballad',
    mode: 'major',
    progressions: [
      { id: 'ballad-endless',  name: 'Slow Dance (I-vi-IV-V)',            chords: ['I', 'vi', 'IV', 'V'] },
      { id: 'ballad-always',   name: 'Forever (Imaj7-iii7-IV-V)',         chords: ['Imaj7', 'iii7', 'IV', 'V'] },
      { id: 'ballad-saving',   name: 'Quiet-Storm Turn (Imaj7-vi7-ii7-V7)', chords: ['Imaj7', 'vi7', 'ii7', 'V7'] },
      { id: 'ballad-against',  name: 'Bridge Build (I-V-vi-iii-IV)',      chords: ['I', 'V', 'vi', 'iii', 'IV', 'I', 'IV', 'V'] },
      { id: 'ballad-careless', name: 'Quiet Storm (Imaj7-IVmaj7-iii7-vi7)', chords: ['Imaj7', 'IVmaj7', 'iii7', 'vi7'] },
      { id: 'ballad-greatest', name: 'Inspirational (I-iii-IV-V)',        chords: ['I', 'iii', 'IV', 'V'] },
      { id: 'ballad-lionel',   name: 'Minor Open (vi-IV-I-V)',            chords: ['vi', 'IV', 'I', 'V'] },
      { id: 'ballad-soft',     name: 'Soft Rock (I-V-vi-IV-iii-IV-ii-V)', chords: ['I', 'V', 'vi', 'IV', 'iii', 'IV', 'ii', 'V'] },
      { id: 'ballad-power',    name: 'Power Ballad (vi-V-IV-V)',          chords: ['vi', 'V', 'IV', 'V'] },
      { id: 'ballad-richie',   name: 'Smooth Turn (Imaj7-vi7-IVmaj7-V7)', chords: ['Imaj7', 'vi7', 'IVmaj7', 'V7'] },
      { id: 'ballad-50sframe', name: 'Classic Frame (I-vi-IV-V)',         chords: ['I', 'vi', 'IV', 'V'] },
      { id: 'ballad-circle',   name: 'Circle Resolve (I-vi-ii-V)',         chords: ['I', 'vi', 'ii', 'V'] },
      { id: 'ballad-prayer',   name: 'Prayer Lift (vi-IV-I-V)',            chords: ['vi', 'IV', 'I', 'V'] },
      { id: 'ballad-openair',  name: 'Open Air (I-IV-I-V)',                chords: ['I', 'IV', 'I', 'V'] },
      { id: 'ballad-iviv',     name: 'Subdominant Glow (I-IVmaj7-I-V)',    chords: ['I', 'IVmaj7', 'I', 'V'] },
      { id: 'ballad-susrise',  name: 'Sus Rise (I-IV-Vsus4-V7)',           chords: ['I', 'IV', 'Vsus4', 'V7'] },
      { id: 'ballad-bridge25', name: 'Bridge 2-5 (ii7-V7-Imaj7-IV)',       chords: ['ii7', 'V7', 'Imaj7', 'IV'] },
      { id: 'ballad-maj7fall', name: 'Maj7 Fall (Imaj7-vi7-IVmaj7-iii7)',  chords: ['Imaj7', 'vi7', 'IVmaj7', 'iii7'] },
    ],
  },
  // The classic Motown / Philly / Memphis-soul / quiet-storm R&B canon. Marvin
  // Gaye, Stevie Wonder, Al Green, Bill Withers, Curtis Mayfield, Earth Wind
  // & Fire, The Stylistics, Smokey Robinson, Teddy Pendergrass — heavy on
  // maj7 / m7 voicings, ii-V-I turnarounds, and modal-interchange surprises.
  {
    id: 'rnb-70s80s',
    label: '70s / 80s R&B',
    mode: 'major',
    progressions: [
      { id: 'rnb70-soultrain',  name: 'Soul Turnaround (Imaj7-vi7-ii7-V7)',     chords: ['Imaj7', 'vi7', 'ii7', 'V7'] },
      { id: 'rnb70-mercy',      name: 'Lush Descent (Imaj7-IVmaj7-iii7-vi7)',   chords: ['Imaj7', 'IVmaj7', 'iii7', 'vi7'] },
      { id: 'rnb70-letsstay',   name: 'Soulful Vamp (Imaj7-iii7-IV-iii7)',      chords: ['Imaj7', 'iii7', 'IV', 'iii7'] },
      { id: 'rnb70-lovelyday',  name: 'Sunshine Loop (Imaj7-ii7-iii7-ii7)',     chords: ['Imaj7', 'ii7', 'iii7', 'ii7'] },
      { id: 'rnb70-curtis',     name: 'Jazz-Soul Walk (vi7-ii7-V7-Imaj7)',      chords: ['vi7', 'ii7', 'V7', 'Imaj7'] },
      { id: 'rnb70-stevie',     name: 'Sunny Climb (Imaj7-iii7-IVmaj7-V7)',     chords: ['Imaj7', 'iii7', 'IVmaj7', 'V7'] },
      { id: 'rnb70-tsop',       name: 'Philly Strings (Imaj7-bIII-IVmaj7-V7)',  chords: ['Imaj7', 'bIII', 'IVmaj7', 'V7'] },
      { id: 'rnb70-ewf',        name: 'Horn-Section (Imaj7-bVII-IVmaj7-Imaj7)', chords: ['Imaj7', 'bVII', 'IVmaj7', 'Imaj7'] },
      { id: 'rnb70-vandross',   name: 'Smooth Ballad (Imaj7-IVmaj7-V7-vi7)',    chords: ['Imaj7', 'IVmaj7', 'V7', 'vi7'] },
      { id: 'rnb70-teddy',      name: 'Quiet-Storm Turn (ii7-V7-iii7-vi7)',     chords: ['ii7', 'V7', 'iii7', 'vi7'] },
      { id: 'rnb70-marvin',     name: 'Dominant-IV Soul (Imaj7-IV7-iii7-vi7)',  chords: ['Imaj7', 'IV7', 'iii7', 'vi7'] },
      { id: 'rnb70-smokey',     name: 'Soulful Descent (IVmaj7-iii7-ii7-Imaj7)', chords: ['IVmaj7', 'iii7', 'ii7', 'Imaj7'] },
      { id: 'rnb70-min-soul',   name: 'Minor Soul (i7-iv7-VImaj7-V7)',           mode: 'minor', chords: ['i7', 'iv7', 'VImaj7', 'V7'] },
      { id: 'rnb70-min-curtis', name: 'Curtis Minor (i7-VII7-VImaj7-iv7)',       mode: 'minor', chords: ['i7', 'VII7', 'VImaj7', 'iv7'] },
      { id: 'rnb70-min-philly', name: 'Philly Minor (i7-iv7-V7-VImaj7)',         mode: 'minor', chords: ['i7', 'iv7', 'V7', 'VImaj7'] },
      { id: 'rnb70-min-storm',  name: 'Quiet Storm Minor (i7-VImaj7-iiø7-V7)',    mode: 'minor', chords: ['i7', 'VImaj7', 'iiø7', 'V7'] },
    ],
  },
  {
    id: 'rnb-90s',
    label: '90s R&B',
    mode: 'major',
    progressions: [
      { id: 'rnb90-ballad',   name: 'Slow Jam (Imaj7-vi7-ii7-V7)',     chords: ['Imaj7', 'vi7', 'ii7', 'V7'] },
      { id: 'rnb90-turn',     name: 'Turnaround (ii7-V7-iii7-vi7)',    chords: ['ii7', 'V7', 'iii7', 'vi7'] },
      { id: 'rnb90-jodeci',   name: 'Group Harmony (Imaj7-iii7-vi7-V7)', chords: ['Imaj7', 'iii7', 'vi7', 'V7'] },
      { id: 'rnb90-descend',  name: 'Descend (IVmaj7-iii7-ii7-Imaj7)', chords: ['IVmaj7', 'iii7', 'ii7', 'Imaj7'] },
      { id: 'rnb90-mariah',   name: 'Diva (vi7-V-IV-V)',               chords: ['vi7', 'V', 'IV', 'V'] },
      { id: 'rnb90-boyz',     name: 'Vocal Group (Imaj7-ii7-Imaj7-IV)',chords: ['Imaj7', 'ii7', 'Imaj7', 'IV'] },
      { id: 'rnb90-sail',     name: 'Sail (Imaj7-vi7-IVmaj7-Vsus4)',   chords: ['Imaj7', 'vi7', 'IVmaj7', 'Vsus4'] },
      { id: 'rnb90-icecream', name: 'Smooth 50s DNA (I-vi-IV-V)',       chords: ['I', 'vi', 'IV', 'V'] },
      { id: 'rnb90-heart',    name: 'Heart Pull (vi-IV-I-V)',            chords: ['vi', 'IV', 'I', 'V'] },
      { id: 'rnb90-cloud',    name: 'Cloud Nine (Imaj7-IVmaj7-ii7-V7)',  chords: ['Imaj7', 'IVmaj7', 'ii7', 'V7'] },
      { id: 'rnb90-glide',    name: 'Glide Turn (Imaj7-iii7-ii7-V7)',    chords: ['Imaj7', 'iii7', 'ii7', 'V7'] },
      { id: 'rnb90-suspend',  name: 'Suspended Cry (Imaj7-IVmaj7-Vsus4-V7)', chords: ['Imaj7', 'IVmaj7', 'Vsus4', 'V7'] },
      { id: 'rnb90-gospel',   name: 'Church Color (Imaj7-bVII-IVmaj7-V7)', chords: ['Imaj7', 'bVII', 'IVmaj7', 'V7'] },
      { id: 'rnb90-min-jam',  name: '90s Minor Jam (i7-iv7-VII7-VImaj7)',  mode: 'minor', chords: ['i7', 'iv7', 'VII7', 'VImaj7'] },
      { id: 'rnb90-min-dark', name: 'Dark 90s (i7-bVI-bVII-V7)',           mode: 'minor', chords: ['i7', 'bVI', 'bVII', 'V7'] },
      { id: 'rnb90-min-group',name: 'Minor Harmony (i7-VImaj7-iv7-V7)',    mode: 'minor', chords: ['i7', 'VImaj7', 'iv7', 'V7'] },
      { id: 'rnb90-min-25',   name: 'Minor Two-Five (i7-iiø7-V7-i7)',      mode: 'minor', chords: ['i7', 'iiø7', 'V7', 'i7'] },
    ],
  },
  {
    id: 'rnb',
    label: 'Neo-Soul / Modern R&B',
    mode: 'major',
    progressions: [
      { id: 'rnb-quiet',  name: 'Quiet Storm (Imaj7-ii7-iii-IV)', chords: ['Imaj7', 'ii7', 'iii', 'IV'] },
      { id: 'rnb-25',     name: 'ii-V-I (ii7-V7-Imaj7)',          chords: ['ii7', 'V7', 'Imaj7', 'Imaj7'] },
      { id: 'rnb-circle', name: 'Circle (vi7-ii7-V7-Imaj7)',      chords: ['vi7', 'ii7', 'V7', 'Imaj7'] },
      { id: 'rnb-step',   name: 'Step-down (Imaj7-vii°-vi7-V)',   chords: ['Imaj7', 'vii°', 'vi7', 'V'] },
      { id: 'rnb-loop',   name: 'Loop (ii7-V7-iii-vi7)',          chords: ['ii7', 'V7', 'iii', 'vi7'] },
      { id: 'rnb-modern1',name: 'Modern Lift (Imaj7-vi7-IVmaj7-V7)', chords: ['Imaj7', 'vi7', 'IVmaj7', 'V7'] },
      { id: 'rnb-modern2',name: 'Dusky Axis (vi7-IVmaj7-Imaj7-V7)',   chords: ['vi7', 'IVmaj7', 'Imaj7', 'V7'] },
      { id: 'rnb-modern3',name: '2-5 Weave (ii7-V7-Imaj7-vi7)',        chords: ['ii7', 'V7', 'Imaj7', 'vi7'] },
      { id: 'rnb-modern4',name: 'Late Night (IVmaj7-iii7-vi7-V7)',     chords: ['IVmaj7', 'iii7', 'vi7', 'V7'] },
      { id: 'rnb-modern5',name: 'Borrowed Soul (Imaj7-bVII-IVmaj7-V7)',chords: ['Imaj7', 'bVII', 'IVmaj7', 'V7'] },
      { id: 'rnb-modern6',name: 'Tender Half-Dim (Imaj7-iiø7-V7-Imaj7)', chords: ['Imaj7', 'iiø7', 'V7', 'Imaj7'] },
      { id: 'rnb-modern7',name: 'Two-Chord Sway (Imaj7-IVmaj7)',        chords: ['Imaj7', 'IVmaj7', 'Imaj7', 'IVmaj7'] },
      { id: 'rnb-modern8',name: 'Falling Silk (Imaj7-iii7-ii7-Imaj7)',  chords: ['Imaj7', 'iii7', 'ii7', 'Imaj7'] },
      { id: 'rnb-viopen', name: 'Minor Lead (vi7-ii7-iii7-IVmaj7)',       chords: ['vi7', 'ii7', 'iii7', 'IVmaj7'] },
      { id: 'rnb-cycle7', name: 'Cycle Seven (vi7-ii7-V7-VII7)',          chords: ['vi7', 'ii7', 'V7', 'bVIImaj7'] },
      { id: 'rnb-min-pocket', name: 'Minor Pocket (i7-VImaj7-iv7-V7)',    mode: 'minor', chords: ['i7', 'VImaj7', 'iv7', 'V7'] },
      { id: 'rnb-min-dorian', name: 'Dorian Soul (i7-IV7-bVII-i7)',       mode: 'dorian', chords: ['i7', 'IV7', 'bVII', 'i7'] },
      { id: 'rnb-min-dark',   name: 'Dark Neo Loop (i7-VII7-VImaj7-iv7)', mode: 'minor', chords: ['i7', 'VII7', 'VImaj7', 'iv7'] },
      { id: 'rnb-min-25',     name: 'Minor Two-Five (i7-iiø7-V7-i7)',     mode: 'minor', chords: ['i7', 'iiø7', 'V7', 'i7'] },
    ],
  },
  // "True R&B" — the deep church-soul vocabulary that real R&B singers,
  // arrangers, and bandleaders actually reach for (Anita Baker, Sade,
  // D'Angelo, Maxwell, Lauryn Hill, Brandy, Tank, Musiq Soulchild,
  // Jazmine Sullivan territory). Heavy on Imaj7 / IVmaj7 anchors,
  // ii-V-I cycles, sus → V7 resolutions, modal-borrowed bVI / bVII,
  // and the half-diminished (iiø7) "tender tension" chord that
  // signals classic R&B more than any other voicing. Stays in major
  // mode so the progressions render against the bright tonic the
  // singer expects.
  {
    id: 'rnb-true',
    label: 'True R&B',
    mode: 'major',
    progressions: [
      { id: 'truernb-slowjam',    name: 'Slow Jam Crawl (Imaj7-iii7-vi7-IVmaj7)',  chords: ['Imaj7', 'iii7', 'vi7', 'IVmaj7'] },
      { id: 'truernb-susresolve', name: 'Sus Resolve (Imaj7-IVmaj7-Vsus4-V7)',     chords: ['Imaj7', 'IVmaj7', 'Vsus4', 'V7'] },
      { id: 'truernb-twocycle',   name: 'Two-Five Cycle (ii7-V7-iii7-vi7)',        chords: ['ii7', 'V7', 'iii7', 'vi7'] },
      { id: 'truernb-diatonic',   name: 'Diatonic Descent (Imaj7-vii°-vi7-V7)',    chords: ['Imaj7', 'vii°', 'vi7', 'V7'] },
      { id: 'truernb-modalift',   name: 'Modal Lift (Imaj7-bVII-IVmaj7-V7)',       chords: ['Imaj7', 'bVII', 'IVmaj7', 'V7'] },
      { id: 'truernb-deepsoul',   name: 'Deep Soul (Imaj7-bVI-bVII-Imaj7)',        chords: ['Imaj7', 'bVI', 'bVII', 'Imaj7'] },
      { id: 'truernb-tender',     name: 'Tender Tension (Imaj7-iiø7-V7-Imaj7)',    chords: ['Imaj7', 'iiø7', 'V7', 'Imaj7'] },
      { id: 'truernb-churchturn', name: 'Church Turnaround (vi7-ii7-V7-Imaj7)',    chords: ['vi7', 'ii7', 'V7', 'Imaj7'] },
      { id: 'truernb-quietcycle', name: 'Quiet-Storm Cycle (Imaj7-vi7-IVmaj7-V7)', chords: ['Imaj7', 'vi7', 'IVmaj7', 'V7'] },
      { id: 'truernb-pedalriff',  name: 'Pedal Riff (Imaj7-IVmaj7)',               chords: ['Imaj7', 'IVmaj7', 'Imaj7', 'IVmaj7'] },
      { id: 'truernb-falsetto',   name: 'Falsetto Lift (IVmaj7-iii7-ii7-Imaj7)',   chords: ['IVmaj7', 'iii7', 'ii7', 'Imaj7'] },
      { id: 'truernb-bridge',     name: 'Bridge Swell (iii7-vi7-ii7-V7)',          chords: ['iii7', 'vi7', 'ii7', 'V7'] },
      { id: 'truernb-vamp',       name: 'Maj7 Vamp (Imaj7-IVmaj7)',                 chords: ['Imaj7', 'IVmaj7', 'Imaj7', 'IVmaj7'] },
      { id: 'truernb-4251',       name: 'Four-Two-Five-One (IVmaj7-ii7-V7-Imaj7)',  chords: ['IVmaj7', 'ii7', 'V7', 'Imaj7'] },
      { id: 'truernb-minoropen',  name: 'Minor Open (vi7-IVmaj7-Imaj7-V7)',         chords: ['vi7', 'IVmaj7', 'Imaj7', 'V7'] },
      { id: 'truernb-widescreen', name: 'Widescreen (Imaj7-bIII-IVmaj7-V7)',        chords: ['Imaj7', 'bIII', 'IVmaj7', 'V7'] },
      { id: 'truernb-return',     name: 'Return Home (ii7-V7-Imaj7-IVmaj7)',        chords: ['ii7', 'V7', 'Imaj7', 'IVmaj7'] },
      { id: 'truernb-crystal',    name: 'Crystal Descent (Imaj7-iii7-ii7-vi7)',     chords: ['Imaj7', 'iii7', 'ii7', 'vi7'] },
      { id: 'truernb-prayer2',    name: 'Prayer Cadence (Imaj7-iiø7-V7-IVmaj7)',    chords: ['Imaj7', 'iiø7', 'V7', 'IVmaj7'] },
      { id: 'truernb-softdoor',   name: 'Soft Back Door (Imaj7-IV7-ii7-V7)',        chords: ['Imaj7', 'IV7', 'ii7', 'V7'] },
      // Minor-key True R&B — D'Angelo, Maxwell, Tank, Musiq, Jazmine Sullivan pocket.
      { id: 'truernb-min-25',      name: 'Minor Two-Five (i7-iiø7-V7-i7)',           mode: 'minor', chords: ['i7', 'iiø7', 'V7', 'i7'] },
      { id: 'truernb-min-cycle',   name: 'Minor Cycle (i7-iv7-VII7-VImaj7)',         mode: 'minor', chords: ['i7', 'iv7', 'VII7', 'VImaj7'] },
      { id: 'truernb-min-neo',     name: 'Neo Minor Vamp (i7-IV7-i7-bVII)',          mode: 'dorian', chords: ['i7', 'IV7', 'i7', 'bVII'] },
      { id: 'truernb-min-midnight',name: 'Midnight Minor (i7-VImaj7-iiø7-V7)',       mode: 'minor', chords: ['i7', 'VImaj7', 'iiø7', 'V7'] },
      { id: 'truernb-min-heart',   name: 'Heartbreak (i7-bVI-bVII-i7)',              mode: 'minor', chords: ['i7', 'bVI', 'bVII', 'i7'] },
      { id: 'truernb-min-late',    name: 'Late Night (i7-VII7-VImaj7-V7)',           mode: 'minor', chords: ['i7', 'VII7', 'VImaj7', 'V7'] },
      { id: 'truernb-min-gospel',  name: 'Minor Gospel (i7-iv7-V7-VImaj7)',          mode: 'minor', chords: ['i7', 'iv7', 'V7', 'VImaj7'] },
      { id: 'truernb-min-silk',    name: 'Silk Descent (i7-VImaj7-iv7-V7)',          mode: 'minor', chords: ['i7', 'VImaj7', 'iv7', 'V7'] },
      { id: 'truernb-min-bridge',  name: 'Minor Bridge (VImaj7-iiø7-V7-i7)',         mode: 'minor', chords: ['VImaj7', 'iiø7', 'V7', 'i7'] },
      { id: 'truernb-min-open',    name: 'Minor Open (i7-bIIImaj7-VImaj7-VII7)',     mode: 'minor', chords: ['i7', 'bIIImaj7', 'VImaj7', 'VII7'] },
    ],
  },
  {
    id: 'hiphop',
    label: 'Hip-Hop',
    mode: 'minor',
    progressions: [
      { id: 'hh-cinematic', name: 'Cinematic (i-VI-III-VII)', chords: ['i', 'VI', 'III', 'VII'] },
      { id: 'hh-loop',      name: 'Loop (i-VII-VI-VII)',      chords: ['i', 'VII', 'VI', 'VII'] },
      { id: 'hh-dark',      name: 'Dark (i-iv-VII-VI)',       chords: ['i', 'iv', 'VII', 'VI'] },
      { id: 'hh-three',     name: 'Three (i-iv-v)',           chords: ['i', 'iv', 'v', 'i'] },
      { id: 'hh-mellow',    name: 'Mellow (i7-iv7-VImaj7-V)', chords: ['i7', 'iv7', 'VImaj7', 'V'] },
    ],
  },
  {
    id: 'trap',
    label: 'Trap',
    mode: 'minor',
    progressions: [
      { id: 'trap-classic', name: 'Classic (i-VI-VII)',     chords: ['i', 'VI', 'VII', 'VII'] },
      { id: 'trap-step',    name: 'Step (i-v-VI-iv)',       chords: ['i', 'v', 'VI', 'iv'] },
      { id: 'trap-rise',    name: 'Rise (i-VII-VI-V)',      chords: ['i', 'VII', 'VI', 'V'] },
      { id: 'trap-haunt',   name: 'Haunt (i-iv-i-VII)',     chords: ['i', 'iv', 'i', 'VII'] },
      { id: 'trap-drill',   name: 'Drill (i-VI-iv-VII)',    chords: ['i', 'VI', 'iv', 'VII'] },
    ],
  },
  {
    id: 'house',
    label: 'House / Dance',
    mode: 'minor',
    progressions: [
      { id: 'house-classic', name: 'Classic (i-VII-VI-VII)',  chords: ['i', 'VII', 'VI', 'VII'] },
      { id: 'house-uplift',  name: 'Uplift (VI-VII-i-i)',     chords: ['VI', 'VII', 'i', 'i'] },
      { id: 'house-deep',    name: 'Deep (i7-iv7-VImaj7-V7)', chords: ['i7', 'iv7', 'VImaj7', 'V7'] },
      { id: 'house-loop',    name: 'Loop (i-iv-VII-III)',     chords: ['i', 'iv', 'VII', 'III'] },
    ],
  },
  {
    id: 'disco',
    label: 'Disco',
    mode: 'major',
    progressions: [
      { id: 'disco-classic',  name: 'Classic (Imaj7-vi7-ii7-V7)',     chords: ['Imaj7', 'vi7', 'ii7', 'V7'] },
      { id: 'disco-strings',  name: 'Strings (IVmaj7-iii7-ii7-Imaj7)',chords: ['IVmaj7', 'iii7', 'ii7', 'Imaj7'] },
      { id: 'disco-funk',     name: 'Funk Disco (ii7-V7-Imaj7-IV7)',  chords: ['ii7', 'V7', 'Imaj7', 'IV7'] },
      { id: 'disco-saturday', name: 'Saturday Night (vi7-ii7-V7-Imaj7)', chords: ['vi7', 'ii7', 'V7', 'Imaj7'] },
      { id: 'disco-anthem',   name: 'Anthem (Imaj7-V7-vi7-IV7)',      chords: ['Imaj7', 'V7', 'vi7', 'IV7'] },
      { id: 'disco-vamp',     name: 'Vamp (Imaj7-IVmaj7)',            chords: ['Imaj7', 'IVmaj7', 'Imaj7', 'IVmaj7'] },
    ],
  },
  // Broad-spectrum dance bucket. Lives in major mode so the disco and
  // up-tempo K-pop flavors get the bright, hopeful voicings producers
  // expect. The "dark dance" progressions reach the moody / club-floor
  // sound by borrowing minor chords from the parallel minor (bIII, bVI,
  // bVII) plus the natural minor tonic (vi) — same trick Charli XCX,
  // The Weeknd, NewJeans b-sides, and most modern Eurodance use to keep
  // a track danceable while sounding ominous. Naming format keeps each
  // sub-flavor obvious so producers can scan-and-pick fast.
  {
    id: 'dance',
    label: 'Dance (Disco · K-Pop · Dark)',
    mode: 'major',
    progressions: [
      // — Disco-leaning four-on-the-floor —
      { id: 'dance-discoturn',   name: 'Disco · Turnaround (Imaj7-vi7-ii7-V7)',  chords: ['Imaj7', 'vi7', 'ii7', 'V7'] },
      { id: 'dance-discoanthem', name: 'Disco · Anthem (I-V-vi-IV)',             chords: ['I', 'V', 'vi', 'IV'] },
      { id: 'dance-discovamp',   name: 'Disco · Vamp (Imaj7-IVmaj7)',            chords: ['Imaj7', 'IVmaj7', 'Imaj7', 'IVmaj7'] },
      { id: 'dance-discoshine',  name: 'Disco · Shine (Imaj7-iii7-IV7-V7)',      chords: ['Imaj7', 'iii7', 'IV7', 'V7'] },
      // — Up-Tempo K-Pop —
      { id: 'dance-kpopaxis',    name: 'K-Pop · Axis (I-V-vi-IV)',               chords: ['I', 'V', 'vi', 'IV'] },
      { id: 'dance-kpopchant',   name: 'K-Pop · Chant (vi-IV-I-V)',              chords: ['vi', 'IV', 'I', 'V'] },
      { id: 'dance-kpopglow',    name: 'K-Pop · Glow (Imaj7-iii7-IVmaj7-V)',     chords: ['Imaj7', 'iii7', 'IVmaj7', 'V'] },
      { id: 'dance-kpopsus',     name: 'K-Pop · Sus Lift (Isus4-V-vi7-IVmaj7)',  chords: ['Isus4', 'V', 'vi7', 'IVmaj7'] },
      { id: 'dance-kpoppush',    name: 'K-Pop · Push (IV-V-iii-vi)',             chords: ['IV', 'V', 'iii', 'vi'] },
      // — Dark Dance (modal-borrow into shadow chords) —
      { id: 'dance-darkbrat',    name: 'Dark · Brat Stomp (vi-bVI-bVII-V)',      chords: ['vi', 'bVI', 'bVII', 'V'] },
      { id: 'dance-darkdrive',   name: 'Dark · Drive (vi-IV-bVII-V)',            chords: ['vi', 'IV', 'bVII', 'V'] },
      { id: 'dance-darkpulse',   name: 'Dark · Pulse (vi-bVII-bIII-bVI)',        chords: ['vi', 'bVII', 'bIII', 'bVI'] },
      { id: 'dance-darknight',   name: 'Dark · Night Club (vi-bIII-bVII-IV)',    chords: ['vi', 'bIII', 'bVII', 'IV'] },
    ],
  },
  {
    id: 'gospel',
    label: 'Gospel / Soul',
    mode: 'major',
    progressions: [
      { id: 'gospel-amen',   name: 'Amen (I-IV-I-V)',           chords: ['I', 'IV', 'I', 'V'] },
      { id: 'gospel-25',     name: 'Gospel 2-5-1 (ii7-V7-I)',   chords: ['ii7', 'V7', 'Imaj7', 'Imaj7'] },
      { id: 'gospel-back',   name: 'Back Door (IV-iv-I)',       chords: ['IV', 'iv', 'I', 'I'] },
      { id: 'gospel-circle', name: 'Circle (vi-ii-V-I)',        chords: ['vi', 'ii', 'V', 'Imaj7'] },
      { id: 'gospel-praise', name: 'Praise (I-iii-IV-V)',       chords: ['I', 'iii', 'IV', 'V'] },
    ],
  },
  {
    id: 'jazz',
    label: 'Jazz Standards',
    mode: 'major',
    progressions: [
      { id: 'jazz-251',    name: 'ii-V-I (ii7-V7-Imaj7)',           chords: ['ii7', 'V7', 'Imaj7', 'Imaj7'] },
      { id: 'jazz-rhythm', name: 'Rhythm Changes (I-vi-ii-V)',      chords: ['Imaj7', 'vi7', 'ii7', 'V7'] },
      { id: 'jazz-bird',   name: 'Bebop Blues (I-V-ii-V)',          chords: ['Imaj7', 'V7', 'ii7', 'V7'] },
      { id: 'jazz-stepdn', name: 'Step Down (Imaj7-bIII-bVI-V7)',   chords: ['Imaj7', 'bIII', 'bVI', 'V7'] },
    ],
  },
  {
    id: 'rock',
    label: 'Rock / Indie',
    mode: 'major',
    progressions: [
      { id: 'rock-anthem', name: 'Anthem (I-V-IV)',       chords: ['I', 'V', 'IV', 'IV'] },
      { id: 'rock-indie',  name: 'Indie (I-iii-vi-IV)',   chords: ['I', 'iii', 'vi', 'IV'] },
      { id: 'rock-punk',   name: 'Punk (I-V-vi-IV)',      chords: ['I', 'V', 'vi', 'IV'] },
      { id: 'rock-grunge', name: 'Grunge (vi-IV-V-I)',    chords: ['vi', 'IV', 'V', 'I'] },
    ],
  },
  {
    id: 'blues',
    label: 'Blues',
    mode: 'major',
    progressions: [
      { id: 'blues-12bar',     name: '12-Bar (I7-I7-I7-I7-IV7-IV7-I7-I7-V7-IV7-I7-V7)',
        chords: ['I7','I7','I7','I7','IV7','IV7','I7','I7','V7','IV7','I7','V7'] },
      { id: 'blues-quick',     name: 'Quick-Change (I7-IV7-I7-I7-IV7-IV7-I7-I7-V7-IV7-I7-V7)',
        chords: ['I7','IV7','I7','I7','IV7','IV7','I7','I7','V7','IV7','I7','V7'] },
      { id: 'blues-jazz',      name: 'Jazz Blues (I7-IV7-I7-vi7-ii7-V7-I7-V7)',
        chords: ['I7','IV7','I7','vi7','ii7','V7','I7','V7'] },
      { id: 'blues-8bar',      name: '8-Bar (I7-V7-IV7-IV7-I7-V7-I7-V7)',
        chords: ['I7','V7','IV7','IV7','I7','V7','I7','V7'] },
      {
        id: 'blues-minor',
        name: 'Minor Blues (i-i-i-i-iv-iv-i-i-V7-iv-i-V7)',
        mode: 'minor',
        chords: ['i', 'i', 'i', 'i', 'iv', 'iv', 'i', 'i', 'V7', 'iv', 'i', 'V7'],
      },
      { id: 'blues-slow',      name: 'Slow Blues (I7-IV7-I7-V7)',
        chords: ['I7','IV7','I7','V7'] },
    ],
  },
  {
    id: 'lofi',
    label: 'Lo-Fi',
    mode: 'major',
    progressions: [
      { id: 'lofi-chill',    name: 'Chill (Imaj7-iii7-vi7-IVmaj7)',  chords: ['Imaj7', 'iii7', 'vi7', 'IVmaj7'] },
      { id: 'lofi-rainy',    name: 'Rainy (ii7-V7-iii7-vi7)',        chords: ['ii7', 'V7', 'iii7', 'vi7'] },
      { id: 'lofi-late',     name: 'Late Night (vi7-ii7-V7-Imaj7)',  chords: ['vi7', 'ii7', 'V7', 'Imaj7'] },
      { id: 'lofi-study',    name: 'Study (Imaj7-vi7-ii7-V7)',       chords: ['Imaj7', 'vi7', 'ii7', 'V7'] },
      { id: 'lofi-warm',     name: 'Warm (IVmaj7-iii7-ii7-Imaj7)',   chords: ['IVmaj7', 'iii7', 'ii7', 'Imaj7'] },
    ],
  },
  {
    id: 'funk',
    label: 'Funk',
    mode: 'minor',
    progressions: [
      { id: 'funk-vamp',     name: 'Vamp (i7-iv7)',                chords: ['i7', 'iv7', 'i7', 'iv7'] },
      { id: 'funk-james',    name: 'Hard Stab (i7-IV7)',           chords: ['i7', 'IV7', 'i7', 'IV7'] },
      { id: 'funk-stretch',  name: 'Stretch (i7-VII-VI-V7)',       chords: ['i7', 'VII', 'VI', 'V7'] },
      { id: 'funk-prince',   name: 'Funk Ballad (i7-iv7-VImaj7-V7)', chords: ['i7', 'iv7', 'VImaj7', 'V7'] },
    ],
  },
  {
    id: 'country',
    label: 'Country',
    mode: 'major',
    progressions: [
      { id: 'country-3chord', name: '3-Chord (I-IV-V)',           chords: ['I', 'IV', 'V', 'I'] },
      { id: 'country-modern', name: 'Modern (I-V-vi-IV)',         chords: ['I', 'V', 'vi', 'IV'] },
      { id: 'country-waltz',  name: 'Waltz (I-IV-I-V)',           chords: ['I', 'IV', 'I', 'V'] },
      { id: 'country-train',  name: 'Train (I-I-IV-V)',           chords: ['I', 'I', 'IV', 'V'] },
      { id: 'country-ballad', name: 'Ballad (vi-IV-I-V)',         chords: ['vi', 'IV', 'I', 'V'] },
    ],
  },
  // Afrobeats / Afropop — highlife & makosa (major) plus minor/Dorian m7 loops.
  // Distilled from common Naija producer vocabulary + contemporary Afrobeats harmony.
  {
    id: 'afrobeat',
    label: 'Afrobeats / Afropop',
    mode: 'minor',
    progressions: [
      { id: 'afro-makosa', name: 'Makosa · I–IV–V (Highlife)', mode: 'major', chords: ['I', 'IV', 'V', 'I'] },
      { id: 'afro-highlife', name: 'Highlife · I–IV–V–IV', mode: 'major', chords: ['I', 'IV', 'V', 'IV'] },
      { id: 'afro-donjazzy', name: 'Producer · I–ii–V–IV', mode: 'major', chords: ['I', 'ii', 'V', 'IV'] },
      { id: 'afro-naija', name: 'Naija Pop · I–IV–vi–V', mode: 'major', chords: ['I', 'IV', 'vi', 'V'] },
      { id: 'afro-sensitive', name: 'Afropop · vi–IV–I–V', mode: 'major', chords: ['vi', 'IV', 'I', 'V'] },
      { id: 'afro-uplift', name: 'Afropop Uplift · Imaj7–IV–V–vi', mode: 'major', chords: ['Imaj7', 'IV', 'V', 'vi'] },
      { id: 'afro-gospel', name: 'Afro Gospel · I–IV–I–V', mode: 'major', chords: ['I', 'IV', 'I', 'V'] },
      { id: 'afro-vamp', name: 'Classic Vamp · i7–iv7', chords: ['i7', 'iv7', 'i7', 'iv7'] },
      { id: 'afro-dorian', name: 'Dorian Groove · i7–IV7', mode: 'dorian', chords: ['i7', 'IV7', 'i7', 'IV7'] },
      { id: 'afro-neo', name: 'Neo Afro · i7–VImaj7–VII7–i7', chords: ['i7', 'VImaj7', 'VII7', 'i7'] },
      { id: 'afro-two', name: 'Two-Chord · i7–VII7', chords: ['i7', 'VII7', 'i7', 'VII7'] },
      { id: 'afro-modal', name: 'Modal Lift · i7–VII–VI–V7', chords: ['i7', 'VII', 'VI', 'V7'] },
      { id: 'afro-654', name: '654 · vi–V–IV', mode: 'major', chords: ['vi', 'V', 'IV', 'vi'] },
      { id: 'afro-6525', name: '6525 · vi–V–ii–V', mode: 'major', chords: ['vi', 'V', 'ii', 'V'] },
      { id: 'afro-amapiano', name: 'Amapiano Jazz · i7–VImaj7–iiø7–V7', chords: ['i7', 'VImaj7', 'iiø7', 'V7'] },
    ],
  },
  // UK garage / 2-step — skippy shuffle, warm m7 pads, reggae-borrowed offbeat harmony.
  {
    id: 'uk-garage',
    label: 'UK Garage · 2-Step',
    mode: 'minor',
    progressions: [
      { id: 'ukg-am-f', name: '2-Step · i7–VImaj7 (double)', chords: ['i7', 'i7', 'VImaj7', 'VImaj7'] },
      { id: 'ukg-soul', name: 'Soul Garage · i7–VImaj7–VII7–III7', chords: ['i7', 'VImaj7', 'VII7', 'III7'] },
      { id: 'ukg-vi-iv', name: 'vi–IV · R&B borrow', mode: 'major', chords: ['vi7', 'IVmaj7', 'Imaj7', 'V7'] },
      { id: 'ukg-turn', name: 'Turn · i7–VII7–VImaj7–V7', chords: ['i7', 'VII7', 'VImaj7', 'V7'] },
      { id: 'ukg-dorian', name: 'Dorian stab · i7–IV7', mode: 'dorian', chords: ['i7', 'IV7', 'i7', 'IV7'] },
      { id: 'ukg-dark', name: 'Dark garage · i7–VImaj7–V7–iv7', chords: ['i7', 'VImaj7', 'V7', 'iv7'] },
      { id: 'ukg-speed', name: 'Speed · i–VII–VI–V', chords: ['i', 'VII', 'VI', 'V'] },
      { id: 'ukg-reggae', name: 'Reggae snap · i–iv–VII–i', chords: ['i', 'iv', 'VII', 'i'] },
      { id: 'ukg-one-drop', name: 'One drop · I–IV–V–I', mode: 'major', chords: ['I', 'IV', 'V', 'I'] },
      { id: 'ukg-warm', name: 'Warm pad · i7–VImaj7–V7–III7', chords: ['i7', 'VImaj7', 'V7', 'III7'] },
      { id: 'ukg-minor9', name: 'Late night · i7–iv7–VII7–i7', chords: ['i7', 'iv7', 'VII7', 'i7'] },
      { id: 'ukg-bm', name: 'Polarity dark · i7–VImaj7–iv7–V7', chords: ['i7', 'VImaj7', 'iv7', 'V7'] },
    ],
  },
  // Reggae / dub / dancehall — one-drop, skank, i–iv–VII–i, dub snap (roots ~88–94 · snap ~100–102 BPM).
  {
    id: 'reggae',
    label: 'Reggae · Dub · Dancehall',
    mode: 'minor',
    progressions: [
      { id: 'reg-one-drop', name: 'One Drop · I–IV–V–I', mode: 'major', chords: ['I', 'IV', 'V', 'I'] },
      { id: 'reg-skank', name: 'Skank · I–IV–V–I', mode: 'major', chords: ['I', 'IV', 'V', 'I'] },
      { id: 'reg-minor', name: 'Roots Minor · i–iv–VII–i', chords: ['i', 'iv', 'VII', 'i'] },
      { id: 'reg-island', name: 'Island · i–VII–VI–VII', chords: ['i', 'VII', 'VI', 'VII'] },
      { id: 'reg-dub', name: 'Dub Snap · i7–VII7–VImaj7–V7', chords: ['i7', 'VII7', 'VImaj7', 'V7'] },
      { id: 'reg-count', name: 'Count Snap · i–iv–V–i', chords: ['i', 'iv', 'V', 'i'] },
      { id: 'reg-dancehall', name: 'Dancehall · i–VII–i–VII', chords: ['i', 'VII', 'i', 'VII'] },
      { id: 'reg-steel', name: 'Steel Pulse · i–bVII–bVI–V7', chords: ['i', 'bVII', 'bVI', 'V7'] },
      { id: 'reg-gospel', name: 'Gospel Reggae · I–IV–I–V', mode: 'major', chords: ['I', 'IV', 'I', 'V'] },
      { id: 'reg-two', name: 'Two-Chord · i–IV7', chords: ['i', 'IV7', 'i', 'IV7'] },
      { id: 'reg-am-loop', name: 'Am Loop · i–v–VI–VII', chords: ['i', 'v', 'VI', 'VII'] },
      { id: 'reg-dorian', name: 'Dorian Skank · i7–IV7', mode: 'dorian', chords: ['i7', 'IV7', 'i7', 'IV7'] },
      { id: 'reg-bubble', name: 'Bubble · i7–iv7', chords: ['i7', 'iv7', 'i7', 'iv7'] },
      { id: 'reg-dm-drop', name: 'Dm One Drop · i–iv–v–i', chords: ['i', 'iv', 'v', 'i'] },
      { id: 'reg-offbeat', name: 'Offbeat · i–VII–IV–i', chords: ['i', 'VII', 'IV', 'i'] },
    ],
  },
];

for (const genre of GENRES) {
  const extra = GENRE_MINOR_EXPANSIONS[genre.id];
  if (extra?.length) genre.progressions.push(...extra);
}

export function getGenre(id: string): GenreDef | undefined {
  return GENRES.find((g) => g.id === id);
}

/** True when a genre pack has at least one progression for the user's key family. */
export function genreHasProgressionsForMode(genreId: string, wantMode: ChordMode): boolean {
  const genre = getGenre(genreId);
  if (!genre) return false;
  const want = MODE_FAMILY[wantMode];
  for (const prog of genre.progressions) {
    const progMode = (prog.mode ?? genre.mode) as ChordMode;
    const have = MODE_FAMILY[progMode];
    if (want === 'other') {
      if (have === 'other') return true;
    } else if (want === have) {
      return true;
    }
  }
  return false;
}

export function getPattern(id: string): PatternDef | undefined {
  return PATTERNS.find((p) => p.id === id);
}

/**
 * Auto-fit a MIDI pitch into a target band by octave-shifting. Used so that
 * a generated voicing always lands somewhere inside the visible piano roll
 * regardless of key transposition.
 */
function fitIntoBand(midi: number, lowMidi: number, highMidi: number): number {
  let m = midi;
  while (m < lowMidi) m += 12;
  while (m > highMidi) m -= 12;
  return m;
}

/**
 * Expand a Roman-numeral progression + pattern into a list of MIDI events on
 * the quarter-note column grid. Octaves are auto-fitted to the supplied band
 * (defaults match the Creation Station note range — A3..C5 by default, but the
 * caller passes the actual displayed band which respects `pianoRegisterShift`).
 */
export function buildChordEvents(args: {
  progression: ChordSymbol[];
  keyRoot: number;
  mode: ChordMode;
  pattern: PatternDef;
  barsPerChord: number;
  /** Column where the first chord starts (in quarter-note cols). */
  startCol: number;
  /** Quarter-note columns per bar (matches CreationStation `MEASURES_PER_BAR`). */
  colsPerBar: number;
  /** MIDI band the host can render (auto-fit by octave). */
  bandLow: number;
  bandHigh: number;
  /** Anchor octave for the chord root before band fitting. */
  baseOctave?: number;
  /** When set, drives roll preview / highlights (smart voicing, spread, etc.). */
  resolveMidis?: (symbol: ChordSymbol, prev: ChordSymbol | null) => number[] | null;
}): ChordEventOut[] {
  const { progression, keyRoot, mode, pattern, barsPerChord, startCol, colsPerBar, bandLow, bandHigh } = args;
  const baseOctave = args.baseOctave ?? 4;
  const out: ChordEventOut[] = [];
  const stride = Math.max(1, Math.round(barsPerChord * colsPerBar));
  for (let i = 0; i < progression.length; i++) {
    const sym = progression[i]!;
    const prev = i > 0 ? progression[i - 1]! : null;
    const voicing = args.resolveMidis
      ? args.resolveMidis(sym, prev)
      : chordSymbolToMidi(sym, keyRoot, mode, baseOctave);
    if (!voicing || voicing.length === 0) continue;
    const sorted = [...voicing].sort((a, b) => a - b);
    const bass = fitIntoBand(sorted[0]!, bandLow, bandHigh);
    const top  = fitIntoBand(sorted[sorted.length - 1]!, bandLow, bandHigh);
    const chordPitches = sorted.map((m) => fitIntoBand(m, bandLow, bandHigh));
    const chordStartCol = startCol + i * stride;
    for (const ev of pattern.events) {
      const evCol = chordStartCol + Math.round(ev.beatOffset);
      if (ev.voice === 'bass') {
        out.push({ midi: bass, col: evCol });
      } else if (ev.voice === 'top') {
        out.push({ midi: top, col: evCol });
      } else {
        for (const m of chordPitches) out.push({ midi: m, col: evCol });
      }
    }
  }
  return out;
}

/**
 * Return the top-N chord symbols most likely to follow `prev` based on the
 * curated progressions in the supplied genre. Results are sorted by
 * transition frequency (highest first) and capped at `topN`. The shape gives
 * the caller both the chord and its weight so the UI can size or rank chips.
 *
 * If `prev` never appears in any progression for this genre, the function
 * falls back to the most-common starting chords in the genre so the user
 * always has *something* clickable.
 */
export function suggestLikelyNextChords(
  prev: ChordSymbol,
  genre: GenreDef,
  topN: number = 5,
): { chord: ChordSymbol; weight: number }[] {
  const counts: Record<string, number> = {};
  for (const prog of genre.progressions) {
    for (let i = 0; i < prog.chords.length; i++) {
      if (prog.chords[i] !== prev) continue;
      const next = i < prog.chords.length - 1 ? prog.chords[i + 1]! : prog.chords[0]!;
      counts[next] = (counts[next] ?? 0) + 1;
    }
  }
  let entries = Object.entries(counts);
  if (entries.length === 0) {
    const startCounts: Record<string, number> = {};
    for (const prog of genre.progressions) {
      const first = prog.chords[0];
      if (first) startCounts[first] = (startCounts[first] ?? 0) + 1;
    }
    entries = Object.entries(startCounts);
  }
  return entries
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([chord, weight]) => ({ chord, weight }));
}

/**
 * Find every curated progression in `genre` that contains the given chord
 * symbol. Used by the "Progressions using {chord}" suggestion strip so the
 * user can see which canonical loops are built around the chord they tapped.
 */
export function findProgressionsWithChord(
  chord: ChordSymbol,
  genre: GenreDef,
): ProgressionDef[] {
  return genre.progressions.filter((p) => p.chords.includes(chord));
}

/**
 * Suggest the next chord after `prev` by mining transitions out of the
 * progressions in the supplied genre. This is the "rule-based ChordSeqAI" —
 * the curated data IS the model. If no transitions match, fall back to the
 * most common starting chord in the genre.
 *
 * Random selection is weighted by transition frequency; pass a custom `rand`
 * fn (returns [0,1)) for deterministic tests.
 */
export function suggestNextChord(
  prev: ChordSymbol | null,
  genre: GenreDef,
  rand: () => number = Math.random,
  mode: ChordMode = genre.mode,
): ChordSymbol {
  const validInMode = (c: ChordSymbol) => chordSymbolToMidi(c, 0, mode) !== null;
  const prevNorm = prev ? coerceChordSymbolForMode(prev, mode, genre.mode) : null;

  if (prevNorm) {
    const counts: Record<string, number> = {};
    for (const prog of genre.progressions) {
      for (let i = 0; i < prog.chords.length; i++) {
        const cur = coerceChordSymbolForMode(prog.chords[i]!, mode, genre.mode);
        if (cur !== prevNorm) continue;
        const rawNext = i < prog.chords.length - 1 ? prog.chords[i + 1]! : prog.chords[0]!;
        const next = coerceChordSymbolForMode(rawNext, mode, genre.mode);
        if (!validInMode(next)) continue;
        counts[next] = (counts[next] ?? 0) + 1;
      }
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (total > 0) {
      let r = rand() * total;
      for (const [chord, c] of Object.entries(counts)) {
        r -= c;
        if (r <= 0) return chord;
      }
    }
  }
  const startCounts: Record<string, number> = {};
  for (const prog of genre.progressions) {
    const first = prog.chords[0];
    if (!first) continue;
    const coerced = coerceChordSymbolForMode(first, mode, genre.mode);
    if (!validInMode(coerced)) continue;
    startCounts[coerced] = (startCounts[coerced] ?? 0) + 1;
  }
  const ranked = Object.entries(startCounts).sort((a, b) => b[1] - a[1]);
  return ranked[0]?.[0] ?? getModeDefaultChord(mode);
}
