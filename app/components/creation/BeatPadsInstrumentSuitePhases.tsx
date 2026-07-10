'use client';

import type { ComponentProps, ReactNode } from 'react';
import {
  BeatPadsInstrumentAnalogKnob,
  BeatPadsInstrumentNormKnob,
  lpFreqFromKnobNorm,
  lpFreqKnobNorm,
} from '@/app/components/creation/BeatPadsInstrumentAnalogKnob';
import {
  BeatPadsFxSuiteFader,
  useBeatPadsFxMeterPulse,
} from '@/app/components/creation/BeatPadsFxSuiteInsert';
import {
  CompTransferCurve,
  DriveWaveViz,
  FilterCutoffViz,
  GateMeter,
  LimiterCeilingViz,
} from '@/app/components/studio/studioFxSuiteWidgets';
import type { BeatLabDrumPadVoiceOpts, BeatLabDrumPadVoiceParam } from '@/app/lib/creationStation/beatLabDrumPadVoice';
import { beatLabDrumPadVoiceParamValue } from '@/app/lib/creationStation/beatLabDrumPadVoice';
import type { PadSamplerFxRack } from '@/app/lib/creationStation/padSamplerFxRack';
import type { PadSamplerPlaybackOpts } from '@/app/lib/padSampleStorage';
import '@/app/styles/studioFxSuite.css';

export type BeatPadsInstrumentSoundPhase =
  | 'oscillator'
  | 'filter'
  | 'pitch'
  | 'amp'
  | 'dist'
  | 'amplifier';

export type BeatPadsInstrumentSuitePhaseProps = {
  phase: BeatPadsInstrumentSoundPhase;
  hasSample: boolean;
  samplerOpts: PadSamplerPlaybackOpts;
  fxRack: PadSamplerFxRack;
  padVoiceLocal: BeatLabDrumPadVoiceOpts;
  pushSampler: (next: PadSamplerPlaybackOpts) => void;
  pushFx: (next: PadSamplerFxRack) => void;
  pushDecay: (v: number) => void;
  pushSamplerPitch: (patch: Partial<PadSamplerPlaybackOpts>) => void;
  pushTune: (v: number) => void;
  pushVoiceParam: (param: BeatLabDrumPadVoiceParam, v: number) => void;
  decayDisplay: number;
};

function patchSampler(
  samplerOpts: PadSamplerPlaybackOpts,
  patch: Partial<PadSamplerPlaybackOpts>,
): PadSamplerPlaybackOpts {
  return { ...samplerOpts, ...patch };
}

function padLowCutHz(opts: PadSamplerPlaybackOpts): number {
  return opts.hpHz >= 25 ? Math.max(20, Math.min(800, opts.hpHz)) : 20;
}

function padHighCutHz(opts: PadSamplerPlaybackOpts): number {
  if (opts.lpHz <= 0 || opts.lpHz >= 19900) return 18000;
  return Math.max(400, Math.min(18000, opts.lpHz));
}

function padFilterResonance(opts: PadSamplerPlaybackOpts): number {
  return Math.max(0, Math.min(1, (opts.lpRes ?? 0) / 100));
}

function patchPadFilter(
  opts: PadSamplerPlaybackOpts,
  patch: { lowCutHz?: number; highCutHz?: number; resonance?: number },
): PadSamplerPlaybackOpts {
  const next = { ...opts };
  if (patch.lowCutHz !== undefined) {
    next.hpHz = patch.lowCutHz <= 20 ? 0 : Math.round(patch.lowCutHz);
  }
  if (patch.highCutHz !== undefined) {
    next.lpHz = patch.highCutHz >= 18000 ? 0 : Math.round(patch.highCutHz);
  }
  if (patch.resonance !== undefined) {
    next.lpRes = Math.round(Math.max(0, Math.min(1, patch.resonance)) * 100);
  }
  return next;
}

function InstKnob(props: ComponentProps<typeof BeatPadsInstrumentAnalogKnob>) {
  return <BeatPadsInstrumentAnalogKnob {...props} />;
}

/** Activity 0–1 for IN/OUT pulse meters — rises as you turn phase knobs. */
function instrumentPhaseMeterActivity(props: BeatPadsInstrumentSuitePhaseProps): number {
  const { phase, hasSample, samplerOpts, fxRack, decayDisplay } = props;
  if (!hasSample) return 0;
  const base = 0.32;
  switch (phase) {
    case 'oscillator':
      return Math.min(
        1,
        base + (samplerOpts.triggerSnap ?? 0) * 0.5 + ((samplerOpts.color ?? 0) / 100) * 0.28,
      );
    case 'filter': {
      const lpOn = samplerOpts.lpHz >= 200 && samplerOpts.lpHz < 19900;
      const lpAmt = lpOn
        ? 0.22 + (1 - Math.min(1, (samplerOpts.lpHz - 200) / 13800)) * 0.38
        : 0;
      const res = ((samplerOpts.lpRes ?? 0) / 100) * 0.42;
      const env = ((samplerOpts.lpEnvDepth ?? 0) / 100) * 0.36;
      const hp = samplerOpts.hpHz >= 25 ? 0.18 : 0;
      return Math.min(1, base + lpAmt + res + env + hp);
    }
    case 'pitch':
      return Math.min(
        1,
        base +
          (Math.abs(samplerOpts.fineSemi ?? 0) / 12) * 0.42 +
          ((samplerOpts.pitchEnvDepth ?? 0) / 100) * 0.36 +
          ((samplerOpts.pitchPunch ?? 0) / 100) * 0.32,
      );
    case 'amp':
      return Math.min(
        1,
        base +
          ((100 - decayDisplay) / 100) * 0.28 +
          ((samplerOpts.ampAccent ?? 0) / 100) * 0.32 +
          ((100 - (samplerOpts.velToLevel ?? 100)) / 100) * 0.18,
      );
    case 'dist':
      return Math.min(
        1,
        base +
          fxRack.drive * 0.52 +
          (fxRack.compressor.enabled ? 0.28 : 0) +
          (Math.abs(samplerOpts.distOffset ?? 0) / 100) * 0.28,
      );
    default:
      return Math.min(
        1,
        base +
          ((samplerOpts.padLevel ?? 100) / 150) * 0.4 +
          ((samplerOpts.fxSend ?? 100) / 100) * 0.12,
      );
  }
}

/** Compact column fader — Instrument AMP tab. */
function ColFader(props: ComponentProps<typeof BeatPadsFxSuiteFader>) {
  return <BeatPadsFxSuiteFader faderHeight={56} {...props} />;
}

function InstrumentVizShell({ children }: { children: ReactNode }) {
  return (
    <div
      data-studio-fx-suite
      className="beat-pads-instrument-suite beat-pads-instrument-suite--viz-only"
      style={{ width: '100%', minWidth: 0, flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}
    >
      <div className="beat-pads-instrument-suite__viz beat-pads-instrument-suite__viz--full flex-1 min-h-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function buildInstrumentViz(
  props: BeatPadsInstrumentSuitePhaseProps,
  simMeterPeak: number,
): ReactNode {
  const { phase, hasSample, samplerOpts, fxRack, decayDisplay } = props;
  const filterAccent = '#38bdf8';
  const oscAccent = '#58c4ff';
  const pitchAccent = '#f87171';
  const ampAccent = '#86efac';
  const distAccent = '#fb923c';

  if (phase === 'oscillator') {
    const click = samplerOpts.triggerSnap ?? 0;
    const tone = Math.max(0, Math.min(1, (samplerOpts.color ?? 0) / 100));
    return (
      <DriveWaveViz
        drive={click}
        tone={tone}
        accent={oscAccent}
        enabled={hasSample}
        simMeterPeak={simMeterPeak}
      />
    );
  }

  if (phase === 'filter') {
    return (
      <FilterCutoffViz
        lowCutHz={padLowCutHz(samplerOpts)}
        highCutHz={padHighCutHz(samplerOpts)}
        resonance={padFilterResonance(samplerOpts)}
        accent={filterAccent}
        disabled={!hasSample}
        simMeterPeak={simMeterPeak}
        onChange={(patch) => props.pushSampler(patchPadFilter(samplerOpts, patch))}
      />
    );
  }

  if (phase === 'pitch') {
    const tune = samplerOpts.fineSemi ?? 0;
    const drive = Math.min(1, Math.abs(tune) / 12);
    const envDepth = Math.max(0, Math.min(1, (samplerOpts.pitchEnvDepth ?? 0) / 100));
    const punch = Math.max(0, Math.min(1, (samplerOpts.pitchPunch ?? 0) / 100));
    return (
      <DriveWaveViz
        drive={Math.max(drive, punch * 0.65)}
        tone={envDepth}
        accent={pitchAccent}
        enabled={hasSample}
        simMeterPeak={simMeterPeak}
      />
    );
  }

  if (phase === 'amp') {
    const thrDb = -48 + (decayDisplay / 100) * 40;
    return (
      <GateMeter
        thresholdDb={thrDb}
        floorDb={-48 + (100 - decayDisplay) * 0.35}
        accent={ampAccent}
        enabled={hasSample}
        simMeterPeak={simMeterPeak}
      />
    );
  }

  if (phase === 'dist') {
    const comp = fxRack.compressor;
    const distOn = fxRack.drive > 0.02 || comp.enabled || Math.abs(samplerOpts.distOffset ?? 0) > 0.5;
    const tone = Math.max(0, Math.min(1, ((samplerOpts.tone ?? 0) + 100) / 200));
    if (comp.enabled && fxRack.drive < 0.08) {
      return (
        <CompTransferCurve
          thresholdDb={comp.thresholdDb}
          ratio={comp.ratio}
          kneeDb={comp.kneeDb}
          accent={distAccent}
          makeupDb={comp.makeupDb}
          enabled={hasSample && (comp.enabled || distOn)}
          simMeterPeak={simMeterPeak}
        />
      );
    }
    return (
      <DriveWaveViz
        drive={Math.max(fxRack.drive, 0.08)}
        tone={tone}
        accent={distAccent}
        enabled={hasSample}
        simMeterPeak={simMeterPeak}
      />
    );
  }

  const level = samplerOpts.padLevel ?? 100;
  const ceilingDb = -6 + ((150 - level) / 150) * 12;
  return (
    <LimiterCeilingViz
      ceilingDb={ceilingDb}
      accent={ampAccent}
      enabled={hasSample && level > 0}
      simMeterPeak={simMeterPeak}
    />
  );
}

function buildInstrumentKnobs(props: BeatPadsInstrumentSuitePhaseProps): ReactNode {
  const {
    phase,
    hasSample,
    samplerOpts,
    fxRack,
    padVoiceLocal,
    pushSampler,
    pushFx,
    pushDecay,
    pushSamplerPitch,
    pushTune,
    pushVoiceParam,
    decayDisplay,
  } = props;
  const filterAccent = '#38bdf8';
  const oscAccent = '#58c4ff';
  const pitchAccent = '#f87171';
  const ampAccent = '#86efac';
  const distAccent = '#fb923c';

  if (phase === 'oscillator') {
    return (
      <>
        <InstKnob
          label="CLICK"
          min={0}
          max={100}
          step={1}
          value={Math.round((samplerOpts.triggerSnap ?? 0) * 100)}
          onChange={(v) =>
            pushSampler(patchSampler(samplerOpts, { triggerSnap: Math.max(0, Math.min(1, v / 100)) }))
          }
          format={(v) => `${Math.round(v)}%`}
          accent={oscAccent}
          disabled={!hasSample}
        />
        <InstKnob
          label="START"
          min={0}
          max={95}
          step={1}
          value={Math.round(samplerOpts.trim0 * 100)}
          onChange={(v) => {
            const t0 = Math.min(0.95, v / 100);
            let t1 = samplerOpts.trim1;
            if (t1 <= t0 + 0.02) t1 = Math.min(1, t0 + 0.08);
            pushSampler(patchSampler(samplerOpts, { trim0: t0, trim1: t1 }));
          }}
          format={(v) => `${Math.round(v)}%`}
          accent={oscAccent}
          disabled={!hasSample}
        />
        <InstKnob
          label="END"
          min={5}
          max={100}
          step={1}
          value={Math.round(samplerOpts.trim1 * 100)}
          onChange={(v) => {
            const t1 = Math.max(0.05, Math.min(1, v / 100));
            let t0 = samplerOpts.trim0;
            if (t1 <= t0 + 0.02) t0 = Math.max(0, t1 - 0.08);
            pushSampler(patchSampler(samplerOpts, { trim0: t0, trim1: t1 }));
          }}
          format={(v) => `${Math.round(v)}%`}
          accent={oscAccent}
          disabled={!hasSample}
        />
        <InstKnob
          label="COLOR"
          min={0}
          max={100}
          step={1}
          value={Math.round(samplerOpts.color ?? 0)}
          onChange={(v) => pushSampler(patchSampler(samplerOpts, { color: Math.round(v) }))}
          format={(v) => `${Math.round(v)}%`}
          accent={oscAccent}
          disabled={!hasSample}
        />
      </>
    );
  }

  if (phase === 'filter') {
    const lpHz = samplerOpts.lpHz;
    const lpDec = samplerOpts.lpEnvDecayMs ?? 120;
    return (
      <>
        <BeatPadsInstrumentNormKnob
          label="LP FREQ"
          norm={lpFreqKnobNorm(lpHz)}
          onNormChange={(n) =>
            pushSampler(patchSampler(samplerOpts, { lpHz: lpFreqFromKnobNorm(n) }))
          }
          display={
            lpHz <= 0 ? 'OFF' : lpHz >= 1000 ? `${(lpHz / 1000).toFixed(1)}k` : `${Math.round(lpHz)}`
          }
          accent="#fbbf24"
        />
        <InstKnob
          label="LP RES"
          min={0}
          max={100}
          step={1}
          value={Math.round(samplerOpts.lpRes ?? 0)}
          onChange={(v) => pushSampler(patchSampler(samplerOpts, { lpRes: Math.round(v) }))}
          format={(v) => `${Math.round(v)}%`}
          accent={filterAccent}
        />
        <InstKnob
          label="LP ENV"
          min={0}
          max={100}
          step={1}
          value={Math.round(samplerOpts.lpEnvDepth ?? 0)}
          onChange={(v) => pushSampler(patchSampler(samplerOpts, { lpEnvDepth: Math.round(v) }))}
          format={(v) => `${Math.round(v)}%`}
          accent={filterAccent}
        />
        <InstKnob
          label="LP DEC"
          min={5}
          max={2000}
          step={1}
          scale="log"
          value={Math.round(lpDec)}
          onChange={(v) => pushSampler(patchSampler(samplerOpts, { lpEnvDecayMs: Math.round(v) }))}
          format={(v) => `${Math.round(v)}ms`}
          accent="#94a3b8"
        />
      </>
    );
  }

  if (phase === 'pitch') {
    const tune = samplerOpts.fineSemi ?? 0;
    return (
      <>
        <InstKnob
          label="TUNE"
          min={-12}
          max={12}
          step={1}
          value={tune}
          onChange={(v) => pushTune(v)}
          format={(v) => `${v > 0 ? '+' : ''}${Math.round(v)} st`}
          accent={pitchAccent}
          disabled={!hasSample}
        />
        <InstKnob
          label="ENV DEC"
          min={5}
          max={2000}
          step={5}
          value={Math.round(samplerOpts.pitchEnvDecayMs ?? 80)}
          onChange={(v) => pushSamplerPitch({ pitchEnvDecayMs: Math.round(v) })}
          format={(v) => `${Math.round(v)}ms`}
          accent={pitchAccent}
          disabled={!hasSample}
        />
        <InstKnob
          label="ENV DEP"
          min={0}
          max={100}
          step={1}
          value={Math.round(samplerOpts.pitchEnvDepth ?? 0)}
          onChange={(v) => pushSamplerPitch({ pitchEnvDepth: Math.round(v) })}
          format={(v) => `${Math.round(v)}%`}
          accent={pitchAccent}
          disabled={!hasSample}
        />
        <InstKnob
          label="PUNCH"
          min={0}
          max={100}
          step={1}
          value={Math.round(samplerOpts.pitchPunch ?? 0)}
          onChange={(v) => pushSamplerPitch({ pitchPunch: Math.round(v) })}
          format={(v) => `${Math.round(v)}%`}
          accent={pitchAccent}
          disabled={!hasSample}
        />
      </>
    );
  }

  if (phase === 'amp') {
    return (
      <>
        <InstKnob
          label="DECAY"
          min={0}
          max={100}
          step={1}
          value={decayDisplay}
          onChange={(v) => pushDecay(v)}
          format={(v) => `${Math.round(v)}%`}
          accent={ampAccent}
          disabled={!hasSample}
        />
        <InstKnob
          label="ACCENT"
          min={0}
          max={100}
          step={1}
          value={Math.round(samplerOpts.ampAccent ?? 0)}
          onChange={(v) => pushSampler(patchSampler(samplerOpts, { ampAccent: Math.round(v) }))}
          format={(v) => `${Math.round(v)}%`}
          accent={ampAccent}
        />
        <InstKnob
          label="VEL→LEV"
          min={0}
          max={100}
          step={1}
          value={Math.round(samplerOpts.velToLevel ?? 100)}
          onChange={(v) => pushSampler(patchSampler(samplerOpts, { velToLevel: Math.round(v) }))}
          format={(v) => `${Math.round(v)}%`}
          accent={ampAccent}
        />
        <InstKnob
          label="VEL"
          min={1}
          max={127}
          step={1}
          value={beatLabDrumPadVoiceParamValue(padVoiceLocal, 'velocity')}
          onChange={(v) => pushVoiceParam('velocity', v)}
          format={(v) => `${Math.round(v)}`}
          accent={ampAccent}
        />
      </>
    );
  }

  if (phase === 'dist') {
    const comp = fxRack.compressor;
    return (
      <>
        <InstKnob
          label="DRIVE"
          min={0}
          max={100}
          step={1}
          value={Math.round(fxRack.drive * 100)}
          onChange={(v) =>
            pushFx({
              ...fxRack,
              drive: Math.max(0, Math.min(1, v / 100)),
            })
          }
          format={(v) => `${Math.round(v)}%`}
          accent={distAccent}
        />
        <InstKnob
          label="OFFSET"
          min={-100}
          max={100}
          step={1}
          value={Math.round(samplerOpts.distOffset ?? 0)}
          onChange={(v) => pushSampler(patchSampler(samplerOpts, { distOffset: Math.round(v) }))}
          format={(v) => `${Math.round(v)}`}
          accent={distAccent}
          disabled={!hasSample}
        />
        <InstKnob
          label="COMP"
          min={-48}
          max={0}
          step={1}
          value={comp.thresholdDb}
          onChange={(v) =>
            pushFx({
              ...fxRack,
              compressor: { ...comp, enabled: true, thresholdDb: Math.round(v) },
            })
          }
          format={(v) => `${Math.round(v)}`}
          accent={distAccent}
        />
        <InstKnob
          label="MKUP"
          min={0}
          max={18}
          step={1}
          value={Math.round(comp.makeupDb)}
          onChange={(v) =>
            pushFx({
              ...fxRack,
              compressor: { ...comp, enabled: true, makeupDb: Math.round(v) },
            })
          }
          format={(v) => `+${Math.round(v)}`}
          accent="#7cf4c6"
        />
      </>
    );
  }

  const level = samplerOpts.padLevel ?? 100;
  return (
    <>
      <ColFader
        label="LEVEL"
        min={0}
        max={150}
        step={1}
        value={Math.round(level)}
        onChange={(v) => pushSampler(patchSampler(samplerOpts, { padLevel: Math.round(v) }))}
        format={(v) => `${Math.round(v)}%`}
        accent={ampAccent}
      />
      <ColFader
        label="FX"
        min={0}
        max={100}
        step={1}
        value={Math.round(samplerOpts.fxSend ?? 100)}
        onChange={(v) => pushSampler(patchSampler(samplerOpts, { fxSend: Math.round(v) }))}
        format={(v) => `${Math.round(v)}%`}
        accent={ampAccent}
      />
      <ColFader
        label="PAN"
        min={-100}
        max={100}
        step={1}
        value={Math.round(samplerOpts.padPan ?? 0)}
        onChange={(v) => pushSampler(patchSampler(samplerOpts, { padPan: Math.round(v) }))}
        format={(v) => `${v > 0 ? '+' : ''}${Math.round(v)}`}
        accent={ampAccent}
      />
      <ColFader
        label="TONE"
        min={-100}
        max={100}
        step={1}
        value={Math.round(samplerOpts.tone ?? 0)}
        onChange={(v) => pushSampler(patchSampler(samplerOpts, { tone: Math.round(v) }))}
        format={(v) => `${v > 0 ? '+' : ''}${Math.round(v)}`}
        accent={ampAccent}
        disabled={!hasSample}
      />
    </>
  );
}

/** Full-width SE2-style graph + meters (Instrument tab main area). */
export function BeatPadsInstrumentSuiteViz(props: BeatPadsInstrumentSuitePhaseProps) {
  const activity = instrumentPhaseMeterActivity(props);
  const pulse = useBeatPadsFxMeterPulse(activity, props.hasSample);
  const simMeterPeak = Math.max(pulse.inputL, pulse.inputR, pulse.mid * 0.9, pulse.outputL * 0.95);
  return (
    <InstrumentVizShell>{buildInstrumentViz(props, simMeterPeak)}</InstrumentVizShell>
  );
}

/** Four phase analog knobs — compact row under instrument viz. */
export function BeatPadsInstrumentSuiteKnobs(props: BeatPadsInstrumentSuitePhaseProps) {
  return (
    <div className="beat-pads-instrument-phase-knobs" data-studio-fx-suite>
      {buildInstrumentKnobs(props)}
    </div>
  );
}

/** @deprecated Use BeatPadsInstrumentSuiteKnobs */
export function BeatPadsInstrumentSuiteFaders(props: BeatPadsInstrumentSuitePhaseProps) {
  return <BeatPadsInstrumentSuiteKnobs {...props} />;
}

/** Instrument viz + phase knobs (full edit body — limiter lives on its own tab). */
export function BeatPadsInstrumentSuitePanel(props: BeatPadsInstrumentSuitePhaseProps) {
  return (
    <div
      data-studio-fx-suite
      className="beat-pads-instrument-suite beat-pads-instrument-suite--with-knobs"
      style={{
        width: '100%',
        minWidth: 0,
        flex: '1 1 auto',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <BeatPadsInstrumentSuiteViz {...props} />
      <BeatPadsInstrumentSuiteKnobs {...props} />
    </div>
  );
}

/** @deprecated Use BeatPadsInstrumentSuitePanel — kept for compatibility. */
export function BeatPadsInstrumentSuitePhase(props: BeatPadsInstrumentSuitePhaseProps) {
  return <BeatPadsInstrumentSuitePanel {...props} />;
}
