'use client';

import {
  se2GuitarKeyShiftLabel,
  se2GuitarTransposeChordLine,
} from '@/app/lib/studio/se2GuitarKeyConvert';
import {
  SE2_GUITAR_ROOT_OPTIONS,
  SE2_GUITAR_SCALE_OPTIONS,
  type Se2GuitarScaleId,
} from '@/app/lib/studio/se2GuitarScales';
import { Se2GuitarDarkSelect } from '@/app/components/studio/Se2GuitarDarkSelect';
import { SE2_GUITAR_UI } from '@/app/lib/studio/se2GuitarUiTheme';

const ACCENT = SE2_GUITAR_UI.accent;

const ROOT_OPTIONS = SE2_GUITAR_ROOT_OPTIONS.map((r) => ({ value: r, label: r }));
const SCALE_OPTIONS = SE2_GUITAR_SCALE_OPTIONS.map((o) => ({ value: o.id, label: o.label }));

export type Se2GuitarKeyConvertBarProps = {
  disabled?: boolean;
  selectionLabel?: string;
  chordLine?: string;
  sourceKey: string;
  targetKey: string;
  scaleId: Se2GuitarScaleId;
  keyShiftSemis: number;
  onConvertKey: () => void;
  onResetKey?: () => void;
  onTargetKeyChange?: (root: string) => void;
  onScaleIdChange?: (scaleId: Se2GuitarScaleId) => void;
};

export function Se2GuitarKeyConvertBar({
  disabled = false,
  selectionLabel,
  chordLine,
  sourceKey,
  targetKey,
  scaleId,
  keyShiftSemis,
  onConvertKey,
  onResetKey,
  onTargetKeyChange,
  onScaleIdChange,
}: Se2GuitarKeyConvertBarProps) {
  const convertedLine =
    chordLine && keyShiftSemis !== 0
      ? se2GuitarTransposeChordLine(chordLine, keyShiftSemis)
      : chordLine;

  return (
    <div
      className="flex flex-col gap-1.5 rounded border px-2 py-1.5"
      style={{ borderColor: `${ACCENT}33`, background: SE2_GUITAR_UI.insetBg }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[7px] font-black uppercase tracking-wider" style={{ color: ACCENT }}>
          Key convert
        </span>
        {selectionLabel ? (
          <span className="truncate text-[7px] font-bold" style={{ color: SE2_GUITAR_UI.textMuted }}>
            · {selectionLabel}
          </span>
        ) : (
          <span className="text-[7px] font-bold" style={{ color: SE2_GUITAR_UI.textSoft }}>
            · select a loop below
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-1 text-[7px] font-bold uppercase" style={{ color: SE2_GUITAR_UI.textMuted }}>
          Target key
          <Se2GuitarDarkSelect
            value={targetKey}
            disabled={disabled || !onTargetKeyChange}
            onChange={(v) => onTargetKeyChange?.(v)}
            options={ROOT_OPTIONS}
            title="Transpose loops to this key"
          />
        </label>
        <label className="inline-flex items-center gap-1 text-[7px] font-bold uppercase" style={{ color: SE2_GUITAR_UI.textMuted }}>
          Scale
          <Se2GuitarDarkSelect
            value={scaleId}
            disabled={disabled || !onScaleIdChange}
            onChange={(v) => onScaleIdChange?.(v as Se2GuitarScaleId)}
            options={SCALE_OPTIONS}
            title="Scale for convert label"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <span
          className="rounded px-1.5 py-0.5 text-[7px] font-bold tabular-nums"
          style={{ background: SE2_GUITAR_UI.surfaceBg, color: SE2_GUITAR_UI.textMuted }}
        >
          Loop key: {sourceKey}
        </span>
        <span className="text-[7px]" style={{ color: SE2_GUITAR_UI.textSoft }}>
          →
        </span>
        <span
          className="rounded px-1.5 py-0.5 text-[7px] font-black tabular-nums"
          style={{
            background: keyShiftSemis !== 0 ? `${ACCENT}22` : SE2_GUITAR_UI.surfaceBg,
            color: keyShiftSemis !== 0 ? ACCENT : SE2_GUITAR_UI.textMuted,
          }}
        >
          {se2GuitarKeyShiftLabel(sourceKey, targetKey, scaleId, keyShiftSemis)}
        </span>
      </div>

      {convertedLine ? (
        <span className="text-[6px] font-semibold leading-snug" style={{ color: SE2_GUITAR_UI.textMuted }}>
          {convertedLine}
        </span>
      ) : null}

      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          disabled={disabled || !selectionLabel}
          onClick={onConvertKey}
          className="rounded border px-2 py-1 text-[7px] font-black uppercase disabled:opacity-40"
          style={{ borderColor: `${ACCENT}66`, background: `${ACCENT}18`, color: ACCENT }}
          title={`Transpose to ${targetKey}`}
        >
          Convert key
        </button>
        {keyShiftSemis !== 0 && onResetKey ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onResetKey}
            className="rounded border px-2 py-1 text-[7px] font-bold uppercase disabled:opacity-40"
            style={{ borderColor: SE2_GUITAR_UI.border, background: SE2_GUITAR_UI.surfaceBg, color: SE2_GUITAR_UI.textMuted }}
          >
            Reset
          </button>
        ) : null}
      </div>
    </div>
  );
}
