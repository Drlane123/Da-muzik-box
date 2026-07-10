'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  SE2_GUITAR_CHORDS,
  SE2_GUITAR_STRUM_PATTERNS,
  se2GuitarProgressionStrumNotesAtPlayhead,
  type Se2GuitarChordDef,
  type Se2GuitarChordId,
  type Se2GuitarStrumPatternId,
} from '@/app/lib/studio/se2GuitarChords';
import { SE2_GUITAR_PROGRESSIONS, se2GuitarProgressionChordsForBars } from '@/app/lib/studio/se2GuitarProgressions';
import { SE2_GUITAR_PART_BAR_OPTIONS, type Se2GuitarPartBars } from '@/app/lib/studio/se2GuitarPartBars';
import { Se2SynthGenoSelectChip } from '@/app/components/studio/Se2SynthGenoSelectionUi';
import { Se2GuitarKeyConvertBar } from '@/app/components/studio/Se2GuitarKeyConvertBar';
import {
  se2GuitarChordRootName,
  se2GuitarTransposeChordLine,
  se2GuitarTransposeMockNotes,
  type Se2GuitarKeyConvertSelection,
} from '@/app/lib/studio/se2GuitarKeyConvert';
import type { Se2GuitarScaleId } from '@/app/lib/studio/se2GuitarScales';
import type { Se2GuitarMockNote } from '@/app/lib/studio/se2GuitarTrack';
import { SE2_GUITAR_UI } from '@/app/lib/studio/se2GuitarUiTheme';

const ACCENT = SE2_GUITAR_UI.accent;

const OPEN_CHORDS = SE2_GUITAR_CHORDS.filter((c) =>
  ['C', 'Am', 'G', 'F', 'Dm', 'Em', 'D', 'A', 'E', 'Bm'].includes(c.id),
);

const JAZZ_CHORDS = SE2_GUITAR_CHORDS.filter((c) => !OPEN_CHORDS.some((o) => o.id === c.id));

export type Se2GuitarStrummerPanelProps = {
  beatsPerBar: number;
  disabled?: boolean;
  insertDisabled?: boolean;
  getPlayheadBeat?: () => number;
  notes: readonly Se2GuitarMockNote[];
  scaleRoot: string;
  scaleId: Se2GuitarScaleId;
  keyShiftSemis: number;
  keySelection: Se2GuitarKeyConvertSelection | null;
  onKeySelection: (sel: Se2GuitarKeyConvertSelection | null) => void;
  onConvertKey: () => void;
  onResetKey: () => void;
  onScaleRootChange?: (root: string) => void;
  onScaleIdChange?: (scaleId: Se2GuitarScaleId) => void;
  onApplyNotes: (notes: Se2GuitarMockNote[]) => void;
  onPreviewStrum: (notes: readonly Se2GuitarMockNote[]) => void;
  onPreviewChord: (pitches: readonly number[]) => void;
};

export function Se2GuitarStrummerPanel({
  beatsPerBar,
  disabled = false,
  insertDisabled = false,
  getPlayheadBeat,
  notes,
  scaleRoot,
  scaleId,
  keyShiftSemis,
  keySelection,
  onKeySelection,
  onConvertKey,
  onResetKey,
  onScaleRootChange,
  onScaleIdChange,
  onApplyNotes,
  onPreviewStrum,
  onPreviewChord,
}: Se2GuitarStrummerPanelProps) {
  const [chordId, setChordId] = useState<Se2GuitarChordId>('C');
  const [patternId, setPatternId] = useState<Se2GuitarStrumPatternId>('down');
  const [strumBars, setStrumBars] = useState<Se2GuitarPartBars>(4);
  const [activeProgressionId, setActiveProgressionId] = useState<string | null>(null);

  const applyKeyShift = useCallback(
    (batch: Se2GuitarMockNote[]) =>
      keyShiftSemis !== 0 ? se2GuitarTransposeMockNotes(batch, keyShiftSemis) : batch,
    [keyShiftSemis],
  );

  const selectChord = useCallback(
    (id: Se2GuitarChordId) => {
      setActiveProgressionId(null);
      onKeySelection({
        label: id,
        sourceKey: se2GuitarChordRootName(id),
        chordLine: id,
      });
    },
    [onKeySelection],
  );

  const chord = SE2_GUITAR_CHORDS.find((c) => c.id === chordId) ?? SE2_GUITAR_CHORDS[0]!;
  const insertBarHint = Math.max(
    1,
    Math.floor((getPlayheadBeat?.() ?? 0) / Math.max(1, beatsPerBar)) + 1,
  );

  const activeProgression = useMemo(
    () => SE2_GUITAR_PROGRESSIONS.find((p) => p.id === activeProgressionId) ?? null,
    [activeProgressionId],
  );

  const toMockNotes = useCallback(
    (batch: ReturnType<typeof se2GuitarStrumNotesAtBar>) =>
      batch.map((n) => ({
        pitch: n.pitch,
        startBeat: n.startBeat,
        durationBeats: n.durationBeats,
        velocity: n.velocity,
      })),
    [],
  );

  const strumChordIds = useMemo((): Se2GuitarChordId[] => {
    if (activeProgression) {
      return se2GuitarProgressionChordsForBars(activeProgression, strumBars);
    }
    return Array.from({ length: strumBars }, () => chord.id);
  }, [activeProgression, chord.id, strumBars]);

  const buildStrumNotes = useCallback(
    (insertBar: number) =>
      toMockNotes(
        se2GuitarProgressionStrumNotesAtPlayhead(strumChordIds, patternId, insertBar, beatsPerBar),
      ),
    [beatsPerBar, patternId, strumChordIds, toMockNotes],
  );

  const selectProgression = useCallback(
    (prog: (typeof SE2_GUITAR_PROGRESSIONS)[number]) => {
      setActiveProgressionId(prog.id);
      const chords = se2GuitarProgressionChordsForBars(prog, strumBars);
      onKeySelection({
        label: prog.label,
        sourceKey: se2GuitarChordRootName(prog.chords[0]!),
        chordLine: chords.join(' · '),
      });
    },
    [onKeySelection, strumBars],
  );

  const strum = useCallback(
    (insert: boolean) => {
      const previewNotes = buildStrumNotes(0);
      onPreviewStrum(applyKeyShift(previewNotes));
      if (!insert) return;
      if (insertDisabled) return;
      const beat = getPlayheadBeat?.() ?? 0;
      const insertBar = Math.max(0, Math.floor(beat / Math.max(1, beatsPerBar)));
      const fresh = applyKeyShift(buildStrumNotes(insertBar));
      onApplyNotes([...notes, ...fresh]);
    },
    [
      applyKeyShift,
      beatsPerBar,
      buildStrumNotes,
      getPlayheadBeat,
      insertDisabled,
      notes,
      onApplyNotes,
      onPreviewStrum,
    ],
  );

  const chordRow = useCallback(
    (list: readonly Se2GuitarChordDef[], label: string) => (
      <div className="flex flex-col gap-1">
        <span className="text-[7px] font-bold uppercase text-[#7a7060]">{label}</span>
        <div
          className="flex gap-1 overflow-x-auto overscroll-x-contain pb-0.5"
          style={{ scrollbarWidth: 'thin' }}
        >
          {list.map((c) => (
            <Se2SynthGenoSelectChip
              key={c.id}
              active={chordId === c.id}
              accentHex={ACCENT}
              size="xs"
              disabled={disabled}
              label={c.label}
              onClick={() => {
                setChordId(c.id);
                selectChord(c.id);
                onPreviewChord(c.pitches);
              }}
            />
          ))}
        </div>
      </div>
    ),
    [chordId, disabled, onPreviewChord],
  );

  return (
    <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[8px] font-black uppercase tracking-[0.1em]" style={{ color: ACCENT }}>
          Strummer
        </span>
        <span className="text-[7px] font-bold uppercase text-[#6a5848]">
          · bar {insertBarHint} · {strumBars} bars
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <span className="text-[7px] font-bold uppercase" style={{ color: SE2_GUITAR_UI.textSoft }}>
          Length
        </span>
        {SE2_GUITAR_PART_BAR_OPTIONS.map((bars) => (
          <Se2SynthGenoSelectChip
            key={bars}
            active={strumBars === bars}
            accentHex={ACCENT}
            size="xs"
            disabled={disabled}
            label={`${bars} bar`}
            onClick={() => {
              setStrumBars(bars);
              if (activeProgression) {
                const chords = se2GuitarProgressionChordsForBars(activeProgression, bars);
                onKeySelection({
                  label: activeProgression.label,
                  sourceKey: se2GuitarChordRootName(activeProgression.chords[0]!),
                  chordLine: chords.join(' · '),
                });
              }
            }}
          />
        ))}
      </div>

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

      <div className="flex flex-col gap-1 rounded border px-1.5 py-1" style={{ borderColor: SE2_GUITAR_UI.border, background: SE2_GUITAR_UI.insetBg }}>
        <span className="text-[7px] font-black uppercase tracking-wider" style={{ color: SE2_GUITAR_UI.textMuted }}>
          Progressions — click to select
          {insertDisabled ? ' · stop transport to insert' : ''}
        </span>
        <div
          className="flex gap-1 overflow-x-auto overscroll-x-contain pb-0.5"
          style={{ scrollbarWidth: 'thin' }}
        >
          {SE2_GUITAR_PROGRESSIONS.map((prog) => {
            const chords = se2GuitarProgressionChordsForBars(prog, strumBars);
            const line =
              activeProgressionId === prog.id && keyShiftSemis !== 0
                ? se2GuitarTransposeChordLine(chords.join(' · '), keyShiftSemis)
                : chords.join(' · ');
            return (
            <button
              key={prog.id}
              type="button"
              disabled={disabled}
              title={`${prog.hint}\n${line}\nSelect, then Preview strum or Insert on roll`}
              onClick={() => selectProgression(prog)}
              className="shrink-0 rounded border px-2 py-1 text-left disabled:opacity-40"
              style={{
                borderColor: activeProgressionId === prog.id ? `${ACCENT}aa` : SE2_GUITAR_UI.borderSoft,
                background:
                  activeProgressionId === prog.id
                    ? `linear-gradient(165deg, ${ACCENT}28 0%, ${SE2_GUITAR_UI.insetBg} 100%)`
                    : SE2_GUITAR_UI.surfaceBg,
                boxShadow: activeProgressionId === prog.id ? `0 0 10px ${ACCENT}33` : undefined,
                minWidth: 72,
              }}
            >
              <span className="block text-[7px] font-black uppercase" style={{ color: ACCENT }}>
                {prog.label}
              </span>
              <span className="block text-[6px] text-[#8a7860]">{line}</span>
            </button>
          );
          })}
        </div>
      </div>

      {chordRow(OPEN_CHORDS, 'Open chords')}
      {chordRow(JAZZ_CHORDS, 'Pro chords — 7ths · 9ths · sus')}

      <div className="flex flex-col gap-1">
        <span className="text-[7px] font-bold uppercase text-[#7a7060]">Strum pattern</span>
        <div className="flex flex-wrap gap-1">
          {SE2_GUITAR_STRUM_PATTERNS.map((p) => (
            <Se2SynthGenoSelectChip
              key={p.id}
              active={patternId === p.id}
              accentHex="#7CF4C6"
              size="xs"
              disabled={disabled}
              title={p.hint}
              label={p.label}
              onClick={() => setPatternId(p.id)}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={disabled}
          onClick={() => strum(false)}
          className="rounded border px-3 py-1 text-[8px] font-bold uppercase"
          style={{ borderColor: `${ACCENT}55`, background: SE2_GUITAR_UI.surfaceBg, color: ACCENT }}
          title={`Preview ${strumBars} bars${activeProgression ? ` — ${activeProgression.label}` : ''}`}
        >
          Preview strum
        </button>
        <button
          type="button"
          disabled={disabled || insertDisabled}
          onClick={() => strum(true)}
          className="rounded border px-3 py-1 text-[8px] font-bold uppercase disabled:opacity-40"
          style={{ borderColor: '#7cf4c655', background: '#0a1410', color: '#7cf4c6' }}
          title={
            insertDisabled
              ? 'Stop transport to insert on roll'
              : `Insert ${strumBars} bars at bar ${insertBarHint}`
          }
        >
          Insert on roll
        </button>
      </div>
    </div>
  );
}
