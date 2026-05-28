import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';

/** Default bass root (C2) — kept here to avoid import cycles with grooveLabRoll. */
export const GROOVE_LAB_BASS_REFERENCE_MIDI = 36;

const MAJOR_DEGREE_SEMITONES = [0, 2, 4, 5, 7, 9, 11];
const MINOR_DEGREE_SEMITONES = [0, 2, 3, 5, 7, 8, 10];

/** Piano roll bass lane — C1 through C3 (808 / sub roots). */
export const GROOVE_LAB_BASS_MIDI_MIN = 24;
export const GROOVE_LAB_BASS_MIDI_MAX = 48;

/** Lowest chord tone must sit at least this many semitones above the bass root. */
export const GROOVE_LAB_CHORD_MIN_ABOVE_BASS = 12;

/**
 * Green chord stacks on the roll (top register).
 * C5+ — above the amber lead lane; subs / NEW SYNTH bass stay ≤48.
 */
export const GROOVE_LAB_CHORD_ROLL_MIDI_MIN = 72;

/** Read chord tones for harmony / composer (includes older C4 voicings). */
export const GROOVE_LAB_CHORD_HARMONY_MIDI_MIN = 60;

/** Mid-register lead — not subs (≤48), not green chord stack (≥72). */
export const GROOVE_LAB_MELODY_MIDI_MIN = 60;
export const GROOVE_LAB_MELODY_MIDI_MAX = 71;

/** Legacy composer lane (C♯3–B3) — still treated as melody when loading old rolls. */
export const GROOVE_LAB_MELODY_LEGACY_MIDI_MAX = 59;

/** Default octave for generated leads (G4). */
export const GROOVE_LAB_MELODY_REFERENCE_MIDI = 67;

export const GROOVE_LAB_REGISTER_LABELS = {
  sub: 'C1–C3',
  melody: 'C4–B4',
  chord: 'C5+',
} as const;

export function grooveLabIsMelodyMidi(midi: number): boolean {
  const m = Math.round(midi);
  if (m <= GROOVE_LAB_BASS_MIDI_MAX) return false;
  if (m >= GROOVE_LAB_CHORD_ROLL_MIDI_MIN) return false;
  if (m >= GROOVE_LAB_MELODY_MIDI_MIN && m <= GROOVE_LAB_MELODY_MIDI_MAX) return true;
  return m > GROOVE_LAB_BASS_MIDI_MAX && m <= GROOVE_LAB_MELODY_LEGACY_MIDI_MAX;
}

export function grooveLabClampMelodyMidi(
  midi: number,
  referenceMidi = GROOVE_LAB_MELODY_REFERENCE_MIDI,
): number {
  const pc = ((Math.round(midi) % 12) + 12) % 12;
  const refOct = Math.max(4, Math.floor(referenceMidi / 12));
  let n = refOct * 12 + pc;
  while (n < GROOVE_LAB_MELODY_MIDI_MIN) n += 12;
  while (n > GROOVE_LAB_MELODY_MIDI_MAX) n -= 12;
  return Math.max(GROOVE_LAB_MELODY_MIDI_MIN, Math.min(GROOVE_LAB_MELODY_MIDI_MAX, n));
}

export type GrooveLabRollNote = {
  slot: number;
  sustainSlots: number;
  midi: number;
  vel: number;
};

/** Lowest MIDI for a chord voicing above the bass root (not the default C4 placement floor). */
export function grooveLabChordVoicingFloorMidi(bassMidi?: number): number {
  if (bassMidi != null) {
    return grooveLabClampBassRootMidi(bassMidi) + GROOVE_LAB_CHORD_MIN_ABOVE_BASS;
  }
  return GROOVE_LAB_CHORD_ROLL_MIDI_MIN;
}

export type GrooveLabTransposeChordOctaveOpts = {
  rollMinMidi?: number;
  rollMaxMidi?: number;
  /**
   * When set (split chord channel), chords may use the full roll — no bass+12 lift on downward moves.
   * When omitted (mixed roll), floor stays one octave above the bass root.
   */
  lowFloorMidi?: number;
  bassMidi?: number;
};

/**
 * Clamp for octave moves.
 * Returns null when the target would leave the piano roll; caller should keep the original.
 */
export function grooveLabClampChordRollMidiForOctave(
  midi: number,
  opts?: GrooveLabTransposeChordOctaveOpts,
): number | null {
  const rollMin = opts?.rollMinMidi ?? GROOVE_LAB_BASS_MIDI_MIN;
  const rollMax = opts?.rollMaxMidi ?? 96;
  const floor =
    opts?.lowFloorMidi != null
      ? opts.lowFloorMidi
      : grooveLabChordVoicingFloorMidi(opts?.bassMidi);
  let n = Math.round(midi);
  if (opts?.lowFloorMidi != null) {
    if (n < floor) return null;
  } else {
    while (n < floor) n += 12;
  }
  if (n < rollMin || n > rollMax) return null;
  return n;
}

/** Shift every chord tone up or down one octave (dedupes slot+pitch). */
export function grooveLabTransposeChordHitsOctave<T extends GrooveLabRollNote>(
  hits: readonly T[],
  dir: 1 | -1,
  bassMidi?: number,
  opts?: GrooveLabTransposeChordOctaveOpts,
): T[] {
  if (hits.length === 0) return [];
  const delta = dir * 12;
  const clampOpts: GrooveLabTransposeChordOctaveOpts = {
    ...opts,
    bassMidi: opts?.bassMidi ?? bassMidi,
  };
  const byKey = new Map<string, T>();
  for (const h of hits) {
    const target = h.midi + delta;
    const clamped = grooveLabClampChordRollMidiForOctave(target, clampOpts);
    const newMidi = clamped ?? h.midi;
    const id = `${h.slot}:${newMidi}`;
    if (byKey.has(id)) continue;
    byKey.set(id, { ...h, midi: newMidi });
  }
  return [...byKey.values()].sort((a, b) => a.slot - b.slot || a.midi - b.midi);
}

export function grooveLabClampChordRollMidi(midi: number, bassMidi?: number): number {
  const floor =
    bassMidi != null
      ? grooveLabClampBassRootMidi(bassMidi) + GROOVE_LAB_CHORD_MIN_ABOVE_BASS
      : GROOVE_LAB_CHORD_ROLL_MIDI_MIN;
  let n = Math.round(midi);
  while (n < floor) n += 12;
  return Math.min(96, Math.max(GROOVE_LAB_CHORD_ROLL_MIDI_MIN, n));
}

/** Snap any bass root into the low register (keeps pitch class / scale degree). */
export function grooveLabClampBassRootMidi(
  midi: number,
  referenceRootMidi = GROOVE_LAB_BASS_REFERENCE_MIDI,
): number {
  const pc = ((Math.round(midi) % 12) + 12) % 12;
  const refOct = Math.floor(referenceRootMidi / 12);
  let n = refOct * 12 + pc;
  while (n > GROOVE_LAB_BASS_MIDI_MAX) n -= 12;
  while (n < GROOVE_LAB_BASS_MIDI_MIN) n += 12;
  return n;
}

/** Re-harmonize a bass pattern note when the column's chord root changes. */
export function grooveLabTransposeBassByRoot(
  midi: number,
  fromRoot: number,
  toRoot: number,
): number {
  const delta = ((toRoot % 12) - (fromRoot % 12) + 12) % 12;
  return grooveLabClampBassRootMidi(Math.round(midi) + delta, toRoot);
}

/**
 * Guess chord root from stacked tones (avoids mistaking 3rd/5th for root when inverted).
 */
export function grooveLabInferBassRootFromChordMidis(
  midis: readonly number[],
  keyRoot: number,
  mode: ChordMode,
  referenceMidi = GROOVE_LAB_BASS_REFERENCE_MIDI,
): number {
  if (midis.length === 0) return grooveLabClampBassRootMidi(referenceMidi);
  const pcs = [...new Set(midis.map((m) => ((Math.round(m) % 12) + 12) % 12))];
  const semitones = mode === 'minor' ? MINOR_DEGREE_SEMITONES : MAJOR_DEGREE_SEMITONES;
  const third = mode === 'minor' ? 3 : 4;
  let bestPc = pcs.reduce((a, b) => (a < b ? a : b), pcs[0]!);
  let bestScore = -1;
  for (let d = 0; d < 7; d++) {
    const rootPc = (keyRoot + semitones[d]!) % 12;
    if (!pcs.includes(rootPc)) continue;
    let score = 8;
    if (pcs.includes((rootPc + third) % 12)) score += 5;
    if (pcs.includes((rootPc + 7) % 12)) score += 4;
    if (score > bestScore) {
      bestScore = score;
      bestPc = rootPc;
    }
  }
  const refOct = Math.floor(referenceMidi / 12);
  return grooveLabClampBassRootMidi(refOct * 12 + bestPc, referenceMidi);
}

/** Voicing stack strictly above the bass — no unison or chord tones on the bass row. */
export function grooveLabLiftChordsAboveBass(
  bassMidi: number,
  chordMidis: readonly number[],
  minGap = GROOVE_LAB_CHORD_MIN_ABOVE_BASS,
): number[] {
  const bass = Math.round(bassMidi);
  const floor = bass + minGap;
  const lifted = [...new Set(chordMidis.map((m) => Math.round(m)))]
    .map((n) => {
      let v = n;
      while (v < floor) v += 12;
      return grooveLabClampChordRollMidi(v, bass);
    })
    .filter((n) => n >= floor && Math.abs(n - bass) >= minGap)
    .sort((a, b) => a - b);
  return lifted;
}

/** One bass root per grid column — drops duplicate slot rows (keeps lowest). */
export function grooveLabCollapseBassRootsPerSlot(hits: { slot: number; midi: number }[]): {
  slot: number;
  midi: number;
}[] {
  const bySlot = new Map<number, number>();
  for (const h of hits) {
    const prev = bySlot.get(h.slot);
    if (prev == null || h.midi < prev) bySlot.set(h.slot, h.midi);
  }
  return [...bySlot.entries()]
    .map(([slot, midi]) => ({ slot, midi }))
    .sort((a, b) => a.slot - b.slot);
}
