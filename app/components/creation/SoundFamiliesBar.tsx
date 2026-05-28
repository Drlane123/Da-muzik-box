/**
 * Beat Lab Sound Families — same interaction model as Pattern Bank:
 * category row + floating scroll menu (prefers upward) for all samples in that family.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  familyInstrumentLabel,
  fetchSoundFamiliesCatalog,
  primary808Family,
  type SoundFamily,
} from '@/app/lib/creationStation/soundFamiliesCatalog';
import { soundFamilySampleDisplayTitle } from '@/app/lib/creationStation/soundFamilySampleTitles';
import { CREATION_PAD_NAMES } from '@/app/lib/sessionChannelTracks';

const MINT = '#7cf4c6';
const MINT_DIM = 'rgba(124, 244, 198, 0.35)';
const MINT_BG = 'rgba(124, 244, 198, 0.12)';

type MenuGeom = {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
};

function useFloatingScrollMenuGeom(open: boolean, triggerEl: HTMLElement | null): MenuGeom | null {
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

    if (spaceAbove >= 112) {
      const maxHeight = Math.min(desiredMax, spaceAbove);
      const top = r.top - maxHeight - gap;
      const width = Math.max(220, r.width);
      const maxLeft = window.innerWidth - width - margin;
      const left = Math.max(margin, Math.min(r.left, maxLeft));
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

  return geom;
}

function SoundFamilySamplesMenuPortal({
  open,
  family,
  triggerEl,
  padName,
  targetPad,
  selectedFile,
  onClose,
  onPickSample,
}: {
  open: boolean;
  family: SoundFamily | null;
  triggerEl: HTMLElement | null;
  padName: string;
  targetPad: number;
  selectedFile: string | null;
  onClose: () => void;
  onPickSample: (fam: SoundFamily, relFile: string, globalIndex: number) => void;
}) {
  const geom = useFloatingScrollMenuGeom(open && !!family, triggerEl);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node | null;
      if (triggerEl?.contains(t)) return;
      const menus = document.querySelectorAll('[data-beatlab-soundfam-menu="1"]');
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

  if (!open || !family || !geom || typeof document === 'undefined') return null;

  const isGold = family.id === '808-sub';

  return createPortal(
    <div
      data-beatlab-soundfam-menu="1"
      role="listbox"
      aria-label={`${family.label} samples`}
      style={{
        position: 'fixed',
        zIndex: 99998,
        left: geom.left,
        top: geom.top,
        width: geom.width,
        maxHeight: geom.maxHeight,
        overflowY: 'auto',
        overflowX: 'hidden',
        borderRadius: 6,
        border: `1px solid ${isGold ? 'rgba(255, 200, 80, 0.42)' : MINT_DIM}`,
        background: 'rgba(8,10,14,0.98)',
        boxShadow: isGold
          ? '0 -8px 28px rgba(40,35,15,0.55)'
          : '0 -8px 28px rgba(0,0,0,0.55)',
      }}
    >
      {family.samples.map((s, globalIndex) => {
        const title = soundFamilySampleDisplayTitle(family.id, globalIndex);
        const selected = selectedFile === s.file;
        return (
          <button
            key={s.file}
            type="button"
            role="option"
            title={`Load on ${padName}`}
            onClick={() => {
              onPickSample(family, s.file, globalIndex);
              onClose();
            }}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '8px 10px',
              border: 'none',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              background: 'transparent',
              color: selected ? (isGold ? '#ffd966' : MINT) : isGold ? '#f0e6c8' : '#e8e8f0',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {title}{' '}
            <span style={{ color: '#6a6a78', fontWeight: 600, fontSize: 9 }}>→ pad {targetPad + 1}</span>
          </button>
        );
      })}
      {family.samples.length === 0 && (
        <div style={{ padding: 12, fontSize: 11, color: '#f4a0a0' }}>No samples in this family.</div>
      )}
    </div>,
    document.body,
  );
}

export interface SoundFamiliesBarProps {
  targetPad: number;
  onTargetPadChange: (pad: number) => void;
  onLoadSample: (args: {
    familyId: string;
    pad: number;
    label: string;
    relFile: string;
  }) => void;
  onFamilyChange?: (family: SoundFamily) => void;
}

export function SoundFamiliesBar({
  targetPad,
  onTargetPadChange,
  onLoadSample,
  onFamilyChange,
}: SoundFamiliesBarProps) {
  const [catalog, setCatalog] = useState<Awaited<ReturnType<typeof fetchSoundFamiliesCatalog>>>(null);
  const [familyId, setFamilyId] = useState('808-sub');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [openMenuFamilyId, setOpenMenuFamilyId] = useState<string | null>(null);

  const triggersRef = useRef<Partial<Record<string, HTMLButtonElement | null>>>({});

  const setTriggerRef = useCallback((id: string, el: HTMLButtonElement | null) => {
    triggersRef.current[id] = el;
  }, []);

  useEffect(() => {
    void fetchSoundFamiliesCatalog().then((c) => {
      if (!c) return;
      setCatalog(c);
      const primary = primary808Family(c);
      if (primary) setFamilyId(primary.id);
    });
  }, []);

  const activeFamily = useMemo(
    () => catalog?.families.find((f) => f.id === familyId) ?? catalog?.families[0],
    [catalog, familyId],
  );

  const openFamily = openMenuFamilyId
    ? catalog?.families.find((f) => f.id === openMenuFamilyId) ?? null
    : null;
  const activeTrigger = openMenuFamilyId ? triggersRef.current[openMenuFamilyId] ?? null : null;

  const pickSample = useCallback(
    (fam: SoundFamily, relFile: string, globalIndex: number) => {
      setFamilyId(fam.id);
      setSelectedFile(relFile);
      onFamilyChange?.(fam);
      const title = soundFamilySampleDisplayTitle(fam.id, globalIndex);
      onLoadSample({
        familyId: fam.id,
        pad: targetPad,
        label: familyInstrumentLabel(targetPad, title),
        relFile,
      });
    },
    [onFamilyChange, onLoadSample, targetPad],
  );

  if (!catalog) {
    return (
      <div
        style={{
          padding: '3px 6px',
          fontSize: 8,
          color: '#6a6a78',
        }}
      >
        Loading…
      </div>
    );
  }

  const padName = CREATION_PAD_NAMES[targetPad] ?? `Pad ${targetPad + 1}`;

  return (
    <div
      title={`Open a family ▾ — samples load on ${padName}`}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 4,
        rowGap: 4,
        padding: 0,
        minHeight: 0,
        minWidth: 0,
        position: 'relative',
        zIndex: 2,
        pointerEvents: 'auto',
      }}
    >
      <label
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
          flexShrink: 0,
          margin: 0,
        }}
      >
        <span style={{ fontSize: 7, color: '#6a6a78', fontWeight: 800 }}>PAD</span>
        <select
          value={targetPad}
          onChange={(e) => onTargetPadChange(Number(e.target.value))}
          style={{
            height: 22,
            padding: '0 4px',
            borderRadius: 3,
            border: `1px solid ${MINT_DIM}`,
            background: '#0c1214',
            color: '#d6e8ea',
            fontSize: 8,
            fontWeight: 800,
            maxWidth: 108,
            cursor: 'pointer',
            lineHeight: 1,
          }}
        >
          {CREATION_PAD_NAMES.map((name, i) => (
            <option key={i} value={i}>
              {i + 1}.{name}
            </option>
          ))}
        </select>
      </label>
      {activeFamily ? (
        <button
          type="button"
          onClick={() => onTargetPadChange(activeFamily.defaultPad)}
          style={{
            flexShrink: 0,
            height: 22,
            padding: '0 6px',
            borderRadius: 3,
            fontSize: 7,
            fontWeight: 900,
            fontFamily: 'monospace',
            border: `1px solid ${MINT_DIM}`,
            background: MINT_BG,
            color: MINT,
            cursor: 'pointer',
            lineHeight: 1,
          }}
        >
          DEF
        </button>
      ) : null}

      {catalog.families.map((f) => {
        const n = f.samples.length;
        const isOpen = openMenuFamilyId === f.id;
        const isGold = f.id === '808-sub';
        const isFocus = familyId === f.id;
        const borderMint = isOpen || isFocus;
        return (
          <button
            key={f.id}
            ref={(el) => setTriggerRef(f.id, el)}
            type="button"
            onClick={() => setOpenMenuFamilyId((prev) => (prev === f.id ? null : f.id))}
            style={{
              height: 22,
              padding: '0 6px',
              borderRadius: 4,
              border: `1px solid ${
                isGold && borderMint ? 'rgba(255, 200, 80, 0.55)' : borderMint ? MINT : MINT_DIM
              }`,
              background: isOpen ? (isGold ? 'rgba(255, 200, 80, 0.14)' : MINT_BG) : 'rgba(255,255,255,0.04)',
              color: isGold ? (borderMint ? '#ffd966' : '#b8a060') : borderMint ? MINT : '#c8cad4',
              fontSize: 8,
              fontWeight: 900,
              letterSpacing: 0.2,
              cursor: 'pointer',
              flex: '1 1 0',
              minWidth: 56,
              maxWidth: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 4,
              lineHeight: 1,
              boxSizing: 'border-box',
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>
              {f.label}{' '}
              <span style={{ fontWeight: 800, fontSize: 7, opacity: 0.72 }}>{n}</span>
            </span>
            <span style={{ opacity: 0.8, flexShrink: 0, fontSize: 8 }}>{isOpen ? '▴' : '▾'}</span>
          </button>
        );
      })}

      <SoundFamilySamplesMenuPortal
        open={openMenuFamilyId != null && openFamily != null}
        family={openFamily}
        triggerEl={activeTrigger}
        padName={padName}
        targetPad={targetPad}
        selectedFile={selectedFile}
        onClose={() => setOpenMenuFamilyId(null)}
        onPickSample={pickSample}
      />
    </div>
  );
}
