/**
 * 808 Lab Hum Box — hummed bassline → tone-grid steps (key-locked, octave-folded).
 * Held notes paint every 16th they cover so a whole-bar hum stays one sustained run.
 */
import type { TimedMonophonicNote } from '@/app/lib/studio/audioToMidiNotes';
import {
  emptySe2Lab808ToneGridPattern,
  normalizeSe2Lab808ToneGridPattern,
  se2Lab808NormalizeToneGridLoopBars,
  se2Lab808ToneGridStepCount,
  se2Lab808ToneGridStepDurationSec,
  type Se2Lab808ToneGridPattern,
} from '@/app/lib/studio/se2Lab808DrumPattern';
import { se2Lab808LaneForRootMidi } from '@/app/lib/studio/se2Lab808RootGridGenerate';
import { se2Lab808SnapMidiToKeyScale } from '@/app/lib/studio/se2Lab808SparseLowsGenerate';
import type { Se2Lab808VoiceParams } from '@/app/lib/studio/se2Lab808Types';
import {
  cleanNeuralHumMelodyNotes,
  enforceMonophonicHumNotes,
} from '@/app/lib/vocalLab/neuralHumKeyLock';
import { quantizeTimedMonophonicNotes } from '@/app/lib/vocalLab/neuralHumMelodyRoll';

/** Semitone band that keeps a held hum on the previous locked degree. */
const HUM_KEY_HYSTERESIS_ST = 1.75;

/** Bridge nearby-pitch fragments so held bass doesn't pop between scale neighbors. */
function stickyMergeHumBassNotes(
  notes: readonly TimedMonophonicNote[],
  maxGapSec = 0.55,
  maxPitchDelta = 2.6,
): TimedMonophonicNote[] {
  if (notes.length === 0) return [];
  const sorted = [...notes].sort((a, b) => a.startSec - b.startSec || a.pitch - b.pitch);
  const out: TimedMonophonicNote[] = [];
  let cur: TimedMonophonicNote | null = null;

  for (const n of sorted) {
    if (!cur) {
      cur = { ...n };
      continue;
    }
    const curEnd = cur.startSec + cur.durationSec;
    const gap = n.startSec - curEnd;
    const pitchClose = Math.abs(n.pitch - cur.pitch) <= maxPitchDelta;
    if (pitchClose && gap >= -0.04 && gap <= maxGapSec) {
      const end = Math.max(curEnd, n.startSec + n.durationSec);
      // Longer fragment wins — weighted average can round into the wrong degree.
      if (n.durationSec > cur.durationSec) {
        cur.pitch = Math.round(n.pitch);
      }
      cur.durationSec = end - cur.startSec;
      cur.velocity = Math.max(cur.velocity, n.velocity);
      continue;
    }
    out.push(cur);
    cur = { ...n };
  }
  if (cur) out.push(cur);
  return out;
}

/** Nearest MIDI with the locked pitch-class (prefer same octave as `around`). */
function nearestMidiWithPitchClass(around: number, pitchClass: number): number {
  const pc = ((Math.round(pitchClass) % 12) + 12) % 12;
  const center = Math.round(around);
  let best = center;
  let bestDist = Infinity;
  const baseOct = Math.floor(center / 12);
  for (let oct = baseOct - 1; oct <= baseOct + 1; oct += 1) {
    const cand = oct * 12 + pc;
    if (cand < 0 || cand > 127) continue;
    const dist = Math.abs(cand - around);
    if (dist < bestDist) {
      bestDist = dist;
      best = cand;
    }
  }
  return best;
}

/**
 * Hysteresis scale lock — once a degree is grabbed, stay there until pitch
 * clearly commits past the midpoint + margin toward another scale tone.
 */
export function stickySnapHumNotesToKeyScale(
  notes: readonly TimedMonophonicNote[],
  keyRoot: number,
  keyMode: 'major' | 'minor',
  hysteresisSt = HUM_KEY_HYSTERESIS_ST,
): TimedMonophonicNote[] {
  if (notes.length === 0) return [];
  const sorted = [...notes].sort((a, b) => a.startSec - b.startSec || a.pitch - b.pitch);
  const out: TimedMonophonicNote[] = [];
  let lockedMidi: number | null = null;

  for (const n of sorted) {
    const raw = n.pitch;
    const nearest = se2Lab808SnapMidiToKeyScale(raw, keyRoot, keyMode);

    if (lockedMidi == null) {
      lockedMidi = nearest;
      out.push({ ...n, pitch: lockedMidi });
      continue;
    }

    const stickCandidate = nearestMidiWithPitchClass(raw, lockedMidi);
    const distToLocked = Math.abs(raw - stickCandidate);
    if (distToLocked <= hysteresisSt) {
      out.push({ ...n, pitch: stickCandidate });
      lockedMidi = stickCandidate;
      continue;
    }

    // Commit only when the new scale tone is clearly closer than staying put.
    const distToNearest = Math.abs(raw - nearest);
    if (distToNearest + 0.35 < distToLocked) {
      lockedMidi = nearest;
      out.push({ ...n, pitch: lockedMidi });
      continue;
    }

    out.push({ ...n, pitch: stickCandidate });
    lockedMidi = stickCandidate;
  }

  return out;
}

export type Se2Lab808HumBoxApplyMode = 'replace' | 'merge';

/** Fold MIDI into the 16-pad chromatic window by octaves. */
export function se2Lab808FoldMidiIntoToneWindow(midi: number, baseMidi: number): number {
  const base = Math.round(baseMidi);
  let m = Math.round(midi);
  while (m < base) m += 12;
  while (m > base + 15) m -= 12;
  if (m < base) m = base;
  if (m > base + 15) m = base + 15;
  return m;
}

function resolveHumLane(
  pitch: number,
  baseMidi: number,
  keyRoot: number,
  keyMode: 'major' | 'minor',
): number | null {
  // Notes are already hysteresis-locked; fold first, snap only if fold left us off-key.
  const folded = se2Lab808FoldMidiIntoToneWindow(pitch, baseMidi);
  const snapped = se2Lab808SnapMidiToKeyScale(folded, keyRoot, keyMode);
  // Prefer folded pitch when already in key (avoids pad-edge nearest-neighbor flip).
  const target =
    snapped === folded ? folded : se2Lab808FoldMidiIntoToneWindow(snapped, baseMidi);
  let lane = se2Lab808LaneForRootMidi(baseMidi, target);
  if (lane == null) {
    let probe = Math.round(target) - baseMidi;
    while (probe > 15) probe -= 12;
    while (probe < 0) probe += 12;
    lane = Math.max(0, Math.min(15, probe));
    const padMidi = baseMidi + lane;
    const padSnap = se2Lab808SnapMidiToKeyScale(padMidi, keyRoot, keyMode);
    lane = se2Lab808LaneForRootMidi(baseMidi, padSnap) ?? lane;
  }
  if (lane == null || lane < 0 || lane > 15) return null;
  return lane;
}

/**
 * Glue pitch-tracker fragments of the same bass pitch, hysteresis-lock to key,
 * then quantize starts/ends so a hummed half-note / whole-note keeps its full length.
 */
export function se2Lab808PrepareHumNotesForGrid(
  notes: readonly TimedMonophonicNote[],
  bpm: number,
  keyRoot = 0,
  keyMode: 'major' | 'minor' = 'major',
): TimedMonophonicNote[] {
  // Aggressive sticky merge — brief pitch dropouts / vibrato must not chop a held hum.
  const cleaned = cleanNeuralHumMelodyNotes(notes, 0.03, 0.38);
  const sticky = stickyMergeHumBassNotes(cleaned, 0.55, 2.6);
  const mono = enforceMonophonicHumNotes(sticky, 0.03);
  const locked = stickySnapHumNotesToKeyScale(mono, keyRoot, keyMode);
  const quantized = quantizeTimedMonophonicNotes(locked, bpm, '1/16');
  // Second sticky pass after quantize — closes 16th-grid gaps from tracker flicker.
  return stickyMergeHumBassNotes(quantized, 0.4, 2.2);
}

export function se2Lab808ApplyHumNotesToToneGrid(args: {
  notes: readonly TimedMonophonicNote[];
  bpm: number;
  voice: Se2Lab808VoiceParams;
  keyRoot: number;
  keyMode: 'major' | 'minor';
  mode?: Se2Lab808HumBoxApplyMode;
}): {
  pattern: Se2Lab808ToneGridPattern;
  hitCount: number;
  skipped: number;
  tonePadBaseMidi: number;
  noteCount: number;
} {
  const loopBars = se2Lab808NormalizeToneGridLoopBars(args.voice.toneGridLoopBars);
  const totalSteps = se2Lab808ToneGridStepCount(loopBars);
  const baseMidi = Math.round(args.voice.tonePadBaseMidi);
  const stepSec = Math.max(0.001, se2Lab808ToneGridStepDurationSec(args.bpm));
  const mode = args.mode ?? 'replace';

  const pattern =
    mode === 'merge'
      ? normalizeSe2Lab808ToneGridPattern(args.voice.toneGridSteps, loopBars).map((row) => [...row])
      : emptySe2Lab808ToneGridPattern(loopBars);

  const quantized = se2Lab808PrepareHumNotesForGrid(
    args.notes,
    args.bpm,
    args.keyRoot,
    args.keyMode,
  );

  let hitCount = 0;
  let skipped = 0;
  /** Later notes win overlapping columns (monophonic bass). */
  const colLane = new Map<number, number>();

  for (const n of quantized) {
    const startCol = Math.round(n.startSec / stepSec);
    const endCol = Math.max(
      startCol + 1,
      Math.round((n.startSec + Math.max(stepSec, n.durationSec)) / stepSec),
    );
    if (startCol >= totalSteps || endCol <= 0) {
      skipped += 1;
      continue;
    }
    const lane = resolveHumLane(n.pitch, baseMidi, args.keyRoot, args.keyMode);
    if (lane == null) {
      skipped += 1;
      continue;
    }
    const from = Math.max(0, startCol);
    const to = Math.min(totalSteps, endCol);
    if (from >= to) {
      skipped += 1;
      continue;
    }
    for (let col = from; col < to; col += 1) {
      colLane.set(col, lane);
    }
  }

  for (const [col, lane] of colLane) {
    if (!pattern[lane]) continue;
    if (!pattern[lane]![col]) hitCount += 1;
    pattern[lane]![col] = true;
  }

  return {
    pattern,
    hitCount,
    skipped,
    tonePadBaseMidi: baseMidi,
    noteCount: quantized.length,
  };
}
