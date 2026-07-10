/**
 * Oscilloscope display — animated only while `active` (ANA: motion follows audio).
 * Beat Lab leaves `active` default true; Geno Ultra drives it from note preview.
 */
import React, { useEffect, useRef } from 'react';

export type BeatLabSynthV2OscilloscopeProps = {
  osc1Wave: 'sine' | 'saw' | 'square' | 'triangle';
  osc2Wave: 'sine' | 'saw' | 'square' | 'triangle';
  level1: number;
  level2: number;
  width?: number;
  height?: number;
  /** When false, waveform is frozen (idle). Default true for Beat Lab preview panels. */
  active?: boolean;
};

function sampleOsc(type: BeatLabSynthV2OscilloscopeProps['osc1Wave'], phase: number): number {
  const p = phase - Math.floor(phase);
  switch (type) {
    case 'sine':
      return Math.sin(p * Math.PI * 2);
    case 'square':
      return p < 0.5 ? 1 : -1;
    case 'triangle':
      return p < 0.5 ? p * 4 - 1 : 3 - p * 4;
    default:
      return p * 2 - 1;
  }
}

function buildScopePath(
  phase: number,
  osc1Wave: BeatLabSynthV2OscilloscopeProps['osc1Wave'],
  osc2Wave: BeatLabSynthV2OscilloscopeProps['osc2Wave'],
  level1: number,
  level2: number,
  width: number,
  height: number,
): string {
  const n = 128;
  const parts: string[] = [];
  for (let i = 0; i <= n; i += 1) {
    const x = (i / n) * width;
    const p = phase * 2 + (i / n) * 3;
    const y1 = sampleOsc(osc1Wave, p) * level1;
    const y2 = sampleOsc(osc2Wave, p * 1.02 + 0.13) * level2 * 0.92;
    const sum = Math.max(-1.2, Math.min(1.2, y1 + y2));
    const py = height * 0.5 - sum * (height * 0.38);
    parts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${py.toFixed(1)}`);
  }
  return parts.join(' ');
}

export function BeatLabSynthV2Oscilloscope({
  osc1Wave,
  osc2Wave,
  level1,
  level2,
  width = 280,
  height = 56,
  active = true,
}: BeatLabSynthV2OscilloscopeProps) {
  const pathRef = useRef<SVGPathElement>(null);
  const phaseRef = useRef(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;

    if (!active) {
      cancelAnimationFrame(rafRef.current);
      phaseRef.current = 0;
      path.setAttribute('d', buildScopePath(0, osc1Wave, osc2Wave, level1, level2, width, height));
      return;
    }

    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(32, now - last) / 1000;
      last = now;
      phaseRef.current += dt * (2.8 + Math.max(0.1, level1 + level2) * 1.2);
      path.setAttribute(
        'd',
        buildScopePath(phaseRef.current, osc1Wave, osc2Wave, level1, level2, width, height),
      );
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, osc1Wave, osc2Wave, level1, level2, width, height]);

  const strokeOpacity = active ? 1 : 0.45;

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{
        background: 'radial-gradient(ellipse at center, #0a1628 0%, #050810 85%)',
        borderRadius: 8,
        border: '1px solid #243044',
      }}
      aria-hidden
    >
      <defs>
        <linearGradient id="scopeGlow" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="#58c4ff" stopOpacity="0.05" />
          <stop offset="50%" stopColor="#7cf4c6" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#58c4ff" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={width} height={height} fill="url(#scopeGlow)" opacity={active ? 0.6 : 0.25} />
      <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke="#1e2840" strokeWidth={1} />
      <path
        ref={pathRef}
        d=""
        fill="none"
        stroke="#7cf4c6"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={strokeOpacity}
      />
    </svg>
  );
}
