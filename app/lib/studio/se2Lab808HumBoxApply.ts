/**
 * 808 Lab Hum Box — hummed bassline → tone-grid steps (key-locked, octave-folded).
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
import { enforceMonophonicHumNotes } from '@/app/lib/vocalLab/neuralHumKeyLock';
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
} {
  const loopBars = se2Lab808NormalizeToneGridLoopBars(args.voice.toneGridLoopBars);
  const totalSteps = se2Lab808ToneGridStepCount(loopBars);
  const baseMidi = Math.round(args.voice.tonePadBaseMidi);
  const stepSec = se2Lab808ToneGridStepDurationSec(args.bpm);
  const mode = args.mode ?? 'replace';

  const pattern =
    mode === 'merge'
      ? normalizeSe2Lab808ToneGridPattern(args.voice.toneGridSteps, loopBars).map((row) => [...row])
      : emptySe2Lab808ToneGridPattern(loopBars);

  const mono = enforceMonophonicHumNotes(args.notes);
  const quantized = quantizeTimedMonophonicNotes(mono, args.bpm, '1/16');

  let hitCount = 0;
  let skipped = 0;
  /** One note per column (later note wins — monophonic bass). */
  const colLane = new Map<number, number>();

  for (const n of quantized) {
    const col = Math.round(n.startSec / Math.max(0.001, stepSec));
    if (col < 0 || col >= totalSteps) {
      skipped += 1;
      continue;
    }
    const inKey = se2Lab808SnapMidiToKeyScale(n.pitch, args.keyRoot, args.keyMode);
    const folded = se2Lab808FoldMidiIntoToneWindow(inKey, baseMidi);
    const snapped = se2Lab808SnapMidiToKeyScale(folded, args.keyRoot, args.keyMode);
    let lane = se2Lab808LaneForRootMidi(baseMidi, snapped);
    if (lane == null) {
      let probe = Math.round(snapped) - baseMidi;
      while (probe > 15) probe -= 12;
      while (probe < 0) probe += 12;
      lane = Math.max(0, Math.min(15, probe));
      const padMidi = baseMidi + lane;
      const padSnap = se2Lab808SnapMidiToKeyScale(padMidi, args.keyRoot, args.keyMode);
      lane = se2Lab808LaneForRootMidi(baseMidi, padSnap) ?? lane;
    }
    if (lane == null || lane < 0 || lane > 15) {
      skipped += 1;
      continue;
    }
    colLane.set(col, lane);
  }

  for (const [col, lane] of colLane) {
    if (!pattern[lane]) continue;
    if (!pattern[lane]![col]) {
      pattern[lane]![col] = true;
      hitCount += 1;
    } else if (mode === 'merge') {
      /* already on */
    } else {
      pattern[lane]![col] = true;
      hitCount += 1;
    }
  }

  return {
    pattern,
    hitCount,
    skipped,
    tonePadBaseMidi: baseMidi,
  };
}
