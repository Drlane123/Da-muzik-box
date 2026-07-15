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
 * so a hummed half-note / whole-note keeps its full length.
 */
export function se2Lab808PrepareHumNotesForGrid(
  notes: readonly TimedMonophonicNote[],
  bpm: number,
): TimedMonophonicNote[] {
  // Wider merge than default — held 808s wobble in pitch detect and fragment.
  const cleaned = cleanNeuralHumMelodyNotes(notes, 0.04, 0.22);
  const mono = enforceMonophonicHumNotes(cleaned, 0.04);
  return quantizeTimedMonophonicNotes(mono, bpm, '1/16');
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
