'use client';

import { ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';

import {
  PIANO_ROLL_DRUM_CATALOG,
  pianoRollDrumPresetById,
  studioDrumPresetsForCategory,
  type PianoRollDrumCategory,
  type PianoRollDrumPreset,
} from '@/app/lib/studio/studioEditor2DrumPatterns';

function shortPatternLabel(preset: PianoRollDrumPreset | undefined): string {
  if (!preset) return 'Pattern';
  const parts = preset.name.split('·').map((s) => s.trim()).filter(Boolean);
  const tail = parts[parts.length - 1];
  if (tail && tail.length <= 18) return tail;
  return preset.name.length > 16 ? `${preset.name.slice(0, 14)}…` : preset.name;
}

export type StudioDrumPatternMenuProps = {
  selectedPresetId?: string;
  onSelectPreset: (preset: PianoRollDrumPreset) => void;
  disabled?: boolean;
  accentHex?: string;
  compact?: boolean;
  trackChannel?: boolean;
  /** Fixed width for Drum Generator strip (matches Pick Lane control). */
  triggerWidthPx?: number;
  triggerFontPx?: number;
  className?: string;
  title?: string;
};

/** Drum channel pattern picker — all 50 Trap + R&B grids from Piano Roll modules. */
export function StudioDrumPatternMenu({
  selectedPresetId,
  onSelectPreset,
  disabled = false,
  accentHex = '#ffb84d',
  compact = true,
  trackChannel = false,
  triggerWidthPx,
  triggerFontPx: triggerFontPxProp,
  className = '',
  title,
}: StudioDrumPatternMenuProps) {
  const activePreset = useMemo(
    () => (selectedPresetId ? pianoRollDrumPresetById(selectedPresetId) : undefined),
    [selectedPresetId],
  );
  const [category, setCategory] = useState<PianoRollDrumCategory>(activePreset?.category ?? 'Trap');
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const stripSlot = triggerWidthPx != null;
  const triggerFontPx = triggerFontPxProp ?? (trackChannel ? 12 : compact ? 7 : 8);
  const triggerPad = stripSlot ? '4px 8px' : trackChannel ? '2px 6px' : compact ? '1px 4px' : '2px 6px';
  const chevronPx = stripSlot ? 12 : trackChannel ? 10 : compact ? 8 : 10;
  const bankPresets = studioDrumPresetsForCategory(category);
  const triggerLabel = shortPatternLabel(activePreset);

  useEffect(() => {
    if (activePreset) setCategory(activePreset.category);
  }, [activePreset]);

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
    const tid = window.setTimeout(() => {
      document.addEventListener('mousedown', handler, true);
      document.addEventListener('keydown', onKey);
    }, 0);
    return () => {
      window.clearTimeout(tid);
      document.removeEventListener('mousedown', handler, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openMenu = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      if (disabled) return;
      if (!open && typeof window !== 'undefined') {
        const r = e.currentTarget.getBoundingClientRect();
        const vh = window.innerHeight;
        const vw = window.innerWidth;
        const minW = Math.max(r.width, 220);
        let left = r.left;
        if (left + minW > vw - 8) left = Math.max(8, vw - minW - 8);
        const spaceAbove = r.top - 8;
        const spaceBelow = vh - r.bottom - 8;
        const maxH = Math.min(320, Math.max(160, spaceAbove >= spaceBelow ? spaceAbove : spaceBelow));
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
        aria-label={title ?? 'Drum patterns'}
        data-studio-drum-pattern-menu
        className="rounded border overflow-hidden shadow-2xl flex flex-col"
        style={{
          ...menuStyle,
          borderColor: '#3a3a4c',
          background: '#0e0e14',
          boxShadow: '0 12px 40px rgba(0,0,0,0.92), 0 0 0 1px rgba(255,255,255,0.05)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-2 py-1 font-bold uppercase tracking-widest shrink-0"
          style={{
            fontSize: trackChannel ? 8 : 7,
            color: accentHex,
            borderBottom: '1px solid #1e1e28',
            background: '#12121a',
          }}
        >
          Drum patterns · {PIANO_ROLL_DRUM_CATALOG.length}
        </div>
        <div
          className="flex shrink-0 gap-1 px-2 py-1.5"
          style={{ borderBottom: '1px solid #1a1a22', background: '#101018' }}
        >
          {(['Trap', 'R&B'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className="flex-1 rounded border font-bold uppercase tracking-wide"
              style={{
                fontSize: trackChannel ? 9 : 8,
                padding: '4px 6px',
                borderColor: category === cat ? `${accentHex}66` : '#2a2a36',
                background: category === cat ? `${accentHex}18` : '#14141c',
                color: category === cat ? accentHex : '#8a8a98',
              }}
            >
              {cat}
              <span className="ml-1 opacity-70 tabular-nums">
                ({studioDrumPresetsForCategory(cat).length})
              </span>
            </button>
          ))}
        </div>
        <div className="overflow-y-auto min-h-0 flex-1">
          {bankPresets.map((preset) => {
            const selected = preset.id === activePreset?.id;
            return (
              <button
                key={preset.id}
                type="button"
                role="menuitem"
                title={preset.desc ?? preset.name}
                className="block w-full text-left outline-none"
                style={{
                  padding: trackChannel ? '7px 10px' : '6px 10px',
                  fontSize: trackChannel ? 10 : 9,
                  fontWeight: selected ? 700 : 600,
                  color: selected ? '#f0f0f8' : '#c8c8d4',
                  background: selected ? `${accentHex}16` : 'transparent',
                  borderLeft: selected ? `2px solid ${accentHex}` : '2px solid transparent',
                  borderBottom: '1px solid #14141c',
                }}
                onClick={() => {
                  onSelectPreset(preset);
                  setOpen(false);
                }}
              >
                {preset.name}
              </button>
            );
          })}
        </div>
      </div>
    ) : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        data-studio-drum-pattern-trigger
        title={
          title ??
          `Load a Trap or R&B drum pattern (${PIANO_ROLL_DRUM_CATALOG.length} presets from Piano Roll)`
        }
        aria-label={title ?? `Drum pattern, ${triggerLabel}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={openMenu}
        onPointerDown={(e) => e.stopPropagation()}
        className={`se2-type-micro flex min-w-0 max-w-full items-center justify-between gap-0.5 rounded border outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
        style={{
          borderColor: open ? `${accentHex}66` : activePreset ? `${accentHex}44` : '#2a2a36',
          background: open ? `${accentHex}14` : activePreset ? `${accentHex}0c` : '#14141c',
          color: activePreset ? '#ececf4' : '#a8a8b8',
          fontSize: triggerFontPx,
          padding: triggerPad,
          lineHeight: stripSlot ? 1.35 : trackChannel ? 1.35 : 1.2,
          fontWeight: stripSlot || trackChannel ? 700 : 600,
          minHeight: trackChannel ? 16 : undefined,
          width: triggerWidthPx,
          flexShrink: stripSlot ? 0 : undefined,
          WebkitFontSmoothing: 'antialiased',
        }}
      >
        <span className="truncate min-w-0">
          {stripSlot ? (activePreset ? triggerLabel : 'Drum pat') : `Pat · ${triggerLabel}`}
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
