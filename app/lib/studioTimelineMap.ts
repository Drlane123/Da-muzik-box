/**
 * Single source of truth for Studio timeline pixel ↔ beat mapping.
 * `colW` = one bar width; playhead phase comes from `@/app/lib/masterTransportSync` via MasterClock
 * (`studioTimelineBeatFloat` / `getStudioTransportSyncSnapshotAtAudioNow`).
 */

export type StudioTimelineMap = {
  colW: number;
  beatsPerBar: number;
  totalBars: number;
  pixelsPerBeat: number;
  /** Full scroll width of the timeline (`colW * totalBars`). */
  totalWidthPx: number;
  /** Width of one beat column (same as former `measureW`). */
  beatColumnWidthPx: number;
  /** Content X from timeline start (includes horizontal scroll) → 0-based absolute beat (float). */
  xToAbsoluteBeat: (contentX: number) => number;
  /** 0-based absolute beat (float) → X from timeline start. */
  absoluteBeatToX: (absoluteBeat: number) => number;
  /** Map content X → 1-based bar and 1..beatsPerBar beat-in-bar. */
  gridFromContentX: (contentX: number) => { bar: number; beatInBar: number };
};

export function createStudioTimelineMap(opts: {
  colW: number;
  beatsPerBar: number;
  totalBars: number;
}): StudioTimelineMap {
  const { colW, beatsPerBar, totalBars } = opts;
  const pixelsPerBeat = colW / beatsPerBar;
  const totalWidthPx = colW * totalBars;

  function xToAbsoluteBeat(contentX: number): number {
    const clampedX = Math.max(0, Math.min(contentX, totalWidthPx - 1e-6));
    return clampedX / pixelsPerBeat;
  }

  function absoluteBeatToX(absoluteBeat: number): number {
    return absoluteBeat * pixelsPerBeat;
  }

  function gridFromContentX(contentX: number): { bar: number; beatInBar: number } {
    const beatsFromStart = xToAbsoluteBeat(contentX);
    const beatIndex0 = Math.floor(beatsFromStart + 1e-9);
    const barIndex0 = Math.floor(beatIndex0 / beatsPerBar + 1e-9);
    const bar = Math.max(1, Math.min(totalBars, barIndex0 + 1));
    const beatInBar0 = beatIndex0 - barIndex0 * beatsPerBar;
    const beatInBar = Math.floor(beatInBar0 + 1e-9) + 1;
    return { bar, beatInBar };
  }

  return {
    colW,
    beatsPerBar,
    totalBars,
    pixelsPerBeat,
    totalWidthPx,
    beatColumnWidthPx: pixelsPerBeat,
    xToAbsoluteBeat,
    absoluteBeatToX,
    gridFromContentX,
  };
}
