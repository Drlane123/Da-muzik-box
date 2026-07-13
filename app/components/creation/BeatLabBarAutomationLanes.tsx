/**
 * FL Piano roll event lanes — continuous VOL + PITCH lines under each bar.
 * Fine ticks (8 per step) for decisive edits in tiny spots; Shift+drag = slide line.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  BEAT_LAB_AUTOMATION_LANE_H,
  BEAT_LAB_AUTOMATION_TICKS_PER_COL,
  BEAT_LAB_PITCH_AUTOMATION_CENTER,
  BEAT_LAB_VOL_AUTOMATION_DEFAULT,
  beatLabAutomationFineCols,
  beatLabFormatPitchSemi,
  beatLabPatternColFromFineIndex,
  beatLabPitchSemiFromAutomation,
} from '../../lib/creationStation/beatLabAutomation';
import { BeatLabSnapGridOverlay } from './BeatLabSnapGridOverlay';

export type BeatLabPitchAutomationSelection = { fineLo: number; fineHi: number };

export type BeatLabBarAutomationLanesProps = {
  patternCols: number;
  colWidth: number;
  labelWidth: number;
  colsPerBar: number;
  /** SNAP subdiv lines (1/8, 1/16, …) aligned with piano roll / drum grid. */
  snapGrid?: { qpb: number; subdiv: number; bankColOffset: number };
  /** Show VOL strip (AUTOMATION tool selected). */
  showVol?: boolean;
  /** Show PITCH strip (PITCH tool selected). */
  showPitch?: boolean;
  volValues: number[];
  pitchValues: number[];
  activeCol: number;
  volActive: boolean;
  pitchActive: boolean;
  disabled?: boolean;
  onVolPaint: (next: number[]) => void;
  onPitchPaint: (next: number[]) => void;
  onGestureStart?: () => void;
  onGestureEnd?: () => void;
  onSeekCol?: (col: number) => void;
  /** Alt+drag on PITCH lane writes selection for copy/paste. */
  pitchSelectionRef?: React.MutableRefObject<BeatLabPitchAutomationSelection | null>;
};

type LaneKind = 'volume' | 'pitch';

type PaintHud = { x: number; y: number; semi: number; fineCol: number };

function valueFromY(localY: number, laneH: number, kind: LaneKind): number {
  const t = 1 - Math.max(0, Math.min(1, localY / Math.max(1, laneH - 4)));
  if (kind === 'pitch') {
    return Math.max(0, Math.min(127, Math.round(BEAT_LAB_PITCH_AUTOMATION_CENTER + (t - 0.5) * 127)));
  }
  return Math.max(0, Math.min(127, Math.round(t * 127)));
}

function yFromValue(v: number, laneH: number, kind: LaneKind): number {
  const pad = 4;
  const inner = Math.max(1, laneH - pad * 2);
  if (kind === 'pitch') {
    const t = (v - BEAT_LAB_PITCH_AUTOMATION_CENTER) / 127 + 0.5;
    return pad + (1 - Math.max(0, Math.min(1, t))) * inner;
  }
  const t = v / 127;
  return pad + (1 - t) * inner;
}

function fineColFromLocalX(localX: number, gridW: number, automationCols: number): number {
  return Math.max(0, Math.min(automationCols - 1, Math.floor((localX / Math.max(1, gridW)) * automationCols)));
}

const PITCH_SCALE_SEMIS = [-12, -6, 0, 6, 12] as const;

function BeatLabBarAutomationStrip({
  kind,
  label,
  labelColor,
  lineColor,
  values,
  patternCols,
  colWidth,
  labelWidth,
  colsPerBar,
  snapGrid,
  activeCol,
  active,
  disabled,
  onPaint,
  onGestureStart,
  onGestureEnd,
  onSeekCol,
  pitchSelectionRef,
}: {
  kind: LaneKind;
  label: string;
  labelColor: string;
  lineColor: string;
  values: number[];
  patternCols: number;
  colWidth: number;
  labelWidth: number;
  colsPerBar: number;
  snapGrid?: { qpb: number; subdiv: number; bankColOffset: number };
  activeCol: number;
  active: boolean;
  disabled: boolean;
  onPaint: (next: number[]) => void;
  onGestureStart?: () => void;
  onGestureEnd?: () => void;
  onSeekCol?: (col: number) => void;
  pitchSelectionRef?: React.MutableRefObject<BeatLabPitchAutomationSelection | null>;
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  const paintRef = useRef<{ fineCol: number; val: number } | null>(null);
  const selectDragRef = useRef<{ anchor: number } | null>(null);
  const [paintHud, setPaintHud] = useState<PaintHud | null>(null);
  const [selRange, setSelRange] = useState<BeatLabPitchAutomationSelection | null>(null);
  const laneH = BEAT_LAB_AUTOMATION_LANE_H;
  const gridW = patternCols * colWidth;
  const automationCols = beatLabAutomationFineCols(patternCols);
  const tickW = gridW / automationCols;
  const cpb = Math.max(1, colsPerBar);
  const barCount = Math.max(1, Math.ceil(patternCols / cpb));
  const defaultVal = kind === 'pitch' ? BEAT_LAB_PITCH_AUTOMATION_CENTER : BEAT_LAB_VOL_AUTOMATION_DEFAULT;
  const isPitch = kind === 'pitch';

  const syncSelection = useCallback(
    (range: BeatLabPitchAutomationSelection | null) => {
      setSelRange(range);
      if (pitchSelectionRef) pitchSelectionRef.current = range;
    },
    [pitchSelectionRef],
  );

  const applyAt = useCallback(
    (clientX: number, clientY: number, extendLine: boolean, shiftKey: boolean) => {
      const el = stripRef.current;
      if (!el || disabled || !active) return;
      const rect = el.getBoundingClientRect();
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;
      const fineCol = fineColFromLocalX(localX, gridW, automationCols);
      const val = valueFromY(localY, laneH, kind);
      if (isPitch) {
        const semi = beatLabPitchSemiFromAutomation(val);
        setPaintHud({ x: localX, y: localY, semi, fineCol });
      }
      const prev = paintRef.current;
      if (extendLine && shiftKey && prev && prev.fineCol !== fineCol) {
        const lo = Math.min(prev.fineCol, fineCol);
        const hi = Math.max(prev.fineCol, fineCol);
        const next = [...values];
        for (let c = lo; c <= hi; c++) {
          const t = hi === lo ? 0 : (c - lo) / (hi - lo);
          next[c] = Math.round(prev.val + (val - prev.val) * t);
        }
        onPaint(next);
      } else {
        const next = [...values];
        next[fineCol] = val;
        onPaint(next);
      }
      paintRef.current = { fineCol, val };
    },
    [active, automationCols, disabled, gridW, isPitch, kind, laneH, onPaint, values],
  );

  const polylinePoints = useMemo(() => {
    const pts: string[] = [];
    for (let c = 0; c < automationCols; c++) {
      const v = values[c] ?? defaultVal;
      pts.push(`${c * tickW + tickW / 2},${yFromValue(v, laneH, kind)}`);
    }
    return pts.join(' ');
  }, [automationCols, defaultVal, kind, laneH, tickW, values]);

  const centerY = isPitch ? yFromValue(BEAT_LAB_PITCH_AUTOMATION_CENTER, laneH, kind) : null;
  const volBaseY = kind === 'volume' ? yFromValue(BEAT_LAB_VOL_AUTOMATION_DEFAULT, laneH, kind) : null;

  const pitchScaleLabels = useMemo(() => {
    if (!isPitch || !active) return null;
    return PITCH_SCALE_SEMIS.map((semi) => {
      const v = BEAT_LAB_PITCH_AUTOMATION_CENTER + Math.round((semi / 12) * 64);
      const y = yFromValue(v, laneH, 'pitch');
      return { semi, y };
    });
  }, [active, isPitch, laneH]);

  const selectionOverlay =
    isPitch && selRange
      ? {
          left: Math.min(selRange.fineLo, selRange.fineHi) * tickW,
          width: (Math.abs(selRange.fineHi - selRange.fineLo) + 1) * tickW,
        }
      : null;

  return (
    <div
      style={{
        display: 'flex',
        height: laneH,
        flexShrink: 0,
        borderBottom: '1px solid #1a1a22',
        opacity: active ? 1 : 0.72,
      }}
    >
      <div
        style={{
          width: labelWidth,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderRight: '1px solid #303030',
          fontSize: 7,
          fontWeight: 800,
          color: labelColor,
          letterSpacing: 0.5,
          background: '#18181e',
          position: 'relative',
        }}
      >
        <span>{label}</span>
        {isPitch && active && paintHud ? (
          <span
            style={{
              marginTop: 2,
              fontSize: 8,
              fontWeight: 900,
              color: '#e8dcff',
              fontFamily: 'monospace',
            }}
          >
            {beatLabFormatPitchSemi(paintHud.semi)}
          </span>
        ) : null}
      </div>
      <div
        ref={stripRef}
        onPointerDown={(e) => {
          if (disabled || !active) return;
          e.preventDefault();
          const rect = stripRef.current!.getBoundingClientRect();
          const localX = e.clientX - rect.left;
          const fineCol = fineColFromLocalX(localX, gridW, automationCols);
          if (isPitch && e.altKey) {
            selectDragRef.current = { anchor: fineCol };
            syncSelection({ fineLo: fineCol, fineHi: fineCol });
            onSeekCol?.(beatLabPatternColFromFineIndex(fineCol));
            try {
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            } catch {
              /* ignore */
            }
            return;
          }
          onGestureStart?.();
          paintRef.current = null;
          applyAt(e.clientX, e.clientY, false, e.shiftKey);
          onSeekCol?.(beatLabPatternColFromFineIndex(fineCol));
          try {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
        }}
        onPointerMove={(e) => {
          const rect = stripRef.current?.getBoundingClientRect();
          if (!rect) return;
          const localX = e.clientX - rect.left;
          const fineCol = fineColFromLocalX(localX, gridW, automationCols);
          if (selectDragRef.current && isPitch) {
            const anchor = selectDragRef.current.anchor;
            syncSelection({ fineLo: anchor, fineHi: fineCol });
            return;
          }
          if (!paintRef.current) return;
          applyAt(e.clientX, e.clientY, true, e.shiftKey);
        }}
        onPointerUp={() => {
          selectDragRef.current = null;
          paintRef.current = null;
          setPaintHud(null);
          onGestureEnd?.();
        }}
        onPointerCancel={() => {
          selectDragRef.current = null;
          paintRef.current = null;
          setPaintHud(null);
          onGestureEnd?.();
        }}
        title={
          active
            ? isPitch
              ? 'Drag = pitch · Shift+drag = ramp · Alt+drag = select range · Ctrl+C/V copy/paste'
              : `${label}: drag micro-steps · Shift+drag = ramp`
            : undefined
        }
        style={{
          position: 'relative',
          width: gridW,
          height: laneH,
          touchAction: 'none',
          cursor: disabled || !active ? 'default' : 'crosshair',
          background: '#060608',
        }}
      >
        {Array.from({ length: barCount }, (_, bi) => (
          <div
            key={`bar-bg-${bi}`}
            aria-hidden
            style={{
              position: 'absolute',
              left: bi * cpb * colWidth,
              top: 0,
              width: Math.min(cpb * colWidth, gridW - bi * cpb * colWidth),
              height: laneH,
              boxSizing: 'border-box',
              borderLeft: bi === 0 ? '1px solid #3a3a48' : '1px solid #5a5a6a',
              borderRight: '1px solid #2a2a34',
              background: bi % 2 === 0 ? 'rgba(20, 28, 40, 0.55)' : 'rgba(14, 18, 28, 0.45)',
              pointerEvents: 'none',
            }}
          />
        ))}
        {snapGrid ? (
          <BeatLabSnapGridOverlay
            colWidthPx={colWidth}
            qpb={snapGrid.qpb}
            subdiv={snapGrid.subdiv}
            bankColOffset={snapGrid.bankColOffset}
            style={{ zIndex: 1 }}
          />
        ) : null}
        {Array.from({ length: automationCols - 1 }, (_, ti) =>
          (ti + 1) % BEAT_LAB_AUTOMATION_TICKS_PER_COL === 0 ? null : (
            <div
              key={`tick-${ti}`}
              aria-hidden
              style={{
                position: 'absolute',
                left: (ti + 1) * tickW,
                top: 0,
                width: 1,
                height: laneH,
                background: 'rgba(60, 60, 72, 0.35)',
                pointerEvents: 'none',
              }}
            />
          ),
        )}
        {pitchScaleLabels?.map(({ semi, y }) => (
          <div
            key={`scale-${semi}`}
            aria-hidden
            style={{
              position: 'absolute',
              left: 2,
              top: y - 5,
              fontSize: 6,
              fontWeight: 700,
              color: 'rgba(180, 170, 200, 0.55)',
              fontFamily: 'monospace',
              pointerEvents: 'none',
            }}
          >
            {semi > 0 ? `+${semi}` : semi}
          </div>
        ))}
        {centerY != null ? (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              left: 0,
              top: centerY,
              width: gridW,
              height: 1,
              background: 'rgba(120, 120, 140, 0.45)',
              pointerEvents: 'none',
            }}
          />
        ) : null}
        {volBaseY != null ? (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              left: 0,
              top: volBaseY,
              width: gridW,
              height: 1,
              background: 'rgba(160, 140, 90, 0.35)',
              pointerEvents: 'none',
            }}
          />
        ) : null}
        {selectionOverlay ? (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              left: selectionOverlay.left,
              top: 0,
              width: selectionOverlay.width,
              height: laneH,
              background: 'rgba(155, 124, 244, 0.22)',
              border: '1px solid rgba(155, 124, 244, 0.55)',
              pointerEvents: 'none',
              boxSizing: 'border-box',
            }}
          />
        ) : null}
        <svg
          width={gridW}
          height={laneH}
          style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}
        >
          <polyline
            points={polylinePoints}
            fill="none"
            stroke={lineColor}
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity={active ? 0.95 : 0.55}
          />
        </svg>
        {paintHud && isPitch && active ? (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              left: Math.max(4, Math.min(gridW - 52, paintHud.x + 8)),
              top: Math.max(2, Math.min(laneH - 18, paintHud.y - 20)),
              padding: '2px 6px',
              borderRadius: 4,
              background: 'rgba(20, 12, 40, 0.92)',
              border: '1px solid rgba(155, 124, 244, 0.65)',
              fontSize: 9,
              fontWeight: 900,
              color: '#e8dcff',
              fontFamily: 'monospace',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {beatLabFormatPitchSemi(paintHud.semi)}
          </div>
        ) : null}
        {Array.from({ length: patternCols }, (_, col) => {
          const fineIdx = col * BEAT_LAB_AUTOMATION_TICKS_PER_COL;
          const v = values[fineIdx] ?? defaultVal;
          const y = yFromValue(v, laneH, kind);
          const lit = col === activeCol;
          return (
            <div
              key={col}
              aria-hidden
              style={{
                position: 'absolute',
                left: col * colWidth + colWidth / 2 - 2,
                top: y - 2,
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: lit ? '#7cf4c6' : lineColor,
                pointerEvents: 'none',
                opacity: lit ? 1 : 0.5,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

export function BeatLabBarAutomationLanes(props: BeatLabBarAutomationLanesProps) {
  const {
    patternCols,
    colWidth,
    labelWidth,
    colsPerBar,
    snapGrid,
    showVol = false,
    showPitch = false,
    volValues,
    pitchValues,
    activeCol,
    volActive,
    pitchActive,
    disabled = false,
    onVolPaint,
    onPitchPaint,
    onGestureStart,
    onGestureEnd,
    onSeekCol,
    pitchSelectionRef,
  } = props;

  if (!showVol && !showPitch) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        borderBottom: '1px solid #303030',
        background: '#050508',
      }}
    >
      {showVol ? (
        <BeatLabBarAutomationStrip
          kind="volume"
          label="VOL"
          labelColor="#9ec7d4"
          lineColor="#c8a86a"
          values={volValues}
          patternCols={patternCols}
          colWidth={colWidth}
          labelWidth={labelWidth}
          colsPerBar={colsPerBar}
          snapGrid={snapGrid}
          activeCol={activeCol}
          active={volActive && !disabled}
          disabled={disabled}
          onPaint={onVolPaint}
          onGestureStart={onGestureStart}
          onGestureEnd={onGestureEnd}
          onSeekCol={onSeekCol}
        />
      ) : null}
      {showPitch ? (
        <BeatLabBarAutomationStrip
          kind="pitch"
          label="PITCH"
          labelColor="#b8a0e8"
          lineColor="#9b7cf4"
          values={pitchValues}
          patternCols={patternCols}
          colWidth={colWidth}
          labelWidth={labelWidth}
          colsPerBar={colsPerBar}
          snapGrid={snapGrid}
          activeCol={activeCol}
          active={pitchActive && !disabled}
          disabled={disabled}
          onPaint={onPitchPaint}
          onGestureStart={onGestureStart}
          onGestureEnd={onGestureEnd}
          onSeekCol={onSeekCol}
          pitchSelectionRef={pitchSelectionRef}
        />
      ) : null}
    </div>
  );
}
