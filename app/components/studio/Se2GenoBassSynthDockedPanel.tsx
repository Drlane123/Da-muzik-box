'use client';

import type { ReactNode } from 'react';
import { StudioEditor2HelpTip } from '@/app/components/studio/StudioEditor2HelpHub';

export type Se2GenoBassSynthDockedPanelProps = {
  trackName: string;
  accentHex?: string;
  onClose: () => void;
  children: ReactNode;
};

export const SE2_GENO_BASS_DOCKED_MAX_PX = 576;
export const SE2_GENO_BASS_DOCKED_CHROME_PX = 524;

export function Se2GenoBassSynthDockedPanel({
  trackName,
  accentHex = '#c9a86a',
  onClose,
  children,
}: Se2GenoBassSynthDockedPanelProps) {
  return (
    <div
      data-studio-geno-bass-dock
      className="shrink-0 flex flex-col border-b"
      style={{
        minHeight: 140,
        borderColor: `${accentHex}44`,
        background: 'linear-gradient(180deg, #0e0e10 0%, #060608 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      <div
        className="flex shrink-0 items-center justify-between gap-2 px-2 py-1 border-b"
        style={{ borderColor: `${accentHex}33` }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <span
            className="se2-type-micro truncate text-[9px] font-black"
            style={{ color: accentHex }}
          >
            {trackName} — Geno Bass 52
          </span>
          <StudioEditor2HelpTip tab="genoBassSynth" title="Geno Bass 52 — analog bass synth lane" />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded border px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide outline-none transition-colors hover:bg-white/5"
          style={{ borderColor: 'rgba(255,255,255,0.15)', color: '#c8c8d0' }}
          title="Hide Geno Bass Synth panel (piano roll stays open)"
        >
          Hide
        </button>
      </div>
      <div
        className="min-h-0 overflow-x-auto overflow-y-hidden overscroll-contain px-1 pb-1"
        style={{ maxHeight: `min(52vh, ${SE2_GENO_BASS_DOCKED_MAX_PX}px)` }}
      >
        {children}
      </div>
    </div>
  );
}
