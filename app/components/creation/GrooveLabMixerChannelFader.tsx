/**
 * Groove Lab popup mixer fader — SE2 printed dB scale, relative drag + track tap.
 */
import { useCallback, useEffect, useRef, useState, type PointerEvent, type SyntheticEvent } from 'react';
import {
  MIXER_DB_SCALE_EDGE_LEFT_PX,
  MIXER_DB_SCALE_EDGE_RIGHT,
  MIXER_FADER_DB_TICKS,
  MIXER_FADER_INSET_BOTTOM_PX,
  MIXER_FADER_INSET_TOP_PX,
  MIXER_FADER_KNOB_H_PX,
  MIXER_FADER_RAIL_LEFT,
  mixerFaderFillHeight,
  mixerFaderKnobBottom,
  mixerFaderTravelBottom,
  snapMixerFaderVol127,
} from '@/app/lib/studio/se2MixerFaderScale';

export type GrooveLabMixerChannelFaderProps = {
  channelId: number;
  volume127: number;
  accent: string;
  onVolumeChange: (vol127: number) => void;
  onDragChange?: (dragging: boolean) => void;
  height?: number;
};

const MAX_VOL = 127;
const TRACK_TAP_PX = 6;

function volFromClientY(shell: HTMLDivElement, clientY: number, fallbackVol: number): number {
  const rect = shell.getBoundingClientRect();
  const railBottom = rect.bottom - MIXER_FADER_INSET_BOTTOM_PX;
  const railTop = rect.top + MIXER_FADER_INSET_TOP_PX;
  const usable = Math.max(1, railBottom - railTop);
  const y = Math.max(railTop, Math.min(railBottom, clientY));
  const t = (railBottom - y) / usable;
  if (!Number.isFinite(t)) return fallbackVol;
  return Math.max(0, Math.min(MAX_VOL, Math.round(t * MAX_VOL)));
}

export function GrooveLabMixerChannelFader({
  channelId,
  volume127,
  accent,
  onVolumeChange,
  onDragChange,
  height = 140,
}: GrooveLabMixerChannelFaderProps) {
  const vol = Math.max(0, Math.min(MAX_VOL, Math.round(volume127)));
  const shellRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startY: number;
    startVol: number;
    moved: boolean;
  } | null>(null);
  const liveVolRef = useRef(vol);
  const onVolumeChangeRef = useRef(onVolumeChange);
  onVolumeChangeRef.current = onVolumeChange;
  const [dragging, setDragging] = useState(false);
  const [liveVol, setLiveVol] = useState(vol);
  const displayVol = dragging ? liveVol : vol;

  useEffect(() => {
    if (!dragging) {
      liveVolRef.current = vol;
      setLiveVol(vol);
    }
  }, [vol, dragging]);

  useEffect(() => {
    onDragChange?.(dragging);
  }, [dragging, onDragChange]);

  const trackTravelPx = useCallback(() => {
    const el = shellRef.current;
    if (!el) return Math.max(40, height - MIXER_FADER_INSET_TOP_PX - MIXER_FADER_INSET_BOTTOM_PX);
    return Math.max(40, el.clientHeight - MIXER_FADER_INSET_TOP_PX - MIXER_FADER_INSET_BOTTOM_PX);
  }, [height]);

  const finishDrag = useCallback((pointerId: number, clientY: number) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== pointerId) return;

    let finalVol = liveVolRef.current;
    if (!drag.moved) {
      const el = shellRef.current;
      if (el) finalVol = volFromClientY(el, clientY, drag.startVol);
    }
    finalVol = snapMixerFaderVol127(finalVol);
    liveVolRef.current = finalVol;
    setLiveVol(finalVol);
    onVolumeChangeRef.current(finalVol);

    dragRef.current = null;
    setDragging(false);
    try {
      shellRef.current?.releasePointerCapture(pointerId);
    } catch {
      /* already released */
    }
  }, []);

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.button !== 0) return;

    dragRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      startVol: vol,
      moved: false,
    };
    liveVolRef.current = vol;
    setLiveVol(vol);
    setDragging(true);
    try {
      shellRef.current?.setPointerCapture(e.pointerId);
    } catch {
      /* capture unavailable */
    }
  };

  useEffect(() => {
    if (!dragging) return undefined;

    const onMove = (e: globalThis.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      e.preventDefault();

      if (Math.abs(e.clientY - drag.startY) > TRACK_TAP_PX) drag.moved = true;

      const travel = trackTravelPx();
      const pxPerUnit = Math.max(0.35, travel / MAX_VOL);
      const fineMul = e.shiftKey ? 0.2 : 1;
      const next = Math.max(
        0,
        Math.min(
          MAX_VOL,
          Math.round(drag.startVol + ((drag.startY - e.clientY) / pxPerUnit) * fineMul),
        ),
      );
      liveVolRef.current = next;
      setLiveVol(next);
    };

    const onUp = (e: globalThis.PointerEvent) => {
      finishDrag(e.pointerId, e.clientY);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragging, trackTravelPx, finishDrag]);

  const stopBubble = (e: SyntheticEvent) => e.stopPropagation();

  return (
    <div
      ref={shellRef}
      role="slider"
      aria-label={`Channel ${channelId} volume`}
      aria-valuemin={0}
      aria-valuemax={MAX_VOL}
      aria-valuenow={displayVol}
      tabIndex={0}
      title={`CH ${channelId}: ${displayVol}`}
      onClick={stopBubble}
      onPointerDown={handlePointerDown}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
          e.preventDefault();
          onVolumeChange(Math.min(MAX_VOL, vol + (e.shiftKey ? 1 : 5)));
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
          e.preventDefault();
          onVolumeChange(Math.max(0, vol - (e.shiftKey ? 1 : 5)));
        }
      }}
      style={{
        position: 'relative',
        flex: 1,
        minWidth: 0,
        height: '100%',
        minHeight: height - 12,
        touchAction: 'none',
        userSelect: 'none',
        cursor: 'default',
        paddingLeft: 8,
        paddingRight: 2,
        overflow: 'visible',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          width: 3,
          top: MIXER_FADER_INSET_TOP_PX,
          bottom: MIXER_FADER_INSET_BOTTOM_PX,
          left: MIXER_FADER_RAIL_LEFT,
          transform: 'translateX(-50%)',
          background: '#0a0a12',
          borderRadius: 2,
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1), inset 0 0 0 1px rgba(0,0,0,0.5)',
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          width: 3,
          bottom: MIXER_FADER_INSET_BOTTOM_PX,
          left: MIXER_FADER_RAIL_LEFT,
          transform: 'translateX(-50%)',
          height: mixerFaderFillHeight(displayVol),
          background: `linear-gradient(to top, ${accent}cc 0%, ${accent} 55%, ${accent}ee 100%)`,
          opacity: dragging ? 1 : 0.88,
          borderRadius: 2,
          boxShadow: dragging
            ? `0 0 12px ${accent}cc, 0 0 4px ${accent}88`
            : `0 0 8px ${accent}66, 0 0 2px ${accent}44`,
          transition: dragging ? 'none' : 'height 0.04s, box-shadow 0.08s',
          pointerEvents: 'none',
        }}
      />
      {MIXER_FADER_DB_TICKS.map(({ label, vol: tickVol }) => {
        const btm = mixerFaderTravelBottom(tickVol);
        const isZero = label === '0';
        const isFloor60 = label === '-60';
        return (
          <div
            key={`${channelId}-${tickVol}-${label}`}
            aria-hidden
            style={{
              position: 'absolute',
              bottom: btm,
              left: MIXER_DB_SCALE_EDGE_LEFT_PX,
              right: MIXER_DB_SCALE_EDGE_RIGHT,
              transform: 'translateY(50%)',
              zIndex: 3,
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'flex-end',
              pointerEvents: 'none',
            }}
          >
            <span
              style={{
                fontSize: 9,
                fontFamily: 'ui-monospace, SF Mono, monospace',
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                marginRight: 5,
                display: 'inline-block',
                textAlign: 'right',
                minWidth: '3ch',
                color: isZero ? '#f0f0ff' : isFloor60 ? '#f4f4ff' : '#d8d8ee',
                fontWeight: isZero ? 800 : isFloor60 ? 700 : 600,
                textShadow: '0 1px 2px rgba(0,0,0,0.95)',
                letterSpacing: isZero ? 0 : '0.02em',
                ...(isFloor60
                  ? {
                      background: 'rgba(16,16,24,0.97)',
                      padding: '1px 3px',
                      borderRadius: 2,
                      boxShadow: '0 0 0 1px rgba(255,255,255,0.06)',
                    }
                  : {}),
              }}
            >
              {label}
            </span>
            <div
              style={{
                width: isZero ? 8 : 5,
                height: isZero ? 2 : 1,
                flexShrink: 0,
                background: isZero ? '#d8d8f0' : '#9898b8',
                boxShadow: isZero ? '0 0 3px rgba(220,220,248,0.35)' : 'none',
                borderRadius: 0.5,
              }}
            />
          </div>
        );
      })}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          width: 24,
          height: MIXER_FADER_KNOB_H_PX,
          bottom: mixerFaderKnobBottom(displayVol),
          left: MIXER_FADER_RAIL_LEFT,
          transform: 'translateX(-50%)',
          zIndex: 4,
          borderRadius: 4,
          background:
            'linear-gradient(180deg, #dcdce8 0%, #aaaabc 40%, #8888a0 70%, #606072 100%)',
          boxShadow:
            '0 3px 7px rgba(0,0,0,0.95), inset 0 1px 0 rgba(255,255,255,0.65), inset 0 -1px 0 rgba(0,0,0,0.3)',
          transition: dragging ? 'none' : 'bottom 0.04s',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: -6,
            top: 2,
            width: 0,
            height: 0,
            borderTop: '3px solid transparent',
            borderBottom: '3px solid transparent',
            borderRight: `6px solid ${accent}`,
            filter: dragging
              ? `drop-shadow(0 0 10px ${accent}ee) drop-shadow(0 0 5px ${accent}aa)`
              : `drop-shadow(0 0 5px ${accent}77)`,
          }}
        />
        {[5, 9, 13].map((y) => (
          <div
            key={y}
            style={{
              position: 'absolute',
              left: 5,
              right: 5,
              top: y,
              height: 1,
              background: 'rgba(0,0,0,0.35)',
              borderRadius: 1,
            }}
          />
        ))}
      </div>
    </div>
  );
}
