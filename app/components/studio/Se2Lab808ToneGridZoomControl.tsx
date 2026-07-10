'use client';

import type { CSSProperties } from 'react';
import {
  SE2_LAB808_TONE_GRID_ZOOM_MAX,
  SE2_LAB808_TONE_GRID_ZOOM_MIN,
  se2Lab808NormalizeToneGridZoom,
} from '@/app/lib/studio/se2Lab808ToneGridLayout';
import { SE2_LAB808_GRID_ZOOM_ACCENT } from '@/app/lib/studio/se2Lab808UiTheme';

export type Se2Lab808ToneGridZoomControlProps = {
  zoom: number;
  disabled?: boolean;
  onZoomChange: (zoom: number) => void;
  className?: string;
};

/** Inline toolbar slider — same slot as the original Grid control. */
export function Se2Lab808ToneGridZoomControl({
  zoom,
  disabled = false,
  onZoomChange,
  className,
}: Se2Lab808ToneGridZoomControlProps) {
  const value = se2Lab808NormalizeToneGridZoom(zoom);

  return (
    <label
      className={`flex items-center gap-1 text-[8px] shrink-0 ml-auto ${className ?? ''}`}
      style={{ color: SE2_LAB808_GRID_ZOOM_ACCENT }}
      title="Zoom tone grid in and out"
    >
      Grid
      <input
        type="range"
        min={SE2_LAB808_TONE_GRID_ZOOM_MIN}
        max={SE2_LAB808_TONE_GRID_ZOOM_MAX}
        step={0.05}
        disabled={disabled}
        value={value}
        onChange={(e) => onZoomChange(Number(e.target.value))}
        className="w-14"
        style={{ accentColor: SE2_LAB808_GRID_ZOOM_ACCENT } as CSSProperties}
        aria-label="Tone grid zoom"
      />
    </label>
  );
}
