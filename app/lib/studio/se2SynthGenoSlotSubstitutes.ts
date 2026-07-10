/**
 * Per-slot chord substitute suggestions — closest harmonic matches for one progression step.
 */
import type { ChordMode, ChordSymbol } from '@/app/lib/creationStation/chordBuilder';
import type { GenoBarChordSpec } from '@/app/lib/studio/se2SynthGenoChordEngine';
import type { GenoChordStyle } from '@/app/lib/studio/se2SynthGenoComposePrompt';
import {
  se2SynthGenoLiveRomanToBarSpec,
} from '@/app/lib/studio/se2SynthGenoLiveChordRoman';
import { se2SynthGenoLiveChordRootNote } from '@/app/lib/studio/se2SynthGenoLiveChordVoicing';
import type { Se2SynthGenoLiveGenreId } from '@/app/lib/studio/se2SynthGenoLiveChordTypes';
import {
  se2SynthGenoEraCategoryLiveGenre,
  se2SynthGenoEraProgressionMode,
  se2SynthGenoRomanToBarSpec,
  type Se2SynthGenoEraCategoryId,
} from '@/app/lib/studio/se2SynthGenoEraProgressionLibrary';
import type { StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';

export type Se2SynthGenoSlotSubstituteOption = {
  id: string;
  roman: ChordSymbol;
  /** Root letter + roman — e.g. "Am · vi" */
  label: string;
  spec: GenoBarChordSpec;
};

const ROMAN_DEGREE: Record<string, number> = {
  I: 0,
  Imaj7: 0,
  I7: 0,
  Isus4: 0,
  'i(maj7)': 0,
  i: 0,
  i7: 0,
  ii: 1,
  ii7: 1,
  'ii°': 1,
  'iiø7': 1,
  iii: 2,
  iii7: 2,
  bIII: 2,
  bIIImaj7: 2,
  IV: 3,
  IVmaj7: 3,
  IV7: 3,
  iv: 3,
  iv7: 3,
  V: 4,
  V7: 4,
  Vsus4: 4,
  v: 4,
  vi: 5,
  vi7: 5,
  bVI: 5,
  bVImaj7: 5,
  VI: 5,
  VImaj7: 5,
  'vii°': 6,
  'vii°7': 6,
  bVII: 6,
  bVIImaj7: 6,
  bVII7: 6,
  VII: 6,
  VII7: 6,
  bII: 1,
  bIImaj7: 1,
};

const MAJOR_SUBSTITUTE_POOL: Partial<Record<string, readonly ChordSymbol[]>> = {
  I: ['vi', 'iii', 'IV', 'Imaj7'],
  Imaj7: ['vi7', 'IVmaj7', 'iii7', 'V7'],
  I7: ['IV7', 'vi7', 'V7', 'Imaj7'],
  Isus4: ['I', 'vi', 'IV', 'V'],
  ii: ['IV', 'vi', 'ii7', 'V'],
  ii7: ['V7', 'vi7', 'IVmaj7', 'Imaj7'],
  iii: ['I', 'vi', 'iii7', 'IV'],
  iii7: ['vi7', 'Imaj7', 'IVmaj7', 'ii7'],
  IV: ['ii', 'I', 'vi', 'IVmaj7'],
  IVmaj7: ['Imaj7', 'vi7', 'ii7', 'V7'],
  IV7: ['I7', 'vi7', 'V7', 'ii7'],
  V: ['vi', 'I', 'V7', 'iii'],
  V7: ['Imaj7', 'vi7', 'IVmaj7', 'I'],
  Vsus4: ['V', 'I', 'vi', 'IV'],
  vi: ['I', 'IV', 'ii', 'vi7'],
  vi7: ['IVmaj7', 'ii7', 'Imaj7', 'iii7'],
  'vii°': ['V', 'V7', 'iii', 'vi'],
  'vii°7': ['V7', 'iii7', 'vi7', 'Imaj7'],
};

const MINOR_SUBSTITUTE_POOL: Partial<Record<string, readonly ChordSymbol[]>> = {
  i: ['VI', 'III', 'iv', 'VII'],
  'i(maj7)': ['VI', 'iv', 'III', 'VII'],
  i7: ['iv', 'VI', 'III', 'VII'],
  iv: ['i', 'VI', 'VII', 'i7'],
  iv7: ['i7', 'VI', 'VII', 'III'],
  v: ['VII', 'VI', 'i', 'iv'],
  V: ['VI', 'VII', 'i', 'iv'],
  V7: ['i', 'VI', 'iv', 'VII'],
  VI: ['iv', 'III', 'i', 'VII'],
  VII: ['III', 'VI', 'iv', 'i'],
  III: ['VI', 'VII', 'i', 'iv'],
  'ii°': ['V', 'VII', 'VI', 'iv'],
  'vii°': ['V', 'VII', 'VI', 'III'],
};

const MAJOR_DIATONIC: readonly ChordSymbol[] = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
const MINOR_DIATONIC: readonly ChordSymbol[] = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'];

function chordModeFromKeyMode(keyMode: StudioDetectedKeyMode): ChordMode {
  return keyMode === 'minor' ? 'minor' : 'major';
}

function diatonicNeighbors(degree: number, mode: ChordMode, exclude: ChordSymbol): ChordSymbol[] {
  const scale = mode === 'minor' ? MINOR_DIATONIC : MAJOR_DIATONIC;
  const idx = ((degree % 7) + 7) % 7;
  const offsets = [1, -1, 2, -2, 3, -3];
  const out: ChordSymbol[] = [];
  for (const off of offsets) {
    const r = scale[((idx + off) % 7 + 7) % 7];
    if (r && r !== exclude && !out.includes(r)) out.push(r);
    if (out.length >= 4) break;
  }
  return out;
}

function substituteRomanCandidates(roman: ChordSymbol, mode: ChordMode): ChordSymbol[] {
  const pool = (mode === 'minor' ? MINOR_SUBSTITUTE_POOL : MAJOR_SUBSTITUTE_POOL)[roman];
  const degree = ROMAN_DEGREE[roman] ?? 0;
  const neighbors = diatonicNeighbors(degree, mode, roman);
  const merged: ChordSymbol[] = [];
  for (const r of [...(pool ?? []), ...neighbors]) {
    if (r === roman || merged.includes(r)) continue;
    merged.push(r);
    if (merged.length >= 4) break;
  }
  return merged;
}

function rootLabel(
  keyRoot: number,
  spec: GenoBarChordSpec,
  stylePreset: GenoChordStyle,
  genreId: Se2SynthGenoLiveGenreId,
): string {
  const { noteName } = se2SynthGenoLiveChordRootNote(keyRoot, spec, stylePreset, genreId);
  return noteName.replace(/\d+$/, '');
}

function mergePriorVoicing(
  spec: GenoBarChordSpec,
  prior?: GenoBarChordSpec,
): GenoBarChordSpec {
  if (!prior) return spec;
  return {
    ...spec,
    voicingDepth: prior.voicingDepth ?? spec.voicingDepth,
    chopQuant: prior.chopQuant ?? spec.chopQuant,
    inversion: prior.inversion ?? spec.inversion,
  };
}

/** Live Chord / Build 1 — genre-tuned substitute specs. */
export function se2SynthGenoLiveSlotSubstituteOptions(opts: {
  slotIndex: number;
  currentRoman: ChordSymbol;
  priorSpec?: GenoBarChordSpec;
  mode: ChordMode;
  genreId: Se2SynthGenoLiveGenreId;
  stylePreset: GenoChordStyle;
  keyRoot: number;
  maxOptions?: number;
}): Se2SynthGenoSlotSubstituteOption[] {
  const max = opts.maxOptions ?? 4;
  const romans = substituteRomanCandidates(opts.currentRoman, opts.mode).slice(0, max);
  return romans.map((roman, i) => {
    const spec = mergePriorVoicing(
      se2SynthGenoLiveRomanToBarSpec(roman, opts.mode, opts.genreId),
      opts.priorSpec,
    );
    const root = rootLabel(opts.keyRoot, spec, opts.stylePreset, opts.genreId);
    return {
      id: `live-sub-${opts.slotIndex}-${roman}-${i}`,
      roman,
      label: `${root} · ${roman}`,
      spec,
    };
  });
}

/** Chord Generator / Build 2 — era category voicing. */
export function se2SynthGenoPluginSlotSubstituteOptions(opts: {
  slotIndex: number;
  currentRoman: ChordSymbol;
  priorSpec?: GenoBarChordSpec;
  keyMode: StudioDetectedKeyMode;
  eraCategoryId?: Se2SynthGenoEraCategoryId;
  stylePreset: GenoChordStyle;
  keyRoot: number;
  maxOptions?: number;
}): Se2SynthGenoSlotSubstituteOption[] {
  const max = opts.maxOptions ?? 4;
  const mode = opts.eraCategoryId
    ? se2SynthGenoEraProgressionMode(opts.eraCategoryId)
    : chordModeFromKeyMode(opts.keyMode);
  const genreId = opts.eraCategoryId
    ? se2SynthGenoEraCategoryLiveGenre(opts.eraCategoryId)
    : 'rnb';
  const romans = substituteRomanCandidates(opts.currentRoman, mode).slice(0, max);
  return romans.map((roman, i) => {
    const fresh = opts.eraCategoryId
      ? se2SynthGenoRomanToBarSpec(roman, opts.eraCategoryId)
      : se2SynthGenoLiveRomanToBarSpec(roman, mode, genreId);
    const spec = mergePriorVoicing(fresh, opts.priorSpec);
    const root = rootLabel(opts.keyRoot, spec, opts.stylePreset, genreId);
    return {
      id: `plugin-sub-${opts.slotIndex}-${roman}-${i}`,
      roman,
      label: `${root} · ${roman}`,
      spec,
    };
  });
}
