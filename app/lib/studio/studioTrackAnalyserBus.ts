/**
 * Per-lane analyser tap for Pitch Tune scope + FX Suite meters (real signal only).
 */
import {
  isStudioMixerStripGraphPlaybackLocked,
  readStudioMixerStripAnalyserSnapshot,
} from '@/app/lib/studio/studioMixerStripBus';

export type StudioTrackAnalyserConsumer = 'pitch' | 'fxSuite' | 'mixer';

export type StudioTrackMeterSnapshot = {
  peak: number;
  peakL: number;
  peakR: number;
  rms: number;
  hasSignal: boolean;
  /** Normalized 0–1 per frequency bin (length = analyser.frequencyBinCount). */
  spectrum: Float32Array;
  /** Time-domain samples −1…1 (length = analyser fftSize). Present when tap supports waveform read. */
  waveform?: Float32Array;
};

const analysers = new Map<number, AnalyserNode>();
const analyserTapSources = new Map<number, AudioNode>();
/** Vocoder scope — post–Pitch Tune node that feeds the vocoder envelope. */
const vocoderAnalysers = new Map<number, AnalyserNode>();
const vocoderAnalyserTapSources = new Map<number, AudioNode>();
const consumers = new Map<number, Set<StudioTrackAnalyserConsumer>>();

/** Peak / RMS below this = silence (no UI motion). */
export const STUDIO_TRACK_METER_SIGNAL_PEAK = 0.008;
export const STUDIO_TRACK_METER_SIGNAL_RMS = 0.004;
/** UI snap floor — meter bars hit zero at/below this. */
export const STUDIO_METER_DISPLAY_FLOOR = 0.012;
export const STUDIO_METER_ATTACK = 0.62;
/** Per-frame release at ~60 fps — near-zero in ~4 frames (~65 ms). */
export const STUDIO_METER_RELEASE = 0.14;
/** dB floor for FFT display — bins at/below this read as silence. */
export const STUDIO_ANALYSER_SPECTRUM_FLOOR_DB = -72;
export const STUDIO_ANALYSER_FFT_SIZE = 2048;
/** Lower = analyzer follows EQ/FX moves faster (honest post-FX readout). */
export const STUDIO_ANALYSER_SMOOTHING = 0.04;
/**
 * FX Suite Spectrum Forge-style dB window on the insert tap.
 * Wider top (−6) so program material reaches visible bar height; floor stays deep for air/lows.
 */
const FX_SUITE_ANALYSER_MIN_DB = -96;
const FX_SUITE_ANALYSER_MAX_DB = -6;
const FX_SUITE_ANALYSER_SMOOTHING = 0.32;

function configureFxSuiteAnalyser(analyser: AnalyserNode): void {
  analyser.minDecibels = FX_SUITE_ANALYSER_MIN_DB;
  analyser.maxDecibels = FX_SUITE_ANALYSER_MAX_DB;
  analyser.smoothingTimeConstant = FX_SUITE_ANALYSER_SMOOTHING;
}

/** Display silence gate — below this, bars stay dark (analyser floor is deeper for FFT headroom). */
const FX_SUITE_DISPLAY_FLOOR_DB = -78;

/**
 * Map analyser dB into 0–1 inside the FX Suite window (SPAN-style), not absolute amplitude.
 * Absolute 10^(dB/20) left typical program levels (~−40 dB) nearly invisible — especially purple lows.
 */
export function studioFxSuiteDbToDisplay(db: number): number {
  if (!Number.isFinite(db) || db <= FX_SUITE_DISPLAY_FLOOR_DB) return 0;
  const span = FX_SUITE_ANALYSER_MAX_DB - FX_SUITE_DISPLAY_FLOOR_DB;
  const t = Math.min(1, Math.max(0, (db - FX_SUITE_DISPLAY_FLOOR_DB) / span));
  /* Closer to linear — readable motion without pegging purple/yellow/green. */
  return Math.min(1, Math.pow(t, 0.85));
}

const floatSpectrumScratch = new Map<number, Float32Array>();
/** Lanes whose pitch scope reads the Pitch Tune engine analyser (not a duplicate tap). */
const pitchMonitorEngineBound = new Set<number>();

type PitchMonitorRouteListener = (trackIndex: number | null) => void;
let pitchMonitorRouteListener: PitchMonitorRouteListener | null = null;
let pitchMonitorResync: ((trackIndex: number) => void) | null = null;
let fxSuiteAnalyserResync: ((trackIndex: number) => void) | null = null;

export function registerStudioPitchMonitorResync(fn: ((trackIndex: number) => void) | null): void {
  pitchMonitorResync = fn;
}

export function registerStudioFxSuiteAnalyserResync(fn: ((trackIndex: number) => void) | null): void {
  fxSuiteAnalyserResync = fn;
}

export function studioTrackAnalyserHasConsumer(
  trackIndex: number,
  consumer: StudioTrackAnalyserConsumer,
): boolean {
  return consumers.get(trackIndex)?.has(consumer) ?? false;
}

export function studioPitchMonitorUsesEngineTap(trackIndex: number): boolean {
  return pitchMonitorEngineBound.has(trackIndex);
}

export function setStudioPitchMonitorRouteListener(fn: PitchMonitorRouteListener | null): void {
  pitchMonitorRouteListener = fn;
}

/** Log-spaced display band → FFT bin index (matches FX Suite analyzer layout). */
export function studioAnalyserLogBandIndex(
  bandIndex: number,
  bandCount: number,
  spectrumLength: number,
): number {
  const t = bandIndex / Math.max(1, bandCount - 1);
  return Math.min(spectrumLength - 1, Math.floor(t * t * spectrumLength));
}

/**
 * Peak across the log-spaced FFT bin range for one display bar.
 * Single-bin sampling often misses low-end energy (purple meters looked dead).
 */
export function studioAnalyserLogBandPeak(
  bandIndex: number,
  bandCount: number,
  spectrum: Float32Array,
): number {
  const n = spectrum.length;
  if (n < 1 || bandCount < 1) return 0;
  const t0 = bandIndex / bandCount;
  const t1 = (bandIndex + 1) / bandCount;
  const i0 = Math.min(n - 1, Math.floor(t0 * t0 * n));
  const i1 = Math.min(n, Math.max(i0 + 1, Math.ceil(t1 * t1 * n)));
  let peak = 0;
  for (let i = i0; i < i1; i++) {
    const v = spectrum[i] ?? 0;
    if (v > peak) peak = v;
  }
  return peak;
}

export function studioAnalyserDbToLinear(db: number, floorDb = STUDIO_ANALYSER_SPECTRUM_FLOOR_DB): number {
  if (!Number.isFinite(db) || db <= floorDb) return 0;
  return Math.min(1, Math.pow(10, db / 20));
}

/** FX Suite bar chart only — expands subtle bus/FX peaks for visible motion (audio tap unchanged). */
export const STUDIO_ANALYSER_DISPLAY_GAIN = 2.6;

export function studioAnalyserSpectrumDisplayLinear(linear: number): number {
  if (linear <= 0) return 0;
  return Math.min(1, linear * STUDIO_ANALYSER_DISPLAY_GAIN);
}

/** Fast attack, fast release — no long sticky tail after signal stops. */
export function studioMeterBallistics(current: number, target: number, hasSignal: boolean): number {
  if (!hasSignal || target < STUDIO_METER_DISPLAY_FLOOR) {
    const released = current * STUDIO_METER_RELEASE;
    return released < STUDIO_METER_DISPLAY_FLOOR ? 0 : released;
  }
  const next = current + (target - current) * STUDIO_METER_ATTACK;
  return next < STUDIO_METER_DISPLAY_FLOOR ? 0 : next;
}

export function setStudioTrackAnalyserConsumer(
  trackIndex: number,
  consumer: StudioTrackAnalyserConsumer,
  on: boolean,
): void {
  const set = consumers.get(trackIndex) ?? new Set<StudioTrackAnalyserConsumer>();
  if (on) set.add(consumer);
  else set.delete(consumer);
  if (set.size === 0) consumers.delete(trackIndex);
  else consumers.set(trackIndex, set);
  if (consumer === 'fxSuite' && trackIndex >= 0) {
    const analyser = analysers.get(trackIndex);
    if (analyser) configureFxSuiteAnalyser(analyser);
    queueMicrotask(() => fxSuiteAnalyserResync?.(trackIndex));
  }
  // Pitch scope analyser is wired from the vocal modulator in studioLiveVocalFxChain only.
  // Do not parallel-tap raw mic fanout here — that bypasses mute and causes ghost scope motion.
}

export function studioTrackAnalyserActive(trackIndex: number): boolean {
  return (consumers.get(trackIndex)?.size ?? 0) > 0;
}

/** @deprecated use setStudioTrackAnalyserConsumer(trackIndex, 'pitch', on) */
export function setStudioPitchMonitorActiveTrack(trackIndex: number | null): void {
  for (const [ti] of consumers) {
    if (ti !== trackIndex) setStudioTrackAnalyserConsumer(ti, 'pitch', false);
  }
  if (trackIndex != null) setStudioTrackAnalyserConsumer(trackIndex, 'pitch', true);
  pitchMonitorRouteListener?.(trackIndex);
  if (trackIndex != null) {
    queueMicrotask(() => pitchMonitorResync?.(trackIndex));
  }
}

export function getStudioPitchMonitorActiveTrack(): number | null {
  for (const [ti, set] of consumers) {
    if (set.has('pitch')) return ti;
  }
  return null;
}

/** Retap mic/fanout into every lane with an open pitch-scope consumer. */
export function retapAllStudioPitchMonitorSources(ctx: AudioContext, source: AudioNode): void {
  for (const [ti, set] of consumers) {
    if (set.has('pitch')) retapStudioPitchMonitorSource(ctx, source, ti);
  }
}

export function registerStudioPitchMonitorAnalyser(
  trackIndex: number,
  analyser: AnalyserNode | null,
): void {
  if (analyser) analysers.set(trackIndex, analyser);
  else {
    const prev = analysers.get(trackIndex);
    if (prev) disconnectAnalyserTap(trackIndex, prev);
    analysers.delete(trackIndex);
  }
}

export function getStudioPitchMonitorAnalyser(trackIndex: number): AnalyserNode | null {
  return analysers.get(trackIndex) ?? null;
}

export function getStudioTrackAnalyser(trackIndex: number): AnalyserNode | null {
  return analysers.get(trackIndex) ?? null;
}

function readAnalyserMeterSnapshot(
  trackIndex: number,
  analyser: AnalyserNode,
  reuseSpectrum?: Float32Array,
): StudioTrackMeterSnapshot {
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
  const hasSignal = peak >= STUDIO_TRACK_METER_SIGNAL_PEAK || rms >= STUDIO_TRACK_METER_SIGNAL_RMS;

  const binCount = analyser.frequencyBinCount;
  const spectrum =
    reuseSpectrum && reuseSpectrum.length === binCount
      ? reuseSpectrum
      : new Float32Array(binCount);
  let floatBuf = floatSpectrumScratch.get(trackIndex);
  if (!floatBuf || floatBuf.length !== binCount) {
    floatBuf = new Float32Array(binCount);
    floatSpectrumScratch.set(trackIndex, floatBuf);
  }
  analyser.getFloatFrequencyData(floatBuf);
  const fxSuite = consumers.get(trackIndex)?.has('fxSuite') ?? false;
  if (fxSuite) {
    let spectrumEnergy = 0;
    for (let i = 0; i < binCount; i++) {
      const t = i / Math.max(1, binCount - 1);
      /*
       * Mild display-only tilt — keep highs from dominating purple after band gains.
       * Does not change the audio tap.
       */
      const tilt = 0.78 + t * 0.35;
      const v = Math.min(1, studioFxSuiteDbToDisplay(floatBuf[i] ?? FX_SUITE_ANALYSER_MIN_DB) * tilt);
      spectrum[i] = v;
      if (v > spectrumEnergy) spectrumEnergy = v;
    }
    /* Time-domain peak can sit under the gate on quiet lows — still light the analyzer. */
    const hasSpectrum = spectrumEnergy >= 0.055;
    return {
      peak,
      peakL: peak,
      peakR: peak,
      rms,
      hasSignal: hasSignal || hasSpectrum,
      spectrum,
      waveform: time,
    };
  }

  const floorDb = STUDIO_ANALYSER_SPECTRUM_FLOOR_DB;
  for (let i = 0; i < binCount; i++) {
    spectrum[i] = studioAnalyserDbToLinear(floatBuf[i] ?? floorDb, floorDb);
  }

  return {
    peak,
    peakL: peak,
    peakR: peak,
    rms,
    hasSignal,
    spectrum,
    waveform: time,
  };
}

export function readStudioTrackMeterSnapshot(
  trackIndex: number,
  reuseSpectrum?: Float32Array,
): StudioTrackMeterSnapshot | null {
  const fxSuiteOpen = consumers.get(trackIndex)?.has('fxSuite') ?? false;
  const insertAnalyser = analysers.get(trackIndex);

  /*
   * FX Suite / Pitch insert tap is a parallel AnalyserNode — safe to poll during transport.
   * Mixer-strip analyser pulls during lock still cause audible dropouts on WAV/MIDI lanes.
   */
  if (fxSuiteOpen && insertAnalyser) {
    return readAnalyserMeterSnapshot(trackIndex, insertAnalyser, reuseSpectrum);
  }

  if (isStudioMixerStripGraphPlaybackLocked()) return null;

  const mixerSnap = readStudioMixerStripAnalyserSnapshot(trackIndex, reuseSpectrum);
  if (mixerSnap) return mixerSnap;

  if (!insertAnalyser) return null;
  return readAnalyserMeterSnapshot(trackIndex, insertAnalyser, reuseSpectrum);
}

function disconnectAnalyserTap(trackIndex: number, analyser: AnalyserNode): void {
  const prev = analyserTapSources.get(trackIndex);
  if (!prev) return;
  try {
    prev.disconnect(analyser);
  } catch {
    /* */
  }
  analyserTapSources.delete(trackIndex);
}

function disconnectVocoderAnalyserTap(trackIndex: number, analyser: AnalyserNode): void {
  const prev = vocoderAnalyserTapSources.get(trackIndex);
  if (!prev) return;
  try {
    prev.disconnect(analyser);
  } catch {
    /* */
  }
  vocoderAnalyserTapSources.delete(trackIndex);
}

/**
 * Pitch scope reads the Pitch Tune engine analyser (already fed from the vocal entry).
 * Avoids a duplicate tap that can miss signal when the live FX chain is active.
 */
export function bindStudioPitchMonitorEngineAnalyser(
  trackIndex: number,
  source: AudioNode,
  analyser: AnalyserNode,
): void {
  if (trackIndex < 0) return;
  const prev = analysers.get(trackIndex);
  if (prev && prev !== analyser) disconnectAnalyserTap(trackIndex, prev);
  analyser.fftSize = STUDIO_ANALYSER_FFT_SIZE;
  if (consumers.get(trackIndex)?.has('fxSuite')) configureFxSuiteAnalyser(analyser);
  else analyser.smoothingTimeConstant = STUDIO_ANALYSER_SMOOTHING;
  registerStudioPitchMonitorAnalyser(trackIndex, analyser);
  analyserTapSources.set(trackIndex, source);
  pitchMonitorEngineBound.add(trackIndex);
}

/** Parallel analyser tap — single source per lane; never stacks duplicate fan-out connections. */
export function retapStudioPitchMonitorSource(
  ctx: AudioContext,
  source: AudioNode,
  trackIndex: number,
): void {
  if (trackIndex < 0) return;
  pitchMonitorEngineBound.delete(trackIndex);
  let analyser = analysers.get(trackIndex);
  if (!analyser || analyser.context !== ctx) {
    if (analyser) disconnectAnalyserTap(trackIndex, analyser);
    analyser = ctx.createAnalyser();
    analyser.fftSize = STUDIO_ANALYSER_FFT_SIZE;
    if (consumers.get(trackIndex)?.has('fxSuite')) configureFxSuiteAnalyser(analyser);
    else analyser.smoothingTimeConstant = STUDIO_ANALYSER_SMOOTHING;
    registerStudioPitchMonitorAnalyser(trackIndex, analyser);
  } else {
    analyser.fftSize = STUDIO_ANALYSER_FFT_SIZE;
    if (consumers.get(trackIndex)?.has('fxSuite')) configureFxSuiteAnalyser(analyser);
    else analyser.smoothingTimeConstant = STUDIO_ANALYSER_SMOOTHING;
  }

  const prev = analyserTapSources.get(trackIndex);
  if (prev === source) return;
  if (prev) {
    try {
      prev.disconnect(analyser);
    } catch {
      /* */
    }
  }
  source.connect(analyser);
  analyserTapSources.set(trackIndex, source);
}

/** Tap vocal source for pitch scope (parallel — caller keeps source→destination routing). */
export function connectStudioPitchMonitorTap(
  ctx: AudioContext,
  source: AudioNode,
  _destination: AudioNode,
  trackIndex: number,
): void {
  if (trackIndex < 0) return;
  retapStudioPitchMonitorSource(ctx, source, trackIndex);
}

export function getStudioVocoderMonitorAnalyser(trackIndex: number): AnalyserNode | null {
  return vocoderAnalysers.get(trackIndex) ?? null;
}

export function disconnectStudioVocoderMonitorTap(trackIndex: number): void {
  const analyser = vocoderAnalysers.get(trackIndex);
  if (analyser) disconnectVocoderAnalyserTap(trackIndex, analyser);
  vocoderAnalysers.delete(trackIndex);
}

/** Tap the node that feeds the vocoder modulator (post Pitch Tune when chained). */
export function connectStudioVocoderMonitorTap(
  ctx: AudioContext,
  source: AudioNode,
  trackIndex: number,
): void {
  if (trackIndex < 0) return;
  let analyser = vocoderAnalysers.get(trackIndex);
  if (!analyser || analyser.context !== ctx) {
    if (analyser) disconnectVocoderAnalyserTap(trackIndex, analyser);
    analyser = ctx.createAnalyser();
    analyser.fftSize = STUDIO_ANALYSER_FFT_SIZE;
    analyser.smoothingTimeConstant = STUDIO_ANALYSER_SMOOTHING;
    vocoderAnalysers.set(trackIndex, analyser);
  } else {
    analyser.fftSize = STUDIO_ANALYSER_FFT_SIZE;
    analyser.smoothingTimeConstant = STUDIO_ANALYSER_SMOOTHING;
  }

  const prev = vocoderAnalyserTapSources.get(trackIndex);
  if (prev === source) return;
  if (prev) {
    try {
      prev.disconnect(analyser);
    } catch {
      /* */
    }
  }
  source.connect(analyser);
  vocoderAnalyserTapSources.set(trackIndex, source);
}
