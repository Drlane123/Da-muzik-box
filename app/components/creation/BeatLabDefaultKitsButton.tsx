/**
 * Default flagship kits (banks A–H) — lives in the Crew Kits toolbar row.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  BEAT_LAB_EXTRA_DEFAULT_KITS,
  BEAT_LAB_FLAGSHIP_KIT_ORDER,
  beatLabProducerKitMeta,
  type BeatLabProducerKitId,
} from '@/app/lib/creationStation/beatLabProducerKits';

const FLAGSHIP_BANK_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
const GOLD = '#ffd966';
const GOLD_DIM = 'rgba(255, 200, 80, 0.45)';
const MINT = '#7cf4c6';

type MenuGeom = {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
};

function DefaultKitMenuPortal({
  open,
  triggerEl,
  onClose,
  onPick,
  onPickExtra,
  disabled,
  activeBank,
  loadingKitId,
}: {
  open: boolean;
  triggerEl: HTMLElement | null;
  onClose: () => void;
  onPick: (kitId: BeatLabProducerKitId, bankIndex: number) => void;
  onPickExtra?: (kitId: BeatLabProducerKitId) => void;
  disabled: boolean;
  activeBank: number;
  loadingKitId?: BeatLabProducerKitId | null;
}) {
  const [geom, setGeom] = useState<MenuGeom | null>(null);

  useLayoutEffect(() => {
    if (!open || !triggerEl || typeof window === 'undefined') {
      setGeom(null);
      return;
    }
    const gap = 4;
    const margin = 8;
    const desiredMax = Math.min(320, Math.floor(window.innerHeight * 0.55));
    const r = triggerEl.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom - margin - gap;
    const spaceAbove = r.top - margin - gap;

    if (spaceBelow >= 120) {
      const maxHeight = Math.min(desiredMax, spaceBelow);
      const width = Math.max(240, r.width);
      const maxLeft = window.innerWidth - width - margin;
      const left = Math.max(margin, Math.min(r.left, maxLeft));
      setGeom({ left, top: r.bottom + gap, width, maxHeight });
      return;
    }

    const maxHeight = Math.min(desiredMax, Math.max(120, spaceAbove));
    const top = r.top - maxHeight - gap;
    const width = Math.max(240, r.width);
    const maxLeft = window.innerWidth - width - margin;
    const left = Math.max(margin, Math.min(r.left, maxLeft));
    setGeom({
      left,
      top: Math.max(margin, top),
      width,
      maxHeight: Math.min(maxHeight, r.top - Math.max(margin, top) - gap),
    });
  }, [open, triggerEl]);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (triggerEl?.contains(t)) return;
      const menus = document.querySelectorAll('[data-beatlab-default-kit-menu="1"]');
      for (const m of menus) {
        if (m.contains(t)) return;
      }
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const raf = requestAnimationFrame(() => {
      document.addEventListener('click', onOutside, true);
    });
    window.addEventListener('resize', onClose);
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('click', onOutside, true);
      window.removeEventListener('resize', onClose);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, triggerEl, onClose]);

  if (!open || !geom || typeof document === 'undefined') return null;

  return createPortal(
    <div
      data-beatlab-default-kit-menu="1"
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
        border: `1px solid ${GOLD_DIM}`,
        background: 'rgba(8,10,14,0.98)',
        boxShadow: '0 8px 28px rgba(0,0,0,0.55)',
        paddingBottom: 6,
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {BEAT_LAB_FLAGSHIP_KIT_ORDER.map((kitId, bankIndex) => {
        const meta = beatLabProducerKitMeta(kitId);
        if (!meta) return null;
        const letter = FLAGSHIP_BANK_LETTERS[bankIndex] ?? String(bankIndex + 1);
        const isActiveBank = activeBank === bankIndex;
        const isLoading = loadingKitId === kitId;
        return (
          <button
            key={kitId}
            type="button"
            disabled={disabled || isLoading}
            role="option"
            aria-selected={isActiveBank}
            title={`${meta.title} → Pad bank ${letter} (16 pads)`}
            onClick={() => {
              if (disabled || isLoading) return;
              onPick(kitId, bankIndex);
              onClose();
            }}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '8px 10px',
              border: 'none',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              boxShadow: isActiveBank ? `inset 3px 0 0 ${GOLD}` : undefined,
              background: isActiveBank ? 'rgba(255, 200, 80, 0.12)' : 'transparent',
              color: '#e8e8f0',
              fontSize: 11,
              fontWeight: 700,
              cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.45 : 1,
            }}
          >
            Bank {letter} · {isLoading ? 'Loading…' : meta.title}
            {isActiveBank ? (
              <span style={{ marginLeft: 6, fontSize: 9, color: MINT, fontWeight: 900 }}>· current</span>
            ) : null}
          </button>
        );
      })}
      {BEAT_LAB_EXTRA_DEFAULT_KITS.length > 0 ? (
        <div
          style={{
            borderTop: '1px solid rgba(255, 200, 80, 0.2)',
            marginTop: 4,
            paddingTop: 4,
          }}
        >
          {BEAT_LAB_EXTRA_DEFAULT_KITS.map((kitId) => {
            const meta = beatLabProducerKitMeta(kitId);
            if (!meta) return null;
            const isLoading = loadingKitId === kitId;
            const letter = FLAGSHIP_BANK_LETTERS[activeBank] ?? String(activeBank + 1);
            return (
              <button
                key={kitId}
                type="button"
                disabled={disabled || isLoading || typeof onPickExtra !== 'function'}
                role="option"
                title={`${meta.title} → current bank ${letter} (16 chromatic hit pads)`}
                onClick={() => {
                  if (disabled || isLoading || typeof onPickExtra !== 'function') return;
                  onPickExtra(kitId);
                  onClose();
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 10px',
                  border: 'none',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  background: 'rgba(124, 244, 198, 0.06)',
                  color: '#d8f8ec',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.45 : 1,
                }}
              >
                Bank {letter} · {isLoading ? 'Loading…' : meta.title}
                <span style={{ marginLeft: 6, fontSize: 9, color: MINT, fontWeight: 800 }}>· hits</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>,
    document.body,
  );
}

export function BeatLabDefaultKitsButton({
  disabled = false,
  activeBank = 0,
  loadingKitId = null,
  onLoadKitToBank,
}: {
  disabled?: boolean;
  activeBank?: number;
  loadingKitId?: BeatLabProducerKitId | null;
  onLoadKitToBank: (kitId: BeatLabProducerKitId, bankIndex: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const count = BEAT_LAB_FLAGSHIP_KIT_ORDER.length + BEAT_LAB_EXTRA_DEFAULT_KITS.length;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        title="Default flagship kits — load Trap / R&B / Dance to banks A–H"
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => !prev);
        }}
        style={{
          padding: '4px 8px',
          borderRadius: 4,
          border: `1px solid ${open ? GOLD : GOLD_DIM}`,
          background: open ? 'rgba(255, 200, 80, 0.14)' : 'rgba(12, 12, 18, 0.9)',
          color: GOLD,
          fontSize: 9,
          fontWeight: 800,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.45 : 1,
          whiteSpace: 'nowrap',
        }}
      >
        Default ({count}) {open ? '▴' : '▾'}
      </button>
      <DefaultKitMenuPortal
        open={open}
        triggerEl={triggerRef.current}
        disabled={disabled}
        activeBank={activeBank}
        loadingKitId={loadingKitId}
        onClose={() => setOpen(false)}
        onPick={onLoadKitToBank}
        onPickExtra={(kitId) => onLoadKitToBank(kitId, activeBank)}
      />
    </>
  );
}
