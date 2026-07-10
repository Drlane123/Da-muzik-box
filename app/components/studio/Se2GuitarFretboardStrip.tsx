'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  SE2_GUITAR_FRET_COUNT,
  SE2_GUITAR_FRET_MARKERS,
  SE2_GUITAR_STRING_LABELS,
  se2GuitarFretCell,
  type Se2GuitarFretDot,
} from '@/app/lib/studio/se2GuitarFretboard';
import {
  SE2_GUITAR_ROOT_OPTIONS,
  SE2_GUITAR_SCALE_OPTIONS,
  se2GuitarPitchClassInScale,
  type Se2GuitarScaleId,
} from '@/app/lib/studio/se2GuitarScales';

import { Se2GuitarDarkSelect } from '@/app/components/studio/Se2GuitarDarkSelect';
import { SE2_GUITAR_UI } from '@/app/lib/studio/se2GuitarUiTheme';

const ACCENT = SE2_GUITAR_UI.accent;
const SCALE_BORDER = '#7cf4c655';
const FRET_COLS = SE2_GUITAR_FRET_COUNT + 1;
/** Display top → bottom: high e … low E */
const STRING_ORDER = [5, 4, 3, 2, 1, 0] as const;
const ROOT_OPTIONS = SE2_GUITAR_ROOT_OPTIONS.map((r) => ({ value: r, label: r }));
const SCALE_OPTIONS = SE2_GUITAR_SCALE_OPTIONS.map((o) => ({ value: o.id, label: o.label }));

export type Se2GuitarFretboardStripProps = {
  capo?: number;
  disabled?: boolean;
  highlightDots?: readonly Se2GuitarFretDot[];
  activeString?: number | null;
  root?: string;
  scaleId?: Se2GuitarScaleId;
  onRootChange?: (root: string) => void;
  onScaleChange?: (scaleId: Se2GuitarScaleId) => void;
  onFretPlay: (midi: number, velocity?: number, placement?: Se2GuitarFretDot) => void;
  onFretInsert?: (midi: number) => void;
  onPrimeAudio?: () => void;
};

/**
 * Full-width guitar scale fretboard — tap frets to play; scale tones highlighted.
 */
export function Se2GuitarFretboardStrip({
  capo = 0,
  disabled = false,
  highlightDots = [],
  activeString = null,
  root: rootProp,
  scaleId: scaleIdProp,
  onRootChange,
  onScaleChange,
  onFretPlay,
  onFretInsert,
  onPrimeAudio,
}: Se2GuitarFretboardStripProps) {
  const [rootLocal, setRootLocal] = useState<string>('A');
  const [scaleIdLocal, setScaleIdLocal] = useState<Se2GuitarScaleId>('pentMinor');
  const root = rootProp ?? rootLocal;
  const scaleId = scaleIdProp ?? scaleIdLocal;
  const setRoot = onRootChange ?? setRootLocal;
  const setScaleId = onScaleChange ?? setScaleIdLocal;

  const lit = useMemo(() => {
    const s = new Set<string>();
    for (const d of highlightDots) s.add(`${d.stringIndex}:${d.fret}`);
    return s;
  }, [highlightDots]);

  const handleCell = useCallback(
    (stringIndex: number, fret: number, insert = false) => {
      if (disabled) return;
      onPrimeAudio?.();
      const placement: Se2GuitarFretDot = { stringIndex, fret };
      const cell = se2GuitarFretCell(stringIndex, fret, capo);
      onFretPlay(cell.midi, fret === 0 ? 100 : 96, placement);
      if (insert && onFretInsert) onFretInsert(cell.midi);
    },
    [capo, disabled, onFretInsert, onFretPlay, onPrimeAudio],
  );

  return (
    <div
      className="w-full shrink-0 px-1 py-1"
      data-se2-guitar-fretboard-strip
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="mb-1 flex flex-wrap items-center justify-center gap-2 px-1">
        <label className="inline-flex items-center gap-1 text-[7px] font-bold uppercase" style={{ color: SE2_GUITAR_UI.textMuted }}>
          Key
          <Se2GuitarDarkSelect
            value={root}
            disabled={disabled}
            onChange={setRoot}
            options={ROOT_OPTIONS}
          />
        </label>
        <label className="inline-flex items-center gap-1 text-[7px] font-bold uppercase" style={{ color: SE2_GUITAR_UI.textMuted }}>
          Scale
          <Se2GuitarDarkSelect
            value={scaleId}
            disabled={disabled}
            onChange={(v) => setScaleId(v as Se2GuitarScaleId)}
            options={SCALE_OPTIONS}
          />
        </label>
        <span className="text-[6px] font-semibold uppercase tracking-wider" style={{ color: SE2_GUITAR_UI.textSoft }}>
          Mint = in scale
        </span>
      </div>

      <div
        className="overflow-hidden rounded border"
        style={{
          borderColor: SE2_GUITAR_UI.border,
          background: SE2_GUITAR_UI.fretboardBg,
          boxShadow: 'inset 0 2px 6px #0008',
        }}
      >
        <div
          className="grid w-full"
          style={{
            gridTemplateColumns: `28px repeat(${FRET_COLS}, minmax(0, 1fr))`,
          }}
        >
          <div className="flex h-[18px] items-center justify-center border-b border-r text-[6px] font-black" style={{ borderColor: SE2_GUITAR_UI.borderSoft, color: SE2_GUITAR_UI.textSoft }}>
            STR
          </div>
          {Array.from({ length: FRET_COLS }, (_, fret) => (
            <div
              key={`h-${fret}`}
              className="flex h-[18px] items-end justify-center border-b pb-px text-[6px] font-bold tabular-nums"
              style={{ borderColor: SE2_GUITAR_UI.borderSoft, color: SE2_GUITAR_FRET_MARKERS.includes(fret) ? ACCENT : SE2_GUITAR_UI.textSoft }}
            >
              {fret}
            </div>
          ))}

          {STRING_ORDER.map((stringIndex) => {
            const stringLit = activeString === stringIndex;
            return (
              <div key={`row-${stringIndex}`} className="contents">
                <div
                  className="flex min-h-[28px] items-center justify-center border-b border-r text-[8px] font-bold"
                  style={{ borderColor: SE2_GUITAR_UI.borderSoft, color: stringLit ? ACCENT : SE2_GUITAR_UI.textMuted }}
                >
                  {SE2_GUITAR_STRING_LABELS[stringIndex]}
                </div>
                {Array.from({ length: FRET_COLS }, (_, fret) => {
                  const cellKey = `${stringIndex}:${fret}`;
                  const cell = se2GuitarFretCell(stringIndex, fret, capo);
                  const isPlaying = lit.has(cellKey);
                  const inScale = se2GuitarPitchClassInScale(cell.midi, root, scaleId, capo);
                  const noteShort = cell.label.replace(/\d+$/, '');
                  return (
                    <button
                      key={cellKey}
                      type="button"
                      disabled={disabled}
                      title={`${cell.label} — click to play · right-click insert`}
                      className="relative min-h-[28px] border-b border-r transition-colors disabled:opacity-40"
                      style={{
                        borderColor: SE2_GUITAR_UI.borderSoft,
                        background: isPlaying
                          ? `linear-gradient(180deg, ${ACCENT}88 0%, ${ACCENT}33 100%)`
                          : inScale
                            ? SE2_GUITAR_UI.fretCellScale
                            : SE2_GUITAR_UI.fretCell,
                        boxShadow: inScale ? `inset 0 0 0 1px ${SCALE_BORDER}` : undefined,
                      }}
                      onClick={() => handleCell(stringIndex, fret)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        handleCell(stringIndex, fret, true);
                      }}
                    >
                      <span
                        className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2"
                        style={{
                          background: stringLit || isPlaying ? '#fff8c0' : '#c8a04044',
                          opacity: stringLit || isPlaying ? 1 : 0.35,
                        }}
                      />
                      <span
                        className="pointer-events-none relative z-[1] text-[7px] font-bold leading-none"
                        style={{ color: inScale ? '#7cf4c6' : isPlaying ? ACCENT : '#5a5048' }}
                      >
                        {noteShort}
                      </span>
                      {isPlaying ? (
                        <span
                          className="pointer-events-none absolute left-1/2 top-[62%] h-2 w-2 -translate-x-1/2 rounded-full border border-white/50"
                          style={{ background: ACCENT, boxShadow: `0 0 6px ${ACCENT}` }}
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
      <p className="mt-1 text-center text-[6px] font-semibold uppercase tracking-wider text-[#5a5848]">
        Click a note to play · right-click to insert on MIDI roll
      </p>
    </div>
  );
}
