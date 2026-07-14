/**
 * Per-track insert FX routing on the SE2 preview bus.
 *
 * One `stripFeed` node is the ONLY wire into each mixer lane — prevents ghost
 * bypass + suite paths summing (loud / stuck FX when toggling off).
 *
 * Path (bypass):  clip → preStrip ──→ stripFeed → mixer strip
 * Path (suite):   clip → preStrip → [DA FX Suite] → stripFeed → mixer strip
 */
import type { MixerEffectId } from '@/app/screens/components/ChannelStripFxDropdowns';
import { connectStudioInsertFxChain } from '@/app/lib/studio/studioInsertFxAudio';
import {
  studioInsertFxRackActive,
  cloneStudioTrackInsertFxRack,
  type StudioTrackInsertFxRack,
} from '@/app/lib/studio/studioTrackInsertFx';
import {
  insertSuiteParamsNeedChainSwap,
  liveUpdateInsertSuiteParams,
} from '@/app/lib/studio/studioInsertFxStripLiveUpdate';
import { releaseSpectrumForgeBus, resetAllSpectrumForgeBuses } from '@/app/lib/studio/studioSpectrumForgeBus';
import {
  ensureStudioMixerStrips,
  getStudioMixerStripInput,
  isStudioMixerStripGraphPlaybackLocked,
  resolveStudioMixerStripInput,
} from '@/app/lib/studio/studioMixerStripBus';
import {
  getStudioTrackVocalFxEntry,
  studioTrackVocalStackOwnsClipPath,
} from '@/app/lib/studio/studioTrackVocalFxInsert';
import {
  registerStudioFxSuiteAnalyserResync,
  retapStudioPitchMonitorSource,
  studioTrackAnalyserHasConsumer,
} from '@/app/lib/studio/studioTrackAnalyserBus';

type StripRoute = {
  preStrip: GainNode;
  /** Sole gateway into stripIn — never connect stripIn from anywhere else. */
  stripFeed: GainNode | null;
  innerNodes: AudioNode[];
  /** Full rack JSON — param tweaks. */
  signature: string;
  /** Module on/off + BPM — graph topology. */
  wireSignature: string;
  stripIn: GainNode | null;
  tapFrom: AudioNode | null;
  suiteWired: boolean;
  /** Suite chain input gain — for gapless swaps. */
  suiteInput: GainNode | null;
  /** Last wired rack snapshot for live param diff. */
  lastRack: StudioTrackInsertFxRack | null;
  /** Makeup gains in suite chain (compressor / gate floor). */
  makeupGains: GainNode[];
};

const routes = new Map<number, StripRoute>();

/** Bump when insert wiring semantics change — forces one clean rebuild per lane. */
const INSERT_STRIP_WIRE_REV = 12;

const INSERT_FX_OUTPUT_TRIM = 0.76;

/** Rack toggles only — slot labels must not re-arm modules in the audio graph. */
const SUITE_WIRE_SLOTS: [MixerEffectId, MixerEffectId, MixerEffectId] = ['', '', ''];

function routeSignature(
  slots: readonly [MixerEffectId, MixerEffectId, MixerEffectId],
  rack: StudioTrackInsertFxRack,
  bpm: number,
): string {
  return JSON.stringify({
    rev: INSERT_STRIP_WIRE_REV,
    slots,
    rack,
    bpm: Math.round(bpm * 10) / 10,
  });
}

/** Module enable flags only — avoids full chain rebuild on every knob move. */
function insertWireSignature(rack: StudioTrackInsertFxRack, bpm: number): string {
  return JSON.stringify({
    rev: INSERT_STRIP_WIRE_REV,
    suiteOn: rack.suiteOn === true,
    bpm: Math.round(bpm * 10) / 10,
    gate: rack.gate.enabled,
    eq: rack.eq.enabled,
    deEsser: rack.deEsser.enabled,
    compressor: rack.compressor.enabled,
    saturation: rack.saturation.enabled && rack.saturation.drive > 0.01,
    filter: rack.filter.enabled,
    chorus: rack.chorus.enabled,
    delay: rack.delay.enabled,
    reverb: rack.reverb.enabled,
    limiter: rack.limiter.enabled,
    analogSat: rack.analogSaturation.level > 0.004,
  });
}

function collectMakeupGains(nodes: readonly AudioNode[]): GainNode[] {
  return nodes.filter((n): n is GainNode => n instanceof GainNode);
}

/** True when at least one suite module is armed in rack state (UI toggles). */
export function studioTrackInsertFxNeeded(
  _slots: readonly [MixerEffectId, MixerEffectId, MixerEffectId],
  rack: StudioTrackInsertFxRack,
): boolean {
  return studioInsertFxRackActive(rack);
}

function disconnectOutputs(node: AudioNode): void {
  try {
    node.disconnect();
  } catch {
    /* */
  }
}

function stopNodes(nodes: AudioNode[]): void {
  for (const node of nodes) {
    if (node instanceof OscillatorNode) {
      try {
        node.stop();
      } catch {
        /* */
      }
    }
    disconnectOutputs(node);
  }
}

function purgeLegacyForgeSplice(trackIndex: number, preStrip: GainNode, stripIn: GainNode): void {
  releaseSpectrumForgeBus(trackIndex);
  try {
    preStrip.disconnect(stripIn);
  } catch {
    /* legacy direct bypass before stripFeed */
  }
}

function destroyRoute(route: StripRoute, trackIndex: number, stripIn?: GainNode | null): void {
  if (isStudioMixerStripGraphPlaybackLocked()) return;
  stopNodes(route.innerNodes);
  route.innerNodes = [];
  purgeLegacyForgeSplice(trackIndex, route.preStrip, stripIn ?? route.stripIn ?? route.preStrip);
  disconnectOutputs(route.preStrip);
  if (route.stripFeed) disconnectOutputs(route.stripFeed);
  route.stripFeed = null;
  route.tapFrom = null;
  route.stripIn = null;
  route.suiteWired = false;
  route.suiteInput = null;
  route.lastRack = null;
  route.makeupGains = [];
}

function ensurePreStrip(ctx: AudioContext, trackIndex: number): StripRoute {
  let route = routes.get(trackIndex);
  if (!route || route.preStrip.context !== ctx) {
    if (route) {
      destroyRoute(route, trackIndex);
      routes.delete(trackIndex);
    }
    const preStrip = ctx.createGain();
    preStrip.gain.value = 1;
    route = {
      preStrip,
      stripFeed: null,
      innerNodes: [],
      signature: '',
      wireSignature: '',
      stripIn: null,
      tapFrom: null,
      suiteWired: false,
      suiteInput: null,
      lastRack: null,
      makeupGains: [],
    };
    routes.set(trackIndex, route);
  }
  return route;
}

/** Ensure one permanent gateway into the mixer lane input. */
function ensureStripFeed(ctx: AudioContext, route: StripRoute, stripIn: GainNode): GainNode {
  if (!route.stripFeed || route.stripFeed.context !== ctx) {
    route.stripFeed = ctx.createGain();
    route.stripFeed.gain.value = 1;
  }
  if (route.stripIn !== stripIn) {
    disconnectOutputs(route.stripFeed);
    route.stripFeed.connect(stripIn);
    route.stripIn = stripIn;
  }
  return route.stripFeed;
}

/** Disconnect every source that might feed stripFeed (bypass tail, suite tail, legacy). */
function severStripFeedInputs(route: StripRoute, stripFeed: GainNode, stripIn: GainNode): void {
  for (const node of route.innerNodes) {
    try {
      node.disconnect(stripFeed);
    } catch {
      /* */
    }
    try {
      node.disconnect(stripIn);
    } catch {
      /* ghost direct wire before stripFeed */
    }
  }
  try {
    route.preStrip.disconnect(stripFeed);
  } catch {
    /* */
  }
  try {
    route.preStrip.disconnect(stripIn);
  } catch {
    /* legacy bypass */
  }
  if (route.tapFrom && route.tapFrom !== route.preStrip) {
    try {
      route.tapFrom.disconnect(stripFeed);
    } catch {
      /* */
    }
    try {
      route.tapFrom.disconnect(stripIn);
    } catch {
      /* */
    }
  }
}

/** Clip/midi bus: vocal stack entry when Pitch Tune/Vocoder active, else preStrip. */
function resolveClipPlaybackBus(trackIndex: number, preStrip: GainNode): GainNode {
  if (studioTrackVocalStackOwnsClipPath(trackIndex)) {
    return getStudioTrackVocalFxEntry(trackIndex) ?? preStrip;
  }
  return preStrip;
}

function reconnectTapToStripFeed(route: StripRoute, stripFeed: GainNode, needSuite: boolean): void {
  if (needSuite && route.suiteWired && route.tapFrom) {
    try {
      route.tapFrom.connect(stripFeed);
    } catch {
      /* */
    }
    return;
  }
  try {
    route.preStrip.connect(stripFeed);
  } catch {
    /* */
  }
  route.tapFrom = route.preStrip;
}

/** Disconnect preStrip from the suite chain input (prevents ghost FX when bypassing). */
function severPreStripFromSuite(route: StripRoute): void {
  if (route.suiteInput) {
    try {
      route.preStrip.disconnect(route.suiteInput);
    } catch {
      /* */
    }
  }
  for (const node of route.innerNodes) {
    if (node === route.suiteInput) continue;
    try {
      route.preStrip.disconnect(node);
    } catch {
      /* */
    }
  }
}

/** Hard bypass — preStrip is the only source into stripFeed. */
function wireBypass(
  ctx: AudioContext,
  route: StripRoute,
  stripIn: GainNode,
  trackIndex: number,
): void {
  /* Allowed during transport lock — gapless enough for suite on/off; strip topology stays fixed. */
  const stripFeed = ensureStripFeed(ctx, route, stripIn);
  stopNodes(route.innerNodes);
  route.innerNodes = [];
  severStripFeedInputs(route, stripFeed, stripIn);
  severPreStripFromSuite(route);
  purgeLegacyForgeSplice(trackIndex, route.preStrip, stripIn);
  try {
    route.preStrip.disconnect();
  } catch {
    /* */
  }
  route.suiteInput = null;
  route.lastRack = null;
  route.makeupGains = [];
  route.preStrip.connect(stripFeed);
  route.tapFrom = route.preStrip;
  route.suiteWired = false;
  retapStudioPitchMonitorSource(ctx, route.preStrip, trackIndex);
}

/** First-time suite wire (bypass → suite or cold start). */
function wireSuite(
  ctx: AudioContext,
  route: StripRoute,
  rack: StudioTrackInsertFxRack,
  stripIn: GainNode,
  bpm: number,
  trackIndex: number,
): void {
  /* Allowed during transport lock so preset apply mid-play reaches the graph. */
  const stripFeed = ensureStripFeed(ctx, route, stripIn);
  stopNodes(route.innerNodes);
  route.innerNodes = [];
  severStripFeedInputs(route, stripFeed, stripIn);
  purgeLegacyForgeSplice(trackIndex, route.preStrip, stripIn);
  disconnectOutputs(route.preStrip);

  const trim = ctx.createGain();
  trim.gain.value = INSERT_FX_OUTPUT_TRIM;

  const { input, nodes } = connectStudioInsertFxChain(
    ctx,
    SUITE_WIRE_SLOTS,
    rack,
    trim,
    bpm,
  );
  route.preStrip.connect(input);
  trim.connect(stripFeed);
  route.innerNodes = [...nodes, trim];
  route.suiteInput = input;
  route.makeupGains = collectMakeupGains(nodes);
  route.tapFrom = trim;
  route.suiteWired = true;
  route.lastRack = cloneStudioTrackInsertFxRack(rack);
  retapStudioPitchMonitorSource(ctx, route.tapFrom, trackIndex);
}

/**
 * Gapless suite swap — connect new chain before severing old (no preStrip silence gap).
 */
function wireSuiteSwap(
  ctx: AudioContext,
  route: StripRoute,
  rack: StudioTrackInsertFxRack,
  stripIn: GainNode,
  bpm: number,
  trackIndex: number,
): void {
  /* Gapless by design — safe while transport lock holds mixer strip topology. */
  const stripFeed = ensureStripFeed(ctx, route, stripIn);
  const oldInner = [...route.innerNodes];
  const oldInput = route.suiteInput;
  const oldTap = route.tapFrom;

  const trim = ctx.createGain();
  trim.gain.value = INSERT_FX_OUTPUT_TRIM;
  const { input, nodes } = connectStudioInsertFxChain(
    ctx,
    SUITE_WIRE_SLOTS,
    rack,
    trim,
    bpm,
  );

  route.preStrip.connect(input);
  trim.connect(stripFeed);

  if (oldInput) {
    try {
      route.preStrip.disconnect(oldInput);
    } catch {
      /* */
    }
  }
  if (oldTap && oldTap !== route.preStrip) {
    try {
      oldTap.disconnect(stripFeed);
    } catch {
      /* */
    }
    try {
      oldTap.disconnect(stripIn);
    } catch {
      /* */
    }
  }
  stopNodes(oldInner);

  route.innerNodes = [...nodes, trim];
  route.suiteInput = input;
  route.makeupGains = collectMakeupGains(nodes);
  route.tapFrom = trim;
  route.suiteWired = true;
  route.lastRack = cloneStudioTrackInsertFxRack(rack);
  retapStudioPitchMonitorSource(ctx, route.tapFrom, trackIndex);
}

/**
 * Apply suite / bypass wiring for an existing route into a known strip.input.
 * Used both idle and during transport lock (mixer strip nodes stay fixed).
 */
function applyInsertRouteWiring(
  ctx: AudioContext,
  route: StripRoute,
  stripIn: GainNode,
  slots: readonly [MixerEffectId, MixerEffectId, MixerEffectId],
  rack: StudioTrackInsertFxRack,
  bpm: number,
  trackIndex: number,
): GainNode {
  const paramsSig = routeSignature(slots, rack, bpm);
  const wireSig = insertWireSignature(rack, bpm);
  const needSuite = studioTrackInsertFxNeeded(slots, rack);

  const modeChanged = needSuite !== route.suiteWired;
  const wireChanged = route.wireSignature !== wireSig;
  const paramsChanged = route.signature !== paramsSig;
  const stripInMoved = route.stripIn !== stripIn;

  if (!needSuite) {
    route.wireSignature = wireSig;
    route.signature = paramsSig;
    if (route.suiteWired || route.suiteInput || route.innerNodes.length > 0 || stripInMoved || !route.stripFeed) {
      wireBypass(ctx, route, stripIn, trackIndex);
    } else if (stripInMoved && route.stripFeed) {
      ensureStripFeed(ctx, route, stripIn);
    }
    retapStudioInsertFxAnalyserIfConsumerOpen(trackIndex);
    return resolveClipPlaybackBus(trackIndex, route.preStrip);
  }

  if (!modeChanged && !wireChanged && !paramsChanged && !stripInMoved && route.stripFeed) {
    retapStudioInsertFxAnalyserIfConsumerOpen(trackIndex);
    return resolveClipPlaybackBus(trackIndex, route.preStrip);
  }

  route.wireSignature = wireSig;
  route.signature = paramsSig;

  if (stripInMoved && !modeChanged && !wireChanged && !paramsChanged && route.stripFeed) {
    ensureStripFeed(ctx, route, stripIn);
    reconnectTapToStripFeed(route, route.stripFeed, needSuite);
    retapStudioInsertFxAnalyserIfConsumerOpen(trackIndex);
    return resolveClipPlaybackBus(trackIndex, route.preStrip);
  }

  if (needSuite && route.suiteWired && !modeChanged && !wireChanged && paramsChanged && route.lastRack) {
    const needsSwap = insertSuiteParamsNeedChainSwap(route.lastRack, rack);
    if (!needsSwap) {
      const ok = liveUpdateInsertSuiteParams(
        ctx,
        route.innerNodes,
        route.makeupGains,
        route.lastRack,
        rack,
        bpm,
      );
      if (ok) {
        route.lastRack = cloneStudioTrackInsertFxRack(rack);
        if (stripInMoved) {
          ensureStripFeed(ctx, route, stripIn);
          reconnectTapToStripFeed(route, route.stripFeed!, needSuite);
        }
        retapStudioInsertFxAnalyserIfConsumerOpen(trackIndex);
        return resolveClipPlaybackBus(trackIndex, route.preStrip);
      }
    }
    wireSuiteSwap(ctx, route, rack, stripIn, bpm, trackIndex);
    retapStudioInsertFxAnalyserIfConsumerOpen(trackIndex);
    return resolveClipPlaybackBus(trackIndex, route.preStrip);
  }

  if (!needSuite) {
    wireBypass(ctx, route, stripIn, trackIndex);
  } else if (route.suiteWired && (wireChanged || modeChanged)) {
    wireSuiteSwap(ctx, route, rack, stripIn, bpm, trackIndex);
  } else if (route.suiteWired) {
    wireSuiteSwap(ctx, route, rack, stripIn, bpm, trackIndex);
  } else {
    wireSuite(ctx, route, rack, stripIn, bpm, trackIndex);
  }

  retapStudioInsertFxAnalyserIfConsumerOpen(trackIndex);
  return resolveClipPlaybackBus(trackIndex, route.preStrip);
}

export function resolveStudioTrackPlaybackInput(
  ctx: AudioContext,
  masterBus: GainNode,
  trackIndex: number,
  stripCount: number,
  slots: readonly [MixerEffectId, MixerEffectId, MixerEffectId],
  rack: StudioTrackInsertFxRack,
  bpm: number,
  downstream?: AudioNode,
): GainNode {
  /* During transport lock: keep mixer strip topology, but still sync DA FX Suite
     so preset / knob changes apply audibly without Stop→Play. */
  if (isStudioMixerStripGraphPlaybackLocked()) {
    const route = ensurePreStrip(ctx, trackIndex);
    let stripIn = getStudioMixerStripInput(trackIndex);
    if (!stripIn) {
      /* Lock forbids strip rebuild, but strips may already exist under a higher count. */
      ensureStudioMixerStrips(ctx, masterBus, stripCount, downstream);
      stripIn = getStudioMixerStripInput(trackIndex);
    }
    if (!stripIn) {
      return resolveClipPlaybackBus(trackIndex, route.preStrip);
    }
    return applyInsertRouteWiring(ctx, route, stripIn, slots, rack, bpm, trackIndex);
  }

  /* Do not early-return on stripFeed alone — that left lanes stuck in bypass after
     idle init, so DA FX Suite toggles never reached wireSuite / liveUpdate. */

  ensureStudioMixerStrips(ctx, masterBus, stripCount, downstream);
  const stripIn = resolveStudioMixerStripInput(ctx, masterBus, trackIndex, stripCount, downstream);
  const route = ensurePreStrip(ctx, trackIndex);
  return applyInsertRouteWiring(ctx, route, stripIn, slots, rack, bpm, trackIndex);
}

export function resyncStudioTrackInsertFxStripInputs(
  ctx: AudioContext,
  masterBus: GainNode,
  stripCount: number,
  downstream?: AudioNode,
): void {
  if (isStudioMixerStripGraphPlaybackLocked()) return;
  for (const [trackIndex, route] of routes) {
    if (trackIndex >= stripCount) continue;
    const stripIn =
      getStudioMixerStripInput(trackIndex)
      ?? resolveStudioMixerStripInput(ctx, masterBus, trackIndex, stripCount, downstream);
    if (route.stripIn === stripIn && route.stripFeed) {
      continue;
    }
    const stripFeed = ensureStripFeed(ctx, route, stripIn);
    severStripFeedInputs(route, stripFeed, stripIn);
    reconnectTapToStripFeed(route, stripFeed, route.suiteWired);
    retapStudioInsertFxAnalyserIfConsumerOpen(trackIndex);
  }
}

export function getStudioTrackInsertPreStrip(trackIndex: number): GainNode | null {
  return routes.get(trackIndex)?.preStrip ?? null;
}

/** Stable clip/MIDI bus — preStrip or vocal-stack entry when already wired. */
export function getStudioTrackClipPlaybackBus(trackIndex: number): GainNode | null {
  const route = routes.get(trackIndex);
  if (!route?.preStrip) return null;
  return resolveClipPlaybackBus(trackIndex, route.preStrip);
}

/**
 * During transport lock: reconnect stripFeed → live strip.input when mixer strips were rebuilt
 * (e.g. STRIP_BUS_VERSION bump) without tearing down insert / vocal FX graphs.
 */
export function healStudioTrackPlaybackRouteIfStale(
  ctx: AudioContext,
  masterBus: GainNode,
  trackIndex: number,
  stripCount: number,
  downstream?: AudioNode,
): GainNode | null {
  const route = routes.get(trackIndex);
  if (!route?.preStrip) return null;

  const stripIn =
    getStudioMixerStripInput(trackIndex)
    ?? (isStudioMixerStripGraphPlaybackLocked()
      ? null
      : resolveStudioMixerStripInput(ctx, masterBus, trackIndex, stripCount, downstream));

  if (!stripIn) return resolveClipPlaybackBus(trackIndex, route.preStrip);

  if (route.stripFeed && route.stripIn === stripIn) {
    return resolveClipPlaybackBus(trackIndex, route.preStrip);
  }

  const stripFeed = ensureStripFeed(ctx, route, stripIn);
  severStripFeedInputs(route, stripFeed, stripIn);
  reconnectTapToStripFeed(route, stripFeed, route.suiteWired);
  retapStudioInsertFxAnalyserIfConsumerOpen(trackIndex);
  return resolveClipPlaybackBus(trackIndex, route.preStrip);
}

export function retapStudioInsertFxAnalyserIfConsumerOpen(trackIndex: number): void {
  if (!studioTrackAnalyserHasConsumer(trackIndex, 'fxSuite')) return;
  const route = routes.get(trackIndex);
  const tap = route?.tapFrom ?? route?.preStrip;
  if (!tap || tap.context.state === 'closed') return;
  retapStudioPitchMonitorSource(tap.context as AudioContext, tap, trackIndex);
}

registerStudioFxSuiteAnalyserResync(retapStudioInsertFxAnalyserIfConsumerOpen);

export function getStudioTrackInsertRouteSignature(trackIndex: number): string {
  return routes.get(trackIndex)?.signature ?? '';
}

export function resetStudioTrackInsertFxStrips(): void {
  if (isStudioMixerStripGraphPlaybackLocked()) return;
  resetAllSpectrumForgeBuses();
  for (const trackIndex of [...routes.keys()]) {
    const route = routes.get(trackIndex);
    if (route) destroyRoute(route, trackIndex);
    routes.delete(trackIndex);
  }
}

/** Drop insert route at `trackIndex` and shift higher keys down (track delete). */
export function removeStudioTrackInsertFxStripAt(trackIndex: number): void {
  const doomed = routes.get(trackIndex);
  if (doomed) {
    destroyRoute(doomed, trackIndex);
    routes.delete(trackIndex);
  }
  const keys = [...routes.keys()].filter((ti) => ti > trackIndex).sort((a, b) => a - b);
  for (const ti of keys) {
    const route = routes.get(ti);
    if (!route) continue;
    routes.delete(ti);
    routes.set(ti - 1, route);
  }
}
