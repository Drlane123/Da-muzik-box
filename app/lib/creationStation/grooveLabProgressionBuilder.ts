/**
 * Groove Lab — native chord progression builder (step list → piano roll).
 */

import { parseChordSymbolToken } from '@/app/lib/creationStation/chordProgressionParse';
import {
  grooveLabClampBassRootMidi,
  grooveLabClampChordRollMidi,
  grooveLabLiftChordsAboveBass,
  GROOVE_LAB_CHORD_ROLL_MIDI_MIN,
} from '@/app/lib/creationStation/grooveLabPitch';
import {
  GROOVE_LAB_SLOTS_PER_BAR,
  grooveLabSlotsPerCell,
  grooveLabStackChordHitsAtSlot,
  normalizeGrooveBarCount,
  snapGrooveSlot,
  snapGrooveSustain,
  type GrooveLabBarCount,
  type GrooveLabQuantize,
  type GrooveRollHit,
} from '@/app/lib/creationStation/grooveLabRoll';

export type GrooveProgressionStep = {
  id: string;
  /** Chord chart label, e.g. C, Am7, F#m — empty when rest. */
  label: string;
  /** Length in quarter-note beats (4/4: 4 beats = one bar). */
  beats: number;
  /** Rest / blank slot — no chord on the roll. */
  rest?: boolean;
};

export type GrooveProgressionPresetId =
  | 'custom'
  | 'hold-c'
  | 'pop-c-g-am-f'
  | '50s-c-am-f-g'
  | 'jazz-ii-v-i'
  | 'blues-12'
  | 'vi-iv-i-v';

export const GROOVE_LAB_PROGRESSION_PRESETS: {
  id: GrooveProgressionPresetId;
  label: string;
  steps: { label: string; beats: number }[];
}[] = [
  { id: 'custom', label: '— your progression —', steps: [] },
  { id: 'hold-c', label: 'C (hold)', steps: [{ label: 'C', beats: 4 }] },
  {
    id: 'pop-c-g-am-f',
    label: 'C · G · Am · F',
    steps: [
      { label: 'C', beats: 1 },
      { label: 'G', beats: 1 },
      { label: 'Am', beats: 1 },
      { label: 'F', beats: 1 },
    ],
  },
  {
    id: '50s-c-am-f-g',
    label: 'C · Am · F · G',
    steps: [
      { label: 'C', beats: 1 },
      { label: 'Am', beats: 1 },
      { label: 'F', beats: 1 },
      { label: 'G', beats: 1 },
    ],
  },
  {
    id: 'jazz-ii-v-i',
    label: 'Dm7 · G7 · Cmaj7',
    steps: [
      { label: 'Dm7', beats: 2 },
      { label: 'G7', beats: 2 },
      { label: 'Cmaj7', beats: 4 },
    ],
  },
  {
    id: 'blues-12',
    label: '12-bar blues (C)',
    steps: [
      { label: 'C7', beats: 4 },
      { label: 'C7', beats: 4 },
      { label: 'C7', beats: 4 },
      { label: 'F7', beats: 4 },
      { label: 'F7', beats: 4 },
      { label: 'C7', beats: 4 },
      { label: 'C7', beats: 4 },
      { label: 'G7', beats: 4 },
      { label: 'F7', beats: 4 },
      { label: 'C7', beats: 4 },
      { label: 'G7', beats: 4 },
    ],
  },
  {
    id: 'vi-iv-i-v',
    label: 'Am · F · C · G',
    steps: [
      { label: 'Am', beats: 1 },
      { label: 'F', beats: 1 },
      { label: 'C', beats: 1 },
      { label: 'G', beats: 1 },
    ],
  },
];

const SLOTS_PER_BEAT = GROOVE_LAB_SLOTS_PER_BAR / 4;

/** Default step length in the progression builder (one chord per 4/4 bar). */
export const GROOVE_PROGRESSION_BEATS_PER_BAR = 4;

function progressionSlotForBeat(
  beat: number,
  stepBeats: number,
  beatsPerBar: number,
): number {
  if (stepBeats >= beatsPerBar) {
    const bar = Math.floor(beat / beatsPerBar);
    return bar * GROOVE_LAB_SLOTS_PER_BAR;
  }
  return Math.round(beat * SLOTS_PER_BEAT);
}

export type GrooveStagedProgression = {
  chordHits: GrooveRollHit[];
  bassHits: GrooveRollHit[];
  barCount: GrooveLabBarCount;
  steps: GrooveProgressionStep[];
};

let stepIdCounter = 0;
export function newProgressionStepId(): string {
  stepIdCounter += 1;
  return `gp-${stepIdCounter}`;
}

export function presetToSteps(presetId: GrooveProgressionPresetId): GrooveProgressionStep[] {
  const def = GROOVE_LAB_PROGRESSION_PRESETS.find((p) => p.id === presetId);
  if (!def || def.steps.length === 0) return [];
  return def.steps.map((s) => ({
    id: newProgressionStepId(),
    label: s.label,
    beats: s.beats,
  }));
}

export function stepsFromPasteLine(text: string, defaultBeats = 1): GrooveProgressionStep[] {
  const tokens = text
    .split(/[\s,;|/\n\r]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  return tokens.map((label) => ({
    id: newProgressionStepId(),
    label,
    beats: defaultBeats,
  }));
}

export function progressionStepsToGrooveHits(
  steps: readonly GrooveProgressionStep[],
  opts: {
    quantize: GrooveLabQuantize;
    barCount: number;
    sustainSlots: number;
    beatsPerBar?: number;
  },
): GrooveStagedProgression | { message: string } {
  if (steps.length === 0) {
    return { message: 'Add at least one chord to the progression.' };
  }
  const hasChord = steps.some((s) => !s.rest && s.label.trim());
  if (!hasChord) {
    return { message: 'Add at least one chord (not only rests).' };
  }

  const beatsPerBar = opts.beatsPerBar ?? GROOVE_PROGRESSION_BEATS_PER_BAR;
  let totalBeats = 0;
  for (const step of steps) {
    totalBeats += Math.max(0.25, step.beats);
  }
  const barsNeeded = Math.max(1, Math.ceil(totalBeats / beatsPerBar));
  const barCount = normalizeGrooveBarCount(Math.max(opts.barCount, barsNeeded));
  const cellStep = grooveLabSlotsPerCell(opts.quantize);
  /** Stay inside one bar column — do not bleed into the next bar on the grid. */
  const maxSustainPerBar = GROOVE_LAB_SLOTS_PER_BAR - cellStep;

  const chordHits: GrooveRollHit[] = [];
  let beat = 0;

  for (const step of steps) {
    if (step.rest || !step.label.trim()) {
      beat += Math.max(0, step.beats);
      continue;
    }
    const parsed = parseChordSymbolToken(step.label);
    if (!parsed) {
      return { message: `Could not read chord “${step.label}”. Try C, Am, F, G7, Dm7…` };
    }
    const durBeats = Math.max(0.25, step.beats);
    const rawSlot = progressionSlotForBeat(beat, durBeats, beatsPerBar);
    const slot = snapGrooveSlot(rawSlot, opts.quantize, barCount);
    const durSlots = Math.max(
      cellStep,
      Math.round(durBeats * SLOTS_PER_BEAT),
    );
    const sustainSlots = snapGrooveSustain(
      slot,
      Math.min(durSlots, maxSustainPerBar),
      opts.quantize,
      barCount,
    );
    const bassRef = grooveLabClampBassRootMidi(Math.min(...parsed.notes));
    const voicing = grooveLabLiftChordsAboveBass(bassRef, parsed.notes).filter(
      (m) => m >= GROOVE_LAB_CHORD_ROLL_MIDI_MIN,
    );
    if (voicing.length === 0) continue;
    chordHits.push(
      ...grooveLabStackChordHitsAtSlot({
        anchorSlot: slot,
        chordMidis: voicing,
        sustainSlots,
        quantize: opts.quantize,
        barCount,
        bassMidiForLift: bassRef,
      }),
    );
    beat += durBeats;
  }

  const snapHits = (list: GrooveRollHit[]) =>
    list.map((h) => {
      const slot = snapGrooveSlot(h.slot, opts.quantize, barCount);
      return {
        ...h,
        slot,
        sustainSlots: snapGrooveSustain(slot, h.sustainSlots, opts.quantize, barCount),
      };
    });

  return {
    chordHits: snapHits(chordHits),
    /** Groove Studio drop is chords-only; bass is added separately (+ MATCH BASS). */
    bassHits: [],
    barCount,
    steps: [...steps],
  };
}
