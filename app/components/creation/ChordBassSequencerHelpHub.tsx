/**
 * Chord/Bass Sequencer instructions — tabbed help + tiny ? triggers.
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
  CHORD_BASS_SEQUENCER_HELP_INTRO_STORAGE,
  CHORD_BASS_SEQUENCER_HELP_SECTIONS,
  type ChordBassSequencerHelpTabId,
} from '@/app/lib/creationStation/chordBassSequencerInstructions';

const CYAN = '#67e8f9';
const PURPLE = '#c4b5fd';
const GREEN = '#86efac';

type ChordBassSequencerHelpContextValue = {
  openHelp: (tab: ChordBassSequencerHelpTabId) => void;
};

const ChordBassSequencerHelpContext = createContext<ChordBassSequencerHelpContextValue | null>(null);

function useChordBassSequencerHelp(): ChordBassSequencerHelpContextValue {
  const ctx = useContext(ChordBassSequencerHelpContext);
  if (!ctx) {
    return { openHelp: () => {} };
  }
  return ctx;
}

export function useChordBassSequencerHelpContext(): ChordBassSequencerHelpContextValue {
  return useChordBassSequencerHelp();
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
  border: '1px solid rgba(103, 232, 249, 0.45)',
  background: 'rgba(103, 232, 249, 0.1)',
  color: CYAN,
  fontSize: 8,
  fontWeight: 900,
  lineHeight: 1,
  cursor: 'pointer',
  verticalAlign: 'middle',
};

/** Tiny ? tab beside section titles — no panel resize. */
export function ChordBassSequencerHelpTip({
  tab,
  title = 'How to use this section',
}: {
  tab: ChordBassSequencerHelpTabId;
  title?: string;
}) {
  const { openHelp } = useChordBassSequencerHelp();
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

function ChordBassSequencerHelpHubModal({
  open,
  tab,
  onTabChange,
  onClose,
}: {
  open: boolean;
  tab: ChordBassSequencerHelpTabId;
  onTabChange: (id: ChordBassSequencerHelpTabId) => void;
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
    CHORD_BASS_SEQUENCER_HELP_SECTIONS.find((s) => s.id === tab) ??
    CHORD_BASS_SEQUENCER_HELP_SECTIONS[0]!;

  return createPortal(
    <div
      role="dialog"
      aria-label="Chord Bass Sequencer instructions"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10080,
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
          maxHeight: tab === 'bass' || tab === 'overview' ? 'min(540px, 88vh)' : 'min(440px, 84vh)',
          display: 'flex',
          flexDirection: 'column',
          background: '#070b10',
          border: '1px solid rgba(103, 232, 249, 0.35)',
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
            borderBottom: '1px solid #1a2e38',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 900, color: CYAN, letterSpacing: 0.5 }}>
            CHORD/BASS SEQUENCER HELP
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
          {CHORD_BASS_SEQUENCER_HELP_SECTIONS.map((s) => {
            const active = s.id === tab;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onTabChange(s.id)}
                style={{
                  padding: '3px 7px',
                  borderRadius: 4,
                  border: `1px solid ${active ? 'rgba(196, 181, 253, 0.6)' : s.highlight ? 'rgba(124, 244, 198, 0.35)' : 'rgba(255,255,255,0.1)'}`,
                  background: active
                    ? 'rgba(196, 181, 253, 0.18)'
                    : s.highlight
                      ? 'rgba(103, 232, 249, 0.08)'
                      : 'rgba(255,255,255,0.04)',
                  color: active ? PURPLE : s.highlight ? GREEN : '#9a9aa8',
                  fontSize: 8,
                  fontWeight: 900,
                  letterSpacing: 0.3,
                  cursor: 'pointer',
                  boxShadow: s.highlight && !active ? '0 0 10px rgba(103, 232, 249, 0.12)' : undefined,
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
                  color: PURPLE,
                  textShadow: '0 0 8px rgba(196, 181, 253, 0.45)',
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

/** Wrap Chord/Bass Sequencer — first visit opens ★ Bass tab. */
export function ChordBassSequencerHelpProvider({
  children,
  autoIntro = true,
  active = true,
}: {
  children: ReactNode;
  autoIntro?: boolean;
  active?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<ChordBassSequencerHelpTabId>('bass');

  useEffect(() => {
    if (!autoIntro || !active || typeof window === 'undefined') return;
    try {
      if (window.localStorage.getItem(CHORD_BASS_SEQUENCER_HELP_INTRO_STORAGE) === '1') return;
      window.localStorage.setItem(CHORD_BASS_SEQUENCER_HELP_INTRO_STORAGE, '1');
      setTab('bass');
      setOpen(true);
    } catch {
      /* ignore */
    }
  }, [autoIntro, active]);

  const openHelp = useCallback((next: ChordBassSequencerHelpTabId) => {
    setTab(next);
    setOpen(true);
  }, []);

  return (
    <ChordBassSequencerHelpContext.Provider value={{ openHelp }}>
      {children}
      <ChordBassSequencerHelpHubModal
        open={open}
        tab={tab}
        onTabChange={setTab}
        onClose={() => setOpen(false)}
      />
    </ChordBassSequencerHelpContext.Provider>
  );
}
