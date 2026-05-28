import {
  beatLabMelodicLanePitch,
  beatLabNoteResizeFromStartHead,
  beatLabSplitMidiNoteAt,
  clampBeatLabNoteLen,
  type BeatLabMidiNote,
} from '@/app/lib/creationStation/beatLabMidiRoll';
import {
  beatLabSynthV2MergeGeneratedBass,
  beatLabSynthV2MonophonicLaneNotes,
} from '@/app/lib/creationStation/beatLabSynthV2BasslineGenerator';

export type BeatLabSynthV2BassEditSpan = {
  col0: number;
  col1: number;
  midi: number;
  headCol: number;
  len: number;
  pitchSemi?: number;
};

/** Editor spans use stored `len` (not clipped to the next note). */
export function beatLabSynthV2BassEditSpans(
  notes: readonly BeatLabMidiNote[],
  lane: number,
  midiAtNote: (n: BeatLabMidiNote) => number,
  maxStepCol: number,
): BeatLabSynthV2BassEditSpan[] {
  const laneNotes = beatLabSynthV2MonophonicLaneNotes(notes, lane, midiAtNote, maxStepCol);
  return laneNotes.map((n) => {
    const len = Math.max(1, n.len);
    return {
      col0: n.col,
      col1: Math.min(n.col + len, maxStepCol),
      midi: midiAtNote(n),
      headCol: n.col,
      len,
      pitchSemi: n.pitchSemi,
    };
  });
}

export function beatLabSynthV2SnapBassCol(col: number, snapCols: number, maxCol: number): number {
  const snap = Math.max(1, snapCols);
  const c = Math.round(col / snap) * snap;
  return Math.max(0, Math.min(maxCol - 1, c));
}

/** Snap to grid, then magnetize to bar downbeats (col 0 of each bar). */
export function beatLabSynthV2SnapBassColWithBars(
  col: number,
  snapCols: number,
  maxCol: number,
  stepsPerBar: number,
): number {
  const snapped = beatLabSynthV2SnapBassCol(col, snapCols, maxCol);
  const magnet = Math.max(1, Math.round(snapCols * 0.6));
  const bars = Math.max(1, Math.ceil(maxCol / Math.max(1, stepsPerBar)));
  let best = snapped;
  let bestDist = magnet + 1;
  for (let bar = 0; bar < bars; bar += 1) {
    const barCol = bar * stepsPerBar;
    if (barCol >= maxCol) break;
    const dist = Math.abs(col - barCol);
    if (dist <= magnet && dist < bestDist) {
      best = barCol;
      bestDist = dist;
    }
  }
  return best;
}

function bassNotesInWindow(
  notes: readonly BeatLabMidiNote[],
  lane: number,
  midiAtNote: (n: BeatLabMidiNote) => number,
  windowCols: number,
): BeatLabMidiNote[] {
  return beatLabSynthV2MonophonicLaneNotes(notes, lane, midiAtNote, windowCols);
}

function replaceBassLane(
  allNotes: readonly BeatLabMidiNote[],
  bassLane: number,
  layoutBars: number,
  stepsPerBar: number,
  nextBass: readonly BeatLabMidiNote[],
): BeatLabMidiNote[] {
  return beatLabSynthV2MergeGeneratedBass(allNotes, bassLane, layoutBars, stepsPerBar, nextBass);
}

export function beatLabSynthV2ClampBassPitchSemi(bassLane: number, pitchSemi: number): number {
  return Math.max(-24, Math.min(24, Math.round(pitchSemi)));
}

export function beatLabSynthV2MidiToBassPitchSemi(bassLane: number, midi: number): number {
  const base = beatLabMelodicLanePitch(bassLane);
  let m = Math.round(midi);
  while (m - base > 24) m -= 12;
  while (m - base < -24) m += 12;
  return beatLabSynthV2ClampBassPitchSemi(bassLane, m - base);
}

/** Move in time and/or change pitch (semitones from lane base). */
export function beatLabSynthV2UpdateBassNote(opts: {
  allNotes: readonly BeatLabMidiNote[];
  bassLane: number;
  layoutBars: number;
  stepsPerBar: number;
  headCol: number;
  newCol: number;
  newPitchSemi: number;
  midiAtNote: (n: BeatLabMidiNote) => number;
  maxCol: number;
  snapCols: number;
  /** When false, grid snap only (no bar downbeat magnet). Use while dragging. */
  snapToBarDownbeats?: boolean;
}): BeatLabMidiNote[] | null {
  const windowCols = opts.layoutBars * opts.stepsPerBar;
  const bass = bassNotesInWindow(opts.allNotes, opts.bassLane, opts.midiAtNote, windowCols);
  const note = bass.find((n) => n.col === opts.headCol);
  if (!note) return null;
  const col =
    opts.snapToBarDownbeats === false
      ? beatLabSynthV2SnapBassCol(opts.newCol, opts.snapCols, opts.maxCol)
      : beatLabSynthV2SnapBassColWithBars(
          opts.newCol,
          opts.snapCols,
          opts.maxCol,
          opts.stepsPerBar,
        );
  const pitchSemi = beatLabSynthV2ClampBassPitchSemi(opts.bassLane, opts.newPitchSemi);
  const prevSemi = note.pitchSemi ?? 0;
  if (col === note.col && pitchSemi === prevSemi) return null;
  if (col !== opts.headCol && bass.some((n) => n.col === col)) return null;
  const len = clampBeatLabNoteLen(note.len, col, opts.maxCol);
  const nextBass = bass.map((n) => (n.col === opts.headCol ? { ...n, col, len, pitchSemi } : n));
  return replaceBassLane(
    opts.allNotes,
    opts.bassLane,
    opts.layoutBars,
    opts.stepsPerBar,
    nextBass,
  );
}

/** @deprecated Use beatLabSynthV2UpdateBassNote */
export function beatLabSynthV2MoveBassNote(opts: {
  allNotes: readonly BeatLabMidiNote[];
  bassLane: number;
  layoutBars: number;
  stepsPerBar: number;
  headCol: number;
  newCol: number;
  midiAtNote: (n: BeatLabMidiNote) => number;
  maxCol: number;
  snapCols: number;
}): BeatLabMidiNote[] | null {
  const bass = bassNotesInWindow(
    opts.allNotes,
    opts.bassLane,
    opts.midiAtNote,
    opts.layoutBars * opts.stepsPerBar,
  );
  const note = bass.find((n) => n.col === opts.headCol);
  if (!note) return null;
  return beatLabSynthV2UpdateBassNote({
    ...opts,
    newPitchSemi: note.pitchSemi ?? 0,
  });
}

export function beatLabSynthV2ResizeBassNoteEnd(opts: {
  allNotes: readonly BeatLabMidiNote[];
  bassLane: number;
  layoutBars: number;
  stepsPerBar: number;
  headCol: number;
  newLen: number;
  midiAtNote: (n: BeatLabMidiNote) => number;
  maxCol: number;
  snapCols: number;
}): BeatLabMidiNote[] | null {
  const windowCols = opts.layoutBars * opts.stepsPerBar;
  const bass = bassNotesInWindow(opts.allNotes, opts.bassLane, opts.midiAtNote, windowCols);
  const note = bass.find((n) => n.col === opts.headCol);
  if (!note) return null;
  let len = Math.max(1, Math.round(opts.newLen));
  const snap = Math.max(1, opts.snapCols);
  len = Math.max(1, Math.round(len / snap) * snap);
  len = clampBeatLabNoteLen(len, opts.headCol, opts.maxCol);
  if (len === note.len) return null;
  const nextBass = bass.map((n) => (n.col === opts.headCol ? { ...n, len } : n));
  return replaceBassLane(
    opts.allNotes,
    opts.bassLane,
    opts.layoutBars,
    opts.stepsPerBar,
    nextBass,
  );
}

export function beatLabSynthV2ResizeBassNoteStart(opts: {
  allNotes: readonly BeatLabMidiNote[];
  bassLane: number;
  layoutBars: number;
  stepsPerBar: number;
  headCol: number;
  newHeadCol: number;
  midiAtNote: (n: BeatLabMidiNote) => number;
  maxCol: number;
  snapCols: number;
}): BeatLabMidiNote[] | null {
  const windowCols = opts.layoutBars * opts.stepsPerBar;
  const bass = bassNotesInWindow(opts.allNotes, opts.bassLane, opts.midiAtNote, windowCols);
  const note = bass.find((n) => n.col === opts.headCol);
  if (!note) return null;
  const snapped = beatLabSynthV2SnapBassColWithBars(
    opts.newHeadCol,
    opts.snapCols,
    opts.maxCol,
    opts.stepsPerBar,
  );
  const { col, len } = beatLabNoteResizeFromStartHead(opts.headCol, note.len, snapped, opts.maxCol);
  if (col === note.col && len === note.len) return null;
  if (col !== opts.headCol && bass.some((n) => n.col === col)) return null;
  const nextBass = bass.map((n) => (n.col === opts.headCol ? { ...n, col, len } : n));
  return replaceBassLane(
    opts.allNotes,
    opts.bassLane,
    opts.layoutBars,
    opts.stepsPerBar,
    nextBass,
  );
}

export function beatLabSynthV2SplitBassNoteAt(opts: {
  allNotes: readonly BeatLabMidiNote[];
  bassLane: number;
  layoutBars: number;
  stepsPerBar: number;
  headCol: number;
  splitCol: number;
  midiAtNote: (n: BeatLabMidiNote) => number;
  maxCol: number;
  snapCols: number;
}): BeatLabMidiNote[] | null {
  const windowCols = opts.layoutBars * opts.stepsPerBar;
  const bass = bassNotesInWindow(opts.allNotes, opts.bassLane, opts.midiAtNote, windowCols);
  const splitCol = beatLabSynthV2SnapBassCol(opts.splitCol, opts.snapCols, opts.maxCol);
  const split = beatLabSplitMidiNoteAt(bass, opts.bassLane, opts.headCol, splitCol, opts.maxCol);
  if (split.length === bass.length) return null;
  return replaceBassLane(
    opts.allNotes,
    opts.bassLane,
    opts.layoutBars,
    opts.stepsPerBar,
    split,
  );
}

/** Double-click empty grid: add a short hit on the bar root (same pitchSemi as root). */
export function beatLabSynthV2AddBassHitAt(opts: {
  allNotes: readonly BeatLabMidiNote[];
  bassLane: number;
  layoutBars: number;
  stepsPerBar: number;
  col: number;
  pitchSemi: number;
  midiAtNote: (n: BeatLabMidiNote) => number;
  maxCol: number;
  snapCols: number;
  defaultLen?: number;
}): BeatLabMidiNote[] | null {
  const windowCols = opts.layoutBars * opts.stepsPerBar;
  const bass = bassNotesInWindow(opts.allNotes, opts.bassLane, opts.midiAtNote, windowCols);
  const col = beatLabSynthV2SnapBassCol(opts.col, opts.snapCols, opts.maxCol);
  if (bass.some((n) => n.col === col)) return null;
  const len = clampBeatLabNoteLen(opts.defaultLen ?? opts.snapCols, col, opts.maxCol);
  const nextBass = [
    ...bass,
    {
      lane: opts.bassLane,
      col,
      len,
      vel: 100,
      pitchSemi: Math.max(-24, Math.min(24, Math.round(opts.pitchSemi))),
    },
  ].sort((a, b) => a.col - b.col);
  return replaceBassLane(
    opts.allNotes,
    opts.bassLane,
    opts.layoutBars,
    opts.stepsPerBar,
    nextBass,
  );
}

export function beatLabSynthV2PitchSemiForBarRoot(bassLane: number, rootMidi: number): number {
  return beatLabSynthV2MidiToBassPitchSemi(bassLane, rootMidi);
}

export function beatLabSynthV2DeleteBassNote(opts: {
  allNotes: readonly BeatLabMidiNote[];
  bassLane: number;
  layoutBars: number;
  stepsPerBar: number;
  headCol: number;
  midiAtNote: (n: BeatLabMidiNote) => number;
}): BeatLabMidiNote[] | null {
  const windowCols = opts.layoutBars * opts.stepsPerBar;
  const bass = bassNotesInWindow(opts.allNotes, opts.bassLane, opts.midiAtNote, windowCols);
  if (!bass.some((n) => n.col === opts.headCol)) return null;
  const nextBass = bass.filter((n) => n.col !== opts.headCol);
  return replaceBassLane(
    opts.allNotes,
    opts.bassLane,
    opts.layoutBars,
    opts.stepsPerBar,
    nextBass,
  );
}
