import {
  grooveLabGuitarLickPlayOpts,
  isGuitarLickSampleId,
  type GuitarLickId,
} from '@/app/lib/creationStation/grooveLabGuitarLickBank';
import type { PlayGrooveLabLeadSoundOpts } from '@/app/lib/creationStation/grooveLabLeadSounds';

export type GrooveLabGuitarFxSettings = {
  wahAmount: number;
  wahRateHz: number;
  drive: number;
  distortion: number;
  filterCutoffHz: number;
  /** High-pass — removes mud below this Hz. */
  lowCutHz: number;
  /** Low-pass — removes harshness above this Hz. */
  highCutHz: number;
  leadLfoRateHz: number;
  leadLfoDepthCents: number;
  glideMs: number;
};

export const GROOVE_LAB_GUITAR_FX_DEFAULTS: GrooveLabGuitarFxSettings = {
  wahAmount: 0.72,
  wahRateHz: 2.6,
  drive: 0.32,
  distortion: 0.16,
  filterCutoffHz: 6800,
  lowCutHz: 90,
  highCutHz: 8200,
  leadLfoRateHz: 4.2,
  leadLfoDepthCents: 9,
  glideMs: 0,
};

export const GROOVE_GUITAR_LOW_CUT_KEY = 'groove-lab-guitar-low-cut-hz';
export const GROOVE_GUITAR_HIGH_CUT_KEY = 'groove-lab-guitar-high-cut-hz';

export const GROOVE_GUITAR_WAH_AMOUNT_KEY = 'groove-lab-guitar-wah-amount';
export const GROOVE_GUITAR_WAH_RATE_KEY = 'groove-lab-guitar-wah-rate';
export const GROOVE_GUITAR_DRIVE_KEY = 'groove-lab-guitar-drive';
export const GROOVE_GUITAR_DISTORTION_KEY = 'groove-lab-guitar-distortion';
export const GROOVE_GUITAR_FILTER_CUTOFF_KEY = 'groove-lab-guitar-filter-cutoff-hz';
export const GROOVE_GUITAR_LFO_RATE_KEY = 'groove-lab-guitar-lfo-rate-hz';
export const GROOVE_GUITAR_LFO_DEPTH_KEY = 'groove-lab-guitar-lfo-depth-cents';
export const GROOVE_GUITAR_GLIDE_MS_KEY = 'groove-lab-guitar-glide-ms';

function readUnit(key: string, fallback: number): number {
  if (typeof window === 'undefined') return fallback;
  try {
    const v = Number.parseFloat(window.localStorage.getItem(key) ?? '');
    if (Number.isFinite(v)) return Math.max(0, Math.min(1, v));
  } catch {
    /* */
  }
  return fallback;
}

function readRange(key: string, fallback: number, min: number, max: number): number {
  if (typeof window === 'undefined') return fallback;
  try {
    const v = Number.parseFloat(window.localStorage.getItem(key) ?? '');
    if (Number.isFinite(v)) return Math.max(min, Math.min(max, v));
  } catch {
    /* */
  }
  return fallback;
}

export function readStoredGrooveLabGuitarFx(): GrooveLabGuitarFxSettings {
  const d = GROOVE_LAB_GUITAR_FX_DEFAULTS;
  return {
    wahAmount: readUnit(GROOVE_GUITAR_WAH_AMOUNT_KEY, d.wahAmount),
    wahRateHz: readRange(GROOVE_GUITAR_WAH_RATE_KEY, d.wahRateHz, 0.2, 8),
    drive: readUnit(GROOVE_GUITAR_DRIVE_KEY, d.drive),
    distortion: readUnit(GROOVE_GUITAR_DISTORTION_KEY, d.distortion),
    filterCutoffHz: readRange(GROOVE_GUITAR_FILTER_CUTOFF_KEY, d.filterCutoffHz, 900, 14000),
    lowCutHz: readRange(GROOVE_GUITAR_LOW_CUT_KEY, d.lowCutHz, 20, 800),
    highCutHz: readRange(GROOVE_GUITAR_HIGH_CUT_KEY, d.highCutHz, 400, 18000),
    leadLfoRateHz: readRange(GROOVE_GUITAR_LFO_RATE_KEY, d.leadLfoRateHz, 0, 12),
    leadLfoDepthCents: readRange(GROOVE_GUITAR_LFO_DEPTH_KEY, d.leadLfoDepthCents, 0, 48),
    glideMs: readRange(GROOVE_GUITAR_GLIDE_MS_KEY, d.glideMs, 0, 480),
  };
}

export function grooveLabGuitarFxToPlayOpts(
  fx: GrooveLabGuitarFxSettings,
  sustainSec?: number,
): PlayGrooveLabLeadSoundOpts {
  return {
    wahAmount: fx.wahAmount,
    wahRateHz: fx.wahRateHz,
    drive: fx.drive,
    distortion: fx.distortion,
    filterCutoffHz: fx.filterCutoffHz,
    lowCutHz: fx.lowCutHz,
    highCutHz: fx.highCutHz,
    leadLfoRateHz: fx.leadLfoRateHz,
    leadLfoDepthCents: fx.leadLfoDepthCents,
    glideMs: fx.glideMs,
    pitchRegister: 'guitar',
    monophonic: true,
    transportClean: fx.glideMs <= 0,
    disableLegato: fx.glideMs <= 0,
    ...(sustainSec != null ? { maxSustainSec: sustainSec } : {}),
  };
}

/** User guitar macros merged over sample-lick defaults (when applicable). */
export function mergeGuitarPlaybackFx(
  soundId: string,
  sustainSec: number,
  userFx: GrooveLabGuitarFxSettings,
): PlayGrooveLabLeadSoundOpts {
  const user = grooveLabGuitarFxToPlayOpts(userFx, sustainSec);
  if (isGuitarLickSampleId(soundId)) {
    return {
      ...grooveLabGuitarLickPlayOpts(soundId, sustainSec),
      ...user,
      transportClean: false,
      maxSustainSec: sustainSec,
    };
  }
  return user;
}
