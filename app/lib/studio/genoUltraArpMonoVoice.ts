/**
 * Geno Ultra ARP — one always-on voice stack; only the amp gate changes per step.
 * Eliminates per-step OscillatorNode.start() clicks at fast 1/16 and 1/32 rates.
 */
import type {
  GenoUltraOscParams,
  GenoUltraOscWave,
  GenoUltraSynthVoiceParams,
} from '@/app/lib/studio/genoUltraSynthTypes';
import {
  GENO_ULTRA_A4_HZ,
  GENO_ULTRA_DEFAULT_OUTPUT_LEVEL,
  genoUltraVoiceHasWah,
} from '@/app/lib/studio/genoUltraSynthTypes';
import {
  genoUltraCollectLfoRoutes,
  genoUltraStartContinuousLfo,
} from '@/app/lib/studio/genoUltraLfoMod';
import { GENO_ULTRA_EQ_BANDS, getGenoUltraEqBandHz } from '@/app/lib/studio/genoUltraEqGraph';

export type GenoUltraArpMonoStepOpts = {
  when: number;
  stripOutput: AudioNode;
  midi: number;
  velocity: number;
  holdSec: number;
  atkSec: number;
  relSec: number;
  voice: GenoUltraSynthVoiceParams;
  bpm?: number;
  /** Tie into the previous step — skip re-attack when overlap. */
  legato?: boolean;
  /** Portamento source pitch (MIDI). */
  glideFromMidi?: number | null;
  glideSec?: number;
};

type ArpMonoChain = {
  ctx: AudioContext;
  osc1: OscillatorNode;
  osc2: OscillatorNode | null;
  sub: OscillatorNode | null;
  mix: GainNode;
  filter: BiquadFilterNode;
  amp: GainNode;
  hp: BiquadFilterNode;
  out: AudioNode;
  lfos: OscillatorNode[];
  voiceKey: string;
};

let chain: ArpMonoChain | null = null;
let chainDest: AudioNode | null = null;
let lastScheduledNoteEnd = 0;

function midiToHz(midi: number): number {
  return GENO_ULTRA_A4_HZ * 2 ** ((Math.max(0, Math.min(127, midi)) - 69) / 12);
}

function toOscType(w: GenoUltraOscWave): OscillatorType {
  return w === 'saw' ? 'sawtooth' : w;
}

function oscMidiHz(baseMidi: number, osc: GenoUltraOscParams): number {
  const cents = osc.semitone * 100 + osc.fineCents;
  return midiToHz(baseMidi + cents / 100);
}

/**
 * Structural voice identity only — never include per-step mod targets (cutoff / res).
 * Including filterCutoffHz rebuilt the whole osc stack every MOD step (fade+stop = static).
 */
function voiceChainKey(voice: GenoUltraSynthVoiceParams): string {
  const o1 = voice.osc1;
  const o2 = voice.osc2;
  const wah = genoUltraVoiceHasWah(voice);
  const eqSig =
    voice.category === 'bass' && voice.fx.eqEnabled
      ? `:eq:${voice.fx.eqLowDb.toFixed(1)}:${voice.fx.eqLoMidDb.toFixed(1)}:${voice.fx.eqHiMidDb.toFixed(1)}:${voice.fx.eqHighDb.toFixed(1)}`
      : '';
  return [
    o1.wave,
    o1.level.toFixed(2),
    o2.level > 0.001 ? `${o2.wave}:${o2.level.toFixed(2)}:${o2.semitone}` : '',
    voice.subLevel > 0.01 ? voice.subLevel.toFixed(2) : '',
    voice.filterMode,
    voice.filterDrive.toFixed(2),
    voice.filterEnabled === false ? 'fbypass' : '',
    `l1:${voice.lfo1RateHz.toFixed(2)}:${voice.lfo1Depth.toFixed(2)}:${voice.lfo1Shape}`,
    `l2:${voice.lfo2RateHz.toFixed(2)}:${voice.lfo2Depth.toFixed(2)}:${voice.lfo2Shape}`,
    voice.category,
    wah ? `wah:${voice.fx.delayEnabled !== false}:${voice.fx.delayTimeMs}` : '',
    eqSig,
  ].join('|');
}

function peakFromVelocity(velocity: number, voice: GenoUltraSynthVoiceParams): number {
  const out = Math.max(0, Math.min(1, voice.outputLevel ?? GENO_ULTRA_DEFAULT_OUTPUT_LEVEL));
  const isBass = voice.category === 'bass';
  const scale = isBass ? 0.64 : 0.5;
  const cap = isBass ? 0.5 : 0.36;
  return Math.max(0.001, Math.min(cap, (velocity / 127) * out * scale));
}

function wirePostHpEq(ctx: AudioContext, hp: BiquadFilterNode, voice: GenoUltraSynthVoiceParams): AudioNode {
  if (voice.category !== 'bass' || !voice.fx.eqEnabled) return hp;
  let tail: AudioNode = hp;
  for (const band of GENO_ULTRA_EQ_BANDS) {
    const f = ctx.createBiquadFilter();
    f.type = band.kind;
    f.frequency.value = getGenoUltraEqBandHz(band.id, voice.fx);
    f.gain.value = voice.fx[band.gainKey];
    f.Q.value = band.kind === 'peaking' ? band.q : 0.707;
    tail.connect(f);
    tail = f;
  }
  return tail;
}

function connectChainDest(c: ArpMonoChain, dest: AudioNode): void {
  if (chainDest === dest) return;
  try {
    c.out.disconnect();
  } catch {
    /* first wire */
  }
  c.out.connect(dest);
  chainDest = dest;
}

function fadeAndDisconnectChain(c: ArpMonoChain): void {
  const t = c.ctx.currentTime;
  try {
    c.amp.gain.cancelScheduledValues(t);
    c.amp.gain.setValueAtTime(c.amp.gain.value, t);
    c.amp.gain.linearRampToValueAtTime(0, t + 0.02);
  } catch {
    /* */
  }
  try {
    c.out.disconnect();
  } catch {
    /* */
  }
  const stopAt = t + 0.024;
  try {
    c.osc1.stop(stopAt);
    c.osc2?.stop(stopAt);
    c.sub?.stop(stopAt);
    for (const lfo of c.lfos) {
      lfo.stop(stopAt);
    }
  } catch {
    /* */
  }
}

function disposeChain(): void {
  if (!chain) return;
  fadeAndDisconnectChain(chain);
  chain = null;
  chainDest = null;
  lastScheduledNoteEnd = 0;
}

export function stopGenoUltraArpMonoVoice(): void {
  disposeChain();
}

function rampOscPitch(
  oscNode: OscillatorNode,
  t: number,
  hz: number,
  fromHz?: number,
  glideSec = 0,
): void {
  const f = oscNode.frequency;
  const target = Math.max(20, hz);
  if (typeof f.cancelAndHoldAtTime === 'function') {
    f.cancelAndHoldAtTime(t);
  } else {
    f.cancelScheduledValues(t);
  }
  const glide =
    fromHz != null &&
    glideSec > 0.004 &&
    Math.abs(fromHz - target) > 0.5;
  if (glide) {
    f.setValueAtTime(Math.max(20, fromHz), t);
    f.exponentialRampToValueAtTime(target, t + glideSec);
  } else {
    f.setValueAtTime(target, t);
  }
}

function wireOsc(
  ctx: AudioContext,
  osc: OscillatorNode,
  mix: GainNode,
  level: number,
  peakScale: number,
): void {
  const g = ctx.createGain();
  g.gain.value = Math.max(0, level) * peakScale;
  osc.connect(g);
  g.connect(mix);
  osc.start();
}

function wireDelayOut(ctx: AudioContext, hp: BiquadFilterNode, voice: GenoUltraSynthVoiceParams): AudioNode {
  if (!genoUltraVoiceHasWah(voice) || voice.fx.delayEnabled === false || voice.fx.delayMix <= 0.02) {
    return hp;
  }
  const dly = ctx.createDelay(4);
  dly.delayTime.value = Math.max(0.03, Math.min(1.2, voice.fx.delayTimeMs / 1000));
  const fb = ctx.createGain();
  fb.gain.value = Math.min(0.88, voice.fx.delayFeedback);
  const dry = ctx.createGain();
  dry.gain.value = 1;
  const wet = ctx.createGain();
  wet.gain.value = voice.fx.delayMix * 0.78;
  const sum = ctx.createGain();
  sum.gain.value = 1;
  hp.connect(dry);
  hp.connect(dly);
  dly.connect(fb);
  fb.connect(dly);
  dly.connect(wet);
  dry.connect(sum);
  wet.connect(sum);
  return sum;
}

function ensureChain(
  ctx: AudioContext,
  stripOutput: AudioNode,
  voice: GenoUltraSynthVoiceParams,
  bpm = 120,
): ArpMonoChain {
  const key = voiceChainKey(voice);
  if (chain && chain.ctx === ctx && chain.voiceKey === key) {
    connectChainDest(chain, stripOutput);
    return chain;
  }

  if (chain) {
    fadeAndDisconnectChain(chain);
    chain = null;
    chainDest = null;
  }

  const wah = genoUltraVoiceHasWah(voice);
  const cutoffHz = Math.max(200, Math.min(12000, voice.filterCutoffHz));
  const mix = ctx.createGain();
  mix.gain.value = 1;

  const osc1 = ctx.createOscillator();
  osc1.type = toOscType(voice.osc1.wave);
  osc1.frequency.value = midiToHz(60);
  wireOsc(ctx, osc1, mix, voice.osc1.level, 1);

  let osc2: OscillatorNode | null = null;
  if (voice.osc2.level > 0.001) {
    osc2 = ctx.createOscillator();
    osc2.type = toOscType(voice.osc2.wave);
    osc2.frequency.value = midiToHz(60);
    wireOsc(ctx, osc2, mix, voice.osc2.level, 1);
  }

  let sub: OscillatorNode | null = null;
  if (voice.subLevel > 0.01) {
    sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = midiToHz(48);
    wireOsc(ctx, sub, mix, voice.subLevel, 0.95);
  }

  const filterOn = voice.filterEnabled !== false;

  const filter = ctx.createBiquadFilter();
  filter.type = voice.filterMode === 'highpass' ? 'highpass' : voice.filterMode === 'bandpass' ? 'bandpass' : 'lowpass';
  filter.frequency.value = cutoffHz;
  filter.Q.value = wah
    ? Math.max(0.15, Math.min(4.2, voice.filterResonanceQ))
    : Math.max(0.1, Math.min(1.2, voice.filterResonanceQ * 0.55));

  const amp = ctx.createGain();
  amp.gain.value = 0;

  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = voice.category === 'bass' ? 58 : 42;
  hp.Q.value = voice.category === 'bass' ? 0.62 : 0.55;

  if (filterOn) {
    mix.connect(filter);
    filter.connect(amp);
  } else {
    mix.connect(amp);
  }
  amp.connect(hp);

  const lfos: OscillatorNode[] = [];
  if (filterOn) {
    for (const route of genoUltraCollectLfoRoutes(voice)) {
      if (route.dest === 'filterCutoff') {
        const node = genoUltraStartContinuousLfo(ctx, route, voice, bpm, filter.frequency, cutoffHz, 0.65);
        if (node) lfos.push(node);
      } else if (route.dest === 'filterRes') {
        const node = genoUltraStartContinuousLfo(
          ctx,
          route,
          voice,
          bpm,
          filter.Q,
          filter.Q.value,
          2.5,
        );
        if (node) lfos.push(node);
      }
    }
  }

  const eqOut = wirePostHpEq(ctx, hp, voice);
  const out = wireDelayOut(ctx, eqOut, voice);

  chain = { ctx, osc1, osc2, sub, mix, filter, amp, hp, out, lfos, voiceKey: key };
  connectChainDest(chain, stripOutput);
  return chain;
}

/**
 * Lookahead-safe amp — never read amp.gain.value (that is "now", not schedule time).
 * Optional decay→sustain for Odyssey/303 body (still no pitch bend).
 */
function gateAmpAt(
  amp: GainNode,
  t: number,
  peak: number,
  atk: number,
  noteEnd: number,
  tEnd: number,
  dec = 0,
  sustain = 1,
): void {
  const g = amp.gain;
  const pk = Math.max(peak, 0.0003);
  const sus = Math.max(0.0003, pk * Math.max(0, Math.min(1, sustain)));
  const atkSec = Math.max(0.002, atk);
  if (typeof g.cancelAndHoldAtTime === 'function') {
    g.cancelAndHoldAtTime(t);
    g.linearRampToValueAtTime(pk, t + atkSec);
  } else {
    g.cancelScheduledValues(t);
    g.setValueAtTime(pk, t);
  }
  if (dec > 0.01 && sustain < 0.95) {
    g.linearRampToValueAtTime(sus, t + atkSec + Math.max(0.03, dec));
    g.setValueAtTime(sus, noteEnd);
  } else {
    g.setValueAtTime(pk, noteEnd);
  }
  g.linearRampToValueAtTime(0.00005, tEnd);
}

/** Close the persistent mono amp — pump / gate off-beats (oscillators keep running). */
export function scheduleGenoUltraArpMonoGateClose(
  ctx: AudioContext,
  opts: {
    when: number;
    stripOutput: AudioNode;
    voice: GenoUltraSynthVoiceParams;
    relSec: number;
    bpm?: number;
  },
): void {
  const m = ensureChain(ctx, opts.stripOutput, opts.voice, opts.bpm ?? 120);
  const t = Math.max(opts.when, ctx.currentTime + 0.002);
  const rel = Math.max(0.003, Math.min(opts.relSec, 0.14));
  const g = m.amp.gain;
  const cur = Math.max(0.00005, g.value);
  if (typeof g.cancelAndHoldAtTime === 'function') {
    g.cancelAndHoldAtTime(t);
  } else {
    g.cancelScheduledValues(t);
  }
  g.setValueAtTime(cur, t);
  g.linearRampToValueAtTime(0.00005, t + rel);
}

/** Gate one ARP step on the persistent mono voice. */
export function scheduleGenoUltraArpMonoStep(ctx: AudioContext, opts: GenoUltraArpMonoStepOpts): void {
  const t = Math.max(opts.when, ctx.currentTime + 0.002);
  const v = opts.voice;
  const m = ensureChain(ctx, opts.stripOutput, v, opts.bpm ?? 120);
  const hz1 = oscMidiHz(opts.midi, v.osc1);
  const peak = peakFromVelocity(opts.velocity, v);
  const isBass = v.category === 'bass';
  let holdSec = Math.max(0.006, opts.holdSec);
  /** Honor dry-body attack (Odyssey snap) — no forced soft bass attack. */
  let atk = Math.max(0.001, Math.min(opts.atkSec, holdSec * 0.35));
  // Release may spill slightly into the next step; mono cancel handles the handoff.
  let rel = Math.max(0.008, Math.min(opts.relSec, holdSec * 0.9));
  const legato = opts.legato === true;
  const isTied = legato && t < lastScheduledNoteEnd - 0.006;
  if (legato && !isTied) {
    holdSec = Math.min(holdSec * 1.12, holdSec + 0.018);
  }
  const noteEnd = t + holdSec;
  const tEnd = noteEnd + rel;
  const keyTrack = Math.max(0, Math.min(1, v.filterKeyTrack));
  const keyBoost = 1 + (opts.midi / 127) * keyTrack * 0.85;
  const cutoff = Math.max(200, Math.min(12000, v.filterCutoffHz * keyBoost));

  const glideSec = Math.max(0, opts.glideSec ?? 0);
  const glideFromHz =
    opts.glideFromMidi != null ? midiToHz(opts.glideFromMidi) : undefined;

  rampOscPitch(m.osc1, t, hz1, glideFromHz, glideSec);
  if (m.osc2) rampOscPitch(m.osc2, t, oscMidiHz(opts.midi, v.osc2), glideFromHz, glideSec);
  if (m.sub) {
    const subFrom =
      opts.glideFromMidi != null ? midiToHz(opts.glideFromMidi - 12) : undefined;
    rampOscPitch(m.sub, t, midiToHz(opts.midi - 12), subFrom, glideSec);
  }

  m.filter.frequency.cancelScheduledValues(t);
  m.filter.Q.cancelScheduledValues(t);

  m.filter.type = 'lowpass';
  const q = Math.max(0.1, Math.min(8, v.filterResonanceQ));
  m.filter.Q.setValueAtTime(q, t);

  /**
   * Filter envelope — Odyssey/303 punch, or slow rise for dance risers.
   * Pitch stays snapped (no bend).
   */
  const useFilterEnv =
    v.filterEnabled !== false &&
    v.filterEnvEnabled !== false &&
    (v.filterDecayMs > 8 || v.filterAttackMs > 40);
  if (useFilterEnv) {
    const fAtk = Math.max(0.001, v.filterAttackMs / 1000);
    const fDec = Math.max(0.04, Math.min(0.5, v.filterDecayMs / 1000));
    const fSus = Math.max(0, Math.min(1, v.filterSustain));
    const fRel = Math.max(0.02, v.filterReleaseMs / 1000);
    const fStart = Math.max(60, cutoff * (v.filterAttackMs > 200 ? 0.25 : 0.55));
    const fPeak = Math.min(
      12000,
      cutoff + (12000 - cutoff) * (v.filterAttackMs > 200 ? 0.85 : 0.45 + (1 - fSus) * 0.4),
    );
    const fSusHz = Math.max(80, cutoff * (0.35 + fSus * 0.65));
    m.filter.frequency.setValueAtTime(fStart, t);
    m.filter.frequency.exponentialRampToValueAtTime(Math.max(fStart + 40, fPeak), t + fAtk);
    if (fSus < 0.92 && fDec > 0.02) {
      m.filter.frequency.exponentialRampToValueAtTime(Math.max(80, fSusHz), t + fAtk + fDec);
      m.filter.frequency.setValueAtTime(Math.max(80, fSusHz), noteEnd);
    } else {
      m.filter.frequency.setValueAtTime(Math.max(80, fPeak), noteEnd);
    }
    m.filter.frequency.exponentialRampToValueAtTime(
      Math.max(60, cutoff * 0.4),
      noteEnd + fRel,
    );
  } else if (v.filterEnabled !== false) {
    m.filter.frequency.setValueAtTime(cutoff, t);
  }

  if (v.ampEnvEnabled === false) {
    gateAmpAt(m.amp, t, peak, 0, noteEnd, tEnd, 0, 1);
  } else if (isTied) {
    const g = m.amp.gain;
    if (typeof g.cancelAndHoldAtTime === 'function') {
      g.cancelAndHoldAtTime(t);
    } else {
      g.cancelScheduledValues(t);
    }
    const cur = Math.max(0.0003, g.value);
    g.setValueAtTime(cur, t);
    g.linearRampToValueAtTime(peak, t + 0.004);
    g.setValueAtTime(peak, noteEnd);
    g.linearRampToValueAtTime(0.00005, tEnd);
  } else {
    gateAmpAt(
      m.amp,
      t,
      peak,
      atk,
      noteEnd,
      tEnd,
      v.ampDecayMs / 1000,
      v.ampSustain,
    );
  }

  lastScheduledNoteEnd = tEnd;
}
