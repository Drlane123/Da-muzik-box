'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { GripHorizontal, SlidersHorizontal, X } from 'lucide-react';

import { PadSamplerFxTCapStyles } from '@/app/components/creation/PadSamplerFxWidgets';
import { SuiteFader, CompTransferCurve, GateMeter, ReverbRoomViz } from '@/app/components/studio/studioFxSuiteWidgets';
import { setStudioTrackAnalyserConsumer } from '@/app/lib/studio/studioTrackAnalyserBus';
import { retapStudioInsertFxAnalyserIfConsumerOpen } from '@/app/lib/studio/studioTrackInsertFxStrip';
import '@/app/styles/studioFxSuite.css';
import { StudioFxGraphicEq } from '@/app/components/studio/StudioFxGraphicEq';
import type { MixerEffectId } from '@/app/screens/components/ChannelStripFxDropdowns';
import {
  STUDIO_EQ_PRESETS,
  type StudioGateFx,
  type StudioTrackInsertFxRack,
} from '@/app/lib/studio/studioTrackInsertFx';
import { patchStudioEqBands, studioEqBandColor, studioEqFormatBandHz } from '@/app/lib/studio/studioEq';
import {
  applyAutotunePreset,
  StudioAutotuneFaders,
  StudioAutotunePresetPicker,
  StudioPitchTuneCompactHeader,
} from '@/app/components/studio/StudioAutotuneControls';
import {
  applyVocoderPreset,
  StudioVocoderCompactHeader,
  StudioVocoderFaders,
  StudioVocoderPresetPicker,
} from '@/app/components/studio/StudioVocoderControls';
import type { StudioVocoderCarrierTrack } from '@/app/lib/studio/studioVocoderCarrier';
import {
  STUDIO_TRACK_VOCAL_FX_DEFAULT,
  type StudioTrackVocalFx,
} from '@/app/lib/studio/studioTrackVocalFx';
import {
  studioAutotunePresetById,
  type StudioAutotunePresetId,
} from '@/app/lib/studio/studioAutotunePresets';
import {
  studioVocoderPresetById,
  type StudioVocoderPresetId,
} from '@/app/lib/studio/studioVocoderPresets';
import { StudioPitchTuneMonitor } from '@/app/components/studio/StudioPitchTuneMonitor';
import { useStudioPitchTuneMonitor } from '@/app/hooks/useStudioPitchTuneMonitor';
import { setStudioPitchMonitorActiveTrack } from '@/app/lib/studio/studioPitchTuneMonitorBus';
import {
  studioKeyLabel,
  type StudioDetectedKeyMode,
} from '@/app/lib/studio/studioAudioClipAnalysis';
import { useStudioFloatingPanelDrag } from '@/app/components/studio/useStudioFloatingPanelDrag';

const EDITOR_W = 420;
const EDITOR_W_PITCH = 520;
const EDITOR_Z = 30070;
const VIEWPORT_PAD = 8;

const FX_ACCENT: Partial<Record<MixerEffectId, string>> = {
  autotune: '#ff9f43',
  vocoder: '#67e8f9',
  eq: '#7cf4c6',
  compressor: '#fbbf24',
  gate: '#f87171',
  reverb: '#a78bfa',
  delay: '#f472b6',
  saturation: '#fb923c',
  filter: '#38bdf8',
  limiter: '#e879f9',
  chorus: '#4ade80',
};

function clampPanelPos(anchor: DOMRect, panelH: number): { top: number; left: number } {
  const gap = 8;
  let left = anchor.right + gap;
  if (left + EDITOR_W > window.innerWidth - VIEWPORT_PAD) {
    left = Math.max(VIEWPORT_PAD, anchor.left - EDITOR_W - gap);
  }
  let top = Math.max(VIEWPORT_PAD, anchor.top - 4);
  if (top + panelH > window.innerHeight - VIEWPORT_PAD) {
    top = Math.max(VIEWPORT_PAD, window.innerHeight - VIEWPORT_PAD - panelH);
  }
  return { top, left };
}

function FxPower({ on, accent, onToggle, label }: { on: boolean; accent: string; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="suite-type-micro rounded-full px-2 py-0.5 text-[7px] border"
      style={{
        borderColor: on ? `${accent}88` : '#333',
        background: on ? `${accent}22` : '#101018',
        color: on ? accent : '#6a6a78',
        boxShadow: on ? `0 0 10px ${accent}33` : 'none',
      }}
    >
      {on ? `${label} ON` : `${label} OFF`}
    </button>
  );
}

export type StudioInsertFxEditorProps = {
  open: boolean;
  effectId: MixerEffectId;
  channelLabel: string;
  accentHex?: string;
  anchorRect: DOMRect | null;
  rack: StudioTrackInsertFxRack;
  onRackChange: (next: StudioTrackInsertFxRack) => void;
  vocalFx?: StudioTrackVocalFx;
  onVocalFxChange?: (next: StudioTrackVocalFx) => void;
  vocalTrackIndex?: number;
  carrierTracks?: readonly StudioVocoderCarrierTrack[];
  songKeyRoot?: number;
  songKeyMode?: StudioDetectedKeyMode;
  onClose: () => void;
};

export function StudioInsertFxEditor({
  open,
  effectId,
  channelLabel,
  accentHex = '#7cf4c6',
  anchorRect,
  rack,
  onRackChange,
  vocalFx,
  onVocalFxChange,
  vocalTrackIndex = 0,
  carrierTracks = [],
  songKeyRoot = 0,
  songKeyMode = 'major',
  onClose,
}: StudioInsertFxEditorProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const accent = FX_ACCENT[effectId] ?? accentHex;
  const [panelH, setPanelH] = useState(360);
  const fx = vocalFx ?? STUDIO_TRACK_VOCAL_FX_DEFAULT;

  const resolveInitialPos = useCallback(() => {
    return anchorRect ? clampPanelPos(anchorRect, panelH) : { top: 80, left: 80 };
  }, [anchorRect, panelH]);

  const { pos, dragging, dragHandleProps } = useStudioFloatingPanelDrag({
    open,
    resolveInitialPos,
    panelRef,
    viewportPad: VIEWPORT_PAD,
  });

  const { snap: pitchSnap, scalePitchClasses } = useStudioPitchTuneMonitor({
    active: open && effectId === 'autotune',
    trackIndex: vocalTrackIndex,
    fx,
    keyRoot: songKeyRoot,
    mode: 'pitchTune',
  });

  const { snap: vocoderSnap, scalePitchClasses: vocoderScalePcs } = useStudioPitchTuneMonitor({
    active: open && effectId === 'vocoder',
    trackIndex: vocalTrackIndex,
    fx,
    keyRoot: songKeyRoot,
    mode: 'vocoder',
  });

  useEffect(() => {
    if (!open) return;
    setStudioTrackAnalyserConsumer(vocalTrackIndex, 'fxSuite', true);
    const raf = requestAnimationFrame(() => {
      retapStudioInsertFxAnalyserIfConsumerOpen(vocalTrackIndex);
    });
    return () => {
      cancelAnimationFrame(raf);
      setStudioTrackAnalyserConsumer(vocalTrackIndex, 'fxSuite', false);
    };
  }, [open, vocalTrackIndex]);

  useEffect(() => {
    if (!open) return;
    if (effectId === 'autotune' || effectId === 'vocoder') {
      setStudioPitchMonitorActiveTrack(vocalTrackIndex);
      return () => setStudioPitchMonitorActiveTrack(null);
    }
    return undefined;
  }, [open, effectId, vocalTrackIndex]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const tid = window.setTimeout(() => {
      const onOutside = (e: PointerEvent) => {
        const t = e.target as Node;
        if (panelRef.current?.contains(t)) return;
        if (
          (t as Element).closest?.(
            '[data-studio-fx-panel], [data-studio-fx-suite], [data-studio-fx-editor], [data-studio-fx-popover-menu], [data-studio-mixer], [data-studio-mixer-strip]',
          )
        ) {
          return;
        }
        onClose();
      };
      document.addEventListener('pointerdown', onOutside, true);
      (panelRef as { _cl?: () => void })._cl = () =>
        document.removeEventListener('pointerdown', onOutside, true);
    }, 0);
    return () => {
      window.clearTimeout(tid);
      document.removeEventListener('keydown', onKey);
      (panelRef as { _cl?: () => void })._cl?.();
    };
  }, [open, onClose]);

  const patchVocal = (p: Partial<StudioTrackVocalFx>) => onVocalFxChange?.({ ...fx, ...p });

  const title = useMemo(() => {
    const map: Partial<Record<MixerEffectId, string>> = {
      autotune: 'Pitch Tune DSP',
      vocoder: 'Vocoder DSP',
      eq: '5-Band EQ',
      compressor: 'Dynamics',
      gate: 'Noise Gate',
      reverb: 'Space Reverb',
      delay: 'Delay',
      saturation: 'Saturation',
      filter: 'Filter',
      limiter: 'Limiter',
      chorus: 'Chorus',
    };
    return map[effectId] ?? effectId;
  }, [effectId]);

  if (!open || effectId === '' || typeof document === 'undefined') return null;

  const panelWidth = effectId === 'autotune' || effectId === 'vocoder' ? EDITOR_W_PITCH : EDITOR_W;

  let body: ReactNode = null;

  if (effectId === 'eq') {
    const eq = rack.eq;
    body = (
      <>
        <FxPower on={eq.enabled} accent={accent} onToggle={() => onRackChange({ ...rack, eq: { ...eq, enabled: !eq.enabled } })} label="EQ" />
        <div className="flex flex-wrap gap-1 mt-2">
          {STUDIO_EQ_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() =>
                onRackChange({
                  ...rack,
                  eq: patchStudioEqBands({ ...eq, enabled: true }, p.bands),
                })
              }
              className="suite-type-micro rounded px-1.5 py-0.5 text-[7px] border"
              style={{ borderColor: '#333', color: '#9a9ab0', background: '#101018' }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="mt-2 rounded-md overflow-hidden border" style={{ borderColor: '#252532' }}>
          <StudioFxGraphicEq
            eq={eq}
            onEqChange={(next) => onRackChange({ ...rack, eq: next })}
            trackIndex={vocalTrackIndex}
            meterActive={open}
            accent={accent}
          />
        </div>
        <div className="flex justify-center gap-1.5 mt-2 flex-wrap">
          {eq.bands.map((band, bi) => {
            const { fill } = studioEqBandColor(bi);
            const label = studioEqFormatBandHz(band.freqHz);
            return (
              <SuiteFader
                key={bi}
                label={label}
                min={-12}
                max={12}
                step={0.5}
                value={band.gainDb}
                onChange={(gainDb) => {
                  const bands = eq.bands.map((b, i) => (i === bi ? { ...b, gainDb } : b));
                  onRackChange({ ...rack, eq: patchStudioEqBands(eq, bands) });
                }}
                format={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}`}
                accent={fill}
                disabled={!eq.enabled}
              />
            );
          })}
        </div>
      </>
    );
  } else if (effectId === 'compressor') {
    const comp = rack.compressor;
    body = (
      <>
        <FxPower on={comp.enabled} accent={accent} onToggle={() => onRackChange({ ...rack, compressor: { ...comp, enabled: !comp.enabled } })} label="COMP" />
        <div className="mt-2 rounded-md overflow-hidden border" style={{ borderColor: '#252532' }}>
          <CompTransferCurve
            thresholdDb={comp.thresholdDb}
            ratio={comp.ratio}
            kneeDb={comp.kneeDb}
            accent={accent}
            makeupDb={comp.makeupDb}
            enabled={comp.enabled}
            trackIndex={vocalTrackIndex}
            meterActive={open}
          />
        </div>
        <div className="flex justify-center gap-1.5 mt-2 flex-wrap">
          <SuiteFader label="THR" min={-48} max={0} step={1} value={comp.thresholdDb} onChange={(thresholdDb) => onRackChange({ ...rack, compressor: { ...comp, thresholdDb } })} format={(v) => `${Math.round(v)}`} accent={accent} disabled={!comp.enabled} />
          <SuiteFader label="RATIO" min={1} max={20} step={0.5} value={comp.ratio} onChange={(ratio) => onRackChange({ ...rack, compressor: { ...comp, ratio } })} format={(v) => `1:${v.toFixed(1)}`} accent="#94a3b8" disabled={!comp.enabled} />
          <SuiteFader label="ATK" min={0.0005} max={0.25} step={0.0005} value={comp.attackSec} onChange={(attackSec) => onRackChange({ ...rack, compressor: { ...comp, attackSec } })} format={(v) => `${Math.round(v * 1000)}ms`} accent="#a78bfa" disabled={!comp.enabled} />
          <SuiteFader label="REL" min={0.02} max={1.2} step={0.01} value={comp.releaseSec} onChange={(releaseSec) => onRackChange({ ...rack, compressor: { ...comp, releaseSec } })} format={(v) => `${Math.round(v * 1000)}ms`} accent="#a78bfa" disabled={!comp.enabled} />
          <SuiteFader label="MKUP" min={0} max={18} step={0.5} value={comp.makeupDb} onChange={(makeupDb) => onRackChange({ ...rack, compressor: { ...comp, makeupDb } })} format={(v) => `+${v.toFixed(1)}`} accent="#7cf4c6" disabled={!comp.enabled} />
        </div>
      </>
    );
  } else if (effectId === 'gate') {
    const gate = rack.gate;
    body = (
      <>
        <FxPower on={gate.enabled} accent={accent} onToggle={() => onRackChange({ ...rack, gate: { ...gate, enabled: !gate.enabled } })} label="GATE" />
        <div className="mt-2">
          <GateMeter thresholdDb={gate.thresholdDb} floorDb={gate.floorDb} accent={accent} enabled={gate.enabled} trackIndex={vocalTrackIndex} meterActive={open} />
        </div>
        <div className="flex justify-center gap-2 mt-2">
          <SuiteFader label="THR" min={-80} max={0} step={1} value={gate.thresholdDb} onChange={(thresholdDb) => onRackChange({ ...rack, gate: { ...gate, thresholdDb } })} format={(v) => `${Math.round(v)}`} accent={accent} disabled={!gate.enabled} />
          <SuiteFader label="FLOOR" min={-80} max={-6} step={1} value={gate.floorDb} onChange={(floorDb) => onRackChange({ ...rack, gate: { ...gate, floorDb } })} format={(v) => `${Math.round(v)}`} accent="#94a3b8" disabled={!gate.enabled} />
          <SuiteFader label="ATK" min={0.0005} max={0.05} step={0.0005} value={gate.attackSec} onChange={(attackSec) => onRackChange({ ...rack, gate: { ...gate, attackSec } })} format={(v) => `${Math.round(v * 1000)}`} accent="#a78bfa" disabled={!gate.enabled} />
          <SuiteFader label="REL" min={0.02} max={0.8} step={0.01} value={gate.releaseSec} onChange={(releaseSec) => onRackChange({ ...rack, gate: { ...gate, releaseSec } })} format={(v) => `${Math.round(v * 1000)}`} accent="#a78bfa" disabled={!gate.enabled} />
        </div>
      </>
    );
  } else if (effectId === 'reverb') {
    const rev = rack.reverb;
    body = (
      <>
        <FxPower on={rev.enabled} accent={accent} onToggle={() => onRackChange({ ...rack, reverb: { ...rev, enabled: !rev.enabled } })} label="VERB" />
        <div className="mt-2">
          <ReverbRoomViz
            mix={rev.mix}
            decaySec={rev.decaySec}
            accent={accent}
            enabled={rev.enabled}
            trackIndex={vocalTrackIndex}
            meterActive={open}
          />
        </div>
        <div className="flex justify-center gap-3 mt-2">
          <SuiteFader label="MIX" min={0} max={1} step={0.01} value={rev.mix} onChange={(mix) => onRackChange({ ...rack, reverb: { ...rev, mix } })} format={(v) => `${Math.round(v * 100)}%`} accent={accent} disabled={!rev.enabled} />
          <SuiteFader label="DECAY" min={0.2} max={4} step={0.05} value={rev.decaySec} onChange={(decaySec) => onRackChange({ ...rack, reverb: { ...rev, decaySec } })} format={(v) => `${v.toFixed(1)}s`} accent="#c4b5fd" disabled={!rev.enabled} />
        </div>
      </>
    );
  } else if (effectId === 'autotune') {
    const tuneAccent = studioAutotunePresetById(fx.autotunePreset).accent;
    const tuneKeyLabel = studioKeyLabel(songKeyRoot, songKeyMode);
    body = (
      <>
        <FxPower on={fx.autotuneOn} accent={tuneAccent} onToggle={() => patchVocal({ autotuneOn: !fx.autotuneOn })} label="TUNE" />
        <StudioAutotunePresetPicker
          value={fx.autotunePreset}
          disabled={!fx.autotuneOn}
          onSelect={(presetId: StudioAutotunePresetId) => patchVocal(applyAutotunePreset(fx, presetId))}
        />
        <StudioPitchTuneMonitor
          scalePitchClasses={scalePitchClasses}
          snap={pitchSnap}
          keyLabel={tuneKeyLabel}
        />
        <StudioPitchTuneCompactHeader
          fx={fx}
          vocalTrackIndex={vocalTrackIndex}
          carrierTracks={carrierTracks}
          songKeyRoot={songKeyRoot}
          songKeyMode={songKeyMode}
          disabled={!fx.autotuneOn}
          onChange={patchVocal}
        />
        <StudioAutotuneFaders fx={fx} accent={tuneAccent} disabled={!fx.autotuneOn} onChange={patchVocal} spread />
      </>
    );
  } else if (effectId === 'vocoder') {
    const presetAccent = studioVocoderPresetById(fx.vocoderPreset).accent;
    const vocKeyLabel = studioKeyLabel(songKeyRoot, songKeyMode);
    body = (
      <>
        <FxPower on={fx.vocoderOn} accent={presetAccent} onToggle={() => patchVocal({ vocoderOn: !fx.vocoderOn })} label="VOC" />
        <StudioVocoderPresetPicker
          value={fx.vocoderPreset}
          disabled={!fx.vocoderOn}
          onSelect={(presetId: StudioVocoderPresetId) => patchVocal(applyVocoderPreset(fx, presetId))}
        />
        <StudioPitchTuneMonitor
          variant="vocoder"
          scalePitchClasses={vocoderScalePcs}
          snap={vocoderSnap}
          keyLabel={vocKeyLabel}
        />
        <StudioVocoderCompactHeader
          fx={fx}
          vocalTrackIndex={vocalTrackIndex}
          carrierTracks={carrierTracks}
          disabled={!fx.vocoderOn}
          onChange={patchVocal}
        />
        <StudioVocoderFaders fx={fx} accent={presetAccent} disabled={!fx.vocoderOn} onChange={patchVocal} spread />
      </>
    );
  } else if (effectId === 'delay') {
    const d = rack.delay;
    body = (
      <>
        <FxPower on={d.enabled} accent={accent} onToggle={() => onRackChange({ ...rack, delay: { ...d, enabled: !d.enabled } })} label="DLY" />
        <div className="flex justify-center gap-3 mt-3">
          <SuiteFader label="MIX" min={0} max={1} step={0.01} value={d.mix} onChange={(mix) => onRackChange({ ...rack, delay: { ...d, mix } })} format={(v) => `${Math.round(v * 100)}%`} accent={accent} disabled={!d.enabled} />
          <SuiteFader label="FB" min={0} max={0.92} step={0.01} value={d.feedback} onChange={(feedback) => onRackChange({ ...rack, delay: { ...d, feedback } })} format={(v) => `${Math.round(v * 100)}%`} accent="#94a3b8" disabled={!d.enabled} />
          <SuiteFader label="TIME" min={20} max={1200} step={5} value={d.timeMs} onChange={(timeMs) => onRackChange({ ...rack, delay: { ...d, timeMs, syncToBpm: false } })} format={(v) => `${Math.round(v)}ms`} accent="#a78bfa" disabled={!d.enabled} />
        </div>
      </>
    );
  } else {
    body = <div className="suite-type-micro text-[8px] py-4 text-center" style={{ color: '#6a6a78', textTransform: 'none', letterSpacing: '0.05em' }}>Parameters coming soon for this insert.</div>;
  }

  return createPortal(
    <>
      <PadSamplerFxTCapStyles />
      <div
        ref={(el) => {
          panelRef.current = el;
          if (el) setPanelH(el.offsetHeight);
        }}
        data-studio-fx-editor
        data-studio-fx-suite
        className="fixed rounded-xl border shadow-2xl select-none overflow-y-auto"
        style={{
          top: pos.top,
          left: pos.left,
          width: panelWidth,
          maxHeight: `calc(100vh - ${VIEWPORT_PAD * 2}px)`,
          zIndex: EDITOR_Z,
          borderColor: `${accent}44`,
          background: 'linear-gradient(165deg, #14141c 0%, #08080e 100%)',
          boxShadow: `0 24px 60px rgba(0,0,0,0.92), 0 0 24px ${accent}18`,
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="sticky top-0 z-10 px-3 py-2 border-b flex items-center gap-2"
          title="Drag to move panel"
          aria-label={`Drag to move ${title} panel`}
          {...dragHandleProps}
          style={{
            ...dragHandleProps.style,
            borderColor: '#252532',
            background: dragging
              ? 'linear-gradient(90deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.45) 100%)'
              : 'linear-gradient(90deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.2) 100%)',
          }}
        >
          <GripHorizontal size={11} style={{ color: '#6a6a78', flexShrink: 0 }} aria-hidden />
          <SlidersHorizontal size={12} style={{ color: accent }} />
          <div className="min-w-0 flex-1">
            <div className="suite-type-title text-[10px] truncate" style={{ color: '#f0f0fc' }}>
              {title}
            </div>
            <div className="suite-type-micro text-[7px] truncate" style={{ color: '#6a6a78', textTransform: 'none', letterSpacing: '0.04em' }}>
              {channelLabel}
            </div>
          </div>
          <button type="button" data-no-drag onClick={onClose} className="shrink-0 p-0.5 rounded border" style={{ borderColor: '#333', color: '#8a8a9a' }}>
            <X size={10} />
          </button>
        </div>
        <div className="px-3 py-3">{body}</div>
      </div>
    </>,
    document.body,
  );
}
