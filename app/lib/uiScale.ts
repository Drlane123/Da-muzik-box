/** App-wide UI scale (laptop fit). Does not change timeline/transport math. */

export type UiScaleMode = 'auto' | 'manual';

export const UI_SCALE_MIN = 0.7;
export const UI_SCALE_MAX = 1;
export const UI_SCALE_STEP = 0.01;

/** Comfortable desktop canvas this DAW was laid out around. */
const REF_WIDTH = 1440;
const REF_HEIGHT = 900;

export function clampUiScale(n: number): number {
  if (!Number.isFinite(n)) return 1;
  const clamped = Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, n));
  return Math.round(clamped * 100) / 100;
}

/**
 * Shrinks the whole UI when the window is smaller than the reference desktop.
 * Large monitors stay at 100%. Different laptop sizes get different fit ratios.
 */
export function computeAutoUiScale(
  width = typeof window !== 'undefined' ? window.innerWidth : REF_WIDTH,
  height = typeof window !== 'undefined' ? window.innerHeight : REF_HEIGHT,
): number {
  const raw = Math.min(width / REF_WIDTH, height / REF_HEIGHT, 1);
  return clampUiScale(raw);
}

export function resolveUiScale(mode: UiScaleMode, manualScale: number): number {
  if (mode === 'manual') return clampUiScale(manualScale);
  return computeAutoUiScale();
}

export function applyDocumentUiScale(scale: number): void {
  const s = clampUiScale(scale);
  const root = document.documentElement;
  root.style.setProperty('--dmb-ui-scale', String(s));
  // Chromium / Edge / Cursor — scales layout + hit targets together (portals included).
  (root.style as CSSStyleDeclaration & { zoom?: string }).zoom = String(s);
}

export function clearDocumentUiScale(): void {
  const root = document.documentElement;
  root.style.removeProperty('--dmb-ui-scale');
  (root.style as CSSStyleDeclaration & { zoom?: string }).zoom = '';
}
