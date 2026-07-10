/**
 * Studio Editor 2 — vocoder character presets (funk talk-box, robot, etc.)
 */

import type {
  VocalBoxPersonality,
  VocalBoxSpeechMode,
  VocalBoxSpeechStyle,
} from '@/app/lib/creationStation/grooveLabVocalBoxSpeech';

export type StudioVocoderPresetId =
  | 'robot'
  | 'transform'
  | 'zapp'
  | 'talkbox'
  | 'cyber'
  | 'warm';

export type StudioVocoderPreset = {
  id: StudioVocoderPresetId;
  label: string;
  sub: string;
  accent: string;
  personality: VocalBoxPersonality;
  style: VocalBoxSpeechStyle;
  mode: VocalBoxSpeechMode;
  /** Suggested wet blend when preset is selected */
  vocoderWet: number;
  /** Suggested robot/synth character */
  vocoderRobot: number;
  vibratoDepth: number;
  vocoderFormantSemis: number;
  vocoderAttackMs: number;
  vocoderReleaseMs: number;
  vocoderUnvoiced: number;
  vocoderBandFocus: number;
};

export const STUDIO_VOCODER_PRESETS: StudioVocoderPreset[] = [
  {
    id: 'robot',
    label: 'Robot',
    sub: 'Classic synth voice',
    accent: '#67e8f9',
    personality: 'robot',
    style: 'talk',
    mode: 'normal',
    vocoderWet: 0.78,
    vocoderRobot: 0.82,
    vibratoDepth: 0.1,
    vocoderFormantSemis: 0,
    vocoderAttackMs: 8,
    vocoderReleaseMs: 60,
    vocoderUnvoiced: 0.42,
    vocoderBandFocus: 0.62,
  },
  {
    id: 'transform',
    label: 'Transform',
    sub: 'Morphing machine',
    accent: '#a78bfa',
    personality: 'transform',
    style: 'talk',
    mode: 'normal',
    vocoderWet: 0.85,
    vocoderRobot: 0.92,
    vibratoDepth: 0.14,
    vocoderFormantSemis: 2,
    vocoderAttackMs: 6,
    vocoderReleaseMs: 55,
    vocoderUnvoiced: 0.48,
    vocoderBandFocus: 0.72,
  },
  {
    id: 'zapp',
    label: 'Traditional Funk Talk Box',
    sub: 'Funk talk-box',
    accent: '#fbbf24',
    personality: 'zapp',
    style: 'sing',
    mode: 'normal',
    vocoderWet: 0.8,
    vocoderRobot: 0.7,
    vibratoDepth: 0.28,
    vocoderFormantSemis: -1,
    vocoderAttackMs: 14,
    vocoderReleaseMs: 95,
    vocoderUnvoiced: 0.28,
    vocoderBandFocus: 0.45,
  },
  {
    id: 'talkbox',
    label: 'Talk Box',
    sub: 'Guitar-driver vowels',
    accent: '#f472b6',
    personality: 'talkbox',
    style: 'sing',
    mode: 'breathy',
    vocoderWet: 0.72,
    vocoderRobot: 0.58,
    vibratoDepth: 0.22,
    vocoderFormantSemis: -2,
    vocoderAttackMs: 18,
    vocoderReleaseMs: 110,
    vocoderUnvoiced: 0.22,
    vocoderBandFocus: 0.38,
  },
  {
    id: 'cyber',
    label: 'Cyber',
    sub: 'Sharp digital edge',
    accent: '#38bdf8',
    personality: 'cyber',
    style: 'monotone',
    mode: 'normal',
    vocoderWet: 0.88,
    vocoderRobot: 0.95,
    vibratoDepth: 0.06,
    vocoderFormantSemis: 3,
    vocoderAttackMs: 4,
    vocoderReleaseMs: 45,
    vocoderUnvoiced: 0.55,
    vocoderBandFocus: 0.82,
  },
  {
    id: 'warm',
    label: 'Warm Vox',
    sub: 'Softer human bleed',
    accent: '#7cf4c6',
    personality: 'warm',
    style: 'sing',
    mode: 'breathy',
    vocoderWet: 0.55,
    vocoderRobot: 0.38,
    vibratoDepth: 0.18,
    vocoderFormantSemis: -3,
    vocoderAttackMs: 22,
    vocoderReleaseMs: 130,
    vocoderUnvoiced: 0.18,
    vocoderBandFocus: 0.28,
  },
];

export function studioVocoderPresetById(id: StudioVocoderPresetId): StudioVocoderPreset {
  return STUDIO_VOCODER_PRESETS.find((p) => p.id === id) ?? STUDIO_VOCODER_PRESETS[0]!;
}
