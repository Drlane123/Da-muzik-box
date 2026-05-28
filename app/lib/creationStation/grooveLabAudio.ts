import { getSharedAudioOutput } from '@/app/lib/creationStation/sharedAudioOutput';

/** Lead time after unlock — schedule inside the play callback, not before resume. */
export const GROOVE_LAB_AUDIO_LEAD_SEC = 0.02;

/** Routes chord + bass scheduling to the Groove Lab bus (STOP mutes this node). */
let groovePlaybackSink: AudioNode | null = null;

const groovePlaybackBusByCtx = new WeakMap<AudioContext, GainNode>();

export function withGrooveLabPlaybackSink<T>(sink: AudioNode | null, fn: () => T): T {
  const prev = groovePlaybackSink;
  groovePlaybackSink = sink;
  try {
    return fn();
  } finally {
    groovePlaybackSink = prev;
  }
}

export function resolveGrooveLabAudioDest(ctx: AudioContext): AudioNode {
  return groovePlaybackSink ?? getSharedAudioOutput(ctx);
}

export function getOrCreateGrooveLabPlaybackBus(ctx: AudioContext): GainNode {
  let bus = groovePlaybackBusByCtx.get(ctx);
  if (!bus) {
    bus = ctx.createGain();
    bus.gain.value = 1;
    bus.connect(getSharedAudioOutput(ctx));
    groovePlaybackBusByCtx.set(ctx, bus);
  }
  return bus;
}

/** Immediate silence — transport STOP / progression STOP. */
export function silenceGrooveLabPlayback(ctx: AudioContext): void {
  const bus = groovePlaybackBusByCtx.get(ctx);
  if (!bus || ctx.state === 'closed') return;
  const t = ctx.currentTime;
  bus.gain.cancelScheduledValues(t);
  bus.gain.setValueAtTime(0, t);
}

export function armGrooveLabPlayback(ctx: AudioContext): void {
  const bus = getOrCreateGrooveLabPlaybackBus(ctx);
  const t = ctx.currentTime;
  bus.gain.cancelScheduledValues(t);
  bus.gain.setValueAtTime(1, t);
}

/** Drop queued transport/audition voices so pause → play cannot stack two schedules. */
export function resetGrooveLabPlaybackBus(ctx: AudioContext): GainNode {
  const prev = groovePlaybackBusByCtx.get(ctx);
  if (prev) {
    try {
      prev.disconnect();
    } catch {
      /* already disconnected */
    }
    groovePlaybackBusByCtx.delete(ctx);
  }
  return getOrCreateGrooveLabPlaybackBus(ctx);
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
    try {
      await ctx.resume();
    } catch {
      return null;
    }
  }
  return ctx.state === 'closed' ? null : ctx;
}

export function grooveLabAudioWhen(
  ctx: AudioContext,
  leadSec = GROOVE_LAB_AUDIO_LEAD_SEC,
): number {
  return ctx.currentTime + leadSec;
}

/** Resume AudioContext (browser autoplay policy), then play at a fresh schedule time. */
export function runWithGrooveLabAudio(
  getAudioContext: (() => AudioContext) | undefined,
  play: (ctx: AudioContext, when: number) => void,
): void {
  if (!getAudioContext) return;
  void (async () => {
    const ctx = await ensureGrooveLabAudioReady(getAudioContext);
    if (!ctx) return;
    play(ctx, grooveLabAudioWhen(ctx));
  })();
}
