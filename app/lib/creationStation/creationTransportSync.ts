/**
 * Creation Station — shared **musical beat** from audio-domain time (seconds).
 * Playhead / HUD / grid all use this one function so they cannot disagree.
 */

/**
 * Metronome click gain ramp — must match `scheduleMetronomeClickAt` in Creation Station
 * (`exponentialRampToValueAtTime(..., tSafe + this)`).
 */
export const CREATION_METRO_CLICK_ATTACK_SEC = 0.002;

export function beatAtSessionTime(
  t: number,
  sessionStartAudio: number,
  originBeat: number,
  bpm: number,
): number {
  const spb = 60 / Math.max(1, bpm);
  const b = originBeat + Math.max(0, t - sessionStartAudio) / spb;
  return Math.max(0, b);
}
