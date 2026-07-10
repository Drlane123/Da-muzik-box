/**
 * SE2 Guitar — Web Audio FX chain (drive → chorus → reverb) before mixer strip.
 */
import { se2GuitarFxFromTrack, type Se2GuitarFxSettings } from '@/app/lib/studio/se2GuitarFx';

function makeSoftClipCurve(amount: number): Float32Array {
  const n = 256;
  const curve = new Float32Array(n);
  const k = 1.5 + (amount / 100) * 20;
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
  for (let c = 0; c < buf.numberOfChannels; c += 1) {
    const ch = buf.getChannelData(c);
    for (let i = 0; i < len; i += 1) {
      ch[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.1;
    }
  }
  return buf;
}

type ChainNodes = {
  input: GainNode;
  output: GainNode;
  compressor: DynamicsCompressorNode;
  eqLow: BiquadFilterNode;
  eqPresence: BiquadFilterNode;
  cabLow: BiquadFilterNode;
  cabHigh: BiquadFilterNode;
  drivePre: GainNode;
  shaper: WaveShaperNode;
  chorusDry: GainNode;
  chorusWet: GainNode;
  chorusDelay: DelayNode;
  chorusLfoGain: GainNode;
  reverbDry: GainNode;
  reverbWet: GainNode;
  reverbConv: ConvolverNode;
  stripOut: AudioNode;
};

function applyFx(nodes: ChainNodes, fx: Se2GuitarFxSettings): void {
  const comp = fx.comp / 100;
  nodes.compressor.threshold.value = -28 + comp * 14;
  nodes.compressor.ratio.value = 1.4 + comp * 3.6;
  nodes.compressor.attack.value = 0.004 + (1 - comp) * 0.012;
  nodes.compressor.release.value = 0.08 + comp * 0.22;

  const tone = fx.tone / 100;
  nodes.eqLow.gain.value = -2 + tone * 5;
  nodes.eqPresence.gain.value = -1 + tone * 7;
  nodes.cabLow.frequency.value = 85 + tone * 35;
  nodes.cabHigh.frequency.value = 4200 + tone * 2800;

  const drive = fx.drive / 100;
  nodes.drivePre.gain.value = 1 + drive * 0.55;
  nodes.shaper.curve = makeSoftClipCurve(fx.drive);

  const chorus = fx.chorus / 100;
  nodes.chorusWet.gain.value = chorus * 0.48;
  nodes.chorusDry.gain.value = Math.max(0.28, 1 - chorus * 0.38);
  nodes.chorusLfoGain.gain.value = chorus * 0.007;

  const reverb = fx.reverb / 100;
  nodes.reverbWet.gain.value = reverb * 0.62;
  nodes.reverbDry.gain.value = Math.max(0.12, 1 - reverb * 0.72);
}

function buildChain(ctx: AudioContext, stripOut: AudioNode): ChainNodes {
  const input = ctx.createGain();
  input.gain.value = 1;

  const compressor = ctx.createDynamicsCompressor();
  compressor.knee.value = 18;

  const eqLow = ctx.createBiquadFilter();
  eqLow.type = 'lowshelf';
  eqLow.frequency.value = 140;

  const eqPresence = ctx.createBiquadFilter();
  eqPresence.type = 'peaking';
  eqPresence.frequency.value = 2800;
  eqPresence.Q.value = 0.85;

  const cabLow = ctx.createBiquadFilter();
  cabLow.type = 'peaking';
  cabLow.frequency.value = 110;
  cabLow.Q.value = 0.65;
  cabLow.gain.value = 2.5;

  const cabHigh = ctx.createBiquadFilter();
  cabHigh.type = 'lowpass';
  cabHigh.Q.value = 0.55;

  const drivePre = ctx.createGain();
  drivePre.gain.value = 1;
  const shaper = ctx.createWaveShaper();
  shaper.oversample = '2x';

  const chorusDry = ctx.createGain();
  const chorusWet = ctx.createGain();
  const chorusDelay = ctx.createDelay(0.06);
  chorusDelay.delayTime.value = 0.018;
  const chorusLfo = ctx.createOscillator();
  chorusLfo.type = 'sine';
  chorusLfo.frequency.value = 1.05;
  const chorusLfoGain = ctx.createGain();
  chorusLfoGain.gain.value = 0;
  chorusLfo.connect(chorusLfoGain);
  chorusLfoGain.connect(chorusDelay.delayTime);
  chorusLfo.start();

  const reverbDry = ctx.createGain();
  const reverbWet = ctx.createGain();
  const reverbConv = ctx.createConvolver();
  reverbConv.buffer = makeReverbImpulse(ctx, 1.6);
  reverbConv.normalize = false;

  const output = ctx.createGain();
  output.gain.value = 1;

  input.connect(compressor);
  compressor.connect(eqLow);
  eqLow.connect(eqPresence);
  eqPresence.connect(cabLow);
  cabLow.connect(cabHigh);
  cabHigh.connect(drivePre);
  drivePre.connect(shaper);
  shaper.connect(chorusDry);
  shaper.connect(chorusDelay);
  chorusDelay.connect(chorusWet);

  const chorusMix = ctx.createGain();
  chorusMix.gain.value = 1;
  chorusDry.connect(chorusMix);
  chorusWet.connect(chorusMix);

  chorusMix.connect(reverbDry);
  chorusMix.connect(reverbConv);
  reverbConv.connect(reverbWet);

  reverbDry.connect(output);
  reverbWet.connect(output);
  output.connect(stripOut);

  const nodes: ChainNodes = {
    input,
    output,
    compressor,
    eqLow,
    eqPresence,
    cabLow,
    cabHigh,
    drivePre,
    shaper,
    chorusDry,
    chorusWet,
    chorusDelay,
    chorusLfoGain,
    reverbDry,
    reverbWet,
    reverbConv,
    stripOut,
  };

  applyFx(nodes, { drive: 0, chorus: 22, reverb: 18, tone: 55, comp: 42 });
  return nodes;
}

const chainsByCtx = new WeakMap<AudioContext, Map<number, ChainNodes>>();

function chainMap(ctx: AudioContext): Map<number, ChainNodes> {
  let map = chainsByCtx.get(ctx);
  if (!map) {
    map = new Map();
    chainsByCtx.set(ctx, map);
  }
  return map;
}

/** Smplr destination — stable input node per track; routes through FX into mixer strip. */
export function resolveSe2GuitarDestination(
  ctx: AudioContext,
  trackIndex: number,
  stripInput: AudioNode,
  fx: Se2GuitarFxSettings,
): AudioNode {
  const map = chainMap(ctx);
  let chain = map.get(trackIndex);
  if (!chain) {
    chain = buildChain(ctx, stripInput);
    map.set(trackIndex, chain);
  } else if (chain.stripOut !== stripInput) {
    try {
      chain.output.disconnect();
    } catch {
      /* */
    }
    chain.output.connect(stripInput);
    chain.stripOut = stripInput;
  }
  applyFx(chain, fx);
  return chain.input;
}

export function resolveSe2GuitarAudioForTrack(
  ctx: AudioContext,
  trackIndex: number,
  stripInput: AudioNode,
  track:
    | {
        kind?: string;
        guitarFxDrive?: number;
        guitarFxChorus?: number;
        guitarFxReverb?: number;
        guitarFxTone?: number;
        guitarFxComp?: number;
      }
    | undefined,
): AudioNode {
  if (track?.kind !== 'guitar') return stripInput;
  return resolveSe2GuitarDestination(ctx, trackIndex, stripInput, se2GuitarFxFromTrack(track));
}
