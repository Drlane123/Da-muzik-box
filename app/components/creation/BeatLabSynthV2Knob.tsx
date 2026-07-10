/**
 * Vital-style rotary control: drag up/down (and optional horizontal fine adjust).
 */
import React, { useCallback, useId, useRef } from 'react';

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
  /** Glass / glow skin for Beat Lab pad FX panels. */
  variant?: 'default' | 'modern';
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
  variant = 'default',
}: SynthRoundKnobProps) {
  const gradId = useId().replace(/:/g, '');
  const startRef = useRef<{ val: number; y: number; x: number } | null>(null);
  const def = defaultValue ?? (min + max) / 2;
  const modern = variant === 'modern';

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

  const onLostPointerCapture = useCallback(() => {
    startRef.current = null;
  }, []);

  const onDoubleClick = useCallback(() => {
    if (!disabled) onChange(def);
  }, [def, disabled, onChange]);

  const display = decimals <= 0 ? String(Math.round(value)) : Number(value.toFixed(decimals)).toString();

  return (
    <div
      className={modern ? 'beat-pads-fx-knob' : undefined}
      role="presentation"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onLostPointerCapture={onLostPointerCapture}
      onDoubleClick={onDoubleClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: modern ? 3 : 2,
        minWidth: size + 4,
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'default' : 'ns-resize',
        userSelect: 'none',
        touchAction: 'none',
      }}
      title={`${label} — drag up/down, double-click reset`}
    >
      <svg
        width={size}
        height={size}
        style={{
          overflow: 'visible',
          filter: modern
            ? `drop-shadow(0 0 6px ${accent}55) drop-shadow(0 2px 4px rgba(0,0,0,0.55))`
            : 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))',
        }}
      >
        {modern ? (
          <defs>
            <radialGradient id={gradId} cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#2a3348" />
              <stop offset="55%" stopColor="#121722" />
              <stop offset="100%" stopColor="#07090f" />
            </radialGradient>
          </defs>
        ) : null}
        <circle
          cx={cx}
          cy={cy}
          r={size * 0.4}
          fill={modern ? `url(#${gradId})` : '#141820'}
          stroke={modern ? 'rgba(255,255,255,0.12)' : '#2a3548'}
          strokeWidth={modern ? 1.4 : 1.8}
        />
        <circle
          cx={cx}
          cy={cy}
          r={rTrack}
          fill="none"
          stroke={modern ? 'rgba(255,255,255,0.06)' : '#1e2736'}
          strokeWidth={modern ? 3.2 : 4}
          opacity={0.95}
        />
        <circle
          cx={cx}
          cy={cy}
          r={rTrack}
          fill="none"
          stroke={accent}
          strokeWidth={modern ? 3.2 : 4}
          strokeLinecap="round"
          strokeDasharray={`${t * Math.PI * 2 * rTrack * 0.75} ${999}`}
          transform={`rotate(-135 ${cx} ${cy})`}
          opacity={modern ? 1 : 0.95}
        />
        <circle
          cx={cx}
          cy={cy}
          r={size * 0.13}
          fill={modern ? '#0a0d14' : '#0c0e14'}
          stroke={modern ? 'rgba(255,255,255,0.18)' : '#3a4458'}
          strokeWidth={1.2}
        />
        <line
          x1={cx}
          y1={cy}
          x2={cx + rNeedle * Math.cos(rad)}
          y2={cy + rNeedle * Math.sin(rad)}
          stroke={modern ? '#f8fafc' : '#eef2ff'}
          strokeWidth={modern ? 2.4 : 2.2}
          strokeLinecap="round"
        />
      </svg>
      <span
        style={{
          fontSize: modern ? 6 : 7,
          color: modern ? '#8b96a8' : '#7a8899',
          fontWeight: modern ? 800 : 700,
          letterSpacing: modern ? '0.12em' : 0,
          textTransform: modern ? 'uppercase' : 'none',
          textAlign: 'center',
          maxWidth: 56,
          lineHeight: 1.15,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: modern ? 9 : 8,
          color: modern ? '#eef2f8' : '#cfd8ea',
          fontWeight: 800,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {display}
        {unit ? <span style={{ color: modern ? '#7a8798' : '#5a6a7a', marginLeft: 2 }}>{unit}</span> : null}
      </span>
    </div>
  );
}
