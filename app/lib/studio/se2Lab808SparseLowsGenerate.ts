/**
 * SE2 / Beat Pads 808 Lab — sparse dark R&B / Trap lows.
 * 2–3 hits/bar with melodic motion, always snapped to song key
 * (except bare chord-root anchors when a progression is locked).
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
  se2Lab808ScalePitchClasses,
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

/** Low C-ish center for freelance 808 melodies (fits kick / bass low pads). */
const FREELANCE_BASE_MIDI = 36;

/**
 * Freelance bar roots as scale-degree indices (0–6 into major/minor scale PCs).
 * Always diatonic — never chromatic out-of-key jumps.
 */
const FREELANCE_SCALE_DEGREE_PROGS: readonly (readonly number[])[] = [
  [0, 3, 4, 0], // I–IV–V–I / i–iv–v–i
  [0, 5, 3, 4], // I–vi–IV–V / i–bVI–iv–v
  [0, 4, 5, 3], // I–V–vi–IV / i–v–bVI–iv
  [0, 2, 3, 4], // I–iii–IV–V / i–bIII–iv–v
  [0, 3, 5, 4], // I–IV–vi–V / i–iv–bVI–v
  [0, 5, 4, 0], // I–vi–V–I / i–bVI–v–i
  [0, 4, 3, 5], // I–V–IV–vi
  [0, 1, 3, 4], // I–ii–IV–V / i–ii–iv–v
];

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

/** Snap any MIDI note to the nearest pitch class in the key scale (same octave preference). */
export function se2Lab808SnapMidiToKeyScale(
  midi: number,
  keyRoot: number,
  keyMode: 'major' | 'minor',
): number {
  const scale = se2Lab808ScalePitchClasses(keyRoot, keyMode);
  const m = Math.round(midi);
  const pc = ((m % 12) + 12) % 12;
  if (scale.includes(pc)) return m;

  let bestMidi = m;
  let bestDist = 99;
  for (const sp of scale) {
    let delta = sp - pc;
    if (delta > 6) delta -= 12;
    if (delta < -6) delta += 12;
    const cand = m + delta;
    const dist = Math.abs(delta);
    if (dist < bestDist || (dist === bestDist && Math.abs(cand - m) < Math.abs(bestMidi - m))) {
      bestDist = dist;
      bestMidi = cand;
    }
  }
  return bestMidi;
}

function midiFromScaleDegree(
  keyRoot: number,
  keyMode: 'major' | 'minor',
  degreeIndex: number,
  baseMidi: number,
): number {
  const scale = se2Lab808ScalePitchClasses(keyRoot, keyMode);
  const deg = ((Math.round(degreeIndex) % scale.length) + scale.length) % scale.length;
  const pc = scale[deg]!;
  const basePc = ((baseMidi % 12) + 12) % 12;
  let midi = baseMidi - basePc + pc;
  if (midi > baseMidi + 6) midi -= 12;
  if (midi < baseMidi - 6) midi += 12;
  return midi;
}

function rootMidiForBar(
  roots: readonly Lab808ProgressionRoot[],
  bar: number,
  loopBeats: number,
  freelanceDegrees: readonly number[],
  keyRoot: number,
  keyMode: 'major' | 'minor',
  freelanceBaseMidi: number,
): number {
  if (roots.length > 0) {
    const barBeat = bar * LAB808_BEATS_PER_BAR;
    const rootIdx =
      lab808ActiveRootIndexAtBeat(roots, barBeat + 0.01, loopBeats)
      ?? lab808ActiveRootIndexAtBeat(roots, barBeat, loopBeats)
      ?? 0;
    // Chord root is authoritative; still snap in case a foreign chord slipped in.
    return se2Lab808SnapMidiToKeyScale(
      roots[rootIdx]?.midi ?? roots[0]!.midi,
      keyRoot,
      keyMode,
    );
  }
  const deg = freelanceDegrees[bar % freelanceDegrees.length] ?? 0;
  return midiFromScaleDegree(keyRoot, keyMode, deg, freelanceBaseMidi);
}

/**
 * Write sparse dark lows onto the tone grid — every hit stays in key.
 * With roots: follow progression anchors + in-key melodic contours.
 * Without roots: freelance diatonic phrase in the song key (major or minor).
 */
export function se2Lab808GenerateSparseLowsPattern(args: {
  roots: readonly Lab808ProgressionRoot[];
  loopBars: Se2Lab808ToneGridLoopBars;
  genre: Se2Lab808SparseLowsGenre | string;
  seed?: number;
  tonePadBaseMidi?: number;
  /** Song / lock key root (0–11). */
  keyRoot?: number;
  /** Song / lock mode — freelance + interval snaps stay diatonic. */
  keyMode?: 'major' | 'minor';
}): Se2Lab808GenerateRootGridResult {
  const genre = se2NormalizeLab808SparseLowsGenre(
    typeof args.genre === 'string' ? args.genre : undefined,
  );
  const roots = args.roots;
  const freelance = roots.length === 0;
  const keyRoot = ((Math.round(args.keyRoot ?? 0) % 12) + 12) % 12;
  const keyMode: 'major' | 'minor' = args.keyMode === 'minor' ? 'minor' : 'major';
  const pool = se2Lab808SparseLowsTemplates(genre);
  const rng = mulberry32((args.seed ?? Date.now()) >>> 0);

  const freelanceProg =
    FREELANCE_SCALE_DEGREE_PROGS[Math.floor(rng() * FREELANCE_SCALE_DEGREE_PROGS.length)]!;

  const baseMidi = freelance
    ? (args.tonePadBaseMidi ?? FREELANCE_BASE_MIDI)
    : se2Lab808BaseMidiForRoots(roots);
  // Align freelance base so the key tonic sits on a pad when possible.
  const alignedBase = freelance
    ? midiFromScaleDegree(keyRoot, keyMode, 0, baseMidi)
    : baseMidi;

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
      keyRoot,
      keyMode,
      FREELANCE_BASE_MIDI,
    );
    const rootLane = se2Lab808LaneForRootMidi(alignedBase, rootMidi);
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
      // Contour interval from root, then force into key (G major stays G major, etc.).
      const rawMidi = rootMidi + h.interval;
      const inKeyMidi = se2Lab808SnapMidiToKeyScale(rawMidi, keyRoot, keyMode);
      let lane = se2Lab808LaneForRootMidi(alignedBase, inKeyMidi);
      if (lane == null) {
        // Fall back: nearest in-key pad relative to root lane.
        let probe = rootLane + (inKeyMidi - rootMidi);
        while (probe > 15) probe -= 12;
        while (probe < 0) probe += 12;
        lane = Math.max(0, Math.min(15, probe));
        const padMidi = alignedBase + lane;
        const snapped = se2Lab808SnapMidiToKeyScale(padMidi, keyRoot, keyMode);
        lane = se2Lab808LaneForRootMidi(alignedBase, snapped) ?? lane;
      }
      if (lane != null && placeHit(pattern, lane, col, totalSteps)) hitCount += 1;
    }
  }

  const sample = usedNames.length > 0 ? usedNames.join(' · ') : 'sparse';
  const mode = freelance ? `freelance ${keyMode}` : `chord roots · ${keyMode}`;
  return {
    pattern,
    tonePadBaseMidi: alignedBase || lab808DefaultTonePadBaseMidi(),
    hitCount,
    status: `${hitCount} · ${bars}b ${GENRE_LABEL[genre]} · ${mode} · in key · ${sample}`,
  };
}

export type { Se2Lab808SparseLowsGenre };
