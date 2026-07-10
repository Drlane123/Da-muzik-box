/** Studio Editor 2 — timeline length (Studio One–style long form). */
export const SE2_ARRANGEMENT_BARS = 1800;

/** Max timeline lanes — room for many vocal/audio tracks plus Beat Pads, Synth Geno, drums, etc. */
export const MAX_STUDIO_TRACKS = 64;

export const SE2_BAR_WIDTH_PX = 60;

/** Browser canvas bitmap safety — grid paints a viewport window when the full strip exceeds this. */
export const SE2_MAX_GRID_BITMAP_PX = 16384;

/** Extra timeline painted left/right of the scroll viewport. */
export const SE2_GRID_VIEW_MARGIN_PX = 960;

export function se2TotalBeatsForArrangement(beatsPerBar: number): number {
  const bpb = Math.max(2, Math.min(16, Math.round(beatsPerBar)));
  return SE2_ARRANGEMENT_BARS * bpb;
}

export function se2ArrangementWidthPx(zoom: number): number {
  return SE2_ARRANGEMENT_BARS * SE2_BAR_WIDTH_PX * zoom;
}

export function se2ComputeGridViewport(
  fullWidthCss: number,
  scrollLeftCss: number,
  viewportWidthCss: number,
): { viewStart: number; paintWidth: number } {
  const margin = SE2_GRID_VIEW_MARGIN_PX;
  const viewStart = Math.max(0, scrollLeftCss - margin);
  const viewEnd = Math.min(fullWidthCss, scrollLeftCss + Math.max(400, viewportWidthCss) + margin);
  return { viewStart, paintWidth: Math.max(1, viewEnd - viewStart) };
}
