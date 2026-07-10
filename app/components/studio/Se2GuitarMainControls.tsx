'use client';

import type { Se2GuitarFxSettings } from '@/app/lib/studio/se2GuitarFx';
import {
  SE2_GUITAR_ARTICULATIONS,
  type Se2GuitarArticulationId,
} from '@/app/lib/studio/se2GuitarArticulation';

import { Se2GuitarDarkSelect } from '@/app/components/studio/Se2GuitarDarkSelect';
import { SE2_GUITAR_UI } from '@/app/lib/studio/se2GuitarUiTheme';

const ACCENT = SE2_GUITAR_UI.accent;

export type Se2GuitarMainControlsProps = {
  fx: Se2GuitarFxSettings;
  capo: number;
  articulation: Se2GuitarArticulationId;
  disabled?: boolean;
  onFxChange: (patch: Partial<Se2GuitarFxSettings>) => void;
  onCapoChange: (fret: number) => void;
  onArticulationChange: (id: Se2GuitarArticulationId) => void;
};

function SilverKnob({
  label,
  value,
  display,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  display?: string;
  disabled?: boolean;
  onChange?: (v: number) => void;
}) {
  const rot = -135 + (value / 100) * 270;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange?.((value + 12) % 112 > 100 ? 0 : value + 12)}
        className="relative h-9 w-9 shrink-0 rounded-full border disabled:opacity-40"
        style={{
          borderColor: '#6a6050',
          background: 'radial-gradient(circle at 32% 28%, #a8a090 0%, #5a5448 45%, #2a2620 100%)',
          boxShadow: 'inset 0 2px 3px #fff3, inset 0 -2px 4px #0006, 0 1px 2px #0008',
        }}
        title={label}
      >
        <span
          className="absolute left-1/2 top-[42%] h-[42%] w-[3px] origin-bottom -translate-x-1/2 rounded-full bg-[#1a1814]"
          style={{ transform: `translate(-50%, -100%) rotate(${rot}deg)` }}
        />
      </button>
      <span className="text-[6px] font-black uppercase tracking-wider text-[#9a8870]">{label}</span>
      <span className="text-[6px] font-bold tabular-nums text-[#6a5848]">
        {display ?? (value / 100).toFixed(1)}
      </span>
    </div>
  );
}

export function Se2GuitarMainControls({
  fx,
  capo,
  articulation,
  disabled = false,
  onFxChange,
  onCapoChange,
  onArticulationChange,
}: Se2GuitarMainControlsProps) {
  return (
    <div
      className="w-full shrink-0 rounded-sm border px-2 py-2 pointer-events-auto"
      style={{
        borderColor: SE2_GUITAR_UI.border,
        background: SE2_GUITAR_UI.fretboardBg,
        boxShadow: 'inset 0 2px 6px #0004, 0 2px 8px #0006',
      }}
    >
      <div className="flex items-end justify-between gap-2 overflow-x-auto">
        {/* Articulations */}
        <div className="flex shrink-0 flex-col gap-1 pr-2">
          <span className="text-[6px] font-black uppercase tracking-widest" style={{ color: SE2_GUITAR_UI.textSoft }}>
            Articulations
          </span>
          <div className="flex gap-1">
            {SE2_GUITAR_ARTICULATIONS.map((a) => {
              const active = articulation === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  disabled={disabled}
                  title={a.hint}
                  onClick={() => onArticulationChange(a.id)}
                  className="relative rounded border px-2 py-1 text-[7px] font-black"
                  style={{
                    borderColor: active ? '#c8c8d4' : SE2_GUITAR_UI.borderSoft,
                    background: active ? '#1a1a1e' : SE2_GUITAR_UI.insetBg,
                    color: active ? SE2_GUITAR_UI.accentBright : SE2_GUITAR_UI.textMuted,
                  }}
                >
                  {a.label}
                  {active ? (
                    <span
                      className="absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full"
                      style={{ background: SE2_GUITAR_UI.accent }}
                      aria-hidden
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* Knob row — matches reference plugin layout */}
        <div className="flex min-w-0 flex-1 flex-wrap items-end justify-center gap-2">
          <SilverKnob label="Mic1" value={90} display="0.9" disabled={disabled} />
          <SilverKnob label="Mic2" value={90} display="0.9" disabled={disabled} />
          <SilverKnob label="Main" value={90} display="0.9" disabled={disabled} />
          <SilverKnob label="Pan" value={50} display="50" disabled={disabled} />
          <SilverKnob label="Width" value={50} display="50" disabled={disabled} />
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[6px] font-black uppercase" style={{ color: SE2_GUITAR_UI.textMuted }}>Double</span>
            <button
              type="button"
              disabled={disabled}
              className="h-4 w-8 rounded-sm border text-[5px] font-bold"
              style={{ borderColor: SE2_GUITAR_UI.border, background: SE2_GUITAR_UI.insetBg, color: SE2_GUITAR_UI.textSoft }}
            >
              OFF
            </button>
          </div>
          <SilverKnob
            label="Rel"
            value={fx.reverb}
            display={`${fx.reverb}`}
            disabled={disabled}
            onChange={(v) => onFxChange({ reverb: v })}
          />
          <SilverKnob
            label="FX"
            value={fx.chorus}
            disabled={disabled}
            onChange={(v) => onFxChange({ chorus: v })}
          />
          <SilverKnob
            label="Res"
            value={fx.tone}
            display={`${fx.tone}`}
            disabled={disabled}
            onChange={(v) => onFxChange({ tone: v })}
          />
          <SilverKnob
            label="FSA"
            value={fx.comp}
            disabled={disabled}
            onChange={(v) => onFxChange({ comp: v })}
          />
          <SilverKnob label="FSR" value={15} display="0.4s" disabled={disabled} />
          <SilverKnob label="Res.R" value={20} disabled={disabled} />
          <SilverKnob label="Start" value={10} disabled={disabled} />
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[6px] font-black uppercase" style={{ color: SE2_GUITAR_UI.textMuted }}>Capo</span>
            <Se2GuitarDarkSelect
              disabled={disabled}
              value={String(capo)}
              onChange={(v) => onCapoChange(Number(v))}
              className="h-7 w-9 text-center text-[7px]"
              options={[0, 1, 2, 3, 4, 5, 6, 7].map((f) => ({ value: String(f), label: String(f) }))}
              title="Capo fret"
            />
          </div>
        </div>

        {/* Level meter */}
        <div
          className="flex h-14 w-4 shrink-0 flex-col-reverse gap-px rounded border p-px"
          style={{ borderColor: SE2_GUITAR_UI.borderSoft, background: '#000000' }}
          aria-hidden
        >
          {[...Array(10)].map((_, i) => (
            <div
              key={i}
              className="flex-1 rounded-[1px]"
              style={{
                background: i < 6 ? '#3a9a48' : i < 8 ? '#c8a020' : '#a03030',
                opacity: 0.5 + i * 0.05,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
