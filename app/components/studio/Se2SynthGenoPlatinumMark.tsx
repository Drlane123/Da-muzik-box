'use client';

import type { CSSProperties } from 'react';

export type Se2SynthGenoPlatinumMarkProps = {
  className?: string;
  style?: CSSProperties;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero' | 'title';
  /** Softer platinum when control is inactive. */
  dimmed?: boolean;
};

const SIZE_PX: Record<NonNullable<Se2SynthGenoPlatinumMarkProps['size']>, number> = {
  xs: 8,
  sm: 9,
  md: 10,
  lg: 12,
  xl: 15,
  hero: 22,
  title: 30,
};

/** Reflective platinum — slanted, electrified wordmark for Synth Geno branding. */
export function se2SynthGenoPlatinumMarkStyle(
  size: NonNullable<Se2SynthGenoPlatinumMarkProps['size']> = 'md',
  dimmed = false,
): CSSProperties {
  return {
    fontFamily: 'Orbitron, "Audiowide", "Exo 2", "Rajdhani", system-ui, sans-serif',
    fontWeight: 800,
    fontStyle: 'italic',
    fontSize: SIZE_PX[size],
    letterSpacing:
      size === 'xs'
        ? '0.14em'
        : size === 'title'
          ? '0.24em'
          : size === 'hero'
            ? '0.22em'
            : '0.2em',
    textTransform: 'uppercase',
    lineHeight: 1.15,
    whiteSpace: 'nowrap',
    display: 'inline-block',
    transform: 'skewX(-10deg)',
    background:
      'linear-gradient(165deg, #ffffff 0%, #f0f4f8 12%, #b8c4d0 28%, #ffffff 42%, #8fa0ae 58%, #e8eef3 74%, #a8b6c2 88%, #ffffff 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    opacity: dimmed ? 0.68 : 1,
    filter: dimmed
      ? 'drop-shadow(0 1px 1px rgba(0, 0, 0, 0.55))'
      : size === 'title' || size === 'hero'
        ? 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.7))'
        : 'drop-shadow(0 0 6px rgba(196, 218, 235, 0.22)) drop-shadow(0 1px 2px rgba(0, 0, 0, 0.65))',
  };
}

export function Se2SynthGenoPlatinumMark({
  className,
  style,
  size = 'md',
  dimmed = false,
}: Se2SynthGenoPlatinumMarkProps) {
  return (
    <span className={className} style={{ ...se2SynthGenoPlatinumMarkStyle(size, dimmed), ...style }}>
      Synth Geno
    </span>
  );
}
