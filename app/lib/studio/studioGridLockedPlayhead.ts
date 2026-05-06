/**
 * Rebuilt playhead ↔ metronome ↔ ruler “1–2–3–4” contract.
 *
 * The cyan line is painted imperatively every display frame (cheap). The **ruler bar/beat React state**
 * must **not** call `setState` every frame: doing so re-renders the whole Studio tree, starves
 * `requestAnimationFrame`, and the playhead **appears** to skip beats even when `AudioContext` phase is correct.
 *
 * Publish ruler updates only when the **global quarter index** (same grid as MET quarters) changes.
 */
export type StudioRulerQuarterGate = {
  /** Last published `floor(gridBeatMono)`; `null` = force next publish. */
  lastGlobalQuarter0: number | null;
};

export function createRulerQuarterGate(): StudioRulerQuarterGate {
  return { lastGlobalQuarter0: null };
}

export function globalQuarterIndex0FromGridBeat(beatMono: number): number {
  return Math.floor(Math.max(0, beatMono) + 1e-9);
}

/** Returns whether React should publish bar/beat for ruler cells; mutates `gate`. */
export function shouldPublishRulerQuarter(
  gate: StudioRulerQuarterGate,
  beatMonoGrid: number,
): boolean {
  if (!Number.isFinite(beatMonoGrid)) return false;
  const q = globalQuarterIndex0FromGridBeat(beatMonoGrid);
  if (gate.lastGlobalQuarter0 === q) return false;
  gate.lastGlobalQuarter0 = q;
  return true;
}

export function resetRulerQuarterGate(gate: StudioRulerQuarterGate): void {
  gate.lastGlobalQuarter0 = null;
}
