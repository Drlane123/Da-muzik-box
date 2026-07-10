/**
 * Per-pad insert FX rack for Beat Lab sampler (EQ · compressor · drive · delay · reverb).
 * Persisted on `StoredPadSample`; applied in `playPadSampleBuffer`.
 */

import type { StoredPadSample } from '@/app/lib/padSampleStorage';

export type PadSamplerDelayNote =
  | '1/32'
  | '1/16'
  | '1/8'
  | '1/8t'
  | '1/4'
  | '1/4d'
  | '1/2'
  | '1/2d'
  | '1bar';

export const PAD_SAMPLER_DELAY_NOTE_OPTIONS: { id: PadSamplerDelayNote; label: string }[] = [
  { id: '1/32', label: '1/32' },
  { id: '1/16', label: '1/16' },
  { id: '1/8', label: '1/8' },
  { id: '1/8t', label: '1/8T' },
  { id: '1/4', label: '1/4' },
  { id: '1/4d', label: '1/4.' },
  { id: '1/2', label: '1/2' },
  { id: '1/2d', label: '1/2.' },
  { id: '1bar', label: '1 bar' },
];

/** Beat Pads delay tab — primary tempo-sync divisions. */
export const BEAT_PADS_DELAY_TEMPO_NOTE_OPTIONS: { id: PadSamplerDelayNote; label: string }[] = [
  { id: '1/4', label: '1/4' },
  { id: '1/8', label: '1/8' },
  { id: '1/16', label: '1/16' },
  { id: '1/32', label: '1/32' },
];

/** Length as fraction of a quarter note at project BPM. */
const DELAY_NOTE_QUARTER_MUL: Record<PadSamplerDelayNote, number> = {
  '1/32': 0.125,
  '1/16': 0.25,
  '1/8': 0.5,
  '1/8t': 1 / 3,
  '1/4': 1,
  '1/4d': 1.5,
  '1/2': 2,
  '1/2d': 3,
  '1bar': 4,
};

export type PadSamplerDelayFx = {
  enabled: boolean;
  /** When true, `note` sets delay from session BPM; otherwise `timeMs`. */
  syncToBpm: boolean;
  note: PadSamplerDelayNote;
  /** Free-run delay (ms) when `syncToBpm` is false. */
  timeMs: number;
  feedback: number;
  mix: number;
};

export type PadSamplerReverbFx = {
  enabled: boolean;
  mix: number;
  /** Impulse length / tail (seconds). */
  decaySec: number;
};

/** 3-band EQ (low shelf, peaking, high shelf) — inserts before compressor. */
export type PadSamplerEqFx = {
  enabled: boolean;
  /** −12 … +12 dB */
  lowGainDb: number;
  midGainDb: number;
  highGainDb: number;
  /** Shelf / band center (Hz). */
  lowFreqHz: number;
  midFreqHz: number;
  highFreqHz: number;
  /** Peaking bandwidth (higher = narrower). */
  midQ: number;
};

/** Output limiter + soft clip — Cubase Pad FX right column (always available). */
export type PadSamplerLimiterFx = {
  enabled: boolean;
  /** Ceiling / threshold dB −24 … 0. */
  ceilingDb: number;
  /** 0 = hard brick, 100 = soft clip (waveshaper + knee). */
  softClip: number;
};

export type PadSamplerCompressorFx = {
  enabled: boolean;
  /** Threshold dB −48 … 0 (`DynamicsCompressorNode.threshold`). */
  thresholdDb: number;
  /** Ratio 1 … 20 (`ratio`). */
  ratio: number;
  /** Seconds — clamped for Web Audio. */
  attackSec: number;
  releaseSec: number;
  kneeDb: number;
  /** Makeup gain after compression, dB 0 … 18. */
  makeupDb: number;
  /** De-esser before compressor — tames sibilance / hiss. */
  deEsserEnabled: boolean;
  /** Sibilance focus ~4k–10k Hz. */
  deEsserFreqHz: number;
  /** Reduction strength 0…1. */
  deEsserAmount: number;
};

export type PadSamplerFxRack = {
  eq: PadSamplerEqFx;
  compressor: PadSamplerCompressorFx;
  /** 0…1 soft-clip drive. */
  drive: number;
  limiter: PadSamplerLimiterFx;
  delay: PadSamplerDelayFx;
  reverb: PadSamplerReverbFx;
};

export function defaultPadSamplerFxRack(): PadSamplerFxRack {
  return {
    eq: {
      enabled: false,
      lowGainDb: 0,
      midGainDb: 0,
      highGainDb: 0,
      lowFreqHz: 120,
      midFreqHz: 1000,
      highFreqHz: 8000,
      midQ: 1,
    },
    compressor: {
      enabled: false,
      thresholdDb: -22,
      ratio: 4,
      attackSec: 0.003,
      releaseSec: 0.22,
      kneeDb: 8,
      makeupDb: 0,
      deEsserEnabled: false,
      deEsserFreqHz: 6500,
      deEsserAmount: 0.55,
    },
    drive: 0,
    limiter: { enabled: false, ceilingDb: -3, softClip: 55 },
    delay: {
      enabled: false,
      syncToBpm: true,
      note: '1/4',
      timeMs: 400,
      feedback: 0.45,
      mix: 0.42,
    },
    reverb: { enabled: false, mix: 0.22, decaySec: 1.2 },
  };
}

export function padSamplerDelayTimeMs(bpm: number, delay: PadSamplerDelayFx): number {
  if (!delay.syncToBpm) {
    return Math.max(20, Math.min(4000, Math.round(delay.timeMs)));
  }
  const safeBpm = Math.max(40, Math.min(280, bpm));
  const quarterMs = 60000 / safeBpm;
  const mul = DELAY_NOTE_QUARTER_MUL[delay.note] ?? 1;
  return Math.round(quarterMs * mul);
}

export function padSamplerDelayTimeLabel(bpm: number, delay: PadSamplerDelayFx): string {
  const ms = padSamplerDelayTimeMs(bpm, delay);
  if (delay.syncToBpm) {
    return `${delay.note} @ ${Math.round(bpm)} BPM = ${ms} ms`;
  }
  return `${ms} ms (free)`;
}

function parseDelayNote(raw: unknown): PadSamplerDelayNote {
  const id = String(raw ?? '1/4');
  return PAD_SAMPLER_DELAY_NOTE_OPTIONS.some((o) => o.id === id) ? (id as PadSamplerDelayNote) : '1/4';
}

export function fxRackFromStored(row: StoredPadSample): PadSamplerFxRack {
  const d = defaultPadSamplerFxRack();
  if (row.samplerFxEqOn) {
    d.eq.enabled = true;
    if (typeof row.samplerFxEqLowDb === 'number') {
      d.eq.lowGainDb = Math.max(-12, Math.min(12, row.samplerFxEqLowDb));
    }
    if (typeof row.samplerFxEqMidDb === 'number') {
      d.eq.midGainDb = Math.max(-12, Math.min(12, row.samplerFxEqMidDb));
    }
    if (typeof row.samplerFxEqHighDb === 'number') {
      d.eq.highGainDb = Math.max(-12, Math.min(12, row.samplerFxEqHighDb));
    }
    if (typeof row.samplerFxEqLowHz === 'number') {
      d.eq.lowFreqHz = Math.max(40, Math.min(800, row.samplerFxEqLowHz));
    }
    if (typeof row.samplerFxEqMidHz === 'number') {
      d.eq.midFreqHz = Math.max(120, Math.min(12000, row.samplerFxEqMidHz));
    }
    if (typeof row.samplerFxEqHighHz === 'number') {
      d.eq.highFreqHz = Math.max(1500, Math.min(16000, row.samplerFxEqHighHz));
    }
    if (typeof row.samplerFxEqMidQ === 'number') {
      d.eq.midQ = Math.max(0.35, Math.min(12, row.samplerFxEqMidQ));
    }
  }
  if (row.samplerFxCompOn) {
    d.compressor.enabled = true;
    if (typeof row.samplerFxCompThrDb === 'number') {
      d.compressor.thresholdDb = Math.max(-48, Math.min(0, row.samplerFxCompThrDb));
    }
    if (typeof row.samplerFxCompRatio === 'number') {
      d.compressor.ratio = Math.max(1, Math.min(20, row.samplerFxCompRatio));
    }
    if (typeof row.samplerFxCompAttack === 'number') {
      d.compressor.attackSec = Math.max(0.0005, Math.min(0.55, row.samplerFxCompAttack));
    }
    if (typeof row.samplerFxCompRelease === 'number') {
      d.compressor.releaseSec = Math.max(0.02, Math.min(1.2, row.samplerFxCompRelease));
    }
    if (typeof row.samplerFxCompKnee === 'number') {
      d.compressor.kneeDb = Math.max(0, Math.min(40, row.samplerFxCompKnee));
    }
    if (typeof row.samplerFxCompMakeupDb === 'number') {
      d.compressor.makeupDb = Math.max(0, Math.min(18, row.samplerFxCompMakeupDb));
    }
  }
  const drive =
    typeof row.samplerFxDrive === 'number' && Number.isFinite(row.samplerFxDrive)
      ? row.samplerFxDrive
      : 0;
  d.drive = Math.max(0, Math.min(1, drive));
  if (row.samplerFxLimiterOn) {
    d.limiter.enabled = true;
    if (typeof row.samplerFxLimiterCeilDb === 'number') {
      d.limiter.ceilingDb = Math.max(-24, Math.min(0, row.samplerFxLimiterCeilDb));
    }
    if (typeof row.samplerFxLimiterSoftClip === 'number') {
      d.limiter.softClip = Math.max(0, Math.min(100, row.samplerFxLimiterSoftClip));
    }
  }
  if (row.samplerFxDelayOn) {
    d.delay.enabled = true;
    d.delay.syncToBpm = row.samplerFxDelaySync !== false;
    d.delay.note = parseDelayNote(row.samplerFxDelayNote);
    if (typeof row.samplerFxDelayMs === 'number') {
      d.delay.timeMs = Math.max(20, Math.min(4000, row.samplerFxDelayMs));
    }
    if (typeof row.samplerFxDelayFb === 'number') {
      d.delay.feedback = Math.max(0, Math.min(0.92, row.samplerFxDelayFb));
    }
    if (typeof row.samplerFxDelayMix === 'number') {
      d.delay.mix = Math.max(0, Math.min(1, row.samplerFxDelayMix));
    }
  }
  if (row.samplerFxReverbOn) {
    d.reverb.enabled = true;
    if (typeof row.samplerFxReverbMix === 'number') {
      d.reverb.mix = Math.max(0, Math.min(1, row.samplerFxReverbMix));
    }
    if (typeof row.samplerFxReverbDecay === 'number') {
      d.reverb.decaySec = Math.max(0.2, Math.min(3, row.samplerFxReverbDecay));
    }
  }
  return d;
}

export function writeFxRackToStored(row: StoredPadSample, rack: PadSamplerFxRack): void {
  const eq = rack.eq;
  if (eq.enabled) {
    row.samplerFxEqOn = true;
    row.samplerFxEqLowDb = eq.lowGainDb;
    row.samplerFxEqMidDb = eq.midGainDb;
    row.samplerFxEqHighDb = eq.highGainDb;
    row.samplerFxEqLowHz = eq.lowFreqHz;
    row.samplerFxEqMidHz = eq.midFreqHz;
    row.samplerFxEqHighHz = eq.highFreqHz;
    row.samplerFxEqMidQ = eq.midQ;
  } else {
    row.samplerFxEqOn = undefined;
    row.samplerFxEqLowDb = undefined;
    row.samplerFxEqMidDb = undefined;
    row.samplerFxEqHighDb = undefined;
    row.samplerFxEqLowHz = undefined;
    row.samplerFxEqMidHz = undefined;
    row.samplerFxEqHighHz = undefined;
    row.samplerFxEqMidQ = undefined;
  }
  const comp = rack.compressor;
  if (comp.enabled) {
    row.samplerFxCompOn = true;
    row.samplerFxCompThrDb = comp.thresholdDb;
    row.samplerFxCompRatio = comp.ratio;
    row.samplerFxCompAttack = comp.attackSec;
    row.samplerFxCompRelease = comp.releaseSec;
    row.samplerFxCompKnee = comp.kneeDb;
    row.samplerFxCompMakeupDb = comp.makeupDb > 0.02 ? comp.makeupDb : undefined;
  } else {
    row.samplerFxCompOn = undefined;
    row.samplerFxCompThrDb = undefined;
    row.samplerFxCompRatio = undefined;
    row.samplerFxCompAttack = undefined;
    row.samplerFxCompRelease = undefined;
    row.samplerFxCompKnee = undefined;
    row.samplerFxCompMakeupDb = undefined;
  }
  const drive = Math.max(0, Math.min(1, rack.drive));
  row.samplerFxDrive = drive > 0.004 ? drive : undefined;
  const limiter = rack.limiter;
  if (limiter.enabled) {
    row.samplerFxLimiterOn = true;
    row.samplerFxLimiterCeilDb = Math.max(-24, Math.min(0, limiter.ceilingDb));
    row.samplerFxLimiterSoftClip = Math.max(0, Math.min(100, Math.round(limiter.softClip)));
  } else {
    row.samplerFxLimiterOn = undefined;
    row.samplerFxLimiterCeilDb = undefined;
    row.samplerFxLimiterSoftClip = undefined;
  }
  const delay = rack.delay;
  if (delay.enabled) {
    row.samplerFxDelayOn = true;
    row.samplerFxDelaySync = delay.syncToBpm;
    row.samplerFxDelayNote = delay.note;
    row.samplerFxDelayMs = Math.max(20, Math.min(4000, delay.timeMs));
    row.samplerFxDelayFb = Math.max(0, Math.min(0.92, delay.feedback));
    row.samplerFxDelayMix = Math.max(0, Math.min(1, delay.mix));
  } else {
    row.samplerFxDelayOn = undefined;
    row.samplerFxDelaySync = undefined;
    row.samplerFxDelayNote = undefined;
    row.samplerFxDelayMs = undefined;
    row.samplerFxDelayFb = undefined;
    row.samplerFxDelayMix = undefined;
  }
  const reverb = rack.reverb;
  if (reverb.enabled) {
    row.samplerFxReverbOn = true;
    row.samplerFxReverbMix = Math.max(0, Math.min(1, reverb.mix));
    row.samplerFxReverbDecay = Math.max(0.2, Math.min(3, reverb.decaySec));
  } else {
    row.samplerFxReverbOn = undefined;
    row.samplerFxReverbMix = undefined;
    row.samplerFxReverbDecay = undefined;
  }
}

function makeSoftClipCurve(amount: number): Float32Array {
  const n = 256;
  const curve = new Float32Array(n);
  const k = 2 + amount * 18;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(k * x) / Math.tanh(k);
  }
  return curve;
}

function makeReverbImpulse(ctx: BaseAudioContext, decaySec: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.max(1, Math.floor(rate * decaySec));
  const buf = ctx.createBuffer(2, len, rate);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const ch = buf.getChannelData(c);
    for (let i = 0; i < len; i++) {
      ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
    }
  }
  return buf;
}

function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

/** Split-band de-esser — high band compressed then merged (runs before compressor). */
export const DEESSER_FREQ_MIN_HZ = 2500;
export const DEESSER_FREQ_MAX_HZ = 16000;
/** UI + DSP ceiling — 150% for aggressive de-hiss / de-ess. */
export const DEESSER_AMOUNT_MAX = 1.5;

export type DeEsserParams = {
  freqHz: number;
  amount: number;
};

export function connectDeEsser(
  ctx: AudioContext,
  input: AudioNode,
  params: DeEsserParams,
): AudioNode {
  const freq = Math.max(DEESSER_FREQ_MIN_HZ, Math.min(DEESSER_FREQ_MAX_HZ, params.freqHz));
  const amount = Math.max(0, Math.min(DEESSER_AMOUNT_MAX, params.amount));
  const t = amount / DEESSER_AMOUNT_MAX;

  const lowPass = ctx.createBiquadFilter();
  lowPass.type = 'lowpass';
  lowPass.frequency.value = freq;
  lowPass.Q.value = 0.707;

  const highPass = ctx.createBiquadFilter();
  highPass.type = 'highpass';
  highPass.frequency.value = freq * 0.9;
  highPass.Q.value = 0.707;

  const ess = ctx.createDynamicsCompressor();
  ess.threshold.value = -10 - t * 38;
  ess.ratio.value = 2 + t * 18;
  ess.attack.value = 0.00012;
  ess.release.value = 0.018 + (1 - t) * 0.065;
  ess.knee.value = Math.max(0, 10 - t * 10);

  const hiTrim = ctx.createGain();
  hiTrim.gain.value = Math.max(0.08, 1 - t * 0.78);

  const merge = ctx.createGain();
  merge.gain.value = 1;

  input.connect(lowPass);
  input.connect(highPass);
  highPass.connect(ess);
  ess.connect(hiTrim);
  lowPass.connect(merge);
  hiTrim.connect(merge);

  return merge;
}

/**
 * Parallel insert FX — dry → `dryOut`, wet → `wetOut` (wet bus keeps ringing after sample ends).
 * Chain: EQ → de-esser → compressor (+ makeup) → drive → taps for delay/reverb.
 */
export function connectPadSamplerFxRack(
  ctx: AudioContext,
  input: AudioNode,
  dryOut: AudioNode,
  wetOut: AudioNode,
  rack: PadSamplerFxRack,
  bpm = 120,
): { nodes: AudioNode[]; tailSec: number } {
  const nodes: AudioNode[] = [];
  let tailSec = 0;

  let split: AudioNode = input;

  if (rack.eq.enabled) {
    const sr = ctx.sampleRate;
    const ny = sr * 0.48;
    const low = ctx.createBiquadFilter();
    low.type = 'lowshelf';
    low.frequency.value = Math.min(Math.max(40, rack.eq.lowFreqHz), ny * 0.45);
    low.gain.value = Math.max(-12, Math.min(12, rack.eq.lowGainDb));
    split.connect(low);
    const mid = ctx.createBiquadFilter();
    mid.type = 'peaking';
    mid.frequency.value = Math.min(Math.max(120, rack.eq.midFreqHz), ny * 0.45);
    mid.Q.value = Math.max(0.35, Math.min(12, rack.eq.midQ));
    mid.gain.value = Math.max(-12, Math.min(12, rack.eq.midGainDb));
    low.connect(mid);
    const high = ctx.createBiquadFilter();
    high.type = 'highshelf';
    high.frequency.value = Math.min(Math.max(1500, rack.eq.highFreqHz), ny * 0.45);
    high.gain.value = Math.max(-12, Math.min(12, rack.eq.highGainDb));
    mid.connect(high);
    split = high;
    nodes.push(low, mid, high);
  }

  if (rack.compressor.deEsserEnabled) {
    split = connectDeEsser(ctx, split, {
      freqHz: rack.compressor.deEsserFreqHz,
      amount: rack.compressor.deEsserAmount,
    });
    nodes.push(split);
  }

  if (rack.compressor.enabled) {
    const c = ctx.createDynamicsCompressor();
    c.threshold.value = Math.max(-48, Math.min(0, rack.compressor.thresholdDb));
    c.knee.value = Math.max(0, Math.min(40, rack.compressor.kneeDb));
    c.ratio.value = Math.max(1.01, Math.min(20, rack.compressor.ratio));
    c.attack.value = Math.max(1e-4, Math.min(0.95, rack.compressor.attackSec));
    c.release.value = Math.max(0.02, Math.min(1.2, rack.compressor.releaseSec));
    split.connect(c);
    const makeup = ctx.createGain();
    makeup.gain.value = Math.min(8, dbToLinear(Math.max(0, Math.min(18, rack.compressor.makeupDb))));
    c.connect(makeup);
    split = makeup;
    nodes.push(c, makeup);
  }

  if (rack.drive > 0.004) {
    const sh = ctx.createWaveShaper();
    sh.curve = makeSoftClipCurve(rack.drive);
    sh.oversample = '2x';
    split.connect(sh);
    split = sh;
    nodes.push(sh);
  }

  if (rack.limiter.enabled) {
    const lim = ctx.createDynamicsCompressor();
    const ceil = Math.max(-24, Math.min(0, rack.limiter.ceilingDb));
    const soft = Math.max(0, Math.min(100, rack.limiter.softClip));
    lim.threshold.value = ceil;
    lim.knee.value = soft * 0.38;
    lim.ratio.value = 20;
    lim.attack.value = 0.001;
    lim.release.value = 0.07 + (100 - soft) * 0.002;
    split.connect(lim);
    split = lim;
    nodes.push(lim);
    if (soft > 1.5) {
      const clip = ctx.createWaveShaper();
      clip.curve = makeSoftClipCurve(soft / 100);
      clip.oversample = '2x';
      lim.connect(clip);
      split = clip;
      nodes.push(clip);
    }
  }

  const dry = ctx.createGain();
  dry.gain.value = 1;
  split.connect(dry);
  dry.connect(dryOut);
  nodes.push(dry);

  if (rack.delay.enabled) {
    const delaySec = padSamplerDelayTimeMs(bpm, rack.delay) / 1000;
    const fb = Math.max(0, Math.min(0.92, rack.delay.feedback));
    const mix = Math.max(0, Math.min(1, rack.delay.mix));
    const maxDelaySec = Math.max(4, delaySec * 2.5);
    const delayLine = ctx.createDelay(maxDelaySec);
    delayLine.delayTime.value = delaySec;
    const feedback = ctx.createGain();
    feedback.gain.value = fb;
    const delaySend = ctx.createGain();
    delaySend.gain.value = 1;
    const delayWet = ctx.createGain();
    delayWet.gain.value = mix;
    split.connect(delaySend);
    delaySend.connect(delayLine);
    delayLine.connect(delayWet);
    delayWet.connect(wetOut);
    delayLine.connect(feedback);
    feedback.connect(delaySend);
    dry.gain.value = Math.max(0.08, 1 - mix * 0.75);
    nodes.push(delayLine, feedback, delaySend, delayWet);
    tailSec = Math.max(tailSec, delaySec * (2 + fb * 16) + 0.12);
  }

  if (rack.reverb.enabled) {
    const mix = Math.max(0, Math.min(1, rack.reverb.mix));
    const decay = Math.max(0.2, Math.min(3, rack.reverb.decaySec));
    const conv = ctx.createConvolver();
    conv.buffer = makeReverbImpulse(ctx, decay);
    conv.normalize = false;
    const reverbWet = ctx.createGain();
    reverbWet.gain.value = mix * 1.25;
    split.connect(conv);
    conv.connect(reverbWet);
    reverbWet.connect(wetOut);
    dry.gain.value = Math.max(0.06, Math.min(dry.gain.value, 1 - mix * 0.8));
    nodes.push(conv, reverbWet);
    tailSec = Math.max(tailSec, decay * 1.15);
  }

  return { nodes, tailSec };
}

export function clonePadSamplerFxRack(rack: PadSamplerFxRack): PadSamplerFxRack {
  return {
    eq: { ...rack.eq },
    compressor: { ...rack.compressor },
    drive: rack.drive,
    limiter: { ...defaultPadSamplerFxRack().limiter, ...rack.limiter },
    delay: { ...rack.delay },
    reverb: { ...rack.reverb },
  };
}

export function padSamplerFxRackIsActive(rack: PadSamplerFxRack): boolean {
  return (
    rack.eq.enabled ||
    rack.compressor.enabled ||
    rack.compressor.deEsserEnabled ||
    rack.drive > 0.004 ||
    rack.limiter.enabled ||
    rack.delay.enabled ||
    rack.reverb.enabled
  );
}
