/**
 * Live Pitch Tune — worklet loader + analyser-driven pitch ratio updates.
 */
import { detectPitchACF, frequencyToMidiNote } from '@/app/lib/pitchDetection';
import {
  snapMidiToNeuralHumScale,
  type NeuralHumScaleId,
} from '@/app/lib/vocalLab/neuralHumKeyLock';
import type { PitchTuneScaleId } from '@/app/lib/studio/studioPitchTune';
import type { StudioMidiPitchTargetEvent } from '@/app/lib/studio/studioVocoderCarrier';

let workletLoadByContext = new WeakMap<BaseAudioContext, Promise<void>>();

export async function ensureStudioLivePitchTuneWorklet(ctx: BaseAudioContext): Promise<void> {
  const cached = workletLoadByContext.get(ctx);
  if (cached) return cached;
  if (typeof AudioWorkletNode === 'undefined') {
    throw new Error('AudioWorklet not supported');
  }
  const load = ctx.audioWorklet
    /* rev query busts browser worklet cache after dry-pass / mute fixes */
    .addModule('/studio-live-pitch-tune-processor.js?v=4')
    .catch((err) => {
      workletLoadByContext.delete(ctx);
      throw err;
    });
  workletLoadByContext.set(ctx, load);
  return load;
}

export type StudioLivePitchTuneParams = {
  strength: number;
  retuneSpeedMs: number;
  flexTune: number;
  humanize: number;
  scaleId: PitchTuneScaleId;
  tracking: number;
  keyRoot: number;
  midiTargetTimeline?: readonly StudioMidiPitchTargetEvent[] | null;
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function targetMidiForDetected(
  detectedMidi: number,
  keyRoot: number,
  scaleId: PitchTuneScaleId,
): number {
  if (scaleId === 'chromatic') return Math.round(detectedMidi);
  return snapMidiToNeuralHumScale(Math.round(detectedMidi), keyRoot, scaleId as NeuralHumScaleId);
}

function midiTargetAtTimeline(
  timeline: readonly StudioMidiPitchTargetEvent[],
  tSec: number,
): number | null {
  if (timeline.length === 0) return null;
  let active: StudioMidiPitchTargetEvent | null = null;
  for (const ev of timeline) {
    if (ev.tSec <= tSec + 1e-6) active = ev;
    else break;
  }
  return active?.pitch ?? null;
}

function smoothAlpha(retuneMs: number, dtMs: number): number {
  if (retuneMs <= 0.5) return 1;
  return 1 - Math.exp(-dtMs / retuneMs);
}

export type StudioLivePitchTuneHandle = {
  node: AudioWorkletNode;
  analyser: AnalyserNode;
  params: StudioLivePitchTuneParams;
  stop: () => void;
  updateMix: (strength: number) => void;
};

/** Create live pitch shifter + start analyser loop for clip segment. */
export async function createStudioLivePitchTuneChain(
  ctx: AudioContext,
  params: StudioLivePitchTuneParams,
  opts: {
    tPlay: number;
    playSec: number;
    offsetSec: number;
    /** Input monitor — keep pitch tracking for the full session. */
    unbounded?: boolean;
  },
): Promise<StudioLivePitchTuneHandle> {
  await ensureStudioLivePitchTuneWorklet(ctx);
  const node = new AudioWorkletNode(ctx, 'studio-live-pitch-tune', {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1],
  });
  const pitchRatio = node.parameters.get('pitchRatio')!;
  const mix = node.parameters.get('mix')!;
  const strength0 = clamp(params.strength, 0, 1);
  mix.setValueAtTime(0, opts.tPlay);
  pitchRatio.setValueAtTime(1, opts.tPlay);

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.35;

  const buf = new Float32Array(analyser.fftSize);
  let cancelled = false;
  let smoothedRatio = 1;
  let intervalId = 0;
  let silentTicks = 0;
  let noiseRms = 0.0008;
  let noisePeak = 0.002;
  let calibFrames = 0;
  /** Soft absolute floors — tracking dial scales these further. */
  const VOICED_RMS = 0.0025;
  const VOICED_PEAK = 0.006;

  const inputRms = (data: Float32Array): number => {
    let sum = 0;
    let peak = 0;
    for (let i = 0; i < data.length; i += 1) {
      const v = data[i] ?? 0;
      const av = Math.abs(v);
      if (av > peak) peak = av;
      sum += v * v;
    }
    return Math.sqrt(sum / Math.max(1, data.length));
  };

  const inputPeak = (data: Float32Array): number => {
    let peak = 0;
    for (let i = 0; i < data.length; i += 1) {
      const av = Math.abs(data[i] ?? 0);
      if (av > peak) peak = av;
    }
    return peak;
  };

  /** mix=0 → dry pass-through in the worklet (never mute the lane). */
  const setMixDry = () => {
    smoothedRatio = 1;
    try {
      pitchRatio.setTargetAtTime(1, ctx.currentTime, 0.01);
      mix.setTargetAtTime(0, ctx.currentTime, 0.012);
    } catch {
      pitchRatio.setValueAtTime(1, ctx.currentTime);
      mix.setValueAtTime(0, ctx.currentTime);
    }
  };

  const tick = () => {
    if (cancelled || ctx.state === 'closed') return;
    const localSec = opts.offsetSec + Math.max(0, ctx.currentTime - opts.tPlay);
    if (!opts.unbounded && localSec > opts.offsetSec + opts.playSec + 0.05) return;

    analyser.getFloatTimeDomainData(buf);
    const rms = inputRms(buf);
    const peak = inputPeak(buf);
    const strength = clamp(params.strength, 0, 1);
    const track = clamp(params.tracking, 0, 1);
    /* Higher tracking → lower ACF bar + lower energy gate (dial actually does something). */
    const confThreshold = 0.022 + (1 - track) * 0.045;
    const gateScale = 1.15 - track * 0.55;

    if (calibFrames < 16) {
      calibFrames += 1;
      /* Learn ambient noise only while quiet — never train on the vocal. */
      if (rms < VOICED_RMS * gateScale && peak < VOICED_PEAK * gateScale) {
        noiseRms = Math.max(noiseRms, rms);
        noisePeak = Math.max(noisePeak, peak);
      }
    }

    const rmsGate = Math.max(VOICED_RMS * gateScale, noiseRms * (1.55 + (1 - track) * 0.55) + 0.001);
    const peakGate = Math.max(VOICED_PEAK * gateScale, noisePeak * (1.45 + (1 - track) * 0.5) + 0.0025);
    const inputLive = rms >= rmsGate && peak >= peakGate;

    if (!inputLive) {
      noiseRms = noiseRms * 0.995 + Math.min(rms, rmsGate) * 0.005;
      noisePeak = noisePeak * 0.995 + Math.min(peak, peakGate) * 0.005;
      silentTicks = Math.min(16, silentTicks + 1);
      if (silentTicks >= 3) setMixDry();
      return;
    }
    silentTicks = 0;

    const { frequency, confidence } = detectPitchACF(
      buf,
      ctx.sampleRate,
      55,
      1400,
      confThreshold * 0.75,
    );

    if (frequency > 0 && confidence > confThreshold) {
      const detected = frequencyToMidiNote(frequency);
      const midiFromLane =
        params.midiTargetTimeline && params.midiTargetTimeline.length > 0
          ? midiTargetAtTimeline(params.midiTargetTimeline, localSec)
          : null;
      const target =
        midiFromLane != null ? clamp(midiFromLane, 36, 84) : targetMidiForDetected(detected, params.keyRoot, params.scaleId);
      const semis = target - detected;
      const flexMul = 1 - clamp(params.flexTune, 0, 1) * clamp(1 - Math.abs(semis) / 0.65, 0, 1) * 0.65;
      const desiredRatio = Math.pow(2, (semis * strength * flexMul) / 12);
      const alpha = smoothAlpha(params.retuneSpeedMs, 25);
      smoothedRatio = smoothedRatio + (desiredRatio - smoothedRatio) * alpha;
      const ratio = clamp(smoothedRatio, 0.5, 2);
      try {
        pitchRatio.setTargetAtTime(ratio, ctx.currentTime, 0.012);
        mix.setTargetAtTime(strength, ctx.currentTime, 0.015);
      } catch {
        pitchRatio.setValueAtTime(ratio, ctx.currentTime);
        mix.setValueAtTime(strength, ctx.currentTime);
      }
    } else {
      /* No lock yet — keep dry audible until pitch is found. */
      setMixDry();
    }
  };

  /* 40ms — ACF every 25ms + monitor rAF was enough to lock the UI. */
  intervalId = window.setInterval(tick, 40);

  const updateMix = (strength: number) => {
    params.strength = clamp(strength, 0, 1);
    if (silentTicks >= 2) {
      try {
        mix.setTargetAtTime(0, ctx.currentTime, 0.015);
      } catch {
        mix.setValueAtTime(0, ctx.currentTime);
      }
    }
  };

  return {
    node,
    analyser,
    params,
    updateMix,
    stop: () => {
      cancelled = true;
      window.clearInterval(intervalId);
      try {
        pitchRatio.setValueAtTime(1, ctx.currentTime);
        mix.setValueAtTime(0, ctx.currentTime);
      } catch {
        /* */
      }
    },
  };
}
