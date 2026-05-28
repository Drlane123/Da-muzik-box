/**
 * Bridges touch / pen pointer input to legacy `mouse*` listeners used across the DAW.
 * React `onMouseDown` and `window.addEventListener('mousemove')` do not run on touch
 * without this layer. Mouse and pen pointers are left alone (no double events).
 */

let installed = false;
let activePointerId: number | null = null;

let onPointerDown: ((pe: PointerEvent) => void) | null = null;
let onPointerMove: ((pe: PointerEvent) => void) | null = null;
let onPointerEnd: ((pe: PointerEvent) => void) | null = null;

function synthMouse(type: 'mousedown' | 'mousemove' | 'mouseup', pe: PointerEvent): void {
  const target =
    type === 'mousemove'
      ? (document.elementFromPoint(pe.clientX, pe.clientY) as HTMLElement | null) ??
        document.body
      : (pe.target as HTMLElement | null) ?? document.body;

  target.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX: pe.clientX,
      clientY: pe.clientY,
      screenX: pe.screenX,
      screenY: pe.screenY,
      button: pe.button,
      buttons: pe.buttons,
    }),
  );
}

function clearActive(pe: PointerEvent): void {
  if (activePointerId !== pe.pointerId) return;
  activePointerId = null;
  synthMouse('mouseup', pe);
}

/** Turn the global pointer→mouse bridge on or off (e.g. from Settings → Touch mode). */
export function setTouchPointerBridgeEnabled(enabled: boolean): void {
  if (typeof document === 'undefined') return;
  if (enabled) {
    if (installed) return;
    installed = true;
    onPointerDown = (pe) => {
      if (pe.pointerType === 'mouse') return;
      activePointerId = pe.pointerId;
      synthMouse('mousedown', pe);
    };
    onPointerMove = (pe) => {
      if (pe.pointerType === 'mouse') return;
      if (activePointerId !== pe.pointerId) return;
      synthMouse('mousemove', pe);
    };
    onPointerEnd = (pe) => {
      if (pe.pointerType === 'mouse') return;
      clearActive(pe);
    };
    document.addEventListener('pointerdown', onPointerDown, { passive: false });
    document.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('pointerup', onPointerEnd, { passive: true });
    document.addEventListener('pointercancel', onPointerEnd, { passive: true });
    return;
  }
  if (!installed) return;
  installed = false;
  activePointerId = null;
  if (onPointerDown) document.removeEventListener('pointerdown', onPointerDown);
  if (onPointerMove) document.removeEventListener('pointermove', onPointerMove);
  if (onPointerEnd) {
    document.removeEventListener('pointerup', onPointerEnd);
    document.removeEventListener('pointercancel', onPointerEnd);
  }
  onPointerDown = null;
  onPointerMove = null;
  onPointerEnd = null;
}
