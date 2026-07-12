import { studioMixerDisplayToDb } from '@/app/lib/studio/studioMixerMeterEngine';

/** Horizontal track-lane meter bar height (px). */
export const SE2_TRACK_LANE_METER_H_PX = 7;

export function se2TrackLaneMeterFillColor(displayNorm: number, muted: boolean): string {
  if (muted || !Number.isFinite(displayNorm) || displayNorm <= 0) return '#00c853';
  const db = studioMixerDisplayToDb(displayNorm);
  if (db >= 3) return '#ff3b3b';
  if (db >= 0) return '#ffb020';
  return '#00c853';
}

type LaneBarPaint = { width: string; background: string; opacity: string };
type LaneShellPaint = { borderColor: string; background: string; boxShadow: string };
type MixerBarPaint = { height: string; background: string };

const laneBarLast = new WeakMap<HTMLDivElement, LaneBarPaint>();
const laneShellLast = new WeakMap<HTMLDivElement, LaneShellPaint>();
const mixerBarLast = new WeakMap<HTMLDivElement, MixerBarPaint>();

/**
 * Paint one horizontal L or R lane meter bar (0–1 display norm, same as mixer VU).
 * Uses width % (not scaleX) so React re-renders cannot wipe a transform.
 */
export function paintSe2TrackLaneMeterBar(
  el: HTMLDivElement | null,
  displayNorm: number,
  muted: boolean,
  channel: 'L' | 'R' = 'L',
): void {
  if (!el) return;
  const level = Math.max(0, Math.min(1, displayNorm));
  const visible = muted ? 0 : level > 0 ? Math.max(level, 0.05) : 0;
  const width = `${(visible * 100).toFixed(1)}%`;
  const background =
    level > 0
      ? se2TrackLaneMeterFillColor(displayNorm, muted)
      : channel === 'L'
        ? 'rgba(110,200,232,0.25)'
        : 'rgba(110,231,184,0.25)';
  const opacity = muted ? '0.35' : '1';
  const prev = laneBarLast.get(el);
  if (prev && prev.width === width && prev.background === background && prev.opacity === opacity) {
    return;
  }
  laneBarLast.set(el, { width, background, opacity });
  el.style.width = width;
  el.style.background = background;
  el.style.opacity = opacity;
  el.style.transform = '';
}

export function paintSe2TrackLaneMeterShell(el: HTMLDivElement | null, hasSignal: boolean): void {
  if (!el) return;
  const borderColor = hasSignal ? 'rgba(124,244,198,0.35)' : 'rgba(255,255,255,0.1)';
  const background = hasSignal ? 'rgba(124,244,198,0.08)' : 'rgba(0,0,0,0.35)';
  const boxShadow = hasSignal
    ? '0 0 8px rgba(124,244,198,0.12)'
    : 'inset 0 1px 0 rgba(255,255,255,0.04)';
  const prev = laneShellLast.get(el);
  if (
    prev
    && prev.borderColor === borderColor
    && prev.background === background
    && prev.boxShadow === boxShadow
  ) {
    return;
  }
  laneShellLast.set(el, { borderColor, background, boxShadow });
  el.style.borderColor = borderColor;
  el.style.background = background;
  el.style.boxShadow = boxShadow;
}

/** Vertical mixer strip VU — skip DOM writes when height/color unchanged. */
export function paintStudioMixerMeterBar(
  el: HTMLDivElement | null,
  displayNorm: number,
  fillGradient: (displayNorm: number, muted: boolean) => string,
  muted = false,
): void {
  if (!el) return;
  const level = Math.max(0, Math.min(1, displayNorm));
  const height = `${(level * 100).toFixed(1)}%`;
  const background = fillGradient(level, muted);
  const prev = mixerBarLast.get(el);
  if (prev && prev.height === height && prev.background === background) return;
  mixerBarLast.set(el, { height, background });
  el.style.height = height;
  el.style.background = background;
  el.style.transition = 'none';
}
