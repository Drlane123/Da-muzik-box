'use client';

import { useMemo } from 'react';
import {
  SE2_GUITAR_FRET_COUNT,
  SE2_GUITAR_SVG_H,
  SE2_GUITAR_SVG_LAYER1,
  SE2_GUITAR_SVG_W,
  SE2_GUITAR_STRING_COUNT,
  se2GuitarDotSvgCoords,
  se2GuitarFretCell,
  se2GuitarFretYSvg,
  se2GuitarNoteLabel,
  type Se2GuitarFretDot,
} from '@/app/lib/studio/se2GuitarFretboard';

const ACCENT = '#E8A040';
const STRING_IDLE = '#d4a84a';
const STRING_LIT = '#fff8c8';

export type Se2GuitarNeckOverlayProps = {
  capo?: number;
  highlightDots: readonly Se2GuitarFretDot[];
  activeString?: number | null;
  disabled?: boolean;
  /** @deprecated Visual only — use Se2GuitarFretGrid for interaction. */
  onFretPlay?: (midi: number, velocity?: number, placement?: Se2GuitarFretDot) => void;
  onFretInsert?: (midi: number) => void;
  onPrimeAudio?: () => void;
};

function glowStartFret(capo: number): number {
  return capo > 0 ? Math.min(capo, SE2_GUITAR_FRET_COUNT) : 0;
}

/** String glow + fret dots on the guitar art — pointer-events none (hits via Se2GuitarFretGrid). */
export function Se2GuitarNeckOverlay({
  capo = 0,
  highlightDots,
  activeString = null,
}: Se2GuitarNeckOverlayProps) {
  const layerTransform = `translate(${SE2_GUITAR_SVG_LAYER1.tx}, ${SE2_GUITAR_SVG_LAYER1.ty})`;

  const fretWireYs = useMemo(
    () => Array.from({ length: SE2_GUITAR_FRET_COUNT + 1 }, (_, f) => se2GuitarFretYSvg(f)),
    [],
  );

  const litStrings = useMemo(() => {
    const s = new Set<number>();
    if (activeString != null) s.add(activeString);
    for (const d of highlightDots) s.add(d.stringIndex);
    return s;
  }, [activeString, highlightDots]);

  const yNut = se2GuitarFretYSvg(glowStartFret(capo));

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[5] h-full w-full touch-none select-none"
      viewBox={`0 0 ${SE2_GUITAR_SVG_W} ${SE2_GUITAR_SVG_H}`}
      preserveAspectRatio="none"
      data-se2-guitar-neck-overlay
      aria-hidden
    >
      <defs>
        <filter id="se2-guitar-string-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="se2-guitar-dot-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g transform={layerTransform}>
        {fretWireYs.map((y, f) => (
          <line
            key={`wire-${f}`}
            x1={52}
            y1={y}
            x2={130}
            y2={y}
            stroke="#ffffff"
            strokeOpacity={f === 0 ? 0.5 : 0.18}
            strokeWidth={f === 0 ? 1.8 : 0.7}
          />
        ))}

        {Array.from({ length: SE2_GUITAR_STRING_COUNT }, (_, s) => {
          const nut = se2GuitarDotSvgCoords(s, 0, capo);
          const bridge = se2GuitarDotSvgCoords(s, SE2_GUITAR_FRET_COUNT, capo);
          const lit = litStrings.has(s);
          return (
            <g key={`str-${s}`}>
              {lit ? (
                <line
                  x1={nut.xNut}
                  y1={nut.yNut}
                  x2={bridge.x}
                  y2={bridge.y}
                  stroke={STRING_LIT}
                  strokeWidth={5}
                  strokeOpacity={0.55}
                  strokeLinecap="round"
                  filter="url(#se2-guitar-string-glow)"
                />
              ) : null}
              <line
                x1={nut.xNut}
                y1={nut.yNut}
                x2={bridge.x}
                y2={bridge.y}
                stroke={lit ? STRING_LIT : STRING_IDLE}
                strokeOpacity={lit ? 1 : 0.82}
                strokeWidth={lit ? 2.4 : 1.8}
                strokeLinecap="round"
                filter={lit ? 'url(#se2-guitar-string-glow)' : undefined}
              />
            </g>
          );
        })}

        {highlightDots.map((dot) => {
          const { xNut, yNut, x, y } = se2GuitarDotSvgCoords(dot.stringIndex, dot.fret, capo);
          const label = se2GuitarNoteLabel(se2GuitarFretCell(dot.stringIndex, dot.fret, capo).midi);
          return (
            <g key={`dot-${dot.stringIndex}-${dot.fret}`}>
              <line
                x1={xNut}
                y1={yNut}
                x2={x}
                y2={y}
                stroke="#ffffff"
                strokeWidth={3}
                strokeOpacity={0.95}
                strokeLinecap="round"
              />
              <circle
                cx={x}
                cy={y}
                r={8}
                fill="#ffffff"
                stroke={ACCENT}
                strokeWidth={2}
                filter="url(#se2-guitar-dot-glow)"
              />
              <text
                x={x}
                y={y - 12}
                textAnchor="middle"
                fontSize={11}
                fontWeight={800}
                fill={ACCENT}
              >
                {label.replace(/\d+$/, '')}
              </text>
            </g>
          );
        })}

        {capo === 0 ? (
          <line
            x1={52}
            y1={yNut}
            x2={130}
            y2={yNut}
            stroke={ACCENT}
            strokeOpacity={0.55}
            strokeWidth={2.2}
          />
        ) : null}
      </g>
    </svg>
  );
}
