'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Lock, Play, Square, Unlock } from 'lucide-react';
import { useBeatPadsSpreadRollPreview } from '@/app/hooks/useBeatPadsSpreadRollPreview';
import { cbPianoMidiToNoteName } from '@/app/lib/creationStation/chordBuilderPianoRollTheme';
import type { BeatPadsSpreadDirection } from '@/app/lib/creationStation/beatPadsHitSpread';
import { BEAT_PADS_PAD_SPREAD_BADGE_STYLE } from '@/app/lib/creationStation/beatPadsPadSpreadInstructions';
import {
  BEAT_PADS_SPREAD_MIXER_CH,
  BEAT_PADS_SPREAD_MIXER_CH_MAX,
  BEAT_PADS_SPREAD_MIXER_CH_MIN,
  BEAT_PADS_SPREAD_LOOP_BAR_CHOICES,
  BEAT_PADS_SPREAD_ROW_COUNT,
  beatPadsSpreadAddNote,
  beatPadsSpreadNoteAtColumn,
  beatPadsSpreadRemoveAtColumn,
  beatPadsSpreadPatternCols,
  beatPadsSpreadRollPopoverWidth,
  beatPadsSpreadRollVisibleBars,
  beatPadsSpreadRowLabel,
  beatPadsSpreadRowMidi,
  clampBeatPadsSpreadLoopBars,
  beatPadsSpreadHarmonyLaneOptions,
  beatPadsSpreadHarmonyLaneLabel,
  clampBeatPadsSpreadMixerChannel,
  type BeatPadsSpreadLoopBars,
  type BeatPadsSpreadNote,
} from '@/app/lib/creationStation/beatPadsSpreadTrack';
import { beatLabSynth2ClampLane } from '@/app/lib/creationStation/beatLabSynthV2LaneRoles';
import {
  BEAT_PADS_STEPS_PER_BAR,
  beatPadsStepsPerQuarter,
  type BeatPadsGridStepsPerBar,
} from '@/app/lib/creationStation/beatLabDrumMachineSequencer';

const MINT = '#7cf4c6';
const VIOLET = '#c4b5fd';
const LANE_W = 102;
const ROW_H = 22;
const COL_W = 16;
const HEADER_H = 34;
const SURFACE = '#0a0c10';
const MAX_VISIBLE_ROWS = 10;
const MAX_GRID_H = MAX_VISIBLE_ROWS * ROW_H;

const toolBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  height: 26,
  padding: '0 8px',
  borderRadius: 5,
  border: '1px solid rgba(255, 255, 255, 0.2)',
  background: '#12121a',
  color: '#c8d0dc',
  fontSize: 9,
  fontWeight: 800,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

type EditTool = 'draw' | 'erase';

function gridLineStyle(col: number, stepsPerBar: BeatPadsGridStepsPerBar): { color: string; width: number } {
  const subdiv = beatPadsStepsPerQuarter(stepsPerBar);
  if (col % stepsPerBar === 0) return { color: 'rgba(255, 255, 255, 0.58)', width: 3 };
  if (col % subdiv === 0) return { color: 'rgba(255, 255, 255, 0.34)', width: 2 };
  return { color: 'rgba(255, 255, 255, 0.2)', width: 1 };
}

const ROW_LINE = '1px solid rgba(255, 255, 255, 0.22)';

function stepOnFill(): string {
  return 'linear-gradient(180deg, #b8f5c5 0%, #7cf4c6 55%, #34d399 100%)';
}

export type BeatPadsSpreadPianoRollProps = {
  baseLabel: string;
  rootMidi: number;
  direction: BeatPadsSpreadDirection;
  notes: BeatPadsSpreadNote[];
  loopBars: BeatPadsSpreadLoopBars;
  mixerChannel?: number;
  stepsPerBar?: BeatPadsGridStepsPerBar;
  onNotesChange: (notes: BeatPadsSpreadNote[]) => void;
  onLoopBarsChange: (bars: BeatPadsSpreadLoopBars) => void;
  onDirectionChange: (direction: BeatPadsSpreadDirection) => void;
  onMixerChannelChange?: (ch: number) => void;
  keyLockEnabled?: boolean;
  keyLabel?: string;
  onKeyLockChange?: (enabled: boolean) => void;
  harmonyLane?: number;
  harmonyLaneNotes?: readonly import('@/app/lib/creationStation/beatLabMidiRoll').BeatLabMidiNote[];
  onHarmonyLaneChange?: (lane: number) => void;
  /** SE2 spread roll — match to studio MIDI tracks (T01–T16). */
  se2MatchTrackOptions?: readonly { trackIndex: number; label: string }[];
  harmonyTrackIndex?: number;
  onHarmonyTrackIndexChange?: (trackIndex: number) => void;
  onRegenerateChordRoots?: () => void;
  onPreviewRow?: (row: number, gridCol?: number) => void;
  /** Scheduled strike — spread roll loop preview at session BPM. */
  onStrikeSpreadRow?: (row: number, col: number, whenSec: number) => void;
  sessionBpm?: number;
  onWarmAudio?: () => void | Promise<void>;
  getAudioContext?: () => AudioContext | null;
  onClose?: () => void;
  disabled?: boolean;
  /** SE2 — export spread roll to any MIDI or audio lane. */
  midiExportTrackOptions?: readonly { trackIndex: number; label: string }[];
  wavExportTrackOptions?: readonly { trackIndex: number; label: string }[];
  defaultMidiExportTrackIndex?: number;
  defaultWavExportTrackIndex?: number;
  onExportSpreadMidi?: (targetTrackIndex: number) => void | Promise<void>;
  onExportSpreadWav?: (targetTrackIndex: number) => void | Promise<void>;
  exportStatus?: string | null;
};

export function BeatPadsSpreadPianoRoll({
  baseLabel,
  rootMidi,
  direction,
  notes,
  loopBars,
  mixerChannel = BEAT_PADS_SPREAD_MIXER_CH,
  stepsPerBar = BEAT_PADS_STEPS_PER_BAR,
  onNotesChange,
  onLoopBarsChange,
  onDirectionChange,
  onMixerChannelChange,
  keyLockEnabled = false,
  keyLabel = 'key',
  onKeyLockChange,
  harmonyLane = 17,
  harmonyLaneNotes = [],
  onHarmonyLaneChange,
  se2MatchTrackOptions,
  harmonyTrackIndex,
  onHarmonyTrackIndexChange,
  onRegenerateChordRoots,
  onPreviewRow,
  onStrikeSpreadRow,
  sessionBpm = 120,
  onWarmAudio,
  getAudioContext,
  onClose,
  disabled = false,
  midiExportTrackOptions,
  wavExportTrackOptions,
  defaultMidiExportTrackIndex = 0,
  defaultWavExportTrackIndex = 0,
  onExportSpreadMidi,
  onExportSpreadWav,
  exportStatus = null,
}: BeatPadsSpreadPianoRollProps) {
  const [editTool, setEditTool] = useState<EditTool>('draw');
  const [midiExportTargetIndex, setMidiExportTargetIndex] = useState(defaultMidiExportTrackIndex);
  const [wavExportTargetIndex, setWavExportTargetIndex] = useState(defaultWavExportTrackIndex);
  const brushRef = useRef<{ row: number } | null>(null);
  const gridScrollRef = useRef<HTMLDivElement>(null);
  const laneScrollRef = useRef<HTMLDivElement>(null);
  const cols = beatPadsSpreadPatternCols(loopBars, stepsPerBar);
  const barCount = clampBeatPadsSpreadLoopBars(loopBars);
  const visibleBars = beatPadsSpreadRollVisibleBars(loopBars);
  const gridW = cols * COL_W;
  const popoverW = beatPadsSpreadRollPopoverWidth(loopBars, stepsPerBar);
  const visibleGridW = visibleBars * stepsPerBar * COL_W;
  const scrollGrid = barCount > visibleBars;
  const ch = clampBeatPadsSpreadMixerChannel(mixerChannel);
  const matchLane = beatLabSynth2ClampLane(harmonyLane);
  const useSe2Match =
    (se2MatchTrackOptions?.length ?? 0) > 0 && typeof onHarmonyTrackIndexChange === 'function';
  const resolvedSe2MatchIndex = useMemo(() => {
    if (!se2MatchTrackOptions?.length) return 0;
    if (
      harmonyTrackIndex != null &&
      se2MatchTrackOptions.some((o) => o.trackIndex === harmonyTrackIndex)
    ) {
      return harmonyTrackIndex;
    }
    return se2MatchTrackOptions[0]!.trackIndex;
  }, [harmonyTrackIndex, se2MatchTrackOptions]);
  const se2MatchLabel =
    se2MatchTrackOptions?.find((o) => o.trackIndex === resolvedSe2MatchIndex)?.label ?? 'Track';
  const harmonyLaneOpts = useMemo(
    () => beatPadsSpreadHarmonyLaneOptions(harmonyLaneNotes),
    [harmonyLaneNotes],
  );
  const matchLabel = useSe2Match
    ? se2MatchLabel
    : beatPadsSpreadHarmonyLaneLabel(
        matchLane,
        harmonyLaneOpts.find((o) => o.lane === matchLane)?.noteCount,
      );

  const spreadPreview = useBeatPadsSpreadRollPreview({
    bpm: sessionBpm,
    loopBars,
    stepsPerBar,
    notes,
    onStrikeRow: onStrikeSpreadRow,
    onWarmAudio,
    getAudioContext,
  });

  const showSpreadExport =
    (typeof onExportSpreadMidi === 'function' && (midiExportTrackOptions?.length ?? 0) > 0) ||
    (typeof onExportSpreadWav === 'function' && (wavExportTrackOptions?.length ?? 0) > 0);

  useEffect(() => {
    if (!midiExportTrackOptions?.length) return;
    const valid = midiExportTrackOptions.some((o) => o.trackIndex === midiExportTargetIndex);
    if (!valid) {
      setMidiExportTargetIndex(
        midiExportTrackOptions.find((o) => o.trackIndex === defaultMidiExportTrackIndex)?.trackIndex
          ?? midiExportTrackOptions[0]!.trackIndex,
      );
    }
  }, [defaultMidiExportTrackIndex, midiExportTargetIndex, midiExportTrackOptions]);

  useEffect(() => {
    if (!wavExportTrackOptions?.length) return;
    const valid = wavExportTrackOptions.some((o) => o.trackIndex === wavExportTargetIndex);
    if (!valid) {
      setWavExportTargetIndex(
        wavExportTrackOptions.find((o) => o.trackIndex === defaultWavExportTrackIndex)?.trackIndex
          ?? wavExportTrackOptions[0]!.trackIndex,
      );
    }
  }, [defaultWavExportTrackIndex, wavExportTargetIndex, wavExportTrackOptions]);

  useEffect(() => {
    if (!useSe2Match || !onHarmonyTrackIndexChange || !se2MatchTrackOptions?.length) return;
    if (
      harmonyTrackIndex != null &&
      se2MatchTrackOptions.some((o) => o.trackIndex === harmonyTrackIndex)
    ) {
      return;
    }
    onHarmonyTrackIndexChange(resolvedSe2MatchIndex);
  }, [
    useSe2Match,
    harmonyTrackIndex,
    se2MatchTrackOptions,
    onHarmonyTrackIndexChange,
    resolvedSe2MatchIndex,
  ]);

  const rowLabels = useMemo(
    () =>
      Array.from({ length: BEAT_PADS_SPREAD_ROW_COUNT }, (_, row) =>
        beatPadsSpreadRowLabel(baseLabel, row, rootMidi, direction),
      ),
    [baseLabel, rootMidi, direction],
  );

  const applyToggle = useCallback(
    (row: number, col: number) => {
      if (disabled) return;
      if (editTool === 'erase') {
        if (beatPadsSpreadNoteAtColumn(notes, col)) {
          onNotesChange(beatPadsSpreadRemoveAtColumn(notes, col));
        }
        return;
      }
      if (beatPadsSpreadNoteAtColumn(notes, col)) return;
      onNotesChange(beatPadsSpreadAddNote(notes, row, col, 1, cols));
      onPreviewRow?.(row, col);
    },
    [cols, disabled, editTool, notes, onNotesChange, onPreviewRow],
  );

  const cellFromEvent = useCallback(
    (clientX: number, clientY: number, gridEl: HTMLElement): { row: number; col: number } | null => {
      const rect = gridEl.getBoundingClientRect();
      const x = clientX - rect.left + gridEl.scrollLeft;
      const y = clientY - rect.top + gridEl.scrollTop;
      if (x < 0 || y < 0) return null;
      const col = Math.floor(x / COL_W);
      const row = Math.floor(y / ROW_H);
      if (col < 0 || col >= cols || row < 0 || row >= BEAT_PADS_SPREAD_ROW_COUNT) return null;
      return { row, col };
    },
    [cols],
  );

  const handleGridPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled || e.button !== 0) return;
      const cell = cellFromEvent(e.clientX, e.clientY, e.currentTarget);
      if (!cell) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      brushRef.current = { row: cell.row };
      applyToggle(cell.row, cell.col);
    },
    [applyToggle, cellFromEvent, disabled],
  );

  const handleGridPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!brushRef.current || disabled) return;
      const cell = cellFromEvent(e.clientX, e.clientY, e.currentTarget);
      if (!cell || cell.row !== brushRef.current.row) return;
      applyToggle(cell.row, cell.col);
    },
    [applyToggle, cellFromEvent, disabled],
  );

  const handleGridPointerUp = useCallback(() => {
    brushRef.current = null;
  }, []);

  const syncLaneScroll = useCallback(() => {
    const gridEl = gridScrollRef.current;
    const laneEl = laneScrollRef.current;
    if (!gridEl || !laneEl) return;
    laneEl.scrollTop = gridEl.scrollTop;
  }, []);

  const channelOptions = useMemo(
    () =>
      Array.from(
        { length: BEAT_PADS_SPREAD_MIXER_CH_MAX - BEAT_PADS_SPREAD_MIXER_CH_MIN + 1 },
        (_, i) => BEAT_PADS_SPREAD_MIXER_CH_MIN + i,
      ),
    [],
  );

  return (
    <div
      className="beat-pads-spread-roll-popover"
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: popoverW,
        maxWidth: '96vw',
        borderRadius: 10,
        border: '1px solid rgba(196, 181, 253, 0.55)',
        background: 'linear-gradient(165deg, rgba(26, 16, 48, 0.98) 0%, rgba(8, 8, 12, 0.99) 100%)',
        boxShadow: '0 16px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(124,244,198,0.1) inset',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          flexWrap: 'wrap',
          padding: '8px 10px',
          borderBottom: '2px solid rgba(196, 181, 253, 0.28)',
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: '0.12em',
            color: BEAT_PADS_PAD_SPREAD_BADGE_STYLE.color,
            textShadow: BEAT_PADS_PAD_SPREAD_BADGE_STYLE.textShadow,
          }}
        >
          {BEAT_PADS_PAD_SPREAD_BADGE_STYLE.label}
        </span>
        {typeof onMixerChannelChange === 'function' ? (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 9, fontWeight: 800, color: '#8a9098' }}>CH</span>
            <select
              value={ch}
              disabled={disabled}
              onChange={(e) => onMixerChannelChange(clampBeatPadsSpreadMixerChannel(Number(e.target.value)))}
              style={{
                height: 26,
                minWidth: 52,
                padding: '0 6px',
                borderRadius: 5,
                border: '1px solid rgba(124, 244, 198, 0.45)',
                background: '#0e1218',
                color: MINT,
                fontSize: 10,
                fontWeight: 800,
              }}
            >
              {channelOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span style={{ fontSize: 9, fontWeight: 800, color: MINT }}>CH {ch}</span>
        )}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onDirectionChange('down')}
          style={{
            ...toolBtn,
            color: direction === 'down' ? '#9fd4ff' : '#8a9098',
          }}
        >
          ↓16
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onDirectionChange('up')}
          style={{
            ...toolBtn,
            color: direction === 'up' ? '#ffb4e6' : '#8a9098',
          }}
        >
          ↑16
        </button>
        {BEAT_PADS_SPREAD_LOOP_BAR_CHOICES.map((bars) => (
          <button
            key={bars}
            type="button"
            disabled={disabled}
            onClick={() => onLoopBarsChange(bars)}
            style={{
              ...toolBtn,
              color: loopBars === bars ? MINT : '#8a9098',
            }}
          >
            {bars}b
          </button>
        ))}
        {typeof onStrikeSpreadRow === 'function' ? (
          <button
            type="button"
            disabled={disabled || !spreadPreview.canPlay}
            onClick={() => spreadPreview.toggle()}
            title={
              spreadPreview.canPlay
                ? spreadPreview.isPlaying
                  ? `Stop spread preview (${Math.round(sessionBpm)} BPM · ${loopBars} bars)`
                  : `Preview spread loop (${Math.round(sessionBpm)} BPM · ${loopBars} bars)`
                : 'Draw notes first, then preview the loop'
            }
            style={{
              ...toolBtn,
              gap: 3,
              color: spreadPreview.isPlaying ? '#fca5a5' : MINT,
              borderColor: spreadPreview.isPlaying
                ? 'rgba(252, 165, 165, 0.55)'
                : spreadPreview.canPlay
                  ? 'rgba(124, 244, 198, 0.55)'
                  : 'rgba(255, 255, 255, 0.14)',
              background: spreadPreview.isPlaying
                ? 'rgba(252, 165, 165, 0.12)'
                : spreadPreview.canPlay
                  ? 'rgba(124, 244, 198, 0.1)'
                  : '#12121a',
              opacity: spreadPreview.canPlay ? 1 : 0.55,
            }}
          >
            {spreadPreview.isPlaying ? <Square size={9} aria-hidden /> : <Play size={9} aria-hidden />}
            {spreadPreview.isPlaying ? 'Stop' : 'Play'}
          </button>
        ) : null}
        {useSe2Match ? (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 9, fontWeight: 800, color: '#8a9098' }}>Match</span>
            <select
              value={resolvedSe2MatchIndex}
              disabled={disabled || !se2MatchTrackOptions?.length}
              onChange={(e) => onHarmonyTrackIndexChange(Number(e.target.value))}
              title="SE2 instrument lane — spread 808 follows chord roots bar-by-bar"
              style={{
                height: 26,
                minWidth: 108,
                maxWidth: 168,
                padding: '0 6px',
                borderRadius: 5,
                border: '1px solid rgba(196, 181, 253, 0.45)',
                background: '#0e1218',
                color: VIOLET,
                fontSize: 9,
                fontWeight: 800,
              }}
            >
              {se2MatchTrackOptions!.map(({ trackIndex, label }) => (
                <option key={trackIndex} value={trackIndex}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        ) : typeof onHarmonyLaneChange === 'function' ? (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 9, fontWeight: 800, color: '#8a9098' }}>Match</span>
            <select
              value={matchLane}
              disabled={disabled}
              onChange={(e) => onHarmonyLaneChange(beatLabSynth2ClampLane(Number(e.target.value)))}
              title="Beat Lab lane with chord MIDI — spread follows this track bar-by-bar"
              style={{
                height: 26,
                minWidth: 108,
                maxWidth: 148,
                padding: '0 6px',
                borderRadius: 5,
                border: '1px solid rgba(196, 181, 253, 0.45)',
                background: '#0e1218',
                color: VIOLET,
                fontSize: 9,
                fontWeight: 800,
              }}
            >
              {harmonyLaneOpts.map(({ lane, noteCount }) => (
                <option key={lane} value={lane}>
                  {beatPadsSpreadHarmonyLaneLabel(lane, noteCount)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button
          type="button"
          disabled={disabled || typeof onKeyLockChange !== 'function'}
          onClick={() => onKeyLockChange?.(!keyLockEnabled)}
          style={{
            ...toolBtn,
            borderColor: keyLockEnabled ? MINT : 'rgba(255, 255, 255, 0.2)',
            background: keyLockEnabled ? 'rgba(124, 244, 198, 0.14)' : '#12121a',
            color: keyLockEnabled ? MINT : '#8a9098',
            opacity: typeof onKeyLockChange === 'function' ? 1 : 0.55,
          }}
          title={
            typeof onKeyLockChange !== 'function'
              ? useSe2Match
                ? '808 in key — pick a Match track with chord MIDI first'
                : '808 in key — pick a Match lane with chord MIDI first'
              : keyLockEnabled
                ? `Spread follows ${matchLabel} — ${keyLabel}`
                : `Lock spread to chord roots on ${matchLabel} (${keyLabel})`
          }
        >
          {keyLockEnabled ? <Lock size={9} /> : <Unlock size={9} />}
          808 in key
        </button>
        {typeof onRegenerateChordRoots === 'function' ? (
          <button
            type="button"
            disabled={disabled || !keyLockEnabled}
            onClick={onRegenerateChordRoots}
            style={{
              ...toolBtn,
              borderColor: keyLockEnabled ? 'rgba(196, 181, 253, 0.55)' : 'rgba(255, 255, 255, 0.14)',
              color: keyLockEnabled ? VIOLET : '#6a7280',
              opacity: keyLockEnabled ? 1 : 0.5,
            }}
            title={
              keyLockEnabled
                ? 'Regenerate spread roots from matched chords — try another octave row'
                : 'Turn on 808 in key to auto-fill bar roots from chords'
            }
          >
            Regenerate
          </button>
        ) : null}
        {showSpreadExport ? (
          <>
            {typeof onExportSpreadMidi === 'function' && (midiExportTrackOptions?.length ?? 0) > 0 ? (
              <>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: '#8a9098' }}>MIDI →</span>
                  <select
                    value={midiExportTargetIndex}
                    disabled={disabled}
                    onChange={(e) => setMidiExportTargetIndex(Number(e.target.value))}
                    title="Any instrument lane that accepts MIDI"
                    style={{
                      height: 26,
                      minWidth: 108,
                      maxWidth: 168,
                      padding: '0 6px',
                      borderRadius: 5,
                      border: '1px solid rgba(124, 244, 198, 0.35)',
                      background: '#0e1218',
                      color: MINT,
                      fontSize: 9,
                      fontWeight: 800,
                    }}
                  >
                    {midiExportTrackOptions!.map(({ trackIndex, label }) => (
                      <option key={trackIndex} value={trackIndex}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={disabled || notes.length === 0}
                  onClick={() => void onExportSpreadMidi(midiExportTargetIndex)}
                  style={{
                    ...toolBtn,
                    color: notes.length === 0 ? '#6a7280' : MINT,
                    borderColor: notes.length === 0 ? 'rgba(255, 255, 255, 0.14)' : 'rgba(124, 244, 198, 0.45)',
                    opacity: notes.length === 0 ? 0.5 : 1,
                  }}
                  title="Export spread MIDI to the chosen lane (+ download .mid)"
                >
                  Export MIDI
                </button>
              </>
            ) : null}
            {typeof onExportSpreadWav === 'function' && (wavExportTrackOptions?.length ?? 0) > 0 ? (
              <>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: '#8a9098' }}>WAV →</span>
                  <select
                    value={wavExportTargetIndex}
                    disabled={disabled}
                    onChange={(e) => setWavExportTargetIndex(Number(e.target.value))}
                    title="Any audio lane that accepts WAV clips"
                    style={{
                      height: 26,
                      minWidth: 108,
                      maxWidth: 168,
                      padding: '0 6px',
                      borderRadius: 5,
                      border: '1px solid rgba(159, 212, 255, 0.35)',
                      background: '#0e1218',
                      color: '#9fd4ff',
                      fontSize: 9,
                      fontWeight: 800,
                    }}
                  >
                    {wavExportTrackOptions!.map(({ trackIndex, label }) => (
                      <option key={trackIndex} value={trackIndex}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={disabled || notes.length === 0}
                  onClick={() => void onExportSpreadWav(wavExportTargetIndex)}
                  style={{
                    ...toolBtn,
                    color: notes.length === 0 ? '#6a7280' : '#9fd4ff',
                    borderColor: notes.length === 0 ? 'rgba(255, 255, 255, 0.14)' : 'rgba(159, 212, 255, 0.45)',
                    opacity: notes.length === 0 ? 0.5 : 1,
                  }}
                  title="Bounce spread WAV to the chosen lane (+ download .wav)"
                >
                  Export WAV
                </button>
              </>
            ) : null}
          </>
        ) : null}
        <div style={{ marginLeft: 'auto', display: 'inline-flex', gap: 4, alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setEditTool('draw')}
            style={{ ...toolBtn, color: editTool === 'draw' ? MINT : '#8a9098' }}
          >
            Draw
          </button>
          <button
            type="button"
            onClick={() => setEditTool('erase')}
            style={{ ...toolBtn, color: editTool === 'erase' ? '#fca5a5' : '#8a9098' }}
          >
            Erase
          </button>
          <button
            type="button"
            disabled={disabled || notes.length === 0}
            onClick={() => onNotesChange([])}
            style={{
              ...toolBtn,
              color: notes.length === 0 ? '#6a7280' : '#fca5a5',
              borderColor: notes.length === 0 ? 'rgba(255, 255, 255, 0.14)' : 'rgba(252, 165, 165, 0.45)',
              opacity: notes.length === 0 ? 0.5 : 1,
            }}
            title="Remove every note from the spread roll"
          >
            Clear all
          </button>
          {typeof onClose === 'function' ? (
            <button
              type="button"
              onClick={() => {
                spreadPreview.stop();
                onClose();
              }}
              aria-label="Close spread roll"
              title="Close spread roll"
              style={{
                ...toolBtn,
                width: 28,
                minWidth: 28,
                padding: 0,
                justifyContent: 'center',
                color: '#fca5a5',
                borderColor: 'rgba(252, 165, 165, 0.45)',
                background: 'rgba(252, 165, 165, 0.1)',
                fontSize: 16,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          ) : null}
        </div>
        {exportStatus ? (
          <span
            style={{
              width: '100%',
              flexBasis: '100%',
              fontSize: 9,
              fontWeight: 700,
              color: MINT,
              paddingTop: 2,
            }}
          >
            {exportStatus}
          </span>
        ) : null}
      </div>

      <div style={{ display: 'flex', maxHeight: HEADER_H + MAX_GRID_H + 6 }}>
        <div style={{ width: LANE_W, flexShrink: 0, borderRight: '2px solid rgba(255,255,255,0.22)' }}>
          <div
            style={{
              height: HEADER_H,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 9,
              fontWeight: 900,
              color: '#9aa3b0',
              background: SURFACE,
              borderBottom: ROW_LINE,
            }}
          >
            PITCH
          </div>
          <div ref={laneScrollRef} style={{ maxHeight: MAX_GRID_H, overflow: 'hidden' }}>
            {rowLabels.map((label, row) => (
              <button
                key={row}
                type="button"
                disabled={disabled}
                onClick={() => onPreviewRow?.(row)}
                title={cbPianoMidiToNoteName(beatPadsSpreadRowMidi(rootMidi, row, direction))}
                style={{
                  width: '100%',
                  height: ROW_H,
                  display: 'block',
                  padding: '0 6px',
                  border: 'none',
                  borderBottom: ROW_LINE,
                  background: row === 0 ? 'rgba(124, 244, 198, 0.12)' : SURFACE,
                  cursor: disabled ? 'default' : 'pointer',
                  textAlign: 'left',
                  overflow: 'hidden',
                  boxSizing: 'border-box',
                }}
              >
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    color: row === 0 ? MINT : '#b8c0cc',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label.length > 12 ? label.slice(0, 12) + '…' : label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div
          ref={gridScrollRef}
          onScroll={syncLaneScroll}
          style={{
            flex: 1,
            minWidth: visibleGridW,
            width: scrollGrid ? visibleGridW : gridW,
            overflow: scrollGrid ? 'auto' : 'hidden',
            maxHeight: HEADER_H + MAX_GRID_H + 6,
          }}
        >
          <div style={{ width: gridW, minWidth: gridW }}>
            <div
              style={{
                display: 'flex',
                height: HEADER_H,
                background: SURFACE,
                borderBottom: ROW_LINE,
              }}
            >
              {Array.from({ length: barCount }, (_, bi) => (
                <div
                  key={bi}
                  style={{
                    width: stepsPerBar * COL_W,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 900,
                    color: '#e8ecf0',
                    fontFamily: 'monospace',
                    borderLeft:
                      bi === 0
                        ? '2px solid rgba(255,255,255,0.35)'
                        : '3px solid rgba(255,255,255,0.58)',
                    boxSizing: 'border-box',
                  }}
                >
                  {bi + 1}
                </div>
              ))}
            </div>
            <div
              role="grid"
              aria-label="Spread pitch roll"
              onPointerDown={handleGridPointerDown}
              onPointerMove={handleGridPointerMove}
              onPointerUp={handleGridPointerUp}
              onPointerCancel={handleGridPointerUp}
              style={{
                position: 'relative',
                height: BEAT_PADS_SPREAD_ROW_COUNT * ROW_H,
                cursor: disabled ? 'not-allowed' : editTool === 'erase' ? 'cell' : 'crosshair',
              }}
            >
              {Array.from({ length: BEAT_PADS_SPREAD_ROW_COUNT }, (_, row) => (
                <div
                  key={row}
                  style={{
                    position: 'absolute',
                    top: row * ROW_H,
                    left: 0,
                    width: gridW,
                    height: ROW_H,
                    display: 'flex',
                    pointerEvents: 'none',
                    borderBottom: ROW_LINE,
                    boxSizing: 'border-box',
                  }}
                >
                  {Array.from({ length: cols }, (_, col) => {
                    const line = gridLineStyle(col, stepsPerBar);
                    return (
                      <div
                        key={col}
                        style={{
                          width: COL_W,
                          height: ROW_H,
                          flexShrink: 0,
                          borderLeft: `${line.width}px solid ${line.color}`,
                          background: row === 0 ? 'rgba(124, 244, 198, 0.06)' : 'rgba(255,255,255,0.02)',
                          boxSizing: 'border-box',
                        }}
                      />
                    );
                  })}
                </div>
              ))}
              {notes.map((note) => (
                <div
                  key={note.id}
                  style={{
                    position: 'absolute',
                    top: note.row * ROW_H + 2,
                    left: note.start * COL_W + 2,
                    width: Math.max(COL_W - 4, note.len * COL_W - 4),
                    height: ROW_H - 4,
                    borderRadius: 3,
                    background: stepOnFill(),
                    border: '2px solid #dbffe2',
                    boxShadow: '0 0 6px rgba(124, 244, 198, 0.35)',
                    pointerEvents: 'none',
                  }}
                />
              ))}
              {spreadPreview.playCol != null ? (
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: spreadPreview.playCol * COL_W,
                    width: COL_W,
                    height: BEAT_PADS_SPREAD_ROW_COUNT * ROW_H,
                    background: 'rgba(255, 217, 102, 0.14)',
                    borderLeft: '2px solid rgba(255, 217, 102, 0.75)',
                    borderRight: '1px solid rgba(255, 217, 102, 0.35)',
                    pointerEvents: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
