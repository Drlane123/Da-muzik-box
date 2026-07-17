'use client';

import type { ReactNode } from 'react';
import { ChevronUp } from 'lucide-react';
import { StudioEditor2HelpTextLink } from '@/app/components/studio/StudioEditor2HelpHub';
import { BeatPadsStudioGuideHelp } from '@/app/components/studio/BeatPadsStudioGuideHelp';
import { Se2BeatPadsSyncModeButtons } from '@/app/components/studio/Se2BeatPadsSyncModeButtons';
import { Se2BeatPadsExportMenu } from '@/app/components/studio/Se2BeatPadsExportMenu';
import { Se2BeatPadsMainVolumeSlider } from '@/app/components/studio/Se2BeatPadsMainVolumeSlider';
import type { Se2BeatPadsSe2SyncMode } from '@/app/lib/studio/se2BeatPadsTrack';

export type Se2BeatPadsDockedPanelProps = {
  trackName: string;
  accentHex?: string;
  /** SE2 lane — fill main workspace (Beat Lab style). */
  layout?: 'fullscreen' | 'docked';
  /** Pads + kit + FX visible (sequencer grid always stays mounted). */
  machineChromeOpen?: boolean;
  se2SyncMode?: Se2BeatPadsSe2SyncMode;
  onSe2SyncModeChange?: (mode: Se2BeatPadsSe2SyncMode) => void;
  onMachineChromeClose?: () => void;
  onMachineChromeOpen?: () => void;
  children: ReactNode;
};

/** Dock height when only the Beat Pads step sequencer is shown (pads machine closed). */
/** toolbar ~56 + bar header 36 + 16 lanes × 22px + dock chrome ~28 */
export const SE2_BEAT_PADS_SEQUENCER_CHROME_PX = 472;

export type Se2BeatPadsCollapsedStripProps = {
  trackName: string;
  accentHex?: string;
  onExpand: () => void;
};

export const SE2_BEAT_PADS_DOCKED_MAX_PX = 520;
export const SE2_BEAT_PADS_COLLAPSED_CHROME_PX = 30;

export function Se2BeatPadsCollapsedStrip({
  trackName,
  accentHex = '#7cf4c6',
  onExpand,
}: Se2BeatPadsCollapsedStripProps) {
  return (
    <button
      type="button"
      data-studio-beat-pads-dock
      data-studio-beat-pads-collapsed
      onClick={onExpand}
      className="shrink-0 flex w-full items-center justify-between gap-2 border-b px-2 py-1 text-left outline-none transition-colors hover:bg-white/[0.04]"
      style={{
        minHeight: SE2_BEAT_PADS_COLLAPSED_CHROME_PX,
        borderColor: `${accentHex}44`,
        background: `linear-gradient(180deg, ${accentHex}14 0%, #060808 100%)`,
        boxShadow: `inset 0 1px 0 ${accentHex}22`,
      }}
      title="Show Beat Pads drum machine on this lane"
      aria-expanded={false}
      aria-label="Expand Beat Pads panel"
    >
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <ChevronUp size={14} strokeWidth={2.5} style={{ color: accentHex, flexShrink: 0 }} aria-hidden />
        <span className="se2-type-micro truncate text-[9px] font-black" style={{ color: accentHex }}>
          {trackName} — Beat Pads
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

export function Se2BeatPadsDockedPanel({
  trackName,
  accentHex = '#7cf4c6',
  layout = 'docked',
  machineChromeOpen = true,
  se2SyncMode = 'off',
  onSe2SyncModeChange,
  onMachineChromeClose,
  onMachineChromeOpen,
  children,
}: Se2BeatPadsDockedPanelProps) {
  const fullscreen = layout === 'fullscreen';
  const sequencerOnly = !machineChromeOpen;
  const dockHeight = sequencerOnly
    ? `min(${SE2_BEAT_PADS_SEQUENCER_CHROME_PX}px, 58vh)`
    : `min(${SE2_BEAT_PADS_DOCKED_MAX_PX}px, 52vh)`;
  return (
    <div
      data-studio-beat-pads-dock
      data-studio-beat-pads-fullscreen={fullscreen ? '' : undefined}
      data-studio-beat-pads-sequencer-only={sequencerOnly ? '' : undefined}
      data-studio-beat-pads-machine-open={machineChromeOpen ? '' : undefined}
      className={
        fullscreen
          ? 'relative flex min-h-0 flex-1 flex-col overflow-hidden'
          : 'relative shrink-0 flex flex-col border-t overflow-hidden'
      }
      style={
        fullscreen
          ? {
              borderColor: `${accentHex}22`,
              background: 'linear-gradient(180deg, #0a1210 0%, #040608 100%)',
            }
          : {
              flex: '0 1 auto',
              minHeight: sequencerOnly ? 120 : 200,
              height: dockHeight,
              maxHeight: dockHeight,
              borderColor: `${accentHex}44`,
              background: 'linear-gradient(180deg, #0a1210 0%, #040608 100%)',
              boxShadow: `inset 0 1px 0 ${accentHex}33`,
            }
      }
    >
      <div
        className="flex shrink-0 items-center justify-between gap-2 border-b px-2 py-1"
        style={{ borderColor: `${accentHex}33`, background: `${accentHex}0c` }}
      >
        <span className="inline-flex min-w-0 shrink-0 items-center gap-2">
          <span className="se2-type-micro shrink-0 truncate text-[9px] font-black" style={{ color: accentHex }}>
            {trackName}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5">
            <BeatPadsStudioGuideHelp title="Beat Pads guide — VocalBox, Lane Placements, Auto Drum, Pad Spread & copy for social" />
            <StudioEditor2HelpTextLink
              tab="beatPadsSe2"
              expanded
              label="How to Use Beat Pads in Studio Editor 2"
              title="How to Use Beat Pads in Studio Editor 2 — open full guide"
            />
          </span>
        </span>
        <span className="inline-flex min-w-0 flex-1 items-center justify-center px-2">
          <span className="se2-beat-pads-electric-title pointer-events-none select-none shrink-0" title="Beat Pads drum machine">
            <span className="se2-beat-pads-electric-title-bracket" aria-hidden>
              &lt;
            </span>
            <span className="se2-beat-pads-electric-title-word">Beat Pads</span>
            <span className="se2-beat-pads-electric-title-bracket" aria-hidden>
              &gt;
            </span>
          </span>
          <Se2BeatPadsMainVolumeSlider accentHex={accentHex} />
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5">
        <Se2BeatPadsExportMenu accentHex={accentHex} />
        {typeof onSe2SyncModeChange === 'function' ? (
          <Se2BeatPadsSyncModeButtons
            mode={se2SyncMode}
            accentHex={accentHex}
            onModeChange={onSe2SyncModeChange}
          />
        ) : null}
        {machineChromeOpen && typeof onMachineChromeClose === 'function' ? (
          <button
            type="button"
            onClick={onMachineChromeClose}
            className="shrink-0 rounded border px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide transition-colors hover:bg-white/[0.06]"
            style={{ borderColor: `${accentHex}55`, color: accentHex, background: `${accentHex}10` }}
            title="Close pads and kit — step sequencer stays open"
          >
            Close pads
          </button>
        ) : null}
        {!machineChromeOpen && typeof onMachineChromeOpen === 'function' ? (
          <button
            type="button"
            onClick={onMachineChromeOpen}
            className="shrink-0 rounded border px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide transition-colors hover:bg-white/[0.06]"
            style={{ borderColor: `${accentHex}55`, color: accentHex, background: `${accentHex}10` }}
            title="Show 16 pads, kit loader, and pad FX"
          >
            Show pads
          </button>
        ) : null}
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
