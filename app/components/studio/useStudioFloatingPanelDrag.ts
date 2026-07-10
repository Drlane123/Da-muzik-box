'use client';

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';

export type StudioFloatingPanelPos = { top: number; left: number };

export function clampStudioFloatingPanelPos(
  pos: StudioFloatingPanelPos,
  panelW: number,
  panelH: number,
  viewportPad = 8,
): StudioFloatingPanelPos {
  const maxLeft = Math.max(viewportPad, window.innerWidth - panelW - viewportPad);
  const maxTop = Math.max(viewportPad, window.innerHeight - panelH - viewportPad);
  return {
    left: Math.min(maxLeft, Math.max(viewportPad, pos.left)),
    top: Math.min(maxTop, Math.max(viewportPad, pos.top)),
  };
}

const DRAG_EXCLUDE = 'button, a, input, select, textarea, [data-no-drag]';

function isDragExcludedTarget(target: EventTarget | null): boolean {
  return Boolean((target as HTMLElement | null)?.closest?.(DRAG_EXCLUDE));
}

export function useStudioFloatingPanelDrag({
  open,
  resolveInitialPos,
  panelRef,
  viewportPad = 8,
}: {
  open: boolean;
  resolveInitialPos: () => StudioFloatingPanelPos;
  panelRef: RefObject<HTMLElement | null>;
  viewportPad?: number;
}) {
  const [pos, setPos] = useState<StudioFloatingPanelPos>({ top: 80, left: 80 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; origin: StudioFloatingPanelPos } | null>(null);
  const resolveInitialPosRef = useRef(resolveInitialPos);
  resolveInitialPosRef.current = resolveInitialPos;

  useLayoutEffect(() => {
    if (!open) return;
    const initial = resolveInitialPosRef.current();
    const panel = panelRef.current;
    setPos(
      panel
        ? clampStudioFloatingPanelPos(initial, panel.offsetWidth, panel.offsetHeight, viewportPad)
        : initial,
    );
  }, [open, panelRef, viewportPad]);

  const commitDrag = useCallback(
    (clientX: number, clientY: number) => {
      const drag = dragRef.current;
      const panel = panelRef.current;
      if (!drag || !panel) return;
      setPos(
        clampStudioFloatingPanelPos(
          {
            left: drag.origin.left + (clientX - drag.startX),
            top: drag.origin.top + (clientY - drag.startY),
          },
          panel.offsetWidth,
          panel.offsetHeight,
          viewportPad,
        ),
      );
    },
    [panelRef, viewportPad],
  );

  const onDragPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (e.button !== 0 || isDragExcludedTarget(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = { startX: e.clientX, startY: e.clientY, origin: pos };
      setDragging(true);
    },
    [pos],
  );

  const onDragPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (!dragRef.current) return;
      commitDrag(e.clientX, e.clientY);
    },
    [commitDrag],
  );

  const onDragPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (dragRef.current) commitDrag(e.clientX, e.clientY);
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      dragRef.current = null;
      setDragging(false);
    },
    [commitDrag],
  );

  const dragHandleProps = {
    onPointerDown: onDragPointerDown,
    onPointerMove: onDragPointerMove,
    onPointerUp: onDragPointerUp,
    onPointerCancel: onDragPointerUp,
    style: {
      cursor: dragging ? ('grabbing' as const) : ('grab' as const),
      touchAction: 'none' as const,
    },
  };

  return { pos, dragging, dragHandleProps };
}
