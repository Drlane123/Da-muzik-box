/**
 * Groove Lab–style faders: thin track line + lit T-cap (no round browser thumb).
 * Vertical = volume · Horizontal = pan / param sliders.
 */
import { useEffect, useRef, useState, type CSSProperties, type SyntheticEvent } from 'react';

export const T_CAP_VOL_FADER_CLASS = 't-cap-vol-fader';
export const T_CAP_PAN_FADER_CLASS = 't-cap-pan-fader';

const T_CAP_VOL_KNOB_W = 20;
const T_CAP_VOL_KNOB_H = 8;
const T_CAP_PAN_KNOB_W = 10;
const T_CAP_PAN_KNOB_H = 24;
const T_CAP_PAN_TRACK_H = 6;

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
      .${T_CAP_VOL_FADER_CLASS} input[type='range'] {
        -webkit-appearance: none;
        appearance: none;
        background: transparent;
      }
      .${T_CAP_VOL_FADER_CLASS} input[type='range']::-webkit-slider-runnable-track {
        background: transparent;
        border: none;
      }
      .${T_CAP_VOL_FADER_CLASS} input[type='range']::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 22px;
        height: 28px;
        border: none;
        border-radius: 0;
        background: transparent;
        box-shadow: none;
        cursor: ns-resize;
      }
      .${T_CAP_VOL_FADER_CLASS} input[type='range']::-moz-range-track {
        background: transparent;
        border: none;
      }
      .${T_CAP_VOL_FADER_CLASS} input[type='range']::-moz-range-thumb {
        width: 22px;
        height: 28px;
        border: none;
        border-radius: 0;
        background: transparent;
        box-shadow: none;
        cursor: ns-resize;
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
}: GrooveStyleTCapVolumeFaderProps) {
  const vol = Math.max(0, Math.min(100, Math.round(volume)));
  const pct = vol / 100;
  const stopBubble = (e: SyntheticEvent) => e.stopPropagation();
  const trackInset = 2;
  const trackSpan = `calc(100% - ${trackInset * 2}px)`;
  const shellRef = useRef<HTMLDivElement>(null);
  const [travelPx, setTravelPx] = useState(36);

  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    const measure = () => {
      const h = el.clientHeight - trackInset * 2;
      setTravelPx(Math.max(24, h));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={shellRef}
      className={[T_CAP_VOL_FADER_CLASS, className].filter(Boolean).join(' ')}
      onClick={onClick ?? stopBubble}
      onPointerDown={onPointerDown ?? stopBubble}
      style={{
        position: 'relative',
        width: 18,
        height: '100%',
        minHeight: 40,
        flexShrink: 0,
        overflow: 'hidden',
        contain: 'layout paint',
        ...style,
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: '50%',
          top: trackInset,
          bottom: trackInset,
          width: 1,
          transform: 'translateX(-50%)',
          background: 'rgba(210, 220, 230, 0.72)',
          boxShadow: '0 0 0 0.5px rgba(0,0,0,0.45)',
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: '50%',
          bottom: trackInset,
          width: 1,
          height: `calc(${trackSpan} * ${pct})`,
          transform: 'translateX(-50%)',
          background: `${accent}88`,
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: '50%',
          bottom: `calc(${trackInset}px + ${trackSpan} * ${pct})`,
          transform: 'translate(-50%, 50%)',
          ...tCapGripCapStyle(accent, 'horizontal', T_CAP_VOL_KNOB_W, T_CAP_VOL_KNOB_H),
        }}
      />
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={vol}
        aria-label={ariaLabel ?? `Channel ${channelId} volume`}
        onChange={(e) => onVolumeChange(Number(e.target.value))}
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
          transform: 'translate(-50%, -50%) rotate(-90deg)',
          background: 'transparent',
          cursor: 'ns-resize',
          zIndex: 2,
        }}
      />
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

/** Generic vertical param fader — same T-cap as mixer volume strips. */
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
  const clamped = clampParam(value, min, max);
  const pct = paramPct(clamped, min, max);
  const stopBubble = (e: SyntheticEvent) => e.stopPropagation();
  const trackInset = 2;
  const trackSpan = `calc(100% - ${trackInset * 2}px)`;
  const shellRef = useRef<HTMLDivElement>(null);
  const [travelPx, setTravelPx] = useState(Math.max(24, height - trackInset * 2));

  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    const measure = () => {
      const h = el.clientHeight - trackInset * 2;
      setTravelPx(Math.max(24, h));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={shellRef}
      className={[T_CAP_VOL_FADER_CLASS, className].filter(Boolean).join(' ')}
      onClick={stopBubble}
      onPointerDown={stopBubble}
      style={{
        position: 'relative',
        width: 22,
        height,
        flexShrink: 0,
        overflow: 'hidden',
        contain: 'layout paint',
        opacity: disabled ? 0.45 : 1,
        ...style,
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: '50%',
          top: trackInset,
          bottom: trackInset,
          width: 1,
          transform: 'translateX(-50%)',
          background: 'rgba(210, 220, 230, 0.72)',
          boxShadow: '0 0 0 0.5px rgba(0,0,0,0.45)',
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: '50%',
          bottom: trackInset,
          width: 1,
          height: `calc(${trackSpan} * ${pct})`,
          transform: 'translateX(-50%)',
          background: `${accent}88`,
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: '50%',
          bottom: `calc(${trackInset}px + ${trackSpan} * ${pct})`,
          transform: 'translate(-50%, 50%)',
          ...tCapGripCapStyle(accent, 'horizontal', T_CAP_VOL_KNOB_W, T_CAP_VOL_KNOB_H),
        }}
      />
      <input
        type="range"
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
          height: 28,
          margin: 0,
          padding: 0,
          transform: 'translate(-50%, -50%) rotate(-90deg)',
          background: 'transparent',
          cursor: disabled ? 'not-allowed' : 'ns-resize',
          zIndex: 2,
        }}
      />
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
  style,
  className,
}: GrooveStyleTCapParamHorizontalFaderProps) {
  const clamped = clampParam(value, min, max);
  const pct = paramPct(clamped, min, max);
  const stopBubble = (e: SyntheticEvent) => e.stopPropagation();
  const trackInset = 4;
  const trackSpan = `calc(100% - ${trackInset * 2}px)`;
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
          ...tCapGripCapStyle(accent, 'vertical', T_CAP_PAN_KNOB_W, T_CAP_PAN_KNOB_H),
        }}
      />
      <input
        type="range"
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
          height: 28,
          margin: 0,
          padding: 0,
          transform: 'translate(-50%, -50%)',
          background: 'transparent',
          cursor: disabled ? 'not-allowed' : 'ew-resize',
          zIndex: 2,
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
