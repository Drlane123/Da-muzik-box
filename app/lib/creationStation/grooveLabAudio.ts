import {
  CHORD_BASS_SEQ_CHANNEL_BASE,
  CHORD_BASS_SEQ_CHANNEL_COUNT,
} from '@/app/lib/creationStation/chordBassSequencerSession';
import { getSharedAudioOutput } from '@/app/lib/creationStation/sharedAudioOutput';
import { grooveLabChannelVolumeGain } from '@/app/lib/creationStation/grooveLabChannelMeters';

/** Lead time after unlock — schedule inside the play callback, not before resume. */
export const GROOVE_LAB_AUDIO_LEAD_SEC = 0.02;

type GrooveLabAudioGlobals = {
  __daMusicChannelPans?: Record<number, number>;
};

type ChannelBusEntry = {
  bus: GainNode;
  limiter: DynamicsCompressorNode;
  postTrim: GainNode;
  pan: StereoPannerNode;
  masterSink: AudioNode | null;
};

const playbackSinkStack: AudioNode[] = [];
const channelBusByCtx = new WeakMap<AudioContext, Map<number, ChannelBusEntry>>();

/**
 * Groove Lab output — always the shared master bus (same graph as Beat Lab).
 */
export function resolveGrooveLabAudioDest(ctx: AudioContext): AudioNode {
  const override = playbackSinkStack[playbackSinkStack.length - 1];
  if (override && override.context === ctx) return override;
  return getSharedAudioOutput(ctx);
}

export function resolveGrooveLabChannelDest(
  ctx: AudioContext,
  chId: number,
  channelVolumes?: Record<number, number>,
): AudioNode {
  let perCtx = channelBusByCtx.get(ctx);
  if (!perCtx) {
    perCtx = new Map<number, ChannelBusEntry>();
    channelBusByCtx.set(ctx, perCtx);
  }
  let entry = perCtx.get(chId);
  if (!entry) {
    const bus = ctx.createGain();
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.knee.value = 12;
    limiter.ratio.value = 6;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.09;
    const postTrim = ctx.createGain();
    postTrim.gain.value = 1;
    const pan = ctx.createStereoPanner();
    const master = getSharedAudioOutput(ctx);
    bus.connect(limiter).connect(postTrim).connect(pan).connect(master);
    entry = { bus, limiter, postTrim, pan, masterSink: master };
    perCtx.set(chId, entry);
  } else {
    const master = getSharedAudioOutput(ctx);
    if (entry.masterSink !== master) {
      try {
        entry.pan.disconnect();
      } catch {
        /* */
      }
      try {
        entry.pan.connect(master);
        entry.masterSink = master;
      } catch {
        /* closed ctx */
      }
    }
  }
  const t = ctx.currentTime;
  const gain = grooveLabChannelVolumeGain(chId, channelVolumes);
  const panSigned = Math.max(
    -1,
    Math.min(
      1,
      (((globalThis as unknown as GrooveLabAudioGlobals).__daMusicChannelPans?.[chId] ?? 0) as number) / 100,
    ),
  );
  try {
    entry.bus.gain.cancelScheduledValues(t);
    entry.bus.gain.setValueAtTime(gain, t);
    entry.pan.pan.cancelScheduledValues(t);
    entry.pan.pan.setValueAtTime(panSigned, t);
  } catch {
    /* non-fatal */
  }
  return entry.bus;
}

/** Push all CH 33–48 fader/pan values to live channel buses (call when knobs move). */
export function applyGrooveLabChannelVolumes(
  ctx: AudioContext,
  channelVolumes?: Record<number, number>,
): void {
  if (ctx.state === 'closed') return;
  for (let i = 0; i < CHORD_BASS_SEQ_CHANNEL_COUNT; i += 1) {
    const chId = CHORD_BASS_SEQ_CHANNEL_BASE + i;
    resolveGrooveLabChannelDest(ctx, chId, channelVolumes);
  }
}

export function withGrooveLabPlaybackSink<T>(sink: AudioNode | null, fn: () => T): T {
  if (!sink) return fn();
  playbackSinkStack.push(sink);
  try {
    return fn();
  } finally {
    playbackSinkStack.pop();
  }
}

/** Active lead-voice output during transport / preview (mirrors chord progressionAuditionOutput). */
let grooveLabMelodyPlaybackOutput: AudioNode | null = null;

let grooveLabTransportMelodyBus: GainNode | null = null;
let grooveLabTransportMelodyBusCtx: AudioContext | null = null;
let grooveLabTransportMelodyBusDest: AudioNode | null = null;

export function withGrooveLabMelodyPlaybackOutput<T>(output: AudioNode | null, fn: () => T): T {
  const prev = grooveLabMelodyPlaybackOutput;
  grooveLabMelodyPlaybackOutput = output;
  try {
    return fn();
  } finally {
    grooveLabMelodyPlaybackOutput = prev;
  }
}

export function resolveGrooveLabMelodyPlaybackDest(ctx: AudioContext): AudioNode {
  if (grooveLabMelodyPlaybackOutput && grooveLabMelodyPlaybackOutput.context === ctx) {
    return grooveLabMelodyPlaybackOutput;
  }
  return resolveGrooveLabAudioDest(ctx);
}

function ensureGrooveLabTransportMelodyBus(ctx: AudioContext, dest?: AudioNode | null): GainNode {
  const target = dest ?? resolveGrooveLabAudioDest(ctx);
  if (!grooveLabTransportMelodyBus || grooveLabTransportMelodyBusCtx !== ctx) {
    const bus = ctx.createGain();
    bus.gain.value = 1;
    bus.connect(target);
    grooveLabTransportMelodyBus = bus;
    grooveLabTransportMelodyBusCtx = ctx;
    grooveLabTransportMelodyBusDest = target;
  } else if (grooveLabTransportMelodyBusDest !== target) {
    try {
      grooveLabTransportMelodyBus.disconnect();
    } catch {
      /* */
    }
    grooveLabTransportMelodyBus.connect(target);
    grooveLabTransportMelodyBusDest = target;
  }
  return grooveLabTransportMelodyBus;
}

/** Route MELODY lead voices → transport bus → CH35 channel strip (same pattern as chord transport). */
export function withGrooveLabTransportMelodyRouting<T>(
  ctx: AudioContext,
  fn: () => T,
  dest?: AudioNode | null,
): T {
  return withGrooveLabMelodyPlaybackOutput(ensureGrooveLabTransportMelodyBus(ctx, dest), fn);
}

function muteGrooveLabTransportMelodyBus(ctx: AudioContext | null): void {
  if (!grooveLabTransportMelodyBus || !ctx) return;
  const t = ctx.currentTime;
  try {
    grooveLabTransportMelodyBus.gain.cancelScheduledValues(t);
    grooveLabTransportMelodyBus.gain.setValueAtTime(0, t);
  } catch {
    /* closed */
  }
}

function unmuteGrooveLabTransportMelodyBus(ctx: AudioContext | null): void {
  if (!grooveLabTransportMelodyBus || !ctx) return;
  const t = ctx.currentTime;
  try {
    grooveLabTransportMelodyBus.gain.cancelScheduledValues(t);
    grooveLabTransportMelodyBus.gain.setValueAtTime(1, t);
  } catch {
    /* closed */
  }
}

export function haltGrooveLabTransportMelodyBus(): void {
  muteGrooveLabTransportMelodyBus(grooveLabTransportMelodyBusCtx);
  grooveLabMelodyPlaybackOutput = null;
}

export function restoreGrooveLabTransportMelodyBus(): void {
  unmuteGrooveLabTransportMelodyBus(grooveLabTransportMelodyBusCtx);
}

/** Guitar lick transport bus → CH strip (mirrors chord transport bus; STOP can mute lookahead). */
let grooveLabTransportGuitarBus: GainNode | null = null;
let grooveLabTransportGuitarBusCtx: AudioContext | null = null;
let grooveLabTransportGuitarBusDest: AudioNode | null = null;

function ensureGrooveLabTransportGuitarBus(ctx: AudioContext, dest?: AudioNode | null): GainNode {
  const target = dest ?? resolveGrooveLabAudioDest(ctx);
  if (!grooveLabTransportGuitarBus || grooveLabTransportGuitarBusCtx !== ctx) {
    const bus = ctx.createGain();
    bus.gain.value = 1;
    bus.connect(target);
    grooveLabTransportGuitarBus = bus;
    grooveLabTransportGuitarBusCtx = ctx;
    grooveLabTransportGuitarBusDest = target;
  } else if (grooveLabTransportGuitarBusDest !== target) {
    try {
      grooveLabTransportGuitarBus.disconnect();
    } catch {
      /* */
    }
    grooveLabTransportGuitarBus.connect(target);
    grooveLabTransportGuitarBusDest = target;
  }
  return grooveLabTransportGuitarBus;
}

function muteGrooveLabTransportGuitarBus(ctx: AudioContext | null): void {
  if (!grooveLabTransportGuitarBus || !ctx) return;
  const t = ctx.currentTime;
  try {
    grooveLabTransportGuitarBus.gain.cancelScheduledValues(t);
    grooveLabTransportGuitarBus.gain.setValueAtTime(0, t);
  } catch {
    /* closed */
  }
}

function unmuteGrooveLabTransportGuitarBus(ctx: AudioContext | null): void {
  if (!grooveLabTransportGuitarBus || !ctx) return;
  const t = ctx.currentTime;
  try {
    grooveLabTransportGuitarBus.gain.cancelScheduledValues(t);
    grooveLabTransportGuitarBus.gain.setValueAtTime(1, t);
  } catch {
    /* closed */
  }
}

/** Route guitar licks → transport bus → GUITAR CH strip (line mixer audible path). */
export function withGrooveLabTransportGuitarRouting<T>(
  ctx: AudioContext,
  fn: (guitarBus: GainNode) => T,
  dest?: AudioNode | null,
): T {
  return fn(ensureGrooveLabTransportGuitarBus(ctx, dest));
}

export function haltGrooveLabTransportGuitarBus(): void {
  muteGrooveLabTransportGuitarBus(grooveLabTransportGuitarBusCtx);
}

export function restoreGrooveLabTransportGuitarBus(): void {
  unmuteGrooveLabTransportGuitarBus(grooveLabTransportGuitarBusCtx);
}

/** @deprecated Routes to master gain. */
export function getOrCreateGrooveLabPlaybackBus(ctx: AudioContext): GainNode {
  const dest = getSharedAudioOutput(ctx);
  if (dest instanceof GainNode) return dest;
  const bus = ctx.createGain();
  bus.gain.value = 1;
  bus.connect(dest);
  return bus;
}

/** @deprecated No-op */
export function silenceGrooveLabPlayback(_ctx: AudioContext): void {}

/** @deprecated No-op */
export function armGrooveLabPlayback(_ctx: AudioContext): void {}

/** @deprecated Returns master gain passthrough */
export function ensureGrooveLabPlaybackAudible(ctx: AudioContext): GainNode {
  return getOrCreateGrooveLabPlaybackBus(ctx);
}

/** @deprecated No-op */
export function resetGrooveLabPlaybackBus(ctx: AudioContext): GainNode {
  return getOrCreateGrooveLabPlaybackBus(ctx);
}

/** Call synchronously from pointerdown / Play — starts resume while user activation is valid. */
export function resumeGrooveLabAudioContext(ctx: AudioContext): void {
  if (ctx.state === 'closed' || ctx.state === 'running') return;
  if (ctx.state === 'suspended') {
    try {
      void ctx.resume();
    } catch {
      /* autoplay policy */
    }
  }
}

export async function ensureGrooveLabAudioReady(
  getAudioContext?: () => AudioContext,
): Promise<AudioContext | null> {
  if (!getAudioContext) return null;
  let ctx: AudioContext;
  try {
    ctx = getAudioContext();
  } catch {
    return null;
  }
  if (ctx.state === 'closed') return null;
  if (ctx.state === 'suspended') {
    resumeGrooveLabAudioContext(ctx);
    try {
      await ctx.resume();
    } catch {
      /* autoplay policy */
    }
    for (let i = 0; i < 4 && ctx.state === 'suspended'; i += 1) {
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      try {
        await ctx.resume();
      } catch {
        /* */
      }
    }
  }
  if (ctx.state === 'closed') return null;
  return ctx;
}

export function grooveLabAudioWhen(
  ctx: AudioContext,
  leadSec = GROOVE_LAB_AUDIO_LEAD_SEC,
): number {
  return ctx.currentTime + leadSec;
}

function runGrooveLabAudioOnCtx(ctx: AudioContext, play: (ctx: AudioContext, when: number) => void): void {
  if (ctx.state === 'closed') return;
  play(ctx, grooveLabAudioWhen(ctx));
}

/**
 * Resume AudioContext, then schedule at a fresh `currentTime` (never schedule while suspended —
 * events would land in the past after resume and stay silent).
 */
export function runWithGrooveLabAudio(
  getAudioContext: (() => AudioContext) | undefined,
  play: (ctx: AudioContext, when: number) => void,
): void {
  if (!getAudioContext) return;
  let ctx: AudioContext;
  try {
    ctx = getAudioContext();
  } catch {
    return;
  }
  if (ctx.state === 'closed') return;

  if (ctx.state === 'suspended') {
    resumeGrooveLabAudioContext(ctx);
    void ctx
      .resume()
      .then(() => runGrooveLabAudioOnCtx(ctx, play))
      .catch(() => {
        if (ctx.state === 'running') runGrooveLabAudioOnCtx(ctx, play);
      });
    return;
  }

  runGrooveLabAudioOnCtx(ctx, play);
}
