/**
 * Orchid ORC-1–style chord language: stackable type + extensions, voicing
 * inversions, and BPM-aware performance timing for the Chord/Bass Sequencer.
 */

import { scheduleChordNote, type ChordVoiceId } from '@/app/lib/creationStation/chordSequencerVoices';
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import {
  grooveLabClampBassRootMidi,
  grooveLabLiftChordsAboveBass,
} from '@/app/lib/creationStation/grooveLabPitch';

export type OrchidChordType = 'maj' | 'min' | 'sus' | 'dim';

export type OrchidExtension = '6' | 'M7' | 'm7' | '9';

/** Matches Telepathic Orchid performance modes (Block = simultaneous). */
export type OrchidPerformanceMode =
  | 'block'
  | 'strum'
  | 'slop'
  | 'arp'
  | 'pattern'
  | 'harp';

export interface OrchidChordPerformOpts {
  mode: OrchidPerformanceMode;
  /** Used for arp / pattern / harp step spacing. */
  bpm?: number;
  /** 0..1 humanize amount for slop. */
  slopAmount?: number;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

const TRIAD: Record<OrchidChordType, number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  sus: [0, 5, 7],
  dim: [0, 3, 6],
};

const EXT_INTERVALS: Record<OrchidExtension, number> = {
  '6': 9,
  M7: 11,
  m7: 10,
  '9': 14,
};

/** Major-scale degree roots (MIDI) in the active key — Orchid “key mode” roots. */
const MAJOR_DEGREE_SEMITONES = [0, 2, 4, 5, 7, 9, 11];
const MINOR_DEGREE_SEMITONES = [0, 2, 3, 5, 7, 8, 10];

export const ORCHID_CHORD_TYPES: { id: OrchidChordType; label: string }[] = [
  { id: 'maj', label: 'MAJ' },
  { id: 'min', label: 'MIN' },
  { id: 'sus', label: 'SUS' },
  { id: 'dim', label: 'DIM' },
];

export const ORCHID_EXTENSIONS: { id: OrchidExtension; label: string }[] = [
  { id: '6', label: '6' },
  { id: 'M7', label: 'M7' },
  { id: 'm7', label: 'm7' },
  { id: '9', label: '9' },
];

export const ORCHID_PERF_MODES: { id: OrchidPerformanceMode; label: string; hint: string }[] = [
  { id: 'block', label: 'BLOCK', hint: 'All notes together' },
  { id: 'strum', label: 'STRUM', hint: 'Low→high roll (Orchid strum)' },
  { id: 'slop', label: 'SLOP', hint: 'Loose, humanized attack times' },
  { id: 'arp', label: 'ARP', hint: '16th-note arpeggio through the chord' },
  { id: 'pattern', label: 'PAT', hint: 'Up–down pattern within the step' },
  { id: 'harp', label: 'HARP', hint: 'Fast harp-like plucks' },
];

/** Build pitch classes (intervals from root) for type + stacked extensions. */
export function buildOrchidIntervals(
  type: OrchidChordType,
  extensions: ReadonlySet<OrchidExtension>,
): number[] {
  const raw: number[] = [...TRIAD[type]];
  for (const ext of extensions) raw.push(EXT_INTERVALS[ext]);
  return Array.from(new Set(raw)).sort((a, b) => a - b);
}

export function buildOrchidNotes(
  rootMidi: number,
  type: OrchidChordType,
  extensions: ReadonlySet<OrchidExtension>,
  inversion = 0,
  baseOctave = 4,
): number[] {
  const intervals = buildOrchidIntervals(type, extensions);
  const root = (baseOctave + 1) * 12 + (rootMidi % 12);
  let notes = intervals.map((iv) => root + iv).sort((a, b) => a - b);
  notes = applyInversion(notes, inversion);
  return Array.from(new Set(notes))
    .filter((n) => n >= 36 && n <= 92)
    .sort((a, b) => a - b);
}

const ORCHID_CHORD_ROLL_MIN_MIDI = 60;

/** Rotate lowest note up an octave — Orchid voicing dial. */
export function applyInversion(notes: number[], inversion: number): number[] {
  if (notes.length === 0) return notes;
  const sorted = [...notes].sort((a, b) => a - b);
  const steps = ((inversion % sorted.length) + sorted.length) % sorted.length;
  let out = sorted;
  for (let i = 0; i < steps; i++) {
    const lowest = out[0]!;
    out = [...out.slice(1), lowest + 12].sort((a, b) => a - b);
  }
  return out.filter((n) => n <= 96);
}

export function formatOrchidChordName(
  rootMidi: number,
  type: OrchidChordType,
  extensions: ReadonlySet<OrchidExtension>,
): string {
  const rootName = NOTE_NAMES[rootMidi % 12] ?? 'C';
  const typeSuffix =
    type === 'maj' ? '' : type === 'min' ? 'm' : type === 'sus' ? 'sus4' : '°';
  const extParts: string[] = [];
  if (extensions.has('6')) extParts.push('6');
  if (extensions.has('M7')) extParts.push('maj7');
  else if (extensions.has('m7')) extParts.push('m7');
  if (extensions.has('9')) extParts.push('9');
  const extStr = extParts.join('');
  if (type === 'dim' && extStr) return `${rootName}°${extStr}`;
  return `${rootName}${typeSuffix}${extStr}`;
}

export function getDiatonicRootsInKey(keyRoot: number, mode: ChordMode, baseOctave = 4): number[] {
  const base = (baseOctave + 1) * 12 + keyRoot;
  const degrees = mode === 'minor' ? MINOR_DEGREE_SEMITONES : MAJOR_DEGREE_SEMITONES;
  return degrees.map((s) => base + s);
}

/** Triad quality per scale degree (major / natural minor). */
const MAJOR_DEGREE_TYPE: OrchidChordType[] = ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim'];
const MINOR_DEGREE_TYPE: OrchidChordType[] = ['min', 'dim', 'maj', 'min', 'min', 'maj', 'maj'];

/** Map a bass root pitch class to the diatonic chord type in the active key. */
export function diatonicOrchidTypeForRootPc(
  rootPc: number,
  keyRoot: number,
  mode: ChordMode,
): OrchidChordType {
  const interval = ((rootPc - keyRoot) % 12 + 12) % 12;
  const degrees = mode === 'minor' ? MINOR_DEGREE_SEMITONES : MAJOR_DEGREE_SEMITONES;
  const types = mode === 'minor' ? MINOR_DEGREE_TYPE : MAJOR_DEGREE_TYPE;
  const idx = degrees.indexOf(interval);
  if (idx >= 0) return types[idx]!;
  return mode === 'minor' ? 'min' : 'maj';
}

/** Chord voicing stacked above the bass root (never same piano-row keys as the sub). */
export function buildOrchidNotesForBassRoot(
  bassMidi: number,
  type: OrchidChordType,
  extensions: ReadonlySet<OrchidExtension>,
  inversion: number,
): number[] {
  const bass = grooveLabClampBassRootMidi(bassMidi);
  const bassOct = Math.floor(bass / 12);
  /** Compact R&B stack ~1–2 octaves above the sub (C3–A4), not C5+. */
  const chordBaseOct = Math.max(3, bassOct + 1);
  const voiced = buildOrchidNotes(bass, type, extensions, inversion, chordBaseOct);
  return grooveLabLiftChordsAboveBass(bass, voiced);
}

export interface OrchidBassKeyDef {
  midi: number;
  label: string;
  isDiatonic: boolean;
  isBlack: boolean;
}

/** One chromatic octave of bass keys rooted on the song key (default octave 2). */
export function getOrchidBassKeypadLayout(
  keyRoot: number,
  mode: ChordMode,
  bassOctave = 2,
): OrchidBassKeyDef[] {
  const base = (bassOctave + 1) * 12 + keyRoot;
  const degrees = mode === 'minor' ? MINOR_DEGREE_SEMITONES : MAJOR_DEGREE_SEMITONES;
  const diatonicPcs = new Set(degrees.map((s) => (keyRoot + s) % 12));
  const black = new Set([1, 3, 6, 8, 10]);
  return Array.from({ length: 12 }, (_, i) => {
    const midi = base + i;
    const pc = midi % 12;
    return {
      midi,
      label: NOTE_NAMES[pc] ?? '?',
      isDiatonic: diatonicPcs.has(pc),
      isBlack: black.has(pc),
    };
  });
}

function seededJitter(seed: number, amount: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return (x - Math.floor(x) - 0.5) * 2 * amount;
}

/** Relative note-on offsets (seconds after chord `start`) for each sorted voice. */
export function orchidNoteOnsets(
  noteCount: number,
  sustain: number,
  opts: OrchidChordPerformOpts,
): number[] {
  const mode = opts.mode;
  const bpm = Math.max(40, opts.bpm ?? 120);
  const beat = 60 / bpm;
  const sixteenth = beat / 4;

  if (mode === 'block') {
    return Array.from({ length: noteCount }, () => 0);
  }

  if (mode === 'strum') {
    const step = Math.min(0.042, Math.max(0.014, sustain * 0.12 / Math.max(1, noteCount - 1)));
    return Array.from({ length: noteCount }, (_, i) => i * step);
  }

  if (mode === 'slop') {
    const amt = (opts.slopAmount ?? 0.65) * 0.028;
    return Array.from({ length: noteCount }, (_, i) => seededJitter(i + noteCount * 7, amt));
  }

  if (mode === 'arp') {
    return Array.from({ length: noteCount }, (_, i) => i * sixteenth * 0.9);
  }

  if (mode === 'pattern') {
    const order: number[] = [];
    for (let i = 0; i < noteCount; i++) order.push(i);
    for (let i = noteCount - 2; i > 0; i--) order.push(i);
    const strikes = order.slice(0, noteCount);
    return strikes.map((_, i) => i * sixteenth * 0.75);
  }

  // harp — faster than arp, shorter spacing
  return Array.from({ length: noteCount }, (_, i) => i * sixteenth * 0.45);
}

/** Schedule chord with Orchid performance shaping. */
export function scheduleOrchidChord(
  ctx: AudioContext | OfflineAudioContext,
  notes: number[],
  start: number,
  sustain: number,
  voice: ChordVoiceId,
  masterVelocity = 0.76,
  opts?: OrchidChordPerformOpts,
): void {
  if (notes.length === 0) return;
  const sorted = [...notes].sort((a, b) => a - b);
  const mode = opts?.mode ?? 'block';
  const onsets = orchidNoteOnsets(sorted.length, sustain, { ...opts, mode });
  const perNoteSustain =
    mode === 'harp'
      ? Math.min(sustain * 0.35, 0.42)
      : mode === 'arp' || mode === 'pattern'
        ? Math.min(sustain * 0.55, 0.65)
        : sustain;

  sorted.forEach((midi, i) => {
    const noteStart = start + onsets[i]!;
    const vel = masterVelocity * (0.92 + (i / Math.max(1, sorted.length - 1)) * 0.1);
    scheduleChordNote(ctx, midi, noteStart, perNoteSustain, vel, voice);
  });
}
