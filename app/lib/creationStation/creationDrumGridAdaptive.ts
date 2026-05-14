/**
 * Beat Lab drum grid: **adaptive line density** — which vertical grid lines stay visible (and how strong)
 * as **column width (zoom)** changes. Snap / PPQ resolution is unchanged; only paint weight adapts.
 */

export function creationDrumGridVerticalLineColor(args: {
  /** Pixel width of one sequencer column (`drumGridColW`). */
  colWidthPx: number;
  /** Absolute pattern column (same as pad `bankCol` / measure index + offset). */
  bankCol: number;
  qpb: number;
  subdiv: number;
  /** When a tier is “hidden”, use this color so the 1px border doesn’t read as a line (matches cell fill). */
  blendTo: string;
}): string {
  const cw = Math.max(1, args.colWidthPx);
  const q = Math.max(1, Math.round(args.qpb));
  const s = Math.max(1, Math.round(args.subdiv));
  const colsPerBar = q * s;
  const bc = args.bankCol;
  const isBar = bc % colsPerBar === 0;
  const isBeat = bc % s === 0;
  const { blendTo } = args;

  if (isBar) {
    if (cw < 5) return '#4d4d5c';
    if (cw < 10) return '#585866';
    return '#6f6f82';
  }
  if (isBeat) {
    if (cw < 5) return blendTo;
    if (cw < 8) return '#2e2e36';
    if (cw < 12) return '#363640';
    return '#42424c';
  }
  if (cw < 7) return blendTo;
  if (cw < 10) return '#222229';
  if (cw < 14) return '#2a2a32';
  return '#34343c';
}

/** Bottom edge of each pad step — fades when columns are crushed so rows don’t turn into hash. */
export function creationDrumGridStepBottomBorder(colWidthPx: number): string {
  const cw = Math.max(1, colWidthPx);
  if (cw < 6) return 'rgba(46, 46, 54, 0.30)';
  if (cw < 10) return 'rgba(46, 46, 54, 0.55)';
  return '#2a2a32';
}
