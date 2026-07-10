/**
 * Synth Geno — genre presets (chords + melody + bass). Standalone, no Orchid/Groove Lab.
 */
import type { StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';
import type { GenoBassPattern } from '@/app/lib/studio/se2SynthGenoBassEngine';
import type { GenoMelodyGenre } from '@/app/lib/studio/se2SynthGenoMelodyEngine';
import type { GenoChordStyle } from '@/app/lib/studio/se2SynthGenoComposePrompt';
import type {
  GenoChordType,
  GenoExtension,
  GenoPerfMode,
  GenoProgressionId,
} from '@/app/lib/studio/se2SynthGenoChordEngine';

export type GenoStylePreset = {
  label: string;
  progressionPool: readonly GenoProgressionId[];
  defaultProgression: GenoProgressionId;
  extensions: readonly GenoExtension[];
  inversion: number;
  perfMode: GenoPerfMode;
  staccato: boolean;
  smartMatch: boolean;
  lockedType: GenoChordType;
  /** When set, nudge generation toward major or minor feel. */
  keyModeBias?: StudioDetectedKeyMode;
  melodyGenre: GenoMelodyGenre;
  bassPattern: GenoBassPattern;
  chordVelocityBase: number;
};

export const GENO_STYLE_CHIP_ORDER: readonly GenoChordStyle[] = [
  'pop',
  'rnb',
  'jazz',
  'trap',
  'dance',
  'disco',
  'dark',
  'minor',
  'bright',
  'major',
  'kpop',
  'gospel',
];

const POP: GenoStylePreset = {
  label: 'Pop',
  progressionPool: ['I-V-vi-IV', 'vi-IV-I-V', 'I-vi-IV-V', 'I-IV-V-I', 'IV-I-V-vi', 'I-V-vi-IV'],
  defaultProgression: 'I-V-vi-IV',
  extensions: ['9'],
  inversion: 0,
  perfMode: 'block',
  staccato: false,
  smartMatch: true,
  lockedType: 'maj',
  melodyGenre: 'pop',
  bassPattern: 'root-fifth',
  chordVelocityBase: 78,
};

const RNB: GenoStylePreset = {
  label: 'R&B',
  /** Chris Brown / contemporary R&B — vi–IV loops, neo-soul ii–V, classic I–vi–IV–V. */
  progressionPool: [
    'I-vi-IV-V',
    'vi-IV-I-V',
    'I-III-vi-IV',
    'ii-V-I',
    'vi-ii-V-I',
    'IV-I-V-vi',
    'I-V-vi-IV',
    'I-vi-IV-V',
  ],
  defaultProgression: 'I-vi-IV-V',
  extensions: ['m7', '9', '6'],
  inversion: 2,
  perfMode: 'block',
  staccato: false,
  smartMatch: true,
  lockedType: 'maj',
  melodyGenre: 'rnb',
  bassPattern: 'walk',
  chordVelocityBase: 68,
};

const TRAP: GenoStylePreset = {
  label: 'Trap',
  progressionPool: ['i-VI-III-VII', 'i-VII-VI-V', 'i-iv-VI-VII', 'hold-i', 'I-V-vi-IV'],
  defaultProgression: 'i-VI-III-VII',
  extensions: ['m7'],
  inversion: 0,
  perfMode: 'block',
  staccato: true,
  smartMatch: true,
  lockedType: 'min',
  keyModeBias: 'minor',
  melodyGenre: 'trap',
  bassPattern: 'root',
  chordVelocityBase: 88,
};

const DANCE: GenoStylePreset = {
  label: 'Dance',
  progressionPool: ['vi-IV-I-V', 'I-V-vi-IV', 'IV-I-V-vi', 'I-IV-vi-V', 'I-vi-IV-V'],
  defaultProgression: 'vi-IV-I-V',
  extensions: ['9', 'M7'],
  inversion: 0,
  perfMode: 'block',
  staccato: false,
  smartMatch: true,
  lockedType: 'maj',
  melodyGenre: 'dance',
  bassPattern: 'root-fifth',
  chordVelocityBase: 82,
};

const DISCO: GenoStylePreset = {
  label: 'Disco',
  progressionPool: ['I-IV-vi-V', 'IV-V-I-vi', 'I-V-vi-IV', 'vi-IV-I-V', 'I-IV-V-I'],
  defaultProgression: 'I-IV-vi-V',
  extensions: ['9', 'M7', '6'],
  inversion: 1,
  perfMode: 'block',
  staccato: false,
  smartMatch: true,
  lockedType: 'maj',
  melodyGenre: 'disco',
  bassPattern: 'walk',
  chordVelocityBase: 80,
};

const DARK: GenoStylePreset = {
  label: 'Dark',
  progressionPool: ['i-VI-III-VII', 'i-VII-VI-V', 'i-iv-VI-VII', 'hold-i', 'i-VI-III-VII'],
  defaultProgression: 'i-VI-III-VII',
  extensions: ['m7'],
  inversion: 0,
  perfMode: 'block',
  staccato: false,
  smartMatch: true,
  lockedType: 'min',
  keyModeBias: 'minor',
  melodyGenre: 'dark',
  bassPattern: 'root',
  chordVelocityBase: 68,
};

const BRIGHT: GenoStylePreset = {
  label: 'Bright',
  progressionPool: ['I-V-vi-IV', 'IV-I-V-vi', 'I-IV-V-I', 'vi-IV-I-V', 'I-vi-IV-V'],
  defaultProgression: 'I-V-vi-IV',
  extensions: ['9', 'M7'],
  inversion: 0,
  perfMode: 'block',
  staccato: false,
  smartMatch: true,
  lockedType: 'maj',
  melodyGenre: 'bright',
  bassPattern: 'root-fifth',
  chordVelocityBase: 84,
};

const GOSPEL: GenoStylePreset = {
  label: 'Gospel',
  progressionPool: ['I-IV-V-I', 'I-vi-IV-V', 'ii-V-I', 'I-IV-V-I'],
  defaultProgression: 'I-IV-V-I',
  extensions: ['M7', '9'],
  inversion: 1,
  perfMode: 'block',
  staccato: false,
  smartMatch: true,
  lockedType: 'maj',
  melodyGenre: 'gospel',
  bassPattern: 'walk',
  chordVelocityBase: 76,
};

const MAJOR: GenoStylePreset = {
  ...POP,
  label: 'Major',
  melodyGenre: 'major',
  bassPattern: 'root-fifth',
};

const MINOR: GenoStylePreset = {
  ...DARK,
  label: 'Minor',
  melodyGenre: 'minor',
  keyModeBias: 'minor',
  bassPattern: 'root',
};

const JAZZ: GenoStylePreset = {
  label: 'Jazz',
  progressionPool: ['ii-V-I', 'I-vi-IV-V', 'vi-ii-V-I', 'I-vi-ii-V', 'IV-V-I-vi', 'ii-V-I'],
  defaultProgression: 'ii-V-I',
  extensions: ['M7', 'm7', '9', '11', '13'],
  inversion: 2,
  perfMode: 'block',
  staccato: false,
  smartMatch: true,
  lockedType: 'maj',
  melodyGenre: 'rnb',
  bassPattern: 'walk',
  chordVelocityBase: 74,
};

const KPOP: GenoStylePreset = {
  ...BRIGHT,
  label: 'K-Pop',
  progressionPool: ['vi-IV-I-V', 'I-V-vi-IV', 'IV-I-V-vi', 'I-V-vi-IV'],
  defaultProgression: 'vi-IV-I-V',
  melodyGenre: 'kpop',
  bassPattern: 'kpop',
  chordVelocityBase: 80,
};

export const GENO_STYLE_PRESETS: Record<GenoChordStyle, GenoStylePreset> = {
  pop: POP,
  rnb: RNB,
  jazz: JAZZ,
  trap: TRAP,
  dance: DANCE,
  disco: DISCO,
  dark: DARK,
  bright: BRIGHT,
  gospel: GOSPEL,
  major: MAJOR,
  minor: MINOR,
  kpop: KPOP,
  default: POP,
};

export function genoStylePreset(style: GenoChordStyle): GenoStylePreset {
  return GENO_STYLE_PRESETS[style] ?? POP;
}

export function genoPickProgressionForStyle(
  style: GenoChordStyle,
  seed: number,
): GenoProgressionId {
  const preset = genoStylePreset(style);
  const pool = preset.progressionPool;
  const idx = Math.abs(seed) % pool.length;
  return pool[idx] ?? preset.defaultProgression;
}

export function genoEffectiveKeyModeForStyle(
  style: GenoChordStyle,
  projectMode: StudioDetectedKeyMode,
): StudioDetectedKeyMode {
  const bias = genoStylePreset(style).keyModeBias;
  if (!bias) return projectMode;
  if (style === 'trap' || style === 'dark' || style === 'minor') return 'minor';
  if (style === 'bright' || style === 'disco' || style === 'dance' || style === 'major' || style === 'kpop') {
    return projectMode === 'minor' ? projectMode : 'major';
  }
  return bias ?? projectMode;
}
