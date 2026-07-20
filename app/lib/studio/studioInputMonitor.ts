/**
 * Live mic/line input for Studio Editor 2 — feeds the armed track strip.
 */

import { studioMicTrackConstraints } from '@/app/lib/audioRouting';

/** Idle / armed monitoring into the strip — pad so mic + FX isn't slamming the bus. */
export const STUDIO_INPUT_MONITOR_GAIN = 0.38;
/**
 * While recording: software monitor must stay silent.
 * MediaRecorder captures the dry MediaStream; feeding the strip→speakers causes feedback.
 */
export const STUDIO_INPUT_MONITOR_GAIN_RECORDING = 0;

type MonitorNodes = {
  stream: MediaStream;
  src: MediaStreamAudioSourceNode;
  /** Fan-out hub — never disconnect `src`, only rewire fanout outputs. */
  fanout: GainNode;
  deviceId: string;
  stripInput: AudioNode | null;
  scopeTrackIndex: number;
};

let nodes: MonitorNodes | null = null;
let keepStreamAlive: (() => boolean) | null = null;
let monitorGainLinear = STUDIO_INPUT_MONITOR_GAIN;
/** Hard mute mic→speakers while MediaRecorder is armed (keeps stream + peak taps alive). */
let softMuted = false;

export function setStudioInputMonitorKeepAlive(fn: (() => boolean) | null): void {
  keepStreamAlive = fn;
}

export function studioInputMonitorActive(): boolean {
  return nodes != null && nodes.stream.getAudioTracks().some((t) => t.readyState === 'live');
}

export function getStudioInputMonitorSource(): MediaStreamAudioSourceNode | null {
  return nodes?.src ?? null;
}

export function getStudioInputMonitorFanout(): GainNode | null {
  return nodes?.fanout ?? null;
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

function applyFanoutGain(): void {
  if (!nodes) return;
  const t = nodes.fanout.context.currentTime;
  const g = softMuted ? 0 : monitorGainLinear;
  nodes.fanout.gain.cancelScheduledValues(t);
  nodes.fanout.gain.setTargetAtTime(g, t, 0.015);
}

/** Soften/restore mic → strip monitor level (does not change dry MediaRecorder capture). */
export function setStudioInputMonitorGain(linear: number): void {
  monitorGainLinear = Math.max(0, Math.min(1, linear));
  applyFanoutGain();
}

export function getStudioInputMonitorGain(): number {
  return monitorGainLinear;
}

/**
 * Mute / unmute software input monitoring without tearing down the mic stream.
 * Use while recording so speakers never form a feedback loop with the mic.
 */
export function setStudioInputMonitorSoftMuted(muted: boolean): void {
  if (softMuted === muted) {
    applyFanoutGain();
    return;
  }
  softMuted = muted;
  if (!nodes) return;

  if (muted) {
    if (nodes.stripInput) {
      try {
        nodes.fanout.disconnect(nodes.stripInput);
      } catch {
        /* */
      }
    }
    applyFanoutGain();
    return;
  }

  applyFanoutGain();
  if (nodes.stripInput) {
    try {
      nodes.fanout.connect(nodes.stripInput);
    } catch {
      /* already connected */
    }
  }
}

/**
 * Route mic fanout → track entry / preStrip.
 * Only rewires the previous monitor dest — preserves parallel taps (live record peaks).
 * While soft-muted (recording), updates the target but does not connect to the bus.
 */
export function studioInputMonitorConnectDest(dest: AudioNode | null, trackIndex = -1): void {
  if (!nodes) return;

  const prev = nodes.stripInput;
  nodes.scopeTrackIndex = trackIndex;
  nodes.stripInput = dest;

  if (prev && prev !== dest) {
    try {
      nodes.fanout.disconnect(prev);
    } catch {
      /* already disconnected */
    }
  }

  if (softMuted) {
    applyFanoutGain();
    return;
  }

  /*
   * Always (re)connect — dest may equal prev after a graph rebuild that severed
   * fanout→entry without clearing stripInput (Pitch Tune / Vocoder looked dead).
   */
  if (dest) {
    try {
      nodes.fanout.connect(dest);
    } catch {
      /* already connected */
    }
  }

  // Pitch scope taps the track vocal entry in studioLiveVocalFxChain — never raw fanout (bypasses mute / adds noise).
}

/** @deprecated use studioInputMonitorConnectDest */
export function studioInputMonitorConnectStrip(stripInput: GainNode | null): void {
  studioInputMonitorConnectDest(stripInput);
}

export function studioInputMonitorDisconnectStrip(): void {
  if (!nodes?.stripInput) return;
  try {
    nodes.fanout.disconnect(nodes.stripInput);
  } catch {
    /* */
  }
  nodes.stripInput = null;
  nodes.scopeTrackIndex = -1;
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
    applyFanoutGain();
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
    const fanout = ctx.createGain();
    fanout.gain.value = softMuted ? 0 : monitorGainLinear;
    src.connect(fanout);
    nodes = { stream, src, fanout, deviceId: want, stripInput: null, scopeTrackIndex: -1 };

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
