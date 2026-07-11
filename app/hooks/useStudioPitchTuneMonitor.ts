'use client';

import { useEffect, useRef, useState } from 'react';

import { detectPitchACF, frequencyToMidiNote } from '@/app/lib/pitchDetection';
import { getStudioPitchMonitorActiveTrack, getStudioPitchMonitorAnalyser, getStudioVocoderMonitorAnalyser } from '@/app/lib/studio/studioPitchTuneMonitorBus';
import {
  isStudioMixerStripGraphPlaybackLocked,
  studioMixerStripAudible,
} from '@/app/lib/studio/studioMixerStripBus';
import type { PitchTuneScaleId } from '@/app/lib/studio/studioPitchTune';
import type { StudioTrackVocalFx } from '@/app/lib/studio/studioTrackVocalFx';
import {
  neuralHumScalePitchClasses,
  snapMidiToNeuralHumScale,
  type NeuralHumScaleId,
} from '@/app/lib/vocalLab/neuralHumKeyLock';

/** Match Hum Capture live pitch gate — same lane tap as Vocal DSP entry. */
const LIVE_PITCH_MIN_HZ = 50;
const LIVE_PITCH_MAX_HZ = 1600;
/** ACF confidence — higher rejects hum/noise false positives on the scope. */
const LIVE_PITCH_CONF = 0.11;
/** Absolute floor (before adaptive calibration) — above typical laptop fan/hum bleed. */
const LIVE_PITCH_MIN_RMS = 0.014;
const LIVE_PITCH_MIN_PEAK = 0.042;
/** Calibrate ~0.75s of ambient noise, then require signal above floor × gain. */
const LIVE_PITCH_CALIB_FRAMES = 45;
const LIVE_PITCH_NOISE_RMS_GAIN = 3.4;
const LIVE_PITCH_NOISE_PEAK_GAIN = 3.0;
const LIVE_PITCH_NOISE_RMS_PAD = 0.006;
const LIVE_PITCH_NOISE_PEAK_PAD = 0.016;
/** Consecutive voiced + stable-pitch frames before scope lights up. */
const LIVE_PITCH_VOICED_FRAMES = 4;
const LIVE_PITCH_STABLE_FRAMES = 3;

export type StudioPitchTuneMonitorSnapshot = {
  detectedMidi: number | null;
  detectedHz: number | null;
  targetMidi: number | null;
  correctedMidi: number | null;
  centsOffset: number;
  pitchClass: number | null;
  targetPitchClass: number | null;
  confidence: number;
  listening: boolean;
  trail: readonly number[];
};

function pitchTuneScalePitchClasses(keyRoot: number, scaleId: PitchTuneScaleId): number[] {
  if (scaleId === 'chromatic') return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  return neuralHumScalePitchClasses(keyRoot, scaleId as NeuralHumScaleId);
}

function targetMidiForDetected(
  detectedMidi: number,
  keyRoot: number,
  scaleId: PitchTuneScaleId,
): number {
  if (scaleId === 'chromatic') return Math.round(detectedMidi);
  return snapMidiToNeuralHumScale(Math.round(detectedMidi), keyRoot, scaleId as NeuralHumScaleId);
}

function centsBetweenMidi(a: number, b: number): number {
  return (a - b) * 100;
}

function correctedMidiVisual(
  detected: number,
  target: number,
  strength: number,
  retuneMs: number,
): number {
  const hard = retuneMs <= 0;
  const lock = hard ? 1 : Math.min(1, strength * (1 + (120 - Math.min(120, retuneMs)) / 160));
  return detected + (target - detected) * lock;
}

const IDLE: StudioPitchTuneMonitorSnapshot = {
  detectedMidi: null,
  detectedHz: null,
  targetMidi: null,
  correctedMidi: null,
  centsOffset: 0,
  pitchClass: null,
  targetPitchClass: null,
  confidence: 0,
  listening: false,
  trail: [],
};

export type StudioPitchMonitorMode = 'pitchTune' | 'vocoder';

function rmsAndPeak(buf: Float32Array): { rms: number; peak: number } {
  let sum = 0;
  let peak = 0;
  for (let i = 0; i < buf.length; i += 1) {
    const v = buf[i] ?? 0;
    const av = Math.abs(v);
    if (av > peak) peak = av;
    sum += v * v;
  }
  const rms = Math.sqrt(sum / Math.max(1, buf.length));
  return { rms, peak };
}

function livePitchEnergyGate(
  rms: number,
  peak: number,
  noiseRms: number,
  noisePeak: number,
): boolean {
  const rmsGate = Math.max(LIVE_PITCH_MIN_RMS, noiseRms * LIVE_PITCH_NOISE_RMS_GAIN + LIVE_PITCH_NOISE_RMS_PAD);
  const peakGate = Math.max(LIVE_PITCH_MIN_PEAK, noisePeak * LIVE_PITCH_NOISE_PEAK_GAIN + LIVE_PITCH_NOISE_PEAK_PAD);
  return rms >= rmsGate && peak >= peakGate;
}

export function useStudioPitchTuneMonitor({
  active,
  trackIndex,
  fx,
  keyRoot,
  mode = 'pitchTune',
  inputDeviceId: _inputDeviceId,
}: {
  active: boolean;
  trackIndex: number;
  fx: StudioTrackVocalFx;
  keyRoot: number;
  /** pitchTune = scale target + correction; vocoder = modulator pitch only (same scope UI). */
  mode?: StudioPitchMonitorMode;
  /** @deprecated scope reads the live lane analyser tap — not a separate mic stream. */
  inputDeviceId?: string;
}) {
  void _inputDeviceId;
  const [snap, setSnap] = useState<StudioPitchTuneMonitorSnapshot>(IDLE);
  const trailRef = useRef<number[]>([]);
  const fxRef = useRef(fx);
  fxRef.current = fx;

  useEffect(() => {
    if (!active) {
      trailRef.current = [];
      setSnap(IDLE);
      return;
    }

    let cancelled = false;
    let raf = 0;
    let calibFrames = 0;
    let noiseRms = 0;
    let noisePeak = 0;
    let voicedFrames = 0;
    let stablePitchFrames = 0;
    let lastRoundedMidi: number | null = null;
    const bufRef = { current: new Float32Array(2048) };

    const tick = () => {
      if (cancelled) return;

      // Analyser pulls on the main thread during SE2 transport cause audible dropouts.
      if (isStudioMixerStripGraphPlaybackLocked()) {
        raf = requestAnimationFrame(tick);
        return;
      }

      if (!studioMixerStripAudible(trackIndex) && getStudioPitchMonitorActiveTrack() !== trackIndex) {
        calibFrames = 0;
        noiseRms = 0;
        noisePeak = 0;
        voicedFrames = 0;
        stablePitchFrames = 0;
        lastRoundedMidi = null;
        trailRef.current = [];
        setSnap(IDLE);
        raf = requestAnimationFrame(tick);
        return;
      }

      const analyser =
        mode === 'vocoder'
          ? getStudioVocoderMonitorAnalyser(trackIndex) ?? getStudioPitchMonitorAnalyser(trackIndex)
          : getStudioPitchMonitorAnalyser(trackIndex) ?? getStudioVocoderMonitorAnalyser(trackIndex);
      if (!analyser) {
        trailRef.current = [];
        setSnap(IDLE);
        raf = requestAnimationFrame(tick);
        return;
      }

      if (bufRef.current.length !== analyser.fftSize) {
        bufRef.current = new Float32Array(analyser.fftSize);
      }
      const sampleBuf = bufRef.current;
      analyser.getFloatTimeDomainData(sampleBuf);
      const { rms, peak } = rmsAndPeak(sampleBuf);

      if (calibFrames < LIVE_PITCH_CALIB_FRAMES) {
        calibFrames += 1;
        noiseRms = Math.max(noiseRms, rms);
        noisePeak = Math.max(noisePeak, peak);
        trailRef.current = [];
        setSnap(IDLE);
        raf = requestAnimationFrame(tick);
        return;
      }

      const hasEnergy = livePitchEnergyGate(rms, peak, noiseRms, noisePeak);
      if (!hasEnergy) {
        noiseRms = noiseRms * 0.992 + rms * 0.008;
        noisePeak = noisePeak * 0.992 + peak * 0.008;
        voicedFrames = 0;
        stablePitchFrames = 0;
        lastRoundedMidi = null;
        trailRef.current = [];
        setSnap(IDLE);
        raf = requestAnimationFrame(tick);
        return;
      }

      const { frequency, confidence } = detectPitchACF(
        sampleBuf,
        analyser.context.sampleRate,
        LIVE_PITCH_MIN_HZ,
        LIVE_PITCH_MAX_HZ,
        LIVE_PITCH_CONF,
      );

      const currentFx = fxRef.current;
      if (frequency > 0 && confidence > LIVE_PITCH_CONF) {
        voicedFrames = Math.min(12, voicedFrames + 1);
        const detectedMidi = frequencyToMidiNote(frequency);
        const roundedMidi = Math.round(detectedMidi);
        if (lastRoundedMidi == null || Math.abs(roundedMidi - lastRoundedMidi) > 1) {
          stablePitchFrames = 0;
          lastRoundedMidi = roundedMidi;
        } else {
          stablePitchFrames = Math.min(12, stablePitchFrames + 1);
        }

        if (voicedFrames < LIVE_PITCH_VOICED_FRAMES || stablePitchFrames < LIVE_PITCH_STABLE_FRAMES) {
          setSnap(IDLE);
          raf = requestAnimationFrame(tick);
          return;
        }

        const pitchClass = ((roundedMidi % 12) + 12) % 12;
        const targetMidi =
          mode === 'vocoder' || !currentFx.autotuneOn
            ? null
            : targetMidiForDetected(detectedMidi, keyRoot, currentFx.pitchScaleId);
        const targetPitchClass =
          targetMidi != null ? ((targetMidi % 12) + 12) % 12 : null;
        const correctedMidi =
          mode === 'vocoder' || !currentFx.autotuneOn || targetMidi == null
            ? detectedMidi
            : correctedMidiVisual(
                detectedMidi,
                targetMidi,
                currentFx.autotuneStrength,
                currentFx.pitchRetuneMs,
              );
        const centsOffset =
          targetMidi != null ? centsBetweenMidi(detectedMidi, targetMidi) : 0;
        const trail = trailRef.current;
        if (trail.length === 0 || trail[trail.length - 1] !== pitchClass) {
          trailRef.current = [...trail.slice(-35), pitchClass];
        }
        setSnap({
          detectedMidi,
          detectedHz: frequency,
          targetMidi,
          correctedMidi,
          centsOffset,
          pitchClass,
          targetPitchClass,
          confidence,
          listening: true,
          trail: trailRef.current,
        });
      } else {
        voicedFrames = 0;
        stablePitchFrames = 0;
        lastRoundedMidi = null;
        trailRef.current = [];
        setSnap(IDLE);
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      trailRef.current = [];
    };
  }, [
    active,
    mode,
    trackIndex,
    keyRoot,
    fx.autotuneOn,
    fx.pitchScaleId,
    fx.autotuneStrength,
    fx.pitchRetuneMs,
  ]);

  const scalePitchClasses =
    mode === 'vocoder'
      ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
      : pitchTuneScalePitchClasses(keyRoot, fx.pitchScaleId);

  return { snap, scalePitchClasses };
}
