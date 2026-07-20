/**
 * In-place DA FX Suite param updates — avoids tearing down preStrip during playback.
 */
import type { StudioTrackInsertFxRack } from '@/app/lib/studio/studioTrackInsertFx';

function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

function applyGate(comp: DynamicsCompressorNode, gate: StudioTrackInsertFxRack['gate']): void {
  comp.threshold.value = Math.max(-80, Math.min(-12, gate.thresholdDb));
  comp.knee.value = 8;
  comp.ratio.value = 3;
  comp.attack.value = Math.max(0.001, Math.min(0.05, gate.attackSec));
  comp.release.value = Math.max(0.05, Math.min(0.8, gate.releaseSec));
}

function applyCompressor(comp: DynamicsCompressorNode, c: StudioTrackInsertFxRack['compressor']): void {
  comp.threshold.value = Math.max(-48, Math.min(0, c.thresholdDb));
  comp.knee.value = Math.max(0, Math.min(40, c.kneeDb));
  comp.ratio.value = Math.max(1.01, Math.min(20, c.ratio));
  comp.attack.value = Math.max(0.003, Math.min(0.95, c.attackSec));
  comp.release.value = Math.max(0.04, Math.min(1.2, c.releaseSec));
}

function applyLimiter(comp: DynamicsCompressorNode, lim: StudioTrackInsertFxRack['limiter']): void {
  comp.threshold.value = Math.max(-24, Math.min(0, lim.ceilingDb));
  comp.release.value = Math.max(0.01, Math.min(0.4, lim.releaseSec));
}

/** Parallel / structural paths need a gapless chain swap, not live params. */
export function insertSuiteParamsNeedChainSwap(
  prev: StudioTrackInsertFxRack,
  next: StudioTrackInsertFxRack,
): boolean {
  return (
    prev.chorus.enabled !== next.chorus.enabled
    || prev.chorus.rateHz !== next.chorus.rateHz
    || prev.chorus.depth !== next.chorus.depth
    || prev.chorus.mix !== next.chorus.mix
    || prev.delay.enabled !== next.delay.enabled
    || prev.delay.syncToBpm !== next.delay.syncToBpm
    || prev.delay.note !== next.delay.note
    || prev.delay.feedback !== next.delay.feedback
    || prev.delay.mix !== next.delay.mix
    || prev.reverb.enabled !== next.reverb.enabled
    || prev.reverb.mix !== next.reverb.mix
    /* Decay only — mix can live-update later; impulse regen on tiny decay nudges is expensive. */
    || Math.abs(prev.reverb.decaySec - next.reverb.decaySec) > 0.08
    || prev.analogSaturation.level !== next.analogSaturation.level
    || prev.eq.enabled !== next.eq.enabled
    || JSON.stringify(prev.eq.bands) !== JSON.stringify(next.eq.bands)
    || prev.saturation.enabled !== next.saturation.enabled
    || prev.saturation.drive !== next.saturation.drive
    || prev.saturation.tone !== next.saturation.tone
  );
}

/**
 * Patch serial-module params on an existing suite chain.
 * Returns false when a gapless chain swap is required.
 */
export function liveUpdateInsertSuiteParams(
  ctx: AudioContext,
  innerNodes: readonly AudioNode[],
  makeupGains: readonly GainNode[],
  prevRack: StudioTrackInsertFxRack,
  rack: StudioTrackInsertFxRack,
  _bpm: number,
): boolean {
  if (insertSuiteParamsNeedChainSwap(prevRack, rack)) return false;

  const compressors = innerNodes.filter((n): n is DynamicsCompressorNode => n instanceof DynamicsCompressorNode);
  let ci = 0;
  let makeupIx = 0;

  if (rack.gate.enabled) {
    const comp = compressors[ci++];
    if (!comp) return false;
    applyGate(comp, rack.gate);
  }

  if (rack.deEsser.enabled) {
    const comp = compressors[ci++];
    if (!comp) return false;
    const amount = Math.max(0, Math.min(150, rack.deEsser.amount));
    const t = amount / 150;
    comp.threshold.value = -10 - t * 38;
    comp.ratio.value = 2 + t * 18;
    if (rack.deEsser.freqHz !== prevRack.deEsser.freqHz) return false;
  }

  if (rack.compressor.enabled) {
    const comp = compressors[ci++];
    if (!comp) return false;
    applyCompressor(comp, rack.compressor);
    const makeup = makeupGains[makeupIx];
    if (makeup) {
      makeup.gain.value = Math.min(4, dbToLinear(Math.max(0, Math.min(18, rack.compressor.makeupDb))));
      makeupIx++;
    }
  }

  if (rack.filter.enabled) {
    const biquads = innerNodes.filter((n): n is BiquadFilterNode => n instanceof BiquadFilterNode);
    const q = Math.max(0.1, Math.min(18, 0.5 + rack.filter.resonance * 12));
    const hp = biquads.find((f) => f.type === 'highpass');
    const lp = biquads.find((f) => f.type === 'lowpass');
    if (!hp || !lp) return false;
    hp.frequency.value = Math.max(20, Math.min(800, rack.filter.lowCutHz));
    hp.Q.value = q;
    lp.frequency.value = Math.max(400, Math.min(18000, rack.filter.highCutHz));
    lp.Q.value = q;
  }

  if (rack.limiter.enabled) {
    const comp = compressors[ci++];
    if (!comp) return false;
    applyLimiter(comp, rack.limiter);
  }

  void ctx;
  return true;
}
