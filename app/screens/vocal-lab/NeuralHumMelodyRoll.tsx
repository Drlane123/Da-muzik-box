import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';

import { Download, Pause, Play, Save, Send, Trash2 } from 'lucide-react';

import {
  clampRollNotesToBars,
  loadNeuralHumRollDraft,
  NEURAL_HUM_QUANTIZE_OPTIONS,
  NEURAL_HUM_ROLL_SLOTS_PER_BAR,
  neuralHumQuantizeStepSlots,
  newNeuralHumRollNoteId,
  rollKeyLabel,
  rollNotesToTimed,
  rollPitchBounds,
  saveNeuralHumRollDraft,
  snapNeuralHumRollLen,
  snapNeuralHumRollSlot,
  totalRollSlots,
  type NeuralHumRollBarCount,
  type NeuralHumRollNote,
  type NeuralHumRollQuantize,
} from '@/app/lib/vocalLab/neuralHumMelodyRoll';
import { scheduleNeuralHumRollAudition } from '@/app/lib/vocalLab/neuralHumPreview';
import {
  neuralHumScalePitchClasses,
  snapMidiToNeuralHumScale,
  type NeuralHumScaleId,
} from '@/app/lib/vocalLab/neuralHumKeyLock';
import type { NeuralHumInstrumentId } from '@/app/lib/vocalLab/neuralHumToInstrument';
import { NH_PIANO, NH_SCALE } from '@/app/lib/vocalLab/neuralHumTheme';

const ROW_H = 18;
const COL_W = 16;
const KEY_W = 36;
const BLACK_KEY_W_RATIO = 0.62;

function isBlackKeyPc(pc: number): boolean {
  return [1, 3, 6, 8, 10].includes(pc);
}
const RESIZE_HANDLE_W = 8;

type NoteDrag = {
  mode: 'move' | 'resize-end';
  id: string;
  slot0: number;
  len0: number;
  pitch0: number;
  x0: number;
  y0: number;
};

type NeuralHumMelodyRollProps = {
  rollNotes: NeuralHumRollNote[];
  onRollNotesChange: (notes: NeuralHumRollNote[]) => void;
  onClearAll?: () => void;
  canClearAll?: boolean;
  bars: NeuralHumRollBarCount;
  onBarsChange: (bars: NeuralHumRollBarCount) => void;
  bpm: number;
  quantize: NeuralHumRollQuantize;
  onQuantizeChange: (q: NeuralHumRollQuantize) => void;
  /** One-click snap all notes to the selected grid (1/16, 1/8, …). */
  onQuantizeNow?: () => void;
  /** SE2 Hum / Melody — push the edited draft onto the lane piano roll / timeline. */
  onApplyToTrack?: () => void;
  applyToTrackDirty?: boolean;
  applyToTrackFlash?: boolean;
  instrumentId: NeuralHumInstrumentId;
  transpose: number;
  dynamics: number;
  keyRoot: number;
  scaleId: NeuralHumScaleId;
  keyLockOff: boolean;
  getAudioContext: () => AudioContext;
  getDestination: () => AudioNode;
  onExportGroove?: () => void;
  onExportSynth?: () => void;
  onExportStudio?: () => void;
  onDownloadMidi?: () => void;
  showExport?: boolean;
  isAnalyzing?: boolean;
  /** Shared VocalBox ↔ Hum Sync — stamp drums before melody starts. */
  onAuditionStart?: () => void;
  /** Parent bumps to start audition on the shared sync clock. */
  auditionNonce?: number;
  /** Parent bumps to cancel an in-flight audition. */
  auditionStopNonce?: number;
  getAuditionStartAtSec?: () => number | null | undefined;
  rollLabel?: string;
  showRollTitle?: boolean;
};

export default function NeuralHumMelodyRoll({
  rollNotes,
  onRollNotesChange,
  onClearAll,
  canClearAll = false,
  bars,
  onBarsChange,
  bpm,
  quantize,
  onQuantizeChange,
  onQuantizeNow,
  onApplyToTrack,
  applyToTrackDirty = false,
  applyToTrackFlash = false,
  instrumentId,
  transpose,
  dynamics,
  keyRoot,
  scaleId,
  keyLockOff,
  getAudioContext,
  getDestination,
  onExportGroove,
  onExportSynth,
  onExportStudio,
  onDownloadMidi,
  showExport = true,
  isAnalyzing = false,
  onAuditionStart,
  auditionNonce = 0,
  auditionStopNonce = 0,
  getAuditionStartAtSec,
}: NeuralHumMelodyRollProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const stopAuditionRef = useRef<(() => void) | null>(null);
  const dragRef = useRef<NoteDrag | null>(null);
  const pendingScrollRef = useRef(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isAuditioning, setIsAuditioning] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const totalSlots = totalRollSlots(bars);
  const { lo, hi } = useMemo(() => rollPitchBounds(rollNotes), [rollNotes]);
  const pitchRows = useMemo(() => {
    const rows: number[] = [];
    for (let p = hi; p >= lo; p--) rows.push(p);
    return rows;
  }, [hi, lo]);

  const scaleSet = useMemo(() => {
    if (keyLockOff) return null;
    return new Set(neuralHumScalePitchClasses(keyRoot, scaleId));
  }, [keyLockOff, keyRoot, scaleId]);

  const snapPitch = useCallback(
    (midi: number) => {
      const m = Math.max(lo, Math.min(hi, Math.round(midi)));
      if (keyLockOff) return m;
      return snapMidiToNeuralHumScale(m, keyRoot, scaleId);
    },
    [hi, keyLockOff, keyRoot, lo, scaleId],
  );

  const cellFromPointer = useCallback(
    (clientX: number, clientY: number): { slot: number; pitch: number } | null => {
      const el = gridRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
      const slot = Math.max(0, Math.min(totalSlots - 1, Math.floor(x / COL_W)));
      const row = Math.max(0, Math.min(pitchRows.length - 1, Math.floor(y / ROW_H)));
      const pitch = pitchRows[row] ?? 60;
      return { slot, pitch: snapPitch(pitch) };
    },
    [pitchRows, snapPitch, totalSlots],
  );

  const stopAudition = useCallback(() => {
    stopAuditionRef.current?.();
    stopAuditionRef.current = null;
    setIsAuditioning(false);
  }, []);

  useEffect(() => () => stopAudition(), [stopAudition]);

  const scrollToNotes = useCallback(() => {
    const viewport = scrollRef.current;
    if (!viewport || rollNotes.length === 0) return;

    let minPitch = rollNotes[0]!.pitch;
    let maxPitch = rollNotes[0]!.pitch;
    let minSlot = rollNotes[0]!.startSlot;
    let maxSlotEnd = rollNotes[0]!.startSlot + rollNotes[0]!.lenSlots;

    for (const n of rollNotes) {
      minPitch = Math.min(minPitch, n.pitch);
      maxPitch = Math.max(maxPitch, n.pitch);
      minSlot = Math.min(minSlot, n.startSlot);
      maxSlotEnd = Math.max(maxSlotEnd, n.startSlot + n.lenSlots);
    }

    const rowTop = pitchRows.indexOf(maxPitch);
    const rowBottom = pitchRows.indexOf(minPitch);
    if (rowTop < 0 || rowBottom < 0) return;

    const rulerH = 26;
    const notesTop = rulerH + rowTop * ROW_H;
    const notesBottom = rulerH + (rowBottom + 1) * ROW_H;
    const notesMidY = (notesTop + notesBottom) * 0.5;
    const scrollTop = Math.max(0, notesMidY - viewport.clientHeight * 0.42);

    const notesMidX = KEY_W + ((minSlot + maxSlotEnd) * 0.5) * COL_W;
    const scrollLeft = Math.max(0, notesMidX - viewport.clientWidth * 0.45);

    viewport.scrollTo({ top: scrollTop, left: scrollLeft, behavior: 'smooth' });
    rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [pitchRows, rollNotes]);

  /** After stop / analyze — bring captured notes into view on the grid and on the page. */
  useEffect(() => {
    if (isAnalyzing) {
      pendingScrollRef.current = true;
      return;
    }
    if (!pendingScrollRef.current || rollNotes.length === 0) return;
    pendingScrollRef.current = false;
    const t = window.setTimeout(() => scrollToNotes(), 50);
    return () => window.clearTimeout(t);
  }, [isAnalyzing, rollNotes, pitchRows, scrollToNotes]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        onRollNotesChange(rollNotes.filter((n) => n.id !== selectedId));
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onRollNotesChange, rollNotes, selectedId]);

  const deleteSelectedNote = useCallback(() => {
    if (!selectedId) return;
    onRollNotesChange(rollNotes.filter((n) => n.id !== selectedId));
    setSelectedId(null);
  }, [onRollNotesChange, rollNotes, selectedId]);

  const startAuditionAtSharedClock = useCallback(
    (opts?: { skipOnStart?: boolean }) => {
      if (rollNotes.length === 0) return false;
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') void ctx.resume();
      if (!opts?.skipOnStart) onAuditionStart?.();
      const stamped = getAuditionStartAtSec?.();
      const timed = rollNotesToTimed(rollNotes, bpm);
      stopAudition();
      stopAuditionRef.current = scheduleNeuralHumRollAudition(
        ctx,
        getDestination(),
        instrumentId,
        timed,
        {
          dynamics: dynamics / 100,
          transposeSemis: transpose,
          startAtSec:
            typeof stamped === 'number' && Number.isFinite(stamped) ? stamped : undefined,
        },
      );
      setIsAuditioning(true);
      const endMs = Math.max(
        500,
        (timed[timed.length - 1]!.startSec + timed[timed.length - 1]!.durationSec) * 1000 + 200,
      );
      window.setTimeout(() => stopAudition(), endMs);
      return true;
    },
    [
      bpm,
      dynamics,
      getAudioContext,
      getAuditionStartAtSec,
      getDestination,
      instrumentId,
      onAuditionStart,
      rollNotes,
      stopAudition,
      transpose,
    ],
  );

  const handleAudition = useCallback(() => {
    if (isAuditioning) {
      stopAudition();
      return;
    }
    startAuditionAtSharedClock();
  }, [isAuditioning, startAuditionAtSharedClock, stopAudition]);

  const lastAuditionNonceRef = useRef(auditionNonce);
  useEffect(() => {
    if (auditionNonce === lastAuditionNonceRef.current) return;
    lastAuditionNonceRef.current = auditionNonce;
    if (auditionNonce <= 0) return;
    // Parent already stamped sync / kicked drums — don't re-enter onAuditionStart.
    startAuditionAtSharedClock({ skipOnStart: true });
  }, [auditionNonce, startAuditionAtSharedClock]);

  const lastAuditionStopNonceRef = useRef(auditionStopNonce);
  useEffect(() => {
    if (auditionStopNonce === lastAuditionStopNonceRef.current) return;
    lastAuditionStopNonceRef.current = auditionStopNonce;
    if (auditionStopNonce <= 0) return;
    stopAudition();
  }, [auditionStopNonce, stopAudition]);

  const handleSave = useCallback(() => {
    saveNeuralHumRollDraft({ bars, notes: rollNotes });
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1200);
  }, [bars, rollNotes]);

  const handleLoadDraft = useCallback(() => {
    const draft = loadNeuralHumRollDraft();
    if (!draft) return;
    onBarsChange(draft.bars);
    onRollNotesChange(draft.notes);
  }, [onBarsChange, onRollNotesChange]);

  const handleClearAll = useCallback(() => {
    if (!canClearAll && rollNotes.length === 0) return;
    if (!window.confirm('Clear all notes and reset the melody roll?')) return;
    onClearAll?.();
    onRollNotesChange([]);
    setSelectedId(null);
  }, [canClearAll, onClearAll, onRollNotesChange, rollNotes.length]);

  const beginNoteDrag = useCallback(
    (e: ReactPointerEvent<HTMLElement>, note: NeuralHumRollNote, mode: NoteDrag['mode']) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      setSelectedId(note.id);
      dragRef.current = {
        mode,
        id: note.id,
        slot0: note.startSlot,
        len0: note.lenSlots,
        pitch0: note.pitch,
        x0: e.clientX,
        y0: e.clientY,
      };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* */
      }
    },
    [],
  );

  const handleGridPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest('[data-roll-note]')) return;
      const cell = cellFromPointer(e.clientX, e.clientY);
      if (!cell) return;
      setSelectedId(null);
      const startSlot = snapNeuralHumRollSlot(cell.slot, quantize, totalSlots);
      const lenSlots = snapNeuralHumRollLen(2, quantize, totalSlots - startSlot);
      const next: NeuralHumRollNote = {
        id: newNeuralHumRollNoteId(),
        pitch: cell.pitch,
        startSlot,
        lenSlots,
        velocity: 100,
      };
      onRollNotesChange(
        [...rollNotes.filter((n) => n.startSlot !== startSlot), next].sort(
          (a, b) => a.startSlot - b.startSlot,
        ),
      );
      setSelectedId(next.id);
    },
    [cellFromPointer, onRollNotesChange, quantize, rollNotes, totalSlots],
  );

  const handleDragPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.x0;
      const dy = e.clientY - drag.y0;
      const note = rollNotes.find((n) => n.id === drag.id);
      if (!note) return;

      if (drag.mode === 'resize-end') {
        const lenDelta = Math.round(dx / COL_W);
        const rawLen = Math.max(1, Math.min(totalSlots - note.startSlot, drag.len0 + lenDelta));
        const newLen = snapNeuralHumRollLen(rawLen, quantize, totalSlots - note.startSlot);
        if (newLen === note.lenSlots) return;
        onRollNotesChange(rollNotes.map((n) => (n.id === drag.id ? { ...n, lenSlots: newLen } : n)));
        return;
      }

      const slotDelta = Math.round(dx / COL_W);
      const pitchDelta = -Math.round(dy / ROW_H);
      const rawSlot = Math.max(0, Math.min(totalSlots - note.lenSlots, drag.slot0 + slotDelta));
      const newSlot = snapNeuralHumRollSlot(rawSlot, quantize, totalSlots - note.lenSlots + 1);
      const newPitch = snapPitch(drag.pitch0 + pitchDelta);
      if (newSlot === note.startSlot && newPitch === note.pitch) return;
      onRollNotesChange(
        rollNotes.map((n) =>
          n.id === drag.id ? { ...n, startSlot: newSlot, pitch: newPitch } : n,
        ),
      );
    },
    [onRollNotesChange, quantize, rollNotes, snapPitch, totalSlots],
  );
  const handleDragPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const barLines = useMemo(() => {
    const lines: number[] = [];
    for (let b = 1; b < bars; b++) lines.push(b * NEURAL_HUM_ROLL_SLOTS_PER_BAR);
    return lines;
  }, [bars]);

  const gridW = totalSlots * COL_W;
  const quantizeStep = neuralHumQuantizeStepSlots(quantize);

  return (
    <div
      ref={rootRef}
      className="flex flex-col gap-2 rounded-md p-3"
      style={{ background: '#0d0d14', border: `1px solid ${NH_SCALE.borderHi}` }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: NH_SCALE.primary }}>
          Melody roll
        </span>
        <select
          value={bars}
          onChange={(e) => {
            const next = Number(e.target.value) === 4 ? 4 : 8;
            onBarsChange(next);
            onRollNotesChange(clampRollNotesToBars(rollNotes, next));
          }}
          className="text-xs rounded px-2 py-1"
          style={{ background: '#121218', color: '#ccc', border: '1px solid #333' }}
          title="Max length — 4 or 8 bars only"
        >
          <option value={4}>4 bars</option>
          <option value={8}>8 bars</option>
        </select>
        <select
          value={quantize}
          onChange={(e) => onQuantizeChange(e.target.value as NeuralHumRollQuantize)}
          className="text-xs rounded px-2 py-1"
          style={{ background: '#121218', color: '#ccc', border: '1px solid #333' }}
          title="Grid size for Quantize"
        >
          {NEURAL_HUM_QUANTIZE_OPTIONS.map((q) => (
            <option key={q} value={q}>
              {q}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => onQuantizeNow?.()}
          disabled={!onQuantizeNow || rollNotes.length === 0}
          className="nh-quantize-btn px-2 py-1 rounded text-xs font-bold uppercase tracking-wide"
          style={{
            background: rollNotes.length > 0 ? undefined : '#121218',
            color: rollNotes.length > 0 ? undefined : '#444',
            border: `1px solid ${rollNotes.length > 0 ? '#00E5FF66' : '#333'}`,
          }}
          title="Snap note starts to the selected grid — fixes human timing"
        >
          Quantize
        </button>
        {onApplyToTrack ? (
          <button
            type="button"
            onClick={onApplyToTrack}
            disabled={rollNotes.length === 0}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide disabled:opacity-40"
            style={{
              background: applyToTrackFlash
                ? 'rgba(0,255,136,0.22)'
                : applyToTrackDirty
                  ? 'linear-gradient(135deg, #00E5FF33, #00b8d428)'
                  : '#121218',
              color: applyToTrackFlash ? '#00ff88' : applyToTrackDirty ? '#7df9ff' : '#666',
              border: `1px solid ${
                applyToTrackFlash ? '#00ff8866' : applyToTrackDirty ? '#00E5FF88' : '#333'
              }`,
              boxShadow: applyToTrackDirty ? '0 0 10px rgba(0,229,255,0.2)' : undefined,
            }}
            title="Edit on this melody roll first, then send the MIDI to this SE2 track’s piano roll"
          >
            <Send size={11} />
            {applyToTrackFlash ? 'Applied' : applyToTrackDirty ? 'Apply to track' : 'On track'}
          </button>
        ) : null}
        <span className="text-10px font-mono" style={{ color: NH_SCALE.primary }} title="Project tempo">
          {Math.round(bpm)} BPM
        </span>
        <span className="text-10px" style={{ color: '#666' }}>
          {rollNotes.length} notes
        </span>
        <div className="flex flex-wrap gap-1.5 ml-auto">
          <button
            type="button"
            onClick={handleAudition}
            disabled={rollNotes.length === 0}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold"
            style={{
              background: isAuditioning ? '#00ff8833' : '#121218',
              color: isAuditioning ? '#00ff88' : '#aaa',
              border: '1px solid #333',
            }}
          >
            {isAuditioning ? <Pause size={12} /> : <Play size={12} />}
            Audition
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold"
            style={{ background: '#121218', color: savedFlash ? '#00ff88' : '#aaa', border: '1px solid #333' }}
          >
            <Save size={12} />
            {savedFlash ? 'Saved' : 'Save'}
          </button>
          <button
            type="button"
            onClick={handleLoadDraft}
            className="px-2 py-1 rounded text-xs font-bold"
            style={{ background: '#121218', color: '#888', border: '1px solid #333' }}
          >
            Load
          </button>
          <button
            type="button"
            onClick={deleteSelectedNote}
            disabled={!selectedId}
            title="Delete selected note"
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold"
            style={{
              background: selectedId ? '#2a1010' : '#121218',
              color: selectedId ? '#f87171' : '#444',
              border: `1px solid ${selectedId ? '#7f1d1d' : '#1a1a24'}`,
              cursor: selectedId ? 'pointer' : 'not-allowed',
            }}
          >
            <Trash2 size={12} />
            Delete
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            disabled={!canClearAll && rollNotes.length === 0}
            title="Clear entire roll and all captured MIDI"
            className="px-2 py-1 rounded text-xs font-bold"
            style={{
              background: '#121218',
              color: canClearAll || rollNotes.length > 0 ? '#888' : '#444',
              border: '1px solid #333',
              cursor: canClearAll || rollNotes.length > 0 ? 'pointer' : 'not-allowed',
            }}
          >
            Clear all
          </button>
        </div>
      </div>

      <p className="text-10px" style={{ color: '#555' }}>
        {rollNotes.length === 0
          ? 'Hum to capture MIDI, or click the grid to draw notes manually (4 or 8 bars max).'
          : 'Click to add · drag note to move · drag right edge to resize · snapped to BPM grid.'}
      </p>

      <div className="rounded border border-[#222] overflow-hidden" style={{ minHeight: 200 }}>
        {/* Single scroll viewport — bar ruler + keys + grid move together horizontally */}
        <div
          ref={scrollRef}
          className="overflow-auto relative"
          style={{ maxHeight: 280, minHeight: 200 }}
        >
          <div style={{ width: KEY_W + gridW, minWidth: '100%' }}>
            {/* Bar ruler — sticky top so labels stay visible while scrolling vertically */}
            <div
              className="sticky top-0 z-20 flex"
              style={{ background: '#121218', borderBottom: '1px solid #222' }}
            >
              <div
                className="sticky left-0 z-30 shrink-0"
                style={{ width: KEY_W, background: NH_PIANO.white, borderRight: `1px solid ${NH_PIANO.whiteBorder}` }}
              />
              <div className="flex shrink-0" style={{ width: gridW }}>
                {Array.from({ length: bars }, (_, bar) => (
                  <div
                    key={bar}
                    style={{
                      width: NEURAL_HUM_ROLL_SLOTS_PER_BAR * COL_W,
                      flexShrink: 0,
                      textAlign: 'center',
                      fontSize: 9,
                      fontWeight: 800,
                      color: '#888',
                      padding: '4px 0',
                      borderRight: bar < bars - 1 ? `1px solid ${NH_SCALE.borderHi}` : undefined,
                    }}
                  >
                    Bar {bar + 1}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex">
              {/* Pitch keys — sticky left while scrolling horizontally */}
              <div
                className="sticky left-0 z-10 shrink-0"
                style={{ width: KEY_W, background: NH_PIANO.white, borderRight: `1px solid ${NH_PIANO.whiteBorder}` }}
              >
                {pitchRows.map((midi) => {
                  const pc = ((midi % 12) + 12) % 12;
                  const inScale = !scaleSet || scaleSet.has(pc);
                  const isBlack = isBlackKeyPc(pc);
                  const isC = pc === 0;
                  const outOfScale = !keyLockOff && !inScale;
                  const whiteBg = outOfScale ? '#e8e8e4' : inScale ? NH_SCALE.whiteKeyInScale : NH_PIANO.white;
                  const blackBg = outOfScale ? '#16161c' : inScale ? NH_SCALE.blackKeyInScale : NH_PIANO.black;
                  return (
                    <div
                      key={midi}
                      style={{
                        position: 'relative',
                        height: ROW_H,
                        background: isBlack ? NH_PIANO.white : whiteBg,
                        borderBottom: isBlack ? 'none' : `1px solid ${NH_PIANO.whiteBorder}`,
                      }}
                    >
                      {isBlack && (
                        <div
                          style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            width: `${BLACK_KEY_W_RATIO * 100}%`,
                            height: '100%',
                            background: blackBg,
                            borderRight: `1px solid ${NH_PIANO.blackBorder}`,
                            borderBottom: `1px solid ${NH_PIANO.blackBorder}`,
                            borderRadius: '0 0 3px 0',
                            boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.5)',
                          }}
                        />
                      )}
                      <span
                        style={{
                          position: 'relative',
                          zIndex: 1,
                          height: '100%',
                          fontSize: 7,
                          fontWeight: isC ? 800 : 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          paddingRight: 4,
                          color: outOfScale
                            ? '#999'
                            : isBlack
                              ? NH_PIANO.labelBlack
                              : isC
                                ? NH_PIANO.labelRoot
                                : NH_PIANO.label,
                          opacity: outOfScale ? 0.55 : 1,
                        }}
                      >
                        {isC ? rollKeyLabel(midi) : ''}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div
                ref={gridRef}
                className="relative shrink-0 select-none"
                style={{
                  width: gridW,
                  height: pitchRows.length * ROW_H,
                  background: '#16161c',
                  cursor: 'crosshair',
                  touchAction: 'none',
                }}
                onPointerDown={handleGridPointerDown}
                onPointerMove={handleDragPointerMove}
                onPointerUp={handleDragPointerUp}
                onPointerLeave={handleDragPointerUp}
              >
          {pitchRows.map((midi, ri) => {
            const pc = ((midi % 12) + 12) % 12;
            const inScale = !scaleSet || scaleSet.has(pc);
            const isBlack = isBlackKeyPc(pc);
            const outOfScale = !keyLockOff && !inScale;
            return (
              <div
                key={`row-${midi}`}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: ri * ROW_H,
                  width: gridW,
                  height: ROW_H,
                  background: outOfScale
                    ? isBlack
                      ? '#0c0c0c'
                      : '#101010'
                    : inScale
                      ? isBlack
                        ? NH_SCALE.rowTintBlack
                        : NH_SCALE.rowTint
                      : isBlack
                        ? '#121212'
                        : '#1a1a18',
                  borderBottom: '1px solid #1a1a24',
                  pointerEvents: 'none',
                }}
              />
            );
          })}

          {barLines.map((slot) => (
            <div
              key={`bar-${slot}`}
              style={{
                position: 'absolute',
                left: slot * COL_W,
                top: 0,
                bottom: 0,
                width: 1,
                background: NH_SCALE.scopeWedge,
                pointerEvents: 'none',
                zIndex: 2,
              }}
            />
          ))}

          {/* Quantize grid — every step (1/16 default) so notes visibly lock to lines */}
          {Array.from({ length: totalSlots }, (_, slot) => {
            if (slot === 0) return null;
            if (slot % NEURAL_HUM_ROLL_SLOTS_PER_BAR === 0) return null; // bar line already drawn
            if (slot % quantizeStep !== 0) return null;
            const isBeat = slot % 4 === 0;
            return (
              <div
                key={`q-${slot}`}
                style={{
                  position: 'absolute',
                  left: slot * COL_W,
                  top: 0,
                  bottom: 0,
                  width: 1,
                  background: isBeat ? 'rgba(0,229,255,0.22)' : 'rgba(255,255,255,0.06)',
                  pointerEvents: 'none',
                  zIndex: 1,
                }}
              />
            );
          })}

          {rollNotes.map((n) => {
            const ri = pitchRows.indexOf(n.pitch);
            if (ri < 0) return null;
            const selected = selectedId === n.id;
            return (
              <div
                key={n.id}
                data-roll-note
                style={{
                  position: 'absolute',
                  left: n.startSlot * COL_W,
                  top: ri * ROW_H + 2,
                  width: Math.max(2, n.lenSlots * COL_W - 1),
                  height: ROW_H - 4,
                  borderRadius: 3,
                  background: selected ? '#00ff88' : NH_SCALE.accent,
                  opacity: selected ? 1 : 0.88,
                  boxShadow: selected ? '0 0 8px #00ff8866' : `0 0 4px ${NH_SCALE.borderHi}`,
                  pointerEvents: 'auto',
                  cursor: selected ? 'grab' : 'pointer',
                  zIndex: selected ? 12 : 8,
                }}
                title={`${rollKeyLabel(n.pitch)} · slot ${n.startSlot} · ${n.lenSlots} steps`}
                onPointerDown={(e) => beginNoteDrag(e, n, 'move')}
                onPointerMove={handleDragPointerMove}
                onPointerUp={handleDragPointerUp}
                onPointerLeave={handleDragPointerUp}
              >
                {selected && (
                  <div
                    data-resize-handle
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      bottom: 0,
                      width: RESIZE_HANDLE_W,
                      cursor: 'ew-resize',
                      borderRadius: '0 3px 3px 0',
                      background: 'rgba(0,0,0,0.35)',
                      borderLeft: '1px solid rgba(255,255,255,0.25)',
                    }}
                    onPointerDown={(e) => beginNoteDrag(e, n, 'resize-end')}
                  />
                )}
              </div>
            );
          })}

          {isAnalyzing && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.72)', zIndex: 20 }}
            >
              <span className="text-xs font-bold" style={{ color: NH_SCALE.primary }}>
                Converting hum → MIDI…
              </span>
            </div>
          )}

          {!isAnalyzing && rollNotes.length === 0 && (
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              style={{ zIndex: 5 }}
            >
              <span className="text-xs text-center px-4" style={{ color: '#444' }}>
                Empty — record a hum or click cells to place notes
              </span>
            </div>
          )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showExport && rollNotes.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1 border-t border-[#222]">
          {onExportGroove && (
            <button
              type="button"
              onClick={onExportGroove}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold"
              style={{ background: '#0d0d14', color: '#7cf4c6', border: '1px solid #7cf4c644' }}
            >
              <Send size={11} /> Groove Lab
            </button>
          )}
          {onExportSynth && (
            <button
              type="button"
              onClick={onExportSynth}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold"
              style={{ background: '#0d0d14', color: '#D500F9', border: '1px solid #D500F944' }}
            >
              <Send size={11} /> NEW SYNTH
            </button>
          )}
          {onExportStudio && (
            <button
              type="button"
              onClick={onExportStudio}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold"
              style={{ background: '#1a1a2a', color: '#00E5FF', border: '1px solid #00E5FF55' }}
            >
              <Send size={11} /> Studio
            </button>
          )}
          {onDownloadMidi && (
            <button
              type="button"
              onClick={onDownloadMidi}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold"
              style={{ background: '#121218', color: '#D500F9', border: '1px solid #D500F944' }}
            >
              <Download size={11} /> .mid
            </button>
          )}
        </div>
      )}
    </div>
  );
}
