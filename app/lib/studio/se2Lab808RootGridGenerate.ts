/**
 * SE2 808 Lab — write chord-lock / key root progression hits onto the tone step grid.
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

const KICK_BLOCK_OFFSETS = [0, 4, 8, 12, 2, 6, 10, 14] as const;

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

function pickKickColsInBlock(
  startCol: number,
  endCol: number,
  rng: () => number,
): number[] {
  const blockLen = Math.max(1, endCol - startCol);
  const hits = new Set<number>([startCol]);
  const candidates = KICK_BLOCK_OFFSETS.map((o) => startCol + Math.min(o, blockLen - 1)).filter(
    (c) => c >= startCol && c < endCol,
  );
  for (const col of candidates) {
    if (col === startCol) continue;
    if (rng() < 0.42) hits.add(col);
  }
  if (hits.size === 1 && blockLen > 4 && rng() < 0.75) {
    hits.add(startCol + Math.min(8, blockLen - 1));
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

  const baseMidi = args.tonePadBaseMidi ?? se2Lab808BaseMidiForRoots(roots);
  const totalSteps = se2Lab808ToneGridStepCount(args.loopBars);
  const pattern = emptySe2Lab808ToneGridPattern(args.loopBars);
  const rng = mulberry32((args.seed ?? Date.now()) >>> 0);
  let hitCount = 0;
  const isKick = args.soundLane === 'kick';

  for (const root of roots) {
    const lane = se2Lab808LaneForRootMidi(baseMidi, root.midi);
    if (lane == null) continue;
    const startCol = se2Lab808BeatToToneGridCol(root.startBeat);
    if (startCol >= totalSteps) continue;
    const endCol = Math.min(totalSteps, Math.max(startCol + 1, se2Lab808BeatToToneGridCol(root.startBeat + root.durBeats)));

    const cols = isKick ? pickKickColsInBlock(startCol, endCol, rng) : [startCol];
    for (const col of cols) {
      if (col < 0 || col >= totalSteps) continue;
      pattern[lane]![col] = true;
      hitCount += 1;
    }
  }

  const bars = args.loopBars;
  return {
    pattern,
    tonePadBaseMidi: baseMidi,
    hitCount,
    status: `${hitCount} hit${hitCount === 1 ? '' : 's'} · ${bars}-bar ${isKick ? 'kick' : 'bass'} roots`,
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

export function se2Lab808ScalePitchClasses(keyRoot: number, mode: 'major' | 'minor'): number[] {
  const intervals = mode === 'minor' ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
  const root = ((Math.round(keyRoot) % 12) + 12) % 12;
  return intervals.map((i) => (root + i) % 12);
}
