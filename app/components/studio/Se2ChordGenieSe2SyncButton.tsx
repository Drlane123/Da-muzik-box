'use client';

import { Link2 } from 'lucide-react';

const MINT = '#7cf4c6';

export type Se2ChordGenieSe2SyncButtonProps = {
  enabled: boolean;
  disabled?: boolean;
  accentHex?: string;
  onToggle: () => void;
};

export function Se2ChordGenieSe2SyncButton({
  enabled,
  disabled = false,
  accentHex = MINT,
  onToggle,
}: Se2ChordGenieSe2SyncButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className="inline-flex items-center gap-1 rounded border px-2 text-[8px] font-black uppercase tracking-wide whitespace-nowrap disabled:opacity-40"
      style={{
        height: 28,
        borderColor: enabled ? `${accentHex}88` : 'rgba(124, 244, 198, 0.28)',
        background: enabled ? `${accentHex}20` : 'rgba(8, 10, 14, 0.95)',
        color: enabled ? accentHex : '#9aa3b0',
        boxShadow: enabled ? `0 0 10px ${accentHex}33` : undefined,
      }}
      title={
        enabled
          ? 'Synced to SE2 — Play on the main transport previews chords with the beat'
          : 'Sync chord sequencer to SE2 transport playhead and preview'
      }
      aria-pressed={enabled}
    >
      <Link2 size={11} strokeWidth={2.5} aria-hidden />
      {enabled ? '● Sync SE2' : '○ Sync SE2'}
    </button>
  );
}
