/**
 * Touch / stylus device detection and Settings-driven touch mode for Da Music Box.
 */

export type TouchInputMode = 'auto' | 'on' | 'off';

const TOUCH_CLASS = 'touch-coarse';

export function isTouchLikeDevice(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia('(pointer: coarse)').matches) return true;
    if (window.matchMedia('(hover: none)').matches) return true;
  } catch {
    /* ignore */
  }
  const nav = navigator as Navigator & { msMaxTouchPoints?: number };
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    (nav.msMaxTouchPoints ?? 0) > 0
  );
}

/** Whether touch CSS + pointer bridge should be active for the given setting. */
export function touchOptimizationsActive(mode: TouchInputMode): boolean {
  if (mode === 'on') return true;
  if (mode === 'off') return false;
  return isTouchLikeDevice();
}

export function applyTouchDeviceHtmlClass(mode: TouchInputMode): () => void {
  if (typeof document === 'undefined') return () => {};
  const root = document.documentElement;
  const apply = () => {
    if (touchOptimizationsActive(mode)) root.classList.add(TOUCH_CLASS);
    else root.classList.remove(TOUCH_CLASS);
  };
  apply();
  let mq: MediaQueryList | null = null;
  try {
    mq = window.matchMedia('(pointer: coarse)');
    const onChange = () => apply();
    mq.addEventListener('change', onChange);
    return () => {
      mq?.removeEventListener('change', onChange);
      root.classList.remove(TOUCH_CLASS);
    };
  } catch {
    return () => root.classList.remove(TOUCH_CLASS);
  }
}
