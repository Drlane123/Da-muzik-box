import { useEffect, useRef, useState } from 'react';

import { detectPitchACF, frequencyToMidiNote } from '@/app/lib/pitchDetection';

export type NeuralHumLivePitch = {
  midi: number;
  hz: number;
  confidence: number;
  pitchClass: number;
};

/**
 * Live monophonic pitch from mic stream while recording (Dubler-style scope feed).
 */
export function useNeuralHumLivePitch(active: boolean, stream: MediaStream | null) {
  const [live, setLive] = useState<NeuralHumLivePitch | null>(null);
  const [trail, setTrail] = useState<number[]>([]);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!active || !stream) {
      setLive(null);
      return;
    }

    let cancelled = false;
    let raf = 0;

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
      analyser.smoothingTimeConstant = 0.35;
      src.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);

      const tick = () => {
        if (cancelled) return;
        analyser.getFloatTimeDomainData(buf);
        const { frequency, confidence } = detectPitchACF(buf, ctx.sampleRate, 50, 1600, 0.045);
        if (frequency > 0 && confidence > 0.06) {
          const midi = frequencyToMidiNote(frequency);
          const pitchClass = ((midi % 12) + 12) % 12;
          setLive({ midi, hz: frequency, confidence, pitchClass });
          setTrail((prev) => {
            if (prev.length > 0 && prev[prev.length - 1] === pitchClass) return prev;
            return [...prev.slice(-35), pitchClass];
          });
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
