'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GripHorizontal, Power, X } from 'lucide-react';

import { FxSuiteChromeFrame, SuiteFader } from '@/app/components/studio/studioFxSuiteWidgets';
import { useStudioFloatingPanelDrag } from '@/app/components/studio/useStudioFloatingPanelDrag';
import {
  cloneStudioTrackInsertFxRack,
  studioTrackInsertFxRacksEqual,
  type StudioTrackInsertFxRack,
} from '@/app/lib/studio/studioTrackInsertFx';
import {
  SPECTRUM_FORGE_BAND_LABELS,
  SPECTRUM_FORGE_BOOST_MAX_DB,
  SPECTRUM_FORGE_SUB_DRIVE_MAX,
  spectrumForgeFormatHz,
  studioSpectrumForgeBandAdjusted,
  type StudioSpectrumForgeBandId,
  type StudioSpectrumForgeFx,
} from '@/app/lib/studio/studioSpectrumForge';
import {
  spectrumForgeBandLiveLevel,
  spectrumForgeMeterDisplayLinear,
  spectrumForgeReadLogColumn,
} from '@/app/lib/studio/studioSpectrumForgeAnalyzer';
import {
  readSpectrumForgeMeterSnapshot,
  setSpectrumForgeFx,
} from '@/app/lib/studio/studioSpectrumForgeBus';
import { studioMeterBallistics } from '@/app/lib/studio/studioTrackAnalyserBus';
import { SUITE_FONT_FAMILY } from '@/app/lib/studio/studioUiTypography';
import '@/app/styles/studioSpectrumForge.css';

const PANEL_W = 580;
const PANEL_Z = 30068;
const VIEWPORT_PAD = 10;
const PANEL_EST_H = 500;
const BAND_IDS: StudioSpectrumForgeBandId[] = ['low', 'mid', 'high'];
const VU_BAR_COUNT = 48;
const EQ_CENTER_NORM = 0.5;
const METER_HALF_SPAN = 0.42;
const GRAPH_BG = '#08090c';
const GRAPH_GRID = 'rgba(255,255,255,0.07)';
const METER_BLUE = '#4da8f0';
const METER_BLUE_BRIGHT = '#7ec8ff';
const METER_BLUE_CUT = '#2a6fa8';
const METER_TRACK = 'rgba(40, 80, 120, 0.5)';
const METER_TRACK_FILL = 'rgba(20, 40, 60, 0.55)';

const DB_GRID_LABELS = ['+6', '+3', '0', '−3', '−6'] as const;

function meterColumnX(padL: number, plotW: number, bandIndex: number): number {
  return padL + ((bandIndex * 2 + 1) / 6) * plotW;
}

function bandAtPointerX(
  clientX: number,
  rectLeft: number,
  padL: number,
  plotW: number,
): StudioSpectrumForgeBandId | null {
  const x = clientX - rectLeft;
  let nearest: StudioSpectrumForgeBandId | null = null;
  let best = Infinity;
  for (let i = 0; i < BAND_IDS.length; i++) {
    const cx = meterColumnX(padL, plotW, i);
    const d = Math.abs(x - cx);
    if (d < plotW / 7 && d < best) {
      best = d;
      nearest = BAND_IDS[i]!;
    }
  }
  return nearest;
}

function boostDbFromPointerY(
  clientY: number,
  rectTop: number,
  padT: number,
  plotH: number,
): number {
  const centerY = padT + plotH * EQ_CENTER_NORM;
  const delta = (centerY - (clientY - rectTop)) / (plotH * METER_HALF_SPAN);
  return Math.max(
    -SPECTRUM_FORGE_BOOST_MAX_DB,
    Math.min(SPECTRUM_FORGE_BOOST_MAX_DB, delta * SPECTRUM_FORGE_BOOST_MAX_DB),
  );
}

function drawSpectrumForgeGraph(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  fx: StudioSpectrumForgeFx,
  dragBand: StudioSpectrumForgeBandId | null,
  vuLevels: Float32Array,
  bandLive: Record<StudioSpectrumForgeBandId, number>,
  hasSignal: boolean,
  meterPostEq: boolean,
) {
  const padL = 28;
  const padR = 36;
  const padT = 22;
  const padB = 30;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const plotBottom = padT + plotH;
  const centerY = padT + plotH * EQ_CENTER_NORM;
  const meterW = Math.max(22, plotW / 9);
  const vuBarW = Math.max(3, plotW / VU_BAR_COUNT - 1);

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = GRAPH_BG;
  ctx.fillRect(0, 0, w, h);

  const bg = ctx.createLinearGradient(0, padT, 0, plotBottom);
  bg.addColorStop(0, '#0e1218');
  bg.addColorStop(1, '#06080c');
  ctx.fillStyle = bg;
  ctx.fillRect(padL - 8, padT, plotW + 16, plotH);

  // —— Live VU bars across full width (mixer-style) ——
  for (let i = 0; i < VU_BAR_COUNT; i++) {
    const level = vuLevels[i] ?? 0;
    const x = padL + (i / Math.max(1, VU_BAR_COUNT - 1)) * (plotW - vuBarW);
    const barH = level * plotH * 0.92;
    if (barH < 1) continue;
    const y = plotBottom - barH;
    const grad = ctx.createLinearGradient(0, y, 0, plotBottom);
    grad.addColorStop(0, METER_BLUE_BRIGHT);
    grad.addColorStop(0.35, METER_BLUE);
    grad.addColorStop(1, METER_BLUE_CUT);
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, vuBarW, barH);
    if (level > 0.55) {
      ctx.fillStyle = 'rgba(126, 200, 255, 0.35)';
      ctx.fillRect(x, y, vuBarW, Math.min(4, barH));
    }
  }

  for (let g = 0; g < DB_GRID_LABELS.length; g++) {
    const y = padT + (g / (DB_GRID_LABELS.length - 1)) * plotH;
    ctx.strokeStyle = GRAPH_GRID;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL - 4, y);
    ctx.lineTo(w - padR + 4, y);
    ctx.stroke();
    ctx.fillStyle = g === 2 ? 'rgba(200, 215, 235, 0.85)' : 'rgba(130, 150, 170, 0.65)';
    ctx.font = `7px ${SUITE_FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.fillText(`${DB_GRID_LABELS[g]} dB`, w - padR + 6, y + 3);
  }

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(padL - 4, centerY);
  ctx.lineTo(w - padR + 4, centerY);
  ctx.stroke();
  ctx.setLineDash([]);

  for (let i = 0; i < BAND_IDS.length; i++) {
    const id = BAND_IDS[i]!;
    const band = fx[id];
    const cx = meterColumnX(padL, plotW, i);
    const x0 = cx - meterW / 2;
    const dragging = dragBand === id;
    const lit = fx.enabled && studioSpectrumForgeBandAdjusted(fx, id);
    const boostNorm = band.boostDb / SPECTRUM_FORGE_BOOST_MAX_DB;
    const nodeY = centerY - boostNorm * METER_HALF_SPAN * plotH;
    const barTop = Math.min(centerY, nodeY);
    const barH = Math.abs(nodeY - centerY);

    ctx.fillStyle = 'rgba(8, 12, 18, 0.72)';
    ctx.fillRect(x0 - 2, padT + 2, meterW + 4, plotH - 4);

    ctx.fillStyle = METER_TRACK_FILL;
    ctx.strokeStyle = METER_TRACK;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x0, padT + 4, meterW, plotH - 8, 3);
    ctx.fill();
    ctx.stroke();

    const liveNorm = Math.max(0, Math.min(1, bandLive[id] ?? 0));
    if (hasSignal && liveNorm > 0.02) {
      const liveH = liveNorm * (plotH - 8) * 0.88;
      const liveY = plotBottom - 4 - liveH;
      const liveGrad = ctx.createLinearGradient(0, liveY, 0, plotBottom - 4);
      liveGrad.addColorStop(0, 'rgba(77, 168, 240, 0.08)');
      liveGrad.addColorStop(1, 'rgba(77, 168, 240, 0.42)');
      ctx.fillStyle = liveGrad;
      ctx.beginPath();
      ctx.roundRect(x0 + 2, liveY, meterW - 4, liveH, 2);
      ctx.fill();
    }

    if (lit && barH > 0.5) {
      const grad = ctx.createLinearGradient(0, barTop, 0, barTop + barH);
      if (band.boostDb >= 0) {
        grad.addColorStop(0, METER_BLUE_BRIGHT);
        grad.addColorStop(1, METER_BLUE);
      } else {
        grad.addColorStop(0, METER_BLUE);
        grad.addColorStop(1, METER_BLUE_CUT);
      }
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x0 + 3, barTop, meterW - 6, barH, 2);
      ctx.fill();
    }

    const handleR = dragging ? 7 : 5.5;
    ctx.beginPath();
    ctx.arc(cx, nodeY, handleR, 0, Math.PI * 2);
    ctx.fillStyle = fx.enabled ? METER_BLUE_BRIGHT : '#3a4550';
    ctx.fill();
    ctx.strokeStyle = dragging ? '#fff' : METER_BLUE;
    ctx.lineWidth = dragging ? 2 : 1.25;
    ctx.stroke();

    if (lit) {
      ctx.shadowColor = METER_BLUE;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(cx, nodeY, handleR + 2, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(77, 168, 240, 0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.fillStyle = lit ? METER_BLUE_BRIGHT : 'rgba(120, 140, 160, 0.75)';
    ctx.font = `bold 8px ${SUITE_FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.fillText(SPECTRUM_FORGE_BAND_LABELS[id], cx, plotBottom + 14);

    ctx.font = `7px ${SUITE_FONT_FAMILY}`;
    ctx.fillStyle = lit ? 'rgba(210, 225, 245, 0.9)' : 'rgba(100, 115, 130, 0.7)';
    const dbLabel = `${band.boostDb >= 0 ? '+' : ''}${band.boostDb.toFixed(1)}`;
    ctx.fillText(dbLabel, cx, padT - 6);
    ctx.fillStyle = 'rgba(90, 110, 130, 0.75)';
    ctx.fillText(spectrumForgeFormatHz(band.centerHz), cx, padT - 16);
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = fx.enabled ? 'rgba(77, 168, 240, 0.9)' : 'rgba(90, 105, 120, 0.55)';
  ctx.font = `bold 7px ${SUITE_FONT_FAMILY}`;
  ctx.fillText(fx.enabled ? 'EQ ON' : 'EQ OFF', padL, 12);
  ctx.fillStyle = hasSignal ? 'rgba(77, 168, 240, 0.75)' : 'rgba(90, 105, 120, 0.45)';
  ctx.fillText(
    hasSignal ? (meterPostEq ? '· EQ OUT' : '· INPUT') : '· WAITING',
    padL + 44,
    12,
  );
}

function clampPanelPos(anchor: DOMRect | null, panelH: number): { top: number; left: number } {
  if (!anchor) return { top: 80, left: Math.max(VIEWPORT_PAD, (window.innerWidth - PANEL_W) / 2) };
  const gap = 10;
  let left = anchor.left - PANEL_W + anchor.width;
  if (left < VIEWPORT_PAD) left = anchor.right + gap;
  if (left + PANEL_W > window.innerWidth - VIEWPORT_PAD) {
    left = Math.max(VIEWPORT_PAD, (window.innerWidth - PANEL_W) / 2);
  }
  let top = anchor.bottom + gap;
  if (top + panelH > window.innerHeight - VIEWPORT_PAD) {
    top = Math.max(VIEWPORT_PAD, anchor.top - panelH - gap);
  }
  if (top < VIEWPORT_PAD) top = VIEWPORT_PAD;
  return { top, left };
}

export type StudioSpectrumForgePanelProps = {
  open: boolean;
  channelLabel: string;
  accentHex?: string;
  anchorRect: DOMRect | null;
  rack: StudioTrackInsertFxRack;
  onRackChange: (next: StudioTrackInsertFxRack) => void;
  onClose: () => void;
  onRegisterFlush?: (flush: (() => void) | null) => void;
  trackIndex?: number;
};

function patchForge(rack: StudioTrackInsertFxRack, patch: Partial<StudioSpectrumForgeFx>): StudioTrackInsertFxRack {
  return { ...rack, spectrumForge: { ...rack.spectrumForge, ...patch } };
}

function patchBand(
  rack: StudioTrackInsertFxRack,
  id: StudioSpectrumForgeBandId,
  patch: Partial<StudioSpectrumForgeFx['low']>,
): StudioTrackInsertFxRack {
  return {
    ...rack,
    spectrumForge: { ...rack.spectrumForge, [id]: { ...rack.spectrumForge[id], ...patch } },
  };
}

/** Mini meter — live band level (back) + EQ gain trim (front). */
function SpectrumForgeBandMeter({
  boostDb,
  enabled,
  liveLevel,
  hasSignal,
}: {
  boostDb: number;
  enabled: boolean;
  liveLevel: number;
  hasSignal: boolean;
}) {
  const norm = boostDb / SPECTRUM_FORGE_BOOST_MAX_DB;
  const pct = Math.abs(norm) * 50;
  const isBoost = boostDb >= 0;
  const livePct = hasSignal ? Math.max(0, Math.min(100, liveLevel * 100)) : 0;
  return (
    <div className="ssf-band__meter" aria-hidden>
      <div className="ssf-band__meter-track">
        <div className="ssf-band__meter-zero" />
        {livePct > 2 ? (
          <div
            className="ssf-band__meter-live"
            style={{ bottom: 0, height: `${livePct}%` }}
          />
        ) : null}
        {enabled && pct > 0.5 ? (
          <div
            className={`ssf-band__meter-fill${isBoost ? '' : ' ssf-band__meter-fill--cut'}`}
            style={isBoost ? { bottom: '50%', height: `${pct}%` } : { top: '50%', height: `${pct}%` }}
          />
        ) : null}
      </div>
    </div>
  );
}

export function StudioSpectrumForgePanel({
  open,
  channelLabel,
  accentHex = '#ff8c42',
  anchorRect,
  rack,
  onRackChange,
  onClose,
  onRegisterFlush,
  trackIndex = 0,
}: StudioSpectrumForgePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [draftRack, setDraftRack] = useState(() => cloneStudioTrackInsertFxRack(rack));
  const draftRef = useRef(draftRack);
  const rackPropRef = useRef(rack);
  const dragBandRef = useRef<StudioSpectrumForgeBandId | null>(null);
  const [dragBand, setDragBand] = useState<StudioSpectrumForgeBandId | null>(null);
  const vuLevelsRef = useRef(new Float32Array(VU_BAR_COUNT));
  const bandLiveRef = useRef<Record<StudioSpectrumForgeBandId, number>>({
    low: 0,
    mid: 0,
    high: 0,
  });
  const spectrumScratchRef = useRef(new Float32Array(0));
  const hasSignalRef = useRef(false);
  const meterPostEqRef = useRef(false);
  const [, setMeterFrame] = useState(0);
  const meterFrameSkipRef = useRef(0);

  draftRef.current = draftRack;
  rackPropRef.current = rack;
  const forge = draftRack.spectrumForge;

  const resolveInitialPos = useCallback(() => clampPanelPos(anchorRect, PANEL_EST_H), [anchorRect]);

  const { pos, dragging, dragHandleProps } = useStudioFloatingPanelDrag({
    open,
    resolveInitialPos,
    panelRef,
    viewportPad: VIEWPORT_PAD,
  });

  const onRackChangeRef = useRef(onRackChange);
  onRackChangeRef.current = onRackChange;

  useEffect(() => {
    if (!open) return;
    const synced = cloneStudioTrackInsertFxRack(rackPropRef.current);
    draftRef.current = synced;
    rackPropRef.current = synced;
    setDraftRack(synced);
    setSpectrumForgeFx(trackIndex, synced.spectrumForge);
  }, [open, trackIndex]);

  const pushParent = useCallback((next: StudioTrackInsertFxRack) => {
    const cloned = cloneStudioTrackInsertFxRack(next);
    draftRef.current = cloned;
    setSpectrumForgeFx(trackIndex, cloned.spectrumForge);
    if (studioTrackInsertFxRacksEqual(cloned, rackPropRef.current)) return;
    rackPropRef.current = cloned;
    onRackChangeRef.current(cloned);
  }, [trackIndex]);

  const flush = useCallback(() => {
    const next = cloneStudioTrackInsertFxRack(draftRef.current);
    pushParent(next);
  }, [pushParent]);

  useEffect(() => {
    onRegisterFlush?.(open ? flush : null);
    return () => onRegisterFlush?.(null);
  }, [open, flush, onRegisterFlush]);

  const setForge = useCallback((patch: Partial<StudioSpectrumForgeFx>) => {
    setDraftRack((prev) => {
      const next = patchForge(prev, patch);
      draftRef.current = next;
      pushParent(next);
      return next;
    });
  }, [pushParent]);

  const setBand = useCallback((id: StudioSpectrumForgeBandId, patch: Partial<StudioSpectrumForgeFx['low']>) => {
    setDraftRack((prev) => {
      const next = patchBand(prev, id, patch);
      draftRef.current = next;
      pushParent(next);
      return next;
    });
  }, [pushParent]);

  useLayoutEffect(() => {
    const wrap = graphRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const sync = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (w < 1 || h < 1) return;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const vu = vuLevelsRef.current;
    let raf = 0;
    const draw = () => {
      const snap = readSpectrumForgeMeterSnapshot(trackIndex, spectrumScratchRef.current);
      const live = snap?.hasSignal ?? false;
      hasSignalRef.current = live;
      meterPostEqRef.current = snap?.postEq ?? false;

      const bandLive = bandLiveRef.current;
      const nyquist = 24000;
      if (snap && snap.spectrum.length > 0) {
        for (let i = 0; i < VU_BAR_COUNT; i++) {
          const norm = i / Math.max(1, VU_BAR_COUNT - 1);
          const raw = live
            ? spectrumForgeReadLogColumn(snap.spectrum, norm, VU_BAR_COUNT, nyquist)
            : 0;
          const target = live ? spectrumForgeMeterDisplayLinear(raw) : 0;
          vu[i] = studioMeterBallistics(vu[i] ?? 0, target, live);
        }
        const forgeFx = draftRef.current.spectrumForge;
        for (const id of BAND_IDS) {
          const raw = live
            ? spectrumForgeBandLiveLevel(snap.spectrum, forgeFx[id].centerHz, id, nyquist)
            : 0;
          const display = spectrumForgeMeterDisplayLinear(raw);
          bandLive[id] = studioMeterBallistics(bandLive[id] ?? 0, display, live);
        }
      } else if (!live) {
        for (let i = 0; i < VU_BAR_COUNT; i++) {
          vu[i] = studioMeterBallistics(vu[i] ?? 0, 0, false);
        }
        for (const id of BAND_IDS) {
          bandLive[id] = studioMeterBallistics(bandLive[id] ?? 0, 0, false);
        }
      }

      const w = canvas.width;
      const h = canvas.height;
      if (w >= 1 && h >= 1) {
        drawSpectrumForgeGraph(
          ctx,
          w,
          h,
          draftRef.current.spectrumForge,
          dragBandRef.current,
          vu,
          bandLiveRef.current,
          hasSignalRef.current,
          meterPostEqRef.current,
        );
      }
      meterFrameSkipRef.current += 1;
      if (meterFrameSkipRef.current >= 4) {
        meterFrameSkipRef.current = 0;
        setMeterFrame((n) => n + 1);
      }
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [open, trackIndex]);

  const plotGeom = useCallback(() => {
    const wrap = graphRef.current;
    if (!wrap) return null;
    const padL = 28;
    const padR = 36;
    const padT = 22;
    const padB = 30;
    const plotW = wrap.clientWidth - padL - padR;
    const plotH = wrap.clientHeight - padT - padB;
    return { padL, padR, padT, padB, plotW, plotH };
  }, []);

  const onGraphPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const geom = plotGeom();
    if (!geom) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nearest = bandAtPointerX(e.clientX, rect.left, geom.padL, geom.plotW);
    if (!nearest) return;
    dragBandRef.current = nearest;
    setDragBand(nearest);
    e.currentTarget.setPointerCapture(e.pointerId);
    const boostDb = boostDbFromPointerY(e.clientY, rect.top, geom.padT, geom.plotH);
    setBand(nearest, { boostDb });
  }, [plotGeom, setBand]);

  const onGraphPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const id = dragBandRef.current;
    const geom = plotGeom();
    if (!id || !geom) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const boostDb = boostDbFromPointerY(e.clientY, rect.top, geom.padT, geom.plotH);
    setBand(id, { boostDb });
  }, [plotGeom, setBand]);

  const onGraphPointerUp = useCallback(() => {
    dragBandRef.current = null;
    setDragBand(null);
  }, []);

  if (!open) return null;

  return createPortal(
    <div
      ref={panelRef}
      className="ssf-panel"
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        width: PANEL_W,
        zIndex: PANEL_Z,
        fontFamily: SUITE_FONT_FAMILY,
      }}
    >
      <FxSuiteChromeFrame className="ssf-panel__frame">
        <div className="ssf-panel__header" {...dragHandleProps} style={{ cursor: dragging ? 'grabbing' : 'grab' }}>
          <GripHorizontal size={14} style={{ color: '#5a5a68', flexShrink: 0 }} />
          <div className="min-w-0 flex-1">
            <div className="ssf-panel__title">Spectrum Forge</div>
            <div className="ssf-panel__subtitle">{channelLabel} · serial L/M/H EQ · meters show input, then EQ out</div>
          </div>
          <button
            type="button"
            className={`ssf-panel__power${forge.enabled ? ' is-on' : ''}`}
            onClick={() => setForge({ enabled: !forge.enabled })}
          >
            <Power size={12} />
          </button>
          <button type="button" className="ssf-panel__close" onClick={onClose} aria-label="Close">
            <X size={14} />
          </button>
        </div>

        <div
          ref={graphRef}
          className="ssf-zl-graph"
          onPointerDown={onGraphPointerDown}
          onPointerMove={onGraphPointerMove}
          onPointerUp={onGraphPointerUp}
          onPointerCancel={onGraphPointerUp}
        >
          <canvas ref={canvasRef} className="ssf-zl-graph__canvas" />
          <div className="ssf-zl-graph__hint">
            {dragBand
              ? `${SPECTRUM_FORGE_BAND_LABELS[dragBand]} · ${forge[dragBand].boostDb >= 0 ? '+' : ''}${forge[dragBand].boostDb.toFixed(1)} dB`
              : forge.enabled
                ? 'Drag LO / MID / HI — up = boost · down = cut'
                : 'Meters show input — power on to apply EQ'}
          </div>
        </div>

        <div className="ssf-bands">
          {BAND_IDS.map((id) => {
            const band = forge[id];
            const lit = forge.enabled && studioSpectrumForgeBandAdjusted(forge, id);
            const liveLevel = bandLiveRef.current[id] ?? 0;
            return (
              <div
                key={id}
                className={`ssf-band${lit ? ' ssf-band--lit' : ''}`}
              >
                <div className="ssf-band__head">
                  {SPECTRUM_FORGE_BAND_LABELS[id]}
                  <span className="ssf-band__hz">{spectrumForgeFormatHz(band.centerHz)}</span>
                </div>
                <SpectrumForgeBandMeter
                  boostDb={band.boostDb}
                  enabled={lit}
                  liveLevel={liveLevel}
                  hasSignal={hasSignalRef.current || liveLevel > 0.02}
                />
                <SuiteFader
                  label="GAIN"
                  value={band.boostDb}
                  min={-SPECTRUM_FORGE_BOOST_MAX_DB}
                  max={SPECTRUM_FORGE_BOOST_MAX_DB}
                  step={0.1}
                  format={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}`}
                  accent={METER_BLUE}
                  faderHeight={58}
                  onChange={(boostDb) => setBand(id, { boostDb })}
                />
                {id === 'low' ? (
                  <SuiteFader
                    label="SUB"
                    value={band.subDrive}
                    min={0}
                    max={SPECTRUM_FORGE_SUB_DRIVE_MAX}
                    step={0.01}
                    format={(v) => `${Math.round(v * 100)}%`}
                    accent={METER_BLUE}
                    faderHeight={58}
                    onChange={(subDrive) => setBand(id, { subDrive })}
                  />
                ) : (
                  <div className="ssf-band__spacer" />
                )}
              </div>
            );
          })}
        </div>

        <div className="ssf-footer">
          <SuiteFader
            label="WET"
            value={forge.mix}
            min={0}
            max={1}
            step={0.01}
            format={(v) => `${Math.round(v * 100)}%`}
            accent={accentHex}
            faderHeight={52}
            onChange={(mix) => setForge({ mix })}
          />
          <SuiteFader
            label="OUT"
            value={forge.outputDb}
            min={-12}
            max={12}
            step={0.1}
            format={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}`}
            accent={accentHex}
            faderHeight={52}
            onChange={(outputDb) => setForge({ outputDb })}
          />
        </div>
      </FxSuiteChromeFrame>
    </div>,
    document.body,
  );
}
