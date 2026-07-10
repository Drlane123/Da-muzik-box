/**
 * Chord Generator — per-bar melody / bass regen (mirrors Live Chord loop controls).
 */
import type { GenoBarChordSpec } from '@/app/lib/studio/se2SynthGenoChordEngine';
import {
  genoFinalizePluginBassNotes,
  genoGeneratePluginBassForBar,
  type GenoBassPattern,
} from '@/app/lib/studio/se2SynthGenoBassEngine';
import {
  genoGeneratePluginMelodyForBar,
  type GenoMelodyGenre,
} from '@/app/lib/studio/se2SynthGenoMelodyEngine';
import {
  genoNotesInBar,
  genoReplaceBarNotes,
} from '@/app/lib/studio/se2SynthGenoLiveBarRegen';
import type { StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';

export type Se2SynthGenoPluginBarLanePart = 'melody' | 'bass';

export function se2SynthGenoPluginBarLaneUndoKey(part: Se2SynthGenoPluginBarLanePart, bar: number): string {
  return `plugin-${part}-${bar}`;
}

export type Se2SynthGenoPluginRegenContext = {
  keyRoot: number;
  keyMode: StudioDetectedKeyMode;
  beatsPerBar: number;
  barCount: number;
  melodyBaseSeed: number;
  bassBaseSeed: number;
  melodyGenre: GenoMelodyGenre;
  bassPattern: GenoBassPattern;
  enableMelody?: boolean;
  enableBass?: boolean;
  barChordSpecs?: readonly GenoBarChordSpec[];
};

export function se2SynthGenoPluginRegenerateBarLane(
  draft: Se2SynthGenoPluginDraft,
  bar: number,
  part: Se2SynthGenoPluginBarLanePart,
  barSeed: number,
  ctx: Se2SynthGenoPluginRegenContext,
): Pick<Se2SynthGenoPluginDraft, 'melodyNotes' | 'bassNotes'> {
  const { beatsPerBar } = ctx;

  if (part === 'melody' && ctx.enableMelody !== false) {
    const barMelody = genoGeneratePluginMelodyForBar({
      harmony: draft.harmony,
      bar,
      beatsPerBar,
      barCount: ctx.barCount,
      style: ctx.melodyGenre,
      seed: ctx.melodyBaseSeed + 37 + barSeed * 131,
      keyRoot: ctx.keyRoot,
      keyMode: ctx.keyMode,
      barChordSpecs: ctx.barChordSpecs,
    });
    return {
      melodyNotes: genoReplaceBarNotes(draft.melodyNotes, barMelody, bar, beatsPerBar),
      bassNotes: draft.bassNotes,
    };
  }

  const barBass = genoGeneratePluginBassForBar({
    harmony: draft.harmony,
    bar,
    beatsPerBar,
    pattern: ctx.bassPattern,
    seed: ctx.bassBaseSeed + 23 + barSeed * 149,
    keyRoot: ctx.keyRoot,
    keyMode: ctx.keyMode,
  });
  const mergedBass = genoReplaceBarNotes(draft.bassNotes, barBass, bar, beatsPerBar);
  return {
    melodyNotes: draft.melodyNotes,
    bassNotes: genoFinalizePluginBassNotes(
      mergedBass,
      draft.harmony,
      beatsPerBar,
      ctx.keyRoot,
      ctx.keyMode,
    ),
  };
}

export function se2SynthGenoPluginUndoBarLane(
  draft: Se2SynthGenoPluginDraft,
  bar: number,
  part: Se2SynthGenoPluginBarLanePart,
  savedNotes: readonly StudioEditor2GenNote[],
  beatsPerBar: number,
): Pick<Se2SynthGenoPluginDraft, 'melodyNotes' | 'bassNotes'> {
  if (part === 'melody') {
    return {
      melodyNotes: genoReplaceBarNotes(draft.melodyNotes, savedNotes, bar, beatsPerBar),
      bassNotes: draft.bassNotes,
    };
  }
  return {
    melodyNotes: draft.melodyNotes,
    bassNotes: genoReplaceBarNotes(draft.bassNotes, savedNotes, bar, beatsPerBar),
  };
}

export { genoNotesInBar };
