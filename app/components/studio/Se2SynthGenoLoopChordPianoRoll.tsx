'use client';

import { useCallback, useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';
import {
  GENO_LOOP_PIANO_BLACK_KEY_W_PX,
  GENO_LOOP_PIANO_GRID,
  GENO_LOOP_PIANO_KEY_W_PX,
  GENO_LOOP_PIANO_RULER_H_PX,
  GENO_LOOP_PIANO_ROW_H_PX,
  GENO_LOOP_PIANO_WHITE_KEY_W_PX,
  genoIsBlackPianoKey,
  genoLoopPianoDefaultSnapBeats,
  genoLoopPianoKeyLabel,
  genoLoopPianoRollGridHeightPx,
  genoLoopPianoRollDuplicatePlacement,
  genoLoopPianoRollMidisAtBeat,
  genoLoopPianoRollNewNoteId,
  genoLoopPianoRollNotesFromDraft,
  genoLoopPianoRollNotesToDraft,
  genoLoopPianoRollPitchRows,
  genoLoopPianoRollRowIndex,
  genoLoopPianoSnapBeat,
  type GenoLoopPianoRollNote,
} from '@/app/lib/studio/se2SynthGenoLoopPianoRoll';
import {
  GENO_BAR_CHOP_OPTIONS,
  type GenoBarChopQuant,
} from '@/app/lib/studio/se2ChordGenieBarChop';

export type Se2SynthGenoLoopChordPianoRollEditState = {
  hasSelection: boolean;
  canUndo: boolean;
};

export type Se2SynthGenoLoopChordPianoRollHandle = {
  deleteSelected: () => void;
  cutSelected: () => void;
  duplicateSelected: () => void;
  undo: () => void;
  clearAll: () => void;
};

export type Se2SynthGenoLoopChordPianoRollProps = {
  notes: readonly StudioEditor2GenNote[];
  barCount: number;
  beatsPerBar: number;
  accentHex?: string;
  minMidi?: number;
  maxMidi?: number;
  previewBeat?: number | null;
  /** Click/drag ruler or play marker to reposition local preview playhead. */
  onPreviewBeatChange?: (beat: number) => void;
  playheadScrub?: boolean;
  /** Live keyboard audition — lights piano keys with the deck keyboard. */
  previewHeldMidi?: number | null;
  onPianoKeyPreview?: (midi: number) => void;
  onPianoKeyRelease?: () => void;
  disabled?: boolean;
  /** Block note draw/move while still allowing piano-key audition. */
  editLocked?: boolean;
  onNotesChange?: (notes: StudioEditor2GenNote[]) => void;
  onEditStateChange?: (state: Se2SynthGenoLoopChordPianoRollEditState) => void;
  /** Piano-roll ruler bar selected for insert tail (0-based). */
  tailFocusBar?: number | null;
  onTailFocusBar?: (bar: number) => void;
  /** Override default 1/16 snap — filler lane uses 1/4 · 1/8 · 1/16. */
  snapBeatsOverride?: number;
  /** Note Filler — click grid to draw; click notes to erase. */
  gridEditTool?: 'draw' | 'erase';
  /** Draw 16th-note vertical grid lines (bass / groove editors). */
  sixteenthGrid?: boolean;
  /** Chord names per bar (Geno Chord Creator ruler). */
  barChordLabels?: readonly string[];
  /** Per-bar chop quant — same options as Geno B01 loop editor. */
  barChopQuants?: readonly GenoBarChopQuant[];
  onBarChopQuantChange?: (bar: number, chopQuant: GenoBarChopQuant) => void;
  /** Scroll cap for the note grid body. Omit when `scrollGridWithParent` — parent panel scrolls. */
  gridMaxHeightPx?: number;
  /** Let the parent dock scroll the full grid (no inner scrollbar). */
  scrollGridWithParent?: boolean;
};

type DragMode = 'move' | 'resize';

type DragItemSnapshot = {
  id: string;
  startBeat: number;
  startPitch: number;
  startDuration: number;
  startRow: number;
};

type DragState = {
  mode: DragMode;
  pointerId: number;
  x0: number;
  y0: number;
  /** Single-note resize */
  noteId: string;
  startBeat: number;
  startPitch: number;
  startDuration: number;
  startRow: number;
  /** Multi-note move — all selected notes move together */
  multi?: boolean;
  items?: DragItemSnapshot[];
};

type MarqueeState = {
  pointerId: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

type SelectionRect = { left: number; top: number; right: number; bottom: number };

function selectionRectFromPoints(x0: number, y0: number, x1: number, y1: number): SelectionRect {
  return {
    left: Math.min(x0, x1),
    top: Math.min(y0, y1),
    right: Math.max(x0, x1),
    bottom: Math.max(y0, y1),
  };
}

function rectsIntersect(a: SelectionRect, b: SelectionRect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function noteSelectionRect(
  note: GenoLoopPianoRollNote,
  pitchRows: readonly number[],
  gridW: number,
  totalBeats: number,
): SelectionRect | null {
  const row = genoLoopPianoRollRowIndex(note.pitch, pitchRows);
  if (row < 0 || gridW <= 0) return null;
  return {
    left: (note.startBeat / totalBeats) * gridW,
    right: ((note.startBeat + note.durationBeats) / totalBeats) * gridW,
    top: row * GENO_LOOP_PIANO_ROW_H_PX,
    bottom: (row + 1) * GENO_LOOP_PIANO_ROW_H_PX,
  };
}

const RESIZE_HANDLE_W_PX = 10;
const UNDO_STACK_MAX = 48;
const CONTEXT_MENU_Z = 9_999_999;

type ContextMenuState = {
  x: number;
  y: number;
  noteId: string | null;
};

function cloneNotesSnapshot(notes: readonly GenoLoopPianoRollNote[]): GenoLoopPianoRollNote[] {
  return notes.map((n) => ({ ...n }));
}

function GenoLoopPianoRollContextMenu({
  menu,
  canUndo,
  hasNote,
  onClose,
  onCut,
  onDelete,
  onDuplicate,
  onUndo,
}: {
  menu: ContextMenuState;
  canUndo: boolean;
  hasNote: boolean;
  onClose: () => void;
  onCut: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onUndo: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dismiss = (e: Event) => {
      const root = menuRef.current;
      if (!root) return;
      const pe = e as PointerEvent;
      const raw = typeof pe.composedPath === 'function' ? pe.composedPath() : [pe.target ?? pe.currentTarget];
      const inside = raw.some((node) => node instanceof Node && root.contains(node));
      if (inside) return;
      onClose();
    };
    const tid = window.setTimeout(() => {
      document.addEventListener('pointerdown', dismiss, true);
      document.addEventListener('contextmenu', dismiss, true);
    }, 0);
    return () => {
      window.clearTimeout(tid);
      document.removeEventListener('pointerdown', dismiss, true);
      document.removeEventListener('contextmenu', dismiss, true);
    };
  }, [onClose]);

  const items = [
    { label: 'Cut', shortcut: 'Ctrl+X', action: onCut, disabled: !hasNote },
    { label: 'Delete', shortcut: 'Del', action: onDelete, disabled: !hasNote },
    { label: 'Duplicate', shortcut: 'Ctrl+D', action: onDuplicate, disabled: !hasNote },
    { label: 'Undo', shortcut: 'Ctrl+Z', action: onUndo, disabled: !canUndo },
  ];

  const panel = (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Chord note menu"
      className="fixed rounded border py-1 min-w-[188px] select-none"
      style={{
        left: menu.x,
        top: menu.y,
        zIndex: CONTEXT_MENU_Z,
        backgroundColor: '#2a2a32',
        borderColor: '#4a4a58',
        boxShadow: '0 12px 40px rgba(0,0,0,0.92), 0 0 0 1px rgba(255,255,255,0.12)',
        color: '#ffffff',
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          aria-disabled={item.disabled}
          disabled={item.disabled}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (item.disabled) return;
            item.action();
            onClose();
          }}
          className={`w-full px-4 py-2 text-left text-sm flex justify-between items-center border-none ${
            item.disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer hover:bg-[#3d3d48]'
          }`}
          style={{ background: 'transparent', color: '#ffffff' }}
        >
          <span className="font-semibold">{item.label}</span>
          <span className="text-xs ml-4 tabular-nums opacity-80">{item.shortcut}</span>
        </button>
      ))}
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(panel, document.body) : null;
}

const SE2_PLAYHEAD_W_PX = 2;
const SE2_PLAYHEAD_GRIP_W_PX = 16;

/** Matches Studio Editor 2 timeline / piano-roll playhead. */
function PreviewPlayMarker({
  leftPct,
  scrub,
  onScrubStart,
}: {
  leftPct: number;
  scrub?: boolean;
  onScrubStart?: (e: React.PointerEvent) => void;
}) {
  const gripW = scrub ? SE2_PLAYHEAD_GRIP_W_PX : SE2_PLAYHEAD_W_PX;
  return (
    <div
      className="absolute top-0 bottom-0 z-30 flex justify-center select-none"
      style={{
        left: `${leftPct}%`,
        width: gripW,
        marginLeft: -gripW / 2,
        pointerEvents: scrub ? 'auto' : 'none',
        cursor: scrub ? 'ew-resize' : undefined,
        touchAction: 'none',
        willChange: 'transform',
      }}
      onPointerDown={scrub ? onScrubStart : undefined}
      aria-hidden={!scrub}
      aria-label={scrub ? 'Playhead — drag to reposition' : undefined}
    >
      <div
        data-playhead-line
        className="h-full shrink-0 rounded-[1px] pointer-events-none"
        style={{
          width: SE2_PLAYHEAD_W_PX,
          background: 'linear-gradient(180deg, #9fffd8 0%, #5ee9b4 50%, #34d399 100%)',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.4), 0 0 10px rgba(52,211,153,0.4)',
        }}
      />
    </div>
  );
}

function PianoKeyCell({
  midi,
  lit,
  accentHex,
  disabled,
  onPointerDown,
  onPointerEnter,
}: {
  midi: number;
  lit: boolean;
  accentHex: string;
  disabled?: boolean;
  onPointerDown?: (midi: number) => void;
  onPointerEnter?: (midi: number) => void;
}) {
  const isBlack = genoIsBlackPianoKey(midi);
  const pc = ((midi % 12) + 12) % 12;
  const isC = pc === 0;
  const label = genoLoopPianoKeyLabel(midi);
  const interactive = Boolean(onPointerDown) && !disabled;

  return (
    <div
      className="relative shrink-0 border-r"
      style={{
        width: GENO_LOOP_PIANO_KEY_W_PX,
        height: GENO_LOOP_PIANO_ROW_H_PX,
        background: '#050507',
        borderColor: lit ? `${accentHex}55` : 'rgba(255,255,255,0.06)',
      }}
    >
      <button
        type="button"
        disabled={!interactive}
        onPointerDown={(e) => {
          if (!interactive) return;
          e.preventDefault();
          e.stopPropagation();
          e.currentTarget.setPointerCapture(e.pointerId);
          onPointerDown?.(midi);
        }}
        onPointerEnter={() => {
          if (interactive) onPointerEnter?.(midi);
        }}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: isBlack ? GENO_LOOP_PIANO_BLACK_KEY_W_PX : GENO_LOOP_PIANO_WHITE_KEY_W_PX,
          padding: 0,
          margin: 0,
          cursor: interactive ? 'pointer' : 'default',
          touchAction: 'none',
          background: lit
            ? isBlack
              ? `linear-gradient(180deg, ${accentHex}ee 0%, #12121a 100%)`
              : `linear-gradient(180deg, ${accentHex} 0%, ${accentHex}bb 100%)`
            : isBlack
              ? 'linear-gradient(180deg, #25252e 0%, #0e0e14 100%)'
              : 'linear-gradient(180deg, #e5e5ec 0%, #b6b6c0 100%)',
          boxShadow: lit
            ? `inset 0 -2px 6px ${accentHex}88, 0 0 8px ${accentHex}55`
            : isBlack
              ? 'inset 0 -1px 1px rgba(0,0,0,0.6), inset -1px 0 1px rgba(0,0,0,0.4)'
              : 'inset 0 -1px 1px rgba(0,0,0,0.18), inset -1px 0 1px rgba(0,0,0,0.10)',
          borderRadius: '0 3px 3px 0',
          borderTop: lit ? `1px solid ${accentHex}aa` : isBlack ? 'none' : '1px solid rgba(255,255,255,0.45)',
          borderBottom: lit
            ? `1px solid ${accentHex}88`
            : isBlack
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
          color: lit ? (isBlack ? '#f0f0f8' : '#0a0c12') : isBlack ? '#9a9aa6' : '#1a1a22',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          letterSpacing: 0.2,
          transform: lit ? 'translateY(1px)' : 'none',
        }}
      >
        {label}
      </button>
    </div>
  );
}

function mergeNotesFromDraft(
  incoming: GenoLoopPianoRollNote[],
  prev: GenoLoopPianoRollNote[],
): GenoLoopPianoRollNote[] {
  return incoming.map((n) => {
    const match = prev.find(
      (p) =>
        p.pitch === n.pitch
        && Math.abs(p.startBeat - n.startBeat) < 0.001
        && Math.abs(p.durationBeats - n.durationBeats) < 0.001,
    );
    return match ? { ...n, id: match.id } : n;
  });
}

function notesEqual(a: readonly GenoLoopPianoRollNote[], b: readonly GenoLoopPianoRollNote[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i]!;
    const y = b[i]!;
    if (
      x.pitch !== y.pitch
      || Math.abs(x.startBeat - y.startBeat) > 0.0001
      || Math.abs(x.durationBeats - y.durationBeats) > 0.0001
      || x.velocity !== y.velocity
    ) {
      return false;
    }
  }
  return true;
}

export const Se2SynthGenoLoopChordPianoRoll = forwardRef<
  Se2SynthGenoLoopChordPianoRollHandle,
  Se2SynthGenoLoopChordPianoRollProps
>(function Se2SynthGenoLoopChordPianoRoll(
  {
  notes,
  barCount,
  beatsPerBar,
  accentHex = '#00E5CC',
  minMidi = 48,
  maxMidi = 72,
  previewBeat = null,
  onPreviewBeatChange,
  playheadScrub = false,
  previewHeldMidi = null,
  onPianoKeyPreview,
  onPianoKeyRelease,
  disabled = false,
  editLocked = false,
  onNotesChange,
  onEditStateChange,
  tailFocusBar = null,
  onTailFocusBar,
  snapBeatsOverride,
  gridEditTool,
  sixteenthGrid = false,
  barChordLabels,
  barChopQuants,
  onBarChopQuantChange,
  gridMaxHeightPx = 340,
  scrollGridWithParent = false,
  },
  ref,
) {
  const editable = Boolean(onNotesChange) && !disabled && !editLocked;
  const gridPaint = gridEditTool === 'draw' || gridEditTool === 'erase';
  const gridPlayheadScrub = Boolean(playheadScrub && onPreviewBeatChange && !gridPaint);
  const gridRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const notesRef = useRef<GenoLoopPianoRollNote[]>([]);
  const dirtyRef = useRef(false);
  const undoStackRef = useRef<GenoLoopPianoRollNote[][]>([]);
  const clipboardRef = useRef<GenoLoopPianoRollNote[]>([]);
  const marqueeRef = useRef<MarqueeState | null>(null);
  const pianoKeyDownRef = useRef(false);
  const onPianoKeyReleaseRef = useRef(onPianoKeyRelease);
  onPianoKeyReleaseRef.current = onPianoKeyRelease;

  useEffect(() => {
    if (!onPianoKeyPreview) return;
    const end = () => {
      pianoKeyDownRef.current = false;
      onPianoKeyReleaseRef.current?.();
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, [onPianoKeyPreview]);

  const playPianoKey = useCallback(
    (midi: number) => {
      if (disabled || !onPianoKeyPreview) return;
      pianoKeyDownRef.current = true;
      onPianoKeyPreview(midi);
    },
    [disabled, onPianoKeyPreview],
  );

  const glidePianoKey = useCallback(
    (midi: number) => {
      if (!pianoKeyDownRef.current) return;
      playPianoKey(midi);
    },
    [playPianoKey],
  );

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [marqueeBox, setMarqueeBox] = useState<SelectionRect | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [localNotes, setLocalNotes] = useState<GenoLoopPianoRollNote[]>(() =>
    genoLoopPianoRollNotesFromDraft(notes),
  );

  const incomingNotes = useMemo(() => genoLoopPianoRollNotesFromDraft(notes), [notes]);

  useEffect(() => {
    if (dragRef.current) return;
    setLocalNotes((prev) => mergeNotesFromDraft(incomingNotes, prev));
  }, [incomingNotes]);

  useEffect(() => {
    notesRef.current = localNotes;
  }, [localNotes]);

  const pitchRows = useMemo(
    () => genoLoopPianoRollPitchRows(localNotes, minMidi, maxMidi),
    [localNotes, minMidi, maxMidi],
  );
  const totalBeats = Math.max(1, barCount * beatsPerBar);
  const gridH = genoLoopPianoRollGridHeightPx(pitchRows.length);
  const snapBeats = snapBeatsOverride ?? genoLoopPianoDefaultSnapBeats(beatsPerBar);

  const playheadPct = useMemo(() => {
    if (previewBeat == null || totalBeats <= 0) return null;
    const clamped = ((previewBeat % totalBeats) + totalBeats) % totalBeats;
    return (clamped / totalBeats) * 100;
  }, [previewBeat, totalBeats]);

  const barPct = 100 / Math.max(1, barCount);
  const beatPct = 100 / totalBeats;
  const rulerH =
    barChordLabels && barChordLabels.length > 0
      ? GENO_LOOP_PIANO_RULER_H_PX + 16
      : GENO_LOOP_PIANO_RULER_H_PX;

  const litMidiSet = useMemo(() => {
    const set = new Set<number>();
    if (previewBeat != null) {
      for (const midi of genoLoopPianoRollMidisAtBeat(localNotes, previewBeat)) {
        set.add(midi);
      }
    }
    if (previewHeldMidi != null) set.add(Math.round(previewHeldMidi));
    return set;
  }, [localNotes, previewBeat, previewHeldMidi]);

  const clampNote = useCallback(
    (n: GenoLoopPianoRollNote): GenoLoopPianoRollNote => {
      const startBeat = genoLoopPianoSnapBeat(
        Math.max(0, Math.min(totalBeats - snapBeats, n.startBeat)),
        snapBeats,
      );
      const maxDur = Math.max(snapBeats, totalBeats - startBeat);
      const durationBeats = genoLoopPianoSnapBeat(
        Math.max(snapBeats, Math.min(maxDur, n.durationBeats)),
        snapBeats,
      );
      const rowIdx = pitchRows.indexOf(Math.round(n.pitch));
      const pitch =
        rowIdx >= 0
          ? pitchRows[rowIdx]!
          : Math.max(minMidi, Math.min(maxMidi, Math.round(n.pitch)));
      return { ...n, startBeat, durationBeats, pitch };
    },
    [maxMidi, minMidi, pitchRows, snapBeats, totalBeats],
  );

  const replaceNotes = useCallback(
    (updates: Map<string, GenoLoopPianoRollNote>) => {
      if (updates.size === 0) return;
      setLocalNotes((prev) =>
        prev.map((n) => {
          const next = updates.get(n.id);
          return next ?? n;
        }),
      );
      dirtyRef.current = true;
    },
    [],
  );

  const replaceNote = useCallback(
    (next: GenoLoopPianoRollNote) => {
      replaceNotes(new Map([[next.id, next]]));
    },
    [replaceNotes],
  );

  const isNoteSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  const selectOnly = useCallback((id: string) => {
    setSelectedIds(new Set([id]));
  }, []);

  const toggleNoteSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllNotes = useCallback(() => {
    setSelectedIds(new Set(localNotes.map((n) => n.id)));
  }, [localNotes]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const notesInMarquee = useCallback(
    (rect: SelectionRect): string[] => {
      const el = gridRef.current;
      if (!el) return [];
      const gridW = el.getBoundingClientRect().width;
      const ids: string[] = [];
      for (const n of notesRef.current) {
        const nr = noteSelectionRect(n, pitchRows, gridW, totalBeats);
        if (nr && rectsIntersect(rect, nr)) ids.push(n.id);
      }
      return ids;
    },
    [pitchRows, totalBeats],
  );

  const commitNotes = useCallback(
    (next: GenoLoopPianoRollNote[]) => {
      setLocalNotes(next);
      onNotesChange?.(genoLoopPianoRollNotesToDraft(next));
      dirtyRef.current = false;
    },
    [onNotesChange],
  );

  const pushUndoSnapshot = useCallback((snapshot: readonly GenoLoopPianoRollNote[]) => {
    undoStackRef.current.push(cloneNotesSnapshot(snapshot));
    if (undoStackRef.current.length > UNDO_STACK_MAX) undoStackRef.current.shift();
    setCanUndo(true);
  }, []);

  const applyNotes = useCallback(
    (next: GenoLoopPianoRollNote[], snapshot?: readonly GenoLoopPianoRollNote[]) => {
      if (snapshot) pushUndoSnapshot(snapshot);
      commitNotes(next);
    },
    [commitNotes, pushUndoSnapshot],
  );

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const openContextMenu = useCallback(
    (e: React.MouseEvent, noteId: string | null) => {
      if (!editable) return;
      e.preventDefault();
      e.stopPropagation();
      if (noteId) {
        if (!selectedIds.has(noteId)) selectOnly(noteId);
      }
      setContextMenu({ x: e.clientX, y: e.clientY, noteId });
    },
    [editable, selectOnly, selectedIds],
  );

  const deleteNotesByIds = useCallback(
    (ids: Iterable<string>) => {
      if (!editable) return;
      const drop = new Set(ids);
      if (drop.size === 0) return;
      const snapshot = notesRef.current;
      const next = snapshot.filter((n) => !drop.has(n.id));
      if (next.length === snapshot.length) return;
      setSelectedIds((prev) => new Set([...prev].filter((id) => !drop.has(id))));
      applyNotes(next, snapshot);
    },
    [applyNotes, editable],
  );

  const deleteNoteById = useCallback(
    (noteId: string) => {
      deleteNotesByIds([noteId]);
    },
    [deleteNotesByIds],
  );

  const cutNotesByIds = useCallback(
    (ids: Iterable<string>) => {
      if (!editable) return;
      const drop = new Set(ids);
      if (drop.size === 0) return;
      const snapshot = notesRef.current;
      const cut = snapshot.filter((n) => drop.has(n.id));
      if (cut.length === 0) return;
      clipboardRef.current = cut.map((n) => ({ ...n }));
      const next = snapshot.filter((n) => !drop.has(n.id));
      setSelectedIds(new Set());
      applyNotes(next, snapshot);
    },
    [applyNotes, editable],
  );

  const cutNoteById = useCallback(
    (noteId: string) => {
      cutNotesByIds([noteId]);
    },
    [cutNotesByIds],
  );

  const duplicateNotesByIds = useCallback(
    (ids: Iterable<string>) => {
      if (!editable) return;
      const pick = new Set(ids);
      if (pick.size === 0) return;
      const snapshot = notesRef.current;
      const sources = snapshot.filter((n) => pick.has(n.id));
      if (sources.length === 0) return;
      const dups: GenoLoopPianoRollNote[] = [];
      const newSel = new Set<string>();
      for (const src of sources) {
        const placement = genoLoopPianoRollDuplicatePlacement(
          src,
          [...snapshot, ...dups],
          snapBeats,
          totalBeats,
          beatsPerBar,
        );
        const dup = clampNote({
          ...src,
          id: genoLoopPianoRollNewNoteId(),
          startBeat: placement.startBeat,
          pitch: placement.pitch,
          label: src.label,
        });
        dups.push(dup);
        newSel.add(dup.id);
      }
      setSelectedIds(newSel);
      applyNotes([...snapshot, ...dups], snapshot);
    },
    [applyNotes, beatsPerBar, clampNote, editable, snapBeats, totalBeats],
  );

  const duplicateNoteById = useCallback(
    (noteId: string) => {
      duplicateNotesByIds([noteId]);
    },
    [duplicateNotesByIds],
  );

  const undoLast = useCallback(() => {
    if (!editable) return;
    const prev = undoStackRef.current.pop();
    if (!prev) {
      setCanUndo(false);
      return;
    }
    setCanUndo(undoStackRef.current.length > 0);
    commitNotes(prev);
    clearSelection();
  }, [clearSelection, commitNotes, editable]);

  const pxPerBeat = useCallback(() => {
    const el = gridRef.current;
    if (!el) return 1;
    const w = el.getBoundingClientRect().width;
    return Math.max(1, w / totalBeats);
  }, [totalBeats]);

  const beatFromClientX = useCallback(
    (clientX: number) => {
      const el = gridRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      const beat = (x / Math.max(1, rect.width)) * totalBeats;
      return genoLoopPianoSnapBeat(Math.max(0, Math.min(totalBeats, beat)), snapBeats);
    },
    [snapBeats, totalBeats],
  );

  const beginPlayheadScrub = useCallback(
    (e: React.PointerEvent) => {
      if (!onPreviewBeatChange || !playheadScrub || e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest('select, button, input, textarea, [data-ruler-interactive]')) return;
      e.preventDefault();
      e.stopPropagation();
      onPreviewBeatChange(beatFromClientX(e.clientX));
      e.currentTarget.setPointerCapture(e.pointerId);

      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId) return;
        onPreviewBeatChange(beatFromClientX(ev.clientX));
      };
      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId) return;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        try {
          e.currentTarget.releasePointerCapture(ev.pointerId);
        } catch {
          /* already released */
        }
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [beatFromClientX, onPreviewBeatChange, playheadScrub],
  );

  const endDrag = useCallback(
    (snapshotBefore: GenoLoopPianoRollNote[]) => {
      dragRef.current = null;
      if (dirtyRef.current && !notesEqual(snapshotBefore, notesRef.current)) {
        pushUndoSnapshot(snapshotBefore);
        commitNotes(notesRef.current);
      } else {
        dirtyRef.current = false;
      }
    },
    [commitNotes, pushUndoSnapshot],
  );

  const beginNoteDrag = useCallback(
    (mode: DragMode, note: GenoLoopPianoRollNote, e: React.PointerEvent) => {
      if (!editable || e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      const multiMove =
        mode === 'move' && selectedIds.has(note.id) && selectedIds.size > 1;
      if (!multiMove) {
        if (e.shiftKey) toggleNoteSelection(note.id);
        else selectOnly(note.id);
      }

      const startRow = pitchRows.indexOf(note.pitch);
      const snapshotBefore = notesRef.current.map((n) => ({ ...n }));
      dirtyRef.current = false;

      const items: DragItemSnapshot[] = multiMove
        ? notesRef.current
            .filter((n) => selectedIds.has(n.id))
            .map((n) => ({
              id: n.id,
              startBeat: n.startBeat,
              startPitch: n.pitch,
              startDuration: n.durationBeats,
              startRow: Math.max(0, pitchRows.indexOf(n.pitch)),
            }))
        : [
            {
              id: note.id,
              startBeat: note.startBeat,
              startPitch: note.pitch,
              startDuration: note.durationBeats,
              startRow: startRow >= 0 ? startRow : 0,
            },
          ];

      dragRef.current = {
        mode,
        noteId: note.id,
        pointerId: e.pointerId,
        startBeat: note.startBeat,
        startPitch: note.pitch,
        startDuration: note.durationBeats,
        startRow: startRow >= 0 ? startRow : 0,
        x0: e.clientX,
        y0: e.clientY,
        multi: multiMove,
        items,
      };
      e.currentTarget.setPointerCapture(e.pointerId);

      const onMove = (ev: PointerEvent) => {
        const drag = dragRef.current;
        if (!drag || ev.pointerId !== drag.pointerId) return;

        const dx = ev.clientX - drag.x0;
        const dy = ev.clientY - drag.y0;
        const beatDelta = dx / pxPerBeat();
        const pitchDelta = Math.round(dy / GENO_LOOP_PIANO_ROW_H_PX);
        const moveItems = drag.items ?? [];

        if (drag.mode === 'resize') {
          const current = notesRef.current.find((n) => n.id === drag.noteId);
          if (!current) return;
          const anchor = moveItems[0];
          if (!anchor) return;
          const rawDur = Math.max(snapBeats, anchor.startDuration + beatDelta);
          const next = clampNote({ ...current, durationBeats: rawDur });
          if (Math.abs(next.durationBeats - current.durationBeats) < 0.0001) return;
          replaceNote(next);
          return;
        }

        const updates = new Map<string, GenoLoopPianoRollNote>();
        for (const item of moveItems) {
          const current = notesRef.current.find((n) => n.id === item.id);
          if (!current) continue;
          const newRow = Math.max(
            0,
            Math.min(pitchRows.length - 1, item.startRow + pitchDelta),
          );
          const newPitch = pitchRows[newRow] ?? current.pitch;
          const newStart = genoLoopPianoSnapBeat(item.startBeat + beatDelta, snapBeats);
          const next = clampNote({ ...current, startBeat: newStart, pitch: newPitch });
          if (
            Math.abs(next.startBeat - current.startBeat) < 0.0001
            && next.pitch === current.pitch
          ) {
            continue;
          }
          updates.set(item.id, next);
        }
        if (updates.size > 0) replaceNotes(updates);
      };

      const onUp = (ev: PointerEvent) => {
        if (dragRef.current?.pointerId !== ev.pointerId) return;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        try {
          e.currentTarget.releasePointerCapture(ev.pointerId);
        } catch {
          /* already released */
        }
        endDrag(snapshotBefore);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [
      clampNote,
      editable,
      endDrag,
      pitchRows,
      pxPerBeat,
      replaceNote,
      replaceNotes,
      selectOnly,
      selectedIds,
      snapBeats,
      toggleNoteSelection,
    ],
  );

  const beginMarqueeSelect = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!editable || e.button !== 0 || gridPaint) return;
      const el = gridRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x0 = e.clientX - rect.left;
      const y0 = e.clientY - rect.top;
      marqueeRef.current = {
        pointerId: e.pointerId,
        x0,
        y0,
        x1: x0,
        y1: y0,
      };
      setMarqueeBox(selectionRectFromPoints(x0, y0, x0, y0));
      e.currentTarget.setPointerCapture(e.pointerId);

      const onMove = (ev: PointerEvent) => {
        const m = marqueeRef.current;
        if (!m || ev.pointerId !== m.pointerId) return;
        const r = el.getBoundingClientRect();
        m.x1 = ev.clientX - r.left;
        m.y1 = ev.clientY - r.top;
        setMarqueeBox(selectionRectFromPoints(m.x0, m.y0, m.x1, m.y1));
      };

      const onUp = (ev: PointerEvent) => {
        const m = marqueeRef.current;
        if (!m || ev.pointerId !== m.pointerId) return;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        try {
          e.currentTarget.releasePointerCapture(ev.pointerId);
        } catch {
          /* already released */
        }
        marqueeRef.current = null;
        setMarqueeBox(null);
        const box = selectionRectFromPoints(m.x0, m.y0, m.x1, m.y1);
        const ids = notesInMarquee(box);
        if (ev.shiftKey) {
          setSelectedIds((prev) => new Set([...prev, ...ids]));
        } else {
          setSelectedIds(new Set(ids));
        }
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [editable, gridPaint, notesInMarquee],
  );

  const deleteSelected = useCallback(() => {
    if (!editable || selectedIds.size === 0) return;
    deleteNotesByIds(selectedIds);
  }, [deleteNotesByIds, editable, selectedIds]);

  const cutSelected = useCallback(() => {
    if (!editable || selectedIds.size === 0) return;
    cutNotesByIds(selectedIds);
  }, [cutNotesByIds, editable, selectedIds]);

  const duplicateSelected = useCallback(() => {
    if (!editable || selectedIds.size === 0) return;
    duplicateNotesByIds(selectedIds);
  }, [duplicateNotesByIds, editable, selectedIds]);

  const clearAll = useCallback(() => {
    if (!editable) return;
    const snapshot = notesRef.current;
    if (snapshot.length === 0) return;
    clearSelection();
    applyNotes([], snapshot);
  }, [applyNotes, clearSelection, editable]);

  const placeGridNote = useCallback(
    (clientX: number, clientY: number) => {
      if (!editable || gridEditTool !== 'draw') return;
      const el = gridRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
      const beat = genoLoopPianoSnapBeat((x / rect.width) * totalBeats, snapBeats);
      const rowIdx = Math.floor(y / GENO_LOOP_PIANO_ROW_H_PX);
      const pitch = pitchRows[rowIdx];
      if (pitch == null) return;
      const overlaps = notesRef.current.some(
        (n) =>
          n.pitch === pitch
          && beat >= n.startBeat - 1e-6
          && beat < n.startBeat + n.durationBeats - 1e-6,
      );
      if (overlaps) return;
      const snapshot = notesRef.current.map((n) => ({ ...n }));
      const note = clampNote({
        id: genoLoopPianoRollNewNoteId(),
        pitch,
        startBeat: beat,
        durationBeats: snapBeats,
        velocity: 76,
        label: genoLoopPianoKeyLabel(pitch),
      });
      setSelectedIds(new Set([note.id]));
      applyNotes([...snapshot, note], snapshot);
    },
    [applyNotes, clampNote, editable, gridEditTool, pitchRows, snapBeats, totalBeats],
  );

  const nudgeSelected = useCallback(
    (beatDelta: number, rowDelta: number) => {
      if (!editable || selectedIds.size === 0) return;
      const snapshot = notesRef.current;
      const updates = new Map<string, GenoLoopPianoRollNote>();
      for (const n of snapshot) {
        if (!selectedIds.has(n.id)) continue;
        const row = pitchRows.indexOf(n.pitch);
        const newRow = Math.max(0, Math.min(pitchRows.length - 1, row + rowDelta));
        const newPitch = pitchRows[newRow] ?? n.pitch;
        const newStart = genoLoopPianoSnapBeat(n.startBeat + beatDelta, snapBeats);
        updates.set(n.id, clampNote({ ...n, startBeat: newStart, pitch: newPitch }));
      }
      if (updates.size === 0) return;
      replaceNotes(updates);
      pushUndoSnapshot(snapshot);
      commitNotes(
        snapshot.map((n) => updates.get(n.id) ?? n),
      );
    },
    [clampNote, commitNotes, editable, pitchRows, pushUndoSnapshot, replaceNotes, selectedIds, snapBeats],
  );

  const handleGridPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      const noteEl = (e.target as HTMLElement).closest('[data-geno-loop-note]');
      if (
        playheadScrub
        && onPreviewBeatChange
        && !noteEl
        && !e.shiftKey
        && gridEditTool !== 'draw'
        && gridEditTool !== 'erase'
      ) {
        if (editable) clearSelection();
        beginPlayheadScrub(e);
        return;
      }
      if (!editable) return;
      if (gridEditTool === 'erase' && noteEl) {
        const noteId = noteEl.getAttribute('data-note-id');
        if (noteId) {
          e.preventDefault();
          e.stopPropagation();
          deleteNoteById(noteId);
        }
        return;
      }
      if (gridEditTool === 'draw' && !noteEl) {
        e.preventDefault();
        placeGridNote(e.clientX, e.clientY);
        return;
      }
      if (!noteEl) {
        if (!e.shiftKey) clearSelection();
        beginMarqueeSelect(e);
      }
    },
    [beginMarqueeSelect, beginPlayheadScrub, clearSelection, deleteNoteById, editable, gridEditTool, onPreviewBeatChange, placeGridNote, playheadScrub],
  );

  useImperativeHandle(
    ref,
    () => ({
      deleteSelected,
      cutSelected,
      duplicateSelected,
      undo: undoLast,
      clearAll,
    }),
    [clearAll, cutSelected, deleteSelected, duplicateSelected, undoLast],
  );

  useEffect(() => {
    onEditStateChange?.({
      hasSelection: selectedIds.size > 0,
      canUndo,
    });
  }, [canUndo, onEditStateChange, selectedIds]);

  const contextNoteId = contextMenu?.noteId ?? (selectedIds.size === 1 ? [...selectedIds][0]! : null);

  useEffect(() => {
    if (!editable) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target;
      if (
        target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target instanceof HTMLSelectElement
        || (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undoLast();
        return;
      }
      if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        selectAllNotes();
        return;
      }
      if (mod && e.key.toLowerCase() === 'd' && selectedIds.size > 0) {
        e.preventDefault();
        duplicateSelected();
        return;
      }
      if (mod && e.key.toLowerCase() === 'x' && selectedIds.size > 0) {
        e.preventDefault();
        cutSelected();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.size === 0) return;
        e.preventDefault();
        deleteSelected();
        return;
      }
      if (selectedIds.size === 0) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        nudgeSelected(-snapBeats, 0);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        nudgeSelected(snapBeats, 0);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        nudgeSelected(0, 1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        nudgeSelected(0, -1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    cutSelected,
    deleteSelected,
    duplicateSelected,
    editable,
    nudgeSelected,
    selectAllNotes,
    selectedIds,
    snapBeats,
    undoLast,
  ]);

  return (
    <div
      className="overflow-hidden w-full"
      style={{ background: '#06060a' }}
      onContextMenu={(e) => openContextMenu(e, null)}
    >
      <div className="flex w-full border-b" style={{ borderColor: '#1a1a24' }}>
        <div
          className="shrink-0 border-r"
          style={{
            width: GENO_LOOP_PIANO_KEY_W_PX,
            height: rulerH,
            background: '#050507',
            borderColor: 'rgba(255,255,255,0.06)',
          }}
        />
        <div
          className="relative flex-1 min-w-0"
          style={{ height: rulerH, background: '#0a0a10' }}
          onPointerDownCapture={playheadScrub && onPreviewBeatChange ? beginPlayheadScrub : undefined}
          title={playheadScrub ? 'Click or drag ruler to position playhead' : undefined}
        >
          {Array.from({ length: barCount }, (_, bar) => {
            const selected = tailFocusBar === bar;
            const chordLabel = barChordLabels?.[bar]?.trim();
            const chopQuant = barChopQuants?.[bar] ?? 'whole';
            const showChop = typeof onBarChopQuantChange === 'function';
            return (
              <div
                key={`ruler-${bar}`}
                className="absolute top-0 bottom-0 flex items-stretch border-l overflow-hidden"
                style={{
                  left: `${bar * barPct}%`,
                  width: `${barPct}%`,
                  borderColor: selected ? `${accentHex}88` : GENO_LOOP_PIANO_GRID.barLine,
                  background: selected ? `${accentHex}18` : 'transparent',
                  boxShadow: selected ? `inset 0 0 0 1px ${accentHex}55` : undefined,
                }}
              >
                <button
                  type="button"
                  disabled={disabled || !onTailFocusBar}
                  onClick={() => onTailFocusBar?.(bar)}
                  className="flex-1 min-w-0 flex flex-col items-start justify-center pl-1 pr-0.5 border-0 transition-all disabled:cursor-default overflow-hidden"
                  style={{
                    background: 'transparent',
                    cursor: onTailFocusBar && !disabled ? 'pointer' : 'default',
                  }}
                  title={
                    chordLabel
                      ? `Bar ${bar + 1}: ${chordLabel}`
                      : onTailFocusBar
                        ? `Bar ${bar + 1} — passing / transitional chords`
                        : undefined
                  }
                >
                  <span
                    className="text-[7px] font-bold uppercase tracking-widest font-mono leading-none"
                    style={{
                      color: selected ? accentHex : '#c8c8d0',
                      opacity: selected ? 1 : 0.35,
                    }}
                  >
                    {bar + 1}
                  </span>
                  {chordLabel ? (
                    <span
                      className="text-[8px] font-black truncate w-full leading-tight mt-0.5"
                      style={{ color: selected ? accentHex : '#d8e8ff', paddingRight: showChop ? 2 : 0 }}
                    >
                      {chordLabel}
                    </span>
                  ) : null}
                </button>
                {showChop ? (
                  <select
                    data-ruler-interactive
                    disabled={disabled || !chordLabel || chordLabel === '—'}
                    value={chopQuant}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) =>
                      onBarChopQuantChange?.(bar, e.target.value as GenoBarChopQuant)
                    }
                    className="relative z-10 shrink-0 self-center text-[7px] font-bold outline-none cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                    style={{
                      width: 28,
                      height: 20,
                      marginRight: 2,
                      padding: '0 1px',
                      borderRadius: 2,
                      border: '1px solid #353545',
                      background: '#0a0a12',
                      color: chopQuant === 'whole' ? '#6a6a78' : accentHex,
                      textAlign: 'center',
                      pointerEvents: 'auto',
                    }}
                    title="Chop this bar — whole vs repeated hits (½ · ¼ · ⅛ · 16 · 32)"
                    aria-label={`Bar ${bar + 1} chord chop`}
                  >
                    {GENO_BAR_CHOP_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id} title={opt.title}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div
        className={
          scrollGridWithParent
            ? 'flex w-full overflow-x-hidden'
            : 'flex w-full overflow-y-auto overflow-x-hidden'
        }
        style={scrollGridWithParent ? undefined : { maxHeight: gridMaxHeightPx }}
      >
        <div
          className="shrink-0 sticky left-0 z-20"
          style={{ width: GENO_LOOP_PIANO_KEY_W_PX, background: '#050507' }}
        >
          {pitchRows.map((midi) => (
            <PianoKeyCell
              key={midi}
              midi={midi}
              lit={litMidiSet.has(midi)}
              accentHex={accentHex}
              disabled={disabled}
              onPointerDown={onPianoKeyPreview ? playPianoKey : undefined}
              onPointerEnter={onPianoKeyPreview ? glidePianoKey : undefined}
            />
          ))}
        </div>

        <div
          ref={gridRef}
          tabIndex={editable ? 0 : undefined}
          className="relative flex-1 min-w-0 outline-none"
          style={{ height: gridH, touchAction: 'none', cursor: gridPaint ? (gridEditTool === 'erase' ? 'cell' : 'crosshair') : gridPlayheadScrub ? 'pointer' : editable ? 'crosshair' : undefined }}
          title={
            gridEditTool === 'draw'
              ? 'Draw mode — click empty cells to place notes · drag notes to move or resize'
              : gridPlayheadScrub
                ? 'Select mode — click or drag empty grid to move playhead · Shift+drag to box-select'
                : undefined
          }
          onPointerDown={handleGridPointerDown}
          onContextMenu={(e) => {
            if (!editable) return;
            e.preventDefault();
            e.stopPropagation();
            if (e.target === e.currentTarget) {
              if (!e.shiftKey) clearSelection();
              setContextMenu({ x: e.clientX, y: e.clientY, noteId: null });
            }
          }}
        >
          {pitchRows.map((midi, rowIdx) => {
            const isBlack = genoIsBlackPianoKey(midi);
            const pc = ((midi % 12) + 12) % 12;
            const isC = pc === 0;
            const rowLit = previewHeldMidi != null && Math.round(previewHeldMidi) === midi;
            return (
              <div
                key={`row-${midi}`}
                className="absolute left-0 right-0"
                style={{
                  top: rowIdx * GENO_LOOP_PIANO_ROW_H_PX,
                  height: GENO_LOOP_PIANO_ROW_H_PX,
                  background: rowLit
                    ? `${accentHex}18`
                    : isBlack
                      ? GENO_LOOP_PIANO_GRID.rowBlack
                      : GENO_LOOP_PIANO_GRID.rowWhite,
                  borderBottom: `1px solid ${isC ? GENO_LOOP_PIANO_GRID.rowBorderC : GENO_LOOP_PIANO_GRID.rowBorder}`,
                  boxShadow: rowLit ? `inset 0 0 0 1px ${accentHex}44` : undefined,
                }}
              />
            );
          })}

          {Array.from({ length: barCount }, (_, bar) => (
            <div
              key={`bar-shade-${bar}`}
              className="absolute top-0 bottom-0 pointer-events-none"
              style={{
                left: `${bar * barPct}%`,
                width: `${barPct}%`,
                background: bar % 2 === 0 ? GENO_LOOP_PIANO_GRID.barFillA : GENO_LOOP_PIANO_GRID.barFillB,
              }}
            />
          ))}

          {Array.from({ length: barCount }, (_, bar) => (
            <div
              key={`bar-line-${bar}`}
              className="absolute top-0 bottom-0 border-l pointer-events-none"
              style={{
                left: `${bar * barPct}%`,
                borderColor: GENO_LOOP_PIANO_GRID.barLine,
              }}
            />
          ))}

          {Array.from({ length: totalBeats }, (_, beat) => {
            if (beat === 0 || beat % beatsPerBar === 0) return null;
            return (
              <div
                key={`beat-${beat}`}
                className="absolute top-0 bottom-0 border-l pointer-events-none"
                style={{
                  left: `${beat * beatPct}%`,
                  borderColor: GENO_LOOP_PIANO_GRID.beatLine,
                }}
              />
            );
          })}

          {sixteenthGrid
            ? Array.from({ length: barCount * 16 }, (_, sixteenth) => {
                if (sixteenth === 0 || sixteenth % 16 === 0 || sixteenth % 4 === 0) return null;
                const leftPct = (sixteenth / (barCount * 16)) * 100;
                return (
                  <div
                    key={`16th-${sixteenth}`}
                    className="absolute top-0 bottom-0 border-l pointer-events-none"
                    style={{
                      left: `${leftPct}%`,
                      borderColor: 'rgba(255,255,255,0.04)',
                    }}
                  />
                );
              })
            : null}

          {playheadPct != null ? (
            <PreviewPlayMarker
              leftPct={playheadPct}
              scrub={playheadScrub && Boolean(onPreviewBeatChange)}
              onScrubStart={beginPlayheadScrub}
            />
          ) : null}

          {marqueeBox ? (
            <div
              className="absolute pointer-events-none z-30 border rounded-sm"
              style={{
                left: marqueeBox.left,
                top: marqueeBox.top,
                width: Math.max(1, marqueeBox.right - marqueeBox.left),
                height: Math.max(1, marqueeBox.bottom - marqueeBox.top),
                borderColor: `${accentHex}cc`,
                background: `${accentHex}22`,
                boxShadow: `inset 0 0 0 1px ${accentHex}44`,
              }}
              aria-hidden
            />
          ) : null}

          {localNotes.map((n) => {
            const row = genoLoopPianoRollRowIndex(n.pitch, pitchRows);
            if (row < 0) return null;
            const leftPct = (n.startBeat / totalBeats) * 100;
            const widthPct = Math.max(0.35, (n.durationBeats / totalBeats) * 100);
            const selected = isNoteSelected(n.id);
            return (
              <div
                key={n.id}
                data-geno-loop-note
                data-note-id={n.id}
                role="button"
                tabIndex={-1}
                title={`${n.label} · beat ${n.startBeat.toFixed(2)} · ${n.durationBeats.toFixed(2)} beats · vel ${n.velocity}`}
                onContextMenu={(e) => openContextMenu(e, n.id)}
                onPointerDown={(e) => {
                  if (!editable || e.button !== 0) return;
                  if (gridEditTool === 'erase') {
                    e.preventDefault();
                    e.stopPropagation();
                    deleteNoteById(n.id);
                    return;
                  }
                  const t = e.target as HTMLElement;
                  if (t.dataset.genoResize === '1' || t.dataset.genoGrab === '1') return;
                  e.preventDefault();
                  e.stopPropagation();
                  if (e.shiftKey) {
                    toggleNoteSelection(n.id);
                    return;
                  }
                  beginNoteDrag('move', n, e);
                }}
                className="absolute rounded-[2px] border z-10 select-none touch-none"
                style={{
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  top: row * GENO_LOOP_PIANO_ROW_H_PX + 2,
                  height: GENO_LOOP_PIANO_ROW_H_PX - 3,
                  borderColor: selected ? 'rgba(255,255,255,0.65)' : `${accentHex}55`,
                  background: selected
                    ? `linear-gradient(180deg, ${accentHex}dd 0%, ${accentHex}88 100%)`
                    : `linear-gradient(180deg, ${accentHex}aa 0%, ${accentHex}55 100%)`,
                  boxShadow: selected ? `0 0 8px ${accentHex}66` : `0 0 3px ${accentHex}33`,
                  opacity: 0.5 + (n.velocity / 127) * 0.45,
                  cursor: editable ? (selected ? 'grab' : 'pointer') : 'default',
                }}
              >
                {editable ? (
                  <div
                    data-geno-grab="1"
                    className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 flex items-center justify-center"
                    style={{
                      width: 16,
                      maxWidth: `calc(100% - ${RESIZE_HANDLE_W_PX + 4}px)`,
                      cursor: 'grab',
                      zIndex: 2,
                    }}
                    title="Drag to move"
                    onPointerDown={(e) => {
                      if (e.button !== 0) return;
                      if (gridEditTool === 'erase') {
                        e.preventDefault();
                        e.stopPropagation();
                        deleteNoteById(n.id);
                        return;
                      }
                      e.preventDefault();
                      e.stopPropagation();
                      beginNoteDrag('move', n, e);
                    }}
                    aria-hidden
                  >
                    <div
                      className="rounded-sm pointer-events-none"
                      style={{
                        width: 4,
                        height: 7,
                        background: selected
                          ? 'repeating-linear-gradient(180deg, rgba(255,255,255,0.9) 0 2px, transparent 2px 4px)'
                          : 'repeating-linear-gradient(180deg, rgba(255,255,255,0.55) 0 2px, transparent 2px 4px)',
                        opacity: selected ? 1 : 0.75,
                      }}
                    />
                  </div>
                ) : null}
                {editable ? (
                  <div
                    data-geno-resize="1"
                    className="absolute top-0 bottom-0 right-0 cursor-ew-resize"
                    style={{
                      width: RESIZE_HANDLE_W_PX,
                      background: selected ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.12)',
                    }}
                    onPointerDown={(e) => {
                      if (e.button !== 0) return;
                      e.preventDefault();
                      e.stopPropagation();
                      beginNoteDrag('resize', n, e);
                    }}
                    aria-hidden
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div
        className="px-2 py-1 border-t text-[6px] font-mono opacity-40 flex flex-wrap gap-x-3"
        style={{ borderColor: '#1a1a24', color: '#808090' }}
      >
        <span>{localNotes.length} chord tones</span>
        {editable ? (
          <span>
            {gridEditTool === 'draw'
              ? 'Draw — click grid to place · ruler scrubs playhead · Shift+drag to select · '
              : gridPlayheadScrub
                ? 'Select — click/drag grid or ruler for playhead · Shift+drag empty area to select · '
                : 'Drag empty area to select · '}
            Shift+click add · Ctrl+A all · Arrows nudge · Ctrl+D dup · Cut · Delete · Undo (Ctrl+Z) · 16th snap
          </span>
        ) : (
          <span>{barCount} bars · fills width</span>
        )}
      </div>

      {contextMenu && editable ? (
        <GenoLoopPianoRollContextMenu
          menu={contextMenu}
          canUndo={canUndo}
          hasNote={selectedIds.size > 0 || contextNoteId != null}
          onClose={closeContextMenu}
          onCut={() => {
            if (selectedIds.size > 0) cutSelected();
            else if (contextNoteId) cutNoteById(contextNoteId);
          }}
          onDelete={() => {
            if (selectedIds.size > 0) deleteSelected();
            else if (contextNoteId) deleteNoteById(contextNoteId);
          }}
          onDuplicate={() => {
            if (selectedIds.size > 0) duplicateSelected();
            else if (contextNoteId) duplicateNoteById(contextNoteId);
          }}
          onUndo={undoLast}
        />
      ) : null}
    </div>
  );
});
