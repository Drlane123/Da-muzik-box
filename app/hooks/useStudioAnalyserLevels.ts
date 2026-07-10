'use client';

import { useEffect, useRef, useState } from 'react';

import {
  readStudioTrackMeterSnapshot,
  studioAnalyserLogBandIndex,
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

/** Throttled analyser poll — updates at ~15 Hz to avoid re-render storms on FX panels. */
export function useStudioAnalyserLevels(
  trackIndex: number,
  active: boolean,
): StudioTrackMeterSnapshot {
  const [snap, setSnap] = useState<StudioTrackMeterSnapshot>(SILENT);
  const smoothRef = useRef({ peakL: 0, peakR: 0, bars: new Float32Array(64) });
  const spectrumReuseRef = useRef<Float32Array>(new Float32Array(256));

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
    let lastPublish = 0;

    const tick = (t: number) => {
      if (cancelled) return;
      const raw = readStudioTrackMeterSnapshot(trackIndex, spectrumReuseRef.current);
      const sm = smoothRef.current;
      const live = raw?.hasSignal ?? false;
      const targetL = live ? Math.min(1, (raw?.peakL ?? 0) * 2.1) : 0;
      const targetR = live ? Math.min(1, (raw?.peakR ?? 0) * 2.1) : 0;

      sm.peakL = studioMeterBallistics(sm.peakL, targetL, live);
      sm.peakR = studioMeterBallistics(sm.peakR, targetR, live);

      if (live && raw) {
        const n = sm.bars.length;
        const srcN = raw.spectrum.length;
        for (let i = 0; i < n; i++) {
          const srcI = studioAnalyserLogBandIndex(i, n, srcN);
          const target = raw.spectrum[srcI] ?? 0;
          sm.bars[i] = studioMeterBallistics(sm.bars[i] ?? 0, target, live);
        }
      } else {
        for (let i = 0; i < sm.bars.length; i++) {
          sm.bars[i] = studioMeterBallistics(sm.bars[i] ?? 0, 0, false);
        }
      }

      if (t - lastPublish >= 66) {
        lastPublish = t;
        const hasSignal = sm.peakL > STUDIO_METER_DISPLAY_FLOOR || sm.peakR > STUDIO_METER_DISPLAY_FLOOR;
        setSnap({
          peak: Math.max(sm.peakL, sm.peakR),
          peakL: sm.peakL,
          peakR: sm.peakR,
          rms: live ? (raw?.rms ?? 0) : 0,
          hasSignal,
          spectrum: Float32Array.from(sm.bars),
        });
      }

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
