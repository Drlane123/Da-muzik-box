/**
 * Beat Lab NEW SYNTH — Web Audio voice engine (CH 17–32).
 * Uses per-lane {@link BeatLabBassSynthVoiceParams} from the V2 panel.
 */
import { registerBeatLabMeterVoice } from '@/app/lib/creationStation/beatLabChannelMeters';
import {
  beatLabSynthV2GlideInfo,
  beatLabSynthV2GlideSeconds,
} from '@/app/lib/creationStation/beatLabMelodicSynthV2Timing';
import { emitBeatLabSynthV2GlidePulse } from '@/app/lib/creationStation/beatLabSynthV2GlidePulse';
import { applyBeatLabSynthV2GlideToOsc } from '@/app/lib/creationStation/beatLabSynthV2GlideOsc';
import {
  beatLabMelodicMixerChannel,
  type BeatLabMelodicPlayOpts,
} from '@/app/lib/creationStation/beatLabMelodicSoundfont';
import type { BeatLabBassSynthVoiceParams } from '@/app/lib/creationStation/beatLabMelodicSynthV2State';
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';

export type BeatLabSynthV2PlayOpts = Omit<BeatLabMelodicPlayOpts, 'instrumentId'> & {
  voice: BeatLabBassSynthVoiceParams;
  /** Legato glide source when glideMode is legato (overlapping note in roll). */
  legatoFromMidi?: number;
  /** Chord-rail glide source when glideMode is chord (prior bar root). */
  chordFromMidi?: number;
  bpm?: number;
  /** Step column where note starts — for quantized glide shift markers. */
  stepCol?: number;
  /** Note length (step columns). */
  stepLenCols?: number;
  subdiv?: number;
  beatsPerBar?: number;
  /** If true, force hard note-off at grid end (no long release overlap). */
  strictNoteOff?: boolean;
  keyRoot?: number;
  keyMode?: ChordMode;
};

function masterDestination(ctx: BaseAudioContext): AudioNode {
  const master = (window as unknown as { __daMusicMasterGain?: GainNode | null }).__daMusicMasterGain;
  return master && master.context === ctx ? master : ctx.destination;
}

function channelPan(ch: number): number {
  const raw =
    (window as unknown as { __daMusicChannelPans?: Record<number, number> }).__daMusicChannelPans?.[ch] ??
    0;
  return Math.max(-1, Math.min(1, raw / 100));
}

function channelVolumeGain(ch: number, channelVolumes: Record<number, number>): number {
  return Math.max(0, Math.min(1, (channelVolumes[ch] ?? 80) / 100));
}

/** Engine trim × voice OUTPUT knob × mixer CH fader. */
function beatLabSynthV2Peak(
  velocity: number,
  volGain: number,
  voice: BeatLabBassSynthVoiceParams,
): number {
  const voiceOut = Math.max(0, Math.min(1, voice.outputLevel ?? 0.45));
  return Math.max(0.0002, Math.min(1, (velocity / 127) * volGain * voiceOut * 0.62));
}

function scheduleTime(ctx: AudioContext, when: number, immediate = false): number {
  const floor = immediate ? 0.002 : 0.008;
  return Math.max(when, ctx.currentTime + floor);
}

function midiToHz(midi: number): number {
  return 440 * 2 ** ((Math.max(0, Math.min(127, midi)) - 69) / 12);
}

function toOscType(w: BeatLabBassSynthVoiceParams['osc1Wave']): OscillatorType {
  if (w === 'saw') return 'sawtooth';
  return w;
}

function makeDistortionCurve(amount: number): Float32Array {
  const k = 2 + amount * 48;
  const n = 256;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const x = (i * 2) / n - 1;
    curve[i] = Math.tanh(x * k);
  }
  return curve;
}

function fxTailEstimateSec(v: BeatLabBassSynthVoiceParams): number {
  let tail = 0.12;
  if (v.delayMix > 0.02) tail = Math.max(tail, v.delayTimeMs / 1000 * 2.5);
  if (v.reverbMix > 0.02) tail = Math.max(tail, 0.35 + v.reverbDecay * 0.8);
  return tail;
}

/** Transport-scheduled voices only — cleared on Beat Lab Stop (not keyboard preview). */
const beatLabSynthV2TransportStoppers = new Set<() => void>();

/** Cut bass/V2 notes queued by transport lookahead (~3s ahead). */
export function haltBeatLabSynthV2TransportVoices(): void {
  for (const stop of beatLabSynthV2TransportStoppers) {
    try {
      stop();
    } catch {
      /* */
    }
  }
  beatLabSynthV2TransportStoppers.clear();
}

function attachSynthV2MeterTap(
  ctx: AudioContext,
  dryBus: GainNode,
  ch: number,
  panSigned: number,
  when: number,
  until: number,
): void {
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.12;
  dryBus.connect(analyser);
  registerBeatLabMeterVoice(ch, analyser, panSigned, when, until);
}

function setOscFrequency(
  o: OscillatorNode,
  midi: number,
  when: number,
  glideSec: number,
  fromMidi: number | undefined,
  voice: BeatLabBassSynthVoiceParams,
  bpm: number,
  lane: number,
  noteEnd?: number,
  markerGrid?: {
    stepCol: number;
    noteEndCol: number;
    subSpb: number;
    stepsPerBar: number;
  },
  keyRoot?: number,
  keyMode?: ChordMode,
  slideBarEnabled = true,
): void {
  applyBeatLabSynthV2GlideToOsc(o, midi, when, glideSec, fromMidi, voice, bpm, {
    lane,
    noteEnd,
    emitPulse: false,
    markerGrid,
    keyRoot,
    keyMode,
    slideBarEnabled,
  });
}

/** Schedule one note with amp/filter/osc + light FX sends. */
export function scheduleBeatLabSynthV2Note(ctx: AudioContext, opts: BeatLabSynthV2PlayOpts): void {
  const when = opts.whenLocked ?? scheduleTime(ctx, opts.when);
  const v = opts.voice;
  let { glideSec, fromMidi } = beatLabSynthV2GlideInfo(opts.lane, opts.midi, when, v, {
    legatoFromMidi: opts.legatoFromMidi,
    chordFromMidi: opts.chordFromMidi,
    bpm: opts.bpm,
  });
  if (glideSec > 0.001 && fromMidi != null && fromMidi !== opts.midi) {
    emitBeatLabSynthV2GlidePulse({
      lane: opts.lane,
      fromMidi,
      toMidi: opts.midi,
      durationSec: glideSec,
    });
  }
  const noteEnd = when + Math.max(0.04, opts.durationSec);
  const subdiv = Math.max(1, Math.round(opts.subdiv ?? 4));
  const beatsPB = Math.max(1, Math.round(opts.beatsPerBar ?? 4));
  const stepsPerBar = subdiv * beatsPB;
  const bpmR = Math.max(1, opts.bpm ?? 120);
  const subSpb = (60 / bpmR) / subdiv;
  const sc = opts.stepCol;
  const slen = Math.max(1, Math.round(opts.stepLenCols ?? 1));
  const barIdx = sc == null ? -1 : Math.floor(sc / Math.max(1, stepsPerBar));
  const glideBarEnabled =
    barIdx < 0 || barIdx > 31 ? true : ((v.glideBarMask ?? 0xffffffff) & (1 << barIdx)) !== 0;
  const slideBarEnabled =
    barIdx < 0 || barIdx > 31 ? true : ((v.slideBarMask ?? 0xffffffff) & (1 << barIdx)) !== 0;
  if (!glideBarEnabled) {
    glideSec = 0;
    fromMidi = undefined;
  }
  const markerGrid =
    sc != null && (v.glideShiftMarkers?.length ?? 0) > 0
      ? { stepCol: sc, noteEndCol: sc + slen, subSpb, stepsPerBar }
      : undefined;

  const ch = beatLabMelodicMixerChannel(opts.lane);
  const panSigned = channelPan(ch);
  const volGain = channelVolumeGain(ch, opts.channelVolumes);
  const peak = beatLabSynthV2Peak(opts.velocity, volGain, v);

  const atk = Math.max(0.001, v.ampAttackMs / 1000);
  const dec = Math.max(0.004, v.ampDecayMs / 1000);
  const susLvl = Math.max(0.0002, Math.min(1, v.ampSustain) * peak);
  const relRaw = Math.max(0.012, v.ampReleaseMs / 1000);
  const rel = opts.strictNoteOff === true ? 0.006 : relRaw;
  const panner = ctx.createStereoPanner();
  panner.pan.setValueAtTime(panSigned, when);
  panner.connect(masterDestination(ctx));

  const dryBus = ctx.createGain();
  dryBus.gain.setValueAtTime(1, when);
  dryBus.connect(panner);

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.setValueAtTime(-28 + (1 - v.compressor) * 22, when);
  comp.knee.setValueAtTime(12, when);
  comp.ratio.setValueAtTime(2 + v.compressor * 8, when);
  comp.attack.setValueAtTime(0.003, when);
  comp.release.setValueAtTime(0.12 + v.compressor * 0.2, when);
  comp.connect(dryBus);

  const eqHigh = ctx.createBiquadFilter();
  eqHigh.type = 'highshelf';
  eqHigh.frequency.setValueAtTime(4200, when);
  eqHigh.gain.setValueAtTime(v.eqHighDb, when);

  const eqMid = ctx.createBiquadFilter();
  eqMid.type = 'peaking';
  eqMid.frequency.setValueAtTime(880, when);
  eqMid.Q.setValueAtTime(0.85, when);
  eqMid.gain.setValueAtTime(v.eqMidDb, when);

  const eqLow = ctx.createBiquadFilter();
  eqLow.type = 'lowshelf';
  eqLow.frequency.setValueAtTime(140, when);
  eqLow.gain.setValueAtTime(v.eqLowDb, when);

  eqLow.connect(eqMid);
  eqMid.connect(eqHigh);
  eqHigh.connect(comp);

  const filter = ctx.createBiquadFilter();
  filter.type = v.filterType;
  filter.frequency.setValueAtTime(Math.max(40, Math.min(16000, v.filterCutoffHz)), when);
  filter.Q.setValueAtTime(Math.max(0.15, Math.min(16, v.filterResonanceQ)), when);

  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.0001, when);
  amp.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0003), when + atk);
  if (Math.abs(susLvl - peak) > 0.0001) {
    amp.gain.exponentialRampToValueAtTime(Math.max(susLvl, 0.0003), when + atk + dec);
  }
  amp.gain.setValueAtTime(Math.max(susLvl, 0.0003), noteEnd);
  amp.gain.exponentialRampToValueAtTime(0.0001, noteEnd + rel);

  const oscMix = ctx.createGain();
  oscMix.gain.setValueAtTime(1, when);
  oscMix.connect(filter);

  const driveAmt = Math.max(0, Math.min(1, v.filterDrive * 0.65 + v.distortion * 0.85));
  let postFilter: AudioNode = filter;
  if (driveAmt > 0.03) {
    const shaper = ctx.createWaveShaper();
    shaper.curve = makeDistortionCurve(driveAmt);
    shaper.oversample = '2x';
    filter.connect(shaper);
    postFilter = shaper;
  }
  postFilter.connect(amp);
  amp.connect(eqLow);

  const unisonN = Math.max(1, Math.min(6, Math.round(v.unisonVoices)));
  const detuneSpread = v.unisonDetuneCents;
  const voiceOscs: OscillatorNode[] = [];
  const voiceSrcs: AudioBufferSourceNode[] = [];

  const spawnOsc = (
    wave: BeatLabBassSynthVoiceParams['osc1Wave'],
    level: number,
    extraDetuneCents = 0,
  ) => {
    if (level <= 0.001) return;
    for (let u = 0; u < unisonN; u += 1) {
      const o = ctx.createOscillator();
      o.type = toOscType(wave);
      setOscFrequency(
        o,
        opts.midi,
        when,
        glideSec,
        fromMidi,
        v,
        opts.bpm ?? 120,
        opts.lane,
        noteEnd,
        markerGrid,
        opts.keyRoot,
        opts.keyMode,
        slideBarEnabled,
      );
      const spread =
        unisonN > 1 ? (u - (unisonN - 1) / 2) * (detuneSpread / Math.max(1, unisonN - 1)) : 0;
      const cents = spread + extraDetuneCents;
      if (Math.abs(cents) > 0.01) o.detune.setValueAtTime(cents, when);
      const g = ctx.createGain();
      g.gain.setValueAtTime((level * peak) / unisonN, when);
      o.connect(g);
      g.connect(oscMix);
      voiceOscs.push(o);
      o.start(when);
      o.stop(noteEnd + rel + 0.02);
    }
  };

  spawnOsc(v.osc1Wave, v.osc1Level);
  spawnOsc(v.osc2Wave, v.osc2Level, 4);

  if (v.subLevel > 0.01) {
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    setOscFrequency(
      sub,
      opts.midi - 12,
      when,
      glideSec,
      fromMidi != null ? fromMidi - 12 : undefined,
      v,
      opts.bpm ?? 120,
      opts.lane,
      noteEnd,
      markerGrid,
      opts.keyRoot,
      opts.keyMode,
      slideBarEnabled,
    );
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(v.subLevel * peak * 0.95, when);
    sub.connect(sg);
    sg.connect(oscMix);
    voiceOscs.push(sub);
    sub.start(when);
    sub.stop(noteEnd + rel + 0.02);
  }

  if (v.noiseLevel > 0.004) {
    const len = Math.ceil(ctx.sampleRate * 0.25);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0)!;
    for (let i = 0; i < len; i += 1) d[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(v.noiseLevel * peak * 0.28, when);
    noise.connect(ng);
    ng.connect(oscMix);
    voiceSrcs.push(noise);
    noise.start(when);
    noise.stop(noteEnd + rel + 0.02);
  }

  if (v.chorusMix > 0.02) {
    const chorusDelay = ctx.createDelay(0.08);
    chorusDelay.delayTime.setValueAtTime(0.012 + v.chorusSpread * 0.028, when);
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(Math.max(0.05, v.chorusRateHz), when);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(0.0015 + v.chorusSpread * 0.004, when);
    lfo.connect(lfoGain);
    lfoGain.connect(chorusDelay.delayTime);
    const wet = ctx.createGain();
    wet.gain.setValueAtTime(v.chorusMix * peak * 0.45, when);
    comp.connect(chorusDelay);
    chorusDelay.connect(wet);
    wet.connect(panner);
    lfo.start(when);
    lfo.stop(noteEnd + rel + 0.1);
  }

  if (v.delayMix > 0.02) {
    const dly = ctx.createDelay(4);
    const t = Math.max(0.03, Math.min(1.8, v.delayTimeMs / 1000));
    dly.delayTime.setValueAtTime(t, when);
    const fb = ctx.createGain();
    fb.gain.setValueAtTime(Math.min(0.9, v.delayFeedback), when);
    const wet = ctx.createGain();
    wet.gain.setValueAtTime(v.delayMix * peak * 0.55, when);
    comp.connect(dly);
    dly.connect(fb);
    fb.connect(dly);
    dly.connect(wet);
    wet.connect(panner);
  }

  if (v.reverbMix > 0.02) {
    const revDelay = ctx.createDelay(0.6);
    revDelay.delayTime.setValueAtTime(0.03 + v.reverbPreDelayMs / 1000, when);
    const revFb = ctx.createGain();
    revFb.gain.setValueAtTime(0.25 + v.reverbDecay * 0.55, when);
    const wet = ctx.createGain();
    wet.gain.setValueAtTime(v.reverbMix * peak * 0.42, when);
    comp.connect(revDelay);
    revDelay.connect(revFb);
    revFb.connect(revDelay);
    revDelay.connect(wet);
    wet.connect(panner);
  }

  if (v.phaserMix > 0.02) {
    const ap = ctx.createBiquadFilter();
    ap.type = 'allpass';
    ap.frequency.setValueAtTime(600 + v.phaserDepth * 2200, when);
    ap.Q.setValueAtTime(1.2, when);
    const lfo = ctx.createOscillator();
    lfo.frequency.setValueAtTime(Math.max(0.04, v.phaserRateHz), when);
    const lfoG = ctx.createGain();
    lfoG.gain.setValueAtTime(400 + v.phaserDepth * 1200, when);
    lfo.connect(lfoG);
    lfoG.connect(ap.frequency);
    const wet = ctx.createGain();
    wet.gain.setValueAtTime(v.phaserMix * peak * 0.35, when);
    comp.connect(ap);
    ap.connect(wet);
    wet.connect(panner);
    lfo.start(when);
    lfo.stop(noteEnd + rel + 0.1);
  }

  if (v.flangerMix > 0.02) {
    const fl = ctx.createDelay(0.02);
    fl.delayTime.setValueAtTime(0.002 + v.flangerFeedback * 0.008, when);
    const fb = ctx.createGain();
    fb.gain.setValueAtTime(-0.6 - v.flangerFeedback * 0.35, when);
    const wet = ctx.createGain();
    wet.gain.setValueAtTime(v.flangerMix * peak * 0.38, when);
    comp.connect(fl);
    fl.connect(fb);
    fb.connect(fl);
    fl.connect(wet);
    wet.connect(panner);
  }

  attachSynthV2MeterTap(
    ctx,
    dryBus,
    ch,
    panSigned,
    when,
    noteEnd + rel + fxTailEstimateSec(v),
  );

  const stopTransportVoice = () => {
    beatLabSynthV2TransportStoppers.delete(stopTransportVoice);
    const t = ctx.currentTime;
    for (const o of voiceOscs) {
      try {
        o.stop(t);
        o.disconnect();
      } catch {
        /* */
      }
    }
    for (const s of voiceSrcs) {
      try {
        s.stop(t);
        s.disconnect();
      } catch {
        /* */
      }
    }
    try {
      amp.gain.cancelScheduledValues(t);
      amp.gain.setValueAtTime(0.0001, t);
      dryBus.gain.cancelScheduledValues(t);
      dryBus.gain.setValueAtTime(0, t);
    } catch {
      /* */
    }
  };
  beatLabSynthV2TransportStoppers.add(stopTransportVoice);
}

export function previewBeatLabSynthV2Note(
  ctx: AudioContext,
  opts: Omit<BeatLabSynthV2PlayOpts, 'durationSec'> & { durationSec?: number },
): void {
  scheduleBeatLabSynthV2Note(ctx, {
    ...opts,
    durationSec: opts.durationSec ?? 0.55,
  });
}

// ─── Held audition (sustained note + live filter/EQ/drive tweaks) ───────────

type HeldOpts = Omit<BeatLabSynthV2PlayOpts, 'durationSec' | 'when'> & { when?: number };

type HeldRuntime = {
  ctx: AudioContext;
  lane: number;
  midi: number;
  oscillators: OscillatorNode[];
  oscGains: GainNode[];
  noiseSrc?: AudioBufferSourceNode;
  filter: BiquadFilterNode;
  shaper: WaveShaperNode | null;
  amp: GainNode;
  eqLow: BiquadFilterNode;
  eqMid: BiquadFilterNode;
  eqHigh: BiquadFilterNode;
  comp: DynamicsCompressorNode;
  panner: StereoPannerNode;
  dryBus: GainNode;
  oscSig: string;
};

const heldByLane = new Map<number, HeldRuntime>();
/** Vital-style live keyboard (sustain until release, drag = glide). */
const keyboardByLane = new Map<number, HeldRuntime>();

function voiceOscSignature(v: BeatLabBassSynthVoiceParams): string {
  return `${v.osc1Wave}|${v.osc2Wave}|${v.unisonVoices}|${v.unisonDetuneCents}`;
}

function applyVoiceToHeldNodes(rt: HeldRuntime, v: BeatLabBassSynthVoiceParams, t: number): void {
  rt.filter.type = v.filterType;
  rt.filter.frequency.setTargetAtTime(Math.max(40, Math.min(16000, v.filterCutoffHz)), t, 0.018);
  rt.filter.Q.setTargetAtTime(Math.max(0.15, Math.min(16, v.filterResonanceQ)), t, 0.018);
  if (rt.shaper) {
    const driveAmt = Math.max(0, Math.min(1, v.filterDrive * 0.65 + v.distortion * 0.85));
    rt.shaper.curve = makeDistortionCurve(driveAmt);
  }
  rt.eqLow.gain.setTargetAtTime(v.eqLowDb, t, 0.02);
  rt.eqMid.gain.setTargetAtTime(v.eqMidDb, t, 0.02);
  rt.eqHigh.gain.setTargetAtTime(v.eqHighDb, t, 0.02);
  rt.comp.threshold.setTargetAtTime(-28 + (1 - v.compressor) * 22, t, 0.03);
  rt.comp.ratio.setTargetAtTime(2 + v.compressor * 8, t, 0.03);
}

function stopHeldOscillators(rt: HeldRuntime, when: number): void {
  for (const o of rt.oscillators) {
    try {
      o.stop(when);
    } catch {
      /* already stopped */
    }
  }
  rt.oscillators = [];
  rt.oscGains = [];
  if (rt.noiseSrc) {
    try {
      rt.noiseSrc.stop(when);
    } catch {
      /* */
    }
    rt.noiseSrc = undefined;
  }
}

function glideSecForKeyboard(
  v: BeatLabBassSynthVoiceParams,
  fromMidi?: number,
  toMidi?: number,
  bpm = 120,
): number {
  if (fromMidi == null || toMidi == null || fromMidi === toMidi) return 0;
  return beatLabSynthV2GlideSeconds(v, bpm);
}

function spawnHeldOscillators(
  rt: HeldRuntime,
  v: BeatLabBassSynthVoiceParams,
  midi: number,
  when: number,
  peak: number,
  glideFromMidi?: number,
  bpm = 120,
): void {
  stopHeldOscillators(rt, when);
  const glideSec = glideSecForKeyboard(v, glideFromMidi, midi, bpm);
  const unisonN = Math.max(1, Math.min(6, Math.round(v.unisonVoices)));
  const detuneSpread = v.unisonDetuneCents;

  const addOsc = (wave: BeatLabBassSynthVoiceParams['osc1Wave'], level: number, extra = 0) => {
    if (level <= 0.001) return;
    for (let u = 0; u < unisonN; u += 1) {
      const o = rt.ctx.createOscillator();
      o.type = toOscType(wave);
      setOscFrequency(o, midi, when, glideSec, glideFromMidi, v, bpm, rt.lane, when + 8);
      const spread =
        unisonN > 1 ? (u - (unisonN - 1) / 2) * (detuneSpread / Math.max(1, unisonN - 1)) : 0;
      const cents = spread + extra;
      if (Math.abs(cents) > 0.01) o.detune.setValueAtTime(cents, when);
      const g = rt.ctx.createGain();
      g.gain.setValueAtTime((level * peak) / unisonN, when);
      o.connect(g);
      g.connect(rt.filter);
      o.start(when);
      rt.oscillators.push(o);
      rt.oscGains.push(g);
    }
  };

  addOsc(v.osc1Wave, v.osc1Level);
  addOsc(v.osc2Wave, v.osc2Level, 4);

  if (v.subLevel > 0.01) {
    const sub = rt.ctx.createOscillator();
    sub.type = 'sine';
    setOscFrequency(
      sub,
      midi - 12,
      when,
      glideSec,
      glideFromMidi != null ? glideFromMidi - 12 : undefined,
      v,
      bpm,
      rt.lane,
      when + 8,
    );
    const sg = rt.ctx.createGain();
    sg.gain.setValueAtTime(v.subLevel * peak * 0.95, when);
    sub.connect(sg);
    sg.connect(rt.filter);
    sub.start(when);
    rt.oscillators.push(sub);
    rt.oscGains.push(sg);
  }

  if (v.noiseLevel > 0.004) {
    const len = Math.ceil(rt.ctx.sampleRate * 0.25);
    const buf = rt.ctx.createBuffer(1, len, rt.ctx.sampleRate);
    const d = buf.getChannelData(0)!;
    for (let i = 0; i < len; i += 1) d[i] = Math.random() * 2 - 1;
    const noise = rt.ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const ng = rt.ctx.createGain();
    ng.gain.setValueAtTime(v.noiseLevel * peak * 0.28, when);
    noise.connect(ng);
    ng.connect(rt.filter);
    noise.start(when);
    rt.noiseSrc = noise;
  }

  if (glideSec > 0.001 && glideFromMidi != null && glideFromMidi !== midi) {
    emitBeatLabSynthV2GlidePulse({
      lane: rt.lane,
      fromMidi: glideFromMidi,
      toMidi: midi,
      durationSec: glideSec,
    });
  }
}

function rebuildHeldVoice(rt: HeldRuntime, v: BeatLabBassSynthVoiceParams, opts: HeldOpts): void {
  const when = rt.ctx.currentTime + 0.002;
  const volGain = channelVolumeGain(beatLabMelodicMixerChannel(opts.lane), opts.channelVolumes);
  const peak = beatLabSynthV2Peak(opts.velocity, volGain, v);
  spawnHeldOscillators(rt, v, opts.midi, when, peak);
  rt.oscSig = voiceOscSignature(v);
  rt.midi = opts.midi;
  applyVoiceToHeldNodes(rt, v, when);
}

function stopLiveVoiceOnMap(map: Map<number, HeldRuntime>, lane: number): void {
  const rt = map.get(lane);
  if (!rt) return;
  const t = rt.ctx.currentTime;
  const rel = Math.max(0.05, 0.1);
  rt.amp.gain.cancelScheduledValues(t);
  rt.amp.gain.setValueAtTime(Math.max(rt.amp.gain.value, 0.0001), t);
  rt.amp.gain.exponentialRampToValueAtTime(0.0001, t + rel);
  stopHeldOscillators(rt, t + rel + 0.04);
  map.delete(lane);
}

function beginLiveVoice(
  ctx: AudioContext,
  opts: HeldOpts,
  target: Map<number, HeldRuntime>,
  glideFromMidi?: number,
  immediate = false,
): void {
  const when = scheduleTime(ctx, opts.when ?? ctx.currentTime, immediate);
  const v = opts.voice;
  const ch = beatLabMelodicMixerChannel(opts.lane);
  const panSigned = channelPan(ch);
  const volGain = channelVolumeGain(ch, opts.channelVolumes);
  const peak = beatLabSynthV2Peak(opts.velocity, volGain, v);
  const atk = Math.max(0.001, v.ampAttackMs / 1000);
  const dec = Math.max(0.004, v.ampDecayMs / 1000);
  const susLvl = Math.max(0.0002, Math.min(1, v.ampSustain) * peak);

  const panner = ctx.createStereoPanner();
  panner.pan.setValueAtTime(panSigned, when);
  panner.connect(masterDestination(ctx));

  const dryBus = ctx.createGain();
  dryBus.gain.setValueAtTime(1, when);
  dryBus.connect(panner);

  const comp = ctx.createDynamicsCompressor();
  comp.connect(dryBus);

  const eqHigh = ctx.createBiquadFilter();
  eqHigh.type = 'highshelf';
  eqHigh.frequency.setValueAtTime(4200, when);
  eqHigh.gain.setValueAtTime(v.eqHighDb, when);

  const eqMid = ctx.createBiquadFilter();
  eqMid.type = 'peaking';
  eqMid.frequency.setValueAtTime(880, when);
  eqMid.Q.setValueAtTime(0.85, when);
  eqMid.gain.setValueAtTime(v.eqMidDb, when);

  const eqLow = ctx.createBiquadFilter();
  eqLow.type = 'lowshelf';
  eqLow.frequency.setValueAtTime(140, when);
  eqLow.gain.setValueAtTime(v.eqLowDb, when);
  eqLow.connect(eqMid);
  eqMid.connect(eqHigh);
  eqHigh.connect(comp);

  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.0001, when);
  amp.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0003), when + atk);
  if (Math.abs(susLvl - peak) > 0.0001) {
    amp.gain.exponentialRampToValueAtTime(Math.max(susLvl, 0.0003), when + atk + dec);
  }

  const filter = ctx.createBiquadFilter();
  filter.type = v.filterType;
  filter.frequency.setValueAtTime(Math.max(40, Math.min(16000, v.filterCutoffHz)), when);
  filter.Q.setValueAtTime(Math.max(0.15, Math.min(16, v.filterResonanceQ)), when);

  const driveAmt = Math.max(0, Math.min(1, v.filterDrive * 0.65 + v.distortion * 0.85));
  let shaper: WaveShaperNode | null = null;
  if (driveAmt > 0.03) {
    shaper = ctx.createWaveShaper();
    shaper.curve = makeDistortionCurve(driveAmt);
    shaper.oversample = '2x';
    filter.connect(shaper);
    shaper.connect(amp);
  } else {
    filter.connect(amp);
  }
  amp.connect(eqLow);

  const rt: HeldRuntime = {
    ctx,
    lane: opts.lane,
    midi: opts.midi,
    oscillators: [],
    oscGains: [],
    filter,
    shaper,
    amp,
    eqLow,
    eqMid,
    eqHigh,
    comp,
    panner,
    dryBus,
    oscSig: voiceOscSignature(v),
  };

  spawnHeldOscillators(rt, v, opts.midi, when, peak, glideFromMidi, opts.bpm ?? 120);
  applyVoiceToHeldNodes(rt, v, when);
  target.set(opts.lane, rt);
  attachSynthV2MeterTap(ctx, dryBus, ch, panSigned, when, when + 180);
}

/** Sustained preview for Audition mode — call stopBeatLabSynthV2HeldPreview to release. */
export function startBeatLabSynthV2HeldPreview(ctx: AudioContext, opts: HeldOpts): void {
  releaseBeatLabSynthV2Keyboard(opts.lane);
  stopLiveVoiceOnMap(heldByLane, opts.lane);
  beginLiveVoice(ctx, opts, heldByLane);
}

export function updateBeatLabSynthV2HeldPreview(
  lane: number,
  voice: BeatLabBassSynthVoiceParams,
): void {
  const rt = heldByLane.get(lane);
  if (!rt) return;
  const sig = voiceOscSignature(voice);
  if (sig !== rt.oscSig) {
    rebuildHeldVoice(rt, voice, {
      lane,
      midi: rt.midi,
      velocity: 100,
      channelVolumes: {},
      voice,
    });
    return;
  }
  applyVoiceToHeldNodes(rt, voice, rt.ctx.currentTime);
}

export function stopBeatLabSynthV2HeldPreview(lane: number): void {
  stopLiveVoiceOnMap(heldByLane, lane);
}

/** Vital-style keyboard: sustain + glide while dragging across piano keys. */
export function playBeatLabSynthV2KeyboardNote(ctx: AudioContext, opts: HeldOpts): void {
  stopLiveVoiceOnMap(heldByLane, opts.lane);
  const existing = keyboardByLane.get(opts.lane);
  const prevMidi = existing?.midi;
  const glideFrom = prevMidi != null && prevMidi !== opts.midi ? prevMidi : undefined;
  const sig = voiceOscSignature(opts.voice);

  if (existing && glideFrom != null && existing.oscSig === sig) {
    const when = ctx.currentTime;
    const ch = beatLabMelodicMixerChannel(opts.lane);
    const volGain = channelVolumeGain(ch, opts.channelVolumes);
    const peak = beatLabSynthV2Peak(opts.velocity, volGain, v);
    stopHeldOscillators(existing, when);
    spawnHeldOscillators(existing, opts.voice, opts.midi, when, peak, glideFrom, opts.bpm ?? 120);
    existing.midi = opts.midi;
    applyVoiceToHeldNodes(existing, opts.voice, when);
    return;
  }

  stopLiveVoiceOnMap(keyboardByLane, opts.lane);
  beginLiveVoice(ctx, { ...opts, when: ctx.currentTime }, keyboardByLane, glideFrom, true);
}

export function releaseBeatLabSynthV2Keyboard(lane: number): void {
  stopLiveVoiceOnMap(keyboardByLane, lane);
}

export function isBeatLabSynthV2KeyboardActive(lane: number): boolean {
  return keyboardByLane.has(lane);
}

export function isBeatLabSynthV2HeldPreviewActive(lane: number): boolean {
  return heldByLane.has(lane);
}

/** Start held preview if idle; otherwise refresh filter/EQ/drive from the voice. */
export function touchBeatLabSynthV2HeldPreview(ctx: AudioContext, opts: HeldOpts): void {
  if (heldByLane.has(opts.lane)) {
    updateBeatLabSynthV2HeldPreview(opts.lane, opts.voice);
    return;
  }
  startBeatLabSynthV2HeldPreview(ctx, opts);
}
