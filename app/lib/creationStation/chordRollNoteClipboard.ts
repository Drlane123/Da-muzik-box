/**
 * Copy / paste piano-roll note cells (what you see on the grid), not chord symbols.
 */

export interface RollNoteCell {
  row: number;
  /** Column offset within the copied span (0 = first column of first bar). */
  offsetCol: number;
  length: number;
}

export interface BarNotesClipboard {
  barCount: number;
  colsPerBar: number;
  cells: RollNoteCell[];
}

export interface RollEdits {
  added: ReadonlySet<string>;
  removed: ReadonlySet<string>;
  lengths: ReadonlyMap<string, number>;
}

export function buildAutoNoteKeys(
  previewEvents: ReadonlyArray<{ midi: number; col: number }>,
  totalCols: number,
  rowForMidi: (midi: number) => number,
): Set<string> {
  const set = new Set<string>();
  for (const { midi, col } of previewEvents) {
    const row = rowForMidi(midi);
    if (row >= 0 && col >= 0 && col < totalCols) {
      set.add(`${row},${col}`);
    }
  }
  return set;
}

function isLitAt(
  key: string,
  autoKeys: Set<string>,
  added: ReadonlySet<string>,
  removed: ReadonlySet<string>,
): boolean {
  const isAuto = autoKeys.has(key);
  const isAdded = added.has(key);
  const isRemoved = removed.has(key);
  return (isAuto && !isRemoved) || isAdded;
}

/** Snapshot visible note heads in a bar range (includes manual edits + pattern). */
export function extractBarNotesClipboard(
  barStart: number,
  barEnd: number,
  autoKeys: Set<string>,
  added: ReadonlySet<string>,
  removed: ReadonlySet<string>,
  lengths: ReadonlyMap<string, number>,
  colsPerBar: number,
  rowCount: number,
  totalCols: number,
): BarNotesClipboard {
  const barCount = Math.max(1, barEnd - barStart + 1);
  const spanStartCol = barStart * colsPerBar;
  const spanCols = barCount * colsPerBar;
  const cells: RollNoteCell[] = [];
  const skip = new Set<string>();

  for (let offsetCol = 0; offsetCol < spanCols; offsetCol++) {
    const col = spanStartCol + offsetCol;
    if (col >= totalCols) break;
    for (let row = 0; row < rowCount; row++) {
      const skipKey = `${row},${offsetCol}`;
      if (skip.has(skipKey)) continue;
      const key = `${row},${col}`;
      if (!isLitAt(key, autoKeys, added, removed)) continue;
      const barIdxForCol = Math.floor(col / colsPerBar);
      const maxLen = (barIdxForCol + 1) * colsPerBar - col;
      const len = Math.max(1, Math.min(lengths.get(key) ?? 1, maxLen));
      cells.push({ row, offsetCol, length: len });
      for (let d = 1; d < len; d++) skip.add(`${row},${offsetCol + d}`);
    }
  }

  return { barCount, colsPerBar, cells };
}

/** Paint clipboard notes onto destination bars (manual overrides). */
export function pasteBarNotesClipboard(
  pasteBar: number,
  clipboard: BarNotesClipboard,
  autoKeys: Set<string>,
  edits: RollEdits,
  colsPerBar: number,
  rowCount: number,
  totalCols: number,
  totalBars: number,
): RollEdits | null {
  if (clipboard.cells.length === 0) return null;
  const spanCols = clipboard.barCount * clipboard.colsPerBar;
  const startCol = pasteBar * colsPerBar;
  if (startCol >= totalCols) return null;
  if (pasteBar + clipboard.barCount > totalBars) return null;

  const newAdded = new Set(edits.added);
  const newRemoved = new Set(edits.removed);
  const newLengths = new Map(edits.lengths);

  for (let offsetCol = 0; offsetCol < spanCols; offsetCol++) {
    const col = startCol + offsetCol;
    if (col >= totalCols) break;
    for (let row = 0; row < rowCount; row++) {
      const key = `${row},${col}`;
      newAdded.delete(key);
      newRemoved.delete(key);
      newLengths.delete(key);
    }
  }

  const wantLit = new Set<string>();
  for (const cell of clipboard.cells) {
    const col = startCol + cell.offsetCol;
    if (col >= totalCols) continue;
    const key = `${cell.row},${col}`;
    wantLit.add(key);
    const barIdxForCol = Math.floor(col / colsPerBar);
    const maxLen = (barIdxForCol + 1) * colsPerBar - col;
    newLengths.set(key, Math.max(1, Math.min(cell.length, maxLen)));
  }

  for (let offsetCol = 0; offsetCol < spanCols; offsetCol++) {
    const col = startCol + offsetCol;
    if (col >= totalCols) break;
    for (let row = 0; row < rowCount; row++) {
      const key = `${row},${col}`;
      const shouldLit = wantLit.has(key);
      const isAuto = autoKeys.has(key);
      if (shouldLit) {
        if (!isAuto) newAdded.add(key);
        else newRemoved.delete(key);
      } else if (isAuto) {
        newRemoved.add(key);
      }
    }
  }

  return { added: newAdded, removed: newRemoved, lengths: newLengths };
}

/** Silence every chord-derived note on the roll; clears manual note overlays too. */
export function clearAllRollNotes(
  previewEvents: ReadonlyArray<{ midi: number; col: number }>,
  totalCols: number,
  rowForMidi: (midi: number) => number,
): RollEdits {
  const removed = buildAutoNoteKeys(previewEvents, totalCols, rowForMidi);
  return {
    added: new Set<string>(),
    removed,
    lengths: new Map<string, number>(),
  };
}
