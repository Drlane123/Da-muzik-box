/**
 * Map screen pointer → fret cell (strict — only the neck / string band).
 */
import {
  SE2_GUITAR_SVG_H,
  SE2_GUITAR_SVG_W,
  se2GuitarFretFromLayerY,
  se2GuitarNeckRelToCell,
  se2GuitarRootSvgPointToCell,
  se2GuitarRootToLayerLocal,
} from '@/app/lib/studio/se2GuitarFretboard';

/** Client coords → root SVG viewBox units (0…W, 0…H). */
export function se2GuitarSvgClientToRoot(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } | null {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const local = pt.matrixTransform(ctm.inverse());
  if (!Number.isFinite(local.x) || !Number.isFinite(local.y)) return null;
  return { x: local.x, y: local.y };
}

/** Pointer on overlay SVG → string + fret. */
export function se2GuitarSvgElPointToCell(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): { stringIndex: number; fret: number } | null {
  const root = se2GuitarSvgClientToRoot(svg, clientX, clientY);
  if (!root) return null;
  return se2GuitarRootSvgPointToCell(root.x, root.y);
}

/** Pointer on a specific string line → fret from Y only (most reliable). */
export function se2GuitarSvgStringPointToCell(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
  stringIndex: number,
): { stringIndex: number; fret: number } | null {
  const root = se2GuitarSvgClientToRoot(svg, clientX, clientY);
  if (!root) return null;
  const layer = se2GuitarRootToLayerLocal(root.x, root.y);
  return { stringIndex, fret: se2GuitarFretFromLayerY(layer.y) };
}

export function se2GuitarClientToSvgRoot(
  el: HTMLElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } | null {
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;

  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const style = getComputedStyle(el);
  const matrix = style.transform !== 'none' ? new DOMMatrix(style.transform) : new DOMMatrix();
  const inv = matrix.inverse();
  const p = new DOMPoint(clientX - cx, clientY - cy).matrixTransform(inv);
  const localX = p.x + rect.width / 2;
  const localY = p.y + rect.height / 2;

  if (localX < 0 || localY < 0 || localX > rect.width || localY > rect.height) return null;

  return {
    x: (localX / rect.width) * SE2_GUITAR_SVG_W,
    y: (localY / rect.height) * SE2_GUITAR_SVG_H,
  };
}

/** Pointer on the dedicated neck hit element (0–1 local, no clamping). */
export function se2GuitarNeckHitRelToCell(
  hitEl: HTMLElement,
  clientX: number,
  clientY: number,
): { stringIndex: number; fret: number } | null {
  const rect = hitEl.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  const relX = (clientX - rect.left) / rect.width;
  const relY = (clientY - rect.top) / rect.height;
  return se2GuitarNeckRelToCell(relX, relY);
}

/** Fallback — full rot host with strict neck bounds (no edge clamping). */
export function se2GuitarPointerToCell(
  el: HTMLElement,
  clientX: number,
  clientY: number,
): { stringIndex: number; fret: number } | null {
  const pt = se2GuitarClientToSvgRoot(el, clientX, clientY);
  if (!pt) return null;
  return se2GuitarRootSvgPointToCell(pt.x, pt.y);
}
