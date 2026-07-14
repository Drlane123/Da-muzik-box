/**
 * Live mic/line input for Studio Editor 2 — feeds the armed track strip.
 */

import { studioMicTrackConstraints } from '@/app/lib/audioRouting';

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

/**
 * Route mic fanout → track entry / preStrip.
 * Only rewires the previous monitor dest — preserves parallel taps (live record peaks).
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

  if (dest && dest !== prev) {
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
    fanout.gain.value = 1;
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
