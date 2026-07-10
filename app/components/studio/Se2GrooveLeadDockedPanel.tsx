'use client';

import type { ReactNode } from 'react';
import { StudioEditor2HelpTip } from '@/app/components/studio/StudioEditor2HelpHub';

export type Se2GrooveLeadDockedPanelProps = {
  trackName: string;
  accentHex?: string;
  onClose: () => void;
  children: ReactNode;
};

export const SE2_GROOVE_LEAD_DOCKED_MAX_PX = 520;
export const SE2_GROOVE_LEAD_DOCKED_CHROME_PX = 200;

export function Se2GrooveLeadDockedPanel({
  trackName,
  accentHex = '#4EC8E8',
  onClose,
  children,
}: Se2GrooveLeadDockedPanelProps) {
  return (
    <div
      data-studio-groove-lead-dock
      className="shrink-0 flex flex-col border-b"
      style={{
        minHeight: 140,
        borderColor: `${accentHex}44`,
        background: 'linear-gradient(180deg, #081018 0%, #04080c 100%)',
        boxShadow: `inset 0 1px 0 ${accentHex}33`,
      }}
    >
      <div
        className="flex shrink-0 items-center justify-between gap-2 px-2 py-1 border-b"
        style={{ borderColor: `${accentHex}33` }}
      >
        <span className="se2-type-micro truncate inline-flex items-center gap-1 text-[9px] font-black" style={{ color: accentHex }}>
          <span className="truncate">{trackName} — Groove Lead</span>
          <StudioEditor2HelpTip tab="grooveLead" title="Groove Lead lane — R&B / gospel lead synth" />
        </span>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded border px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide outline-none transition-colors hover:bg-white/5"
          style={{ borderColor: '#3a3a48', color: '#9a9ab0' }}
          title="Hide Groove Lead panel (piano roll stays open)"
        >
          Hide
        </button>
      </div>
      <div
        className="min-h-0 overflow-x-auto overflow-y-auto overscroll-contain px-1 pb-1"
        style={{ maxHeight: `min(42vh, ${SE2_GROOVE_LEAD_DOCKED_MAX_PX}px)` }}
      >
        {children}
      </div>
    </div>
  );
}
