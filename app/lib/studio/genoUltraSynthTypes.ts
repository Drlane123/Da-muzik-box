/**
 * Geno Ultra Synth — ANA-inspired voice schema (SE2 dedicated lane).
 */

export type GenoUltraOscWave = 'sine' | 'saw' | 'square' | 'triangle';

export type GenoUltraFilterMode = 'lowpass' | 'bandpass' | 'highpass' | 'notch';

export type GenoUltraLfoShape = 'sine' | 'triangle' | 'square' | 'saw';

export type GenoUltraModSource =
  | 'off'
  | 'lfo1'
  | 'lfo2'
  | 'ampEnv'
  | 'filterEnv'
  | 'velocity';

export type GenoUltraModDest =
  | 'off'
  | 'filterCutoff'
  | 'filterRes'
  | 'osc1Pitch'
  | 'osc2Pitch'
  | 'osc3Pitch'
  | 'ampLevel'
  | 'pan';

export type GenoUltraOscParams = {
  wave: GenoUltraOscWave;
  level: number;
  semitone: number;
  fineCents: number;
  pwm: number;
};

export type GenoUltraModSlot = {
  source: GenoUltraModSource;
  dest: GenoUltraModDest;
  amount: number;
};

export type GenoUltraFxParams = {
  chorusMix: number;
  chorusRateHz: number;
  delayEnabled: boolean;
  delayMix: number;
  delayTimeMs: number;
  delayFeedback: number;
  reverbMix: number;
  reverbDecay: number;
  /** 4-band post-voice EQ (ANA strip). */
  eqEnabled: boolean;
  eqLowDb: number;
  eqLoMidDb: number;
  eqHiMidDb: number;
  eqHighDb: number;
  eqLowHz: number;
  eqLoMidHz: number;
  eqHiMidHz: number;
  eqHighHz: number;
};

export type GenoUltraSynthVoiceParams = {
  id: string;
  label: string;
  category: 'bass' | 'lead' | 'pad' | 'pluck' | 'keys' | 'fx' | 'cinematic';
  osc1: GenoUltraOscParams;
  osc2: GenoUltraOscParams;
  osc3: GenoUltraOscParams;
  subLevel: number;
  noiseLevel: number;
  unisonVoices: number;
  unisonDetuneCents: number;
  filterMode: GenoUltraFilterMode;
  filterCutoffHz: number;
  filterResonanceQ: number;
  filterDrive: number;
  filterKeyTrack: number;
  filterAttackMs: number;
  filterDecayMs: number;
  filterSustain: number;
  filterReleaseMs: number;
  ampAttackMs: number;
  ampDecayMs: number;
  ampSustain: number;
  ampReleaseMs: number;
  /** When false, filter is bypassed (dry osc mix). */
  filterEnabled?: boolean;
  /** When false, filter cutoff stays static (no filter ADSR). */
  filterEnvEnabled?: boolean;
  /** When false, amp gate is instant (no amp ADSR). */
  ampEnvEnabled?: boolean;
  modAttackMs: number;
  modDecayMs: number;
  modSustain: number;
  modReleaseMs: number;
  lfo1RateHz: number;
  lfo1Sync: boolean;
  lfo1Shape: GenoUltraLfoShape;
  lfo1Depth: number;
  lfo2RateHz: number;
  lfo2Sync: boolean;
  lfo2Shape: GenoUltraLfoShape;
  lfo2Depth: number;
  modSlots: readonly GenoUltraModSlot[];
  fx: GenoUltraFxParams;
  outputLevel: number;
};

export const GENO_ULTRA_MOD_SLOT_COUNT = 8;

/** Concert pitch — A4 = 440 Hz (MIDI 69). */
export const GENO_ULTRA_A4_HZ = 440;

/** Middle C — MIDI note 60, labeled C3 (Yamaha / many hardware synths). */
export const GENO_ULTRA_MIDDLE_C_MIDI = 60;

/** Yamaha-style octave number for a MIDI note (MIDI 60 → 3). */
export function genoUltraMidiOctaveLabel(midi: number): number {
  return Math.floor(Math.max(0, Math.min(127, midi)) / 12) - 2;
}

/** Fully dry FX — Init / bypass (no chorus, delay, reverb, or EQ). */
export const GENO_ULTRA_FX_INIT: GenoUltraFxParams = {
  chorusMix: 0,
  chorusRateHz: 0.35,
  delayEnabled: false,
  delayMix: 0,
  delayTimeMs: 280,
  delayFeedback: 0.32,
  reverbMix: 0,
  reverbDecay: 0.45,
  eqEnabled: false,
  eqLowDb: 0,
  eqLoMidDb: 0,
  eqHiMidDb: 0,
  eqHighDb: 0,
  eqLowHz: 120,
  eqLoMidHz: 480,
  eqHiMidHz: 2400,
  eqHighHz: 8000,
};

/** Factory preset FX baseline (light delay available; Init uses GENO_ULTRA_FX_INIT). */
export const GENO_ULTRA_FX_DEFAULTS: GenoUltraFxParams = {
  chorusMix: 0,
  chorusRateHz: 0.35,
  delayEnabled: true,
  delayMix: 0.38,
  delayTimeMs: 280,
  delayFeedback: 0.32,
  reverbMix: 0,
  reverbDecay: 0.45,
  eqEnabled: true,
  eqLowDb: 0,
  eqLoMidDb: 0,
  eqHiMidDb: 0,
  eqHighDb: 0,
  eqLowHz: 120,
  eqLoMidHz: 480,
  eqHiMidHz: 2400,
  eqHighHz: 8000,
};

/** Clamp FX params so UI edits never produce NaN (prevents panel crash). */
export function sanitizeGenoUltraFxParams(fx: GenoUltraFxParams): GenoUltraFxParams {
  const n = (v: number, lo: number, hi: number, fallback: number) =>
    Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : fallback;
  return {
    chorusMix: n(fx.chorusMix, 0, 1, 0),
    chorusRateHz: n(fx.chorusRateHz, 0.05, 8, 0.35),
    delayEnabled: fx.delayEnabled !== false,
    delayMix: n(fx.delayMix, 0, 1, 0.38),
    delayTimeMs: n(fx.delayTimeMs, 40, 2000, 280),
    delayFeedback: n(fx.delayFeedback, 0, 0.95, 0.32),
    reverbMix: n(fx.reverbMix, 0, 1, 0),
    reverbDecay: n(fx.reverbDecay, 0.1, 0.95, 0.45),
    eqEnabled: fx.eqEnabled !== false,
    eqLowDb: n(fx.eqLowDb, -12, 12, 0),
    eqLoMidDb: n(fx.eqLoMidDb, -12, 12, 0),
    eqHiMidDb: n(fx.eqHiMidDb, -12, 12, 0),
    eqHighDb: n(fx.eqHighDb, -12, 12, 0),
    eqLowHz: n(fx.eqLowHz, 30, 500, 120),
    eqLoMidHz: n(fx.eqLoMidHz, 100, 2500, 480),
    eqHiMidHz: n(fx.eqHiMidHz, 400, 10000, 2400),
    eqHighHz: n(fx.eqHighHz, 2000, 20000, 8000),
  };
}

/** Init oscillator — single saw, zero detune / fine. */
export const GENO_ULTRA_DEFAULT_OSC: GenoUltraOscParams = {
  wave: 'saw',
  level: 1,
  semitone: 0,
  fineCents: 0,
  pwm: 0.5,
};

/** Filter wide open (panel Cutoff max). */
export const GENO_ULTRA_FILTER_OPEN_HZ = 12000;

export function genoUltraDefaultModSlots(): GenoUltraModSlot[] {
  return Array.from({ length: GENO_ULTRA_MOD_SLOT_COUNT }, () => ({
    source: 'off' as const,
    dest: 'off' as const,
    amount: 0,
  }));
}

/** Master output when presets do not override — factory default (~+35% vs old 0.48). */
export const GENO_ULTRA_DEFAULT_OUTPUT_LEVEL = 0.65;

/**
 * Industry-standard Init — dry, concert-pitch baseline.
 * A4=440 · C3=MIDI 60 · saw · osc2/3 off · 0¢ detune · cutoff max · res 0% ·
 * amp gate A0/D0/S100%/R10ms · FX bypassed.
 */
export function genoUltraDefaultVoice(label = 'Init'): GenoUltraSynthVoiceParams {
  return {
    id: 'init-ultra',
    label,
    category: 'lead',
    osc1: { ...GENO_ULTRA_DEFAULT_OSC },
    osc2: { wave: 'square', level: 0, semitone: 0, fineCents: 0, pwm: 0.5 },
    osc3: { wave: 'saw', level: 0, semitone: 0, fineCents: 0, pwm: 0.5 },
    subLevel: 0,
    noiseLevel: 0,
    unisonVoices: 1,
    unisonDetuneCents: 0,
    filterMode: 'lowpass',
    filterCutoffHz: GENO_ULTRA_FILTER_OPEN_HZ,
    /** Panel Res min (0%) — no self-oscillation peak. */
    filterResonanceQ: 0.1,
    filterDrive: 0,
    filterKeyTrack: 0,
    filterAttackMs: 0,
    filterDecayMs: 0,
    filterSustain: 1,
    filterReleaseMs: 10,
    ampAttackMs: 0,
    ampDecayMs: 0,
    ampSustain: 1,
    ampReleaseMs: 10,
    filterEnabled: true,
    filterEnvEnabled: true,
    ampEnvEnabled: true,
    modAttackMs: 0,
    modDecayMs: 0,
    modSustain: 1,
    modReleaseMs: 10,
    lfo1RateHz: 0.5,
    lfo1Sync: false,
    lfo1Shape: 'sine',
    lfo1Depth: 0,
    lfo2RateHz: 0.5,
    lfo2Sync: false,
    lfo2Shape: 'sine',
    lfo2Depth: 0,
    modSlots: genoUltraDefaultModSlots(),
    fx: { ...GENO_ULTRA_FX_INIT },
    outputLevel: GENO_ULTRA_DEFAULT_OUTPUT_LEVEL,
  };
}

/**
 * Warm factory base for bank presets that patch on top of Init.
 * Keeps classic character (light delay, closed-ish filter) so only Init is fully dry.
 */
export function genoUltraFactoryBaseVoice(label: string): GenoUltraSynthVoiceParams {
  return {
    ...genoUltraDefaultVoice(label),
    osc1: { wave: 'saw', level: 0.78, semitone: 0, fineCents: 0, pwm: 0.5 },
    osc2: { wave: 'square', level: 0.42, semitone: 0, fineCents: 0, pwm: 0.5 },
    osc3: { wave: 'triangle', level: 0.18, semitone: 7, fineCents: 0, pwm: 0.5 },
    subLevel: 0.22,
    unisonVoices: 2,
    unisonDetuneCents: 8,
    filterCutoffHz: 4200,
    filterResonanceQ: 0.85,
    filterDrive: 0.12,
    filterKeyTrack: 0.35,
    filterAttackMs: 8,
    filterDecayMs: 420,
    filterSustain: 0.42,
    filterReleaseMs: 280,
    ampAttackMs: 12,
    ampDecayMs: 180,
    ampSustain: 0.72,
    ampReleaseMs: 220,
    modAttackMs: 4,
    modDecayMs: 320,
    modSustain: 0.55,
    modReleaseMs: 480,
    lfo1RateHz: 0.42,
    lfo1Depth: 0.35,
    lfo2RateHz: 2.4,
    lfo2Sync: true,
    lfo2Shape: 'triangle',
    lfo2Depth: 0.2,
    fx: { ...GENO_ULTRA_FX_DEFAULTS },
  };
}

/** LFO sweeps the filter — classic wah / talk-box guitar character. */
export function genoUltraVoiceHasWah(voice: GenoUltraSynthVoiceParams): boolean {
  return voice.modSlots.some(
    (slot) =>
      (slot.source === 'lfo1' || slot.source === 'lfo2') &&
      (slot.dest === 'filterCutoff' || slot.dest === 'filterRes') &&
      Math.abs(slot.amount) > 0.32,
  );
}

/** Cinematic / EDM rise — long attack, pitch sweep, noise layer. Lives in FX bank. */
export function genoUltraVoiceIsRiser(voice: GenoUltraSynthVoiceParams): boolean {
  if (voice.category !== 'fx') return false;
  if (voice.id.includes('rise')) return true;
  if (voice.label.toLowerCase().includes('rise')) return true;
  return voice.ampAttackMs >= 900 && voice.ampSustain >= 0.55;
}

/** Octaves of pitch climb during the rise (from ampEnv → pitch mod slots). */
export function genoUltraVoiceRiseOctaves(voice: GenoUltraSynthVoiceParams): number {
  let oct = 0;
  for (const slot of voice.modSlots) {
    if (
      slot.source === 'ampEnv' &&
      (slot.dest === 'osc1Pitch' || slot.dest === 'osc2Pitch' || slot.dest === 'osc3Pitch')
    ) {
      oct = Math.max(oct, slot.amount * 2.2);
    }
  }
  if (oct > 0.05) return Math.min(2.5, oct);
  return genoUltraVoiceIsRiser(voice) ? 1.05 : 0;
}

/** Keyboard preview hold — risers need several seconds to bloom. */
export function genoUltraVoicePreviewHoldSec(voice: GenoUltraSynthVoiceParams): number {
  if (!genoUltraVoiceIsRiser(voice)) return 0.65;
  const atk = voice.ampAttackMs / 1000;
  const rel = voice.ampReleaseMs / 1000;
  return Math.max(3.4, atk + 0.6, atk + rel * 0.4);
}
