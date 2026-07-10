/**
 * 808 Lab instructions — tabbed help + tiny ? triggers (no panel resize).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

import {
  LAB808_HELP_INTRO_STORAGE,
  LAB808_HELP_SECTIONS,
  type Lab808HelpTabId,
} from '@/app/lib/creationStation/lab808Instructions';

const MINT = '#7cf4c6';
const GOLD = '#fde68a';
const MINT_DIM = 'rgba(124, 244, 198, 0.4)';

type Lab808HelpContextValue = {
  openHelp: (tab: Lab808HelpTabId) => void;
};

const Lab808HelpContext = createContext<Lab808HelpContextValue | null>(null);

function useLab808Help(): Lab808HelpContextValue {
  const ctx = useContext(Lab808HelpContext);
  if (!ctx) {
    return { openHelp: () => {} };
  }
  return ctx;
}

const tipBtnStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 14,
  height: 14,
  padding: 0,
  margin: 0,
  flexShrink: 0,
  borderRadius: 3,
  border: `1px solid ${MINT_DIM}`,
  background: 'rgba(124, 244, 198, 0.1)',
  color: MINT,
  fontSize: 8,
  fontWeight: 900,
  lineHeight: 1,
  cursor: 'pointer',
  verticalAlign: 'middle',
};

/** Tiny ? tab beside section titles — no panel resize. */
export function Lab808HelpTip({
  tab,
  title = 'How to use this section',
}: {
  tab: Lab808HelpTabId;
  title?: string;
}) {
  const { openHelp } = useLab808Help();
  return (
    <button
      type="button"
      aria-label={title}
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        openHelp(tab);
      }}
      style={tipBtnStyle}
    >
      ?
    </button>
  );
}

function Lab808HelpHubModal({
  open,
  tab,
  onTabChange,
  onClose,
}: {
  open: boolean;
  tab: Lab808HelpTabId;
  onTabChange: (id: Lab808HelpTabId) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const section = LAB808_HELP_SECTIONS.find((s) => s.id === tab) ?? LAB808_HELP_SECTIONS[0]!;

  return createPortal(
    <div
      role="dialog"
      aria-label="808 Lab instructions"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10070,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 'min(460px, 96vw)',
          maxHeight: tab === 'chord-lock' ? 'min(520px, 88vh)' : 'min(440px, 84vh)',
          display: 'flex',
          flexDirection: 'column',
          background: '#0a0a0e',
          border: '1px solid rgba(202, 138, 4, 0.45)',
          borderRadius: 10,
          boxShadow: '0 20px 48px rgba(0,0,0,0.65)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 10px',
            borderBottom: '1px solid #2a2418',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 900, color: GOLD, letterSpacing: 0.5 }}>
            808 LAB HELP
          </span>
          <button
            type="button"
            aria-label="Close help"
            onClick={onClose}
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              borderRadius: 5,
              border: '1px solid #2a2a32',
              background: '#12121a',
              color: '#9a9aa8',
              cursor: 'pointer',
            }}
          >
            <X size={14} />
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
            padding: '6px 8px',
            borderBottom: '1px solid #16161e',
            flexShrink: 0,
          }}
        >
          {LAB808_HELP_SECTIONS.map((s) => {
            const active = s.id === tab;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onTabChange(s.id)}
                style={{
                  padding: '3px 7px',
                  borderRadius: 4,
                  border: `1px solid ${active ? 'rgba(202, 138, 4, 0.65)' : s.highlight ? 'rgba(124, 244, 198, 0.35)' : 'rgba(255,255,255,0.1)'}`,
                  background: active
                    ? 'rgba(202, 138, 4, 0.18)'
                    : s.highlight
                      ? 'rgba(124, 244, 198, 0.08)'
                      : 'rgba(255,255,255,0.04)',
                  color: active ? GOLD : s.highlight ? MINT : '#9a9aa8',
                  fontSize: 8,
                  fontWeight: 900,
                  letterSpacing: 0.3,
                  cursor: 'pointer',
                  boxShadow: s.highlight && !active ? '0 0 10px rgba(124, 244, 198, 0.12)' : undefined,
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        <div style={{ padding: '10px 12px 12px', overflowY: 'auto', flex: '1 1 auto' }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: '#e8e8f0', marginBottom: 8 }}>
            {section.title}
            {section.highlight ? (
              <span
                style={{
                  marginLeft: 8,
                  fontSize: 8,
                  fontWeight: 900,
                  color: GOLD,
                  textShadow: '0 0 8px rgba(202, 138, 4, 0.45)',
                }}
              >
                ★ CORE
              </span>
            ) : null}
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {section.lines.map((line) => (
              <li
                key={line}
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: '#b8bcc8',
                  lineHeight: 1.45,
                }}
              >
                {line.replace(/\*\*(.+?)\*\*/g, '$1')}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Wrap 808 Lab — first visit opens ★ Chord lock tab. */
export function Lab808HelpProvider({
  children,
  autoIntro = true,
  active = true,
}: {
  children: ReactNode;
  autoIntro?: boolean;
  active?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Lab808HelpTabId>('chord-lock');

  useEffect(() => {
    if (!autoIntro || !active || typeof window === 'undefined') return;
    try {
      if (window.localStorage.getItem(LAB808_HELP_INTRO_STORAGE) === '1') return;
      window.localStorage.setItem(LAB808_HELP_INTRO_STORAGE, '1');
      setTab('chord-lock');
      setOpen(true);
    } catch {
      /* ignore */
    }
  }, [autoIntro, active]);

  const openHelp = useCallback((next: Lab808HelpTabId) => {
    setTab(next);
    setOpen(true);
  }, []);

  return (
    <Lab808HelpContext.Provider value={{ openHelp }}>
      {children}
      <Lab808HelpHubModal
        open={open}
        tab={tab}
        onTabChange={setTab}
        onClose={() => setOpen(false)}
      />
    </Lab808HelpContext.Provider>
  );
}
