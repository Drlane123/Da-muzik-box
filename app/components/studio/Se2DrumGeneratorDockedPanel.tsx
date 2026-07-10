'use client';

import type { ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { StudioEditor2HelpTip } from '@/app/components/studio/StudioEditor2HelpHub';

export type Se2DrumGeneratorDockedPanelProps = {
  trackName: string;
  accentHex?: string;
  onClose: () => void;
  children: ReactNode;
};

export type Se2DrumGeneratorCollapsedStripProps = {
  trackName: string;
  accentHex?: string;
  onExpand: () => void;
};

export const SE2_DRUM_GENERATOR_DOCKED_MAX_PX = 440;
export const SE2_DRUM_GENERATOR_DOCKED_CHROME_PX = 160;
/** Thin bar shown when the panel is collapsed — click arrow to expand. */
export const SE2_DRUM_GENERATOR_COLLAPSED_CHROME_PX = 30;

export function Se2DrumGeneratorCollapsedStrip({
  trackName,
  accentHex = '#FFB84D',
  onExpand,
}: Se2DrumGeneratorCollapsedStripProps) {
  return (
    <button
      type="button"
      data-studio-drum-generator-dock
      data-studio-drum-generator-collapsed
      onClick={onExpand}
      className="shrink-0 flex w-full items-center justify-between gap-2 border-b px-2 py-1 text-left outline-none transition-colors hover:bg-white/[0.04]"
      style={{
        minHeight: SE2_DRUM_GENERATOR_COLLAPSED_CHROME_PX,
        borderColor: `${accentHex}44`,
        background: `linear-gradient(180deg, ${accentHex}14 0%, #080604 100%)`,
        boxShadow: `inset 0 1px 0 ${accentHex}22`,
      }}
      title="Show Drum Generator — pads, match cards, and style"
      aria-expanded={false}
      aria-label="Expand Drum Generator panel"
    >
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <ChevronUp size={14} strokeWidth={2.5} style={{ color: accentHex, flexShrink: 0 }} aria-hidden />
        <span className="se2-type-micro truncate text-[9px] font-black" style={{ color: accentHex }}>
          {trackName} — Drum Generator
        </span>
      </span>
      <span
        className="shrink-0 rounded border px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide"
        style={{ borderColor: `${accentHex}55`, color: accentHex, background: `${accentHex}12` }}
      >
        Show
      </span>
    </button>
  );
}

export function Se2DrumGeneratorDockedPanel({
  trackName,
  accentHex = '#FFB84D',
  onClose,
  children,
}: Se2DrumGeneratorDockedPanelProps) {
  return (
    <div
      data-studio-drum-generator-dock
      className="shrink-0 flex flex-col border-b"
      style={{
        minHeight: 120,
        borderColor: `${accentHex}44`,
        background: 'linear-gradient(180deg, #141008 0%, #080604 100%)',
        boxShadow: `inset 0 1px 0 ${accentHex}33`,
      }}
    >
      <div
        className="flex shrink-0 items-center justify-between gap-2 px-2 py-1 border-b"
        style={{ borderColor: `${accentHex}33` }}
      >
        <span
          className="se2-type-micro truncate inline-flex items-center gap-1 text-[9px] font-black"
          style={{ color: accentHex }}
        >
          <span className="truncate">{trackName} — Drum Generator</span>
          <StudioEditor2HelpTip tab="drumGenerator" title="Drum Generator lane — style-matched grooves" />
        </span>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex shrink-0 items-center gap-1 rounded border px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide outline-none transition-colors hover:bg-white/5"
          style={{ borderColor: '#3a3a48', color: '#9a9ab0' }}
          title="Collapse Drum Generator — click the arrow bar above the piano roll to expand again"
        >
          <ChevronDown size={10} strokeWidth={2.5} aria-hidden />
          Hide
        </button>
      </div>
      <div
        className="min-h-0 overflow-x-auto overflow-y-auto overscroll-contain px-1 pb-1"
        style={{ maxHeight: `min(38vh, ${SE2_DRUM_GENERATOR_DOCKED_MAX_PX}px)` }}
      >
        {children}
      </div>
    </div>
  );
}
