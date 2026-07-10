import {
  MULTIMETER_BAND_COUNT,
  NUGEN_HISTORY_LENGTH,
  idleMultiMeterSnap,
  idleNugenMeterSnap,
  type MultiMeterSnap,
  type NugenMeterSnap,
} from '@/app/lib/masteringBay/masteringBayMeterIdle';
import {
  METER_DB_CEIL,
  METER_DB_FLOOR,
  dbToVuPct,
  grToMeterPct,
  peakHoldStep,
  readChannelMeter,
  stereoMomentaryLufs,
  vuBallisticsStep,
} from '@/app/lib/masteringBay/masteringBayMeterBallistics';

const MIN_HZ = 16;
const MAX_HZ = 16000;

/** @deprecated Use dbToVuPct — kept for horizontal WaveLab strip compatibility. */
export function dbToWaveLabPct(db: number): number {
  return dbToVuPct(db);
}

export function linToDb(lin: number): number {
  if (!Number.isFinite(lin) || lin <= 1e-10) return Number.NEGATIVE_INFINITY;
  return 20 * Math.log10(lin);
}

export function dbToLin(db: number): number {
  if (!Number.isFinite(db)) return 1;
  return 10 ** (db / 20);
}

/** Map dB to 0–100% with optional custom floor (e.g. gain-reduction column). */
export function dbToMeterPct(db: number, floorDb = METER_DB_FLOOR): number {
  return dbToVuPct(db, floorDb, METER_DB_CEIL);
}

function dbToSpectrumHeight(db: number): number {
  return dbToVuPct(db, -72, -3);
}

function readSpectrumBands(
  analyser: AnalyserNode,
  freqBuf: Float32Array,
  bandHold: number[],
  dtSec: number,
  active: boolean,
): number[] {
  analyser.getFloatFrequencyData(freqBuf);
  const sampleRate = analyser.context.sampleRate;
  const binHz = sampleRate / analyser.fftSize;
  const nyquist = sampleRate * 0.5;
  const bands: number[] = [];
  const logMin = Math.log10(MIN_HZ);
  const logMax = Math.log10(Math.min(MAX_HZ, nyquist * 0.98));
  const decay = active ? Math.exp(-dtSec / 0.12) : Math.exp(-dtSec / 0.08);

  for (let i = 0; i < MULTIMETER_BAND_COUNT; i++) {
    const t0 = i / MULTIMETER_BAND_COUNT;
    const t1 = (i + 1) / MULTIMETER_BAND_COUNT;
    const hz0 = 10 ** (logMin + (logMax - logMin) * t0);
    const hz1 = 10 ** (logMin + (logMax - logMin) * t1);
    const bin0 = Math.max(0, Math.floor(hz0 / binHz));
    const bin1 = Math.min(freqBuf.length - 1, Math.max(bin0, Math.ceil(hz1 / binHz)));
    let peakDb = -120;
    for (let b = bin0; b <= bin1; b++) {
      const db = freqBuf[b] ?? -120;
      if (db > peakDb) peakDb = db;
    }
    const h = dbToSpectrumHeight(peakDb);
    const prev = bandHold[i] ?? 0;
    const next = active ? Math.max(h, prev * decay) : prev * decay;
    bandHold[i] = next;
    bands.push(next);
  }
  return bands;
}

export type MasteringBayAnalyserTaps = {
  /** Dry input (pre-rack) — INPUT column only. */
  inputL: AnalyserNode;
  inputR: AnalyserNode;
  /** Pre-peak-limiter — REDUCTION column reference (pre vs post). */
  preLimiterL: AnalyserNode;
  preLimiterR: AnalyserNode;
  /** Fully processed master (post EQ/comp/limiter) — all output meters + spectrum. */
  masterL: AnalyserNode;
  masterR: AnalyserNode;
  spectrum: AnalyserNode;
};

export type MeterHoldState = {
  lVuRmsDb: number;
  rVuRmsDb: number;
  lPeakHoldDb: number;
  rPeakHoldDb: number;
  lTpHoldDb: number;
  rTpHoldDb: number;
  inLTpHoldDb: number;
  inRTpHoldDb: number;
  /** Session-max true peak (SOURCE / TARGET TPMax). */
  sourceTpMaxDb: number;
  targetTpMaxDb: number;
  sourceSMaxDb: number;
  targetSMaxDb: number;
  lLimGrHoldDb: number;
  rLimGrHoldDb: number;
  momentLufs: number;
  integAcc: number;
  integCount: number;
  inIntegAcc: number;
  inIntegCount: number;
  bandHold: number[];
  history: number[];
  tpHistory: number[];
  historyIdx: number;
};

export function createMeterHoldState(): MeterHoldState {
  return {
    lVuRmsDb: METER_DB_FLOOR,
    rVuRmsDb: METER_DB_FLOOR,
    lPeakHoldDb: METER_DB_FLOOR,
    rPeakHoldDb: METER_DB_FLOOR,
    lTpHoldDb: METER_DB_FLOOR,
    rTpHoldDb: METER_DB_FLOOR,
    inLTpHoldDb: METER_DB_FLOOR,
    inRTpHoldDb: METER_DB_FLOOR,
    sourceTpMaxDb: Number.NEGATIVE_INFINITY,
    targetTpMaxDb: Number.NEGATIVE_INFINITY,
    sourceSMaxDb: Number.NEGATIVE_INFINITY,
    targetSMaxDb: Number.NEGATIVE_INFINITY,
    lLimGrHoldDb: 0,
    rLimGrHoldDb: 0,
    momentLufs: Number.NEGATIVE_INFINITY,
    integAcc: 0,
    integCount: 0,
    inIntegAcc: 0,
    inIntegCount: 0,
    bandHold: Array(MULTIMETER_BAND_COUNT).fill(0),
    history: Array(NUGEN_HISTORY_LENGTH).fill(0),
    tpHistory: Array(NUGEN_HISTORY_LENGTH).fill(0),
    historyIdx: 0,
  };
}

function stereoBalanceDb(lRmsLin: number, rRmsLin: number): number {
  if (lRmsLin <= 1e-10 && rRmsLin <= 1e-10) return 0;
  if (lRmsLin <= 1e-10) return 6;
  if (rRmsLin <= 1e-10) return -6;
  const db = linToDb(rRmsLin) - linToDb(lRmsLin);
  return Math.max(-6, Math.min(6, db));
}

function stereoCorrelation(lBuf: Float32Array, rBuf: Float32Array, n: number): number {
  if (n < 8) return 0;
  let sumLR = 0;
  let sumL2 = 0;
  let sumR2 = 0;
  for (let i = 0; i < n; i++) {
    const l = lBuf[i] ?? 0;
    const r = rBuf[i] ?? 0;
    sumLR += l * r;
    sumL2 += l * l;
    sumR2 += r * r;
  }
  const denom = Math.sqrt(sumL2 * sumR2);
  if (denom < 1e-12) return 0;
  return Math.max(-1, Math.min(1, sumLR / denom));
}

export type MeterAnalysisBuffers = {
  inL: Float32Array;
  inR: Float32Array;
  preL: Float32Array;
  preR: Float32Array;
  masterL: Float32Array;
  masterR: Float32Array;
  freq: Float32Array;
};

export function createMeterAnalysisBuffers(fftSize: number, freqBins: number): MeterAnalysisBuffers {
  return {
    inL: new Float32Array(fftSize),
    inR: new Float32Array(fftSize),
    preL: new Float32Array(fftSize),
    preR: new Float32Array(fftSize),
    masterL: new Float32Array(fftSize),
    masterR: new Float32Array(fftSize),
    freq: new Float32Array(freqBins),
  };
}

export type LimiterReductionReadout = {
  /** Live DynamicsCompressorNode.reduction (negative dB while limiting). */
  limiterReductionDb: number;
  compressorReductionDb: number;
};

export function analyseMasteringBayMeters(
  taps: MasteringBayAnalyserTaps,
  hold: MeterHoldState,
  bufs: MeterAnalysisBuffers,
  dtMs: number,
  playing: boolean,
  reduction?: LimiterReductionReadout,
): { multi: MultiMeterSnap; nugen: NugenMeterSnap } {
  const dtSec = Math.max(0.001, Math.min(0.05, dtMs / 1000));
  const multi = idleMultiMeterSnap();
  const nugen = idleNugenMeterSnap();

  const inL = readChannelMeter(taps.inputL, bufs.inL);
  const inR = readChannelMeter(taps.inputR, bufs.inR);
  const preL = readChannelMeter(taps.preLimiterL, bufs.preL);
  const preR = readChannelMeter(taps.preLimiterR, bufs.preR);
  const masterL = readChannelMeter(taps.masterL, bufs.masterL);
  const masterR = readChannelMeter(taps.masterR, bufs.masterR);

  const signalActive =
    playing ||
    masterL.peakLin > 1e-8 ||
    masterR.peakLin > 1e-8 ||
    inL.peakLin > 1e-8 ||
    inR.peakLin > 1e-8;

  hold.lVuRmsDb = vuBallisticsStep(hold.lVuRmsDb, masterL.rmsDb, dtSec);
  hold.rVuRmsDb = vuBallisticsStep(hold.rVuRmsDb, masterR.rmsDb, dtSec);
  hold.lPeakHoldDb = peakHoldStep(hold.lPeakHoldDb, masterL.peakDb, dtSec);
  hold.rPeakHoldDb = peakHoldStep(hold.rPeakHoldDb, masterR.peakDb, dtSec);
  hold.lTpHoldDb = peakHoldStep(hold.lTpHoldDb, masterL.truePeakDb, dtSec);
  hold.rTpHoldDb = peakHoldStep(hold.rTpHoldDb, masterR.truePeakDb, dtSec);
  hold.inLTpHoldDb = peakHoldStep(hold.inLTpHoldDb, inL.truePeakDb, dtSec);
  hold.inRTpHoldDb = peakHoldStep(hold.inRTpHoldDb, inR.truePeakDb, dtSec);

  const lVuDb = hold.lVuRmsDb;
  const rVuDb = hold.rVuRmsDb;
  const lPeakDb = masterL.peakDb;
  const rPeakDb = masterR.peakDb;
  const lPeakHoldDb = hold.lPeakHoldDb;
  const rPeakHoldDb = hold.rPeakHoldDb;
  const lTpDb = masterL.truePeakDb;
  const rTpDb = masterR.truePeakDb;

  const inLPeakDb = inL.peakDb;
  const inRPeakDb = inR.peakDb;
  const inLRmsDb = inL.rmsDb;
  const inRRmsDb = inR.rmsDb;
  const inLTpDb = inL.truePeakDb;
  const inRTpDb = inR.truePeakDb;

  multi.bands = readSpectrumBands(taps.spectrum, bufs.freq, hold.bandHold, dtSec, signalActive);
  multi.lPeak = lPeakDb;
  multi.rPeak = rPeakDb;
  multi.lRms = lVuDb;
  multi.rRms = rVuDb;
  multi.lPeakHold = lPeakHoldDb;
  multi.rPeakHold = rPeakHoldDb;
  multi.lLevel = dbToVuPct(lVuDb);
  multi.rLevel = dbToVuPct(rVuDb);
  multi.lRmsLevel = dbToVuPct(lVuDb);
  multi.rRmsLevel = dbToVuPct(rVuDb);

  const outMoment = stereoMomentaryLufs(masterL.rmsLin, masterR.rmsLin);
  const inMoment = stereoMomentaryLufs(inL.rmsLin, inR.rmsLin);
  hold.momentLufs = vuBallisticsStep(
    Number.isFinite(hold.momentLufs) ? hold.momentLufs : METER_DB_FLOOR,
    Number.isFinite(outMoment) ? outMoment : METER_DB_FLOOR,
    dtSec,
  );
  if (signalActive && Number.isFinite(outMoment)) {
    hold.integAcc += outMoment;
    hold.integCount += 1;
  }
  const integLufs =
    hold.integCount > 0 ? hold.integAcc / hold.integCount : Number.NEGATIVE_INFINITY;

  multi.luS = hold.momentLufs;
  multi.luI = integLufs;
  multi.balanceDb = stereoBalanceDb(masterL.rmsLin, masterR.rmsLin);
  multi.correlation = stereoCorrelation(bufs.masterL, bufs.masterR, taps.masterL.fftSize);

  // Limiter GR: prefer live DynamicsCompressorNode.reduction (authoritative),
  // fall back to pre/post true-peak difference when the node is bypassed.
  const liveLimGr = reduction ? Math.max(0, -reduction.limiterReductionDb) : 0;
  const liveCompGr = reduction ? Math.max(0, -reduction.compressorReductionDb) : 0;
  const prePostGrL =
    Number.isFinite(preL.truePeakDb) && Number.isFinite(lTpDb)
      ? Math.max(0, preL.truePeakDb - lTpDb)
      : 0;
  const prePostGrR =
    Number.isFinite(preR.truePeakDb) && Number.isFinite(rTpDb)
      ? Math.max(0, preR.truePeakDb - rTpDb)
      : 0;
  const grDbL = Math.max(liveLimGr, liveCompGr * 0.35, prePostGrL);
  const grDbR = Math.max(liveLimGr, liveCompGr * 0.35, prePostGrR);

  hold.lLimGrHoldDb = vuBallisticsStep(hold.lLimGrHoldDb, grDbL, dtSec);
  hold.rLimGrHoldDb = vuBallisticsStep(hold.rLimGrHoldDb, grDbR, dtSec);
  const grDisplayL = Math.max(0, hold.lLimGrHoldDb);
  const grDisplayR = Math.max(0, hold.rLimGrHoldDb);

  // INPUT / OUTPUT bars: RMS level + true-peak hold markers (dBTP).
  nugen.l.input = dbToVuPct(inLRmsDb);
  nugen.l.inputPeak = dbToVuPct(hold.inLTpHoldDb);
  nugen.l.output = dbToVuPct(lVuDb);
  nugen.l.outputPeak = dbToVuPct(hold.lTpHoldDb);
  nugen.l.reduction = grToMeterPct(grDisplayL);
  nugen.r.input = dbToVuPct(inRRmsDb);
  nugen.r.inputPeak = dbToVuPct(hold.inRTpHoldDb);
  nugen.r.output = dbToVuPct(rVuDb);
  nugen.r.outputPeak = dbToVuPct(hold.rTpHoldDb);
  nugen.r.reduction = grToMeterPct(grDisplayR);

  // SOURCE = dry input; TARGET = post-limiter master (session max for TPMax / SMax).
  const inTpNow = Math.max(
    Number.isFinite(inLTpDb) ? inLTpDb : METER_DB_FLOOR,
    Number.isFinite(inRTpDb) ? inRTpDb : METER_DB_FLOOR,
  );
  const outTpNow = Math.max(
    Number.isFinite(lTpDb) ? lTpDb : METER_DB_FLOOR,
    Number.isFinite(rTpDb) ? rTpDb : METER_DB_FLOOR,
  );
  if (signalActive) {
    if (Number.isFinite(inTpNow) && inTpNow > hold.sourceTpMaxDb) hold.sourceTpMaxDb = inTpNow;
    if (Number.isFinite(outTpNow) && outTpNow > hold.targetTpMaxDb) hold.targetTpMaxDb = outTpNow;
    if (Number.isFinite(inMoment) && inMoment > hold.sourceSMaxDb) hold.sourceSMaxDb = inMoment;
    if (Number.isFinite(hold.momentLufs) && hold.momentLufs > hold.targetSMaxDb) {
      hold.targetSMaxDb = hold.momentLufs;
    }
    if (Number.isFinite(inMoment)) {
      hold.inIntegAcc += inMoment;
      hold.inIntegCount += 1;
    }
  }
  const inIntegLufs =
    hold.inIntegCount > 0 ? hold.inIntegAcc / hold.inIntegCount : Number.NEGATIVE_INFINITY;

  nugen.source.tpMax = hold.sourceTpMaxDb;
  nugen.source.integrated = inIntegLufs;
  nugen.source.sMax = hold.sourceSMaxDb;
  nugen.target.tpMax = hold.targetTpMaxDb;
  nugen.target.integrated = integLufs;
  nugen.target.sMax = hold.targetSMaxDb;

  const histVal = dbToVuPct(
    Number.isFinite(hold.momentLufs) ? hold.momentLufs : METER_DB_FLOOR,
    -36,
    0,
  );
  const tpHistVal = dbToVuPct(
    Number.isFinite(outTpNow) ? outTpNow : METER_DB_FLOOR,
    METER_DB_FLOOR,
    METER_DB_CEIL,
  );
  if (signalActive) {
    const idx = hold.historyIdx % NUGEN_HISTORY_LENGTH;
    hold.history[idx] = histVal;
    hold.tpHistory[idx] = tpHistVal;
    hold.historyIdx += 1;
  }
  nugen.history = [...hold.history];
  nugen.tpHistory = [...hold.tpHistory];
  // 0–100% band heights (same scale as the analyzer bars).
  nugen.histogram = multi.bands.slice(0, 12);

  if (!signalActive) {
    hold.lLimGrHoldDb = vuBallisticsStep(hold.lLimGrHoldDb, 0, dtSec);
    hold.rLimGrHoldDb = vuBallisticsStep(hold.rLimGrHoldDb, 0, dtSec);
    nugen.l.reduction = grToMeterPct(Math.max(0, hold.lLimGrHoldDb));
    nugen.r.reduction = grToMeterPct(Math.max(0, hold.rLimGrHoldDb));
  }

  return { multi, nugen };
}
