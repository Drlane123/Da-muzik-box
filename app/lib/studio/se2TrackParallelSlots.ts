/**
 * SE2 mixer / FX / arm state is index-parallel with studioTracks.
 * Compact or expand those slots when tracks are deleted or inserted mid-list.
 */

/** Remove one lane slot and pad the tail so length stays `maxLen`. */
export function se2RemoveParallelTrackSlot<T>(
  arr: readonly T[],
  index: number,
  fill: T,
  maxLen: number,
): T[] {
  const next = Array.from({ length: maxLen }, (_, i) => arr[i] ?? fill);
  if (index < 0 || index >= maxLen) return next;
  next.splice(index, 1);
  while (next.length < maxLen) next.push(fill);
  return next.slice(0, maxLen);
}

/** Insert one lane slot at `index` and drop the last pad so length stays `maxLen`. */
export function se2InsertParallelTrackSlot<T>(
  arr: readonly T[],
  index: number,
  fill: T,
  maxLen: number,
): T[] {
  const next = Array.from({ length: maxLen }, (_, i) => arr[i] ?? fill);
  const clamped = Math.max(0, Math.min(maxLen, index));
  next.splice(clamped, 0, fill);
  return next.slice(0, maxLen);
}
