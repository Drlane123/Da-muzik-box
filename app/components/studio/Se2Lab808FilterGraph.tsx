'use client';

import { useId, useMemo } from 'react';

export type Se2Lab808FilterGraphProps = {
  hpHz: number;
  lpHz: number;
  accent?: string;
  hpScaleHz?: number;
  hpFloorHz?: number;
  lpScaleHz?: number;
  lpMinActiveHz?: number;
};

const HP_CUT = '#f97316';
const LP_CUT = '#a78bfa';

export function Se2Lab808FilterGraph({
  hpHz,
  lpHz,
  accent = '#58c4ff',
  hpScaleHz = 400,
  hpFloorHz = 5,
  lpScaleHz = 16000,
  lpMinActiveHz = 1,
}: Se2Lab808FilterGraphProps) {
  const passGrad = useId().replace(/:/g, '');
  const hpGrad = useId().replace(/:/g, '');
  const lpGrad = useId().replace(/:/g, '');
  const clipId = useId().replace(/:/g, '');

  const geom = useMemo(() => {
    const hp = hpHz > hpFloorHz ? Math.min(1, hpHz / hpScaleHz) : 0;
    const lp =
      lpHz <= 0 || lpHz >= lpScaleHz || lpHz < lpMinActiveHz
        ? 1
        : Math.max(0.12, lpHz / lpScaleHz);
    const yLo = 8 + (1 - lp) * 28;
    const yHi = 44 - hp * 22;
    const midY = (yHi + yLo) / 2;
    const curve = `M 0,${yHi.toFixed(1)} Q 30,${yHi.toFixed(1)} 45,${midY.toFixed(1)} T 100,${yLo.toFixed(1)}`;
    const passFill = `${curve} L 100,44 L 0,44 Z`;
    const hpCutW = 6 + hp * 34;
    const hpCut = `M 0,44 L 0,${yHi.toFixed(1)} L ${hpCutW.toFixed(1)},${(yHi + (44 - yHi) * 0.55).toFixed(1)} L ${(hpCutW * 0.45).toFixed(1)},44 Z`;
    const lpCutW = 100 - (1 - lp) * 34;
    const lpCut = `M 100,6 L 100,${yLo.toFixed(1)} L ${lpCutW.toFixed(1)},${(yLo - (yLo - 6) * 0.5).toFixed(1)} L ${((100 + lpCutW) / 2).toFixed(1)},6 Z`;
    const hpLineX = hpCutW * 0.72;
    const lpLineX = lpCutW + (100 - lpCutW) * 0.28;
    return {
      hp,
      lp,
      yHi,
      yLo,
      curve,
      passFill,
      hpCut,
      lpCut,
      hpActive: hp > 0.02,
      lpActive: lp < 0.98,
      hpLineX,
      lpLineX,
    };
  }, [hpFloorHz, hpHz, hpScaleHz, lpHz, lpMinActiveHz, lpScaleHz]);

  const live = geom.hpActive || geom.lpActive;

  return (
    <svg
      viewBox="0 0 100 52"
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      role="img"
      aria-label="High-pass and low-pass filter response"
      className="lab808-filter-viz-svg"
    >
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y="0" width="100" height="52" />
        </clipPath>
        <linearGradient id={passGrad} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={accent} stopOpacity={0.42} />
          <stop offset="55%" stopColor={accent} stopOpacity={0.18} />
          <stop offset="100%" stopColor={accent} stopOpacity={0.06} />
        </linearGradient>
        <linearGradient id={hpGrad} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={HP_CUT} stopOpacity={0.55} />
          <stop offset="100%" stopColor={HP_CUT} stopOpacity={0.04} />
        </linearGradient>
        <linearGradient id={lpGrad} x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={LP_CUT} stopOpacity={0.5} />
          <stop offset="100%" stopColor={LP_CUT} stopOpacity={0.04} />
        </linearGradient>
      </defs>

      <g clipPath={`url(#${clipId})`}>
      {/* spectrum floor */}
      <line x1="0" y1="44" x2="100" y2="44" stroke="rgba(255,255,255,0.08)" />
      <line x1="0" y1="26" x2="100" y2="26" stroke="rgba(255,255,255,0.03)" strokeDasharray="2 4" />

      {/* HP low-cut zone */}
      {geom.hpActive ? (
        <path
          d={geom.hpCut}
          fill={`url(#${hpGrad})`}
          className="lab808-filter-viz-cut-hp"
          opacity={0.85}
        />
      ) : null}

      {/* LP high-cut zone */}
      {geom.lpActive ? (
        <path
          d={geom.lpCut}
          fill={`url(#${lpGrad})`}
          className="lab808-filter-viz-cut-lp"
          opacity={0.85}
        />
      ) : null}

      {/* illuminated pass band */}
      <path
        d={geom.passFill}
        fill={`url(#${passGrad})`}
        className={live ? 'lab808-filter-viz-pass' : undefined}
        opacity={live ? 0.9 : 0.35}
      />

      {/* cut boundary markers */}
      {geom.hpActive ? (
        <line
          x1={geom.hpLineX}
          y1={geom.yHi}
          x2={geom.hpLineX}
          y2={44}
          stroke={HP_CUT}
          strokeWidth={1}
          strokeDasharray="2 2"
          className="lab808-filter-viz-marker-hp"
          opacity={0.75}
        />
      ) : null}
      {geom.lpActive ? (
        <line
          x1={geom.lpLineX}
          y1={6}
          x2={geom.lpLineX}
          y2={geom.yLo}
          stroke={LP_CUT}
          strokeWidth={1}
          strokeDasharray="2 2"
          className="lab808-filter-viz-marker-lp"
          opacity={0.75}
        />
      ) : null}

      {/* response curve */}
      <path
        d={geom.curve}
        fill="none"
        stroke={accent}
        strokeWidth={2}
        strokeLinecap="round"
        className={live ? 'lab808-filter-viz-curve' : undefined}
        opacity={live ? 1 : 0.5}
      />
      </g>
    </svg>
  );
}
