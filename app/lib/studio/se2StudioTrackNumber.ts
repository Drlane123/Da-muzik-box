/**
 * SE2 session lane numbers — assigned when a track is created, stable for the session.
 * Shown in arranger, mixer, piano roll, and Bass Glide chord-source picker (T01, T02, …).
 */

export type Se2LaneNumberedTrack = {
  id: string;
  name: string;
  laneNumber?: number;
};

/** Next unused lane number (max existing + 1). */
export function se2NextStudioLaneNumber(tracks: readonly { laneNumber?: number }[]): number {
  let max = 0;
  for (const t of tracks) {
    if (typeof t.laneNumber === 'number' && t.laneNumber > max) max = t.laneNumber;
  }
  return max + 1;
}

/** Fill missing lane numbers without renumbering tracks that already have one. */
export function se2AssignMissingLaneNumbers<T extends { laneNumber?: number }>(
  tracks: readonly T[],
): (T & { laneNumber: number })[] {
  let max = 0;
  for (const t of tracks) {
    if (t.laneNumber != null) max = Math.max(max, t.laneNumber);
  }
  return tracks.map((t) => {
    if (t.laneNumber != null) return t as T & { laneNumber: number };
    max += 1;
    return { ...t, laneNumber: max };
  });
}

export function se2StudioLaneNumberForTrack(
  tracks: readonly Se2LaneNumberedTrack[],
  trackId: string,
  fallbackIndex = -1,
): number {
  const t = tracks.find((x) => x.id === trackId);
  if (t?.laneNumber != null) return t.laneNumber;
  if (fallbackIndex >= 0) return fallbackIndex + 1;
  const i = tracks.findIndex((x) => x.id === trackId);
  return i >= 0 ? i + 1 : 0;
}

export function se2FormatTrackNumber(laneNumber: number, padWidth?: number): string {
  const w = padWidth ?? Math.max(2, String(laneNumber).length);
  return `T${String(laneNumber).padStart(w, '0')}`;
}

export function se2TrackNumberedName(
  laneNumber: number,
  name: string,
  padWidth?: number,
): string {
  return `${se2FormatTrackNumber(laneNumber, padWidth)} · ${name}`;
}

export function se2TrackNumberedNameById(
  tracks: readonly Se2LaneNumberedTrack[],
  trackId: string,
  fallbackIndex = -1,
): string {
  const t = tracks.find((x) => x.id === trackId);
  const n = se2StudioLaneNumberForTrack(tracks, trackId, fallbackIndex);
  const pad = Math.max(2, String(tracks.length).length);
  return se2TrackNumberedName(n, t?.name ?? 'Track', pad);
}
