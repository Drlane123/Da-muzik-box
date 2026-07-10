/**
 * VocalBox FX — FL Speech Synth / T-Pain chain:
 * speech (modulator) → pitch snap → multiband vocoder @ MIDI pitch + auto-tune buzz.
 */
import {
  envelopeFrameDurationSec,
  extractSpeechBandEnvelopesRange,
  extractSpeechRmsEnvelopeRange,
  scheduleGainEnvelope,
} from '@/app/lib/creationStation/grooveLabVocalBoxAnalyze';
import type { VocalBoxSettings } from '@/app/lib/creationStation/grooveLabVocalBoxEngine';
import { estimateSpeechPitchHzRange } from '@/app/lib/creationStation/grooveLabVocalBoxTtsBuffer';
import { VOCALBOX_VOCODER_BANDS_HZ } from '@/app/lib/creationStation/grooveLabVocalBoxVocoder';

export type VocalBoxProcessedSpeechOpts = {
  /** Play from this offset in the buffer (mic phrase mode). */
  offsetSec?: number;
  sliceSec?: number;
  micMode?: boolean;
};

export type VocalBoxPhraseNoteWindow = {
  when: number;
  dur: number;
  midi: number;
  vel: number;
  /** Envelope slice inside the phrase buffer (one syllable / word region). */
  envStartSec: number;
  envEndSec: number;
};

function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
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

function resolveVocoderMixes(
  settings: VocalBoxSettings,
  vel: number,
  robot: number,
  tune: number,
  micMode: boolean,
): { vocoderMix: number; dryAmt: number } {
  if (settings.vocoderWet != null) {
    const wet = clamp(settings.vocoderWet, 0, 1);
    const dryAmt =
      settings.dryMix != null
        ? vel * clamp(settings.dryMix, 0, 1) * 0.45
        : vel * Math.max(0, 1 - wet) * 0.4;
    return { vocoderMix: wet, dryAmt };
  }
  const vocoderMix = micMode
    ? 0.58 + robot * 0.38 + tune * 0.18
    : 0.42 + robot * 0.52 + tune * 0.12;
  const dryAmt = micMode
    ? vel * (0.08 + (1 - robot) * 0.1)
    : vel * (0.28 * (1 - robot * 0.75) + 0.06);
  return { vocoderMix, dryAmt };
}

function vocoderCoeffsForPersonality(personality: VocalBoxSettings['personality']): VocoderCharacterCoeffs {
  switch (personality) {
    case 'zapp':
      return {
        sqGainBase: 0.38,
        sqGainRobot: 0.32,
        sawGain: 0.48,
        detuneBase: 14,
        detuneRobot: 26,
        bandQBase: 5.2,
        bandQRobot: 2.8,
        driveBase: 2.4,
        driveRobot: 2.8,
        vibRateHz: 6.4,
        vibDepthMul: 1.45,
        carrierGainMul: 0.68,
      };
    case 'transform':
      return {
        sqGainBase: 0.48,
        sqGainRobot: 0.38,
        sawGain: 0.42,
        detuneBase: 20,
        detuneRobot: 34,
        bandQBase: 6,
        bandQRobot: 4,
        driveBase: 3,
        driveRobot: 3.5,
        vibRateHz: 4.2,
        vibDepthMul: 0.85,
        carrierGainMul: 0.75,
      };
    case 'talkbox':
      return {
        sqGainBase: 0.28,
        sqGainRobot: 0.22,
        sawGain: 0.62,
        detuneBase: 8,
        detuneRobot: 12,
        bandQBase: 4.2,
        bandQRobot: 2,
        driveBase: 1.8,
        driveRobot: 1.5,
        vibRateHz: 5.6,
        vibDepthMul: 1.2,
        carrierGainMul: 0.58,
      };
    case 'cyber':
      return {
        sqGainBase: 0.52,
        sqGainRobot: 0.35,
        sawGain: 0.38,
        detuneBase: 22,
        detuneRobot: 28,
        bandQBase: 7,
        bandQRobot: 5,
        driveBase: 3.2,
        driveRobot: 4,
        vibRateHz: 3.5,
        vibDepthMul: 0.5,
        carrierGainMul: 0.82,
      };
    case 'warm':
      return {
        sqGainBase: 0.22,
        sqGainRobot: 0.18,
        sawGain: 0.68,
        detuneBase: 6,
        detuneRobot: 10,
        bandQBase: 3.8,
        bandQRobot: 1.5,
        driveBase: 1.5,
        driveRobot: 1.2,
        vibRateHz: 5.2,
        vibDepthMul: 1.1,
        carrierGainMul: 0.5,
      };
    case 'bright':
    case 'neutral':
      return {
        sqGainBase: 0.3,
        sqGainRobot: 0.22,
        sawGain: 0.58,
        detuneBase: 9,
        detuneRobot: 14,
        bandQBase: 4.5,
        bandQRobot: 2.2,
        driveBase: 2,
        driveRobot: 2.2,
        vibRateHz: 5.8,
        vibDepthMul: 1,
        carrierGainMul: 0.62,
      };
    case 'robot':
    default:
      return {
        sqGainBase: 0.34,
        sqGainRobot: 0.22,
        sawGain: 0.58,
        detuneBase: 11,
        detuneRobot: 18,
        bandQBase: 4.8,
        bandQRobot: 3,
        driveBase: 2.2,
        driveRobot: 2.5,
        vibRateHz: 5.8,
        vibDepthMul: 1,
        carrierGainMul: 0.62,
      };
  }
}

/** Hard-quantized pitch ratio for auto-tune playbackRate. */
function autotunePlaybackRate(
  sourcePitchHz: number,
  targetHz: number,
  autotuneStrength: number,
): number {
  const src = Math.max(80, sourcePitchHz);
  const tgt = Math.max(80, targetHz);
  const raw = tgt / src;
  const semitones = 12 * Math.log2(raw);
  const snapped = Math.pow(2, Math.round(semitones) / 12);
  const tune = clamp(autotuneStrength, 0, 1);
  return tune * snapped + (1 - tune) * raw;
}

function scheduleCarrierPitchSteps(
  param: AudioParam,
  steps: readonly { when: number; hz: number }[],
): void {
  if (steps.length === 0) return;
  param.cancelScheduledValues(steps[0]!.when);
  for (const s of steps) {
    param.setValueAtTime(Math.max(55, s.hz), s.when);
  }
}

/** One vocoder pass for the whole phrase — pitch steps per note, no hard chop between notes. */
function schedulePhraseEnvelopeVocoder(
  ctx: AudioContext,
  dest: AudioNode,
  when: number,
  dur: number,
  pitchSteps: readonly { when: number; hz: number }[],
  vel: number,
  bandEnvelopes: Float32Array[],
  mix: number,
  robot: number,
  vibratoDepth: number,
  style: VocalBoxSettings['style'],
  personality: VocalBoxSettings['personality'],
): () => void {
  const t0 = when;
  const t1 = when + dur;
  const stoppers: Array<() => void> = [];
  const leadHz = pitchSteps[0]?.hz ?? 220;
  const ch = vocoderCoeffsForPersonality(personality);

  const saw = ctx.createOscillator();
  saw.type = 'sawtooth';
  saw.frequency.setValueAtTime(Math.max(55, leadHz), t0);
  scheduleCarrierPitchSteps(saw.frequency, pitchSteps);

  const square = ctx.createOscillator();
  square.type = 'square';
  square.frequency.setValueAtTime(Math.max(55, leadHz), t0);
  square.detune.setValueAtTime(ch.detuneBase + robot * ch.detuneRobot, t0);
  scheduleCarrierPitchSteps(square.frequency, pitchSteps);

  if (style === 'sing' && vibratoDepth > 0.02) {
    const vib = ctx.createOscillator();
    const vibG = ctx.createGain();
    vib.frequency.value = ch.vibRateHz;
    vibG.gain.value = vibratoDepth * 22 * ch.vibDepthMul;
    vib.connect(vibG);
    vibG.connect(saw.frequency);
    vibG.connect(square.frequency);
    vib.start(t0);
    vib.stop(t1 + 0.02);
    stoppers.push(() => {
      try {
        vib.stop();
      } catch {
        /* */
      }
    });
  }

  const carrierBus = ctx.createGain();
  carrierBus.gain.value = vel * mix * ch.carrierGainMul;

  const sawG = ctx.createGain();
  sawG.gain.value = ch.sawGain;
  const sqG = ctx.createGain();
  sqG.gain.value = ch.sqGainBase + robot * ch.sqGainRobot;
  saw.connect(sawG);
  square.connect(sqG);
  sawG.connect(carrierBus);
  sqG.connect(carrierBus);

  const outEnv = ctx.createGain();
  outEnv.gain.setValueAtTime(0.0001, t0);
  outEnv.gain.exponentialRampToValueAtTime(1, t0 + 0.018);
  outEnv.gain.setValueAtTime(1, Math.max(t0 + 0.018, t1 - 0.06));
  outEnv.gain.exponentialRampToValueAtTime(0.0001, t1);

  for (let bi = 0; bi < VOCALBOX_VOCODER_BANDS_HZ.length; bi++) {
    const hz = VOCALBOX_VOCODER_BANDS_HZ[bi]!;
    const env = bandEnvelopes[bi] ?? bandEnvelopes[0];
    if (!env) continue;

    const carBp = ctx.createBiquadFilter();
    carBp.type = 'bandpass';
    carBp.frequency.value = hz;
    carBp.Q.value = ch.bandQBase + robot * ch.bandQRobot;

    const bandGain = ctx.createGain();
    bandGain.gain.value = 0.0001;
    scheduleGainEnvelope(bandGain.gain, t0, dur, env, 0.6 + robot * 0.55, 0.0001);

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

  outEnv.connect(drive);
  drive.connect(dest);

  saw.start(t0);
  square.start(t0);
  saw.stop(t1 + 0.02);
  square.stop(t1 + 0.02);
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

function scheduleEnvelopeVocoder(
  ctx: AudioContext,
  dest: AudioNode,
  when: number,
  dur: number,
  carrierHz: number,
  vel: number,
  bandEnvelopes: Float32Array[],
  mix: number,
  robot: number,
  vibratoDepth: number,
  style: VocalBoxSettings['style'],
  personality: VocalBoxSettings['personality'],
): () => void {
  const t0 = when;
  const t1 = when + dur;
  const stoppers: Array<() => void> = [];
  const ch = vocoderCoeffsForPersonality(personality);

  const saw = ctx.createOscillator();
  saw.type = 'sawtooth';
  saw.frequency.setValueAtTime(Math.max(55, carrierHz), t0);

  const square = ctx.createOscillator();
  square.type = 'square';
  square.frequency.setValueAtTime(Math.max(55, carrierHz), t0);
  square.detune.setValueAtTime(ch.detuneBase + robot * ch.detuneRobot, t0);

  if (style === 'sing' && vibratoDepth > 0.02) {
    const vib = ctx.createOscillator();
    const vibG = ctx.createGain();
    vib.frequency.value = ch.vibRateHz;
    vibG.gain.value = vibratoDepth * 22 * ch.vibDepthMul;
    vib.connect(vibG);
    vibG.connect(saw.frequency);
    vibG.connect(square.frequency);
    vib.start(t0);
    vib.stop(t1 + 0.02);
    stoppers.push(() => {
      try {
        vib.stop();
      } catch {
        /* */
      }
    });
  }

  const carrierBus = ctx.createGain();
  carrierBus.gain.value = vel * mix * ch.carrierGainMul;

  const sawG = ctx.createGain();
  sawG.gain.value = ch.sawGain;
  const sqG = ctx.createGain();
  sqG.gain.value = ch.sqGainBase + robot * ch.sqGainRobot;
  saw.connect(sawG);
  square.connect(sqG);
  sawG.connect(carrierBus);
  sqG.connect(carrierBus);

  const outEnv = ctx.createGain();
  outEnv.gain.setValueAtTime(0.0001, t0);
  outEnv.gain.exponentialRampToValueAtTime(1, t0 + 0.01);
  outEnv.gain.setValueAtTime(1, Math.max(t0 + 0.01, t1 - 0.04));
  outEnv.gain.exponentialRampToValueAtTime(0.0001, t1);

  for (let bi = 0; bi < VOCALBOX_VOCODER_BANDS_HZ.length; bi++) {
    const hz = VOCALBOX_VOCODER_BANDS_HZ[bi]!;
    const env = bandEnvelopes[bi] ?? bandEnvelopes[0];
    if (!env) continue;

    const carBp = ctx.createBiquadFilter();
    carBp.type = 'bandpass';
    carBp.frequency.value = hz;
    carBp.Q.value = ch.bandQBase + robot * ch.bandQRobot;

    const bandGain = ctx.createGain();
    bandGain.gain.value = 0.0001;
    scheduleGainEnvelope(bandGain.gain, t0, dur, env, 0.6 + robot * 0.55, 0.0001);

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

  outEnv.connect(drive);
  drive.connect(dest);

  saw.start(t0);
  square.start(t0);
  saw.stop(t1 + 0.02);
  square.stop(t1 + 0.02);
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

function scheduleAutotuneBuzz(
  ctx: AudioContext,
  dest: AudioNode,
  when: number,
  dur: number,
  carrierHz: number,
  vel: number,
  rmsEnv: Float32Array,
  tune: number,
  robot: number,
  pitchSteps?: readonly { when: number; hz: number }[],
): () => void {
  const t0 = when;
  const t1 = when + dur;
  const leadHz = pitchSteps?.[0]?.hz ?? carrierHz;

  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(Math.max(55, leadHz), t0);
  if (pitchSteps && pitchSteps.length > 0) {
    scheduleCarrierPitchSteps(osc.frequency, pitchSteps);
  }
  osc.detune.setValueAtTime(16 + robot * 24, t0);

  const osc2 = ctx.createOscillator();
  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(Math.max(55, leadHz * 2), t0);
  if (pitchSteps && pitchSteps.length > 0) {
    scheduleCarrierPitchSteps(
      osc2.frequency,
      pitchSteps.map((s) => ({ when: s.when, hz: s.hz * 2 })),
    );
  }

  const gate = ctx.createGain();
  gate.gain.value = 0.0001;
  scheduleGainEnvelope(
    gate.gain,
    t0,
    dur,
    rmsEnv,
    vel * (0.22 + tune * 0.42 + robot * 0.25),
    0.0001,
  );

  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 720 + robot * 980;
  bp.Q.value = 2.2 + robot * 4;

  const mix = ctx.createGain();
  mix.gain.value = 0.72;

  osc.connect(gate);
  osc2.connect(gate);
  gate.connect(bp);
  bp.connect(mix);
  mix.connect(dest);

  osc.start(t0);
  osc2.start(t0);
  osc.stop(t1 + 0.02);
  osc2.stop(t1 + 0.02);

  return () => {
    try {
      osc.stop();
      osc2.stop();
    } catch {
      /* */
    }
  };
}

/**
 * One continuous phrase playback (mic or full TTS line) — sentence plays once across the melody.
 * Per-note vocoder/autotune uses envelope slices; no per-note buffer restart or time-stretch loops.
 */
export function scheduleVocalBoxContinuousPhrase(
  ctx: AudioContext,
  dest: AudioNode,
  phraseBuf: AudioBuffer,
  windows: readonly VocalBoxPhraseNoteWindow[],
  settings: VocalBoxSettings,
  opts?: { micMode?: boolean },
): () => void {
  if (windows.length === 0) return () => {};

  const micMode = opts?.micMode === true;
  const robot = clamp(settings.robotMix, 0, 1);
  const tune = clamp(settings.autotuneStrength, 0, 1);
  const stoppers: Array<() => void> = [];

  const phraseStart = windows[0]!.when;
  let melodyEnd = phraseStart;
  for (const w of windows) {
    melodyEnd = Math.max(melodyEnd, w.when + w.dur);
  }
  const melodySpan = Math.max(0.12, melodyEnd - phraseStart);
  const fitRate = clamp(phraseBuf.duration / melodySpan, 0.45, 2.4);

  const speech = ctx.createBufferSource();
  speech.buffer = phraseBuf;
  speech.playbackRate.setValueAtTime(fitRate, phraseStart);
  speech.start(phraseStart, 0);
  speech.stop(phraseStart + melodySpan + 0.06);
  stoppers.push(() => {
    try {
      speech.stop();
    } catch {
      /* */
    }
  });

  const phraseVel = Math.max(...windows.map((w) => w.vel));
  const { vocoderMix, dryAmt } = resolveVocoderMixes(settings, phraseVel, robot, tune, micMode);

  if (dryAmt > 0.02) {
    const dry = ctx.createGain();
    dry.gain.value = dryAmt;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 220;
    speech.connect(hp);
    hp.connect(dry);
    dry.connect(dest);
  }

  if (micMode) {
    const pitchSteps = windows.map((w) => ({ when: w.when, hz: midiToHz(w.midi) }));
    const bandEnvs = extractSpeechBandEnvelopesRange(phraseBuf, 0, phraseBuf.duration);
    const rmsEnv = extractSpeechRmsEnvelopeRange(phraseBuf, 0, phraseBuf.duration);
    void envelopeFrameDurationSec(phraseBuf);

    stoppers.push(
      schedulePhraseEnvelopeVocoder(
        ctx,
        dest,
        phraseStart,
        melodySpan,
        pitchSteps,
        Math.max(...windows.map((w) => w.vel)),
        bandEnvs,
        vocoderMix,
        robot,
        settings.vibratoDepth,
        settings.style,
        settings.personality,
      ),
    );

    if (tune > 0.05 || robot > 0.1) {
      stoppers.push(
        scheduleAutotuneBuzz(
          ctx,
          dest,
          phraseStart,
          melodySpan,
          pitchSteps[0]?.hz ?? 220,
          phraseVel,
          rmsEnv,
          tune,
          robot,
          pitchSteps,
        ),
      );
    }

    return () => {
      for (const fn of stoppers) fn();
    };
  }

  for (const w of windows) {
    const envStart = Math.max(0, w.envStartSec);
    const envEnd = Math.max(envStart + 0.04, Math.min(phraseBuf.duration, w.envEndSec));
    const targetHz = midiToHz(w.midi);

    const bandEnvs = extractSpeechBandEnvelopesRange(phraseBuf, envStart, envEnd);
    const rmsEnv = extractSpeechRmsEnvelopeRange(phraseBuf, envStart, envEnd);
    void envelopeFrameDurationSec(phraseBuf);

    stoppers.push(
      scheduleEnvelopeVocoder(
        ctx,
        dest,
        w.when,
        w.dur,
        targetHz,
        w.vel,
        bandEnvs,
        vocoderMix,
        robot,
        settings.vibratoDepth,
        settings.style,
        settings.personality,
      ),
    );

    if (tune > 0.05 || robot > 0.1) {
      stoppers.push(
        scheduleAutotuneBuzz(ctx, dest, w.when, w.dur, targetHz, w.vel, rmsEnv, tune, robot),
      );
    }
  }

  return () => {
    for (const fn of stoppers) fn();
  };
}

export function scheduleVocalBoxProcessedSpeech(
  ctx: AudioContext,
  dest: AudioNode,
  speechBuf: AudioBuffer,
  when: number,
  slotDur: number,
  midi: number,
  vel: number,
  settings: VocalBoxSettings,
  opts?: VocalBoxProcessedSpeechOpts,
): () => void {
  const dur = Math.max(0.1, slotDur);
  const t0 = when;
  const targetHz = midiToHz(midi);
  const robot = clamp(settings.robotMix, 0, 1);
  const tune = clamp(settings.autotuneStrength, 0, 1);
  const carrierHz = targetHz;
  const micMode = opts?.micMode === true;

  const offsetSec = Math.max(0, opts?.offsetSec ?? 0);
  const sliceSec = Math.max(
    0.04,
    opts?.sliceSec ?? Math.max(0.04, speechBuf.duration - offsetSec),
  );
  const endSec = Math.min(speechBuf.duration, offsetSec + sliceSec);

  const srcPitch = estimateSpeechPitchHzRange(speechBuf, offsetSec, endSec);
  const pitchRate = autotunePlaybackRate(srcPitch, targetHz, tune);
  const playbackRate = pitchRate;

  const rmsEnv = extractSpeechRmsEnvelopeRange(speechBuf, offsetSec, endSec);
  const bandEnvs = extractSpeechBandEnvelopesRange(speechBuf, offsetSec, endSec);
  void envelopeFrameDurationSec(speechBuf);

  const speech = ctx.createBufferSource();
  speech.buffer = speechBuf;
  speech.playbackRate.setValueAtTime(clamp(playbackRate, 0.5, 2.8), t0);

  const stoppers: Array<() => void> = [];

  const { vocoderMix, dryAmt } = resolveVocoderMixes(settings, vel, robot, tune, micMode);

  stoppers.push(
    scheduleEnvelopeVocoder(
      ctx,
      dest,
      t0,
      dur,
      carrierHz,
      vel,
      bandEnvs,
      vocoderMix,
      robot,
      settings.vibratoDepth,
      settings.style,
      settings.personality,
    ),
  );

  if (tune > 0.05 || robot > 0.1) {
    stoppers.push(
      scheduleAutotuneBuzz(ctx, dest, t0, dur, carrierHz, vel, rmsEnv, tune, robot),
    );
  }

  if (dryAmt > 0.02) {
    const dry = ctx.createGain();
    dry.gain.value = dryAmt;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 280;
    speech.connect(hp);
    hp.connect(dry);
    dry.connect(dest);
  }

  const heardSec = sliceSec / clamp(playbackRate, 0.5, 2.8);
  speech.start(t0, offsetSec, sliceSec);
  speech.stop(t0 + Math.min(dur, heardSec) + 0.03);
  stoppers.push(() => {
    try {
      speech.stop();
    } catch {
      /* */
    }
  });

  return () => {
    for (const fn of stoppers) fn();
  };
}
