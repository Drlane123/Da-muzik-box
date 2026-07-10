'use client';

import { ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { DA_MUSIC_BOX_SONG_EXTENSION } from '@/app/lib/studio/se2SongFile';

export type StudioSe2SongFileControlsProps = {
  songName: string;
  fileLabel?: string;
  lastSavedLabel?: string;
  busy?: boolean;
  disabled?: boolean;
  onSaveSong: () => void;
  onSaveSongAs: () => void;
  onOpenSong: () => void;
};

const boxStyle = {
  borderColor: '#2a2a34',
  background: 'linear-gradient(180deg, #101018 0%, #0a0a10 100%)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.55)',
} as const;

/** Save / Save As / Open — Da Music Box .dmbox song files. */
export function StudioSe2SongFileControls({
  songName,
  fileLabel,
  lastSavedLabel,
  busy = false,
  disabled = false,
  onSaveSong,
  onSaveSongAs,
  onOpenSong,
}: StudioSe2SongFileControlsProps) {
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
      if (disabled || busy) return;
      if (!open && chevronRef.current && typeof window !== 'undefined') {
        const r = chevronRef.current.getBoundingClientRect();
        const vw = window.innerWidth;
        const minW = 220;
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
    [busy, disabled, open],
  );

  const run = (fn: () => void) => {
    fn();
    setOpen(false);
  };

  const menuEl =
    open && typeof document !== 'undefined' ? (
      <div
        ref={menuRef}
        data-studio-se2-song-menu
        className="rounded border overflow-hidden shadow-2xl flex flex-col"
        style={{
          ...menuStyle,
          borderColor: '#3a3a4c',
          background: '#0e0e14',
          boxShadow: '0 12px 40px rgba(0,0,0,0.92)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-2 py-1.5 border-b" style={{ borderColor: '#2a2a34' }}>
          <p className="se2-type-label text-[8px] m-0" style={{ color: '#8a8a98' }}>
            Da Music Box song
          </p>
          <p className="text-[8px] se2-type-value tabular-nums m-0 mt-0.5 truncate" style={{ color: '#c8c8d4' }}>
            {fileLabel ?? `${songName}${DA_MUSIC_BOX_SONG_EXTENSION}`}
          </p>
          {lastSavedLabel ? (
            <p className="text-[7px] m-0 mt-0.5" style={{ color: '#6a6a78' }}>
              {lastSavedLabel}
            </p>
          ) : null}
        </div>
        <div className="py-0.5">
          <button
            type="button"
            disabled={busy}
            className="se2-type-micro block w-full text-left px-2 py-1.5 text-[9px] disabled:opacity-40"
            style={{ color: '#c8c8d4', background: 'transparent', border: 'none' }}
            onClick={() => run(onSaveSong)}
          >
            Save song
          </button>
          <button
            type="button"
            disabled={busy}
            className="se2-type-micro block w-full text-left px-2 py-1.5 text-[9px] disabled:opacity-40"
            style={{ color: '#c8c8d4', background: 'transparent', border: 'none' }}
            onClick={() => run(onSaveSongAs)}
          >
            Save song as…
          </button>
          <button
            type="button"
            disabled={busy}
            className="se2-type-micro block w-full text-left px-2 py-1.5 text-[9px] disabled:opacity-40"
            style={{ color: '#c8c8d4', background: 'transparent', border: 'none' }}
            onClick={() => run(onOpenSong)}
          >
            Open song…
          </button>
        </div>
        <p className="px-2 py-1 text-[7px] m-0 border-t" style={{ color: '#5a5a68', borderColor: '#2a2a34' }}>
          {DA_MUSIC_BOX_SONG_EXTENSION} · auto-save + pick folder on Save As
        </p>
      </div>
    ) : null;

  return (
    <div
      data-studio-se2-header-chip
      className="flex flex-col items-center justify-center shrink-0 h-9 rounded-md border px-1 box-border"
      style={{ ...boxStyle, minWidth: '4.5rem' }}
    >
      <span className="se2-type-label text-[7px] leading-none" style={{ color: '#6a6a78' }}>
        Song file
      </span>
      <div className="flex items-center gap-0 min-w-0">
        <button
          type="button"
          disabled={disabled || busy}
          title={fileLabel ? `Save ${fileLabel}` : 'Save Da Music Box song (.dmbox)'}
          onClick={(e) => {
            e.stopPropagation();
            onSaveSong();
          }}
          className="se2-type-micro text-[9px] leading-none px-0.5 truncate max-w-[4rem] disabled:opacity-35 transition-opacity hover:opacity-90"
          style={{ color: '#e8b84d', background: 'transparent', border: 'none' }}
        >
          {busy ? '…' : 'Save'}
        </button>
        <button
          ref={chevronRef}
          type="button"
          disabled={disabled || busy}
          title="Save as or open song file"
          aria-label="Song file menu"
          aria-expanded={open}
          onClick={openMenu}
          className="shrink-0 p-0.5 rounded disabled:opacity-35"
          style={{ color: '#8a8a9a', background: 'transparent', border: 'none' }}
        >
          <ChevronDown size={10} aria-hidden />
        </button>
      </div>
      {menuEl ? createPortal(menuEl, document.body) : null}
    </div>
  );
}
