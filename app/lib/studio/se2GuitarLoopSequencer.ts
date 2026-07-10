/**
 * SE2 Guitar — 4-bar × 16th-step loop sequencer (Ample Strummer SEQ#1).
 */
import {
  SE2_GUITAR_CHORDS,
  se2GuitarStrumNotesAtBar,
  type Se2GuitarChordDef,
  type Se2GuitarChordId,
  type Se2GuitarStrumPatternId,
} from '@/app/lib/studio/se2GuitarChords';
import type { Se2GuitarLoopNote } from '@/app/lib/studio/se2GuitarLoopPresets';

export const SE2_GUITAR_SEQ_BARS = 4;
export const SE2_GUITAR_SEQ_STEPS_PER_BAR = 16;
export const SE2_GUITAR_SEQ_TOTAL_STEPS =
  SE2_GUITAR_SEQ_BARS * SE2_GUITAR_SEQ_STEPS_PER_BAR;

export type Se2GuitarSeqDisplayBars = 4 | 8;

export function se2GuitarSeqStepsForBars(seqBars: Se2GuitarSeqDisplayBars): number {
  return seqBars * SE2_GUITAR_SEQ_STEPS_PER_BAR;
}

/** Map an 8-bar step index onto the underlying 4-bar pattern cell. */
export function se2GuitarSeqCanonicalStep(step: number): number {
  return step % SE2_GUITAR_SEQ_TOTAL_STEPS;
}

export type Se2GuitarSeqRowId = 'down' | 'up' | 'down_up' | 'mute' | 'arp' | 'chord';

export type Se2GuitarSeqRow = {
  id: Se2GuitarSeqRowId;
  label: string;
  icon: string;
  pattern: Se2GuitarStrumPatternId | null;
};

export const SE2_GUITAR_SEQ_ROWS: readonly Se2GuitarSeqRow[] = [
  { id: 'down', label: 'Down', icon: '↓', pattern: 'down' },
  { id: 'up', label: 'Up', icon: '↑', pattern: 'up' },
  { id: 'down_up', label: 'D-U', icon: '↕', pattern: 'down_up' },
  { id: 'mute', label: 'Mute', icon: '×', pattern: 'mute' },
  { id: 'arp', label: 'Arp', icon: '⌇', pattern: 'arpeggio_down' },
  { id: 'chord', label: 'Chg', icon: '♦', pattern: null },
];

/** Pop / R&B friendly default slot bank. */
export const SE2_GUITAR_CHORD_SLOT_DEFAULTS: readonly Se2GuitarChordId[] = [
  'C',
  'G',
  'Am',
  'F',
  'Dm7',
  'G7',
  'Cmaj7',
  'Am7',
  'Fmaj7',
  'G6',
  'Cadd9',
  'G',
];

export type Se2GuitarSeqPattern = {
  id: number;
  name: string;
  style: string;
  /** rowIndex → set of step indices (0..63) */
  cells: Record<Se2GuitarSeqRowId, readonly number[]>;
  /** chord slot index per bar (0..11) */
  barChords: readonly number[];
};

function pat(
  id: number,
  name: string,
  style: string,
  cells: Record<Se2GuitarSeqRowId, readonly number[]>,
  barChords: readonly number[],
): Se2GuitarSeqPattern {
  return { id, name, style, cells, barChords };
}

/** Eight factory patterns — Ample-style preset bank. */
export const SE2_GUITAR_SEQ_PATTERNS: readonly Se2GuitarSeqPattern[] = [
  pat(
    1,
    'Default1',
    'Pop',
    {
      down: [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60],
      up: [2, 6, 10, 14, 18, 22, 26, 30, 34, 38, 42, 46, 50, 54, 58, 62],
      down_up: [],
      mute: [],
      arp: [],
      chord: [0, 16, 32, 48],
    },
    [0, 1, 2, 3],
  ),
  pat(
    2,
    'Folk pick',
    'Country',
    {
      down: [0, 8, 16, 24, 32, 40, 48, 56],
      up: [],
      down_up: [],
      mute: [],
      arp: [4, 12, 20, 28, 36, 44, 52, 60],
      chord: [0, 16, 32, 48],
    },
    [0, 3, 2, 1],
  ),
  pat(
    3,
    'R&B pocket',
    'R&B',
    {
      down: [0, 6, 16, 22, 32, 38, 48, 54],
      up: [10, 26, 42, 58],
      down_up: [],
      mute: [],
      arp: [],
      chord: [0, 16, 32, 48],
    },
    [0, 5, 6, 3],
  ),
  pat(
    4,
    'Ballad',
    'Soul',
    {
      down: [0, 16, 32, 48],
      up: [],
      down_up: [],
      mute: [],
      arp: [0, 2, 4, 6, 16, 18, 20, 22, 32, 34, 36, 38, 48, 50, 52, 54],
      chord: [0, 16, 32, 48],
    },
    [0, 6, 3, 7],
  ),
  pat(
    5,
    'Funk chop',
    'Funk',
    {
      down: [],
      up: [],
      down_up: [],
      mute: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60, 62],
      arp: [],
      chord: [0, 16, 32, 48],
    },
    [2, 2, 7, 7],
  ),
  pat(
    6,
    'Rock drive',
    'Rock',
    {
      down: [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60],
      up: [14, 30, 46, 62],
      down_up: [],
      mute: [],
      arp: [],
      chord: [0, 16, 32, 48],
    },
    [8, 3, 2, 1],
  ),
  pat(
    7,
    'Gospel',
    'Gospel',
    {
      down: [0, 8, 16, 24, 32, 40, 48, 56],
      up: [12, 28, 44, 60],
      down_up: [6, 22, 38, 54],
      mute: [],
      arp: [],
      chord: [0, 16, 32, 48],
    },
    [0, 6, 3, 7],
  ),
  pat(
    8,
    'Neo strum',
    'Neo-Soul',
    {
      down: [0, 10, 16, 26, 32, 42, 48, 58],
      up: [6, 22, 38, 54],
      down_up: [],
      mute: [],
      arp: [4, 20, 36, 52],
      chord: [0, 16, 32, 48],
    },
    [0, 5, 1, 3],
  ),
];

export function se2GuitarChordForSlot(slotIndex: number, slots: readonly Se2GuitarChordId[]): Se2GuitarChordDef {
  const id = slots[slotIndex % slots.length] ?? 'C';
  return SE2_GUITAR_CHORDS.find((c) => c.id === id) ?? SE2_GUITAR_CHORDS[0]!;
}

export function se2GuitarSeqPatternToNotes(
  pattern: Se2GuitarSeqPattern,
  chordSlots: readonly Se2GuitarChordId[],
  beatsPerBar = 4,
  startBar = 0,
  seqBars: Se2GuitarSeqDisplayBars = SE2_GUITAR_SEQ_BARS,
): Se2GuitarLoopNote[] {
  const stepBeats = beatsPerBar / SE2_GUITAR_SEQ_STEPS_PER_BAR;
  const barOff = startBar * beatsPerBar;
  const notes: Se2GuitarLoopNote[] = [];
  const totalSteps = se2GuitarSeqStepsForBars(seqBars);

  for (let step = 0; step < totalSteps; step += 1) {
    const bar = Math.floor(step / SE2_GUITAR_SEQ_STEPS_PER_BAR);
    const barInPattern = bar % SE2_GUITAR_SEQ_BARS;
    const canonicalStep = se2GuitarSeqCanonicalStep(step);
    const chordSlot = pattern.barChords[barInPattern] ?? 0;
    const chord = se2GuitarChordForSlot(chordSlot, chordSlots);
    const beat = barOff + step * stepBeats;

    for (const row of SE2_GUITAR_SEQ_ROWS) {
      if (!pattern.cells[row.id]?.includes(canonicalStep)) continue;
      if (row.pattern) {
        const strum = se2GuitarStrumNotesAtBar(chord, row.pattern, beatsPerBar).map((n) => ({
          ...n,
          startBeat: n.startBeat + beat,
          durationBeats: Math.min(n.durationBeats, stepBeats * 0.95),
        }));
        notes.push(...strum);
      }
    }
  }

  return notes.sort((a, b) => a.startBeat - b.startBeat);
}

export function cloneSeqPattern(p: Se2GuitarSeqPattern): Se2GuitarSeqPattern {
  const cells = {} as Record<Se2GuitarSeqRowId, number[]>;
  for (const row of SE2_GUITAR_SEQ_ROWS) {
    cells[row.id] = [...(p.cells[row.id] ?? [])];
  }
  return { ...p, cells, barChords: [...p.barChords] };
}

export function toggleSeqCell(
  pattern: Se2GuitarSeqPattern,
  rowId: Se2GuitarSeqRowId,
  step: number,
): Se2GuitarSeqPattern {
  const next = cloneSeqPattern(pattern);
  const canonical = se2GuitarSeqCanonicalStep(step);
  const set = new Set(next.cells[rowId] ?? []);
  if (set.has(canonical)) set.delete(canonical);
  else set.add(canonical);
  next.cells[rowId] = [...set].sort((a, b) => a - b);
  return next;
}
