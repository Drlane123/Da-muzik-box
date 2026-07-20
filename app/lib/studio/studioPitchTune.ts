/**
 * Pitch Tune — frame-based pitch correction for Studio mixer vocal FX.
 * Retune speed, flex-tune, humanize, and scale-aware snap (Antares-style controls).
 */
import { detectPitchACF, frequencyToMidiNote } from '@/app/lib/pitchDetection';
import {
  applyFormantCompensation,
  expandHopRatesToSampleRates,
  pitchShiftOlaVariableRate,
} from '@/app/lib/studio/studioPitchShiftOla';
import type { StudioMidiPitchTargetEvent } from '@/app/lib/studio/studioVocoderCarrier';
import {
  neuralHumScaleMeta,
  snapMidiToNeuralHumScale,
  type NeuralHumScaleId,
} from '@/app/lib/vocalLab/neuralHumKeyLock';

export type PitchTuneScaleId = NeuralHumScaleId | 'chromatic';

export type PitchTuneParams = {
  /** 0–1 correction amount toward scale */
  strength: number;
  /** 0 = instant (robot); 10–50 natural; 80+ loose */
  retuneSpeedMs: number;
  /** 0–1 preserve intentional pitch gestures */
  flexTune: number;
  /** 0–1 slower correction on sustained notes */
  humanize: number;
  keyRoot: number;
  scaleId: PitchTuneScaleId;
  /** 0–1 pitch tracking sensitivity (higher = more forgiving / breathy) */
  tracking: number;
  /** 0–1 formant preservation when correcting pitch (Antares throat model) */
  formantPreserve?: number;
  /** When set, correct toward MIDI lane pitch at each time (Auto-Tune MIDI mode) */
  midiTargetTimeline?: readonly StudioMidiPitchTargetEvent[];
};

const F_MIN = 60;
const F_MAX = 1400;
const PITCH_FRAME = 2048;
/** Was 128 — offline Pitch Tune on long takes locked the main thread. */
const PITCH_HOP = 512;
const ANALYZE_YIELD_EVERY = 64;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function yieldToMain(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

function frameRms(frame: Float32Array): number {
  let s = 0;
  for (let i = 0; i < frame.length; i++) s += frame[i]! * frame[i]!;
  return Math.sqrt(s / frame.length);
}

function autocorrPitchHz(samples: Float32Array, start: number, sr: number): number {
  const slice = samples.subarray(start, start + PITCH_FRAME);
  const { frequency } = detectPitchACF(slice, sr, F_MIN, F_MAX, 0.05);
  return frequency > 0 ? frequency : 0;
}

function bufferToMono(buffer: AudioBuffer): Float32Array {
  const ch0 = buffer.getChannelData(0);
  if (buffer.numberOfChannels === 1) return ch0.slice();
  const ch1 = buffer.getChannelData(1);
  const out = new Float32Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) out[i] = (ch0[i]! + ch1[i]!) * 0.5;
  return out;
}

function linearAt(samples: Float32Array, idx: number): number {
  const i0 = Math.floor(idx);
  const i1 = Math.min(samples.length - 1, i0 + 1);
  const f = idx - i0;
  return samples[i0]! * (1 - f) + samples[i1]! * f;
}

type PitchNode = { sample: number; midi: number; voiced: boolean };

async function analyzePitchNodes(
  samples: Float32Array,
  sr: number,
  tracking: number,
): Promise<PitchNode[]> {
  const nodes: PitchNode[] = [];
  const track = clamp(tracking, 0, 1);
  /* Higher tracking → lower gate (more sensitive / breathy). */
  let gate = 0.0018 + (1 - track) * 0.008;
  const rmsList: number[] = [];
  for (let start = 0; start + PITCH_FRAME <= samples.length; start += PITCH_HOP) {
    rmsList.push(frameRms(samples.subarray(start, start + PITCH_FRAME)));
  }
  const sorted = rmsList.filter((r) => r > 0.00025).sort((a, b) => a - b);
  if (sorted.length > 0) {
    const pct = 0.02 + (1 - track) * 0.1;
    const floor = sorted[Math.floor(sorted.length * pct)]!;
    gate = Math.max(0.00035 + (1 - track) * 0.0012, Math.min(0.014, floor * (0.12 + (1 - track) * 0.28)));
  }

  let work = 0;
  for (let fi = 0, start = 0; start + PITCH_FRAME <= samples.length; start += PITCH_HOP, fi++) {
    const rms = rmsList[fi] ?? 0;
    if (rms < gate) {
      nodes.push({ sample: start + PITCH_FRAME * 0.5, midi: NaN, voiced: false });
      continue;
    }
    const hz = autocorrPitchHz(samples, start, sr);
    nodes.push({
      sample: start + PITCH_FRAME * 0.5,
      midi: hz > 0 ? frequencyToMidiNote(hz) : NaN,
      voiced: hz > 0,
    });
    work += 1;
    if (work % ANALYZE_YIELD_EVERY === 0) await yieldToMain();
  }
  return nodes;
}

function snapMidi(params: PitchTuneParams, midi: number): number {
  if (params.scaleId === 'chromatic') {
    return clamp(Math.round(midi), 36, 84);
  }
  return clamp(snapMidiToNeuralHumScale(midi, params.keyRoot, params.scaleId), 36, 84);
}

function localPitchVariance(nodes: PitchNode[], idx: number): number {
  let sum = 0;
  let count = 0;
  for (let j = idx - 2; j <= idx + 2; j++) {
    if (j < 0 || j >= nodes.length) continue;
    const m = nodes[j]!.midi;
    if (!Number.isFinite(m)) continue;
    sum += m;
    count++;
  }
  if (count < 2) return 0;
  const mean = sum / count;
  let varSum = 0;
  for (let j = idx - 2; j <= idx + 2; j++) {
    if (j < 0 || j >= nodes.length) continue;
    const m = nodes[j]!.midi;
    if (!Number.isFinite(m)) continue;
    const d = m - mean;
    varSum += d * d;
  }
  return Math.sqrt(varSum / count);
}

function sustainedFactor(nodes: PitchNode[], idx: number): number {
  let run = 0;
  for (let j = idx; j >= 0 && nodes[j]!.voiced; j--) run++;
  for (let j = idx + 1; j < nodes.length && nodes[j]!.voiced; j++) run++;
  return clamp((run - 4) / 14, 0, 1);
}

function smoothAlpha(retuneMs: number, hopSec: number): number {
  if (retuneMs <= 0.5) return 1;
  const hopMs = hopSec * 1000;
  return 1 - Math.exp(-hopMs / retuneMs);
}

function lerpAtNodes(nodes: PitchNode[], values: number[], samplePos: number): number {
  if (nodes.length === 0) return NaN;
  if (samplePos <= nodes[0]!.sample) return values[0]!;
  const last = nodes.length - 1;
  if (samplePos >= nodes[last]!.sample) return values[last]!;

  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (nodes[mid]!.sample <= samplePos) lo = mid;
    else hi = mid;
  }
  const a = nodes[lo]!;
  const b = nodes[hi]!;
  const va = values[lo]!;
  const vb = values[hi]!;
  if (!Number.isFinite(va)) return vb;
  if (!Number.isFinite(vb)) return va;
  const t = (samplePos - a.sample) / Math.max(1, b.sample - a.sample);
  return va + (vb - va) * t;
}

/** Deterministic micro-wobble for humanize (cents). */
function humanizeCents(sample: number, humanize: number): number {
  if (humanize < 0.02) return 0;
  const x = Math.sin(sample * 0.0031) * 0.6 + Math.sin(sample * 0.0077) * 0.4;
  return x * humanize * 14;
}

function midiTargetAtTimeline(
  timeline: readonly StudioMidiPitchTargetEvent[],
  tSec: number,
): number | null {
  if (timeline.length === 0) return null;
  let active: StudioMidiPitchTargetEvent | null = null;
  for (const ev of timeline) {
    if (ev.tSec <= tSec + 1e-6) active = ev;
    else break;
  }
  return active?.pitch ?? null;
}

/**
 * Offline pitch correction — returns processed mono samples (may be shorter/longer than input).
 * Async so long takes can yield to the UI (sync ACF used to freeze the tab).
 */
export async function applyPitchTuneSamples(
  samples: Float32Array,
  sr: number,
  params: PitchTuneParams,
): Promise<Float32Array> {
  const strength = clamp(params.strength, 0, 1);
  if (strength < 0.02) return samples.slice();

  await yieldToMain();

  const track = clamp(params.tracking, 0, 1);
  const nodes = await analyzePitchNodes(samples, sr, track);
  if (nodes.length === 0) return samples.slice();

  const hopSec = PITCH_HOP / sr;
  const flex = clamp(params.flexTune, 0, 1);
  const humanize = clamp(params.humanize, 0, 1);
  const speedMs = Math.max(0, params.retuneSpeedMs);

  const detected: number[] = nodes.map((n) => (n.voiced && Number.isFinite(n.midi) ? n.midi : NaN));

  const rawTargets: number[] = nodes.map((n, i) => {
    if (!n.voiced || !Number.isFinite(n.midi)) return NaN;
    const timeSec = n.sample / sr;
    const midiFromLane =
      params.midiTargetTimeline && params.midiTargetTimeline.length > 0
        ? midiTargetAtTimeline(params.midiTargetTimeline, timeSec)
        : null;
    const snapped =
      midiFromLane != null ? clamp(midiFromLane, 36, 84) : snapMidi(params, n.midi);
    const semisOff = Math.abs(snapped - n.midi);
    const motion = clamp(localPitchVariance(nodes, i) / 0.4, 0, 1);
    const nearSnap = clamp(1 - semisOff / 0.65, 0, 1);
    const flexPreserve = clamp(motion * 0.75 + nearSnap * 0.35, 0, 1);
    const flexMul = 1 - flex * flexPreserve;
    const trackBlend = 0.25 + track * 0.75;
    const hum = humanizeCents(n.sample, humanize) / 100;
    const corrected = n.midi + hum + (snapped - n.midi - hum) * strength * flexMul * trackBlend;
    return corrected;
  });

  const smoothed: number[] = rawTargets.map((t) => t);
  let prev = NaN;
  for (let i = 0; i < smoothed.length; i++) {
    const t = rawTargets[i]!;
    if (!Number.isFinite(t)) {
      smoothed[i] = Number.isFinite(prev) ? prev : NaN;
      continue;
    }
    const sustain = sustainedFactor(nodes, i);
    const effMs = (speedMs <= 0.5 ? 0 : speedMs) * (1 + humanize * 2.5 + sustain * humanize * 3);
    const alpha = smoothAlpha(effMs, hopSec);
    if (!Number.isFinite(prev)) prev = t;
    smoothed[i] = prev + (t - prev) * alpha;
    prev = smoothed[i]!;
  }

  const hopRates = new Float32Array(Math.ceil(samples.length / PITCH_HOP) + 2);
  const correctionSemisHop = new Float32Array(hopRates.length);
  for (let hi = 0; hi < hopRates.length; hi++) {
    const sampleAt = hi * PITCH_HOP + PITCH_FRAME * 0.25;
    const detMidi = lerpAtNodes(nodes, detected, sampleAt);
    const targetMidi = lerpAtNodes(nodes, smoothed, sampleAt);
    let rate = 1;
    if (Number.isFinite(detMidi) && Number.isFinite(targetMidi)) {
      correctionSemisHop[hi] = targetMidi - detMidi;
      rate = Math.pow(2, correctionSemisHop[hi]! / 12);
      rate = clamp(rate, 0.5, 2);
    }
    hopRates[hi] = rate;
  }

  const sampleRates = expandHopRatesToSampleRates(hopRates, PITCH_HOP, Math.ceil(samples.length * 1.35));
  let out = pitchShiftOlaVariableRate(samples, sampleRates);

  const formantPreserve = clamp(params.formantPreserve ?? 0.88, 0, 1);
  if (formantPreserve > 0.02) {
    let semisSum = 0;
    let semisN = 0;
    for (let hi = 0; hi < correctionSemisHop.length; hi++) {
      const s = correctionSemisHop[hi]!;
      if (Math.abs(s) > 0.05) {
        semisSum += s;
        semisN++;
      }
    }
    const avgCorrection = semisN > 0 ? semisSum / semisN : 0;
    out = applyFormantCompensation(out, sr, avgCorrection, formantPreserve);
  }

  return out.subarray(0, Math.min(out.length, Math.ceil(samples.length * 1.25)));
}

export async function renderPitchTuneBuffer(
  source: AudioBuffer,
  params: PitchTuneParams,
): Promise<AudioBuffer> {
  await yieldToMain();
  const mono = bufferToMono(source);
  const processed = await applyPitchTuneSamples(mono, source.sampleRate, params);
  const offline = new OfflineAudioContext(
    source.numberOfChannels,
    Math.max(1, processed.length),
    source.sampleRate,
  );
  const out = offline.createBuffer(source.numberOfChannels, processed.length, source.sampleRate);
  for (let ch = 0; ch < source.numberOfChannels; ch++) {
    out.copyToChannel(processed, ch);
  }
  return out;
}

export function pitchTuneScaleLabel(scaleId: PitchTuneScaleId): string {
  if (scaleId === 'chromatic') return 'Chromatic';
  return neuralHumScaleMeta(scaleId).label;
}

export const PITCH_TUNE_SCALE_OPTIONS: readonly { id: PitchTuneScaleId; label: string }[] = [
  { id: 'chromatic', label: 'Chromatic' },
  { id: 'major', label: 'Major' },
  { id: 'minor', label: 'Minor' },
  { id: 'harmonic-minor', label: 'Harm min' },
  { id: 'major-pentatonic', label: 'Maj pent' },
  { id: 'minor-pentatonic', label: 'Min pent' },
  { id: 'blues', label: 'Blues' },
  { id: 'dorian', label: 'Dorian' },
  { id: 'phrygian', label: 'Phrygian' },
  { id: 'lydian', label: 'Lydian' },
  { id: 'mixolydian', label: 'Mix' },
] as const;

export function pitchTuneParamsFromTrackFx(
  fx: {
    autotuneStrength: number;
    pitchRetuneMs: number;
    pitchFlex: number;
    pitchHumanize: number;
    pitchScaleId: PitchTuneScaleId;
    pitchTracking: number;
  },
  keyRoot: number,
  opts?: { midiTargetTimeline?: readonly StudioMidiPitchTargetEvent[] },
): PitchTuneParams {
  return {
    strength: fx.autotuneStrength,
    retuneSpeedMs: fx.pitchRetuneMs,
    flexTune: fx.pitchFlex,
    humanize: fx.pitchHumanize,
    keyRoot,
    scaleId: fx.pitchScaleId,
    tracking: fx.pitchTracking,
    formantPreserve: 0.85 + fx.pitchHumanize * 0.12,
    midiTargetTimeline: opts?.midiTargetTimeline,
  };
}
