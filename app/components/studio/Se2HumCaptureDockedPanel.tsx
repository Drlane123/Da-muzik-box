'use client';

import type { ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { StudioEditor2HelpTip } from '@/app/components/studio/StudioEditor2HelpHub';
import '@/app/styles/neuralHumBasicPitch.css';

export type Se2HumCaptureDockedPanelProps = {
  trackName: string;
  accentHex?: string;
  onClose: () => void;
  children: ReactNode;
};

export type Se2HumCaptureCollapsedStripProps = {
  trackName: string;
  accentHex?: string;
  onExpand: () => void;
};

export const SE2_HUM_CAPTURE_DOCKED_MAX_PX = 560;
export const SE2_HUM_CAPTURE_DOCKED_CHROME_PX = 220;
export const SE2_HUM_CAPTURE_COLLAPSED_CHROME_PX = 30;

export function Se2HumCaptureCollapsedStrip({
  trackName,
  accentHex = '#00E5FF',
  onExpand,
}: Se2HumCaptureCollapsedStripProps) {
  return (
    <button
      type="button"
      data-studio-hum-capture-dock
      data-studio-hum-capture-collapsed
      onClick={onExpand}
      className="shrink-0 flex w-full items-center justify-between gap-2 border-b px-2 py-1 text-left outline-none transition-colors hover:bg-white/[0.04]"
      style={{
        minHeight: SE2_HUM_CAPTURE_COLLAPSED_CHROME_PX,
        borderColor: `${accentHex}44`,
        background: `linear-gradient(180deg, ${accentHex}14 0%, #060810 100%)`,
        boxShadow: `inset 0 1px 0 ${accentHex}22`,
      }}
      title="Show Hum / Melody Capture — humming, singing, whistling, or a single instrument → MIDI"
      aria-expanded={false}
      aria-label="Expand Hum / Melody Capture panel"
    >
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <ChevronUp size={14} strokeWidth={2.5} style={{ color: accentHex, flexShrink: 0 }} aria-hidden />
        <span className="se2-type-micro truncate text-[9px] font-black" style={{ color: accentHex }}>
          {trackName} — Hum / Melody Capture — hum · sing · whistle · instrument → MIDI
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

export function Se2HumCaptureDockedPanel({
  trackName,
  accentHex = '#00E5FF',
  onClose,
  children,
}: Se2HumCaptureDockedPanelProps) {
  return (
    <div
      data-studio-hum-capture-dock
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
        <span
          className="se2-type-micro truncate inline-flex items-center gap-1.5 text-[9px] font-black min-w-0"
          style={{ color: accentHex }}
        >
          <span className="truncate min-w-0">
            {trackName} — Hum / Melody Capture — humming, singing, whistling, or a single instrument
            line → MIDI (pitch · timing · loudness · bends)
          </span>
          <StudioEditor2HelpTip
            tab="humCapture"
            title="Hum / Melody Capture — humming, singing, whistling, or a single instrument line → MIDI (pitch, timing, loudness, bends)"
          />
        </span>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex shrink-0 items-center gap-1 rounded border px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide outline-none transition-colors hover:bg-white/5"
          style={{ borderColor: '#3a3a48', color: '#9a9ab0' }}
          title="Collapse Hum / Melody Capture — click the arrow bar to expand again"
        >
          <ChevronDown size={10} strokeWidth={2.5} aria-hidden />
          Hide
        </button>
      </div>
      <div
        className="min-h-0 overflow-x-auto overflow-y-auto overscroll-contain px-1 pb-1"
        style={{ maxHeight: `min(44vh, ${SE2_HUM_CAPTURE_DOCKED_MAX_PX}px)` }}
      >
        {children}
      </div>
    </div>
  );
}
