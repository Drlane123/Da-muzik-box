'use client';

import { useId, useMemo } from 'react';

/** Log-spaced Hz labels (BASSMAKER-style low-end focus, extended for master bus). */
const FREQ_LABELS = [
  { hz: 10, label: '10' },
  { hz: 20, label: '20' },
  { hz: 40, label: '40' },
  { hz: 80, label: '80' },
  { hz: 160, label: '160' },
  { hz: 320, label: '320' },
  { hz: 640, label: '640' },
  { hz: 1000, label: '1k' },
  { hz: 2000, label: '2k' },
  { hz: 5000, label: '5k' },
  { hz: 10000, label: '10k' },
] as const;

const MIN_HZ = 10;
const MAX_HZ = 10000;

function hzToX(hz: number, width: number): number {
  const logMin = Math.log10(MIN_HZ);
  const logMax = Math.log10(MAX_HZ);
  const t = (Math.log10(Math.max(hz, MIN_HZ)) - logMin) / (logMax - logMin);
  return t * width;
}

/** Smooth filled spectrum shape (quadratic spline through log-spaced bands). */
function buildSpectrumPath(width: number, height: number, variant: 'ghost' | 'live'): string {
  const baseline = height - 4;
  const bands =
    variant === 'ghost'
      ? [
          [10, 0.52], [20, 0.5], [40, 0.78], [80, 0.55], [160, 0.42], [320, 0.35],
          [640, 0.28], [1000, 0.22], [2000, 0.16], [5000, 0.1], [10000, 0.06],
        ]
      : [
          [10, 0.58], [20, 0.55], [40, 0.88], [80, 0.62], [160, 0.48], [320, 0.4],
          [640, 0.32], [1000, 0.26], [2000, 0.18], [5000, 0.12], [10000, 0.07],
        ];

  const pts = bands.map(([hz, amp]) => ({
    x: hzToX(hz, width),
    y: baseline - amp * (height - 14),
  }));

  let d = `M0,${baseline} L${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const cur = pts[i];
    const cx = (prev.x + cur.x) / 2;
    d += ` Q${prev.x},${prev.y} ${cx},${(prev.y + cur.y) / 2}`;
    d += ` T${cur.x},${cur.y}`;
  }
  d += ` L${width},${baseline} Z`;
  return d;
}

type Props = {
  compact?: boolean;
  title?: string;
};

export function BassmakerSpectrumMeter({ compact = false, title = 'Spectrum' }: Props) {
  const uid = useId().replace(/:/g, '');
  const w = 1000;
  const h = compact ? 100 : 140;

  const ghostPath = useMemo(() => buildSpectrumPath(w, h, 'ghost'), [h]);
  const livePath = useMemo(() => buildSpectrumPath(w, h, 'live'), [h]);

  const gridLines = useMemo(() => {
    const verticals = FREQ_LABELS.map(({ hz }) => hzToX(hz, w));
    const horizontals = [0.15, 0.3, 0.45, 0.6, 0.75, 0.9].map((t) => 8 + t * (h - 16));
    return { verticals, horizontals };
  }, [h]);

  return (
    <div className={`mb-bassmaker-spec${compact ? ' mb-bassmaker-spec--compact' : ''}`}>
      <div className="mb-bassmaker-spec__freq-bar">
        {FREQ_LABELS.map(({ hz, label }) => (
          <span key={hz} style={{ left: `${(hzToX(hz, w) / w) * 100}%` }}>
            {label}
          </span>
        ))}
      </div>

      <div className="mb-bassmaker-spec__canvas">
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="mb-bassmaker-spec__svg" aria-hidden>
          <defs>
            <linearGradient id={`mbSpecGhost-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(120, 140, 170, 0.55)" />
              <stop offset="55%" stopColor="rgba(80, 100, 130, 0.35)" />
              <stop offset="100%" stopColor="rgba(40, 50, 70, 0.08)" />
            </linearGradient>
            <linearGradient id={`mbSpecLive-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255, 180, 120, 0.95)" />
              <stop offset="45%" stopColor="rgba(255, 130, 70, 0.75)" />
              <stop offset="100%" stopColor="rgba(200, 80, 40, 0.15)" />
            </linearGradient>
            <filter id={`mbSpecGlow-${uid}`} x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Grid */}
          {gridLines.horizontals.map((y) => (
            <line key={`h-${y}`} x1={0} y1={y} x2={w} y2={y} className="mb-bassmaker-spec__grid-h" />
          ))}
          {gridLines.verticals.map((x) => (
            <line key={`v-${x}`} x1={x} y1={8} x2={x} y2={h - 4} className="mb-bassmaker-spec__grid-v" />
          ))}

          {/* Reference / input ghost */}
          <path d={ghostPath} fill={`url(#mbSpecGhost-${uid})`} className="mb-bassmaker-spec__ghost" />

          {/* Live processed curve */}
          <path
            d={livePath}
            fill={`url(#mbSpecLive-${uid})`}
            className="mb-bassmaker-spec__live"
            filter={`url(#mbSpecGlow-${uid})`}
          />
          <path d={livePath.replace(/ Z$/, '')} fill="none" className="mb-bassmaker-spec__live-edge" />
        </svg>

        <span className="mb-bassmaker-spec__hz-unit">Hz</span>
      </div>

      {!compact && <div className="mb-bassmaker-spec__caption">{title}</div>}
    </div>
  );
}
