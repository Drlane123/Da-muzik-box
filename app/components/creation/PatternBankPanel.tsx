/**
 * Beat Lab Pattern Bank — MIDI-style drum patterns by genre.
 * Each genre opens an upward-fixed menu (scroll inside) so the footer stays short.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  BEAT_LAB_PATTERN_BANKS,
  countBeatLabDrumPresets,
  getBeatLabDrumPresets,
  type BeatLabPatternBankId,
} from '@/app/lib/creationStation/beatLabPatternBank';
import { getPatternPresetBpm, type PatternPreset } from '@/app/lib/patternPresets';

const MINT = '#7cf4c6';
const MINT_DIM = 'rgba(124, 244, 198, 0.35)';
const MINT_BG = 'rgba(124, 244, 198, 0.12)';

type MenuGeom = {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
};

function GenrePatternMenuPortal({
  open,
  presets,
  triggerEl,
  onClose,
  onPick,
  disabled,
  loadedPresetId,
}: {
  open: boolean;
  presets: PatternPreset[];
  triggerEl: HTMLElement | null;
  onClose: () => void;
  onPick: (p: PatternPreset) => void;
  disabled: boolean;
  loadedPresetId?: string | null;
}) {
  const [geom, setGeom] = useState<MenuGeom | null>(null);

  useLayoutEffect(() => {
    if (!open || !triggerEl || typeof window === 'undefined') {
      setGeom(null);
      return;
    }
    const gap = 4;
    const margin = 8;
    const desiredMax = Math.min(300, Math.floor(window.innerHeight * 0.5));
    const r = triggerEl.getBoundingClientRect();
    const spaceAbove = r.top - margin - gap;

    /** Prefer upward list; fallback below trigger if viewport top is cramped. */
    if (spaceAbove >= 112) {
      const maxHeight = Math.min(desiredMax, spaceAbove);
      const top = r.top - maxHeight - gap;
      const rawLeft = r.left;
      const width = Math.max(220, r.width);
      const maxLeft = window.innerWidth - width - margin;
      const left = Math.max(margin, Math.min(rawLeft, maxLeft));
      setGeom({
        left,
        top: Math.max(margin, top),
        width,
        maxHeight: Math.min(maxHeight, r.top - Math.max(margin, top) - gap),
      });
      return;
    }

    const spaceBelow = window.innerHeight - r.bottom - margin - gap;
    const maxHeight = Math.min(desiredMax, Math.max(120, spaceBelow));
    const width = Math.max(220, r.width);
    const maxLeft = window.innerWidth - width - margin;
    const left = Math.max(margin, Math.min(r.left, maxLeft));
    setGeom({
      left,
      top: r.bottom + gap,
      width,
      maxHeight,
    });
  }, [open, triggerEl]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node | null;
      if (triggerEl?.contains(t)) return;
      const menus = document.querySelectorAll('[data-beatlab-pattern-menu="1"]');
      for (const m of menus) {
        if (m.contains(t)) return;
      }
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('resize', onClose);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      window.removeEventListener('resize', onClose);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, triggerEl, onClose]);

  if (!open || !geom || typeof document === 'undefined') return null;

  return createPortal(
    <div
      data-beatlab-pattern-menu="1"
      role="listbox"
      style={{
        position: 'fixed',
        zIndex: 99999,
        left: geom.left,
        top: geom.top,
        width: geom.width,
        maxHeight: geom.maxHeight,
        overflowY: 'auto',
        overflowX: 'hidden',
        borderRadius: 6,
        border: `1px solid ${MINT_DIM}`,
        background: 'rgba(8,10,14,0.98)',
        boxShadow: '0 -8px 28px rgba(0,0,0,0.55)',
      }}
    >
      {presets.map((p) => {
        const presetBpm = getPatternPresetBpm(p);
        const isLoaded = loadedPresetId != null && loadedPresetId === p.id;
        return (
          <button
            key={p.id}
            type="button"
            disabled={disabled}
            role="option"
            aria-selected={isLoaded}
            title={`${p.desc} (${presetBpm} BPM)`}
            onClick={() => {
              if (disabled) return;
              onPick(p);
              onClose();
            }}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '8px 10px',
              border: 'none',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              boxShadow: isLoaded ? `inset 3px 0 0 ${MINT}` : undefined,
              background: isLoaded ? 'rgba(124, 244, 198, 0.14)' : 'transparent',
              color: '#e8e8f0',
              fontSize: 11,
              fontWeight: 700,
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.45 : 1,
            }}
          >
            {p.name} <span style={{ color: '#7cf4c6', fontWeight: 800 }}>· {presetBpm}</span>
            {isLoaded ? (
              <span style={{ marginLeft: 6, fontSize: 9, color: MINT, fontWeight: 900 }}>· active</span>
            ) : null}
          </button>
        );
      })}
      {presets.length === 0 && (
        <div style={{ padding: 12, fontSize: 11, color: '#f4a0a0' }}>No patterns in this bank.</div>
      )}
    </div>,
    document.body,
  );
}

export function PatternBankPanel({
  patternSlot,
  onPatternSlotChange,
  onLoadPreset,
  onCopyAToB,
  disabled = false,
  loadedBankId = null,
  loadedPresetId = null,
}: {
  patternSlot: 'A' | 'B';
  onPatternSlotChange: (slot: 'A' | 'B') => void;
  onLoadPreset: (preset: PatternPreset) => void;
  onCopyAToB?: () => void;
  disabled?: boolean;
  /** Highlights the genre chip (Trap, R&B, …) for the last Pattern Bank load. */
  loadedBankId?: BeatLabPatternBankId | null;
  /** Highlights the row when the menu is open. */
  loadedPresetId?: string | null;
}) {
  const [openId, setOpenId] = useState<BeatLabPatternBankId | null>(null);
  const triggersRef = useRef<Partial<Record<BeatLabPatternBankId, HTMLButtonElement | null>>>(
    {},
  );

  const setTriggerRef = useCallback(
    (id: BeatLabPatternBankId, el: HTMLButtonElement | null) => {
      triggersRef.current[id] = el;
    },
    [],
  );

  const activeTrigger = openId ? triggersRef.current[openId] ?? null : null;
  const openPresets = openId ? getBeatLabDrumPresets(openId) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            alignItems: 'stretch',
            flex: '1 1 auto',
            minWidth: 0,
          }}
        >
          {BEAT_LAB_PATTERN_BANKS.map((b) => {
            const n = countBeatLabDrumPresets(b.id);
            const isOpen = openId === b.id;
            const isLoadedBank = loadedBankId != null && loadedBankId === b.id;
            const borderColor = isOpen ? MINT : isLoadedBank ? 'rgba(124, 244, 198, 0.85)' : MINT_DIM;
            return (
              <button
                key={b.id}
                ref={(el) => setTriggerRef(b.id, el)}
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (disabled) return;
                  setOpenId((prev) => (prev === b.id ? null : b.id));
                }}
                style={{
                  padding: '5px 10px',
                  borderRadius: 5,
                  border: `1px solid ${borderColor}`,
                  boxShadow: isLoadedBank
                    ? '0 0 0 1px rgba(124, 244, 198, 0.35), 0 0 12px rgba(124, 244, 198, 0.12)'
                    : undefined,
                  background: isOpen ? MINT_BG : isLoadedBank ? 'rgba(124, 244, 198, 0.08)' : 'rgba(255,255,255,0.04)',
                  color: isOpen || isLoadedBank ? MINT : '#c8cad4',
                  fontSize: 10,
                  fontWeight: 900,
                  letterSpacing: 0.3,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.45 : 1,
                  flex: '1 1 0',
                  minWidth: 76,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 6,
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {b.label}{' '}
                  <span style={{ fontWeight: 800, fontSize: 9, opacity: 0.75 }}>({n})</span>
                </span>
                <span style={{ opacity: 0.85 }}>{isOpen ? '▴' : '▾'}</span>
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
          {(['A', 'B'] as const).map((slot) => (
            <button
              key={slot}
              type="button"
              disabled={disabled}
              onClick={() => onPatternSlotChange(slot)}
              style={{
                padding: '3px 8px',
                borderRadius: 3,
                border: `1px solid ${patternSlot === slot ? MINT : 'rgba(255,255,255,0.14)'}`,
                background: patternSlot === slot ? MINT_BG : 'rgba(255,255,255,0.04)',
                color: patternSlot === slot ? MINT : '#9a9aa8',
                fontSize: 8,
                fontWeight: 900,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.45 : 1,
              }}
            >
              {slot}
            </button>
          ))}
          {onCopyAToB && (
            <button
              type="button"
              disabled={disabled}
              onClick={onCopyAToB}
              title="Copy pattern A into slot B"
              style={{
                padding: '3px 6px',
                borderRadius: 3,
                border: '1px solid rgba(255,255,255,0.14)',
                background: 'rgba(255,255,255,0.04)',
                color: '#9a9aa8',
                fontSize: 7,
                fontWeight: 800,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.45 : 1,
              }}
            >
              A→B
            </button>
          )}
        </div>
      </div>

      <GenrePatternMenuPortal
        open={openId != null}
        presets={openPresets}
        triggerEl={activeTrigger}
        disabled={disabled}
        onClose={() => setOpenId(null)}
        onPick={onLoadPreset}
        loadedPresetId={loadedPresetId}
      />
    </div>
  );
}
