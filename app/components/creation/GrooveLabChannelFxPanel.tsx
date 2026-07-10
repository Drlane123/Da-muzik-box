'use client';

import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';

import {
  PadFxHorizontalTCapSlider,
  PadFxVerticalFader,
} from '@/app/components/creation/PadSamplerFxWidgets';
import type { PadSamplerCompressorFx } from '@/app/lib/creationStation/padSamplerFxRack';
import {
  buildLogFreqs,
  clampGrooveLabEqBands,
  computeGrooveLabFxMagDb,
  FREQ_MAG_LEN,
  grooveLabEqBandColor,
  grooveLabFxDbToY,
  grooveLabFxGridDbLines,
  grooveLabFxGridFreqs,
  grooveLabFxHzToX,
  grooveLabFxXToHz,
  grooveLabFxYToDb,
  GROOVE_LAB_EQ_BAND_COUNT,
  GROOVE_LAB_FX_GRAPH_H,
  GROOVE_LAB_FX_GRAPH_W,
  GROOVE_LAB_FX_PAD_B,
  GROOVE_LAB_FX_PAD_L,
  GROOVE_LAB_FX_PAD_R,
  GROOVE_LAB_FX_PAD_T,
  magDbAtHz,
  type GrooveLabChannelCutoffFx,
  type GrooveLabChannelEqFx,
  type GrooveLabChannelFxRack,
  type GrooveLabEqBand,
} from '@/app/lib/creationStation/grooveLabChannelFxEq';

function clientToSvg(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const p = pt.matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}

function formatHz(hz: number): string {
  if (hz >= 1000) return `${(hz / 1000).toFixed(hz >= 10000 ? 0 : 1).replace(/\.0$/, '')}k`;
  return `${Math.round(hz)}`;
}

function formatGridHz(hz: number): string {
  if (hz >= 1000) return `${hz / 1000}K`;
  return String(hz);
}

const BAND_LABELS = ['L', 'LM', 'M', 'HM', 'H'] as const;

function GrooveLabFatEqGraph({
  rack,
  onBandsChange,
}: {
  rack: Pick<GrooveLabChannelFxRack, 'cutoff' | 'eq'>;
  onBandsChange: (bands: GrooveLabEqBand[]) => void;
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
    setMagDb(computeGrooveLabFxMagDb(freqs, rack));
  }, [rack]);

  const { pathStroke, pathFill } = useMemo(() => {
    const w = GROOVE_LAB_FX_GRAPH_W;
    const h = GROOVE_LAB_FX_GRAPH_H;
    const freqs = freqsRef.current;
    let d = '';
    if (freqs && freqs.length >= 2) {
      const x0 = grooveLabFxHzToX(freqs[0]!, w);
      const y0 = grooveLabFxDbToY(magDb[0] ?? 0, h);
      d = `M ${x0.toFixed(1)} ${y0.toFixed(1)}`;
      for (let i = 1; i < freqs.length; i += 1) {
        d += ` L ${grooveLabFxHzToX(freqs[i]!, w).toFixed(1)} ${grooveLabFxDbToY(magDb[i] ?? 0, h).toFixed(1)}`;
      }
    }
    const y0 = grooveLabFxDbToY(0, h);
    const firstX = freqs?.length ? grooveLabFxHzToX(freqs[0]!, w).toFixed(1) : String(GROOVE_LAB_FX_PAD_L);
    const lastX = freqs?.length
      ? grooveLabFxHzToX(freqs[freqs.length - 1]!, w).toFixed(1)
      : String(w - GROOVE_LAB_FX_PAD_R);
    return { pathStroke: d, pathFill: `${d} L ${lastX} ${y0.toFixed(1)} L ${firstX} ${y0.toFixed(1)} Z` };
  }, [magDb]);

  const freqs = freqsRef.current;
  const dotOnCurve = (hz: number, fallbackDb: number) => {
    const db = freqs ? magDbAtHz(freqs, magDb, hz) : fallbackDb;
    return { x: grooveLabFxHzToX(hz), y: grooveLabFxDbToY(db) };
  };

  const applyPointer = (bandIdx: number, clientX: number, clientY: number, shiftQ: boolean) => {
    const svg = svgRef.current;
    if (!svg) return;
    const { x, y } = clientToSvg(svg, clientX, clientY);
    const band = rack.eq.bands[bandIdx];
    if (!band) return;

    if (band.kind === 'peaking' && shiftQ) {
      const innerW = GROOVE_LAB_FX_GRAPH_W - GROOVE_LAB_FX_PAD_L - GROOVE_LAB_FX_PAD_R;
      const midX = grooveLabFxHzToX(band.freqHz);
      const dx = (x - midX) / Math.max(1, innerW);
      const nextQ = Math.max(0.35, Math.min(12, band.q - dx * 18));
      const next = rack.eq.bands.map((b, i) =>
        i === bandIdx ? { ...b, q: Math.round(nextQ * 20) / 20 } : b,
      );
      onBandsChange(clampGrooveLabEqBands(next));
      return;
    }

    const hz = grooveLabFxXToHz(x);
    const gainDb = Math.round(grooveLabFxYToDb(y) * 2) / 2;
    const next = rack.eq.bands.map((b, i) =>
      i === bandIdx ? { ...b, freqHz: hz, gainDb } : b,
    );
    onBandsChange(clampGrooveLabEqBands(next));
  };

  const w = GROOVE_LAB_FX_GRAPH_W;
  const h = GROOVE_LAB_FX_GRAPH_H;
  const zeroY = grooveLabFxDbToY(0, h);

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
        aria-label="Fat EQ — drag band dots on the curve"
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#818cf8" stopOpacity={0.1} />
            <stop offset="50%" stopColor="#c4b5fd" stopOpacity={0.26} />
            <stop offset="100%" stopColor="#7cf4c6" stopOpacity={0.1} />
          </linearGradient>
        </defs>
        <rect
          x={0}
          y={0}
          width={w}
          height={h}
          fill="rgba(6,8,12,0.97)"
          rx={5}
          stroke="rgba(129,140,248,0.32)"
          strokeWidth={1}
        />

        {grooveLabFxGridDbLines().map((db) => {
          const y = grooveLabFxDbToY(db, h);
          const isZero = db === 0;
          return (
            <g key={db}>
              <line
                x1={GROOVE_LAB_FX_PAD_L}
                y1={y}
                x2={w - GROOVE_LAB_FX_PAD_R}
                y2={y}
                stroke={isZero ? 'rgba(124,244,198,0.32)' : 'rgba(255,255,255,0.055)'}
                strokeWidth={1}
                strokeDasharray={isZero ? '4 5' : undefined}
              />
              <text
                x={4}
                y={y + 3}
                fill={isZero ? '#7cf4c6' : '#64748b'}
                fontSize={7}
                fontWeight={isZero ? 900 : 700}
                opacity={isZero ? 0.95 : 0.75}
              >
                {db > 0 ? `+${db}` : db}
              </text>
            </g>
          );
        })}

        {grooveLabFxGridFreqs().map((hz) => {
          const x = grooveLabFxHzToX(hz, w);
          return (
            <g key={hz}>
              <line
                x1={x}
                y1={GROOVE_LAB_FX_PAD_T}
                x2={x}
                y2={h - GROOVE_LAB_FX_PAD_B}
                stroke="rgba(255,255,255,0.05)"
                strokeWidth={1}
              />
              <text
                x={x - 8}
                y={h - 5}
                fill="#64748b"
                fontSize={7}
                fontWeight={800}
              >
                {formatGridHz(hz)}
              </text>
            </g>
          );
        })}

        {rack.cutoff.enabled ? (
          <>
            <line
              x1={grooveLabFxHzToX(rack.cutoff.lowCutHz, w)}
              y1={GROOVE_LAB_FX_PAD_T}
              x2={grooveLabFxHzToX(rack.cutoff.lowCutHz, w)}
              y2={h - GROOVE_LAB_FX_PAD_B}
              stroke="rgba(251,191,36,0.35)"
              strokeWidth={1}
              strokeDasharray="2 4"
            />
            <line
              x1={grooveLabFxHzToX(rack.cutoff.highCutHz, w)}
              y1={GROOVE_LAB_FX_PAD_T}
              x2={grooveLabFxHzToX(rack.cutoff.highCutHz, w)}
              y2={h - GROOVE_LAB_FX_PAD_B}
              stroke="rgba(251,191,36,0.35)"
              strokeWidth={1}
              strokeDasharray="2 4"
            />
          </>
        ) : null}

        <path d={pathFill} fill={`url(#${gradId})`} opacity={0.88} />
        <path
          d={pathStroke}
          fill="none"
          stroke="#c4b5fd"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {rack.eq.enabled
          ? rack.eq.bands.slice(0, GROOVE_LAB_EQ_BAND_COUNT).map((band, i) => {
          const colors = grooveLabEqBandColor(i);
          const onLine = dotOnCurve(band.freqHz, band.gainDb);
          const active = dragging === i;
          const pos = active && dragDotPos ? dragDotPos : onLine;
          return (
            <g key={i}>
              <line
                x1={pos.x}
                y1={zeroY}
                x2={pos.x}
                y2={pos.y}
                stroke={colors.stroke}
                strokeWidth={1}
                strokeOpacity={0.35}
                pointerEvents="none"
              />
              <circle
                cx={pos.x}
                cy={pos.y}
                r={active ? 7 : 5.5}
                fill={colors.fill}
                stroke={active ? '#fff' : colors.stroke}
                strokeWidth={active ? 2 : 1.5}
                style={{ cursor: active ? 'grabbing' : 'grab', touchAction: 'none' }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const svg = svgRef.current;
                  if (svg) setDragDotPos(clientToSvg(svg, e.clientX, e.clientY));
                  dragRef.current = { band: i, shiftQ: e.shiftKey };
                  setDragging(i);
                  e.currentTarget.setPointerCapture(e.pointerId);
                  applyPointer(i, e.clientX, e.clientY, e.shiftKey);
                }}
                onPointerMove={(e) => {
                  if (dragRef.current?.band !== i) return;
                  const svg = svgRef.current;
                  if (svg && !e.shiftKey) setDragDotPos(clientToSvg(svg, e.clientX, e.clientY));
                  applyPointer(i, e.clientX, e.clientY, e.shiftKey);
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
        })
          : null}
      </svg>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          marginTop: 5,
          fontSize: 8,
          color: '#94a3b8',
          fontWeight: 700,
          lineHeight: 1.35,
        }}
      >
        {rack.eq.bands.slice(0, GROOVE_LAB_EQ_BAND_COUNT).map((band, i) => (
          <span key={i} style={{ color: grooveLabEqBandColor(i).stroke }}>
            {BAND_LABELS[i]} {formatHz(band.freqHz)} {band.gainDb >= 0 ? '+' : ''}
            {band.gainDb.toFixed(1)}dB
            {band.kind === 'peaking' ? ` Q${band.q.toFixed(1)}` : ''}
          </span>
        ))}
      </div>
      <div style={{ marginTop: 3, fontSize: 8, color: '#64748b', fontWeight: 700 }}>
        Drag dot: ↔ freq · ↕ gain · Shift+drag peak = Q
      </div>
    </div>
  );
}

function FxToggle({
  on,
  onClick,
  onLabel,
  offLabel,
  borderOn,
  bgOn,
  textOn,
}: {
  on: boolean;
  onClick: () => void;
  onLabel: string;
  offLabel: string;
  borderOn: string;
  bgOn: string;
  textOn: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontSize: 10,
        fontWeight: 800,
        padding: '4px 10px',
        borderRadius: 4,
        marginBottom: 8,
        border: `1px solid ${on ? borderOn : '#444'}`,
        background: on ? bgOn : '#101014',
        color: on ? textOn : '#b8bfd0',
        cursor: 'pointer',
      }}
    >
      {on ? onLabel : offLabel}
    </button>
  );
}

export type GrooveLabChannelFxPanelProps = {
  rack: GrooveLabChannelFxRack;
  onCutoffChange: (next: Partial<GrooveLabChannelCutoffFx>) => void;
  onEqChange: (next: Partial<GrooveLabChannelEqFx> & { bands?: Array<Partial<GrooveLabEqBand>> }) => void;
  onCompChange: (next: Partial<PadSamplerCompressorFx>) => void;
};

export function GrooveLabChannelFxPanel({ rack, onCutoffChange, onEqChange, onCompChange }: GrooveLabChannelFxPanelProps) {
  const compBank = rack.compressor.enabled ? (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'flex-start',
        gap: 8,
        flexWrap: 'wrap',
        paddingTop: 4,
      }}
    >
      <PadFxVerticalFader
        label="THR"
        min={-48}
        max={0}
        step={1}
        value={rack.compressor.thresholdDb}
        onChange={(thresholdDb) => onCompChange({ thresholdDb })}
        format={(v) => `${Math.round(v)} dB`}
        accent="#cbd5f5"
      />
      <PadFxVerticalFader
        label="RATIO"
        min={1}
        max={20}
        step={1}
        value={rack.compressor.ratio}
        onChange={(ratio) => onCompChange({ ratio })}
        format={(v) => `1:${Math.round(v)}`}
        accent="#94a3b8"
      />
      <PadFxVerticalFader
        label="KNEE"
        min={0}
        max={32}
        step={1}
        value={Math.min(rack.compressor.kneeDb, 32)}
        onChange={(kneeDb) => onCompChange({ kneeDb })}
        format={(v) => `${Math.round(v)}`}
        accent="#64748b"
      />
      <PadFxVerticalFader
        label="ATK"
        min={0.0005}
        max={0.25}
        step={0.0005}
        value={Math.min(rack.compressor.attackSec, 0.25)}
        onChange={(attackSec) => onCompChange({ attackSec })}
        format={(v) => `${Math.round(v * 1000)} ms`}
        accent="#a78bfa"
      />
      <PadFxVerticalFader
        label="REL"
        min={0.02}
        max={1.2}
        step={0.01}
        value={Math.min(rack.compressor.releaseSec, 1.2)}
        onChange={(releaseSec) => onCompChange({ releaseSec })}
        format={(v) => (v < 0.2 ? `${Math.round(v * 1000)} ms` : `${v.toFixed(2)} s`)}
        accent="#a78bfa"
      />
      <PadFxVerticalFader
        label="MKUP"
        min={0}
        max={18}
        step={0.5}
        value={rack.compressor.makeupDb}
        onChange={(makeupDb) => onCompChange({ makeupDb })}
        format={(v) => `+${v.toFixed(1)}`}
        accent="#7cf4c6"
      />
    </div>
  ) : null;

  return (
    <div>
      <div style={{ fontSize: 10, color: '#fbbf24', fontWeight: 900, letterSpacing: 0.65, marginBottom: 8 }}>
        CUTOFF
      </div>
      <FxToggle
        on={rack.cutoff.enabled}
        onClick={() => onCutoffChange({ enabled: !rack.cutoff.enabled })}
        onLabel="CUTOFF ON"
        offLabel="CUTOFF OFF"
        borderOn="rgba(251, 191, 36, 0.55)"
        bgOn="rgba(251, 191, 36, 0.14)"
        textOn="#fde68a"
      />
      {rack.cutoff.enabled ? (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 9, color: '#fde68a', fontWeight: 800, marginBottom: 4 }}>LOW CUT (HPF)</div>
          <PadFxHorizontalTCapSlider
            min={20}
            max={800}
            step={1}
            value={rack.cutoff.lowCutHz}
            onChange={(lowCutHz) => onCutoffChange({ lowCutHz })}
            accent="#fbbf24"
            ariaLabel="Low cut frequency"
          />
          <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, marginBottom: 8 }}>
            {formatHz(rack.cutoff.lowCutHz)} Hz
          </div>
          <div style={{ fontSize: 9, color: '#fde68a', fontWeight: 800, marginBottom: 4 }}>HIGH CUT (LPF)</div>
          <PadFxHorizontalTCapSlider
            min={400}
            max={18000}
            step={10}
            value={rack.cutoff.highCutHz}
            onChange={(highCutHz) => onCutoffChange({ highCutHz })}
            accent="#fbbf24"
            ariaLabel="High cut frequency"
          />
          <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700 }}>{formatHz(rack.cutoff.highCutHz)} Hz</div>
        </div>
      ) : null}

      <div style={{ fontSize: 10, color: '#c7d2fe', fontWeight: 900, letterSpacing: 0.65, marginTop: 4, marginBottom: 8 }}>
        FAT EQ · 5 BAND
      </div>
      <FxToggle
        on={rack.eq.enabled}
        onClick={() => onEqChange({ enabled: !rack.eq.enabled })}
        onLabel="EQ ON"
        offLabel="EQ OFF"
        borderOn="rgba(129, 140, 248, 0.55)"
        bgOn="rgba(129, 140, 248, 0.16)"
        textOn="#e0e7ff"
      />
      {rack.cutoff.enabled || rack.eq.enabled ? (
        <div
          style={{
            borderRadius: 6,
            overflow: 'hidden',
            border: '1px solid rgba(129, 140, 248, 0.25)',
            marginBottom: 8,
          }}
        >
          <GrooveLabFatEqGraph
            rack={rack}
            onBandsChange={(bands) => onEqChange({ bands })}
          />
        </div>
      ) : null}

      <div style={{ fontSize: 10, color: '#c7d2fe', fontWeight: 900, letterSpacing: 0.65, marginTop: 12, marginBottom: 8 }}>
        COMPRESSOR
      </div>
      <FxToggle
        on={rack.compressor.enabled}
        onClick={() => onCompChange({ enabled: !rack.compressor.enabled })}
        onLabel="COMP ON"
        offLabel="COMP OFF"
        borderOn="rgba(124, 244, 198, 0.45)"
        bgOn="rgba(124, 244, 198, 0.1)"
        textOn="#a7f3d0"
      />
      {compBank}
    </div>
  );
}
