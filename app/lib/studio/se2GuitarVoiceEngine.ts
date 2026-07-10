/**
 * SE2 Guitar hybrid voice — smplr GM + DI samples + body resonance + stroke/release noise.
 * Inspired by Shreddage Console / TACT depth without replacing the existing smplr path.
 */
import type { Se2GuitarArticulationId } from '@/app/lib/studio/se2GuitarArticulation';
import { se2SanitizeGuitarInstrumentId } from '@/app/lib/studio/se2GuitarInstruments';
import {
  scheduleSe2GuitarSampleLayer,
  se2GuitarRoundRobinHumanize,
  type Se2GuitarSampleLayerOpts,
} from '@/app/lib/studio/se2GuitarSampleLayer';

function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** Short filtered noise — pick attack / fret scrape. */
function scheduleNoiseBurst(
  ctx: AudioContext,
  destination: AudioNode,
  when: number,
  durationSec: number,
  gain: number,
  filterHz: number,
  filterQ = 0.9,
): void {
  if (gain <= 0.0001) return;
  const len = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) {
    ch[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 1.8;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bpf = ctx.createBiquadFilter();
  bpf.type = 'bandpass';
  bpf.frequency.value = filterHz;
  bpf.Q.value = filterQ;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.linearRampToValueAtTime(gain, when + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, when + durationSec);
  src.connect(bpf).connect(g).connect(destination);
  src.start(when);
  src.stop(when + durationSec + 0.02);
}

/** Karplus-style body thump under the sample — adds wooden resonance. */
function scheduleBodyResonance(
  ctx: AudioContext,
  destination: AudioNode,
  when: number,
  midi: number,
  velocity127: number,
  durationSec: number,
): void {
  const fund = midiToHz(midi);
  const vel = velocity127 / 127;
  const peak = 0.028 * vel;
  const len = Math.min(Math.floor(ctx.sampleRate * 0.18), 8192);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const ch = buf.getChannelData(0);
  const delay = Math.max(2, Math.round(ctx.sampleRate / fund));
  for (let i = 0; i < len; i += 1) {
    const n = (Math.random() * 2 - 1) * (i < 8 ? 1 : 0.35);
    ch[i] = i < delay ? n : ch[i - delay]! * 0.996 + n * 0.04;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.value = Math.min(4200, fund * 6);
  lpf.Q.value = 0.7;
  const g = ctx.createGain();
  g.gain.setValueAtTime(peak, when);
  g.gain.exponentialRampToValueAtTime(0.0001, when + Math.min(durationSec, 0.55));
  src.connect(lpf).connect(g).connect(destination);
  src.start(when);
  src.stop(when + Math.min(durationSec, 0.55) + 0.05);
}

export type Se2GuitarHybridVoiceOpts = {
  articulation?: Se2GuitarArticulationId;
  strokeNoise?: boolean;
  releaseNoise?: boolean;
  sampleBlend?: number;
};

/**
 * Layer DI samples, body resonance, and performance noises around the smplr voice.
 * Call after scheduling smplr — all layers share the same FX-chain destination.
 */
export function scheduleSe2GuitarHybridLayers(
  ctx: AudioContext,
  destination: AudioNode,
  when: number,
  tEnd: number,
  midi: number,
  velocity127: number,
  instrumentId: string,
  opts?: Se2GuitarHybridVoiceOpts,
): void {
  const inst = se2SanitizeGuitarInstrumentId(instrumentId);
  const articulation = opts?.articulation ?? 'sus';
  const dur = Math.max(0.06, tEnd - when);
  const vel = Math.max(1, Math.min(127, velocity127));
  const { pan } = se2GuitarRoundRobinHumanize();

  let dest: AudioNode = destination;
  if (Math.abs(pan) > 0.02) {
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    panner.connect(destination);
    dest = panner;
  }

  const sampleOpts: Se2GuitarSampleLayerOpts = {
    articulation,
    blend: opts?.sampleBlend ?? 0.28,
  };
  scheduleSe2GuitarSampleLayer(ctx, dest, when, dur, midi, vel, inst, sampleOpts);
  scheduleBodyResonance(ctx, dest, when, midi, vel, dur);

  const strokeOn = opts?.strokeNoise !== false;
  const releaseOn = opts?.releaseNoise !== false;

  if (strokeOn) {
    const strokeGain =
      articulation === 'pm' ? 0.06 : articulation === 'hp' ? 0.03 : 0.038;
    scheduleNoiseBurst(ctx, dest, when, 0.028, strokeGain * (vel / 127), midiToHz(midi) * 1.8, 1.1);
  }

  if (releaseOn && dur > 0.12) {
    const relGain = articulation === 'pm' ? 0.035 : 0.025;
    scheduleNoiseBurst(
      ctx,
      dest,
      tEnd - 0.02,
      0.045,
      relGain * (vel / 127),
      1800 + (midi % 5) * 120,
      0.75,
    );
  }

  if (articulation === 'hp') {
    scheduleNoiseBurst(ctx, dest, when + 0.012, 0.02, 0.03 * (vel / 127), midiToHz(midi) * 2.4, 1.4);
  }
}
