'use client';

import { Volume2, VolumeX } from 'lucide-react';

import type { AiMatchPreviewMix } from '@/app/lib/aiMusicMatch/aiMusicMatchPreview';

const MINT = '#7cf4c6';
const CYAN = '#00E5FF';
const BASS_COLOR = '#fbbf24';

function MixChannel({
  label,
  color,
  volume,
  muted,
  max = 100,
  onVolume,
  onToggleMute,
}: {
  label: string;
  color: string;
  volume: number;
  muted: boolean;
  max?: number;
  onVolume: (v: number) => void;
  onToggleMute: () => void;
}) {
  const pct = Math.round(volume * 100);
  return (
    <div
      className="flex flex-col gap-2 rounded-lg p-3 min-w-[160px] flex-1"
      style={{ background: '#242424', border: `1px solid ${color}44` }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-black uppercase tracking-widest" style={{ color }}>
          {label}
        </span>
        <button
          type="button"
          onClick={onToggleMute}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black"
          style={{
            background: muted ? 'rgba(244,160,160,0.2)' : `${color}18`,
            color: muted ? '#f4a0a0' : color,
            border: `1px solid ${muted ? '#f4a0a066' : `${color}55`}`,
          }}
        >
          {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
          {muted ? 'Unmute' : 'Mute'}
        </button>
      </div>
      <input
        type="range"
        min={0}
        max={max}
        value={pct}
        disabled={muted}
        onChange={(e) => onVolume(Number(e.target.value) / 100)}
        className="w-full cursor-pointer disabled:opacity-40"
        style={{
          height: 8,
          accentColor: color,
          WebkitAppearance: 'auto',
          appearance: 'auto',
        }}
      />
      <span className="text-[11px] font-black tabular-nums" style={{ color: muted ? '#666' : '#ccc' }}>
        Volume: {muted ? 'muted' : `${pct}%`}
      </span>
    </div>
  );
}

export function AiMusicMatchMixControls({
  mix,
  onMixChange,
}: {
  mix: AiMatchPreviewMix;
  onMixChange: (partial: Partial<AiMatchPreviewMix>) => void;
}) {
  return (
    <div
      className="flex flex-col gap-3 rounded-xl p-4 w-full"
      style={{
        background: 'linear-gradient(135deg, rgba(0,229,255,0.08), rgba(124,244,198,0.06))',
        border: `2px solid ${CYAN}`,
        boxShadow: `0 0 20px ${CYAN}22`,
      }}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs font-black uppercase tracking-widest" style={{ color: CYAN }}>
          Preview mix · vocals · chords · bass
        </p>
        <span className="text-[9px] font-black px-2 py-0.5 rounded" style={{ color: MINT, background: `${MINT}15`, border: `1px solid ${MINT}44` }}>
          Mix v8
        </span>
      </div>
      <p className="text-[11px] leading-relaxed" style={{ color: '#999' }}>
        Boost <strong style={{ color: MINT }}>Vocals</strong> if your stem is quiet. Mute chords or bass to hear what
        fits.
      </p>
      <div className="flex flex-wrap gap-3 w-full">
        <MixChannel
          label="Vocals"
          color={MINT}
          volume={mix.stemVolume}
          muted={mix.vocalsMuted}
          max={150}
          onVolume={(v) => onMixChange({ stemVolume: v })}
          onToggleMute={() => onMixChange({ vocalsMuted: !mix.vocalsMuted })}
        />
        <MixChannel
          label="Chords"
          color={CYAN}
          volume={mix.chordVolume}
          muted={mix.chordsMuted}
          onVolume={(v) => onMixChange({ chordVolume: v })}
          onToggleMute={() => onMixChange({ chordsMuted: !mix.chordsMuted })}
        />
        <MixChannel
          label="Bass"
          color={BASS_COLOR}
          volume={mix.bassVolume}
          muted={mix.bassMuted}
          onVolume={(v) => onMixChange({ bassVolume: v })}
          onToggleMute={() => onMixChange({ bassMuted: !mix.bassMuted })}
        />
      </div>
    </div>
  );
}
