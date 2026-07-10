/**
 * Live preview for Neural Hum — keyboard taps + beatbox drum pads (Web Audio synth).
 */
import { getChordInstrument } from '@/app/lib/creationStation/chordInstruments';

import { neuralHumInstrumentMeta, type NeuralHumInstrumentId } from '@/app/lib/vocalLab/neuralHumToInstrument';
import { enforceMonophonicHumNotes } from '@/app/lib/vocalLab/neuralHumKeyLock';

export type NeuralHumDrumPadId =
  | 'kick'
  | 'snare'
  | 'hat'
  | 'clap'
  | 'tom'
  | 'rim'
  | 'shaker'
  | 'perc'
  | 'openhat'
  | 'crash'
  | 'ride'
  | 'sub808';

export type NeuralHumDrumPadMeta = {
  id: NeuralHumDrumPadId;
  label: string;
  short: string;
  color: string;
};

/** Twelve trigger slots — 4×3 grid; wire custom samples later. */
export const NEURAL_HUM_DRUM_PADS: readonly NeuralHumDrumPadMeta[] = [
  { id: 'kick', label: 'Kick', short: '1', color: '#ff6b6b' },
  { id: 'snare', label: 'Snare', short: '2', color: '#ffa94d' },
  { id: 'hat', label: 'Hi-hat', short: '3', color: '#ffd43b' },
  { id: 'clap', label: 'Clap', short: '4', color: '#69db7c' },
  { id: 'tom', label: 'Tom', short: '5', color: '#4dabf7' },
  { id: 'rim', label: 'Rim', short: '6', color: '#748ffc' },
  { id: 'shaker', label: 'Shaker', short: '7', color: '#b197fc' },
  { id: 'perc', label: 'Perc', short: '8', color: '#da77f2' },
  { id: 'openhat', label: 'Open hat', short: '9', color: '#ff8787' },
  { id: 'crash', label: 'Crash', short: '10', color: '#fcc419' },
  { id: 'ride', label: 'Ride', short: '11', color: '#82c91e' },
  { id: 'sub808', label: '808', short: '12', color: '#ff922b' },
] as const;

let previewStop: (() => void) | null = null;

function fadeOutEnvelopes(ctx: BaseAudioContext, envs: GainNode[], releaseSec = 0.06): void {
  const stopT = ctx.currentTime;
  for (const g of envs) {
    try {
      g.gain.cancelScheduledValues(stopT);
      g.gain.setValueAtTime(g.gain.value, stopT);
      g.gain.linearRampToValueAtTime(0, stopT + releaseSec);
    } catch {
      /* node may be disconnected */
    }
  }
}

export function stopNeuralHumPreview(): void {
  previewStop?.();
  previewStop = null;
}

/** Schedule roll audition — strict monophonic (one note at a time). Returns cancel. */
export function scheduleNeuralHumRollAudition(
  ctx: AudioContext,
  destination: AudioNode,
  instrumentId: NeuralHumInstrumentId,
  notes: readonly { pitch: number; startSec: number; durationSec: number; velocity: number }[],
  opts?: { dynamics?: number; transposeSemis?: number },
): () => void {
  const meta = neuralHumInstrumentMeta(instrumentId);
  const voice = getChordInstrument(meta.synthFallback);
  const transpose = opts?.transposeSemis ?? 0;
  const dyn = Math.max(0.15, Math.min(1, opts?.dynamics ?? 0.85));
  const envs: GainNode[] = [];
  const t0 = ctx.currentTime + 0.02;
  const mono = enforceMonophonicHumNotes(notes);

  for (const n of mono) {
    const scheduled = voice.scheduleNote({
      ctx,
      destination,
      midi: Math.max(0, Math.min(127, Math.round(n.pitch + transpose))),
      startTime: t0 + Math.max(0, n.startSec),
      sustainSec: Math.max(0.08, n.durationSec),
      velocity: (n.velocity / 127) * dyn,
    });
    envs.push(...scheduled);
  }

  return () => fadeOutEnvelopes(ctx, envs, 0.05);
}

/** Preview selected hum instrument on a keyboard tap. */
export function previewNeuralHumNote(
  ctx: AudioContext,
  destination: AudioNode,
  instrumentId: NeuralHumInstrumentId,
  midi: number,
  velocity = 0.82,
): void {
  stopNeuralHumPreview();
  const meta = neuralHumInstrumentMeta(instrumentId);
  const voice = getChordInstrument(meta.synthFallback);
  const t = ctx.currentTime;
  const envs = voice.scheduleNote({
    ctx,
    destination,
    midi: Math.max(0, Math.min(127, Math.round(midi))),
    startTime: t + 0.004,
    sustainSec: 0.5,
    velocity,
  });
  previewStop = () => fadeOutEnvelopes(ctx, envs);
}

function triggerKick(ctx: AudioContext, dest: AudioNode, t: number, sub = false): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(sub ? 120 : 150, t);
  osc.frequency.exponentialRampToValueAtTime(sub ? 32 : 42, t + (sub ? 0.35 : 0.12));
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(sub ? 1 : 0.95, t + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + (sub ? 0.7 : 0.35));
  osc.connect(gain);
  gain.connect(dest);
  osc.start(t);
  osc.stop(t + (sub ? 0.75 : 0.4));
}

function triggerSnare(ctx: AudioContext, dest: AudioNode, t: number): void {
  const len = Math.floor(ctx.sampleRate * 0.18);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const env = Math.pow(1 - i / len, 1.8);
    d[i] = (Math.random() * 2 - 1) * env;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.55, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  const tone = ctx.createOscillator();
  const tg = ctx.createGain();
  tone.type = 'triangle';
  tone.frequency.value = 180;
  tg.gain.setValueAtTime(0.35, t);
  tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
  noise.connect(ng);
  tone.connect(tg);
  ng.connect(dest);
  tg.connect(dest);
  noise.start(t);
  tone.start(t);
  noise.stop(t + 0.2);
  tone.stop(t + 0.12);
}

function triggerHat(ctx: AudioContext, dest: AudioNode, t: number, open = false): void {
  const dur = open ? 0.22 : 0.06;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = open ? 5500 : 7000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(open ? 0.22 : 0.28, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.85);
  src.connect(hp);
  hp.connect(g);
  g.connect(dest);
  src.start(t);
  src.stop(t + dur + 0.02);
}

function triggerClap(ctx: AudioContext, dest: AudioNode, t: number): void {
  for (let burst = 0; burst < 3; burst++) {
    const offset = burst * 0.012;
    const len = Math.floor(ctx.sampleRate * 0.04);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.22 - burst * 0.04, t + offset);
    g.gain.exponentialRampToValueAtTime(0.0001, t + offset + 0.06);
    src.connect(g);
    g.connect(dest);
    src.start(t + offset);
    src.stop(t + offset + 0.08);
  }
}

function triggerTom(ctx: AudioContext, dest: AudioNode, t: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(220, t);
  osc.frequency.exponentialRampToValueAtTime(90, t + 0.2);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(0.7, t + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(t);
  osc.stop(t + 0.5);
}

function triggerRim(ctx: AudioContext, dest: AudioNode, t: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = 820;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(0.35, t + 0.001);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(t);
  osc.stop(t + 0.05);
}

function triggerShaker(ctx: AudioContext, dest: AudioNode, t: number): void {
  const len = Math.floor(ctx.sampleRate * 0.12);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const grain = Math.sin(i * 0.7) * 0.5 + 0.5;
    d[i] = (Math.random() * 2 - 1) * grain * (1 - i / len);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 4000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.2, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
  src.connect(hp);
  hp.connect(g);
  g.connect(dest);
  src.start(t);
  src.stop(t + 0.14);
}

function triggerPerc(ctx: AudioContext, dest: AudioNode, t: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(880, t);
  osc.frequency.exponentialRampToValueAtTime(440, t + 0.05);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(0.18, t + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(t);
  osc.stop(t + 0.15);
}

function triggerCrash(ctx: AudioContext, dest: AudioNode, t: number): void {
  const len = Math.floor(ctx.sampleRate * 0.9);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 0.55);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 3000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.32, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
  src.connect(hp);
  hp.connect(g);
  g.connect(dest);
  src.start(t);
  src.stop(t + 0.95);
}

function triggerRide(ctx: AudioContext, dest: AudioNode, t: number): void {
  const len = Math.floor(ctx.sampleRate * 0.35);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.1);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 6200;
  bp.Q.value = 0.8;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.18, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
  src.connect(bp);
  bp.connect(g);
  g.connect(dest);
  src.start(t);
  src.stop(t + 0.38);
}

/** Dubler-style beatbox pad — lightweight synth drum, no samples. */
export function triggerNeuralHumDrumPad(
  ctx: AudioContext,
  destination: AudioNode,
  padId: NeuralHumDrumPadId,
): void {
  const t = ctx.currentTime + 0.002;
  switch (padId) {
    case 'kick':
      triggerKick(ctx, destination, t);
      break;
    case 'snare':
      triggerSnare(ctx, destination, t);
      break;
    case 'hat':
      triggerHat(ctx, destination, t);
      break;
    case 'clap':
      triggerClap(ctx, destination, t);
      break;
    case 'tom':
      triggerTom(ctx, destination, t);
      break;
    case 'rim':
      triggerRim(ctx, destination, t);
      break;
    case 'shaker':
      triggerShaker(ctx, destination, t);
      break;
    case 'perc':
      triggerPerc(ctx, destination, t);
      break;
    case 'openhat':
      triggerHat(ctx, destination, t, true);
      break;
    case 'crash':
      triggerCrash(ctx, destination, t);
      break;
    case 'ride':
      triggerRide(ctx, destination, t);
      break;
    case 'sub808':
      triggerKick(ctx, destination, t, true);
      break;
  }
}
