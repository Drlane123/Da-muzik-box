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
 * Green chord stacks — R&B / neo-soul tenor voicing (Bill Evans-style C3–A4).
 * @see https://pianowithjonny.com/piano-lessons/jazz-piano-chord-voicings-the-complete-guide/
 */
export const GROOVE_LAB_CHORD_ROLL_MIDI_MIN = 48;
export const GROOVE_LAB_CHORD_ROLL_MIDI_MAX = 69;

/** Harmony analysis reads chord tones from this register upward. */
export const GROOVE_LAB_CHORD_HARMONY_MIDI_MIN = GROOVE_LAB_CHORD_ROLL_MIDI_MIN;

/** Live guitar lane — G3–A4 (between chord stacks and Groove Lead). */
export const GROOVE_LAB_GUITAR_MIDI_MIN = 67;
export const GROOVE_LAB_GUITAR_MIDI_MAX = 81;

/** Amber lead lane — above chord stacks (C5–C6). */
export const GROOVE_LAB_MELODY_MIDI_MIN = 72;
export const GROOVE_LAB_MELODY_MIDI_MAX = 84;

/** Default octave for generated leads (G5). */
export const GROOVE_LAB_MELODY_REFERENCE_MIDI = 79;

export const GROOVE_LAB_REGISTER_LABELS = {
  sub: 'C1–C3',
  guitar: 'G3–A4',
  melody: 'C5–C6',
  chord: 'C3–A4',
} as const;

/** Green chord stack on the roll (not sub, not lead). */
export function grooveLabIsChordStackMidi(midi: number): boolean {
  const m = Math.round(midi);
  return m >= GROOVE_LAB_CHORD_ROLL_MIDI_MIN && m <= GROOVE_LAB_CHORD_ROLL_MIDI_MAX;
}

/** Dedicated guitar channel — G3–A4. */
export function grooveLabIsGuitarMidi(midi: number): boolean {
  const m = Math.round(midi);
  return m >= GROOVE_LAB_GUITAR_MIDI_MIN && m <= GROOVE_LAB_GUITAR_MIDI_MAX;
}

export function grooveLabClampGuitarMidi(midi: number): number {
  const m = Math.round(midi);
  let out = m;
  while (out < GROOVE_LAB_GUITAR_MIDI_MIN) out += 12;
  while (out > GROOVE_LAB_GUITAR_MIDI_MAX) out -= 12;
  return Math.max(GROOVE_LAB_GUITAR_MIDI_MIN, Math.min(GROOVE_LAB_GUITAR_MIDI_MAX, out));
}

/** Amber lead lane — C5–C6 only (no chord-stack or sub overlap). */
export function grooveLabIsMelodyMidi(midi: number): boolean {
  const m = Math.round(midi);
  if (m <= GROOVE_LAB_BASS_MIDI_MAX) return false;
  if (grooveLabIsChordStackMidi(m)) return false;
  return m >= GROOVE_LAB_MELODY_MIDI_MIN && m <= GROOVE_LAB_MELODY_MIDI_MAX;
}

/** Notes on the melody channel that should lift into C5–C6 (gap between chord stack and lead lane). */
export function grooveLabIsMelodyChannelPitch(midi: number): boolean {
  const m = Math.round(midi);
  if (m <= GROOVE_LAB_BASS_MIDI_MAX) return false;
  if (grooveLabIsChordStackMidi(m)) return false;
  return true;
}

/** Strip lead-lane pitches from a work channel (sub + chord registers stay). */
export function grooveLabStripMelodyLaneHits<T extends GrooveLabRollNote>(hits: readonly T[]): T[] {
  return hits.filter((h) => !grooveLabIsMelodyChannelPitch(h.midi));
}

/** Clamp + drop invalid rows for CH35 / melody roll storage. */
export function grooveLabSanitizeMelodyChannelHit<T extends GrooveLabRollNote>(h: T): T | null {
  const m = Math.round(h.midi);
  if (m >= GROOVE_LAB_BASS_MIDI_MIN && m <= GROOVE_LAB_BASS_MIDI_MAX) return null;
  if (!grooveLabIsMelodyChannelPitch(h.midi)) return null;
  const midi = grooveLabClampMelodyMidi(h.midi);
  return midi === h.midi ? h : { ...h, midi };
}

/**
 * Monophonic lead — one pitch per grid slot (highest wins).
 * Stacked C5+G5 on the same column was firing two lead voices → "sub + melody" with one timbre.
 */
export function grooveLabDedupeMelodyHitsBySlot<T extends GrooveLabRollNote>(hits: readonly T[]): T[] {
  const bySlot = new Map<number, T>();
  for (const h of hits) {
    const norm = grooveLabSanitizeMelodyChannelHit(h);
    if (!norm) continue;
    const prev = bySlot.get(norm.slot);
    if (!prev || norm.midi > prev.midi) bySlot.set(norm.slot, norm);
  }
  return [...bySlot.values()].sort((a, b) => a.slot - b.slot || a.midi - b.midi);
}

/**
 * Cap sustain for mono lane — one note per column; sustain stops at the next hit (no overlap on the grid).
 */
export function grooveLabTrimMelodyHitsMonophonic<T extends GrooveLabRollNote>(hits: readonly T[]): T[] {
  const deduped = grooveLabDedupeMelodyHitsBySlot(hits);
  const out = deduped.map((h) => ({ ...h }));
  for (let i = 0; i < out.length; i++) {
    const cur = out[i]!;
    const next = out[i + 1];
    if (next) {
      const gap = next.slot - cur.slot;
      if (gap > 1) cur.sustainSlots = Math.min(cur.sustainSlots, Math.max(1, gap - 1));
      else cur.sustainSlots = 1;
    }
  }
  return out;
}

/**
 * Transport playback — full phrase, one pitch per grid slot (mono truncate at schedule time).
 * @deprecated Prefer {@link grooveLabPrepareMelodyHitsForTransport}; kept for callers passing slotsPerBeat.
 */
export function grooveLabThinMelodyHitsForTransport<T extends GrooveLabRollNote>(
  hits: readonly T[],
  _slotsPerBeat?: number,
): T[] {
  return grooveLabPrepareMelodyHitsForTransport(hits);
}

/** Matches {@link GROOVE_LAB_SLOTS_PER_BAR} — inlined to avoid import cycle with grooveLabRoll. */
const GROOVE_LAB_PREP_SLOTS_PER_BAR = 64;

function grooveLabBarIndexFromSlot(slot: number): number {
  return Math.floor(Math.max(0, slot) / GROOVE_LAB_PREP_SLOTS_PER_BAR);
}

function grooveLabBarDownbeatSlotInline(slot: number): number {
  return grooveLabBarIndexFromSlot(slot) * GROOVE_LAB_PREP_SLOTS_PER_BAR;
}

/**
 * Remove bar-1 downbeat lead hits that match the chord root in C5–C6 — reads as a second
 * "chord stab" on the melody timbre. Keeps the note if it is the only hit in that bar.
 */
export function grooveLabStripMelodyDownbeatChordRoots<T extends GrooveLabRollNote>(
  melodyHits: readonly T[],
  chordHits: readonly GrooveLabRollNote[],
): T[] {
  if (melodyHits.length === 0 || chordHits.length === 0) return [...melodyHits];

  const rootMidiByBar = new Map<number, number>();
  for (const h of chordHits) {
    if (!grooveLabIsChordStackMidi(h.midi)) continue;
    const bar = grooveLabBarIndexFromSlot(h.slot);
    const prev = rootMidiByBar.get(bar);
    if (prev == null || h.midi < prev) rootMidiByBar.set(bar, Math.round(h.midi));
  }

  return melodyHits.filter((h) => {
    const bar = grooveLabBarIndexFromSlot(h.slot);
    const downbeat = grooveLabBarDownbeatSlotInline(h.slot);
    if (h.slot > downbeat + 3) return true;
    const rootMidi = rootMidiByBar.get(bar);
    if (rootMidi == null) return true;
    const rootPc = ((rootMidi % 12) + 12) % 12;
    if (rootPc == null) return true;
    const notePc = ((Math.round(h.midi) % 12) + 12) % 12;
    if (notePc !== rootPc) return true;
    const hasLaterPhrase = melodyHits.some(
      (o) => grooveLabBarIndexFromSlot(o.slot) === bar && o.slot > downbeat + 3,
    );
    return !hasLaterPhrase;
  });
}

/** Dedupe slots + trim sustains; optional chord layer strips downbeat root doubles. */
export function grooveLabPrepareMelodyHitsForTransport<T extends GrooveLabRollNote>(
  hits: readonly T[],
  chordHits?: readonly GrooveLabRollNote[],
): T[] {
  const trimmed = grooveLabTrimMelodyHitsMonophonic(hits);
  return chordHits?.length ? grooveLabStripMelodyDownbeatChordRoots(trimmed, chordHits) : trimmed;
}

export function grooveLabClampMelodyMidi(
  midi: number,
  referenceMidi = GROOVE_LAB_MELODY_REFERENCE_MIDI,
): number {
  const pc = ((Math.round(midi) % 12) + 12) % 12;
  const refOct = Math.max(6, Math.floor(referenceMidi / 12));
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
  while (n > GROOVE_LAB_CHORD_ROLL_MIDI_MAX) n -= 12;
  return Math.min(
    GROOVE_LAB_CHORD_ROLL_MIDI_MAX,
    Math.max(GROOVE_LAB_CHORD_ROLL_MIDI_MIN, n),
  );
}

/** Pull legacy C5+ chord stacks down into the R&B tenor window. */
export function grooveLabRepitchChordHitsToRnBRange<T extends GrooveLabRollNote>(
  hits: readonly T[],
): T[] {
  return hits.map((h) => {
    if (h.midi < GROOVE_LAB_CHORD_ROLL_MIDI_MIN) return h;
    if (grooveLabIsMelodyMidi(h.midi)) return h;
    let m = h.midi;
    while (m > GROOVE_LAB_CHORD_ROLL_MIDI_MAX) m -= 12;
    if (m < GROOVE_LAB_CHORD_ROLL_MIDI_MIN) return h;
    return m === h.midi ? h : { ...h, midi: m };
  });
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
