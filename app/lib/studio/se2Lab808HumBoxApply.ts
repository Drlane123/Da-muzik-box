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

/** Bridge same-pitch (or ±1 semitone wobble) fragments so held bass doesn't pop. */
function stickyMergeHumBassNotes(
  notes: readonly TimedMonophonicNote[],
  maxGapSec = 0.42,
  maxPitchDelta = 1.35,
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
      const wCur = cur.durationSec;
      const wNext = n.durationSec;
      cur.pitch = Math.round((cur.pitch * wCur + n.pitch * wNext) / Math.max(0.001, wCur + wNext));
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
  const inKey = se2Lab808SnapMidiToKeyScale(pitch, keyRoot, keyMode);
  const folded = se2Lab808FoldMidiIntoToneWindow(inKey, baseMidi);
  const snapped = se2Lab808SnapMidiToKeyScale(folded, keyRoot, keyMode);
  let lane = se2Lab808LaneForRootMidi(baseMidi, snapped);
  if (lane == null) {
    let probe = Math.round(snapped) - baseMidi;
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
 * Glue pitch-tracker fragments of the same bass pitch, then quantize starts/ends
 * so a hummed half-note / whole-note keeps its full length without popping out.
 */
export function se2Lab808PrepareHumNotesForGrid(
  notes: readonly TimedMonophonicNote[],
  bpm: number,
): TimedMonophonicNote[] {
  // Aggressive sticky merge — brief pitch dropouts / vibrato must not chop a held hum.
  const cleaned = cleanNeuralHumMelodyNotes(notes, 0.03, 0.38);
  const sticky = stickyMergeHumBassNotes(cleaned, 0.42, 1.35);
  const mono = enforceMonophonicHumNotes(sticky, 0.03);
  const quantized = quantizeTimedMonophonicNotes(mono, bpm, '1/16');
  // Second sticky pass after quantize — closes 16th-grid gaps from tracker flicker.
  return stickyMergeHumBassNotes(quantized, 0.28, 1.1);
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

  const quantized = se2Lab808PrepareHumNotesForGrid(args.notes, args.bpm);

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
