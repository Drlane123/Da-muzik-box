/**
 * Beat Lab 32-channel piano roll — shares pattern columns + playhead with the drum grid.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BeatLabEditToolToggle } from './BeatLabGridControls';
import {
  BeatLabBarAutomationLanes,
  type BeatLabPitchAutomationSelection,
} from './BeatLabBarAutomationLanes';
import {
  beatLabMeasureRulerLabel,
  creationBeatLabColumnBorder,
} from '../../lib/creationStation/creationDrumGridAdaptive';
import { BEAT_LAB_AUTOMATION_LANE_H } from '../../lib/creationStation/beatLabAutomation';
import { BeatLabSnapGridOverlay } from './BeatLabSnapGridOverlay';
import {
  BEAT_LAB_MELODIC_LANE_START,
  BEAT_LAB_MIDI_LANES,
  BEAT_LAB_PAD_LANES,
  BEAT_LAB_ROLL_LABEL_W,
  BEAT_LAB_ROLL_RULER_H,
  BEAT_LAB_ROLL_ROW_H,
  beatLabMidiNoteKey,
  beatLabSliceColForPointer,
  type BeatLabDeckFocus,
  type BeatLabEditTool,
  type BeatLabMidiNote,
} from '../../lib/creationStation/beatLabMidiRoll';

export type BeatLabPianoRollProps = {
  notes: BeatLabMidiNote[];
  patternCols: number;
  colWidth: number;
  activeCol: number;
  transportNotStopped: boolean;
  playheadElRef: React.RefObject<HTMLDivElement | null>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  onSeekCol: (col: number) => void;
  onToggleNote: (lane: number, col: number) => void;
  onSetNote?: (lane: number, col: number, on: boolean) => void;
  editTool?: BeatLabEditTool;
  onModeChange?: (mode: BeatLabEditTool) => void;
  onSetNoteMuted?: (lane: number, col: number, muted: boolean) => void;
  onSetNoteVelocity?: (lane: number, col: number, vel: number) => void;
  onSliceNote?: (lane: number, headCol: number, splitCol: number, pitchSlice?: boolean) => void;
  volAutomation?: number[];
  pitchAutomation?: number[];
  onVolAutomationPaint?: (next: number[]) => void;
  onPitchAutomationPaint?: (next: number[]) => void;
  onAutomationGestureStart?: () => void;
  onAutomationGestureEnd?: () => void;
  pitchSelectionRef?: React.MutableRefObject<BeatLabPitchAutomationSelection | null>;
  onEditGestureStart?: () => void;
  onEditGestureEnd?: () => void;
  onMoveNote: (fromLane: number, fromCol: number, toLane: number, toCol: number) => void;
  onResizeNote: (lane: number, col: number, len: number) => void;
  /** FL: drag left edge — move start, keep end fixed. */
  onResizeNoteFromStart?: (lane: number, headCol: number, newHeadCol: number) => void;
  onDeleteNote?: (lane: number, col: number) => void;
  onDuplicateNote?: (
    fromLane: number,
    fromCol: number,
    toLane: number,
    toCol: number,
  ) => void;
  selectedNote?: { lane: number; col: number } | null;
  onSelectNote?: (sel: { lane: number; col: number } | null) => void;
  onClearNotes: () => void;
  laneLabelForPad?: (padIndex: number) => string;
  laneColorForPad?: (padIndex: number) => string;
  /** Audition pad sample from the lane label (ROLL pad rows). */
  onPadLanePreview?: (padIndex: number) => void;
  /** Active channel 1–32 (lane index 0–31) — highlights lane row; pads 1–16 also light sampler. */
  selectedLane?: number | null;
  onLaneSelect?: (lane: number) => void;
  deckFocus: BeatLabDeckFocus;
  onDeckFocusChange: (focus: BeatLabDeckFocus) => void;
  /** ROLL view — show melodic channels 17–32 only (hide pad-linked lanes 1–16). */
  melodicLanesOnly?: boolean;
  /** SNAP quant lines — same as step grid (`qpb` × `subdiv` columns per bar). */
  gridSnap?: { qpb: number; subdiv: number; bankColOffset: number };
  editToolSnapHint?: string;
  disabled?: boolean;
  /** Parent supplies VIEW bar + edit tools (Beat Lab ROLL) — hide duplicate header row. */
  hideHeaderToolbar?: boolean;
};

function noteHeadAtCell(notes: BeatLabMidiNote[], lane: number, col: number): BeatLabMidiNote | undefined {
  return notes.find((n) => n.lane === lane && col >= n.col && col < n.col + n.len);
}

function rollToolCursor(tool: BeatLabEditTool): string {
  if (tool === 'draw' || tool === 'erase') return 'crosshair';
  if (tool === 'mute') return 'not-allowed';
  if (tool === 'velocity' || tool === 'pitch') return 'ns-resize';
  if (tool === 'automation') return 'crosshair';
  if (tool === 'slice') return 'cell';
  return 'default';
}

function FocusButton({
  active,
  label,
  glyph,
  title,
  onClick,
}: {
  active: boolean;
  label: string;
  glyph: string;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 9,
        fontWeight: 800,
        color: active ? '#7cf4c6' : '#8a8a98',
        background: active ? 'rgba(124, 244, 198, 0.14)' : 'rgba(255, 255, 255, 0.04)',
        border: `1px solid ${active ? 'rgba(124, 244, 198, 0.45)' : 'rgba(255, 255, 255, 0.08)'}`,
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

function noteAtHead(notes: BeatLabMidiNote[], lane: number, col: number): BeatLabMidiNote | undefined {
  return notes.find((n) => n.lane === lane && n.col === col);
}

function noteCoversCell(notes: BeatLabMidiNote[], lane: number, col: number): boolean {
  return notes.some((n) => n.lane === lane && col >= n.col && col < n.col + n.len);
}

/** FL-style edge hit zone (resize cursor on left/right of note). */
function noteEdgeHandleW(colWidth: number): number {
  const cw = Math.max(8, colWidth);
  return Math.max(14, Math.min(Math.floor(cw * 0.55), Math.max(cw - 2, 14)));
}

export function BeatLabPianoRoll({
  notes,
  patternCols,
  colWidth,
  activeCol,
  transportNotStopped,
  playheadElRef,
  scrollRef,
  onScroll,
  onSeekCol,
  onToggleNote,
  onSetNote,
  editTool = 'pointer',
  onModeChange,
  onSetNoteMuted,
  onSetNoteVelocity,
  onSliceNote,
  volAutomation,
  pitchAutomation,
  onVolAutomationPaint,
  onPitchAutomationPaint,
  onAutomationGestureStart,
  onAutomationGestureEnd,
  pitchSelectionRef,
  onEditGestureStart,
  onEditGestureEnd,
  onMoveNote,
  onResizeNote,
  onResizeNoteFromStart,
  onDeleteNote,
  onDuplicateNote,
  selectedNote,
  onSelectNote,
  onClearNotes,
  laneLabelForPad,
  laneColorForPad,
  onPadLanePreview,
  selectedLane = null,
  onLaneSelect,
  deckFocus,
  onDeckFocusChange,
  melodicLanesOnly = false,
  gridSnap,
  editToolSnapHint,
  disabled = false,
  hideHeaderToolbar = false,
}: BeatLabPianoRollProps) {
  const cw = Math.max(8, colWidth);
  const snapQpb = gridSnap?.qpb ?? 4;
  const snapSub = gridSnap?.subdiv ?? 4;
  const snapOff = gridSnap?.bankColOffset ?? 0;
  const columnBorder = useCallback(
    (patternCol: number, blendTo = 'transparent') =>
      creationBeatLabColumnBorder({
        colWidthPx: cw,
        patternCol,
        bankColOffset: snapOff,
        qpb: snapQpb,
        subdiv: snapSub,
        blendTo,
      }),
    [cw, snapOff, snapQpb, snapSub],
  );
  const gridW = Math.max(cw, patternCols * cw);
  const laneStart = melodicLanesOnly ? BEAT_LAB_MELODIC_LANE_START : 0;
  const laneCount = melodicLanesOnly ? BEAT_LAB_MIDI_LANES - BEAT_LAB_MELODIC_LANE_START : BEAT_LAB_MIDI_LANES;

  const cellAt = useCallback(
    (clientX: number, clientY: number): { lane: number; col: number } | null => {
      const el = scrollRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const localX = clientX - rect.left + el.scrollLeft - BEAT_LAB_ROLL_LABEL_W;
      const localY = clientY - rect.top + el.scrollTop - BEAT_LAB_ROLL_RULER_H;
      if (localX < 0 || localY < 0) return null;
      const col = Math.floor(localX / cw);
      const row = Math.floor(localY / BEAT_LAB_ROLL_ROW_H);
      const lane = laneStart + row;
      if (col < 0 || col >= patternCols) return null;
      if (row < 0 || row >= laneCount) return null;
      return { lane, col };
    },
    [scrollRef, cw, patternCols, laneStart, laneCount],
  );

  const dragRef = useRef<{
    fromLane: number;
    fromCol: number;
    startX: number;
    startY: number;
    moved: boolean;
    duplicate: boolean;
    len: number;
    vel: number;
    muted: boolean;
  } | null>(null);
  const resizeRef = useRef<{
    lane: number;
    headCol: number;
    endCol: number;
    edge: 'start' | 'end';
    previewHeadCol: number;
    previewLen: number;
  } | null>(null);
  const sliceDragRef = useRef<{ active: boolean; lastCol: number; pitchSlice: boolean } | null>(null);
  const cwRef = useRef(cw);
  cwRef.current = cw;
  const cellAtRef = useRef(cellAt);
  cellAtRef.current = cellAt;
  const onResizeNoteRef = useRef(onResizeNote);
  const onResizeNoteFromStartRef = useRef(onResizeNoteFromStart);
  const onSliceNoteRef = useRef(onSliceNote);
  const notesRef = useRef(notes);
  notesRef.current = notes;
  onResizeNoteRef.current = onResizeNote;
  onResizeNoteFromStartRef.current = onResizeNoteFromStart;
  onSliceNoteRef.current = onSliceNote;
  const paintRef = useRef<{
    active: boolean;
    on: boolean;
    lastKey: string;
    lastX: number;
    lastY: number;
  } | null>(null);
  const justDraggedRef = useRef(false);
  const velocityRef = useRef<{ lane: number; col: number; startY: number; startVel: number } | null>(null);
  const mutePaintRef = useRef<{ active: boolean; lastKey: string } | null>(null);
  const [dragTarget, setDragTarget] = useState<{ lane: number; col: number } | null>(null);
  const [dragGhost, setDragGhost] = useState<{
    lane: number;
    col: number;
    len: number;
    vel: number;
    muted: boolean;
  } | null>(null);
  const [resizePreview, setResizePreview] = useState<{
    lane: number;
    headCol: number;
    len: number;
  } | null>(null);
  const edgeHandleW = noteEdgeHandleW(cw);
  const brushMode = (editTool === 'draw' || editTool === 'erase') && !!onSetNote;
  const eraseMode = editTool === 'erase' && !!onSetNote;
  const pointerMode = editTool === 'pointer';
  const muteMode = editTool === 'mute' && !!onSetNoteMuted;
  const velocityMode = editTool === 'velocity' && !!onSetNoteVelocity;
  const pitchMode = editTool === 'pitch' && !!onPitchAutomationPaint;
  const automationMode = editTool === 'automation' && !!onVolAutomationPaint;
  const sliceMode = editTool === 'slice' && !!onSliceNote;
  const showVolLane = !!gridSnap && automationMode && !!volAutomation;
  const showPitchLane = !!gridSnap && pitchMode && !!pitchAutomation;
  const showAutomationLanes = showVolLane || showPitchLane;
  const automationBlockH =
    (showVolLane ? BEAT_LAB_AUTOMATION_LANE_H : 0) +
    (showPitchLane ? BEAT_LAB_AUTOMATION_LANE_H : 0);
  const cellCursor = rollToolCursor(editTool);

  const paintCellAt = useCallback(
    (clientX: number, clientY: number, on: boolean) => {
      if (!onSetNote) return;
      const cell = cellAt(clientX, clientY);
      if (!cell) return;
      const key = beatLabMidiNoteKey(cell.lane, cell.col);
      if (paintRef.current?.active && paintRef.current.lastKey === key) return;
      if (paintRef.current?.active) paintRef.current.lastKey = key;
      onSetNote(cell.lane, cell.col, on);
    },
    [cellAt, onSetNote],
  );

  const paintSegment = useCallback(
    (x0: number, y0: number, x1: number, y1: number, on: boolean) => {
      if (!onSetNote) return;
      const dx = x1 - x0;
      const dy = y1 - y0;
      const dist = Math.hypot(dx, dy);
      const steps = Math.min(256, Math.max(1, Math.ceil(dist / 4)));
      const seen = new Set<string>();
      for (let s = 0; s <= steps; s++) {
        const t = steps === 0 ? 0 : s / steps;
        const cell = cellAt(x0 + dx * t, y0 + dy * t);
        if (!cell) continue;
        const key = beatLabMidiNoteKey(cell.lane, cell.col);
        if (seen.has(key)) continue;
        seen.add(key);
        onSetNote(cell.lane, cell.col, on);
      }
    },
    [cellAt, onSetNote],
  );

  const beginPaint = useCallback(
    (clientX: number, clientY: number, shiftKey: boolean) => {
      if (!brushMode) return;
      onEditGestureStart?.();
      const on = editTool === 'draw' ? !shiftKey : false;
      paintRef.current = {
        active: true,
        on,
        lastKey: '',
        lastX: clientX,
        lastY: clientY,
      };
      paintCellAt(clientX, clientY, on);
    },
    [brushMode, editTool, onEditGestureStart, paintCellAt],
  );

  const paintMuteAt = useCallback(
    (clientX: number, clientY: number) => {
      if (!onSetNoteMuted) return;
      const cell = cellAt(clientX, clientY);
      if (!cell) return;
      const note = noteHeadAtCell(notes, cell.lane, cell.col);
      if (!note) return;
      const key = beatLabMidiNoteKey(note.lane, note.col);
      if (mutePaintRef.current?.active && mutePaintRef.current.lastKey === key) return;
      if (mutePaintRef.current?.active) mutePaintRef.current.lastKey = key;
      onSetNoteMuted(note.lane, note.col, true);
    },
    [cellAt, notes, onSetNoteMuted],
  );

  const beginMutePaint = useCallback(
    (clientX: number, clientY: number) => {
      if (!muteMode) return;
      onEditGestureStart?.();
      mutePaintRef.current = { active: true, lastKey: '' };
      paintMuteAt(clientX, clientY);
    },
    [muteMode, onEditGestureStart, paintMuteAt],
  );

  useEffect(() => {
    function commitResize() {
      const r = resizeRef.current;
      if (!r) return;
      if (r.edge === 'start') {
        if (r.previewHeadCol !== r.headCol) {
          onResizeNoteFromStartRef.current?.(r.lane, r.headCol, r.previewHeadCol);
        }
      } else if (r.previewLen >= 1) {
        onResizeNoteRef.current(r.lane, r.headCol, r.previewLen);
      }
      justDraggedRef.current = true;
      resizeRef.current = null;
      setResizePreview(null);
      onEditGestureEnd?.();
    }
    function onPointerMove(e: PointerEvent) {
      const r = resizeRef.current;
      if (!r) return;
      e.preventDefault();
      const cell = cellAtRef.current(e.clientX, e.clientY);
      if (!cell || cell.lane !== r.lane) return;
      if (r.edge === 'start') {
        const newHead = Math.max(0, Math.min(r.endCol - 1, cell.col));
        r.previewHeadCol = newHead;
        r.previewLen = r.endCol - newHead;
        setResizePreview({ lane: r.lane, headCol: newHead, len: r.previewLen });
      } else {
        const newLen = Math.max(1, Math.min(patternCols - r.headCol, cell.col - r.headCol + 1));
        r.previewLen = newLen;
        setResizePreview({ lane: r.lane, headCol: r.headCol, len: newLen });
      }
    }
    function onPointerUp() {
      if (resizeRef.current) commitResize();
      else if (sliceDragRef.current?.active) onEditGestureEnd?.();
      sliceDragRef.current = null;
    }
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [onEditGestureEnd, patternCols]);

  useEffect(() => {
    const onUp = () => {
      if (paintRef.current?.active || mutePaintRef.current?.active || velocityRef.current) {
        onEditGestureEnd?.();
      }
      paintRef.current = null;
      mutePaintRef.current = null;
      velocityRef.current = null;
    };
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, [onEditGestureEnd]);

  useEffect(() => {
    if (!brushMode) return;
    function onMove(e: MouseEvent) {
      const paint = paintRef.current;
      if (!paint?.active) return;
      paintSegment(paint.lastX, paint.lastY, e.clientX, e.clientY, paint.on);
      paint.lastX = e.clientX;
      paint.lastY = e.clientY;
    }
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [brushMode, paintSegment]);

  useEffect(() => {
    if (!sliceMode) return;
    function onMove(e: MouseEvent) {
      if (!sliceDragRef.current?.active) return;
      const cell = cellAtRef.current(e.clientX, e.clientY);
      if (!cell) return;
      if (cell.col === sliceDragRef.current.lastCol) return;
      sliceDragRef.current.lastCol = cell.col;
      const roll = notesRef.current;
      for (const n of roll) {
        if (cell.col <= n.col || cell.col >= n.col + n.len) continue;
        const split = beatLabSliceColForPointer(n.col, n.len, cell.col);
        if (split != null) {
          onSliceNoteRef.current?.(n.lane, n.col, split, sliceDragRef.current.pitchSlice);
        }
      }
    }
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [sliceMode]);

  useEffect(() => {
    if (!muteMode) return;
    function onMove(e: MouseEvent) {
      if (!mutePaintRef.current?.active) return;
      paintMuteAt(e.clientX, e.clientY);
    }
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [muteMode, paintMuteAt]);

  useEffect(() => {
    if (!velocityMode) return;
    function onMove(e: MouseEvent) {
      const v = velocityRef.current;
      if (!v || !onSetNoteVelocity) return;
      const delta = Math.round((v.startY - e.clientY) / 3);
      onSetNoteVelocity(v.lane, v.col, v.startVel + delta);
    }
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [velocityMode, onSetNoteVelocity]);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const drag = dragRef.current;
      if (!drag || !pointerMode) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (!drag.moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
      drag.moved = true;
      let cell = cellAt(e.clientX, e.clientY);
      if (cell) {
        if (e.shiftKey) cell = { lane: drag.fromLane, col: cell.col };
        if (e.ctrlKey) cell = { lane: cell.lane, col: drag.fromCol };
      }
      setDragTarget(cell);
      if (cell) {
        setDragGhost({
          lane: cell.lane,
          col: cell.col,
          len: drag.len,
          vel: drag.vel,
          muted: drag.muted,
        });
      }
    }
    function onUp(e: MouseEvent) {
      const drag = dragRef.current;
      if (!drag || !pointerMode) return;
      if (drag.moved) {
        const cell = cellAt(e.clientX, e.clientY);
        if (cell && (cell.lane !== drag.fromLane || cell.col !== drag.fromCol)) {
          if (drag.duplicate && onDuplicateNote) {
            onDuplicateNote(drag.fromLane, drag.fromCol, cell.lane, cell.col);
          } else {
            onMoveNote(drag.fromLane, drag.fromCol, cell.lane, cell.col);
          }
        }
        justDraggedRef.current = true;
      }
      onEditGestureEnd?.();
      dragRef.current = null;
      setDragTarget(null);
      setDragGhost(null);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [cellAt, onDuplicateNote, onEditGestureEnd, onMoveNote, pointerMode]);

  const rollBodyH = BEAT_LAB_MIDI_LANES * BEAT_LAB_ROLL_ROW_H;

  const beginNoteResize = useCallback(
    (
      e: React.PointerEvent,
      lane: number,
      headCol: number,
      note: BeatLabMidiNote,
      edge: 'start' | 'end',
    ) => {
      if (disabled || !pointerMode) return;
      if (edge === 'start' && !onResizeNoteFromStart) return;
      e.preventDefault();
      e.stopPropagation();
      onEditGestureStart?.();
      dragRef.current = null;
      onSelectNote?.({ lane, col: headCol });
      const endCol = headCol + note.len;
      resizeRef.current = {
        lane,
        headCol,
        endCol,
        edge,
        previewHeadCol: headCol,
        previewLen: note.len,
      };
      setResizePreview({ lane, headCol, len: note.len });
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    [disabled, onEditGestureStart, onResizeNoteFromStart, onSelectNote, pointerMode],
  );

  const sliceNoteAtPointer = useCallback(
    (clientX: number, clientY: number, pitchSlice = false) => {
      if (!onSliceNote) return;
      const cell = cellAt(clientX, clientY);
      if (!cell) return;
      const head = noteHeadAtCell(notes, cell.lane, cell.col);
      if (!head) return;
      const split = beatLabSliceColForPointer(head.col, head.len, cell.col);
      if (split == null) return;
      onSliceNote(head.lane, head.col, split, pitchSlice);
      onSelectNote?.({ lane: head.lane, col: head.col });
    },
    [cellAt, notes, onSelectNote, onSliceNote],
  );

  const beginSliceDrag = useCallback(
    (clientX: number, clientY: number, pitchSlice = false) => {
      if (!sliceMode) return;
      onEditGestureStart?.();
      const cell = cellAt(clientX, clientY);
      sliceDragRef.current = { active: true, lastCol: cell?.col ?? -1, pitchSlice };
      sliceNoteAtPointer(clientX, clientY, pitchSlice);
    },
    [cellAt, onEditGestureStart, sliceMode, sliceNoteAtPointer],
  );

  const deleteNoteAtPointer = useCallback(
    (clientX: number, clientY: number) => {
      if (!onDeleteNote) return;
      const cell = cellAt(clientX, clientY);
      if (!cell) return;
      const head = noteHeadAtCell(notes, cell.lane, cell.col);
      if (head) onDeleteNote(head.lane, head.col);
    },
    [cellAt, notes, onDeleteNote],
  );

  const handleNoteMouseDown = useCallback(
    (
      e: React.MouseEvent,
      lane: number,
      headCol: number,
      note: BeatLabMidiNote,
    ) => {
      if (disabled) return;
      e.preventDefault();
      if (e.button === 2) {
        deleteNoteAtPointer(e.clientX, e.clientY);
        return;
      }
      if (eraseMode) {
        onDeleteNote?.(lane, headCol);
        return;
      }
      if (brushMode) {
        beginPaint(e.clientX, e.clientY, e.shiftKey);
        return;
      }
      if (muteMode) {
        onSetNoteMuted?.(lane, headCol, !note.muted);
        beginMutePaint(e.clientX, e.clientY);
        return;
      }
      if (velocityMode) {
        onEditGestureStart?.();
        velocityRef.current = {
          lane,
          col: headCol,
          startY: e.clientY,
          startVel: note.vel ?? 100,
        };
        return;
      }
      if (sliceMode) {
        sliceNoteAtPointer(e.clientX, e.clientY, e.shiftKey);
        beginSliceDrag(e.clientX, e.clientY);
        return;
      }
      if (!pointerMode) return;
      const target = e.target as HTMLElement;
      if (target.closest('[data-beat-lab-resize]')) return;
      onEditGestureStart?.();
      onSelectNote?.({ lane, col: headCol });
      dragRef.current = {
        fromLane: lane,
        fromCol: headCol,
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
        duplicate: e.altKey && !!onDuplicateNote,
        len: note.len,
        vel: note.vel ?? 100,
        muted: note.muted === true,
      };
      setDragGhost({
        lane,
        col: headCol,
        len: note.len,
        vel: note.vel ?? 100,
        muted: note.muted === true,
      });
    },
    [
      beginMutePaint,
      beginNoteResize,
      beginPaint,
      beginSliceDrag,
      brushMode,
      deleteNoteAtPointer,
      disabled,
      eraseMode,
      muteMode,
      onDeleteNote,
      onDuplicateNote,
      onResizeNoteFromStart,
      onSelectNote,
      onSetNoteMuted,
      pointerMode,
      sliceMode,
      sliceNoteAtPointer,
      onEditGestureStart,
      velocityMode,
    ],
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        borderTop: '1px solid rgba(124, 244, 198, 0.2)',
        background: '#060608',
      }}
    >
      {!hideHeaderToolbar ? (
        <div
          style={{
            flexShrink: 0,
            padding: '5px 10px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
        <span style={{ fontSize: 9, fontWeight: 900, color: '#7cf4c6', letterSpacing: 1.2 }}>
          {melodicLanesOnly ? '16-CH PIANO ROLL' : '32-CH PIANO ROLL'}
        </span>
        <span style={{ fontSize: 8, color: '#5c5c68', fontWeight: 600, flex: 1, minWidth: 120 }}>
          {melodicLanesOnly
            ? 'CH 17–32 · melodic MIDI · draw · drag · resize · ruler = playhead'
            : 'CH 1–16 = pads · draw · drag · resize edge · ruler = playhead'}
        </span>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <FocusButton
            active={deckFocus === 'roll'}
            label="ROLL"
            glyph="▁"
            title="32-channel piano roll — edit all lanes"
            onClick={() => onDeckFocusChange('roll')}
          />
          <FocusButton
            active={deckFocus === 'sequence'}
            label="GRID"
            glyph="▣"
            title="Maximize step sequencer grid in the center of the screen"
            onClick={() => onDeckFocusChange('sequence')}
          />
        </div>
        {onModeChange ? (
          <BeatLabEditToolToggle mode={editTool} onModeChange={onModeChange} snapHint={editToolSnapHint} />
        ) : null}
        <button
          type="button"
          disabled={disabled}
          onClick={onClearNotes}
          title="Clear all notes in this bank's piano roll"
          style={{
            fontSize: 9,
            fontWeight: 800,
            color: '#7cf4c6',
            background: 'rgba(124, 244, 198, 0.10)',
            border: '1px solid rgba(124, 244, 198, 0.30)',
            borderRadius: 4,
            padding: '3px 8px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.45 : 1,
          }}
        >
          CLEAR
        </button>
      </div>
      ) : null}

      <div
        ref={scrollRef}
        onScroll={onScroll}
        onContextMenu={(e) => {
          if (disabled) return;
          e.preventDefault();
          deleteNoteAtPointer(e.clientX, e.clientY);
        }}
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          background: '#050505',
        }}
      >
        <div
          style={{
            position: 'relative',
            minWidth: BEAT_LAB_ROLL_LABEL_W + gridW,
            width: BEAT_LAB_ROLL_LABEL_W + gridW,
          }}
        >
          <div
            ref={playheadElRef}
            aria-hidden
            style={{
              position: 'absolute',
              left: BEAT_LAB_ROLL_LABEL_W,
              top: 0,
              width: 1,
              height: BEAT_LAB_ROLL_RULER_H + rollBodyH,
              background: 'transparent',
              pointerEvents: 'none',
              zIndex: 30,
              opacity: transportNotStopped ? 1 : 0.42,
            }}
          >
            <span
              style={{
                position: 'absolute',
                left: -4,
                top: 0,
                width: 8,
                height: 12,
                clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
                background: '#7cf4c6',
              }}
            />
            <span
              style={{
                position: 'absolute',
                left: 0,
                top: 12,
                width: 1,
                height: BEAT_LAB_ROLL_RULER_H + rollBodyH - 12,
                background: 'rgba(124, 244, 198, 0.45)',
              }}
            />
          </div>

          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 20,
              height: BEAT_LAB_ROLL_RULER_H,
              display: 'flex',
              background: '#080808',
              borderBottom: '1px solid #1e1e1e',
            }}
          >
            <div
              style={{
                width: BEAT_LAB_ROLL_LABEL_W,
                flexShrink: 0,
                borderRight: '1px solid #1e1e1e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 8,
                fontWeight: 800,
                color: '#6a6a78',
                letterSpacing: 0.6,
              }}
            >
              CHANNEL
            </div>
            <div style={{ display: 'flex' }}>
              {Array.from({ length: patternCols }, (_, ci) => {
                const lit = ci === activeCol && transportNotStopped;
                return (
                  <button
                    key={ci}
                    type="button"
                    disabled={disabled}
                    onClick={() => onSeekCol(ci)}
                    style={{
                      width: cw,
                      minWidth: cw,
                      height: BEAT_LAB_ROLL_RULER_H,
                      padding: 0,
                      border: 'none',
                      borderLeft: `1px solid ${columnBorder(ci, '#080808')}`,
                      borderRight: 'none',
                      background: lit
                        ? 'rgba(124, 244, 198, 0.18)'
                        : (ci + snapOff) % Math.max(1, snapQpb * snapSub) === 0
                          ? '#101018'
                          : '#080808',
                      color: lit ? '#7cf4c6' : '#4a4a58',
                      fontSize: 7,
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      cursor: disabled ? 'default' : 'pointer',
                      boxSizing: 'border-box',
                    }}
                    title="Seek playhead"
                  >
                    {gridSnap
                      ? beatLabMeasureRulerLabel(ci, snapOff, snapSub, snapQpb)
                      : (ci + snapOff) % Math.max(1, snapQpb * snapSub) === 0
                        ? Math.floor((ci + snapOff) / Math.max(1, snapQpb * snapSub)) + 1
                        : ''}
                  </button>
                );
              })}
            </div>
          </div>

          {showAutomationLanes ? (
            <div
              style={{
                position: 'sticky',
                top: BEAT_LAB_ROLL_RULER_H,
                zIndex: 19,
              }}
            >
              <BeatLabBarAutomationLanes
                patternCols={patternCols}
                colWidth={cw}
                labelWidth={BEAT_LAB_ROLL_LABEL_W}
                colsPerBar={Math.max(1, snapQpb * snapSub)}
                snapGrid={{ qpb: snapQpb, subdiv: snapSub, bankColOffset: snapOff }}
                showVol={showVolLane}
                showPitch={showPitchLane}
                volValues={volAutomation}
                pitchValues={pitchAutomation}
                activeCol={activeCol >= 0 ? activeCol : -1}
                volActive={automationMode}
                pitchActive={pitchMode}
                disabled={disabled}
                onVolPaint={onVolAutomationPaint}
                onPitchPaint={onPitchAutomationPaint}
                onGestureStart={onAutomationGestureStart}
                onGestureEnd={onAutomationGestureEnd}
                onSeekCol={onSeekCol}
                pitchSelectionRef={pitchSelectionRef}
              />
            </div>
          ) : null}

          {gridSnap ? (
            <BeatLabSnapGridOverlay
              colWidthPx={cw}
              qpb={snapQpb}
              subdiv={snapSub}
              bankColOffset={snapOff}
              style={{
                left: BEAT_LAB_ROLL_LABEL_W,
                top: BEAT_LAB_ROLL_RULER_H,
                width: gridW,
                height: automationBlockH + rollBodyH,
                zIndex: 1,
              }}
            />
          ) : null}

          {Array.from({ length: laneCount }, (_, row) => {
            const lane = laneStart + row;
            const isPad = lane < BEAT_LAB_PAD_LANES;
            const laneSelected = selectedLane === lane;
            const tint = isPad ? (laneColorForPad?.(lane) ?? '#5a6a88') : '#6b7a9a';
            const label = isPad
              ? `${lane + 1}. ${(laneLabelForPad?.(lane) ?? `Pad ${lane + 1}`).slice(0, 14)}`
              : `CH ${lane + 1}`;
            return (
              <div
                key={lane}
                style={{
                  display: 'flex',
                  height: BEAT_LAB_ROLL_ROW_H,
                  borderBottom: '1px solid #101014',
                  background: laneSelected
                    ? 'rgba(124, 244, 198, 0.06)'
                    : undefined,
                }}
              >
                {onLaneSelect || (isPad && onPadLanePreview) ? (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      onLaneSelect?.(lane);
                      if (isPad) onPadLanePreview?.(lane);
                    }}
                    style={{
                      width: BEAT_LAB_ROLL_LABEL_W,
                      flexShrink: 0,
                      padding: '0 6px',
                      display: 'flex',
                      alignItems: 'center',
                      border: 'none',
                      borderRight: laneSelected
                        ? '2px solid rgba(124, 244, 198, 0.75)'
                        : `2px solid color-mix(in srgb, ${tint} 55%, #1a1a24)`,
                      background: laneSelected
                        ? `color-mix(in srgb, ${tint} 42%, #0f2218)`
                        : `color-mix(in srgb, ${tint} 12%, #0a0a0e)`,
                      fontSize: 8,
                      fontWeight: 800,
                      color: laneSelected ? '#7cf4c6' : isPad ? '#e8e8f0' : '#b8c0d0',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      textAlign: 'left',
                      boxShadow: laneSelected
                        ? 'inset 0 0 12px rgba(124, 244, 198, 0.2)'
                        : undefined,
                    }}
                    title={
                      isPad
                        ? `${label} — click to select / preview`
                        : `${label} — click to select channel`
                    }
                  >
                    {label}
                  </button>
                ) : (
                  <div
                    style={{
                      width: BEAT_LAB_ROLL_LABEL_W,
                      flexShrink: 0,
                      padding: '0 6px',
                      display: 'flex',
                      alignItems: 'center',
                      borderRight: laneSelected
                        ? '2px solid rgba(124, 244, 198, 0.75)'
                        : `2px solid color-mix(in srgb, ${tint} 55%, #1a1a24)`,
                      background: laneSelected
                        ? `color-mix(in srgb, ${tint} 42%, #0f2218)`
                        : `color-mix(in srgb, ${tint} 12%, #0a0a0e)`,
                      fontSize: 8,
                      fontWeight: 800,
                      color: laneSelected ? '#7cf4c6' : isPad ? '#e8e8f0' : '#9ca3af',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={label}
                  >
                    {label}
                  </div>
                )}
                <div style={{ position: 'relative', width: gridW, height: BEAT_LAB_ROLL_ROW_H, zIndex: 1 }}>
                  {dragGhost && dragGhost.lane === lane ? (
                    <div
                      aria-hidden
                      style={{
                        position: 'absolute',
                        left: dragGhost.col * cw + 1,
                        top: 3,
                        width: Math.max(cw - 2, dragGhost.len * cw - 2),
                        height: BEAT_LAB_ROLL_ROW_H - 6,
                        borderRadius: 3,
                        border: '2px dashed rgba(124, 244, 198, 0.85)',
                        background: 'rgba(124, 244, 198, 0.15)',
                        pointerEvents: 'none',
                        zIndex: 8,
                      }}
                    />
                  ) : null}
                  {Array.from({ length: patternCols }, (_, col) => {
                    if (noteCoversCell(notes, lane, col) && !noteAtHead(notes, lane, col)) {
                      return null;
                    }
                    const isDragTarget = dragTarget?.lane === lane && dragTarget?.col === col;
                    if (noteAtHead(notes, lane, col)) return null;
                    return (
                        <button
                          key={col}
                          type="button"
                          disabled={disabled}
                          onMouseDown={(e) => {
                            if (disabled) return;
                            e.preventDefault();
                            if (e.button === 2) {
                              deleteNoteAtPointer(e.clientX, e.clientY);
                              return;
                            }
                            if (sliceMode) {
                              beginSliceDrag(e.clientX, e.clientY);
                              return;
                            }
                            if (brushMode) {
                              beginPaint(e.clientX, e.clientY, e.shiftKey);
                              return;
                            }
                            if (eraseMode) {
                              deleteNoteAtPointer(e.clientX, e.clientY);
                              return;
                            }
                            if (muteMode) beginMutePaint(e.clientX, e.clientY);
                          }}
                          onMouseEnter={(e) => {
                            if (disabled || !brushMode) return;
                            if (!paintRef.current?.active) return;
                            paintCellAt(e.clientX, e.clientY, paintRef.current.on);
                          }}
                          onClick={() => {
                            if (justDraggedRef.current) {
                              justDraggedRef.current = false;
                              return;
                            }
                            if (brushMode || muteMode || velocityMode || sliceMode) return;
                            if (pointerMode) {
                              onSetNote?.(lane, col, true);
                              onSelectNote?.({ lane, col });
                              return;
                            }
                            onToggleNote(lane, col);
                          }}
                          style={{
                            position: 'absolute',
                            left: col * cw,
                            top: 0,
                            width: cw,
                            height: BEAT_LAB_ROLL_ROW_H,
                            padding: 0,
                            border: 'none',
                            borderLeft: `1px solid ${columnBorder(col)}`,
                            borderRight: 'none',
                            background: isDragTarget ? 'rgba(124, 244, 198, 0.12)' : 'transparent',
                            cursor: disabled ? 'default' : cellCursor,
                            boxSizing: 'border-box',
                            zIndex: 1,
                          }}
                        />
                    );
                  })}
                  {notes
                    .filter((n) => n.lane === lane)
                    .map((note) => {
                      const col = note.col;
                      const preview =
                        resizePreview?.lane === lane && resizePreview.headCol === col
                          ? resizePreview
                          : null;
                      const drawLen = preview?.len ?? note.len;
                    const noteW = drawLen * cw - 2;
                    const muted = note.muted === true;
                    const isSelected =
                      selectedNote?.lane === lane && selectedNote?.col === col;
                      return (
                      <div
                        key={`note-${lane}-${col}`}
                        style={{
                          position: 'absolute',
                          left: col * cw + 1,
                          top: 3,
                          width: Math.max(cw - 2, noteW),
                          height: BEAT_LAB_ROLL_ROW_H - 6,
                          borderRadius: 3,
                          background: muted
                            ? `color-mix(in srgb, ${tint} 25%, #1a1a24)`
                            : `linear-gradient(180deg, color-mix(in srgb, ${tint} 75%, white) 0%, color-mix(in srgb, ${tint} 45%, #1a1a24) 100%)`,
                          border: isSelected
                            ? '2px solid #7cf4c6'
                            : `1px solid color-mix(in srgb, ${tint} ${muted ? '35%' : '80%'}, white)`,
                          boxShadow: muted ? 'none' : '0 1px 4px rgba(0,0,0,0.45)',
                          opacity: muted ? 0.45 : 1,
                          zIndex: 12,
                          touchAction: 'none',
                          cursor: disabled
                            ? 'default'
                            : pointerMode
                              ? 'grab'
                              : cellCursor,
                        }}
                        onMouseDown={(e) => {
                          if (disabled) return;
                          if (e.button === 2) {
                            e.preventDefault();
                            deleteNoteAtPointer(e.clientX, e.clientY);
                            return;
                          }
                          handleNoteMouseDown(e, lane, col, note);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          deleteNoteAtPointer(e.clientX, e.clientY);
                        }}
                        onMouseEnter={(e) => {
                          if (disabled || !muteMode || !mutePaintRef.current?.active) return;
                          paintMuteAt(e.clientX, e.clientY);
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (justDraggedRef.current) {
                            justDraggedRef.current = false;
                            return;
                          }
                          if (brushMode || muteMode || velocityMode || sliceMode) return;
                          if (pointerMode) {
                            onSelectNote?.({ lane, col });
                            return;
                          }
                          onToggleNote(lane, col);
                        }}
                        title={`Vel ${note.vel ?? 100} · len ${drawLen}${muted ? ' · muted' : ''} · edit pitch/vol in lanes below`}
                      >
                        <span
                          aria-hidden
                          style={{
                            position: 'absolute',
                            left: 2,
                            bottom: 2,
                            width: 'calc(100% - 4px)',
                            height: `${Math.max(12, Math.round(((note.vel ?? 100) / 127) * 100))}%`,
                            maxHeight: '70%',
                            borderRadius: 2,
                            background: 'rgba(0,0,0,0.35)',
                            pointerEvents: 'none',
                          }}
                        />
                        {pointerMode ? (
                          <>
                            {onResizeNoteFromStart ? (
                              <span
                                role="presentation"
                                data-beat-lab-resize="start"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                                onPointerDown={(e) => beginNoteResize(e, lane, col, note, 'start')}
                                style={{
                                  position: 'absolute',
                                  left: 0,
                                  top: 0,
                                  bottom: 0,
                                  width: edgeHandleW,
                                  cursor: 'ew-resize',
                                  zIndex: 14,
                                  touchAction: 'none',
                                  background: 'rgba(124, 244, 198, 0.08)',
                                }}
                                title="Drag to move note start (resize left)"
                              />
                            ) : null}
                            <span
                              role="presentation"
                              data-beat-lab-resize="end"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              onPointerDown={(e) => beginNoteResize(e, lane, col, note, 'end')}
                              style={{
                                position: 'absolute',
                                right: 0,
                                top: 0,
                                bottom: 0,
                                width: edgeHandleW,
                                cursor: 'ew-resize',
                                zIndex: 14,
                                touchAction: 'none',
                                background: 'rgba(124, 244, 198, 0.08)',
                              }}
                              title="Drag to resize note length (resize right)"
                            />
                          </>
                        ) : null}
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
