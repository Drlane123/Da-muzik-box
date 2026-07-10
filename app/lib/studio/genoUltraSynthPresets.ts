/**
 * Geno Ultra Synth — factory + derived preset bank.
 */
import { genoUltraStripVoiceFx } from '@/app/lib/studio/genoUltraArpDryVoices';
import { buildGenoUltraDerivedPresets } from '@/app/lib/studio/genoUltraSynthDerivedPresets';
import {
  genoUltraDefaultModSlots,
  genoUltraDefaultVoice,
  genoUltraFactoryBaseVoice,
  GENO_ULTRA_FX_DEFAULTS,
  type GenoUltraSynthVoiceParams,
} from '@/app/lib/studio/genoUltraSynthTypes';

/** Every non-cinematic patch loads fully dry (osc + gate only). */
function withDryVoice(voice: GenoUltraSynthVoiceParams): GenoUltraSynthVoiceParams {
  if (voice.category === 'cinematic') return voice;
  return genoUltraStripVoiceFx(voice);
}

export const GENO_ULTRA_DEFAULT_PRESET_ID = 'init-ultra';

export const GENO_ULTRA_SYNTH_FACTORY_PRESETS: readonly GenoUltraSynthVoiceParams[] = [
  genoUltraDefaultVoice('Init'),
  {
    ...genoUltraFactoryBaseVoice('Warm Lead'),
    id: 'ultra-warm-lead',
    category: 'lead',
  },
  {
    ...genoUltraFactoryBaseVoice('Silk Pad'),
    id: 'ultra-silk-pad',
    category: 'pad',
    osc1: { wave: 'saw', level: 0.55, semitone: 0, fineCents: 0, pwm: 0.5 },
    osc2: { wave: 'triangle', level: 0.48, semitone: 0, fineCents: -4, pwm: 0.5 },
    osc3: { wave: 'sine', level: 0.32, semitone: 12, fineCents: 0, pwm: 0.5 },
    subLevel: 0.15,
    unisonVoices: 3,
    unisonDetuneCents: 14,
    filterCutoffHz: 2800,
    filterResonanceQ: 0.5,
    ampAttackMs: 420,
    ampDecayMs: 680,
    ampSustain: 0.82,
    ampReleaseMs: 920,
    fx: { ...GENO_ULTRA_FX_DEFAULTS, chorusMix: 0.22, reverbMix: 0.38, reverbDecay: 0.62 },
  },
  {
    ...genoUltraFactoryBaseVoice('Sub 808'),
    id: 'ultra-sub-808',
    category: 'bass',
    osc1: { wave: 'sine', level: 0.95, semitone: 0, fineCents: 0, pwm: 0.5 },
    osc2: { wave: 'sine', level: 0, semitone: 0, fineCents: 0, pwm: 0.5 },
    osc3: { wave: 'sine', level: 0, semitone: 0, fineCents: 0, pwm: 0.5 },
    subLevel: 0.72,
    noiseLevel: 0.02,
    unisonVoices: 1,
    filterCutoffHz: 220,
    filterResonanceQ: 0.35,
    ampAttackMs: 2,
    ampDecayMs: 420,
    ampSustain: 0.78,
    ampReleaseMs: 280,
  },
  {
    ...genoUltraFactoryBaseVoice('Pluck Glass'),
    id: 'ultra-pluck-glass',
    category: 'pluck',
    osc1: { wave: 'triangle', level: 0.58, semitone: 0, fineCents: 0, pwm: 0.42 },
    osc2: { wave: 'sine', level: 0.32, semitone: 12, fineCents: 2, pwm: 0.5 },
    osc3: { wave: 'sine', level: 0.1, semitone: 0, fineCents: 0, pwm: 0.5 },
    unisonVoices: 1,
    unisonDetuneCents: 0,
    filterCutoffHz: 7100,
    filterResonanceQ: 1.28,
    filterKeyTrack: 0.58,
    filterAttackMs: 1,
    filterDecayMs: 110,
    filterSustain: 0.14,
    filterReleaseMs: 130,
    ampAttackMs: 0,
    ampDecayMs: 240,
    ampSustain: 0.03,
    ampReleaseMs: 155,
    modSlots: (() => {
      const s = genoUltraDefaultModSlots();
      s[0] = { source: 'filterEnv', dest: 'filterCutoff', amount: 0.88 };
      s[1] = { source: 'velocity', dest: 'filterCutoff', amount: 0.28 };
      return s;
    })(),
    fx: { ...GENO_ULTRA_FX_DEFAULTS, eqHiMidDb: 1.2, eqHighDb: 2.5, reverbMix: 0.12 },
  },
  {
    ...genoUltraFactoryBaseVoice('Rhodes Keys'),
    id: 'ultra-rhodes-keys',
    category: 'keys',
    osc1: { wave: 'sine', level: 0.68, semitone: 0, fineCents: 0, pwm: 0.5 },
    osc2: { wave: 'triangle', level: 0.38, semitone: 0, fineCents: 3, pwm: 0.5 },
    osc3: { wave: 'sine', level: 0.22, semitone: 12, fineCents: -2, pwm: 0.5 },
    filterCutoffHz: 3400,
    filterDrive: 0.08,
    ampAttackMs: 6,
    ampDecayMs: 220,
    ampSustain: 0.55,
    fx: { ...GENO_ULTRA_FX_DEFAULTS, chorusMix: 0.18, reverbMix: 0.22 },
  },
  {
    ...genoUltraFactoryBaseVoice('Reese Wide'),
    id: 'ultra-reese-wide',
    category: 'bass',
    osc1: { wave: 'saw', level: 0.72, semitone: 0, fineCents: 0, pwm: 0.5 },
    osc2: { wave: 'saw', level: 0.68, semitone: 0, fineCents: 7, pwm: 0.5 },
    osc3: { wave: 'square', level: 0.24, semitone: -12, fineCents: 0, pwm: 0.5 },
    unisonVoices: 4,
    unisonDetuneCents: 16,
    filterCutoffHz: 880,
    filterResonanceQ: 1.4,
    filterDrive: 0.42,
    modSlots: (() => {
      const s = genoUltraDefaultModSlots();
      s[0] = { source: 'lfo1', dest: 'filterCutoff', amount: 0.45 };
      return s;
    })(),
  },
  {
    ...genoUltraFactoryBaseVoice('Hook Lead'),
    id: 'ultra-hook-lead',
    category: 'lead',
    osc1: { wave: 'saw', level: 0.82, semitone: 0, fineCents: 0, pwm: 0.5 },
    osc2: { wave: 'square', level: 0.35, semitone: 0, fineCents: 0, pwm: 0.42 },
    osc3: { wave: 'triangle', level: 0.2, semitone: 12, fineCents: 0, pwm: 0.5 },
    filterCutoffHz: 5200,
    lfo1Depth: 0.55,
    modSlots: (() => {
      const s = genoUltraDefaultModSlots();
      s[0] = { source: 'lfo1', dest: 'osc2Pitch', amount: 0.18 };
      s[1] = { source: 'velocity', dest: 'filterCutoff', amount: 0.35 };
      return s;
    })(),
    fx: { ...GENO_ULTRA_FX_DEFAULTS, delayMix: 0.22, delayTimeMs: 320 },
  },
  {
    ...genoUltraFactoryBaseVoice('Dark Cinematic'),
    id: 'ultra-dark-cine',
    category: 'pad',
    osc1: { wave: 'saw', level: 0.48, semitone: 0, fineCents: 0, pwm: 0.5 },
    osc2: { wave: 'triangle', level: 0.42, semitone: -5, fineCents: 0, pwm: 0.5 },
    osc3: { wave: 'sine', level: 0.35, semitone: 7, fineCents: 0, pwm: 0.5 },
    filterMode: 'lowpass',
    filterCutoffHz: 1200,
    filterResonanceQ: 1.2,
    ampAttackMs: 680,
    ampSustain: 0.88,
    fx: { ...GENO_ULTRA_FX_DEFAULTS, reverbMix: 0.48, reverbDecay: 0.72 },
  },
  {
    ...genoUltraFactoryBaseVoice('Acid Line'),
    id: 'ultra-acid-line',
    category: 'fx',
    osc1: { wave: 'saw', level: 0.88, semitone: 0, fineCents: 0, pwm: 0.5 },
    osc2: { wave: 'square', level: 0.15, semitone: 0, fineCents: 0, pwm: 0.5 },
    osc3: { wave: 'sine', level: 0, semitone: 0, fineCents: 0, pwm: 0.5 },
    filterMode: 'bandpass',
    filterCutoffHz: 1400,
    filterResonanceQ: 2.8,
    filterDrive: 0.55,
    modSlots: (() => {
      const s = genoUltraDefaultModSlots();
      s[0] = { source: 'lfo2', dest: 'filterCutoff', amount: 0.85 };
      s[1] = { source: 'lfo2', dest: 'filterRes', amount: 0.42 };
      return s;
    })(),
  },
  {
    ...genoUltraFactoryBaseVoice('Bell Spark'),
    id: 'ultra-bell-spark',
    category: 'pluck',
    osc1: { wave: 'sine', level: 0.76, semitone: 0, fineCents: 0, pwm: 0.5 },
    osc2: { wave: 'triangle', level: 0.34, semitone: 12, fineCents: 3, pwm: 0.5 },
    osc3: { wave: 'sine', level: 0.32, semitone: 24, fineCents: 0, pwm: 0.5 },
    unisonVoices: 1,
    filterCutoffHz: 8200,
    filterResonanceQ: 0.95,
    filterKeyTrack: 0.62,
    filterAttackMs: 1,
    filterDecayMs: 140,
    filterSustain: 0.1,
    filterReleaseMs: 200,
    ampAttackMs: 0,
    ampDecayMs: 460,
    ampSustain: 0.02,
    ampReleaseMs: 380,
    modSlots: (() => {
      const s = genoUltraDefaultModSlots();
      s[0] = { source: 'filterEnv', dest: 'filterCutoff', amount: 0.62 };
      return s;
    })(),
    fx: { ...GENO_ULTRA_FX_DEFAULTS, reverbMix: 0.28, reverbDecay: 0.48, eqHighDb: 3.2 },
  },
  {
    ...genoUltraFactoryBaseVoice('Moog Bass'),
    id: 'ultra-moog-bass',
    category: 'bass',
    osc1: { wave: 'saw', level: 0.85, semitone: 0, fineCents: 0, pwm: 0.5 },
    osc2: { wave: 'square', level: 0.22, semitone: 0, fineCents: 0, pwm: 0.35 },
    osc3: { wave: 'sine', level: 0, semitone: 0, fineCents: 0, pwm: 0.5 },
    subLevel: 0.38,
    filterCutoffHz: 520,
    filterResonanceQ: 1.05,
    filterDrive: 0.28,
    modSlots: (() => {
      const s = genoUltraDefaultModSlots();
      s[0] = { source: 'filterEnv', dest: 'filterCutoff', amount: 0.65 };
      return s;
    })(),
  },
  {
    ...genoUltraFactoryBaseVoice('Air Pad'),
    id: 'ultra-air-pad',
    category: 'pad',
    osc1: { wave: 'triangle', level: 0.52, semitone: 0, fineCents: 0, pwm: 0.5 },
    osc2: { wave: 'sine', level: 0.45, semitone: 7, fineCents: 0, pwm: 0.5 },
    osc3: { wave: 'sine', level: 0.32, semitone: 12, fineCents: 0, pwm: 0.5 },
    noiseLevel: 0.04,
    unisonVoices: 3,
    filterCutoffHz: 2200,
    ampAttackMs: 520,
    ampSustain: 0.9,
    fx: { ...GENO_ULTRA_FX_DEFAULTS, chorusMix: 0.28, reverbMix: 0.42 },
  },
  // ── More basses ──
  {
    ...genoUltraFactoryBaseVoice('Deep Roller'),
    id: 'ultra-deep-roller',
    category: 'bass',
    osc1: { wave: 'sine', level: 0.88, semitone: 0, fineCents: 0, pwm: 0.5 },
    osc2: { wave: 'triangle', level: 0.35, semitone: 0, fineCents: -3, pwm: 0.5 },
    osc3: { wave: 'sine', level: 0, semitone: 0, fineCents: 0, pwm: 0.5 },
    subLevel: 0.82,
    filterCutoffHz: 380,
    filterResonanceQ: 0.42,
    ampAttackMs: 4,
    ampDecayMs: 380,
    ampSustain: 0.85,
    ampReleaseMs: 320,
    fx: { ...GENO_ULTRA_FX_DEFAULTS, delayMix: 0.28, delayTimeMs: 180, delayFeedback: 0.22 },
  },
  {
    ...genoUltraFactoryBaseVoice('Rubber Funk'),
    id: 'ultra-rubber-funk',
    category: 'bass',
    osc1: { wave: 'square', level: 0.72, semitone: 0, fineCents: 0, pwm: 0.32 },
    osc2: { wave: 'saw', level: 0.38, semitone: 0, fineCents: 5, pwm: 0.5 },
    subLevel: 0.48,
    filterCutoffHz: 640,
    filterResonanceQ: 1.35,
    filterDrive: 0.35,
    ampAttackMs: 2,
    ampDecayMs: 260,
    ampSustain: 0.62,
    modSlots: (() => {
      const s = genoUltraDefaultModSlots();
      s[0] = { source: 'filterEnv', dest: 'filterCutoff', amount: 0.78 };
      return s;
    })(),
  },
  {
    ...genoUltraFactoryBaseVoice('Growl 808'),
    id: 'ultra-growl-808',
    category: 'bass',
    osc1: { wave: 'saw', level: 0.78, semitone: 0, fineCents: 0, pwm: 0.5 },
    osc2: { wave: 'square', level: 0.42, semitone: -12, fineCents: 0, pwm: 0.4 },
    subLevel: 0.9,
    filterCutoffHz: 280,
    filterResonanceQ: 0.55,
    filterDrive: 0.52,
    ampAttackMs: 1,
    ampDecayMs: 520,
    ampSustain: 0.72,
    ampReleaseMs: 240,
  },
  {
    ...genoUltraFactoryBaseVoice('Pluck Bass'),
    id: 'ultra-pluck-bass',
    category: 'bass',
    osc1: { wave: 'triangle', level: 0.58, semitone: 0, fineCents: 0, pwm: 0.5 },
    osc2: { wave: 'sine', level: 0.42, semitone: 0, fineCents: 0, pwm: 0.5 },
    subLevel: 0.52,
    unisonVoices: 1,
    filterCutoffHz: 880,
    filterResonanceQ: 1.45,
    filterKeyTrack: 0.38,
    filterAttackMs: 1,
    filterDecayMs: 95,
    filterSustain: 0.1,
    filterReleaseMs: 120,
    ampAttackMs: 0,
    ampDecayMs: 280,
    ampSustain: 0.08,
    ampReleaseMs: 125,
    modSlots: (() => {
      const s = genoUltraDefaultModSlots();
      s[0] = { source: 'filterEnv', dest: 'filterCutoff', amount: 0.92 };
      s[1] = { source: 'velocity', dest: 'filterCutoff', amount: 0.18 };
      return s;
    })(),
  },
  // ── Warm & hook leads ──
  {
    ...genoUltraFactoryBaseVoice('Velvet Lead'),
    id: 'ultra-velvet-lead',
    category: 'lead',
    osc1: { wave: 'saw', level: 0.62, semitone: 0, fineCents: 0, pwm: 0.5 },
    osc2: { wave: 'triangle', level: 0.58, semitone: 0, fineCents: -6, pwm: 0.5 },
    osc3: { wave: 'sine', level: 0.28, semitone: 12, fineCents: 0, pwm: 0.5 },
    unisonVoices: 3,
    unisonDetuneCents: 11,
    filterCutoffHz: 3800,
    filterResonanceQ: 0.65,
    ampAttackMs: 28,
    ampDecayMs: 280,
    ampSustain: 0.78,
    fx: { ...GENO_ULTRA_FX_DEFAULTS, chorusMix: 0.32, reverbMix: 0.28 },
  },
  {
    ...genoUltraFactoryBaseVoice('Analog Memory'),
    id: 'ultra-analog-memory',
    category: 'lead',
    osc1: { wave: 'saw', level: 0.75, semitone: 0, fineCents: 0, pwm: 0.48 },
    osc2: { wave: 'saw', level: 0.62, semitone: 0, fineCents: 8, pwm: 0.5 },
    unisonVoices: 2,
    unisonDetuneCents: 9,
    filterCutoffHz: 4600,
    filterResonanceQ: 0.95,
    filterDrive: 0.18,
    lfo1Depth: 0.42,
    modSlots: (() => {
      const s = genoUltraDefaultModSlots();
      s[0] = { source: 'lfo1', dest: 'filterCutoff', amount: 0.28 };
      return s;
    })(),
    fx: { ...GENO_ULTRA_FX_DEFAULTS, delayMix: 0.32, delayTimeMs: 360, chorusMix: 0.2 },
  },
  {
    ...genoUltraFactoryBaseVoice('Soft Saw Lead'),
    id: 'ultra-soft-saw-lead',
    category: 'lead',
    osc1: { wave: 'triangle', level: 0.55, semitone: 0, fineCents: 0, pwm: 0.5 },
    osc2: { wave: 'saw', level: 0.48, semitone: 0, fineCents: 0, pwm: 0.5 },
    osc3: { wave: 'sine', level: 0.35, semitone: 7, fineCents: 0, pwm: 0.5 },
    filterCutoffHz: 3200,
    filterResonanceQ: 0.48,
    ampAttackMs: 45,
    ampSustain: 0.82,
    fx: { ...GENO_ULTRA_FX_DEFAULTS, chorusMix: 0.38, reverbMix: 0.18 },
  },
  {
    ...genoUltraFactoryBaseVoice('Supersaw Hook'),
    id: 'ultra-supersaw-hook',
    category: 'lead',
    osc1: { wave: 'saw', level: 0.8, semitone: 0, fineCents: 0, pwm: 0.5 },
    osc2: { wave: 'saw', level: 0.76, semitone: 0, fineCents: -7, pwm: 0.5 },
    unisonVoices: 5,
    unisonDetuneCents: 18,
    filterCutoffHz: 5800,
    filterResonanceQ: 1.1,
    ampAttackMs: 8,
    ampSustain: 0.75,
    fx: { ...GENO_ULTRA_FX_DEFAULTS, delayMix: 0.35, delayTimeMs: 290 },
  },
  {
    ...genoUltraFactoryBaseVoice('Laser Lead'),
    id: 'ultra-laser-lead',
    category: 'lead',
    osc1: { wave: 'square', level: 0.7, semitone: 0, fineCents: 0, pwm: 0.22 },
    osc2: { wave: 'saw', level: 0.55, semitone: 12, fineCents: 0, pwm: 0.5 },
    filterCutoffHz: 7200,
    filterResonanceQ: 2.2,
    filterDrive: 0.22,
    lfo2Depth: 0.65,
    modSlots: (() => {
      const s = genoUltraDefaultModSlots();
      s[0] = { source: 'lfo2', dest: 'filterCutoff', amount: 0.55 };
      return s;
    })(),
  },
  // ── Plucks ──
  {
    ...genoUltraFactoryBaseVoice('Marimba Pluck'),
    id: 'ultra-marimba-pluck',
    category: 'pluck',
    osc1: { wave: 'sine', level: 0.82, semitone: 0, fineCents: 0, pwm: 0.5 },
    osc2: { wave: 'triangle', level: 0.38, semitone: 12, fineCents: -1, pwm: 0.5 },
    unisonVoices: 1,
    filterCutoffHz: 5900,
    filterResonanceQ: 0.92,
    filterKeyTrack: 0.55,
    filterAttackMs: 1,
    filterDecayMs: 78,
    filterSustain: 0.08,
    filterReleaseMs: 110,
    ampAttackMs: 0,
    ampDecayMs: 255,
    ampSustain: 0,
    ampReleaseMs: 165,
    modSlots: (() => {
      const s = genoUltraDefaultModSlots();
      s[0] = { source: 'filterEnv', dest: 'filterCutoff', amount: 0.78 };
      return s;
    })(),
    fx: { ...GENO_ULTRA_FX_DEFAULTS, eqLoMidDb: 1.8, reverbMix: 0.18 },
  },
  {
    ...genoUltraFactoryBaseVoice('Koto Strike'),
    id: 'ultra-koto-strike',
    category: 'pluck',
    osc1: { wave: 'triangle', level: 0.62, semitone: 0, fineCents: 0, pwm: 0.5 },
    osc2: { wave: 'square', level: 0.22, semitone: 0, fineCents: 6, pwm: 0.32 },
    noiseLevel: 0.045,
    unisonVoices: 1,
    filterCutoffHz: 5100,
    filterResonanceQ: 1.38,
    filterKeyTrack: 0.5,
    filterAttackMs: 1,
    filterDecayMs: 68,
    filterSustain: 0.06,
    filterReleaseMs: 95,
    ampAttackMs: 0,
    ampDecayMs: 175,
    ampSustain: 0.02,
    ampReleaseMs: 88,
    modSlots: (() => {
      const s = genoUltraDefaultModSlots();
      s[0] = { source: 'filterEnv', dest: 'filterCutoff', amount: 0.92 };
      s[1] = { source: 'velocity', dest: 'ampLevel', amount: 0.32 };
      return s;
    })(),
  },
  {
    ...genoUltraFactoryBaseVoice('Harp Spark'),
    id: 'ultra-harp-spark',
    category: 'pluck',
    osc1: { wave: 'sine', level: 0.74, semitone: 0, fineCents: 0, pwm: 0.5 },
    osc2: { wave: 'sine', level: 0.44, semitone: 12, fineCents: -2, pwm: 0.5 },
    osc3: { wave: 'sine', level: 0.3, semitone: 19, fineCents: 0, pwm: 0.5 },
    unisonVoices: 1,
    filterCutoffHz: 9000,
    filterResonanceQ: 0.72,
    filterKeyTrack: 0.52,
    filterAttackMs: 2,
    filterDecayMs: 165,
    filterSustain: 0.18,
    filterReleaseMs: 220,
    ampAttackMs: 0,
    ampDecayMs: 540,
    ampSustain: 0.02,
    ampReleaseMs: 420,
    modSlots: (() => {
      const s = genoUltraDefaultModSlots();
      s[0] = { source: 'filterEnv', dest: 'filterCutoff', amount: 0.55 };
      return s;
    })(),
    fx: { ...GENO_ULTRA_FX_DEFAULTS, reverbMix: 0.32, reverbDecay: 0.5, eqHighDb: 2.8 },
  },
  {
    ...genoUltraFactoryBaseVoice('Mallet Pop'),
    id: 'ultra-mallet-pop',
    category: 'pluck',
    osc1: { wave: 'triangle', level: 0.38, semitone: 0, fineCents: 0, pwm: 0.5 },
    osc2: { wave: 'sine', level: 0.78, semitone: 0, fineCents: 0, pwm: 0.5 },
    unisonVoices: 1,
    filterCutoffHz: 7200,
    filterResonanceQ: 1.22,
    filterKeyTrack: 0.48,
    filterAttackMs: 0,
    filterDecayMs: 52,
    filterSustain: 0,
    filterReleaseMs: 75,
    ampAttackMs: 0,
    ampDecayMs: 125,
    ampSustain: 0,
    ampReleaseMs: 78,
    modSlots: (() => {
      const s = genoUltraDefaultModSlots();
      s[0] = { source: 'filterEnv', dest: 'filterCutoff', amount: 0.95 };
      s[1] = { source: 'velocity', dest: 'ampLevel', amount: 0.42 };
      return s;
    })(),
    fx: { ...GENO_ULTRA_FX_DEFAULTS, delayMix: 0.14, delayTimeMs: 140, eqHiMidDb: 2 },
  },
  // ── Keys ──
  {
    ...genoUltraFactoryBaseVoice('Wurli Keys'),
    id: 'ultra-wurli-keys',
    category: 'keys',
    osc1: { wave: 'square', level: 0.52, semitone: 0, fineCents: 0, pwm: 0.38 },
    osc2: { wave: 'sine', level: 0.62, semitone: 0, fineCents: 2, pwm: 0.5 },
    osc3: { wave: 'triangle', level: 0.28, semitone: 12, fineCents: 0, pwm: 0.5 },
    filterCutoffHz: 4200,
    filterDrive: 0.22,
    ampAttackMs: 4,
    ampDecayMs: 180,
    ampSustain: 0.48,
    fx: { ...GENO_ULTRA_FX_DEFAULTS, chorusMix: 0.24 },
  },
  {
    ...genoUltraFactoryBaseVoice('Clav Digi'),
    id: 'ultra-clav-digi',
    category: 'keys',
    osc1: { wave: 'square', level: 0.78, semitone: 0, fineCents: 0, pwm: 0.25 },
    osc2: { wave: 'square', level: 0.35, semitone: 12, fineCents: 0, pwm: 0.3 },
    filterCutoffHz: 5800,
    filterResonanceQ: 0.9,
    filterDrive: 0.32,
    ampAttackMs: 1,
    ampDecayMs: 140,
    ampSustain: 0.35,
    ampReleaseMs: 90,
  },
  {
    ...genoUltraFactoryBaseVoice('FM Bell Keys'),
    id: 'ultra-fm-bell-keys',
    category: 'keys',
    osc1: { wave: 'sine', level: 0.65, semitone: 0, fineCents: 0, pwm: 0.5 },
    osc2: { wave: 'sine', level: 0.58, semitone: 7, fineCents: 3, pwm: 0.5 },
    osc3: { wave: 'sine', level: 0.42, semitone: 14, fineCents: -2, pwm: 0.5 },
    filterCutoffHz: 6200,
    ampAttackMs: 2,
    ampDecayMs: 320,
    ampSustain: 0.38,
    fx: { ...GENO_ULTRA_FX_DEFAULTS, chorusMix: 0.15, reverbMix: 0.24 },
  },
  {
    ...genoUltraFactoryBaseVoice('Jazz Organ'),
    id: 'ultra-jazz-organ',
    category: 'keys',
    osc1: { wave: 'square', level: 0.68, semitone: 0, fineCents: 0, pwm: 0.42 },
    osc2: { wave: 'square', level: 0.55, semitone: 0, fineCents: 0, pwm: 0.42 },
    osc3: { wave: 'sine', level: 0.38, semitone: 12, fineCents: 0, pwm: 0.5 },
    filterCutoffHz: 3600,
    filterResonanceQ: 0.7,
    ampAttackMs: 6,
    ampSustain: 0.88,
    lfo1RateHz: 6.2,
    lfo1Depth: 0.12,
    modSlots: (() => {
      const s = genoUltraDefaultModSlots();
      s[0] = { source: 'lfo1', dest: 'ampLevel', amount: 0.08 };
      return s;
    })(),
    fx: { ...GENO_ULTRA_FX_DEFAULTS, chorusMix: 0.2, reverbMix: 0.15 },
  },
  {
    ...genoUltraFactoryBaseVoice('Grand Piano'),
    id: 'ultra-grand-piano',
    category: 'keys',
    osc1: { wave: 'triangle', level: 0.58, semitone: 0, fineCents: 0, pwm: 0.5 },
    osc2: { wave: 'sine', level: 0.52, semitone: 0, fineCents: -1, pwm: 0.5 },
    osc3: { wave: 'sine', level: 0.28, semitone: 12, fineCents: 0, pwm: 0.5 },
    filterCutoffHz: 4800,
    filterDrive: 0.06,
    ampAttackMs: 3,
    ampDecayMs: 280,
    ampSustain: 0.42,
    ampReleaseMs: 320,
    fx: { ...GENO_ULTRA_FX_DEFAULTS, reverbMix: 0.32, reverbDecay: 0.48 },
  },
];

const GENO_ULTRA_DERIVED_PRESETS = buildGenoUltraDerivedPresets(GENO_ULTRA_SYNTH_FACTORY_PRESETS);

function deriveCinematicPreset(
  baseId: string,
  id: string,
  label: string,
  patch: Partial<GenoUltraSynthVoiceParams>,
): GenoUltraSynthVoiceParams {
  const base =
    GENO_ULTRA_SYNTH_FACTORY_PRESETS.find((p) => p.id === baseId) ?? genoUltraDefaultVoice(label);
  const next: GenoUltraSynthVoiceParams = {
    ...base,
    ...patch,
    id,
    label,
    category: 'cinematic',
    osc1: { ...base.osc1, ...(patch.osc1 ?? {}) },
    osc2: { ...base.osc2, ...(patch.osc2 ?? {}) },
    osc3: { ...base.osc3, ...(patch.osc3 ?? {}) },
    fx: { ...base.fx, ...(patch.fx ?? {}) },
    modSlots: patch.modSlots?.map((s) => ({ ...s })) ?? base.modSlots.map((s) => ({ ...s })),
  };
  return next;
}

const GENO_ULTRA_CINEMATIC_HITS_PRESETS: readonly GenoUltraSynthVoiceParams[] = [
  deriveCinematicPreset('ultra-dark-cine', 'ultra-cine-impact', 'Cinematic Impact', {
    filterMode: 'lowpass',
    filterCutoffHz: 1420,
    filterResonanceQ: 1.05,
    ampAttackMs: 2,
    ampDecayMs: 300,
    ampSustain: 0.18,
    ampReleaseMs: 540,
    outputLevel: 0.82,
    fx: { ...GENO_ULTRA_FX_DEFAULTS, reverbMix: 0.32, reverbDecay: 0.68, eqLowDb: 4.5, eqHiMidDb: 1.2 },
  }),
  deriveCinematicPreset('ultra-cine-impact', 'ultra-cine-impact-dark', 'Cinematic Impact (Dark)', {
    filterMode: 'lowpass',
    filterCutoffHz: 920,
    filterResonanceQ: 1.3,
    outputLevel: 0.84,
    fx: { ...GENO_ULTRA_FX_DEFAULTS, reverbMix: 0.38, reverbDecay: 0.72, eqLowDb: 5, eqHighDb: -3 },
  }),
  deriveCinematicPreset('ultra-cine-impact', 'ultra-cine-impact-sub', 'Cinematic Impact (Sub)', {
    filterMode: 'lowpass',
    filterCutoffHz: 760,
    filterResonanceQ: 0.82,
    subLevel: 0.88,
    osc1: { wave: 'sine', level: 0.92, semitone: -12, fineCents: 0, pwm: 0.5 },
    osc2: { wave: 'triangle', level: 0.24, semitone: 0, fineCents: 0, pwm: 0.5 },
    outputLevel: 0.88,
    fx: { ...GENO_ULTRA_FX_DEFAULTS, reverbMix: 0.26, eqLowDb: 7, eqLoMidDb: -2.5 },
  }),
  deriveCinematicPreset('ultra-cine-impact', 'ultra-cine-impact-bright', 'Cinematic Impact (Bright)', {
    filterMode: 'highpass',
    filterCutoffHz: 620,
    filterResonanceQ: 0.95,
    outputLevel: 0.76,
    fx: { ...GENO_ULTRA_FX_DEFAULTS, reverbMix: 0.24, eqHighDb: 3.6, eqHiMidDb: 2.2 },
  }),
  deriveCinematicPreset('ultra-cine-impact', 'ultra-cine-impact-filtered', 'Cinematic Impact (Filtered)', {
    filterMode: 'bandpass',
    filterCutoffHz: 940,
    filterResonanceQ: 2.4,
    outputLevel: 0.8,
    fx: { ...GENO_ULTRA_FX_DEFAULTS, delayMix: 0.22, delayTimeMs: 220, reverbMix: 0.2, eqLoMidDb: 2 },
  }),
  deriveCinematicPreset('ultra-dark-cine', 'ultra-cine-symphony-hit', 'Symphony Hit', {
    filterMode: 'lowpass',
    filterCutoffHz: 1780,
    ampAttackMs: 1,
    ampDecayMs: 280,
    ampSustain: 0.22,
    ampReleaseMs: 500,
    outputLevel: 0.8,
    fx: { ...GENO_ULTRA_FX_DEFAULTS, reverbMix: 0.28, eqLowDb: 3.8, eqHiMidDb: 0.8 },
  }),
  deriveCinematicPreset('ultra-cine-symphony-hit', 'ultra-cine-brass-impact', 'Brass Impact', {
    filterCutoffHz: 2120,
    filterResonanceQ: 1.25,
    osc1: { wave: 'saw', level: 0.72, semitone: 0, fineCents: 0, pwm: 0.5 },
    osc2: { wave: 'square', level: 0.52, semitone: 7, fineCents: 0, pwm: 0.45 },
    outputLevel: 0.82,
  }),
  deriveCinematicPreset('ultra-cine-symphony-hit', 'ultra-cine-big-brass-hit', 'Big Brass Hit', {
    filterCutoffHz: 1950,
    filterResonanceQ: 1.5,
    unisonVoices: 3,
    unisonDetuneCents: 11,
    outputLevel: 0.84,
    fx: { ...GENO_ULTRA_FX_DEFAULTS, reverbMix: 0.22, eqLowDb: 5, eqLoMidDb: 1.4 },
  }),
  deriveCinematicPreset('ultra-cine-symphony-hit', 'ultra-cine-classic-orch-hit', 'Classic Orch Hit', {
    filterCutoffHz: 1680,
    filterResonanceQ: 1.1,
    ampAttackMs: 2,
    ampDecayMs: 260,
    ampSustain: 0.2,
    outputLevel: 0.78,
    fx: { ...GENO_ULTRA_FX_DEFAULTS, reverbMix: 0.18, eqLowDb: 3.2 },
  }),
  deriveCinematicPreset('ultra-dark-cine', 'ultra-cine-choir-stab', 'Choir Stab', {
    osc1: { wave: 'triangle', level: 0.55, semitone: 0, fineCents: 0, pwm: 0.5 },
    osc2: { wave: 'sine', level: 0.5, semitone: 12, fineCents: 0, pwm: 0.5 },
    osc3: { wave: 'sine', level: 0.35, semitone: 19, fineCents: 0, pwm: 0.5 },
    filterCutoffHz: 2400,
    ampAttackMs: 6,
    ampDecayMs: 360,
    ampSustain: 0.24,
    ampReleaseMs: 620,
    outputLevel: 0.78,
    fx: { ...GENO_ULTRA_FX_DEFAULTS, reverbMix: 0.42, reverbDecay: 0.74 },
  }),
  deriveCinematicPreset('ultra-dark-cine', 'ultra-cine-tight-low-strings', 'Tight Low Strings', {
    filterCutoffHz: 1120,
    filterResonanceQ: 1.08,
    ampAttackMs: 3,
    ampDecayMs: 320,
    ampSustain: 0.18,
    ampReleaseMs: 450,
    outputLevel: 0.81,
    fx: { ...GENO_ULTRA_FX_DEFAULTS, reverbMix: 0.2, eqLowDb: 4.2, eqLoMidDb: 1.2 },
  }),
  deriveCinematicPreset('ultra-pluck-glass', 'ultra-cine-pizzicato-stab', 'Pizzicato Stab', {
    filterMode: 'bandpass',
    filterCutoffHz: 2200,
    filterResonanceQ: 1.9,
    ampAttackMs: 0,
    ampDecayMs: 140,
    ampSustain: 0,
    ampReleaseMs: 130,
    outputLevel: 0.73,
    fx: { ...GENO_ULTRA_FX_DEFAULTS, reverbMix: 0.16, eqHiMidDb: 2.6, eqHighDb: 1.5 },
  }),
  deriveCinematicPreset('ultra-pluck-glass', 'ultra-cine-pizz-chord', 'Pizz Chord', {
    osc2: { wave: 'triangle', level: 0.52, semitone: 7, fineCents: 0, pwm: 0.5 },
    osc3: { wave: 'sine', level: 0.32, semitone: 12, fineCents: 0, pwm: 0.5 },
    filterMode: 'bandpass',
    filterCutoffHz: 1850,
    filterResonanceQ: 1.35,
    ampDecayMs: 180,
    ampReleaseMs: 180,
    outputLevel: 0.75,
  }),
  deriveCinematicPreset('ultra-cine-brass-impact', 'ultra-cine-sharp-brass-stab', 'Sharp Brass Stab', {
    filterMode: 'bandpass',
    filterCutoffHz: 2400,
    filterResonanceQ: 2.2,
    filterDrive: 0.42,
    ampAttackMs: 0,
    ampDecayMs: 190,
    ampSustain: 0.06,
    ampReleaseMs: 140,
    outputLevel: 0.83,
    fx: { ...GENO_ULTRA_FX_DEFAULTS, eqHiMidDb: 3.1, eqHighDb: 1.8 },
  }),
];

export const GENO_ULTRA_CINEMATIC_HIT_PRESET_IDS: readonly string[] =
  GENO_ULTRA_CINEMATIC_HITS_PRESETS.map((p) => p.id);

const CINEMATIC_HIT_ID_SET = new Set(GENO_ULTRA_CINEMATIC_HIT_PRESET_IDS);

export function genoUltraPresetIsCinematicHit(id: string): boolean {
  return CINEMATIC_HIT_ID_SET.has(id);
}

/** Patch browser categories (bass/lead/…/fx) — excludes cinematic hit bank. */
export function genoUltraSynthPresetsForCategory(
  category: GenoUltraSynthVoiceParams['category'],
): readonly GenoUltraSynthVoiceParams[] {
  if (category === 'cinematic') return GENO_ULTRA_CINEMATIC_HITS_PRESETS;
  return GENO_ULTRA_SYNTH_PRESETS.filter(
    (p) => p.category === category && !genoUltraPresetIsCinematicHit(p.id),
  );
}

/** Center ARP / sampler sound list — no cinematic hits (use Cinematic Hits bank). */
export function genoUltraSynthPresetsForCenterSoundPicker(): readonly GenoUltraSynthVoiceParams[] {
  return GENO_ULTRA_SYNTH_PRESETS.filter((p) => !genoUltraPresetIsCinematicHit(p.id));
}

/** Full preset bank — factory cores + parameter-derived variations. */
export const GENO_ULTRA_SYNTH_PRESETS: readonly GenoUltraSynthVoiceParams[] = [
  ...GENO_ULTRA_SYNTH_FACTORY_PRESETS,
  ...GENO_ULTRA_DERIVED_PRESETS,
  ...GENO_ULTRA_CINEMATIC_HITS_PRESETS,
].map(withDryVoice);

export function genoUltraPresetById(id: string): GenoUltraSynthVoiceParams {
  const hit = GENO_ULTRA_SYNTH_PRESETS.find((p) => p.id === id);
  if (!hit) return { ...genoUltraDefaultVoice() };
  const voice = {
    ...hit,
    modSlots: hit.modSlots.map((s) => ({ ...s })),
    fx: { ...hit.fx },
    osc1: { ...hit.osc1 },
    osc2: { ...hit.osc2 },
    osc3: { ...hit.osc3 },
  };
  return withDryVoice(voice);
}

export function genoUltraSanitizePresetId(id: string | undefined): string {
  if (id && GENO_ULTRA_SYNTH_PRESETS.some((p) => p.id === id)) return id;
  return GENO_ULTRA_DEFAULT_PRESET_ID;
}
