/**
 * Visual controls for Beat Lab per-pad EFX rack: graphic EQ curve + vertical faders.
 */

import { useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import {
  GrooveStyleTCapParamHorizontalFader,
  GrooveStyleTCapParamVerticalFader,
  GrooveStyleTCapVolumeFaderStyles,
} from '@/app/components/creation/GrooveStyleTCapVolumeFader';

import type {
  PadSamplerCompressorFx,
  PadSamplerEqFx,
} from '@/app/lib/creationStation/padSamplerFxRack';

/** Inject once near pad EDIT/EFX popovers. */
export function PadSamplerFxTCapStyles() {
  return <GrooveStyleTCapVolumeFaderStyles />;
}

type VerticalFaderProps = {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
  accent: string;
  disabled?: boolean;
  /** Default 112 — FX Suite uses ~72 for tighter layout */
  faderHeight?: number;
  /** Mikron-style Rajdhani lettering (FX Suite panel). */
  suiteTypography?: boolean;
};

export function PadFxVerticalFader({
  label,
  min,
  max,
  step,
  value,
  onChange,
  format,
  accent,
  disabled,
  faderHeight = 112,
  suiteTypography = false,
}: VerticalFaderProps) {
  const compact = faderHeight < 100;
  /** FX Suite rows pack many faders — drop negative margins so lanes don't overlap. */
  const isolatedLane = compact || suiteTypography;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: compact ? 2 : 4,
        opacity: disabled ? 0.45 : 1,
        touchAction: 'none',
        ...(isolatedLane
          ? { minWidth: 50, paddingLeft: 6, paddingRight: 6, flexShrink: 0 }
          : null),
      }}
    >
      <span
        className={suiteTypography ? 'suite-type-value' : undefined}
        style={{
          fontSize: compact ? 9 : 11,
          fontWeight: suiteTypography ? 600 : 800,
          color: suiteTypography ? '#c8d4dc' : '#ddd6fe',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {format(value)}
      </span>
      <GrooveStyleTCapParamVerticalFader
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        accent={accent}
        ariaLabel={label}
        height={faderHeight}
        disabled={disabled}
        style={
          isolatedLane
            ? { marginLeft: 0, marginRight: 0, paddingLeft: 6, paddingRight: 6 }
            : undefined
        }
      />
      <span
        className={suiteTypography ? 'suite-type-label' : undefined}
        style={{
          fontSize: compact ? 8 : 10,
          color: suiteTypography ? '#8a96a8' : '#c4b5fd',
          fontWeight: suiteTypography ? 500 : 900,
          letterSpacing: suiteTypography ? '0.16em' : 0.35,
          textAlign: 'center',
          maxWidth: 52,
          lineHeight: 1.1,
        }}
      >
        {label}
      </span>
    </div>
  );
}

type HorizontalSliderProps = {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  accent: string;
  ariaLabel?: string;
  disabled?: boolean;
  style?: CSSProperties;
};

export function PadFxHorizontalTCapSlider({
  min,
  max,
  step,
  value,
  onChange,
  accent,
  ariaLabel,
  disabled,
  style,
}: HorizontalSliderProps) {
  return (
    <GrooveStyleTCapParamHorizontalFader
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={onChange}
      accent={accent}
      ariaLabel={ariaLabel}
      disabled={disabled}
      style={{ margin: '6px 0', ...style }}
    />
  );
}

/** Log-spaced Hz points for plotting. */
const FREQ_MAG_LEN = 100;

function buildLogFreqs(n: number): Float32Array {
  const out = new Float32Array(n);
  const f0 = 20;
  const f1 = 20000;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1 || 1);
    out[i] = f0 * Math.pow(f1 / f0, t);
  }
  return out;
}

export const EQ_GRAPH_W = 220;
export const EQ_GRAPH_H = 96;
const EQ_PAD_L = 10;
const EQ_PAD_R = 8;
const EQ_PAD_T = 10;
const EQ_PAD_B = 16;
const EQ_DB_MIN = -12;
const EQ_DB_MAX = 12;
const EQ_NYQUIST_HZ = 20000;

export function eqGraphHzToX(hz: number, w = EQ_GRAPH_W): number {
  const innerW = w - EQ_PAD_L - EQ_PAD_R;
  return EQ_PAD_L + (Math.log(Math.max(20, hz) / 20) / Math.log(EQ_NYQUIST_HZ / 20)) * innerW;
}

export function eqGraphXToHz(x: number, w = EQ_GRAPH_W): number {
  const innerW = w - EQ_PAD_L - EQ_PAD_R;
  const t = Math.max(0, Math.min(1, (x - EQ_PAD_L) / Math.max(1, innerW)));
  return 20 * Math.pow(EQ_NYQUIST_HZ / 20, t);
}

export function eqGraphDbToY(db: number, h = EQ_GRAPH_H): number {
  const innerH = h - EQ_PAD_T - EQ_PAD_B;
  return EQ_PAD_T + ((EQ_DB_MAX - Math.max(EQ_DB_MIN, Math.min(EQ_DB_MAX, db))) / (EQ_DB_MAX - EQ_DB_MIN)) * innerH;
}

export function eqGraphYToDb(y: number, h = EQ_GRAPH_H): number {
  const innerH = h - EQ_PAD_T - EQ_PAD_B;
  const t = Math.max(0, Math.min(1, (y - EQ_PAD_T) / Math.max(1, innerH)));
  return EQ_DB_MAX - t * (EQ_DB_MAX - EQ_DB_MIN);
}

function magDbAtHz(freqs: Float32Array, mags: Float32Array, hz: number): number {
  if (freqs.length === 0) return 0;
  const target = Math.max(freqs[0]!, Math.min(freqs[freqs.length - 1]!, hz));
  let i = 0;
  while (i < freqs.length - 1 && freqs[i + 1]! < target) i++;
  const f0 = freqs[i]!;
  const f1 = freqs[Math.min(i + 1, freqs.length - 1)]!;
  if (f1 <= f0) return mags[i] ?? 0;
  const u = (Math.log(target) - Math.log(f0)) / (Math.log(f1) - Math.log(f0));
  return (mags[i] ?? 0) * (1 - u) + (mags[Math.min(i + 1, mags.length - 1)] ?? 0) * u;
}

function computeCombinedEqMagDb(
  freqs: Float32Array,
  eq: Pick<
    PadSamplerEqFx,
    'lowGainDb' | 'midGainDb' | 'highGainDb' | 'lowFreqHz' | 'midFreqHz' | 'highFreqHz' | 'midQ'
  >,
): Float32Array {
  const { lowGainDb, midGainDb, highGainDb, lowFreqHz, midFreqHz, highFreqHz, midQ } = eq;
  if (typeof window === 'undefined') {
    return Float32Array.from({ length: freqs.length }, () => 0);
  }

  try {
    const ac = new AudioContext({ sampleRate: 48000 });
    const l = ac.createBiquadFilter();
    l.type = 'lowshelf';
    l.frequency.value = lowFreqHz;
    l.gain.value = lowGainDb;

    const m = ac.createBiquadFilter();
    m.type = 'peaking';
    m.frequency.value = midFreqHz;
    m.Q.value = midQ;
    m.gain.value = midGainDb;

    const h = ac.createBiquadFilter();
    h.type = 'highshelf';
    h.frequency.value = highFreqHz;
    h.gain.value = highGainDb;

    const ml = new Float32Array(freqs.length);
    const mm = new Float32Array(freqs.length);
    const mh = new Float32Array(freqs.length);
    const phase = new Float32Array(freqs.length);
    l.getFrequencyResponse(freqs, ml, phase);
    m.getFrequencyResponse(freqs, mm, phase);
    h.getFrequencyResponse(freqs, mh, phase);

    const out = new Float32Array(freqs.length);
    for (let i = 0; i < freqs.length; i++) {
      const lin = ml[i]! * mm[i]! * mh[i]!;
      out[i] = 20 * Math.log10(Math.max(1e-8, lin));
    }
    void ac.close().catch(() => {});
    return out;
  } catch {
    return Float32Array.from({ length: freqs.length }, () => 0);
  }
}

type EqBandId = 'low' | 'mid' | 'high';

function clampEqBands(eq: PadSamplerEqFx): PadSamplerEqFx {
  let lowFreqHz = Math.max(40, Math.min(700, eq.lowFreqHz));
  let midFreqHz = Math.max(150, Math.min(12000, eq.midFreqHz));
  let highFreqHz = Math.max(1800, Math.min(16000, eq.highFreqHz));
  if (midFreqHz < lowFreqHz + 60) midFreqHz = lowFreqHz + 60;
  if (highFreqHz < midFreqHz + 120) highFreqHz = midFreqHz + 120;
  return {
    ...eq,
    lowFreqHz,
    midFreqHz,
    highFreqHz,
    lowGainDb: Math.max(-12, Math.min(12, eq.lowGainDb)),
    midGainDb: Math.max(-12, Math.min(12, eq.midGainDb)),
    highGainDb: Math.max(-12, Math.min(12, eq.highGainDb)),
    midQ: Math.max(0.35, Math.min(12, eq.midQ)),
  };
}

function clientToSvg(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const p = pt.matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}

/**
 * Graphic EQ with draggable dots on the response curve (up/down = gain, left/right = frequency).
 * Shift + drag the mid dot horizontally to change bandwidth (Q).
 */
export function PadFxInteractiveGraphicEq({
  eq,
  onEqChange,
}: {
  eq: PadSamplerEqFx;
  onEqChange: (next: Partial<PadSamplerEqFx>) => void;
}) {
  const gradId = useId().replace(/:/g, '');
  const svgRef = useRef<SVGSVGElement | null>(null);
  const freqsRef = useRef<Float32Array | null>(null);
  if (!freqsRef.current) freqsRef.current = buildLogFreqs(FREQ_MAG_LEN);

  const dragRef = useRef<{ band: EqBandId; shiftQ: boolean } | null>(null);
  const [dragging, setDragging] = useState<EqBandId | null>(null);
  /** While dragging, dot follows pointer so it stays on the finger (curve catches up). */
  const [dragDotPos, setDragDotPos] = useState<{ x: number; y: number } | null>(null);

  const [magDb, setMagDb] = useState<Float32Array>(() =>
    Float32Array.from({ length: FREQ_MAG_LEN }, () => 0),
  );

  useLayoutEffect(() => {
    const freqs = freqsRef.current;
    if (!freqs) return;
    setMagDb(computeCombinedEqMagDb(freqs, eq));
  }, [eq]);

  const { pathStroke, pathFill } = useMemo(() => {
    const w = EQ_GRAPH_W;
    const h = EQ_GRAPH_H;
    const freqs = freqsRef.current;
    let d = '';
    if (freqs && freqs.length >= 2) {
      const x0 = eqGraphHzToX(freqs[0]!, w);
      const y0 = eqGraphDbToY(magDb[0] ?? 0, h);
      d = `M ${x0.toFixed(1)} ${y0.toFixed(1)}`;
      for (let i = 1; i < freqs.length; i++) {
        d += ` L ${eqGraphHzToX(freqs[i]!, w).toFixed(1)} ${eqGraphDbToY(magDb[i] ?? 0, h).toFixed(1)}`;
      }
    }
    const y0 = eqGraphDbToY(0, h);
    const firstX = freqs?.length ? eqGraphHzToX(freqs[0]!, w).toFixed(1) : String(EQ_PAD_L);
    const lastX = freqs?.length
      ? eqGraphHzToX(freqs[freqs.length - 1]!, w).toFixed(1)
      : String(w - EQ_PAD_R);
    return { pathStroke: d, pathFill: `${d} L ${lastX} ${y0.toFixed(1)} L ${firstX} ${y0.toFixed(1)} Z` };
  }, [magDb]);

  const freqs = freqsRef.current;
  const dotOnCurve = (hz: number, fallbackDb: number) => {
    const db = freqs ? magDbAtHz(freqs, magDb, hz) : fallbackDb;
    return { x: eqGraphHzToX(hz), y: eqGraphDbToY(db) };
  };

  const dots: { id: EqBandId; hz: number; gainDb: number; fill: string; stroke: string; label: string }[] = [
    {
      id: 'low',
      hz: eq.lowFreqHz,
      gainDb: eq.lowGainDb,
      fill: '#6366f1',
      stroke: '#a5b4fc',
      label: 'LOW',
    },
    {
      id: 'mid',
      hz: eq.midFreqHz,
      gainDb: eq.midGainDb,
      fill: '#a78bfa',
      stroke: '#e9d5ff',
      label: 'MID',
    },
    {
      id: 'high',
      hz: eq.highFreqHz,
      gainDb: eq.highGainDb,
      fill: '#34d399',
      stroke: '#7cf4c6',
      label: 'HIGH',
    },
  ];

  const applyPointer = (band: EqBandId, clientX: number, clientY: number, shiftQ: boolean) => {
    const svg = svgRef.current;
    if (!svg) return;
    const { x, y } = clientToSvg(svg, clientX, clientY);

    if (band === 'mid' && shiftQ) {
      const innerW = EQ_GRAPH_W - EQ_PAD_L - EQ_PAD_R;
      const midX = eqGraphHzToX(eq.midFreqHz);
      const dx = (x - midX) / Math.max(1, innerW);
      const nextQ = Math.max(0.35, Math.min(12, eq.midQ - dx * 18));
      onEqChange({ midQ: Math.round(nextQ * 20) / 20 });
      return;
    }

    const hz = eqGraphXToHz(x);
    const gainDb = Math.round(eqGraphYToDb(y) * 2) / 2;

    if (band === 'low') {
      onEqChange(
        clampEqBands({
          ...eq,
          lowFreqHz: hz,
          lowGainDb: gainDb,
        }),
      );
    } else if (band === 'mid') {
      onEqChange(
        clampEqBands({
          ...eq,
          midFreqHz: hz,
          midGainDb: gainDb,
        }),
      );
    } else {
      onEqChange(
        clampEqBands({
          ...eq,
          highFreqHz: hz,
          highGainDb: gainDb,
        }),
      );
    }
  };

  const w = EQ_GRAPH_W;
  const h = EQ_GRAPH_H;
  const zeroY = eqGraphDbToY(0, h);

  return (
    <div style={{ touchAction: 'none', userSelect: 'none' }}>
      <svg
        ref={svgRef}
        width="100%"
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block', maxWidth: '100%', cursor: 'default' }}
        role="img"
        aria-label="Graphic EQ — drag dots on the curve"
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#818cf8" stopOpacity={0.12} />
            <stop offset="50%" stopColor="#c4b5fd" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#7cf4c6" stopOpacity={0.12} />
          </linearGradient>
        </defs>
        <rect
          x={0}
          y={0}
          width={w}
          height={h}
          fill="rgba(8,10,14,0.96)"
          rx={5}
          stroke="rgba(129,140,248,0.35)"
          strokeWidth={1}
        />
        {[0.25, 0.5, 0.75].map((t) => {
          const y = EQ_PAD_T + t * (h - EQ_PAD_T - EQ_PAD_B);
          return (
            <line
              key={t}
              x1={EQ_PAD_L}
              y1={y}
              x2={w - EQ_PAD_R}
              y2={y}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={1}
            />
          );
        })}
        <line
          x1={EQ_PAD_L}
          y1={zeroY}
          x2={w - EQ_PAD_R}
          y2={zeroY}
          stroke="rgba(124,244,198,0.28)"
          strokeWidth={1}
          strokeDasharray="3 5"
        />
        <path d={pathFill} fill={`url(#${gradId})`} opacity={0.85} />
        <path
          d={pathStroke}
          fill="none"
          stroke="#c4b5fd"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {dots.map((d) => {
          const onLine = dotOnCurve(d.hz, d.gainDb);
          const active = dragging === d.id;
          const pos = active && dragDotPos ? dragDotPos : onLine;
          return (
            <g key={d.id}>
              <line
                x1={pos.x}
                y1={zeroY}
                x2={pos.x}
                y2={pos.y}
                stroke={d.stroke}
                strokeWidth={1}
                strokeOpacity={0.35}
                pointerEvents="none"
              />
              <circle
                cx={pos.x}
                cy={pos.y}
                r={active ? 7.5 : 6}
                fill={d.fill}
                stroke={active ? '#fff' : d.stroke}
                strokeWidth={active ? 2 : 1.5}
                style={{ cursor: active ? 'grabbing' : 'grab', touchAction: 'none' }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const svg = svgRef.current;
                  if (svg) {
                    const p = clientToSvg(svg, e.clientX, e.clientY);
                    setDragDotPos(p);
                  }
                  dragRef.current = { band: d.id, shiftQ: e.shiftKey };
                  setDragging(d.id);
                  e.currentTarget.setPointerCapture(e.pointerId);
                  applyPointer(d.id, e.clientX, e.clientY, e.shiftKey);
                }}
                onPointerMove={(e) => {
                  if (dragRef.current?.band !== d.id) return;
                  const svg = svgRef.current;
                  if (svg && !e.shiftKey) {
                    setDragDotPos(clientToSvg(svg, e.clientX, e.clientY));
                  }
                  applyPointer(d.id, e.clientX, e.clientY, e.shiftKey);
                }}
                onPointerUp={(e) => {
                  dragRef.current = null;
                  setDragging(null);
                  setDragDotPos(null);
                  try {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  } catch {
                    /* */
                  }
                }}
              />
            </g>
          );
        })}
        <text
          x={12}
          y={h - 4}
          fill="#e8eef8"
          fontSize={11}
          fontWeight={900}
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}
        >
          20Hz
        </text>
        <text
          x={w / 2}
          y={h - 4}
          textAnchor="middle"
          fill="#e8eef8"
          fontSize={11}
          fontWeight={900}
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}
        >
          1K
        </text>
        <text
          x={w - 12}
          y={h - 4}
          textAnchor="end"
          fill="#e8eef8"
          fontSize={11}
          fontWeight={900}
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}
        >
          20K
        </text>
        <text x={12} y={14} fill="#c4b5fd" fontSize={10} fontWeight={900}>
          +12dB
        </text>
        <text x={12} y={zeroY + 1} fill="#7cf4c6" fontSize={10} fontWeight={900} opacity={0.95}>
          0dB
        </text>
      </svg>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 6,
          marginTop: 5,
          fontSize: 9,
          color: '#b8c4d8',
          fontWeight: 700,
          lineHeight: 1.35,
        }}
      >
        <span>Drag dot: ↔ freq · ↕ gain</span>
        <span title="Shift + drag MID dot left/right">MID width: Q {eq.midQ.toFixed(1)}</span>
      </div>
    </div>
  );
}

/** EQ + Compressor panels for the pad EFX popover. */
export function PadSamplerEqCompControls({
  eq,
  onEqChange,
  comp,
  onCompChange,
}: {
  eq: PadSamplerEqFx;
  onEqChange: (next: Partial<PadSamplerEqFx>) => void;
  comp: PadSamplerCompressorFx;
  onCompChange: (next: Partial<PadSamplerCompressorFx>) => void;
}) {
  const compBank = comp.enabled ? (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'flex-start',
        gap: 10,
        flexWrap: 'wrap',
        paddingTop: 4,
      }}
    >
      <PadFxVerticalFader
        label="THR"
        min={-48}
        max={0}
        step={1}
        value={comp.thresholdDb}
        onChange={(thresholdDb) => onCompChange({ thresholdDb })}
        format={(v) => `${Math.round(v)} dB`}
        accent="#cbd5f5"
      />
      <PadFxVerticalFader
        label="RATIO"
        min={1}
        max={20}
        step={1}
        value={comp.ratio}
        onChange={(ratio) => onCompChange({ ratio })}
        format={(v) => `1:${Math.round(v)}`}
        accent="#94a3b8"
      />
      <PadFxVerticalFader
        label="KNEE"
        min={0}
        max={32}
        step={1}
        value={Math.min(comp.kneeDb, 32)}
        onChange={(kneeDb) => onCompChange({ kneeDb })}
        format={(v) => `${Math.round(v)}`}
        accent="#64748b"
      />
      <PadFxVerticalFader
        label="ATK"
        min={0.0005}
        max={0.25}
        step={0.0005}
        value={Math.min(comp.attackSec, 0.25)}
        onChange={(attackSec) => onCompChange({ attackSec })}
        format={(v) => `${Math.round(v * 1000)} ms`}
        accent="#a78bfa"
      />
      <PadFxVerticalFader
        label="REL"
        min={0.02}
        max={1.2}
        step={0.01}
        value={Math.min(comp.releaseSec, 1.2)}
        onChange={(releaseSec) => onCompChange({ releaseSec })}
        format={(v) => (v < 0.2 ? `${Math.round(v * 1000)} ms` : `${v.toFixed(2)} s`)}
        accent="#a78bfa"
      />
      <PadFxVerticalFader
        label="MKUP"
        min={0}
        max={18}
        step={0.5}
        value={comp.makeupDb}
        onChange={(makeupDb) => onCompChange({ makeupDb })}
        format={(v) => `+${v.toFixed(1)}`}
        accent="#7cf4c6"
      />
    </div>
  ) : null;

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 10, color: '#c7d2fe', fontWeight: 900, letterSpacing: 0.65, marginBottom: 8 }}>GRAPHIC EQ</div>
      <button
        type="button"
        onClick={() => onEqChange({ enabled: !eq.enabled })}
        style={{
          fontSize: 10,
          fontWeight: 800,
          padding: '4px 10px',
          borderRadius: 4,
          marginBottom: 8,
          border: `1px solid ${eq.enabled ? 'rgba(129, 140, 248, 0.55)' : '#444'}`,
          background: eq.enabled ? 'rgba(129, 140, 248, 0.16)' : '#101014',
          color: eq.enabled ? '#e0e7ff' : '#b8bfd0',
          cursor: 'pointer',
        }}
      >
        {eq.enabled ? 'EQ ON' : 'EQ OFF'}
      </button>
      {eq.enabled ? (
        <>
          <div
            style={{
              borderRadius: 6,
              overflow: 'hidden',
              border: '1px solid rgba(129, 140, 248, 0.25)',
              marginBottom: 8,
            }}
          >
            <PadFxInteractiveGraphicEq eq={eq} onEqChange={onEqChange} />
          </div>
        </>
      ) : null}

      <div style={{ fontSize: 10, color: '#c7d2fe', fontWeight: 900, letterSpacing: 0.65, marginTop: 12, marginBottom: 8 }}>
        COMPRESSOR
      </div>
      <button
        type="button"
        onClick={() => onCompChange({ enabled: !comp.enabled })}
        style={{
          fontSize: 10,
          fontWeight: 800,
          padding: '4px 10px',
          borderRadius: 4,
          marginBottom: 8,
          border: `1px solid ${comp.enabled ? 'rgba(124, 244, 198, 0.45)' : '#444'}`,
          background: comp.enabled ? 'rgba(124, 244, 198, 0.1)' : '#101014',
          color: comp.enabled ? '#a7f3d0' : '#b8bfd0',
          cursor: 'pointer',
        }}
      >
        {comp.enabled ? 'COMP ON' : 'COMP OFF'}
      </button>
      {compBank}
    </div>
  );
}
