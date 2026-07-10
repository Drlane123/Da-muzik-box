'use client';

/**
 * Discrete string × fret hit grid (scale-ninja / FretFlow pattern).
 * Only individual cells fire audio — clicks on the guitar body or outside the neck do nothing.
 */
import { useCallback, useMemo } from 'react';
import {
  SE2_GUITAR_FRET_COUNT,
  SE2_GUITAR_NECK_HORIZONTAL,
  SE2_GUITAR_STRING_LABELS,
  se2GuitarFretCell,
  type Se2GuitarFretDot,
} from '@/app/lib/studio/se2GuitarFretboard';

const ACCENT = '#E8A040';
const GLOW = '#fff8a0';
const FRET_COLS = SE2_GUITAR_FRET_COUNT + 1;

/** High e at top → low E at bottom (matches horizontal neck on the art). */
const STRING_ORDER = [5, 4, 3, 2, 1, 0] as const;

export type Se2GuitarFretGridProps = {
  capo?: number;
  disabled?: boolean;
  highlightDots?: readonly Se2GuitarFretDot[];
  activeString?: number | null;
  onFretPlay?: (midi: number, velocity?: number, placement?: Se2GuitarFretDot) => void;
  onFretInsert?: (midi: number) => void;
  onPrimeAudio?: () => void;
};

export function Se2GuitarFretGrid({
  capo = 0,
  disabled = false,
  highlightDots = [],
  activeString = null,
  onFretPlay,
  onFretInsert,
  onPrimeAudio,
}: Se2GuitarFretGridProps) {
  const lit = useMemo(() => {
    const s = new Set<string>();
    for (const d of highlightDots) s.add(`${d.stringIndex}:${d.fret}`);
    return s;
  }, [highlightDots]);

  const interactive = Boolean(onFretPlay) && !disabled;
  const bounds = SE2_GUITAR_NECK_HORIZONTAL;

  const handleCell = useCallback(
    (stringIndex: number, fret: number, insert = false) => {
      if (!interactive || !onFretPlay) return;
      onPrimeAudio?.();
      const placement: Se2GuitarFretDot = { stringIndex, fret };
      const cell = se2GuitarFretCell(stringIndex, fret, capo);
      onFretPlay(cell.midi, fret === 0 ? 100 : 96, placement);
      if (insert && onFretInsert) onFretInsert(cell.midi);
    },
    [capo, interactive, onFretInsert, onFretPlay, onPrimeAudio],
  );

  if (!interactive) return null;

  return (
    <div
      className="absolute z-[8] touch-none select-none"
      data-se2-guitar-fret-grid
      style={{
        left: `${bounds.left * 100}%`,
        top: `${bounds.top * 100}%`,
        width: `${bounds.width * 100}%`,
        height: `${bounds.height * 100}%`,
        pointerEvents: 'none',
      }}
      aria-label="Guitar fretboard"
    >
      <div
        className="grid h-full w-full"
        style={{
          gridTemplateColumns: `repeat(${FRET_COLS}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${STRING_ORDER.length}, minmax(0, 1fr))`,
          pointerEvents: 'none',
        }}
      >
        {STRING_ORDER.map((stringIndex) =>
          Array.from({ length: FRET_COLS }, (_, fret) => {
            const key = `${stringIndex}:${fret}`;
            const isLit = lit.has(key);
            const stringLit = activeString === stringIndex;
            return (
              <button
                key={key}
                type="button"
                title={`${SE2_GUITAR_STRING_LABELS[stringIndex]} string · fret ${fret}`}
                className="relative min-h-0 min-w-0 border-0 bg-transparent p-0 transition-colors"
                style={{
                  pointerEvents: 'auto',
                  cursor: 'pointer',
                  background: isLit
                    ? `radial-gradient(ellipse 70% 80% at 50% 50%, ${ACCENT}cc 0%, transparent 72%)`
                    : 'transparent',
                }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleCell(stringIndex, fret);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleCell(stringIndex, fret, true);
                }}
              >
                <span
                  className="pointer-events-none absolute inset-x-[8%] top-1/2 h-[2px] -translate-y-1/2 rounded-full"
                  style={{
                    background: isLit ? '#fffef8' : stringLit ? GLOW : '#e8c060',
                    opacity: isLit ? 1 : stringLit ? 0.85 : 0.45,
                    boxShadow: isLit ? `0 0 6px ${GLOW}` : undefined,
                  }}
                />
                {isLit ? (
                  <span
                    className="pointer-events-none absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white"
                    style={{
                      background: ACCENT,
                      boxShadow: `0 0 8px ${ACCENT}`,
                    }}
                  />
                ) : null}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}
