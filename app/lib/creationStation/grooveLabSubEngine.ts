/**
 * Groove Lab 808 SUB ROOTS — v2 rebuild.
 * One sub root per green chord column — always the chord root in C1–C3 (no random walks).
 */
import type { GrooveComposerHarmony } from '@/app/lib/creationStation/grooveLabComposerTypes';
import { grooveLabClampBassRootMidi } from '@/app/lib/creationStation/grooveLabPitch';
import { grooveLabSlotsPerCell, type GrooveLabQuantize, type GrooveRollHit } from '@/app/lib/creationStation/grooveLabRoll';
import { cbPianoMidiToNoteName } from '@/app/lib/creationStation/chordBuilderPianoRollTheme';

export type GrooveSubKeypadGuideStep = {
  slot: number;
  keypadMidi: number;
  rollMidi: number;
  label: string;
};

export type GrooveSubKeypadGuide = {
  steps: GrooveSubKeypadGuideStep[];
  suggestedKeyMidis: number[];
};

/** Map a sub-root pitch to the nearest 808 keypad key (same pitch class). */
export function grooveLabSnapSubRootToKeypadMidi(
  rollMidi: number,
  keypadMidis: readonly number[],
): number | null {
  if (keypadMidis.length === 0) return null;
  const targetPc = ((Math.round(rollMidi) % 12) + 12) % 12;
  const candidates = keypadMidis.filter((k) => k % 12 === targetPc);
  if (candidates.length === 0) return null;
  const clamped = grooveLabClampBassRootMidi(rollMidi);
  let best = candidates[0]!;
  let bestDist = Math.abs(best - clamped);
  for (const c of candidates) {
    const d = Math.abs(c - clamped);
    if (d < bestDist) {
      best = c;
      bestDist = d;
    }
  }
  return best;
}

/** One 808 hit per harmony column — chord root only. */
export function generateGrooveSubRoots(
  harmony: GrooveComposerHarmony,
  quantize: GrooveLabQuantize,
): GrooveRollHit[] {
  const snap = grooveLabSlotsPerCell(quantize);
  return harmony.columns.map((col) => ({
    slot: col.slot,
    midi: grooveLabClampBassRootMidi(col.rootMidi),
    sustainSlots: Math.max(snap, Math.round(snap * 2)),
    vel: Math.round(90 + (col.slot % 7)),
  }));
}

export function grooveLabBuildSubKeypadGuide(opts: {
  harmony: GrooveComposerHarmony;
  keypadMidis: readonly number[];
}): GrooveSubKeypadGuide {
  const steps: GrooveSubKeypadGuideStep[] = [];
  for (const col of opts.harmony.columns) {
    const rollMidi = grooveLabClampBassRootMidi(col.rootMidi);
    const keypadMidi = grooveLabSnapSubRootToKeypadMidi(rollMidi, opts.keypadMidis);
    if (keypadMidi == null) continue;
    steps.push({
      slot: col.slot,
      keypadMidi,
      rollMidi,
      label: cbPianoMidiToNoteName(keypadMidi),
    });
  }
  return {
    steps,
    suggestedKeyMidis: [...new Set(steps.map((s) => s.keypadMidi))].sort((a, b) => a - b),
  };
}

export function grooveLabSubGuideToRollHits(
  guide: GrooveSubKeypadGuide,
  quantize: GrooveLabQuantize,
): GrooveRollHit[] {
  const snap = grooveLabSlotsPerCell(quantize);
  return guide.steps.map((s) => ({
    slot: s.slot,
    midi: s.rollMidi,
    sustainSlots: Math.max(snap, Math.round(snap * 2)),
    vel: 0.92,
  }));
}
