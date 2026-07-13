'use client';

import type { CSSProperties, PointerEvent } from 'react';
import {
  SE2_LAB808_PERC_STEPS_PER_BAR,
  normalizeSe2Lab808PercPattern,
  se2Lab808PercToggleStep,
  se2Lab808PercTwoAndFourPattern,
  type Se2Lab808PercLane,
} from '@/app/lib/studio/se2Lab808PercPattern';
import { previewSe2Lab808Perc } from '@/app/lib/studio/se2Lab808PercVoice';
import type { Se2Lab808VoiceParams } from '@/app/lib/studio/se2Lab808Types';

export type Se2Lab808PercStripProps = {
  voice: Se2Lab808VoiceParams;
  accent: string;
  disabled?: boolean;
  getAudioContext: () => AudioContext;
  getPreviewDestination: (ctx: AudioContext) => AudioNode;
  onVoiceChange: (voice: Se2Lab808VoiceParams) => void;
};

const labelBtn = (active: boolean, color: string): CSSProperties => ({
  width: 44,
  minHeight: 22,
  padding: '0 6px',
  borderRadius: 5,
  border: `1px solid ${active ? `${color}aa` : '#444450'}`,
  background: active ? `${color}28` : 'rgba(255,255,255,0.04)',
  color: active ? color : '#c8c8d4',
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  lineHeight: 1,
});

const cellBtn = (on: boolean, color: string, beatMark: boolean): CSSProperties => ({
  width: 18,
  height: 18,
  padding: 0,
  borderRadius: 4,
  border: `1px solid ${on ? `${color}ee` : beatMark ? '#4a4a58' : '#333340'}`,
  background: on ? color : beatMark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
  boxShadow: on ? `0 0 8px ${color}88` : undefined,
  cursor: 'pointer',
  flexShrink: 0,
});

export function Se2Lab808PercStrip({
  voice,
  accent,
  disabled = false,
  getAudioContext,
  getPreviewDestination,
  onVoiceChange,
}: Se2Lab808PercStripProps) {
  const pattern = normalizeSe2Lab808PercPattern(voice.percSnareSteps, voice.percClapSteps);
  const snareColor = '#f0a060';
  const clapColor = '#e878a0';

  const preview = (lane: Se2Lab808PercLane) => {
    if (disabled) return;
    const ctx = getAudioContext();
    previewSe2Lab808Perc(ctx, getPreviewDestination(ctx), lane, voice.percLevel * voice.output);
  };

  const toggle = (lane: Se2Lab808PercLane, step: number, e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (disabled) return;
    const next = se2Lab808PercToggleStep(pattern, lane, step);
    onVoiceChange({
      ...voice,
      percSnareSteps: next.snare,
      percClapSteps: next.clap,
    });
    const turnedOn = lane === 'snare' ? next.snare[step] : next.clap[step];
    if (turnedOn) preview(lane);
  };

  const applyTwoAndFour = (lane: Se2Lab808PercLane) => {
    if (disabled) return;
    const preset = se2Lab808PercTwoAndFourPattern();
    if (lane === 'snare') {
      onVoiceChange({ ...voice, percSnareSteps: preset.snare });
    } else {
      onVoiceChange({ ...voice, percClapSteps: preset.snare }); // same 2&4 indices
    }
    preview(lane);
  };

  const clearLane = (lane: Se2Lab808PercLane) => {
    if (disabled) return;
    if (lane === 'snare') onVoiceChange({ ...voice, percSnareSteps: pattern.snare.map(() => false) });
    else onVoiceChange({ ...voice, percClapSteps: pattern.clap.map(() => false) });
  };

  const row = (lane: Se2Lab808PercLane, steps: boolean[], color: string, title: string) => (
    <div className="flex items-center gap-1 min-w-0" key={lane}>
      <button
        type="button"
        disabled={disabled}
        style={labelBtn(steps.some(Boolean), color)}
        onClick={() => preview(lane)}
        title={`Preview ${title}`}
      >
        {title}
      </button>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: SE2_LAB808_PERC_STEPS_PER_BAR }, (_, step) => {
          const beatMark = step % 4 === 0;
          return (
            <button
              key={`${lane}-${step}`}
              type="button"
              disabled={disabled}
              style={cellBtn(!!steps[step], color, beatMark)}
              onPointerDown={(e) => toggle(lane, step, e)}
              title={`${title} · step ${step + 1}${beatMark ? ` (beat ${(step / 4) + 1})` : ''}`}
              aria-pressed={!!steps[step]}
            />
          );
        })}
      </div>
      <button
        type="button"
        disabled={disabled}
        className="rounded border px-1 text-[7px] font-bold uppercase shrink-0"
        style={{ borderColor: '#333340', color: '#8a8a98', minHeight: 18 }}
        onClick={() => applyTwoAndFour(lane)}
        title={`Place ${title} on beats 2 & 4`}
      >
        2&4
      </button>
      <button
        type="button"
        disabled={disabled || !steps.some(Boolean)}
        className="rounded border px-1 text-[7px] font-bold uppercase shrink-0"
        style={{
          borderColor: '#333340',
          color: steps.some(Boolean) ? '#9a9aac' : '#555560',
          minHeight: 18,
          opacity: steps.some(Boolean) ? 1 : 0.45,
        }}
        onClick={() => clearLane(lane)}
        title={`Clear ${title}`}
      >
        Clr
      </button>
    </div>
  );

  return (
    <div
      className="flex flex-col gap-1 min-w-0 rounded-md border px-2 py-1.5"
      style={{
        borderColor: `${accent}aa`,
        background: 'linear-gradient(180deg, rgba(232,120,74,0.14) 0%, rgba(0,0,0,0.35) 100%)',
        boxShadow: `inset 0 0 0 1px ${accent}33, 0 0 14px ${accent}22`,
      }}
      aria-label="808 Lab snare and clap 1-bar loop"
      data-se2-lab808-perc-strip
    >
      <div className="flex items-center justify-between gap-2 min-w-0">
        <span className="text-[9px] font-black uppercase tracking-wide" style={{ color: accent }}>
          Snare / Clap · timing only
        </span>
        <span className="text-[7px] font-semibold" style={{ color: '#9a9aac' }}>
          1-bar loop · not in MIDI/WAV/To roll export · 2&amp;4 backbeat
        </span>
      </div>
      {row('snare', pattern.snare, snareColor, 'Snare')}
      {row('clap', pattern.clap, clapColor, 'Clap')}
    </div>
  );
}
