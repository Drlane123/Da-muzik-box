/**
 * Studio Editor 2 — performance bus (Studio One Performance–style).
 * Measures real SE2 main-thread work per frame (transport tick + meter paint),
 * not generic rAF gaps (those falsely read ~50% idle on many PCs).
 */

import type { AudioLatencyHint } from '@/app/lib/audioDeviceInfo';

/** One 60 fps frame budget — load % = work ms vs this (with headroom). */
const FRAME_BUDGET_MS = 1000 / 60;
/** Stretch budget so normal Play reads ~35–55%, not 80%+, unless the machine is struggling. */
const BUDGET_HEADROOM = 1.45;
const WORK_EMA_ALPHA = 0.2;
const TRANSPORT_STALE_MS = 400;

let transportWorkEma = 0;
let meterWorkEma = 0;
let lastTransportReportMs = 0;

export function reportSe2TransportFrameWorkMs(ms: number): void {
  const clamped = Math.max(0, Math.min(32, ms));
  transportWorkEma = transportWorkEma * (1 - WORK_EMA_ALPHA) + clamped * WORK_EMA_ALPHA;
  lastTransportReportMs = performance.now();
}

export function reportSe2MeterPaintWorkMs(ms: number): void {
  const clamped = Math.max(0, Math.min(24, ms));
  meterWorkEma = meterWorkEma * (1 - WORK_EMA_ALPHA) + clamped * WORK_EMA_ALPHA;
}

function transportRecentlyActive(): boolean {
  return performance.now() - lastTransportReportMs < TRANSPORT_STALE_MS;
}

/** 0–100 — SE2 transport + meter cost vs frame budget. */
export function readSe2PerformanceLoadPct(): number {
  if (!transportRecentlyActive()) {
    transportWorkEma *= 0.86;
  }
  const playing = transportRecentlyActive();
  const meterShare = playing ? 0.35 : 0.55;
  const totalMs = transportWorkEma + meterWorkEma * meterShare;
  const budget = FRAME_BUDGET_MS * BUDGET_HEADROOM;
  let pct = (totalMs / budget) * 100;
  if (!playing) {
    pct *= 0.65;
    return Math.round(Math.min(28, Math.max(0, pct)));
  }
  return Math.round(Math.min(100, Math.max(0, pct)));
}

export function readSe2PerformanceDebug(): {
  transportMs: number;
  meterMs: number;
  playing: boolean;
} {
  return {
    transportMs: Math.round(transportWorkEma * 10) / 10,
    meterMs: Math.round(meterWorkEma * 10) / 10,
    playing: transportRecentlyActive(),
  };
}

export const SE2_LATENCY_HINT_CYCLE: readonly AudioLatencyHint[] = [
  'interactive',
  'balanced',
  'playback',
] as const;

export function nextSe2LatencyHint(current: AudioLatencyHint): AudioLatencyHint {
  const i = SE2_LATENCY_HINT_CYCLE.indexOf(current);
  const next = i < 0 ? 0 : (i + 1) % SE2_LATENCY_HINT_CYCLE.length;
  return SE2_LATENCY_HINT_CYCLE[next]!;
}

export function se2LatencyHintShortLabel(hint: AudioLatencyHint): string {
  switch (hint) {
    case 'interactive':
      return 'Low';
    case 'balanced':
      return 'Med';
    case 'playback':
      return 'High';
    default:
      return hint;
  }
}

export function se2CpuLoadColor(pct: number): string {
  if (pct >= 68) return '#ff6b6b';
  if (pct >= 44) return '#ffb347';
  return '#7cf4c6';
}
