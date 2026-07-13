import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MutableRefObject,
  type RefObject,
} from 'react';
import { Eraser, Maximize2, Minimize2, MousePointer2, Pencil, ZoomIn, ZoomOut } from 'lucide-react';
import { GrooveLabHelpTip } from '@/app/components/creation/GrooveLabHelpHub';
import { chordBassSeqChannelLabel } from '@/app/lib/creationStation/chordBassSequencerSession';
import {
  GROOVE_LAB_BASS_NOTE_COLOR,
  GROOVE_LAB_BASS_NOTE_EDGE,
  GROOVE_LAB_BASS_NOTE_INSET,
  GROOVE_LAB_MELODY_NOTE_COLOR,
  GROOVE_LAB_MELODY_NOTE_EDGE,
  GROOVE_LAB_MELODY_NOTE_INSET,
  GROOVE_LAB_CHORD_NOTE_COLOR,
  GROOVE_LAB_CHORD_NOTE_EDGE,
  GROOVE_LAB_CHORD_NOTE_INSET,
} from '@/app/lib/creationStation/grooveLabLayers';
import {
  GROOVE_LEAD_DISPLAY_NAME,
  GROOVE_LEAD_SHORT_LABEL,
  WAVE_LEAF_NOTE_COLOR,
  WAVE_LEAF_NOTE_EDGE,
  WAVE_LEAF_NOTE_INSET,
  WAVE_LEAF_UI,
} from '@/app/lib/creationStation/waveLeafBranding';
import {
  CB_PIANO_METRICS,
  CB_PIANO_MINT,
  CB_PIANO_MINT_BORDER,
  cbPianoGridRowStyle,
  cbPianoKeyCellStyle,
  cbPianoKeyFaceStyle,
  cbPianoKeyLabel,
  cbPianoKeyRailOuterStyle,
  cbPianoMidiToNoteName,
  cbPianoNoteNameToMidi,
  cbPianoPitchRowStyle,
  LAB808_PIANO_ROWS,
  pianoRowIndexForMidi,
} from '@/app/lib/creationStation/chordBuilderPianoRollTheme';
import {
  GROOVE_LAB_MEASURES_PER_BAR,
  GROOVE_LAB_SLOTS_PER_BEAT,
  grooveLabGridColumnLines,
  grooveLabGridLineStyle,
  grooveLabColsPerBar,
  grooveLabRulerQuantCells,
  grooveLabStepsPerBar,
  grooveLabStepsPerMeasure,
  grooveLabGlobalColToSlot,
  grooveLabSlotToGlobalCol,
  grooveLabTotalColumns,
} from '@/app/lib/creationStation/grooveLabGrid';
import {
  GROOVE_LAB_BAR_OPTIONS,
  GROOVE_LAB_QUANTIZE_OPTIONS,
  GROOVE_LAB_SLOTS_PER_BAR,
  grooveLabSlotsPerCell,
  grooveLabTotalSlots,
  quantizeGrooveHits,
  sanitizeGrooveLabChordChannelHits,
  snapGrooveSlot,
  snapGrooveSustain,
  type GrooveLabBarCount,
  type GrooveLabQuantize,
  type GrooveRollHit,
} from '@/app/lib/creationStation/grooveLabRoll';
import { isMidiFileName } from '@/app/lib/creationStation/grooveLabMidiImport';
import { grooveLabIsBassSubMidi } from '@/app/lib/creationStation/grooveComposerEngine';
import {
  grooveLabClampMelodyMidi,
  grooveLabIsChordStackMidi,
  grooveLabIsGuitarMidi,
  grooveLabIsMelodyMidi,
} from '@/app/lib/creationStation/grooveLabPitch';
import { waveLeafClampMidi } from '@/app/lib/creationStation/waveLeafPitch';
import { GrooveOctaveShiftButtons } from '@/app/components/creation/GrooveOctaveShiftButtons';
import { OrchidTransportControls } from '@/app/components/creation/OrchidTransportControls';
import { GrooveLabExportStrip } from '@/app/components/creation/GrooveLabExportStrip';
import { GROOVE_LAB_808_SUBROOTS_BANK_LABEL } from '@/app/lib/creationStation/grooveLabBranding';
import {
  grooveLabPianoRowsForScope,
  type GrooveLabRollLayerScope,
} from '@/app/lib/creationStation/grooveLabPianoRollLayers';

export type GrooveLabPianoRollProps = {
  channel: number;
  bassRootMidi: number;
  hits: GrooveRollHit[];
  onHitsChange: (hits: GrooveRollHit[] | ((prev: GrooveRollHit[]) => GrooveRollHit[])) => void;
  noteLengthSlots: number;
  onNoteLengthChange: (slots: number) => void;
  quantize: GrooveLabQuantize;
  onQuantizeChange: (q: GrooveLabQuantize) => void;
  barCount: number;
  onBarCountChange: (bars: GrooveLabBarCount) => void;
  onPreview?: () => void;
  onPreviewPitch?: (midi: number) => void;
  /** Guitar lane only — bypasses chord/melody preview routing. */
  onPreviewGuitarNote?: (midi: number, velocity01?: number) => void;
  /** Pointerdown on roll — unlock audio / preload guitar licks before preview. */
  onPrimeAudio?: () => void;
  /** Write chord voicing as spread notes at the next grid position. */
  onSpreadChord?: () => void;
  /** Remove every note at a slot (one chord strike). */
  onDeleteChordAtSlot?: (slot: number) => void;
  /** Grid column cursor for bass keypad placement. */
  editSlot?: number;
  onEditSlotChange?: (slot: number) => void;
  /** When set, writes bass at the given grid column (STP slot). */
  onPlaceBassNote?: (midi: number, anchorSlot: number, opts?: { sustainSlots?: number }) => void;
  /** Paint tool writes blue bass notes on every row (DRAW NOTES on bass keypad). */
  bassDrawNotes?: boolean;
  /** When true, show bass + chord channels together; mutations route by layer. */
  splitChannels?: boolean;
  bassHits?: GrooveRollHit[];
  chordHits?: GrooveRollHit[];
  melodyHits?: GrooveRollHit[];
  onBassHitsChange?: (hits: GrooveRollHit[]) => void;
  onChordHitsChange?: (hits: GrooveRollHit[]) => void;
  onMelodyHitsChange?: (hits: GrooveRollHit[]) => void;
  chordChannel?: number;
  melodyChannel?: number;
  /** Beat Lab–style playline element (parent drives transform from audio clock). */
  playheadElRef?: RefObject<HTMLDivElement | null>;
  /** Scroll container for the roll body — transport uses this to follow the playhead. */
  rollScrollRef?: RefObject<HTMLDivElement | null>;
  transportNotStopped?: boolean;
  /** Ruler / grid column highlight while transport runs. */
  activeGlobalCol?: number;
  onSeekCol?: (globalCol: number) => void;
  onPxPerColChange?: (px: number) => void;
  /** Drop a Standard MIDI File onto the roll (parent parses BPM + layers). */
  onMidiFileDrop?: (file: File) => void;
  onImportMidi?: (file: File) => void;
  midiImportStatus?: string | null;
  /** Roll transport — shown on the roll toolbar (required in full-screen view). */
  transportPlaying?: boolean;
  transportDisabled?: boolean;
  onTransportRewind?: () => void;
  onTransportStop?: () => void;
  onTransportPlayPause?: () => void;
  onTransportFastForward?: () => void;
  exportBusy?: boolean;
  exportStatus?: string | null;
  rollHasChords?: boolean;
  rollHasNotes?: boolean;
  onExportRollMidi?: () => void;
  onExportRollWav?: () => void | Promise<void>;
  onExportRollWavToPad?: () => void | Promise<void>;
  onSendRollToNewSynth?: () => void;
  padExportEnabled?: boolean;
  padPickerOpen?: boolean;
  showExportLabel?: boolean;
  subRootNoteCount?: number;
  onClearAllSubRoots?: () => void;
  onSubOctaveDown?: () => void;
  onSubOctaveUp?: () => void;
  chordStackNoteCount?: number;
  onChordOctaveDown?: () => void;
  onChordOctaveUp?: () => void;
  melodyLayerNoteCount?: number;
  onClearAllMelody?: () => void;
  onMelodyOctaveDown?: () => void;
  onMelodyOctaveUp?: () => void;
  /** Single work-lane roll (SUB, CHORD, or MELODY) — register-scoped keyboard rows. */
  layerScope?: GrooveLabRollLayerScope;
  /** full = tools + transport; strip = compact lane header (stacked 3-roll layout). */
  rollChrome?: 'full' | 'strip';
  layerStripTitle?: string;
  layerStripColor?: string;
  syncScrollLeft?: number;
  onScrollSync?: (scrollLeft: number) => void;
  /** Notifies parent so layout can grow the roll without covering Groove Studio keypads. */
  onRollExpandedChange?: (expanded: boolean) => void;
  /** Parent-controlled FULL view (keeps save + drag pitch clamp in sync). */
  rollExpanded?: boolean;
};

const M = CB_PIANO_METRICS;
const VEL_LANE_H = 10;
const GROOVE_ZOOM_STORAGE_KEY = 'groove-lab-px-per-col';
const GROOVE_ZOOM_MIN = 16;
const GROOVE_ZOOM_MAX = 160;
const GROOVE_ZOOM_DEFAULT = 48;
const GROOVE_ZOOM_STEP = 4;
const GROOVE_BASE_COLS_PER_BAR = 16; // DAW-style reference density (1/16)
/** Bar + 4 quarter measures + quantize step digits (Beat Lab / 808 Lab grid). */
const RULER_BAR_H = 18;
const RULER_MEASURE_H = 16;
const RULER_QUANT_H = 14;
const RULER_TOTAL_H = RULER_BAR_H + RULER_MEASURE_H + RULER_QUANT_H;

/** Sticky chrome above note layers — matches Beat Lab roll (keys/ruler stay on top while scrolling). */
const GROOVE_ROLL_Z_PLAYHEAD = 30;
const GROOVE_ROLL_Z_CORNER = 21;
const GROOVE_ROLL_Z_RULER = 20;
const GROOVE_ROLL_Z_KEYS = 19;
const GROOVE_ROLL_Z_CELLS_PAINT = 6;
const GROOVE_ROLL_Z_NOTES = 5;
const GROOVE_ROLL_Z_GRID = 1;

/** Full chromatic keyboard C1–C6 (same range as 808 Lab). */
const GROOVE_PIANO_ROWS = LAB808_PIANO_ROWS;
const GROOVE_PIANO_MIN_MIDI = cbPianoNoteNameToMidi('C1');
const GROOVE_PIANO_MAX_MIDI = cbPianoNoteNameToMidi('C6');
/** Notes align flush to the left grid line (column start). */
const NOTE_CELL_PAD = 0;
const NOTE_RESIZE_HANDLE_W = 14;

type GrooveRollTool = 'pointer' | 'paint' | 'erase';

function grooveLabRowIndexForMidi(midi: number, rows: readonly string[]): number {
  return pianoRowIndexForMidi(midi, rows);
}

function clampSus(slot: number, sus: number, q: GrooveLabQuantize, barCount: number): number {
  return snapGrooveSustain(slot, sus, q, barCount);
}

function hitId(h: GrooveRollHit): string {
  return `${h.slot}:${h.midi}`;
}

function hitAtRollCell(
  rowHits: GrooveRollHit[],
  slot: number,
  midi: number,
): GrooveRollHit | undefined {
  return rowHits.find(
    (h) => h.midi === midi && slot >= h.slot && slot < h.slot + h.sustainSlots,
  );
}

type GrooveRollLayer = 'bass' | 'melody' | 'chord';

function paintLayerForMidi(midi: number, scope?: GrooveLabRollLayerScope | null): GrooveRollLayer {
  if (scope === 'sub') return 'bass';
  if (scope === 'chord' || scope === 'sample') return 'chord';
  if (scope === 'guitar') return 'melody';
  if (scope === 'melody' || scope === 'waveleaf') return 'melody';
  if (grooveLabIsMelodyMidi(midi)) return 'melody';
  if (grooveLabIsGuitarMidi(midi)) return 'melody';
  if (grooveLabIsChordStackMidi(midi)) return 'chord';
  return 'bass';
}

type MultiDragState = {
  items: Array<{
    origSlot: number;
    origMidi: number;
    sustainSlots: number;
    vel: number;
  }>;
  anchorSlot: number;
  anchorMidi: number;
  curSlot: number;
  curMidi: number;
  startClientX: number;
  startClientY: number;
  moved: boolean;
  backupHits: GrooveRollHit[];
};

function clampRollMidi(midi: number): number {
  return Math.max(GROOVE_PIANO_MIN_MIDI, Math.min(GROOVE_PIANO_MAX_MIDI, Math.round(midi)));
}

type ResizeState = {
  startSlot: number;
  midi: number;
  endSlot: number;
};

export function GrooveLabPianoRoll({
  channel,
  bassRootMidi: bassRootMidiProp,
  hits,
  onHitsChange,
  noteLengthSlots,
  onNoteLengthChange,
  quantize,
  onQuantizeChange,
  barCount,
  onBarCountChange,
  onPreview,
  onPreviewPitch,
  onPreviewGuitarNote,
  onPrimeAudio,
  onSpreadChord,
  onDeleteChordAtSlot,
  editSlot = 0,
  onEditSlotChange,
  onPlaceBassNote,
  bassDrawNotes = false,
  splitChannels = false,
  bassHits: bassHitsProp,
  chordHits: chordHitsProp,
  melodyHits: melodyHitsProp,
  onBassHitsChange,
  onChordHitsChange,
  onMelodyHitsChange,
  chordChannel,
  melodyChannel,
  playheadElRef,
  rollScrollRef,
  transportNotStopped = false,
  activeGlobalCol = -1,
  onSeekCol,
  onPxPerColChange,
  onMidiFileDrop,
  onImportMidi,
  midiImportStatus = null,
  transportPlaying = false,
  transportDisabled = true,
  onTransportRewind,
  onTransportStop,
  onTransportPlayPause,
  onTransportFastForward,
  exportBusy,
  exportStatus,
  rollHasChords = false,
  rollHasNotes = false,
  onExportRollMidi,
  onExportRollWav,
  onExportRollWavToPad,
  onSendRollToNewSynth,
  padExportEnabled = true,
  padPickerOpen = false,
  showExportLabel = true,
  subRootNoteCount = 0,
  onClearAllSubRoots,
  onSubOctaveDown,
  onSubOctaveUp,
  chordStackNoteCount = 0,
  onChordOctaveDown,
  onChordOctaveUp,
  melodyLayerNoteCount = 0,
  onClearAllMelody,
  onMelodyOctaveDown,
  onMelodyOctaveUp,
  layerScope,
  rollChrome = 'full',
  layerStripTitle,
  layerStripColor = '#7cf4c6',
  syncScrollLeft,
  onScrollSync,
  onRollExpandedChange,
  rollExpanded: rollExpandedProp,
}: GrooveLabPianoRollProps) {
  const bassRootMidi = Number.isFinite(bassRootMidiProp) ? Math.round(bassRootMidiProp) : 36;
  const isLayerRoll = layerScope != null;
  const split = isLayerRoll
    ? false
    : Boolean(
        splitChannels &&
          bassHitsProp &&
          chordHitsProp &&
          melodyHitsProp &&
          onBassHitsChange &&
          onChordHitsChange &&
          onMelodyHitsChange,
      );
  const bassHits = split ? bassHitsProp! : hits;
  const chordHits = split ? chordHitsProp! : hits;
  const melodyHits = split ? melodyHitsProp! : [];
  const allHits = isLayerRoll ? hits : split ? [...bassHits, ...melodyHits, ...chordHits] : hits;
  const scopedLayer: GrooveRollLayer | null = isLayerRoll
    ? layerScope === 'sub'
      ? 'bass'
      : layerScope === 'chord' || layerScope === 'sample'
        ? 'chord'
        : layerScope === 'guitar' || layerScope === 'waveleaf' || layerScope === 'melody'
          ? 'melody'
          : 'melody'
    : null;

  /** One block per slot+midi (longest sustain) — avoids stacked duplicates on the roll. */
  const rollDisplayHits = useMemo(() => {
    const byKey = new Map<string, GrooveRollHit>();
    for (const h of allHits) {
      const key = hitId(h);
      const prev = byKey.get(key);
      if (!prev || h.sustainSlots > prev.sustainSlots) byKey.set(key, h);
    }
    return [...byKey.values()];
  }, [allHits]);

  type RollLayer = GrooveRollLayer;

  const noteLayer = useCallback(
    (note: GrooveRollHit): RollLayer => {
      if (scopedLayer) return scopedLayer;
      if (grooveLabIsMelodyMidi(note.midi)) return 'melody';
      if (grooveLabIsChordStackMidi(note.midi)) return 'chord';
      return 'bass';
    },
    [scopedLayer],
  );

  /** Scoped single-layer rolls (waveleaf / chord / sub) use `hits` — not split melodyHits (always []). */
  const layerHits = useCallback(
    (layer: RollLayer) => {
      if (isLayerRoll) return hits;
      if (layer === 'chord') return chordHits;
      if (layer === 'melody') return melodyHits;
      return bassHits;
    },
    [isLayerRoll, hits, bassHits, chordHits, melodyHits],
  );

  const [tool, setTool] = useState<GrooveRollTool>('pointer');
  const [rollExpandedLocal, setRollExpandedLocal] = useState(false);
  const rollExpanded = rollExpandedProp ?? rollExpandedLocal;
  const setRollExpanded = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      const resolved =
        typeof next === 'function' ? next(rollExpandedProp ?? rollExpandedLocal) : next;
      if (rollExpandedProp === undefined) setRollExpandedLocal(resolved);
      onRollExpandedChange?.(resolved);
    },
    [onRollExpandedChange, rollExpandedProp, rollExpandedLocal],
  );
  /** Full view = all keys C1–C6 so notes can be dragged anywhere; docked = lane register when scoped. */
  const activePianoRows = useMemo(
    () =>
      rollExpanded || !layerScope
        ? GROOVE_PIANO_ROWS
        : grooveLabPianoRowsForScope(layerScope),
    [layerScope, rollExpanded],
  );
  const [pxPerCol, setPxPerCol] = useState(GROOVE_ZOOM_DEFAULT);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [clipboard, setClipboard] = useState<GrooveRollHit[] | null>(null);
  const [previewKeyMidi, setPreviewKeyMidi] = useState<number | null>(null);
  const [midiDragOver, setMidiDragOver] = useState(false);
  const [, bump] = useState(0);
  const dragRef = useRef<MultiDragState | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);
  const paintEraseRef = useRef(false);
  const paintDrawRef = useRef(false);
  /** Latest channel hits for drag commit (avoids stale closure wiping the roll). */
  const hitsRef = useRef(hits);
  useEffect(() => {
    hitsRef.current = hits;
  }, [hits]);
  /** Bass / single-channel paint: one note per pointer down (no drag-fill). */
  const bassOneShotPaint = bassDrawNotes || !split;
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const midiImportFileRef = useRef<HTMLInputElement>(null);

  const selectedHits = useMemo(
    () => allHits.filter((h) => selectedIds.has(hitId(h))),
    [allHits, selectedIds],
  );

  const primarySelected = selectedHits[0] ?? null;

  const previewRollMidi = useCallback(
    (midi: number, vel = 0.88) => {
      if (onPreviewGuitarNote) onPreviewGuitarNote(midi, vel);
      else onPreviewPitch?.(midi);
    },
    [onPreviewGuitarNote, onPreviewPitch],
  );

  const isNoteSelected = useCallback((note: GrooveRollHit) => selectedIds.has(hitId(note)), [selectedIds]);

  const selectOnly = useCallback((note: GrooveRollHit) => {
    setSelectedIds(new Set([hitId(note)]));
  }, []);

  const toggleNoteSelection = useCallback((note: GrooveRollHit) => {
    const id = hitId(note);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllNotes = useCallback(() => {
    setSelectedIds(new Set(allHits.map((h) => hitId(h))));
  }, [allHits]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const setLayerHits = useCallback(
    (layer: RollLayer, next: GrooveRollHit[]) => {
      if (isLayerRoll) {
        onHitsChange(next);
        return;
      }
      if (split) {
        if (layer === 'chord') {
          onChordHitsChange!(next);
          return;
        }
        if (layer === 'melody') {
          onMelodyHitsChange!(next);
          return;
        }
        onBassHitsChange!(next);
        return;
      }
      const chordKeep =
        layer === 'chord'
          ? next
          : allHits.filter((h) => grooveLabIsChordStackMidi(h.midi));
      const melodyKeep =
        layer === 'melody'
          ? next
          : allHits.filter((h) => grooveLabIsMelodyMidi(h.midi));
      const subKeep =
        layer === 'bass'
          ? next
          : allHits.filter((h) => grooveLabIsBassSubMidi(h.midi));
      const merged = [...subKeep, ...melodyKeep, ...chordKeep];
      const byKey = new Map<string, GrooveRollHit>();
      for (const h of merged) byKey.set(hitId(h), h);
      onHitsChange([...byKey.values()]);
    },
    [isLayerRoll, split, allHits, bassHits, onHitsChange, onBassHitsChange, onChordHitsChange, onMelodyHitsChange],
  );
  const setBodyScrollEl = useCallback(
    (el: HTMLDivElement | null) => {
      bodyScrollRef.current = el;
      if (rollScrollRef) {
        (rollScrollRef as MutableRefObject<HTMLDivElement | null>).current = el;
      }
    },
    [rollScrollRef],
  );

  useEffect(() => {
    const el = bodyScrollRef.current;
    if (!el || !onScrollSync) return;
    const onScroll = () => onScrollSync(el.scrollLeft);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [onScrollSync]);

  useEffect(() => {
    if (syncScrollLeft == null || !Number.isFinite(syncScrollLeft)) return;
    const el = bodyScrollRef.current;
    if (el && Math.abs(el.scrollLeft - syncScrollLeft) > 0.5) el.scrollLeft = syncScrollLeft;
  }, [syncScrollLeft]);
  const gridBodyRef = useRef<HTMLDivElement>(null);
  const channelLabel =
    layerStripTitle ??
    (split && chordChannel != null && melodyChannel != null
      ? `SUB ${chordBassSeqChannelLabel(channel)} · MELODY ${chordBassSeqChannelLabel(melodyChannel)} · CHORD ${chordBassSeqChannelLabel(chordChannel)}`
      : chordBassSeqChannelLabel(channel));
  const showFullChrome = rollChrome === 'full';
  const showStripChrome = isLayerRoll && rollChrome === 'strip';
  const snapStep = Math.max(1, grooveLabSlotsPerCell(quantize));
  const colsPerBar = grooveLabColsPerBar(quantize);
  const totalCols = Math.max(1, grooveLabTotalColumns(quantize, barCount) || 1);
  const totalSlots = grooveLabTotalSlots(barCount);
  /** DAW-style layout: keep bar time-width stable; slot width changes with quantize. */
  const colW = (pxPerCol * GROOVE_BASE_COLS_PER_BAR) / Math.max(1, colsPerBar);
  const gridWidth = totalCols * colW;
  const colToPx = useCallback((col: number) => col * colW, [colW]);
  const clampZoom = useCallback(
    (v: number) => Math.max(GROOVE_ZOOM_MIN, Math.min(GROOVE_ZOOM_MAX, Math.round(v))),
    [],
  );
  const gridColLines = useMemo(() => grooveLabGridColumnLines(quantize, barCount), [quantize, barCount]);
  const quantCells = useMemo(() => grooveLabRulerQuantCells(quantize, barCount), [quantize, barCount]);
  const stepsInBar = grooveLabStepsPerBar(quantize);
  const stepsPerMeasure = grooveLabStepsPerMeasure(quantize);
  const barCountSafe = Math.max(1, Math.round(barCount));
  const barWidthPx = colsPerBar * colW;
  const measureWidthPx = barWidthPx / GROOVE_LAB_MEASURES_PER_BAR;

  const midiFileFromDataTransfer = useCallback((dt: DataTransfer): File | null => {
    const files = dt.files;
    if (!files?.length) return null;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f && isMidiFileName(f.name)) return f;
    }
    return null;
  }, []);

  const onMidiDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!onMidiFileDrop) return;
      if (!midiFileFromDataTransfer(e.dataTransfer)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setMidiDragOver(true);
    },
    [onMidiFileDrop, midiFileFromDataTransfer],
  );

  const onMidiDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setMidiDragOver(false);
  }, []);

  const onMidiDrop = useCallback(
    (e: React.DragEvent) => {
      setMidiDragOver(false);
      if (!onMidiFileDrop) return;
      const file = midiFileFromDataTransfer(e.dataTransfer);
      if (!file) return;
      e.preventDefault();
      e.stopPropagation();
      onMidiFileDrop(file);
    },
    [onMidiFileDrop, midiFileFromDataTransfer],
  );

  const snapSlot = useCallback(
    (s: number) => snapGrooveSlot(s, quantize, barCount),
    [quantize, barCount],
  );

  const slotFromClientX = useCallback(
    (clientX: number) => {
      const el = gridBodyRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      const col = Math.max(0, Math.min(totalCols - 1, Math.floor((clientX - rect.left) / colW)));
      return snapSlot(grooveLabGlobalColToSlot(col, quantize));
    },
    [colW, totalCols, quantize, snapSlot],
  );

  const midiFromClientY = useCallback((clientY: number) => {
    const el = gridBodyRef.current;
    if (!el) return GROOVE_PIANO_MIN_MIDI;
    const rect = el.getBoundingClientRect();
    const row = Math.max(
      0,
      Math.min(activePianoRows.length - 1, Math.floor((clientY - rect.top) / M.rowH)),
    );
    return cbPianoNoteNameToMidi(activePianoRows[row]!);
  }, [activePianoRows]);

  const noteColumnLayout = useCallback(
    (slot: number, sustainSlots: number) => {
      const snappedSlot = snapSlot(slot);
      const sus = Math.max(snapStep, Math.round(sustainSlots / snapStep) * snapStep);
      const colStart = grooveLabSlotToGlobalCol(snappedSlot, quantize);
      const endSlot = Math.min(totalSlots - 1, snappedSlot + sus - 1);
      const colEnd = grooveLabSlotToGlobalCol(endSlot, quantize);
      const colSpan = Math.max(1, colEnd - colStart + 1);
      return {
        slot: snappedSlot,
        sustainSlots: colSpan * snapStep,
        colStart,
        colSpan,
        left: colStart * colW,
        width: Math.max(3, colSpan * colW),
      };
    },
    [snapSlot, snapStep, quantize, totalSlots, colW],
  );

  const pitchBandH = activePianoRows.length * M.rowH;
  const gridBodyH = pitchBandH;

  const lengthOptions = useMemo(() => {
    const opts: number[] = [];
    for (let n = snapStep; n <= totalSlots; n += snapStep) opts.push(n);
    return opts.length > 0 ? opts : [snapStep];
  }, [snapStep]);

  const safeNoteLength = useMemo(() => {
    if (Number.isFinite(noteLengthSlots) && lengthOptions.includes(noteLengthSlots)) {
      return noteLengthSlots;
    }
    return lengthOptions[0] ?? snapStep;
  }, [noteLengthSlots, lengthOptions, snapStep]);

  const deleteNote = useCallback(
    (note: GrooveRollHit) => {
      const layer = noteLayer(note);
      setLayerHits(
        layer,
        layerHits(layer).filter((h) => !(h.slot === note.slot && h.midi === note.midi)),
      );
      setSelectedIds((prev) => {
        const id = hitId(note);
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      bump((n) => n + 1);
    },
    [noteLayer, layerHits, setLayerHits],
  );

  const deleteSelectedNotes = useCallback(() => {
    if (selectedIds.size === 0) return;
    if (split) {
      onBassHitsChange!(
        bassHits.filter((h) => !selectedIds.has(hitId(h))),
      );
      onMelodyHitsChange!(
        melodyHits.filter((h) => !selectedIds.has(hitId(h))),
      );
      onChordHitsChange!(
        chordHits.filter((h) => !selectedIds.has(hitId(h))),
      );
    } else {
      onHitsChange(hits.filter((h) => !selectedIds.has(hitId(h))));
    }
    clearSelection();
    bump((n) => n + 1);
  }, [
    selectedIds,
    split,
    bassHits,
    chordHits,
    hits,
    onHitsChange,
    onBassHitsChange,
    onMelodyHitsChange,
    onChordHitsChange,
    melodyHits,
    clearSelection,
  ]);

  const deleteChordAtSlot = useCallback(
    (slot: number) => {
      if (onDeleteChordAtSlot) {
        onDeleteChordAtSlot(slot);
      } else {
        onHitsChange(hits.filter((h) => h.slot !== slot));
      }
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const h of allHits) {
          if (h.slot === slot) next.delete(hitId(h));
        }
        return next;
      });
      bump((n) => n + 1);
    },
    [hits, onHitsChange, onDeleteChordAtSlot, allHits],
  );

  const dragDeltaFromPointer = useCallback(
    (d: MultiDragState, clientX: number, clientY: number) => {
      const anchorCol = grooveLabSlotToGlobalCol(d.anchorSlot, quantize);
      const deltaCols = Math.round((clientX - d.startClientX) / colW);
      const curCol = Math.max(0, Math.min(totalCols - 1, anchorCol + deltaCols));
      const curSlot = snapSlot(grooveLabGlobalColToSlot(curCol, quantize));
      const anchorRow = grooveLabRowIndexForMidi(d.anchorMidi, activePianoRows);
      const deltaRows = Math.round((clientY - d.startClientY) / M.rowH);
      const curRow = Math.max(
        0,
        Math.min(activePianoRows.length - 1, anchorRow + deltaRows),
      );
      const curMidi = cbPianoNoteNameToMidi(activePianoRows[curRow]!);
      return {
        curSlot,
        curMidi,
        dSlot: curSlot - d.anchorSlot,
        dMidi: curMidi - d.anchorMidi,
      };
    },
    [quantize, colW, totalCols, snapSlot, activePianoRows],
  );

  const beginDrag = useCallback(
    (note: GrooveRollHit, startX: number, startY: number, opts?: { multi?: boolean }) => {
      const multi =
        opts?.multi === true &&
        selectedIds.has(hitId(note)) &&
        selectedIds.size > 1;
      const dragItems = multi
        ? allHits.filter((h) => selectedIds.has(hitId(h)))
        : [note];
      if (!multi) setSelectedIds(new Set([hitId(note)]));
      const backupHits = hitsRef.current.map((h) => ({ ...h }));
      dragRef.current = {
        items: dragItems.map((h) => ({
          origSlot: h.slot,
          origMidi: h.midi,
          sustainSlots: h.sustainSlots,
          vel: h.vel,
        })),
        anchorSlot: note.slot,
        anchorMidi: note.midi,
        curSlot: note.slot,
        curMidi: note.midi,
        startClientX: startX,
        startClientY: startY,
        moved: false,
        backupHits,
      };
      bump((n) => n + 1);
      const TH = 5;
      const onMove = (ev: PointerEvent) => {
        const d = dragRef.current;
        if (!d) return;
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (!d.moved && dx * dx + dy * dy < TH * TH) return;
        const { curSlot, curMidi, dSlot, dMidi } = dragDeltaFromPointer(d, ev.clientX, ev.clientY);
        if (d.curSlot !== curSlot || d.curMidi !== curMidi) {
          d.curSlot = curSlot;
          d.curMidi = curMidi;
          d.moved = d.moved || dSlot !== 0 || dMidi !== 0;
          bump((n) => n + 1);
        }
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        const d = dragRef.current;
        dragRef.current = null;
        bump((n) => n + 1);
        if (!d?.moved) return;
        const useDSlot = d.curSlot - d.anchorSlot;
        const semiDelta = d.curMidi - d.anchorMidi;
        /** Commit against what the roll is showing (not stale raw channel storage). */
        const commitSource = [...hitsRef.current];
        const newSel = new Set<string>();
        const applyMove = (list: GrooveRollHit[], layerFilter?: 'bass' | 'melody' | 'chord') => {
          const dragKeys = new Set(
            d.items.map((it) => `${it.origSlot}:${it.origMidi}`),
          );
          const next = list.filter((h) => {
            if (layerFilter && noteLayer(h) !== layerFilter) return true;
            return !dragKeys.has(`${h.slot}:${h.midi}`);
          });
          for (const item of d.items) {
            const orig = commitSource.find(
              (h) => h.slot === item.origSlot && h.midi === item.origMidi,
            );
            if (layerFilter && orig && noteLayer(orig) !== layerFilter) continue;
            let newMidi = Math.round(item.origMidi + semiDelta);
            if (layerScope === 'waveleaf') {
              newMidi = rollExpanded
                ? grooveLabClampMelodyMidi(newMidi)
                : waveLeafClampMidi(newMidi);
            } else {
              newMidi = Math.max(
                GROOVE_PIANO_MIN_MIDI,
                Math.min(GROOVE_PIANO_MAX_MIDI, newMidi),
              );
              if (grooveLabRowIndexForMidi(newMidi, activePianoRows) < 0) continue;
            }
            const box = noteColumnLayout(snapSlot(item.origSlot + useDSlot), item.sustainSlots);
            const moved: GrooveRollHit = {
              slot: box.slot,
              midi: newMidi,
              sustainSlots: box.sustainSlots,
              vel: orig?.vel ?? item.vel ?? 0.88,
            };
            const dup = next.findIndex((h) => h.slot === moved.slot && h.midi === moved.midi);
            if (dup >= 0) next.splice(dup, 1);
            next.push(moved);
            newSel.add(hitId(moved));
          }
          return next.length > 0 || d.items.length === 0 ? next : list;
        };
        if (split) {
          onBassHitsChange!(applyMove(bassHits, 'bass'));
          onMelodyHitsChange!(applyMove(melodyHits, 'melody'));
          onChordHitsChange!(applyMove(chordHits, 'chord'));
        } else {
          const movedHits = applyMove(commitSource);
          onHitsChange(
            movedHits.length > 0 || d.items.length === 0 ? movedHits : d.backupHits,
          );
        }
        setSelectedIds(newSel);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [
      selectedIds,
      allHits,
      noteLayer,
      bassHits,
      chordHits,
      melodyHits,
      split,
      onHitsChange,
      onBassHitsChange,
      onMelodyHitsChange,
      onChordHitsChange,
      noteColumnLayout,
      dragDeltaFromPointer,
      snapSlot,
      layerScope,
      rollExpanded,
      activePianoRows,
    ],
  );

  const beginResize = useCallback(
    (note: GrooveRollHit) => {
      selectOnly(note);
      const layout = noteColumnLayout(note.slot, note.sustainSlots);
      const origSlot = note.slot;
      const origMidi = note.midi;
      resizeRef.current = {
        startSlot: layout.slot,
        midi: note.midi,
        endSlot: Math.min(totalSlots - 1, layout.slot + layout.sustainSlots - 1),
      };
      const backupHits = hitsRef.current.map((h) => ({ ...h }));
      bump((n) => n + 1);
      const onMove = (ev: PointerEvent) => {
        const r = resizeRef.current;
        if (!r) return;
        const target = slotFromClientX(ev.clientX);
        r.endSlot = Math.max(r.startSlot, target);
        bump((n) => n + 1);
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        const r = resizeRef.current;
        resizeRef.current = null;
        bump((n) => n + 1);
        if (!r) return;
        const startCol = grooveLabSlotToGlobalCol(r.startSlot, quantize);
        const endCol = grooveLabSlotToGlobalCol(r.endSlot, quantize);
        const colSpan = Math.max(1, endCol - startCol + 1);
        const sus = clampSus(r.startSlot, colSpan * snapStep, quantize, barCount);
        const base = [...hitsRef.current];
        const layer = noteLayer(note);
        const next = base.map((h) =>
          h.slot === origSlot && h.midi === origMidi ? { ...h, sustainSlots: sus } : h,
        );
        const out = next.length > 0 ? next : backupHits;
        setLayerHits(layer, out);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [
      noteColumnLayout,
      slotFromClientX,
      allHits,
      noteLayer,
      layerHits,
      setLayerHits,
      quantize,
      barCount,
      snapStep,
      totalSlots,
    ],
  );

  const addNoteAt = useCallback(
    (
      slot: number,
      midi: number,
      layer: GrooveRollLayer = 'chord',
      sustainSlots = safeNoteLength,
    ) => {
      const snapped = snapSlot(slot);
      const list = layerHits(layer);
      const existing = list.find((h) => h.slot === snapped && h.midi === midi);
      if (tool === 'erase' || (tool === 'paint' && existing)) {
        setLayerHits(layer, list.filter((h) => !(h.slot === snapped && h.midi === midi)));
        if (existing) clearSelection();
        return;
      }
      const box = noteColumnLayout(snapped, sustainSlots);
      const note: GrooveRollHit = {
        slot: box.slot,
        midi,
        sustainSlots: box.sustainSlots,
        vel: primarySelected?.vel ?? 0.88,
      };
      setLayerHits(layer, [...list, note]);
      setSelectedIds(new Set([hitId(note)]));
    },
    [tool, layerHits, setLayerHits, primarySelected, safeNoteLength, noteColumnLayout, clearSelection, snapSlot],
  );

  const handleQuantizeAll = useCallback(() => {
    if (split) {
      onBassHitsChange!(quantizeGrooveHits(bassHits, quantize, barCount));
      onMelodyHitsChange!(quantizeGrooveHits(melodyHits, quantize, barCount));
      onChordHitsChange!(quantizeGrooveHits(chordHits, quantize, barCount));
      return;
    }
    onHitsChange(quantizeGrooveHits(hits, quantize, barCount));
  }, [
    split,
    bassHits,
    melodyHits,
    chordHits,
    hits,
    onHitsChange,
    onBassHitsChange,
    onMelodyHitsChange,
    onChordHitsChange,
    quantize,
    barCount,
  ]);

  const handleCopy = useCallback(() => {
    const src = selectedHits.length > 0 ? selectedHits : allHits;
    if (src.length === 0) return;
    setClipboard(src.map((h) => ({ ...h })));
  }, [allHits, selectedHits]);

  const handlePaste = useCallback(() => {
    if (!clipboard?.length) return;
    const pasted = clipboard.map((h) => ({
      ...h,
      slot: snapGrooveSlot(h.slot, quantize, barCount),
      sustainSlots: snapGrooveSustain(
        snapGrooveSlot(h.slot, quantize, barCount),
        h.sustainSlots,
        quantize,
        barCount,
      ),
    }));
    if (split) {
      onBassHitsChange!(pasted);
      return;
    }
    onHitsChange(pasted);
  }, [clipboard, split, onHitsChange, onBassHitsChange, quantize, barCount]);

  const setSelectedVelocity = useCallback(
    (vel: number) => {
      if (selectedHits.length === 0) return;
      const v = Math.max(0.05, Math.min(1, vel));
      if (split) {
        onBassHitsChange!(
          bassHits.map((h) => (selectedIds.has(hitId(h)) ? { ...h, vel: v } : h)),
        );
        onMelodyHitsChange!(
          melodyHits.map((h) => (selectedIds.has(hitId(h)) ? { ...h, vel: v } : h)),
        );
        onChordHitsChange!(
          chordHits.map((h) => (selectedIds.has(hitId(h)) ? { ...h, vel: v } : h)),
        );
      } else {
        onHitsChange(hits.map((h) => (selectedIds.has(hitId(h)) ? { ...h, vel: v } : h)));
      }
    },
    [
      selectedHits,
      selectedIds,
      split,
      bassHits,
      melodyHits,
      chordHits,
      hits,
      onHitsChange,
      onBassHitsChange,
      onMelodyHitsChange,
      onChordHitsChange,
    ],
  );

  const nudgeSelectedOctave = useCallback(
    (dir: 1 | -1) => {
      if (selectedHits.length === 0) return;
      const newSel = new Set<string>();
      const applyOctave = (list: GrooveRollHit[]) => {
        const next: GrooveRollHit[] = [];
        for (const h of list) {
          if (!selectedIds.has(hitId(h))) {
            next.push(h);
            continue;
          }
          const newMidi = h.midi + dir * 12;
          if (newMidi < GROOVE_PIANO_MIN_MIDI || newMidi > GROOVE_PIANO_MAX_MIDI) continue;
          if (grooveLabRowIndexForMidi(newMidi, activePianoRows) < 0) continue;
          if (next.some((x) => x.slot === h.slot && x.midi === newMidi)) continue;
          const moved = { ...h, midi: newMidi };
          next.push(moved);
          newSel.add(hitId(moved));
        }
        return next;
      };
      if (split) {
        onBassHitsChange!(applyOctave(bassHits));
        onMelodyHitsChange!(applyOctave(melodyHits));
        onChordHitsChange!(applyOctave(chordHits));
      } else {
        onHitsChange(applyOctave(hits));
      }
      setSelectedIds(newSel);
    },
    [
      selectedHits,
      selectedIds,
      split,
      bassHits,
      melodyHits,
      chordHits,
      hits,
      onHitsChange,
      onBassHitsChange,
      onMelodyHitsChange,
      onChordHitsChange,
    ],
  );

  const nudgeSelectedSlot = useCallback(
    (dir: 1 | -1) => {
      if (selectedHits.length === 0) return;
      const newSel = new Set<string>();
      const applySlot = (list: GrooveRollHit[]) => {
        const next: GrooveRollHit[] = [];
        for (const h of list) {
          if (!selectedIds.has(hitId(h))) {
            next.push(h);
            continue;
          }
          const box = noteColumnLayout(snapSlot(h.slot + dir * snapStep), h.sustainSlots);
          if (next.some((x) => x.slot === box.slot && x.midi === h.midi)) continue;
          const moved = { ...h, slot: box.slot, sustainSlots: box.sustainSlots };
          next.push(moved);
          newSel.add(hitId(moved));
        }
        return next;
      };
      if (split) {
        onBassHitsChange!(applySlot(bassHits));
        onMelodyHitsChange!(applySlot(melodyHits));
        onChordHitsChange!(applySlot(chordHits));
      } else {
        onHitsChange(applySlot(hits));
      }
      setSelectedIds(newSel);
    },
    [
      selectedHits,
      selectedIds,
      snapSlot,
      snapStep,
      split,
      bassHits,
      melodyHits,
      chordHits,
      hits,
      onHitsChange,
      onBassHitsChange,
      onMelodyHitsChange,
      onChordHitsChange,
      noteColumnLayout,
    ],
  );

  const nudgeSelectedSemitone = useCallback(
    (dir: 1 | -1) => {
      if (selectedHits.length === 0) return;
      const newSel = new Set<string>();
      const applySemi = (list: GrooveRollHit[]) => {
        const next: GrooveRollHit[] = [];
        for (const h of list) {
          if (!selectedIds.has(hitId(h))) {
            next.push(h);
            continue;
          }
          const rawMidi = h.midi + dir;
          const newMidi =
            layerScope === 'waveleaf'
              ? rollExpanded
                ? grooveLabClampMelodyMidi(rawMidi)
                : waveLeafClampMidi(rawMidi)
              : rawMidi;
          if (newMidi < GROOVE_PIANO_MIN_MIDI || newMidi > GROOVE_PIANO_MAX_MIDI) continue;
          if (grooveLabRowIndexForMidi(newMidi, activePianoRows) < 0) continue;
          if (next.some((x) => x.slot === h.slot && x.midi === newMidi)) continue;
          const moved = { ...h, midi: newMidi };
          next.push(moved);
          newSel.add(hitId(moved));
        }
        return next;
      };
      if (split) {
        onBassHitsChange!(applySemi(bassHits));
        onMelodyHitsChange!(applySemi(melodyHits));
        onChordHitsChange!(applySemi(chordHits));
      } else {
        onHitsChange(applySemi(hits));
      }
      setSelectedIds(newSel);
    },
    [
      selectedHits,
      selectedIds,
      split,
      bassHits,
      melodyHits,
      chordHits,
      hits,
      onHitsChange,
      onBassHitsChange,
      onMelodyHitsChange,
      onChordHitsChange,
      layerScope,
      rollExpanded,
    ],
  );

  const splitNoteAtSlot = useCallback(
    (note: GrooveRollHit, splitAtSlot: number) => {
      const snapped = snapSlot(splitAtSlot);
      const leftLen = snapped - note.slot;
      const rightLen = note.slot + note.sustainSlots - snapped;
      if (leftLen < snapStep || rightLen < snapStep) return;
      const layer = noteLayer(note);
      const left = noteColumnLayout(note.slot, leftLen);
      const right = noteColumnLayout(snapped, rightLen);
      const list = layerHits(layer).filter(
        (h) => !(h.slot === note.slot && h.midi === note.midi),
      );
      list.push(
        { ...note, slot: left.slot, sustainSlots: left.sustainSlots },
        { ...note, slot: right.slot, sustainSlots: right.sustainSlots },
      );
      setLayerHits(layer, list);
      setSelectedIds(new Set([hitId({ ...note, slot: right.slot, midi: note.midi })]));
    },
    [snapSlot, snapStep, noteLayer, layerHits, setLayerHits, noteColumnLayout],
  );

  const drag = dragRef.current;
  const rz = resizeRef.current;
  const lastPaintCellRef = useRef<{ slot: number; midi: number } | null>(null);

  const focusEditSlot = useCallback(
    (slot: number) => {
      const snapped = snapSlot(slot);
      onEditSlotChange?.(snapped);
    },
    [onEditSlotChange, snapSlot],
  );

  const placeAtCell = useCallback(
    (slot: number, midi: number) => {
      const snapped = snapSlot(slot);
      focusEditSlot(snapped);
      if (
        lastPaintCellRef.current?.slot === snapped &&
        lastPaintCellRef.current?.midi === midi
      ) {
        return;
      }
      lastPaintCellRef.current = { slot: snapped, midi };
      if (bassDrawNotes && onPlaceBassNote && grooveLabIsBassSubMidi(midi)) {
        onPlaceBassNote(midi, snapped, { sustainSlots: snapStep });
        return;
      }
      addNoteAt(snapped, midi, paintLayerForMidi(midi, layerScope), snapStep);
    },
    [focusEditSlot, bassDrawNotes, onPlaceBassNote, snapSlot, addNoteAt, snapStep],
  );

  const cellPointerDown = useCallback(
    (e: React.PointerEvent, slot: number, midi: number, rowHits: GrooveRollHit[]) => {
      if (!e.isPrimary || e.button !== 0) return;
      if (!onPreviewGuitarNote) onPrimeAudio?.();
      else {
        try {
          onPrimeAudio?.();
        } catch {
          /* sync unlock */
        }
      }
      e.preventDefault();
      e.stopPropagation();
      const snapped = snapSlot(slot);
      const cellHit = hitAtRollCell(rowHits, snapped, midi);

      if (tool === 'pointer') {
        focusEditSlot(snapped);
        if (cellHit) {
          previewRollMidi(midi, cellHit.vel);
          const multiDrag =
            e.shiftKey && selectedIds.has(hitId(cellHit)) && selectedIds.size > 1;
          if (!multiDrag) setSelectedIds(new Set([hitId(cellHit)]));
          beginDrag(cellHit, e.clientX, e.clientY, { multi: multiDrag });
          return;
        }
        addNoteAt(snapped, midi, paintLayerForMidi(midi, layerScope), safeNoteLength);
        previewRollMidi(midi);
        return;
      }

      if (tool === 'erase') {
        focusEditSlot(snapped);
        paintEraseRef.current = true;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        if (cellHit) deleteNote(cellHit);
        return;
      }

      paintDrawRef.current = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      placeAtCell(slot, midi);
    },
    [
      tool,
      snapSlot,
      focusEditSlot,
      addNoteAt,
      safeNoteLength,
      deleteNote,
      placeAtCell,
      selectedIds,
      beginDrag,
      layerScope,
      previewRollMidi,
      onPrimeAudio,
    ],
  );

  useEffect(() => {
    const up = () => {
      paintEraseRef.current = false;
      paintDrawRef.current = false;
      lastPaintCellRef.current = null;
    };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  useEffect(() => {
    if (safeNoteLength === noteLengthSlots) return;
    onNoteLengthChange(safeNoteLength);
  }, [safeNoteLength, noteLengthSlots, onNoteLengthChange]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(GROOVE_ZOOM_STORAGE_KEY);
      const v = Number(raw);
      if (Number.isFinite(v)) setPxPerCol(clampZoom(v));
    } catch {
      /* ignore */
    }
  }, [clampZoom]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(GROOVE_ZOOM_STORAGE_KEY, String(pxPerCol));
    } catch {
      /* quota */
    }
  }, [pxPerCol]);

  useEffect(() => {
    onPxPerColChange?.(colW);
  }, [colW, onPxPerColChange]);

  useEffect(() => {
    if (!rollExpanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setRollExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rollExpanded]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        selectAllNotes();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedHits.length === 0) return;
        e.preventDefault();
        deleteSelectedNotes();
        return;
      }
      if (selectedHits.length === 0) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        nudgeSelectedSlot(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        nudgeSelectedSlot(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        nudgeSelectedSemitone(1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        nudgeSelectedSemitone(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    selectedHits,
    selectAllNotes,
    deleteSelectedNotes,
    nudgeSelectedSlot,
    nudgeSelectedSemitone,
  ]);

  const onRollWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!e.ctrlKey && !e.altKey) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -GROOVE_ZOOM_STEP : GROOVE_ZOOM_STEP;
      setPxPerCol((w) => clampZoom(w + delta));
    },
    [clampZoom],
  );

  const paintMode = tool === 'paint' || tool === 'erase';
  /** MOVE tool: notes above grid cells so drag / resize handles receive clicks. */
  const cellsAboveNotes = paintMode;

  const gridTimeRuler = useMemo(
    () => (
      <div
        style={{
          width: gridWidth,
          minWidth: gridWidth,
          flexShrink: 0,
          background: '#0a1018',
          borderBottom: `1px solid ${CB_PIANO_MINT_BORDER}`,
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            position: 'relative',
            height: RULER_BAR_H,
            borderBottom: '1px solid rgba(255,255,255,0.12)',
            background: 'linear-gradient(180deg, #1c1c26 0%, #12121a 100%)',
            display: 'flex',
          }}
        >
          {Array.from({ length: barCountSafe }, (_, i) => (
            <div
              key={`bar-${i + 1}`}
              style={{
                width: barWidthPx,
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                paddingLeft: 4,
                fontSize: 9,
                fontWeight: 700,
                color: '#c4c4d0',
                fontFamily: 'monospace',
                borderLeft: `1px solid ${CB_PIANO_MINT_BORDER}`,
                boxSizing: 'border-box',
                flexShrink: 0,
              }}
              title={`Bar ${i + 1}`}
            >
              {i + 1}
            </div>
          ))}
        </div>
        <div
          style={{
            height: RULER_MEASURE_H,
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
          }}
        >
          {Array.from({ length: barCountSafe }, (_, barIdx) => (
            <div
              key={`meas-bar-${barIdx + 1}`}
              style={{
                width: barWidthPx,
                height: '100%',
                display: 'flex',
                boxSizing: 'border-box',
                flexShrink: 0,
                borderLeft: `1px solid ${CB_PIANO_MINT_BORDER}`,
              }}
            >
              {Array.from({ length: GROOVE_LAB_MEASURES_PER_BAR }, (_, m) => (
                <div
                  key={`meas-${barIdx + 1}-${m + 1}`}
                  style={{
                    width: measureWidthPx,
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 8,
                    fontWeight: 800,
                    color: '#8e8e9e',
                    fontFamily: 'monospace',
                    borderLeft: m === 0 ? 'none' : '1px solid rgba(255,255,255,0.08)',
                    boxSizing: 'border-box',
                    flexShrink: 0,
                  }}
                  title={`Measure ${m + 1} of ${GROOVE_LAB_MEASURES_PER_BAR}`}
                >
                  {m + 1}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ position: 'relative', height: RULER_QUANT_H }}>
          {quantCells.map((c) => {
            const lit = c.col === activeGlobalCol && transportNotStopped;
            return (
              <div
                key={`q-${c.col}`}
                role={onSeekCol ? 'button' : undefined}
                tabIndex={onSeekCol ? 0 : undefined}
                onClick={onSeekCol ? () => onSeekCol(c.col) : undefined}
                onKeyDown={
                  onSeekCol
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSeekCol(c.col);
                        }
                      }
                    : undefined
                }
                style={{
                  position: 'absolute',
                  left: c.col * colW,
                    width: colW,
                  height: '100%',
                  fontSize: 7,
                  color: lit ? '#ecfdf5' : '#67e8f9',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: lit ? 'rgba(124, 244, 198, 0.14)' : undefined,
                  borderLeft:
                    c.col === 0
                      ? `1px solid ${CB_PIANO_MINT_BORDER}`
                      : c.col % colsPerBar === 0
                        ? `1px solid ${CB_PIANO_MINT_BORDER}`
                        : (c.col % colsPerBar) % stepsPerMeasure === 0
                          ? '1px solid rgba(103,232,249,0.35)'
                          : '1px solid rgba(103,232,249,0.12)',
                  fontFamily: 'monospace',
                  boxSizing: 'border-box',
                  cursor: onSeekCol ? 'pointer' : undefined,
                }}
                title={`Bar ${c.bar} · ${quantize} step ${c.step} · measure ${Math.floor((c.col % colsPerBar) / stepsPerMeasure) + 1}`}
              >
                {c.label}
              </div>
            );
          })}
        </div>
      </div>
    ),
    [
      quantCells,
      gridWidth,
      pxPerCol,
      colW,
      colsPerBar,
      stepsPerMeasure,
      quantize,
      activeGlobalCol,
      transportNotStopped,
      onSeekCol,
      barCountSafe,
      barWidthPx,
      measureWidthPx,
    ],
  );

  const shellStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: rollExpanded ? 320 : 0,
    flex: rollExpanded ? '1 1 52%' : undefined,
    background: '#06080f',
    padding: '6px 8px',
    borderTop: rollExpanded ? '2px solid rgba(34, 197, 94, 0.35)' : undefined,
    boxShadow: rollExpanded ? 'inset 0 1px 0 rgba(134, 239, 172, 0.08)' : undefined,
  };

  return (
    <div style={shellStyle}>
      {showStripChrome ? (
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
            marginBottom: 4,
            padding: '3px 4px',
            borderBottom: `1px solid ${layerStripColor}33`,
          }}
        >
          <span style={{ fontSize: 9, fontWeight: 900, color: layerStripColor, letterSpacing: '0.06em' }}>
            {channelLabel}
          </span>
          <span style={{ fontSize: 8, color: '#6b7280' }}>
            {allHits.length} note{allHits.length === 1 ? '' : 's'}
          </span>
          <button
            type="button"
            onClick={() => setTool('pointer')}
            style={toolBtn(tool === 'pointer', '#fde68a', '#2a2410')}
            title="Move / select"
          >
            <MousePointer2 size={10} />
          </button>
          <button
            type="button"
            onClick={() => setTool('paint')}
            style={toolBtn(tool === 'paint', '#67e8f9', '#0e2838')}
            title="Draw notes"
          >
            <Pencil size={10} />
          </button>
          <button type="button" onClick={() => setTool('erase')} style={toolBtn(tool === 'erase', '#fb923c', '#2a1411')}>
            <Eraser size={10} />
          </button>
          {layerScope === 'sub' && onSubOctaveDown && onSubOctaveUp ? (
            <GrooveOctaveShiftButtons
              layerLabel="SUB"
              accentColor="#fb923c"
              borderColor="#ea580c"
              noteCount={subRootNoteCount}
              onOctaveDown={onSubOctaveDown}
              onOctaveUp={onSubOctaveUp}
            />
          ) : null}
          {(layerScope === 'melody' || layerScope === 'waveleaf') && onMelodyOctaveDown && onMelodyOctaveUp ? (
            <GrooveOctaveShiftButtons
              layerLabel={layerScope === 'waveleaf' ? GROOVE_LEAD_SHORT_LABEL : 'LEAD'}
              accentColor={layerScope === 'waveleaf' ? WAVE_LEAF_UI.accentHi : '#fbbf24'}
              borderColor={layerScope === 'waveleaf' ? WAVE_LEAF_UI.borderHi : '#d97706'}
              noteCount={melodyLayerNoteCount}
              onOctaveDown={onMelodyOctaveDown}
              onOctaveUp={onMelodyOctaveUp}
            />
          ) : null}
          {(layerScope === 'chord' || layerScope === 'sample') && onChordOctaveDown && onChordOctaveUp ? (
            <GrooveOctaveShiftButtons
              layerLabel="CHORD"
              accentColor="#86efac"
              borderColor="#22c55e"
              noteCount={chordStackNoteCount}
              onOctaveDown={onChordOctaveDown}
              onOctaveUp={onChordOctaveUp}
            />
          ) : null}
          <button
            type="button"
            onClick={() => setRollExpanded((v) => !v)}
            style={actionBtn(
              rollExpanded ? '#052e2e' : '#0a0e16',
              rollExpanded ? '#5eead4' : '#67e8f9',
              rollExpanded ? '#14b8a6' : '#155e75',
            )}
            title={
              rollExpanded
                ? 'Dock piano roll (Esc) — compact lane view'
                : 'Expand piano roll — full C1–C6 keys, Groove Studio stays visible'
            }
          >
            {rollExpanded ? <Minimize2 size={10} /> : <Maximize2 size={10} />}
            {rollExpanded ? ' DOCK' : ' FULL'}
          </button>
        </div>
      ) : null}
      {showFullChrome ? (
      <div style={{ flexShrink: 0, marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 900, color: '#7cf4c6' }}>
            PIANO ROLL
            <GrooveLabHelpTip tab="roll" title="Piano roll editor help" />
          </span>
          <span style={{ fontSize: 9, color: '#67e8f9', fontWeight: 800 }}>{channelLabel}</span>
          <span style={{ fontSize: 8, color: '#6b7280' }}>
            {allHits.length} note{allHits.length === 1 ? '' : 's'}
          </span>
          <span style={{ fontSize: 8, color: '#fde68a', fontWeight: 800 }}>♩ {cbPianoMidiToNoteName(bassRootMidi)}</span>
          <span style={{ fontSize: 8, color: '#6b7280' }}>
            {rollExpanded || !layerScope ? 'C1–C6' : 'lane keys · FULL VIEW = C1–C6'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setTool('pointer')}
            style={toolBtn(tool === 'pointer', '#fde68a', '#2a2410')}
            title="Click empty cell to add · Shift+click to multi-select · drag to move · Ctrl+A = all"
          >
            <MousePointer2 size={10} /> MOVE
          </button>
          <button
            type="button"
            onClick={() => setTool('paint')}
            style={toolBtn(tool === 'paint', '#67e8f9', '#0e2838')}
            title="Paint notes across cells (click again on same cell to erase)"
          >
            <Pencil size={10} /> DRAW
          </button>
          <button type="button" onClick={() => setTool('erase')} style={toolBtn(tool === 'erase', '#fb923c', '#2a1411')}>
            <Eraser size={10} /> ERASE
          </button>
          {!layerScope && onSubOctaveDown && onSubOctaveUp ? (
            <GrooveOctaveShiftButtons
              layerLabel="SUB"
              accentColor="#fb923c"
              borderColor="#ea580c"
              noteCount={subRootNoteCount}
              onOctaveDown={onSubOctaveDown}
              onOctaveUp={onSubOctaveUp}
            />
          ) : null}
          {!layerScope && onMelodyOctaveDown && onMelodyOctaveUp ? (
            <GrooveOctaveShiftButtons
              layerLabel="LEAD"
              accentColor="#fbbf24"
              borderColor="#d97706"
              noteCount={melodyLayerNoteCount}
              onOctaveDown={onMelodyOctaveDown}
              onOctaveUp={onMelodyOctaveUp}
            />
          ) : null}
          {onClearAllSubRoots ? (
            <button
              type="button"
              disabled={subRootNoteCount === 0}
              onClick={onClearAllSubRoots}
              style={toolBtn(false, subRootNoteCount === 0 ? '#4b5563' : '#fb923c', '#2a1411')}
              title={`Clear all blue ${GROOVE_LAB_808_SUBROOTS_BANK_LABEL} notes — keeps chords and melody`}
            >
              ERASE ALL SUB{subRootNoteCount > 0 ? ` (${subRootNoteCount})` : ''}
            </button>
          ) : null}
          {onClearAllMelody ? (
            <button
              type="button"
              disabled={melodyLayerNoteCount === 0}
              onClick={onClearAllMelody}
              style={toolBtn(
                false,
                melodyLayerNoteCount === 0 ? '#4b5563' : layerScope === 'waveleaf' ? WAVE_LEAF_UI.accentHi : '#fbbf24',
                layerScope === 'waveleaf' ? WAVE_LEAF_UI.bgInset : '#422006',
              )}
              title={
                layerScope === 'waveleaf'
                  ? `Clear all ${GROOVE_LEAD_DISPLAY_NAME} notes on this channel`
                  : 'Clear all amber melody / riff / arp notes — keeps chords and subs'
              }
            >
              {layerScope === 'waveleaf' ? `ERASE ${GROOVE_LEAD_DISPLAY_NAME}` : 'ERASE ALL MELODY'}
              {melodyLayerNoteCount > 0 ? ` (${melodyLayerNoteCount})` : ''}
            </button>
          ) : null}
          <span style={{ fontSize: 7, color: '#4b5563', fontWeight: 800 }}>GRID</span>
          {GROOVE_LAB_QUANTIZE_OPTIONS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onQuantizeChange(q as GrooveLabQuantize)}
              style={quantizeBtn(quantize === q)}
              title={`Snap grid to ${q}`}
            >
              {q}
            </button>
          ))}
          <button type="button" onClick={handleQuantizeAll} style={actionBtn('#1a2438', '#a5f3fc', '#22d3ee44')} title="Snap all notes to grid">
            Q ALL
          </button>
          <span style={{ fontSize: 7, color: '#4b5563', fontWeight: 800 }}>BARS</span>
          <select
            value={barCount}
            onChange={(e) => onBarCountChange(Number(e.target.value) as GrooveLabBarCount)}
            style={{ ...selectStyle, minWidth: 72 }}
            title="Pattern length in bars"
          >
            {GROOVE_LAB_BAR_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} bars
              </option>
            ))}
          </select>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginLeft: 4,
              padding: '2px 6px',
              border: '1px solid #2a2a32',
              borderRadius: 5,
              background: '#0a0a0e',
            }}
            title="Zoom grid columns in/out"
          >
            <span style={{ fontSize: 7, color: '#4b5563', fontWeight: 800 }}>ZOOM</span>
            <button
              type="button"
              onClick={() => setPxPerCol((w) => clampZoom(w - GROOVE_ZOOM_STEP))}
              style={zoomIconBtn()}
              aria-label="Zoom out"
            >
              <ZoomOut size={11} />
            </button>
            <input
              type="range"
              min={GROOVE_ZOOM_MIN}
              max={GROOVE_ZOOM_MAX}
              step={GROOVE_ZOOM_STEP}
              value={pxPerCol}
              onChange={(e) => setPxPerCol(clampZoom(Number(e.target.value)))}
              style={{ width: 96, height: 4, margin: 0, accentColor: '#7cf4c6', cursor: 'ew-resize' }}
              aria-label="Grid zoom"
            />
            <button
              type="button"
              onClick={() => setPxPerCol((w) => clampZoom(w + GROOVE_ZOOM_STEP))}
              style={zoomIconBtn()}
              aria-label="Zoom in"
            >
              <ZoomIn size={11} />
            </button>
            <span style={{ fontSize: 8, color: '#6b7280', fontFamily: 'monospace', minWidth: 32 }}>{pxPerCol}px</span>
            <button
              type="button"
              onClick={() => setPxPerCol(clampZoom(Math.round(pxPerCol * 1.35)))}
              style={actionBtn('#242424', '#a5f3fc', '#1a2e3a')}
              title="Zoom in quickly"
            >
              +
            </button>
          </div>
          {onTransportRewind && onTransportStop && onTransportPlayPause && onTransportFastForward ? (
            <OrchidTransportControls
              playing={transportPlaying}
              playDisabled={transportDisabled}
              onRewind={onTransportRewind}
              onStop={onTransportStop}
              onPlayPause={onTransportPlayPause}
              onFastForward={onTransportFastForward}
            />
          ) : null}
          {showFullChrome ? (
            <button
              type="button"
              onClick={() => setRollExpanded((v) => !v)}
              style={actionBtn(
                rollExpanded ? '#052e2e' : '#0a0e16',
                rollExpanded ? '#5eead4' : '#67e8f9',
                rollExpanded ? '#14b8a6' : '#155e75',
              )}
              title={
                rollExpanded
                  ? 'Dock piano roll (Esc) — compact lane view'
                  : 'Expand piano roll — full C1–C6 keys, Groove Studio stays visible'
              }
            >
              {rollExpanded ? <Minimize2 size={10} /> : <Maximize2 size={10} />}
              {rollExpanded ? ' DOCK' : ' FULL VIEW'}
            </button>
          ) : null}
          <select
            value={safeNoteLength}
            onChange={(e) => onNoteLengthChange(Number(e.target.value))}
            style={selectStyle}
            title="Note length for new notes (MOVE click or DRAW). STP = grid steps at current quantize. Resize later by dragging the yellow right edge."
          >
            {lengthOptions.map((n) => (
              <option key={n} value={n}>
                LEN {n / snapStep} step{n / snapStep === 1 ? '' : 's'}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={selectAllNotes}
            disabled={allHits.length === 0}
            style={actionBtn('#242424', '#fde68a', '#3a3410')}
            title="Select every note (Ctrl+A) · Shift+click notes to add/remove from selection"
          >
            SEL ALL
          </button>
          <button type="button" onClick={handleCopy} disabled={allHits.length === 0} style={actionBtn('#242424', '#c4b5fd', '#3b2f5c')}>
            COPY
          </button>
          <button type="button" onClick={handlePaste} disabled={!clipboard?.length} style={actionBtn('#242424', '#86efac', '#1f3a29')}>
            PASTE
          </button>
          {onPreview ? (
            <button type="button" onClick={onPreview} style={actionBtn('#112015', '#86efac', '#1f3a29')}>
              ▶
            </button>
          ) : null}
          {onSpreadChord ? (
            <button
              type="button"
              onClick={onSpreadChord}
              style={actionBtn('#112015', '#86efac', '#1f3a29')}
              title="Write bass + Groove chord at the next column (from current bass root)"
            >
              + STEP
            </button>
          ) : null}
          {onChordOctaveDown && onChordOctaveUp ? (
            <GrooveOctaveShiftButtons
              layerLabel="CHORD"
              accentColor={GROOVE_LAB_CHORD_NOTE_COLOR}
              borderColor="#22c55e"
              noteCount={chordStackNoteCount}
              onOctaveDown={onChordOctaveDown}
              onOctaveUp={onChordOctaveUp}
            />
          ) : null}
          <button
            type="button"
            onClick={() => {
              if (split) {
                onBassHitsChange!([]);
                onMelodyHitsChange!([]);
                onChordHitsChange!([]);
              } else {
                onHitsChange([]);
              }
              clearSelection();
            }}
            style={actionBtn('#242424', '#f87171', '#3a1f1f')}
          >
            CLR ALL
          </button>
          {onImportMidi ? (
            <>
              <input
                ref={midiImportFileRef}
                type="file"
                accept=".mid,.midi,audio/midi"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onImportMidi(f);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => midiImportFileRef.current?.click()}
                title={
                  midiImportStatus
                    ? midiImportStatus
                    : 'Import .mid — reads tempo (BPM) and splits bass vs chords vs melody'
                }
                style={actionBtn('#0c1520', '#93c5fd', '#1e3a5f')}
              >
                IMPORT .MID
              </button>
            </>
          ) : null}
          {(onExportRollMidi || onExportRollWav || onExportRollWavToPad || onSendRollToNewSynth) ? (
            <GrooveLabExportStrip
              toolbarInline
              showExportLabel={showExportLabel}
              busy={exportBusy}
              status={exportStatus}
              hasChords={rollHasChords}
              hasRollNotes={rollHasNotes}
              onExportMidi={onExportRollMidi}
              onExportWav={onExportRollWav}
              onExportToPad={onExportRollWavToPad}
              onSendToNewSynth={onSendRollToNewSynth}
              padExportEnabled={padExportEnabled}
              padPickerOpen={padPickerOpen}
            />
          ) : null}
          {selectedHits.length > 0 ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                flexWrap: 'wrap',
                marginLeft: 2,
                padding: '2px 6px',
                border: '1px solid #1e3a5f',
                borderRadius: 5,
                background: '#0a1018',
              }}
              title="Selected notes — octave, velocity, delete (8va moves all selected)"
            >
              <span style={{ fontSize: 8, color: '#67e8f9', fontWeight: 800 }}>
                {selectedHits.length === 1 && primarySelected
                  ? `${cbPianoMidiToNoteName(primarySelected.midi)} · stp ${primarySelected.slot + 1}`
                  : `${selectedHits.length} notes`}
              </span>
              <button
                type="button"
                onClick={() => nudgeSelectedOctave(-1)}
                style={actionBtn('#242424', '#93c5fd', '#1a2e3a')}
                title="Down one octave"
              >
                ◀ 8va
              </button>
              <button
                type="button"
                onClick={() => nudgeSelectedOctave(1)}
                style={actionBtn('#242424', '#93c5fd', '#1a2e3a')}
                title="Up one octave"
              >
                8va ▶
              </button>
              <span style={{ fontSize: 7, color: '#6b7280' }}>VEL</span>
              <input
                type="range"
                min={5}
                max={100}
                value={Math.round((primarySelected?.vel ?? 0.88) * 100)}
                onChange={(e) => setSelectedVelocity(Number(e.target.value) / 100)}
                style={{ width: 64, accentColor: '#7cf4c6' }}
              />
              <span style={{ fontSize: 8, color: '#86efac', fontWeight: 800 }}>
                {Math.round((primarySelected?.vel ?? 0.88) * 100)}%
              </span>
              {selectedHits.length === 1 && primarySelected ? (
                <button
                  type="button"
                  onClick={() => deleteChordAtSlot(primarySelected.slot)}
                  style={actionBtn('#2a1411', '#fca5a5', '#dc2626')}
                  title="Delete every note at this grid position (whole chord)"
                >
                  DEL CHORD
                </button>
              ) : null}
              <button
                type="button"
                onClick={deleteSelectedNotes}
                style={actionBtn('#242424', '#fca5a5', '#3a1f1f')}
              >
                DEL {selectedHits.length > 1 ? 'SEL' : 'NOTE'}
              </button>
              {selectedHits.length === 1 && primarySelected ? (
                <button
                  type="button"
                  onClick={() =>
                    splitNoteAtSlot(
                      primarySelected,
                      primarySelected.slot + Math.floor(primarySelected.sustainSlots / 2),
                    )
                  }
                  disabled={primarySelected.sustainSlots < snapStep * 2}
                  style={{
                    ...actionBtn('#242424', '#fde68a', '#3a3410'),
                    opacity: primarySelected.sustainSlots < snapStep * 2 ? 0.45 : 1,
                    cursor: primarySelected.sustainSlots < snapStep * 2 ? 'not-allowed' : 'pointer',
                  }}
                  title="Split this note in half (or double-click the note on the grid)"
                >
                  SPLIT
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      ) : null}

      <div
        ref={setBodyScrollEl}
        onWheel={onRollWheel}
        onDragOver={onMidiDragOver}
        onDragLeave={onMidiDragLeave}
        onDrop={onMidiDrop}
        style={{
          flex: 1,
          minHeight: rollExpanded ? 0 : 0,
          overflow: 'auto',
          overflowAnchor: 'none',
          scrollbarGutter: 'stable',
          border: `2px solid ${midiDragOver ? '#60a5fa' : CB_PIANO_MINT_BORDER}`,
          borderRadius: 6,
          background: midiDragOver ? '#0a1628' : '#030508',
          boxShadow: midiDragOver ? 'inset 0 0 0 1px #3b82f666' : undefined,
        }}
        title={
          onMidiFileDrop
            ? 'Drop .mid here (BPM + bass/chord layers) · Ctrl+wheel zoom'
            : 'Ctrl+wheel or Alt+wheel to zoom grid'
        }
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: 'max-content',
            minWidth: '100%',
            position: 'relative',
          }}
        >
          {playheadElRef ? (
            <div
              ref={playheadElRef}
              aria-hidden
              style={{
                position: 'absolute',
                left: M.labelW,
                top: 0,
                width: 1,
                height: RULER_TOTAL_H + gridBodyH + VEL_LANE_H,
                background: 'transparent',
                pointerEvents: 'none',
                zIndex: GROOVE_ROLL_Z_PLAYHEAD,
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
                  height: RULER_TOTAL_H + gridBodyH + VEL_LANE_H - 12,
                  background: 'rgba(124, 244, 198, 0.45)',
                }}
              />
            </div>
          ) : null}
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              flexShrink: 0,
              position: 'sticky',
              top: 0,
              zIndex: GROOVE_ROLL_Z_RULER,
              background: '#030508',
            }}
          >
            <div
              style={{
                ...cbPianoKeyRailOuterStyle(M),
                flexShrink: 0,
                height: RULER_TOTAL_H,
                position: 'sticky',
                left: 0,
                zIndex: GROOVE_ROLL_Z_CORNER,
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                fontSize: 6,
                fontWeight: 800,
                color: '#4b5563',
                fontFamily: 'monospace',
                letterSpacing: 0.5,
                background: '#0a1018',
              }}
            >
              <div style={{ height: RULER_BAR_H, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 4 }}>BAR</div>
              <div style={{ height: RULER_MEASURE_H, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 4 }}>MSR</div>
              <div style={{ height: RULER_QUANT_H, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 4 }}>STP</div>
            </div>
            {gridTimeRuler}
          </div>

          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', paddingBottom: 6 }}>
            <div
              style={{
                ...cbPianoKeyRailOuterStyle(M),
                flexShrink: 0,
                position: 'sticky',
                left: 0,
                zIndex: GROOVE_ROLL_Z_KEYS,
                background: '#030508',
              }}
            >
            {activePianoRows.map((noteName) => {
              const midi = cbPianoNoteNameToMidi(noteName);
              return (
                <div key={`key-${noteName}`} style={cbPianoPitchRowStyle(midi, M)}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onPrimeAudio?.();
                      setPreviewKeyMidi(midi);
                      if (bassDrawNotes && onPlaceBassNote) onPlaceBassNote(midi, editSlot);
                      else previewRollMidi(midi);
                    }}
                    onMouseUp={() => setPreviewKeyMidi((p) => (p === midi ? null : p))}
                    onMouseLeave={() => setPreviewKeyMidi((p) => (p === midi ? null : p))}
                    title={`${cbPianoMidiToNoteName(midi)} · click to audition`}
                    style={{ ...cbPianoKeyCellStyle(M), height: M.rowH }}
                  >
                    <div style={cbPianoKeyFaceStyle(midi, previewKeyMidi === midi, M)}>
                      {cbPianoKeyLabel(midi)}
                    </div>
                  </button>
                </div>
              );
            })}
            <div
              style={{
                height: VEL_LANE_H,
                flexShrink: 0,
                borderTop: `1px solid ${CB_PIANO_MINT_BORDER}`,
                fontSize: 6,
                color: '#4b5563',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                paddingRight: 3,
                background: '#050507',
                boxSizing: 'border-box',
              }}
            >
              VEL
            </div>
          </div>

            {/* ── Grid (beside keys — same row) ── */}
            <div
              style={{
                width: gridWidth,
                minWidth: gridWidth,
                flexShrink: 0,
                position: 'relative',
                zIndex: GROOVE_ROLL_Z_GRID,
              }}
            >
            <div
              ref={gridBodyRef}
              style={{
                position: 'relative',
                width: gridWidth,
                height: gridBodyH,
                overflow: 'hidden',
              }}
              onPointerDown={(e) => {
                if (tool !== 'pointer' || !e.isPrimary || e.button !== 0) return;
                const slot = slotFromClientX(e.clientX);
                const midi = midiFromClientY(e.clientY);
                const snapped = snapSlot(slot);
                focusEditSlot(snapped);
                const occupied = rollDisplayHits.some(
                  (h) =>
                    h.midi === midi && snapped >= h.slot && snapped < h.slot + h.sustainSlots,
                );
                if (!occupied) addNoteAt(snapped, midi, paintLayerForMidi(midi, layerScope), safeNoteLength);
              }}
            >
              {/* Row backgrounds (white / black stripes) */}
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
                {activePianoRows.map((noteName, j) => {
                  const midi = cbPianoNoteNameToMidi(noteName);
                  const rowBg = cbPianoGridRowStyle(midi);
                  return (
                    <div
                      key={`bg-${noteName}`}
                      style={{
                        position: 'absolute',
                        top: j * M.rowH,
                        height: M.rowH,
                        left: rowBg.left ?? 0,
                        width: rowBg.width ?? '100%',
                        background: rowBg.background,
                        borderBottom: rowBg.borderBottom,
                        boxSizing: 'border-box',
                      }}
                    />
                  );
                })}
              </div>

              {/* Vertical grid — bar edge + 4 measures + quantize columns */}
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: GROOVE_ROLL_Z_GRID }}>
                {gridColLines.map((line) => {
                  const st = grooveLabGridLineStyle(line.kind) ?? grooveLabGridLineStyle('snap');
                  return (
                    <div
                      key={`gline-${line.kind}-${line.col}`}
                      style={{
                        position: 'absolute',
                        top: 0,
                        height: gridBodyH,
                        left: colToPx(line.col),
                        width: st.width,
                        marginLeft: -Math.floor(st.width / 2),
                        background: st.background,
                        opacity: st.opacity,
                      }}
                    />
                  );
                })}
              </div>

              {/* Hit cells (above notes while DRAW so clicks always land on STP boxes) */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: cellsAboveNotes ? GROOVE_ROLL_Z_CELLS_PAINT : GROOVE_ROLL_Z_GRID,
                  pointerEvents: 'auto',
                }}
              >
                {activePianoRows.map((noteName, j) => {
                  const midi = cbPianoNoteNameToMidi(noteName);
                  const rowHits = rollDisplayHits.filter(
                    (h) => grooveLabRowIndexForMidi(h.midi, activePianoRows) === j,
                  );
                  const top = j * M.rowH;
                  return (
                    <div
                      key={`row-${noteName}`}
                      style={{
                        position: 'absolute',
                        top,
                        left: 0,
                        width: gridWidth,
                        height: M.rowH,
                        overflow: 'hidden',
                      }}
                    >
                      {Array.from({ length: totalCols }, (_, globalCol) => {
                        const bar = Math.floor(globalCol / colsPerBar);
                        const colInBar = globalCol % colsPerBar;
                        const slot = bar * GROOVE_LAB_SLOTS_PER_BAR + colInBar * snapStep;
                        return (
                          <div
                            key={`c-${midi}-${globalCol}`}
                            data-groove-slot={slot}
                            data-groove-midi={midi}
                            onPointerDown={(e) => cellPointerDown(e, slot, midi, rowHits)}
                            onPointerEnter={(e) => {
                              if (!e.buttons) return;
                              if (tool === 'erase' && paintEraseRef.current) {
                                const hit = hitAtRollCell(rowHits, snapSlot(slot), midi);
                                if (hit) deleteNote(hit);
                                return;
                              }
                              if (tool !== 'paint' || !paintDrawRef.current || bassOneShotPaint) return;
                              placeAtCell(slot, midi);
                            }}
                            style={{
                              position: 'absolute',
                              top: 0,
                              height: '100%',
                              left: globalCol * colW,
                              width: colW,
                              cursor: tool === 'erase' ? 'cell' : 'crosshair',
                              boxSizing: 'border-box',
                              borderLeft:
                                globalCol === 0
                                  ? undefined
                                  : globalCol % colsPerBar === 0
                                    ? `1px solid ${CB_PIANO_MINT_BORDER}`
                                    : colInBar % stepsPerMeasure === 0
                                      ? '1px solid rgba(103,232,249,0.22)'
                                      : '1px solid rgba(255,255,255,0.05)',
                            }}
                          />
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {/* Notes — container must stay pointer-events:none so empty grid cells stay clickable */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: cellsAboveNotes ? GROOVE_ROLL_Z_NOTES - 1 : GROOVE_ROLL_Z_NOTES,
                  pointerEvents: 'none',
                }}
              >
                {activePianoRows.map((noteName, j) => {
                  const rowHits = rollDisplayHits.filter((h) => {
                    const dragItem = drag?.items.find(
                      (it) => it.origSlot === h.slot && it.origMidi === h.midi,
                    );
                    const isDragNote = Boolean(dragItem && drag);
                    const dMidi = isDragNote && drag ? drag.curMidi - drag.anchorMidi : 0;
                    const effectiveMidi = isDragNote ? h.midi + dMidi : h.midi;
                    return grooveLabRowIndexForMidi(effectiveMidi, activePianoRows) === j;
                  });
                  const top = j * M.rowH;
                  return (
                    <div
                      key={`notes-${noteName}`}
                      style={{
                        position: 'absolute',
                        top,
                        left: 0,
                        width: gridWidth,
                        height: M.rowH,
                        overflow: 'hidden',
                        pointerEvents: 'none',
                      }}
                    >
                      {rowHits.map((note) => {
                        const dragItem = drag?.items.find(
                          (it) => it.origSlot === note.slot && it.origMidi === note.midi,
                        );
                        const isDrag = Boolean(dragItem && drag);
                        const isRz =
                          rz?.midi === note.midi && rz.startSlot === snapSlot(note.slot);
                        const dSlot = drag ? drag.curSlot - drag.anchorSlot : 0;
                        const dMidi = drag ? drag.curMidi - drag.anchorMidi : 0;
                        const slot = isDrag
                          ? snapSlot(note.slot + dSlot)
                          : note.slot;
                        const displayMidi = isDrag ? note.midi + dMidi : note.midi;
                        const sus = isRz
                          ? Math.max(snapStep, rz!.endSlot - rz!.startSlot + 1)
                          : isDrag
                            ? dragItem!.sustainSlots
                            : note.sustainSlots;
                        const box = noteColumnLayout(slot, sus);
                        const isSel = isNoteSelected(note);
                        const layer = noteLayer(note);
                        const waveLeafNote = layerScope === 'waveleaf' && layer === 'melody';
                        const noteFill = waveLeafNote
                          ? WAVE_LEAF_NOTE_COLOR
                          : layer === 'melody'
                            ? GROOVE_LAB_MELODY_NOTE_COLOR
                            : layer === 'bass'
                              ? GROOVE_LAB_BASS_NOTE_COLOR
                              : GROOVE_LAB_CHORD_NOTE_COLOR;
                        const noteEdge = waveLeafNote
                          ? WAVE_LEAF_NOTE_EDGE
                          : layer === 'melody'
                            ? GROOVE_LAB_MELODY_NOTE_EDGE
                            : layer === 'bass'
                              ? GROOVE_LAB_BASS_NOTE_EDGE
                              : GROOVE_LAB_CHORD_NOTE_EDGE;
                        const noteInset = waveLeafNote
                          ? WAVE_LEAF_NOTE_INSET
                          : layer === 'melody'
                            ? GROOVE_LAB_MELODY_NOTE_INSET
                            : layer === 'bass'
                              ? GROOVE_LAB_BASS_NOTE_INSET
                              : GROOVE_LAB_CHORD_NOTE_INSET;
                        return (
                          <div
                            key={hitId(note)}
                            onPointerDown={(e) => {
                              if (!e.isPrimary || e.button !== 0) return;
                              onPrimeAudio?.();
                              e.stopPropagation();
                              if (tool === 'erase') {
                                deleteNote(note);
                                return;
                              }
                              if (tool === 'pointer' || tool === 'paint') {
                                previewRollMidi(displayMidi, note.vel);
                              }
                              if (tool === 'paint') {
                                setTool('pointer');
                              }
                              const additive = e.shiftKey || e.ctrlKey || e.metaKey;
                              if (additive) {
                                toggleNoteSelection(note);
                                return;
                              }
                              const multiDrag =
                                e.shiftKey &&
                                isNoteSelected(note) &&
                                selectedIds.size > 1;
                              if (!multiDrag && !isNoteSelected(note)) {
                                setSelectedIds(new Set([hitId(note)]));
                              }
                              beginDrag(note, e.clientX, e.clientY, { multi: multiDrag });
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (e.shiftKey) deleteNote(note);
                              else deleteChordAtSlot(note.slot);
                            }}
                            onDoubleClick={(e) => {
                              if (tool !== 'pointer') return;
                              e.preventDefault();
                              e.stopPropagation();
                              const splitSlot = slotFromClientX(e.clientX);
                              splitNoteAtSlot(note, splitSlot);
                            }}
                            title={`${cbPianoMidiToNoteName(displayMidi)} · ${box.colSpan} step${box.colSpan === 1 ? '' : 's'} · drag = move · Shift+drag = move selection · Shift+click = add to selection`}
                            style={{
                              position: 'absolute',
                              top: NOTE_CELL_PAD,
                              height: M.rowH - NOTE_CELL_PAD * 2,
                              left: box.left,
                              width: box.width,
                              background: tool === 'erase' ? '#fca5a5' : isSel ? '#a8ffd9' : noteFill,
                              border: `1px solid ${tool === 'erase' ? '#dc2626' : isSel ? '#fde68a' : noteEdge}`,
                              borderStyle: 'solid',
                              borderRadius: layer === 'chord' ? 3 : 2,
                              boxShadow: 'none',
                              cursor: tool === 'erase' ? 'not-allowed' : tool === 'pointer' ? 'grab' : 'pointer',
                              opacity:
                                isDrag
                                  ? 0.45
                                  : layer === 'chord'
                                    ? 0.82 + note.vel * 0.12
                                    : 0.75 + note.vel * 0.25,
                              zIndex: isRz || isSel ? GROOVE_ROLL_Z_NOTES : GROOVE_ROLL_Z_NOTES - 1,
                              boxSizing: 'border-box',
                              overflow: 'hidden',
                              pointerEvents: 'auto',
                            }}
                          >
                            <span
                              style={{
                                position: 'absolute',
                                top: 1,
                                left: 3,
                                fontSize: 7,
                                fontWeight: 900,
                                color:
                                  layer === 'melody'
                                    ? '#fef3c7'
                                    : layer === 'bass'
                                      ? '#dbeafe'
                                      : '#dcfce7',
                                opacity: 0.95,
                                pointerEvents: 'none',
                                lineHeight: 1,
                              }}
                            >
                              {layer === 'melody' ? 'M' : layer === 'bass' ? 'B' : 'C'}
                            </span>
                            <span
                              onPointerDown={(e) => {
                                if (!e.isPrimary || e.button !== 0) return;
                                e.stopPropagation();
                                if (tool === 'erase') {
                                  deleteNote(note);
                                  return;
                                }
                                if (tool === 'paint') setTool('pointer');
                                if (!isNoteSelected(note)) selectOnly(note);
                                beginResize(note);
                              }}
                              style={{
                                position: 'absolute',
                                top: 0,
                                right: 0,
                                width: NOTE_RESIZE_HANDLE_W,
                                height: '100%',
                                cursor: 'ew-resize',
                                background: isRz || isSel ? 'rgba(253,230,138,0.55)' : 'rgba(253,230,138,0.25)',
                                borderLeft: '1px solid rgba(253,230,138,0.7)',
                                boxSizing: 'border-box',
                                pointerEvents: 'auto',
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

            </div>

            <div
              style={{
                display: 'flex',
                width: gridWidth,
                height: VEL_LANE_H,
                borderTop: `1px solid ${CB_PIANO_MINT_BORDER}`,
                background: '#18181e',
                boxSizing: 'border-box',
              }}
            >
              {Array.from({ length: totalCols }, (_, globalCol) => {
                const bar = Math.floor(globalCol / colsPerBar);
                const colInBar = globalCol % colsPerBar;
                const slot = bar * GROOVE_LAB_SLOTS_PER_BAR + colInBar * snapStep;
                const slotHits = allHits.filter((h) => h.slot === slot);
                const maxVel = slotHits.length ? Math.max(...slotHits.map((h) => h.vel)) : 0;
                return (
                  <div
                    key={`vel-${globalCol}`}
                    role="button"
                    tabIndex={-1}
                    title={
                      slotHits.length > 0
                        ? tool === 'erase'
                          ? 'Erase all notes in this column'
                          : 'Right-click to delete column'
                        : undefined
                    }
                    onMouseDown={(e) => {
                      if (e.button === 0) focusEditSlot(slot);
                      if (e.button !== 0 || tool !== 'erase' || slotHits.length === 0) return;
                      e.preventDefault();
                      deleteChordAtSlot(slot);
                    }}
                    onContextMenu={(e) => {
                      if (slotHits.length === 0) return;
                      e.preventDefault();
                      deleteChordAtSlot(slot);
                    }}
                    style={{
                      width: colW,
                      flexShrink: 0,
                      borderLeft: globalCol > 0 ? '1px solid rgba(255,255,255,0.04)' : undefined,
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'center',
                      padding: '1px 0',
                      boxSizing: 'border-box',
                      cursor: tool === 'erase' && slotHits.length > 0 ? 'pointer' : 'default',
                    }}
                  >
                    {maxVel > 0 ? (
                      <div
                        style={{
                          width: '70%',
                          height: `${Math.round(maxVel * 100)}%`,
                          minHeight: 2,
                          background: CB_PIANO_MINT,
                          borderRadius: 1,
                          opacity: 0.7,
                        }}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
            </div>
          </div>
        </div>
      </div>

      {!isLayerRoll || rollExpanded ? (
        <p style={{ margin: '6px 0 0', fontSize: 7, color: '#4b5563', lineHeight: 1.35, flexShrink: 0 }}>
          {channelLabel} · {barCount} bars ·{' '}
          {rollExpanded && layerScope ? (
            <span style={{ color: '#67e8f9' }}>FULL VIEW C1–C6 · </span>
          ) : null}
          <span style={{ color: GROOVE_LAB_BASS_NOTE_COLOR, fontWeight: 900 }}>B</span> = bass sound ·{' '}
          <span style={{ color: GROOVE_LAB_CHORD_NOTE_COLOR, fontWeight: 900 }}>C</span> = Groove chord ·{' '}
          <span style={{ color: '#fde68a', fontWeight: 800 }}>MOVE</span> click = add · SEL ALL / Ctrl+A · drag group ·{' '}
          <span style={{ color: GROOVE_LAB_CHORD_NOTE_COLOR, fontWeight: 800 }}>OCT ±</span> = whole layer (chord / lead / sub) · 8va = selected ·{' '}
          <span style={{ color: '#67e8f9', fontWeight: 800 }}>DRAW</span> paint · <span style={{ color: '#a7f3d0' }}>LEN</span> = new note length
        </p>
      ) : null}
    </div>
  );
}

function toolBtn(on: boolean, color: string, bg: string): CSSProperties {
  return {
    background: on ? bg : '#242424',
    color: on ? color : '#6b7280',
    border: `1px solid ${on ? color + '66' : '#222'}`,
    borderRadius: 5,
    padding: '3px 7px',
    fontSize: 8,
    fontWeight: 900,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 3,
  };
}

function zoomIconBtn(): CSSProperties {
  return {
    background: 'none',
    border: 'none',
    color: '#6b7280',
    cursor: 'pointer',
    padding: '2px 4px',
    display: 'flex',
    alignItems: 'center',
  };
}

function quantizeBtn(on: boolean): CSSProperties {
  return {
    background: on ? '#0e2838' : '#242424',
    color: on ? '#67e8f9' : '#6b7280',
    border: `1px solid ${on ? '#22d3ee66' : '#222'}`,
    borderRadius: 4,
    padding: '2px 5px',
    fontSize: 7,
    fontWeight: 900,
    cursor: 'pointer',
  };
}

function actionBtn(bg: string, color: string, border: string): CSSProperties {
  return {
    background: bg,
    color,
    border: `1px solid ${border}`,
    borderRadius: 5,
    padding: '3px 8px',
    fontSize: 8,
    fontWeight: 900,
    cursor: 'pointer',
  };
}

const selectStyle: CSSProperties = {
  background: '#0a0e16',
  color: '#86efac',
  border: '1px solid #1a3a29',
  borderRadius: 4,
  padding: '2px 4px',
  fontSize: 8,
  fontWeight: 800,
};
