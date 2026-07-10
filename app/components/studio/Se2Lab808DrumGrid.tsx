'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { Eraser, MousePointer2, Pencil } from 'lucide-react';
import { setBeatPadsPlaylineAtCol } from '@/app/lib/creationStation/beatPadsPlaylineWapi';
import type { Lab808SoundLane } from '@/app/lib/creationStation/eightZeroEightVoice';
import {
  LAB808_TONE_PAD_COUNT,
  isLab808BlackKeyMidi,
  lab808TonePadNoteLabel,
  lab808TonePadRangeLabel,
} from '@/app/lib/creationStation/lab808TonePads';
import {
  SE2_LAB808_TONE_GRID_LOOP_BARS_OPTIONS,
  SE2_LAB808_TONE_GRID_STEPS_PER_BAR,
  emptySe2Lab808ToneGridPattern,
  moveSe2Lab808ToneGridStep,
  resizeSe2Lab808ToneGridPattern,
  se2Lab808ToneGridHasHits,
  se2Lab808ToneGridStepCount,
  se2Lab808ToneGridToggleStep,
  se2Lab808ToneMidiForLane,
  type Se2Lab808ToneGridLoopBars,
} from '@/app/lib/studio/se2Lab808DrumPattern';
import { previewSe2Lab808Note } from '@/app/lib/studio/se2Lab808Preview';
import type { Se2Lab808VoiceParams } from '@/app/lib/studio/se2Lab808Types';
import { SE2_LAB808_FILTER_VIZ_SURFACE } from '@/app/lib/studio/se2Lab808UiTheme';
import { useSe2Lab808ToneGridTransport } from '@/app/lib/studio/useSe2Lab808ToneGridTransport';
import {
  SE2_LAB808_TONE_GRID_ROW_GAP_PX,
  Se2Lab808ToneGridPianoKeys,
} from '@/app/components/studio/Se2Lab808ToneGridPianoKeys';
import { GrooveLabExportStrip } from '@/app/components/creation/GrooveLabExportStrip';
import { Se2Lab808ToneGridZoomControl } from '@/app/components/studio/Se2Lab808ToneGridZoomControl';
import { GENO_LOOP_PIANO_GRID } from '@/app/lib/studio/se2SynthGenoLoopPianoRoll';
import {
  SE2_LAB808_TONE_GRID_HEADER_H_BASE,
  SE2_LAB808_TONE_GRID_LANE_H_BASE,
  SE2_LAB808_TONE_GRID_STEP_W_BASE,
  se2Lab808ToneGridColLeftPx,
  se2Lab808ToneGridLayout,
  se2Lab808ToneGridSpanWidthPx,
} from '@/app/lib/studio/se2Lab808ToneGridLayout';

export type Se2Lab808ToneGridEditTool = 'select' | 'draw' | 'erase';

export type Se2Lab808ToneGridExportHandlers = {
  busy?: boolean;
  status?: string | null;
  hasHits: boolean;
  onExportMidi: () => void;
  onExportWav: () => void | Promise<void>;
  onToPianoRoll: () => void;
  onToTrack: () => void | Promise<void>;
};

export type Se2Lab808DrumGridProps = {
  voice: Se2Lab808VoiceParams;
  bpm: number;
  accent: string;
  disabled?: boolean;
  getAudioContext: () => AudioContext;
  getPreviewDestination: (ctx: AudioContext) => AudioNode;
  onVoiceChange: (voice: Se2Lab808VoiceParams) => void;
  toneGridExport?: Se2Lab808ToneGridExportHandlers;
  /** Rendered between the grid toolbar and the scrollable step matrix (e.g. tone pads). */
  aboveGrid?: ReactNode;
};

export const SE2_LAB808_TONE_GRID_STEP_W = SE2_LAB808_TONE_GRID_STEP_W_BASE;
export const SE2_LAB808_TONE_GRID_LANE_H = SE2_LAB808_TONE_GRID_LANE_H_BASE;
export const SE2_LAB808_TONE_GRID_HEADER_H = SE2_LAB808_TONE_GRID_HEADER_H_BASE;
/** Default column pitch at 100% zoom (playline fallback). */
export const SE2_LAB808_TONE_GRID_COL_W = SE2_LAB808_TONE_GRID_STEP_W_BASE;
const GRID_ROW_GAP_PX = SE2_LAB808_TONE_GRID_ROW_GAP_PX;
/** Geno loop piano-roll dark grid tokens (muted lines, lane fills). */
const TONE_GRID = GENO_LOOP_PIANO_GRID;
/** SE2 timeline track grid — single 1px hairlines (StudioEditor2Screen canvas). */
const SE2_TRACK_GRID_LINE = {
  row: 'rgba(255,255,255,0.08)',
  bar: 'rgba(255,255,255,0.2)',
  beat: 'rgba(255,255,255,0.08)',
  step: 'rgba(255,255,255,0.05)',
} as const;
/** Full-height bar ruler beside header numbers (visible when scrolled). */
const TONE_GRID_BAR_MARKER_LINE = SE2_TRACK_GRID_LINE.bar;
/** Loop region header band — fixed green (independent of lane accent). */
const LOOP_HIGHLIGHT_GREEN = '#22c55e';

function toneGridLaneFill(blackKey: boolean): string {
  return blackKey ? SE2_LAB808_FILTER_VIZ_SURFACE.fill : SE2_LAB808_FILTER_VIZ_SURFACE.fillHi;
}

function toneGridStepCellBorder(
  col: number,
  lane: number,
): Pick<CSSProperties, 'borderTop' | 'borderRight' | 'borderBottom' | 'borderLeft'> {
  const barStart = col % SE2_LAB808_TONE_GRID_STEPS_PER_BAR === 0;
  const beatStart = col % 4 === 0;
  return {
    // One hairline per edge — bar columns use the full-height bar marker overlay instead.
    borderLeft: barStart
      ? '1px solid transparent'
      : `1px solid ${beatStart ? SE2_TRACK_GRID_LINE.beat : SE2_TRACK_GRID_LINE.step}`,
    borderBottom: `1px solid ${SE2_TRACK_GRID_LINE.row}`,
    borderTop: lane === 0 ? `1px solid ${SE2_TRACK_GRID_LINE.row}` : undefined,
    borderRight: 'none',
  };
}

const loopBtn = (active: boolean, accent: string): CSSProperties => ({
  padding: '5px 12px',
  minWidth: 36,
  minHeight: 24,
  borderRadius: 6,
  border: `1px solid ${active ? `${accent}aa` : '#333340'}`,
  background: active ? `${accent}22` : 'rgba(255,255,255,0.03)',
  color: active ? accent : '#9a9aac',
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: '0.05em',
  cursor: 'pointer',
  textAlign: 'center',
});

const toolBtn = (active: boolean, accent: string, danger = false): CSSProperties => ({
  padding: '5px 10px',
  minHeight: 24,
  borderRadius: 6,
  border: `1px solid ${active ? `${accent}aa` : danger ? '#7f1d1d88' : '#333340'}`,
  background: active ? `${accent}22` : danger ? 'rgba(127,29,29,0.15)' : 'rgba(255,255,255,0.03)',
  color: active ? accent : danger ? '#fca5a5' : '#9a9aac',
  fontSize: 8,
  fontWeight: 800,
  letterSpacing: '0.05em',
  cursor: 'pointer',
  textAlign: 'center',
  textTransform: 'uppercase',
});

const exportChip = (enabled: boolean, color: string): CSSProperties => ({
  padding: '5px 12px',
  minHeight: 24,
  minWidth: 54,
  borderRadius: 6,
  border: `1px solid ${enabled ? `${color}88` : '#333340'}`,
  background: enabled ? `${color}18` : 'rgba(255,255,255,0.03)',
  color: enabled ? color : '#6a6a78',
  fontSize: 8,
  fontWeight: 800,
  letterSpacing: '0.05em',
  cursor: enabled ? 'pointer' : 'default',
  textAlign: 'center',
  textTransform: 'uppercase',
  opacity: enabled ? 1 : 0.55,
});

const toolIconBtn = (active: boolean, accent: string): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 24,
  padding: 0,
  borderRadius: 6,
  border: `1px solid ${active ? `${accent}aa` : '#333340'}`,
  background: active ? `${accent}22` : 'rgba(255,255,255,0.03)',
  color: active ? accent : '#9a9aac',
  cursor: 'pointer',
});

function gridStepCursor(tool: Se2Lab808ToneGridEditTool, on: boolean): string {
  if (tool === 'erase') return 'cell';
  if (tool === 'draw') return 'crosshair';
  return on ? 'grab' : 'default';
}

function toneLaneAccent(soundLane: Lab808SoundLane, blackKey: boolean): string {
  if (soundLane === 'kick') return blackKey ? '#b45309' : '#fde68a';
  return blackKey ? '#16a34a' : '#86efac';
}

function toneLaneSurface(soundLane: Lab808SoundLane, blackKey: boolean, on: boolean): string {
  const accent = toneLaneAccent(soundLane, blackKey);
  const mix = on ? 78 : blackKey ? 38 : 52;
  const base = blackKey ? '#0a0a0e' : '#14141c';
  return `linear-gradient(165deg, color-mix(in srgb, ${accent} ${mix}%, ${base}) 0%, #0c0c10 100%)`;
}

export function Se2Lab808DrumGrid({
  voice,
  bpm,
  accent,
  disabled = false,
  getAudioContext,
  getPreviewDestination,
  onVoiceChange,
  toneGridExport,
  aboveGrid,
}: Se2Lab808DrumGridProps) {
  const layout = se2Lab808ToneGridLayout(voice.toneGridZoom);
  const pattern = voice.toneGridSteps;
  const loopBars = voice.toneGridLoopBars;
  const stepCount = se2Lab808ToneGridStepCount(loopBars);
  const loopStepCount = stepCount;
  const loopHeaderWidthPx = se2Lab808ToneGridSpanWidthPx(loopStepCount, layout.stepW);
  const baseMidi = voice.tonePadBaseMidi;
  const isKick = voice.soundLane === 'kick';
  const paintRef = useRef<{ active: boolean; lastKey: string; erase: boolean } | null>(null);
  const moveRef = useRef<{ fromLane: number; fromCol: number; toLane: number; toCol: number } | null>(
    null,
  );
  const gridScrollRef = useRef<HTMLDivElement>(null);
  const playlineElRef = useRef<HTMLDivElement>(null);
  const [gridTool, setGridTool] = useState<Se2Lab808ToneGridEditTool>('draw');
  const [movePreview, setMovePreview] = useState<{ fromLane: number; fromCol: number; toLane: number; toCol: number } | null>(
    null,
  );
  const scrubRef = useRef(false);

  const { playing, playheadCol, play, stop, seekCol } = useSe2Lab808ToneGridTransport({
    stepCount,
    bpm,
    voice,
    pattern,
    disabled,
    colWidthPx: layout.colW,
    playlineElRef,
    getAudioContext,
    getPreviewDestination,
  });

  useEffect(() => {
    if (playing) return;
    setBeatPadsPlaylineAtCol(
      playlineElRef.current,
      Math.floor(playheadCol),
      layout.colW,
    );
  }, [layout.colW, playheadCol, playing]);

  const previewLane = useCallback(
    (lane: number) => {
      if (disabled) return;
      const ctx = getAudioContext();
      const midi = se2Lab808ToneMidiForLane(baseMidi, lane);
      previewSe2Lab808Note(
        ctx,
        getPreviewDestination(ctx),
        midi,
        Math.max(1, Math.round(100 * voice.toneGridLevel * voice.output)),
        voice,
        bpm,
        isKick ? 0.35 : 0.75,
      );
    },
    [baseMidi, bpm, disabled, getAudioContext, getPreviewDestination, isKick, voice],
  );

  const applyStep = useCallback(
    (lane: number, col: number, mode: 'toggle' | 'on' | 'off') => {
      if (disabled) return;

      const key = `${lane}:${col}`;
      const rowOn = Boolean(pattern[lane]?.[col]);

      if (mode === 'on') {
        if (paintRef.current?.lastKey === key) return;
        if (paintRef.current) paintRef.current.lastKey = key;
        if (rowOn) return;
        previewLane(lane);
        const next = pattern.map((row) => [...row]);
        if (!next[lane] || next[lane]!.length < stepCount) {
          next[lane] = [...(next[lane] ?? [])];
          while (next[lane]!.length < stepCount) next[lane]!.push(false);
        }
        next[lane]![col] = true;
        onVoiceChange({ ...voice, toneGridSteps: next });
        return;
      }

      if (mode === 'off') {
        if (paintRef.current?.lastKey === key) return;
        if (paintRef.current) paintRef.current.lastKey = key;
        if (!rowOn) return;
        const next = pattern.map((row) => [...row]);
        next[lane]![col] = false;
        onVoiceChange({ ...voice, toneGridSteps: next });
        return;
      }

      previewLane(lane);
      onVoiceChange({
        ...voice,
        toneGridSteps: se2Lab808ToneGridToggleStep(pattern, lane, col, loopBars),
      });
    },
    [disabled, loopBars, onVoiceChange, pattern, previewLane, stepCount, voice],
  );

  const clearPattern = useCallback(() => {
    if (disabled || !se2Lab808ToneGridHasHits(pattern)) return;
    onVoiceChange({ ...voice, toneGridSteps: emptySe2Lab808ToneGridPattern(loopBars) });
  }, [disabled, loopBars, onVoiceChange, pattern, voice]);

  const setLoopBars = useCallback(
    (nextBars: Se2Lab808ToneGridLoopBars) => {
      if (nextBars === loopBars) return;
      onVoiceChange({
        ...voice,
        toneGridLoopBars: nextBars,
        toneGridSteps: resizeSe2Lab808ToneGridPattern(pattern, loopBars, nextBars),
      });
    },
    [loopBars, onVoiceChange, pattern, voice],
  );

  const commitMove = useCallback(() => {
    const drag = moveRef.current;
    if (!drag) return;
    moveRef.current = null;
    setMovePreview(null);
    if (drag.fromLane === drag.toLane && drag.fromCol === drag.toCol) return;
    previewLane(drag.toLane);
    onVoiceChange({
      ...voice,
      toneGridSteps: moveSe2Lab808ToneGridStep(
        pattern,
        drag.fromLane,
        drag.fromCol,
        drag.toLane,
        drag.toCol,
        loopBars,
      ),
    });
  }, [loopBars, onVoiceChange, pattern, previewLane, voice]);

  const endPaint = useCallback(() => {
    if (moveRef.current) commitMove();
    paintRef.current = null;
    scrubRef.current = false;
  }, [commitMove]);

  const colFromClientX = useCallback(
    (clientX: number): number | null => {
      const scrollEl = gridScrollRef.current;
      if (!scrollEl) return null;
      const inner = scrollEl.querySelector('[data-lab808-tone-grid-steps]') as HTMLElement | null;
      if (!inner) return null;
      const rect = inner.getBoundingClientRect();
      const localX = clientX - rect.left;
      if (localX < 0 || localX > rect.width) return null;
      const col = Math.floor(localX / layout.stepW);
      return Math.max(0, Math.min(stepCount - 1, col));
    },
    [layout.stepW, stepCount],
  );

  const onScrubPointerDown = useCallback(
    (col: number, e: PointerEvent<HTMLElement>) => {
      if (disabled) return;
      e.preventDefault();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      scrubRef.current = true;
      seekCol(col);
    },
    [disabled, seekCol],
  );

  const onScrubPointerMove = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      if (!scrubRef.current || disabled) return;
      const col = colFromClientX(e.clientX);
      if (col != null) seekCol(col);
    },
    [colFromClientX, disabled, seekCol],
  );

  const onStepPointerDown = useCallback(
    (lane: number, col: number, e: PointerEvent<HTMLButtonElement>) => {
      if (disabled) return;
      e.preventDefault();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }

      if (gridTool === 'select') {
        if (!pattern[lane]?.[col]) return;
        moveRef.current = { fromLane: lane, fromCol: col, toLane: lane, toCol: col };
        setMovePreview({ fromLane: lane, fromCol: col, toLane: lane, toCol: col });
        return;
      }

      const erase = gridTool === 'erase';
      paintRef.current = { active: true, lastKey: `${lane}:${col}`, erase };
      applyStep(lane, col, erase ? 'off' : 'toggle');
    },
    [applyStep, disabled, gridTool, pattern],
  );

  const onStepPointerEnter = useCallback(
    (lane: number, col: number) => {
      if (moveRef.current) {
        moveRef.current = { ...moveRef.current, toLane: lane, toCol: col };
        setMovePreview({ ...moveRef.current, toLane: lane, toCol: col });
        return;
      }
      if (!paintRef.current?.active) return;
      applyStep(lane, col, paintRef.current.erase ? 'off' : 'on');
    },
    [applyStep],
  );

  return (
    <section className="flex flex-col min-w-0" aria-label="808 tone step grid">
      {aboveGrid ? <div className="min-w-0 overflow-visible">{aboveGrid}</div> : null}

      <div className="flex flex-wrap items-center gap-2 min-w-0 mt-1 mb-1">
        <span className="text-[8px] font-black uppercase tracking-wide shrink-0" style={{ color: accent }}>
          Tone grid
        </span>
        <span className="text-[8px] font-bold tabular-nums shrink-0" style={{ color: '#9a9aac' }}>
          {lab808TonePadRangeLabel(baseMidi)}
        </span>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[8px] font-bold uppercase mr-0.5" style={{ color: '#6a6a78' }}>
            Loop
          </span>
          {SE2_LAB808_TONE_GRID_LOOP_BARS_OPTIONS.map((bars) => (
            <button
              key={bars}
              type="button"
              disabled={disabled}
              style={loopBtn(loopBars === bars, accent)}
              onClick={() => setLoopBars(bars)}
              title={`${bars}-bar tone grid loop`}
            >
              {bars}b
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            disabled={disabled}
            style={toolIconBtn(gridTool === 'select', accent)}
            onClick={() => setGridTool('select')}
            aria-label="Select"
            title="Select — grab a step and drag to move it"
          >
            <MousePointer2 size={13} strokeWidth={2.25} aria-hidden />
          </button>
          <button
            type="button"
            disabled={disabled}
            style={toolIconBtn(gridTool === 'draw', accent)}
            onClick={() => setGridTool('draw')}
            aria-label="Draw"
            title="Draw — click or drag to add steps"
          >
            <Pencil size={13} strokeWidth={2.25} aria-hidden />
          </button>
          <button
            type="button"
            disabled={disabled}
            style={toolIconBtn(gridTool === 'erase', accent)}
            onClick={() => setGridTool('erase')}
            aria-label="Erase"
            title="Erase — click or drag to remove steps"
          >
            <Eraser size={13} strokeWidth={2.25} aria-hidden />
          </button>
          <button
            type="button"
            disabled={disabled || !se2Lab808ToneGridHasHits(pattern)}
            style={toolBtn(false, accent, true)}
            onClick={clearPattern}
            title="Clear all steps in the tone grid"
          >
            Clear
          </button>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            disabled={disabled || playing}
            style={toolBtn(playing, accent)}
            onClick={play}
            title="Play tone grid loop from playhead"
          >
            Play
          </button>
          <button
            type="button"
            disabled={disabled || !playing}
            style={toolBtn(false, accent)}
            onClick={stop}
            title="Stop playback and reset playhead"
          >
            Stop
          </button>
          <span
            className="text-[8px] font-bold tabular-nums shrink-0 inline-block text-center"
            style={{ color: '#9a9aac', width: 56 }}
            title="Playhead step (scrub on bar numbers above grid)"
          >
            {Math.floor(playheadCol) + 1}/{stepCount}
          </span>
        </div>
        {toneGridExport ? (
          <div className="flex items-center shrink-0" style={{ gap: 10 }}>
            <GrooveLabExportStrip
              busy={toneGridExport.busy}
              status={toneGridExport.status}
              hasChords={toneGridExport.hasHits}
              hasRollNotes={toneGridExport.hasHits}
              onExportMidi={toneGridExport.onExportMidi}
              onExportWav={toneGridExport.onExportWav}
              toolbarInline
              showExportLabel
              widerButtons
              chipGap={10}
            />
            <div className="flex items-center shrink-0" style={{ gap: 8 }}>
              <button
                type="button"
                disabled={disabled || toneGridExport.busy || !toneGridExport.hasHits}
                style={exportChip(!disabled && !toneGridExport.busy && toneGridExport.hasHits, '#c4b5fd')}
                onClick={toneGridExport.onToPianoRoll}
                title="Send tone grid to this 808 Lab track piano roll"
              >
                To roll
              </button>
              <button
                type="button"
                disabled={disabled || toneGridExport.busy || !toneGridExport.hasHits}
                style={exportChip(!disabled && !toneGridExport.busy && toneGridExport.hasHits, '#86efac')}
                onClick={() => void toneGridExport.onToTrack()}
                title="Bounce tone grid loop to a new audio track"
              >
                To track
              </button>
            </div>
            {toneGridExport.status ? (
              <span
                className="text-[7px] font-semibold max-w-[100px] truncate shrink-0"
                style={{ color: toneGridExport.status.startsWith('✓') ? '#86efac' : '#fca5a5' }}
              >
                {toneGridExport.status}
              </span>
            ) : null}
          </div>
        ) : null}
        <Se2Lab808ToneGridZoomControl
          zoom={voice.toneGridZoom}
          disabled={disabled}
          onZoomChange={(toneGridZoom) => onVoiceChange({ ...voice, toneGridZoom })}
        />
      </div>

      <div
        ref={gridScrollRef}
        className="overflow-x-auto overscroll-contain rounded border relative"
          style={{
            borderColor: SE2_LAB808_FILTER_VIZ_SURFACE.borderHex,
            background: SE2_LAB808_FILTER_VIZ_SURFACE.fill,
            boxShadow: SE2_LAB808_FILTER_VIZ_SURFACE.insetShadow,
          }}
          onPointerUp={endPaint}
          onPointerCancel={endPaint}
          onPointerLeave={endPaint}
          onPointerMove={onScrubPointerMove}
        >
        <div
          className="inline-flex items-stretch min-w-0 p-1.5 relative"
          style={{ gap: 6, background: SE2_LAB808_FILTER_VIZ_SURFACE.fill, borderRadius: 4 }}
        >
          <div
            className="shrink-0"
            style={{
              borderRight: `1px solid ${TONE_GRID.barLine}`,
              paddingRight: 4,
            }}
          >
            <Se2Lab808ToneGridPianoKeys
              tonePadBaseMidi={baseMidi}
              laneCount={LAB808_TONE_PAD_COUNT}
              laneHeightPx={layout.laneH}
              headerHeightPx={layout.headerH}
              rowGapPx={GRID_ROW_GAP_PX}
              laneTopOffsetPx={layout.pianoLaneOffsetPx}
              pianoColPx={layout.pianoColPx}
              disabled={disabled}
              onPreviewLane={previewLane}
            />
          </div>

          <div className="relative shrink-0 min-w-0">
            {Array.from({ length: Math.ceil(stepCount / SE2_LAB808_TONE_GRID_STEPS_PER_BAR) }, (_, bar) => (
              <div
                key={`bar-shade-${bar}`}
                className="absolute pointer-events-none z-0"
                style={{
                  top: layout.headerH,
                  left: se2Lab808ToneGridColLeftPx(bar * SE2_LAB808_TONE_GRID_STEPS_PER_BAR, layout.stepW),
                  width: layout.barWidthPx,
                  bottom: 0,
                  background: bar % 2 === 0 ? TONE_GRID.barFillA : TONE_GRID.barFillB,
                }}
                aria-hidden
              />
            ))}
            {Array.from({ length: Math.ceil(stepCount / SE2_LAB808_TONE_GRID_STEPS_PER_BAR) }, (_, bar) => (
              <div
                key={`bar-marker-${bar}`}
                className="absolute top-0 bottom-0 pointer-events-none z-[3]"
                style={{
                  left: se2Lab808ToneGridColLeftPx(bar * SE2_LAB808_TONE_GRID_STEPS_PER_BAR, layout.stepW),
                  borderLeft: `1px solid ${TONE_GRID_BAR_MARKER_LINE}`,
                }}
                aria-hidden
              />
            ))}
            <div
              className="absolute top-0 left-0 pointer-events-none z-[1]"
              style={{
                height: layout.headerH,
                width: loopHeaderWidthPx,
                background: 'linear-gradient(180deg, rgba(34, 197, 94, 0.22) 0%, rgba(34, 197, 94, 0.1) 100%)',
                borderLeft: '1px solid rgba(34, 197, 94, 0.45)',
                borderRight: `1px solid ${LOOP_HIGHLIGHT_GREEN}`,
                borderTop: '1px solid rgba(34, 197, 94, 0.38)',
                borderBottom: '1px solid rgba(34, 197, 94, 0.28)',
                borderRadius: '2px 2px 0 0',
              }}
              aria-hidden
              title={`${loopBars}-bar loop region`}
            />
            <div
              ref={playlineElRef}
              className="absolute top-0 bottom-0 pointer-events-none z-10"
              style={{
                left: 0,
                width: 2,
                background: playing ? accent : `${accent}99`,
                boxShadow: playing ? `0 0 6px ${accent}88` : undefined,
                willChange: playing ? 'transform' : undefined,
              }}
              aria-hidden
            />
            <div
              data-lab808-tone-grid-steps
              className="inline-grid min-w-0 relative"
            style={{
              gridTemplateColumns: `repeat(${stepCount}, ${layout.stepW}px)`,
              gridTemplateRows: `${layout.headerH}px repeat(${LAB808_TONE_PAD_COUNT}, ${layout.laneH}px)`,
              columnGap: 0,
              rowGap: 0,
              background: SE2_LAB808_FILTER_VIZ_SURFACE.fill,
            }}
          >
            {Array.from({ length: stepCount }, (_, col) => {
              const barStart = col % SE2_LAB808_TONE_GRID_STEPS_PER_BAR === 0;
              const barNum = Math.floor(col / SE2_LAB808_TONE_GRID_STEPS_PER_BAR) + 1;
              const playheadHere = Math.floor(playheadCol) === col;
              const inLoopRegion = col < loopStepCount;
              const isLoopEnd = col === loopStepCount - 1;
              const isLoopStart = col === 0;
              return (
                <button
                  key={`h-${col}`}
                  type="button"
                  disabled={disabled}
                  onPointerDown={(e) => onScrubPointerDown(col, e)}
                  className="text-center font-bold tabular-nums flex items-center justify-center touch-manipulation select-none outline-none relative z-[2]"
                  style={{
                    fontSize: layout.headerFontPx,
                    color: playheadHere
                      ? accent
                      : inLoopRegion && barStart
                        ? LOOP_HIGHLIGHT_GREEN
                        : col % 4 === 0
                          ? 'rgba(255,255,255,0.42)'
                          : 'rgba(255,255,255,0.22)',
                    background: playheadHere
                      ? `${accent}28`
                      : inLoopRegion && barStart
                        ? 'rgba(34, 197, 94, 0.12)'
                        : 'transparent',
                    cursor: disabled ? 'default' : 'ew-resize',
                    border: 'none',
                    padding: 0,
                    opacity: inLoopRegion ? 1 : 0.45,
                  }}
                  title={
                    isLoopStart
                      ? `Loop start · bar ${barNum} · scrub playhead`
                      : isLoopEnd
                        ? `${loopBars}-bar loop ends here (before bar ${barNum + 1}) · scrub playhead`
                        : `Scrub playhead to step ${col + 1}`
                  }
                >
                  {barStart ? barNum : ''}
                </button>
              );
            })}
            {Array.from({ length: LAB808_TONE_PAD_COUNT }, (_, lane) => {
              const midi = se2Lab808ToneMidiForLane(baseMidi, lane);
              const label = lab808TonePadNoteLabel(midi);
              const black = isLab808BlackKeyMidi(midi);
              const laneAccent = toneLaneAccent(voice.soundLane, black);
              return Array.from({ length: stepCount }, (_, col) => {
                const on = Boolean(pattern[lane]?.[col]);
                const cellBorder = toneGridStepCellBorder(col, lane);
                const isMoveSource =
                  movePreview != null &&
                  movePreview.fromLane === lane &&
                  movePreview.fromCol === col &&
                  (movePreview.toLane !== lane || movePreview.toCol !== col);
                const isMoveTarget =
                  movePreview != null &&
                  movePreview.toLane === lane &&
                  movePreview.toCol === col &&
                  (movePreview.fromLane !== lane || movePreview.fromCol !== col);
                const showOn = on && !isMoveSource;
                return (
                  <button
                    key={`${lane}-${col}`}
                    type="button"
                    disabled={disabled}
                    aria-pressed={showOn}
                    title={`${label} bar ${Math.floor(col / SE2_LAB808_TONE_GRID_STEPS_PER_BAR) + 1} step ${(col % SE2_LAB808_TONE_GRID_STEPS_PER_BAR) + 1}`}
                    onPointerDown={(e) => onStepPointerDown(lane, col, e)}
                    onPointerEnter={() => onStepPointerEnter(lane, col)}
                    className="outline-none transition-colors disabled:opacity-40 touch-manipulation select-none"
                    style={{
                      width: layout.stepW,
                      height: layout.laneH,
                      borderRadius: showOn || isMoveTarget ? 2 : 0,
                      boxSizing: 'border-box',
                      ...(showOn || isMoveTarget
                        ? { border: `1px solid ${laneAccent}` }
                        : cellBorder),
                      cursor: gridStepCursor(gridTool, on),
                      boxShadow: isMoveTarget ? `0 0 0 1px ${accent}` : undefined,
                      opacity: isMoveSource ? 0.35 : 1,
                      background: showOn || isMoveTarget
                        ? toneLaneSurface(voice.soundLane, black, true)
                        : toneGridLaneFill(black),
                      position: 'relative',
                      zIndex: 2,
                    }}
                  />
                );
              });
            })}
          </div>
          </div>
        </div>
      </div>

      <p className="text-[7px] m-0 mt-1 leading-snug" style={{ color: '#6a6a78' }}>
        Select grabs a step to move; pencil draws; eraser removes. Clear wipes the pattern. Play loops the
        grid — drag bar numbers to scrub the playhead.
      </p>
    </section>
  );
}
