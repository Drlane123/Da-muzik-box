'use client';

import { SE2_GUITAR_UI } from '@/app/lib/studio/se2GuitarUiTheme';

export type Se2GuitarDarkSelectProps = {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  className?: string;
  title?: string;
};

/** Native select with dark dropdown list (Windows / WebKit). */
export function Se2GuitarDarkSelect({
  value,
  disabled,
  onChange,
  options,
  className = '',
  title,
}: Se2GuitarDarkSelectProps) {
  return (
    <select
      value={value}
      disabled={disabled}
      title={title}
      onChange={(e) => onChange(e.target.value)}
      className={`se2-guitar-select rounded border px-1.5 py-0.5 text-[8px] font-bold outline-none disabled:opacity-40 ${className}`}
      style={{
        borderColor: SE2_GUITAR_UI.border,
        background: SE2_GUITAR_UI.insetBg,
        color: SE2_GUITAR_UI.accentBright,
        colorScheme: 'dark',
      }}
    >
      {options.map((o) => (
        <option
          key={o.value}
          value={o.value}
          style={{ background: '#0a0a0e', color: '#e8e8f0' }}
        >
          {o.label}
        </option>
      ))}
    </select>
  );
}
