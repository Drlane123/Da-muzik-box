'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { SuiteFader } from '@/app/components/studio/studioFxSuiteWidgets';
import type { PadSamplerEqFx } from '@/app/lib/creationStation/padSamplerFxRack';
import { padWaveformEqMagDb } from '@/app/lib/creationStation/padSampleWaveform';
import '@/app/styles/studioFxSuite.css';

const BEAT_PADS_FX_FADER_H = 38;
/** Insert meter/graph bay — tall enough to sit flush above limiter strip. */
export const BEAT_PADS_FX_VIZ_H = 92;
const BEAT_PADS_FX_KNOB_SIZE = 32;
const BEAT_PADS_FX_KNOB_ACCENT = '#e8b923';
const BEAT_PADS_FX_KNOB_SWEEP = 270;
const BEAT_PADS_FX_KNOB_START = -135;

export type BeatPadsFxMeterLevels = {
  inputL: number;
  inputR: number;
  mid: number;
  outputL: number;
  outputR: number;
};

/** Animated meter levels — pulses with insert activity (no SE2 analyser required). */
export function useBeatPadsFxMeterPulse(activity: number, enabled: boolean): BeatPadsFxMeterLevels {
  const [levels, setLevels] = useState<BeatPadsFxMeterLevels>({
    inputL: 0,
    inputR: 0,
    mid: 0,
    outputL: 0,
    outputR: 0,
  });
  const activityRef = useRef(activity);
  activityRef.current = Math.max(0, Math.min(1, activity));

  useEffect(() => {
    if (!enabled) {
      setLevels({ inputL: 0, inputR: 0, mid: 0, outputL: 0, outputR: 0 });
      return;
    }
    let raf = 0;
    let t = 0;
    const tick = () => {
      t += 0.014;
      const a = Math.max(0.2, activityRef.current);
      const base = 0.1 + a * 0.52;
      const w1 = Math.sin(t * 7.2) * 0.1;
      const w2 = Math.sin(t * 12.3 + 0.7) * 0.07;
      const w3 = Math.sin(t * 4.1 + 1.2) * 0.05;
      const inputL = Math.min(1, Math.max(0.06, base + w1 + w3));
      const inputR = Math.min(1, Math.max(0.06, base + w2 - w1 * 0.35));
      const midWobble = Math.abs(Math.sin(t * 8.6 + 0.4)) * 0.18;
      const mid = Math.min(1, Math.max(0.1, base * 0.42 + midWobble + a * 0.28));
      const outBoost = 0.86 + a * 0.24;
      setLevels({
        inputL,
        inputR,
        mid,
        outputL: Math.min(1, inputL * outBoost),
        outputR: Math.min(1, inputR * outBoost),
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled]);

  return levels;
}

function BeatPadsFxMeterLane({
  label,
  level,
  accent,
  dim = false,
}: {
  label: string;
  level: number;
  accent: string;
  dim?: boolean;
}) {
  return (
    <div className="beat-pads-fx-suite-meter-lane">
      <span className="beat-pads-fx-suite-meter-label">{label}</span>
      <div
        className="beat-pads-fx-suite-meter-well"
        style={{ opacity: dim ? 0.45 : 1 }}
      >
        <div
          className="beat-pads-fx-suite-meter-fill"
          style={{
            height: `${Math.max(0, Math.min(100, level * 100))}%`,
            background: `linear-gradient(0deg, ${accent} 0%, ${accent}99 40%, ${accent}22 100%)`,
            boxShadow: level > 0.45 ? `0 0 10px ${accent}55` : 'none',
          }}
        />
      </div>
    </div>
  );
}

function BeatPadsFxReadoutStrip({
  cells,
}: {
  cells: { key: string; title: string; value: string; color?: string }[];
}) {
  return (
    <div
      className="beat-pads-fx-suite-readout"
      style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}
    >
      {cells.map((cell) => (
        <div key={cell.key} className="beat-pads-fx-suite-readout-cell">
          <span className="beat-pads-fx-suite-readout-title">{cell.title}</span>
          <span
            className="beat-pads-fx-suite-readout-value"
            style={{ color: cell.color ?? '#e8eaef' }}
          >
            {cell.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function BeatPadsFxVizChrome({
  accent,
  children,
}: {
  accent: string;
  children: ReactNode;
}) {
  return (
    <div
      className="beat-pads-fx-suite-viz-chrome"
      style={{ borderColor: `${accent}33`, boxShadow: `inset 0 0 24px ${accent}08` }}
    >
      {children}
    </div>
  );
}

/** SE2-style meter cluster + graph — fits Beat Pads insert bay height. */
export function BeatPadsFxSuiteMeterViz({
  accent,
  enabled,
  levels,
  midLabel,
  midAccent,
  graph,
  readouts,
}: {
  accent: string;
  enabled: boolean;
  levels: BeatPadsFxMeterLevels;
  midLabel: string;
  midAccent?: string;
  graph: ReactNode;
  readouts: { key: string; title: string; value: string; color?: string }[];
}) {
  const midCol = midAccent ?? accent;
  return (
    <BeatPadsFxVizChrome accent={accent}>
      <BeatPadsFxReadoutStrip cells={readouts} />
      <div className="beat-pads-fx-suite-viz-body">
        <div className="beat-pads-fx-suite-meter-cluster">
          <BeatPadsFxMeterLane label="IN L" level={levels.inputL} accent={accent} dim={!enabled} />
          <BeatPadsFxMeterLane label="IN R" level={levels.inputR} accent={accent} dim={!enabled} />
          <BeatPadsFxMeterLane
            label={midLabel}
            level={levels.mid}
            accent={midCol}
            dim={!enabled}
          />
          <BeatPadsFxMeterLane label="OUT L" level={levels.outputL} accent="#7cf4c6" dim={!enabled} />
          <BeatPadsFxMeterLane label="OUT R" level={levels.outputR} accent="#7cf4c6" dim={!enabled} />
        </div>
        <div className="beat-pads-fx-suite-graph">{graph}</div>
      </div>
    </BeatPadsFxVizChrome>
  );
}

export function BeatPadsFxDriveGraph({
  drive,
  accent,
  live = false,
}: {
  drive: number;
  accent: string;
  live?: boolean;
}) {
  const curve = useMemo(() => {
    const k = Math.max(0.01, drive * 8 + 0.5);
    let d = '';
    for (let i = 0; i <= 40; i++) {
      const t = (i / 40) * 2 - 1;
      const x = 4 + ((t + 1) / 2) * 92;
      const y = 44 - (Math.tanh(k * t) / Math.tanh(k)) * 34;
      d += i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    return d;
  }, [drive]);

  return (
    <svg viewBox="0 0 100 52" width="100%" height="100%" preserveAspectRatio="none" aria-hidden>
      <line x1="0" y1="44" x2="100" y2="44" stroke="rgba(255,255,255,0.06)" />
      <path d={curve} fill="none" stroke={accent} strokeWidth="1.4" opacity={0.9} />
      {live ? (
        <circle cx="62" cy="28" r="3" fill={accent} style={{ filter: `drop-shadow(0 0 4px ${accent})` }} />
      ) : null}
    </svg>
  );
}

export function BeatPadsFxCompGraph({
  thresholdDb,
  ratio,
  accent,
  live = false,
}: {
  thresholdDb: number;
  ratio: number;
  accent: string;
  live?: boolean;
}) {
  const curve = useMemo(() => {
    const compAmt = 1 - 1 / Math.max(1.01, ratio);
    let d = '';
    for (let inDb = -48; inDb <= 6; inDb += 2) {
      const x = 4 + ((inDb + 48) / 54) * 92;
      const outDb = inDb > thresholdDb ? thresholdDb + (inDb - thresholdDb) * (1 - compAmt) : inDb;
      const y = 48 - ((outDb + 48) / 54) * 40;
      d += d ? ` L ${x.toFixed(1)} ${y.toFixed(1)}` : `M ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    return d;
  }, [ratio, thresholdDb]);

  return (
    <svg viewBox="0 0 100 52" width="100%" height="100%" preserveAspectRatio="none" aria-hidden>
      <line x1="4" y1="48" x2="96" y2="4" stroke="rgba(255,255,255,0.1)" strokeDasharray="2 2" />
      <path d={curve} fill="none" stroke={accent} strokeWidth="1.4" opacity={0.92} />
      {live ? (
        <circle cx="70" cy="22" r="3" fill="#7cf4c6" style={{ filter: 'drop-shadow(0 0 4px #7cf4c6)' }} />
      ) : null}
    </svg>
  );
}

export function BeatPadsFxFilterGraph({
  hpHz,
  lpHz,
  accent,
  hpScaleHz = 4000,
  hpFloorHz = 20,
  lpScaleHz = 14000,
  lpMinActiveHz = 200,
}: {
  hpHz: number;
  lpHz: number;
  accent: string;
  /** Hz mapped to full HP cut on the graph (Beat Pads default 4000; 808 Lab uses 400). */
  hpScaleHz?: number;
  hpFloorHz?: number;
  /** Hz mapped to wide-open LP on the graph (Beat Pads default 14000; 808 Lab uses 16000). */
  lpScaleHz?: number;
  /** LP below this Hz draws as wide open (Beat Pads default 200). */
  lpMinActiveHz?: number;
}) {
  const path = useMemo(() => {
    const hp = hpHz > hpFloorHz ? Math.min(1, hpHz / hpScaleHz) : 0;
    const lp =
      lpHz <= 0 || lpHz >= lpScaleHz || lpHz < lpMinActiveHz
        ? 1
        : Math.max(0.12, lpHz / lpScaleHz);
    const yLo = 8 + (1 - lp) * 28;
    const yHi = 44 - hp * 22;
    return `M 0,${yHi.toFixed(1)} Q 30,${yHi.toFixed(1)} 45,${((yHi + yLo) / 2).toFixed(1)} T 100,${yLo.toFixed(1)}`;
  }, [hpFloorHz, hpHz, hpScaleHz, lpHz, lpMinActiveHz, lpScaleHz]);

  return (
    <svg viewBox="0 0 100 52" width="100%" height="100%" preserveAspectRatio="none" aria-hidden>
      <line x1="0" y1="44" x2="100" y2="44" stroke="rgba(255,255,255,0.06)" />
      <path d={path} fill="none" stroke={accent} strokeWidth="1.5" opacity={0.88} />
    </svg>
  );
}

/** 3-band EQ magnitude curve — mirrors LOW / MID / HI / MID Q knob settings. */
export function BeatPadsFxEqGraph({
  eq,
  accent,
  enabled = true,
}: {
  eq: Pick<
    PadSamplerEqFx,
    'lowGainDb' | 'midGainDb' | 'highGainDb' | 'lowFreqHz' | 'midFreqHz' | 'highFreqHz' | 'midQ'
  >;
  accent: string;
  enabled?: boolean;
}) {
  const gradId = useId().replace(/:/g, '');
  const { pathStroke, pathFill, zeroY } = useMemo(() => {
    const magDb = padWaveformEqMagDb({
      lowGainDb: eq.lowGainDb,
      midGainDb: eq.midGainDb,
      highGainDb: eq.highGainDb,
      lowFreqHz: eq.lowFreqHz,
      midFreqHz: eq.midFreqHz,
      highFreqHz: eq.highFreqHz,
      midQ: eq.midQ,
    });
    const zero = 44 - (12 / 24) * 36;
    let stroke = '';
    for (let i = 0; i < magDb.length; i++) {
      const t = i / (magDb.length - 1 || 1);
      const x = 4 + t * 92;
      const db = magDb[i] ?? 0;
      const y = 44 - ((db + 12) / 24) * 36;
      stroke += i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    const fill = `${stroke} L 96 ${zero.toFixed(1)} L 4 ${zero.toFixed(1)} Z`;
    return { pathStroke: stroke, pathFill: fill, zeroY: zero };
  }, [eq]);

  const live =
    enabled &&
    (Math.abs(eq.lowGainDb) > 0.25 ||
      Math.abs(eq.midGainDb) > 0.25 ||
      Math.abs(eq.highGainDb) > 0.25 ||
      Math.abs(eq.midQ - 1) > 0.05);

  return (
    <svg
      viewBox="0 0 100 52"
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      role="img"
      aria-label="EQ frequency response"
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={accent} stopOpacity={0.22} />
          <stop offset="100%" stopColor={accent} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <line x1="4" y1={zeroY} x2="96" y2={zeroY} stroke="rgba(124,244,198,0.22)" strokeDasharray="2 3" />
      <path d={pathFill} fill={`url(#${gradId})`} opacity={enabled ? 0.85 : 0.3} />
      <path
        d={pathStroke}
        fill="none"
        stroke={accent}
        strokeWidth="1.5"
        opacity={enabled ? (live ? 0.95 : 0.55) : 0.28}
      />
    </svg>
  );
}

/** Left viz screen + right 2×2 dark gold-tick knobs — fits beside meter bay. */
export function BeatPadsFxSuiteInsertShell({
  viz,
  knobs,
}: {
  viz: ReactNode;
  knobs: ReactNode;
}) {
  return (
    <div className="beat-pads-fx-suite-insert" data-studio-fx-suite>
      <div className="beat-pads-fx-suite-viz-slot">{viz}</div>
      <div className="beat-pads-fx-suite-knob-grid">{knobs}</div>
    </div>
  );
}

function snapKnobValue(v: number, min: number, max: number, step: number) {
  const clamped = Math.max(min, Math.min(max, v));
  if (step <= 0) return clamped;
  const snapped = Math.round(clamped / step) * step;
  return Math.max(min, Math.min(max, Number(snapped.toPrecision(10))));
}

/** Compact dark rotary knob with gold tick marks — insert bay only. */
export function BeatPadsFxSuiteKnob({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  disabled = false,
  dialSize = BEAT_PADS_FX_KNOB_SIZE,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  disabled?: boolean;
  /** SVG dial diameter in px (default 32). */
  dialSize?: number;
}) {
  const gradId = useId().replace(/:/g, '');
  const startRef = useRef<{ val: number; y: number; x: number } | null>(null);
  const size = dialSize;
  const t = Math.max(0, Math.min(1, (value - min) / (max - min || 1)));
  const deg = BEAT_PADS_FX_KNOB_START + t * BEAT_PADS_FX_KNOB_SWEEP;
  const rad = (deg * Math.PI) / 180;
  const cx = size / 2;
  const cy = size / 2;
  const rNeedle = size * 0.24;
  const rTrack = size * 0.34;
  const arcLen = t * Math.PI * 2 * rTrack * 0.75;
  const tickCount = 13;

  const tickMarks = useMemo(() => {
    const marks: ReactNode[] = [];
    for (let i = 0; i < tickCount; i++) {
      const tickT = i / (tickCount - 1);
      const tickDeg = BEAT_PADS_FX_KNOB_START + tickT * BEAT_PADS_FX_KNOB_SWEEP;
      const tickRad = (tickDeg * Math.PI) / 180;
      const major = i === 0 || i === tickCount - 1 || i === Math.floor(tickCount / 2);
      const rOuter = size * 0.47;
      const rInner = size * (major ? 0.38 : 0.4);
      const lit = tickT <= t + 0.02;
      marks.push(
        <line
          key={i}
          x1={cx + rInner * Math.cos(tickRad)}
          y1={cy + rInner * Math.sin(tickRad)}
          x2={cx + rOuter * Math.cos(tickRad)}
          y2={cy + rOuter * Math.sin(tickRad)}
          stroke={lit ? BEAT_PADS_FX_KNOB_ACCENT : 'rgba(255,255,255,0.16)'}
          strokeWidth={major ? 1.1 : 0.75}
          strokeLinecap="round"
          opacity={lit ? 0.95 : 0.7}
        />,
      );
    }
    return marks;
  }, [cx, cy, size, t]);

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
      const dx = (startRef.current.x - e.clientX) * 0.12;
      const range = max - min || 1;
      const sensitivity = range / 120;
      const raw = startRef.current.val + (dy + dx) * sensitivity;
      const next = snapKnobValue(raw, min, max, step);
      onChange(next);
      startRef.current = { ...startRef.current, y: e.clientY, x: e.clientX, val: next };
    },
    [disabled, max, min, onChange, step],
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
    <div
      className="beat-pads-fx-suite-knob"
      role="presentation"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onLostPointerCapture={() => {
        startRef.current = null;
      }}
      style={{
        opacity: disabled ? 0.42 : 1,
        cursor: disabled ? 'default' : 'ns-resize',
        minWidth: size + 10,
      }}
      title={`${label}: ${display} — drag up/down`}
    >
      <svg width={size} height={size} aria-hidden className="beat-pads-fx-suite-knob-dial">
        <defs>
          <radialGradient id={gradId} cx="38%" cy="32%" r="72%">
            <stop offset="0%" stopColor="#2a3140" />
            <stop offset="55%" stopColor="#141820" />
            <stop offset="100%" stopColor="#080a10" />
          </radialGradient>
        </defs>
        <circle
          cx={cx}
          cy={cy}
          r={size * 0.44}
          fill={`url(#${gradId})`}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={1}
        />
        {tickMarks}
        <circle
          cx={cx}
          cy={cy}
          r={rTrack}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={2.4}
        />
        <circle
          cx={cx}
          cy={cy}
          r={rTrack}
          fill="none"
          stroke={BEAT_PADS_FX_KNOB_ACCENT}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeDasharray={`${arcLen} 999`}
          transform={`rotate(${BEAT_PADS_FX_KNOB_START} ${cx} ${cy})`}
          opacity={0.92}
          style={{ filter: `drop-shadow(0 0 3px ${BEAT_PADS_FX_KNOB_ACCENT}66)` }}
        />
        <circle
          cx={cx}
          cy={cy}
          r={size * 0.11}
          fill="#0a0c12"
          stroke="rgba(232, 185, 35, 0.35)"
          strokeWidth={0.9}
        />
        <line
          x1={cx}
          y1={cy}
          x2={cx + rNeedle * Math.cos(rad)}
          y2={cy + rNeedle * Math.sin(rad)}
          stroke={BEAT_PADS_FX_KNOB_ACCENT}
          strokeWidth={2.2}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 2px ${BEAT_PADS_FX_KNOB_ACCENT})` }}
        />
      </svg>
      <span className="beat-pads-fx-suite-knob-label">{label}</span>
      <span className="beat-pads-fx-suite-knob-value">{display}</span>
    </div>
  );
}

export function BeatPadsFxSuiteFader({
  faderHeight = BEAT_PADS_FX_FADER_H,
  ...props
}: Omit<React.ComponentProps<typeof SuiteFader>, 'faderHeight' | 'suiteTypography'> & {
  faderHeight?: number;
}) {
  return <SuiteFader {...props} faderHeight={faderHeight} suiteTypography />;
}
