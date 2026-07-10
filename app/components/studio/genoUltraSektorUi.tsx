'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ANA } from '@/app/components/studio/genoUltraAnaUi';

/** SEKTOR Signature Edition — dark slate + neon green + blue accents. */
export const SEKTOR = {
  bg: '#0e1014',
  bgPanel: '#141820',
  bgInset: '#0a0c10',
  bgDeep: '#060708',
  border: '#222830',
  borderHi: '#323844',
  /** Neon green — waveforms, browser selection, graphs */
  green: '#39ff14',
  greenHi: '#6dff4a',
  greenDim: '#1f9920',
  greenOnText: '#0a0c0e',
  /** Electric blue — active tabs, ON buttons, knob rings */
  blue: '#3d8fd8',
  blueHi: '#62aef0',
  blueDim: '#245880',
  text: '#9aa0ac',
  textDim: '#4e5560',
  textHi: '#dce0e8',
  browserRowH: 22,
} as const;

export function SekModule({
  title,
  children,
  flex,
  style,
  minHeight,
}: {
  title?: string;
  children: ReactNode;
  flex?: string;
  style?: CSSProperties;
  minHeight?: number;
}) {
  return (
    <div
      style={{
        flex,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        minHeight,
        border: `1px solid ${SEKTOR.border}`,
        background: `linear-gradient(180deg, ${SEKTOR.bgPanel} 0%, ${SEKTOR.bgInset} 100%)`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.02)`,
        ...style,
      }}
    >
      {title ? (
        <div
          style={{
            padding: '4px 8px',
            borderBottom: `1px solid ${SEKTOR.border}`,
            fontSize: 8,
            fontWeight: 800,
            letterSpacing: '0.16em',
            color: SEKTOR.textDim,
            textTransform: 'uppercase',
          }}
        >
          {title}
        </div>
      ) : null}
      <div style={{ padding: 8, flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  );
}

export function SekBigTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: readonly { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '6px 8px 0', background: SEKTOR.bgInset, borderTop: `1px solid ${SEKTOR.border}` }}>
      {tabs.map((t) => {
        const on = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            style={{
              flex: 1,
              padding: '8px 6px',
              fontSize: 8,
              fontWeight: 800,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              border: `1px solid ${on ? SEKTOR.blue : SEKTOR.border}`,
              borderBottom: on ? `2px solid ${SEKTOR.blueHi}` : `1px solid ${SEKTOR.border}`,
              borderRadius: '4px 4px 0 0',
              background: on ? `linear-gradient(180deg, ${SEKTOR.blue}44, ${SEKTOR.bgPanel})` : SEKTOR.bgPanel,
              color: on ? SEKTOR.blueHi : SEKTOR.textDim,
              boxShadow: on ? `0 0 12px ${SEKTOR.blue}44` : 'none',
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export function SekFooterTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: readonly { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 2, padding: '4px 8px 0', borderBottom: `1px solid ${SEKTOR.border}`, background: SEKTOR.bgInset }}>
      {tabs.map((t) => {
        const on = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            style={{
              padding: '5px 12px',
              fontSize: 8,
              fontWeight: 800,
              letterSpacing: '0.08em',
              border: 'none',
              borderRadius: '3px 3px 0 0',
              borderBottom: on ? `2px solid ${SEKTOR.blueHi}` : '2px solid transparent',
              background: on ? `linear-gradient(180deg, ${SEKTOR.blue}55, ${SEKTOR.bgPanel})` : 'transparent',
              color: on ? SEKTOR.blueHi : SEKTOR.textDim,
              boxShadow: on ? `0 0 10px ${SEKTOR.blue}44` : 'none',
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export function SekSequencerBrandBanner() {
  return (
    <div style={{ textAlign: 'center', flexShrink: 0, lineHeight: 1.2 }}>
      <div
        style={{
          fontSize: 17,
          fontWeight: 900,
          color: SEKTOR.blueHi,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          textShadow: `0 0 16px ${SEKTOR.blue}88`,
        }}
      >
        Geno Ultra Synth
      </div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: SEKTOR.blueHi,
          letterSpacing: '0.1em',
          marginTop: 4,
          textShadow: `0 0 10px ${SEKTOR.blue}55`,
        }}
      >
        Chord Lock Technology
      </div>
    </div>
  );
}

export function SekLedMeter({ level = 0.4 }: { level?: number }) {
  const segs = 20;
  const lit = Math.round(level * segs);
  return (
    <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: 1, height: 72, width: 10 }}>
      {Array.from({ length: segs }, (_, i) => (
        <div
          key={i}
          style={{
            height: 3,
            borderRadius: 1,
            background: i < lit ? (i > segs - 4 ? '#e8c040' : SEKTOR.green) : '#040506',
            boxShadow: i < lit ? `0 0 4px ${SEKTOR.green}88` : 'none',
          }}
        />
      ))}
    </div>
  );
}

/** Thin label row used in SEKTOR osc blocks */
export function SekMiniLabel({ children }: { children: ReactNode }) {
  return (
    <span style={{ fontSize: 6, fontWeight: 800, color: SEKTOR.textDim, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
      {children}
    </span>
  );
}

export type SekBrowserLeftItem = {
  id: string;
  label: string;
  group?: string;
};

export type SekBrowserRightItem = {
  id: string;
  label: string;
  description?: string;
};

function sekBrowserRowStyle(active: boolean): CSSProperties {
  return {
    display: 'block',
    width: '100%',
    padding: '4px 8px',
    margin: 0,
    border: 'none',
    borderRadius: 2,
    textAlign: 'left',
    fontSize: 9,
    fontWeight: active ? 800 : 600,
    letterSpacing: '0.04em',
    cursor: 'pointer',
    background: active ? SEKTOR.green : 'transparent',
    color: active ? SEKTOR.greenOnText : SEKTOR.text,
    boxShadow: active ? `0 0 12px ${SEKTOR.green}66` : 'none',
  };
}

/** Sektor-style two-column preset browser (categories left, presets right). */
export function SekPresetBrowser({
  presetName,
  bankLabel = 'Factory',
  leftItems,
  activeLeftId,
  onLeftChange,
  rightItems,
  activeRightId,
  onRightSelect,
  onPrev,
  onNext,
  disabled,
}: {
  presetName: string;
  bankLabel?: string;
  leftItems: readonly SekBrowserLeftItem[];
  activeLeftId: string;
  onLeftChange: (id: string) => void;
  rightItems: readonly SekBrowserRightItem[];
  activeRightId: string;
  onRightSelect: (id: string) => void;
  onPrev?: () => void;
  onNext?: () => void;
  disabled?: boolean;
}) {
  const leftGroups = useMemo(() => {
    const groups: { label: string; items: SekBrowserLeftItem[] }[] = [];
    for (const item of leftItems) {
      const g = item.group ?? '';
      const hit = groups.find((x) => x.label === g);
      if (hit) hit.items.push(item);
      else groups.push({ label: g, items: [item] });
    }
    return groups;
  }, [leftItems]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, height: '100%', minHeight: 320 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
          padding: '6px 8px',
          background: SEKTOR.bgDeep,
          border: `1px solid ${SEKTOR.border}`,
          borderRadius: 3,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <SekMiniLabel>Expansion</SekMiniLabel>
          <div
            style={{
              padding: '3px 10px',
              fontSize: 9,
              fontWeight: 700,
              color: SEKTOR.textHi,
              background: SEKTOR.bgInset,
              border: `1px solid ${SEKTOR.border}`,
              borderRadius: 2,
              minWidth: 88,
            }}
          >
            {bankLabel}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 120, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <SekMiniLabel>Preset</SekMiniLabel>
          <div
            style={{
              padding: '3px 10px',
              fontSize: 10,
              fontWeight: 800,
              color: SEKTOR.greenHi,
              background: SEKTOR.bgInset,
              border: `1px solid ${SEKTOR.greenDim}`,
              borderRadius: 2,
              textShadow: `0 0 8px ${SEKTOR.green}55`,
            }}
          >
            {presetName}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button type="button" disabled={disabled || !onPrev} onClick={onPrev} style={sekNavBtnStyle(disabled || !onPrev)}>
            ◀ Prev
          </button>
          <button type="button" disabled={disabled || !onNext} onClick={onNext} style={sekNavBtnStyle(disabled || !onNext)}>
            Next ▶
          </button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: '112px 1fr',
          border: `1px solid ${SEKTOR.border}`,
          borderRadius: 3,
          overflow: 'hidden',
          background: SEKTOR.bgInset,
        }}
      >
        <div
          style={{
            borderRight: `1px solid ${SEKTOR.border}`,
            overflowY: 'auto',
            padding: '4px 2px',
            background: SEKTOR.bgDeep,
          }}
        >
          {leftGroups.map((g) => (
            <div key={g.label || '_'} style={{ marginBottom: 6 }}>
              {g.label ? (
                <div style={{ fontSize: 6, fontWeight: 800, color: SEKTOR.textDim, padding: '2px 6px', letterSpacing: '0.12em' }}>
                  {g.label}
                </div>
              ) : null}
              {g.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onLeftChange(item.id)}
                  style={{
                    ...sekBrowserRowStyle(activeLeftId === item.id),
                    opacity: disabled ? 0.45 : 1,
                    fontSize: 8,
                    textTransform: 'uppercase',
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div style={{ overflowY: 'auto', padding: '4px 2px' }}>
          {rightItems.length === 0 ? (
            <div style={{ padding: 12, fontSize: 8, color: SEKTOR.textDim }}>No presets in this category.</div>
          ) : (
            rightItems.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={disabled}
                title={item.description}
                onClick={() => onRightSelect(item.id)}
                style={{
                  ...sekBrowserRowStyle(activeRightId === item.id),
                  opacity: disabled ? 0.45 : 1,
                }}
              >
                {item.label}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function sekNavBtnStyle(disabled?: boolean): CSSProperties {
  return {
    padding: '4px 10px',
    fontSize: 8,
    fontWeight: 800,
    letterSpacing: '0.06em',
    border: `1px solid ${SEKTOR.borderHi}`,
    borderRadius: 2,
    background: SEKTOR.bgPanel,
    color: SEKTOR.textHi,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.4 : 1,
  };
}

/** Small ON toggle — blue when active (Sektor osc buttons). */
export function SekOnBtn({
  on,
  label = 'On',
  disabled,
  onClick,
  title,
}: {
  on: boolean;
  label?: string;
  disabled?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      style={{
        padding: '3px 10px',
        fontSize: 8,
        fontWeight: 800,
        letterSpacing: '0.08em',
        border: `1px solid ${on ? SEKTOR.blue : SEKTOR.border}`,
        borderRadius: 3,
        background: on ? `linear-gradient(180deg, ${SEKTOR.blue}66, ${SEKTOR.bgInset})` : SEKTOR.bgInset,
        color: on ? SEKTOR.blueHi : SEKTOR.textDim,
        boxShadow: on ? `0 0 8px ${SEKTOR.blue}55, inset 0 0 6px ${SEKTOR.blue}22` : 'none',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {label}
    </button>
  );
}

const CHORD_LOCK_HELP_LINES = [
  {
    title: 'Pick any track',
    body: 'In the ARP strip, use the track dropdown to choose any SE2 lane — Progression+, Rhythm Edit, Synth Geno Build, chord MIDI, and more. Lanes marked · CH carry chord data.',
  },
  {
    title: 'DETECT — key only',
    body: 'DETECT pulls scale and key from the selected track (including analyzed audio). Your arp grid stays exactly as you built it — same steps, rhythm, and melody shape. Nothing is regenerated.',
  },
  {
    title: 'FOLLOW — chord import',
    body: 'When FOLLOW is lit, Geno Ultra imports that track’s chord progression for your 4- or 8-bar loop and can regenerate the arp to fit those chords. Turn FOLLOW off if you only want the key, not new harmony on the grid.',
  },
  {
    title: 'LOCK CHORD',
    body: 'After chords import, LOCK CHORD keeps the progression fixed while you change pattern, rate, or gate. ↻ REGENERATE is separate — only use it when you want a new melody from the locked chords.',
  },
  {
    title: 'SYNC SE2',
    body: 'Off by default — Ultra melodies use their own BPM. Turn SYNC SE2 on only when you want arp play/stop and tempo locked to the main Studio Editor 2 transport.',
  },
  {
    title: 'Export in key',
    body: 'MIDI OUT, WAV OUT, and MIDI TO ROLL keep your step pattern, timing, gate, and swing — only the pitches transpose into the detected key and scale. Build the melody here, DETECT the track key, then export.',
  },
] as const;

/** Same platinum wordmark as TitleBar “Music Production Suite” — scaled for panel chrome. */
export const genoUltraPlatinumSuiteLabelStyle = (fontSize = 10): CSSProperties => ({
  fontFamily: 'Rajdhani, system-ui, sans-serif',
  fontWeight: 600,
  fontSize,
  letterSpacing: '0.24em',
  textTransform: 'uppercase',
  background:
    'linear-gradient(180deg, #ffffff 0%, #eef2f5 18%, #c5ced6 38%, #f4f7f9 52%, #9aa8b4 72%, #dce3e9 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
  filter: 'drop-shadow(0 1px 1px rgba(0, 0, 0, 0.65))',
  whiteSpace: 'nowrap',
  lineHeight: 1.2,
});

/** Platinum “Chord Lock Technology” label with arrow pointing at the blue help ?. */
export function GenoUltraChordLockTechnologyMark() {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-0.5"
      title="Chord Lock Technology — tap the blue ? for how track follow and sync work"
    >
      <span style={genoUltraPlatinumSuiteLabelStyle(10)}>Chord Lock Technology</span>
      <span
        aria-hidden
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 700,
          lineHeight: 1,
          color: '#dce3e9',
          textShadow: '0 0 6px rgba(196, 218, 235, 0.45), 0 1px 1px rgba(0,0,0,0.65)',
          transform: 'translateY(-0.5px)',
        }}
      >
        →
      </span>
    </span>
  );
}

/** Larger blue ? beside the mint SE2 help tip — chord lock / follow / sync guide. */
export function GenoUltraChordLockHelpTip() {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  useEffect(() => {
    if (!open || !btnRef.current) {
      setAnchor(null);
      return;
    }
    const rect = btnRef.current.getBoundingClientRect();
    setAnchor({ top: rect.bottom + 6, left: rect.left + rect.width / 2 });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || popRef.current?.contains(t)) return;
      close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, close]);

  const accent = SEKTOR.blueHi;
  const accentDim = `${SEKTOR.blue}88`;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label="Chord lock, sync, and track follow — how it works"
        aria-expanded={open}
        title="Chord lock & sync — how the arp follows any track’s chords and key"
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 18,
          height: 18,
          padding: 0,
          margin: 0,
          flexShrink: 0,
          borderRadius: 4,
          border: `1px solid ${open ? accent : accentDim}`,
          background: open ? `${SEKTOR.blue}28` : `${SEKTOR.blue}14`,
          color: accent,
          fontSize: 11,
          fontWeight: 900,
          lineHeight: 1,
          cursor: 'pointer',
          verticalAlign: 'middle',
          boxShadow: open ? `0 0 10px ${SEKTOR.blue}44` : undefined,
        }}
      >
        ?
      </button>
      {open && anchor && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={popRef}
              role="dialog"
              aria-label="Geno Ultra chord lock and sync"
              style={{
                position: 'fixed',
                top: anchor.top,
                left: anchor.left,
                transform: 'translateX(-50%)',
                zIndex: 10100,
                width: 'min(320px, 92vw)',
                padding: '10px 12px 12px',
                borderRadius: 8,
                border: `1px solid ${accentDim}`,
                background: 'linear-gradient(180deg, #141820 0%, #0a0c10 100%)',
                boxShadow: `0 12px 32px rgba(0,0,0,0.65), 0 0 20px ${SEKTOR.blue}22`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  color: accent,
                  letterSpacing: '0.06em',
                  marginBottom: 8,
                  textShadow: `0 0 10px ${SEKTOR.blue}55`,
                }}
              >
                Chord Lock · Sync · Track Follow
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {CHORD_LOCK_HELP_LINES.map((item) => (
                  <li key={item.title}>
                    <div style={{ fontSize: 9, fontWeight: 900, color: SEKTOR.textHi, marginBottom: 2 }}>{item.title}</div>
                    <div style={{ fontSize: 9, fontWeight: 600, color: SEKTOR.text, lineHeight: 1.45 }}>{item.body}</div>
                  </li>
                ))}
              </ul>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
