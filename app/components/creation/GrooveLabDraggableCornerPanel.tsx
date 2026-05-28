import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { GripHorizontal } from 'lucide-react';

type PanelPos = { left: number; top: number };

function readStoredPos(key: string): PanelPos | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PanelPos>;
    if (typeof parsed.left === 'number' && typeof parsed.top === 'number') {
      return { left: parsed.left, top: parsed.top };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function clampPos(
  pos: PanelPos,
  boundsW: number,
  boundsH: number,
  panelW: number,
  panelH: number,
): PanelPos {
  const maxLeft = Math.max(0, boundsW - panelW);
  const maxTop = Math.max(0, boundsH - panelH);
  return {
    left: Math.min(maxLeft, Math.max(0, pos.left)),
    top: Math.min(maxTop, Math.max(0, pos.top)),
  };
}

function defaultPos(
  boundsW: number,
  boundsH: number,
  panelW: number,
  panelH: number,
  defaultRight: number,
  defaultBottom: number,
): PanelPos {
  return clampPos(
    {
      left: boundsW - panelW - defaultRight,
      top: boundsH - panelH - defaultBottom,
    },
    boundsW,
    boundsH,
    panelW,
    panelH,
  );
}

export interface GrooveLabDraggableCornerPanelProps {
  boundsRef: RefObject<HTMLElement | null>;
  storageKey: string;
  defaultRight?: number;
  defaultBottom?: number;
  children: ReactNode;
  style?: CSSProperties;
  /** Skip outer panel chrome — child supplies its own (e.g. transport controls). */
  bare?: boolean;
  dragTitle?: string;
  /** Lock position — hide grip / disable drag; same placement math as draggable mode. */
  embedded?: boolean;
}

export function GrooveLabDraggableCornerPanel({
  boundsRef,
  storageKey,
  defaultRight = 10,
  defaultBottom = 78,
  children,
  style,
  bare = false,
  dragTitle = 'Drag to move panel',
  embedded = false,
}: GrooveLabDraggableCornerPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<PanelPos | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; origin: PanelPos } | null>(null);

  const measureAndPlace = useCallback(() => {
    const bounds = boundsRef.current;
    const panel = panelRef.current;
    if (!bounds || !panel) return;
    const boundsW = bounds.clientWidth;
    const boundsH = bounds.clientHeight;
    const panelW = panel.offsetWidth;
    const panelH = panel.offsetHeight;
    const stored = readStoredPos(storageKey);
    const next = clampPos(
      stored ?? defaultPos(boundsW, boundsH, panelW, panelH, defaultRight, defaultBottom),
      boundsW,
      boundsH,
      panelW,
      panelH,
    );
    setPos(next);
  }, [boundsRef, storageKey, defaultRight, defaultBottom]);

  useLayoutEffect(() => {
    measureAndPlace();
  }, [measureAndPlace]);

  useEffect(() => {
    const bounds = boundsRef.current;
    if (!bounds) return;
    const ro = new ResizeObserver(() => measureAndPlace());
    ro.observe(bounds);
    return () => ro.disconnect();
  }, [boundsRef, measureAndPlace]);

  const persistPos = useCallback(
    (next: PanelPos) => {
      setPos(next);
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    [storageKey],
  );

  const onHandlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (embedded || e.button !== 0 || !pos) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origin: pos };
    setDragging(true);
  };

  const onHandlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const bounds = boundsRef.current;
    const panel = panelRef.current;
    if (!drag || !bounds || !panel) return;
    const boundsW = bounds.clientWidth;
    const boundsH = bounds.clientHeight;
    const panelW = panel.offsetWidth;
    const panelH = panel.offsetHeight;
    const next = clampPos(
      {
        left: drag.origin.left + (e.clientX - drag.startX),
        top: drag.origin.top + (e.clientY - drag.startY),
      },
      boundsW,
      boundsH,
      panelW,
      panelH,
    );
    setPos(next);
  };

  const onHandlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const bounds = boundsRef.current;
    const panel = panelRef.current;
    if (drag && bounds && panel) {
      const next = clampPos(
        {
          left: drag.origin.left + (e.clientX - drag.startX),
          top: drag.origin.top + (e.clientY - drag.startY),
        },
        bounds.clientWidth,
        bounds.clientHeight,
        panel.offsetWidth,
        panel.offsetHeight,
      );
      persistPos(next);
    }
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragRef.current = null;
    setDragging(false);
  };

  const chrome: CSSProperties = {
    position: 'absolute',
    left: pos?.left ?? -9999,
    top: pos?.top ?? -9999,
    visibility: pos ? 'visible' : 'hidden',
    zIndex: 5,
    padding: bare ? 0 : '3px 6px 4px',
    borderRadius: bare ? 0 : 6,
    background: bare ? 'transparent' : 'rgba(5, 8, 5, 0.92)',
    border: bare ? 'none' : embedded || !dragging ? '1px solid #1f3a29' : '1px solid #4ade80',
    boxShadow: bare
      ? 'none'
      : embedded || !dragging
        ? '0 4px 14px rgba(0,0,0,0.45)'
        : '0 6px 20px rgba(74, 222, 128, 0.25)',
    touchAction: embedded ? 'auto' : 'none',
    display: 'flex',
    flexDirection: 'column',
    alignItems: bare ? 'flex-end' : 'stretch',
    gap: bare ? 2 : 0,
    ...style,
  };

  const gripBarStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    marginBottom: bare ? 0 : 2,
    padding: bare ? '0 4px' : '1px 0 2px',
    borderRadius: 3,
    userSelect: 'none',
    alignSelf: bare ? 'center' : 'stretch',
  };

  return (
    <div ref={panelRef} style={chrome}>
      {embedded ? (
        <div aria-hidden style={{ ...gripBarStyle, visibility: 'hidden', pointerEvents: 'none' }}>
          <GripHorizontal size={12} strokeWidth={2.5} />
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          aria-label={dragTitle}
          title={dragTitle}
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerUp}
          style={{
            ...gripBarStyle,
            cursor: dragging ? 'grabbing' : 'grab',
            color: dragging ? '#86efac' : '#4b5563',
          }}
        >
          <GripHorizontal size={12} strokeWidth={2.5} />
        </div>
      )}
      {children}
    </div>
  );
}
