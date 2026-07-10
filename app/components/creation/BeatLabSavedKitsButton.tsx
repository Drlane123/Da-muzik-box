/**
 * User-saved Beat Lab kits — compact dropdown beside Default flagship kits.
 * Saves all 16 pads + sampler FX/EQ/trim on the active bank.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const VIOLET = '#c4b5fd';
const VIOLET_DIM = 'rgba(167, 139, 250, 0.45)';
const MINT = '#7cf4c6';

type MenuGeom = {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
};

function SavedKitMenuPortal({
  open,
  triggerEl,
  onClose,
  disabled,
  activeBank,
  savedKits,
  draftName,
  saveKitStatus,
  onSaveKit,
  onLoadKit,
  onRenameSavedKit,
  onDeleteSavedKit,
}: {
  open: boolean;
  triggerEl: HTMLElement | null;
  onClose: () => void;
  disabled: boolean;
  activeBank: number;
  savedKits: { id: string; name: string }[];
  draftName: string;
  saveKitStatus?: string | null;
  onSaveKit?: (name: string) => void;
  onLoadKit?: (id: string) => void;
  onRenameSavedKit?: (id: string, name: string) => void;
  onDeleteSavedKit?: (id: string) => void;
}) {
  const [geom, setGeom] = useState<MenuGeom | null>(null);
  const [nameDraft, setNameDraft] = useState(draftName);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

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
    if (open) setNameDraft(draftName);
  }, [open, draftName]);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (triggerEl?.contains(t)) return;
      const menus = document.querySelectorAll('[data-beatlab-saved-kit-menu="1"]');
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

  const bankLetter = String.fromCharCode(65 + activeBank);

  return createPortal(
    <div
      data-beatlab-saved-kit-menu="1"
      role="dialog"
      aria-label="My saved kits"
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
        border: `1px solid ${VIOLET_DIM}`,
        background: 'rgba(8,10,14,0.98)',
        boxShadow: '0 8px 28px rgba(0,0,0,0.55)',
        padding: 8,
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div style={{ fontSize: 8, fontWeight: 800, color: VIOLET, letterSpacing: 0.4, marginBottom: 4 }}>
        SAVE KIT · BANK {bankLetter}
      </div>
      <div style={{ fontSize: 8, color: '#6a6a78', marginBottom: 6, lineHeight: 1.3 }}>
        All pads, samples, EQ, FX &amp; trim on this bank.
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        <input
          type="text"
          value={nameDraft}
          disabled={disabled || typeof onSaveKit !== 'function'}
          onChange={(e) => setNameDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && onSaveKit) {
              e.preventDefault();
              onSaveKit(nameDraft);
            }
          }}
          placeholder="Kit name"
          maxLength={48}
          style={{
            flex: 1,
            minWidth: 0,
            padding: '4px 6px',
            borderRadius: 4,
            border: '1px solid #2a2a32',
            background: '#1a1a24',
            color: '#e8e8f0',
            fontSize: 10,
            fontWeight: 700,
          }}
        />
        <button
          type="button"
          disabled={disabled || typeof onSaveKit !== 'function'}
          onClick={() => onSaveKit?.(nameDraft)}
          style={{
            flexShrink: 0,
            padding: '4px 8px',
            borderRadius: 4,
            border: `1px solid ${VIOLET_DIM}`,
            background: 'rgba(167, 139, 250, 0.18)',
            color: VIOLET,
            fontSize: 9,
            fontWeight: 900,
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.45 : 1,
          }}
        >
          Save
        </button>
      </div>
      {saveKitStatus ? (
        <div style={{ fontSize: 8, fontWeight: 700, color: MINT, marginBottom: 6 }}>{saveKitStatus}</div>
      ) : null}
      {savedKits.length > 0 ? (
        <>
          <div
            style={{
              fontSize: 8,
              fontWeight: 800,
              color: '#6a6a78',
              marginBottom: 4,
              borderTop: '1px solid rgba(255,255,255,0.06)',
              paddingTop: 6,
            }}
          >
            LOAD SAVED KIT
          </div>
          {savedKits.map((sk) => (
            <div
              key={sk.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                marginBottom: 2,
              }}
            >
              {renameId === sk.id ? (
                <input
                  type="text"
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (renameDraft.trim()) onRenameSavedKit?.(sk.id, renameDraft);
                      setRenameId(null);
                    }
                    if (e.key === 'Escape') setRenameId(null);
                  }}
                  onBlur={() => {
                    if (renameDraft.trim()) onRenameSavedKit?.(sk.id, renameDraft);
                    setRenameId(null);
                  }}
                  autoFocus
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '3px 6px',
                    borderRadius: 3,
                    border: '1px solid #2a2a32',
                    background: '#1a1a24',
                    color: '#e8e8f0',
                    fontSize: 10,
                  }}
                />
              ) : (
                <button
                  type="button"
                  disabled={disabled}
                  title={`Load "${sk.name}" on bank ${bankLetter}`}
                  onClick={() => {
                    onLoadKit?.(sk.id);
                    onClose();
                  }}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    textAlign: 'left',
                    padding: '5px 6px',
                    borderRadius: 3,
                    border: 'none',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    background: 'transparent',
                    color: '#e8e8f0',
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    opacity: disabled ? 0.45 : 1,
                  }}
                >
                  {sk.name}
                </button>
              )}
              {renameId !== sk.id ? (
                <>
                  <button
                    type="button"
                    title="Rename"
                    onClick={() => {
                      setRenameId(sk.id);
                      setRenameDraft(sk.name);
                    }}
                    style={{
                      flexShrink: 0,
                      padding: '2px 5px',
                      borderRadius: 3,
                      border: '1px solid #2a2a32',
                      background: '#1a1a24',
                      color: '#aaa',
                      fontSize: 8,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Ren
                  </button>
                  <button
                    type="button"
                    title="Delete"
                    onClick={() => onDeleteSavedKit?.(sk.id)}
                    style={{
                      flexShrink: 0,
                      padding: '2px 5px',
                      borderRadius: 3,
                      border: '1px solid #633',
                      background: '#1a1014',
                      color: '#f6a9a9',
                      fontSize: 8,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Del
                  </button>
                </>
              ) : null}
            </div>
          ))}
        </>
      ) : (
        <div style={{ fontSize: 8, color: '#6a6a78', fontStyle: 'italic' }}>No saved kits yet.</div>
      )}
    </div>,
    document.body,
  );
}

export function BeatLabSavedKitsButton({
  disabled = false,
  activeBank = 0,
  savedKits = [],
  draftName = '',
  saveKitStatus = null,
  onSaveKit,
  onLoadKit,
  onRenameSavedKit,
  onDeleteSavedKit,
}: {
  disabled?: boolean;
  activeBank?: number;
  savedKits?: { id: string; name: string }[];
  draftName?: string;
  saveKitStatus?: string | null;
  onSaveKit?: (name: string) => void;
  onLoadKit?: (id: string) => void;
  onRenameSavedKit?: (id: string, name: string) => void;
  onDeleteSavedKit?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const count = savedKits.length;

  if (typeof onSaveKit !== 'function') return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        title="Save / load your custom kits (pads + FX + EQ)"
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => !prev);
        }}
        style={{
          padding: '4px 8px',
          borderRadius: 4,
          border: `1px solid ${open ? VIOLET : VIOLET_DIM}`,
          background: open ? 'rgba(167, 139, 250, 0.14)' : 'rgba(12, 12, 18, 0.9)',
          color: VIOLET,
          fontSize: 9,
          fontWeight: 800,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.45 : 1,
          whiteSpace: 'nowrap',
        }}
      >
        My kits ({count}) {open ? '▴' : '▾'}
      </button>
      <SavedKitMenuPortal
        open={open}
        triggerEl={triggerRef.current}
        disabled={disabled}
        activeBank={activeBank}
        savedKits={savedKits}
        draftName={draftName}
        saveKitStatus={saveKitStatus}
        onSaveKit={onSaveKit}
        onLoadKit={onLoadKit}
        onRenameSavedKit={onRenameSavedKit}
        onDeleteSavedKit={onDeleteSavedKit}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
