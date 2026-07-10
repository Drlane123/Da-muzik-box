'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Play, RotateCcw, Square } from 'lucide-react';
import { Se2GuitarChordDiagram } from '@/app/components/studio/Se2GuitarVisual';
import {
  SE2_GUITAR_CHORD_SLOT_DEFAULTS,
  SE2_GUITAR_SEQ_PATTERNS,
  SE2_GUITAR_SEQ_ROWS,
  SE2_GUITAR_SEQ_STEPS_PER_BAR,
  cloneSeqPattern,
  se2GuitarSeqCanonicalStep,
  se2GuitarSeqPatternToNotes,
  se2GuitarSeqStepsForBars,
  toggleSeqCell,
  type Se2GuitarSeqDisplayBars,
  type Se2GuitarSeqPattern,
  type Se2GuitarSeqRowId,
} from '@/app/lib/studio/se2GuitarLoopSequencer';
import {
  SE2_GUITAR_CHORDS,
  se2GuitarChordQualityLabel,
  type Se2GuitarChordId,
} from '@/app/lib/studio/se2GuitarChords';
import {
  SE2_GUITAR_PROGRESSIONS,
  se2GuitarProgressionToSlots,
} from '@/app/lib/studio/se2GuitarProgressions';
import { previewSe2GuitarLoop, stopSe2GuitarLoopPreview, auditionSe2GuitarNote } from '@/app/lib/studio/se2GuitarSoundfont';
import type { Se2GuitarInstrumentId } from '@/app/lib/studio/se2GuitarInstruments';
import type { Se2GuitarMockNote } from '@/app/lib/studio/se2GuitarTrack';
import { Se2GuitarDarkSelect } from '@/app/components/studio/Se2GuitarDarkSelect';
import {
  se2GuitarChordRootName,
  se2GuitarTransposeLoopNotes,
  se2GuitarTransposeMockNotes,
  type Se2GuitarKeyConvertSelection,
} from '@/app/lib/studio/se2GuitarKeyConvert';
import type { Se2GuitarScaleId } from '@/app/lib/studio/se2GuitarScales';
import type { Se2GuitarPartBars } from '@/app/lib/studio/se2GuitarPartBars';

import { SE2_GUITAR_UI } from '@/app/lib/studio/se2GuitarUiTheme';

const ACCENT = SE2_GUITAR_UI.accent;
const PANEL_BG = SE2_GUITAR_UI.surfaceBg;

function WoodPanel({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-sm border p-1 ${className}`}
      style={{
        borderColor: SE2_GUITAR_UI.border,
        background: PANEL_BG,
        boxShadow: 'inset 0 1px 0 #ffffff08, inset 0 -2px 4px #0006',
      }}
    >
      {children}
    </div>
  );
}

function LengthChip({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded border px-1.5 py-0.5 text-[7px] font-black uppercase disabled:opacity-40"
      style={{
        borderColor: active ? `${ACCENT}88` : '#3a3020',
        background: active ? `${ACCENT}22` : '#141008',
        color: active ? ACCENT : '#8a7860',
      }}
    >
      {label}
    </button>
  );
}

export type Se2GuitarStrumGridPanelProps = {
  beatsPerBar: number;
  bpm?: number;
  disabled?: boolean;
  insertDisabled?: boolean;
  instrumentId: Se2GuitarInstrumentId;
  transpose: number;
  scaleRoot: string;
  scaleId: Se2GuitarScaleId;
  keyShiftSemis: number;
  keySelection: Se2GuitarKeyConvertSelection | null;
  onKeySelection: (sel: Se2GuitarKeyConvertSelection | null) => void;
  onConvertKey: () => void;
  onResetKey: () => void;
  getPlayheadBeat?: () => number;
  getAudioContext: () => AudioContext;
  getPreviewDestination: (ctx: AudioContext) => AudioNode;
  notes: readonly Se2GuitarMockNote[];
  onApplyNotes: (notes: Se2GuitarMockNote[]) => void;
  onInstrumentIdChange: (id: Se2GuitarInstrumentId) => void;
  onPlayingMidis?: (midis: number[], durationMs?: number) => void;
};

export function Se2GuitarStrumGridPanel({
  beatsPerBar,
  bpm = 120,
  disabled = false,
  insertDisabled = false,
  instrumentId,
  transpose,
  keyShiftSemis,
  onKeySelection,
  getPlayheadBeat,
  getAudioContext,
  getPreviewDestination,
  notes,
  onApplyNotes,
  onPlayingMidis,
}: Se2GuitarStrumGridPanelProps) {
  const [strumBars, setStrumBars] = useState<Se2GuitarPartBars>(4);
  const seqBars: Se2GuitarSeqDisplayBars = strumBars >= 8 ? 8 : 4;
  const totalSteps = se2GuitarSeqStepsForBars(seqBars);

  const [strummerOn, setStrummerOn] = useState(true);
  const [patternIdx, setPatternIdx] = useState(0);
  const [seqPattern, setSeqPattern] = useState<Se2GuitarSeqPattern>(() =>
    cloneSeqPattern(SE2_GUITAR_SEQ_PATTERNS[0]!),
  );
  const [chordSlots, setChordSlots] = useState<Se2GuitarChordId[]>([
    ...SE2_GUITAR_CHORD_SLOT_DEFAULTS,
  ]);
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [activeProgressionId, setActiveProgressionId] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const insertBarHint = Math.max(
    1,
    Math.floor((getPlayheadBeat?.() ?? 0) / Math.max(1, beatsPerBar)) + 1,
  );

  const loadPattern = useCallback((idx: number) => {
    const p = SE2_GUITAR_SEQ_PATTERNS[idx];
    if (!p) return;
    setPatternIdx(idx);
    setSeqPattern(cloneSeqPattern(p));
    setActiveProgressionId(null);
  }, []);

  const stopPreview = useCallback(() => {
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    stopSe2GuitarLoopPreview();
    setPreviewing(false);
  }, []);

  useEffect(() => () => stopPreview(), [stopPreview]);

  const buildNotes = useCallback(
    (startBar: number) => {
      const raw = se2GuitarSeqPatternToNotes(seqPattern, chordSlots, beatsPerBar, startBar, seqBars);
      const mapped = raw.map((n) => ({
        pitch: n.pitch,
        startBeat: n.startBeat,
        durationBeats: n.durationBeats,
        velocity: n.velocity,
      }));
      return keyShiftSemis !== 0 ? se2GuitarTransposeMockNotes(mapped, keyShiftSemis) : mapped;
    },
    [beatsPerBar, chordSlots, keyShiftSemis, seqBars, seqPattern],
  );

  const syncSeqSelection = useCallback(() => {
    onKeySelection({
      label: `SEQ — ${seqPattern.name}`,
      sourceKey: se2GuitarChordRootName(chordSlots[0] ?? 'C'),
      chordLine: chordSlots.slice(0, seqBars).join(' · '),
    });
  }, [chordSlots, onKeySelection, seqBars, seqPattern.name]);

  const previewSeq = useCallback(() => {
    if (!strummerOn) return;
    syncSeqSelection();
    void (async () => {
      try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') await ctx.resume();
        const dest = getPreviewDestination(ctx);
        await auditionSe2GuitarNote(ctx, dest, 60, instrumentId, 80, transpose);
        const atZero = se2GuitarSeqPatternToNotes(seqPattern, chordSlots, beatsPerBar, 0, seqBars);
        const shifted =
          keyShiftSemis !== 0
            ? se2GuitarTransposeLoopNotes(atZero, keyShiftSemis)
            : atZero;
        await previewSe2GuitarLoop(ctx, dest, shifted, instrumentId, bpm, transpose);
        setPreviewing(true);
        if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
        const sec = (seqBars * beatsPerBar * 60) / Math.max(40, bpm);
        previewTimerRef.current = setTimeout(() => {
          previewTimerRef.current = null;
          setPreviewing(false);
        }, sec * 1000 + 100);

        for (const n of shifted) {
          const t = (n.startBeat * 60) / Math.max(40, bpm);
          setTimeout(() => {
            onPlayingMidis?.([n.pitch], 140);
          }, t * 1000);
        }
      } catch {
        /* audio */
      }
    })();
  }, [
    beatsPerBar,
    bpm,
    chordSlots,
    getAudioContext,
    getPreviewDestination,
    instrumentId,
    keyShiftSemis,
    onPlayingMidis,
    seqBars,
    seqPattern,
    strummerOn,
    syncSeqSelection,
    transpose,
  ]);

  const insertSeq = useCallback(() => {
    if (!strummerOn) return;
    syncSeqSelection();
    if (insertDisabled) return;
    const beat = getPlayheadBeat?.() ?? 0;
    const insertBar = Math.max(0, Math.floor(beat / Math.max(1, beatsPerBar)));
    const barStart = insertBar * beatsPerBar;
    const barEnd = barStart + seqBars * beatsPerBar;
    const kept = notes.filter((n) => n.startBeat < barStart || n.startBeat >= barEnd);
    const fresh = buildNotes(insertBar);
    onApplyNotes([...kept, ...fresh]);
  }, [
    beatsPerBar,
    buildNotes,
    getPlayheadBeat,
    insertDisabled,
    notes,
    onApplyNotes,
    seqBars,
    strummerOn,
    syncSeqSelection,
  ]);

  const toggleCell = useCallback((rowId: Se2GuitarSeqRowId, step: number) => {
    setSeqPattern((p) => toggleSeqCell(p, rowId, step));
    setActiveProgressionId(null);
  }, []);

  const applyProgression = useCallback(
    (prog: (typeof SE2_GUITAR_PROGRESSIONS)[number]) => {
      setChordSlots(se2GuitarProgressionToSlots(prog, seqBars === 8));
      setActiveProgressionId(prog.id);
      onKeySelection({
        label: prog.label,
        sourceKey: se2GuitarChordRootName(prog.chords[0]!),
        chordLine: (seqBars === 8 && prog.chords8
          ? [...prog.chords, ...prog.chords8]
          : [...prog.chords, ...prog.chords]
        ).join(' · '),
      });
    },
    [onKeySelection, seqBars],
  );

  const selectedChordId = chordSlots[selectedSlot] ?? 'C';

  const cellActive = useCallback(
    (rowId: Se2GuitarSeqRowId, step: number) =>
      seqPattern.cells[rowId]?.includes(se2GuitarSeqCanonicalStep(step)) ?? false,
    [seqPattern],
  );

  const barChordLabels = useMemo(() => {
    return Array.from({ length: seqBars }, (_, bar) => {
      const barInPattern = bar % 4;
      const slotIdx = seqPattern.barChords[barInPattern] ?? 0;
      const id = chordSlots[slotIdx] ?? 'C';
      const def = SE2_GUITAR_CHORDS.find((c) => c.id === id);
      return def?.label ?? id;
    });
  }, [chordSlots, seqBars, seqPattern.barChords]);

  const visibleSlots = seqBars === 8 ? 8 : 4;

  return (
    <div
      className="flex w-full min-w-0 flex-col gap-1 rounded-sm border p-1"
      style={{ borderColor: SE2_GUITAR_UI.border, background: SE2_GUITAR_UI.panelBg }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Style + length + patterns — directly above the grid */}
      <WoodPanel className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[6px] font-black uppercase tracking-wider text-[#6a5848]">Length</span>
          <LengthChip
            label="4 bar"
            active={strumBars === 4}
            disabled={disabled}
            onClick={() => setStrumBars(4)}
          />
          <LengthChip
            label="8 bar"
            active={strumBars === 8}
            disabled={disabled}
            onClick={() => setStrumBars(8)}
          />
          <span className="mx-0.5 text-[#3a3020]">|</span>
          <span className="text-[6px] font-black uppercase tracking-wider text-[#6a5848]">Style</span>
          <div className="flex min-w-0 flex-1 flex-wrap gap-0.5">
            {SE2_GUITAR_PROGRESSIONS.map((prog) => {
              const active = activeProgressionId === prog.id;
              return (
                <button
                  key={prog.id}
                  type="button"
                  disabled={disabled}
                  title={prog.hint}
                  onClick={() => applyProgression(prog)}
                  className="rounded border px-1 py-0.5 text-[6px] font-bold uppercase disabled:opacity-40"
                  style={{
                    borderColor: active ? `${ACCENT}aa` : '#3a3020',
                    background: active ? `${ACCENT}28` : '#141008',
                    color: active ? ACCENT : '#a89878',
                    boxShadow: active ? `0 0 8px ${ACCENT}33` : undefined,
                  }}
                >
                  {prog.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[6px] font-black uppercase tracking-wider text-[#6a5848]">SEQ</span>
          {SE2_GUITAR_SEQ_PATTERNS.map((p, i) => (
            <button
              key={p.id}
              type="button"
              disabled={disabled}
              title={`${p.name} · ${p.style}`}
              onClick={() => loadPattern(i)}
              className="rounded border px-1 py-0.5 text-[7px] font-black tabular-nums disabled:opacity-40"
              style={{
                borderColor: patternIdx === i ? `${ACCENT}88` : '#3a3020',
                background: patternIdx === i ? `${ACCENT}22` : '#141008',
                color: patternIdx === i ? ACCENT : '#8a7860',
              }}
            >
              {p.id}
            </button>
          ))}
          <span className="mx-0.5 text-[#3a3020]">|</span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => loadPattern(patternIdx)}
            className="rounded border p-0.5 disabled:opacity-40"
            style={{ borderColor: '#4a4030', color: '#9a8870' }}
            title="Reset pattern"
          >
            <RotateCcw size={9} />
          </button>
          <button
            type="button"
            disabled={disabled || !strummerOn}
            onClick={() => (previewing ? stopPreview() : previewSeq())}
            className="rounded border p-0.5 disabled:opacity-40"
            style={{ borderColor: `${ACCENT}66`, color: ACCENT, background: `${ACCENT}12` }}
            title={`Preview ${seqBars}-bar loop`}
          >
            {previewing ? <Square size={9} fill="currentColor" /> : <Play size={9} />}
          </button>
          <button
            type="button"
            disabled={disabled || !strummerOn || insertDisabled}
            onClick={insertSeq}
            className="ml-auto rounded border px-2 py-0.5 text-[7px] font-black uppercase disabled:opacity-40"
            style={{ borderColor: '#7cf4c655', background: '#0a1410', color: '#7cf4c6' }}
            title={insertDisabled ? 'Stop transport to insert on roll' : undefined}
          >
            Insert bar {insertBarHint}
          </button>
        </div>

        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0 text-[6px] font-bold leading-tight">
          <span style={{ color: ACCENT }}>{seqPattern.name}</span>
          <span className="text-[#8a7860]">{seqPattern.style}</span>
          <span className="text-[#6a5848]">
            {seqBars} bars · 1/16 · {bpm} BPM
          </span>
          {activeProgressionId ? (
            <span className="text-[#7cf4c6]">
              · {SE2_GUITAR_PROGRESSIONS.find((p) => p.id === activeProgressionId)?.label}
            </span>
          ) : null}
        </div>
      </WoodPanel>

      {/* Full-width step grid — chords visible per bar */}
      <WoodPanel className="min-w-0 overflow-x-auto">
        <div className="mb-0.5 flex items-center justify-between gap-1">
          <span className="text-[7px] font-black uppercase tracking-wider" style={{ color: ACCENT }}>
            Strum grid
          </span>
          <span className="text-[5px] font-bold text-[#6a5848]">
            {seqBars} bars · tap cells to edit
          </span>
        </div>
        <div className="flex min-w-[240px] flex-col gap-px">
          {barChordLabels.map((chordLabel, bar) => (
            <div key={`bar-${bar}`} className="flex items-center gap-0.5">
              <span
                className="flex w-10 shrink-0 flex-col leading-none"
                title={`Bar ${bar + 1}`}
              >
                <span className="text-[5px] font-bold text-[#6a5848]">B{bar + 1}</span>
                <span
                  className="truncate text-[6px] font-black"
                  style={{ color: ACCENT }}
                >
                  {chordLabel}
                </span>
              </span>
              <div className="flex flex-1 gap-px">
                {Array.from({ length: SE2_GUITAR_SEQ_STEPS_PER_BAR }, (_, s) => {
                  const step = bar * SE2_GUITAR_SEQ_STEPS_PER_BAR + s;
                  const beatInBar = s % 4 === 0;
                  return (
                    <div
                      key={`ruler-${step}`}
                      className="h-0.5 flex-1 rounded-[1px]"
                      style={{
                        background: beatInBar ? '#4a4038' : '#2a2418',
                        opacity: 0.7,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
          {SE2_GUITAR_SEQ_ROWS.map((row) => (
            <div key={row.id} className="flex items-center gap-0.5">
              <span
                className="flex w-10 shrink-0 items-center justify-center text-[8px] font-black"
                style={{ color: '#9a8870' }}
                title={row.label}
              >
                {row.icon}
              </span>
              <div className="flex flex-1 gap-px">
                {Array.from({ length: totalSteps }, (_, step) => {
                  const active = cellActive(row.id, step);
                  const bar = Math.floor(step / SE2_GUITAR_SEQ_STEPS_PER_BAR);
                  const isBarStart = step % SE2_GUITAR_SEQ_STEPS_PER_BAR === 0;
                  return (
                    <button
                      key={step}
                      type="button"
                      disabled={disabled || !strummerOn}
                      onClick={() => toggleCell(row.id, step)}
                      className="h-3.5 min-w-[3px] flex-1 rounded-[1px] border-0 p-0 transition-colors disabled:opacity-30"
                      style={{
                        background: active
                          ? bar % 2 === 0
                            ? 'linear-gradient(180deg, #c878d8 0%, #8848a8 100%)'
                            : 'linear-gradient(180deg, #e87898 0%, #a84868 100%)'
                          : isBarStart
                            ? '#2a2418'
                            : '#1a140c',
                        boxShadow: active ? '0 0 4px #c878d888' : undefined,
                      }}
                      title={`${row.label} · bar ${bar + 1} · step ${(step % SE2_GUITAR_SEQ_STEPS_PER_BAR) + 1}`}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </WoodPanel>

      {/* Compact chord + strummer row */}
      <WoodPanel className="flex flex-wrap items-start gap-2">
        <div className="flex shrink-0 flex-col items-center gap-0.5">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setStrummerOn((o) => !o)}
            className="flex h-7 w-12 items-center rounded-full border-2 transition-colors disabled:opacity-40"
            style={{
              borderColor: strummerOn ? '#8a8070' : '#4a4030',
              background: strummerOn
                ? 'linear-gradient(180deg, #c8c0b0 0%, #6a6050 100%)'
                : 'linear-gradient(180deg, #4a4030 0%, #2a2418 100%)',
              boxShadow: strummerOn ? 'inset 0 2px 4px #fff4, 0 2px 4px #0008' : 'inset 0 2px 4px #0008',
            }}
            title="Strummer ON/OFF"
          >
            <span
              className="h-4 w-4 rounded-full border shadow-md transition-transform"
              style={{
                transform: strummerOn ? 'translateX(8px)' : 'translateX(-8px)',
                borderColor: '#3a3428',
                background: 'linear-gradient(180deg, #f0e8d8, #a89878)',
              }}
            />
          </button>
          <span className="text-[5px] font-black uppercase text-[#8a7860]">
            Strum {strummerOn ? 'ON' : 'OFF'}
          </span>
        </div>

        <Se2GuitarChordDiagram chordId={selectedChordId} />

        <div className="min-w-0 flex-1">
          <div className="mb-0.5 text-[5px] font-black uppercase tracking-wider text-[#6a5848]">
            Chord slots · bar {selectedSlot + 1}
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 sm:grid-cols-4">
            {chordSlots.slice(0, visibleSlots).map((id, i) => {
              const c = SE2_GUITAR_CHORDS.find((x) => x.id === id)!;
              const active = selectedSlot === i;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={disabled}
                  onClick={() => setSelectedSlot(i)}
                  className="flex min-w-0 items-center gap-1 rounded border px-1 py-0.5 text-left disabled:opacity-40"
                  style={{
                    borderColor: active ? `${ACCENT}66` : '#3a3020',
                    background: active ? `${ACCENT}14` : '#141008',
                  }}
                  title={`Bar ${i + 1} chord · ${c.label}`}
                >
                  <span
                    className="shrink-0 text-[6px] font-black tabular-nums"
                    style={{ color: active ? ACCENT : '#6a5848' }}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[6px] font-bold" style={{ color: '#d8c8a8' }}>
                    <Se2GuitarDarkSelect
                      disabled={disabled}
                      value={id}
                      onChange={(v) => {
                        const next = [...chordSlots];
                        next[i] = v as typeof id;
                        setChordSlots(next);
                        setActiveProgressionId(null);
                      }}
                      className="w-full border-transparent bg-transparent px-0 py-0 text-[6px]"
                      options={SE2_GUITAR_CHORDS.map((ch) => ({ value: ch.id, label: ch.label }))}
                    />
                  </span>
                  <span className="hidden shrink-0 truncate text-[5px] text-[#8a7860] sm:inline">
                    {se2GuitarChordQualityLabel(c)}
                  </span>
                </button>
              );
            })}
          </div>
          {visibleSlots < chordSlots.length ? (
            <details className="mt-1">
              <summary className="cursor-pointer text-[5px] font-black uppercase tracking-wider text-[#6a5848]">
                More slots (5–12)
              </summary>
              <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 sm:grid-cols-4">
                {chordSlots.slice(visibleSlots).map((id, offset) => {
                  const i = offset + visibleSlots;
                  const c = SE2_GUITAR_CHORDS.find((x) => x.id === id)!;
                  const active = selectedSlot === i;
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={disabled}
                      onClick={() => setSelectedSlot(i)}
                      className="flex min-w-0 items-center gap-1 rounded border px-1 py-0.5 text-left disabled:opacity-40"
                      style={{
                        borderColor: active ? `${ACCENT}66` : '#3a3020',
                        background: active ? `${ACCENT}14` : '#141008',
                      }}
                      title={`Slot ${i + 1} · ${c.label}`}
                    >
                      <span
                        className="shrink-0 text-[6px] font-black tabular-nums"
                        style={{ color: active ? ACCENT : '#6a5848' }}
                      >
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[6px] font-bold" style={{ color: '#d8c8a8' }}>
                        <Se2GuitarDarkSelect
                          disabled={disabled}
                          value={id}
                          onChange={(v) => {
                            const next = [...chordSlots];
                            next[i] = v as typeof id;
                            setChordSlots(next);
                            setActiveProgressionId(null);
                          }}
                          className="w-full border-transparent bg-transparent px-0 py-0 text-[6px]"
                          options={SE2_GUITAR_CHORDS.map((ch) => ({ value: ch.id, label: ch.label }))}
                        />
                      </span>
                    </button>
                  );
                })}
              </div>
            </details>
          ) : null}
        </div>
      </WoodPanel>
    </div>
  );
}

/** @deprecated Renamed — strum SEQ grid lives on the Strummer tab. */
export const Se2GuitarLoopWorkstation = Se2GuitarStrumGridPanel;
export type Se2GuitarLoopWorkstationProps = Se2GuitarStrumGridPanelProps;
