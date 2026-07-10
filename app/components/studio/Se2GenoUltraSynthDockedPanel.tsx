'use client';

import type { ReactNode } from 'react';
import { StudioEditor2HelpTip } from '@/app/components/studio/StudioEditor2HelpHub';
import { GenoUltraChordLockHelpTip, GenoUltraChordLockTechnologyMark } from '@/app/components/studio/genoUltraSektorUi';

export type Se2GenoUltraSynthDockedPanelProps = {
  trackName: string;
  accentHex?: string;
  onClose: () => void;
  children: ReactNode;
};

export const SE2_GENO_ULTRA_DOCKED_MAX_PX = 1200;
export const SE2_GENO_ULTRA_DOCKED_CHROME_PX = 560;

export function Se2GenoUltraSynthDockedPanel({
  trackName,
  accentHex = '#A78BFA',
  onClose,
  children,
}: Se2GenoUltraSynthDockedPanelProps) {
  return (
    <div
      data-studio-geno-ultra-dock
      className="shrink-0 flex flex-col border-b"
      style={{
        minHeight: 160,
        borderColor: `${accentHex}44`,
        background: 'linear-gradient(180deg, #1e1e22 0%, #121214 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
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
            {trackName} — Geno Ultra Synth
          </span>
          <StudioEditor2HelpTip tab="genoUltraSynth" title="Geno Ultra Synth — Grid-style instrument lane" />
          <GenoUltraChordLockTechnologyMark />
          <GenoUltraChordLockHelpTip />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded border px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide outline-none transition-colors hover:bg-white/5"
          style={{ borderColor: '#3a3a48', color: '#9a9ab0' }}
          title="Hide Geno Ultra Synth panel (piano roll stays open)"
        >
          Hide
        </button>
      </div>
      <div
        className="min-h-0 overflow-x-auto overflow-y-auto overscroll-contain px-1 pb-1"
        style={{ maxHeight: `min(44vh, ${SE2_GENO_ULTRA_DOCKED_MAX_PX}px)` }}
      >
        {children}
      </div>
    </div>
  );
}
