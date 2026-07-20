'use client';

import { useEffect, useRef, useState } from 'react';

import { detectPitchACF, frequencyToMidiNote } from '@/app/lib/pitchDetection';
import { getStudioPitchMonitorActiveTrack, getStudioPitchMonitorAnalyser, getStudioVocoderMonitorAnalyser } from '@/app/lib/studio/studioPitchTuneMonitorBus';
import { studioMixerStripAudible } from '@/app/lib/studio/studioMixerStripBus';
import type { PitchTuneScaleId } from '@/app/lib/studio/studioPitchTune';
import type { StudioTrackVocalFx } from '@/app/lib/studio/studioTrackVocalFx';
import {
  neuralHumScalePitchClasses,
  snapMidiToNeuralHumScale,
  type NeuralHumScaleId,
} from '@/app/lib/vocalLab/neuralHumKeyLock';

/** Match live Pitch Tune engine gate — same lane tap as Vocal DSP entry. */
const LIVE_PITCH_MIN_HZ = 50;
const LIVE_PITCH_MAX_HZ = 1600;
/** ACF confidence — keep modest so quiet mics still lock the scope. */
const LIVE_PITCH_CONF = 0.045;
/** Absolute floor — aligned with softer live Pitch Tune engine gates. */
const LIVE_PITCH_MIN_RMS = 0.0018;
const LIVE_PITCH_MIN_PEAK = 0.0045;
/** Short ambient learn — skip immediately once voice energy is present. */
const LIVE_PITCH_CALIB_FRAMES = 8;
const LIVE_PITCH_NOISE_RMS_GAIN = 1.45;
const LIVE_PITCH_NOISE_PEAK_GAIN = 1.35;
const LIVE_PITCH_NOISE_RMS_PAD = 0.0008;
const LIVE_PITCH_NOISE_PEAK_PAD = 0.002;
/** Consecutive voiced + stable-pitch frames before scope lights up. */
const LIVE_PITCH_VOICED_FRAMES = 1;
const LIVE_PITCH_STABLE_FRAMES = 1;

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
    let calibFrames = 0;
    let noiseRms = 0.0015;
    let noisePeak = 0.004;
    let voicedFrames = 0;
    let stablePitchFrames = 0;
    let lastRoundedMidi: number | null = null;
    let lastAnalyser: AnalyserNode | null = null;
    const bufRef = { current: new Float32Array(2048) };

    const resetGates = () => {
      calibFrames = 0;
      noiseRms = 0.0015;
      noisePeak = 0.004;
      voicedFrames = 0;
      stablePitchFrames = 0;
      lastRoundedMidi = null;
      trailRef.current = [];
    };

    const tick = () => {
      if (cancelled) return;

      /*
       * Pitch / Vocoder scopes read parallel Vocal DSP analysers — safe during transport.
       * (Mixer-strip analyser polls remain locked elsewhere to avoid WAV/MIDI dropouts.)
       */

      if (!studioMixerStripAudible(trackIndex) && getStudioPitchMonitorActiveTrack() !== trackIndex) {
        resetGates();
        lastAnalyser = null;
        setSnap(IDLE);
        return;
      }

      const analyser =
        mode === 'vocoder'
          ? getStudioVocoderMonitorAnalyser(trackIndex) ?? getStudioPitchMonitorAnalyser(trackIndex)
          : getStudioPitchMonitorAnalyser(trackIndex) ?? getStudioVocoderMonitorAnalyser(trackIndex);
      if (!analyser) {
        resetGates();
        lastAnalyser = null;
        setSnap(IDLE);
        return;
      }

      if (analyser !== lastAnalyser) {
        lastAnalyser = analyser;
        resetGates();
      }

      if (bufRef.current.length !== analyser.fftSize) {
        bufRef.current = new Float32Array(analyser.fftSize);
      }
      const sampleBuf = bufRef.current;
      analyser.getFloatTimeDomainData(sampleBuf);
      const { rms, peak } = rmsAndPeak(sampleBuf);

      if (calibFrames < LIVE_PITCH_CALIB_FRAMES) {
        const voiceDuringCalib = livePitchEnergyGate(rms, peak, noiseRms, noisePeak);
        if (voiceDuringCalib) {
          /* Don't hold the scope dark while the singer is already live. */
          calibFrames = LIVE_PITCH_CALIB_FRAMES;
        } else {
          calibFrames += 1;
          /* Learn ambient noise only while quiet — never train on the vocal. */
          if (rms < LIVE_PITCH_MIN_RMS && peak < LIVE_PITCH_MIN_PEAK) {
            noiseRms = Math.max(noiseRms, rms);
            noisePeak = Math.max(noisePeak, peak);
          }
          trailRef.current = [];
          setSnap(IDLE);
          return;
        }
      }

      const hasEnergy = livePitchEnergyGate(rms, peak, noiseRms, noisePeak);
      if (!hasEnergy) {
        const rmsGate = Math.max(
          LIVE_PITCH_MIN_RMS,
          noiseRms * LIVE_PITCH_NOISE_RMS_GAIN + LIVE_PITCH_NOISE_RMS_PAD,
        );
        const peakGate = Math.max(
          LIVE_PITCH_MIN_PEAK,
          noisePeak * LIVE_PITCH_NOISE_PEAK_GAIN + LIVE_PITCH_NOISE_PEAK_PAD,
        );
        noiseRms = noiseRms * 0.995 + Math.min(rms, rmsGate) * 0.005;
        noisePeak = noisePeak * 0.995 + Math.min(peak, peakGate) * 0.005;
        voicedFrames = 0;
        stablePitchFrames = 0;
        lastRoundedMidi = null;
        trailRef.current = [];
        setSnap(IDLE);
        return;
      }

      const currentFx = fxRef.current;
      const confNeed = Math.max(0.02, LIVE_PITCH_CONF * (1.15 - currentFx.pitchTracking * 0.45));
      const { frequency, confidence } = detectPitchACF(
        sampleBuf,
        analyser.context.sampleRate,
        LIVE_PITCH_MIN_HZ,
        LIVE_PITCH_MAX_HZ,
        confNeed,
      );

      if (frequency > 0 && confidence > confNeed) {
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
    };

    /* ~20 Hz — full rAF ACF froze the app when Pitch Tune / Vocoder DSP panels were open. */
    const intervalId = window.setInterval(tick, 50);
    tick();

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
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
