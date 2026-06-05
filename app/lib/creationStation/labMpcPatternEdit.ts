/** Rectangular region on the 808 Lab MPC step grid (inclusive bounds). */
export type LabMpcGridRegion = {
  row0: number;
  row1: number;
  col0: number;
  col1: number;
};

/** Copied step hits — `hits[dr][dc]` relative to clip origin. */
export type LabMpcPatternClip = {
  w: number;
  h: number;
  hits: boolean[][];
};

export function labMpcCellInRegion(region: LabMpcGridRegion | null, row: number, col: number): boolean {
  if (!region) return false;
  return row >= region.row0 && row <= region.row1 && col >= region.col0 && col <= region.col1;
}

export function labMpcRegionFromPoints(
  rowA: number,
  colA: number,
  rowB: number,
  colB: number,
  rowCount: number,
  colCount: number,
): LabMpcGridRegion {
  const row0 = Math.max(0, Math.min(rowA, rowB));
  const row1 = Math.min(rowCount - 1, Math.max(rowA, rowB));
  const col0 = Math.max(0, Math.min(colA, colB));
  const col1 = Math.min(colCount - 1, Math.max(colA, colB));
  return { row0, row1, col0, col1 };
}

export function labMpcRegionHasHits(pattern: boolean[][], region: LabMpcGridRegion): boolean {
  for (let r = region.row0; r <= region.row1; r++) {
    const row = pattern[r];
    if (!row) continue;
    for (let c = region.col0; c <= region.col1; c++) {
      if (row[c]) return true;
    }
  }
  return false;
}

export function labMpcExtractClip(pattern: boolean[][], region: LabMpcGridRegion): LabMpcPatternClip {
  const w = region.col1 - region.col0 + 1;
  const h = region.row1 - region.row0 + 1;
  const hits = Array.from({ length: h }, (_, dr) => {
    const srcRow = pattern[region.row0 + dr];
    return Array.from({ length: w }, (_, dc) => Boolean(srcRow?.[region.col0 + dc]));
  });
  return { w, h, hits };
}

export function labMpcEraseRegion(pattern: boolean[][], region: LabMpcGridRegion): boolean[][] {
  return pattern.map((row, ri) => {
    if (ri < region.row0 || ri > region.row1) return row;
    return row.map((v, ci) => (ci >= region.col0 && ci <= region.col1 ? false : v));
  });
}

/** True when every cell in the destination rectangle is off. */
export function labMpcRegionDestinationEmpty(
  pattern: boolean[][],
  destRow0: number,
  destCol0: number,
  clip: LabMpcPatternClip,
): boolean {
  for (let dr = 0; dr < clip.h; dr++) {
    const row = pattern[destRow0 + dr];
    if (!row) return false;
    for (let dc = 0; dc < clip.w; dc++) {
      if (row[destCol0 + dc]) return false;
    }
  }
  return true;
}

export function labMpcFindEmptyPasteCol(
  pattern: boolean[][],
  clip: LabMpcPatternClip,
  destRow0: number,
  colCount: number,
  searchFromCol: number,
): number | null {
  const w = clip.w;
  if (w <= 0 || clip.h <= 0) return null;
  for (let col = Math.max(0, searchFromCol); col + w <= colCount; col++) {
    if (labMpcRegionDestinationEmpty(pattern, destRow0, col, clip)) return col;
  }
  for (let col = 0; col < Math.min(searchFromCol, colCount - w + 1); col++) {
    if (labMpcRegionDestinationEmpty(pattern, destRow0, col, clip)) return col;
  }
  return null;
}

export function labMpcPasteClip(
  pattern: boolean[][],
  clip: LabMpcPatternClip,
  destRow0: number,
  destCol0: number,
): boolean[][] {
  return pattern.map((row, ri) => {
    const dr = ri - destRow0;
    if (dr < 0 || dr >= clip.h) return row;
    return row.map((v, ci) => {
      const dc = ci - destCol0;
      if (dc < 0 || dc >= clip.w) return v;
      return clip.hits[dr]![dc]! ? true : v;
    });
  });
}

export function labMpcPasteClipReplace(
  pattern: boolean[][],
  clip: LabMpcPatternClip,
  destRow0: number,
  destCol0: number,
): boolean[][] {
  return pattern.map((row, ri) => {
    const dr = ri - destRow0;
    if (dr < 0 || dr >= clip.h) return row;
    return row.map((v, ci) => {
      const dc = ci - destCol0;
      if (dc < 0 || dc >= clip.w) return v;
      return Boolean(clip.hits[dr]![dc]);
    });
  });
}

export function labMpcDuplicateRegion(
  pattern: boolean[][],
  region: LabMpcGridRegion,
  colCount: number,
): { pattern: boolean[][]; region: LabMpcGridRegion } | null {
  if (!labMpcRegionHasHits(pattern, region)) return null;
  const clip = labMpcExtractClip(pattern, region);
  const destRow0 = region.row0;
  let destCol =
    labMpcFindEmptyPasteCol(pattern, clip, destRow0, colCount, region.col1 + 1) ??
    (region.col1 + 1 + clip.w <= colCount ? region.col1 + 1 : null);
  if (destCol == null) return null;
  const next = labMpcPasteClip(pattern, clip, destRow0, destCol);
  return {
    pattern: next,
    region: {
      row0: destRow0,
      row1: destRow0 + clip.h - 1,
      col0: destCol,
      col1: destCol + clip.w - 1,
    },
  };
}
