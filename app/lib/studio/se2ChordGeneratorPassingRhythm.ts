/**
 * SE2 Chord Generator — in-bar passing chords + mixed harmonic rhythm.
 */
import type { ChordMode, ChordSymbol } from '@/app/lib/creationStation/chordBuilder';
import { chordSymbolToName } from '@/app/lib/creationStation/chordBuilder';
import {
  inferRomanFromLabel,
  suggestNextChordLabels,
} from '@/app/lib/creationStation/grooveLabProgressionLibrary';
import {
  newProgressionStepId,
  type GrooveProgressionStep,
} from '@/app/lib/creationStation/grooveLabProgressionBuilder';
import { se2SynthGenoPassingChordsBetween } from '@/app/lib/studio/se2SynthGenoHarmonyIntel';
import type { Se2SynthGenoLiveGenreId } from '@/app/lib/studio/se2SynthGenoLiveChordTypes';

export type Se2PassingRhythmOpts = {
  keyRoot: number;
  mode: ChordMode;
  genreId: string;
  beatsPerBar: number;
  seed?: number;
  /** 0–1 — share of bars that get harmonic motion (default 0.78). */
  density?: number;
  /** Skip this label when cycling (e.g. current passing tail on regenerate). */
  skipLabel?: string;
  /** Extra offset when picking the next passing option. */
  cycleIndex?: number;
};

function seededUnit(seed: number, salt: number): number {
  const x = Math.abs(Math.sin((seed + salt * 17.13) * 12.9898) * 43758.5453);
  return x - Math.floor(x);
}

function seededIndex(seed: number, salt: number, max: number): number {
  if (max <= 0) return 0;
  return Math.floor(seededUnit(seed, salt) * max) % max;
}

function snapBeats(beats: number, bpb: number): number {
  const q = Math.max(0.25, bpb / 4);
  return Math.max(q, Math.round(beats / q) * q);
}

/** Map Chord Generator / catalog pack ids onto Synth Geno live genre vocabulary. */
function liveGenreIdForPassing(genreId: string): Se2SynthGenoLiveGenreId {
  const id = genreId.trim().toLowerCase();
  if (id === 'neo-soul' || id === 'neo-soul-eras') return 'neo-soul';
  if (id === 'rnb' || id === 'rnb-true' || id.startsWith('rnb') || id === 'soul-eras') return 'rnb';
  if (id === 'gospel') return 'gospel';
  if (id === 'jazz') return 'jazz';
  if (id === 'trap' || id === 'drill') return 'trap';
  if (id === 'lofi') return 'lofi';
  if (id === 'pop' || id.startsWith('pop') || id === 'doowop' || id.includes('ballad')) return 'pop';
  if (id === 'house' || id === 'dance' || id === 'disco') return 'house-dance';
  if (id === 'kpop' || id === 'kpop-eras') return 'kpop';
  if (id === 'afrobeat' || id === 'afro') return 'afrobeats';
  if (id === 'hiphop' || id === 'hip-hop') return 'hip-hop';
  return 'rnb';
}

function passingLabelForBar(
  fromLabel: string,
  toLabel: string,
  opts: Se2PassingRhythmOpts,
  barIndex: number,
): string | null {
  const fromRoman = inferRomanFromLabel(fromLabel, opts.keyRoot, opts.mode);
  const toRoman = inferRomanFromLabel(toLabel, opts.keyRoot, opts.mode);
  const fromNorm = fromLabel.trim().toLowerCase();
  const skipNorm = opts.skipLabel?.trim().toLowerCase();
  const cycle = Math.max(0, opts.cycleIndex ?? 0);
  const liveGenre = liveGenreIdForPassing(opts.genreId);

  const labelOk = (label: string) => {
    const norm = label.trim().toLowerCase();
    return norm.length > 0 && norm !== fromNorm && norm !== skipNorm;
  };

  if (fromRoman && toRoman) {
    const passing = se2SynthGenoPassingChordsBetween(
      fromRoman as ChordSymbol,
      toRoman as ChordSymbol,
      opts.mode,
      { genreId: liveGenre, maxOptions: 12, includeClusters: false },
    );
    if (passing.length > 0) {
      const start =
        (seededIndex(opts.seed ?? 0, barIndex + 3, passing.length) + cycle) % passing.length;
      for (let k = 0; k < passing.length; k += 1) {
        const pick = passing[(start + k) % passing.length]!;
        const label = chordSymbolToName(pick.roman, opts.keyRoot, opts.mode);
        if (labelOk(label)) return label;
      }
    }
  }

  const climb = suggestNextChordLabels(
    [{ id: 'x', label: fromLabel, beats: opts.beatsPerBar, rest: false }],
    { keyRoot: opts.keyRoot, mode: opts.mode, genreId: opts.genreId, topK: 6 },
  );
  const start = (seededIndex(opts.seed ?? 0, barIndex + 11, Math.max(1, climb.length)) + cycle) % Math.max(1, climb.length);
  for (let k = 0; k < climb.length; k += 1) {
    const hit = climb[(start + k) % climb.length];
    const label = hit?.label?.trim();
    if (label && labelOk(label)) return label;
  }

  const toNorm = toLabel.trim().toLowerCase();
  if (toNorm && labelOk(toLabel.trim())) return toLabel.trim();

  return null;
}

/**
 * Split bar-aligned steps into long + short moves — passing tails on final beats,
 * occasional half-bar climbs into the next harmony.
 */
export function se2ApplyPassingChordHarmonicRhythm(
  barSteps: readonly GrooveProgressionStep[],
  opts: Se2PassingRhythmOpts,
): GrooveProgressionStep[] {
  const playable = barSteps.filter((s) => !s.rest && s.label.trim());
  if (playable.length === 0) return [];

  const bpb = Math.max(1, opts.beatsPerBar);
  const density = opts.density ?? 0.78;
  const seed = opts.seed ?? Date.now();
  const out: GrooveProgressionStep[] = [];
  const barCount = playable.length;

  for (let i = 0; i < barCount; i += 1) {
    const current = playable[i]!;
    const next = playable[(i + 1) % barCount]!;
    const label = current.label.trim();
    const roll = seededUnit(seed, i);

    if (roll > density || bpb < 2) {
      out.push({
        id: newProgressionStepId(),
        label,
        beats: bpb,
        rest: false,
      });
      continue;
    }

    const patternRoll = seededUnit(seed, i + 50);
    const passLabel = passingLabelForBar(label, next.label.trim(), opts, i);

    if (patternRoll < 0.22 && bpb >= 4 && passLabel) {
      const half = bpb / 2;
      out.push({
        id: newProgressionStepId(),
        label,
        beats: half,
        rest: false,
      });
      out.push({
        id: newProgressionStepId(),
        label: passLabel,
        beats: half,
        rest: false,
      });
      continue;
    }

    const passBeats = snapBeats(Math.max(bpb / 4, 1), bpb);
    const holdBeats = snapBeats(bpb - passBeats, bpb);
    if (!passLabel || holdBeats < passBeats) {
      out.push({
        id: newProgressionStepId(),
        label,
        beats: bpb,
        rest: false,
      });
      continue;
    }

    out.push({
      id: newProgressionStepId(),
      label,
      beats: holdBeats,
      rest: false,
    });
    out.push({
      id: newProgressionStepId(),
      label: passLabel,
      beats: passBeats,
      rest: false,
    });
  }

  return out;
}

/** Card row — primary chord label per bar (passing moves stay on the roll). */
export function se2PrimaryChordLabelsPerBar(
  steps: readonly GrooveProgressionStep[],
  barCount: number,
  beatsPerBar: number,
): string[] {
  const bpb = Math.max(1, beatsPerBar);
  const labels: string[] = Array.from({ length: barCount }, () => '—');
  let beat = 0;

  for (const step of steps) {
    if (step.rest || !step.label.trim()) {
      beat += Math.max(0, step.beats);
      continue;
    }
    const startBar = Math.min(barCount - 1, Math.floor(beat / bpb));
    if (labels[startBar] === '—') {
      labels[startBar] = step.label.trim();
    }
    beat += Math.max(0, step.beats);
  }

  return labels;
}

/** Collapse draft steps to one chord per bar for the chosen loop length (4 / 8). */
export function se2HarmonyStepsForLoopBars(
  steps: readonly GrooveProgressionStep[],
  barCount: number,
  beatsPerBar: number,
): GrooveProgressionStep[] {
  const bpb = Math.max(1, beatsPerBar);
  const labels = se2PrimaryChordLabelsPerBar(steps, barCount, bpb);
  return labels.map((label) => ({
    id: newProgressionStepId(),
    label: label === '—' ? '' : label,
    beats: bpb,
    rest: label === '—' || !label.trim(),
  }));
}

/** Ruler text — main chord plus passing tail when present. */
export function se2BarDisplayLabelsPerBar(
  steps: readonly GrooveProgressionStep[],
  barCount: number,
  beatsPerBar: number,
): string[] {
  const groups = stepsToBarGroups(steps, barCount, Math.max(1, beatsPerBar));
  return groups.map((group) => {
    const playable = group.filter((s) => !s.rest && s.label.trim());
    if (playable.length === 0) return '—';
    if (playable.length === 1) return playable[0]!.label.trim();
    const main = primaryLabelInBar(group);
    const pass = playable.find((s) => s.label.trim() !== main)?.label.trim();
    return pass ? `${main} → ${pass}` : main;
  });
}

function stepsToBarGroups(
  steps: readonly GrooveProgressionStep[],
  barCount: number,
  bpb: number,
): GrooveProgressionStep[][] {
  const groups: GrooveProgressionStep[][] = Array.from({ length: barCount }, () => []);
  let beat = 0;
  for (const step of steps) {
    let remaining = Math.max(0, step.beats);
    let cursor = beat;
    while (remaining > 1e-6) {
      const bar = Math.min(barCount - 1, Math.floor(cursor / bpb));
      const barEnd = (bar + 1) * bpb;
      const chunk = Math.min(remaining, barEnd - cursor);
      if (chunk > 1e-6) {
        groups[bar]!.push({
          id: newProgressionStepId(),
          label: step.label,
          beats: chunk,
          rest: step.rest,
        });
      }
      remaining -= chunk;
      cursor += chunk;
    }
    beat += Math.max(0, step.beats);
  }
  return groups;
}

function barGroupsToSteps(groups: readonly GrooveProgressionStep[][]): GrooveProgressionStep[] {
  const out: GrooveProgressionStep[] = [];
  for (const bar of groups) {
    for (const s of bar) out.push(s);
  }
  return out;
}

function primaryLabelInBar(group: readonly GrooveProgressionStep[]): string {
  const playable = group.filter((s) => !s.rest && s.label.trim());
  if (playable.length === 0) return '';
  return playable.reduce((best, s) => (s.beats > best.beats ? s : best)).label.trim();
}

/** Passing tail label on one bar, if any. */
export function se2PassingTailLabelForBar(
  steps: readonly GrooveProgressionStep[],
  barIndex: number,
  barCount: number,
  beatsPerBar: number,
): string | null {
  const bpb = Math.max(1, beatsPerBar);
  if (barIndex < 0 || barIndex >= barCount) return null;
  const groups = stepsToBarGroups(steps, barCount, bpb);
  const group = groups[barIndex] ?? [];
  const playable = group.filter((s) => !s.rest && s.label.trim());
  if (playable.length < 2) return null;
  const main = primaryLabelInBar(group);
  return playable.find((s) => s.label.trim() !== main)?.label.trim() ?? null;
}

export function se2BarHasPassingTail(
  steps: readonly GrooveProgressionStep[],
  barIndex: number,
  barCount: number,
  beatsPerBar: number,
): boolean {
  return se2PassingTailLabelForBar(steps, barIndex, barCount, beatsPerBar) != null;
}

/** Add / refresh a passing tail on one bar (0-based index). */
export function se2InjectPassingChordAtBar(
  steps: readonly GrooveProgressionStep[],
  barIndex: number,
  barCount: number,
  opts: Se2PassingRhythmOpts,
): { steps: GrooveProgressionStep[]; passLabel: string | null; message?: string } {
  const bpb = Math.max(1, opts.beatsPerBar);
  if (barIndex < 0 || barIndex >= barCount) {
    return { steps: [...steps], passLabel: null, message: 'Pick a valid bar.' };
  }

  const groups = stepsToBarGroups(steps, barCount, bpb);
  const mainLabel = primaryLabelInBar(groups[barIndex]!);
  if (!mainLabel) {
    return { steps: [...steps], passLabel: null, message: `Bar ${barIndex + 1} has no chord yet.` };
  }

  const nextBar = (barIndex + 1) % barCount;
  const toLabel = primaryLabelInBar(groups[nextBar]!) || mainLabel;
  const passLabel = passingLabelForBar(mainLabel, toLabel, opts, barIndex);
  if (!passLabel) {
    return { steps: [...steps], passLabel: null, message: 'No passing chord found for this move.' };
  }

  const passBeats = snapBeats(Math.max(bpb / 4, 1), bpb);
  const holdBeats = snapBeats(bpb - passBeats, bpb);
  if (holdBeats < passBeats) {
    return { steps: [...steps], passLabel: null, message: 'Bar too short for a passing tail.' };
  }

  groups[barIndex] = [
    {
      id: newProgressionStepId(),
      label: mainLabel,
      beats: holdBeats,
      rest: false,
    },
    {
      id: newProgressionStepId(),
      label: passLabel,
      beats: passBeats,
      rest: false,
    },
  ];

  return {
    steps: barGroupsToSteps(groups),
    passLabel,
    message: `Bar ${barIndex + 1}: ${mainLabel} → ${passLabel}`,
  };
}
