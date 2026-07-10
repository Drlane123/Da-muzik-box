'use client';

import {
  memo,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { PadSamplerEqFx, PadSamplerFxRack } from '@/app/lib/creationStation/padSamplerFxRack';
import {
  clampPadSampleTrimPair,
  computePadSampleWaveformPeaks,
  PAD_FX_WAVE_H,
  PAD_FX_WAVE_PAD_X,
  padWaveformDbToY,
  padWaveformEqMagDb,
  padWaveformFormatGridHz,
  padWaveformGridFreqs,
  padWaveformHzToX,
  padWaveformXToHz,
} from '@/app/lib/creationStation/padSampleWaveform';
import type { PadSamplerPlaybackOpts } from '@/app/lib/padSampleStorage';
import { beatPadSamplerTrim1ToDecay } from '@/app/lib/creationStation/beatLabDrumPadVoice';

/** Single-row scope height — wave left / EQ right (50–50 split). */
export const PAD_FX_SCOPE_ROW_H = PAD_FX_WAVE_H;

const PANEL_H = PAD_FX_SCOPE_ROW_H;
const HIT_R = 14;
const PANEL_LABEL_H = 11;
/** Room under the EQ curve for Hz tick labels (50 · 100 · 200 · 500 · 1K …). */
const EQ_FREQ_LABEL_H = 15;

type ScopePanel = 'wave' | 'eq';

type DragTarget =
  | 'trim0'
  | 'trim1'
  | 'hp'
  | 'lp'
  | 'eqLow'
  | 'eqMid'
  | 'eqMidQ'
  | 'eqHigh'
  | null;

type DragSession = {
  panel: ScopePanel;
  target: DragTarget;
  startPx: number;
  startPy: number;
};

export type BeatLabPadSampleFxWaveformProps = {
  audioBuffer: AudioBuffer | null | undefined;
  samplerOpts: PadSamplerPlaybackOpts;
  fxRack: PadSamplerFxRack;
  onSamplerChange?: (next: PadSamplerPlaybackOpts) => void;
  onFxChange?: (next: PadSamplerFxRack) => void;
  /** wave = left panel only, eq = center panel only, split = both 50/50 */
  layout?: 'split' | 'wave' | 'eq';
};

function clampEqBand(eq: PadSamplerEqFx): PadSamplerEqFx {
  let lowFreqHz = Math.max(40, Math.min(700, eq.lowFreqHz));
  let midFreqHz = Math.max(150, Math.min(12000, eq.midFreqHz));
  let highFreqHz = Math.max(1800, Math.min(16000, eq.highFreqHz));
  if (midFreqHz < lowFreqHz + 60) midFreqHz = lowFreqHz + 60;
  if (highFreqHz < midFreqHz + 120) highFreqHz = midFreqHz + 120;
  return {
    ...eq,
    enabled: true,
    lowFreqHz,
    midFreqHz,
    highFreqHz,
    lowGainDb: Math.max(-12, Math.min(12, Math.round(eq.lowGainDb))),
    midGainDb: Math.max(-12, Math.min(12, Math.round(eq.midGainDb))),
    highGainDb: Math.max(-12, Math.min(12, Math.round(eq.highGainDb))),
    midQ: Math.max(0.35, Math.min(12, eq.midQ)),
  };
}

function gainDbFromPlotY(py: number, plotTop: number, innerH: number): number {
  return Math.max(
    -12,
    Math.min(12, Math.round(12 - ((py - (plotTop + 4)) / Math.max(1, innerH)) * 24)),
  );
}

function plotYFromGainDb(gainDb: number, plotTop: number, innerH: number): number {
  return plotTop + 4 + padWaveformDbToY(gainDb, innerH, -12, 12);
}

/** Log position of the Q band between mid and high (independent of mid dot X). */
function scopeMidQToHz(midQ: number, midHz: number, highHz: number): number {
  const norm = (Math.max(0.35, Math.min(12, midQ)) - 0.35) / (12 - 0.35);
  const t = 0.5 + (1 - norm) * 0.35;
  const lo = Math.log(Math.max(120, midHz));
  const hi = Math.log(Math.max(midHz + 200, highHz));
  return Math.exp(lo + Math.max(0, Math.min(1, t)) * (hi - lo));
}

function scopeHzToMidQ(hz: number, midHz: number, highHz: number): number {
  const lo = Math.log(Math.max(120, midHz));
  const hi = Math.log(Math.max(midHz + 200, highHz));
  const t = Math.max(0, Math.min(1, (Math.log(Math.max(hz, 120)) - lo) / (hi - lo)));
  const norm = 1 - (t - 0.5) / 0.35;
  return Math.max(0.35, Math.min(12, 0.35 + norm * (12 - 0.35)));
}

type ScopeEqDots = {
  zeroY: number;
  low: { x: number; y: number };
  mid: { x: number; y: number };
  hi: { x: number; y: number };
  q: { x: number; y: number };
};

function computeScopeEqDots(
  eq: PadSamplerEqFx,
  cssW: number,
  padX: number,
  plotTop: number,
  innerH: number,
  innerW: number,
): ScopeEqDots {
  const eqY = (gainDb: number) => plotYFromGainDb(gainDb, plotTop, innerH);
  const zeroY = plotYFromGainDb(0, plotTop, innerH);
  const qHz = scopeMidQToHz(eq.midQ, eq.midFreqHz, eq.highFreqHz);
  return {
    zeroY,
    low: { x: padWaveformHzToX(eq.lowFreqHz, cssW, padX, padX), y: eqY(eq.lowGainDb) },
    mid: { x: padWaveformHzToX(eq.midFreqHz, cssW, padX, padX), y: eqY(eq.midGainDb) },
    hi: { x: padWaveformHzToX(eq.highFreqHz, cssW, padX, padX), y: eqY(eq.highGainDb) },
    q: {
      x: padWaveformHzToX(qHz, cssW, padX, padX),
      y: zeroY,
    },
  };
}

function pickScopeEqTarget(px: number, py: number, dots: ScopeEqDots): DragTarget {
  const handles: { id: DragTarget; x: number; y: number }[] = [
    { id: 'eqMid', x: dots.mid.x, y: dots.mid.y },
    { id: 'eqLow', x: dots.low.x, y: dots.low.y },
    { id: 'eqHigh', x: dots.hi.x, y: dots.hi.y },
    { id: 'eqMidQ', x: dots.q.x, y: dots.q.y },
  ];
  let best: DragTarget = null;
  let bestDist = HIT_R + 1;
  for (const h of handles) {
    const d = Math.hypot(px - h.x, py - h.y);
    if (d <= HIT_R && d < bestDist) {
      bestDist = d;
      best = h.id;
    }
  }
  return best;
}

function drawHandle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  active: boolean,
  label?: string,
) {
  const r = active ? 7 : 5.5;
  ctx.fillStyle = active ? color : 'rgba(8,10,14,0.92)';
  ctx.strokeStyle = color;
  ctx.lineWidth = active ? 2 : 1.5;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (label) {
    ctx.fillStyle = color;
    ctx.font = `bold ${active ? 8 : 7}px ui-monospace, system-ui, sans-serif`;
    ctx.fillText(label, x + 8, y + 3);
  }
}

function drawFilterCutoffLine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y0: number,
  y1: number,
  color: string,
  inactiveColor: string,
  active: boolean,
  on: boolean,
) {
  ctx.save();
  ctx.strokeStyle = on ? color : active ? color : inactiveColor;
  ctx.lineWidth = active ? 2.75 : on ? 2.25 : 1.25;
  if (!on && !active) ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.moveTo(x + 0.5, y0);
  ctx.lineTo(x + 0.5, y1);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function panelHeightFor(canvas: HTMLCanvasElement): number {
  return Math.max(PANEL_H, Math.floor(canvas.clientHeight || PANEL_H));
}

function drawPanelLabel(ctx: CanvasRenderingContext2D, text: string, cssW: number, panelH: number) {
  ctx.fillStyle = 'rgba(154, 163, 176, 0.9)';
  ctx.font = '7px ui-monospace, system-ui, sans-serif';
  ctx.fillText(text, 6, panelH - 3);
}

export const BeatLabPadSampleFxWaveform = memo(function BeatLabPadSampleFxWaveform({
  audioBuffer,
  samplerOpts,
  fxRack,
  onSamplerChange,
  onFxChange,
  layout = 'split',
}: BeatLabPadSampleFxWaveformProps) {
  const waveCanvasRef = useRef<HTMLCanvasElement>(null);
  const eqCanvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<DragSession | null>(null);
  const latestSamplerRef = useRef(samplerOpts);
  const latestFxRef = useRef(fxRack);
  latestSamplerRef.current = samplerOpts;
  latestFxRef.current = fxRack;

  const [activeDrag, setActiveDrag] = useState<DragSession | null>(null);
  const [dragPreview, setDragPreview] = useState<{ x: number; y: number } | null>(null);

  const peaks = useMemo(() => {
    if (!audioBuffer) return null;
    return computePadSampleWaveformPeaks(audioBuffer, 360);
  }, [audioBuffer]);

  const eqMagDb = useMemo(
    () =>
      padWaveformEqMagDb({
        lowGainDb: fxRack.eq.lowGainDb,
        midGainDb: fxRack.eq.midGainDb,
        highGainDb: fxRack.eq.highGainDb,
        lowFreqHz: fxRack.eq.lowFreqHz,
        midFreqHz: fxRack.eq.midFreqHz,
        highFreqHz: fxRack.eq.highFreqHz,
        midQ: fxRack.eq.midQ,
      }),
    [fxRack.eq],
  );

  const interactive = Boolean(onSamplerChange || onFxChange);

  const drawWavePanel = useCallback(
    (canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const cssW = Math.max(80, canvas.clientWidth || 160);
      const panelH = panelHeightFor(canvas);
      const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
      canvas.width = Math.max(1, Math.floor(cssW * dpr));
      canvas.height = Math.floor(panelH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, panelH);

      ctx.fillStyle = '#06080c';
      ctx.fillRect(0, 0, cssW, panelH);

      const trim0 = Math.max(0, Math.min(1, samplerOpts.trim0));
      const trim1 = Math.max(trim0 + 1e-4, Math.min(1, samplerOpts.trim1));
      const decayPct = beatPadSamplerTrim1ToDecay(trim1);
      const snap = Math.max(0, Math.min(1, samplerOpts.triggerSnap ?? 0));
      const drive = Math.max(0, Math.min(1, fxRack.drive));
      const hpOn = samplerOpts.hpHz >= 25;
      const lpOn = samplerOpts.lpHz >= 200 && samplerOpts.lpHz < 19900;
      const padX = 4;
      const innerW = cssW - padX * 2;
      const hpX = hpOn
        ? padWaveformHzToX(samplerOpts.hpHz, cssW, padX, padX)
        : padX + innerW * 0.12;
      const lpX = lpOn
        ? padWaveformHzToX(samplerOpts.lpHz, cssW, padX, padX)
        : padX + innerW * 0.88;

      const plotTop = 2;
      const plotBottom = panelH - PANEL_LABEL_H;
      const plotH = plotBottom - plotTop;
      const midY = plotTop + plotH / 2;

      ctx.fillStyle = '#0a1018';
      ctx.fillRect(0, plotTop, cssW, plotH);
      ctx.strokeStyle = 'rgba(124, 244, 198, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, midY + 0.5);
      ctx.lineTo(cssW, midY + 0.5);
      ctx.stroke();

      const x0 = trim0 * cssW;
      const x1 = trim1 * cssW;

      if (hpOn) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.58)';
        ctx.fillRect(0, plotTop, Math.max(0, hpX), plotH);
      }
      if (lpOn) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.58)';
        ctx.fillRect(lpX, plotTop, Math.max(0, cssW - lpX), plotH);
      }

      if (fxRack.delay.enabled && fxRack.delay.mix > 0.03) {
        ctx.fillStyle = `rgba(167, 139, 250, ${fxRack.delay.mix * 0.1})`;
        ctx.fillRect(0, plotTop, cssW, plotH);
      }
      if (fxRack.reverb.enabled && fxRack.reverb.mix > 0.03) {
        ctx.fillStyle = `rgba(124, 244, 198, ${fxRack.reverb.mix * 0.12})`;
        ctx.fillRect(0, plotTop, cssW, plotH);
      }

      if (!peaks || peaks.length < 1) {
        ctx.fillStyle = '#4b5563';
        ctx.font = '10px ui-monospace, system-ui, sans-serif';
        ctx.fillText('No sample', padX, midY + 3);
      } else {
        const n = peaks.length;
        let peakMax = 1e-6;
        for (let i = 0; i < n; i++) peakMax = Math.max(peakMax, peaks[i]!);
        const scale = Math.min((plotH * 0.44) / peakMax, plotH * 4);
        const barW = Math.max(1, cssW / n);
        const iStart = Math.max(0, Math.min(n - 1, Math.floor(trim0 * n)));
        const iEnd = Math.max(iStart + 1, Math.min(n, Math.ceil(trim1 * n)));

        for (let i = 0; i < n; i++) {
          const x = (i / n) * cssW;
          const bh = Math.min(peaks[i]! * scale, plotH * 0.46);
          const outside = i < iStart || i >= iEnd;
          const hot = !outside && drive > 0.05 && peaks[i]! > peakMax * (0.72 - drive * 0.18);
          if (outside) ctx.fillStyle = 'rgba(45, 55, 72, 0.55)';
          else if (hot) ctx.fillStyle = `rgba(251, 146, 120, ${0.55 + drive * 0.4})`;
          else if (drive > 0.08) ctx.fillStyle = '#c4b5fd';
          else ctx.fillStyle = '#5eead4';
          ctx.fillRect(x, midY - bh / 2, Math.max(1, barW - 0.5), Math.max(1, bh));
        }

        ctx.strokeStyle = 'rgba(251, 191, 72, 0.95)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x0 + 0.5, plotTop);
        ctx.lineTo(x0 + 0.5, plotBottom);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x1 - 0.5, plotTop);
        ctx.lineTo(x1 - 0.5, plotBottom);
        ctx.stroke();

        if (decayPct < 98) {
          const fadeW = Math.max(12, (x1 - x0) * (1 - decayPct / 100) * 0.55);
          const fadeX0 = Math.max(x0, x1 - fadeW);
          const grad = ctx.createLinearGradient(fadeX0, 0, x1, 0);
          grad.addColorStop(0, 'rgba(124, 244, 198, 0)');
          grad.addColorStop(1, 'rgba(124, 244, 198, 0.22)');
          ctx.fillStyle = grad;
          ctx.fillRect(fadeX0, plotTop, x1 - fadeX0, plotH);
        }

        if (snap > 0.02) {
          const envW = Math.max(10, cssW * (0.04 + snap * 0.12));
          ctx.strokeStyle = `rgba(244, 114, 182, ${0.35 + snap * 0.55})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x0, midY - plotH * 0.38);
          ctx.lineTo(x0 + envW, midY);
          ctx.stroke();
        }

        if (interactive) {
          drawHandle(ctx, x0, midY, '#fbbf24', activeDrag?.panel === 'wave' && activeDrag.target === 'trim0');
          drawHandle(
            ctx,
            x1,
            midY,
            '#fbbf24',
            activeDrag?.panel === 'wave' && activeDrag.target === 'trim1',
            decayPct < 98 ? 'DECAY' : undefined,
          );
        }
      }

      drawFilterCutoffLine(
        ctx,
        hpX,
        plotTop,
        plotBottom,
        '#a78bfa',
        'rgba(167, 139, 250, 0.42)',
        activeDrag?.panel === 'wave' && activeDrag.target === 'hp',
        hpOn,
      );
      drawFilterCutoffLine(
        ctx,
        lpX,
        plotTop,
        plotBottom,
        '#7cf4c6',
        'rgba(124, 244, 198, 0.42)',
        activeDrag?.panel === 'wave' && activeDrag.target === 'lp',
        lpOn,
      );

      if (interactive) {
        drawHandle(
          ctx,
          hpX,
          midY,
          '#a78bfa',
          activeDrag?.panel === 'wave' && activeDrag.target === 'hp',
          hpOn ? 'LO' : 'LO',
        );
        drawHandle(
          ctx,
          lpX,
          midY,
          '#7cf4c6',
          activeDrag?.panel === 'wave' && activeDrag.target === 'lp',
          lpOn ? 'HI' : 'HI',
        );
      }

      drawPanelLabel(ctx, 'WAVEFORM · trim & filter', cssW, panelH);
    },
    [activeDrag, fxRack.delay, fxRack.drive, fxRack.reverb, interactive, peaks, samplerOpts],
  );

  const drawEqPanel = useCallback(
    (canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const cssW = Math.max(80, canvas.clientWidth || 160);
      const panelH = panelHeightFor(canvas);
      const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
      canvas.width = Math.max(1, Math.floor(cssW * dpr));
      canvas.height = Math.floor(panelH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, panelH);

      ctx.fillStyle = '#080a10';
      ctx.fillRect(0, 0, cssW, panelH);

      const padX = PAD_FX_WAVE_PAD_X;
      const innerW = cssW - padX * 2;
      const plotTop = 2;
      const plotBottom = panelH - PANEL_LABEL_H - EQ_FREQ_LABEL_H;
      const plotH = plotBottom - plotTop;
      const innerH = plotH - 6;
      const freqLabelY = plotBottom + EQ_FREQ_LABEL_H - 3;

      const hpOn = samplerOpts.hpHz >= 25;
      const lpOn = samplerOpts.lpHz >= 200 && samplerOpts.lpHz < 19900;
      const hpX = hpOn
        ? padWaveformHzToX(samplerOpts.hpHz, cssW, padX, padX)
        : padX + innerW * 0.12;
      const lpX = lpOn
        ? padWaveformHzToX(samplerOpts.lpHz, cssW, padX, padX)
        : padX + innerW * 0.88;

      ctx.strokeStyle = 'rgba(167, 139, 250, 0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, plotTop + 0.5);
      ctx.lineTo(cssW, plotTop + 0.5);
      ctx.stroke();

      for (const hz of padWaveformGridFreqs()) {
        const gx = padWaveformHzToX(hz, cssW, padX, padX);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(gx + 0.5, plotTop + 2);
        ctx.lineTo(gx + 0.5, plotBottom - 1);
        ctx.stroke();
        ctx.fillStyle = '#e8eef8';
        ctx.font = 'bold 10px ui-monospace, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
        ctx.shadowBlur = 3;
        ctx.fillText(padWaveformFormatGridHz(hz), gx, freqLabelY);
        ctx.shadowBlur = 0;
      }
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';

      if (hpOn) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
        ctx.fillRect(padX, plotTop + 1, Math.max(0, hpX - padX), plotH - 2);
      }
      if (lpOn) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
        ctx.fillRect(lpX, plotTop + 1, Math.max(0, padX + innerW - lpX), plotH - 2);
      }
      if (hpOn && lpOn && lpX > hpX + 4) {
        ctx.fillStyle = 'rgba(124, 244, 198, 0.06)';
        ctx.fillRect(hpX, plotTop + 1, lpX - hpX, plotH - 2);
      }

      const eqShowCurve =
        fxRack.eq.enabled ||
        Math.abs(fxRack.eq.lowGainDb) > 0.25 ||
        Math.abs(fxRack.eq.midGainDb) > 0.25 ||
        Math.abs(fxRack.eq.highGainDb) > 0.25 ||
        Math.abs(fxRack.eq.midQ - 1) > 0.05;

      const eqY = (gainDb: number) => plotYFromGainDb(gainDb, plotTop, innerH);
      const dots = computeScopeEqDots(fxRack.eq, cssW, padX, plotTop, innerH, innerW);
      const { zeroY } = dots;

      if (eqShowCurve || interactive) {
        ctx.beginPath();
        for (let i = 0; i < eqMagDb.length; i++) {
          const t = i / (eqMagDb.length - 1 || 1);
          const x = padX + t * innerW;
          const y = eqY(eqMagDb[i]!);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.lineTo(padX + innerW, plotBottom - 2);
        ctx.lineTo(padX, plotBottom - 2);
        ctx.closePath();
        ctx.fillStyle = 'rgba(129, 140, 248, 0.14)';
        ctx.fill();
        ctx.beginPath();
        for (let i = 0; i < eqMagDb.length; i++) {
          const t = i / (eqMagDb.length - 1 || 1);
          const x = padX + t * innerW;
          const y = eqY(eqMagDb[i]!);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = eqShowCurve ? 'rgba(196, 181, 253, 0.85)' : 'rgba(196, 181, 253, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.strokeStyle = 'rgba(124, 244, 198, 0.28)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(padX, zeroY);
      ctx.lineTo(padX + innerW, zeroY);
      ctx.stroke();
      ctx.setLineDash([]);

      const midPreview =
        activeDrag?.panel === 'eq' && activeDrag.target === 'eqMid' && dragPreview
          ? dragPreview
          : null;
      const lowDot = dots.low;
      const midDot = midPreview ?? dots.mid;
      const hiDot = dots.hi;
      const qPreview =
        activeDrag?.panel === 'eq' && activeDrag.target === 'eqMidQ' && dragPreview
          ? dragPreview
          : null;
      const qDot = qPreview ?? dots.q;

      if (interactive) {
        const dotBright = eqShowCurve;
        drawHandle(
          ctx,
          lowDot.x,
          lowDot.y,
          dotBright ? '#818cf8' : 'rgba(129, 140, 248, 0.55)',
          activeDrag?.panel === 'eq' && activeDrag.target === 'eqLow',
          'L',
        );
        drawHandle(
          ctx,
          midDot.x,
          midDot.y,
          dotBright ? '#c4b5fd' : 'rgba(196, 181, 253, 0.55)',
          activeDrag?.panel === 'eq' && activeDrag.target === 'eqMid',
          'M',
        );
        drawHandle(
          ctx,
          hiDot.x,
          hiDot.y,
          dotBright ? '#7cf4c6' : 'rgba(124, 244, 198, 0.55)',
          activeDrag?.panel === 'eq' && activeDrag.target === 'eqHigh',
          'H',
        );
        drawHandle(
          ctx,
          qDot.x,
          qDot.y,
          dotBright ? '#e879f9' : 'rgba(232, 121, 249, 0.55)',
          activeDrag?.panel === 'eq' && activeDrag.target === 'eqMidQ',
          'Q',
        );
      }

      if (fxRack.compressor.enabled) {
        const thrNorm = (fxRack.compressor.thresholdDb + 48) / 48;
        const cy = plotTop + 4 + (1 - thrNorm) * innerH;
        ctx.strokeStyle = 'rgba(203, 213, 245, 0.55)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(padX, cy);
        ctx.lineTo(padX + innerW, cy);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      drawFilterCutoffLine(
        ctx,
        hpX,
        plotTop,
        plotBottom,
        '#a78bfa',
        'rgba(167, 139, 250, 0.42)',
        activeDrag?.panel === 'eq' && activeDrag.target === 'hp',
        hpOn,
      );
      drawFilterCutoffLine(
        ctx,
        lpX,
        plotTop,
        plotBottom,
        '#7cf4c6',
        'rgba(124, 244, 198, 0.42)',
        activeDrag?.panel === 'eq' && activeDrag.target === 'lp',
        lpOn,
      );

      drawPanelLabel(ctx, 'EQ · L / M / H ↔↕ · Q slides on 0dB line', cssW, panelH);
    },
    [activeDrag, dragPreview, eqMagDb, fxRack.compressor, fxRack.eq, interactive, samplerOpts],
  );

  useLayoutEffect(() => {
    const waveCanvas = waveCanvasRef.current;
    const eqCanvas = eqCanvasRef.current;

    const redraw = () => {
      if (layout !== 'eq' && waveCanvas) drawWavePanel(waveCanvas);
      if (layout !== 'wave' && eqCanvas) drawEqPanel(eqCanvas);
    };

    redraw();
    const ro = new ResizeObserver(redraw);
    if (layout !== 'eq' && waveCanvas) ro.observe(waveCanvas);
    if (layout !== 'wave' && eqCanvas) ro.observe(eqCanvas);
    return () => ro.disconnect();
  }, [drawEqPanel, drawWavePanel, layout]);

  const pickWaveTarget = useCallback(
    (clientX: number, clientY: number, canvas: HTMLCanvasElement): DragTarget => {
      const rect = canvas.getBoundingClientRect();
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      const cssW = rect.width;
      const panelH = Math.max(PANEL_H, Math.floor(rect.height || PANEL_H));
      const padX = 4;
      const innerW = cssW - padX * 2;
      const plotTop = 2;
      const plotBottom = panelH - PANEL_LABEL_H;
      const plotH = plotBottom - plotTop;
      const midY = plotTop + plotH / 2;
      const trim0 = samplerOpts.trim0 * cssW;
      const trim1 = samplerOpts.trim1 * cssW;
      const hpOn = samplerOpts.hpHz >= 25;
      const lpOn = samplerOpts.lpHz >= 200 && samplerOpts.lpHz < 19900;
      const hpX = hpOn
        ? padWaveformHzToX(samplerOpts.hpHz, cssW, padX, padX)
        : padX + innerW * 0.12;
      const lpX = lpOn
        ? padWaveformHzToX(samplerOpts.lpHz, cssW, padX, padX)
        : padX + innerW * 0.88;

      const near = (x: number, y: number, tx: number, ty: number) =>
        Math.hypot(x - tx, y - ty) <= HIT_R;
      const nearLine = (x: number, lineX: number) => Math.abs(x - lineX) <= HIT_R;

      if (nearLine(px, hpX)) return 'hp';
      if (nearLine(px, lpX)) return 'lp';
      if (peaks && peaks.length > 0) {
        if (near(px, py, trim0, midY)) return 'trim0';
        if (near(px, py, trim1, midY)) return 'trim1';
      }
      if (py >= plotTop && py <= plotBottom && px >= padX && px <= padX + innerW) {
        if (px < padX + innerW * 0.35) return 'hp';
        if (px > padX + innerW * 0.65) return 'lp';
      }
      return null;
    },
    [peaks, samplerOpts],
  );

  const pickEqTarget = useCallback(
    (clientX: number, clientY: number, canvas: HTMLCanvasElement): DragTarget => {
      const rect = canvas.getBoundingClientRect();
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      const cssW = rect.width;
      const panelH = Math.max(PANEL_H, Math.floor(rect.height || PANEL_H));
      const padX = PAD_FX_WAVE_PAD_X;
      const plotTop = 2;
      const plotBottom = panelH - PANEL_LABEL_H;
      const innerH = plotBottom - plotTop - 6;

      const dots = computeScopeEqDots(fxRack.eq, cssW, padX, plotTop, innerH, cssW - padX * 2);
      const picked = pickScopeEqTarget(px, py, dots);
      if (picked) return picked;

      return null;
    },
    [fxRack.eq],
  );

  const applyDrag = useCallback(
    (panel: ScopePanel, clientX: number, clientY: number, canvas: HTMLCanvasElement, target: DragTarget) => {
      if (!target) return;
      const rect = canvas.getBoundingClientRect();
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      const cssW = rect.width;
      const panelH = Math.max(PANEL_H, Math.floor(rect.height || PANEL_H));
      const padX = panel === 'wave' ? 4 : PAD_FX_WAVE_PAD_X;
      const innerW = cssW - padX * 2;
      const plotTop = 2;
      const plotBottom = panelH - PANEL_LABEL_H;
      const innerH = plotBottom - plotTop - 6;
      const plotMinY = plotTop + 4;
      const plotMaxY = plotTop + 4 + innerH;

      if (target === 'trim0' || target === 'trim1') {
        if (!onSamplerChange) return;
        const u = Math.max(0, Math.min(1, px / Math.max(1, cssW)));
        const cur = latestSamplerRef.current;
        const next =
          target === 'trim0'
            ? clampPadSampleTrimPair(u, cur.trim1)
            : clampPadSampleTrimPair(cur.trim0, u);
        onSamplerChange({ ...cur, trim0: next.trim0, trim1: next.trim1 });
        return;
      }

      if (target === 'hp' || target === 'lp') {
        if (!onSamplerChange) return;
        const hz = padWaveformXToHz(px, cssW, padX, padX);
        const cur = latestSamplerRef.current;
        if (target === 'hp') {
          const hpHz = hz <= 35 ? 0 : Math.max(25, Math.min(8000, Math.round(hz)));
          onSamplerChange({ ...cur, hpHz });
        } else {
          const lpHz = hz >= 18500 ? 0 : Math.max(200, Math.min(14000, Math.round(hz)));
          onSamplerChange({ ...cur, lpHz });
        }
        return;
      }

      if (!onFxChange) return;
      const hz = padWaveformXToHz(px, cssW, padX, padX);
      const gainDb = gainDbFromPlotY(py, plotTop, innerH);
      const curFx = latestFxRef.current;
      const eq = clampEqBand({ ...curFx.eq, enabled: true });

      if (target === 'eqLow') {
        const nextX = padWaveformHzToX(hz, cssW, padX, padX);
        const nextY = Math.max(plotMinY, Math.min(plotMaxY, py));
        setDragPreview({ x: nextX, y: nextY });
        onFxChange({ ...curFx, eq: clampEqBand({ ...eq, lowFreqHz: hz, lowGainDb: gainDb }) });
      } else if (target === 'eqMid') {
        const nextX = padWaveformHzToX(hz, cssW, padX, padX);
        const nextY = Math.max(plotMinY, Math.min(plotMaxY, py));
        const nextGain = gainDbFromPlotY(nextY, plotTop, innerH);
        setDragPreview({ x: nextX, y: nextY });
        onFxChange({
          ...curFx,
          eq: clampEqBand({
            ...eq,
            midFreqHz: hz,
            midGainDb: nextGain,
          }),
        });
      } else if (target === 'eqMidQ') {
        const zeroY = plotYFromGainDb(0, plotTop, innerH);
        const nextX = padWaveformHzToX(hz, cssW, padX, padX);
        const nextQ = Math.round(scopeHzToMidQ(hz, eq.midFreqHz, eq.highFreqHz) * 20) / 20;
        setDragPreview({ x: nextX, y: zeroY });
        onFxChange({ ...curFx, eq: clampEqBand({ ...eq, midQ: nextQ }) });
      } else if (target === 'eqHigh') {
        const nextX = padWaveformHzToX(hz, cssW, padX, padX);
        const nextY = Math.max(plotMinY, Math.min(plotMaxY, py));
        setDragPreview({ x: nextX, y: nextY });
        onFxChange({ ...curFx, eq: clampEqBand({ ...eq, highFreqHz: hz, highGainDb: gainDb }) });
      }
    },
    [onFxChange, onSamplerChange],
  );

  const makePointerHandlers = (panel: ScopePanel) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!interactive || e.button !== 0) return;
      const canvas = e.currentTarget;
      const target = panel === 'wave' ? pickWaveTarget(e.clientX, e.clientY, canvas) : pickEqTarget(e.clientX, e.clientY, canvas);
      if (!target) return;
      const rect = canvas.getBoundingClientRect();
      const startPx = e.clientX - rect.left;
      const startPy = e.clientY - rect.top;
      const drag: DragSession = { panel, target, startPx, startPy };
      dragRef.current = drag;
      setActiveDrag(drag);
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* */
      }
      applyDrag(panel, e.clientX, e.clientY, canvas, target);
      e.preventDefault();
    },
    onPointerMove: (e: ReactPointerEvent<HTMLCanvasElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.panel !== panel) return;
      applyDrag(panel, e.clientX, e.clientY, e.currentTarget, drag.target);
    },
    onPointerUp: (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (dragRef.current?.panel !== panel) return;
      dragRef.current = null;
      setDragPreview(null);
      setActiveDrag(null);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* */
      }
    },
    onPointerCancel: (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (dragRef.current?.panel !== panel) return;
      dragRef.current = null;
      setDragPreview(null);
      setActiveDrag(null);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* */
      }
    },
    onLostPointerCapture: () => {
      if (dragRef.current?.panel !== panel) return;
      dragRef.current = null;
      setDragPreview(null);
      setActiveDrag(null);
    },
  });

  const waveHandlers = makePointerHandlers('wave');
  const eqHandlers = makePointerHandlers('eq');

  const canvasStyle = {
    width: '100%',
    height: '100%',
    minHeight: PANEL_H,
    display: 'block' as const,
    borderRadius: 6,
    touchAction: 'none' as const,
    cursor: interactive ? (activeDrag ? 'grabbing' : 'crosshair') : 'default',
  };

  const showWave = layout === 'split' || layout === 'wave';
  const showEq = layout === 'split' || layout === 'eq';

  if (layout === 'wave') {
    return (
      <section className="beat-pads-scope-wave beat-pads-scope-single" aria-label="Waveform" style={{ width: '100%', height: '100%' }}>
        <canvas ref={waveCanvasRef} aria-label="Sample waveform" {...waveHandlers} style={{ ...canvasStyle, border: 'none', borderRadius: 0, background: 'transparent' }} />
      </section>
    );
  }

  if (layout === 'eq') {
    return (
      <section className="beat-pads-scope-eq beat-pads-scope-single" aria-label="EQ" style={{ width: '100%', height: '100%' }}>
        <canvas ref={eqCanvasRef} aria-label="EQ graph" {...eqHandlers} style={{ ...canvasStyle, border: 'none', borderRadius: 0, background: 'transparent' }} />
      </section>
    );
  }

  return (
    <div className="beat-pads-scope-split" data-layout="wave-eq-side-by-side">
      {showWave ? (
      <section className="beat-pads-scope-wave" aria-label="Waveform">
        <canvas ref={waveCanvasRef} aria-label="Sample waveform — drag trim and LO/HI filter lines" {...waveHandlers} style={{ ...canvasStyle, border: 'none', borderRadius: 0, background: 'transparent' }} />
      </section>
      ) : null}
      {showEq ? (
      <section className="beat-pads-scope-eq" aria-label="EQ">
        <canvas ref={eqCanvasRef} aria-label="EQ graph — drag L, M, H, Q bands and filter cutoffs" {...eqHandlers} style={{ ...canvasStyle, border: 'none', borderRadius: 0, background: 'transparent' }} />
      </section>
      ) : null}
    </div>
  );
});
