import { SE2_LAB808_TONE_GRID_STEPS_PER_BAR } from '@/app/lib/studio/se2Lab808DrumPattern';

export const SE2_LAB808_TONE_GRID_STEP_W_BASE = 18;
export const SE2_LAB808_TONE_GRID_LANE_H_BASE = 24;
export const SE2_LAB808_TONE_GRID_HEADER_H_BASE = 16;
export const SE2_LAB808_TONE_GRID_PIANO_COL_BASE = 54;
export const SE2_LAB808_TONE_GRID_PIANO_OFFSET_BASE = 6;

export const SE2_LAB808_TONE_GRID_ZOOM_MIN = 0.45;
export const SE2_LAB808_TONE_GRID_ZOOM_MAX = 1.35;

export function se2Lab808NormalizeToneGridZoom(raw: number | undefined): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 1;
  return Math.max(
    SE2_LAB808_TONE_GRID_ZOOM_MIN,
    Math.min(SE2_LAB808_TONE_GRID_ZOOM_MAX, raw),
  );
}

export type Se2Lab808ToneGridLayout = {
  zoom: number;
  stepW: number;
  laneH: number;
  headerH: number;
  colW: number;
  barWidthPx: number;
  pianoColPx: number;
  pianoLaneOffsetPx: number;
  headerFontPx: number;
};

export function se2Lab808ToneGridLayout(zoomRaw: number | undefined): Se2Lab808ToneGridLayout {
  const zoom = se2Lab808NormalizeToneGridZoom(zoomRaw);
  const stepW = Math.max(8, Math.round(SE2_LAB808_TONE_GRID_STEP_W_BASE * zoom));
  const laneH = Math.max(12, Math.round(SE2_LAB808_TONE_GRID_LANE_H_BASE * zoom));
  const headerH = Math.max(10, Math.round(SE2_LAB808_TONE_GRID_HEADER_H_BASE * zoom));
  return {
    zoom,
    stepW,
    laneH,
    headerH,
    colW: stepW,
    barWidthPx: SE2_LAB808_TONE_GRID_STEPS_PER_BAR * stepW,
    pianoColPx: Math.max(40, Math.round(SE2_LAB808_TONE_GRID_PIANO_COL_BASE * zoom)),
    pianoLaneOffsetPx: Math.max(2, Math.round(SE2_LAB808_TONE_GRID_PIANO_OFFSET_BASE * zoom)),
    headerFontPx: Math.max(6, Math.round(7 * zoom)),
  };
}

export function se2Lab808ToneGridColLeftPx(col: number, stepW: number): number {
  return col * stepW;
}

export function se2Lab808ToneGridSpanWidthPx(cols: number, stepW: number): number {
  if (cols <= 0) return 0;
  return cols * stepW;
}
