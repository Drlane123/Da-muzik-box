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
  /** Strikes per 4/4 bar within this card (1–4). Used by rhythm edit box → play / drop. */
  hitsPerBar?: number;
  /** Which beats in each 4/4 bar fire (1–4). e.g. [1, 3] = reggae skip pattern. */
  barBeats?: readonly number[];
};

/** Preset beat placements per 4/4 bar (1-indexed). */
export const GROOVE_BAR_BEAT_PATTERN_OPTIONS: {
  key: string;
  label: string;
  beats: readonly number[];
}[] = [
  { key: '1', label: '1', beats: [1] },
  { key: '2', label: '2', beats: [2] },
  { key: '3', label: '3', beats: [3] },
  { key: '4', label: '4', beats: [4] },
  { key: '1-2', label: '1+2', beats: [1, 2] },
  { key: '3-4', label: '3+4', beats: [3, 4] },
  { key: '1-3', label: '1+3', beats: [1, 3] },
  { key: '2-4', label: '2+4', beats: [2, 4] },
  { key: '1-2-3', label: '1+2+3', beats: [1, 2, 3] },
  { key: '1-2-3-4', label: '1+2+3+4', beats: [1, 2, 3, 4] },
];

/** Max cards on progression timeline or rhythm edit box. */
export const GROOVE_PROGRESSION_MAX_TIMELINE_CARDS = 16;
export const GROOVE_PROGRESSION_MAX_HITS_PER_BAR = 4;

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
  /** 1-indexed beat within the bar — from rhythm expand (`barBeats: [3]` etc.). */
  barBeat1?: number,
): number {
  const bar = Math.floor(beat / beatsPerBar);
  if (barBeat1 != null && barBeat1 >= 1 && barBeat1 <= beatsPerBar) {
    return bar * GROOVE_LAB_SLOTS_PER_BAR + (barBeat1 - 1) * SLOTS_PER_BEAT;
  }
  if (stepBeats >= beatsPerBar) {
    return bar * GROOVE_LAB_SLOTS_PER_BAR;
  }
  return Math.round(beat * SLOTS_PER_BEAT);
}

/** True when cards carry rhythm metadata but are still one multi-beat step per card. */
export function progressionStepsNeedRhythmExpand(steps: readonly GrooveProgressionStep[]): boolean {
  return steps.some((s) => {
    if (s.rest || !s.label.trim()) return false;
    const pattern = resolveStepBarBeats(s);
    if (pattern.length > 1) return true;
    if ((s.hitsPerBar ?? 1) > 1) return true;
    return pattern.some((b) => b > 1);
  });
}

/** Beat-level timeline from rhythm expand — skip bar tiling on export. */
export function progressionStepsIsBeatLevelTimeline(
  steps: readonly GrooveProgressionStep[],
): boolean {
  if (steps.length === 0) return false;
  return steps.every((s) => s.beats <= 1.001);
}

/** Main-builder drop — one full-bar chord per card; ignore rhythm-edit metadata on cards. */
export function stripProgressionStepsForOriginalDrop(
  steps: readonly GrooveProgressionStep[],
): GrooveProgressionStep[] {
  return steps.map((s) => ({
    ...s,
    hitsPerBar: undefined,
    barBeats: undefined,
  }));
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

export function clampHitsPerBar(n: number): number {
  return Math.max(1, Math.min(GROOVE_PROGRESSION_MAX_HITS_PER_BAR, Math.round(n)));
}

export function normalizeBarBeats(beats: readonly number[]): number[] {
  const uniq = [
    ...new Set(beats.map((b) => Math.round(b)).filter((b) => b >= 1 && b <= GROOVE_PROGRESSION_MAX_HITS_PER_BAR)),
  ];
  return uniq.sort((a, b) => a - b);
}

export function barBeatPatternKey(beats: readonly number[]): string {
  const normalized = normalizeBarBeats(beats);
  return normalized.length > 0 ? normalized.join('-') : '1';
}

export function barBeatsFromHitsPerBar(hits: number): number[] {
  const n = clampHitsPerBar(hits);
  return Array.from({ length: n }, (_, i) => i + 1);
}

/** Resolved beat slots for a card — explicit barBeats win over hitsPerBar. */
export function resolveStepBarBeats(step: GrooveProgressionStep): number[] {
  if (step.barBeats?.length) return normalizeBarBeats(step.barBeats);
  return barBeatsFromHitsPerBar(step.hitsPerBar ?? 1);
}

export function findBarBeatPatternOption(key: string) {
  return GROOVE_BAR_BEAT_PATTERN_OPTIONS.find((o) => o.key === key);
}

/** Deep-clone steps for the rhythm edit box (new ids, optional default hits). */
export function cloneProgressionSteps(
  steps: readonly GrooveProgressionStep[],
  opts?: { defaultHitsPerBar?: number; defaultBarBeats?: readonly number[]; maxCards?: number },
): GrooveProgressionStep[] {
  const maxCards = opts?.maxCards ?? GROOVE_PROGRESSION_MAX_TIMELINE_CARDS;
  const defaultBarBeats = normalizeBarBeats(
    opts?.defaultBarBeats ?? barBeatsFromHitsPerBar(opts?.defaultHitsPerBar ?? 1),
  );
  const defaultHits = defaultBarBeats.length;
  return steps.slice(0, maxCards).map((s) => ({
    id: newProgressionStepId(),
    label: s.label,
    beats: s.beats,
    rest: s.rest,
    hitsPerBar: clampHitsPerBar(s.hitsPerBar ?? defaultHits),
    barBeats: normalizeBarBeats(s.barBeats ?? defaultBarBeats),
  }));
}

/**
 * Expand each card using `barBeats` — e.g. [1, 3] → hit on beat 1 & 3, rests on 2 & 4.
 * Used for rhythm edit box play / loop / drop without redrawing the main timeline.
 */
export function expandProgressionStepsForHits(
  steps: readonly GrooveProgressionStep[],
): GrooveProgressionStep[] {
  const out: GrooveProgressionStep[] = [];
  for (const step of steps) {
    if (step.rest || !step.label.trim()) {
      out.push({ ...step, id: newProgressionStepId() });
      continue;
    }
    const durBeats = Math.max(0.25, step.beats);
    const pattern = resolveStepBarBeats(step);
    const fullBars = Math.floor(durBeats / GROOVE_PROGRESSION_BEATS_PER_BAR + 0.001);
    const partialBeats = Math.max(0, durBeats - fullBars * GROOVE_PROGRESSION_BEATS_PER_BAR);

    const emitBarSlice = (beatLimit: number) => {
      const limit = Math.max(1, Math.min(GROOVE_PROGRESSION_BEATS_PER_BAR, Math.round(beatLimit)));
      for (let b = 1; b <= limit; b++) {
        if (pattern.includes(b)) {
          out.push({
            id: newProgressionStepId(),
            label: step.label,
            beats: 1,
            rest: false,
            hitsPerBar: 1,
          });
        } else {
          out.push({
            id: newProgressionStepId(),
            label: '',
            beats: 1,
            rest: true,
          });
        }
      }
    };

    for (let bar = 0; bar < fullBars; bar++) emitBarSlice(GROOVE_PROGRESSION_BEATS_PER_BAR);
    if (partialBeats > 0.001) emitBarSlice(partialBeats);
  }
  return out;
}

/** Repeat a beat-level rhythm timeline until it fills the loop (e.g. 4-bar chop → 8-bar loop). */
export function tileBeatLevelTimelineForLoop(
  steps: readonly GrooveProgressionStep[],
  loopBeats: number,
): GrooveProgressionStep[] {
  const target = Math.max(0.25, loopBeats);
  if (steps.length === 0 || target <= 0) return [];
  const contentBeats = steps.reduce((sum, s) => sum + Math.max(0.25, s.beats), 0);
  if (contentBeats <= 0) return [];
  if (contentBeats >= target - 1e-6) return steps.map((s) => ({ ...s, id: newProgressionStepId() }));

  const out: GrooveProgressionStep[] = [];
  let written = 0;
  let i = 0;
  const maxIter = Math.ceil(target / contentBeats) * steps.length + steps.length;
  while (written < target - 1e-6 && i < maxIter) {
    const src = steps[i % steps.length]!;
    const stepBeats = Math.max(0.25, src.beats);
    if (written + stepBeats > target + 1e-6) break;
    out.push({ ...src, id: newProgressionStepId() });
    written += stepBeats;
    i += 1;
  }
  return out;
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
    /** Rich Jazz / Deep Neo open octave spreads on export. */
    openJazzNeo?: boolean;
  },
): GrooveStagedProgression | { message: string } {
  if (steps.length === 0) {
    return { message: 'Add at least one chord to the progression.' };
  }
  const resolvedSteps = steps;
  const hasChord = resolvedSteps.some((s) => !s.rest && s.label.trim());
  if (!hasChord) {
    return { message: 'Add at least one chord (not only rests).' };
  }

  const beatsPerBar = opts.beatsPerBar ?? GROOVE_PROGRESSION_BEATS_PER_BAR;
  let totalBeats = 0;
  for (const step of resolvedSteps) {
    totalBeats += Math.max(0.25, step.beats);
  }
  const barsNeeded = Math.max(1, Math.ceil(totalBeats / beatsPerBar));
  const barCount = normalizeGrooveBarCount(Math.max(opts.barCount, barsNeeded));
  const cellStep = grooveLabSlotsPerCell(opts.quantize);
  /** Stay inside one bar column — do not bleed into the next bar on the grid. */
  const maxSustainPerBar = GROOVE_LAB_SLOTS_PER_BAR - cellStep;

  const chordHits: GrooveRollHit[] = [];
  let beat = 0;

  for (const step of resolvedSteps) {
    if (step.rest || !step.label.trim()) {
      beat += Math.max(0, step.beats);
      continue;
    }
    const parsed = parseChordSymbolToken(step.label);
    if (!parsed) {
      return { message: `Could not read chord “${step.label}”. Try C, Am, F, G7, Dm7…` };
    }
    const durBeats = Math.max(0.25, step.beats);
    /** Beat-level rhythm rows use the running beat cursor (matches audition). barBeats anchors full-bar cards only. */
    const barBeat1 =
      durBeats > 1.001 && step.barBeats?.length === 1 ? step.barBeats[0] : undefined;
    const rawSlot = progressionSlotForBeat(beat, durBeats, beatsPerBar, barBeat1);
    const slot = snapGrooveSlot(rawSlot, opts.quantize, barCount);
    const rhythmStaccato = Boolean(step.barBeats?.length) || durBeats <= 1.001;
    const durSlots = rhythmStaccato
      ? Math.max(cellStep, Math.round(Math.min(durBeats, 1) * SLOTS_PER_BEAT))
      : Math.max(cellStep, Math.round(durBeats * SLOTS_PER_BEAT));
    const sustainSlots = snapGrooveSustain(
      slot,
      Math.min(durSlots, maxSustainPerBar),
      opts.quantize,
      barCount,
    );
    const bassRef = grooveLabClampBassRootMidi(Math.min(...parsed.notes));
    const voicing = opts.openJazzNeo
      ? parsed.notes
      : grooveLabLiftChordsAboveBass(bassRef, parsed.notes).filter(
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
        openJazzNeo: opts.openJazzNeo,
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
    steps: [...resolvedSteps],
  };
}
