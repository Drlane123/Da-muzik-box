'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  cbPianoIsBlackKey,
  cbPianoMidiToNoteName,
} from '@/app/lib/creationStation/chordBuilderPianoRollTheme';
import type { Se2SynthGenoLiveKeyboardKey } from '@/app/lib/studio/se2SynthGenoLiveChordMap';
import {
  SE2_SYNTH_GENO_LIVE_VOICING_HI,
  SE2_SYNTH_GENO_LIVE_VOICING_LO,
} from '@/app/lib/studio/se2SynthGenoLiveChordTypes';
import type { GenoVoicingDepth } from '@/app/lib/studio/se2SynthGenoVoicingDepth';
import type { Se2SynthGenoSlotSubstituteOption } from '@/app/lib/studio/se2SynthGenoSlotSubstitutes';

export type Se2SynthGenoLiveDualKeyboardProps = {
  keys: readonly Se2SynthGenoLiveKeyboardKey[];
  slotEnabled: readonly boolean[];
  /** Voiced MIDI notes for the active chord — one card per note. */
  displayVoicingMidis: readonly number[];
  /** Selected voicing depth — drives card count when preview is empty. */
  voicingDepth?: GenoVoicingDepth;
  accentHex?: string;
  disabled?: boolean;
  onPlaySlot: (slotIndex: number) => void;
  onReleaseSlot: () => void;
  onToggleSlot: (slotIndex: number) => void;
  /** Play order 1…N per slot — dropdown under each trigger. */
  playOrder: readonly number[];
  chordCount: number;
  onPlayOrderChange: (slotIndex: number, position: number) => void;
  /** Drag grip onto another card — copy source chord onto that slot (fixed card count). */
  onReplaceSlot?: (fromSlotIndex: number, toSlotIndex: number) => void;
  /** Per-slot undo after a chord replace on that step. */
  canUndoReplace?: readonly boolean[];
  onUndoReplaceSlot?: (slotIndex: number) => void;
  /** Closest-match chord swaps per slot (3–4 options). */
  slotSubstitutes?: readonly (readonly Se2SynthGenoSlotSubstituteOption[])[];
  onApplySlotSubstitute?: (slotIndex: number, optionId: string) => void;
  /** Lit progression card while loop preview is playing (timeline playhead). */
  playbackSlot?: number | null;
  /** Parent loop preview is running — light voicing cards + spectrum from displayVoicingMidis. */
  loopPreviewActive?: boolean;
  /** Loop preview transport — centered between trigger columns (B01). */
  onTogglePreview?: () => void;
  previewing?: boolean;
  previewDisabled?: boolean;
};

function resolveProgressionVisAt(clientX: number, clientY: number): number | null {
  const el = document.elementFromPoint(clientX, clientY);
  const node = el?.closest('[data-prog-vis]');
  if (!node) return null;
  const raw = node.getAttribute('data-prog-vis');
  if (raw == null) return null;
  const vis = Number(raw);
  return Number.isFinite(vis) ? vis : null;
}

function VoicingNoteTrigger({
  midi,
  accentHex,
  dimmed = false,
}: {
  midi: number | null;
  accentHex: string;
  dimmed?: boolean;
}) {
  const lit = midi != null;
  const noteName = lit ? cbPianoMidiToNoteName(midi).replace(/\d+$/, '') : '·';
  const fullName = lit ? cbPianoMidiToNoteName(midi) : 'Voiced note';
  return (
    <div
      className="flex flex-col items-center justify-end rounded-md border min-w-0 w-full"
      style={{
        borderColor: lit ? accentHex : '#3a3a48',
        background: lit
          ? `linear-gradient(180deg, ${accentHex}cc 0%, ${accentHex}33 100%)`
          : 'linear-gradient(180deg, #1e2430 0%, #0c1018 100%)',
        color: lit ? '#0c0c14' : '#6a7080',
        opacity: dimmed ? 0.45 : lit ? 1 : 0.55,
        padding: '4px 2px 6px',
        height: 72,
      }}
      title={fullName}
    >
      <span className="text-[10px] font-black font-mono leading-none">{noteName}</span>
      {lit ? (
        <span className="mt-0.5 text-[6px] font-mono opacity-80">{cbPianoMidiToNoteName(midi).match(/\d+$/)?.[0] ?? ''}</span>
      ) : (
        <span className="mt-0.5 text-[5px] opacity-25">—</span>
      )}
    </div>
  );
}

const SPECTRUM_BLACK_OFFSET: Record<number, number> = {
  1: 0.68,
  3: 0.68,
  6: 0.4,
  8: 0.52,
  10: 0.62,
};

const BLACK_KEY_ENHARMONIC: Record<number, { sharp: string; flat: string }> = {
  1: { sharp: 'C#', flat: 'Db' },
  3: { sharp: 'D#', flat: 'Eb' },
  6: { sharp: 'F#', flat: 'Gb' },
  8: { sharp: 'G#', flat: 'Ab' },
  10: { sharp: 'A#', flat: 'Bb' },
};

function buildSpectrumKeyRange(low: number, high: number) {
  const whiteKeys: number[] = [];
  const blackKeys: number[] = [];
  for (let m = low; m <= high; m++) {
    if (cbPianoIsBlackKey(m)) blackKeys.push(m);
    else whiteKeys.push(m);
  }
  return { whiteKeys, blackKeys };
}

function spectrumBlackLeftPct(midi: number, whiteKeys: readonly number[]): number {
  const pc = ((midi % 12) + 12) % 12;
  const offset = SPECTRUM_BLACK_OFFSET[pc] ?? 0.55;
  let whiteIdx = 0;
  for (let i = 0; i < whiteKeys.length; i++) {
    if (whiteKeys[i]! < midi) whiteIdx = i;
    else break;
  }
  if (whiteKeys.length <= 1) return 50;
  return ((whiteIdx + offset) / whiteKeys.length) * 100;
}

function whiteKeyLetter(midi: number): string {
  const name = cbPianoMidiToNoteName(midi);
  if (name.startsWith('C') && !name.includes('#')) return name;
  return name.charAt(0);
}

/** C3–B4 — reference-style piano row; lights on chord trigger hold only. */
function CompRegisterSpectrumPiano({
  litMidis,
  accentHex,
}: {
  litMidis: ReadonlySet<number>;
  accentHex: string;
}) {
  const { whiteKeys, blackKeys } = useMemo(
    () => buildSpectrumKeyRange(SE2_SYNTH_GENO_LIVE_VOICING_LO, SE2_SYNTH_GENO_LIVE_VOICING_HI),
    [],
  );

  return (
    <div
      className="w-full overflow-hidden rounded-sm"
      style={{ border: '1px solid #b8bcc4', background: '#d8dce4' }}
    >
      <div className="relative w-full flex flex-row" style={{ height: 58 }}>
        {whiteKeys.map((midi) => {
          const lit = litMidis.has(midi);
          return (
            <div
              key={midi}
              title={lit ? `${cbPianoMidiToNoteName(midi)} · voiced` : cbPianoMidiToNoteName(midi)}
              className="flex flex-col items-center justify-end pointer-events-none select-none"
              style={{
                position: 'relative',
                zIndex: 1,
                flex: '1 1 0',
                minWidth: 0,
                height: '100%',
                borderRight: '1px solid #9aa0aa',
                background: lit
                  ? `linear-gradient(180deg, ${accentHex} 0%, ${accentHex}cc 100%)`
                  : 'linear-gradient(180deg, #f4f5f8 0%, #e4e8ee 100%)',
                boxShadow: lit ? `inset 0 -6px 10px ${accentHex}66` : undefined,
              }}
            >
              <span
                className="font-sans font-black leading-none pb-1"
                style={{
                  fontSize: 11,
                  color: lit ? '#0a0c12' : '#1a1a22',
                }}
              >
                {whiteKeyLetter(midi)}
              </span>
            </div>
          );
        })}
        {blackKeys.map((midi) => {
          const lit = litMidis.has(midi);
          const pc = ((midi % 12) + 12) % 12;
          const labels = BLACK_KEY_ENHARMONIC[pc] ?? { sharp: '#', flat: 'b' };
          return (
            <div
              key={midi}
              title={lit ? `${cbPianoMidiToNoteName(midi)} · voiced` : cbPianoMidiToNoteName(midi)}
              className="flex flex-col items-center justify-between pointer-events-none select-none"
              style={{
                position: 'absolute',
                zIndex: 3,
                top: 0,
                left: `calc(${spectrumBlackLeftPct(midi, whiteKeys)}% - 3.1%)`,
                width: '6.2%',
                maxWidth: 28,
                height: '68%',
                borderRadius: '0 0 3px 3px',
                border: lit ? `1px solid ${accentHex}` : '1px solid #000',
                background: lit
                  ? `linear-gradient(180deg, ${accentHex}ee 0%, #1a1a22 100%)`
                  : 'linear-gradient(180deg, #2a2a30 0%, #000 100%)',
                boxShadow: lit ? `0 0 8px ${accentHex}88` : 'inset 0 -2px 2px #0008',
                padding: '4px 0 3px',
              }}
            >
              <span
                className="font-sans font-bold leading-none"
                style={{ fontSize: 8, color: lit ? '#0a0c12' : '#f0f0f4' }}
              >
                {labels.flat}
              </span>
              <span
                className="font-sans font-bold leading-none"
                style={{ fontSize: 10, color: lit ? '#0a0c12' : '#fff' }}
              >
                {labels.sharp}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Split live keyboard (Rip Chord / Chord Prism style):
 * - Left: progression chord triggers in order — root labels (E, G, D… per preset)
 * - Right: N voiced note cards + full comp-register spectrum (lights on trigger hold)
 */
export function Se2SynthGenoLiveDualKeyboard({
  keys,
  slotEnabled,
  displayVoicingMidis,
  voicingDepth = 4,
  accentHex = '#00E5CC',
  disabled = false,
  onPlaySlot,
  onReleaseSlot,
  onToggleSlot,
  playOrder,
  chordCount,
  onPlayOrderChange,
  onReplaceSlot,
  canUndoReplace,
  onUndoReplaceSlot,
  slotSubstitutes,
  onApplySlotSubstitute,
  playbackSlot = null,
  loopPreviewActive = false,
  onTogglePreview,
  previewing = false,
  previewDisabled = false,
}: Se2SynthGenoLiveDualKeyboardProps) {
  const keyPointerRef = useRef({ down: false, lastSlot: -1 });
  const dragRef = useRef<{
    fromVis: number;
    fromSlot: number;
    altKey: boolean;
    active: boolean;
    x0: number;
    y0: number;
  } | null>(null);
  const [pressedSlot, setPressedSlot] = useState<number | null>(null);
  const [dragOverVis, setDragOverVis] = useState<number | null>(null);
  const dragOverVisRef = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const setDragHover = useCallback((vis: number | null) => {
    dragOverVisRef.current = vis;
    setDragOverVis(vis);
  }, []);

  const voicedMidis = useMemo(
    () => displayVoicingMidis.map((m) => Math.round(m)),
    [displayVoicingMidis],
  );

  const voicingCards = useMemo(
    () => Array.from({ length: voicingDepth }, (_, i) => voicedMidis[i] ?? null),
    [voicedMidis, voicingDepth],
  );

  const showVoicingLights =
    voicedMidis.length > 0
    && (pressedSlot != null || playbackSlot != null || loopPreviewActive);

  const spectrumActiveSet = useMemo(
    () => new Set(showVoicingLights ? voicedMidis : []),
    [showVoicingLights, voicedMidis],
  );

  const activeLitSlot = pressedSlot ?? playbackSlot;

  const progressionKeys = useMemo(
    () =>
      keys
        .filter((k) => k.hasChord)
        .sort((a, b) => (playOrder[a.slotIndex] ?? 0) - (playOrder[b.slotIndex] ?? 0)),
    [keys, playOrder],
  );

  const voicingCardCount = voicingCards.length;

  useEffect(() => {
    const end = () => {
      if (!keyPointerRef.current.down) return;
      keyPointerRef.current.down = false;
      keyPointerRef.current.lastSlot = -1;
      setPressedSlot(null);
      onReleaseSlot();
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, [onReleaseSlot]);

  const tryPlaySlot = useCallback(
    (slotIndex: number) => {
      if (disabled || !slotEnabled[slotIndex]) return;
      keyPointerRef.current.down = true;
      keyPointerRef.current.lastSlot = slotIndex;
      setPressedSlot(slotIndex);
      onPlaySlot(slotIndex);
    },
    [disabled, onPlaySlot, slotEnabled],
  );

  const enterSlot = useCallback(
    (slotIndex: number) => {
      if (disabled || isDragging || !keyPointerRef.current.down || slotIndex < 0) return;
      if (slotIndex === keyPointerRef.current.lastSlot) return;
      tryPlaySlot(slotIndex);
    },
    [disabled, isDragging, tryPlaySlot],
  );

  const dragSessionRef = useRef<{
    pointerId: number;
    fromVis: number;
    fromSlot: number;
    active: boolean;
    x0: number;
    y0: number;
    onMove: (ev: PointerEvent) => void;
    onUp: (ev: PointerEvent) => void;
  } | null>(null);

  const endDragSession = useCallback(() => {
    const session = dragSessionRef.current;
    if (!session) return;
    window.removeEventListener('pointermove', session.onMove);
    window.removeEventListener('pointerup', session.onUp);
    window.removeEventListener('pointercancel', session.onUp);
    dragSessionRef.current = null;
  }, []);

  const finishDrag = useCallback(
    (toVis: number | null) => {
      const drag = dragRef.current;
      dragRef.current = null;
      endDragSession();
      setIsDragging(false);
      setDragHover(null);
      if (!drag?.active || toVis == null || toVis < 0) return;
      const toKey = progressionKeys[toVis];
      if (!toKey || drag.fromSlot === toKey.slotIndex) return;
      onReplaceSlot?.(drag.fromSlot, toKey.slotIndex);
    },
    [endDragSession, onReplaceSlot, progressionKeys, setDragHover],
  );

  const beginSequenceDrag = useCallback(
    (e: ReactPointerEvent, visIndex: number, slotIndex: number) => {
      if (disabled || !onReplaceSlot) return;
      e.stopPropagation();
      e.preventDefault();
      endDragSession();
      dragRef.current = {
        fromVis: visIndex,
        fromSlot: slotIndex,
        altKey: false,
        active: false,
        x0: e.clientX,
        y0: e.clientY,
      };
      const pointerId = e.pointerId;
      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        const drag = dragRef.current;
        if (!drag) return;
        const dx = ev.clientX - drag.x0;
        const dy = ev.clientY - drag.y0;
        if (!drag.active && Math.hypot(dx, dy) > 4) {
          drag.active = true;
          setIsDragging(true);
          keyPointerRef.current.down = false;
          setPressedSlot(null);
          onReleaseSlot();
        }
        if (drag.active) {
          const vis = resolveProgressionVisAt(ev.clientX, ev.clientY);
          if (vis != null) setDragHover(vis);
        }
      };
      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        const drag = dragRef.current;
        if (drag?.active) {
          const vis =
            resolveProgressionVisAt(ev.clientX, ev.clientY)
            ?? dragOverVisRef.current
            ?? drag.fromVis;
          finishDrag(vis);
        } else {
          dragRef.current = null;
          endDragSession();
          setIsDragging(false);
          setDragHover(null);
        }
      };
      dragSessionRef.current = {
        pointerId,
        fromVis: visIndex,
        fromSlot: slotIndex,
        active: false,
        x0: e.clientX,
        y0: e.clientY,
        onMove,
        onUp,
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [disabled, endDragSession, finishDrag, onReleaseSlot, onReplaceSlot, setDragHover],
  );

  useEffect(() => () => endDragSession(), [endDragSession]);

  const litCount = voicedMidis.length;
  const colCount = Math.max(1, progressionKeys.length);

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="text-[7px] font-mono" style={{ color: '#8a8a98' }}>
          {activeLitSlot != null && litCount > 0
            ? loopPreviewActive && playbackSlot != null && pressedSlot == null
              ? `Loop · step ${playOrder[playbackSlot] ?? playbackSlot + 1} · ${litCount} on spectrum`
              : `${litCount} lit on spectrum · ${voicingDepth}-note depth`
            : loopPreviewActive
              ? `${voicingDepth} depth chords · loop preview`
              : `${voicingDepth} depth chords · hold a chord to light spectrum`}
        </span>
      </div>

      <div
        className="grid gap-2 w-full items-start"
        style={{ gridTemplateColumns: onTogglePreview ? '1fr auto 1fr' : '1fr 1fr' }}
      >
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-[6px] font-bold uppercase tracking-widest px-0.5" style={{ color: '#a8a8b8' }}>
            Left · Progression chord triggers
          </span>
          <span className="text-[6px] font-mono px-0.5" style={{ color: '#7a7a88' }}>
            {chordCount} chords · ⋮ drag to copy · Match dropdown for close swaps · ↩ undo
          </span>
          <div
            className="grid gap-1"
            style={{
              gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))`,
              userSelect: 'none',
              touchAction: 'none',
            }}
          >
            {progressionKeys.map((key, visIndex) => {
              const { slotIndex, triggerLabel, roman } = key;
              const enabled = slotEnabled[slotIndex] ?? true;
              const manualLit = enabled && pressedSlot === slotIndex && !isDragging;
              const playbackLit = playbackSlot === slotIndex && pressedSlot == null && !isDragging;
              const lit = manualLit || playbackLit;
              const orderPos = playOrder[slotIndex] ?? slotIndex + 1;
              const dropTarget = isDragging && dragOverVis === visIndex;
              const dragSource = isDragging && dragRef.current?.fromVis === visIndex;

              return (
                <div key={`prog-${slotIndex}-${visIndex}`} className="flex flex-col gap-0.5 min-w-0">
                <div
                  data-prog-vis={visIndex}
                  className="relative flex flex-col rounded-md border min-w-0 w-full overflow-hidden"
                  style={{
                    borderColor: dropTarget
                      ? '#fbbf24'
                      : dragSource
                        ? accentHex
                        : lit
                          ? accentHex
                          : enabled
                            ? '#4a5568'
                            : '#2a2a34',
                    boxShadow: dropTarget
                      ? '0 0 0 1px #fbbf2488'
                      : playbackLit
                        ? `0 0 12px ${accentHex}88, inset 0 0 0 1px ${accentHex}66`
                        : undefined,
                    opacity: enabled ? (dragSource ? 0.55 : 1) : 0.42,
                  }}
                >
                  <div className="flex items-stretch">
                    <button
                      type="button"
                      disabled={disabled || !onReplaceSlot}
                      onPointerDown={(e) => beginSequenceDrag(e, visIndex, slotIndex)}
                      title="Drag onto another card to copy this chord onto that step"
                      className="shrink-0 flex items-center justify-center border-r disabled:opacity-40 cursor-grab active:cursor-grabbing"
                      style={{
                        width: 22,
                        minWidth: 22,
                        borderColor: '#3a3a48',
                        background: isDragging ? '#1a2434' : '#141820',
                        color: '#8a90a0',
                        touchAction: 'none',
                      }}
                    >
                      <span className="text-[10px] leading-none opacity-80 select-none">⋮</span>
                    </button>
                    <button
                      type="button"
                      disabled={disabled || !enabled}
                      onPointerDown={(e) => {
                        if (isDragging) return;
                        e.preventDefault();
                        (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
                        tryPlaySlot(slotIndex);
                      }}
                      onPointerEnter={() => enterSlot(slotIndex)}
                      title={`${triggerLabel} · ${roman}${enabled ? '' : ' (off)'}`}
                      className="flex flex-1 flex-col items-center justify-end disabled:opacity-40 min-w-0"
                      style={{
                        background: lit
                          ? `linear-gradient(180deg, ${accentHex}cc 0%, ${accentHex}33 100%)`
                          : enabled
                            ? 'linear-gradient(180deg, #3a4458 0%, #1a2230 100%)'
                            : 'linear-gradient(180deg, #1a1c24 0%, #1e1e26 100%)',
                        color: lit ? '#0c0c14' : enabled ? '#ececf4' : '#5a5a68',
                        cursor: disabled || !enabled ? 'default' : 'pointer',
                        padding: '3px 1px 5px',
                        height: 72,
                      }}
                    >
                      <span className="text-[9px] font-black font-mono leading-none">{triggerLabel}</span>
                      <span
                        role="button"
                        tabIndex={-1}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          onToggleSlot(slotIndex);
                        }}
                        className="mt-0.5 w-full max-w-full truncate rounded border px-0 text-[4px] font-bold font-mono leading-none cursor-pointer text-center"
                        style={{
                          borderColor: enabled ? `${accentHex}55` : '#3a3a44',
                          color: enabled ? (lit ? '#0c0c14' : accentHex) : '#6a6a78',
                          background: enabled ? `${accentHex}18` : 'transparent',
                        }}
                        title={enabled ? 'Deactivate this trigger' : 'Activate this trigger'}
                      >
                        {roman}
                      </span>
                    </button>
                  </div>
                </div>
                {slotSubstitutes?.[slotIndex]?.length && onApplySlotSubstitute ? (
                  <select
                    value=""
                    disabled={disabled || !enabled}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      e.stopPropagation();
                      const id = e.target.value;
                      if (!id) return;
                      onApplySlotSubstitute(slotIndex, id);
                      e.target.value = '';
                    }}
                    title="Closest chords that fit this step — swap this card"
                    className="w-full rounded border text-[6px] font-bold font-mono py-0.5 disabled:opacity-35 truncate"
                    style={{
                      borderColor: '#3a3a48',
                      background: '#101018',
                      color: enabled ? '#b8c0d0' : '#6a6a78',
                    }}
                  >
                    <option value="">Match · swap chord…</option>
                    {slotSubstitutes[slotIndex]!.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : null}
                <div className="flex gap-0.5 items-stretch">
                <select
                  value={orderPos}
                  disabled={disabled || !enabled}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    e.stopPropagation();
                    onPlayOrderChange(slotIndex, Number(e.target.value));
                  }}
                  title="Play order in the loop — swap step position"
                  className="flex-1 min-w-0 rounded border text-[7px] font-bold font-mono text-center py-0.5 disabled:opacity-35"
                  style={{
                    borderColor: '#3a3a48',
                    background: '#0c0c14',
                    color: enabled ? accentHex : '#6a6a78',
                  }}
                >
                  {Array.from({ length: chordCount }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1}
                    </option>
                  ))}
                </select>
                {canUndoReplace?.[slotIndex] && onUndoReplaceSlot ? (
                  <button
                    type="button"
                    disabled={disabled}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      onUndoReplaceSlot(slotIndex);
                    }}
                    title="Undo last chord replace on this step"
                    className="shrink-0 rounded border px-1 text-[6px] font-bold disabled:opacity-35"
                    style={{
                      borderColor: '#fbbf2455',
                      background: '#fbbf2412',
                      color: '#fbbf24',
                    }}
                  >
                    ↩
                  </button>
                ) : null}
                </div>
                </div>
              );
            })}
          </div>
        </div>

        {onTogglePreview ? (
          <div className="flex flex-col items-center self-stretch px-1 pt-7 min-w-[54px]">
            <button
              type="button"
              disabled={disabled || previewDisabled}
              onClick={onTogglePreview}
              className="rounded-md border px-2 py-1.5 text-[7px] font-black uppercase tracking-wide disabled:opacity-40 whitespace-nowrap"
              style={{
                borderColor: previewing ? '#ef444488' : `${accentHex}66`,
                background: previewing ? '#ef444422' : `${accentHex}14`,
                color: previewing ? '#fca5a5' : accentHex,
                boxShadow: previewing ? '0 0 10px rgba(239,68,68,0.25)' : undefined,
              }}
              title={previewing ? 'Stop loop preview' : 'Preview full loop — lights progression triggers'}
            >
              {previewing ? 'Stop' : 'Preview'}
            </button>
          </div>
        ) : null}

        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-[6px] font-bold uppercase tracking-widest px-0.5 mt-1" style={{ color: '#a8a8b8' }}>
            Right · Voicing depth chords
          </span>
          <span className="text-[6px] font-mono px-0.5" style={{ color: '#7a7a88' }}>
            {voicingDepth} chords · names fill when you hold a chord trigger
          </span>
          <div
            className="grid gap-1"
            style={{
              gridTemplateColumns: `repeat(${Math.max(1, voicingCardCount)}, minmax(0, 1fr))`,
            }}
          >
            {voicingCards.map((midi, i) => (
              <VoicingNoteTrigger
                key={`voicing-card-${i}-${midi ?? 'empty'}`}
                midi={midi}
                accentHex={accentHex}
                dimmed={midi == null && !showVoicingLights}
              />
            ))}
          </div>

          <span className="text-[6px] font-bold uppercase tracking-widest px-0.5 mt-1" style={{ color: '#a8a8b8' }}>
            Comp register spectrum
          </span>
          <span className="text-[6px] font-mono px-0.5" style={{ color: '#7a7a88' }}>
            C3 – {cbPianoMidiToNoteName(SE2_SYNTH_GENO_LIVE_VOICING_HI)} · lights on trigger hold or loop preview
          </span>
          <CompRegisterSpectrumPiano litMidis={spectrumActiveSet} accentHex={accentHex} />
        </div>
      </div>
    </div>
  );
}
