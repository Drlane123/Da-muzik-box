/** Beat Pads loop sequencer — note-block edit ops (start + length on 16th grid). */

import {
  BEAT_PADS_LANE_COUNT,
  BEAT_PADS_STEPS_PER_BAR,
  beatPadsNewNoteId,
  beatPadsPatternCols,
  type BeatPadsDrumNote,
  type BeatPadsDrumPattern,
  type BeatPadsGridStepsPerBar,
} from '@/app/lib/creationStation/beatLabDrumMachineSequencer';

export type BeatPadsEditTool = 'pointer' | 'draw' | 'erase';

export type BeatPadsNoteRef = { lane: number; id: string };

export type BeatPadsSelectionRect = {
  laneMin: number;
  laneMax: number;
  colMin: number;
  colMax: number;
};

export function beatPadsCloneNote(note: BeatPadsDrumNote): BeatPadsDrumNote {
  return { ...note, id: beatPadsNewNoteId() };
}

export function beatPadsNoteAtColumn(
  laneNotes: readonly BeatPadsDrumNote[] | undefined,
  col: number,
): BeatPadsDrumNote | undefined {
  if (!laneNotes) return undefined;
  return laneNotes.find((n) => col >= n.start && col < n.start + n.len);
}

export function beatPadsLaneActiveAtStep(
  laneNotes: readonly BeatPadsDrumNote[] | undefined,
  col: number,
): boolean {
  return beatPadsNoteAtColumn(laneNotes, col) != null;
}

/** Merge consecutive on-steps into note blocks (for legacy boolean import). */
export function beatPadsBooleanRowToNotes(row: readonly boolean[]): BeatPadsDrumNote[] {
  const notes: BeatPadsDrumNote[] = [];
  let i = 0;
  while (i < row.length) {
    if (!row[i]) {
      i += 1;
      continue;
    }
    const start = i;
    while (i < row.length && row[i]) i += 1;
    notes.push({ id: beatPadsNewNoteId(), start, len: i - start });
  }
  return notes;
}

export function beatPadsPatternToStepGrid(
  pat: BeatPadsDrumPattern,
  cols: number,
): boolean[][] {
  return Array.from({ length: BEAT_PADS_LANE_COUNT }, (_, lane) => {
    const row = Array(cols).fill(false) as boolean[];
    for (const n of pat[lane] ?? []) {
      for (let c = n.start; c < n.start + n.len && c < cols; c += 1) {
        row[c] = true;
      }
    }
    return row;
  });
}

export function beatPadsSortLaneNotes(notes: BeatPadsDrumNote[]): BeatPadsDrumNote[] {
  return [...notes].sort((a, b) => a.start - b.start || a.len - b.len);
}

export function beatPadsClampNoteToCols(
  note: BeatPadsDrumNote,
  cols: number,
): BeatPadsDrumNote | null {
  if (cols <= 0) return null;
  const start = Math.max(0, Math.min(cols - 1, note.start));
  const maxLen = cols - start;
  const len = Math.max(1, Math.min(maxLen, note.len));
  return { ...note, start, len };
}

function setLane(
  pat: BeatPadsDrumPattern,
  lane: number,
  notes: BeatPadsDrumNote[],
): BeatPadsDrumPattern {
  return pat.map((row, i) => (i === lane ? beatPadsSortLaneNotes(notes) : row));
}

export function beatPadsAddNote(
  pat: BeatPadsDrumPattern,
  lane: number,
  start: number,
  len = 1,
  cols?: number,
): BeatPadsDrumPattern {
  if (lane < 0 || lane >= BEAT_PADS_LANE_COUNT) return pat;
  const totalCols = cols ?? beatPadsPatternColsFromNotes(pat);
  const note = beatPadsClampNoteToCols({ id: beatPadsNewNoteId(), start, len }, totalCols);
  if (!note) return pat;
  const laneNotes = [...(pat[lane] ?? [])];
  const existing = beatPadsNoteAtColumn(laneNotes, note.start);
  if (existing) return pat;
  laneNotes.push(note);
  return setLane(pat, lane, laneNotes);
}

export function beatPadsRemoveNote(
  pat: BeatPadsDrumPattern,
  lane: number,
  noteId: string,
): BeatPadsDrumPattern {
  if (lane < 0 || lane >= BEAT_PADS_LANE_COUNT) return pat;
  const laneNotes = (pat[lane] ?? []).filter((n) => n.id !== noteId);
  if (laneNotes.length === (pat[lane] ?? []).length) return pat;
  return setLane(pat, lane, laneNotes);
}

export function beatPadsRemoveAtColumn(
  pat: BeatPadsDrumPattern,
  lane: number,
  col: number,
): BeatPadsDrumPattern {
  const hit = beatPadsNoteAtColumn(pat[lane], col);
  if (!hit) return pat;
  return beatPadsRemoveNote(pat, lane, hit.id);
}

export function beatPadsDrawToggleAt(
  pat: BeatPadsDrumPattern,
  lane: number,
  col: number,
): BeatPadsDrumPattern {
  if (beatPadsNoteAtColumn(pat[lane], col)) {
    return beatPadsRemoveAtColumn(pat, lane, col);
  }
  return beatPadsAddNote(pat, lane, col, 1);
}

export function beatPadsDrawAt(
  pat: BeatPadsDrumPattern,
  lane: number,
  col: number,
  on: boolean,
  cols?: number,
): BeatPadsDrumPattern {
  const has = beatPadsNoteAtColumn(pat[lane], col) != null;
  if (on && !has) return beatPadsAddNote(pat, lane, col, 1, cols);
  if (!on && has) return beatPadsRemoveAtColumn(pat, lane, col);
  return pat;
}

export function beatPadsMoveNote(
  pat: BeatPadsDrumPattern,
  fromLane: number,
  noteId: string,
  toLane: number,
  toStart: number,
  cols?: number,
): BeatPadsDrumPattern {
  if (fromLane < 0 || fromLane >= BEAT_PADS_LANE_COUNT) return pat;
  if (toLane < 0 || toLane >= BEAT_PADS_LANE_COUNT) return pat;
  const totalCols = cols ?? beatPadsPatternColsFromNotes(pat);
  const src = pat[fromLane]?.find((n) => n.id === noteId);
  if (!src) return pat;

  const clamped = beatPadsClampNoteToCols({ ...src, start: toStart }, totalCols);
  if (!clamped) return pat;

  const without = beatPadsRemoveNote(pat, fromLane, noteId);
  const destLane = without[toLane] ?? [];
  if (destLane.some((n) => !(clamped.start + clamped.len <= n.start || clamped.start >= n.start + n.len))) {
    return pat;
  }
  return setLane(without, toLane, [...destLane, clamped]);
}

/** Move every selected note by the same lane/column delta (box-select drag). */
export function beatPadsMoveSelection(
  pat: BeatPadsDrumPattern,
  refs: readonly BeatPadsNoteRef[],
  deltaLane: number,
  deltaCol: number,
  cols?: number,
): BeatPadsDrumPattern {
  if (refs.length === 0 || (deltaLane === 0 && deltaCol === 0)) return pat;
  const totalCols = cols ?? beatPadsPatternColsFromNotes(pat);

  const planned: {
    fromLane: number;
    id: string;
    note: BeatPadsDrumNote;
    toLane: number;
  }[] = [];

  for (const ref of refs) {
    const n = pat[ref.lane]?.find((x) => x.id === ref.id);
    if (!n) return pat;
    const toLane = ref.lane + deltaLane;
    if (toLane < 0 || toLane >= BEAT_PADS_LANE_COUNT) return pat;
    const nextStart = n.start + deltaCol;
    if (nextStart < 0 || nextStart + n.len > totalCols) return pat;
    const moved = beatPadsClampNoteToCols({ ...n, start: nextStart }, totalCols);
    if (!moved) return pat;
    planned.push({ fromLane: ref.lane, id: ref.id, note: moved, toLane });
  }

  let cleared = pat;
  for (const p of planned) {
    cleared = beatPadsRemoveNote(cleared, p.fromLane, p.id);
  }

  for (const p of planned) {
    if (!beatPadsCanPlaceNotes(cleared, p.toLane, [p.note])) return pat;
  }
  for (let i = 0; i < planned.length; i += 1) {
    for (let j = i + 1; j < planned.length; j += 1) {
      if (planned[i].toLane !== planned[j].toLane) continue;
      const a = planned[i].note;
      const b = planned[j].note;
      if (!(a.start + a.len <= b.start || b.start + b.len <= a.start)) return pat;
    }
  }

  let next = cleared;
  for (const p of planned) {
    next = setLane(next, p.toLane, [...(next[p.toLane] ?? []), p.note]);
  }
  return next;
}

/** Alt+drag — copy selection to lane/column offset without removing originals. */
export function beatPadsDuplicateSelectionByDelta(
  pat: BeatPadsDrumPattern,
  refs: readonly BeatPadsNoteRef[],
  deltaLane: number,
  deltaCol: number,
  cols?: number,
): BeatPadsDrumPattern {
  if (refs.length === 0 || (deltaLane === 0 && deltaCol === 0)) return pat;
  const totalCols = cols ?? beatPadsPatternColsFromNotes(pat);
  let next = pat;

  for (const ref of refs) {
    const n = pat[ref.lane]?.find((x) => x.id === ref.id);
    if (!n) return pat;
    const toLane = ref.lane + deltaLane;
    if (toLane < 0 || toLane >= BEAT_PADS_LANE_COUNT) return pat;
    const nextStart = n.start + deltaCol;
    if (nextStart < 0 || nextStart + n.len > totalCols) return pat;
    const copy = beatPadsClampNoteToCols(beatPadsCloneNote({ ...n, start: nextStart }), totalCols);
    if (!copy) return pat;
    if (!beatPadsCanPlaceNotes(next, toLane, [copy])) return pat;
    next = setLane(next, toLane, [...(next[toLane] ?? []), copy]);
  }

  for (let i = 0; i < refs.length; i += 1) {
    for (let j = i + 1; j < refs.length; j += 1) {
      const aRef = refs[i]!;
      const bRef = refs[j]!;
      const aLane = aRef.lane + deltaLane;
      const bLane = bRef.lane + deltaLane;
      if (aLane !== bLane) continue;
      const a = pat[aRef.lane]?.find((x) => x.id === aRef.id);
      const b = pat[bRef.lane]?.find((x) => x.id === bRef.id);
      if (!a || !b) continue;
      const aStart = a.start + deltaCol;
      const bStart = b.start + deltaCol;
      if (!(aStart + a.len <= bStart || bStart + b.len <= aStart)) return pat;
    }
  }

  return next;
}

export function beatPadsResizeNoteEnd(
  pat: BeatPadsDrumPattern,
  lane: number,
  noteId: string,
  newEndColExclusive: number,
  cols?: number,
): BeatPadsDrumPattern {
  const totalCols = cols ?? beatPadsPatternColsFromNotes(pat);
  const note = pat[lane]?.find((n) => n.id === noteId);
  if (!note) return pat;
  const end = Math.max(note.start + 1, Math.min(totalCols, newEndColExclusive));
  const len = end - note.start;
  const next = { ...note, len };
  const others = (pat[lane] ?? []).filter((n) => n.id !== noteId);
  if (others.some((n) => !(next.start + next.len <= n.start || next.start >= n.start + n.len))) {
    return pat;
  }
  return setLane(pat, lane, [...others, next]);
}

/** Deep-clone pattern for undo stack. */
export function cloneBeatPadsPattern(pat: BeatPadsDrumPattern): BeatPadsDrumPattern {
  return pat.map((lane) => lane.map((n) => ({ ...n })));
}

/** Only notes fully inside the marquee — partial overlap at edges is ignored. */
export function beatPadsNotesInRect(
  pat: BeatPadsDrumPattern,
  rect: BeatPadsSelectionRect,
): BeatPadsNoteRef[] {
  const out: BeatPadsNoteRef[] = [];
  for (let lane = rect.laneMin; lane <= rect.laneMax; lane += 1) {
    for (const n of pat[lane] ?? []) {
      const noteEnd = n.start + n.len - 1;
      if (n.start < rect.colMin || noteEnd > rect.colMax) continue;
      out.push({ lane, id: n.id });
    }
  }
  return out;
}

/**
 * Marquee selection — only notes that overlap the drawn box (lane + column range).
 */
export function beatPadsNotesInMarquee(
  pat: BeatPadsDrumPattern,
  rect: BeatPadsSelectionRect,
): BeatPadsNoteRef[] {
  const out: BeatPadsNoteRef[] = [];
  for (let lane = rect.laneMin; lane <= rect.laneMax; lane += 1) {
    for (const n of pat[lane] ?? []) {
      const noteEnd = n.start + n.len - 1;
      if (noteEnd < rect.colMin || n.start > rect.colMax) continue;
      out.push({ lane, id: n.id });
    }
  }
  return out;
}

export function beatPadsSelectionBounds(
  pat: BeatPadsDrumPattern,
  refs: readonly BeatPadsNoteRef[],
): BeatPadsSelectionRect | null {
  if (refs.length === 0) return null;
  let laneMin = BEAT_PADS_LANE_COUNT;
  let laneMax = 0;
  let colMin = Number.POSITIVE_INFINITY;
  let colMax = 0;
  for (const ref of refs) {
    const n = pat[ref.lane]?.find((x) => x.id === ref.id);
    if (!n) continue;
    laneMin = Math.min(laneMin, ref.lane);
    laneMax = Math.max(laneMax, ref.lane);
    colMin = Math.min(colMin, n.start);
    colMax = Math.max(colMax, n.start + n.len - 1);
  }
  if (!Number.isFinite(colMin)) return null;
  return { laneMin, laneMax, colMin, colMax };
}

function beatPadsCanPlaceNotes(
  pat: BeatPadsDrumPattern,
  lane: number,
  notes: readonly BeatPadsDrumNote[],
  ignoreIds?: ReadonlySet<string>,
): boolean {
  for (const n of notes) {
    for (const existing of pat[lane] ?? []) {
      if (ignoreIds?.has(existing.id)) continue;
      if (!(n.start + n.len <= existing.start || n.start >= existing.start + existing.len)) {
        return false;
      }
    }
  }
  return true;
}

/** Duplicate selected notes to the next column gap after the selection. */
export function beatPadsDuplicateSelection(
  pat: BeatPadsDrumPattern,
  refs: readonly BeatPadsNoteRef[],
  cols?: number,
): BeatPadsDrumPattern {
  if (refs.length === 0) return pat;
  const bounds = beatPadsSelectionBounds(pat, refs);
  if (!bounds) return pat;
  const totalCols = cols ?? beatPadsPatternColsFromNotes(pat);
  const width = bounds.colMax - bounds.colMin + 1;
  const ignoreIds = new Set(refs.map((r) => r.id));

  let destStart = bounds.colMax + 1;
  while (destStart + width - 1 < totalCols) {
    const offset = destStart - bounds.colMin;
    let ok = true;
    for (const ref of refs) {
      const n = pat[ref.lane]?.find((x) => x.id === ref.id);
      if (!n) continue;
      const copy = beatPadsClampNoteToCols(
        { id: 'tmp', start: n.start + offset, len: n.len },
        totalCols,
      );
      if (!copy || !beatPadsCanPlaceNotes(pat, ref.lane, [copy], ignoreIds)) {
        ok = false;
        break;
      }
    }
    if (ok) {
      let next = pat;
      for (const ref of refs) {
        const n = pat[ref.lane]?.find((x) => x.id === ref.id);
        if (!n) continue;
        const copy = beatPadsClampNoteToCols(
          beatPadsCloneNote({ ...n, start: n.start + offset }),
          totalCols,
        );
        if (!copy) continue;
        const laneNotes = [...(next[ref.lane] ?? []), copy];
        next = setLane(next, ref.lane, laneNotes);
      }
      return next;
    }
    destStart += 1;
  }
  return pat;
}

/** Alt-drag duplicate: copy one note to new lane/col. */
export function beatPadsDuplicateNoteTo(
  pat: BeatPadsDrumPattern,
  fromLane: number,
  noteId: string,
  toLane: number,
  toStart: number,
  cols?: number,
): BeatPadsDrumPattern {
  const totalCols = cols ?? beatPadsPatternColsFromNotes(pat);
  const src = pat[fromLane]?.find((n) => n.id === noteId);
  if (!src) return pat;
  const copy = beatPadsClampNoteToCols(beatPadsCloneNote({ ...src, start: toStart }), totalCols);
  if (!copy) return pat;
  if (!beatPadsCanPlaceNotes(pat, toLane, [copy])) return pat;
  return setLane(pat, toLane, [...(pat[toLane] ?? []), copy]);
}

export function beatPadsPatternColsFromNotes(pat: BeatPadsDrumPattern): number {
  let max = 0;
  for (const lane of pat) {
    for (const n of lane) {
      max = Math.max(max, n.start + n.len);
    }
  }
  if (max > 0) return max;
  return BEAT_PADS_STEPS_PER_BAR * 8;
}

export function beatPadsResizePatternToLoopBars(
  pat: BeatPadsDrumPattern,
  nextLoopBars: number,
): BeatPadsDrumPattern {
  const cols = beatPadsPatternCols(nextLoopBars);
  return Array.from({ length: BEAT_PADS_LANE_COUNT }, (_, lane) => {
    const notes = (pat[lane] ?? [])
      .map((n) => beatPadsClampNoteToCols(n, cols))
      .filter((n): n is BeatPadsDrumNote => n != null && n.start < cols);
    return beatPadsSortLaneNotes(notes);
  });
}

export function beatPadsLaneFromBooleanTemplate(
  cols: number,
  steps: readonly number[],
  stepsPerBar: BeatPadsGridStepsPerBar = BEAT_PADS_STEPS_PER_BAR,
): BeatPadsDrumNote[] {
  const scale = stepsPerBar / BEAT_PADS_STEPS_PER_BAR;
  const row = Array.from({ length: cols }, (_, c) => {
    const stepInBar = Math.floor((c % stepsPerBar) / scale);
    return steps.includes(stepInBar);
  });
  return beatPadsBooleanRowToNotes(row);
}

/** Switch grid resolution — 16↔32 steps per bar (doubles/halves column indices). */
export function beatPadsConvertPatternGridSteps(
  pat: BeatPadsDrumPattern,
  loopBars: number,
  fromSteps: BeatPadsGridStepsPerBar,
  toSteps: BeatPadsGridStepsPerBar,
): BeatPadsDrumPattern {
  if (fromSteps === toSteps) return pat;
  if (fromSteps === 16 && toSteps === 32) {
    const cols32 = beatPadsPatternCols(loopBars, 32);
    return pat.map((lane) =>
      beatPadsSortLaneNotes(
        lane
          .map((n) => ({
            id: beatPadsNewNoteId(),
            start: n.start * 2,
            len: Math.min(cols32 - n.start * 2, n.len * 2),
          }))
          .filter((n) => n.start < cols32),
      ),
    );
  }
  const cols32 = beatPadsPatternCols(loopBars, 32);
  const cols16 = beatPadsPatternCols(loopBars, 16);
  return pat.map((lane) => {
    const row32 = Array.from({ length: cols32 }, () => false);
    for (const n of lane) {
      for (let c = n.start; c < n.start + n.len && c < cols32; c += 1) row32[c] = true;
    }
    const notes: BeatPadsDrumNote[] = [];
    let i = 0;
    while (i < cols16) {
      const hit = row32[i * 2] || row32[i * 2 + 1];
      if (!hit) {
        i += 1;
        continue;
      }
      const start = i;
      while (i < cols16 && (row32[i * 2] || row32[i * 2 + 1])) i += 1;
      notes.push({ id: beatPadsNewNoteId(), start, len: i - start });
    }
    return notes;
  });
}
