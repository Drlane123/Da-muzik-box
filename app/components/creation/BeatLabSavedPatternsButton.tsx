/**
 * User-saved Beat Lab patterns — compact dropdown in Pattern Bank header.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const MINT = '#7cf4c6';
const MINT_DIM = 'rgba(124, 244, 198, 0.35)';

type MenuGeom = {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
};

function SavedPatternMenuPortal({
  open,
  triggerEl,
  onClose,
  disabled,
  savedPatterns,
  draftName,
  savePatternStatus,
  onSavePattern,
  onLoadPattern,
  onRenameSavedPattern,
  onDeleteSavedPattern,
}: {
  open: boolean;
  triggerEl: HTMLElement | null;
  onClose: () => void;
  disabled: boolean;
  savedPatterns: { id: string; name: string; hasKit: boolean }[];
  draftName: string;
  savePatternStatus?: string | null;
  onSavePattern?: (name: string) => void | Promise<void>;
  onLoadPattern?: (id: string) => void;
  onRenameSavedPattern?: (id: string, name: string) => void;
  onDeleteSavedPattern?: (id: string) => void;
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
    const spaceAbove = r.top - margin - gap;

    if (spaceAbove >= 120) {
      const maxHeight = Math.min(desiredMax, spaceAbove);
      const top = r.top - maxHeight - gap;
      const width = Math.max(240, Math.max(r.width, 200));
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
    const width = Math.max(240, Math.max(r.width, 200));
    const maxLeft = window.innerWidth - width - margin;
    const left = Math.max(margin, Math.min(r.left, maxLeft));
    setGeom({ left, top: r.bottom + gap, width, maxHeight });
  }, [open, triggerEl]);

  useEffect(() => {
    if (open) setNameDraft(draftName);
  }, [open, draftName]);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (triggerEl?.contains(t)) return;
      const menus = document.querySelectorAll('[data-beatlab-saved-pattern-menu="1"]');
      for (const m of menus) {
        if (m.contains(t)) return;
      }
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const timer = window.setTimeout(() => {
      document.addEventListener('pointerdown', onOutside, true);
    }, 0);
    window.addEventListener('resize', onClose);
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('pointerdown', onOutside, true);
      window.removeEventListener('resize', onClose);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, triggerEl, onClose]);

  if (!open || !geom || typeof document === 'undefined') return null;

  return createPortal(
    <div
      data-beatlab-saved-pattern-menu="1"
      role="dialog"
      aria-label="My saved patterns"
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
        boxShadow: '0 8px 28px rgba(0,0,0,0.55)',
        padding: 8,
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div style={{ fontSize: 8, fontWeight: 800, color: MINT, letterSpacing: 0.4, marginBottom: 4 }}>
        SAVE PATTERN
      </div>
      <div style={{ fontSize: 8, color: '#6a6a78', marginBottom: 6, lineHeight: 1.3 }}>
        Saves pattern (A &amp; B, BPM, loop) + whatever kit is loaded on this bank.
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        <input
          type="text"
          value={nameDraft}
          disabled={disabled || typeof onSavePattern !== 'function'}
          onChange={(e) => setNameDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && onSavePattern) {
              e.preventDefault();
              e.stopPropagation();
              void onSavePattern(nameDraft);
            }
          }}
          onPointerDown={(e) => e.stopPropagation()}
          placeholder="Pattern name"
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
          disabled={disabled || typeof onSavePattern !== 'function'}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            void onSavePattern?.(nameDraft);
          }}
          style={{
            flexShrink: 0,
            padding: '4px 8px',
            borderRadius: 4,
            border: `1px solid ${MINT_DIM}`,
            background: 'rgba(124, 244, 198, 0.12)',
            color: MINT,
            fontSize: 9,
            fontWeight: 900,
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.45 : 1,
          }}
        >
          Save
        </button>
      </div>
      {savePatternStatus ? (
        <div style={{ fontSize: 8, fontWeight: 700, color: MINT, marginBottom: 6 }}>{savePatternStatus}</div>
      ) : null}
      {savedPatterns.length > 0 ? (
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
            LOAD SAVED PATTERN
          </div>
          {savedPatterns.map((sp) => (
            <div
              key={sp.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                marginBottom: 2,
              }}
            >
              {renameId === sp.id ? (
                <input
                  type="text"
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (renameDraft.trim()) onRenameSavedPattern?.(sp.id, renameDraft);
                      setRenameId(null);
                    }
                    if (e.key === 'Escape') setRenameId(null);
                  }}
                  onBlur={() => {
                    if (renameDraft.trim()) onRenameSavedPattern?.(sp.id, renameDraft);
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
                <>
                  <button
                    type="button"
                    disabled={disabled}
                    title={sp.hasKit ? 'Load pattern + kit' : 'Load pattern (no kit saved)'}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      onLoadPattern?.(sp.id);
                      onClose();
                    }}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      textAlign: 'left',
                      padding: '5px 6px',
                      borderRadius: 3,
                      border: 'none',
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
                    {sp.name}
                    {sp.hasKit ? (
                      <span style={{ marginLeft: 4, fontSize: 8, color: MINT, fontWeight: 800 }}>+ kit</span>
                    ) : null}
                  </button>
                </>
              )}
              {renameId !== sp.id ? (
                <>
                  <button
                    type="button"
                    title="Rename"
                    onClick={() => {
                      setRenameId(sp.id);
                      setRenameDraft(sp.name);
                    }}
                    style={{
                      flexShrink: 0,
                      padding: '2px 6px',
                      borderRadius: 3,
                      border: '1px solid #2a2a32',
                      background: '#1a1a24',
                      color: '#9ca3af',
                      fontSize: 8,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    title="Delete saved pattern"
                    onClick={() => onDeleteSavedPattern?.(sp.id)}
                    style={{
                      flexShrink: 0,
                      padding: '2px 6px',
                      borderRadius: 3,
                      border: '1px solid #633',
                      background: '#1a1014',
                      color: '#f6a9a9',
                      fontSize: 8,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Delete
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  title="Delete saved pattern"
                  onClick={() => onDeleteSavedPattern?.(sp.id)}
                  style={{
                    flexShrink: 0,
                    padding: '2px 6px',
                    borderRadius: 3,
                    border: '1px solid #633',
                    background: '#1a1014',
                    color: '#f6a9a9',
                    fontSize: 8,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Delete
                </button>
              )}
            </div>
          ))}
        </>
      ) : (
        <div style={{ fontSize: 8, color: '#6a6a78', fontStyle: 'italic' }}>No saved patterns yet.</div>
      )}
    </div>,
    document.body,
  );
}

export function BeatLabSavedPatternsButton({
  disabled = false,
  savedPatterns = [],
  draftName = '',
  savePatternStatus = null,
  onSavePattern,
  onLoadPattern,
  onRenameSavedPattern,
  onDeleteSavedPattern,
}: {
  disabled?: boolean;
  savedPatterns?: { id: string; name: string; hasKit: boolean }[];
  draftName?: string;
  savePatternStatus?: string | null;
  onSavePattern?: (name: string) => void | Promise<void>;
  onLoadPattern?: (id: string) => void;
  onRenameSavedPattern?: (id: string, name: string) => void;
  onDeleteSavedPattern?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const count = savedPatterns.length;

  if (typeof onSavePattern !== 'function') return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        title="Save / load patterns with their kits (pads + FX)"
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => !prev);
        }}
        style={{
          padding: '3px 6px',
          borderRadius: 3,
          border: `1px solid ${open ? MINT : MINT_DIM}`,
          background: open ? 'rgba(124, 244, 198, 0.12)' : 'rgba(255,255,255,0.04)',
          color: MINT,
          fontSize: 8,
          fontWeight: 900,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.45 : 1,
          whiteSpace: 'nowrap',
          lineHeight: 1,
        }}
      >
        My patterns ({count}) {open ? '▴' : '▾'}
      </button>
      <SavedPatternMenuPortal
        open={open}
        triggerEl={triggerRef.current}
        disabled={disabled}
        savedPatterns={savedPatterns}
        draftName={draftName}
        savePatternStatus={savePatternStatus}
        onSavePattern={onSavePattern}
        onLoadPattern={onLoadPattern}
        onRenameSavedPattern={onRenameSavedPattern}
        onDeleteSavedPattern={onDeleteSavedPattern}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
