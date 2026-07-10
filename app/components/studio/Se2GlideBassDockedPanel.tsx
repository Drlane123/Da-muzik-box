'use client';

import type { ReactNode } from 'react';

/** Bass Glide editor strip — lives above the piano roll grid, not a full-screen overlay. */
export type Se2GlideBassDockedPanelProps = {
  trackName: string;
  accentHex?: string;
  onClose: () => void;
  children: ReactNode;
};

export const SE2_GLIDE_BASS_DOCKED_MAX_PX = 320;
/** Header + typical dock height for piano-roll layout budgeting (not the expanded scroll max). */
export const SE2_GLIDE_BASS_DOCKED_CHROME_PX = 168;

export function Se2GlideBassDockedPanel({
  trackName,
  accentHex = '#9B6BFF',
  onClose,
  children,
}: Se2GlideBassDockedPanelProps) {
  return (
    <div
      data-studio-glide-bass-dock
      className="shrink-0 flex flex-col border-b"
      style={{
        minHeight: 120,
        borderColor: `${accentHex}44`,
        background: 'linear-gradient(180deg, #0c0c12 0%, #07070c 100%)',
        boxShadow: `inset 0 1px 0 ${accentHex}33`,
      }}
    >
      <div
        className="flex shrink-0 items-center justify-between gap-2 px-2 py-1 border-b"
        style={{ borderColor: `${accentHex}33` }}
      >
        <span className="se2-type-micro truncate text-[9px] font-black" style={{ color: accentHex }}>
          {trackName} — Bass Glide
        </span>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded border px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide outline-none transition-colors hover:bg-white/5"
          style={{ borderColor: '#3a3a48', color: '#9a9ab0' }}
          title="Hide Bass Glide panel (piano roll stays open)"
        >
          Hide
        </button>
      </div>
      <div
        className="min-h-0 overflow-y-auto overscroll-contain px-1 pb-1"
        style={{ maxHeight: `min(36vh, ${SE2_GLIDE_BASS_DOCKED_MAX_PX}px)` }}
      >
        {children}
      </div>
    </div>
  );
}
