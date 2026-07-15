/**
 * SE2 / Beat Pads 808 Lab — sparse dark R&B / Trap lows.
 * 2–3 hits/bar with melodic intervals (not root-only).
 * Chord progression when roots exist; freelance dark minor when not.
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
  SE2_LAB808_FREELANCE_DARK_PROGRESSIONS,
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

/** Low C-ish center for freelance 808 melodies (fits kick / bass low pads). */
const FREELANCE_BASE_MIDI = 36;

function pickTemplate(
  pool: readonly Se2Lab808SparseLowsTemplate[],
  rng: () => number,
  recentIds: readonly string[],
): Se2Lab808SparseLowsTemplate | null {
  if (pool.length === 0) return null;
  const blocked = new Set(recentIds);
  const alternates = pool.filter((t) => !blocked.has(t.id));
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

function clampLaneNear(rootLane: number, interval: number): number {
  let lane = rootLane + interval;
  // Keep melody on the 16-pad board; prefer dropping an octave over climbing bright.
  while (lane > 15) lane -= 12;
  while (lane < 0) lane += 12;
  if (lane > 15) lane = 15;
  if (lane < 0) lane = 0;
  return lane;
}

function rootMidiForBar(
  roots: readonly Lab808ProgressionRoot[],
  bar: number,
  loopBeats: number,
  freelancePcs: readonly number[],
  freelanceKeyPc: number,
  freelanceBaseMidi: number,
): number {
  if (roots.length > 0) {
    const barBeat = bar * LAB808_BEATS_PER_BAR;
    const rootIdx =
      lab808ActiveRootIndexAtBeat(roots, barBeat + 0.01, loopBeats)
      ?? lab808ActiveRootIndexAtBeat(roots, barBeat, loopBeats)
      ?? 0;
    return roots[rootIdx]?.midi ?? roots[0]!.midi;
  }
  const deg = freelancePcs[bar % freelancePcs.length] ?? 0;
  const pc = (freelanceKeyPc + deg) % 12;
  // Keep freelance roots in a low octave around base.
  const basePc = ((freelanceBaseMidi % 12) + 12) % 12;
  let midi = freelanceBaseMidi - basePc + pc;
  if (midi > freelanceBaseMidi + 6) midi -= 12;
  if (midi < freelanceBaseMidi - 6) midi += 12;
  return midi;
}

/**
 * Write sparse dark lows onto the tone grid.
 * With roots: follow progression + dark interval contours.
 * Without roots: freelance dark minor phrase (still 2–3 hits/bar).
 */
export function se2Lab808GenerateSparseLowsPattern(args: {
  roots: readonly Lab808ProgressionRoot[];
  loopBars: Se2Lab808ToneGridLoopBars;
  genre: Se2Lab808SparseLowsGenre | string;
  seed?: number;
  tonePadBaseMidi?: number;
  /** Song / lock key root (0–11) for freelance mode. */
  keyRoot?: number;
}): Se2Lab808GenerateRootGridResult {
  const genre = se2NormalizeLab808SparseLowsGenre(
    typeof args.genre === 'string' ? args.genre : undefined,
  );
  const roots = args.roots;
  const freelance = roots.length === 0;
  const pool = se2Lab808SparseLowsTemplates(genre);
  const rng = mulberry32((args.seed ?? Date.now()) >>> 0);

  const freelanceProg =
    SE2_LAB808_FREELANCE_DARK_PROGRESSIONS[
      Math.floor(rng() * SE2_LAB808_FREELANCE_DARK_PROGRESSIONS.length)
    ]!;
  const freelanceKeyPc = ((Math.round(args.keyRoot ?? 0) % 12) + 12) % 12;

  const baseMidi = freelance
    ? (args.tonePadBaseMidi ?? FREELANCE_BASE_MIDI)
    : se2Lab808BaseMidiForRoots(roots);
  const totalSteps = se2Lab808ToneGridStepCount(args.loopBars);
  const pattern = emptySe2Lab808ToneGridPattern(args.loopBars);
  const bars = Math.max(1, Math.round(args.loopBars));
  const loopBeats = bars * LAB808_BEATS_PER_BAR;
  let hitCount = 0;
  const recentIds: string[] = [];
  const usedNames: string[] = [];

  for (let bar = 0; bar < bars; bar += 1) {
    const rootMidi = rootMidiForBar(
      roots,
      bar,
      loopBeats,
      freelanceProg,
      freelanceKeyPc,
      FREELANCE_BASE_MIDI,
    );
    const rootLane = se2Lab808LaneForRootMidi(baseMidi, rootMidi);
    if (rootLane == null) continue;

    const tpl = pickTemplate(pool, rng, recentIds);
    if (!tpl) continue;
    recentIds.push(tpl.id);
    if (recentIds.length > 3) recentIds.shift();
    if (usedNames.length < 4) usedNames.push(tpl.name);

    const barStartCol = bar * SE2_LAB808_TONE_GRID_STEPS_PER_BAR;
    const hits = tpl.hits.slice(0, 3);
    for (const h of hits) {
      const col = barStartCol + h.step;
      const lane = clampLaneNear(rootLane, h.interval);
      if (placeHit(pattern, lane, col, totalSteps)) hitCount += 1;
    }
  }

  const sample = usedNames.length > 0 ? usedNames.join(' · ') : 'sparse';
  const mode = freelance ? 'freelance dark' : 'chord roots';
  return {
    pattern,
    tonePadBaseMidi: baseMidi || lab808DefaultTonePadBaseMidi(),
    hitCount,
    status: `${hitCount} · ${bars}b ${GENRE_LABEL[genre]} · ${mode} · ${sample}`,
  };
}

export type { Se2Lab808SparseLowsGenre };
