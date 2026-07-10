/**
 * Groove Lab–style faders: thin track line + lit T-cap (no round browser thumb).
 * Vertical = volume · Horizontal = pan / param sliders.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent, type SyntheticEvent } from 'react';
import {
  mixerFaderFillHeight,
  mixerFaderKnobBottom,
} from '@/app/lib/studio/se2MixerFaderScale';

export const T_CAP_VOL_FADER_CLASS = 't-cap-vol-fader';
export const T_CAP_PAN_FADER_CLASS = 't-cap-pan-fader';
export const GROOVE_MIXER_FADER_RANGE_CLASS = 'groove-mixer-fader-range';

const T_CAP_VOL_KNOB_W = 20;
const T_CAP_VOL_KNOB_H = 8;
const T_CAP_PAN_KNOB_W = 10;
const T_CAP_PAN_KNOB_H = 24;
const T_CAP_PAN_TRACK_H = 6;

/** SE2-style travel insets — scaled for narrow Groove/Beat Lab strips (0…100, not MIDI 127). */
const GL_FADER_INSET_TOP_PX = 6;
const GL_FADER_INSET_BOTTOM_PX = 8;
const GL_FADER_INSET_SUM_PX = GL_FADER_INSET_TOP_PX + GL_FADER_INSET_BOTTOM_PX;
const GL_FADER_KNOB_H_COMPACT_PX = 14;
const GL_FADER_KNOB_H_STD_PX = 18;
const GL_FADER_ARROW_REF_COMPACT_PX = 10;
const GL_FADER_ARROW_REF_STD_PX = 13;

function grooveFaderKnobBottom(vol100: number, arrowRefPx: number): string {
  const t = Math.max(0, Math.min(1, vol100 / 100));
  const pct = t * 100;
  return `calc(${GL_FADER_INSET_BOTTOM_PX - arrowRefPx}px + ${pct.toFixed(5)}% - ${(t * GL_FADER_INSET_SUM_PX).toFixed(5)}px)`;
}

function grooveFaderFillHeight(vol100: number): string {
  const t = Math.max(0, Math.min(1, vol100 / 100));
  const pct = t * 100;
  return `calc(${pct.toFixed(5)}% - ${(t * GL_FADER_INSET_SUM_PX).toFixed(5)}px)`;
}

function clampParam(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function paramPct(v: number, min: number, max: number): number {
  if (max <= min) return 0;
  return (clampParam(v, min, max) - min) / (max - min);
}

/** Ridged grip face — grooves run across the pull direction (matte, low glare). */
function tCapGripCapStyle(
  accent: string,
  orientation: 'horizontal' | 'vertical',
  width: number,
  height: number,
): CSSProperties {
  const ridge =
    orientation === 'horizontal'
      ? `repeating-linear-gradient(90deg, rgba(0,0,0,0.65) 0 1px, rgba(255,255,255,0.22) 1px 2px, ${accent} 2px 3px)`
      : `repeating-linear-gradient(180deg, rgba(0,0,0,0.65) 0 1px, rgba(255,255,255,0.22) 1px 2px, ${accent} 2px 3px)`;
  const base =
    orientation === 'horizontal'
      ? `linear-gradient(180deg, ${accent} 0%, ${accent} 100%)`
      : `linear-gradient(90deg, ${accent} 0%, ${accent} 100%)`;
  return {
    width,
    height,
    borderRadius: 2,
    background: `${ridge}, ${base}`,
    border: `1px solid rgba(0,0,0,0.35)`,
    boxShadow: 'inset 0 -1px 2px rgba(0,0,0,0.4)',
    pointerEvents: 'none',
  };
}

export function GrooveStyleTCapVolumeFaderStyles() {
  return (
    <style>{`
      .${T_CAP_VOL_FADER_CLASS} {
        touch-action: none;
        user-select: none;
      }
      .${T_CAP_VOL_FADER_CLASS}[data-fader-drag='1'] {
        cursor: grabbing;
      }
      .${T_CAP_VOL_FADER_CLASS}[data-fader-drag='0'] {
        cursor: grab;
      }
      .${GROOVE_MIXER_FADER_RANGE_CLASS} {
        -webkit-appearance: none;
        appearance: none;
        background: transparent;
      }
      .${GROOVE_MIXER_FADER_RANGE_CLASS}::-webkit-slider-runnable-track {
        background: transparent;
        border: none;
      }
      .${GROOVE_MIXER_FADER_RANGE_CLASS}::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 48px;
        height: 32px;
        border: none;
        background: transparent;
        box-shadow: none;
        cursor: default;
      }
      .${GROOVE_MIXER_FADER_RANGE_CLASS}::-moz-range-track {
        background: transparent;
        border: none;
      }
      .${GROOVE_MIXER_FADER_RANGE_CLASS}::-moz-range-thumb {
        width: 48px;
        height: 32px;
        border: none;
        background: transparent;
        box-shadow: none;
        cursor: default;
      }
      .${T_CAP_PAN_FADER_CLASS} input[type='range'] {
        -webkit-appearance: none;
        appearance: none;
        background: transparent;
      }
      .${T_CAP_PAN_FADER_CLASS} input[type='range']::-webkit-slider-runnable-track {
        background: transparent;
        border: none;
      }
      .${T_CAP_PAN_FADER_CLASS} input[type='range']::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 28px;
        height: 22px;
        border: none;
        border-radius: 0;
        background: transparent;
        box-shadow: none;
        cursor: ew-resize;
      }
      .${T_CAP_PAN_FADER_CLASS} input[type='range']::-moz-range-track {
        background: transparent;
        border: none;
      }
      .${T_CAP_PAN_FADER_CLASS} input[type='range']::-moz-range-thumb {
        width: 28px;
        height: 22px;
        border: none;
        border-radius: 0;
        background: transparent;
        box-shadow: none;
        cursor: ew-resize;
      }
    `}</style>
  );
}

export type GrooveStyleTCapVolumeFaderProps = {
  channelId: number;
  volume: number;
  accent: string;
  onVolumeChange: (v: number) => void;
  ariaLabel?: string;
  style?: CSSProperties;
  className?: string;
  onClick?: (e: SyntheticEvent) => void;
  onPointerDown?: (e: SyntheticEvent) => void;
  onDragChange?: (dragging: boolean) => void;
  /** Fader top stop (100 = percent embed · 127 = SE2 dB law). */
  volumeMax?: number;
  /** Compact numeric readout above the capsule (embed rail). Popup mixer uses its own row below. */
  showReadout?: boolean;
};

export function GrooveStyleTCapVolumeFader({
  channelId,
  volume,
  accent,
  onVolumeChange,
  ariaLabel,
  style,
  className,
  onClick,
  onPointerDown,
  onDragChange,
  volumeMax = 100,
  showReadout = false,
}: GrooveStyleTCapVolumeFaderProps) {
  const maxVol = Math.max(1, Math.round(volumeMax));
  const useSe2Travel = maxVol === 127;
  const vol = Math.max(0, Math.min(maxVol, Math.round(volume)));
  const stopBubble = (e: SyntheticEvent) => e.stopPropagation();
  const shellRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; startY: number; startVol: number } | null>(null);
  const lastEmitRef = useRef(vol);
  const onVolumeChangeRef = useRef(onVolumeChange);
  onVolumeChangeRef.current = onVolumeChange;
  const [dragging, setDragging] = useState(false);
  const [liveVol, setLiveVol] = useState(vol);
  const shellW = typeof style?.width === 'number' ? style.width : 18;
  const compact = shellW <= 20;
  const knobW = compact ? 18 : 22;
  const knobH = compact ? GL_FADER_KNOB_H_COMPACT_PX : GL_FADER_KNOB_H_STD_PX;
  const arrowRef = compact ? GL_FADER_ARROW_REF_COMPACT_PX : GL_FADER_ARROW_REF_STD_PX;
  const railLeft = '50%';
  const displayVol = dragging ? liveVol : vol;

  const displayKnobBottom = useSe2Travel
    ? mixerFaderKnobBottom(displayVol)
    : grooveFaderKnobBottom(displayVol, arrowRef);
  const displayFillHeight = useSe2Travel
    ? mixerFaderFillHeight(displayVol)
    : grooveFaderFillHeight(displayVol);

  useEffect(() => {
    if (!dragging) {
      setLiveVol(vol);
      lastEmitRef.current = vol;
    }
  }, [vol, dragging]);

  const trackTravelPx = useCallback(() => {
    const el = shellRef.current;
    if (!el) return 72;
    return Math.max(28, el.clientHeight - GL_FADER_INSET_TOP_PX - GL_FADER_INSET_BOTTOM_PX);
  }, []);

  useEffect(() => {
    onDragChange?.(dragging);
  }, [dragging, onDragChange]);

  const emitVolume = useCallback((clientY: number, fine: boolean) => {
    const travel = trackTravelPx();
    const pxPerUnit = Math.max(0.35, travel / maxVol);
    const fineMul = fine ? 0.2 : 1;
    const drag = dragRef.current;
    if (!drag) return;
    const next = Math.max(
      0,
      Math.min(maxVol, Math.round(drag.startVol + ((drag.startY - clientY) / pxPerUnit) * fineMul)),
    );
    setLiveVol(next);
    if (next !== lastEmitRef.current) {
      lastEmitRef.current = next;
      onVolumeChangeRef.current(next);
    }
  }, [trackTravelPx, maxVol]);

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    onPointerDown?.(e);
    if (e.button !== 0) return;
    dragRef.current = { pointerId: e.pointerId, startY: e.clientY, startVol: vol };
    lastEmitRef.current = vol;
    setLiveVol(vol);
    setDragging(true);
    shellRef.current?.setPointerCapture(e.pointerId);
  };

  useEffect(() => {
    if (!dragging) return undefined;
    const onMove = (e: globalThis.PointerEvent) => {
      if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
      e.preventDefault();
      emitVolume(e.clientY, e.shiftKey);
    };
    const onUp = (e: globalThis.PointerEvent) => {
      if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
      dragRef.current = null;
      setDragging(false);
      try {
        shellRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragging, emitVolume]);

  const gripY = compact ? [4, 7, 10] : [5, 9, 13];

  return (
    <div
      ref={shellRef}
      className={[T_CAP_VOL_FADER_CLASS, className].filter(Boolean).join(' ')}
      data-fader-drag={dragging ? '1' : '0'}
      role="slider"
      aria-label={ariaLabel ?? `Channel ${channelId} volume`}
      aria-valuemin={0}
      aria-valuemax={maxVol}
      aria-valuenow={displayVol}
      tabIndex={0}
      title={`CH ${channelId}: ${displayVol}`}
      onClick={onClick ?? stopBubble}
      onPointerDown={handlePointerDown}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
          e.preventDefault();
          onVolumeChange(Math.min(maxVol, vol + (e.shiftKey ? 1 : 5)));
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
          e.preventDefault();
          onVolumeChange(Math.max(0, vol - (e.shiftKey ? 1 : 5)));
        }
      }}
      style={{
        position: 'relative',
        width: 18,
        height: '100%',
        minHeight: 40,
        flexShrink: 0,
        overflow: 'visible',
        contain: 'layout paint',
        paddingLeft: 10,
        paddingRight: 10,
        marginLeft: -10,
        marginRight: -10,
        boxSizing: 'content-box',
        ...style,
      }}
    >
      {/* Rail groove — SE2 dark inset channel */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          width: 3,
          top: GL_FADER_INSET_TOP_PX,
          bottom: GL_FADER_INSET_BOTTOM_PX,
          left: railLeft,
          transform: 'translateX(-50%)',
          background: '#0a0a12',
          borderRadius: 2,
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,1), inset 0 0 0 1px rgba(0,0,0,0.5)',
          pointerEvents: 'none',
        }}
      />
      {/* Level fill — accent strip from bottom to knob arrow */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          width: 3,
          bottom: GL_FADER_INSET_BOTTOM_PX,
          left: railLeft,
          transform: 'translateX(-50%)',
          height: displayFillHeight,
          background: accent,
          opacity: 0.72,
          borderRadius: 2,
          transition: dragging ? 'none' : 'height 0.04s',
          pointerEvents: 'none',
        }}
      />
      {/* Capsule knob + level arrow — SE2 face, scaled to strip width */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          width: knobW,
          height: knobH,
          bottom: displayKnobBottom,
          left: railLeft,
          transform: 'translateX(-50%)',
          zIndex: 2,
          borderRadius: compact ? 3 : 4,
          background:
            'linear-gradient(180deg, #dcdce8 0%, #aaaabc 40%, #8888a0 70%, #606072 100%)',
          boxShadow:
            '0 2px 5px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.65), inset 0 -1px 0 rgba(0,0,0,0.3)',
          transition: dragging ? 'none' : 'bottom 0.04s',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: compact ? -5 : -6,
            top: 2,
            width: 0,
            height: 0,
            borderTop: `${compact ? 2 : 3}px solid transparent`,
            borderBottom: `${compact ? 2 : 3}px solid transparent`,
            borderRight: `${compact ? 5 : 6}px solid ${accent}`,
            filter: dragging ? `drop-shadow(0 0 6px ${accent}cc) drop-shadow(0 0 3px ${accent}88)` : undefined,
          }}
        />
        {gripY.map((y) => (
          <div
            key={y}
            style={{
              position: 'absolute',
              left: compact ? 4 : 5,
              right: compact ? 4 : 5,
              top: y,
              height: 1,
              background: 'rgba(0,0,0,0.35)',
              borderRadius: 1,
            }}
          />
        ))}
      </div>
      {showReadout ? (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: '50%',
            top: 1,
            transform: 'translateX(-50%)',
            fontSize: 7,
            fontWeight: 900,
            fontFamily: 'ui-monospace, SF Mono, monospace',
            color: dragging ? accent : '#9aacbc',
            textShadow: dragging ? `0 0 6px ${accent}66` : undefined,
            lineHeight: 1,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 4,
          }}
        >
          {displayVol}
        </div>
      ) : null}
    </div>
  );
}

export type GrooveStyleTCapParamVerticalFaderProps = {
  min: number;
  max: number;
  step: number;
  value: number;
  accent: string;
  onChange: (v: number) => void;
  ariaLabel?: string;
  height?: number;
  disabled?: boolean;
  style?: CSSProperties;
  className?: string;
};

function snapParamStep(v: number, min: number, max: number, step: number): number {
  const c = clampParam(v, min, max);
  if (!(step > 0)) return c;
  const snapped = Math.round((c - min) / step) * step + min;
  return clampParam(snapped, min, max);
}

/** Generic vertical param fader — SE2 mixer rail + capsule (pointer drag only, no native thumb). */
export function GrooveStyleTCapParamVerticalFader({
  min,
  max,
  step,
  value,
  accent,
  onChange,
  ariaLabel,
  height = 112,
  disabled = false,
  style,
  className,
}: GrooveStyleTCapParamVerticalFaderProps) {
  const clamped = snapParamStep(value, min, max, step);
  const stopBubble = (e: SyntheticEvent) => e.stopPropagation();
  const shellRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; startY: number; startVal: number } | null>(null);
  const lastEmitRef = useRef(clamped);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [dragging, setDragging] = useState(false);
  const [liveVal, setLiveVal] = useState(clamped);

  const displayVal = dragging ? liveVal : clamped;
  const displayVol100 = paramPct(displayVal, min, max) * 100;
  const knobW = 18;
  const knobH = GL_FADER_KNOB_H_COMPACT_PX;
  const arrowRef = GL_FADER_ARROW_REF_COMPACT_PX;
  const railLeft = '50%';
  const displayKnobBottom = grooveFaderKnobBottom(displayVol100, arrowRef);
  const displayFillHeight = grooveFaderFillHeight(displayVol100);
  const gripY = [4, 7, 10];

  useEffect(() => {
    if (!dragging) {
      setLiveVal(clamped);
      lastEmitRef.current = clamped;
    }
  }, [clamped, dragging]);

  const trackTravelPx = useCallback(() => {
    const el = shellRef.current;
    if (!el) return 72;
    return Math.max(28, el.clientHeight - GL_FADER_INSET_TOP_PX - GL_FADER_INSET_BOTTOM_PX);
  }, []);

  const emitValue = useCallback(
    (clientY: number, fine: boolean) => {
      const travel = trackTravelPx();
      const span = Math.max(1e-6, max - min);
      const pxPerUnit = Math.max(0.35, travel / span);
      const fineMul = fine ? 0.2 : 1;
      const drag = dragRef.current;
      if (!drag) return;
      const next = snapParamStep(
        drag.startVal + ((drag.startY - clientY) / pxPerUnit) * fineMul,
        min,
        max,
        step,
      );
      setLiveVal(next);
      if (next !== lastEmitRef.current) {
        lastEmitRef.current = next;
        onChangeRef.current(next);
      }
    },
    [trackTravelPx, min, max, step],
  );

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.button !== 0) return;
    dragRef.current = { pointerId: e.pointerId, startY: e.clientY, startVal: clamped };
    lastEmitRef.current = clamped;
    setLiveVal(clamped);
    setDragging(true);
    shellRef.current?.setPointerCapture(e.pointerId);
  };

  useEffect(() => {
    if (!dragging) return undefined;
    const onMove = (e: globalThis.PointerEvent) => {
      if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
      e.preventDefault();
      emitValue(e.clientY, e.shiftKey);
    };
    const onUp = (e: globalThis.PointerEvent) => {
      if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
      dragRef.current = null;
      setDragging(false);
      try {
        shellRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        /* */
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragging, emitValue]);

  return (
    <div
      ref={shellRef}
      className={[T_CAP_VOL_FADER_CLASS, className].filter(Boolean).join(' ')}
      data-fader-drag={dragging ? '1' : '0'}
      role="slider"
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={displayVal}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onClick={stopBubble}
      onPointerDown={handlePointerDown}
      onKeyDown={(e) => {
        if (disabled) return;
        const delta = step > 0 ? step : (max - min) / 100;
        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
          e.preventDefault();
          onChange(snapParamStep(clamped + delta * (e.shiftKey ? 1 : 4), min, max, step));
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
          e.preventDefault();
          onChange(snapParamStep(clamped - delta * (e.shiftKey ? 1 : 4), min, max, step));
        }
      }}
      style={{
        position: 'relative',
        width: 22,
        height,
        flexShrink: 0,
        overflow: 'visible',
        contain: 'layout paint',
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'not-allowed' : dragging ? 'grabbing' : 'grab',
        paddingLeft: 8,
        paddingRight: 8,
        marginLeft: -8,
        marginRight: -8,
        boxSizing: 'content-box',
        ...style,
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          width: 3,
          top: GL_FADER_INSET_TOP_PX,
          bottom: GL_FADER_INSET_BOTTOM_PX,
          left: railLeft,
          transform: 'translateX(-50%)',
          background: '#0a0a12',
          borderRadius: 2,
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,1), inset 0 0 0 1px rgba(0,0,0,0.5)',
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          width: 3,
          bottom: GL_FADER_INSET_BOTTOM_PX,
          left: railLeft,
          transform: 'translateX(-50%)',
          height: displayFillHeight,
          background: accent,
          opacity: 0.72,
          borderRadius: 2,
          transition: dragging ? 'none' : 'height 0.04s',
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          width: knobW,
          height: knobH,
          bottom: displayKnobBottom,
          left: railLeft,
          transform: 'translateX(-50%)',
          zIndex: 2,
          borderRadius: 3,
          background: 'linear-gradient(180deg, #dcdce8 0%, #aaaabc 40%, #8888a0 70%, #606072 100%)',
          boxShadow:
            '0 2px 5px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.65), inset 0 -1px 0 rgba(0,0,0,0.3)',
          transition: dragging ? 'none' : 'bottom 0.04s',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: -5,
            top: 2,
            width: 0,
            height: 0,
            borderTop: '2px solid transparent',
            borderBottom: '2px solid transparent',
            borderRight: `5px solid ${accent}`,
            filter: dragging ? `drop-shadow(0 0 6px ${accent}cc)` : undefined,
          }}
        />
        {gripY.map((y) => (
          <div
            key={y}
            style={{
              position: 'absolute',
              left: 4,
              right: 4,
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

export type GrooveStyleTCapParamHorizontalFaderProps = {
  min: number;
  max: number;
  step: number;
  value: number;
  accent: string;
  onChange: (v: number) => void;
  ariaLabel?: string;
  disabled?: boolean;
  /** FX suite tube control — narrower cap + track. */
  compact?: boolean;
  style?: CSSProperties;
  className?: string;
};

/** Generic horizontal param slider — same T-cap as mixer pan strips. */
export function GrooveStyleTCapParamHorizontalFader({
  min,
  max,
  step,
  value,
  accent,
  onChange,
  ariaLabel,
  disabled = false,
  compact = false,
  style,
  className,
}: GrooveStyleTCapParamHorizontalFaderProps) {
  const clamped = clampParam(value, min, max);
  const pct = paramPct(clamped, min, max);
  const stopBubble = (e: SyntheticEvent) => e.stopPropagation();
  const trackInset = compact ? 3 : 4;
  const trackSpan = `calc(100% - ${trackInset * 2}px)`;
  const knobW = compact ? 7 : T_CAP_PAN_KNOB_W;
  const knobH = compact ? 13 : T_CAP_PAN_KNOB_H;
  const trackH = compact ? 4 : T_CAP_PAN_TRACK_H;
  const shellH = compact ? 18 : 30;
  const shellRef = useRef<HTMLDivElement>(null);
  const [travelPx, setTravelPx] = useState(48);

  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth - trackInset * 2;
      setTravelPx(Math.max(32, w));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={shellRef}
      className={[T_CAP_PAN_FADER_CLASS, className].filter(Boolean).join(' ')}
      onClick={stopBubble}
      onPointerDown={stopBubble}
      style={{
        position: 'relative',
        width: '100%',
        height: shellH,
        flexShrink: 0,
        overflow: 'visible',
        contain: 'layout paint',
        opacity: disabled ? 0.45 : 1,
        ...style,
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: trackInset,
          right: trackInset,
          top: '50%',
          height: trackH,
          transform: 'translateY(-50%)',
          borderRadius: 2,
          background: [
            'repeating-linear-gradient(180deg, rgba(255,255,255,0.07) 0 1px, transparent 1px 3px)',
            'linear-gradient(180deg, #08080e 0%, #14141c 100%)',
          ].join(', '),
          border: '1px solid rgba(0,0,0,0.55)',
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.65)',
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: trackInset,
          top: '50%',
          height: 2,
          width: `calc(${trackSpan} * ${pct})`,
          transform: 'translateY(-50%)',
          background: accent,
          opacity: 0.75,
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: `calc(${trackInset}px + ${trackSpan} * ${pct})`,
          top: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1,
          ...tCapGripCapStyle(accent, 'vertical', knobW, knobH),
        }}
      />
      <input
        type="range"
        className={GROOVE_MIXER_FADER_RANGE_CLASS}
        min={min}
        max={max}
        step={step}
        value={clamped}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onChange(Number(e.target.value))}
        onClick={stopBubble}
        onPointerDown={stopBubble}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: travelPx,
          height: compact ? 18 : 28,
          margin: 0,
          padding: 0,
          transform: 'translate(-50%, -50%)',
          background: 'transparent',
          cursor: disabled ? 'not-allowed' : 'ew-resize',
          zIndex: 2,
          WebkitAppearance: 'none',
          appearance: 'none',
        }}
      />
    </div>
  );
}

export type GrooveStyleTCapPanFaderProps = {
  channelId: number;
  /** -100 (full L) … 0 (center) … 100 (full R) */
  pan: number;
  accent: string;
  onPanChange: (pan: number) => void;
  ariaLabel?: string;
  style?: CSSProperties;
  className?: string;
};

export function GrooveStyleTCapPanFader({
  channelId,
  pan,
  accent,
  onPanChange,
  ariaLabel,
  style,
  className,
}: GrooveStyleTCapPanFaderProps) {
  const panVal = Math.max(-100, Math.min(100, Math.round(pan)));
  const pct = (panVal + 100) / 200;
  const stopBubble = (e: SyntheticEvent) => e.stopPropagation();
  const trackInset = 4;
  const trackSpan = `calc(100% - ${trackInset * 2}px)`;
  const fillHalf = Math.abs(panVal) / 200;
  const shellRef = useRef<HTMLDivElement>(null);
  const [travelPx, setTravelPx] = useState(48);

  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth - trackInset * 2;
      setTravelPx(Math.max(32, w));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={shellRef}
      className={[T_CAP_PAN_FADER_CLASS, className].filter(Boolean).join(' ')}
      onClick={stopBubble}
      onPointerDown={stopBubble}
      style={{
        position: 'relative',
        width: '100%',
        height: 30,
        flexShrink: 0,
        overflow: 'visible',
        contain: 'layout paint',
        ...style,
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: trackInset,
          right: trackInset,
          top: '50%',
          height: T_CAP_PAN_TRACK_H,
          transform: 'translateY(-50%)',
          borderRadius: 2,
          background: [
            'repeating-linear-gradient(180deg, rgba(255,255,255,0.07) 0 1px, transparent 1px 3px)',
            'linear-gradient(180deg, #08080e 0%, #14141c 100%)',
          ].join(', '),
          border: '1px solid rgba(0,0,0,0.55)',
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.65)',
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: trackInset,
          right: trackInset,
          top: '50%',
          height: 1,
          transform: 'translateY(-50%)',
          background: 'rgba(210, 220, 230, 0.55)',
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 1,
          height: T_CAP_PAN_TRACK_H + 6,
          transform: 'translate(-50%, -50%)',
          background: 'rgba(210, 220, 230, 0.35)',
          pointerEvents: 'none',
        }}
      />
      {panVal !== 0 ? (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: '50%',
            height: 2,
            transform: 'translateY(-50%)',
            left: panVal >= 0 ? '50%' : `calc(50% - ${trackSpan} * ${fillHalf})`,
            width: `calc(${trackSpan} * ${fillHalf})`,
            background: accent,
            opacity: 0.75,
            pointerEvents: 'none',
          }}
        />
      ) : null}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: `calc(${trackInset}px + ${trackSpan} * ${pct})`,
          top: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1,
          ...tCapGripCapStyle(accent, 'vertical', T_CAP_PAN_KNOB_W, T_CAP_PAN_KNOB_H),
        }}
      />
      <input
        type="range"
        min={-100}
        max={100}
        step={1}
        value={panVal}
        aria-label={ariaLabel ?? `Channel ${channelId} pan`}
        onChange={(e) => onPanChange(Number(e.target.value))}
        onClick={stopBubble}
        onPointerDown={stopBubble}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: travelPx,
          height: 28,
          margin: 0,
          padding: 0,
          transform: 'translate(-50%, -50%)',
          background: 'transparent',
          cursor: 'ew-resize',
          zIndex: 2,
        }}
      />
    </div>
  );
}
