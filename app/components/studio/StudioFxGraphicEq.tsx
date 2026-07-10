'use client';

import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { buildLogFreqs, FREQ_MAG_LEN, magDbAtHz } from '@/app/lib/creationStation/grooveLabChannelFxEq';
import {
  computeStudioEqMagDb,
  patchStudioEqBands,
  STUDIO_EQ_GRAPH_H,
  STUDIO_EQ_GRAPH_W,
  STUDIO_EQ_GRID_FREQS,
  STUDIO_EQ_PAD_B,
  STUDIO_EQ_PAD_L,
  STUDIO_EQ_PAD_R,
  STUDIO_EQ_PAD_T,
  studioEqBandColor,
  studioEqDbToY,
  studioEqFormatBandHz,
  studioEqHzToX,
  studioEqXToHz,
  studioEqYToDb,
  type StudioEqFx,
} from '@/app/lib/studio/studioEq';

function clientToSvg(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const p = pt.matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}

function formatGridHz(hz: number): string {
  if (hz >= 1000) return `${hz / 1000}K`;
  return String(hz);
}

const GRID_DB = [-12, -6, 0, 6, 12];
const MAJOR_FREQS = [100, 1000, 10000] as const;

export function StudioFxGraphicEq({
  eq,
  onEqChange,
  accent = '#7cf4c6',
}: {
  eq: StudioEqFx;
  onEqChange: (next: StudioEqFx) => void;
  trackIndex?: number;
  meterActive?: boolean;
  accent?: string;
}) {
  const gradId = useId().replace(/:/g, '');
  const svgRef = useRef<SVGSVGElement | null>(null);
  const freqsRef = useRef<Float32Array | null>(null);
  if (!freqsRef.current) freqsRef.current = buildLogFreqs(FREQ_MAG_LEN);

  const dragRef = useRef<{ band: number; shiftQ: boolean } | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [dragDotPos, setDragDotPos] = useState<{ x: number; y: number } | null>(null);

  const [magDb, setMagDb] = useState<Float32Array>(() =>
    Float32Array.from({ length: FREQ_MAG_LEN }, () => 0),
  );

  useLayoutEffect(() => {
    const freqs = freqsRef.current;
    if (!freqs) return;
    setMagDb(computeStudioEqMagDb(freqs, eq));
  }, [eq]);

  const w = STUDIO_EQ_GRAPH_W;
  const h = STUDIO_EQ_GRAPH_H;
  const plotBottom = h - STUDIO_EQ_PAD_B;
  const zeroY = studioEqDbToY(0, h);
  const innerW = w - STUDIO_EQ_PAD_L - STUDIO_EQ_PAD_R;
  const plotH = plotBottom - STUDIO_EQ_PAD_T;

  const { pathStroke, pathFill } = useMemo(() => {
    const freqs = freqsRef.current;
    let d = '';
    if (freqs && freqs.length >= 2) {
      const x0 = studioEqHzToX(freqs[0]!, w);
      const y0 = studioEqDbToY(magDb[0] ?? 0, h);
      d = `M ${x0.toFixed(1)} ${y0.toFixed(1)}`;
      for (let i = 1; i < freqs.length; i += 1) {
        d += ` L ${studioEqHzToX(freqs[i]!, w).toFixed(1)} ${studioEqDbToY(magDb[i] ?? 0, h).toFixed(1)}`;
      }
    }
    const y0 = studioEqDbToY(0, h);
    const firstX = freqs?.length ? studioEqHzToX(freqs[0]!, w).toFixed(1) : String(STUDIO_EQ_PAD_L);
    const lastX = freqs?.length
      ? studioEqHzToX(freqs[freqs.length - 1]!, w).toFixed(1)
      : String(w - STUDIO_EQ_PAD_R);
    return { pathStroke: d, pathFill: `${d} L ${lastX} ${y0.toFixed(1)} L ${firstX} ${y0.toFixed(1)} Z` };
  }, [magDb, w, h]);

  const freqs = freqsRef.current;
  const dotOnCurve = (hz: number, fallbackDb: number) => {
    const db = freqs ? magDbAtHz(freqs, magDb, hz) : fallbackDb;
    return { x: studioEqHzToX(hz, w), y: studioEqDbToY(db, h) };
  };

  const applyPointer = (bandIdx: number, clientX: number, clientY: number, shiftQ: boolean) => {
    const svg = svgRef.current;
    if (!svg) return;
    const band = eq.bands[bandIdx];
    if (!band) return;
    const { x, y } = clientToSvg(svg, clientX, clientY);

    if (shiftQ) {
      const midX = studioEqHzToX(band.freqHz, w);
      const dx = (x - midX) / Math.max(1, innerW);
      const nextQ = Math.max(0.35, Math.min(12, band.q - dx * 18));
      const next = eq.bands.map((b, i) =>
        i === bandIdx ? { ...b, q: Math.round(nextQ * 20) / 20 } : b,
      );
      onEqChange(patchStudioEqBands(eq, next));
      return;
    }

    const hz = studioEqXToHz(x, w);
    const gainDb = Math.round(studioEqYToDb(y, h) * 2) / 2;
    const next = eq.bands.map((b, i) =>
      i === bandIdx ? { ...b, freqHz: hz, gainDb } : b,
    );
    onEqChange(patchStudioEqBands(eq, next));
  };

  const activeBands = eq.bands.filter((b) => Math.abs(b.gainDb) > 0.01).length;

  return (
    <div style={{ touchAction: 'none', userSelect: 'none', width: '100%', position: 'relative' }}>
      <svg
        ref={svgRef}
        width="100%"
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block', width: '100%', minHeight: h, cursor: 'default', position: 'relative' }}
        role="img"
        aria-label="8-band EQ — drag dots for frequency and gain; shift+drag for Q"
      >
        <defs>
          <linearGradient id={`eqFill-${gradId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity={0.42} />
            <stop offset="45%" stopColor="#a78bfa" stopOpacity={0.22} />
            <stop offset="100%" stopColor={accent} stopOpacity={0.04} />
          </linearGradient>
          <linearGradient id={`eqStroke-${gradId}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="35%" stopColor="#c4b5fd" />
            <stop offset="65%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
          <filter id={`eqGlow-${gradId}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="0.9" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect
          x={0.5}
          y={0.5}
          width={w - 1}
          height={h - 1}
          fill="transparent"
          rx={6}
          stroke="rgba(124,244,198,0.22)"
          strokeWidth={1}
        />

        {GRID_DB.map((db) => {
          const y = studioEqDbToY(db, h);
          const isZero = db === 0;
          return (
            <g key={db}>
              <line
                x1={STUDIO_EQ_PAD_L}
                y1={y}
                x2={w - STUDIO_EQ_PAD_R}
                y2={y}
                stroke={isZero ? `${accent}44` : 'rgba(255,255,255,0.05)'}
                strokeWidth={isZero ? 1.25 : 1}
                pointerEvents="none"
              />
              {isZero && (
                <line
                  x1={STUDIO_EQ_PAD_L}
                  y1={y}
                  x2={w - STUDIO_EQ_PAD_R}
                  y2={y}
                  stroke={accent}
                  strokeOpacity={0.18}
                  strokeWidth={4}
                  pointerEvents="none"
                />
              )}
              <text
                x={8}
                y={y + 3}
                fill={isZero ? accent : '#5a5a68'}
                fontSize={7}
                fontWeight={isZero ? 900 : 700}
                pointerEvents="none"
              >
                {db > 0 ? `+${db}` : db}
              </text>
            </g>
          );
        })}

        {MAJOR_FREQS.map((hz) => {
          const x = studioEqHzToX(hz, w);
          return (
            <g key={hz}>
              <line
                x1={x}
                y1={STUDIO_EQ_PAD_T}
                x2={x}
                y2={plotBottom}
                stroke="rgba(255,255,255,0.045)"
                strokeWidth={1}
                pointerEvents="none"
              />
            </g>
          );
        })}

        {STUDIO_EQ_GRID_FREQS.map((hz) => {
          const x = studioEqHzToX(hz, w);
          return (
            <g key={`pill-${hz}`}>
              <rect
                x={x - 16}
                y={plotBottom + 2}
                width={32}
                height={16}
                rx={3}
                fill="#0c0e16"
                stroke="rgba(232,238,248,0.28)"
                strokeWidth={0.9}
                pointerEvents="none"
              />
              <text
                x={x}
                y={plotBottom + 13.5}
                textAnchor="middle"
                fill="#e8eef8"
                fontSize={9.5}
                fontWeight={900}
                pointerEvents="none"
              >
                {formatGridHz(hz)}
              </text>
            </g>
          );
        })}

        <path d={pathFill} fill={`url(#eqFill-${gradId})`} opacity={eq.enabled ? 0.95 : 0.35} pointerEvents="none" />
        <path
          d={pathStroke}
          fill="none"
          stroke={`url(#eqStroke-${gradId})`}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.35}
          pointerEvents="none"
        />
        <path
          d={pathStroke}
          fill="none"
          stroke={`url(#eqStroke-${gradId})`}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#eqGlow-${gradId})`}
          opacity={eq.enabled ? 1 : 0.45}
          pointerEvents="none"
        />

        {eq.bands.map((band, i) => {
          const colors = studioEqBandColor(i);
          const onCurve = dotOnCurve(band.freqHz, band.gainDb);
          const active = dragging === i;
          const pos = active && dragDotPos ? dragDotPos : onCurve;
          const label = studioEqFormatBandHz(band.freqHz);
          const gainLabel = `${band.gainDb > 0 ? '+' : ''}${band.gainDb.toFixed(1)}`;

          return (
            <g key={i}>
              {(active || Math.abs(band.gainDb) > 0.5) && (
                <line
                  x1={pos.x}
                  y1={zeroY}
                  x2={pos.x}
                  y2={pos.y}
                  stroke={colors.stroke}
                  strokeOpacity={active ? 0.45 : 0.22}
                  strokeWidth={1}
                  pointerEvents="none"
                />
              )}
              {active && (
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={7.5}
                  fill="none"
                  stroke={colors.stroke}
                  strokeOpacity={0.4}
                  strokeWidth={1}
                  pointerEvents="none"
                />
              )}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={5.5}
                fill={colors.fill}
                stroke="#0a1018"
                strokeWidth={active ? 2 : 1.5}
                style={{
                  cursor: eq.enabled ? (active ? 'grabbing' : 'grab') : 'not-allowed',
                }}
                onPointerDown={(e) => {
                  if (!eq.enabled) return;
                  e.preventDefault();
                  e.stopPropagation();
                  dragRef.current = { band: i, shiftQ: e.shiftKey };
                  setDragging(i);
                  setDragDotPos({ x: pos.x, y: pos.y });
                  (e.target as Element).setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  if (dragRef.current?.band !== i) return;
                  const svg = svgRef.current;
                  if (!svg) return;
                  const pt = clientToSvg(svg, e.clientX, e.clientY);
                  setDragDotPos({ x: pt.x, y: pt.y });
                  applyPointer(i, e.clientX, e.clientY, dragRef.current.shiftQ);
                }}
                onPointerUp={(e) => {
                  if (dragRef.current?.band !== i) return;
                  dragRef.current = null;
                  setDragging(null);
                  setDragDotPos(null);
                  try {
                    (e.target as Element).releasePointerCapture(e.pointerId);
                  } catch {
                    /* ignore */
                  }
                }}
              />
              {active && (
                <>
                  <rect
                    x={pos.x - 20}
                    y={pos.y - 24}
                    width={40}
                    height={13}
                    rx={4}
                    fill="#0a0a12"
                    stroke={colors.stroke}
                    strokeOpacity={0.65}
                    strokeWidth={1}
                    pointerEvents="none"
                  />
                  <text x={pos.x} y={pos.y - 14} textAnchor="middle" fill={colors.stroke} fontSize={6} fontWeight={800} pointerEvents="none">
                    {label} · {gainLabel}
                  </text>
                </>
              )}
            </g>
          );
        })}

        <rect
          x={STUDIO_EQ_PAD_L}
          y={STUDIO_EQ_PAD_T}
          width={innerW}
          height={plotH}
          fill="none"
          stroke="rgba(255,255,255,0.04)"
          strokeWidth={1}
          rx={3}
          pointerEvents="none"
        />
        <text x={STUDIO_EQ_PAD_L + 4} y={STUDIO_EQ_PAD_T + 9} fill="#5a5a68" fontSize={6.5} fontWeight={800} pointerEvents="none">
          {eq.enabled ? `${activeBands} ACTIVE` : 'BYPASS'}
        </text>
      </svg>
    </div>
  );
}
