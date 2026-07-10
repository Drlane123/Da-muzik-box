import type { Se2SynthGenoRole, Se2SynthGenoVoiceParams } from '@/app/lib/studio/se2SynthGenoTypes';
import {
  se2SynthGenoDefaultBankId,
  se2SynthGenoSoundBankVoice,
} from '@/app/lib/studio/se2SynthGenoSoundBank';

export {
  SE2_SYNTH_GENO_DEFAULT_OUTPUT,
  roleLabel,
  se2SynthGenoDefaultVoice,
  se2SynthGenoVoiceFromRole,
} from '@/app/lib/studio/se2SynthGenoVoiceCore';

import { se2SynthGenoVoiceFromRole } from '@/app/lib/studio/se2SynthGenoVoiceCore';

/** Chord Generator plugin — fixed preview/apply voices per lane. */
export type Se2SynthGenoPluginPartVoice = 'chords' | 'melody' | 'bass';

export function se2SynthGenoSynthRoleForPluginPart(
  part: Se2SynthGenoPluginPartVoice,
): Se2SynthGenoRole {
  switch (part) {
    case 'chords':
      return 'keys';
    case 'melody':
      return 'pluck';
    case 'bass':
      return 'bass';
  }
}

/** Rhodes electric piano — chord / accord lane (not pad strings). */
export function se2SynthGenoRhodesAccordVoice(): Se2SynthGenoVoiceParams {
  const base = se2SynthGenoVoiceFromRole('keys', 'Rhodes Accord');
  return {
    ...base,
    role: 'keys',
    label: 'Rhodes Accord',
    osc1Wave: 'sine',
    osc1Level: 0.64,
    osc2Wave: 'triangle',
    osc2Level: 0.32,
    subLevel: 0.1,
    noiseLevel: 0.02,
    unisonVoices: 2,
    unisonDetuneCents: 6,
    filterCutoffHz: 2600,
    filterResonanceQ: 0.9,
    filterDrive: 0.05,
    ampAttackMs: 9,
    ampDecayMs: 360,
    ampSustain: 0.44,
    ampReleaseMs: 280,
    chorusMix: 0.24,
    delayMix: 0.05,
    reverbMix: 0.14,
    distortion: 0.05,
    outputLevel: 0.5,
  };
}

/** Cinematic string pad — strings lanes only, not chord accord. */
export function se2SynthGenoStringStreamVoice(label = 'String Stream'): Se2SynthGenoVoiceParams {
  const base = se2SynthGenoVoiceFromRole('pad', label);
  return {
    ...base,
    label,
    osc1Wave: 'saw',
    osc1Level: 0.42,
    osc2Wave: 'triangle',
    osc2Level: 0.34,
    unisonVoices: 4,
    unisonDetuneCents: 16,
    filterCutoffHz: 3000,
    filterResonanceQ: 0.55,
    ampAttackMs: 320,
    ampDecayMs: 720,
    ampSustain: 0.76,
    ampReleaseMs: 880,
    chorusMix: 0.34,
    reverbMix: 0.44,
    outputLevel: 0.46,
  };
}

export function se2SynthGenoVoiceForPluginPart(
  part: Se2SynthGenoPluginPartVoice,
  bankId?: string,
): Se2SynthGenoVoiceParams {
  switch (part) {
    case 'chords':
      return se2SynthGenoSoundBankVoice('accord', bankId ?? se2SynthGenoDefaultBankId('accord'));
    case 'melody':
      return se2SynthGenoSoundBankVoice('melody', bankId ?? se2SynthGenoDefaultBankId('melody'));
    case 'bass':
      return se2SynthGenoSoundBankVoice('bass', bankId ?? se2SynthGenoDefaultBankId('bass'));
  }
}

export function se2SynthGenoVoiceForStackRole(
  role: 'bass' | 'chords' | 'melody' | 'keys' | 'strings',
  label: string,
  synthGenoRole?: Se2SynthGenoRole,
  synthGenoBankId?: string,
): Se2SynthGenoVoiceParams {
  const bankCat =
    role === 'bass' ? 'bass' : role === 'melody' ? 'melody' : role === 'chords' || role === 'keys' ? 'accord' : null;
  if (bankCat && synthGenoBankId) {
    return se2SynthGenoSoundBankVoice(bankCat, synthGenoBankId);
  }
  if (role === 'melody') return se2SynthGenoVoiceForPluginPart('melody');
  if (role === 'bass') return se2SynthGenoVoiceForPluginPart('bass');
  if (role === 'chords' || role === 'keys') return se2SynthGenoVoiceForPluginPart('chords');
  if (role === 'strings') return se2SynthGenoStringStreamVoice(label);
  return se2SynthGenoVoiceFromRole(synthGenoRole ?? 'keys', label);
}

export const SE2_SYNTH_GENO_RANDOM_PROMPTS: readonly string[] = [
  'warm analog pad with slow attack',
  'bright pluck lead',
  'deep 808 sub bass',
  'shimmer bell without distortion',
  'wide supersaw lead',
  'dark horror pad reverb',
  'soft rhodes keys',
  'brass stab short decay',
  'lofi dusty keys',
  'cinematic strings pad',
  'acid squelch bass',
  'glass pluck delay',
  'aggressive distorted lead',
  'ambient space pad',
  'mono bass tight',
];
