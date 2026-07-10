'use client';

import { useId, useMemo } from 'react';
import { envelopePath } from '@/app/components/studio/genoUltraAnaUi';
import { AnaFxModernFrame } from '@/app/components/studio/genoUltraFxVisuals';
import { GENO_BASS_THEME } from '@/app/components/studio/genoBassWoodUi';

const ENV_VIEW_W = 200;
const ENV_VIEW_H = 80;

export function GenoBassEnvScreen({
  label,
  attack,
  decay,
  sustain,
  release,
  height = 64,
  attackMax = 800,
  decayMax = 1200,
  releaseMax = 2000,
  variant = 'filter',
}: {
  label: string;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  height?: number;
  attackMax?: number;
  decayMax?: number;
  releaseMax?: number;
  variant?: 'filter' | 'amp' | 'mod';
}) {
  const bgId = useId().replace(/:/g, '');
  const accent = variant === 'amp' ? GENO_BASS_THEME.amberHi : GENO_BASS_THEME.sphinxHi;
  const glow = variant === 'amp' ? GENO_BASS_THEME.amberGlow : GENO_BASS_THEME.sphinxGlow;
  const fillTop = variant === 'amp' ? 'rgba(240,160,32,0.1)' : 'rgba(155,109,255,0.1)';

  const curvePath = useMemo(
    () => envelopePath(attack, decay, sustain, release, attackMax, decayMax, releaseMax),
    [attack, decay, sustain, release, attackMax, decayMax, releaseMax],
  );
  const fillPath = `${curvePath} L${ENV_VIEW_W},${ENV_VIEW_H} L0,${ENV_VIEW_H} Z`;

  return (
    <AnaFxModernFrame height={height} minHeight={height} style={{ width: '100%' }}>
      <svg viewBox={`0 0 ${ENV_VIEW_W} ${ENV_VIEW_H}`} width="100%" height="100%" preserveAspectRatio="none">
        <defs>
          <linearGradient id={bgId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fillTop} />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </linearGradient>
        </defs>
        <rect x={0} y={0} width={ENV_VIEW_W} height={ENV_VIEW_H} fill={`url(#${bgId})`} />
        {[20, 40, 60].map((y) => (
          <line key={y} x1={0} y1={y} x2={ENV_VIEW_W} y2={y} stroke="rgba(148,163,184,0.1)" strokeWidth={1} />
        ))}
        <text x={6} y={11} fill={GENO_BASS_THEME.labelDim} fontSize={6.5} fontWeight={700} fontFamily="ui-monospace, monospace">
          {label}
        </text>
        <text x={6} y={21} fill={accent} fontSize={5.5} fontWeight={800} opacity={0.9}>
          A {attack.toFixed(0)} · D {decay.toFixed(0)} · S {(sustain * 100).toFixed(0)}% · R {release.toFixed(0)}
        </text>
        <path d={fillPath} fill={accent} opacity={0.2} stroke="none" />
        <path
          d={curvePath}
          fill="none"
          stroke={accent}
          strokeWidth={2.4}
          opacity={0.95}
          vectorEffect="non-scaling-stroke"
          style={{ filter: `drop-shadow(0 0 6px ${glow})` }}
        />
      </svg>
    </AnaFxModernFrame>
  );
}
