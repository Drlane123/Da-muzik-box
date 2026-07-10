/**
 * Synth Geno loop preview — per-lane gain (preview only; not apply / export).
 */
import type { Se2SynthGenoPluginPreviewOpts } from '@/app/lib/studio/se2SynthGenoPluginPreview';

export type GenoLanePreviewGainId = 'chords' | 'melody' | 'bass' | 'filler' | 'grooveLead';

export const GENO_LANE_PREVIEW_GAIN_MAX = 1.5;

export const GENO_LANE_PREVIEW_GAIN_DEFAULTS: Record<GenoLanePreviewGainId, number> = {
  chords: 0.92,
  melody: 0.92,
  bass: 0.92,
  filler: 0.65,
  grooveLead: 0.92,
};

export type GenoLanePreviewGains = Record<GenoLanePreviewGainId, number>;

export function genoDefaultLanePreviewGains(
  overrides?: Partial<GenoLanePreviewGains>,
): GenoLanePreviewGains {
  return { ...GENO_LANE_PREVIEW_GAIN_DEFAULTS, ...overrides };
}

export function genoLanePreviewGainsToPreviewOpts(
  gains: GenoLanePreviewGains,
): Pick<
  Se2SynthGenoPluginPreviewOpts,
  'chordGain' | 'melodyGain' | 'bassGain' | 'fillerGain' | 'grooveLeadGain'
> {
  return {
    chordGain: gains.chords,
    melodyGain: gains.melody,
    bassGain: gains.bass,
    fillerGain: gains.filler,
    grooveLeadGain: gains.grooveLead,
  };
}

/** Strip mix sliders before audio apply / bounce — keeps note velocities unchanged. */
export function genoPreviewOptsWithoutMixGains(
  opts: Se2SynthGenoPluginPreviewOpts,
): Se2SynthGenoPluginPreviewOpts {
  const next = { ...opts };
  delete next.chordGain;
  delete next.melodyGain;
  delete next.bassGain;
  delete next.fillerGain;
  delete next.grooveLeadGain;
  return next;
}

export function genoLanePreviewGainSliderValue(gain: number): number {
  return Math.round((gain / GENO_LANE_PREVIEW_GAIN_MAX) * 150);
}

export function genoLanePreviewGainFromSlider(slider: number): number {
  return Math.max(0, Math.min(GENO_LANE_PREVIEW_GAIN_MAX, (slider / 150) * GENO_LANE_PREVIEW_GAIN_MAX));
}

/** Live mix — updated by Geno loop Vol sliders; read on each preview loop pass. */
let livePluginPreviewMixGains: GenoLanePreviewGains | null = null;

export function setGenoPluginPreviewMixGains(gains: GenoLanePreviewGains | null): void {
  livePluginPreviewMixGains = gains;
}

export function genoPluginPreviewMixGainForLane(
  laneId: GenoLanePreviewGainId,
  fallback: number,
): number {
  const live = livePluginPreviewMixGains?.[laneId];
  return live != null ? live : fallback;
}

export function genoMixGainsFromPreviewOpts(
  opts?: Pick<
    import('@/app/lib/studio/se2SynthGenoPluginPreview').Se2SynthGenoPluginPreviewOpts,
    'chordGain' | 'melodyGain' | 'bassGain' | 'fillerGain' | 'grooveLeadGain'
  >,
): GenoLanePreviewGains {
  return {
    chords: opts?.chordGain ?? GENO_LANE_PREVIEW_GAIN_DEFAULTS.chords,
    melody: opts?.melodyGain ?? GENO_LANE_PREVIEW_GAIN_DEFAULTS.melody,
    bass: opts?.bassGain ?? GENO_LANE_PREVIEW_GAIN_DEFAULTS.bass,
    filler: opts?.fillerGain ?? GENO_LANE_PREVIEW_GAIN_DEFAULTS.filler,
    grooveLead: opts?.grooveLeadGain ?? GENO_LANE_PREVIEW_GAIN_DEFAULTS.grooveLead,
  };
}
