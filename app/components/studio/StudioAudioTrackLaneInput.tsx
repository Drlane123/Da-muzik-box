'use client';

import type { CSSProperties, RefCallback } from 'react';

import { SE2_TRACK_LANE_METER_H_PX } from '@/app/lib/studio/se2TrackLaneMeterPaint';

const METER_WELL_STYLE: CSSProperties = {
  height: SE2_TRACK_LANE_METER_H_PX,
  background: '#14141c',
  boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.9), inset 0 1px 2px rgba(0,0,0,0.95)',
};

const METER_FILL_STYLE: CSSProperties = {
  width: '0%',
  height: '100%',
  // width is painted imperatively (same pattern as mixer VU height) — do not use scaleX here
};

function LaneMeterWell({
  label,
  fillRef,
}: {
  label: 'L' | 'R';
  fillRef?: RefCallback<HTMLDivElement | null>;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-0.5">
      <span
        className="shrink-0 font-mono font-bold leading-none tabular-nums"
        style={{ width: 7, fontSize: 6, color: label === 'L' ? '#6ec8e8' : '#6ee7b8' }}
        aria-hidden
      >
        {label}
      </span>
      <div className="relative min-w-0 flex-1 overflow-hidden rounded-[2px]" style={METER_WELL_STYLE}>
        <div ref={fillRef} className="absolute left-0 top-0 h-full" style={METER_FILL_STYLE} />
      </div>
    </div>
  );
}

export type StudioAudioTrackLaneInputProps = {
  trackIndex: number;
  trackName: string;
  recordArmed: boolean;
  muted: boolean;
  mono: boolean;
  recording: boolean;
  disabled?: boolean;
  onToggleRecordArm: () => void;
  onSelectTrack: () => void;
  /** Parent paints meters via {@link paintSe2TrackLaneMeterBar} (same loop as mixer channels). */
  shellRef?: RefCallback<HTMLDivElement | null>;
  meterLRef?: RefCallback<HTMLDivElement | null>;
  meterRRef?: RefCallback<HTMLDivElement | null>;
};

/**
 * Audio track row — record arm + horizontal IN meters (painted by SE2 meter loop).
 * Stereo: L | R side-by-side (mixer-style). Mono: single L bar.
 */
export function StudioAudioTrackLaneInput({
  trackName,
  recordArmed,
  muted,
  mono,
  recording,
  disabled = false,
  onToggleRecordArm,
  onSelectTrack,
  shellRef,
  meterLRef,
  meterRRef,
}: StudioAudioTrackLaneInputProps) {
  const recPulse = recordArmed && recording;

  return (
    <div
      ref={shellRef}
      data-studio-audio-track-input
      className="flex w-full min-w-0 items-center gap-1 rounded border px-1 py-0.5"
      style={{
        // border/background painted by paintSe2TrackLaneMeterShell — keep layout-only styles here
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: 'rgba(255,255,255,0.1)',
        background: 'rgba(0,0,0,0.35)',
      }}
      title={`${trackName} — lane input (mic/clips → Vocal DSP → mixer). Arm Rec, allow mic.`}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        disabled={disabled || muted}
        aria-label={
          recordArmed ? `Record-enable off for ${trackName}` : `Record-enable on for ${trackName}`
        }
        aria-pressed={recordArmed}
        title={
          recordArmed
            ? 'Record Enable ON — routes mic into this audio lane'
            : 'Record Enable — arm this audio track for input'
        }
        onClick={() => {
          onSelectTrack();
          onToggleRecordArm();
        }}
        className="flex shrink-0 items-center justify-center outline-none rounded-full disabled:opacity-40"
        style={{
          width: 16,
          height: 16,
          padding: 0,
          border: 'none',
          cursor: disabled || muted ? 'not-allowed' : 'pointer',
        }}
      >
        <span
          className={`rounded-full block ${recPulse ? 'animate-pulse' : ''}`}
          style={{
            width: 10,
            height: 10,
            boxSizing: 'border-box',
            background: recordArmed
              ? 'radial-gradient(circle at 32% 28%, #ff5a52 0%, #c91818 45%, #6a0909 100%)'
              : 'radial-gradient(circle at 32% 28%, #2a1818 0%, #120a0a 85%)',
            border: recordArmed ? '2px solid #ff9a9a' : '2px solid #5e2828',
            boxShadow: recordArmed && recPulse ? '0 0 8px rgba(255,72,72,0.9)' : undefined,
          }}
        />
      </button>

      <div
        className={`flex min-w-0 flex-1 items-center ${mono ? '' : 'gap-1.5'}`}
        aria-label={`Lane input meter ${trackName}${mono ? ' mono' : ' stereo'}`}
      >
        <LaneMeterWell label="L" fillRef={meterLRef} />
        {!mono ? (
          <>
            <div
              className="shrink-0 self-stretch rounded-full"
              style={{
                width: 2,
                minHeight: SE2_TRACK_LANE_METER_H_PX + 2,
                background: 'linear-gradient(180deg, #3a3a48 0%, #1a1a24 50%, #3a3a48 100%)',
                boxShadow: '0 0 0 1px rgba(0,0,0,0.6)',
              }}
              aria-hidden
            />
            <LaneMeterWell label="R" fillRef={meterRRef} />
          </>
        ) : null}
      </div>
    </div>
  );
}
