'use client';

import { ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { studioKeyLabel, type StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';
import { NEURAL_HUM_KEY_NAMES } from '@/app/lib/vocalLab/neuralHumKeyLock';

export type StudioTrackKeyValue = {
  root: number;
  mode: StudioDetectedKeyMode;
};

export type StudioTrackKeyPickerProps = {
  value: StudioTrackKeyValue | undefined;
  onChange: (root: number, mode: StudioDetectedKeyMode) => void;
  disabled?: boolean;
  accentHex?: string;
  compact?: boolean;
  placeholder?: string;
  title?: string;
  className?: string;
};

const KEY_OPTIONS: StudioTrackKeyValue[] = NEURAL_HUM_KEY_NAMES.flatMap((_, root) => [
  { root, mode: 'major' },
  { root, mode: 'minor' },
]);

export function StudioTrackKeyPicker({
  value,
  onChange,
  disabled = false,
  accentHex = '#7cf4c6',
  compact = false,
  placeholder = 'Set key',
  title,
  className = '',
}: StudioTrackKeyPickerProps) {
  const display =
    value != null ? studioKeyLabel(value.root, value.mode) : placeholder;
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
        const minW = Math.max(r.width, compact ? 148 : 168);
        let left = r.left;
        if (left + minW > vw - 8) left = Math.max(8, vw - minW - 8);
        const spaceAbove = r.top - 8;
        const spaceBelow = vh - r.bottom - 8;
        const maxH = Math.min(320, Math.max(120, spaceAbove >= spaceBelow ? spaceAbove : spaceBelow));
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
        aria-label={title ?? 'Choose key'}
        data-studio-track-key-popover
        className="rounded border overflow-y-auto overflow-x-hidden shadow-2xl"
        style={{
          ...menuStyle,
          borderColor: '#3a3a4c',
          background: '#0e0e14',
          boxShadow: '0 12px 40px rgba(0,0,0,0.92), 0 0 0 1px rgba(255,255,255,0.05)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {KEY_OPTIONS.map((opt) => {
          const label = studioKeyLabel(opt.root, opt.mode);
          const selected = value?.root === opt.root && value?.mode === opt.mode;
          return (
            <button
              key={`${opt.root}-${opt.mode}`}
              type="button"
              role="option"
              aria-selected={selected}
              className="w-full text-left px-2 py-1 text-[9px] font-medium truncate transition-colors"
              style={{
                color: selected ? accentHex : '#c8c8d4',
                background: selected ? `${accentHex}18` : 'transparent',
              }}
              onClick={(ev) => {
                ev.stopPropagation();
                onChange(opt.root, opt.mode);
                setOpen(false);
              }}
            >
              {label}
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
        title={title ?? (value ? `Track key: ${display}` : 'Import / set track key')}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={openMenu}
        className={`inline-flex items-center gap-0.5 rounded border font-semibold truncate transition-all active:scale-[0.98] disabled:opacity-40 ${
          compact ? 'max-w-full px-1 py-0 text-[7px]' : 'px-2 py-0.5 text-[8px]'
        } ${className}`}
        style={{
          borderColor: value ? `${accentHex}55` : '#2a2a36',
          background: value ? `${accentHex}12` : '#14141c',
          color: value ? '#d8d8e8' : '#7a7a8a',
        }}
      >
        <span className="truncate min-w-0">{display}</span>
        <ChevronDown size={compact ? 8 : 10} className="shrink-0 opacity-70" aria-hidden />
      </button>
      {menuEl ? createPortal(menuEl, document.body) : null}
    </>
  );
}
