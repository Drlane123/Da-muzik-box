'use client';

import type { ReactNode } from 'react';
import type { CSSProperties } from 'react';
import { LAB808_DISPLAY_NAME } from '@/app/lib/creationStation/lab808UiTheme';
import {
  SE2_LAB808_DOCK_TAGLINE,
  SE2_LAB808_DOCK_TAGLINE_TITLE,
  SE2_LAB808_DOCK_TECH_LABEL,
  SE2_LAB808_FILTER_VIZ_SURFACE,
  SE2_LAB808_WORDMARK_GOLD_GRADIENT,
} from '@/app/lib/studio/se2Lab808UiTheme';
import { StudioEditor2HelpTip } from '@/app/components/studio/StudioEditor2HelpHub';

const lab808DockTaglineStyle: CSSProperties = {
  fontFamily: 'Orbitron, "Audiowide", "Exo 2", "Rajdhani", system-ui, sans-serif',
  fontWeight: 800,
  fontSize: 9,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
  lineHeight: 1.2,
  background: SE2_LAB808_WORDMARK_GOLD_GRADIENT,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
  filter: 'drop-shadow(0 0 6px rgba(255, 183, 77, 0.35))',
};

function Se2Lab808DockTagline() {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-0.5"
      title={SE2_LAB808_DOCK_TAGLINE_TITLE}
    >
      <span style={lab808DockTaglineStyle}>{SE2_LAB808_DOCK_TAGLINE}</span>
      <span
        aria-hidden
        style={{
          fontSize: 10,
          fontWeight: 700,
          lineHeight: 1,
          color: '#ffb74d',
          textShadow: '0 0 6px rgba(255, 183, 77, 0.4)',
          transform: 'translateY(-0.5px)',
        }}
      >
        →
      </span>
      <span style={lab808DockTaglineStyle}>{SE2_LAB808_DOCK_TECH_LABEL}</span>
    </span>
  );
}

export type Se2Lab808DockedPanelProps = {
  trackName: string;
  accentHex?: string;
  onClose: () => void;
  children: ReactNode;
};

export const SE2_LAB808_DOCKED_MAX_PX = 680;
export const SE2_LAB808_DOCKED_CHROME_PX = 240;

export function Se2Lab808DockedPanel({
  trackName,
  accentHex = '#E8784A',
  onClose,
  children,
}: Se2Lab808DockedPanelProps) {
  return (
    <div
      data-studio-lab808-dock
      className="shrink-0 flex flex-col border-b"
      style={{
        minHeight: 120,
        borderColor: SE2_LAB808_FILTER_VIZ_SURFACE.borderHex,
        background: SE2_LAB808_FILTER_VIZ_SURFACE.backgroundOpaque,
        boxShadow: SE2_LAB808_FILTER_VIZ_SURFACE.insetShadow,
      }}
    >
      <div
        className="flex shrink-0 items-center justify-between gap-2 px-2 py-1 border-b"
        style={{ borderColor: SE2_LAB808_FILTER_VIZ_SURFACE.borderHex }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <span
            className="se2-type-micro truncate text-[9px] font-black"
            style={{ color: accentHex }}
          >
            {trackName} — {LAB808_DISPLAY_NAME}
          </span>
          <StudioEditor2HelpTip tab="lab808" title={`${LAB808_DISPLAY_NAME} lane — trap kick & bass synth`} />
          <Se2Lab808DockTagline />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded border px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide outline-none transition-colors hover:bg-white/5"
          style={{ borderColor: '#3a3a48', color: '#9a9ab0' }}
          title="Hide 808 Lab panel (piano roll stays open)"
        >
          Hide
        </button>
      </div>
      <div
        className="min-h-0 overflow-x-auto overflow-y-auto overscroll-contain px-1 pb-1"
        style={{ maxHeight: `min(38vh, ${SE2_LAB808_DOCKED_MAX_PX}px)` }}
      >
        {children}
      </div>
    </div>
  );
}
