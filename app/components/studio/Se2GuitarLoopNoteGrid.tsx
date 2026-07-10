'use client';

import { useMemo } from 'react';
import { Se2SynthGenoLoopChordPianoRoll } from '@/app/components/studio/Se2SynthGenoLoopChordPianoRoll';
import type { Se2GuitarPartBars } from '@/app/lib/studio/se2GuitarPartBars';
import { SE2_GUITAR_PITCH_HI, SE2_GUITAR_PITCH_LO } from '@/app/lib/studio/se2GuitarTrack';
import type { Se2GuitarMockNote } from '@/app/lib/studio/se2GuitarTrack';
import { SE2_GUITAR_UI } from '@/app/lib/studio/se2GuitarUiTheme';

export type Se2GuitarLoopNoteGridProps = {
  notes: readonly Se2GuitarMockNote[];
  loopBars: Se2GuitarPartBars;
  beatsPerBar: number;
  accentHex?: string;
  selectionLabel?: string;
  chordLine?: string;
};

export function Se2GuitarLoopNoteGrid({
  notes,
  loopBars,
  beatsPerBar,
  accentHex = SE2_GUITAR_UI.accent,
  selectionLabel,
  chordLine,
}: Se2GuitarLoopNoteGridProps) {
  const barCount = loopBars >= 8 ? 8 : loopBars >= 4 ? 4 : loopBars;
  const totalBeats = barCount * beatsPerBar;

  const rollNotes = useMemo(
    () =>
      notes
        .filter((n) => n.startBeat < totalBeats)
        .map((n) => ({
          pitch: n.pitch,
          startBeat: n.startBeat,
          durationBeats: n.durationBeats,
          velocity: n.velocity,
        })),
    [notes, totalBeats],
  );

  return (
    <div
      className="flex min-w-0 flex-col gap-0.5 rounded border"
      style={{
        borderColor: `${accentHex}55`,
        background: SE2_GUITAR_UI.insetBg,
        boxShadow: `inset 0 1px 0 ${accentHex}18`,
      }}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0 px-1.5 pt-1">
        <span className="text-[7px] font-black uppercase tracking-wider" style={{ color: accentHex }}>
          Loop grid
        </span>
        <span className="text-[6px] font-bold uppercase" style={{ color: SE2_GUITAR_UI.textSoft }}>
          {barCount} bars · notes preview
        </span>
        {selectionLabel ? (
          <span className="truncate text-[6px] font-bold" style={{ color: SE2_GUITAR_UI.textMuted }}>
            · {selectionLabel}
          </span>
        ) : null}
      </div>
      {chordLine ? (
        <div className="truncate px-1.5 text-[6px] font-mono" style={{ color: SE2_GUITAR_UI.textMuted }}>
          {chordLine}
        </div>
      ) : null}
      {rollNotes.length === 0 ? (
        <div
          className="flex min-h-[120px] items-center justify-center px-2 py-4 text-center text-[7px] font-bold uppercase leading-relaxed"
          style={{ color: SE2_GUITAR_UI.textSoft }}
        >
          Select a preset loop below — notes appear here for {barCount} bars
        </div>
      ) : (
        <div className="max-h-[min(240px,42vh)] min-h-[120px] overflow-auto overscroll-contain">
          <Se2SynthGenoLoopChordPianoRoll
            notes={rollNotes}
            barCount={barCount}
            beatsPerBar={beatsPerBar}
            minMidi={SE2_GUITAR_PITCH_LO}
            maxMidi={SE2_GUITAR_PITCH_HI}
            accentHex={accentHex}
            editLocked
            sixteenthGrid
          />
        </div>
      )}
    </div>
  );
}
