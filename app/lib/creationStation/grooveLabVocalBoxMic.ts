/**
 * VocalBox mic capture — MediaRecorder when available (gap-free), else PCM via Web Audio.
 */
import { connectScriptProcessorSilentMonitor } from '@/app/lib/creationStation/voiceToMidiEffect';

export type VocalBoxMicRecorder = {
  start: (opts?: {
    onLevel?: (rms: number) => void;
    onAutoStop?: (buf: AudioBuffer | null) => void;
  }) => Promise<void>;
  stop: () => Promise<AudioBuffer | null>;
  dispose: () => void;
  isRecording: () => boolean;
};

const MAX_RECORD_SEC = 18;
const MIN_RECORD_SEC = 0.12;
const PCM_BUFFER_SIZE = 8192;

function pickMicRecorderMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return '';
}

/** Raw voice for VocalBox FX — disable browser AGC/NS (they pump/chop on Windows). */
const MIC_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
};

async function decodeMicBlob(ctx: AudioContext, blob: Blob): Promise<AudioBuffer | null> {
  if (blob.size < 256) return null;
  try {
    const ab = await blob.arrayBuffer();
    return await ctx.decodeAudioData(ab.slice(0));
  } catch {
    return null;
  }
}

type MediaRecorderCapture = {
  start: (opts?: {
    onLevel?: (rms: number) => void;
    onAutoStop?: (buf: AudioBuffer | null) => void;
  }) => Promise<void>;
  stop: () => Promise<AudioBuffer | null>;
  dispose: () => void;
  isRecording: () => boolean;
};

/** Gap-free capture via MediaRecorder + decodeAudioData. */
function createMediaRecorderCapture(ctx: AudioContext): MediaRecorderCapture | null {
  const mime = pickMicRecorderMimeType();
  if (!mime) return null;

  let stream: MediaStream | null = null;
  let mr: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let recording = false;
  let levelFn: ((rms: number) => void) | null = null;
  let autoStopFn: ((buf: AudioBuffer | null) => void) | null = null;
  let maxTimer: ReturnType<typeof setTimeout> | null = null;
  let stopResolve: ((buf: AudioBuffer | null) => void) | null = null;
  let analyser: AnalyserNode | null = null;
  let levelTimer: ReturnType<typeof setInterval> | null = null;
  let source: MediaStreamAudioSourceNode | null = null;

  const cleanup = () => {
    if (levelTimer) {
      clearInterval(levelTimer);
      levelTimer = null;
    }
    try {
      source?.disconnect();
    } catch {
      /* */
    }
    try {
      analyser?.disconnect();
    } catch {
      /* */
    }
    source = null;
    analyser = null;
    if (stream) {
      for (const t of stream.getTracks()) t.stop();
      stream = null;
    }
    mr = null;
    chunks = [];
  };

  const finishStop = async () => {
    if (!recording) return;
    recording = false;
    if (maxTimer) {
      clearTimeout(maxTimer);
      maxTimer = null;
    }
    const blob = chunks.length > 0 ? new Blob(chunks, { type: mime }) : null;
    cleanup();
    const buf = blob ? await decodeMicBlob(ctx, blob) : null;
    const resolve = stopResolve;
    const auto = autoStopFn;
    stopResolve = null;
    autoStopFn = null;
    levelFn = null;
    if (resolve) resolve(buf);
    else auto?.(buf);
  };

  return {
    isRecording: () => recording,

    async start(opts) {
      if (recording) return;
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone not supported in this browser');
      }
      if (ctx.state === 'suspended') await ctx.resume();

      chunks = [];
      levelFn = opts?.onLevel ?? null;
      autoStopFn = opts?.onAutoStop ?? null;

      stream = await navigator.mediaDevices.getUserMedia({ audio: MIC_CONSTRAINTS });
      const liveTrack = stream.getAudioTracks()[0];
      if (!liveTrack || liveTrack.readyState !== 'live') {
        cleanup();
        throw new Error('No live microphone track');
      }

      source = ctx.createMediaStreamSource(stream);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      if (levelFn) {
        const buf = new Uint8Array(analyser.fftSize);
        levelTimer = setInterval(() => {
          if (!recording || !analyser) return;
          analyser.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i]! - 128) / 128;
            sum += v * v;
          }
          levelFn!(Math.sqrt(sum / buf.length));
        }, 50);
      }

      mr = new MediaRecorder(stream, { mimeType: mime });
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      mr.onstop = () => {
        void finishStop();
      };
      mr.start(250);
      recording = true;

      maxTimer = setTimeout(() => {
        if (recording && mr?.state === 'recording') mr.stop();
      }, MAX_RECORD_SEC * 1000);
    },

    stop() {
      return new Promise<AudioBuffer | null>((resolve) => {
        if (!recording) {
          resolve(null);
          return;
        }
        stopResolve = resolve;
        if (mr?.state === 'recording') mr.stop();
        else void finishStop();
      });
    },

    dispose() {
      autoStopFn = null;
      levelFn = null;
      if (recording) {
        stopResolve = null;
        if (mr?.state === 'recording') mr.stop();
        else void finishStop();
      } else {
        cleanup();
      }
    },
  };
}

/** ScriptProcessor PCM fallback when MediaRecorder decode fails. */
function createScriptProcessorCapture(ctx: AudioContext): VocalBoxMicRecorder {
  let stream: MediaStream | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let processor: ScriptProcessorNode | null = null;
  let sink: GainNode | null = null;
  let chunks: Float32Array[] = [];
  let recording = false;
  let levelFn: ((rms: number) => void) | null = null;
  let autoStopFn: ((buf: AudioBuffer | null) => void) | null = null;
  let maxTimer: ReturnType<typeof setTimeout> | null = null;
  let stopResolve: ((buf: AudioBuffer | null) => void) | null = null;

  const cleanupGraph = () => {
    try {
      processor?.disconnect();
    } catch {
      /* */
    }
    try {
      source?.disconnect();
    } catch {
      /* */
    }
    try {
      sink?.disconnect();
    } catch {
      /* */
    }
    processor = null;
    source = null;
    sink = null;
    if (stream) {
      for (const t of stream.getTracks()) t.stop();
      stream = null;
    }
  };

  const buildBuffer = (): AudioBuffer | null => {
    const sr = ctx.sampleRate;
    const total = chunks.reduce((s, c) => s + c.length, 0);
    if (total < sr * MIN_RECORD_SEC) return null;
    const buf = ctx.createBuffer(1, total, sr);
    const ch = buf.getChannelData(0);
    let off = 0;
    for (const c of chunks) {
      ch.set(c, off);
      off += c.length;
    }
    return buf;
  };

  const finishStop = () => {
    if (!recording) return;
    recording = false;
    if (maxTimer) {
      clearTimeout(maxTimer);
      maxTimer = null;
    }
    const buf = buildBuffer();
    cleanupGraph();
    const resolve = stopResolve;
    const auto = autoStopFn;
    stopResolve = null;
    autoStopFn = null;
    levelFn = null;
    if (resolve) {
      resolve(buf);
    } else {
      auto?.(buf);
    }
  };

  return {
    isRecording: () => recording,

    async start(opts) {
      if (recording) return;
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone not supported in this browser');
      }
      if (ctx.state === 'suspended') await ctx.resume();

      chunks = [];
      levelFn = opts?.onLevel ?? null;
      autoStopFn = opts?.onAutoStop ?? null;

      stream = await navigator.mediaDevices.getUserMedia({ audio: MIC_CONSTRAINTS });

      const liveTrack = stream.getAudioTracks()[0];
      if (!liveTrack || liveTrack.readyState !== 'live') {
        cleanupGraph();
        throw new Error('No live microphone track');
      }

      source = ctx.createMediaStreamSource(stream);
      processor = ctx.createScriptProcessor(PCM_BUFFER_SIZE, 1, 1);
      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        if (!recording) return;
        const input = e.inputBuffer.getChannelData(0);
        chunks.push(new Float32Array(input));
        if (levelFn) {
          let sum = 0;
          for (let i = 0; i < input.length; i++) sum += input[i]! * input[i]!;
          levelFn(Math.sqrt(sum / input.length));
        }
      };

      sink = connectScriptProcessorSilentMonitor(ctx, source, processor);
      recording = true;

      maxTimer = setTimeout(() => {
        if (recording) finishStop();
      }, MAX_RECORD_SEC * 1000);
    },

    stop() {
      return new Promise<AudioBuffer | null>((resolve) => {
        if (!recording) {
          resolve(null);
          return;
        }
        stopResolve = resolve;
        finishStop();
      });
    },

    dispose() {
      autoStopFn = null;
      levelFn = null;
      if (recording) {
        stopResolve = null;
        finishStop();
      } else {
        cleanupGraph();
        chunks = [];
      }
    },
  };
}

/** Prefer MediaRecorder (no main-thread gaps); fall back to ScriptProcessor PCM. */
export function createVocalBoxMicRecorder(ctx: AudioContext): VocalBoxMicRecorder {
  const media = createMediaRecorderCapture(ctx);
  if (media) return media;
  return createScriptProcessorCapture(ctx);
}

/** Equal time slices — note 1 = start of sentence, note N = end (no repeat-one-word). */
export function micPhraseSegmentsForNotes(
  micBuf: AudioBuffer,
  noteCount: number,
): { startSec: number; endSec: number }[] {
  const n = Math.max(1, noteCount);
  const total = micBuf.duration;
  const seg = total / n;
  return Array.from({ length: n }, (_, i) => ({
    startSec: i * seg,
    endSec: i === n - 1 ? total : (i + 1) * seg,
  }));
}

export function vocalBoxMicDurationLabel(sec: number): string {
  return `${sec.toFixed(1)}s`;
}

/** Session clip — survives panel close / reopen within the same page load. */
let sessionMicClip: AudioBuffer | null = null;

export function getVocalBoxSessionMicClip(): AudioBuffer | null {
  return sessionMicClip;
}

export function setVocalBoxSessionMicClip(buf: AudioBuffer | null): void {
  sessionMicClip = buf;
}

/** Peaks for mini waveform (0–1). */
export function vocalBoxMicWaveformPeaks(buffer: AudioBuffer, bars = 48): number[] {
  const ch = buffer.getChannelData(0);
  const step = Math.max(1, Math.floor(ch.length / bars));
  const peaks: number[] = [];
  for (let i = 0; i < bars; i++) {
    const start = i * step;
    let peak = 0;
    for (let j = start; j < start + step && j < ch.length; j++) {
      peak = Math.max(peak, Math.abs(ch[j]!));
    }
    peaks.push(peak);
  }
  const max = Math.max(0.001, ...peaks);
  return peaks.map((p) => p / max);
}

export type VocalBoxRawPlaybackHandle = { stop: () => void };

/** Hear the raw mic take (no auto-tune) before or after VocalBox. */
export function playVocalBoxRawMicClip(
  ctx: AudioContext,
  buffer: AudioBuffer,
  dest: AudioNode,
): VocalBoxRawPlaybackHandle {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const g = ctx.createGain();
  g.gain.value = 0.95;
  src.connect(g);
  g.connect(dest);
  const t0 = ctx.currentTime + 0.02;
  src.start(t0);
  src.stop(t0 + buffer.duration + 0.05);
  return {
    stop: () => {
      try {
        src.stop();
      } catch {
        /* */
      }
    },
  };
}

export type VocalBoxMicStopResult = {
  buffer: AudioBuffer | null;
  error?: 'empty' | 'silent' | 'short';
};

/** Classify failed capture for UI messaging. */
export function classifyMicBuffer(buf: AudioBuffer | null): VocalBoxMicStopResult {
  if (!buf || buf.duration < MIN_RECORD_SEC) {
    return { buffer: null, error: 'short' };
  }
  const ch = buf.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < ch.length; i += 64) {
    peak = Math.max(peak, Math.abs(ch[i]!));
  }
  if (peak < 0.002) {
    return { buffer: null, error: 'silent' };
  }
  return { buffer: buf };
}
