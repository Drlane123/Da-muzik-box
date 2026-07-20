/**
 * PITCH DETECTION & MIDI CONVERSION
 *
 * Fast downsampled autocorrelation for monophonic pitch tracking.
 * Extracts frequency → MIDI note mapping with velocity & timing.
 */

export interface PitchEvent {
  time: number; // ms from start
  frequency: number; // Hz
  confidence: number; // 0-1
  velocity: number; // 0-127
}

export interface MidiNote {
  pitch: number; // 0-127
  start: number; // ticks (PPQ = 960)
  duration: number; // ticks
  velocity: number; // 0-127
}

const A4_FREQUENCY = 440;
const A4_MIDI = 69;
const PPQ = 960;

/** Reused scratch — detectPitchACF is called from rAF / intervals; avoid alloc storms. */
let acfScratch: Float32Array | null = null;

function getAcfScratch(minLen: number): Float32Array {
  if (!acfScratch || acfScratch.length < minLen) {
    acfScratch = new Float32Array(Math.max(minLen, 2048));
  }
  return acfScratch;
}

/**
 * Frequency to MIDI note number (0–127)
 */
export function frequencyToMidiNote(frequency: number): number {
  if (frequency <= 0) return 0;
  const semitones = 12 * Math.log2(frequency / A4_FREQUENCY);
  const midiNote = Math.round(A4_MIDI + semitones);
  return Math.max(0, Math.min(127, midiNote));
}

/**
 * MIDI note to frequency (Hz)
 */
export function midiNoteToFrequency(midiNote: number): number {
  const semitones = midiNote - A4_MIDI;
  return A4_FREQUENCY * Math.pow(2, semitones / 12);
}

/**
 * Transpose MIDI note by semitones
 */
export function transposeMidiNote(midiNote: number, semitones: number): number {
  const transposed = midiNote + semitones;
  return Math.max(0, Math.min(127, transposed));
}

/**
 * Auto-correlation pitch detector (downsampled).
 * Returns frequency in Hz (or 0 if no pitch detected).
 *
 * Previous O(n²) full-buffer ACF froze the UI when Pitch Tune / Vocoder
 * monitors and live retune polled every frame.
 */
export function detectPitchACF(
  audioData: Float32Array,
  sampleRate: number,
  minFrequency: number = 80,
  maxFrequency: number = 400,
  threshold: number = 0.1,
): { frequency: number; confidence: number } {
  if (!audioData.length || sampleRate <= 0) {
    return { frequency: 0, confidence: 0 };
  }

  const minHz = Math.max(40, minFrequency);
  const maxHz = Math.max(minHz + 20, maxFrequency);

  /* Keep Nyquist well above max pitch; 4× downsample is plenty for voice. */
  let decim = 1;
  if (sampleRate / 4 > maxHz * 4) decim = 4;
  else if (sampleRate / 2 > maxHz * 4) decim = 2;

  const sr = sampleRate / decim;
  const maxSamples = Math.min(audioData.length, Math.floor(sr * 0.045) * decim);
  const n = Math.floor(maxSamples / decim);
  if (n < 32) return { frequency: 0, confidence: 0 };

  const buf = getAcfScratch(n);
  let energy = 0;
  for (let i = 0, j = 0; i < n; i += 1, j += decim) {
    const v = audioData[j] ?? 0;
    buf[i] = v;
    energy += v * v;
  }
  const rms = Math.sqrt(energy / n);
  if (rms < 1e-5) return { frequency: 0, confidence: 0 };

  const lagMin = Math.max(2, Math.floor(sr / maxHz));
  const lagMax = Math.min(n - 2, Math.floor(sr / minHz));
  if (lagMax <= lagMin + 2) return { frequency: 0, confidence: 0 };

  /* r0 over the analysis window used for each lag (normalized later). */
  let r0 = 0;
  for (let i = 0; i < n; i += 1) r0 += buf[i]! * buf[i]!;
  if (r0 < 1e-12) return { frequency: 0, confidence: 0 };

  let bestLag = -1;
  let best = threshold;
  /* Difference function / normalized ACF peak search — only within vocal lag range. */
  for (let lag = lagMin; lag <= lagMax; lag += 1) {
    let sum = 0;
    const lim = n - lag;
    for (let i = 0; i < lim; i += 1) {
      sum += buf[i]! * buf[i + lag]!;
    }
    const corr = sum / r0;
    if (corr > best) {
      best = corr;
      bestLag = lag;
    }
  }

  if (bestLag < lagMin) {
    return { frequency: 0, confidence: 0 };
  }

  /* Parabolic refine around peak (neighbor lags). */
  let refinedLag = bestLag;
  if (bestLag > lagMin && bestLag < lagMax) {
    let y1 = 0;
    let y2 = 0;
    let y3 = 0;
    const lim1 = n - (bestLag - 1);
    const lim2 = n - bestLag;
    const lim3 = n - (bestLag + 1);
    for (let i = 0; i < lim1; i += 1) y1 += buf[i]! * buf[i + bestLag - 1]!;
    for (let i = 0; i < lim2; i += 1) y2 += buf[i]! * buf[i + bestLag]!;
    for (let i = 0; i < lim3; i += 1) y3 += buf[i]! * buf[i + bestLag + 1]!;
    y1 /= r0;
    y2 /= r0;
    y3 /= r0;
    const a = (y3 - 2 * y2 + y1) / 2;
    const b = (y3 - y1) / 2;
    if (a !== 0) {
      const delta = b / (2 * a);
      if (Math.abs(delta) < 1) refinedLag = bestLag - delta;
    }
  }

  const frequency = sr / refinedLag;
  if (!Number.isFinite(frequency) || frequency < minHz || frequency > maxHz) {
    return { frequency: 0, confidence: 0 };
  }
  return { frequency, confidence: Math.min(1, best) };
}

/**
 * Convert pitch events to MIDI notes with quantization
 */
export function pitchEventsToMidiNotes(
  events: PitchEvent[],
  bpm: number,
  confidenceThreshold: number = 0.5,
  quantizeGrid: 'none' | '1/4' | '1/8' | '1/16' = '1/8',
): MidiNote[] {
  if (events.length === 0) return [];

  const validEvents = events.filter((e) => e.confidence >= confidenceThreshold);
  if (validEvents.length === 0) return [];

  const notes: MidiNote[] = [];
  let noteStart: PitchEvent | null = null;
  let lastPitch: number | null = null;

  for (let i = 0; i < validEvents.length; i++) {
    const event = validEvents[i]!;
    const pitch = frequencyToMidiNote(event.frequency);

    if (lastPitch === null || Math.abs(pitch - lastPitch) <= 2) {
      if (!noteStart) noteStart = event;
      lastPitch = pitch;
    } else {
      if (noteStart) {
        const noteDuration = event.time - noteStart.time;
        const midiNote = frequencyToMidiNote(noteStart.frequency);
        notes.push(quantizeNote(midiNote, noteStart.time, noteDuration, bpm, quantizeGrid));
      }
      noteStart = event;
      lastPitch = pitch;
    }
  }

  if (noteStart) {
    const finalEvent = validEvents[validEvents.length - 1]!;
    const noteDuration = finalEvent.time - noteStart.time;
    const midiNote = frequencyToMidiNote(noteStart.frequency);
    notes.push(quantizeNote(midiNote, noteStart.time, noteDuration, bpm, quantizeGrid));
  }

  return notes;
}

function quantizeNote(
  pitch: number,
  startMs: number,
  durationMs: number,
  bpm: number,
  grid: 'none' | '1/4' | '1/8' | '1/16',
): MidiNote {
  const msPerQuarter = 60000 / bpm;

  let ticksPerGridUnit = PPQ;
  if (grid === '1/8') ticksPerGridUnit = PPQ / 2;
  if (grid === '1/16') ticksPerGridUnit = PPQ / 4;

  let startTicks = (startMs / msPerQuarter) * PPQ;
  let durationTicks = (durationMs / msPerQuarter) * PPQ;

  if (grid !== 'none') {
    startTicks = Math.round(startTicks / ticksPerGridUnit) * ticksPerGridUnit;
    durationTicks = Math.round(durationTicks / ticksPerGridUnit) * ticksPerGridUnit;
  }

  if (durationTicks < ticksPerGridUnit / 2) {
    durationTicks = ticksPerGridUnit / 2;
  }

  return {
    pitch: Math.max(0, Math.min(127, pitch)),
    start: Math.max(0, Math.round(startTicks)),
    duration: Math.round(durationTicks),
    velocity: 100,
  };
}

/**
 * Extract amplitude envelope (for velocity)
 */
export function extractEnvelope(
  audioData: Float32Array,
  attackTime: number = 0.05,
  releaseTime: number = 0.1,
): { peak: number; attack: number; release: number } {
  let sum = 0;
  let peakAbs = 0;
  for (let i = 0; i < audioData.length; i += 1) {
    const v = audioData[i]!;
    sum += v * v;
    const a = Math.abs(v);
    if (a > peakAbs) peakAbs = a;
  }
  const rms = Math.sqrt(sum / Math.max(1, audioData.length));
  void rms;

  return {
    peak: Math.min(127, Math.round(peakAbs * 127)),
    attack: attackTime,
    release: releaseTime,
  };
}

/**
 * Encode MIDI notes as JSON for storage/transmission
 */
export function encodeMidiNotes(notes: MidiNote[]): string {
  return JSON.stringify(notes);
}

/**
 * Decode MIDI notes from JSON
 */
export function decodeMidiNotes(json: string): MidiNote[] {
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}
