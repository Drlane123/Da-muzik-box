/**
 * Groove Pattern Engine — musically curated pattern generator for the AI
 * Pattern Generator. Replaces the previous random-toggle approach with
 * REAL hand-crafted grooves that actually sound like music.
 *
 * Why rule-based instead of ML?
 *   The previous generator used Magenta `MusicRNN` with a random procedural
 *   fallback. Even when the model loaded, the output was just MIDI pitches
 *   thrown onto a step grid without any awareness of the song's key,
 *   chord, or how the drum/bass/melody should relate to each other. The
 *   result was "patterns" that toggled cells but didn't make music.
 *
 *   Real music doesn't come from random toggles. It comes from a few
 *   universal templates (kick on 1, snare on 2 & 4, bass-on-kick, melody
 *   on chord tones) plus the producer's taste. This engine encodes those
 *   templates directly: every drum groove was hand-built to match the
 *   genre, every bassline locks to the kick, every melody is constrained
 *   to a scale and resolves toward the tonic.
 *
 * Architecture:
 *   - `DRUM_GROOVES` — readonly catalog of (style → 3-4 variations) of
 *     full 8-row × 16-step boolean grids. Each variation was crafted to
 *     sound like that genre (Trap kicks roll, House sits on 4-on-the-
 *     floor, Drill slides, Boom Bap lays back, etc.).
 *   - `generateDrumGroove(style, seed)` — picks one variation, optionally
 *     adds tasteful fills/ghost notes deterministically from the seed.
 *   - `generateBassPattern(drumPattern, key, mode, style, seed)` — places
 *     bass notes on every kick hit, walks the scale across bars, adds a
 *     passing tone at the end of every 4-bar phrase.
 *   - `generateMelodyPattern(key, mode, style, drumPattern?, seed)` —
 *     picks a rhythmic template, then assigns scale-tone pitches that
 *     resolve toward the tonic by the last beat.
 *   - `generatePadPattern(key, mode, style, seed)` — long sustained
 *     chord-tone notes over the whole pattern (root, third, fifth).
 *
 * Public types & symbols are exported so `magentaPatternGenerator.ts`
 * can re-export them under the existing function names — no surface
 * change in the AI Pattern UI's import sites.
 */

// ──────────────────────────────────────────────────────────────────────
// Shared constants
// ──────────────────────────────────────────────────────────────────────

const ROWS = 8;
const STEPS = 16;

/** Drum row index assignments. Order MUST match `NOTE_NAMES` in
 *  `AiPatternScreen.tsx` and `DRUM_ROW_CHANNELS` in `aiPatternRender.ts`. */
const KICK_ROW = 0;
const SNARE_ROW = 1;
const CLAP_ROW = 2;
const HHAT_ROW = 3;
const OPEN_ROW = 4;
const TOMHI_ROW = 5;
const TOMLO_ROW = 6;
const RIM_ROW = 7;

/** Empty 8-row × 16-step grid. Each generator clones this and toggles cells. */
function emptyGrid(): boolean[][] {
  return Array.from({ length: ROWS }, () => Array.from({ length: STEPS }, () => false));
}

// ──────────────────────────────────────────────────────────────────────
// Music theory helpers
// ──────────────────────────────────────────────────────────────────────

/** 12-note key root index. C = 0, C# = 1, … B = 11. The numeric value
 *  is the offset to add to a "C-rooted" MIDI pitch to reach the target
 *  key. */
export type KeyRoot = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

/** Diatonic mode. Major = Ionian (W-W-H-W-W-W-H); Minor = Aeolian
 *  (W-H-W-W-H-W-W). Drives bass + melody scale-degree picks. */
export type Mode = 'major' | 'minor';

export const KEY_LABELS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/** Diatonic interval pattern (semitones from root) for each mode. */
const MODE_INTERVALS: Record<Mode, ReadonlyArray<number>> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
};

/** Map an AI Pattern row index (0..7) to a scale degree offset in
 *  semitones from the key root. Row 0 = degree I, row 7 = octave up. */
function rowToSemitone(row: number, mode: Mode): number {
  const intervals = MODE_INTERVALS[mode];
  if (row < intervals.length) return intervals[row]!;
  return intervals[intervals.length - 1]! + 12; // octave fallback
}

/** Given a scale-degree row, the key root offset, and a base MIDI
 *  pitch, compute the actual MIDI pitch. Used as the source of truth
 *  for what each cell in the AI Pattern grid represents pitch-wise. */
export function rowToMidi(row: number, keyRoot: KeyRoot, mode: Mode, baseMidi: number): number {
  return baseMidi + keyRoot + rowToSemitone(row, mode);
}

// ──────────────────────────────────────────────────────────────────────
// Deterministic PRNG
// ──────────────────────────────────────────────────────────────────────

/** Mulberry32 — fast, stable PRNG. Same seed → same sequence so the
 *  same Generate click always produces the same pattern (helpful for
 *  user trust and undo). */
export function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash any list of inputs into a 32-bit unsigned seed value. */
export function mixSeed(parts: (string | number)[]): number {
  let h = 2166136261;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
  }
  return h >>> 0;
}

// ──────────────────────────────────────────────────────────────────────
// Drum grooves
// ──────────────────────────────────────────────────────────────────────

/** Normalized style id. The AI Pattern UI's free-form style string is
 *  funnelled through `normalizeStyle` to land on one of these keys. */
export type DrumStyleId =
  | 'trap'
  | 'boombap'
  | 'lofi'
  | 'house'
  | 'disco'
  | 'techno'
  | 'drill'
  | 'jazz'
  | 'soul'
  | 'rnb'
  | 'blues'
  | 'doowop'
  | 'country'
  | 'cinematic'
  | 'dark'
  | 'latin';

export function normalizeStyle(style: string): DrumStyleId {
  const s = style.toLowerCase().trim();
  if (/drill/.test(s)) return 'drill';
  if (/(trap|arpeggio)/.test(s)) return 'trap';
  if (/boom\s*bap|boombap/.test(s)) return 'boombap';
  if (/lo-?fi|lofi/.test(s)) return 'lofi';
  if (/disco/.test(s)) return 'disco';
  if (/house/.test(s)) return 'house';
  if (/techno|industrial/.test(s)) return 'techno';
  if (/jazz/.test(s)) return 'jazz';
  if (/southern|soul/.test(s)) return 'soul';
  if (/r&b|rnb/.test(s)) return 'rnb';
  if (/blues/.test(s)) return 'blues';
  if (/doo\s*wop|doowop/.test(s)) return 'doowop';
  if (/country|train/.test(s)) return 'country';
  if (/cinematic/.test(s)) return 'cinematic';
  if (/dark/.test(s)) return 'dark';
  if (/(afro|latin|dembow|reggaeton)/.test(s)) return 'latin';
  return 'trap';
}

/** A single hand-crafted drum groove. Each entry is a list of step
 *  indices (0..15) where that row fires. We use sparse lists because
 *  it's easier to read + hand-edit than full 16-bit masks. */
interface GrooveTemplate {
  kick: ReadonlyArray<number>;
  snare: ReadonlyArray<number>;
  clap: ReadonlyArray<number>;
  hhat: ReadonlyArray<number>;
  open: ReadonlyArray<number>;
  tomHi?: ReadonlyArray<number>;
  tomLo?: ReadonlyArray<number>;
  rim?: ReadonlyArray<number>;
}

/** Curated groove catalog. Each style has 3+ musically-distinct
 *  variations. Adding more is straightforward — just append to the
 *  array. The selected variation rotates by seed so re-clicking
 *  Generate gives the user a different feel. */
const DRUM_GROOVES: Record<DrumStyleId, ReadonlyArray<GrooveTemplate>> = {
  // ── TRAP ──
  // Modern trap groove: half-time snare on beat 3, rolling kicks, hat
  // 16ths with rolls. Variations vary kick placement and roll density.
  trap: [
    {
      // Variation 1 — Classic 808
      kick: [0, 7, 10, 14],
      snare: [],
      clap: [4, 12],
      hhat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      open: [6, 14],
      rim: [],
    },
    {
      // Variation 2 — Skippy with 32nd roll
      kick: [0, 6, 8, 11],
      snare: [],
      clap: [4, 12],
      hhat: [0, 2, 4, 6, 8, 10, 12, 13, 14, 15],
      open: [11],
      rim: [],
    },
    {
      // Variation 3 — Hard / Drill-adjacent
      kick: [0, 5, 8, 13],
      snare: [],
      clap: [4, 12],
      hhat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      open: [14],
      rim: [15],
    },
  ],

  // ── BOOM BAP ──
  // East-coast hip-hop. Laid back kick, snare on 2 & 4, swung 8th hats.
  boombap: [
    {
      kick: [0, 10],
      snare: [4, 12],
      clap: [],
      hhat: [0, 2, 4, 6, 8, 10, 12, 14],
      open: [],
      rim: [],
    },
    {
      kick: [0, 8, 10],
      snare: [4, 12],
      clap: [],
      hhat: [0, 2, 4, 6, 8, 10, 12, 14],
      open: [7],
      rim: [],
    },
    {
      kick: [0, 6, 11],
      snare: [4, 12],
      clap: [],
      hhat: [0, 2, 4, 6, 8, 10, 12, 14],
      open: [3, 11],
      rim: [],
    },
  ],

  // ── LO-FI ──
  // Sloppy, slightly off-grid feel. Kick on the "and", offbeat hats.
  lofi: [
    {
      kick: [0, 8, 11],
      snare: [4, 12],
      clap: [],
      hhat: [2, 6, 9, 14],
      open: [],
      rim: [],
    },
    {
      kick: [0, 7, 10],
      snare: [4, 12],
      clap: [],
      hhat: [1, 5, 9, 13],
      open: [],
      rim: [3],
    },
    {
      kick: [0, 6, 10],
      snare: [4, 12],
      clap: [],
      hhat: [0, 3, 6, 9, 12, 15],
      open: [11],
      rim: [],
    },
  ],

  // ── HOUSE ──
  // Four-on-the-floor. Kick every quarter, clap on 2 & 4, open hat on the "and".
  house: [
    {
      kick: [0, 4, 8, 12],
      snare: [],
      clap: [4, 12],
      hhat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      open: [2, 6, 10, 14],
      rim: [],
    },
    {
      kick: [0, 4, 8, 12],
      snare: [],
      clap: [4, 12],
      hhat: [2, 6, 10, 14],
      open: [],
      rim: [],
    },
    {
      kick: [0, 4, 8, 12],
      snare: [],
      clap: [4, 12],
      hhat: [0, 2, 4, 6, 8, 10, 12, 14],
      open: [2, 6, 10, 14],
      rim: [7, 15],
    },
  ],

  // ── DISCO ──
  // Four-on-the-floor with a busier hat pattern.
  disco: [
    {
      kick: [0, 4, 8, 12],
      snare: [4, 12],
      clap: [],
      hhat: [0, 2, 4, 6, 8, 10, 12, 14],
      open: [2, 6, 10, 14],
      rim: [],
    },
    {
      kick: [0, 2, 4, 6, 8, 10, 12, 14],
      snare: [4, 12],
      clap: [4, 12],
      hhat: [1, 3, 5, 7, 9, 11, 13, 15],
      open: [2, 6, 10, 14],
      rim: [],
    },
    {
      kick: [0, 4, 8, 12],
      snare: [4, 12],
      clap: [],
      hhat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      open: [6, 14],
      rim: [],
    },
  ],

  // ── TECHNO ──
  // Pumping 4-on-the-floor with relentless drive.
  techno: [
    {
      kick: [0, 4, 8, 12],
      snare: [],
      clap: [4, 12],
      hhat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      open: [2, 6, 10, 14],
      rim: [],
    },
    {
      kick: [0, 4, 8, 12],
      snare: [4, 12],
      clap: [],
      hhat: [2, 6, 10, 14],
      open: [],
      rim: [7, 15],
    },
    {
      kick: [0, 4, 7, 8, 12, 15],
      snare: [],
      clap: [4, 12],
      hhat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      open: [],
      rim: [],
    },
  ],

  // ── DRILL ──
  // UK drill / Brooklyn drill. Sliding kicks, off-kilter snare, triplet feel.
  drill: [
    {
      kick: [0, 6, 8, 11, 14],
      snare: [4, 12],
      clap: [],
      hhat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      open: [10, 14],
      rim: [],
    },
    {
      kick: [0, 5, 8, 13, 15],
      snare: [4, 12],
      clap: [],
      hhat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      open: [],
      rim: [11],
    },
    {
      kick: [0, 3, 8, 11, 14],
      snare: [4, 12],
      clap: [],
      hhat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      open: [6, 14],
      rim: [],
    },
  ],

  // ── JAZZ / SWING ──
  // Brushed snare, ride pattern (using hat row), swung feel.
  jazz: [
    {
      kick: [0, 11],
      snare: [4, 12],
      clap: [],
      // Swing eighths: 0, 3, 4, 7, 8, 11, 12, 15 — approximates triplet feel
      hhat: [0, 3, 4, 7, 8, 11, 12, 15],
      open: [],
      rim: [6, 14],
    },
    {
      kick: [0, 8],
      snare: [4, 12],
      clap: [],
      hhat: [0, 3, 4, 7, 8, 11, 12, 15],
      open: [],
      rim: [10],
    },
  ],

  // ── SOUL / SOUTHERN ──
  // Pocket groove. Cross-stick snare, ghost notes, kick on the pocket.
  soul: [
    {
      kick: [0, 6, 8],
      snare: [4, 12],
      clap: [],
      hhat: [0, 2, 4, 6, 8, 10, 12, 14],
      open: [],
      rim: [3, 11],
    },
    {
      kick: [0, 8, 10],
      snare: [4, 12],
      clap: [],
      hhat: [0, 2, 4, 6, 8, 10, 12, 14],
      open: [],
      rim: [7],
    },
    {
      kick: [0, 7, 10],
      snare: [4, 12],
      clap: [],
      hhat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      open: [],
      rim: [3, 11, 15],
    },
  ],

  // ── R&B ──
  // Smooth, ghosted, often half-time. Hat 8ths or 16ths.
  rnb: [
    {
      kick: [0, 8, 11],
      snare: [4, 12],
      clap: [],
      hhat: [0, 2, 4, 6, 8, 10, 12, 14],
      open: [],
      rim: [],
    },
    {
      kick: [0, 9, 11],
      snare: [4, 12],
      clap: [],
      hhat: [0, 2, 4, 6, 8, 10, 12, 14],
      open: [],
      rim: [7],
    },
    {
      kick: [0, 6, 10],
      snare: [4, 12],
      clap: [],
      hhat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      open: [],
      rim: [],
    },
  ],

  // ── BLUES ──
  // 12/8 shuffle feel approximated on a 16-step grid.
  blues: [
    {
      kick: [0, 8],
      snare: [4, 12],
      clap: [],
      hhat: [0, 3, 4, 7, 8, 11, 12, 15],
      open: [],
      rim: [],
    },
    {
      kick: [0, 4, 8, 12],
      snare: [4, 12],
      clap: [],
      hhat: [0, 3, 4, 7, 8, 11, 12, 15],
      open: [],
      rim: [],
    },
  ],

  // ── DOO-WOP ──
  // Backbeat shuffle.
  doowop: [
    {
      kick: [0, 8],
      snare: [4, 12],
      clap: [],
      hhat: [0, 2, 4, 6, 8, 10, 12, 14],
      open: [],
      rim: [],
    },
    {
      kick: [0, 4, 8, 12],
      snare: [4, 12],
      clap: [],
      hhat: [0, 2, 4, 6, 8, 10, 12, 14],
      open: [6, 14],
      rim: [],
    },
  ],

  // ── COUNTRY / TRAIN ──
  country: [
    {
      kick: [0, 4, 8, 12],
      snare: [4, 12],
      clap: [],
      hhat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      open: [],
      rim: [],
    },
    {
      kick: [0, 8],
      snare: [4, 12],
      clap: [],
      hhat: [0, 2, 4, 6, 8, 10, 12, 14],
      open: [],
      rim: [3, 11],
    },
  ],

  // ── CINEMATIC ──
  // Big sparse hits, builds tension. Toms for impacts.
  cinematic: [
    {
      kick: [0, 12],
      snare: [4, 12],
      clap: [],
      hhat: [],
      open: [],
      tomHi: [14],
      tomLo: [15],
      rim: [],
    },
    {
      kick: [0, 9],
      snare: [4, 12],
      clap: [],
      hhat: [0, 4, 8, 12],
      open: [],
      tomHi: [13],
      tomLo: [14, 15],
      rim: [],
    },
  ],

  // ── DARK ──
  // Sparse, ominous. Off-kilter snare.
  dark: [
    {
      kick: [0, 9],
      snare: [4, 12],
      clap: [],
      hhat: [2, 6, 10, 14],
      open: [],
      rim: [],
    },
    {
      kick: [0, 11],
      snare: [4, 12, 14],
      clap: [],
      hhat: [2, 6, 10, 14],
      open: [7],
      rim: [],
    },
  ],

  // ── LATIN / REGGAETON ──
  // Dembow groove. Kick on the syncopated 3+3+2.
  latin: [
    {
      kick: [0, 3, 6, 8, 10, 11, 14],
      snare: [3, 7, 11, 15],
      clap: [],
      hhat: [0, 2, 4, 6, 8, 10, 12, 14],
      open: [],
      rim: [],
    },
    {
      kick: [0, 6, 8, 14],
      snare: [4, 12],
      clap: [],
      hhat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      open: [],
      tomHi: [2, 10],
      tomLo: [6, 14],
      rim: [],
    },
  ],
};

/** Convert a sparse groove template (lists of step indices) to the
 *  dense 8-row × 16-step boolean grid that the AI Pattern Generator
 *  expects. */
function templateToGrid(t: GrooveTemplate): boolean[][] {
  const grid = emptyGrid();
  for (const s of t.kick)  grid[KICK_ROW]![s] = true;
  for (const s of t.snare) grid[SNARE_ROW]![s] = true;
  for (const s of t.clap)  grid[CLAP_ROW]![s] = true;
  for (const s of t.hhat)  grid[HHAT_ROW]![s] = true;
  for (const s of t.open)  grid[OPEN_ROW]![s] = true;
  if (t.tomHi) for (const s of t.tomHi) grid[TOMHI_ROW]![s] = true;
  if (t.tomLo) for (const s of t.tomLo) grid[TOMLO_ROW]![s] = true;
  if (t.rim)   for (const s of t.rim)   grid[RIM_ROW]![s] = true;
  return grid;
}

/** Generate a curated drum groove. Picks one of the genre's variations
 *  deterministically from `seed`, then optionally adds tasteful ghost
 *  notes / fills (currently disabled — the templates already sound
 *  finished without random embellishment, which is the whole point of
 *  switching away from the random-toggle generator). */
export function generateDrumGroove(style: string, seed: number, _temperature = 1.0): boolean[][] {
  const styleId = normalizeStyle(style);
  const variations = DRUM_GROOVES[styleId];
  const rng = mulberry32(seed);
  const pick = Math.floor(rng() * variations.length);
  return templateToGrid(variations[pick]!);
}

/** Replicate / extend a 1-bar drum groove across `bars` bars by
 *  copying the source pattern. The 16-step grid is one bar of 1/16
 *  notes; longer loops repeat the same groove (most genres do exactly
 *  this — variation in real music is in melody/bass, not drums). */
export function extendDrumGrooveToBars(grid: boolean[][], bars: number): boolean[][] {
  if (bars <= 1) return grid;
  const totalSteps = bars * STEPS;
  return grid.map((row) => {
    const out = new Array<boolean>(totalSteps);
    for (let s = 0; s < totalSteps; s++) out[s] = row[s % STEPS]!;
    return out;
  });
}

// ──────────────────────────────────────────────────────────────────────
// Bass generator
// ──────────────────────────────────────────────────────────────────────

/** Bass voicings — which scale degrees the bass plays in a given style.
 *  Each entry is a sequence of row indices (0 = root, 4 = fifth,
 *  7 = octave). Repeats across kick hits within a bar; advances by
 *  one entry every 4 bars. */
const BASS_VOICINGS: Record<DrumStyleId, ReadonlyArray<number>> = {
  // Trap / Drill — heavy on root + octave, occasional fifth slide.
  trap:       [0, 0, 0, 4, 0, 0, 7, 4],
  drill:      [0, 0, 0, 4, 0, 0, 7, 4],
  // Boom Bap — walking root-fifth-root pattern.
  boombap:    [0, 4, 0, 4, 0, 4, 7, 4],
  // House / Disco / Techno — sustained root with octave on phrase end.
  house:      [0, 0, 4, 7, 0, 0, 4, 7],
  disco:      [0, 0, 4, 0, 0, 0, 4, 7],
  techno:     [0, 0, 0, 0, 0, 0, 0, 0],
  // Soul / R&B — busier walking line.
  soul:       [0, 2, 4, 5, 0, 4, 7, 4],
  rnb:        [0, 2, 4, 5, 0, 4, 7, 4],
  blues:      [0, 2, 4, 5, 0, 4, 7, 5],
  // Lo-fi — sparse, mostly root.
  lofi:       [0, 0, 0, 4, 0, 0, 7, 4],
  // Jazz — walking through the scale.
  jazz:       [0, 2, 4, 5, 0, 2, 4, 7],
  // Country / Train — root-fifth alternation.
  country:    [0, 4, 0, 4, 0, 4, 0, 4],
  doowop:     [0, 4, 0, 4, 0, 4, 7, 4],
  // Cinematic / Dark — pedal-point root only.
  cinematic:  [0, 0, 0, 0, 0, 0, 0, 0],
  dark:       [0, 0, 0, 0, 0, 0, 0, 0],
  // Latin — dembow bassline with fifth on syncopation.
  latin:      [0, 7, 0, 4, 0, 7, 0, 4],
};

/** Generate a bassline that locks to the kick row of a drum pattern.
 *  Every kick hit fires a bass note at a row chosen from the style's
 *  bass voicing, cycling through the voicing as the bar progresses.
 *  Out-of-scale rows are clamped to the closest scale degree.
 *
 *  If `drumPattern` is null/empty, falls back to a simple "bass on
 *  every quarter note" pattern at the root — sounds like a pedal-tone
 *  but at least musical. */
export function generateBassPattern(
  drumPattern: ReadonlyArray<ReadonlyArray<boolean>> | null,
  style: string,
  seed: number,
): boolean[][] {
  const styleId = normalizeStyle(style);
  const voicing = BASS_VOICINGS[styleId];
  const rng = mulberry32(seed);

  const grid = emptyGrid();

  if (!drumPattern || drumPattern.length === 0 || !drumPattern[KICK_ROW]) {
    // No kick to lock to — use a pedal-tone bass on every quarter.
    const root = 0;
    for (let s = 0; s < STEPS; s += 4) grid[root]![s] = true;
    return grid;
  }

  const kick = drumPattern[KICK_ROW]!;
  const totalSteps = Math.min(kick.length, STEPS);
  let voicingIdx = Math.floor(rng() * voicing.length);

  for (let s = 0; s < totalSteps; s++) {
    if (!kick[s]) continue;
    const row = voicing[voicingIdx % voicing.length]!;
    voicingIdx += 1;
    grid[row]![s] = true;
  }
  return grid;
}

// ──────────────────────────────────────────────────────────────────────
// Melody generator
// ──────────────────────────────────────────────────────────────────────

/** Rhythm template for a melody — list of 16th-note step indices where
 *  notes fire. Each style has 2-3 templates we pick from. */
const MELODY_RHYTHMS: Record<DrumStyleId, ReadonlyArray<ReadonlyArray<number>>> = {
  // Trap / Drill — sparse, off-beat hooks
  trap:       [[0, 4, 6, 10, 12, 14], [0, 3, 7, 10, 14], [0, 4, 8, 11, 14]],
  drill:      [[0, 3, 7, 10, 14], [0, 4, 7, 12, 14], [0, 5, 8, 11, 14]],
  // Boom Bap — laid-back 8ths
  boombap:    [[0, 4, 8, 12], [0, 2, 6, 10, 14], [0, 4, 8, 10, 14]],
  // Lo-Fi — sparse, jazzy
  lofi:       [[0, 6, 10, 14], [0, 4, 11, 14], [0, 3, 8, 11]],
  // House — pulsing 8th-note line
  house:      [[0, 2, 4, 6, 8, 10, 12, 14], [0, 3, 6, 8, 11, 14], [0, 2, 6, 8, 10, 14]],
  // Disco — running 16ths
  disco:      [[0, 2, 4, 6, 8, 10, 12, 14], [0, 1, 4, 5, 8, 9, 12, 13]],
  // Techno — minimal, hypnotic
  techno:     [[0, 8], [0, 4, 8, 12], [0, 6, 10, 14]],
  // Jazz — syncopated, swung
  jazz:       [[0, 3, 6, 10, 14], [0, 4, 7, 10, 14], [0, 3, 4, 7, 11, 14]],
  // Soul / R&B — held + grace notes
  soul:       [[0, 4, 8, 12], [0, 6, 10, 14], [0, 4, 8, 11, 14]],
  rnb:        [[0, 4, 8, 12], [0, 6, 10, 14], [0, 4, 8, 11, 14]],
  // Blues — call-and-response
  blues:      [[0, 4, 11, 14], [0, 3, 8, 11], [0, 4, 8, 12]],
  // Doo-wop — simple melody
  doowop:     [[0, 4, 8, 12], [0, 2, 4, 8, 12]],
  // Country — folk eighths
  country:    [[0, 4, 8, 12], [0, 2, 4, 6, 8, 10, 12, 14]],
  // Cinematic — long sustained motif
  cinematic:  [[0, 12], [0, 8], [0, 6, 12]],
  // Dark — sparse stabs
  dark:       [[0, 9], [0, 4, 11], [0, 11, 14]],
  // Latin — clave-influenced
  latin:      [[0, 3, 6, 10, 12], [0, 4, 6, 10, 14], [0, 3, 8, 11, 14]],
};

/** Melodic note pools — which scale degrees the melody picks from.
 *  Index = position in the rhythm template (so position 0 leans toward
 *  the tonic, last position resolves to tonic, middle positions take
 *  passing notes). Pools encode genre flavor:
 *
 *   - Trap / Drill / Dark: pentatonic minor (rows 0, 2, 3, 4, 6)
 *   - House / Disco: major / dorian (rows 0, 2, 4, 5)
 *   - Jazz / Soul / R&B: full diatonic + chord extensions (all 7 rows)
 *   - Cinematic / Pad-like: triad tones only (rows 0, 2, 4)
 */
const NOTE_POOLS: Record<DrumStyleId, ReadonlyArray<number>> = {
  trap:       [0, 2, 4, 6, 7],
  drill:      [0, 2, 4, 6, 7],
  boombap:    [0, 2, 4, 5, 6],
  lofi:       [0, 2, 4, 5, 6],
  house:      [0, 2, 4, 5, 7],
  disco:      [0, 2, 4, 5, 7],
  techno:     [0, 4, 7],
  jazz:       [0, 1, 2, 3, 4, 5, 6],
  soul:       [0, 2, 4, 5, 6, 7],
  rnb:        [0, 2, 4, 5, 6, 7],
  blues:      [0, 2, 3, 4, 6, 7],
  doowop:     [0, 2, 4, 5, 7],
  country:    [0, 2, 4, 5, 7],
  cinematic:  [0, 2, 4, 7],
  dark:       [0, 3, 6, 7],
  latin:      [0, 2, 4, 6, 7],
};

/** Build a melody pattern. The rhythm is one of the curated templates
 *  for the style; the pitches are picked from the style's note pool,
 *  weighted toward the tonic at the start and resolving back to the
 *  tonic at the end of the bar. */
export function generateMelodyPattern(
  style: string,
  seed: number,
  _temperature = 1.0,
): boolean[][] {
  const styleId = normalizeStyle(style);
  const rng = mulberry32(seed);

  const rhythms = MELODY_RHYTHMS[styleId];
  const rhythm = rhythms[Math.floor(rng() * rhythms.length)]!;
  const pool = NOTE_POOLS[styleId];

  const grid = emptyGrid();
  for (let i = 0; i < rhythm.length; i++) {
    const step = rhythm[i]!;
    let row: number;
    if (i === 0) {
      // Always start on the tonic for clear key sense.
      row = 0;
    } else if (i === rhythm.length - 1) {
      // Resolve to tonic OR fifth at the end of the bar so the phrase
      // feels finished. 50/50 split keeps it from sounding mechanical.
      row = rng() < 0.5 ? 0 : 4;
    } else {
      // Pick from the pool, but bias away from immediate-repeat by
      // picking again if we hit the same row twice in a row.
      row = pool[Math.floor(rng() * pool.length)]!;
    }
    grid[row]![step] = true;
  }
  return grid;
}

// ──────────────────────────────────────────────────────────────────────
// Pad / Strings / Brass generator
// ──────────────────────────────────────────────────────────────────────

/** Pad / strings / brass — long sustained chord-tone notes that hold
 *  for the whole pattern. Plays the I-iii-V triad of the current key
 *  (rows 0, 2, 4) on step 0 so the chord sustains across the bar. */
export function generatePadPattern(_style: string): boolean[][] {
  const grid = emptyGrid();
  // Triad on the downbeat — root, third (b3 for minor / maj3 for major
  // is determined by the row's scale mapping in `rowToMidi`), fifth.
  grid[0]![0] = true; // root
  grid[2]![0] = true; // third
  grid[4]![0] = true; // fifth
  return grid;
}

// ──────────────────────────────────────────────────────────────────────
// Public unified entrypoint
// ──────────────────────────────────────────────────────────────────────

/** AI Pattern instrument categories used by `generateForInstrument`. */
export type GrooveInstrument =
  | 'drums'
  | 'percussion'
  | 'bass'
  | 'lead'
  | 'pad'
  | 'pluck'
  | 'muted-guitar'
  | 'brass'
  | 'strings';

/** Convert the screen's instrument string into a `GrooveInstrument`. */
export function classifyInstrument(instrument: string): GrooveInstrument {
  const i = instrument.toLowerCase();
  if (i.includes('drum')) return 'drums';
  if (i.includes('percussion')) return 'percussion';
  if (i.includes('bass')) return 'bass';
  if (i.includes('lead')) return 'lead';
  if (i.includes('pad')) return 'pad';
  if (i.includes('muted')) return 'muted-guitar';
  if (i.includes('pluck')) return 'pluck';
  if (i.includes('brass')) return 'brass';
  if (i.includes('string')) return 'strings';
  return 'lead';
}

/** Unified entry point — picks the right sub-generator based on the
 *  instrument category. The caller (`magentaPatternGenerator.ts`'s
 *  wrappers) plumbs the drum pattern through so bass + melody can lock
 *  to the kick when the user enables "Lock to drums". */
export function generateForInstrument(args: {
  instrument: string;
  style: string;
  seed: number;
  drumPattern: ReadonlyArray<ReadonlyArray<boolean>> | null;
  temperature?: number;
}): boolean[][] {
  const category = classifyInstrument(args.instrument);
  const seed = args.seed;
  switch (category) {
    case 'drums':
    case 'percussion':
      return generateDrumGroove(args.style, seed, args.temperature);
    case 'bass':
      return generateBassPattern(args.drumPattern, args.style, seed);
    case 'pad':
    case 'strings':
    case 'brass':
      return generatePadPattern(args.style);
    case 'lead':
    case 'pluck':
    case 'muted-guitar':
      return generateMelodyPattern(args.style, seed, args.temperature);
  }
}
