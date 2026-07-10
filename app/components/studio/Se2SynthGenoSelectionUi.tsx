'use client';

import type { CSSProperties, ReactNode } from 'react';

/** Progression-trigger–inspired chip / card styling (not used inside trigger keyboard). */
export function genoSelectGlow(active: boolean, accentHex: string): string | undefined {
  if (!active) return undefined;
  return `0 0 10px ${accentHex}55, inset 0 1px 0 ${accentHex}44`;
}

export function genoSelectChipStyle(
  active: boolean,
  accentHex: string,
  opts?: { muted?: boolean; color?: string },
): CSSProperties {
  const c = opts?.color ?? accentHex;
  return {
    borderColor: active ? `${c}bb` : `${c}38`,
    background: active
      ? `linear-gradient(180deg, ${c}30 0%, ${c}12 100%)`
      : opts?.muted
        ? 'linear-gradient(180deg, #1a2028 0%, #101418 100%)'
        : 'linear-gradient(180deg, #1e2430 0%, #121820 100%)',
    color: active ? c : '#b0b0bc',
    boxShadow: genoSelectGlow(active, c),
  };
}

export type Se2SynthGenoSelectChipProps = {
  active?: boolean;
  accentHex?: string;
  color?: string;
  label: ReactNode;
  title?: string;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  /** xs = preset row · sm = default · md = slightly larger */
  size?: 'xs' | 'sm' | 'md';
};

export function Se2SynthGenoSelectChip({
  active = false,
  accentHex = '#00E5CC',
  color,
  label,
  title,
  disabled,
  onClick,
  className = '',
  size = 'sm',
}: Se2SynthGenoSelectChipProps) {
  const c = color ?? accentHex;
  const pad =
    size === 'xs'
      ? 'px-1.5 py-0.5 text-[6px] tracking-wide'
      : size === 'md'
        ? 'px-2 py-0.5 text-[7px]'
        : 'px-2 py-0.5 text-[7px]';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      className={`rounded border font-bold uppercase disabled:opacity-40 transition-all hover:brightness-110 active:scale-[0.98] shrink-0 ${pad} ${className}`}
      style={genoSelectChipStyle(active, accentHex, { color: c })}
    >
      {label}
    </button>
  );
}

export type Se2SynthGenoPresetCardProps = {
  active?: boolean;
  accentHex?: string;
  title: string;
  romanLine?: string;
  meta?: string;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  /** compact = harmony + preset strip (dense horizontal scroll) */
  size?: 'compact' | 'default';
};

export function Se2SynthGenoPresetCard({
  active = false,
  accentHex = '#00E5CC',
  title,
  romanLine,
  meta,
  disabled,
  onClick,
  className = '',
  size = 'default',
}: Se2SynthGenoPresetCardProps) {
  const compact = size === 'compact';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={romanLine ? `${title}\n${romanLine}${meta ? `\n${meta}` : ''}` : title}
      className={`shrink-0 text-left disabled:opacity-40 transition-all hover:brightness-110 active:scale-[0.99] rounded border ${
        compact ? 'min-w-[88px] max-w-[132px] px-1.5 py-1' : 'min-w-[120px] max-w-[180px] px-2 py-1.5 rounded-md'
      } ${className}`}
      style={{
        borderColor: active ? `${accentHex}aa` : `${accentHex}32`,
        background: active
          ? `linear-gradient(180deg, ${accentHex}22 0%, ${accentHex}08 100%)`
          : 'linear-gradient(180deg, #1e2430 0%, #121820 100%)',
        color: '#e0e0ec',
        boxShadow: genoSelectGlow(active, accentHex),
      }}
    >
      <span
        className={`block font-bold leading-tight truncate ${compact ? 'text-[7px]' : 'text-[8px]'}`}
      >
        {title}
      </span>
      {romanLine ? (
        <span
          className={`block font-mono truncate leading-tight ${compact ? 'text-[6px] mt-0.5' : 'text-[7px] mt-0.5'}`}
          style={{ color: active ? accentHex : `${accentHex}aa` }}
        >
          {romanLine.length > (compact ? 28 : 38) ? `${romanLine.slice(0, compact ? 26 : 36)}…` : romanLine}
        </span>
      ) : null}
      {meta && !compact ? (
        <span className="block text-[6px] opacity-45 mt-0.5 font-bold uppercase tracking-wide truncate">
          {meta}
        </span>
      ) : null}
    </button>
  );
}

export type Se2SynthGenoInsertActionProps = {
  label: string;
  sublabel?: string;
  accentHex?: string;
  color?: string;
  disabled?: boolean;
  onClick?: () => void;
  title?: string;
  size?: 'compact' | 'default';
};

/** Explicit insert action — compact cards for harmony intel row. */
export function Se2SynthGenoInsertAction({
  label,
  sublabel,
  accentHex = '#00E5CC',
  color,
  disabled,
  onClick,
  title,
  size = 'default',
}: Se2SynthGenoInsertActionProps) {
  const c = color ?? accentHex;
  const compact = size === 'compact';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title ?? (sublabel ? `${label} · ${sublabel}` : label)}
      className={`rounded border text-left disabled:opacity-40 transition-all hover:brightness-110 active:scale-[0.98] ${
        compact ? 'px-1.5 py-1 min-w-[72px] max-w-[108px]' : 'px-2 py-1 min-w-[96px] max-w-[140px]'
      }`}
      style={{
        borderColor: `${c}55`,
        background: `linear-gradient(180deg, ${c}18 0%, ${c}06 100%)`,
        boxShadow: `0 0 6px ${c}28`,
      }}
    >
      <span
        className={`block font-black uppercase tracking-wider ${compact ? 'text-[5px]' : 'text-[6px]'}`}
        style={{ color: c }}
      >
        Insert
      </span>
      <span
        className={`block font-bold text-[#ececf4] leading-tight truncate ${compact ? 'text-[7px] mt-px' : 'text-[8px] mt-0.5'}`}
      >
        {label}
      </span>
      {sublabel && !compact ? (
        <span className="block text-[6px] font-mono mt-px truncate opacity-70" style={{ color: c }}>
          {sublabel}
        </span>
      ) : null}
    </button>
  );
}
