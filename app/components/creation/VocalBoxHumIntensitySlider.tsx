'use client';

/**
 * Shared Intensity valve — Hard ↔ Open note gate.
 * Notched steps + lit tick lines + click (VocalBox compact & Hum Melody full).
 */
import { useEffect, useId, useRef, useState } from 'react';
import { CircleHelp } from 'lucide-react';

import { clampHumCaptureIntensity } from '@/app/lib/vocalLab/vocalBoxHumCaptureLock';

/** Stepped notches — 1-point clicks for fine Intensity control. */
const INTENSITY_STEP = 1;
const INTENSITY_TICKS = Array.from({ length: 101 }, (_, i) => i);

export const VOCALBOX_DRUM_INTENSITY_HELP = {
  title: 'VocalBox Intensity',
  body: 'Controls how easy mouth-drum hits get into the grid after Rec.\n\nHard (low) = only strong boom / ka hits pass — soft breaths and weak scraps stay out.\n\nOpen (high) = quieter / softer hits can also land on the pads.\n\nDefault 55 is the locked sweet spot. Drag after a take to re-gate without recording again. Independent from Hum Melody Intensity.',
} as const;

export const HUM_MELODY_INTENSITY_HELP = {
  title: 'Hum Melody Intensity',
  body: 'Controls how easy hummed / sung notes get onto the piano roll after Analyze.\n\nHard (low) = only strong, clear melody notes pass — weak ghosts, clicks, and scraps stay out.\n\nOpen (high) = softer / quieter notes can also enter the roll.\n\nDefault 55 is the locked sweet spot. Drag after a take to re-gate without recording again. Independent from VocalBox Intensity.',
} as const;

export type VocalBoxHumIntensitySliderProps = {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  /** full = Hum Melody row · compact = VocalBox Rec strip */
  size?: 'full' | 'compact';
  className?: string;
  /** Override accessible name (e.g. VocalBox drums vs Hum Melody). */
  ariaLabel?: string;
  helpTitle?: string;
  helpBody?: string;
};

function snapIntensity(raw: number): number {
  const v = clampHumCaptureIntensity(raw);
  return Math.round(v / INTENSITY_STEP) * INTENSITY_STEP;
}

/** Tiny UI click when the valve steps to a new notch. */
function playIntensityNotchClick(ctxRef: { current: AudioContext | null }) {
  try {
    const AC =
      typeof window !== 'undefined'
        ? window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        : null;
    if (!AC) return;
    let ctx = ctxRef.current;
    if (!ctx || ctx.state === 'closed') {
      ctx = new AC();
      ctxRef.current = ctx;
    }
    if (ctx.state === 'suspended') void ctx.resume();
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1850, t0);
    osc.frequency.exponentialRampToValueAtTime(920, t0 + 0.018);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.028, t0 + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.028);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.032);
  } catch {
    /* ignore — visual notch still works */
  }
}

export function VocalBoxHumIntensitySlider({
  value,
  onChange,
  disabled = false,
  size = 'full',
  className = '',
  ariaLabel,
  helpTitle,
  helpBody,
}: VocalBoxHumIntensitySliderProps) {
  const compact = size === 'compact';
  const level = snapIntensity(value);
  const clickCtxRef = useRef<AudioContext | null>(null);
  const lastClickLevelRef = useRef(level);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const helpId = useId();

  const resolvedHelpTitle =
    helpTitle ?? (compact ? VOCALBOX_DRUM_INTENSITY_HELP.title : HUM_MELODY_INTENSITY_HELP.title);
  const resolvedHelpBody =
    helpBody ?? (compact ? VOCALBOX_DRUM_INTENSITY_HELP.body : HUM_MELODY_INTENSITY_HELP.body);

  useEffect(() => {
    if (!helpOpen) return;
    const onDoc = (e: MouseEvent) => {
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setHelpOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHelpOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [helpOpen]);

  const handleChange = (raw: number) => {
    const next = snapIntensity(raw);
    if (next !== lastClickLevelRef.current && !disabled) {
      playIntensityNotchClick(clickCtxRef);
      lastClickLevelRef.current = next;
    }
    onChange(next);
  };

  return (
    <div
      ref={rootRef}
      className={`vb-intensity${compact ? ' vb-intensity--compact' : ' vb-intensity--full'}${
        className ? ` ${className}` : ''
      }`}
      style={{ ['--vb-intensity' as string]: `${level}%` }}
    >
      <span className="vb-intensity__label-row">
        <span className="vb-intensity__label">Intensity</span>
        <button
          type="button"
          className={`vb-intensity__help${helpOpen ? ' vb-intensity__help--on' : ''}`}
          aria-label={`${resolvedHelpTitle} help`}
          aria-expanded={helpOpen}
          aria-controls={helpId}
          title="What does Intensity do?"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setHelpOpen((v) => !v);
          }}
        >
          <CircleHelp size={compact ? 11 : 13} strokeWidth={2.4} aria-hidden />
        </button>
        {helpOpen ? (
          <div id={helpId} className="vb-intensity__help-pop" role="dialog" aria-label={resolvedHelpTitle}>
            <strong className="vb-intensity__help-title">{resolvedHelpTitle}</strong>
                <p className="vb-intensity__help-body">
              {resolvedHelpBody.split('\n').map((line, i) =>
                line.trim() === '' ? (
                  <br key={`br-${i}`} />
                ) : (
                  <span key={`ln-${i}`} className="vb-intensity__help-line">
                    {line}
                  </span>
                ),
              )}
            </p>
            <button
              type="button"
              className="vb-intensity__help-close"
              onClick={() => setHelpOpen(false)}
            >
              Got it
            </button>
          </div>
        ) : null}
      </span>
      {!compact ? (
        <span className="vb-intensity__end" aria-hidden>
          Hard
        </span>
      ) : null}
      <span className="vb-intensity__track-wrap">
        <span className="vb-intensity__ticks" aria-hidden>
          {INTENSITY_TICKS.map((tick) => {
            const on = level >= tick;
            const major = tick % 10 === 0;
            const mid = !major && tick % 5 === 0;
            return (
              <i
                key={tick}
                className={`vb-intensity__tick${on ? ' vb-intensity__tick--on' : ''}${
                  major ? ' vb-intensity__tick--major' : ''
                }${mid ? ' vb-intensity__tick--mid' : ''}`}
                style={{ left: `${tick}%` }}
              />
            );
          })}
        </span>
        <input
          type="range"
          min={0}
          max={100}
          step={INTENSITY_STEP}
          value={level}
          disabled={disabled}
          onChange={(e) => handleChange(Number(e.target.value))}
          className="vb-intensity__range"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={level}
          title="Hard = only strong hits · Open = softer hits also enter"
          aria-label={
            ariaLabel ??
            (compact
              ? 'VocalBox drum intensity gate'
              : 'Hum Melody note intensity gate')
          }
        />
      </span>
      {!compact ? (
        <span className="vb-intensity__end" aria-hidden>
          Open
        </span>
      ) : null}
      <span className="vb-intensity__value" aria-hidden>
        {level}
      </span>
    </div>
  );
}
