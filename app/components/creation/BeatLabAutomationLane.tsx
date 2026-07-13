/**
 * FL-style volume automation strip under the piano roll — draw level per pattern column.
 */
import React, { useCallback, useRef } from 'react';
import { BEAT_LAB_AUTOMATION_LANE_H } from '../../lib/creationStation/beatLabAutomation';

export type BeatLabAutomationLaneProps = {
  patternCols: number;
  colWidth: number;
  labelWidth: number;
  values: number[];
  activeCol: number;
  disabled?: boolean;
  onPaint: (next: number[]) => void;
  onSeekCol?: (col: number) => void;
};

function valueFromPointerY(localY: number, laneH: number): number {
  const t = 1 - Math.max(0, Math.min(1, localY / Math.max(1, laneH - 2)));
  return Math.max(0, Math.min(127, Math.round(t * 127)));
}

export function BeatLabAutomationLane({
  patternCols,
  colWidth,
  labelWidth,
  values,
  activeCol,
  disabled = false,
  onPaint,
  onSeekCol,
}: BeatLabAutomationLaneProps) {
  const laneRef = useRef<HTMLDivElement>(null);
  const paintRef = useRef<{ col: number; val: number } | null>(null);

  const applyAt = useCallback(
    (clientX: number, clientY: number, extendLine: boolean) => {
      const el = laneRef.current;
      if (!el || disabled) return;
      const rect = el.getBoundingClientRect();
      const localX = clientX - rect.left - labelWidth;
      const localY = clientY - rect.top;
      const col = Math.max(0, Math.min(patternCols - 1, Math.floor(localX / colWidth)));
      const val = valueFromPointerY(localY, BEAT_LAB_AUTOMATION_LANE_H);
      const prev = paintRef.current;
      if (extendLine && prev && prev.col !== col) {
        const lo = Math.min(prev.col, col);
        const hi = Math.max(prev.col, col);
        const next = [...values];
        for (let c = lo; c <= hi; c++) {
          const t = hi === lo ? 0 : (c - lo) / (hi - lo);
          next[c] = Math.round(prev.val + (val - prev.val) * t);
        }
        onPaint(next);
      } else {
        const next = [...values];
        next[col] = val;
        onPaint(next);
      }
      paintRef.current = { col, val };
    },
    [colWidth, disabled, labelWidth, onPaint, patternCols, values],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    paintRef.current = null;
    applyAt(e.clientX, e.clientY, false);
    onSeekCol?.(
      Math.max(
        0,
        Math.min(
          patternCols - 1,
          Math.floor((e.clientX - (laneRef.current?.getBoundingClientRect().left ?? 0) - labelWidth) / colWidth),
        ),
      ),
    );
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (disabled || !paintRef.current) return;
    applyAt(e.clientX, e.clientY, true);
  };

  const onPointerUp = () => {
    paintRef.current = null;
  };

  const gridW = patternCols * colWidth;

  return (
    <div
      ref={laneRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        display: 'flex',
        height: BEAT_LAB_AUTOMATION_LANE_H,
        flexShrink: 0,
        borderBottom: '1px solid #303030',
        background: '#060608',
        touchAction: 'none',
        cursor: disabled ? 'default' : 'crosshair',
      }}
      title="Volume automation — drag to draw level per step (FL event lane). Combines with note velocity."
    >
      <div
        style={{
          width: labelWidth,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRight: '1px solid #303030',
          fontSize: 7,
          fontWeight: 800,
          color: '#9ec7d4',
          letterSpacing: 0.4,
          background: '#18181e',
        }}
      >
        VOL
      </div>
      <div style={{ position: 'relative', width: gridW, height: BEAT_LAB_AUTOMATION_LANE_H }}>
        {Array.from({ length: patternCols }, (_, col) => {
          const v = values[col] ?? 127;
          const h = Math.max(2, (v / 127) * (BEAT_LAB_AUTOMATION_LANE_H - 6));
          const lit = col === activeCol;
          return (
            <div
              key={col}
              style={{
                position: 'absolute',
                left: col * colWidth + 1,
                bottom: 3,
                width: Math.max(2, colWidth - 2),
                height: h,
                borderRadius: 2,
                background: lit
                  ? 'linear-gradient(180deg, #7cf4c6 0%, #3a9a78 100%)'
                  : 'linear-gradient(180deg, #c8a86a 0%, #6a5030 100%)',
                opacity: v < 4 ? 0.25 : 0.85,
                pointerEvents: 'none',
                boxShadow: lit ? '0 0 6px rgba(124,244,198,0.35)' : undefined,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

