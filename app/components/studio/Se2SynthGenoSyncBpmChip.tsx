'use client';

import { Lock, Unlock } from 'lucide-react';

export type Se2SynthGenoSyncBpmChipProps = {
  chordBpm: number;
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
  accentHex?: string;
};

/** Optional BPM lock — applies chord tempo to SE2 transport when exporting from Geno B01/B02. */
export function Se2SynthGenoSyncBpmChip({
  chordBpm,
  enabled,
  onToggle,
  disabled = false,
  accentHex = '#86efac',
}: Se2SynthGenoSyncBpmChipProps) {
  const bpm = Math.max(40, Math.min(240, Math.round(chordBpm)));
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-[8px] font-bold uppercase tracking-wide disabled:opacity-40 whitespace-nowrap"
      style={{
        borderColor: enabled ? `${accentHex}88` : '#3a4860',
        background: enabled ? `${accentHex}18` : '#12121a',
        color: enabled ? accentHex : '#9090a8',
      }}
      title={
        enabled
          ? `SE2 transport will match ${bpm} BPM when you apply MIDI`
          : `Keep SE2 transport BPM — click to sync to ${bpm} BPM on apply`
      }
    >
      {enabled ? <Lock size={10} /> : <Unlock size={10} />}
      Sync BPM · {bpm}
    </button>
  );
}
