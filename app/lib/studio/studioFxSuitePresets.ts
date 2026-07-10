/**
 * DA FX Suite — full-chain multi-effect presets (EQ → gate → de-ess → comp → …).
 * Each preset arms a professional module combination with tuned parameters.
 */

import type { PadSamplerDelayFx, PadSamplerReverbFx } from '@/app/lib/creationStation/padSamplerFxRack';
import { defaultStudioEqBands, patchStudioEqBands, STUDIO_EQ_PRESETS, type StudioEqBand } from '@/app/lib/studio/studioEq';
import {
  cloneStudioTrackInsertFxRack,
  defaultStudioTrackInsertFxRack,
  normalizeStudioFilter,
  type StudioAnalogSaturationFx,
  type StudioChorusFx,
  type StudioDeEsserFx,
  type StudioFilterFx,
  type StudioGateFx,
  type StudioLimiterFx,
  type StudioSaturationFx,
  type StudioTrackInsertFxRack,
} from '@/app/lib/studio/studioTrackInsertFx';
import type { PadSamplerCompressorFx } from '@/app/lib/creationStation/padSamplerFxRack';

export const STUDIO_FX_SUITE_PRESET_DEFAULT_ID = 'default';

export type StudioFxSuitePresetGroup =
  | 'Default'
  | 'Vocals'
  | 'Instruments'
  | 'Drums'
  | 'Mix & Master'
  | 'Creative';

export type StudioFxSuitePreset = {
  id: string;
  label: string;
  group: StudioFxSuitePresetGroup;
  rack: StudioTrackInsertFxRack;
};

type RackPatch = {
  eq?: { enabled: boolean; gains?: number[]; bands?: StudioEqBand[] };
  deEsser?: Partial<StudioDeEsserFx> & { enabled: boolean };
  gate?: Partial<StudioGateFx> & { enabled: boolean };
  compressor?: Partial<PadSamplerCompressorFx> & { enabled: boolean };
  saturation?: Partial<StudioSaturationFx> & { enabled: boolean };
  filter?: Partial<StudioFilterFx> & { enabled: boolean };
  chorus?: Partial<StudioChorusFx> & { enabled: boolean };
  delay?: Partial<PadSamplerDelayFx> & { enabled: boolean };
  reverb?: Partial<PadSamplerReverbFx> & { enabled: boolean };
  limiter?: Partial<StudioLimiterFx> & { enabled: boolean };
  analogSaturation?: Partial<StudioAnalogSaturationFx>;
};

/** Shorthand EQ gains on the 8-band grid: 50 · 100 · 200 · 500 · 1K · 2K · 5K · 10K Hz */
function g(
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number,
  h: number,
  i: number,
): number[] {
  return [a, b, c, d, e, f, h, i];
}

function eqBandsFromPresetId(id: string): StudioEqBand[] | undefined {
  return STUDIO_EQ_PRESETS.find((p) => p.id === id)?.bands;
}

type MixProfile = 'default' | 'vocal' | 'instrument' | 'drum' | 'bus' | 'creative';

function mixProfileForGroup(group: StudioFxSuitePresetGroup): MixProfile {
  switch (group) {
    case 'Vocals':
      return 'vocal';
    case 'Instruments':
      return 'instrument';
    case 'Drums':
      return 'drum';
    case 'Mix & Master':
      return 'bus';
    case 'Creative':
      return 'creative';
    default:
      return 'default';
  }
}

function clampEqGainForMix(gainDb: number, freqHz: number, profile: MixProfile): number {
  if (profile === 'default') return gainDb;
  if (profile === 'drum') {
    if (freqHz <= 80) return Math.max(-8, Math.min(2.5, gainDb));
    if (freqHz <= 200) return Math.max(-8, Math.min(3, gainDb));
    return Math.max(-9, Math.min(5, gainDb));
  }
  if (profile === 'bus') return Math.max(-4, Math.min(2, gainDb));
  if (profile === 'vocal') {
    if (freqHz <= 120) return Math.max(-6, Math.min(1.5, gainDb));
    return Math.max(-8, Math.min(6, gainDb));
  }
  if (profile === 'instrument') {
    if (freqHz <= 120) return Math.max(-6, Math.min(3.5, gainDb));
    return Math.max(-8, Math.min(5.5, gainDb));
  }
  if (freqHz <= 120) return Math.max(-10, Math.min(5, gainDb));
  return Math.max(-10, Math.min(7, gainDb));
}

/** Tame preset extremes so chains sit in a mix without blowing low end or gain. */
function balanceFxSuiteRackForMix(
  rack: StudioTrackInsertFxRack,
  group: StudioFxSuitePresetGroup,
): StudioTrackInsertFxRack {
  const profile = mixProfileForGroup(group);
  if (profile === 'default') return rack;

  const r = cloneStudioTrackInsertFxRack(rack);

  if (r.eq.enabled) {
    r.eq = {
      ...r.eq,
      bands: r.eq.bands.map((band) => ({
        ...band,
        gainDb: clampEqGainForMix(band.gainDb, band.freqHz, profile),
      })),
    };
  }

  if (r.compressor.enabled) {
    const makeupCap = profile === 'drum' ? 4.5 : profile === 'bus' ? 3 : profile === 'creative' ? 8 : 6.5;
    r.compressor = { ...r.compressor, makeupDb: Math.min(r.compressor.makeupDb, makeupCap) };
  }

  if (r.saturation.enabled) {
    const driveCap = profile === 'drum' ? 0.28 : profile === 'creative' ? 0.35 : 0.22;
    r.saturation = { ...r.saturation, drive: Math.min(r.saturation.drive, driveCap) };
  }

  if (r.analogSaturation.level > 0) {
    const satCap = profile === 'bus' ? 0.12 : profile === 'creative' ? 0.25 : 0.18;
    r.analogSaturation = { ...r.analogSaturation, level: Math.min(r.analogSaturation.level, satCap) };
  }

  if (r.reverb.enabled) {
    const mixCap = profile === 'drum' ? 0.12 : profile === 'bus' ? 0.1 : 0.24;
    r.reverb = { ...r.reverb, mix: Math.min(r.reverb.mix, mixCap) };
  }

  if (r.delay.enabled) {
    const mixCap = profile === 'drum' ? 0.1 : 0.2;
    r.delay = { ...r.delay, mix: Math.min(r.delay.mix, mixCap) };
  }

  return r;
}

function buildFxSuiteRack(patch: RackPatch): StudioTrackInsertFxRack {
  const r = defaultStudioTrackInsertFxRack();

  if (patch.eq) {
    let eq = { ...r.eq, enabled: patch.eq.enabled };
    if (patch.eq.bands) {
      eq = patchStudioEqBands(eq, patch.eq.bands);
    } else if (patch.eq.gains) {
      const bands = defaultStudioEqBands().map((band, i) => ({
        ...band,
        gainDb: patch.eq!.gains![i] ?? 0,
      }));
      eq = patchStudioEqBands(eq, bands);
    }
    r.eq = eq;
  }

  if (patch.deEsser) r.deEsser = { ...r.deEsser, ...patch.deEsser };
  if (patch.gate) r.gate = { ...r.gate, ...patch.gate };
  if (patch.compressor) r.compressor = { ...r.compressor, ...patch.compressor };
  if (patch.saturation) r.saturation = { ...r.saturation, ...patch.saturation };
  if (patch.filter) r.filter = normalizeStudioFilter({ ...r.filter, ...patch.filter });
  if (patch.chorus) r.chorus = { ...r.chorus, ...patch.chorus };
  if (patch.delay) r.delay = { ...r.delay, ...patch.delay };
  if (patch.reverb) r.reverb = { ...r.reverb, ...patch.reverb };
  if (patch.limiter) r.limiter = { ...r.limiter, ...patch.limiter };
  if (patch.analogSaturation) r.analogSaturation = { ...r.analogSaturation, ...patch.analogSaturation };

  r.suiteOn = true;
  return cloneStudioTrackInsertFxRack(r);
}

function preset(id: string, label: string, group: StudioFxSuitePresetGroup, patch: RackPatch): StudioFxSuitePreset {
  return { id, label, group, rack: balanceFxSuiteRackForMix(buildFxSuiteRack(patch), group) };
}

/** 40 full-chain presets — Default + 39 pro chains. */
export const STUDIO_FX_SUITE_PRESETS: StudioFxSuitePreset[] = [
  {
    id: STUDIO_FX_SUITE_PRESET_DEFAULT_ID,
    label: 'Default',
    group: 'Default',
    rack: defaultStudioTrackInsertFxRack(),
  },

  // —— Vocals (14) ——
  preset('vocal-rnb-sweet', 'Sweet Spot R&B Vocal', 'Vocals', {
    eq: { enabled: true, gains: g(-2.5, -2, -0.5, 0.5, 1.2, 2.8, 2.2, 2.5) },
    filter: { enabled: true, lowCutHz: 85, highCutHz: 16000, resonance: 0.3 },
    deEsser: { enabled: true, freqHz: 6800, amount: 0.48 },
    gate: { enabled: true, thresholdDb: -46, floorDb: -72, attackSec: 0.003, releaseSec: 0.14 },
    compressor: { enabled: true, thresholdDb: -22, ratio: 3.2, attackSec: 0.012, releaseSec: 0.18, kneeDb: 6, makeupDb: 4 },
    saturation: { enabled: true, drive: 0.14, tone: 0.62 },
    reverb: { enabled: true, mix: 0.14, decaySec: 1.1 },
    limiter: { enabled: true, ceilingDb: -1.5, releaseSec: 0.1 },
    analogSaturation: { level: 0.12 },
  }),
  preset('vocal-pop-lead', 'Modern Pop Lead', 'Vocals', {
    eq: { enabled: true, gains: g(-2, -1.5, 0, 0.5, 1.5, 3, 3.5, 4) },
    filter: { enabled: true, lowCutHz: 95, highCutHz: 17000, resonance: 0.28 },
    deEsser: { enabled: true, freqHz: 7200, amount: 0.52 },
    compressor: { enabled: true, thresholdDb: -20, ratio: 4, attackSec: 0.008, releaseSec: 0.14, kneeDb: 4, makeupDb: 5 },
    saturation: { enabled: true, drive: 0.1, tone: 0.58 },
    delay: { enabled: true, syncToBpm: true, note: '1/8', feedback: 0.22, mix: 0.08 },
    reverb: { enabled: true, mix: 0.18, decaySec: 1.6 },
    limiter: { enabled: true, ceilingDb: -1, releaseSec: 0.08 },
  }),
  preset('vocal-radio-pop', 'Radio Ready Pop', 'Vocals', {
    eq: { enabled: true, gains: g(-3, -2, 0, 1, 2, 3.5, 3, 3.5) },
    filter: { enabled: true, lowCutHz: 100, highCutHz: 16500, resonance: 0.25 },
    deEsser: { enabled: true, freqHz: 7500, amount: 0.58 },
    compressor: { enabled: true, thresholdDb: -18, ratio: 5, attackSec: 0.006, releaseSec: 0.12, kneeDb: 3, makeupDb: 6.5 },
    saturation: { enabled: true, drive: 0.16, tone: 0.55 },
    chorus: { enabled: true, rateHz: 0.6, depth: 0.22, mix: 0.12 },
    reverb: { enabled: true, mix: 0.12, decaySec: 0.9 },
    limiter: { enabled: true, ceilingDb: -0.8, releaseSec: 0.06 },
    analogSaturation: { level: 0.08 },
  }),
  preset('vocal-ballad', 'Smooth Ballad Vocal', 'Vocals', {
    eq: { enabled: true, bands: eqBandsFromPresetId('warm') },
    filter: { enabled: true, lowCutHz: 70, highCutHz: 15000, resonance: 0.32 },
    deEsser: { enabled: true, freqHz: 6200, amount: 0.4 },
    compressor: { enabled: true, thresholdDb: -24, ratio: 2.5, attackSec: 0.02, releaseSec: 0.28, kneeDb: 8, makeupDb: 3 },
    saturation: { enabled: true, drive: 0.08, tone: 0.68 },
    reverb: { enabled: true, mix: 0.26, decaySec: 2.4 },
    chorus: { enabled: true, rateHz: 0.45, depth: 0.35, mix: 0.18 },
    analogSaturation: { level: 0.18 },
  }),
  preset('vocal-rap-aggressive', 'Aggressive Rap Vocal', 'Vocals', {
    eq: { enabled: true, gains: g(-4, -3, -1, 1.5, 2.5, 4, 3, 2) },
    filter: { enabled: true, lowCutHz: 110, highCutHz: 14000, resonance: 0.4 },
    deEsser: { enabled: true, freqHz: 7000, amount: 0.62 },
    gate: { enabled: true, thresholdDb: -38, floorDb: -68, attackSec: 0.001, releaseSec: 0.08 },
    compressor: { enabled: true, thresholdDb: -16, ratio: 6, attackSec: 0.003, releaseSec: 0.1, kneeDb: 2, makeupDb: 7 },
    saturation: { enabled: true, drive: 0.28, tone: 0.48 },
    limiter: { enabled: true, ceilingDb: -0.5, releaseSec: 0.05 },
  }),
  preset('vocal-podcast', 'Podcast / Voiceover', 'Vocals', {
    eq: { enabled: true, gains: g(-3, -2, 0.5, 1.5, 2.5, 2, 0.5, -1) },
    filter: { enabled: true, lowCutHz: 80, highCutHz: 12000, resonance: 0.25 },
    deEsser: { enabled: true, freqHz: 6500, amount: 0.45 },
    gate: { enabled: true, thresholdDb: -44, floorDb: -75, attackSec: 0.004, releaseSec: 0.2 },
    compressor: { enabled: true, thresholdDb: -26, ratio: 3, attackSec: 0.015, releaseSec: 0.22, kneeDb: 10, makeupDb: 4 },
    limiter: { enabled: true, ceilingDb: -2, releaseSec: 0.12 },
  }),
  preset('vocal-broadcast', 'Broadcast News Anchor', 'Vocals', {
    eq: { enabled: true, gains: g(-4, -2.5, 0, 2, 3, 2.5, 1, -2) },
    filter: { enabled: true, lowCutHz: 90, highCutHz: 11000, resonance: 0.3 },
    deEsser: { enabled: true, freqHz: 6000, amount: 0.5 },
    compressor: { enabled: true, thresholdDb: -22, ratio: 4.5, attackSec: 0.01, releaseSec: 0.16, kneeDb: 5, makeupDb: 5.5 },
    limiter: { enabled: true, ceilingDb: -1.2, releaseSec: 0.08 },
  }),
  preset('vocal-jazz-warm', 'Warm Jazz Vocal', 'Vocals', {
    eq: { enabled: true, bands: eqBandsFromPresetId('warm') },
    filter: { enabled: true, lowCutHz: 65, highCutHz: 14500, resonance: 0.35 },
    deEsser: { enabled: true, freqHz: 5800, amount: 0.35 },
    compressor: { enabled: true, thresholdDb: -28, ratio: 2.2, attackSec: 0.025, releaseSec: 0.32, kneeDb: 12, makeupDb: 2.5 },
    reverb: { enabled: true, mix: 0.22, decaySec: 2.8 },
    analogSaturation: { level: 0.22 },
  }),
  preset('vocal-edm-topline', 'Bright EDM Topline', 'Vocals', {
    eq: { enabled: true, bands: eqBandsFromPresetId('bright') },
    filter: { enabled: true, lowCutHz: 120, highCutHz: 18000, resonance: 0.22 },
    deEsser: { enabled: true, freqHz: 7800, amount: 0.55 },
    compressor: { enabled: true, thresholdDb: -19, ratio: 4.5, attackSec: 0.005, releaseSec: 0.11, kneeDb: 3, makeupDb: 6 },
    saturation: { enabled: true, drive: 0.12, tone: 0.52 },
    delay: { enabled: true, syncToBpm: true, note: '1/4', feedback: 0.28, mix: 0.12 },
    reverb: { enabled: true, mix: 0.2, decaySec: 1.8 },
    limiter: { enabled: true, ceilingDb: -0.6, releaseSec: 0.05 },
  }),
  preset('vocal-indie-bedroom', 'Indie Bedroom Vocal', 'Vocals', {
    eq: { enabled: true, gains: g(-1.5, -1, 0.5, 1, 1.5, 2, 1.5, 1) },
    filter: { enabled: true, lowCutHz: 75, highCutHz: 13500, resonance: 0.38 },
    deEsser: { enabled: true, freqHz: 6400, amount: 0.38 },
    compressor: { enabled: true, thresholdDb: -25, ratio: 2.8, attackSec: 0.018, releaseSec: 0.24, kneeDb: 9, makeupDb: 3.5 },
    saturation: { enabled: true, drive: 0.2, tone: 0.65 },
    reverb: { enabled: true, mix: 0.3, decaySec: 2.2 },
    chorus: { enabled: true, rateHz: 0.55, depth: 0.42, mix: 0.22 },
    analogSaturation: { level: 0.15 },
  }),
  preset('vocal-gospel-power', 'Gospel Power Vocal', 'Vocals', {
    eq: { enabled: true, gains: g(-2, -1, 1, 2, 3, 4, 3.5, 3) },
    filter: { enabled: true, lowCutHz: 80, highCutHz: 16000, resonance: 0.3 },
    deEsser: { enabled: true, freqHz: 6600, amount: 0.5 },
    compressor: { enabled: true, thresholdDb: -21, ratio: 3.8, attackSec: 0.01, releaseSec: 0.2, kneeDb: 6, makeupDb: 5 },
    saturation: { enabled: true, drive: 0.18, tone: 0.6 },
    reverb: { enabled: true, mix: 0.32, decaySec: 3.2 },
    delay: { enabled: true, syncToBpm: true, note: '1/4', feedback: 0.18, mix: 0.1 },
    analogSaturation: { level: 0.14 },
  }),
  preset('vocal-latin-pop', 'Latin Pop Vocal', 'Vocals', {
    eq: { enabled: true, gains: g(-2, -1.5, 0, 1, 2, 3, 3.2, 3.8) },
    filter: { enabled: true, lowCutHz: 88, highCutHz: 16800, resonance: 0.28 },
    deEsser: { enabled: true, freqHz: 7100, amount: 0.5 },
    compressor: { enabled: true, thresholdDb: -20, ratio: 3.6, attackSec: 0.009, releaseSec: 0.15, kneeDb: 5, makeupDb: 4.5 },
    saturation: { enabled: true, drive: 0.15, tone: 0.57 },
    delay: { enabled: true, syncToBpm: true, note: '1/8', feedback: 0.2, mix: 0.1 },
    reverb: { enabled: true, mix: 0.16, decaySec: 1.4 },
    chorus: { enabled: true, rateHz: 0.7, depth: 0.28, mix: 0.14 },
  }),
  preset('vocal-lofi-whisper', 'Lo-Fi Whisper Vocal', 'Vocals', {
    eq: { enabled: true, gains: g(1, 1.5, 1, 0, -1, -1.5, -2, -3) },
    filter: { enabled: true, lowCutHz: 120, highCutHz: 6500, resonance: 0.55 },
    deEsser: { enabled: false, freqHz: 6500, amount: 0.3 },
    compressor: { enabled: true, thresholdDb: -30, ratio: 2, attackSec: 0.03, releaseSec: 0.35, kneeDb: 14, makeupDb: 2 },
    saturation: { enabled: true, drive: 0.32, tone: 0.72 },
    reverb: { enabled: true, mix: 0.24, decaySec: 1.6 },
    analogSaturation: { level: 0.28 },
  }),
  preset('vocal-live-stage', 'Live Stage Vocal', 'Vocals', {
    eq: { enabled: true, bands: eqBandsFromPresetId('vocal') },
    filter: { enabled: true, lowCutHz: 100, highCutHz: 15500, resonance: 0.32 },
    deEsser: { enabled: true, freqHz: 6900, amount: 0.55 },
    gate: { enabled: true, thresholdDb: -40, floorDb: -70, attackSec: 0.002, releaseSec: 0.1 },
    compressor: { enabled: true, thresholdDb: -17, ratio: 5.5, attackSec: 0.004, releaseSec: 0.09, kneeDb: 2.5, makeupDb: 7.5 },
    limiter: { enabled: true, ceilingDb: -1, releaseSec: 0.06 },
  }),

  // —— Instruments (10) ——
  preset('inst-acoustic-guitar', 'Acoustic Guitar Body', 'Instruments', {
    eq: { enabled: true, gains: g(-1, 0, 1.5, 2, 1.5, 0.5, 1, 2) },
    filter: { enabled: true, lowCutHz: 70, highCutHz: 15000, resonance: 0.3 },
    compressor: { enabled: true, thresholdDb: -26, ratio: 2.5, attackSec: 0.02, releaseSec: 0.25, kneeDb: 10, makeupDb: 2.5 },
    reverb: { enabled: true, mix: 0.12, decaySec: 1.5 },
  }),
  preset('inst-electric-crunch', 'Electric Guitar Crunch', 'Instruments', {
    eq: { enabled: true, gains: g(2, 3, 2, 0, -1, 1.5, 3, 2) },
    filter: { enabled: true, lowCutHz: 90, highCutHz: 12000, resonance: 0.45 },
    saturation: { enabled: true, drive: 0.42, tone: 0.42 },
    compressor: { enabled: true, thresholdDb: -22, ratio: 4, attackSec: 0.008, releaseSec: 0.14, kneeDb: 4, makeupDb: 4 },
    limiter: { enabled: true, ceilingDb: -1.5, releaseSec: 0.08 },
  }),
  preset('inst-bass-di', 'Clean Bass DI', 'Instruments', {
    eq: { enabled: true, bands: eqBandsFromPresetId('bass') },
    filter: { enabled: true, lowCutHz: 35, highCutHz: 8000, resonance: 0.35 },
    compressor: { enabled: true, thresholdDb: -24, ratio: 3.5, attackSec: 0.015, releaseSec: 0.2, kneeDb: 6, makeupDb: 3 },
    saturation: { enabled: true, drive: 0.18, tone: 0.5 },
    limiter: { enabled: true, ceilingDb: -2, releaseSec: 0.1 },
  }),
  preset('inst-piano-clarity', 'Piano Clarity', 'Instruments', {
    eq: { enabled: true, gains: g(0, 0, 0.5, 1, 1.5, 1, 0.5, 1.5) },
    filter: { enabled: true, lowCutHz: 40, highCutHz: 16000, resonance: 0.25 },
    compressor: { enabled: true, thresholdDb: -28, ratio: 2, attackSec: 0.025, releaseSec: 0.3, kneeDb: 12, makeupDb: 2 },
    reverb: { enabled: true, mix: 0.1, decaySec: 1.8 },
  }),
  preset('inst-synth-lead', 'Synth Lead Presence', 'Instruments', {
    eq: { enabled: true, bands: eqBandsFromPresetId('bright') },
    filter: { enabled: true, lowCutHz: 120, highCutHz: 17000, resonance: 0.28 },
    chorus: { enabled: true, rateHz: 0.9, depth: 0.38, mix: 0.28 },
    delay: { enabled: true, syncToBpm: true, note: '1/8', feedback: 0.25, mix: 0.14 },
    compressor: { enabled: true, thresholdDb: -23, ratio: 3, attackSec: 0.01, releaseSec: 0.16, kneeDb: 6, makeupDb: 3.5 },
  }),
  preset('inst-sub-weight', 'Sub Bass Weight', 'Instruments', {
    eq: { enabled: true, gains: g(5, 4, 2, 0, -2, -3, -4, -5) },
    filter: { enabled: true, lowCutHz: 28, highCutHz: 4200, resonance: 0.4 },
    saturation: { enabled: true, drive: 0.22, tone: 0.38 },
    compressor: { enabled: true, thresholdDb: -20, ratio: 4, attackSec: 0.02, releaseSec: 0.22, kneeDb: 5, makeupDb: 3 },
    limiter: { enabled: true, ceilingDb: -2.5, releaseSec: 0.12 },
  }),
  preset('inst-brass-section', 'Brass Section', 'Instruments', {
    eq: { enabled: true, gains: g(-1, 0, 1, 2, 2.5, 2, 1.5, 1) },
    filter: { enabled: true, lowCutHz: 80, highCutHz: 14000, resonance: 0.32 },
    compressor: { enabled: true, thresholdDb: -22, ratio: 3.2, attackSec: 0.012, releaseSec: 0.18, kneeDb: 7, makeupDb: 3.5 },
    reverb: { enabled: true, mix: 0.14, decaySec: 2 },
  }),
  preset('inst-strings-warmth', 'String Section Warmth', 'Instruments', {
    eq: { enabled: true, bands: eqBandsFromPresetId('warm') },
    filter: { enabled: true, lowCutHz: 60, highCutHz: 15000, resonance: 0.3 },
    reverb: { enabled: true, mix: 0.2, decaySec: 2.6 },
    chorus: { enabled: true, rateHz: 0.35, depth: 0.3, mix: 0.2 },
  }),
  preset('inst-hand-perc', 'Hand Perc Detail', 'Instruments', {
    eq: { enabled: true, gains: g(-2, 0, 2, 3, 2, 1, 2.5, 3) },
    filter: { enabled: true, lowCutHz: 100, highCutHz: 16000, resonance: 0.35 },
    compressor: { enabled: true, thresholdDb: -20, ratio: 3.5, attackSec: 0.004, releaseSec: 0.08, kneeDb: 4, makeupDb: 4 },
    saturation: { enabled: true, drive: 0.12, tone: 0.55 },
  }),
  preset('inst-ukulele-bright', 'Ukulele / Pluck Bright', 'Instruments', {
    eq: { enabled: true, gains: g(-3, -1, 1, 2.5, 3, 2, 3.5, 4) },
    filter: { enabled: true, lowCutHz: 100, highCutHz: 16500, resonance: 0.28 },
    reverb: { enabled: true, mix: 0.08, decaySec: 1.2 },
  }),

  // —— Drums (6) ——
  preset('drum-kick-punch', 'Punchy Kick Drum', 'Drums', {
    eq: { enabled: true, gains: g(3, 2.5, 1, -2, -3, 0, 2, 1) },
    filter: { enabled: true, lowCutHz: 30, highCutHz: 9000, resonance: 0.42 },
    saturation: { enabled: true, drive: 0.35, tone: 0.45 },
    compressor: { enabled: true, thresholdDb: -18, ratio: 5, attackSec: 0.002, releaseSec: 0.06, kneeDb: 2, makeupDb: 5 },
    limiter: { enabled: true, ceilingDb: -1, releaseSec: 0.05 },
  }),
  preset('drum-snare-crack', 'Snare Crack', 'Drums', {
    eq: { enabled: true, gains: g(-3, -1, 2, 4, 3, 5, 4, 2) },
    filter: { enabled: true, lowCutHz: 80, highCutHz: 14000, resonance: 0.38 },
    saturation: { enabled: true, drive: 0.25, tone: 0.5 },
    compressor: { enabled: true, thresholdDb: -16, ratio: 4.5, attackSec: 0.003, releaseSec: 0.07, kneeDb: 3, makeupDb: 5.5 },
  }),
  preset('drum-hihat-air', 'Hi-Hat Air', 'Drums', {
    eq: { enabled: true, gains: g(-6, -4, -2, 0, 1, 2, 4, 5) },
    filter: { enabled: true, lowCutHz: 200, highCutHz: 18000, resonance: 0.25 },
    gate: { enabled: true, thresholdDb: -35, floorDb: -65, attackSec: 0.001, releaseSec: 0.05 },
  }),
  preset('drum-room-bus', 'Drum Room Bus', 'Drums', {
    eq: { enabled: true, gains: g(1, 1.5, 1, 0.5, 0, -0.5, 1, 1.5) },
    compressor: { enabled: true, thresholdDb: -14, ratio: 3, attackSec: 0.008, releaseSec: 0.12, kneeDb: 4, makeupDb: 4 },
    saturation: { enabled: true, drive: 0.2, tone: 0.52 },
    reverb: { enabled: true, mix: 0.08, decaySec: 0.8 },
    limiter: { enabled: true, ceilingDb: -1.5, releaseSec: 0.08 },
  }),
  preset('drum-808-sub', '808 Sub Thump', 'Drums', {
    eq: { enabled: true, gains: g(4, 3.5, 1.5, -3, -5, -4, -3, -4) },
    filter: { enabled: true, lowCutHz: 25, highCutHz: 3500, resonance: 0.5 },
    saturation: { enabled: true, drive: 0.38, tone: 0.35 },
    compressor: { enabled: true, thresholdDb: -22, ratio: 4, attackSec: 0.015, releaseSec: 0.18, kneeDb: 5, makeupDb: 4 },
    limiter: { enabled: true, ceilingDb: -2, releaseSec: 0.1 },
  }),
  preset('drum-overheads', 'Overhead Shimmer', 'Drums', {
    eq: { enabled: true, gains: g(-2, -1, 0, 1, 1.5, 2, 3.5, 4) },
    filter: { enabled: true, lowCutHz: 150, highCutHz: 17000, resonance: 0.28 },
    reverb: { enabled: true, mix: 0.06, decaySec: 1.1 },
  }),

  // —— Mix & Master (6) ——
  preset('mix-glue-bus', 'Mix Glue Bus', 'Mix & Master', {
    eq: { enabled: true, gains: g(0.5, 0.5, 0, 0, 0, 0, 0.5, 0.5) },
    compressor: { enabled: true, thresholdDb: -12, ratio: 2, attackSec: 0.03, releaseSec: 0.28, kneeDb: 12, makeupDb: 2 },
    saturation: { enabled: true, drive: 0.1, tone: 0.55 },
    analogSaturation: { level: 0.1 },
  }),
  preset('mix-master-light', 'Mastering Light Touch', 'Mix & Master', {
    eq: { enabled: true, gains: g(0, 0, 0, 0.5, 0.5, 0.5, 1, 1.5) },
    compressor: { enabled: true, thresholdDb: -10, ratio: 1.8, attackSec: 0.04, releaseSec: 0.35, kneeDb: 14, makeupDb: 1.5 },
    limiter: { enabled: true, ceilingDb: -1, releaseSec: 0.1 },
    analogSaturation: { level: 0.06 },
  }),
  preset('mix-streaming-loud', 'Streaming Loudness', 'Mix & Master', {
    eq: { enabled: true, gains: g(-0.5, 0, 0.5, 1, 1.5, 2, 2.5, 2) },
    compressor: { enabled: true, thresholdDb: -8, ratio: 2.5, attackSec: 0.025, releaseSec: 0.22, kneeDb: 8, makeupDb: 3 },
    saturation: { enabled: true, drive: 0.08, tone: 0.5 },
    limiter: { enabled: true, ceilingDb: -0.5, releaseSec: 0.06 },
  }),
  preset('mix-vinyl-warmth', 'Vinyl Warmth', 'Mix & Master', {
    eq: { enabled: true, bands: eqBandsFromPresetId('warm') },
    saturation: { enabled: true, drive: 0.15, tone: 0.7 },
    filter: { enabled: true, lowCutHz: 45, highCutHz: 12000, resonance: 0.45 },
    analogSaturation: { level: 0.25 },
  }),
  preset('mix-arena-wash', 'Arena Reverb Wash', 'Mix & Master', {
    eq: { enabled: true, gains: g(-1, 0, 0, 0, 0, 0, 1, 2) },
    reverb: { enabled: true, mix: 0.35, decaySec: 3.8 },
    delay: { enabled: true, syncToBpm: true, note: '1/4', feedback: 0.15, mix: 0.06 },
  }),
  preset('mix-slapback-classic', 'Slapback Classic', 'Mix & Master', {
    delay: { enabled: true, syncToBpm: false, timeMs: 120, feedback: 0.18, mix: 0.22 },
    filter: { enabled: true, lowCutHz: 200, highCutHz: 7000, resonance: 0.4 },
    saturation: { enabled: true, drive: 0.12, tone: 0.58 },
  }),

  // —— Creative (4) ——
  preset('creative-dub-throw', 'Dub Delay Throw', 'Creative', {
    delay: { enabled: true, syncToBpm: true, note: '1/4', feedback: 0.55, mix: 0.35 },
    filter: { enabled: true, lowCutHz: 180, highCutHz: 8500, resonance: 0.48 },
    reverb: { enabled: true, mix: 0.12, decaySec: 2.2 },
  }),
  preset('creative-80s-chorus', '80s Chorus Shine', 'Creative', {
    chorus: { enabled: true, rateHz: 1.2, depth: 0.55, mix: 0.42 },
    eq: { enabled: true, bands: eqBandsFromPresetId('bright') },
    delay: { enabled: true, syncToBpm: true, note: '1/8', feedback: 0.2, mix: 0.1 },
  }),
  preset('creative-trap-hype', 'Trap Vocal Hype', 'Creative', {
    eq: { enabled: true, gains: g(-5, -3, -1, 2, 3, 5, 4, 3) },
    filter: { enabled: true, lowCutHz: 130, highCutHz: 13500, resonance: 0.42 },
    deEsser: { enabled: true, freqHz: 7400, amount: 0.6 },
    compressor: { enabled: true, thresholdDb: -15, ratio: 7, attackSec: 0.002, releaseSec: 0.08, kneeDb: 2, makeupDb: 8 },
    saturation: { enabled: true, drive: 0.32, tone: 0.45 },
    limiter: { enabled: true, ceilingDb: -0.4, releaseSec: 0.04 },
  }),
  preset('creative-phone-vocal', 'Telephone Vocal', 'Creative', {
    eq: { enabled: true, bands: eqBandsFromPresetId('phone') },
    filter: { enabled: true, lowCutHz: 350, highCutHz: 3800, resonance: 0.55 },
    saturation: { enabled: true, drive: 0.28, tone: 0.62 },
    compressor: { enabled: true, thresholdDb: -24, ratio: 3, attackSec: 0.01, releaseSec: 0.15, kneeDb: 6, makeupDb: 4 },
  }),
  preset('creative-hyperpop', 'Hyperpop Glitz', 'Creative', {
    eq: { enabled: true, bands: eqBandsFromPresetId('bright') },
    deEsser: { enabled: true, freqHz: 8000, amount: 0.5 },
    compressor: { enabled: true, thresholdDb: -14, ratio: 6, attackSec: 0.003, releaseSec: 0.07, kneeDb: 2, makeupDb: 7 },
    chorus: { enabled: true, rateHz: 1.5, depth: 0.62, mix: 0.38 },
    saturation: { enabled: true, drive: 0.22, tone: 0.48 },
    delay: { enabled: true, syncToBpm: true, note: '1/16', feedback: 0.35, mix: 0.18 },
    limiter: { enabled: true, ceilingDb: -0.5, releaseSec: 0.04 },
  }),
];

export const STUDIO_FX_SUITE_PRESET_GROUPS: StudioFxSuitePresetGroup[] = [
  'Default',
  'Vocals',
  'Instruments',
  'Drums',
  'Mix & Master',
  'Creative',
];

export function studioFxSuitePresetById(id: string): StudioFxSuitePreset | undefined {
  return STUDIO_FX_SUITE_PRESETS.find((p) => p.id === id);
}

export function studioFxSuitePresetRack(id: string): StudioTrackInsertFxRack {
  const presetDef = studioFxSuitePresetById(id);
  return cloneStudioTrackInsertFxRack(presetDef?.rack ?? defaultStudioTrackInsertFxRack());
}
