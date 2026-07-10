/** Interactive mastering waveform canvas renderer. */

import type { MasteringBayRulerTick } from '@/app/lib/masteringBay/masteringBaySourceTrack';
import type { MasteringBayTimelineClip } from '@/app/lib/masteringBay/masteringBayClipEdit';
import {
  clipTimelineEndSec,
  clipVisibleDurationSec,
  formatSourceGainDb,
  MIN_TRIM_SEC,
  sourceGainLinForClip,
  SOURCE_GAIN_DB_DEFAULT,
} from '@/app/lib/masteringBay/masteringBayClipEdit';
import type { StereoWaveformPeaks } from '@/app/lib/masteringBay/masteringBaySourceTrack';

export type WaveformRenderColors = {
  trackBg: string;
  gridMajor: string;
  gridMinor: string;
  clipFill: string;
  clipEdge: string;
  waveFill: string;
  trimHandle: string;
  trimHandleActive: string;
  fadeHandle: string;
  fadeHandleActive: string;
  fadeOverlay: string;
  selectionShade: string;
};

export const DEFAULT_WAVEFORM_COLORS: WaveformRenderColors = {
  trackBg: '#12141a',
  gridMajor: 'rgba(255, 255, 255, 0.14)',
  gridMinor: 'rgba(255, 255, 255, 0.06)',
  clipFill: '#1f8fd4',
  clipEdge: 'rgba(120, 200, 255, 0.55)',
  waveFill: 'rgba(8, 10, 14, 0.92)',
  trimHandle: 'rgba(255, 220, 120, 0.95)',
  trimHandleActive: '#ffe566',
  fadeHandle: 'rgba(120, 200, 255, 0.95)',
  fadeHandleActive: '#8fd4ff',
  fadeOverlay: 'rgba(0, 0, 0, 0.42)',
  selectionShade: 'rgba(0, 0, 0, 0.35)',
};

export type WaveformRenderParams = {
  width: number;
  height: number;
  dpr: number;
  timelineDurSec: number;
  ticks: MasteringBayRulerTick[];
  clips: MasteringBayTimelineClip[];
  peaksByClipId: Map<string, StereoWaveformPeaks>;
  activeClipId: string | null;
  hoverHandle: 'fade-in' | 'fade-out' | null;
  playheadSec?: number;
  showHandles?: boolean;
};

function drawFilledWaveform(
  g: CanvasRenderingContext2D,
  peaks: Float32Array,
  x0: number,
  y0: number,
  w: number,
  h: number,
  levelScale = 1,
) {
  if (!peaks.length || w <= 2 || h <= 2) return;
  const mid = y0 + h * 0.5;
  const ampScale = h * 0.44 * Math.max(0.05, levelScale);
  g.beginPath();
  g.moveTo(x0, mid);
  const n = peaks.length;
  for (let i = 0; i < n; i++) {
    const x = x0 + (i / (n - 1 || 1)) * w;
    const amp = (peaks[i] ?? 0) * ampScale;
    g.lineTo(x, mid - amp);
  }
  for (let i = n - 1; i >= 0; i--) {
    const x = x0 + (i / (n - 1 || 1)) * w;
    const amp = (peaks[i] ?? 0) * ampScale;
    g.lineTo(x, mid + amp);
  }
  g.closePath();
  g.fill();
}

function clipRectPx(
  clip: MasteringBayTimelineClip,
  timelineDurSec: number,
  width: number,
): { x: number; w: number } {
  const dur = Math.max(0.001, timelineDurSec);
  const x = (clip.timelineStartSec / dur) * width;
  const w = (clipVisibleDurationSec(clip) / dur) * width;
  return { x, w: Math.max(2, w) };
}

function clipEdgeXPx(clip: MasteringBayTimelineClip, edge: 'start' | 'end', timelineDurSec: number, width: number): number {
  const { x, w } = clipRectPx(clip, timelineDurSec, width);
  if (edge === 'start') return x;
  return x + w;
}

/**
 * Full interactive waveform paint — grid, clips, peaks, fade handles.
 * Returns handle hit regions in canvas pixels for pointer routing.
 */
export function renderMasteringBayWaveform(
  canvas: HTMLCanvasElement,
  params: WaveformRenderParams,
  colors: WaveformRenderColors = DEFAULT_WAVEFORM_COLORS,
): { bodyRects: { clipId: string; x: number; y: number; w: number; h: number }[] } {
  const { width, height, dpr, timelineDurSec, ticks, clips, peaksByClipId, activeClipId, hoverHandle, playheadSec, showHandles = true } =
    params;
  const w = Math.max(1, width);
  const h = Math.max(1, height);

  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  const g = canvas.getContext('2d');
  if (!g) return { bodyRects: [] };

  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  g.fillStyle = colors.trackBg;
  g.fillRect(0, 0, w, h);

  for (const { sec: t, major: isMajor } of ticks) {
    const x = (t / timelineDurSec) * w;
    g.strokeStyle = isMajor ? colors.gridMajor : colors.gridMinor;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x + 0.5, 0);
    g.lineTo(x + 0.5, h);
    g.stroke();
  }

  const laneH = h * 0.5;
  g.strokeStyle = 'rgba(0, 0, 0, 0.45)';
  g.beginPath();
  g.moveTo(0, laneH + 0.5);
  g.lineTo(w, laneH + 0.5);
  g.stroke();

  const bodyRects: { clipId: string; x: number; y: number; w: number; h: number }[] = [];
  const HANDLE_W = 6;

  for (const clip of clips) {
    const peaks = peaksByClipId.get(clip.id);
    const { x, w: clipW } = clipRectPx(clip, timelineDurSec, w);
    const pad = 1;
    const isActive = clip.id === activeClipId;

    g.fillStyle = colors.clipFill;
    g.fillRect(x + pad, pad, clipW - pad, h - pad * 2);
    g.strokeStyle = colors.clipEdge;
    g.lineWidth = isActive ? 2 : 1;
    g.strokeRect(x + pad + 0.5, pad + 0.5, clipW - pad - 1, h - pad * 2 - 1);

    const innerX = x + pad + 2;
    const innerW = Math.max(1, clipW - (pad + 2) * 2);
    const gainDb = clip.sourceGainDb ?? SOURCE_GAIN_DB_DEFAULT;
    const gainLin = sourceGainLinForClip(clip);

    if (peaks) {
      g.fillStyle = colors.waveFill;
      drawFilledWaveform(g, peaks.left, innerX, pad + 2, innerW, laneH - 4, gainLin);
      drawFilledWaveform(g, peaks.right, innerX, laneH + 2, innerW, laneH - 4, gainLin);
    }

    const visDur = Math.max(MIN_TRIM_SEC, clipVisibleDurationSec(clip));
    const fadeInFrac = visDur > 0 ? clip.fadeInSec / visDur : 0;
    const fadeOutFrac = visDur > 0 ? clip.fadeOutSec / visDur : 0;
    if (clip.fadeInSec > 0.001) {
      const fadeW = innerW * fadeInFrac;
      g.fillStyle = colors.fadeOverlay;
      g.beginPath();
      g.moveTo(innerX, pad + 2);
      g.lineTo(innerX + fadeW, pad + 2);
      g.lineTo(innerX, h - pad - 2);
      g.closePath();
      g.fill();
    }
    if (clip.fadeOutSec > 0.001) {
      const fadeW = innerW * fadeOutFrac;
      g.fillStyle = colors.fadeOverlay;
      g.beginPath();
      g.moveTo(innerX + innerW, pad + 2);
      g.lineTo(innerX + innerW - fadeW, pad + 2);
      g.lineTo(innerX + innerW, h - pad - 2);
      g.closePath();
      g.fill();
    }

    const startX = clipEdgeXPx(clip, 'start', timelineDurSec, w);
    const endX = clipEdgeXPx(clip, 'end', timelineDurSec, w);
    const fadeInX = innerX + innerW * fadeInFrac;
    const fadeOutX = innerX + innerW * (1 - fadeOutFrac);
    bodyRects.push({ clipId: clip.id, x: startX + HANDLE_W, y: 0, w: endX - startX - HANDLE_W * 2, h });

    const drawFadeHandle = (hx: number, kind: 'fade-in' | 'fade-out') => {
      const hot = isActive && hoverHandle === kind;
      g.fillStyle = hot ? colors.fadeHandleActive : colors.fadeHandle;
      g.fillRect(hx - HANDLE_W * 0.5, 0, HANDLE_W, h);
      g.strokeStyle = 'rgba(0,0,0,0.5)';
      g.strokeRect(hx - HANDLE_W * 0.5 + 0.5, 0.5, HANDLE_W - 1, h - 1);
    };
    if (showHandles && isActive) {
      drawFadeHandle(fadeInX, 'fade-in');
      drawFadeHandle(fadeOutX, 'fade-out');
    }

    if (!isActive) {
      g.fillStyle = colors.selectionShade;
      g.fillRect(x + pad, pad, clipW - pad, h - pad * 2);
    }

    if (Math.abs(gainDb) > 0.05) {
      const label = formatSourceGainDb(gainDb);
      g.font = '600 10px system-ui, sans-serif';
      g.fillStyle = 'rgba(255, 255, 255, 0.95)';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const tx = innerX + innerW * 0.5;
      const ty = h * 0.5;
      g.fillText(label, tx, ty);
    }
  }

  if (playheadSec != null && timelineDurSec > 0) {
    const phX = (playheadSec / timelineDurSec) * w;
    g.strokeStyle = 'rgba(94, 207, 94, 0.95)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(phX + 0.5, 0);
    g.lineTo(phX + 0.5, h);
    g.stroke();
  }

  return { bodyRects };
}

export function timelineXToSec(clientX: number, timelineEl: HTMLElement, timelineDurSec: number): number {
  const rect = timelineEl.getBoundingClientRect();
  const trackW = Math.max(1, timelineEl.scrollWidth);
  const x = Math.max(0, Math.min(trackW, clientX - rect.left + timelineEl.scrollLeft));
  return (x / trackW) * timelineDurSec;
}

export function secToTimelineXPx(sec: number, timelineDurSec: number, timelineWidthPx: number): number {
  return (sec / Math.max(0.001, timelineDurSec)) * timelineWidthPx;
}

export function clipEndTimelineSec(clips: MasteringBayTimelineClip[]): number {
  let end = 0;
  for (const c of clips) end = Math.max(end, clipTimelineEndSec(c));
  return end;
}

/** Compact read-only waveform for preset-bar transport strip. */
export function renderMasteringBayMiniWaveform(
  canvas: HTMLCanvasElement,
  opts: {
    width: number;
    height: number;
    timelineDurSec: number;
    clips: MasteringBayTimelineClip[];
    peaksByClipId: Map<string, StereoWaveformPeaks>;
    playheadSec: number;
  },
): void {
  const { width, height, timelineDurSec, clips, peaksByClipId, playheadSec } = opts;
  if (width <= 0 || height <= 0) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  renderMasteringBayWaveform(
    canvas,
    {
      width,
      height,
      dpr,
      timelineDurSec: Math.max(timelineDurSec, 0.001),
      ticks: [],
      clips,
      peaksByClipId,
      activeClipId: clips[0]?.id ?? null,
      hoverHandle: null,
      playheadSec,
      showHandles: false,
    },
    {
      ...DEFAULT_WAVEFORM_COLORS,
      trackBg: '#0e1016',
      clipFill: '#1a6fa8',
    },
  );
}
