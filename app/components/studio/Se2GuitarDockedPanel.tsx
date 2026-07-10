'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { StudioEditor2HelpTip } from '@/app/components/studio/StudioEditor2HelpHub';
import { SE2_GUITAR_UI } from '@/app/lib/studio/se2GuitarUiTheme';

export type Se2GuitarDockedPanelProps = {
  trackName: string;
  accentHex?: string;
  /** docked = strip above piano roll; focus = fill edit panel (guitar lane, piano open). */
  layout?: 'docked' | 'focus';
  onClose: () => void;
  children: ReactNode;
};

/** Reserved in SE2 piano-roll height math when the guitar strip is open. */
export const SE2_GUITAR_DOCKED_CHROME_PX = 340;
export const SE2_GUITAR_DOCKED_MAX_PX = 720;
/** Bottom pad so the on-screen piano keyboard clears the transport footer. */
export const SE2_GUITAR_TRANSPORT_CLEARANCE_PX = 88;
/** Target piano-panel height fraction when guitar focus layout is active. */
export const SE2_GUITAR_FOCUS_VIEWPORT_FRAC = 0.58;

export function Se2GuitarDockedPanel({
  trackName,
  accentHex = SE2_GUITAR_UI.accent,
  layout = 'docked',
  onClose,
  children,
}: Se2GuitarDockedPanelProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const focus = layout === 'focus';

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  return (
    <div
      data-studio-guitar-dock
      data-studio-guitar-focus={focus ? '' : undefined}
      className={
        focus
          ? 'flex min-h-0 min-w-0 flex-1 flex-col border-b'
          : 'flex shrink-0 flex-col border-b'
      }
      style={{
        minHeight: focus ? 280 : 100,
        borderColor: `${accentHex}44`,
        background: SE2_GUITAR_UI.dockBg,
        boxShadow: `inset 0 1px 0 ${accentHex}33`,
      }}
    >
      <div
        className="flex shrink-0 items-center justify-between gap-2 px-2 py-1 border-b"
        style={{ borderColor: SE2_GUITAR_UI.borderSoft }}
      >
        <span
          className="se2-type-micro truncate inline-flex items-center gap-1 text-[9px] font-black"
          style={{ color: accentHex }}
        >
          <span className="truncate">{trackName} — Guitar</span>
          <StudioEditor2HelpTip tab="guitar" title="Guitar lane — sampled guitars on the MIDI roll" />
        </span>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded border px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide outline-none transition-colors hover:bg-white/5"
          style={{ borderColor: SE2_GUITAR_UI.borderSoft, color: SE2_GUITAR_UI.textMuted }}
          title="Hide Guitar panel (piano roll stays open)"
        >
          Hide
        </button>
      </div>
      <div
        ref={bodyRef}
        className={
          focus
            ? 'flex min-h-0 min-w-[300px] flex-1 flex-col overflow-x-auto overflow-y-auto overscroll-contain px-2 py-1.5'
            : 'min-h-0 min-w-[300px] overflow-x-auto overflow-y-auto overscroll-contain px-2 py-1.5'
        }
        style={{
          maxHeight: focus ? undefined : `min(58vh, ${SE2_GUITAR_DOCKED_MAX_PX}px)`,
          paddingBottom: focus ? SE2_GUITAR_TRANSPORT_CLEARANCE_PX : 20,
        }}
      >
        {children}
      </div>
    </div>
  );
}
