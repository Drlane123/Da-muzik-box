import type { Se2SynthGenoRole, Se2SynthGenoVoiceParams } from '@/app/lib/studio/se2SynthGenoTypes';

export const SE2_SYNTH_GENO_DEFAULT_OUTPUT = 0.48;

export function se2SynthGenoDefaultVoice(label = 'Init Geno'): Se2SynthGenoVoiceParams {
  return {
    role: 'keys',
    label,
    osc1Wave: 'saw',
    osc1Level: 0.55,
    osc2Wave: 'square',
    osc2Level: 0.22,
    subLevel: 0,
    noiseLevel: 0,
    unisonVoices: 1,
    unisonDetuneCents: 8,
    filterType: 'lowpass',
    filterCutoffHz: 5200,
    filterResonanceQ: 0.85,
    filterDrive: 0.1,
    ampAttackMs: 8,
    ampDecayMs: 180,
    ampSustain: 0.62,
    ampReleaseMs: 220,
    chorusMix: 0.08,
    delayMix: 0,
    reverbMix: 0.06,
    distortion: 0,
    outputLevel: SE2_SYNTH_GENO_DEFAULT_OUTPUT,
  };
}

const ROLE_BASE: Record<Se2SynthGenoRole, Partial<Se2SynthGenoVoiceParams>> = {
  lead: {
    role: 'lead',
    osc1Wave: 'saw',
    osc1Level: 0.72,
    osc2Wave: 'square',
    osc2Level: 0.28,
    subLevel: 0,
    filterCutoffHz: 6200,
    filterResonanceQ: 1.1,
    ampAttackMs: 4,
    ampDecayMs: 120,
    ampSustain: 0.55,
    ampReleaseMs: 140,
    chorusMix: 0.12,
    delayMix: 0.1,
    reverbMix: 0.04,
  },
  pad: {
    role: 'pad',
    osc1Wave: 'saw',
    osc1Level: 0.48,
    osc2Wave: 'triangle',
    osc2Level: 0.38,
    subLevel: 0.08,
    unisonVoices: 3,
    unisonDetuneCents: 14,
    filterCutoffHz: 2800,
    filterResonanceQ: 0.6,
    ampAttackMs: 420,
    ampDecayMs: 680,
    ampSustain: 0.78,
    ampReleaseMs: 900,
    chorusMix: 0.28,
    delayMix: 0.14,
    reverbMix: 0.38,
  },
  bass: {
    role: 'bass',
    osc1Wave: 'sine',
    osc1Level: 0.88,
    osc2Wave: 'saw',
    osc2Level: 0.18,
    subLevel: 0.55,
    noiseLevel: 0,
    filterCutoffHz: 420,
    filterResonanceQ: 0.75,
    ampAttackMs: 3,
    ampDecayMs: 220,
    ampSustain: 0.72,
    ampReleaseMs: 180,
    distortion: 0.18,
    chorusMix: 0,
    delayMix: 0,
    reverbMix: 0.02,
  },
  pluck: {
    role: 'pluck',
    osc1Wave: 'triangle',
    osc1Level: 0.65,
    osc2Wave: 'square',
    osc2Level: 0.12,
    filterCutoffHz: 5200,
    filterResonanceQ: 1.4,
    ampAttackMs: 1,
    ampDecayMs: 280,
    ampSustain: 0.08,
    ampReleaseMs: 160,
    chorusMix: 0.06,
    delayMix: 0.08,
    reverbMix: 0.1,
  },
  keys: {
    role: 'keys',
    osc1Wave: 'sine',
    osc1Level: 0.58,
    osc2Wave: 'triangle',
    osc2Level: 0.26,
    subLevel: 0,
    unisonVoices: 1,
    unisonDetuneCents: 0,
    filterCutoffHz: 3200,
    ampAttackMs: 8,
    ampDecayMs: 420,
    ampSustain: 0.52,
    ampReleaseMs: 280,
    chorusMix: 0,
    delayMix: 0,
    reverbMix: 0,
  },
  brass: {
    role: 'brass',
    osc1Wave: 'saw',
    osc1Level: 0.78,
    osc2Wave: 'saw',
    osc2Level: 0.42,
    filterCutoffHz: 3400,
    filterResonanceQ: 0.9,
    ampAttackMs: 38,
    ampDecayMs: 140,
    ampSustain: 0.68,
    ampReleaseMs: 240,
    chorusMix: 0.05,
    reverbMix: 0.14,
  },
  bell: {
    role: 'bell',
    osc1Wave: 'sine',
    osc1Level: 0.62,
    osc2Wave: 'triangle',
    osc2Level: 0.35,
    filterType: 'bandpass',
    filterCutoffHz: 2400,
    filterResonanceQ: 2.2,
    ampAttackMs: 2,
    ampDecayMs: 1200,
    ampSustain: 0.12,
    ampReleaseMs: 680,
    chorusMix: 0.18,
    delayMix: 0.22,
    reverbMix: 0.32,
  },
  fx: {
    role: 'fx',
    osc1Wave: 'saw',
    osc1Level: 0.4,
    osc2Wave: 'square',
    osc2Level: 0.5,
    noiseLevel: 0.35,
    unisonVoices: 4,
    unisonDetuneCents: 22,
    filterType: 'bandpass',
    filterCutoffHz: 1800,
    filterResonanceQ: 3.5,
    ampAttackMs: 80,
    ampDecayMs: 400,
    ampSustain: 0.4,
    ampReleaseMs: 600,
    chorusMix: 0.35,
    delayMix: 0.28,
    reverbMix: 0.45,
    distortion: 0.25,
  },
};

export function roleLabel(role: Se2SynthGenoRole): string {
  switch (role) {
    case 'lead':
      return 'Lead Geno';
    case 'pad':
      return 'Pad Geno';
    case 'bass':
      return 'Bass Geno';
    case 'pluck':
      return 'Pluck Geno';
    case 'keys':
      return 'Keys Geno';
    case 'brass':
      return 'Brass Geno';
    case 'bell':
      return 'Bell Geno';
    case 'fx':
      return 'FX Geno';
    default:
      return 'Synth Geno';
  }
}

export function se2SynthGenoVoiceFromRole(
  role: Se2SynthGenoRole,
  label?: string,
): Se2SynthGenoVoiceParams {
  const base = se2SynthGenoDefaultVoice(label ?? roleLabel(role));
  const patch = ROLE_BASE[role];
  return { ...base, ...patch, role, label: label ?? roleLabel(role) };
}
