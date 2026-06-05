/**
 * Chord Builder → Beat Lab SYNTH (channels 17–32) MIDI import.
 * Uses the same preview events + roll edits as the on-screen piano roll.
 */
import {
  buildChordEvents,
  type ChordEventOut,
  type ChordMode,
  type ChordSymbol,
  type PatternDef,
} from '@/app/lib/creationStation/chordBuilder';
import { timelineToBlocks } from '@/app/lib/creationStation/chordBlocks';
import {
  CB_PIANO_ROWS,
  cbPianoNoteNameToMidi,
  chordRollRowForMidi,
} from '@/app/lib/creationStation/chordBuilderPianoRollTheme';
import { buildAutoNoteKeys } from '@/app/lib/creationStation/chordRollNoteClipboard';
import {
  BEAT_LAB_MELODIC_LANE_START,
  beatLabMelodicLanePitch,
  clampBeatLabNoteLen,
  normalizeBeatLabMidiNote,
  type BeatLabMidiNote,
} from '@/app/lib/creationStation/beatLabMidiRoll';
import type { MidiNoteEvent } from '@/app/lib/creationStation/midiExport';

export const CHORD_BUILDER_SMF_PPQ = 480;

export type BeatLabChordRailSlot = { chord: ChordSymbol | null };

const PREVIEW_BAND_LOW = (3 + 1) * 12;
const PREVIEW_BAND_HIGH = (6 + 1) * 12;
const BEATS_PER_BAR = 4;

export type ChordBuilderRollEdits = {
  added: ReadonlySet<string>;
  removed: ReadonlySet<string>;
  lengths: ReadonlyMap<string, number>;
};

/** Quarter-column span of one chord block on the Chord Builder timeline. */
export type ChordBuilderBlockSpan = {
  startCol: number;
  endCol: number;
};

/** Build block spans from progression blocks (1 beat = 1 quarter column in 4/4). */
export function chordBuilderBlockSpansFromBlocks(
  blocks: ReadonlyArray<{ durationBeats: number }>,
): ChordBuilderBlockSpan[] {
  const spans: ChordBuilderBlockSpan[] = [];
  let beat = 0;
  for (const b of blocks) {
    const dur = Math.max(1, Math.round(b.durationBeats));
    spans.push({ startCol: beat, endCol: beat + dur });
    beat += dur;
  }
  return spans;
}

/**
 * Default roll length when the user has not stretched a note: through the next
 * pattern hit in the block (strum / arpeggio), or through the chord block for
 * single-hit block / sustain voicings.
 */
export function chordBuilderDefaultNoteLengthQ(
  row: number,
  col: number,
  cellKeys: ReadonlySet<string>,
  previewCols: ReadonlyArray<number>,
  blockSpans: ReadonlyArray<ChordBuilderBlockSpan>,
  totalQuarterCols: number,
): number {
  const block = blockSpans.find((s) => col >= s.startCol && col < s.endCol);
  const windowEnd = block?.endCol ?? totalQuarterCols;
  let endCol = windowEnd;
  for (const c of previewCols) {
    if (c > col && c < windowEnd && c < endCol) endCol = c;
  }
  for (const key of cellKeys) {
    const [rowStr, colStr] = key.split(',');
    const r = parseInt(rowStr ?? '-1', 10);
    const c = parseInt(colStr ?? '-1', 10);
    if (r === row && c > col && c < endCol) endCol = c;
  }
  if (endCol >= windowEnd) {
    const blockSpan = windowEnd - col;
    if (blockSpan <= 1) return 1;
    // Hold through the chord slot; leave one quarter column before the next chord.
    return Math.max(2, Math.min(blockSpan - 1, totalQuarterCols - col));
  }
  return Math.max(1, Math.min(endCol - col, totalQuarterCols - col));
}

export function chordBuilderPreviewCols(
  previewEvents: ReadonlyArray<{ col: number }>,
): number[] {
  const set = new Set<number>();
  for (const { col } of previewEvents) {
    if (col >= 0) set.add(col);
  }
  return [...set].sort((a, b) => a - b);
}

function chordBuilderNoteLengthQ(
  key: string,
  row: number,
  col: number,
  edits: ChordBuilderRollEdits,
  cellKeys: ReadonlySet<string>,
  previewCols: ReadonlyArray<number>,
  blockSpans: ReadonlyArray<ChordBuilderBlockSpan>,
  totalQuarterCols: number,
): number {
  const manual = edits.lengths.get(key);
  if (manual != null && manual > 0) return Math.max(1, Math.round(manual));
  return chordBuilderDefaultNoteLengthQ(
    row,
    col,
    cellKeys,
    previewCols,
    blockSpans,
    totalQuarterCols,
  );
}

/** Step columns spanned by a quarter-column duration at the active SNAP subdiv. */
export function chordQuarterDurationToStepLen(
  durationQ: number,
  stepSubdiv: number,
  colsPerBar = 4,
  beatsPerBar = 4,
): number {
  const s = Math.max(1, Math.round(stepSubdiv));
  const cpb = Math.max(1, Math.round(colsPerBar));
  const bpb = Math.max(1, Math.round(beatsPerBar));
  const stepsPerQuarter = s * (bpb / cpb);
  return Math.max(1, Math.round(durationQ * stepsPerQuarter));
}

/** Beat-precise chord hits — matches Chord Builder piano-roll `previewEvents`. */
export function buildChordBuilderPreviewEvents(args: {
  timeline: ReadonlyArray<{ chord: ChordSymbol | null }>;
  keyRoot: number;
  mode: ChordMode;
  pattern: PatternDef;
  colsPerBar: number;
  bandLow?: number;
  bandHigh?: number;
  resolveMidis: (symbol: ChordSymbol, prev: ChordSymbol | null) => number[] | null;
}): ChordEventOut[] {
  const blocks = timelineToBlocks(args.timeline, BEATS_PER_BAR);
  if (blocks.length === 0) return [];
  const bandLow = args.bandLow ?? PREVIEW_BAND_LOW;
  const bandHigh = args.bandHigh ?? PREVIEW_BAND_HIGH;
  const out: ChordEventOut[] = [];
  let startCol = 0;
  let prev: ChordSymbol | null = null;
  for (const block of blocks) {
    const barsPerChord = Math.max(1, Math.round(block.durationBeats / BEATS_PER_BAR));
    out.push(
      ...buildChordEvents({
        progression: [block.chord],
        keyRoot: args.keyRoot,
        mode: args.mode,
        pattern: args.pattern,
        barsPerChord,
        startCol,
        colsPerBar: args.colsPerBar,
        bandLow,
        bandHigh,
        resolveMidis: (sym) => args.resolveMidis(sym, prev),
      }),
    );
    prev = block.chord;
    startCol += block.durationBeats;
  }
  return out;
}

/** Lit cells on the roll → SMF note list (WYSIWYG with the piano roll). */
export function buildChordBuilderMidiNotesFromPreview(args: {
  previewEvents: ReadonlyArray<{ midi: number; col: number }>;
  edits: ChordBuilderRollEdits;
  totalCols: number;
  startColOffset?: number;
  blockSpans?: ReadonlyArray<ChordBuilderBlockSpan>;
}): MidiNoteEvent[] {
  const rowForMidi = (midi: number) => chordRollRowForMidi(midi);
  const auto = buildAutoNoteKeys(args.previewEvents, args.totalCols, rowForMidi);
  const midiAt = new Map<string, number>();
  for (const { midi, col } of args.previewEvents) {
    const row = rowForMidi(midi);
    if (row >= 0 && col >= 0 && col < args.totalCols) {
      midiAt.set(`${row},${col}`, midi);
    }
  }
  const cellKeys = new Set<string>();
  for (const key of auto) {
    if (!args.edits.removed.has(key)) cellKeys.add(key);
  }
  for (const key of args.edits.added) cellKeys.add(key);

  const blockSpans = args.blockSpans ?? [];
  const previewCols = chordBuilderPreviewCols(args.previewEvents);
  const colOff = args.startColOffset ?? 0;
  const notes: MidiNoteEvent[] = [];
  for (const key of cellKeys) {
    const [rowStr, colStr] = key.split(',');
    const row = parseInt(rowStr ?? '-1', 10);
    const col = parseInt(colStr ?? '-1', 10);
    let midi = midiAt.get(key);
    if (midi == null) {
      const noteName = CB_PIANO_ROWS[row];
      if (!noteName) continue;
      midi = cbPianoNoteNameToMidi(noteName);
      if (midi <= 0) continue;
    }
    const length = chordBuilderNoteLengthQ(
      key,
      row,
      col,
      args.edits,
      cellKeys,
      previewCols,
      blockSpans,
      args.totalCols,
    );
    notes.push({
      midi,
      startTick: (colOff + col) * CHORD_BUILDER_SMF_PPQ,
      durationTicks: Math.max(1, length) * CHORD_BUILDER_SMF_PPQ,
      velocity: 100,
    });
  }
  return notes;
}

export function buildChordBuilderSongMidiNotesFromPreview(args: {
  sections: ReadonlyArray<{
    previewEvents: ReadonlyArray<{ midi: number; col: number }>;
    totalBars: number;
    edits: ChordBuilderRollEdits;
    blockSpans?: ReadonlyArray<ChordBuilderBlockSpan>;
  }>;
  colsPerBar: number;
}): MidiNoteEvent[] {
  const allNotes: MidiNoteEvent[] = [];
  let cursorCol = 0;
  for (const sec of args.sections) {
    const totalCols = sec.totalBars * args.colsPerBar;
    allNotes.push(
      ...buildChordBuilderMidiNotesFromPreview({
        previewEvents: sec.previewEvents,
        edits: sec.edits,
        totalCols,
        startColOffset: cursorCol,
        blockSpans: sec.blockSpans,
      }),
    );
    cursorCol += totalCols;
  }
  return allNotes;
}

/**
 * Map a roll MIDI pitch to lane `pitchSemi` (±24 semitones).
 * Returns null when the tone cannot fit the melodic lane window.
 */
export function melodicLanePitchSemi(lane: number, midi: number): number | null {
  const base = beatLabMelodicLanePitch(lane);
  let m = midi;
  for (let i = 0; i < 12; i++) {
    if (m < base - 24) {
      m += 12;
      continue;
    }
    if (m > base + 24) {
      m -= 12;
      continue;
    }
    const semi = Math.round(m - base);
    if (semi >= -24 && semi <= 24) return semi;
    return null;
  }
  return null;
}

/** One bar-wide sustain for downbeat stacks (Beat Lab import — no strum columns). */
function chordBuilderBarDownbeatLengthQ(
  bar: number,
  blockSpans: ReadonlyArray<ChordBuilderBlockSpan>,
  totalQuarterCols: number,
  colsPerBar: number,
): number {
  const cpb = Math.max(1, Math.round(colsPerBar));
  const headQ = bar * cpb;
  if (headQ >= totalQuarterCols) return 1;
  const block = blockSpans.find((s) => headQ >= s.startCol && headQ < s.endCol);
  const nextBarQ = Math.min(totalQuarterCols, (bar + 1) * cpb);
  const windowEnd = block?.endCol ?? nextBarQ;
  const endQ = Math.min(windowEnd, nextBarQ);
  return Math.max(1, endQ - headQ);
}

/**
 * Beat Lab import only: merge strum / arp / syncopated pattern hits into one column
 * per bar (beat 1). One pitch per piano row; no duplicate attacks on the first line.
 */
function chordBuilderCollapseLitCellsToBarDownbeats(
  cellKeys: ReadonlySet<string>,
  midiByCell: ReadonlyMap<string, number>,
  colsPerBar: number,
  totalQuarterCols: number,
  blockSpans: ReadonlyArray<ChordBuilderBlockSpan>,
  lengths: ReadonlyMap<string, number>,
): { cellKeys: Set<string>; midiByCell: Map<string, number>; lengthByKey: Map<string, number> } {
  const cpb = Math.max(1, Math.round(colsPerBar));
  const byBar = new Map<number, string[]>();

  for (const key of cellKeys) {
    const qCol = parseInt(key.split(',')[1] ?? '-1', 10);
    if (qCol < 0 || qCol >= totalQuarterCols) continue;
    const bar = Math.floor(qCol / cpb);
    if (!byBar.has(bar)) byBar.set(bar, []);
    byBar.get(bar)!.push(key);
  }

  const outKeys = new Set<string>();
  const outMidi = new Map<string, number>();
  const lengthByKey = new Map<string, number>();

  for (const [bar, keys] of byBar) {
    const headQ = bar * cpb;
    const barLenQ = chordBuilderBarDownbeatLengthQ(bar, blockSpans, totalQuarterCols, cpb);
    const rowMidi = new Map<number, number>();

    for (const key of keys) {
      const [rowStr] = key.split(',');
      const row = parseInt(rowStr ?? '-1', 10);
      if (row < 0) continue;
      let midi = midiByCell.get(key);
      if (midi == null) {
        const noteName = CB_PIANO_ROWS[row];
        if (!noteName) continue;
        midi = cbPianoNoteNameToMidi(noteName);
        if (midi <= 0) continue;
      }
      if (!rowMidi.has(row)) rowMidi.set(row, midi);
    }

    for (const [row, midi] of rowMidi) {
      const downKey = `${row},${headQ}`;
      outKeys.add(downKey);
      outMidi.set(downKey, midi);
      let lenQ = barLenQ;
      for (const key of keys) {
        const [rowStr] = key.split(',');
        if (parseInt(rowStr ?? '-1', 10) !== row) continue;
        const manual = lengths.get(key);
        if (manual != null && manual > 0) lenQ = Math.max(lenQ, Math.round(manual));
      }
      lengthByKey.set(downKey, lenQ);
    }
  }

  return { cellKeys: outKeys, midiByCell: outMidi, lengthByKey };
}

function litCellMidiMap(
  previewEvents: ReadonlyArray<{ midi: number; col: number }>,
  edits: ChordBuilderRollEdits,
  totalQuarterCols: number,
): { cellKeys: Set<string>; midiByCell: Map<string, number> } {
  const rowForMidi = (midi: number) => chordRollRowForMidi(midi);
  const auto = buildAutoNoteKeys(previewEvents, totalQuarterCols, rowForMidi);
  const midiByCell = new Map<string, number>();
  for (const { midi, col } of previewEvents) {
    const row = rowForMidi(midi);
    if (row >= 0 && col >= 0 && col < totalQuarterCols) {
      midiByCell.set(`${row},${col}`, midi);
    }
  }
  const cellKeys = new Set<string>();
  for (const key of auto) {
    if (!edits.removed.has(key)) cellKeys.add(key);
  }
  for (const key of edits.added) cellKeys.add(key);
  return { cellKeys, midiByCell };
}

/**
 * Piano-roll cells → Beat Lab SYNTH (default channel 17).
 * Every lit pitch at each hit column becomes its own note (full chord per step).
 */
export function chordBuilderRollToBeatLabRoll(args: {
  previewEvents: ReadonlyArray<{ midi: number; col: number }>;
  edits: ChordBuilderRollEdits;
  totalQuarterCols: number;
  colsPerBar: number;
  beatsPerBar: number;
  stepSubdiv: number;
  patternCols: number;
  quarterColOffset?: number;
  targetLane?: number;
  blockSpans?: ReadonlyArray<ChordBuilderBlockSpan>;
}): BeatLabMidiNote[] {
  const maxCol = Math.max(1, Math.round(args.patternCols));
  const subdiv = Math.max(1, Math.round(args.stepSubdiv));
  const colsPerBar = Math.max(1, Math.round(args.colsPerBar));
  const beatsPerBar = Math.max(1, Math.round(args.beatsPerBar));
  const lane = Math.max(
    BEAT_LAB_MELODIC_LANE_START,
    Math.min(31, Math.round(args.targetLane ?? BEAT_LAB_MELODIC_LANE_START)),
  );
  const qOff = args.quarterColOffset ?? 0;
  const blockSpans = args.blockSpans ?? [];

  const lit = litCellMidiMap(args.previewEvents, args.edits, args.totalQuarterCols);
  const collapsed = chordBuilderCollapseLitCellsToBarDownbeats(
    lit.cellKeys,
    lit.midiByCell,
    colsPerBar,
    args.totalQuarterCols,
    blockSpans,
    args.edits.lengths,
  );

  const out: BeatLabMidiNote[] = [];
  const seen = new Set<string>();

  for (const key of collapsed.cellKeys) {
    const [rowStr, colStr] = key.split(',');
    const row = parseInt(rowStr ?? '-1', 10);
    const qCol = parseInt(colStr ?? '-1', 10);
    if (qCol < 0) continue;

    let midi = collapsed.midiByCell.get(key);
    if (midi == null) {
      const noteName = CB_PIANO_ROWS[row];
      if (!noteName) continue;
      midi = cbPianoNoteNameToMidi(noteName);
      if (midi <= 0) continue;
    }

    const lengthQ =
      collapsed.lengthByKey.get(key) ??
      chordBuilderBarDownbeatLengthQ(
        Math.floor(qCol / colsPerBar),
        blockSpans,
        args.totalQuarterCols,
        colsPerBar,
      );
    const headCol = chordQuarterColToStepCol(qOff + qCol, subdiv, colsPerBar, beatsPerBar);
    const endCol = chordQuarterColToStepCol(qOff + qCol + lengthQ, subdiv, colsPerBar, beatsPerBar);
    const len = clampBeatLabNoteLen(Math.max(1, endCol - headCol), headCol, maxCol);
    if (headCol >= maxCol) continue;

    const pitchSemi = melodicLanePitchSemi(lane, midi);
    if (pitchSemi == null) continue;
    const dedupe = `${lane},${headCol},${pitchSemi}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    const n = normalizeBeatLabMidiNote({
      lane,
      col: headCol,
      len,
      vel: 100,
      pitchSemi,
    });
    if (n) out.push(n);
  }

  const stepsPerBar = beatLabStepsPerBar(subdiv, beatsPerBar, colsPerBar);
  return snapBeatLabChordNotesToBarDownbeats(out, { stepsPerBar, patternCols: maxCol });
}

export type ChordBuilderBeatLabImportSection = {
  previewEvents: ReadonlyArray<{ midi: number; col: number }>;
  edits: ChordBuilderRollEdits;
  /** Chord Builder timeline width in quarter-note columns (totalBars × colsPerBar). */
  totalQuarterCols: number;
  /** Quarter-note columns per bar — must match Chord Builder `colsPerBar` (usually 4). */
  colsPerBar: number;
  /** Chord block sustain windows (quarter columns); drives default note length on import. */
  blockSpans?: ReadonlyArray<ChordBuilderBlockSpan>;
  /**
   * Bar-wise chord symbols (same layout as Chord Builder progression `timeline`).
   * When present, Beat Lab NEW SYNTH piano roll can show chord headers and match harmonic rhythm.
   */
  chordTimeline?: ReadonlyArray<BeatLabChordRailSlot>;
  chordKeyRoot?: number;
  chordMode?: ChordMode;
};

/** Chord names + key for NEW SYNTH piano-roll bar headers (Chord Builder → Beat Lab). */
export type BeatLabImportedChordRail = {
  timeline: BeatLabChordRailSlot[];
  keyRoot: number;
  mode: ChordMode;
};

/** Lane note length for transport — full grid hold, bounded by next note on lane. */
export function beatLabLaneNoteLenCols(
  note: BeatLabMidiNote,
  colInPattern: number,
  roll: readonly BeatLabMidiNote[],
  gridCols: number,
): number {
  let nextLaneGap = Number.POSITIVE_INFINITY;
  for (const o of roll) {
    if (o.muted || o.lane !== note.lane) continue;
    if (o.col === colInPattern) continue;
    const delta = o.col > colInPattern ? o.col - colInPattern : gridCols - colInPattern + o.col;
    if (delta > 0 && delta < nextLaneGap) nextLaneGap = delta;
  }
  const colsToNext = Number.isFinite(nextLaneGap) ? Math.max(1, Math.floor(nextLaneGap)) : gridCols;
  return Math.max(1, Math.min(Math.max(1, note.len), colsToNext, gridCols - colInPattern));
}

/** Chord Builder uses quarter-note columns; Beat Lab stores step columns (snap subdiv per beat). */
export function chordQuarterColToStepCol(
  quarterCol: number,
  stepSubdiv: number,
  colsPerBar = 4,
  beatsPerBar = 4,
): number {
  const s = Math.max(1, Math.round(stepSubdiv));
  const cpb = Math.max(1, Math.round(colsPerBar));
  const bpb = Math.max(1, Math.round(beatsPerBar));
  const stepsPerQuarter = s * (bpb / cpb);
  return Math.round(quarterCol * stepsPerQuarter);
}

/** Step columns in one bar (first grid line of bar N = N × this value). */
export function beatLabStepsPerBar(
  stepSubdiv: number,
  beatsPerBar = 4,
  colsPerBar = 4,
): number {
  const cpb = Math.max(1, Math.round(colsPerBar));
  return chordQuarterColToStepCol(cpb, stepSubdiv, colsPerBar, beatsPerBar);
}

/**
 * One attack per bar on the first step column; merge strum/arp into a single stack.
 * Dedupes by pitch so the same tone cannot fire twice on one downbeat.
 */
export function snapBeatLabChordNotesToBarDownbeats(
  notes: readonly BeatLabMidiNote[],
  opts: { stepsPerBar: number; patternCols: number; preserveMultiBarLen?: boolean },
): BeatLabMidiNote[] {
  const spb = Math.max(1, Math.round(opts.stepsPerBar));
  const maxCol = Math.max(1, Math.round(opts.patternCols));
  const preserveLen = opts.preserveMultiBarLen === true;
  const byLaneBar = new Map<string, BeatLabMidiNote[]>();

  for (const n of notes) {
    const bar = Math.floor(n.col / spb);
    const groupKey = `${n.lane},${bar}`;
    if (!byLaneBar.has(groupKey)) byLaneBar.set(groupKey, []);
    byLaneBar.get(groupKey)!.push(n);
  }

  const out: BeatLabMidiNote[] = [];

  for (const group of byLaneBar.values()) {
    const bar = Math.floor(group[0]!.col / spb);
    const lane = group[0]!.lane;
    const headCol = bar * spb;
    if (headCol >= maxCol) continue;
    const barSpan = preserveLen ? maxCol - headCol : Math.min(spb, maxCol - headCol);
    const bestByPitch = new Map<number, BeatLabMidiNote>();

    for (const n of group) {
      const pitchSemi = n.pitchSemi ?? 0;
      const prev = bestByPitch.get(pitchSemi);
      if (!prev || (n.len ?? 1) > (prev.len ?? 1)) bestByPitch.set(pitchSemi, n);
    }

    for (const n of bestByPitch.values()) {
      const len = Math.max(1, Math.min(Math.max(n.len ?? 1, 1), barSpan));
      const normalized = normalizeBeatLabMidiNote({
        lane,
        col: headCol,
        len,
        vel: n.vel,
        pitchSemi: n.pitchSemi,
        muted: n.muted,
      });
      if (normalized) out.push(normalized);
    }
  }

  out.sort((a, b) => a.col - b.col || a.lane - b.lane || (a.pitchSemi ?? 0) - (b.pitchSemi ?? 0));
  return out;
}

export function beatLabPatternColsForLoop(
  loopBars: number,
  stepSubdiv: number,
  beatsPerBar = 4,
  maxStepCols = 256,
): number {
  const s = Math.max(1, Math.round(stepSubdiv));
  const bpb = Math.max(1, Math.round(beatsPerBar));
  const bars = Math.max(1, Math.round(loopBars));
  return Math.max(1, Math.min(maxStepCols, bars * bpb * s));
}

/** Bar-accurate chord strip for NEW SYNTH headers after Chord Builder → Beat Lab. */
export function beatLabChordRailFromImportSections(
  sections: ReadonlyArray<ChordBuilderBeatLabImportSection>,
): BeatLabImportedChordRail | null {
  if (sections.length === 0) return null;
  const keyRoot = sections[0]!.chordKeyRoot ?? 0;
  const mode: ChordMode = sections[0]!.chordMode ?? 'major';
  const timeline: BeatLabChordRailSlot[] = [];
  let sawChord = false;
  for (const sec of sections) {
    const ct = sec.chordTimeline;
    if (ct != null && ct.length > 0) {
      for (const slot of ct) {
        timeline.push({ chord: slot.chord });
        if (slot.chord) sawChord = true;
      }
    } else {
      const cols = Math.max(1, Math.round(sec.colsPerBar));
      const bars = Math.max(1, Math.ceil(sec.totalQuarterCols / cols));
      for (let i = 0; i < bars; i += 1) timeline.push({ chord: null });
    }
  }
  if (!sawChord) return null;
  return { timeline, keyRoot, mode };
}

export function chordBuilderSongRollToBeatLabRoll(
  sections: ReadonlyArray<ChordBuilderBeatLabImportSection>,
  opts: {
    stepSubdiv: number;
    patternCols: number;
    beatsPerBar: number;
    targetLane?: number;
  },
): BeatLabMidiNote[] {
  const out: BeatLabMidiNote[] = [];
  let qCursor = 0;
  for (const sec of sections) {
    out.push(
      ...chordBuilderRollToBeatLabRoll({
        previewEvents: sec.previewEvents,
        edits: sec.edits,
        totalQuarterCols: sec.totalQuarterCols,
        colsPerBar: sec.colsPerBar,
        beatsPerBar: opts.beatsPerBar,
        stepSubdiv: opts.stepSubdiv,
        patternCols: opts.patternCols,
        quarterColOffset: qCursor,
        targetLane: opts.targetLane,
        blockSpans: sec.blockSpans,
      }),
    );
    qCursor += sec.totalQuarterCols;
  }
  return out;
}

/** Map Chord Builder quarter-note MIDI events onto the Beat Lab step grid (SYNTH). */
export function midiEventsToBeatLabRoll(
  notes: ReadonlyArray<MidiNoteEvent>,
  opts: {
    stepSubdiv: number;
    patternCols: number;
    beatsPerBar?: number;
    colsPerBar?: number;
    ticksPerQuarter?: number;
    /** Melodic lane index (16 = MIDI channel 17). All imported notes land here. */
    targetLane?: number;
  },
): BeatLabMidiNote[] {
  const ppq = opts.ticksPerQuarter ?? CHORD_BUILDER_SMF_PPQ;
  const maxCol = Math.max(1, Math.round(opts.patternCols));
  const subdivFixed = Math.max(1, Math.round(opts.stepSubdiv));
  const beatsPerBar = Math.max(1, Math.round(opts.beatsPerBar ?? BEATS_PER_BAR));
  const colsPerBar = Math.max(1, Math.round(opts.colsPerBar ?? BEATS_PER_BAR));
  const lane = Math.max(
    BEAT_LAB_MELODIC_LANE_START,
    Math.min(31, Math.round(opts.targetLane ?? BEAT_LAB_MELODIC_LANE_START)),
  );

  const stepsPerBar = beatLabStepsPerBar(subdivFixed, beatsPerBar, colsPerBar);
  const byLaneBar = new Map<
    string,
    Map<number, { pitchSemi: number; len: number; vel: number; muted?: boolean }>
  >();

  for (const note of notes) {
    const chordCol = Math.round(note.startTick / ppq);
    const lenQ = Math.max(1, Math.round(note.durationTicks / ppq));
    const col = chordQuarterColToStepCol(chordCol, subdivFixed, colsPerBar, beatsPerBar);
    if (col >= maxCol) continue;
    const bar = Math.floor(col / stepsPerBar);
    const headCol = bar * stepsPerBar;
    const vel = Math.max(1, Math.min(127, Math.round(note.velocity ?? 100)));
    const pitchSemi = melodicLanePitchSemi(lane, note.midi);
    if (pitchSemi == null) continue;
    const len = chordQuarterDurationToStepLen(lenQ, subdivFixed, colsPerBar, beatsPerBar);
    const groupKey = `${lane},${bar}`;
    if (!byLaneBar.has(groupKey)) byLaneBar.set(groupKey, new Map());
    const stack = byLaneBar.get(groupKey)!;
    const prev = stack.get(pitchSemi);
    if (!prev || len > prev.len) {
      stack.set(pitchSemi, { pitchSemi, len, vel });
    }
  }

  const out: BeatLabMidiNote[] = [];
  for (const [groupKey, stack] of byLaneBar) {
    const bar = parseInt(groupKey.split(',')[1] ?? '0', 10);
    const headCol = bar * stepsPerBar;
    if (headCol >= maxCol) continue;
    const barSpan = Math.min(stepsPerBar, maxCol - headCol);
    for (const hit of stack.values()) {
      const len = clampBeatLabNoteLen(Math.max(1, Math.min(hit.len, barSpan)), headCol, maxCol);
      const n = normalizeBeatLabMidiNote({
        lane,
        col: headCol,
        len,
        vel: hit.vel,
        pitchSemi: hit.pitchSemi,
        muted: hit.muted,
      });
      if (n) out.push(n);
    }
  }

  return snapBeatLabChordNotesToBarDownbeats(out, { stepsPerBar, patternCols: maxCol });
}
