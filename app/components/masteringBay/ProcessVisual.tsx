'use client';

import {
  IDLE_PROCESS_LIVE,
  type ProcessLiveFeed,
} from '@/app/lib/masteringBay/masteringBayProcessLive';
import { getMasteringBayProcessLive } from '@/app/lib/masteringBay/masteringBayMeterStore';
import { useEffect, useRef } from 'react';

export type ProcessKind =
  | 'eq'
  | 'transients'
  | 'compress'
  | 'stereo'
  | 'limit'
  | 'sub'
  | 'drive'
  | 'tone'
  | 'match'
  | 'ref'
  | 'dehiss'
  | 'declick'
  | 'denoise';

type Props = {
  kind: ProcessKind;
  params?: Record<string, number>;
  /** Module power — animation idles when off. */
  powered?: boolean;
  live?: ProcessLiveFeed;
};

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** Sample real FFT band height (0–1) at normalized freq u (0=low … 1=high). */
function bandAt(bands: number[], u: number): number {
  if (!bands.length) return 0;
  const i = Math.min(bands.length - 1, Math.max(0, Math.floor(clamp01(u) * bands.length)));
  return clamp01((bands[i] ?? 0) / 100);
}

function bandRangeAvg(bands: number[], u0: number, u1: number): number {
  if (!bands.length) return 0;
  const a = Math.min(bands.length - 1, Math.max(0, Math.floor(clamp01(u0) * bands.length)));
  const b = Math.min(bands.length - 1, Math.max(a, Math.floor(clamp01(u1) * bands.length)));
  let sum = 0;
  let n = 0;
  for (let i = a; i <= b; i++) {
    sum += bands[i] ?? 0;
    n++;
  }
  return n ? clamp01(sum / n / 100) : 0;
}

function labelFor(kind: ProcessKind, params: Record<string, number>): string {
  switch (kind) {
    case 'eq':
      return 'EQ · live FFT';
    case 'compress':
      return `GR ${Math.min(100, (params.amount ?? 38) * 0.9 + (params._grLive ?? 0) * 40).toFixed(0)}%`;
    case 'limit':
      return `${(params.ceiling ?? -1).toFixed(1)} dBTP`;
    case 'transients':
      return 'Tape · live FFT';
    case 'stereo':
      return `${(params.width ?? 112).toFixed(0)}% width`;
    case 'sub':
      return 'Sub · live FFT';
    case 'drive':
      return `Push ${(params.push ?? 0) >= 0 ? '+' : ''}${(params.push ?? 0).toFixed(1)}`;
    case 'tone':
      return 'Tone · live FFT';
    case 'match':
      return `${(params.matchAmount ?? 0).toFixed(0)}% match`;
    case 'ref':
      return 'Stereo width';
    case 'dehiss':
      return `Hiss −${(params.hissAmount ?? 0).toFixed(0)}%`;
    case 'declick':
      return `Click −${(params.clickAmount ?? 0).toFixed(0)}%`;
    case 'denoise':
      return 'De-hiss · De-click · FFT';
    default:
      return '';
  }
}

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const y = (h * i) / 4;
    const x = (w * i) / 4;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
}

/** Filled spectrum from real analyser bands (0–100%). */
function drawLiveSpectrum(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  bands: number[],
  rgbaFill: string,
  rgbaStroke: string,
  amp = 1,
) {
  if (!bands.length) return;
  const base = h - 4;
  const maxH = h - 10;
  ctx.beginPath();
  ctx.moveTo(0, base);
  for (let i = 0; i < bands.length; i++) {
    const x = (i / Math.max(1, bands.length - 1)) * w;
    const y = base - clamp01((bands[i] ?? 0) / 100) * maxH * amp;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, base);
  ctx.closePath();
  ctx.fillStyle = rgbaFill;
  ctx.fill();
  ctx.beginPath();
  for (let i = 0; i < bands.length; i++) {
    const x = (i / Math.max(1, bands.length - 1)) * w;
    const y = base - clamp01((bands[i] ?? 0) / 100) * maxH * amp;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = rgbaStroke;
  ctx.lineWidth = 1.4;
  ctx.stroke();
}

function paintFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  kind: ProcessKind,
  params: Record<string, number>,
  live: ProcessLiveFeed,
  powered: boolean,
) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0a0a0e';
  ctx.fillRect(0, 0, w, h);
  drawGrid(ctx, w, h);

  const on = powered && live.active;
  const level = on ? Math.max(0.08, live.level) : powered ? 0.06 : 0.02;
  const peak = on ? Math.max(level, live.peak) : level;
  const gr = on ? live.reduction : 0;
  const bands = live.bands ?? [];
  const midY = h * 0.55;

  if (kind === 'eq') {
    const low = params.low ?? 0;
    const mid = params.mid ?? 0;
    const high = params.high ?? 1.2;
    // Real master FFT underlay
    drawLiveSpectrum(
      ctx,
      w,
      h,
      bands,
      `rgba(94, 207, 94, ${on ? 0.12 + level * 0.22 : 0.04})`,
      `rgba(110, 220, 110, ${on ? 0.55 + level * 0.35 : 0.2})`,
      on ? 1 : 0.15,
    );
    // Parametric EQ shape overlay (controls only — not fake audio)
    ctx.beginPath();
    for (let x = 0; x <= w; x++) {
      const u = x / w;
      const bass = low * Math.exp(-u * 4) * 4;
      const mids = mid * Math.exp(-((u - 0.4) ** 2) * 18) * 4;
      const air = high * Math.exp(-((u - 0.85) ** 2) * 22) * 4;
      const y = midY - bass - mids - air;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(200, 255, 180, 0.55)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    return;
  }

  if (kind === 'compress') {
    const amount = (params.amount ?? 38) / 100;
    const thr = Math.abs(params.threshold ?? -8) / 24;
    const liveGr = Math.max(gr, amount * level * 0.85);
    const barW = 18;
    const barH = h - 16;
    const x0 = w * 0.5 - barW * 0.5;
    const y0 = 8;
    // FFT side strip (real)
    const sideW = Math.max(28, w * 0.28);
    for (let i = 0; i < bands.length; i++) {
      const bh = ((bands[i] ?? 0) / 100) * (barH - 4) * (on ? 1 : 0.12);
      const bx = 6 + (i / Math.max(1, bands.length)) * (sideW - 4);
      ctx.fillStyle = `rgba(220, 140, 90, ${0.15 + (bands[i] ?? 0) / 100 * 0.5})`;
      ctx.fillRect(bx, y0 + barH - bh, Math.max(1, sideW / bands.length - 0.5), bh);
    }
    ctx.fillStyle = '#18181e';
    ctx.fillRect(x0, y0, barW, barH);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.strokeRect(x0 + 0.5, y0 + 0.5, barW - 1, barH - 1);
    const fillH = barH * clamp01(liveGr);
    const grad = ctx.createLinearGradient(0, y0 + barH - fillH, 0, y0 + barH);
    grad.addColorStop(0, 'rgba(220, 140, 90, 0.9)');
    grad.addColorStop(1, 'rgba(150, 70, 50, 0.95)');
    ctx.fillStyle = grad;
    ctx.fillRect(x0 + 1, y0 + barH - fillH, barW - 2, fillH);
    const thrY = y0 + barH * (1 - thr);
    ctx.strokeStyle = 'rgba(255,200,120,0.55)';
    ctx.beginPath();
    ctx.moveTo(x0 - 4, thrY);
    ctx.lineTo(x0 + barW + 4, thrY);
    ctx.stroke();
    return;
  }

  if (kind === 'limit') {
    const ceiling = params.ceiling ?? -1;
    const ceilPct = clamp01((ceiling + 3) / 3);
    const ceilY = 6 + (h - 12) * (1 - ceilPct);
    ctx.fillStyle = '#18181e';
    ctx.fillRect(8, 6, w - 16, h - 12);
    drawLiveSpectrum(
      ctx,
      w,
      h,
      bands,
      `rgba(94, 207, 94, ${0.1 + gr * 0.25})`,
      `rgba(120, 220, 120, ${0.4 + peak * 0.4})`,
      on ? 0.95 : 0.1,
    );
    ctx.strokeStyle = gr > 0.08 ? 'rgba(255,110,90,0.95)' : 'rgba(220,110,100,0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(8, ceilY);
    ctx.lineTo(w - 8, ceilY);
    ctx.stroke();
    if (gr > 0.05) {
      ctx.fillStyle = `rgba(255, 90, 70, ${0.08 + gr * 0.25})`;
      ctx.fillRect(8, 6, w - 16, ceilY - 6);
    }
    return;
  }

  if (kind === 'transients') {
    const punch = (params.punch ?? 62) / 100;
    drawLiveSpectrum(
      ctx,
      w,
      h,
      bands,
      `rgba(200, 175, 120, ${0.1 + level * 0.2})`,
      `rgba(220, 190, 130, ${0.45 + level * 0.4})`,
      on ? 0.85 + punch * 0.25 : 0.12,
    );
    ctx.fillStyle = `rgba(184, 160, 112, ${0.04 + level * 0.08})`;
    ctx.fillRect(0, midY - 8, w, 16);
    return;
  }

  if (kind === 'stereo' || kind === 'ref') {
    const width = (params.width ?? (kind === 'ref' ? 48 : 112)) / (kind === 'ref' ? 100 : 200);
    const spread = 0.35 + width * 0.55;
    const barW = 14;
    const maxH = h - 18;
    const lH = maxH * (0.2 + (on ? live.lLevel : level * 0.3) * 0.8);
    const rH = maxH * (0.2 + (on ? live.rLevel : level * 0.3) * 0.8);
    const cx = w * 0.5;
    const gap = 10 + spread * 28;
    // Real FFT behind L/R
    drawLiveSpectrum(
      ctx,
      w,
      h,
      bands,
      'rgba(100, 180, 255, 0.08)',
      'rgba(100, 220, 160, 0.25)',
      on ? 0.7 : 0.1,
    );
    const drawBar = (x: number, bh: number, hue: string) => {
      const y = h - 8 - bh;
      const g = ctx.createLinearGradient(0, y, 0, h - 8);
      g.addColorStop(0, hue);
      g.addColorStop(1, 'rgba(40,48,56,0.9)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, barW, bh);
    };
    drawBar(cx - gap - barW, lH, 'rgba(100, 180, 255, 0.85)');
    drawBar(cx + gap, rH, 'rgba(100, 220, 160, 0.85)');
    ctx.strokeStyle = `rgba(255,255,255,${0.12 + (1 - width) * 0.2})`;
    ctx.beginPath();
    ctx.moveTo(cx, 10);
    ctx.lineTo(cx, h - 10);
    ctx.stroke();
    return;
  }

  if (kind === 'sub' || kind === 'drive') {
    const push = params.push ?? 7.8;
    const drive = (params.drive ?? 4) / 10;
    const pushN = clamp01((push + 15) / 30);
    // Low-band FFT energy drives the glow (real), not a fake breathe sine.
    const lowEnergy = on ? bandRangeAvg(bands, 0, 0.22) : 0;
    const pressure = clamp01(
      (0.15 + pushN * 0.55) * (powered ? 0.25 + level * 0.55 + lowEnergy * 0.55 : 0.1),
    );
    const radius = Math.min(w, h) * (0.22 + pressure * 0.42);
    const cx = w * 0.5;
    const cy = h * 0.62;
    const isDrive = kind === 'drive';
    const r = isDrive ? 255 : 80;
    const g = isDrive ? 150 : 180;
    const b = isDrive ? 70 : 255;
    drawLiveSpectrum(
      ctx,
      w,
      h,
      bands,
      `rgba(${r}, ${g}, ${b}, ${0.06 + pressure * 0.12})`,
      `rgba(${r}, ${g}, ${b}, ${0.25 + pressure * 0.35})`,
      on ? 0.9 : 0.1,
    );
    const coreA = 0.1 + pressure * (0.35 + (isDrive ? drive * 0.2 : 0));
    const bloom = ctx.createRadialGradient(cx, cy, radius * 0.08, cx, cy, radius);
    bloom.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${coreA})`);
    bloom.addColorStop(0.45, `rgba(${r}, ${g}, ${b}, ${coreA * 0.45})`);
    bloom.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    ctx.fillStyle = bloom;
    ctx.fillRect(0, 0, w, h);
    return;
  }

  if (kind === 'tone') {
    const tone = (params.tone ?? params.focus ?? 50) / 100;
    const analog = (params.analog ?? 5) / 10;
    // Real FFT bars, tinted by tone tilt
    for (let i = 0; i < bands.length; i++) {
      const u = i / Math.max(1, bands.length - 1);
      const x = u * w;
      const tilt = 1 - Math.abs(u - tone) * 1.6;
      const amp = on ? (bands[i] ?? 0) / 100 : 0.05;
      const a = clamp01(tilt) * (0.25 + amp * 0.75);
      const warm = Math.max(0, 1 - u);
      const cool = Math.max(0, u);
      ctx.fillStyle = `rgba(${Math.round(180 * warm + 80 * cool)}, ${Math.round(140 * warm + 180 * cool)}, ${Math.round(90 * warm + 220 * cool)}, ${a})`;
      const bh = (h - 14) * (0.12 + amp * 0.75 + analog * 0.08);
      ctx.fillRect(x, h - 8 - bh, Math.max(1.5, w / bands.length - 0.5), bh);
    }
    const cx = tone * w;
    ctx.strokeStyle = 'rgba(255,220,140,0.75)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, 6);
    ctx.lineTo(cx, h - 6);
    ctx.stroke();
    return;
  }

  if (kind === 'match') {
    const match = (params.matchAmount ?? 72) / 100;
    const loud = (params.loudness ?? 64) / 100;
    const srcLevel = on ? Math.max(0.12, live.inputLevel) : 0.1;
    const refLevel = 0.45 + loud * 0.35;
    const liveLevel = srcLevel + (refLevel - srcLevel) * match;
    const closeness = 1 - Math.abs(liveLevel - refLevel);
    const unity = clamp01(match * (0.55 + closeness * 0.45));

    drawLiveSpectrum(
      ctx,
      w,
      h,
      bands,
      `rgba(94, 207, 94, ${0.06 + unity * 0.12})`,
      `rgba(94, 207, 94, ${0.2 + unity * 0.35})`,
      on ? 0.75 : 0.1,
    );

    const maxBarH = h - 18;
    const barW = Math.max(18, w * 0.16);
    const gap = (w - barW * 2) * (0.55 - match * 0.42);
    const leftX = w * 0.5 - gap * 0.5 - barW;
    const rightX = w * 0.5 + gap * 0.5;

    const drawLevel = (
      x: number,
      fill: number,
      rgb: [number, number, number],
      blendGreen: number,
    ) => {
      const bh = maxBarH * clamp01(fill);
      const y = h - 8 - bh;
      const [rr, gg, bb] = rgb;
      const r = Math.round(rr + (94 - rr) * blendGreen);
      const g = Math.round(gg + (207 - gg) * blendGreen);
      const b = Math.round(bb + (94 - bb) * blendGreen);
      const grad = ctx.createLinearGradient(x, y, x, h - 8);
      grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.35 + unity * 0.45})`);
      grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${0.08 + unity * 0.12})`);
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, barW, bh);
    };

    drawLevel(leftX, liveLevel, [255, 160, 80], unity);
    drawLevel(rightX, refLevel, [110, 140, 190], unity);
    return;
  }

  if (kind === 'dehiss' || kind === 'declick' || kind === 'denoise') {
    const hissAmt = (params.hissAmount ?? 28) / 100;
    const clickAmt = (params.clickAmount ?? 32) / 100;
    const showHiss = kind === 'dehiss' || kind === 'denoise';
    const showClick = kind === 'declick' || kind === 'denoise';

    // Real FFT — high bands dim as de-hiss amount rises (visual of HF cleanup)
    drawLiveSpectrum(
      ctx,
      w,
      h,
      bands,
      `rgba(140, 190, 210, ${0.08 + level * 0.15})`,
      `rgba(180, 220, 240, ${0.35 + level * 0.35})`,
      on ? 1 : 0.1,
    );

    if (showHiss) {
      const shelfX = w * (0.55 + hissAmt * 0.25);
      const grad = ctx.createLinearGradient(shelfX, 0, w, 0);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, `rgba(10, 14, 18, ${0.15 + hissAmt * 0.45})`);
      ctx.fillStyle = grad;
      ctx.fillRect(shelfX, 0, w - shelfX, h);
      // HF energy readout from real bands
      const hf = bandRangeAvg(bands, 0.7, 1);
      ctx.fillStyle = `rgba(180, 220, 255, ${0.2 + hf * 0.5})`;
      ctx.fillRect(shelfX, h - 6 - hf * (h - 12), 3, hf * (h - 12));
    }

    if (showClick) {
      const transient = on ? Math.max(0, live.peak - live.level) : 0;
      const caught = clickAmt * (0.5 + transient);
      for (let i = 0; i < 8; i++) {
        const u = (i + 0.5) / 8;
        const x = u * w;
        const y = h - 8 - bandAt(bands, u) * (h - 14);
        if (caught > 0.15) {
          ctx.strokeStyle = `rgba(94, 207, 94, ${caught * 0.55})`;
          ctx.beginPath();
          ctx.moveTo(x - 4, y);
          ctx.lineTo(x + 4, y);
          ctx.stroke();
        }
      }
    }
    return;
  }

  // Fallback: always show real FFT
  drawLiveSpectrum(
    ctx,
    w,
    h,
    bands,
    `rgba(94, 207, 94, ${0.1 + level * 0.2})`,
    `rgba(110, 220, 110, ${0.4 + level * 0.4})`,
    on ? 1 : 0.12,
  );
}

export function ProcessVisual({
  kind,
  params = {},
  powered = true,
  live = IDLE_PROCESS_LIVE,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef(live);
  const paramsRef = useRef(params);
  const kindRef = useRef(kind);
  const poweredRef = useRef(powered);
  const labelRef = useRef<HTMLSpanElement>(null);

  liveRef.current = live;
  paramsRef.current = params;
  kindRef.current = kind;
  poweredRef.current = powered;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let running = true;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.floor(parent.clientWidth));
      const h = Math.max(1, Math.floor(parent.clientHeight));
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    const tick = () => {
      if (!running) return;
      const parent = canvas.parentElement;
      const w = parent?.clientWidth ?? 120;
      const h = parent?.clientHeight ?? 56;
      const liveNow = getMasteringBayProcessLive() ?? liveRef.current;
      liveRef.current = liveNow;
      const p = { ...paramsRef.current, _grLive: liveNow.reduction };
      paintFrame(ctx, w, h, kindRef.current, p, liveNow, poweredRef.current);
      if (labelRef.current) {
        labelRef.current.textContent = labelFor(kindRef.current, p);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div
      className={`mb-proc-vis mb-proc-vis--live mb-proc-vis--${kind}${powered ? '' : ' is-off'}${live.active && powered ? ' is-active' : ''}`}
    >
      <canvas ref={canvasRef} className="mb-proc-vis__canvas" aria-hidden />
      <span ref={labelRef}>{labelFor(kind, params)}</span>
    </div>
  );
}
