/**
 * Groove Lab instructions — tabbed help + tiny ? triggers.
 * Progression tab is highlighted; neon callout points at the PROGRESSION button.
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
  GROOVE_LAB_HELP_INTRO_STORAGE,
  GROOVE_LAB_HELP_SECTIONS,
  GROOVE_LAB_PROGRESSION_CALLOUT_STORAGE,
  type GrooveLabHelpTabId,
} from '@/app/lib/creationStation/grooveLabInstructions';

const GREEN = '#86efac';
const GREEN_DIM = 'rgba(34, 197, 94, 0.4)';

type GrooveLabHelpContextValue = {
  openHelp: (tab: GrooveLabHelpTabId) => void;
  dismissProgressionCallout: () => void;
  showProgressionCallout: boolean;
};

const GrooveLabHelpContext = createContext<GrooveLabHelpContextValue | null>(null);

function useGrooveLabHelp(): GrooveLabHelpContextValue {
  const ctx = useContext(GrooveLabHelpContext);
  if (!ctx) {
    return { openHelp: () => {}, dismissProgressionCallout: () => {}, showProgressionCallout: false };
  }
  return ctx;
}

export function useGrooveLabHelpContext(): GrooveLabHelpContextValue {
  return useGrooveLabHelp();
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
  border: `1px solid ${GREEN_DIM}`,
  background: 'rgba(34, 197, 94, 0.12)',
  color: GREEN,
  fontSize: 8,
  fontWeight: 900,
  lineHeight: 1,
  cursor: 'pointer',
  verticalAlign: 'middle',
};

/** Tiny ? tab beside section titles — no panel resize. */
export function GrooveLabHelpTip({
  tab,
  title = 'How to use this section',
}: {
  tab: GrooveLabHelpTabId;
  title?: string;
}) {
  const { openHelp, dismissProgressionCallout } = useGrooveLabHelp();
  return (
    <button
      type="button"
      aria-label={title}
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        dismissProgressionCallout();
        openHelp(tab);
      }}
      style={tipBtnStyle}
    >
      ?
    </button>
  );
}

/** Neon callout — hangs over the top-right of PROGRESSION (does not cover SMART MATCH). */
export function GrooveLabProgressionCallout({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        top: -11,
        right: -1,
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 1,
        pointerEvents: 'none',
        zIndex: 3,
        animation: 'grooveProgArrowPulse 1.15s ease-in-out infinite',
      }}
    >
      <span
        style={{
          fontSize: 5,
          fontWeight: 900,
          color: '#bbf7d0',
          letterSpacing: 0.35,
          textShadow: '0 0 6px #22c55e',
          whiteSpace: 'nowrap',
          lineHeight: 1,
        }}
      >
        START HERE
      </span>
      <span
        style={{
          fontSize: 11,
          lineHeight: 1,
          color: '#39ff14',
          fontWeight: 900,
          textShadow: '0 0 8px #39ff14, 0 0 14px #22c55e, 0 0 22px rgba(57,255,20,0.45)',
        }}
      >
        ▼
      </span>
    </span>
  );
}

function GrooveLabHelpHubModal({
  open,
  tab,
  onTabChange,
  onClose,
}: {
  open: boolean;
  tab: GrooveLabHelpTabId;
  onTabChange: (id: GrooveLabHelpTabId) => void;
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

  const section = GROOVE_LAB_HELP_SECTIONS.find((s) => s.id === tab) ?? GROOVE_LAB_HELP_SECTIONS[0]!;

  return createPortal(
    <div
      role="dialog"
      aria-label="Groove Lab instructions"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10050,
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
          maxHeight: tab === 'progression' ? 'min(520px, 88vh)' : 'min(440px, 84vh)',
          display: 'flex',
          flexDirection: 'column',
          background: '#070b10',
          border: '1px solid rgba(34, 197, 94, 0.4)',
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
            borderBottom: '1px solid #1a2e22',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 900, color: GREEN, letterSpacing: 0.5 }}>
            GROOVE LAB HELP
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
          {GROOVE_LAB_HELP_SECTIONS.map((s) => {
            const active = s.id === tab;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onTabChange(s.id)}
                style={{
                  padding: '3px 7px',
                  borderRadius: 4,
                  border: `1px solid ${active ? 'rgba(34, 197, 94, 0.6)' : s.highlight ? 'rgba(57, 255, 20, 0.35)' : 'rgba(255,255,255,0.1)'}`,
                  background: active
                    ? 'rgba(34, 197, 94, 0.18)'
                    : s.highlight
                      ? 'rgba(57, 255, 20, 0.08)'
                      : 'rgba(255,255,255,0.04)',
                  color: active ? GREEN : s.highlight ? '#bbf7d0' : '#9a9aa8',
                  fontSize: 8,
                  fontWeight: 900,
                  letterSpacing: 0.3,
                  cursor: 'pointer',
                  boxShadow: s.highlight && !active ? '0 0 10px rgba(57,255,20,0.12)' : undefined,
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
                  color: '#39ff14',
                  textShadow: '0 0 8px rgba(57,255,20,0.5)',
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
            {section.lines.map((line) => {
              const rhythmSection = line.startsWith('★ RHYTHM EDIT');
              return (
                <li
                  key={line}
                  style={{
                    fontSize: 10,
                    fontWeight: rhythmSection ? 800 : 600,
                    color: rhythmSection ? '#bbf7d0' : '#b8bcc8',
                    lineHeight: 1.45,
                    marginTop: rhythmSection ? 4 : undefined,
                    listStyleType: rhythmSection ? 'none' : undefined,
                    marginLeft: rhythmSection ? -16 : undefined,
                  }}
                >
                  {line}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Wrap Groove Lab — first visit opens Progression tab + shows neon callout. */
export function GrooveLabHelpProvider({
  children,
  autoIntro = true,
}: {
  children: ReactNode;
  autoIntro?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<GrooveLabHelpTabId>('progression');
  const [showProgressionCallout, setShowProgressionCallout] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      return window.localStorage.getItem(GROOVE_LAB_PROGRESSION_CALLOUT_STORAGE) !== '1';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (!autoIntro || typeof window === 'undefined') return;
    try {
      if (window.localStorage.getItem(GROOVE_LAB_HELP_INTRO_STORAGE) === '1') return;
      window.localStorage.setItem(GROOVE_LAB_HELP_INTRO_STORAGE, '1');
      setTab('progression');
      setOpen(true);
    } catch {
      /* ignore */
    }
  }, [autoIntro]);

  const dismissProgressionCallout = useCallback(() => {
    setShowProgressionCallout(false);
    try {
      window.localStorage.setItem(GROOVE_LAB_PROGRESSION_CALLOUT_STORAGE, '1');
    } catch {
      /* ignore */
    }
  }, []);

  const openHelp = useCallback(
    (next: GrooveLabHelpTabId) => {
      dismissProgressionCallout();
      setTab(next);
      setOpen(true);
    },
    [dismissProgressionCallout],
  );

  return (
    <GrooveLabHelpContext.Provider value={{ openHelp, dismissProgressionCallout, showProgressionCallout }}>
      <style>{`
        @keyframes grooveProgArrowPulse {
          0%, 100% { opacity: 1; transform: translateY(0); }
          50% { opacity: 0.78; transform: translateY(2px); }
        }
      `}</style>
      {children}
      <GrooveLabHelpHubModal
        open={open}
        tab={tab}
        onTabChange={setTab}
        onClose={() => setOpen(false)}
      />
    </GrooveLabHelpContext.Provider>
  );
}
