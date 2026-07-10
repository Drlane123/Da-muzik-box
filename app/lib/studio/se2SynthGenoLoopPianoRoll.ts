/**
 * Synth Geno Loop Editor — piano roll layout helpers (chords first; melody/bass later).
 */
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';
import { genoMidiNoteName } from '@/app/lib/studio/se2SynthGenoPluginDisplay';

export const GENO_LOOP_PIANO_ROW_H_PX = 14;
export const GENO_LOOP_PIANO_KEY_W_PX = 56;
export const GENO_LOOP_PIANO_WHITE_KEY_W_PX = GENO_LOOP_PIANO_KEY_W_PX - 4;
export const GENO_LOOP_PIANO_BLACK_KEY_W_PX = Math.round(GENO_LOOP_PIANO_KEY_W_PX * 0.62);
export const GENO_LOOP_PIANO_RULER_H_PX = 22;

/** Piano-roll grid tokens — muted; bar/beat lines readable without competing with notes. */
export const GENO_LOOP_PIANO_GRID = {
  rowWhite: '#0c0c10',
  rowBlack: '#08080c',
  rowBorder: 'rgba(255,255,255,0.028)',
  rowBorderC: 'rgba(255,255,255,0.058)',
  barLine: 'rgba(255,255,255,0.058)',
  beatLine: 'rgba(255,255,255,0.028)',
  barFillA: 'rgba(255,255,255,0.016)',
  barFillB: 'transparent',
} as const;

export type GenoLoopPianoRollNote = {
  id: string;
  pitch: number;
  startBeat: number;
  durationBeats: number;
  velocity: number;
  label: string;
};

export function genoLoopPianoRollNewNoteId(): string {
  return `n-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** MIDI pitches sounding at `beat` (loop-local beat). */
export function genoLoopPianoRollMidisAtBeat(
  notes: readonly Pick<GenoLoopPianoRollNote, 'pitch' | 'startBeat' | 'durationBeats'>[],
  beat: number,
): number[] {
  const midis: number[] = [];
  for (const n of notes) {
    const end = n.startBeat + n.durationBeats;
    if (beat >= n.startBeat - 1e-6 && beat < end - 1e-6) {
      midis.push(Math.round(n.pitch));
    }
  }
  return [...new Set(midis)].sort((a, b) => a - b);
}

export function genoLoopPianoRollNotesToDraft(
  notes: readonly GenoLoopPianoRollNote[],
): StudioEditor2GenNote[] {
  return notes.map((n) => ({
    pitch: n.pitch,
    startBeat: n.startBeat,
    durationBeats: n.durationBeats,
    velocity: n.velocity,
  }));
}

export function genoLoopPianoSnapBeat(beat: number, snapBeats: number): number {
  if (snapBeats <= 0) return beat;
  return Math.round(beat / snapBeats) * snapBeats;
}

export function genoLoopPianoDefaultSnapBeats(beatsPerBar: number): number {
  return Math.max(0.0625, beatsPerBar / 16);
}

function genoLoopPianoNotesOverlap(
  aStart: number,
  aDur: number,
  bStart: number,
  bDur: number,
): boolean {
  const aEnd = aStart + aDur;
  const bEnd = bStart + bDur;
  return aStart < bEnd - 1e-6 && bStart < aEnd - 1e-6;
}

/** Place duplicate on the same pitch row — no overlap. Half-bar+ notes jump to the next bar. */
export function genoLoopPianoRollDuplicatePlacement(
  src: Pick<GenoLoopPianoRollNote, 'id' | 'pitch' | 'startBeat' | 'durationBeats'>,
  notes: readonly GenoLoopPianoRollNote[],
  snapBeats: number,
  totalBeats: number,
  beatsPerBar: number,
): { startBeat: number; pitch: number } {
  const pitch = src.pitch;
  const dur = Math.max(snapBeats, src.durationBeats);
  const endBeat = src.startBeat + dur;
  const halfBar = beatsPerBar / 2;

  let start: number;
  if (dur >= halfBar - 1e-6) {
    // Half bar or longer → duplicate at the next bar line (e.g. 2-beat note in 4/4 → bar 2).
    start = genoLoopPianoSnapBeat(Math.ceil(endBeat / beatsPerBar) * beatsPerBar, snapBeats);
  } else {
    // Shorter hits → tuck right after the note, snapped to grid.
    start = genoLoopPianoSnapBeat(endBeat, snapBeats);
    if (start < endBeat - 1e-6) start += snapBeats;
  }

  const maxStart = Math.max(0, totalBeats - snapBeats);
  while (start <= maxStart + 1e-6) {
    const blocked = notes.some(
      (n) =>
        n.id !== src.id
        && n.pitch === pitch
        && genoLoopPianoNotesOverlap(n.startBeat, n.durationBeats, start, dur),
    );
    if (!blocked) {
      return { startBeat: Math.min(start, maxStart), pitch };
    }
    if (dur >= halfBar - 1e-6) {
      start += beatsPerBar;
    } else {
      start += snapBeats;
    }
  }

  return { startBeat: Math.min(start, maxStart), pitch };
}

export function genoLoopPianoRollNotesFromDraft(
  notes: readonly StudioEditor2GenNote[],
): GenoLoopPianoRollNote[] {
  return notes.map((n, i) => ({
    id: `n-${i}-${n.pitch}-${n.startBeat.toFixed(3)}`,
    pitch: Math.round(n.pitch),
    startBeat: n.startBeat,
    durationBeats: Math.max(0.0625, n.durationBeats),
    velocity: n.velocity,
    label: genoMidiNoteName(n.pitch),
  }));
}

/** High pitch at top — one row per semitone; expands when notes sit outside [minMidi … maxMidi]. */
export function genoLoopPianoRollPitchRows(
  notes: readonly GenoLoopPianoRollNote[],
  minMidi: number,
  maxMidi: number,
  padSemitones = 2,
): number[] {
  let lo = minMidi;
  let hi = maxMidi;
  if (notes.length > 0) {
    const noteLo = Math.min(...notes.map((n) => n.pitch));
    const noteHi = Math.max(...notes.map((n) => n.pitch));
    lo = Math.min(lo, noteLo - padSemitones);
    hi = Math.max(hi, noteHi + padSemitones);
  }
  lo = Math.max(0, Math.min(127, lo));
  hi = Math.max(lo, Math.min(127, hi));
  const rows: number[] = [];
  for (let p = hi; p >= lo; p -= 1) rows.push(p);
  return rows.length > 0 ? rows : [minMidi];
}

export function genoLoopPianoRollGridHeightPx(rowCount: number): number {
  return Math.max(GENO_LOOP_PIANO_ROW_H_PX, rowCount * GENO_LOOP_PIANO_ROW_H_PX);
}

export function genoLoopPianoRollRowIndex(pitch: number, pitchRows: readonly number[]): number {
  const idx = pitchRows.indexOf(Math.round(pitch));
  return idx >= 0 ? idx : -1;
}

export function genoIsBlackPianoKey(midi: number): boolean {
  const pc = ((midi % 12) + 12) % 12;
  return pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10;
}

export function genoLoopPianoKeyLabel(midi: number): string {
  const name = genoMidiNoteName(midi);
  const pc = ((midi % 12) + 12) % 12;
  const isC = pc === 0;
  const isBlack = genoIsBlackPianoKey(midi);
  if (isC) return name;
  if (isBlack) return name.slice(0, 2);
  return name.charAt(0);
}
