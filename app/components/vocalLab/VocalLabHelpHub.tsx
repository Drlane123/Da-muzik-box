/**
 * AI Vocal Lab instructions — tabbed help + tiny ? triggers (no panel resize).
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
  VOCAL_LAB_HELP_SECTIONS,
  type VocalLabHelpTabId,
} from '@/app/lib/vocalLab/vocalLabInstructions';

const PINK = '#f472b6';
const CYAN = '#00E5FF';
const MINT = '#7cf4c6';

type VocalLabHelpContextValue = {
  openHelp: (tab: VocalLabHelpTabId) => void;
};

const VocalLabHelpContext = createContext<VocalLabHelpContextValue | null>(null);

function useVocalLabHelp(): VocalLabHelpContextValue {
  const ctx = useContext(VocalLabHelpContext);
  if (!ctx) {
    return { openHelp: () => {} };
  }
  return ctx;
}

export function useVocalLabHelpContext(): VocalLabHelpContextValue {
  return useVocalLabHelp();
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
  border: '1px solid rgba(244, 114, 182, 0.45)',
  background: 'rgba(244, 114, 182, 0.1)',
  color: PINK,
  fontSize: 8,
  fontWeight: 900,
  lineHeight: 1,
  cursor: 'pointer',
  verticalAlign: 'middle',
};

/** Tiny ? tab beside section titles — no panel resize. */
export function VocalLabHelpTip({
  tab,
  title = 'How to use this section',
}: {
  tab: VocalLabHelpTabId;
  title?: string;
}) {
  const { openHelp } = useVocalLabHelp();
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

function VocalLabHelpHubModal({
  open,
  tab,
  onTabChange,
  onClose,
}: {
  open: boolean;
  tab: VocalLabHelpTabId;
  onTabChange: (id: VocalLabHelpTabId) => void;
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

  const section =
    VOCAL_LAB_HELP_SECTIONS.find((s) => s.id === tab) ?? VOCAL_LAB_HELP_SECTIONS[0]!;

  return createPortal(
    <div
      role="dialog"
      aria-label="AI Vocal Lab instructions"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10085,
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
          width: 'min(480px, 96vw)',
          maxHeight:
            tab === 'hum-capture' || tab === 'overview'
              ? 'min(540px, 88vh)'
              : 'min(440px, 84vh)',
          display: 'flex',
          flexDirection: 'column',
          background: '#0a080c',
          border: '1px solid rgba(244, 114, 182, 0.35)',
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
            borderBottom: '1px solid #2a1a28',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 900, color: PINK, letterSpacing: 0.5 }}>
            AI VOCAL LAB HELP
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
            padding: '8px 10px',
            borderBottom: '1px solid #1a1218',
            flexShrink: 0,
          }}
        >
          {VOCAL_LAB_HELP_SECTIONS.map((s) => {
            const active = s.id === tab;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onTabChange(s.id)}
                style={{
                  padding: '3px 7px',
                  borderRadius: 4,
                  border: `1px solid ${active ? 'rgba(244, 114, 182, 0.6)' : s.highlight ? 'rgba(0, 229, 255, 0.35)' : 'rgba(255,255,255,0.1)'}`,
                  background: active
                    ? 'rgba(244, 114, 182, 0.18)'
                    : s.highlight
                      ? 'rgba(0, 229, 255, 0.08)'
                      : 'rgba(255,255,255,0.04)',
                  color: active ? PINK : s.highlight ? CYAN : '#9a9aa8',
                  fontSize: 8,
                  fontWeight: 900,
                  letterSpacing: 0.3,
                  cursor: 'pointer',
                  boxShadow: s.highlight && !active ? '0 0 10px rgba(0, 229, 255, 0.12)' : undefined,
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
                  color: MINT,
                  textShadow: '0 0 8px rgba(124, 244, 198, 0.45)',
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

/** Wrap a Vocal Lab screen — first visit opens the tab you pass in. */
export function VocalLabHelpProvider({
  children,
  autoIntro = true,
  active = true,
  introTab = 'hum-capture',
  introStorageKey,
}: {
  children: ReactNode;
  autoIntro?: boolean;
  active?: boolean;
  introTab?: VocalLabHelpTabId;
  introStorageKey?: string;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<VocalLabHelpTabId>(introTab);

  useEffect(() => {
    if (!autoIntro || !active || !introStorageKey || typeof window === 'undefined') return;
    try {
      if (window.localStorage.getItem(introStorageKey) === '1') return;
      window.localStorage.setItem(introStorageKey, '1');
      setTab(introTab);
      setOpen(true);
    } catch {
      /* ignore */
    }
  }, [autoIntro, active, introTab, introStorageKey]);

  const openHelp = useCallback((next: VocalLabHelpTabId) => {
    setTab(next);
    setOpen(true);
  }, []);

  return (
    <VocalLabHelpContext.Provider value={{ openHelp }}>
      {children}
      <VocalLabHelpHubModal
        open={open}
        tab={tab}
        onTabChange={setTab}
        onClose={() => setOpen(false)}
      />
    </VocalLabHelpContext.Provider>
  );
}
