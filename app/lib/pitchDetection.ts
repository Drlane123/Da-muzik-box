/**
 * PITCH DETECTION & MIDI CONVERSION
 * 
 * Uses Web Audio API + autocorrelation for monophonic pitch tracking.
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


/**
 * Frequency to MIDI note number (0-127)
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
 * Auto-correlation pitch detector using Web Audio
 * Returns frequency in Hz (or 0 if no pitch detected)
 */
export function detectPitchACF(
  audioData: Float32Array,
  sampleRate: number,
  minFrequency: number = 80,
  maxFrequency: number = 400,
  threshold: number = 0.1
): { frequency: number; confidence: number } {
  const correlationSize = Math.floor(sampleRate / minFrequency);
  const correlation = new Array(correlationSize).fill(0);

  // Compute autocorrelation
  for (let lag = 0; lag < correlationSize; lag++) {
    let sum = 0;
    for (let i = 0; i < audioData.length - lag; i++) {
      sum += audioData[i] * audioData[i + lag];
    }
    correlation[lag] = sum;
  }

  // Normalize
  if (correlation[0] === 0) return { frequency: 0, confidence: 0 };
  for (let i = 1; i < correlation.length; i++) {
    correlation[i] /= correlation[0];
  }

  // Find first peak after minimum frequency
  const minLag = Math.floor(sampleRate / maxFrequency);
  let maxValue = threshold;
  let maxLag = minLag;

  for (let lag = minLag; lag < correlationSize; lag++) {
    if (correlation[lag] > maxValue) {
      maxValue = correlation[lag];
      maxLag = lag;
    }
  }

  if (maxLag === minLag) {
    return { frequency: 0, confidence: 0 };
  }

  // Refine with parabolic interpolation
  if (maxLag > 0 && maxLag < correlationSize - 1) {
    const y1 = correlation[maxLag - 1];
    const y2 = correlation[maxLag];
    const y3 = correlation[maxLag + 1];
    const a = (y3 - 2 * y2 + y1) / 2;
    const b = (y3 - y1) / 2;
    if (a !== 0) {
      return {
        frequency: (sampleRate / (maxLag - b / (2 * a))),
        confidence: maxValue
      };
    }
  }

  return {
    frequency: sampleRate / maxLag,
    confidence: maxValue
  };
}


/**
 * Convert pitch events to MIDI notes with quantization
 */
export function pitchEventsToMidiNotes(
  events: PitchEvent[],
  bpm: number,
  confidenceThreshold: number = 0.5,
  quantizeGrid: 'none' | '1/4' | '1/8' | '1/16' = '1/8'
): MidiNote[] {
  if (events.length === 0) return [];

  // Filter by confidence
  const validEvents = events.filter(e => e.confidence >= confidenceThreshold);
  if (validEvents.length === 0) return [];

  const notes: MidiNote[] = [];
  let noteStart: PitchEvent | null = null;
  let lastPitch: number | null = null;

  // Group events by pitch (with ~2 semitone tolerance)
  for (let i = 0; i < validEvents.length; i++) {
    const event = validEvents[i];
    const pitch = frequencyToMidiNote(event.frequency);

    if (lastPitch === null || Math.abs(pitch - lastPitch) <= 2) {
      // Continue current note
      if (!noteStart) noteStart = event;
      lastPitch = pitch;
    } else {
      // Pitch changed significantly - save previous note
      if (noteStart) {
        const noteDuration = event.time - noteStart.time;
        const midiNote = frequencyToMidiNote(noteStart.frequency);
        const quantized = quantizeNote(
          midiNote,
          noteStart.time,
          noteDuration,
          bpm,
          quantizeGrid
        );
        notes.push(quantized);
      }
      noteStart = event;
      lastPitch = pitch;
    }
  }

  // Save final note
  if (noteStart) {
    const finalEvent = validEvents[validEvents.length - 1];
    const noteDuration = finalEvent.time - noteStart.time;
    const midiNote = frequencyToMidiNote(noteStart.frequency);
    const quantized = quantizeNote(
      midiNote,
      noteStart.time,
      noteDuration,
      bpm,
      quantizeGrid
    );
    notes.push(quantized);
  }

  return notes;
}


/**
 * Quantize note to grid
 */
function quantizeNote(
  pitch: number,
  startMs: number,
  durationMs: number,
  bpm: number,
  grid: 'none' | '1/4' | '1/8' | '1/16'
): MidiNote {
  const msPerQuarter = (60000 / bpm);
  
  let ticksPerGridUnit = PPQ; // 1/4
  if (grid === '1/8') ticksPerGridUnit = PPQ / 2;
  if (grid === '1/16') ticksPerGridUnit = PPQ / 4;

  // Convert ms to ticks and snap to grid
  let startTicks = (startMs / msPerQuarter) * PPQ;
  let durationTicks = (durationMs / msPerQuarter) * PPQ;

  if (grid !== 'none') {
    startTicks = Math.round(startTicks / ticksPerGridUnit) * ticksPerGridUnit;
    durationTicks = Math.round(durationTicks / ticksPerGridUnit) * ticksPerGridUnit;
  }

  // Ensure minimum duration
  if (durationTicks < ticksPerGridUnit / 2) {
    durationTicks = ticksPerGridUnit / 2;
  }

  return {
    pitch: Math.max(0, Math.min(127, pitch)),
    start: Math.max(0, Math.round(startTicks)),
    duration: Math.round(durationTicks),
    velocity: 100
  };
}


/**
 * Extract amplitude envelope (for velocity)
 */
export function extractEnvelope(
  audioData: Float32Array,
  attackTime: number = 0.05,
  releaseTime: number = 0.1
): { peak: number; attack: number; release: number } {
  const rms = Math.sqrt(audioData.reduce((sum, s) => sum + s * s, 0) / audioData.length);
  const peak = Math.max(...audioData.map(Math.abs));
  
  return {
    peak: Math.min(127, Math.round(peak * 127)),
    attack: attackTime,
    release: releaseTime
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
