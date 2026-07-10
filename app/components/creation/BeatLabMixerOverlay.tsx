'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BeatLabMixerPanel, type BeatLabMixerPanelProps } from '@/app/components/creation/BeatLabMixerPanel';

export type BeatLabMixerOverlayProps = {
  open: boolean;
  onClose: () => void;
  padsOnly?: boolean;
} & Omit<BeatLabMixerPanelProps, 'open' | 'onClose' | 'padsOnly'>;

export function BeatLabMixerOverlay({
  open,
  onClose,
  padsOnly = false,
  padStripLabels,
  melodicInstrumentIds,
  melodicStripLabels,
  channelVolumes,
  setChannelVolume,
  masterOutputLinear,
  onMasterVolumeChange,
  spreadTrackActive,
  spreadTrackLabel,
}: BeatLabMixerOverlayProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Beat Lab mixer"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 14100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.78)',
        padding: 16,
      }}
    >
      <div
        style={{
          width: 'min(1100px, 98vw)',
          maxHeight: 'min(92vh, 720px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <BeatLabMixerPanel
          open
          onClose={onClose}
          padsOnly={padsOnly}
          padStripLabels={padStripLabels}
          melodicInstrumentIds={melodicInstrumentIds}
          melodicStripLabels={melodicStripLabels}
          channelVolumes={channelVolumes}
          setChannelVolume={setChannelVolume}
          masterOutputLinear={masterOutputLinear}
          onMasterVolumeChange={onMasterVolumeChange}
          spreadTrackActive={spreadTrackActive}
          spreadTrackLabel={spreadTrackLabel}
        />
      </div>
    </div>,
    document.body,
  );
}
