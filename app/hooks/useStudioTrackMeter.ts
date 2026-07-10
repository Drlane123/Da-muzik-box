'use client';

import { useEffect, useRef, useState } from 'react';

import {
  readStudioTrackMeterSnapshot,
  studioMeterBallistics,
  STUDIO_METER_DISPLAY_FLOOR,
  type StudioTrackMeterSnapshot,
} from '@/app/lib/studio/studioTrackAnalyserBus';

const SILENT: StudioTrackMeterSnapshot = {
  peak: 0,
  peakL: 0,
  peakR: 0,
  rms: 0,
  hasSignal: false,
  spectrum: new Float32Array(0),
};

/**
 * Poll real track analyser levels — meters stay at zero until audio exceeds silence threshold.
 */
export function useStudioTrackMeter(trackIndex: number, active: boolean): StudioTrackMeterSnapshot {
  const [snap, setSnap] = useState<StudioTrackMeterSnapshot>(SILENT);
  const spectrumRef = useRef<Float32Array>(new Float32Array(0));
  const smoothRef = useRef({ peakL: 0, peakR: 0, bars: new Float32Array(64) });

  useEffect(() => {
    if (!active) {
      smoothRef.current.peakL = 0;
      smoothRef.current.peakR = 0;
      smoothRef.current.bars.fill(0);
      setSnap(SILENT);
      return;
    }

    let cancelled = false;
    let raf = 0;

    const tick = () => {
      if (cancelled) return;
      const raw = readStudioTrackMeterSnapshot(trackIndex, spectrumRef.current);
      const sm = smoothRef.current;
      const live = raw?.hasSignal ?? false;

      sm.peakL = studioMeterBallistics(sm.peakL, live ? raw!.peakL : 0, live);
      sm.peakR = studioMeterBallistics(sm.peakR, live ? raw!.peakR : 0, live);

      if (live && raw) {
        spectrumRef.current = raw.spectrum;
        const n = sm.bars.length;
        const srcN = raw.spectrum.length;
        for (let i = 0; i < n; i++) {
          const t = i / Math.max(1, n - 1);
          const srcI = Math.min(srcN - 1, Math.floor(t * t * srcN));
          const target = raw.spectrum[srcI] ?? 0;
          sm.bars[i] = studioMeterBallistics(sm.bars[i] ?? 0, target, true);
        }
      } else {
        for (let i = 0; i < sm.bars.length; i++) {
          sm.bars[i] = studioMeterBallistics(sm.bars[i] ?? 0, 0, false);
        }
      }

      const hasSignal = sm.peakL > STUDIO_METER_DISPLAY_FLOOR || sm.peakR > STUDIO_METER_DISPLAY_FLOOR;
      setSnap({
        peak: Math.max(sm.peakL, sm.peakR),
        peakL: sm.peakL,
        peakR: sm.peakR,
        rms: live ? (raw?.rms ?? 0) : 0,
        hasSignal,
        spectrum: Float32Array.from(sm.bars),
      });
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [active, trackIndex]);

  return snap;
}
