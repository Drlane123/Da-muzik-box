'use client';

/**
 * SE2 Beat Pads — stereo L/R VU in the bank↔pads gap.
 * Driven by per-voice analyser taps (real hit level), not the mixer strip worklet.
 */
import { useEffect, useRef } from 'react';
import { readSe2BeatPadsVuPeaks } from '@/app/lib/studio/se2BeatPadsVuTap';
import { readStudioMixerStripMeter } from '@/app/lib/studio/studioMixerStripBus';
import { paintStudioMixerMeterBar } from '@/app/lib/studio/se2TrackLaneMeterPaint';

/** Soft hits stay low; hard / loud samples climb — preserves velocity & sample differences. */
function levelToDisplay(linear: number): number {
  const v = Math.max(0, Math.min(1, linear));
  if (v < 0.0008) return 0;
  return Math.min(1, Math.pow(v, 0.62));
}

function meterFillGradient(displayNorm: number): string {
  if (!Number.isFinite(displayNorm) || displayNorm <= 0) return 'rgba(28,28,40,0.5)';
  if (displayNorm < 0.72) {
    return 'linear-gradient(to top, #00b84a 0%, #12e86a 55%, #5dff9a 100%)';
  }
  if (displayNorm < 0.9) {
    return 'linear-gradient(to top, #00b84a 0%, #12e86a 70%, #ffc53d 100%)';
  }
  return 'linear-gradient(to top, #00b84a 0%, #12e86a 62%, #ffb020 82%, #ff3d4a 100%)';
}

/** Instant attack (hit sync); quick release so it does not hang. */
function stepDisplay(current: number, target: number, dtSec: number): number {
  if (target >= current) return target;
  const rel = 1 - Math.exp(-dtSec / 0.04);
  const next = current + (target - current) * rel;
  return next < 0.008 ? 0 : next;
}

export type Se2BeatPadsStereoVuProps = {
  trackIndex: number;
  active?: boolean;
};

export function Se2BeatPadsStereoVu({ trackIndex, active = true }: Se2BeatPadsStereoVuProps) {
  const fillLRef = useRef<HTMLDivElement | null>(null);
  const fillRRef = useRef<HTMLDivElement | null>(null);
  const lastFrameMsRef = useRef(0);
  const dispRef = useRef({ l: 0, r: 0 });

  useEffect(() => {
    if (!active) {
      lastFrameMsRef.current = 0;
      dispRef.current = { l: 0, r: 0 };
      paintStudioMixerMeterBar(fillLRef.current, 0, () => 'rgba(28,28,40,0.5)');
      paintStudioMixerMeterBar(fillRRef.current, 0, () => 'rgba(28,28,40,0.5)');
      return undefined;
    }
    let raf = 0;
    const paint = () => {
      const now = performance.now();
      const prev = lastFrameMsRef.current;
      const dt = prev > 0 ? (now - prev) / 1000 : 1 / 60;
      lastFrameMsRef.current = now;
      const dtClamped = Math.max(1 / 240, Math.min(0.05, dt));

      let peakL = 0;
      let peakR = 0;
      const voice = readSe2BeatPadsVuPeaks();
      peakL = voice.l;
      peakR = voice.r;
      if (peakL < 0.0008 && peakR < 0.0008) {
        const snap = readStudioMixerStripMeter(trackIndex);
        peakL = snap?.peakL ?? 0;
        peakR = snap?.peakR ?? 0;
      }

      const targetL = levelToDisplay(peakL);
      const targetR = levelToDisplay(peakR);
      const disp = dispRef.current;
      disp.l = stepDisplay(disp.l, targetL, dtClamped);
      disp.r = stepDisplay(disp.r, targetR, dtClamped);

      paintStudioMixerMeterBar(fillLRef.current, disp.l, (n) => meterFillGradient(n));
      paintStudioMixerMeterBar(fillRRef.current, disp.r, (n) => meterFillGradient(n));
      raf = requestAnimationFrame(paint);
    };
    raf = requestAnimationFrame(paint);
    return () => {
      cancelAnimationFrame(raf);
      lastFrameMsRef.current = 0;
    };
  }, [active, trackIndex]);

  return (
    <div
      className="se2-beat-pads-stereo-vu"
      aria-label="Beat Pads stereo level meters"
      title="Beat Pads · L / R"
      style={{
        position: 'absolute',
        left: 'calc(280px + 6px + 0.1in)',
        top: 8,
        bottom: 8,
        width: 28,
        zIndex: 4,
        pointerEvents: 'none',
        boxSizing: 'border-box',
      }}
    >
      <div className="se2-beat-pads-stereo-vu__glass" aria-hidden>
        <div className="se2-beat-pads-stereo-vu__col">
          <div ref={fillLRef} className="se2-beat-pads-stereo-vu__led" />
        </div>
        <div className="se2-beat-pads-stereo-vu__col">
          <div ref={fillRRef} className="se2-beat-pads-stereo-vu__led" />
        </div>
        <div className="se2-beat-pads-stereo-vu__sheen" />
      </div>
      <div className="se2-beat-pads-stereo-vu__labels" aria-hidden>
        <span>L</span>
        <span>R</span>
      </div>
    </div>
  );
}
