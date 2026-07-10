/**
 * Beat Pads — save / load loop sessions (pattern + kit snapshot).
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Save } from 'lucide-react';

const MINT = '#7cf4c6';

type MenuGeom = {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
};

function SavedSessionMenuPortal({
  open,
  triggerEl,
  onClose,
  disabled,
  activeBank,
  savedSessions,
  draftName,
  saveStatus,
  onSaveSession,
  onLoadSession,
  onRenameSession,
  onDeleteSession,
}: {
  open: boolean;
  triggerEl: HTMLElement | null;
  onClose: () => void;
  disabled: boolean;
  activeBank: number;
  savedSessions: { id: string; name: string; savedAt: number }[];
  draftName: string;
  saveStatus?: string | null;
  onSaveSession?: (name: string) => void;
  onLoadSession?: (id: string) => void;
  onRenameSession?: (id: string, name: string) => void;
  onDeleteSession?: (id: string) => void;
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
    const desiredMax = Math.min(340, Math.floor(window.innerHeight * 0.55));
    const r = triggerEl.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom - margin - gap;
    const maxHeight = Math.min(desiredMax, Math.max(140, spaceBelow));
    const width = Math.max(260, r.width);
    const maxLeft = window.innerWidth - width - margin;
    const left = Math.max(margin, Math.min(r.left, maxLeft));
    setGeom({ left, top: r.bottom + gap, width, maxHeight });
  }, [open, triggerEl]);

  useEffect(() => {
    if (open) setNameDraft(draftName);
  }, [open, draftName]);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (triggerEl?.contains(t)) return;
      const menus = document.querySelectorAll('[data-beatpads-saved-session-menu="1"]');
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
      data-beatpads-saved-session-menu="1"
      style={{
        position: 'fixed',
        left: geom.left,
        top: geom.top,
        width: geom.width,
        maxHeight: geom.maxHeight,
        overflowY: 'auto',
        zIndex: 120000,
        borderRadius: 8,
        border: '1px solid rgba(124, 244, 198, 0.35)',
        background: '#0e1016',
        boxShadow: '0 12px 40px rgba(0,0,0,0.65)',
        padding: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.12em', color: MINT }}>
        SAVE LOOP · BANK {bankLetter}
      </div>
      <div style={{ fontSize: 8, color: '#7a8494', lineHeight: 1.35 }}>
        Saves your drum pattern and every loaded pad sample + FX on this bank.
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <input
          value={nameDraft}
          disabled={disabled || typeof onSaveSession !== 'function'}
          onChange={(e) => setNameDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && onSaveSession) {
              e.preventDefault();
              onSaveSession(nameDraft);
            }
          }}
          placeholder="Loop name…"
          style={{
            flex: 1,
            minWidth: 0,
            height: 28,
            padding: '0 8px',
            borderRadius: 5,
            border: '1px solid rgba(124, 244, 198, 0.3)',
            background: '#0a0c10',
            color: '#e8eef4',
            fontSize: 10,
            fontWeight: 600,
          }}
        />
        <button
          type="button"
          disabled={disabled || typeof onSaveSession !== 'function'}
          onClick={() => onSaveSession?.(nameDraft)}
          style={{
            height: 28,
            padding: '0 10px',
            borderRadius: 5,
            border: '1px solid rgba(124, 244, 198, 0.55)',
            background: 'rgba(124, 244, 198, 0.14)',
            color: MINT,
            fontSize: 9,
            fontWeight: 900,
            cursor: disabled ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Save
        </button>
      </div>
      {saveStatus ? (
        <div style={{ fontSize: 8, color: '#9aa3b0', fontWeight: 600 }}>{saveStatus}</div>
      ) : null}
      {savedSessions.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 8, fontWeight: 900, letterSpacing: '0.1em', color: '#8a9098' }}>
            MY SAVED LOOPS
          </div>
          {savedSessions.map((row) => (
            <div
              key={row.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 6px',
                borderRadius: 5,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.03)',
              }}
            >
              {renameId === row.id ? (
                <input
                  autoFocus
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && onRenameSession) {
                      onRenameSession(row.id, renameDraft);
                      setRenameId(null);
                    }
                    if (e.key === 'Escape') setRenameId(null);
                  }}
                  onBlur={() => {
                    if (renameDraft.trim() && onRenameSession) {
                      onRenameSession(row.id, renameDraft);
                    }
                    setRenameId(null);
                  }}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    height: 24,
                    padding: '0 6px',
                    borderRadius: 4,
                    border: '1px solid rgba(124,244,198,0.35)',
                    background: '#0a0c10',
                    color: '#e8eef4',
                    fontSize: 9,
                  }}
                />
              ) : (
                <button
                  type="button"
                  disabled={disabled || typeof onLoadSession !== 'function'}
                  onClick={() => onLoadSession?.(row.id)}
                  title={`Load "${row.name}"`}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    textAlign: 'left',
                    background: 'transparent',
                    border: 'none',
                    color: '#d8dee8',
                    fontSize: 9,
                    fontWeight: 700,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ★ {row.name}
                </button>
              )}
              {typeof onRenameSession === 'function' ? (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setRenameId(row.id);
                    setRenameDraft(row.name);
                  }}
                  style={iconBtnStyle}
                  title="Rename"
                >
                  ✎
                </button>
              ) : null}
              {typeof onDeleteSession === 'function' ? (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    if (window.confirm(`Delete saved loop "${row.name}"?`)) {
                      onDeleteSession(row.id);
                    }
                  }}
                  style={{ ...iconBtnStyle, color: '#e85d75' }}
                  title="Delete"
                >
                  ×
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 8, color: '#6a7280' }}>No saved loops yet.</div>
      )}
    </div>,
    document.body,
  );
}

const iconBtnStyle: CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: 4,
  border: '1px solid rgba(255,255,255,0.12)',
  background: '#12121a',
  color: '#aeb7be',
  fontSize: 11,
  cursor: 'pointer',
  flexShrink: 0,
};

export function BeatPadsSavedSessionsButton({
  disabled = false,
  activeBank = 0,
  savedSessions = [],
  saveStatus,
  onSaveSession,
  onLoadSession,
  onRenameSession,
  onDeleteSession,
}: {
  disabled?: boolean;
  activeBank?: number;
  savedSessions?: { id: string; name: string; savedAt: number }[];
  saveStatus?: string | null;
  onSaveSession?: (name: string) => void;
  onLoadSession?: (id: string) => void;
  onRenameSession?: (id: string, name: string) => void;
  onDeleteSession?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const draftName = `Beat Pads ${String.fromCharCode(65 + activeBank)}`;

  if (typeof onSaveSession !== 'function') return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        title="Save or load a loop (pattern + kit)"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          height: 26,
          padding: '0 8px',
          borderRadius: 5,
          border: `1px solid ${open ? 'rgba(124, 244, 198, 0.55)' : 'rgba(124, 244, 198, 0.35)'}`,
          background: open ? 'rgba(124, 244, 198, 0.14)' : '#12121a',
          color: MINT,
          fontSize: 9,
          fontWeight: 800,
          cursor: disabled ? 'not-allowed' : 'pointer',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        <Save size={11} aria-hidden />
        Save loop
      </button>
      <SavedSessionMenuPortal
        open={open}
        triggerEl={triggerRef.current}
        onClose={() => setOpen(false)}
        disabled={disabled}
        activeBank={activeBank}
        savedSessions={savedSessions}
        draftName={draftName}
        saveStatus={saveStatus}
        onSaveSession={(name) => {
          onSaveSession(name);
        }}
        onLoadSession={(id) => {
          onLoadSession?.(id);
          setOpen(false);
        }}
        onRenameSession={onRenameSession}
        onDeleteSession={onDeleteSession}
      />
    </>
  );
}
