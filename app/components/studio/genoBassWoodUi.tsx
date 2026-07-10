'use client';

import {
  useCallback,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { clampAnaNum } from '@/app/components/studio/genoUltraAnaUi';
import { GENO_BASS_SYNTH_PRESET_COUNT } from '@/app/lib/studio/genoBassSynthPresets';

/** Subsequent 37–inspired: matte black deck, white silkscreen, amber button glow. */
export const GENO_BASS_THEME = {
  panel: '#0b0b0d',
  panelHi: '#121216',
  panelInset: '#070709',
  border: 'rgba(255,255,255,0.1)',
  borderSection: 'rgba(255,255,255,0.2)',
  label: '#ececf0',
  labelDim: '#7a7a86',
  labelHi: '#ffffff',
  amber: '#f0a020',
  amberHi: '#ffc848',
  amberDim: '#a06818',
  amberGlow: 'rgba(240,160,32,0.62)',
  /** SPHINX-inspired tab / library selection accent */
  sphinx: '#9b6dff',
  sphinxHi: '#c4a8ff',
  sphinxGlow: 'rgba(155,109,255,0.42)',
  lcdBg: '#060608',
  lcdText: '#f0c060',
  lcdDim: '#806030',
  knobBody: '#18181c',
  knobCap: '#b8b8be',
  wheelBed: '#0e0e12',
} as const;

const GENO_BASS_WOOD = {
  woodBase: '#b88850',
  woodHi: '#d8b878',
  woodLo: '#8a6038',
  woodGrain: '#a07040',
  woodDeep: '#6b4828',
} as const;

export const GENO_BASS_WOOD_BG: CSSProperties = {
  backgroundColor: GENO_BASS_WOOD.woodBase,
  backgroundImage: `
    linear-gradient(180deg, rgba(255,255,255,0.14) 0%, transparent 42%),
    repeating-linear-gradient(
      0deg,
      transparent 0px,
      transparent 2px,
      rgba(0,0,0,0.05) 2px,
      rgba(0,0,0,0.05) 2.5px
    ),
    repeating-linear-gradient(
      93deg,
      ${GENO_BASS_WOOD.woodLo} 0px,
      ${GENO_BASS_WOOD.woodHi} 5px,
      ${GENO_BASS_WOOD.woodGrain} 8px,
      ${GENO_BASS_WOOD.woodBase} 11px,
      ${GENO_BASS_WOOD.woodLo} 14px
    )
  `,
};

/** Groove tab — crisp walnut edge where the piano roll overlaps the keyboard strip (no blur). */
export function GenoBassGrooveWoodEdgeFrame({ overlapPx }: { overlapPx: number }) {
  const woodFace: CSSProperties = {
    backgroundColor: GENO_BASS_WOOD.woodBase,
    backgroundImage: GENO_BASS_WOOD_BG.backgroundImage,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14)',
  };

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: overlapPx,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          borderRight: `1px solid ${GENO_BASS_WOOD.woodDeep}`,
          ...woodFace,
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 4,
          borderLeft: `1px solid ${GENO_BASS_WOOD.woodDeep}`,
          ...woodFace,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 4,
          right: 4,
          bottom: 0,
          height: 2,
          borderTop: `1px solid ${GENO_BASS_WOOD.woodDeep}`,
          ...woodFace,
        }}
      />
    </div>
  );
}

const lcdScanline: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background:
    'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.22) 2px, rgba(0,0,0,0.22) 4px)',
  pointerEvents: 'none',
};

/** Geno Bass 52 hardware chassis — walnut side ears + black deck. */
export function GenoBassSub37Frame({
  children,
  className,
  style,
  sideEarPx = 14,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  sideEarPx?: number;
}) {
  const earStyle: CSSProperties = {
    flexShrink: 0,
    width: sideEarPx,
    alignSelf: 'stretch',
    ...GENO_BASS_WOOD_BG,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18), inset -1px 0 4px rgba(0,0,0,0.25)',
    borderTop: `1px solid ${GENO_BASS_WOOD.woodDeep}`,
    borderBottom: `1px solid ${GENO_BASS_WOOD.woodDeep}`,
  };

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'stretch',
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: '0 6px 24px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)',
        border: `1px solid ${GENO_BASS_WOOD.woodDeep}`,
        ...style,
      }}
    >
      <div
        style={{
          ...earStyle,
          borderLeft: `1px solid ${GENO_BASS_WOOD.woodDeep}`,
          borderRadius: '8px 0 0 8px',
          backgroundImage: `${String(earStyle.backgroundImage)}, linear-gradient(90deg, rgba(0,0,0,0.12), transparent 55%)`,
        }}
      />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>{children}</div>
      <div
        style={{
          ...earStyle,
          borderRight: `1px solid ${GENO_BASS_WOOD.woodDeep}`,
          borderRadius: '0 8px 8px 0',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18), inset 1px 0 4px rgba(0,0,0,0.25)',
          backgroundImage: `${String(earStyle.backgroundImage)}, linear-gradient(270deg, rgba(0,0,0,0.12), transparent 55%)`,
        }}
      />
    </div>
  );
}

/** Alias — Geno Bass 52 chassis frame. */
export const GenoBassSub52Frame = GenoBassSub37Frame;
export function GenoBassWoodTrimFrame({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  trimPx?: number;
}) {
  return (
    <GenoBassSub37Frame className={className} style={style}>
      {children}
    </GenoBassSub37Frame>
  );
}

/** SPHINX-style main tab row — LIBRARY · OSC · GROOVE · MOD · FX */
export function GenoBassMainTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: readonly { id: string; label: string; title?: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 3,
        padding: '5px 6px 0',
        background: GENO_BASS_THEME.panelInset,
        borderBottom: `1px solid ${GENO_BASS_THEME.borderSection}`,
        flexShrink: 0,
      }}
    >
      {tabs.map((t) => {
        const on = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            title={t.title ?? t.label}
            onClick={() => onChange(t.id)}
            style={{
              flex: 1,
              padding: '7px 4px',
              fontSize: 8,
              fontWeight: 800,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              border: `1px solid ${on ? GENO_BASS_THEME.sphinxHi : GENO_BASS_THEME.border}`,
              borderBottom: on ? `2px solid ${GENO_BASS_THEME.sphinxHi}` : `1px solid ${GENO_BASS_THEME.border}`,
              borderRadius: '3px 3px 0 0',
              background: on
                ? `linear-gradient(180deg, ${GENO_BASS_THEME.sphinxGlow}, ${GENO_BASS_THEME.panelHi})`
                : GENO_BASS_THEME.panel,
              color: on ? GENO_BASS_THEME.sphinxHi : GENO_BASS_THEME.labelDim,
              boxShadow: on ? `0 0 10px ${GENO_BASS_THEME.sphinxGlow}` : 'none',
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

/** Fixed left/right rail module (filter / amp columns). */
export function GenoBassSideRail({
  title,
  children,
  width = 156,
  edge = 'left',
  style,
}: {
  title: string;
  children: ReactNode;
  width?: number;
  edge?: 'left' | 'right';
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        flex: `0 0 ${width}px`,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: 6,
        borderLeft: edge === 'right' ? `1px solid ${GENO_BASS_THEME.border}` : undefined,
        borderRight: edge === 'left' ? `1px solid ${GENO_BASS_THEME.border}` : undefined,
        background: GENO_BASS_THEME.panelInset,
        overflow: 'hidden',
        ...style,
      }}
    >
      <div
        style={{
          fontSize: 7,
          fontWeight: 800,
          letterSpacing: '0.14em',
          color: GENO_BASS_THEME.labelDim,
          textAlign: 'center',
          paddingBottom: 4,
          borderBottom: `1px solid ${GENO_BASS_THEME.border}`,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

/** L/R LED peak meters (SPHINX output column). */
export function GenoBassStereoMeter({ level = 0 }: { level?: number }) {
  const seg = 14;
  const lit = Math.round(Math.max(0, Math.min(1, level)) * seg);
  const segColor = (i: number, on: boolean) => {
    if (!on) return GENO_BASS_THEME.panelInset;
    if (i > seg - 3) return '#ff6b4a';
    if (i > seg - 6) return GENO_BASS_THEME.amberHi;
    return GENO_BASS_THEME.sphinx;
  };
  const col = (ch: 'L' | 'R') => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <span style={{ fontSize: 6, fontWeight: 800, color: GENO_BASS_THEME.labelDim }}>{ch}</span>
      <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: 1, height: 48 }}>
        {Array.from({ length: seg }, (_, i) => {
          const on = i < lit;
          return (
            <div
              key={i}
              style={{
                width: 7,
                height: 2,
                borderRadius: 1,
                background: segColor(i, on),
                boxShadow: on ? `0 0 4px ${GENO_BASS_THEME.sphinxGlow}` : 'none',
              }}
            />
          );
        })}
      </div>
    </div>
  );
  return (
    <div style={{ display: 'flex', gap: 5, justifyContent: 'center' }}>
      {col('L')}
      {col('R')}
    </div>
  );
}

/** OCT ▼ / label / ▲ — stacks above the pitch wheel (groove keyboard row). */
export function GenoBassOctaveStack({
  octaveLabel,
  disabled,
  onOctaveDown,
  onOctaveUp,
  octaveDownDisabled,
  octaveUpDisabled,
}: {
  octaveLabel: string;
  disabled?: boolean;
  onOctaveDown: () => void;
  onOctaveUp: () => void;
  octaveDownDisabled?: boolean;
  octaveUpDisabled?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        width: 40,
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: 5.5, fontWeight: 800, color: GENO_BASS_THEME.labelDim, letterSpacing: '0.1em' }}>
        OCT
      </span>
      <GenoBassBtn small disabled={disabled || octaveDownDisabled} onClick={onOctaveDown} title="Octave down">
        ▼
      </GenoBassBtn>
      <GenoBassLcd sub="OCT" width={40}>
        {octaveLabel}
      </GenoBassLcd>
      <GenoBassBtn small disabled={disabled || octaveUpDisabled} onClick={onOctaveUp} title="Octave up">
        ▲
      </GenoBassBtn>
    </div>
  );
}

/** Semi + Fine — stacks above the mod wheel. */
export function GenoBassSemiFineStack({
  semi,
  fineCents,
  disabled,
  onSemiChange,
  onFineChange,
}: {
  semi: number;
  fineCents: number;
  disabled?: boolean;
  onSemiChange: (v: number) => void;
  onFineChange: (v: number) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        width: 40,
        flexShrink: 0,
      }}
    >
      <GenoBassMoogKnob
        compact
        label="Semi"
        value={semi}
        min={-12}
        max={12}
        decimals={0}
        disabled={disabled}
        onChange={onSemiChange}
      />
      <GenoBassMoogKnob
        compact
        label="Fine"
        value={fineCents}
        min={-50}
        max={50}
        decimals={0}
        disabled={disabled}
        onChange={onFineChange}
      />
    </div>
  );
}

/** @deprecated Use GenoBassOctaveStack + GenoBassSemiFineStack over wheels. */
export function GenoBassPitchStrip({
  octaveLabel,
  semi,
  fineCents,
  disabled,
  onOctaveDown,
  onOctaveUp,
  octaveDownDisabled,
  octaveUpDisabled,
  onSemiChange,
  onFineChange,
}: {
  octaveLabel: string;
  semi: number;
  fineCents: number;
  disabled?: boolean;
  onOctaveDown: () => void;
  onOctaveUp: () => void;
  octaveDownDisabled?: boolean;
  octaveUpDisabled?: boolean;
  onSemiChange: (v: number) => void;
  onFineChange: (v: number) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
      <GenoBassOctaveStack
        octaveLabel={octaveLabel}
        disabled={disabled}
        onOctaveDown={onOctaveDown}
        onOctaveUp={onOctaveUp}
        octaveDownDisabled={octaveDownDisabled}
        octaveUpDisabled={octaveUpDisabled}
      />
      <GenoBassSemiFineStack
        semi={semi}
        fineCents={fineCents}
        disabled={disabled}
        onSemiChange={onSemiChange}
        onFineChange={onFineChange}
      />
    </div>
  );
}

export function GenoBassBrandBanner() {
  return (
    <div
      style={{
        textAlign: 'left',
        padding: '2px 0',
        minWidth: 108,
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 900,
          letterSpacing: 4,
          color: GENO_BASS_THEME.labelHi,
          lineHeight: 1,
        }}
      >
        GENO
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 900,
          letterSpacing: 6,
          color: GENO_BASS_THEME.amberHi,
          textShadow: `0 0 12px ${GENO_BASS_THEME.amberGlow}`,
          lineHeight: 1.1,
        }}
      >
        BASS 52
      </div>
      <div style={{ fontSize: 6, color: GENO_BASS_THEME.labelDim, letterSpacing: 1.4, marginTop: 3 }}>
        GENO BASS 52 · {GENO_BASS_SYNTH_PRESET_COUNT} VOICES
      </div>
    </div>
  );
}

/** Monochrome LCD — amber readout like Subsequent 37 preset screen. */
export function GenoBassLcd({
  children,
  sub,
  width,
}: {
  children: ReactNode;
  sub?: string;
  width?: number | string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
      <div
        style={{
          position: 'relative',
          width: width ?? '100%',
          minHeight: 28,
          padding: '5px 10px',
          background: `linear-gradient(180deg, ${GENO_BASS_THEME.lcdBg} 0%, #0e0e10 100%)`,
          border: `1px solid ${GENO_BASS_THEME.lcdDim}`,
          boxShadow: `inset 0 2px 12px rgba(0,0,0,0.95), inset 0 0 20px ${GENO_BASS_THEME.amber}08`,
          fontFamily: 'Consolas, "Lucida Console", monospace',
          fontSize: 11,
          fontWeight: 700,
          color: GENO_BASS_THEME.lcdText,
          textShadow: `0 0 8px ${GENO_BASS_THEME.amber}88`,
          letterSpacing: '0.08em',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
        }}
      >
        <div style={lcdScanline} />
        <span style={{ position: 'relative' }}>{children}</span>
      </div>
      {sub ? (
        <span style={{ fontSize: 6, color: GENO_BASS_THEME.labelDim, letterSpacing: '0.14em', paddingLeft: 2 }}>
          {sub}
        </span>
      ) : null}
    </div>
  );
}

/** Amber LCD — click to type BPM, drag to scrub (when sync is off). */
export function GenoBassLcdValueBar({
  value,
  suffix = '',
  width,
  sub,
  title,
  onChange,
  disabled,
  min = 40,
  max = 240,
  step = 1,
}: {
  value: number;
  suffix?: string;
  width?: number | string;
  sub?: string;
  title?: string;
  onChange?: (v: number) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
}) {
  const safeVal = clampAnaNum(value, min, max, min ?? 0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const dragRef = useRef<{ y: number; val: number; moved: boolean } | null>(null);

  const display = String(Math.round(safeVal));

  const commit = useCallback(
    (raw: string | number) => {
      if (!onChange) return;
      const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
      onChange(clampAnaNum(n, min, max, safeVal));
    },
    [max, min, onChange, safeVal],
  );

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (disabled || !onChange || editing) return;
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = { y: e.clientY, val: safeVal, moved: false };
    },
    [disabled, editing, onChange, safeVal],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current || !onChange || disabled) return;
      const dy = dragRef.current.y - e.clientY;
      if (Math.abs(dy) > 3) dragRef.current.moved = true;
      const range = max != null && min != null ? max - min : 100;
      const delta = dy * (range / 120);
      const next = clampAnaNum(dragRef.current.val + delta, min, max, safeVal);
      const snapped = step > 0 ? Math.round(next / step) * step : next;
      onChange(snapped);
    },
    [disabled, max, min, onChange, safeVal, step],
  );

  const onPointerUp = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      if (drag && !drag.moved && !editing && onChange && !disabled) {
        setDraft(display);
        setEditing(true);
      }
      dragRef.current = null;
    },
    [disabled, display, editing, onChange],
  );

  const lcdBody = (
    <div
      title={title}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: 'relative',
        width: width ?? '100%',
        minHeight: 28,
        padding: '5px 10px',
        background: `linear-gradient(180deg, ${GENO_BASS_THEME.lcdBg} 0%, #0e0e10 100%)`,
        border: `1px solid ${onChange && !disabled ? GENO_BASS_THEME.amberHi : GENO_BASS_THEME.lcdDim}`,
        boxShadow: `inset 0 2px 12px rgba(0,0,0,0.95), inset 0 0 20px ${GENO_BASS_THEME.amber}08${
          onChange && !disabled ? `, 0 0 8px ${GENO_BASS_THEME.amberGlow}` : ''
        }`,
        fontFamily: 'Consolas, "Lucida Console", monospace',
        fontSize: 11,
        fontWeight: 700,
        color: GENO_BASS_THEME.lcdText,
        textShadow: `0 0 8px ${GENO_BASS_THEME.amber}88`,
        letterSpacing: '0.08em',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        cursor: onChange && !disabled ? 'ns-resize' : 'default',
        userSelect: 'none',
      }}
    >
      <div style={lcdScanline} />
      {editing ? (
        <input
          autoFocus
          type="text"
          inputMode="numeric"
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            commit(draft);
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit(draft);
              setEditing(false);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              setEditing(false);
            }
          }}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'relative',
            width: '100%',
            margin: 0,
            padding: 0,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            font: 'inherit',
            color: 'inherit',
            textShadow: 'inherit',
            letterSpacing: 'inherit',
          }}
        />
      ) : (
        <span style={{ position: 'relative' }}>
          {display}
          {suffix ? <span style={{ marginLeft: 3, fontSize: 9, opacity: 0.85 }}>{suffix}</span> : null}
        </span>
      )}
    </div>
  );

  if (!sub) return lcdBody;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
      {lcdBody}
      <span style={{ fontSize: 6, color: GENO_BASS_THEME.labelDim, letterSpacing: '0.14em', paddingLeft: 2 }}>
        {sub}
      </span>
    </div>
  );
}

/** White silkscreen section bracket on black panel. */
export function GenoBassSection({
  title,
  children,
  flex,
}: {
  title: string;
  children: ReactNode;
  flex?: string;
}) {
  return (
    <div
      style={{
        flex,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        border: `1px solid ${GENO_BASS_THEME.borderSection}`,
        borderRadius: 2,
        background: `linear-gradient(180deg, ${GENO_BASS_THEME.panelHi} 0%, ${GENO_BASS_THEME.panel} 100%)`,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      <div
        style={{
          padding: '3px 8px',
          borderBottom: `1px solid ${GENO_BASS_THEME.borderSection}`,
          fontSize: 7,
          fontWeight: 800,
          letterSpacing: '0.18em',
          color: GENO_BASS_THEME.label,
          textTransform: 'uppercase',
        }}
      >
        {title}
      </div>
      <div style={{ padding: 8, flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  );
}

/** Square translucent button — glows amber when active. */
export function GenoBassBtn({
  children,
  active,
  disabled,
  onClick,
  title,
  small,
  saveHighlight,
}: {
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  title?: string;
  small?: boolean;
  saveHighlight?: boolean;
}) {
  const saveRing = 'rgba(255,118,118,0.72)';
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      style={{
        padding: small ? '3px 8px' : '5px 12px',
        fontSize: small ? 7 : 8,
        fontWeight: 800,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        borderRadius: 2,
        border: saveHighlight
          ? `1px solid ${saveRing}`
          : `1px solid ${active ? GENO_BASS_THEME.amberHi : GENO_BASS_THEME.border}`,
        background: active
          ? `linear-gradient(180deg, ${GENO_BASS_THEME.amberHi}cc, ${GENO_BASS_THEME.amber}88)`
          : `linear-gradient(180deg, ${GENO_BASS_THEME.panelHi}, ${GENO_BASS_THEME.panelInset})`,
        color: active ? '#1a1008' : GENO_BASS_THEME.labelDim,
        boxShadow: saveHighlight
          ? `0 0 0 1px rgba(255,90,90,0.22)${active ? `, 0 0 14px ${GENO_BASS_THEME.amberGlow}` : ''}`
          : active
            ? `0 0 14px ${GENO_BASS_THEME.amberGlow}, inset 0 1px 0 rgba(255,255,255,0.35)`
            : 'inset 0 1px 0 rgba(255,255,255,0.04)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'box-shadow 0.12s, background 0.12s',
      }}
    >
      {children}
    </button>
  );
}

/** Moog-style black knob — silver cap, white indicator line. */
export function GenoBassMoogKnob({
  label,
  value,
  min,
  max,
  decimals = 0,
  unit = '',
  disabled,
  onChange,
  large,
  compact,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  decimals?: number;
  unit?: string;
  disabled?: boolean;
  onChange: (v: number) => void;
  large?: boolean;
  compact?: boolean;
}) {
  const bodyGradId = useId().replace(/:/g, '');
  const capGradId = useId().replace(/:/g, '');
  const startRef = useRef<{ val: number; y: number; x: number } | null>(null);
  const def = (min + max) / 2;
  const safeValue = Number.isFinite(value) ? value : def;
  const size = large ? 48 : compact ? 32 : 40;
  const t = Math.max(0, Math.min(1, (safeValue - min) / (max - min || 1)));
  const markerDeg = -135 + t * 270;
  const markerRad = (markerDeg * Math.PI) / 180;
  const cx = size / 2;
  const cy = size / 2;
  const rMarker = size * 0.28;

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      startRef.current = { val: safeValue, y: e.clientY, x: e.clientX };
    },
    [disabled, safeValue],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!startRef.current || disabled) return;
      const dy = startRef.current.y - e.clientY;
      const dx = (startRef.current.x - e.clientX) * 0.12;
      const range = max - min || 1;
      const next = Math.max(min, Math.min(max, startRef.current.val + (dy + dx) * (range / 140)));
      onChange(Number(next.toPrecision(10)));
      startRef.current = { ...startRef.current, y: e.clientY, x: e.clientX, val: next };
    },
    [disabled, max, min, onChange],
  );

  const onPointerUp = useCallback((e: PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* */
    }
    startRef.current = null;
  }, []);

  const display =
    decimals <= 0 ? String(Math.round(safeValue)) : Number(safeValue.toFixed(decimals)).toString();

  return (
    <div
      role="presentation"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={() => {
        if (!disabled) onChange(def);
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        minWidth: size + 6,
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'default' : 'ns-resize',
        userSelect: 'none',
        touchAction: 'none',
      }}
      title={`${label} — drag up/down`}
    >
      <svg
        width={size + 4}
        height={size + 4}
        viewBox={`0 0 ${size + 4} ${size + 4}`}
        style={{ filter: 'drop-shadow(0 3px 5px rgba(0,0,0,0.7))' }}
      >
        <defs>
          <radialGradient id={bodyGradId} cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#2a2a30" />
            <stop offset="55%" stopColor={GENO_BASS_THEME.knobBody} />
            <stop offset="100%" stopColor="#08080a" />
          </radialGradient>
          <radialGradient id={capGradId} cx="45%" cy="38%" r="55%">
            <stop offset="0%" stopColor="#e8e8ec" />
            <stop offset="100%" stopColor={GENO_BASS_THEME.knobCap} />
          </radialGradient>
        </defs>
        <circle cx={cx + 2} cy={cy + 2} r={size * 0.44} fill="#050506" stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
        <circle cx={cx + 2} cy={cy + 2} r={size * 0.36} fill={`url(#${bodyGradId})`} />
        <circle cx={cx + 2} cy={cy + 2} r={size * 0.22} fill={`url(#${capGradId})`} opacity={0.92} />
        <line
          x1={cx + 2}
          y1={cy + 2}
          x2={cx + 2 + rMarker * Math.cos(markerRad)}
          y2={cy + 2 + rMarker * Math.sin(markerRad)}
          stroke="#f4f4f8"
          strokeWidth={2}
          strokeLinecap="round"
        />
      </svg>
      <span
        style={{
          fontSize: 6,
          fontWeight: 800,
          color: GENO_BASS_THEME.label,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          textAlign: 'center',
          maxWidth: 52,
          lineHeight: 1.1,
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 7, fontWeight: 700, color: GENO_BASS_THEME.labelDim, fontVariantNumeric: 'tabular-nums' }}>
        {display}
        {unit ? <span style={{ marginLeft: 1, fontSize: 6 }}>{unit}</span> : null}
      </span>
    </div>
  );
}

/** Pitch / mod wheel — amber translucent roller on walnut lip. */
export function GenoBassWheel({
  label,
  value,
  onChange,
  disabled,
  springCenter = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  springCenter?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ y: number; v: number } | null>(null);
  const safeVal = clampAnaNum(value, -1, 1, 0);

  const applyFromClientY = useCallback(
    (clientY: number) => {
      const el = trackRef.current;
      if (!el || disabled) return;
      const rect = el.getBoundingClientRect();
      const rel = 1 - (clientY - rect.top) / Math.max(1, rect.height);
      onChange(clampAnaNum(rel * 2 - 1, -1, 1, safeVal));
    },
    [disabled, onChange, safeVal],
  );

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = { y: e.clientY, v: safeVal };
      applyFromClientY(e.clientY);
    },
    [applyFromClientY, disabled, safeVal],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId) || disabled) return;
      const dy = dragRef.current ? dragRef.current.y - e.clientY : 0;
      if (dragRef.current) {
        const next = clampAnaNum(dragRef.current.v + dy / 48, -1, 1, safeVal);
        onChange(next);
        dragRef.current = { y: e.clientY, v: next };
      } else {
        applyFromClientY(e.clientY);
      }
    },
    [applyFromClientY, disabled, onChange, safeVal],
  );

  const onPointerUp = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* */
      }
      dragRef.current = null;
      if (springCenter) onChange(0);
    },
    [onChange, springCenter],
  );

  const t = (safeVal + 1) / 2;
  const w = 40;
  const h = 72;
  const rollerH = 20;
  const rollerTop = 6 + (1 - t) * (h - rollerH - 12);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, userSelect: 'none' }}>
      <div
        style={{
          borderRadius: '4px 4px 0 0',
          padding: '2px 2px 0',
          ...GENO_BASS_WOOD_BG,
          border: `1px solid ${GENO_BASS_WOOD.woodDeep}`,
          borderBottom: 'none',
        }}
      >
        <div
          ref={trackRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={() => {
            if (!disabled) onChange(0);
          }}
          title={`${label} — drag`}
          style={{
            width: w,
            height: h,
            borderRadius: '3px 3px 0 0',
            border: `1px solid ${GENO_BASS_THEME.border}`,
            borderBottom: 'none',
            background: `linear-gradient(180deg, #1a1a1e 0%, ${GENO_BASS_THEME.wheelBed} 100%)`,
            position: 'relative',
            cursor: disabled ? 'default' : 'ns-resize',
            touchAction: 'none',
            boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.75)',
            opacity: disabled ? 0.45 : 1,
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 7,
              right: 7,
              top: rollerTop,
              height: rollerH,
              borderRadius: 3,
              background: `linear-gradient(180deg, ${GENO_BASS_THEME.amberHi}aa, ${GENO_BASS_THEME.amber}66)`,
              border: `1px solid ${GENO_BASS_THEME.amberHi}`,
              boxShadow: `0 0 10px ${GENO_BASS_THEME.amberGlow}, inset 0 1px 0 rgba(255,255,255,0.35)`,
            }}
          />
        </div>
      </div>
      <span style={{ fontSize: 6, fontWeight: 800, color: GENO_BASS_THEME.labelDim, letterSpacing: '0.14em' }}>
        {label}
      </span>
    </div>
  );
}

/** Black preset browser — white list, amber selection. */
export function GenoBassPresetBrowser({
  bankLabel,
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
  bankLabel?: string;
  leftItems: readonly { id: string; label: string }[];
  activeLeftId: string;
  onLeftChange: (id: string) => void;
  rightItems: readonly { id: string; label: string }[];
  activeRightId: string;
  onRightSelect: (id: string) => void;
  onPrev?: () => void;
  onNext?: () => void;
  disabled?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, height: '100%', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
        <span style={{ fontSize: 7, fontWeight: 800, color: GENO_BASS_THEME.label, letterSpacing: '0.14em' }}>
          {bankLabel ?? 'BANK'}
        </span>
        <div style={{ display: 'flex', gap: 3 }}>
          <GenoBassBtn small disabled={disabled} onClick={onPrev} title="Previous">
            ◀
          </GenoBassBtn>
          <GenoBassBtn small disabled={disabled} onClick={onNext} title="Next">
            ▶
          </GenoBassBtn>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, flex: 1, minHeight: 0 }}>
        <div
          style={{
            flex: '0 0 72px',
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            overflowY: 'auto',
            borderRight: `1px solid ${GENO_BASS_THEME.border}`,
            paddingRight: 4,
          }}
        >
          {leftItems.map((item) => {
            const on = item.id === activeLeftId;
            return (
              <button
                key={item.id}
                type="button"
                disabled={disabled}
                onClick={() => onLeftChange(item.id)}
                style={{
                  padding: '4px 5px',
                  fontSize: 7,
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  textAlign: 'left',
                  border: `1px solid ${on ? GENO_BASS_THEME.sphinx : 'transparent'}`,
                  borderRadius: 2,
                  background: on ? `${GENO_BASS_THEME.sphinx}22` : 'transparent',
                  color: on ? GENO_BASS_THEME.sphinxHi : GENO_BASS_THEME.labelDim,
                  boxShadow: on ? `0 0 8px ${GENO_BASS_THEME.sphinxGlow}` : 'none',
                  cursor: disabled ? 'default' : 'pointer',
                  opacity: disabled ? 0.4 : 1,
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1, overflowY: 'auto', minWidth: 0 }}>
          {rightItems.map((item) => {
            const on = item.id === activeRightId;
            return (
              <button
                key={item.id}
                type="button"
                disabled={disabled}
                onClick={() => onRightSelect(item.id)}
                style={{
                  padding: '4px 7px',
                  fontSize: 8,
                  fontWeight: on ? 800 : 600,
                  textAlign: 'left',
                  border: 'none',
                  borderLeft: `2px solid ${on ? GENO_BASS_THEME.sphinxHi : 'transparent'}`,
                  borderRadius: 1,
                  background: on ? `linear-gradient(90deg, ${GENO_BASS_THEME.sphinx}22, transparent)` : 'transparent',
                  color: on ? GENO_BASS_THEME.labelHi : GENO_BASS_THEME.labelDim,
                  cursor: disabled ? 'default' : 'pointer',
                  opacity: disabled ? 0.4 : 1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Walnut keyboard bed — wraps piano keys row (unchanged across tabs). */
export function GenoBassKeyboardBed({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        padding: '6px 8px 8px',
        ...GENO_BASS_WOOD_BG,
        borderTop: `1px solid ${GENO_BASS_WOOD.woodDeep}`,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)',
        position: 'relative',
        zIndex: 1,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          borderRadius: '4px 4px 0 0',
          background: `linear-gradient(180deg, ${GENO_BASS_THEME.panelHi}, ${GENO_BASS_THEME.panel})`,
          border: `1px solid ${GENO_BASS_THEME.border}`,
          padding: '6px 8px',
        }}
      >
        {children}
      </div>
    </div>
  );
}

const GENO_BASS_CELL_ROW_H = 22;
const GENO_BASS_CELL_COL_W = 14;
const GENO_BASS_GRID_LABEL_W = 40;

/** Bass groove step grid — 3 rows (root / 5th / octave), not 11-row arp spread. */
export function GenoBassStepGrid({
  grid,
  barLength = 4,
  rateLabel = '1/16',
  grooveLabel = 'FUNK',
  playStep = -1,
  seqActive = false,
  disabled,
  onToggle,
}: {
  grid: boolean[][];
  barLength?: number;
  rateLabel?: string;
  grooveLabel?: string;
  playStep?: number;
  seqActive?: boolean;
  disabled?: boolean;
  onToggle?: (row: number, col: number) => void;
}) {
  const bars = barLength >= 8 ? 8 : 4;
  const cols = bars * 16;
  const rows = 3;
  const rowLabels = ['ROOT', '5TH', 'OCT'];
  const gridW = cols * GENO_BASS_CELL_COL_W;
  const gridH = rows * GENO_BASS_CELL_ROW_H;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, width: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
          padding: '2px 4px',
          fontSize: 7,
          fontWeight: 800,
          letterSpacing: '0.08em',
          color: GENO_BASS_THEME.labelDim,
          borderBottom: `1px solid ${GENO_BASS_THEME.border}`,
          background: GENO_BASS_THEME.panelInset,
        }}
      >
        <span
          style={{
            color: seqActive ? GENO_BASS_THEME.amberHi : GENO_BASS_THEME.labelDim,
            textShadow: seqActive ? `0 0 6px ${GENO_BASS_THEME.amberGlow}` : 'none',
          }}
        >
          {seqActive ? '● GROOVE' : '○ GROOVE'}
        </span>
        <span>{rateLabel}</span>
        <span>{grooveLabel}</span>
      </div>
      <div style={{ overflowX: 'auto', overflowY: 'hidden' }}>
        <div style={{ display: 'flex', minWidth: GENO_BASS_GRID_LABEL_W + gridW }}>
          <div style={{ flex: `0 0 ${GENO_BASS_GRID_LABEL_W}px`, paddingTop: 18 }}>
            {rowLabels.map((label, ri) => (
              <div
                key={label}
                style={{
                  height: GENO_BASS_CELL_ROW_H,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  paddingRight: 4,
                  fontSize: 6,
                  fontWeight: 800,
                  color: GENO_BASS_THEME.labelDim,
                  letterSpacing: '0.06em',
                }}
              >
                {label}
              </div>
            ))}
          </div>
          <div style={{ position: 'relative' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${cols}, ${GENO_BASS_CELL_COL_W}px)`,
                gridTemplateRows: `18px repeat(${rows}, ${GENO_BASS_CELL_ROW_H}px)`,
                width: gridW,
                height: 18 + gridH,
              }}
            >
              {Array.from({ length: bars }, (_, bi) => (
                <div
                  key={`bar-${bi}`}
                  style={{
                    gridColumn: `${bi * 16 + 1} / span 16`,
                    gridRow: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 6,
                    fontWeight: 800,
                    color: GENO_BASS_THEME.lcdDim,
                    borderLeft: bi > 0 ? `1px solid ${GENO_BASS_THEME.border}` : undefined,
                    background: bi % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.15)',
                  }}
                >
                  BAR {bi + 1}
                </div>
              ))}
              {Array.from({ length: rows }, (_, ri) =>
                Array.from({ length: cols }, (_, ci) => {
                  const on = !!grid[ri]?.[ci];
                  const isPlayhead = playStep >= 0 && ci === playStep;
                  return (
                    <button
                      key={`${ri}-${ci}`}
                      type="button"
                      disabled={disabled}
                      onClick={() => onToggle?.(ri, ci)}
                      style={{
                        gridRow: ri + 2,
                        gridColumn: ci + 1,
                        margin: 0,
                        padding: 0,
                        border: `1px solid ${GENO_BASS_THEME.border}`,
                        background: on
                          ? `linear-gradient(180deg, ${GENO_BASS_THEME.amberHi}, ${GENO_BASS_THEME.amber})`
                          : ri % 2 === 0
                            ? 'rgba(255,255,255,0.03)'
                            : 'rgba(0,0,0,0.2)',
                        boxShadow: on ? `inset 0 0 6px ${GENO_BASS_THEME.amberGlow}` : 'none',
                        outline: isPlayhead ? `2px solid ${GENO_BASS_THEME.amberHi}` : 'none',
                        outlineOffset: -2,
                        cursor: disabled ? 'default' : 'pointer',
                        minHeight: GENO_BASS_CELL_ROW_H - 2,
                      }}
                      title={`${rowLabels[ri]} — step ${ci + 1}`}
                    />
                  );
                }),
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
