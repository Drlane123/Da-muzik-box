'use client';

import { ChevronDown, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import {
  studioGeneratePartLabel,
  type StudioGeneratePartKind,
} from '@/app/lib/studio/studioEditor2PartGenerator';

export type StudioTrackGenerateMenuProps = {
  onGenerate: (kind: StudioGeneratePartKind, replaceInPlace: boolean) => void;
  disabled?: boolean;
  hasNotes?: boolean;
  accentHex?: string;
  trackChannel?: boolean;
  /** Icon-only square trigger (track list right rail). */
  iconOnly?: boolean;
  className?: string;
  title?: string;
};

const NEW_TRACK_KINDS: StudioGeneratePartKind[] = ['melody', 'bass', 'chords'];

/** Compact generate menu — new lane below or regenerate current. */
export function StudioTrackGenerateMenu({
  onGenerate,
  disabled = false,
  hasNotes = false,
  accentHex = '#c8a8ff',
  trackChannel = false,
  iconOnly = false,
  className = '',
  title,
}: StudioTrackGenerateMenuProps) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerFontPx = trackChannel ? 9 : 7;
  const triggerPad = iconOnly ? 0 : trackChannel ? '2px 6px' : '1px 4px';
  const chevronPx = trackChannel ? 10 : 8;
  const iconPx = trackChannel ? 11 : 10;

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
        const minW = Math.max(r.width, 168);
        let left = r.left;
        if (left + minW > vw - 8) left = Math.max(8, vw - minW - 8);
        const spaceAbove = r.top - 8;
        const spaceBelow = vh - r.bottom - 8;
        const maxH = Math.min(240, Math.max(120, spaceAbove >= spaceBelow ? spaceAbove : spaceBelow));
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
        role="menu"
        aria-label={title ?? 'Generate parts'}
        data-studio-track-generate-menu
        className="rounded border overflow-hidden shadow-2xl"
        style={{
          ...menuStyle,
          borderColor: '#3a3a4c',
          background: '#0e0e14',
          boxShadow: '0 12px 40px rgba(0,0,0,0.92)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-2 py-1 font-bold uppercase tracking-widest"
          style={{
            fontSize: trackChannel ? 8 : 7,
            color: accentHex,
            borderBottom: '1px solid #1e1e28',
            background: '#12121a',
          }}
        >
          Generate
        </div>
        <p
          className="px-2 py-1.5"
          style={{
            fontSize: trackChannel ? 8 : 7,
            color: '#c9a86a',
            lineHeight: 1.4,
            fontWeight: 600,
            borderBottom: '1px solid #1a1a22',
            margin: 0,
          }}
        >
          Not Progression+ chords — use <strong style={{ color: '#86efac' }}>Progression+</strong> on this track to build
          a chord timeline, then APPLY TO INSTRUMENT.
        </p>
        {hasNotes ? (
          <button
            type="button"
            role="menuitem"
            className="block w-full text-left outline-none"
            style={{
              padding: trackChannel ? '7px 10px' : '6px 10px',
              fontSize: trackChannel ? 10 : 9,
              fontWeight: 600,
              color: '#d8d8e8',
              background: 'transparent',
              borderBottom: '1px solid #1a1a22',
            }}
            onClick={() => {
              onGenerate('melody', true);
              setOpen(false);
            }}
          >
            Regenerate this lane
          </button>
        ) : null}
        <div
          className="px-2 py-0.5 text-[7px] uppercase tracking-wide"
          style={{ color: '#5a5a6a', borderBottom: hasNotes ? '1px solid #1a1a22' : undefined }}
        >
          New track below
        </div>
        {NEW_TRACK_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            role="menuitem"
            className="block w-full text-left outline-none"
            style={{
              padding: trackChannel ? '7px 10px' : '6px 10px',
              fontSize: trackChannel ? 10 : 9,
              fontWeight: 600,
              color: '#c8c8d8',
              background: 'transparent',
              borderLeft: '2px solid transparent',
            }}
            onClick={() => {
              onGenerate(kind, false);
              setOpen(false);
            }}
          >
            + {studioGeneratePartLabel(kind)}
          </button>
        ))}
      </div>
    ) : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        title={
          title ??
          'Generate melody, bass, or companion MIDI from notes on this lane — for chord progressions use Progression+'
        }
        aria-label="Generate"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={openMenu}
        onPointerDown={(e) => e.stopPropagation()}
        data-studio-track-generate-trigger
        className={`flex shrink-0 items-center justify-center rounded border font-semibold outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          iconOnly ? '' : 'min-w-0 max-w-full justify-between gap-0.5'
        } ${className}`}
        style={{
          borderColor: open ? `${accentHex}66` : '#3a3048',
          background: open ? `${accentHex}14` : 'rgba(200,168,255,0.08)',
          color: accentHex,
          fontSize: triggerFontPx,
          padding: triggerPad,
          lineHeight: trackChannel ? 1.35 : 1.2,
          fontWeight: trackChannel ? 700 : 600,
          width: iconOnly ? 20 : undefined,
          height: iconOnly ? 20 : undefined,
          minHeight: iconOnly ? 20 : trackChannel ? 16 : undefined,
          WebkitFontSmoothing: 'antialiased',
        }}
      >
        {iconOnly ? (
          <Sparkles size={iconPx} strokeWidth={2.2} aria-hidden />
        ) : (
          <>
            <span className="truncate min-w-0">Gen</span>
            <ChevronDown
              size={chevronPx}
              strokeWidth={2.5}
              className="shrink-0 opacity-70"
              aria-hidden
              style={{
                transform: open ? 'rotate(180deg)' : undefined,
                transition: 'transform 0.12s ease',
              }}
            />
          </>
        )}
      </button>
      {menuEl ? createPortal(menuEl, document.body) : null}
    </>
  );
}
