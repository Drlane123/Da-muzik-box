import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import type { GrooveComposerHarmony } from '@/app/lib/creationStation/grooveComposerEngine';
import { grooveLabClampBassRootMidi } from '@/app/lib/creationStation/grooveLabPitch';
import { grooveLabSlotsPerCell, type GrooveLabQuantize, type GrooveRollHit } from '@/app/lib/creationStation/grooveLabRoll';
import { cbPianoMidiToNoteName } from '@/app/lib/creationStation/chordBuilderPianoRollTheme';

export type GrooveSubKeypadGuideStep = {
  slot: number;
  /** MIDI on the 808 keypad row (what you press). */
  keypadMidi: number;
  /** MIDI written when pushed to the roll (C1–C3). */
  rollMidi: number;
  label: string;
};

export type GrooveSubKeypadGuide = {
  steps: GrooveSubKeypadGuideStep[];
  /** Unique keypad keys to highlight for this path. */
  suggestedKeyMidis: number[];
};

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return (): number => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

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

export function grooveLabBuildSubKeypadGuide(opts: {
  harmony: GrooveComposerHarmony;
  keypadMidis: readonly number[];
  seed: number;
  complexity?: number;
}): GrooveSubKeypadGuide {
  const { harmony, keypadMidis, seed, complexity = 0.55 } = opts;
  const rnd = mulberry32(seed ^ 0x27d4_eb2f);
  const steps: GrooveSubKeypadGuideStep[] = [];

  for (const col of harmony.columns) {
    if (rnd() > 0.92) continue;

    let rollMidi = grooveLabClampBassRootMidi(col.rootMidi);
    if (rnd() < complexity * 0.38 && col.tones.length > 0) {
      const tone = col.tones[Math.floor(rnd() * col.tones.length)]!;
      rollMidi = grooveLabClampBassRootMidi(tone);
      if (rnd() < 0.45) {
        const fifth = col.tones.find((t) => (t - col.rootMidi + 12) % 12 === 7);
        if (fifth != null) rollMidi = grooveLabClampBassRootMidi(fifth);
      }
    }

    const keypadMidi = grooveLabSnapSubRootToKeypadMidi(rollMidi, keypadMidis);
    if (keypadMidi == null) continue;

    steps.push({
      slot: col.slot,
      keypadMidi,
      rollMidi: grooveLabClampBassRootMidi(rollMidi),
      label: cbPianoMidiToNoteName(keypadMidi),
    });
  }

  const suggestedKeyMidis = [...new Set(steps.map((s) => s.keypadMidi))].sort((a, b) => a - b);
  return { steps, suggestedKeyMidis };
}

export function grooveLabSubGuideToRollHits(
  guide: GrooveSubKeypadGuide,
  quantize: GrooveLabQuantize,
): GrooveRollHit[] {
  const snap = grooveLabSlotsPerCell(quantize);
  return guide.steps.map((s) => ({
    slot: s.slot,
    midi: s.rollMidi,
    sustainSlots: Math.max(snap, Math.round(snap * 1.75)),
    vel: 0.9,
  }));
}
