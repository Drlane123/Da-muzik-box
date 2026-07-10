'use client';

import { ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import {
  studioMidiInstrumentLabel,
  studioMidiInstrumentsGrouped,
  studioMidiInstrumentsGroupedForDrumTrack,
  studioNormalizeMidiInstrumentId,
  studioNormalizeMidiInstrumentIdForDrumTrack,
} from '@/app/lib/studio/studioEditor2Instruments';

export type StudioMidiInstrumentPickerProps = {
  value: string | undefined;
  onChange: (instrumentId: string) => void;
  disabled?: boolean;
  /** Track accent for selected row highlight. */
  accentHex?: string;
  /** Tighter layout for arrange track list vs mixer strip. */
  compact?: boolean;
  /** Drum lanes: drum kits + 808 sub only. */
  drumTrack?: boolean;
  title?: string;
  className?: string;
};

export function StudioMidiInstrumentPicker({
  value,
  onChange,
  disabled = false,
  accentHex = '#7cf4c6',
  compact = false,
  drumTrack = false,
  title,
  className = '',
}: StudioMidiInstrumentPickerProps) {
  const normalized = drumTrack
    ? studioNormalizeMidiInstrumentIdForDrumTrack(value)
    : studioNormalizeMidiInstrumentId(value);
  const display = studioMidiInstrumentLabel(normalized);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const groups = drumTrack ? studioMidiInstrumentsGroupedForDrumTrack() : studioMidiInstrumentsGrouped();

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
        const minW = Math.max(r.width, compact ? 168 : 200);
        let left = r.left;
        if (left + minW > vw - 8) left = Math.max(8, vw - minW - 8);
        const spaceAbove = r.top - 8;
        const spaceBelow = vh - r.bottom - 8;
        const maxH = Math.min(360, Math.max(120, spaceAbove >= spaceBelow ? spaceAbove : spaceBelow));
        const style: CSSProperties =
          spaceAbove >= spaceBelow
            ? { position: 'fixed', bottom: vh - r.top + 2, left, minWidth: minW, maxHeight: maxH, zIndex: 30050 }
            : { position: 'fixed', top: r.bottom + 2, left, minWidth: minW, maxHeight: maxH, zIndex: 30050 };
        setMenuStyle(style);
      }
      setOpen((o) => !o);
    },
    [compact, disabled, open],
  );

  const menuEl =
    open && typeof document !== 'undefined' ? (
      <div
        ref={menuRef}
        role="listbox"
        aria-label={title ?? 'Choose instrument'}
        data-studio-midi-instrument-popover
        className="rounded border overflow-y-auto overflow-x-hidden shadow-2xl"
        style={{
          ...menuStyle,
          borderColor: '#3a3a4c',
          background: '#0e0e14',
          boxShadow: '0 12px 40px rgba(0,0,0,0.92), 0 0 0 1px rgba(255,255,255,0.05)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {groups.map((cat) => (
          <div key={cat.category}>
            <div
              className="sticky top-0 z-[1] px-2 py-1 text-[8px] font-bold uppercase tracking-widest"
              style={{
                color: '#7cf4c6',
                background: 'linear-gradient(180deg, #12121a 0%, #0e0e14 100%)',
                borderBottom: '1px solid #1e1e28',
              }}
            >
              {cat.label}
            </div>
            {cat.subgroups.map((sg) => (
              <div key={`${cat.category}-${sg.subgroup}`}>
                <div
                  className="px-2 pt-1 pb-0.5 text-[7px] font-semibold uppercase tracking-wide"
                  style={{ color: '#5a5a6a' }}
                >
                  {sg.subgroup}
                </div>
                {sg.options.map((opt) => {
                  const sel = opt.id === normalized;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="option"
                      aria-selected={sel}
                      className="block w-full text-left outline-none truncate"
                      style={{
                        padding: compact ? '3px 8px' : '6px 12px',
                        fontSize: compact ? 8 : 10,
                        fontWeight: sel ? 700 : 600,
                        color: sel ? accentHex : '#c8c8d8',
                        background: sel ? `${accentHex}14` : 'transparent',
                        borderLeft: sel ? `2px solid ${accentHex}` : '2px solid transparent',
                      }}
                      title={opt.label}
                      onClick={() => {
                        onChange(opt.id);
                        setOpen(false);
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
    ) : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        data-studio-midi-instrument-trigger
        title={title ?? `Instrument: ${display}`}
        aria-label={title ?? `Choose instrument, current ${display}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={openMenu}
        onPointerDown={(e) => e.stopPropagation()}
        className={`se2-type-micro flex min-w-0 max-w-full items-center justify-between gap-0.5 rounded border outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
        style={{
          borderColor: open ? '#4a4a58' : '#2a2a36',
          background: open ? '#1a1a24' : 'rgba(0,0,0,0.22)',
          color: '#b8b8cc',
          fontSize: compact ? 7.5 : 8,
          padding: compact ? '2px 5px' : '2px 6px',
          lineHeight: 1.2,
        }}
      >
        <span className="truncate min-w-0">{display}</span>
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
