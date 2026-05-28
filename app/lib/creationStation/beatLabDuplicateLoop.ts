/**
 * Duplicate the current Beat Lab loop region (pattern columns) end-to-end.
 * Copies pad-lane steps + midi-roll notes into the next block of bars.
 */

import type { BeatLabMidiNote } from '@/app/lib/creationStation/beatLabMidiRoll';
import { BEAT_LAB_PAD_LANES } from '@/app/lib/creationStation/beatLabMidiRoll';

export type DrumPattern = boolean[][];

/** Pattern columns spanned by loop start/end in beats (4/4, `subdiv` cells per quarter). */
export function beatLabLoopSpanPatternCols(
  loopStartBeat: number,
  loopEndBeat: number,
  subdiv: number,
): number {
  const s = Math.max(0, loopEndBeat - loopStartBeat);
  return Math.max(1, Math.round(s * Math.max(1, subdiv) + 1e-6));
}

/** Destination half of a DUP append (pattern columns `spanCols` … `2·spanCols − 1`). */
function beatLabDupDestPatternColRange(spanCols: number): { start: number; end: number } {
  return { start: spanCols, end: spanCols * 2 };
}

function noteOverlapsPatternColRange(
  n: BeatLabMidiNote,
  colStart: number,
  colEnd: number,
): boolean {
  const head = n.col;
  const tail = n.col + Math.max(1, n.len);
  return head < colEnd && tail > colStart;
}

export function beatLabDuplicateLoopPattern(params: {
  drums: DrumPattern;
  midiRoll: BeatLabMidiNote[];
  drumColOffset: number;
  /** Source pattern columns [0, spanCols). */
  spanCols: number;
  maxPatternCols: number;
}): { drums: DrumPattern; midiRoll: BeatLabMidiNote[] } | null {
  const { drums, midiRoll, drumColOffset, spanCols, maxPatternCols } = params;
  if (spanCols <= 0) return null;
  const destPatternCol = spanCols;
  if (destPatternCol + spanCols > maxPatternCols) return null;

  const storageSrc = drumColOffset;
  const storageDst = drumColOffset + spanCols;
  const needStorage = storageDst + spanCols;
  const destPat = beatLabDupDestPatternColRange(spanCols);

  const nextDrums = drums.map((row) => {
    const r = row.slice();
    while (r.length < needStorage) r.push(false);
    /** Wipe the append region first — old steps there must not play after DUP. */
    for (let i = 0; i < spanCols; i++) {
      r[storageDst + i] = false;
    }
    for (let i = 0; i < spanCols; i++) {
      r[storageDst + i] = Boolean(r[storageSrc + i]);
    }
    return r;
  });

  const padNotes = midiRoll.filter((n) => n.lane < BEAT_LAB_PAD_LANES);
  const otherNotes = midiRoll.filter((n) => n.lane >= BEAT_LAB_PAD_LANES);
  const padCopies: BeatLabMidiNote[] = [];
  const melodicCopies: BeatLabMidiNote[] = [];

  for (const n of padNotes) {
    if (n.col < 0 || n.col >= spanCols) continue;
    const newCol = n.col + destPatternCol;
    const maxLen = maxPatternCols - newCol;
    if (maxLen < 1) continue;
    padCopies.push({
      ...n,
      col: newCol,
      len: Math.min(n.len, maxLen),
    });
  }

  for (const n of otherNotes) {
    if (n.col < 0 || n.col >= spanCols) continue;
    const newCol = n.col + destPatternCol;
    const maxLen = maxPatternCols - newCol;
    if (maxLen < 1) continue;
    melodicCopies.push({
      ...n,
      col: newCol,
      len: Math.min(n.len, maxLen),
    });
  }

  const keepPad = padNotes.filter(
    (n) => !noteOverlapsPatternColRange(n, destPat.start, destPat.end),
  );
  const keepOther = otherNotes.filter(
    (n) => !noteOverlapsPatternColRange(n, destPat.start, destPat.end),
  );

  return {
    drums: nextDrums,
    midiRoll: [...keepOther, ...keepPad, ...padCopies, ...melodicCopies],
  };
}
