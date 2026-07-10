/**
 * Synth Geno Chord Generator — panel settings → standalone chord engine.
 */
import type { StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';
import type { ChordSymbol } from '@/app/lib/creationStation/chordBuilder';
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';
import {
  genoBuildHarmony,
  genoHarmonyToNotes,
  GENO_PROGRESSIONS,
  type GenoChordBuildSettings,
  type GenoBarChordSpec,
  type GenoChordType,
  type GenoExtension,
  type GenoHarmony,
  type GenoPerfMode,
  type GenoProgressionId,
  type GenoRepeaterQuant,
} from '@/app/lib/studio/se2SynthGenoChordEngine';
import { genoGeneratePluginMelodyFromHarmony, genoLockPluginMelodyNotesToHarmony, type GenoMelodyGenre } from '@/app/lib/studio/se2SynthGenoMelodyEngine';
import { genoFinalizePluginBassNotes, genoGeneratePluginBassFromHarmony, type GenoBassPattern } from '@/app/lib/studio/se2SynthGenoBassEngine';
import { genoGenerateLiveFillerFromHarmony, type GenoFillerQuant } from '@/app/lib/studio/se2SynthGenoFillerEngine';
import type { GenoChordStyle } from '@/app/lib/studio/se2SynthGenoComposePrompt';
import { genoStylePreset } from '@/app/lib/studio/se2SynthGenoStylePresets';
import { se2SynthGenoSoundSelectionForChordStyle } from '@/app/lib/studio/se2SynthGenoGenreSoundBank';
import { se2SynthGenoPluginMapPatternToBarCount } from '@/app/lib/studio/se2SynthGenoEraProgressionLibrary';
import {
  genoNormalizePartNotes,
  genoNormalizePluginChordNotes,
  genoNormalizePluginDraftNotes,
  genoNormalizePluginMelodyNotes,
} from '@/app/lib/studio/se2SynthGenoRanges';
import {
  se2SynthGenoPluginDraftChordNotes,
  se2SynthGenoPluginDraftChordNotesFromBarSpecs,
  se2SynthGenoPluginHarmonyFromState,
  se2SynthGenoPluginUsesPerfChordHits,
  se2SynthGenoSyncPluginHarmonyVoicing,
} from '@/app/lib/studio/se2SynthGenoPluginChordVoicing';
import type { GenoLoopBarCount } from '@/app/lib/studio/se2SynthGenoLoopBarCount';
import {
  SE2_SYNTH_GENO_CHORD_ACCORD_BANK,
  SE2_SYNTH_GENO_DEFAULT_SOUND_SELECTION,
  type Se2SynthGenoPluginSoundSelection,
} from '@/app/lib/studio/se2SynthGenoSoundBank';
export type { Se2SynthGenoPluginSoundSelection };
export { SE2_SYNTH_GENO_CHORD_ACCORD_BANK, SE2_SYNTH_GENO_DEFAULT_SOUND_SELECTION };

export type Se2SynthGenoChordPluginState = {
  progressionId: GenoProgressionId;
  barCount: GenoLoopBarCount;
  smartMatch: boolean;
  lockedType: GenoChordType;
  extensions: GenoExtension[];
  inversion: number;
  perfMode: GenoPerfMode;
  staccato: boolean;
  repeaterQuant: GenoRepeaterQuant;
  includeBassRoot: boolean;
  stylePreset: GenoChordStyle;
  enableChords: boolean;
  enableMelody: boolean;
  enableBass: boolean;
  melodyGenre: GenoMelodyGenre;
  bassPattern: GenoBassPattern;
  bassGlide: boolean;
  accordBankId: string;
  melodyBankId: string;
  bassBankId: string;
  fillerBankId: string;
  /** Per-bar scale degrees — overrides progression template when editing in loop view. */
  barDegrees?: number[];
  /** Per-chord voicing specs — tiled across loop bars (preset library). */
  barChordSpecs?: import('@/app/lib/studio/se2SynthGenoChordEngine').GenoBarChordSpec[];
  /** Untiled progression pattern before mapping to barCount. */
  progressionLoop?: import('@/app/lib/studio/se2SynthGenoChordEngine').GenoBarChordSpec[];
  /** Roman labels for the active preset loop — never substitute generic progressionId labels. */
  progressionRomans?: readonly ChordSymbol[];
  /** Era library category — drives fresh Roman→voicing hints without rewriting song defs. */
  eraCategoryId?: import('@/app/lib/studio/se2SynthGenoEraProgressionLibrary').Se2SynthGenoEraCategoryId;
  /** Active era preset card id (library selection). */
  eraPresetId?: string;
  /** Per-slot play order 1…N (progression triggers). */
  pluginPlayOrder?: number[];
  /** Per-slot enable — disabled chords skip the tiled loop. */
  pluginSlotEnabled?: boolean[];
};

export const SE2_SYNTH_GENO_CHORD_DEFAULTS: Se2SynthGenoChordPluginState = {
  progressionId: 'I-V-vi-IV',
  barCount: 8,
  smartMatch: true,
  lockedType: 'maj',
  extensions: [],
  inversion: 0,
  perfMode: 'block',
  staccato: false,
  repeaterQuant: '1/8',
  includeBassRoot: false,
  stylePreset: 'pop',
  enableChords: true,
  /** Off by default — user adds melody when ready (mirrors B1 arp). */
  enableMelody: false,
  enableBass: true,
  melodyGenre: 'pop',
  bassPattern: 'root',
  bassGlide: false,
  ...se2SynthGenoSoundSelectionForChordStyle('pop'),
};

export type Se2SynthGenoPluginDraft = {
  progressionId: GenoProgressionId;
  bars: number;
  harmony: GenoHarmony;
  chordNotes: StudioEditor2GenNote[];
  melodyNotes: StudioEditor2GenNote[];
  bassNotes: StudioEditor2GenNote[];
  /** Geno Build 1 — ornamental pickups on every chord bar. */
  fillerNotes: StudioEditor2GenNote[];
  /** Inline Groove Lead — locked to chordNotes in the loop editor (Geno B01/B02). */
  grooveLeadNotes?: StudioEditor2GenNote[];
};

export function se2SynthGenoBarDegreesFromProgression(
  progressionId: GenoProgressionId,
  barCount: number,
): number[] {
  const def = GENO_PROGRESSIONS.find((p) => p.id === progressionId);
  const degrees = def?.degrees ?? [0, 4, 5, 3];
  return Array.from({ length: barCount }, (_, bar) => degrees[bar % degrees.length] ?? 0);
}

export function se2SynthGenoApplyStylePreset(
  state: Se2SynthGenoChordPluginState,
  style: GenoChordStyle,
  keyMode: StudioDetectedKeyMode,
): Se2SynthGenoChordPluginState {
  const preset = genoStylePreset(style);
  const sounds = se2SynthGenoSoundSelectionForChordStyle(style);
  void keyMode;
  return {
    ...state,
    stylePreset: style,
    progressionId: preset.defaultProgression,
    smartMatch: preset.smartMatch,
    lockedType: preset.lockedType,
    extensions: [...preset.extensions],
    inversion: preset.inversion,
    perfMode: preset.perfMode,
    staccato: preset.staccato,
    bassPattern: preset.bassPattern,
    melodyGenre: preset.melodyGenre,
    accordBankId: sounds.accordBankId,
    melodyBankId: sounds.melodyBankId,
    bassBankId: sounds.bassBankId,
  };
}

function toBuildSettings(
  state: Se2SynthGenoChordPluginState,
  keyRoot: number,
  keyMode: StudioDetectedKeyMode,
  beatsPerBar: number,
  bpm: number,
): GenoChordBuildSettings {
  return {
    keyRoot,
    keyMode,
    barCount: state.barCount,
    beatsPerBar,
    bpm,
    progressionId: state.progressionId,
    smartMatch: state.smartMatch,
    lockedType: state.lockedType,
    extensions: new Set(state.extensions),
    inversion: state.inversion,
    perfMode: state.perfMode,
    staccato: state.staccato,
    repeaterQuant: state.repeaterQuant,
    includeBassRoot: state.includeBassRoot,
    barDegrees: state.barDegrees,
    barChordSpecs:
      state.barChordSpecs ??
      (state.progressionLoop?.length
        ? se2SynthGenoPluginMapPatternToBarCount(state.progressionLoop, state.barCount, {
            romans: state.progressionRomans,
            eraCategoryId: state.eraCategoryId,
            presetId: state.eraPresetId,
          })
        : undefined),
    stylePreset: state.stylePreset,
  };
}

export type Se2SynthGenoPluginPartId = 'chords' | 'melody' | 'bass' | 'filler';

export type Se2SynthGenoPluginPartSeeds = {
  chords: number;
  melody: number;
  bass: number;
  filler: number;
};

export function se2SynthGenoDefaultPartSeeds(base = 1): Se2SynthGenoPluginPartSeeds {
  return { chords: base, melody: base, bass: base, filler: base };
}

export function se2SynthGenoClearPluginPart(
  draft: Se2SynthGenoPluginDraft,
  part: Se2SynthGenoPluginPartId,
): Se2SynthGenoPluginDraft {
  switch (part) {
    case 'chords':
      return { ...draft, chordNotes: [] };
    case 'melody':
      return { ...draft, melodyNotes: [] };
    case 'bass':
      return { ...draft, bassNotes: [] };
    case 'filler':
      return { ...draft, fillerNotes: [] };
  }
}

function buildPluginMelodyNotes(
  opts: {
    state: Se2SynthGenoChordPluginState;
    harmony: GenoHarmony;
    barCount: number;
    beatsPerBar: number;
    melodySeed: number;
    keyRoot: number;
    keyMode: StudioDetectedKeyMode;
    barChordSpecs?: readonly GenoBarChordSpec[];
  },
): StudioEditor2GenNote[] {
  return genoGeneratePluginMelodyFromHarmony({
    harmony: opts.harmony,
    barCount: opts.barCount,
    beatsPerBar: opts.beatsPerBar,
    style: opts.state.melodyGenre === 'arp' ? 'pop' : opts.state.melodyGenre,
    seed: opts.melodySeed,
    keyRoot: opts.keyRoot,
    keyMode: opts.keyMode,
    barChordSpecs: opts.barChordSpecs,
  });
}

function buildPluginChordNotes(
  chordSettings: GenoChordBuildSettings,
  harmony: GenoHarmony,
  state: Se2SynthGenoChordPluginState,
  keyRoot: number,
  keyMode: StudioDetectedKeyMode,
): StudioEditor2GenNote[] {
  if (se2SynthGenoPluginUsesPerfChordHits(chordSettings)) {
    return genoNormalizePluginChordNotes(genoHarmonyToNotes(chordSettings, harmony));
  }
  return se2SynthGenoPluginDraftChordNotesFromBarSpecs(
    keyRoot,
    keyMode,
    state,
    chordSettings.barCount,
    chordSettings.beatsPerBar,
  );
}

function buildPluginBassNotes(opts: {
  harmony: GenoHarmony;
  barCount: number;
  beatsPerBar: number;
  bassPattern: GenoBassPattern;
  bassSeed: number;
  keyRoot: number;
  keyMode: StudioDetectedKeyMode;
}): StudioEditor2GenNote[] {
  return genoGeneratePluginBassFromHarmony({
    harmony: opts.harmony,
    barCount: opts.barCount,
    beatsPerBar: opts.beatsPerBar,
    pattern: opts.bassPattern,
    seed: opts.bassSeed,
    keyRoot: opts.keyRoot,
    keyMode: opts.keyMode,
  });
}

/** Rebuild harmony metadata only — keeps chord/melody/bass note arrays as-is. */
export function se2SynthGenoRebuildPluginHarmony(opts: {
  draft: Se2SynthGenoPluginDraft | null;
  state: Se2SynthGenoChordPluginState;
  keyRoot: number;
  keyMode: StudioDetectedKeyMode;
  beatsPerBar: number;
  bpm: number;
}): Se2SynthGenoPluginDraft {
  const settings = toBuildSettings(
    opts.state,
    opts.keyRoot,
    opts.keyMode,
    opts.beatsPerBar,
    opts.bpm,
  );
  const harmony = se2SynthGenoPluginHarmonyFromState(
    opts.state,
    opts.keyRoot,
    settings.keyMode,
    opts.beatsPerBar,
    opts.bpm,
  );
  const base = opts.draft ?? {
    progressionId: settings.progressionId,
    bars: settings.barCount,
    harmony,
    chordNotes: [],
    melodyNotes: [],
    bassNotes: [],
    fillerNotes: [],
  };
  return {
    ...base,
    progressionId: settings.progressionId,
    bars: settings.barCount,
    harmony,
  };
}

/** Regenerate one part (or all). Melody/bass stay locked to current harmony unless part is chords/all. */
export function se2SynthGenoRegeneratePluginPart(opts: {
  draft: Se2SynthGenoPluginDraft | null;
  state: Se2SynthGenoChordPluginState;
  part: Se2SynthGenoPluginPartId | 'all';
  seeds: Se2SynthGenoPluginPartSeeds;
  keyRoot: number;
  keyMode: StudioDetectedKeyMode;
  beatsPerBar: number;
  bpm: number;
  /** Live Chord — keep spec voicing; no per-bar random inversion rolls. */
  stableVoicing?: boolean;
  /** Preset / loop change — ignore prior draft harmony + notes. */
  freshDraft?: boolean;
  /** Note Filler lane (Geno B01/B02). */
  enableFiller?: boolean;
  fillerQuant?: GenoFillerQuant;
}): Se2SynthGenoPluginDraft {
  const settings = toBuildSettings(
    opts.state,
    opts.keyRoot,
    opts.keyMode,
    opts.beatsPerBar,
    opts.bpm,
  );
  const regenAll = opts.part === 'all';
  const priorDraft = opts.freshDraft ? null : opts.draft;
  const tiledHarmony = se2SynthGenoPluginHarmonyFromState(
    opts.state,
    opts.keyRoot,
    settings.keyMode,
    opts.beatsPerBar,
    opts.bpm,
  );
  let harmony = tiledHarmony;
  let chordNotes = priorDraft?.chordNotes ?? [];
  let melodyNotes = priorDraft?.melodyNotes ?? [];
  let bassNotes = priorDraft?.bassNotes ?? [];
  let fillerNotes = priorDraft?.fillerNotes ?? [];

  if (regenAll || opts.part === 'chords') {
    const chordSettings: GenoChordBuildSettings = {
      ...settings,
      voicingSeed: opts.stableVoicing ? undefined : opts.seeds.chords ^ 0x43484f,
    };
    harmony = genoBuildHarmony(chordSettings);
    se2SynthGenoSyncPluginHarmonyVoicing(
      harmony,
      chordSettings,
      opts.keyRoot,
      settings.keyMode,
      opts.state,
    );
    if (opts.state.enableChords) {
      chordNotes = buildPluginChordNotes(chordSettings, harmony, opts.state, opts.keyRoot, settings.keyMode);
    } else {
      chordNotes = [];
    }
  }

  if (regenAll || opts.part === 'melody') {
    const melodyHarmony =
      regenAll || opts.part === 'chords' ? harmony : tiledHarmony;
    melodyNotes = opts.state.enableMelody
      ? buildPluginMelodyNotes({
          state: opts.state,
          harmony: melodyHarmony,
          barCount: settings.barCount,
          beatsPerBar: settings.beatsPerBar,
          melodySeed: opts.seeds.melody ^ 0x4d454c,
          keyRoot: opts.keyRoot,
          keyMode: settings.keyMode,
          barChordSpecs: settings.barChordSpecs,
        })
      : [];
  } else if (opts.part === 'chords' && opts.state.enableMelody && melodyNotes.length > 0) {
    melodyNotes = genoLockPluginMelodyNotesToHarmony(
      melodyNotes,
      harmony,
      settings.beatsPerBar,
      settings.barChordSpecs,
    );
  }

  if (regenAll || opts.part === 'bass') {
    bassNotes = opts.state.enableBass
      ? buildPluginBassNotes({
          harmony,
          barCount: settings.barCount,
          beatsPerBar: settings.beatsPerBar,
          bassPattern: opts.state.bassPattern,
          bassSeed: opts.seeds.bass ^ 0xba55,
          keyRoot: opts.keyRoot,
          keyMode: settings.keyMode,
        })
      : [];
  } else if (opts.part === 'chords' && opts.state.enableBass && bassNotes.length > 0) {
    bassNotes = buildPluginBassNotes({
      harmony,
      barCount: settings.barCount,
      beatsPerBar: settings.beatsPerBar,
      bassPattern: opts.state.bassPattern,
      bassSeed: opts.seeds.bass ^ 0xba55,
      keyRoot: opts.keyRoot,
      keyMode: settings.keyMode,
    });
  }

  if (regenAll || opts.part === 'filler') {
    if (opts.enableFiller) {
      const fillerHarmony =
        regenAll || opts.part === 'chords' ? harmony : tiledHarmony;
      fillerNotes = genoGenerateLiveFillerFromHarmony({
        harmony: fillerHarmony,
        barCount: settings.barCount,
        beatsPerBar: settings.beatsPerBar,
        seed: opts.seeds.filler ^ 0x46494c4c,
        keyRoot: opts.keyRoot,
        keyMode: settings.keyMode,
        quant: opts.fillerQuant ?? '8th',
      });
    } else if (opts.enableFiller === false || opts.part === 'filler') {
      fillerNotes = [];
    }
  }

  return finalizePluginDraft(
    {
      progressionId: settings.progressionId,
      bars: settings.barCount,
      harmony,
      chordNotes,
      melodyNotes,
      bassNotes,
      fillerNotes,
    },
    opts.keyRoot,
    settings.keyMode,
    settings.beatsPerBar,
    settings.barCount,
    regenAll ? 'all' : opts.part,
    settings.barChordSpecs,
  );
}

function genoClampPluginDraftLoopBars(
  draft: Se2SynthGenoPluginDraft,
  barCount: number,
  beatsPerBar: number,
): void {
  draft.bars = barCount;
  if (draft.harmony.columns.length > barCount) {
    draft.harmony = { columns: draft.harmony.columns.slice(0, barCount) };
  }
  const maxBeat = barCount * beatsPerBar;
  const trim = (notes: StudioEditor2GenNote[]) =>
    notes.filter((n) => n.startBeat < maxBeat - 1e-6);
  draft.chordNotes = trim(draft.chordNotes);
  draft.melodyNotes = trim(draft.melodyNotes);
  draft.bassNotes = trim(draft.bassNotes);
  if (draft.fillerNotes) draft.fillerNotes = trim(draft.fillerNotes);
}

function finalizePluginDraft(
  draft: Se2SynthGenoPluginDraft,
  keyRoot: number,
  keyMode: StudioDetectedKeyMode,
  beatsPerBar: number,
  barCount: number,
  part: Se2SynthGenoPluginPartId | 'all' = 'all',
  barChordSpecs?: readonly GenoBarChordSpec[],
): Se2SynthGenoPluginDraft {
  genoClampPluginDraftLoopBars(draft, barCount, beatsPerBar);
  if (!draft.fillerNotes) draft.fillerNotes = [];
  genoNormalizePluginDraftNotes(draft, beatsPerBar, barCount, barChordSpecs);
  if (part === 'all' || part === 'melody') {
    draft.melodyNotes = genoNormalizePluginMelodyNotes(
      genoLockPluginMelodyNotesToHarmony(
        draft.melodyNotes,
        draft.harmony,
        beatsPerBar,
        barChordSpecs,
      ),
      beatsPerBar,
      barCount,
      barChordSpecs,
    );
  }
  if (part === 'all' || part === 'bass' || (part === 'chords' && draft.bassNotes.length > 0)) {
    draft.bassNotes = genoFinalizePluginBassNotes(
      draft.bassNotes,
      draft.harmony,
      beatsPerBar,
      keyRoot,
      keyMode,
    );
  }
  return draft;
}

export function se2SynthGenoGeneratePluginDraft(opts: {
  state: Se2SynthGenoChordPluginState;
  keyRoot: number;
  keyMode: StudioDetectedKeyMode;
  beatsPerBar: number;
  bpm: number;
  seed: number;
  draft?: Se2SynthGenoPluginDraft | null;
}): Se2SynthGenoPluginDraft {
  const seeds = se2SynthGenoDefaultPartSeeds(opts.seed);
  return se2SynthGenoRegeneratePluginPart({
    draft: opts.draft ?? null,
    state: opts.state,
    part: 'all',
    seeds,
    keyRoot: opts.keyRoot,
    keyMode: opts.keyMode,
    beatsPerBar: opts.beatsPerBar,
    bpm: opts.bpm,
    stableVoicing: true,
  });
}

/** @deprecated use se2SynthGenoGeneratePluginDraft */
export function se2SynthGenoGenerateFromChordPlugin(opts: {
  state: Se2SynthGenoChordPluginState;
  keyRoot: number;
  keyMode: StudioDetectedKeyMode;
  beatsPerBar: number;
  bpm: number;
  seed: number;
}) {
  const draft = se2SynthGenoGeneratePluginDraft(opts);
  return {
    chordNotes: draft.chordNotes,
    melodyNotes: draft.melodyNotes,
    bassNotes: draft.bassNotes,
    progressionId: draft.progressionId,
    bars: draft.bars,
  };
}

export { GENO_PROGRESSIONS };
