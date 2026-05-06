import React, { useRef, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/** Top overlay — must stay above normal UI layers. */
const CONTEXT_MENU_Z = 9_999_999;

interface TimelineContextMenuProps {
  contextMenu: { x: number; y: number } | null;
  onClose: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onSplit: () => void;
  onDelete: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canPaste: boolean;
  cutDisabled?: boolean;
  copyDisabled?: boolean;
  duplicateDisabled?: boolean;
  splitDisabled?: boolean;
  deleteDisabled?: boolean;
  undoDisabled?: boolean;
  redoDisabled?: boolean;
  extraItems?: { label: string; action: () => void; shortcut?: string; disabled?: boolean }[];
}

export const TimelineContextMenu: React.FC<TimelineContextMenuProps> = ({
  contextMenu,
  onClose,
  onCut,
  onCopy,
  onPaste,
  onDuplicate,
  onSplit,
  onDelete,
  onUndo,
  onRedo,
  canPaste,
  cutDisabled,
  copyDisabled,
  duplicateDisabled,
  splitDisabled,
  deleteDisabled,
  undoDisabled,
  redoDisabled,
  extraItems = [],
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [placedPos, setPlacedPos] = useState<{ x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    if (!contextMenu) {
      setPlacedPos(null);
      return;
    }
    let raf = 0;
    const place = () => {
      const el = menuRef.current;
      if (!el) return;
      let x = contextMenu.x;
      let y = contextMenu.y;
      const rect = el.getBoundingClientRect();
      const pad = 8;
      const vw = typeof window !== 'undefined' ? window.innerWidth : 1920;
      const vh = typeof window !== 'undefined' ? window.innerHeight : 1080;
      const w = rect.width || 200;
      const h = rect.height || 260;
      if (x + w > vw - pad) x = Math.max(pad, vw - w - pad);
      if (y + h > vh - pad) y = Math.max(pad, vh - h - pad);
      x = Math.max(pad, x);
      y = Math.max(pad, y);
      setPlacedPos({ x, y });
    };
    place();
    raf = requestAnimationFrame(place);
    return () => cancelAnimationFrame(raf);
  }, [contextMenu]);

  /**
   * Outside-dismiss on **capture**: runs before target handlers so we never call `onClose`
   * before a menu row sees the gesture. If the event eventually hits inside the menu,
   * `contains(event.target)` is true — skip close.
   */
  useEffect(() => {
    if (!contextMenu) return;

    const dismissIfOutsideCapture = (e: Event) => {
      const root = menuRef.current;
      if (!root) return;
      const pe = e as PointerEvent;
      const raw = typeof pe.composedPath === 'function' ? pe.composedPath() : [pe.target ?? pe.currentTarget];
      const path = raw.filter((n): n is EventTarget => n != null);
      const inside = path.some((node) => node instanceof Node && root.contains(node));
      if (inside) return;
      onClose();
    };

    const tid = window.setTimeout(() => {
      document.addEventListener('pointerdown', dismissIfOutsideCapture, true);
      document.addEventListener('contextmenu', dismissIfOutsideCapture, true);
    }, 0);

    return () => {
      window.clearTimeout(tid);
      document.removeEventListener('pointerdown', dismissIfOutsideCapture, true);
      document.removeEventListener('contextmenu', dismissIfOutsideCapture, true);
    };
  }, [contextMenu, onClose]);

  if (!contextMenu) return null;

  const leftPx = placedPos?.x ?? contextMenu.x;
  const topPx = placedPos?.y ?? contextMenu.y;

  const menuItems = [
    { label: 'Cut', action: onCut, shortcut: 'Ctrl+X', disabled: cutDisabled ?? false },
    { label: 'Copy', action: onCopy, shortcut: 'Ctrl+C', disabled: copyDisabled ?? false },
    { label: 'Paste', action: onPaste, shortcut: 'Ctrl+V', disabled: !canPaste },
    { label: 'Duplicate', action: onDuplicate, shortcut: 'Ctrl+D', disabled: duplicateDisabled ?? false },
    { label: 'Split', action: onSplit, shortcut: 'Ctrl+E', disabled: splitDisabled ?? false },
    { label: 'Delete', action: onDelete, shortcut: 'Del', disabled: deleteDisabled ?? false },
    { label: 'Undo', action: onUndo, shortcut: 'Ctrl+Z', disabled: undoDisabled ?? false },
    { label: 'Redo', action: onRedo, shortcut: 'Ctrl+Y / Ctrl+Shift+Z', disabled: redoDisabled ?? false },
    ...extraItems.map((i) => ({ label: i.label, action: i.action, shortcut: i.shortcut ?? '', disabled: i.disabled ?? false })),
  ];

  const panel = (
    <div
      ref={menuRef}
      data-timeline-context-menu="1"
      role="menu"
      aria-label="MIDI edit menu"
      className="fixed rounded border py-1 min-w-[200px] select-none"
      style={{
        left: `${leftPx}px`,
        top: `${topPx}px`,
        zIndex: CONTEXT_MENU_Z,
        isolation: 'isolate',
        pointerEvents: 'auto',
        backgroundColor: '#2a2a32',
        borderColor: '#4a4a58',
        boxShadow: '0 12px 40px rgba(0,0,0,0.92), 0 0 0 1px rgba(255,255,255,0.12)',
        opacity: 1,
        color: '#ffffff',
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {menuItems.map((item) => {
        const isOff = item.disabled;
        return (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            aria-disabled={isOff}
            tabIndex={isOff ? -1 : 0}
            onPointerDown={(e) => {
              if (isOff || e.button !== 0) return;
              e.preventDefault();
              e.stopPropagation();
              item.action();
              onClose();
            }}
            onKeyDown={(e) => {
              if (isOff) return;
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              e.stopPropagation();
              item.action();
              onClose();
            }}
            className={`w-full px-4 py-2 text-left text-sm flex justify-between items-center border-none ${
              isOff ? 'cursor-not-allowed' : 'cursor-pointer'
            }`}
            style={{
              background: 'transparent',
              color: isOff ? 'rgba(255,255,255,0.45)' : '#ffffff',
            }}
            onMouseEnter={(e) => {
              if (isOff) return;
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#3d3d48';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
            }}
          >
            <span style={{ color: 'inherit', fontWeight: 600 }}>{item.label}</span>
            <span
              className="text-xs ml-4 tabular-nums shrink-0"
              style={{ color: isOff ? 'rgba(255,255,255,0.4)' : '#ffffff' }}
            >
              {item.shortcut}
            </span>
          </button>
        );
      })}
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(panel, document.body) : null;
};
