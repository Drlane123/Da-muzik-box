/**
 * Lightweight bridge: engine emits glide (portamento) events → NEW SYNTH UI can animate meters.
 */

export type BeatLabSynthV2GlidePulse = {
  lane: number;
  fromMidi: number;
  toMidi: number;
  /** Matches Web Audio linear pitch ramp duration. */
  durationSec: number;
  /** performance.now() at emit (approx. note onset). */
  startPerfMs: number;
};

const listeners = new Set<(pulse: BeatLabSynthV2GlidePulse | null) => void>();

/** Fire when a glide actually runs (prior pitch → new pitch over durationSec). */
export function emitBeatLabSynthV2GlidePulse(
  partial: Omit<BeatLabSynthV2GlidePulse, 'startPerfMs'> & { startPerfMs?: number },
): void {
  const pulse: BeatLabSynthV2GlidePulse = {
    lane: partial.lane,
    fromMidi: partial.fromMidi,
    toMidi: partial.toMidi,
    durationSec: partial.durationSec,
    startPerfMs: partial.startPerfMs ?? performance.now(),
  };
  listeners.forEach((fn) => {
    fn(pulse);
  });
}

export function subscribeBeatLabSynthV2GlidePulse(
  listener: (pulse: BeatLabSynthV2GlidePulse | null) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function midiToShortLabel(midi: number): string {
  const m = Math.max(0, Math.min(127, Math.round(midi)));
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const o = Math.floor(m / 12) - 1;
  return `${names[m % 12] ?? 'C'}${o}`;
}
