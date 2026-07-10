/**
 * Beat Lab drum grid — discrete square step tiles (Drumloop-style wells).
 * Hit target stays full cell; only the inner graphic is square.
 */

import type { CSSProperties } from 'react';

import {
  creationDrumGridStepBottomBorder,
  creationDrumGridVerticalLineColor,
} from '@/app/lib/creationStation/creationDrumGridAdaptive';

export const BEAT_LAB_TILE_GRID_STORAGE_KEY = 'beatLab_tileGrid_v1';

/** Below this column width, fall back to classic full-cell paint. */
export const BEAT_LAB_TILE_MIN_COL_PX = 20;

const TILE_OFF_BG = '#12161f';
const TILE_OFF_BORDER = '#343a4a';
const TILE_OFF_BORDER_BEAT = '#4a5268';
const TILE_WELL_BG = 'transparent';

export function loadBeatLabTileGridPref(): boolean {
  try {
    const v = localStorage.getItem(BEAT_LAB_TILE_GRID_STORAGE_KEY);
    if (v === '0') return false;
    if (v === '1') return true;
  } catch {
    /* ignore */
  }
  return true;
}

export function saveBeatLabTileGridPref(on: boolean): void {
  try {
    localStorage.setItem(BEAT_LAB_TILE_GRID_STORAGE_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function beatLabTileGridActive(prefOn: boolean, colWidthPx: number): boolean {
  return prefOn && colWidthPx >= BEAT_LAB_TILE_MIN_COL_PX;
}

export function beatLabTileSizePx(colWidthPx: number, rowHeightPx: number): number {
  const cw = Math.max(1, colWidthPx);
  const rh = Math.max(1, rowHeightPx);
  const gap = cw < 28 ? 3 : 4;
  return Math.max(8, Math.min(cw - gap * 2, rh - 6));
}

function beatLabTileOnFill(): string {
  return 'linear-gradient(180deg, #7cf4c6 0%, #34d399 100%)';
}

export type BeatLabDrumStepTileLook = {
  /** Full cell button chrome (hit target). */
  button: CSSProperties;
  /** Inner square; null = classic full-bleed cell (no inner element). */
  inner: CSSProperties | null;
};

export function beatLabDrumStepTileLook(args: {
  tileGrid: boolean;
  colWidthPx: number;
  rowHeightPx: number;
  bankCol: number;
  qpb: number;
  subdiv: number;
  padStepBg: string;
  on: boolean;
  isNoteSelected: boolean;
  isHead: boolean;
  noteCellRadius: number | string;
  /** When set and > 1, classic mode keeps full-bleed roll span. */
  noteLen?: number;
  beatLabGridStepOnFill: () => string;
}): BeatLabDrumStepTileLook {
  const {
    tileGrid,
    colWidthPx,
    rowHeightPx,
    bankCol,
    qpb,
    subdiv,
    padStepBg,
    on,
    isNoteSelected,
    isHead,
    noteCellRadius,
    noteLen,
    beatLabGridStepOnFill,
  } = args;

  const cursorBase = 'pointer' as const;
  const singleHit = on && (noteLen == null || noteLen <= 1);

  if (!tileGrid && !singleHit) {
    return {
      button: {
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'stretch',
        background: on ? beatLabGridStepOnFill() : padStepBg,
        outline: isNoteSelected ? '2px solid #7cf4c6' : undefined,
        outlineOffset: -1,
        borderRadius: on ? noteCellRadius : 0,
        boxShadow: on
          ? 'inset 0 0 0 1px #a7f3d0, 0 0 8px rgba(124, 244, 198, 0.35)'
          : 'none',
        borderLeft: `1px solid ${creationDrumGridVerticalLineColor({
          colWidthPx,
          bankCol,
          qpb,
          subdiv,
          blendTo: padStepBg,
        })}`,
        borderTop: 'none',
        borderRight: 'none',
        borderBottom: `1px solid ${creationDrumGridStepBottomBorder(colWidthPx)}`,
        transition: isHead ? 'none' : 'background 0.04s',
        padding: 0,
      },
      inner: null,
    };
  }

  const s = Math.max(1, Math.round(subdiv));
  const isBeat = bankCol % s === 0;
  const size = beatLabTileSizePx(colWidthPx, rowHeightPx);

  const inner: CSSProperties = on
    ? {
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: 3,
        background: beatLabTileOnFill(),
        border: '1px solid #a7f3d0',
        boxShadow:
          '0 1px 2px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.18)',
        outline: isNoteSelected ? '2px solid #7cf4c6' : undefined,
        outlineOffset: 0,
      }
    : {
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: 3,
        background: TILE_OFF_BG,
        border: `1px solid ${isBeat ? TILE_OFF_BORDER_BEAT : TILE_OFF_BORDER}`,
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
        outline: isNoteSelected ? '2px solid rgba(124, 244, 198, 0.55)' : undefined,
        outlineOffset: 0,
      };

  return {
    button: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: TILE_WELL_BG,
      borderLeft: `1px solid ${creationDrumGridVerticalLineColor({
        colWidthPx,
        bankCol,
        qpb,
        subdiv,
        blendTo: TILE_WELL_BG,
      })}`,
      borderTop: 'none',
      borderRight: 'none',
      borderBottom: `1px solid ${creationDrumGridStepBottomBorder(colWidthPx)}`,
      padding: 0,
      transition: isHead ? 'none' : 'opacity 0.04s',
      cursor: cursorBase,
    },
    inner,
  };
}
