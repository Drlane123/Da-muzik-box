import {

  GROOVE_LAB_SLOTS_PER_BAR,

  grooveLabQuantizeDivisionsPerBar,

  grooveLabSlotInBar,

  grooveLabSlotsPerCell,

  normalizeGrooveBarCount,

  type GrooveLabQuantize,

} from '@/app/lib/creationStation/grooveLabRoll';



/** 4/4 time — matches Beat Lab / Chord Builder. */

export const GROOVE_LAB_BEATS_PER_BAR = 4;



/** Quarter-note “measures” per bar (Creation Station `MEASURES_PER_BAR`). */

export const GROOVE_LAB_MEASURES_PER_BAR = GROOVE_LAB_BEATS_PER_BAR;



/** One full bar in the piano roll (4 beats in 4/4). */

export const GROOVE_LAB_WINDOW_BEATS = GROOVE_LAB_BEATS_PER_BAR;



/** Slots per quarter-note beat within one bar. */

export const GROOVE_LAB_SLOTS_PER_BEAT = GROOVE_LAB_SLOTS_PER_BAR / GROOVE_LAB_WINDOW_BEATS;



/** Four sixteenth notes per beat → 4 slots per 16th at finest resolution. */

export const GROOVE_LAB_SLOTS_PER_SIXTEENTH = GROOVE_LAB_SLOTS_PER_BEAT / 4;



export type GrooveGridLineKind = 'bar' | 'beat' | 'snap' | 'fine';



export type GrooveGridLine = {

  slot: number;

  kind: GrooveGridLineKind;

};



/** One vertical line on the visible column grid (0 … totalColumns inclusive). */

export type GrooveGridColumnLine = {

  col: number;

  kind: GrooveGridLineKind;

};



export type GrooveRulerBeatCell = {

  beat: number;

  /** Global column index across all bars. */

  col: number;

  colSpan: number;

  label: string;

};



export type GrooveRulerBarCell = {

  bar: number;

  col: number;

  colSpan: number;

  label: string;

};

type GrooveMeasureSpan = {
  startCol: number;
  colSpan: number;
};

/**
 * Split one bar into 4 visual measure spans whose total is exactly `colsPerBar`.
 * This avoids fractional-width drift where one segment can look wider.
 */
function grooveLabMeasureSpans(colsPerBar: number): GrooveMeasureSpan[] {
  const spans: GrooveMeasureSpan[] = [];
  for (let m = 0; m < GROOVE_LAB_MEASURES_PER_BAR; m++) {
    const startCol = Math.floor((m * colsPerBar) / GROOVE_LAB_MEASURES_PER_BAR);
    const endCol = Math.floor(((m + 1) * colsPerBar) / GROOVE_LAB_MEASURES_PER_BAR);
    spans.push({ startCol, colSpan: Math.max(1, endCol - startCol) });
  }
  return spans;
}

export function grooveLabWindowBeats(): number {

  return GROOVE_LAB_WINDOW_BEATS;

}



export function grooveLabSlotToBeat(slot: number): number {

  return grooveLabSlotInBar(slot) / GROOVE_LAB_SLOTS_PER_BEAT;

}



export function grooveLabBeatToSlot(beat: number): number {

  return Math.round(beat * GROOVE_LAB_SLOTS_PER_BEAT);

}



export function grooveLabStepsPerBar(q: GrooveLabQuantize): number {

  return grooveLabQuantizeDivisionsPerBar(q);

}



/** Snap columns per quarter-measure (4 measures × this = steps per bar). */

export function grooveLabStepsPerMeasure(q: GrooveLabQuantize): number {

  return grooveLabStepsPerBar(q) / GROOVE_LAB_MEASURES_PER_BAR;

}



export function grooveLabStepsPerBeat(q: GrooveLabQuantize): number {

  return grooveLabStepsPerMeasure(q);

}



export function grooveLabColsPerBar(q: GrooveLabQuantize): number {

  return grooveLabStepsPerBar(q);

}



export function grooveLabTotalColumns(q: GrooveLabQuantize, barCount: number): number {

  return grooveLabColsPerBar(q) * normalizeGrooveBarCount(barCount);

}



/** @deprecated use grooveLabColsPerBar */

export function grooveLabVisibleColumns(q: GrooveLabQuantize): number {

  return grooveLabColsPerBar(q);

}



export function grooveLabColToSlotInBar(colInBar: number, q: GrooveLabQuantize): number {

  return colInBar * grooveLabSlotsPerCell(q);

}



export function grooveLabSlotInBarToCol(slotInBar: number, q: GrooveLabQuantize): number {

  const snap = grooveLabSlotsPerCell(q);

  const cols = grooveLabColsPerBar(q);

  return Math.max(0, Math.min(cols - 1, Math.floor(slotInBar / snap)));

}



export function grooveLabGlobalColToSlot(globalCol: number, q: GrooveLabQuantize): number {

  const colsPerBar = grooveLabColsPerBar(q);

  const barIdx = Math.floor(globalCol / colsPerBar);

  const colInBar = globalCol % colsPerBar;

  return barIdx * GROOVE_LAB_SLOTS_PER_BAR + grooveLabColToSlotInBar(colInBar, q);

}



export function grooveLabSlotToGlobalCol(slot: number, q: GrooveLabQuantize): number {

  const barIdx = Math.floor(slot / GROOVE_LAB_SLOTS_PER_BAR);

  const colInBar = grooveLabSlotInBarToCol(grooveLabSlotInBar(slot), q);

  return barIdx * grooveLabColsPerBar(q) + colInBar;

}



export type GrooveRulerQuantCell = {

  col: number;

  slot: number;

  bar: number;

  step: number;

  label: string;

};



/** Quantize grid row — one digit per snap column per bar. */

export function grooveLabRulerQuantCells(q: GrooveLabQuantize, barCount: number): GrooveRulerQuantCell[] {

  const snap = grooveLabSlotsPerCell(q);

  const colsPerBar = grooveLabColsPerBar(q);

  const spans = grooveLabMeasureSpans(colsPerBar);

  const bars = normalizeGrooveBarCount(barCount);

  const cells: GrooveRulerQuantCell[] = [];

  for (let b = 0; b < bars; b++) {

    for (let colInBar = 0; colInBar < colsPerBar; colInBar++) {

      const col = b * colsPerBar + colInBar;

      cells.push({

        col,

        slot: b * GROOVE_LAB_SLOTS_PER_BAR + colInBar * snap,

        bar: b + 1,

        step: colInBar + 1,

        label:
          colsPerBar <= GROOVE_LAB_MEASURES_PER_BAR
            ? String(colInBar + 1)
            : String(
                colInBar -
                  (spans.find((s) => colInBar >= s.startCol && colInBar < s.startCol + s.colSpan)
                    ?.startCol ?? 0) +
                  1,
              ),

      });

    }

  }

  return cells;

}



/** Bar numbers 1…N across the loop. */

export function grooveLabRulerBarCells(q: GrooveLabQuantize, barCount: number): GrooveRulerBarCell[] {

  const colsPerBar = grooveLabColsPerBar(q);

  const bars = normalizeGrooveBarCount(barCount);

  return Array.from({ length: bars }, (_, i) => ({

    bar: i + 1,

    col: i * colsPerBar,

    colSpan: colsPerBar,

    label: String(i + 1),

  }));

}



/** Quarter-measure numbers 1–4, repeated for each bar. */

export function grooveLabRulerMeasureCells(q: GrooveLabQuantize, barCount: number): GrooveRulerBeatCell[] {
  const colsPerBar = grooveLabColsPerBar(q);
  const spans = grooveLabMeasureSpans(colsPerBar);

  const bars = normalizeGrooveBarCount(barCount);

  const cells: GrooveRulerBeatCell[] = [];

  for (let b = 0; b < bars; b++) {

    for (let m = 0; m < GROOVE_LAB_MEASURES_PER_BAR; m++) {
      const span = spans[m]!;

      cells.push({

        beat: m + 1,

        col: b * colsPerBar + span.startCol,

        colSpan: span.colSpan,

        label: String(m + 1),

      });

    }

  }

  return cells;

}



/** @deprecated use grooveLabRulerMeasureCells */

export function grooveLabRulerBeatCells(): GrooveRulerBeatCell[] {

  return grooveLabRulerMeasureCells('1/16', 1);

}



/** Pixels per beat when the grid uses fixed column width. */

export function grooveLabPxPerBeat(pxPerCol: number, q: GrooveLabQuantize): number {

  const snap = grooveLabSlotsPerCell(q);

  return (pxPerCol * GROOVE_LAB_SLOTS_PER_BEAT) / snap;

}



/**

 * Vertical lines: bar edges between loops + measure starts + quantize columns.

 */

export function grooveLabGridColumnLines(q: GrooveLabQuantize, barCount: number): GrooveGridColumnLine[] {

  const colsPerBar = grooveLabColsPerBar(q);

  const spans = grooveLabMeasureSpans(colsPerBar);
  const measureStarts = new Set<number>(spans.map((s) => s.startCol).filter((c) => c > 0));

  const bars = normalizeGrooveBarCount(barCount);

  const totalCols = colsPerBar * bars;

  const lines: GrooveGridColumnLine[] = [];

  const seen = new Set<number>();



  const push = (col: number, kind: GrooveGridLineKind) => {

    if (col < 0 || col > totalCols || seen.has(col)) return;

    seen.add(col);

    lines.push({ col, kind });

  };



  push(0, 'bar');

  for (let b = 0; b < bars; b++) {

    const base = b * colsPerBar;

    if (b > 0) push(base, 'bar');

    for (let c = 1; c < colsPerBar; c++) {

      const col = base + c;

      if (measureStarts.has(c)) push(col, 'beat');

      else push(col, 'snap');

    }

  }

  push(totalCols, 'bar');



  return lines.sort((a, b) => a.col - b.col);

}



/** @deprecated use grooveLabGridColumnLines */

export function grooveLabGridLines(q: GrooveLabQuantize, barCount = 1): GrooveGridLine[] {

  return grooveLabGridColumnLines(q, barCount).map((line) => ({

    slot: grooveLabGlobalColToSlot(line.col, q),

    kind: line.kind,

  }));

}



/** @deprecated use grooveLabRulerBeatCells */

export function grooveLabRulerBeatMarkers() {

  return grooveLabRulerBeatCells().map((b) => ({

    beat: b.beat,

    slot: b.col,

    label: b.label,

  }));

}



export function grooveLabGridLineStyle(kind: GrooveGridLineKind): {

  background: string;

  opacity: number;

  width: number;

} {

  switch (kind) {

    case 'bar':

      return { background: 'rgba(124,244,198,0.55)', opacity: 1, width: 1 };

    case 'beat':

      return { background: 'rgba(103,232,249,0.35)', opacity: 1, width: 1 };

    case 'snap':

      return { background: 'rgba(103,232,249,0.18)', opacity: 1, width: 1 };

    case 'fine':

      return { background: 'rgba(255,255,255,0.06)', opacity: 1, width: 1 };

    default:

      return { background: 'rgba(255,255,255,0.06)', opacity: 1, width: 1 };

  }

}


