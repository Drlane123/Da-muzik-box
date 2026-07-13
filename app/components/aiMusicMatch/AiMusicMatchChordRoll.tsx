'use client';

import { Pause, Play } from 'lucide-react';

import type { MatchLoopBarCount, MatchRollBar, MatchRollNote } from '@/app/lib/aiMusicMatch/aiMusicMatchRollData';

const MINT = '#7cf4c6';
const CYAN = '#00E5FF';
const BASS_COLOR = '#fbbf24';

function midiToRow(midi: number, lane: 'chord' | 'bass'): number {
  if (lane === 'bass') return Math.max(0, Math.min(5, midi - 28));
  return Math.max(0, Math.min(11, Math.floor((midi - 48) / 3)));
}

export function AiMusicMatchChordRoll({
  bars,
  notes,
  loopBarCount,
  onLoopBarCountChange,
  previewBeat,
  previewing,
  playing = false,
  onTogglePlayback,
  hasMatchedChords = false,
  beatsPerBar = 4,
}: {
  bars: readonly MatchRollBar[];
  notes: readonly MatchRollNote[];
  loopBarCount: MatchLoopBarCount;
  onLoopBarCountChange: (n: MatchLoopBarCount) => void;
  previewBeat: number | null;
  previewing: boolean;
  playing?: boolean;
  onTogglePlayback?: () => void;
  hasMatchedChords?: boolean;
  beatsPerBar?: number;
}) {
  const totalBeats = loopBarCount * beatsPerBar;
  const chordNotes = notes.filter((n) => n.lane === 'chord');
  const bassNotes = notes.filter((n) => n.lane === 'bass');

  const playheadPct =
    previewing && previewBeat != null
      ? ((previewBeat % totalBeats) / totalBeats) * 100
      : null;

  return (
    <div
      className="rounded-xl border overflow-hidden w-full"
      style={{
        borderColor: `${MINT}66`,
        background: 'linear-gradient(180deg, #141820 0%, #080810 100%)',
      }}
    >
      <div
        className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b"
        style={{ borderColor: '#252530' }}
      >
        <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: MINT }}>
          Loop Editor
        </span>
        {onTogglePlayback ? (
          <button
            type="button"
            onClick={onTogglePlayback}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black"
            style={{ background: playing ? CYAN : MINT, color: '#000' }}
          >
            {playing ? <Pause size={14} strokeWidth={2.5} /> : <Play size={14} strokeWidth={2.5} fill="#000" />}
            {playing ? 'Stop' : hasMatchedChords ? 'Play vocal + chords' : 'Play vocal + preview chords'}
          </button>
        ) : null}
        <div className="flex-1" />
        {([4, 8] as const).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onLoopBarCountChange(n)}
            className="px-2 py-1 rounded text-[10px] font-black"
            style={{
              background: loopBarCount === n ? `${MINT}22` : '#242424',
              color: loopBarCount === n ? MINT : '#888',
              border: `1px solid ${loopBarCount === n ? MINT : '#333'}`,
            }}
          >
            {n} bars
          </button>
        ))}
      </div>

      <div className="flex border-b" style={{ borderColor: '#252530' }}>
        <div className="shrink-0 w-14" />
        <div className="flex flex-1 min-w-0 relative">
          {Array.from({ length: loopBarCount }, (_, bar) => {
            const spec = bars[bar];
            return (
              <div
                key={bar}
                className="flex-1 min-w-[72px] px-1 py-2 border-r text-center"
                style={{ borderColor: '#252530' }}
              >
                <div className="text-[9px] font-black" style={{ color: MINT }}>
                  {spec?.roman ?? '—'}
                </div>
                <div className="text-[8px] truncate" style={{ color: '#888' }}>
                  {spec?.chordName ?? '…'}
                </div>
              </div>
            );
          })}
          {playheadPct != null ? (
            <div
              className="absolute top-0 bottom-0 w-0.5 pointer-events-none"
              style={{ left: `${playheadPct}%`, background: CYAN, boxShadow: `0 0 8px ${CYAN}` }}
            />
          ) : null}
        </div>
      </div>

      <RollLane label="Chords" color={MINT} notes={chordNotes} totalBeats={totalBeats} playheadPct={playheadPct} />
      <RollLane label="Bass" color={BASS_COLOR} notes={bassNotes} totalBeats={totalBeats} playheadPct={playheadPct} />
    </div>
  );
}

function RollLane({
  label,
  color,
  notes,
  totalBeats,
  playheadPct,
}: {
  label: string;
  color: string;
  notes: readonly MatchRollNote[];
  totalBeats: number;
  playheadPct: number | null;
}) {
  const rows = 6;
  return (
    <div className="border-b last:border-b-0" style={{ borderColor: '#252530' }}>
      <div className="px-3 py-1 text-[9px] font-black uppercase tracking-wide" style={{ color }}>
        {label}
      </div>
      <div className="flex relative" style={{ height: rows * 18 + 8 }}>
        <div className="shrink-0 w-14" style={{ background: '#060608' }} />
        <div className="relative flex-1 min-w-0" style={{ background: '#0a0a10' }}>
          {Array.from({ length: totalBeats }, (_, beat) => (
            <div
              key={beat}
              className="absolute top-0 bottom-0 border-r"
              style={{
                left: `${(beat / totalBeats) * 100}%`,
                borderColor: beat % 4 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
              }}
            />
          ))}
          {notes.map((n, i) => {
            const row = midiToRow(n.midi, n.lane);
            return (
              <div
                key={`${n.lane}-${n.startBeat}-${n.midi}-${i}`}
                className="absolute rounded-sm"
                style={{
                  left: `${(n.startBeat / totalBeats) * 100}%`,
                  width: `${Math.max(2, (n.durationBeats / totalBeats) * 100)}%`,
                  top: 4 + row * 18,
                  height: 14,
                  background: `${color}cc`,
                  border: `1px solid ${color}`,
                }}
              />
            );
          })}
          {playheadPct != null ? (
            <div
              className="absolute top-0 bottom-0 w-0.5 pointer-events-none z-10"
              style={{ left: `${playheadPct}%`, background: CYAN }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
