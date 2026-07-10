/**
 * Synth Geno Live Chord — genre registry, preset build, apply-to-generator.
 */
import type { ChordSymbol } from '@/app/lib/creationStation/chordBuilder';
import type { GenoExtension, GenoPerfMode, GenoBarChordSpec } from '@/app/lib/studio/se2SynthGenoChordEngine';
import type { GenoLoopBarCount } from '@/app/lib/studio/se2SynthGenoLoopBarCount';
import type { GenoChordStyle } from '@/app/lib/studio/se2SynthGenoComposePrompt';
import { genoStylePreset } from '@/app/lib/studio/se2SynthGenoStylePresets';
import { SE2_SYNTH_GENO_CHORD_ACCORD_BANK, se2SynthGenoNormalizePluginSoundSelection, type Se2SynthGenoPluginSoundSelection } from '@/app/lib/studio/se2SynthGenoSoundBank';
import {
  se2SynthGenoLiveRomansToSpecs,
  se2SynthGenoLiveChordModeToKeyMode,
} from '@/app/lib/studio/se2SynthGenoLiveChordRoman';
import {
  se2SynthGenoLiveDraftChordNotes,
  se2SynthGenoLiveChordRootNote,
  se2SynthGenoLiveVoiceSlot,
  se2SynthGenoVoiceLiveChord,
} from '@/app/lib/studio/se2SynthGenoLiveChordVoicing';
import {
  SE2_SYNTH_GENO_LIVE_DARK_DEFS,
  SE2_SYNTH_GENO_LIVE_HIPHOP_DEFS,
  SE2_SYNTH_GENO_LIVE_RNB_DEFS,
  SE2_SYNTH_GENO_LIVE_TRAP_DEFS,
  type Se2SynthGenoLivePresetDef,
} from '@/app/lib/studio/se2SynthGenoLiveChordPresets';
import {
  SE2_SYNTH_GENO_LIVE_DRILL_DEFS,
  SE2_SYNTH_GENO_LIVE_LOFI_DEFS,
  SE2_SYNTH_GENO_LIVE_NEO_SOUL_DEFS,
  SE2_SYNTH_GENO_LIVE_POP_DEFS,
} from '@/app/lib/studio/se2SynthGenoLiveChordPresetsBatch2';
import {
  SE2_SYNTH_GENO_LIVE_AFROBEATS_DEFS,
  SE2_SYNTH_GENO_LIVE_BOOM_BAP_DEFS,
  SE2_SYNTH_GENO_LIVE_GOSPEL_DEFS,
  SE2_SYNTH_GENO_LIVE_HOUSE_DANCE_DEFS,
  SE2_SYNTH_GENO_LIVE_JERSEY_BOUNCE_DEFS,
  SE2_SYNTH_GENO_LIVE_LATIN_TRAP_DEFS,
  SE2_SYNTH_GENO_LIVE_LOFI_CINEMATIC_DEFS,
  SE2_SYNTH_GENO_LIVE_PLUG_RAGE_DEFS,
} from '@/app/lib/studio/se2SynthGenoLiveChordPresetsBatch3';
import { SE2_SYNTH_GENO_LIVE_JAZZ_DEFS } from '@/app/lib/studio/se2SynthGenoLiveChordPresetsJazz';
import { SE2_SYNTH_GENO_LIVE_RNB_POP_DEFS } from '@/app/lib/studio/se2SynthGenoLiveChordPresetsRnbPop';
import { SE2_SYNTH_GENO_LIVE_GUITAR_LINES_DEFS } from '@/app/lib/studio/se2SynthGenoLiveChordPresetsGuitarPort';
import { SE2_SYNTH_GENO_LIVE_KPOP_DEFS } from '@/app/lib/studio/se2SynthGenoLiveChordPresetsKpop';
import {
  se2SynthGenoLiveExtendedRomanLine,
  se2SynthGenoLiveResolvePresetRomans,
} from '@/app/lib/studio/se2SynthGenoLiveProgressionExtend';
import {
  se2SynthGenoTileBarSpecs,
  se2SynthGenoTileRomans,
  se2SynthGenoSpecsToDegrees,
} from '@/app/lib/studio/se2SynthGenoEraProgressionLibrary';
import {
  SE2_SYNTH_GENO_CHORD_DEFAULTS,
  se2SynthGenoRegeneratePluginPart,
  type Se2SynthGenoChordPluginState,
  type Se2SynthGenoPluginDraft,
} from '@/app/lib/studio/se2SynthGenoChordPlugin';
import {
  genoGenerateLiveArpFromHarmony,
  type GenoLiveArpPattern,
  type GenoLiveArpRate,
} from '@/app/lib/studio/se2SynthGenoLiveArpEngine';
import { genoGeneratePluginBassFromHarmony } from '@/app/lib/studio/se2SynthGenoBassEngine';
import { genoGenerateLiveFillerFromHarmony } from '@/app/lib/studio/se2SynthGenoFillerEngine';
import { genoNormalizePluginChordNotes } from '@/app/lib/studio/se2SynthGenoRanges';
import type { StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';
import type {
  Se2SynthGenoLiveGenre,
  Se2SynthGenoLiveGenreId,
  Se2SynthGenoLivePreset,
} from '@/app/lib/studio/se2SynthGenoLiveChordTypes';
import { se2SynthGenoLiveChordCountForPreset } from '@/app/lib/studio/se2SynthGenoLiveChordMap';
import {
  GENRE_VOICING,
  se2SynthGenoLiveGenreSoundSelection,
} from '@/app/lib/studio/se2SynthGenoLiveGenreVoicing';

export { se2SynthGenoLiveGenreSoundSelection };

export const SE2_SYNTH_GENO_LIVE_GENRES: Se2SynthGenoLiveGenre[] = [
  {
    id: 'trap',
    label: 'Trap',
    description: 'Dark minor loops, soul flips, 808-ready 7ths',
    defaultMode: 'minor',
  },
  {
    id: 'hip-hop',
    label: 'Hip-Hop',
    description: 'Boom bap, Dilla vamps, sample-flip harmony',
    defaultMode: 'minor',
  },
  {
    id: 'rnb',
    label: 'R&B',
    description: 'Slow jams, maj7 turns, quiet-storm harmony',
    defaultMode: 'major',
  },
  {
    id: 'rnb-pop',
    label: 'R&B Pop',
    description: 'Radio soul hooks, neo turnarounds, moody chart loops',
    defaultMode: 'major',
  },
  {
    id: 'drill',
    label: 'Chill',
    description: 'Mellow minor loops, soft 7ths, laid-back harmony',
    defaultMode: 'minor',
  },
  {
    id: 'lofi',
    label: 'Lo-Fi',
    description: 'Dusty dorian vamps, tape-warm minor 7ths',
    defaultMode: 'minor',
  },
  {
    id: 'neo-soul',
    label: 'Neo-Soul',
    description: 'Dorian grooves, extended 7ths, Rhodes soul',
    defaultMode: 'dorian',
  },
  {
    id: 'pop',
    label: 'Pop',
    description: 'Chart hooks, I–vi–IV–V maj7 stacks',
    defaultMode: 'major',
  },
  {
    id: 'gospel',
    label: 'Gospel',
    description: 'Church lifts, organ shouts, maj7 praise turns',
    defaultMode: 'major',
  },
  {
    id: 'afrobeats',
    label: 'Afrobeats',
    description: 'Lagos grooves, amapiano lean, sunny maj7 hooks',
    defaultMode: 'major',
  },
  {
    id: 'latin-trap',
    label: 'Latin Trap',
    description: 'Reggaeton dembow, perreo minor, Miami heat',
    defaultMode: 'minor',
  },
  {
    id: 'house-dance',
    label: 'House / Dance',
    description: 'Four-on-floor, deep house, club anthems',
    defaultMode: 'major',
  },
  {
    id: 'jersey-bounce',
    label: 'Jersey / Bounce',
    description: 'Jersey club knock, bounce loops, sample flips',
    defaultMode: 'minor',
  },
  {
    id: 'boom-bap',
    label: 'Boom Bap',
    description: 'Dilla vamps, crate-dig soul, dusty jazz-rap',
    defaultMode: 'minor',
  },
  {
    id: 'plug-rage',
    label: 'Plug / Rage',
    description: 'Plug dark loops, rage 808s, phrygian lean',
    defaultMode: 'minor',
  },
  {
    id: 'lofi-cinematic',
    label: 'Lo-Fi Cinematic',
    description: 'Rain-window pads, soft film dread, ambient loops',
    defaultMode: 'minor',
  },
  {
    id: 'dark-cinematic',
    label: 'Dark · Cinematic',
    description: 'Horror, film tension, phrygian dread',
    defaultMode: 'minor',
  },
  {
    id: 'jazz',
    label: 'Jazz',
    description: 'Standards, ii–V–I, rootless 9/11/13 voicings, reharm',
    defaultMode: 'major',
  },
  {
    id: 'guitar-lines',
    label: 'Guitar Lines',
    description: 'SE2 guitar strummer progressions — pop, R&B, country, soul',
    defaultMode: 'major',
  },
  {
    id: 'kpop',
    label: 'K-Pop',
    description: 'Axis hooks, pre-chorus lifts, EDM drops, K-ballads',
    defaultMode: 'major',
  },
];

const DEFS_BY_GENRE: Record<Se2SynthGenoLiveGenreId, Se2SynthGenoLivePresetDef[]> = {
  trap: SE2_SYNTH_GENO_LIVE_TRAP_DEFS,
  'hip-hop': SE2_SYNTH_GENO_LIVE_HIPHOP_DEFS,
  rnb: SE2_SYNTH_GENO_LIVE_RNB_DEFS,
  'rnb-pop': SE2_SYNTH_GENO_LIVE_RNB_POP_DEFS,
  drill: SE2_SYNTH_GENO_LIVE_DRILL_DEFS,
  lofi: SE2_SYNTH_GENO_LIVE_LOFI_DEFS,
  'neo-soul': SE2_SYNTH_GENO_LIVE_NEO_SOUL_DEFS,
  pop: SE2_SYNTH_GENO_LIVE_POP_DEFS,
  gospel: SE2_SYNTH_GENO_LIVE_GOSPEL_DEFS,
  afrobeats: SE2_SYNTH_GENO_LIVE_AFROBEATS_DEFS,
  'latin-trap': SE2_SYNTH_GENO_LIVE_LATIN_TRAP_DEFS,
  'house-dance': SE2_SYNTH_GENO_LIVE_HOUSE_DANCE_DEFS,
  'jersey-bounce': SE2_SYNTH_GENO_LIVE_JERSEY_BOUNCE_DEFS,
  'boom-bap': SE2_SYNTH_GENO_LIVE_BOOM_BAP_DEFS,
  'plug-rage': SE2_SYNTH_GENO_LIVE_PLUG_RAGE_DEFS,
  'lofi-cinematic': SE2_SYNTH_GENO_LIVE_LOFI_CINEMATIC_DEFS,
  'dark-cinematic': SE2_SYNTH_GENO_LIVE_DARK_DEFS,
  jazz: SE2_SYNTH_GENO_LIVE_JAZZ_DEFS,
  'guitar-lines': SE2_SYNTH_GENO_LIVE_GUITAR_LINES_DEFS,
  kpop: SE2_SYNTH_GENO_LIVE_KPOP_DEFS,
};

function buildPreset(def: Se2SynthGenoLivePresetDef, genreId: Se2SynthGenoLiveGenreId): Se2SynthGenoLivePreset {
  const voicing = GENRE_VOICING[genreId];
  const mode = def.mode === 'harmonicMinor' ? 'harmonicMinor' : def.mode;
  const resolved = se2SynthGenoLiveResolvePresetRomans(def, mode, genreId);
  const romans = resolved.romans;
  const chordSpecs = se2SynthGenoLiveRomansToSpecs(romans, mode, genreId);
  return {
    id: def.id,
    genreId,
    name: def.name,
    tag: def.tag,
    romans,
    loopLength: resolved.loopLength,
    mode,
    chordSpecs,
    romanLine: se2SynthGenoLiveExtendedRomanLine(romans),
    stylePreset: voicing.stylePreset,
    extensions: [...voicing.extensions],
    inversion: voicing.inversion,
    perfMode: voicing.perfMode,
    smartMatch: false,
    soundSelection: se2SynthGenoNormalizePluginSoundSelection({
      ...voicing.soundSelection,
      accordBankId: SE2_SYNTH_GENO_CHORD_ACCORD_BANK,
    }),
    bpm: def.bpm,
  };
}

export function se2SynthGenoLivePresetsForGenre(genreId: Se2SynthGenoLiveGenreId): Se2SynthGenoLivePreset[] {
  return (DEFS_BY_GENRE[genreId] ?? []).map((def) => buildPreset(def, genreId));
}

export function se2SynthGenoLivePresetById(presetId: string): Se2SynthGenoLivePreset | undefined {
  for (const genre of SE2_SYNTH_GENO_LIVE_GENRES) {
    const hit = se2SynthGenoLivePresetsForGenre(genre.id).find((p) => p.id === presetId);
    if (hit) return hit;
  }
  return undefined;
}

export function se2SynthGenoApplyLivePreset(
  state: Se2SynthGenoChordPluginState,
  preset: Se2SynthGenoLivePreset,
): Se2SynthGenoChordPluginState {
  const style = genoStylePreset(preset.stylePreset);
  const slotLoop = se2SynthGenoTileBarSpecs(preset.chordSpecs, state.barCount);
  const slotRomans = se2SynthGenoTileRomans(preset.romans, state.barCount);
  return {
    ...state,
    stylePreset: preset.stylePreset,
    progressionId: style.defaultProgression,
    progressionRomans: slotRomans,
    progressionLoop: slotLoop,
    barChordSpecs: slotLoop,
    barDegrees: se2SynthGenoSpecsToDegrees(slotLoop),
    extensions: [...preset.extensions],
    inversion: preset.inversion,
    perfMode: preset.perfMode,
    smartMatch: preset.smartMatch,
    lockedType: style.lockedType,
    staccato: style.staccato,
    melodyGenre: preset.genreId === 'trap' ? 'trap' : preset.genreId === 'dark-cinematic' ? 'dark' : style.melodyGenre,
    bassPattern: 'root',
    accordBankId: preset.soundSelection.accordBankId,
    melodyBankId: preset.soundSelection.melodyBankId,
    bassBankId: preset.soundSelection.bassBankId,
    fillerBankId: preset.soundSelection.fillerBankId,
    eraCategoryId: undefined,
    eraPresetId: undefined,
  };
}

export function se2SynthGenoLivePresetKeyMode(preset: Se2SynthGenoLivePreset): 'major' | 'minor' {
  return se2SynthGenoLiveChordModeToKeyMode(preset.mode);
}

/** Live panel → Generator: preserve custom play order + per-chord edits. */
export function se2SynthGenoLivePresetFromUserEdits(opts: {
  base: Se2SynthGenoLivePreset;
  editSpecs: readonly GenoBarChordSpec[];
  editRomans?: readonly ChordSymbol[];
  orderedSlotIndices: readonly number[];
}): Se2SynthGenoLivePreset {
  const count = Math.min(
    opts.editSpecs.length,
    opts.editRomans?.length ?? opts.base.loopLength,
    opts.orderedSlotIndices.length || opts.editSpecs.length,
  );
  if (opts.editRomans?.length && opts.editSpecs.length === opts.editRomans.length) {
    const orderedRomans = opts.editRomans.slice(0, count);
    const orderedSpecs = opts.editSpecs.slice(0, count).map((s) => ({ ...s }));
    return {
      ...opts.base,
      romans: orderedRomans,
      loopLength: orderedRomans.length,
      chordSpecs: orderedSpecs,
      romanLine: se2SynthGenoLiveExtendedRomanLine(orderedRomans),
    };
  }
  const slots = opts.orderedSlotIndices.slice(0, count);
  const orderedRomans = slots.map((i) => opts.base.romans[i]!);
  const orderedSpecs = slots.map((i) => ({ ...opts.editSpecs[i]! }));
  return {
    ...opts.base,
    romans: orderedRomans,
    loopLength: orderedRomans.length,
    chordSpecs: orderedSpecs,
    romanLine: se2SynthGenoLiveExtendedRomanLine(orderedRomans),
  };
}

export function se2SynthGenoLivePluginStateFromPreset(
  preset: Se2SynthGenoLivePreset,
  chordSpecs: readonly GenoBarChordSpec[],
  barCount: GenoLoopBarCount,
  toggles: {
    enableChords: boolean;
    enableMelody: boolean;
    enableBass: boolean;
    bassGlide?: boolean;
  },
  accordBankId?: string,
  melodyBankId?: string,
  bassBankId?: string,
): Se2SynthGenoChordPluginState {
  const style = genoStylePreset(preset.stylePreset);
  const loop = [...chordSpecs];
  const tiled = se2SynthGenoTileBarSpecs(loop, barCount);
  return {
    ...SE2_SYNTH_GENO_CHORD_DEFAULTS,
    stylePreset: preset.stylePreset,
    progressionId: style.defaultProgression,
    barCount,
    progressionRomans: [...preset.romans],
    progressionLoop: loop,
    barChordSpecs: tiled,
    barDegrees: se2SynthGenoSpecsToDegrees(tiled),
    extensions: [...preset.extensions],
    inversion: preset.inversion,
    perfMode: preset.perfMode,
    smartMatch: preset.smartMatch,
    lockedType: style.lockedType,
    staccato: style.staccato,
    enableChords: toggles.enableChords,
    enableMelody: toggles.enableMelody,
    enableBass: toggles.enableBass,
    bassGlide: toggles.bassGlide ?? false,
    melodyGenre:
      preset.genreId === 'trap' ? 'trap' : preset.genreId === 'dark-cinematic' ? 'dark' : style.melodyGenre,
    bassPattern: 'root',
    accordBankId: accordBankId ?? preset.soundSelection.accordBankId,
    melodyBankId: melodyBankId ?? preset.soundSelection.melodyBankId,
    bassBankId: bassBankId ?? preset.soundSelection.bassBankId,
    fillerBankId: preset.soundSelection.fillerBankId,
  };
}

export function se2SynthGenoLiveBuildDraft(opts: {
  preset: Se2SynthGenoLivePreset;
  chordSpecs: readonly GenoBarChordSpec[];
  orderedSlotIndices?: readonly number[];
  barCount: GenoLoopBarCount;
  toggles: {
    enableChords: boolean;
    enableMelody: boolean;
    enableBass: boolean;
    enableArp?: boolean;
  enableFiller?: boolean;
  fillerQuant?: import('@/app/lib/studio/se2SynthGenoFillerEngine').GenoFillerQuant;
  arpPattern?: GenoLiveArpPattern;
    arpRate?: GenoLiveArpRate;
    bassGlide?: boolean;
  };
  keyRoot: number;
  keyMode: StudioDetectedKeyMode;
  beatsPerBar: number;
  bpm: number;
  seed?: number;
  accordBankId?: string;
  melodyBankId?: string;
  bassBankId?: string;
  /** Per-bar specs (length = barCount) — overrides tiling chordSpecs when set. */
  barSpecs?: readonly GenoBarChordSpec[];
}): Se2SynthGenoPluginDraft {
  const state = se2SynthGenoLivePluginStateFromPreset(
    opts.preset,
    opts.chordSpecs,
    opts.barCount,
    { ...opts.toggles, enableMelody: false },
    opts.accordBankId,
    opts.melodyBankId,
    opts.bassBankId,
  );
  const seed = opts.seed ?? 1;
  const tiledSpecs =
    opts.barSpecs?.length === opts.barCount
      ? opts.barSpecs.map((s) => ({ ...s }))
      : se2SynthGenoTileBarSpecs(opts.chordSpecs, opts.barCount);
  const slotForBar = (bar: number): number => {
    const loopPos = bar % Math.max(1, opts.preset.loopLength);
    return opts.orderedSlotIndices?.[loopPos] ?? loopPos;
  };
  const draft = se2SynthGenoRegeneratePluginPart({
    draft: null,
    state,
    part: 'all',
    seeds: { chords: seed, melody: seed + 11, bass: seed + 23 },
    keyRoot: opts.keyRoot,
    keyMode: opts.keyMode,
    beatsPerBar: opts.beatsPerBar,
    bpm: opts.bpm,
    stableVoicing: true,
  });

  if (opts.toggles.enableChords) {
    draft.chordNotes = se2SynthGenoLiveDraftChordNotes({
      barSpecs: tiledSpecs,
      barCount: opts.barCount,
      beatsPerBar: opts.beatsPerBar,
      keyRoot: opts.keyRoot,
      chordMode: opts.preset.mode,
      stylePreset: opts.preset.stylePreset,
      extensions: opts.preset.extensions,
      inversion: opts.preset.inversion,
      genreId: opts.preset.genreId,
      preset: opts.preset,
      slotForBar,
    });
  } else {
    draft.chordNotes = [];
  }

  for (let bar = 0; bar < draft.harmony.columns.length; bar += 1) {
    const spec = tiledSpecs[bar];
    const col = draft.harmony.columns[bar];
    if (!spec || !col) continue;
    const tones = se2SynthGenoVoiceLiveChord(
      opts.keyRoot,
      opts.preset.mode,
      spec,
      opts.preset.stylePreset,
      opts.preset.extensions,
      opts.preset.inversion,
      opts.preset.genreId,
    );
    if (tones.length > 0) {
      col.tones = tones;
      col.degree = spec.degree ?? col.degree;
      col.rootMidi = se2SynthGenoLiveChordRootNote(
        opts.keyRoot,
        spec,
        opts.preset.stylePreset,
        opts.preset.genreId,
      ).rootMidi;
    }
  }

  if (opts.toggles.enableArp) {
    draft.melodyNotes = genoGenerateLiveArpFromHarmony({
      harmony: draft.harmony,
      barCount: opts.barCount,
      beatsPerBar: opts.beatsPerBar,
      pattern: opts.toggles.arpPattern ?? 'chord',
      rate: opts.toggles.arpRate ?? '8th',
      seed: seed + 37,
      keyRoot: opts.keyRoot,
      keyMode: opts.keyMode,
      skipBarStart: opts.toggles.enableChords,
    });
  } else {
    draft.melodyNotes = [];
  }

  if (opts.toggles.enableBass) {
    draft.bassNotes = genoGeneratePluginBassFromHarmony({
      harmony: draft.harmony,
      barCount: opts.barCount,
      beatsPerBar: opts.beatsPerBar,
      pattern: state.bassPattern,
      seed: seed + 23,
      keyRoot: opts.keyRoot,
      keyMode: opts.keyMode,
    });
  } else {
    draft.bassNotes = [];
  }

  if (opts.toggles.enableFiller) {
    draft.fillerNotes = genoGenerateLiveFillerFromHarmony({
      harmony: draft.harmony,
      barCount: opts.barCount,
      beatsPerBar: opts.beatsPerBar,
      seed: seed + 51,
      keyRoot: opts.keyRoot,
      keyMode: opts.keyMode,
      quant: opts.toggles.fillerQuant ?? '8th',
    });
  } else {
    draft.fillerNotes = [];
  }

  if (opts.toggles.enableChords && draft.chordNotes.length > 0) {
    draft.chordNotes = genoNormalizePluginChordNotes(draft.chordNotes);
  }

  return draft;
}
