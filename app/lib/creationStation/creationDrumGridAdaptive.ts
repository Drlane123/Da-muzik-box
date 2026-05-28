/**
 * Beat Lab drum grid + piano roll: snap/quantize **column lines** (bar / beat / step).
 * One sequencer column = one SNAP cell; lines stay visible so draw/slice/erase align with quant.
 */

import type { CSSProperties } from 'react';

/** 4/4 Creation view: one displayed **bar** = four quarter-note **measures** (metronome clicks). */
export const CREATION_44_MEASURES_PER_BAR = 4;

/**
 * MEASURES-row digit 1…`measuresPerBar` for a pattern column (which quarter in the bar).
 * One quarter = `subdiv` columns; the visible label is shown only on the first column of each quarter
 * (see {@link beatLabMeasureRulerLabel}) so the row reads 1, 2, 3, 4 — not 1,1,1,1, 2,2,2,2.
 */
export function creation44MeasureInBar(
  bankCol: number,
  subdiv: number,
  measuresPerBar: number = CREATION_44_MEASURES_PER_BAR,
): number {
  const s = Math.max(1, Math.round(subdiv));
  const q = Math.max(1, Math.round(measuresPerBar));
  const colsPerBar = q * s;
  const mod = ((Math.max(0, Math.round(bankCol)) % colsPerBar) + colsPerBar) % colsPerBar;
  return (Math.floor(mod / s) % q) + 1;
}

/** Accent when `bankCol` sits on a bar line (first quarter of the bar in the grid). */
export function creation44IsDownbeatBankCol(
  bankCol: number,
  subdiv: number,
  measuresPerBar: number = CREATION_44_MEASURES_PER_BAR,
): boolean {
  const s = Math.max(1, Math.round(subdiv));
  const q = Math.max(1, Math.round(measuresPerBar));
  const colsPerBar = q * s;
  const bc = Math.max(0, Math.round(bankCol));
  return bc % colsPerBar === 0;
}

/**
 * Transport metronome accent — absolute step clock (not loop-wrapped `bankCol`).
 * Matches SE2 `k % bpb === 0` on quarter indices.
 */
export function creation44IsDownbeatStepIndex(
  stepIndex: number,
  subdiv: number,
  measuresPerBar: number = CREATION_44_MEASURES_PER_BAR,
): boolean {
  const s = Math.max(1, Math.round(subdiv));
  const q = Math.max(1, Math.round(measuresPerBar));
  const quarterK = Math.floor(Math.max(0, stepIndex) / s);
  return quarterK % q === 0;
}

/**
 * Absolute bank column for playline X (continuous steps, no pattern wrap).
 * Keeps the arrow on the same quarter grid as the metronome / MEASURES row (1,2,3,4…).
 */
export function creationPlaylineBankColFFromBeat(
  beatNow: number,
  subdiv: number,
  drumColOffsetSteps: number,
): number {
  const sub = Math.max(1, Math.min(64, Math.round(subdiv)));
  const off = Math.max(0, Math.round(drumColOffsetSteps));
  return Math.max(0, Math.max(0, beatNow) * sub - off);
}

/**
 * Fractional pattern column for playline / scroll (continuous `beat × subdiv`).
 * Matches {@link beatLabBankColAtStep} for integer steps — including absolute cols before the loop brace.
 */
export function creationPatternColFFromBeat(
  beatNow: number,
  subdiv: number,
  patternCols: number,
  loopOn: boolean,
  loopStartBeat: number,
  loopEndBeat: number,
  playMode: 'single' | 'chainAB',
): number {
  const sub = Math.max(1, Math.min(64, Math.round(subdiv)));
  const pc = Math.max(1, Math.round(patternCols));
  const stepF = Math.max(0, beatNow) * sub;
  const ls = Math.floor(loopStartBeat + 1e-8);
  const le = Math.floor(loopEndBeat + 1e-8);
  const lsStep = ls * sub;
  const leStep = le * sub;

  if (loopOn && leStep > lsStep) {
    if (stepF < lsStep) {
      return Math.max(0, Math.min(pc - 1, stepF));
    }
    const span = Math.max(1, leStep - lsStep);
    const pos = ((stepF - lsStep) % span + span) % span;
    return ((pos % pc) + pc) % pc;
  }
  const drumColOffset = Math.floor(Math.max(0, loopOn ? loopStartBeat * sub : 0) + 1e-8);
  const rel = stepF - drumColOffset;
  if (playMode === 'chainAB') {
    return ((rel % pc) + pc) % pc;
  }
  return Math.max(0, Math.min(pc - 1, rel));
}

/** DAW bar number (1-based) at the start of the bar that contains `bankCol`. */
export function creation44BarAtBankCol(
  bankCol: number,
  subdiv: number,
  barNumberStart = 1,
  measuresPerBar: number = CREATION_44_MEASURES_PER_BAR,
): number {
  const s = Math.max(1, Math.round(subdiv));
  const q = Math.max(1, Math.round(measuresPerBar));
  const colsPerBar = q * s;
  const bc = Math.max(0, Math.round(bankCol));
  return barNumberStart + Math.floor(bc / colsPerBar);
}

export function creationDrumGridVerticalLineColor(args: {
  /** Pixel width of one sequencer column (`drumGridColW` / roll `colWidth`). */
  colWidthPx: number;
  /** Absolute pattern column (pad `bankCol` / pattern col + offset). */
  bankCol: number;
  qpb: number;
  subdiv: number;
  /** @deprecated Lines no longer hide into the cell fill — kept for call-site compat. */
  blendTo?: string;
}): string {
  void args.blendTo;
  const cw = Math.max(1, args.colWidthPx);
  const q = Math.max(1, Math.round(args.qpb));
  const s = Math.max(1, Math.round(args.subdiv));
  const colsPerBar = q * s;
  const bc = Math.max(0, Math.round(args.bankCol));
  const isBar = bc % colsPerBar === 0;
  const isBeat = bc % s === 0;

  if (isBar) {
    if (cw < 4) return '#7a7a92';
    if (cw < 8) return '#8a8aa4';
    return '#a8a8c0';
  }
  if (isBeat) {
    if (cw < 4) return '#52525e';
    if (cw < 7) return '#5c5c6a';
    return '#6e6e7e';
  }
  // Sub-step column at current SNAP resolution — always visible
  if (cw < 3) return '#34343c';
  if (cw < 6) return '#3c3c46';
  if (cw < 10) return '#444450';
  return '#50505c';
}

/** Bottom edge of each pad step — fades when columns are crushed so rows don't turn into hash. */
export function creationDrumGridStepBottomBorder(colWidthPx: number): string {
  const cw = Math.max(1, colWidthPx);
  if (cw < 6) return 'rgba(46, 46, 54, 0.30)';
  if (cw < 10) return 'rgba(46, 46, 54, 0.55)';
  return '#2a2a32';
}

export function creationBeatLabColumnBorder(args: {
  colWidthPx: number;
  patternCol: number;
  bankColOffset: number;
  qpb: number;
  subdiv: number;
  blendTo?: string;
}): string {
  return creationDrumGridVerticalLineColor({
    colWidthPx: args.colWidthPx,
    bankCol: args.patternCol + args.bankColOffset,
    qpb: args.qpb,
    subdiv: args.subdiv,
    blendTo: args.blendTo,
  });
}

/** Phase offset so bar/beat lines align with `bankColOffset` + pattern columns. */
export function beatLabSnapGridLinePhasesPx(args: {
  colWidthPx: number;
  qpb: number;
  subdiv: number;
  bankColOffset?: number;
}): { barPx: number; beatPx: number } {
  const cw = Math.max(1, args.colWidthPx);
  const q = Math.max(1, Math.round(args.qpb));
  const s = Math.max(1, Math.round(args.subdiv));
  const colsPerBar = q * s;
  const off = Math.max(0, Math.round(args.bankColOffset ?? 0));
  const barPhase = ((colsPerBar - (off % colsPerBar)) % colsPerBar) * cw;
  const beatPhase = ((s - (off % s)) % s) * cw;
  return { barPx: -barPhase, beatPx: -beatPhase };
}

/** Full-height snap grid (bar / quarter / step) — matches `creationDrumGridVerticalLineColor` weights. */
export function beatLabSnapColumnLinesBackground(args: {
  colWidthPx: number;
  qpb: number;
  subdiv: number;
  bankColOffset?: number;
}): CSSProperties {
  const cw = Math.max(1, args.colWidthPx);
  const q = Math.max(1, Math.round(args.qpb));
  const s = Math.max(1, Math.round(args.subdiv));
  const colsPerBar = q * s;
  const barW = colsPerBar * cw;
  const beatW = s * cw;
  const { barPx, beatPx } = beatLabSnapGridLinePhasesPx(args);
  const barLine = creationDrumGridVerticalLineColor({
    colWidthPx: cw,
    bankCol: 0,
    qpb: q,
    subdiv: s,
  });
  const beatLine = creationDrumGridVerticalLineColor({
    colWidthPx: cw,
    bankCol: s,
    qpb: q,
    subdiv: s,
  });
  const stepLine = creationDrumGridVerticalLineColor({
    colWidthPx: cw,
    bankCol: 1,
    qpb: q,
    subdiv: s,
  });
  return {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: 0,
    backgroundImage: [
      `repeating-linear-gradient(90deg, ${barLine} 0 1px, transparent 1px ${barW}px)`,
      `repeating-linear-gradient(90deg, ${beatLine} 0 1px, transparent 1px ${beatW}px)`,
      `repeating-linear-gradient(90deg, ${stepLine} 0 1px, transparent 1px ${cw}px)`,
    ].join(', '),
    backgroundPosition: `${barPx}px 0, ${beatPx}px 0, 0 0`,
  };
}

/** Ruler digit for a pattern column at the active SNAP subdiv (step within the current quarter). */
export function beatLabSnapRulerLabel(patternCol: number, bankColOffset: number, subdiv: number): string {
  const s = Math.max(1, Math.round(subdiv));
  const bc = patternCol + bankColOffset;
  return String((bc % s) + 1);
}

/** MEASURES row / piano-roll header: 1–4 per bar in 4/4 (one label per quarter, not per subdiv column). */
export function beatLabMeasureRulerLabel(
  patternCol: number,
  bankColOffset: number,
  subdiv: number,
  measuresPerBar: number = CREATION_44_MEASURES_PER_BAR,
): string {
  const s = Math.max(1, Math.round(subdiv));
  const bankCol = patternCol + bankColOffset;
  if (bankCol % s !== 0) return '';
  return String(creation44MeasureInBar(bankCol, subdiv, measuresPerBar));
}
