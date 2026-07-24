/**
 * Hum Melody mic → MIDI (Dodo Quick Mode):
 * soft AGC → ACF → chromatic MIDI. Key lock is applied later only if the user enables it.
 */
import { detectPitchACF } from '@/app/lib/pitchDetection';

export type HumMidiFrame = {
  midi: number;
  /** Unrounded continuous MIDI for hysteresis. */
  midiFloat: number;
  hz: number;
  confidence: number;
  rms: number;
  pitchClass: number;
};

const TARGET_RMS = 0.12;
const MAX_COMP_GAIN = 7;
const MIDI_MEDIAN_LEN = 3;
/** Quick Mode — leave current pitch when we move ~½ semi. */
const MIDI_HYSTERESIS_SEMIS = 0.5;

/** In-place soft compressor toward TARGET_RMS (analysis only — never to speakers). */
export function compressHumAnalysisBuffer(buf: Float32Array, prevGain: number): number {
  let energy = 0;
  for (let i = 0; i < buf.length; i += 1) {
    const v = buf[i] ?? 0;
    energy += v * v;
  }
  const rms = Math.sqrt(energy / Math.max(1, buf.length));
  if (rms < 1e-6) return prevGain * 0.9;

  let gain = TARGET_RMS / rms;
  gain = Math.max(1 / MAX_COMP_GAIN, Math.min(MAX_COMP_GAIN, gain));
  // Smooth gain changes (attack/release style).
  const smoothed = prevGain * 0.82 + gain * 0.18;
  for (let i = 0; i < buf.length; i += 1) {
    buf[i] = Math.max(-1, Math.min(1, (buf[i] ?? 0) * smoothed));
  }
  return smoothed;
}

function medianInt(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2);
}

/**
 * Soft scale snap — only pull to key if already within `maxSemis`.
 * Farther tones stay chromatic so the sung melody isn’t rewritten.
 * `scalePcs` = absolute pitch classes 0–11 (from neuralHumScalePitchClasses).
 */
export function softSnapMidiToScale(
  midi: number,
  scalePcs: readonly number[],
  maxSemis: number = 0.55,
): number {
  if (scalePcs.length === 0) return Math.round(midi);
  const center = midi;
  const baseOct = Math.floor(Math.round(center) / 12);
  let best = Math.round(center);
  let bestDist = Infinity;
  for (let oct = baseOct - 2; oct <= baseOct + 2; oct += 1) {
    for (const pc of scalePcs) {
      const candidate = oct * 12 + (((pc % 12) + 12) % 12);
      if (candidate < 0 || candidate > 127) continue;
      const dist = Math.abs(candidate - center);
      if (dist < bestDist) {
        bestDist = dist;
        best = candidate;
      }
    }
  }
  if (bestDist <= maxSemis) return best;
  return Math.round(center);
}

export type HumPitchTrackerState = {
  compGain: number;
  midiHistory: number[];
  stableMidi: number | null;
  stableFloat: number | null;
};

export function createHumPitchTrackerState(): HumPitchTrackerState {
  return { compGain: 1, midiHistory: [], stableMidi: null, stableFloat: null };
}

/**
 * One analysis frame: compress → ACF → median MIDI → octave continuity.
 */
export function trackHumPitchFrame(
  buf: Float32Array,
  sampleRate: number,
  state: HumPitchTrackerState,
  opts: {
    minConfidence: number;
    minRms: number;
    fMinHz: number;
    fMaxHz: number;
  },
): HumMidiFrame | null {
  state.compGain = compressHumAnalysisBuffer(buf, state.compGain);

  let energy = 0;
  for (let i = 0; i < buf.length; i += 1) {
    const v = buf[i] ?? 0;
    energy += v * v;
  }
  const rms = Math.sqrt(energy / Math.max(1, buf.length));
  if (rms < opts.minRms) {
    state.midiHistory = [];
    return null;
  }

  const { frequency, confidence } = detectPitchACF(
    buf,
    sampleRate,
    opts.fMinHz,
    opts.fMaxHz,
    Math.max(0.045, opts.minConfidence * 0.12),
  );
  if (!(frequency > 0) || confidence < opts.minConfidence) {
    return null;
  }

  let midiFloat = 69 + 12 * Math.log2(frequency / 440);
  // Octave continuity vs last stable note (common ACF error).
  if (state.stableFloat != null) {
    while (midiFloat - state.stableFloat > 7) midiFloat -= 12;
    while (state.stableFloat - midiFloat > 7) midiFloat += 12;
  }
  midiFloat = Math.max(0, Math.min(127, midiFloat));

  const rounded = Math.round(midiFloat);
  state.midiHistory.push(rounded);
  if (state.midiHistory.length > MIDI_MEDIAN_LEN) state.midiHistory.shift();
  const med = medianInt(state.midiHistory);

  // Hysteresis: stick until we move clearly off the stable float.
  if (state.stableFloat == null || state.stableMidi == null) {
    state.stableFloat = midiFloat;
    state.stableMidi = med;
  } else if (Math.abs(midiFloat - state.stableFloat) >= MIDI_HYSTERESIS_SEMIS) {
    state.stableFloat = midiFloat;
    state.stableMidi = med;
  } else {
    state.stableFloat = state.stableFloat * 0.75 + midiFloat * 0.25;
    state.stableMidi = Math.round(state.stableFloat);
  }

  const midi = Math.max(0, Math.min(127, state.stableMidi));
  return {
    midi,
    midiFloat: state.stableFloat,
    hz: frequency,
    confidence,
    rms,
    pitchClass: ((midi % 12) + 12) % 12,
  };
}
