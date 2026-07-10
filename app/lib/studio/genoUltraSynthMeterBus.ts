/**
 * Geno Ultra — post-synth strip meter tap (keyboard, ARP, preview).
 * Stereo bus + permanent L/R analyser taps for EQ OUT meters.
 */

export type GenoUltraStripMeterLevels = {
  lDb: number;
  rDb: number;
};

let stripBus: GainNode | null = null;
let stripForward: GainNode | null = null;
let stripSplitter: ChannelSplitterNode | null = null;
let stripAnalyserL: AnalyserNode | null = null;
let stripAnalyserR: AnalyserNode | null = null;
let forwardDest: AudioNode | null = null;
let preferredForwardDest: AudioNode | null = null;
let meterSmoothL = -60;
let meterSmoothR = -60;
const meterBufL = new Float32Array(512);
const meterBufR = new Float32Array(512);

function pickForwardDest(ctx: AudioContext, dest: AudioNode): AudioNode {
  if (dest !== ctx.destination) preferredForwardDest = dest;
  return preferredForwardDest ?? dest;
}

function ensureForwardLink(dest: AudioNode): void {
  if (!stripForward) return;
  if (forwardDest === dest) return;
  try {
    stripForward.disconnect();
  } catch {
    /* */
  }
  stripForward.connect(dest);
  forwardDest = dest;
}

function configureAnalyser(a: AnalyserNode): void {
  a.fftSize = 512;
  a.smoothingTimeConstant = 0.72;
}

function createStripBus(ctx: AudioContext): void {
  stripBus = ctx.createGain();
  stripBus.gain.value = 1;
  stripBus.channelCount = 2;
  stripBus.channelCountMode = 'explicit';
  stripBus.channelInterpretation = 'speakers';

  stripForward = ctx.createGain();
  stripForward.gain.value = 1;
  stripForward.channelCount = 2;
  stripForward.channelCountMode = 'explicit';
  stripForward.channelInterpretation = 'speakers';

  stripSplitter = ctx.createChannelSplitter(2);
  stripAnalyserL = ctx.createAnalyser();
  stripAnalyserR = ctx.createAnalyser();
  configureAnalyser(stripAnalyserL);
  configureAnalyser(stripAnalyserR);

  stripBus.connect(stripForward);
  stripBus.connect(stripSplitter);
  stripSplitter.connect(stripAnalyserL, 0);
  stripSplitter.connect(stripAnalyserR, 1);
  forwardDest = null;
}

export function resolveGenoUltraStripOutput(ctx: AudioContext, dest: AudioNode): GainNode {
  if (!stripBus || stripBus.context.state === 'closed' || stripBus.context !== ctx) {
    createStripBus(ctx);
    preferredForwardDest = null;
    meterSmoothL = -60;
    meterSmoothR = -60;
  }
  ensureForwardLink(pickForwardDest(ctx, dest));
  return stripBus!;
}

export function getGenoUltraStripAnalysers(): { l: AnalyserNode | null; r: AnalyserNode | null } {
  return { l: stripAnalyserL, r: stripAnalyserR };
}

function readChannelDb(
  analyser: AnalyserNode | null,
  buf: Float32Array,
  smooth: number,
): { db: number; smooth: number } {
  if (!analyser) return { db: -60, smooth: -60 };
  analyser.getFloatTimeDomainData(buf);
  let peak = 0;
  for (let i = 0; i < buf.length; i += 1) {
    peak = Math.max(peak, Math.abs(buf[i] ?? 0));
  }
  const instant = peak < 1e-7 ? -60 : Math.max(-60, Math.min(0, 20 * Math.log10(peak)));
  const next = instant > smooth ? instant : smooth * 0.9 + instant * 0.1;
  return { db: next, smooth: next };
}

/** Stereo peak levels in dBFS — fast attack, slow release. */
export function readGenoUltraStripMeterStereo(): GenoUltraStripMeterLevels {
  const l = readChannelDb(stripAnalyserL, meterBufL, meterSmoothL);
  const r = readChannelDb(stripAnalyserR, meterBufR, meterSmoothR);
  meterSmoothL = l.smooth;
  meterSmoothR = r.smooth;
  return { lDb: l.db, rDb: r.db };
}

/** Mono peak (max of L/R) for legacy callers. */
export function readGenoUltraStripMeterDb(): number {
  const { lDb, rDb } = readGenoUltraStripMeterStereo();
  return Math.max(lDb, rDb);
}

export function resetGenoUltraStripMeterBus(): void {
  try {
    stripBus?.disconnect();
    stripForward?.disconnect();
    stripSplitter?.disconnect();
  } catch {
    /* */
  }
  stripBus = null;
  stripForward = null;
  stripSplitter = null;
  stripAnalyserL = null;
  stripAnalyserR = null;
  forwardDest = null;
  preferredForwardDest = null;
  meterSmoothL = -60;
  meterSmoothR = -60;
}
