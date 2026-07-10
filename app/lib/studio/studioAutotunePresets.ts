/**
 * Studio Editor 2 — Pitch Tune character presets.
 */

import type { VocalBoxSpeechStyle } from '@/app/lib/creationStation/grooveLabVocalBoxSpeech';
import type { PitchTuneScaleId } from '@/app/lib/studio/studioPitchTune';

export type StudioAutotunePresetId =
  | 'tpain'
  | 'natural'
  | 'cher'
  | 'rap'
  | 'rnb'
  | 'vintage';

export type StudioAutotunePreset = {
  id: StudioAutotunePresetId;
  label: string;
  sub: string;
  accent: string;
  style: VocalBoxSpeechStyle;
  autotuneStrength: number;
  pitchRetuneMs: number;
  pitchFlex: number;
  pitchHumanize: number;
  pitchScaleId: PitchTuneScaleId;
  pitchTracking: number;
  /** Vocoder carrier vibrato when singing style */
  vibratoDepth: number;
};

export const STUDIO_AUTOTUNE_PRESETS: StudioAutotunePreset[] = [
  {
    id: 'tpain',
    label: 'Modern',
    sub: 'Hard snap · iconic',
    accent: '#ff9f43',
    style: 'sing',
    autotuneStrength: 0.98,
    pitchRetuneMs: 0,
    pitchFlex: 0.05,
    pitchHumanize: 0.06,
    pitchScaleId: 'chromatic',
    pitchTracking: 0.48,
    vibratoDepth: 0.08,
  },
  {
    id: 'natural',
    label: 'Natural',
    sub: 'Transparent polish',
    accent: '#7cf4c6',
    style: 'sing',
    autotuneStrength: 0.62,
    pitchRetuneMs: 38,
    pitchFlex: 0.52,
    pitchHumanize: 0.42,
    pitchScaleId: 'major',
    pitchTracking: 0.58,
    vibratoDepth: 0.14,
  },
  {
    id: 'cher',
    label: 'Iconic Hard',
    sub: 'Classic full retune',
    accent: '#f472b6',
    style: 'sing',
    autotuneStrength: 1,
    pitchRetuneMs: 0,
    pitchFlex: 0,
    pitchHumanize: 0.04,
    pitchScaleId: 'chromatic',
    pitchTracking: 0.45,
    vibratoDepth: 0.05,
  },
  {
    id: 'rap',
    label: 'Rap Tight',
    sub: 'Fast snap · talk flow',
    accent: '#fbbf24',
    style: 'monotone',
    autotuneStrength: 0.9,
    pitchRetuneMs: 6,
    pitchFlex: 0.18,
    pitchHumanize: 0.12,
    pitchScaleId: 'minor',
    pitchTracking: 0.52,
    vibratoDepth: 0.1,
  },
  {
    id: 'rnb',
    label: 'R&B Melodic',
    sub: 'Smooth · keeps soul',
    accent: '#c084fc',
    style: 'sing',
    autotuneStrength: 0.78,
    pitchRetuneMs: 28,
    pitchFlex: 0.38,
    pitchHumanize: 0.3,
    pitchScaleId: 'minor',
    pitchTracking: 0.55,
    vibratoDepth: 0.22,
  },
  {
    id: 'vintage',
    label: 'Vintage',
    sub: 'Slower pull · warm',
    accent: '#e8a87c',
    style: 'sing',
    autotuneStrength: 0.72,
    pitchRetuneMs: 55,
    pitchFlex: 0.48,
    pitchHumanize: 0.45,
    pitchScaleId: 'major',
    pitchTracking: 0.6,
    vibratoDepth: 0.28,
  },
];

export function studioAutotunePresetById(id: StudioAutotunePresetId): StudioAutotunePreset {
  return STUDIO_AUTOTUNE_PRESETS.find((p) => p.id === id) ?? STUDIO_AUTOTUNE_PRESETS[0]!;
}
