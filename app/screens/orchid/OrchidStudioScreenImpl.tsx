import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Piano,
  Play,
  SkipBack,
  Sparkles,
  Square,
  X,
} from 'lucide-react';

import {
  GENRES,
  chordSymbolToMidi,
  chordSymbolToName,
  getGenre,
  type ChordMode,
  type ChordSymbol,
  type GenreDef,
} from '@/app/lib/creationStation/chordBuilder';
import { getGenreRecommendedBpm } from '@/app/lib/creationStation/genreTempoProfiles';
import { generateSongPlan } from '@/app/lib/creationStation/chordSongBuilder';
import {
  buildStandardMidiFile,
  downloadBytes,
  safeFilename,
  type MidiNoteEvent,
} from '@/app/lib/creationStation/midiExport';
import { writeChordSync } from '@/app/lib/chordBuilderSync';
import { LAB808_ROOTS_IMPORTED_EVENT, sendRootsTo808Lab } from '@/app/lib/creationStation/lab808ChordRoots';
import {
  CB_PIANO_MINT,
  CB_PIANO_MINT_BORDER,
  cbPianoIsBlackKey,
  cbPianoIsCRow,
  cbPianoKeyFaceStyle,
  cbPianoKeyLabel,
  cbPianoMidiToNoteName,
  type PianoRollMetrics,
} from '@/app/lib/creationStation/chordBuilderPianoRollTheme';
import {
  CHORD_VOICES,
  type ChordVoiceId,
} from '@/app/lib/creationStation/chordSequencerVoices';
import {
  buildOrchidNotes,
  buildOrchidNotesForBassRoot,
  diatonicOrchidTypeForRootPc,
  formatOrchidChordName,
  getDiatonicRootsInKey,
  getOrchidBassKeypadLayout,
  scheduleOrchidChord,
  type OrchidChordType,
  type OrchidExtension,
  type OrchidPerformanceMode,
} from '@/app/lib/creationStation/orchidChordEngine';
import { OrchidPerformancePanel } from '@/app/components/creation/OrchidPerformancePanel';
import { OrchidStudioPianoRoll } from '@/app/components/creation/OrchidStudioPianoRoll';
import {
  CHORD_BASS_SEQ_CHANNEL_BASE,
  chordBassSeqStepChannelLabel,
} from '@/app/lib/creationStation/chordBassSequencerSession';
import type { ProProgressionEntry } from '@/app/lib/creationStation/professionalChordProgressions';
import { ProChordProgressionsPanel } from '@/app/components/creation/ProChordProgressionsPanel';
import {
  cancelCreationPlaylineWapi,
  launchCreationPlaylineWapi,
} from '@/app/lib/creationStation/creationPlaylineWapi';
import TransportPulseWorker from '../workers/transportPulse.worker?worker';

const KEY_LABELS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const STEP_COUNTS = [2, 3, 4, 6, 8, 12, 16, 24, 32] as const;
const SECTION_BAR_OPTIONS = [1, 2, 4, 8, 12, 16] as const;
const TARGET_PAD_COUNT = 96;
const PADS_PER_PAGE = 16;
const LOOK_AHEAD_SEC = 0.25;
const SCHED_MS = 25;
/** Same base lead as Creation Station / 808 Lab piano WAPI playline before output DAC latency. */
const CHORD_SEQ_PLAYLINE_WAPI_LEAD_SEC = 0.052;

function chordSeqPlaylineOutputDacLeadSec(ctx: AudioContext | null): number {
  if (!ctx || ctx.state === 'closed') return 0;
  const ol = typeof ctx.outputLatency === 'number' && ctx.outputLatency > 0 ? ctx.outputLatency : 0;
  const bl = typeof ctx.baseLatency === 'number' && ctx.baseLatency > 0 ? ctx.baseLatency : 0;
  return Math.min(0.12, ol + bl);
}

type VoicingComplexity = 'simple' | 'rich' | 'pro';
type PanelOptionMode = 'strict' | 'open';
type SongSectionKey = 'Intro' | 'Verse' | 'Pre-Chorus' | 'Chorus' | 'Hook' | 'Bridge' | 'Outro';

interface ChordPad {
  idx: number;
  symbol: ChordSymbol;
  name: string;
  notes: number[];
}

type OptionTier = 'strongest' | 'great' | 'good' | 'ok';

interface OptionChord {
  id: string;
  symbol: ChordSymbol;
  name: string;
  notes: number[];
  mappedPadIdx: number;
  score: number;
  isVariation: boolean;
  tier: OptionTier;
}

interface SongLaneEntry {
  id: string;
  section: SongSectionKey;
  chords: ChordSymbol[] | null;
  bars: number;
}

interface SongFormDef {
  id: string;
  label: string;
  sections: SongSectionKey[];
}

const SONG_FORMS: SongFormDef[] = [
  {
    id: 'standard-pop',
    label: 'Standard Pop',
    sections: ['Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Verse', 'Pre-Chorus', 'Chorus', 'Bridge', 'Chorus', 'Outro'],
  },
  {
    id: 'hook-first',
    label: 'Hook First',
    sections: ['Intro', 'Hook', 'Verse', 'Hook', 'Bridge', 'Hook', 'Outro'],
  },
  {
    id: 'rnb-story',
    label: 'R&B Story',
    sections: ['Intro', 'Verse', 'Verse', 'Pre-Chorus', 'Hook', 'Verse', 'Pre-Chorus', 'Hook', 'Bridge', 'Hook', 'Outro'],
  },
];

const NOTE_LETTERS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

// ── Chord-name parser ───────────────────────────────────────────────────────
// Users paste chord progressions from any online chord chart (Ultimate Guitar,
// Chordify, Songsterr, lyrics sites, etc.) in absolute notation like
// "C Am F G7" or "Cmaj7 - Dm7 - G7 - Cmaj7" and we turn each token into a
// playable chord pad. The parser accepts a wide range of common formats.

interface ParsedChord {
  input: string;       // the exact token the user typed (e.g. "Am7")
  rootPc: number;      // 0..11 — C..B
  notes: number[];     // absolute MIDI pitches in octave 4 range
  display: string;     // canonical display name (e.g. "Am7", "Cmaj7")
}

const ROOT_LETTER_PC: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};

// Each entry maps a quality suffix to a list of semitone intervals from the
// root. Longer / more-specific suffixes MUST come before shorter ones so the
// matcher always picks the longest valid match (e.g. "maj7" before "m").
const QUALITY_TABLE: Array<{ suffix: string; intervals: number[]; canonical: string }> = [
  { suffix: 'maj13',  intervals: [0, 4, 7, 11, 14, 17, 21], canonical: 'maj13' },
  { suffix: 'maj11',  intervals: [0, 4, 7, 11, 14, 17],     canonical: 'maj11' },
  { suffix: 'maj9',   intervals: [0, 4, 7, 11, 14],         canonical: 'maj9'  },
  { suffix: 'maj7',   intervals: [0, 4, 7, 11],             canonical: 'maj7'  },
  { suffix: 'M7',     intervals: [0, 4, 7, 11],             canonical: 'maj7'  },
  { suffix: 'Δ7',     intervals: [0, 4, 7, 11],             canonical: 'maj7'  },
  { suffix: 'Δ',      intervals: [0, 4, 7, 11],             canonical: 'maj7'  },
  { suffix: 'm13',    intervals: [0, 3, 7, 10, 14, 17, 21], canonical: 'm13'   },
  { suffix: 'm11',    intervals: [0, 3, 7, 10, 14, 17],     canonical: 'm11'   },
  { suffix: 'm9',     intervals: [0, 3, 7, 10, 14],         canonical: 'm9'    },
  { suffix: 'm7b5',   intervals: [0, 3, 6, 10],             canonical: 'm7b5'  },
  { suffix: 'm7',     intervals: [0, 3, 7, 10],             canonical: 'm7'    },
  { suffix: 'mMaj7',  intervals: [0, 3, 7, 11],             canonical: 'mMaj7' },
  { suffix: 'm6',     intervals: [0, 3, 7, 9],              canonical: 'm6'    },
  { suffix: 'min',    intervals: [0, 3, 7],                 canonical: 'm'     },
  { suffix: 'dim7',   intervals: [0, 3, 6, 9],              canonical: 'dim7'  },
  { suffix: 'dim',    intervals: [0, 3, 6],                 canonical: 'dim'   },
  { suffix: '°7',     intervals: [0, 3, 6, 9],              canonical: 'dim7'  },
  { suffix: '°',      intervals: [0, 3, 6],                 canonical: 'dim'   },
  { suffix: 'ø7',     intervals: [0, 3, 6, 10],             canonical: 'm7b5'  },
  { suffix: 'ø',      intervals: [0, 3, 6, 10],             canonical: 'm7b5'  },
  { suffix: 'aug7',   intervals: [0, 4, 8, 10],             canonical: 'aug7'  },
  { suffix: 'aug',    intervals: [0, 4, 8],                 canonical: 'aug'   },
  { suffix: '+',      intervals: [0, 4, 8],                 canonical: 'aug'   },
  { suffix: 'sus2',   intervals: [0, 2, 7],                 canonical: 'sus2'  },
  { suffix: 'sus4',   intervals: [0, 5, 7],                 canonical: 'sus4'  },
  { suffix: 'sus',    intervals: [0, 5, 7],                 canonical: 'sus4'  },
  { suffix: 'add9',   intervals: [0, 4, 7, 14],             canonical: 'add9'  },
  { suffix: 'add11',  intervals: [0, 4, 7, 17],             canonical: 'add11' },
  { suffix: 'add13',  intervals: [0, 4, 7, 21],             canonical: 'add13' },
  { suffix: '13',     intervals: [0, 4, 7, 10, 14, 17, 21], canonical: '13'    },
  { suffix: '11',     intervals: [0, 4, 7, 10, 14, 17],     canonical: '11'    },
  { suffix: '9',      intervals: [0, 4, 7, 10, 14],         canonical: '9'     },
  { suffix: '7',      intervals: [0, 4, 7, 10],             canonical: '7'     },
  { suffix: '6',      intervals: [0, 4, 7, 9],              canonical: '6'     },
  { suffix: 'm',      intervals: [0, 3, 7],                 canonical: 'm'     },
  { suffix: '',       intervals: [0, 4, 7],                 canonical: ''      },
];

function parseChordToken(rawToken: string): ParsedChord | null {
  const token = rawToken.trim().replace(/[()|]/g, '');
  if (!token) return null;

  // Strip slash bass notation — we honor the chord on top, ignore the bass
  // for now (e.g. "C/G" → "C").
  const slashSplit = token.split('/');
  const main = slashSplit[0]!.trim();
  if (!main) return null;

  // First character is the root letter (A-G); next char may be # or b.
  const letter = main[0]?.toUpperCase();
  if (!letter || !(letter in ROOT_LETTER_PC)) return null;

  let rootPc = ROOT_LETTER_PC[letter]!;
  let qualityStart = 1;
  if (main[1] === '#') { rootPc = (rootPc + 1) % 12; qualityStart = 2; }
  else if (main[1] === 'b') { rootPc = (rootPc + 11) % 12; qualityStart = 2; }

  const qualityStr = main.slice(qualityStart);

  // Find the longest matching quality suffix from the table (table is ordered
  // longest-first so a linear scan returns the right one).
  let intervals: number[] = [0, 4, 7];
  let canonical = '';
  for (const q of QUALITY_TABLE) {
    if (q.suffix === '' && qualityStr === '') {
      intervals = q.intervals; canonical = q.canonical; break;
    }
    if (q.suffix && qualityStr === q.suffix) {
      intervals = q.intervals; canonical = q.canonical; break;
    }
  }
  // If the quality string didn't exactly match anything, try a prefix match
  if (qualityStr && canonical === '' && !(intervals.length === 3 && intervals[1] === 4)) {
    for (const q of QUALITY_TABLE) {
      if (q.suffix && qualityStr.startsWith(q.suffix)) {
        intervals = q.intervals; canonical = q.canonical; break;
      }
    }
  }

  const rootMidi = 60 + rootPc; // octave 4 (C4 = 60)
  const notes = intervals
    .map((iv) => rootMidi + iv)
    .filter((n) => n >= 36 && n <= 96)
    .sort((a, b) => a - b);
  if (notes.length < 2) return null;

  const noteLetter = NOTE_LETTERS[rootPc] ?? '?';
  return {
    input: rawToken,
    rootPc,
    notes,
    display: `${noteLetter}${canonical}`,
  };
}

function parseChordProgression(text: string): ParsedChord[] {
  // Split on whitespace / commas / dashes / pipes / newlines
  const tokens = text
    .split(/[\s,;|/\n\r]+|[\u2013\u2014]+/)
    .map((t) => t.replace(/[-]+/g, ' ').trim())
    .flatMap((t) => t.split(/\s+/))
    .filter((t) => t.length > 0);

  const out: ParsedChord[] = [];
  for (const t of tokens) {
    const parsed = parseChordToken(t);
    if (parsed) out.push(parsed);
  }
  return out;
}

// Score how well a parsed chord matches an existing pad. Higher = better fit.
function matchPadScore(parsed: ParsedChord, pad: ChordPad): number {
  const padRoot = pad.notes[0]! % 12;
  if (padRoot !== parsed.rootPc) return -1; // root must match
  const parsedPcs = new Set(parsed.notes.map((n) => n % 12));
  const padPcs = new Set(pad.notes.map((n) => n % 12));
  let overlap = 0;
  for (const pc of parsedPcs) if (padPcs.has(pc)) overlap += 1;
  const extraInPad = [...padPcs].filter((pc) => !parsedPcs.has(pc)).length;
  // Reward overlap, penalize extras and missing notes
  return overlap * 10 - extraInPad * 3 - (parsedPcs.size - overlap) * 4;
}

function findBestPadFor(parsed: ParsedChord, pads: ChordPad[]): ChordPad | null {
  let best: ChordPad | null = null;
  let bestScore = -Infinity;
  for (const p of pads) {
    const s = matchPadScore(parsed, p);
    if (s > bestScore) { bestScore = s; best = p; }
  }
  return bestScore > 0 ? best : null;
}

function uniqueSectionsInOrder(sections: SongSectionKey[]): SongSectionKey[] {
  const seen = new Set<SongSectionKey>();
  const out: SongSectionKey[] = [];
  for (const s of sections) {
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function ensureSequenceLength(input: ReadonlyArray<string>, count: number): string[] {
  const out = new Array(Math.max(1, count)).fill('I');
  for (let i = 0; i < out.length; i++) out[i] = input[i] ?? out[i];
  return out;
}

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// ─────────────────────────────────────────────────────────────────────────────
// BASS LINE engine
// ─────────────────────────────────────────────────────────────────────────────
// Three voices (SUB / ELECTRIC / PLUCK) and 8 rhythmic patterns. Each chord
// step is divided into 8 sub-slots (16th notes when the chord step = a half
// note at 4/4) so patterns can express straight, syncopated, and offbeat
// rhythms without needing extra UI complexity.
//
// scheduleBassStep() takes the current chord pad, the NEXT chord pad (for
// walking-bass approach tones), and the chosen voice/pattern, and schedules
// every bass-note onset that falls inside this chord step's window.

type BassVoiceId = 'sub' | 'electric' | 'pluck';
type BassPatternId =
  // ── ANCHOR ── root-locked grooves that carry the song. Use these when the
  // bass needs to be the foundation drums can ride on. Work cross-genre
  // (R&B / trap / pop / hip-hop / Latin).
  | 'root'
  | 'pocket'
  | 'trap-808'
  | 'pop-drive'
  | 'push'
  | 'clave-332'
  | 'halftime'
  | 'octaves'
  | 'reggae'
  // ── MOTION ── melodic bass lines that walk between chord tones.
  | 'walking'
  | 'walk-jazz'
  | 'motown'
  | 'funk-ghost'
  | 'gospel-walk'
  | 'arp-up'
  | 'arp-down'
  | 'arp-ud'
  | 'arp-triad'
  | 'arp-race'
  // ── FEEL ── rhythmic flavors (syncopation, dotted, pump).
  | 'fifth'
  | 'syncopated'
  | 'dotted'
  | 'disco';

type BassPatternCategory = 'anchor' | 'motion' | 'feel';

/**
 * One sub-slot hit inside an 8-slot chord-step pattern.
 *   slot:     0..7 (slot 0 = downbeat of chord step, slot 4 = mid-step)
 *   vel:      0..1 amplitude multiplier
 *   degree:   chord degree to play — 'R'=root, '3'=third, '5'=fifth, '6'=sixth,
 *             '7'=seventh, 'O'=octave-up, 'A'=approach tone (half-step below
 *             next chord's root), 'C'=chromatic passing tone (root + a random
 *             half-step), 'L'=lower-neighbor (root - 2 semitones diatonic)
 *   sustainSlots: how many sub-slots this note rings for (1 = a 16th, 8 = full step)
 */
interface BassHit {
  slot: number;
  vel: number;
  degree: 'R' | '3' | '5' | '6' | '7' | 'O' | 'A' | 'C' | 'L';
  sustainSlots: number;
  /** When set, `resolveBassMidi` uses this absolute MIDI value instead of
   *  interpreting `degree`. Used by Piano-Roll-edited custom patterns where
   *  the user has painted specific pitches relative to the bass root. */
  midiOverride?: number;
}

/** Piano-Roll-edited bass step. Stores hits as semitone offsets from the
 *  bass root (chord_root − 12 by default, modified by octaveShift). This
 *  means the painted pattern still transposes correctly when the user
 *  reassigns the chord pad on that step. */
interface CustomBassHit {
  slot: number;         // 0..7 — 16th-note position within the chord step
  sustainSlots: number; // 1..8 — how many sub-slots the note rings
  midiOffset: number;   // semitones from bass root (positive = up)
  vel: number;          // 0..1 velocity
}

// ── 8 PATTERN SLOTS ─────────────────────────────────────────────────────
// Each slot stores a complete bass "kit" — voice + pattern + octave + all
// feel knobs. A slot can be loaded globally (one click) and per chord step
// it can override the global bass entirely (the slot's voice/pattern/feel
// play on that step). This is what lets Verse use MOTOWN and Chorus use
// HALF-TIME without the user touching anything mid-playback. ─────────────
type SlotId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';
const SLOT_IDS: ReadonlyArray<SlotId> = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

interface BassSlot {
  voice: BassVoiceId;
  pattern: BassPatternId;
  octave: number;
  fills: number;
  swing: number;
  length: number;
  slide: number;
  // Optional snapshot of the user's hand-painted bass line at the moment
  // the slot was saved. When present, loading the slot restores the painted
  // notes too — letting the user save a complete bass line (kit + notes)
  // and recall it later. Older slots saved before this field existed simply
  // won't have it, and loading them leaves the painted notes untouched.
  customPatterns?: Record<number, CustomBassHit[]>;
}

const EMPTY_SLOTS: Record<SlotId, BassSlot | null> = {
  A: null, B: null, C: null, D: null, E: null, F: null, G: null, H: null,
};

/** Per-slot tint colors — keep these the same everywhere a slot is rendered
 *  (the slot bank above the step grid, the per-step chip, and the active-
 *  slot highlight) so the user builds a visual association by letter. */
const SLOT_COLORS: Record<SlotId, { fg: string; bg: string; border: string }> = {
  A: { fg: '#f87171', bg: '#1f0a0a', border: '#7f1d1d' },
  B: { fg: '#fb923c', bg: '#1f120a', border: '#7c2d12' },
  C: { fg: '#fbbf24', bg: '#1f1a0a', border: '#854d0e' },
  D: { fg: '#a3e635', bg: '#0e1a07', border: '#3f6212' },
  E: { fg: '#34d399', bg: '#071a14', border: '#065f46' },
  F: { fg: '#22d3ee', bg: '#07181c', border: '#155e75' },
  G: { fg: '#818cf8', bg: '#0f0f24', border: '#3730a3' },
  H: { fg: '#e879f9', bg: '#1c0a1f', border: '#86198f' },
};

interface BassPatternContext {
  pad: ChordPad;
  nextPad: ChordPad | null;
  stepIdx: number;
  totalSteps: number;
  rand: () => number;
}

interface BassPatternDef {
  id: BassPatternId;
  label: string;
  describe: string;
  category: BassPatternCategory;
  /** Static representation used for the per-cell visualizer dots. */
  previewHits: BassHit[];
  /** Runtime hit generator — sees current chord, next chord, position, etc. */
  generate: (ctx: BassPatternContext) => BassHit[];
}

/** Helper — stamp out a function that just returns a fixed pattern. */
function staticPattern(hits: BassHit[]): (ctx: BassPatternContext) => BassHit[] {
  return () => hits;
}

const BASS_PATTERNS: BassPatternDef[] = [
  // ───────────────────────── ANCHOR ─────────────────────────
  // Root-locked, song-carrying grooves. These are the ones that hold the
  // song together when the chords drop out — easy to play drums against,
  // cross-genre, and what a real bass player's main feel sounds like.
  {
    id: 'root',
    label: 'HOLD',
    describe: 'Hold the chord root for the full step. Simplest anchor — pure foundation.',
    category: 'anchor',
    previewHits: [{ slot: 0, vel: 1.0, degree: 'R', sustainSlots: 7.8 }],
    generate: staticPattern([{ slot: 0, vel: 1.0, degree: 'R', sustainSlots: 7.8 }]),
  },
  {
    id: 'pocket',
    label: 'POCKET',
    describe: 'R&B / neo-soul pocket — root on 1, syncopated pull on the "e" of 1, soft accent on beat 2. The bass you can mute the chords against and still feel the song.',
    category: 'anchor',
    previewHits: [
      { slot: 0, vel: 1.0,  degree: 'R', sustainSlots: 3.0 },
      { slot: 3, vel: 0.82, degree: 'R', sustainSlots: 1.2 },
      { slot: 4, vel: 0.78, degree: 'R', sustainSlots: 3.5 },
    ],
    generate: ({ rand, stepIdx }) => {
      // Light variation across bars — the pickup before beat 2 nudges around
      // (sometimes 16th early, sometimes dotted-8th) so the pocket breathes.
      const pickup = stepIdx % 2 === 0 ? 3 : 2;
      const hits: BassHit[] = [
        { slot: 0,       vel: 1.0,  degree: 'R', sustainSlots: pickup === 3 ? 3.0 : 2.0 },
        { slot: pickup,  vel: 0.78 + rand() * 0.10, degree: 'R', sustainSlots: 1.2 },
        { slot: 4,       vel: 0.74 + rand() * 0.10, degree: 'R', sustainSlots: 3.5 },
      ];
      return hits;
    },
  },
  {
    id: 'trap-808',
    label: '808 SUB',
    describe: 'Trap 808 anchor — one big sustained root on beat 1 that rings the whole step, then a lighter retrigger on beat 2 to keep the kick interlocked. Sub-bass that carries.',
    category: 'anchor',
    previewHits: [
      { slot: 0, vel: 1.0,  degree: 'R', sustainSlots: 7.6 },
      { slot: 4, vel: 0.78, degree: 'R', sustainSlots: 3.6 },
    ],
    generate: ({ rand, stepIdx }) => {
      // Occasionally drop the beat-2 retrigger every 4th step for breathing room.
      const includeRetrigger = !(stepIdx % 4 === 3 && rand() < 0.55);
      const hits: BassHit[] = [
        { slot: 0, vel: 1.0, degree: 'R', sustainSlots: 7.6 },
      ];
      if (includeRetrigger) {
        hits.push({ slot: 4, vel: 0.74 + rand() * 0.10, degree: 'R', sustainSlots: 3.6 });
      }
      return hits;
    },
  },
  {
    id: 'pop-drive',
    label: 'POP 4',
    describe: 'Pop four-on-the-floor root pulse — root on every quarter note. Stadium-pop and dance staple. Locks like a metronome and grounds the chorus.',
    category: 'anchor',
    previewHits: [
      { slot: 0, vel: 1.0,  degree: 'R', sustainSlots: 1.7 },
      { slot: 2, vel: 0.80, degree: 'R', sustainSlots: 1.7 },
      { slot: 4, vel: 0.92, degree: 'R', sustainSlots: 1.7 },
      { slot: 6, vel: 0.80, degree: 'R', sustainSlots: 1.7 },
    ],
    generate: staticPattern([
      { slot: 0, vel: 1.0,  degree: 'R', sustainSlots: 1.7 },
      { slot: 2, vel: 0.80, degree: 'R', sustainSlots: 1.7 },
      { slot: 4, vel: 0.92, degree: 'R', sustainSlots: 1.7 },
      { slot: 6, vel: 0.80, degree: 'R', sustainSlots: 1.7 },
    ]),
  },
  {
    id: 'push',
    label: 'PUSH',
    describe: 'Anticipated push — strong root on beat 1, then a hard push on the very last 16th to lean into the next chord. The "boom...PUSH" feel modern pop and trap use.',
    category: 'anchor',
    previewHits: [
      { slot: 0, vel: 1.0,  degree: 'R', sustainSlots: 6.6 },
      { slot: 7, vel: 0.92, degree: 'R', sustainSlots: 1.0 },
    ],
    generate: staticPattern([
      { slot: 0, vel: 1.0,  degree: 'R', sustainSlots: 6.6 },
      { slot: 7, vel: 0.92, degree: 'R', sustainSlots: 1.0 },
    ]),
  },
  {
    id: 'clave-332',
    label: '3-3-2',
    describe: 'Latin / Afrobeat clave anchor — root hits on a 3+3+2 sub-slot pattern (1, "e" of 1, "and" of 2). Drives every Bad Bunny, Afrobeats, reggaeton bass line.',
    category: 'anchor',
    previewHits: [
      { slot: 0, vel: 1.0,  degree: 'R', sustainSlots: 2.6 },
      { slot: 3, vel: 0.88, degree: 'R', sustainSlots: 2.6 },
      { slot: 6, vel: 0.90, degree: 'R', sustainSlots: 1.8 },
    ],
    generate: staticPattern([
      { slot: 0, vel: 1.0,  degree: 'R', sustainSlots: 2.6 },
      { slot: 3, vel: 0.88, degree: 'R', sustainSlots: 2.6 },
      { slot: 6, vel: 0.90, degree: 'R', sustainSlots: 1.8 },
    ]),
  },
  {
    id: 'halftime',
    label: 'HALF',
    describe: 'Half-time hip-hop / trap anchor — one heavy root drop per chord step, with deep space around it. The "drag" feel that makes drums hit twice as hard.',
    category: 'anchor',
    previewHits: [
      { slot: 0, vel: 1.0, degree: 'R', sustainSlots: 7.8 },
    ],
    generate: ({ rand, stepIdx, nextPad }) => {
      // 30% of steps add a small ghost on the "and" of 2 to keep the
      // half-time feel alive without crowding the drums.
      const hits: BassHit[] = [
        { slot: 0, vel: 1.0, degree: 'R', sustainSlots: 7.8 },
      ];
      if (rand() < 0.30) {
        hits.push({ slot: 6, vel: 0.35, degree: 'R', sustainSlots: 1.0 });
      }
      // Occasional approach on the last step before chord change for movement.
      if (nextPad && stepIdx % 4 === 3 && rand() < 0.45) {
        hits.push({ slot: 7, vel: 0.55, degree: 'A', sustainSlots: 0.9 });
      }
      return hits;
    },
  },
  {
    id: 'octaves',
    label: 'OCTAVES',
    describe: 'Root–octave bounce on 8ths — disco / EDM / dance-pop staple. Anchor with movement, never leaves the root.',
    category: 'anchor',
    previewHits: [
      { slot: 0, vel: 1.0,  degree: 'R', sustainSlots: 1.6 },
      { slot: 2, vel: 0.85, degree: 'O', sustainSlots: 1.6 },
      { slot: 4, vel: 1.0,  degree: 'R', sustainSlots: 1.6 },
      { slot: 6, vel: 0.85, degree: 'O', sustainSlots: 1.6 },
    ],
    generate: staticPattern([
      { slot: 0, vel: 1.0,  degree: 'R', sustainSlots: 1.6 },
      { slot: 2, vel: 0.85, degree: 'O', sustainSlots: 1.6 },
      { slot: 4, vel: 1.0,  degree: 'R', sustainSlots: 1.6 },
      { slot: 6, vel: 0.85, degree: 'O', sustainSlots: 1.6 },
    ]),
  },
  {
    id: 'reggae',
    label: 'OFFBEAT',
    describe: 'Reggae / dub upbeat — bass hits the off-beats only, leaves space for the kick on 1 and 3. One-drop staple.',
    category: 'anchor',
    previewHits: [
      { slot: 2, vel: 1.0,  degree: 'R', sustainSlots: 1.6 },
      { slot: 6, vel: 0.95, degree: 'R', sustainSlots: 1.6 },
    ],
    generate: staticPattern([
      { slot: 2, vel: 1.0,  degree: 'R', sustainSlots: 1.6 },
      { slot: 6, vel: 0.95, degree: 'R', sustainSlots: 1.6 },
    ]),
  },

  // ───────────────────────── MOTION ─────────────────────────
  // Bass lines that walk and move between chord tones — when you want the
  // bass to be a counter-melody as much as a foundation.
  {
    id: 'walking',
    label: 'WALK',
    describe: 'Root → 3rd → 5th → approach. Smooth walk into the next chord.',
    category: 'motion',
    previewHits: [
      { slot: 0, vel: 1.0, degree: 'R', sustainSlots: 1.6 },
      { slot: 2, vel: 0.85, degree: '3', sustainSlots: 1.6 },
      { slot: 4, vel: 0.9, degree: '5', sustainSlots: 1.6 },
      { slot: 6, vel: 0.85, degree: 'A', sustainSlots: 1.6 },
    ],
    generate: ({ nextPad }) => [
      { slot: 0, vel: 1.0, degree: 'R', sustainSlots: 1.6 },
      { slot: 2, vel: 0.85, degree: '3', sustainSlots: 1.6 },
      { slot: 4, vel: 0.9, degree: '5', sustainSlots: 1.6 },
      { slot: 6, vel: 0.85, degree: nextPad ? 'A' : '5', sustainSlots: 1.6 },
    ],
  },
  {
    id: 'walk-jazz',
    label: 'WALK JZ',
    describe: 'Jazz walking quarters. Bar-aware: alternates 3rd / 5th / 6th on beat 2 and adds chromatic approach right before the next chord.',
    category: 'motion',
    previewHits: [
      { slot: 0, vel: 1.0, degree: 'R', sustainSlots: 3.6 },
      { slot: 4, vel: 0.85, degree: '5', sustainSlots: 2.8 },
      { slot: 7, vel: 0.78, degree: 'A', sustainSlots: 1.0 },
    ],
    generate: ({ stepIdx, nextPad }) => {
      // Beat 1 = root. Beat 2 alternates 3rd / 5th / 6th / 5th by step position
      // so the line isn't a robotic cycle. Approach on the last 16th when the
      // chord is actually changing on the next step.
      const pickB2: BassHit['degree'][] = ['5', '3', '6', '5'];
      const b2 = pickB2[stepIdx % 4]!;
      const hits: BassHit[] = [
        { slot: 0, vel: 1.0, degree: 'R', sustainSlots: 3.5 },
        { slot: 4, vel: 0.85, degree: b2, sustainSlots: 2.8 },
      ];
      // Chord actually changes? Lean into a chromatic approach.
      if (nextPad && nextPad.notes[0] !== null) {
        hits.push({ slot: 7, vel: 0.78, degree: 'A', sustainSlots: 0.9 });
      }
      return hits;
    },
  },
  {
    id: 'motown',
    label: 'MOTOWN',
    describe: 'Jamerson-style busy 8th-note line with octave jumps, 3rds, 5ths, and a walking approach. Constantly moving.',
    category: 'motion',
    previewHits: [
      { slot: 0, vel: 1.0, degree: 'R', sustainSlots: 1.4 },
      { slot: 2, vel: 0.7,  degree: '5', sustainSlots: 1.0 },
      { slot: 4, vel: 0.9,  degree: 'O', sustainSlots: 1.0 },
      { slot: 5, vel: 0.75, degree: '3', sustainSlots: 0.9 },
      { slot: 6, vel: 0.65, degree: '5', sustainSlots: 0.9 },
      { slot: 7, vel: 0.85, degree: 'A', sustainSlots: 1.0 },
    ],
    generate: ({ stepIdx, nextPad }) => {
      // Vary the inner three notes by step position so the line keeps moving.
      const inner: BassHit['degree'][][] = [
        ['5', 'O', '3'],
        ['O', '3', '5'],
        ['3', '5', 'O'],
        ['6', '5', '3'],
      ];
      const inn = inner[stepIdx % inner.length]!;
      return [
        { slot: 0, vel: 1.0,  degree: 'R',     sustainSlots: 1.3 },
        { slot: 2, vel: 0.70, degree: inn[0]!, sustainSlots: 1.0 },
        { slot: 4, vel: 0.90, degree: inn[1]!, sustainSlots: 1.0 },
        { slot: 5, vel: 0.72, degree: inn[2]!, sustainSlots: 0.8 },
        { slot: 7, vel: 0.85, degree: nextPad ? 'A' : 'R', sustainSlots: 1.0 },
      ];
    },
  },
  {
    id: 'funk-ghost',
    label: 'FUNK GH',
    describe: 'Funk pocket with ghost notes — strong roots on 1 and 3, low-vel ghost hits filling the gaps.',
    category: 'motion',
    previewHits: [
      { slot: 0, vel: 1.0,  degree: 'R', sustainSlots: 1.4 },
      { slot: 1, vel: 0.30, degree: 'R', sustainSlots: 0.6 },
      { slot: 3, vel: 0.95, degree: 'R', sustainSlots: 1.0 },
      { slot: 4, vel: 0.85, degree: 'O', sustainSlots: 0.9 },
      { slot: 5, vel: 0.28, degree: 'R', sustainSlots: 0.5 },
      { slot: 7, vel: 0.78, degree: 'A', sustainSlots: 0.9 },
    ],
    generate: ({ rand, stepIdx, nextPad }) => {
      // The 8th-note feel stays consistent but ghost-note placement nudges
      // each bar so the groove feels organic, not looped.
      const hits: BassHit[] = [
        { slot: 0, vel: 1.0,  degree: 'R', sustainSlots: 1.3 },
        { slot: 3, vel: 0.94, degree: 'R', sustainSlots: 1.0 },
        { slot: 4, vel: 0.85, degree: stepIdx % 2 === 0 ? 'O' : '5', sustainSlots: 0.9 },
        { slot: 7, vel: 0.78, degree: nextPad ? 'A' : 'R', sustainSlots: 0.9 },
      ];
      // 80% ghost on slot 1, 60% ghost on slot 5 — variation per step
      if (rand() < 0.82) hits.push({ slot: 1, vel: 0.25 + rand() * 0.15, degree: 'R', sustainSlots: 0.6 });
      if (rand() < 0.62) hits.push({ slot: 5, vel: 0.22 + rand() * 0.14, degree: 'R', sustainSlots: 0.5 });
      return hits;
    },
  },
  {
    id: 'gospel-walk',
    label: 'GOSPEL',
    describe: 'Smooth gospel walk — root, 5th, octave, then a 6th or approach into the next chord.',
    category: 'motion',
    previewHits: [
      { slot: 0, vel: 1.0,  degree: 'R', sustainSlots: 1.8 },
      { slot: 2, vel: 0.85, degree: '5', sustainSlots: 1.6 },
      { slot: 4, vel: 0.92, degree: 'O', sustainSlots: 1.6 },
      { slot: 6, vel: 0.85, degree: 'A', sustainSlots: 1.6 },
    ],
    generate: ({ stepIdx, nextPad }) => {
      const tail: BassHit['degree'] = nextPad
        ? 'A'
        : (stepIdx % 2 === 0 ? '6' : '5');
      return [
        { slot: 0, vel: 1.0,  degree: 'R', sustainSlots: 1.8 },
        { slot: 2, vel: 0.85, degree: '5', sustainSlots: 1.6 },
        { slot: 4, vel: 0.92, degree: 'O', sustainSlots: 1.6 },
        { slot: 6, vel: 0.85, degree: tail, sustainSlots: 1.6 },
      ];
    },
  },

  // ───────────────────────── ARPEGGIOS ─────────────────────────
  // Broken-chord patterns. Each note in the chord plays in sequence rather
  // than as a stack. Great for synth-bass / acid-bass / 80s-pop / EDM and as
  // a starting point for piano-roll editing (LOAD PATTERN with ARP UP gives
  // you a melodic skeleton to drag around).
  {
    id: 'arp-up',
    label: 'ARP UP',
    describe: 'Ascending arpeggio: R · 3 · 5 · 7 · O · 7 · 5 · 3. Broken chord climbing up and coming back.',
    category: 'motion',
    previewHits: [
      { slot: 0, vel: 1.00, degree: 'R', sustainSlots: 1 },
      { slot: 1, vel: 0.85, degree: '3', sustainSlots: 1 },
      { slot: 2, vel: 0.85, degree: '5', sustainSlots: 1 },
      { slot: 3, vel: 0.85, degree: '7', sustainSlots: 1 },
      { slot: 4, vel: 0.95, degree: 'O', sustainSlots: 1 },
      { slot: 5, vel: 0.80, degree: '7', sustainSlots: 1 },
      { slot: 6, vel: 0.80, degree: '5', sustainSlots: 1 },
      { slot: 7, vel: 0.80, degree: '3', sustainSlots: 1 },
    ],
    generate: staticPattern([
      { slot: 0, vel: 1.00, degree: 'R', sustainSlots: 1 },
      { slot: 1, vel: 0.85, degree: '3', sustainSlots: 1 },
      { slot: 2, vel: 0.85, degree: '5', sustainSlots: 1 },
      { slot: 3, vel: 0.85, degree: '7', sustainSlots: 1 },
      { slot: 4, vel: 0.95, degree: 'O', sustainSlots: 1 },
      { slot: 5, vel: 0.80, degree: '7', sustainSlots: 1 },
      { slot: 6, vel: 0.80, degree: '5', sustainSlots: 1 },
      { slot: 7, vel: 0.80, degree: '3', sustainSlots: 1 },
    ]),
  },
  {
    id: 'arp-down',
    label: 'ARP DN',
    describe: 'Descending arpeggio: O · 7 · 5 · 3 · R · 3 · 5 · 7. Broken chord falling down and coming back.',
    category: 'motion',
    previewHits: [
      { slot: 0, vel: 1.00, degree: 'O', sustainSlots: 1 },
      { slot: 1, vel: 0.85, degree: '7', sustainSlots: 1 },
      { slot: 2, vel: 0.85, degree: '5', sustainSlots: 1 },
      { slot: 3, vel: 0.85, degree: '3', sustainSlots: 1 },
      { slot: 4, vel: 0.95, degree: 'R', sustainSlots: 1 },
      { slot: 5, vel: 0.80, degree: '3', sustainSlots: 1 },
      { slot: 6, vel: 0.80, degree: '5', sustainSlots: 1 },
      { slot: 7, vel: 0.80, degree: '7', sustainSlots: 1 },
    ],
    generate: staticPattern([
      { slot: 0, vel: 1.00, degree: 'O', sustainSlots: 1 },
      { slot: 1, vel: 0.85, degree: '7', sustainSlots: 1 },
      { slot: 2, vel: 0.85, degree: '5', sustainSlots: 1 },
      { slot: 3, vel: 0.85, degree: '3', sustainSlots: 1 },
      { slot: 4, vel: 0.95, degree: 'R', sustainSlots: 1 },
      { slot: 5, vel: 0.80, degree: '3', sustainSlots: 1 },
      { slot: 6, vel: 0.80, degree: '5', sustainSlots: 1 },
      { slot: 7, vel: 0.80, degree: '7', sustainSlots: 1 },
    ]),
  },
  {
    id: 'arp-ud',
    label: 'ARP U-D',
    describe: 'Up-down arpeggio: R · 3 · 5 · O · 5 · 3 · R · 5. Bouncing across the chord.',
    category: 'motion',
    previewHits: [
      { slot: 0, vel: 1.00, degree: 'R', sustainSlots: 1 },
      { slot: 1, vel: 0.85, degree: '3', sustainSlots: 1 },
      { slot: 2, vel: 0.85, degree: '5', sustainSlots: 1 },
      { slot: 3, vel: 0.95, degree: 'O', sustainSlots: 1 },
      { slot: 4, vel: 0.85, degree: '5', sustainSlots: 1 },
      { slot: 5, vel: 0.85, degree: '3', sustainSlots: 1 },
      { slot: 6, vel: 0.80, degree: 'R', sustainSlots: 1 },
      { slot: 7, vel: 0.80, degree: '5', sustainSlots: 1 },
    ],
    generate: staticPattern([
      { slot: 0, vel: 1.00, degree: 'R', sustainSlots: 1 },
      { slot: 1, vel: 0.85, degree: '3', sustainSlots: 1 },
      { slot: 2, vel: 0.85, degree: '5', sustainSlots: 1 },
      { slot: 3, vel: 0.95, degree: 'O', sustainSlots: 1 },
      { slot: 4, vel: 0.85, degree: '5', sustainSlots: 1 },
      { slot: 5, vel: 0.85, degree: '3', sustainSlots: 1 },
      { slot: 6, vel: 0.80, degree: 'R', sustainSlots: 1 },
      { slot: 7, vel: 0.80, degree: '5', sustainSlots: 1 },
    ]),
  },
  {
    id: 'arp-triad',
    label: 'ARP TRI',
    describe: 'Triad arpeggio: R · 3 · 5 looped twice plus a closing root-3. Sparse, classic 80s synth-bass.',
    category: 'motion',
    previewHits: [
      { slot: 0, vel: 1.00, degree: 'R', sustainSlots: 1 },
      { slot: 1, vel: 0.85, degree: '3', sustainSlots: 1 },
      { slot: 2, vel: 0.85, degree: '5', sustainSlots: 1 },
      { slot: 3, vel: 0.95, degree: 'R', sustainSlots: 1 },
      { slot: 4, vel: 0.85, degree: '3', sustainSlots: 1 },
      { slot: 5, vel: 0.85, degree: '5', sustainSlots: 1 },
      { slot: 6, vel: 0.95, degree: 'R', sustainSlots: 1 },
      { slot: 7, vel: 0.80, degree: '3', sustainSlots: 1 },
    ],
    generate: staticPattern([
      { slot: 0, vel: 1.00, degree: 'R', sustainSlots: 1 },
      { slot: 1, vel: 0.85, degree: '3', sustainSlots: 1 },
      { slot: 2, vel: 0.85, degree: '5', sustainSlots: 1 },
      { slot: 3, vel: 0.95, degree: 'R', sustainSlots: 1 },
      { slot: 4, vel: 0.85, degree: '3', sustainSlots: 1 },
      { slot: 5, vel: 0.85, degree: '5', sustainSlots: 1 },
      { slot: 6, vel: 0.95, degree: 'R', sustainSlots: 1 },
      { slot: 7, vel: 0.80, degree: '3', sustainSlots: 1 },
    ]),
  },
  {
    id: 'arp-race',
    label: 'ARP RACE',
    describe: 'Rapid octave race: R · O alternating every 16th — classic acid / EDM / hi-tempo synth-bass driver.',
    category: 'motion',
    previewHits: [
      { slot: 0, vel: 1.00, degree: 'R', sustainSlots: 1 },
      { slot: 1, vel: 0.90, degree: 'O', sustainSlots: 1 },
      { slot: 2, vel: 0.95, degree: 'R', sustainSlots: 1 },
      { slot: 3, vel: 0.90, degree: 'O', sustainSlots: 1 },
      { slot: 4, vel: 1.00, degree: 'R', sustainSlots: 1 },
      { slot: 5, vel: 0.90, degree: 'O', sustainSlots: 1 },
      { slot: 6, vel: 0.95, degree: 'R', sustainSlots: 1 },
      { slot: 7, vel: 0.90, degree: 'O', sustainSlots: 1 },
    ],
    generate: staticPattern([
      { slot: 0, vel: 1.00, degree: 'R', sustainSlots: 1 },
      { slot: 1, vel: 0.90, degree: 'O', sustainSlots: 1 },
      { slot: 2, vel: 0.95, degree: 'R', sustainSlots: 1 },
      { slot: 3, vel: 0.90, degree: 'O', sustainSlots: 1 },
      { slot: 4, vel: 1.00, degree: 'R', sustainSlots: 1 },
      { slot: 5, vel: 0.90, degree: 'O', sustainSlots: 1 },
      { slot: 6, vel: 0.95, degree: 'R', sustainSlots: 1 },
      { slot: 7, vel: 0.90, degree: 'O', sustainSlots: 1 },
    ]),
  },

  // ───────────────────────── FEEL ─────────────────────────
  // Rhythmic flavors — pick these when you want a specific feel layered on
  // top of the chord progression. Use as accent variations.
  {
    id: 'fifth',
    label: 'ROOT-5',
    describe: 'Root on beat 1, fifth on beat 2 — classic 2-feel for country / folk / blues.',
    category: 'feel',
    previewHits: [
      { slot: 0, vel: 1.0, degree: 'R', sustainSlots: 3.6 },
      { slot: 4, vel: 0.9, degree: '5', sustainSlots: 3.6 },
    ],
    generate: staticPattern([
      { slot: 0, vel: 1.0, degree: 'R', sustainSlots: 3.6 },
      { slot: 4, vel: 0.9, degree: '5', sustainSlots: 3.6 },
    ]),
  },
  {
    id: 'syncopated',
    label: 'SYNCOP',
    describe: 'Syncopated 808 — root anchors on 1, syncopated push on the &.',
    category: 'feel',
    previewHits: [
      { slot: 0, vel: 1.0,  degree: 'R', sustainSlots: 2.7 },
      { slot: 3, vel: 0.85, degree: 'R', sustainSlots: 2.7 },
      { slot: 6, vel: 0.7,  degree: 'R', sustainSlots: 1.6 },
    ],
    generate: staticPattern([
      { slot: 0, vel: 1.0,  degree: 'R', sustainSlots: 2.7 },
      { slot: 3, vel: 0.85, degree: 'R', sustainSlots: 2.7 },
      { slot: 6, vel: 0.7,  degree: 'R', sustainSlots: 1.6 },
    ]),
  },
  {
    id: 'dotted',
    label: 'DOTTED',
    describe: 'Dotted 8th feel — pushes the groove forward.',
    category: 'feel',
    previewHits: [
      { slot: 0, vel: 1.0,  degree: 'R', sustainSlots: 2.7 },
      { slot: 3, vel: 0.92, degree: 'R', sustainSlots: 2.7 },
      { slot: 6, vel: 0.88, degree: 'R', sustainSlots: 1.6 },
    ],
    generate: staticPattern([
      { slot: 0, vel: 1.0,  degree: 'R', sustainSlots: 2.7 },
      { slot: 3, vel: 0.92, degree: 'R', sustainSlots: 2.7 },
      { slot: 6, vel: 0.88, degree: 'R', sustainSlots: 1.6 },
    ]),
  },
  {
    id: 'disco',
    label: 'PUMP 8',
    describe: 'Driving disco 8ths — alternates root and fifth on every off-beat.',
    category: 'feel',
    previewHits: [
      { slot: 0, vel: 1.0, degree: 'R', sustainSlots: 0.95 },
      { slot: 2, vel: 0.7, degree: 'R', sustainSlots: 0.95 },
      { slot: 4, vel: 0.9, degree: '5', sustainSlots: 0.95 },
      { slot: 6, vel: 0.7, degree: 'R', sustainSlots: 0.95 },
    ],
    generate: staticPattern([
      { slot: 0, vel: 1.0, degree: 'R', sustainSlots: 0.95 },
      { slot: 2, vel: 0.7, degree: 'R', sustainSlots: 0.95 },
      { slot: 4, vel: 0.9, degree: '5', sustainSlots: 0.95 },
      { slot: 6, vel: 0.7, degree: 'R', sustainSlots: 0.95 },
    ]),
  },
];

const BASS_PATTERN_MAP: Record<BassPatternId, BassPatternDef> = BASS_PATTERNS.reduce(
  (acc, p) => { acc[p.id] = p; return acc; },
  {} as Record<BassPatternId, BassPatternDef>,
);

/**
 * Post-process — sprinkle "fill" notes into the pattern's empty slots based on
 * the FILLS intensity (0..1). Fills lean toward chord tones (3, 5, 6, 7, O)
 * and chromatic approach on the last slot, giving the bass a more conversational,
 * "real-player" feel without breaking the underlying groove.
 */
function addFills(
  baseHits: BassHit[],
  ctx: BassPatternContext,
  fillsLevel: number,
): BassHit[] {
  if (fillsLevel <= 0.01) return baseHits;
  const used = new Set(baseHits.map((h) => Math.floor(h.slot)));
  const extras: BassHit[] = [];
  // The second half of the step is fair game; first half is sacred (downbeat).
  for (let slot = 1; slot < 8; slot++) {
    if (used.has(slot)) continue;
    const positionBoost = slot >= 4 ? 1.0 : 0.45;
    const chance = fillsLevel * 0.40 * positionBoost;
    if (ctx.rand() >= chance) continue;
    const roll = ctx.rand();
    let degree: BassHit['degree'];
    if (slot === 7 && ctx.nextPad) {
      degree = 'A';
    } else if (roll < 0.18) {
      degree = '5';
    } else if (roll < 0.40) {
      degree = 'O';
    } else if (roll < 0.60) {
      degree = '3';
    } else if (roll < 0.78) {
      degree = '6';
    } else if (roll < 0.90) {
      degree = '7';
    } else {
      degree = 'C';
    }
    extras.push({
      slot,
      vel: 0.40 + ctx.rand() * 0.30,
      degree,
      sustainSlots: 0.7 + ctx.rand() * 0.6,
    });
  }
  return [...baseHits, ...extras];
}

/** Optional pitch-glide info — when present the voice ramps frequency from
 *  the starting MIDI pitch to `toMidi` over `durSec`. This is what makes
 *  808-style slides and acid-bass glissandos sound right. */
interface BassGlide { toMidi: number; durSec: number; }

/** Voice: SUB — deep round sub-bass (sine + sub-octave + click) */
function bassSchedSub(ctx: AudioContext | OfflineAudioContext, midi: number, start: number, sustain: number, velocity: number, glide?: BassGlide): void {
  const freq = midiToFreq(midi);
  const targetFreq = glide ? midiToFreq(glide.toMidi) : freq;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0, start);
  out.gain.linearRampToValueAtTime(velocity, start + 0.008);
  out.gain.setTargetAtTime(velocity * 0.6, start + 0.05, 0.12);
  out.gain.setTargetAtTime(0, start + sustain, 0.08);

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  // For glides, follow the target frequency so the filter doesn't choke the slide.
  const filterCenterFreq = glide ? Math.max(freq, targetFreq) : freq;
  lp.frequency.setValueAtTime(filterCenterFreq * 8, start);
  lp.frequency.exponentialRampToValueAtTime(Math.max(120, filterCenterFreq * 3), start + 0.12);
  lp.Q.value = 1.4;

  const fund = ctx.createOscillator();
  fund.type = 'sine';
  fund.frequency.setValueAtTime(freq, start);
  if (glide) fund.frequency.exponentialRampToValueAtTime(targetFreq, start + glide.durSec);

  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(freq * 0.5, start);
  if (glide) sub.frequency.exponentialRampToValueAtTime(targetFreq * 0.5, start + glide.durSec);
  const subGain = ctx.createGain();
  subGain.gain.value = 0.55;

  const click = ctx.createOscillator();
  click.type = 'triangle';
  click.frequency.value = freq * 6;
  const clickGain = ctx.createGain();
  clickGain.gain.setValueAtTime(velocity * 0.45, start);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.025);

  fund.connect(lp);
  sub.connect(subGain).connect(lp);
  click.connect(clickGain).connect(lp);
  lp.connect(out).connect(ctx.destination);

  const stopAt = start + sustain + 0.4;
  fund.start(start); sub.start(start); click.start(start);
  fund.stop(stopAt); sub.stop(stopAt); click.stop(start + 0.06);
}

/** Voice: ELECTRIC — finger-style upright/electric simulation */
function bassSchedElectric(ctx: AudioContext | OfflineAudioContext, midi: number, start: number, sustain: number, velocity: number, glide?: BassGlide): void {
  const freq = midiToFreq(midi);
  const targetFreq = glide ? midiToFreq(glide.toMidi) : freq;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0, start);
  out.gain.linearRampToValueAtTime(velocity, start + 0.012);
  out.gain.exponentialRampToValueAtTime(Math.max(0.001, velocity * 0.5), start + 0.22);
  out.gain.setTargetAtTime(0, start + sustain, 0.14);

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  const filterCenterFreq = glide ? Math.max(freq, targetFreq) : freq;
  lp.frequency.setValueAtTime(filterCenterFreq * 14, start);
  lp.frequency.exponentialRampToValueAtTime(Math.max(380, filterCenterFreq * 5), start + 0.25);
  lp.Q.value = 2.6;

  const saw = ctx.createOscillator();
  saw.type = 'sawtooth';
  saw.frequency.setValueAtTime(freq, start);
  if (glide) saw.frequency.exponentialRampToValueAtTime(targetFreq, start + glide.durSec);

  const tri = ctx.createOscillator();
  tri.type = 'triangle';
  tri.frequency.setValueAtTime(freq * 2.005, start);
  if (glide) tri.frequency.exponentialRampToValueAtTime(targetFreq * 2.005, start + glide.durSec);
  const triG = ctx.createGain();
  triG.gain.value = 0.22;

  saw.connect(lp);
  tri.connect(triG).connect(lp);
  lp.connect(out).connect(ctx.destination);

  const stopAt = start + sustain + 0.5;
  saw.start(start); tri.start(start);
  saw.stop(stopAt); tri.stop(stopAt);
}

/** Voice: PLUCK — short percussive bass */
function bassSchedPluck(ctx: AudioContext | OfflineAudioContext, midi: number, start: number, sustain: number, velocity: number, glide?: BassGlide): void {
  const freq = midiToFreq(midi);
  const targetFreq = glide ? midiToFreq(glide.toMidi) : freq;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0, start);
  out.gain.linearRampToValueAtTime(velocity, start + 0.004);
  out.gain.exponentialRampToValueAtTime(Math.max(0.0001, velocity * 0.05), start + Math.min(0.45, sustain * 0.9));

  const bp = ctx.createBiquadFilter();
  bp.type = 'lowpass';
  const filterCenterFreq = glide ? Math.max(freq, targetFreq) : freq;
  bp.frequency.setValueAtTime(filterCenterFreq * 10, start);
  bp.frequency.exponentialRampToValueAtTime(Math.max(160, filterCenterFreq * 2), start + 0.18);
  bp.Q.value = 3.2;

  const sq = ctx.createOscillator();
  sq.type = 'sawtooth';
  sq.frequency.setValueAtTime(freq, start);
  if (glide) sq.frequency.exponentialRampToValueAtTime(targetFreq, start + glide.durSec);

  const body = ctx.createOscillator();
  body.type = 'sine';
  body.frequency.setValueAtTime(freq, start);
  if (glide) body.frequency.exponentialRampToValueAtTime(targetFreq, start + glide.durSec);
  const bodyG = ctx.createGain();
  bodyG.gain.value = 0.4;

  sq.connect(bp);
  body.connect(bodyG).connect(bp);
  bp.connect(out).connect(ctx.destination);

  const stopAt = start + Math.min(0.55, sustain) + 0.12;
  sq.start(start); body.start(start);
  sq.stop(stopAt); body.stop(stopAt);
}

const BASS_VOICE_FN: Record<BassVoiceId, (ctx: AudioContext | OfflineAudioContext, midi: number, start: number, sustain: number, velocity: number, glide?: BassGlide) => void> = {
  sub: bassSchedSub,
  electric: bassSchedElectric,
  pluck: bassSchedPluck,
};

/**
 * Resolve the MIDI pitch for one bass hit, given the chord-step context.
 * `pad.notes[0]` is the chord root (lowest voicing note); `pad.notes[1] − pad.notes[0]`
 * tells us if the chord is major (4) or minor (3) for walking-bass thirds.
 */
/** Compute the bass root (= chord root in the bass register) used as the
 *  zero-offset reference for Piano-Roll-painted custom hits. */
function computeBassRoot(pad: ChordPad, bassOctaveShift: number): number {
  return pad.notes[0]! - 12 + bassOctaveShift * 12;
}

function resolveBassMidi(
  hit: BassHit,
  pad: ChordPad,
  nextPad: ChordPad | null,
  bassOctaveShift: number,
): number {
  // Piano-Roll-painted notes carry an explicit MIDI value — short-circuit the
  // degree-based logic so custom pitches play exactly as the user drew them.
  if (hit.midiOverride != null) return hit.midiOverride;

  const chordRoot = pad.notes[0]!;
  // Drop chord root down to a bass register (default an octave below the chord voicing root)
  const bassRoot = chordRoot - 12 + bassOctaveShift * 12;
  // Detect chord quality so 3rds and 7ths track major/minor automatically.
  const thirdInterval = pad.notes.length >= 2 ? (pad.notes[1]! - chordRoot) : 4;
  const isMinor = thirdInterval === 3;
  switch (hit.degree) {
    case 'R': return bassRoot;
    case '5': return bassRoot + 7;
    case 'O': return bassRoot + 12;
    case '3': return bassRoot + (isMinor ? 3 : 4);
    case '6': return bassRoot + (isMinor ? 8 : 9);
    case '7': {
      // Check whether the chord voicing actually contains the 7th, otherwise
      // pick a sensible default (minor → b7, major → 6 to avoid clashing maj7).
      const seventhInChord = pad.notes.find((n) => {
        const interval = (n - chordRoot + 1200) % 12;
        return interval === 10 || interval === 11;
      });
      if (seventhInChord != null) {
        return bassRoot + (((seventhInChord - chordRoot) % 12) + 12) % 12;
      }
      return bassRoot + (isMinor ? 10 : 9);
    }
    case 'L': return bassRoot - 2; // diatonic lower neighbor
    case 'C': return bassRoot + 1; // chromatic upper-half (passing color)
    case 'A': {
      // Approach a half-step below the next chord's root; fall back to the
      // chord's fifth when the progression has no follower (loop / last step).
      if (nextPad) {
        const nextRoot = nextPad.notes[0]! - 12 + bassOctaveShift * 12;
        return nextRoot - 1;
      }
      return bassRoot + 7;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SUGGEST — variation level + section-type targeting
// ─────────────────────────────────────────────────────────────────────────────
// VARIATION LEVEL:
//   strict — use the genre's progression chords exactly as written
//   spice  — ~35% chance per chord to add a tasteful 7th/maj7/m7 color
//   bold   — ~55% chance per chord to add color + sometimes swap a chord for a
//            related sibling (sec-dom approach, bVII borrow, tritone hint)
// SECTION FLAVOR:
//   We score each progression in the genre's bank against the chosen section
//   type — Intro/Verse/Pre-Chorus/Chorus/Hook/Bridge/Outro/Free — and pick
//   randomly from the top scorers so it stays musical AND varied.

type VariationLevel = 'strict' | 'spice' | 'bold';
type SectionFlavor = 'free' | 'intro' | 'verse' | 'pre-chorus' | 'chorus' | 'hook' | 'bridge' | 'outro';

const VARIATION_LEVELS: { id: VariationLevel; label: string; desc: string }[] = [
  { id: 'strict', label: 'STRICT', desc: 'Use the genre\'s progressions exactly as written — clean, expected.' },
  { id: 'spice',  label: 'SPICE',  desc: 'Add 7ths and color tones (Imaj7, V7, vi7, etc.) on ~35% of chords.' },
  { id: 'bold',   label: 'BOLD',   desc: 'Aggressive color + occasional substitutions and borrowed chords. Adventurous.' },
];

const SECTION_FLAVORS: { id: SectionFlavor; label: string }[] = [
  { id: 'free',       label: 'Free' },
  { id: 'intro',      label: 'Intro' },
  { id: 'verse',      label: 'Verse' },
  { id: 'pre-chorus', label: 'Pre-Chorus' },
  { id: 'chorus',     label: 'Chorus' },
  { id: 'hook',       label: 'Hook' },
  { id: 'bridge',     label: 'Bridge' },
  { id: 'outro',      label: 'Outro' },
];

/** Strip 7/maj7/9/etc. and return the bare degree token (I, ii, IV, V, bVII, etc.). */
function baseDegree(chord: string): string {
  // Find the longest leading run of "i", "I", "v", "V" plus optional leading "b"
  const m = chord.match(/^(b?)([iIvV]+°?)/);
  return m ? `${m[1]}${m[2]}` : chord;
}

/** Quick test — is the chord built on the tonic (I / i / Imaj7 / i7 …)? */
function isTonicChord(chord: string): boolean {
  const d = baseDegree(chord);
  return d === 'I' || d === 'i';
}

interface ProgClassification {
  startsOnTonic: boolean;
  endsOnTonic: boolean;
  endsOnDominant: boolean;
  hasIvToV: boolean;
  hasBorrowed: boolean;
  hasModal: boolean;
  startsOffTonic: boolean;
  length: number;
}

function classifyProgression(chords: ReadonlyArray<string>): ProgClassification {
  const first = chords[0] ?? '';
  const last = chords[chords.length - 1] ?? '';
  let hasIvToV = false;
  for (let i = 0; i < chords.length - 1; i++) {
    if (baseDegree(chords[i]!) === 'IV' && baseDegree(chords[i + 1]!) === 'V') {
      hasIvToV = true;
      break;
    }
  }
  const hasBorrowed = chords.some((c) => baseDegree(c).startsWith('b'));
  const hasModal = chords.some((c) => {
    const d = baseDegree(c);
    return d === 'bVII' || d === 'bIII' || d === 'bVI' || d === 'III' || d === 'VII' || d === 'VI';
  });
  return {
    startsOnTonic: isTonicChord(first),
    endsOnTonic: isTonicChord(last),
    endsOnDominant: baseDegree(last) === 'V',
    hasIvToV,
    hasBorrowed,
    hasModal,
    startsOffTonic: !isTonicChord(first),
    length: chords.length,
  };
}

/** Score a progression against a section flavor. Higher score = better fit. */
function scoreForSection(c: ProgClassification, flavor: SectionFlavor): number {
  if (flavor === 'free') return 1;
  let s = 0.3;
  switch (flavor) {
    case 'intro':
      if (c.startsOnTonic) s += 0.4;
      if (c.length <= 4) s += 0.2;
      if (c.hasModal) s += 0.1;
      break;
    case 'verse':
      if (c.startsOnTonic) s += 0.45;
      if (!c.endsOnDominant) s += 0.15;
      break;
    case 'pre-chorus':
      if (c.endsOnDominant) s += 0.55;
      if (c.hasIvToV) s += 0.2;
      if (c.startsOffTonic) s += 0.1;
      break;
    case 'chorus':
      if (c.hasIvToV) s += 0.4;
      if (c.startsOnTonic) s += 0.2;
      if (c.endsOnTonic || c.endsOnDominant) s += 0.15;
      break;
    case 'hook':
      if (c.startsOnTonic) s += 0.35;
      if (c.hasIvToV) s += 0.25;
      if (c.length <= 4) s += 0.15;
      break;
    case 'bridge':
      if (c.hasBorrowed) s += 0.45;
      if (c.hasModal) s += 0.3;
      if (c.startsOffTonic) s += 0.2;
      break;
    case 'outro':
      if (c.endsOnTonic) s += 0.55;
      if (c.length <= 4) s += 0.15;
      break;
  }
  return s;
}

/** Map a bare degree to a "colored" variant (adds 7th flavor). */
function colorize(chord: string, rand: () => number): string {
  // If the chord already has color (7/maj7/9/sus/add) leave it alone.
  if (/7|9|11|13|sus|add|°|maj/.test(chord)) return chord;
  const d = baseDegree(chord);
  switch (d) {
    case 'I':  return rand() < 0.55 ? 'Imaj7' : 'I7';
    case 'i':  return 'i7';
    case 'ii': return 'ii7';
    case 'iii':return 'iii7';
    case 'IV': return rand() < 0.55 ? 'IVmaj7' : 'IV7';
    case 'iv': return 'iv7';
    case 'V':  return 'V7';
    case 'v':  return 'v7';
    case 'vi': return 'vi7';
    case 'VI': return 'VImaj7';
    case 'bVII': return 'bVII';
    case 'bVI':  return 'bVI';
    case 'bIII': return 'bIII';
    default:   return chord;
  }
}

/** Bold substitutions — swap a chord for a sibling that fits in the key. */
function boldSubstitute(chord: string, rand: () => number): string {
  const d = baseDegree(chord);
  // Tritone/related substitutions and borrowed-chord swaps.
  const subs: Record<string, string[]> = {
    'IV':   ['ii7', 'IVmaj7', 'bVII'],
    'V':    ['V7', 'V7', 'bII7'], // weighted toward V7
    'vi':   ['vi7', 'bVI'],
    'I':    ['Imaj7', 'iii7'],
    'ii':   ['ii7', 'IV'],
    'iii':  ['iii7', 'I'],
    'i':    ['i7'],
    'iv':   ['iv7', 'bVI'],
    'VII':  ['bVII', 'V7'],
  };
  const options = subs[d];
  if (!options || options.length === 0) return chord;
  return options[Math.floor(rand() * options.length)]!;
}

// ─────────────────────────────────────────────────────────────────────────────
// SAVED PRESETS — localStorage-backed progression library
// ─────────────────────────────────────────────────────────────────────────────
// The user can save the current step row (and the key/mode/genre context) as
// a named preset, then recall it later. We store the chord SYMBOLS for each
// step (not pad indices) so a preset can be loaded even after the key/genre
// changes — we resolve symbols against the active pad map at load time.

const CHORD_SEQ_PRESETS_KEY = 'da_chord_seq_presets_v1';

interface SavedChordPreset {
  id: string;
  name: string;
  createdAt: number;
  keyRoot: number;
  mode: ChordMode;
  genreId: string;
  bpm: number;
  stepCount: number;
  stepSymbols: (string | null)[];
  chordsMuted?: boolean;
  bassConfig?: {
    voice: BassVoiceId;
    pattern: BassPatternId;
    octaveShift: number;
    volume: number;
    fillsLevel?: number;
    /** Reason-style feel controls — added in v4. Optional for back-compat. */
    swing?: number;
    noteLength?: number;
    slide?: number;
    /** Piano-Roll-painted per-step overrides, keyed by chord-step index. */
    customPatterns?: Record<number, CustomBassHit[]>;
    /** 8 saved bass "kits" (slots A-H). Nullable per slot. */
    slots?: Record<SlotId, BassSlot | null>;
    /** Per-step slot overrides, keyed by chord-step index. */
    stepSlots?: Record<number, SlotId>;
    stepMutes: boolean[];
    enabled: boolean;
  };
}

function loadAllPresets(): SavedChordPreset[] {
  try {
    const raw = localStorage.getItem(CHORD_SEQ_PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p): p is SavedChordPreset =>
      p && typeof p.id === 'string' && typeof p.name === 'string' && Array.isArray(p.stepSymbols)
    );
  } catch {
    return [];
  }
}

function writeAllPresets(list: SavedChordPreset[]): void {
  try {
    localStorage.setItem(CHORD_SEQ_PRESETS_KEY, JSON.stringify(list));
  } catch {
    // quota / private-mode — silent
  }
}

/** Apply variation to a progression's chord list. Returns a new array. */
function applyVariation(
  chords: ReadonlyArray<string>,
  level: VariationLevel,
  rand: () => number,
): string[] {
  if (level === 'strict') return [...chords];
  const colorProb = level === 'spice' ? 0.35 : 0.55;
  const subProb = level === 'bold' ? 0.22 : 0;
  const out: string[] = [];
  for (let i = 0; i < chords.length; i++) {
    let c = chords[i]!;
    if (subProb > 0 && rand() < subProb) c = boldSubstitute(c, rand);
    if (rand() < colorProb) c = colorize(c, rand);
    out.push(c);
  }
  return out;
}

/** Orchid linked chords — one voicing per bass note (piano roll / keypad). */
interface LinkedOrchidBassOpts {
  volume: number;
  muted: boolean;
  keyRoot: number;
  mode: ChordMode;
  smartMatch: boolean;
  chordType: OrchidChordType;
  extensions: ReadonlySet<OrchidExtension>;
  inversion: number;
  perfMode: OrchidPerformanceMode;
  bpm: number;
  voice: ChordVoiceId;
}

function scheduleBassStep(
  ctx: AudioContext | OfflineAudioContext,
  pad: ChordPad,
  nextPad: ChordPad | null,
  stepStart: number,
  secPerStep: number,
  pattern: BassPatternDef,
  voice: BassVoiceId,
  octaveShift: number,
  masterVelocity: number,
  options?: {
    stepIdx?: number;
    totalSteps?: number;
    fillsLevel?: number;
    /** 0 = straight, 1 = max shuffle. Pushes odd 16th-note sub-slots later. */
    swing?: number;
    /** Sustain multiplier. 0.3 = staccato, 1.0 = normal, 2.0 = legato/held. */
    noteLength?: number;
    /** 0 = no slides, 1 = always glide between close adjacent different-pitch hits. */
    slide?: number;
    /** If provided, replaces the pattern's `generate()` output for this step.
     *  Used by the Piano-Roll editor to play back user-painted notes instead
     *  of the auto-generated pattern. Fills are also bypassed when present. */
    customHits?: ReadonlyArray<CustomBassHit>;
    /** When volume > 0, each bass hit also triggers a matching Orchid chord. */
    linkedOrchid?: LinkedOrchidBassOpts;
    rand?: () => number;
  },
): void {
  const subDur = secPerStep / 8;
  const voiceFn = BASS_VOICE_FN[voice];
  const stepIdx = options?.stepIdx ?? 0;
  const totalSteps = options?.totalSteps ?? 8;
  const fillsLevel = Math.max(0, Math.min(1, options?.fillsLevel ?? 0));
  const swing = Math.max(0, Math.min(1, options?.swing ?? 0));
  const noteLength = Math.max(0.2, Math.min(2.5, options?.noteLength ?? 1));
  const slide = Math.max(0, Math.min(1, options?.slide ?? 0));
  const rand = options?.rand ?? Math.random;
  const patternCtx: BassPatternContext = { pad, nextPad, stepIdx, totalSteps, rand };

  let hits: BassHit[];
  if (options?.customHits && options.customHits.length > 0) {
    // PIANO-ROLL OVERRIDE — convert custom hits (root-relative offsets) into
    // BassHits with absolute MIDI overrides. Skip fills / pattern.generate
    // entirely so the user's painting plays back exactly as drawn.
    const bassRoot = computeBassRoot(pad, octaveShift);
    hits = options.customHits.map((c) => ({
      slot: c.slot,
      sustainSlots: c.sustainSlots,
      vel: c.vel,
      degree: 'R',                              // unused (overridden below)
      midiOverride: bassRoot + c.midiOffset,
    }));
  } else {
    hits = pattern.generate(patternCtx);
    if (fillsLevel > 0) hits = addFills(hits, patternCtx, fillsLevel);
  }
  // Sort so adjacent-slot detection for slide is reliable.
  hits = [...hits].sort((a, b) => a.slot - b.slot);

  // Off-beat slots (odd sub-16th) get pushed later by up to half a sub-slot at swing=1.
  // That maps the straight 16ths to a triplet-leaning shuffle around ~67% at the max.
  const swingShiftFor = (slot: number): number => (slot % 2 === 1 ? swing * 0.5 * subDur : 0);

  const consumed = new Set<number>();
  for (let i = 0; i < hits.length; i++) {
    if (consumed.has(i)) continue;
    const hit = hits[i]!;
    const tBase = stepStart + hit.slot * subDur + swingShiftFor(hit.slot);
    const midi = resolveBassMidi(hit, pad, nextPad, octaveShift);
    let sustain = Math.max(0.04, hit.sustainSlots * subDur * noteLength);
    let glide: BassGlide | undefined;

    // SLIDE: if the next hit is close (<=3 sub-slots) and a different pitch,
    // and the dice roll under the slide amount, merge the two notes into a
    // single tied glide that ramps frequency from this pitch to the next.
    if (slide > 0 && i + 1 < hits.length) {
      const nh = hits[i + 1]!;
      const slotGap = nh.slot - hit.slot;
      if (slotGap >= 1 && slotGap <= 3) {
        const nextMidi = resolveBassMidi(nh, pad, nextPad, octaveShift);
        if (nextMidi !== midi && rand() < slide) {
          const tNext = stepStart + nh.slot * subDur + swingShiftFor(nh.slot);
          const glideDur = Math.max(0.04, tNext - tBase);
          const tailSustain = Math.max(0.05, nh.sustainSlots * subDur * noteLength);
          sustain = glideDur + tailSustain;
          glide = { toMidi: nextMidi, durSec: glideDur };
          consumed.add(i + 1);
        }
      }
    }

    voiceFn(ctx, midi, tBase, sustain, hit.vel * masterVelocity, glide);

    const lo = options?.linkedOrchid;
    if (lo && !lo.muted && lo.volume > 0.02) {
      const type = lo.smartMatch
        ? diatonicOrchidTypeForRootPc(midi % 12, lo.keyRoot, lo.mode)
        : lo.chordType;
      const chordNotes = buildOrchidNotesForBassRoot(midi, type, lo.extensions, lo.inversion);
      scheduleOrchidChord(
        ctx,
        chordNotes,
        tBase,
        Math.min(sustain, secPerStep * 0.82),
        lo.voice,
        lo.volume,
        { mode: lo.perfMode, bpm: lo.bpm },
      );
    }
  }
}

/** Sustain clamp for piano-roll CustomBassHit (must fit in one 8-slot step). */
function clampCustomBassSustain(slot: number, sus: number): number {
  return Math.max(1, Math.min(8 - slot, Math.round(sus)));
}

/**
 * Same BassHit pipeline as audio (generate + optional fills), without custom
 * hits or slide merging — used to stamp chord-smart notes into the piano roll.
 */
function buildAutomatedBassHitsForStep(args: {
  pad: ChordPad;
  nextPad: ChordPad | null;
  stepIdx: number;
  totalSteps: number;
  pattern: BassPatternDef;
  fillsLevel: number;
  rand: () => number;
}): BassHit[] {
  const patternCtx: BassPatternContext = {
    pad: args.pad,
    nextPad: args.nextPad,
    stepIdx: args.stepIdx,
    totalSteps: args.totalSteps,
    rand: args.rand,
  };
  let hits = args.pattern.generate(patternCtx);
  if (args.fillsLevel > 0.01) hits = addFills(hits, patternCtx, args.fillsLevel);
  return [...hits].sort((a, b) => a.slot - b.slot);
}

/** Convert scheduled bass hits to root-relative custom hits (piano roll range). */
function bassHitsToCustomPattern(
  hits: BassHit[],
  pad: ChordPad,
  nextPad: ChordPad | null,
  octaveShift: number,
): CustomBassHit[] {
  const bassRoot = computeBassRoot(pad, octaveShift);
  return hits.map((h) => {
    const slot = Math.max(0, Math.min(7, Math.round(h.slot)));
    const midi = resolveBassMidi(h, pad, nextPad, octaveShift);
    const rawOffset = midi - bassRoot;
    return {
      slot,
      sustainSlots: clampCustomBassSustain(slot, h.sustainSlots),
      midiOffset: Math.max(-12, Math.min(12, rawOffset)),
      vel: Math.max(0.05, Math.min(1, h.vel)),
    };
  });
}

// ── BUILD A STANDARD MIDI FILE FROM THE FULL SEQUENCE ─────────────────────
// Captures BOTH the chord blocks (channel 0) and the bass line (channel 1) so
// the exported .mid opens in any DAW with two playable, separable parts.
//   • Chords play for ~90% of the step (small gap so back-to-back chords
//     have a clean release tail).
//   • Bass uses the user's PAINTED notes when a step has any custom hits;
//     otherwise it falls back to the bass root for that step (a long
//     half-note per chord — the same default the auto-pattern would do
//     when "ROOT" pattern is selected). This way the exported file always
//     contains a usable bass line even if the user never opened the piano
//     roll.
function buildSequencerMidiFile(args: {
  steps: ReadonlyArray<number | null>;
  pads: ReadonlyArray<ChordPad>;
  bpm: number;
  bassEnabled: boolean;
  bassOctaveShift: number;
  bassCustomPatterns: Record<number, CustomBassHit[]>;
  trackName: string;
}): Uint8Array {
  const tpq = 480;
  // Each step = 2 beats (half-note) — same math the audio engine uses
  // (secPerStep = (60/bpm) * 2). Keeping these in lock-step means the
  // exported MIDI sounds identical to the in-app preview at the same BPM.
  const ticksPerStep = 2 * tpq;
  const notes: MidiNoteEvent[] = [];

  for (let i = 0; i < args.steps.length; i++) {
    const padIdx = args.steps[i];
    if (padIdx == null) continue;
    const pad = args.pads[padIdx];
    if (!pad) continue;
    const stepStart = i * ticksPerStep;

    // ── CHORD (channel 0) ──
    const chordDur = Math.max(1, Math.floor(ticksPerStep * 0.9));
    for (const midi of pad.notes) {
      notes.push({
        midi,
        startTick: stepStart,
        durationTicks: chordDur,
        velocity: 100,
        channel: 0,
      });
    }

    // ── BASS (channel 1) ──
    if (args.bassEnabled) {
      const bassRoot = pad.notes[0]! - 12 + args.bassOctaveShift * 12;
      const customHits = args.bassCustomPatterns[i];
      if (customHits && customHits.length > 0) {
        for (const hit of customHits) {
          const slotStart = Math.round(stepStart + (hit.slot / 8) * ticksPerStep);
          const sus = Math.max(1, Math.round((hit.sustainSlots / 8) * ticksPerStep));
          notes.push({
            midi: bassRoot + hit.midiOffset,
            startTick: slotStart,
            durationTicks: sus,
            velocity: Math.max(1, Math.min(127, Math.round(hit.vel * 127))),
            channel: 1,
          });
        }
      } else {
        notes.push({
          midi: bassRoot,
          startTick: stepStart,
          durationTicks: chordDur,
          velocity: 100,
          channel: 1,
        });
      }
    }
  }

  return buildStandardMidiFile({
    notes,
    bpm: args.bpm,
    ticksPerQuarter: tpq,
    trackName: args.trackName,
  });
}

async function renderToWav(
  steps: ReadonlyArray<number | null>,
  pads: ReadonlyArray<ChordPad>,
  bpm: number,
  chordVoice: ChordVoiceId,
  chordVolume: number,
  octaveShift: number,
  orchidPerfMode: OrchidPerformanceMode,
  padNoteOverrides: Readonly<Record<number, number[]>>,
): Promise<Uint8Array> {
  const secPerStep = (60 / Math.max(1, bpm)) * 2;
  const totalSec = Math.max(1, steps.length) * secPerStep + 1.2;
  const sr = 44100;
  const offline = new OfflineAudioContext(1, Math.ceil(totalSec * sr), sr);
  for (let i = 0; i < steps.length; i++) {
    const padIdx = steps[i];
    if (padIdx == null) continue;
    const pad = pads[padIdx];
    if (!pad) continue;
    const notes = (padNoteOverrides[pad.idx] ?? pad.notes).map((n) => n + octaveShift * 12);
    scheduleOrchidChord(offline, notes, i * secPerStep, secPerStep * 0.9, chordVoice, chordVolume, {
      mode: orchidPerfMode,
      bpm,
    });
  }
  const rendered = await offline.startRendering();
  const pcm = rendered.getChannelData(0);
  const out = new Uint8Array(44 + pcm.length * 2);
  const dv = new DataView(out.buffer);
  const ws = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i));
  };
  ws(0, 'RIFF');
  dv.setUint32(4, 36 + pcm.length * 2, true);
  ws(8, 'WAVE');
  ws(12, 'fmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, 1, true);
  dv.setUint32(24, sr, true);
  dv.setUint32(28, sr * 2, true);
  dv.setUint16(32, 2, true);
  dv.setUint16(34, 16, true);
  ws(36, 'data');
  dv.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]!));
    dv.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return out;
}

function suitability(a: ChordPad, b: ChordPad): number {
  if (a.idx === b.idx) return 1;
  const ap = new Set(a.notes.map((n) => n % 12));
  const overlap = b.notes.filter((n) => ap.has(n % 12)).length;
  const overlapScore = overlap / Math.max(a.notes.length, b.notes.length);
  const rootA = a.notes[0]! % 12;
  const rootB = b.notes[0]! % 12;
  const motion = (rootB - rootA + 12) % 12;
  const motionBonus = motion === 5 ? 0.35 : motion === 7 ? 0.26 : motion === 2 || motion === 10 ? 0.12 : 0.06;
  return Math.min(1, overlapScore * 0.7 + motionBonus);
}

// Quality variants generated on top of every triad pad — these come AFTER the
// genre's curated diatonic pads so the user gets a wide-open palette to choose from.
// Each variant is keyed by triad type (major / minor) it applies to.
// Each variant carries the full display suffix (already includes "m" when
// needed). We keep separate entries for major-base vs minor-base because a
// minor-root pad expanding to a 7th chord becomes m7, not 7.
interface QualityVariant {
  suffix: string;            // appears verbatim after the root letter, e.g. "add9", "msus4", "maj7"
  symbolTag: string;         // internal pad symbol disambiguation
  intervals: number[];       // intervals from root in semitones
  appliesTo: 'major' | 'minor' | 'both';
}

const QUALITY_VARIANTS: QualityVariant[] = [
  // Sus chords are root-quality agnostic (no 3rd) so use one name regardless of parent
  { suffix: 'sus2',  symbolTag: 'sus2',  intervals: [0, 2, 7],         appliesTo: 'both'  },
  { suffix: 'sus4',  symbolTag: 'sus4',  intervals: [0, 5, 7],         appliesTo: 'both'  },

  // Major-root variants
  { suffix: 'add9',  symbolTag: 'add9',  intervals: [0, 4, 7, 14],     appliesTo: 'major' },
  { suffix: '6',     symbolTag: 'maj6',  intervals: [0, 4, 7, 9],      appliesTo: 'major' },
  { suffix: '7',     symbolTag: 'dom7',  intervals: [0, 4, 7, 10],     appliesTo: 'major' },
  { suffix: 'maj7',  symbolTag: 'maj7',  intervals: [0, 4, 7, 11],     appliesTo: 'major' },
  { suffix: '9',     symbolTag: 'dom9',  intervals: [0, 4, 7, 10, 14], appliesTo: 'major' },
  { suffix: 'maj9',  symbolTag: 'maj9',  intervals: [0, 4, 7, 11, 14], appliesTo: 'major' },

  // Minor-root variants
  { suffix: 'madd9', symbolTag: 'madd9', intervals: [0, 3, 7, 14],     appliesTo: 'minor' },
  { suffix: 'm6',    symbolTag: 'min6',  intervals: [0, 3, 7, 9],      appliesTo: 'minor' },
  { suffix: 'm7',    symbolTag: 'min7',  intervals: [0, 3, 7, 10],     appliesTo: 'minor' },
  { suffix: 'm9',    symbolTag: 'min9',  intervals: [0, 3, 7, 10, 14], appliesTo: 'minor' },
  { suffix: 'mMaj7', symbolTag: 'mmaj7', intervals: [0, 3, 7, 11],     appliesTo: 'minor' },
];

function buildPadsFromGenre(keyRoot: number, mode: ChordMode, genre: GenreDef, complexity: VoicingComplexity): ChordPad[] {
  const symbols: ChordSymbol[] = [];
  const seen = new Set<string>();
  const pushSym = (s: ChordSymbol) => {
    if (seen.has(s)) return;
    seen.add(s);
    symbols.push(s);
  };

  for (const p of genre.progressions) for (const c of p.chords) pushSym(c);

  for (const s of ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°', 'i', 'ii°', 'III', 'iv', 'VI', 'VII']) pushSym(s);

  const pads: ChordPad[] = [];
  for (const sym of symbols) {
    const base = chordSymbolToMidi(sym, keyRoot, mode, 3);
    if (!base || base.length === 0) continue;
    let notes = [...base].sort((a, b) => a - b);
    notes = notes.map((n) => n + 12);

    const has7 = /7|9|11|13|ø|\(maj7\)/.test(sym);
    if (!has7 && complexity !== 'simple') {
      notes.push(notes[0]! + 10);
      if (complexity === 'pro') notes.push(notes[0]! + 14);
    } else if (has7 && complexity === 'pro') {
      notes.push(notes[0]! + 14);
    }

    const capped = Array.from(new Set(notes)).filter((n) => n >= 36 && n <= 92).sort((a, b) => a - b);
    pads.push({
      idx: pads.length,
      symbol: sym,
      name: chordSymbolToName(sym, keyRoot, mode),
      notes: capped,
    });
    if (pads.length >= TARGET_PAD_COUNT) break;
  }

  // ── Synthesize quality variations on top of every unique-root triad pad ──
  // For each diatonic root we expose the full palette of sus / add / 7 / 9
  // colors, regardless of whether the genre's progression table mentions them.
  // The user explicitly asked the options panel to be wide-open so the ear,
  // not the rule-set, can pick the chord that feels right.
  const symbolSeen = new Set(pads.map((p) => p.symbol));
  const rootSeen = new Map<number, { triadIsMinor: boolean }>();
  for (const p of pads) {
    if (p.notes.length < 3) continue;
    const third = p.notes[1]! - p.notes[0]!;
    if (third !== 3 && third !== 4) continue;
    const rootPc = p.notes[0]! % 12;
    if (!rootSeen.has(rootPc)) rootSeen.set(rootPc, { triadIsMinor: third === 3 });
  }

  for (const [rootPc, info] of rootSeen.entries()) {
    const rootMidi = 48 + rootPc + 12; // octave 4 — matches lifted triads
    const letter = NOTE_LETTERS[rootPc] ?? '?';
    const parentQuality: 'major' | 'minor' = info.triadIsMinor ? 'minor' : 'major';

    for (const v of QUALITY_VARIANTS) {
      if (v.appliesTo !== 'both' && v.appliesTo !== parentQuality) continue;

      const padNotes = v.intervals
        .map((iv) => rootMidi + iv)
        .filter((n) => n >= 36 && n <= 92)
        .sort((a, b) => a - b);
      if (padNotes.length < 3) continue;

      const padSymbol = `${letter}:${v.symbolTag}`;
      if (symbolSeen.has(padSymbol)) continue;
      symbolSeen.add(padSymbol);

      pads.push({
        idx: pads.length,
        symbol: padSymbol,
        name: `${letter}${v.suffix}`,
        notes: padNotes,
      });
      if (pads.length >= TARGET_PAD_COUNT) return pads;
    }
  }

  return pads;
}

function BottomKeyboard({ notes }: { notes: number[] }) {
  // Full 88-key piano: A0 (MIDI 21) → C8 (MIDI 108).
  // White keys span the entire screen width edge-to-edge; black keys are
  // absolute-positioned overlays. Only the SPECIFIC chord notes light up
  // (not every octave of that pitch class) so the user sees the chord in
  // its actual register.
  const START_MIDI = 21;
  const END_MIDI = 108;
  const litMidi = new Set(notes);

  // Build white / black key lists once
  const whites: number[] = [];
  const blacks: number[] = [];
  for (let m = START_MIDI; m <= END_MIDI; m++) {
    const pc = m % 12;
    const isBlack = pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10;
    if (isBlack) blacks.push(m);
    else whites.push(m);
  }
  const whiteCount = whites.length;
  const whiteW = 100 / whiteCount; // % width per white key

  // For each black key, position it 70% of a white-key width past the white
  // key just below it — gives the slightly-offset realistic piano look.
  const blackKeys = blacks.map((m) => {
    let beforeIdx = 0;
    for (let i = whiteCount - 1; i >= 0; i--) {
      if (whites[i]! < m) { beforeIdx = i; break; }
    }
    return { midi: m, x: (beforeIdx + 0.7) * whiteW };
  });

  return (
    <div style={{ position: 'relative', width: '100%', height: 56, background: '#0a0a0a' }}>
      {/* White keys row */}
      <div style={{ display: 'flex', height: 56, width: '100%' }}>
        {whites.map((m) => {
          const lit = litMidi.has(m);
          const isCNote = m % 12 === 0;
          return (
            <div
              key={m}
              style={{
                flex: 1,
                background: lit ? '#86efac' : '#e8ebe2',
                borderRight: '1px solid #2a2a2a',
                borderBottom: '1px solid #1a1a1a',
                borderRadius: '0 0 2px 2px',
                position: 'relative',
                boxShadow: lit ? 'inset 0 -8px 8px -4px #22c55e88' : 'none',
                transition: 'background 60ms, box-shadow 60ms',
              }}
            >
              {/* C-note octave labels (only when there's room) */}
              {isCNote && whiteCount <= 60 && (
                <span style={{ position: 'absolute', bottom: 1, left: '50%', transform: 'translateX(-50%)', fontSize: 6, color: '#666', fontWeight: 700, pointerEvents: 'none' }}>
                  C{Math.floor(m / 12) - 1}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {/* Black keys overlay */}
      {blackKeys.map((b) => {
        const lit = litMidi.has(b.midi);
        return (
          <div
            key={b.midi}
            style={{
              position: 'absolute',
              left: `${b.x}%`,
              top: 0,
              width: `${whiteW * 0.6}%`,
              height: 34,
              background: lit ? '#22c55e' : '#0c0c0c',
              border: '1px solid #000',
              borderRadius: '0 0 2px 2px',
              boxShadow: lit ? '0 0 6px #22c55eaa' : 'inset 0 -2px 2px #0006',
              transition: 'background 60ms, box-shadow 60ms',
              zIndex: 2,
              pointerEvents: 'none',
            }}
          />
        );
      })}
    </div>
  );
}

interface ChordSequencerProps {
  embedded?: boolean;
  isScreenActive?: boolean;
  /** Standalone Creation Station tab (full Orchid workspace, not embedded in Chord/Bass). */
  standalone?: 'orchid';
  onBack?: () => void;
  onExportToPad?: (args: { padIndex: number; wavBytes: Uint8Array; label: string; rootBpm: number }) => void;
  onOpen808Lab?: () => void;
  bpm: number;
  getAudioContext: () => AudioContext;
}

export default function ChordSequencerScreen({
  embedded,
  isScreenActive,
  standalone,
  onBack,
  onExportToPad,
  onOpen808Lab,
  bpm: masterBpm,
  getAudioContext: getCtx,
}: ChordSequencerProps) {
  const isOrchidStandalone = standalone === 'orchid';
  const initialGenre = GENRES.find((g) => g.id === 'pop') ?? GENRES[0]!;

  const [localBpm, setLocalBpm] = useState(masterBpm || 100);
  const [keyRoot, setKeyRoot] = useState(0);
  const [mode, setMode] = useState<ChordMode>(initialGenre.mode);
  const [genreId, setGenreId] = useState(initialGenre.id);
  const [voicingComplexity, setVoicingComplexity] = useState<VoicingComplexity>('rich');
  const [octaveShift, setOctaveShift] = useState(0);

  // ── CHORDS MUTE ── lets the user solo the bass line without removing
  // any steps. The chord pads dim visually while muted so it's obvious. ──
  const [chordsMuted, setChordsMuted] = useState(false);
  const [chordVoice, setChordVoice] = useState<ChordVoiceId>('grand');
  const [proProgressionsOpen, setProProgressionsOpen] = useState(false);
  const pendingProLoadRef = useRef<ProProgressionEntry | null>(null);
  const [chordVolume, setChordVolume] = useState(0.82);

  // ── Orchid-style chord builder (type + stackable extensions + voicing + performance) ──
  const [orchidType, setOrchidType] = useState<OrchidChordType>('maj');
  const [orchidExtensions, setOrchidExtensions] = useState<Set<OrchidExtension>>(() => new Set());
  const [orchidInversion, setOrchidInversion] = useState(0);
  const [orchidPerfMode, setOrchidPerfMode] = useState<OrchidPerformanceMode>('strum');
  const [orchidRootMidi, setOrchidRootMidi] = useState(60);
  const [orchidSmartMatch, setOrchidSmartMatch] = useState(true);
  const [orchidLinkedChordVolume, setOrchidLinkedChordVolume] = useState(0);
  const [orchidLinkedChordsMuted, setOrchidLinkedChordsMuted] = useState(false);
  const [orchidWriteToPianoRoll, setOrchidWriteToPianoRoll] = useState(true);
  /** Collapsible Orchid Studio: chord builder + bass keypad + piano roll (CH33–48). */
  const [orchidStudioOpen, setOrchidStudioOpen] = useState(isOrchidStandalone);
  const [orchidRollExpanded, setOrchidRollExpanded] = useState(false);
  /** Collapse the step-sequencer strip to a slim bar (frees height for Orchid / bass). */
  const [stepSeqCollapsed, setStepSeqCollapsed] = useState(false);
  const orchidRecordSlotRef = useRef(0);
  const pianoRollAnchorRef = useRef<HTMLDivElement | null>(null);
  const [orchidPadOverrides, setOrchidPadOverrides] = useState<Record<number, number[]>>({});

  // ── BASS LINE ── follows the chord progression below the step row.
  // bassStepMutes[i] === true silences bass on chord step i (per-step kill).
  const [bassEnabled, setBassEnabled] = useState(true);
  const [bassVoice, setBassVoice] = useState<BassVoiceId>('sub');
  const [bassPattern, setBassPattern] = useState<BassPatternId>('root');
  const [bassOctaveShift, setBassOctaveShift] = useState(0); // 0 = one octave below chord (default bass register)
  const [bassVolume, setBassVolume] = useState(0.9);
  const [bassFillsLevel, setBassFillsLevel] = useState(0); // 0..1 — adds passing tones / approaches / ghost notes
  // ── REASON-style FEEL controls ──
  // SWING pushes off-beat 16ths later for a triplet-leaning shuffle.
  // NOTE LENGTH scales every hit's sustain (staccato ↔ legato).
  // SLIDE merges adjacent different-pitch hits into pitch-glides (808 / acid feel).
  const [bassSwing, setBassSwing] = useState(0);          // 0..1 — straight to max shuffle
  const [bassNoteLength, setBassNoteLength] = useState(1); // 0.3..2.0 — note-length multiplier
  const [bassSlide, setBassSlide] = useState(0);          // 0..1 — slide probability between close hits
  const [bassStepMutes, setBassStepMutes] = useState<boolean[]>(() => new Array(8).fill(false));

  // ── Piano-Roll-painted custom bass patterns. Keyed by chord-step index.
  // When a step has an entry here, those hits PLAY INSTEAD of the auto-
  // generated pattern for that step. Other steps still play the global pattern.
  const [bassCustomPatterns, setBassCustomPatterns] = useState<Record<number, CustomBassHit[]>>({});
  const [pianoRollStepIdx, setPianoRollStepIdx] = useState<number | null>(null);
  /** When true, bass piano roll uses a near-fullscreen fixed overlay so the grid is readable. */
  const [pianoRollImmersive, setPianoRollImmersive] = useState(false);
  // New-note duration the user clicks-to-add into the piano roll (sub-slots).
  const [pianoRollNoteLength, setPianoRollNoteLength] = useState<number>(1);
  // Clipboard for COPY/PASTE between piano-roll steps.
  const [pianoRollClipboard, setPianoRollClipboard] = useState<CustomBassHit[] | null>(null);
  // Full-bass-line clipboard — snapshot of EVERY step's painted notes.
  // Used by COPY LINE / PASTE LINE so the user can transplant an entire
  // hand-painted bass arrangement instead of doing it step-by-step.
  const [bassLineClipboard, setBassLineClipboard] = useState<Record<number, CustomBassHit[]> | null>(null);
  // When true (default), the piano roll horizontally scrolls to keep the
  // currently-playing step centered during playback. Toggle off if the
  // user wants to scroll around manually while the transport is running.
  const [pianoRollAutoScroll, setPianoRollAutoScroll] = useState<boolean>(true);
  // Visibility flag for the inline "save bass line → slot A/B/C…" picker
  // in the piano-roll toolbar. Hidden by default so the toolbar stays
  // compact; opens when the user clicks SAVE LINE → SLOT.
  const [pianoRollSavePickerOpen, setPianoRollSavePickerOpen] = useState<boolean>(false);
  // ── TOOL MODE ──
  // FL Studio / Studio One / Pro Tools all have a tool palette: PENCIL (paint
  // notes) vs ERASER (click to delete). When notes are tiny — quarter-bar
  // 16ths in particular — right-click can be fingerly imprecise, so the
  // eraser gives a "click anywhere on a note to remove it" mode without
  // having to nail the exact pixel. The mode is sticky: once you flip to
  // ERASE, every click in the roll deletes whatever note is under it until
  // you flip back to PAINT.
  const [pianoRollTool, setPianoRollTool] = useState<'paint' | 'erase'>('paint');
  // ── SELECTED NOTE ──
  // When the user clicks a note WITHOUT dragging it (single tap), we mark
  // it selected. Octave-shift and velocity controls live up in the header
  // panel and operate on whatever's selected. Keeps gestures off the
  // tiny note rectangles — pick the note once, then fine-tune above.
  const [selectedNote, setSelectedNote] = useState<
    | { step: number; slot: number; midiOffset: number }
    | null
  >(null);
  // ── DRAG-TO-MOVE state ──
  // Tracks the note the user is currently dragging in the piano roll. When
  // dragRef is set, mouse-enter on any other cell updates `curSlot/curOffset`
  // so we can render a "phantom" of the dragged note at the new position.
  // On mouse-up we either move (if cursor changed cells) or remove (if it
  // didn't, treating the drag as a click). dragTick forces re-renders since
  // the ref itself can't be a render dep.
  const dragRef = useRef<
    | {
        // Identity of the source note (step it lives in + which slot/pitch).
        originalStep: number;
        originalSlot: number;
        originalOffset: number;
        // Live cursor position — updated by window-level mousemove via
        // elementFromPoint. curStep can DIFFER from originalStep when the
        // user drags across bar/step boundaries in the timeline view.
        curStep: number;
        curSlot: number;
        curOffset: number;
        sustainSlots: number;
        vel: number;
        // moved=false at mouseup means the user CLICKED — that becomes a
        // SELECT in the header sub-toolbar. moved=true commits a move.
        // Octave-shift and velocity changes are done in the header now,
        // not as drag modifiers, so we don't track ALT/SHIFT here.
        moved: boolean;
      }
    | null
  >(null);
  // ── RESIZE-TO-LENGTH state ──
  // Tracks a note being lengthened/shortened by dragging its right edge.
  // We pin the start step+slot + identity of the note and track the cursor's
  // current end-slot. On mouse-up we commit
  // `sustainSlots = endSlot - startSlot + 1` (clamped to fit the step).
  const resizeRef = useRef<
    | {
        step: number;
        startSlot: number;
        midiOffset: number;
        endSlot: number;
        originalEndSlot: number;
      }
    | null
  >(null);
  // ── VELOCITY-DRAG state ──
  // The velocity lane below the pitch grid shows a vertical bar for every
  // custom note, height = vel × laneHeight. Click-drag on a bar adjusts
  // velocity in real time. Pinned by step + slot + midiOffset (note
  // identity) so the update lands on the right note regardless of what
  // other notes are in the same step.
  const velocityDragRef = useRef<
    | {
        step: number;
        slot: number;
        midiOffset: number;
      }
    | null
  >(null);
  const [dragTick, setDragTick] = useState(0);
  const bumpDragTick = useCallback(() => setDragTick((n) => (n + 1) % 1_000_000), []);
  // Ref to the scrollable wrapper around the piano-roll grid. The grid has 25
  // pitch rows × 20 px = 500 px tall, which won't fit on a normal screen, so
  // we cap the wrapper at ~280 px with internal scrolling and auto-scroll to
  // wherever the active notes are when the user opens the editor.
  const pianoRollScrollRef = useRef<HTMLDivElement | null>(null);
  /** Full piano-roll timeline (headers + rows) — width matches the bass grid for mint playline X. */
  const chordSeqBassTimelineWrapRef = useRef<HTMLDivElement | null>(null);
  const chordSeqBassPlaylineRef = useRef<HTMLDivElement | null>(null);
  const chordSeqPlaylineDrumAnimRef = useRef<Animation | null>(null);
  const chordSeqPlaylinePianoAnimRef = useRef<Animation | null>(null);
  const chordSeqPlaylineGlowAnimRef = useRef<Animation | null>(null);
  // Centers the scroll viewport on the median row of whatever notes are
  // currently visible — falls back to the bass-root row if nothing is playing
  // (which shouldn't happen for any pattern but we cover the edge case).
  const centerPianoRollOnNotes = useCallback(() => {
    const scroller = pianoRollScrollRef.current;
    if (!scroller) return;
    const noteCells = Array.from(
      scroller.querySelectorAll<HTMLElement>('[data-has-note="true"]'),
    );
    let targetEl: HTMLElement | null = null;
    if (noteCells.length > 0) {
      // Use the median y so multi-pitch patterns (octaves, walking, etc.) land
      // in the middle of the visible area instead of one extreme.
      const sorted = noteCells.map((el) => el.offsetTop).sort((a, b) => a - b);
      const medianTop = sorted[Math.floor(sorted.length / 2)]!;
      targetEl = noteCells.reduce((best, el) =>
        Math.abs(el.offsetTop - medianTop) < Math.abs(best.offsetTop - medianTop) ? el : best,
      noteCells[0]!);
    } else {
      targetEl = scroller.querySelector<HTMLElement>('[data-row-offset="0"]');
    }
    if (!targetEl) return;
    const viewH = scroller.clientHeight;
    scroller.scrollTop = Math.max(0, targetEl.offsetTop - viewH / 2 + targetEl.offsetHeight / 2);
  }, []);

  // ── 8 PATTERN SLOTS ──────────────────────────────────────────────────
  // bassSlots[X] holds a saved bass "kit" (voice/pattern/feel knobs).
  // activeBassSlot is just a UI hint showing what was last loaded.
  // bassStepSlots[stepIdx] = slot letter that overrides global bass on that step.
  const [bassSlots, setBassSlots] = useState<Record<SlotId, BassSlot | null>>(() => ({ ...EMPTY_SLOTS }));
  const [activeBassSlot, setActiveBassSlot] = useState<SlotId | null>(null);
  const [bassStepSlots, setBassStepSlots] = useState<Record<number, SlotId>>({});

  const [stepCount, setStepCount] = useState<number>(8);
  const [steps, setSteps] = useState<(number | null)[]>(() => new Array(8).fill(null));
  const [playing, setPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [selectedPad, setSelectedPad] = useState<number | null>(null);

  const [sectionChordCount, setSectionChordCount] = useState<number>(4);
  const [customPackChords, setCustomPackChords] = useState<string[]>(['I', 'V', 'vi', 'IV']);
  const [targetCustomSlot, setTargetCustomSlot] = useState(0);
  const [pendingStepPadIdx, setPendingStepPadIdx] = useState<number | null>(null);

  const [showChordOptionPanel, setShowChordOptionPanel] = useState(true);
  const [showHowTo, setShowHowTo] = useState(false);
  const [panelOptionMode, setPanelOptionMode] = useState<PanelOptionMode>('open');
  const [selectedOptionId, setSelectedOptionId] = useState<string>('');
  const [followNextSlot, setFollowNextSlot] = useState(true);
  const [panelCardSlots, setPanelCardSlots] = useState<string[]>(() => Array(9).fill('—'));
  const [panelCardCursor, setPanelCardCursor] = useState(0);
  const [padPage, setPadPage] = useState(0);

  const [songFormId, setSongFormId] = useState(SONG_FORMS[0]!.id);
  const [allowSectionRepeats, setAllowSectionRepeats] = useState(false);
  const [songLane, setSongLane] = useState<SongLaneEntry[]>([]);
  const [activeLaneIndex, setActiveLaneIndex] = useState(0);
  const [autoGenreTempo, setAutoGenreTempo] = useState(true);
  // ── Song Builder collapse ──
  // The Intro/Verse/Pre-Chorus/Chorus/Bridge/Outro card grid takes a big slice
  // of vertical space. When the user is focused on the piano roll, they can
  // hide it entirely to give the bass editor room to breathe. The choice is
  // remembered across reloads so we don't fight the user's preference.
  const [songBuilderCollapsed, setSongBuilderCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem('cs-song-builder-collapsed') === '1';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('cs-song-builder-collapsed', songBuilderCollapsed ? '1' : '0');
    } catch {
      // localStorage write failures (private mode, quota) are non-fatal — the
      // collapse will just default to expanded on the next reload.
    }
  }, [songBuilderCollapsed]);

  const [exportBusy, setExportBusy] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  // ── MIDI EXPORT / MIDI OUT STATE ──────────────────────────────────────
  // List of MIDI output ports discovered via Web MIDI. We refresh this
  // whenever the user plugs/unplugs a device (browser fires `statechange`).
  // `midiOutputId` is the user's currently-selected port (null = "OFF").
  // `midiOutRef` mirrors the chosen port so the playback effect doesn't
  // have to look it up on every step boundary.
  const [midiOutputs, setMidiOutputs] = useState<Array<{ id: string; name: string }>>([]);
  const [midiOutputId, setMidiOutputId] = useState<string | null>(null);
  const midiAccessRef = useRef<MIDIAccess | null>(null);
  const midiOutRef = useRef<MIDIOutput | null>(null);
  const [padPickerOpen, setPadPickerOpen] = useState(false);

  const panelDraggingRef = useRef(false);
  const [dragOverStep, setDragOverStep] = useState<number | null>(null);

  const genreProfile = useMemo(() => getGenre(genreId) ?? initialGenre, [genreId, initialGenre]);

  useEffect(() => {
    setMode(genreProfile.mode);
    if (!autoGenreTempo) return;
    setLocalBpm(getGenreRecommendedBpm(genreProfile.id));
  }, [genreProfile, autoGenreTempo]);

  useEffect(() => {
    setCustomPackChords((prev) => ensureSequenceLength(prev, sectionChordCount));
  }, [sectionChordCount]);

  useEffect(() => {
    const form = SONG_FORMS.find((f) => f.id === songFormId) ?? SONG_FORMS[0]!;
    const sections = allowSectionRepeats ? form.sections : uniqueSectionsInOrder(form.sections);
    setSongLane((prev) =>
      sections.map((section, idx) => {
        const existing = prev[idx];
        if (existing && existing.section === section) return existing;
        return { id: `lane-${idx}-${section}`, section, chords: null, bars: 4 };
      }),
    );
    setActiveLaneIndex((v) => Math.min(v, Math.max(0, sections.length - 1)));
  }, [songFormId, allowSectionRepeats]);

  useEffect(() => {
    setSteps((prev) => {
      if (prev.length === stepCount) return prev;
      const next = new Array(stepCount).fill(null);
      for (let i = 0; i < Math.min(prev.length, stepCount); i++) next[i] = prev[i];
      return next;
    });
  }, [stepCount]);

  // Creation Station / embedded: mirror the host BPM only (same number as Beat Lab).
  // No shared session clock — chord transport stays its own scheduling so it cannot fight 808.
  useEffect(() => {
    if (embedded) {
      if (masterBpm > 0) setLocalBpm(Math.round(masterBpm));
      return;
    }
    if (masterBpm > 0 && !autoGenreTempo) setLocalBpm(masterBpm);
  }, [embedded, masterBpm, autoGenreTempo]);

  const pads = useMemo(() => buildPadsFromGenre(keyRoot, mode, genreProfile, voicingComplexity), [keyRoot, mode, genreProfile, voicingComplexity]);
  const pageCount = Math.max(1, Math.ceil(pads.length / PADS_PER_PAGE));
  const pagedPads = useMemo(() => {
    const page = Math.max(0, Math.min(pageCount - 1, padPage));
    const start = page * PADS_PER_PAGE;
    return pads.slice(start, start + PADS_PER_PAGE);
  }, [pads, padPage, pageCount]);

  useEffect(() => {
    setPadPage((prev) => Math.max(0, Math.min(pageCount - 1, prev)));
  }, [pageCount]);

  const selPad = selectedPad != null ? pads[selectedPad] ?? null : null;

  const diatonicRoots = useMemo(() => getDiatonicRootsInKey(keyRoot, mode, 3), [keyRoot, mode]);

  const orchidBassKeys = useMemo(
    () => getOrchidBassKeypadLayout(keyRoot, mode, 2),
    [keyRoot, mode],
  );

  const orchidBuiltNotes = useMemo(
    () => buildOrchidNotes(orchidRootMidi, orchidType, orchidExtensions, orchidInversion, 3),
    [orchidRootMidi, orchidType, orchidExtensions, orchidInversion],
  );

  const orchidLabel = useMemo(
    () => formatOrchidChordName(orchidRootMidi, orchidType, orchidExtensions),
    [orchidRootMidi, orchidType, orchidExtensions],
  );

  const orchidMaxInversion = Math.max(0, orchidBuiltNotes.length - 1);

  useEffect(() => {
    if (orchidInversion > orchidMaxInversion) setOrchidInversion(orchidMaxInversion);
  }, [orchidInversion, orchidMaxInversion]);

  useEffect(() => {
    const root = selPad?.notes[0];
    if (root != null) setOrchidRootMidi(root);
  }, [selPad?.idx, selPad?.notes[0]]);

  const padBySymbol = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of pads) m.set(p.symbol, p.idx);
    return m;
  }, [pads]);

  const optionChords = useMemo(() => {
    if (!selPad) return [] as OptionChord[];

    // Root pitch class of the selected pad (for variation detection — same root, different quality)
    const selRootPc = selPad.notes[0] != null ? selPad.notes[0] % 12 : -1;

    // Score every candidate pad against the selected one
    const scored = pads
      .filter((p) => p.idx !== selPad.idx)
      .map((p) => ({
        pad: p,
        score: suitability(selPad, p),
        isVariation: selRootPc >= 0 && p.notes[0] != null && p.notes[0] % 12 === selRootPc,
      }));

    // Rank non-variations by score (variations are surfaced separately at the top)
    const nonVariations = scored
      .filter((s) => !s.isVariation)
      .sort((a, b) => b.score - a.score);
    const variations = scored
      .filter((s) => s.isVariation)
      .sort((a, b) => b.score - a.score);

    // STRICT mode = top 32 strongest non-variations + ALL variations of the
    // selected chord. Wide-open so the user can sculpt by ear, not just by
    // the diatonic best-fit.
    // OPEN mode   = every single pad, ranked
    const visible = panelOptionMode === 'strict'
      ? [...variations, ...nonVariations.slice(0, 32)]
      : [...variations, ...nonVariations];

    // Assign visual tiers based on rank position within the visible non-variation list
    // Top 4 = strongest (vibrant), next 6 = great, next 8 = good, rest = ok
    return visible.map((s) => {
      let tier: OptionTier;
      if (s.isVariation) {
        tier = 'great'; // variations always treated as a strong palette option
      } else {
        const rank = nonVariations.indexOf(s);
        if (rank < 4) tier = 'strongest';
        else if (rank < 10) tier = 'great';
        else if (rank < 18) tier = 'good';
        else tier = 'ok';
      }
      return {
        id: `${s.pad.symbol}-${s.pad.idx}-pad`,
        symbol: s.pad.symbol,
        name: s.pad.name,
        notes: s.pad.notes,
        mappedPadIdx: s.pad.idx,
        score: s.score,
        isVariation: s.isVariation,
        tier,
      } as OptionChord;
    });
  }, [selPad, pads, panelOptionMode]);

  useEffect(() => {
    setSelectedOptionId((prev) => {
      if (!optionChords.length) return '';
      return optionChords.some((x) => x.id === prev) ? prev : optionChords[0]!.id;
    });
  }, [optionChords]);

  const selectedOption = useMemo(() => optionChords.find((x) => x.id === selectedOptionId) ?? null, [optionChords, selectedOptionId]);

  // Track which pad is currently sounding during preview playback so the chord
  // pad lights up in real time. -1 means "nothing playing right now."
  const [previewHighlightPadIdx, setPreviewHighlightPadIdx] = useState<number>(-1);
  const previewTimeoutsRef = useRef<number[]>([]);

  const clearPreviewHighlights = useCallback(() => {
    previewTimeoutsRef.current.forEach((t) => window.clearTimeout(t));
    previewTimeoutsRef.current = [];
    setPreviewHighlightPadIdx(-1);
  }, []);

  const shiftedNotes = useCallback(
    (notes: number[]) => notes.map((n) => n + octaveShift * 12),
    [octaveShift],
  );

  const padNotesResolved = useCallback(
    (pad: ChordPad) => orchidPadOverrides[pad.idx] ?? pad.notes,
    [orchidPadOverrides],
  );

  const playChordNotes = useCallback(
    (ctx: AudioContext, notes: number[], start: number, sustain: number) => {
      const shifted = shiftedNotes(notes);
      if (shifted.length === 0) return;
      const fire = () => {
        const when = Math.max(start, ctx.currentTime + 0.008);
        scheduleOrchidChord(ctx, shifted, when, sustain, chordVoice, chordVolume, {
          mode: orchidPerfMode,
          bpm: localBpm,
        });
      };
      if (ctx.state === 'suspended') {
        void ctx.resume().then(fire).catch(() => {});
        return;
      }
      fire();
    },
    [shiftedNotes, chordVoice, chordVolume, orchidPerfMode, localBpm],
  );

  const previewChordSequence = useCallback(
    (symbols: ReadonlyArray<string>, opts?: { bpm?: number }) => {
      const ctx = getCtx();
      const tempo = Math.max(1, opts?.bpm ?? localBpm);
      const secPer = (60 / tempo) * 0.9;
      const now = ctx.currentTime + 0.02;

      // Cancel any in-flight preview before scheduling a new one
      clearPreviewHighlights();

      symbols.forEach((s, i) => {
        const idx = padBySymbol.get(s);
        if (idx == null) return;
        const pad = pads[idx];
        if (!pad) return;
        playChordNotes(ctx, padNotesResolved(pad), now + i * secPer, secPer * 0.82);

        // Light up the pad at the moment its chord starts; clear after the chord's duration
        const startMs = (now - ctx.currentTime + i * secPer) * 1000;
        const onId = window.setTimeout(() => setPreviewHighlightPadIdx(idx), Math.max(0, startMs));
        previewTimeoutsRef.current.push(onId);
      });

      // Schedule a final clear once the whole sequence has finished
      const totalMs = (now - ctx.currentTime + symbols.length * secPer) * 1000;
      const offId = window.setTimeout(() => setPreviewHighlightPadIdx(-1), Math.max(0, totalMs));
      previewTimeoutsRef.current.push(offId);
    },
    [getCtx, localBpm, padBySymbol, pads, clearPreviewHighlights, playChordNotes, padNotesResolved],
  );

  // Clean up any pending highlight timeouts on unmount
  useEffect(() => () => clearPreviewHighlights(), [clearPreviewHighlights]);

  // Auto-flip to the pad page containing the currently-previewing chord so
  // the highlight is always visible to the user during a song preview.
  useEffect(() => {
    if (previewHighlightPadIdx < 0) return;
    const targetPage = Math.floor(previewHighlightPadIdx / PADS_PER_PAGE);
    setPadPage((prev) => (prev === targetPage ? prev : targetPage));
  }, [previewHighlightPadIdx]);

  const playPad = useCallback(
    (pad: ChordPad) => {
      const ctx = getCtx();
      playChordNotes(ctx, padNotesResolved(pad), ctx.currentTime + 0.01, 1.1);
      setSelectedPad(pad.idx);
    },
    [getCtx, playChordNotes, padNotesResolved],
  );

  // Play a chord WITHOUT re-anchoring the options panel. Used when picking
  // chord options while the anchor is locked, so the user keeps the original
  // chord's palette visible while building a progression.
  const auditionPad = useCallback(
    (pad: ChordPad) => {
      const ctx = getCtx();
      playChordNotes(ctx, padNotesResolved(pad), ctx.currentTime + 0.01, 1.1);
    },
    [getCtx, playChordNotes, padNotesResolved],
  );

  const previewOrchidChord = useCallback(() => {
    const ctx = getCtx();
    playChordNotes(ctx, orchidBuiltNotes, ctx.currentTime + 0.01, 1.2);
  }, [getCtx, playChordNotes, orchidBuiltNotes]);

  const pinOrchidToSelectedPad = useCallback(() => {
    if (selectedPad == null) return;
    setOrchidPadOverrides((prev) => ({ ...prev, [selectedPad]: [...orchidBuiltNotes] }));
  }, [selectedPad, orchidBuiltNotes]);

  const [orchidBassMatchLabel, setOrchidBassMatchLabel] = useState('');

  const openOrchidStudio = useCallback(
    (focusStep?: number) => {
      setOrchidStudioOpen(true);
      let stepIdx = focusStep ?? pianoRollStepIdx;
      if (stepIdx == null || steps[stepIdx] == null) {
        const first = steps.findIndex((s) => s != null);
        stepIdx = first >= 0 ? first : 0;
      }
      setPianoRollStepIdx(stepIdx);
    },
    [pianoRollStepIdx, steps],
  );

  const closeOrchidStudio = useCallback(() => {
    if (isOrchidStandalone) return;
    setOrchidStudioOpen(false);
    setOrchidRollExpanded(false);
    setPianoRollImmersive(false);
    setPianoRollStepIdx(null);
  }, [isOrchidStandalone]);

  const toggleOrchidStudio = useCallback(() => {
    if (orchidStudioOpen) closeOrchidStudio();
    else openOrchidStudio();
  }, [orchidStudioOpen, closeOrchidStudio, openOrchidStudio]);

  useEffect(() => {
    if (!isOrchidStandalone || !isScreenActive) return;
    setOrchidStudioOpen(true);
    openOrchidStudio();
  }, [isOrchidStandalone, isScreenActive, openOrchidStudio]);

  const recordOrchidBassToPianoRoll = useCallback(
    (bassMidi: number) => {
      if (!orchidWriteToPianoRoll) return;
      if (!orchidStudioOpen) setOrchidStudioOpen(true);
      let stepIdx = pianoRollStepIdx;
      if (stepIdx == null || steps[stepIdx] == null) {
        stepIdx = steps.findIndex((s) => s != null);
        if (stepIdx < 0) stepIdx = 0;
        setPianoRollStepIdx(stepIdx);
      }
      const padIdx = steps[stepIdx];
      if (padIdx == null) return;
      const pad = pads[padIdx];
      if (!pad) return;
      const bassRoot = computeBassRoot(pad, bassOctaveShift);
      const midiOffset = bassMidi - bassRoot;
      const slot = orchidRecordSlotRef.current % 8;
      orchidRecordSlotRef.current = (slot + 1) % 8;
      const newHit: CustomBassHit = {
        slot,
        midiOffset,
        sustainSlots: clampCustomBassSustain(slot, pianoRollNoteLength),
        vel: 0.88,
      };
      setBassCustomPatterns((prev) => {
        const existing = prev[stepIdx!] ?? [];
        const out = { ...prev };
        out[stepIdx!] = [...existing, newHit];
        return out;
      });
    },
    [orchidWriteToPianoRoll, orchidStudioOpen, pianoRollStepIdx, steps, pads, bassOctaveShift, pianoRollNoteLength],
  );

  const playLinkedOrchidChords = useCallback(
    (ctx: AudioContext, bassMidi: number, when: number, sustain: number) => {
      if (orchidLinkedChordsMuted || orchidLinkedChordVolume <= 0.02) return;
      const type = orchidSmartMatch
        ? diatonicOrchidTypeForRootPc(bassMidi % 12, keyRoot, mode)
        : orchidType;
      const chordNotes = buildOrchidNotesForBassRoot(bassMidi, type, orchidExtensions, orchidInversion);
      scheduleOrchidChord(ctx, chordNotes, when, sustain, chordVoice, orchidLinkedChordVolume, {
        mode: orchidPerfMode,
        bpm: localBpm,
      });
    },
    [
      orchidLinkedChordsMuted,
      orchidLinkedChordVolume,
      orchidSmartMatch,
      keyRoot,
      mode,
      orchidType,
      orchidExtensions,
      orchidInversion,
      chordVoice,
      orchidPerfMode,
      localBpm,
    ],
  );

  const playOrchidBassKey = useCallback(
    (bassMidi: number) => {
      const ctx = getCtx();
      const type = orchidSmartMatch
        ? diatonicOrchidTypeForRootPc(bassMidi % 12, keyRoot, mode)
        : orchidType;
      setOrchidBassMatchLabel(formatOrchidChordName(bassMidi, type, orchidExtensions));
      setOrchidRootMidi(bassMidi);
      recordOrchidBassToPianoRoll(bassMidi);

      const when = ctx.currentTime + 0.008;
      const bassSustain = 0.62;
      const chordSustain = 0.9;
      const bassVel = bassVolume * 0.92;
      const bassFn = BASS_VOICE_FN[bassVoice];

      const fire = () => {
        bassFn(ctx, bassMidi, when, bassSustain, bassVel);
        playLinkedOrchidChords(ctx, bassMidi, when, chordSustain);
      };

      if (ctx.state === 'suspended') {
        void ctx.resume().then(fire).catch(() => {});
        return;
      }
      fire();
    },
    [
      getCtx,
      orchidSmartMatch,
      keyRoot,
      mode,
      orchidType,
      orchidExtensions,
      recordOrchidBassToPianoRoll,
      playLinkedOrchidChords,
      bassVoice,
      bassVolume,
    ],
  );

  const orchidRollStep = pianoRollStepIdx ?? 0;
  const orchidRollPadIdx = steps[orchidRollStep];
  const orchidRollPad = orchidRollPadIdx != null ? pads[orchidRollPadIdx] : null;
  const orchidRollBassRoot = orchidRollPad
    ? computeBassRoot(orchidRollPad, bassOctaveShift)
    : (2 + 1) * 12 + keyRoot;

  const orchidLinkedActive =
    !orchidLinkedChordsMuted && orchidLinkedChordVolume > 0.02;

  const orchidRollChordType = useMemo(() => {
    if (!orchidSmartMatch) return orchidType;
    return diatonicOrchidTypeForRootPc(orchidRollBassRoot % 12, keyRoot, mode);
  }, [orchidSmartMatch, orchidRollBassRoot, keyRoot, mode, orchidType]);

  const orchidRollChordNotes = useMemo(
    () =>
      orchidLinkedActive
        ? buildOrchidNotesForBassRoot(
            orchidRollBassRoot,
            orchidRollChordType,
            orchidExtensions,
            orchidInversion,
          )
        : [],
    [
      orchidLinkedActive,
      orchidRollBassRoot,
      orchidRollChordType,
      orchidExtensions,
      orchidInversion,
    ],
  );

  const orchidRollMatchLabel = useMemo(
    () => formatOrchidChordName(orchidRollBassRoot, orchidRollChordType, orchidExtensions),
    [orchidRollBassRoot, orchidRollChordType, orchidExtensions],
  );

  const previewOrchidRollStep = useCallback(() => {
    const si = pianoRollStepIdx ?? 0;
    const padIdx = steps[si];
    if (padIdx == null) return;
    const pad = pads[padIdx];
    if (!pad) return;
    const ctx = getCtx();
    const t = ctx.currentTime + 0.02;
    const secPerStep = (60 / Math.max(1, localBpm)) * 2;
    const nextStep = (si + 1) % steps.length;
    const nextPad = steps[nextStep] != null ? pads[steps[nextStep]!] ?? null : null;
    const custom = bassCustomPatterns[si];
    scheduleBassStep(
      ctx,
      pad,
      nextPad,
      t,
      secPerStep,
      BASS_PATTERN_MAP[bassPattern],
      bassVoice,
      bassOctaveShift,
      bassVolume,
      {
        stepIdx: si,
        totalSteps: steps.length,
        fillsLevel: bassFillsLevel,
        swing: bassSwing,
        noteLength: bassNoteLength,
        slide: bassSlide,
        customHits: custom?.length ? custom : undefined,
        linkedOrchid:
          custom?.length && !orchidLinkedChordsMuted && orchidLinkedChordVolume > 0.02
            ? {
                volume: orchidLinkedChordVolume,
                muted: false,
                keyRoot,
                mode,
                smartMatch: orchidSmartMatch,
                chordType: orchidType,
                extensions: orchidExtensions,
                inversion: orchidInversion,
                perfMode: orchidPerfMode,
                bpm: localBpm,
                voice: chordVoice,
              }
            : undefined,
      },
    );
  }, [
    pianoRollStepIdx,
    steps,
    pads,
    getCtx,
    localBpm,
    bassCustomPatterns,
    bassPattern,
    bassVoice,
    bassOctaveShift,
    bassVolume,
    bassFillsLevel,
    bassSwing,
    bassNoteLength,
    bassSlide,
    orchidLinkedChordsMuted,
    orchidLinkedChordVolume,
    keyRoot,
    mode,
    orchidSmartMatch,
    orchidType,
    orchidExtensions,
    orchidInversion,
    orchidPerfMode,
    chordVoice,
  ]);

  const setOrchidRollHits = useCallback(
    (stepIdx: number, next: CustomBassHit[]) => {
      setBassCustomPatterns((prev) => {
        const out = { ...prev };
        if (next.length === 0) delete out[stepIdx];
        else out[stepIdx] = next;
        return out;
      });
    },
    [],
  );

  const toggleOrchidExtension = useCallback((ext: OrchidExtension) => {
    setOrchidExtensions((prev) => {
      const next = new Set(prev);
      if (next.has(ext)) next.delete(ext);
      else next.add(ext);
      return next;
    });
  }, []);

  // When true (default), clicking a chord option places + plays it but
  // doesn't change which pad anchors the options panel. Toggle off to get
  // the old behavior where every option click re-anchors the panel.
  const [lockOptionsAnchor, setLockOptionsAnchor] = useState(true);

  const assignPadIdxToStep = useCallback(
    (stepIdx: number, padIdx: number) => {
      setSteps((prev) => prev.map((v, i) => (i === stepIdx ? padIdx : v)));
      setSelectedPad(padIdx);
    },
    [],
  );

  const assignSymbolToStep = useCallback(
    (stepIdx: number, symbol: string) => {
      const idx = padBySymbol.get(symbol);
      if (idx == null) return;
      assignPadIdxToStep(stepIdx, idx);
    },
    [padBySymbol, assignPadIdxToStep],
  );

  const useOption = useCallback(
    (candidate: OptionChord) => {
      const t = Math.max(0, Math.min(sectionChordCount - 1, targetCustomSlot));
      setCustomPackChords((prev) => {
        const next = ensureSequenceLength(prev, sectionChordCount);
        next[t] = candidate.symbol;
        return next;
      });
      setPendingStepPadIdx(candidate.mappedPadIdx);
      const pad = pads[candidate.mappedPadIdx];
      // Lock ON  → play the chord but DON'T change the anchor (options panel
      //            stays based on the originally selected chord)
      // Lock OFF → behave like before: clicking an option re-anchors the panel
      if (pad) {
        if (lockOptionsAnchor) auditionPad(pad);
        else playPad(pad);
      }

      setPanelCardSlots((prev) => {
        const next = [...prev];
        next[panelCardCursor] = candidate.symbol;
        return next;
      });
      setPanelCardCursor((v) => (v + 1) % 9);
      if (followNextSlot) setTargetCustomSlot((t + 1) % Math.max(1, sectionChordCount));
    },
    [sectionChordCount, targetCustomSlot, pads, playPad, auditionPad, lockOptionsAnchor, panelCardCursor, followNextSlot],
  );

  // Explicitly re-anchor the options panel to a specific chord — bypasses
  // the lock. Used by the small "anchor here" button on each option pill.
  const anchorToOption = useCallback(
    (candidate: OptionChord) => {
      setSelectedPad(candidate.mappedPadIdx);
      const pad = pads[candidate.mappedPadIdx];
      if (pad) auditionPad(pad);
    },
    [pads, auditionPad],
  );

  const loadCustomToSteps = useCallback(() => {
    setSteps((prev) => {
      const next = [...prev];
      for (let i = 0; i < next.length; i++) {
        const sym = customPackChords[i % customPackChords.length];
        if (!sym) continue;
        const idx = padBySymbol.get(sym);
        if (idx != null) next[i] = idx;
      }
      return next;
    });
  }, [customPackChords, padBySymbol]);

  // ── SUGGEST — fill the whole step row with a curated genre progression. ──
  // Each click picks a different progression from the active genre's bank,
  // then transforms it according to the active variation level and section
  // flavor so the user can dial in the right feel for whatever they're
  // building (clean Verse, anthem Chorus, modal Bridge, etc.).
  const [suggestionLabel, setSuggestionLabel] = useState<string | null>(null);
  const [variationLevel, setVariationLevel] = useState<VariationLevel>('strict');
  const [sectionFlavor, setSectionFlavor] = useState<SectionFlavor>('free');
  const lastSuggestionIdxRef = useRef(-1);
  const suggestionTimeoutRef = useRef<number | null>(null);

  const suggestStepProgression = useCallback(() => {
    const progs = genreProfile.progressions;
    if (!progs || progs.length === 0) return;

    // Score every progression against the chosen section flavor, keep the top
    // half (or all if there are few), then pick randomly from that pool — that
    // way we stay musically appropriate but never lock to the same choice.
    const scored = progs.map((p) => ({
      prog: p,
      score: scoreForSection(classifyProgression(p.chords), sectionFlavor),
    }));
    scored.sort((a, b) => b.score - a.score);
    const poolSize = Math.max(2, Math.ceil(scored.length * 0.55));
    const pool = scored.slice(0, poolSize);

    let pick = Math.floor(Math.random() * pool.length);
    if (pool.length > 1 && pool[pick]!.prog.id === progs[lastSuggestionIdxRef.current]?.id) {
      pick = (pick + 1) % pool.length;
    }
    const chosen = pool[pick]!.prog;
    lastSuggestionIdxRef.current = progs.indexOf(chosen);

    // Apply the variation transform (color tones + bold substitutions).
    const transformed = applyVariation(chosen.chords, variationLevel, Math.random);

    setSteps(() => {
      const next = new Array<number | null>(stepCount).fill(null);
      for (let i = 0; i < stepCount; i++) {
        const sym = transformed[i % transformed.length];
        if (!sym) continue;
        let idx = padBySymbol.get(sym);
        // If the colorized/substituted symbol isn't a pad in this genre,
        // gracefully fall back to the bare degree (e.g. "I7" → "I").
        if (idx == null) idx = padBySymbol.get(baseDegree(sym));
        if (idx != null) next[i] = idx;
      }
      return next;
    });

    const sectionTag = sectionFlavor === 'free' ? '' : ` · ${SECTION_FLAVORS.find((f) => f.id === sectionFlavor)?.label}`;
    const varTag = variationLevel === 'strict' ? '' : ` · ${variationLevel.toUpperCase()}`;
    setSuggestionLabel(`${chosen.name}${sectionTag}${varTag}`);
    if (suggestionTimeoutRef.current != null) window.clearTimeout(suggestionTimeoutRef.current);
    suggestionTimeoutRef.current = window.setTimeout(() => setSuggestionLabel(null), 3500);
  }, [genreProfile, stepCount, padBySymbol, variationLevel, sectionFlavor]);

  const applyProgressionToSteps = useCallback(
    (chords: ReadonlyArray<string>, label: string, symbolMap: Map<string, number>) => {
      const transformed = applyVariation(chords, variationLevel, Math.random);
      setSteps(() => {
        const next = new Array<number | null>(stepCount).fill(null);
        for (let i = 0; i < stepCount; i++) {
          const sym = transformed[i % transformed.length];
          if (!sym) continue;
          let idx = symbolMap.get(sym);
          if (idx == null) idx = symbolMap.get(baseDegree(sym));
          if (idx != null) next[i] = idx;
        }
        return next;
      });
      const varTag = variationLevel === 'strict' ? '' : ` · ${variationLevel.toUpperCase()}`;
      setSuggestionLabel(`${label}${varTag}`);
      if (suggestionTimeoutRef.current != null) window.clearTimeout(suggestionTimeoutRef.current);
      suggestionTimeoutRef.current = window.setTimeout(() => setSuggestionLabel(null), 4000);
    },
    [stepCount, variationLevel],
  );

  const loadProfessionalProgression = useCallback(
    (entry: ProProgressionEntry) => {
      pendingProLoadRef.current = entry;
      if (entry.genreId !== genreId) setGenreId(entry.genreId);
      else if (entry.mode !== mode) setMode(entry.mode);
      else {
        const genre = getGenre(entry.genreId);
        if (!genre) return;
        const tempPads = buildPadsFromGenre(keyRoot, entry.mode, genre, voicingComplexity);
        const symbolMap = new Map(tempPads.map((p) => [p.symbol, p.idx]));
        applyProgressionToSteps(entry.chords, entry.name, symbolMap);
        pendingProLoadRef.current = null;
      }
    },
    [genreId, mode, keyRoot, voicingComplexity, applyProgressionToSteps],
  );

  useEffect(() => {
    const pending = pendingProLoadRef.current;
    if (!pending) return;
    if (pending.genreId !== genreId || pending.mode !== mode) return;
    const genre = getGenre(pending.genreId);
    if (!genre) {
      pendingProLoadRef.current = null;
      return;
    }
    const symbolMap = new Map(pads.map((p) => [p.symbol, p.idx]));
    applyProgressionToSteps(pending.chords, pending.name, symbolMap);
    pendingProLoadRef.current = null;
  }, [pads, genreId, mode, applyProgressionToSteps]);

  useEffect(() => () => {
    if (suggestionTimeoutRef.current != null) window.clearTimeout(suggestionTimeoutRef.current);
  }, []);

  // ── SAVED PRESETS ── load on mount, write on change. ──────────────────────
  const [savedPresets, setSavedPresets] = useState<SavedChordPreset[]>([]);
  const [presetStatus, setPresetStatus] = useState<string | null>(null);
  const presetStatusTimeoutRef = useRef<number | null>(null);
  const setPresetFlash = useCallback((msg: string) => {
    setPresetStatus(msg);
    if (presetStatusTimeoutRef.current != null) window.clearTimeout(presetStatusTimeoutRef.current);
    presetStatusTimeoutRef.current = window.setTimeout(() => setPresetStatus(null), 2500);
  }, []);

  useEffect(() => {
    setSavedPresets(loadAllPresets());
  }, []);

  useEffect(() => () => {
    if (presetStatusTimeoutRef.current != null) window.clearTimeout(presetStatusTimeoutRef.current);
  }, []);

  const handleSavePreset = useCallback(() => {
    const stepSymbols = steps.map((padIdx) => (padIdx != null ? pads[padIdx]?.symbol ?? null : null));
    const hasAnything = stepSymbols.some((s) => s != null);
    if (!hasAnything) {
      setPresetFlash('Nothing to save — fill some steps first');
      return;
    }
    const defaultName = suggestionLabel?.split(' · ')[0] ?? `${genreProfile.label} · ${KEY_LABELS[keyRoot]} ${mode}`;
    const rawName = window.prompt('Save preset as:', defaultName);
    if (rawName == null) return;
    const name = rawName.trim() || defaultName;

    const preset: SavedChordPreset = {
      id: `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      name,
      createdAt: Date.now(),
      keyRoot,
      mode,
      genreId,
      bpm: localBpm,
      stepCount,
      stepSymbols,
      chordsMuted,
      bassConfig: {
        voice: bassVoice,
        pattern: bassPattern,
        octaveShift: bassOctaveShift,
        volume: bassVolume,
        fillsLevel: bassFillsLevel,
        swing: bassSwing,
        noteLength: bassNoteLength,
        slide: bassSlide,
        customPatterns: bassCustomPatterns,
        slots: bassSlots,
        stepSlots: bassStepSlots,
        stepMutes: bassStepMutes,
        enabled: bassEnabled,
      },
    };
    setSavedPresets((prev) => {
      const next = [preset, ...prev].slice(0, 64);
      writeAllPresets(next);
      return next;
    });
    setPresetFlash(`Saved: ${name}`);
  }, [
    steps, pads, suggestionLabel, genreProfile.label, keyRoot, mode, genreId,
    localBpm, stepCount, bassVoice, bassPattern, bassOctaveShift, bassVolume,
    bassStepMutes, bassEnabled, chordsMuted, bassFillsLevel,
    bassSwing, bassNoteLength, bassSlide, bassCustomPatterns,
    bassSlots, bassStepSlots, setPresetFlash,
  ]);

  const handleLoadPreset = useCallback((id: string) => {
    const preset = savedPresets.find((p) => p.id === id);
    if (!preset) return;

    // Switch the musical context first so the right pads exist when we resolve symbols.
    setKeyRoot(preset.keyRoot);
    setMode(preset.mode);
    setGenreId(preset.genreId);
    setLocalBpm(preset.bpm);
    setStepCount(preset.stepCount);

    setChordsMuted(preset.chordsMuted ?? false);
    if (preset.bassConfig) {
      setBassEnabled(preset.bassConfig.enabled);
      setBassVoice(preset.bassConfig.voice);
      setBassPattern(preset.bassConfig.pattern);
      setBassOctaveShift(preset.bassConfig.octaveShift);
      setBassVolume(preset.bassConfig.volume);
      setBassFillsLevel(preset.bassConfig.fillsLevel ?? 0);
      setBassSwing(preset.bassConfig.swing ?? 0);
      setBassNoteLength(preset.bassConfig.noteLength ?? 1);
      setBassSlide(preset.bassConfig.slide ?? 0);
      setBassCustomPatterns(preset.bassConfig.customPatterns ?? {});
      setBassSlots(preset.bassConfig.slots ?? { ...EMPTY_SLOTS });
      setBassStepSlots(preset.bassConfig.stepSlots ?? {});
      setActiveBassSlot(null);
      setBassStepMutes(preset.bassConfig.stepMutes.length === preset.stepCount
        ? preset.bassConfig.stepMutes
        : new Array<boolean>(preset.stepCount).fill(false));
    }

    // Pad map needs to rebuild after the genre/key/mode switch; defer the
    // symbol-to-pad resolution by one microtask so the new pads list is ready.
    Promise.resolve().then(() => {
      setSteps(() => {
        const next = new Array<number | null>(preset.stepCount).fill(null);
        // Use the LATEST pad list from the ref so we resolve against the
        // freshly-built padBySymbol after the genre swap.
        const latestPads = padsRef.current;
        const symbolMap = new Map<string, number>();
        latestPads.forEach((p, i) => symbolMap.set(p.symbol, i));
        for (let i = 0; i < preset.stepCount; i++) {
          const sym = preset.stepSymbols[i];
          if (!sym) continue;
          let idx = symbolMap.get(sym);
          if (idx == null) idx = symbolMap.get(baseDegree(sym));
          if (idx != null) next[i] = idx;
        }
        return next;
      });
    });

    setPresetFlash(`Loaded: ${preset.name}`);
  }, [savedPresets, setPresetFlash]);

  const handleDeletePreset = useCallback((id: string) => {
    setSavedPresets((prev) => {
      const target = prev.find((p) => p.id === id);
      const next = prev.filter((p) => p.id !== id);
      writeAllPresets(next);
      if (target) setPresetFlash(`Deleted: ${target.name}`);
      return next;
    });
  }, [setPresetFlash]);

  // ── 🎲 RANDOMIZE BASS ── Reason-style. Re-rolls voice, pattern, octave,
  // fills, swing, note length, slide — but does NOT touch the chord steps,
  // BPM, key or genre. Gives an instant fresh feel without breaking the song.
  const handleRandomizeBass = useCallback(() => {
    const pickRand = <T,>(arr: ReadonlyArray<T>): T => arr[Math.floor(Math.random() * arr.length)]!;
    setBassVoice(pickRand(['sub', 'electric', 'pluck'] as BassVoiceId[]));
    // Weight ANCHOR patterns higher so the bass still locks to the root most
    // of the time — pure motion/feel rolls can sound disconnected from the chord.
    const anchorIds = BASS_PATTERNS.filter((p) => p.category === 'anchor').map((p) => p.id);
    const motionIds = BASS_PATTERNS.filter((p) => p.category === 'motion').map((p) => p.id);
    const feelIds = BASS_PATTERNS.filter((p) => p.category === 'feel').map((p) => p.id);
    const roll = Math.random();
    const nextPattern = roll < 0.6 ? pickRand(anchorIds) : roll < 0.85 ? pickRand(motionIds) : pickRand(feelIds);
    setBassPattern(nextPattern);
    setBassOctaveShift(pickRand([-1, 0, 0, 0, 1])); // bias toward 0
    setBassFillsLevel(Math.round(Math.random() * 0.7 * 100) / 100); // 0..0.7
    setBassSwing(Math.random() < 0.5 ? 0 : Math.round(Math.random() * 0.7 * 100) / 100);
    setBassNoteLength(0.5 + Math.random() * 1.3); // 0.5..1.8
    // Slide is most musical on SUB / trap-style patterns — keep it modest by default.
    setBassSlide(Math.random() < 0.35 ? Math.round(Math.random() * 0.6 * 100) / 100 : 0);
    setPresetFlash('🎲 Randomized bass');
  }, [setPresetFlash]);

  /** Stamp the current chord-smart pattern into painted bass on every step — no piano required. */
  const handleMaterializeChordSmartBassLine = useCallback(() => {
    const chordSteps = steps.filter((p) => p != null).length;
    if (chordSteps === 0) {
      setPresetFlash('No chord steps — assign chords first.');
      return;
    }
    if (
      Object.keys(bassCustomPatterns).length > 0
      && !window.confirm(
        'Replace all hand-painted bass notes?\n\n'
        + 'This writes your current pattern (and FILLS) for each chord step into the bass line, '
        + 'using each chord’s roots, 3rds, 5ths, 7ths, and walk approach tones. '
        + 'You don’t need the piano roll — open it only if you want to tweak by hand.',
      )
    ) {
      return;
    }
    const next: Record<number, CustomBassHit[]> = {};
    for (let step = 0; step < stepCount; step++) {
      const padIdx = steps[step];
      if (padIdx == null) continue;
      const pad = pads[padIdx];
      if (!pad) continue;
      const nextStep = (step + 1) % stepCount;
      const nextPadIdx = steps[nextStep];
      const nextPad = nextPadIdx != null ? pads[nextPadIdx] ?? null : null;
      const slotId = bassStepSlots[step];
      const slot = slotId ? bassSlots[slotId] ?? null : null;
      const usePatternId = slot?.pattern ?? bassPattern;
      const useOctave = slot?.octave ?? bassOctaveShift;
      const useFills = slot?.fills ?? bassFillsLevel;
      const pattern = BASS_PATTERN_MAP[usePatternId];
      const hits = buildAutomatedBassHitsForStep({
        pad,
        nextPad,
        stepIdx: step,
        totalSteps: stepCount,
        pattern,
        fillsLevel: useFills,
        rand: Math.random,
      });
      next[step] = bassHitsToCustomPattern(hits, pad, nextPad, useOctave);
    }
    setBassCustomPatterns(next);
    const n = Object.keys(next).length;
    if (n === 0) {
      setPresetFlash('No bass written — assign chords to steps first.');
      return;
    }
    setPresetFlash(
      `Chord-smart bass written to ${n} step(s) — same degrees roots/3/5/7 you hear. Piano roll optional.`,
    );
  }, [
    stepCount,
    steps,
    pads,
    bassStepSlots,
    bassSlots,
    bassPattern,
    bassOctaveShift,
    bassFillsLevel,
    bassCustomPatterns,
    setPresetFlash,
  ]);

  // ── PATTERN SLOT HANDLERS ──
  // Capture the current global bass settings into a single slot snapshot.
  // We also snapshot the painted bass line (bassCustomPatterns) so the slot
  // remembers BOTH the sound design and the hand-drawn notes — recalling a
  // slot restores the whole bass line, not just the voice/pattern.
  const captureCurrentSlot = useCallback((): BassSlot => ({
    voice: bassVoice,
    pattern: bassPattern,
    octave: bassOctaveShift,
    fills: bassFillsLevel,
    swing: bassSwing,
    length: bassNoteLength,
    slide: bassSlide,
    customPatterns: Object.keys(bassCustomPatterns).length > 0
      ? JSON.parse(JSON.stringify(bassCustomPatterns)) as Record<number, CustomBassHit[]>
      : undefined,
  }), [bassVoice, bassPattern, bassOctaveShift, bassFillsLevel, bassSwing, bassNoteLength, bassSlide, bassCustomPatterns]);

  // Load slot → replaces global bass settings. Doesn't touch chord steps,
  // per-step slot assignments, or volume.
  // If the slot was saved WITH a painted bass line, restore that too (clones
  // so future edits don't mutate the saved snapshot). If the slot has no
  // painted line, we leave the user's current painted notes alone.
  const handleLoadSlot = useCallback((id: SlotId) => {
    const slot = bassSlots[id];
    if (!slot) {
      setPresetFlash(`Slot ${id} is empty`);
      return;
    }
    setBassVoice(slot.voice);
    setBassPattern(slot.pattern);
    setBassOctaveShift(slot.octave);
    setBassFillsLevel(slot.fills);
    setBassSwing(slot.swing);
    setBassNoteLength(slot.length);
    setBassSlide(slot.slide);
    if (slot.customPatterns) {
      setBassCustomPatterns(
        JSON.parse(JSON.stringify(slot.customPatterns)) as Record<number, CustomBassHit[]>,
      );
    }
    setActiveBassSlot(id);
    const lineNote = slot.customPatterns
      ? ` (+ ${Object.keys(slot.customPatterns).length}-step bass line)`
      : '';
    setPresetFlash(`Loaded slot ${id}${lineNote}`);
  }, [bassSlots, setPresetFlash]);

  const handleSaveToSlot = useCallback((id: SlotId) => {
    const snap = captureCurrentSlot();
    setBassSlots((prev) => ({ ...prev, [id]: snap }));
    setActiveBassSlot(id);
    const lineNote = snap.customPatterns
      ? ` (+ ${Object.keys(snap.customPatterns).length}-step bass line)`
      : '';
    setPresetFlash(`Saved to slot ${id}${lineNote}`);
  }, [captureCurrentSlot, setPresetFlash]);

  const handleClearSlot = useCallback((id: SlotId) => {
    setBassSlots((prev) => ({ ...prev, [id]: null }));
    // Per-step assignments that point at this slot become orphans — drop them
    // so those steps fall back to the global bass on the next playback pass.
    setBassStepSlots((prev) => {
      const out: Record<number, SlotId> = {};
      for (const [k, v] of Object.entries(prev)) if (v !== id) out[Number(k)] = v;
      return out;
    });
    setActiveBassSlot((prev) => (prev === id ? null : prev));
    setPresetFlash(`Cleared slot ${id}`);
  }, [setPresetFlash]);

  // Cycle a single chord step's slot assignment: none → A → B → … → H → none.
  // Skips empty slots so the user only lands on slots they've actually saved.
  const cycleStepSlot = useCallback((stepIdx: number) => {
    const available: (SlotId | null)[] = [null, ...SLOT_IDS.filter((id) => bassSlots[id] != null)];
    if (available.length === 1) {
      setPresetFlash('No slots saved yet — Shift-click A–H above to save one first');
      return;
    }
    setBassStepSlots((prev) => {
      const cur = prev[stepIdx] ?? null;
      const curIdx = available.indexOf(cur);
      const nextIdx = (curIdx + 1) % available.length;
      const nextSlot = available[nextIdx];
      const out = { ...prev };
      if (nextSlot == null) delete out[stepIdx];
      else out[stepIdx] = nextSlot;
      return out;
    });
  }, [bassSlots, setPresetFlash]);

  // ── Publish the current chord progression to localStorage so the full
  // Bass Station screen can import it via its "Follow Chords" panel. Each
  // chord step = 2 beats (half-note) under our transport math
  // (secPerStep = (60/bpm) * 2), matching what Bass Station expects. ──
  useEffect(() => {
    const blocks = steps
      .map((padIdx) => (padIdx != null ? pads[padIdx]?.symbol ?? null : null))
      .filter((sym): sym is string => sym != null)
      .map((sym) => ({ chord: sym, durationBeats: 2 }));
    if (blocks.length === 0) return;
    writeChordSync({
      keyRoot,
      mode,
      blocks,
      progressionName: suggestionLabel?.split(' · ')[0] ?? `Chord/Bass Seq · ${KEY_LABELS[keyRoot]} ${mode}`,
      bpm: localBpm,
    });
  }, [steps, pads, keyRoot, mode, localBpm, suggestionLabel]);

  const onSendRootsTo808Lab = useCallback(() => {
    const blocks = steps
      .map((padIdx) => (padIdx != null ? pads[padIdx]?.symbol ?? null : null))
      .filter((sym): sym is string => sym != null)
      .map((sym) => ({ chord: sym, durationBeats: 2 }));
    if (blocks.length === 0) {
      setExportStatus('Add chord steps first');
      window.setTimeout(() => setExportStatus(null), 2500);
      return;
    }
    const progressionName =
      suggestionLabel?.split(' · ')[0] ?? `Chord/Bass Seq · ${KEY_LABELS[keyRoot]} ${mode}`;
    const payload = sendRootsTo808Lab({
      source: 'chord-sequencer',
      progressionName,
      keyRoot,
      mode,
      bpm: localBpm,
      blocks,
      hintMode: mode,
    });
    if (!payload) {
      setExportStatus('Could not build roots');
      window.setTimeout(() => setExportStatus(null), 2500);
      return;
    }
    setExportStatus(`✓ ${payload.notes.length} roots → 808 Lab`);
    window.setTimeout(() => setExportStatus(null), 2500);
    onOpen808Lab?.();
    requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent(LAB808_ROOTS_IMPORTED_EVENT));
    });
  }, [steps, pads, keyRoot, mode, localBpm, suggestionLabel, onOpen808Lab]);

  // ── FIND CHORDS — paste/parse any chord progression from online sources ──
  // The user pastes "C Am F G" or "Cmaj7 - Dm7 - G7 - Cmaj7" etc. and we
  // parse + map each chord to a real pad, then preview + offer to load.
  const [findChordsInput, setFindChordsInput] = useState('');
  const [findChordsBpm, setFindChordsBpm] = useState(localBpm);
  const [findChordsSongName, setFindChordsSongName] = useState('');

  // Round a desired chord count up to the nearest value the UI dropdown supports.
  const nearestSectionCount = useCallback((n: number) => {
    for (const v of SECTION_BAR_OPTIONS) if (v >= n) return v;
    return SECTION_BAR_OPTIONS[SECTION_BAR_OPTIONS.length - 1]!;
  }, []);

  // Parse the user's input into an array of { parsed, pad } pairs. The pad
  // is the closest match in the current key/genre pool (or null if no match
  // — which means the chord doesn't fit the active key/mode).
  const parsedFindChords = useMemo(() => {
    const items = parseChordProgression(findChordsInput);
    return items.map((parsed) => ({
      parsed,
      pad: findBestPadFor(parsed, pads),
    }));
  }, [findChordsInput, pads]);

  // Play the parsed progression at the user's chosen BPM. Uses the parsed
  // chord's actual MIDI notes (not the matched pad), so the playback is
  // exactly what the user pasted regardless of the active genre/key.
  const playParsedFindChords = useCallback(() => {
    if (parsedFindChords.length === 0) return;
    const ctx = getCtx();
    const tempo = Math.max(1, findChordsBpm);
    const secPer = (60 / tempo) * 0.9;
    const now = ctx.currentTime + 0.02;
    clearPreviewHighlights();
    parsedFindChords.forEach(({ parsed, pad }, i) => {
      const notes = shiftedNotes(parsed.notes);
      playChordNotes(ctx, notes, now + i * secPer, secPer * 0.82);
      if (pad) {
        const startMs = (i * secPer) * 1000 + 20;
        const onId = window.setTimeout(() => setPreviewHighlightPadIdx(pad.idx), Math.max(0, startMs));
        previewTimeoutsRef.current.push(onId);
      }
    });
    const totalMs = parsedFindChords.length * secPer * 1000 + 20;
    const offId = window.setTimeout(() => setPreviewHighlightPadIdx(-1), Math.max(0, totalMs));
    previewTimeoutsRef.current.push(offId);
  }, [parsedFindChords, getCtx, findChordsBpm, shiftedNotes, clearPreviewHighlights, playChordNotes]);

  // Load the parsed progression into the step sequencer. Each chord goes to
  // one step; if more chords than steps, extras wrap. If a chord didn't map
  // to a pad in the current key, that step is left empty (and the user is
  // shown an unmatched indicator on the card).
  const loadFindChordsToSteps = useCallback(() => {
    if (parsedFindChords.length === 0) return;
    setStepCount((prev) => {
      const desired = nearestSectionCount(parsedFindChords.length);
      // Use whichever supported step count is closest to (and at least) the chord count
      return Math.max(prev, desired);
    });
    setSteps((prev) => {
      const next = new Array(Math.max(prev.length, nearestSectionCount(parsedFindChords.length))).fill(null) as (number | null)[];
      for (let i = 0; i < next.length; i++) {
        const item = parsedFindChords[i % parsedFindChords.length];
        if (item?.pad) next[i] = item.pad.idx;
      }
      return next;
    });
    // Also update the custom pack so the chord-options panel reflects the choice
    const symbols = parsedFindChords.map(({ pad, parsed }) => pad?.symbol ?? parsed.display);
    const fittedCount = nearestSectionCount(symbols.length);
    setCustomPackChords(ensureSequenceLength(symbols, fittedCount));
    setSectionChordCount(fittedCount);
  }, [parsedFindChords, nearestSectionCount]);

  const addCurrentPackToLane = useCallback(() => {
    const entry = songLane[activeLaneIndex];
    if (!entry) return;
    const seq = ensureSequenceLength(customPackChords, sectionChordCount);
    setSongLane((prev) =>
      prev.map((e, i) => {
        if (i !== activeLaneIndex) return e;
        return { ...e, chords: seq };
      }),
    );
  }, [songLane, activeLaneIndex, customPackChords, sectionChordCount]);

  const buildCompleteSong = useCallback(() => {
    const seed = ensureSequenceLength(customPackChords, sectionChordCount);
    let plan;
    try {
      plan = generateSongPlan({ seed, mode });
    } catch {
      return;
    }

    setSongLane((prev) =>
      prev.map((entry) => {
        const found = plan.find((p) => p.name === entry.section);
        if (!found) return entry;
        return { ...entry, chords: [...found.chords] };
      }),
    );

    setSteps((prev) => {
      const next = [...prev];
      const all = plan.flatMap((p) => p.chords);
      for (let i = 0; i < next.length; i++) {
        const sym = all[i % all.length];
        const idx = padBySymbol.get(sym);
        if (idx != null) next[i] = idx;
      }
      return next;
    });
  }, [customPackChords, sectionChordCount, mode, padBySymbol]);

  const playLaneEntry = useCallback(
    (entry: SongLaneEntry) => {
      if (!entry.chords || entry.chords.length === 0) return;
      previewChordSequence(entry.chords);
    },
    [previewChordSequence],
  );

  const setLaneBars = useCallback((idx: number, bars: number) => {
    setSongLane((prev) => prev.map((e, i) => (i === idx ? { ...e, bars } : e)));
  }, []);

  const moveLaneEntry = useCallback((idx: number, dir: -1 | 1) => {
    setSongLane((prev) => {
      const to = idx + dir;
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const tmp = next[idx]!;
      next[idx] = next[to]!;
      next[to] = tmp;
      return next;
    });
    setActiveLaneIndex((v) => Math.max(0, v + dir));
  }, []);

  const clearLane = useCallback(() => {
    setSongLane((prev) => prev.map((x) => ({ ...x, chords: null })));
  }, []);

  const activeLaneEntry = songLane[activeLaneIndex] ?? null;

  const stepsRef = useRef(steps);
  useEffect(() => {
    stepsRef.current = steps;
  }, [steps]);

  const padsRef = useRef(pads);
  useEffect(() => {
    padsRef.current = pads;
  }, [pads]);

  const bpmRef = useRef(localBpm);
  useEffect(() => {
    bpmRef.current = localBpm;
  }, [localBpm]);

  const octaveShiftRef = useRef(octaveShift);
  useEffect(() => {
    octaveShiftRef.current = octaveShift;
  }, [octaveShift]);

  const chordVoiceRef = useRef(chordVoice);
  useEffect(() => { chordVoiceRef.current = chordVoice; }, [chordVoice]);
  const chordVolumeRef = useRef(chordVolume);
  useEffect(() => { chordVolumeRef.current = chordVolume; }, [chordVolume]);
  const orchidPerfModeRef = useRef(orchidPerfMode);
  useEffect(() => { orchidPerfModeRef.current = orchidPerfMode; }, [orchidPerfMode]);
  const orchidPadOverridesRef = useRef(orchidPadOverrides);
  useEffect(() => { orchidPadOverridesRef.current = orchidPadOverrides; }, [orchidPadOverrides]);
  const linkedOrchidRef = useRef<LinkedOrchidBassOpts | undefined>(undefined);
  const orchidExtensionsRef = useRef(orchidExtensions);
  useEffect(() => { orchidExtensionsRef.current = orchidExtensions; }, [orchidExtensions]);
  useEffect(() => {
    if (orchidLinkedChordsMuted || orchidLinkedChordVolume <= 0.02) {
      linkedOrchidRef.current = undefined;
      return;
    }
    linkedOrchidRef.current = {
      volume: orchidLinkedChordVolume,
      muted: false,
      keyRoot,
      mode,
      smartMatch: orchidSmartMatch,
      chordType: orchidType,
      extensions: orchidExtensionsRef.current,
      inversion: orchidInversion,
      perfMode: orchidPerfMode,
      bpm: localBpm,
      voice: chordVoice,
    };
  }, [
    orchidLinkedChordVolume,
    orchidLinkedChordsMuted,
    keyRoot,
    mode,
    orchidSmartMatch,
    orchidType,
    orchidExtensions,
    orchidInversion,
    orchidPerfMode,
    localBpm,
    chordVoice,
  ]);

  useEffect(() => {
    orchidRecordSlotRef.current = 0;
  }, [pianoRollStepIdx]);

  const stepCountRef = useRef(stepCount);
  useEffect(() => {
    stepCountRef.current = stepCount;
  }, [stepCount]);

  // ── Chord-mute ref — keeps worker scheduler in sync without re-binding. ──
  const chordsMutedRef = useRef(chordsMuted);
  useEffect(() => { chordsMutedRef.current = chordsMuted; }, [chordsMuted]);

  // ── Bass refs — mirror bass state so the worker callback always sees latest. ──
  const bassEnabledRef = useRef(bassEnabled);
  useEffect(() => { bassEnabledRef.current = bassEnabled; }, [bassEnabled]);
  const bassVoiceRef = useRef(bassVoice);
  useEffect(() => { bassVoiceRef.current = bassVoice; }, [bassVoice]);
  const bassPatternRef = useRef(bassPattern);
  useEffect(() => { bassPatternRef.current = bassPattern; }, [bassPattern]);
  const bassOctaveShiftRef = useRef(bassOctaveShift);
  useEffect(() => { bassOctaveShiftRef.current = bassOctaveShift; }, [bassOctaveShift]);
  const bassVolumeRef = useRef(bassVolume);
  useEffect(() => { bassVolumeRef.current = bassVolume; }, [bassVolume]);
  const bassFillsLevelRef = useRef(bassFillsLevel);
  useEffect(() => { bassFillsLevelRef.current = bassFillsLevel; }, [bassFillsLevel]);
  const bassSwingRef = useRef(bassSwing);
  useEffect(() => { bassSwingRef.current = bassSwing; }, [bassSwing]);
  const bassNoteLengthRef = useRef(bassNoteLength);
  useEffect(() => { bassNoteLengthRef.current = bassNoteLength; }, [bassNoteLength]);
  const bassSlideRef = useRef(bassSlide);
  useEffect(() => { bassSlideRef.current = bassSlide; }, [bassSlide]);
  const bassStepMutesRef = useRef(bassStepMutes);
  useEffect(() => { bassStepMutesRef.current = bassStepMutes; }, [bassStepMutes]);
  const bassCustomPatternsRef = useRef(bassCustomPatterns);
  useEffect(() => { bassCustomPatternsRef.current = bassCustomPatterns; }, [bassCustomPatterns]);
  const bassSlotsRef = useRef(bassSlots);
  useEffect(() => { bassSlotsRef.current = bassSlots; }, [bassSlots]);
  const bassStepSlotsRef = useRef(bassStepSlots);
  useEffect(() => { bassStepSlotsRef.current = bassStepSlots; }, [bassStepSlots]);

  // Keep bassStepMutes length in sync with stepCount — when the user changes
  // step count we preserve existing mute markers and pad/truncate to match.
  useEffect(() => {
    setBassStepMutes((prev) => {
      if (prev.length === stepCount) return prev;
      const next = new Array<boolean>(stepCount).fill(false);
      for (let i = 0; i < Math.min(prev.length, stepCount); i++) next[i] = prev[i]!;
      return next;
    });
    // Drop any piano-roll-painted hits for steps that no longer exist.
    setBassCustomPatterns((prev) => {
      const out: Record<number, CustomBassHit[]> = {};
      for (const [k, v] of Object.entries(prev)) {
        const idx = Number(k);
        if (idx < stepCount) out[idx] = v;
      }
      return out;
    });
    // Same for per-step slot assignments — trim anything past the new length.
    setBassStepSlots((prev) => {
      const out: Record<number, SlotId> = {};
      for (const [k, v] of Object.entries(prev)) {
        const idx = Number(k);
        if (idx < stepCount) out[idx] = v;
      }
      return out;
    });
    // Close the piano roll if the step it's editing was just trimmed off.
    setPianoRollStepIdx((prev) => (prev != null && prev >= stepCount ? null : prev));
  }, [stepCount]);

  // Clear the selected-note pointer whenever the piano roll closes — the
  // selection only makes sense while the editor is open.
  useEffect(() => {
    if (pianoRollStepIdx == null) setSelectedNote(null);
  }, [pianoRollStepIdx]);

  // Immersive piano roll: lock page scroll and use Esc to dock (not close).
  useEffect(() => {
    if (pianoRollStepIdx == null || !pianoRollImmersive) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [pianoRollStepIdx, pianoRollImmersive]);

  useEffect(() => {
    if (pianoRollStepIdx == null || !pianoRollImmersive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setPianoRollImmersive(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pianoRollStepIdx, pianoRollImmersive]);

  // Auto-scroll the piano-roll grid when the editor opens, in BOTH axes:
  //  · Vertically — center on the median row of whatever notes are visible
  //    so the bass actually shows up (row 13 of 25 is dead-center off-screen
  //    by default).
  //  · Horizontally — scroll the timeline so the FOCUSED step (the one the
  //    user clicked to open the roll) is positioned near the left edge of
  //    the viewport. That way clicking step 5 opens to step 5 instead of
  //    making the user hunt-and-scroll across all the bars.
  useEffect(() => {
    if (pianoRollStepIdx == null) return;
    const id = requestAnimationFrame(() => {
      centerPianoRollOnNotes();
      const scroller = pianoRollScrollRef.current;
      if (!scroller) return;
      // Find any cell that belongs to the focused step and align it ~16px
      // from the left edge of the viewport (just past the label gutter).
      const focusCell = scroller.querySelector<HTMLElement>(
        `[data-step="${pianoRollStepIdx}"][data-slot="0"]`,
      );
      if (!focusCell) return;
      const labelGutterPx = 52;
      const desiredLeft = focusCell.offsetLeft - labelGutterPx - 8;
      scroller.scrollLeft = Math.max(0, desiredLeft);
    });
    return () => cancelAnimationFrame(id);
  }, [pianoRollStepIdx, centerPianoRollOnNotes]);

  // ── AUTO-SCROLL THE PLAYHEAD ────────────────────────────────────────
  // While playback is running AND the piano roll is open AND auto-scroll
  // is enabled, smoothly scroll the timeline so the currently-playing
  // step stays centered in the viewport. Without this, on long bass lines
  // (16/32 steps) the playhead just runs off-screen and the user has to
  // chase it manually.
  // We intentionally use `behavior: 'smooth'` because step changes happen
  // ~1×/beat at 120 BPM — smooth interpolation looks much nicer than a
  // jumpy hard cut every beat. Users who want manual control can toggle
  // auto-scroll off in the piano-roll toolbar.
  useEffect(() => {
    if (pianoRollStepIdx == null) return;
    if (!pianoRollAutoScroll) return;
    if (!playing) return;
    if (currentStep < 0) return;
    const scroller = pianoRollScrollRef.current;
    if (!scroller) return;
    const id = requestAnimationFrame(() => {
      const cell = scroller.querySelector<HTMLElement>(
        `[data-step="${currentStep}"][data-slot="0"]`,
      );
      if (!cell) return;
      const labelGutterPx = 52;
      // Width of one full step = 8 sub-slot cells side-by-side. Reading
      // the next cell's offset isn't reliable across step boundaries, so
      // we just multiply this slot's width by 8.
      const stepWidthPx = cell.offsetWidth * 8;
      const visibleWidth = scroller.clientWidth - labelGutterPx;
      const desiredLeft = cell.offsetLeft - labelGutterPx - (visibleWidth - stepWidthPx) / 2;
      scroller.scrollTo({
        left: Math.max(0, desiredLeft),
        behavior: 'smooth',
      });
    });
    return () => cancelAnimationFrame(id);
  }, [currentStep, pianoRollStepIdx, playing, pianoRollAutoScroll]);

  const workerRef = useRef<Worker | null>(null);
  const runIdRef = useRef(0);
  const rafIdRef = useRef(0);
  const originRef = useRef(0);
  const nextIdxRef = useRef(0);
  /** Last step pushed to React — avoid setState every rAF (was fighting the smooth mint playline). */
  const chordSeqUiStepRef = useRef(-1);

  const launchChordSeqBassPianoPlaylineWapi = useCallback(
    (play: boolean) => {
      const pel = chordSeqBassPlaylineRef.current;
      if (!pel) return;
      const ctx = getCtx();
      const bpm = Math.max(1, bpmRef.current);
      const nSteps = Math.max(1, stepCountRef.current);
      const pc = nSteps * 8;
      /** 8 sub-slots per chord step (2 quarter-note beats); WAPI period = pc/sub = 2×steps quarters. */
      const sub = 4;
      const wrap = chordSeqBassTimelineWrapRef.current;
      const gridEl = wrap?.querySelector<HTMLElement>('[data-chord-seq-timeline-grid]');
      const gridW = gridEl?.offsetWidth ?? 0;
      if (gridW < 2 || pc < 2) return;
      const pcw = gridW / Math.max(1, pc - 1);

      const loopQ = 2 * nSteps;
      let beatNow = 0;
      if (ctx && originRef.current > 0) {
        const elapsed = Math.max(0, ctx.currentTime - originRef.current);
        const q = (elapsed * bpm) / 60;
        beatNow = loopQ > 0 ? ((q % loopQ) + loopQ) % loopQ : 0;
      }

      const leadSec = CHORD_SEQ_PLAYLINE_WAPI_LEAD_SEC + chordSeqPlaylineOutputDacLeadSec(ctx);
      const beatForWapi = play ? beatNow + leadSec * (bpm / 60) : beatNow;

      launchCreationPlaylineWapi(
        {
          drumAnimRef: chordSeqPlaylineDrumAnimRef,
          pianoAnimRef: chordSeqPlaylinePianoAnimRef,
          drumQuantGlowAnimRef: chordSeqPlaylineGlowAnimRef,
        },
        {
          drumEl: null,
          pianoEl: pel,
          drumQuantGlowEl: null,
          beatNow: beatForWapi,
          play,
          bpm,
          subdiv: sub,
          pcols: pc,
          drumColW: 1,
          pianoColW: pcw,
          loopOn: false,
          loopStartBeat: 0,
          loopEndBeat: 0,
          playMode: 'chainAB',
        },
      );
      if (play) pel.style.opacity = '1';
    },
    [getCtx],
  );

  const startPlayback = useCallback(() => {
    const ctx = getCtx();
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    originRef.current = ctx.currentTime + 0.05;
    nextIdxRef.current = 0;
    chordSeqUiStepRef.current = -1;
    const runId = ++runIdRef.current;
    setPlaying(true);

    const worker = new TransportPulseWorker();
    workerRef.current = worker;
    worker.postMessage({ cmd: 'start', intervalMs: SCHED_MS });

    worker.onmessage = () => {
      if (runIdRef.current !== runId) return;
      const ctx2 = getCtx();
      if (ctx2.state === 'suspended') void ctx2.resume().catch(() => {});
      const now = ctx2.currentTime;
      const secPerStep = (60 / Math.max(1, bpmRef.current)) * 2;
      const horizon = now + LOOK_AHEAD_SEC;
      let idx = nextIdxRef.current;
      while (originRef.current + idx * secPerStep < horizon) {
        const step = idx % stepCountRef.current;
        const padIdx = stepsRef.current[step];
        const stepStart = Math.max(now + 0.003, originRef.current + idx * secPerStep);
        if (padIdx != null) {
          const pad = padsRef.current[padIdx];
          if (pad) {
            // CHORDS MUTE solos the bass — skip the chord audio but keep the
            // chord step "live" so bass scheduling and the playhead UI still
            // know what chord is currently playing.
            if (!chordsMutedRef.current) {
              const notes = (orchidPadOverridesRef.current[pad.idx] ?? pad.notes).map(
                (n) => n + octaveShiftRef.current * 12,
              );
              scheduleOrchidChord(
                ctx2,
                notes,
                stepStart,
                secPerStep * 0.88,
                chordVoiceRef.current,
                chordVolumeRef.current,
                { mode: orchidPerfModeRef.current, bpm: bpmRef.current },
              );
            }

            // ── Bass: schedule alongside the chord. Bass derives its notes
            // from the chord's voicing root + selected pattern, and uses the
            // NEXT step's chord for walking-bass approach tones.
            //
            // PER-STEP PATTERN SLOTS: if this step has been assigned to a slot
            // (A-H), the slot's voice/pattern/feel knobs take precedence over
            // the global bass settings — that's how the user gets "verse uses
            // MOTOWN, chorus uses HALF-TIME" without any mid-playback action.
            if (bassEnabledRef.current && !(bassStepMutesRef.current[step] === true)) {
              const nextStep = (step + 1) % stepCountRef.current;
              const nextPadIdx = stepsRef.current[nextStep];
              const nextPad = nextPadIdx != null ? padsRef.current[nextPadIdx] ?? null : null;
              const slotId = bassStepSlotsRef.current[step];
              const slot = slotId ? bassSlotsRef.current[slotId] ?? null : null;
              const useVoice = slot?.voice ?? bassVoiceRef.current;
              const usePatternId = slot?.pattern ?? bassPatternRef.current;
              const useOctave = slot?.octave ?? bassOctaveShiftRef.current;
              const useFills = slot?.fills ?? bassFillsLevelRef.current;
              const useSwing = slot?.swing ?? bassSwingRef.current;
              const useLength = slot?.length ?? bassNoteLengthRef.current;
              const useSlide = slot?.slide ?? bassSlideRef.current;
              const pattern = BASS_PATTERN_MAP[usePatternId];
              scheduleBassStep(
                ctx2,
                pad,
                nextPad,
                stepStart,
                secPerStep,
                pattern,
                useVoice,
                useOctave,
                bassVolumeRef.current,
                {
                  stepIdx: step,
                  totalSteps: stepCountRef.current,
                  fillsLevel: useFills,
                  swing: useSwing,
                  noteLength: useLength,
                  slide: useSlide,
                  customHits: bassCustomPatternsRef.current[step],
                  linkedOrchid: (() => {
                    const custom = bassCustomPatternsRef.current[step];
                    return custom && custom.length > 0 ? linkedOrchidRef.current : undefined;
                  })(),
                },
              );
            }
          }
        }
        idx += 1;
        nextIdxRef.current = idx;
      }
    };

    const tick = () => {
      if (runIdRef.current !== runId) return;
      const ctx2 = getCtx();
      const now = ctx2.currentTime;
      const secPerStep = (60 / Math.max(1, bpmRef.current)) * 2;
      const step = now < originRef.current ? -1 : Math.floor((now - originRef.current) / secPerStep) % stepCountRef.current;
      if (step !== chordSeqUiStepRef.current) {
        chordSeqUiStepRef.current = step;
        setCurrentStep(step);
      }

      rafIdRef.current = requestAnimationFrame(tick);
    };
    rafIdRef.current = requestAnimationFrame(tick);
  }, [getCtx]);

  const stopPlayback = useCallback(() => {
    runIdRef.current += 1;
    cancelAnimationFrame(rafIdRef.current);
    workerRef.current?.postMessage({ cmd: 'stop' });
    workerRef.current?.terminate();
    workerRef.current = null;
    setPlaying(false);
    chordSeqUiStepRef.current = -1;
    setCurrentStep(-1);
    cancelCreationPlaylineWapi(
      {
        drumAnimRef: chordSeqPlaylineDrumAnimRef,
        pianoAnimRef: chordSeqPlaylinePianoAnimRef,
        drumQuantGlowAnimRef: chordSeqPlaylineGlowAnimRef,
      },
      null,
      chordSeqBassPlaylineRef.current,
      null,
    );
    const pl = chordSeqBassPlaylineRef.current;
    if (pl) {
      pl.style.opacity = '0';
      pl.style.transform = 'translate3d(0, 0, 0)';
      pl.style.removeProperty('will-change');
    }
  }, []);

  // Bass piano roll: same compositor playline as 808 Lab / Creation Station (WAPI @ BPM).
  useEffect(() => {
    if (!playing || pianoRollStepIdx == null) return undefined;
    let cancelled = false;
    let r2 = 0;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => {
        if (!cancelled) launchChordSeqBassPianoPlaylineWapi(true);
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(r1);
      if (r2) cancelAnimationFrame(r2);
      cancelCreationPlaylineWapi(
        {
          drumAnimRef: chordSeqPlaylineDrumAnimRef,
          pianoAnimRef: chordSeqPlaylinePianoAnimRef,
          drumQuantGlowAnimRef: chordSeqPlaylineGlowAnimRef,
        },
        null,
        chordSeqBassPlaylineRef.current,
        null,
      );
    };
  }, [playing, pianoRollStepIdx, stepCount, localBpm, launchChordSeqBassPianoPlaylineWapi]);

  useEffect(() => {
    if (!isScreenActive && playing) stopPlayback();
  }, [isScreenActive, playing, stopPlayback]);

  useEffect(() => () => stopPlayback(), [stopPlayback]);

  const handleExport = useCallback(
    async (padIndex: number) => {
      if (!onExportToPad || exportBusy) return;
      setExportBusy(true);
      try {
        const wavBytes = await renderToWav(
          steps,
          pads,
          localBpm,
          chordVoice,
          chordVolume,
          octaveShift,
          orchidPerfMode,
          orchidPadOverrides,
        );
        onExportToPad({
          padIndex,
          wavBytes,
          label: `Chord/Bass Seq · ${KEY_LABELS[keyRoot]} ${mode}`,
          rootBpm: localBpm,
        });
        setExportStatus(`Exported to pad ${padIndex + 1}`);
      } catch {
        setExportStatus('Export failed');
      } finally {
        setExportBusy(false);
        window.setTimeout(() => setExportStatus(null), 2500);
      }
    },
    [
      onExportToPad,
      exportBusy,
      steps,
      pads,
      localBpm,
      keyRoot,
      mode,
      chordVoice,
      chordVolume,
      octaveShift,
      orchidPerfMode,
      orchidPadOverrides,
    ],
  );

  // ── EXPORT WAV FILE (download) ────────────────────────────────────────
  // Renders the full chord progression to a WAV using the same OfflineAudio
  // pipeline as EXPORT PAD, but triggers a browser download instead of
  // baking it into a pad. Filename includes key, mode, BPM, and a YYYYMMDD
  // stamp so the user can stash multiple takes in their Downloads folder.
  const handleExportWavFile = useCallback(async () => {
    if (exportBusy) return;
    if (steps.every((s) => s == null)) {
      setExportStatus('No chords to export');
      window.setTimeout(() => setExportStatus(null), 2500);
      return;
    }
    setExportBusy(true);
    setExportStatus('Rendering WAV…');
    try {
      const wavBytes = await renderToWav(
        steps,
        pads,
        localBpm,
        chordVoice,
        chordVolume,
        octaveShift,
        orchidPerfMode,
        orchidPadOverrides,
      );
      const d = new Date();
      const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
      const filename = safeFilename(
        `ChordBassSeq_${KEY_LABELS[keyRoot]}${mode}_${localBpm}bpm_${stamp}.wav`,
      );
      downloadBytes(wavBytes, filename, 'audio/wav');
      setExportStatus(`Saved ${filename}`);
    } catch {
      setExportStatus('WAV export failed');
    } finally {
      setExportBusy(false);
      window.setTimeout(() => setExportStatus(null), 3200);
    }
  }, [
    exportBusy,
    steps,
    pads,
    localBpm,
    keyRoot,
    mode,
    chordVoice,
    chordVolume,
    octaveShift,
    orchidPerfMode,
    orchidPadOverrides,
  ]);

  // ── EXPORT MIDI FILE (download) ───────────────────────────────────────
  // Builds a Format-0 SMF (chords on channel 0, bass on channel 1) and
  // hands it to the browser as a .mid download. Opens cleanly in Logic,
  // FL Studio, Pro Tools, Studio One, Reaper, Ableton, etc. Bass uses
  // painted notes when present, otherwise falls back to the bass root
  // per step (so you always get a complete two-track file).
  const handleExportMidiFile = useCallback(() => {
    if (exportBusy) return;
    if (steps.every((s) => s == null)) {
      setExportStatus('No chords to export');
      window.setTimeout(() => setExportStatus(null), 2500);
      return;
    }
    try {
      const midiBytes = buildSequencerMidiFile({
        steps,
        pads,
        bpm: localBpm,
        bassEnabled,
        bassOctaveShift,
        bassCustomPatterns,
        trackName: `Chord/Bass Sequencer · ${KEY_LABELS[keyRoot]} ${mode}`,
      });
      const d = new Date();
      const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
      const filename = safeFilename(
        `ChordBassSeq_${KEY_LABELS[keyRoot]}${mode}_${localBpm}bpm_${stamp}.mid`,
      );
      downloadBytes(midiBytes, filename, 'audio/midi');
      setExportStatus(`Saved ${filename}`);
    } catch {
      setExportStatus('MIDI export failed');
    } finally {
      window.setTimeout(() => setExportStatus(null), 3200);
    }
  }, [exportBusy, steps, pads, localBpm, keyRoot, mode, bassEnabled, bassOctaveShift, bassCustomPatterns]);

  // ── WEB MIDI: ENUMERATE OUTPUT PORTS ──────────────────────────────────
  // Asks the browser for MIDI access on mount, then keeps the dropdown
  // list in sync with hot-plug events. We don't auto-pick a port — the
  // user must explicitly choose one so we never spam an unintended
  // device on first load.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
      return;
    }
    let disposed = false;
    let access: MIDIAccess | null = null;
    const refreshOutputs = (a: MIDIAccess) => {
      const outs: Array<{ id: string; name: string }> = [];
      a.outputs.forEach((output, id) => {
        outs.push({ id, name: output.name ?? `Output ${id}` });
      });
      if (!disposed) setMidiOutputs(outs);
    };
    navigator
      .requestMIDIAccess({ sysex: false })
      .then((a) => {
        if (disposed) return;
        access = a;
        midiAccessRef.current = a;
        refreshOutputs(a);
        a.onstatechange = () => refreshOutputs(a);
      })
      .catch(() => {
        // Browser denied access or Web MIDI isn't supported — leave the
        // dropdown empty so the UI shows "no MIDI devices detected".
      });
    return () => {
      disposed = true;
      if (access) {
        access.onstatechange = null;
      }
    };
  }, []);

  // ── KEEP midiOutRef IN SYNC WITH THE PICKER ───────────────────────────
  // Look the selected port back up out of the access object every time
  // either the access object or the user's selection changes. Sending
  // any pending all-notes-off on swap so a previous device doesn't get
  // stuck in a held-note state.
  useEffect(() => {
    const access = midiAccessRef.current;
    const prev = midiOutRef.current;
    if (prev) {
      try {
        for (let ch = 0; ch < 16; ch++) {
          prev.send([0xb0 | ch, 123, 0]); // All Notes Off
        }
      } catch {
        // Output may have been unplugged — ignore.
      }
    }
    if (!access || !midiOutputId) {
      midiOutRef.current = null;
      return;
    }
    midiOutRef.current = access.outputs.get(midiOutputId) ?? null;
  }, [midiOutputId, midiOutputs]);

  // ── LIVE MIDI: SEND NOTE ON/OFF AS STEPS FIRE ─────────────────────────
  // While the transport is running AND a MIDI output is selected, push
  // chord + bass notes out as MIDI. Cleanup releases everything we sent
  // when the step changes or playback stops — so no hanging notes on
  // external gear if the user hits STOP mid-step.
  useEffect(() => {
    if (!playing) return;
    if (currentStep < 0) return;
    const out = midiOutRef.current;
    if (!out) return;
    const padIdx = steps[currentStep];
    if (padIdx == null) return;
    const pad = pads[padIdx];
    if (!pad) return;
    const secPerStep = (60 / Math.max(1, localBpm)) * 2;
    const stepMs = secPerStep * 1000;
    const scheduled: number[] = [];

    // CHORD on channel 0 — held for 95% of the step so re-triggers have
    // a clean release tail (same shape as the audio engine).
    const chordNotes = pad.notes;
    for (const m of chordNotes) {
      try { out.send([0x90, m, 100]); } catch { /* device dropped */ }
    }
    scheduled.push(window.setTimeout(() => {
      for (const m of chordNotes) {
        try { out.send([0x80, m, 0]); } catch { /* device dropped */ }
      }
    }, stepMs * 0.95));

    // BASS on channel 1 — painted hits use their slot/sustain/velocity;
    // unpainted steps just drop the bass root as a long note.
    let bassNotes: number[] = [];
    if (bassEnabled) {
      const bassRoot = pad.notes[0]! - 12 + bassOctaveShift * 12;
      const custom = bassCustomPatterns[currentStep];
      if (custom && custom.length > 0) {
        for (const hit of custom) {
          const note = bassRoot + hit.midiOffset;
          const vel = Math.max(1, Math.min(127, Math.round(hit.vel * 127)));
          const startMs = (hit.slot / 8) * stepMs;
          const dur = (hit.sustainSlots / 8) * stepMs * 0.95;
          bassNotes.push(note);
          scheduled.push(window.setTimeout(() => {
            try { out.send([0x91, note, vel]); } catch { /* device dropped */ }
          }, Math.max(0, startMs)));
          scheduled.push(window.setTimeout(() => {
            try { out.send([0x81, note, 0]); } catch { /* device dropped */ }
          }, Math.max(0, startMs + dur)));
        }
      } else {
        try { out.send([0x91, bassRoot, 100]); } catch { /* device dropped */ }
        bassNotes.push(bassRoot);
        scheduled.push(window.setTimeout(() => {
          try { out.send([0x81, bassRoot, 0]); } catch { /* device dropped */ }
        }, stepMs * 0.95));
      }
    }

    return () => {
      for (const id of scheduled) window.clearTimeout(id);
      for (const m of chordNotes) {
        try { out.send([0x80, m, 0]); } catch { /* device dropped */ }
      }
      for (const m of bassNotes) {
        try { out.send([0x81, m, 0]); } catch { /* device dropped */ }
      }
    };
  }, [currentStep, playing, steps, pads, localBpm, bassEnabled, bassOctaveShift, bassCustomPatterns]);

  // ── FORCE ALL-NOTES-OFF WHEN PLAYBACK STOPS OR THE PORT CHANGES ───────
  // Belt-and-braces guard against stuck notes if the per-step effect's
  // cleanup ever races a port swap. CC 123 (All Notes Off) on every
  // channel is the standard "panic" message.
  useEffect(() => {
    if (playing) return;
    const out = midiOutRef.current;
    if (!out) return;
    try {
      for (let ch = 0; ch < 16; ch++) {
        out.send([0xb0 | ch, 123, 0]);
      }
    } catch {
      // device dropped — nothing to flush.
    }
  }, [playing]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        background: '#030303',
        color: '#cfcfcf',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderBottom: '1px solid #151515', background: '#090909' }}>
        {embedded && onBack && (
          <button onClick={() => { stopPlayback(); onBack(); }} style={{ background: '#111', color: '#999', border: '1px solid #222', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>
            <X size={12} />
          </button>
        )}
        <span style={{ fontSize: 12, fontWeight: 900, letterSpacing: '0.08em', color: '#f0f0f0' }}>
          {isOrchidStandalone ? (
            <>ORCHID <span style={{ color: '#22c55e' }}>STUDIO</span></>
          ) : (
            <>CHORD<span style={{ color: '#67e8f9', margin: '0 3px' }}>/</span>BASS SEQUENCER</>
          )}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 8 }}>
          <button onClick={() => setLocalBpm((v) => Math.max(40, v - 1))} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}><ChevronDown size={14} /></button>
          <span style={{ minWidth: 34, textAlign: 'center', fontWeight: 900, color: '#eee' }}>{localBpm}</span>
          <button onClick={() => setLocalBpm((v) => Math.min(220, v + 1))} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}><ChevronUp size={14} /></button>
        </div>

        <button onClick={() => { setCurrentStep(-1); nextIdxRef.current = 0; }} style={{ marginLeft: 6, background: '#111', color: '#777', border: '1px solid #222', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}><SkipBack size={12} /></button>
        <button
          onClick={playing ? stopPlayback : startPlayback}
          style={{ background: playing ? '#16a34a' : '#171717', color: playing ? '#fff' : '#9a9a9a', border: '1px solid #2c2c2c', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800 }}
        >
          {playing ? <Square size={12} /> : <Play size={12} />}
          {playing ? 'STOP' : 'PLAY'}
        </button>

        {!isOrchidStandalone && (
        <button
          type="button"
          onClick={toggleOrchidStudio}
          title={orchidStudioOpen
            ? 'Close Orchid Studio (chord + bass keypad + piano roll)'
            : 'Open Orchid Studio — build bass & chords here'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 900,
            fontSize: 11,
            letterSpacing: 0.3,
            background: orchidStudioOpen
              ? 'linear-gradient(135deg, #0d2818 0%, #0a1a30 100%)'
              : 'linear-gradient(135deg, #0a1410 0%, #101828 100%)',
            color: orchidStudioOpen ? '#a7f3d0' : '#93c5fd',
            border: `2px solid ${orchidStudioOpen ? '#22c55e' : '#3b82f6'}`,
            boxShadow: orchidStudioOpen ? '0 0 14px rgba(34,197,94,0.35)' : '0 0 10px rgba(59,130,246,0.2)',
          }}
        >
          <Piano size={14} />
          {orchidStudioOpen ? '▲' : '▼'} ORCHID STUDIO
        </button>
        )}

        <button onClick={() => setShowHowTo((v) => !v)} style={{ background: '#101010', color: '#86efac', border: '1px solid #1f3a29', borderRadius: 6, padding: '5px 9px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 800 }}>
          <HelpCircle size={12} /> HOW TO
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* ── MIDI OUT picker ── routes the live sequencer to an external
              MIDI device / virtual MIDI port. "OFF" means everything still
              plays through the in-app synth only. */}
          <span style={{ fontSize: 9, color: '#6b7280', fontWeight: 800, letterSpacing: 0.4 }}>MIDI OUT</span>
          <select
            value={midiOutputId ?? ''}
            onChange={(e) => setMidiOutputId(e.target.value === '' ? null : e.target.value)}
            disabled={midiOutputs.length === 0}
            title={midiOutputs.length === 0
              ? 'No MIDI outputs detected. Connect a MIDI device or virtual MIDI port (e.g. loopMIDI on Windows, IAC Driver on macOS) and refresh.'
              : `Route playback to an external MIDI destination. Chords go to channel 1 (MIDI ch 0) and bass to channel 2 (MIDI ch 1).`}
            style={{
              background: midiOutputId ? '#0a1a14' : '#0a0a0a',
              color: midiOutputId ? '#86efac' : '#6b7280',
              border: `1px solid ${midiOutputId ? '#22c55e66' : '#1a1a1a'}`,
              borderRadius: 6,
              padding: '4px 6px',
              fontSize: 10,
              fontWeight: 800,
              cursor: midiOutputs.length === 0 ? 'not-allowed' : 'pointer',
              maxWidth: 140,
            }}
          >
            <option value="">
              {midiOutputs.length === 0 ? '(no devices)' : 'OFF'}
            </option>
            {midiOutputs.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>

          <div style={{ width: 1, height: 14, background: '#1a1a1a' }} />

          <button
            type="button"
            onClick={onSendRootsTo808Lab}
            disabled={exportBusy}
            title="Send each chord's root note to 808 Lab (painted on the piano roll)"
            style={{ background: '#1a1408', color: '#fde68a', border: '1px solid #4a3c1a', borderRadius: 6, padding: '5px 9px', cursor: exportBusy ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: 11 }}
          >
            ROOTS → 808
          </button>
          <button
            onClick={() => setPadPickerOpen((v) => !v)}
            disabled={!onExportToPad || exportBusy}
            title="Bake the chord progression to WAV and drop it into one of the chord pads as a sample."
            style={{ background: '#111', color: '#22c55e', border: '1px solid #223', borderRadius: 6, padding: '5px 9px', cursor: 'pointer', fontWeight: 800, fontSize: 11 }}
          >
            {exportBusy ? '...' : '▶ EXPORT PAD'}
          </button>
          <button
            onClick={() => void handleExportWavFile()}
            disabled={exportBusy}
            title="Render the chord progression to a WAV audio file and save it to your Downloads folder."
            style={{ background: '#111', color: '#86efac', border: '1px solid #1a3a2a', borderRadius: 6, padding: '5px 9px', cursor: exportBusy ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: 11 }}
          >
            {exportBusy ? '...' : '💾 EXPORT WAV'}
          </button>
          <button
            onClick={handleExportMidiFile}
            disabled={exportBusy}
            title="Export the chord progression + painted bass line as a Standard MIDI File (.mid). Opens in Logic, FL, Ableton, Pro Tools, Studio One, Reaper, etc."
            style={{ background: '#111', color: '#fde68a', border: '1px solid #4a3c1a', borderRadius: 6, padding: '5px 9px', cursor: exportBusy ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: 11 }}
          >
            🎼 EXPORT MIDI
          </button>
          {exportStatus && <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 800 }}>{exportStatus}</span>}
        </div>
      </div>

      {!isOrchidStandalone && orchidStudioOpen && (
        <div
          style={{
            flexShrink: 0,
            maxHeight: 'min(32vh, 300px)',
            borderBottom: '2px solid #22c55e55',
            background: '#040608',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
              padding: '6px 12px',
              borderBottom: '1px solid #1a2438',
              background: 'linear-gradient(90deg, #071208, #070a14)',
            }}
          >
            <Piano size={16} style={{ color: '#a7f3d0' }} />
            <span style={{ fontSize: 11, fontWeight: 900, color: '#ecfdf5' }}>ORCHID STUDIO</span>
            <span style={{ fontSize: 9, color: '#67e8f9', fontWeight: 800 }}>
              CH{CHORD_BASS_SEQ_CHANNEL_BASE}–{CHORD_BASS_SEQ_CHANNEL_BASE + 15}
            </span>
            <button
              type="button"
              onClick={closeOrchidStudio}
              style={{
                marginLeft: 'auto',
                background: '#1a1408',
                color: '#fde68a',
                border: '1px solid #4a3c1a',
                borderRadius: 6,
                padding: '4px 12px',
                fontSize: 10,
                fontWeight: 900,
                cursor: 'pointer',
              }}
            >
              ▲ CLOSE
            </button>
          </div>

          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: orchidRollExpanded ? 'row' : 'column',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                flex: orchidRollExpanded ? '0 0 min(360px, 42%)' : undefined,
                minWidth: orchidRollExpanded ? 280 : undefined,
                overflowY: 'auto',
                overflowX: 'hidden',
                borderRight: orchidRollExpanded ? '1px solid #1a2438' : undefined,
              }}
            >
              <OrchidPerformancePanel
                chordLabel={orchidLabel}
                matchLabel={orchidBassMatchLabel || orchidLabel}
                orchidType={orchidType}
                onTypeChange={setOrchidType}
                extensions={orchidExtensions}
                onToggleExtension={toggleOrchidExtension}
                inversion={orchidInversion}
                maxInversion={orchidMaxInversion}
                onInversionChange={setOrchidInversion}
                perfMode={orchidPerfMode}
                onPerfModeChange={setOrchidPerfMode}
                diatonicRoots={diatonicRoots}
                selectedRootMidi={orchidRootMidi}
                onRootChange={setOrchidRootMidi}
                smartMatch={orchidSmartMatch}
                onSmartMatchChange={setOrchidSmartMatch}
                onPreview={previewOrchidChord}
                onPinToPad={pinOrchidToSelectedPad}
                pinDisabled={selectedPad == null}
                bassKeys={orchidBassKeys}
                linkedChordVolume={orchidLinkedChordVolume}
                onLinkedChordVolumeChange={setOrchidLinkedChordVolume}
                linkedChordsMuted={orchidLinkedChordsMuted}
                onLinkedChordsMutedChange={setOrchidLinkedChordsMuted}
                writeToPianoRoll={orchidWriteToPianoRoll}
                onWriteToPianoRollChange={setOrchidWriteToPianoRoll}
                onBassKeyDown={playOrchidBassKey}
              />
              {!orchidRollExpanded && orchidRollPad && (
                <OrchidStudioPianoRoll
                  stepIndex={orchidRollStep}
                  stepCount={stepCount}
                  bassRootMidi={orchidRollBassRoot}
                  chordLabel={orchidRollPad.name}
                  orchidMatchLabel={orchidRollMatchLabel}
                  hits={bassCustomPatterns[orchidRollStep] ?? []}
                  onHitsChange={(next) => setOrchidRollHits(orchidRollStep, next)}
                  noteLengthSlots={pianoRollNoteLength}
                  onNoteLengthChange={setPianoRollNoteLength}
                  onPreviewStep={previewOrchidRollStep}
                  onStepChange={(n) => openOrchidStudio(n)}
                  onClearStep={() => setOrchidRollHits(orchidRollStep, [])}
                  expanded={false}
                  onExpandedChange={setOrchidRollExpanded}
                  linkedChordsActive={orchidLinkedActive}
                  orchidChordNotes={orchidRollChordNotes}
                  bpm={localBpm}
                  perfMode={orchidPerfMode}
                  sidePanel={false}
                />
              )}
            </div>

            {orchidRollExpanded && (
              <div style={{ flex: 1, minWidth: 260, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                {orchidRollPad ? (
                  <OrchidStudioPianoRoll
                    stepIndex={orchidRollStep}
                    stepCount={stepCount}
                    bassRootMidi={orchidRollBassRoot}
                    chordLabel={orchidRollPad.name}
                    orchidMatchLabel={orchidRollMatchLabel}
                    hits={bassCustomPatterns[orchidRollStep] ?? []}
                    onHitsChange={(next) => setOrchidRollHits(orchidRollStep, next)}
                    noteLengthSlots={pianoRollNoteLength}
                    onNoteLengthChange={setPianoRollNoteLength}
                    onPreviewStep={previewOrchidRollStep}
                    onStepChange={(n) => openOrchidStudio(n)}
                    onClearStep={() => setOrchidRollHits(orchidRollStep, [])}
                    expanded
                    onExpandedChange={setOrchidRollExpanded}
                    linkedChordsActive={orchidLinkedActive}
                    orchidChordNotes={orchidRollChordNotes}
                    bpm={localBpm}
                    perfMode={orchidPerfMode}
                    sidePanel
                  />
                ) : (
                  <div style={{ padding: 12, fontSize: 10, color: '#f87171', fontWeight: 700 }}>
                    Place a chord on step {orchidRollStep + 1} first, then open notes.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
      {showHowTo && (
        <div style={{ flexShrink: 0, borderBottom: '1px solid #151515', background: '#070707', padding: '6px 12px', fontSize: 10, color: '#9ca3af' }}>
          {isOrchidStandalone ? (
            <>Set <strong style={{ color: '#86efac' }}>KEY</strong> · fill <strong style={{ color: '#86efac' }}>STEPS</strong> with chords · build bass on the keypad and piano roll. <br /></>
          ) : (
            <>Pick chords above · fill <strong style={{ color: '#86efac' }}>STEPS</strong> · bass row sits on the piano keys below. <br /></>
          )}
          <span style={{ color: '#86efac', fontWeight: 700 }}>EXPORT:</span>{' '}
          <strong style={{ color: '#22c55e' }}>EXPORT PAD</strong> bakes the sequence into a chord pad,{' '}
          <strong style={{ color: '#86efac' }}>💾 EXPORT WAV</strong> downloads it as audio, and{' '}
          <strong style={{ color: '#fde68a' }}>🎼 EXPORT MIDI</strong> downloads a .mid file with chords on ch 1 and the painted bass line on ch 2.{' '}
          <span style={{ color: '#67e8f9', fontWeight: 700 }}>MIDI OUT:</span>{' '}
          pick a device from the dropdown to route live playback to external gear or a DAW (Windows = loopMIDI, macOS = IAC Driver).
        </div>
      )}

      <div
        style={{
          flex: isOrchidStandalone ? 1 : undefined,
          flexShrink: isOrchidStandalone ? 1 : 0,
          minHeight: isOrchidStandalone ? 0 : undefined,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          borderBottom: isOrchidStandalone ? undefined : '1px solid #111',
        }}
      >
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderBottom: '1px solid #111', background: '#050505', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 9, color: '#4b5563', fontWeight: 800 }}>KEY</span>
        {KEY_LABELS.map((k, i) => (
          <button key={k} onClick={() => setKeyRoot(i)} style={{ background: keyRoot === i ? '#112015' : '#111', color: keyRoot === i ? '#22c55e' : '#7a7a7a', border: `1px solid ${keyRoot === i ? '#1f3a29' : '#1a1a1a'}`, borderRadius: 5, padding: '2px 6px', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>{k}</button>
        ))}

        <div style={{ width: 1, height: 18, background: '#1a1a1a' }} />

        {(['major', 'minor'] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} style={{ background: mode === m ? '#112015' : '#111', color: mode === m ? '#22c55e' : '#7a7a7a', border: `1px solid ${mode === m ? '#1f3a29' : '#1a1a1a'}`, borderRadius: 5, padding: '3px 8px', fontSize: 10, fontWeight: 800, cursor: 'pointer', textTransform: 'capitalize' }}>{m}</button>
        ))}

        <select value={genreId} onChange={(e) => setGenreId(e.target.value)} style={{ background: '#101010', color: '#86efac', border: '1px solid #1f3a29', borderRadius: 5, padding: '3px 7px', fontSize: 10, fontWeight: 700 }}>
          {GENRES.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
        </select>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {(['simple', 'rich', 'pro'] as const).map((v) => (
            <button key={v} onClick={() => setVoicingComplexity(v)} style={{ background: voicingComplexity === v ? '#112015' : '#111', color: voicingComplexity === v ? '#22c55e' : '#7a7a7a', border: `1px solid ${voicingComplexity === v ? '#1f3a29' : '#1a1a1a'}`, borderRadius: 5, padding: '3px 7px', fontSize: 9, fontWeight: 800, cursor: 'pointer', textTransform: 'capitalize' }}>{v}</button>
          ))}
        </div>

        <div style={{ width: 1, height: 18, background: '#1a1a1a' }} />

        <span style={{ fontSize: 9, color: '#4b5563', fontWeight: 800 }}>STEPS</span>
        {STEP_COUNTS.map((n) => (
          <button key={n} onClick={() => setStepCount(n)} style={{ background: stepCount === n ? '#112015' : '#111', color: stepCount === n ? '#22c55e' : '#7a7a7a', border: `1px solid ${stepCount === n ? '#1f3a29' : '#1a1a1a'}`, borderRadius: 5, padding: '3px 7px', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>{n}</button>
        ))}

        <button onClick={() => setAutoGenreTempo((v) => !v)} style={{ marginLeft: 8, background: autoGenreTempo ? '#112015' : '#111', color: autoGenreTempo ? '#22c55e' : '#6b7280', border: `1px solid ${autoGenreTempo ? '#1f3a29' : '#1a1a1a'}`, borderRadius: 5, padding: '3px 8px', fontSize: 9, fontWeight: 800, cursor: 'pointer' }}>
          TEMPO AUTO {autoGenreTempo ? 'ON' : 'OFF'}
        </button>

        <button onClick={loadCustomToSteps} style={{ marginLeft: 'auto', background: '#112015', color: '#22c55e', border: '1px solid #1f3a29', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontWeight: 800, fontSize: 10 }}>LOAD CUSTOM</button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '4px 10px 4px' }}>
      <div style={{ padding: '0 0 4px', borderBottom: '1px solid #111' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
          <span style={{ fontSize: 9, color: '#4b5563', fontWeight: 800 }}>CHORD SOUND</span>
          {CHORD_VOICES.map((v) => {
            const on = chordVoice === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setChordVoice(v.id)}
                title={v.describe}
                style={{
                  background: on ? '#112015' : '#0d0d0d',
                  color: on ? '#86efac' : '#6b7280',
                  border: `1px solid ${on ? '#22c55e66' : '#1a1a1a'}`,
                  borderRadius: 5,
                  padding: '2px 7px',
                  fontSize: 8,
                  fontWeight: 900,
                  cursor: 'pointer',
                  letterSpacing: 0.3,
                }}
              >
                {v.label}
              </button>
            );
          })}
          <span style={{ fontSize: 9, color: '#4b5563', fontWeight: 800, marginLeft: 4 }}>VOL</span>
          <input
            type="range"
            min={0.2}
            max={1}
            step={0.05}
            value={chordVolume}
            onChange={(e) => setChordVolume(Number(e.target.value))}
            title="Chord pad volume"
            style={{ width: 72, accentColor: '#22c55e' }}
          />
          <span style={{ fontSize: 9, color: '#86efac', fontWeight: 800, minWidth: 28 }}>
            {Math.round(chordVolume * 100)}%
          </span>

          <div style={{ width: 1, height: 16, background: '#1a1a1a', marginLeft: 4 }} />

          <button
            type="button"
            onClick={() => setProProgressionsOpen((v) => !v)}
            title="Professional chord progressions from every pop era — complete loops you can edit in the step sequencer"
            style={{
              background: proProgressionsOpen ? '#112015' : '#0d0d0d',
              color: proProgressionsOpen ? '#22c55e' : '#86efac',
              border: `1px solid ${proProgressionsOpen ? '#22c55e66' : '#1f3a29'}`,
              borderRadius: 5,
              padding: '2px 9px',
              fontSize: 9,
              fontWeight: 900,
              cursor: 'pointer',
              letterSpacing: 0.4,
            }}
          >
            <Sparkles size={10} style={{ display: 'inline', verticalAlign: -1, marginRight: 3 }} />
            CHORD PROGRESSIONS
          </button>
        </div>

        {proProgressionsOpen && (
          <ProChordProgressionsPanel
            keyRoot={keyRoot}
            mode={mode}
            onLoad={loadProfessionalProgression}
          />
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 10, color: '#4b5563', fontWeight: 800 }}>CHORD PADS · {genreProfile.label}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={() => setShowChordOptionPanel((v) => !v)} style={{ background: '#111', color: '#86efac', border: '1px solid #1f3a29', borderRadius: 5, padding: '3px 8px', fontSize: 9, fontWeight: 800, cursor: 'pointer' }}>
              {showChordOptionPanel ? 'HIDE PANEL' : 'OPEN PANEL'}
            </button>
            {/* Octave shift controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 9, color: '#4b5563', fontWeight: 800 }}>OCT</span>
              <button onClick={() => setOctaveShift((v) => Math.max(-2, v - 1))} style={{ background: '#111', color: '#86efac', border: '1px solid #1f3a29', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 900, cursor: 'pointer' }}>−</button>
              <span style={{ fontSize: 9, color: octaveShift === 0 ? '#4b5563' : '#22c55e', fontWeight: 900, minWidth: 18, textAlign: 'center' }}>{octaveShift > 0 ? `+${octaveShift}` : octaveShift}</span>
              <button onClick={() => setOctaveShift((v) => Math.min(2, v + 1))} style={{ background: '#111', color: '#86efac', border: '1px solid #1f3a29', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 900, cursor: 'pointer' }}>+</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 9, color: '#4b5563', fontWeight: 800 }}>PAGE</span>
              <button
                onClick={() => setPadPage((v) => Math.max(0, v - 1))}
                style={{ background: '#111', color: '#86efac', border: '1px solid #1f3a29', borderRadius: 4, padding: '1px 6px', fontSize: 9, fontWeight: 800, cursor: 'pointer' }}
              >
                ◀
              </button>
              <span style={{ fontSize: 9, color: '#86efac', fontWeight: 800, minWidth: 24, textAlign: 'center' }}>{padPage + 1}</span>
              <button
                onClick={() => setPadPage((v) => Math.min(pageCount - 1, v + 1))}
                style={{ background: '#111', color: '#86efac', border: '1px solid #1f3a29', borderRadius: 4, padding: '1px 6px', fontSize: 9, fontWeight: 800, cursor: 'pointer' }}
              >
                ▶
              </button>
            </div>
            {/* Single AUTO + C1..C9 control row */}
            <button onClick={() => setFollowNextSlot((v) => !v)} style={{ background: followNextSlot ? '#112015' : '#111', color: followNextSlot ? '#22c55e' : '#6b7280', border: `1px solid ${followNextSlot ? '#1f3a29' : '#1a1a1a'}`, borderRadius: 4, padding: '2px 6px', fontSize: 9, fontWeight: 800, cursor: 'pointer' }}>
              AUTO {followNextSlot ? 'ON' : 'OFF'}
            </button>
            {panelCardSlots.map((_, i) => {
              const active = i === panelCardCursor;
              return (
                <button key={`cslot-${i}`} onClick={() => setPanelCardCursor(i)} style={{ background: active ? '#112015' : '#101010', color: active ? '#22c55e' : '#86efac', border: `1px solid ${active ? '#22c55e55' : '#1f3a29'}`, borderRadius: 4, padding: '1px 4px', fontSize: 8, fontWeight: 800, cursor: 'pointer', minWidth: 32 }}>
                  {`C${i + 1}`}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, minmax(0, 1fr))', gap: 5, maxHeight: 'min(20vh, 160px)', overflowY: 'auto' }}>
          {pagedPads.map((pad) => {
            const selected = pad.idx === selectedPad;
            const previewing = pad.idx === previewHighlightPadIdx;
            const orchidPinned = orchidPadOverrides[pad.idx] != null;
            const score = selPad ? suitability(selPad, pad) : 0;
            return (
              <button
                key={`${pad.symbol}-${pad.idx}`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/chord-pad-idx', String(pad.idx));
                  e.dataTransfer.setData('text/chord-symbol', pad.symbol);
                  e.dataTransfer.effectAllowed = 'copy';
                  setPendingStepPadIdx(pad.idx);
                }}
                onClick={() => playPad(pad)}
                style={{
                  background: previewing
                    ? '#3a2a00'
                    : selected
                    ? '#112015'
                    : score > 0.75
                    ? '#0c2010'
                    : score > 0.5
                    ? '#0f1a12'
                    : score > 0.25
                    ? '#0e1410'
                    : '#0d0d0d',
                  color: previewing ? '#fde047' : selected ? '#22c55e' : score > 0.5 ? '#a3e6b8' : '#d1d5db',
                  border: `1px solid ${previewing ? '#facc15' : selected ? '#22c55e77' : score > 0.5 ? '#1f3a2988' : '#1a1a1a'}`,
                  boxShadow: previewing ? '0 0 12px #facc1577' : 'none',
                  transition: 'background 80ms, box-shadow 80ms, color 80ms',
                  borderRadius: 8,
                  minHeight: 28,
                  padding: '3px 5px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 1,
                }}
                title={orchidPinned ? `${pad.symbol} · Orchid voicing pinned` : pad.symbol}
              >
                <span style={{ fontSize: 11, fontWeight: 900 }}>
                  {pad.name}
                  {orchidPinned ? <span style={{ color: '#67e8f9', marginLeft: 3 }}>◆</span> : null}
                </span>
                <span style={{ fontSize: 8, color: '#6b7280', fontWeight: 700 }}>{pad.symbol}</span>
              </button>
            );
          })}
        </div>
      </div>

      {showChordOptionPanel && (
        <div style={{ borderBottom: '1px solid #111', padding: '4px 12px 6px', background: '#060606' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, color: '#4b5563', fontWeight: 800 }}>
              {selPad
                ? `${lockOptionsAnchor ? 'ANCHORED' : 'OPTIONS'}: ${selPad.name} — ${optionChords.length} match${optionChords.length !== 1 ? 'es' : ''}`
                : 'CHORD OPTIONS — select a pad'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <button
                onClick={() => setLockOptionsAnchor((v) => !v)}
                title={lockOptionsAnchor
                  ? 'Anchor is LOCKED — clicking options keeps this chord\'s palette visible'
                  : 'Anchor is UNLOCKED — clicking an option switches the panel to that chord'}
                style={{
                  background: lockOptionsAnchor ? '#112015' : '#1a0f0f',
                  color: lockOptionsAnchor ? '#22c55e' : '#f87171',
                  border: `1px solid ${lockOptionsAnchor ? '#1f3a29' : '#3a1f1f'}`,
                  borderRadius: 5,
                  padding: '2px 8px',
                  fontSize: 9,
                  fontWeight: 900,
                  cursor: 'pointer',
                  letterSpacing: 0.5,
                }}
              >
                {lockOptionsAnchor ? '🔒 LOCK ON' : '🔓 LOCK OFF'}
              </button>
              <button onClick={() => setPanelOptionMode('strict')} style={{ background: panelOptionMode === 'strict' ? '#112015' : '#111', color: panelOptionMode === 'strict' ? '#22c55e' : '#6b7280', border: `1px solid ${panelOptionMode === 'strict' ? '#1f3a29' : '#1a1a1a'}`, borderRadius: 5, padding: '2px 8px', fontSize: 9, fontWeight: 800, cursor: 'pointer' }}>STRICT</button>
              <button onClick={() => setPanelOptionMode('open')} style={{ background: panelOptionMode === 'open' ? '#112015' : '#111', color: panelOptionMode === 'open' ? '#22c55e' : '#6b7280', border: `1px solid ${panelOptionMode === 'open' ? '#1f3a29' : '#1a1a1a'}`, borderRadius: 5, padding: '2px 8px', fontSize: 9, fontWeight: 800, cursor: 'pointer' }}>OPEN</button>

              <span style={{ fontSize: 9, color: '#4b5563', fontWeight: 800 }}>CHORD SLOT</span>
              {ensureSequenceLength(customPackChords, sectionChordCount).map((_, i) => (
                <button
                  key={`slot-${i}`}
                  onClick={() => setTargetCustomSlot(i)}
                  style={{ background: targetCustomSlot === i ? '#112015' : '#111', color: targetCustomSlot === i ? '#22c55e' : '#6b7280', border: `1px solid ${targetCustomSlot === i ? '#1f3a29' : '#1a1a1a'}`, borderRadius: 5, padding: '2px 6px', fontSize: 9, fontWeight: 800, cursor: 'pointer' }}
                >
                  {`Chord ${i + 1}`}
                </button>
              ))}

              <select value={sectionChordCount} onChange={(e) => setSectionChordCount(Number(e.target.value))} style={{ background: '#101010', color: '#86efac', border: '1px solid #1f3a29', borderRadius: 5, padding: '2px 6px', fontSize: 9 }}>
                {[2, 3, 4, 6, 8, 12, 16].map((n) => <option key={n} value={n}>{n} chords</option>)}
              </select>

              <button onClick={() => previewChordSequence(customPackChords)} style={{ background: '#111', color: '#86efac', border: '1px solid #1f3a29', borderRadius: 5, padding: '2px 7px', fontSize: 9, fontWeight: 800, cursor: 'pointer' }}>PREVIEW</button>
              <button onClick={loadCustomToSteps} style={{ background: '#111', color: '#86efac', border: '1px solid #1f3a29', borderRadius: 5, padding: '2px 7px', fontSize: 9, fontWeight: 800, cursor: 'pointer' }}>USE TO STEPS</button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(16, minmax(0, 1fr))', gap: 2, maxHeight: 150, overflow: 'auto', paddingRight: 2, scrollbarWidth: 'none' }}>
            {optionChords.map((opt) => {
              const selected = selectedOption?.id === opt.id;
              return (
                <button
                  key={opt.id}
                  draggable
                  onDragStart={(e) => {
                    panelDraggingRef.current = true;
                    e.dataTransfer.setData('text/chord-pad-idx', String(opt.mappedPadIdx));
                    e.dataTransfer.setData('text/chord-symbol', opt.symbol);
                    e.dataTransfer.effectAllowed = 'copy';
                    setPendingStepPadIdx(opt.mappedPadIdx);
                  }}
                  onDragEnd={() => {
                    window.setTimeout(() => {
                      panelDraggingRef.current = false;
                    }, 0);
                  }}
                  onClick={() => {
                    if (panelDraggingRef.current) return;
                    setSelectedOptionId(opt.id);
                    useOption(opt);
                  }}
                  onContextMenu={(e) => {
                    // Right-click any option pill to anchor the panel to that
                    // chord (works even when LOCK is ON).
                    e.preventDefault();
                    anchorToOption(opt);
                  }}
                  onAuxClick={(e) => {
                    // Middle-click also re-anchors for users without right-click
                    if (e.button === 1) {
                      e.preventDefault();
                      anchorToOption(opt);
                    }
                  }}
                  style={{
                    borderRadius: 999,
                    border: `1px solid ${
                      selected
                        ? '#22c55eaa'
                        : opt.isVariation
                        ? '#3b82f677'
                        : opt.tier === 'strongest'
                        ? '#22c55e88'
                        : opt.tier === 'great'
                        ? '#22c55e55'
                        : opt.tier === 'good'
                        ? '#22c55e2a'
                        : '#1a1a1a'
                    }`,
                    background: selected
                      ? '#15321e'
                      : opt.isVariation
                      ? '#0e1828'
                      : opt.tier === 'strongest'
                      ? '#0d2614'
                      : opt.tier === 'great'
                      ? '#0c1d10'
                      : opt.tier === 'good'
                      ? '#0d130e'
                      : '#0f0f0f',
                    color: selected
                      ? '#4ade80'
                      : opt.isVariation
                      ? '#93c5fd'
                      : opt.tier === 'strongest'
                      ? '#4ade80'
                      : opt.tier === 'great'
                      ? '#86efac'
                      : opt.tier === 'good'
                      ? '#a3e6b8'
                      : '#9ca3af',
                    padding: '3px 10px',
                    fontSize: 10,
                    fontWeight: 900,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    textAlign: 'center',
                  }}
                  title={`${opt.name} · ${opt.isVariation ? 'variation (same root)' : `${opt.tier} fit · ${Math.round(opt.score * 100)}%`}\n(click = use this chord · right-click = re-anchor panel here)`}
                >
                  {opt.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ borderBottom: '1px solid #111', padding: songBuilderCollapsed ? '3px 12px' : '5px 12px', background: '#050505' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: songBuilderCollapsed ? 0 : 6 }}>
          <button
            onClick={() => setSongBuilderCollapsed((v) => !v)}
            title={songBuilderCollapsed
              ? 'Expand Song Builder (FIND CHORDS, paste, etc.)'
              : 'Collapse Song Builder for more step-sequencer room'}
            style={{
              background: songBuilderCollapsed ? '#0a1410' : '#101010',
              color: songBuilderCollapsed ? '#22c55e' : '#86efac',
              border: `1px solid ${songBuilderCollapsed ? '#1f3a29' : '#262626'}`,
              borderRadius: 5,
              padding: '2px 7px',
              fontSize: 10,
              fontWeight: 900,
              cursor: 'pointer',
              minWidth: 18,
              lineHeight: 1,
            }}
          >
            {songBuilderCollapsed ? '▸' : '▾'}
          </button>
          <span style={{ fontSize: 10, color: '#4b5563', fontWeight: 800 }}>SONG BUILDER</span>
          {songBuilderCollapsed && songLane.length > 0 && (
            <>
              <span style={{ fontSize: 9, color: '#4b5563', fontWeight: 800 }}>SECTION</span>
              <select
                value={activeLaneIndex}
                onChange={(e) => setActiveLaneIndex(Number(e.target.value))}
                title="Intro, Verse, Pre-Chorus, Chorus, etc."
                style={{
                  background: '#101010',
                  color: '#86efac',
                  border: '1px solid #1f3a29',
                  borderRadius: 5,
                  padding: '2px 6px',
                  fontSize: 10,
                  fontWeight: 700,
                  maxWidth: 168,
                  cursor: 'pointer',
                }}
              >
                {songLane.map((entry, idx) => (
                  <option key={entry.id} value={idx}>
                    {idx + 1}. {entry.section}{entry.chords ? ' ✓' : ''} · {entry.bars}b
                  </option>
                ))}
              </select>
              <span style={{ fontSize: 9, color: '#6b7280', fontWeight: 700 }}>
                · {songLane.filter((e) => e.chords).length}/{songLane.length} filled
              </span>
            </>
          )}
          <select value={songFormId} onChange={(e) => setSongFormId(e.target.value)} style={{ background: '#101010', color: '#86efac', border: '1px solid #1f3a29', borderRadius: 5, padding: '2px 6px', fontSize: 10, display: songBuilderCollapsed ? 'none' : undefined }}>
            {SONG_FORMS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
          {!songBuilderCollapsed && (
            <>
              <button onClick={() => setAllowSectionRepeats((v) => !v)} style={{ background: allowSectionRepeats ? '#112015' : '#111', color: allowSectionRepeats ? '#22c55e' : '#6b7280', border: `1px solid ${allowSectionRepeats ? '#1f3a29' : '#1a1a1a'}`, borderRadius: 5, padding: '2px 8px', fontSize: 9, fontWeight: 800, cursor: 'pointer' }}>REPEATS {allowSectionRepeats ? 'ON' : 'OFF'}</button>

              <span style={{ fontSize: 9, color: '#4b5563', fontWeight: 800 }}>SECTION</span>
              <select
                value={songLane.length > 0 ? activeLaneIndex : ''}
                onChange={(e) => setActiveLaneIndex(Number(e.target.value))}
                disabled={songLane.length === 0}
                title="Pick Intro, Verse, Pre-Chorus, Chorus, etc."
                style={{
                  background: '#101010',
                  color: '#86efac',
                  border: '1px solid #1f3a29',
                  borderRadius: 5,
                  padding: '2px 6px',
                  fontSize: 10,
                  fontWeight: 700,
                  maxWidth: 168,
                  cursor: songLane.length === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                {songLane.length === 0 ? (
                  <option value="">(no sections)</option>
                ) : (
                  songLane.map((entry, idx) => (
                    <option key={entry.id} value={idx}>
                      {idx + 1}. {entry.section}{entry.chords ? ' ✓' : ''} · {entry.bars}b
                    </option>
                  ))
                )}
              </select>
              {activeLaneEntry && (
                <>
                  <select
                    value={activeLaneEntry.bars}
                    onChange={(e) => setLaneBars(activeLaneIndex, Number(e.target.value))}
                    title="Bars in this section"
                    style={{ background: '#101010', color: '#86efac', border: '1px solid #1f3a29', borderRadius: 5, padding: '2px 4px', fontSize: 9, width: 44 }}
                  >
                    {SECTION_BAR_OPTIONS.map((n) => <option key={n} value={n}>{n}b</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => playLaneEntry(activeLaneEntry)}
                    disabled={!activeLaneEntry.chords?.length}
                    title="Preview this section"
                    style={{
                      background: '#112015',
                      color: activeLaneEntry.chords?.length ? '#86efac' : '#4b5563',
                      border: '1px solid #1f3a29',
                      borderRadius: 5,
                      padding: '2px 7px',
                      fontSize: 9,
                      fontWeight: 900,
                      cursor: activeLaneEntry.chords?.length ? 'pointer' : 'not-allowed',
                    }}
                  >
                    ▶
                  </button>
                  <button
                    type="button"
                    onClick={() => moveLaneEntry(activeLaneIndex, -1)}
                    disabled={activeLaneIndex === 0}
                    title="Move section earlier"
                    style={{
                      background: activeLaneIndex === 0 ? '#0a0a0a' : '#101820',
                      color: activeLaneIndex === 0 ? '#333' : '#93c5fd',
                      border: `1px solid ${activeLaneIndex === 0 ? '#1a1a1a' : '#1e3a5f'}`,
                      borderRadius: 5,
                      padding: '2px 6px',
                      fontSize: 9,
                      fontWeight: 900,
                      cursor: activeLaneIndex === 0 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    ◀
                  </button>
                  <button
                    type="button"
                    onClick={() => moveLaneEntry(activeLaneIndex, 1)}
                    disabled={activeLaneIndex >= songLane.length - 1}
                    title="Move section later"
                    style={{
                      background: activeLaneIndex >= songLane.length - 1 ? '#0a0a0a' : '#101820',
                      color: activeLaneIndex >= songLane.length - 1 ? '#333' : '#93c5fd',
                      border: `1px solid ${activeLaneIndex >= songLane.length - 1 ? '#1a1a1a' : '#1e3a5f'}`,
                      borderRadius: 5,
                      padding: '2px 6px',
                      fontSize: 9,
                      fontWeight: 900,
                      cursor: activeLaneIndex >= songLane.length - 1 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    ▶
                  </button>
                </>
              )}

              <button onClick={addCurrentPackToLane} style={{ background: '#112015', color: '#22c55e', border: '1px solid #1f3a29', borderRadius: 5, padding: '2px 8px', fontSize: 9, fontWeight: 800, cursor: 'pointer' }}>ADD TO ACTIVE</button>
              <button onClick={buildCompleteSong} style={{ background: '#112015', color: '#22c55e', border: '1px solid #1f3a29', borderRadius: 5, padding: '2px 8px', fontSize: 9, fontWeight: 800, cursor: 'pointer' }}><Sparkles size={11} /> COMPLETE SONG</button>
              <button onClick={clearLane} style={{ background: '#111', color: '#6b7280', border: '1px solid #1a1a1a', borderRadius: 5, padding: '2px 8px', fontSize: 9, fontWeight: 800, cursor: 'pointer' }}>CLEAR LANE</button>
            </>
          )}
        </div>

        {/* ── FIND CHORDS — paste any chord progression and play / load it.
            Grab chords from any online source (Ultimate Guitar, Chordify,
            Songsterr, lyrics pages, etc.) and drop them right in. Each
            parsed chord is matched to the closest pad in the current key.
            Hidden when the Song Builder is collapsed to give the piano roll
            more room. ── */}
        {!songBuilderCollapsed && (
        <div style={{ marginBottom: 6, borderTop: '1px solid #111', paddingTop: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 9, color: '#86efac', fontWeight: 800, letterSpacing: 0.5 }}>
              FIND CHORDS
            </span>
            <span style={{ fontSize: 8, color: '#4b5563', fontWeight: 700 }}>
              type a song name → hit a chord-site button → copy chords back here
            </span>
          </div>

          {/* Quick-link row — opens chord-chart sites in a new tab with the song
              name pre-filled. The user grabs the chord progression there, then
              comes back and pastes it into the chord input below. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 9, color: '#4b5563', fontWeight: 800 }}>FIND ONLINE:</span>
            {([
              { label: 'GOOGLE',          color: '#fbbf24', url: (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q + ' chords')}` },
              { label: 'ULTIMATE GUITAR', color: '#fb923c', url: (q: string) => `https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(q)}` },
              { label: 'CHORDIFY',        color: '#34d399', url: (q: string) => `https://chordify.net/search/${encodeURIComponent(q)}` },
              { label: 'SONGSTERR',       color: '#60a5fa', url: (q: string) => `https://www.songsterr.com/?pattern=${encodeURIComponent(q)}` },
              { label: 'HOOKTHEORY',      color: '#a78bfa', url: (q: string) => `https://www.hooktheory.com/theorytab/difficulties?q=${encodeURIComponent(q)}` },
              { label: 'AZCHORDS',        color: '#f472b6', url: (q: string) => `https://www.azchords.com/search.php?search=${encodeURIComponent(q)}&where=all` },
            ] as const).map((site) => {
              const q = findChordsSongName.trim();
              const disabled = q.length === 0;
              return (
                <button
                  key={site.label}
                  onClick={() => {
                    if (disabled) return;
                    window.open(site.url(q), '_blank', 'noopener,noreferrer');
                  }}
                  disabled={disabled}
                  title={disabled ? 'Type a song name first' : `Open ${site.label} search for "${q}" in a new tab`}
                  style={{
                    background: disabled ? '#0a0a0a' : '#111',
                    color: disabled ? '#333' : site.color,
                    border: `1px solid ${disabled ? '#1a1a1a' : '#262626'}`,
                    borderRadius: 5,
                    padding: '2px 7px',
                    fontSize: 9,
                    fontWeight: 900,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    letterSpacing: 0.3,
                  }}
                >
                  {site.label}
                </button>
              );
            })}
            <span style={{ fontSize: 8, color: '#4b5563', fontStyle: 'italic' }}>
              free, open in new tab — grab the chords, paste below
            </span>
          </div>

          <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4 }}>
            <input
              type="text"
              value={findChordsSongName}
              onChange={(e) => setFindChordsSongName(e.target.value)}
              placeholder="Song name (e.g. let it be)"
              style={{ flex: '0 0 180px', background: '#0a0a0a', color: '#e5e7eb', border: '1px solid #1a1a1a', borderRadius: 5, padding: '4px 8px', fontSize: 10, fontWeight: 700 }}
            />
            <input
              type="text"
              value={findChordsInput}
              onChange={(e) => setFindChordsInput(e.target.value)}
              placeholder="Paste chord names: C Am F G7 / Cmaj7 - Dm7 - G7 - Cmaj7"
              style={{ flex: 1, background: '#0a0a0a', color: '#e5e7eb', border: '1px solid #1a1a1a', borderRadius: 5, padding: '4px 8px', fontSize: 11, fontWeight: 700, fontFamily: 'monospace' }}
            />
            <span style={{ fontSize: 9, color: '#4b5563', fontWeight: 800 }}>BPM</span>
            <input
              type="number"
              min={40}
              max={240}
              value={findChordsBpm}
              onChange={(e) => setFindChordsBpm(Math.max(40, Math.min(240, Number(e.target.value) || 100)))}
              style={{ width: 56, background: '#0a0a0a', color: '#86efac', border: '1px solid #1a1a1a', borderRadius: 5, padding: '4px 6px', fontSize: 10, fontWeight: 800, textAlign: 'center' }}
            />
            <button
              onClick={playParsedFindChords}
              disabled={parsedFindChords.length === 0}
              style={{
                background: parsedFindChords.length > 0 ? '#112015' : '#0a0a0a',
                color: parsedFindChords.length > 0 ? '#22c55e' : '#3a3a3a',
                border: `1px solid ${parsedFindChords.length > 0 ? '#1f3a29' : '#1a1a1a'}`,
                borderRadius: 5, padding: '4px 10px', fontSize: 10, fontWeight: 900,
                cursor: parsedFindChords.length > 0 ? 'pointer' : 'not-allowed',
              }}
            >
              ▶ PREVIEW
            </button>
            <button
              onClick={loadFindChordsToSteps}
              disabled={parsedFindChords.length === 0}
              style={{
                background: parsedFindChords.length > 0 ? '#112015' : '#0a0a0a',
                color: parsedFindChords.length > 0 ? '#22c55e' : '#3a3a3a',
                border: `1px solid ${parsedFindChords.length > 0 ? '#1f3a29' : '#1a1a1a'}`,
                borderRadius: 5, padding: '4px 10px', fontSize: 10, fontWeight: 900,
                cursor: parsedFindChords.length > 0 ? 'pointer' : 'not-allowed',
              }}
            >
              USE TO STEPS
            </button>
            <button
              onClick={() => { setFindChordsInput(''); setFindChordsSongName(''); }}
              style={{ background: '#111', color: '#6b7280', border: '1px solid #1a1a1a', borderRadius: 5, padding: '4px 8px', fontSize: 9, fontWeight: 800, cursor: 'pointer' }}
            >
              CLEAR
            </button>
          </div>

          {/* Parsed chord cards — one per chord token, draggable to step sequencer */}
          {parsedFindChords.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', marginTop: 4 }}>
              {findChordsSongName.trim() && (
                <span style={{ fontSize: 9, color: '#86efac', fontWeight: 900, padding: '2px 6px', borderLeft: '2px solid #22c55e55' }}>
                  {findChordsSongName.trim()}
                </span>
              )}
              {parsedFindChords.map((item, i) => {
                const matched = item.pad != null;
                return (
                  <button
                    key={`fc-${i}`}
                    draggable={matched}
                    onDragStart={(e) => {
                      if (!item.pad) return;
                      e.dataTransfer.setData('text/chord-pad-idx', String(item.pad.idx));
                      e.dataTransfer.setData('text/chord-symbol', item.pad.symbol);
                      e.dataTransfer.effectAllowed = 'copy';
                      setPendingStepPadIdx(item.pad.idx);
                    }}
                    onClick={() => {
                      if (item.pad) {
                        setSelectedPad(item.pad.idx);
                        auditionPad(item.pad);
                      } else {
                        // No matching pad — play the parsed notes directly
                        const ctx = getCtx();
                        playChordNotes(ctx, item.parsed.notes, ctx.currentTime + 0.01, 1.1);
                      }
                    }}
                    title={
                      matched
                        ? `${item.parsed.display} → ${item.pad!.name}\nclick to play · drag to step`
                        : `${item.parsed.display} — no diatonic match in ${KEY_LABELS[keyRoot]} ${mode}\n(plays raw, drag won't work — pick a closer key/mode)`
                    }
                    style={{
                      background: matched ? '#0d1f12' : '#1f0d0d',
                      border: `1px solid ${matched ? '#1f3a2988' : '#3a1f1f88'}`,
                      borderRadius: 999,
                      padding: '3px 10px',
                      fontSize: 10,
                      fontWeight: 900,
                      color: matched ? '#86efac' : '#f87171',
                      cursor: matched ? 'pointer' : 'default',
                    }}
                  >
                    <span>{item.parsed.display}</span>
                    {matched ? null : <span style={{ marginLeft: 4, fontSize: 8 }}>⚠</span>}
                  </button>
                );
              })}
              <span style={{ fontSize: 9, color: '#4b5563', fontWeight: 700, marginLeft: 4 }}>
                {parsedFindChords.length} chord{parsedFindChords.length === 1 ? '' : 's'} parsed
                {parsedFindChords.some(({ pad }) => !pad)
                  ? ` · ${parsedFindChords.filter(({ pad }) => !pad).length} unmatched (try different key/mode)`
                  : ''}
              </span>
            </div>
          )}
        </div>
        )}

        {!songBuilderCollapsed && activeLaneEntry && (
          <div
            style={{
              fontSize: 9,
              color: activeLaneEntry.chords ? '#86efac' : '#6b7280',
              fontWeight: 700,
              marginBottom: 4,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.2,
            }}
            title={activeLaneEntry.chords ? activeLaneEntry.chords.join(' · ') : 'Empty — use ADD TO ACTIVE or COMPLETE SONG'}
          >
            <span style={{ color: '#4b5563', fontWeight: 800 }}>ACTIVE · </span>
            {activeLaneEntry.section}
            {activeLaneEntry.chords ? `: ${activeLaneEntry.chords.join(' · ')}` : ' — empty'}
          </div>
        )}
      </div>
      </div>
      </div>

      <div
        style={{
          flexShrink: 0,
          flexGrow: 0,
          padding: stepSeqCollapsed ? '2px 10px 3px' : '3px 10px 4px',
          borderTop: '1px solid #1a2e22',
          background: '#050505',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: stepSeqCollapsed ? 0 : 2, flexWrap: 'wrap', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setStepSeqCollapsed((v) => !v)}
              title={stepSeqCollapsed ? 'Expand step sequencer strip' : 'Collapse strip — frees space for Orchid Studio'}
              style={{
                background: stepSeqCollapsed ? '#0a1410' : '#101010',
                color: stepSeqCollapsed ? '#22c55e' : '#86efac',
                border: `1px solid ${stepSeqCollapsed ? '#1f3a29' : '#262626'}`,
                borderRadius: 4,
                padding: '1px 6px',
                fontSize: 10,
                fontWeight: 900,
                cursor: 'pointer',
                lineHeight: 1.2,
              }}
            >
              {stepSeqCollapsed ? '▸' : '▾'}
            </button>
            <span style={{ fontSize: 9, color: '#86efac', fontWeight: 900, letterSpacing: 0.3 }}>STEPS · {stepCount}</span>
            {suggestionLabel && (
              <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 800 }}>
                Loaded: {suggestionLabel}
              </span>
            )}
            {pendingStepPadIdx != null && (
              <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 800 }}>
                Armed: {pads[pendingStepPadIdx]?.name ?? '—'} — click any step
              </span>
            )}
          </div>
          {!stepSeqCollapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {/* SECTION picker — biases SUGGEST toward progressions that fit
                the energy of a Verse, Chorus, Bridge, etc. "Free" = no bias. */}
            <span style={{ fontSize: 9, color: '#4b5563', fontWeight: 800 }}>SECTION</span>
            <select
              value={sectionFlavor}
              onChange={(e) => setSectionFlavor(e.target.value as SectionFlavor)}
              title="Bias SUGGEST toward progressions that match a section's energy"
              style={{ background: '#101010', color: '#86efac', border: '1px solid #1f3a29', borderRadius: 5, padding: '2px 6px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}
            >
              {SECTION_FLAVORS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>

            {/* VARIATION level — colors and substitutes inside SUGGEST output */}
            <span style={{ fontSize: 9, color: '#4b5563', fontWeight: 800, marginLeft: 4 }}>SPICE</span>
            {VARIATION_LEVELS.map((v) => (
              <button
                key={v.id}
                onClick={() => setVariationLevel(v.id)}
                title={v.desc}
                style={{
                  background: variationLevel === v.id ? '#112015' : '#111',
                  color: variationLevel === v.id ? '#22c55e' : '#7a7a7a',
                  border: `1px solid ${variationLevel === v.id ? '#1f3a29' : '#1a1a1a'}`,
                  borderRadius: 5, padding: '2px 7px', fontSize: 9, fontWeight: 800, cursor: 'pointer',
                }}
              >
                {v.label}
              </button>
            ))}

            <button
              onClick={suggestStepProgression}
              title={`Pick a fresh progression from the ${genreProfile.label} pack and fill every step. Click again for a different one.`}
              style={{ background: '#112015', color: '#22c55e', border: '1px solid #1f3a29', borderRadius: 5, padding: '3px 12px', fontSize: 10, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <Sparkles size={11} /> SUGGEST
            </button>

            <div style={{ width: 1, height: 14, background: '#1a1a1a' }} />

            <button
              onClick={handleSavePreset}
              title="Save the current step row, key/mode/genre, BPM and bass settings as a named preset"
              style={{ background: '#101822', color: '#60a5fa', border: '1px solid #1e3a5f', borderRadius: 5, padding: '3px 10px', fontSize: 9, fontWeight: 900, cursor: 'pointer' }}
            >
              + SAVE
            </button>

            <button
              onClick={() => setSteps(new Array(stepCount).fill(null))}
              style={{ background: '#111', color: '#ef4444', border: '1px solid #3a1414', borderRadius: 5, padding: '3px 9px', fontSize: 9, fontWeight: 800, cursor: 'pointer' }}
            >
              CLEAR
            </button>
          </div>
          )}
        </div>

        {!stepSeqCollapsed && (savedPresets.length > 0 || presetStatus) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              marginBottom: 6,
              padding: '4px 6px',
              borderRadius: 6,
              background: '#070a10',
              border: '1px solid #11171f',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: 9, color: '#60a5fa', fontWeight: 800, letterSpacing: 0.5 }}>PRESETS</span>
            {presetStatus && (
              <span style={{ fontSize: 9, color: '#86efac', fontWeight: 800 }}>{presetStatus}</span>
            )}
            {savedPresets.map((preset) => (
              <span
                key={preset.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  background: '#0d1320',
                  border: '1px solid #1e3a5f',
                  borderRadius: 999,
                  padding: '1px 3px 1px 9px',
                  fontSize: 10,
                  fontWeight: 800,
                  color: '#93c5fd',
                }}
              >
                <button
                  onClick={() => handleLoadPreset(preset.id)}
                  title={`Load "${preset.name}" — ${KEY_LABELS[preset.keyRoot]} ${preset.mode} · ${preset.bpm} BPM · ${preset.stepCount} steps`}
                  style={{ background: 'none', border: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer', padding: 0 }}
                >
                  {preset.name}
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`Delete preset "${preset.name}"?`)) handleDeletePreset(preset.id);
                  }}
                  title="Delete this preset"
                  style={{
                    background: '#1a0a0a',
                    border: '1px solid #3a1414',
                    color: '#f87171',
                    borderRadius: 999,
                    width: 16,
                    height: 16,
                    fontSize: 10,
                    fontWeight: 900,
                    lineHeight: 1,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {!stepSeqCollapsed && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(stepCount, 16)}, minmax(0, 1fr))`, gap: 2, alignItems: 'start', opacity: chordsMuted ? 0.45 : 1, transition: 'opacity 120ms' }}>
          {steps.map((padIdx, si) => {
            const pad = padIdx != null ? pads[padIdx] : null;
            const active = currentStep === si;
            const dragOver = dragOverStep === si;
            return (
              <div key={`step-${si}`}>
                <div style={{ textAlign: 'center', fontSize: 8, color: active ? '#22c55e' : '#4b5563', marginBottom: 0, fontWeight: 700, lineHeight: 1 }}>{si + 1}</div>
                <button
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverStep(si);
                  }}
                  onDragLeave={() => setDragOverStep((v) => (v === si ? null : v))}
                  onDrop={(e) => {
                    e.preventDefault();
                    const padIdxRaw = e.dataTransfer.getData('text/chord-pad-idx');
                    const dropPadIdx = Number(padIdxRaw);
                    if (Number.isFinite(dropPadIdx) && dropPadIdx >= 0) {
                      assignPadIdxToStep(si, dropPadIdx);
                    } else {
                      const symbol = e.dataTransfer.getData('text/chord-symbol');
                      if (symbol) assignSymbolToStep(si, symbol);
                    }
                    setPendingStepPadIdx(null);
                    setDragOverStep(null);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setSteps((prev) => {
                      const next = [...prev];
                      next[si] = null;
                      return next;
                    });
                  }}
                  onClick={() => {
                    if (pendingStepPadIdx != null) {
                      assignPadIdxToStep(si, pendingStepPadIdx);
                      setPendingStepPadIdx(null);
                      return;
                    }
                    if (pad) playPad(pad);
                  }}
                  style={{
                    width: '100%',
                    minHeight: stepCount <= 8 ? 26 : stepCount <= 16 ? 24 : 22,
                    maxHeight: stepCount <= 8 ? 26 : stepCount <= 16 ? 24 : 22,
                    borderRadius: 5,
                    border: `1px solid ${active ? '#22c55e55' : dragOver ? '#22c55e33' : '#1a1a1a'}`,
                    background: active ? '#102014' : dragOver ? '#0f1a12' : '#0d0d0d',
                    color: pad ? '#d1d5db' : '#555',
                    padding: '2px 3px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 0,
                    lineHeight: 1.05,
                  }}
                >
                  {pad ? (
                    <>
                      <span style={{ fontSize: stepCount <= 8 ? 11 : 10, fontWeight: 900, lineHeight: 1.05 }}>{pad.name}</span>
                      {stepCount <= 12 && (
                        <span style={{ fontSize: 7, color: '#6b7280', fontWeight: 700, lineHeight: 1 }}>{pad.symbol}</span>
                      )}
                    </>
                  ) : (
                    <span style={{ fontSize: 14, color: '#303030', lineHeight: 1 }}>+</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
        )}
      </div>

      <div
        style={{
          flexShrink: 0,
          minHeight: 0,
          maxHeight: pianoRollStepIdx != null && !orchidStudioOpen
            ? (pianoRollImmersive ? 'min(72vh, 640px)' : 'min(42vh, 380px)')
            : undefined,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderTop: '1px solid #1a1a1a',
          background: '#070608',
        }}
      >
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          flex: pianoRollStepIdx != null && !orchidStudioOpen ? 1 : undefined,
          overflow: pianoRollStepIdx != null && !orchidStudioOpen ? 'hidden' : undefined,
        }}
      >

      {/* ── BASS LINE ─────────────────────────────────────────────────────
          A dedicated bass-line lane that AUTO-FOLLOWS the chord progression
          one step at a time. Each chord step gets its own bass cell showing
          the derived bass note (root of the chord, dropped to bass register
          and offset by the octave shift) and the chosen rhythmic pattern
          as 8 micro-dots. Right-click any cell to mute that step's bass.
          Audio scheduling for bass happens inside the same transport worker
          callback so it stays perfectly locked to the chord clock. */}
      <div style={{ padding: '3px 10px 4px' }}>
        {/* Header strip — voice / pattern / octave / volume / preview / sync */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4, flexWrap: 'wrap' }}>
          <span
            style={{ fontSize: 10, color: '#c4b5fd', fontWeight: 900, letterSpacing: 0.6 }}
            title="Patterns = chord-smart grooves (roots, 3rds, 5ths, walk to next chord). You only need the piano roll to hand-draw. Use AUTO-WRITE TO STEPS to paint the line without opening it."
          >
            BASS LINE
          </span>
          <button
            onClick={() => setBassEnabled((v) => !v)}
            title={bassEnabled ? 'Bass is playing along with chords. Click to mute the whole bass line.' : 'Bass is muted. Click to enable.'}
            style={{
              background: bassEnabled ? '#1a1130' : '#111',
              color: bassEnabled ? '#c4b5fd' : '#6b7280',
              border: `1px solid ${bassEnabled ? '#3b2a66' : '#1a1a1a'}`,
              borderRadius: 5, padding: '2px 8px', fontSize: 9, fontWeight: 900, cursor: 'pointer',
            }}
          >
            BASS {bassEnabled ? 'ON' : 'OFF'}
          </button>

          {/* MUTE CHORDS — one-click solo for the bass. Chord pads dim while
              muted, the playhead and step indices keep running, and the bass
              line keeps following the (muted) chord progression underneath. */}
          <button
            onClick={() => setChordsMuted((v) => !v)}
            title={chordsMuted
              ? 'Chords are muted — only the bass is playing. Click to bring chords back in.'
              : 'Mute the chord pads so you can solo the bass line. Bass keeps following the (silent) chord progression.'}
            style={{
              background: chordsMuted ? '#2a1411' : '#111',
              color: chordsMuted ? '#fb923c' : '#7a7a7a',
              border: `1px solid ${chordsMuted ? '#7c2d12' : '#1a1a1a'}`,
              borderRadius: 5, padding: '2px 8px', fontSize: 9, fontWeight: 900, cursor: 'pointer',
            }}
          >
            CHORDS {chordsMuted ? 'MUTED' : 'ON'}
          </button>

          <div style={{ width: 1, height: 14, background: '#1a1a1a' }} />

          {/* VOICE */}
          <span style={{ fontSize: 9, color: '#4b5563', fontWeight: 800 }}>VOICE</span>
          {(['sub', 'electric', 'pluck'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setBassVoice(v)}
              title={v === 'sub' ? 'Deep round sub-bass — trap, R&B, hip-hop' : v === 'electric' ? 'Finger-style electric/upright — soul, funk, rock' : 'Short percussive pluck — pop, dance, disco'}
              style={{
                background: bassVoice === v ? '#1a1130' : '#111',
                color: bassVoice === v ? '#c4b5fd' : '#7a7a7a',
                border: `1px solid ${bassVoice === v ? '#3b2a66' : '#1a1a1a'}`,
                borderRadius: 5, padding: '2px 7px', fontSize: 9, fontWeight: 800, cursor: 'pointer', textTransform: 'uppercase',
              }}
            >
              {v === 'sub' ? 'SUB' : v === 'electric' ? 'ELEC' : 'PLUCK'}
            </button>
          ))}

          <div style={{ width: 1, height: 14, background: '#1a1a1a' }} />

          {/* PATTERN — grouped by category. ANCHOR = song-carrying root-locked
              grooves (R&B, trap, pop foundation). MOTION = melodic walking
              bass lines. FEEL = rhythmic flavors. Each category gets a tinted
              label so the user knows what they're picking from at a glance. */}
          {(['anchor', 'motion', 'feel'] as const).map((cat) => {
            const patternsInCat = BASS_PATTERNS.filter((p) => p.category === cat);
            if (patternsInCat.length === 0) return null;
            const catColor =
              cat === 'anchor' ? '#fbbf24' :
              cat === 'motion' ? '#a78bfa' :
              '#94a3b8';
            const catLabel =
              cat === 'anchor' ? 'ANCHOR' :
              cat === 'motion' ? 'MOTION' :
              'FEEL';
            const catTitle =
              cat === 'anchor' ? 'ANCHOR — root-locked grooves that carry the song. Mute the chords, the bass still tells the story. Cross-genre (R&B, trap, pop, hip-hop, Latin).' :
              cat === 'motion' ? 'MOTION — bass lines that walk and move between chord tones. Counter-melody as well as foundation.' :
              'FEEL — rhythmic flavors layered over the chord. Accent variations.';
            return (
              <Fragment key={cat}>
                <span
                  style={{
                    fontSize: 9,
                    color: catColor,
                    fontWeight: 900,
                    letterSpacing: 0.5,
                    paddingLeft: cat === 'anchor' ? 0 : 4,
                    borderLeft: cat === 'anchor' ? 'none' : '1px solid #1a1a1a',
                    paddingRight: 2,
                  }}
                  title={catTitle}
                >
                  {catLabel}
                </span>
                {patternsInCat.map((p) => {
                  const selected = bassPattern === p.id;
                  const accent = catColor;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setBassPattern(p.id)}
                      title={`${p.label} — ${p.describe}`}
                      style={{
                        background: selected ? `${accent}1f` : '#111',
                        color: selected ? accent : '#7a7a7a',
                        border: `1px solid ${selected ? `${accent}66` : '#1a1a1a'}`,
                        borderRadius: 5,
                        padding: '2px 7px',
                        fontSize: 9,
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </Fragment>
            );
          })}

          <div style={{ width: 1, height: 14, background: '#1a1a1a' }} />

          {/* OCTAVE */}
          <span style={{ fontSize: 9, color: '#4b5563', fontWeight: 800 }}>OCT</span>
          <button
            onClick={() => setBassOctaveShift((v) => Math.max(-2, v - 1))}
            disabled={bassOctaveShift <= -2}
            style={{ background: '#111', color: bassOctaveShift <= -2 ? '#333' : '#c4b5fd', border: '1px solid #1a1a1a', borderRadius: 5, padding: '2px 7px', fontSize: 9, fontWeight: 900, cursor: bassOctaveShift <= -2 ? 'not-allowed' : 'pointer' }}
          >
            −
          </button>
          <span style={{ fontSize: 10, fontWeight: 900, color: '#c4b5fd', minWidth: 22, textAlign: 'center' }}>{bassOctaveShift > 0 ? `+${bassOctaveShift}` : bassOctaveShift}</span>
          <button
            onClick={() => setBassOctaveShift((v) => Math.min(1, v + 1))}
            disabled={bassOctaveShift >= 1}
            style={{ background: '#111', color: bassOctaveShift >= 1 ? '#333' : '#c4b5fd', border: '1px solid #1a1a1a', borderRadius: 5, padding: '2px 7px', fontSize: 9, fontWeight: 900, cursor: bassOctaveShift >= 1 ? 'not-allowed' : 'pointer' }}
          >
            +
          </button>

          <div style={{ width: 1, height: 14, background: '#1a1a1a' }} />

          {/* FILLS — probabilistic groove additions (passing tones, ghost notes,
              chromatic approaches). 0% = pattern stays strict, 100% = bass
              moves around the chord like a real player improvising. */}
          <span
            style={{ fontSize: 9, color: '#4b5563', fontWeight: 800 }}
            title="FILLS — at 0% the bass plays the pattern strictly. Crank it up and the bass starts adding passing tones, ghost notes, octave jumps, and chromatic approaches like a real player would. Each step gets fresh randomization."
          >
            FILLS
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={bassFillsLevel}
            onChange={(e) => setBassFillsLevel(Number(e.target.value))}
            title="Higher = more groove additions (passing tones, ghosts, approaches)"
            style={{ width: 60, accentColor: '#f472b6' }}
          />
          <span style={{ fontSize: 9, color: bassFillsLevel > 0 ? '#f472b6' : '#4b5563', fontWeight: 800, minWidth: 26, textAlign: 'right' }}>{Math.round(bassFillsLevel * 100)}%</span>

          <div style={{ width: 1, height: 14, background: '#1a1a1a' }} />

          {/* SWING — pushes off-beat 16th notes later for a triplet-leaning
              shuffle. 0% = straight 16ths, 100% = full shuffle (~67% triplet feel).
              The same control Reason's Bassline Generator calls "Shuffle". */}
          <span
            style={{ fontSize: 9, color: '#4b5563', fontWeight: 800 }}
            title="SWING — pushes the off-beats later for a shuffled / triplet-leaning feel. 0% is straight 16ths, 100% is heavy shuffle. Try 25–50% on funk and motown patterns, 60–80% on hip-hop."
          >
            SWING
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={bassSwing}
            onChange={(e) => setBassSwing(Number(e.target.value))}
            title="Higher = more shuffle on the off-beats"
            style={{ width: 60, accentColor: '#fbbf24' }}
          />
          <span style={{ fontSize: 9, color: bassSwing > 0 ? '#fbbf24' : '#4b5563', fontWeight: 800, minWidth: 26, textAlign: 'right' }}>{Math.round(bassSwing * 100)}%</span>

          <div style={{ width: 1, height: 14, background: '#1a1a1a' }} />

          {/* NOTE LENGTH — global sustain multiplier. <1 = staccato, >1 = legato.
              Reason calls this "Gate Length" on the Bassline Generator. */}
          <span
            style={{ fontSize: 9, color: '#4b5563', fontWeight: 800 }}
            title="NOTE LENGTH — scales how long every bass note rings out. Pull it down for tight staccato funk/disco, push it up for smooth held bass (R&B, lo-fi, doom)."
          >
            LEN
          </span>
          <input
            type="range"
            min={0.3}
            max={2}
            step={0.05}
            value={bassNoteLength}
            onChange={(e) => setBassNoteLength(Number(e.target.value))}
            title="Note-length multiplier. 0.3 = very short, 1.0 = normal, 2.0 = held"
            style={{ width: 60, accentColor: '#34d399' }}
          />
          <span style={{ fontSize: 9, color: bassNoteLength !== 1 ? '#34d399' : '#4b5563', fontWeight: 800, minWidth: 30, textAlign: 'right' }}>{bassNoteLength.toFixed(2)}x</span>

          <div style={{ width: 1, height: 14, background: '#1a1a1a' }} />

          {/* SLIDE — TIE / portamento between adjacent close hits. The same
              feature that gives trap-808 bass its iconic pitch-glide. At 0
              every note plays discretely; turn it up and consecutive
              different-pitch hits get merged into one note with a frequency
              ramp from pitch A → pitch B. */}
          <span
            style={{ fontSize: 9, color: '#4b5563', fontWeight: 800 }}
            title="SLIDE — when two bass hits land close together with different pitches, this rolls the dice and merges them into one note that glides in pitch (classic 808 / acid-bass slide). 0% = none, 100% = always glide on close pairs."
          >
            SLIDE
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={bassSlide}
            onChange={(e) => setBassSlide(Number(e.target.value))}
            title="Higher = more 808-style pitch glides between adjacent notes"
            style={{ width: 60, accentColor: '#60a5fa' }}
          />
          <span style={{ fontSize: 9, color: bassSlide > 0 ? '#60a5fa' : '#4b5563', fontWeight: 800, minWidth: 26, textAlign: 'right' }}>{Math.round(bassSlide * 100)}%</span>

          <div style={{ width: 1, height: 14, background: '#1a1a1a' }} />

          {/* VOLUME */}
          <span style={{ fontSize: 9, color: '#4b5563', fontWeight: 800 }}>VOL</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={bassVolume}
            onChange={(e) => setBassVolume(Number(e.target.value))}
            style={{ width: 70, accentColor: '#a855f7' }}
          />
          <span style={{ fontSize: 9, color: '#c4b5fd', fontWeight: 800, minWidth: 26, textAlign: 'right' }}>{Math.round(bassVolume * 100)}%</span>

          <div style={{ width: 1, height: 14, background: '#1a1a1a' }} />

          <button
            onClick={handleMaterializeChordSmartBassLine}
            title="Writes the current pattern into every chord step using each chord’s scale tones (no piano required). Uses global pattern or each step’s A–H slot. Respects FILLS. Overwrites hand-painted notes after confirm."
            style={{
              background: '#052e1c',
              color: '#86efac',
              border: '1px solid #15803d',
              borderRadius: 5,
              padding: '3px 9px',
              fontSize: 9,
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            ♪ AUTO-WRITE (CHORDS)
          </button>

          {/* 🎲 RANDOMIZE — re-rolls voice, pattern, octave, fills, swing,
              note length, slide. Doesn't touch chord steps. Inspired by the
              dice button on Reason's Bassline Generator. */}
          <button
            onClick={handleRandomizeBass}
            title="Randomize bass settings (voice, pattern, octave, fills, swing, length, slide). Chord steps & key are untouched."
            style={{
              background: '#1a1130',
              color: '#fde68a',
              border: '1px solid #4a3c1a',
              borderRadius: 5,
              padding: '3px 9px',
              fontSize: 9,
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            🎲 RANDOMIZE
          </button>

          {/* PREVIEW current pattern on the first non-empty step */}
          <button
            onClick={() => {
              const firstIdx = steps.findIndex((s) => s != null);
              if (firstIdx < 0) return;
              const pad = pads[steps[firstIdx]!];
              if (!pad) return;
              const ctx = getCtx();
              const t = ctx.currentTime + 0.02;
              const secPerStep = (60 / Math.max(1, localBpm)) * 2;
              const nextIdx = steps.findIndex((s, i) => i > firstIdx && s != null);
              const nextPad = nextIdx >= 0 ? pads[steps[nextIdx]!] ?? null : null;
              scheduleBassStep(
                ctx,
                pad,
                nextPad,
                t,
                secPerStep,
                BASS_PATTERN_MAP[bassPattern],
                bassVoice,
                bassOctaveShift,
                bassVolume,
                { stepIdx: firstIdx, totalSteps: stepCount, fillsLevel: bassFillsLevel, swing: bassSwing, noteLength: bassNoteLength, slide: bassSlide, customHits: bassCustomPatterns[firstIdx] },
              );
            }}
            title="Preview the bass pattern using the first chord in the step row"
            style={{ background: '#1a1130', color: '#c4b5fd', border: '1px solid #3b2a66', borderRadius: 5, padding: '3px 9px', fontSize: 9, fontWeight: 900, cursor: 'pointer' }}
          >
            ▶ PREVIEW
          </button>

          <button
            onClick={() => setBassStepMutes(new Array(stepCount).fill(false))}
            title="Un-mute every bass step"
            style={{ background: '#111', color: '#9ca3af', border: '1px solid #1a1a1a', borderRadius: 5, padding: '3px 9px', fontSize: 9, fontWeight: 900, cursor: 'pointer' }}
          >
            UNMUTE ALL
          </button>

          <span style={{ marginLeft: 'auto', fontSize: 8, color: '#4b5563', fontWeight: 700 }}>
            For 20-genre, 8-row velocity bass: open <span style={{ color: '#c4b5fd', fontWeight: 800 }}>BASS STATION</span> from the sidebar — it auto-follows this chord progression.
          </span>
        </div>

        {/* ── 8 PATTERN SLOTS ROW ────────────────────────────────────────
            8 saveable bass "kits" (voice + pattern + all feel knobs).
            • Click an empty slot → save current settings into it
            • Click a filled slot → load globally (replaces current bass)
            • Shift+click any slot → force-save current to that slot
            • Right-click a filled slot → clear it
            • Per-step assignment: shift+click any bass step (or click its
              chip in the top-left corner) to cycle through saved slots.
            Per-step slots let Verse play one kit and Chorus another with
            zero mid-playback action from the user. ───────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 12px 2px', borderTop: '1px dashed #1a1a1a' }}>
          <span style={{ fontSize: 9, color: '#9ca3af', fontWeight: 900, letterSpacing: 0.3, marginRight: 2 }}>SLOTS</span>
          {SLOT_IDS.map((id) => {
            const slot = bassSlots[id];
            const filled = slot != null;
            const isActive = activeBassSlot === id;
            const c = SLOT_COLORS[id];
            // Does this slot also remember a hand-painted bass line? If so,
            // we show a small ♪ badge so the user can tell at a glance which
            // slots are "full presets" (kit + line) vs kit-only.
            const lineStepCount = filled && slot!.customPatterns
              ? Object.keys(slot!.customPatterns).length
              : 0;
            const hasLine = lineStepCount > 0;
            const labelDetail = filled
              ? `${BASS_PATTERN_MAP[slot!.pattern]?.label ?? slot!.pattern} · ${slot!.voice.toUpperCase()}${hasLine ? ` · ${lineStepCount}-step bass line` : ''}`
              : 'empty';
            return (
              <button
                key={`slot-${id}`}
                onClick={(e) => {
                  if (e.shiftKey) handleSaveToSlot(id);
                  else if (filled) handleLoadSlot(id);
                  else handleSaveToSlot(id);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (filled) handleClearSlot(id);
                }}
                title={filled
                  ? `SLOT ${id}: ${labelDetail}\n(click = load · shift+click = overwrite · right-click = clear)${hasLine ? '\n♪ This slot has a saved bass line — loading will restore the painted notes.' : ''}`
                  : `SLOT ${id} is empty\n(click to save current bass kit + painted line into it · shift+click does the same)`}
                style={{
                  background: filled ? (isActive ? c.fg : c.bg) : '#0a0a0a',
                  color: filled ? (isActive ? c.bg : c.fg) : '#3f3f46',
                  border: `1px solid ${filled ? c.border : '#1a1a1a'}`,
                  borderRadius: 5,
                  padding: '3px 8px',
                  fontSize: 10,
                  fontWeight: 900,
                  cursor: 'pointer',
                  minWidth: 26,
                  textAlign: 'center',
                  boxShadow: isActive ? `0 0 0 1px ${c.fg}` : 'none',
                  transition: 'background 80ms, color 80ms, box-shadow 80ms',
                  position: 'relative',
                }}
              >
                {id}
                {hasLine && (
                  <span
                    style={{
                      position: 'absolute',
                      top: -3,
                      right: -3,
                      fontSize: 8,
                      color: '#4ade80',
                      fontWeight: 900,
                      pointerEvents: 'none',
                      textShadow: '0 0 4px rgba(34, 197, 94, 0.7)',
                    }}
                  >
                    ♪
                  </span>
                )}
              </button>
            );
          })}

          <div style={{ width: 1, height: 14, background: '#1a1a1a', marginLeft: 4 }} />

          <span style={{ fontSize: 8, color: '#4b5563', fontWeight: 700 }}>
            Click slot = load · Shift+click = save · Right-click = clear · Shift+click a STEP to assign · <span style={{ color: '#4ade80' }}>♪</span> = saved bass line
          </span>

          {/* Quick action — clear ALL per-step slot assignments at once.
              Useful when an arrangement gets cluttered and you want to
              start fresh without losing the saved slots themselves. */}
          {Object.keys(bassStepSlots).length > 0 && (
            <button
              onClick={() => {
                setBassStepSlots({});
                setPresetFlash('Cleared all step slot assignments');
              }}
              title="Remove every per-step slot assignment (the slots themselves are kept)"
              style={{
                marginLeft: 'auto',
                background: '#1a0a0a',
                color: '#f87171',
                border: '1px solid #4a1a1a',
                borderRadius: 4,
                padding: '2px 7px',
                fontSize: 9,
                fontWeight: 900,
                cursor: 'pointer',
              }}
            >
              CLEAR STEP ASSIGNMENTS ({Object.keys(bassStepSlots).length})
            </button>
          )}
        </div>

        {/* Bass step row — one cell per chord step, mirrors the step row above */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(stepCount, 16)}, minmax(0, 1fr))`, gap: 3 }}>
          {steps.map((padIdx, si) => {
            const pad = padIdx != null ? pads[padIdx] : null;
            const active = currentStep === si;
            const muted = bassStepMutes[si] === true || !bassEnabled;
            const bassRootMidi = pad ? pad.notes[0]! - 12 + bassOctaveShift * 12 : null;
            const bassNoteName = bassRootMidi != null
              ? `${NOTE_LETTERS[((bassRootMidi % 12) + 12) % 12]}${Math.floor(bassRootMidi / 12) - 1}`
              : '—';
            const pattern = BASS_PATTERN_MAP[bassPattern];
            const customHits = bassCustomPatterns[si];
            const hasCustom = customHits != null && customHits.length > 0;
            // Visualize the custom hits when present, otherwise the global pattern.
            const visHits: { slot: number; vel: number }[] = hasCustom
              ? customHits.map((c) => ({ slot: c.slot, vel: c.vel }))
              : pattern.previewHits;
            const editingNow = pianoRollStepIdx === si;
            return (
              <div key={`bass-step-${si}`} style={{ position: 'relative' }}>
                <button
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setBassStepMutes((prev) => {
                      const next = [...prev];
                      while (next.length <= si) next.push(false);
                      next[si] = !next[si];
                      return next;
                    });
                  }}
                  onClick={(e) => {
                    if (!pad) return;
                    // SHIFT+click cycles this step's pattern-slot assignment
                    // (none → A → B → … → H → none, skipping empty slots).
                    if (e.shiftKey) {
                      cycleStepSlot(si);
                      return;
                    }
                    const ctx = getCtx();
                    const t = ctx.currentTime + 0.02;
                    const secPerStep = (60 / Math.max(1, localBpm)) * 2;
                    const nextStep = (si + 1) % steps.length;
                    const nextPad = steps[nextStep] != null ? pads[steps[nextStep]!] ?? null : null;
                    // Per-step slot override — preview uses the slot's bass
                    // kit if assigned, otherwise falls back to global.
                    const assignedSlotId = bassStepSlots[si];
                    const slot = assignedSlotId ? bassSlots[assignedSlotId] : null;
                    const usePattern = slot ? BASS_PATTERN_MAP[slot.pattern] : pattern;
                    const useVoice = slot?.voice ?? bassVoice;
                    const useOctave = slot?.octave ?? bassOctaveShift;
                    const useFills = slot?.fills ?? bassFillsLevel;
                    const useSwing = slot?.swing ?? bassSwing;
                    const useLength = slot?.length ?? bassNoteLength;
                    const useSlide = slot?.slide ?? bassSlide;
                    scheduleBassStep(
                      ctx,
                      pad,
                      nextPad,
                      t,
                      secPerStep,
                      usePattern,
                      useVoice,
                      useOctave,
                      bassVolume,
                      { stepIdx: si, totalSteps: steps.length, fillsLevel: useFills, swing: useSwing, noteLength: useLength, slide: useSlide, customHits: bassCustomPatterns[si] },
                    );
                  }}
                  title={pad
                    ? `${bassNoteName} · ${hasCustom ? 'CUSTOM (piano-roll)' : pattern.label}${bassStepSlots[si] ? ` · SLOT ${bassStepSlots[si]}` : ''}\n(click to preview · shift+click to cycle slot · right-click to ${bassStepMutes[si] ? 'unmute' : 'mute'} this step · 🎹 to edit)`
                    : 'No chord on this step'}
                  style={{
                    width: '100%',
                    minHeight: stepCount <= 8 ? 30 : stepCount <= 16 ? 26 : 22,
                    borderRadius: 5,
                    border: `1px solid ${
                      bassStepMutes[si]
                        ? '#3a1414'
                        : editingNow
                        ? '#fde68a'
                        : hasCustom
                        ? '#22d3eeaa'
                        : active && pad
                        ? '#a855f7aa'
                        : pad
                        ? '#2a1f4a'
                        : '#1a1a1a'
                    }`,
                    background: bassStepMutes[si]
                      ? '#180a0a'
                      : hasCustom
                      ? (active ? '#0e2030' : '#08161e')
                      : pad
                      ? (active ? '#1f0f3a' : '#10081e')
                      : '#0a0a0a',
                    color: pad ? (bassStepMutes[si] ? '#6b7280' : hasCustom ? '#67e8f9' : '#c4b5fd') : '#303030',
                    padding: '1px 3px',
                    cursor: pad ? 'pointer' : 'default',
                    opacity: bassStepMutes[si] ? 0.55 : 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1,
                    lineHeight: 1.05,
                    boxShadow: active && pad && !bassStepMutes[si] ? `inset 0 0 8px ${hasCustom ? '#22d3ee44' : '#a855f744'}` : 'none',
                    transition: 'border-color 80ms, box-shadow 80ms',
                  }}
                >
                  {/* 8-slot pattern visualizer — uses CUSTOM hits when this step
                      has a Piano-Roll override, otherwise falls back to the
                      global pattern's static preview. */}
                  <div style={{ display: 'flex', gap: 1.5, alignItems: 'center', justifyContent: 'center', height: 4 }}>
                    {Array.from({ length: 8 }).map((_, slot) => {
                      const hit = visHits.find((h) => Math.floor(h.slot) === slot);
                      const dotColor = hit
                        ? hasCustom
                          ? `rgba(103,232,249,${(0.35 + 0.65 * hit.vel) * (muted ? 0.4 : 1)})`
                          : `rgba(196,181,253,${(0.35 + 0.65 * hit.vel) * (muted ? 0.4 : 1)})`
                        : '#1a1a1a';
                      return (
                        <div
                          key={slot}
                          style={{
                            width: hit ? 4 : 2,
                            height: hit ? 4 : 2,
                            borderRadius: '50%',
                            background: dotColor,
                          }}
                        />
                      );
                    })}
                  </div>
                  <span style={{ fontSize: stepCount <= 8 ? 10 : 9, fontWeight: 900, letterSpacing: 0.2, lineHeight: 1.05 }}>
                    {pad ? bassNoteName : '—'}
                  </span>
                  {bassStepMutes[si] && stepCount <= 12 && (
                    <span style={{ fontSize: 6, color: '#f87171', fontWeight: 800, lineHeight: 1 }}>MUTED</span>
                  )}
                </button>

                {/* 🎹 EDIT — opens the piano-roll editor for THIS step. Click
                    stops propagation so the parent step's preview-click doesn't
                    fire at the same time. Sized big enough to be obvious — was
                    a 14px chip, now 22px and labeled so the user spots it. */}
                {pad && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (orchidStudioOpen && pianoRollStepIdx === si) {
                        closeOrchidStudio();
                        return;
                      }
                      openOrchidStudio(si);
                    }}
                    onContextMenu={(e) => e.stopPropagation()}
                    title={hasCustom ? 'Edit piano-roll pattern for this step' : 'Open piano-roll editor for this step (shows the current pattern\u2019s notes — click any to start editing)'}
                    style={{
                      position: 'absolute',
                      top: 2,
                      right: 2,
                      minWidth: 22,
                      height: 18,
                      padding: '0 4px',
                      lineHeight: 1,
                      fontSize: 11,
                      borderRadius: 4,
                      cursor: 'pointer',
                      background: editingNow ? '#fde68a' : hasCustom ? '#0e2030' : '#1a1130',
                      color: editingNow ? '#1a1130' : hasCustom ? '#67e8f9' : '#fde68a',
                      border: `1px solid ${editingNow ? '#fde68a' : hasCustom ? '#22d3ee99' : '#4a3c1a'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 2,
                      fontWeight: 900,
                      boxShadow: editingNow ? '0 0 0 2px #fde68a55' : 'none',
                      transition: 'background 80ms, color 80ms, box-shadow 80ms',
                    }}
                  >
                    🎹
                  </button>
                )}

                {/* SLOT chip — top-left corner. When a slot is assigned to
                    this step the chip is colored & shows the slot letter;
                    clicking it cycles to the next saved slot (none → A → B
                    → … → H → none). This is the same cycle as Shift+click
                    on the step body, just with an explicit clicktarget. */}
                {pad && (() => {
                  const assignedSlot = bassStepSlots[si];
                  const c = assignedSlot ? SLOT_COLORS[assignedSlot] : null;
                  return (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        cycleStepSlot(si);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        // Right-click on the chip immediately removes the assignment.
                        if (assignedSlot) {
                          setBassStepSlots((prev) => {
                            const out = { ...prev };
                            delete out[si];
                            return out;
                          });
                        }
                      }}
                      title={assignedSlot
                        ? `Step plays SLOT ${assignedSlot} (click to cycle · right-click to clear)`
                        : 'No slot assigned (click to cycle through saved slots)'}
                      style={{
                        position: 'absolute',
                        top: 1,
                        left: 1,
                        minWidth: 14,
                        height: 14,
                        padding: '0 3px',
                        lineHeight: 1,
                        fontSize: 8,
                        borderRadius: 3,
                        cursor: 'pointer',
                        background: c ? c.bg : '#0a0a0a',
                        color: c ? c.fg : '#3f3f46',
                        border: `1px solid ${c ? c.border : '#1a1a1a'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                      }}
                    >
                      {assignedSlot ?? '·'}
                    </button>
                  );
                })()}
              </div>
            );
          })}
        </div>

        {/* ── 🎹 PIANO ROLL EDITOR ────────────────────────────────────────
            Inline pop-down. Edits ONE chord step at a time (= 0.5 bar /
            8 sub-slots / a half-note worth of bass). Capped naturally at
            the sequence's max step count (32 → 16 bars total). Notes are
            stored as semitone offsets from the bass root so the painted
            pattern transposes correctly across chord changes. */}
        {pianoRollStepIdx != null && !orchidStudioOpen && (() => {
          const si = pianoRollStepIdx;
          const padIdx = steps[si];
          const pad = padIdx != null ? pads[padIdx] : null;
          if (!pad) return null;
          const currentHits = bassCustomPatterns[si] ?? [];
          const isFollowingGlobal = currentHits.length === 0;
          // ── Effective settings for THIS step ──
          // If the step has a slot assignment, the slot's pattern / octave
          // drive the ghosted preview (and the “taken-over” initial state).
          const assignedSlotIdForRoll = bassStepSlots[si];
          const slotForRoll = assignedSlotIdForRoll ? bassSlots[assignedSlotIdForRoll] : null;
          const effectivePatternIdForRoll = slotForRoll?.pattern ?? bassPattern;
          const effectiveOctaveForRoll = slotForRoll?.octave ?? bassOctaveShift;
          const effectivePatternForRoll = BASS_PATTERN_MAP[effectivePatternIdForRoll];
          const bassRootMidi = pad.notes[0]! - 12 + effectiveOctaveForRoll * 12;
          const bassRootName = `${NOTE_LETTERS[((bassRootMidi % 12) + 12) % 12]}${Math.floor(bassRootMidi / 12) - 1}`;

          // ── Ghost hits ──
          // What the global pattern (or assigned slot) would actually play
          // on this step right now. Used to (a) show ghosted cells in the
          // piano roll so the user can SEE what's playing before they edit,
          // and (b) auto-materialize on first click so they can take over
          // and tweak from a real starting point instead of an empty grid.
          //
          // Patterns may use randomness in their generate() — for the ghost
          // we resolve via previewHits (deterministic static snapshot) so
          // the ghosted layout doesn't dance around between opens.
          const ghostHits: CustomBassHit[] = effectivePatternForRoll.previewHits.map((h) => {
            const midi = resolveBassMidi(h, pad, null, effectiveOctaveForRoll);
            return { slot: h.slot, sustainSlots: h.sustainSlots, midiOffset: midi - bassRootMidi, vel: h.vel };
          });
          // Chord quality detection (drives the chord-tone row highlights).
          const chordTones = new Set(pad.notes.map((n) => ((n - pad.notes[0]!) % 12 + 12) % 12));
          // 25 rows: −12 to +12 semitones from bass root. Top is highest pitch.
          const rows: { offset: number; isChordTone: boolean; isRoot: boolean; isOctave: boolean; label: string }[] = [];
          const degreeLabel = (semis: number): string => {
            // Bass piano-roll labels are easiest read as "how far above/below
            // the bass root". So we show the absolute interval and a ↓ when
            // the offset is below the root — this is musically the same as
            // an inverted-interval name but far less ambiguous on the eye.
            const names = ['R', 'm2', '2', 'm3', '3', '4', 'tt', '5', 'm6', '6', 'm7', '7'];
            if (semis === 0) return 'R';
            if (semis === 12) return '+OCT';
            if (semis === -12) return '↓OCT';
            if (semis > 0) return `+${names[semis]!}`;
            return `↓${names[-semis]!}`;
          };
          for (let off = 12; off >= -12; off--) {
            const pc = ((off % 12) + 12) % 12;
            rows.push({
              offset: off,
              isChordTone: chordTones.has(pc),
              isRoot: pc === 0,
              isOctave: off === 12 || off === -12,
              label: degreeLabel(off),
            });
          }
          const totalBars = Math.ceil(stepCount * 0.5);     // each step = 1/2 bar
          const editedSteps = Object.keys(bassCustomPatterns).length;
          // Helpers to mutate the current step's hits.
          const setHits = (next: CustomBassHit[]) => {
            setBassCustomPatterns((prev) => {
              const out = { ...prev };
              if (next.length === 0) delete out[si];
              else out[si] = next;
              return out;
            });
          };
          // Materialized custom hits are constrained to integer slot
          // boundaries so the resize handle can land cleanly on cell edges.
          const snapHit = (h: CustomBassHit): CustomBassHit => ({
            ...h,
            sustainSlots: Math.max(1, Math.min(8 - h.slot, Math.round(h.sustainSlots))),
          });
          // CRITICAL: every note must fit inside the step (8 sub-slots).
          // sustainSlots is the duration in sub-slots; the bass scheduler
          // plays the note for sustainSlots × subDur seconds, so if it
          // exceeds 8 − slot, the audio bleeds INTO THE NEXT STEP — which
          // is exactly the "throws a note into the next bar" complaint.
          // Clamp at every entry point: add, drag-move, paste, resize.
          const clampSus = (slot: number, sus: number): number =>
            Math.max(1, Math.min(8 - slot, Math.round(sus)));
          const toggleCell = (slot: number, offset: number) => {
            // Operates on the FOCUSED step (the one the user originally
            // clicked to open the editor). Used by the toolbar paste / clear
            // operations. For grid clicks we use toggleCellAt below, which
            // can target any step in the multi-step timeline.
            if (isFollowingGlobal) {
              setHits([
                { slot, midiOffset: offset, sustainSlots: clampSus(slot, pianoRollNoteLength), vel: 0.85 },
              ]);
              return;
            }
            setHits([
              ...currentHits,
              { slot, midiOffset: offset, sustainSlots: clampSus(slot, pianoRollNoteLength), vel: 0.85 },
            ]);
          };
          // Add a single note to ANY step's hits — used by the multi-step
          // timeline so a click in step 5's column adds to step 5, not the
          // focused step. If the target step is currently FOLLOWING the
          // global pattern (no custom hits yet), the click drops the
          // pattern and seeds the step with just this one note — same
          // rule the original single-step editor used.
          const toggleCellAt = (stepIdx: number, slot: number, offset: number) => {
            const existing = bassCustomPatterns[stepIdx] ?? [];
            const isFollowingThisStep = existing.length === 0;
            const newHit: CustomBassHit = {
              slot,
              midiOffset: offset,
              sustainSlots: clampSus(slot, pianoRollNoteLength),
              vel: 0.85,
            };
            const next = isFollowingThisStep ? [newHit] : [...existing, newHit];
            setHitsForStep(stepIdx, next);
          };
          const previewCurrent = () => {
            const ctx = getCtx();
            const t = ctx.currentTime + 0.02;
            const secPerStep = (60 / Math.max(1, localBpm)) * 2;
            const nextStep = (si + 1) % steps.length;
            const nextPad = steps[nextStep] != null ? pads[steps[nextStep]!] ?? null : null;
            scheduleBassStep(
              ctx, pad, nextPad, t, secPerStep,
              BASS_PATTERN_MAP[bassPattern], bassVoice, bassOctaveShift, bassVolume,
              {
                stepIdx: si,
                totalSteps: steps.length,
                fillsLevel: bassFillsLevel,
                swing: bassSwing,
                noteLength: bassNoteLength,
                slide: bassSlide,
                customHits: currentHits.length > 0 ? currentHits : undefined,
                linkedOrchid:
                  currentHits.length > 0 && !orchidLinkedChordsMuted && orchidLinkedChordVolume > 0.02
                    ? linkedOrchidRef.current
                    : undefined,
              },
            );
          };
          const loadFromGlobalPattern = () => {
            // Materialize the effective pattern's notes as custom hits. Uses
            // the slot's pattern if this step has a slot assignment, otherwise
            // the global pattern. We call generate() here (not previewHits)
            // so the user gets the live runtime pattern with any context-
            // dependent variations baked in as a starting point.
            const globalCtx: BassPatternContext = {
              pad, nextPad: null, stepIdx: si, totalSteps: stepCount, rand: Math.random,
            };
            const generated = effectivePatternForRoll.generate(globalCtx);
            const converted: CustomBassHit[] = generated.map((h) => {
              const midi = resolveBassMidi(h, pad, null, effectiveOctaveForRoll);
              const snap = Math.max(1, Math.min(8 - Math.round(h.slot), Math.round(h.sustainSlots)));
              return { slot: Math.round(h.slot), sustainSlots: snap, midiOffset: midi - bassRootMidi, vel: h.vel };
            });
            setHits(converted);
          };

          // ═══════════════════════════════════════════════════════════════
          // DAW-style note interactions (window-level, robust to fast moves)
          //
          // A note is ONE indivisible rectangle. To move, drag the body. To
          // resize, drag the golden bar on the right edge. To delete, right-
          // click the rectangle. All tracking happens on window listeners
          // so the gesture never gets dropped on fast moves or container
          // exits. Every helper takes the OWNER STEP of the note so the
          // same gestures work across the multi-step timeline (a note
          // dragged from step 2 to step 5 transfers between step arrays).
          // ═══════════════════════════════════════════════════════════════
          const setHitsForStep = (stepIdx: number, next: CustomBassHit[]) => {
            setBassCustomPatterns((prev) => {
              const out = { ...prev };
              if (next.length === 0) delete out[stepIdx];
              else out[stepIdx] = next;
              return out;
            });
          };
          const deleteNote = (stepIdx: number, note: CustomBassHit) => {
            setBassCustomPatterns((prev) => {
              const hits = prev[stepIdx] ?? [];
              const next = hits.filter((h) => !(h.slot === note.slot && h.midiOffset === note.midiOffset));
              const out = { ...prev };
              if (next.length === 0) delete out[stepIdx];
              else out[stepIdx] = next;
              return out;
            });
            bumpDragTick();
          };
          const beginDrag = (
            stepIdx: number,
            note: CustomBassHit,
            startClientX: number,
            startClientY: number,
          ) => {
            dragRef.current = {
              originalStep: stepIdx,
              originalSlot: note.slot,
              originalOffset: note.midiOffset,
              curStep: stepIdx,
              curSlot: note.slot,
              curOffset: note.midiOffset,
              sustainSlots: note.sustainSlots,
              vel: note.vel,
              moved: false,
            };
            bumpDragTick();
            // Click-vs-drag pixel threshold. Without this, clicking on
            // any non-head sub-slot of a multi-slot note triggered a
            // micro-move because the cursor was already over a different
            // cell (e.g. clicking on slot 3 of a note rooted at slot 0).
            // The note's head would jump to the clicked slot, clamping
            // sustain to fit the step, and the note appeared to shrink
            // to one square. We now require ≥ 5 px of actual mouse
            // travel before treating the gesture as a drag — same value
            // the browser uses for native drag-and-drop.
            const MOVE_THRESHOLD_PX = 5;

            const onMove = (ev: MouseEvent) => {
              const d = dragRef.current;
              if (!d) return;
              // Ignore micro-movements until the cursor has actually
              // travelled past the click-vs-drag threshold. d.moved
              // stays false until then, so a release here is a SELECT.
              const dx = ev.clientX - startClientX;
              const dy = ev.clientY - startClientY;
              if (!d.moved && (dx * dx + dy * dy) < (MOVE_THRESHOLD_PX * MOVE_THRESHOLD_PX)) {
                return;
              }
              const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
              const cell = el?.closest('[data-slot]') as HTMLElement | null;
              if (!cell) return;
              const cellStep = Number(cell.getAttribute('data-step'));
              const cellSlot = Number(cell.getAttribute('data-slot'));
              const cellOffset = Number(cell.getAttribute('data-row-offset'));
              if (Number.isNaN(cellStep) || Number.isNaN(cellSlot) || Number.isNaN(cellOffset)) return;
              if (d.curStep !== cellStep || d.curSlot !== cellSlot || d.curOffset !== cellOffset) {
                d.curStep = cellStep;
                d.curSlot = cellSlot;
                d.curOffset = cellOffset;
                d.moved = d.moved
                  || (cellStep !== d.originalStep
                    || cellSlot !== d.originalSlot
                    || cellOffset !== d.originalOffset);
                bumpDragTick();
              }
            };
            const onUp = () => {
              window.removeEventListener('mousemove', onMove);
              window.removeEventListener('mouseup', onUp);
              const d = dragRef.current;
              dragRef.current = null;
              bumpDragTick();
              if (!d) return;
              // Click WITHOUT a drag = SELECT this note. The header
              // "SELECTED NOTE" panel then lets the user shift octave or
              // change velocity without juggling modifier gestures on
              // the tiny note rectangle itself.
              if (!d.moved) {
                setSelectedNote({
                  step: d.originalStep,
                  slot: d.originalSlot,
                  midiOffset: d.originalOffset,
                });
                return;
              }
              // Normal MOVE — remove from source, push to destination.
              setBassCustomPatterns((prev) => {
                const out = { ...prev };
                const srcHits = (out[d.originalStep] ?? []).filter(
                  (h) => !(h.slot === d.originalSlot && h.midiOffset === d.originalOffset),
                );
                if (srcHits.length === 0) delete out[d.originalStep];
                else out[d.originalStep] = srcHits;
                const dstHitsBase = d.curStep === d.originalStep
                  ? srcHits
                  : (out[d.curStep] ?? []);
                const dstClean = dstHitsBase.filter(
                  (h) => !(h.slot === d.curSlot && h.midiOffset === d.curOffset),
                );
                dstClean.push({
                  slot: d.curSlot,
                  midiOffset: d.curOffset,
                  sustainSlots: clampSus(d.curSlot, d.sustainSlots),
                  vel: d.vel,
                });
                out[d.curStep] = dstClean;
                return out;
              });
              // After a successful move, follow the selection so
              // subsequent header tweaks (octave / velocity) still
              // operate on the same note the user just placed.
              setSelectedNote({
                step: d.curStep,
                slot: d.curSlot,
                midiOffset: d.curOffset,
              });
            };
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
          };
          const beginResize = (stepIdx: number, note: CustomBassHit) => {
            const origEnd = note.slot + Math.round(note.sustainSlots) - 1;
            resizeRef.current = {
              step: stepIdx,
              startSlot: note.slot,
              midiOffset: note.midiOffset,
              endSlot: origEnd,
              originalEndSlot: origEnd,
            };
            bumpDragTick();

            // Resize snaps to 1 SUB-SLOT (= 16th note) by default. The OLD
            // quarter-note snap was too jumpy ("stretches one note into one
            // big note") because every tiny drag rounded UP to 2 slots.
            // Hold SHIFT for half-slot (= 32nd note) fine resolution.
            // Hold ALT to revert to quarter-note (2-slot) snap if a user
            // explicitly wants the bigger grid.
            const onMove = (ev: MouseEvent) => {
              const r = resizeRef.current;
              if (!r) return;
              const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
              const cell = el?.closest('[data-slot]') as HTMLElement | null;
              // Find the START cell for fallback x-pixel math (used when
              // the cursor is past the right edge of the grid).
              const startCell = document.querySelector<HTMLElement>(
                `[data-step="${r.step}"][data-slot="${r.startSlot}"][data-row-offset="${r.midiOffset}"]`,
              );
              let targetSlotInStep: number;
              if (cell && Number(cell.getAttribute('data-step')) === r.step) {
                // Cursor is inside the SAME step — snap to the cell directly.
                const cellSlot = Number(cell.getAttribute('data-slot'));
                if (Number.isNaN(cellSlot)) return;
                targetSlotInStep = cellSlot;
              } else if (cell && Number(cell.getAttribute('data-step')) > r.step) {
                // Cursor is past the end of this step — clamp to the step's
                // last slot (sustainSlots can't bleed into the next step).
                targetSlotInStep = 7;
              } else if (startCell) {
                // Cursor outside the grid or before the start cell — use
                // x-pixel math relative to the start cell.
                const rect = startCell.getBoundingClientRect();
                const cellW = Math.max(1, rect.width);
                const dx = ev.clientX - rect.left;
                const slotsFromStart = Math.max(0, Math.floor(dx / cellW));
                targetSlotInStep = Math.min(7, r.startSlot + slotsFromStart);
              } else {
                return;
              }
              // Apply snap modifiers: ALT = quarter-note (2-slot) snap.
              // SHIFT = no change at 1-slot resolution (already finest).
              // Default is 1-slot precision — what a real DAW gives you.
              if (ev.altKey) {
                const rawLen = targetSlotInStep - r.startSlot + 1;
                const snappedLen = Math.max(2, Math.round(rawLen / 2) * 2);
                targetSlotInStep = Math.max(r.startSlot, Math.min(7, r.startSlot + snappedLen - 1));
              } else {
                targetSlotInStep = Math.max(r.startSlot, Math.min(7, targetSlotInStep));
              }
              if (r.endSlot !== targetSlotInStep) {
                r.endSlot = targetSlotInStep;
                bumpDragTick();
              }
            };
            const onUp = () => {
              window.removeEventListener('mousemove', onMove);
              window.removeEventListener('mouseup', onUp);
              const r = resizeRef.current;
              resizeRef.current = null;
              bumpDragTick();
              if (!r) return;
              const newSustain = Math.max(1, Math.min(8 - r.startSlot, r.endSlot - r.startSlot + 1));
              setBassCustomPatterns((prev) => {
                const hits = prev[r.step] ?? [];
                const next = hits.map((h) =>
                  (h.slot === r.startSlot && h.midiOffset === r.midiOffset)
                    ? { ...h, sustainSlots: newSustain }
                    : h,
                );
                const out = { ...prev };
                out[r.step] = next;
                return out;
              });
            };
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
          };

          // ═══════════════════════════════════════════════════════════════
          // MULTI-STEP TIMELINE — compute pad / chord / pattern / ghost
          // for every step, not just the focused one. The piano roll now
          // renders the ENTIRE bass line as one continuous timeline so the
          // user can see and edit any note in context (like Studio One or
          // FL Studio's piano roll). The focused step is the one whose
          // toolbar (AUDITION / CLEAR / etc.) operates on it, but ALL
          // steps are editable inline.
          // ═══════════════════════════════════════════════════════════════
          type StepData = {
            pad: ChordPad;
            bassRootMidi: number;
            bassRootName: string;
            chordTones: Set<number>;
            isFollowing: boolean;
            customHits: CustomBassHit[];
            ghostHits: CustomBassHit[];
            patternLabel: string;
            assignedSlotId: SlotId | undefined;
          };
          const stepDataArray: (StepData | null)[] = [];
          for (let s = 0; s < stepCount; s++) {
            const pIdx = steps[s];
            if (pIdx == null) { stepDataArray.push(null); continue; }
            const p = pads[pIdx];
            if (!p) { stepDataArray.push(null); continue; }
            const aSlotId = bassStepSlots[s];
            const aSlot = aSlotId ? bassSlots[aSlotId] : null;
            const ePatId = aSlot?.pattern ?? bassPattern;
            const eOct = aSlot?.octave ?? bassOctaveShift;
            const ePat = BASS_PATTERN_MAP[ePatId];
            const rMidi = p.notes[0]! - 12 + eOct * 12;
            const rName = `${NOTE_LETTERS[((rMidi % 12) + 12) % 12]}${Math.floor(rMidi / 12) - 1}`;
            const cTones = new Set(p.notes.map((n) => ((n - p.notes[0]!) % 12 + 12) % 12));
            const hits = bassCustomPatterns[s] ?? [];
            const ghosts: CustomBassHit[] = ePat.previewHits.map((h) => {
              const midi = resolveBassMidi(h, p, null, eOct);
              return { slot: h.slot, sustainSlots: h.sustainSlots, midiOffset: midi - rMidi, vel: h.vel };
            });
            stepDataArray.push({
              pad: p,
              bassRootMidi: rMidi,
              bassRootName: rName,
              chordTones: cTones,
              isFollowing: hits.length === 0,
              customHits: hits,
              ghostHits: ghosts,
              patternLabel: ePat.label,
              assignedSlotId: aSlotId,
            });
          }

          /** Matches pitch-row / key-rail geometry in this roll (slightly taller than Chord Builder). */
          const CHORD_SEQ_BASS_ROLL_METRICS: PianoRollMetrics = { rowH: 21, labelW: 52, rulerH: 18 };
          /** Per-row velocity lane height (aligned under each piano row). */
          const VEL_SUBROW_H = 12;
          type VelEntry = { stepIdx: number; note: CustomBassHit; isGhost: boolean };
          const allVelBars: VelEntry[] = [];
          for (let s = 0; s < stepCount; s++) {
            const d = stepDataArray[s];
            if (!d) continue;
            for (const n of d.customHits) {
              allVelBars.push({ stepIdx: s, note: n, isGhost: false });
            }
            if (d.isFollowing) {
              for (const g of d.ghostHits) {
                allVelBars.push({ stepIdx: s, note: g, isGhost: true });
              }
            }
          }

          return (
            <>
              {pianoRollImmersive && (
                <div
                  role="presentation"
                  aria-hidden
                  onClick={() => setPianoRollImmersive(false)}
                  style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 9990,
                    background: 'rgba(2,5,12,0.82)',
                    backdropFilter: 'blur(3px)',
                  }}
                />
              )}
              <div
                ref={pianoRollAnchorRef}
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                  ...(pianoRollImmersive
                    ? {
                        position: 'fixed',
                        top: 14,
                        left: 14,
                        right: 14,
                        bottom: 14,
                        zIndex: 9991,
                        marginTop: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        minHeight: 0,
                        overflow: 'hidden',
                        boxShadow: '0 28px 120px rgba(0,0,0,0.8)',
                      }
                    : {
                        marginTop: 6,
                        display: 'flex',
                        flexDirection: 'column',
                        minHeight: 0,
                      }),
                  padding: '8px 10px',
                  background: '#070a12',
                  border: pianoRollImmersive ? '2px solid rgba(34,211,238,0.4)' : '1px solid #1a2438',
                  borderRadius: pianoRollImmersive ? 12 : 6,
                }}
              >
              {/* Header banner — multi-step timeline editor. The piano
                  roll now shows the ENTIRE bass line across all steps so
                  the user can see and edit every note in context (real
                  DAW behaviour). The "focused" step is the one whose
                  toolbar (AUDITION / CLEAR / TAKE OVER / COPY / PASTE)
                  operates on it; clicking another step's header in the
                  grid moves focus there. */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6, flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 900, color: '#fde68a' }}>🎹 PIANO ROLL</span>
                {pianoRollImmersive ? (
                  <span style={{ fontSize: 8, color: '#5eead4', fontWeight: 900, letterSpacing: 0.5 }}>NEAR-FULLSCREEN</span>
                ) : null}
                <span style={{ fontSize: 9, color: '#67e8f9', fontWeight: 800 }}>
                  FULL BASS LINE · {totalBars} bar{totalBars === 1 ? '' : 's'} · {stepCount} steps · {editedSteps} edited
                </span>
                <span style={{ fontSize: 9, color: '#9ca3af', fontWeight: 800 }}>
                  FOCUS: STEP {si + 1} · {pad.name} · root {bassRootName}
                </span>

                {/* Status pill — tells the user whether the step is currently
                    following the global pattern (ghosted) or has been
                    "taken over" with custom painted notes. */}
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 900,
                    letterSpacing: 0.3,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: isFollowingGlobal ? '#1a1130' : '#072030',
                    color: isFollowingGlobal ? '#fde68a' : '#67e8f9',
                    border: `1px solid ${isFollowingGlobal ? '#4a3c1a' : '#22d3ee66'}`,
                  }}
                  title={isFollowingGlobal
                    ? `This step is FOLLOWING the global pattern (${effectivePatternForRoll.label}). The yellow ghost cells below show what plays. Click any cell to take over and edit.`
                    : `This step has ${currentHits.length} CUSTOM note(s) — the global pattern is overridden. CLEAR returns it to following the global pattern.`}
                >
                  {isFollowingGlobal
                    ? `▽ FOLLOWING ${effectivePatternForRoll.label.toUpperCase()}`
                    : `▣ CUSTOM · ${currentHits.length} note${currentHits.length === 1 ? '' : 's'}`}
                </span>

                <div style={{ width: 1, height: 12, background: '#1a1a1a' }} />

                {/* ── TOOL PALETTE ── Paint vs Erase, same as a real DAW.
                    When ERASE is active the cursor turns red, paint-clicks
                    are disabled, and a click on ANY note (anywhere on its
                    rectangle) deletes it — no need to nail the right edge
                    or hit right-click on a 22-px-wide 16th-note. */}
                <span style={{ fontSize: 9, color: '#4b5563', fontWeight: 800 }}>TOOL</span>
                <button
                  onClick={() => setPianoRollTool('paint')}
                  title="PAINT — click empty cells to add notes, drag notes to move them"
                  style={{
                    background: pianoRollTool === 'paint' ? '#1a2438' : '#0a0e16',
                    color: pianoRollTool === 'paint' ? '#67e8f9' : '#4b5563',
                    border: `1px solid ${pianoRollTool === 'paint' ? '#22d3ee66' : '#1a1a1a'}`,
                    borderRadius: 4,
                    padding: '2px 8px',
                    fontSize: 9,
                    fontWeight: 900,
                    cursor: 'pointer',
                  }}
                >
                  ✎ PAINT
                </button>
                <button
                  onClick={() => setPianoRollTool('erase')}
                  title="ERASE — click ANY note to delete it. The cursor turns red over notes. Click again on PAINT to go back to drawing."
                  style={{
                    background: pianoRollTool === 'erase' ? '#3b0f10' : '#0a0e16',
                    color: pianoRollTool === 'erase' ? '#fca5a5' : '#4b5563',
                    border: `1px solid ${pianoRollTool === 'erase' ? '#dc2626' : '#1a1a1a'}`,
                    borderRadius: 4,
                    padding: '2px 8px',
                    fontSize: 9,
                    fontWeight: 900,
                    cursor: 'pointer',
                    // When erase is active, give a subtle pulsing glow so it
                    // doesn't get lost — the user is in a destructive mode
                    // and clear feedback prevents "why are my clicks gone?"
                    boxShadow: pianoRollTool === 'erase'
                      ? '0 0 6px rgba(220, 38, 38, 0.5)'
                      : undefined,
                  }}
                >
                  ⌫ ERASE
                </button>

                <div style={{ width: 1, height: 12, background: '#1a1a1a' }} />

                {/* New-note length picker. Determines how many sub-slots a
                    fresh click-to-add note will sustain for. */}
                <span style={{ fontSize: 9, color: '#4b5563', fontWeight: 800 }}>ADD AS</span>
                {[
                  { v: 1, label: '1/16' },
                  { v: 2, label: '1/8' },
                  { v: 4, label: '1/4' },
                  { v: 8, label: '1/2' },
                ].map((opt) => (
                  <button
                    key={opt.v}
                    onClick={() => setPianoRollNoteLength(opt.v)}
                    style={{
                      background: pianoRollNoteLength === opt.v ? '#1a2438' : '#0a0e16',
                      color: pianoRollNoteLength === opt.v ? '#67e8f9' : '#4b5563',
                      border: `1px solid ${pianoRollNoteLength === opt.v ? '#22d3ee66' : '#1a1a1a'}`,
                      borderRadius: 4,
                      padding: '2px 6px',
                      fontSize: 9,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}

                <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button
                    onClick={() => centerPianoRollOnNotes()}
                    title="Scroll the grid so the active notes are centered in view"
                    style={{ background: '#0a0e16', color: '#67e8f9', border: '1px solid #155e75', borderRadius: 4, padding: '2px 8px', fontSize: 9, fontWeight: 900, cursor: 'pointer' }}
                  >
                    ⊙ CENTER NOTES
                  </button>
                  <button
                    onClick={previewCurrent}
                    title="Audition this step with the painted notes"
                    style={{ background: '#1a1130', color: '#c4b5fd', border: '1px solid #3b2a66', borderRadius: 4, padding: '2px 8px', fontSize: 9, fontWeight: 900, cursor: 'pointer' }}
                  >
                    ▶ AUDITION
                  </button>
                  <button
                    onClick={loadFromGlobalPattern}
                    title="Materialize the currently-playing pattern (the dashed ghost notes) as YOUR notes so you can move, resize, or delete each one. Use this when you want to edit the pattern instead of starting from scratch."
                    style={{ background: '#0a0e16', color: '#34d399', border: '1px solid #1a3a2a', borderRadius: 4, padding: '2px 10px', fontSize: 9, fontWeight: 900, cursor: 'pointer' }}
                  >
                    ▼ TAKE OVER PATTERN
                  </button>
                  <button
                    onClick={() => setPianoRollClipboard([...currentHits])}
                    disabled={currentHits.length === 0}
                    title="Copy this step's painted notes"
                    style={{ background: '#0a0e16', color: currentHits.length === 0 ? '#1f2937' : '#9ca3af', border: '1px solid #1a1a1a', borderRadius: 4, padding: '2px 8px', fontSize: 9, fontWeight: 900, cursor: currentHits.length === 0 ? 'not-allowed' : 'pointer' }}
                  >
                    COPY
                  </button>
                  <button
                    onClick={() => pianoRollClipboard && setHits(
                      pianoRollClipboard.map((h) => ({
                        ...h,
                        // Clamp on paste too — clipboard could have come from
                        // a different step where the same start-slot had more
                        // room, or sustain could exceed this step's bounds.
                        sustainSlots: clampSus(h.slot, h.sustainSlots),
                      })),
                    )}
                    disabled={!pianoRollClipboard}
                    title="Paste copied notes onto this step"
                    style={{ background: '#0a0e16', color: !pianoRollClipboard ? '#1f2937' : '#9ca3af', border: '1px solid #1a1a1a', borderRadius: 4, padding: '2px 8px', fontSize: 9, fontWeight: 900, cursor: !pianoRollClipboard ? 'not-allowed' : 'pointer' }}
                  >
                    PASTE
                  </button>
                  <button
                    onClick={() => setHits([])}
                    disabled={currentHits.length === 0}
                    title="Clear this step's painted notes (returns to the global pattern)"
                    style={{ background: '#0a0e16', color: currentHits.length === 0 ? '#1f2937' : '#f87171', border: '1px solid #1a1a1a', borderRadius: 4, padding: '2px 8px', fontSize: 9, fontWeight: 900, cursor: currentHits.length === 0 ? 'not-allowed' : 'pointer' }}
                  >
                    CLEAR
                  </button>
                  <button
                    type="button"
                    onClick={() => setPianoRollImmersive((v) => !v)}
                    title={
                      pianoRollImmersive
                        ? 'Dock the piano roll inline (smaller panel). Esc or click the dimmed backdrop also docks.'
                        : 'Expand piano roll to use almost the full window.'
                    }
                    style={{
                      background: pianoRollImmersive ? '#052e2e' : '#0a0e16',
                      color: pianoRollImmersive ? '#5eead4' : '#67e8f9',
                      border: `1px solid ${pianoRollImmersive ? '#14b8a6' : '#155e75'}`,
                      borderRadius: 4,
                      padding: '2px 10px',
                      fontSize: 9,
                      fontWeight: 900,
                      cursor: 'pointer',
                      boxShadow: pianoRollImmersive ? '0 0 10px rgba(20,184,166,0.25)' : undefined,
                    }}
                  >
                    {pianoRollImmersive ? '⊟ DOCK' : '⛶ FULL VIEW'}
                  </button>
                  <button
                    onClick={closeOrchidStudio}
                    title="Close Orchid Studio and piano roll"
                    style={{ background: '#0a0e16', color: '#fde68a', border: '1px solid #4a3c1a', borderRadius: 4, padding: '2px 8px', fontSize: 9, fontWeight: 900, cursor: 'pointer' }}
                  >
                    CLOSE STUDIO
                  </button>
                </div>
              </div>

              {/* ════════════════════════════════════════════════════════
                  BASS-LINE / PLAYBACK TOOLBAR
                  Second row of controls that operate on the WHOLE bass
                  line (every step), not just the focused step:
                    • AUTO-SCROLL: keeps the playhead centered during
                      playback so long bass lines don't run off-screen.
                    • COPY LINE / PASTE LINE: clipboard for the entire
                      painted bass arrangement — copy from one project /
                      session, paste into another, or just snapshot
                      before experimenting.
                    • SAVE LINE → SLOT: persists the current painted
                      notes (along with the current bass kit) into one
                      of the 8 slots so the user can recall it later.
                  ════════════════════════════════════════════════════════ */}
              {(() => {
                const editedCount = Object.keys(bassCustomPatterns).length;
                const clipboardCount = bassLineClipboard
                  ? Object.keys(bassLineClipboard).length
                  : 0;
                return (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flexWrap: 'wrap',
                    marginBottom: 6,
                    flexShrink: 0,
                    padding: '4px 6px',
                    background: '#04060a',
                    border: '1px solid #1a2438',
                    borderRadius: 5,
                  }}>
                    <span style={{ fontSize: 9, color: '#4b5563', fontWeight: 800 }}>BASS LINE</span>

                    {/* ── AUTO-SCROLL TOGGLE ── */}
                    <button
                      onClick={() => setPianoRollAutoScroll((v) => !v)}
                      title={pianoRollAutoScroll
                        ? 'AUTO-SCROLL is ON — the timeline tracks the playhead so the playing step stays centered. Click to turn off.'
                        : 'AUTO-SCROLL is OFF — the timeline does not move during playback. Click to turn on.'}
                      style={{
                        background: pianoRollAutoScroll ? '#052e1c' : '#0a0e16',
                        color: pianoRollAutoScroll ? '#86efac' : '#4b5563',
                        border: `1px solid ${pianoRollAutoScroll ? '#22c55e66' : '#1a1a1a'}`,
                        borderRadius: 4,
                        padding: '2px 8px',
                        fontSize: 9,
                        fontWeight: 900,
                        cursor: 'pointer',
                        boxShadow: pianoRollAutoScroll ? '0 0 6px rgba(34, 197, 94, 0.35)' : undefined,
                      }}
                    >
                      {pianoRollAutoScroll ? '⟳ AUTO-SCROLL ON' : '⟳ AUTO-SCROLL OFF'}
                    </button>

                    <div style={{ width: 1, height: 12, background: '#1a1a1a' }} />

                    {/* ── COPY LINE ── snapshots EVERY edited step into the
                        full-line clipboard, leaving the current notes alone. */}
                    <button
                      onClick={() => {
                        if (editedCount === 0) {
                          setPresetFlash('Nothing to copy — paint some notes first');
                          return;
                        }
                        setBassLineClipboard(
                          JSON.parse(JSON.stringify(bassCustomPatterns)) as Record<number, CustomBassHit[]>,
                        );
                        setPresetFlash(`Copied bass line (${editedCount} step${editedCount === 1 ? '' : 's'})`);
                      }}
                      disabled={editedCount === 0}
                      title={editedCount === 0
                        ? 'Paint some notes first, then COPY LINE will snapshot the entire bass arrangement'
                        : `Copy the full painted bass line (${editedCount} step${editedCount === 1 ? '' : 's'}). Use PASTE LINE later to restore it across all steps.`}
                      style={{
                        background: '#0a0e16',
                        color: editedCount === 0 ? '#1f2937' : '#86efac',
                        border: `1px solid ${editedCount === 0 ? '#1a1a1a' : '#22c55e44'}`,
                        borderRadius: 4,
                        padding: '2px 8px',
                        fontSize: 9,
                        fontWeight: 900,
                        cursor: editedCount === 0 ? 'not-allowed' : 'pointer',
                      }}
                    >
                      ⎘ COPY LINE
                    </button>

                    {/* ── PASTE LINE ── replaces the entire bass line with
                        whatever's in the full-line clipboard. Clamped on
                        paste so a clipboard from a longer arrangement
                        can't introduce hits beyond the current stepCount. */}
                    <button
                      onClick={() => {
                        if (!bassLineClipboard) return;
                        const next: Record<number, CustomBassHit[]> = {};
                        for (const [k, hits] of Object.entries(bassLineClipboard)) {
                          const idx = Number(k);
                          if (idx < 0 || idx >= stepCount) continue;
                          next[idx] = hits.map((h) => ({
                            ...h,
                            sustainSlots: clampSus(h.slot, h.sustainSlots),
                          }));
                        }
                        setBassCustomPatterns(next);
                        const pastedCount = Object.keys(next).length;
                        setPresetFlash(`Pasted bass line (${pastedCount} step${pastedCount === 1 ? '' : 's'})`);
                      }}
                      disabled={!bassLineClipboard}
                      title={!bassLineClipboard
                        ? 'Clipboard is empty — use COPY LINE first'
                        : `Paste the full bass line from clipboard (${clipboardCount} step${clipboardCount === 1 ? '' : 's'}). REPLACES the current painted notes across every step.`}
                      style={{
                        background: '#0a0e16',
                        color: !bassLineClipboard ? '#1f2937' : '#86efac',
                        border: `1px solid ${!bassLineClipboard ? '#1a1a1a' : '#22c55e44'}`,
                        borderRadius: 4,
                        padding: '2px 8px',
                        fontSize: 9,
                        fontWeight: 900,
                        cursor: !bassLineClipboard ? 'not-allowed' : 'pointer',
                      }}
                    >
                      📋 PASTE LINE
                      {bassLineClipboard && (
                        <span style={{ marginLeft: 5, fontSize: 8, color: '#4ade80', fontWeight: 800 }}>
                          ({clipboardCount})
                        </span>
                      )}
                    </button>

                    {/* ── CLEAR LINE ── erases the painted notes from every
                        step so the bass line falls back to the global
                        pattern across the board. */}
                    <button
                      onClick={() => {
                        if (editedCount === 0) return;
                        setBassCustomPatterns({});
                        setSelectedNote(null);
                        setPresetFlash(`Cleared bass line (${editedCount} step${editedCount === 1 ? '' : 's'})`);
                      }}
                      disabled={editedCount === 0}
                      title={editedCount === 0
                        ? 'No painted notes to clear'
                        : `Erase ALL painted notes (${editedCount} step${editedCount === 1 ? '' : 's'}). Every step falls back to the global pattern. This does not affect saved slots.`}
                      style={{
                        background: '#0a0e16',
                        color: editedCount === 0 ? '#1f2937' : '#f87171',
                        border: `1px solid ${editedCount === 0 ? '#1a1a1a' : '#7f1d1d'}`,
                        borderRadius: 4,
                        padding: '2px 8px',
                        fontSize: 9,
                        fontWeight: 900,
                        cursor: editedCount === 0 ? 'not-allowed' : 'pointer',
                      }}
                    >
                      ✕ CLEAR LINE
                    </button>

                    <div style={{ width: 1, height: 12, background: '#1a1a1a' }} />

                    {/* ── SAVE LINE → SLOT ── opens an inline picker of the
                        8 slots A–H. Clicking a letter persists the current
                        bass kit AND the painted line into that slot so the
                        user can recall it later via the slot bank below
                        (or by clicking that letter again, which will both
                        save and load it in one go). */}
                    <button
                      onClick={() => setPianoRollSavePickerOpen((v) => !v)}
                      title={pianoRollSavePickerOpen
                        ? 'Hide the save-to-slot picker'
                        : `Save the current bass kit AND painted bass line into one of the 8 slots (A–H). Recall later by clicking the slot letter in the bass slot bank.`}
                      style={{
                        background: pianoRollSavePickerOpen ? '#1a1130' : '#0a0e16',
                        color: pianoRollSavePickerOpen ? '#fde68a' : '#fcd34d',
                        border: `1px solid ${pianoRollSavePickerOpen ? '#fbbf24' : '#4a3c1a'}`,
                        borderRadius: 4,
                        padding: '2px 8px',
                        fontSize: 9,
                        fontWeight: 900,
                        cursor: 'pointer',
                      }}
                    >
                      ★ SAVE LINE → SLOT {pianoRollSavePickerOpen ? '▴' : '▾'}
                    </button>

                    {pianoRollSavePickerOpen && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        {SLOT_IDS.map((id) => {
                          const slot = bassSlots[id];
                          const filled = slot != null;
                          const hasLine = !!slot?.customPatterns
                            && Object.keys(slot.customPatterns).length > 0;
                          const c = SLOT_COLORS[id];
                          return (
                            <button
                              key={`pr-save-${id}`}
                              onClick={() => {
                                handleSaveToSlot(id);
                                setPianoRollSavePickerOpen(false);
                              }}
                              title={filled
                                ? `OVERWRITE slot ${id} with the current bass kit + ${editedCount} step${editedCount === 1 ? '' : 's'} of painted notes${hasLine ? ' (existing slot ALSO has a saved bass line — will be replaced)' : ''}`
                                : `Save current bass kit + ${editedCount} step${editedCount === 1 ? '' : 's'} of painted notes into empty slot ${id}`}
                              style={{
                                background: filled ? c.bg : '#0a0a0a',
                                color: filled ? c.fg : '#6b7280',
                                border: `1px solid ${filled ? c.border : '#1a1a1a'}`,
                                borderRadius: 4,
                                padding: '2px 7px',
                                fontSize: 10,
                                fontWeight: 900,
                                cursor: 'pointer',
                                minWidth: 22,
                                position: 'relative',
                              }}
                            >
                              {id}
                              {hasLine && (
                                <span
                                  title="This slot already contains a saved bass line"
                                  style={{
                                    position: 'absolute',
                                    top: -2,
                                    right: -2,
                                    fontSize: 7,
                                    color: '#4ade80',
                                    fontWeight: 900,
                                    pointerEvents: 'none',
                                  }}
                                >
                                  ♪
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </span>
                    )}

                    {/* Quick-load picker — mirror of the save picker that
                        loads a slot (kit + line) without scrolling away. */}
                    <div style={{ width: 1, height: 12, background: '#1a1a1a' }} />
                    <span style={{ fontSize: 9, color: '#4b5563', fontWeight: 800 }}>LOAD</span>
                    {SLOT_IDS.map((id) => {
                      const slot = bassSlots[id];
                      const filled = slot != null;
                      const hasLine = !!slot?.customPatterns
                        && Object.keys(slot.customPatterns).length > 0;
                      const c = SLOT_COLORS[id];
                      return (
                        <button
                          key={`pr-load-${id}`}
                          onClick={() => {
                            if (!filled) {
                              setPresetFlash(`Slot ${id} is empty`);
                              return;
                            }
                            handleLoadSlot(id);
                          }}
                          disabled={!filled}
                          title={filled
                            ? `Load slot ${id}: kit + ${hasLine ? `${Object.keys(slot!.customPatterns!).length}-step bass line` : 'no saved bass line (kit only)'}`
                            : `Slot ${id} is empty`}
                          style={{
                            background: filled ? c.bg : '#080808',
                            color: filled ? c.fg : '#27272a',
                            border: `1px solid ${filled ? c.border : '#161616'}`,
                            borderRadius: 4,
                            padding: '2px 6px',
                            fontSize: 9,
                            fontWeight: 900,
                            cursor: filled ? 'pointer' : 'not-allowed',
                            minWidth: 20,
                            position: 'relative',
                          }}
                        >
                          {id}
                          {hasLine && (
                            <span
                              style={{
                                position: 'absolute',
                                top: -2,
                                right: -2,
                                fontSize: 7,
                                color: '#4ade80',
                                fontWeight: 900,
                                pointerEvents: 'none',
                              }}
                            >
                              ♪
                            </span>
                          )}
                        </button>
                      );
                    })}

                    <span style={{ marginLeft: 'auto', fontSize: 8, color: '#4b5563', fontWeight: 700 }}>
                      ♪ = slot has a saved bass line
                    </span>
                  </div>
                );
              })()}

              {/* ════════════════════════════════════════════════════════
                  SELECTED-NOTE SUB-TOOLBAR
                  Click any note in the grid (without dragging) to select
                  it — its info, OCTAVE shift, VELOCITY drag, DUP, and
                  DELETE controls all live here so you don't have to wrestle
                  with modifier-key gestures on a tiny 16th-note rectangle.
                  Click empty space (or the ✕) to deselect.
                  ════════════════════════════════════════════════════════ */}
              {(() => {
                const selStepHits = selectedNote
                  ? (bassCustomPatterns[selectedNote.step] ?? [])
                  : [];
                const selNote = selectedNote
                  ? selStepHits.find(
                      (h) => h.slot === selectedNote.slot
                        && h.midiOffset === selectedNote.midiOffset,
                    )
                  : null;
                const hasSel = !!(selectedNote && selNote);
                // Helper: replace the selected note via a mutator. Updates
                // the selection pointer too so subsequent edits land on
                // the same note even after slot / midiOffset changed.
                const updateSelectedNote = (
                  mut: (h: CustomBassHit) => CustomBassHit,
                ) => {
                  if (!selectedNote || !selNote) return;
                  const next = mut(selNote);
                  const finalNote: CustomBassHit = {
                    slot: Math.max(0, Math.min(7, next.slot)),
                    midiOffset: Math.max(-12, Math.min(12, next.midiOffset)),
                    sustainSlots: clampSus(
                      Math.max(0, Math.min(7, next.slot)),
                      next.sustainSlots,
                    ),
                    vel: Math.max(0.05, Math.min(1, next.vel)),
                  };
                  setBassCustomPatterns((prev) => {
                    const out = { ...prev };
                    const hits = (out[selectedNote.step] ?? []).filter(
                      (h) => !(h.slot === selectedNote.slot
                        && h.midiOffset === selectedNote.midiOffset),
                    );
                    // Also strip any pre-existing note that would collide
                    // with the new identity (slot + midiOffset). Prevents
                    // an octave-shift from silently merging onto another
                    // note already living at the destination row.
                    const cleaned = hits.filter(
                      (h) => !(h.slot === finalNote.slot
                        && h.midiOffset === finalNote.midiOffset),
                    );
                    cleaned.push(finalNote);
                    out[selectedNote.step] = cleaned;
                    return out;
                  });
                  setSelectedNote({
                    step: selectedNote.step,
                    slot: finalNote.slot,
                    midiOffset: finalNote.midiOffset,
                  });
                };
                const shiftOctave = (semis: number) => {
                  updateSelectedNote((h) => ({ ...h, midiOffset: h.midiOffset + semis }));
                };
                const shiftSemitone = (semis: number) => {
                  updateSelectedNote((h) => ({ ...h, midiOffset: h.midiOffset + semis }));
                };
                const duplicateSelected = () => {
                  if (!selectedNote || !selNote) return;
                  const targetSlot = Math.min(
                    7,
                    selNote.slot + Math.max(1, Math.round(selNote.sustainSlots)),
                  );
                  const newNote: CustomBassHit = {
                    slot: targetSlot,
                    midiOffset: selNote.midiOffset,
                    sustainSlots: clampSus(targetSlot, selNote.sustainSlots),
                    vel: selNote.vel,
                  };
                  setBassCustomPatterns((prev) => {
                    const hits = (prev[selectedNote.step] ?? []).filter(
                      (h) => !(h.slot === newNote.slot
                        && h.midiOffset === newNote.midiOffset),
                    );
                    hits.push(newNote);
                    return { ...prev, [selectedNote.step]: hits };
                  });
                  setSelectedNote({
                    step: selectedNote.step,
                    slot: newNote.slot,
                    midiOffset: newNote.midiOffset,
                  });
                };
                const deleteSelected = () => {
                  if (!selectedNote || !selNote) return;
                  deleteNote(selectedNote.step, selNote);
                  setSelectedNote(null);
                };
                // Velocity drag: horizontal trough, drag left↔right to
                // change vel. Click anywhere to jump to that position.
                const startVelocityDrag = (
                  trough: HTMLElement,
                  clientX: number,
                ) => {
                  if (!selectedNote || !selNote) return;
                  const apply = (cx: number) => {
                    const rect = trough.getBoundingClientRect();
                    const x = cx - rect.left;
                    const pct = Math.max(0, Math.min(1, x / Math.max(1, rect.width)));
                    const newVel = 0.05 + pct * 0.95;
                    updateSelectedNote((h) => ({ ...h, vel: newVel }));
                  };
                  apply(clientX);
                  const onMove = (ev: MouseEvent) => apply(ev.clientX);
                  const onUp = () => {
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                  };
                  window.addEventListener('mousemove', onMove);
                  window.addEventListener('mouseup', onUp);
                };
                // Build the absolute pitch label for the selected note —
                // uses the SELECTED step's bass root + the note's offset
                // so the readout is the actual MIDI pitch playing.
                let pitchLabel = '—';
                if (hasSel && selectedNote) {
                  const sd = stepDataArray[selectedNote.step];
                  if (sd) {
                    const absMidi = sd.bassRootMidi + selectedNote.midiOffset;
                    pitchLabel = `${NOTE_LETTERS[((absMidi % 12) + 12) % 12]}${Math.floor(absMidi / 12) - 1}`;
                  }
                }
                return (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 6,
                    flexShrink: 0,
                    padding: '5px 8px',
                    background: hasSel ? '#0a1822' : '#0a0e16',
                    border: `1px solid ${hasSel ? '#22d3ee66' : '#1a2438'}`,
                    borderRadius: 4,
                    flexWrap: 'wrap',
                    minHeight: 28,
                  }}>
                    {!hasSel && (
                      <span style={{ fontSize: 9, color: '#6b7280', fontStyle: 'italic' }}>
                        Click any note in the grid to select it — then OCTAVE and VELOCITY controls show up here.
                      </span>
                    )}
                    {hasSel && selectedNote && selNote && (
                      <>
                        <span style={{ fontSize: 9, fontWeight: 900, color: '#22d3ee', letterSpacing: 0.4 }}>
                          ◉ SELECTED
                        </span>
                        <span style={{ fontSize: 9, color: '#fde68a', fontWeight: 800 }}>
                          STEP {selectedNote.step + 1} · {pitchLabel} · {Math.round(selNote.vel * 127)} vel · {selNote.sustainSlots}×16th
                        </span>
                        <div style={{ width: 1, height: 14, background: '#1a2438' }} />
                        {/* OCTAVE shift */}
                        <span style={{ fontSize: 9, color: '#4b5563', fontWeight: 800 }}>OCT</span>
                        <button
                          onClick={() => shiftOctave(-12)}
                          disabled={selectedNote.midiOffset - 12 < -12}
                          title="Shift this note DOWN one octave (−12 semitones)"
                          style={{
                            background: '#0a0e16',
                            color: selectedNote.midiOffset - 12 < -12 ? '#1f2937' : '#67e8f9',
                            border: '1px solid #1a2438',
                            borderRadius: 4,
                            padding: '2px 8px',
                            fontSize: 11,
                            fontWeight: 900,
                            cursor: selectedNote.midiOffset - 12 < -12 ? 'not-allowed' : 'pointer',
                            lineHeight: 1,
                          }}
                        >
                          ↓
                        </button>
                        <button
                          onClick={() => shiftOctave(12)}
                          disabled={selectedNote.midiOffset + 12 > 12}
                          title="Shift this note UP one octave (+12 semitones)"
                          style={{
                            background: '#0a0e16',
                            color: selectedNote.midiOffset + 12 > 12 ? '#1f2937' : '#67e8f9',
                            border: '1px solid #1a2438',
                            borderRadius: 4,
                            padding: '2px 8px',
                            fontSize: 11,
                            fontWeight: 900,
                            cursor: selectedNote.midiOffset + 12 > 12 ? 'not-allowed' : 'pointer',
                            lineHeight: 1,
                          }}
                        >
                          ↑
                        </button>
                        {/* Fine semitone nudge */}
                        <span style={{ fontSize: 9, color: '#4b5563', fontWeight: 800, marginLeft: 4 }}>±1</span>
                        <button
                          onClick={() => shiftSemitone(-1)}
                          disabled={selectedNote.midiOffset - 1 < -12}
                          title="Down 1 semitone"
                          style={{
                            background: '#0a0e16',
                            color: selectedNote.midiOffset - 1 < -12 ? '#1f2937' : '#9ca3af',
                            border: '1px solid #1a2438',
                            borderRadius: 4,
                            padding: '2px 6px',
                            fontSize: 9,
                            fontWeight: 900,
                            cursor: selectedNote.midiOffset - 1 < -12 ? 'not-allowed' : 'pointer',
                          }}
                        >
                          −
                        </button>
                        <button
                          onClick={() => shiftSemitone(1)}
                          disabled={selectedNote.midiOffset + 1 > 12}
                          title="Up 1 semitone"
                          style={{
                            background: '#0a0e16',
                            color: selectedNote.midiOffset + 1 > 12 ? '#1f2937' : '#9ca3af',
                            border: '1px solid #1a2438',
                            borderRadius: 4,
                            padding: '2px 6px',
                            fontSize: 9,
                            fontWeight: 900,
                            cursor: selectedNote.midiOffset + 1 > 12 ? 'not-allowed' : 'pointer',
                          }}
                        >
                          +
                        </button>
                        <div style={{ width: 1, height: 14, background: '#1a2438' }} />
                        {/* VELOCITY drag trough */}
                        <span style={{ fontSize: 9, color: '#4b5563', fontWeight: 800 }}>VEL</span>
                        <div
                          onMouseDown={(e) => {
                            if (e.button !== 0) return;
                            e.preventDefault();
                            startVelocityDrag(e.currentTarget as HTMLElement, e.clientX);
                          }}
                          title="Drag LEFT↔RIGHT to change velocity (0.05 – 1.00). Click anywhere on the bar to jump."
                          style={{
                            width: 120,
                            height: 14,
                            background: '#0a0e16',
                            border: '1px solid #1a2438',
                            borderRadius: 4,
                            position: 'relative',
                            cursor: 'ew-resize',
                            overflow: 'hidden',
                          }}
                        >
                          <div style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: `${selNote.vel * 100}%`,
                            background: 'linear-gradient(to right, #14532d, #4ade80)',
                            pointerEvents: 'none',
                          }} />
                          <div style={{
                            position: 'absolute',
                            left: `${selNote.vel * 100}%`,
                            top: -1,
                            bottom: -1,
                            width: 2,
                            background: '#bbf7d0',
                            transform: 'translateX(-1px)',
                            pointerEvents: 'none',
                          }} />
                        </div>
                        <span style={{ fontSize: 9, color: '#bbf7d0', fontWeight: 900, minWidth: 22, textAlign: 'right' }}>
                          {Math.round(selNote.vel * 127)}
                        </span>
                        <div style={{ width: 1, height: 14, background: '#1a2438' }} />
                        {/* DUPLICATE */}
                        <button
                          onClick={duplicateSelected}
                          title="Duplicate this note into the next slot in the same step (overwrites whatever was there)"
                          style={{
                            background: '#0a0e16',
                            color: '#a5f3fc',
                            border: '1px solid #155e75',
                            borderRadius: 4,
                            padding: '2px 8px',
                            fontSize: 9,
                            fontWeight: 900,
                            cursor: 'pointer',
                          }}
                        >
                          ⎘ DUP
                        </button>
                        {/* DELETE */}
                        <button
                          onClick={deleteSelected}
                          title="Delete this note"
                          style={{
                            background: '#1a0a0e',
                            color: '#fca5a5',
                            border: '1px solid #7f1d1d',
                            borderRadius: 4,
                            padding: '2px 8px',
                            fontSize: 9,
                            fontWeight: 900,
                            cursor: 'pointer',
                          }}
                        >
                          ✕ DELETE
                        </button>
                        {/* DESELECT */}
                        <button
                          onClick={() => setSelectedNote(null)}
                          title="Clear selection"
                          style={{
                            background: 'transparent',
                            color: '#6b7280',
                            border: '1px solid #1a2438',
                            borderRadius: 4,
                            padding: '2px 6px',
                            fontSize: 9,
                            fontWeight: 700,
                            cursor: 'pointer',
                            marginLeft: 'auto',
                          }}
                        >
                          deselect
                        </button>
                      </>
                    )}
                  </div>
                );
              })()}

              {/* The grid: 25 pitch rows × 8 sub-slot columns. Each row's
                  left-side key rail shows the interval map for the FOCUSED
                  step; each CELL uses that step column's bass root so
                  absolute pitch changes bar-to-bar. Step headers spell every
                  note in the chord voicing so progressions don't all “read”
                  as the same key. Tall viewport — collapse song builder or
                  close the roll if you need more room elsewhere. */}
              <div
                ref={pianoRollScrollRef}
                data-drag-tick={dragTick}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  userSelect: 'none',
                  flex: pianoRollImmersive ? 1 : undefined,
                  minHeight: pianoRollImmersive ? 0 : undefined,
                  maxHeight: pianoRollImmersive ? 'none' : 'min(26vh, 220px)',
                  overflowY: 'auto',
                  // Horizontal scroll so the whole bass line fits even
                  // when stepCount is large (16 or 32). The label column
                  // is sticky so it stays visible while the timeline scrolls.
                  overflowX: 'auto',
                  border: '1px solid #1a1a1a',
                  borderRadius: 4,
                  background: '#040406',
                  padding: 0,
                  scrollbarColor: '#1a1a1a #040406',
                  scrollbarWidth: 'thin',
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                }}
              >
                <div
                  ref={chordSeqBassTimelineWrapRef}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    flexShrink: 0,
                    minHeight: 0,
                  }}
                >
                {/* ─── STEP + BEAT HEADER (sticky top) ──────────────────
                    Two stacked rows that stick to the top edge while the
                    user scrolls the pitch range vertically. Row 1 = step
                    labels (STEP 1, STEP 2, ...) with chord names; row 2
                    = beat numbers (1 & 2 & 3 & 4 &) repeated inside each
                    step. Hard divider every 8 sub-slots between steps. */}
                <div style={{
                  display: 'flex',
                  flexShrink: 0,
                  position: 'sticky',
                  top: 0,
                  zIndex: 10,
                  background: '#04060a',
                  borderBottom: '1px solid #1a2438',
                }}>
                  {/* Label gutter (sticky-left corner) */}
                  <div style={{
                    width: 52,
                    flexShrink: 0,
                    position: 'sticky',
                    left: 0,
                    zIndex: 11,
                    background: '#04060a',
                    borderRight: '1px solid #1a2438',
                  }} />
                  {/* Step row */}
                  <div style={{
                    flex: '0 0 auto',
                    display: 'grid',
                    gridTemplateColumns: `repeat(${stepCount}, minmax(${22 * 8}px, 1fr))`,
                    gap: 0,
                  }}>
                    {Array.from({ length: stepCount }).map((_, sIdx) => {
                      const data = stepDataArray[sIdx];
                      const isFocus = sIdx === si;
                      // Mint playline = continuous playhead (808-style); no per-step header flash.
                      const isPlayingStep = false;
                      const padName = data?.pad.name ?? '—';
                      const chordSpell = data?.pad.notes?.length
                        ? data.pad.notes.map((m) => cbPianoMidiToNoteName(m)).join(' · ')
                        : '';
                      return (
                        <div
                          key={`step-h-${sIdx}`}
                          onClick={() => openOrchidStudio(sIdx)}
                          title={chordSpell
                            ? `STEP ${sIdx + 1} · ${padName} · ${chordBassSeqStepChannelLabel(sIdx)}\nVoicing: ${chordSpell}\nClick to open Orchid Studio on this step.`
                            : `STEP ${sIdx + 1} · ${padName}${isPlayingStep ? ' · ▶ PLAYING NOW' : ''} · click to focus this step in the toolbar`}
                          style={{
                            cursor: 'pointer',
                            fontSize: 9,
                            fontWeight: 900,
                            color: isPlayingStep
                              ? '#bbf7d0'
                              : isFocus
                              ? '#fde68a'
                              : '#67e8f9',
                            textAlign: 'center',
                            paddingTop: 3,
                            paddingBottom: 3,
                            borderLeft: sIdx === 0 ? 'none' : '2px solid #1a2438',
                            background: isPlayingStep
                              ? '#052e1c'
                              : isFocus
                              ? '#1a1130'
                              : 'transparent',
                            boxShadow: isPlayingStep
                              ? 'inset 0 -2px 0 #22c55e, 0 0 10px rgba(34, 197, 94, 0.5)'
                              : undefined,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            lineHeight: 1.1,
                          }}
                        >
                          <span>
                            {isPlayingStep ? '▶ ' : ''}STEP {sIdx + 1}
                          </span>
                          <span style={{
                            fontSize: 8,
                            color: isPlayingStep
                              ? '#86efac'
                              : isFocus
                              ? '#fef3c7'
                              : '#9ca3af',
                            fontWeight: 700,
                          }}>
                            {padName}
                          </span>
                          {chordSpell ? (
                            <span
                              style={{
                                fontSize: 7,
                                color: isFocus ? '#a5f3fc' : '#6b7d8f',
                                fontWeight: 800,
                                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                                letterSpacing: 0.2,
                                paddingLeft: 4,
                                paddingRight: 4,
                                marginTop: 2,
                                lineHeight: 1.15,
                                maxWidth: '100%',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={chordSpell}
                            >
                              ♫ {chordSpell}
                            </span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* Beat number sub-header (1 & 2 & 3 & 4 & within each step) */}
                <div style={{
                  display: 'flex',
                  flexShrink: 0,
                  position: 'sticky',
                  top: 52,
                  zIndex: 9,
                  background: '#04060a',
                  borderBottom: '1px solid #1a1a1a',
                }}>
                  <div style={{
                    width: 52,
                    flexShrink: 0,
                    position: 'sticky',
                    left: 0,
                    zIndex: 11,
                    background: '#04060a',
                    borderRight: '1px solid #1a2438',
                  }} />
                  <div style={{
                    flex: '0 0 auto',
                    display: 'grid',
                    gridTemplateColumns: `repeat(${stepCount * 8}, minmax(22px, 1fr))`,
                    gap: 0,
                  }}>
                    {Array.from({ length: stepCount * 8 }).map((_, c) => {
                      const slotInStep = c % 8;
                      const stepIdx = Math.floor(c / 8);
                      const isStepStart = slotInStep === 0;
                      const isDownbeat = slotInStep % 2 === 0;
                      return (
                        <div
                          key={`beat-h-${c}`}
                          style={{
                            fontSize: isDownbeat ? 9 : 7,
                            color: isDownbeat ? '#fbbf24' : '#4b5563',
                            fontWeight: 900,
                            textAlign: 'center',
                            paddingTop: 1,
                            paddingBottom: 1,
                            borderLeft: isStepStart && stepIdx > 0
                              ? '2px solid #1a2438'
                              : isDownbeat
                              ? '1px solid #4a3c1a'
                              : '1px solid transparent',
                            background: isDownbeat ? 'rgba(251, 191, 36, 0.04)' : 'transparent',
                          }}
                        >
                          {isDownbeat ? `${slotInStep / 2 + 1}` : '&'}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ─────────────────────────────────────────────────────
                    PITCH ROWS × MULTI-STEP TIMELINE
                    Each row spans the WHOLE bass line (all stepCount steps).
                    Notes are absolute-positioned rectangles laid out at
                    their (step·8 + slot) column. The user sees every bar
                    at once and edits any note in place — same as a regular
                    DAW piano roll. The 52 px label gutter is sticky-left
                    so it stays visible while the timeline scrolls.
                    ───────────────────────────────────────────────────── */}
                {rows.map((row) => {
                  const drag = dragRef.current;
                  const rz = resizeRef.current;
                  const isAnyInteraction = !!drag || !!rz;
                  // Aggregate notes and ghosts for this row across ALL steps.
                  // Each entry remembers its owner step so handlers can
                  // route delete / drag / resize to the right step array.
                  const rowCustomNotes: { stepIdx: number; note: CustomBassHit }[] = [];
                  const rowGhostNotes: { stepIdx: number; ghost: CustomBassHit }[] = [];
                  for (let s = 0; s < stepCount; s++) {
                    const d = stepDataArray[s];
                    if (!d) continue;
                    for (const n of d.customHits) {
                      if (n.midiOffset === row.offset) rowCustomNotes.push({ stepIdx: s, note: n });
                    }
                    if (d.isFollowing) {
                      for (const g of d.ghostHits) {
                        if (g.midiOffset === row.offset) rowGhostNotes.push({ stepIdx: s, ghost: g });
                      }
                    }
                  }
                  const rowHasAnyNote = rowCustomNotes.length > 0 || rowGhostNotes.length > 0;
                  const totalCols = stepCount * 8;
                  const colPct = 100 / totalCols;
                  // Active drag/resize info scoped to this row.
                  const dragHere = !!drag && drag.moved && drag.curOffset === row.offset;
                  const dragClampedSus = drag
                    ? Math.min(drag.sustainSlots, 8 - drag.curSlot)
                    : 0;
                  const dragLeftPct = drag ? (drag.curStep * 8 + drag.curSlot) * colPct : 0;
                  const dragWidthPct = drag ? dragClampedSus * colPct : 0;
                  const resizeHere = !!rz && rz.midiOffset === row.offset;
                  const rzLeftPct = rz ? (rz.step * 8 + rz.startSlot) * colPct : 0;
                  const rzWidthPct = rz ? (rz.endSlot - rz.startSlot + 1) * colPct : 0;
                  const rowVelBars = allVelBars.filter((e) => e.note.midiOffset === row.offset);
                  const railMidi = bassRootMidi + row.offset;
                  return (
                    <Fragment key={`pr-row-${row.offset}`}>
                    <div
                      data-row-offset={row.offset}
                      data-has-note={rowHasAnyNote ? 'true' : undefined}
                      style={{ display: 'flex', flexShrink: 0 }}
                    >
                      {/* Sticky piano key rail — note name is for the FOCUSED step's
                          bass root + row offset (same readout as toolbar / selected note). */}
                      <div
                        style={{
                          width: 52,
                          flexShrink: 0,
                          position: 'sticky',
                          left: 0,
                          zIndex: 6,
                          boxSizing: 'border-box',
                          alignSelf: 'stretch',
                          display: 'flex',
                          alignItems: 'stretch',
                          background: '#050507',
                          borderRight: `1px solid ${CB_PIANO_MINT_BORDER}`,
                        }}
                        title={`Key rail (FOCUS step ${si + 1}): ${cbPianoMidiToNoteName(railMidi)} · ${row.label} vs root ${bassRootName}.\nEach timeline column uses THAT step’s bass root — hover any cell for the note in that bar.`}
                      >
                        <div
                          style={{
                            ...cbPianoKeyFaceStyle(railMidi, false, CHORD_SEQ_BASS_ROLL_METRICS),
                            flex: 1,
                            height: 21,
                            minHeight: 21,
                            maxHeight: 21,
                          }}
                        >
                          {cbPianoKeyLabel(railMidi)}
                        </div>
                      </div>
                      {/* ── Cell strip — the WHOLE timeline for this pitch row.
                          One grid column per sub-slot across all steps.
                          Cells are pure background tinting plus data-* anchors
                          for hit-testing during drag/resize. */}
                      <div
                        data-chord-seq-timeline-grid
                        style={{
                        flex: '0 0 auto',
                        position: 'relative',
                        display: 'grid',
                        gridTemplateColumns: `repeat(${totalCols}, minmax(22px, 1fr))`,
                        gap: 0,
                        height: 21,
                      }}>
                        {Array.from({ length: totalCols }).map((_, c) => {
                          const stepIdx = Math.floor(c / 8);
                          const slotInStep = c % 8;
                          const stepData = stepDataArray[stepIdx];
                          const isOnBeat = slotInStep % 2 === 0;
                          const isStepStart = slotInStep === 0;
                          const isChordToneHere = stepData?.chordTones.has(
                            ((row.offset % 12) + 12) % 12,
                          ) ?? false;
                          const isPlayingCell = false;
                          const cellMidi = stepData
                            ? stepData.bassRootMidi + row.offset
                            : bassRootMidi + row.offset;
                          const noteName = cbPianoMidiToNoteName(cellMidi);
                          const isBlackKeyRow = cbPianoIsBlackKey(cellMidi);
                          const isCRow = cbPianoIsCRow(cellMidi);
                          const pianoBase = isBlackKeyRow ? '#08080c' : '#0c0c10';
                          let bgStack = pianoBase;
                          if (!isOnBeat) {
                            bgStack = `linear-gradient(0deg, rgba(0,0,0,0.20), rgba(0,0,0,0.20)), ${bgStack}`;
                          }
                          if (isChordToneHere && stepData) {
                            bgStack = `linear-gradient(0deg, rgba(124,244,198,0.10), rgba(124,244,198,0.10)), ${bgStack}`;
                          }
                          if (row.isRoot && stepData) {
                            bgStack = `linear-gradient(0deg, rgba(253,230,138,0.08), rgba(253,230,138,0.08)), ${bgStack}`;
                          }
                          if (isPlayingCell) {
                            bgStack = `linear-gradient(0deg, rgba(34,197,94,0.12), rgba(34,197,94,0.12)), ${bgStack}`;
                          }
                          const baseBg = bgStack;
                          const isFocusStep = stepIdx === si;
                          return (
                            <div
                              key={`bg-${row.offset}-${c}`}
                              data-step={stepIdx}
                              data-slot={slotInStep}
                              data-row-offset={row.offset}
                              onMouseDown={(e) => {
                                if (e.button !== 0) return;
                                if (dragRef.current || resizeRef.current) return;
                                // Empty-cell click also clears any active
                                // note selection — matches the "click
                                // away to deselect" pattern every DAW uses.
                                setSelectedNote(null);
                                // In ERASE mode an empty-cell click is a
                                // no-op — the user is here to delete, not
                                // paint. Prevents accidental new notes.
                                if (pianoRollTool === 'erase') return;
                                toggleCellAt(stepIdx, slotInStep, row.offset);
                              }}
                              onContextMenu={(e) => { e.preventDefault(); }}
                              title={pianoRollTool === 'erase'
                                ? `ERASE mode — click on a note to delete it. (Empty cells are inert.)`
                                : `STEP ${stepIdx + 1} · ${noteName} (${row.label}) · sub-slot ${slotInStep + 1} — LEFT-click to add a note (length from ADD AS picker)`}
                              style={{
                                height: 20,
                                background: isFocusStep ? baseBg : `${baseBg}`,
                                borderLeft: isStepStart && stepIdx > 0
                                  ? '2px solid #1a2438'
                                  : isOnBeat
                                  ? '1px solid #2a2418'
                                  : '1px solid #0a0a0a',
                                borderTop: '1px solid #0a0a0a',
                                borderBottom: isCRow
                                  ? '1px solid rgba(124,244,198,0.14)'
                                  : '1px solid #0a0a0a',
                                borderRight: c === totalCols - 1 ? '1px solid #1a2438' : 'none',
                                cursor: pianoRollTool === 'erase' ? 'default' : 'cell',
                                boxSizing: 'border-box',
                                // Light highlight on the focused step's
                                // columns so the user knows which step the
                                // toolbar (AUDITION / CLEAR / etc.) hits.
                                boxShadow: isFocusStep
                                  ? 'inset 0 0 0 1px rgba(253, 230, 138, 0.06)'
                                  : undefined,
                              }}
                            />
                          );
                        })}

                        {/* ── GHOST NOTES — pattern preview for every step
                            that's currently FOLLOWING the global pattern.
                            Positioned at (step·8 + slot) in absolute pct
                            so they live exactly under their corresponding
                            cells. Read-only (pointer-events: none). */}
                        {rowGhostNotes.map(({ stepIdx, ghost }, gi) => {
                          // Ghost notes are SOLID dimmed-green rectangles
                          // (not transparent outlines). The user can see
                          // every note in the bass line at a glance, even
                          // the pattern-defined ones that haven't been
                          // "taken over". Dashed border = "preview, not
                          // editable" — fix this by clicking ▼ TAKE OVER.
                          const ghostIsPlayingNow = false;
                          return (
                            <div
                              key={`g-${row.offset}-${stepIdx}-${gi}`}
                              style={{
                                position: 'absolute',
                                top: 1,
                                bottom: 1,
                                left: `${(stepIdx * 8 + ghost.slot) * colPct}%`,
                                width: `${ghost.sustainSlots * colPct}%`,
                                background: ghostIsPlayingNow
                                  ? '#86efac'
                                  : '#22c55e99',
                                border: ghostIsPlayingNow
                                  ? '1px dashed #84cc16'
                                  : '1px dashed #15803d',
                                borderRadius: 3,
                                boxShadow: ghostIsPlayingNow
                                  ? 'inset 3px 0 0 #166534, 0 0 8px rgba(190, 242, 100, 0.6)'
                                  : 'inset 3px 0 0 #14532d',
                                pointerEvents: 'none',
                                zIndex: 1,
                                boxSizing: 'border-box',
                                opacity: 0.85,
                              }}
                            />
                          );
                        })}

                        {/* ── CUSTOM NOTES — every note across the whole
                            bass line. Each rectangle owns its events and
                            knows which step it lives in (for delete /
                            drag-move / resize routing). */}
                        {rowCustomNotes.map(({ stepIdx, note }, ni) => {
                          const isBeingDragged = !!drag
                            && drag.originalStep === stepIdx
                            && drag.originalSlot === note.slot
                            && drag.originalOffset === note.midiOffset;
                          const isBeingResized = !!rz
                            && rz.step === stepIdx
                            && rz.startSlot === note.slot
                            && rz.midiOffset === note.midiOffset;
                          const isSelected = !!selectedNote
                            && selectedNote.step === stepIdx
                            && selectedNote.slot === note.slot
                            && selectedNote.midiOffset === note.midiOffset;
                          // The note's step is the one the sequencer is
                          // sounding right now — light it up green so the
                          // user can see which note is being heard at
                          // exactly the moment they hear it.
                          const isPlayingNow = false;
                          if (isBeingResized) return null;
                          return (
                            <div
                              key={`n-${row.offset}-${stepIdx}-${note.slot}-${ni}`}
                              onMouseDown={(e) => {
                                if (e.button !== 0) return;
                                e.stopPropagation();
                                // In ERASE mode a left-click anywhere on
                                // the note (head, sustain tail, even on top
                                // of the resize handle if it leaks through)
                                // deletes the whole note. No drag, no
                                // resize, no second-guessing — same model
                                // as FL Studio's eraser tool.
                                if (pianoRollTool === 'erase') {
                                  deleteNote(stepIdx, note);
                                  return;
                                }
                                beginDrag(stepIdx, note, e.clientX, e.clientY);
                              }}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                deleteNote(stepIdx, note);
                              }}
                              title={pianoRollTool === 'erase'
                                ? `ERASE — click to delete this note`
                                : `STEP ${stepIdx + 1} · ${cbPianoMidiToNoteName((stepDataArray[stepIdx]?.bassRootMidi ?? bassRootMidi) + row.offset)} (${row.label}) · sub-slot ${note.slot + 1} — LEFT-drag = move (across steps too) · drag GOLDEN BAR = resize · RIGHT-click = delete`}
                              style={{
                                position: 'absolute',
                                top: 1,
                                bottom: 1,
                                left: `${(stepIdx * 8 + note.slot) * colPct}%`,
                                width: `${note.sustainSlots * colPct}%`,
                                // When erase is active the note picks up a
                                // red tint so the user can see "this is the
                                // delete target" at a glance — eliminates
                                // the "did my click register?" doubt that
                                // tiny 16th-note bars create.
                                // Notes are SOLID GREEN at rest — clearly
                                // visible, editable without needing playback
                                // to "light them up". Playing now = brighter
                                // green + outer glow. Selected = cyan ring.
                                // Erase = red. Stacking order: erase > select
                                // > playing > default (intent beats feedback).
                                background: pianoRollTool === 'erase'
                                  ? '#fca5a5'
                                  : isPlayingNow
                                  ? '#bef264'
                                  : '#4ade80',
                                border: pianoRollTool === 'erase'
                                  ? '2px solid #dc2626'
                                  : isSelected
                                  ? '2px solid #22d3ee'
                                  : isPlayingNow
                                  ? '2px solid #84cc16'
                                  : '2px solid #16a34a',
                                borderRadius: 3,
                                boxShadow: pianoRollTool === 'erase'
                                  ? 'inset 4px 0 0 #7f1d1d'
                                  : isSelected
                                  ? 'inset 4px 0 0 #0e7490, 0 0 6px rgba(34, 211, 238, 0.7)'
                                  : isPlayingNow
                                  ? 'inset 4px 0 0 #166534, 0 0 12px rgba(190, 242, 100, 0.85)'
                                  : 'inset 4px 0 0 #14532d',
                                cursor: pianoRollTool === 'erase' ? 'not-allowed' : 'grab',
                                opacity: isBeingDragged ? 0.35 : 1,
                                pointerEvents: isAnyInteraction ? 'none' : 'auto',
                                zIndex: 3,
                                boxSizing: 'border-box',
                                display: 'flex',
                                alignItems: 'stretch',
                                justifyContent: 'flex-end',
                              }}
                            >
                              {/* GOLDEN BAR resize handle (right edge) */}
                              <span
                                onMouseDown={(e) => {
                                  if (e.button !== 0) return;
                                  e.stopPropagation();
                                  e.preventDefault();
                                  // In ERASE mode the handle inherits the
                                  // delete behaviour — anywhere on the note
                                  // is a delete target while the eraser is
                                  // active.
                                  if (pianoRollTool === 'erase') {
                                    deleteNote(stepIdx, note);
                                    return;
                                  }
                                  beginResize(stepIdx, note);
                                }}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  deleteNote(stepIdx, note);
                                }}
                                title={pianoRollTool === 'erase'
                                  ? 'ERASE — click to delete'
                                  : 'Drag to resize — 1 sub-slot precision (16th-note) · hold ALT for quarter-note snap'}
                                style={{
                                  width: 12,
                                  cursor: pianoRollTool === 'erase' ? 'not-allowed' : 'ew-resize',
                                  background: pianoRollTool === 'erase'
                                    ? 'linear-gradient(to right, transparent 0%, rgba(127, 29, 29, 0.6) 50%, #dc2626 100%)'
                                    : 'linear-gradient(to right, transparent 0%, rgba(20, 83, 45, 0.5) 50%, #bef264 100%)',
                                  borderRight: pianoRollTool === 'erase'
                                    ? '3px solid #dc2626'
                                    : '3px solid #bef264',
                                  borderTopRightRadius: 3,
                                  borderBottomRightRadius: 3,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'flex-end',
                                  paddingRight: 2,
                                  pointerEvents: isAnyInteraction ? 'none' : 'auto',
                                }}
                              >
                                <span style={{
                                  display: 'inline-flex',
                                  flexDirection: 'column',
                                  gap: 1,
                                  pointerEvents: 'none',
                                }}>
                                  <span style={{ width: 4, height: 1, background: '#14532d', borderRadius: 1 }} />
                                  <span style={{ width: 4, height: 1, background: '#14532d', borderRadius: 1 }} />
                                  <span style={{ width: 4, height: 1, background: '#14532d', borderRadius: 1 }} />
                                </span>
                              </span>
                            </div>
                          );
                        })}

                        {/* ── DRAG PREVIEW (new drop position) ── */}
                        {dragHere && drag && (
                          <div
                            style={{
                              position: 'absolute',
                              top: 1,
                              bottom: 1,
                              left: `${dragLeftPct}%`,
                              width: `${dragWidthPct}%`,
                              background: '#86efac',
                              border: '2px solid #22c55e',
                              borderRadius: 3,
                              boxShadow: 'inset 4px 0 0 #14532d, 0 0 10px rgba(134, 239, 172, 0.7)',
                              pointerEvents: 'none',
                              zIndex: 5,
                              boxSizing: 'border-box',
                            }}
                          />
                        )}

                        {/* ── RESIZE PREVIEW (new note length) ── */}
                        {resizeHere && rz && (
                          <div
                            style={{
                              position: 'absolute',
                              top: 1,
                              bottom: 1,
                              left: `${rzLeftPct}%`,
                              width: `${rzWidthPct}%`,
                              background: '#86efac',
                              border: '2px solid #22c55e',
                              borderRadius: 3,
                              boxShadow: 'inset 4px 0 0 #14532d, 0 0 8px rgba(134, 239, 172, 0.6)',
                              pointerEvents: 'none',
                              zIndex: 5,
                              boxSizing: 'border-box',
                            }}
                          />
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexShrink: 0 }}>
                      <div
                        style={{
                          width: 52,
                          flexShrink: 0,
                          position: 'sticky',
                          left: 0,
                          zIndex: 6,
                          height: VEL_SUBROW_H,
                          background: '#050507',
                          borderRight: `1px solid ${CB_PIANO_MINT_BORDER}`,
                          boxSizing: 'border-box',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          paddingRight: 4,
                        }}
                        title={`Velocity — ${cbPianoMidiToNoteName(railMidi)} · ${row.label}`}
                      >
                        {row.offset === 12 ? (
                          <span style={{ fontSize: 7, color: '#6b7280', fontWeight: 900, lineHeight: 1 }}>VEL</span>
                        ) : null}
                      </div>
                      <div
                        data-velocity-lane
                        style={{
                          flex: '0 0 auto',
                          position: 'relative',
                          display: 'grid',
                          gridTemplateColumns: `repeat(${totalCols}, minmax(22px, 1fr))`,
                          gap: 0,
                          height: VEL_SUBROW_H,
                        }}
                      >
                        {Array.from({ length: totalCols }).map((_, c) => {
                          const slotInStep = c % 8;
                          const stepIdx = Math.floor(c / 8);
                          const isOnBeat = slotInStep % 2 === 0;
                          const isStepStart = slotInStep === 0;
                          return (
                            <div
                              key={`vel-bg-${row.offset}-${c}`}
                              style={{
                                background: isOnBeat ? '#080a10' : '#06070a',
                                borderLeft: isStepStart && stepIdx > 0
                                  ? '2px solid #1a2438'
                                  : isOnBeat
                                  ? '1px solid #1a1812'
                                  : '1px solid #0a0a0a',
                                borderRight: c === totalCols - 1 ? '1px solid #1a2438' : 'none',
                              }}
                            />
                          );
                        })}
                        <div style={{
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          top: '50%',
                          height: 1,
                          background: 'rgba(107, 114, 128, 0.2)',
                          pointerEvents: 'none',
                        }} />
                        {rowVelBars.map(({ stepIdx, note, isGhost }, bi) => {
                          const leftPct = (stepIdx * 8 + note.slot) * colPct;
                          const widthPct = note.sustainSlots * colPct;
                          const heightPct = Math.max(28, Math.min(100, note.vel * 100));
                          const isErase = pianoRollTool === 'erase' && !isGhost;
                          const isBarPlaying = false;
                          const velNoteName = cbPianoMidiToNoteName(
                            (stepDataArray[stepIdx]?.bassRootMidi ?? bassRootMidi) + note.midiOffset,
                          );
                          return (
                            <div
                              key={`vel-bar-${row.offset}-${stepIdx}-${bi}-${isGhost ? 'g' : 'n'}`}
                              onMouseDown={(e) => {
                                if (e.button !== 0) return;
                                if (isGhost) return;
                                e.stopPropagation();
                                e.preventDefault();
                                if (pianoRollTool === 'erase') {
                                  deleteNote(stepIdx, note);
                                  return;
                                }
                                velocityDragRef.current = {
                                  step: stepIdx,
                                  slot: note.slot,
                                  midiOffset: note.midiOffset,
                                };
                                bumpDragTick();
                                const laneEl = (e.currentTarget as HTMLElement).parentElement as HTMLElement | null;
                                if (!laneEl) return;
                                const applyFromY = (clientY: number) => {
                                  const rect = laneEl.getBoundingClientRect();
                                  const y = clientY - rect.top;
                                  const newVel = Math.max(
                                    0.05,
                                    Math.min(1.0, 1 - (y / Math.max(1, rect.height))),
                                  );
                                  setBassCustomPatterns((prev) => {
                                    const v = velocityDragRef.current;
                                    if (!v) return prev;
                                    const hits = prev[v.step] ?? [];
                                    const next = hits.map((h) =>
                                      (h.slot === v.slot && h.midiOffset === v.midiOffset)
                                        ? { ...h, vel: newVel }
                                        : h,
                                    );
                                    const out = { ...prev };
                                    out[v.step] = next;
                                    return out;
                                  });
                                };
                                applyFromY(e.clientY);
                                const onMove = (ev: MouseEvent) => {
                                  if (!velocityDragRef.current) return;
                                  applyFromY(ev.clientY);
                                };
                                const onUp = () => {
                                  window.removeEventListener('mousemove', onMove);
                                  window.removeEventListener('mouseup', onUp);
                                  velocityDragRef.current = null;
                                  bumpDragTick();
                                };
                                window.addEventListener('mousemove', onMove);
                                window.addEventListener('mouseup', onUp);
                              }}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (!isGhost) deleteNote(stepIdx, note);
                              }}
                              title={isGhost
                                ? `${velNoteName} · ghost vel ${Math.round(note.vel * 127)} — TAKE OVER to edit`
                                : `${velNoteName} · STEP ${stepIdx + 1} · vel ${Math.round(note.vel * 127)} — drag up/down · right-click = delete`}
                              style={{
                                position: 'absolute',
                                bottom: 0,
                                left: `${leftPct}%`,
                                width: `${widthPct}%`,
                                height: `${heightPct}%`,
                                background: isGhost
                                  ? (isBarPlaying
                                    ? 'linear-gradient(to top, #166534, #86efac)'
                                    : 'linear-gradient(to top, #14532d, #22c55e99)')
                                  : isErase
                                  ? '#dc2626'
                                  : isBarPlaying
                                  ? 'linear-gradient(to top, #22c55e, #bef264)'
                                  : 'linear-gradient(to top, #16a34a, #4ade80)',
                                border: isGhost
                                  ? (isBarPlaying ? '1px dashed #84cc16' : '1px dashed #15803d')
                                  : isErase
                                  ? '1px solid #7f1d1d'
                                  : isBarPlaying
                                  ? '1px solid #166534'
                                  : '1px solid #14532d',
                                opacity: isGhost ? 0.85 : 1,
                                boxShadow: !isGhost && !isErase && isBarPlaying
                                  ? '0 0 8px rgba(190, 242, 100, 0.7)'
                                  : undefined,
                                borderTopLeftRadius: 2,
                                borderTopRightRadius: 2,
                                cursor: isGhost
                                  ? 'not-allowed'
                                  : isErase
                                  ? 'not-allowed'
                                  : 'ns-resize',
                                boxSizing: 'border-box',
                                pointerEvents: 'auto',
                              }}
                            >
                              {!isGhost && (
                                <div style={{
                                  position: 'absolute',
                                  top: 0,
                                  left: 0,
                                  right: 0,
                                  height: 2,
                                  background: isErase ? '#fca5a5' : '#bbf7d0',
                                  pointerEvents: 'none',
                                }} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    </Fragment>
                  );
                })}

                <div
                  ref={chordSeqBassPlaylineRef}
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 52,
                    width: 2,
                    height: '100%',
                    marginLeft: -1,
                    borderRadius: 1,
                    background: CB_PIANO_MINT,
                    boxShadow: '0 0 8px rgba(124,244,198,0.55)',
                    zIndex: 15,
                    pointerEvents: 'none',
                    opacity: 0,
                    willChange: 'transform',
                  }}
                />
              </div>
              </div>

              <div style={{ marginTop: 6, fontSize: 9, color: '#9ca3af', display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ display: 'inline-block', width: 14, height: 12, background: '#0c1820', border: '1px solid #22d3ee44', borderRadius: 2 }} />
                  <span style={{ color: '#a5f3fc', fontWeight: 700 }}>STEP HEADER</span>
                  <span style={{ color: '#6b7280' }}>
                    third line = full chord voicing (every note). Columns use each step’s own bass root — left keys match the <strong style={{ color: '#fde68a' }}>focused</strong> step; hover cells for pitch per bar.
                  </span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ display: 'inline-block', width: 14, height: 12, background: '#4ade80', border: '2px solid #16a34a', borderRadius: 2, boxShadow: 'inset 3px 0 0 #14532d' }} />
                  <span style={{ color: '#4ade80', fontWeight: 700 }}>YOUR NOTE</span>
                  <span style={{ color: '#6b7280' }}>
                    (<strong style={{ color: '#22d3ee' }}>CLICK</strong> = select for octave/velocity · <strong style={{ color: '#4ade80' }}>DRAG</strong> = move across bars · <strong style={{ color: '#f87171' }}>RIGHT-click</strong> = delete)
                  </span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{
                    display: 'inline-block',
                    width: 12,
                    height: 12,
                    background: '#4ade80',
                    border: '2px solid #22d3ee',
                    borderRadius: 2,
                    boxShadow: '0 0 4px rgba(34, 211, 238, 0.6)',
                  }} />
                  <span style={{ color: '#22d3ee', fontWeight: 700 }}>SELECTED</span>
                  <span style={{ color: '#6b7280' }}>
                    (cyan ring · use the OCTAVE / VEL controls at the top to fine-tune)
                  </span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{
                    display: 'inline-block',
                    width: 12,
                    height: 12,
                    background: '#86efac',
                    border: '2px solid #22c55e',
                    borderRadius: 2,
                    boxShadow: '0 0 6px rgba(34, 197, 94, 0.7)',
                  }} />
                  <span style={{ color: '#22c55e', fontWeight: 700 }}>PLAYING NOW</span>
                  <span style={{ color: '#6b7280' }}>
                    (green glow · whatever step the sequencer is sounding right now turns green so you can see what you hear · <strong style={{ color: CB_PIANO_MINT }}>mint line</strong> = smooth playhead, same idea as 808 Lab roll)
                  </span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  {/* Tiny preview of the golden resize handle so the legend
                      teaches the user what to look for in the grid. */}
                  <span style={{
                    display: 'inline-block',
                    width: 6,
                    height: 12,
                    background: 'linear-gradient(to right, rgba(20, 83, 45, 0.5), #bef264)',
                    borderRight: '2px solid #bef264',
                    borderRadius: 2,
                  }} />
                  <span style={{ color: '#bef264', fontWeight: 700 }}>RESIZE HANDLE</span>
                  <span style={{ color: '#6b7280' }}>
                    (drag = resize · 1/16-note precision by default · hold <strong style={{ color: '#9ca3af' }}>ALT</strong> for quarter-note snap)
                  </span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ display: 'inline-block', width: 14, height: 12, background: '#22c55e99', border: '1px dashed #15803d', borderRadius: 2, boxShadow: 'inset 2px 0 0 #14532d', opacity: 0.85 }} />
                  <span style={{ color: '#9ca3af', fontWeight: 700 }}>PATTERN GHOST</span>
                  <span style={{ color: '#6b7280' }}>(preview only · press <strong style={{ color: '#34d399' }}>TAKE OVER PATTERN</strong> to edit, or click any empty cell to start fresh)</span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{
                    display: 'inline-block',
                    width: 14,
                    height: 12,
                    background: '#fca5a5',
                    border: '2px solid #dc2626',
                    borderRadius: 2,
                    boxShadow: 'inset 3px 0 0 #7f1d1d',
                  }} />
                  <span style={{ color: '#fca5a5', fontWeight: 700 }}>ERASE TOOL</span>
                  <span style={{ color: '#6b7280' }}>
                    (click <strong style={{ color: '#fca5a5' }}>⌫ ERASE</strong> in toolbar, then click any note — works on tiny 16ths where right-click is fiddly)
                  </span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{
                    display: 'inline-block',
                    width: 14,
                    height: 12,
                    background: 'radial-gradient(circle, #4ade80 0%, #052e1c 80%)',
                    border: '1px solid #22c55e66',
                    borderRadius: 2,
                  }} />
                  <span style={{ color: '#86efac', fontWeight: 700 }}>AUTO-SCROLL</span>
                  <span style={{ color: '#6b7280' }}>
                    (toggle in the BASS LINE row · keeps the playhead centered during playback so the playing step never runs off-screen)
                  </span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{
                    display: 'inline-block',
                    width: 14,
                    height: 12,
                    background: 'linear-gradient(135deg, #14532d, #4ade80)',
                    border: '1px solid #22c55e66',
                    borderRadius: 2,
                  }} />
                  <span style={{ color: '#86efac', fontWeight: 700 }}>COPY/PASTE LINE</span>
                  <span style={{ color: '#6b7280' }}>
                    (<strong style={{ color: '#86efac' }}>⎘ COPY LINE</strong> snapshots every painted step · <strong style={{ color: '#86efac' }}>📋 PASTE LINE</strong> restores it — different from the per-step COPY/PASTE in the top toolbar)
                  </span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{
                    display: 'inline-block',
                    width: 14,
                    height: 12,
                    background: '#1a1130',
                    border: '1px solid #fbbf24',
                    borderRadius: 2,
                    color: '#fde68a',
                    fontWeight: 900,
                    fontSize: 8,
                    textAlign: 'center',
                    lineHeight: '10px',
                  }}>★</span>
                  <span style={{ color: '#fcd34d', fontWeight: 700 }}>SAVE LINE → SLOT</span>
                  <span style={{ color: '#6b7280' }}>
                    (saves the current bass kit AND painted line into one of the 8 slots · slots with a saved line show a <span style={{ color: '#4ade80', fontWeight: 900 }}>♪</span> badge · loading restores everything)
                  </span>
                </span>
                <span style={{ color: '#4b5563', fontSize: 8 }}>Yellow row = chord root · Cyan rows = chord tones · CLEAR returns step to following the pattern.</span>
              </div>
            </div>
            </>
          );
        })()}
      </div>
      </div>

      </div>
      </div>

      <div style={{ flexShrink: 0, marginTop: 0, padding: 0, background: '#060606', borderTop: '1px solid #1a1a1a' }}>
        <BottomKeyboard
          notes={shiftedNotes(
            // During a song preview the keyboard follows the currently-sounding
            // chord; otherwise it shows the user's selected pad.
            previewHighlightPadIdx >= 0 && pads[previewHighlightPadIdx]
              ? pads[previewHighlightPadIdx]!.notes
              : selPad?.notes ?? [],
          )}
        />
      </div>

      <div style={{ flexShrink: 0, borderTop: '1px solid #111', padding: '3px 10px', fontSize: 9, color: '#4b5563', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span>Chord/Bass Seq · {KEY_LABELS[keyRoot]} {mode} · {genreProfile.label} · {stepCount} steps</span>
        {playing && <span style={{ color: '#22c55e', fontWeight: 800 }}>PLAYING</span>}
      </div>

      {padPickerOpen && onExportToPad && (
        <div style={{ position: 'absolute', right: 12, top: 44, zIndex: 80, background: '#111', border: '1px solid #262626', borderRadius: 9, padding: 10, width: 190 }}>
          <div style={{ fontSize: 9, color: '#6b7280', marginBottom: 6, fontWeight: 800 }}>EXPORT TO PAD</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4 }}>
            {Array.from({ length: 16 }, (_, i) => (
              <button key={`export-${i}`} onClick={() => { setPadPickerOpen(false); void handleExport(i); }} style={{ background: '#1a1a1a', color: '#22c55e', border: '1px solid #1f3a29', borderRadius: 5, padding: '5px 0', fontWeight: 800, fontSize: 10, cursor: 'pointer' }}>{i + 1}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
