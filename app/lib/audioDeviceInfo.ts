/**
 * Browser-real audio device stats and AudioContext options (DAW-style readouts).
 * Block size is approximate — Web Audio exposes `baseLatency`, not ASIO buffer pickers.
 */

import { audioInputConstraint } from '@/app/lib/audioRouting';

export type AudioLatencyHint = 'interactive' | 'balanced' | 'playback';

export type AudioSampleRateSetting = number | 'device';

export const AUDIO_LATENCY_HINT_OPTIONS: {
  value: AudioLatencyHint;
  label: string;
  guide: string;
}[] = [
  { value: 'interactive', label: 'Low (≈128 samples)', guide: 'Recording / live monitoring' },
  { value: 'balanced', label: 'Medium (≈256 samples)', guide: 'General use' },
  { value: 'playback', label: 'High (≈512+ samples)', guide: 'Mixing / heavy sessions' },
];

export const AUDIO_SAMPLE_RATE_OPTIONS: {
  value: AudioSampleRateSetting;
  label: string;
}[] = [
  { value: 'device', label: 'Device default' },
  { value: 44100, label: '44 100 Hz' },
  { value: 48000, label: '48 000 Hz' },
  { value: 96000, label: '96 000 Hz' },
];

export type AudioDeviceStats = {
  sampleRate: number;
  baseLatencyMs: number;
  outputLatencyMs: number;
  totalOutputLatencyMs: number;
  estimatedBlockSize: number;
  inputLatencyMs: number | null;
  contextState: AudioContextState;
  latencyHint: AudioLatencyHint | null;
};

export function buildAudioContextOptions(
  sampleRate: AudioSampleRateSetting,
  latencyHint: AudioLatencyHint,
): AudioContextOptions {
  const opts: AudioContextOptions = { latencyHint };
  if (sampleRate !== 'device' && Number.isFinite(sampleRate)) {
    opts.sampleRate = sampleRate;
  }
  return opts;
}

export function readAudioDeviceStats(
  ctx: AudioContext,
  latencyHint: AudioLatencyHint | null = null,
): AudioDeviceStats {
  const sr = ctx.sampleRate;
  const base =
    typeof ctx.baseLatency === 'number' && Number.isFinite(ctx.baseLatency)
      ? ctx.baseLatency
      : 0;
  const out =
    typeof ctx.outputLatency === 'number' && Number.isFinite(ctx.outputLatency)
      ? ctx.outputLatency
      : 0;
  return {
    sampleRate: sr,
    baseLatencyMs: base * 1000,
    outputLatencyMs: out * 1000,
    totalOutputLatencyMs: (base + out) * 1000,
    estimatedBlockSize: Math.max(1, Math.round(base * sr)),
    inputLatencyMs: null,
    contextState: ctx.state,
    latencyHint,
  };
}

export function formatMs(ms: number, digits = 1): string {
  if (!Number.isFinite(ms)) return '—';
  return `${ms.toFixed(digits)} ms`;
}

export function formatHz(hz: number): string {
  if (!Number.isFinite(hz)) return '—';
  return `${Math.round(hz).toLocaleString()} Hz`;
}

/** Best-effort input latency from an active or probe MediaStreamTrack. */
export function readInputLatencyMsFromTrack(track: MediaStreamTrack | null | undefined): number | null {
  if (!track) return null;
  const settings = track.getSettings?.() as { latency?: number } | undefined;
  const lat = settings?.latency;
  if (typeof lat === 'number' && Number.isFinite(lat) && lat >= 0) {
    return lat * 1000;
  }
  const caps = track.getCapabilities?.() as { latency?: { min?: number; max?: number } } | undefined;
  const capMin = caps?.latency?.min;
  if (typeof capMin === 'number' && Number.isFinite(capMin) && capMin >= 0) {
    return capMin * 1000;
  }
  return null;
}

/** Short-lived mic open to read input latency when the browser exposes it. */
export async function probeInputLatencyMs(audioInputDeviceId: string): Promise<number | null> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return null;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: audioInputConstraint(audioInputDeviceId),
    });
    const track = stream.getAudioTracks()[0] ?? null;
    const ms = readInputLatencyMsFromTrack(track);
    stream.getTracks().forEach((t) => t.stop());
    return ms;
  } catch {
    return null;
  }
}
