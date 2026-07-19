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
  Imaj9: 0,
  Imaj13: 0,
  I69: 0,
  'Imaj7#11': 0,
  I7: 0,
  Isus4: 0,
  'i(maj7)': 0,
  i: 0,
  i7: 0,
  i9: 0,
  i11: 0,
  i69: 0,
  ii: 1,
  ii7: 1,
  ii9: 1,
  ii11: 1,
  'ii°': 1,
  'iiø7': 1,
  iii: 2,
  iii7: 2,
  iii9: 2,
  iii11: 2,
  bIII: 2,
  bIIImaj7: 2,
  bIIImaj9: 2,
  IV: 3,
  IVmaj7: 3,
  IVmaj9: 3,
  IVmaj13: 3,
  IV69: 3,
  IV7: 3,
  iv: 3,
  iv7: 3,
  iv9: 3,
  iv11: 3,
  V: 4,
  V7: 4,
  V9: 4,
  V11: 4,
  V13: 4,
  Vsus4: 4,
  V13sus: 4,
  v: 4,
  vi: 5,
  vi7: 5,
  vi9: 5,
  vi11: 5,
  bVI: 5,
  bVImaj7: 5,
  bVImaj9: 5,
  VI: 5,
  VImaj7: 5,
  VImaj9: 5,
  'vii°': 6,
  'vii°7': 6,
  bVII: 6,
  bVIImaj7: 6,
  bVIImaj9: 6,
  bVII7: 6,
  VII: 6,
  VII7: 6,
  bII: 1,
  bIImaj7: 1,
};

const MAJOR_SUBSTITUTE_POOL: Partial<Record<string, readonly ChordSymbol[]>> = {
  I: ['vi', 'iii', 'IV', 'Imaj7'],
  Imaj7: ['Imaj9', 'I69', 'Imaj13', 'vi7'],
  Imaj9: ['Imaj13', 'I69', 'vi11', 'IVmaj9'],
  Imaj13: ['Imaj9', 'I69', 'vi11', 'IVmaj13'],
  I69: ['Imaj9', 'Imaj13', 'IV69', 'vi9'],
  'Imaj7#11': ['Imaj13', 'Imaj9', 'IVmaj9', 'vi11'],
  I7: ['IV7', 'vi7', 'V7', 'Imaj7'],
  Isus4: ['I', 'vi', 'IV', 'V'],
  ii: ['IV', 'vi', 'ii7', 'V'],
  ii7: ['ii9', 'ii11', 'V13', 'Imaj9'],
  ii9: ['ii11', 'V13', 'Imaj13', 'vi11'],
  ii11: ['ii9', 'V13sus', 'Imaj13', 'vi11'],
  'iiø7': ['V13', 'Imaj13', 'vi11', 'ii11'],
  iii: ['I', 'vi', 'iii7', 'IV'],
  iii7: ['iii9', 'iii11', 'vi11', 'Imaj9'],
  iii9: ['iii11', 'vi11', 'Imaj13', 'IVmaj9'],
  iii11: ['iii9', 'vi11', 'Imaj13', 'ii11'],
  IV: ['ii', 'I', 'vi', 'IVmaj7'],
  IVmaj7: ['IVmaj9', 'IVmaj13', 'IV69', 'Imaj9'],
  IVmaj9: ['IVmaj13', 'IV69', 'Imaj13', 'vi11'],
  IVmaj13: ['IVmaj9', 'Imaj13', 'vi11', 'V13'],
  IV69: ['IVmaj9', 'I69', 'vi9', 'V13sus'],
  IV7: ['I7', 'vi7', 'V7', 'ii7'],
  V: ['vi', 'I', 'V7', 'iii'],
  V7: ['V13', 'V13sus', 'Imaj13', 'vi11'],
  V9: ['V13', 'V13sus', 'Imaj9', 'ii11'],
  V11: ['V13sus', 'V13', 'Imaj13', 'ii11'],
  V13: ['V13sus', 'Imaj13', 'ii11', 'vi11'],
  Vsus4: ['V13sus', 'V', 'I', 'vi'],
  V13sus: ['V13', 'Imaj13', 'ii11', 'vi11'],
  vi: ['I', 'IV', 'ii', 'vi7'],
  vi7: ['vi9', 'vi11', 'Imaj9', 'ii11'],
  vi9: ['vi11', 'ii11', 'Imaj13', 'V13sus'],
  vi11: ['vi9', 'ii11', 'Imaj13', 'IVmaj9'],
  iv: ['iv9', 'iv11', 'Imaj9', 'V13sus'],
  iv9: ['iv11', 'Imaj13', 'vi11', 'V13'],
  iv11: ['iv9', 'Imaj9', 'V13sus', 'iiø7'],
  'vii°': ['V', 'V7', 'iii', 'vi'],
  'vii°7': ['V7', 'iii7', 'vi7', 'Imaj7'],
};

const MINOR_SUBSTITUTE_POOL: Partial<Record<string, readonly ChordSymbol[]>> = {
  i: ['VI', 'III', 'iv', 'VII'],
  'i(maj7)': ['VI', 'iv', 'III', 'VII'],
  i7: ['i9', 'i11', 'i69', 'iv11'],
  i9: ['i11', 'i69', 'VImaj9', 'V13'],
  i11: ['i9', 'i69', 'iv11', 'V13sus'],
  i69: ['i11', 'i9', 'iv11', 'VImaj9'],
  iv: ['i', 'VI', 'VII', 'i7'],
  iv7: ['iv9', 'iv11', 'i11', 'VImaj9'],
  iv9: ['iv11', 'i11', 'V13sus', 'VImaj9'],
  iv11: ['iv9', 'i11', 'bVImaj9', 'V13'],
  v: ['VII', 'VI', 'i', 'iv'],
  V: ['VI', 'VII', 'i', 'iv'],
  V7: ['V13', 'V13sus', 'i11', 'iv11'],
  V13: ['V13sus', 'i11', 'VImaj9', 'iiø7'],
  V13sus: ['V13', 'i11', 'iv11', 'VImaj9'],
  VI: ['iv', 'III', 'i', 'VII'],
  VImaj7: ['VImaj9', 'i11', 'iv11', 'V13'],
  VImaj9: ['i11', 'iv11', 'bIIImaj9', 'V13sus'],
  VII: ['III', 'VI', 'iv', 'i'],
  III: ['VI', 'VII', 'i', 'iv'],
  'ii°': ['V', 'VII', 'VI', 'iv'],
  'iiø7': ['V13', 'i11', 'VImaj9', 'iv11'],
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
