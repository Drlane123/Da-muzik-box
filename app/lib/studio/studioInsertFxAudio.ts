/**
 * Studio Editor 2 — real-time Web Audio insert chain for scheduled audio clips.
 */

import type { MixerEffectId } from '@/app/screens/components/ChannelStripFxDropdowns';
import type { StudioTrackInsertFxRack } from '@/app/lib/studio/studioTrackInsertFx';
import { studioEffectiveInsertFxRack } from '@/app/lib/studio/studioTrackInsertFx';
import { STUDIO_ANALOG_SAT_MAX } from '@/app/lib/studio/studioTrackInsertFx';
import { connectDeEsser, padSamplerDelayTimeMs } from '@/app/lib/creationStation/padSamplerFxRack';

function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

/** Cache impulses — regenerating 1–4s stereo noise on the main thread mid-play causes dropouts. */
const reverbImpulseCache = new Map<string, AudioBuffer>();

function makeReverbImpulse(ctx: BaseAudioContext, decaySec: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const decay = Math.max(0.2, Math.min(2.5, decaySec));
  const key = `${rate}:${Math.round(decay * 20)}`;
  const cached = reverbImpulseCache.get(key);
  if (cached) return cached;
  const len = Math.max(1, Math.floor(rate * decay));
  const buf = ctx.createBuffer(2, len, rate);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const ch = buf.getChannelData(c);
    for (let i = 0; i < len; i++) {
      ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
    }
  }
  reverbImpulseCache.set(key, buf);
  return buf;
}

function connectEq(ctx: AudioContext, input: AudioNode, eq: StudioTrackInsertFxRack['eq']): AudioNode {
  if (!eq.enabled) return input;
  let chain: AudioNode = input;
  for (const band of eq.bands) {
    const f = ctx.createBiquadFilter();
    f.type = band.kind;
    f.frequency.value = Math.min(ctx.sampleRate * 0.48, Math.max(20, band.freqHz));
    f.gain.value = Math.max(-12, Math.min(12, band.gainDb));
    f.Q.value = band.kind === 'peaking' ? Math.max(0.35, Math.min(12, band.q)) : 0.707;
    chain.connect(f);
    chain = f;
  }
  return chain;
}

function connectCompressor(
  ctx: AudioContext,
  input: AudioNode,
  comp: StudioTrackInsertFxRack['compressor'],
): AudioNode {
  const c = ctx.createDynamicsCompressor();
  c.threshold.value = Math.max(-48, Math.min(0, comp.thresholdDb));
  c.knee.value = Math.max(0, Math.min(40, comp.kneeDb));
  c.ratio.value = Math.max(1.01, Math.min(20, comp.ratio));
  c.attack.value = Math.max(0.003, Math.min(0.95, comp.attackSec));
  c.release.value = Math.max(0.04, Math.min(1.2, comp.releaseSec));
  input.connect(c);
  const makeup = ctx.createGain();
  makeup.gain.value = Math.min(4, dbToLinear(Math.max(0, Math.min(18, comp.makeupDb))));
  c.connect(makeup);
  return makeup;
}

/**
 * Soft noise reducer (not a true expander gate — Web Audio has no native gate).
 * Previous version put a constant floor GainNode after a ratio-20 compressor, which
 * either crushed the lane (~−72 dB always) or pumped hard → audible in/out silence.
 */
function connectGate(ctx: AudioContext, input: AudioNode, gate: StudioTrackInsertFxRack['gate']): AudioNode {
  const c = ctx.createDynamicsCompressor();
  c.threshold.value = Math.max(-80, Math.min(-12, gate.thresholdDb));
  c.knee.value = 8;
  c.ratio.value = 3;
  c.attack.value = Math.max(0.001, Math.min(0.05, gate.attackSec));
  c.release.value = Math.max(0.05, Math.min(0.8, gate.releaseSec));
  input.connect(c);
  return c;
}

function connectFilter(ctx: AudioContext, input: AudioNode, f: StudioTrackInsertFxRack['filter']): AudioNode {
  const q = Math.max(0.1, Math.min(18, 0.5 + f.resonance * 12));
  let chain: AudioNode = input;

  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = Math.max(20, Math.min(800, f.lowCutHz));
  hp.Q.value = q;
  chain.connect(hp);
  chain = hp;

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = Math.max(400, Math.min(18000, f.highCutHz));
  lp.Q.value = q;
  chain.connect(lp);
  chain = lp;

  return chain;
}

function connectSaturation(ctx: AudioContext, input: AudioNode, sat: StudioTrackInsertFxRack['saturation']): AudioNode {
  const sh = ctx.createWaveShaper();
  const k = Math.max(0.01, sat.drive * 8 + 0.5);
  const n = 256;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(k * x) / Math.tanh(k);
  }
  sh.curve = curve;
  sh.oversample = '2x';
  input.connect(sh);
  const tone = ctx.createBiquadFilter();
  tone.type = 'highshelf';
  tone.frequency.value = 3200;
  tone.gain.value = (sat.tone - 0.5) * 10;
  sh.connect(tone);
  return tone;
}

function connectLimiter(ctx: AudioContext, input: AudioNode, lim: StudioTrackInsertFxRack['limiter']): AudioNode {
  const c = ctx.createDynamicsCompressor();
  c.threshold.value = Math.max(-24, Math.min(0, lim.ceilingDb));
  c.knee.value = 0;
  c.ratio.value = 20;
  c.attack.value = 0.001;
  c.release.value = Math.max(0.01, Math.min(0.4, lim.releaseSec));
  input.connect(c);
  return c;
}

function connectChorus(
  ctx: AudioContext,
  input: AudioNode,
  dest: AudioNode,
  ch: StudioTrackInsertFxRack['chorus'],
): { tail: AudioNode; nodes: AudioNode[] } {
  const dry = ctx.createGain();
  dry.gain.value = 1 - ch.mix * 0.85;
  input.connect(dry);
  dry.connect(dest);

  const wet = ctx.createGain();
  wet.gain.value = ch.mix;
  const delay = ctx.createDelay(0.05);
  delay.delayTime.value = 0.018;
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = Math.max(0.1, Math.min(8, ch.rateHz));
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.003 + ch.depth * 0.012;
  lfo.connect(lfoGain);
  lfoGain.connect(delay.delayTime);
  input.connect(delay);
  delay.connect(wet);
  wet.connect(dest);
  lfo.start();
  return { tail: dry, nodes: [dry, wet, delay, lfo, lfoGain] };
}

function connectReverbParallel(
  ctx: AudioContext,
  input: AudioNode,
  dest: AudioNode,
  rev: StudioTrackInsertFxRack['reverb'],
  dryGain: GainNode,
): void {
  const mix = Math.max(0, Math.min(1, rev.mix));
  const decay = Math.max(0.2, Math.min(4, rev.decaySec));
  const conv = ctx.createConvolver();
  conv.buffer = makeReverbImpulse(ctx, decay);
  conv.normalize = false;
  const wet = ctx.createGain();
  wet.gain.value = mix * 1.1;
  input.connect(conv);
  conv.connect(wet);
  wet.connect(dest);
  dryGain.gain.value = Math.max(0.15, dryGain.gain.value * (1 - mix * 0.75));
}

function connectDelayParallel(
  ctx: AudioContext,
  input: AudioNode,
  dest: AudioNode,
  delayFx: StudioTrackInsertFxRack['delay'],
  dryGain: GainNode,
  bpm: number,
): void {
  const mix = Math.max(0, Math.min(1, delayFx.mix));
  const fb = Math.max(0, Math.min(0.9, delayFx.feedback));
  const delaySec = padSamplerDelayTimeMs(bpm, delayFx) / 1000;
  const line = ctx.createDelay(Math.max(2, delaySec * 3));
  line.delayTime.value = delaySec;
  const feedback = ctx.createGain();
  feedback.gain.value = fb;
  const wet = ctx.createGain();
  wet.gain.value = mix;
  input.connect(line);
  line.connect(wet);
  wet.connect(dest);
  line.connect(feedback);
  feedback.connect(line);
  dryGain.gain.value = Math.max(0.2, dryGain.gain.value * (1 - mix * 0.65));
}

function connectAnalogSaturation(
  ctx: AudioContext,
  input: AudioNode,
  dest: AudioNode,
  sat: StudioTrackInsertFxRack['analogSaturation'],
): AudioNode[] {
  const level = Math.max(0, Math.min(STUDIO_ANALOG_SAT_MAX, sat.level));
  if (level < 0.004) {
    input.connect(dest);
    return [];
  }

  const drive = 1.05 + level * 2.4;
  const sh = ctx.createWaveShaper();
  const n = 256;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const asym = x + level * 0.08 * (x > 0 ? x * x : -x * x * 0.35);
    curve[i] = Math.tanh(drive * asym) / Math.tanh(drive);
  }
  sh.curve = curve;
  sh.oversample = '2x';

  const warm = ctx.createBiquadFilter();
  warm.type = 'lowshelf';
  warm.frequency.value = 320;
  warm.gain.value = level * 2.2;

  const trim = ctx.createGain();
  trim.gain.value = 1 - level * 0.12;

  input.connect(sh);
  sh.connect(warm);
  warm.connect(trim);
  trim.connect(dest);
  return [sh, warm, trim];
}

function finishInsertFxOutput(
  ctx: AudioContext,
  fxOut: GainNode,
  dest: AudioNode,
  rack: StudioTrackInsertFxRack,
  nodes: AudioNode[],
): void {
  const satNodes = connectAnalogSaturation(ctx, fxOut, dest, rack.analogSaturation);
  nodes.push(...satNodes);
}

/** Fixed all-in-one suite order — each module runs when its `enabled` flag is on. */
const SUITE_SERIAL_ORDER = ['gate', 'eq', 'deEsser', 'compressor', 'saturation', 'filter', 'limiter'] as const;

/**
 * All-in-one insert chain: enabled suite modules in fixed order; delay/reverb parallel wet.
 * Vocal FX (autotune/vocoder) use {@link connectStudioLiveVocalFxForClip} on the preview bus.
 */
export function connectStudioInsertFxChain(
  ctx: AudioContext,
  slots: readonly [MixerEffectId, MixerEffectId, MixerEffectId],
  rack: StudioTrackInsertFxRack,
  dest: AudioNode,
  bpm = 120,
): { input: GainNode; nodes: AudioNode[] } {
  const effectiveRack = studioEffectiveInsertFxRack(rack, slots);
  const input = ctx.createGain();
  input.gain.value = 1;
  const nodes: AudioNode[] = [input];
  let chain: AudioNode = input;
  const dryBus = ctx.createGain();
  dryBus.gain.value = 1;
  nodes.push(dryBus);
  const fxOut = ctx.createGain();
  fxOut.gain.value = 1;
  nodes.push(fxOut);

  for (const id of SUITE_SERIAL_ORDER) {
    switch (id) {
      case 'eq':
        if (effectiveRack.eq.enabled) {
          chain = connectEq(ctx, chain, effectiveRack.eq);
          nodes.push(chain);
        }
        break;
      case 'deEsser':
        if (effectiveRack.deEsser.enabled) {
          chain = connectDeEsser(ctx, chain, effectiveRack.deEsser);
          nodes.push(chain);
        }
        break;
      case 'compressor':
        if (effectiveRack.compressor.enabled) {
          chain = connectCompressor(ctx, chain, effectiveRack.compressor);
          nodes.push(chain);
        }
        break;
      case 'gate':
        if (effectiveRack.gate.enabled) {
          chain = connectGate(ctx, chain, effectiveRack.gate);
          nodes.push(chain);
        }
        break;
      case 'filter':
        if (effectiveRack.filter.enabled) {
          chain = connectFilter(ctx, chain, effectiveRack.filter);
          nodes.push(chain);
        }
        break;
      case 'saturation':
        if (effectiveRack.saturation.enabled && effectiveRack.saturation.drive > 0.01) {
          chain = connectSaturation(ctx, chain, effectiveRack.saturation);
          nodes.push(chain);
        }
        break;
      case 'limiter':
        if (effectiveRack.limiter.enabled) {
          chain = connectLimiter(ctx, chain, effectiveRack.limiter);
          nodes.push(chain);
        }
        break;
      default:
        break;
    }
  }

  if (effectiveRack.chorus.enabled) {
    const chorus = connectChorus(ctx, chain, fxOut, effectiveRack.chorus);
    nodes.push(...chorus.nodes);
    finishInsertFxOutput(ctx, fxOut, dest, effectiveRack, nodes);
    return { input, nodes };
  }

  try {
    dryBus.disconnect();
  } catch {
    /* first wiring */
  }
  chain.connect(dryBus);
  dryBus.connect(fxOut);

  if (effectiveRack.reverb.enabled) {
    connectReverbParallel(ctx, chain, fxOut, effectiveRack.reverb, dryBus);
  }
  if (effectiveRack.delay.enabled) {
    connectDelayParallel(ctx, chain, fxOut, effectiveRack.delay, dryBus, bpm);
  }

  finishInsertFxOutput(ctx, fxOut, dest, effectiveRack, nodes);
  return { input, nodes };
}
