'use client';

import { ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { studioKeyLabel, type StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';
import { NEURAL_HUM_KEY_NAMES } from '@/app/lib/vocalLab/neuralHumKeyLock';
import { SE2_HEADER_PILL_LABEL_COLOR } from '@/app/components/studio/se2HeaderPill';

export type StudioSongKeyControlProps = {
  songKeyRoot: number;
  songKeyMode: StudioDetectedKeyMode;
  onSongKeyChange: (root: number, mode: StudioDetectedKeyMode) => void;
  onConvertToSongKey: () => void;
  convertDisabled?: boolean;
  disabled?: boolean;
  convertTitle?: string;
};

const KEY_OPTIONS = NEURAL_HUM_KEY_NAMES.flatMap((_, root) => [
  { root, mode: 'major' as const },
  { root, mode: 'minor' as const },
]);

/** Song key — same header pill as File menu (Song | key ▼). */
export function StudioSongKeyControl({
  songKeyRoot,
  songKeyMode,
  onSongKeyChange,
  onConvertToSongKey,
  convertDisabled = false,
  disabled = false,
  convertTitle,
}: StudioSongKeyControlProps) {
  const label = studioKeyLabel(songKeyRoot, songKeyMode);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const chevronRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (chevronRef.current?.contains(t) || menuRef.current?.contains(t)) return;
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
      if (!open && chevronRef.current && typeof window !== 'undefined') {
        const r = chevronRef.current.getBoundingClientRect();
        const vw = window.innerWidth;
        const minW = 148;
        let left = r.left;
        if (left + minW > vw - 8) left = Math.max(8, vw - minW - 8);
        const vh = window.innerHeight;
        const spaceBelow = vh - r.bottom - 8;
        setMenuStyle({
          position: 'fixed',
          top: r.bottom + 2,
          left,
          minWidth: minW,
          maxHeight: Math.min(280, spaceBelow),
          zIndex: 30050,
        });
      }
      setOpen((o) => !o);
    },
    [disabled, open],
  );

  const menuEl =
    open && typeof document !== 'undefined' ? (
      <div
        ref={menuRef}
        data-studio-song-key-menu
        data-studio-se2-dropdown
        role="listbox"
        aria-label="Set song key"
        className="rounded border overflow-y-auto shadow-2xl"
        style={{
          ...menuStyle,
          borderColor: '#3a3a4c',
          background: '#0e0e14',
          boxShadow: '0 12px 40px rgba(0,0,0,0.92)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {KEY_OPTIONS.map((opt) => {
          const optLabel = studioKeyLabel(opt.root, opt.mode);
          const selected = songKeyRoot === opt.root && songKeyMode === opt.mode;
          return (
            <button
              key={`${opt.root}-${opt.mode}`}
              type="button"
              role="option"
              aria-selected={selected}
              className="se2-dd-item w-full truncate"
              style={{
                color: selected ? '#7cf4c6' : '#c8c8d4',
                background: selected ? 'rgba(124,244,198,0.12)' : 'transparent',
              }}
              onClick={(ev) => {
                ev.stopPropagation();
                onSongKeyChange(opt.root, opt.mode);
                setOpen(false);
              }}
            >
              {optLabel}
            </button>
          );
        })}
      </div>
    ) : null;

  return (
    <>
      <div
        data-studio-se2-header-pill
        data-studio-se2-song-key-chip
        className="box-border"
        style={{ minWidth: '8.5rem' }}
      >
        <span className="se2-header-pill-label shrink-0" style={{ color: SE2_HEADER_PILL_LABEL_COLOR }}>
          Song
        </span>
        <button
          type="button"
          disabled={disabled || convertDisabled}
          title={
            convertTitle ??
            (convertDisabled
              ? 'Select a melodic MIDI or A2M track with notes'
              : `Convert selected track to song key (${label})`)
          }
          onClick={(e) => {
            e.stopPropagation();
            onConvertToSongKey();
          }}
          className="se2-header-pill-action truncate max-w-[5.5rem] tabular-nums disabled:opacity-35 transition-opacity hover:opacity-90"
          style={{ color: '#7cf4c6' }}
        >
          {label}
        </button>
        <button
          ref={chevronRef}
          type="button"
          disabled={disabled}
          title="Set song key"
          aria-label="Set song key"
          aria-expanded={open}
          onClick={openMenu}
          className="se2-header-pill-action shrink-0 disabled:opacity-35"
          style={{ color: '#8a8a9a', padding: 0 }}
        >
          <ChevronDown size={12} aria-hidden className="opacity-65" />
        </button>
      </div>
      {menuEl ? createPortal(menuEl, document.body) : null}
    </>
  );
}
