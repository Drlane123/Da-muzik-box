'use client';

import {
  IDLE_PROCESS_LIVE,
  type ProcessLiveFeed,
} from '@/app/lib/masteringBay/masteringBayProcessLive';
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

function labelFor(kind: ProcessKind, params: Record<string, number>): string {
  switch (kind) {
    case 'eq':
      return 'EQ curve';
    case 'compress':
      return `GR ${Math.min(100, (params.amount ?? 38) * 0.9 + (params._grLive ?? 0) * 40).toFixed(0)}%`;
    case 'limit':
      return `${(params.ceiling ?? -1).toFixed(1)} dBTP`;
    case 'transients':
      return 'Tape sat';
    case 'stereo':
      return `${(params.width ?? 112).toFixed(0)}% width`;
    case 'sub':
      return 'Sub pressure';
    case 'drive':
      return `Push ${(params.push ?? 0) >= 0 ? '+' : ''}${(params.push ?? 0).toFixed(1)}`;
    case 'tone':
      return 'Tone balance';
    case 'match':
      return `${(params.matchAmount ?? 0).toFixed(0)}% match`;
    case 'ref':
      return 'Stereo width';
    case 'dehiss':
      return `Hiss −${(params.hissAmount ?? 0).toFixed(0)}%`;
    case 'declick':
      return `Click −${(params.clickAmount ?? 0).toFixed(0)}%`;
    case 'denoise':
      return 'De-hiss · De-click';
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

function paintFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  kind: ProcessKind,
  params: Record<string, number>,
  live: ProcessLiveFeed,
  powered: boolean,
  t: number,
) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0a0a0e';
  ctx.fillRect(0, 0, w, h);
  drawGrid(ctx, w, h);

  const on = powered && live.active;
  const level = on ? Math.max(0.08, live.level) : powered ? 0.06 : 0.02;
  const peak = on ? Math.max(level, live.peak) : level;
  const gr = on ? live.reduction : 0;
  const midY = h * 0.55;

  if (kind === 'eq') {
    const low = params.low ?? 0;
    const mid = params.mid ?? 0;
    const high = params.high ?? 1.2;
    const wobble = on ? Math.sin(t * 6) * level * 3 : 0;
    ctx.beginPath();
    for (let x = 0; x <= w; x++) {
      const u = x / w;
      const bass = low * Math.exp(-u * 4) * 5;
      const mids = mid * Math.exp(-((u - 0.4) ** 2) * 18) * 5;
      const air = high * Math.exp(-((u - 0.85) ** 2) * 22) * 5;
      const energy = on ? Math.sin(t * 8 + u * 10) * level * 4 : 0;
      const y = midY - bass - mids - air - energy - wobble * (1 - u);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = `rgba(94, 207, 94, ${0.1 + level * 0.25})`;
    ctx.fill();
    ctx.beginPath();
    for (let x = 0; x <= w; x++) {
      const u = x / w;
      const bass = low * Math.exp(-u * 4) * 5;
      const mids = mid * Math.exp(-((u - 0.4) ** 2) * 18) * 5;
      const air = high * Math.exp(-((u - 0.85) ** 2) * 22) * 5;
      const energy = on ? Math.sin(t * 8 + u * 10) * level * 4 : 0;
      const y = midY - bass - mids - air - energy - wobble * (1 - u);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(110, 220, 110, ${0.45 + level * 0.45})`;
    ctx.lineWidth = 1.6;
    ctx.stroke();
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
    ctx.fillStyle = '#08080c';
    ctx.fillRect(x0, y0, barW, barH);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.strokeRect(x0 + 0.5, y0 + 0.5, barW - 1, barH - 1);
    const fillH = barH * clamp01(liveGr);
    const pulse = on ? 1 + Math.sin(t * 14) * 0.04 * liveGr : 1;
    const grad = ctx.createLinearGradient(0, y0 + barH - fillH * pulse, 0, y0 + barH);
    grad.addColorStop(0, 'rgba(220, 140, 90, 0.9)');
    grad.addColorStop(1, 'rgba(150, 70, 50, 0.95)');
    ctx.fillStyle = grad;
    ctx.fillRect(x0 + 1, y0 + barH - fillH * pulse, barW - 2, fillH * pulse);
    // Threshold tick
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
    ctx.fillStyle = '#08080c';
    ctx.fillRect(8, 6, w - 16, h - 12);
    // Output energy under ceiling
    const energyH = (h - 12) * peak * 0.92;
    const grad = ctx.createLinearGradient(0, h - 6 - energyH, 0, h - 6);
    grad.addColorStop(0, `rgba(94, 207, 94, ${0.15 + gr * 0.35})`);
    grad.addColorStop(1, 'rgba(94, 207, 94, 0.05)');
    ctx.fillStyle = grad;
    ctx.fillRect(9, h - 6 - energyH, w - 18, energyH);
    // Peaks kissing the ceiling
    if (on) {
      for (let i = 0; i < 12; i++) {
        const px = 12 + ((i + (t * 2) % 1) / 12) * (w - 24);
        const hit = peak > ceilPct * 0.85 ? 1 : peak;
        const py = ceilY + 2 + Math.sin(t * 20 + i) * (1 - hit) * 8;
        ctx.fillStyle = gr > 0.05 ? 'rgba(255,120,100,0.85)' : 'rgba(120,220,120,0.7)';
        ctx.fillRect(px, Math.min(h - 10, py), 3, 3);
      }
    }
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
    const atk = (params.attack ?? 55) / 100;
    ctx.beginPath();
    for (let x = 0; x <= w; x++) {
      const u = x / w;
      const phase = t * (4 + atk * 6) + u * Math.PI * 6;
      let y = Math.sin(phase) * (0.2 + level * 0.55) * h * 0.35;
      // Soft-clip / tape saturation
      y = Math.tanh(y * (1.2 + punch * 1.8)) * h * 0.28;
      const py = midY + y;
      if (x === 0) ctx.moveTo(x, py);
      else ctx.lineTo(x, py);
    }
    ctx.strokeStyle = `rgba(200, 175, 120, ${0.4 + level * 0.5})`;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    // Warmth glow
    ctx.fillStyle = `rgba(184, 160, 112, ${0.04 + level * 0.08})`;
    ctx.fillRect(0, midY - 8, w, 16);
    return;
  }

  if (kind === 'stereo' || kind === 'ref') {
    const width = (params.width ?? (kind === 'ref' ? 48 : 112)) / (kind === 'ref' ? 100 : 200);
    const spread = 0.35 + width * 0.55;
    const barW = 14;
    const maxH = h - 18;
    const lH = maxH * (0.35 + level * 0.55) * (0.85 + Math.sin(t * 9) * 0.08 * level);
    const rH = maxH * (0.35 + level * 0.55) * (0.85 + Math.cos(t * 9.5) * 0.08 * level);
    const cx = w * 0.5;
    const gap = 10 + spread * 28;
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
    // Center mono link
    ctx.strokeStyle = `rgba(255,255,255,${0.12 + (1 - width) * 0.2})`;
    ctx.beginPath();
    ctx.moveTo(cx, 10);
    ctx.lineTo(cx, h - 10);
    ctx.stroke();
    return;
  }

  if (kind === 'sub' || kind === 'drive') {
    // Round pressure glow only — no waveform. Size/brightness = sub push × live level.
    const push = params.push ?? 7.8;
    const drive = (params.drive ?? 4) / 10;
    const pushN = clamp01((push + 15) / 30);
    const pressure = clamp01((0.2 + pushN * 0.65) * (powered ? 0.35 + level * 0.9 : 0.12));
    const breathe = on ? 1 + Math.sin(t * (2.2 + pressure * 2)) * 0.08 * pressure : 1;
    const radius = Math.min(w, h) * (0.22 + pressure * 0.42) * breathe;
    const cx = w * 0.5;
    const cy = h * 0.62;
    const isDrive = kind === 'drive';
    const r = isDrive ? 255 : 80;
    const g = isDrive ? 150 : 180;
    const b = isDrive ? 70 : 255;
    const coreA = 0.1 + pressure * (0.35 + (isDrive ? drive * 0.2 : 0));
    const bloom = ctx.createRadialGradient(cx, cy, radius * 0.08, cx, cy, radius);
    bloom.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${coreA})`);
    bloom.addColorStop(0.45, `rgba(${r}, ${g}, ${b}, ${coreA * 0.45})`);
    bloom.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    ctx.fillStyle = bloom;
    ctx.fillRect(0, 0, w, h);
    // Soft floor reflection for weight
    const floor = ctx.createRadialGradient(cx, h * 0.92, 2, cx, h * 0.95, w * (0.2 + pressure * 0.35));
    floor.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.06 + pressure * 0.18})`);
    floor.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    ctx.fillStyle = floor;
    ctx.fillRect(0, 0, w, h);
    return;
  }

  if (kind === 'tone') {
    const tone = (params.tone ?? params.focus ?? 50) / 100;
    const analog = (params.analog ?? 5) / 10;
    // Warm (left) → bright (right) balance, live energy rides the tilt
    for (let x = 0; x < w; x += 3) {
      const u = x / w;
      const tilt = 1 - Math.abs(u - tone) * 1.6;
      const energy = on ? 0.35 + level * 0.55 * (0.6 + Math.sin(t * 7 + u * 8) * 0.4) : 0.2;
      const warm = Math.max(0, 1 - u);
      const cool = Math.max(0, u);
      const a = clamp01(tilt) * energy;
      ctx.fillStyle = `rgba(${Math.round(180 * warm + 80 * cool)}, ${Math.round(140 * warm + 180 * cool)}, ${Math.round(90 * warm + 220 * cool)}, ${a})`;
      const bh = (h - 14) * (0.25 + clamp01(tilt) * 0.55 + analog * 0.1);
      ctx.fillRect(x, h - 8 - bh, 2, bh);
    }
    // Tone cursor
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
    // Two levels (source vs reference) pull together as match amount rises — no waves.
    const match = (params.matchAmount ?? 72) / 100;
    const loud = (params.loudness ?? 64) / 100;
    const srcLevel = on ? Math.max(0.12, live.inputLevel) : 0.1;
    // Reference target sits near the goal; live output approaches it with match.
    const refLevel = 0.45 + loud * 0.35;
    const liveLevel = srcLevel + (refLevel - srcLevel) * match;
    const closeness = 1 - Math.abs(liveLevel - refLevel);
    const unity = clamp01(match * (0.55 + closeness * 0.45));

    const maxBarH = h - 18;
    const barW = Math.max(18, w * 0.16);
    // Gap closes as match increases (two sides come together).
    const gap = (w - barW * 2) * (0.55 - match * 0.42);
    const leftX = w * 0.5 - gap * 0.5 - barW;
    const rightX = w * 0.5 + gap * 0.5;
    const pulse = on ? 1 + Math.sin(t * 5) * 0.04 * level : 1;

    const drawLevel = (
      x: number,
      fill: number,
      rgb: [number, number, number],
      blendGreen: number,
    ) => {
      const bh = maxBarH * clamp01(fill) * pulse;
      const y = h - 8 - bh;
      const [rr, gg, bb] = rgb;
      const r = Math.round(rr + (94 - rr) * blendGreen);
      const g = Math.round(gg + (207 - gg) * blendGreen);
      const b = Math.round(bb + (94 - bb) * blendGreen);
      const grad = ctx.createLinearGradient(x, y, x, h - 8);
      grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.35 + unity * 0.45})`);
      grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${0.08 + unity * 0.12})`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      const rad = 4;
      ctx.moveTo(x + rad, y);
      ctx.arcTo(x + barW, y, x + barW, y + bh, rad);
      ctx.arcTo(x + barW, h - 8, x, h - 8, rad);
      ctx.arcTo(x, h - 8, x, y, rad);
      ctx.arcTo(x, y, x + barW, y, rad);
      ctx.closePath();
      ctx.fill();
      // Soft glow around each level
      const glow = ctx.createRadialGradient(
        x + barW * 0.5,
        h - 8 - bh * 0.35,
        2,
        x + barW * 0.5,
        h - 8 - bh * 0.2,
        barW * (0.9 + unity),
      );
      glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.12 + unity * 0.2})`);
      glow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(x - 10, y - 10, barW + 20, bh + 20);
    };

    // Source (amber) → blends toward green as it matches reference (slate-blue).
    drawLevel(leftX, liveLevel, [255, 160, 80], unity);
    drawLevel(rightX, refLevel, [110, 140, 190], unity);

    // Center “matched” light — only when the two sides are actually coming together.
    if (unity > 0.08) {
      const midGlow = ctx.createRadialGradient(w * 0.5, h * 0.55, 2, w * 0.5, h * 0.55, w * 0.28);
      midGlow.addColorStop(0, `rgba(94, 207, 94, ${0.08 + unity * 0.28 * (0.5 + level * 0.5)})`);
      midGlow.addColorStop(1, 'rgba(94, 207, 94, 0)');
      ctx.fillStyle = midGlow;
      ctx.fillRect(0, 0, w, h);
    }
    return;
  }

  if (kind === 'dehiss' || kind === 'declick' || kind === 'denoise') {
    const hissAmt = (params.hissAmount ?? 28) / 100;
    const clickAmt = (params.clickAmount ?? 32) / 100;
    const showHiss = kind === 'dehiss' || kind === 'denoise';
    const showClick = kind === 'declick' || kind === 'denoise';

    // Noise floor (speckles) — reduced as de-hiss works.
    if (showHiss) {
      const density = Math.max(4, Math.floor(40 * (1 - hissAmt * 0.85) * (on ? 0.5 + level : 0.25)));
      for (let i = 0; i < density; i++) {
        const x = ((i * 47 + t * 30 * (1 - hissAmt)) % w + w) % w;
        const y = ((i * 31 + Math.sin(t * 3 + i) * 8) % (h - 8) + 4 + h) % h;
        const a = (0.15 + level * 0.25) * (1 - hissAmt * 0.9);
        ctx.fillStyle = `rgba(180, 200, 220, ${a})`;
        ctx.fillRect(x, y, 1.5, 1.5);
      }
      // HF shelf indicator
      const shelfX = w * (0.55 + hissAmt * 0.25);
      const grad = ctx.createLinearGradient(shelfX, 0, w, 0);
      grad.addColorStop(0, 'rgba(100, 180, 255, 0)');
      grad.addColorStop(1, `rgba(100, 180, 255, ${0.08 + hissAmt * 0.22})`);
      ctx.fillStyle = grad;
      ctx.fillRect(shelfX, 4, w - shelfX, h - 8);
    }

    // Click spikes — caught / shortened as de-click works.
    if (showClick) {
      const spikes = 5;
      for (let i = 0; i < spikes; i++) {
        const x = ((i + 0.5) / spikes) * w;
        const rawH = (0.35 + ((i * 17) % 10) / 20) * h * 0.55;
        const caught = clickAmt * (0.7 + Math.sin(t * 8 + i) * 0.15 * level);
        const spikeH = rawH * (1 - caught * 0.85);
        ctx.strokeStyle = `rgba(255, 140, 90, ${0.35 + (1 - caught) * 0.4})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, midY + spikeH * 0.5);
        ctx.lineTo(x, midY - spikeH * 0.5);
        ctx.stroke();
        if (caught > 0.2) {
          ctx.strokeStyle = `rgba(94, 207, 94, ${caught * 0.55})`;
          ctx.beginPath();
          ctx.moveTo(x - 4, midY);
          ctx.lineTo(x + 4, midY);
          ctx.stroke();
        }
      }
    }
    return;
  }
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

    const tick = (now: number) => {
      if (!running) return;
      const parent = canvas.parentElement;
      const w = parent?.clientWidth ?? 120;
      const h = parent?.clientHeight ?? 56;
      const t = now / 1000;
      const p = { ...paramsRef.current, _grLive: liveRef.current.reduction };
      paintFrame(ctx, w, h, kindRef.current, p, liveRef.current, poweredRef.current, t);
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
