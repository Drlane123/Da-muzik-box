/**
 * Spectrum Forge — per-lane 3-band insert EQ (v5 rebuild).
 *
 * Industry-standard **serial** chain only (no parallel dry/wet — that causes hollow
 * comb-filter / "reverb" artifacts when phases don't align):
 *   upstream → lowShelf → midPeak → highShelf → outGain → downstream
 *
 * Bypass toggles **one** wire swap (upstream→downstream vs EQ chain) — not on every
 * knob move. Analyser taps are parallel read-only fan-outs.
 */
import {
  normalizeStudioSpectrumForgeFx,
  SPECTRUM_FORGE_BOOST_MAX_DB,
  type StudioSpectrumForgeFx,
} from '@/app/lib/studio/studioSpectrumForge';
import { spectrumForgeConfigureAnalyser } from '@/app/lib/studio/studioSpectrumForgeAnalyzer';

export const SPECTRUM_FORGE_METER_FFT = 2048;
export const SPECTRUM_FORGE_METER_SIGNAL_PEAK = 0.003;
export const SPECTRUM_FORGE_METER_SIGNAL_RMS = 0.0015;

export type SpectrumForgeMeterSnapshot = {
  peak: number;
  rms: number;
  hasSignal: boolean;
  spectrum: Float32Array;
  /** True when snapshot is post-EQ (EQ powered on). */
  postEq: boolean;
};

function clampDb(db: number): number {
  return Math.max(-SPECTRUM_FORGE_BOOST_MAX_DB, Math.min(SPECTRUM_FORGE_BOOST_MAX_DB, db));
}

function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

function disconnectOutputs(node: AudioNode): void {
  try {
    node.disconnect();
  } catch {
    /* */
  }
}

function forgeDbToLinear(db: number, floorDb: number): number {
  if (!Number.isFinite(db) || db <= floorDb) return 0;
  return Math.min(1, Math.pow(10, db / 20));
}

class SpectrumForgeBus {
  readonly upstream: GainNode;
  readonly downstream: GainNode;
  readonly merge: GainNode;
  readonly low: BiquadFilterNode;
  readonly mid: BiquadFilterNode;
  readonly high: BiquadFilterNode;
  readonly outGain: GainNode;
  readonly preAnalyser: AnalyserNode;
  readonly postAnalyser: AnalyserNode;

  private bypassed = true;
  private eqPowered = false;
  private floatScratch: Float32Array;

  constructor(upstream: GainNode, downstream: GainNode) {
    this.upstream = upstream;
    this.downstream = downstream;

    const ctx = upstream.context as AudioContext;

    this.merge = ctx.createGain();
    this.merge.gain.value = 1;

    this.low = ctx.createBiquadFilter();
    this.low.type = 'lowshelf';

    this.mid = ctx.createBiquadFilter();
    this.mid.type = 'peaking';

    this.high = ctx.createBiquadFilter();
    this.high.type = 'highshelf';

    this.outGain = ctx.createGain();
    this.outGain.gain.value = 1;

    this.preAnalyser = ctx.createAnalyser();
    this.postAnalyser = ctx.createAnalyser();
    spectrumForgeConfigureAnalyser(this.preAnalyser);
    spectrumForgeConfigureAnalyser(this.postAnalyser);
    this.preAnalyser.fftSize = SPECTRUM_FORGE_METER_FFT;
    this.postAnalyser.fftSize = SPECTRUM_FORGE_METER_FFT;

    this.low.connect(this.mid);
    this.mid.connect(this.high);
    this.high.connect(this.outGain);

    this.merge.connect(this.downstream);

    this.upstream.connect(this.preAnalyser);
    this.merge.connect(this.postAnalyser);

    this.floatScratch = new Float32Array(this.preAnalyser.frequencyBinCount);

    this.setBypass(true);
    this.zeroBands();
  }

  apply(fx: StudioSpectrumForgeFx): void {
    const ctx = this.upstream.context as AudioContext;
    const t = ctx.currentTime;
    const mix = Math.max(0, Math.min(1, fx.mix));
    const wantBypass = !fx.enabled || mix <= 0.0001;

    if (wantBypass !== this.bypassed) {
      this.setBypass(wantBypass);
    }
    this.eqPowered = fx.enabled && mix > 0.0001;

    this.low.frequency.setValueAtTime(fx.low.centerHz, t);
    this.mid.frequency.setValueAtTime(fx.mid.centerHz, t);
    this.high.frequency.setValueAtTime(fx.high.centerHz, t);

    this.mid.Q.setValueAtTime(1, t);

    if (wantBypass) {
      this.zeroBands(t);
      return;
    }

    this.setBandGain(this.low, clampDb(fx.low.boostDb * mix), t);
    this.setBandGain(this.mid, clampDb(fx.mid.boostDb * mix), t);
    this.setBandGain(this.high, clampDb(fx.high.boostDb * mix), t);

    this.outGain.gain.cancelScheduledValues(t);
    this.outGain.gain.setValueAtTime(dbToLinear(fx.outputDb), t);
  }

  readMeter(reuseSpectrum?: Float32Array): SpectrumForgeMeterSnapshot {
    const analyser = this.eqPowered ? this.postAnalyser : this.preAnalyser;
    const time = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(time);

    let peak = 0;
    let sumSq = 0;
    for (let i = 0; i < time.length; i++) {
      const s = time[i] ?? 0;
      const a = Math.abs(s);
      if (a > peak) peak = a;
      sumSq += s * s;
    }
    const rms = Math.sqrt(sumSq / Math.max(1, time.length));
    const hasSignal =
      peak >= SPECTRUM_FORGE_METER_SIGNAL_PEAK || rms >= SPECTRUM_FORGE_METER_SIGNAL_RMS;

    const binCount = analyser.frequencyBinCount;
    const spectrum =
      reuseSpectrum && reuseSpectrum.length === binCount
        ? reuseSpectrum
        : new Float32Array(binCount);

    if (this.floatScratch.length !== binCount) {
      this.floatScratch = new Float32Array(binCount);
    }
    analyser.getFloatFrequencyData(this.floatScratch);
    const floorDb = analyser.minDecibels;
    for (let i = 0; i < binCount; i++) {
      spectrum[i] = forgeDbToLinear(this.floatScratch[i] ?? floorDb, floorDb);
    }

    return { peak, rms, hasSignal, spectrum, postEq: this.eqPowered };
  }

  dispose(): void {
    disconnectOutputs(this.low);
    disconnectOutputs(this.mid);
    disconnectOutputs(this.high);
    disconnectOutputs(this.outGain);
    disconnectOutputs(this.merge);
    disconnectOutputs(this.upstream);
    disconnectOutputs(this.preAnalyser);
    disconnectOutputs(this.postAnalyser);
    try {
      this.upstream.disconnect(this.downstream);
    } catch {
      /* */
    }
    this.upstream.connect(this.downstream);
  }

  /** Hard bypass: one wire upstream→merge. EQ chain idle. */
  private setBypass(on: boolean): void {
    this.bypassed = on;
    disconnectOutputs(this.upstream);
    disconnectOutputs(this.outGain);

    if (on) {
      this.upstream.connect(this.merge);
    } else {
      this.upstream.connect(this.low);
      this.outGain.connect(this.merge);
    }

    // Keep pre analyser fed after upstream reconnect.
    this.upstream.connect(this.preAnalyser);
  }

  private zeroBands(t?: number): void {
    const ctx = this.upstream.context as AudioContext;
    const now = t ?? ctx.currentTime;
    this.setBandGain(this.low, 0, now);
    this.setBandGain(this.mid, 0, now);
    this.setBandGain(this.high, 0, now);
    this.outGain.gain.cancelScheduledValues(now);
    this.outGain.gain.setValueAtTime(1, now);
  }

  private setBandGain(filter: BiquadFilterNode, db: number, t: number): void {
    filter.gain.cancelScheduledValues(t);
    filter.gain.setValueAtTime(db, t);
  }
}

const buses = new Map<number, SpectrumForgeBus>();
const lastFxByTrack = new Map<number, StudioSpectrumForgeFx>();

export function ensureSpectrumForgeBus(
  trackIndex: number,
  upstream: GainNode,
  downstream: GainNode,
): void {
  const existing = buses.get(trackIndex);
  if (existing?.upstream === upstream && existing?.downstream === downstream) {
    const saved = lastFxByTrack.get(trackIndex);
    if (saved) {
      existing.apply(normalizeStudioSpectrumForgeFx(saved));
    }
    return;
  }

  try {
    upstream.disconnect(downstream);
  } catch {
    /* legacy ghost wire */
  }

  if (existing) {
    existing.dispose();
  }
  const bus = new SpectrumForgeBus(upstream, downstream);
  buses.set(trackIndex, bus);
  const saved = lastFxByTrack.get(trackIndex);
  bus.apply(normalizeStudioSpectrumForgeFx(saved ?? { enabled: false }));
}

export function setSpectrumForgeFx(trackIndex: number, rawFx: StudioSpectrumForgeFx): void {
  const fx = normalizeStudioSpectrumForgeFx(rawFx);
  lastFxByTrack.set(trackIndex, fx);
  buses.get(trackIndex)?.apply(fx);
}

export function resolveSpectrumForgeFxForApply(
  trackIndex: number,
  rackFx: StudioSpectrumForgeFx,
  panelLive: boolean,
): StudioSpectrumForgeFx {
  if (panelLive) {
    const saved = lastFxByTrack.get(trackIndex);
    if (saved) return saved;
  }
  return normalizeStudioSpectrumForgeFx(rackFx);
}

export function releaseSpectrumForgeBus(trackIndex: number): void {
  const bus = buses.get(trackIndex);
  if (bus) {
    bus.dispose();
    buses.delete(trackIndex);
  }
}

/** Pre-EQ input tap — for shared pitch/insert retap when panel closed. */
export function getSpectrumForgeAnalyserTap(trackIndex: number): AudioNode | null {
  return buses.get(trackIndex)?.upstream ?? null;
}

export function readSpectrumForgeMeterSnapshot(
  trackIndex: number,
  reuseSpectrum?: Float32Array,
): SpectrumForgeMeterSnapshot | null {
  return buses.get(trackIndex)?.readMeter(reuseSpectrum) ?? null;
}

export function resetAllSpectrumForgeBuses(): void {
  for (const trackIndex of [...buses.keys()]) {
    releaseSpectrumForgeBus(trackIndex);
  }
  lastFxByTrack.clear();
}

export function reapplySpectrumForgeFx(trackIndex: number): void {
  const fx = lastFxByTrack.get(trackIndex);
  if (!fx) return;
  buses.get(trackIndex)?.apply(normalizeStudioSpectrumForgeFx(fx));
}

export const syncStudioSpectrumForge = setSpectrumForgeFx;
