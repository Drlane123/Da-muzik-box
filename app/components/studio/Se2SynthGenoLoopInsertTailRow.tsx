'use client';

import { useMemo, useState } from 'react';
import type { GenoPassingChordOption } from '@/app/lib/studio/se2SynthGenoHarmonyIntel';
import {
  se2SynthGenoIsClassicPassingOption,
  se2SynthGenoIsColorPassingOption,
} from '@/app/lib/studio/se2SynthGenoHarmonyIntel';
import { Se2SynthGenoInsertAction } from '@/app/components/studio/Se2SynthGenoSelectionUi';

export type Se2SynthGenoLoopInsertTailRowProps = {
  accentHex?: string;
  disabled?: boolean;
  focusBar: number | null;
  fromRoman?: string;
  toRoman?: string;
  canInsert?: boolean;
  isLoopWrap?: boolean;
  options: readonly GenoPassingChordOption[];
  onInsert: (option: GenoPassingChordOption) => void;
};

function passingKindColor(kind: GenoPassingChordOption['kind'], isCluster?: boolean): string {
  if (isCluster) return '#00E5CC';
  switch (kind) {
    case 'emotional':
      return '#f472b6';
    case 'chromatic':
      return '#fbbf24';
    case 'cluster':
      return '#00E5CC';
    default:
      return '#a78bfa';
  }
}

export function Se2SynthGenoLoopInsertTailRow({
  accentHex = '#00E5CC',
  disabled = false,
  focusBar,
  fromRoman = '',
  toRoman = '',
  canInsert = false,
  isLoopWrap = false,
  options,
  onInsert,
}: Se2SynthGenoLoopInsertTailRowProps) {
  const [showColor, setShowColor] = useState(false);

  const classicOptions = useMemo(
    () => options.filter((o) => se2SynthGenoIsClassicPassingOption(o)),
    [options],
  );
  const colorOptions = useMemo(
    () => options.filter((o) => se2SynthGenoIsColorPassingOption(o)),
    [options],
  );

  if (focusBar == null) return null;

  const transitionLabel =
    fromRoman && toRoman
      ? isLoopWrap
        ? `${fromRoman} → ${toRoman} (loop)`
        : `${fromRoman} → ${toRoman}`
      : '';

  return (
    <div
      className="flex flex-col gap-1.5 px-2.5 py-1.5 border-t shrink-0"
      style={{ borderColor: '#2a2a38', background: 'rgba(0,0,0,0.35)' }}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="text-[6px] font-black uppercase tracking-widest" style={{ color: accentHex }}>
          Passing / transitional · bar {focusBar + 1}
        </span>
        {transitionLabel ? (
          <span className="text-[6px] font-mono font-bold opacity-55">{transitionLabel}</span>
        ) : null}
      </div>
      {!canInsert ? (
        <span className="text-[6px] opacity-40">Need at least two bars in the loop.</span>
      ) : classicOptions.length === 0 && colorOptions.length === 0 ? (
        <span className="text-[6px] opacity-40">
          No passing moves for {fromRoman} → {toRoman}.
        </span>
      ) : null}
      {canInsert && classicOptions.length > 0 ? (
        <div className="flex flex-col gap-1">
          <span className="text-[5px] font-bold uppercase tracking-widest opacity-45">Classic</span>
          <div className="flex flex-wrap gap-1">
            {classicOptions.map((opt) => (
              <Se2SynthGenoInsertAction
                key={opt.id}
                size="compact"
                label={opt.label}
                sublabel={opt.roman}
                color={passingKindColor(opt.kind)}
                disabled={disabled}
                title={opt.hint ?? `Insert ${opt.label} before next chord`}
                onClick={() => onInsert(opt)}
              />
            ))}
          </div>
        </div>
      ) : null}
      {canInsert && colorOptions.length > 0 ? (
        <div className="flex flex-col gap-1">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setShowColor((v) => !v)}
            className="self-start text-[5px] font-bold uppercase tracking-widest opacity-55 hover:opacity-90 disabled:opacity-30"
            style={{ color: '#fbbf24' }}
          >
            {showColor ? 'Hide color' : `Color (+${colorOptions.length})`}
          </button>
          {showColor ? (
            <div className="flex flex-wrap gap-1">
              {colorOptions.map((opt) => (
                <Se2SynthGenoInsertAction
                  key={opt.id}
                  size="compact"
                  label={opt.label}
                  sublabel={opt.roman}
                  color={passingKindColor(opt.kind, opt.isCluster)}
                  accentHex={opt.isCluster ? accentHex : undefined}
                  disabled={disabled}
                  title={opt.hint ?? `Insert ${opt.label} before next chord`}
                  onClick={() => onInsert(opt)}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
