'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Play, Square } from 'lucide-react';
import {
  SE2_GUITAR_LOOP_GENRES,
  se2GuitarLoopGenreMeta,
  se2GuitarLoopNotesAtBar,
  se2GuitarLoopPresetCountByGenre,
  se2GuitarLoopPresetsForGenre,
  type Se2GuitarLoopGenre,
  type Se2GuitarLoopPreset,
} from '@/app/lib/studio/se2GuitarLoopPresets';
import { previewSe2GuitarLoop, stopSe2GuitarLoopPreview } from '@/app/lib/studio/se2GuitarSoundfont';
import type { Se2GuitarInstrumentId } from '@/app/lib/studio/se2GuitarInstruments';
import type { Se2GuitarMockNote } from '@/app/lib/studio/se2GuitarTrack';
import { Se2GuitarKeyConvertBar } from '@/app/components/studio/Se2GuitarKeyConvertBar';
import {
  se2GuitarInferLoopSourceKey,
  se2GuitarTransposeChordLine,
  se2GuitarTransposeLoopNotes,
  type Se2GuitarKeyConvertSelection,
} from '@/app/lib/studio/se2GuitarKeyConvert';
import type { Se2GuitarScaleId } from '@/app/lib/studio/se2GuitarScales';
import { se2GuitarHumanizePolyNotes } from '@/app/lib/studio/se2GuitarPlaybackHumanize';
import {
  SE2_GUITAR_PART_BAR_OPTIONS,
  se2GuitarTileLoopNotesToPartBars,
  type Se2GuitarPartBars,
} from '@/app/lib/studio/se2GuitarPartBars';
import { SE2_GUITAR_UI } from '@/app/lib/studio/se2GuitarUiTheme';
import { Se2GuitarLoopNoteGrid } from '@/app/components/studio/Se2GuitarLoopNoteGrid';

const ACCENT = SE2_GUITAR_UI.accent;

function LoopPresetCard({
  preset,
  active,
  accentHex,
  romanLine,
  meta,
  disabled,
  title,
  onClick,
}: {
  preset: Se2GuitarLoopPreset;
  active: boolean;
  accentHex: string;
  romanLine: string;
  meta: string;
  disabled?: boolean;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      className="flex min-h-[68px] min-w-[88px] max-w-[128px] shrink-0 flex-col justify-between rounded border px-1 py-0.5 text-left transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-40"
      style={{
        borderColor: active ? `${accentHex}cc` : SE2_GUITAR_UI.borderSoft,
        background: active
          ? `linear-gradient(165deg, ${accentHex}30 0%, ${accentHex}0c 55%, ${SE2_GUITAR_UI.insetBg} 100%)`
          : `linear-gradient(180deg, ${SE2_GUITAR_UI.surfaceBg} 0%, ${SE2_GUITAR_UI.insetBg} 100%)`,
        boxShadow: active ? `0 0 14px ${accentHex}40, inset 0 0 0 1px ${accentHex}66` : 'inset 0 1px 0 #ffffff06',
      }}
    >
      <span
        className="block truncate text-[7px] font-black uppercase leading-tight tracking-wide"
        style={{ color: active ? accentHex : SE2_GUITAR_UI.accentBright }}
      >
        {preset.label}
      </span>
      <span
        className="mt-1 block truncate font-mono text-[6px] leading-snug"
        style={{ color: active ? SE2_GUITAR_UI.accentBright : SE2_GUITAR_UI.textMuted }}
      >
        {romanLine}
      </span>
      <span
        className="mt-0.5 block truncate text-[5px] font-bold uppercase tracking-wider"
        style={{ color: SE2_GUITAR_UI.textSoft }}
      >
        {meta}
      </span>
    </button>
  );
}

function LoopGenreChip({
  label,
  active,
  accentHex,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  accentHex: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded border px-2 py-1 text-[7px] font-black uppercase transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40"
      style={{
        borderColor: active ? accentHex : SE2_GUITAR_UI.borderSoft,
        background: active
          ? `linear-gradient(165deg, ${accentHex}38 0%, ${accentHex}12 55%, ${SE2_GUITAR_UI.insetBg} 100%)`
          : SE2_GUITAR_UI.surfaceBg,
        color: active ? accentHex : SE2_GUITAR_UI.textMuted,
        boxShadow: active ? `0 0 14px ${accentHex}44, inset 0 0 0 1px ${accentHex}55` : 'inset 0 1px 0 #ffffff06',
      }}
    >
      {label}
    </button>
  );
}

export type Se2GuitarLoopsPanelProps = {
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
  onScaleRootChange?: (root: string) => void;
  onScaleIdChange?: (scaleId: Se2GuitarScaleId) => void;
  loopBars?: Se2GuitarPartBars;
  onLoopBarsChange?: (bars: Se2GuitarPartBars) => void;
  getPlayheadBeat?: () => number;
  ensureAudioContext?: () => Promise<AudioContext>;
  getAudioContext: () => AudioContext;
  getPreviewDestination: (ctx: AudioContext) => AudioNode;
  notes: readonly Se2GuitarMockNote[];
  onApplyNotes: (notes: Se2GuitarMockNote[]) => void;
  onInstrumentIdChange: (id: Se2GuitarInstrumentId) => void;
};

export function Se2GuitarLoopsPanel({
  beatsPerBar,
  bpm = 120,
  disabled = false,
  insertDisabled = false,
  instrumentId,
  transpose,
  scaleRoot,
  scaleId,
  keyShiftSemis,
  keySelection,
  onKeySelection,
  onConvertKey,
  onResetKey,
  onScaleRootChange,
  onScaleIdChange,
  loopBars: loopBarsProp,
  onLoopBarsChange,
  getPlayheadBeat,
  ensureAudioContext,
  getAudioContext,
  getPreviewDestination,
  notes,
  onApplyNotes,
  onInstrumentIdChange,
}: Se2GuitarLoopsPanelProps) {
  const [loopGenre, setLoopGenre] = useState<Se2GuitarLoopGenre>('rnb');
  const [loopBarsLocal, setLoopBarsLocal] = useState<Se2GuitarPartBars>(4);
  const loopBars = loopBarsProp ?? loopBarsLocal;
  const setLoopBars = onLoopBarsChange ?? setLoopBarsLocal;
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [lastInsertedLoopId, setLastInsertedLoopId] = useState<string | null>(null);
  const [previewingLoopId, setPreviewingLoopId] = useState<string | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const barrierRef = useRef<HTMLDivElement>(null);

  const genreMeta = se2GuitarLoopGenreMeta(loopGenre);
  const loopPresets = useMemo(
    () => se2GuitarLoopPresetsForGenre(loopGenre, loopBars),
    [loopGenre, loopBars],
  );

  const selectedPreset = useMemo(
    () => loopPresets.find((p) => p.id === selectedPresetId) ?? null,
    [loopPresets, selectedPresetId],
  );

  const genreCounts = useMemo(
    () =>
      Object.fromEntries(
        SE2_GUITAR_LOOP_GENRES.map((g) => [g.id, se2GuitarLoopPresetCountByGenre(g.id, loopBars)]),
      ) as Record<Se2GuitarLoopGenre, number>,
    [loopBars],
  );

  const insertBarHint = Math.max(
    1,
    Math.floor((getPlayheadBeat?.() ?? 0) / Math.max(1, beatsPerBar)) + 1,
  );

  const stopLoopPreview = useCallback(() => {
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    stopSe2GuitarLoopPreview();
    setPreviewingLoopId(null);
  }, []);

  useEffect(() => () => stopLoopPreview(), [stopLoopPreview]);

  useEffect(() => {
    stopLoopPreview();
    barrierRef.current?.scrollTo({ left: 0, behavior: 'auto' });
    const first = se2GuitarLoopPresetsForGenre(loopGenre, loopBars)[0];
    if (first) {
      setSelectedPresetId(first.id);
      onKeySelection({
        label: first.label,
        sourceKey: se2GuitarInferLoopSourceKey(first),
        chordLine: first.chordLine,
      });
    } else {
      setSelectedPresetId(null);
    }
  }, [loopGenre, loopBars, onKeySelection, stopLoopPreview]);

  const selectPreset = useCallback(
    (preset: Se2GuitarLoopPreset) => {
      setSelectedPresetId(preset.id);
      onKeySelection({
        label: preset.label,
        sourceKey: se2GuitarInferLoopSourceKey(preset),
        chordLine: preset.chordLine,
      });
    },
    [onKeySelection],
  );

  const notesForPreset = useCallback(
    (preset: Se2GuitarLoopPreset) => {
      const raw =
        selectedPresetId === preset.id && keyShiftSemis !== 0
          ? se2GuitarTransposeLoopNotes(preset.notes, keyShiftSemis)
          : preset.notes;
      const tiled = se2GuitarTileLoopNotesToPartBars(raw, preset.bars, loopBars, beatsPerBar);
      return se2GuitarHumanizePolyNotes(tiled);
    },
    [beatsPerBar, keyShiftSemis, loopBars, selectedPresetId],
  );

  const gridPreviewNotes = useMemo(() => {
    if (!selectedPreset) return [];
    return notesForPreset(selectedPreset).map((n) => ({
      pitch: n.pitch,
      startBeat: n.startBeat,
      durationBeats: n.durationBeats,
      velocity: n.velocity,
    }));
  }, [notesForPreset, selectedPreset]);

  const gridChordLine = useMemo(() => {
    if (!selectedPreset) return keySelection?.chordLine;
    if (keyShiftSemis !== 0) {
      return se2GuitarTransposeChordLine(selectedPreset.chordLine, keyShiftSemis);
    }
    return selectedPreset.chordLine;
  }, [keySelection?.chordLine, keyShiftSemis, selectedPreset]);

  const insertPreset = useCallback(
    (preset: Se2GuitarLoopPreset) => {
      if (insertDisabled) return;
      const beat = getPlayheadBeat?.() ?? 0;
      const insertBar = Math.max(0, Math.floor(beat / Math.max(1, beatsPerBar)));
      const barStart = insertBar * beatsPerBar;
      const barEnd = barStart + loopBars * beatsPerBar;
      const kept = notes.filter((n) => n.startBeat < barStart || n.startBeat >= barEnd);
      const shifted = notesForPreset(preset);
      const fresh = se2GuitarLoopNotesAtBar({ ...preset, notes: shifted }, insertBar, beatsPerBar).map(
        (n) => ({
          pitch: n.pitch,
          startBeat: n.startBeat,
          durationBeats: n.durationBeats,
          velocity: n.velocity,
        }),
      );
      onApplyNotes([...kept, ...fresh]);
      if (preset.instrumentId && preset.instrumentId !== instrumentId) {
        onInstrumentIdChange(preset.instrumentId);
      }
      setLastInsertedLoopId(preset.id);
    },
    [
      beatsPerBar,
      getPlayheadBeat,
      insertDisabled,
      instrumentId,
      loopBars,
      notes,
      notesForPreset,
      onApplyNotes,
      onInstrumentIdChange,
    ],
  );

  const insertSelected = useCallback(() => {
    if (!selectedPreset) return;
    insertPreset(selectedPreset);
  }, [insertPreset, selectedPreset]);

  const toggleLoopPreview = useCallback(
    (preset: Se2GuitarLoopPreset) => {
      selectPreset(preset);
      if (previewingLoopId === preset.id) {
        stopLoopPreview();
        return;
      }
      if (previewingLoopId) stopLoopPreview();
      void (async () => {
        try {
          const ctx = ensureAudioContext ? await ensureAudioContext() : getAudioContext();
          if (ctx.state === 'suspended') await ctx.resume();
          const dest = getPreviewDestination(ctx);
          const tone = preset.instrumentId ?? instrumentId;
          const shifted = notesForPreset(preset);
          await previewSe2GuitarLoop(ctx, dest, shifted, tone, bpm, transpose);
          setPreviewingLoopId(preset.id);
          if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
          const loopSec = (loopBars * beatsPerBar * 60) / Math.max(40, bpm);
          previewTimerRef.current = setTimeout(() => {
            previewTimerRef.current = null;
            setPreviewingLoopId((id) => (id === preset.id ? null : id));
          }, loopSec * 1000 + 120);
        } catch {
          /* audio not ready */
        }
      })();
    },
    [
      beatsPerBar,
      bpm,
      ensureAudioContext,
      getAudioContext,
      getPreviewDestination,
      instrumentId,
      loopBars,
      notesForPreset,
      previewingLoopId,
      selectPreset,
      stopLoopPreview,
      transpose,
    ],
  );

  return (
    <div
      className="flex flex-col gap-1 rounded border px-1.5 py-1"
      style={{ borderColor: SE2_GUITAR_UI.border, background: SE2_GUITAR_UI.panelBg }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-[7px] font-black uppercase tracking-[0.12em]" style={{ color: ACCENT }}>
          Preset loops
        </span>
        <span className="text-[6px] font-bold uppercase" style={{ color: SE2_GUITAR_UI.textSoft }}>
          · {loopBars} bar · bar {insertBarHint}
          {insertDisabled ? ' · stop transport to export' : ''}
        </span>
        <span
          className="ml-auto rounded px-1 py-0.5 text-[6px] font-black tabular-nums"
          style={{ background: `${genreMeta.accentHex}22`, color: genreMeta.accentHex }}
        >
          {loopPresets.length} {genreMeta.label}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <span className="text-[6px] font-black uppercase tracking-widest" style={{ color: SE2_GUITAR_UI.textSoft }}>
          Genre
        </span>
        {SE2_GUITAR_LOOP_GENRES.map((g) => {
          const active = loopGenre === g.id;
          const count = genreCounts[g.id];
          return (
            <LoopGenreChip
              key={g.id}
              active={active}
              accentHex={g.accentHex}
              disabled={disabled}
              label={`${g.label} (${count})`}
              onClick={() => setLoopGenre(g.id)}
            />
          );
        })}
      </div>

      {!onLoopBarsChange ? (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[6px] font-black uppercase tracking-widest" style={{ color: SE2_GUITAR_UI.textSoft }}>
            Length
          </span>
          {SE2_GUITAR_PART_BAR_OPTIONS.map((bars) => (
            <LoopGenreChip
              key={bars}
              active={loopBars === bars}
              accentHex={genreMeta.accentHex}
              disabled={disabled}
              label={`${bars} bar`}
              onClick={() => setLoopBars(bars)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[6px] font-black uppercase tracking-widest" style={{ color: SE2_GUITAR_UI.textSoft }}>
            Length
          </span>
          {([4, 8] as const).map((bars) => (
            <LoopGenreChip
              key={bars}
              active={loopBars === bars}
              accentHex={genreMeta.accentHex}
              disabled={disabled}
              label={`${bars} bar`}
              onClick={() => onLoopBarsChange?.(bars)}
            />
          ))}
        </div>
      )}

      <Se2GuitarLoopNoteGrid
        notes={gridPreviewNotes}
        loopBars={loopBars >= 8 ? 8 : 4}
        beatsPerBar={beatsPerBar}
        accentHex={genreMeta.accentHex}
        selectionLabel={selectedPreset?.label ?? keySelection?.label}
        chordLine={gridChordLine}
      />

      <Se2GuitarKeyConvertBar
        disabled={disabled}
        selectionLabel={keySelection?.label}
        chordLine={keySelection?.chordLine}
        sourceKey={keySelection?.sourceKey ?? 'C'}
        targetKey={scaleRoot}
        scaleId={scaleId}
        keyShiftSemis={keyShiftSemis}
        onConvertKey={onConvertKey}
        onResetKey={onResetKey}
        onTargetKeyChange={onScaleRootChange}
        onScaleIdChange={onScaleIdChange}
      />

      <div
        ref={barrierRef}
        className="relative rounded border"
        style={{
          borderColor: `${genreMeta.accentHex}44`,
          background: `linear-gradient(180deg, ${SE2_GUITAR_UI.surfaceBg} 0%, ${SE2_GUITAR_UI.shellBg} 100%)`,
          boxShadow: `inset 0 2px 16px ${genreMeta.accentHex}12`,
        }}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-3"
          style={{ background: `linear-gradient(180deg, ${SE2_GUITAR_UI.surfaceBg}ee 0%, transparent 100%)` }}
        />
        <div
          className="flex min-h-[72px] gap-1 overflow-x-auto overscroll-x-contain px-1 py-1"
          style={{ scrollbarWidth: 'thin', scrollSnapType: 'x proximity' }}
        >
          {loopPresets.length === 0 ? (
            <div
              className="flex min-h-[64px] w-full items-center justify-center text-[7px] font-bold uppercase"
              style={{ color: SE2_GUITAR_UI.textSoft }}
            >
              No {loopBars}-bar {genreMeta.label} loops — try another length
            </div>
          ) : (
            loopPresets.map((preset) => {
              const isPreviewing = previewingLoopId === preset.id;
              const isSelected = selectedPresetId === preset.id;
              const isInserted = lastInsertedLoopId === preset.id;
              const active = isSelected;
              const displayLine =
                isSelected && keyShiftSemis !== 0
                  ? se2GuitarTransposeChordLine(preset.chordLine, keyShiftSemis)
                  : preset.chordLine;
              return (
                <div
                  key={preset.id}
                  className="flex shrink-0 items-stretch gap-0.5"
                  style={{ scrollSnapAlign: 'start' }}
                >
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      void toggleLoopPreview(preset);
                    }}
                    title={isPreviewing ? `Stop — ${preset.label}` : `Demo ${preset.label}`}
                    className="flex shrink-0 flex-col items-center justify-center gap-0.5 rounded border px-1 py-1 disabled:opacity-40"
                    style={{
                      borderColor: isPreviewing ? `${genreMeta.accentHex}bb` : SE2_GUITAR_UI.borderSoft,
                      background: isPreviewing ? `${genreMeta.accentHex}28` : SE2_GUITAR_UI.insetBg,
                      color: isPreviewing ? genreMeta.accentHex : SE2_GUITAR_UI.textMuted,
                      minWidth: 34,
                    }}
                  >
                    {isPreviewing ? <Square size={9} fill="currentColor" /> : <Play size={10} />}
                    <span className="text-[5px] font-black uppercase leading-none">
                      {isPreviewing ? 'Stop' : 'Demo'}
                    </span>
                  </button>
                  <LoopPresetCard
                    preset={preset}
                    active={active}
                    accentHex={genreMeta.accentHex}
                    romanLine={displayLine}
                    meta={`${loopBars} bars${loopBars > preset.bars ? ` · ×${Math.ceil(loopBars / preset.bars)}` : ''}`}
                    disabled={disabled}
                    title={`${preset.hint}\nClick to select · Demo to preview`}
                    onClick={() => selectPreset(preset)}
                  />
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={disabled || insertDisabled || !selectedPreset}
          onClick={insertSelected}
          className="rounded border px-3 py-1 text-[8px] font-black uppercase disabled:opacity-40"
          style={{
            borderColor: selectedPreset ? `${genreMeta.accentHex}88` : SE2_GUITAR_UI.borderSoft,
            background: selectedPreset ? `${genreMeta.accentHex}18` : SE2_GUITAR_UI.insetBg,
            color: selectedPreset ? genreMeta.accentHex : SE2_GUITAR_UI.textSoft,
          }}
          title={
            insertDisabled
              ? 'Stop transport to insert on roll'
              : selectedPreset
                ? `Insert ${selectedPreset.label} at bar ${insertBarHint}`
                : 'Select a loop first'
          }
        >
          Insert on roll
        </button>
        {selectedPreset ? (
          <span className="truncate text-[7px] font-bold" style={{ color: SE2_GUITAR_UI.textMuted }}>
            Selected: <span style={{ color: genreMeta.accentHex }}>{selectedPreset.label}</span>
            {lastInsertedLoopId === selectedPreset.id ? (
              <span style={{ color: SE2_GUITAR_UI.textSoft }}> · inserted</span>
            ) : null}
          </span>
        ) : (
          <span className="text-[7px] font-bold" style={{ color: SE2_GUITAR_UI.textSoft }}>
            Click a loop pad to select · Demo to preview
          </span>
        )}
      </div>
    </div>
  );
}
