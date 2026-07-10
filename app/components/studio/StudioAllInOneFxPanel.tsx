'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Power, X, Zap, GripHorizontal } from 'lucide-react';

import type { PadSamplerDelayNote } from '@/app/lib/creationStation/padSamplerFxRack';
import {
  padSamplerDelayTimeLabel,
  padSamplerDelayTimeMs,
} from '@/app/lib/creationStation/padSamplerFxRack';
import { PadSamplerFxTCapStyles } from '@/app/components/creation/PadSamplerFxWidgets';
import { StudioFxGraphicEq } from '@/app/components/studio/StudioFxGraphicEq';
import {
  CHROME,
  CompTransferCurve,
  ChorusModViz,
  DelayEchoViz,
  DeEsserViz,
  DriveWaveViz,
  FilterCutoffViz,
  FxModulePower,
  FxSuiteChromeFrame,
  SuiteFader,
  GateMeter,
  LimiterCeilingViz,
  ReverbRoomViz,
  SUITE_MODULES,
  SUITE_MODULE_BAY_H,
  SuiteAnalogTubeControl,
  SuiteModuleRackTile,
  SuiteModuleShell,
  SuiteSignalChainStrip,
  SuiteSpectrumAnalyzer,
  suiteModuleEnabled,
  type SuiteModuleId,
} from '@/app/components/studio/studioFxSuiteWidgets';
import {
  STUDIO_EQ_PRESETS,
  cloneStudioTrackInsertFxRack,
  normalizeStudioFilter,
  studioInsertFxSuiteMasterPowerOff,
  studioTrackInsertFxRacksEqual,
  STUDIO_DEESSER_AMOUNT_MAX,
  STUDIO_DEESSER_FREQ_MAX,
  STUDIO_DEESSER_FREQ_MIN,
  type StudioTrackInsertFxRack,
} from '@/app/lib/studio/studioTrackInsertFx';
import {
  STUDIO_FX_SUITE_PRESET_DEFAULT_ID,
  STUDIO_FX_SUITE_PRESET_GROUPS,
  STUDIO_FX_SUITE_PRESETS,
  studioFxSuitePresetRack,
} from '@/app/lib/studio/studioFxSuitePresets';
import { patchStudioEqBands, studioEqBandColor, studioEqFormatBandHz } from '@/app/lib/studio/studioEq';
import { setStudioTrackAnalyserConsumer } from '@/app/lib/studio/studioTrackAnalyserBus';
import { SUITE_FONT_FAMILY } from '@/app/lib/studio/studioUiTypography';
import { useStudioFloatingPanelDrag } from '@/app/components/studio/useStudioFloatingPanelDrag';
import '@/app/styles/studioFxSuite.css';

const PANEL_W = 592;
const PANEL_Z = 30065;
const VIEWPORT_PAD = 10;
/** Estimated panel height for positioning — avoids layout-measure re-render loops. */
const PANEL_EST_H = 720;
const SUITE_RACK_PUSH_MS = 64;
const SUITE_DELAY_NOTES: { id: PadSamplerDelayNote; label: string }[] = [
  { id: '1/16', label: '1/16' },
  { id: '1/8', label: '1/8' },
  { id: '1/4', label: '1/4' },
];

function clampPanelPos(anchor: DOMRect | null, panelH: number): { top: number; left: number } {
  if (!anchor) return { top: 80, left: Math.max(VIEWPORT_PAD, (window.innerWidth - PANEL_W) / 2) };
  const gap = 10;
  let left = anchor.left - PANEL_W + anchor.width;
  if (left < VIEWPORT_PAD) left = anchor.right + gap;
  if (left + PANEL_W > window.innerWidth - VIEWPORT_PAD) {
    left = Math.max(VIEWPORT_PAD, (window.innerWidth - PANEL_W) / 2);
  }
  let top = anchor.bottom + gap;
  if (top + panelH > window.innerHeight - VIEWPORT_PAD) {
    top = Math.max(VIEWPORT_PAD, anchor.top - panelH - gap);
  }
  if (top < VIEWPORT_PAD) top = VIEWPORT_PAD;
  return { top, left };
}

export type StudioAllInOneFxPanelProps = {
  open: boolean;
  channelLabel: string;
  accentHex?: string;
  anchorRect: DOMRect | null;
  rack: StudioTrackInsertFxRack;
  onRackChange: (next: StudioTrackInsertFxRack) => void;
  onClose: () => void;
  /** Parent stores flush so F|X toggle can commit draft before unmount (no unmount effect). */
  onRegisterFlush?: (flush: (() => void) | null) => void;
  /** Project BPM — delay tempo sync + note divisions. */
  sessionBpm?: number;
  /** Mixer lane index — ties analyzer/meters to this track's audio. */
  trackIndex?: number;
};

export function StudioAllInOneFxPanel({
  open,
  channelLabel,
  accentHex = '#7cf4c6',
  anchorRect,
  rack,
  onRackChange,
  onClose,
  onRegisterFlush,
  sessionBpm = 120,
  trackIndex = 0,
}: StudioAllInOneFxPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [activeModule, setActiveModule] = useState<SuiteModuleId>('eq');
  const [presetId, setPresetId] = useState(STUDIO_FX_SUITE_PRESET_DEFAULT_ID);
  const [draftRack, setDraftRack] = useState(() => cloneStudioTrackInsertFxRack(rack));
  const draftRackRef = useRef(draftRack);
  const pushRackTimerRef = useRef(0);

  const resolveInitialPos = useCallback(
    () => clampPanelPos(anchorRect, PANEL_EST_H),
    [anchorRect],
  );

  const { pos, dragging, dragHandleProps } = useStudioFloatingPanelDrag({
    open,
    resolveInitialPos,
    panelRef,
    viewportPad: VIEWPORT_PAD,
  });

  const rackPropRef = useRef(rack);
  rackPropRef.current = rack;

  const onRackChangeRef = useRef(onRackChange);
  onRackChangeRef.current = onRackChange;

  useEffect(() => {
    if (!open) return;
    const synced = cloneStudioTrackInsertFxRack(rackPropRef.current);
    draftRackRef.current = synced;
    setDraftRack(synced);
    setPresetId(STUDIO_FX_SUITE_PRESET_DEFAULT_ID);
  }, [open, trackIndex]);

  const pushDraftRackToParent = useCallback((next: StudioTrackInsertFxRack) => {
    const cloned = cloneStudioTrackInsertFxRack(next);
    if (studioTrackInsertFxRacksEqual(cloned, rackPropRef.current)) return;
    onRackChangeRef.current(cloned);
  }, []);

  const flushRack = useCallback(() => {
    window.clearTimeout(pushRackTimerRef.current);
    pushDraftRackToParent(draftRackRef.current);
  }, [pushDraftRackToParent]);

  useEffect(() => {
    onRegisterFlush?.(flushRack);
    return () => onRegisterFlush?.(null);
  }, [flushRack, onRegisterFlush]);

  const patchRack = useCallback(
    (next: StudioTrackInsertFxRack, opts?: { immediate?: boolean }) => {
      draftRackRef.current = next;
      setDraftRack(next);
      window.clearTimeout(pushRackTimerRef.current);
      if (opts?.immediate) {
        pushDraftRackToParent(next);
        return;
      }
      pushRackTimerRef.current = window.setTimeout(() => {
        pushDraftRackToParent(next);
      }, SUITE_RACK_PUSH_MS);
    },
    [pushDraftRackToParent],
  );

  const applySuitePreset = useCallback(
    (id: string) => {
      const next = studioFxSuitePresetRack(id);
      patchRack(next, { immediate: true });
      setPresetId(id);
    },
    [patchRack],
  );

  const handleClose = useCallback(() => {
    flushRack();
    onClose();
  }, [flushRack, onClose]);

  const anyActive = draftRack.suiteOn && SUITE_MODULES.some((m) => suiteModuleEnabled(draftRack, m.id));
  const armedModuleLabels = SUITE_MODULES.filter((m) => suiteModuleEnabled(draftRack, m.id)).map(
    (m) => m.label,
  );
  const modMeta = SUITE_MODULES.find((m) => m.id === activeModule);
  const modAccent = modMeta?.accent ?? accentHex;

  useEffect(() => {
    if (!open) return;
    setStudioTrackAnalyserConsumer(trackIndex, 'fxSuite', true);
    return () => setStudioTrackAnalyserConsumer(trackIndex, 'fxSuite', false);
  }, [open, trackIndex]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, handleClose]);

  const toggleSuitePower = useCallback(() => {
    const r = draftRackRef.current;
    if (r.suiteOn) {
      patchRack(studioInsertFxSuiteMasterPowerOff(r), { immediate: true });
    } else {
      patchRack({ ...r, suiteOn: true }, { immediate: true });
    }
  }, [patchRack]);

  const toggleModule = useCallback(
    (id: SuiteModuleId) => {
      const r = draftRackRef.current;
      const armSuite = (next: StudioTrackInsertFxRack): StudioTrackInsertFxRack =>
        next.suiteOn ? next : { ...next, suiteOn: true };
      switch (id) {
        case 'eq': {
          const enabling = !r.eq.enabled;
          patchRack(armSuite({ ...r, eq: { ...r.eq, enabled: enabling } }), { immediate: true });
          break;
        }
        case 'gate': {
          const enabling = !r.gate.enabled;
          patchRack(armSuite({ ...r, gate: { ...r.gate, enabled: enabling } }), { immediate: true });
          break;
        }
        case 'deEsser': {
          const enabling = !r.deEsser.enabled;
          patchRack(armSuite({ ...r, deEsser: { ...r.deEsser, enabled: enabling } }), { immediate: true });
          break;
        }
        case 'compressor': {
          const enabling = !r.compressor.enabled;
          patchRack(armSuite({ ...r, compressor: { ...r.compressor, enabled: enabling } }), { immediate: true });
          break;
        }
        case 'saturation': {
          const enabling = !r.saturation.enabled;
          patchRack(armSuite({ ...r, saturation: { ...r.saturation, enabled: enabling } }), { immediate: true });
          break;
        }
        case 'filter': {
          const enabling = !r.filter.enabled;
          patchRack(armSuite({ ...r, filter: { ...r.filter, enabled: enabling } }), { immediate: true });
          break;
        }
        case 'chorus': {
          const enabling = !r.chorus.enabled;
          patchRack(armSuite({ ...r, chorus: { ...r.chorus, enabled: enabling } }), { immediate: true });
          break;
        }
        case 'delay': {
          const enabling = !r.delay.enabled;
          patchRack(armSuite({ ...r, delay: { ...r.delay, enabled: enabling } }), { immediate: true });
          break;
        }
        case 'reverb': {
          const enabling = !r.reverb.enabled;
          patchRack(armSuite({ ...r, reverb: { ...r.reverb, enabled: enabling } }), { immediate: true });
          break;
        }
        case 'limiter': {
          const enabling = !r.limiter.enabled;
          patchRack(armSuite({ ...r, limiter: { ...r.limiter, enabled: enabling } }), { immediate: true });
          break;
        }
      }
    },
    [patchRack],
  );

  if (!open || typeof document === 'undefined') return null;

  let moduleBody = null;
  if (activeModule === 'eq') {
    const eq = draftRack.eq;
    moduleBody = (
      <SuiteModuleShell
        top={
          <div className="flex flex-wrap items-center gap-0.5 leading-none">
            {STUDIO_EQ_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() =>
                  patchRack(
                    {
                      ...draftRack,
                      suiteOn: true,
                      eq: patchStudioEqBands({ ...eq, enabled: true }, p.bands),
                    },
                    { immediate: true },
                  )
                }
                className="suite-type-micro rounded px-1 py-px text-[5px] border"
                style={{
                  borderColor: '#333',
                  color: '#a8a8b8',
                  background: 'linear-gradient(180deg, #18181f 0%, #101018 100%)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        }
        viz={
          <FxSuiteChromeFrame className="overflow-hidden p-1 h-full">
            <StudioFxGraphicEq
              eq={eq}
              onEqChange={(next) => patchRack({ ...draftRackRef.current, eq: next }, { immediate: true })}
              trackIndex={trackIndex}
              meterActive={open}
              accent={modAccent}
            />
          </FxSuiteChromeFrame>
        }
        faders={eq.bands.map((band, bi) => {
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
                patchRack(
                  { ...draftRackRef.current, eq: patchStudioEqBands(eq, bands) },
                  { immediate: true },
                );
              }}
              format={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}`}
              accent={fill}
              disabled={!eq.enabled}
            />
          );
        })}
      />
    );
  } else if (activeModule === 'gate') {
    const gate = draftRack.gate;
    moduleBody = (
      <SuiteModuleShell
        viz={<GateMeter thresholdDb={gate.thresholdDb} floorDb={gate.floorDb} accent={modAccent} enabled={gate.enabled} trackIndex={trackIndex} meterActive={open} />}
        faders={
          <>
            <SuiteFader label="THR" min={-80} max={0} step={1} value={gate.thresholdDb} onChange={(thresholdDb) => patchRack({ ...draftRack, gate: { ...gate, thresholdDb } })} format={(v) => `${Math.round(v)}`} accent={modAccent} disabled={!gate.enabled} />
            <SuiteFader label="FLOOR" min={-80} max={-6} step={1} value={gate.floorDb} onChange={(floorDb) => patchRack({ ...draftRack, gate: { ...gate, floorDb } })} format={(v) => `${Math.round(v)}`} accent="#94a3b8" disabled={!gate.enabled} />
            <SuiteFader label="ATK" min={0.0005} max={0.05} step={0.0005} value={gate.attackSec} onChange={(attackSec) => patchRack({ ...draftRack, gate: { ...gate, attackSec } })} format={(v) => `${Math.round(v * 1000)}`} accent="#a78bfa" disabled={!gate.enabled} />
            <SuiteFader label="REL" min={0.02} max={0.8} step={0.01} value={gate.releaseSec} onChange={(releaseSec) => patchRack({ ...draftRack, gate: { ...gate, releaseSec } })} format={(v) => `${Math.round(v * 1000)}`} accent="#a78bfa" disabled={!gate.enabled} />
          </>
        }
      />
    );
  } else if (activeModule === 'deEsser') {
    const ess = draftRack.deEsser;
    moduleBody = (
      <SuiteModuleShell
        viz={
          <DeEsserViz
            freqHz={ess.freqHz}
            amount={ess.amount}
            accent={modAccent}
            enabled={ess.enabled}
            trackIndex={trackIndex}
            meterActive={open}
          />
        }
        faders={
          <>
            <SuiteFader
              label="FREQ"
              min={STUDIO_DEESSER_FREQ_MIN}
              max={STUDIO_DEESSER_FREQ_MAX}
              step={25}
              value={ess.freqHz}
              onChange={(freqHz) => patchRack({ ...draftRack, deEsser: { ...ess, freqHz } })}
              format={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`)}
              accent={modAccent}
              disabled={!ess.enabled}
            />
            <SuiteFader
              label="AMT"
              min={0}
              max={STUDIO_DEESSER_AMOUNT_MAX}
              step={0.01}
              value={ess.amount}
              onChange={(amount) => patchRack({ ...draftRack, deEsser: { ...ess, amount } })}
              format={(v) => `${Math.round(v * 100)}%`}
              accent="#94a3b8"
              disabled={!ess.enabled}
            />
          </>
        }
      />
    );
  } else if (activeModule === 'compressor') {
    const comp = draftRack.compressor;
    moduleBody = (
      <SuiteModuleShell
        viz={
          <CompTransferCurve
            thresholdDb={comp.thresholdDb}
            ratio={comp.ratio}
            kneeDb={comp.kneeDb}
            accent={modAccent}
            makeupDb={comp.makeupDb}
            enabled={comp.enabled}
            trackIndex={trackIndex}
            meterActive={open}
          />
        }
        faders={
          <>
            <SuiteFader label="THR" min={-48} max={0} step={1} value={comp.thresholdDb} onChange={(thresholdDb) => patchRack({ ...draftRack, compressor: { ...comp, thresholdDb } })} format={(v) => `${Math.round(v)}`} accent={modAccent} disabled={!comp.enabled} />
            <SuiteFader label="RATIO" min={1} max={20} step={0.5} value={comp.ratio} onChange={(ratio) => patchRack({ ...draftRack, compressor: { ...comp, ratio } })} format={(v) => `1:${v.toFixed(1)}`} accent="#94a3b8" disabled={!comp.enabled} />
            <SuiteFader label="ATK" min={0.0005} max={0.25} step={0.0005} value={comp.attackSec} onChange={(attackSec) => patchRack({ ...draftRack, compressor: { ...comp, attackSec } })} format={(v) => `${Math.round(v * 1000)}ms`} accent="#a78bfa" disabled={!comp.enabled} />
            <SuiteFader label="REL" min={0.02} max={1.2} step={0.01} value={comp.releaseSec} onChange={(releaseSec) => patchRack({ ...draftRack, compressor: { ...comp, releaseSec } })} format={(v) => `${Math.round(v * 1000)}ms`} accent="#a78bfa" disabled={!comp.enabled} />
            <SuiteFader label="MKUP" min={0} max={18} step={0.5} value={comp.makeupDb} onChange={(makeupDb) => patchRack({ ...draftRack, compressor: { ...comp, makeupDb } })} format={(v) => `+${v.toFixed(1)}`} accent="#7cf4c6" disabled={!comp.enabled} />
          </>
        }
      />
    );
  } else if (activeModule === 'saturation') {
    const sat = draftRack.saturation;
    moduleBody = (
      <SuiteModuleShell
        viz={
          <DriveWaveViz
            drive={sat.drive}
            tone={sat.tone}
            accent={modAccent}
            enabled={sat.enabled}
            trackIndex={trackIndex}
            meterActive={open}
          />
        }
        faders={
          <>
            <SuiteFader label="DRIVE" min={0} max={1} step={0.01} value={sat.drive} onChange={(drive) => patchRack({ ...draftRack, saturation: { ...sat, drive } })} format={(v) => `${Math.round(v * 100)}%`} accent={modAccent} disabled={!sat.enabled} />
            <SuiteFader label="TONE" min={0} max={1} step={0.01} value={sat.tone} onChange={(tone) => patchRack({ ...draftRack, saturation: { ...sat, tone } })} format={(v) => `${Math.round(v * 100)}%`} accent="#94a3b8" disabled={!sat.enabled} />
          </>
        }
      />
    );
  } else if (activeModule === 'filter') {
    const f = draftRack.filter;
    const patchFilter = (patch: Partial<typeof f>, immediate = false) =>
      patchRack({ ...draftRackRef.current, filter: normalizeStudioFilter({ ...f, ...patch }) }, { immediate });
    moduleBody = (
      <SuiteModuleShell
        viz={
          <FilterCutoffViz
            lowCutHz={f.lowCutHz}
            highCutHz={f.highCutHz}
            resonance={f.resonance}
            accent={modAccent}
            disabled={!f.enabled}
            trackIndex={trackIndex}
            meterActive={open}
            onChange={(patch) => patchFilter(patch)}
          />
        }
        faders={
          <>
            <SuiteFader
              label="LOW CUT"
              min={20}
              max={800}
              step={5}
              value={f.lowCutHz}
              onChange={(lowCutHz) => patchFilter({ lowCutHz }, true)}
              format={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`)}
              accent="#fbbf24"
              disabled={!f.enabled}
            />
            <SuiteFader
              label="HIGH CUT"
              min={0}
              max={1}
              step={0.002}
              value={
                Math.log(Math.max(400, f.highCutHz) / 400) / Math.log(18000 / 400)
              }
              onChange={(t) =>
                patchFilter(
                  {
                    highCutHz: Math.round(400 * Math.pow(18000 / 400, Math.max(0, Math.min(1, t)))),
                  },
                  true,
                )
              }
              format={(v) => {
                const hz = Math.round(400 * Math.pow(18000 / 400, Math.max(0, Math.min(1, v))));
                return hz >= 1000 ? `${(hz / 1000).toFixed(1)}k` : `${hz}`;
              }}
              accent={modAccent}
              disabled={!f.enabled}
            />
            <SuiteFader
              label="RES"
              min={0}
              max={1}
              step={0.01}
              value={f.resonance}
              onChange={(resonance) => patchFilter({ resonance })}
              format={(v) => `${Math.round(v * 100)}%`}
              accent="#94a3b8"
              disabled={!f.enabled}
            />
          </>
        }
      />
    );
  } else if (activeModule === 'chorus') {
    const ch = draftRack.chorus;
    moduleBody = (
      <SuiteModuleShell
        viz={
          <ChorusModViz
            mix={ch.mix}
            rateHz={ch.rateHz}
            depth={ch.depth}
            accent={modAccent}
            enabled={ch.enabled}
            trackIndex={trackIndex}
            meterActive={open}
          />
        }
        faders={
          <>
            <SuiteFader label="MIX" min={0} max={1} step={0.01} value={ch.mix} onChange={(mix) => patchRack({ ...draftRack, chorus: { ...ch, mix } })} format={(v) => `${Math.round(v * 100)}%`} accent={modAccent} disabled={!ch.enabled} />
            <SuiteFader label="RATE" min={0.1} max={8} step={0.05} value={ch.rateHz} onChange={(rateHz) => patchRack({ ...draftRack, chorus: { ...ch, rateHz } })} format={(v) => `${v.toFixed(1)}Hz`} accent="#94a3b8" disabled={!ch.enabled} />
            <SuiteFader label="DEPTH" min={0} max={1} step={0.01} value={ch.depth} onChange={(depth) => patchRack({ ...draftRack, chorus: { ...ch, depth } })} format={(v) => `${Math.round(v * 100)}%`} accent="#a78bfa" disabled={!ch.enabled} />
          </>
        }
      />
    );
  } else if (activeModule === 'delay') {
    const d = draftRack.delay;
    const patchDelay = (patch: Partial<typeof d>) => patchRack({ ...draftRack, delay: { ...d, ...patch } });
    moduleBody = (
      <SuiteModuleShell
        top={
          <div className="flex items-center gap-0.5 h-full overflow-hidden">
            <button
              type="button"
              disabled={!d.enabled}
              onClick={() => patchDelay({ syncToBpm: !d.syncToBpm })}
              className="rounded px-1 py-px text-[5px] font-black uppercase border shrink-0"
              style={{
                borderColor: d.syncToBpm ? `${modAccent}66` : '#333',
                background: d.syncToBpm ? `${modAccent}18` : '#101018',
                color: d.syncToBpm ? modAccent : '#6a6a78',
                opacity: d.enabled ? 1 : 0.45,
              }}
            >
              {d.syncToBpm ? 'TEMPO' : 'FREE'}
            </button>
            {d.syncToBpm
              ? SUITE_DELAY_NOTES.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={!d.enabled}
                    onClick={() => patchDelay({ note: opt.id, syncToBpm: true })}
                    className="rounded px-1 py-px text-[5px] font-bold border shrink-0"
                    style={{
                      borderColor: d.note === opt.id ? `${modAccent}88` : '#2a2a36',
                      background: d.note === opt.id ? `${modAccent}22` : '#0a0a10',
                      color: d.note === opt.id ? modAccent : '#7a7a8a',
                      opacity: d.enabled ? 1 : 0.45,
                    }}
                  >
                    {opt.label}
                  </button>
                ))
              : null}
            <span className="ml-auto text-[5px] font-mono truncate tabular-nums" style={{ color: '#5a5a68' }}>
              {padSamplerDelayTimeLabel(sessionBpm, d)}
            </span>
          </div>
        }
        viz={
          <DelayEchoViz
            mix={d.mix}
            feedback={d.feedback}
            accent={modAccent}
            syncLabel={d.syncToBpm ? d.note : undefined}
            enabled={d.enabled}
            trackIndex={trackIndex}
            meterActive={open}
          />
        }
        faders={
          <>
            <SuiteFader label="MIX" min={0} max={1} step={0.01} value={d.mix} onChange={(mix) => patchDelay({ mix })} format={(v) => `${Math.round(v * 100)}%`} accent={modAccent} disabled={!d.enabled} />
            <SuiteFader label="FB" min={0} max={0.92} step={0.01} value={d.feedback} onChange={(feedback) => patchDelay({ feedback })} format={(v) => `${Math.round(v * 100)}%`} accent="#94a3b8" disabled={!d.enabled} />
            {!d.syncToBpm ? (
              <SuiteFader
                label="TIME"
                min={20}
                max={1200}
                step={5}
                value={d.timeMs}
                onChange={(timeMs) => patchDelay({ timeMs, syncToBpm: false })}
                format={(v) => `${Math.round(v)}ms`}
                accent="#a78bfa"
                disabled={!d.enabled}
              />
            ) : (
              <SuiteFader
                label="SYNC"
                min={0}
                max={1}
                step={1}
                value={1}
                onChange={() => {}}
                format={() => `${padSamplerDelayTimeMs(sessionBpm, d)}ms`}
                accent="#a78bfa"
                disabled
              />
            )}
          </>
        }
      />
    );
  } else if (activeModule === 'reverb') {
    const rev = draftRack.reverb;
    moduleBody = (
      <SuiteModuleShell
        viz={
          <ReverbRoomViz
            mix={rev.mix}
            decaySec={rev.decaySec}
            accent={modAccent}
            enabled={rev.enabled}
            trackIndex={trackIndex}
            meterActive={open}
          />
        }
        faders={
          <>
            <SuiteFader label="MIX" min={0} max={1} step={0.01} value={rev.mix} onChange={(mix) => patchRack({ ...draftRack, reverb: { ...rev, mix } })} format={(v) => `${Math.round(v * 100)}%`} accent={modAccent} disabled={!rev.enabled} />
            <SuiteFader label="DECAY" min={0.2} max={4} step={0.05} value={rev.decaySec} onChange={(decaySec) => patchRack({ ...draftRack, reverb: { ...rev, decaySec } })} format={(v) => `${v.toFixed(1)}s`} accent="#c4b5fd" disabled={!rev.enabled} />
          </>
        }
      />
    );
  } else if (activeModule === 'limiter') {
    const lim = draftRack.limiter;
    moduleBody = (
      <SuiteModuleShell
        viz={
          <LimiterCeilingViz
            ceilingDb={lim.ceilingDb}
            accent={modAccent}
            enabled={lim.enabled}
            trackIndex={trackIndex}
            meterActive={open}
          />
        }
        faders={
          <>
            <SuiteFader label="CEIL" min={-12} max={0} step={0.5} value={lim.ceilingDb} onChange={(ceilingDb) => patchRack({ ...draftRack, limiter: { ...lim, ceilingDb } })} format={(v) => `${v.toFixed(1)}`} accent={modAccent} disabled={!lim.enabled} />
            <SuiteFader label="REL" min={0.01} max={0.4} step={0.01} value={lim.releaseSec} onChange={(releaseSec) => patchRack({ ...draftRack, limiter: { ...lim, releaseSec } })} format={(v) => `${Math.round(v * 1000)}ms`} accent="#94a3b8" disabled={!lim.enabled} />
          </>
        }
      />
    );
  }

  const armedCount = SUITE_MODULES.filter((m) => suiteModuleEnabled(draftRack, m.id)).length;

  return createPortal(
    <>
      <PadSamplerFxTCapStyles />
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: PANEL_Z - 1, background: 'rgba(0,0,0,0.35)' }}
        aria-hidden
      />
      <div
        ref={panelRef}
        data-studio-fx-suite
        className="fixed rounded-2xl select-none overflow-hidden flex flex-col pointer-events-auto"
        style={{
          top: pos.top,
          left: pos.left,
          width: PANEL_W,
          maxHeight: `calc(100vh - ${VIEWPORT_PAD * 2}px)`,
          zIndex: PANEL_Z,
          border: `2px solid ${CHROME.bezelHi}`,
          background: CHROME.frame,
          boxShadow: `
            0 0 0 1px rgba(0,0,0,0.8),
            0 32px 80px rgba(0,0,0,0.95),
            0 0 60px ${accentHex}18,
            inset 0 1px 0 rgba(255,255,255,0.08)
          `,
          fontFamily: SUITE_FONT_FAMILY,
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          data-no-drag
          aria-label="Close FX Suite"
          title="Close FX Suite"
          onClick={(e) => {
            e.stopPropagation();
            handleClose();
          }}
          className="absolute z-50 flex items-center justify-center rounded-md border pointer-events-auto"
          style={{
            top: 8,
            right: 8,
            width: 28,
            height: 28,
            borderColor: '#4a4a58',
            background: 'linear-gradient(180deg, #22222c 0%, #14141c 100%)',
            color: '#e8e8f0',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
          }}
        >
          <X size={15} strokeWidth={2.2} aria-hidden />
        </button>
        {/* Top chrome bar — drag handle */}
        <div
          className="shrink-0 px-3 py-2 flex items-center gap-2"
          title="Drag to move panel"
          aria-label="Drag to move FX Suite panel"
          {...dragHandleProps}
          style={{
            ...dragHandleProps.style,
            borderBottom: `1px solid ${CHROME.bezel}`,
            background: dragging
              ? 'linear-gradient(180deg, #282832 0%, #181820 60%, #101018 100%)'
              : 'linear-gradient(180deg, #1e1e28 0%, #12121a 60%, #0c0c12 100%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
        >
          <GripHorizontal size={13} style={{ color: '#5a5a68', flexShrink: 0 }} aria-hidden />
          <div className="shrink-0 flex flex-col" style={{ gap: 2 }}>
            <div className="flex items-center" style={{ gap: 5, marginLeft: -2 }}>
              <div
                className="shrink-0 flex items-center justify-center rounded-lg"
                style={{
                  width: 30,
                  height: 30,
                  background: `linear-gradient(135deg, ${accentHex}28 0%, ${accentHex}08 100%)`,
                  border: `1px solid ${accentHex}44`,
                  boxShadow: `0 0 20px ${accentHex}22`,
                }}
              >
                <Zap size={15} style={{ color: accentHex, filter: `drop-shadow(0 0 6px ${accentHex})` }} />
              </div>
              <div
                className="suite-type-title"
                style={{
                  fontSize: '22px',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  color: accentHex,
                  whiteSpace: 'nowrap',
                  marginLeft: -4,
                }}
              >
                DA FX Suite
              </div>
            </div>
            <span
              className="suite-type-micro leading-tight"
              style={{
                fontSize: '12px',
                fontWeight: 500,
                color: '#a8a8bc',
                textTransform: 'none',
                letterSpacing: '0.01em',
                lineHeight: 1.15,
                paddingLeft: 36,
              }}
            >
              multi effects processor
            </span>
            <label
              className="flex flex-col gap-1 mt-1"
              style={{ width: 220, marginLeft: 28, paddingLeft: 8 }}
              title="Load a full chain — arms multiple FX modules at once (EQ, comp, reverb, etc.)"
            >
              <span
                className="suite-type-micro leading-tight"
                style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#a8a8bc',
                  textTransform: 'none',
                  letterSpacing: '0.01em',
                }}
              >
                Chain preset
              </span>
              <select
                data-no-drag
                value={presetId}
                onChange={(e) => applySuitePreset(e.target.value)}
                className="suite-preset-select w-full rounded-md pl-2 pr-8 py-1 outline-none cursor-pointer truncate"
                style={{
                  fontFamily: SUITE_FONT_FAMILY,
                  fontSize: '12px',
                  fontWeight: 500,
                  letterSpacing: '0.01em',
                  textTransform: 'none',
                  lineHeight: 1.2,
                  minHeight: 30,
                  borderColor: `${accentHex}66`,
                }}
              >
                {STUDIO_FX_SUITE_PRESET_GROUPS.map((group) => (
                  <optgroup key={group} label={group}>
                    {STUDIO_FX_SUITE_PRESETS.filter((p) => p.group === group).map((p) => (
                      <option key={p.id} value={p.id} style={{ background: '#12121a', color: '#ececf4' }}>
                        {p.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <span
                className="leading-snug"
                style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  color: armedModuleLabels.length > 0 ? '#9ae6b4' : '#6a6a78',
                  letterSpacing: '0.02em',
                  lineHeight: 1.25,
                }}
              >
                {armedModuleLabels.length > 0
                  ? `Armed: ${armedModuleLabels.join(' · ')}`
                  : 'Default — no modules armed'}
              </span>
            </label>
          </div>
          <div className="min-w-0 flex-1" aria-hidden />
          <SuiteAnalogTubeControl
            level={draftRack.analogSaturation.level}
            onChange={(level) =>
              patchRack({ ...draftRackRef.current, analogSaturation: { level } })
            }
          />
          <div className="flex items-center gap-2 shrink-0">
            <FxModulePower
              compact
              on={draftRack.suiteOn}
              accent="#7cf4c6"
              onToggle={toggleSuitePower}
              label="Suite"
            />
            <div
              className="flex items-center gap-1.5 rounded-md px-2 py-1 border"
              style={{
                borderColor: anyActive ? '#3a5a48' : '#2a2a36',
                background: anyActive ? 'rgba(124,244,198,0.08)' : '#0a0a10',
              }}
            >
              <Power size={10} style={{ color: anyActive ? '#9ae6b4' : '#5a5a68' }} />
              <span className="suite-type-micro text-[7px]" style={{ color: anyActive ? '#9ae6b4' : '#5a5a68' }}>
                {draftRack.suiteOn ? `${armedCount} armed` : 'Bypassed'}
              </span>
            </div>
          </div>
        </div>

        {/* Hero analyzer */}
        <div className="shrink-0 px-3 pt-2 pb-2">
          <SuiteSpectrumAnalyzer rack={draftRack} accent={accentHex} armed={anyActive} trackIndex={trackIndex} meterActive={open} />
        </div>

        {/* Signal chain LEDs */}
        <div className="shrink-0 px-3 pb-1">
          <SuiteSignalChainStrip rack={draftRack} activeModule={activeModule} onSelect={setActiveModule} />
        </div>

        {/* Module draftRack — 500-series tiles */}
        <div className="shrink-0 px-3 pb-2 overflow-hidden">
          <div className="suite-type-micro text-[6px] mb-1" style={{ color: '#5a5a68', textTransform: 'none', letterSpacing: '0.06em' }}>
            Effect modules · double-click to arm
          </div>
          <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(10, minmax(0, 1fr))' }}>
            {SUITE_MODULES.map((m) => (
              <SuiteModuleRackTile
                key={m.id}
                id={m.id}
                label={m.label}
                accent={m.accent}
                on={suiteModuleEnabled(draftRack, m.id)}
                selected={activeModule === m.id}
                onClick={() => setActiveModule(m.id)}
                onDoubleClick={() => toggleModule(m.id)}
              />
            ))}
          </div>
        </div>

        {/* Active module bay — fixed height matches EQ footprint */}
        <div
          className="shrink-0 overflow-hidden mx-3 mb-2 rounded-xl flex flex-col"
          style={{
            height: SUITE_MODULE_BAY_H,
            border: `1px solid ${modAccent}33`,
            background: 'linear-gradient(180deg, #0c0c12 0%, #06060c 100%)',
            boxShadow: `inset 0 4px 16px rgba(0,0,0,0.5), 0 0 24px ${modAccent}0a`,
          }}
        >
          <div
            className="shrink-0 px-3 py-1 flex items-center justify-between gap-2 border-b"
            style={{
              borderColor: `${modAccent}22`,
              background: 'linear-gradient(90deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.3) 100%)',
            }}
          >
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span className="suite-type-title text-[10px] shrink-0" style={{ color: modAccent, textShadow: `0 0 10px ${modAccent}44` }}>
                {modMeta?.label}
              </span>
              {modMeta?.sub ? (
                <span className="suite-type-micro text-[7px] truncate" style={{ color: '#5a5a68' }}>
                  · {modMeta.sub}
                </span>
              ) : null}
            </div>
            <FxModulePower
              compact
              on={suiteModuleEnabled(draftRack, activeModule)}
              accent={modAccent}
              onToggle={() => toggleModule(activeModule)}
              label={modMeta?.label ?? 'FX'}
            />
          </div>
          <div className="flex-1 min-h-0 overflow-hidden px-3 py-2 flex flex-col">{moduleBody}</div>
        </div>

        {/* Footer status bar */}
        <div
          className="shrink-0 px-3 py-1.5 flex items-center justify-between border-t"
          style={{
            borderColor: CHROME.bezel,
            background: 'linear-gradient(0deg, #08080e 0%, #0c0c12 100%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
          }}
        >
          <div className="flex gap-1">
            {SUITE_MODULES.slice(0, 6).map((m) => (
              <span
                key={m.id}
                className="rounded-full"
                style={{
                  width: 4,
                  height: 4,
                  background: suiteModuleEnabled(draftRack, m.id) ? m.accent : '#2a2a34',
                  boxShadow: suiteModuleEnabled(draftRack, m.id) ? `0 0 4px ${m.accent}` : 'none',
                }}
              />
            ))}
          </div>
          <span className="suite-type-micro text-[8px]" style={{ color: anyActive ? '#9ae6b4' : '#5a5a68', textTransform: 'none', letterSpacing: '0.05em' }}>
            {draftRack.suiteOn
              ? anyActive
                ? 'Chain active — play to hear'
                : 'Suite on — arm modules to process'
              : 'Suite off — dry bypass'}
          </span>
        </div>
      </div>
    </>,
    document.body,
  );
}
