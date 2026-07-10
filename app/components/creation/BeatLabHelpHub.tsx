/**
 * Beat Lab instructions — tabbed help hub + tiny per-section triggers.
 * Triggers are inline only; they do not resize parent panels.
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
  BEAT_LAB_HELP_INTRO_STORAGE,
  BEAT_LAB_HELP_SECTIONS,
  type BeatLabHelpTabId,
} from '@/app/lib/creationStation/beatLabInstructions';

const MINT = '#7cf4c6';

type BeatLabHelpContextValue = {
  openHelp: (tab: BeatLabHelpTabId) => void;
};

const BeatLabHelpContext = createContext<BeatLabHelpContextValue | null>(null);

function useBeatLabHelp(): BeatLabHelpContextValue {
  const ctx = useContext(BeatLabHelpContext);
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
  border: '1px solid rgba(124, 244, 198, 0.4)',
  background: 'rgba(124, 244, 198, 0.1)',
  color: MINT,
  fontSize: 8,
  fontWeight: 900,
  lineHeight: 1,
  cursor: 'pointer',
  verticalAlign: 'middle',
};

/** Tiny ? tab — sits beside section titles without changing panel size. */
export function BeatLabHelpTip({
  tab,
  title = 'How to use this section',
}: {
  tab: BeatLabHelpTabId;
  title?: string;
}) {
  const { openHelp } = useBeatLabHelp();
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

function BeatLabHelpHubModal({
  open,
  tab,
  onTabChange,
  onClose,
}: {
  open: boolean;
  tab: BeatLabHelpTabId;
  onTabChange: (id: BeatLabHelpTabId) => void;
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

  const section = BEAT_LAB_HELP_SECTIONS.find((s) => s.id === tab) ?? BEAT_LAB_HELP_SECTIONS[0]!;

  return createPortal(
    <div
      role="dialog"
      aria-label="Beat Lab instructions"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 900,
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
          width: 'min(440px, 96vw)',
          maxHeight: 'min(420px, 82vh)',
          display: 'flex',
          flexDirection: 'column',
          background: '#0a0a10',
          border: '1px solid rgba(124, 244, 198, 0.35)',
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
            borderBottom: '1px solid #1e1e28',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 900, color: MINT, letterSpacing: 0.5 }}>
            BEAT LAB HELP
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
          {BEAT_LAB_HELP_SECTIONS.map((s) => {
            const active = s.id === tab;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onTabChange(s.id)}
                style={{
                  padding: '3px 7px',
                  borderRadius: 4,
                  border: `1px solid ${active ? 'rgba(124, 244, 198, 0.55)' : 'rgba(255,255,255,0.1)'}`,
                  background: active ? 'rgba(124, 244, 198, 0.14)' : 'rgba(255,255,255,0.04)',
                  color: active ? MINT : '#9a9aa8',
                  fontSize: 8,
                  fontWeight: 900,
                  letterSpacing: 0.3,
                  cursor: 'pointer',
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
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Wrap Beat Lab UI — auto-opens Start tab once on first visit. */
export function BeatLabHelpProvider({
  children,
  autoIntro = true,
}: {
  children: ReactNode;
  autoIntro?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<BeatLabHelpTabId>('overview');

  useEffect(() => {
    if (!autoIntro || typeof window === 'undefined') return;
    try {
      if (window.localStorage.getItem(BEAT_LAB_HELP_INTRO_STORAGE) === '1') return;
      window.localStorage.setItem(BEAT_LAB_HELP_INTRO_STORAGE, '1');
      setTab('overview');
      setOpen(true);
    } catch {
      /* ignore */
    }
  }, [autoIntro]);

  const openHelp = useCallback((next: BeatLabHelpTabId) => {
    setTab(next);
    setOpen(true);
  }, []);

  return (
    <BeatLabHelpContext.Provider value={{ openHelp }}>
      {children}
      <BeatLabHelpHubModal
        open={open}
        tab={tab}
        onTabChange={setTab}
        onClose={() => setOpen(false)}
      />
    </BeatLabHelpContext.Provider>
  );
}
