/**
 * Browser-side **monophonic** pitch → MIDI helper (autocorrelation).
 * Best on single melody / bass / vocal takes; polyphonic material will be approximate noise.
 */

export type AudioToMidiNote = {
  pitch: number;
  startBeat: number;
  durationBeats: number;
  velocity: number;
};

const F_MIN = 65;
const F_MAX = 1200;
const ANALYSIS_SR = 22050;
const FRAME = 2048;
const HOP = 512;
const MIN_RMS = 0.012;
const MAX_ANALYSIS_SEC = 120;

function spbFromBpm(bpm: number): number {
  const b = Math.max(30, Math.min(300, bpm));
  return 60 / b;
}

/** Mix to mono and decimate toward ANALYSIS_SR. */
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

function frameRms(frame: Float32Array): number {
  let s = 0;
  for (let i = 0; i < frame.length; i++) s += frame[i] * frame[i];
  return Math.sqrt(s / frame.length);
}

function hann(i: number, n: number): number {
  return 0.5 * (1 - Math.cos((2 * Math.PI * i) / Math.max(1, n - 1)));
}

/** Return fundamental Hz or 0 if no clear pitch. */
function autocorrPitchHz(samples: Float32Array, start: number, sr: number): number {
  const lagMin = Math.max(2, Math.floor(sr / F_MAX));
  const lagMax = Math.min(FRAME - 2, Math.floor(sr / F_MIN));
  if (lagMax <= lagMin + 2) return 0;

  const win = new Float32Array(FRAME);
  for (let i = 0; i < FRAME; i++) {
    const x = samples[start + i] ?? 0;
    win[i] = x * hann(i, FRAME);
  }

  let bestLag = -1;
  let best = -Infinity;
  for (let lag = lagMin; lag <= lagMax; lag++) {
    let sum = 0;
    for (let i = 0; i < FRAME - lag; i++) sum += win[i]! * win[i + lag]!;
    if (sum > best) {
      best = sum;
      bestLag = lag;
    }
  }
  if (bestLag < 2 || best <= 0) return 0;

  let n0 = 0;
  for (let i = 0; i < FRAME - bestLag; i++) n0 += win[i]! * win[i]!;
  if (n0 < 1e-12) return 0;

  const f = sr / bestLag;
  if (!Number.isFinite(f) || f < F_MIN || f > F_MAX) return 0;
  return f;
}

function hzToMidi(f: number): number {
  return 69 + 12 * Math.log2(f / 440);
}

function median3(a: number, b: number, c: number): number {
  if ((a <= b && b <= c) || (c <= b && b <= a)) return b;
  if ((b <= a && a <= c) || (c <= a && a <= b)) return a;
  return c;
}

/**
 * Extract monophonic MIDI-like notes from decoded audio.
 * @param buffer — decoded `AudioBuffer` (any sample rate)
 * @param bpm — project tempo
 */
export function audioBufferToMonophonicMidiNotes(buffer: AudioBuffer, bpm: number): AudioToMidiNote[] {
  const spb = spbFromBpm(bpm);
  const { data, sr } = monoDecimate(buffer);
  const maxSamples = Math.min(data.length, Math.floor(MAX_ANALYSIS_SEC * sr));
  if (maxSamples < FRAME + HOP) return [];

  const pitches: number[] = [];
  const rmses: number[] = [];
  for (let start = 0; start + FRAME <= maxSamples; start += HOP) {
    const slice = data.subarray(start, start + FRAME);
    const r = frameRms(slice);
    rmses.push(r);
    if (r < MIN_RMS) {
      pitches.push(NaN);
      continue;
    }
    const hz = autocorrPitchHz(data, start, sr);
    pitches.push(hz > 0 ? hzToMidi(hz) : NaN);
  }

  const smooth: number[] = [];
  for (let i = 0; i < pitches.length; i++) {
    const a = pitches[i - 1];
    const b = pitches[i];
    const c = pitches[i + 1];
    if (!Number.isFinite(b)) {
      smooth.push(NaN);
      continue;
    }
    if (Number.isFinite(a) && Number.isFinite(c)) smooth.push(median3(a, b, c));
    else smooth.push(b);
  }

  const notes: AudioToMidiNote[] = [];
  let runStartFrame = -1;
  let runPitch = 0;
  let runVelSum = 0;
  let runVelN = 0;

  const flushRun = (endFrame: number) => {
    if (runStartFrame < 0) return;
    const startSec = (runStartFrame * HOP) / sr;
    const endSec = (endFrame * HOP) / sr;
    const durSec = Math.max(spb / 64, endSec - startSec);
    const startBeat = startSec / spb;
    const durationBeats = durSec / spb;
    const vel = Math.round(
      Math.max(1, Math.min(127, runVelN > 0 ? runVelSum / runVelN : 72)),
    );
    const pitch = Math.max(0, Math.min(127, Math.round(runPitch)));
    if (durationBeats >= 1 / 32) notes.push({ pitch, startBeat, durationBeats, velocity: vel });
    runStartFrame = -1;
  };

  for (let i = 0; i < smooth.length; i++) {
    const m = smooth[i];
    const rms = rmses[i] ?? 0;
    const velCand = Math.round(38 + Math.min(1, rms * 10) * 85);

    if (!Number.isFinite(m)) {
      flushRun(i);
      continue;
    }
    const midi = Math.round(m);
    if (runStartFrame < 0) {
      runStartFrame = i;
      runPitch = midi;
      runVelSum = velCand;
      runVelN = 1;
      continue;
    }
    if (Math.abs(midi - runPitch) <= 1) {
      runPitch = runPitch * 0.65 + midi * 0.35;
      runVelSum += velCand;
      runVelN += 1;
    } else {
      flushRun(i);
      runStartFrame = i;
      runPitch = midi;
      runVelSum = velCand;
      runVelN = 1;
    }
  }
  flushRun(smooth.length);

  notes.sort((a, b) => (a.startBeat !== b.startBeat ? a.startBeat - b.startBeat : a.pitch - b.pitch));
  return notes;
}
