'use client';

import { ChevronDown, ChevronUp, CircleHelp } from 'lucide-react';
import { useState } from 'react';

import { studioFxGlassChipStyle } from '@/app/components/studio/studioFxSuiteWidgets';
import {
  studioA2mLaneReady,
  studioExternalMidiLaneOptions,
  studioVocalFxPitchRouteMode,
  studioVocalFxPitchRouteTrackIndex,
  VOCAL_FX_PITCH_ROUTE_GUIDE,
  type StudioVocalFxPitchRouteMode,
} from '@/app/lib/studio/studioVocalFxPitchRoute';
import type { StudioVocoderCarrierTrack } from '@/app/lib/studio/studioVocoderCarrier';

export const VOCODER_MIDI_GUIDE = [
  ...VOCAL_FX_PITCH_ROUTE_GUIDE,
  'Turn Vocoder ON, set pitch route, then play transport.',
  'Tweak WET, ROBOT, FORM, ATK, REL, NOISE, FOCUS, and VIB for character.',
] as const;

export const PITCH_TUNE_MIDI_GUIDE = [
  ...VOCAL_FX_PITCH_ROUTE_GUIDE,
  'Turn Pitch Tune ON, set pitch route, then play transport.',
  'Use RETUNE, SPEED, FLEX, HUMAN, and TRACK to shape the correction.',
] as const;

export function StudioFxMidiGuideDropdown({
  title,
  steps,
  accent,
  disabled,
}: {
  title: string;
  steps: readonly string[];
  accent: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 rounded border px-2 py-1.5 text-left transition-colors disabled:opacity-40"
        style={{
          borderColor: open ? `${accent}66` : '#262632',
          background: open ? `${accent}10` : '#0a0a10',
        }}
      >
        <span className="flex items-center gap-1.5 min-w-0">
          <CircleHelp size={11} strokeWidth={2.2} style={{ color: accent, flexShrink: 0 }} aria-hidden />
          <span className="suite-type-label text-[6px] truncate" style={{ color: open ? accent : '#9a9aaa' }}>
            {title}
          </span>
        </span>
        {open ? (
          <ChevronUp size={11} style={{ color: accent, flexShrink: 0 }} aria-hidden />
        ) : (
          <ChevronDown size={11} style={{ color: '#5a5a68', flexShrink: 0 }} aria-hidden />
        )}
      </button>
      {open ? (
        <ol
          className="mt-1 rounded border px-2 py-1.5 space-y-1 list-decimal list-inside"
          style={{ borderColor: '#222230', background: '#06060c' }}
        >
          {steps.map((step, i) => (
            <li
              key={i}
              className="suite-type-micro text-[5px] leading-snug"
              style={{ color: '#7a7a8a', textTransform: 'none', letterSpacing: '0.02em' }}
            >
              {step}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

/** One-of-three pitch route: audio analysis · A2M this lane · external MIDI channel. */
export function StudioVocalFxPitchRoutePicker({
  label,
  accent,
  audioLabel,
  audioSub,
  midiTrackIndex,
  vocalTrackIndex,
  carrierTracks,
  disabled,
  effectOn,
  onChangeTrackIndex,
}: {
  label: string;
  accent: string;
  audioLabel: string;
  audioSub: string;
  midiTrackIndex: number | null;
  vocalTrackIndex: number;
  carrierTracks: readonly StudioVocoderCarrierTrack[];
  disabled?: boolean;
  effectOn: boolean;
  onChangeTrackIndex: (trackIndex: number | null) => void;
}) {
  const vocalTrack = carrierTracks[vocalTrackIndex];
  const vocalKind = vocalTrack?.kind ?? 'audio';
  const mode = studioVocalFxPitchRouteMode(midiTrackIndex, vocalTrackIndex, vocalKind);
  const a2m = studioA2mLaneReady(vocalTrack);
  const externalLanes = studioExternalMidiLaneOptions(carrierTracks, vocalTrackIndex);
  const off = disabled || !effectOn;

  const setMode = (next: StudioVocalFxPitchRouteMode, externalIdx: number | null = null) => {
    onChangeTrackIndex(studioVocalFxPitchRouteTrackIndex(next, vocalTrackIndex, externalIdx));
  };

  return (
    <div className="mt-2">
      <div className="suite-type-label text-[7px] mb-1" style={{ color: '#6a6a78' }}>
        {label}
      </div>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={off}
          onClick={() => setMode('audio')}
          className="rounded border px-1.5 py-1 text-left transition-colors disabled:opacity-40"
          style={studioFxGlassChipStyle(mode === 'audio', accent)}
        >
          <div className="suite-type-label text-[5px] leading-tight" style={{ color: mode === 'audio' ? accent : '#d0d0e0' }}>
            {audioLabel}
          </div>
          <div className="suite-type-micro text-[4px] leading-snug mt-px" style={{ color: '#5a5a68', textTransform: 'none', letterSpacing: '0.02em' }}>
            {audioSub}
          </div>
        </button>

        {vocalKind === 'a2m' ? (
          <button
            type="button"
            disabled={off || !a2m.ready}
            onClick={() => setMode('a2m_lane')}
            className="rounded border px-1.5 py-1 text-left transition-colors disabled:opacity-40"
            style={studioFxGlassChipStyle(mode === 'a2m_lane', '#FFB84D')}
            title={
              a2m.ready
                ? 'Use MIDI converted from audio on this lane'
                : 'Drop audio on this lane or tap Convert on the track row'
            }
          >
            <div className="suite-type-label text-[5px] leading-tight" style={{ color: mode === 'a2m_lane' ? '#FFB84D' : '#d0d0e0' }}>
              Audio → MIDI (this lane)
            </div>
            <div className="suite-type-micro text-[4px] leading-snug mt-px" style={{ color: '#5a5a68', textTransform: 'none', letterSpacing: '0.02em' }}>
              {a2m.ready
                ? `${a2m.noteCount} converted notes on this lane`
                : 'Drop audio here or tap Convert on the lane row first'}
            </div>
          </button>
        ) : (
          <div
            className="rounded border px-1.5 py-1 opacity-70"
            style={{ borderColor: '#2a2a34', background: '#0a0a0e' }}
          >
            <div className="suite-type-label text-[5px] leading-tight" style={{ color: '#6a6a78' }}>
              Audio → MIDI (this lane)
            </div>
            <div className="suite-type-micro text-[4px] leading-snug mt-px" style={{ color: '#5a5a68', textTransform: 'none', letterSpacing: '0.02em' }}>
              Add an Audio→MIDI lane to convert vocal clips to notes here
            </div>
          </div>
        )}

        <div className="suite-type-micro text-[5px] px-0.5 pt-0.5" style={{ color: '#5a5a68', textTransform: 'none', letterSpacing: '0.03em' }}>
          — or MIDI from another channel —
        </div>

        {externalLanes.length === 0 ? (
          <div className="suite-type-micro text-[5px] px-1 py-1" style={{ color: '#5a5a68', textTransform: 'none', letterSpacing: '0.03em' }}>
            Add notes on a separate MIDI / rhythm lane to route pitch in
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {externalLanes.map((lane) => {
              const on = mode === 'midi_lane' && midiTrackIndex === lane.trackIndex;
              const laneAccent = on ? accent : '#8a8a9a';
              return (
                <button
                  key={lane.trackIndex}
                  type="button"
                  disabled={off}
                  onClick={() => setMode('midi_lane', lane.trackIndex)}
                  className="rounded border px-2 py-1.5 text-left transition-colors disabled:opacity-40"
                  style={studioFxGlassChipStyle(on, laneAccent)}
                >
                  <div className="suite-type-label text-[5px] leading-tight" style={{ color: on ? laneAccent : '#d0d0e0' }}>
                    CH {lane.channel} · {lane.name}
                  </div>
                  <div className="suite-type-micro text-[4px] leading-snug mt-px" style={{ color: '#5a5a68', textTransform: 'none', letterSpacing: '0.02em' }}>
                    {lane.noteCount} notes
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
