'use client';

import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, RefreshCw, Wand2 } from 'lucide-react';

import { AiMusicMatchChordRoll } from '@/app/components/aiMusicMatch/AiMusicMatchChordRoll';
import { AiMusicMatchMixControls } from '@/app/components/aiMusicMatch/AiMusicMatchMixControls';
import { AiMusicMatchVocalStrip } from '@/app/components/aiMusicMatch/AiMusicMatchVocalStrip';
import { useMasterClock } from '@/app/context/MasterClockContext';
import {
  chordSymbolsToDisplay,
  keyModeLabel,
  type AiMatchGenre,
  type AiMatchMood,
} from '@/app/lib/aiMusicMatch/aiMusicMatch';
import type { PendingAiMatchStudioImport } from '@/app/lib/aiMusicMatch/aiMusicMatchStudioExport';
import {
  buildMatchRollData,
  buildStaticPlaceholderRollData,
  type MatchLoopBarCount,
} from '@/app/lib/aiMusicMatch/aiMusicMatchRollData';
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import type { MelodyProgressionCandidate } from '@/app/lib/creationStation/melodyToChordProgression';

const MINT = '#7cf4c6';
const CYAN = '#00E5FF';
const MATCH_UI_REV = '8';

export default function AiMusicMatchLoopPanel({
  audioBuffer,
  audioFile,
  candidates,
  selectedCandidateId,
  onSelectCandidate,
  keyRoot,
  mode,
  analysisBarCount,
  genre,
  mood,
  matching,
  onExportStudio,
  onOpenGrooveLab,
  onGenerate,
  canGenerate,
  loopBarCount,
  onLoopBarCountChange,
  playing,
  previewBeat,
  onTogglePlayback,
  hasMatchedChords,
  onStopPlayback,
  mix,
  onMixChange,
}: {
  audioBuffer: AudioBuffer;
  audioFile: File;
  candidates: MelodyProgressionCandidate[] | null;
  selectedCandidateId: string | null;
  onSelectCandidate: (id: string) => void;
  keyRoot: number;
  mode: ChordMode;
  analysisBarCount: number;
  genre: AiMatchGenre;
  mood: AiMatchMood;
  matching?: boolean;
  onExportStudio: (payload: PendingAiMatchStudioImport) => void;
  onOpenGrooveLab: (candidate: MelodyProgressionCandidate) => void;
  onGenerate: () => void;
  canGenerate: boolean;
  loopBarCount: MatchLoopBarCount;
  onLoopBarCountChange: (n: MatchLoopBarCount) => void;
  playing: boolean;
  previewBeat: number | null;
  onTogglePlayback: () => void;
  hasMatchedChords: boolean;
  onStopPlayback: () => void;
  mix: import('@/app/lib/aiMusicMatch/aiMusicMatchPreview').AiMatchPreviewMix;
  onMixChange: (partial: Partial<import('@/app/lib/aiMusicMatch/aiMusicMatchPreview').AiMatchPreviewMix>) => void;
}) {
  const { bpm } = useMasterClock();

  const hasMatch = Boolean(candidates && candidates.length > 0);

  const selected = useMemo(() => {
    if (!candidates?.length) return null;
    return candidates.find((c) => c.id === selectedCandidateId) ?? candidates[0] ?? null;
  }, [candidates, selectedCandidateId]);

  const placeholderRoll = useMemo(
    () => buildStaticPlaceholderRollData(keyRoot, mode, loopBarCount),
    [keyRoot, loopBarCount, mode],
  );

  const [matchedRoll, setMatchedRoll] = useState<ReturnType<typeof buildMatchRollData>>(null);

  useEffect(() => {
    if (!selected) {
      setMatchedRoll(null);
      return;
    }
    let cancelled = false;
    const id = window.setTimeout(() => {
      const built = buildMatchRollData({
        candidate: selected,
        keyRoot,
        mode,
        barCount: loopBarCount,
        genre,
        mood,
      });
      if (!cancelled) setMatchedRoll(built);
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [selected, keyRoot, mode, loopBarCount, genre, mood]);

  const rollData = selected ? matchedRoll : placeholderRoll;

  const exportStudio = () => {
    if (!selected) return;
    onStopPlayback();
    void import('@/app/lib/aiMusicMatch/aiMusicMatchStudioExport').then((mod) => {
      const payload = mod.buildAiMatchStudioExportPayload({
        candidate: selected,
        keyRoot,
        mode,
        barCount: loopBarCount,
        genre,
        mood,
        bpm,
        audioBlob: audioFile,
        trackName: audioFile.name.replace(/\.[^.]+$/, ''),
      });
      if (payload) onExportStudio(payload);
    });
  };

  return (
    <div
      className="flex flex-col gap-4 rounded-xl p-4 w-full min-w-0"
      style={{ background: '#0a0a0a', border: `2px solid ${MINT}44` }}
    >
      <div>
        <p className="text-xs font-black uppercase tracking-widest" style={{ color: MINT }}>
          Chord loop editor · UI v{MATCH_UI_REV}
        </p>
        <p className="text-[10px] mt-0.5" style={{ color: '#888' }}>
          {keyModeLabel(keyRoot, mode)} · {bpm} BPM · {genre} · {mood} · {loopBarCount} bars
        </p>
      </div>

      <AiMusicMatchMixControls mix={mix} onMixChange={onMixChange} />

      <div className="flex flex-wrap gap-2">
        {!hasMatch ? (
          <button
            type="button"
            onClick={onGenerate}
            disabled={!canGenerate || matching}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black"
            style={{
              background: !canGenerate || matching ? '#222' : `linear-gradient(135deg, ${MINT}, ${CYAN})`,
              color: !canGenerate || matching ? '#666' : '#000',
            }}
          >
            {matching ? <RefreshCw size={14} className="animate-spin" /> : <Wand2 size={14} />}
            {matching ? 'Matching…' : 'Generate matched chords'}
          </button>
        ) : (
          <button
            type="button"
            onClick={exportStudio}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-black"
            style={{ background: '#111', color: CYAN, border: `1px solid ${CYAN}55` }}
          >
            <ExternalLink size={12} />
            Send to Studio Editor 2
          </button>
        )}
      </div>

      {!hasMatch ? (
        <div
          className="rounded-lg px-3 py-2 text-[11px] font-bold"
          style={{ background: `${CYAN}12`, color: CYAN, border: `1px solid ${CYAN}33` }}
        >
          Use <strong>▶ Play</strong> in the loop editor below to hear your vocal with chords + bass. Then hit{' '}
          <strong>Generate matched chords</strong> for progressions fit to your melody.
        </div>
      ) : null}

      {matching ? (
        <div className="flex items-center gap-2 text-xs" style={{ color: CYAN }}>
          <RefreshCw size={14} className="animate-spin" />
          Matching chords to your vocal…
        </div>
      ) : null}

      {hasMatch && candidates ? (
        <div className="flex flex-wrap gap-2">
          {candidates.map((c, i) => {
            const active = selected?.id === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelectCandidate(c.id)}
                className="text-left px-3 py-2 rounded-lg text-xs max-w-full"
                style={{
                  background: active ? 'rgba(124, 244, 198, 0.12)' : '#111',
                  border: `1px solid ${active ? MINT : '#333'}`,
                  color: active ? MINT : '#aaa',
                }}
              >
                <span className="font-black block">
                  {i === 0 ? 'Best · ' : ''}
                  {c.label}
                </span>
                <span className="text-[10px] opacity-80">
                  {chordSymbolsToDisplay(c.chords, keyRoot, mode)}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      <AiMusicMatchVocalStrip
        audioBuffer={audioBuffer}
        loopBars={loopBarCount}
        bpm={bpm}
        previewBeat={previewBeat}
        previewing={playing}
      />

      {rollData ? (
        <AiMusicMatchChordRoll
          bars={rollData.bars}
          notes={rollData.notes}
          loopBarCount={loopBarCount}
          onLoopBarCountChange={onLoopBarCountChange}
          previewBeat={previewBeat}
          previewing={playing}
          playing={playing}
          onTogglePlayback={onTogglePlayback}
          hasMatchedChords={hasMatchedChords}
        />
      ) : hasMatch && selected ? (
        <div className="rounded-lg py-12 text-center text-xs flex flex-col items-center gap-2" style={{ color: CYAN }}>
          <RefreshCw size={16} className="animate-spin" />
          Building chord roll…
        </div>
      ) : (
        <div className="rounded-lg py-12 text-center text-xs" style={{ color: '#f4a0a0' }}>
          Could not build chord roll — try another progression or re-upload.
        </div>
      )}

      {hasMatch && selected ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => onOpenGrooveLab(selected)}
            className="text-[10px] font-bold px-3 py-1.5 rounded border"
            style={{ borderColor: '#333', color: '#888' }}
          >
            Open in Groove Lab instead
          </button>
        </div>
      ) : null}
    </div>
  );
}
