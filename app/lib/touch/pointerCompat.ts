/**
 * Helpers for components that should prefer Pointer Events (mouse + touch + pen).
 */

import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';

/** Map a legacy mouse handler so it also runs from `onPointerDown` (touch-safe). */
export function pointerFromMouse<T extends HTMLElement>(
  fn?: (e: ReactMouseEvent<T>) => void,
): ((e: ReactPointerEvent<T>) => void) | undefined {
  if (!fn) return undefined;
  return (pe) => {
    fn(pe as unknown as ReactMouseEvent<T>);
  };
}

/** Attach both pointer + mouse for gradual migration (touch uses pointer; mouse uses either). */
export function pointerMouseHandlers<T extends HTMLElement>(handlers: {
  onMouseDown?: (e: ReactMouseEvent<T>) => void;
  onMouseMove?: (e: ReactMouseEvent<T>) => void;
  onMouseUp?: (e: ReactMouseEvent<T>) => void;
  onClick?: (e: ReactMouseEvent<T>) => void;
}): {
  onPointerDown?: (e: ReactPointerEvent<T>) => void;
  onPointerMove?: (e: ReactPointerEvent<T>) => void;
  onPointerUp?: (e: ReactPointerEvent<T>) => void;
  onMouseDown?: (e: ReactMouseEvent<T>) => void;
  onMouseMove?: (e: ReactMouseEvent<T>) => void;
  onMouseUp?: (e: ReactMouseEvent<T>) => void;
  onClick?: (e: ReactMouseEvent<T>) => void;
} {
  const wrap =
    (fn?: (e: ReactMouseEvent<T>) => void) =>
    (e: ReactPointerEvent<T> | ReactMouseEvent<T>) => {
      if (!fn) return;
      if ('pointerType' in e && e.pointerType === 'mouse') {
        fn(e as ReactMouseEvent<T>);
        return;
      }
      if ('pointerType' in e) {
        fn(e as unknown as ReactMouseEvent<T>);
        return;
      }
      fn(e as ReactMouseEvent<T>);
    };

  return {
    onPointerDown: wrap(handlers.onMouseDown),
    onPointerMove: wrap(handlers.onMouseMove),
    onPointerUp: wrap(handlers.onMouseUp),
    onMouseDown: handlers.onMouseDown,
    onMouseMove: handlers.onMouseMove,
    onMouseUp: handlers.onMouseUp,
    onClick: handlers.onClick,
  };
}

/** Inline style for surfaces that drag (faders, trim, resize) — prevents browser scroll takeover. */
export const TOUCH_DRAG_SURFACE_STYLE = {
  touchAction: 'none' as const,
};
