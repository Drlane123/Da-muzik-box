/**
 * Live mic/line input for Studio Editor 2 — feeds the armed track strip.
 *
 * Graph:
 *   MediaStreamSource → hub (unity) → meterAnalyser (always on for lane levels)
 *                     ↘ monitorGain → strip / Pitch Tune entry
 *
 * MediaRecorder captures the dry MediaStream in parallel (not this graph).
 * While recording, speaker monitor is OFF by default (stops mic→speakers feedback
 * on Cloudflare / laptop speakers). Hub peak metering still drives lane IN meters.
 * Flip the transport "Mon" toggle on for headphone self-hear.
 */

import { studioMicTrackConstraints } from '@/app/lib/audioRouting';

/** Idle / armed monitoring into the strip — pad so mic + FX isn't slamming the bus. */
export const STUDIO_INPUT_MONITOR_GAIN = 0.38;
/**
 * When recording + speaker monitor ON (headphones): attenuated hear-yourself level.
 * When recording + monitor OFF (default): gain is 0 — meters still read from hub.
 */
export const STUDIO_INPUT_MONITOR_GAIN_RECORDING = 0.28;

type MonitorNodes = {
  stream: MediaStream;
  src: MediaStreamAudioSourceNode;
  /** Unity hub — meter taps live here; never use as the speaker gate. */
  hub: GainNode;
  /** Gated path into strip / vocal FX entry. */
  monitorGain: GainNode;
  meterAnalyser: AnalyserNode;
  /** Keeps the hub→analyser branch alive when strip is not yet connected. */
  meterKeepAlive: GainNode;
  meterBuf: Float32Array;
  deviceId: string;
  stripInput: AudioNode | null;
  scopeTrackIndex: number;
};

let nodes: MonitorNodes | null = null;
let keepStreamAlive: (() => boolean) | null = null;
let monitorGainLinear = STUDIO_INPUT_MONITOR_GAIN;
/** Recording mode: silence speaker path unless manual monitor is on. */
let softMuted = false;
/**
 * Manual speaker/headphone input monitor (transport Mon).
 * Default false — meters use hub peak; dry MediaRecorder still captures.
 */
let speakerMonitorEnabled = false;

export function setStudioInputMonitorKeepAlive(fn: (() => boolean) | null): void {
  keepStreamAlive = fn;
}

export function studioInputMonitorActive(): boolean {
  return nodes != null && nodes.stream.getAudioTracks().some((t) => t.readyState === 'live');
}

export function getStudioInputMonitorSource(): MediaStreamAudioSourceNode | null {
  return nodes?.src ?? null;
}

/** @deprecated Prefer getStudioInputMonitorHub — fanout name kept for callers. */
export function getStudioInputMonitorFanout(): GainNode | null {
  return nodes?.hub ?? null;
}

export function getStudioInputMonitorHub(): GainNode | null {
  return nodes?.hub ?? null;
}

/** Live mic MediaStream when SE2 input monitor is running (for pitch scope / metering). */
export function getStudioInputMonitorStream(): MediaStream | null {
  if (!nodes) return null;
  const live = nodes.stream.getAudioTracks().some((t) => t.readyState === 'live');
  return live ? nodes.stream : null;
}

/** Which track index currently owns the live mic fanout → strip/FX connection. */
export function getStudioInputMonitorScopeTrackIndex(): number {
  return nodes?.scopeTrackIndex ?? -1;
}

export function studioInputMonitorSoftMuted(): boolean {
  return softMuted;
}

export function studioInputMonitorSpeakerEnabled(): boolean {
  return speakerMonitorEnabled;
}

/**
 * Manual hear-yourself through the strip (headphones).
 * Off while recording = no speaker feedback; hub meters still move.
 */
export function setStudioInputMonitorSpeakerEnabled(enabled: boolean): void {
  speakerMonitorEnabled = enabled;
  applyMonitorGain();
}

function effectiveMonitorGainLinear(): number {
  if (!softMuted) return monitorGainLinear;
  // Recording: silent unless user turns Mon on.
  return speakerMonitorEnabled ? STUDIO_INPUT_MONITOR_GAIN_RECORDING : 0;
}

function applyMonitorGain(): void {
  if (!nodes) return;
  const t = nodes.monitorGain.context.currentTime;
  const g = effectiveMonitorGainLinear();
  nodes.monitorGain.gain.cancelScheduledValues(t);
  nodes.monitorGain.gain.setTargetAtTime(Math.max(0, Math.min(1, g)), t, 0.015);
}

/** Soften/restore mic → strip monitor level (does not change dry MediaRecorder capture). */
export function setStudioInputMonitorGain(linear: number): void {
  monitorGainLinear = Math.max(0, Math.min(1, linear));
  applyMonitorGain();
}

export function getStudioInputMonitorGain(): number {
  return monitorGainLinear;
}

/**
 * Recording soft-mute mode: speaker path follows Mon toggle (default silent).
 * Hub analyser keeps lane meters alive. Dry MediaRecorder still captures.
 */
export function setStudioInputMonitorSoftMuted(muted: boolean): void {
  softMuted = muted;
  if (!nodes) return;
  applyMonitorGain();
  if (nodes.stripInput) {
    try {
      nodes.monitorGain.connect(nodes.stripInput);
    } catch {
      /* already connected */
    }
  }
}

/**
 * Route mic monitor → track entry / preStrip.
 * Always (re)connects so Pitch Tune / Vocoder stay live after graph rebuilds.
 */
export function studioInputMonitorConnectDest(dest: AudioNode | null, trackIndex = -1): void {
  if (!nodes) return;

  const prev = nodes.stripInput;
  nodes.scopeTrackIndex = trackIndex;
  nodes.stripInput = dest;

  if (prev && prev !== dest) {
    try {
      nodes.monitorGain.disconnect(prev);
    } catch {
      /* already disconnected */
    }
  }

  applyMonitorGain();

  if (dest) {
    try {
      nodes.monitorGain.connect(dest);
    } catch {
      /* already connected */
    }
  }
}

/** @deprecated use studioInputMonitorConnectDest */
export function studioInputMonitorConnectStrip(stripInput: GainNode | null): void {
  studioInputMonitorConnectDest(stripInput);
}

export function studioInputMonitorDisconnectStrip(): void {
  if (!nodes?.stripInput) return;
  try {
    nodes.monitorGain.disconnect(nodes.stripInput);
  } catch {
    /* */
  }
  nodes.stripInput = null;
  nodes.scopeTrackIndex = -1;
}

/**
 * Instantaneous peak (0..1+) from the always-on hub analyser —
 * works while recording even if strip worklet meters lag / speaker monitor is off.
 */
export function readStudioInputMonitorPeak(): number {
  if (!nodes) return 0;
  const { meterAnalyser, meterBuf } = nodes;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  meterAnalyser.getFloatTimeDomainData(meterBuf as any);
  let peak = 0;
  for (let i = 0; i < meterBuf.length; i++) {
    const v = Math.abs(meterBuf[i] ?? 0);
    if (v > peak) peak = v;
  }
  return Math.min(1.5, peak);
}

export async function ensureStudioInputMonitor(
  ctx: AudioContext,
  inputDeviceId: string,
): Promise<boolean> {
  const want = inputDeviceId?.trim() || 'default';
  if (
    nodes &&
    nodes.deviceId === want &&
    nodes.stream.getAudioTracks().some((t) => t.readyState === 'live')
  ) {
    applyMonitorGain();
    return true;
  }
  stopStudioInputMonitor();

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: studioMicTrackConstraints(want === 'default' ? '' : want),
    });
    for (const tr of stream.getAudioTracks()) tr.enabled = true;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        /* autoplay policy */
      }
    }
    const src = ctx.createMediaStreamSource(stream);
    const hub = ctx.createGain();
    hub.gain.value = 1;
    const monitorGain = ctx.createGain();
    monitorGain.gain.value = effectiveMonitorGainLinear();
    const meterAnalyser = ctx.createAnalyser();
    meterAnalyser.fftSize = 2048;
    meterAnalyser.smoothingTimeConstant = 0.12;
    const meterBuf = new Float32Array(meterAnalyser.fftSize);
    // Silent destination so Chrome keeps processing the hub→analyser branch
    // before the strip is wired (otherwise lane IN stays flat after Record arm).
    const meterKeepAlive = ctx.createGain();
    meterKeepAlive.gain.value = 0;

    src.connect(hub);
    hub.connect(meterAnalyser);
    hub.connect(monitorGain);
    meterAnalyser.connect(meterKeepAlive);
    meterKeepAlive.connect(ctx.destination);

    nodes = {
      stream,
      src,
      hub,
      monitorGain,
      meterAnalyser,
      meterKeepAlive,
      meterBuf,
      deviceId: want,
      stripInput: null,
      scopeTrackIndex: -1,
    };

    const w = window as unknown as { __daMusicStudioMicStream?: MediaStream | null };
    w.__daMusicStudioMicStream = stream;
    return true;
  } catch (e) {
    console.warn('[StudioInputMonitor] getUserMedia failed — check Settings → Audio Input.', e);
    return false;
  }
}

export function stopStudioInputMonitor(): void {
  if (!nodes) return;
  const stream = nodes.stream;
  studioInputMonitorDisconnectStrip();
  try {
    nodes.src.disconnect();
  } catch {
    /* */
  }
  try {
    nodes.hub.disconnect();
  } catch {
    /* */
  }
  try {
    nodes.meterAnalyser.disconnect();
  } catch {
    /* */
  }
  try {
    nodes.meterKeepAlive.disconnect();
  } catch {
    /* */
  }
  try {
    nodes.monitorGain.disconnect();
  } catch {
    /* */
  }
  nodes = null;

  const w = window as unknown as { __daMusicStudioMicStream?: MediaStream | null };
  if (w.__daMusicStudioMicStream === stream) {
    w.__daMusicStudioMicStream = null;
  }

  if (keepStreamAlive?.()) return;
  stream.getTracks().forEach((t) => {
    try {
      t.stop();
    } catch {
      /* */
    }
  });
}
