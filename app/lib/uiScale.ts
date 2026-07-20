/** App-wide UI scale (fills window vs desktop canvas). Does not change timeline/transport math. */

export type UiScaleMode = 'auto' | 'manual';

/** Floor low enough for phones (~390px) against the desktop reference canvas. */
export const UI_SCALE_MIN = 0.28;
export const UI_SCALE_MAX = 1;
export const UI_SCALE_STEP = 0.01;

/** Comfortable desktop canvas this DAW was laid out around. */
const REF_WIDTH = 1440;
const REF_HEIGHT = 900;

/**
 * Narrower phone canvas → larger auto zoom so the UI fills more of a tall phone
 * instead of sitting tiny at the top. Desktop / tablet keep REF_WIDTH.
 */
const PHONE_REF_WIDTH = 980;
const PHONE_MAX_WIDTH = 600;

export function clampUiScale(n: number): number {
  if (!Number.isFinite(n)) return 1;
  const clamped = Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, n));
  return Math.round(clamped * 100) / 100;
}

function readViewportSize(
  width?: number,
  height?: number,
): { width: number; height: number } {
  if (typeof width === 'number' && typeof height === 'number') {
    return { width, height };
  }
  if (typeof window === 'undefined') {
    return { width: REF_WIDTH, height: REF_HEIGHT };
  }
  const vv = window.visualViewport;
  if (vv && vv.width > 0 && vv.height > 0) {
    return { width: vv.width, height: vv.height };
  }
  return { width: window.innerWidth, height: window.innerHeight };
}

/** Portrait phone — tall + narrow. Landscape phones / tablets use desktop fit. */
export function isPhonePortraitViewport(width: number, height: number): boolean {
  return width <= PHONE_MAX_WIDTH && height > width;
}

/**
 * Shrinks the whole UI when the window is smaller than the reference desktop.
 * Large monitors stay at 100%. Phones get a taller fit (larger zoom) so the
 * shell uses more vertical space without changing tablet/desktop math.
 */
export function computeAutoUiScale(
  width?: number,
  height?: number,
): number {
  const vp = readViewportSize(width, height);
  if (isPhonePortraitViewport(vp.width, vp.height)) {
    // Width still limits (no side crop), but against a phone-sized canvas so
    // zoom lands ~35–42% on typical handsets instead of ~28%.
    const raw = Math.min(vp.width / PHONE_REF_WIDTH, vp.height / REF_HEIGHT, 1);
    return clampUiScale(raw);
  }
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
 * Portrait phones only: shell is taller than one screen + overflow-y scroll so you
 * can move the UI up/down. Tablets/desktop stay locked edge-to-edge (no page scroll).
 */
export function applyDocumentUiScale(scale: number): void {
  const s = clampUiScale(scale);
  const root = document.documentElement;
  const body = document.body;
  const vp = readViewportSize();
  const phone = isPhonePortraitViewport(vp.width, vp.height);
  root.style.setProperty('--dmb-ui-scale', String(s));
  root.dataset.dmbPhoneUi = phone ? '1' : '0';
  // Chromium / Edge / Cursor — scales layout + hit targets together (portals included).
  (root.style as CSSStyleDeclaration & { zoom?: string }).zoom = String(s);

  if (s < 0.999) {
    const inv = 1 / s;
    root.style.setProperty('--dmb-ui-shell-w', `calc(100vw * ${inv})`);

    if (phone) {
      // Taller than one phone screen after zoom → vertical page scroll (phones only).
      const phoneShellH = Math.ceil(vp.height * inv * 1.28);
      root.style.setProperty('--dmb-ui-shell-h', `${phoneShellH}px`);
      root.style.width = `calc(100vw * ${inv})`;
      root.style.minHeight = `${phoneShellH}px`;
      root.style.height = 'auto';
      root.style.overflowX = 'hidden';
      root.style.overflowY = 'auto';
      if (body) {
        body.style.width = `calc(100vw * ${inv})`;
        body.style.minHeight = `${phoneShellH}px`;
        body.style.height = 'auto';
        body.style.overflowX = 'hidden';
        body.style.overflowY = 'auto';
      }
    } else {
      root.style.setProperty('--dmb-ui-shell-h', `calc(100dvh * ${inv})`);
      root.style.width = `calc(100vw * ${inv})`;
      root.style.minHeight = `calc(100dvh * ${inv})`;
      root.style.height = `calc(100dvh * ${inv})`;
      root.style.overflow = 'hidden';
      if (body) {
        body.style.removeProperty('width');
        body.style.removeProperty('min-height');
        body.style.removeProperty('height');
        body.style.removeProperty('overflow');
        body.style.removeProperty('overflow-x');
        body.style.removeProperty('overflow-y');
      }
    }
  } else {
    root.style.setProperty('--dmb-ui-shell-w', '100%');
    root.style.setProperty('--dmb-ui-shell-h', '100dvh');
    root.style.removeProperty('width');
    root.style.removeProperty('min-height');
    root.style.removeProperty('height');
    root.style.removeProperty('overflow');
    root.style.removeProperty('overflow-x');
    root.style.removeProperty('overflow-y');
    if (body) {
      body.style.removeProperty('width');
      body.style.removeProperty('min-height');
      body.style.removeProperty('height');
      body.style.removeProperty('overflow');
      body.style.removeProperty('overflow-x');
      body.style.removeProperty('overflow-y');
    }
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
