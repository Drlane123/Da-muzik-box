/** App-wide UI brightness (Settings → Lighten / darken). Does not change accents or transport. */

export const UI_BRIGHTNESS_MIN = 0.75;
export const UI_BRIGHTNESS_MAX = 1.35;
export const UI_BRIGHTNESS_STEP = 0.05;
/** Current lightened chrome — Settings default / Reset. */
export const UI_BRIGHTNESS_DEFAULT = 1;

export function clampUiBrightness(n: number): number {
  if (!Number.isFinite(n)) return UI_BRIGHTNESS_DEFAULT;
  const clamped = Math.min(UI_BRIGHTNESS_MAX, Math.max(UI_BRIGHTNESS_MIN, n));
  return Math.round(clamped * 100) / 100;
}

/**
 * Soft brightness on `body` so portaled Settings / menus follow.
 * At 1.0 the filter is cleared (no stacking / fixed-position side effects).
 */
export function applyDocumentUiBrightness(n: number): void {
  const b = clampUiBrightness(n);
  const root = document.documentElement;
  root.style.setProperty('--dmb-ui-brightness', String(b));
  if (Math.abs(b - 1) < 0.001) {
    document.body.style.filter = '';
  } else {
    document.body.style.filter = `brightness(${b})`;
  }
}

export function clearDocumentUiBrightness(): void {
  const root = document.documentElement;
  root.style.removeProperty('--dmb-ui-brightness');
  document.body.style.filter = '';
}
