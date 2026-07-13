/**
 * SE2 808 Lab — write chord-lock / key root progression hits onto the tone step grid.
 * Generate places roots; Regenerate (new seed) rolls a fresh pocket + in-key fills.
 */
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

const KICK_BLOCK_OFFSETS = [0, 4, 8, 12, 2, 6, 10, 14, 1, 5, 9, 13] as const;
const BASS_BLOCK_OFFSETS = [0, 8, 4, 12, 2, 6, 10, 14] as const;
const MAJOR_PCS = [0, 2, 4, 5, 7, 9, 11] as const;
const MINOR_PCS = [0, 2, 3, 5, 7, 8, 10] as const;

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

export function se2Lab808ScalePitchClasses(keyRoot: number, mode: 'major' | 'minor'): number[] {
  const intervals = mode === 'minor' ? MINOR_PCS : MAJOR_PCS;
  const root = ((Math.round(keyRoot) % 12) + 12) % 12;
  return intervals.map((i) => (root + i) % 12);
}

function scaleLanesInWindow(baseMidi: number, keyRoot: number, mode: 'major' | 'minor'): number[] {
  const pcs = new Set(se2Lab808ScalePitchClasses(keyRoot, mode));
  const lanes: number[] = [];
  for (let lane = 0; lane < 16; lane++) {
    const midi = baseMidi + lane;
    if (pcs.has(((midi % 12) + 12) % 12)) lanes.push(lane);
  }
  return lanes;
}

function pickColsInBlock(
  startCol: number,
  endCol: number,
  rng: () => number,
  offsets: readonly number[],
  density: number,
): number[] {
  const blockLen = Math.max(1, endCol - startCol);
  const hits = new Set<number>([startCol]);
  const candidates = offsets
    .map((o) => startCol + Math.min(o, blockLen - 1))
    .filter((c) => c >= startCol && c < endCol);
  for (const col of candidates) {
    if (col === startCol) continue;
    if (rng() < density) hits.add(col);
  }
  if (hits.size === 1 && blockLen > 4 && rng() < 0.8) {
    hits.add(startCol + Math.min(8, blockLen - 1));
  }
  if (hits.size < 2 && blockLen > 8 && rng() < 0.55) {
    hits.add(startCol + Math.min(4, blockLen - 1));
  }
  return [...hits].sort((a, b) => a - b);
}

function pickKickColsInBlock(startCol: number, endCol: number, rng: () => number): number[] {
  return pickColsInBlock(startCol, endCol, rng, KICK_BLOCK_OFFSETS, 0.38 + rng() * 0.28);
}

function pickBassColsInBlock(startCol: number, endCol: number, rng: () => number): number[] {
  return pickColsInBlock(startCol, endCol, rng, BASS_BLOCK_OFFSETS, 0.22 + rng() * 0.35);
}

function pickScaleLaneNear(
  rootLane: number,
  scaleLanes: readonly number[],
  rng: () => number,
): number | null {
  if (scaleLanes.length === 0) return null;
  const near = scaleLanes.filter((l) => Math.abs(l - rootLane) <= 7 && l !== rootLane);
  const pool = near.length > 0 ? near : scaleLanes.filter((l) => l !== rootLane);
  if (pool.length === 0) return rootLane;
  return pool[Math.floor(rng() * pool.length)]!;
}

function placeHit(pattern: Se2Lab808ToneGridPattern, lane: number, col: number, totalSteps: number): boolean {
  if (lane < 0 || lane > 15 || col < 0 || col >= totalSteps) return false;
  if (pattern[lane]![col]) return false;
  pattern[lane]![col] = true;
  return true;
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
  /** When set, regenerate can sprinkle in-key scale fills around the roots. */
  keyRoot?: number;
  keyMode?: 'major' | 'minor';
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

  const baseMidi = se2Lab808BaseMidiForRoots(roots);
  const totalSteps = se2Lab808ToneGridStepCount(args.loopBars);
  const pattern = emptySe2Lab808ToneGridPattern(args.loopBars);
  const rng = mulberry32((args.seed ?? Date.now()) >>> 0);
  let hitCount = 0;
  const isKick = args.soundLane === 'kick';
  const keyRoot = args.keyRoot ?? 0;
  const keyMode = args.keyMode === 'minor' ? 'minor' : 'major';
  const scaleLanes = scaleLanesInWindow(baseMidi, keyRoot, keyMode);

  for (const root of roots) {
    const rootLane = se2Lab808LaneForRootMidi(baseMidi, root.midi);
    if (rootLane == null) continue;
    const startCol = se2Lab808BeatToToneGridCol(root.startBeat);
    if (startCol >= totalSteps) continue;
    const endCol = Math.min(
      totalSteps,
      Math.max(startCol + 1, se2Lab808BeatToToneGridCol(root.startBeat + root.durBeats)),
    );

    const cols = isKick
      ? pickKickColsInBlock(startCol, endCol, rng)
      : pickBassColsInBlock(startCol, endCol, rng);

    for (const col of cols) {
      let lane = rootLane;
      // Occasional in-key neighbor (same key / scale) so regenerate feels like a new fill.
      if (col !== startCol && scaleLanes.length > 1 && rng() < (isKick ? 0.28 : 0.42)) {
        lane = pickScaleLaneNear(rootLane, scaleLanes, rng) ?? rootLane;
      } else if (col === startCol && !isKick && rng() < 0.22) {
        // Bass: sometimes drop/raise an octave within the 16-pad window.
        const oct = rootLane >= 12 ? rootLane - 12 : rootLane + 12;
        if (oct >= 0 && oct <= 15 && scaleLanes.includes(oct)) lane = oct;
      }
      if (placeHit(pattern, lane, col, totalSteps)) hitCount += 1;
    }

    // Pickup / approach note before the chord change (in-key).
    if (scaleLanes.length > 1 && startCol > 0 && rng() < (isKick ? 0.35 : 0.48)) {
      const approachLane = pickScaleLaneNear(rootLane, scaleLanes, rng);
      const approachCol = Math.max(0, startCol - (rng() < 0.55 ? 1 : 2));
      if (approachLane != null && placeHit(pattern, approachLane, approachCol, totalSteps)) {
        hitCount += 1;
      }
    }
  }

  // Sparse mid-loop scale pepper so consecutive seeds never look identical on bass.
  if (scaleLanes.length > 0 && rng() < 0.7) {
    const pepperCount = 1 + Math.floor(rng() * (isKick ? 3 : 4));
    for (let i = 0; i < pepperCount; i++) {
      const lane = scaleLanes[Math.floor(rng() * scaleLanes.length)]!;
      const col = Math.floor(rng() * totalSteps);
      if (placeHit(pattern, lane, col, totalSteps)) hitCount += 1;
    }
  }

  const bars = args.loopBars;
  return {
    pattern,
    tonePadBaseMidi: baseMidi,
    hitCount,
    status: `${hitCount} hit${hitCount === 1 ? '' : 's'} · ${bars}-bar ${isKick ? 'kick' : 'bass'} · seed ${args.seed ?? 0}`,
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
