/**
 * Vital-style rotary control: drag up/down (and optional horizontal fine adjust).
 */
import React, { useCallback, useRef } from 'react';

export type SynthRoundKnobProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  /** Display decimals */
  decimals?: number;
  /** Norm 0–1 for arc sweep (optional alternative to linear min/max). */
  unit?: string;
  onChange: (v: number) => void;
  /** Knob diameter */
  size?: number;
  /** Accent ring color */
  accent?: string;
  defaultValue?: number;
  disabled?: boolean;
};

export function SynthRoundKnob({
  label,
  value,
  min,
  max,
  decimals = 2,
  unit = '',
  onChange,
  size = 36,
  accent = '#58c4ff',
  defaultValue,
  disabled = false,
}: SynthRoundKnobProps) {
  const startRef = useRef<{ val: number; y: number; x: number } | null>(null);
  const def = defaultValue ?? (min + max) / 2;

  const t = Math.max(0, Math.min(1, (value - min) / (max - min || 1)));
  /** Pointer angle — 7 o'clock idle to clockwise sweep ~270° */
  const deg = -135 + t * 270;
  const rad = (deg * Math.PI) / 180;
  const rNeedle = size * 0.22;
  const rTrack = size * 0.38;
  const cx = size / 2;
  const cy = size / 2;


  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      startRef.current = { val: value, y: e.clientY, x: e.clientX };
    },
    [disabled, value],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!startRef.current || disabled) return;
      const dy = startRef.current.y - e.clientY;
      const dx = (startRef.current.x - e.clientX) * 0.15;
      const delta = dy + dx;
      const range = max - min || 1;
      const sensitivity = range / 140;
      const next = Math.max(min, Math.min(max, startRef.current.val + delta * sensitivity));
      onChange(Number(next.toPrecision(10)));
      startRef.current = { ...startRef.current, y: e.clientY, x: e.clientX, val: next };
    },
    [disabled, max, min, onChange],
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* */
    }
    startRef.current = null;
  }, []);

  const onDoubleClick = useCallback(() => {
    if (!disabled) onChange(def);
  }, [def, disabled, onChange]);

  const display = decimals <= 0 ? String(Math.round(value)) : Number(value.toFixed(decimals)).toString();

  return (
    <div
      role="presentation"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        minWidth: size + 4,
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'default' : 'ns-resize',
        userSelect: 'none',
        touchAction: 'none',
      }}
      title={`${label} — drag up/down, double-click reset`}
    >
      <svg width={size} height={size} style={{ overflow: 'visible', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}>
        <circle cx={cx} cy={cy} r={size * 0.4} fill="#141820" stroke="#2a3548" strokeWidth={1.8} />
        <circle cx={cx} cy={cy} r={rTrack} fill="none" stroke="#1e2736" strokeWidth={4} opacity={0.9} />
        <circle
          cx={cx}
          cy={cy}
          r={rTrack}
          fill="none"
          stroke={accent}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={`${t * Math.PI * 2 * rTrack * 0.75} ${999}`}
          transform={`rotate(-135 ${cx} ${cy})`}
          opacity={0.95}
        />
        <circle cx={cx} cy={cy} r={size * 0.13} fill="#0c0e14" stroke="#3a4458" strokeWidth={1.2} />
        <line
          x1={cx}
          y1={cy}
          x2={cx + rNeedle * Math.cos(rad)}
          y2={cy + rNeedle * Math.sin(rad)}
          stroke="#eef2ff"
          strokeWidth={2.2}
          strokeLinecap="round"
        />
      </svg>
      <span style={{ fontSize: 7, color: '#7a8899', fontWeight: 700, textAlign: 'center', maxWidth: 56, lineHeight: 1.15 }}>
        {label}
      </span>
      <span style={{ fontSize: 8, color: '#cfd8ea', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
        {display}
        {unit ? <span style={{ color: '#5a6a7a', marginLeft: 2 }}>{unit}</span> : null}
      </span>
    </div>
  );
}
