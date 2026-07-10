'use client';

import { ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';

import {
  countBeatLabDrumPresets,
  getBeatLabDrumPresets,
  getBeatLabPatternBanksForSlot,
  type BeatLabPatternBankId,
  type BeatLabPatternSlotId,
} from '@/app/lib/creationStation/beatLabPatternBank';
import { isBeatLabSignatureTrapPattern } from '@/app/lib/creationStation/beatLabSignatureTrapPatterns';
import { beatLabTrapProducerGridBpmLabel } from '@/app/lib/creationStation/beatLabTrapTempo';
import {
  studioBeatLabPatternBankIdForPreset,
  studioBeatLabPatternPresetById,
} from '@/app/lib/studio/studioEditor2DrumPatterns';
import { getPatternPresetBpm, getPatternPresetProducerGridBpm, type PatternPreset } from '@/app/lib/patternPresets';

const BL_MINT = '#7cf4c6';

function shortBeatLabLabel(preset: PatternPreset | undefined): string {
  if (!preset) return 'Bank';
  const name = preset.name.trim();
  if (name.length <= 12) return name;
  return `${name.slice(0, 10)}…`;
}

export type StudioBeatLabPatternBankMenuProps = {
  selectedPresetId?: string;
  onSelectPreset: (preset: PatternPreset) => void;
  disabled?: boolean;
  accentHex?: string;
  compact?: boolean;
  trackChannel?: boolean;
  triggerWidthPx?: number;
  triggerFontPx?: number;
  className?: string;
  title?: string;
};

/** Beat Lab Pattern Bank — same presets as Creation Station, compact for drum track header. */
export function StudioBeatLabPatternBankMenu({
  selectedPresetId,
  onSelectPreset,
  disabled = false,
  accentHex = BL_MINT,
  compact = true,
  trackChannel = false,
  triggerWidthPx,
  triggerFontPx: triggerFontPxProp,
  className = '',
  title,
}: StudioBeatLabPatternBankMenuProps) {
  const activePreset = useMemo(
    () => studioBeatLabPatternPresetById(selectedPresetId),
    [selectedPresetId],
  );
  const activeBankId = studioBeatLabPatternBankIdForPreset(activePreset);
  const [slot, setSlot] = useState<BeatLabPatternSlotId>(
    activeBankId && (activeBankId === 'afro' || activeBankId === 'reggae' || activeBankId === 'house') ? 'B' : 'A',
  );
  const [bankId, setBankId] = useState<BeatLabPatternBankId>(activeBankId ?? 'trap');
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const stripSlot = triggerWidthPx != null;
  const triggerFontPx = triggerFontPxProp ?? (trackChannel ? 12 : compact ? 7 : 8);
  const triggerPad = stripSlot ? '4px 8px' : trackChannel ? '2px 6px' : compact ? '1px 4px' : '2px 6px';
  const chevronPx = stripSlot ? 12 : trackChannel ? 10 : compact ? 8 : 10;
  const banks = getBeatLabPatternBanksForSlot(slot);
  const bankPresets = getBeatLabDrumPresets(bankId);
  const triggerLabel = shortBeatLabLabel(activePreset);

  useEffect(() => {
    if (!activeBankId) return;
    setBankId(activeBankId);
    setSlot(activeBankId === 'afro' || activeBankId === 'reggae' || activeBankId === 'house' ? 'B' : 'A');
  }, [activeBankId]);

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
        const minW = Math.max(r.width, 240);
        let left = r.left;
        if (left + minW > vw - 8) left = Math.max(8, vw - minW - 8);
        const spaceAbove = r.top - 8;
        const spaceBelow = vh - r.bottom - 8;
        const maxH = Math.min(360, Math.max(180, spaceAbove >= spaceBelow ? spaceAbove : spaceBelow));
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
        aria-label={title ?? 'Beat Lab pattern bank'}
        data-studio-beatlab-pattern-menu
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
          Beat Lab bank
        </div>
        <div
          className="flex shrink-0 gap-1 px-2 py-1"
          style={{ borderBottom: '1px solid #1a1a22', background: '#101018' }}
        >
          {(['A', 'B'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setSlot(s);
                const nextBanks = getBeatLabPatternBanksForSlot(s);
                if (!nextBanks.some((b) => b.id === bankId)) {
                  setBankId(nextBanks[0]?.id ?? 'trap');
                }
              }}
              className="rounded border font-bold uppercase tracking-wide"
              style={{
                fontSize: trackChannel ? 9 : 8,
                padding: '3px 8px',
                borderColor: slot === s ? `${accentHex}66` : '#2a2a36',
                background: slot === s ? `${accentHex}18` : '#14141c',
                color: slot === s ? accentHex : '#8a8a98',
              }}
            >
              {s}
            </button>
          ))}
          <span className="flex-1 text-right self-center text-[7px] font-semibold uppercase tracking-wide text-[#5a5a6a]">
            {slot === 'A' ? 'Trap · R&B · Dance…' : 'Afro · Reggae · House'}
          </span>
        </div>
        <div
          className="flex shrink-0 flex-wrap gap-1 px-2 py-1.5"
          style={{ borderBottom: '1px solid #1a1a22', background: '#101018' }}
        >
          {banks.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setBankId(b.id)}
              className="rounded border font-bold uppercase tracking-wide"
              style={{
                fontSize: trackChannel ? 8 : 7,
                padding: '3px 6px',
                borderColor: bankId === b.id ? `${accentHex}66` : '#2a2a36',
                background: bankId === b.id ? `${accentHex}18` : '#14141c',
                color: bankId === b.id ? accentHex : '#8a8a98',
              }}
            >
              {b.label}
              <span className="ml-0.5 opacity-70 tabular-nums">({countBeatLabDrumPresets(b.id)})</span>
            </button>
          ))}
        </div>
        <div className="overflow-y-auto min-h-0 flex-1">
          {bankPresets.map((preset) => {
            const selected = preset.id === activePreset?.id;
            const transportBpm = getPatternPresetBpm(preset);
            const producerGridBpm = getPatternPresetProducerGridBpm(preset);
            const gridLabel = beatLabTrapProducerGridBpmLabel(preset, producerGridBpm, transportBpm);
            const isSignature = isBeatLabSignatureTrapPattern(preset.id);
            return (
              <button
                key={preset.id}
                type="button"
                role="menuitem"
                title={preset.desc}
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
                {isSignature ? (
                  <span style={{ color: '#67e8f9', fontWeight: 900, marginRight: 4 }}>(S)</span>
                ) : null}
                {preset.name}
                <span style={{ color: accentHex, fontWeight: 800 }}> · {transportBpm}</span>
                {gridLabel != null ? (
                  <span style={{ color: '#6a6a78', fontWeight: 700, fontSize: 8 }}> grid {gridLabel}</span>
                ) : null}
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
        title={title ?? 'Load a Beat Lab pattern bank preset (Creation Station catalog)'}
        aria-label={title ?? `Beat Lab pattern bank, ${triggerLabel}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={openMenu}
        onPointerDown={(e) => e.stopPropagation()}
        className={`flex min-w-0 max-w-full items-center justify-between gap-0.5 rounded border font-semibold outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
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
          {stripSlot ? (activePreset ? triggerLabel : 'Beat Lab') : `BL · ${triggerLabel}`}
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
