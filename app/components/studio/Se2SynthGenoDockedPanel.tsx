'use client';

import type { ReactNode } from 'react';
import { StudioEditor2HelpTip } from '@/app/components/studio/StudioEditor2HelpHub';

export type Se2SynthGenoDockedPanelProps = {
  trackName: string;
  accentHex?: string;
  onClose: () => void;
  children: ReactNode;
};

export const SE2_SYNTH_GENO_DOCKED_MAX_PX = 680;
export const SE2_SYNTH_GENO_DOCKED_CHROME_PX = 240;

export function Se2SynthGenoDockedPanel({
  trackName,
  accentHex = '#00E5CC',
  onClose,
  children,
}: Se2SynthGenoDockedPanelProps) {
  return (
    <div
      data-studio-synth-geno-dock
      className="shrink-0 flex flex-col border-b"
      style={{
        minHeight: 120,
        borderColor: `${accentHex}44`,
        background: 'linear-gradient(180deg, #0a1012 0%, #060809 100%)',
        boxShadow: `inset 0 1px 0 ${accentHex}33`,
      }}
    >
      <div
        className="flex shrink-0 items-center justify-between gap-2 px-2 py-1 border-b"
        style={{ borderColor: `${accentHex}33` }}
      >
        <span className="se2-type-micro truncate inline-flex items-center gap-1 text-[9px] font-black" style={{ color: accentHex }}>
          <span className="truncate">{trackName} — Synth Geno</span>
          <StudioEditor2HelpTip tab="synthGeno" title="Synth Geno lane — chords, sound & compose" />
        </span>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded border px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide outline-none transition-colors hover:bg-white/5"
          style={{ borderColor: '#3a3a48', color: '#9a9ab0' }}
          title="Hide Synth Geno panel (piano roll stays open)"
        >
          Hide
        </button>
      </div>
      <div
        className="min-h-0 overflow-x-auto overflow-y-auto overscroll-contain px-3 pb-3 pt-2"
        style={{ maxHeight: `min(48vh, ${SE2_SYNTH_GENO_DOCKED_MAX_PX}px)` }}
      >
        {children}
      </div>
    </div>
  );
}
