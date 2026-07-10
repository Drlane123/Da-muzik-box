'use client';

import { ChevronUp } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type Se2ChordGeneratorUpSelectOption = {
  value: string;
  label: string;
};

export type Se2ChordGeneratorUpSelectProps = {
  id?: string;
  label: string;
  value: string;
  options: readonly Se2ChordGeneratorUpSelectOption[];
  disabled?: boolean;
  onChange: (value: string) => void;
  accentHex?: string;
  minWidthPx?: number;
  alignRight?: boolean;
  /** Hide the built-in label row (parent supplies header). */
  hideLabel?: boolean;
  /** Trigger button height — default 28; SE2 header passes 24 for compact column. */
  controlHeight?: number;
};

const ITEM_H = 26;
const MENU_PAD = 4;
const GAP_PX = 4;
const VIEWPORT_PAD = 8;
const DEFAULT_CONTROL_H = 28;
/** Matches SE2 Chord Generator header panel surface. */
const PANEL_SURFACE = '#080c14';
const PANEL_SURFACE_OPEN = '#101828';

export function Se2ChordGeneratorUpSelect({
  id,
  label,
  value,
  options,
  disabled = false,
  onChange,
  accentHex = '#7cf4c6',
  minWidthPx = 200,
  alignRight = false,
  hideLabel = false,
  controlHeight = DEFAULT_CONTROL_H,
}: Se2ChordGeneratorUpSelectProps) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const current = options.find((o) => o.value === value);
  const currentLabel = current?.label ?? '—';

  const reposition = useCallback(() => {
    const el = buttonRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const spaceAbove = Math.max(80, r.top - VIEWPORT_PAD);
    const idealH = options.length * ITEM_H + MENU_PAD * 2;
    const maxHeight = Math.min(idealH, spaceAbove);
    const top = Math.max(VIEWPORT_PAD, r.top - maxHeight - GAP_PX);
    const width = Math.max(minWidthPx, r.width);
    const left = alignRight ? r.right - width : r.left;
    setMenuStyle({
      top,
      left,
      width,
      maxHeight,
    });
  }, [alignRight, minWidthPx, options.length]);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
  }, [open, reposition, options.length, value]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => reposition();
    const onResize = () => reposition();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    const dismiss = (e: Event) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (buttonRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', dismiss, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', dismiss, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const menu =
    open && menuStyle && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            id={id ? `${id}-listbox` : undefined}
            role="listbox"
            className="fixed z-[99999] rounded border overflow-y-auto overscroll-contain shadow-lg"
            style={{
              top: menuStyle.top,
              left: menuStyle.left,
              width: menuStyle.width,
              maxHeight: menuStyle.maxHeight,
              borderColor: 'rgba(77,168,255,0.22)',
              background: PANEL_SURFACE,
              boxShadow: '0 -8px 32px rgba(0,0,0,0.55)',
            }}
          >
            {options.map((o) => {
              const sel = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={sel}
                  title={o.label}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className="w-full text-left px-2.5 border-none cursor-pointer truncate"
                  style={{
                    height: ITEM_H,
                    fontSize: 11,
                    fontWeight: sel ? 700 : 500,
                    color: sel ? accentHex : '#d8e0ec',
                    background: sel ? 'rgba(77,168,255,0.14)' : 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (!sel) e.currentTarget.style.background = 'rgba(77,168,255,0.08)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = sel ? 'rgba(77,168,255,0.14)' : 'transparent';
                  }}
                >
                  {o.label}
                </button>
              );
            })}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="w-full min-w-0" style={{ minWidth: minWidthPx }}>
      {!hideLabel ? (
        <span
          className="block text-[9px] font-bold uppercase tracking-wider mb-0.5"
          style={{ color: accentHex }}
        >
          {label}
        </span>
      ) : null}
      <button
        ref={buttonRef}
        id={id}
        type="button"
        disabled={disabled || options.length === 0}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 rounded border px-2 py-1 text-left outline-none disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          height: controlHeight,
          borderColor: open ? `${accentHex}66` : 'rgba(77,168,255,0.22)',
          background: open ? PANEL_SURFACE_OPEN : PANEL_SURFACE,
          color: '#ececf4',
          fontSize: 10,
          fontWeight: 600,
        }}
      >
        <span className="truncate flex-1">{currentLabel}</span>
        <ChevronUp
          size={12}
          aria-hidden
          style={{
            flexShrink: 0,
            color: open ? accentHex : '#8a8a98',
            transform: open ? 'rotate(0deg)' : 'rotate(180deg)',
            transition: 'transform 120ms ease',
          }}
        />
      </button>
      {menu}
    </div>
  );
}
