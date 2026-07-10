/** Synth Geno — standard Western tuning (A440, 100% key tracking). */

/** Key scale / tracking factor — 1.0 = one semitone per key. */
export const GENO_KEY_TRACKING_FACTOR = 1.0;

/** MIDI note for reference pitch (A4). */
export const GENO_REFERENCE_MIDI = 69;

/** Global reference pitch — standard A = 440 Hz. */
export const GENO_REFERENCE_HZ = 440;

/** Convert MIDI note → Hz with normalized key tracking. */
export function se2SynthGenoMidiToHz(
  midiNote: number,
  keyTrackingFactor = GENO_KEY_TRACKING_FACTOR,
): number {
  const midi = Math.max(0, Math.min(127, midiNote));
  return (
    GENO_REFERENCE_HZ *
    2 ** (((midi - GENO_REFERENCE_MIDI) * keyTrackingFactor) / 12)
  );
}

/** Oscillator detune in cents from coarse (semitones) + fine (cents). */
export function se2SynthGenoOscDetuneCents(
  coarseSemitones = 0,
  fineCents = 0,
): number {
  return coarseSemitones * 100 + fineCents;
}
