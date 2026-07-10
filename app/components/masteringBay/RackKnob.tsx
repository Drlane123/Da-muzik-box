'use client';

import type { CSSProperties } from 'react';

const LED_TICK_COUNT = 18;

type RackKnobProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  size?: 'sm' | 'md' | 'lg';
  accent?: 'orange' | 'green' | 'blue' | 'white';
  readout?: string;
  scale?: string[];
  /** Digital LED tick ring that lights up as the value rises. */
  ledRing?: boolean;
  onChange: (value: number) => void;
};

export function RackKnob({
  label,
  value,
  min,
  max,
  step = 1,
  size = 'md',
  accent = 'white',
  readout,
  scale,
  ledRing = false,
  onChange,
}: RackKnobProps) {
  const span = max - min || 1;
  const pct = Math.max(0, Math.min(100, ((value - min) / span) * 100));
  const rot = -135 + (pct / 100) * 270;
  const litCount = Math.round((pct / 100) * LED_TICK_COUNT);

  return (
    <div className={`mb-knob mb-knob--${size} mb-knob--${accent}${ledRing ? ' mb-knob--led' : ''}`}>
      <span className="mb-knob__label">{label}</span>
      {scale && scale.length > 0 && (
        <div className="mb-knob__scale" aria-hidden>
          {scale.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      )}
      <div className="mb-knob__body">
        {ledRing && (
          <div className="mb-knob__ticks" aria-hidden>
            {Array.from({ length: LED_TICK_COUNT }, (_, i) => {
              const angle = -135 + (i / (LED_TICK_COUNT - 1)) * 270;
              const lit = i < litCount;
              return (
                <span
                  key={i}
                  className={`mb-knob__tick${lit ? ' is-lit' : ''}`}
                  style={{ transform: `rotate(${angle}deg) translateY(var(--mb-knob-tick-r, -22px))` }}
                />
              );
            })}
          </div>
        )}
        <div className="mb-knob__ring" style={{ '--knob-pct': `${pct}%` } as CSSProperties} />
        <div className="mb-knob__cap">
          <div className="mb-knob__cap-inner" style={{ transform: `rotate(${rot}deg)` }}>
            <span className="mb-knob__pointer" />
          </div>
        </div>
        <input
          type="range"
          className="mb-knob__input"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
        />
      </div>
      {readout != null && <span className="mb-knob__readout">{readout}</span>}
    </div>
  );
}
