/** Pointer helpers for Beat Lab step-grid brush painting (snap = one column per cell). */

/** Beat Lab grid / roll edit tools (FL: draw/delete/mute/velocity/slice/automation + pitch). */
export type BeatLabEditTool =
  | 'pointer'
  | 'draw'
  | 'erase'
  | 'mute'
  | 'velocity'
  | 'automation'
  | 'pitch'
  | 'slice';

export function beatLabToolUsesDrumBrush(tool: BeatLabEditTool): boolean {
  return tool === 'draw' || tool === 'erase';
}

/** `null` = not a step brush tool (pointer, mute, velocity, slice on roll). */
export function beatLabDrumBrushValue(tool: BeatLabEditTool, shiftKey: boolean): boolean | null {
  if (tool === 'draw') return !shiftKey;
  if (tool === 'erase') return false;
  return null;
}

export function beatLabDrumCellKey(pad: number, bankCol: number): string {
  return `${pad},${bankCol}`;
}

export function beatLabDrumCellFromPointer(
  clientX: number,
  clientY: number,
  scrollEl: HTMLElement,
  opts: {
    colWidth: number;
    headerH: number;
    rowH: number;
    laneCount: number;
    patternCols: number;
    colOffset: number;
    /** When set, Y/X are measured from this content box (handles unified vertical scroll). */
    contentEl?: HTMLElement | null;
  },
): { pad: number; patternCol: number; bankCol: number } | null {
  const contentRect = opts.contentEl?.getBoundingClientRect();
  const localX = contentRect
    ? clientX - contentRect.left
    : clientX - scrollEl.getBoundingClientRect().left + scrollEl.scrollLeft;
  const localY = contentRect
    ? clientY - contentRect.top
    : clientY - scrollEl.getBoundingClientRect().top + scrollEl.scrollTop;
  if (localX < 0 || localY < opts.headerH) return null;
  const patternCol = Math.floor(localX / opts.colWidth);
  const pad = Math.floor((localY - opts.headerH) / opts.rowH);
  if (patternCol < 0 || patternCol >= opts.patternCols) return null;
  if (pad < 0 || pad >= opts.laneCount) return null;
  return { pad, patternCol, bankCol: patternCol + opts.colOffset };
}

/** Sample along a drag segment so fast strokes do not skip columns/lanes. */
export function beatLabDrumCellsAlongSegment(
  cx0: number,
  cy0: number,
  cx1: number,
  cy1: number,
  scrollEl: HTMLElement,
  opts: Parameters<typeof beatLabDrumCellFromPointer>[3],
): Array<{ pad: number; patternCol: number; bankCol: number }> {
  const dx = cx1 - cx0;
  const dy = cy1 - cy0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.min(256, Math.max(1, Math.ceil(dist / 4)));
  const out: Array<{ pad: number; patternCol: number; bankCol: number }> = [];
  const seen = new Set<string>();
  for (let s = 0; s <= steps; s++) {
    const t = steps === 0 ? 0 : s / steps;
    const cell = beatLabDrumCellFromPointer(cx0 + dx * t, cy0 + dy * t, scrollEl, opts);
    if (!cell) continue;
    const key = beatLabDrumCellKey(cell.pad, cell.bankCol);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cell);
  }
  return out;
}
