/** App-wide UI scale (fills window vs desktop canvas). Does not change timeline/transport math. */

export type UiScaleMode = 'auto' | 'manual';

/** Floor low enough for phone landscape / small laptops against the desktop reference. */
export const UI_SCALE_MIN = 0.28;
export const UI_SCALE_MAX = 1;
export const UI_SCALE_STEP = 0.01;

/** Comfortable desktop canvas this DAW was laid out around. */
const REF_WIDTH = 1440;
const REF_HEIGHT = 900;

/**
 * Phone handset detection (not tablets).
 * Short side ≤520 and long side ≤950 — iPad portrait (~768) stays tablet.
 */
const PHONE_SHORT_MAX = 520;
const PHONE_LONG_MAX = 950;

export function clampUiScale(n: number): number {
  if (!Number.isFinite(n)) return 1;
  const clamped = Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, n));
  return Math.round(clamped * 100) / 100;
}

export function readViewportSize(
  width?: number,
  height?: number,
): { width: number; height: number } {
  if (typeof width === 'number' && typeof height === 'number') {
    return { width, height };
  }
  if (typeof window === 'undefined') {
    return { width: REF_WIDTH, height: REF_HEIGHT };
  }

  // Layout viewport tracks orientation reliably. visualViewport often lags after
  // rotate (Facebook / iOS WebViews) and can leave the UI stuck in portrait size.
  const layoutW = Math.max(1, window.innerWidth || document.documentElement.clientWidth || REF_WIDTH);
  const layoutH = Math.max(1, window.innerHeight || document.documentElement.clientHeight || REF_HEIGHT);
  const vv = window.visualViewport;
  if (vv && vv.width > 0 && vv.height > 0) {
    const wRatio = vv.width / layoutW;
    const hRatio = vv.height / layoutH;
    const agrees =
      wRatio > 0.85 && wRatio < 1.15 && hRatio > 0.7 && hRatio < 1.15;
    if (agrees) {
      return { width: vv.width, height: vv.height };
    }
  }
  return { width: layoutW, height: layoutH };
}

/** True for phone-sized handsets (portrait or landscape). Tablets/desktops = false. */
export function isPhoneHandsetViewport(width: number, height: number): boolean {
  const shortSide = Math.min(width, height);
  const longSide = Math.max(width, height);
  return shortSide <= PHONE_SHORT_MAX && longSide <= PHONE_LONG_MAX;
}

/** Phone standing tall — soft rotate tip only (does not lock the UI). */
export function isPhonePortraitViewport(width: number, height: number): boolean {
  return isPhoneHandsetViewport(width, height) && height > width;
}

/**
 * Shrinks the whole UI when the window is smaller than the reference desktop.
 * Large monitors stay at 100%. Phones (any orientation), tablets, and laptops get a fit ratio.
 */
export function computeAutoUiScale(
  width?: number,
  height?: number,
): number {
  const vp = readViewportSize(width, height);
  const raw = Math.min(vp.width / REF_WIDTH, vp.height / REF_HEIGHT, 1);
  return clampUiScale(raw);
}

export function resolveUiScale(mode: UiScaleMode, manualScale: number): number {
  if (mode === 'manual') return clampUiScale(manualScale);
  return computeAutoUiScale();
}

/**
 * `zoom` on <html> shrinks paint size but leaves blank bands under/ beside the shell
 * (modules looked “half height” on laptops). Expand logical width/height by 1/scale
 * so after zoom the app still fills the viewport.
 *
 * Phones: shell height follows visualViewport (not 100dvh). Mobile browser chrome makes
 * 100dvh taller than the visible area, which clipped the Beat Lab GRID bottom.
 */
export function applyDocumentUiScale(scale: number): void {
  const s = clampUiScale(scale);
  const root = document.documentElement;
  const body = document.body;
  const vp = readViewportSize();
  const phonePortrait = isPhonePortraitViewport(vp.width, vp.height);
  const phoneHandset = isPhoneHandsetViewport(vp.width, vp.height);

  root.style.setProperty('--dmb-ui-scale', String(s));
  root.dataset.dmbPhoneUi = phonePortrait ? 'portrait' : '0';
  root.dataset.dmbPhoneLandscape = phoneHandset && !phonePortrait ? '1' : '0';
  root.dataset.dmbPhoneHandset = phoneHandset ? '1' : '0';

  // Chromium / Edge / Cursor — scales layout + hit targets together (portals included).
  (root.style as CSSStyleDeclaration & { zoom?: string }).zoom = String(s);

  if (s < 0.999) {
    const inv = 1 / s;
    if (phoneHandset) {
      // Explicit px after rotate — `100vw`/`100dvh` + zoom often stay on portrait sizes in WebViews.
      const shellW = Math.max(1, Math.round(vp.width * inv));
      const shellH = Math.max(1, Math.round(vp.height * inv));
      root.style.setProperty('--dmb-ui-shell-w', `${shellW}px`);
      root.style.setProperty('--dmb-ui-shell-h', `${shellH}px`);
      root.style.width = `${shellW}px`;
      root.style.minHeight = `${shellH}px`;
      root.style.height = `${shellH}px`;
    } else {
      root.style.setProperty('--dmb-ui-shell-w', `calc(100vw * ${inv})`);
      root.style.setProperty('--dmb-ui-shell-h', `calc(100dvh * ${inv})`);
      root.style.width = `calc(100vw * ${inv})`;
      root.style.minHeight = `calc(100dvh * ${inv})`;
      root.style.height = `calc(100dvh * ${inv})`;
    }
    root.style.overflow = 'hidden';
  } else {
    root.style.setProperty('--dmb-ui-shell-w', '100%');
    root.style.setProperty('--dmb-ui-shell-h', '100dvh');
    root.style.removeProperty('width');
    root.style.removeProperty('min-height');
    root.style.removeProperty('height');
    root.style.removeProperty('overflow');
    root.style.removeProperty('overflow-x');
    root.style.removeProperty('overflow-y');
  }

  if (body) {
    body.style.removeProperty('width');
    body.style.removeProperty('min-height');
    body.style.removeProperty('height');
    body.style.removeProperty('overflow');
    body.style.removeProperty('overflow-x');
    body.style.removeProperty('overflow-y');
  }
}

export function clearDocumentUiScale(): void {
  const root = document.documentElement;
  const body = document.body;
  root.style.removeProperty('--dmb-ui-scale');
  root.style.removeProperty('--dmb-ui-shell-w');
  root.style.removeProperty('--dmb-ui-shell-h');
  root.style.removeProperty('width');
  root.style.removeProperty('min-height');
  root.style.removeProperty('height');
  root.style.removeProperty('overflow');
  root.style.removeProperty('overflow-x');
  root.style.removeProperty('overflow-y');
  delete root.dataset.dmbPhoneUi;
  delete root.dataset.dmbPhoneLandscape;
  delete root.dataset.dmbPhoneHandset;
  (root.style as CSSStyleDeclaration & { zoom?: string }).zoom = '';
  if (body) {
    body.style.removeProperty('width');
    body.style.removeProperty('min-height');
    body.style.removeProperty('height');
    body.style.removeProperty('overflow');
    body.style.removeProperty('overflow-x');
    body.style.removeProperty('overflow-y');
  }
}
