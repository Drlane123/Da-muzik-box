'use client';

import type { Se2GuitarFxSettings } from '@/app/lib/studio/se2GuitarFx';

import { SE2_GUITAR_UI } from '@/app/lib/studio/se2GuitarUiTheme';

const ACCENT = SE2_GUITAR_UI.accent;

export type Se2GuitarFxStripProps = {
  fx: Se2GuitarFxSettings;
  disabled?: boolean;
  onChange: (patch: Partial<Se2GuitarFxSettings>) => void;
};

function FxSlider({
  label,
  value,
  disabled,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  disabled?: boolean;
  onChange: (v: number) => void;
  hint: string;
}) {
  return (
    <label
      className="inline-flex min-w-[72px] flex-1 flex-col gap-0.5"
      title={hint}
    >
      <span className="text-[6px] font-black uppercase tracking-wider text-[#8a7860]">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-1 flex-1 cursor-pointer disabled:opacity-40"
          style={{ accentColor: ACCENT }}
        />
        <span
          className="w-5 text-right text-[7px] font-bold tabular-nums"
          style={{ color: value > 0 ? ACCENT : '#6a6050' }}
        >
          {value}
        </span>
      </div>
    </label>
  );
}

export function Se2GuitarFxStrip({ fx, disabled = false, onChange }: Se2GuitarFxStripProps) {
  return (
    <div
      className="flex flex-col gap-1 rounded border px-2 py-1.5"
      style={{ borderColor: `${ACCENT}28`, background: '#0c0a06' }}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="text-[7px] font-black uppercase tracking-[0.12em]" style={{ color: ACCENT }}>
        Guitar FX
      </span>
      <div className="flex flex-wrap items-end gap-2">
        <FxSlider
          label="Tone"
          value={fx.tone}
          disabled={disabled}
          hint="Presence EQ — warm body vs bright attack (Console-style)"
          onChange={(tone) => onChange({ tone })}
        />
        <FxSlider
          label="Comp"
          value={fx.comp}
          disabled={disabled}
          hint="Dynamics glue — tighter, more produced DI tone"
          onChange={(comp) => onChange({ comp })}
        />
        <FxSlider
          label="Drive"
          value={fx.drive}
          disabled={disabled}
          hint="Soft saturation — edge and bite on clean tones"
          onChange={(drive) => onChange({ drive })}
        />
        <FxSlider
          label="Chorus"
          value={fx.chorus}
          disabled={disabled}
          hint="Wide modulated delay — shimmer on chords and melody"
          onChange={(chorus) => onChange({ chorus })}
        />
        <FxSlider
          label="Reverb"
          value={fx.reverb}
          disabled={disabled}
          hint="Room ambience — space behind the guitar"
          onChange={(reverb) => onChange({ reverb })}
        />
      </div>
    </div>
  );
}
