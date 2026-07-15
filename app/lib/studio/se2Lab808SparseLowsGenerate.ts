/**
 * SE2 / Beat Pads 808 Lab — generate sparse R&B / Trap lows locked to chord progression.
 * Places 2–3 hits per bar on the active progression root (not dense trap rolls).
 * Does not alter {@link se2Lab808GenerateRootGridPattern}.
 */
import { LAB808_BEATS_PER_BAR, lab808ActiveRootIndexAtBeat } from '@/app/lib/creationStation/lab808ChordRoots';
import type { Lab808ProgressionRoot } from '@/app/lib/creationStation/lab808ChordRoots';
import { lab808DefaultTonePadBaseMidi } from '@/app/lib/creationStation/lab808TonePads';
import { mulberry32 } from '@/app/lib/magentaPatternGenerator';
import {
  emptySe2Lab808ToneGridPattern,
  SE2_LAB808_TONE_GRID_STEPS_PER_BAR,
  se2Lab808ToneGridStepCount,
  type Se2Lab808ToneGridLoopBars,
} from '@/app/lib/studio/se2Lab808DrumPattern';
import {
  se2Lab808BaseMidiForRoots,
  se2Lab808LaneForRootMidi,
  type Se2Lab808GenerateRootGridResult,
} from '@/app/lib/studio/se2Lab808RootGridGenerate';
import {
  se2Lab808SparseLowsTemplates,
  se2NormalizeLab808SparseLowsGenre,
  type Se2Lab808SparseLowsGenre,
  type Se2Lab808SparseLowsTemplate,
} from '@/app/lib/studio/se2Lab808SparseLowsPack';

const GENRE_LABEL: Record<Se2Lab808SparseLowsGenre, string> = {
  rnb: 'R&B lows',
  trap: 'Trap lows',
  reggae: 'Reggae lows',
};

function pickTemplate(
  pool: readonly Se2Lab808SparseLowsTemplate[],
  rng: () => number,
  excludeId?: string | null,
): Se2Lab808SparseLowsTemplate | null {
  if (pool.length === 0) return null;
  const alternates = excludeId ? pool.filter((t) => t.id !== excludeId) : pool;
  const list = alternates.length > 0 ? alternates : pool;
  return list[Math.floor(rng() * list.length)] ?? null;
}

function placeHit(
  pattern: boolean[][],
  lane: number,
  col: number,
  totalSteps: number,
): boolean {
  if (lane < 0 || lane > 15 || col < 0 || col >= totalSteps) return false;
  if (pattern[lane]![col]) return false;
  pattern[lane]![col] = true;
  return true;
}

/**
 * Write sparse chord-progression lows onto the tone grid.
 * One pocket per bar (2–3 hits), pitch follows the progression root active on that bar.
 */
export function se2Lab808GenerateSparseLowsPattern(args: {
  roots: readonly Lab808ProgressionRoot[];
  loopBars: Se2Lab808ToneGridLoopBars;
  genre: Se2Lab808SparseLowsGenre | string;
  seed?: number;
  tonePadBaseMidi?: number;
}): Se2Lab808GenerateRootGridResult {
  const genre = se2NormalizeLab808SparseLowsGenre(
    typeof args.genre === 'string' ? args.genre : undefined,
  );
  const roots = args.roots;
  if (roots.length === 0) {
    return {
      pattern: emptySe2Lab808ToneGridPattern(args.loopBars),
      tonePadBaseMidi: args.tonePadBaseMidi ?? lab808DefaultTonePadBaseMidi(),
      hitCount: 0,
      status: 'No roots — lock a chord progression (or key) first',
    };
  }

  const pool = se2Lab808SparseLowsTemplates(genre);
  const baseMidi = se2Lab808BaseMidiForRoots(roots);
  const totalSteps = se2Lab808ToneGridStepCount(args.loopBars);
  const pattern = emptySe2Lab808ToneGridPattern(args.loopBars);
  const bars = Math.max(1, Math.round(args.loopBars));
  const loopBeats = bars * LAB808_BEATS_PER_BAR;
  const rng = mulberry32((args.seed ?? Date.now()) >>> 0);
  let hitCount = 0;
  let lastTplId: string | null = null;
  const usedNames: string[] = [];

  for (let bar = 0; bar < bars; bar += 1) {
    const barBeat = bar * LAB808_BEATS_PER_BAR;
    const rootIdx =
      lab808ActiveRootIndexAtBeat(roots, barBeat + 0.01, loopBeats)
      ?? lab808ActiveRootIndexAtBeat(roots, barBeat, loopBeats)
      ?? 0;
    const root = roots[rootIdx] ?? roots[0]!;
    const lane = se2Lab808LaneForRootMidi(baseMidi, root.midi);
    if (lane == null) continue;

    const tpl = pickTemplate(pool, rng, lastTplId);
    if (!tpl) continue;
    lastTplId = tpl.id;
    if (usedNames.length < 3) usedNames.push(tpl.name);

    const barStartCol = bar * SE2_LAB808_TONE_GRID_STEPS_PER_BAR;
    // Hard cap: never more than 3 hits in a bar.
    const steps = tpl.steps.slice(0, 3);
    for (const step of steps) {
      const col = barStartCol + step;
      if (placeHit(pattern, lane, col, totalSteps)) hitCount += 1;
    }
  }

  const sample = usedNames.length > 0 ? usedNames.join(' · ') : 'sparse';
  return {
    pattern,
    tonePadBaseMidi: baseMidi,
    hitCount,
    status: `${hitCount} · ${bars}b ${GENRE_LABEL[genre]} · chord roots · ${sample}`,
  };
}

export type { Se2Lab808SparseLowsGenre };
