/**
 * Map a pointer X to a uniform grid column using the element's *rendered* width.
 * Prefer this over a hard-coded column width so scrub lands under the cursor
 * under browser zoom / subpixel layout.
 */
export function gridColFromClientX(
  clientX: number,
  el: HTMLElement | null | undefined,
  cols: number,
): number {
  if (!el || cols <= 0) return 0;
  const rect = el.getBoundingClientRect();
  if (!(rect.width > 0)) return 0;
  const cellW = rect.width / cols;
  const col = Math.floor((clientX - rect.left) / cellW);
  return Math.max(0, Math.min(cols - 1, col));
}

/**
 * Same as {@link gridColFromClientX}, but the scrub region starts after a fixed
 * left gutter (e.g. piano / lane labels) measured in the element's layout px.
 */
export function gridColFromClientXWithGutter(
  clientX: number,
  el: HTMLElement | null | undefined,
  cols: number,
  gutterLayoutPx: number,
  contentLayoutPx: number,
): number {
  if (!el || cols <= 0) return 0;
  const rect = el.getBoundingClientRect();
  if (!(rect.width > 0) || !(contentLayoutPx > 0)) return 0;
  const layoutTotal = Math.max(1, gutterLayoutPx + contentLayoutPx);
  const scale = rect.width / layoutTotal;
  const xLayout = (clientX - rect.left) / scale - gutterLayoutPx;
  const cellW = contentLayoutPx / cols;
  const col = Math.floor(xLayout / cellW);
  return Math.max(0, Math.min(cols - 1, col));
}
