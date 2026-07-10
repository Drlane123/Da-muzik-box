/**
 * Studio Editor 2 — lightweight BPM + key analysis for Audio → MIDI clips (no ML, no stem separation).
 */

import type { AudioToMidiNote } from '@/app/lib/studio/audioToMidiNotes';
import { detectNeuralHumKey, NEURAL_HUM_KEY_NAMES } from '@/app/lib/vocalLab/neuralHumKeyLock';
import {
  studioConvertAudioBufferToMidiNotes,
  type StudioA2mMode,
} from '@/app/lib/studio/studioEditor2AudioToMidi';

const ANALYSIS_SR = 22050;
const FRAME = 2048;
const HOP = 512;
const MAX_ANALYSIS_SEC = 90;

export type StudioDetectedKeyMode = 'major' | 'minor';

export type StudioA2mClipAnalysis = {
  detectedBpm: number;
  keyRoot?: number;
  keyMode?: StudioDetectedKeyMode;
  localNotes: AudioToMidiNote[];
  durationBeats: number;
};

function monoDecimate(buffer: AudioBuffer): { data: Float32Array; sr: number } {
  const ch0 = buffer.getChannelData(0);
  const ch1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : null;
  const srIn = buffer.sampleRate;
  const ratio = srIn / ANALYSIS_SR;
  const nIn = buffer.length;
  const nOut = Math.max(1, Math.floor(nIn / ratio));
  const out = new Float32Array(nOut);
  for (let i = 0; i < nOut; i++) {
    const src = Math.min(nIn - 1, Math.floor(i * ratio));
    const a = ch0[src] ?? 0;
    const b = ch1 ? (ch1[src] ?? 0) : a;
    out[i] = (a + b) * 0.5;
  }
  return { data: out, sr: ANALYSIS_SR };
}

function onsetStrengthEnvelope(data: Float32Array): Float32Array {
  const nFrames = Math.max(0, Math.floor((data.length - FRAME) / HOP));
  const env = new Float32Array(nFrames);
  let prev = 0;
  for (let i = 0; i < nFrames; i++) {
    const start = i * HOP;
    let sum = 0;
    for (let j = 0; j < FRAME; j++) {
      const s = data[start + j] ?? 0;
      sum += s * s;
    }
    const rms = Math.sqrt(sum / FRAME);
    env[i] = Math.max(0, rms - prev);
    prev = rms * 0.92 + rms * 0.08;
  }
  return env;
}

/** Onset-peak IOI voting — best for drums/loops; falls back when signal is weak. */
export type DetectBpmOptions = {
  /** Track Align — snap toward session BPM when detection is a harmonic misread (e.g. 185 vs 140). */
  preferReference?: boolean;
};

const BPM_DETECT_MIN = 60;
const BPM_DETECT_MAX = 200;

function harmonicBpmCandidates(bpm: number): number[] {
  const out = new Set<number>();
  for (const r of [0.5, 2 / 3, 3 / 4, 1, 4 / 3, 3 / 2, 2]) {
    out.add(Math.round(bpm * r));
  }
  return [...out];
}

function voteSupportNear(votes: Map<number, number>, bpm: number): number {
  let sum = 0;
  for (let d = -2; d <= 2; d++) sum += votes.get(bpm + d) ?? 0;
  return sum;
}

/** Pick best tempo among detected, session BPM, and simple harmonic alternatives. */
export function reconcileDetectedBpmToReference(
  detected: number,
  reference: number,
  votes: Map<number, number>,
): number {
  const pool = new Set<number>([reference, detected]);
  for (const b of harmonicBpmCandidates(detected)) pool.add(b);
  for (const b of harmonicBpmCandidates(reference)) pool.add(b);

  let best = detected;
  let bestScore = -Infinity;
  for (const bpm of pool) {
    if (bpm < BPM_DETECT_MIN || bpm > BPM_DETECT_MAX) continue;
    const vote = voteSupportNear(votes, bpm);
    const refDist = Math.abs(bpm - reference);
    const refScore = refDist <= 2 ? 10 : refDist <= 5 ? 7 : refDist <= 10 ? 4 : refDist <= 18 ? 1 : 0;
    const score = vote + refScore;
    if (score > bestScore) {
      bestScore = score;
      best = bpm;
    }
  }
  return Math.max(40, Math.min(300, best));
}

function accumulateAutocorrelationVotes(
  env: Float32Array,
  hopSec: number,
  votes: Map<number, number>,
): void {
  const minLag = Math.max(1, Math.floor(60 / BPM_DETECT_MAX / hopSec));
  const maxLag = Math.min(env.length - 2, Math.floor(60 / BPM_DETECT_MIN / hopSec));
  if (maxLag <= minLag) return;

  const corrs: { lag: number; c: number }[] = [];
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    let n = 0;
    for (let i = 0; i < env.length - lag; i++) {
      sum += (env[i] ?? 0) * (env[i + lag] ?? 0);
      n++;
    }
    corrs.push({ lag, c: n > 0 ? sum / n : 0 });
  }
  corrs.sort((a, b) => b.c - a.c);
  for (let i = 0; i < Math.min(10, corrs.length); i++) {
    const row = corrs[i]!;
    const bpm = Math.round(60 / (row.lag * hopSec));
    if (bpm < BPM_DETECT_MIN || bpm > BPM_DETECT_MAX) continue;
    const weight = Math.max(1, Math.round(4 - i * 0.35));
    votes.set(bpm, (votes.get(bpm) ?? 0) + weight);
  }
}

export function detectBpmFromAudioBuffer(
  buffer: AudioBuffer,
  fallbackBpm = 120,
  options: DetectBpmOptions = {},
): number {
  const { preferReference = false } = options;
  const reference = Math.max(40, Math.min(300, Math.round(fallbackBpm)));
  const { data, sr } = monoDecimate(buffer);
  const maxSamples = Math.min(data.length, Math.floor(MAX_ANALYSIS_SEC * sr));
  if (maxSamples < FRAME + HOP * 8) return reference;

  const env = onsetStrengthEnvelope(data.subarray(0, maxSamples));
  if (env.length < 8) return reference;

  const sorted = [...env].filter((v) => v > 0).sort((a, b) => a - b);
  const ref = sorted[Math.floor(sorted.length * 0.65)] ?? 0;
  const gate = Math.max(0.002, ref * 1.35);

  const peaks: number[] = [];
  for (let i = 1; i < env.length - 1; i++) {
    const v = env[i] ?? 0;
    if (v < gate) continue;
    if (v >= (env[i - 1] ?? 0) && v >= (env[i + 1] ?? 0)) peaks.push(i);
  }

  const hopSec = HOP / sr;
  const votes = new Map<number, number>();
  accumulateAutocorrelationVotes(env, hopSec, votes);

  if (peaks.length >= 3) {
    for (let i = 1; i < peaks.length; i++) {
      const ioiSec = (peaks[i]! - peaks[i - 1]!) * hopSec;
      if (ioiSec < 0.18 || ioiSec > 2.5) continue;
      for (const mult of [0.25, 0.5, 1, 2]) {
        const beatSec = ioiSec * mult;
        const bpm = 60 / beatSec;
        if (bpm < BPM_DETECT_MIN || bpm > BPM_DETECT_MAX) continue;
        const rounded = Math.round(bpm);
        votes.set(rounded, (votes.get(rounded) ?? 0) + 1);
      }
    }
  }

  if (votes.size === 0) return reference;

  let best = reference;
  let bestVotes = -1;
  for (const [bpm, count] of votes) {
    if (
      count > bestVotes ||
      (count === bestVotes && Math.abs(bpm - reference) < Math.abs(best - reference))
    ) {
      bestVotes = count;
      best = bpm;
    }
  }

  const candidates = [best, Math.round(best / 2), Math.round(best * 2)].filter(
    (b) => b >= BPM_DETECT_MIN && b <= BPM_DETECT_MAX,
  );
  if (candidates.length > 1) {
    candidates.sort((a, b) => voteSupportNear(votes, b) - voteSupportNear(votes, a));
    best = candidates[0] ?? best;
  }

  if (preferReference) {
    if (bestVotes < 4) return reference;
    return reconcileDetectedBpmToReference(best, reference, votes);
  }

  return Math.max(40, Math.min(300, best));
}

/** Track Align import — reconcile vocal/loop detection toward the session tempo. */
export function detectBpmForTrackAlign(buffer: AudioBuffer, projectBpm: number): number {
  return detectBpmFromAudioBuffer(buffer, projectBpm, { preferReference: true });
}

function neuralHumScaleToKeyMode(scaleId: string): StudioDetectedKeyMode {
  if (
    scaleId === 'minor' ||
    scaleId === 'harmonic-minor' ||
    scaleId === 'minor-pentatonic' ||
    scaleId === 'phrygian'
  ) {
    return 'minor';
  }
  return 'major';
}

export function detectKeyFromMidiNotes(
  notes: ReadonlyArray<{ pitch: number; startBeat: number; durationBeats: number; velocity: number }>,
  bpm: number,
): { keyRoot: number; keyMode: StudioDetectedKeyMode } | null {
  if (notes.length === 0 || !Number.isFinite(bpm) || bpm <= 0) return null;
  const spb = 60 / Math.max(30, Math.min(300, bpm));
  const timed = notes.map((n) => ({
    pitch: n.pitch,
    startSec: n.startBeat * spb,
    durationSec: Math.max(1 / 64, n.durationBeats) * spb,
    velocity: n.velocity,
  }));
  const detected = detectNeuralHumKey(timed);
  if (!detected) return null;
  return {
    keyRoot: detected.keyRoot,
    keyMode: neuralHumScaleToKeyMode(detected.scaleId),
  };
}

export function studioKeyLabel(keyRoot: number, mode: StudioDetectedKeyMode = 'major'): string {
  const name = NEURAL_HUM_KEY_NAMES[((Math.round(keyRoot) % 12) + 12) % 12] ?? 'C';
  return `${name} ${mode}`;
}

/** Analyze clip → BPM, key, and beat-quantized notes at detected tempo. */
export function analyzeStudioA2mAudioClip(
  buffer: AudioBuffer,
  mode: StudioA2mMode,
  projectBpm: number,
): StudioA2mClipAnalysis {
  const detectedBpm = detectBpmFromAudioBuffer(buffer, projectBpm);
  const localNotes = studioConvertAudioBufferToMidiNotes(buffer, detectedBpm, mode);
  const spb = 60 / detectedBpm;
  const durationBeats = Math.max(1 / 16, buffer.duration / spb);

  let keyRoot: number | undefined;
  let keyMode: StudioDetectedKeyMode | undefined;
  if (mode !== 'drums') {
    const key = detectKeyFromMidiNotes(localNotes, detectedBpm);
    if (key) {
      keyRoot = key.keyRoot;
      keyMode = key.keyMode;
    }
  }

  return {
    detectedBpm,
    keyRoot,
    keyMode,
    localNotes,
    durationBeats,
  };
}

/** Scale pitch-class intervals relative to root (for piano-roll guides). */
export function studioScaleIntervals(mode: StudioDetectedKeyMode): readonly number[] {
  return mode === 'minor' ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
}
