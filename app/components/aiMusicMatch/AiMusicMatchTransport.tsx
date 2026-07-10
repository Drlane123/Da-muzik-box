'use client';

import { Pause, Play } from 'lucide-react';

const MINT = '#7cf4c6';
const CYAN = '#00E5FF';

export function AiMusicMatchTransport({
  playing,
  onToggle,
  hasMatchedChords,
  compact = false,
}: {
  playing: boolean;
  onToggle: () => void;
  hasMatchedChords: boolean;
  compact?: boolean;
}) {
  const label = playing
    ? 'Stop'
    : hasMatchedChords
      ? 'Play vocal + matched chords'
      : 'Play vocal + preview chords';

  if (compact) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black"
        style={{ background: playing ? CYAN : MINT, color: '#000', minHeight: 36 }}
      >
        {playing ? <Pause size={16} strokeWidth={2.5} /> : <Play size={16} strokeWidth={2.5} fill="#000" />}
        {label}
      </button>
    );
  }

  return (
    <div
      className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 rounded-xl p-4 w-full"
      style={{
        background: `linear-gradient(135deg, ${MINT}18, ${CYAN}10)`,
        border: `2px solid ${MINT}`,
        boxShadow: `0 0 24px ${MINT}22`,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl text-base font-black shrink-0"
        style={{
          background: playing ? CYAN : MINT,
          color: '#000',
          minWidth: 220,
          minHeight: 56,
          boxShadow: playing ? `0 0 16px ${CYAN}66` : `0 0 16px ${MINT}66`,
        }}
      >
        {playing ? <Pause size={22} strokeWidth={2.5} /> : <Play size={22} strokeWidth={2.5} fill="#000" />}
        {playing ? 'Stop playback' : '▶ Play'}
      </button>
      <div className="flex flex-col justify-center min-w-0">
        <p className="text-sm font-black" style={{ color: '#fff' }}>
          {playing ? 'Playing your stem with chords + bass' : label}
        </p>
        <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: '#aaa' }}>
          {hasMatchedChords
            ? 'Hear your vocal with the matched progression. Switch chips below to try other matches.'
            : 'Preview chords play with your vocal now. Hit Generate for chords matched to your melody.'}
        </p>
      </div>
    </div>
  );
}
