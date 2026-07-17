/**
 * Beat Pads grid performance record — timing, quantize, merge, input maps.
 * (Pad/MIDI/QWERTY → sequencer steps; not VocalBox mic capture.)
 */

import {
  BEAT_PADS_LANE_COUNT,
  beatPadsPatternCols,
  type BeatPadsDrumPattern,
  type BeatPadsGridStepsPerBar,
} from '@/app/lib/creationStation/beatLabDrumMachineSequencer';
import { beatPadsAddNote } from '@/app/lib/creationStation/beatPadsPatternEdit';
import { BEAT_PADS_LANE_GM_PITCH } from '@/app/lib/creationStation/beatPadsStudioExport';

/** Record length = current loop (4 / 8 / 16 bars). */
export function beatPadsGridRecordWindowSec(
  bpm: number,
  loopBars: number,
  beatsPerBar = 4,
): number {
  const b = Math.max(40, Math.min(240, bpm));
  const bars = Math.max(1, Math.round(loopBars));
  const bpb = Math.max(1, Math.round(beatsPerBar));
  return (bars * bpb * 60) / b;
}

export function beatPadsGridRecordBarSec(bpm: number, beatsPerBar = 4): number {
  const b = Math.max(40, Math.min(240, bpm));
  const bpb = Math.max(1, Math.round(beatsPerBar));
  return (bpb * 60) / b;
}

/** Audio clock → nearest grid column within the take. */
export function beatPadsGridRecordAudioTimeToCol(
  audioNow: number,
  recordAnchor: number,
  bpm: number,
  stepsPerBar: BeatPadsGridStepsPerBar,
  totalCols: number,
): number {
  const b = Math.max(40, Math.min(240, bpm));
  const stepSec = 60 / b / (stepsPerBar / 4);
  if (stepSec <= 0 || totalCols <= 0) return 0;
  const elapsed = Math.max(0, audioNow - recordAnchor);
  const raw = Math.round(elapsed / stepSec);
  return Math.max(0, Math.min(totalCols - 1, raw));
}

/** Overdub: place a 1-step hit if that column is empty on the lane. */
export function beatPadsGridRecordMergeHit(
  pattern: BeatPadsDrumPattern,
  lane: number,
  col: number,
  loopBars: number,
  stepsPerBar: BeatPadsGridStepsPerBar,
): BeatPadsDrumPattern {
  if (lane < 0 || lane >= BEAT_PADS_LANE_COUNT) return pattern;
  const cols = beatPadsPatternCols(loopBars, stepsPerBar);
  const c = Math.max(0, Math.min(cols - 1, Math.round(col)));
  return beatPadsAddNote(pattern, lane, c, 1, cols);
}

/** Deep clone for one-shot undo of a record take. */
export function beatPadsGridRecordClonePattern(pattern: BeatPadsDrumPattern): BeatPadsDrumPattern {
  return pattern.map((lane) => lane.map((n) => ({ ...n })));
}

/**
 * Computer keyboard → pad index (4×4, left hand / num-row style).
 * 1 2 3 4 / Q W E R / A S D F / Z X C V
 */
export const BEAT_PADS_GRID_RECORD_KEY_TO_PAD: Readonly<Record<string, number>> = {
  Digit1: 0,
  Digit2: 1,
  Digit3: 2,
  Digit4: 3,
  KeyQ: 4,
  KeyW: 5,
  KeyE: 6,
  KeyR: 7,
  KeyA: 8,
  KeyS: 9,
  KeyD: 10,
  KeyF: 11,
  KeyZ: 12,
  KeyX: 13,
  KeyC: 14,
  KeyV: 15,
};

export function beatPadsGridRecordPadForKeyboardCode(code: string): number | null {
  const pad = BEAT_PADS_GRID_RECORD_KEY_TO_PAD[code];
  return pad == null ? null : pad;
}

/** GM / Beat Pads pitch → lane (same table SE2 uses). */
export function beatPadsGridRecordPadForMidiPitch(pitch: number): number | null {
  const p = Math.round(pitch);
  const exact = BEAT_PADS_LANE_GM_PITCH.indexOf(p);
  if (exact >= 0) return exact;
  // Chromatic fallthrough from C1 (36) across 16 pads.
  if (p >= 36 && p < 36 + BEAT_PADS_LANE_COUNT) return p - 36;
  return null;
}
