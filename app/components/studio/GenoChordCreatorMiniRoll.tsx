'use client';

import { Play, SkipBack, Square } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GrooveProgressionStep } from '@/app/lib/creationStation/grooveLabProgressionBuilder';
import { GROOVE_LAB_QUANTIZE_DEFAULT, GROOVE_LAB_SLOTS_PER_BAR } from '@/app/lib/creationStation/grooveLabRoll';
import { progressionStepsToGrooveHits } from '@/app/lib/creationStation/grooveLabProgressionBuilder';
import { useGenoLoopRollPreview } from '@/app/hooks/useGenoLoopRollPreview';
import { useGenoLoopRollSe2Sync } from '@/app/hooks/useGenoLoopRollSe2Sync';
import { Se2ChordGenieSe2SyncButton } from '@/app/components/studio/Se2ChordGenieSe2SyncButton';
import {
  Se2SynthGenoLoopChordPianoRoll,
  type Se2SynthGenoLoopChordPianoRollEditState,
  type Se2SynthGenoLoopChordPianoRollHandle,
} from '@/app/components/studio/Se2SynthGenoLoopChordPianoRoll';
import { Se2SynthGenoLoopPianoRollEditToolbar, type Se2GenoLoopGridTool } from '@/app/components/studio/Se2SynthGenoLoopPianoRollEditToolbar';
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';
import { SE2_GENO_CHORD_CREATOR_ACCENT } from '@/app/lib/studio/se2ChordGenieTrack';
import { se2BarDisplayLabelsPerBar } from '@/app/lib/studio/se2ChordGeneratorPassingRhythm';
import type { StudioHarmonyLoopBars } from '@/app/lib/studio/studioInstrumentHarmony';
import { genoLoopPianoRollNotesFromDraft } from '@/app/lib/studio/se2SynthGenoLoopPianoRoll';
import {
  se2ApplyAllBarChops,
  se2DefaultBarChopQuants,
  se2ResizeBarChopQuants,
  type GenoBarChopQuant,
} from '@/app/lib/studio/se2ChordGenieBarChop';

const CHORD_ROLL_MIN_MIDI = 48;
const CHORD_ROLL_MAX_MIDI = 76;

export type GenoChordCreatorMiniRollProps = {
  steps: readonly GrooveProgressionStep[];
  loopBars: StudioHarmonyLoopBars;
  beatsPerBar: number;
  bpm: number;
  getAudioContext?: () => AudioContext | null;
  audioOn?: boolean;
  transportPlaying?: boolean;
  se2SyncEnabled?: boolean;
  onSe2SyncToggle?: () => void;
  getSe2TransportBeat?: () => number;
  genreId?: string;
  accentHex?: string;
  disabled?: boolean;
  gridMaxHeightPx?: number;
  passingBarIndex?: number;
  onPassingBarIndexChange?: (barIndex: number) => void;
  onPassingChordApply?: () => void;
  onPassingChordRegenerate?: () => void;
  passingApplyDisabled?: boolean;
  passingRegenerateDisabled?: boolean;
  onExportMidiToTrack?: (notes: StudioEditor2GenNote[], loopBars: StudioHarmonyLoopBars) => void;
  onClearProgression?: () => void;
  onPreviewMidi?: (midi: number) => void;
  /** Stop sketch / panel audition when the sequencer preview starts. */
  onPreviewStart?: () => void;
  /** Parent generator panel scrolls the full grid (no inner scrollbar). */
  scrollWithParent?: boolean;
};

function grooveHitsToRollNotes(
  hits: readonly { slot: number; sustainSlots: number; midi: number; vel: number }[],
  beatsPerBar: number,
): StudioEditor2GenNote[] {
  const slotsPerBar = GROOVE_LAB_SLOTS_PER_BAR;
  return hits.map((h) => {
    const durationBeats = Math.max(0.25, (h.sustainSlots / slotsPerBar) * beatsPerBar);
    return {
      pitch: h.midi,
      startBeat: (h.slot / slotsPerBar) * beatsPerBar,
      durationBeats: Math.min(durationBeats * 0.92, durationBeats),
      velocity: h.vel <= 1 ? Math.max(1, Math.round(h.vel * 127)) : Math.max(1, Math.min(127, Math.round(h.vel))),
    };
  });
}

function stepsToGenNotes(
  steps: readonly GrooveProgressionStep[],
  loopBars: StudioHarmonyLoopBars,
  beatsPerBar: number,
): StudioEditor2GenNote[] {
  if (steps.length === 0) return [];
  const bpb = Math.max(1, beatsPerBar);
  const built = progressionStepsToGrooveHits(steps, {
    quantize: GROOVE_LAB_QUANTIZE_DEFAULT,
    barCount: loopBars,
    sustainSlots: 4,
    beatsPerBar: bpb,
  });
  if ('message' in built) return [];
  return grooveHitsToRollNotes(built.chordHits, bpb);
}

export function GenoChordCreatorMiniRoll({
  steps,
  loopBars,
  beatsPerBar,
  bpm,
  getAudioContext,
  audioOn = true,
  transportPlaying = false,
  se2SyncEnabled = false,
  onSe2SyncToggle,
  getSe2TransportBeat,
  genreId,
  accentHex = SE2_GENO_CHORD_CREATOR_ACCENT,
  disabled = false,
  gridMaxHeightPx = 300,
  passingBarIndex = 0,
  onPassingBarIndexChange,
  onPassingChordApply,
  onPassingChordRegenerate,
  passingApplyDisabled = false,
  passingRegenerateDisabled = false,
  onExportMidiToTrack,
  onClearProgression,
  onPreviewMidi,
  onPreviewStart,
  scrollWithParent = false,
}: GenoChordCreatorMiniRollProps) {
  const pianoRollRef = useRef<Se2SynthGenoLoopChordPianoRollHandle>(null);
  const [gridTool, setGridTool] = useState<Se2GenoLoopGridTool>('select');
  const [rollEdit, setRollEdit] = useState<Se2SynthGenoLoopChordPianoRollEditState>({
    hasSelection: false,
    canUndo: false,
  });
  const handleEditStateChange = useCallback((state: Se2SynthGenoLoopChordPianoRollEditState) => {
    setRollEdit((prev) =>
      prev.hasSelection === state.hasSelection && prev.canUndo === state.canUndo ? prev : state,
    );
  }, []);

  const {
    playheadBeat,
    setPlayheadBeat: setRawPlayheadBeat,
    playing: rollPreviewPlaying,
    play: playRollPreview,
    stop: stopRollPreview,
  } = useGenoLoopRollPreview({
    getAudioContext,
    bpm,
    beatsPerBar,
    barCount: loopBars,
    genreId,
    loop: true,
  });

  const derivedNotes = useMemo(
    () => stepsToGenNotes(steps, loopBars, beatsPerBar),
    [steps, loopBars, beatsPerBar],
  );
  const [barChopQuants, setBarChopQuants] = useState<GenoBarChopQuant[]>(() =>
    se2DefaultBarChopQuants(loopBars),
  );
  const [rollNotes, setRollNotes] = useState<StudioEditor2GenNote[]>(() =>
    se2ApplyAllBarChops(derivedNotes, se2DefaultBarChopQuants(loopBars), beatsPerBar, loopBars),
  );

  useEffect(() => {
    setBarChopQuants((prev) => se2ResizeBarChopQuants(prev, loopBars));
  }, [loopBars]);

  useEffect(() => {
    setRollNotes(se2ApplyAllBarChops(derivedNotes, barChopQuants, beatsPerBar, loopBars));
  }, [derivedNotes, barChopQuants, beatsPerBar, loopBars]);

  const handleBarChopQuantChange = useCallback(
    (bar: number, chopQuant: GenoBarChopQuant) => {
      setBarChopQuants((prev) => {
        const next = se2ResizeBarChopQuants(prev, loopBars);
        next[bar] = chopQuant;
        return next;
      });
    },
    [loopBars],
  );

  const rollPreviewNotes = useMemo(
    () => genoLoopPianoRollNotesFromDraft(rollNotes),
    [rollNotes],
  );

  const onSe2PlayheadBeat = useCallback(
    (beat: number) => {
      setRawPlayheadBeat(beat);
    },
    [setRawPlayheadBeat],
  );

  useGenoLoopRollSe2Sync({
    enabled: se2SyncEnabled,
    transportPlaying,
    audioOn,
    getSe2TransportBeat,
    getAudioContext,
    notes: rollPreviewNotes,
    bpm,
    beatsPerBar,
    barCount: loopBars,
    genreId,
    onPlayheadBeat: onSe2PlayheadBeat,
  });

  useEffect(() => {
    if (transportPlaying && !se2SyncEnabled) stopRollPreview();
  }, [se2SyncEnabled, stopRollPreview, transportPlaying]);

  const setPlayheadBeat = useCallback(
    (beat: number) => {
      stopRollPreview();
      setRawPlayheadBeat(beat);
    },
    [setRawPlayheadBeat, stopRollPreview],
  );

  const handlePlay = useCallback(() => {
    if (!audioOn || disabled || rollNotes.length === 0) return;
    if (se2SyncEnabled || transportPlaying) return;
    onPreviewStart?.();
    playRollPreview(rollPreviewNotes, playheadBeat);
  }, [
    audioOn,
    disabled,
    onPreviewStart,
    playRollPreview,
    playheadBeat,
    rollNotes.length,
    rollPreviewNotes,
    se2SyncEnabled,
    transportPlaying,
  ]);

  const handleStop = useCallback(() => {
    stopRollPreview();
  }, [stopRollPreview]);

  const handleRewindToStart = useCallback(() => {
    setPlayheadBeat(0);
  }, [setPlayheadBeat]);

  const previewBlocked =
    !audioOn || disabled || se2SyncEnabled || (transportPlaying && !se2SyncEnabled);
  const canPreview = rollNotes.length > 0 && !previewBlocked;
  const canScrubPlayhead = !disabled && !se2SyncEnabled;

  const barChordLabels = useMemo(
    () => se2BarDisplayLabelsPerBar(steps, loopBars, beatsPerBar),
    [steps, loopBars, beatsPerBar],
  );

  const keyboardRange = useMemo(() => {
    if (rollNotes.length === 0) {
      return { minMidi: CHORD_ROLL_MIN_MIDI, maxMidi: CHORD_ROLL_MAX_MIDI };
    }
    const lo = Math.min(...rollNotes.map((n) => n.pitch));
    const hi = Math.max(...rollNotes.map((n) => n.pitch));
    return {
      minMidi: Math.max(36, Math.min(CHORD_ROLL_MIN_MIDI, lo - 3)),
      maxMidi: Math.min(96, Math.max(CHORD_ROLL_MAX_MIDI, hi + 3)),
    };
  }, [rollNotes]);

  const showPassing = Boolean(onPassingBarIndexChange && onPassingChordApply);
  const toolbarH = 28;
  const passingActionBtnH = 20;

  const handleExportMidiToTrack = useCallback(() => {
    if (rollNotes.length === 0 || typeof onExportMidiToTrack !== 'function') return;
    const notes = rollNotes.map((n) => ({
      pitch: Math.max(0, Math.min(127, Math.round(n.pitch))),
      startBeat: Math.max(0, n.startBeat),
      durationBeats: Math.max(0.25, n.durationBeats),
      velocity: Math.max(1, Math.min(127, Math.round(n.velocity))),
    }));
    onExportMidiToTrack(notes, loopBars);
  }, [loopBars, onExportMidiToTrack, rollNotes]);

  return (
    <div className="w-full min-w-0">
      <div
        className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-2"
        style={{ background: 'transparent' }}
      >
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <button
            type="button"
            disabled={disabled || se2SyncEnabled}
            onClick={handleRewindToStart}
            className="inline-flex items-center justify-center rounded border disabled:opacity-40"
            style={{
              width: toolbarH,
              height: toolbarH,
              borderColor: 'rgba(77,168,255,0.35)',
              background: '#080c14',
              color: accentHex,
            }}
            title={
              se2SyncEnabled
                ? 'Use SE2 RTZ when synced to transport'
                : 'Rewind playhead to bar 1'
            }
          >
            <SkipBack size={12} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            disabled={!canPreview}
            onClick={handlePlay}
            className="inline-flex items-center justify-center rounded border disabled:opacity-40"
            style={{
              width: toolbarH,
              height: toolbarH,
              borderColor: rollPreviewPlaying ? `${accentHex}` : 'rgba(77,168,255,0.35)',
              background: rollPreviewPlaying ? `${accentHex}33` : '#080c14',
              color: rollPreviewPlaying ? '#fff' : accentHex,
            }}
            title={
              se2SyncEnabled
                ? 'Use SE2 Play — local preview disabled while synced'
                : previewBlocked
                  ? 'Enable audio to preview'
                  : 'Play chord roll from playhead'
            }
          >
            <Play size={12} fill="currentColor" />
          </button>
          <button
            type="button"
            disabled={!rollPreviewPlaying}
            onClick={handleStop}
            className="inline-flex items-center justify-center rounded border disabled:opacity-40"
            style={{
              width: toolbarH,
              height: toolbarH,
              borderColor: 'rgba(255,255,255,0.22)',
              background: '#080c14',
              color: '#e8e8ec',
            }}
            title="Stop local preview"
          >
            <Square size={10} fill="currentColor" />
          </button>
          {onSe2SyncToggle ? (
            <Se2ChordGenieSe2SyncButton
              enabled={se2SyncEnabled}
              disabled={disabled}
              accentHex="#7cf4c6"
              onToggle={onSe2SyncToggle}
            />
          ) : null}
          <span
            className="text-[8px] font-black uppercase tracking-[0.14em] whitespace-nowrap"
            style={{ color: accentHex }}
          >
            Chord sequencer · {loopBars} bars
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 min-w-0 ml-auto">
          <span className="text-[8px] font-semibold uppercase tracking-wide text-[#6a8098] whitespace-nowrap shrink-0">
            {rollNotes.length > 0 ? `${rollNotes.length} notes` : 'Pick a chord on the wheel'}
          </span>
          <Se2SynthGenoLoopPianoRollEditToolbar
            accentHex={accentHex}
            disabled={disabled}
            hasSelection={rollEdit.hasSelection}
            canUndo={rollEdit.canUndo}
            hasNotes={rollNotes.length > 0}
            gridTool={gridTool}
            onGridToolChange={setGridTool}
            onErase={() => pianoRollRef.current?.deleteSelected()}
            onDuplicate={() => pianoRollRef.current?.duplicateSelected()}
            onCut={() => pianoRollRef.current?.cutSelected()}
            onUndo={() => pianoRollRef.current?.undo()}
            onClear={() => {
              pianoRollRef.current?.clearAll();
              onClearProgression?.();
            }}
          />
        </div>
      </div>

      {showPassing ? (
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 pb-2 border-t"
          style={{ borderColor: 'rgba(77,168,255,0.12)' }}
        >
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: loopBars }, (_, i) => {
              const sel = passingBarIndex === i;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={disabled}
                  onClick={() => onPassingBarIndexChange?.(i)}
                  className="rounded border text-[8px] font-black tabular-nums disabled:opacity-40"
                  style={{
                    width: toolbarH,
                    height: toolbarH,
                    lineHeight: `${toolbarH - 2}px`,
                    borderColor: sel ? '#4DA8FF' : 'rgba(77,168,255,0.22)',
                    background: sel ? 'rgba(77,168,255,0.22)' : '#080c14',
                    color: sel ? '#d0e8ff' : '#9ab0c0',
                  }}
                  title={`Bar ${i + 1}`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={disabled || passingApplyDisabled}
            onClick={onPassingChordApply}
            className="inline-flex items-center justify-center rounded border px-2 text-[7px] font-black uppercase tracking-wide whitespace-nowrap disabled:opacity-40"
            style={{
              height: passingActionBtnH,
              borderColor: 'rgba(77,168,255,0.5)',
              background: 'rgba(77,168,255,0.14)',
              color: '#8ec8ff',
            }}
            title="Add passing chord on final beat of selected bar"
          >
            Passing chords
          </button>
          {onPassingChordRegenerate ? (
            <button
              type="button"
              disabled={disabled || passingRegenerateDisabled}
              onClick={onPassingChordRegenerate}
              className="inline-flex items-center justify-center rounded border px-2 text-[7px] font-black uppercase tracking-wide whitespace-nowrap disabled:opacity-40"
              style={{
                height: passingActionBtnH,
                borderColor: 'rgba(124,244,198,0.45)',
                background: 'rgba(124,244,198,0.1)',
                color: '#7cf4c6',
              }}
              title="Try another passing chord for the selected bar"
            >
              Regenerate
            </button>
          ) : null}
          {typeof onExportMidiToTrack === 'function' ? (
            <button
              type="button"
              disabled={disabled || rollNotes.length === 0}
              onClick={handleExportMidiToTrack}
              className="inline-flex items-center justify-center rounded border px-2 text-[7px] font-black uppercase tracking-wide whitespace-nowrap disabled:opacity-40"
              style={{
                height: passingActionBtnH,
                borderColor: 'rgba(255,200,120,0.45)',
                background: 'rgba(255,180,90,0.1)',
                color: '#ffd4a0',
              }}
              title="Send chord MIDI from this sequencer to the Chord Generator track lane"
            >
              Export MIDI
            </button>
          ) : null}
        </div>
      ) : null}
      <Se2SynthGenoLoopChordPianoRoll
        ref={pianoRollRef}
        notes={rollNotes}
        barCount={loopBars}
        beatsPerBar={beatsPerBar}
        accentHex={accentHex}
        minMidi={keyboardRange.minMidi}
        maxMidi={keyboardRange.maxMidi}
        previewBeat={playheadBeat}
        onPreviewBeatChange={canScrubPlayhead ? setPlayheadBeat : undefined}
        playheadScrub={canScrubPlayhead}
        disabled={disabled}
        onNotesChange={setRollNotes}
        onEditStateChange={handleEditStateChange}
        onPianoKeyPreview={onPreviewMidi}
        barChordLabels={barChordLabels}
        barChopQuants={barChopQuants}
        onBarChopQuantChange={handleBarChopQuantChange}
        tailFocusBar={showPassing ? passingBarIndex : null}
        onTailFocusBar={showPassing ? onPassingBarIndexChange : undefined}
        gridEditTool={gridTool === 'draw' ? 'draw' : undefined}
        gridMaxHeightPx={scrollWithParent ? undefined : gridMaxHeightPx}
        scrollGridWithParent={scrollWithParent}
        sixteenthGrid
      />
    </div>
  );
}
