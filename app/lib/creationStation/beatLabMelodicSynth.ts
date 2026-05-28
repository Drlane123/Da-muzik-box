/**
 * MIDI SYNTH view — vertical pitch piano roll for channels 17–32.
 */
import type { BeatLabMidiNote } from './beatLabMidiRoll';
import { beatLabMelodicLanePitch } from './beatLabMidiRoll';

export const BEAT_LAB_SYNTH_SEMITONES = 48;
export const BEAT_LAB_SYNTH_ROW_H = 16;
export const BEAT_LAB_SYNTH_KEY_W = 54;
export const BEAT_LAB_SYNTH_RAIL_W = 108;
/** Sticky time ruler above the pitch grid (one row — same as Beat Lab ROLL). */
export const BEAT_LAB_SYNTH_RULER_H = 16;
export const BEAT_LAB_SYNTH_HEADER_H = BEAT_LAB_SYNTH_RULER_H;
/** @deprecated Single-row ruler; kept for imports. */
export const BEAT_LAB_SYNTH_MEASURES_ROW_H = BEAT_LAB_SYNTH_RULER_H;
export const BEAT_LAB_SYNTH_TIME_RULER_H = BEAT_LAB_SYNTH_RULER_H;

/** Top row = highest MIDI note for this channel's keyboard window. */
export function beatLabSynthTopMidi(lane: number): number {
  const base = beatLabMelodicLanePitch(lane);
  return base + Math.floor(BEAT_LAB_SYNTH_SEMITONES / 2);
}

export function beatLabSynthMidiForRow(lane: number, row: number): number {
  return beatLabSynthTopMidi(lane) - row;
}

export function beatLabSynthRowForMidi(lane: number, midi: number): number {
  return beatLabSynthTopMidi(lane) - midi;
}

export function beatLabPitchSemiForMidi(lane: number, midi: number): number {
  const base = beatLabMelodicLanePitch(lane);
  return Math.max(-24, Math.min(24, Math.round(midi - base)));
}

export function beatLabNoteMidi(lane: number, note: BeatLabMidiNote): number {
  return beatLabMelodicLanePitch(lane) + (note.pitchSemi ?? 0);
}

export function beatLabNoteAtCell(
  notes: BeatLabMidiNote[],
  lane: number,
  col: number,
  midi: number,
): BeatLabMidiNote | undefined {
  const semi = beatLabPitchSemiForMidi(lane, midi);
  return notes.find(
    (n) => n.lane === lane && n.col === col && (n.pitchSemi ?? 0) === semi,
  );
}

/** Note whose body covers this grid cell (head or sustain tail). */
export function beatLabNoteSpansCell(
  notes: BeatLabMidiNote[],
  lane: number,
  col: number,
  midi: number,
): BeatLabMidiNote | undefined {
  const semi = beatLabPitchSemiForMidi(lane, midi);
  return notes.find((n) => {
    if (n.lane !== lane || (n.pitchSemi ?? 0) !== semi) return false;
    const len = Math.max(1, n.len);
    return col >= n.col && col < n.col + len;
  });
}

export function beatLabNoteHeadAtCell(
  notes: BeatLabMidiNote[],
  lane: number,
  col: number,
): BeatLabMidiNote | undefined {
  return notes.find((n) => n.lane === lane && n.col === col);
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function beatLabSynthKeyLabel(midi: number): string {
  const name = NOTE_NAMES[((midi % 12) + 12) % 12]!;
  const oct = Math.floor(midi / 12) - 1;
  return `${name}${oct}`;
}

export function beatLabSynthIsBlackKey(midi: number): boolean {
  const m = ((midi % 12) + 12) % 12;
  return m === 1 || m === 3 || m === 6 || m === 8 || m === 10;
}

/** Grid note-lane fill — strong contrast between white/black keys (matches drum grid readability). */
export function beatLabSynthRowGridBg(midi: number, row: number): string {
  if (beatLabSynthIsBlackKey(midi)) return '#0c0e18';
  return row % 2 === 0 ? '#161e32' : '#111828';
}

/** Piano-key column fill — aligned with grid row so each lane reads as one horizontal band. */
export function beatLabSynthRowKeyBg(midi: number, row: number): string {
  if (beatLabSynthIsBlackKey(midi)) return '#1a1c28';
  return row % 2 === 0 ? '#d8dce8' : '#c8cedc';
}
