/**
 * Geno Bass — match synth tone + FX to groove pattern type (trap, drill, funk, house, etc.).
 */
import type { GenoBassGroovePreset } from '@/app/lib/studio/genoBassGroovePresets';
import { genoBassPresetById } from '@/app/lib/studio/genoBassSynthPresets';
import { GENO_ULTRA_FX_DEFAULTS, type GenoUltraSynthVoiceParams } from '@/app/lib/studio/genoUltraSynthTypes';

export type GenoBassGrooveSoundRole =
  | 'trap808'
  | 'drill'
  | 'club'
  | 'gfunk'
  | 'funk'
  | 'house'
  | 'disco'
  | 'rnb'
  | 'rock'
  | 'electro'
  | 'pop'
  | 'walk';

export type GenoBassGrooveSoundPatch = Partial<
  Omit<GenoUltraSynthVoiceParams, 'osc1' | 'osc2' | 'osc3' | 'fx' | 'modSlots' | 'id' | 'label' | 'category'>
> & {
  osc1?: Partial<GenoUltraSynthVoiceParams['osc1']>;
  osc2?: Partial<GenoUltraSynthVoiceParams['osc2']>;
  osc3?: Partial<GenoUltraSynthVoiceParams['osc3']>;
  fx?: Partial<GenoUltraSynthVoiceParams['fx']>;
};

export type GenoBassGrooveSoundMatch = {
  soundPresetId: string;
  patch: GenoBassGrooveSoundPatch;
  role: GenoBassGrooveSoundRole;
};

const ROLE_BASE_SOUND: Record<GenoBassGrooveSoundRole, string> = {
  trap808: 'bass-tr808',
  drill: 'bass-deep-roller',
  club: 'bass-club-sub',
  gfunk: 'bass-phase',
  funk: 'bass-funk-rubber',
  house: 'bass-sh101',
  disco: 'bass-slap',
  rnb: 'bass-dub-sub',
  rock: 'bass-mini-moog',
  electro: 'bass-miami-thump',
  pop: 'bass-pluck',
  walk: 'bass-boogie',
};

const ROLE_PATCH: Record<GenoBassGrooveSoundRole, GenoBassGrooveSoundPatch> = {
  trap808: {
    filterCutoffHz: 185,
    filterResonanceQ: 0.55,
    subLevel: 0.92,
    ampAttackMs: 0,
    ampDecayMs: 115,
    ampSustain: 0.08,
    ampReleaseMs: 95,
    fx: {
      ...GENO_ULTRA_FX_DEFAULTS,
      eqEnabled: true,
      eqLowDb: 7,
      eqLoMidDb: -3.5,
      eqHiMidDb: 0.5,
      eqHighDb: -2,
      chorusMix: 0,
      delayMix: 0,
      reverbMix: 0.03,
    },
  },
  drill: {
    filterCutoffHz: 340,
    filterDrive: 0.48,
    filterResonanceQ: 1.05,
    subLevel: 0.78,
    ampAttackMs: 0,
    ampDecayMs: 88,
    ampSustain: 0.06,
    ampReleaseMs: 72,
    fx: {
      ...GENO_ULTRA_FX_DEFAULTS,
      eqEnabled: true,
      eqLowDb: 6,
      eqLoMidDb: -2.5,
      eqHiMidDb: 2.2,
      delayMix: 0.08,
      delayTimeMs: 165,
      chorusMix: 0,
      reverbMix: 0.02,
    },
  },
  club: {
    filterCutoffHz: 260,
    subLevel: 0.82,
    ampAttackMs: 0,
    ampDecayMs: 105,
    ampSustain: 0.1,
    fx: {
      ...GENO_ULTRA_FX_DEFAULTS,
      eqEnabled: true,
      eqLowDb: 5.5,
      eqHiMidDb: 1.8,
      chorusMix: 0.12,
      delayMix: 0.1,
      delayTimeMs: 200,
    },
  },
  gfunk: {
    filterCutoffHz: 580,
    filterDrive: 0.38,
    subLevel: 0.42,
    ampAttackMs: 0,
    ampDecayMs: 118,
    ampSustain: 0.14,
    osc2: { level: 0.32, semitone: 12 },
    fx: {
      ...GENO_ULTRA_FX_DEFAULTS,
      eqEnabled: true,
      eqLoMidDb: -1,
      eqHiMidDb: 2.8,
      chorusMix: 0.2,
      delayMix: 0.14,
      delayTimeMs: 228,
      reverbMix: 0.05,
    },
  },
  funk: {
    filterCutoffHz: 760,
    filterResonanceQ: 1.35,
    filterDrive: 0.42,
    subLevel: 0.38,
    ampAttackMs: 0,
    ampDecayMs: 102,
    ampSustain: 0.12,
    fx: {
      ...GENO_ULTRA_FX_DEFAULTS,
      eqEnabled: true,
      eqLoMidDb: -2,
      eqHiMidDb: 2.4,
      chorusMix: 0.1,
      delayMix: 0.09,
      delayTimeMs: 190,
    },
  },
  house: {
    filterCutoffHz: 920,
    filterResonanceQ: 1.1,
    subLevel: 0.4,
    ampAttackMs: 0,
    ampDecayMs: 96,
    ampSustain: 0.1,
    fx: {
      ...GENO_ULTRA_FX_DEFAULTS,
      eqEnabled: true,
      eqHiMidDb: 2,
      eqHighDb: 0.5,
      chorusMix: 0.24,
      delayMix: 0.16,
      delayTimeMs: 155,
    },
  },
  disco: {
    filterCutoffHz: 840,
    filterDrive: 0.36,
    subLevel: 0.35,
    ampAttackMs: 0,
    ampDecayMs: 92,
    ampSustain: 0.11,
    fx: {
      ...GENO_ULTRA_FX_DEFAULTS,
      eqEnabled: true,
      eqLoMidDb: -1.5,
      eqHiMidDb: 3,
      chorusMix: 0.14,
      delayMix: 0.11,
      delayTimeMs: 175,
    },
  },
  rnb: {
    filterCutoffHz: 210,
    subLevel: 0.86,
    ampAttackMs: 2,
    ampDecayMs: 140,
    ampSustain: 0.16,
    fx: {
      ...GENO_ULTRA_FX_DEFAULTS,
      eqEnabled: true,
      eqLowDb: 6.5,
      eqLoMidDb: -2,
      delayMix: 0.18,
      delayTimeMs: 260,
      reverbMix: 0.08,
      chorusMix: 0.06,
    },
  },
  rock: {
    filterCutoffHz: 520,
    filterDrive: 0.52,
    filterResonanceQ: 1.2,
    subLevel: 0.48,
    ampAttackMs: 0,
    ampDecayMs: 108,
    ampSustain: 0.14,
    fx: {
      ...GENO_ULTRA_FX_DEFAULTS,
      eqEnabled: true,
      eqLoMidDb: 1.5,
      eqHiMidDb: 2.5,
      chorusMix: 0.06,
      delayMix: 0.05,
    },
  },
  electro: {
    filterCutoffHz: 295,
    filterResonanceQ: 0.72,
    filterDrive: 0.52,
    filterAttackMs: 0,
    filterDecayMs: 92,
    filterSustain: 0.1,
    subLevel: 0.84,
    ampAttackMs: 0,
    ampDecayMs: 102,
    ampSustain: 0.07,
    ampReleaseMs: 78,
    osc1: { wave: 'saw', level: 0.82 },
    osc2: { wave: 'square', level: 0.28, semitone: -12 },
    fx: {
      ...GENO_ULTRA_FX_DEFAULTS,
      eqEnabled: true,
      eqLowDb: 7.5,
      eqLoMidDb: -4,
      eqHiMidDb: 1.2,
      eqHighDb: -3,
      chorusMix: 0,
      delayMix: 0.06,
      delayTimeMs: 130,
      reverbMix: 0.02,
    },
  },
  pop: {
    filterCutoffHz: 680,
    subLevel: 0.55,
    ampAttackMs: 0,
    ampDecayMs: 100,
    ampSustain: 0.12,
    fx: {
      ...GENO_ULTRA_FX_DEFAULTS,
      eqEnabled: true,
      eqHiMidDb: 1.6,
      chorusMix: 0.12,
      delayMix: 0.1,
      delayTimeMs: 185,
    },
  },
  walk: {
    filterCutoffHz: 640,
    filterDrive: 0.34,
    subLevel: 0.44,
    ampAttackMs: 0,
    ampDecayMs: 112,
    ampSustain: 0.13,
    fx: {
      ...GENO_ULTRA_FX_DEFAULTS,
      eqEnabled: true,
      eqLoMidDb: -1,
      eqHiMidDb: 2,
      chorusMix: 0.1,
      delayMix: 0.08,
    },
  },
};

/** Extra tweaks on top of role patch for named producer / iconic grooves. */
const PRESET_FINE_PATCH: Partial<Record<string, GenoBassGrooveSoundPatch>> = {
  'prod-drill-punch': {
    filterCutoffHz: 310,
    filterDrive: 0.55,
    fx: { delayMix: 0.1, eqHiMidDb: 2.8 },
  },
  'prod-metro-hold': {
    filterCutoffHz: 170,
    subLevel: 0.94,
    fx: { eqLowDb: 7.5, reverbMix: 0.02 },
  },
  'prod-oct-roll': {
    filterCutoffHz: 1020,
    filterResonanceQ: 1.5,
    fx: { delayMix: 0.14, chorusMix: 0.1 },
  },
  'prod-wc-cruise': {
    filterCutoffHz: 560,
    fx: { chorusMix: 0.22, delayTimeMs: 240 },
  },
  'prod-funk-bootsy': {
    filterCutoffHz: 800,
    filterDrive: 0.45,
    fx: { eqHiMidDb: 3 },
  },
  'prod-house-pump': {
    filterCutoffHz: 960,
    fx: { chorusMix: 0.28, delayMix: 0.18 },
  },
  'prod-daft-pocket': {
    filterCutoffHz: 880,
    fx: { chorusMix: 0.2, delayMix: 0.15, delayTimeMs: 148 },
  },
  'trap-808-slide': {
    filterCutoffHz: 175,
    subLevel: 0.9,
  },
  'drill-808': {
    filterCutoffHz: 320,
    filterDrive: 0.5,
  },
  'elec-kingdom-floor': {
    filterCutoffHz: 310,
    filterDrive: 0.5,
    subLevel: 0.82,
    fx: { eqLowDb: 7, delayMix: 0.05 },
  },
  'elec-oct-floor': {
    filterCutoffHz: 280,
    subLevel: 0.86,
    osc2: { semitone: -12, level: 0.32 },
    fx: { eqLowDb: 7.2 },
  },
  'elec-84-drive': {
    filterCutoffHz: 340,
    filterDrive: 0.56,
    ampDecayMs: 96,
    fx: { eqHiMidDb: 1.8, delayMix: 0.08 },
  },
  'elec-miami-thump': {
    filterCutoffHz: 265,
    subLevel: 0.88,
    ampDecayMs: 108,
    fx: { eqLowDb: 8, eqLoMidDb: -4.5 },
  },
  'elec-808-pocket': {
    filterCutoffHz: 240,
    subLevel: 0.9,
    ampDecayMs: 112,
    fx: { eqLowDb: 7.8 },
  },
  'elec-kick-lock': {
    filterCutoffHz: 275,
    subLevel: 0.85,
    ampDecayMs: 98,
    fx: { eqLowDb: 7.4 },
  },
  'elec-16th-rush': {
    filterCutoffHz: 320,
    filterDrive: 0.48,
    ampDecayMs: 88,
    ampSustain: 0.06,
    fx: { eqLowDb: 6.8 },
  },
  'elec-booty-bounce': {
    filterCutoffHz: 285,
    subLevel: 0.87,
    ampDecayMs: 104,
    fx: { eqLowDb: 7.6, eqLoMidDb: -3.8 },
  },
  'elec-jam-floor': {
    filterCutoffHz: 300,
    filterDrive: 0.54,
    subLevel: 0.83,
    fx: { eqLowDb: 7.2, delayMix: 0.07 },
  },
  'elec-break-bounce': {
    filterCutoffHz: 290,
    subLevel: 0.84,
    ampDecayMs: 94,
    ampSustain: 0.06,
    fx: { eqLowDb: 7.5 },
  },
  'ek-kingdom-groove': {
    filterCutoffHz: 480,
    filterDrive: 0.46,
    fx: { delayMix: 0.12, eqLoMidDb: 2 },
  },
  'pp-risk-pocket': {
    filterCutoffHz: 700,
    filterDrive: 0.44,
    fx: { chorusMix: 0.1, delayMix: 0.08 },
  },
};

function mergePatch(
  base: GenoBassGrooveSoundPatch,
  extra?: GenoBassGrooveSoundPatch,
): GenoBassGrooveSoundPatch {
  if (!extra) return { ...base, fx: base.fx ? { ...base.fx } : undefined };
  return {
    ...base,
    ...extra,
    osc1: extra.osc1 ? { ...base.osc1, ...extra.osc1 } : base.osc1,
    osc2: extra.osc2 ? { ...base.osc2, ...extra.osc2 } : base.osc2,
    osc3: extra.osc3 ? { ...base.osc3, ...extra.osc3 } : base.osc3,
    fx: { ...base.fx, ...extra.fx },
  };
}

export function inferGenoBassGrooveSoundRole(preset: GenoBassGroovePreset): GenoBassGrooveSoundRole {
  const id = preset.id.toLowerCase();
  const genre = preset.genre.toLowerCase();

  if (id.includes('drill') || genre.includes('drill')) return 'drill';
  if (
    preset.group === '808' ||
    id.includes('808') ||
    id.includes('metro') ||
    id.includes('trap') ||
    genre.includes('trap')
  ) {
    return 'trap808';
  }
  if (genre.includes('g-funk') || id.includes('gfunk') || id.includes('wc-cruise')) return 'gfunk';
  if (genre.includes('disco') || id.includes('disco') || id.includes('chic')) return 'disco';
  if (genre.includes('funk') || id.includes('funk') || id.includes('bootsy')) return 'funk';
  if (genre.includes('house') || id.includes('house') || id.includes('daft')) return 'house';
  if (genre.includes('r&b') || genre.includes('rnb') || id.includes('rnb') || id.includes('silk')) return 'rnb';
  if (genre.includes('rock') || id.includes('rock')) return 'rock';
  if (
    preset.group === 'electro' ||
    id.startsWith('elec-') ||
    genre.includes('miami') ||
    genre.includes('electro') ||
    id.includes('ek-') ||
    id.includes('siberian') ||
    id.includes('nc-') ||
    id.includes('pp-risk')
  ) {
    return 'electro';
  }
  if (id.includes('walk') || id.includes('gtr-')) return 'walk';
  if (genre.includes('pop') || id.includes('club') || preset.group === 'pop') return 'pop';
  if (id.includes('club')) return 'club';
  if (preset.group === 'synth') return 'electro';
  return preset.group === 'funk' ? 'funk' : 'pop';
}

export function resolveGenoBassGrooveSound(preset: GenoBassGroovePreset): GenoBassGrooveSoundMatch {
  const role = inferGenoBassGrooveSoundRole(preset);
  const soundPresetId = preset.soundPresetId ?? ROLE_BASE_SOUND[role];
  const patch = mergePatch(ROLE_PATCH[role], PRESET_FINE_PATCH[preset.id]);
  return { soundPresetId, patch, role };
}

export function applyGenoBassGrooveSoundPatch(
  voice: GenoUltraSynthVoiceParams,
  patch: GenoBassGrooveSoundPatch,
): GenoUltraSynthVoiceParams {
  const { osc1, osc2, osc3, fx, ...rest } = patch;
  const next: GenoUltraSynthVoiceParams = {
    ...voice,
    modSlots: voice.modSlots.map((s) => ({ ...s })),
    fx: { ...voice.fx },
    osc1: { ...voice.osc1 },
    osc2: { ...voice.osc2 },
    osc3: { ...voice.osc3 },
  };
  Object.assign(next, rest);
  if (osc1) next.osc1 = { ...next.osc1, ...osc1 };
  if (osc2) next.osc2 = { ...next.osc2, ...osc2 };
  if (osc3) next.osc3 = { ...next.osc3, ...osc3 };
  if (fx) next.fx = { ...next.fx, ...fx };
  return next;
}

/** Load bank preset + groove-matched EQ / filter / FX tweaks. */
export function genoBassVoiceForGrooveSoundMatch(match: GenoBassGrooveSoundMatch): GenoUltraSynthVoiceParams {
  const base = genoBassPresetById(match.soundPresetId);
  return applyGenoBassGrooveSoundPatch(base, match.patch);
}
