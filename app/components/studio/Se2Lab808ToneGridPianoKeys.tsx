'use client';

import {
  isLab808BlackKeyMidi,
  lab808TonePadMidi,
  lab808TonePadNoteLabel,
} from '@/app/lib/creationStation/lab808TonePads';

export const SE2_LAB808_TONE_GRID_PIANO_COL_PX = 54;
/** Must match tone step matrix row gap in Se2Lab808DrumGrid (flush grid). */
export const SE2_LAB808_TONE_GRID_ROW_GAP_PX = 0;
/** Nudge keys down so each row centers on its grid lane (step cells include 1px borders). */
export const SE2_LAB808_TONE_GRID_PIANO_LANE_OFFSET_PX = 6;

export type Se2Lab808ToneGridPianoKeysProps = {
  tonePadBaseMidi: number;
  laneCount: number;
  laneHeightPx: number;
  headerHeightPx?: number;
  rowGapPx?: number;
  laneTopOffsetPx?: number;
  pianoColPx?: number;
  disabled?: boolean;
  onPreviewLane: (lane: number) => void;
};

export function Se2Lab808ToneGridPianoKeys({
  tonePadBaseMidi,
  laneCount,
  laneHeightPx,
  headerHeightPx = 0,
  rowGapPx = SE2_LAB808_TONE_GRID_ROW_GAP_PX,
  laneTopOffsetPx = SE2_LAB808_TONE_GRID_PIANO_LANE_OFFSET_PX,
  pianoColPx = SE2_LAB808_TONE_GRID_PIANO_COL_PX,
  disabled = false,
  onPreviewLane,
}: Se2Lab808ToneGridPianoKeysProps) {
  return (
    <div className="shrink-0" style={{ width: pianoColPx }}>
      {headerHeightPx > 0 ? (
        <div aria-hidden style={{ height: headerHeightPx, flexShrink: 0 }} />
      ) : null}
      <div
        className="inline-grid"
        style={{
          width: pianoColPx,
          marginTop: laneTopOffsetPx,
          gridTemplateRows: `repeat(${laneCount}, ${laneHeightPx}px)`,
          rowGap: rowGapPx,
        }}
        aria-label="Tone grid piano keys"
      >
      {Array.from({ length: laneCount }, (_, lane) => {
        const midi = lab808TonePadMidi(tonePadBaseMidi, lane);
        const label = lab808TonePadNoteLabel(midi);
        const black = isLab808BlackKeyMidi(midi);
        return (
          <button
            key={`pk-${tonePadBaseMidi}-${lane}`}
            type="button"
            disabled={disabled}
            title={`${label} — preview`}
            aria-label={`Piano key ${label}`}
            onClick={() => onPreviewLane(lane)}
            className="relative flex items-center justify-center overflow-hidden outline-none touch-manipulation select-none disabled:opacity-40"
            style={{
              boxSizing: 'border-box',
              height: '100%',
              minHeight: laneHeightPx,
              maxHeight: laneHeightPx,
              width: black ? '70%' : '100%',
              marginLeft: black ? '30%' : 0,
              alignSelf: black ? 'flex-end' : 'stretch',
              padding: '0 4px',
              borderRadius: black ? '0 4px 4px 0' : 4,
              border: black ? '1px solid #0a0a0e' : '1px solid #6a6a62',
              background: black
                ? 'linear-gradient(180deg, #3a3a44 0%, #121218 55%, #08080c 100%)'
                : 'linear-gradient(180deg, #fffef8 0%, #e8e8e0 45%, #d4d4cc 100%)',
              boxShadow: black
                ? 'inset 0 1px 0 rgba(255,255,255,0.12), 0 1px 2px rgba(0,0,0,0.5)'
                : 'inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 1px rgba(0,0,0,0.2)',
            }}
          >
            <span
              className="truncate font-black leading-none tabular-nums"
              style={{
                fontSize: black ? 8 : 9,
                color: black ? 'rgba(255,255,255,0.9)' : '#2a2a32',
                letterSpacing: '-0.02em',
              }}
            >
              {label}
            </span>
          </button>
        );
      })}
      </div>
    </div>
  );
}
