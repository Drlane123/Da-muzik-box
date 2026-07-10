'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { Eraser, Maximize2, Minimize2, MousePointer2, Pencil, Trash2, Waves, ZoomIn, ZoomOut } from 'lucide-react';
import type { Se2ComposeResolvedKey } from '@/app/lib/studio/se2SynthGenoKeyLock';
import { SE2_SYNTH_GENO_FUSION_NOTE_FLEX_LABEL } from '@/app/lib/studio/se2SynthGenoFusionEngine';
import {
  se2SynthGenoChordPianoBankEntries,
  se2SynthGenoSanitizeChordPianoBankId,
} from '@/app/lib/studio/se2SynthGenoChordPianoLibrary';
import {
  se2SynthGenoMelodyLaneSoundEntries,
  se2SynthGenoSanitizePluginMelodyBankId,
  se2SynthGenoSanitizeSoundBankId,
  se2SynthGenoSoundBankEntries,
} from '@/app/lib/studio/se2SynthGenoSoundBank';
import {
  FUSION_ROLL_BAR_COUNT,
  SE2_FUSION_PIANO_QUANTIZE_OPTIONS,
  SE2_SYNTH_GENO_FUSION_LANE_META,
  se2FusionPianoClampNote,
  se2FusionPianoDrawMaxBeat,
  se2FusionPianoIsBlackKey,
  se2FusionPianoNewNoteId,
  se2FusionPianoPitchRows,
  se2FusionPianoRollKeyLabel,
  se2FusionPianoSnapBeat,
  se2FusionPianoSnapDuration,
  se2FusionPianoTotalBeats,
  se2SynthGenoFusionRollHasNotes,
  se2SynthGenoFusionRollSummary,
  se2SynthGenoFusionSetLaneNotes,
  se2SynthGenoFusionSetSound,
  SE2_FUSION_CUSTOM_SOUND_ID,
  se2SynthGenoFusionLaneUsesCustomVoice,
  type Se2FusionPianoNote,
  type Se2FusionPianoQuantize,
  type Se2SynthGenoFusionLaneId,
  type Se2SynthGenoFusionRollState,
} from '@/app/lib/studio/se2SynthGenoFusionRoll';
import {
  se2FusionFlexNewPointId,
  se2FusionNoteFlexCurve,
  se2FusionNoteHasFlexCurve,
  se2FusionRemoveFlexPoint,
  se2FusionUpsertFlexPoint,
  type Se2FusionFlexPoint,
} from '@/app/lib/studio/se2SynthGenoFusionFlexCurve';
import { StudioEditor2HelpTip } from '@/app/components/studio/StudioEditor2HelpHub';

export type Se2SynthGenoFusionPianoRollProps = {
  accentHex?: string;
  beatsPerBar: number;
  bpm: number;
  resolvedKey: Se2ComposeResolvedKey;
  roll: Se2SynthGenoFusionRollState;
  disabled?: boolean;
  trackName?: string;
  exportingAudio?: boolean;
  previewing?: boolean;
  onRollChange: (roll: Se2SynthGenoFusionRollState) => void;
  onTogglePreview?: () => void;
  onExportMidi?: () => void;
  onExportAudio?: () => void;
  /** Fired when Expand / Minimize toggles — parent can hide dock controls (e.g. SpaceWalk knobs). */
  onExpandedChange?: (expanded: boolean) => void;
  /** Parent owns the outer Fusion shell — no duplicate border/title chrome. */
  embedded?: boolean;
  /** Hide Preview / Export / Expand row (parent header owns transport). */
  hideTransportHeader?: boolean;
  /** Collapsible synth controls rendered above the lane toolbar (e.g. SpaceWalk folds). */
  controlStrip?: React.ReactNode;
  /** Controlled expand state from parent unified shell. */
  expanded?: boolean;
  /** Docked beside SpaceWalk sidebar — tighter chrome, auto bar-fit, two-row toolbar. */
  inlineDock?: boolean;
};

type RollTool = 'pencil' | 'select' | 'erase' | 'flex';

type NoteDrag = {
  mode: 'move' | 'resize-end' | 'draw' | 'bend-seg';
  id: string;
  segmentIndex: number;
  start0: number;
  dur0: number;
  pitch0: number;
  segPitch0: number;
  x0: number;
  y0: number;
};

const ROW_H = 24;
const KEY_W = 44;
const RULER_H = 24;
const VEL_LANE_H = 56;
const RESIZE_HANDLE_W = 9;
const BLACK_KEY_W_RATIO = 0.58;
const MIN_DRAW_DUR_STEPS = 1;

const FUSION_ZOOM_STORAGE_KEY = 'se2-fusion-px-per-bar';
const FUSION_PX_PER_BAR_MIN = 48;
const FUSION_PX_PER_BAR_MAX = 300;
const FUSION_PX_PER_BAR_DEFAULT = 88;
const FUSION_PX_PER_BAR_STEP = 8;

const FUSION_LANES: Se2SynthGenoFusionLaneId[] = ['chords', 'melody', 'bass'];

function laneBankEntries(lane: Se2SynthGenoFusionLaneId) {
  const cat = SE2_SYNTH_GENO_FUSION_LANE_META[lane].bankCategory;
  if (cat === 'accord') return se2SynthGenoChordPianoBankEntries();
  if (cat === 'melody') return se2SynthGenoMelodyLaneSoundEntries();
  return se2SynthGenoSoundBankEntries('bass');
}

function laneSelectedBankId(roll: Se2SynthGenoFusionRollState, lane: Se2SynthGenoFusionLaneId): string {
  if (se2SynthGenoFusionLaneUsesCustomVoice(roll, lane)) return SE2_FUSION_CUSTOM_SOUND_ID;
  if (lane === 'chords') return se2SynthGenoSanitizeChordPianoBankId(roll.sounds.accordBankId);
  if (lane === 'melody') return se2SynthGenoSanitizePluginMelodyBankId(roll.sounds.melodyBankId);
  return se2SynthGenoSanitizeSoundBankId('bass', roll.sounds.bassBankId);
}

function toolBtnStyle(active: boolean, accent: string): CSSProperties {
  return {
    background: active ? `${accent}28` : '#12121a',
    color: active ? accent : '#8a8a9c',
    border: `1px solid ${active ? `${accent}88` : '#333340'}`,
  };
}

function clampFusionPxPerBar(v: number): number {
  return Math.max(FUSION_PX_PER_BAR_MIN, Math.min(FUSION_PX_PER_BAR_MAX, Math.round(v)));
}

export function Se2SynthGenoFusionPianoRoll({
  accentHex = '#00E5CC',
  beatsPerBar,
  bpm,
  roll,
  disabled = false,
  trackName,
  exportingAudio = false,
  previewing = false,
  onRollChange,
  onTogglePreview,
  onExportMidi,
  onExportAudio,
  onExpandedChange,
  embedded = false,
  hideTransportHeader = false,
  controlStrip,
  expanded: expandedProp,
  inlineDock = false,
}: Se2SynthGenoFusionPianoRollProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<NoteDrag | null>(null);
  const rollRef = useRef(roll);
  const notesRef = useRef(roll.lanes[roll.activeLane]);

  const [tool, setTool] = useState<RollTool>('pencil');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showVelocity, setShowVelocity] = useState(true);
  const [pxPerBar, setPxPerBar] = useState(FUSION_PX_PER_BAR_DEFAULT);
  const [rollExpandedInternal, setRollExpandedInternal] = useState(false);
  const rollExpanded = expandedProp ?? rollExpandedInternal;
  const setRollExpanded = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      const resolved = typeof next === 'function' ? next(rollExpanded) : next;
      if (expandedProp === undefined) setRollExpandedInternal(resolved);
      onExpandedChange?.(resolved);
    },
    [expandedProp, onExpandedChange, rollExpanded],
  );

  const lane = roll.activeLane;
  const meta = SE2_SYNTH_GENO_FUSION_LANE_META[lane];
  const laneColor = lane === 'chords' ? accentHex : meta.color;
  const notes = roll.lanes[lane];
  rollRef.current = roll;
  notesRef.current = notes;
  const totalBeats = se2FusionPianoTotalBeats(beatsPerBar);
  const drawMaxBeat = se2FusionPianoDrawMaxBeat(beatsPerBar);
  const pitchRows = useMemo(() => se2FusionPianoPitchRows(meta.pitchLo, meta.pitchHi), [meta.pitchHi, meta.pitchLo]);
  const gridH = pitchRows.length * ROW_H;
  const pxPerBeat = pxPerBar / Math.max(1, beatsPerBar);
  const gridWidthPx = pxPerBar * FUSION_ROLL_BAR_COUNT;
  const rollContentW = KEY_W + gridWidthPx;
  const rulerH = pxPerBar >= 72 ? 34 : RULER_H;

  const fitBarsToViewport = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const avail = Math.max(FUSION_PX_PER_BAR_MIN * FUSION_ROLL_BAR_COUNT, el.clientWidth - KEY_W - 4);
    setPxPerBar(clampFusionPxPerBar(avail / FUSION_ROLL_BAR_COUNT));
  }, []);

  useEffect(() => {
    let fromStorage = false;
    try {
      const raw = window.localStorage.getItem(FUSION_ZOOM_STORAGE_KEY);
      if (raw) {
        const parsed = Number(raw);
        if (Number.isFinite(parsed)) {
          setPxPerBar(clampFusionPxPerBar(parsed));
          fromStorage = true;
        }
      }
    } catch {
      /* */
    }
    if (!fromStorage) {
      requestAnimationFrame(() => fitBarsToViewport());
    }
  }, [fitBarsToViewport]);

  useEffect(() => {
    try {
      window.localStorage.setItem(FUSION_ZOOM_STORAGE_KEY, String(pxPerBar));
    } catch {
      /* */
    }
  }, [pxPerBar]);

  useEffect(() => {
    if (!rollExpanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setRollExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => fitBarsToViewport());
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [rollExpanded, fitBarsToViewport]);

  useEffect(() => {
    if (!inlineDock || rollExpanded) return;
    const el = scrollRef.current;
    if (!el) return;
    const fit = () => requestAnimationFrame(() => fitBarsToViewport());
    fit();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [inlineDock, rollExpanded, fitBarsToViewport]);

  const beatFromClientX = useCallback(
    (clientX: number, allowPastEdge = false): number | null => {
      const el = gridRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      const maxX = allowPastEdge ? gridWidthPx * 1.18 : gridWidthPx;
      if (x < 0) return 0;
      if (!allowPastEdge && x > gridWidthPx) return null;
      const beat = (Math.min(maxX, Math.max(0, x)) / gridWidthPx) * totalBeats;
      return Math.max(0, Math.min(drawMaxBeat, beat));
    },
    [drawMaxBeat, gridWidthPx, totalBeats],
  );

  const handleGridWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -FUSION_PX_PER_BAR_STEP : FUSION_PX_PER_BAR_STEP;
      setPxPerBar((v) => clampFusionPxPerBar(v + delta));
    },
    [],
  );

  const setLaneNotes = useCallback(
    (nextNotes: Se2FusionPianoNote[]) => {
      notesRef.current = nextNotes;
      onRollChange(se2SynthGenoFusionSetLaneNotes(rollRef.current, lane, nextNotes));
    },
    [lane, onRollChange],
  );

  const pitchFromClientY = useCallback(
    (clientY: number): number => {
      const el = gridRef.current;
      if (!el) return meta.defaultPitch;
      const y = clientY - el.getBoundingClientRect().top;
      const row = Math.max(0, Math.min(pitchRows.length - 1, Math.floor(y / ROW_H)));
      return pitchRows[row] ?? meta.defaultPitch;
    },
    [meta.defaultPitch, pitchRows],
  );

  const replaceNote = useCallback(
    (updated: Se2FusionPianoNote) => {
      setLaneNotes(notesRef.current.map((n) => (n.id === updated.id ? updated : n)));
    },
    [setLaneNotes],
  );

  const cellFromPointer = useCallback(
    (clientX: number, clientY: number, allowPastEdge = false): { beat: number; pitch: number } | null => {
      const el = gridRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const y = clientY - rect.top;
      if (y < 0 || y > rect.height) return null;
      const beat = beatFromClientX(clientX, allowPastEdge);
      if (beat == null) return null;
      const row = Math.max(0, Math.min(pitchRows.length - 1, Math.floor(y / ROW_H)));
      const pitch = pitchRows[row] ?? meta.defaultPitch;
      return { beat, pitch };
    },
    [beatFromClientX, meta.defaultPitch, pitchRows],
  );

  const snapNote = useCallback(
    (partial: Omit<Se2FusionPianoNote, 'id'> & { id?: string }): Se2FusionPianoNote => {
      const startBeat = se2FusionPianoSnapBeat(partial.startBeat, roll.quantize, beatsPerBar);
      const durationBeats = se2FusionPianoSnapDuration(partial.durationBeats, roll.quantize);
      return se2FusionPianoClampNote(
        {
          id: partial.id ?? se2FusionPianoNewNoteId(),
          pitch: partial.pitch,
          startBeat,
          durationBeats,
          velocity: Math.max(1, Math.min(127, Math.round(partial.velocity))),
          flexCurve: partial.flexCurve,
        },
        lane,
        beatsPerBar,
      );
    },
    [beatsPerBar, lane, roll.quantize],
  );

  useEffect(() => {
    setSelectedId(null);
  }, [lane]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        setLaneNotes(notes.filter((n) => n.id !== selectedId));
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [notes, selectedId, setLaneNotes]);

  const snapFlexBeat = useCallback(
    (beatOffset: number, durationBeats: number): number => {
      const stepsPerBeat =
        SE2_FUSION_PIANO_QUANTIZE_OPTIONS.find((q) => q.id === roll.quantize)?.stepsPerBeat ?? 4;
      const step = 1 / stepsPerBeat;
      const snapped = Math.round(beatOffset / step) * step;
      return Math.max(0, Math.min(durationBeats, snapped));
    },
    [roll.quantize],
  );

  const beatOffsetFromClientX = useCallback(
    (clientX: number, note: Se2FusionPianoNote): number => {
      const beat = beatFromClientX(clientX, true);
      if (beat == null) return 0;
      return Math.max(0, Math.min(note.durationBeats, beat - note.startBeat));
    },
    [beatFromClientX],
  );

  const findNearestFlexPoint = useCallback(
    (
      note: Se2FusionPianoNote,
      clientX: number,
      clientY: number,
    ): Se2FusionFlexPoint | null => {
      const el = gridRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const curve = se2FusionNoteFlexCurve(note, beatsPerBar);
      let best: Se2FusionFlexPoint | null = null;
      let bestD = 14;
      for (const p of curve) {
        const x = note.startBeat * pxPerBeat + p.beatOffset * pxPerBeat;
        const row = pitchRows.indexOf(p.pitch);
        if (row < 0) continue;
        const y = row * ROW_H + ROW_H / 2;
        const d = Math.hypot(clientX - rect.left - x, clientY - rect.top - y);
        if (d < bestD) {
          best = p;
          bestD = d;
        }
      }
      return best;
    },
    [beatsPerBar, pitchRows, pxPerBeat],
  );

  const beginFlexSketch = useCallback(
    (e: ReactPointerEvent<HTMLElement>, note: Se2FusionPianoNote) => {
      if (disabled || e.button !== 0 || tool !== 'flex') return;
      e.stopPropagation();
      e.preventDefault();
      setSelectedId(note.id);

      const hit = findNearestFlexPoint(note, e.clientX, e.clientY);

      if (e.altKey && hit && hit.id !== 'flex-start' && hit.id !== 'flex-end') {
        replaceNote(se2FusionRemoveFlexPoint(note, hit.id));
        return;
      }

      if (e.detail >= 2 && !hit) {
        const beatOff = snapFlexBeat(beatOffsetFromClientX(e.clientX, note), note.durationBeats);
        const pitch = pitchFromClientY(e.clientY);
        const id = se2FusionFlexNewPointId();
        replaceNote(
          se2FusionUpsertFlexPoint(note, { id, beatOffset: beatOff, pitch }, lane),
        );
        return;
      }

      let pointId: string;

      if (hit) {
        pointId = hit.id;
      } else {
        pointId = se2FusionFlexNewPointId();
        const beatOff = snapFlexBeat(beatOffsetFromClientX(e.clientX, note), note.durationBeats);
        const pitch = pitchFromClientY(e.clientY);
        replaceNote(
          se2FusionUpsertFlexPoint(note, { id: pointId, beatOffset: beatOff, pitch }, lane),
        );
      }

      const onMove = (ev: PointerEvent) => {
        const latest = notesRef.current.find((n) => n.id === note.id);
        if (!latest) return;
        const beatOff = snapFlexBeat(beatOffsetFromClientX(ev.clientX, latest), latest.durationBeats);
        const pitch = pitchFromClientY(ev.clientY);
        replaceNote(
          se2FusionUpsertFlexPoint(
            latest,
            { id: pointId, beatOffset: beatOff, pitch },
            lane,
          ),
        );
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [
      beatOffsetFromClientX,
      disabled,
      findNearestFlexPoint,
      lane,
      pitchFromClientY,
      replaceNote,
      snapFlexBeat,
      tool,
    ],
  );

  const beginNoteBodyDrag = useCallback(
    (e: ReactPointerEvent<HTMLElement>, note: Se2FusionPianoNote, mode: 'move' | 'resize-end') => {
      if (disabled || e.button !== 0 || tool === 'flex') return;
      if (tool === 'erase') {
        setLaneNotes(notesRef.current.filter((n) => n.id !== note.id));
        setSelectedId(null);
        return;
      }
      e.stopPropagation();
      if (tool === 'pencil') setTool('select');
      setSelectedId(note.id);
      dragRef.current = {
        mode,
        id: note.id,
        segmentIndex: 0,
        start0: note.startBeat,
        dur0: note.durationBeats,
        pitch0: note.pitch,
        segPitch0: note.pitch,
        x0: e.clientX,
        y0: e.clientY,
      };

      const onMove = (ev: PointerEvent) => {
        const drag = dragRef.current;
        if (!drag) return;
        const current = notesRef.current.find((n) => n.id === drag.id);
        if (!current) return;

        const dx = ev.clientX - drag.x0;
        const dy = ev.clientY - drag.y0;

        if (drag.mode === 'resize-end') {
          const durDelta = dx / pxPerBeat;
          const rawDur = Math.max(1 / 32, drag.dur0 + durDelta);
          const newDur = se2FusionPianoSnapDuration(rawDur, roll.quantize);
          const clamped = se2FusionPianoClampNote({ ...current, durationBeats: newDur }, lane, beatsPerBar);
          if (clamped.durationBeats === current.durationBeats) return;
          replaceNote(clamped);
          return;
        }

        const beatDelta = dx / pxPerBeat;
        const pitchDelta = -Math.round(dy / ROW_H);
        const rowIdx = pitchRows.indexOf(drag.pitch0);
        const newRowIdx = Math.max(0, Math.min(pitchRows.length - 1, rowIdx + pitchDelta));
        const newPitch = pitchRows[newRowIdx] ?? current.pitch;
        const newStart = se2FusionPianoSnapBeat(drag.start0 + beatDelta, roll.quantize, beatsPerBar);
        const flexCurve = current.flexCurve?.map((p) => {
          const pRow = pitchRows.indexOf(p.pitch);
          const shifted = pRow >= 0 ? pRow + pitchDelta : pRow;
          return {
            ...p,
            pitch:
              pitchRows[Math.max(0, Math.min(pitchRows.length - 1, shifted))] ??
              p.pitch + (newPitch - drag.pitch0),
          };
        });
        const clamped = se2FusionPianoClampNote(
          { ...current, startBeat: newStart, pitch: newPitch, flexCurve },
          lane,
          beatsPerBar,
        );
        if (
          clamped.startBeat === current.startBeat &&
          clamped.pitch === current.pitch &&
          JSON.stringify(clamped.flexCurve) === JSON.stringify(current.flexCurve)
        ) {
          return;
        }
        replaceNote(clamped);
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        dragRef.current = null;
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [beatsPerBar, disabled, lane, pitchRows, pxPerBeat, replaceNote, roll.quantize, setLaneNotes, tool],
  );

  const handleGridPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (disabled || e.button !== 0) return;
      if ((e.target as HTMLElement).closest('[data-fusion-note]')) return;
      const cell = cellFromPointer(e.clientX, e.clientY, tool === 'pencil');
      if (!cell) return;

      if (tool === 'erase') {
        setSelectedId(null);
        return;
      }

      if (tool === 'pencil') {
        const stepsPerBeat =
          SE2_FUSION_PIANO_QUANTIZE_OPTIONS.find((q) => q.id === roll.quantize)?.stepsPerBeat ?? 4;
        const minDur = MIN_DRAW_DUR_STEPS / stepsPerBeat;
        const id = se2FusionPianoNewNoteId();
        const note = snapNote({
          id,
          pitch: cell.pitch,
          startBeat: cell.beat,
          durationBeats: minDur,
          velocity: 100,
        });
        setLaneNotes(
          [...notes.filter((n) => !(Math.abs(n.startBeat - note.startBeat) < 0.001 && n.pitch === note.pitch)), note].sort(
            (a, b) => a.startBeat - b.startBeat,
          ),
        );
        setSelectedId(id);
        dragRef.current = {
          mode: 'draw',
          id,
          segmentIndex: 0,
          start0: note.startBeat,
          dur0: note.durationBeats,
          pitch0: note.pitch,
          segPitch0: note.pitch,
          x0: e.clientX,
          y0: e.clientY,
        };
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* */
        }
        return;
      }

      setSelectedId(null);
    },
    [cellFromPointer, disabled, notes, roll.quantize, setLaneNotes, snapNote, tool],
  );

  const handleDragPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.mode !== 'draw') return;

      const endBeat = beatFromClientX(e.clientX, true);
      if (endBeat == null) return;
      const rawDur = Math.max(1 / 32, endBeat - drag.start0);
      const newDur = se2FusionPianoSnapDuration(rawDur, roll.quantize);
      const draft = notesRef.current.find((n) => n.id === drag.id);
      if (!draft) return;
      const clamped = se2FusionPianoClampNote({ ...draft, durationBeats: newDur }, lane, beatsPerBar);
      if (clamped.durationBeats === draft.durationBeats) return;
      replaceNote(clamped);
    },
    [beatFromClientX, beatsPerBar, lane, replaceNote, roll.quantize],
  );

  const handleDragPointerUp = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (drag?.mode === 'draw') {
        const note = notesRef.current.find((n) => n.id === drag.id);
        if (note) {
          replaceNote(se2FusionPianoClampNote(note, lane, beatsPerBar));
        }
      }
      dragRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* */
      }
    },
    [beatsPerBar, lane, replaceNote],
  );

  const clearLane = useCallback(() => {
    if (!notes.length) return;
    if (!window.confirm(`Clear all ${meta.label.toLowerCase()} notes?`)) return;
    setLaneNotes([]);
    setSelectedId(null);
  }, [meta.label, notes.length, setLaneNotes]);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    setLaneNotes(notes.filter((n) => n.id !== selectedId));
    setSelectedId(null);
  }, [notes, selectedId, setLaneNotes]);

  const setVelocity = useCallback(
    (id: string, velocity: number) => {
      setLaneNotes(
        notes.map((n) => (n.id === id ? { ...n, velocity: Math.max(1, Math.min(127, Math.round(velocity))) } : n)),
      );
    },
    [notes, setLaneNotes],
  );

  const beatLines = useMemo(() => {
    const lines: { beat: number; major: boolean }[] = [];
    for (let b = 0; b <= totalBeats; b += 0.25) {
      const major = Math.abs(b % beatsPerBar) < 0.001;
      const sub = Math.abs(b % 1) < 0.001;
      if (!major && !sub && roll.quantize === '1/4') continue;
      if (!major && !sub && roll.quantize === '1/8' && Math.abs(b % 0.5) > 0.001) continue;
      lines.push({ beat: b, major: major || (sub && roll.quantize !== '1/4') });
    }
    return lines;
  }, [beatsPerBar, roll.quantize, totalBeats]);

  const hasNotes = se2SynthGenoFusionRollHasNotes(roll);
  const bankEntries = laneBankEntries(lane);
  const selectedBankId = laneSelectedBankId(roll, lane);
  const customVoiceLabel = roll.laneCustomVoices?.[lane]?.label;

  const rollShell = (
    <div
      data-studio-synth-geno-fusion-roll
      className={
        rollExpanded
          ? 'fixed inset-0 z-[9700] flex flex-col w-screen h-[100dvh] max-w-none rounded-none border-0 overflow-hidden'
          : embedded
            ? 'flex flex-col w-full min-w-0 min-h-0'
            : 'rounded-xl border overflow-hidden w-full'
      }
      style={{
        borderColor: rollExpanded || embedded ? undefined : `${accentHex}66`,
        background: rollExpanded
          ? 'linear-gradient(180deg, #0e141c 0%, #06080c 100%)'
          : embedded
            ? undefined
            : 'linear-gradient(180deg, #0e141c 0%, #06080c 100%)',
        boxShadow:
          rollExpanded || embedded
            ? undefined
            : `inset 0 1px 0 ${accentHex}28, 0 8px 32px rgba(0,0,0,0.45)`,
      }}
    >
      {controlStrip ? (
        <div className="shrink-0 border-b" style={{ borderColor: '#252530', background: 'rgba(0,0,0,0.28)' }}>
          {controlStrip}
        </div>
      ) : null}
      {!hideTransportHeader ? (
        <div
          className="flex flex-col gap-1.5 px-3 py-2 border-b shrink-0"
          style={{ borderColor: '#252530', background: `${accentHex}12` }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-col min-w-0 gap-0.5">
              <span
                className="text-[10px] font-black uppercase tracking-[0.16em] inline-flex items-center gap-1.5"
                style={{ color: accentHex }}
              >
                {SE2_SYNTH_GENO_FUSION_NOTE_FLEX_LABEL}
                <span
                  className="rounded px-1.5 py-0.5 text-[6px] font-bold tracking-widest opacity-80"
                  style={{ background: `${accentHex}18`, color: accentHex }}
                >
                  8-bar roll
                </span>
                <StudioEditor2HelpTip
                  tab="synthGeno"
                  title={`${SE2_SYNTH_GENO_FUSION_NOTE_FLEX_LABEL} — SpaceWalk harmony × sketchable pitch curves (sound + prompt in the 8-bar roll)`}
                />
              </span>
              <span className="text-[7px] font-mono opacity-50 truncate">
                {se2SynthGenoFusionRollSummary(roll)}
                {trackName ? <span className="opacity-70"> · {trackName}</span> : null}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 shrink-0">
              <button
                type="button"
                disabled={disabled}
                onClick={() => setRollExpanded((v) => !v)}
                className="rounded-md border px-2.5 py-1 text-[8px] font-bold uppercase tracking-wide disabled:opacity-40 inline-flex items-center gap-1"
                style={{
                  borderColor: rollExpanded ? `${accentHex}88` : '#4a4a58',
                  background: rollExpanded ? `${accentHex}22` : '#1a1a24',
                  color: rollExpanded ? accentHex : '#ececf4',
                }}
                title={rollExpanded ? 'Minimize piano roll (Esc)' : 'Expand piano roll to full screen'}
              >
                {rollExpanded ? <Minimize2 size={11} aria-hidden /> : <Maximize2 size={11} aria-hidden />}
                {rollExpanded ? 'Minimize' : 'Expand'}
              </button>
              {onTogglePreview ? (
                <button
                  type="button"
                  disabled={disabled || (!previewing && !hasNotes)}
                  onClick={onTogglePreview}
                  className="rounded-md border px-2.5 py-1 text-[8px] font-bold uppercase tracking-wide disabled:opacity-40"
                  style={{
                    borderColor: previewing ? '#ef444488' : '#4a4a58',
                    background: previewing ? '#ef444422' : '#1a1a24',
                    color: previewing ? '#fca5a5' : '#ececf4',
                  }}
                >
                  {previewing ? 'Stop' : 'Preview'}
                </button>
              ) : null}
              {onExportMidi ? (
                <button
                  type="button"
                  disabled={disabled || !hasNotes || exportingAudio}
                  onClick={onExportMidi}
                  title={
                    trackName
                      ? `Export 8-bar MIDI to ${trackName} (chords, melody & bass lanes)`
                      : 'Export 8-bar MIDI to this Synth Geno lane'
                  }
                  className="rounded-md border px-2.5 py-1 text-[8px] font-bold uppercase tracking-wide disabled:opacity-40"
                  style={{ borderColor: '#a78bfa88', background: '#a78bfa18', color: '#d8b4fe' }}
                >
                  Export MIDI
                </button>
              ) : null}
              {onExportAudio ? (
                <button
                  type="button"
                  disabled={disabled || !hasNotes || exportingAudio}
                  onClick={onExportAudio}
                  title={
                    trackName
                      ? `Render 8 bars with sounds & FX to audio on ${trackName}`
                      : 'Render 8 bars with sounds & FX to this lane'
                  }
                  className="rounded-md border px-2.5 py-1 text-[8px] font-black uppercase tracking-wide disabled:opacity-40"
                  style={{ borderColor: '#22c55e88', background: '#22c55e18', color: '#86efac' }}
                >
                  {exportingAudio ? 'Rendering…' : 'Export Audio'}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : embedded && !rollExpanded && !inlineDock ? (
        <div
          className="px-3 py-1 border-b shrink-0 text-[7px] font-mono opacity-45 truncate"
          style={{ borderColor: '#252530', background: '#0a0a10' }}
        >
          {se2SynthGenoFusionRollSummary(roll)}
          {trackName ? <span className="opacity-70"> · {trackName}</span> : null}
        </div>
      ) : null}

        <div
          className={`border-b shrink-0 min-w-0 ${inlineDock ? 'flex flex-col gap-1 px-2 py-1' : 'flex flex-wrap items-center gap-1 px-3 py-1.5'}`}
          style={{ borderColor: '#222230', background: '#0a0a10' }}
        >
          <div className={`flex flex-wrap items-center gap-1 min-w-0 ${inlineDock ? 'w-full' : ''}`}>
          {FUSION_LANES.map((id) => {
            const m = SE2_SYNTH_GENO_FUSION_LANE_META[id];
            const active = roll.activeLane === id;
            const color = id === 'chords' ? accentHex : m.color;
            return (
              <button
                key={id}
                type="button"
                disabled={disabled}
                onClick={() => onRollChange({ ...roll, activeLane: id })}
                className="rounded border px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide disabled:opacity-40"
                style={{
                  borderColor: active ? `${color}aa` : '#3a3a48',
                  background: active ? `${color}22` : '#101018',
                  color: active ? color : '#9a9ab0',
                }}
              >
                {m.shortLabel}
                <span className="opacity-50 ml-1">({roll.lanes[id].length})</span>
              </button>
            );
          })}

          <select
            disabled={disabled}
            value={selectedBankId}
            onChange={(e) => {
              const id = e.target.value;
              if (id === SE2_FUSION_CUSTOM_SOUND_ID) return;
              const sanitized =
                lane === 'chords'
                  ? se2SynthGenoSanitizeChordPianoBankId(id)
                  : lane === 'melody'
                    ? se2SynthGenoSanitizePluginMelodyBankId(id)
                    : se2SynthGenoSanitizeSoundBankId('bass', id);
              onRollChange(se2SynthGenoFusionSetSound(roll, lane, sanitized));
            }}
            className="rounded border px-1.5 py-0.5 text-[8px] font-semibold outline-none max-w-[130px] truncate ml-1"
            style={{ borderColor: `${laneColor}55`, background: '#0c0c14', color: '#e8e8f4' }}
            title={`${meta.label} sound`}
          >
            {customVoiceLabel ? (
              <option value={SE2_FUSION_CUSTOM_SOUND_ID}>
                {customVoiceLabel} (generated)
              </option>
            ) : null}
            {bankEntries.map((ent) => (
              <option key={ent.id} value={ent.id}>
                {ent.label}
              </option>
            ))}
          </select>

          <select
            disabled={disabled}
            value={roll.quantize}
            onChange={(e) => onRollChange({ ...roll, quantize: e.target.value as Se2FusionPianoQuantize })}
            className="rounded border px-1.5 py-0.5 text-[8px] font-semibold outline-none"
            style={{ borderColor: '#3a3a48', background: '#0c0c14', color: '#c8c8d8' }}
            title="Grid snap"
          >
            {SE2_FUSION_PIANO_QUANTIZE_OPTIONS.map((q) => (
              <option key={q.id} value={q.id}>
                {q.label}
              </option>
            ))}
          </select>

          {!inlineDock ? (
            <span className="text-[7px] font-mono opacity-45">{Math.round(bpm)} BPM</span>
          ) : null}
          </div>

          <div className={`flex flex-wrap items-center gap-1 ${inlineDock ? 'w-full' : 'ml-auto'}`}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setTool('pencil')}
              title="Pencil — click & drag horizontally to draw long notes"
              className="rounded p-1 disabled:opacity-40"
              style={toolBtnStyle(tool === 'pencil', laneColor)}
            >
              <Pencil size={12} />
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setTool('select')}
              title="Select — move / resize"
              className="rounded p-1 disabled:opacity-40"
              style={toolBtnStyle(tool === 'select', laneColor)}
            >
              <MousePointer2 size={12} />
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setTool('flex')}
              title="Note Flex — sketch pitch curves at any angle (MIDISketch-style)"
              className="rounded p-1 disabled:opacity-40"
              style={toolBtnStyle(tool === 'flex', '#fbbf24')}
            >
              <Waves size={12} />
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setTool('erase')}
              title="Erase — click notes to delete"
              className="rounded p-1 disabled:opacity-40"
              style={toolBtnStyle(tool === 'erase', '#f87171')}
            >
              <Eraser size={12} />
            </button>
            <button
              type="button"
              disabled={disabled || !selectedId}
              onClick={deleteSelected}
              title="Delete selected"
              className="rounded p-1 disabled:opacity-40"
              style={toolBtnStyle(!!selectedId, '#f87171')}
            >
              <Trash2 size={12} />
            </button>
            <button
              type="button"
              disabled={disabled || !notes.length}
              onClick={clearLane}
              className="rounded border px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wide disabled:opacity-35"
              style={{ borderColor: '#ef444488', background: '#ef444414', color: '#fca5a5' }}
            >
              Clear lane
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setShowVelocity((v) => !v)}
              className="rounded border px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wide"
              style={{
                borderColor: showVelocity ? `${laneColor}66` : '#3a3a48',
                background: showVelocity ? `${laneColor}14` : '#101018',
                color: showVelocity ? laneColor : '#8a8a9c',
              }}
            >
              Velocity
            </button>

            <div
              className="flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded border"
              style={{ borderColor: '#333340', background: '#0c0c14' }}
              title="Expand each bar horizontally — zoom in to sketch Note Flex bends per measure (Ctrl+wheel on grid)"
            >
              <span className="text-[7px] font-bold uppercase tracking-wide opacity-50">Bar zoom</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => setPxPerBar((v) => clampFusionPxPerBar(v - FUSION_PX_PER_BAR_STEP))}
                className="rounded p-0.5 disabled:opacity-40"
                style={toolBtnStyle(false, laneColor)}
                aria-label="Zoom out bars"
              >
                <ZoomOut size={11} />
              </button>
              <input
                type="range"
                disabled={disabled}
                min={FUSION_PX_PER_BAR_MIN}
                max={FUSION_PX_PER_BAR_MAX}
                step={FUSION_PX_PER_BAR_STEP}
                value={pxPerBar}
                onChange={(e) => setPxPerBar(clampFusionPxPerBar(Number(e.target.value)))}
                className="w-16 h-1 accent-current disabled:opacity-40"
                style={{ accentColor: laneColor }}
                aria-label="Bar zoom"
              />
              <button
                type="button"
                disabled={disabled}
                onClick={() => setPxPerBar((v) => clampFusionPxPerBar(v + FUSION_PX_PER_BAR_STEP))}
                className="rounded p-0.5 disabled:opacity-40"
                style={toolBtnStyle(false, laneColor)}
                aria-label="Zoom in bars"
              >
                <ZoomIn size={11} />
              </button>
              <span className="text-[7px] font-mono opacity-45 w-7">{pxPerBar}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={fitBarsToViewport}
                className="rounded border px-1 py-0.5 text-[6px] font-bold uppercase disabled:opacity-40"
                style={{ borderColor: '#3a3a48', color: '#9a9ab0' }}
                title="Fit all 8 bars to panel width"
              >
                Fit
              </button>
            </div>
          </div>
        </div>

      {!inlineDock || rollExpanded ? (
      <p className={`text-[7px] opacity-45 leading-relaxed px-3 -mt-1 shrink-0 ${rollExpanded ? 'hidden sm:block' : ''}`}>
        Note Flex — sketch curves at any angle; Preview / Export plays real pitch-bend glides on each note
        (like keyboard bend range) · double-click adds point · Alt+click deletes · Select moves note.
      </p>
      ) : null}

      <div
        className={`flex flex-col gap-2 min-h-0 ${rollExpanded ? 'flex-1' : ''} ${inlineDock && !rollExpanded ? 'px-1 py-1' : 'px-3 py-2'}`}
      >
        <div
          className="rounded-lg border overflow-hidden w-full min-h-0 flex flex-col"
          style={{ borderColor: '#2a2a38', flex: rollExpanded ? '1 1 auto' : undefined }}
        >
          <div
            ref={scrollRef}
            className="overflow-y-auto overflow-x-auto relative w-full min-h-0"
            style={
              rollExpanded
                ? { flex: '1 1 auto', minHeight: 0 }
                : inlineDock
                  ? { maxHeight: 340, minHeight: 200 }
                  : { maxHeight: 460, minHeight: 280 }
            }
          >
            <div style={{ width: rollContentW, minWidth: rollContentW }}>
              <div
                className="sticky top-0 z-20 flex"
                style={{ width: rollContentW, height: rulerH, background: '#111118', borderBottom: '1px solid #2a2a38' }}
              >
                <div
                  className="sticky left-0 z-30 shrink-0"
                  style={{ width: KEY_W, background: '#1a1a22', borderRight: '1px solid #333' }}
                />
                <div className="flex shrink-0" style={{ width: gridWidthPx }}>
                  {Array.from({ length: FUSION_ROLL_BAR_COUNT }, (_, bar) => (
                    <div
                      key={bar}
                      className="shrink-0 flex flex-col justify-center"
                      style={{
                        width: pxPerBar,
                        textAlign: 'center',
                        fontSize: 8,
                        fontWeight: 800,
                        color: '#8888a0',
                        borderRight: bar < FUSION_ROLL_BAR_COUNT - 1 ? '1px solid #333348' : undefined,
                      }}
                    >
                      <span style={{ lineHeight: pxPerBar >= 72 ? '14px' : `${rulerH}px` }}>{bar + 1}</span>
                      {pxPerBar >= 72 ? (
                        <div className="flex w-full px-0.5" style={{ height: 10 }}>
                          {Array.from({ length: beatsPerBar }, (_, beat) => (
                            <div
                              key={beat}
                              className="flex-1 text-center font-mono"
                              style={{ fontSize: 5, opacity: 0.45, lineHeight: '10px' }}
                            >
                              {beat + 1}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex" style={{ width: rollContentW }}>
                <div
                  className="sticky left-0 z-10 shrink-0"
                  style={{ width: KEY_W, background: '#ece8e4', borderRight: '1px solid #bbb' }}
                >
                  {pitchRows.map((midi) => {
                    const isBlack = se2FusionPianoIsBlackKey(midi);
                    const isC = midi % 12 === 0;
                    return (
                      <div
                        key={midi}
                        style={{
                          position: 'relative',
                          height: ROW_H,
                          background: isBlack ? '#1a1a22' : '#ece8e4',
                          borderBottom: '1px solid #d8d4d0',
                        }}
                      >
                        {!isBlack ? (
                          <span
                            style={{
                              position: 'absolute',
                              right: 3,
                              top: 0,
                              height: ROW_H,
                              lineHeight: `${ROW_H}px`,
                              fontSize: 7,
                              fontWeight: isC ? 800 : 600,
                              color: isC ? '#333' : '#666',
                            }}
                          >
                            {isC ? se2FusionPianoRollKeyLabel(midi) : ''}
                          </span>
                        ) : (
                          <div
                            style={{
                              position: 'absolute',
                              right: 0,
                              top: 1,
                              width: KEY_W * BLACK_KEY_W_RATIO,
                              height: ROW_H - 2,
                              background: '#111118',
                              borderRadius: 1,
                              border: '1px solid #333',
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                <div
                  ref={gridRef}
                  className="relative shrink-0 touch-none"
                  style={{
                    width: gridWidthPx,
                    height: gridH,
                    background: '#080810',
                    cursor:
                      tool === 'erase'
                        ? 'not-allowed'
                        : tool === 'pencil'
                          ? 'crosshair'
                          : tool === 'flex'
                            ? 'ns-resize'
                            : 'default',
                  }}
                  onPointerDown={handleGridPointerDown}
                  onPointerMove={handleDragPointerMove}
                  onPointerUp={handleDragPointerUp}
                  onPointerCancel={handleDragPointerUp}
                  onWheel={handleGridWheel}
                >
                  {beatLines.map((line, i) => (
                    <div
                      key={`line-${i}`}
                      className="absolute top-0 bottom-0 pointer-events-none"
                      style={{
                        left: line.beat * pxPerBeat,
                        width: 1,
                        background: line.major ? '#44445a' : '#2a2a38',
                        opacity: line.major ? 0.9 : 0.55,
                      }}
                    />
                  ))}

                  {Array.from({ length: FUSION_ROLL_BAR_COUNT }, (_, bar) => (
                    <div
                      key={`bar-line-${bar}`}
                      className="absolute top-0 bottom-0 pointer-events-none"
                      style={{
                        left: bar * pxPerBar,
                        width: 2,
                        background: '#55556a',
                        opacity: 0.35,
                      }}
                    />
                  ))}

                  {pitchRows.map((midi, row) => (
                    <div
                      key={`row-${midi}`}
                      className="absolute left-0 right-0 pointer-events-none"
                      style={{
                        top: row * ROW_H,
                        height: ROW_H,
                        borderBottom: '1px solid #14141c',
                        background: se2FusionPianoIsBlackKey(midi) ? 'rgba(0,0,0,0.22)' : 'transparent',
                      }}
                    />
                  ))}

                  {notes.map((note) => {
                    const baseRow = pitchRows.indexOf(note.pitch);
                    if (baseRow < 0) return null;
                    const curve = se2FusionNoteFlexCurve(note, beatsPerBar);
                    const selected = selectedId === note.id;
                    const leftPx = note.startBeat * pxPerBeat;
                    const widthPx = Math.max(8, note.durationBeats * pxPerBeat);
                    const hasFlex = se2FusionNoteHasFlexCurve(note, beatsPerBar);
                    const curveRows = curve
                      .map((p) => pitchRows.indexOf(p.pitch))
                      .filter((r) => r >= 0);
                    const minRow = curveRows.length ? Math.min(baseRow, ...curveRows) : baseRow;
                    const maxRow = curveRows.length ? Math.max(baseRow, ...curveRows) : baseRow;
                    const curveTop = minRow * ROW_H;
                    const curveH = (maxRow - minRow + 1) * ROW_H;
                    const polylinePoints = curve
                      .map((p) => {
                        const row = pitchRows.indexOf(p.pitch);
                        if (row < 0) return null;
                        const x = (p.beatOffset / note.durationBeats) * widthPx;
                        const y = (row - minRow) * ROW_H + ROW_H / 2;
                        return `${x},${y}`;
                      })
                      .filter(Boolean)
                      .join(' ');

                    return (
                      <div key={note.id}>
                        <div
                          data-fusion-note
                          data-fusion-base
                          className="absolute rounded-sm border touch-none"
                          style={{
                            left: leftPx,
                            width: widthPx,
                            top: baseRow * ROW_H + 2,
                            height: ROW_H - 4,
                            background: laneColor,
                            opacity: tool === 'flex' ? 0.18 : 0.32 + (note.velocity / 127) * 0.55,
                            borderColor: selected ? '#fff' : hasFlex ? '#fbbf2466' : 'rgba(255,255,255,0.15)',
                            boxShadow: selected ? `0 0 0 1px ${laneColor}` : `0 0 6px ${laneColor}22`,
                            zIndex: selected ? 4 : 2,
                            pointerEvents: tool === 'flex' ? 'none' : 'auto',
                            cursor:
                              tool === 'erase' ? 'not-allowed' : tool === 'pencil' ? 'pointer' : 'grab',
                          }}
                          title={`${se2FusionPianoRollKeyLabel(note.pitch)} · ${note.durationBeats.toFixed(2)} beats`}
                          onPointerDown={(e) => beginNoteBodyDrag(e, note, 'move')}
                        >
                          {tool !== 'flex' ? (
                            <div
                              className="absolute top-0 bottom-0 right-0 cursor-ew-resize"
                              style={{ width: RESIZE_HANDLE_W, background: 'rgba(255,255,255,0.12)' }}
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                beginNoteBodyDrag(e, note, 'resize-end');
                              }}
                            />
                          ) : null}
                        </div>

                        {hasFlex || tool === 'flex' ? (
                          <svg
                            className="absolute pointer-events-none overflow-visible"
                            style={{
                              left: leftPx,
                              top: curveTop,
                              width: widthPx,
                              height: curveH,
                              zIndex: tool === 'flex' ? 5 : 6,
                            }}
                          >
                            {polylinePoints ? (
                              <polyline
                                points={polylinePoints}
                                fill="none"
                                stroke="#fbbf24"
                                strokeWidth={2.5}
                                strokeLinejoin="round"
                                strokeLinecap="round"
                                opacity={0.95}
                              />
                            ) : null}
                          </svg>
                        ) : null}

                        {tool === 'flex' ? (
                          <div
                            className="absolute touch-none cursor-crosshair"
                            style={{
                              left: leftPx,
                              top: 0,
                              width: widthPx,
                              height: gridH,
                              zIndex: 7,
                            }}
                            title="Sketch pitch curve — drag at any angle; double-click adds point; Alt+click deletes"
                            onPointerDown={(e) => beginFlexSketch(e, note)}
                          />
                        ) : null}

                        {tool === 'flex'
                          ? curve.map((p) => {
                              const row = pitchRows.indexOf(p.pitch);
                              if (row < 0) return null;
                              const x = leftPx + (p.beatOffset / note.durationBeats) * widthPx;
                              const y = row * ROW_H + ROW_H / 2;
                              const isAnchor = p.id === 'flex-start' || p.id === 'flex-end';
                              return (
                                <div
                                  key={`${note.id}-${p.id}`}
                                  className="absolute rounded-full border-2 touch-none cursor-grab"
                                  style={{
                                    left: x - (isAnchor ? 4 : 5),
                                    top: y - (isAnchor ? 4 : 5),
                                    width: isAnchor ? 8 : 10,
                                    height: isAnchor ? 8 : 10,
                                    background: isAnchor ? '#fbbf2488' : '#fbbf24',
                                    borderColor: selected ? '#fff' : '#fde68a',
                                    zIndex: 9,
                                  }}
                                  onPointerDown={(e) => beginFlexSketch(e, note)}
                                />
                              );
                            })
                          : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              {showVelocity ? (
                <div className="flex border-t" style={{ width: rollContentW, borderColor: '#2a2a38', background: '#0a0a10' }}>
                  <div
                    className="sticky left-0 z-10 shrink-0 flex items-center justify-center text-[7px] font-bold uppercase"
                    style={{ width: KEY_W, height: VEL_LANE_H, color: '#666', background: '#111118', borderRight: '1px solid #333' }}
                  >
                    Vel
                  </div>
                  <div className="relative shrink-0" style={{ width: gridWidthPx, height: VEL_LANE_H }}>
                    {notes.map((note) => {
                      const leftPx = note.startBeat * pxPerBeat;
                      const widthPx = Math.max(4, note.durationBeats * pxPerBeat);
                      const h = (note.velocity / 127) * (VEL_LANE_H - 8);
                      return (
                        <div
                          key={`vel-${note.id}`}
                          className="absolute bottom-1 rounded-t-sm"
                          style={{
                            left: leftPx,
                            width: widthPx,
                            height: h,
                            background: `${laneColor}aa`,
                            opacity: 0.85,
                          }}
                          title={`Velocity ${note.velocity}`}
                          onPointerDown={(e) => {
                            if (disabled) return;
                            e.stopPropagation();
                            const rect = e.currentTarget.parentElement!.getBoundingClientRect();
                            const update = (clientY: number) => {
                              const y = clientY - rect.top;
                              const vel = Math.round((1 - y / VEL_LANE_H) * 127);
                              setVelocity(note.id, vel);
                            };
                            update(e.clientY);
                            const onMove = (ev: PointerEvent) => update(ev.clientY);
                            const onUp = () => {
                              window.removeEventListener('pointermove', onMove);
                              window.removeEventListener('pointerup', onUp);
                            };
                            window.addEventListener('pointermove', onMove);
                            window.addEventListener('pointerup', onUp);
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (rollExpanded && typeof document !== 'undefined') {
    return createPortal(rollShell, document.body);
  }

  return rollShell;
}
