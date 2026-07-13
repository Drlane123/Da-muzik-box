/**
 * SE2 808 Lab — write chord-lock / key root progression hits onto the tone step grid.
 *
 * Genre pockets drive kick / 808 density (trap sparse, dance four-on-floor, etc.).
 * Quantize (1/4 … 1/32) snaps generate/regenerate placement on the 16th-note grid.
 */
import {
  LAB808_QUANTIZE_OPTIONS,
  quantizeDivisionsPerBar,
  type Lab808Quantize,
} from '@/app/lib/creationStation/lab808RollQuantize';
import { LAB808_BEATS_PER_BAR } from '@/app/lib/creationStation/lab808ChordRoots';
import type { Lab808ProgressionRoot } from '@/app/lib/creationStation/lab808ChordRoots';
import { lab808DefaultTonePadBaseMidi } from '@/app/lib/creationStation/lab808TonePads';
import type { Lab808SoundLane } from '@/app/lib/creationStation/eightZeroEightVoice';
import { mulberry32 } from '@/app/lib/magentaPatternGenerator';
import {
  emptySe2Lab808ToneGridPattern,
  SE2_LAB808_TONE_GRID_STEPS_PER_BAR,
  se2Lab808ToneGridStepCount,
  type Se2Lab808ToneGridLoopBars,
  type Se2Lab808ToneGridPattern,
} from '@/app/lib/studio/se2Lab808DrumPattern';

/** UI options for SE2 808 Lab generate/regenerate (no triplets / 64ths). */
export const SE2_LAB808_ROOT_GEN_QUANTIZE_OPTIONS = ['1/4', '1/8', '1/16', '1/32'] as const satisfies readonly Lab808Quantize[];
export type Se2Lab808RootGenQuantize = (typeof SE2_LAB808_ROOT_GEN_QUANTIZE_OPTIONS)[number];

export function se2NormalizeLab808RootGenQuantize(raw: string | undefined): Se2Lab808RootGenQuantize {
  const id = (raw ?? '').trim() as Se2Lab808RootGenQuantize;
  return (SE2_LAB808_ROOT_GEN_QUANTIZE_OPTIONS as readonly string[]).includes(id) ? id : '1/8';
}

export const SE2_LAB808_ROOT_GEN_GENRES = {
  trap: {
    id: 'trap',
    label: 'Trap',
    defaultQuantize: '1/8' as Se2Lab808RootGenQuantize,
    fourOnFloor: false,
    kickAdditiveChance: 0.55,
    kickEndRollChance: 0.42,
    kickTripleChance: 0.35,
    kickAdditiveOffsets: [8, 6, 10, 12, 4],
    bassLateHitChance: 0.28,
    bassOctaveFlipChance: 0.12,
  },
  rnb: {
    id: 'rnb',
    label: 'R&B',
    defaultQuantize: '1/8' as Se2Lab808RootGenQuantize,
    fourOnFloor: false,
    kickAdditiveChance: 0.38,
    kickEndRollChance: 0.18,
    kickTripleChance: 0.12,
    kickAdditiveOffsets: [8, 12, 6],
    bassLateHitChance: 0.4,
    bassOctaveFlipChance: 0.08,
  },
  kpop: {
    id: 'kpop',
    label: 'K-pop',
    defaultQuantize: '1/16' as Se2Lab808RootGenQuantize,
    fourOnFloor: false,
    kickAdditiveChance: 0.62,
    kickEndRollChance: 0.28,
    kickTripleChance: 0.2,
    kickAdditiveOffsets: [8, 4, 12, 10],
    bassLateHitChance: 0.35,
    bassOctaveFlipChance: 0.1,
  },
  dance: {
    id: 'dance',
    label: 'Dance',
    defaultQuantize: '1/4' as Se2Lab808RootGenQuantize,
    fourOnFloor: true,
    kickAdditiveChance: 0.15,
    kickEndRollChance: 0.12,
    kickTripleChance: 0.08,
    kickAdditiveOffsets: [8],
    bassLateHitChance: 0.22,
    bassOctaveFlipChance: 0.05,
  },
  hiphop: {
    id: 'hiphop',
    label: 'Hip-hop',
    defaultQuantize: '1/8' as Se2Lab808RootGenQuantize,
    fourOnFloor: false,
    kickAdditiveChance: 0.7,
    kickEndRollChance: 0.25,
    kickTripleChance: 0.15,
    kickAdditiveOffsets: [6, 10, 8, 14, 4],
    bassLateHitChance: 0.3,
    bassOctaveFlipChance: 0.1,
  },
  drill: {
    id: 'drill',
    label: 'Drill',
    defaultQuantize: '1/16' as Se2Lab808RootGenQuantize,
    fourOnFloor: false,
    kickAdditiveChance: 0.72,
    kickEndRollChance: 0.48,
    kickTripleChance: 0.4,
    kickAdditiveOffsets: [6, 10, 14, 2, 12],
    bassLateHitChance: 0.2,
    bassOctaveFlipChance: 0.06,
  },
} as const;

export type Se2Lab808RootGenGenreId = keyof typeof SE2_LAB808_ROOT_GEN_GENRES;
export const SE2_LAB808_ROOT_GEN_GENRE_ORDER = Object.keys(
  SE2_LAB808_ROOT_GEN_GENRES,
) as Se2Lab808RootGenGenreId[];

export type Se2Lab808RootGenGenreProfile = (typeof SE2_LAB808_ROOT_GEN_GENRES)[Se2Lab808RootGenGenreId];

export function se2NormalizeLab808RootGenGenre(raw: string | undefined): Se2Lab808RootGenGenreId {
  const id = (raw ?? '').trim() as Se2Lab808RootGenGenreId;
  return SE2_LAB808_ROOT_GEN_GENRE_ORDER.includes(id) ? id : 'trap';
}

export function se2Lab808RootGenGenreProfile(
  id: Se2Lab808RootGenGenreId | string | undefined,
): Se2Lab808RootGenGenreProfile {
  return SE2_LAB808_ROOT_GEN_GENRES[se2NormalizeLab808RootGenGenre(id)];
}

/** Grid columns per quantize step on the fixed 16th-note tone grid. */
export function se2Lab808QuantizeGridStride(q: Lab808Quantize): number {
  const divs = quantizeDivisionsPerBar(q);
  if (divs >= SE2_LAB808_TONE_GRID_STEPS_PER_BAR) return 1;
  return Math.max(1, Math.round(SE2_LAB808_TONE_GRID_STEPS_PER_BAR / divs));
}

export function se2Lab808BeatToToneGridCol(beat: number): number {
  return Math.max(0, Math.round(beat * (SE2_LAB808_TONE_GRID_STEPS_PER_BAR / LAB808_BEATS_PER_BAR)));
}

export function se2Lab808BaseMidiForRoots(roots: readonly Lab808ProgressionRoot[]): number {
  if (roots.length === 0) return lab808DefaultTonePadBaseMidi();
  const midis = roots.map((r) => r.midi);
  const min = Math.min(...midis);
  const max = Math.max(...midis);
  if (max - min <= 15) return Math.max(0, Math.min(127 - 15, min));
  const roll = roots.map((r) => r.rollMidi ?? r.midi);
  const rmin = Math.min(...roll);
  const rmax = Math.max(...roll);
  if (rmax - rmin <= 15) return Math.max(0, Math.min(127 - 15, rmin));
  return lab808DefaultTonePadBaseMidi();
}

export function se2Lab808LaneForRootMidi(baseMidi: number, rootMidi: number): number | null {
  const lane = Math.round(rootMidi) - Math.round(baseMidi);
  if (lane < 0 || lane > 15) return null;
  return lane;
}

const MAJOR_PCS = [0, 2, 4, 5, 7, 9, 11] as const;
const MINOR_PCS = [0, 2, 3, 5, 7, 8, 10] as const;

/** Scale pitch classes for Root Scope dial highlighting (and any in-key helpers). */
export function se2Lab808ScalePitchClasses(keyRoot: number, mode: 'major' | 'minor'): number[] {
  const intervals = mode === 'minor' ? MINOR_PCS : MAJOR_PCS;
  const root = ((Math.round(keyRoot) % 12) + 12) % 12;
  return intervals.map((i) => (root + i) % 12);
}

function snapColToQuantize(col: number, stride: number, startCol: number, endCol: number): number | null {
  if (endCol <= startCol) return startCol;
  const rel = col - startCol;
  const snapped = startCol + Math.round(rel / stride) * stride;
  if (snapped < startCol || snapped >= endCol) return null;
  return snapped;
}

function placeHit(pattern: Se2Lab808ToneGridPattern, lane: number, col: number, totalSteps: number): boolean {
  if (lane < 0 || lane > 15 || col < 0 || col >= totalSteps) return false;
  if (pattern[lane]![col]) return false;
  pattern[lane]![col] = true;
  return true;
}

function pickKickColsInBlock(
  startCol: number,
  endCol: number,
  rng: () => number,
  stride: number,
  genre: Se2Lab808RootGenGenreProfile,
): number[] {
  const blockLen = Math.max(1, endCol - startCol);
  const hits = new Set<number>([startCol]);

  if (genre.fourOnFloor) {
    for (let o = stride; o < blockLen; o += Math.max(stride, 4)) {
      const c = snapColToQuantize(startCol + o, stride, startCol, endCol);
      if (c != null) hits.add(c);
    }
    return [...hits].sort((a, b) => a - b);
  }

  if (blockLen >= stride * 2 && rng() < genre.kickAdditiveChance) {
    const candidates = genre.kickAdditiveOffsets
      .map((o) => snapColToQuantize(startCol + o, stride, startCol, endCol))
      .filter((c): c is number => c != null && c !== startCol);
    if (candidates.length > 0) {
      hits.add(candidates[Math.floor(rng() * candidates.length)]!);
    }
  }

  if (blockLen >= stride * 3 && rng() < genre.kickEndRollChance) {
    const endAnchor = Math.max(
      startCol + stride,
      endCol - stride * (rng() < genre.kickTripleChance ? 3 : 2),
    );
    const rollLen = rng() < genre.kickTripleChance ? 3 : 2;
    for (let i = 0; i < rollLen; i++) {
      const c = snapColToQuantize(endAnchor + i * stride, stride, startCol, endCol);
      if (c != null) hits.add(c);
    }
  }

  return [...hits].sort((a, b) => a - b);
}

function pickBassColsInBlock(
  startCol: number,
  endCol: number,
  rng: () => number,
  stride: number,
  genre: Se2Lab808RootGenGenreProfile,
): number[] {
  const blockLen = Math.max(1, endCol - startCol);
  const hits = new Set<number>([startCol]);

  if (blockLen >= stride * 4 && rng() < genre.bassLateHitChance) {
    const late = snapColToQuantize(startCol + Math.min(8, blockLen - stride), stride, startCol, endCol);
    if (late != null && late !== startCol) hits.add(late);
  }

  return [...hits].sort((a, b) => a - b);
}

export type Se2Lab808GenerateRootGridResult = {
  pattern: Se2Lab808ToneGridPattern;
  tonePadBaseMidi: number;
  hitCount: number;
  status: string;
};

export function se2Lab808GenerateRootGridPattern(args: {
  roots: readonly Lab808ProgressionRoot[];
  loopBars: Se2Lab808ToneGridLoopBars;
  soundLane: Lab808SoundLane;
  tonePadBaseMidi?: number;
  seed?: number;
  keyRoot?: number;
  keyMode?: 'major' | 'minor';
  quantize?: Lab808Quantize;
  genre?: Se2Lab808RootGenGenreId | string;
}): Se2Lab808GenerateRootGridResult {
  const roots = args.roots;
  if (roots.length === 0) {
    return {
      pattern: emptySe2Lab808ToneGridPattern(args.loopBars),
      tonePadBaseMidi: args.tonePadBaseMidi ?? lab808DefaultTonePadBaseMidi(),
      hitCount: 0,
      status: 'No roots — pick a key or chord lane first',
    };
  }

  const genre = se2Lab808RootGenGenreProfile(args.genre);
  const quantize = se2NormalizeLab808RootGenQuantize(args.quantize ?? genre.defaultQuantize);
  const stride = se2Lab808QuantizeGridStride(quantize);
  const baseMidi = se2Lab808BaseMidiForRoots(roots);
  const totalSteps = se2Lab808ToneGridStepCount(args.loopBars);
  const pattern = emptySe2Lab808ToneGridPattern(args.loopBars);
  const rng = mulberry32((args.seed ?? Date.now()) >>> 0);
  let hitCount = 0;
  const isKick = args.soundLane === 'kick';

  for (const root of roots) {
    const rootLane = se2Lab808LaneForRootMidi(baseMidi, root.midi);
    if (rootLane == null) continue;
    const rawStart = se2Lab808BeatToToneGridCol(root.startBeat);
    if (rawStart >= totalSteps) continue;
    const rawEnd = Math.min(
      totalSteps,
      Math.max(rawStart + 1, se2Lab808BeatToToneGridCol(root.startBeat + root.durBeats)),
    );
    const startCol = snapColToQuantize(rawStart, stride, 0, totalSteps) ?? rawStart;
    const endCol = Math.max(startCol + stride, rawEnd);

    const cols = isKick
      ? pickKickColsInBlock(startCol, endCol, rng, stride, genre)
      : pickBassColsInBlock(startCol, endCol, rng, stride, genre);

    for (const col of cols) {
      let lane = rootLane;
      if (!isKick && col === startCol && rng() < genre.bassOctaveFlipChance) {
        const oct = rootLane >= 12 ? rootLane - 12 : rootLane + 12;
        if (oct >= 0 && oct <= 15) lane = oct;
      }
      if (placeHit(pattern, lane, col, totalSteps)) hitCount += 1;
    }
  }

  const bars = args.loopBars;
  const laneLabel = isKick ? 'kick' : '808';
  return {
    pattern,
    tonePadBaseMidi: baseMidi,
    hitCount,
    status: `${hitCount} hit${hitCount === 1 ? '' : 's'} · ${bars}-bar ${laneLabel} · ${genre.label} · ${quantize}`,
  };
}

export function se2Lab808RootIndexForPitchClass(
  roots: readonly Lab808ProgressionRoot[],
  pitchClass: number,
): number | null {
  const pc = ((Math.round(pitchClass) % 12) + 12) % 12;
  const idx = roots.findIndex((r) => ((r.midi % 12) + 12) % 12 === pc);
  return idx >= 0 ? idx : null;
}

export { LAB808_QUANTIZE_OPTIONS };
