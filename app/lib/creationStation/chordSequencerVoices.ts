/**
 * Chord Bass Sequencer — chord pad timbres (Web Audio).
 * Eight production-ready voices so chord cards sound musical, not generic synth.
 */

import { resolveGrooveLabAudioDest } from '@/app/lib/creationStation/grooveLabAudio';
import { getSharedAudioOutput } from '@/app/lib/creationStation/sharedAudioOutput';

export type ChordVoiceCategory = 'piano' | 'strings' | 'keys' | 'blend';

export type ChordVoiceId =
  | 'grand'
  | 'upright'
  | 'epiano'
  | 'bright'
  | 'felt'
  | 'stage'
  | 'ballad'
  | 'strings'
  | 'chamber'
  | 'stringPad'
  | 'harp'
  | 'organ'
  | 'quincy'
  | 'pianoStrings'
  | 'studioStack';

export interface ChordVoiceDef {
  id: ChordVoiceId;
  label: string;
  short: string;
  describe: string;
  category: ChordVoiceCategory;
}

export const CHORD_VOICES: ChordVoiceDef[] = [
  {
    id: 'grand',
    label: 'GRAND',
    short: 'Grand',
    category: 'piano',
    describe: 'Concert grand — full body, hammer attack, long ring.',
  },
  {
    id: 'upright',
    label: 'UPRIGHT',
    short: 'Upright',
    category: 'piano',
    describe: 'Warmer upright piano — intimate jazz / soul ballad.',
  },
  {
    id: 'bright',
    label: 'BRIGHT',
    short: 'Bright',
    category: 'piano',
    describe: 'Pop piano — clear, present top end for dense major stacks.',
  },
  {
    id: 'felt',
    label: 'FELT',
    short: 'Felt',
    category: 'piano',
    describe: 'Soft felt piano — muted attack, lo-fi / cinematic chords.',
  },
  {
    id: 'stage',
    label: 'STAGE',
    short: 'Stage',
    category: 'piano',
    describe: 'Stage piano — punchy pop/rock stack with bright hammer.',
  },
  {
    id: 'ballad',
    label: 'BALLAD',
    short: 'Ballad',
    category: 'piano',
    describe: 'Ballad piano — long ring, gentle dynamics for slow songs.',
  },
  {
    id: 'epiano',
    label: 'E.PIANO',
    short: 'Rhodes',
    category: 'keys',
    describe: 'Electric piano (Rhodes-style) — bell tone for R&B and neo-soul.',
  },
  {
    id: 'organ',
    label: 'ORGAN',
    short: 'Organ',
    category: 'keys',
    describe: 'Warm drawbar organ — sustained gospel / church stack.',
  },
  {
    id: 'strings',
    label: 'STRINGS',
    short: 'Strings',
    category: 'strings',
    describe: 'Lush string section — slow bowed attack, holds under vocals.',
  },
  {
    id: 'chamber',
    label: 'CHAMBER',
    short: 'Chamber',
    category: 'strings',
    describe: 'Chamber strings — smaller section, lighter mix weight.',
  },
  {
    id: 'stringPad',
    label: 'PAD',
    short: 'String pad',
    category: 'strings',
    describe: 'Wide string pad — soft ensemble bed for chords.',
  },
  {
    id: 'harp',
    label: 'HARP',
    short: 'Harp',
    category: 'strings',
    describe: 'Plucked harp / nylon — short decay, arpeggio-friendly.',
  },
  {
    id: 'pianoStrings',
    label: 'PNO+STR',
    short: 'Piano strings',
    category: 'blend',
    describe: 'Piano with string overlay — classic ballad stack.',
  },
  {
    id: 'quincy',
    label: 'QUINCY',
    short: 'Quincy',
    category: 'blend',
    describe: 'Studio grand + full strings — lush Quincy-style beds.',
  },
  {
    id: 'studioStack',
    label: 'STUDIO',
    short: 'Studio',
    category: 'blend',
    describe: 'Bright piano + chamber strings — modern pop/R&B stack.',
  },
];

export const CHORD_VOICES_BY_CATEGORY: Record<ChordVoiceCategory, ChordVoiceDef[]> = {
  piano: CHORD_VOICES.filter((v) => v.category === 'piano'),
  strings: CHORD_VOICES.filter((v) => v.category === 'strings'),
  keys: CHORD_VOICES.filter((v) => v.category === 'keys'),
  blend: CHORD_VOICES.filter((v) => v.category === 'blend'),
};

export const CHORD_VOICE_MAP: Record<ChordVoiceId, ChordVoiceDef> = CHORD_VOICES.reduce(
  (acc, v) => {
    acc[v.id] = v;
    return acc;
  },
  {} as Record<ChordVoiceId, ChordVoiceDef>,
);

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** When set, chord preview/audition routes here so STOP can mute immediately. */
let progressionAuditionOutput: AudioNode | null = null;

export function withProgressionAuditionOutput<T>(output: AudioNode | null, fn: () => T): T {
  const prev = progressionAuditionOutput;
  progressionAuditionOutput = output;
  try {
    return fn();
  } finally {
    progressionAuditionOutput = prev;
  }
}

function connectOut(
  ctx: AudioContext | OfflineAudioContext,
  node: AudioNode,
): void {
  node.connect(
    progressionAuditionOutput ??
      (ctx instanceof OfflineAudioContext ? getSharedAudioOutput(ctx) : resolveGrooveLabAudioDest(ctx)),
  );
}

type VoiceCtx = AudioContext | OfflineAudioContext;

function voiceGrand(ctx: VoiceCtx, freq: number, start: number, sustain: number, vel: number): void {
  const g = ctx.createGain();
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(Math.min(12000, freq * 12), start);
  f.Q.value = 0.6;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(vel, start + 0.004);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, vel * 0.42), start + 0.35);
  g.gain.setTargetAtTime(0.0001, start + sustain * 0.55, 0.45);
  const o1 = ctx.createOscillator();
  o1.type = 'sine';
  o1.frequency.value = freq;
  const o2 = ctx.createOscillator();
  o2.type = 'sine';
  o2.frequency.value = freq * 2;
  const g2 = ctx.createGain();
  g2.gain.value = 0.22;
  const o3 = ctx.createOscillator();
  o3.type = 'triangle';
  o3.frequency.value = freq * 3;
  const g3 = ctx.createGain();
  g3.gain.value = 0.06;
  o1.connect(f);
  o2.connect(g2).connect(f);
  o3.connect(g3).connect(f);
  f.connect(g);
  connectOut(ctx, g);
  const stop = start + sustain + 1.2;
  o1.start(start);
  o2.start(start);
  o3.start(start);
  o1.stop(stop);
  o2.stop(stop);
  o3.stop(stop);
}

function voiceUpright(ctx: VoiceCtx, freq: number, start: number, sustain: number, vel: number): void {
  const g = ctx.createGain();
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(Math.min(5200, freq * 8), start);
  f.frequency.exponentialRampToValueAtTime(Math.max(800, freq * 2.5), start + 0.25);
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(vel * 0.95, start + 0.006);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, vel * 0.38), start + 0.5);
  g.gain.setTargetAtTime(0.0001, start + sustain * 0.6, 0.5);
  const o1 = ctx.createOscillator();
  o1.type = 'triangle';
  o1.frequency.value = freq;
  const o2 = ctx.createOscillator();
  o2.type = 'sine';
  o2.frequency.value = freq * 2;
  const g2 = ctx.createGain();
  g2.gain.value = 0.14;
  o1.connect(f);
  o2.connect(g2).connect(f);
  f.connect(g);
  connectOut(ctx, g);
  const stop = start + sustain + 1.0;
  o1.start(start);
  o2.start(start);
  o1.stop(stop);
  o2.stop(stop);
}

function voiceEpiano(ctx: VoiceCtx, freq: number, start: number, sustain: number, vel: number): void {
  const g = ctx.createGain();
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(freq * 3.5, start);
  f.Q.value = 1.2;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(vel, start + 0.002);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, vel * 0.28), start + 0.22);
  g.gain.setTargetAtTime(0.0001, start + sustain * 0.4, 0.35);
  const o1 = ctx.createOscillator();
  o1.type = 'sine';
  o1.frequency.value = freq;
  const o2 = ctx.createOscillator();
  o2.type = 'sine';
  o2.frequency.value = freq * 2.01;
  const g2 = ctx.createGain();
  g2.gain.value = 0.35;
  const o3 = ctx.createOscillator();
  o3.type = 'sine';
  o3.frequency.value = freq * 4.02;
  const g3 = ctx.createGain();
  g3.gain.value = 0.12;
  o1.connect(f);
  o2.connect(g2).connect(f);
  o3.connect(g3).connect(f);
  f.connect(g);
  connectOut(ctx, g);
  const stop = start + sustain + 0.8;
  o1.start(start);
  o2.start(start);
  o3.start(start);
  o1.stop(stop);
  o2.stop(stop);
  o3.stop(stop);
}

function voiceBright(ctx: VoiceCtx, freq: number, start: number, sustain: number, vel: number): void {
  const g = ctx.createGain();
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(Math.min(14000, freq * 14), start);
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(vel * 1.05, start + 0.003);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, vel * 0.35), start + 0.28);
  g.gain.setTargetAtTime(0.0001, start + sustain * 0.5, 0.38);
  const o1 = ctx.createOscillator();
  o1.type = 'triangle';
  o1.frequency.value = freq;
  const o2 = ctx.createOscillator();
  o2.type = 'sine';
  o2.frequency.value = freq * 2;
  const g2 = ctx.createGain();
  g2.gain.value = 0.28;
  o1.connect(f);
  o2.connect(g2).connect(f);
  f.connect(g);
  connectOut(ctx, g);
  const stop = start + sustain + 1.0;
  o1.start(start);
  o2.start(start);
  o1.stop(stop);
  o2.stop(stop);
}

function voiceStrings(ctx: VoiceCtx, freq: number, start: number, sustain: number, vel: number): void {
  const g = ctx.createGain();
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(Math.min(4200, freq * 6), start + 0.08);
  f.Q.value = 0.8;
  const attack = 0.12;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(vel * 0.85, start + attack);
  g.gain.linearRampToValueAtTime(vel * 0.72, start + sustain * 0.7);
  g.gain.setTargetAtTime(0.0001, start + sustain, 0.55);
  const detune = [-7, 0, 7];
  for (const cents of detune) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = freq;
    o.detune.value = cents;
    const og = ctx.createGain();
    og.gain.value = 0.22;
    o.connect(og).connect(f);
    const stop = start + sustain + 1.5;
    o.start(start);
    o.stop(stop);
  }
  f.connect(g);
  connectOut(ctx, g);
}

function voiceHarp(ctx: VoiceCtx, freq: number, start: number, sustain: number, vel: number): void {
  const g = ctx.createGain();
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(Math.min(8000, freq * 10), start);
  f.frequency.exponentialRampToValueAtTime(Math.max(400, freq * 2), start + 0.15);
  const pluckDur = Math.min(sustain, 0.55);
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(vel, start + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, start + pluckDur);
  const o1 = ctx.createOscillator();
  o1.type = 'triangle';
  o1.frequency.value = freq;
  const o2 = ctx.createOscillator();
  o2.type = 'sine';
  o2.frequency.value = freq * 2;
  const g2 = ctx.createGain();
  g2.gain.value = 0.2;
  o1.connect(f);
  o2.connect(g2).connect(f);
  f.connect(g);
  connectOut(ctx, g);
  const stop = start + pluckDur + 0.3;
  o1.start(start);
  o2.start(start);
  o1.stop(stop);
  o2.stop(stop);
}

function voiceOrgan(ctx: VoiceCtx, freq: number, start: number, sustain: number, vel: number): void {
  const g = ctx.createGain();
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = Math.min(6000, freq * 8);
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(vel * 0.9, start + 0.02);
  g.gain.setValueAtTime(vel * 0.82, start + sustain * 0.85);
  g.gain.setTargetAtTime(0.0001, start + sustain, 0.25);
  const ratios = [1, 2, 3, 4];
  const gains = [0.5, 0.28, 0.14, 0.08];
  for (let i = 0; i < ratios.length; i++) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq * ratios[i]!;
    const og = ctx.createGain();
    og.gain.value = gains[i]!;
    o.connect(og).connect(f);
    const stop = start + sustain + 0.5;
    o.start(start);
    o.stop(stop);
  }
  f.connect(g);
  connectOut(ctx, g);
}

function voiceQuincy(ctx: VoiceCtx, freq: number, start: number, sustain: number, vel: number): void {
  voiceGrand(ctx, freq, start, sustain, vel * 0.62);
  voiceStrings(ctx, freq, start + 0.04, sustain, vel * 0.48);
}

function voiceFelt(ctx: VoiceCtx, freq: number, start: number, sustain: number, vel: number): void {
  const g = ctx.createGain();
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(Math.min(3200, freq * 5), start);
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(vel * 0.82, start + 0.018);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, vel * 0.32), start + 0.55);
  g.gain.setTargetAtTime(0.0001, start + sustain * 0.65, 0.55);
  const o1 = ctx.createOscillator();
  o1.type = 'triangle';
  o1.frequency.value = freq;
  const o2 = ctx.createOscillator();
  o2.type = 'sine';
  o2.frequency.value = freq * 2;
  const g2 = ctx.createGain();
  g2.gain.value = 0.1;
  o1.connect(f);
  o2.connect(g2).connect(f);
  f.connect(g);
  connectOut(ctx, g);
  const stop = start + sustain + 1.2;
  o1.start(start);
  o2.start(start);
  o1.stop(stop);
  o2.stop(stop);
}

function voiceStage(ctx: VoiceCtx, freq: number, start: number, sustain: number, vel: number): void {
  const g = ctx.createGain();
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(Math.min(15000, freq * 16), start);
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(vel * 1.12, start + 0.002);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, vel * 0.4), start + 0.2);
  g.gain.setTargetAtTime(0.0001, start + sustain * 0.48, 0.32);
  const o1 = ctx.createOscillator();
  o1.type = 'sine';
  o1.frequency.value = freq;
  const o2 = ctx.createOscillator();
  o2.type = 'triangle';
  o2.frequency.value = freq * 2;
  const g2 = ctx.createGain();
  g2.gain.value = 0.32;
  const click = ctx.createOscillator();
  click.type = 'square';
  click.frequency.value = Math.min(4000, freq * 6);
  const cg = ctx.createGain();
  cg.gain.setValueAtTime(vel * 0.08, start);
  cg.gain.exponentialRampToValueAtTime(0.0001, start + 0.012);
  o1.connect(f);
  o2.connect(g2).connect(f);
  click.connect(cg).connect(f);
  f.connect(g);
  connectOut(ctx, g);
  const stop = start + sustain + 0.9;
  o1.start(start);
  o2.start(start);
  click.start(start);
  o1.stop(stop);
  o2.stop(stop);
  click.stop(start + 0.02);
}

function voiceBallad(ctx: VoiceCtx, freq: number, start: number, sustain: number, vel: number): void {
  voiceUpright(ctx, freq, start, sustain * 1.08, vel * 0.92);
}

function voiceChamber(ctx: VoiceCtx, freq: number, start: number, sustain: number, vel: number): void {
  const g = ctx.createGain();
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(Math.min(3600, freq * 5.5), start + 0.1);
  const attack = 0.14;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(vel * 0.72, start + attack);
  g.gain.linearRampToValueAtTime(vel * 0.58, start + sustain * 0.75);
  g.gain.setTargetAtTime(0.0001, start + sustain, 0.6);
  for (const cents of [-4, 0, 4]) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = freq;
    o.detune.value = cents;
    const og = ctx.createGain();
    og.gain.value = 0.16;
    o.connect(og).connect(f);
    const stop = start + sustain + 1.4;
    o.start(start);
    o.stop(stop);
  }
  f.connect(g);
  connectOut(ctx, g);
}

function voiceStringPad(ctx: VoiceCtx, freq: number, start: number, sustain: number, vel: number): void {
  const g = ctx.createGain();
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(Math.min(2800, freq * 4), start + 0.2);
  const attack = 0.22;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(vel * 0.78, start + attack);
  g.gain.setValueAtTime(vel * 0.7, start + sustain * 0.8);
  g.gain.setTargetAtTime(0.0001, start + sustain, 0.7);
  for (const cents of [-11, -5, 0, 5, 11]) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = freq;
    o.detune.value = cents;
    const og = ctx.createGain();
    og.gain.value = 0.12;
    o.connect(og).connect(f);
    const stop = start + sustain + 1.8;
    o.start(start);
    o.stop(stop);
  }
  f.connect(g);
  connectOut(ctx, g);
}

function voicePianoStrings(ctx: VoiceCtx, freq: number, start: number, sustain: number, vel: number): void {
  voiceGrand(ctx, freq, start, sustain, vel * 0.58);
  voiceChamber(ctx, freq, start + 0.06, sustain, vel * 0.52);
}

function voiceStudioStack(ctx: VoiceCtx, freq: number, start: number, sustain: number, vel: number): void {
  voiceBright(ctx, freq, start, sustain, vel * 0.55);
  voiceChamber(ctx, freq, start + 0.05, sustain, vel * 0.5);
  voiceStringPad(ctx, freq, start + 0.08, sustain * 0.95, vel * 0.28);
}

const SUSTAINED_CHORD_VOICES = new Set<ChordVoiceId>([
  'strings',
  'chamber',
  'stringPad',
  'organ',
  'quincy',
  'pianoStrings',
  'studioStack',
]);

const VOICE_FN: Record<
  ChordVoiceId,
  (ctx: VoiceCtx, freq: number, start: number, sustain: number, vel: number) => void
> = {
  grand: voiceGrand,
  upright: voiceUpright,
  epiano: voiceEpiano,
  bright: voiceBright,
  felt: voiceFelt,
  stage: voiceStage,
  ballad: voiceBallad,
  strings: voiceStrings,
  chamber: voiceChamber,
  stringPad: voiceStringPad,
  harp: voiceHarp,
  organ: voiceOrgan,
  quincy: voiceQuincy,
  pianoStrings: voicePianoStrings,
  studioStack: voiceStudioStack,
};

/** Schedule one chord tone with the selected timbre. */
export function scheduleChordNote(
  ctx: VoiceCtx,
  midi: number,
  start: number,
  sustain: number,
  velocity: number,
  voice: ChordVoiceId,
): void {
  const fn = VOICE_FN[voice] ?? voiceGrand;
  fn(ctx, midiToFreq(midi), start, sustain, Math.max(0.05, Math.min(1, velocity)));
}

/** Schedule a full chord (sorted low→high with light strum on keyed instruments). */
export function scheduleChord(
  ctx: VoiceCtx,
  notes: number[],
  start: number,
  sustain: number,
  voice: ChordVoiceId,
  masterVelocity = 0.76,
): void {
  if (notes.length === 0) return;
  const sorted = [...notes].sort((a, b) => a - b);
  const strumStep = SUSTAINED_CHORD_VOICES.has(voice) ? 0 : 0.011;
  sorted.forEach((midi, i) => {
    const vel = masterVelocity * (0.94 + (i / Math.max(1, sorted.length - 1)) * 0.08);
    scheduleChordNote(ctx, midi, start + i * strumStep, sustain, vel, voice);
  });
}
