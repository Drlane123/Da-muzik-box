/**
 * Explicit "Send roots → 808 Lab" payload — one command writes notes that
 * 808 Lab loads onto the piano roll (no live sync guessing).
 */
import {
  chordSymbolToRootMidi,
  coerceChordSymbolForMode,
  type ChordMode,
  type ChordSymbol,
} from '@/app/lib/creationStation/chordBuilder';
import { cbPianoNoteNameToMidi } from '@/app/lib/creationStation/chordBuilderPianoRollTheme';
import { chordSyncLoopLengthBeats, writeChordSync, type ChordSyncBlock } from '@/app/lib/chordBuilderSync';

/** Keep aligned with `MPC_BAR_LOOP_OPTIONS` in `EightZeroEightLabDrumMachine`. */
export const LAB808_MPC_LOOP_BAR_OPTIONS = [4, 8, 12, 16, 20, 24, 28, 32, 40, 48, 56, 64] as const;

export const LAB808_BEATS_PER_BAR = 4;

export const LAB808_ROOTS_IMPORTED_EVENT = 'da-808-lab-roots-imported';

export const LAB808_IMPORTED_ROOTS_STORAGE_KEY = 'da_808_lab_imported_roots_v1';

/** Default octave shift (applied before fitting into the visible roll band). */
export const LAB808_DEFAULT_ROOT_OCTAVE_SHIFT = -2;

/** Visible 808 Lab piano roll (C1–C6) — imported roots are octave-fitted here. */
export const LAB808_ROLL_MIN_MIDI = cbPianoNoteNameToMidi('C1');
export const LAB808_ROLL_MAX_MIDI = cbPianoNoteNameToMidi('C6');

/** Shift a pitch into the 808 roll band by whole octaves (same idea as Chord Builder voicing). */
export function fitMidiInto808Roll(
  midi: number,
  lowMidi = LAB808_ROLL_MIN_MIDI,
  highMidi = LAB808_ROLL_MAX_MIDI,
): number {
  let m = Math.max(0, Math.min(127, midi));
  while (m < lowMidi) m += 12;
  while (m > highMidi) m -= 12;
  return m;
}

const clampMidi = (m: number) => Math.max(0, Math.min(127, m));

/**
 * Octave-shift an entire progression together so every root stays in the 808
 * roll band without collapsing different scale degrees onto one pitch.
 */
export function fitProgressionRootsTo808Roll(
  rootMidis: number[],
  lowMidi = LAB808_ROLL_MIN_MIDI,
  highMidi = LAB808_ROLL_MAX_MIDI,
): number[] {
  if (rootMidis.length === 0) return [];
  for (let oct = -5; oct <= 5; oct++) {
    const shifted = rootMidis.map((m) => m + oct * 12);
    const min = Math.min(...shifted);
    const max = Math.max(...shifted);
    if (min >= lowMidi && max <= highMidi) {
      return shifted.map(clampMidi);
    }
  }
  return rootMidis.map((m) => clampMidi(fitMidiInto808Roll(m, lowMidi, highMidi)));
}

export type Lab808ImportedRootNote = {
  startBeat: number;
  midi: number;
  durBeats: number;
  chord: string;
};

export type Lab808ImportedRootsPayload = {
  savedAt: number;
  source: 'chord-builder' | 'chord-sequencer';
  progressionName: string;
  keyRoot: number;
  mode: string;
  bpm: number;
  octaveShift: number;
  notes: Lab808ImportedRootNote[];
};

export function build808RootNotesFromBlocks(
  blocks: ChordSyncBlock[],
  keyRoot: number,
  mode: ChordMode,
  octaveShift = LAB808_DEFAULT_ROOT_OCTAVE_SHIFT,
  hintMode?: ChordMode,
): Lab808ImportedRootNote[] {
  const raw: Array<{ startBeat: number; midi: number; durBeats: number; chord: string }> = [];
  let beat = 0;
  for (const block of blocks) {
    const dur = Math.max(1, block.durationBeats);
    const sym = coerceChordSymbolForMode(block.chord as ChordSymbol, mode, hintMode);
    const root = chordSymbolToRootMidi(sym, keyRoot, mode, 0);
    if (root != null) {
      raw.push({
        startBeat: beat,
        midi: root + octaveShift * 12,
        durBeats: dur,
        chord: sym,
      });
    }
    beat += dur;
  }
  if (raw.length === 0) return [];
  const fitted = fitProgressionRootsTo808Roll(raw.map((r) => r.midi));
  return raw.map((r, i) => ({
    startBeat: r.startBeat,
    midi: fitted[i]!,
    durBeats: r.durBeats,
    chord: r.chord,
  }));
}

export function sendRootsTo808Lab(
  input: Omit<Lab808ImportedRootsPayload, 'savedAt' | 'notes' | 'octaveShift'> & {
    blocks: ChordSyncBlock[];
    octaveShift?: number;
    hintMode?: ChordMode;
  },
): Lab808ImportedRootsPayload | null {
  const octaveShift = input.octaveShift ?? LAB808_DEFAULT_ROOT_OCTAVE_SHIFT;
  const notes = build808RootNotesFromBlocks(
    input.blocks,
    input.keyRoot,
    input.mode as ChordMode,
    octaveShift,
    input.hintMode,
  );
  if (notes.length === 0) return null;

  const payload: Lab808ImportedRootsPayload = {
    savedAt: Date.now(),
    source: input.source,
    progressionName: input.progressionName,
    keyRoot: input.keyRoot,
    mode: input.mode,
    bpm: input.bpm,
    octaveShift,
    notes,
  };

  try {
    localStorage.setItem(LAB808_IMPORTED_ROOTS_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota */
  }

  writeChordSync({
    keyRoot: input.keyRoot,
    mode: input.mode,
    blocks: notes.map((n) => ({ chord: n.chord, durationBeats: n.durBeats })),
    progressionName: input.progressionName,
    bpm: input.bpm,
  });

  window.dispatchEvent(new CustomEvent(LAB808_ROOTS_IMPORTED_EVENT));
  return payload;
}

export function read808LabImportedRoots(): Lab808ImportedRootsPayload | null {
  try {
    const raw = localStorage.getItem(LAB808_IMPORTED_ROOTS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Lab808ImportedRootsPayload>;
    if (!Array.isArray(parsed.notes) || parsed.notes.length === 0) return null;
    return parsed as Lab808ImportedRootsPayload;
  } catch {
    return null;
  }
}

export function manualRollNotesFrom808Import(
  payload: Lab808ImportedRootsPayload,
): Array<{ id: string; startBeat: number; midi: number; durBeats: number }> {
  const midis = fitProgressionRootsTo808Roll(payload.notes.map((n) => n.midi));
  return payload.notes.map((n, i) => ({
    id: `808-${payload.savedAt}-${i}`,
    startBeat: n.startBeat,
    midi: midis[i]!,
    durBeats: n.durBeats,
  }));
}

/** Octave label (C1 = 1) for a MIDI note — used to expand the roll keyboard range. */
export function midiTo808RollOctave(midi: number): number {
  return Math.floor(midi / 12) - 1;
}

/** Total loop length in quarter-note beats for 808 Lab transport (chords + roll notes). */
export function compute808LabLoopBeats(args: {
  syncBlocks?: ChordSyncBlock[] | null;
  manualNotes?: ReadonlyArray<{ startBeat: number; durBeats: number }>;
  minBeats?: number;
}): number {
  let beats = 0;
  if (args.syncBlocks?.length) {
    beats = Math.max(beats, chordSyncLoopLengthBeats(args.syncBlocks));
  }
  for (const n of args.manualNotes ?? []) {
    beats = Math.max(beats, n.startBeat + n.durBeats);
  }
  return Math.max(args.minBeats ?? LAB808_BEATS_PER_BAR * 4, beats);
}

/** Snap bar count to the MPC drum loop dropdown (4, 8, 12, …). */
export function snap808LabLoopBars(barCount: number): (typeof LAB808_MPC_LOOP_BAR_OPTIONS)[number] {
  const need = Math.max(4, Math.ceil(barCount));
  for (const opt of LAB808_MPC_LOOP_BAR_OPTIONS) {
    if (opt >= need) return opt;
  }
  return LAB808_MPC_LOOP_BAR_OPTIONS[LAB808_MPC_LOOP_BAR_OPTIONS.length - 1]!;
}
