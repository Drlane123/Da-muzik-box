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
    if (cw < 5) return '#3d3d4a';
    if (cw < 10) return '#454552';
    return '#5a5a6c';
  }
  if (isBeat) {
    if (cw < 5) return blendTo;
    if (cw < 8) return '#24242a';
    if (cw < 12) return '#2a2a32';
    return '#36363f';
  }
  if (cw < 7) return blendTo;
  if (cw < 10) return '#1a1a20';
  if (cw < 14) return '#202026';
  return '#2a2a2e';
}

/** Bottom edge of each pad step — fades when columns are crushed so rows don’t turn into hash. */
export function creationDrumGridStepBottomBorder(colWidthPx: number): string {
  const cw = Math.max(1, colWidthPx);
  if (cw < 6) return 'rgba(29, 29, 29, 0.22)';
  if (cw < 10) return 'rgba(29, 29, 29, 0.45)';
  return '#1d1d1d';
}
