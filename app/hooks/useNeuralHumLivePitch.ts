import { useEffect, useRef, useState } from 'react';

import {
  createHumPitchTrackerState,
  trackHumPitchFrame,
} from '@/app/lib/vocalLab/vocalBoxHumMidiFilter';

export type NeuralHumLivePitch = {
  midi: number;
  hz: number;
  confidence: number;
  pitchClass: number;
  rms: number;
};

export type NeuralHumLivePitchOptions = {
  minConfidence?: number;
  minRms?: number;
  silenceHoldFrames?: number;
  fMinHz?: number;
  fMaxHz?: number;
  shouldSuppressPitch?: () => boolean;
};

/**
 * Live monophonic pitch from mic stream while recording.
 * Analysis path: soft compressor → ACF → median MIDI filter (mic only).
 */
export function useNeuralHumLivePitch(
  active: boolean,
  stream: MediaStream | null,
  options?: NeuralHumLivePitchOptions,
) {
  const [live, setLive] = useState<NeuralHumLivePitch | null>(null);
  const [trail, setTrail] = useState<number[]>([]);
  const ctxRef = useRef<AudioContext | null>(null);
  const optsRef = useRef(options);
  optsRef.current = options;

  useEffect(() => {
    if (!active || !stream) {
      setLive(null);
      return;
    }

    let cancelled = false;
    let raf = 0;
    let silenceFrames = 0;
    const tracker = createHumPitchTrackerState();

    void (async () => {
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      if (ctx.state === 'suspended') {
        try {
          await ctx.resume();
        } catch {
          /* autoplay */
        }
      }
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.08;
      src.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);

      const tick = () => {
        if (cancelled) return;
        const o = optsRef.current;
        if (o?.shouldSuppressPitch?.()) {
          silenceFrames = 0;
          setLive(null);
          raf = requestAnimationFrame(tick);
          return;
        }

        analyser.getFloatTimeDomainData(buf);
        const minRms = o?.minRms ?? 0.0028;
        const minConf = o?.minConfidence ?? 0.14;
        const hold = o?.silenceHoldFrames ?? 2;
        const fMin = o?.fMinHz ?? 50;
        const fMax = o?.fMaxHz ?? 1200;

        const frame = trackHumPitchFrame(buf, ctx.sampleRate, tracker, {
          minConfidence: minConf,
          minRms,
          fMinHz: fMin,
          fMaxHz: fMax,
        });

        if (frame) {
          silenceFrames = 0;
          setLive({
            midi: frame.midi,
            hz: frame.hz,
            confidence: frame.confidence,
            pitchClass: frame.pitchClass,
            rms: frame.rms,
          });
          setTrail((prev) => {
            if (prev.length > 0 && prev[prev.length - 1] === frame.pitchClass) return prev;
            return [...prev.slice(-35), frame.pitchClass];
          });
        } else {
          silenceFrames += 1;
          if (silenceFrames >= hold) setLive(null);
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    })();

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      const ctx = ctxRef.current;
      ctxRef.current = null;
      if (ctx) void ctx.close();
      setLive(null);
    };
  }, [active, stream]);

  const clearTrail = () => setTrail([]);

  return { live, trail, clearTrail };
}
