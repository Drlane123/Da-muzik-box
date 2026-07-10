'use client';

import { useCallback, useMemo } from 'react';
import {
  SE2_GUITAR_FRET_COUNT,
  SE2_GUITAR_FRET_MARKERS,
  SE2_GUITAR_STRING_LABELS,
  se2GuitarFretCell,
  type Se2GuitarFretDot,
} from '@/app/lib/studio/se2GuitarFretboard';

const ACCENT = '#E8A040';
const GLOW = '#fff8a0';
const FRET_COLS = SE2_GUITAR_FRET_COUNT + 1;
const STRING_ORDER = [5, 4, 3, 2, 1, 0] as const;

export type Se2GuitarStageNeckProps = {
  capo?: number;
  disabled?: boolean;
  highlightDots?: readonly Se2GuitarFretDot[];
  activeString?: number | null;
  onFretPlay?: (midi: number, velocity?: number, placement?: Se2GuitarFretDot) => void;
  onFretInsert?: (midi: number) => void;
  onPrimeAudio?: () => void;
};

/** Horizontal neck on the guitar image — glows on play + click strings to audition. */
export function Se2GuitarStageNeck({
  capo = 0,
  disabled = false,
  highlightDots = [],
  activeString = null,
  onFretPlay,
  onFretInsert,
  onPrimeAudio,
}: Se2GuitarStageNeckProps) {
  const lit = useMemo(() => {
    const s = new Set<string>();
    for (const d of highlightDots) s.add(`${d.stringIndex}:${d.fret}`);
    return s;
  }, [highlightDots]);

  const handleCell = useCallback(
    (stringIndex: number, fret: number, insert = false) => {
      if (disabled || !onFretPlay) return;
      onPrimeAudio?.();
      const placement: Se2GuitarFretDot = { stringIndex, fret };
      const cell = se2GuitarFretCell(stringIndex, fret, capo);
      onFretPlay(cell.midi, fret === 0 ? 100 : 96, placement);
      if (insert && onFretInsert) onFretInsert(cell.midi);
    },
    [capo, disabled, onFretInsert, onFretPlay, onPrimeAudio],
  );

  const interactive = Boolean(onFretPlay) && !disabled;

  return (
    <div
      className="absolute z-[4] overflow-hidden rounded-sm border"
      style={{
        inset: '4% 2% 4% 2%',
        borderColor: `${ACCENT}88`,
        background: 'linear-gradient(180deg, #4a3c30 0%, #1a140c 55%, #100c08 100%)',
        boxShadow: `0 0 20px ${ACCENT}44, inset 0 1px 0 #ffffff22`,
      }}
      data-se2-guitar-stage-neck
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className="grid h-full w-full"
        style={{ gridTemplateColumns: `20px repeat(${FRET_COLS}, minmax(0, 1fr))` }}
      >
        <div className="flex h-[12px] items-center justify-center border-b border-r border-[#6a5848]/70 text-[5px] font-black text-[#8a7868]">
          ·
        </div>
        {Array.from({ length: FRET_COLS }, (_, fret) => (
          <div
            key={`h-${fret}`}
            className="flex h-[12px] items-end justify-center border-b border-[#6a5848]/50 pb-px text-[5px] font-bold"
            style={{ color: SE2_GUITAR_FRET_MARKERS.includes(fret) ? ACCENT : '#5a5048' }}
          >
            {SE2_GUITAR_FRET_MARKERS.includes(fret) ? fret : ''}
          </div>
        ))}

        {STRING_ORDER.map((stringIndex) => {
          const stringLit = activeString === stringIndex;
          return (
            <div key={`row-${stringIndex}`} className="contents">
              <div
                className="flex min-h-[12px] items-center justify-center border-b border-r border-[#6a5848]/60 text-[7px] font-bold"
                style={{ color: stringLit ? GLOW : '#b8a888' }}
              >
                {SE2_GUITAR_STRING_LABELS[stringIndex]}
              </div>
              {Array.from({ length: FRET_COLS }, (_, fret) => {
                const key = `${stringIndex}:${fret}`;
                const isLit = lit.has(key);
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={!interactive}
                    className="relative min-h-[12px] border-b border-r border-[#6a5848]/40 transition-all"
                    style={{
                      background: isLit
                        ? `radial-gradient(ellipse 80% 90% at 50% 50%, ${ACCENT} 0%, #3a2818 100%)`
                        : stringLit
                          ? '#3a3028'
                          : 'transparent',
                      boxShadow: isLit ? `inset 0 0 10px ${ACCENT}, 0 0 8px ${ACCENT}aa` : undefined,
                      cursor: interactive ? 'pointer' : 'default',
                    }}
                    onClick={() => handleCell(stringIndex, fret)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      handleCell(stringIndex, fret, true);
                    }}
                  >
                    <span
                      className="pointer-events-none absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2"
                      style={{
                        background: isLit ? '#fffef8' : '#e8c060',
                        opacity: isLit ? 1 : stringLit ? 0.9 : 0.35,
                        boxShadow: isLit ? `0 0 8px ${GLOW}` : undefined,
                      }}
                    />
                    {isLit ? (
                      <span
                        className="pointer-events-none absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
                        style={{
                          background: ACCENT,
                          boxShadow: `0 0 12px ${ACCENT}, 0 0 4px #fff`,
                        }}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
