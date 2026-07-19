/**
 * Studio Editor 2 — per-track insert FX parameters (mixer slots).
 */

import type { MixerEffectId } from '@/app/screens/components/ChannelStripFxDropdowns';
import type {
  StudioFxStackSlot,
} from '@/app/lib/studio/studioFxStackOrder';
import { normalizeFxStackOrder } from '@/app/lib/studio/studioFxStackOrder';
import type {
  PadSamplerCompressorFx,
  PadSamplerDelayFx,
  PadSamplerReverbFx,
} from '@/app/lib/creationStation/padSamplerFxRack';
import {
  defaultPadSamplerFxRack,
  DEESSER_AMOUNT_MAX,
  DEESSER_FREQ_MAX_HZ,
  DEESSER_FREQ_MIN_HZ,
} from '@/app/lib/creationStation/padSamplerFxRack';
import {
  defaultStudioEq,
  normalizeStudioEq,
  STUDIO_EQ_PRESETS,
  type StudioEqFx,
} from '@/app/lib/studio/studioEq';
import {
  defaultStudioSpectrumForgeFx,
  normalizeStudioSpectrumForgeFx,
  studioSpectrumForgeActive,
  type StudioSpectrumForgeFx,
} from '@/app/lib/studio/studioSpectrumForge';

export type StudioGateFx = {
  enabled: boolean;
  /** dB −80 … 0 */
  thresholdDb: number;
  /** dB −80 … −6 floor when gated */
  floorDb: number;
  attackSec: number;
  releaseSec: number;
};

export type StudioSaturationFx = {
  enabled: boolean;
  drive: number;
  tone: number;
};

export type StudioFilterFx = {
  enabled: boolean;
  /** HPF — rolls off below this Hz */
  lowCutHz: number;
  /** LPF — rolls off above this Hz */
  highCutHz: number;
  resonance: number;
};

export function normalizeStudioFilter(
  raw: Partial<StudioFilterFx> & { cutoffHz?: number } | null | undefined,
): StudioFilterFx {
  const legacyCutoff = raw && 'cutoffHz' in raw ? raw.cutoffHz : undefined;
  let lowCutHz = raw?.lowCutHz ?? 40;
  let highCutHz = raw?.highCutHz ?? legacyCutoff ?? 16000;
  lowCutHz = Math.max(20, Math.min(800, lowCutHz));
  highCutHz = Math.max(400, Math.min(18000, highCutHz));
  if (highCutHz < lowCutHz + 200) highCutHz = lowCutHz + 200;
  return {
    enabled: raw?.enabled ?? false,
    lowCutHz,
    highCutHz,
    resonance: Math.max(0, Math.min(1, raw?.resonance ?? 0.35)),
  };
}

export type StudioLimiterFx = {
  enabled: boolean;
  ceilingDb: number;
  releaseSec: number;
};

export type StudioChorusFx = {
  enabled: boolean;
  rateHz: number;
  depth: number;
  mix: number;
};

export {
  DEESSER_AMOUNT_MAX as STUDIO_DEESSER_AMOUNT_MAX,
  DEESSER_FREQ_MAX_HZ as STUDIO_DEESSER_FREQ_MAX,
  DEESSER_FREQ_MIN_HZ as STUDIO_DEESSER_FREQ_MIN,
} from '@/app/lib/creationStation/padSamplerFxRack';

/** Split-band sibilance control — runs before compressor in the suite chain. */
export type StudioDeEsserFx = {
  enabled: boolean;
  /** Sibilance / hiss focus ~2.5k–16k Hz. */
  freqHz: number;
  /** Reduction strength 0…150%. */
  amount: number;
};

/** Gentle master warmth — post entire FX chain (header tube control). */
export type StudioAnalogSaturationFx = {
  /** 0…1 — subtle tube warmth; 0 bypasses. */
  level: number;
};

export const STUDIO_ANALOG_SAT_MAX = 1;

/** Full rack of insert parameters — one per track. */
export type StudioTrackInsertFxRack = {
  /** Master DA FX Suite power — when false, audio bypasses the entire chain. */
  suiteOn: boolean;
  eq: StudioEqFx;
  deEsser: StudioDeEsserFx;
  analogSaturation: StudioAnalogSaturationFx;
  compressor: PadSamplerCompressorFx;
  gate: StudioGateFx;
  reverb: PadSamplerReverbFx;
  delay: PadSamplerDelayFx;
  saturation: StudioSaturationFx;
  filter: StudioFilterFx;
  limiter: StudioLimiterFx;
  chorus: StudioChorusFx;
  /** Spectrum Forge — movable L/M/H band reinforcement (standalone SE2 insert). */
  spectrumForge: StudioSpectrumForgeFx;
  /** F|X picker order — top row = first in chain. */
  fxStackOrder?: readonly StudioFxStackSlot[];
};

export { STUDIO_EQ_PRESETS };

/** All suite modules off by default — user arms Pitch Tune/Vocoder or inserts as needed. */
export function defaultStudioTrackInsertFxRack(): StudioTrackInsertFxRack {
  const base = defaultPadSamplerFxRack();
  return {
    suiteOn: false,
    eq: defaultStudioEq(),
    deEsser: { enabled: false, freqHz: 6500, amount: 0.55 },
    analogSaturation: { level: 0 },
    compressor: { ...base.compressor, enabled: false, deEsserEnabled: false },
    gate: {
      enabled: false,
      thresholdDb: -42,
      floorDb: -72,
      attackSec: 0.002,
      releaseSec: 0.12,
    },
    reverb: { ...base.reverb, enabled: false, mix: 0.28, decaySec: 1.4 },
    delay: { ...base.delay, enabled: false },
    saturation: { enabled: false, drive: 0.22, tone: 0.55 },
    filter: { enabled: false, lowCutHz: 40, highCutHz: 16000, resonance: 0.35 },
    limiter: { enabled: false, ceilingDb: -1, releaseSec: 0.08 },
    chorus: { enabled: false, rateHz: 0.8, depth: 0.45, mix: 0.35 },
    spectrumForge: defaultStudioSpectrumForgeFx(),
  };
}

export function normalizeStudioAnalogSaturation(
  raw: Partial<StudioAnalogSaturationFx> | null | undefined,
): StudioAnalogSaturationFx {
  return {
    level: Math.max(0, Math.min(STUDIO_ANALOG_SAT_MAX, raw?.level ?? 0)),
  };
}

export function normalizeStudioDeEsser(
  raw: Partial<StudioDeEsserFx> | null | undefined,
  legacyComp?: PadSamplerCompressorFx,
): StudioDeEsserFx {
  return {
    enabled: Boolean(raw?.enabled ?? legacyComp?.deEsserEnabled),
    freqHz: Math.max(DEESSER_FREQ_MIN_HZ, Math.min(DEESSER_FREQ_MAX_HZ, raw?.freqHz ?? legacyComp?.deEsserFreqHz ?? 6500)),
    amount: Math.max(0, Math.min(DEESSER_AMOUNT_MAX, raw?.amount ?? legacyComp?.deEsserAmount ?? 0.55)),
  };
}

export function normalizeStudioCompressor(comp: PadSamplerCompressorFx): PadSamplerCompressorFx {
  return {
    enabled: Boolean(comp.enabled),
    thresholdDb: Math.max(-48, Math.min(0, comp.thresholdDb)),
    ratio: Math.max(1, Math.min(20, comp.ratio)),
    attackSec: Math.max(0.0005, Math.min(0.95, comp.attackSec)),
    releaseSec: Math.max(0.02, Math.min(1.2, comp.releaseSec)),
    kneeDb: Math.max(0, Math.min(40, comp.kneeDb)),
    makeupDb: Math.max(0, Math.min(18, comp.makeupDb)),
    deEsserEnabled: false,
    deEsserFreqHz: 6500,
    deEsserAmount: 0.55,
  };
}

export function cloneStudioTrackInsertFxRack(r: StudioTrackInsertFxRack): StudioTrackInsertFxRack {
  const legacy = r as StudioTrackInsertFxRack & { deEsser?: Partial<StudioDeEsserFx>; suiteOn?: boolean };
  const deEsser = normalizeStudioDeEsser(legacy.deEsser, r.compressor);
  return {
    suiteOn: legacy.suiteOn === true,
    eq: normalizeStudioEq(r.eq),
    deEsser,
    analogSaturation: normalizeStudioAnalogSaturation(
      (r as StudioTrackInsertFxRack & { analogSaturation?: Partial<StudioAnalogSaturationFx> }).analogSaturation,
    ),
    compressor: normalizeStudioCompressor(r.compressor),
    gate: { ...r.gate },
    reverb: { ...r.reverb },
    delay: { ...r.delay },
    saturation: { ...r.saturation },
    filter: normalizeStudioFilter(r.filter),
    limiter: { ...r.limiter },
    chorus: { ...r.chorus },
    spectrumForge: normalizeStudioSpectrumForgeFx(
      (r as StudioTrackInsertFxRack & { spectrumForge?: Partial<StudioSpectrumForgeFx> }).spectrumForge,
    ),
    fxStackOrder: normalizeFxStackOrder(
      (r as StudioTrackInsertFxRack & { fxStackOrder?: readonly string[] }).fxStackOrder,
    ),
  };
}

/** Normalized deep compare — skips redundant mixer state / audio rebuilds. */
export function studioTrackInsertFxRacksEqual(
  a: StudioTrackInsertFxRack,
  b: StudioTrackInsertFxRack,
): boolean {
  return JSON.stringify(cloneStudioTrackInsertFxRack(a)) === JSON.stringify(cloneStudioTrackInsertFxRack(b));
}

export function studioInsertFxParamsForId(
  rack: StudioTrackInsertFxRack,
  id: MixerEffectId,
): unknown {
  switch (id) {
    case 'eq':
      return rack.eq;
    case 'compressor':
      return rack.compressor;
    case 'deEsser':
      return rack.deEsser;
    case 'gate':
      return rack.gate;
    case 'reverb':
      return rack.reverb;
    case 'delay':
      return rack.delay;
    case 'saturation':
      return rack.saturation;
    case 'filter':
      return rack.filter;
    case 'limiter':
      return rack.limiter;
    case 'chorus':
      return rack.chorus;
    default:
      return null;
  }
}

export function studioActiveInsertFxIds(
  slots: readonly [MixerEffectId, MixerEffectId, MixerEffectId],
): MixerEffectId[] {
  return slots.filter((id): id is MixerEffectId => id !== '');
}

/** Merge mixer slot picks into rack enabled flags (slots arm modules for the audio graph). */
export function studioEffectiveInsertFxRack(
  rack: StudioTrackInsertFxRack,
  slots: readonly [MixerEffectId, MixerEffectId, MixerEffectId],
): StudioTrackInsertFxRack {
  const r = cloneStudioTrackInsertFxRack(rack);
  if (!studioInsertFxSuitePowered(r)) return r;
  for (const id of slots) {
    switch (id) {
      case 'eq':
        r.eq.enabled = true;
        break;
      case 'compressor':
        r.compressor.enabled = true;
        break;
      case 'gate':
        r.gate.enabled = true;
        break;
      case 'reverb':
        r.reverb.enabled = true;
        break;
      case 'delay':
        r.delay.enabled = true;
        break;
      case 'chorus':
        r.chorus.enabled = true;
        break;
      case 'saturation':
        r.saturation.enabled = true;
        break;
      case 'filter':
        r.filter.enabled = true;
        break;
      case 'limiter':
        r.limiter.enabled = true;
        break;
      default:
        break;
    }
  }
  return r;
}

/** Arm one insert module when user picks it in the mixer slot row. */
export function studioArmInsertFxRackForSlot(
  rack: StudioTrackInsertFxRack,
  id: MixerEffectId,
): StudioTrackInsertFxRack {
  return studioEffectiveInsertFxRack(rack, [id, '', ''] as [MixerEffectId, MixerEffectId, MixerEffectId]);
}

/** Master suite power switch — off forces hard bypass regardless of module toggles. */
export function studioInsertFxSuitePowered(rack: StudioTrackInsertFxRack): boolean {
  return rack.suiteOn === true;
}

/** Master power off — hard bypass only. Keep module params / armed flags for A/B recall. */
export function studioInsertFxSuiteMasterPowerOff(
  rack: StudioTrackInsertFxRack,
): StudioTrackInsertFxRack {
  const base = cloneStudioTrackInsertFxRack(rack);
  return {
    ...base,
    suiteOn: false,
  };
}

/** True when any DA FX Suite module is armed (excludes Spectrum Forge + vocal FX). */
export function studioInsertFxSuiteActive(rack: StudioTrackInsertFxRack): boolean {
  return (
    rack.eq.enabled ||
    rack.deEsser.enabled ||
    rack.compressor.enabled ||
    rack.gate.enabled ||
    rack.reverb.enabled ||
    rack.delay.enabled ||
    rack.chorus.enabled ||
    (rack.saturation.enabled && rack.saturation.drive > 0.01) ||
    rack.filter.enabled ||
    rack.limiter.enabled ||
    rack.analogSaturation.level > 0.004
  );
}

/** True when DA FX Suite is powered on and at least one module is armed. */
export function studioInsertFxRackActive(rack: StudioTrackInsertFxRack): boolean {
  if (!studioInsertFxSuitePowered(rack)) return false;
  return studioInsertFxSuiteActive(rack);
}
