'use client';

import { ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export type StudioConsolidateTrackOption = {
  trackIndex: number;
  label: string;
  clipCount: number;
  canConsolidate: boolean;
};

export type StudioNormalizeConsolidateControlsProps = {
  normalizeDisabled?: boolean;
  normalizeTitle?: string;
  consolidateTracks: StudioConsolidateTrackOption[];
  consolidateBusy?: boolean;
  maxBars?: number;
  bpm?: number;
  beatsPerBar?: number;
  startBar: number;
  endBar: number;
  rangeLabel?: string;
  rangeValid?: boolean;
  disabled?: boolean;
  onStartBarChange: (bar: number) => void;
  onEndBarChange: (bar: number) => void;
  onEndBarFromMinutes: (minutes: number) => void;
  onNormalize: () => void;
  onConsolidate: (trackIndices: number[], startBar: number, endBar: number) => void;
};

const boxStyle = {
  borderColor: '#2a2a34',
  background: 'linear-gradient(180deg, #101018 0%, #0a0a10 100%)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.55)',
} as const;

function HeaderChip({
  caption,
  children,
  minW = '4.75rem',
}: {
  caption: string;
  children: ReactNode;
  minW?: string;
}) {
  return (
    <div
      data-studio-se2-header-chip
      className="flex flex-col items-center justify-center shrink-0 h-9 rounded-md border px-1 box-border"
      style={{ ...boxStyle, minWidth: minW }}
    >
      <span className="se2-type-label text-[7px] leading-none" style={{ color: '#6a6a78' }}>
        {caption}
      </span>
      {children}
    </div>
  );
}

const inputClass =
  'se2-type-value w-11 text-center text-[9px] tabular-nums leading-none rounded border px-0.5 py-0.5 bg-transparent outline-none';

/** Peak-normalize + multi-track consolidate — sits beside Song key in the SE2 header. */
export function StudioNormalizeConsolidateControls({
  normalizeDisabled = false,
  normalizeTitle = 'Normalize selected audio — boost quiet waveforms to peak level',
  consolidateTracks,
  consolidateBusy = false,
  maxBars = 1800,
  bpm = 120,
  beatsPerBar = 4,
  startBar,
  endBar,
  rangeLabel = '',
  rangeValid = false,
  disabled = false,
  onStartBarChange,
  onEndBarChange,
  onEndBarFromMinutes,
  onNormalize,
  onConsolidate,
}: StudioNormalizeConsolidateControlsProps) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const [picked, setPicked] = useState<Set<number>>(() => new Set());
  const chevronRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const consolidatable = consolidateTracks.filter((t) => t.canConsolidate);

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
      if (disabled || consolidateBusy) return;
      if (!open && chevronRef.current && typeof window !== 'undefined') {
        const r = chevronRef.current.getBoundingClientRect();
        const vw = window.innerWidth;
        const minW = 248;
        let left = r.left;
        if (left + minW > vw - 8) left = Math.max(8, vw - minW - 8);
        const vh = window.innerHeight;
        const spaceBelow = vh - r.bottom - 8;
        setMenuStyle({
          position: 'fixed',
          top: r.bottom + 2,
          left,
          minWidth: minW,
          maxHeight: Math.min(380, spaceBelow),
          zIndex: 30050,
        });
        setPicked(new Set(consolidatable.map((t) => t.trackIndex)));
      }
      setOpen((o) => !o);
    },
    [consolidatable, consolidateBusy, disabled, open],
  );

  const togglePick = (idx: number) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const runConsolidate = () => {
    const indices = [...picked].sort((a, b) => a - b);
    if (indices.length === 0) return;
    onConsolidate(indices, startBar, endBar);
    setOpen(false);
  };

  const menuEl =
    open && typeof document !== 'undefined' ? (
      <div
        ref={menuRef}
        data-studio-consolidate-menu
        className="rounded border overflow-hidden shadow-2xl flex flex-col"
        style={{
          ...menuStyle,
          borderColor: '#3a3a4c',
          background: '#0e0e14',
          boxShadow: '0 12px 40px rgba(0,0,0,0.92)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-2 py-1.5 border-b space-y-1.5" style={{ borderColor: '#2a2a34' }}>
          <p className="se2-type-label text-[8px] m-0" style={{ color: '#8a8a98' }}>
            Consolidate range
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-1 text-[8px]" style={{ color: '#8a8a98' }}>
              Start
              <input
                type="number"
                min={1}
                max={maxBars}
                value={startBar}
                onChange={(e) => onStartBarChange(Number(e.target.value) || 1)}
                className={inputClass}
                style={{ borderColor: '#2a2a32', color: '#c8c8d4' }}
                aria-label="Consolidate start bar"
              />
            </label>
            <label className="flex items-center gap-1 text-[8px]" style={{ color: '#8a8a98' }}>
              End
              <input
                type="number"
                min={startBar}
                max={maxBars}
                value={endBar}
                onChange={(e) => onEndBarChange(Number(e.target.value) || startBar)}
                className={inputClass}
                style={{ borderColor: '#2a2a32', color: '#c8c8d4' }}
                aria-label="Consolidate end bar"
              />
            </label>
            <span className="text-[7px] tabular-nums" style={{ color: '#6a6a78' }}>
              / {maxBars}
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {[1, 2, 3, 4].map((min) => (
              <button
                key={min}
                type="button"
                className="se2-type-micro rounded border px-1.5 py-0.5 text-[7px]"
                style={{ borderColor: '#2a2a32', color: '#8a8a98', background: 'transparent' }}
                title={`Set end bar for ~${min} min at ${bpm} BPM (${beatsPerBar}/4)`}
                onClick={() => onEndBarFromMinutes(min)}
              >
                {min}m
              </button>
            ))}
          </div>
          <p
            className="text-[8px] se2-type-value tabular-nums m-0"
            style={{ color: rangeValid ? '#7cf4c6' : '#ffb080' }}
          >
            {rangeValid ? rangeLabel : 'End bar must be after start bar'}
          </p>
        </div>

        <div className="px-2 py-1 border-b" style={{ borderColor: '#2a2a34' }}>
          <p className="se2-type-label text-[8px] m-0" style={{ color: '#8a8a98' }}>
            Tracks
          </p>
        </div>

        <div className="overflow-y-auto flex-1 min-h-0 py-0.5 max-h-[180px]">
          {consolidateTracks.length === 0 ? (
            <p className="px-2 py-2 text-[8px] m-0" style={{ color: '#6a6a78' }}>
              No tracks in this project.
            </p>
          ) : (
            consolidateTracks.map((tr) => (
              <label
                key={tr.trackIndex}
                className="flex items-center gap-2 px-2 py-1 cursor-pointer"
                style={{
                  opacity: tr.canConsolidate ? 1 : 0.45,
                  cursor: tr.canConsolidate ? 'pointer' : 'not-allowed',
                }}
              >
                <input
                  type="checkbox"
                  disabled={!tr.canConsolidate}
                  checked={picked.has(tr.trackIndex)}
                  onChange={() => {
                    if (tr.canConsolidate) togglePick(tr.trackIndex);
                  }}
                  className="shrink-0"
                  style={{ accentColor: '#7cf4c6' }}
                />
                <span className="text-[9px] truncate min-w-0 flex-1" style={{ color: '#c8c8d4' }}>
                  {tr.label}
                </span>
                <span className="text-[7px] tabular-nums shrink-0" style={{ color: '#6a6a78' }}>
                  {tr.canConsolidate ? `${tr.clipCount} clip${tr.clipCount !== 1 ? 's' : ''}` : 'no audio'}
                </span>
              </label>
            ))
          )}
        </div>
        <div className="px-2 py-1.5 border-t flex gap-1.5" style={{ borderColor: '#2a2a34' }}>
          <button
            type="button"
            className="se2-type-micro flex-1 rounded border px-2 py-1 text-[8px]"
            style={{ borderColor: '#2a2a32', color: '#8a8a98', background: 'transparent' }}
            onClick={() => setOpen(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={picked.size === 0 || consolidateBusy || !rangeValid}
            className="se2-type-micro flex-1 rounded border px-2 py-1 text-[8px] disabled:opacity-40"
            style={{
              borderColor: 'rgba(124,244,198,0.35)',
              color: '#7cf4c6',
              background: 'rgba(124,244,198,0.1)',
            }}
            onClick={runConsolidate}
          >
            {consolidateBusy ? 'Working…' : 'Consolidate'}
          </button>
        </div>
      </div>
    ) : null;

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <HeaderChip caption="Normalize" minW="4.5rem">
        <button
          type="button"
          disabled={disabled || normalizeDisabled}
          title={normalizeTitle}
          onClick={(e) => {
            e.stopPropagation();
            onNormalize();
          }}
          className="se2-type-micro text-[9px] leading-none px-0.5 disabled:opacity-35 transition-opacity hover:opacity-90"
          style={{ color: '#ffb84d', background: 'transparent', border: 'none' }}
        >
          Normalize
        </button>
      </HeaderChip>

      <HeaderChip caption="Consolidate" minW="5.25rem">
        <div className="flex items-center gap-0 min-w-0">
          <button
            type="button"
            disabled={disabled || consolidateBusy || consolidatable.length === 0}
            title={rangeValid ? `Consolidate bars ${startBar}–${endBar}` : 'Set consolidate bar range'}
            onClick={openMenu}
            className="se2-type-micro text-[9px] leading-none px-0.5 truncate max-w-[4.5rem] disabled:opacity-35 transition-opacity hover:opacity-90"
            style={{ color: '#7cf4c6', background: 'transparent', border: 'none' }}
          >
            {consolidateBusy ? '…' : 'Tracks'}
          </button>
          <button
            ref={chevronRef}
            type="button"
            disabled={disabled || consolidateBusy || consolidatable.length === 0}
            title="Choose tracks and bar range to consolidate"
            aria-label="Choose tracks and bar range to consolidate"
            aria-expanded={open}
            onClick={openMenu}
            className="shrink-0 p-0.5 rounded disabled:opacity-35"
            style={{ color: '#8a8a9a', background: 'transparent', border: 'none' }}
          >
            <ChevronDown size={10} aria-hidden />
          </button>
        </div>
      </HeaderChip>
      {menuEl ? createPortal(menuEl, document.body) : null}
    </div>
  );
}
