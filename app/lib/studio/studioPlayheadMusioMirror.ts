/**
 * Mirror of musio-create’s display-side playhead smoothing (`TransportState` in
 * [musio-create/DAWCore](https://github.com/mpatti/musio-create/blob/main/DAWCore/Sources/DAWCore/Transport/TransportState.swift)):
 * audio engine publishes an authoritative beat; UI interpolates toward it on each display tick
 * (`CVDisplayLink` there ≈ `requestAnimationFrame` here) to reduce jitter.
 *
 * Optional — wire only if you want softer motion; **grid/MET lock** uses `displayBeatFloatGrid`
 * from {@link studioGridBeatFloatFromSnapshot} first.
 */
export const MUSIO_PLAYHEAD_SMOOTHING = 0.3;

export function lerpMusioSmoothPlayheadBeats(
  smoothBeats: number,
  targetBeats: number,
  smoothing: number = MUSIO_PLAYHEAD_SMOOTHING,
): number {
  const diff = targetBeats - smoothBeats;
  if (diff < -1) {
    return targetBeats;
  }
  const factor = diff > 0 ? smoothing : smoothing * 0.5;
  return smoothBeats + diff * factor;
}
