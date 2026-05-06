'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Compact **F|X** opens a small floating insert rack (3 slots).
 */

export const CHANNEL_FX_SLOT_COUNT = 3 as const;

export type MixerEffectId =
  | ''
  | 'eq'
  | 'compressor'
  | 'gate'
  | 'reverb'
  | 'delay'
  | 'chorus'
  | 'saturation'
  | 'filter'
  | 'limiter';

export const MIXER_EFFECT_OPTIONS: { id: MixerEffectId; label: string }[] = [
  { id: '', label: '— None —' },
  { id: 'eq', label: 'EQ' },
  { id: 'compressor', label: 'Compressor' },
  { id: 'gate', label: 'Gate' },
  { id: 'reverb', label: 'Reverb' },
  { id: 'delay', label: 'Delay' },
  { id: 'chorus', label: 'Chorus' },
  { id: 'saturation', label: 'Saturation' },
  { id: 'filter', label: 'Filter' },
  { id: 'limiter', label: 'Limiter' },
];

export function emptyMixerFxSlots(): [MixerEffectId, MixerEffectId, MixerEffectId] {
  return ['', '', ''];
}

type SlotIndex = 0 | 1 | 2;

const FX_PANEL_WIDTH_PX = 200;
const FX_PANEL_EST_HEIGHT = 210;
/** Above mixer / workspace stacking — portal to `body` + inline z-index (no dimming scrim). */
const FX_PANEL_Z = 85_000;

const selectBase: CSSProperties = {
  width: '100%',
  padding: '4px 6px',
  fontSize: 11,
  lineHeight: 1.25,
  borderRadius: 3,
  cursor: 'pointer',
  outline: 'none',
  appearance: 'none' as const,
  WebkitAppearance: 'none' as const,
  backgroundColor: '#12121a',
  color: '#e4e4f0',
  border: '1px solid #2a2a38',
};

export interface ChannelStripFxButtonProps {
  variant: 'track' | 'master';
  channelLabel: string;
  slots: [MixerEffectId, MixerEffectId, MixerEffectId];
  onSlotChange: (slot: SlotIndex, id: MixerEffectId) => void;
  trackAccentHex?: string;
  /** Called when the FX control is pressed (strip selection can run even though click does not bubble). */
  onActivate?: () => void;
}

export function ChannelStripFxButton({
  variant,
  channelLabel,
  slots,
  onSlotChange,
  trackAccentHex,
  onActivate,
}: ChannelStripFxButtonProps) {
  const accent = variant === 'master' ? '#7cf4c6' : trackAccentHex ?? '#6a6a78';
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 });

  const hasInserts = slots[0] !== '' || slots[1] !== '' || slots[2] !== '';

  const reposition = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const panelW = FX_PANEL_WIDTH_PX;
    let left = r.left;
    if (left + panelW > window.innerWidth - 8) left = window.innerWidth - panelW - 8;
    if (left < 8) left = 8;
    const gap = 4;
    let top = r.bottom + gap;
    if (top + FX_PANEL_EST_HEIGHT > window.innerHeight - 8) top = Math.max(8, r.top - FX_PANEL_EST_HEIGHT - gap);
    setPanelPos({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  const glow = open || hasInserts ? accent : '#424250';
  const letterStyle = (): CSSProperties => ({
    fontSize: 8,
    fontWeight: 800,
    lineHeight: 1,
    color: open || hasInserts ? '#f4f4ff' : '#a0a0b4',
    textShadow: open || hasInserts ? `0 0 6px ${accent}` : '0 1px 1px rgba(0,0,0,0.9)',
  });

  const panel =
    open &&
    typeof document !== 'undefined' &&
    createPortal(
      <div
        ref={panelRef}
        className="fixed rounded border shadow-xl select-none"
        style={{
          top: panelPos.top,
          left: panelPos.left,
          width: FX_PANEL_WIDTH_PX,
          padding: '8px 8px 6px',
          zIndex: FX_PANEL_Z,
          isolation: 'isolate',
          background: '#0c0c12',
          borderColor: variant === 'master' ? '#2a4a40' : '#2a2a38',
          boxShadow: '0 12px 40px rgba(0,0,0,0.92), 0 0 0 1px rgba(255,255,255,0.04)',
        }}
        role="dialog"
        aria-label={`${channelLabel} effects`}
      >
        <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: accent }}>
          {channelLabel} · Effects
        </div>
        {([0, 1, 2] as const).map((si) => (
          <label key={si} className="flex flex-col gap-0.5 mb-2 last:mb-0">
            <span className="text-[8px] font-semibold uppercase" style={{ color: '#6a6a78', letterSpacing: '0.05em' }}>
              Insert {si + 1}
            </span>
            <select
              aria-label={`${channelLabel} insert ${si + 1}`}
              value={slots[si]}
              onChange={(e) => onSlotChange(si, e.target.value as MixerEffectId)}
              style={{
                ...selectBase,
                borderColor: slots[si] ? accent : '#2a2a38',
              }}
            >
              {MIXER_EFFECT_OPTIONS.map((opt) => (
                <option key={opt.id === '' ? 'none' : opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>,
      document.body,
    );

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        title={`${channelLabel} — effects inserts`}
        onClick={(e) => {
          onActivate?.();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="shrink-0 flex items-center justify-center gap-0"
        style={{
          minWidth: 28,
          height: 16,
          padding: '0 5px',
          borderRadius: 2,
          border: `1px solid ${open || hasInserts ? accent : '#353545'}`,
          background: open ? `${accent}22` : hasInserts ? `${accent}0f` : '#18181f',
          boxShadow: open ? `0 0 8px ${accent}44` : hasInserts ? `0 0 4px ${accent}22` : 'none',
        }}
      >
        <span style={letterStyle()}>F</span>
        <span
          aria-hidden
          style={{
            width: 1,
            height: 9,
            margin: '0 2px',
            background: glow,
            opacity: 0.6,
            borderRadius: 1,
          }}
        />
        <span style={letterStyle()}>X</span>
      </button>
      {panel}
    </>
  );
}
