'use client';

import type { CSSProperties } from 'react';
import type { Se2BeatPadsSe2SyncMode } from '@/app/lib/studio/se2BeatPadsTrack';

const MINT = '#7cf4c6';

const btnBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  height: 28,
  padding: '0 9px',
  borderRadius: 4,
  border: '1px solid rgba(124, 244, 198, 0.28)',
  background: 'rgba(124, 244, 198, 0.06)',
  color: '#b8c4bc',
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.4,
  textTransform: 'uppercase',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  flexShrink: 0,
};

export type Se2BeatPadsSyncModeButtonsProps = {
  mode: Se2BeatPadsSe2SyncMode;
  disabled?: boolean;
  accentHex?: string;
  onModeChange: (mode: Se2BeatPadsSe2SyncMode) => void;
};

export function Se2BeatPadsSyncModeButtons({
  mode,
  disabled = false,
  accentHex = MINT,
  onModeChange,
}: Se2BeatPadsSyncModeButtonsProps) {
  const items: { id: Exclude<Se2BeatPadsSe2SyncMode, 'off'>; label: string; title: string }[] = [
    {
      id: 'master',
      label: 'Master',
      title: 'Beat Pads drives SE2 — your drum tempo becomes the session BPM',
    },
    {
      id: 'slave',
      label: 'Slave',
      title: 'Beat Pads follows SE2 — session BPM drives the drum loop tempo',
    },
  ];

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        padding: '1px 2px',
        borderRadius: 5,
        border: '1px solid rgba(124, 244, 198, 0.22)',
        background: 'rgba(8, 10, 14, 0.95)',
      }}
      title="Link Beat Pads transport to SE2 — choose who sets the tempo"
    >
      {items.map((item) => {
        const active = mode === item.id;
        return (
          <button
            key={item.id}
            type="button"
            disabled={disabled}
            onClick={() => onModeChange(active ? 'off' : item.id)}
            style={{
              ...btnBase,
              opacity: disabled ? 0.45 : 1,
              borderColor: active ? `${accentHex}88` : 'rgba(124, 244, 198, 0.2)',
              color: active ? accentHex : '#9aa3b0',
              background: active ? `${accentHex}20` : 'transparent',
              boxShadow: active ? `0 0 10px ${accentHex}33` : undefined,
            }}
            title={item.title}
            aria-pressed={active}
          >
            {active ? '●' : '○'} {item.label}
          </button>
        );
      })}
    </div>
  );
}
