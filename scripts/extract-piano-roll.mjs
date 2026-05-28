import { readFileSync, writeFileSync } from 'fs';

const src = readFileSync('app/components/creation/ChordBuilderTab.tsx', 'utf8');
const lines = src.split(/\r?\n/);
const start = lines.findIndex((l) => l === 'function PianoRoll({');
const end = lines.findIndex((l, i) => i > start && l === 'function ToolbarSelect({');
if (start < 0 || end < 0) throw new Error(`bounds ${start} ${end}`);

const body = lines.slice(start, end).join('\n');
const header = `/**
 * Chord Builder piano roll — shared with Beat Lab SYNTH.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  chordSymbolToName,
  type ChordEventOut,
  type ChordMode,
  type ChordSymbol,
  type TimelineSlot,
} from '@/app/lib/creationStation/chordBuilder';
import {
  chordBuilderDefaultNoteLengthQ,
  chordBuilderPreviewCols,
  type ChordBuilderBlockSpan,
} from '@/app/lib/creationStation/chordBuilderBeatLabImport';
import {
  CB_PIANO_BLACK_KEY_W,
  CB_PIANO_LABEL_W,
  CB_PIANO_MINT,
  CB_PIANO_MINT_BG,
  CB_PIANO_MINT_DIM,
  CB_PIANO_ROWS,
  CB_PIANO_ROW_H,
  CB_PIANO_WHITE_KEY_W,
  cbPianoMidiToNoteName,
  cbPianoNoteNameToMidi,
} from '@/app/lib/creationStation/chordBuilderPianoRollTheme';

const DND_CHORD_MIME = 'application/x-da-music-chord';
const BAR_LABEL_H = 28;
const GRID_PX_PER_BEAT = 36;
const RULER_H = 18;
const PIANO_BAR_MIN_W = 96;

const PIANO_ROW_H = CB_PIANO_ROW_H;
const PIANO_LABEL_W = CB_PIANO_LABEL_W;
const PIANO_WHITE_KEY_W = CB_PIANO_WHITE_KEY_W;
const PIANO_BLACK_KEY_W = CB_PIANO_BLACK_KEY_W;
const PIANO_ROWS = CB_PIANO_ROWS;
const PIANO_BLACK_ROWS = new Set<string>(PIANO_ROWS.filter((n) => n.includes('#')));
const MINT = CB_PIANO_MINT;
const MINT_DIM = CB_PIANO_MINT_DIM;
const MINT_BG = CB_PIANO_MINT_BG;

function midiToNoteName(midi: number): string {
  return cbPianoMidiToNoteName(midi);
}

function noteNameToMidi(name: string): number {
  return cbPianoNoteNameToMidi(name);
}

export type ChordBuilderPianoRollLayout = 'chord-builder' | 'beat-lab-synth';

export type ChordBuilderPianoRollProps = {
  layout?: ChordBuilderPianoRollLayout;
  timeline: TimelineSlot[];
  previewEvents: ChordEventOut[];
  totalBars: number;
  colsPerBar: number;
  keyRoot: number;
  mode: ChordMode;
  playheadCol: number;
  dragTargetBar: number | null;
  playingMidis: ReadonlySet<number>;
  manualAdded: ReadonlySet<string>;
  manualRemoved: ReadonlySet<string>;
  noteLengths: ReadonlyMap<string, number>;
  blockSpans: ReadonlyArray<ChordBuilderBlockSpan>;
  onPlayPitch: (midi: number) => void;
  onPlayheadChange: (col: number) => void;
  onToggleNote: (row: number, col: number, isAutoNote: boolean) => void;
  onMoveNote: (
    fromRow: number,
    fromCol: number,
    toRow: number,
    toCol: number,
    wasAuto: boolean,
  ) => void;
  onResizeNote: (row: number, col: number, len: number) => void;
  barSelRange: { start: number; end: number } | null;
  onBarHeaderPointer: (barIdx: number, shiftKey: boolean) => void;
  onBarDrop: (barIdx: number, symbol: ChordSymbol) => void;
  onBarDragOver: (barIdx: number | null) => void;
  onBarDragLeave: () => void;
  onClearEdits: () => void;
  hasEdits: boolean;
  sizeMode: 'compact' | 'normal' | 'expanded';
  onSizeModeChange: (mode: 'compact' | 'normal' | 'expanded') => void;
  isPlaying: boolean;
  playheadElRef?: React.MutableRefObject<HTMLDivElement | null>;
  headerTitle?: string;
  headerHint?: string;
};

export `;

const renamed = body.replace(/^function PianoRoll\(/m, 'export function ChordBuilderPianoRoll(');
const withLayout = renamed.replace(
  /^export function ChordBuilderPianoRoll\(\{/m,
  `export function ChordBuilderPianoRoll({
  layout = 'chord-builder',`,
);

// Inject layout checks - we'll patch file after
writeFileSync('app/components/creation/ChordBuilderPianoRoll.tsx', header + withLayout + '\n', 'utf8');
console.log('wrote', end - start, 'lines');
