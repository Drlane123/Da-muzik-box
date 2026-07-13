/**
 * Beat Lab SYNTH — Chord Builder piano roll (quarter-note grid + piano keys).
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ChordBuilderPianoRoll } from '@/app/components/creation/ChordBuilderPianoRoll';
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import {
  beatLabStepsPerBar,
  snapBeatLabChordNotesToBarDownbeats,
  type BeatLabImportedChordRail,
  type ChordBuilderRollEdits,
} from '@/app/lib/creationStation/chordBuilderBeatLabImport';
import {
  beatLabChordRailToPreviewEvents,
  beatLabLaneNotesToChordRollModel,
  beatLabQuarterColToStepCol,
  beatLabStepColToQuarterCol,
  chordBlockSpansFromBeatLabLaneNotes,
  chordRollEditsToBeatLabLaneNotes,
} from '@/app/lib/creationStation/beatLabChordPianoRollAdapter';
import type { BeatLabMidiNote } from '@/app/lib/creationStation/beatLabMidiRoll';
import {
  BEAT_LAB_MELODIC_LANE_START,
  BEAT_LAB_MIDI_LANES,
} from '@/app/lib/creationStation/beatLabMidiRoll';
import {
  BEAT_LAB_SYNTH_HEADER_H,
  BEAT_LAB_SYNTH_RAIL_W,
} from '@/app/lib/creationStation/beatLabMelodicSynth';
import { beatLabMelodicSlotIndex } from '@/app/lib/creationStation/beatLabMelodicSoundfont';
import {
  BEAT_LAB_MELODIC_DEFAULT_INSTRUMENTS,
  BEAT_LAB_MELODIC_INSTRUMENT_OPTIONS,
} from '@/app/lib/creationStation/beatLabMelodicSoundfont';
import {
  BEAT_LAB_BASS_SYNTH_PRESETS,
  BEAT_LAB_DEFAULT_SYNTH_PRESET_ID,
  beatLabBassSynthPresetById,
} from '@/app/lib/creationStation/beatLabMelodicSynthPresets';
import {
  BEAT_LAB_SYNTH2_PIANO_ROLL_BANK,
  beatLabSynth2PianoInstrumentLabel,
  normalizeBeatLabSynth2PianoInstrument,
} from '@/app/lib/creationStation/beatLabSynthV2PianoBank';
import type { BeatLabEditTool } from '@/app/lib/creationStation/beatLabGridPaint';
import { beatLabToolUsesDrumBrush } from '@/app/lib/creationStation/beatLabGridPaint';
import {
  CB_PIANO_ROWS,
  cbPianoNoteNameToMidi,
  chordRollRowForMidi,
} from '@/app/lib/creationStation/chordBuilderPianoRollTheme';

/** One pitch per pitch-class — avoids duplicate key lights from stacked octaves. */
function dedupeMidisByPitchClass(midis: number[]): number[] {
  const byPc = new Map<number, number>();
  for (const m of midis) {
    const pc = ((Math.round(m) % 12) + 12) % 12;
    const prev = byPc.get(pc);
    if (prev == null || m < prev) byPc.set(pc, Math.round(m));
  }
  return [...byPc.values()].sort((a, b) => a - b);
}

/** MIDI pitches lit on the piano keyboard for one quarter column (chord stack). */
function midisAtQuarterCol(
  col: number,
  previewEvents: ReadonlyArray<{ midi: number; col: number }>,
  edits: ChordBuilderRollEdits,
): number[] {
  const midis: number[] = [];
  const seen = new Set<number>();
  for (const { midi, col: c } of previewEvents) {
    if (c !== col) continue;
    const row = chordRollRowForMidi(midi);
    if (row < 0) continue;
    const key = `${row},${col}`;
    if (edits.removed.has(key)) continue;
    if (seen.has(midi)) continue;
    seen.add(midi);
    midis.push(midi);
  }
  for (const key of edits.added) {
    const [rStr, cStr] = key.split(',');
    if (parseInt(cStr ?? '-1', 10) !== col) continue;
    const row = parseInt(rStr ?? '-1', 10);
    const name = CB_PIANO_ROWS[row];
    if (!name) continue;
    const midi = cbPianoNoteNameToMidi(name);
    if (midi <= 0 || seen.has(midi)) continue;
    seen.add(midi);
    midis.push(midi);
  }
  return dedupeMidisByPitchClass(midis);
}

function litCellKeysAtQuarterCol(
  col: number,
  previewEvents: ReadonlyArray<{ midi: number; col: number }>,
  edits: ChordBuilderRollEdits,
): Array<{ key: string; wasAuto: boolean }> {
  const out: Array<{ key: string; wasAuto: boolean }> = [];
  const seen = new Set<string>();
  for (const { midi, col: c } of previewEvents) {
    if (c !== col) continue;
    const row = chordRollRowForMidi(midi);
    if (row < 0) continue;
    const key = `${row},${col}`;
    if (seen.has(key)) continue;
    if (edits.removed.has(key)) continue;
    seen.add(key);
    out.push({ key, wasAuto: true });
  }
  for (const key of edits.added) {
    const [, cStr] = key.split(',');
    if (parseInt(cStr ?? '-1', 10) !== col) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ key, wasAuto: false });
  }
  return out;
}

export type BeatLabSynthPianoRollProps = {
  notes: BeatLabMidiNote[];
  lane: number;
  patternCols: number;
  beatsPerBar: number;
  colsPerBar: number;
  stepSubdiv: number;
  playheadStepCol: number;
  isPlaying: boolean;
  playheadElRef: React.RefObject<HTMLDivElement | null>;
  /** NEW SYNTH v2 — stable playhead mount; transport WAAPI only (no React playheadCol). */
  playheadMountOnly?: boolean;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
  playingMidis: ReadonlySet<number>;
  onNotesChange: (lane: number, nextLaneNotes: BeatLabMidiNote[]) => void;
  onSeekStepCol: (col: number) => void;
  onPreviewMidi: (lane: number, midi: number) => void;
  /** NEW SYNTH — sustain while key held (Vital-style). */
  onSustainMidi?: (lane: number, midi: number) => void;
  onReleaseMidi?: (lane: number) => void;
  onSelectLane: (lane: number) => void;
  onPreviewLane?: (lane: number) => void;
  channelLabelForLane: (lane: number) => string;
  melodicInstruments: string[];
  melodicSynthPresetIds: string[];
  onMelodicInstrumentChange: (slotIndex: number, instrumentId: string) => void;
  onMelodicSynthPresetChange: (slotIndex: number, presetId: string) => void;
  editTool?: BeatLabEditTool;
  onEditGestureStart?: () => void;
  onEditGestureEnd?: () => void;
  onGridCellFocus?: (stepCol: number) => void;
  /** Flash full chord stack on the piano keys (grid click / audition). */
  onPreviewHarmonyMidis?: (midis: number[]) => void;
  disabled?: boolean;
  /** NEW SYNTH: harmony lane uses piano-roll bank; bass uses panel presets. */
  engineVariant?: 'soundfont' | 'v2';
  /** When v2: only this lane is edited here (chords / piano bank — not bass presets). */
  v2HarmonyLane?: number;
  v2PianoInstrumentId?: string;
  onV2PianoInstrumentChange?: (instrumentId: string) => void;
  /** Optional chord headers imported from Chord Builder (bar-wise harmony rhythm). */
  chordRail?: BeatLabImportedChordRail | null;
};

const EMPTY_TIMELINE = [{ chord: null }] as const;

export function BeatLabSynthPianoRoll({
  notes,
  lane,
  patternCols,
  beatsPerBar,
  colsPerBar,
  stepSubdiv,
  playheadStepCol,
  isPlaying,
  playheadElRef,
  playheadMountOnly = false,
  scrollContainerRef,
  playingMidis,
  onNotesChange,
  onSeekStepCol,
  onPreviewMidi,
  onSustainMidi,
  onReleaseMidi,
  onSelectLane,
  onPreviewLane,
  channelLabelForLane,
  melodicInstruments,
  melodicSynthPresetIds,
  onMelodicInstrumentChange,
  onMelodicSynthPresetChange,
  editTool = 'pointer',
  onEditGestureStart,
  onEditGestureEnd,
  onGridCellFocus,
  disabled = false,
  engineVariant = 'soundfont',
  v2HarmonyLane,
  v2PianoInstrumentId,
  onV2PianoInstrumentChange,
  chordRail = null,
  onPreviewHarmonyMidis,
}: BeatLabSynthPianoRollProps) {
  const isV2 = engineVariant === 'v2';
  const pianoId = normalizeBeatLabSynth2PianoInstrument(v2PianoInstrumentId);
  const subdiv = Math.max(1, Math.round(stepSubdiv));
  const stepColsPerBar = Math.max(1, beatsPerBar * subdiv);
  const totalBars = Math.max(1, Math.ceil(patternCols / stepColsPerBar));
  const totalQuarterCols = totalBars * colsPerBar;

  const snappedLaneNotes = useMemo(() => {
    const spb = beatLabStepsPerBar(subdiv, beatsPerBar, colsPerBar);
    return snapBeatLabChordNotesToBarDownbeats(
      notes.filter((n) => n.lane === lane),
      { stepsPerBar: spb, patternCols: patternCols, preserveMultiBarLen: true },
    );
  }, [notes, lane, subdiv, beatsPerBar, colsPerBar, patternCols]);

  const blockSpans = useMemo(
    () => chordBlockSpansFromBeatLabLaneNotes(snappedLaneNotes, lane, subdiv, beatsPerBar, colsPerBar),
    [snappedLaneNotes, lane, subdiv, beatsPerBar, colsPerBar],
  );

  const { previewEvents, edits: initialEdits } = useMemo(() => {
    const model = beatLabLaneNotesToChordRollModel(
      snappedLaneNotes,
      lane,
      subdiv,
      totalQuarterCols,
      beatsPerBar,
      colsPerBar,
      blockSpans,
    );
    if (model.previewEvents.length > 0 || !chordRail) return model;
    const fromRail = beatLabChordRailToPreviewEvents(chordRail, totalQuarterCols, colsPerBar);
    if (fromRail.length === 0) return model;
    return {
      previewEvents: fromRail,
      edits: { added: new Set<string>(), removed: new Set<string>(), lengths: new Map() },
    };
  }, [snappedLaneNotes, lane, subdiv, totalQuarterCols, beatsPerBar, colsPerBar, blockSpans, chordRail]);

  const [rollEdits, setRollEdits] = useState<ChordBuilderRollEdits>(initialEdits);
  const undoGestureRef = useRef(false);
  const brushPaintRef = useRef<{ on: boolean; lastKey: string } | null>(null);

  const laneNotesSig = useMemo(
    () =>
      notes
        .filter((n) => n.lane === lane)
        .map((n) => `${n.col},${n.pitchSemi ?? 0},${n.len}`)
        .sort()
        .join('|'),
    [notes, lane],
  );

  React.useEffect(() => {
    setRollEdits(initialEdits);
  }, [lane, laneNotesSig, initialEdits]);

  /** Legacy saves without pitchSemi only — do not auto-expand note count (caused chop/split on move). */
  React.useEffect(() => {
    if (disabled) return;
    const laneNotes = notes.filter((n) => n.lane === lane);
    if (laneNotes.length === 0) return;
    if (!laneNotes.some((n) => n.pitchSemi == null)) return;
    const rebuilt = chordRollEditsToBeatLabLaneNotes(
      rollEdits,
      previewEvents,
      lane,
      subdiv,
      patternCols,
      totalQuarterCols,
      beatsPerBar,
      colsPerBar,
      blockSpans,
    );
    if (rebuilt.length === 0) return;
    onNotesChange(lane, rebuilt);
  }, [
    disabled,
    laneNotesSig,
    lane,
    rollEdits,
    previewEvents,
    subdiv,
    patternCols,
    totalQuarterCols,
    beatsPerBar,
    colsPerBar,
    blockSpans,
    onNotesChange,
  ]);

  React.useEffect(() => {
    function onUp() {
      if (!undoGestureRef.current) return;
      undoGestureRef.current = false;
      onEditGestureEnd?.();
    }
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, [onEditGestureEnd]);

  const playheadQuarterCol = beatLabStepColToQuarterCol(playheadStepCol, subdiv, beatsPerBar, colsPerBar);
  /** v2: WAAPI owns playhead — freeze React column. Legacy: hold column while playing. */
  const playheadQuarterColRef = useRef(playheadQuarterCol);
  if (!isPlaying && !playheadMountOnly) playheadQuarterColRef.current = playheadQuarterCol;
  const playheadColForRoll = playheadMountOnly
    ? playheadQuarterColRef.current
    : isPlaying
      ? playheadQuarterColRef.current
      : playheadQuarterCol;
  /** Soft voicing glow only when stopped — during play, transport pulse drives key lights. */
  const chordVoicingMidis = useMemo(() => {
    if (isPlaying || playheadMountOnly) return new Set<number>();
    const midis = midisAtQuarterCol(playheadQuarterCol, previewEvents, rollEdits);
    return new Set(midis);
  }, [isPlaying, playheadQuarterCol, previewEvents, rollEdits]);

  const brushMode = beatLabToolUsesDrumBrush(editTool);
  const eraseMode = editTool === 'erase';

  const beginUndoGesture = useCallback(() => {
    if (!undoGestureRef.current) {
      undoGestureRef.current = true;
      onEditGestureStart?.();
    }
  }, [onEditGestureStart]);

  const commitEdits = useCallback(
    (edits: ChordBuilderRollEdits) => {
      beginUndoGesture();
      setRollEdits(edits);
      const laneNotes = chordRollEditsToBeatLabLaneNotes(
        edits,
        previewEvents,
        lane,
        subdiv,
        patternCols,
        totalQuarterCols,
        beatsPerBar,
        colsPerBar,
        blockSpans,
      );
      onNotesChange(lane, laneNotes);
    },
    [
      beatsPerBar,
      beginUndoGesture,
      blockSpans,
      colsPerBar,
      lane,
      onNotesChange,
      patternCols,
      previewEvents,
      subdiv,
      totalQuarterCols,
    ],
  );

  const focusStepCol = useCallback(
    (qCol: number) => {
      onGridCellFocus?.(beatLabQuarterColToStepCol(qCol, subdiv, beatsPerBar, colsPerBar));
    },
    [beatsPerBar, colsPerBar, onGridCellFocus, subdiv],
  );

  const previewChordAtCol = useCallback(
    (col: number, focusRow?: number) => {
      let midis = midisAtQuarterCol(col, previewEvents, rollEdits);
      if (midis.length === 0 && focusRow != null) {
        const name = CB_PIANO_ROWS[focusRow];
        if (name) {
          const midi = cbPianoNoteNameToMidi(name);
          if (midi > 0) midis = [midi];
        }
      }
      if (midis.length === 0) return;
      if (onPreviewHarmonyMidis) onPreviewHarmonyMidis(midis);
      else for (const midi of midis) onPreviewMidi(lane, midi);
    },
    [lane, onPreviewHarmonyMidis, onPreviewMidi, previewEvents, rollEdits],
  );

  const previewRowMidi = useCallback(
    (row: number, col?: number) => {
      if (col != null) {
        previewChordAtCol(col, row);
        return;
      }
      const name = CB_PIANO_ROWS[row];
      if (!name) return;
      const midi = cbPianoNoteNameToMidi(name);
      if (midi > 0) onPreviewMidi(lane, midi);
    },
    [lane, onPreviewMidi, previewChordAtCol],
  );

  const sustainMidi = useCallback(
    (midi: number) => {
      if (midi <= 0) return;
      if (isV2 && onSustainMidi) onSustainMidi(lane, midi);
      else onPreviewMidi(lane, midi);
    },
    [isV2, lane, onSustainMidi, onPreviewMidi],
  );

  const releaseHeldMidi = useCallback(
    (_midi?: number) => {
      if (isV2 && onReleaseMidi) onReleaseMidi(lane);
    },
    [isV2, lane, onReleaseMidi],
  );

  const applyToggle = useCallback(
    (row: number, col: number, isAuto: boolean, isLit: boolean) => {
      if (disabled) return;
      focusStepCol(col);
      const key = `${row},${col}`;
      const next = {
        added: new Set(rollEdits.added),
        removed: new Set(rollEdits.removed),
        lengths: new Map(rollEdits.lengths),
      };
      let audition = false;
      if (brushMode) {
        if (eraseMode) {
          if (!isLit) return;
          if (isAuto) next.removed.add(key);
          else {
            next.added.delete(key);
            next.lengths.delete(key);
          }
        } else {
          if (isLit) return;
          next.removed.delete(key);
          next.added.add(key);
          audition = true;
        }
      } else if (isAuto) {
        if (next.removed.has(key)) {
          next.removed.delete(key);
          audition = true;
        } else next.removed.add(key);
        next.lengths.delete(key);
      } else if (next.added.has(key)) {
        next.added.delete(key);
        next.lengths.delete(key);
      } else {
        next.removed.delete(key);
        next.added.add(key);
        audition = true;
      }
      commitEdits(next);
      if (audition) previewChordAtCol(col, row);
    },
    [brushMode, commitEdits, disabled, eraseMode, focusStepCol, previewChordAtCol, rollEdits],
  );

  const slot = beatLabMelodicSlotIndex(lane);
  const instrumentId =
    melodicInstruments[slot] ?? BEAT_LAB_MELODIC_DEFAULT_INSTRUMENTS[slot] ?? 'acoustic_grand_piano';
  const synthPresetId = melodicSynthPresetIds[slot] ?? BEAT_LAB_DEFAULT_SYNTH_PRESET_ID;
  const synthPreset = beatLabBassSynthPresetById(synthPresetId);
  const channelLabel = isV2
    ? beatLabSynth2PianoInstrumentLabel(pianoId)
    : channelLabelForLane(lane);
  const melodicLaneCount = BEAT_LAB_MIDI_LANES - BEAT_LAB_MELODIC_LANE_START;
  const railLanes = isV2
    ? [v2HarmonyLane ?? lane]
    : Array.from({ length: melodicLaneCount }, (_, i) => BEAT_LAB_MELODIC_LANE_START + i);

  return (
    <div
      style={{
        display: 'flex',
        flex: 1,
        flexDirection: 'row',
        minHeight: 0,
        overflow: 'hidden',
        background: '#050508',
      }}
    >
      <div
        style={{
          width: BEAT_LAB_SYNTH_RAIL_W,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid #1e1e24',
          background: '#18181e',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            height: BEAT_LAB_SYNTH_HEADER_H,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            paddingBottom: 4,
            fontSize: 7,
            fontWeight: 800,
            color: '#5a5a68',
            borderBottom: '1px solid #303030',
          }}
        >
          CH
        </div>
        {railLanes.map((chLane) => {
          const selected = chLane === lane;
          const label = isV2
            ? beatLabSynth2PianoInstrumentLabel(pianoId)
            : channelLabelForLane(chLane);
          const noteCount = notes.filter((n) => n.lane === chLane).length;
          return (
            <button
              key={chLane}
              type="button"
              disabled={disabled}
              onClick={() => {
                onSelectLane(chLane);
                if (!isV2) onPreviewLane?.(chLane);
                else onPreviewMidi(chLane, cbPianoNoteNameToMidi('C4') || 60);
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                gap: 2,
                padding: '6px 6px',
                border: 'none',
                borderBottom: '1px solid #141418',
                background: selected ? 'rgba(124, 244, 198, 0.12)' : '#0a0a0e',
                borderLeft: selected ? '3px solid #7cf4c6' : '3px solid transparent',
                cursor: disabled ? 'default' : 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 9, fontWeight: 900, color: selected ? '#7cf4c6' : '#c8d0e0' }}>
                CH {chLane + 1}
              </span>
              <span
                style={{
                  fontSize: 7,
                  color: '#6a7080',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </span>
              {noteCount > 0 ? (
                <span style={{ fontSize: 6, color: '#5a6a78', fontWeight: 700 }}>{noteCount} notes</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 8px',
            borderBottom: '1px solid #1e1e24',
            background: '#0a0a10',
          }}
        >
          <span style={{ fontSize: 9, fontWeight: 900, color: isV2 ? '#58c4ff' : '#7cf4c6' }}>
            {isV2 ? 'Chords' : `CH ${lane + 1}`}
          </span>
          <span style={{ fontSize: 8, color: '#6a7080', fontWeight: 700 }}>
            {isV2 ? `CH ${lane + 1} · ${channelLabel}` : channelLabel}
          </span>
          {!isV2 ? (
            <select
              disabled={disabled}
              value={instrumentId}
              onChange={(e) => onMelodicInstrumentChange(slot, e.target.value)}
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 9,
                fontWeight: 700,
                padding: '3px 6px',
                borderRadius: 4,
                border: '1px solid #2a2a34',
                background: '#101014',
                color: '#e8e8f0',
              }}
            >
              {BEAT_LAB_MELODIC_INSTRUMENT_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : onV2PianoInstrumentChange ? (
            <select
              disabled={disabled}
              value={pianoId}
              onChange={(e) => onV2PianoInstrumentChange(e.target.value)}
              style={{
                flex: 1,
                minWidth: 120,
                fontSize: 9,
                fontWeight: 700,
                padding: '3px 6px',
                borderRadius: 4,
                border: '1px solid rgba(147,197,253,0.45)',
                background: '#101014',
                color: '#bfdbfe',
              }}
              title="Piano-roll sound bank (keys, organ, strings…)"
            >
              {BEAT_LAB_SYNTH2_PIANO_ROLL_BANK.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.group} · {o.label}
                </option>
              ))}
            </select>
          ) : null}
          {!isV2 ? (
            <select
              disabled={disabled}
              value={synthPresetId}
              onChange={(e) => onMelodicSynthPresetChange(slot, e.target.value)}
              style={{
                width: 170,
                minWidth: 120,
                fontSize: 9,
                fontWeight: 700,
                padding: '3px 6px',
                borderRadius: 4,
                border: '1px solid #2a2a34',
                background: '#101014',
                color: '#e8e8f0',
              }}
              title="Bass synth preset"
            >
              {BEAT_LAB_BASS_SYNTH_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.category})
                </option>
              ))}
            </select>
          ) : null}
          <span style={{ fontSize: 7, color: '#5a6a78', fontWeight: 700 }}>
            {isV2
              ? 'Chord progression only — bass presets are in the panel above'
              : `GM Synth · Bass: ${synthPreset.name}`}
          </span>
        </div>

        <ChordBuilderPianoRoll
          layout="beat-lab-synth"
          timeline={chordRail?.timeline ?? [...EMPTY_TIMELINE]}
          previewEvents={previewEvents}
          totalBars={totalBars}
          colsPerBar={colsPerBar}
          keyRoot={chordRail?.keyRoot ?? 0}
          mode={(chordRail?.mode ?? 'major') as ChordMode}
          playheadCol={playheadColForRoll}
          dragTargetBar={null}
          playingMidis={playingMidis}
          chordVoicingMidis={chordVoicingMidis}
          manualAdded={rollEdits.added}
          manualRemoved={rollEdits.removed}
          noteLengths={rollEdits.lengths}
          blockSpans={blockSpans}
          onPlayPitch={sustainMidi}
        onReleasePitch={releaseHeldMidi}
        onPlayheadChange={(qCol) => {
          focusStepCol(qCol);
          onSeekStepCol(beatLabQuarterColToStepCol(qCol, subdiv, beatsPerBar, colsPerBar));
        }}
        onCellPointer={
          brushMode
            ? (row, col, isAuto, isLit) => {
                const key = `${row},${col}`;
                if (brushPaintRef.current?.on && brushPaintRef.current.lastKey === key) return;
                if (brushPaintRef.current?.on) brushPaintRef.current.lastKey = key;
                applyToggle(row, col, isAuto, isLit);
              }
            : undefined
        }
        onBrushStrokeStart={
          brushMode
            ? () => {
                brushPaintRef.current = { on: true, lastKey: '' };
                beginUndoGesture();
              }
            : undefined
        }
        onBrushStrokeEnd={brushMode ? () => { brushPaintRef.current = null; } : undefined}
        onAuditionCell={brushMode ? (row, col) => previewChordAtCol(col, row) : undefined}
        onToggleNote={(row, col, isAuto, isLit) => {
          if (brushMode) return;
          applyToggle(row, col, isAuto, Boolean(isLit));
        }}
          onMoveNote={(fromRow, fromCol, toRow, toCol) => {
            if (disabled) return;
            const dCol = toCol - fromCol;
            const dRow = toRow - fromRow;
            if (dCol === 0 && dRow === 0) return;
            const next = {
              added: new Set(rollEdits.added),
              removed: new Set(rollEdits.removed),
              lengths: new Map(rollEdits.lengths),
            };
            const stack = litCellKeysAtQuarterCol(fromCol, previewEvents, rollEdits);
            const fromKey = `${fromRow},${fromCol}`;
            const targets =
              stack.length > 0
                ? stack
                : [{ key: fromKey, wasAuto: !rollEdits.added.has(fromKey) }];
            for (const { key, wasAuto } of targets) {
              const [rStr, cStr] = key.split(',');
              const r = parseInt(rStr ?? '-1', 10);
              const c = parseInt(cStr ?? '-1', 10);
              if (r < 0 || c < 0) continue;
              const toKey = `${r + dRow},${c + dCol}`;
              const len = next.lengths.get(key);
              if (wasAuto) {
                next.removed.add(key);
                next.added.add(toKey);
              } else {
                next.added.delete(key);
                next.added.add(toKey);
              }
              next.lengths.delete(key);
              if (len != null) next.lengths.set(toKey, len);
            }
            commitEdits(next);
            previewChordAtCol(toCol, toRow);
          }}
          onResizeNote={(row, col, len) => {
            if (disabled) return;
            const key = `${row},${col}`;
            const barIdx = Math.floor(col / colsPerBar);
            const maxLen = (barIdx + 1) * colsPerBar - col;
            const next = {
              added: new Set(rollEdits.added),
              removed: new Set(rollEdits.removed),
              lengths: new Map(rollEdits.lengths),
            };
            if (!next.added.has(key)) next.added.add(key);
            next.lengths.set(key, Math.max(1, Math.min(len, maxLen)));
            commitEdits(next);
          }}
          barSelRange={null}
          onBarHeaderPointer={() => {}}
          onBarDrop={() => {}}
          onBarDragOver={() => {}}
          onBarDragLeave={() => {}}
        onClearEdits={() => {
          if (disabled) return;
          beginUndoGesture();
          onNotesChange(lane, []);
          setRollEdits({ added: new Set(), removed: new Set(), lengths: new Map() });
        }}
        hasEdits={
          notes.some((n) => n.lane === lane) ||
          rollEdits.added.size > 0 ||
          rollEdits.removed.size > 0
        }
          sizeMode="normal"
          onSizeModeChange={() => {}}
        isPlaying={playheadMountOnly ? false : isPlaying}
        playheadElRef={playheadElRef}
        playheadVariant={playheadMountOnly ? 'groove-mount' : 'default'}
        scrollContainerRef={scrollContainerRef}
        headerTitle="SYNTH PIANO ROLL"
          headerHint="same grid as Chord Builder · click / drag ruler = playhead · click cell = note · drag = move · drag right edge = length"
        />
      </div>
    </div>
  );
}
