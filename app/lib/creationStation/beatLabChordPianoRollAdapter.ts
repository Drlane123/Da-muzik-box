/**
 * Beat Lab SYNTH ↔ Chord Builder piano roll (quarter-note columns).
 */
import type { BeatLabMidiNote } from '@/app/lib/creationStation/beatLabMidiRoll';
import { beatLabNoteMidi } from '@/app/lib/creationStation/beatLabMelodicSynth';
import {
  chordBuilderRollToBeatLabRoll,
  type BeatLabImportedChordRail,
  type ChordBuilderBlockSpan,
  type ChordBuilderRollEdits,
} from '@/app/lib/creationStation/chordBuilderBeatLabImport';
import { chordRollRowForMidi } from '@/app/lib/creationStation/chordBuilderPianoRollTheme';
import type { ChordEventOut } from '@/app/lib/creationStation/chordBuilder';
import { parseChordSymbolToken } from '@/app/lib/creationStation/chordProgressionParse';
import {
  GROOVE_LAB_CHORD_ROLL_MIDI_MIN,
  grooveLabClampBassRootMidi,
  grooveLabLiftChordsAboveBass,
} from '@/app/lib/creationStation/grooveLabPitch';

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

/** Quarter-column chord blocks — one span per chord column; never merge across gaps. */
export function chordBlockSpansFromBeatLabLaneNotes(
  notes: ReadonlyArray<BeatLabMidiNote>,
  lane: number,
  subdiv: number,
  beatsPerBar = 4,
  colsPerBar = 4,
): ChordBuilderBlockSpan[] {
  const spq = beatLabStepsPerQuarter(subdiv, beatsPerBar, colsPerBar);
  const endByHeadQ = new Map<number, number>();

  for (const n of notes) {
    if (n.lane !== lane) continue;
    const headQ = Math.max(0, Math.floor(n.col / spq));
    const endQ = Math.max(headQ + 1, Math.ceil((n.col + Math.max(1, n.len)) / spq));
    endByHeadQ.set(headQ, Math.max(endByHeadQ.get(headQ) ?? headQ + 1, endQ));
  }

  const heads = [...endByHeadQ.keys()].sort((a, b) => a - b);
  const spans: ChordBuilderBlockSpan[] = [];
  const cpb = Math.max(1, Math.round(colsPerBar));
  for (const headQ of heads) {
    const barIdx = Math.floor(headQ / cpb);
    spans.push({ startCol: headQ, endCol: (barIdx + 1) * cpb });
  }
  return spans;
}

/** Chord-rail bar headers → roll cells when the harmony lane has no (visible) notes yet. */
export function beatLabChordRailToPreviewEvents(
  rail: BeatLabImportedChordRail,
  totalQuarterCols: number,
  colsPerBar = 4,
): ChordEventOut[] {
  const cpb = Math.max(1, Math.round(colsPerBar));
  const events: ChordEventOut[] = [];
  for (let bar = 0; bar < rail.timeline.length; bar += 1) {
    const sym = rail.timeline[bar]?.chord;
    if (sym == null || String(sym).trim() === '') continue;
    const parsed = parseChordSymbolToken(String(sym).trim());
    if (!parsed) continue;
    const qCol = bar * cpb;
    if (qCol >= totalQuarterCols) continue;
    const bassRef = grooveLabClampBassRootMidi(Math.min(...parsed.notes));
    const voicing = grooveLabLiftChordsAboveBass(bassRef, parsed.notes).filter(
      (m) => m >= GROOVE_LAB_CHORD_ROLL_MIDI_MIN,
    );
    for (const midi of voicing) {
      if (chordRollRowForMidi(midi) < 0) continue;
      events.push({ midi, col: qCol });
    }
  }
  return events;
}

export function beatLabLaneNotesToChordRollModel(
  notes: ReadonlyArray<BeatLabMidiNote>,
  lane: number,
  subdiv: number,
  totalQuarterCols: number,
  beatsPerBar = 4,
  colsPerBar = 4,
  blockSpans: ReadonlyArray<ChordBuilderBlockSpan> = [],
): { previewEvents: ChordEventOut[]; edits: ChordBuilderRollEdits } {
  const spq = beatLabStepsPerQuarter(subdiv, beatsPerBar, colsPerBar);
  const laneNotes = notes.filter((n) => n.lane === lane);

  const previewEvents: ChordEventOut[] = [];
  const lengths = new Map<string, number>();

  const removed = new Set<string>();
  for (const n of laneNotes) {
    const midi = beatLabNoteMidi(lane, n);
    const row = rowForMidi(midi);
    if (row < 0) continue;
    const qCol = Math.max(0, Math.floor(n.col / spq));
    if (qCol >= totalQuarterCols) continue;
    const barIdx = Math.floor(qCol / colsPerBar);
    const barEndQ = Math.min(totalQuarterCols, (barIdx + 1) * colsPerBar);
    let qEnd = Math.max(qCol + 1, Math.ceil((n.col + Math.max(1, n.len)) / spq));
    const block = blockSpans.find((s) => qCol >= s.startCol && qCol < s.endCol);
    if (block) qEnd = Math.max(qEnd, block.endCol);
    qEnd = Math.min(qEnd, barEndQ);
    const qLen = Math.max(1, qEnd - qCol);
    const key = `${row},${qCol}`;
    const prevLen = lengths.get(key);
    if (prevLen == null || qLen > prevLen) lengths.set(key, qLen);
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
