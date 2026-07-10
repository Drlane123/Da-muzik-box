'use client';

import type { ReactNode } from 'react';
import { SE2_CHORD_GENERATOR_LABEL } from '@/app/lib/studio/se2ChordGenieTrack';
import { ChevronDown, ChevronUp } from 'lucide-react';

export type Se2ChordGenieDockedPanelProps = {
  trackName: string;
  accentHex?: string;
  onClose: () => void;
  children: ReactNode;
};

export type Se2ChordGenieCollapsedStripProps = {
  trackName: string;
  accentHex?: string;
  onExpand: () => void;
};

/** Generator — key wheel + sketch + chord sequencer in one scrollable panel. */
export const SE2_GENO_CHORD_CREATOR_DOCKED_MAX_PX = 680;
/** @deprecated */
export const SE2_CHORD_GENIE_DOCKED_MAX_PX = SE2_GENO_CHORD_CREATOR_DOCKED_MAX_PX;
export const SE2_CHORD_GENIE_COLLAPSED_CHROME_PX = 30;
export const PIANO_GENO_CHORD_CREATOR_DOCK_CHROME_PX = 400;
export const PIANO_GENO_CHORD_CREATOR_CHROME_PX = PIANO_GENO_CHORD_CREATOR_DOCK_CHROME_PX;
/** @deprecated Sketch lives in generator header — kept for saved layout math. */
export const PIANO_GENO_CHORD_CREATOR_SKETCH_CHROME_PX = 0;
/** @deprecated */
export const SE2_GENO_CHORD_CREATOR_SKETCH_MAX_PX = 0;
/** @deprecated */
export const PIANO_CHORD_GENIE_CHROME_PX = PIANO_GENO_CHORD_CREATOR_CHROME_PX;

export function Se2ChordGenieCollapsedStrip({
  trackName,
  accentHex = '#4DA8FF',
  onExpand,
}: Se2ChordGenieCollapsedStripProps) {
  return (
    <button
      type="button"
      data-studio-chord-genie-dock
      onClick={onExpand}
      className="shrink-0 flex w-full items-center justify-between gap-2 border-b px-2 py-1 text-left outline-none transition-colors hover:bg-white/[0.04]"
      style={{
        minHeight: SE2_CHORD_GENIE_COLLAPSED_CHROME_PX,
        borderColor: `${accentHex}44`,
        background: `linear-gradient(180deg, ${accentHex}14 0%, #080c14 100%)`,
      }}
      title={`Show ${SE2_CHORD_GENERATOR_LABEL} — 4/8 bar card sketch`}
      aria-expanded={false}
    >
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <ChevronUp size={14} strokeWidth={2.5} style={{ color: accentHex, flexShrink: 0 }} aria-hidden />
        <span className="se2-type-micro truncate text-[9px] font-black" style={{ color: accentHex }}>
          {SE2_CHORD_GENERATOR_LABEL}
        </span>
      </span>
      <span
        className="shrink-0 rounded border px-2 py-0.5 text-[8px] font-bold uppercase"
        style={{ borderColor: `${accentHex}55`, color: accentHex, background: `${accentHex}12` }}
      >
        Show
      </span>
    </button>
  );
}

export function Se2ChordGenieDockedPanel({
  trackName,
  accentHex = '#4DA8FF',
  onClose,
  children,
}: Se2ChordGenieDockedPanelProps) {
  const dockHeight = `min(${SE2_GENO_CHORD_CREATOR_DOCKED_MAX_PX}px, 48vh)`;

  return (
    <div
      data-studio-chord-genie-dock
      className="shrink-0 flex flex-col border-b overflow-hidden"
      style={{
        height: dockHeight,
        maxHeight: dockHeight,
        minHeight: 220,
        borderColor: `${accentHex}44`,
        background: 'linear-gradient(180deg, #101828 0%, #080c14 100%)',
        boxShadow: `inset 0 1px 0 ${accentHex}33`,
      }}
    >
      <div
        className="flex shrink-0 items-center justify-between gap-2 px-2 py-1 border-b"
        style={{ borderColor: `${accentHex}33` }}
      >
        <span className="se2-type-micro truncate text-[9px] font-black" style={{ color: accentHex }}>
          {SE2_CHORD_GENERATOR_LABEL}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex shrink-0 items-center gap-1 rounded border px-2 py-0.5 text-[8px] font-bold uppercase"
          style={{ borderColor: '#3a3a48', color: '#9a9ab0' }}
        >
          <ChevronDown size={10} strokeWidth={2.5} aria-hidden />
          Hide
        </button>
      </div>
      <div
        data-studio-chord-genie-scroll
        className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-contain"
      >
        {children}
      </div>
    </div>
  );
}
