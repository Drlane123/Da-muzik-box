/**
 * Beat Lab drum / roll scroll — keep compositor playhead in view (document-style).
 */

import type { MutableRefObject } from 'react';

/** Seek / stop — place playhead slightly left of center. */
export const BEAT_LAB_PLAYHEAD_SCROLL_LEAD_RATIO = 0.45;

/**
 * FL “Continuous scrolling” / Cubase “Stationary Cursor” / Pro Tools “Continuous” —
 * timeline moves under a fixed playhead while Follow is on.
 */
export const BEAT_LAB_FOLLOW_PLAYHEAD_CENTER_RATIO = 0.5;

/** SE2 `TIMELINE_SCROLL_MARGIN_PX` — edge scroll during play, not every-frame centering. */
export const BEAT_LAB_GRID_SCROLL_MARGIN_PX = 96;

/** Extra width after last column so the playhead can scroll past the final bar. */
export function beatLabDrumGridTrailPx(colWidthPx: number, viewportWidthPx: number): number {
  const cw = Math.max(1, colWidthPx);
  const vw = Math.max(200, viewportWidthPx);
  return Math.max(vw * 0.55, cw * 6);
}

export function clampBeatLabScrollLeftForPlayhead(
  el: HTMLDivElement,
  playheadCenterPx: number,
  leadRatio = BEAT_LAB_PLAYHEAD_SCROLL_LEAD_RATIO,
): number {
  const max = Math.max(0, el.scrollWidth - el.clientWidth);
  const target = playheadCenterPx - el.clientWidth * leadRatio;
  return Math.max(0, Math.min(max, target));
}

/** Imperative scroll; set `programmaticScrollRef` so onScroll does not disable FOLLOW. */
export function scrollBeatLabContainerToPlayhead(
  el: HTMLDivElement | null,
  playheadCenterPx: number,
  programmaticScrollRef: MutableRefObject<boolean>,
  leadRatio = BEAT_LAB_PLAYHEAD_SCROLL_LEAD_RATIO,
): void {
  if (!el || el.clientWidth <= 0) return;
  const target = clampBeatLabScrollLeftForPlayhead(el, playheadCenterPx, leadRatio);
  if (Math.abs(el.scrollLeft - target) <= 0.5) return;
  programmaticScrollRef.current = true;
  el.scrollLeft = target;
  requestAnimationFrame(() => {
    programmaticScrollRef.current = false;
  });
}

/** DAW Follow — keep playhead centered; grid scrolls every visual frame while playing. */
export function beatLabScrollGridFollowPlayhead(
  el: HTMLDivElement | null,
  playheadPx: number,
  programmaticScrollRef: MutableRefObject<boolean>,
  leadRatio = BEAT_LAB_FOLLOW_PLAYHEAD_CENTER_RATIO,
): void {
  scrollBeatLabContainerToPlayhead(el, playheadPx, programmaticScrollRef, leadRatio);
}

/** SE2 page-style scroll — only when playhead nears viewport edge (no Follow). */
export function beatLabScrollGridIfPlayheadNearEdge(
  el: HTMLDivElement | null,
  playheadPx: number,
  programmaticScrollRef: MutableRefObject<boolean>,
  marginPx = BEAT_LAB_GRID_SCROLL_MARGIN_PX,
): void {
  if (!el || el.clientWidth <= 0) return;
  const scrollLeft = el.scrollLeft;
  const clientWidth = el.clientWidth;
  let newScrollLeft = scrollLeft;
  const playheadScreen = playheadPx - scrollLeft;
  if (playheadScreen < marginPx && scrollLeft > 0) {
    newScrollLeft = Math.max(0, playheadPx - marginPx);
  } else if (playheadScreen > clientWidth - marginPx) {
    newScrollLeft = Math.max(0, playheadPx - clientWidth + marginPx);
  }
  if (Math.abs(newScrollLeft - scrollLeft) < 1) return;
  programmaticScrollRef.current = true;
  el.scrollLeft = newScrollLeft;
  requestAnimationFrame(() => {
    programmaticScrollRef.current = false;
  });
}
