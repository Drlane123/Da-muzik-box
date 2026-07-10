'use client';

type ChainParamProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (value: number) => string;
  onChange: (value: number) => void;
};

export function ChainParam({
  label,
  value,
  min,
  max,
  step = 1,
  format,
  onChange,
}: ChainParamProps) {
  const span = max - min || 1;
  const pct = ((value - min) / span) * 100;
  const readout = format ? format(value) : value.toFixed(step < 1 ? 1 : 0);

  return (
    <label className="mb-param">
      <span className="mb-param__label">{label}</span>
      <div className="mb-param__track-wrap">
        <div className="mb-param__track" aria-hidden>
          <div className="mb-param__ticks">
            {[0, 25, 50, 75, 100].map((t) => (
              <span key={t} style={{ left: `${t}%` }} />
            ))}
          </div>
          <div className="mb-param__fill" style={{ width: `${pct}%` }} />
          <div className="mb-param__thumb" style={{ left: `${pct}%` }} />
        </div>
        <input
          type="range"
          className="mb-param__input"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
        />
      </div>
      <em className="mb-param__readout">{readout}</em>
    </label>
  );
}
