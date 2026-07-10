/**
 * Chord Builder instructions — tabbed help + tiny ? triggers.
 * Progression tab is highlighted; no panel resize.
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
  CHORD_BUILDER_HELP_INTRO_STORAGE,
  CHORD_BUILDER_HELP_SECTIONS,
  type ChordBuilderHelpTabId,
} from '@/app/lib/creationStation/chordBuilderInstructions';

const MINT = '#7cf4c6';
const MINT_DIM = 'rgba(124, 244, 198, 0.4)';

type ChordBuilderHelpContextValue = {
  openHelp: (tab: ChordBuilderHelpTabId) => void;
};

const ChordBuilderHelpContext = createContext<ChordBuilderHelpContextValue | null>(null);

function useChordBuilderHelp(): ChordBuilderHelpContextValue {
  const ctx = useContext(ChordBuilderHelpContext);
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
  background: 'rgba(124, 244, 198, 0.12)',
  color: MINT,
  fontSize: 8,
  fontWeight: 900,
  lineHeight: 1,
  cursor: 'pointer',
  verticalAlign: 'middle',
};

/** Tiny ? tab beside section titles — no panel resize. */
export function ChordBuilderHelpTip({
  tab,
  title = 'How to use this section',
}: {
  tab: ChordBuilderHelpTabId;
  title?: string;
}) {
  const { openHelp } = useChordBuilderHelp();
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

function ChordBuilderHelpHubModal({
  open,
  tab,
  onTabChange,
  onClose,
}: {
  open: boolean;
  tab: ChordBuilderHelpTabId;
  onTabChange: (id: ChordBuilderHelpTabId) => void;
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

  const section = CHORD_BUILDER_HELP_SECTIONS.find((s) => s.id === tab) ?? CHORD_BUILDER_HELP_SECTIONS[0]!;

  return createPortal(
    <div
      role="dialog"
      aria-label="Chord Builder instructions"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10060,
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
          maxHeight: tab === 'progressions' ? 'min(520px, 88vh)' : 'min(440px, 84vh)',
          display: 'flex',
          flexDirection: 'column',
          background: '#070b10',
          border: '1px solid rgba(124, 244, 198, 0.4)',
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
            borderBottom: '1px solid #1a2e28',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 900, color: MINT, letterSpacing: 0.5 }}>
            CHORD BUILDER HELP
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
          {CHORD_BUILDER_HELP_SECTIONS.map((s) => {
            const active = s.id === tab;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onTabChange(s.id)}
                style={{
                  padding: '3px 7px',
                  borderRadius: 4,
                  border: `1px solid ${active ? 'rgba(124, 244, 198, 0.6)' : s.highlight ? 'rgba(124, 244, 198, 0.35)' : 'rgba(255,255,255,0.1)'}`,
                  background: active
                    ? 'rgba(124, 244, 198, 0.18)'
                    : s.highlight
                      ? 'rgba(124, 244, 198, 0.08)'
                      : 'rgba(255,255,255,0.04)',
                  color: active ? MINT : s.highlight ? '#d5fbe8' : '#9a9aa8',
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

/** Wrap Chord Builder — first visit opens ★ Progression tab. */
export function ChordBuilderHelpProvider({
  children,
  autoIntro = true,
  active = true,
}: {
  children: ReactNode;
  autoIntro?: boolean;
  active?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<ChordBuilderHelpTabId>('progressions');

  useEffect(() => {
    if (!autoIntro || !active || typeof window === 'undefined') return;
    try {
      if (window.localStorage.getItem(CHORD_BUILDER_HELP_INTRO_STORAGE) === '1') return;
      window.localStorage.setItem(CHORD_BUILDER_HELP_INTRO_STORAGE, '1');
      setTab('progressions');
      setOpen(true);
    } catch {
      /* ignore */
    }
  }, [autoIntro, active]);

  const openHelp = useCallback((next: ChordBuilderHelpTabId) => {
    setTab(next);
    setOpen(true);
  }, []);

  return (
    <ChordBuilderHelpContext.Provider value={{ openHelp }}>
      {children}
      <ChordBuilderHelpHubModal
        open={open}
        tab={tab}
        onTabChange={setTab}
        onClose={() => setOpen(false)}
      />
    </ChordBuilderHelpContext.Provider>
  );
}
