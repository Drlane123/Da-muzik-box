/**
 * MIDI SYNTH view — channel rail (17–32) + vertical piano keys + pitch×time roll.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { BeatLabSnapGridOverlay } from './BeatLabSnapGridOverlay';
import { CreationSe2PlayheadMark } from './CreationSe2PlayheadMark';
import { CREATION_SE2_PLAYHEAD_LINE_W_PX } from '@/app/lib/creationStation/creationPlaylineWapi';
import {
  BEAT_LAB_MELODIC_DEFAULT_INSTRUMENTS,
  BEAT_LAB_MELODIC_INSTRUMENT_OPTIONS,
  beatLabMelodicSlotIndex,
} from '../../lib/creationStation/beatLabMelodicSoundfont';
import {
  BEAT_LAB_MELODIC_LANE_START,
  BEAT_LAB_MIDI_LANES,
  type BeatLabMidiNote,
} from '../../lib/creationStation/beatLabMidiRoll';
import {
  BEAT_LAB_SYNTH_HEADER_H,
  BEAT_LAB_SYNTH_KEY_W,
  BEAT_LAB_SYNTH_RAIL_W,
  BEAT_LAB_SYNTH_ROW_H,
  BEAT_LAB_SYNTH_RULER_H,
  BEAT_LAB_SYNTH_SEMITONES,
  beatLabNoteAtCell,
  beatLabNoteMidi,
  beatLabNoteSpansCell,
  beatLabSynthIsBlackKey,
  beatLabSynthKeyLabel,
  beatLabSynthMidiForRow,
  beatLabSynthRowForMidi,
  beatLabSynthRowGridBg,
  beatLabSynthRowKeyBg,
} from '../../lib/creationStation/beatLabMelodicSynth';
import type { BeatLabEditTool } from '../../lib/creationStation/beatLabGridPaint';
import {
  beatLabMeasureRulerLabel,
  creationBeatLabColumnBorder,
} from '../../lib/creationStation/creationDrumGridAdaptive';

export type BeatLabMelodicSynthViewProps = {
  patternCols: number;
  colWidth: number;
  notes: BeatLabMidiNote[];
  selectedLane: number;
  onSelectLane: (lane: number) => void;
  activeCol: number;
  transportNotStopped: boolean;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
  playheadElRef: React.RefObject<HTMLDivElement | null>;
  onSeekCol: (col: number) => void;
  editTool: BeatLabEditTool;
  disabled?: boolean;
  melodicInstruments: string[];
  onMelodicInstrumentChange: (slotIndex: number, instrumentId: string) => void;
  channelLabelForLane: (lane: number) => string;
  onToggleNoteAt: (lane: number, col: number, midi: number) => void;
  onSetNoteAt: (lane: number, col: number, midi: number, on: boolean) => void;
  onPreviewMidi: (lane: number, midi: number) => void;
  gridSnap?: { qpb: number; subdiv: number; bankColOffset: number };
};

function rollToolCursor(tool: BeatLabEditTool): string {
  if (tool === 'draw' || tool === 'erase') return 'crosshair';
  if (tool === 'pointer') return 'default';
  return 'crosshair';
}

export function BeatLabMelodicSynthView({
  patternCols,
  colWidth,
  notes,
  selectedLane,
  onSelectLane,
  activeCol,
  transportNotStopped,
  scrollRef,
  onScroll,
  playheadElRef,
  onSeekCol,
  editTool,
  disabled = false,
  melodicInstruments,
  onMelodicInstrumentChange,
  channelLabelForLane,
  onToggleNoteAt,
  onSetNoteAt,
  onPreviewMidi,
  gridSnap,
}: BeatLabMelodicSynthViewProps) {
  const cw = Math.max(8, colWidth);
  const gridW = patternCols * cw;
  const bodyH = BEAT_LAB_SYNTH_SEMITONES * BEAT_LAB_SYNTH_ROW_H;
  const snapQpb = gridSnap?.qpb ?? 4;
  const snapSub = gridSnap?.subdiv ?? 4;
  const snapOff = gridSnap?.bankColOffset ?? 0;

  const laneNotes = useMemo(
    () => notes.filter((n) => n.lane === selectedLane),
    [notes, selectedLane],
  );

  const paintRef = useRef<{ active: boolean; on: boolean; lastKey: string } | null>(null);
  const [dragTarget, setDragTarget] = useState<{ col: number; midi: number } | null>(null);

  const brushMode = editTool === 'draw' || editTool === 'erase';
  const eraseMode = editTool === 'erase';
  const pointerMode = editTool === 'pointer';
  const cellCursor = rollToolCursor(editTool);

  const slot = beatLabMelodicSlotIndex(selectedLane);
  const instrumentId =
    melodicInstruments[slot] ?? BEAT_LAB_MELODIC_DEFAULT_INSTRUMENTS[slot] ?? 'acoustic_grand_piano';

  const columnBorder = useCallback(
    (col: number) =>
      creationBeatLabColumnBorder({
        colWidthPx: cw,
        patternCol: col,
        bankColOffset: snapOff,
        qpb: snapQpb,
        subdiv: snapSub,
      }),
    [cw, snapOff, snapQpb, snapSub],
  );

  const colsPerBar = Math.max(1, snapQpb * snapSub);

  const paintCell = useCallback(
    (col: number, midi: number, on: boolean) => {
      const key = `${col},${midi}`;
      if (paintRef.current?.active && paintRef.current.lastKey === key) return;
      if (paintRef.current?.active) paintRef.current.lastKey = key;
      if (eraseMode) onSetNoteAt(selectedLane, col, midi, false);
      else onSetNoteAt(selectedLane, col, midi, on);
    },
    [eraseMode, onSetNoteAt, selectedLane],
  );

  const handleGridPointer = useCallback(
    (col: number, midi: number) => {
      if (disabled) return;
      if (brushMode) {
        paintRef.current = { active: true, on: !eraseMode, lastKey: '' };
        paintCell(col, midi, !eraseMode);
        return;
      }
      if (pointerMode) {
        const existing = beatLabNoteAtCell(notes, selectedLane, col, midi);
        if (existing) onToggleNoteAt(selectedLane, col, midi);
        else onSetNoteAt(selectedLane, col, midi, true);
        return;
      }
      onToggleNoteAt(selectedLane, col, midi);
    },
    [
      brushMode,
      disabled,
      notes,
      onSetNoteAt,
      onToggleNoteAt,
      paintCell,
      pointerMode,
      selectedLane,
    ],
  );

  const noteBlocks = useMemo(() => {
    const blocks: { col: number; row: number; len: number; muted: boolean }[] = [];
    for (const n of laneNotes) {
      const midi = beatLabNoteMidi(selectedLane, n);
      const row = beatLabSynthRowForMidi(selectedLane, midi);
      if (row < 0 || row >= BEAT_LAB_SYNTH_SEMITONES) continue;
      blocks.push({ col: n.col, row, len: n.len, muted: n.muted === true });
    }
    return blocks;
  }, [laneNotes, selectedLane]);

  return (
    <div
      style={{
        display: 'flex',
        flex: '1 1 auto',
        minHeight: 0,
        overflow: 'hidden',
        background: '#050508',
        borderTop: '1px solid #1a1a1e',
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
        {Array.from({ length: BEAT_LAB_MIDI_LANES - BEAT_LAB_MELODIC_LANE_START }, (_, i) => {
          const lane = BEAT_LAB_MELODIC_LANE_START + i;
          const selected = lane === selectedLane;
          const label = channelLabelForLane(lane);
          return (
            <button
              key={lane}
              type="button"
              disabled={disabled}
              onClick={() => onSelectLane(lane)}
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
                CH {lane + 1}
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
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
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
          <span style={{ fontSize: 9, fontWeight: 900, color: '#7cf4c6' }}>CH {selectedLane + 1}</span>
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
          <span style={{ fontSize: 7, color: '#5a6a78', fontWeight: 700 }}>GM Synth</span>
        </div>

        <div
          ref={scrollRef}
          onScroll={onScroll}
          style={{ flex: 1, minHeight: 0, overflow: 'auto', position: 'relative' }}
          onPointerUp={() => {
            paintRef.current = null;
          }}
          onPointerLeave={() => {
            paintRef.current = null;
          }}
        >
          <div
            style={{
              position: 'relative',
              width: BEAT_LAB_SYNTH_KEY_W + gridW,
              minHeight: BEAT_LAB_SYNTH_HEADER_H + bodyH,
            }}
          >
            <div
              ref={playheadElRef}
              aria-hidden
              style={{
                position: 'absolute',
                left: BEAT_LAB_SYNTH_KEY_W,
                top: 0,
                width: CREATION_SE2_PLAYHEAD_LINE_W_PX,
                height: BEAT_LAB_SYNTH_HEADER_H + bodyH,
                pointerEvents: 'none',
                zIndex: 40,
                opacity: transportNotStopped ? 1 : 0.45,
              }}
            >
              <CreationSe2PlayheadMark variant="piano" height="100%" />
            </div>

            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                zIndex: 22,
                width: BEAT_LAB_SYNTH_KEY_W,
                height: BEAT_LAB_SYNTH_HEADER_H,
                background: '#0a0a0e',
                borderRight: '1px solid #2a2a36',
                borderBottom: '1px solid #303030',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                paddingBottom: 3,
                fontSize: 7,
                fontWeight: 800,
                color: '#5a5a68',
              }}
            >
              KEY
            </div>

            <div
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 20,
                marginLeft: BEAT_LAB_SYNTH_KEY_W,
                height: BEAT_LAB_SYNTH_RULER_H,
                display: 'flex',
                background: '#2c2c2c',
                borderBottom: '1px solid #303030',
              }}
            >
              {Array.from({ length: patternCols }, (_, col) => {
                const lit = col === activeCol && transportNotStopped;
                const isBarStart = (col + snapOff) % colsPerBar === 0;
                const measureLabel = gridSnap
                  ? beatLabMeasureRulerLabel(col, snapOff, snapSub, snapQpb)
                  : isBarStart
                    ? String(Math.floor((col + snapOff) / colsPerBar) + 1)
                    : '';
                return (
                  <button
                    key={`ruler-${col}`}
                    type="button"
                    disabled={disabled}
                    onClick={() => onSeekCol(col)}
                    title="Seek playhead"
                    style={{
                      width: cw,
                      minWidth: cw,
                      height: BEAT_LAB_SYNTH_RULER_H,
                      padding: 0,
                      border: 'none',
                      borderLeft: `1px solid ${columnBorder(col)}`,
                      background: lit
                        ? 'rgba(124, 244, 198, 0.18)'
                        : isBarStart
                          ? '#101018'
                          : '#2c2c2c',
                      color: lit ? '#7cf4c6' : '#4a4a58',
                      fontSize: 7,
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      cursor: disabled ? 'default' : 'pointer',
                      boxSizing: 'border-box',
                    }}
                  >
                    {measureLabel}
                  </button>
                );
              })}
            </div>

            <div
              style={{
                position: 'absolute',
                left: 0,
                top: BEAT_LAB_SYNTH_HEADER_H,
                width: BEAT_LAB_SYNTH_KEY_W,
                height: bodyH,
                zIndex: 15,
                background: '#0a0a0e',
                borderRight: '1px solid #2a2a36',
              }}
            >
              {Array.from({ length: BEAT_LAB_SYNTH_SEMITONES }, (_, row) => {
                const midi = beatLabSynthMidiForRow(selectedLane, row);
                const black = beatLabSynthIsBlackKey(midi);
                const isC = midi % 12 === 0;
                return (
                  <button
                    key={row}
                    type="button"
                    disabled={disabled}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      if (!disabled) onPreviewMidi(selectedLane, midi);
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      height: BEAT_LAB_SYNTH_ROW_H,
                      padding: '0 4px 0 0',
                      border: 'none',
                      borderBottom: '1px solid #2a3040',
                      background: beatLabSynthRowKeyBg(midi, row),
                      color: black ? '#9aa0b8' : '#1a1a24',
                      fontSize: 7,
                      fontWeight: isC ? 800 : 600,
                      textAlign: 'right',
                      cursor: disabled ? 'default' : 'pointer',
                      lineHeight: `${BEAT_LAB_SYNTH_ROW_H}px`,
                    }}
                    title={beatLabSynthKeyLabel(midi)}
                  >
                    {isC ? beatLabSynthKeyLabel(midi) : ''}
                  </button>
                );
              })}
            </div>

            {gridSnap ? (
              <BeatLabSnapGridOverlay
                colWidthPx={cw}
                qpb={snapQpb}
                subdiv={snapSub}
                bankColOffset={snapOff}
                style={{
                  left: BEAT_LAB_SYNTH_KEY_W,
                  top: BEAT_LAB_SYNTH_HEADER_H,
                  width: gridW,
                  height: bodyH,
                  zIndex: 0,
                }}
              />
            ) : null}

            <div
              style={{
                position: 'absolute',
                left: BEAT_LAB_SYNTH_KEY_W,
                top: BEAT_LAB_SYNTH_HEADER_H,
                width: gridW,
                height: bodyH,
                zIndex: 1,
                touchAction: 'none',
                userSelect: 'none',
              }}
            >
              {Array.from({ length: BEAT_LAB_SYNTH_SEMITONES }, (_, row) => {
                const midi = beatLabSynthMidiForRow(selectedLane, row);
                const rowBg = beatLabSynthRowGridBg(midi, row);
                return (
                  <div
                    key={row}
                    style={{
                      display: 'flex',
                      height: BEAT_LAB_SYNTH_ROW_H,
                      background: rowBg,
                      borderBottom: '1px solid #252a3a',
                    }}
                  >
                    {Array.from({ length: patternCols }, (_, col) => {
                      const hit = beatLabNoteAtCell(notes, selectedLane, col, midi);
                      const spanNote = beatLabNoteSpansCell(notes, selectedLane, col, midi);
                      const showBlockOnly = Boolean(spanNote && spanNote.len > 1);
                      const isDrag = dragTarget?.col === col && dragTarget?.midi === midi;
                      return (
                        <button
                          key={col}
                          type="button"
                          disabled={disabled}
                          onPointerDown={(e) => {
                            if (disabled || e.button !== 0) return;
                            e.preventDefault();
                            e.stopPropagation();
                            (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
                            handleGridPointer(col, midi);
                          }}
                          onPointerUp={(e) => {
                            try {
                              (e.currentTarget as HTMLButtonElement).releasePointerCapture(e.pointerId);
                            } catch {
                              /* already released */
                            }
                            paintRef.current = null;
                          }}
                          onPointerEnter={() => {
                            if (!brushMode || !paintRef.current?.active) return;
                            paintCell(col, midi, paintRef.current.on);
                            setDragTarget({ col, midi });
                          }}
                          onPointerLeave={() => {
                            if (dragTarget?.col === col && dragTarget?.midi === midi) {
                              setDragTarget(null);
                            }
                          }}
                          style={{
                            width: cw,
                            minWidth: cw,
                            height: BEAT_LAB_SYNTH_ROW_H,
                            padding: 0,
                            border: 'none',
                            borderLeft: `1px solid ${columnBorder(col)}`,
                            background:
                              showBlockOnly
                                ? rowBg
                                : hit
                                  ? hit.muted
                                    ? 'rgba(90, 90, 110, 0.65)'
                                    : 'linear-gradient(180deg, #7cf4c6 0%, #34d399 100%)'
                                  : isDrag
                                    ? 'rgba(124, 244, 198, 0.28)'
                                    : rowBg,
                            cursor: disabled ? 'default' : cellCursor,
                            boxSizing: 'border-box',
                          }}
                        />
                      );
                    })}
                  </div>
                );
              })}

              {noteBlocks.map((b, i) => (
                <div
                  key={`nb-${i}-${b.col}-${b.row}`}
                  style={{
                    position: 'absolute',
                    left: b.col * cw + 1,
                    top: b.row * BEAT_LAB_SYNTH_ROW_H + 2,
                    width: Math.max(cw - 2, b.len * cw - 2),
                    height: BEAT_LAB_SYNTH_ROW_H - 4,
                    borderRadius: 2,
                    background: b.muted
                      ? 'rgba(80,80,100,0.6)'
                      : 'linear-gradient(180deg, rgba(124,244,198,0.95), rgba(52,211,153,0.9))',
                    border: '1px solid rgba(255,255,255,0.25)',
                    pointerEvents: 'none',
                    zIndex: 5,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
