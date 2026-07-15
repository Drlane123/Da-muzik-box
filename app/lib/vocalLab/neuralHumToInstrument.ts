/**
 * Neural Hum-to-Instrument — open-source browser pipeline (no paid APIs).
 *
 * 1. Monophonic pitch → timed MIDI notes (`audioToMidiNotes` autocorrelation)
 * 2. GM instrument render via smplr MusyngKite soundfont (free CDN)
 * 3. Offline synth fallback via Chord Builder voices if samples are unavailable
 */
import { Scheduler, Soundfont } from 'smplr';

import { getChordInstrument, type ChordInstrumentId } from '@/app/lib/creationStation/chordInstruments';
import { BEAT_LAB_MELODIC_KIT } from '@/app/lib/creationStation/beatLabMelodicSoundfont';
import {
  audioBufferToMonophonicTimedNotes,
  type MonophonicPitchExtractOpts,
  type TimedMonophonicNote,
} from '@/app/lib/studio/audioToMidiNotes';
import {
  neuralHumKeyLabel,
  processNeuralHumMelody,
  type NeuralHumDetectedKey,
  type NeuralHumKeyLockSettings,
} from '@/app/lib/vocalLab/neuralHumKeyLock';

export type { NeuralHumKeyLockSettings, NeuralHumDetectedKey, NeuralHumScaleId, NeuralHumKeyLockMode } from '@/app/lib/vocalLab/neuralHumKeyLock';

export type NeuralHumInstrumentId =
  | 'trumpet'
  | 'saxophone'
  | 'guitar'
  | 'bass'
  | 'piano'
  | 'violin'
  | 'flute'
  | 'synth';

export type NeuralHumInstrumentMeta = {
  id: NeuralHumInstrumentId;
  label: string;
  emoji: string;
  desc: string;
  /** MusyngKite GM name for smplr. */
  gmInstrument: string;
  /** Offline synth fallback when soundfont fetch fails. */
  synthFallback: ChordInstrumentId;
};

export const NEURAL_HUM_INSTRUMENTS: readonly NeuralHumInstrumentMeta[] = [
  { id: 'trumpet', label: 'Trumpet', emoji: '🎺', desc: 'Bright & bold brass sound', gmInstrument: 'trumpet', synthFallback: 'brass' },
  { id: 'saxophone', label: 'Saxophone', emoji: '🎷', desc: 'Smooth & soulful tone', gmInstrument: 'tenor_sax', synthFallback: 'brass' },
  { id: 'guitar', label: 'Guitar', emoji: '🎸', desc: 'Warm acoustic or electric', gmInstrument: 'acoustic_guitar_nylon', synthFallback: 'pluck-guitar' },
  { id: 'bass', label: 'Bass', emoji: '🥁', desc: 'Deep & punchy low end', gmInstrument: 'electric_bass_finger', synthFallback: 'bass-synth' },
  { id: 'piano', label: 'Piano', emoji: '🎹', desc: 'Elegant & versatile', gmInstrument: 'acoustic_grand_piano', synthFallback: 'piano-grand' },
  { id: 'violin', label: 'Violin', emoji: '🎻', desc: 'Soaring & expressive', gmInstrument: 'violin', synthFallback: 'strings-warm' },
  { id: 'flute', label: 'Flute', emoji: '🪈', desc: 'Airy & melodic', gmInstrument: 'flute', synthFallback: 'bell' },
  { id: 'synth', label: 'Analog Synth', emoji: '🎛️', desc: 'Electronic & futuristic', gmInstrument: 'lead_2_sawtooth', synthFallback: 'synth-lead' },
] as const;

export type NeuralHumTransformOptions = {
  instrumentId: NeuralHumInstrumentId;
  /** −12..+12 semitones — ReSing-style transpose, no paid model. */
  transposeSemis?: number;
  /** 0..1 — scales note velocity / expression. */
  dynamics?: number;
  /** Legato multiplier on note length. */
  sustainScale?: number;
  sampleRate?: number;
  keyLock?: NeuralHumKeyLockSettings;
};

export type NeuralHumProgressStage = 'decode' | 'analyze' | 'load' | 'render' | 'done';

export type NeuralHumProgress = {
  stage: NeuralHumProgressStage;
  progress: number;
  message: string;
};

export type NeuralHumTransformResult = {
  notes: TimedMonophonicNote[];
  audioBuffer: AudioBuffer;
  wavBlob: Blob;
  durationSec: number;
  gmInstrument: string;
  renderEngine: 'soundfont' | 'synth';
  keyLabel: string | null;
  detectedKey: NeuralHumDetectedKey | null;
};

const MIN_NOTES = 3;
const TAIL_SEC = 1.25;
const SILENT_RENDER_RMS = 0.0008;

/** smplr defaults to 200 ms lookahead — OfflineAudioContext never runs that timer, so notes must dispatch synchronously. */
function offlineSoundfontScheduler(ctx: BaseAudioContext, durationSec: number) {
  return Scheduler(ctx, {
    lookaheadMs: Math.ceil(durationSec * 1000) + 1500,
    intervalMs: 16,
  });
}

function bufferPeakRms(buffer: AudioBuffer): number {
  const d = buffer.getChannelData(0);
  if (d.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < d.length; i++) sum += d[i]! * d[i]!;
  return Math.sqrt(sum / d.length);
}

export function neuralHumInstrumentMeta(id: NeuralHumInstrumentId): NeuralHumInstrumentMeta {
  return NEURAL_HUM_INSTRUMENTS.find((i) => i.id === id) ?? NEURAL_HUM_INSTRUMENTS[0]!;
}

async function decodeBlob(ctx: BaseAudioContext, blob: Blob): Promise<AudioBuffer> {
  const bytes = await blob.arrayBuffer();
  return ctx.decodeAudioData(bytes.slice(0));
}

/** Pitch → timed notes + Dubler-style key lock (mathematical, no ML). */
export function analyzeNeuralHumMelody(
  sourceBuffer: AudioBuffer,
  keyLock?: NeuralHumKeyLockSettings,
  extractOpts?: MonophonicPitchExtractOpts,
): {
  notes: TimedMonophonicNote[];
  /** Pitch-tracked notes before key lock — use to re-key from pads. */
  rawNotes: TimedMonophonicNote[];
  rawNoteCount: number;
  keyLabel: string | null;
  detectedKey: NeuralHumDetectedKey | null;
  effectiveKeyRoot: number;
  effectiveScaleId: NeuralHumKeyLockSettings['scaleId'];
} {
  const raw = audioBufferToMonophonicTimedNotes(sourceBuffer, extractOpts);
  const lock: NeuralHumKeyLockSettings = keyLock ?? {
    mode: 'auto',
    keyRoot: 0,
    scaleId: 'major',
  };
  const processed = processNeuralHumMelody(raw, lock);
  const keyLabel =
    lock.mode === 'off'
      ? null
      : neuralHumKeyLabel(processed.effectiveKeyRoot, processed.effectiveScaleId);
  return {
    notes: processed.notes,
    rawNotes: raw,
    rawNoteCount: raw.length,
    keyLabel,
    detectedKey: processed.detectedKey,
    effectiveKeyRoot: processed.effectiveKeyRoot,
    effectiveScaleId: processed.effectiveScaleId,
  };
}

function clampMidi(pitch: number, transpose: number): number {
  return Math.max(0, Math.min(127, Math.round(pitch + transpose)));
}

function scaledVelocity(velocity: number, dynamics: number): number {
  const d = Math.max(0.15, Math.min(1, dynamics));
  return Math.max(1, Math.min(127, Math.round(velocity * d)));
}

function lastNoteEndSec(notes: readonly TimedMonophonicNote[], sustainScale: number): number {
  let end = 0;
  for (const n of notes) {
    end = Math.max(end, n.startSec + Math.max(0.06, n.durationSec * sustainScale));
  }
  return end;
}

function encodeWavMono16(samples: Float32Array, sampleRate: number): Uint8Array {
  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, 'data');
  view.setUint32(40, dataSize, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    let s = samples[i]!;
    if (s > 1) s = 1;
    else if (s < -1) s = -1;
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(buffer);
}

async function renderWithSoundfont(
  notes: readonly TimedMonophonicNote[],
  meta: NeuralHumInstrumentMeta,
  opts: Required<Pick<NeuralHumTransformOptions, 'transposeSemis' | 'dynamics' | 'sustainScale' | 'sampleRate'>>,
): Promise<{ buffer: AudioBuffer; engine: 'soundfont' } | null> {
  const totalSec = lastNoteEndSec(notes, opts.sustainScale) + TAIL_SEC;
  const totalFrames = Math.max(1, Math.ceil(totalSec * opts.sampleRate));
  const offline = new OfflineAudioContext(1, totalFrames, opts.sampleRate);
  const sched = offlineSoundfontScheduler(offline, totalSec);

  try {
    const inst = Soundfont(offline, {
      instrument: meta.gmInstrument,
      kit: BEAT_LAB_MELODIC_KIT,
      destination: offline.destination,
      volume: 100,
      scheduler: sched,
    });
    await inst.load;
    for (const n of notes) {
      const dur = Math.max(0.08, n.durationSec * opts.sustainScale);
      inst.start({
        note: clampMidi(n.pitch, opts.transposeSemis),
        velocity: scaledVelocity(n.velocity, opts.dynamics),
        time: n.startSec,
        duration: dur,
      });
    }
    const buffer = await offline.startRendering();
    sched.stop();
    inst.stop();
    if (bufferPeakRms(buffer) < SILENT_RENDER_RMS) return null;
    return { buffer, engine: 'soundfont' };
  } catch {
    sched.stop();
    return null;
  }
}

async function renderWithSynthFallbackAsync(
  notes: readonly TimedMonophonicNote[],
  meta: NeuralHumInstrumentMeta,
  opts: Required<Pick<NeuralHumTransformOptions, 'transposeSemis' | 'dynamics' | 'sustainScale' | 'sampleRate'>>,
): Promise<AudioBuffer> {
  const totalSec = lastNoteEndSec(notes, opts.sustainScale) + TAIL_SEC;
  const totalFrames = Math.max(1, Math.ceil(totalSec * opts.sampleRate));
  const offline = new OfflineAudioContext(1, totalFrames, opts.sampleRate);
  const voice = getChordInstrument(meta.synthFallback);

  for (const n of notes) {
    const dur = Math.max(0.08, n.durationSec * opts.sustainScale);
    voice.scheduleNote({
      ctx: offline,
      destination: offline.destination,
      midi: clampMidi(n.pitch, opts.transposeSemis),
      startTime: n.startSec,
      sustainSec: dur,
      velocity: scaledVelocity(n.velocity, opts.dynamics) / 127,
    });
  }

  return offline.startRendering();
}

/**
 * Full hum / whistle / vocal melody → instrument performance.
 * Uses only open-source browser audio (autocorrelation + smplr + Web Audio synth).
 */
export async function transformNeuralHumToInstrument(
  liveCtx: AudioContext,
  sourceBlob: Blob,
  options: NeuralHumTransformOptions,
  onProgress?: (p: NeuralHumProgress) => void,
): Promise<NeuralHumTransformResult> {
  const meta = neuralHumInstrumentMeta(options.instrumentId);
  const transposeSemis = Math.max(-24, Math.min(24, options.transposeSemis ?? 0));
  const dynamics = Math.max(0.15, Math.min(1, options.dynamics ?? 0.85));
  const sustainScale = Math.max(0.5, Math.min(2, options.sustainScale ?? 1.15));
  const sampleRate = options.sampleRate ?? liveCtx.sampleRate;

  const report = (stage: NeuralHumProgressStage, progress: number, message: string) => {
    onProgress?.({ stage, progress, message });
  };

  report('decode', 8, 'Decoding recording…');
  const sourceBuffer = await decodeBlob(liveCtx, sourceBlob);

  report('analyze', 28, 'Analyzing melody…');
  const keyLock = options.keyLock ?? { mode: 'auto' as const, keyRoot: 0, scaleId: 'major' as const };
  const analyzed = analyzeNeuralHumMelody(sourceBuffer, keyLock);
  const notes = analyzed.notes;
  if (notes.length < MIN_NOTES) {
    throw new Error(
      analyzed.rawNoteCount < MIN_NOTES
        ? `Not enough melody detected (${analyzed.rawNoteCount} notes) — hum louder, closer to the mic, or try a longer take.`
        : `Melody too fragmented after key lock (${notes.length} notes) — try Key Lock Off or a wider scale (Major / Blues).`,
    );
  }
  if (keyLock.mode !== 'off' && analyzed.keyLabel) {
    report('analyze', 34, `Key lock: ${analyzed.keyLabel}…`);
  }

  report('load', 52, `Loading ${meta.label} samples…`);
  const soundfontResult = await renderWithSoundfont(notes, meta, {
    transposeSemis,
    dynamics,
    sustainScale,
    sampleRate,
  });

  report('render', 78, soundfontResult ? 'Rendering performance…' : 'Using built-in synth (samples unavailable)…');
  let audioBuffer: AudioBuffer;
  let renderEngine: 'soundfont' | 'synth';

  if (soundfontResult) {
    audioBuffer = soundfontResult.buffer;
    renderEngine = soundfontResult.engine;
  } else {
    audioBuffer = await renderWithSynthFallbackAsync(notes, meta, {
      transposeSemis,
      dynamics,
      sustainScale,
      sampleRate,
    });
    renderEngine = 'synth';
  }

  const pcm = audioBuffer.getChannelData(0);
  const wavBytes = encodeWavMono16(pcm, audioBuffer.sampleRate);
  const wavBlob = new Blob([wavBytes], { type: 'audio/wav' });
  const durationSec = audioBuffer.duration;

  report('done', 100, 'Complete!');
  return {
    notes,
    audioBuffer,
    wavBlob,
    durationSec,
    gmInstrument: meta.gmInstrument,
    renderEngine,
    keyLabel: analyzed.keyLabel,
    detectedKey: analyzed.detectedKey,
  };
}

/** Render edited Hum Capture roll notes — skips re-analyze from audio. */
export async function renderNeuralHumNotesToInstrument(
  liveCtx: AudioContext,
  notes: readonly TimedMonophonicNote[],
  options: NeuralHumTransformOptions & {
    keyLabel?: string | null;
    detectedKey?: NeuralHumDetectedKey | null;
  },
  onProgress?: (p: NeuralHumProgress) => void,
): Promise<NeuralHumTransformResult> {
  if (notes.length < MIN_NOTES) {
    throw new Error(`Need at least ${MIN_NOTES} notes in the melody roll.`);
  }

  const meta = neuralHumInstrumentMeta(options.instrumentId);
  const transposeSemis = Math.max(-24, Math.min(24, options.transposeSemis ?? 0));
  const dynamics = Math.max(0.15, Math.min(1, options.dynamics ?? 0.85));
  const sustainScale = Math.max(0.5, Math.min(2, options.sustainScale ?? 1.15));
  const sampleRate = options.sampleRate ?? liveCtx.sampleRate;

  const report = (stage: NeuralHumProgressStage, progress: number, message: string) => {
    onProgress?.({ stage, progress, message });
  };

  report('load', 52, `Loading ${meta.label} samples…`);
  const soundfontResult = await renderWithSoundfont(notes, meta, {
    transposeSemis,
    dynamics,
    sustainScale,
    sampleRate,
  });

  report('render', 78, soundfontResult ? 'Rendering performance…' : 'Using built-in synth (samples unavailable)…');
  let audioBuffer: AudioBuffer;
  let renderEngine: 'soundfont' | 'synth';

  if (soundfontResult) {
    audioBuffer = soundfontResult.buffer;
    renderEngine = soundfontResult.engine;
  } else {
    audioBuffer = await renderWithSynthFallbackAsync(notes, meta, {
      transposeSemis,
      dynamics,
      sustainScale,
      sampleRate,
    });
    renderEngine = 'synth';
  }

  const pcm = audioBuffer.getChannelData(0);
  const wavBytes = encodeWavMono16(pcm, audioBuffer.sampleRate);
  const wavBlob = new Blob([wavBytes], { type: 'audio/wav' });
  const durationSec = audioBuffer.duration;

  report('done', 100, 'Complete!');
  return {
    notes: [...notes],
    audioBuffer,
    wavBlob,
    durationSec,
    gmInstrument: meta.gmInstrument,
    renderEngine,
    keyLabel: options.keyLabel ?? null,
    detectedKey: options.detectedKey ?? null,
  };
}

/** Trigger a browser download of the rendered WAV. */
export function downloadNeuralHumWav(blob: Blob, instrumentLabel: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `neural-hum-${instrumentLabel.toLowerCase().replace(/\s+/g, '-')}.wav`;
  a.click();
  URL.revokeObjectURL(url);
}
