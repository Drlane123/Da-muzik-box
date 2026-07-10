/**
 * Synth Geno — Pop / R&B / Disco / Blues / Latin / K-pop era progression presets.
 */
import { ERA_POP_RNB_DISCO_GENRES } from '@/app/lib/creationStation/eraPopRnbDiscoProgressions';
import { ERA_SOUL_RNB_NEO_GENRES } from '@/app/lib/creationStation/eraSoulRnbNeoProgressions';
import { ERA_BLUES_LATIN_KPOP_GENRES } from '@/app/lib/creationStation/eraBluesLatinKpopProgressions';
import type { ChordMode, ChordSymbol } from '@/app/lib/creationStation/chordBuilder';
import { se2SynthGenoLiveRomanToBarSpec } from '@/app/lib/studio/se2SynthGenoLiveChordRoman';
import type { Se2SynthGenoLiveGenreId } from '@/app/lib/studio/se2SynthGenoLiveChordTypes';
import type { GenoChordStyle } from '@/app/lib/studio/se2SynthGenoComposePrompt';
import type {
  GenoBarChordSpec,
  GenoExtension,
  GenoPerfMode,
} from '@/app/lib/studio/se2SynthGenoChordEngine';
import { genoStylePreset } from '@/app/lib/studio/se2SynthGenoStylePresets';
import { se2SynthGenoSoundSelectionForEraCategory } from '@/app/lib/studio/se2SynthGenoGenreSoundBank';
import { se2SynthGenoDefaultVoicingDepthForStyle } from '@/app/lib/studio/se2SynthGenoVoicingDepth';
import type { Se2SynthGenoChordPluginState } from '@/app/lib/studio/se2SynthGenoChordPlugin';
import type { Se2SynthGenoPluginSoundSelection } from '@/app/lib/studio/se2SynthGenoSoundBank';
import { se2SynthGenoNormalizePluginSoundSelection } from '@/app/lib/studio/se2SynthGenoSoundBank';
import { se2SynthGenoLiveExtendRomans } from '@/app/lib/studio/se2SynthGenoLiveProgressionExtend';
import type { GenoLoopBarCount } from '@/app/lib/studio/se2SynthGenoLoopBarCount';

export type Se2SynthGenoEraCategoryId =
  | 'soul-eras'
  | 'rnb-eras'
  | 'neo-soul-eras'
  | 'pop-eras'
  | 'disco-eras'
  | 'blues-eras'
  | 'latin-eras'
  | 'kpop-eras';

export type Se2SynthGenoNextChordOption = {
  id: string;
  label: string;
  spec: GenoBarChordSpec;
};

export type Se2SynthGenoEraPreset = {
  id: string;
  name: string;
  categoryId: Se2SynthGenoEraCategoryId;
  categoryLabel: string;
  /** Original Roman symbols for this loop — drives keyboard labels + playback identity. */
  romans: ChordSymbol[];
  chordSpecs: GenoBarChordSpec[];
  romanLine: string;
  stylePreset: GenoChordStyle;
  extensions: GenoExtension[];
  inversion: number;
  perfMode: GenoPerfMode;
  smartMatch: boolean;
  soundSelection: Se2SynthGenoPluginSoundSelection;
  nextChords: Se2SynthGenoNextChordOption[];
};

const ALL_ERA_GENRES = [
  ...ERA_SOUL_RNB_NEO_GENRES,
  ...ERA_POP_RNB_DISCO_GENRES,
  ...ERA_BLUES_LATIN_KPOP_GENRES,
];

const ROMAN_TO_DEGREE: Record<string, number> = {
  I: 0,
  Imaj7: 0,
  I7: 0,
  Isus4: 0,
  ii: 1,
  ii7: 1,
  'iiø7': 1,
  iii: 2,
  iii7: 2,
  bIII: 2,
  IV: 3,
  IVmaj7: 3,
  IV7: 3,
  iv: 3,
  V: 4,
  V7: 4,
  Vsus4: 4,
  vi: 5,
  vi7: 5,
  bVI: 5,
  'vii°': 6,
  bVII: 6,
};

const NEXT_FROM_DEGREE: Record<number, { roman: ChordSymbol; label: string }[]> = {
  0: [
    { roman: 'IVmaj7', label: '+ IVmaj7' },
    { roman: 'vi7', label: '+ vi7' },
    { roman: 'iii7', label: '+ iii7' },
    { roman: 'V7', label: '+ V7 turn' },
  ],
  1: [
    { roman: 'V7', label: '+ V7' },
    { roman: 'Imaj7', label: '+ Imaj7 home' },
    { roman: 'vi7', label: '+ vi7' },
  ],
  2: [
    { roman: 'vi7', label: '+ vi7' },
    { roman: 'IVmaj7', label: '+ IVmaj7' },
    { roman: 'ii7', label: '+ ii7' },
  ],
  3: [
    { roman: 'V7', label: '+ V7' },
    { roman: 'Imaj7', label: '+ I home' },
    { roman: 'iii7', label: '+ iii7' },
    { roman: 'vi7', label: '+ vi7' },
  ],
  4: [
    { roman: 'Imaj7', label: '+ Imaj7' },
    { roman: 'vi7', label: '+ vi7' },
    { roman: 'IVmaj7', label: '+ IVmaj7' },
    { roman: 'I7', label: '+ I7 blues' },
  ],
  5: [
    { roman: 'IVmaj7', label: '+ IVmaj7' },
    { roman: 'ii7', label: '+ ii7' },
    { roman: 'V7', label: '+ V7' },
    { roman: 'Imaj7', label: '+ Imaj7' },
  ],
  6: [
    { roman: 'Imaj7', label: '+ Imaj7' },
    { roman: 'iii7', label: '+ iii7' },
    { roman: 'IVmaj7', label: '+ IVmaj7' },
  ],
};

/** Genre voicing hints per era tab — does not change stored Roman progressions. */
const ERA_TO_LIVE_GENRE: Record<Se2SynthGenoEraCategoryId, Se2SynthGenoLiveGenreId> = {
  'soul-eras': 'rnb',
  'rnb-eras': 'rnb',
  'neo-soul-eras': 'neo-soul',
  'pop-eras': 'pop',
  'disco-eras': 'house-dance',
  'blues-eras': 'jazz',
  'latin-eras': 'afrobeats',
  'kpop-eras': 'kpop',
};

export function se2SynthGenoEraCategoryLiveGenre(
  categoryId: Se2SynthGenoEraCategoryId,
): Se2SynthGenoLiveGenreId {
  return ERA_TO_LIVE_GENRE[categoryId] ?? 'rnb';
}

export function se2SynthGenoEraProgressionMode(categoryId: Se2SynthGenoEraCategoryId): ChordMode {
  if (categoryId === 'blues-eras') return 'mixolydian';
  return 'major';
}

function eraProgressionMode(categoryId: Se2SynthGenoEraCategoryId): ChordMode {
  return se2SynthGenoEraProgressionMode(categoryId);
}

export function se2SynthGenoRomanToBarSpec(
  roman: ChordSymbol,
  categoryId: Se2SynthGenoEraCategoryId,
): GenoBarChordSpec {
  return se2SynthGenoLiveRomanToBarSpec(
    roman,
    eraProgressionMode(categoryId),
    ERA_TO_LIVE_GENRE[categoryId] ?? 'rnb',
  );
}

function buildNextChords(
  specs: GenoBarChordSpec[],
  categoryId: Se2SynthGenoEraCategoryId,
): Se2SynthGenoNextChordOption[] {
  const last = specs[specs.length - 1]?.degree ?? 0;
  const pool = NEXT_FROM_DEGREE[last] ?? NEXT_FROM_DEGREE[0]!;
  return pool.map((c, i) => ({
    id: `next-${last}-${i}-${c.roman}`,
    label: c.label,
    spec: se2SynthGenoRomanToBarSpec(c.roman, categoryId),
  }));
}

export function se2SynthGenoNextChordOptionsForLoop(
  specs: readonly GenoBarChordSpec[],
  categoryId: Se2SynthGenoEraCategoryId,
): Se2SynthGenoNextChordOption[] {
  if (specs.length === 0) return [];
  return buildNextChords([...specs], categoryId);
}

const CATEGORY_VOICING: Record<
  Se2SynthGenoEraCategoryId,
  { style: GenoChordStyle; extensions: GenoExtension[]; inversion: number; perfMode: GenoPerfMode }
> = {
  'soul-eras': { style: 'rnb', extensions: ['M7', 'm7', '9'], inversion: 0, perfMode: 'block' },
  'rnb-eras': { style: 'rnb', extensions: ['M7', 'm7', '9'], inversion: 0, perfMode: 'block' },
  'neo-soul-eras': { style: 'rnb', extensions: ['M7', 'm7', '9'], inversion: 0, perfMode: 'block' },
  'pop-eras': { style: 'pop', extensions: ['M7', 'm7', '9'], inversion: 0, perfMode: 'block' },
  'disco-eras': { style: 'disco', extensions: ['M7', 'm7', '9'], inversion: 0, perfMode: 'block' },
  'blues-eras': { style: 'jazz', extensions: ['M7', 'm7', '9'], inversion: 0, perfMode: 'block' },
  'latin-eras': { style: 'bright', extensions: ['M7', 'm7', '9'], inversion: 0, perfMode: 'block' },
  'kpop-eras': { style: 'kpop', extensions: ['M7', 'm7', '9'], inversion: 0, perfMode: 'block' },
};

const CATEGORY_SOUNDS: Record<
  Se2SynthGenoEraCategoryId,
  Pick<Se2SynthGenoPluginSoundSelection, 'accordBankId' | 'melodyBankId' | 'bassBankId'>
> = {
  'soul-eras': { accordBankId: 'rhodes-classic', melodyBankId: 'lead-soft', bassBankId: 'upright-bass' },
  'rnb-eras': { accordBankId: 'rhodes-classic', melodyBankId: 'lead-soft', bassBankId: 'bass-guitar-finger' },
  'neo-soul-eras': { accordBankId: 'rhodes-classic', melodyBankId: 'lead-soft', bassBankId: 'bass-guitar-finger' },
  'pop-eras': { accordBankId: 'rhodes-classic', melodyBankId: 'lead-hook', bassBankId: 'bass-guitar-pick' },
  'disco-eras': { accordBankId: 'rhodes-classic', melodyBankId: 'lead-vox', bassBankId: 'moog-low' },
  'blues-eras': { accordBankId: 'rhodes-classic', melodyBankId: 'pluck-guitar', bassBankId: 'upright-bass' },
  'latin-eras': { accordBankId: 'rhodes-classic', melodyBankId: 'pluck-kalimba', bassBankId: 'bass-guitar-finger' },
  'kpop-eras': { accordBankId: 'rhodes-classic', melodyBankId: 'lead-hook', bassBankId: 'sub-808' },
};

export const SE2_SYNTH_GENO_ERA_CATEGORIES: { id: Se2SynthGenoEraCategoryId; label: string }[] = [
  { id: 'soul-eras', label: 'Soul · Classic' },
  { id: 'rnb-eras', label: 'R&B · Slow Jam' },
  { id: 'neo-soul-eras', label: 'Neo-Soul · Groove' },
  { id: 'pop-eras', label: 'Pop · 70s–2000s' },
  { id: 'disco-eras', label: 'Disco · 70s–2000s' },
  { id: 'blues-eras', label: 'Blues · Classic' },
  { id: 'latin-eras', label: 'Latin · Bossa & Salsa' },
  { id: 'kpop-eras', label: 'K-Pop · Hooks' },
];

export const SE2_SYNTH_GENO_ERA_PRESETS: Se2SynthGenoEraPreset[] = ALL_ERA_GENRES.flatMap((g) => {
  const catId = g.id as Se2SynthGenoEraCategoryId;
  const voicing = CATEGORY_VOICING[catId];
  const sounds = CATEGORY_SOUNDS[catId];
  return g.progressions.map((p) => {
    const romans = p.chords as ChordSymbol[];
    const chordSpecs = romans.map((c) => se2SynthGenoRomanToBarSpec(c, catId));
    return {
      id: `${g.id}__${p.id}`,
      name: p.name,
      categoryId: catId,
      categoryLabel: g.label,
      romans,
      chordSpecs,
      romanLine: p.chords.join(' · '),
      stylePreset: voicing.style,
      extensions: [...voicing.extensions],
      inversion: voicing.inversion,
      perfMode: voicing.perfMode,
      smartMatch: false,
      soundSelection: se2SynthGenoNormalizePluginSoundSelection(sounds),
      nextChords: buildNextChords(chordSpecs, catId),
    };
  });
});

export function se2SynthGenoEraPresetsForCategory(categoryId: Se2SynthGenoEraCategoryId): Se2SynthGenoEraPreset[] {
  return SE2_SYNTH_GENO_ERA_PRESETS.filter((p) => p.categoryId === categoryId);
}

export function se2SynthGenoEraPresetById(id: string): Se2SynthGenoEraPreset | undefined {
  return SE2_SYNTH_GENO_ERA_PRESETS.find((p) => p.id === id);
}

export function se2SynthGenoTileBarSpecs(
  specs: readonly GenoBarChordSpec[],
  barCount: number,
): GenoBarChordSpec[] {
  if (specs.length === 0) return Array.from({ length: barCount }, () => ({ degree: 0 }));
  if (barCount <= specs.length) {
    return specs.slice(0, barCount).map((s) => ({ ...s }));
  }
  return Array.from({ length: barCount }, (_, bar) => {
    const src = specs[bar % specs.length] ?? { degree: 0 };
    return { ...src };
  });
}

/**
 * Classic ×2 / ×3 tiling for 4-chord (and related) loops — keeps musical 4/8/12 lengths.
 */
function se2SynthGenoClassicTileRomans(
  seed: readonly ChordSymbol[],
  barCount: GenoLoopBarCount,
): ChordSymbol[] | null {
  if (barCount === 8 && seed.length === 4) {
    return se2SynthGenoTileRomans(seed, 8) as ChordSymbol[];
  }
  if (barCount === 12 && seed.length === 4) {
    return se2SynthGenoTileRomans(seed, 12) as ChordSymbol[];
  }
  if (barCount === 12 && seed.length === 6) {
    return se2SynthGenoTileRomans(seed, 12) as ChordSymbol[];
  }
  if (barCount === 12 && seed.length === 8) {
    return [...seed, ...seed.slice(0, 4)] as ChordSymbol[];
  }
  return null;
}

function se2SynthGenoClassicTileBarSpecs(
  specs: readonly GenoBarChordSpec[],
  barCount: GenoLoopBarCount,
): GenoBarChordSpec[] | null {
  if (barCount === 8 && specs.length === 4) {
    return se2SynthGenoTileBarSpecs(specs, 8);
  }
  if (barCount === 12 && specs.length === 4) {
    return se2SynthGenoTileBarSpecs(specs, 12);
  }
  if (barCount === 12 && specs.length === 6) {
    return se2SynthGenoTileBarSpecs(specs, 12);
  }
  if (barCount === 12 && specs.length === 8) {
    return [...specs, ...specs.slice(0, 4).map((s) => ({ ...s }))];
  }
  return null;
}

/**
 * Geno Build 2 — append musically logical follow chords after the preset seed
 * (uses NEXT_FROM_DEGREE), instead of modulo tiling or repeating chord 1 early.
 */
export function se2SynthGenoPluginFollowChordsToBarCount(
  seed: readonly ChordSymbol[],
  barCount: GenoLoopBarCount,
  categoryId: Se2SynthGenoEraCategoryId,
): ChordSymbol[] {
  if (seed.length === 0) return Array.from({ length: barCount }, () => 'I' as ChordSymbol);
  if (seed.length >= barCount) return seed.slice(0, barCount) as ChordSymbol[];
  const tiled = se2SynthGenoClassicTileRomans(seed, barCount);
  if (tiled) return tiled;

  const out: ChordSymbol[] = [...seed];
  let fillIndex = 0;
  while (out.length < barCount) {
    const lastRoman = out[out.length - 1]!;
    const lastDegree = ROMAN_TO_DEGREE[lastRoman] ?? 0;
    const pool = NEXT_FROM_DEGREE[lastDegree] ?? NEXT_FROM_DEGREE[0]!;
    let pick = pool[fillIndex % pool.length]!.roman;
    if (pick === lastRoman && pool.length > 1) {
      pick = pool[(fillIndex + 1) % pool.length]!.roman;
    }
    out.push(pick);
    fillIndex += 1;
  }
  return out.slice(0, barCount);
}

/**
 * Geno Build 2 — fill 4, 8, or 12 loop bars with a complete progression (no early wrap).
 * Only classic 4-chord loops intentionally repeat (×2 / ×3) in longer modes.
 * All other short patterns follow-extend to the full bar count.
 */
export function se2SynthGenoPluginRomansForBarCount(
  seed: readonly ChordSymbol[],
  barCount: GenoLoopBarCount,
  mode: ChordMode,
  genreId: Se2SynthGenoLiveGenreId,
  presetId = '',
  categoryId?: Se2SynthGenoEraCategoryId,
): ChordSymbol[] {
  if (seed.length === 0) return Array.from({ length: barCount }, () => 'I' as ChordSymbol);
  if (seed.length >= barCount) return seed.slice(0, barCount) as ChordSymbol[];
  const tiled = se2SynthGenoClassicTileRomans(seed, barCount);
  if (tiled) return tiled;
  if (categoryId) {
    return se2SynthGenoPluginFollowChordsToBarCount(seed, barCount, categoryId);
  }
  return se2SynthGenoLiveExtendRomans(seed, mode, genreId, presetId, barCount);
}

export function se2SynthGenoPluginMapPatternToBarCount(
  specs: readonly GenoBarChordSpec[],
  barCount: GenoLoopBarCount,
  opts?: {
    romans?: readonly ChordSymbol[];
    eraCategoryId?: Se2SynthGenoEraCategoryId;
    presetId?: string;
  },
): GenoBarChordSpec[] {
  if (specs.length === 0) {
    return Array.from({ length: barCount }, () => ({ degree: 0 }));
  }
  if (specs.length >= barCount) {
    return specs.slice(0, barCount).map((s) => ({ ...s }));
  }
  const tiled = se2SynthGenoClassicTileBarSpecs(specs, barCount);
  if (tiled) return tiled;
  const categoryId = opts?.eraCategoryId ?? 'pop-eras';
  const mode = se2SynthGenoEraProgressionMode(categoryId);
  const genreId = se2SynthGenoEraCategoryLiveGenre(categoryId);
  const seedRomans =
    opts?.romans?.length
      ? opts.romans
      : (specs.map((s) => {
          const d = ((s.degree % 7) + 7) % 7;
          const pool = mode === 'minor'
            ? (['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'] as const)
            : (['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'] as const);
          return (pool[d] ?? 'I') as ChordSymbol;
        }) as ChordSymbol[]);
  const extended = se2SynthGenoPluginRomansForBarCount(
    seedRomans,
    barCount,
    mode,
    genreId,
    opts?.presetId ?? '',
    opts?.eraCategoryId,
  );
  return extended.map((r) => se2SynthGenoRomanToBarSpec(r, categoryId));
}

/** Tile roman labels across a 4- or 8-bar loop (Geno Build 2 progression triggers). */
export function se2SynthGenoTileRomans(
  romans: readonly ChordSymbol[],
  barCount: number,
): ChordSymbol[] {
  if (romans.length === 0) {
    return Array.from({ length: barCount }, () => 'I' as ChordSymbol);
  }
  if (barCount <= romans.length) {
    return romans.slice(0, barCount) as ChordSymbol[];
  }
  return Array.from({ length: barCount }, (_, bar) => romans[bar % romans.length]!);
}

export function se2SynthGenoSpecsToDegrees(specs: readonly GenoBarChordSpec[]): number[] {
  return specs.map((s) => s.degree);
}

export function se2SynthGenoApplyEraProgressionPreset(
  state: Se2SynthGenoChordPluginState,
  preset: Se2SynthGenoEraPreset,
): Se2SynthGenoChordPluginState {
  const style = genoStylePreset(preset.stylePreset);
  const voicingDepth = se2SynthGenoDefaultVoicingDepthForStyle(preset.stylePreset);
  const mode = eraProgressionMode(preset.categoryId);
  const genreId = ERA_TO_LIVE_GENRE[preset.categoryId] ?? 'rnb';
  const romansForBars = se2SynthGenoPluginRomansForBarCount(
    preset.romans,
    state.barCount,
    mode,
    genreId,
    preset.id,
    preset.categoryId,
  );
  const slotLoop = romansForBars.map((roman) => {
    const fresh = se2SynthGenoRomanToBarSpec(roman, preset.categoryId);
    return { ...fresh, voicingDepth: fresh.voicingDepth ?? voicingDepth };
  });
  const slotRomans = romansForBars;
  const sounds = se2SynthGenoSoundSelectionForEraCategory(preset.categoryId);
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
    smartMatch: false,
    lockedType: style.lockedType,
    staccato: style.staccato,
    melodyGenre: preset.categoryId === 'kpop-eras' ? 'kpop' : style.melodyGenre,
    bassPattern: 'root',
    accordBankId: sounds.accordBankId,
    melodyBankId: sounds.melodyBankId,
    bassBankId: sounds.bassBankId,
    fillerBankId: sounds.fillerBankId,
    eraCategoryId: preset.categoryId,
    eraPresetId: preset.id,
  };
}

export function se2SynthGenoAppendNextChord(
  state: Se2SynthGenoChordPluginState,
  spec: GenoBarChordSpec,
): Se2SynthGenoChordPluginState {
  const loop = [
    ...(state.progressionLoop ??
      state.barChordSpecs?.slice(0, Math.min(state.barChordSpecs.length, 8)) ??
      [{ degree: 0 }]),
  ];
  loop.push(spec);
  const tiled = se2SynthGenoPluginMapPatternToBarCount(loop, state.barCount, {
    eraCategoryId: state.eraCategoryId,
    romans: state.progressionRomans,
  });
  return {
    ...state,
    progressionLoop: loop,
    barChordSpecs: tiled,
    barDegrees: se2SynthGenoSpecsToDegrees(tiled),
  };
}

export function se2SynthGenoTileBarDegrees(degrees: readonly number[], barCount: number): number[] {
  if (degrees.length === 0) return Array.from({ length: barCount }, () => 0);
  return Array.from({ length: barCount }, (_, bar) => degrees[bar % degrees.length] ?? 0);
}
