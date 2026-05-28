/** Groove Lab shares Creation Station session tempo (40–240 BPM, 4/4). */
export const GROOVE_LAB_BPM_MIN = 40;
export const GROOVE_LAB_BPM_MAX = 240;
export const GROOVE_LAB_BPM_DEFAULT = 120;

export function clampGrooveLabBpm(bpm: number): number {
  if (!Number.isFinite(bpm)) return GROOVE_LAB_BPM_DEFAULT;
  return Math.max(GROOVE_LAB_BPM_MIN, Math.min(GROOVE_LAB_BPM_MAX, Math.round(bpm)));
}

/** One 4/4 bar in seconds at the given BPM. */
export function grooveLabSecPerBar(bpm: number): number {
  return (60 / Math.max(1, clampGrooveLabBpm(bpm))) * 4;
}

export function formatGrooveLabBarDuration(bpm: number): string {
  const sec = grooveLabSecPerBar(bpm);
  return sec >= 10 ? sec.toFixed(1) : sec.toFixed(2);
}
