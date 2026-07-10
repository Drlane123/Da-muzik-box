/**
 * Live Chord — per-lane and per-bar arp / bass / chord regen (isolated parts).
 */
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import type { GenoBarChordSpec } from '@/app/lib/studio/se2SynthGenoChordEngine';
import type { Se2SynthGenoPluginDraft } from '@/app/lib/studio/se2SynthGenoChordPlugin';
import { genoGeneratePluginBassFromHarmony, type GenoBassPattern } from '@/app/lib/studio/se2SynthGenoBassEngine';
import { genoGenerateLiveFillerFromHarmony } from '@/app/lib/studio/se2SynthGenoFillerEngine';
import {
  genoGenerateLiveArpForBar,
  genoGenerateLiveArpFromHarmony,
  type GenoLiveArpPattern,
  type GenoLiveArpRate,
} from '@/app/lib/studio/se2SynthGenoLiveArpEngine';
import { se2SynthGenoLiveDraftChordNotes, se2SynthGenoLiveChordRootNote, se2SynthGenoVoiceLiveChord } from '@/app/lib/studio/se2SynthGenoLiveChordVoicing';
import type { GenoExtension } from '@/app/lib/studio/se2SynthGenoChordEngine';
import type { GenoChordStyle } from '@/app/lib/studio/se2SynthGenoComposePrompt';
import type { Se2SynthGenoLiveGenreId } from '@/app/lib/studio/se2SynthGenoLiveChordTypes';
import type { StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';
import { genoNormalizePluginChordNotes } from '@/app/lib/studio/se2SynthGenoRanges';

export type Se2SynthGenoLiveBarLanePart = 'arp' | 'bass';
export type Se2SynthGenoLiveLanePart = 'chords' | Se2SynthGenoLiveBarLanePart | 'filler';

export function se2SynthGenoLiveBarLaneUndoKey(part: Se2SynthGenoLiveBarLanePart, bar: number): string {
  return `${part}-${bar}`;
}

export function genoReplaceBarNotes(
  allNotes: readonly StudioEditor2GenNote[],
  barNotes: readonly StudioEditor2GenNote[],
  bar: number,
  beatsPerBar: number,
): StudioEditor2GenNote[] {
  const lo = bar * beatsPerBar;
  const hi = lo + beatsPerBar;
  const kept = allNotes.filter((n) => n.startBeat < lo - 1e-6 || n.startBeat >= hi - 1e-6);
  return [...kept, ...barNotes].sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
}

export function genoNotesInBar(
  notes: readonly StudioEditor2GenNote[],
  bar: number,
  beatsPerBar: number,
): StudioEditor2GenNote[] {
  const lo = bar * beatsPerBar;
  const hi = lo + beatsPerBar;
  return notes
    .filter((n) => n.startBeat >= lo - 1e-6 && n.startBeat < hi - 1e-6)
    .map((n) => ({ ...n }));
}

export type Se2SynthGenoLiveRegenContext = {
  keyRoot: number;
  keyMode: StudioDetectedKeyMode;
  beatsPerBar: number;
  barCount: number;
  baseSeed: number;
  chordMode: ChordMode;
  stylePreset: GenoChordStyle;
  extensions: readonly GenoExtension[];
  inversion: number;
  genreId: Se2SynthGenoLiveGenreId;
  tiledSpecs: readonly GenoBarChordSpec[];
  arpPattern?: GenoLiveArpPattern;
  arpRate?: GenoLiveArpRate;
  bassPattern?: GenoBassPattern;
  enableChords?: boolean;
  enableArp?: boolean;
  enableBass?: boolean;
  enableFiller?: boolean;
  fillerQuant?: import('@/app/lib/studio/se2SynthGenoFillerEngine').GenoFillerQuant;
};

function syncHarmonyFromLiveSpecs(
  draft: Se2SynthGenoPluginDraft,
  ctx: Se2SynthGenoLiveRegenContext,
): void {
  for (let bar = 0; bar < draft.harmony.columns.length; bar += 1) {
    const spec = ctx.tiledSpecs[bar];
    const col = draft.harmony.columns[bar];
    if (!spec || !col) continue;
    const voicedSpec = {
      ...spec,
      inversion: spec.inversion ?? ctx.inversion,
    };
    const tones = se2SynthGenoVoiceLiveChord(
      ctx.keyRoot,
      ctx.chordMode,
      voicedSpec,
      ctx.stylePreset,
      ctx.extensions,
      ctx.inversion,
      ctx.genreId,
    );
    if (tones.length > 0) {
      col.tones = tones;
      col.rootMidi = se2SynthGenoLiveChordRootNote(
        ctx.keyRoot,
        voicedSpec,
        ctx.stylePreset,
        ctx.genreId,
      ).rootMidi;
    }
  }
}

/** Regenerate one full lane only — does not touch other lanes. */
export function se2SynthGenoLiveRegenerateLanePart(
  draft: Se2SynthGenoPluginDraft,
  part: Se2SynthGenoLiveLanePart,
  laneSeed: number,
  ctx: Se2SynthGenoLiveRegenContext,
): Se2SynthGenoPluginDraft {
  const next: Se2SynthGenoPluginDraft = {
    ...draft,
    harmony: {
      ...draft.harmony,
      columns: draft.harmony.columns.map((c) => ({ ...c, tones: [...c.tones] })),
    },
    chordNotes: [...draft.chordNotes],
    melodyNotes: [...draft.melodyNotes],
    bassNotes: [...draft.bassNotes],
    fillerNotes: [...(draft.fillerNotes ?? [])],
  };

  if (part === 'chords' && ctx.enableChords !== false) {
    syncHarmonyFromLiveSpecs(next, ctx);
    const specs = ctx.tiledSpecs.map((spec) => ({
      ...spec,
      inversion: ((spec.inversion ?? ctx.inversion) + (laneSeed % 3)) % 3,
    }));
    next.chordNotes = genoNormalizePluginChordNotes(
      se2SynthGenoLiveDraftChordNotes({
        barSpecs: specs,
        barCount: ctx.barCount,
        beatsPerBar: ctx.beatsPerBar,
        keyRoot: ctx.keyRoot,
        chordMode: ctx.chordMode,
        stylePreset: ctx.stylePreset,
        extensions: ctx.extensions,
        inversion: ctx.inversion,
        genreId: ctx.genreId,
      }),
    );
    return next;
  }

  if (part === 'arp' && ctx.enableArp === false) {
    next.melodyNotes = [];
    return next;
  }

  if (part === 'arp' && ctx.enableArp !== false) {
    syncHarmonyFromLiveSpecs(next, ctx);
    next.melodyNotes = genoGenerateLiveArpFromHarmony({
      harmony: next.harmony,
      barCount: ctx.barCount,
      beatsPerBar: ctx.beatsPerBar,
      pattern: ctx.arpPattern ?? 'chord',
      rate: ctx.arpRate ?? '8th',
      seed: ctx.baseSeed + 37 + laneSeed * 53,
      keyRoot: ctx.keyRoot,
      keyMode: ctx.keyMode,
      skipBarStart: ctx.enableChords !== false,
    });
    return next;
  }

  if (part === 'bass' && ctx.enableBass !== false) {
    next.bassNotes = genoGeneratePluginBassFromHarmony({
      harmony: next.harmony,
      barCount: ctx.barCount,
      beatsPerBar: ctx.beatsPerBar,
      pattern: ctx.bassPattern ?? 'root',
      seed: ctx.baseSeed + 23 + laneSeed * 61,
      keyRoot: ctx.keyRoot,
      keyMode: ctx.keyMode,
    });
    return next;
  }

  if (part === 'filler' && ctx.enableFiller === false) {
    next.fillerNotes = [];
    return next;
  }

  if (part === 'filler' && ctx.enableFiller !== false) {
    syncHarmonyFromLiveSpecs(next, ctx);
    next.fillerNotes = genoGenerateLiveFillerFromHarmony({
      harmony: next.harmony,
      barCount: ctx.barCount,
      beatsPerBar: ctx.beatsPerBar,
      seed: ctx.baseSeed + 51 + laneSeed * 67,
      keyRoot: ctx.keyRoot,
      keyMode: ctx.keyMode,
      quant: ctx.fillerQuant ?? '8th',
    });
  }

  return next;
}

export function se2SynthGenoLiveRegenerateBarLane(
  draft: Se2SynthGenoPluginDraft,
  bar: number,
  part: Se2SynthGenoLiveBarLanePart,
  barSeed: number,
  ctx: Se2SynthGenoLiveRegenContext,
): Pick<Se2SynthGenoPluginDraft, 'melodyNotes' | 'bassNotes'> {
  const { beatsPerBar } = ctx;
  const barLo = bar * beatsPerBar;
  const barHi = barLo + beatsPerBar;

  if (part === 'arp') {
    if (ctx.enableArp === false) {
      return {
        melodyNotes: genoReplaceBarNotes(draft.melodyNotes, [], bar, beatsPerBar),
        bassNotes: draft.bassNotes,
      };
    }
    const harmonyDraft: Se2SynthGenoPluginDraft = {
      ...draft,
      harmony: {
        ...draft.harmony,
        columns: draft.harmony.columns.map((c) => ({ ...c, tones: [...c.tones] })),
      },
    };
    syncHarmonyFromLiveSpecs(harmonyDraft, ctx);
    const barArp = genoGenerateLiveArpForBar({
      harmony: harmonyDraft.harmony,
      bar,
      beatsPerBar,
      barCount: draft.harmony.columns.length,
      pattern: ctx.arpPattern ?? 'chord',
      rate: ctx.arpRate ?? '8th',
      seed: ctx.baseSeed + 37 + barSeed * 131,
      keyRoot: ctx.keyRoot,
      keyMode: ctx.keyMode,
      skipBarStart: ctx.enableChords !== false,
    });
    return {
      melodyNotes: genoReplaceBarNotes(draft.melodyNotes, barArp, bar, beatsPerBar),
      bassNotes: draft.bassNotes,
    };
  }

  const bassAll = genoGeneratePluginBassFromHarmony({
    harmony: draft.harmony,
    barCount: draft.harmony.columns.length,
    beatsPerBar,
    pattern: ctx.bassPattern ?? 'root',
    seed: ctx.baseSeed + 23 + barSeed * 149,
    keyRoot: ctx.keyRoot,
    keyMode: ctx.keyMode,
  });
  const barBass = bassAll.filter(
    (n) => n.startBeat >= barLo - 1e-6 && n.startBeat < barHi - 1e-6,
  );
  return {
    melodyNotes: draft.melodyNotes,
    bassNotes: genoReplaceBarNotes(draft.bassNotes, barBass, bar, beatsPerBar),
  };
}

export function se2SynthGenoLiveUndoBarLane(
  draft: Se2SynthGenoPluginDraft,
  bar: number,
  part: Se2SynthGenoLiveBarLanePart,
  savedNotes: readonly StudioEditor2GenNote[],
  beatsPerBar: number,
): Pick<Se2SynthGenoPluginDraft, 'melodyNotes' | 'bassNotes'> {
  if (part === 'arp') {
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
