'use client';

import { ChevronDown, CircleHelp } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { studioFxGlassChipStyle, SuiteFader } from '@/app/components/studio/studioFxSuiteWidgets';
import {
  StudioCompactFxTrigger,
  StudioFxPopoverMenu,
  useStudioFxPopover,
} from '@/app/components/studio/studioVocalFxPopoverWidgets';
import { PITCH_TUNE_MIDI_GUIDE } from '@/app/components/studio/StudioVocalFxMidiWidgets';
import {
  STUDIO_AUTOTUNE_PRESETS,
  studioAutotunePresetById,
  type StudioAutotunePresetId,
} from '@/app/lib/studio/studioAutotunePresets';
import {
  PITCH_TUNE_SCALE_OPTIONS,
  pitchTuneScaleLabel,
  type PitchTuneScaleId,
} from '@/app/lib/studio/studioPitchTune';
import { studioKeyLabel, type StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';
import {
  studioA2mLaneReady,
  studioExternalMidiLaneOptions,
  studioVocalFxPitchRouteMode,
  studioVocalFxPitchRouteTrackIndex,
  type StudioVocalFxPitchRouteMode,
} from '@/app/lib/studio/studioVocalFxPitchRoute';
import type { StudioTrackVocalFx } from '@/app/lib/studio/studioTrackVocalFx';
import type { StudioVocoderCarrierTrack } from '@/app/lib/studio/studioVocoderCarrier';

/** Vocal FX popover fader travel — tall enough for precise drags. */
export const PITCH_TUNE_PANEL_FADER_H = 168;

export function StudioPitchTuneGuidePopover({ disabled }: { disabled?: boolean }) {
  const { btnRef, open, menuStyle, openMenu } = useStudioFxPopover();
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={openMenu}
        onPointerDown={(e) => e.stopPropagation()}
        className="w-full flex items-center gap-1.5 rounded border px-2 py-1.5 text-left transition-colors disabled:opacity-40 mb-2"
        style={{ borderColor: open ? '#ff9f4366' : '#262632', background: open ? '#ff9f4310' : '#0a0a10' }}
      >
        <CircleHelp size={10} strokeWidth={2.2} style={{ color: '#ff9f43', flexShrink: 0 }} aria-hidden />
        <span className="suite-type-label text-[5px] flex-1 truncate" style={{ color: open ? '#ff9f43' : '#8a8a9a' }}>
          How to · Pitch Tune + MIDI
        </span>
        <ChevronDown size={9} style={{ color: '#5a5a68', transform: open ? 'rotate(180deg)' : undefined }} aria-hidden />
      </button>
      <StudioFxPopoverMenu open={open} menuStyle={menuStyle} title="Pitch Tune + MIDI" accent="#ff9f43">
        <ol className="space-y-2 list-decimal list-inside">
          {PITCH_TUNE_MIDI_GUIDE.map((step, i) => (
            <li key={i} className="suite-type-micro text-[5px] leading-snug" style={{ color: '#7a7a8a', textTransform: 'none', letterSpacing: '0.02em' }}>
              {step}
            </li>
          ))}
        </ol>
      </StudioFxPopoverMenu>
    </>
  );
}

export function StudioPitchTuneScaleKeyBox({
  scaleId,
  keyRoot,
  keyMode,
  active,
  disabled,
  onChange,
}: {
  scaleId: PitchTuneScaleId;
  keyRoot: number;
  keyMode: StudioDetectedKeyMode;
  active?: boolean;
  disabled?: boolean;
  onChange: (scaleId: PitchTuneScaleId) => void;
}) {
  const { btnRef, open, setOpen, menuStyle, openMenu } = useStudioFxPopover({ preferAbove: true });
  const summary = `${studioKeyLabel(keyRoot, keyMode)} · ${pitchTuneScaleLabel(scaleId)}`;

  return (
    <>
      <StudioCompactFxTrigger
        btnRef={btnRef}
        label="Scale key"
        value={summary}
        accent="#ff9f43"
        open={open}
        active={active}
        disabled={disabled}
        onClick={openMenu}
      />
      <StudioFxPopoverMenu open={open} menuStyle={menuStyle} title="Scale key" accent="#ff9f43">
        <div className="suite-type-micro text-[5px] mb-2 px-0.5" style={{ color: '#6a6a78', textTransform: 'none', letterSpacing: '0.04em' }}>
          Song key {studioKeyLabel(keyRoot, keyMode)}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {PITCH_TUNE_SCALE_OPTIONS.map((opt) => {
            const on = opt.id === scaleId;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={disabled}
                onClick={() => {
                  onChange(opt.id);
                  setOpen(false);
                }}
                className="suite-type-micro rounded border px-1 py-1 text-[5px] leading-snug transition-colors disabled:opacity-40"
                style={{ ...studioFxGlassChipStyle(on, '#ff9f43'), color: on ? '#ff9f43' : '#7a7a8a' }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </StudioFxPopoverMenu>
    </>
  );
}

function pitchRouteSummary(
  midiTrackIndex: number | null,
  vocalTrackIndex: number,
  carrierTracks: readonly StudioVocoderCarrierTrack[],
): string {
  const vocalTrack = carrierTracks[vocalTrackIndex];
  const kind = vocalTrack?.kind ?? 'audio';
  const mode = studioVocalFxPitchRouteMode(midiTrackIndex, vocalTrackIndex, kind);
  if (mode === 'audio') return 'From audio / scale';
  if (mode === 'a2m_lane') return 'Audio→MIDI here';
  if (midiTrackIndex != null && carrierTracks[midiTrackIndex]) {
    const tr = carrierTracks[midiTrackIndex]!;
    return `CH · ${tr.name}`;
  }
  return 'MIDI channel';
}

export function StudioPitchTuneA2mBox({
  fx,
  vocalTrackIndex,
  carrierTracks,
  disabled,
  onChange,
}: {
  fx: StudioTrackVocalFx;
  vocalTrackIndex: number;
  carrierTracks: readonly StudioVocoderCarrierTrack[];
  disabled?: boolean;
  onChange: (patch: Partial<StudioTrackVocalFx>) => void;
}) {
  const { btnRef, open, setOpen, menuStyle, openMenu } = useStudioFxPopover();
  const vocalTrack = carrierTracks[vocalTrackIndex];
  const vocalKind = vocalTrack?.kind ?? 'audio';
  const mode = studioVocalFxPitchRouteMode(fx.pitchTuneMidiTrackIndex, vocalTrackIndex, vocalKind);
  const a2m = studioA2mLaneReady(vocalTrack);
  const externalLanes = studioExternalMidiLaneOptions(carrierTracks, vocalTrackIndex);
  const off = disabled || !fx.autotuneOn;

  const setMode = (next: StudioVocalFxPitchRouteMode, externalIdx: number | null = null) => {
    onChange({
      pitchTuneMidiTrackIndex: studioVocalFxPitchRouteTrackIndex(next, vocalTrackIndex, externalIdx),
    });
    setOpen(false);
  };

  return (
    <>
      <StudioCompactFxTrigger
        btnRef={btnRef}
        label="Audio→MIDI"
        value={pitchRouteSummary(fx.pitchTuneMidiTrackIndex, vocalTrackIndex, carrierTracks)}
        accent="#67e8f9"
        open={open}
        active={mode !== 'audio'}
      disabled={off}
      title={
        off
          ? !fx.autotuneOn
            ? 'Turn Pitch Tune ON first'
            : 'Pitch route unavailable while transport is running'
          : undefined
      }
      onClick={openMenu}
      />
      <StudioFxPopoverMenu open={open} menuStyle={menuStyle} title="Audio→MIDI route" accent="#67e8f9">
        <div className="flex flex-col gap-2">
          {off ? (
            <div
              className="rounded border px-2 py-1.5 suite-type-micro text-[5px] leading-snug"
              style={{ borderColor: '#3a2830', background: '#1a1014', color: '#ff9f43', textTransform: 'none', letterSpacing: '0.03em' }}
            >
              Turn Pitch Tune ON above to pick a pitch source.
            </div>
          ) : (
            <div
              className="suite-type-micro text-[5px] px-0.5 leading-snug"
              style={{ color: '#5a5a68', textTransform: 'none', letterSpacing: '0.03em' }}
            >
              Pick one source — Scale key (audio) or MIDI notes from a lane.
            </div>
          )}
          <button
            type="button"
            disabled={off}
            onClick={() => setMode('audio')}
            className="rounded border px-2 py-1.5 text-left disabled:opacity-40"
            style={studioFxGlassChipStyle(mode === 'audio', '#ff9f43')}
          >
            <div className="suite-type-label text-[5px]" style={{ color: mode === 'audio' ? '#ff9f43' : '#d0d0e0' }}>From audio / scale</div>
            <div className="suite-type-micro text-[4px] mt-px" style={{ color: '#5a5a68', textTransform: 'none' }}>Uses Scale key — no MIDI lane needed</div>
          </button>
          {vocalKind === 'a2m' ? (
            <button
              type="button"
              disabled={off || !a2m.ready}
              title={!a2m.ready ? 'Drop audio on this lane, then tap Convert on the track row' : undefined}
              onClick={() => setMode('a2m_lane')}
              className="rounded border px-2 py-1.5 text-left disabled:opacity-40"
              style={studioFxGlassChipStyle(mode === 'a2m_lane', '#FFB84D')}
            >
              <div className="suite-type-label text-[5px]" style={{ color: mode === 'a2m_lane' ? '#FFB84D' : '#d0d0e0' }}>This lane (converted)</div>
              <div className="suite-type-micro text-[4px] mt-px leading-snug" style={{ color: '#5a5a68', textTransform: 'none' }}>
                {a2m.ready
                  ? `${a2m.noteCount} converted notes ready`
                  : 'Needs notes — drop audio on this Audio→MIDI lane, then tap Convert on the track row'}
              </div>
            </button>
          ) : (
            <div
              className="rounded border px-2 py-1.5"
              style={{ borderColor: '#2a2a34', background: '#0a0a0e' }}
            >
              <div className="suite-type-label text-[5px]" style={{ color: '#6a6a78' }}>This lane (converted)</div>
              <div className="suite-type-micro text-[4px] mt-px leading-snug" style={{ color: '#5a5a68', textTransform: 'none' }}>
                Only on an Audio→MIDI track. This lane is regular audio — use Scale key, or pick another MIDI lane below.
              </div>
            </div>
          )}
          <div className="suite-type-micro text-[5px] px-0.5 pt-0.5" style={{ color: '#5a5a68', textTransform: 'none', letterSpacing: '0.03em' }}>
            — or MIDI from another channel —
          </div>
          {externalLanes.length === 0 ? (
            <div
              className="rounded border px-2 py-1.5 suite-type-micro text-[5px] leading-snug"
              style={{ borderColor: '#222230', background: '#06060c', color: '#5a5a68', textTransform: 'none', letterSpacing: '0.03em' }}
            >
              No other MIDI lanes with notes yet. Add a MIDI or rhythm lane, draw notes, then pick it here.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {externalLanes.map((lane) => {
                const on = mode === 'midi_lane' && fx.pitchTuneMidiTrackIndex === lane.trackIndex;
                return (
                  <button
                    key={lane.trackIndex}
                    type="button"
                    disabled={off}
                    onClick={() => setMode('midi_lane', lane.trackIndex)}
                    className="rounded border px-2 py-1.5 text-left disabled:opacity-40"
                    style={studioFxGlassChipStyle(on, '#67e8f9')}
                  >
                    <div className="suite-type-label text-[5px]" style={{ color: on ? '#67e8f9' : '#d0d0e0' }}>
                      CH {lane.channel} · {lane.name}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </StudioFxPopoverMenu>
    </>
  );
}

/** Guide + Scale key / Audio→MIDI side-by-side across the panel width. */
export function StudioPitchTuneCompactHeader({
  fx,
  vocalTrackIndex,
  carrierTracks,
  songKeyRoot,
  songKeyMode,
  disabled,
  onChange,
}: {
  fx: StudioTrackVocalFx;
  vocalTrackIndex: number;
  carrierTracks: readonly StudioVocoderCarrierTrack[];
  songKeyRoot: number;
  songKeyMode: StudioDetectedKeyMode;
  disabled?: boolean;
  onChange: (patch: Partial<StudioTrackVocalFx>) => void;
}) {
  const vocalTrack = carrierTracks[vocalTrackIndex];
  const pitchRoute = studioVocalFxPitchRouteMode(
    fx.pitchTuneMidiTrackIndex,
    vocalTrackIndex,
    vocalTrack?.kind ?? 'audio',
  );

  return (
    <div className="mt-2 space-y-2.5">
      <StudioPitchTuneGuidePopover disabled={disabled || !fx.autotuneOn} />
      <div className="flex w-full gap-3">
        <div className="min-w-0 flex-1">
          <StudioPitchTuneScaleKeyBox
            scaleId={fx.pitchScaleId}
            keyRoot={songKeyRoot}
            keyMode={songKeyMode}
            active={pitchRoute === 'audio'}
            disabled={disabled || !fx.autotuneOn}
            onChange={(pitchScaleId) =>
              onChange({ pitchScaleId, pitchTuneMidiTrackIndex: null })
            }
          />
        </div>
        <div className="min-w-0 flex-1">
          <StudioPitchTuneA2mBox
            fx={fx}
            vocalTrackIndex={vocalTrackIndex}
            carrierTracks={carrierTracks}
            disabled={disabled}
            onChange={onChange}
          />
        </div>
      </div>
    </div>
  );
}

export function StudioAutotunePresetPicker({
  value,
  disabled,
  onSelect,
}: {
  value: StudioAutotunePresetId;
  disabled?: boolean;
  onSelect: (presetId: StudioAutotunePresetId) => void;
}) {
  const active = studioAutotunePresetById(value);
  return (
    <div className="mt-2">
      <div className="suite-type-label text-[6px] mb-1" style={{ color: '#6a6a78' }}>
        Character
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        {STUDIO_AUTOTUNE_PRESETS.map((p) => {
          const on = p.id === value;
          return (
            <button
              key={p.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(p.id)}
              className="justify-self-center w-[88%] rounded border px-1 py-1 text-left transition-colors disabled:opacity-40"
              style={studioFxGlassChipStyle(on, p.accent)}
            >
              <div className="suite-type-label text-[5px] leading-tight truncate" style={{ color: on ? p.accent : '#d0d0e0' }}>
                {p.label}
              </div>
            </button>
          );
        })}
      </div>
      <div className="suite-type-micro text-[4px] mt-0.5 truncate" style={{ color: active.accent, textTransform: 'none' }}>
        {active.label}
      </div>
    </div>
  );
}

export function StudioAutotuneFaders({
  fx,
  accent,
  disabled,
  onChange,
  faderHeight = PITCH_TUNE_PANEL_FADER_H,
  spread = false,
}: {
  fx: StudioTrackVocalFx;
  accent: string;
  disabled?: boolean;
  onChange: (patch: Partial<StudioTrackVocalFx>) => void;
  faderHeight?: number;
  /** Evenly space all five faders across panel width. */
  spread?: boolean;
}) {
  const off = disabled || !fx.autotuneOn;
  const faderProps = { faderHeight, disabled: off } as const;

  const faders = [
    <SuiteFader
      key="retune"
      label="RETUNE"
      {...faderProps}
      min={0}
      max={1}
      step={0.01}
      value={fx.autotuneStrength}
      onChange={(autotuneStrength) => onChange({ autotuneStrength })}
      format={(v) => `${Math.round(v * 100)}%`}
      accent={accent}
    />,
    <SuiteFader
      key="speed"
      label="SPEED"
      {...faderProps}
      min={0}
      max={120}
      step={1}
      value={fx.pitchRetuneMs}
      onChange={(pitchRetuneMs) => onChange({ pitchRetuneMs })}
      format={(v) => (v <= 0 ? 'HARD' : `${Math.round(v)}ms`)}
      accent="#67e8f9"
    />,
    <SuiteFader
      key="flex"
      label="FLEX"
      {...faderProps}
      min={0}
      max={1}
      step={0.01}
      value={fx.pitchFlex}
      onChange={(pitchFlex) => onChange({ pitchFlex })}
      format={(v) => `${Math.round(v * 100)}%`}
      accent="#fbbf24"
    />,
    <SuiteFader
      key="human"
      label="HUMAN"
      {...faderProps}
      min={0}
      max={1}
      step={0.01}
      value={fx.pitchHumanize}
      onChange={(pitchHumanize) => onChange({ pitchHumanize })}
      format={(v) => `${Math.round(v * 100)}%`}
      accent="#c084fc"
    />,
    <SuiteFader
      key="track"
      label="TRACK"
      {...faderProps}
      min={0}
      max={1}
      step={0.01}
      value={fx.pitchTracking}
      onChange={(pitchTracking) => onChange({ pitchTracking })}
      format={(v) => `${Math.round(v * 100)}%`}
      accent="#7cf4c6"
    />,
  ];

  if (!spread) {
    return (
      <div
        className="flex justify-start gap-1.5 mt-2.5 flex-nowrap overflow-x-auto pb-1"
        style={{ touchAction: 'pan-x', WebkitOverflowScrolling: 'touch' }}
      >
        {faders}
      </div>
    );
  }

  return (
    <div
      className="w-full mt-2.5"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
        columnGap: 14,
        alignItems: 'end',
      }}
    >
      {faders.map((fader) => (
        <div key={fader.key} className="flex justify-center min-w-0 px-0.5">
          {fader}
        </div>
      ))}
    </div>
  );
}

export function applyAutotunePreset(fx: StudioTrackVocalFx, presetId: StudioAutotunePresetId): StudioTrackVocalFx {
  const p = studioAutotunePresetById(presetId);
  return {
    ...fx,
    autotuneOn: true,
    autotunePreset: presetId,
    autotuneStrength: p.autotuneStrength,
    pitchRetuneMs: p.pitchRetuneMs,
    pitchFlex: p.pitchFlex,
    pitchHumanize: p.pitchHumanize,
    pitchScaleId: p.pitchScaleId,
    pitchTracking: p.pitchTracking,
    vibratoDepth: p.vibratoDepth,
  };
}

/** @deprecated Use StudioPitchTuneCompactHeader — kept for re-exports */
export function StudioPitchTuneScalePicker(props: {
  value: PitchTuneScaleId;
  disabled?: boolean;
  onChange: (scaleId: PitchTuneScaleId) => void;
}) {
  return (
    <StudioPitchTuneScaleKeyBox
      scaleId={props.value}
      keyRoot={0}
      keyMode="major"
      disabled={props.disabled}
      onChange={props.onChange}
    />
  );
}

/** @deprecated Use StudioPitchTuneCompactHeader */
export function StudioPitchTuneMidiPicker(props: {
  fx: StudioTrackVocalFx;
  vocalTrackIndex: number;
  carrierTracks: readonly StudioVocoderCarrierTrack[];
  disabled?: boolean;
  onChange: (patch: Partial<StudioTrackVocalFx>) => void;
}) {
  return (
    <StudioPitchTuneA2mBox
      fx={props.fx}
      vocalTrackIndex={props.vocalTrackIndex}
      carrierTracks={props.carrierTracks}
      disabled={props.disabled}
      onChange={props.onChange}
    />
  );
}
