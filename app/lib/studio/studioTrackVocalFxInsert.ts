/**
 * Persistent per-track Vocal DSP insert — all sources (live mic, clip playback) sum into `entry`.
 */
import {
  connectStudioLiveVocalFxForInputMonitor,
  studioTrackFxStackActive,
} from '@/app/lib/studio/studioLiveVocalFxChain';
import {
  connectStudioPitchMonitorTap,
  getStudioPitchMonitorActiveTrack,
  getStudioPitchMonitorAnalyser,
  registerStudioPitchMonitorResync,
  retapStudioPitchMonitorSource,
  studioPitchMonitorUsesEngineTap,
  unbindStudioPitchMonitorEngineAnalyser,
} from '@/app/lib/studio/studioPitchTuneMonitorBus';
import { normalizeFxStackOrder } from '@/app/lib/studio/studioFxStackOrder';
import { getStudioTrackInsertRouteSignature } from '@/app/lib/studio/studioTrackInsertFxStrip';
import type { StudioTrackInsertFxRack } from '@/app/lib/studio/studioTrackInsertFx';
import {
  purgeStudioLiveVocalFxRegistryForTrack,
  updateStudioLiveVocalFxForTrack,
} from '@/app/lib/studio/studioLiveVocalFxRegistry';
import { reconnectStudioVocalLiveMicIfCached } from '@/app/lib/studio/studioVocalSignalRouter';
import type { StudioTrackVocalFx } from '@/app/lib/studio/studioTrackVocalFx';
import type { StudioVocoderCarrierTrack } from '@/app/lib/studio/studioVocoderCarrier';
import type { MixerEffectId } from '@/app/screens/components/ChannelStripFxDropdowns';

type VocalFxSyncOpts = {
  ctx: AudioContext;
  trackIndex: number;
  preStrip: GainNode;
  stripIn: GainNode;
  fx: StudioTrackVocalFx;
  keyRoot: number;
  carrierTracks: readonly StudioVocoderCarrierTrack[];
  bpm: number;
  clipStartBeat: number;
  clipDurationBeats: number;
  slots: [MixerEffectId, MixerEffectId, MixerEffectId];
  rack: StudioTrackInsertFxRack;
};

type VocalFxInsertRoute = {
  entry: GainNode;
  preStrip: GainNode | null;
  stripIn: GainNode | null;
  cleanup: (() => void) | null;
  autotuneOn: boolean;
  vocoderOn: boolean;
  stackSignature: string;
};

const routes = new Map<number, VocalFxInsertRoute>();
const pendingSync = new Map<number, Promise<GainNode>>();
const pendingSyncOpts = new Map<number, VocalFxSyncOpts>();
const syncGeneration = new Map<number, number>();

function bumpVocalFxSyncGeneration(trackIndex: number): number {
  const next = (syncGeneration.get(trackIndex) ?? 0) + 1;
  syncGeneration.set(trackIndex, next);
  return next;
}

function vocalFxSyncGeneration(trackIndex: number): number {
  return syncGeneration.get(trackIndex) ?? 0;
}

export function getStudioTrackVocalFxEntry(trackIndex: number): GainNode | null {
  return routes.get(trackIndex)?.entry ?? null;
}

/** True when a vocal entry exists (bypass or live Pitch Tune / Vocoder stack). */
export function studioTrackVocalStackOwnsClipPath(trackIndex: number): boolean {
  return Boolean(routes.get(trackIndex)?.entry);
}

export function ensureStudioTrackVocalEntry(
  ctx: AudioContext,
  trackIndex: number,
  preStrip: GainNode,
): GainNode {
  let route = routes.get(trackIndex);
  if (!route || route.entry.context !== ctx) {
    if (route) disconnectStudioTrackVocalFxInsert(trackIndex);
    const entry = ctx.createGain();
    entry.gain.value = 1;
    route = {
      entry,
      preStrip: null,
      stripIn: null,
      cleanup: null,
      autotuneOn: false,
      vocoderOn: false,
      stackSignature: '',
    };
    routes.set(trackIndex, route);
  }
  if (route.preStrip !== preStrip) {
    route.preStrip = preStrip;
    if (!route.cleanup) {
      wireEntryBypass(route.entry, preStrip, trackIndex);
    }
  } else if (!route.cleanup) {
    wireEntryBypass(route.entry, preStrip, trackIndex);
  }
  return route.entry;
}

export function disconnectStudioTrackVocalFxInsert(trackIndex: number): void {
  const route = routes.get(trackIndex);
  if (!route) return;
  route.cleanup?.();
  route.cleanup = null;
  try {
    route.entry.disconnect();
  } catch {
    /* */
  }
  routes.delete(trackIndex);
}

export function invalidateStudioTrackVocalFxInsert(trackIndex: number): void {
  bumpVocalFxSyncGeneration(trackIndex);
  const route = routes.get(trackIndex);
  if (!route) {
    purgeStudioLiveVocalFxRegistryForTrack(trackIndex);
    return;
  }
  route.cleanup?.();
  route.cleanup = null;
  purgeStudioLiveVocalFxRegistryForTrack(trackIndex);
  route.autotuneOn = false;
  route.vocoderOn = false;
  route.stackSignature = '';
  try {
    route.entry.disconnect();
  } catch {
    /* */
  }
  if (route.preStrip) {
    wireEntryBypass(route.entry, route.preStrip, trackIndex);
  }
  reconnectStudioVocalLiveMicIfCached(trackIndex);
}

export function resetStudioTrackVocalFxInserts(): void {
  for (const ti of [...routes.keys()]) disconnectStudioTrackVocalFxInsert(ti);
}

/** Drop insert at `trackIndex` and shift higher keys down (track delete). */
export function removeStudioTrackVocalFxInsertAt(trackIndex: number): void {
  disconnectStudioTrackVocalFxInsert(trackIndex);
  const keys = [...routes.keys()].filter((ti) => ti > trackIndex).sort((a, b) => a - b);
  for (const ti of keys) {
    const route = routes.get(ti);
    if (!route) continue;
    routes.delete(ti);
    routes.set(ti - 1, route);
    const pending = pendingSyncOpts.get(ti);
    if (pending) {
      pendingSyncOpts.delete(ti);
      pendingSyncOpts.set(ti - 1, { ...pending, trackIndex: ti - 1 });
    }
    const gen = syncGeneration.get(ti);
    if (gen != null) {
      syncGeneration.delete(ti);
      syncGeneration.set(ti - 1, gen);
    }
  }
}

function wireEntryBypass(entry: GainNode, preStrip: GainNode, trackIndex: number): void {
  try {
    entry.disconnect();
  } catch {
    /* */
  }
  /*
   * `disconnect()` with no args severs parallel analyser taps. Clear engine ownership so
   * the next retap is allowed to reconnect (otherwise scope stays on a dead node).
   */
  if (studioPitchMonitorUsesEngineTap(trackIndex)) {
    unbindStudioPitchMonitorEngineAnalyser(trackIndex);
  }
  entry.connect(preStrip);
  if (getStudioPitchMonitorActiveTrack() === trackIndex) {
    connectStudioPitchMonitorTap(entry.context as AudioContext, entry, preStrip, trackIndex);
  }
}

function retapPitchMonitorIfOpen(trackIndex: number): void {
  if (getStudioPitchMonitorActiveTrack() !== trackIndex) return;
  const route = routes.get(trackIndex);
  const entry = route?.entry;
  if (!entry || entry.context.state === 'closed') return;

  /* Live Pitch Tune stack owns the engine analyser while cleanup is armed. */
  if (route?.cleanup && studioPitchMonitorUsesEngineTap(trackIndex)) {
    const analyser = getStudioPitchMonitorAnalyser(trackIndex);
    if (analyser) {
      try {
        entry.connect(analyser);
      } catch {
        /* already connected */
      }
    }
    return;
  }
  /* Stale engine ownership after teardown must not block entry retap. */
  if (studioPitchMonitorUsesEngineTap(trackIndex)) {
    unbindStudioPitchMonitorEngineAnalyser(trackIndex);
  }
  retapStudioPitchMonitorSource(entry.context as AudioContext, entry, trackIndex, {
    allowWhilePitchScope: true,
  });
}

registerStudioPitchMonitorResync(retapPitchMonitorIfOpen);

function stackSignatureForTrack(
  trackIndex: number,
  fx: StudioTrackVocalFx,
  rack: StudioTrackInsertFxRack,
): string {
  const order = normalizeFxStackOrder(rack.fxStackOrder);
  return JSON.stringify({
    order,
    autotuneOn: fx.autotuneOn,
    vocoderOn: fx.vocoderOn,
    insert: getStudioTrackInsertRouteSignature(trackIndex),
  });
}

export async function syncStudioTrackVocalFxInsert(opts: VocalFxSyncOpts): Promise<GainNode> {
  const { trackIndex } = opts;
  pendingSyncOpts.set(trackIndex, opts);
  const inFlight = pendingSync.get(trackIndex);
  if (inFlight) return inFlight;

  const job = (async () => {
    let entry: GainNode | null = null;
    let lastPreStrip = opts.preStrip;
    while (pendingSyncOpts.has(trackIndex)) {
      const latest = pendingSyncOpts.get(trackIndex)!;
      pendingSyncOpts.delete(trackIndex);
      lastPreStrip = latest.preStrip;
      entry = await syncStudioTrackVocalFxInsertInner(latest);
    }
    return entry ?? lastPreStrip;
  })().finally(() => {
    pendingSync.delete(trackIndex);
  });

  pendingSync.set(trackIndex, job);
  return job;
}

async function syncStudioTrackVocalFxInsertInner(opts: VocalFxSyncOpts): Promise<GainNode> {
  const {
    ctx,
    trackIndex,
    preStrip,
    stripIn,
    fx,
    keyRoot,
    carrierTracks,
    bpm,
    clipStartBeat,
    clipDurationBeats,
    slots,
    rack,
  } = opts;

  const needStack = studioTrackFxStackActive(fx, slots, rack);
  const pitchScopeOpen = getStudioPitchMonitorActiveTrack() === trackIndex;

  if (!needStack) {
    const routeState = routes.get(trackIndex);
    if (routeState) {
      routeState.cleanup?.();
      routeState.cleanup = null;
      routeState.autotuneOn = false;
      routeState.vocoderOn = false;
      routeState.stackSignature = '';
      routeState.preStrip = preStrip;
      routeState.stripIn = stripIn;
      /* Keep entry → preStrip so clips/mic stay on the same node across FX toggles. */
      wireEntryBypass(routeState.entry, preStrip, trackIndex);
      reconnectStudioVocalLiveMicIfCached(trackIndex);
      retapPitchMonitorIfOpen(trackIndex);
      return routeState.entry;
    }
    /*
     * Pitch Tune / Vocoder panel open with engines OFF still needs a vocal entry
     * + analyser tap — otherwise the scope has nothing to read while mic hits preStrip.
     */
    if (pitchScopeOpen) {
      const entry = ensureStudioTrackVocalEntry(ctx, trackIndex, preStrip);
      const created = routes.get(trackIndex);
      if (created) {
        created.stripIn = stripIn;
        created.preStrip = preStrip;
      }
      reconnectStudioVocalLiveMicIfCached(trackIndex);
      retapPitchMonitorIfOpen(trackIndex);
      return entry;
    }
    reconnectStudioVocalLiveMicIfCached(trackIndex, preStrip);
    retapPitchMonitorIfOpen(trackIndex);
    return preStrip;
  }

  const route = ensureStudioTrackVocalEntry(ctx, trackIndex, preStrip);
  const routeState = routes.get(trackIndex)!;
  routeState.stripIn = stripIn;
  const stackSignature = stackSignatureForTrack(trackIndex, fx, rack);

  if (
    routeState.cleanup &&
    routeState.preStrip === preStrip &&
    routeState.stripIn === stripIn &&
    routeState.autotuneOn === fx.autotuneOn &&
    routeState.vocoderOn === fx.vocoderOn &&
    routeState.stackSignature === stackSignature
  ) {
    updateStudioLiveVocalFxForTrack(trackIndex, fx, keyRoot, false);
    reconnectStudioVocalLiveMicIfCached(trackIndex);
    return route;
  }

  routeState.cleanup?.();
  routeState.cleanup = null;
  wireEntryBypass(route, preStrip, trackIndex);

  const genAtStart = vocalFxSyncGeneration(trackIndex);

  try {
    const handle = await connectStudioLiveVocalFxForInputMonitor({
      ctx,
      modulator: route,
      dest: stripIn,
      fx,
      keyRoot,
      vocalTrackIndex: trackIndex,
      carrierTracks,
      bpm,
      clipStartBeat,
      clipDurationBeats,
      pitchMonitorTrackIndex: trackIndex,
      insertSlots: slots,
      insertRack: rack,
      fxStackOrder: rack.fxStackOrder,
    });

    if (vocalFxSyncGeneration(trackIndex) !== genAtStart) {
      handle.cleanup();
      wireEntryBypass(route, preStrip, trackIndex);
      reconnectStudioVocalLiveMicIfCached(trackIndex);
      retapPitchMonitorIfOpen(trackIndex);
      return route;
    }

    try {
      route.disconnect(preStrip);
    } catch {
      /* stack owns entry → stripIn */
    }

    routeState.cleanup = () => handle.cleanup();
    routeState.preStrip = preStrip;
    routeState.stripIn = stripIn;
    routeState.autotuneOn = fx.autotuneOn;
    routeState.vocoderOn = fx.vocoderOn;
    routeState.stackSignature = stackSignature;
    reconnectStudioVocalLiveMicIfCached(trackIndex);
    retapPitchMonitorIfOpen(trackIndex);
    return route;
  } catch (e) {
    console.warn(`[Studio] Vocal DSP insert sync failed for track ${trackIndex}.`, e);
    wireEntryBypass(route, preStrip, trackIndex);
    routeState.autotuneOn = false;
    routeState.vocoderOn = false;
    routeState.stackSignature = '';
    retapPitchMonitorIfOpen(trackIndex);
    return route;
  }
}
