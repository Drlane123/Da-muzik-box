'use client';

import { ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { studioKeyLabel, type StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';
import { NEURAL_HUM_KEY_NAMES } from '@/app/lib/vocalLab/neuralHumKeyLock';

function studioKeyShortLabel(root: number, mode: StudioDetectedKeyMode): string {
  const name = NEURAL_HUM_KEY_NAMES[((Math.round(root) % 12) + 12) % 12] ?? 'C';
  return mode === 'minor' ? `${name}m` : name;
}

export type StudioTrackKeyMenuProps = {
  keyRoot?: number;
  keyMode?: StudioDetectedKeyMode;
  songKeyRoot: number;
  songKeyMode: StudioDetectedKeyMode;
  onDetect: () => void;
  onConvertToSongKey: () => void;
  disabled?: boolean;
  detectDisabled?: boolean;
  convertDisabled?: boolean;
  accentHex?: string;
  compact?: boolean;
  /** Larger legible type for arrange track list (desk viewing distance). */
  trackChannel?: boolean;
  className?: string;
  title?: string;
};

/** Compact track key menu — detected key + convert to song key (matches A2M / kit picker height). */
export function StudioTrackKeyMenu({
  keyRoot,
  keyMode,
  songKeyRoot,
  songKeyMode,
  onDetect,
  onConvertToSongKey,
  disabled = false,
  detectDisabled = false,
  convertDisabled = false,
  accentHex = '#7cf4c6',
  compact = true,
  trackChannel = false,
  className = '',
  title,
}: StudioTrackKeyMenuProps) {
  const triggerFontPx = trackChannel ? 12 : compact ? 7 : 9;
  const triggerPad = trackChannel ? '2px 6px' : compact ? '1px 4px' : '3px 8px';
  const chevronPx = trackChannel ? 10 : compact ? 8 : 11;
  const hasKey = keyRoot != null && keyMode != null;
  const detectedLabel = hasKey ? studioKeyLabel(keyRoot, keyMode) : '—';
  const songLabel = studioKeyLabel(songKeyRoot, songKeyMode);
  const triggerLabel = hasKey ? studioKeyShortLabel(keyRoot!, keyMode!) : 'detect';
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
        const minW = Math.max(r.width, compact ? 156 : 172);
        let left = r.left;
        if (left + minW > vw - 8) left = Math.max(8, vw - minW - 8);
        const spaceAbove = r.top - 8;
        const spaceBelow = vh - r.bottom - 8;
        const maxH = Math.min(200, Math.max(100, spaceAbove >= spaceBelow ? spaceAbove : spaceBelow));
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
        aria-label={title ?? 'Track key'}
        data-studio-track-key-menu
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
          className="px-2 py-1 font-bold uppercase tracking-widest"
          style={{
            fontSize: trackChannel ? 8 : compact ? 7 : 8,
            color: accentHex,
            borderBottom: '1px solid #1e1e28',
            background: '#12121a',
          }}
        >
          Key detect
        </div>
        <div
          className="px-2 py-1.5 font-mono font-bold tabular-nums"
          style={{
            fontSize: trackChannel ? 12 : compact ? 10 : 11,
            color: hasKey ? '#e8e8f0' : '#6a6a78',
            borderBottom: '1px solid #1a1a22',
            background: hasKey ? `${accentHex}08` : 'transparent',
          }}
        >
          {detectedLabel}
        </div>
        <button
          type="button"
          role="menuitem"
          disabled={detectDisabled}
          className="block w-full text-left outline-none disabled:opacity-35"
          style={{
            padding: trackChannel ? '7px 10px' : '6px 10px',
            fontSize: trackChannel ? 10 : 9,
            fontWeight: 600,
            color: '#d4d4e0',
            background: 'transparent',
            borderBottom: '1px solid #1a1a22',
          }}
          onClick={() => {
            onDetect();
            setOpen(false);
          }}
        >
          Detect key
        </button>
        <button
          type="button"
          role="menuitem"
          disabled={convertDisabled}
          className="block w-full text-left outline-none disabled:opacity-35"
          style={{
            padding: trackChannel ? '7px 10px' : '6px 10px',
            fontSize: trackChannel ? 10 : 9,
            fontWeight: 700,
            color: convertDisabled ? '#5a5a68' : accentHex,
            background: convertDisabled ? 'transparent' : `${accentHex}10`,
            borderLeft: convertDisabled ? '2px solid transparent' : `2px solid ${accentHex}`,
          }}
          onClick={() => {
            onConvertToSongKey();
            setOpen(false);
          }}
        >
          Convert to key of song ({songLabel})
        </button>
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
          (hasKey
            ? `Track key: ${detectedLabel}. Song: ${songLabel}.`
            : 'Open key menu — detect key or convert to song key')
        }
        aria-label={title ?? `Track key, ${triggerLabel}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={openMenu}
        onPointerDown={(e) => e.stopPropagation()}
        className={`flex min-w-0 max-w-full items-center justify-between gap-0.5 rounded border font-semibold outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
        style={{
          borderColor: open ? `${accentHex}66` : hasKey ? `${accentHex}44` : '#2a2a36',
          background: open ? `${accentHex}14` : hasKey ? `${accentHex}0c` : '#14141c',
          color: hasKey ? '#ececf4' : '#a8a8b8',
          fontSize: triggerFontPx,
          padding: triggerPad,
          lineHeight: trackChannel ? 1.35 : 1.2,
          fontWeight: trackChannel ? 700 : 600,
          minHeight: trackChannel ? 16 : undefined,
          WebkitFontSmoothing: 'antialiased',
        }}
      >
        <span className={compact ? 'truncate min-w-0' : 'whitespace-nowrap'}>
          {hasKey ? `Key · ${triggerLabel}` : 'Key detect'}
        </span>
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
      </button>
      {menuEl ? createPortal(menuEl, document.body) : null}
    </>
  );
}
