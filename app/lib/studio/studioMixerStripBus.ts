/**
 * Studio Editor 2 mixer — post-fader strips + honest peak meters.
 *
 * Audio: input → panner → fader → master bus (direct). Meters tap in parallel (never in series).
 */
import { mixerVolToLinearGain } from '@/app/lib/studio/se2MixerFaderScale';
import {
  studioMixerBufferPeak,
  studioMixerBufferRms,
  studioMixerMeterTargetLinear,
  STUDIO_MIXER_SILENCE_LINEAR,
} from '@/app/lib/studio/studioMixerMeterEngine';
import {
  createStudioChannelMeterNode,
  ensureStudioChannelMeterWorklet,
  studioChannelMeterWorkletUsable,
} from '@/app/lib/studio/studioMixerMeterWorklet';

const STRIP_BUS_VERSION = 30;
const METER_ANALYSER_FFT = 2048;
const SPECTRUM_ANALYSER_FFT = 2048;

export type StudioMixerStripSnapshot = {
  peakL: number;
  peakR: number;
  rmsL: number;
  rmsR: number;
  linearPeak: number;
};

type MeterPeaks = {
  peakL: number;
  peakR: number;
  rmsL: number;
  rmsR: number;
};

type StripNodes = {
  input: GainNode;
  panner: StereoPannerNode;
  fader: GainNode;
  meterWorklet: AudioWorkletNode | null;
  meterPeaks: MeterPeaks;
  meterSplitter: ChannelSplitterNode | null;
  meterAnalyserL: AnalyserNode | null;
  meterAnalyserR: AnalyserNode | null;
  meterPassL: GainNode | null;
  meterPassR: GainNode | null;
  meterMerger: ChannelMergerNode | null;
  meterBufL: Float32Array | null;
  meterBufR: Float32Array | null;
  lastMono: boolean;
  /** Skip redundant AudioParam writes when mix state is unchanged. */
  lastMixSig: string;
  spectrumAnalyser: AnalyserNode;
  spectrumTimeBuf: Float32Array;
  spectrumFreqBuf: Float32Array;
  /** Pre-fader tap — audio hitting strip.input (track lane IN meter). */
  inputAnalyser: AnalyserNode;
  /** Zero-gain return — keeps inputAnalyser in the render pull tree. */
  inputAnalyserSilent: GainNode;
  inputMeterBuf: Float32Array;
  version: number;
};

const strips = new Map<number, StripNodes>();

type MasterMeterTap = {
  ctx: AudioContext;
  downstream: AudioNode;
  meterWorklet: AudioWorkletNode | null;
  meterPeaks: MeterPeaks;
  splitter: ChannelSplitterNode | null;
  analyserL: AnalyserNode | null;
  analyserR: AnalyserNode | null;
  passL: GainNode | null;
  passR: GainNode | null;
  merger: ChannelMergerNode | null;
  bufL: Float32Array | null;
  bufR: Float32Array | null;
};

let masterMeterTap: MasterMeterTap | null = null;

function emptyMeterPeaks(): MeterPeaks {
  return { peakL: 0, peakR: 0, rmsL: 0, rmsR: 0 };
}

function bindMeterWorkletPort(node: AudioWorkletNode, peaks: MeterPeaks): void {
  node.port.onmessage = (ev: MessageEvent<Partial<MeterPeaks>>) => {
    const d = ev.data;
    if (!d || typeof d.peakL !== 'number' || typeof d.peakR !== 'number') return;
    // Hold the hottest sample since the last paint read (processor also holds).
    peaks.peakL = Math.max(peaks.peakL, d.peakL);
    peaks.peakR = Math.max(peaks.peakR, d.peakR);
    peaks.rmsL = Math.max(peaks.rmsL, typeof d.rmsL === 'number' ? d.rmsL : d.peakL);
    peaks.rmsR = Math.max(peaks.rmsR, typeof d.rmsR === 'number' ? d.rmsR : d.peakR);
  };
}

/** Consume held worklet peaks after a paint read so the next interval starts fresh. */
function consumeMeterPeaks(peaks: MeterPeaks): MeterPeaks {
  const snap = {
    peakL: peaks.peakL,
    peakR: peaks.peakR,
    rmsL: peaks.rmsL,
    rmsR: peaks.rmsR,
  };
  peaks.peakL = 0;
  peaks.peakR = 0;
  peaks.rmsL = 0;
  peaks.rmsR = 0;
  return snap;
}

function configureMeterAnalyser(analyser: AnalyserNode): void {
  analyser.fftSize = METER_ANALYSER_FFT;
  analyser.smoothingTimeConstant = 0;
  analyser.channelCount = 1;
  analyser.channelCountMode = 'explicit';
}

/**
 * Spectrum FFT tap on the live post-fader path — silent branch back to the same summing bus
 * so the analyser renders without a second pull from fader → destination.
 */
function attachSpectrumAnalyserTap(
  tapNode: AudioNode,
  masterBus: GainNode,
): Pick<StripNodes, 'spectrumAnalyser' | 'spectrumTimeBuf' | 'spectrumFreqBuf'> {
  const ctx = masterBus.context as AudioContext;
  const spectrumAnalyser = ctx.createAnalyser();
  spectrumAnalyser.fftSize = SPECTRUM_ANALYSER_FFT;
  spectrumAnalyser.smoothingTimeConstant = 0.04;
  tapNode.connect(spectrumAnalyser);
  const silent = ctx.createGain();
  silent.gain.value = 0;
  spectrumAnalyser.connect(silent);
  silent.connect(masterBus);
  return {
    spectrumAnalyser,
    spectrumTimeBuf: new Float32Array(spectrumAnalyser.fftSize),
    spectrumFreqBuf: new Float32Array(spectrumAnalyser.frequencyBinCount),
  };
}

function readMonoAnalyser(analyser: AnalyserNode, buf: Float32Array): { peak: number; rms: number } {
  try {
    analyser.getFloatTimeDomainData(buf);
  } catch {
    return { peak: 0, rms: 0 };
  }
  return {
    peak: studioMixerBufferPeak(buf),
    rms: studioMixerBufferRms(buf),
  };
}

type SeriesMeterNodes = Pick<
  StripNodes,
  | 'meterWorklet'
  | 'meterPeaks'
  | 'meterSplitter'
  | 'meterAnalyserL'
  | 'meterAnalyserR'
  | 'meterPassL'
  | 'meterPassR'
  | 'meterMerger'
  | 'meterBufL'
  | 'meterBufR'
>;

/**
 * Parallel meter tap off the post-fader node. Live audio: fader → masterBus (direct).
 * Meter branch: fader → split → analyser → merge → [worklet → silent sink].
 */
function connectFaderToBus(
  ctx: AudioContext,
  fader: GainNode,
  masterBus: GainNode,
): SeriesMeterNodes {
  fader.connect(masterBus);

  const meterPeaks = emptyMeterPeaks();
  const splitter = ctx.createChannelSplitter(2);
  const merger = ctx.createChannelMerger(2);
  const analyserL = ctx.createAnalyser();
  const analyserR = ctx.createAnalyser();
  configureMeterAnalyser(analyserL);
  configureMeterAnalyser(analyserR);
  const passL = ctx.createGain();
  const passR = ctx.createGain();
  passL.gain.value = 1;
  passR.gain.value = 1;

  fader.connect(splitter);
  splitter.connect(analyserL, 0, 0);
  splitter.connect(analyserR, 1, 0);
  analyserL.connect(passL);
  analyserR.connect(passR);
  passL.connect(merger, 0, 0);
  passR.connect(merger, 0, 1);

  const worklet = createStudioChannelMeterNode(ctx);
  const silent = ctx.createGain();
  silent.gain.value = 0;
  if (worklet) {
    bindMeterWorkletPort(worklet, meterPeaks);
    merger.connect(worklet);
    worklet.connect(silent);
  } else {
    merger.connect(silent);
  }
  // Zero-gain return keeps the meter subgraph in the render pull tree (analysers otherwise stay flat).
  silent.connect(masterBus);

  return {
    meterWorklet: worklet,
    meterPeaks,
    meterSplitter: splitter,
    meterAnalyserL: analyserL,
    meterAnalyserR: analyserR,
    meterPassL: passL,
    meterPassR: passR,
    meterMerger: merger,
    meterBufL: new Float32Array(analyserL.fftSize),
    meterBufR: new Float32Array(analyserR.fftSize),
  };
}

function tearDownStrip(trackIndex: number): void {
  const strip = strips.get(trackIndex);
  if (!strip) return;
  if (strip.meterWorklet) {
    strip.meterWorklet.port.onmessage = null;
  }
  for (const node of [
    strip.input,
    strip.panner,
    strip.fader,
    strip.meterWorklet,
    strip.meterSplitter,
    strip.meterAnalyserL,
    strip.meterAnalyserR,
    strip.meterPassL,
    strip.meterPassR,
    strip.meterMerger,
    strip.spectrumAnalyser,
    strip.inputAnalyser,
    strip.inputAnalyserSilent,
  ]) {
    if (!node) continue;
    try {
      node.disconnect();
    } catch {
      /* */
    }
  }
  strips.delete(trackIndex);
}


function tearDownMasterMeterTap(): void {
  if (!masterMeterTap) return;
  if (masterMeterTap.meterWorklet) {
    masterMeterTap.meterWorklet.port.onmessage = null;
  }
  for (const node of [
    masterMeterTap.meterWorklet,
    masterMeterTap.splitter,
    masterMeterTap.analyserL,
    masterMeterTap.analyserR,
    masterMeterTap.passL,
    masterMeterTap.passR,
    masterMeterTap.merger,
  ]) {
    if (!node) continue;
    try {
      node.disconnect();
    } catch {
      /* */
    }
  }
  masterMeterTap = null;
}

function masterTapNeedsRebuild(
  ctx: AudioContext,
  downstream: AudioNode,
): boolean {
  if (!masterMeterTap) return true;
  if (masterMeterTap.ctx !== ctx || masterMeterTap.downstream !== downstream) return true;
  const workletUsable = studioChannelMeterWorkletUsable(ctx);
  if (workletUsable && !masterMeterTap.meterWorklet) return true;
  return false;
}

function ensureMasterMeterTap(ctx: AudioContext, masterBus: GainNode, downstream: AudioNode): void {
  if (!masterTapNeedsRebuild(ctx, downstream)) {
    return;
  }

  tearDownMasterMeterTap();

  const meterPeaks = emptyMeterPeaks();
  const splitter = ctx.createChannelSplitter(2);
  const merger = ctx.createChannelMerger(2);
  const analyserL = ctx.createAnalyser();
  const analyserR = ctx.createAnalyser();
  configureMeterAnalyser(analyserL);
  configureMeterAnalyser(analyserR);
  const passL = ctx.createGain();
  const passR = ctx.createGain();
  passL.gain.value = 1;
  passR.gain.value = 1;

  try {
    masterBus.disconnect(downstream);
  } catch {
    /* first wire */
  }
  masterBus.connect(downstream);

  masterBus.connect(splitter);
  splitter.connect(analyserL, 0, 0);
  splitter.connect(analyserR, 1, 0);
  analyserL.connect(passL);
  analyserR.connect(passR);
  passL.connect(merger, 0, 0);
  passR.connect(merger, 0, 1);

  const worklet = createStudioChannelMeterNode(ctx);
  const bufL = new Float32Array(analyserL.fftSize);
  const bufR = new Float32Array(analyserR.fftSize);
  const silent = ctx.createGain();
  silent.gain.value = 0;

  if (worklet) {
    bindMeterWorkletPort(worklet, meterPeaks);
    merger.connect(worklet);
    worklet.connect(silent);
    silent.connect(downstream);
    masterMeterTap = {
      ctx,
      downstream,
      meterWorklet: worklet,
      meterPeaks,
      splitter,
      analyserL,
      analyserR,
      passL,
      passR,
      merger,
      bufL,
      bufR,
    };
    return;
  }

  merger.connect(silent);
  silent.connect(downstream);
  masterMeterTap = {
    ctx,
    downstream,
    meterWorklet: null,
    meterPeaks,
    splitter,
    analyserL,
    analyserR,
    passL,
    passR,
    merger,
    bufL,
    bufR,
  };
}

function readStripRawPeaks(strip: StripNodes): {
  peakL: number;
  peakR: number;
  rmsL: number;
  rmsR: number;
} {
  let peakL = 0;
  let peakR = 0;
  let rmsL = 0;
  let rmsR = 0;

  if (strip.meterWorklet) {
    const held = consumeMeterPeaks(strip.meterPeaks);
    peakL = held.peakL;
    peakR = held.peakR;
    rmsL = held.rmsL;
    rmsR = held.rmsR;
    // Worklet already saw signal — skip expensive analyser pulls this frame.
    if (peakL > STUDIO_MIXER_SILENCE_LINEAR || peakR > STUDIO_MIXER_SILENCE_LINEAR) {
      if (strip.lastMono) {
        const peak = Math.max(peakL, peakR);
        const rms = Math.max(rmsL, rmsR);
        return { peakL: peak, peakR: peak, rmsL: rms, rmsR: rms };
      }
      return { peakL, peakR, rmsL, rmsR };
    }
  }

  if (
    strip.meterAnalyserL
    && strip.meterAnalyserR
    && strip.meterBufL
    && strip.meterBufR
  ) {
    const l = readMonoAnalyser(strip.meterAnalyserL, strip.meterBufL);
    const r = readMonoAnalyser(strip.meterAnalyserR, strip.meterBufR);
    peakL = Math.max(peakL, l.peak);
    peakR = Math.max(peakR, r.peak);
    rmsL = Math.max(rmsL, l.rms);
    rmsR = Math.max(rmsR, r.rms);
  }

  if (strip.lastMono) {
    const peak = Math.max(peakL, peakR);
    const rms = Math.max(rmsL, rmsR);
    return { peakL: peak, peakR: peak, rmsL: rms, rmsR: rms };
  }
  return { peakL, peakR, rmsL, rmsR };
}

function peaksToSnapshot(
  trackIndex: number,
  raw: {
    peakL: number;
    peakR: number;
    rmsL: number;
    rmsR: number;
  },
): StudioMixerStripSnapshot {
  const peakL = studioMixerMeterTargetLinear(raw.peakL, raw.rmsL, trackIndex * 2);
  const peakR = studioMixerMeterTargetLinear(raw.peakR, raw.rmsR, trackIndex * 2 + 1);
  const linearPeak = Math.max(peakL, peakR);
  if (linearPeak <= STUDIO_MIXER_SILENCE_LINEAR) {
    return { peakL: 0, peakR: 0, rmsL: 0, rmsR: 0, linearPeak: 0 };
  }
  return { peakL, peakR, rmsL: raw.rmsL, rmsR: raw.rmsR, linearPeak };
}

function stripNeedsRebuild(existing: StripNodes | undefined, ctx: AudioContext): boolean {
  if (!existing || existing.input.context !== ctx || existing.version !== STRIP_BUS_VERSION) {
    return true;
  }
  const workletUsable = studioChannelMeterWorkletUsable(ctx);
  if (workletUsable && !existing.meterWorklet) return true;
  return false;
}

/** Returns true when strips were rebuilt (insert FX must resync). */
export function ensureStudioMixerStrips(
  ctx: AudioContext,
  masterBus: GainNode,
  count: number,
  downstream: AudioNode = masterBus.context.destination,
): boolean {
  ensureMasterMeterTap(ctx, masterBus, downstream);
  let rebuilt = false;

  for (let ti = 0; ti < count; ti++) {
    const existing = strips.get(ti);
    if (!stripNeedsRebuild(existing, ctx)) {
      continue;
    }
    if (existing) tearDownStrip(ti);
    rebuilt = true;

    const input = ctx.createGain();
    input.gain.value = 1;
    const panner = ctx.createStereoPanner();
    panner.pan.value = 0;
    const fader = ctx.createGain();
    fader.gain.value = 1;

    input.connect(panner);
    panner.connect(fader);

    const inputAnalyser = ctx.createAnalyser();
    configureMeterAnalyser(inputAnalyser);
    const inputAnalyserSilent = ctx.createGain();
    inputAnalyserSilent.gain.value = 0;
    try {
      input.connect(inputAnalyser);
      inputAnalyser.connect(inputAnalyserSilent);
      inputAnalyserSilent.connect(masterBus);
    } catch {
      /* parallel tap */
    }

    const meter = connectFaderToBus(ctx, fader, masterBus);
    const meterTail = meter.meterWorklet ?? meter.meterMerger;
    const spectrum = meterTail
      ? attachSpectrumAnalyserTap(meterTail, masterBus)
      : {
          spectrumAnalyser: ctx.createAnalyser(),
          spectrumTimeBuf: new Float32Array(SPECTRUM_ANALYSER_FFT),
          spectrumFreqBuf: new Float32Array(SPECTRUM_ANALYSER_FFT / 2),
        };
    strips.set(ti, {
      input,
      panner,
      fader,
      ...meter,
      lastMono: false,
      lastMixSig: '',
      ...spectrum,
      inputAnalyser,
      inputAnalyserSilent,
      inputMeterBuf: new Float32Array(inputAnalyser.fftSize),
      version: STRIP_BUS_VERSION,
    });
  }

  return rebuilt;
}

export function resolveStudioMixerStripInput(
  ctx: AudioContext,
  masterBus: GainNode,
  trackIndex: number,
  stripCount: number,
  downstream?: AudioNode,
): GainNode {
  ensureStudioMixerStrips(ctx, masterBus, stripCount, downstream);
  const strip = strips.get(trackIndex);
  if (!strip) {
    throw new Error(`[studioMixerStripBus] missing strip for track ${trackIndex}`);
  }
  return strip.input;
}

export function getStudioMixerStripInput(trackIndex: number): GainNode | null {
  return strips.get(trackIndex)?.input ?? null;
}

/** True when strip fader is effectively muted (scope / meters should stay idle). */
export function studioMixerStripAudible(trackIndex: number): boolean {
  const strip = strips.get(trackIndex);
  if (!strip) return true;
  return strip.fader.gain.value > 0.00008;
}

export function applyStudioMixerStripMix(
  trackIndex: number,
  opts: { muted: boolean; vol127: number; pan127: number; mono: boolean },
): void {
  const strip = strips.get(trackIndex);
  if (!strip) return;
  const sig = `${opts.muted ? 1 : 0}:${opts.vol127}:${opts.pan127}:${opts.mono ? 1 : 0}`;
  if (strip.lastMixSig === sig) return;
  strip.lastMixSig = sig;
  strip.fader.gain.value = opts.muted ? 0 : mixerVolToLinearGain(opts.vol127);
  strip.panner.pan.value = opts.mono
    ? 0
    : Math.max(-1, Math.min(1, (opts.pan127 - 64) / 63));
  strip.lastMono = opts.mono;
}

/** Sync peak read — post-fader meter on the live strip output. */
export function readStudioMixerStripMeter(trackIndex: number): StudioMixerStripSnapshot | null {
  const strip = strips.get(trackIndex);
  if (!strip) return null;
  return peaksToSnapshot(trackIndex, readStripRawPeaks(strip));
}

/** Pre-fader peak at strip.input — proves audio reached this track lane (before fader/mute). */
export function readStudioMixerStripInputMeter(trackIndex: number): StudioMixerStripSnapshot | null {
  const strip = strips.get(trackIndex);
  if (!strip?.inputAnalyser || !strip.inputMeterBuf) return null;
  const { peak, rms } = readMonoAnalyser(strip.inputAnalyser, strip.inputMeterBuf);
  const peakL = studioMixerMeterTargetLinear(peak, rms, trackIndex * 2 + 512);
  const peakR = strip.lastMono ? peakL : peakL;
  const linearPeak = peakL;
  if (linearPeak <= STUDIO_MIXER_SILENCE_LINEAR) {
    return { peakL: 0, peakR: 0, rmsL: 0, rmsR: 0, linearPeak: 0 };
  }
  return { peakL, peakR, rmsL: rms, rmsR: rms, linearPeak };
}

export function readStudioMasterBusMeter(): { peakL: number; peakR: number } | null {
  const tap = masterMeterTap;
  if (!tap) return null;

  if (tap.meterWorklet) {
    const held = consumeMeterPeaks(tap.meterPeaks);
    let outL = studioMixerMeterTargetLinear(held.peakL, held.rmsL, -2);
    let outR = studioMixerMeterTargetLinear(held.peakR, held.rmsR, -3);
    if (tap.analyserL && tap.analyserR && tap.bufL && tap.bufR) {
      const l = readMonoAnalyser(tap.analyserL, tap.bufL);
      const r = readMonoAnalyser(tap.analyserR, tap.bufR);
      outL = Math.max(outL, studioMixerMeterTargetLinear(l.peak, l.rms, -2));
      outR = Math.max(outR, studioMixerMeterTargetLinear(r.peak, r.rms, -3));
    }
    return { peakL: outL, peakR: outR };
  }

  if (!tap.analyserL || !tap.analyserR || !tap.bufL || !tap.bufR) return null;
  const l = readMonoAnalyser(tap.analyserL, tap.bufL);
  const r = readMonoAnalyser(tap.analyserR, tap.bufR);
  return {
    peakL: studioMixerMeterTargetLinear(l.peak, l.rms, -2),
    peakR: studioMixerMeterTargetLinear(r.peak, r.rms, -3),
  };
}

export function resetStudioMixerMeterPeaks(): void {
  for (const strip of strips.values()) {
    Object.assign(strip.meterPeaks, emptyMeterPeaks());
  }
  if (masterMeterTap) {
    Object.assign(masterMeterTap.meterPeaks, emptyMeterPeaks());
  }
}

export type StudioMixerStripAnalyserSnapshot = {
  peak: number;
  peakL: number;
  peakR: number;
  rms: number;
  hasSignal: boolean;
  spectrum: Float32Array;
  waveform: Float32Array;
};

export function readStudioMixerStripAnalyserSnapshot(
  trackIndex: number,
  reuseSpectrum?: Float32Array,
): StudioMixerStripAnalyserSnapshot | null {
  const strip = strips.get(trackIndex);
  if (!strip) return null;

  const time = strip.spectrumTimeBuf;
  const freq = strip.spectrumFreqBuf;
  try {
    strip.spectrumAnalyser.getFloatTimeDomainData(time);
    strip.spectrumAnalyser.getFloatFrequencyData(freq);
  } catch {
    return null;
  }

  let peak = 0;
  let sumSq = 0;
  for (let i = 0; i < time.length; i++) {
    const s = time[i] ?? 0;
    const a = Math.abs(s);
    if (a > peak) peak = a;
    sumSq += s * s;
  }
  const rms = Math.sqrt(sumSq / Math.max(1, time.length));

  const meter = readStudioMixerStripMeter(trackIndex);
  const inputMeter = readStudioMixerStripInputMeter(trackIndex);
  const peakL = meter?.peakL ?? 0;
  const peakR = meter?.peakR ?? 0;
  const meterHasSignal = (meter?.linearPeak ?? 0) > STUDIO_MIXER_SILENCE_LINEAR;
  const inputHasSignal = (inputMeter?.linearPeak ?? 0) > STUDIO_MIXER_SILENCE_LINEAR;
  /** FFT tap can see energy before the worklet meter catches up — keep the graph alive. */
  const analyserHasSignal = peak >= 0.004 || rms >= 0.003;
  const hasSignal = meterHasSignal || inputHasSignal || analyserHasSignal;

  const binCount = strip.spectrumAnalyser.frequencyBinCount;
  const spectrum =
    reuseSpectrum && reuseSpectrum.length === binCount
      ? reuseSpectrum
      : new Float32Array(binCount);

  if (hasSignal || analyserHasSignal) {
    for (let i = 0; i < binCount; i++) {
      const db = freq[i] ?? -100;
      spectrum[i] =
        db <= -72 ? 0 : Math.min(1, Math.pow(10, db / 20));
    }
  } else {
    spectrum.fill(0);
  }

  return { peak, peakL, peakR, rms, hasSignal, spectrum, waveform: time };
}

export function resetStudioMixerStrips(): void {
  for (const ti of [...strips.keys()]) tearDownStrip(ti);
  tearDownMasterMeterTap();
}

/** Preload meter AudioWorklet before first strip build. */
export async function preloadStudioMixerMeterWorklet(ctx: AudioContext): Promise<void> {
  try {
    await ensureStudioChannelMeterWorklet(ctx);
  } catch {
    /* analyser fallback */
  }
}

export function studioMixerMeterWorkletActive(ctx: AudioContext): boolean {
  return studioChannelMeterWorkletUsable(ctx);
}
