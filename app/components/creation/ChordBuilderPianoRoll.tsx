/**
 * Chord Builder piano roll — shared with Beat Lab SYNTH.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  chordSymbolToName,
  type ChordEventOut,
  type ChordMode,
  type ChordSymbol,
} from '@/app/lib/creationStation/chordBuilder';
import type { TimelineSlot } from '@/app/lib/creationStation/chordBlocks';
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
  chordRollRowForMidi,
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
  /** Release after piano key mouse-up (Vital-style sustained preview). */
  onReleasePitch?: (midi: number) => void;
  onPlayheadChange: (col: number) => void;
  onToggleNote: (row: number, col: number, isAutoNote: boolean, isLit?: boolean) => void;
  /** Beat Lab SYNTH brush (draw/erase) — drag across cells. */
  onCellPointer?: (row: number, col: number, isAutoNote: boolean, isLit: boolean) => void;
  onBrushStrokeStart?: () => void;
  onBrushStrokeEnd?: () => void;
  /** Beat Lab SYNTH — hear existing note on pointer down (before drag). */
  onAuditionCell?: (row: number, col: number) => void;
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
  /** Optional outer scroll container (Beat Lab SYNTH follow-scroll). */
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
  headerTitle?: string;
  headerHint?: string;
};

export function ChordBuilderPianoRoll({
  layout = 'chord-builder',
  timeline,
  previewEvents,
  totalBars,
  colsPerBar,
  keyRoot,
  mode,
  playheadCol,
  dragTargetBar,
  playingMidis,
  manualAdded,
  manualRemoved,
  noteLengths,
  blockSpans,
  onPlayPitch,
  onReleasePitch,
  onPlayheadChange,
  onToggleNote,
  onCellPointer,
  onBrushStrokeStart,
  onBrushStrokeEnd,
  onAuditionCell,
  onMoveNote,
  onResizeNote,
  barSelRange,
  onBarHeaderPointer,
  onBarDrop,
  onBarDragOver,
  onBarDragLeave,
  onClearEdits,
  hasEdits,
  sizeMode,
  onSizeModeChange,
  isPlaying,
  playheadElRef,
  scrollContainerRef,
  headerTitle,
  headerHint,
}: ChordBuilderPianoRollProps) {
  const keyPointerRef = useRef({ down: false, lastMidi: 0 });
  const isBeatLab = layout === 'beat-lab-synth';
  const gridTopOffset = isBeatLab ? RULER_H : RULER_H + BAR_LABEL_H;

  useEffect(() => {
    const endKeyPointer = () => {
      if (!keyPointerRef.current.down) return;
      const midi = keyPointerRef.current.lastMidi;
      keyPointerRef.current.down = false;
      if (midi > 0) onReleasePitch?.(midi);
    };
    window.addEventListener('pointerup', endKeyPointer);
    window.addEventListener('pointercancel', endKeyPointer);
    return () => {
      window.removeEventListener('pointerup', endKeyPointer);
      window.removeEventListener('pointercancel', endKeyPointer);
    };
  }, [onReleasePitch]);

  const playPianoKey = useCallback(
    (rowMidi: number) => {
      if (rowMidi <= 0) return;
      keyPointerRef.current.down = true;
      keyPointerRef.current.lastMidi = rowMidi;
      onPlayPitch(rowMidi);
    },
    [onPlayPitch],
  );

  const enterPianoKey = useCallback(
    (rowMidi: number) => {
      if (!keyPointerRef.current.down || rowMidi <= 0) return;
      if (rowMidi === keyPointerRef.current.lastMidi) return;
      keyPointerRef.current.lastMidi = rowMidi;
      onPlayPitch(rowMidi);
    },
    [onPlayPitch],
  );

  const totalCols = totalBars * colsPerBar;
  /** Cells produced by the chord progression itself, before user overrides. */
  const autoNoteSet = useMemo(() => {
    const set = new Set<string>();
    for (const { midi, col } of previewEvents) {
      const row = chordRollRowForMidi(midi);
      if (row >= 0 && col >= 0 && col < totalCols) {
        set.add(`${row},${col}`);
      }
    }
    return set;
  }, [previewEvents, totalCols]);

  const litCellKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const key of autoNoteSet) {
      if (!manualRemoved.has(key)) keys.add(key);
    }
    for (const key of manualAdded) keys.add(key);
    return keys;
  }, [autoNoteSet, manualAdded, manualRemoved]);

  const previewCols = useMemo(() => chordBuilderPreviewCols(previewEvents), [previewEvents]);

  const cellW = Math.max(20, Math.floor(PIANO_BAR_MIN_W / colsPerBar));
  const barW = cellW * colsPerBar;

  // Center the scroll view on the C4..C5 chord-voicing zone the first time the
  // panel renders so users don't have to scroll down past empty high octaves
  // to find where the chord notes actually appear.
  const internalScrollRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = scrollContainerRef ?? internalScrollRef;
  const didInitialScroll = useRef(false);
  useEffect(() => {
    if (didInitialScroll.current) return;
    const el = scrollRef.current;
    if (!el) return;
    const c5Idx = PIANO_ROWS.indexOf('C5');
    if (c5Idx < 0) return;
    const target = Math.max(0, c5Idx * PIANO_ROW_H - 24);
    el.scrollTop = target;
    didInitialScroll.current = true;
  }, []);

  /** Hit-test a viewport-space (clientX, clientY) coordinate against the
   *  piano-roll grid and return the (row, col) of the cell underneath. Used
   *  by the drag-to-move handler to translate pointer position into a target
   *  cell while the mouse is moving. Accounts for sticky key column + sticky
   *  bar header offsets and current scroll position. */
  const cellAt = useCallback(
    (clientX: number, clientY: number): { row: number; col: number } | null => {
      const el = scrollRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const localX = clientX - rect.left + el.scrollLeft - PIANO_LABEL_W;
      const localY = clientY - rect.top + el.scrollTop - gridTopOffset;
      if (localX < 0 || localY < 0) return null;
      const col = Math.floor(localX / cellW);
      const row = Math.floor(localY / PIANO_ROW_H);
      if (col < 0 || col >= totalCols) return null;
      if (row < 0 || row >= PIANO_ROWS.length) return null;
      return { row, col };
    },
    [cellW, gridTopOffset, totalCols],
  );

  /** Per-mousedown drag context. Populated on mousedown over a lit cell and
   *  cleared on mouseup. `moved` flips to true once the pointer has traveled
   *  past the 3-px threshold so the subsequent click event knows to skip its
   *  toggle (the click is the drag's mouseup-completion, not an intent-to-toggle). */
  const dragRef = useRef<{
    fromRow: number;
    fromCol: number;
    wasAuto: boolean;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  /** Set by the drag-end mouseup so the immediately-following click handler
   *  on the lifted-over cell skips its toggle action. Cleared on next click. */
  const justDraggedRef = useRef(false);
  /** Live drag-target cell for the hover outline while dragging. */
  const [dragTargetCell, setDragTargetCell] = useState<{ row: number; col: number } | null>(null);

  /** Active resize-handle context. Populated on mousedown over a note's
   *  right-edge grabber and cleared on mouseup. Drives mousemove → length
   *  updates so the note grows / shrinks in real time as the pointer moves. */
  const resizeRef = useRef<{
    row: number;
    headCol: number;
    startX: number;
    startLen: number;
  } | null>(null);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const r = resizeRef.current;
      if (!r) return;
      const deltaX = e.clientX - r.startX;
      const deltaCols = Math.round(deltaX / cellW);
      const nextLen = Math.max(1, r.startLen + deltaCols);
      onResizeNote(r.row, r.headCol, nextLen);
    }
    function onUp() {
      if (resizeRef.current) justDraggedRef.current = true;
      resizeRef.current = null;
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [cellW, onResizeNote]);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (!drag.moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
      drag.moved = true;
      const cell = cellAt(e.clientX, e.clientY);
      setDragTargetCell(cell);
    }
    function onUp(e: MouseEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      if (drag.moved) {
        const cell = cellAt(e.clientX, e.clientY);
        if (cell && (cell.row !== drag.fromRow || cell.col !== drag.fromCol)) {
          onMoveNote(drag.fromRow, drag.fromCol, cell.row, cell.col, drag.wasAuto);
        }
        justDraggedRef.current = true;
      }
      dragRef.current = null;
      setDragTargetCell(null);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [cellAt, onMoveNote]);

  const brushStrokeRef = useRef(false);
  useEffect(() => {
    if (!onBrushStrokeEnd) return;
    function onUp() {
      if (!brushStrokeRef.current) return;
      brushStrokeRef.current = false;
      onBrushStrokeEnd();
    }
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, [onBrushStrokeEnd]);

  // Piano roll outer container style is driven by the current size mode.
  // Compact + Normal stay in the natural flex flow so other strips slot
  // above them as usual. Expanded mode lifts the panel out of flow as an
  // overlay (position: absolute, inset:0 within Chord Builder) so it can
  // cover the strips without forcing them to shrink or unmount.
  const containerStyle: React.CSSProperties = isBeatLab
    ? {
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#06060a',
      }
    : sizeMode === 'expanded'
      ? {
          position: 'absolute',
          left: 0,
          right: 0,
          top: 92,  // leaves the Chord Builder header + top toolbar visible
          bottom: 0,
          zIndex: 200,
          display: 'flex',
          flexDirection: 'column',
          background: '#06060a',
          borderTop: '1px solid rgba(124, 244, 198, 0.35)',
          boxShadow: '0 -8px 24px rgba(0, 0, 0, 0.55)',
        }
      : sizeMode === 'compact'
        ? {
            flex: '0 0 140px',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            background: '#06060a',
          }
        : {
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            background: '#06060a',
          };

  /** Tiny size-toggle button used three times in the header. Style stays
   *  inline so this file doesn't need a stylesheet for a feature the user
   *  only touches occasionally. */
  function SizeButton({
    mode: m,
    label,
    glyph,
    title,
  }: {
    mode: 'compact' | 'normal' | 'expanded';
    label: string;
    glyph: string;
    title: string;
  }) {
    const isActive = sizeMode === m;
    return (
      <button
        type="button"
        onClick={() => onSizeModeChange(m)}
        title={title}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 9,
          fontWeight: 800,
          color: isActive ? '#7cf4c6' : '#8a8a98',
          background: isActive
            ? 'rgba(124, 244, 198, 0.14)'
            : 'rgba(255, 255, 255, 0.04)',
          border: `1px solid ${isActive ? 'rgba(124, 244, 198, 0.45)' : 'rgba(255, 255, 255, 0.08)'}`,
          borderRadius: 4,
          padding: '3px 7px',
          cursor: 'pointer',
          letterSpacing: 0.4,
        }}
      >
        <span aria-hidden style={{ fontSize: 11, lineHeight: 1 }}>{glyph}</span>
        <span>{label}</span>
      </button>
    );
  }

  return (
    <div style={containerStyle}>
      <div
        style={{
          flexShrink: 0,
          padding: '6px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          background: 'rgba(0,0,0,0.30)',
          fontSize: 9,
          fontWeight: 800,
          color: '#8a8a98',
          letterSpacing: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span>{headerTitle ?? 'PIANO ROLL'}</span>
        <span
          style={{
            fontSize: 8,
            fontWeight: 600,
            color: '#54545e',
            letterSpacing: 0.4,
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {headerHint ??
            'click / drag ruler = playhead  ·  click bar header = place chord  ·  click cell = add / remove  ·  drag note = move  ·  drag right edge = resize'}
        </span>
        {!isBeatLab ? (
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <SizeButton
            mode="compact"
            label="MIN"
            glyph="▁"
            title="Minimize the piano roll — tuck it out of the way while arranging chords above"
          />
          <SizeButton
            mode="normal"
            label="FIT"
            glyph="▣"
            title="Fit the piano roll to the remaining viewport space (default)"
          />
          <SizeButton
            mode="expanded"
            label="MAX"
            glyph="▔"
            title="Expand the piano roll as an overlay — covers the strips above for focused note editing"
          />
        </div>
        ) : null}
          <button
            type="button"
            onClick={onClearEdits}
          title={isBeatLab ? 'Clear all notes on this SYNTH channel' : 'Remove all notes from the piano roll (chord timeline unchanged)'}
            style={{
              fontSize: 9,
              fontWeight: 800,
              color: '#7cf4c6',
              background: 'rgba(124, 244, 198, 0.10)',
              border: '1px solid rgba(124, 244, 198, 0.30)',
              borderRadius: 4,
              padding: '3px 8px',
              cursor: 'pointer',
              letterSpacing: 0.4,
              flexShrink: 0,
            }}
          >
          {isBeatLab ? 'CLEAR' : 'CLEAR NOTES'}
          </button>
      </div>
      <div ref={scrollRef} style={{ flex: 1, overflow: 'auto' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            minWidth: 'fit-content',
            position: 'relative',
          }}
        >
          {/* Single playhead line — a 2-px vertical mint stripe that spans
              the entire scrollable content (ruler, chord-name header, and
              every pitch row). Positioned absolutely so it sits *between*
              cells at column-precise X with no per-bar background glow.
              `pointer-events: none` keeps clicks falling through to the
              cells below, and a high z-index ensures it draws above the
              sticky ruler + bar header so the line stays visually continuous. */}
          <div
            ref={playheadElRef}
            aria-hidden
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              // Base offset stays on `left` (sticky-friendly). Beat
              // position is driven via `transform: translateX(...)`:
              // translateX is GPU-composited and the parent's rAF loop
              // writes directly to it without paint or layout reflow.
              // While playing we omit `transform` from the React-managed
              // style so React doesn't reset the rAF-written value on
              // unrelated re-renders.
              left: PIANO_LABEL_W,
              ...(isPlaying
                ? null
                : { transform: `translateX(${playheadCol * cellW}px)` }),
              willChange: 'transform',
              width: 2,
              background: 'rgba(124, 244, 198, 0.88)',
              boxShadow: '0 0 5px rgba(124, 244, 198, 0.50)',
              zIndex: 5,
              pointerEvents: 'none',
            }}
          />
          {/* Transport ruler — click or drag anywhere inside a bar to drop
              the playhead at that exact column (1/N-note resolution). Sticks
              to the top of the scroller so it's always reachable. */}
          <div
            style={{
              display: 'flex',
              alignItems: 'stretch',
              height: RULER_H,
              position: 'sticky',
              top: 0,
              zIndex: 4,
              background: 'rgba(8, 8, 12, 0.98)',
              borderBottom: '1px solid rgba(124, 244, 198, 0.10)',
              userSelect: 'none',
            }}
            onMouseDown={(e) => {
              if (e.button !== 0) return;
              e.preventDefault();
              const el = scrollRef.current;
              if (!el) return;
              function applyAt(clientX: number) {
                const node = scrollRef.current;
                if (!node) return;
                const rect = node.getBoundingClientRect();
                const localX = clientX - rect.left + node.scrollLeft - PIANO_LABEL_W;
                // localX < 0 means the click landed on the sticky "BAR" label
                // column on the left — ignore so the playhead doesn't snap to
                // col 0 every time the user grazes the label.
                if (localX < 0) return;
                const col = Math.floor(localX / cellW);
                onPlayheadChange(col);
              }
              applyAt(e.clientX);
              function onMove(ev: MouseEvent) {
                applyAt(ev.clientX);
              }
              function onUp() {
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
              }
              window.addEventListener('mousemove', onMove);
              window.addEventListener('mouseup', onUp);
            }}
            title="Click or drag anywhere to position the playhead"
          >
            <div
              style={{
                boxSizing: 'border-box',
                width: PIANO_LABEL_W,
                flexShrink: 0,
                background: '#08080c',
                borderRight: '1px solid rgba(124,244,198,0.18)',
                position: 'sticky',
                left: 0,
                zIndex: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 8,
                fontWeight: 700,
                color: 'rgba(255,255,255,0.30)',
                letterSpacing: 0.6,
                fontFamily: 'monospace',
              }}
            >
              BAR
            </div>
            {Array.from({ length: totalBars }).map((_, i) => (
              <div
                key={i}
                style={{
                  boxSizing: 'border-box',
                  width: barW,
                  flexShrink: 0,
                  position: 'relative',
                  borderRight: '1px solid rgba(124, 244, 198, 0.08)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  paddingLeft: 4,
                  fontSize: 8,
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.30)',
                  fontFamily: 'monospace',
                  letterSpacing: 0.3,
                }}
              >
                {i + 1}
              </div>
            ))}
          </div>
          {!isBeatLab ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'stretch',
              height: BAR_LABEL_H,
              position: 'sticky',
              top: RULER_H,
              zIndex: 3,
              background: 'rgba(10, 10, 14, 0.95)',
              borderBottom: '1px solid rgba(124, 244, 198, 0.16)',
            }}
          >
            <div
              style={{
                boxSizing: 'border-box',
                width: PIANO_LABEL_W,
                flexShrink: 0,
                background: '#0a0a10',
                borderRight: '1px solid rgba(124,244,198,0.18)',
                position: 'sticky',
                left: 0,
                zIndex: 4,
              }}
            />
            {Array.from({ length: totalBars }).map((_, i) => {
              const slot = timeline[i] ?? { chord: null };
              const isDragTarget = i === dragTargetBar;
              const inSel =
                barSelRange != null && i >= barSelRange.start && i <= barSelRange.end;
              const filled = slot.chord != null;
              const chordName = filled ? chordSymbolToName(slot.chord!, keyRoot, mode) : '';
              return (
                <div
                  key={i}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    onBarDragOver(i);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = 'copy';
                    if (dragTargetBar !== i) onBarDragOver(i);
                  }}
                  onDragLeave={(e) => {
                    const rt = e.relatedTarget as Node | null;
                    if (!rt || !(e.currentTarget as Node).contains(rt)) onBarDragLeave();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const sym = e.dataTransfer.getData(DND_CHORD_MIME) || e.dataTransfer.getData('text/plain');
                    onBarDragLeave();
                    if (sym) onBarDrop(i, sym as ChordSymbol);
                  }}
                  onClick={(e) => onBarHeaderPointer(i, e.shiftKey)}
                  style={{
                    boxSizing: 'border-box',
                    width: barW,
                    flexShrink: 0,
                    borderRight: '1px solid rgba(124, 244, 198, 0.10)',
                    background: isDragTarget
                      ? 'rgba(124, 244, 198, 0.22)'
                      : inSel
                        ? 'rgba(124, 244, 198, 0.16)'
                      : filled
                        ? 'rgba(124, 244, 198, 0.08)'
                        : 'rgba(255,255,255,0.02)',
                    color: filled ? MINT : '#54545e',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1,
                    position: 'relative',
                    transition: 'background 80ms ease-out, color 80ms ease-out',
                  }}
                  title={
                    filled
                      ? `Bar ${i + 1}: ${chordName} (${slot.chord}) — click to select · Shift+click range · Ctrl+C/V copy/paste notes`
                      : `Bar ${i + 1} — click to select · drop a chord from pads · Ctrl+C/V copy/paste notes`
                  }
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: 2,
                      left: 4,
                      fontSize: 8,
                      fontWeight: 700,
                      color: 'rgba(255,255,255,0.35)',
                      fontFamily: 'monospace',
                    }}
                  >
                    {i + 1}
                  </span>
                  {filled ? (
                    <>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 900,
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                          lineHeight: 1,
                        }}
                      >
                        {chordName}
                      </span>
                      <span
                        style={{
                          fontSize: 8,
                          fontWeight: 700,
                          opacity: 0.6,
                          fontFamily: 'monospace',
                          lineHeight: 1,
                        }}
                      >
                        {slot.chord}
                      </span>
                    </>
                  ) : (
                    '·'
                  )}
                </div>
              );
            })}
          </div>
          ) : null}

          {/* Pitch rows */}
          {PIANO_ROWS.map((noteName, ri) => {
            const isBlack = PIANO_BLACK_ROWS.has(noteName);
            const isC = noteName.startsWith('C') && !noteName.startsWith('C#');
            const rowMidi = noteNameToMidi(noteName);
            const isActiveKey = playingMidis.has(rowMidi);
            // Build the row's "note layout": for each lit cell, look up its
            // stretched length and mark the trailing columns as `skipCols`
            // so they won't render their own cell (the head cell expands to
            // visually cover them). `headLens` carries the final clamped
            // length per head column. Lengths never cross a bar boundary —
            // the parent already enforces this on writes, but we re-clamp
            // here as a defensive net.
            const rowSkipCols = new Set<number>();
            const rowHeadLens = new Map<number, number>();
            for (let col = 0; col < totalCols; col++) {
              if (rowSkipCols.has(col)) continue;
              const k = `${ri},${col}`;
              const isAuto = autoNoteSet.has(k);
              const isAdded = manualAdded.has(k);
              const isRemoved = manualRemoved.has(k);
              const isLit = (isAuto && !isRemoved) || isAdded;
              if (!isLit) continue;
              const rawLen = noteLengths.has(k)
                ? noteLengths.get(k)!
                : chordBuilderDefaultNoteLengthQ(
                    ri,
                    col,
                    litCellKeys,
                    previewCols,
                    blockSpans,
                    totalCols,
                  );
              const barIdxForCol = Math.floor(col / colsPerBar);
              const maxLen = (barIdxForCol + 1) * colsPerBar - col;
              const len = Math.max(1, Math.min(rawLen, maxLen));
              if (len > 1) {
                rowHeadLens.set(col, len);
                for (let c = col + 1; c < col + len; c++) rowSkipCols.add(c);
              }
            }
            // Pitch letter shown on the key. Naturals get full name on the C
            // octave anchor (e.g. "C4") and a single letter on the rest.
            // Black keys carry the sharp letter (e.g. "C#") without the octave
            // digit so the narrow ~35px key surface stays readable.
            const keyLabel = isC
              ? noteName
              : isBlack
                ? noteName.slice(0, 2)
                : noteName.charAt(0);
            return (
              <div
                key={noteName}
                style={{
                  display: 'flex',
                  alignItems: 'stretch',
                  height: PIANO_ROW_H,
                  background: isBlack ? '#08080c' : '#0c0c10',
                  borderBottom: isC
                    ? '1px solid rgba(124,244,198,0.10)'
                    : '1px solid rgba(255,255,255,0.02)',
                }}
              >
                {/* Piano key — vertical real-piano keyboard on the left side.
                 *   White keys: full-width, ivory gradient.
                 *   Black keys: ~62% width, dark gradient — leaves the white-key
                 *   surface visible to the right, mirroring a real keyboard.
                 *   `position: sticky` keeps the keyboard pinned to the viewport
                 *   left edge while the bars scroll horizontally. */}
                <div
                  onPointerDown={(e) => {
                    e.preventDefault();
                    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                    playPianoKey(rowMidi);
                  }}
                  onPointerEnter={() => enterPianoKey(rowMidi)}
                  title={`${noteName} · click or drag to play (Vital-style)`}
                  style={{
                    boxSizing: 'border-box',
                    width: PIANO_LABEL_W,
                    flexShrink: 0,
                    position: 'sticky',
                    left: 0,
                    zIndex: 2,
                    background: '#050507',
                    borderRight: '1px solid rgba(124,244,198,0.18)',
                    cursor: 'pointer',
                    userSelect: 'none',
                    touchAction: 'none',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: isBlack ? PIANO_BLACK_KEY_W : PIANO_WHITE_KEY_W,
                      background: isActiveKey
                        ? `linear-gradient(180deg, ${MINT} 0%, rgba(124,244,198,0.70) 100%)`
                        : isBlack
                          ? 'linear-gradient(180deg, #25252e 0%, #0e0e14 100%)'
                          : 'linear-gradient(180deg, #e5e5ec 0%, #b6b6c0 100%)',
                      boxShadow: isActiveKey
                        ? `0 0 6px ${MINT}, inset 0 0 0 1px rgba(255,255,255,0.4)`
                        : isBlack
                          ? 'inset 0 -1px 1px rgba(0,0,0,0.6), inset -1px 0 1px rgba(0,0,0,0.4)'
                          : 'inset 0 -1px 1px rgba(0,0,0,0.18), inset -1px 0 1px rgba(0,0,0,0.10)',
                      borderRadius: '0 3px 3px 0',
                      borderTop: isBlack ? 'none' : '1px solid rgba(255,255,255,0.45)',
                      borderBottom: isBlack
                        ? '1px solid #000'
                        : isC
                          ? '1px solid #4a4a54'
                          : '1px solid rgba(0,0,0,0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      paddingRight: 5,
                      fontSize: isC ? 9 : 8,
                      fontWeight: isC ? 800 : 700,
                      color: isActiveKey
                        ? '#0a0a0e'
                        : isBlack
                          ? '#9a9aa6'
                          : '#1a1a22',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      letterSpacing: 0.2,
                      transition: 'background 80ms linear, box-shadow 80ms linear',
                    }}
                  >
                    {keyLabel}
                  </div>
                </div>
                <div style={{ flex: 1, display: 'flex' }}>
                  {Array.from({ length: totalBars }).map((_, bi) => {
                    const isDragTarget = bi === dragTargetBar;
                    return (
                      <div
                        key={bi}
                        onDragEnter={(e) => {
                          e.preventDefault();
                          onBarDragOver(bi);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          e.dataTransfer.dropEffect = 'copy';
                          if (dragTargetBar !== bi) onBarDragOver(bi);
                        }}
                        onDragLeave={(e) => {
                          const rt = e.relatedTarget as Node | null;
                          if (!rt || !(e.currentTarget as Node).contains(rt)) onBarDragLeave();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const sym =
                            e.dataTransfer.getData(DND_CHORD_MIME) || e.dataTransfer.getData('text/plain');
                          onBarDragLeave();
                          if (sym) onBarDrop(bi, sym as ChordSymbol);
                        }}
                        style={{
                          boxSizing: 'border-box',
                          width: barW,
                          flexShrink: 0,
                          display: 'flex',
                          background: isDragTarget
                            ? 'rgba(124, 244, 198, 0.08)'
                            : 'transparent',
                          borderRight: '1px solid rgba(124, 244, 198, 0.08)',
                          cursor: 'cell',
                        }}
                      >
                        {Array.from({ length: colsPerBar }).map((_, ci) => {
                          const colIdx = bi * colsPerBar + ci;
                          // Cells that fall inside another note's stretched
                          // span are owned by that note's head — skip them so
                          // the head's wider div absorbs their flex slot.
                          if (rowSkipCols.has(colIdx)) return null;
                          const cellKey = `${ri},${colIdx}`;
                          const isAuto = autoNoteSet.has(cellKey);
                          const isAdded = manualAdded.has(cellKey);
                          const isRemoved = manualRemoved.has(cellKey);
                          // Final visibility: auto note unless removed, OR manually added.
                          const isLit = (isAuto && !isRemoved) || isAdded;
                          // Stretched-note head: width covers this column +
                          // its trailing siblings. Single-cell notes (and
                          // empty cells) keep the normal cell width.
                          const headLen = rowHeadLens.get(colIdx) ?? 1;
                          const cellRenderW = cellW * headLen;
                          // Color hint: manually-added cells render a brighter
                          // mint with a contrasting halo so the user can tell
                          // their tweaks apart from the chord-generated notes.
                          const bg = !isLit
                            ? 'transparent'
                            : isAdded
                              ? 'linear-gradient(180deg, #a8ffd9 0%, #5feab1 100%)'
                              : MINT;
                          const glow = !isLit
                            ? 'none'
                            : isAdded
                              ? '0 0 7px rgba(168, 255, 217, 0.85)'
                              : '0 0 6px rgba(124, 244, 198, 0.55)';
                          // Ghost outline on auto notes the user removed, so
                          // it's visible they were silenced and can be restored.
                          const ghost = isAuto && isRemoved;
                          const isDragTarget =
                            dragTargetCell !== null &&
                            dragTargetCell.row === ri &&
                            dragTargetCell.col === colIdx;
                          const isDragOrigin =
                            dragRef.current !== null &&
                            dragRef.current.fromRow === ri &&
                            dragRef.current.fromCol === colIdx &&
                            dragRef.current.moved;
                          // borderRight = 'none' on the visual last column of
                          // the bar (the head's rightmost column may sit past
                          // ci if the note is stretched).
                          const visualLastCi = ci + headLen - 1;
                          const isLastColOfBar = visualLastCi === colsPerBar - 1;
                          return (
                            <div
                              key={ci}
                              onMouseDown={(e) => {
                                if (e.button !== 0) return;
                                e.preventDefault();
                                e.stopPropagation();
                                if (onCellPointer) {
                                  if (!brushStrokeRef.current) {
                                    brushStrokeRef.current = true;
                                    onBrushStrokeStart?.();
                                  }
                                  onCellPointer(ri, colIdx, isAuto, isLit);
                                  return;
                                }
                                if (!isLit) return;
                                onAuditionCell?.(ri, colIdx);
                                dragRef.current = {
                                  fromRow: ri,
                                  fromCol: colIdx,
                                  wasAuto: isAuto && !isRemoved,
                                  startX: e.clientX,
                                  startY: e.clientY,
                                  moved: false,
                                };
                              }}
                              onMouseEnter={(e) => {
                                if (!onCellPointer || e.buttons !== 1) return;
                                onCellPointer(ri, colIdx, isAuto, isLit);
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onCellPointer) return;
                                // Suppress the click that fires at the end of
                                // a drag (move) or a resize — those gestures
                                // already updated the model.
                                if (justDraggedRef.current) {
                                  justDraggedRef.current = false;
                                  return;
                                }
                                onToggleNote(ri, colIdx, isAuto, isLit);
                              }}
                              onDoubleClick={(e) => e.stopPropagation()}
                              style={{
                                position: 'relative',
                                width: cellRenderW,
                                flexShrink: 0,
                                borderRight: isLastColOfBar
                                  ? 'none'
                                  : '1px solid rgba(255,255,255,0.02)',
                                background: isDragTarget && !isLit
                                  ? 'rgba(124, 244, 198, 0.18)'
                                  : bg,
                                boxShadow: isDragTarget
                                  ? '0 0 0 1px rgba(168, 255, 217, 0.95) inset, 0 0 8px rgba(168,255,217,0.55)'
                                  : glow,
                                opacity: isDragOrigin ? 0.35 : isLit ? 0.95 : 1,
                                cursor: isLit ? 'grab' : 'pointer',
                                outline: ghost ? '1px dashed rgba(124,244,198,0.30)' : 'none',
                                outlineOffset: ghost ? -2 : 0,
                                transition: 'background 60ms linear, box-shadow 60ms linear',
                              }}
                              title={
                                isLit
                                  ? isAdded
                                    ? `${noteName} · bar ${bi + 1} · drag = move · right edge = resize · click = remove (added)`
                                    : `${noteName} · bar ${bi + 1} · drag = move · right edge = resize · click = mute (chord note)`
                                  : ghost
                                    ? `${noteName} · bar ${bi + 1} · click to restore (was muted)`
                                    : `${noteName} · bar ${bi + 1} · click to add note`
                              }
                            >
                              {isLit ? (
                                <div
                                  onMouseDown={(e) => {
                                    if (e.button !== 0) return;
                                    e.preventDefault();
                                    e.stopPropagation();
                                    resizeRef.current = {
                                      row: ri,
                                      headCol: colIdx,
                                      startX: e.clientX,
                                      startLen: headLen,
                                    };
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  title={`drag to resize · current ${headLen} step${headLen === 1 ? '' : 's'}`}
                                  style={{
                                    position: 'absolute',
                                    top: 0,
                                    right: 0,
                                    bottom: 0,
                                    width: 6,
                                    cursor: 'ew-resize',
                                    // Subtle highlight strip so the handle is
                                    // discoverable without being noisy.
                                    background:
                                      'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.18) 100%)',
                                    zIndex: 2,
                                  }}
                                />
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

