/**
 * Studio counter / BBT display — pure formatting (no transport state).
 * Musical phase comes from `useStudioMusicalClock` / `studioMusicalClockEngine` (same PPQ grid as playhead + metronome).
 */
import { PPQ } from '@/app/context/MasterClockContext';
import { tickToBarBeatFromFloatTick } from '@/app/context/daw-types';
import type { TimeSigEvent } from '@/app/context/MasterClockContext';

export const STUDIO_TIMING_MODE_STORAGE_KEY = 'da-music-box-studio-timing-mode';

/** Wall-clock style `m:ss.mmm` (or `h:mm:ss.mmm` when needed). */
export function formatPositionClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const frac = seconds % 1;
  const ms = Math.min(999, Math.floor(frac * 1000 + 1e-6));
  const tInt = Math.floor(seconds);
  const s = tInt % 60;
  const m = Math.floor(tInt / 60) % 60;
  const h = Math.floor(tInt / 3600);
  const p2 = (n: number) => String(n).padStart(2, '0');
  const p3 = (n: number) => String(n).padStart(3, '0');
  if (h > 0) return `${h}:${p2(m)}:${p2(s)}.${p3(ms)}`;
  return `${m}:${p2(s)}.${p3(ms)}`;
}

/** Bars.Beats.Ticks (PPQ ticks inside the beat). */
export function formatBbtFromFloatTick(
  tickFloat: number,
  timeSigs: TimeSigEvent[],
): string {
  const bbt = tickToBarBeatFromFloatTick(
    Math.max(0, tickFloat),
    timeSigs as Parameters<typeof tickToBarBeatFromFloatTick>[1],
    PPQ,
  );
  const barStr = String(bbt.bar).padStart(3, '0');
  const beatStr = String(bbt.beat).padStart(2, '0');
  const tickStr = String(Math.max(0, Math.floor(bbt.tickInBeat + 1e-6))).padStart(3, '0');
  return `${barStr}.${beatStr}.${tickStr}`;
}
