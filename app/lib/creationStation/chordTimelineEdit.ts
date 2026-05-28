/**
 * Timeline bar edit helpers — extend, tile, copy/paste bar ranges.
 */

import type { TimelineSlot } from '@/app/lib/creationStation/chordBlocks';

/** Repeat an existing bar pattern to fill `targetBars` (extends the loop). */
export function tileTimelineSlots(
  pattern: ReadonlyArray<TimelineSlot>,
  targetBars: number,
): TimelineSlot[] {
  const len = Math.max(0, pattern.length);
  if (len === 0) {
    return Array.from({ length: targetBars }, () => ({ chord: null }));
  }
  return Array.from({ length: targetBars }, (_, i) => ({
    chord: pattern[i % len]!.chord,
  }));
}

export function normalizeBarRange(
  start: number,
  end: number,
  totalBars: number,
): { start: number; end: number } {
  const a = Math.max(0, Math.min(totalBars - 1, Math.min(start, end)));
  const b = Math.max(0, Math.min(totalBars - 1, Math.max(start, end)));
  return { start: a, end: b };
}

export function copyTimelineRange(
  timeline: ReadonlyArray<TimelineSlot>,
  start: number,
  end: number,
): TimelineSlot[] {
  const { start: s, end: e } = normalizeBarRange(start, end, timeline.length);
  return timeline.slice(s, e + 1).map((slot) => ({ chord: slot.chord }));
}

/** Paste a fragment at `atBar`, growing total length if needed (max 64 bars). */
export function pasteTimelineAt(
  timeline: ReadonlyArray<TimelineSlot>,
  totalBars: number,
  atBar: number,
  fragment: ReadonlyArray<TimelineSlot>,
  maxBars = 64,
): { timeline: TimelineSlot[]; totalBars: number } | null {
  if (fragment.length === 0) return null;
  const at = Math.max(0, Math.min(totalBars, atBar));
  const needLen = at + fragment.length;
  if (needLen > maxBars) return null;
  const out = timeline.slice(0, totalBars);
  while (out.length < needLen) out.push({ chord: null });
  for (let i = 0; i < fragment.length; i++) {
    out[at + i] = { chord: fragment[i]!.chord };
  }
  const newTotal = Math.max(totalBars, needLen);
  return { timeline: out.slice(0, newTotal), totalBars: newTotal };
}

/** Append one full copy of the current loop (double section length). */
export function duplicateTimelineLoop(
  timeline: ReadonlyArray<TimelineSlot>,
  totalBars: number,
  maxBars = 64,
): { timeline: TimelineSlot[]; totalBars: number } | null {
  if (totalBars <= 0) return null;
  const next = totalBars * 2;
  if (next > maxBars) return null;
  const pattern = timeline.slice(0, totalBars);
  return {
    timeline: [
      ...pattern.map((s) => ({ chord: s.chord })),
      ...pattern.map((s) => ({ chord: s.chord })),
    ],
    totalBars: next,
  };
}
