'use client';

import { ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import {
  STUDIO_A2M_MODE_LABELS,
  STUDIO_A2M_MODE_ORDER,
  studioNormalizeA2mMode,
  type StudioA2mMode,
} from '@/app/lib/studio/studioEditor2AudioToMidi';

export type StudioAudioToMidiModePickerProps = {
  value: StudioA2mMode | string | undefined;
  onChange: (mode: StudioA2mMode) => void;
  disabled?: boolean;
  accentHex?: string;
  compact?: boolean;
  title?: string;
  className?: string;
};

export function StudioAudioToMidiModePicker({
  value,
  onChange,
  disabled = false,
  accentHex = '#FFB84D',
  compact = false,
  title,
  className = '',
}: StudioAudioToMidiModePickerProps) {
  const mode = studioNormalizeA2mMode(typeof value === 'string' ? value : undefined);
  const display = STUDIO_A2M_MODE_LABELS[mode];
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handler, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', handler, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openMenu = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (disabled) return;
      if (!open && btnRef.current && typeof window !== 'undefined') {
        const r = btnRef.current.getBoundingClientRect();
        const vh = window.innerHeight;
        const vw = window.innerWidth;
        const minW = Math.max(r.width, 148);
        let left = r.left;
        if (left + minW > vw - 8) left = Math.max(8, vw - minW - 8);
        const spaceAbove = r.top - 8;
        const spaceBelow = vh - r.bottom - 8;
        const maxH = Math.min(220, Math.max(100, spaceAbove >= spaceBelow ? spaceAbove : spaceBelow));
        const style: CSSProperties =
          spaceAbove >= spaceBelow
            ? { position: 'fixed', bottom: vh - r.top + 2, left, minWidth: minW, maxHeight: maxH, zIndex: 30050 }
            : { position: 'fixed', top: r.bottom + 2, left, minWidth: minW, maxHeight: maxH, zIndex: 30050 };
        setMenuStyle(style);
      }
      setOpen((o) => !o);
    },
    [disabled, open],
  );

  const menuEl =
    open && typeof document !== 'undefined' ? (
      <div
        ref={menuRef}
        role="listbox"
        aria-label={title ?? 'Audio to MIDI mode'}
        data-studio-a2m-mode-popover
        className="rounded border overflow-hidden shadow-2xl"
        style={{
          ...menuStyle,
          borderColor: '#3a3a4c',
          background: '#0e0e14',
          boxShadow: '0 12px 40px rgba(0,0,0,0.92), 0 0 0 1px rgba(255,255,255,0.05)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-2 py-1 text-[7px] font-bold uppercase tracking-widest"
          style={{ color: '#FFB84D', borderBottom: '1px solid #1e1e28', background: '#12121a' }}
        >
          Audio → MIDI
        </div>
        <p
          className="px-2 py-1 text-[7px] leading-snug"
          style={{ color: '#5a5a6a', borderBottom: '1px solid #1a1a22' }}
        >
          Clip only — not full-song separation
        </p>
        {STUDIO_A2M_MODE_ORDER.map((opt) => {
          const sel = opt === mode;
          return (
            <button
              key={opt}
              type="button"
              role="option"
              aria-selected={sel}
              className="block w-full text-left outline-none"
              style={{
                padding: compact ? '6px 10px' : '7px 12px',
                fontSize: compact ? 9 : 10,
                fontWeight: sel ? 700 : 600,
                color: sel ? accentHex : '#c8c8d8',
                background: sel ? `${accentHex}14` : 'transparent',
                borderLeft: sel ? `2px solid ${accentHex}` : '2px solid transparent',
              }}
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
            >
              {STUDIO_A2M_MODE_LABELS[opt]}
            </button>
          );
        })}
      </div>
    ) : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        data-studio-a2m-mode-trigger
        title={title ?? `Convert mode: ${display}`}
        aria-label={title ?? `Audio to MIDI mode, ${display}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={openMenu}
        onPointerDown={(e) => e.stopPropagation()}
        className={`se2-type-micro flex min-w-0 max-w-full items-center justify-between gap-0.5 rounded border outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
        style={{
          borderColor: open ? '#5a4a28' : '#3a3020',
          background: open ? '#1a1610' : 'rgba(255,184,77,0.08)',
          color: '#e8c890',
          fontSize: compact ? 7 : 8,
          padding: compact ? '1px 4px' : '2px 6px',
          lineHeight: 1.2,
        }}
      >
        <span className="truncate min-w-0">A2M · {display}</span>
        <ChevronDown
          size={compact ? 8 : 10}
          strokeWidth={2.5}
          className="shrink-0 opacity-70"
          aria-hidden
          style={{
            transform: open ? 'rotate(180deg)' : undefined,
            transition: 'transform 0.12s ease',
          }}
        />
      </button>
      {menuEl ? createPortal(menuEl, document.body) : null}
    </>
  );
}
