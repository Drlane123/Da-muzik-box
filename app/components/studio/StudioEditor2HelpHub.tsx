/**
 * Studio Editor 2 instructions — tabbed help + tiny ? triggers (no panel resize).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, X } from 'lucide-react';

import {
  STUDIO_EDITOR2_HELP_INTRO_STORAGE,
  STUDIO_EDITOR2_HELP_SECTIONS,
  type StudioEditor2HelpTabId,
} from '@/app/lib/studio/studioEditor2Instructions';

const MINT = '#7cf4c6';
const MINT_DIM = 'rgba(124, 244, 198, 0.4)';

function helpLineWithBold(text: string): ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} style={{ color: '#e8e8f0', fontWeight: 800 }}>
        {part}
      </strong>
    ) : (
      part
    ),
  );
}

function helpContentMaxHeight(tab: StudioEditor2HelpTabId): string {
  if (tab === 'timeline' || tab === 'overview' || tab === 'beatPadsSe2') {
    return 'min(620px, 90vh)';
  }
  return 'min(460px, 84vh)';
}

function helpModalWidth(tab: StudioEditor2HelpTabId): string {
  if (tab === 'beatPadsSe2') return 'min(560px, 96vw)';
  return 'min(500px, 96vw)';
}

function helpSubsectionDomId(tab: StudioEditor2HelpTabId, title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `se2-help-${tab}-${slug}`;
}

const HELP_BODY_FONT = 11;
const HELP_SUBHEAD_FONT = 11;
const HELP_NAV_FONT = 9;
const HELP_TITLE_FONT = 13;

type StudioEditor2HelpContextValue = {
  openHelp: (tab: StudioEditor2HelpTabId) => void;
};

const StudioEditor2HelpContext = createContext<StudioEditor2HelpContextValue | null>(null);

function useStudioEditor2Help(): StudioEditor2HelpContextValue {
  const ctx = useContext(StudioEditor2HelpContext);
  if (!ctx) {
    return { openHelp: () => {} };
  }
  return ctx;
}

export function useStudioEditor2HelpContext(): StudioEditor2HelpContextValue {
  return useStudioEditor2Help();
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
  fontFamily: "'Rajdhani', 'Exo 2', system-ui, sans-serif",
  fontSize: 8,
  fontWeight: 600,
  lineHeight: 1,
  cursor: 'pointer',
  verticalAlign: 'middle',
};

/** Tiny ? tab beside section titles — no panel resize. */
export function StudioEditor2HelpTip({
  tab,
  title = 'How to use this section',
}: {
  tab: StudioEditor2HelpTabId;
  title?: string;
}) {
  const { openHelp } = useStudioEditor2Help();
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

const HELP_GOLD = '#fbbf24';
const HELP_GOLD_DIM = 'rgba(251, 191, 36, 0.45)';

/** Gold label + arrow — opens the same help hub tab as {@link StudioEditor2HelpTip}. */
export function StudioEditor2HelpTextLink({
  tab,
  label,
  title,
  expanded = false,
}: {
  tab: StudioEditor2HelpTabId;
  label: string;
  title?: string;
  /** Full label visible (Beat Pads dock header). */
  expanded?: boolean;
}) {
  const { openHelp } = useStudioEditor2Help();
  const aria = title ?? label;
  return (
    <button
      type="button"
      aria-label={aria}
      title={aria}
      onClick={(e) => {
        e.stopPropagation();
        openHelp(tab);
      }}
      className={
        expanded
          ? 'se2-type-micro inline-flex shrink-0 items-center gap-0.5 rounded border px-1.5 py-0.5 transition-colors hover:bg-[#fbbf2414]'
          : 'se2-type-micro inline-flex shrink-0 items-center gap-0.5 rounded border px-1.5 py-0.5 transition-colors hover:bg-[#fbbf2414]'
      }
      style={{
        borderColor: HELP_GOLD_DIM,
        background: 'rgba(251, 191, 36, 0.08)',
        fontFamily: "'Rajdhani', 'Exo 2', system-ui, sans-serif",
        fontWeight: 500,
        letterSpacing: '0.08em',
        ...(expanded ? { maxWidth: 'none' } : { maxWidth: 220 }),
      }}
    >
      <ChevronRight size={10} strokeWidth={2} color={HELP_GOLD} aria-hidden />
      <span
        className={
          expanded
            ? 'whitespace-nowrap text-[8px] font-medium leading-tight normal-case tracking-wide'
            : 'truncate text-[8px] font-medium uppercase tracking-wide'
        }
        style={{
          color: HELP_GOLD,
          lineHeight: 1.2,
          fontFamily: "'Rajdhani', 'Exo 2', system-ui, sans-serif",
          fontWeight: 500,
        }}
      >
        {label}
      </span>
    </button>
  );
}

function StudioEditor2HelpHubModal({
  open,
  tab,
  onTabChange,
  onClose,
}: {
  open: boolean;
  tab: StudioEditor2HelpTabId;
  onTabChange: (id: StudioEditor2HelpTabId) => void;
  onClose: () => void;
}) {
  const tabStripRef = useRef<HTMLDivElement>(null);
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const [activeSubId, setActiveSubId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !tabStripRef.current) return;
    const activeBtn = tabStripRef.current.querySelector<HTMLButtonElement>(`[data-help-tab="${tab}"]`);
    activeBtn?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [open, tab]);

  useEffect(() => {
    setActiveSubId(null);
    if (contentScrollRef.current) contentScrollRef.current.scrollTop = 0;
  }, [tab]);

  const scrollToSubsection = useCallback((subId: string) => {
    setActiveSubId(subId);
    const host = contentScrollRef.current;
    const target = document.getElementById(subId);
    if (!host || !target) return;
    const hostRect = host.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const nextTop = host.scrollTop + (targetRect.top - hostRect.top) - 6;
    host.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' });
  }, []);

  if (!open || typeof document === 'undefined') return null;

  const section =
    STUDIO_EDITOR2_HELP_SECTIONS.find((s) => s.id === tab) ?? STUDIO_EDITOR2_HELP_SECTIONS[0]!;
  const subsections =
    section.subsections && section.subsections.length > 0 ? section.subsections : null;
  const flatLines = subsections ? [] : section.lines;

  return createPortal(
    <div
      role="dialog"
      aria-label="Studio Editor 2 instructions"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10090,
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
          width: helpModalWidth(tab),
          maxHeight: helpContentMaxHeight(tab),
          display: 'flex',
          flexDirection: 'column',
          background: '#07090c',
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
            borderBottom: '1px solid #1a2e28',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 900, color: MINT, letterSpacing: 0.5 }}>
            STUDIO EDITOR 2 HELP
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
          ref={tabStripRef}
          style={{
            display: 'flex',
            flexWrap: 'nowrap',
            gap: 4,
            padding: '8px 10px',
            borderBottom: '1px solid #141a18',
            flexShrink: 0,
            overflowX: 'auto',
            overflowY: 'hidden',
            scrollbarWidth: 'thin',
          }}
        >
          {STUDIO_EDITOR2_HELP_SECTIONS.map((s) => {
            const active = s.id === tab;
            return (
              <button
                key={s.id}
                type="button"
                data-help-tab={s.id}
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
                  color: active ? MINT : s.highlight ? '#9ee8d4' : '#9a9aa8',
                  fontSize: 8,
                  fontWeight: 900,
                  letterSpacing: 0.3,
                  cursor: 'pointer',
                  flexShrink: 0,
                  boxShadow: s.highlight && !active ? '0 0 10px rgba(124, 244, 198, 0.12)' : undefined,
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        <div
          style={{
            display: 'flex',
            flex: '1 1 auto',
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {subsections ? (
            <div
              style={{
                width: 148,
                flexShrink: 0,
                borderRight: '1px solid #141a18',
                padding: '8px 6px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
              }}
            >
              {subsections.map((sub) => {
                const subId = helpSubsectionDomId(tab, sub.title);
                const navActive = activeSubId === subId;
                return (
                  <button
                    key={sub.title}
                    type="button"
                    onClick={() => scrollToSubsection(subId)}
                    title={`Jump to ${sub.title}`}
                    style={{
                      fontSize: HELP_NAV_FONT,
                      fontWeight: 800,
                      color: navActive ? '#0a1210' : MINT,
                      letterSpacing: 0.2,
                      lineHeight: 1.35,
                      padding: '5px 7px',
                      borderRadius: 4,
                      textAlign: 'left',
                      cursor: 'pointer',
                      background: navActive ? MINT : 'rgba(124, 244, 198, 0.06)',
                      border: `1px solid ${navActive ? 'rgba(124, 244, 198, 0.85)' : 'rgba(124, 244, 198, 0.12)'}`,
                      transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease',
                    }}
                  >
                    {sub.title}
                  </button>
                );
              })}
            </div>
          ) : null}

          <div
            ref={contentScrollRef}
            style={{ padding: '10px 12px 12px', overflowY: 'auto', flex: '1 1 auto', minWidth: 0 }}
          >
            <div
              style={{
                fontSize: HELP_TITLE_FONT,
                fontWeight: 900,
                color: '#e8e8f0',
                marginBottom: 10,
                lineHeight: 1.35,
              }}
            >
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

            {subsections ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {subsections.map((sub) => {
                  const subId = helpSubsectionDomId(tab, sub.title);
                  return (
                    <div
                      key={sub.title}
                      id={subId}
                      style={{ scrollMarginTop: 8 }}
                    >
                      <div
                        style={{
                          fontSize: HELP_SUBHEAD_FONT,
                          fontWeight: 900,
                          color: MINT,
                          marginBottom: 6,
                          letterSpacing: 0.3,
                          lineHeight: 1.35,
                        }}
                      >
                        {sub.title}
                      </div>
                      <ul
                        style={{
                          margin: 0,
                          paddingLeft: 18,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 7,
                        }}
                      >
                        {sub.lines.map((line) => (
                          <li
                            key={line}
                            style={{
                              fontSize: HELP_BODY_FONT,
                              fontWeight: 600,
                              color: '#c8ccd6',
                              lineHeight: 1.5,
                            }}
                          >
                            {helpLineWithBold(line)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            ) : (
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 18,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 7,
                }}
              >
                {flatLines.map((line) => (
                  <li
                    key={line}
                    style={{
                      fontSize: HELP_BODY_FONT,
                      fontWeight: 600,
                      color: '#c8ccd6',
                      lineHeight: 1.5,
                    }}
                  >
                    {helpLineWithBold(line)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Wrap Studio Editor 2 — first visit opens ★ Arrange tab. */
export function StudioEditor2HelpProvider({
  children,
  autoIntro = true,
  active = true,
}: {
  children: ReactNode;
  autoIntro?: boolean;
  active?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<StudioEditor2HelpTabId>('timeline');

  useEffect(() => {
    if (!autoIntro || !active || typeof window === 'undefined') return;
    try {
      if (window.localStorage.getItem(STUDIO_EDITOR2_HELP_INTRO_STORAGE) === '1') return;
      window.localStorage.setItem(STUDIO_EDITOR2_HELP_INTRO_STORAGE, '1');
      setTab('timeline');
      setOpen(true);
    } catch {
      /* ignore */
    }
  }, [autoIntro, active]);

  const openHelp = useCallback((next: StudioEditor2HelpTabId) => {
    setTab(next);
    setOpen(true);
  }, []);

  return (
    <StudioEditor2HelpContext.Provider value={{ openHelp }}>
      {children}
      <StudioEditor2HelpHubModal
        open={open}
        tab={tab}
        onTabChange={setTab}
        onClose={() => setOpen(false)}
      />
    </StudioEditor2HelpContext.Provider>
  );
}
