/**
 * Drum Generator — Bank 2 (Chord Gen).
 * Modern grooves (Drill, Lo-Fi, Dance, K-pop) — separate from Trap/R&B + Beat Lab banks.
 * Picks genre from linked chord lane / style chip, then generates a matched pattern + kit.
 */
import { beatLabProducerKitIdForPatternPreset } from '@/app/lib/creationStation/beatLabPatternPresetKits';
import type { BeatLabProducerKitId } from '@/app/lib/creationStation/beatLabProducerKits';
import { clampGrooveLabBpm } from '@/app/lib/creationStation/grooveLabTempo';
import { generateDrumPattern, mulberry32 } from '@/app/lib/magentaPatternGenerator';
import {
  ALL_PRESETS,
  getPatternPresetBpm,
  type PatternPreset,
} from '@/app/lib/patternPresets';
import { se2HarmonySourceSteps } from '@/app/lib/studio/se2GlideBassHarmony';
import type { Se2DrumGeneratorLoad } from '@/app/lib/studio/se2DrumGeneratorEngine';
import { se2InferDrumGenStyleFromHarmonyTrack } from '@/app/lib/studio/se2DrumGeneratorEngine';
import {
  studioDrumInstrumentOptionForBeatLabPreset,
  studioDrumPatternGridToNotes,
  studioTileDrumPatternNotes,
  STUDIO_DRUM_PATTERN_LOOP_BARS,
  type StudioDrumMidiNote,
} from '@/app/lib/studio/studioEditor2DrumPatterns';
import {
  se2NormalizeDrumGenTemperature,
  type Se2DrumGenHarmonySourceTrack,
  type Se2DrumGenStyle,
} from '@/app/lib/studio/se2DrumGeneratorTrack';

export type Se2DrumGenModernGenre = 'drill' | 'lofi' | 'dance' | 'kpop';

export type Se2DrumGenModernPreset = PatternPreset & {
  modernGenre: Se2DrumGenModernGenre;
};

const R = 8;
const S = 16;

function grid(hits: ReadonlyArray<[number, number]>): boolean[][] {
  const g: boolean[][] = Array.from({ length: R }, () => new Array<boolean>(S).fill(false));
  for (const [row, step] of hits) {
    if (row >= 0 && row < R && step >= 0 && step < S) g[row]![step] = true;
  }
  return g;
}

/** Bank-2-only K-pop / uptempo pop patterns (not in Trap/R&B or Beat Lab pickers). */
const SE2_BANK2_KPOP_EXCLUSIVE: readonly Se2DrumGenModernPreset[] = [
  {
    id: 'se2-kpop-1',
    name: 'K-Pop 4×4 Drive',
    genre: 'K-pop',
    role: 'drums',
    modernGenre: 'kpop',
    bpm: 128,
    desc: 'Four-on-floor kick, tight clap 2 & 4, 16th hats — chorus lift',
    pattern: grid([
      [0, 0], [0, 4], [0, 8], [0, 12],
      [1, 4], [1, 12],
      [2, 4], [2, 12],
      [3, 0], [3, 2], [3, 4], [3, 6], [3, 8], [3, 10], [3, 12], [3, 14],
      [4, 2], [4, 10],
    ]),
  },
  {
    id: 'se2-kpop-2',
    name: 'K-Pop Bounce',
    genre: 'K-pop',
    role: 'drums',
    modernGenre: 'kpop',
    bpm: 124,
    desc: 'Syncopated kick, layered clap, open hat pushes — verse pocket',
    pattern: grid([
      [0, 0], [0, 6], [0, 10], [0, 14],
      [1, 4], [1, 12],
      [2, 4], [2, 12],
      [3, 0], [3, 2], [3, 4], [3, 6], [3, 8], [3, 10], [3, 12], [3, 14],
      [4, 6], [4, 14],
    ]),
  },
  {
    id: 'se2-kpop-3',
    name: 'K-Pop Festival',
    genre: 'K-pop',
    role: 'drums',
    modernGenre: 'kpop',
    bpm: 132,
    desc: 'Uptempo EDM-pop: running hats, crash accents, four-on kick',
    pattern: grid([
      [0, 0], [0, 4], [0, 8], [0, 12],
      [1, 4], [1, 12],
      [3, 0], [3, 1], [3, 2], [3, 3], [3, 4], [3, 5], [3, 6], [3, 7],
      [3, 8], [3, 9], [3, 10], [3, 11], [3, 12], [3, 13], [3, 14], [3, 15],
      [4, 0], [4, 8],
      [5, 4], [5, 12],
    ]),
  },
  {
    id: 'se2-kpop-4',
    name: 'K-Pop Half-Time',
    genre: 'K-pop',
    role: 'drums',
    modernGenre: 'kpop',
    bpm: 118,
    desc: 'Half-time drop with trap clap layer — pre-chorus / bridge',
    pattern: grid([
      [0, 0], [0, 10],
      [1, 4], [1, 12],
      [2, 4], [2, 12],
      [3, 0], [3, 2], [3, 4], [3, 6], [3, 8], [3, 10], [3, 12], [3, 14],
      [7, 3], [7, 11],
    ]),
  },
];

/** Bank-2-only Brooklyn drill — replaces legacy drill-2 grid for modern NY half-time feel. */
const SE2_BANK2_DRILL_EXCLUSIVE: readonly Se2DrumGenModernPreset[] = [
  {
    id: 'se2-drill-brooklyn',
    name: 'Brooklyn Drill',
    genre: 'Drill',
    role: 'drums',
    modernGenre: 'drill',
    bpm: 140,
    desc: 'NY half-time: sliding 808 bounce, clap on 3, hat roll into the snare',
    pattern: grid([
      [0, 0], [0, 5], [0, 10], [0, 13],
      [2, 8],
      [3, 0], [3, 1], [3, 2], [3, 3], [3, 4], [3, 5], [3, 6], [3, 7],
      [3, 8], [3, 9], [3, 10], [3, 11], [3, 12], [3, 13], [3, 14], [3, 15],
      [4, 6], [4, 14],
      [7, 3], [7, 7], [7, 11],
    ]),
  },
];

/** Curated modern IDs from the main library (Bank 2 only — not shown in Bank 1 menus). */
const CURATED_DRILL_IDS = ['drill-1', 'drill-3', 'trap-5'] as const;
const CURATED_LOFI_IDS = ['lofi-1', 'lofi-2', 'lofi-3'] as const;
const CURATED_DANCE_IDS = [
  'dance-1',
  'dance-2',
  'dance-3',
  'dance-5',
  'dance-11',
  'house-1',
  'house-3',
] as const;

const presetById = new Map(ALL_PRESETS.map((p) => [p.id, p]));

function curatedPreset(id: string, modernGenre: Se2DrumGenModernGenre): Se2DrumGenModernPreset | undefined {
  const p = presetById.get(id);
  if (!p || p.role !== 'drums') return undefined;
  return { ...p, modernGenre };
}

function buildCuratedModernPresets(): Se2DrumGenModernPreset[] {
  const out: Se2DrumGenModernPreset[] = [
    ...SE2_BANK2_KPOP_EXCLUSIVE,
    ...SE2_BANK2_DRILL_EXCLUSIVE,
  ];
  for (const id of CURATED_DRILL_IDS) {
    const p = curatedPreset(id, 'drill');
    if (p) out.push(p);
  }
  for (const id of CURATED_LOFI_IDS) {
    const p = curatedPreset(id, 'lofi');
    if (p) out.push(p);
  }
  for (const id of CURATED_DANCE_IDS) {
    const p = curatedPreset(id, 'dance');
    if (p) out.push(p);
  }
  return out;
}

export const SE2_DRUM_GEN_MODERN_PRESETS: readonly Se2DrumGenModernPreset[] = buildCuratedModernPresets();

export const SE2_DRUM_GEN_MODERN_GENRES: readonly { id: Se2DrumGenModernGenre; label: string }[] = [
  { id: 'drill', label: 'Drill' },
  { id: 'lofi', label: 'Lo-Fi' },
  { id: 'dance', label: 'Dance' },
  { id: 'kpop', label: 'K-pop' },
];

export function se2ModernBankPresetById(id: string | undefined): Se2DrumGenModernPreset | undefined {
  if (!id) return undefined;
  return SE2_DRUM_GEN_MODERN_PRESETS.find((p) => p.id === id);
}

export function se2ModernBankPresetsForGenre(genre: Se2DrumGenModernGenre): readonly Se2DrumGenModernPreset[] {
  return SE2_DRUM_GEN_MODERN_PRESETS.filter((p) => p.modernGenre === genre);
}

/** Chord / style chip → Bank 2 modern genre. */
export function se2ModernGenreFromChordStyle(style: Se2DrumGenStyle): Se2DrumGenModernGenre {
  switch (style) {
    case 'kpop':
      return 'kpop';
    case 'dance':
    case 'disco':
    case 'bright':
    case 'major':
    case 'pop':
      return 'dance';
    case 'dark':
    case 'minor':
    case 'trap':
      return 'drill';
    case 'rnb':
    case 'gospel':
      return 'lofi';
    default:
      return 'dance';
  }
}

export function se2ResolveModernGenreFromHarmony(
  harmony: Se2DrumGenHarmonySourceTrack | undefined,
  allTracks: readonly Se2DrumGenHarmonySourceTrack[],
  fallbackStyle: Se2DrumGenStyle,
): Se2DrumGenModernGenre {
  const chordStyle = harmony
    ? se2InferDrumGenStyleFromHarmonyTrack(harmony, allTracks)
    : fallbackStyle;
  return se2ModernGenreFromChordStyle(chordStyle);
}

const MODERN_KIT_POOL: Record<Se2DrumGenModernGenre, readonly BeatLabProducerKitId[]> = {
  drill: ['trapStreetTm88Night', 'brassTrap', 'trapTrunk808', 'trapStreetNegativeFloor'],
  lofi: ['smoothRnb', 'rnbVelvetBloom', 'clubPocket', 'rnbNeoStack'],
  dance: ['houseDrive', 'clubPocket', 'nightSub', 'bell808'],
  kpop: ['clubPocket', 'houseDrive', 'rnbHybrid808Bloom', 'nightSub'],
};

function kitForModernPreset(preset: PatternPreset, genre: Se2DrumGenModernGenre, seed: number): BeatLabProducerKitId {
  const fromPreset = beatLabProducerKitIdForPatternPreset(preset);
  if (preset.genre === 'K-pop' || preset.genre === 'Drill' || preset.genre === 'Lo-Fi' || preset.genre === 'Dance') {
    return fromPreset;
  }
  const pool = MODERN_KIT_POOL[genre];
  const idx = Math.floor(mulberry32(seed + 31)() * pool.length);
  return pool[idx] ?? fromPreset;
}

function pickModernPreset(genre: Se2DrumGenModernGenre, seed: number): Se2DrumGenModernPreset {
  const pool = se2ModernBankPresetsForGenre(genre);
  if (pool.length === 0) return SE2_DRUM_GEN_MODERN_PRESETS[0]!;
  const idx = Math.floor(mulberry32(seed)() * pool.length);
  return pool[idx] ?? pool[0]!;
}

/** Nudge kick velocity on bar downbeats when chord steps exist on the linked lane. */
function accentNotesToChordBars(
  notes: StudioDrumMidiNote[],
  harmony: Se2DrumGenHarmonySourceTrack | undefined,
  beatsPerBar: number,
): StudioDrumMidiNote[] {
  const steps = harmony ? se2HarmonySourceSteps(harmony) : [];
  if (steps.length === 0) return notes;

  const barStarts = new Set<number>();
  let beat = 0;
  for (const step of steps) {
    const len = Math.max(1 / 16, step.beats ?? beatsPerBar);
    barStarts.add(Math.floor(beat / beatsPerBar) * beatsPerBar);
    beat += len;
  }
  if (barStarts.size === 0) return notes;

  return notes.map((n) => {
    const isKick = n.pitch >= 35 && n.pitch <= 38;
    if (!isKick) return n;
    for (const barStart of barStarts) {
      if (Math.abs(n.startBeat - barStart) < 0.06) {
        return { ...n, velocity: Math.min(127, n.velocity + 14) };
      }
    }
    return n;
  });
}

export type Se2ModernBankGenerateOpts = {
  chordStyle: Se2DrumGenStyle;
  harmony?: Se2DrumGenHarmonySourceTrack;
  allTracks?: readonly Se2DrumGenHarmonySourceTrack[];
  forceGenre?: Se2DrumGenModernGenre;
  preset?: Se2DrumGenModernPreset;
  seed: number;
  temperature?: number;
  beatsPerBar?: number;
  loopBars?: number;
  /** When set (e.g. Live Chord card BPM), overrides preset grid BPM on the session transport. */
  transportBpm?: number;
};

export async function se2GenerateModernBankLoad(
  opts: Se2ModernBankGenerateOpts,
): Promise<Se2DrumGeneratorLoad & { modernGenre: Se2DrumGenModernGenre }> {
  const genre =
    opts.forceGenre ??
    se2ResolveModernGenreFromHarmony(opts.harmony, opts.allTracks ?? [], opts.chordStyle);
  const temperature = se2NormalizeDrumGenTemperature(opts.temperature);
  const bpb = Math.max(1, opts.beatsPerBar ?? 4);
  const loopBars = Math.max(1, opts.loopBars ?? STUDIO_DRUM_PATTERN_LOOP_BARS);

  const preset = opts.preset ?? pickModernPreset(genre, opts.seed);

  let pattern = preset.pattern;
  if (!opts.preset) {
    const styleStr =
      genre === 'kpop'
        ? 'dance'
        : genre === 'drill'
          ? 'drill'
          : genre === 'lofi'
            ? 'lofi'
            : 'house';
    const varied = await generateDrumPattern(styleStr, temperature, opts.seed + genre.length * 17);
    if (temperature > 1.02) pattern = varied;
  }

  let oneBarNotes = studioDrumPatternGridToNotes(pattern, { beatsPerBar: bpb });
  oneBarNotes = accentNotesToChordBars(oneBarNotes, opts.harmony, bpb);
  const notes = studioTileDrumPatternNotes(oneBarNotes, bpb, loopBars);

  const producerKitId = kitForModernPreset(preset, genre, opts.seed);
  const midiInstrumentId = studioDrumInstrumentOptionForBeatLabPreset(preset)?.id ?? 'gm:electronic_drums';

  return {
    notes,
    transportBpm:
      opts.transportBpm != null && Number.isFinite(opts.transportBpm)
        ? clampGrooveLabBpm(Math.round(opts.transportBpm))
        : preset.bpm ?? getPatternPresetBpm(preset),
    presetId: preset.id,
    producerKitId,
    midiInstrumentId,
    styleUsed: genre,
    modernGenre: genre,
  };
}

export function se2ModernBankTriggerLabel(
  harmony: Se2DrumGenHarmonySourceTrack | undefined,
  allTracks: readonly Se2DrumGenHarmonySourceTrack[],
  chordStyle: Se2DrumGenStyle,
  activePresetId?: string,
): string {
  if (activePresetId) {
    const p = se2ModernBankPresetById(activePresetId);
    if (p) return p.name.length > 14 ? `${p.name.slice(0, 12)}…` : p.name;
  }
  const genre = se2ResolveModernGenreFromHarmony(harmony, allTracks, chordStyle);
  const hit = SE2_DRUM_GEN_MODERN_GENRES.find((g) => g.id === genre);
  return hit?.label ?? 'Bank 2';
}
