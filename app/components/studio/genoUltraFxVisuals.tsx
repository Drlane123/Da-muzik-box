'use client';

import {
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useEffect,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from 'react';
import type { GenoUltraFxParams } from '@/app/lib/studio/genoUltraSynthTypes';
import { readGenoUltraStripMeterStereo } from '@/app/lib/studio/genoUltraSynthMeterBus';
import {
  clampGenoUltraEqBandHz,
  computeGenoUltraEqMagDb,
  computeGenoUltraEqSingleBandMagDb,
  formatGenoUltraEqHz,
  GENO_ULTRA_EQ_BANDS,
  GENO_ULTRA_EQ_DB_MAX,
  GENO_ULTRA_EQ_DB_MIN,
  GENO_ULTRA_EQ_GRAPH_H,
  GENO_ULTRA_EQ_GRAPH_W,
  GENO_ULTRA_EQ_PAD_L,
  GENO_ULTRA_EQ_PAD_R,
  GENO_ULTRA_EQ_PAD_B,
  genoUltraEqBandDotY,
  genoUltraEqBandFillPath,
  genoUltraEqCurvePath,
  genoUltraEqDbToY,
  genoUltraEqGridDbLines,
  genoUltraEqGridFreqLines,
  genoUltraEqHzToX,
  genoUltraEqXToHz,
  genoUltraEqYToDb,
  getGenoUltraEqBandHz,
  type GenoUltraEqBandId,
} from '@/app/lib/studio/genoUltraEqGraph';

/** Modern FX display palette — teal / violet glass (ANA skin compatible). */
export const FX_VIS = {
  bg: 'linear-gradient(145deg, #0c1018 0%, #080a0f 42%, #06080c 100%)',
  mesh: 'radial-gradient(ellipse 120% 80% at 18% 0%, rgba(110,231,222,0.09) 0%, transparent 55%), radial-gradient(ellipse 90% 70% at 88% 100%, rgba(167,139,250,0.08) 0%, transparent 50%)',
  border: 'rgba(148,163,184,0.14)',
  borderHi: 'rgba(110,231,222,0.35)',
  grid: 'rgba(100,116,139,0.22)',
  gridMajor: 'rgba(148,163,184,0.38)',
  zeroLine: 'rgba(226,232,240,0.28)',
  curveTeal: '#5eead4',
  curveViolet: '#a78bfa',
  curveGlow: 'rgba(94,234,212,0.55)',
  fillTeal: 'rgba(45,212,191,0.18)',
  fillViolet: 'rgba(139,92,246,0.12)',
  handleRing: 'rgba(167,139,250,0.9)',
  handleCore: '#f8fafc',
  label: '#94a3b8',
  labelHi: '#e2e8f0',
  accentDelay: '#38bdf8',
  accentReverb: '#818cf8',
  accentTape: '#f472b6',
} as const;

/** Pro-Q style band colors (reference screenshot). */
const PRO_EQ_BAND: Record<
  GenoUltraEqBandId,
  { color: string; fill: string; stroke: string }
> = {
  low: { color: '#fb923c', fill: 'rgba(251,146,60,0.38)', stroke: '#fdba74' },
  loMid: { color: '#facc15', fill: 'rgba(250,204,21,0.34)', stroke: '#fde047' },
  hiMid: { color: '#4ade80', fill: 'rgba(74,222,128,0.32)', stroke: '#86efac' },
  high: { color: '#c084fc', fill: 'rgba(192,132,252,0.36)', stroke: '#d8b4fe' },
};

const PRO_EQ_BG = '#0a1628';
const PRO_EQ_GRID = 'rgba(96,165,250,0.14)';
const PRO_EQ_GRID_MAJOR = 'rgba(147,197,253,0.28)';
const PRO_EQ_ZERO = 'rgba(226,232,240,0.45)';

const proFxPanelShell: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  borderRadius: 8,
  border: '1px solid rgba(59,130,246,0.18)',
  background: PRO_EQ_BG,
  overflow: 'hidden',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 12px 40px rgba(0,0,0,0.45)',
};

const DELAY_GRAPH_W = 400;
const DELAY_GRAPH_H = 152;
const DELAY_PAD_L = 36;
const DELAY_PAD_R = 36;

const PRO_DELAY_L = { color: '#38bdf8', fill: 'rgba(56,189,248,0.45)', stroke: '#7dd3fc' };
const PRO_DELAY_R = { color: '#2dd4bf', fill: 'rgba(45,212,191,0.4)', stroke: '#5eead4' };
const PRO_DELAY_DRY = { color: '#f8fafc', fill: 'rgba(248,250,252,0.55)', stroke: '#e2e8f0' };

type DelayLane = 'L' | 'R' | 'fb' | 'mix';

type DelayTap = { tMs: number; ampL: number; ampR: number; gen: number };

function msToDelayX(ms: number, maxMs: number): number {
  const inner = DELAY_GRAPH_W - DELAY_PAD_L - DELAY_PAD_R;
  return DELAY_PAD_L + (Math.max(0, ms) / Math.max(1, maxMs)) * inner;
}

function buildDelayTapModel(
  timeL: number,
  timeR: number,
  feedback: number,
  mix: number,
  pingPong: boolean,
  maxMs: number,
): DelayTap[] {
  const taps: DelayTap[] = [{ tMs: 0, ampL: mix, ampR: mix, gen: 0 }];
  let amp = mix;
  let t = 0;
  const step = pingPong ? undefined : timeL;
  for (let g = 1; g <= 14; g += 1) {
    if (pingPong) {
      t += g % 2 === 1 ? timeR : timeL;
    } else {
      t += step ?? timeL;
    }
    if (t > maxMs) break;
    amp *= feedback;
    const pan = pingPong ? (g % 2 === 1 ? 'R' : 'L') : 'both';
    taps.push({
      tMs: t,
      ampL: pan === 'R' ? amp * 0.18 : amp,
      ampR: pan === 'L' ? amp * 0.18 : amp,
      gen: g,
    });
  }
  return taps;
}

function DelayModeIcon({
  label,
  color,
  active,
  children,
}: {
  label: string;
  color: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        opacity: active ? 1 : 0.65,
        transform: active ? 'scale(1.05)' : 'scale(1)',
        transition: 'transform 100ms, opacity 100ms',
      }}
    >
      <svg width={26} height={22} viewBox="0 0 26 22" aria-hidden>
        <rect
          x={1}
          y={1}
          width={24}
          height={20}
          rx={3}
          fill={active ? `${color}22` : 'rgba(15,23,42,0.6)'}
          stroke={active ? color : 'rgba(148,163,184,0.25)'}
          strokeWidth={active ? 1.4 : 0.8}
        />
        {children}
      </svg>
      <span style={{ fontSize: 5.5, fontWeight: 800, color: active ? '#e2e8f0' : 'rgba(148,163,184,0.7)', letterSpacing: '0.06em' }}>
        {label}
      </span>
    </div>
  );
}

function EqFilterIcon({ kind, color, active }: { kind: BiquadFilterType; color: string; active: boolean }) {
  const shelfLo = 'M4,18 L10,18 L14,8 L20,8';
  const bell = 'M4,14 Q12,4 20,14';
  const shelfHi = 'M4,8 L14,8 L18,18 L20,18';
  const d = kind === 'lowshelf' ? shelfLo : kind === 'highshelf' ? shelfHi : bell;
  return (
    <svg width={24} height={22} viewBox="0 0 24 22" aria-hidden>
      <rect
        x={1}
        y={1}
        width={22}
        height={20}
        rx={3}
        fill={active ? `${color}22` : 'rgba(15,23,42,0.6)'}
        stroke={active ? color : 'rgba(148,163,184,0.25)'}
        strokeWidth={active ? 1.4 : 0.8}
      />
      <path d={d} stroke={color} strokeWidth={1.8} fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function AnaModernEqDisplay({
  fx,
  disabled,
  onBandAdjust,
  onToggleEnabled,
}: {
  fx: GenoUltraFxParams;
  disabled?: boolean;
  onBandAdjust: (band: GenoUltraEqBandId, patch: { db?: number; hz?: number }) => void;
  onToggleEnabled?: () => void;
}) {
  const gradId = useId().replace(/:/g, '');
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<GenoUltraEqBandId | null>(null);
  const [selected, setSelected] = useState<GenoUltraEqBandId>('hiMid');
  const [dragging, setDragging] = useState<GenoUltraEqBandId | null>(null);
  const [meterL, setMeterL] = useState(-60);
  const [meterR, setMeterR] = useState(-60);
  const [combinedMag, setCombinedMag] = useState<Float32Array>(() => Float32Array.from({ length: 96 }, () => 0));
  const [bandMags, setBandMags] = useState<Record<GenoUltraEqBandId, Float32Array>>(() => ({
    low: new Float32Array(96),
    loMid: new Float32Array(96),
    hiMid: new Float32Array(96),
    high: new Float32Array(96),
  }));

  const fxKey = `${fx.eqEnabled}-${fx.eqLowDb}-${fx.eqLoMidDb}-${fx.eqHiMidDb}-${fx.eqHighDb}-${fx.eqLowHz}-${fx.eqLoMidHz}-${fx.eqHiMidHz}-${fx.eqHighHz}`;
  useLayoutEffect(() => {
    const combined = computeGenoUltraEqMagDb(fx);
    setCombinedMag(combined);
    const next: Record<GenoUltraEqBandId, Float32Array> = {
      low: computeGenoUltraEqSingleBandMagDb('low', fx),
      loMid: computeGenoUltraEqSingleBandMagDb('loMid', fx),
      hiMid: computeGenoUltraEqSingleBandMagDb('hiMid', fx),
      high: computeGenoUltraEqSingleBandMagDb('high', fx),
    };
    setBandMags(next);
  }, [fxKey, fx]);

  useEffect(() => {
    if (!fx.eqEnabled) {
      setMeterL(-60);
      setMeterR(-60);
      return;
    }
    let raf = 0;
    let lastUi = 0;
    const tick = (t: number) => {
      if (t - lastUi >= 32) {
        const { lDb, rDb } = readGenoUltraStripMeterStereo();
        setMeterL(lDb);
        setMeterR(rDb);
        lastUi = t;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fx.eqEnabled]);

  const meterPctL = Math.max(0, Math.min(100, ((meterL + 60) / 60) * 100));
  const meterPctR = Math.max(0, Math.min(100, ((meterR + 60) / 60) * 100));
  const formatMeterDb = (db: number) => (db <= -59 ? '−∞' : db.toFixed(1));

  const curvePath = useMemo(() => genoUltraEqCurvePath(combinedMag), [combinedMag]);
  const freqLines = useMemo(() => genoUltraEqGridFreqLines(), []);
  const dbLines = useMemo(() => genoUltraEqGridDbLines(), []);
  const graphInnerL = GENO_ULTRA_EQ_PAD_L;
  const graphInnerR = GENO_ULTRA_EQ_GRAPH_W - GENO_ULTRA_EQ_PAD_R;

  const cycleBand = (dir: -1 | 1) => {
    const ids = GENO_ULTRA_EQ_BANDS.map((b) => b.id);
    const idx = ids.indexOf(selected);
    setSelected(ids[(idx + dir + ids.length) % ids.length]!);
  };

  const onPointerDown = (band: GenoUltraEqBandId) => (e: PointerEvent<SVGCircleElement>) => {
    if (disabled || !fx.eqEnabled) return;
    e.preventDefault();
    setSelected(band);
    dragRef.current = band;
    setDragging(band);
    (e.currentTarget as SVGCircleElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const band = dragRef.current;
    if (!band || !svgRef.current) return;
    const pt = svgRef.current.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svgRef.current.getScreenCTM();
    if (!ctm) return;
    const p = pt.matrixTransform(ctm.inverse());
    const db = Math.max(GENO_ULTRA_EQ_DB_MIN, Math.min(GENO_ULTRA_EQ_DB_MAX, genoUltraEqYToDb(p.y)));
    const hz = clampGenoUltraEqBandHz(band, genoUltraEqXToHz(p.x), fx);
    onBandAdjust(band, { db: Math.round(db * 10) / 10, hz });
  };

  const endDrag = () => {
    dragRef.current = null;
    setDragging(null);
  };

  const selHz = getGenoUltraEqBandHz(selected, fx);
  const selX = genoUltraEqHzToX(selHz);
  const selColor = PRO_EQ_BAND[selected].color;

  return (
    <div
      style={{
        ...proFxPanelShell,
        opacity: fx.eqEnabled ? 1 : 0.5,
      }}
    >
      {/* Filter type row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 10,
          padding: '8px 12px 4px',
          borderBottom: '1px solid rgba(59,130,246,0.12)',
          background: 'linear-gradient(180deg, rgba(15,23,42,0.9) 0%, rgba(10,22,40,0.4) 100%)',
        }}
      >
        {GENO_ULTRA_EQ_BANDS.map((band) => (
          <button
            key={band.id}
            type="button"
            disabled={disabled}
            onClick={() => setSelected(band.id)}
            style={{
              padding: 0,
              border: 'none',
              background: 'transparent',
              cursor: disabled ? 'default' : 'pointer',
              opacity: selected === band.id ? 1 : 0.72,
              transform: selected === band.id ? 'scale(1.06)' : 'scale(1)',
              transition: 'transform 100ms, opacity 100ms',
            }}
          >
            <EqFilterIcon kind={band.kind} color={PRO_EQ_BAND[band.id].color} active={selected === band.id} />
          </button>
        ))}
      </div>

      {/* Analyzer graph */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'stretch' }}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => cycleBand(-1)}
          aria-label="Previous band"
          style={{
            width: 22,
            border: 'none',
            background: 'rgba(15,23,42,0.5)',
            color: 'rgba(148,163,184,0.5)',
            cursor: disabled ? 'default' : 'pointer',
            fontSize: 14,
          }}
        >
          ‹
        </button>

        <div style={{ flex: 1, minWidth: 0, height: GENO_ULTRA_EQ_GRAPH_H }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${GENO_ULTRA_EQ_GRAPH_W} ${GENO_ULTRA_EQ_GRAPH_H}`}
            width="100%"
            height="100%"
            preserveAspectRatio="none"
            style={{ display: 'block', touchAction: 'none' }}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <defs>
              <filter id={`pro-eq-glow-${gradId}`} x="-10%" y="-10%" width="120%" height="120%">
                <feGaussianBlur stdDeviation="1.5" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Log + dB grid */}
            {dbLines.map((db) => (
              <line
                key={db}
                x1={graphInnerL}
                x2={graphInnerR}
                y1={genoUltraEqDbToY(db)}
                y2={genoUltraEqDbToY(db)}
                stroke={db === 0 ? PRO_EQ_ZERO : PRO_EQ_GRID}
                strokeWidth={db === 0 ? 1.2 : db % 6 === 0 ? 0.7 : 0.45}
                strokeDasharray={db === 0 ? undefined : db % 6 === 0 ? '4 6' : '2 5'}
              />
            ))}
            {freqLines.map(({ hz, label }) => {
              const x = genoUltraEqHzToX(hz);
              const major = label === '1k' || label === '100' || label === '10k';
              return (
                <g key={hz}>
                  <line
                    x1={x}
                    x2={x}
                    y1={10}
                    y2={GENO_ULTRA_EQ_GRAPH_H - GENO_ULTRA_EQ_PAD_B}
                    stroke={major ? PRO_EQ_GRID_MAJOR : PRO_EQ_GRID}
                    strokeWidth={major ? 0.75 : 0.45}
                  />
                  <text
                    x={x}
                    y={GENO_ULTRA_EQ_GRAPH_H - 6}
                    textAnchor="middle"
                    fill="rgba(148,163,184,0.75)"
                    fontSize={6.5}
                    fontWeight={600}
                    fontFamily="ui-monospace, SFMono-Regular, monospace"
                  >
                    {label}
                  </text>
                </g>
              );
            })}

            {/* dB scale left + right */}
            {[-12, -6, 0, 6, 12].map((db) => (
              <g key={`l-${db}`}>
                <text
                  x={6}
                  y={genoUltraEqDbToY(db) + 2}
                  fill="rgba(148,163,184,0.65)"
                  fontSize={6}
                  fontWeight={600}
                  fontFamily="ui-monospace, monospace"
                >
                  {db > 0 ? `+${db}` : db}
                </text>
                <text
                  x={GENO_ULTRA_EQ_GRAPH_W - 6}
                  y={genoUltraEqDbToY(db) + 2}
                  textAnchor="end"
                  fill="rgba(148,163,184,0.65)"
                  fontSize={6}
                  fontWeight={600}
                  fontFamily="ui-monospace, monospace"
                >
                  {db > 0 ? `+${db}` : db}
                </text>
              </g>
            ))}

            {/* Selected band column highlight */}
            {fx.eqEnabled ? (
              <rect
                x={selX - 18}
                y={8}
                width={36}
                height={GENO_ULTRA_EQ_GRAPH_H - GENO_ULTRA_EQ_PAD_B - 4}
                fill={`${selColor}14`}
                stroke={`${selColor}44`}
                strokeWidth={0.8}
                rx={4}
              />
            ) : null}

            {/* Per-band colored fills (stacked Pro-Q style) */}
            {GENO_ULTRA_EQ_BANDS.map((band) => {
              const mag = bandMags[band.id];
              const fill = genoUltraEqBandFillPath(mag);
              if (!fill || !fx.eqEnabled) return null;
              const pal = PRO_EQ_BAND[band.id];
              return (
                <path
                  key={`fill-${band.id}`}
                  d={fill}
                  fill={pal.fill}
                  stroke="none"
                  style={{ mixBlendMode: 'screen' as const }}
                />
              );
            })}

            {/* Combined response outline */}
            {curvePath && fx.eqEnabled ? (
              <path
                d={curvePath}
                stroke="rgba(248,250,252,0.92)"
                strokeWidth={1.6}
                fill="none"
                strokeLinecap="round"
                filter={`url(#pro-eq-glow-${gradId})`}
              />
            ) : null}

            {/* Band nodes */}
            {GENO_ULTRA_EQ_BANDS.map((band) => {
              const bandHz = getGenoUltraEqBandHz(band.id, fx);
              const x = genoUltraEqHzToX(bandHz);
              const y = genoUltraEqBandDotY(band.id, fx, combinedMag);
              const gain = fx[band.gainKey];
              const pal = PRO_EQ_BAND[band.id];
              const isSel = selected === band.id;
              const isDrag = dragging === band.id;
              return (
                <g key={band.id}>
                  <circle
                    cx={x}
                    cy={y}
                    r={isDrag ? 8 : isSel ? 7 : 5.5}
                    fill={pal.color}
                    stroke="#f8fafc"
                    strokeWidth={isSel ? 2 : 1.4}
                    style={{
                      cursor: disabled || !fx.eqEnabled ? 'default' : 'grab',
                      filter: isSel ? `drop-shadow(0 0 8px ${pal.color})` : undefined,
                    }}
                    onPointerDown={onPointerDown(band.id)}
                  />
                  {isDrag ? (
                    <text
                      x={x}
                      y={y - 11}
                      textAnchor="middle"
                      fill={pal.stroke}
                      fontSize={7}
                      fontWeight={800}
                      fontFamily="ui-monospace, monospace"
                    >
                      {formatGenoUltraEqHz(bandHz)} Hz
                    </text>
                  ) : null}
                  {(isSel || isDrag) && Math.abs(gain) > 0.01 ? (
                    <text
                      x={x}
                      y={y - (isDrag ? 20 : 11)}
                      textAnchor="middle"
                      fill={pal.stroke}
                      fontSize={7}
                      fontWeight={800}
                      fontFamily="ui-monospace, monospace"
                    >
                      {gain > 0 ? '+' : ''}
                      {gain.toFixed(1)} dB
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>
        </div>

        <button
          type="button"
          disabled={disabled}
          onClick={() => cycleBand(1)}
          aria-label="Next band"
          style={{
            width: 22,
            border: 'none',
            background: 'rgba(15,23,42,0.5)',
            color: 'rgba(148,163,184,0.5)',
            cursor: disabled ? 'default' : 'pointer',
            fontSize: 14,
          }}
        >
          ›
        </button>

        {/* Stereo OUT meters (Pro-Q style) */}
        <div
          style={{
            width: 48,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            padding: '6px 4px',
            borderLeft: '1px solid rgba(59,130,246,0.12)',
            background: 'rgba(15,23,42,0.55)',
          }}
        >
          <span style={{ fontSize: 5.5, fontWeight: 800, color: 'rgba(148,163,184,0.7)', letterSpacing: '0.08em' }}>OUT</span>
          <div style={{ display: 'flex', gap: 5, alignItems: 'flex-end', flex: 1, minHeight: 48 }}>
            {(
              [
                { ch: 'L', pct: meterPctL, db: meterL, color: '#38bdf8' },
                { ch: 'R', pct: meterPctR, db: meterR, color: '#2dd4bf' },
              ] as const
            ).map(({ ch, pct, db, color }) => (
              <div
                key={ch}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                  flex: 1,
                  height: '100%',
                }}
              >
                <div
                  style={{
                    width: 6,
                    flex: 1,
                    minHeight: 44,
                    borderRadius: 3,
                    background: 'rgba(30,41,59,0.9)',
                    border: '1px solid rgba(148,163,184,0.2)',
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: 0,
                      height: `${pct}%`,
                      background: `linear-gradient(180deg, ${color}ee 0%, ${color} 55%, ${color}99 100%)`,
                      borderRadius: 2,
                      boxShadow: pct > 4 ? `0 0 8px ${color}88` : undefined,
                      transition: 'height 80ms ease-out',
                    }}
                  />
                </div>
                <span style={{ fontSize: 6, fontWeight: 800, color, letterSpacing: '0.06em' }}>{ch}</span>
                <span style={{ fontSize: 5.5, fontWeight: 700, color: '#e2e8f0', fontFamily: 'ui-monospace, monospace' }}>
                  {formatMeterDb(db)}
                </span>
              </div>
            ))}
          </div>
          <span style={{ fontSize: 5.5, color: 'rgba(148,163,184,0.6)' }}>dBFS</span>
        </div>
      </div>

      {/* Bottom parameter columns */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${GENO_ULTRA_EQ_BANDS.length}, 1fr)`,
          gap: 2,
          padding: '4px 8px 6px',
          borderTop: '1px solid rgba(59,130,246,0.12)',
          background: 'rgba(8,16,30,0.95)',
        }}
      >
        {GENO_ULTRA_EQ_BANDS.map((band) => {
          const gain = fx[band.gainKey];
          const bandHz = getGenoUltraEqBandHz(band.id, fx);
          const pal = PRO_EQ_BAND[band.id];
          const isSel = selected === band.id;
          return (
            <button
              key={band.id}
              type="button"
              disabled={disabled}
              onClick={() => setSelected(band.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1,
                padding: '4px 2px',
                border: 'none',
                borderRadius: 4,
                background: isSel ? `${pal.color}28` : 'transparent',
                cursor: disabled ? 'default' : 'pointer',
              }}
            >
              <span style={{ fontSize: 7, fontWeight: 700, color: pal.stroke, fontFamily: 'ui-monospace, monospace' }}>
                {formatGenoUltraEqHz(bandHz)} Hz
              </span>
              <span
                style={{
                  fontSize: 8,
                  fontWeight: 800,
                  color: isSel ? '#f8fafc' : pal.color,
                  fontFamily: 'ui-monospace, monospace',
                  padding: isSel ? '1px 6px' : 0,
                  borderRadius: 8,
                  background: isSel ? `${pal.color}55` : 'transparent',
                }}
              >
                {gain > 0 ? '+' : ''}
                {gain.toFixed(1)} dB
              </span>
              <span style={{ fontSize: 6.5, fontWeight: 600, color: 'rgba(148,163,184,0.75)', fontFamily: 'ui-monospace, monospace' }}>
                {band.q.toFixed(2)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Footer toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '5px 10px 7px',
          borderTop: '1px solid rgba(59,130,246,0.1)',
        }}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={onToggleEnabled}
          style={{
            padding: '3px 10px',
            fontSize: 7,
            fontWeight: 800,
            letterSpacing: '0.06em',
            borderRadius: 4,
            border: `1px solid ${fx.eqEnabled ? 'rgba(96,165,250,0.55)' : 'rgba(148,163,184,0.25)'}`,
            background: fx.eqEnabled ? 'rgba(59,130,246,0.35)' : 'rgba(30,41,59,0.5)',
            color: fx.eqEnabled ? '#e0f2fe' : 'rgba(148,163,184,0.7)',
            cursor: disabled ? 'default' : 'pointer',
          }}
        >
          ANALYZER {fx.eqEnabled ? 'POST' : 'OFF'}
        </button>
        <span style={{ fontSize: 6.5, color: 'rgba(148,163,184,0.55)', fontWeight: 700 }}>Q-COUPLE</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 6.5, color: 'rgba(148,163,184,0.55)', fontWeight: 700, letterSpacing: '0.08em' }}>
          4-BAND PARAMETRIC
        </span>
      </div>
    </div>
  );
}

export function AnaFxModernFrame({
  children,
  height,
  minHeight = 72,
  style,
}: {
  children: ReactNode;
  height?: number;
  minHeight?: number;
  style?: CSSProperties;
}) {
  const h = height ?? minHeight;
  return (
    <div
      style={{
        position: 'relative',
        height: h,
        minHeight: h,
        borderRadius: 10,
        border: `1px solid ${FX_VIS.border}`,
        background: FX_VIS.bg,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -12px 28px rgba(0,0,0,0.35), 0 8px 28px rgba(0,0,0,0.28)`,
        overflow: 'hidden',
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: FX_VIS.mesh,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 95% 85% at 50% 50%, transparent 35%, rgba(0,0,0,0.45) 100%)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative', height: '100%', width: '100%' }}>{children}</div>
    </div>
  );
}

/** Pro-style delay timeline — mirrors AnaModernEqDisplay layout. */
export function AnaModernDelayDisplay({
  delayTimeMs,
  delayTimeMsR,
  feedback,
  mix,
  enabled = true,
  pingPong = false,
  disabled,
  syncOn = false,
  onPatch,
  onToggleEnabled,
  onToggleSync,
}: {
  delayTimeMs: number;
  delayTimeMsR?: number;
  feedback: number;
  mix: number;
  enabled?: boolean;
  pingPong?: boolean;
  disabled?: boolean;
  syncOn?: boolean;
  onPatch?: (p: { delayTimeMs?: number; delayFeedback?: number; delayMix?: number; delayEnabled?: boolean }) => void;
  onToggleEnabled?: () => void;
  onToggleSync?: () => void;
}) {
  const gradId = useId().replace(/:/g, '');
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef(false);
  const [selected, setSelected] = useState<DelayLane>('L');
  const [dragging, setDragging] = useState(false);
  const timeR = delayTimeMsR ?? Math.round(delayTimeMs * 1.08);
  const active = enabled !== false && mix > 0.02;

  const maxMs = useMemo(
    () => Math.max(480, delayTimeMs * 5, timeR * 5, 900),
    [delayTimeMs, timeR],
  );

  const taps = useMemo(
    () => buildDelayTapModel(delayTimeMs, timeR, feedback, mix, pingPong, maxMs),
    [delayTimeMs, timeR, feedback, mix, pingPong, maxMs],
  );

  const timeTicks = useMemo(() => {
    const marks = [0, 0.25, 0.5, 0.75, 1];
    return marks.map((t) => ({
      ms: Math.round(maxMs * t),
      x: msToDelayX(maxMs * t, maxMs),
      label: t === 0 ? '0' : `${Math.round(maxMs * t)}`,
    }));
  }, [maxMs]);

  const laneMidL = 52;
  const laneMidR = 108;
  const barH = 38;

  const selColor =
    selected === 'L' ? PRO_DELAY_L.color : selected === 'R' ? PRO_DELAY_R.color : FX_VIS.accentDelay;
  const selTapMs = selected === 'L' ? delayTimeMs : selected === 'R' ? timeR : delayTimeMs;
  const selX = msToDelayX(selTapMs, maxMs);

  const cycleLane = (dir: -1 | 1) => {
    const lanes: DelayLane[] = ['L', 'R', 'fb', 'mix'];
    const idx = lanes.indexOf(selected);
    setSelected(lanes[(idx + dir + lanes.length) % lanes.length]!);
  };

  const xToMs = (x: number) => {
    const inner = DELAY_GRAPH_W - DELAY_PAD_L - DELAY_PAD_R;
    const t = (x - DELAY_PAD_L) / inner;
    return Math.round(Math.max(40, Math.min(980, t * maxMs)));
  };

  const yToNorm = (y: number) => {
    const top = 22;
    const bottom = DELAY_GRAPH_H - 22;
    return Math.max(0, Math.min(1, (bottom - y) / (bottom - top)));
  };

  const onGraphPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (disabled || !onPatch) return;
    e.preventDefault();
    dragRef.current = true;
    setDragging(true);
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  const onGraphPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current || !svgRef.current || !onPatch) return;
    const pt = svgRef.current.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svgRef.current.getScreenCTM();
    if (!ctm) return;
    const p = pt.matrixTransform(ctm.inverse());

    if (selected === 'L') {
      onPatch({ delayTimeMs: xToMs(p.x) });
    } else if (selected === 'R') {
      onPatch({ delayTimeMs: xToMs(p.x) / 1.08 });
    } else if (selected === 'fb') {
      onPatch({ delayFeedback: Math.round(yToNorm(p.y) * 95) / 100 });
    } else if (selected === 'mix') {
      const nextMix = Math.round(yToNorm(p.y) * 100) / 100;
      onPatch({ delayMix: nextMix, ...(nextMix > 0.02 ? { delayEnabled: true } : {}) });
    }
  };

  const endDrag = () => {
    dragRef.current = false;
    setDragging(false);
  };

  const firstEcho = taps.find((t) => t.gen === 1);

  return (
    <div style={{ ...proFxPanelShell, opacity: enabled !== false ? 1 : 0.48 }}>
      {/* Mode row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 14,
          padding: '8px 12px 4px',
          borderBottom: '1px solid rgba(59,130,246,0.12)',
          background: 'linear-gradient(180deg, rgba(15,23,42,0.9) 0%, rgba(10,22,40,0.4) 100%)',
        }}
      >
        <button type="button" disabled={disabled} onClick={() => setSelected('L')} style={{ border: 'none', background: 'transparent', cursor: disabled ? 'default' : 'pointer', padding: 0 }}>
          <DelayModeIcon label="LEFT" color={PRO_DELAY_L.color} active={selected === 'L'}>
            <rect x={5} y={10} width={4} height={8} rx={1} fill={PRO_DELAY_L.color} />
            <rect x={11} y={7} width={4} height={11} rx={1} fill={PRO_DELAY_L.color} opacity={0.55} />
            <rect x={17} y={9} width={4} height={9} rx={1} fill={PRO_DELAY_L.color} opacity={0.3} />
          </DelayModeIcon>
        </button>
        <button type="button" disabled={disabled} onClick={() => setSelected('R')} style={{ border: 'none', background: 'transparent', cursor: disabled ? 'default' : 'pointer', padding: 0 }}>
          <DelayModeIcon label="RIGHT" color={PRO_DELAY_R.color} active={selected === 'R'}>
            <rect x={5} y={9} width={4} height={9} rx={1} fill={PRO_DELAY_R.color} opacity={0.3} />
            <rect x={11} y={7} width={4} height={11} rx={1} fill={PRO_DELAY_R.color} opacity={0.55} />
            <rect x={17} y={10} width={4} height={8} rx={1} fill={PRO_DELAY_R.color} />
          </DelayModeIcon>
        </button>
        <DelayModeIcon label={pingPong ? 'PING-PONG' : 'DUAL'} color="#818cf8" active>
          <path d="M6,14 L12,8 L18,14" stroke="#818cf8" strokeWidth={1.6} fill="none" />
          <path d="M6,14 L12,18 L18,14" stroke="#c084fc" strokeWidth={1.4} fill="none" opacity={0.7} />
        </DelayModeIcon>
        <button type="button" disabled={disabled} onClick={() => setSelected('fb')} style={{ border: 'none', background: 'transparent', cursor: disabled ? 'default' : 'pointer', padding: 0 }}>
          <DelayModeIcon label="FEEDBACK" color="#fbbf24" active={selected === 'fb'}>
            <path d="M6,11 Q13,5 20,11 Q13,17 6,11" stroke="#fbbf24" strokeWidth={1.5} fill="none" />
          </DelayModeIcon>
        </button>
        <button type="button" disabled={disabled} onClick={() => setSelected('mix')} style={{ border: 'none', background: 'transparent', cursor: disabled ? 'default' : 'pointer', padding: 0 }}>
          <DelayModeIcon label="MIX" color="#818cf8" active={selected === 'mix'}>
            <rect x={6} y={8} width={14} height={3} rx={1} fill="#818cf8" opacity={0.45} />
            <rect x={6} y={12} width={14} height={5} rx={1} fill="#818cf8" />
          </DelayModeIcon>
        </button>
      </div>

      {/* Timeline analyzer */}
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => cycleLane(-1)}
          aria-label="Previous parameter"
          style={{
            width: 22,
            border: 'none',
            background: 'rgba(15,23,42,0.5)',
            color: 'rgba(148,163,184,0.5)',
            cursor: disabled ? 'default' : 'pointer',
            fontSize: 14,
          }}
        >
          ‹
        </button>
        <div style={{ flex: 1, minWidth: 0, height: DELAY_GRAPH_H }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${DELAY_GRAPH_W} ${DELAY_GRAPH_H}`}
            width="100%"
            height="100%"
            preserveAspectRatio="none"
            style={{ display: 'block', touchAction: 'none', cursor: dragging ? 'grabbing' : onPatch ? 'crosshair' : 'default' }}
            onPointerDown={onGraphPointerDown}
            onPointerMove={onGraphPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <defs>
              <linearGradient id={`dly-l-${gradId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={PRO_DELAY_L.color} stopOpacity={0.95} />
                <stop offset="100%" stopColor={PRO_DELAY_L.color} stopOpacity={0.08} />
              </linearGradient>
              <linearGradient id={`dly-r-${gradId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={PRO_DELAY_R.color} stopOpacity={0.9} />
                <stop offset="100%" stopColor={PRO_DELAY_R.color} stopOpacity={0.06} />
              </linearGradient>
              <filter id={`dly-glow-${gradId}`}>
                <feGaussianBlur stdDeviation="1.4" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Lane labels */}
            <text x={8} y={laneMidL + 3} fill={PRO_DELAY_L.stroke} fontSize={7} fontWeight={800} fontFamily="ui-monospace, monospace">L</text>
            <text x={8} y={laneMidR + 3} fill={PRO_DELAY_R.stroke} fontSize={7} fontWeight={800} fontFamily="ui-monospace, monospace">R</text>

            {/* Time grid */}
            {timeTicks.map(({ ms, x, label }) => (
              <g key={ms}>
                <line x1={x} x2={x} y1={18} y2={DELAY_GRAPH_H - 14} stroke={ms === 0 ? PRO_EQ_ZERO : PRO_EQ_GRID} strokeWidth={ms === 0 ? 1 : 0.55} strokeDasharray={ms === 0 ? undefined : '3 5'} />
                <text x={x} y={DELAY_GRAPH_H - 4} textAnchor="middle" fill="rgba(148,163,184,0.75)" fontSize={6.5} fontWeight={600} fontFamily="ui-monospace, monospace">
                  {label}{ms > 0 ? 'ms' : ''}
                </text>
              </g>
            ))}

            {/* Lane separators */}
            <line x1={DELAY_PAD_L} x2={DELAY_GRAPH_W - DELAY_PAD_R} y1={80} y2={80} stroke={PRO_EQ_GRID_MAJOR} strokeWidth={0.8} strokeDasharray="4 4" />

            {/* Selection column */}
            {active ? (
              <rect x={selX - 16} y={16} width={32} height={DELAY_GRAPH_H - 30} fill={`${selColor}12`} stroke={`${selColor}40`} strokeWidth={0.8} rx={4} />
            ) : null}

            {/* Decay envelope curves */}
            {taps.length > 1 ? (
              <>
                <path
                  d={taps.map((tap, i) => {
                    const x = msToDelayX(tap.tMs, maxMs);
                    const y = laneMidL - tap.ampL * barH;
                    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                  }).join(' ')}
                  stroke={PRO_DELAY_L.stroke}
                  strokeWidth={1.4}
                  fill="none"
                  opacity={0.55}
                  filter={`url(#dly-glow-${gradId})`}
                />
                <path
                  d={taps.map((tap, i) => {
                    const x = msToDelayX(tap.tMs, maxMs);
                    const y = laneMidR - tap.ampR * barH;
                    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                  }).join(' ')}
                  stroke={PRO_DELAY_R.stroke}
                  strokeWidth={1.4}
                  fill="none"
                  opacity={0.5}
                />
              </>
            ) : null}

            {/* Tap bars */}
            {taps.map((tap) => {
              const x = msToDelayX(tap.tMs, maxMs);
              const hL = Math.max(4, tap.ampL * barH);
              const hR = Math.max(3, tap.ampR * barH);
              const isDry = tap.gen === 0;
              return (
                <g key={tap.gen}>
                  <rect
                    x={x - (isDry ? 6 : 5)}
                    y={laneMidL - hL}
                    width={isDry ? 12 : 10}
                    height={hL}
                    rx={3}
                    fill={isDry ? PRO_DELAY_DRY.fill : `url(#dly-l-${gradId})`}
                    stroke={PRO_DELAY_L.color}
                    strokeWidth={isDry ? 1.2 : 0.6}
                    opacity={isDry ? 0.9 : 0.55 + tap.ampL * 0.45}
                    style={{ mixBlendMode: 'screen' as const }}
                  />
                  <rect
                    x={x - (isDry ? 5 : 4)}
                    y={laneMidR - hR}
                    width={isDry ? 10 : 8}
                    height={hR}
                    rx={2.5}
                    fill={isDry ? 'rgba(45,212,191,0.35)' : `url(#dly-r-${gradId})`}
                    stroke={PRO_DELAY_R.color}
                    strokeWidth={0.5}
                    opacity={0.45 + tap.ampR * 0.5}
                    style={{ mixBlendMode: 'screen' as const }}
                  />
                  {!isDry && tap.gen !== 1 && tap.ampL > 0.08 ? (
                    <circle cx={x} cy={laneMidL - hL} r={3} fill={PRO_DELAY_L.color} stroke="#f8fafc" strokeWidth={1.2} />
                  ) : null}
                  {!isDry && tap.gen !== 1 && tap.ampR > 0.08 ? (
                    <circle cx={x} cy={laneMidR - hR} r={2.5} fill={PRO_DELAY_R.color} stroke="#f8fafc" strokeWidth={1} />
                  ) : null}
                </g>
              );
            })}
            {firstEcho && active ? (
              <g>
                <circle
                  cx={msToDelayX(firstEcho.tMs, maxMs)}
                  cy={laneMidL - firstEcho.ampL * barH}
                  r={selected === 'L' ? 5.5 : 4}
                  fill={PRO_DELAY_L.color}
                  stroke="#f8fafc"
                  strokeWidth={selected === 'L' ? 1.6 : 1}
                  opacity={selected === 'L' ? 1 : 0.7}
                />
                <circle
                  cx={msToDelayX(firstEcho.tMs, maxMs)}
                  cy={laneMidR - firstEcho.ampR * barH}
                  r={selected === 'R' ? 5.5 : 4}
                  fill={PRO_DELAY_R.color}
                  stroke="#f8fafc"
                  strokeWidth={selected === 'R' ? 1.6 : 1}
                  opacity={selected === 'R' ? 1 : 0.7}
                />
              </g>
            ) : null}
          </svg>
        </div>

        {/* Wet level meter */}
        <div
          style={{
            width: 36,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            padding: '6px 4px',
            borderLeft: '1px solid rgba(59,130,246,0.12)',
            background: 'rgba(15,23,42,0.55)',
          }}
        >
          <span style={{ fontSize: 5.5, fontWeight: 800, color: 'rgba(148,163,184,0.7)', letterSpacing: '0.08em' }}>WET</span>
          <div style={{ width: 6, flex: 1, minHeight: 48, borderRadius: 3, background: 'rgba(30,41,59,0.9)', border: '1px solid rgba(148,163,184,0.2)', position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: `${Math.round(mix * 100)}%`,
                background: 'linear-gradient(180deg, #38bdf8 0%, #2dd4bf 100%)',
                borderRadius: 2,
                boxShadow: '0 0 8px rgba(56,189,248,0.5)',
              }}
            />
          </div>
          <span style={{ fontSize: 6.5, fontWeight: 700, color: '#e2e8f0', fontFamily: 'ui-monospace, monospace' }}>
            {Math.round(mix * 100)}
          </span>
          <span style={{ fontSize: 5.5, color: 'rgba(148,163,184,0.6)' }}>%</span>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => cycleLane(1)}
          aria-label="Next parameter"
          style={{
            width: 22,
            border: 'none',
            background: 'rgba(15,23,42,0.5)',
            color: 'rgba(148,163,184,0.5)',
            cursor: disabled ? 'default' : 'pointer',
            fontSize: 14,
          }}
        >
          ›
        </button>
      </div>

      {/* Bottom readouts */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 2,
          padding: '4px 8px 6px',
          borderTop: '1px solid rgba(59,130,246,0.12)',
          background: 'rgba(8,16,30,0.95)',
        }}
      >
        {(
          [
            { id: 'L' as const, label: 'TIME L', value: `${delayTimeMs} ms`, color: PRO_DELAY_L.color, onClick: () => setSelected('L') },
            { id: 'R' as const, label: 'TIME R', value: `${timeR} ms`, color: PRO_DELAY_R.color, onClick: () => setSelected('R') },
            { id: 'fb' as const, label: 'FEEDBACK', value: `${Math.round(feedback * 100)} %`, color: '#fbbf24', onClick: () => setSelected('fb') },
            { id: 'mix' as const, label: 'MIX', value: `${Math.round(mix * 100)} %`, color: '#818cf8', onClick: () => setSelected('mix') },
            { id: 'sync' as const, label: 'SYNC', value: syncOn ? 'ON' : 'OFF', color: '#94a3b8', onClick: onToggleSync },
          ] as const
        ).map((col) => {
          const isSel = selected === col.id || (col.id === 'sync' && syncOn);
          return (
            <button
              key={col.label}
              type="button"
              disabled={disabled || (col.id === 'sync' && !onToggleSync)}
              onClick={col.onClick}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1,
                padding: '4px 2px',
                border: 'none',
                borderRadius: 4,
                background: isSel ? `${col.color}24` : 'transparent',
                cursor: disabled ? 'default' : 'pointer',
              }}
            >
              <span style={{ fontSize: 6.5, fontWeight: 700, color: 'rgba(148,163,184,0.75)', letterSpacing: '0.05em' }}>{col.label}</span>
              <span
                style={{
                  fontSize: 8,
                  fontWeight: 800,
                  color: isSel ? '#f8fafc' : col.color,
                  fontFamily: 'ui-monospace, monospace',
                  padding: isSel ? '1px 6px' : 0,
                  borderRadius: 8,
                  background: isSel ? `${col.color}50` : 'transparent',
                }}
              >
                {col.value}
              </span>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px 7px', borderTop: '1px solid rgba(59,130,246,0.1)' }}>
        <button
          type="button"
          disabled={disabled}
          onClick={onToggleEnabled}
          style={{
            padding: '3px 10px',
            fontSize: 7,
            fontWeight: 800,
            letterSpacing: '0.06em',
            borderRadius: 4,
            border: `1px solid ${active ? 'rgba(96,165,250,0.55)' : 'rgba(148,163,184,0.25)'}`,
            background: active ? 'rgba(59,130,246,0.35)' : 'rgba(30,41,59,0.5)',
            color: active ? '#e0f2fe' : 'rgba(148,163,184,0.7)',
            cursor: disabled || !onToggleEnabled ? 'default' : 'pointer',
          }}
        >
          DELAY {active ? 'POST' : 'OFF'}
        </button>
        <span style={{ fontSize: 6.5, color: 'rgba(148,163,184,0.55)', fontWeight: 700 }}>TAP DECAY</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 6.5, color: 'rgba(148,163,184,0.55)', fontWeight: 700, letterSpacing: '0.08em' }}>
          {pingPong ? 'STEREO PING-PONG' : 'DUAL STEREO DELAY'}
        </span>
      </div>
    </div>
  );
}

/** @deprecated Use AnaModernDelayDisplay */
export function AnaDelayEchoDisplay({
  feedback,
  mix,
  pingPong = false,
  delayTimeMs = 280,
}: {
  feedback: number;
  mix: number;
  pingPong?: boolean;
  delayTimeMs?: number;
}) {
  return (
    <AnaModernDelayDisplay
      delayTimeMs={delayTimeMs}
      delayTimeMsR={Math.round(delayTimeMs * 1.08)}
      feedback={feedback}
      mix={mix}
      pingPong={pingPong}
    />
  );
}

export function AnaReverbDiffuseDisplay({ decay, mix, height = 64 }: { decay: number; mix: number; height?: number }) {
  const gradId = useId().replace(/:/g, '');
  const d = Number.isFinite(decay) ? decay : 0.45;
  const waves = useMemo(() => {
    const paths: string[] = [];
    for (let layer = 0; layer < 3; layer += 1) {
      const pts: string[] = [];
      for (let x = 0; x <= 200; x += 2) {
        const t = x / 200;
        const amp = (1 - t * 0.35) * (8 + d * 22 + mix * 12) * (1 - layer * 0.22);
        const y = 38 + Math.sin(x * (0.07 + layer * 0.02) + d * 6) * amp + Math.sin(x * 0.019) * amp * 0.35;
        pts.push(`${x === 0 ? 'M' : 'L'} ${x} ${y}`);
      }
      paths.push(pts.join(' '));
    }
    return paths;
  }, [d, mix]);

  return (
    <AnaFxModernFrame height={height} minHeight={height}>
      <svg viewBox="0 0 200 72" width="100%" height="100%" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`fx-rev-${gradId}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={FX_VIS.accentReverb} stopOpacity={0.15} />
            <stop offset="50%" stopColor={FX_VIS.curveViolet} stopOpacity={0.85} />
            <stop offset="100%" stopColor={FX_VIS.accentReverb} stopOpacity={0.2} />
          </linearGradient>
        </defs>
        {waves.map((path, i) => (
          <path
            key={i}
            d={path}
            stroke={`url(#fx-rev-${gradId})`}
            strokeWidth={2.2 - i * 0.5}
            fill="none"
            opacity={0.55 + (2 - i) * 0.18}
            style={{ filter: i === 0 ? `drop-shadow(0 0 5px ${FX_VIS.accentReverb})` : undefined }}
          />
        ))}
        {Array.from({ length: 10 }, (_, i) => {
          const x = 120 + i * 7 + Math.sin(i * 1.7) * 4;
          const y = 30 + Math.sin(i * 2.1 + d * 8) * (6 + d * 14);
          return <circle key={i} cx={x} cy={y} r={1.2 + (1 - i / 10) * 1.2} fill={FX_VIS.curveViolet} opacity={0.15 + (1 - i / 10) * 0.5} />;
        })}
        <text x={10} y={12} fill={FX_VIS.label} fontSize={7} fontWeight={700} fontFamily="ui-monospace, monospace">
          DIFFUSION
        </text>
      </svg>
    </AnaFxModernFrame>
  );
}

export function AnaTapeWaveDisplay({ mix, height = 64 }: { mix: number; height?: number }) {
  const gradId = useId().replace(/:/g, '');
  const paths = useMemo(() => {
    const mk = (seed: number, amp: number) => {
      let d = 'M0,38 ';
      for (let x = 0; x <= 200; x += 3) {
        const y = 38 + Math.sin(x * 0.075 + seed) * amp + Math.sin(x * 0.021 + seed * 2) * amp * 0.45;
        d += `L${x},${y} `;
      }
      return d.trim();
    };
    return [mk(0, 5 + mix * 8), mk(1.4, 3 + mix * 5)];
  }, [mix]);

  return (
    <AnaFxModernFrame height={height} minHeight={height}>
      <svg viewBox="0 0 200 72" width="100%" height="100%" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`fx-tape-${gradId}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={FX_VIS.accentTape} stopOpacity={0.35} />
            <stop offset="50%" stopColor="#f9a8d4" stopOpacity={0.95} />
            <stop offset="100%" stopColor={FX_VIS.curveViolet} stopOpacity={0.4} />
          </linearGradient>
        </defs>
        <path d={paths[1]} stroke={FX_VIS.curveViolet} strokeWidth={1.4} fill="none" opacity={0.35} />
        <path
          d={paths[0]}
          stroke={`url(#fx-tape-${gradId})`}
          strokeWidth={2}
          fill="none"
          style={{ filter: `drop-shadow(0 0 5px ${FX_VIS.accentTape})` }}
        />
        <text x={10} y={12} fill={FX_VIS.label} fontSize={7} fontWeight={700} fontFamily="ui-monospace, monospace">
          WOW / FLUTTER
        </text>
      </svg>
    </AnaFxModernFrame>
  );
}

export function anaFxSlotButtonStyle(active: boolean, disabled?: boolean): CSSProperties {
  return {
    flex: '1 1 0',
    minWidth: 72,
    padding: '5px 8px',
    fontSize: 6.5,
    fontWeight: 800,
    letterSpacing: '0.07em',
    borderRadius: 6,
    border: `1px solid ${active ? FX_VIS.borderHi : FX_VIS.border}`,
    background: active
      ? 'linear-gradient(135deg, rgba(45,212,191,0.22) 0%, rgba(129,140,248,0.18) 100%)'
      : 'rgba(12,16,24,0.55)',
    color: active ? FX_VIS.labelHi : FX_VIS.label,
    boxShadow: active ? `0 0 16px rgba(94,234,212,0.18), inset 0 1px 0 rgba(255,255,255,0.06)` : 'none',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    whiteSpace: 'nowrap',
    transition: 'border-color 120ms, box-shadow 120ms, background 120ms',
  };
}
