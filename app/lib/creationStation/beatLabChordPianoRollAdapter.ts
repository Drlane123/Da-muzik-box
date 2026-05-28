/**
 * Beat Lab SYNTH ↔ Chord Builder piano roll (quarter-note columns).
 */
import type { BeatLabMidiNote } from '@/app/lib/creationStation/beatLabMidiRoll';
import { beatLabNoteMidi } from '@/app/lib/creationStation/beatLabMelodicSynth';
import {
  chordBuilderRollToBeatLabRoll,
  type ChordBuilderBlockSpan,
  type ChordBuilderRollEdits,
} from '@/app/lib/creationStation/chordBuilderBeatLabImport';
import { chordRollRowForMidi } from '@/app/lib/creationStation/chordBuilderPianoRollTheme';
import type { ChordEventOut } from '@/app/lib/creationStation/chordBuilder';

export function beatLabStepsPerQuarter(subdiv: number, beatsPerBar = 4, colsPerBar = 4): number {
  const s = Math.max(1, Math.round(subdiv));
  const bpb = Math.max(1, Math.round(beatsPerBar));
  const cpb = Math.max(1, Math.round(colsPerBar));
  return s * (bpb / cpb);
}

/** Chord Builder / SYNTH roll quarter-column width (matches `ChordBuilderPianoRoll` cellW). */
export function beatLabSynthQuarterCellW(colsPerBar = 4): number {
  const cpb = Math.max(1, Math.round(colsPerBar));
  return Math.max(20, Math.floor(96 / cpb));
}

/**
 * WAAPI `pianoColW` for SYNTH: `colF` is step columns; the roll draws quarter columns.
 * `colF * pianoColW === (colF / stepsPerQuarter) * quarterCellW`
 */
export function beatLabSynthWapiPianoColW(
  stepSubdiv: number,
  beatsPerBar = 4,
  colsPerBar = 4,
): number {
  const spq = beatLabStepsPerQuarter(stepSubdiv, beatsPerBar, colsPerBar);
  return Math.max(1, beatLabSynthQuarterCellW(colsPerBar) / spq);
}

function rowForMidi(midi: number): number {
  return chordRollRowForMidi(midi);
}

export function beatLabStepColToQuarterCol(stepCol: number, subdiv: number, beatsPerBar = 4, colsPerBar = 4): number {
  const spq = beatLabStepsPerQuarter(subdiv, beatsPerBar, colsPerBar);
  return Math.max(0, Math.floor(stepCol / spq));
}

export function beatLabQuarterColToStepCol(quarterCol: number, subdiv: number, beatsPerBar = 4, colsPerBar = 4): number {
  const spq = beatLabStepsPerQuarter(subdiv, beatsPerBar, colsPerBar);
  return Math.round(quarterCol * spq);
}

/** Quarter-column chord blocks from stored lane notes (SYNTH sustain / default lengths). */
export function chordBlockSpansFromBeatLabLaneNotes(
  notes: ReadonlyArray<BeatLabMidiNote>,
  lane: number,
  subdiv: number,
  beatsPerBar = 4,
  colsPerBar = 4,
): ChordBuilderBlockSpan[] {
  const spq = beatLabStepsPerQuarter(subdiv, beatsPerBar, colsPerBar);
  const hitCols: number[] = [];
  let maxEndQ = 0;
  for (const n of notes) {
    if (n.lane !== lane) continue;
    const q0 = Math.max(0, Math.floor(n.col / spq));
    const q1 = Math.max(q0 + 1, Math.ceil((n.col + Math.max(1, n.len)) / spq));
    hitCols.push(q0);
    maxEndQ = Math.max(maxEndQ, q1);
  }
  if (hitCols.length === 0) return [];
  const sorted = [...new Set(hitCols)].sort((a, b) => a - b);
  const spans: ChordBuilderBlockSpan[] = [];
  let start = sorted[0]!;
  let end = start + 1;
  for (let i = 1; i < sorted.length; i += 1) {
    const q = sorted[i]!;
    if (q <= end) {
      end = Math.max(end, q + 1);
    } else {
      spans.push({ startCol: start, endCol: end });
      start = q;
      end = q + 1;
    }
  }
  spans.push({ startCol: start, endCol: Math.max(end, maxEndQ) });
  return spans;
}

export function beatLabLaneNotesToChordRollModel(
  notes: ReadonlyArray<BeatLabMidiNote>,
  lane: number,
  subdiv: number,
  totalQuarterCols: number,
  beatsPerBar = 4,
  colsPerBar = 4,
): { previewEvents: ChordEventOut[]; edits: ChordBuilderRollEdits } {
  const spq = beatLabStepsPerQuarter(subdiv, beatsPerBar, colsPerBar);
  const previewEvents: ChordEventOut[] = [];
  const lengths = new Map<string, number>();

  const removed = new Set<string>();
  for (const n of notes) {
    if (n.lane !== lane) continue;
    const midi = beatLabNoteMidi(lane, n);
    const row = rowForMidi(midi);
    if (row < 0) continue;
    const qCol = Math.max(0, Math.floor(n.col / spq));
    if (qCol >= totalQuarterCols) continue;
    const qLen = Math.max(1, Math.round(n.len / spq));
    const key = `${row},${qCol}`;
    lengths.set(key, qLen);
    previewEvents.push({ midi, col: qCol });
    if (n.muted) removed.add(key);
  }

  return {
    previewEvents,
    edits: { added: new Set(), removed, lengths },
  };
}

export function chordRollEditsToBeatLabLaneNotes(
  edits: ChordBuilderRollEdits,
  previewEvents: ReadonlyArray<ChordEventOut>,
  lane: number,
  subdiv: number,
  maxStepCol: number,
  totalQuarterCols: number,
  beatsPerBar = 4,
  colsPerBar = 4,
  blockSpans: ReadonlyArray<ChordBuilderBlockSpan> = [],
): BeatLabMidiNote[] {
  return chordBuilderRollToBeatLabRoll({
    previewEvents,
    edits,
    totalQuarterCols,
    colsPerBar,
    beatsPerBar,
    stepSubdiv: subdiv,
    patternCols: maxStepCol,
    targetLane: lane,
    blockSpans,
  });
}
