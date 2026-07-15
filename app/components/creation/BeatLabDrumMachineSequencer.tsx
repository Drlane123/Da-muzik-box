'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';
import {
  Cable,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Eraser,
  Maximize2,
  Minimize2,
  MousePointer2,
  Pencil,
  Play,
  Square,
  Undo2,
  Upload,
} from 'lucide-react';
import { Se2BeatPadsSyncModeButtons } from '@/app/components/studio/Se2BeatPadsSyncModeButtons';
import type { Se2BeatPadsSe2SyncMode } from '@/app/lib/studio/se2BeatPadsTrack';
import { SynthRoundKnob } from '@/app/components/creation/BeatLabSynthV2Knob';
import {
  BEAT_LAB_DRUM_PAD_SEQUENCER_PARAMS,
  beatLabDrumPadVoiceParamValue,
  beatPadsSnapRollDrawCol,
  defaultBeatLabDrumPadVoiceOpts,
  type BeatLabDrumPadVoiceOpts,
  type BeatLabDrumPadVoiceParam,
} from '@/app/lib/creationStation/beatLabDrumPadVoice';
import { beatLabDrumCellsAlongSegment } from '@/app/lib/creationStation/beatLabGridPaint';
import {
  BEAT_PADS_LANE_COUNT,
  BEAT_PADS_STEPS_PER_BAR,
  beatPadsLoopBarChoices,
  beatPadsPatternCols,
  beatPadsStepIsBeat,
  beatPadsStepsPerQuarter,
  clampBeatPadsBpm,
  type BeatPadsDrumNote,
  type BeatPadsDrumPattern,
  type BeatPadsGridStepsPerBar,
} from '@/app/lib/creationStation/beatLabDrumMachineSequencer';
import {
  beatPadsDrawAt,
  beatPadsDuplicateSelection,
  beatPadsDuplicateSelectionByDelta,
  beatPadsMoveSelection,
  beatPadsNoteAtColumn,
  beatPadsNotesInMarquee,
  beatPadsRemoveNote,
  beatPadsResizeNoteEnd,
  cloneBeatPadsPattern,
  type BeatPadsEditTool,
  type BeatPadsNoteRef,
  type BeatPadsSelectionRect,
} from '@/app/lib/creationStation/beatPadsPatternEdit';
import { lab808PadAccentFromLabel } from '@/app/lib/creationStation/lab808PadColors';
import {
  BEAT_PADS_GRID_COL_W,
  beatPadsPlaylineXForCol,
  resetBeatPadsPlaylineToStart,
} from '@/app/lib/creationStation/beatPadsPlaylineWapi';

const MINT = '#7cf4c6';
const LANE_W = 72;
const ROW_H = 22;
const COL_W = BEAT_PADS_GRID_COL_W;
const BAR_HEADER_H = 20;
const BEAT_HEADER_H = 16;
const HEADER_H = BAR_HEADER_H + BEAT_HEADER_H;
const DEFAULT_MIN_VISIBLE_LANES = 7;
const MIN_SEQ_VIEWPORT_H = HEADER_H + DEFAULT_MIN_VISIBLE_LANES * ROW_H;
/** Pinned horizontal scrollbar track below the lane scroll area. */
const BEAT_PADS_GRID_HBAR_H = 14;

export function beatPadsSequencerMinViewportH(minVisibleLanes: number): number {
  const lanes = Math.max(1, Math.min(BEAT_PADS_LANE_COUNT, Math.round(minVisibleLanes)));
  return HEADER_H + lanes * ROW_H;
}

export function beatPadsGridScrollViewportH(
  minVisibleLanes: number,
  opts?: { liftPx?: number },
): number {
  let h = beatPadsSequencerMinViewportH(minVisibleLanes);
  if (opts?.liftPx) h += opts.liftPx;
  return h;
}
const QPB = 4;
const BEAT_PADS_UNDO_DEPTH = 48;
/** Pixels before pointer-down on a note becomes a drag (not a click-select). */
const BEAT_PADS_MOVE_DRAG_THRESHOLD_PX = 5;

/** White grid lines — bar / beat / step weight for 16 or 32 steps per bar. */
function beatPadsGridLineColor(col: number, stepsPerBar: BeatPadsGridStepsPerBar): string {
  const subdiv = beatPadsStepsPerQuarter(stepsPerBar);
  if (col % stepsPerBar === 0) return 'rgba(255, 255, 255, 0.34)';
  if (col % subdiv === 0) return 'rgba(255, 255, 255, 0.18)';
  return 'rgba(255, 255, 255, 0.09)';
}

const RESIZE_HANDLE_W = 6;
/** Inset for single-step hits so adjacent notes don't visually touch. */
const BEAT_PADS_STEP_INSET = 3;

/** Same base as BeatLabDrumMachineOverlay panel (`#0a0c10` → `#040506`). */
const BEAT_PADS_SURFACE = '#0a0c10';
const BEAT_PADS_SURFACE_SELECTED = '#0e1218';

const TOOLBAR_ICON = 14;
const TOOLBAR_LABEL: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.2,
};

const toolBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  height: 28,
  padding: '0 10px',
  borderRadius: 5,
  border: '1px solid rgba(255, 255, 255, 0.14)',
  background: '#12121a',
  color: '#c8d0dc',
  ...TOOLBAR_LABEL,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  flexShrink: 0,
};

function beatPadsGridFill(_rowIndex?: number, selected?: boolean): string {
  return selected ? BEAT_PADS_SURFACE_SELECTED : BEAT_PADS_SURFACE;
}

function beatPadsGridRowBorder(): string {
  return '1px solid rgba(255, 255, 255, 0.14)';
}

function beatLabGridStepOnFill(): string {
  return 'linear-gradient(180deg, #b8f5c5 0%, #7cf4c6 55%, #34d399 100%)';
}

function noteRefKey(ref: BeatPadsNoteRef): string {
  return `${ref.lane}:${ref.id}`;
}

function BeatPadsGridHeader({
  barCount,
  cols,
  gridW,
  stepsPerBar,
}: {
  barCount: number;
  cols: number;
  gridW: number;
  stepsPerBar: BeatPadsGridStepsPerBar;
}) {
  const subdiv = beatPadsStepsPerQuarter(stepsPerBar);
  return (
    <div style={{ width: gridW, minWidth: gridW, flexShrink: 0 }}>
      <div style={{ display: 'flex', height: BAR_HEADER_H }}>
        {Array.from({ length: barCount }, (_, bi) => (
          <div
            key={`bar-h-${bi}`}
            style={{
              width: stepsPerBar * COL_W,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              fontWeight: 900,
              color: '#c8d0dc',
              fontFamily: 'monospace',
              borderLeft: bi === 0 ? beatPadsGridRowBorder() : '2px solid rgba(255, 255, 255, 0.34)',
              boxSizing: 'border-box',
              background: BEAT_PADS_SURFACE,
            }}
          >
            {bi + 1}
          </div>
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          height: BEAT_HEADER_H,
          borderTop: beatPadsGridRowBorder(),
          background: BEAT_PADS_SURFACE,
        }}
      >
        {Array.from({ length: cols }, (_, col) => {
          const atBeat = beatPadsStepIsBeat(col, stepsPerBar);
          const beatNum = Math.floor((col % stepsPerBar) / subdiv) + 1;
          return (
            <div
              key={`beat-h-${col}`}
              style={{
                width: COL_W,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: atBeat ? 8 : 7,
                fontWeight: 800,
                fontFamily: 'monospace',
                color: atBeat ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.28)',
                borderLeft: `1px solid ${beatPadsGridLineColor(col, stepsPerBar)}`,
                boxSizing: 'border-box',
                background: BEAT_PADS_SURFACE,
              }}
            >
              {atBeat ? beatNum : ''}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BeatPadsNoteBlock({
  note,
  lane,
  selected,
  previewLen,
  previewStart,
  previewLane,
  disabled,
  onPointerDownBody,
  onPointerDownResize,
  onPointerMove,
  onPointerUp,
  onContextMenu,
}: {
  note: BeatPadsDrumNote;
  lane: number;
  selected: boolean;
  previewLen?: number;
  previewStart?: number;
  previewLane?: number;
  disabled: boolean;
  onPointerDownBody: (e: React.PointerEvent) => void;
  onPointerDownResize: (e: React.PointerEvent) => void;
  onPointerMove?: (e: React.PointerEvent) => void;
  onPointerUp?: (e: React.PointerEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const renderLane = previewLane ?? lane;
  const start = previewStart ?? note.start;
  const len = previewLen ?? note.len;
  const isRoll = len > 1;
  const inset = isRoll ? 1 : BEAT_PADS_STEP_INSET;
  const w = len * COL_W - inset * 2;
  const isDragging = previewLane != null || previewStart != null;

  return (
    <div
      role="presentation"
      onPointerDown={onPointerDownBody}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={onContextMenu}
      title={`Lane ${renderLane + 1} · step ${start + 1}${isRoll ? ` · ${len}× roll` : ''}`}
      style={{
        position: 'absolute',
        top: renderLane * ROW_H + inset,
        left: start * COL_W + inset,
        width: Math.max(COL_W - inset * 2, w),
        height: ROW_H - inset * 2,
        borderRadius: 3,
        background: isRoll
          ? `repeating-linear-gradient(90deg, #7cf4c6 0px, #7cf4c6 ${COL_W - 2}px, #34d399 ${COL_W - 2}px, #34d399 ${COL_W}px)`
          : beatLabGridStepOnFill(),
        border: selected ? '1px solid #fde047' : '1px solid #dbffe2',
        boxShadow: selected
          ? '0 0 5px rgba(253, 224, 71, 0.55)'
          : isRoll
            ? '0 0 7px rgba(184,245,197,0.45)'
            : '0 1px 3px rgba(184,245,197,0.35)',
        cursor: disabled ? 'not-allowed' : 'grab',
        zIndex: selected ? 3 : 2,
        boxSizing: 'border-box',
        pointerEvents: disabled ? 'none' : 'auto',
        opacity: isDragging && selected ? 0.88 : 1,
      }}
    >
      <div
        role="presentation"
        onPointerDown={onPointerDownResize}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: RESIZE_HANDLE_W,
          height: '100%',
          cursor: disabled ? 'not-allowed' : 'ew-resize',
          borderTopRightRadius: 3,
          borderBottomRightRadius: 3,
          background: 'rgba(255,255,255,0.12)',
        }}
      />
    </div>
  );
}

export type BeatLabDrumMachineSequencerProps = {
  pattern: BeatPadsDrumPattern;
  loopBars: number;
  stepsPerBar?: BeatPadsGridStepsPerBar;
  rollDrawMode?: boolean;
  rollDrawLabel?: string;
  selectedLane: number;
  onSelectLane: (lane: number) => void;
  onPatternChange: (next: BeatPadsDrumPattern) => void;
  onNoteAdded?: (lane: number, col: number) => void;
  onLoopBarsChange: (bars: number) => void;
  onClear: () => void;
  /** Clear only the selected pad lane (kick/snare/etc.). */
  onClearLane?: () => void;
  onImportFromBeatLab?: () => void;
  onExportToBeatLab?: () => void;
  onExportToStudioEditor2?: () => void;
  padLabelForLane?: (lane: number) => string | undefined;
  disabled?: boolean;
  laneVoice?: BeatLabDrumPadVoiceOpts;
  onLaneVoiceParam?: (param: BeatLabDrumPadVoiceParam, value: number) => void;
  transportPlaying?: boolean;
  playlineElRef?: RefObject<HTMLDivElement | null>;
  transportBpm?: number;
  onTransportPlay?: () => void;
  onTransportStop?: () => void;
  onTransportBpmChange?: (bpm: number) => void;
  /** SE2 embedded — lock step grid to main transport. */
  se2SyncMode?: Se2BeatPadsSe2SyncMode;
  onSe2SyncModeChange?: (mode: Se2BeatPadsSe2SyncMode) => void;
  /** Minimum lane rows visible in the scroll viewport (default 7). */
  minVisibleLanes?: number;
  /** Controlled expand — lifts grid to full-workspace overlay when embedded. */
  gridExpanded?: boolean;
  onGridExpandedChange?: (expanded: boolean) => void;
  /** Grid fills parent height (overlay mode) — all 16 lanes visible. */
  gridFillViewport?: boolean;
  /** Extra viewport height when expanded (reclaims waveform strip above grid). */
  gridExpandedLiftPx?: number;
};

export function BeatLabDrumMachineSequencer({
  pattern,
  loopBars,
  stepsPerBar = BEAT_PADS_STEPS_PER_BAR,
  rollDrawMode = false,
  rollDrawLabel,
  selectedLane,
  onSelectLane,
  onPatternChange,
  onNoteAdded,
  onLoopBarsChange,
  onClear,
  onClearLane,
  onImportFromBeatLab,
  onExportToBeatLab,
  onExportToStudioEditor2,
  padLabelForLane,
  disabled = false,
  laneVoice,
  onLaneVoiceParam,
  transportPlaying = false,
  playlineElRef,
  transportBpm,
  onTransportPlay,
  onTransportStop,
  onTransportBpmChange,
  se2SyncMode = 'off',
  onSe2SyncModeChange,
  minVisibleLanes = DEFAULT_MIN_VISIBLE_LANES,
  gridExpanded: gridExpandedProp,
  onGridExpandedChange,
  gridFillViewport = false,
  gridExpandedLiftPx = 0,
}: BeatLabDrumMachineSequencerProps) {
  const [gridExpandedInternal, setGridExpandedInternal] = useState(false);
  const [bpmEditing, setBpmEditing] = useState(false);
  const [bpmDraft, setBpmDraft] = useState('');
  const gridExpanded = gridExpandedProp ?? gridExpandedInternal;
  const compactViewportMinH = beatPadsSequencerMinViewportH(minVisibleLanes);
  const fullGridMinH = beatPadsSequencerMinViewportH(BEAT_PADS_LANE_COUNT);
  const seqViewportMinH = gridExpanded
    ? beatPadsGridScrollViewportH(minVisibleLanes, { liftPx: gridExpandedLiftPx })
    : compactViewportMinH;
  const gridHostMinH = seqViewportMinH + BEAT_PADS_GRID_HBAR_H;

  const setGridExpanded = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      const resolved = typeof value === 'function' ? value(gridExpanded) : value;
      if (gridExpandedProp === undefined) setGridExpandedInternal(resolved);
      onGridExpandedChange?.(resolved);
    },
    [gridExpanded, gridExpandedProp, onGridExpandedChange],
  );

  const toggleGridExpanded = useCallback(() => {
    setGridExpanded((prev) => !prev);
  }, [setGridExpanded]);

  const syncHScrollFromGrid = useCallback(() => {
    const inner = hScrollRef.current;
    const bar = hBarRef.current;
    if (!inner || !bar || syncingHScrollRef.current) return;
    syncingHScrollRef.current = true;
    bar.scrollLeft = inner.scrollLeft;
    syncingHScrollRef.current = false;
  }, []);

  const syncHScrollFromBar = useCallback(() => {
    const inner = hScrollRef.current;
    const bar = hBarRef.current;
    if (!inner || !bar || syncingHScrollRef.current) return;
    syncingHScrollRef.current = true;
    inner.scrollLeft = bar.scrollLeft;
    syncingHScrollRef.current = false;
  }, []);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const hScrollRef = useRef<HTMLDivElement | null>(null);
  const hBarRef = useRef<HTMLDivElement | null>(null);
  const syncingHScrollRef = useRef(false);
  const gridBodyRef = useRef<HTMLDivElement | null>(null);
  const patternRef = useRef(pattern);
  patternRef.current = pattern;
  const selectedRefsRef = useRef<BeatPadsNoteRef[]>([]);
  const undoStackRef = useRef<BeatPadsDrumPattern[]>([]);
  const skipHistoryRef = useRef(false);

  const [editTool, setEditTool] = useState<BeatPadsEditTool>('pointer');
  const [selectedRefs, setSelectedRefs] = useState<BeatPadsNoteRef[]>([]);
  selectedRefsRef.current = selectedRefs;
  const [canUndo, setCanUndo] = useState(false);
  const [marquee, setMarquee] = useState<BeatPadsSelectionRect | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    ref: BeatPadsNoteRef;
  } | null>(null);
  const [resizePreview, setResizePreview] = useState<{
    lane: number;
    id: string;
    len: number;
  } | null>(null);
  const [selectionMoveDelta, setSelectionMoveDelta] = useState<{
    deltaLane: number;
    deltaCol: number;
  } | null>(null);
  const [isDraggingSelection, setIsDraggingSelection] = useState(false);

  const dragRef = useRef<{
    kind: 'pendingMoveSelection' | 'moveSelection' | 'resize' | 'marquee' | 'brush';
    fromLane: number;
    noteId?: string;
    moveSelectionRefs?: BeatPadsNoteRef[];
    moveAnchor?: { lane: number; col: number };
    pointerStartX?: number;
    pointerStartY?: number;
    duplicate?: boolean;
    marqueeStart?: { lane: number; col: number };
    brushOn?: boolean;
    lastCellKey?: string;
  } | null>(null);

  const showTransport =
    typeof transportBpm === 'number'
    && typeof onTransportPlay === 'function'
    && typeof onTransportStop === 'function';
  const se2SyncActive = se2SyncMode !== 'off' && typeof onSe2SyncModeChange === 'function';
  const se2SyncSlave = se2SyncMode === 'slave';

  const laneVoiceDefault = useCallback(
    (param: BeatLabDrumPadVoiceParam) =>
      beatLabDrumPadVoiceParamValue(defaultBeatLabDrumPadVoiceOpts(selectedLane), param),
    [selectedLane],
  );

  const cols = beatPadsPatternCols(loopBars, stepsPerBar);
  const barCount = Math.max(1, Math.ceil(cols / stepsPerBar));
  const gridW = cols * COL_W;
  const barChoices = useMemo(() => beatPadsLoopBarChoices(), []);
  const playlineStartX = beatPadsPlaylineXForCol(0, COL_W);

  // Only reset the parked playline when the grid length changes while stopped.
  // Do not jump to column 0 on every Stop — transport parks in place.
  useLayoutEffect(() => {
    if (!playlineElRef?.current || transportPlaying) return;
    resetBeatPadsPlaylineToStart(playlineElRef.current, COL_W);
  }, [playlineElRef, cols, loopBars, stepsPerBar]);

  useEffect(() => {
    undoStackRef.current = [];
    setCanUndo(false);
  }, [loopBars, stepsPerBar]);

  useLayoutEffect(() => {
    const inner = hScrollRef.current;
    const bar = hBarRef.current;
    if (!inner || !bar) return;
    const maxScroll = Math.max(0, inner.scrollWidth - inner.clientWidth);
    if (inner.scrollLeft > maxScroll) {
      syncingHScrollRef.current = true;
      inner.scrollLeft = maxScroll;
      bar.scrollLeft = maxScroll;
      syncingHScrollRef.current = false;
    }
  }, [gridW]);

  useEffect(() => {
    if (rollDrawMode) setEditTool('draw');
  }, [rollDrawMode]);

  useEffect(() => {
    if (!bpmEditing && transportBpm != null) setBpmDraft(String(transportBpm));
  }, [bpmEditing, transportBpm]);

  const nudgeBpm = useCallback(
    (delta: number) => {
      if (!onTransportBpmChange || transportBpm == null) return;
      onTransportBpmChange(clampBeatPadsBpm(transportBpm + delta));
    },
    [onTransportBpmChange, transportBpm],
  );

  const commitBpmDraft = useCallback(() => {
    setBpmEditing(false);
    if (!onTransportBpmChange || transportBpm == null) return;
    const trimmed = bpmDraft.trim();
    if (!trimmed) return;
    const v = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(v)) return;
    onTransportBpmChange(clampBeatPadsBpm(v));
  }, [bpmDraft, onTransportBpmChange, transportBpm]);

  const cancelBpmDraft = useCallback(() => {
    setBpmEditing(false);
    if (transportBpm != null) setBpmDraft(String(transportBpm));
  }, [transportBpm]);

  const cellAt = useCallback(
    (clientX: number, clientY: number): { lane: number; col: number } | null => {
      const el = gridBodyRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      if (x < 0 || y < 0) return null;
      const col = Math.floor(x / COL_W);
      const lane = Math.floor(y / ROW_H);
      if (col < 0 || col >= cols || lane < 0 || lane >= BEAT_PADS_LANE_COUNT) return null;
      return { lane, col };
    },
    [cols],
  );

  const applyPattern = useCallback(
    (next: BeatPadsDrumPattern) => {
      if (next === patternRef.current) return;
      if (!skipHistoryRef.current) {
        const stack = undoStackRef.current;
        stack.push(cloneBeatPadsPattern(patternRef.current));
        if (stack.length > BEAT_PADS_UNDO_DEPTH) stack.shift();
        undoStackRef.current = stack;
        setCanUndo(true);
      }
      onPatternChange(next);
    },
    [onPatternChange],
  );

  const undoPattern = useCallback(() => {
    const stack = undoStackRef.current;
    if (stack.length === 0) return;
    const prev = stack.pop()!;
    undoStackRef.current = stack;
    setCanUndo(stack.length > 0);
    skipHistoryRef.current = true;
    onPatternChange(prev);
    skipHistoryRef.current = false;
    setSelectedRefs([]);
  }, [onPatternChange]);

  const deleteSelected = useCallback(() => {
    if (selectedRefs.length === 0) return;
    let next = pattern;
    for (const ref of selectedRefs) {
      next = beatPadsRemoveNote(next, ref.lane, ref.id);
    }
    applyPattern(next);
    setSelectedRefs([]);
  }, [applyPattern, pattern, selectedRefs]);

  const duplicateSelected = useCallback(() => {
    if (selectedRefs.length === 0) return;
    const next = beatPadsDuplicateSelection(pattern, selectedRefs, cols);
    if (next !== pattern) applyPattern(next);
  }, [applyPattern, cols, pattern, selectedRefs]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (disabled) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedRefs.length === 0) return;
        e.preventDefault();
        deleteSelected();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        if (selectedRefs.length === 0) return;
        e.preventDefault();
        duplicateSelected();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undoPattern();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deleteSelected, disabled, duplicateSelected, selectedRefs.length, undoPattern]);

  useEffect(() => {
    function dismissMenu() {
      setContextMenu(null);
    }
    window.addEventListener('click', dismissMenu);
    return () => window.removeEventListener('click', dismissMenu);
  }, []);

  const beginBrush = useCallback(
    (lane: number, col: number, on: boolean) => {
      const drawLane = rollDrawMode ? selectedLane : lane;
      const drawCol = rollDrawMode ? beatPadsSnapRollDrawCol(col, rollDrawLabel, stepsPerBar) : col;
      dragRef.current = {
        kind: 'brush',
        fromLane: drawLane,
        brushOn: on,
        lastCellKey: `${drawLane},${drawCol}`,
      };
      const next = beatPadsDrawAt(pattern, drawLane, drawCol, on, cols);
      if (next !== pattern) {
        applyPattern(next);
        if (on) onNoteAdded?.(drawLane, drawCol);
      }
    },
    [applyPattern, cols, onNoteAdded, pattern, rollDrawLabel, rollDrawMode, selectedLane, stepsPerBar],
  );

  const paintBrushSegment = useCallback(
    (x0: number, y0: number, x1: number, y1: number) => {
      const drag = dragRef.current;
      if (!drag || drag.kind !== 'brush' || drag.brushOn == null) return;
      const scrollEl = scrollRef.current;
      if (!scrollEl || !gridBodyRef.current) return;
      const cells = beatLabDrumCellsAlongSegment(x0, y0, x1, y1, scrollEl, {
        colWidth: COL_W,
        headerH: 0,
        rowH: ROW_H,
        laneCount: BEAT_PADS_LANE_COUNT,
        patternCols: cols,
        colOffset: 0,
        contentEl: gridBodyRef.current,
      });
      let next = pattern;
      let changed = false;
      for (const cell of cells) {
        const lane = rollDrawMode ? selectedLane : cell.pad;
        const col = rollDrawMode
          ? beatPadsSnapRollDrawCol(cell.patternCol, rollDrawLabel, stepsPerBar)
          : cell.patternCol;
        const key = `${lane},${col}`;
        if (key === drag.lastCellKey) continue;
        drag.lastCellKey = key;
        const painted = beatPadsDrawAt(next, lane, col, drag.brushOn, cols);
        if (painted !== next) {
          next = painted;
          changed = true;
          if (drag.brushOn) onNoteAdded?.(lane, col);
        }
      }
      if (changed) applyPattern(next);
    },
    [applyPattern, cols, onNoteAdded, pattern, rollDrawLabel, rollDrawMode, selectedLane, stepsPerBar],
  );

  const onGridPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      if (e.button !== 0) return;
      const cell = cellAt(e.clientX, e.clientY);
      if (!cell) return;
      onSelectLane(cell.lane);
      setContextMenu(null);

      if (editTool === 'draw') {
        e.preventDefault();
        beginBrush(cell.lane, cell.col, true);
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          /* */
        }
        return;
      }
      if (editTool === 'erase') {
        e.preventDefault();
        beginBrush(cell.lane, cell.col, false);
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          /* */
        }
        return;
      }

      const hit = beatPadsNoteAtColumn(pattern[cell.lane], cell.col);
      if (!hit) {
        if (!e.shiftKey) {
          setSelectedRefs([]);
          selectedRefsRef.current = [];
        }
        dragRef.current = {
          kind: 'marquee',
          fromLane: cell.lane,
          marqueeStart: cell,
        };
        setMarquee({
          laneMin: cell.lane,
          laneMax: cell.lane,
          colMin: cell.col,
          colMax: cell.col,
        });
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          /* */
        }
      }
    },
    [beginBrush, cellAt, disabled, editTool, onSelectLane, pattern],
  );

  const onGridPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      if (drag.kind === 'brush') {
        paintBrushSegment(e.clientX, e.clientY, e.clientX, e.clientY);
        return;
      }

      if (drag.kind === 'marquee' && drag.marqueeStart) {
        const cell = cellAt(e.clientX, e.clientY);
        if (!cell) return;
        const start = drag.marqueeStart;
        setMarquee({
          laneMin: Math.min(start.lane, cell.lane),
          laneMax: Math.max(start.lane, cell.lane),
          colMin: Math.min(start.col, cell.col),
          colMax: Math.max(start.col, cell.col),
        });
        return;
      }

      if (drag.kind === 'pendingMoveSelection' && drag.moveAnchor && drag.moveSelectionRefs) {
        const dx = e.clientX - (drag.pointerStartX ?? e.clientX);
        const dy = e.clientY - (drag.pointerStartY ?? e.clientY);
        if (Math.hypot(dx, dy) < BEAT_PADS_MOVE_DRAG_THRESHOLD_PX) return;
        dragRef.current = { ...drag, kind: 'moveSelection' };
        setIsDraggingSelection(true);
        const cell = cellAt(e.clientX, e.clientY);
        if (cell) {
          setSelectionMoveDelta({
            deltaLane: cell.lane - drag.moveAnchor.lane,
            deltaCol: cell.col - drag.moveAnchor.col,
          });
        }
        return;
      }

      if (drag.kind === 'moveSelection' && drag.moveAnchor) {
        const cell = cellAt(e.clientX, e.clientY);
        if (cell) {
          setSelectionMoveDelta({
            deltaLane: cell.lane - drag.moveAnchor.lane,
            deltaCol: cell.col - drag.moveAnchor.col,
          });
        }
        return;
      }

      if (drag.kind === 'resize' && drag.noteId != null) {
        const cell = cellAt(e.clientX, e.clientY);
        const note = patternRef.current[drag.fromLane]?.find((n) => n.id === drag.noteId);
        if (cell && note) {
          setResizePreview({
            lane: drag.fromLane,
            id: drag.noteId,
            len: Math.max(1, cell.col + 1 - note.start),
          });
        }
      }
    },
    [cellAt, cols, paintBrushSegment],
  );

  const finishPointer = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      if (drag.kind === 'marquee' && drag.marqueeStart) {
        const cell = cellAt(e.clientX, e.clientY);
        if (cell) {
          const start = drag.marqueeStart;
          const rect: BeatPadsSelectionRect = {
            laneMin: Math.min(start.lane, cell.lane),
            laneMax: Math.max(start.lane, cell.lane),
            colMin: Math.min(start.col, cell.col),
            colMax: Math.max(start.col, cell.col),
          };
          const refs = beatPadsNotesInMarquee(patternRef.current, rect);
          setSelectedRefs((prev) => (e.shiftKey ? [...prev, ...refs] : refs));
          selectedRefsRef.current = e.shiftKey ? [...selectedRefsRef.current, ...refs] : refs;
        }
        setMarquee(null);
      }

      if (drag.kind === 'pendingMoveSelection') {
        /* Click-select only — move starts after drag threshold in pointer move. */
      } else if (drag.kind === 'moveSelection' && drag.moveSelectionRefs && drag.moveAnchor) {
        const cell = cellAt(e.clientX, e.clientY);
        if (cell) {
          const deltaLane = cell.lane - drag.moveAnchor.lane;
          const deltaCol = cell.col - drag.moveAnchor.col;
          if (deltaLane !== 0 || deltaCol !== 0) {
            const next = drag.duplicate
              ? beatPadsDuplicateSelectionByDelta(
                  patternRef.current,
                  drag.moveSelectionRefs,
                  deltaLane,
                  deltaCol,
                  cols,
                )
              : beatPadsMoveSelection(
                  patternRef.current,
                  drag.moveSelectionRefs,
                  deltaLane,
                  deltaCol,
                  cols,
                );
            if (next !== patternRef.current) {
              applyPattern(next);
              if (!drag.duplicate) {
                const moved = drag.moveSelectionRefs
                  .map((ref) => ({
                    lane: ref.lane + deltaLane,
                    id: ref.id,
                  }))
                  .filter((ref) => next[ref.lane]?.some((n) => n.id === ref.id));
                setSelectedRefs(moved);
                selectedRefsRef.current = moved;
              }
            }
          }
        }
      }

      if (drag.kind === 'resize' && drag.noteId != null) {
        const cell = cellAt(e.clientX, e.clientY);
        if (cell) {
          const note = patternRef.current[drag.fromLane]?.find((n) => n.id === drag.noteId);
          if (note) {
            const endCol = Math.max(note.start + 1, cell.col + 1);
            const next = beatPadsResizeNoteEnd(
              patternRef.current,
              drag.fromLane,
              drag.noteId,
              endCol,
              cols,
            );
            if (next !== patternRef.current) applyPattern(next);
          }
        }
      }

      dragRef.current = null;
      setSelectionMoveDelta(null);
      setIsDraggingSelection(false);
      setResizePreview(null);
      setMarquee(null);
    },
    [applyPattern, cellAt, cols],
  );

  const selectLaneNotes = useCallback(
    (lane: number, merge: boolean) => {
      const laneRefs = (patternRef.current[lane] ?? []).map((n) => ({ lane, id: n.id }));
      setSelectedRefs((prev) => {
        if (!merge) {
          selectedRefsRef.current = laneRefs;
          return laneRefs;
        }
        const keys = new Set(prev.map(noteRefKey));
        const added = laneRefs.filter((r) => !keys.has(noteRefKey(r)));
        const next = [...prev, ...added];
        selectedRefsRef.current = next;
        return next;
      });
    },
    [],
  );

  const onNotePointerDown = useCallback(
    (e: React.PointerEvent, lane: number, note: BeatPadsDrumNote) => {
      if (disabled) return;

      if (editTool === 'erase') {
        e.preventDefault();
        e.stopPropagation();
        applyPattern(beatPadsRemoveNote(pattern, lane, note.id));
        return;
      }

      if (editTool !== 'pointer') return;
      e.preventDefault();
      e.stopPropagation();
      setContextMenu(null);
      onSelectLane(lane);

      const ref = { lane, id: note.id };
      const key = noteRefKey(ref);
      const currentSelection = selectedRefsRef.current;
      let refsToMove: BeatPadsNoteRef[];

      if (e.shiftKey) {
        const has = currentSelection.some((r) => noteRefKey(r) === key);
        refsToMove = has
          ? currentSelection.filter((r) => noteRefKey(r) !== key)
          : [...currentSelection, ref];
        setSelectedRefs(refsToMove);
        selectedRefsRef.current = refsToMove;
      } else if (currentSelection.some((r) => noteRefKey(r) === key)) {
        refsToMove = currentSelection;
      } else {
        refsToMove = [ref];
        setSelectedRefs([ref]);
        selectedRefsRef.current = [ref];
      }

      if (refsToMove.length === 0) return;

      const anchorCell = cellAt(e.clientX, e.clientY) ?? { lane, col: note.start };
      dragRef.current = {
        kind: 'pendingMoveSelection',
        fromLane: lane,
        noteId: note.id,
        moveSelectionRefs: refsToMove,
        moveAnchor: anchorCell,
        pointerStartX: e.clientX,
        pointerStartY: e.clientY,
        duplicate: e.altKey,
      };
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* */
      }
    },
    [applyPattern, cellAt, disabled, editTool, onSelectLane, pattern],
  );

  const onResizePointerDown = useCallback(
    (e: React.PointerEvent, lane: number, note: BeatPadsDrumNote) => {
      if (disabled || editTool !== 'pointer') return;
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = {
        kind: 'resize',
        fromLane: lane,
        noteId: note.id,
      };
      setResizePreview({ lane, id: note.id, len: note.len });
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* */
      }
    },
    [disabled, editTool],
  );

  const onNoteContextMenu = useCallback(
    (e: React.MouseEvent, ref: BeatPadsNoteRef) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      setSelectedRefs([ref]);
      setContextMenu({ x: e.clientX, y: e.clientY, ref });
    },
    [disabled],
  );

  const toolActiveStyle = (active: boolean): CSSProperties =>
    active
      ? {
          borderColor: 'rgba(124, 244, 198, 0.65)',
          background: 'rgba(124, 244, 198, 0.16)',
          color: MINT,
        }
      : {};

  return (
    <div
      data-beat-pads-grid-expanded={gridExpanded ? '' : undefined}
      className={
        gridExpanded
          ? gridFillViewport
            ? 'beat-pads-sequencer-expanded beat-pads-sequencer-fill-viewport'
            : 'beat-pads-sequencer-expanded'
          : undefined
      }
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        flex: gridFillViewport ? '1 1 auto' : gridExpanded ? '0 0 auto' : '1 1 auto',
        height: undefined,
        borderTop: '1px solid rgba(124, 244, 198, 0.18)',
        background: BEAT_PADS_SURFACE,
        ['--beat-pads-grid-viewport-h' as string]: `${seqViewportMinH}px`,
      }}
    >
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          padding: '5px 8px',
          borderBottom: '1px solid rgba(124, 244, 198, 0.12)',
          background: 'rgba(6, 8, 12, 0.95)',
        }}
      >
        <div
          style={{
            display: 'flex',
            flex: '1 1 auto',
            minWidth: 0,
            alignItems: 'center',
            gap: 5,
            overflowX: 'auto',
            overflowY: 'hidden',
          }}
        >
        <div style={{ display: 'inline-flex', gap: 3, flexShrink: 0 }}>
          <button
            type="button"
            disabled={disabled}
            title="Select · box-drag on empty grid to select · then drag selection to move · Shift+click lane = whole row"
            onClick={() => setEditTool('pointer')}
            style={{ ...toolBtn, ...toolActiveStyle(editTool === 'pointer'), opacity: disabled ? 0.45 : 1 }}
          >
            <MousePointer2 size={TOOLBAR_ICON} aria-hidden /> Select
          </button>
          <button
            type="button"
            disabled={disabled}
            title="Draw hits (16th steps)"
            onClick={() => setEditTool('draw')}
            style={{ ...toolBtn, ...toolActiveStyle(editTool === 'draw'), opacity: disabled ? 0.45 : 1 }}
          >
            <Pencil size={TOOLBAR_ICON} aria-hidden /> Draw
          </button>
          <button
            type="button"
            disabled={disabled}
            title="Erase hits"
            onClick={() => setEditTool('erase')}
            style={{ ...toolBtn, ...toolActiveStyle(editTool === 'erase'), opacity: disabled ? 0.45 : 1 }}
          >
            <Eraser size={TOOLBAR_ICON} aria-hidden /> Erase
          </button>
          <button
            type="button"
            disabled={disabled || !canUndo}
            title="Undo last grid edit (Ctrl+Z)"
            onClick={undoPattern}
            style={{
              ...toolBtn,
              borderColor: canUndo ? 'rgba(124, 244, 198, 0.45)' : undefined,
              opacity: disabled || !canUndo ? 0.45 : 1,
            }}
          >
            <Undo2 size={TOOLBAR_ICON} aria-hidden /> Undo
          </button>
          <button
            type="button"
            disabled={disabled || selectedRefs.length === 0}
            title="Duplicate selection to next open column (Ctrl+D)"
            onClick={duplicateSelected}
            style={{
              ...toolBtn,
              borderColor: selectedRefs.length > 0 ? 'rgba(124, 244, 198, 0.45)' : undefined,
              opacity: disabled || selectedRefs.length === 0 ? 0.45 : 1,
            }}
          >
            <Copy size={TOOLBAR_ICON} aria-hidden /> Dup
          </button>
        </div>
        {rollDrawMode && rollDrawLabel ? (
          <span
            style={{
              fontSize: 8,
              fontWeight: 900,
              letterSpacing: '0.1em',
              color: MINT,
              padding: '2px 8px',
              borderRadius: 4,
              border: '1px solid rgba(124, 244, 198, 0.45)',
              background: 'rgba(124, 244, 198, 0.1)',
              flexShrink: 0,
            }}
          >
            ROLL DRAW · {rollDrawLabel}
          </span>
        ) : null}
        {showTransport ? (
          <>
            {typeof onSe2SyncModeChange === 'function' ? (
              <Se2BeatPadsSyncModeButtons
                mode={se2SyncMode}
                disabled={disabled}
                onModeChange={onSe2SyncModeChange}
              />
            ) : null}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 4px',
                borderRadius: 5,
                border: '1px solid rgba(124, 244, 198, 0.28)',
                background: 'rgba(8, 10, 14, 0.95)',
              }}
              title={
                se2SyncActive
                  ? 'Beat Pads follows SE2 transport — Play/Stop drives the main transport bar'
                  : 'Beat Pads local loop — independent from SE2 transport'
              }
            >
              <button
                type="button"
                disabled={disabled || transportPlaying}
                onClick={onTransportPlay}
                style={{
                  ...toolBtn,
                  width: 32,
                  height: 28,
                  padding: 0,
                  justifyContent: 'center',
                  borderColor: transportPlaying ? 'rgba(124, 244, 198, 0.2)' : 'rgba(124, 244, 198, 0.55)',
                  background: transportPlaying ? '#0a0a0e' : 'rgba(124, 244, 198, 0.14)',
                  color: transportPlaying ? '#5a6270' : MINT,
                  opacity: disabled || transportPlaying ? 0.45 : 1,
                }}
                title="Play loop"
              >
                <Play size={TOOLBAR_ICON} fill="currentColor" aria-hidden />
              </button>
              <button
                type="button"
                disabled={disabled && !transportPlaying}
                onClick={onTransportStop}
                style={{
                  ...toolBtn,
                  width: 32,
                  height: 28,
                  padding: 0,
                  justifyContent: 'center',
                  borderColor: transportPlaying ? '#ef444488' : 'rgba(255, 255, 255, 0.14)',
                  background: transportPlaying ? '#ef444422' : '#12121a',
                  color: transportPlaying ? '#fca5a5' : '#c8d0dc',
                  opacity: disabled && !transportPlaying ? 0.45 : 1,
                }}
                title={
                  transportPlaying
                    ? 'Stop — parks playhead here (Play resumes from this spot)'
                    : 'Reset playhead to the start of the grid'
                }
              >
                <Square size={12} fill="currentColor" aria-hidden />
              </button>
            </div>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 6px',
                borderRadius: 5,
                border: '1px solid rgba(124, 244, 198, 0.22)',
                background: 'rgba(8, 10, 14, 0.92)',
                opacity: disabled || se2SyncSlave || typeof onTransportBpmChange !== 'function' ? 0.55 : 1,
              }}
              title={
                se2SyncSlave
                  ? 'Beat Pads follows SE2 session BPM while synced as slave'
                  : se2SyncActive
                    ? 'Beat Pads tempo — updates SE2 session BPM while synced as master'
                    : 'Loop BPM'
              }
            >
              <span style={{ ...TOOLBAR_LABEL, color: '#8a929e' }}>BPM</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className="beat-pads-bpm-input"
                value={bpmEditing ? bpmDraft : String(transportBpm)}
                disabled={disabled || se2SyncSlave || typeof onTransportBpmChange !== 'function'}
                onFocus={(e) => {
                  if (disabled || se2SyncSlave || typeof onTransportBpmChange !== 'function') return;
                  setBpmEditing(true);
                  setBpmDraft(String(transportBpm));
                  e.currentTarget.select();
                }}
                onChange={(e) => {
                  if (!bpmEditing) setBpmEditing(true);
                  setBpmDraft(e.target.value.replace(/[^\d]/g, ''));
                }}
                onBlur={() => commitBpmDraft()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.currentTarget.blur();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    cancelBpmDraft();
                    e.currentTarget.blur();
                  }
                }}
                style={{
                  width: 52,
                  height: 26,
                  padding: '0 6px',
                  borderRadius: 4,
                  border: '1px solid rgba(124, 244, 198, 0.35)',
                  background: '#1e1e26',
                  color: '#e8eef4',
                  fontSize: 14,
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  textAlign: 'center',
                  cursor: 'text',
                }}
                title="Click to highlight and type a new BPM — Enter to apply"
                aria-label="Beat Pads loop tempo in BPM"
              />
              <button
                type="button"
                disabled={disabled || typeof onTransportBpmChange !== 'function'}
                onClick={() => nudgeBpm(-1)}
                style={{
                  ...toolBtn,
                  width: 26,
                  height: 26,
                  padding: 0,
                  justifyContent: 'center',
                  opacity: disabled || typeof onTransportBpmChange !== 'function' ? 0.45 : 1,
                }}
                title="Slower"
              >
                <ChevronDown size={16} aria-hidden />
              </button>
              <button
                type="button"
                disabled={disabled || typeof onTransportBpmChange !== 'function'}
                onClick={() => nudgeBpm(1)}
                style={{
                  ...toolBtn,
                  width: 26,
                  height: 26,
                  padding: 0,
                  justifyContent: 'center',
                  opacity: disabled || typeof onTransportBpmChange !== 'function' ? 0.45 : 1,
                }}
                title="Faster"
              >
                <ChevronUp size={16} aria-hidden />
              </button>
            </label>
            <span style={{ width: 1, height: 20, background: 'rgba(124, 244, 198, 0.2)', flexShrink: 0 }} aria-hidden />
          </>
        ) : null}
        {typeof onImportFromBeatLab === 'function' ? (
          <button type="button" disabled={disabled} onClick={onImportFromBeatLab} style={{ ...toolBtn, opacity: disabled ? 0.45 : 1 }}>
            <Download size={11} aria-hidden /> Import grid
          </button>
        ) : null}
        {typeof onExportToBeatLab === 'function' ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onExportToBeatLab}
            style={{
              ...toolBtn,
              borderColor: 'rgba(124, 244, 198, 0.55)',
              color: MINT,
              background: 'rgba(124, 244, 198, 0.12)',
              opacity: disabled ? 0.45 : 1,
            }}
          >
            <Upload size={11} aria-hidden /> Export to grid
          </button>
        ) : null}
        {typeof onExportToStudioEditor2 === 'function' ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onExportToStudioEditor2}
            title="Send this loop to Studio Editor 2 as a drum MIDI track"
            style={{
              ...toolBtn,
              borderColor: 'rgba(0, 229, 255, 0.55)',
              color: '#00E5FF',
              background: 'rgba(0, 229, 255, 0.1)',
              opacity: disabled ? 0.45 : 1,
            }}
          >
            <Cable size={11} aria-hidden /> Export to SE2
          </button>
        ) : null}
        {laneVoice && onLaneVoiceParam ? (
          <>
            <span style={{ width: 1, height: 20, background: 'rgba(124, 244, 198, 0.2)', flexShrink: 0 }} aria-hidden />
            {BEAT_LAB_DRUM_PAD_SEQUENCER_PARAMS.map((p) => (
              <SynthRoundKnob
                key={p.id}
                label={p.label}
                value={beatLabDrumPadVoiceParamValue(laneVoice, p.id)}
                min={p.min}
                max={p.max}
                decimals={0}
                defaultValue={laneVoiceDefault(p.id)}
                onChange={(v) => onLaneVoiceParam(p.id, v)}
                size={24}
                accent="#7cf4c6"
              />
            ))}
          </>
        ) : null}
        </div>
        <div
          className="beat-pads-sequencer-toolbar-actions"
          style={{
            display: 'inline-flex',
            flexShrink: 0,
            alignItems: 'center',
            gap: 5,
            paddingLeft: 6,
            marginLeft: 4,
            borderLeft: '1px solid rgba(124, 244, 198, 0.22)',
          }}
        >
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ ...TOOLBAR_LABEL, color: '#8a929e' }}>BARS</span>
            <select
              value={loopBars}
              disabled={disabled}
              onChange={(e) => onLoopBarsChange(Number(e.target.value))}
              style={{
                height: 28,
                padding: '0 8px',
                borderRadius: 4,
                border: '1px solid rgba(124, 244, 198, 0.35)',
                background: '#1e1e26',
                color: '#e8eef4',
                fontSize: 12,
                fontWeight: 700,
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}
            >
              {barChoices.map((b) => (
                <option key={b} value={b}>
                  {b} bars
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={disabled || !onClearLane}
            onClick={onClearLane}
            style={{ ...toolBtn, opacity: disabled || !onClearLane ? 0.45 : 1 }}
            title="Clear only the selected pad lane"
            aria-label="Clear selected lane"
          >
            <Eraser size={TOOLBAR_ICON} aria-hidden /> Clear lane
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={onClear}
            style={{ ...toolBtn, opacity: disabled ? 0.45 : 1 }}
            title="Clear every pad lane"
            aria-label="Clear all lanes"
          >
            <Eraser size={TOOLBAR_ICON} aria-hidden /> Clear all
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={toggleGridExpanded}
            style={{
              ...toolBtn,
              borderColor: gridExpanded ? 'rgba(124, 244, 198, 0.65)' : 'rgba(124, 244, 198, 0.45)',
              color: gridExpanded ? MINT : '#d8ece4',
              background: gridExpanded ? 'rgba(124, 244, 198, 0.16)' : 'rgba(124, 244, 198, 0.1)',
              opacity: disabled ? 0.45 : 1,
            }}
            title={
              gridExpanded
                ? 'Minimize grid — show waveform strip above grid'
                : 'Expand grid — tuck waveform strip, show more pad lanes'
            }
            aria-expanded={gridExpanded}
          >
            {gridExpanded ? (
              <>
                <Minimize2 size={TOOLBAR_ICON} aria-hidden /> Minimize
              </>
            ) : (
              <>
                <Maximize2 size={TOOLBAR_ICON} aria-hidden /> Expand
              </>
            )}
          </button>
        </div>
      </div>

      <div
        className={`beat-pads-grid-scroll-host${gridExpanded ? ' beat-pads-grid-expanded-host' : ''}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: gridFillViewport ? '1 1 auto' : gridExpanded ? '0 0 auto' : '1 1 auto',
          minHeight: gridFillViewport ? fullGridMinH + BEAT_PADS_GRID_HBAR_H : gridHostMinH,
          height: gridExpanded ? gridHostMinH : undefined,
          maxHeight: gridExpanded ? gridHostMinH : undefined,
          minWidth: 0,
          background: BEAT_PADS_SURFACE,
        }}
      >
        <div
          ref={scrollRef}
          className={`beat-lab-drum-grid-scroll beat-pads-grid-v-scroll${gridExpanded ? ' beat-pads-grid-expanded' : ''}${gridFillViewport ? ' beat-pads-grid-fill-viewport' : ''}`}
          style={{
            flex: '1 1 auto',
            minHeight: 0,
            overflowX: 'hidden',
            overflowY: 'auto',
            overscrollBehavior: 'contain',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', position: 'relative' }}>
            <div
              style={{
                zIndex: 12,
                alignSelf: 'flex-start',
                width: LANE_W,
                flexShrink: 0,
                background: BEAT_PADS_SURFACE,
                borderRight: '1px solid rgba(255, 255, 255, 0.14)',
              }}
            >
              <div
                style={{
                  height: HEADER_H,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 8,
                  fontWeight: 900,
                  color: '#6a7280',
                  letterSpacing: 0.8,
                  borderBottom: beatPadsGridRowBorder(),
                  background: BEAT_PADS_SURFACE,
                }}
              >
                LANE
              </div>
              {Array.from({ length: BEAT_PADS_LANE_COUNT }, (_, lane) => {
                const label = padLabelForLane?.(lane)?.trim() || `Pad ${lane + 1}`;
                const selected = lane === selectedLane;
                const accent = lab808PadAccentFromLabel(label, lane);
                return (
                  <button
                    key={lane}
                    type="button"
                    onClick={(e) => {
                      onSelectLane(lane);
                      if (editTool === 'pointer' && e.shiftKey) {
                        selectLaneNotes(lane, e.ctrlKey || e.metaKey);
                      }
                    }}
                    title={`Lane ${lane + 1} · ${label}${editTool === 'pointer' ? ' · Shift+click = select row' : ''}`}
                    style={{
                      width: '100%',
                      height: ROW_H,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '0 6px',
                      border: 'none',
                      borderBottom: beatPadsGridRowBorder(),
                      borderLeft: `3px solid ${selected ? accent : 'transparent'}`,
                      background: beatPadsGridFill(lane, selected),
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: 9, fontWeight: 900, color: '#8a9098', flexShrink: 0 }}>
                      {lane + 1}
                    </span>
                    <span
                      style={{
                        fontSize: 8,
                        fontWeight: 700,
                        color: selected ? '#f0fdf4' : '#9aa3b0',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        minWidth: 0,
                      }}
                    >
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div
              ref={hScrollRef}
              className="beat-pads-grid-h-scroll-inner"
              onScroll={syncHScrollFromGrid}
              style={{
                flex: '1 1 auto',
                minWidth: 0,
                overflowX: 'auto',
                overflowY: 'visible',
              }}
            >
            <div
              style={{
                width: gridW,
                minWidth: gridW,
                flexShrink: 0,
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                isolation: 'isolate',
              }}
            >
              <div
                style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 5,
                  background: BEAT_PADS_SURFACE,
                  borderBottom: beatPadsGridRowBorder(),
                }}
              >
                <BeatPadsGridHeader barCount={barCount} cols={cols} gridW={gridW} stepsPerBar={stepsPerBar} />
              </div>

              <div
                ref={gridBodyRef}
                style={{
                  position: 'relative',
                  width: gridW,
                  height: BEAT_PADS_LANE_COUNT * ROW_H,
                  cursor:
                    editTool === 'draw'
                      ? 'crosshair'
                      : editTool === 'erase'
                        ? 'cell'
                        : 'default',
                }}
                onPointerDown={onGridPointerDown}
                onPointerMove={onGridPointerMove}
                onPointerUp={finishPointer}
                onPointerCancel={finishPointer}
              >
                <div
                  ref={playlineElRef}
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: 2,
                    height: '100%',
                    pointerEvents: 'none',
                    zIndex: 2,
                    background: '#7cf4c6',
                    boxShadow: '0 0 6px rgba(124, 244, 198, 0.55)',
                    transform: `translate3d(${playlineStartX}px, 0, 0)`,
                    opacity: transportPlaying ? 1 : 0.45,
                  }}
                />
                {Array.from({ length: BEAT_PADS_LANE_COUNT }, (_, lane) => (
                  <div
                    key={`lane-bg-${lane}`}
                    style={{
                      position: 'absolute',
                      top: lane * ROW_H,
                      left: 0,
                      width: gridW,
                      height: ROW_H,
                      display: 'flex',
                      pointerEvents: 'none',
                      borderTop: beatPadsGridRowBorder(),
                      borderBottom: beatPadsGridRowBorder(),
                      background: beatPadsGridFill(lane, lane === selectedLane),
                    }}
                  >
                    {Array.from({ length: cols }, (_, col) => (
                      <div
                        key={`cell-bg-${lane}-${col}`}
                        style={{
                          width: COL_W,
                          height: ROW_H,
                          flexShrink: 0,
                          borderLeft: `1px solid ${beatPadsGridLineColor(col, stepsPerBar)}`,
                          background: beatPadsGridFill(lane, lane === selectedLane),
                          boxSizing: 'border-box',
                        }}
                      />
                    ))}
                  </div>
                ))}

                {Array.from({ length: BEAT_PADS_LANE_COUNT }, (_, lane) =>
                  (pattern[lane] ?? []).map((note) => {
                    const ref = { lane, id: note.id };
                    const isSelected = selectedRefs.some((r) => noteRefKey(r) === noteRefKey(ref));
                    const isMoving = isSelected && isDraggingSelection && selectionMoveDelta != null;
                    const previewLane = isMoving
                      ? lane + selectionMoveDelta.deltaLane
                      : undefined;
                    const previewStart = isMoving
                      ? note.start + selectionMoveDelta.deltaCol
                      : undefined;
                    const previewLen =
                      resizePreview?.id === note.id && resizePreview.lane === lane
                        ? resizePreview.len
                        : undefined;
                    return (
                      <BeatPadsNoteBlock
                        key={note.id}
                        note={note}
                        lane={lane}
                        selected={isSelected}
                        previewStart={previewStart}
                        previewLane={previewLane}
                        previewLen={previewLen}
                        disabled={disabled}
                        onPointerDownBody={(e) => onNotePointerDown(e, lane, note)}
                        onPointerDownResize={(e) => onResizePointerDown(e, lane, note)}
                        onPointerMove={onGridPointerMove}
                        onPointerUp={finishPointer}
                        onContextMenu={(e) => onNoteContextMenu(e, ref)}
                      />
                    );
                  }),
                )}

                {marquee ? (
                  <div
                    aria-hidden
                    style={{
                      position: 'absolute',
                      top: marquee.laneMin * ROW_H + 1,
                      left: marquee.colMin * COL_W + 1,
                      width: (marquee.colMax - marquee.colMin + 1) * COL_W - 2,
                      height: (marquee.laneMax - marquee.laneMin + 1) * ROW_H - 2,
                      border: '1px dashed rgba(253, 224, 71, 0.85)',
                      background: 'rgba(253, 224, 71, 0.08)',
                      pointerEvents: 'none',
                      zIndex: 4,
                    }}
                  />
                ) : null}
              </div>
            </div>
            </div>
          </div>
        </div>
        <div
          ref={hBarRef}
          className="beat-pads-grid-h-scroll"
          aria-label="Scroll step grid horizontally"
          title="Scroll step grid horizontally"
          onScroll={syncHScrollFromBar}
          style={{
            flexShrink: 0,
            height: BEAT_PADS_GRID_HBAR_H,
            marginLeft: LANE_W,
            overflowX: 'auto',
            overflowY: 'hidden',
            borderTop: '1px solid rgba(124, 244, 198, 0.12)',
            background: BEAT_PADS_SURFACE,
          }}
        >
          <div style={{ width: gridW, height: 1 }} aria-hidden />
        </div>
      </div>

      {contextMenu ? (
        <div
          role="menu"
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 100020,
            minWidth: 140,
            padding: '4px 0',
            borderRadius: 6,
            border: '1px solid rgba(124, 244, 198, 0.35)',
            background: '#1e1e26',
            boxShadow: '0 8px 24px rgba(0,0,0,0.55)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {[
            { label: 'Duplicate', action: duplicateSelected },
            {
              label: 'Delete',
              action: () => {
                applyPattern(beatPadsRemoveNote(pattern, contextMenu.ref.lane, contextMenu.ref.id));
                setSelectedRefs([]);
              },
            },
            {
              label: 'Resize roll →',
              action: () => {
                setEditTool('pointer');
                setSelectedRefs([contextMenu.ref]);
              },
            },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                item.action();
                setContextMenu(null);
              }}
              style={{
                display: 'block',
                width: '100%',
                padding: '6px 12px',
                border: 'none',
                background: 'transparent',
                color: '#e8eef4',
                fontSize: 11,
                fontWeight: 600,
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
