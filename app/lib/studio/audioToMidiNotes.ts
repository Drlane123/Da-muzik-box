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

/** Seconds-based note — BPM-independent (Neural Hum, offline render). */
export type TimedMonophonicNote = {
  pitch: number;
  startSec: number;
  durationSec: number;
  velocity: number;
};

type PitchRun = {
  pitch: number;
  startFrame: number;
  endFrame: number;
  velocity: number;
};

const F_MIN = 50;
const F_MAX = 1600;
const ANALYSIS_SR = 22050;
const FRAME = 2048;
const HOP = 256;
/** Lower = quieter hums still register. */
const MIN_RMS = 0.0025;
/** Lower = accept less-perfect pitch tracking. */
const MIN_PITCH_CLARITY = 0.14;
/** Vibrato tolerance inside one sung note (~0.65 semitone). Real pitch jumps still split. */
const PITCH_RUN_TOLERANCE = 0.65;
/** Bridge brief dropouts inside one sung note (~58 ms at hop 256 / 22.05 kHz). */
const MAX_VOICED_GAP_FRAMES = 5;
const MAX_ANALYSIS_SEC = 120;

/** Optional pitch-extract knobs (808 Lab Hum Box uses a stickier bass profile). */
export type MonophonicPitchExtractOpts = {
  fMinHz?: number;
  fMaxHz?: number;
  minRms?: number;
  minPitchClarity?: number;
  /** Semitones — how far pitch may wander inside one held note. */
  pitchRunTolerance?: number;
  /** Bridge unvoiced frames inside one held note (~11.6 ms each at default hop). */
  maxVoicedGapFrames?: number;
};

/**
 * Stickier / more sensitive extract for hummed 808 bass —
 * quieter gate, longer dropout bridge, wider vibrato, lower bass floor.
 */
export const MONOPHONIC_PITCH_EXTRACT_HUM_BASS: Readonly<Required<MonophonicPitchExtractOpts>> = {
  fMinHz: 38,
  fMaxHz: 900,
  minRms: 0.0014,
  minPitchClarity: 0.09,
  pitchRunTolerance: 1.85,
  maxVoicedGapFrames: 34, // ~395 ms bridge so held notes don't pop out
};

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
function autocorrPitchHz(
  samples: Float32Array,
  start: number,
  sr: number,
  opts?: MonophonicPitchExtractOpts,
): number {
  const fMin = opts?.fMinHz ?? F_MIN;
  const fMax = opts?.fMaxHz ?? F_MAX;
  const minClarity = opts?.minPitchClarity ?? MIN_PITCH_CLARITY;
  const lagMin = Math.max(2, Math.floor(sr / fMax));
  const lagMax = Math.min(FRAME - 2, Math.floor(sr / fMin));
  if (lagMax <= lagMin + 2) return 0;

  const win = new Float32Array(FRAME);
  for (let i = 0; i < FRAME; i++) {
    const x = samples[start + i] ?? 0;
    win[i] = x * hann(i, FRAME);
  }

  let r0 = 0;
  for (let i = 0; i < FRAME; i++) r0 += win[i]! * win[i]!;
  if (r0 < 1e-12) return 0;

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

  let rLag = 0;
  for (let i = 0; i < FRAME - bestLag; i++) rLag += win[i + bestLag]! * win[i + bestLag]!;
  const clarity = best / Math.sqrt(r0 * rLag + 1e-12);
  if (clarity < minClarity) return 0;

  // Prefer fundamental over octave-doubled partial (common on hums / whistles).
  const doubleLag = bestLag * 2;
  if (doubleLag <= lagMax) {
    let doubleSum = 0;
    for (let i = 0; i < FRAME - doubleLag; i++) doubleSum += win[i]! * win[i + doubleLag]!;
    if (doubleSum > best * 0.82) {
      bestLag = doubleLag;
      best = doubleSum;
    }
  }

  const halfLag = Math.round(bestLag / 2);
  if (halfLag >= lagMin) {
    let halfSum = 0;
    for (let i = 0; i < FRAME - halfLag; i++) halfSum += win[i]! * win[i + halfLag]!;
    if (halfSum > best * 0.9) bestLag = halfLag;
  }

  const f = sr / bestLag;
  if (!Number.isFinite(f) || f < fMin || f > fMax) return 0;
  return f;
}

function adaptiveRmsGate(rmses: readonly number[], minRms = MIN_RMS): number {
  const voiced = rmses.filter((r) => r > 0.0004).sort((a, b) => a - b);
  if (voiced.length === 0) return minRms;
  const ref = voiced[Math.floor(voiced.length * 0.12)] ?? minRms;
  return Math.max(minRms * 0.55, Math.min(minRms, ref * 0.22));
}

function hzToMidi(f: number): number {
  return 69 + 12 * Math.log2(f / 440);
}

function median3(a: number, b: number, c: number): number {
  if ((a <= b && b <= c) || (c <= b && b <= a)) return b;
  if ((b <= a && a <= c) || (c <= a && a <= b)) return a;
  return c;
}

/** Shared autocorrelation pass — frame indices for timed or beat-quantized output. */
function extractMonophonicPitchRuns(
  buffer: AudioBuffer,
  opts?: MonophonicPitchExtractOpts,
): PitchRun[] {
  const { data, sr } = monoDecimate(buffer);
  const maxSamples = Math.min(data.length, Math.floor(MAX_ANALYSIS_SEC * sr));
  if (maxSamples < FRAME + HOP) return [];

  const minRms = opts?.minRms ?? MIN_RMS;
  const pitchTol = opts?.pitchRunTolerance ?? PITCH_RUN_TOLERANCE;
  const maxGap = opts?.maxVoicedGapFrames ?? MAX_VOICED_GAP_FRAMES;

  const rmses: number[] = [];
  for (let start = 0; start + FRAME <= maxSamples; start += HOP) {
    rmses.push(frameRms(data.subarray(start, start + FRAME)));
  }

  const gate = adaptiveRmsGate(rmses, minRms);
  const pitches: number[] = [];
  for (let i = 0, start = 0; start + FRAME <= maxSamples; start += HOP, i++) {
    if ((rmses[i] ?? 0) < gate) {
      pitches.push(NaN);
      continue;
    }
    const hz = autocorrPitchHz(data, start, sr, opts);
    pitches.push(hz > 0 ? hzToMidi(hz) : NaN);
  }

  const smooth: number[] = [];
  for (let i = 0; i < pitches.length; i++) {
    const a = pitches[i - 1];
    const b = pitches[i];
    const c = pitches[i + 1];
    if (!Number.isFinite(b)) {
      // Hold last pitch across a 1-frame dropout when neighbors agree (sticky hold).
      if (
        Number.isFinite(a) &&
        Number.isFinite(c) &&
        Math.abs((a as number) - (c as number)) <= pitchTol
      ) {
        smooth.push(((a as number) + (c as number)) * 0.5);
      } else {
        smooth.push(NaN);
      }
      continue;
    }
    // Only smooth steady pitch — preserve fast jumps between notes.
    if (
      Number.isFinite(a) &&
      Number.isFinite(c) &&
      Math.abs(a - c) < 1.35 &&
      Math.abs(b - a) < 0.95 &&
      Math.abs(c - b) < 0.95
    ) {
      smooth.push(median3(a, b, c));
    } else {
      smooth.push(b);
    }
  }

  const runs: PitchRun[] = [];
  let runStartFrame = -1;
  let runPitch = 0;
  let runVelSum = 0;
  let runVelN = 0;
  let gapFrames = 0;

  const flushRun = (endFrame: number) => {
    if (runStartFrame < 0) return;
    const vel = Math.round(
      Math.max(1, Math.min(127, runVelN > 0 ? runVelSum / runVelN : 72)),
    );
    const pitch = Math.max(0, Math.min(127, Math.round(runPitch)));
    const frameDur = endFrame - runStartFrame;
    if (frameDur >= 1) {
      runs.push({ pitch, startFrame: runStartFrame, endFrame, velocity: vel });
    }
    runStartFrame = -1;
    gapFrames = 0;
  };

  for (let i = 0; i < smooth.length; i++) {
    const m = smooth[i];
    const rms = rmses[i] ?? 0;
    const velCand = Math.round(34 + Math.min(1, rms * 14) * 88);

    if (!Number.isFinite(m)) {
      if (runStartFrame >= 0) {
        gapFrames += 1;
        if (gapFrames <= maxGap) {
          runVelSum += velCand * 0.45;
          runVelN += 0.45;
          continue;
        }
        flushRun(i - gapFrames);
      }
      continue;
    }

    gapFrames = 0;
    if (runStartFrame < 0) {
      runStartFrame = i;
      runPitch = m;
      runVelSum = velCand;
      runVelN = 1;
      continue;
    }
    if (Math.abs(m - runPitch) <= pitchTol) {
      runPitch = runPitch * 0.62 + m * 0.38;
      runVelSum += velCand;
      runVelN += 1;
    } else {
      flushRun(i);
      runStartFrame = i;
      runPitch = m;
      runVelSum = velCand;
      runVelN = 1;
    }
  }
  flushRun(smooth.length);
  return runs;
}

/**
 * Extract monophonic notes with wall-clock timing (no BPM required).
 * Used by Neural Hum-to-Instrument offline render.
 */
export function audioBufferToMonophonicTimedNotes(
  buffer: AudioBuffer,
  opts?: MonophonicPitchExtractOpts,
): TimedMonophonicNote[] {
  const { sr } = monoDecimate(buffer);
  const minDurSec = 0.016;
  const notes = extractMonophonicPitchRuns(buffer, opts).map((run) => {
    const startSec = (run.startFrame * HOP) / sr;
    const endSec = (run.endFrame * HOP) / sr;
    return {
      pitch: run.pitch,
      startSec,
      durationSec: Math.max(minDurSec, endSec - startSec),
      velocity: run.velocity,
    };
  });
  notes.sort((a, b) => (a.startSec !== b.startSec ? a.startSec - b.startSec : a.pitch - b.pitch));
  return notes;
}

/**
 * Extract monophonic MIDI-like notes from decoded audio.
 * @param buffer — decoded `AudioBuffer` (any sample rate)
 * @param bpm — project tempo
 */
export function audioBufferToMonophonicMidiNotes(buffer: AudioBuffer, bpm: number): AudioToMidiNote[] {
  const spb = spbFromBpm(bpm);
  const timed = audioBufferToMonophonicTimedNotes(buffer);
  return timed.map((t) => ({
    pitch: t.pitch,
    startBeat: t.startSec / spb,
    durationBeats: Math.max(spb / 64, t.durationSec) / spb,
    velocity: t.velocity,
  }));
}

/** Brightness ratio in a frame — higher = more transient / hat-like. */
function frameBrightness(samples: Float32Array, start: number): number {
  let low = 0;
  let high = 0;
  for (let i = 0; i < FRAME - 1; i++) {
    const s = samples[start + i] ?? 0;
    const d = (samples[start + i + 1] ?? 0) - s;
    low += s * s;
    high += d * d;
  }
  return high / (low + high + 1e-12);
}

/**
 * Clip-level drum hit detection (onset peaks → GM drum map). Not full-song stem separation.
 * Best on isolated drum loops or one-shot layers.
 */
export function audioBufferToPercussiveMidiNotes(buffer: AudioBuffer, bpm: number): AudioToMidiNote[] {
  const spb = spbFromBpm(bpm);
  const { data, sr } = monoDecimate(buffer);
  const maxSamples = Math.min(data.length, Math.floor(MAX_ANALYSIS_SEC * sr));
  if (maxSamples < FRAME + HOP) return [];

  const rmses: number[] = [];
  for (let start = 0; start + FRAME <= maxSamples; start += HOP) {
    rmses.push(frameRms(data.subarray(start, start + FRAME)));
  }
  const gate = adaptiveRmsGate(rmses);
  const minGapFrames = Math.max(2, Math.round((0.045 * sr) / HOP));
  const notes: AudioToMidiNote[] = [];
  let lastOnset = -minGapFrames;

  for (let i = 1; i < rmses.length - 1; i++) {
    const prev = rmses[i - 1] ?? 0;
    const cur = rmses[i] ?? 0;
    const next = rmses[i + 1] ?? 0;
    if (cur < gate * 1.15) continue;
    if (!(cur >= prev && cur >= next * 0.92)) continue;
    if (i - lastOnset < minGapFrames) continue;
    lastOnset = i;

    const frameStart = i * HOP;
    const bright = frameBrightness(data, frameStart);
    let pitch = 42;
    if (bright < 0.22) pitch = 36;
    else if (bright < 0.48) pitch = 38;
    const vel = Math.round(Math.max(40, Math.min(127, 50 + cur * 900)));
    const startSec = (i * HOP) / sr;
    notes.push({
      pitch,
      startBeat: startSec / spb,
      durationBeats: Math.max(spb / 16, 0.08 / spb),
      velocity: vel,
    });
  }

  notes.sort((a, b) => (a.startBeat !== b.startBeat ? a.startBeat - b.startBeat : a.pitch - b.pitch));
  return notes;
}

/** Monophonic bass-line extraction — same engine, clamped to bass register. */
export function audioBufferToBassMidiNotes(buffer: AudioBuffer, bpm: number): AudioToMidiNote[] {
  const raw = audioBufferToMonophonicMidiNotes(buffer, bpm);
  return raw
    .map((n) => ({
      ...n,
      pitch: Math.max(28, Math.min(60, n.pitch)),
      durationBeats: Math.max(n.durationBeats, 1 / 64),
    }))
    .filter((n) => n.durationBeats >= 1 / 64);
}
