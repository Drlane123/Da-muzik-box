'use client';

import { useCallback, useId, useRef } from 'react';

export type Se2FusionDigitalKnobProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  accent?: string;
  size?: number;
  unit?: string;
  defaultValue?: number;
  disabled?: boolean;
};

const SWEEP_DEG = 270;
const START_DEG = -135;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function snapInt(n: number): number {
  return Math.round(n);
}

export function Se2FusionDigitalKnob({
  label,
  value,
  min,
  max,
  onChange,
  accent = '#00E5CC',
  size = 68,
  unit = '%',
  defaultValue,
  disabled = false,
}: Se2FusionDigitalKnobProps) {
  const gradId = useId().replace(/:/g, '');
  const glowId = `${gradId}-glow`;
  const bodyId = `${gradId}-body`;
  const dragRef = useRef<{ val: number; y: number; x: number } | null>(null);
  const def = defaultValue ?? Math.round((min + max) / 2);

  const t = clamp((value - min) / (max - min || 1), 0, 1);
  const needleDeg = START_DEG + t * SWEEP_DEG;
  const needleRad = (needleDeg * Math.PI) / 180;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.46;
  const arcR = size * 0.4;
  const hubR = size * 0.16;
  const tipR = size * 0.3;

  const arcLen = ((SWEEP_DEG * Math.PI) / 180) * arcR * t;

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = { val: value, y: e.clientY, x: e.clientX };
    },
    [disabled, value],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current || disabled) return;
      const dy = dragRef.current.y - e.clientY;
      const dx = (dragRef.current.x - e.clientX) * 0.22;
      const range = max - min || 1;
      const sensitivity = range / 120;
      const next = clamp(dragRef.current.val + (dy + dx) * sensitivity, min, max);
      onChange(snapInt(next));
      dragRef.current = { val: next, y: e.clientY, x: e.clientX };
    },
    [disabled, max, min, onChange],
  );

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* */
    }
    dragRef.current = null;
  }, []);

  const onDoubleClick = useCallback(() => {
    if (!disabled) onChange(snapInt(def));
  }, [def, disabled, onChange]);

  const display = String(snapInt(value));

  return (
    <div
      className="flex flex-col items-center select-none touch-none"
      style={{
        width: size + 8,
        gap: 4,
        opacity: disabled ? 0.42 : 1,
        cursor: disabled ? 'default' : 'grab',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
      title={`${label} — drag to adjust, double-click reset`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{
          overflow: 'visible',
          filter: disabled ? undefined : `drop-shadow(0 0 10px ${accent}33)`,
        }}
      >
        <defs>
          <radialGradient id={bodyId} cx="38%" cy="32%" r="68%">
            <stop offset="0%" stopColor="#2a3448" />
            <stop offset="45%" stopColor="#121820" />
            <stop offset="100%" stopColor="#06080c" />
          </radialGradient>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={accent} stopOpacity="1" />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.85" />
          </linearGradient>
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Outer halo */}
        <circle cx={cx} cy={cy} r={outerR + 2} fill="none" stroke={accent} strokeWidth={0.6} opacity={0.18} />

        {/* Body */}
        <circle cx={cx} cy={cy} r={outerR} fill={`url(#${bodyId})`} stroke="#3d4d62" strokeWidth={1.2} />

        {/* Tick marks */}
        {Array.from({ length: 13 }, (_, i) => {
          const tickT = i / 12;
          const deg = START_DEG + tickT * SWEEP_DEG;
          const rad = (deg * Math.PI) / 180;
          const r0 = arcR - (i % 3 === 0 ? 5 : 3);
          const r1 = arcR + 1;
          const major = i % 3 === 0;
          return (
            <line
              key={`tick-${i}`}
              x1={cx + r0 * Math.cos(rad)}
              y1={cy + r0 * Math.sin(rad)}
              x2={cx + r1 * Math.cos(rad)}
              y2={cy + r1 * Math.sin(rad)}
              stroke={major ? '#6a7a90' : '#3a4558'}
              strokeWidth={major ? 1.4 : 0.8}
              strokeLinecap="round"
              opacity={major ? 0.9 : 0.55}
            />
          );
        })}

        {/* Track ring */}
        <circle
          cx={cx}
          cy={cy}
          r={arcR}
          fill="none"
          stroke="#1a2230"
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={`${((SWEEP_DEG * Math.PI) / 180) * arcR} 999`}
          transform={`rotate(${START_DEG} ${cx} ${cy})`}
          opacity={0.95}
        />

        {/* Active arc */}
        {t > 0.001 ? (
          <circle
            cx={cx}
            cy={cy}
            r={arcR}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={5}
            strokeLinecap="round"
            strokeDasharray={`${arcLen} 999`}
            transform={`rotate(${START_DEG} ${cx} ${cy})`}
            filter={`url(#${glowId})`}
          />
        ) : null}

        {/* Hub */}
        <circle cx={cx} cy={cy} r={hubR + 3} fill="#0a0c12" stroke="#2a3548" strokeWidth={1} />
        <circle cx={cx} cy={cy} r={hubR} fill="#141a24" stroke={accent} strokeWidth={0.8} opacity={0.55} />

        {/* Indicator line — hub to arc (no tip dot) */}
        <line
          x1={cx + hubR * Math.cos(needleRad)}
          y1={cy + hubR * Math.sin(needleRad)}
          x2={cx + tipR * Math.cos(needleRad)}
          y2={cy + tipR * Math.sin(needleRad)}
          stroke={accent}
          strokeWidth={2.2}
          strokeLinecap="round"
          filter={`url(#${glowId})`}
          opacity={0.92}
        />
      </svg>

      <div
        className="flex flex-col items-center gap-0.5 w-full"
        style={{ maxWidth: size + 12 }}
      >
        <span
          className="text-[7px] font-bold uppercase tracking-[0.14em] text-center leading-tight"
          style={{ color: '#8a96a8' }}
        >
          {label}
        </span>
        <span
          className="text-[10px] font-black tabular-nums leading-none px-1.5 py-0.5 rounded"
          style={{
            color: accent,
            background: 'rgba(0,0,0,0.45)',
            border: `1px solid ${accent}44`,
            boxShadow: `0 0 12px ${accent}22`,
            fontFamily: 'ui-monospace, monospace',
          }}
        >
          {display}
          {unit ? (
            <span style={{ color: '#6a7a8c', fontSize: 8, marginLeft: 1 }}>{unit}</span>
          ) : null}
        </span>
      </div>
    </div>
  );
}
