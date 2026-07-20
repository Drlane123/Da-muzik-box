/**
 * Studio Editor 2 — pro multiband vocoder (modulator × carrier per band).
 * True envelope-follower chain — not preset phoneme gating.
 */
import type { VocalBoxPersonality, VocalBoxSpeechStyle } from '@/app/lib/creationStation/grooveLabVocalBoxSpeech';
import { estimateSpeechPitchHzRange } from '@/app/lib/creationStation/grooveLabVocalBoxTtsBuffer';
import type { StudioVocoderPresetId } from '@/app/lib/studio/studioVocoderPresets';
import { studioVocoderPresetById } from '@/app/lib/studio/studioVocoderPresets';
import type { StudioVocoderCarrierEvent } from '@/app/lib/studio/studioVocoderCarrier';
import {
  extractStudioVocoderBandEnvelopesAsync,
  scheduleStudioVocoderGainEnvelope,
  studioVocoderCompandEnvelope,
  studioVocoderShapeEnvelope,
  studioVocoderEnvelopeFrameDurSec,
} from '@/app/lib/studio/studioVocoderAnalyze';
import {
  attachStudioLiveVocalEnergyGate,
  type StudioLiveVocalEnergyGate,
} from '@/app/lib/studio/studioLiveVocalEnergyGate';

/** Sixteen-band vocoder layout (classic pro spacing). */
export const STUDIO_VOCODER_BANDS_HZ = [
  100, 150, 220, 320, 470, 680, 980, 1400, 2000, 2800, 3800, 5000, 6400, 8000, 10000, 12000,
] as const;

export type StudioVocoderParams = {
  wet: number;
  dry: number;
  robot: number;
  vibratoDepth: number;
  style: VocalBoxSpeechStyle;
  personality: VocalBoxPersonality;
  /** Carrier root Hz — from detected vocal pitch or MIDI timeline */
  carrierHz: number;
  /** When set, carrier pitch follows MIDI lane notes over clip time */
  carrierTimeline?: readonly StudioVocoderCarrierEvent[];
  /** Formant shift in semitones */
  formantSemis: number;
  /** Envelope attack ms */
  attackMs: number;
  /** Envelope release ms */
  releaseMs: number;
  /** Unvoiced / consonant noise blend */
  unvoiced: number;
  /** 0 = warm (low bands) · 1 = bright (high bands) */
  bandFocus: number;
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function midiToHz(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

function hzToMidi(hz: number): number {
  return 69 + 12 * Math.log2(Math.max(1, hz) / 440);
}

const rectifierCache = new WeakMap<BaseAudioContext, Float32Array>();

function absRectifierCurve(ctx: BaseAudioContext): Float32Array {
  let c = rectifierCache.get(ctx);
  if (c) return c;
  c = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = (i / 255) * 2 - 1;
    c[i] = Math.abs(x);
  }
  rectifierCache.set(ctx, c);
  return c;
}

type VocoderCharacterCoeffs = {
  sqGainBase: number;
  sqGainRobot: number;
  sawGain: number;
  detuneBase: number;
  detuneRobot: number;
  bandQBase: number;
  bandQRobot: number;
  driveBase: number;
  driveRobot: number;
  vibRateHz: number;
  vibDepthMul: number;
  carrierGainMul: number;
};

function coeffsForPersonality(personality: VocalBoxPersonality): VocoderCharacterCoeffs {
  switch (personality) {
    case 'zapp':
      return { sqGainBase: 0.38, sqGainRobot: 0.32, sawGain: 0.48, detuneBase: 14, detuneRobot: 26, bandQBase: 5.2, bandQRobot: 2.8, driveBase: 2.4, driveRobot: 2.8, vibRateHz: 6.4, vibDepthMul: 1.45, carrierGainMul: 0.68 };
    case 'transform':
      return { sqGainBase: 0.48, sqGainRobot: 0.38, sawGain: 0.42, detuneBase: 20, detuneRobot: 34, bandQBase: 6, bandQRobot: 4, driveBase: 3, driveRobot: 3.5, vibRateHz: 4.2, vibDepthMul: 0.85, carrierGainMul: 0.75 };
    case 'talkbox':
      return { sqGainBase: 0.28, sqGainRobot: 0.22, sawGain: 0.62, detuneBase: 8, detuneRobot: 12, bandQBase: 4.2, bandQRobot: 2, driveBase: 1.8, driveRobot: 1.5, vibRateHz: 5.6, vibDepthMul: 1.2, carrierGainMul: 0.58 };
    case 'cyber':
      return { sqGainBase: 0.52, sqGainRobot: 0.35, sawGain: 0.38, detuneBase: 22, detuneRobot: 28, bandQBase: 7, bandQRobot: 5, driveBase: 3.2, driveRobot: 4, vibRateHz: 3.5, vibDepthMul: 0.5, carrierGainMul: 0.82 };
    case 'warm':
      return { sqGainBase: 0.22, sqGainRobot: 0.18, sawGain: 0.68, detuneBase: 6, detuneRobot: 10, bandQBase: 3.8, bandQRobot: 1.5, driveBase: 1.5, driveRobot: 1.2, vibRateHz: 5.2, vibDepthMul: 1.1, carrierGainMul: 0.5 };
    default:
      return { sqGainBase: 0.42, sqGainRobot: 0.28, sawGain: 0.5, detuneBase: 12, detuneRobot: 20, bandQBase: 5, bandQRobot: 3, driveBase: 2.2, driveRobot: 2.5, vibRateHz: 5, vibDepthMul: 1, carrierGainMul: 0.65 };
  }
}

function formantShiftHz(hz: number, semis: number): number {
  return hz * Math.pow(2, semis / 12);
}

function bandTiltGain(bi: number, n: number, focus: number): number {
  const t = bi / Math.max(1, n - 1);
  return 0.55 + (0.45 - t * 0.9) * (1 - focus) + t * focus * 0.95;
}

function envCutoffHz(attackMs: number, releaseMs: number, robot: number): number {
  const atk = clamp(attackMs, 1, 120);
  const rel = clamp(releaseMs, 8, 320);
  const base = 900 / atk + 180 / rel;
  return clamp(base + robot * 120, 28, 220);
}

function applyCarrierHzAutomation(
  osc: OscillatorNode,
  t0: number,
  t1: number,
  baseHz: number,
  timeline: readonly StudioVocoderCarrierEvent[] | undefined,
  glideSec: number,
): void {
  const hz0 = Math.max(55, baseHz);
  if (!timeline || timeline.length === 0) {
    osc.frequency.setValueAtTime(hz0, t0);
    return;
  }
  const first = timeline[0]!;
  osc.frequency.setValueAtTime(Math.max(55, first.hz), t0);
  for (let i = 1; i < timeline.length; i++) {
    const ev = timeline[i]!;
    const when = t0 + ev.tSec;
    if (when >= t1) break;
    const target = Math.max(55, ev.hz);
    const rampEnd = Math.min(t1, when + glideSec);
    osc.frequency.linearRampToValueAtTime(target, rampEnd);
    if (rampEnd < t1 - 0.001) {
      osc.frequency.setValueAtTime(target, rampEnd);
    }
  }
}

function makeVocoderDriveCurve(driveAmt: number): Float32Array {
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = (i / 255) * 2 - 1;
    curve[i] = Math.tanh(x * driveAmt);
  }
  return curve;
}

type VocoderLiveBand = {
  modBp: BiquadFilterNode;
  carBp: BiquadFilterNode;
  envFollow: BiquadFilterNode;
  bandOut: GainNode;
  baseHz: number;
};

type VocoderLiveRuntime = {
  ctx: BaseAudioContext;
  t0: number;
  t1: number;
  vel: number;
  saw: OscillatorNode;
  square: OscillatorNode;
  sawG: GainNode;
  sqG: GainNode;
  carrierBus: GainNode;
  dryG: GainNode | null;
  drive: WaveShaperNode;
  vib: OscillatorNode;
  vibG: GainNode;
  noiseG: GainNode;
  bands: VocoderLiveBand[];
  carrierGainMul: number;
  params: StudioVocoderParams;
};

function carrierGlideSec(attackMs: number): number {
  return clamp(attackMs, 1, 80) / 1000 * 0.65 + 0.004;
}

/** Duck carrier + dry when modulator is silent — stops idle oscillator hum. */
function wireModulatorSilenceGate(
  ctx: BaseAudioContext,
  modulator: AudioNode,
  targets: GainNode[],
): void {
  if (targets.length === 0) return;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 90;
  hp.Q.value = 0.6;

  const rect = ctx.createWaveShaper();
  rect.curve = absRectifierCurve(ctx);

  const env = ctx.createBiquadFilter();
  env.type = 'lowpass';
  env.frequency.value = 12;
  env.Q.value = 0.65;

  const gateDrive = ctx.createGain();
  gateDrive.gain.value = 48;

  modulator.connect(hp);
  hp.connect(rect);
  rect.connect(env);
  env.connect(gateDrive);
  for (const target of targets) {
    gateDrive.connect(target.gain);
  }
}

function patchStudioProVocoderLiveParams(rt: VocoderLiveRuntime, params: StudioVocoderParams): void {
  rt.params = params;
  const { ctx, vel, carrierBus, dryG, sawG, sqG, square, drive, vib, vibG, noiseG, bands } = rt;
  const t = ctx.currentTime;
  const wet = clamp(params.wet, 0, 1);
  const dry = clamp(params.dry, 0, 1);
  const robot = clamp(params.robot, 0, 1);
  const formant = clamp(params.formantSemis, -12, 12);
  const unvoiced = clamp(params.unvoiced, 0, 1);
  const focus = clamp(params.bandFocus, 0, 1);
  const envCutoff = envCutoffHz(params.attackMs, params.releaseMs, robot);
  const ch = coeffsForPersonality(params.personality);

  rt.carrierGainMul = ch.carrierGainMul;
  carrierBus.gain.setTargetAtTime(vel * wet * ch.carrierGainMul, t, 0.018);
  if (dryG) dryG.gain.setTargetAtTime(vel * dry * 0.62, t, 0.018);

  square.detune.setTargetAtTime(ch.detuneBase + robot * ch.detuneRobot, t, 0.02);
  sawG.gain.setTargetAtTime(ch.sawGain, t, 0.02);
  sqG.gain.setTargetAtTime(ch.sqGainBase + robot * ch.sqGainRobot, t, 0.02);

  const vibAmt =
    params.style === 'sing' && params.vibratoDepth > 0.02
      ? params.vibratoDepth * 24 * ch.vibDepthMul
      : 0;
  vib.frequency.setTargetAtTime(ch.vibRateHz, t, 0.02);
  vibG.gain.setTargetAtTime(vibAmt, t, 0.02);

  noiseG.gain.setTargetAtTime(unvoiced > 0.04 ? unvoiced * 0.22 : 0, t, 0.02);

  const nBands = bands.length;
  const bandQ = ch.bandQBase + robot * ch.bandQRobot;
  for (let bi = 0; bi < nBands; bi++) {
    const band = bands[bi]!;
    const hz = formantShiftHz(band.baseHz, formant);
    const tilt = bandTiltGain(bi, nBands, focus);
    const isHigh = bi >= nBands * 0.55;
    band.modBp.frequency.setTargetAtTime(hz, t, 0.025);
    band.carBp.frequency.setTargetAtTime(hz, t, 0.025);
    band.modBp.Q.setTargetAtTime(bandQ * 0.85, t, 0.02);
    band.carBp.Q.setTargetAtTime(bandQ, t, 0.02);
    band.envFollow.frequency.setTargetAtTime(envCutoff, t, 0.025);
    band.bandOut.gain.setTargetAtTime(tilt * (isHigh ? 0.85 + unvoiced * 0.35 : 1), t, 0.02);
  }

  drive.curve = makeVocoderDriveCurve(ch.driveBase + robot * ch.driveRobot);
}

function patchStudioProVocoderCarrierTimeline(rt: VocoderLiveRuntime): void {
  const { ctx, saw, square, t0, t1, params } = rt;
  const t = ctx.currentTime;
  if (t >= t1 - 0.001) return;
  const glide = carrierGlideSec(params.attackMs);
  const carrierHz = Math.max(55, params.carrierHz);
  for (const osc of [saw, square]) {
    osc.frequency.cancelScheduledValues(t);
    applyCarrierHzAutomation(osc, t, t1, carrierHz, params.carrierTimeline, glide);
  }
}

/**
 * Schedule true multiband vocoder: modulator audio drives per-band envelopes × synth carrier.
 */
export type StudioProVocoderLiveHandle = {
  stop: () => void;
  setBlend: (wet: number, dry: number, vel?: number) => void;
  updateParams: (params: StudioVocoderParams) => void;
};

/** Live mic monitor — carriers run until `stop()`; never schedule start times in the past. */
const LIVE_VOCODER_SESSION_SEC = 86400;
/** Live monitor — short looping noise; never allocate `playSec` (3600s) worth of samples. */
const LIVE_VOCODER_NOISE_SEC = 2;

function connectVocoderModulatorTap(
  modulator: AudioNode,
  modBus: GainNode,
  stoppers: Array<() => void>,
): void {
  const modTap = modulator.context.createGain();
  modTap.gain.value = 1;
  modulator.connect(modTap);
  modTap.connect(modBus);
  stoppers.push(() => {
    try {
      modulator.disconnect(modTap);
    } catch {
      /* */
    }
    try {
      modTap.disconnect();
    } catch {
      /* */
    }
  });
}

export function scheduleStudioProVocoder(
  ctx: BaseAudioContext,
  dest: AudioNode,
  modulator: AudioNode,
  when: number,
  dur: number,
  params: StudioVocoderParams,
  vel = 0.9,
  liveSession = false,
): StudioProVocoderLiveHandle {
  const t0 = liveSession ? ctx.currentTime + 0.004 : when;
  const t1 = liveSession ? t0 + LIVE_VOCODER_SESSION_SEC : when + dur;
  const wet = clamp(params.wet, 0, 1);
  const dry = clamp(params.dry, 0, 1);
  const robot = clamp(params.robot, 0, 1);
  const noop: StudioProVocoderLiveHandle = {
    stop: () => {},
    setBlend: () => {},
    updateParams: () => {},
  };
  if (wet < 0.02 && dry < 0.02) return noop;

  const ch = coeffsForPersonality(params.personality);
  const stoppers: Array<() => void> = [];
  const liveEnvCutoff = liveSession ? clamp(28 + robot * 22, 24, 52) : envCutoffHz(params.attackMs, params.releaseMs, robot);
  const envCutoff = liveEnvCutoff;
  const formant = clamp(params.formantSemis, -12, 12);
  const unvoiced = clamp(params.unvoiced, 0, 1);
  const focus = clamp(params.bandFocus, 0, 1);
  const carrierHz = Math.max(55, params.carrierHz);
  const carrierGlide = carrierGlideSec(params.attackMs);

  const modBus = ctx.createGain();
  modBus.gain.value = liveSession ? 1.35 : 1;
  connectVocoderModulatorTap(modulator, modBus, stoppers);
  stoppers.push(() => {
    try {
      modBus.disconnect();
    } catch {
      /* */
    }
  });

  let dryG: GainNode | null = null;
  if (dry > 0.02) {
    dryG = ctx.createGain();
    dryG.gain.value = vel * dry * (liveSession ? 0.78 : 0.62);
    if (liveSession) {
      modBus.connect(dryG);
    } else {
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 90;
      modBus.connect(hp);
      hp.connect(dryG);
    }
    dryG.connect(dest);
  }

  if (wet < 0.03) {
    return {
      stop: () => {},
      setBlend: (_wet, d, v = vel) => {
        if (!dryG) return;
        const blend = clamp(d, 0, 1);
        dryG.gain.setTargetAtTime(v * blend * 0.62, ctx.currentTime, 0.018);
      },
      updateParams: (next) => {
        if (!dryG) return;
        const d = clamp(next.dry, 0, 1);
        dryG.gain.setTargetAtTime(vel * d * 0.62, ctx.currentTime, 0.018);
      },
    };
  }

  const saw = ctx.createOscillator();
  saw.type = 'sawtooth';
  applyCarrierHzAutomation(saw, t0, t1, carrierHz, params.carrierTimeline, carrierGlide);

  const square = ctx.createOscillator();
  square.type = 'square';
  applyCarrierHzAutomation(square, t0, t1, carrierHz, params.carrierTimeline, carrierGlide);
  square.detune.setValueAtTime(ch.detuneBase + robot * ch.detuneRobot, t0);

  const vib = ctx.createOscillator();
  const vibG = ctx.createGain();
  vib.frequency.value = ch.vibRateHz;
  vibG.gain.value =
    params.style === 'sing' && params.vibratoDepth > 0.02
      ? params.vibratoDepth * 24 * ch.vibDepthMul
      : 0;
  vib.connect(vibG);
  vibG.connect(saw.frequency);
  vibG.connect(square.frequency);
  vib.start(t0);
  vib.stop(t1 + 0.03);
  stoppers.push(() => {
    try {
      vib.stop();
    } catch {
      /* */
    }
  });

  const carrierBus = ctx.createGain();
  carrierBus.gain.value = vel * wet * ch.carrierGainMul * (liveSession ? 1.55 : 1);

  const sawG = ctx.createGain();
  sawG.gain.value = ch.sawGain;
  const sqG = ctx.createGain();
  sqG.gain.value = ch.sqGainBase + robot * ch.sqGainRobot;
  saw.connect(sawG);
  square.connect(sqG);
  sawG.connect(carrierBus);
  sqG.connect(carrierBus);

  const noise = ctx.createBufferSource();
  const noiseDurSec = liveSession ? LIVE_VOCODER_NOISE_SEC : dur + 0.08;
  const nLen = Math.max(1, Math.ceil(ctx.sampleRate * noiseDurSec));
  const nBuf = ctx.createBuffer(1, nLen, ctx.sampleRate);
  const nCh = nBuf.getChannelData(0);
  for (let i = 0; i < nLen; i++) nCh[i] = Math.random() * 2 - 1;
  noise.buffer = nBuf;
  if (liveSession) noise.loop = true;
  const noiseG = ctx.createGain();
  noiseG.gain.value = unvoiced > 0.04 ? unvoiced * 0.22 : 0;
  noise.connect(noiseG);
  noiseG.connect(carrierBus);
  noise.start(t0);
  if (!liveSession) {
    noise.stop(t1 + 0.03);
  }
  stoppers.push(() => {
    try {
      noise.stop();
    } catch {
      /* */
    }
  });

  const outEnv = ctx.createGain();
  if (liveSession) {
    outEnv.gain.setValueAtTime(1, t0);
  } else {
    outEnv.gain.setValueAtTime(0.0001, t0);
    outEnv.gain.exponentialRampToValueAtTime(1, t0 + 0.012);
  }

  const bands: VocoderLiveBand[] = [];
  const nBands = STUDIO_VOCODER_BANDS_HZ.length;
  for (let bi = 0; bi < nBands; bi++) {
    const baseHz = STUDIO_VOCODER_BANDS_HZ[bi]!;
    const hz = formantShiftHz(baseHz, formant);
    const tilt = bandTiltGain(bi, nBands, focus);
    const isHigh = bi >= nBands * 0.55;
    const bandQ = ch.bandQBase + robot * ch.bandQRobot;

    const modBp = ctx.createBiquadFilter();
    modBp.type = 'bandpass';
    modBp.frequency.value = hz;
    modBp.Q.value = bandQ * 0.85;

    const rectifier = ctx.createWaveShaper();
    rectifier.curve = absRectifierCurve(ctx);

    const envFollow = ctx.createBiquadFilter();
    envFollow.type = 'lowpass';
    envFollow.frequency.value = envCutoff;
    envFollow.Q.value = 0.65;

    const carBp = ctx.createBiquadFilter();
    carBp.type = 'bandpass';
    carBp.frequency.value = hz;
    carBp.Q.value = bandQ;

    // Live envelope drives gain via a-rate — must stay > 0 (Groove Lab vocoder uses 0.0001).
    const bandGain = ctx.createGain();
    bandGain.gain.value = 0.0001;

    modBus.connect(modBp);
    modBp.connect(rectifier);
    rectifier.connect(envFollow);

    const envBoost = ctx.createGain();
    envBoost.gain.value = liveSession ? 9 : 1;
    envFollow.connect(envBoost);
    envBoost.connect(bandGain.gain);

    carrierBus.connect(carBp);
    carBp.connect(bandGain);

    const bandOut = ctx.createGain();
    bandOut.gain.value = tilt * (isHigh ? 0.85 + unvoiced * 0.35 : 1);
    bandGain.connect(bandOut);
    bandOut.connect(outEnv);
    bands.push({ modBp, carBp, envFollow, bandOut, baseHz });
  }

  const drive = ctx.createWaveShaper();
  drive.curve = makeVocoderDriveCurve(ch.driveBase + robot * ch.driveRobot);

  const outComp = ctx.createDynamicsCompressor();
  outComp.threshold.value = liveSession ? -12 : -18;
  outComp.ratio.value = liveSession ? 2.2 : 3;
  outComp.attack.value = 0.004;
  outComp.release.value = liveSession ? 0.12 : 0.08;

  const wetTrim = ctx.createGain();
  const wetTrimFull = liveSession ? 1.45 : 1;
  wetTrim.gain.value = wetTrimFull;

  outEnv.connect(drive);
  drive.connect(outComp);
  outComp.connect(wetTrim);
  wetTrim.connect(dest);

  let liveGate: StudioLiveVocalEnergyGate | null = null;
  if (liveSession) {
    const dryFull = dryG ? vel * dry * 0.78 : 0;
    /* Wet trim already includes wetTrimFull — don't multiply carrierGainMul again (was double-attenuating). */
    const wetFull = wetTrimFull;
    const gateNodes = dryG ? [wetTrim, dryG] : [wetTrim];
    const fullGains = dryG ? [wetFull, dryFull] : [wetFull];
    liveGate = attachStudioLiveVocalEnergyGate(ctx, modBus, gateNodes, fullGains);
    stoppers.push(() => liveGate?.stop());
  }

  saw.start(t0);
  square.start(t0);
  saw.stop(t1 + 0.05);
  square.stop(t1 + 0.05);
  stoppers.push(() => {
    for (const o of [saw, square]) {
      try {
        o.stop();
      } catch {
        /* */
      }
    }
  });

  const runtime: VocoderLiveRuntime = {
    ctx,
    t0,
    t1,
    vel,
    saw,
    square,
    sawG,
    sqG,
    carrierBus,
    dryG,
    drive,
    vib,
    vibG,
    noiseG,
    bands,
    carrierGainMul: ch.carrierGainMul,
    params: { ...params },
  };

  return {
    stop: () => {
      for (const fn of stoppers) fn();
    },
    setBlend: (nextWet, nextDry, v = vel) => {
      const w = clamp(nextWet, 0, 1);
      const d = clamp(nextDry, 0, 1);
      runtime.params = { ...runtime.params, wet: w, dry: d };
      carrierBus.gain.setTargetAtTime(v * w * runtime.carrierGainMul, ctx.currentTime, 0.018);
      if (liveGate) {
        liveGate.setGains(
          dryG
            ? [v * w * runtime.carrierGainMul * wetTrimFull, v * d * 0.78]
            : [v * w * runtime.carrierGainMul * wetTrimFull],
        );
      } else if (dryG) {
        dryG.gain.setTargetAtTime(v * d * 0.62, ctx.currentTime, 0.018);
      }
    },
    updateParams: (next) => {
      const prevTimeline = runtime.params.carrierTimeline;
      const prevCarrierHz = runtime.params.carrierHz;
      patchStudioProVocoderLiveParams(runtime, next);
      if (liveGate) {
        const w = clamp(next.wet, 0, 1);
        const d = clamp(next.dry, 0, 1);
        liveGate.setGains(
          dryG
            ? [vel * w * runtime.carrierGainMul * wetTrimFull, vel * d * 0.78]
            : [vel * w * runtime.carrierGainMul * wetTrimFull],
        );
      }
      const nextTimeline = next.carrierTimeline;
      const timelineChanged =
        prevTimeline !== nextTimeline &&
        (prevTimeline?.length !== nextTimeline?.length ||
          prevTimeline?.some((ev, i) => ev.hz !== nextTimeline?.[i]?.hz || ev.tSec !== nextTimeline?.[i]?.tSec));
      if (timelineChanged || Math.abs(prevCarrierHz - next.carrierHz) > 0.5) {
        patchStudioProVocoderCarrierTimeline(runtime);
      }
    },
  };
}

/** Pro offline vocoder — pre-analyzed per-band modulator envelopes (ATK/REL/companding). */
export function scheduleStudioProVocoderFromEnvelopes(
  ctx: BaseAudioContext,
  dest: AudioNode,
  when: number,
  dur: number,
  params: StudioVocoderParams,
  bandEnvelopes: readonly Float32Array[],
  vel = 0.9,
): () => void {
  const t0 = when;
  const t1 = when + dur;
  const wet = clamp(params.wet, 0, 1);
  const robot = clamp(params.robot, 0, 1);
  if (wet < 0.03) return () => {};

  const ch = coeffsForPersonality(params.personality);
  const stoppers: Array<() => void> = [];
  const formant = clamp(params.formantSemis, -12, 12);
  const unvoiced = clamp(params.unvoiced, 0, 1);
  const focus = clamp(params.bandFocus, 0, 1);
  const carrierHz = Math.max(55, params.carrierHz);
  const carrierGlide = clamp(params.attackMs, 1, 80) / 1000 * 0.65 + 0.004;

  const saw = ctx.createOscillator();
  saw.type = 'sawtooth';
  applyCarrierHzAutomation(saw, t0, t1, carrierHz, params.carrierTimeline, carrierGlide);

  const square = ctx.createOscillator();
  square.type = 'square';
  applyCarrierHzAutomation(square, t0, t1, carrierHz, params.carrierTimeline, carrierGlide);
  square.detune.setValueAtTime(ch.detuneBase + robot * ch.detuneRobot, t0);

  if (params.style === 'sing' && params.vibratoDepth > 0.02) {
    const vib = ctx.createOscillator();
    const vibG = ctx.createGain();
    vib.frequency.value = ch.vibRateHz;
    vibG.gain.value = params.vibratoDepth * 24 * ch.vibDepthMul;
    vib.connect(vibG);
    vibG.connect(saw.frequency);
    vibG.connect(square.frequency);
    vib.start(t0);
    vib.stop(t1 + 0.03);
    stoppers.push(() => {
      try {
        vib.stop();
      } catch {
        /* */
      }
    });
  }

  const carrierBus = ctx.createGain();
  carrierBus.gain.value = vel * wet * ch.carrierGainMul;

  const sawG = ctx.createGain();
  sawG.gain.value = ch.sawGain;
  const sqG = ctx.createGain();
  sqG.gain.value = ch.sqGainBase + robot * ch.sqGainRobot;
  saw.connect(sawG);
  square.connect(sqG);
  sawG.connect(carrierBus);
  sqG.connect(carrierBus);

  if (unvoiced > 0.04) {
    const noise = ctx.createBufferSource();
    const nLen = Math.max(1, Math.ceil(ctx.sampleRate * (dur + 0.08)));
    const nBuf = ctx.createBuffer(1, nLen, ctx.sampleRate);
    const nCh = nBuf.getChannelData(0);
    for (let i = 0; i < nLen; i++) nCh[i] = Math.random() * 2 - 1;
    noise.buffer = nBuf;
    const nG = ctx.createGain();
    nG.gain.value = unvoiced * 0.22;
    noise.connect(nG);
    nG.connect(carrierBus);
    noise.start(t0);
    noise.stop(t1 + 0.03);
    stoppers.push(() => {
      try {
        noise.stop();
      } catch {
        /* */
      }
    });
  }

  const outEnv = ctx.createGain();
  outEnv.gain.setValueAtTime(0.0001, t0);
  outEnv.gain.exponentialRampToValueAtTime(1, t0 + 0.012);
  outEnv.gain.setValueAtTime(1, Math.max(t0 + 0.012, t1 - 0.05));
  outEnv.gain.exponentialRampToValueAtTime(0.0001, t1);

  const nBands = STUDIO_VOCODER_BANDS_HZ.length;
  const envScale = 0.55 + robot * 0.5;

  for (let bi = 0; bi < nBands; bi++) {
    const hz = formantShiftHz(STUDIO_VOCODER_BANDS_HZ[bi]!, formant);
    const tilt = bandTiltGain(bi, nBands, focus);
    const isHigh = bi >= nBands * 0.55;
    const bandQ = ch.bandQBase + robot * ch.bandQRobot;
    const rawEnv = bandEnvelopes[bi] ?? bandEnvelopes[0];
    if (!rawEnv) continue;

    const carBp = ctx.createBiquadFilter();
    carBp.type = 'bandpass';
    carBp.frequency.value = hz;
    carBp.Q.value = bandQ;

    const bandGain = ctx.createGain();
    bandGain.gain.value = 0.0001;
    scheduleStudioVocoderGainEnvelope(
      bandGain.gain,
      t0,
      dur,
      rawEnv,
      envScale * tilt * (isHigh ? 0.85 + unvoiced * 0.35 : 1),
    );

    carrierBus.connect(carBp);
    carBp.connect(bandGain);
    bandGain.connect(outEnv);
  }

  const drive = ctx.createWaveShaper();
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = (i / 255) * 2 - 1;
    curve[i] = Math.tanh(x * (ch.driveBase + robot * ch.driveRobot));
  }
  drive.curve = curve;

  const outComp = ctx.createDynamicsCompressor();
  outComp.threshold.value = -18;
  outComp.ratio.value = 3;
  outComp.attack.value = 0.004;
  outComp.release.value = 0.08;

  outEnv.connect(drive);
  drive.connect(outComp);
  outComp.connect(dest);

  saw.start(t0);
  square.start(t0);
  saw.stop(t1 + 0.03);
  square.stop(t1 + 0.03);
  stoppers.push(() => {
    for (const o of [saw, square]) {
      try {
        o.stop();
      } catch {
        /* */
      }
    }
  });

  return () => {
    for (const fn of stoppers) fn();
  };
}

export function studioVocoderParamsFromTrackFx(
  fx: {
    vocoderWet: number;
    vocoderRobot: number;
    vocoderPreset: StudioVocoderPresetId;
    vibratoDepth: number;
    vocoderFormantSemis: number;
    vocoderAttackMs: number;
    vocoderReleaseMs: number;
    vocoderUnvoiced: number;
    vocoderBandFocus: number;
  },
  source: AudioBuffer,
  opts?: { carrierTimeline?: readonly StudioVocoderCarrierEvent[] },
): StudioVocoderParams {
  const preset = studioVocoderPresetById(fx.vocoderPreset);
  const wet = clamp(fx.vocoderWet, 0, 1);
  const srcPitch = estimateSpeechPitchHzRange(source, 0, source.duration);
  const carrierHz = srcPitch > 40 ? srcPitch : midiToHz(60);
  return {
    wet,
    dry: Math.max(0, 1 - wet),
    robot: clamp(fx.vocoderRobot, 0, 1),
    vibratoDepth: clamp(fx.vibratoDepth, 0, 1),
    style: preset.style,
    personality: preset.personality,
    carrierHz,
    carrierTimeline: opts?.carrierTimeline,
    formantSemis: fx.vocoderFormantSemis,
    attackMs: fx.vocoderAttackMs,
    releaseMs: fx.vocoderReleaseMs,
    unvoiced: fx.vocoderUnvoiced,
    bandFocus: fx.vocoderBandFocus,
  };
}

export async function renderStudioVocoderBuffer(
  source: AudioBuffer,
  params: StudioVocoderParams,
): Promise<AudioBuffer> {
  /* Let the toggle / UI paint before heavy offline DSP. */
  await new Promise<void>((r) => setTimeout(r, 0));

  const dur = Math.max(0.04, source.duration);
  const frames = Math.ceil((dur + 0.15) * source.sampleRate);
  const offline = new OfflineAudioContext(
    source.numberOfChannels,
    Math.max(1, frames),
    source.sampleRate,
  );

  const frameDur = studioVocoderEnvelopeFrameDurSec(source);
  const compand = clamp(0.35 + params.robot * 0.45 + params.unvoiced * 0.2, 0, 1);
  const rawEnvelopes = await extractStudioVocoderBandEnvelopesAsync(source);
  const bandEnvelopes = rawEnvelopes.map((env) => {
    const companded = studioVocoderCompandEnvelope(env, compand);
    return studioVocoderShapeEnvelope(companded, frameDur, params.attackMs, params.releaseMs);
  });

  const wetMix = offline.createGain();
  wetMix.gain.value = 1;
  wetMix.connect(offline.destination);

  const dryAmt = clamp(params.dry, 0, 1);
  if (dryAmt > 0.02) {
    const dryMix = offline.createGain();
    dryMix.gain.value = dryAmt * 0.62;
    dryMix.connect(offline.destination);
    const drySrc = offline.createBufferSource();
    drySrc.buffer = source;
    drySrc.connect(dryMix);
    drySrc.start(0);
    drySrc.stop(dur + 0.02);
  }

  scheduleStudioProVocoderFromEnvelopes(
    offline as unknown as BaseAudioContext,
    wetMix,
    0,
    dur,
    params,
    bandEnvelopes,
    0.92,
  );

  const rendered = await offline.startRendering();
  if (rendered.duration < dur * 0.4) return source;
  return rendered;
}

export function studioVocoderCarrierMidi(source: AudioBuffer): number {
  const hz = estimateSpeechPitchHzRange(source, 0, source.duration);
  return Math.round(hzToMidi(hz > 40 ? hz : 220));
}
