'use client';

import { ChevronDown } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

const POPOVER_Z = 30080;
const POPOVER_GAP = 10;

export function useStudioFxPopover(options?: {
  preferAbove?: boolean;
  /** Fixed menu width (px). Default: max(trigger width, 168). */
  menuWidth?: number;
  /** When false, menu height fits content — no scroll cap (compact pickers). */
  scrollable?: boolean;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});

  const openMenu = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!open && btnRef.current && typeof window !== 'undefined') {
        const r = btnRef.current.getBoundingClientRect();
        const w = options?.menuWidth ?? Math.max(r.width, 168);
        let left = r.left;
        if (left + w > window.innerWidth - 8) left = Math.max(8, window.innerWidth - w - 8);
        const below = window.innerHeight - r.bottom - 8;
        const above = r.top - 8;
        const openAbove =
          options?.preferAbove !== undefined ? options.preferAbove : below < above;
        const base: CSSProperties = { position: 'fixed', left, width: w, zIndex: POPOVER_Z };
        if (options?.scrollable === false) {
          setMenuStyle(
            openAbove
              ? { ...base, bottom: window.innerHeight - r.top + POPOVER_GAP }
              : { ...base, top: r.bottom + POPOVER_GAP },
          );
        } else {
          const maxH = Math.min(360, Math.max(120, openAbove ? above : below));
          setMenuStyle(
            openAbove
              ? { ...base, bottom: window.innerHeight - r.top + POPOVER_GAP, maxHeight: maxH }
              : { ...base, top: r.bottom + POPOVER_GAP, maxHeight: maxH },
          );
        }
      }
      setOpen((v) => !v);
    },
    [open, options?.menuWidth, options?.preferAbove, options?.scrollable],
  );

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if ((t as Element).closest?.('[data-studio-fx-popover-menu]')) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return { btnRef, open, setOpen, menuStyle, openMenu };
}

export function StudioFxPopoverMenu({
  open,
  menuStyle,
  title,
  accent,
  children,
  dataTestId,
  hideTitle = false,
  compact = false,
}: {
  open: boolean;
  menuStyle: CSSProperties;
  title: string;
  accent: string;
  children: ReactNode;
  dataTestId?: string;
  hideTitle?: boolean;
  compact?: boolean;
}) {
  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div
      data-studio-fx-popover-menu
      data-testid={dataTestId}
      className={`rounded border shadow-2xl ${compact ? 'overflow-hidden' : 'overflow-y-auto overscroll-contain'}`}
      style={{
        ...menuStyle,
        borderColor: '#3a3a4c',
        background: '#0e0e14',
        boxShadow: '0 12px 40px rgba(0,0,0,0.92)',
      }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {!hideTitle ? (
        <div
          className="sticky top-0 px-2 py-1 text-[7px] font-bold uppercase tracking-widest"
          style={{ color: accent, borderBottom: '1px solid #1e1e28', background: '#12121a' }}
        >
          {title}
        </div>
      ) : null}
      <div className={compact ? 'p-1' : 'p-2.5'}>{children}</div>
    </div>,
    document.body,
  );
}

export function StudioCompactFxTrigger({
  btnRef,
  label,
  value,
  accent,
  open,
  active,
  disabled,
  title,
  onClick,
}: {
  btnRef: React.RefObject<HTMLButtonElement | null>;
  label: string;
  value: string;
  accent: string;
  open: boolean;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  onClick: (e: React.MouseEvent) => void;
}) {
  const lit = Boolean(active) || open;
  return (
    <button
      ref={btnRef}
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      className="flex min-w-0 w-full flex-col items-start rounded border px-2 py-1.5 text-left transition-all disabled:opacity-40"
      style={{
        borderColor: lit ? `${accent}88` : '#262632',
        background: active
          ? `linear-gradient(145deg, ${accent}22 0%, ${accent}0c 42%, #0a0a10 100%)`
          : open
            ? `${accent}12`
            : '#0a0a10',
        boxShadow: active ? `0 0 16px ${accent}38, inset 0 1px 0 rgba(255,255,255,0.06)` : undefined,
      }}
    >
      <span className="flex w-full items-center justify-between gap-1">
        <span className="suite-type-label text-[5px] leading-none" style={{ color: lit ? accent : '#6a6a78' }}>
          {label}
        </span>
        {active && !disabled ? (
          <span
            className="suite-type-micro shrink-0 rounded-full px-1 py-px text-[4px]"
            style={{ background: `${accent}28`, color: accent, border: `1px solid ${accent}55` }}
          >
            ACTIVE
          </span>
        ) : null}
      </span>
      <span className="flex w-full items-center justify-between gap-0.5 mt-0.5 min-w-0">
        <span
          className="suite-type-micro text-[5px] truncate leading-tight"
          style={{ color: lit ? accent : '#c8c8d8', textTransform: 'none', letterSpacing: '0.02em' }}
        >
          {value}
        </span>
        <ChevronDown size={9} style={{ color: lit ? accent : '#5a5a68', flexShrink: 0, transform: open ? 'rotate(180deg)' : undefined, opacity: lit ? 0.9 : 0.7 }} aria-hidden />
      </span>
    </button>
  );
}
