import type { StudioTransportSyncSnapshot } from '@/app/context/MasterClockContext';

/**
 * One **display** clock for all Studio reads (playhead, clips hook, ruler rAF fallbacks).
 * Prefer {@link AudioContext.getOutputTimestamp} so phase matches **output** time, not only
 * `currentTime` (which can sit early vs what you hear and vs metronome oscillators).
 */
export function displayAudioNowForStudio(
  ctx: AudioContext | null | undefined,
): number | null {
  if (!ctx || ctx.state === 'closed') return null;
  if (!Number.isFinite(ctx.currentTime)) return null;
  const raw = Math.max(0, ctx.currentTime);
  try {
    const ts = ctx.getOutputTimestamp();
    const ct = ts?.contextTime;
    const pt = ts?.performanceTime;
    if (Number.isFinite(ct) && Number.isFinite(pt)) {
      const wallDeltaSec = (performance.now() - (pt as number)) / 1000;
      const extrap = (ct as number) + wallDeltaSec;
      if (Number.isFinite(extrap)) {
        /**
         * Clamp extrapolation to a band around `currentTime`. Some engines return odd
         * `getOutputTimestamp` pairs under load; unconstrained extrapolation can jitter the playhead.
         */
        const t = Math.min(raw + 0.2, Math.max(raw - 0.04, extrap));
        return Math.max(0, t);
      }
    }
  } catch {
    /* ignore */
  }
  let t = raw;
  const ol =
    typeof ctx.outputLatency === 'number' && ctx.outputLatency > 0
      ? ctx.outputLatency
      : 0;
  const bl =
    typeof ctx.baseLatency === 'number' && ctx.baseLatency > 0
      ? ctx.baseLatency
      : 0;
  const dac = Math.min(0.12, ol + bl);
  if (dac > 0) t += dac;
  return t;
}

/**
 * Studio HUD paint wake: MasterClock calls {@link pulseStudioPlayheadFrame} with the same `audioNow`
 * as `emitTransportAudioFrame` (no cached snapshot — readers always rebuild phase from that instant).
 */
export type StudioPlayheadFrameListener = (audioNowSec: number | null) => void;

const listeners = new Set<StudioPlayheadFrameListener>();

/** Notify subscribers — `null` after transport stop (listeners may no-op or read idle). */
export function pulseStudioPlayheadFrame(audioNowSec: number | null): void {
  for (const fn of listeners) {
    try {
      fn(audioNowSec);
    } catch {
      /* ignore */
    }
  }
}

export function subscribeStudioPlayheadFrame(
  onFrame: StudioPlayheadFrameListener,
): () => void {
  listeners.add(onFrame);
  return () => {
    listeners.delete(onFrame);
  };
}

/**
 * Single UI read path: live AudioContext → `getAtAudioNow(displayAudioNowForStudio(audioCtx))`;
 * otherwise idle snapshot (paused/stopped / no context).
 */
export function readStudioTransportSnapshotForUi(
  getAtAudioNow: (audioNowSec: number) => StudioTransportSyncSnapshot,
  getIdle: () => StudioTransportSyncSnapshot,
  audioCtx: AudioContext | null | undefined,
): StudioTransportSyncSnapshot {
  if (audioCtx && audioCtx.state !== 'closed') {
    const t = displayAudioNowForStudio(audioCtx);
    if (t != null) return getAtAudioNow(t);
  }
  return getIdle();
}
