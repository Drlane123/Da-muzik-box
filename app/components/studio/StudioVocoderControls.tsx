'use client';

import { ChevronDown, CircleHelp } from 'lucide-react';

import { PITCH_TUNE_PANEL_FADER_H } from '@/app/components/studio/StudioAutotuneControls';
import { studioFxGlassChipStyle, SuiteFader } from '@/app/components/studio/studioFxSuiteWidgets';
import {
  StudioCompactFxTrigger,
  StudioFxPopoverMenu,
  useStudioFxPopover,
} from '@/app/components/studio/studioVocalFxPopoverWidgets';
import { VOCODER_MIDI_GUIDE } from '@/app/components/studio/StudioVocalFxMidiWidgets';
import {
  studioA2mLaneReady,
  studioExternalMidiLaneOptions,
  studioVocalFxPitchRouteMode,
  studioVocalFxPitchRouteTrackIndex,
  type StudioVocalFxPitchRouteMode,
} from '@/app/lib/studio/studioVocalFxPitchRoute';
import {
  STUDIO_VOCODER_PRESETS,
  studioVocoderPresetById,
  type StudioVocoderPresetId,
} from '@/app/lib/studio/studioVocoderPresets';
import type { StudioTrackVocalFx } from '@/app/lib/studio/studioTrackVocalFx';
import type { StudioVocoderCarrierTrack } from '@/app/lib/studio/studioVocoderCarrier';

const VOCODER_ACCENT = '#67e8f9';

function carrierRouteSummary(
  midiTrackIndex: number | null,
  vocalTrackIndex: number,
  carrierTracks: readonly StudioVocoderCarrierTrack[],
): string {
  if (midiTrackIndex == null) return 'Detected from vocal';
  const vocalTrack = carrierTracks[vocalTrackIndex];
  const kind = vocalTrack?.kind ?? 'audio';
  const mode = studioVocalFxPitchRouteMode(midiTrackIndex, vocalTrackIndex, kind);
  if (mode === 'a2m_lane') return 'This lane (converted)';
  if (midiTrackIndex != null && carrierTracks[midiTrackIndex]) {
    const tr = carrierTracks[midiTrackIndex]!;
    return `CH · ${tr.name}`;
  }
  return 'MIDI channel';
}

export function StudioVocoderGuidePopover({ disabled }: { disabled?: boolean }) {
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
        style={{ borderColor: open ? `${VOCODER_ACCENT}66` : '#262632', background: open ? `${VOCODER_ACCENT}10` : '#0a0a10' }}
      >
        <CircleHelp size={10} strokeWidth={2.2} style={{ color: VOCODER_ACCENT, flexShrink: 0 }} aria-hidden />
        <span className="suite-type-label text-[5px] flex-1 truncate" style={{ color: open ? VOCODER_ACCENT : '#8a8a9a' }}>
          How to · Vocoder + MIDI
        </span>
        <ChevronDown size={9} style={{ color: '#5a5a68', transform: open ? 'rotate(180deg)' : undefined }} aria-hidden />
      </button>
      <StudioFxPopoverMenu open={open} menuStyle={menuStyle} title="Vocoder + MIDI" accent={VOCODER_ACCENT}>
        <ol className="space-y-2 list-decimal list-inside">
          {VOCODER_MIDI_GUIDE.map((step, i) => (
            <li key={i} className="suite-type-micro text-[5px] leading-snug" style={{ color: '#7a7a8a', textTransform: 'none', letterSpacing: '0.02em' }}>
              {step}
            </li>
          ))}
        </ol>
      </StudioFxPopoverMenu>
    </>
  );
}

export function StudioVocoderVoicePitchBox({
  active,
  disabled,
  onSelect,
}: {
  active?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  const { btnRef, open, setOpen, menuStyle, openMenu } = useStudioFxPopover({ preferAbove: true });

  return (
    <>
      <StudioCompactFxTrigger
        btnRef={btnRef}
        label="Voice pitch"
        value="Detected from vocal"
        accent={VOCODER_ACCENT}
        open={open}
        active={active}
        disabled={disabled}
        onClick={openMenu}
      />
      <StudioFxPopoverMenu open={open} menuStyle={menuStyle} title="Voice pitch" accent={VOCODER_ACCENT}>
        <div className="suite-type-micro text-[5px] leading-snug" style={{ color: '#7a7a8a', textTransform: 'none', letterSpacing: '0.03em' }}>
          Vocoder uses this lane&apos;s vocal audio as the modulator. No external MIDI carrier — classic talk-box / voice-driven bands.
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            onSelect();
            setOpen(false);
          }}
          className="mt-2 w-full rounded border px-2 py-1.5 text-left disabled:opacity-40"
          style={studioFxGlassChipStyle(active ?? false, VOCODER_ACCENT)}
        >
          <div className="suite-type-label text-[5px]" style={{ color: active ? VOCODER_ACCENT : '#d0d0e0' }}>
            Use voice pitch
          </div>
        </button>
      </StudioFxPopoverMenu>
    </>
  );
}

export function StudioVocoderCarrierMidiBox({
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
  const mode = studioVocalFxPitchRouteMode(fx.vocoderCarrierTrackIndex, vocalTrackIndex, vocalKind);
  const a2m = studioA2mLaneReady(vocalTrack);
  const externalLanes = studioExternalMidiLaneOptions(carrierTracks, vocalTrackIndex);
  const off = disabled || !fx.vocoderOn;
  const midiActive = fx.vocoderCarrierTrackIndex != null;

  const setMode = (next: StudioVocalFxPitchRouteMode, externalIdx: number | null = null) => {
    onChange({
      vocoderCarrierTrackIndex: studioVocalFxPitchRouteTrackIndex(next, vocalTrackIndex, externalIdx),
    });
    setOpen(false);
  };

  return (
    <>
      <StudioCompactFxTrigger
        btnRef={btnRef}
        label="Carrier MIDI"
        value={carrierRouteSummary(fx.vocoderCarrierTrackIndex, vocalTrackIndex, carrierTracks)}
        accent="#c084fc"
        open={open}
        active={midiActive}
        disabled={off}
        title={off ? (!fx.vocoderOn ? 'Turn Vocoder ON first' : undefined) : undefined}
        onClick={openMenu}
      />
      <StudioFxPopoverMenu open={open} menuStyle={menuStyle} title="Carrier MIDI route" accent="#c084fc">
        <div className="flex flex-col gap-2">
          {off ? (
            <div
              className="rounded border px-2 py-1.5 suite-type-micro text-[5px] leading-snug"
              style={{ borderColor: '#28303a', background: '#101418', color: VOCODER_ACCENT, textTransform: 'none', letterSpacing: '0.03em' }}
            >
              Turn Vocoder ON above to pick a carrier source.
            </div>
          ) : (
            <div className="suite-type-micro text-[5px] px-0.5 leading-snug" style={{ color: '#5a5a68', textTransform: 'none', letterSpacing: '0.03em' }}>
              Pick a MIDI lane to drive the vocoder carrier synth (voice still modulates bands).
            </div>
          )}
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
                {a2m.ready ? `${a2m.noteCount} converted notes ready` : 'Needs notes — drop audio on this Audio→MIDI lane, then tap Convert'}
              </div>
            </button>
          ) : null}
          <div className="suite-type-micro text-[5px] px-0.5 pt-0.5" style={{ color: '#5a5a68', textTransform: 'none', letterSpacing: '0.03em' }}>
            — MIDI from another channel —
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
                const on = mode === 'midi_lane' && fx.vocoderCarrierTrackIndex === lane.trackIndex;
                return (
                  <button
                    key={lane.trackIndex}
                    type="button"
                    disabled={off}
                    onClick={() => setMode('midi_lane', lane.trackIndex)}
                    className="rounded border px-2 py-1.5 text-left disabled:opacity-40"
                    style={studioFxGlassChipStyle(on, '#c084fc')}
                  >
                    <div className="suite-type-label text-[5px]" style={{ color: on ? '#c084fc' : '#d0d0e0' }}>
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

/** Guide + Voice pitch / Carrier MIDI side-by-side — mirrors Pitch Tune compact header. */
export function StudioVocoderCompactHeader({
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
  const voiceActive = fx.vocoderCarrierTrackIndex == null;

  return (
    <div className="mt-2 space-y-2.5">
      <StudioVocoderGuidePopover disabled={disabled || !fx.vocoderOn} />
      <div className="flex w-full gap-3">
        <div className="min-w-0 flex-1">
          <StudioVocoderVoicePitchBox
            active={voiceActive}
            disabled={disabled || !fx.vocoderOn}
            onSelect={() => onChange({ vocoderCarrierTrackIndex: null })}
          />
        </div>
        <div className="min-w-0 flex-1">
          <StudioVocoderCarrierMidiBox
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

export function StudioVocoderPresetPicker({
  value,
  disabled,
  onSelect,
}: {
  value: StudioVocoderPresetId;
  disabled?: boolean;
  onSelect: (presetId: StudioVocoderPresetId) => void;
}) {
  const active = studioVocoderPresetById(value);
  return (
    <div className="mt-2">
      <div className="suite-type-label text-[6px] mb-1" style={{ color: '#6a6a78' }}>
        Character
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        {STUDIO_VOCODER_PRESETS.map((p) => {
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

export function StudioVocoderFaders({
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
  spread?: boolean;
}) {
  const off = disabled || !fx.vocoderOn;
  const faderProps = { faderHeight, disabled: off } as const;

  const faders = [
    <SuiteFader key="wet" label="WET" {...faderProps} min={0} max={1} step={0.01} value={fx.vocoderWet} onChange={(vocoderWet) => onChange({ vocoderWet })} format={(v) => `${Math.round(v * 100)}%`} accent={accent} />,
    <SuiteFader key="robot" label="ROBOT" {...faderProps} min={0} max={1} step={0.01} value={fx.vocoderRobot} onChange={(vocoderRobot) => onChange({ vocoderRobot })} format={(v) => `${Math.round(v * 100)}%`} accent={VOCODER_ACCENT} />,
    <SuiteFader key="form" label="FORM" {...faderProps} min={-6} max={6} step={0.5} value={fx.vocoderFormantSemis} onChange={(vocoderFormantSemis) => onChange({ vocoderFormantSemis })} format={(v) => (v === 0 ? '0' : v > 0 ? `+${v}` : `${v}`)} accent="#fbbf24" />,
    <SuiteFader key="atk" label="ATK" {...faderProps} min={1} max={80} step={1} value={fx.vocoderAttackMs} onChange={(vocoderAttackMs) => onChange({ vocoderAttackMs })} format={(v) => `${Math.round(v)}ms`} accent="#7cf4c6" />,
    <SuiteFader key="rel" label="REL" {...faderProps} min={20} max={200} step={2} value={fx.vocoderReleaseMs} onChange={(vocoderReleaseMs) => onChange({ vocoderReleaseMs })} format={(v) => `${Math.round(v)}ms`} accent="#38bdf8" />,
    <SuiteFader key="noise" label="NOISE" {...faderProps} min={0} max={1} step={0.01} value={fx.vocoderUnvoiced} onChange={(vocoderUnvoiced) => onChange({ vocoderUnvoiced })} format={(v) => `${Math.round(v * 100)}%`} accent="#a78bfa" />,
    <SuiteFader key="focus" label="FOCUS" {...faderProps} min={0} max={1} step={0.01} value={fx.vocoderBandFocus} onChange={(vocoderBandFocus) => onChange({ vocoderBandFocus })} format={(v) => (v < 0.35 ? 'WARM' : v > 0.65 ? 'BRITE' : `${Math.round(v * 100)}%`)} accent="#f472b6" />,
    <SuiteFader key="vib" label="VIB" {...faderProps} min={0} max={1} step={0.01} value={fx.vibratoDepth} onChange={(vibratoDepth) => onChange({ vibratoDepth })} format={(v) => `${Math.round(v * 100)}%`} accent="#c084fc" />,
  ];

  if (!spread) {
    return (
      <div className="flex justify-start gap-1.5 mt-2.5 flex-nowrap overflow-x-auto pb-1" style={{ touchAction: 'pan-x', WebkitOverflowScrolling: 'touch' }}>
        {faders}
      </div>
    );
  }

  return (
    <div
      className="w-full mt-2.5"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
        columnGap: 10,
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

export function applyVocoderPreset(fx: StudioTrackVocalFx, presetId: StudioVocoderPresetId): StudioTrackVocalFx {
  const p = studioVocoderPresetById(presetId);
  return {
    ...fx,
    vocoderOn: true,
    vocoderPreset: presetId,
    vocoderWet: p.vocoderWet,
    vocoderRobot: p.vocoderRobot,
    vibratoDepth: p.vibratoDepth,
    vocoderFormantSemis: p.vocoderFormantSemis,
    vocoderAttackMs: p.vocoderAttackMs,
    vocoderReleaseMs: p.vocoderReleaseMs,
    vocoderUnvoiced: p.vocoderUnvoiced,
    vocoderBandFocus: p.vocoderBandFocus,
  };
}
