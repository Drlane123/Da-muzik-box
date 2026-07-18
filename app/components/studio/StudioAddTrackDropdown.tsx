'use client';

import { ChevronDown, Copy, Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';

import { canUseBeatPads } from '@/app/lib/pricing/planEntitlements';
import { useAppPlan } from '@/app/lib/pricing/useAppPlan';

const GENO_CYAN = '#00E5FF';
const GENO_CYAN_SOFT = '#9defff';

export type StudioNewTrackKind = 'midi' | 'audio' | 'trackAlign' | 'a2m' | 'rhythm' | 'glideBass' | 'synthGeno' | 'grooveLead' | 'genoUltraSynth' | 'genoBassSynth' | 'drumGenerator' | 'beatPads' | 'humCapture' | 'guitar' | 'genoChordCreator' | 'chordGenie' | 'lab808';

const TRACK_KIND_OPTIONS: { value: StudioNewTrackKind; label: string; hint: string }[] = [
  { value: 'midi', label: 'MIDI', hint: 'Instrument lane — piano roll & MIDI out' },
  { value: 'audio', label: 'Audio', hint: 'Record or drop audio clips' },
  { value: 'trackAlign', label: 'Track Align', hint: 'Time stretch' },
  { value: 'a2m', label: 'Audio → MIDI', hint: 'Drop a clip — convert to MIDI notes' },
  { value: 'rhythm', label: 'Rhythm Edit', hint: 'Add lane — hits per bar & beat pick editor' },
  { value: 'genoChordCreator', label: 'SE2 Chord Generator', hint: '4/8 bar card sketch — generate, edit, export to this lane' },
  { value: 'beatPads', label: 'Beat Pads', hint: 'Full drum machine lane — 16 pads, grid, Geno sync' },
  { value: 'drumGenerator', label: 'Drum Generator', hint: 'Generate grooves that match your chords & bass' },
  {
    value: 'humCapture',
    label: 'Hum / Melody Capture',
    hint: 'Humming, singing, whistling, or a single instrument → MIDI (pitch · timing · loudness · bends)',
  },
  { value: 'glideBass', label: 'Bass Glide', hint: 'Synth bass + glide FX — sync from Progression+' },
  { value: 'synthGeno', label: 'Synth Geno', hint: 'Dedicated synth builder — describe & generate sounds' },
  { value: 'grooveLead', label: 'Groove Lead', hint: 'R&B / gospel lead synth from Groove Lab — full preset bank' },
  { value: 'genoUltraSynth', label: 'Geno Ultra Synth', hint: 'Grid-style subtractive synth — 3 osc, filter, LFOs & mod matrix' },
  { value: 'genoBassSynth', label: 'Geno Bass Synth', hint: 'Classic synth bass — Mooga, Retro Box, FM, 55 bass sounds' },
  { value: 'lab808', label: '808 Lab', hint: 'Trap kick & bass 808 synth — standalone lane, not linked to Creation Station' },
  { value: 'guitar', label: 'Guitar', hint: 'Dedicated guitar lane — sampled tones, licks on the MIDI roll' },
];

/** Two-line rows — label + hint; must match fixed button minHeight below. */
const TRACK_KIND_MENU_ITEM_H_PX = 56;
const TRACK_KIND_MENU_PAD_PX = 8;
function trackKindMenuHeightPx(optionCount: number): number {
  return optionCount * TRACK_KIND_MENU_ITEM_H_PX + TRACK_KIND_MENU_PAD_PX;
}

/** Duplicate control — fixed width; track-type dropdown takes the rest of the row. */
const DUPLICATE_BTN_W_PX = 66;

export type StudioAddTrackDropdownProps = {
  disabled?: boolean;
  duplicateDisabled?: boolean;
  onAdd: (kind: StudioNewTrackKind) => void;
  onDuplicate: () => void;
};

export function StudioAddTrackDropdown({
  disabled = false,
  duplicateDisabled = false,
  onAdd,
  onDuplicate,
}: StudioAddTrackDropdownProps) {
  const plan = useAppPlan();
  const kindOptions = useMemo(
    () =>
      canUseBeatPads(plan)
        ? TRACK_KIND_OPTIONS
        : TRACK_KIND_OPTIONS.filter((o) => o.value !== 'beatPads'),
    [plan],
  );
  const [kind, setKind] = useState<StudioNewTrackKind>('midi');
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (kind === 'beatPads' && !canUseBeatPads(plan)) setKind('midi');
  }, [kind, plan]);

  const selected = kindOptions.find((o) => o.value === kind) ?? kindOptions[0]!;

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
      if (disabled) return;
      if (!open && btnRef.current && typeof window !== 'undefined') {
        const r = btnRef.current.getBoundingClientRect();
        const vw = window.innerWidth;
        const minW = Math.max(r.width, 180);
        let left = r.left;
        if (left + minW > vw - 8) left = Math.max(8, vw - minW - 8);
        const gap = 4;
        const pad = 8;
        const naturalH = trackKindMenuHeightPx(kindOptions.length);
        const spaceBelow = window.innerHeight - r.bottom - pad;
        const spaceAbove = r.top - pad;
        const openBelow = spaceBelow >= naturalH || spaceBelow >= spaceAbove;
        const maxH = Math.min(naturalH, openBelow ? spaceBelow : spaceAbove);
        setMenuStyle({
          position: 'fixed',
          top: openBelow ? r.bottom + gap : Math.max(pad, r.top - maxH - gap),
          left,
          minWidth: minW,
          maxHeight: maxH,
          overflowY: 'auto',
          zIndex: 30050,
        });
      }
      setOpen((o) => !o);
    },
    [disabled, open, kindOptions.length],
  );

  const menuEl =
    open && typeof document !== 'undefined' ? (
      <div
        ref={menuRef}
        role="listbox"
        aria-label="Track type to add"
        data-studio-add-track-popover
        className="rounded border overflow-x-hidden overflow-y-auto shadow-2xl"
        style={{
          ...menuStyle,
          borderColor: '#3a3a4c',
          background: '#0e0e14',
          boxShadow: '0 12px 40px rgba(0,0,0,0.92), 0 0 0 1px rgba(255,255,255,0.05)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {kindOptions.map((opt) => {
          const sel = opt.value === kind;
          return (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={sel}
              className="block w-full text-left outline-none border-b last:border-b-0"
              style={{
                boxSizing: 'border-box',
                minHeight: TRACK_KIND_MENU_ITEM_H_PX,
                padding: '8px 12px',
                borderColor: '#1a1a22',
                background: sel ? 'rgba(0,229,255,0.1)' : 'transparent',
                borderLeft: sel ? `2px solid ${GENO_CYAN}` : '2px solid transparent',
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.stopPropagation();
                setKind(opt.value);
                setOpen(false);
                if (!disabled) onAdd(opt.value);
              }}
            >
              <span
                data-track-kind-label
                className="block leading-tight"
                style={{ color: sel ? GENO_CYAN_SOFT : '#e8e8f0' }}
              >
                {opt.label}
              </span>
              <span
                data-track-kind-hint
                className="block leading-snug mt-0.5"
                style={{ color: '#6a6a78' }}
              >
                {opt.hint}
              </span>
            </button>
          );
        })}
      </div>
    ) : null;

  return (
    <div className="flex min-w-0 w-full items-stretch gap-1">
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        data-studio-add-track-trigger
        title={`Track type: ${selected.label}`}
        aria-label={`Track type: ${selected.label}. Open menu to change.`}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={openMenu}
        className="se2-type-label flex min-w-0 flex-1 items-center justify-between gap-1 rounded border px-2.5 py-0.5 text-left outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          height: '100%',
          minHeight: 26,
          borderColor: open ? '#4a4a58' : '#2a2a32',
          background: open ? '#1a1a24' : 'rgba(255,255,255,0.03)',
          color: '#d0d0de',
          fontSize: 14,
        }}
      >
        <span className="truncate font-semibold leading-none">{selected.label}</span>
        <ChevronDown
          size={10}
          strokeWidth={2.5}
          className="shrink-0 opacity-70"
          aria-hidden
          style={{
            transform: open ? 'rotate(180deg)' : undefined,
            transition: 'transform 0.12s ease',
          }}
        />
      </button>
      <button
        type="button"
        disabled={disabled}
        title={`Add ${selected.label} track`}
        aria-label={`Add ${selected.label} track`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) onAdd(kind);
        }}
        className="flex shrink-0 items-center justify-center rounded border transition-colors hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          width: 28,
          minHeight: 26,
          height: '100%',
          borderColor: '#1a3a48',
          background: 'rgba(0,229,255,0.1)',
          color: GENO_CYAN,
        }}
      >
        <Plus size={12} strokeWidth={2.5} aria-hidden />
      </button>
      <button
        type="button"
        disabled={duplicateDisabled}
        title="Duplicate selected track"
        aria-label="Duplicate selected track"
        onClick={(e) => {
          e.stopPropagation();
          onDuplicate();
        }}
        className="flex shrink-0 items-center justify-center gap-0.5 rounded border px-1 transition-colors hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          width: DUPLICATE_BTN_W_PX,
          minHeight: 26,
          height: '100%',
          borderColor: '#3a3a46',
          background: 'rgba(255,255,255,0.04)',
          color: '#b8b8c8',
        }}
      >
        <Copy size={10} strokeWidth={2} className="shrink-0 opacity-85" aria-hidden />
        <span
          className="se2-type-micro min-w-0 text-center font-semibold leading-[1.1]"
          style={{ fontSize: 10, color: '#c4c4d4' }}
        >
          Duplicate
          <br />
          track
        </span>
      </button>
      {menuEl ? createPortal(menuEl, document.body) : null}
    </div>
  );
}
