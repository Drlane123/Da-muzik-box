/**
 * Geno Chord Creator — pick / randomize curated progressions and tile to 4 or 8 bars.
 */
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import { MODE_FAMILY, chordSymbolToName, getModeChordSymbols } from '@/app/lib/creationStation/chordBuilder';
import {
  buildGrooveProgressionPresetCatalog,
  presetToGrooveSteps,
  suggestNextChordLabels,
  type GrooveProgressionPresetEntry,
} from '@/app/lib/creationStation/grooveLabProgressionLibrary';
import {
  newProgressionStepId,
  type GrooveProgressionStep,
} from '@/app/lib/creationStation/grooveLabProgressionBuilder';
import type { StudioHarmonyLoopBars } from '@/app/lib/studio/studioInstrumentHarmony';

function presetMatchesMode(entry: GrooveProgressionPresetEntry, mode: ChordMode): boolean {
  const want = MODE_FAMILY[mode];
  const have = MODE_FAMILY[entry.mode];
  if (want === 'other') return have === 'other';
  return want === have;
}

export function se2ChordGeniePresetCatalog(
  keyRoot: number,
  mode: ChordMode,
): GrooveProgressionPresetEntry[] {
  return buildGrooveProgressionPresetCatalog(keyRoot).filter((p) => presetMatchesMode(p, mode));
}

/** @deprecated */
export const se2GenoChordCreatorPresetCatalog = se2ChordGeniePresetCatalog;

/** Build a bar-per-chord progression from a wheel tonic + genre style. */
export function se2GenerateFromWheelTonic(opts: {
  keyRoot: number;
  mode: ChordMode;
  loopBars: StudioHarmonyLoopBars;
  beatsPerBar: number;
  genreId: string;
  presetId?: string;
  seed?: number;
}): GrooveProgressionStep[] {
  const bpb = Math.max(1, opts.beatsPerBar);
  const symbols = getModeChordSymbols(opts.mode);
  const tonicLabel = chordSymbolToName(symbols[0]!, opts.keyRoot, opts.mode);
  const steps: GrooveProgressionStep[] = [];
  let draft: GrooveProgressionStep[] = [];

  for (let bar = 0; bar < opts.loopBars; bar += 1) {
    let label = tonicLabel;
    if (bar > 0) {
      const next = suggestNextChordLabels(draft, {
        keyRoot: opts.keyRoot,
        mode: opts.mode,
        genreId: opts.genreId,
        topK: 1,
      });
      label = next[0]?.label?.trim() || tonicLabel;
    }
    const step: GrooveProgressionStep = {
      id: newProgressionStepId(),
      label,
      beats: bpb,
      rest: false,
    };
    steps.push(step);
    draft = [...draft, step];
  }
  return steps;
}

/** Prefer a curated preset whose first chord matches the wheel tonic; else wheel walk. */
export function se2GenerateFromWheelSelection(opts: {
  keyRoot: number;
  mode: ChordMode;
  loopBars: StudioHarmonyLoopBars;
  beatsPerBar: number;
  genreId: string;
  presetId?: string;
  seed?: number;
}): Se2ChordGenieGenerateResult {
  const catalog = se2ChordGeniePresetCatalog(opts.keyRoot, opts.mode).filter(
    (p) => !opts.genreId || p.genreId === opts.genreId,
  );
  const symbols = getModeChordSymbols(opts.mode);
  const tonicLabel = chordSymbolToName(symbols[0]!, opts.keyRoot, opts.mode);

  let presetId = (opts.presetId ?? '').trim();
  let def = presetId ? catalog.find((p) => p.id === presetId) : undefined;

  if (!def && catalog.length > 0) {
    const tonicMatch = catalog.find((p) => {
      const raw = presetToGrooveSteps(p.id, opts.keyRoot);
      const first = raw.find((s) => !s.rest && s.label.trim());
      return first?.label.trim().toLowerCase() === tonicLabel.toLowerCase();
    });
    if (tonicMatch) {
      def = tonicMatch;
      presetId = tonicMatch.id;
    } else {
      const idx = seededIndex(opts.seed ?? Date.now(), catalog.length);
      def = catalog[idx]!;
      presetId = def.id;
    }
  }

  if (def) {
    const raw = presetToGrooveSteps(presetId, opts.keyRoot);
    if (raw.length > 0) {
      const steps = se2TileStepsOneChordPerBar(raw, opts.loopBars, opts.beatsPerBar);
      if (steps.length > 0) {
        return { steps, presetId, presetLabel: def.label };
      }
    }
  }

  const steps = se2GenerateFromWheelTonic({ ...opts, seed: opts.seed ?? Date.now() });
  return {
    steps,
    presetId: presetId || '',
    presetLabel: `Wheel · ${tonicLabel} · ${opts.genreId}`,
  };
}

export type Se2GenoChordCreatorGenerateResult = Se2ChordGenieGenerateResult;
export const se2GenerateGenoChordCreatorProgression = se2GenerateChordGenieProgression;

/** One chord per bar — SE2 Chord Generator card row. */
export function se2TileStepsOneChordPerBar(
  steps: readonly GrooveProgressionStep[],
  barCount: StudioHarmonyLoopBars,
  beatsPerBar: number,
): GrooveProgressionStep[] {
  const playable = steps.filter((s) => !s.rest && s.label.trim());
  if (playable.length === 0) return [];
  const bpb = Math.max(1, beatsPerBar);
  const out: GrooveProgressionStep[] = [];
  for (let i = 0; i < barCount; i += 1) {
    const src = playable[i % playable.length]!;
    out.push({
      id: newProgressionStepId(),
      label: src.label.trim(),
      beats: bpb,
      rest: false,
    });
  }
  return out;
}

function seededIndex(seed: number, max: number): number {
  if (max <= 0) return 0;
  const x = Math.abs(Math.sin(seed * 12.9898) * 43758.5453);
  return Math.floor((x - Math.floor(x)) * max) % max;
}

export type Se2ChordGenieGenerateResult =
  | {
      steps: GrooveProgressionStep[];
      presetId: string;
      presetLabel: string;
    }
  | { message: string };

export function se2GenerateChordGenieProgression(opts: {
  keyRoot: number;
  mode: ChordMode;
  loopBars: StudioHarmonyLoopBars;
  beatsPerBar: number;
  presetId?: string;
  seed?: number;
}): Se2ChordGenieGenerateResult {
  const catalog = se2ChordGeniePresetCatalog(opts.keyRoot, opts.mode);
  if (catalog.length === 0) {
    return { message: 'No progressions for this key / mode.' };
  }

  let presetId = (opts.presetId ?? '').trim();
  let def = presetId ? catalog.find((p) => p.id === presetId) : undefined;
  if (!def) {
    const idx = seededIndex(opts.seed ?? Date.now(), catalog.length);
    def = catalog[idx]!;
    presetId = def.id;
  }

  const raw = presetToGrooveSteps(presetId, opts.keyRoot);
  if (raw.length === 0) {
    return { message: 'Could not load progression preset.' };
  }

  const steps = se2TileStepsOneChordPerBar(raw, opts.loopBars, opts.beatsPerBar);
  if (steps.length === 0) {
    return { message: 'No playable chords in this preset.' };
  }

  return { steps, presetId, presetLabel: def.label };
}
