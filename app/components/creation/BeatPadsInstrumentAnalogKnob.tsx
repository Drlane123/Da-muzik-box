'use client';

import { useCallback, useId, useMemo, useRef, type ReactNode } from 'react';

const KNOB_SIZE = 44;
const KNOB_SWEEP = 270;
const KNOB_START = -135;

export type BeatPadsInstrumentAnalogKnobProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  accent?: string;
  disabled?: boolean;
  /** Log mapping — better for Hz / ms ranges. */
  scale?: 'linear' | 'log';
};

function snapValue(v: number, min: number, max: number, step: number) {
  const clamped = Math.max(min, Math.min(max, v));
  if (step <= 0) return clamped;
  const snapped = Math.round(clamped / step) * step;
  return Math.max(min, Math.min(max, Number(snapped.toPrecision(12))));
}

function valueToNorm(value: number, min: number, max: number, scale: 'linear' | 'log') {
  if (scale === 'log') {
    const lo = Math.max(1, min);
    const hi = Math.max(lo + 1, max);
    const v = Math.max(lo, Math.min(hi, value));
    return (Math.log(v) - Math.log(lo)) / (Math.log(hi) - Math.log(lo));
  }
  return (value - min) / (max - min || 1);
}

function normToValue(norm: number, min: number, max: number, scale: 'linear' | 'log', step: number) {
  const t = Math.max(0, Math.min(1, norm));
  let raw: number;
  if (scale === 'log') {
    const lo = Math.max(1, min);
    const hi = Math.max(lo + 1, max);
    raw = Math.exp(Math.log(lo) + t * (Math.log(hi) - Math.log(lo)));
  } else {
    raw = min + t * (max - min);
  }
  return snapValue(raw, min, max, step);
}

/** Fat traditional analog cap — Instrument tab only (not Pad FX / suite knobs). */
export function BeatPadsInstrumentAnalogKnob({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  accent = '#d4a84b',
  disabled = false,
  scale = 'linear',
}: BeatPadsInstrumentAnalogKnobProps) {
  const gradCap = useId().replace(/:/g, '');
  const gradBezel = useId().replace(/:/g, '');
  const startRef = useRef<{ norm: number; y: number; x: number } | null>(null);
  const size = KNOB_SIZE;
  const cx = size / 2;
  const cy = size / 2;

  const norm = valueToNorm(value, min, max, scale);
  const t = Math.max(0, Math.min(1, norm));
  const deg = KNOB_START + t * KNOB_SWEEP;
  const rad = (deg * Math.PI) / 180;
  const rTrack = size * 0.4;
  const arcLen = t * Math.PI * 2 * rTrack * (KNOB_SWEEP / 360);
  const tickCount = 15;

  const tickMarks = useMemo(() => {
    const marks: ReactNode[] = [];
    for (let i = 0; i < tickCount; i++) {
      const tickT = i / (tickCount - 1);
      const tickDeg = KNOB_START + tickT * KNOB_SWEEP;
      const tickRad = (tickDeg * Math.PI) / 180;
      const major = i === 0 || i === tickCount - 1 || i === Math.floor(tickCount / 2);
      const lit = tickT <= t + 0.015;
      const rOuter = size * 0.49;
      const rInner = size * (major ? 0.41 : 0.43);
      marks.push(
        <line
          key={i}
          x1={cx + rInner * Math.cos(tickRad)}
          y1={cy + rInner * Math.sin(tickRad)}
          x2={cx + rOuter * Math.cos(tickRad)}
          y2={cy + rOuter * Math.sin(tickRad)}
          stroke={lit ? accent : 'rgba(42, 36, 28, 0.85)'}
          strokeWidth={major ? 1.15 : 0.8}
          strokeLinecap="round"
          opacity={lit ? 1 : 0.75}
        />,
      );
    }
    return marks;
  }, [accent, cx, cy, size, t]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      startRef.current = { norm: t, y: e.clientY, x: e.clientX };
    },
    [disabled, t],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!startRef.current || disabled) return;
      const dy = startRef.current.y - e.clientY;
      const dx = (startRef.current.x - e.clientX) * 0.14;
      const deltaNorm = (dy + dx) / 88;
      const nextNorm = Math.max(0, Math.min(1, startRef.current.norm + deltaNorm));
      const next = normToValue(nextNorm, min, max, scale, step);
      onChange(next);
      startRef.current = { norm: nextNorm, y: e.clientY, x: e.clientX };
    },
    [disabled, max, min, onChange, scale, step],
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* */
    }
    startRef.current = null;
  }, []);

  const display = format ? format(value) : String(Math.round(value));

  return (
    <InstrumentAnalogKnobShell
      label={label}
      display={display}
      accent={accent}
      disabled={disabled}
      t={t}
      tickMarks={tickMarks}
      arcLen={arcLen}
      rad={rad}
      cx={cx}
      cy={cy}
      size={size}
      gradBezel={gradBezel}
      gradCap={gradCap}
      rTrack={rTrack}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onLostPointerCapture={() => {
        startRef.current = null;
      }}
    />
  );
}

type KnobShellProps = {
  label: string;
  display: string;
  accent: string;
  disabled: boolean;
  t: number;
  tickMarks: ReactNode;
  arcLen: number;
  rad: number;
  cx: number;
  cy: number;
  size: number;
  gradBezel: string;
  gradCap: string;
  rTrack: number;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onLostPointerCapture?: () => void;
};

function InstrumentAnalogKnobShell({
  label,
  display,
  accent,
  disabled,
  tickMarks,
  arcLen,
  rad,
  cx,
  cy,
  size,
  gradBezel,
  gradCap,
  rTrack,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onLostPointerCapture,
}: KnobShellProps) {
  return (
    <div
      className="beat-pads-instrument-analog-knob"
      role="presentation"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onLostPointerCapture={onLostPointerCapture}
      style={{
        opacity: disabled ? 0.42 : 1,
        cursor: disabled ? 'default' : 'ns-resize',
        ['--inst-knob-accent' as string]: accent,
      }}
      title={`${label}: ${display} — drag`}
    >
      <svg width={size} height={size} aria-hidden className="beat-pads-instrument-analog-knob__dial">
        <defs>
          <radialGradient id={gradBezel} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#3a3a42" />
            <stop offset="72%" stopColor="#1a1a22" />
            <stop offset="100%" stopColor="#0a0a10" />
          </radialGradient>
          <radialGradient id={gradCap} cx="38%" cy="32%" r="68%">
            <stop offset="0%" stopColor="#f0e6d4" />
            <stop offset="38%" stopColor="#c9b896" />
            <stop offset="72%" stopColor="#9a8668" />
            <stop offset="100%" stopColor="#6e5f48" />
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r={size * 0.49} fill={`url(#${gradBezel})`} />
        <circle
          cx={cx}
          cy={cy}
          r={size * 0.455}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={1}
        />
        {tickMarks}
        <circle cx={cx} cy={cy} r={rTrack} fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth={3} />
        <circle
          cx={cx}
          cy={cy}
          r={rTrack}
          fill="none"
          stroke={accent}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={`${arcLen} 999`}
          transform={`rotate(${KNOB_START} ${cx} ${cy})`}
          opacity={0.95}
        />
        <circle cx={cx} cy={cy} r={size * 0.335} fill={`url(#${gradCap})`} />
        <circle
          cx={cx}
          cy={cy}
          r={size * 0.335}
          fill="none"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth={0.8}
        />
        <circle cx={cx} cy={cy} r={size * 0.09} fill="#2a2418" stroke="rgba(0,0,0,0.5)" strokeWidth={0.6} />
        <line
          x1={cx}
          y1={cy}
          x2={cx + size * 0.26 * Math.cos(rad)}
          y2={cy + size * 0.26 * Math.sin(rad)}
          stroke="#1a1410"
          strokeWidth={2.6}
          strokeLinecap="round"
        />
        <line
          x1={cx}
          y1={cy}
          x2={cx + size * 0.24 * Math.cos(rad)}
          y2={cy + size * 0.24 * Math.sin(rad)}
          stroke="#f5f0e6"
          strokeWidth={1.2}
          strokeLinecap="round"
          opacity={0.9}
        />
      </svg>
      <span className="beat-pads-instrument-analog-knob__label">{label}</span>
      <span className="beat-pads-instrument-analog-knob__value">{display}</span>
    </div>
  );
}

/** Normalized 0–1 knob — LP cutoff OFF at zero travel. */
export function BeatPadsInstrumentNormKnob({
  label,
  norm,
  onNormChange,
  display,
  accent = '#d4a84b',
  disabled = false,
}: {
  label: string;
  norm: number;
  onNormChange: (n: number) => void;
  display: string;
  accent?: string;
  disabled?: boolean;
}) {
  const gradCap = useId().replace(/:/g, '');
  const gradBezel = useId().replace(/:/g, '');
  const startRef = useRef<{ norm: number; y: number; x: number } | null>(null);
  const size = KNOB_SIZE;
  const cx = size / 2;
  const cy = size / 2;
  const t = Math.max(0, Math.min(1, norm));
  const deg = KNOB_START + t * KNOB_SWEEP;
  const rad = (deg * Math.PI) / 180;
  const rTrack = size * 0.4;
  const arcLen = t * Math.PI * 2 * rTrack * (KNOB_SWEEP / 360);
  const tickCount = 15;

  const tickMarks = useMemo(() => {
    const marks: ReactNode[] = [];
    for (let i = 0; i < tickCount; i++) {
      const tickT = i / (tickCount - 1);
      const tickDeg = KNOB_START + tickT * KNOB_SWEEP;
      const tickRad = (tickDeg * Math.PI) / 180;
      const major = i === 0 || i === tickCount - 1 || i === Math.floor(tickCount / 2);
      const lit = tickT <= t + 0.015;
      const rOuter = size * 0.49;
      const rInner = size * (major ? 0.41 : 0.43);
      marks.push(
        <line
          key={i}
          x1={cx + rInner * Math.cos(tickRad)}
          y1={cy + rInner * Math.sin(tickRad)}
          x2={cx + rOuter * Math.cos(tickRad)}
          y2={cy + rOuter * Math.sin(tickRad)}
          stroke={lit ? accent : 'rgba(42, 36, 28, 0.85)'}
          strokeWidth={major ? 1.15 : 0.8}
          strokeLinecap="round"
          opacity={lit ? 1 : 0.75}
        />,
      );
    }
    return marks;
  }, [accent, cx, cy, size, t]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      startRef.current = { norm: t, y: e.clientY, x: e.clientX };
    },
    [disabled, t],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!startRef.current || disabled) return;
      const dy = startRef.current.y - e.clientY;
      const dx = (startRef.current.x - e.clientX) * 0.14;
      const deltaNorm = (dy + dx) / 88;
      const nextNorm = Math.max(0, Math.min(1, startRef.current.norm + deltaNorm));
      onNormChange(nextNorm);
      startRef.current = { norm: nextNorm, y: e.clientY, x: e.clientX };
    },
    [disabled, onNormChange],
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* */
    }
    startRef.current = null;
  }, []);

  return (
    <InstrumentAnalogKnobShell
      label={label}
      display={display}
      accent={accent}
      disabled={disabled}
      t={t}
      tickMarks={tickMarks}
      arcLen={arcLen}
      rad={rad}
      cx={cx}
      cy={cy}
      size={size}
      gradBezel={gradBezel}
      gradCap={gradCap}
      rTrack={rTrack}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onLostPointerCapture={() => {
        startRef.current = null;
      }}
    />
  );
}

/** LP cutoff — OFF at bottom, log sweep 200 Hz – 14 kHz. */
export function lpFreqKnobNorm(lpHz: number): number {
  if (lpHz <= 0) return 0;
  const v = Math.max(200, Math.min(14000, lpHz));
  return valueToNorm(v, 200, 14000, 'log');
}

export function lpFreqFromKnobNorm(norm: number): number {
  if (norm <= 0.04) return 0;
  return Math.round(normToValue((norm - 0.04) / 0.96, 200, 14000, 'log', 1));
}
