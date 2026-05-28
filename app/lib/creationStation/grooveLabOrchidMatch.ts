/**
 * Bidirectional Orchid chord ↔ bass matching for Groove Lab.
 * Chords-first: progression + chord anchors → bass pattern.
 * Bass-first: bass anchors → stacked chord columns (via lock).
 */

import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import { grooveLabClampBassRootMidi } from '@/app/lib/creationStation/grooveLabPitch';
import {
  buildOrchidNotesForBassRoot,
  diatonicOrchidTypeForRootPc,
  type OrchidChordType,
  type OrchidExtension,
} from '@/app/lib/creationStation/orchidChordEngine';
import {
  GROOVE_LAB_SLOTS_PER_BAR,
  grooveLabSlotsPerCell,
  grooveLabStackChordHitsAtSlot,
  snapGrooveSlot,
  type GrooveLabQuantize,
  type GrooveRollHit,
} from '@/app/lib/creationStation/grooveLabRoll';

const MAJOR_DEGREE_SEMITONES = [0, 2, 4, 5, 7, 9, 11];
const MINOR_DEGREE_SEMITONES = [0, 2, 3, 5, 7, 8, 10];

export type OrchidProgressionId =
  | 'hold-i'
  | 'I-IV-V-I'
  | 'I-V-vi-IV'
  | 'ii-V-I'
  | 'I-vi-IV-V'
  | 'i-VI-III-VII';

export const ORCHID_PROGRESSIONS: {
  id: OrchidProgressionId;
  label: string;
  /** Diatonic scale-degree indices (0 = tonic). */
  degrees: number[];
}[] = [
  { id: 'hold-i', label: 'I (hold)', degrees: [0] },
  { id: 'I-IV-V-I', label: 'I · IV · V · I', degrees: [0, 3, 4, 0] },
  { id: 'I-V-vi-IV', label: 'I · V · vi · IV', degrees: [0, 4, 5, 3] },
  { id: 'ii-V-I', label: 'ii · V · I', degrees: [1, 4, 0] },
  { id: 'I-vi-IV-V', label: 'I · vi · IV · V', degrees: [0, 5, 3, 4] },
  { id: 'i-VI-III-VII', label: 'i · VI · III · VII', degrees: [0, 5, 2, 6] },
];

export function diatonicBassRootMidi(
  keyRoot: number,
  mode: ChordMode,
  degreeIndex: number,
  referenceMidi = 36,
): number {
  const semitones = mode === 'minor' ? MINOR_DEGREE_SEMITONES : MAJOR_DEGREE_SEMITONES;
  const iv = semitones[((degreeIndex % 7) + 7) % 7] ?? 0;
  const pc = (keyRoot + iv) % 12;
  const refOct = Math.floor(referenceMidi / 12);
  return grooveLabClampBassRootMidi(refOct * 12 + pc, referenceMidi);
}

export function orchidTypeForProgressionDegree(
  degreeIndex: number,
  keyRoot: number,
  mode: ChordMode,
  smartMatch: boolean,
  lockedType: OrchidChordType,
): OrchidChordType {
  if (!smartMatch) return lockedType;
  const semitones = mode === 'minor' ? MINOR_DEGREE_SEMITONES : MAJOR_DEGREE_SEMITONES;
  const iv = semitones[((degreeIndex % 7) + 7) % 7] ?? 0;
  const rootPc = (keyRoot + iv) % 12;
  return diatonicOrchidTypeForRootPc(rootPc, keyRoot, mode);
}

/** Write stacked chords across the loop — one step per progression degree per bar. */
export function generateOrchidChordProgressionHits(opts: {
  progressionId: OrchidProgressionId;
  keyRoot: number;
  mode: ChordMode;
  smartMatch: boolean;
  lockedType: OrchidChordType;
  extensions: ReadonlySet<OrchidExtension>;
  inversion: number;
  barCount: number;
  quantize: GrooveLabQuantize;
  sustainSlots: number;
  referenceRootMidi?: number;
}): GrooveRollHit[] {
  const def = ORCHID_PROGRESSIONS.find((p) => p.id === opts.progressionId) ?? ORCHID_PROGRESSIONS[0]!;
  const ref = diatonicBassRootMidi(opts.keyRoot, opts.mode, 0, opts.referenceRootMidi ?? 36);
  const snapStep = grooveLabSlotsPerCell(opts.quantize);
  const slotsPerBar = GROOVE_LAB_SLOTS_PER_BAR;
  const stepsPerBar = def.degrees.length;
  const stepSpan = Math.max(
    snapStep,
    Math.floor(slotsPerBar / stepsPerBar / snapStep) * snapStep,
  );
  const out: GrooveRollHit[] = [];

  for (let bar = 0; bar < opts.barCount; bar++) {
    for (let i = 0; i < stepsPerBar; i++) {
      const degreeIndex = def.degrees[i]!;
      const bassRoot = diatonicBassRootMidi(opts.keyRoot, opts.mode, degreeIndex, ref);
      const type = orchidTypeForProgressionDegree(
        degreeIndex,
        opts.keyRoot,
        opts.mode,
        opts.smartMatch,
        opts.lockedType,
      );
      const chordMidis = buildOrchidNotesForBassRoot(
        bassRoot,
        type,
        opts.extensions,
        opts.inversion,
      );
      const rawSlot = bar * slotsPerBar + i * stepSpan;
      const slot = snapGrooveSlot(rawSlot, opts.quantize, opts.barCount);
      out.push(
        ...grooveLabStackChordHitsAtSlot({
          anchorSlot: slot,
          chordMidis,
          sustainSlots: opts.sustainSlots,
          quantize: opts.quantize,
          barCount: opts.barCount,
          bassMidiForLift: bassRoot,
        }),
      );
    }
  }

  return out;
}

/** Explicit bass roots for each chord column (for bass MATCH). */
export function chordProgressionBassAnchors(opts: {
  progressionId: OrchidProgressionId;
  keyRoot: number;
  mode: ChordMode;
  barCount: number;
  quantize: GrooveLabQuantize;
  referenceRootMidi?: number;
}): { slot: number; midi: number }[] {
  const def = ORCHID_PROGRESSIONS.find((p) => p.id === opts.progressionId) ?? ORCHID_PROGRESSIONS[0]!;
  const ref = diatonicBassRootMidi(opts.keyRoot, opts.mode, 0, opts.referenceRootMidi ?? 36);
  const snapStep = grooveLabSlotsPerCell(opts.quantize);
  const slotsPerBar = GROOVE_LAB_SLOTS_PER_BAR;
  const stepsPerBar = def.degrees.length;
  const stepSpan = Math.max(
    snapStep,
    Math.floor(slotsPerBar / stepsPerBar / snapStep) * snapStep,
  );
  const anchors: { slot: number; midi: number }[] = [];
  for (let bar = 0; bar < opts.barCount; bar++) {
    for (let i = 0; i < stepsPerBar; i++) {
      const degreeIndex = def.degrees[i]!;
      const bassRoot = diatonicBassRootMidi(opts.keyRoot, opts.mode, degreeIndex, ref);
      const slot = snapGrooveSlot(bar * slotsPerBar + i * stepSpan, opts.quantize, opts.barCount);
      anchors.push({ slot, midi: bassRoot });
    }
  }
  return anchors;
}
