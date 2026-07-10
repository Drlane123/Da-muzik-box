'use client';

import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';

const KEY_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/** Circle of fifths — clockwise from F (matches Studio One / Chord Genie layout). */
const MAJOR_ROOTS = [5, 0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10] as const;
const MINOR_ROOTS = [2, 9, 4, 11, 6, 1, 8, 3, 10, 5, 0, 7] as const;
const MAJOR_LABELS = ['F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb'] as const;
const MINOR_LABELS = ['Dm', 'Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'Bbm', 'Fm', 'Cm', 'Gm'] as const;

function wedgePath(cx: number, cy: number, r0: number, r1: number, i: number, total: number): string {
  const a0 = (i / total) * Math.PI * 2 - Math.PI / 2;
  const a1 = ((i + 1) / total) * Math.PI * 2 - Math.PI / 2;
  const x0o = cx + Math.cos(a0) * r1;
  const y0o = cy + Math.sin(a0) * r1;
  const x1o = cx + Math.cos(a1) * r1;
  const y1o = cy + Math.sin(a1) * r1;
  const x0i = cx + Math.cos(a0) * r0;
  const y0i = cy + Math.sin(a0) * r0;
  const x1i = cx + Math.cos(a1) * r0;
  const y1i = cy + Math.sin(a1) * r0;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${x0i} ${y0i} L ${x0o} ${y0o} A ${r1} ${r1} 0 ${large} 1 ${x1o} ${y1o} L ${x1i} ${y1i} A ${r0} ${r0} 0 ${large} 0 ${x0i} ${y0i} Z`;
}

export type GenoChordCreatorWheelProps = {
  keyRoot: number;
  mode: ChordMode;
  disabled?: boolean;
  /** Pixel width of SVG (height matches). */
  size?: number;
  /** Tighter chrome when stacked with mini roll below. */
  compact?: boolean;
  onSelect: (root: number, mode: ChordMode) => void;
};

export function GenoChordCreatorWheel({
  keyRoot,
  mode,
  disabled = false,
  size = 280,
  compact = false,
  onSelect,
}: GenoChordCreatorWheelProps) {
  const cx = size / 2;
  const cy = size / 2;
  const selectedRoot = ((keyRoot % 12) + 12) % 12;
  const outerR = size * 0.46;
  const innerOuterR = size * 0.27;
  const innerInnerR = size * 0.14;
  const centerR = size * 0.11;
  const majorLabelR = size * (compact ? 0.39 : 0.375);
  const minorLabelR = size * (compact ? 0.215 : 0.205);
  const majorFontSize = size * (compact ? 0.062 : 0.048);
  const minorFontSize = size * (compact ? 0.048 : 0.038);
  const centerKeyFontSize = size * (compact ? 0.052 : 0.045);
  const centerModeFontSize = size * (compact ? 0.032 : 0.028);

  const padH = compact ? 8 : 12;
  const padV = compact ? 6 : 10;

  return (
    <div
      className="relative flex flex-col items-center justify-center rounded-xl border shrink-0"
      style={{
        width: size + padH * 2,
        padding: `${padV}px ${padH}px`,
        borderColor: 'rgba(77,168,255,0.35)',
        background: 'linear-gradient(180deg, #1c2838 0%, #101820 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.45)',
      }}
    >
      <div
        className="w-full text-center font-black uppercase tracking-[0.22em]"
        style={{
          color: '#8ec8ff',
          fontSize: compact ? 9 : 10,
          marginBottom: compact ? 2 : 6,
        }}
      >
        Key selector
      </div>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block shrink-0" aria-label="Chord wheel">
        {MAJOR_ROOTS.map((root, i) => {
          const sel = mode === 'major' && root === selectedRoot;
          return (
            <g key={`maj-${root}`}>
              <path
                d={wedgePath(cx, cy, innerOuterR, outerR, i, 12)}
                fill={sel ? '#4DA8FF' : 'rgba(77,168,255,0.14)'}
                stroke="rgba(255,255,255,0.07)"
                strokeWidth={1}
                style={{ cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1 }}
                onClick={() => !disabled && onSelect(root, 'major')}
              />
              <text
                x={cx + Math.cos((i + 0.5) / 12 * Math.PI * 2 - Math.PI / 2) * majorLabelR}
                y={cy + Math.sin((i + 0.5) / 12 * Math.PI * 2 - Math.PI / 2) * majorLabelR}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={sel ? '#041018' : '#c8e0ff'}
                fontSize={majorFontSize}
                fontWeight={800}
                stroke={sel ? 'none' : '#0a1420'}
                strokeWidth={compact ? 0.6 : 0.4}
                paintOrder="stroke fill"
                style={{ pointerEvents: 'none' }}
              >
                {MAJOR_LABELS[i]}
              </text>
            </g>
          );
        })}
        {MINOR_ROOTS.map((root, i) => {
          const sel = mode === 'minor' && root === selectedRoot;
          return (
            <g key={`min-${root}`}>
              <path
                d={wedgePath(cx, cy, innerInnerR, innerOuterR, i, 12)}
                fill={sel ? '#7cf4c6' : 'rgba(124,244,198,0.12)'}
                stroke="rgba(255,255,255,0.05)"
                strokeWidth={1}
                style={{ cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1 }}
                onClick={() => !disabled && onSelect(root, 'minor')}
              />
              <text
                x={cx + Math.cos((i + 0.5) / 12 * Math.PI * 2 - Math.PI / 2) * minorLabelR}
                y={cy + Math.sin((i + 0.5) / 12 * Math.PI * 2 - Math.PI / 2) * minorLabelR}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={sel ? '#041018' : '#9aefd4'}
                fontSize={minorFontSize}
                fontWeight={700}
                stroke={sel ? 'none' : '#0a1420'}
                strokeWidth={compact ? 0.55 : 0.35}
                paintOrder="stroke fill"
                style={{ pointerEvents: 'none' }}
              >
                {MINOR_LABELS[i]}
              </text>
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r={centerR} fill="#0a1420" stroke="rgba(77,168,255,0.4)" strokeWidth={2} />
        <text x={cx} y={cy - 2} textAnchor="middle" fill="#ececf4" fontSize={centerKeyFontSize} fontWeight={800}>
          {mode === 'minor' ? MINOR_LABELS[MINOR_ROOTS.indexOf(selectedRoot as (typeof MINOR_ROOTS)[number])] ?? `${KEY_NAMES[selectedRoot]}m` : MAJOR_LABELS[MAJOR_ROOTS.indexOf(selectedRoot as (typeof MAJOR_ROOTS)[number])] ?? KEY_NAMES[selectedRoot]}
        </text>
        <text
          x={cx}
          y={cy + size * 0.038}
          textAnchor="middle"
          fill="#8ec8ff"
          fontSize={centerModeFontSize}
          fontWeight={700}
          letterSpacing="0.14em"
        >
          {mode === 'minor' ? 'MINOR' : 'MAJOR'}
        </text>
      </svg>
      {!compact ? (
        <p className="text-center w-full mt-2 px-1 pb-1 text-[9px] leading-snug" style={{ color: '#6a8098' }}>
          Outer = major · inner = minor — click a chord to set key and fill cards
        </p>
      ) : null}
    </div>
  );
}

export function genoChordCreatorKeyDisplayLabel(keyRoot: number, mode: ChordMode): string {
  const r = ((keyRoot % 12) + 12) % 12;
  const majIdx = MAJOR_ROOTS.indexOf(r as (typeof MAJOR_ROOTS)[number]);
  const minIdx = MINOR_ROOTS.indexOf(r as (typeof MINOR_ROOTS)[number]);
  if (mode === 'minor' && minIdx >= 0) return `${MINOR_LABELS[minIdx]} MINOR`;
  if (majIdx >= 0) return `${MAJOR_LABELS[majIdx]} MAJOR`;
  const name = KEY_NAMES[r] ?? 'C';
  return mode === 'minor' ? `${name} MINOR` : `${name} MAJOR`;
}
