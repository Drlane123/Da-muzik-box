'use client';

import { PadSamplerFxTCapStyles } from '@/app/components/creation/PadSamplerFxWidgets';
import '@/app/styles/studioFxSuite.css';
import { Mic2, Waves, GripHorizontal } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';

import {
  applyAutotunePreset,
  StudioAutotuneFaders,
  StudioAutotunePresetPicker,
  StudioPitchTuneCompactHeader,
} from '@/app/components/studio/StudioAutotuneControls';
import { useStudioFloatingPanelDrag } from '@/app/components/studio/useStudioFloatingPanelDrag';
import { StudioPitchTuneMonitor } from '@/app/components/studio/StudioPitchTuneMonitor';
import { useStudioPitchTuneMonitor } from '@/app/hooks/useStudioPitchTuneMonitor';
import { setStudioPitchMonitorActiveTrack } from '@/app/lib/studio/studioPitchTuneMonitorBus';
import {
  applyVocoderPreset,
  StudioVocoderCompactHeader,
  StudioVocoderFaders,
  StudioVocoderPresetPicker,
} from '@/app/components/studio/StudioVocoderControls';
import type { StudioVocoderCarrierTrack } from '@/app/lib/studio/studioVocoderCarrier';
import {
  STUDIO_TRACK_VOCAL_FX_DEFAULT,
  studioTrackVocalFxActive,
  type StudioTrackVocalFx,
} from '@/app/lib/studio/studioTrackVocalFx';
import {
  studioAutotunePresetById,
  type StudioAutotunePresetId,
} from '@/app/lib/studio/studioAutotunePresets';
import { studioVocoderPresetById, type StudioVocoderPresetId } from '@/app/lib/studio/studioVocoderPresets';
import {
  studioKeyLabel,
  type StudioDetectedKeyMode,
} from '@/app/lib/studio/studioAudioClipAnalysis';
import { pitchTuneScaleLabel } from '@/app/lib/studio/studioPitchTune';

const PANEL_W = 520;
const PANEL_MIN_H = 540;
const PANEL_Z = 30060;
const VIEWPORT_PAD = 8;

const TUNE_ACCENT = '#ff9f43';
const TUNE_GLOW = 'rgba(255, 159, 67, 0.45)';
const VOCODER_ACCENT = '#67e8f9';
const VOCODER_GLOW = 'rgba(103, 232, 249, 0.4)';

function computePanelPos(anchor: DOMRect): { top: number; left: number } {
  const gap = 6;
  let left = Math.max(VIEWPORT_PAD, anchor.left);
  if (left + PANEL_W > window.innerWidth - VIEWPORT_PAD) {
    left = window.innerWidth - PANEL_W - VIEWPORT_PAD;
  }
  let top = anchor.bottom + gap;
  if (top + PANEL_MIN_H > window.innerHeight - VIEWPORT_PAD) {
    top = Math.max(VIEWPORT_PAD, anchor.top - gap - PANEL_MIN_H);
  }
  return { top, left };
}

function PowerToggle({
  label,
  sub,
  on,
  accent,
  glow,
  disabled,
  onToggle,
}: {
  label: string;
  sub: string;
  on: boolean;
  accent: string;
  glow: string;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className="flex flex-col items-start gap-0.5 rounded-lg border px-2.5 py-2 text-left transition-all disabled:opacity-40"
      style={{
        borderColor: on ? `${accent}88` : '#2a2a38',
        background: on
          ? `linear-gradient(145deg, ${accent}18 0%, #12121a 55%, #0a0a10 100%)`
          : 'linear-gradient(145deg, #14141c 0%, #1e1e26 100%)',
        boxShadow: on ? `0 0 18px ${glow}, inset 0 1px 0 rgba(255,255,255,0.06)` : 'none',
      }}
    >
      <span className="flex w-full items-center justify-between gap-2">
        <span className="suite-type-label text-[10px]" style={{ color: on ? accent : '#8a8a9a' }}>
          {label}
        </span>
        <span
          className="suite-type-micro rounded-full px-1.5 py-0.5 text-[7px]"
          style={{
            background: on ? `${accent}22` : '#1a1a24',
            color: on ? accent : '#5a5a6a',
            border: `1px solid ${on ? `${accent}55` : '#2a2a34'}`,
          }}
        >
          {on ? 'ON' : 'OFF'}
        </span>
      </span>
      <span className="suite-type-micro text-[7px] leading-tight" style={{ color: '#5c5c6c', textTransform: 'none', letterSpacing: '0.04em' }}>
        {sub}
      </span>
    </button>
  );
}

export type StudioVocalFxPanelProps = {
  value: StudioTrackVocalFx;
  onChange: (next: StudioTrackVocalFx) => void;
  trackName: string;
  vocalTrackIndex: number;
  carrierTracks: readonly StudioVocoderCarrierTrack[];
  accentHex?: string;
  songKeyRoot: number;
  songKeyMode: StudioDetectedKeyMode;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
  /** Project / lane mic device — same source Hum Capture uses for live pitch readout. */
  inputDeviceId?: string;
};

/** Pro-style Pitch Tune + Vocoder rack for audio / A2M lanes. */
export function StudioVocalFxPanel({
  value,
  onChange,
  trackName,
  vocalTrackIndex,
  carrierTracks,
  accentHex = '#c084fc',
  songKeyRoot,
  songKeyMode,
  disabled = false,
  compact = true,
  className = '',
  inputDeviceId = '',
}: StudioVocalFxPanelProps) {
  const fx = value ?? STUDIO_TRACK_VOCAL_FX_DEFAULT;
  const active = studioTrackVocalFxActive(fx);
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const resolveInitialPos = useCallback(() => {
    const el = btnRef.current;
    return el ? computePanelPos(el.getBoundingClientRect()) : { top: 80, left: 80 };
  }, []);

  const { pos: panelPos, dragging, dragHandleProps } = useStudioFloatingPanelDrag({
    open,
    resolveInitialPos,
    panelRef,
    viewportPad: VIEWPORT_PAD,
  });

  const { snap: pitchSnap, scalePitchClasses } = useStudioPitchTuneMonitor({
    active: open && fx.autotuneOn,
    trackIndex: vocalTrackIndex,
    fx,
    keyRoot: songKeyRoot,
    mode: 'pitchTune',
    inputDeviceId,
  });

  const { snap: vocoderSnap, scalePitchClasses: vocoderScalePcs } = useStudioPitchTuneMonitor({
    active: open && fx.vocoderOn,
    trackIndex: vocalTrackIndex,
    fx,
    keyRoot: songKeyRoot,
    mode: 'vocoder',
    inputDeviceId,
  });

  useEffect(() => {
    if (!open) return;
    setStudioPitchMonitorActiveTrack(vocalTrackIndex);
    return () => setStudioPitchMonitorActiveTrack(null);
  }, [open, vocalTrackIndex]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const tid = window.setTimeout(() => {
      const onOutside = (e: PointerEvent) => {
        const t = e.target as Node;
        if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
        if ((t as Element).closest?.('[data-studio-fx-popover-menu]')) return;
        setOpen(false);
      };
      document.addEventListener('pointerdown', onOutside, true);
      (panelRef as { _cleanup?: () => void })._cleanup = () => {
        document.removeEventListener('pointerdown', onOutside, true);
      };
    }, 0);
    return () => {
      window.clearTimeout(tid);
      document.removeEventListener('keydown', onKey);
      (panelRef as { _cleanup?: () => void })._cleanup?.();
    };
  }, [open]);

  const patch = (partial: Partial<StudioTrackVocalFx>) => onChange({ ...fx, ...partial });

  const keyLabel = studioKeyLabel(songKeyRoot, songKeyMode);
  const tuneScopeKeyLabel = `${keyLabel} · ${pitchTuneScaleLabel(fx.pitchScaleId)}`;

  const panel =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={`Vocal FX for ${trackName}`}
            data-studio-vocal-fx-panel
            data-studio-fx-suite
            className="fixed rounded-xl border shadow-2xl select-none overflow-hidden"
            style={{
              top: panelPos.top,
              left: panelPos.left,
              width: PANEL_W,
              minHeight: PANEL_MIN_H,
              zIndex: PANEL_Z,
              borderColor: '#3a3050',
              background: 'linear-gradient(165deg, #16101f 0%, #0a0a10 42%, #06060c 100%)',
              boxShadow:
                '0 24px 64px rgba(0,0,0,0.92), 0 0 0 1px rgba(255,255,255,0.05), 0 0 40px rgba(192,132,252,0.12)',
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="px-3 py-2.5 border-b flex items-center gap-2"
              title="Drag to move panel"
              aria-label="Drag to move Vocal DSP panel"
              {...dragHandleProps}
              style={{
                ...dragHandleProps.style,
                borderColor: '#2a2438',
                background: dragging
                  ? 'linear-gradient(90deg, rgba(192,132,252,0.22) 0%, rgba(255,159,67,0.12) 50%, rgba(103,232,249,0.14) 100%)'
                  : 'linear-gradient(90deg, rgba(192,132,252,0.14) 0%, rgba(255,159,67,0.08) 50%, rgba(103,232,249,0.1) 100%)',
              }}
            >
              <GripHorizontal size={12} style={{ color: '#6a6a78', flexShrink: 0 }} aria-hidden />
              <Waves size={14} strokeWidth={2.2} style={{ color: accentHex }} aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="suite-type-title text-[11px]" style={{ color: '#f0f0fc' }}>
                  Vocal DSP Suite
                </div>
                <div className="suite-type-micro text-[8px] truncate" style={{ color: '#7a7a90', textTransform: 'none', letterSpacing: '0.04em' }}>
                  {trackName} · key {keyLabel}
                </div>
              </div>
            </div>

            <div className="px-3 pt-3 pb-2 grid grid-cols-2 gap-2.5">
              <PowerToggle
                label="Pitch Tune DSP"
                sub="Mic → this track → pitch correction → mixer"
                on={fx.autotuneOn}
                accent={TUNE_ACCENT}
                glow={TUNE_GLOW}
                disabled={disabled}
                onToggle={() => patch({ autotuneOn: !fx.autotuneOn })}
              />
              <PowerToggle
                label="Vocoder DSP"
                sub="Vocoder / talk-box character"
                on={fx.vocoderOn}
                accent={VOCODER_ACCENT}
                glow={VOCODER_GLOW}
                disabled={disabled}
                onToggle={() => patch({ vocoderOn: !fx.vocoderOn })}
              />
            </div>

            {fx.autotuneOn ? (
              <div className="px-3 pb-3 space-y-2">
                <div
                  className="suite-type-label text-[8px] tracking-widest pt-0.5"
                  style={{ color: TUNE_ACCENT }}
                >
                  Pitch Tune DSP
                </div>
                <StudioAutotunePresetPicker
                  value={fx.autotunePreset}
                  disabled={disabled}
                  onSelect={(presetId: StudioAutotunePresetId) => patch(applyAutotunePreset(fx, presetId))}
                />
                <StudioPitchTuneMonitor
                  scalePitchClasses={scalePitchClasses}
                  snap={pitchSnap}
                  keyLabel={tuneScopeKeyLabel}
                />
                <StudioPitchTuneCompactHeader
                  fx={fx}
                  vocalTrackIndex={vocalTrackIndex}
                  carrierTracks={carrierTracks}
                  songKeyRoot={songKeyRoot}
                  songKeyMode={songKeyMode}
                  disabled={disabled}
                  onChange={patch}
                />
                <StudioAutotuneFaders
                  fx={fx}
                  accent={studioAutotunePresetById(fx.autotunePreset).accent}
                  disabled={disabled}
                  onChange={patch}
                  spread
                />
              </div>
            ) : null}

            {fx.vocoderOn ? (
              <div className="px-3 pb-3 space-y-2">
                <div
                  className="suite-type-label text-[8px] tracking-widest pt-0.5"
                  style={{ color: VOCODER_ACCENT }}
                >
                  Vocoder DSP
                </div>
                <StudioVocoderPresetPicker
                  value={fx.vocoderPreset}
                  disabled={disabled}
                  onSelect={(presetId: StudioVocoderPresetId) => patch(applyVocoderPreset(fx, presetId))}
                />
                <StudioPitchTuneMonitor
                  variant="vocoder"
                  scalePitchClasses={vocoderScalePcs}
                  snap={vocoderSnap}
                  keyLabel={keyLabel}
                />
                <StudioVocoderCompactHeader
                  fx={fx}
                  vocalTrackIndex={vocalTrackIndex}
                  carrierTracks={carrierTracks}
                  disabled={disabled}
                  onChange={patch}
                />
                <StudioVocoderFaders
                  fx={fx}
                  accent={studioVocoderPresetById(fx.vocoderPreset).accent}
                  disabled={disabled}
                  onChange={patch}
                  spread
                />
              </div>
            ) : null}

            <div
              className="suite-type-micro px-3 py-1 border-t text-[7px] leading-snug truncate"
              style={{ borderColor: '#222230', color: active ? '#9ae6b4' : '#5a5a68', background: '#07070c', textTransform: 'none', letterSpacing: '0.03em' }}
            >
              {active
                ? 'Audio on this track routes through Vocal DSP — live mic + clip playback'
                : 'Turn on Pitch Tune DSP or Vocoder DSP'}
            </div>
          </div>,
          document.body,
        )
      : null;

  const triggerStyle: CSSProperties = {
    borderColor: open || active ? `${accentHex}77` : '#2a2a36',
    background: open
      ? `linear-gradient(135deg, ${accentHex}22 0%, #1a1028 100%)`
      : active
        ? `linear-gradient(135deg, ${accentHex}14 0%, #14141c 100%)`
        : '#14141c',
    color: open || active ? '#f0f0f8' : '#a8a8b8',
    fontSize: compact ? 12 : 9,
    padding: compact ? '2px 6px' : '3px 8px',
    boxShadow: active ? `0 0 12px ${accentHex}33` : undefined,
  };

  return (
    <>
      <PadSamplerFxTCapStyles />
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        title={`Vocal DSP — Pitch Tune & Vocoder for ${trackName}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={(e) => {
          e.stopPropagation();
          if (disabled) return;
          setOpen((v) => !v);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className={`flex min-w-0 max-w-full items-center justify-center gap-1 rounded border font-black uppercase tracking-wide outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
        style={triggerStyle}
      >
        <Mic2 size={compact ? 10 : 10} strokeWidth={2.4} aria-hidden />
        <span className="truncate">Vocal FX</span>
        {active ? (
          <span
            className="shrink-0 rounded-full px-1 text-[6px] font-black"
            style={{ background: `${accentHex}28`, color: accentHex }}
          >
            ON
          </span>
        ) : null}
      </button>
      {panel}
    </>
  );
}
