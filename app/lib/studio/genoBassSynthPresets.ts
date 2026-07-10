/**
 * Geno Bass Synth — 55 classic synth-bass presets (Mooga, Retro Box, FM, analog sub).
 * Reuses Geno Ultra voice engine; bass-only bank with dedicated ids.
 */
import {
  GENO_ULTRA_CINEMATIC_HIT_PRESET_IDS,
  GENO_ULTRA_SYNTH_PRESETS,
} from '@/app/lib/studio/genoUltraSynthPresets';
import {
  GENO_ULTRA_FX_DEFAULTS,
  genoUltraDefaultModSlots,
  genoUltraDefaultVoice,
  type GenoUltraModSlot,
  type GenoUltraOscParams,
  type GenoUltraSynthVoiceParams,
} from '@/app/lib/studio/genoUltraSynthTypes';

export const GENO_BASS_DEFAULT_PRESET_ID = 'bass-cine-impact';

export type GenoBassSynthGroup = 'moog' | 'roland' | 'dx' | 'analog' | 'sub' | 'funk' | 'cinematic';

export type GenoBassSynthPreset = GenoUltraSynthVoiceParams & {
  bassGroup: GenoBassSynthGroup;
};

type VoicePatch = Partial<
  Omit<GenoUltraSynthVoiceParams, 'osc1' | 'osc2' | 'osc3' | 'fx' | 'modSlots' | 'id' | 'label' | 'category'>
> & {
  osc1?: Partial<GenoUltraOscParams>;
  osc2?: Partial<GenoUltraOscParams>;
  osc3?: Partial<GenoUltraOscParams>;
  fx?: Partial<GenoUltraSynthVoiceParams['fx']>;
  modSlots?: readonly GenoUltraModSlot[];
};

function cloneVoice(v: GenoUltraSynthVoiceParams): GenoUltraSynthVoiceParams {
  return {
    ...v,
    modSlots: v.modSlots.map((s) => ({ ...s })),
    fx: { ...v.fx },
    osc1: { ...v.osc1 },
    osc2: { ...v.osc2 },
    osc3: { ...v.osc3 },
  };
}

function findBase(id: string): GenoUltraSynthVoiceParams {
  return cloneVoice(GENO_ULTRA_SYNTH_PRESETS.find((p) => p.id === id) ?? genoUltraDefaultVoice());
}

function applyPatch(v: GenoUltraSynthVoiceParams, patch: VoicePatch): GenoUltraSynthVoiceParams {
  const { osc1, osc2, osc3, fx, modSlots, ...rest } = patch;
  Object.assign(v, rest);
  if (osc1) v.osc1 = { ...v.osc1, ...osc1 };
  if (osc2) v.osc2 = { ...v.osc2, ...osc2 };
  if (osc3) v.osc3 = { ...v.osc3, ...osc3 };
  if (fx) v.fx = { ...v.fx, ...fx };
  if (modSlots) v.modSlots = modSlots.map((s) => ({ ...s }));
  return v;
}

function genoBassSanitizeDisplayLabel(label: string): string {
  return label
    .replace(/\bMoog\b/gi, 'Mooga')
    .replace(/\bMicromoog\b/gi, 'Micro Mooga')
    .replace(/\bRoland\b/gi, 'Retro Box')
    .replace(/\bTB-303\b/gi, 'Acid 303')
    .replace(/\bTR-808\b/gi, '808')
    .replace(/\bSH-101\b/gi, 'Mono 101')
    .replace(/\bJuno-106\b/gi, 'Chorus 106')
    .replace(/\bJX-8P\b/gi, 'Poly 8P')
    .replace(/\bMC-202\b/gi, 'Seq 202')
    .replace(/\bSystem-100\b/gi, 'Sys 100')
    .replace(/\bJupiter\b/gi, 'Sky')
    .replace(/\bDX7\b/gi, 'FM VII')
    .replace(/\bARP\b/gi, '')
    .replace(/\bOB-Xa\b/gi, 'Cross')
    .replace(/\bProphet\b/gi, 'Pro Voice')
    .replace(/\bMS-20\b/gi, 'Sharp 20')
    .replace(/\bCS-80\b/gi, 'Poly 80')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function deriveBass(
  baseId: string,
  id: string,
  label: string,
  bassGroup: GenoBassSynthGroup,
  patch: VoicePatch = {},
): GenoBassSynthPreset {
  const v = applyPatch(findBase(baseId), patch);
  v.id = id;
  v.label = genoBassSanitizeDisplayLabel(label);
  v.category = 'bass';
  v.unisonVoices = Math.min(v.unisonVoices, 2);
  return { ...v, bassGroup };
}

function remapUltraBass(p: GenoUltraSynthVoiceParams): GenoBassSynthPreset {
  const id = p.id.startsWith('ultra-') ? `bass-${p.id.slice(6)}` : `bass-${p.id}`;
  const group: GenoBassSynthGroup =
    p.label.toLowerCase().includes('808') || p.label.toLowerCase().includes('sub')
      ? 'sub'
      : p.label.toLowerCase().includes('funk') || p.label.toLowerCase().includes('slap')
        ? 'funk'
        : p.label.toLowerCase().includes('moog')
          ? 'moog'
          : 'analog';
  const v = cloneVoice(p);
  v.id = id;
  v.category = 'bass';
  v.label = genoBassSanitizeDisplayLabel(v.label);
  return { ...v, bassGroup: group };
}

const ULTRA_BASS = GENO_ULTRA_SYNTH_PRESETS.filter((p) => p.category === 'bass').map(remapUltraBass);

const CLASSIC_BASS_SPECS: readonly {
  id: string;
  label: string;
  bassGroup: GenoBassSynthGroup;
  baseId: string;
  patch?: VoicePatch;
}[] = [
  { id: 'bass-mini-moog', label: 'Mini Mooga', bassGroup: 'moog', baseId: 'ultra-moog-bass', patch: { filterCutoffHz: 460, filterResonanceQ: 1.12, subLevel: 0.42 } },
  { id: 'bass-model-d', label: 'Model D', bassGroup: 'moog', baseId: 'ultra-moog-bass', patch: { filterDrive: 0.38, filterCutoffHz: 520, ampDecayMs: 280 } },
  { id: 'bass-voyager', label: 'Voyager Bass', bassGroup: 'moog', baseId: 'ultra-moog-bass', patch: { osc2: { level: 0.35, semitone: 12 }, filterResonanceQ: 1.35 } },
  { id: 'bass-taurus', label: 'Taurus Pedal', bassGroup: 'moog', baseId: 'ultra-moog-bass', patch: { osc1: { wave: 'square' }, subLevel: 0.65, filterCutoffHz: 320 } },
  { id: 'bass-prodigy', label: 'Prodigy Bass', bassGroup: 'moog', baseId: 'ultra-moog-bass', patch: { filterDrive: 0.52, ampSustain: 0.72 } },
  { id: 'bass-rogue', label: 'Rogue Bass', bassGroup: 'moog', baseId: 'ultra-moog-bass', patch: { osc1: { wave: 'saw' }, osc2: { wave: 'square', level: 0.18 }, filterCutoffHz: 620 } },
  { id: 'bass-source', label: 'Source Bass', bassGroup: 'moog', baseId: 'ultra-moog-bass', patch: { filterKeyTrack: 0.55, ampAttackMs: 4 } },
  { id: 'bass-micromoog', label: 'Micro Mooga', bassGroup: 'moog', baseId: 'ultra-moog-bass', patch: { filterCutoffHz: 580, noiseLevel: 0.03 } },
  { id: 'bass-tb303', label: 'Acid 303', bassGroup: 'roland', baseId: 'ultra-acid-line', patch: { filterCutoffHz: 920, filterResonanceQ: 2.6, filterDrive: 0.48, ampDecayMs: 180 } },
  { id: 'bass-sh101', label: 'Mono 101', bassGroup: 'roland', baseId: 'ultra-moog-bass', patch: { osc1: { wave: 'saw', level: 0.78 }, osc2: { wave: 'square', level: 0.22, semitone: -12 }, filterCutoffHz: 700, filterResonanceQ: 1.12, filterDrive: 0.32, ampAttackMs: 2, ampDecayMs: 300, ampSustain: 0.64, subLevel: 0.36, fx: { ...GENO_ULTRA_FX_DEFAULTS, eqLowDb: 5.5 } } },
  { id: 'bass-juno106', label: 'Chorus 106', bassGroup: 'roland', baseId: 'ultra-moog-bass', patch: { osc1: { wave: 'square', pwm: 0.38 }, fx: { ...GENO_ULTRA_FX_DEFAULTS, chorusMix: 0.28 } } },
  { id: 'bass-jx8p', label: 'Poly 8P', bassGroup: 'roland', baseId: 'ultra-moog-bass', patch: { osc2: { level: 0.45, semitone: -12 }, filterCutoffHz: 680 } },
  { id: 'bass-mc202', label: 'Seq 202', bassGroup: 'roland', baseId: 'ultra-pluck-bass', patch: { filterCutoffHz: 1100, ampDecayMs: 240 } },
  { id: 'bass-tr808', label: '808 Bass', bassGroup: 'roland', baseId: 'ultra-sub-808', patch: { subLevel: 0.92, filterCutoffHz: 200 } },
  {
    id: 'bass-miami-thump',
    label: 'Miami Thump',
    bassGroup: 'sub',
    baseId: 'ultra-sub-808',
    patch: {
      osc1: { wave: 'saw', level: 0.8 },
      osc2: { wave: 'square', level: 0.26, semitone: -12 },
      subLevel: 0.86,
      filterCutoffHz: 280,
      filterResonanceQ: 0.68,
      filterDrive: 0.5,
      filterAttackMs: 0,
      filterDecayMs: 88,
      filterSustain: 0.1,
      ampAttackMs: 0,
      ampDecayMs: 98,
      ampSustain: 0.08,
      ampReleaseMs: 72,
      modSlots: [
        { source: 'filterEnv', dest: 'filterCutoff', amount: 0.72 },
        { source: 'velocity', dest: 'ampLevel', amount: 0.5 },
        { source: 'velocity', dest: 'filterCutoff', amount: 0.22 },
        { source: 'off', dest: 'off', amount: 0 },
        { source: 'off', dest: 'off', amount: 0 },
        { source: 'off', dest: 'off', amount: 0 },
        { source: 'off', dest: 'off', amount: 0 },
        { source: 'off', dest: 'off', amount: 0 },
      ],
      fx: {
        ...GENO_ULTRA_FX_DEFAULTS,
        eqEnabled: true,
        eqLowDb: 7.5,
        eqLoMidDb: -4,
        eqHiMidDb: 1,
        eqHighDb: -3,
        chorusMix: 0,
        delayMix: 0.05,
        reverbMix: 0.02,
      },
    },
  },
  { id: 'bass-system100', label: 'Sys 100', bassGroup: 'roland', baseId: 'ultra-moog-bass', patch: { osc2: { level: 0.28 }, filterResonanceQ: 1.05 } },
  { id: 'bass-jupiter', label: 'Sky Bass', bassGroup: 'roland', baseId: 'ultra-moog-bass', patch: { unisonVoices: 2, unisonDetuneCents: 8, fx: { ...GENO_ULTRA_FX_DEFAULTS, chorusMix: 0.22 } } },
  { id: 'bass-dx7', label: 'FM VII Bass', bassGroup: 'dx', baseId: 'ultra-pluck-bass', patch: { osc1: { wave: 'sine' }, osc2: { wave: 'sine', level: 0.55, semitone: 12 }, filterCutoffHz: 2400, ampAttackMs: 1, ampDecayMs: 380 } },
  { id: 'bass-dx7fm', label: 'FM VII Sharp', bassGroup: 'dx', baseId: 'ultra-pluck-bass', patch: { osc1: { wave: 'square', pwm: 0.2 }, filterCutoffHz: 1800, filterResonanceQ: 1.8, ampDecayMs: 320 } },
  { id: 'bass-dx5th', label: 'FM Fifth Bass', bassGroup: 'dx', baseId: 'ultra-pluck-bass', patch: { osc2: { semitone: 7, level: 0.48 }, filterCutoffHz: 1600 } },
  { id: 'bass-dx80s', label: 'FM 80s Bass', bassGroup: 'dx', baseId: 'ultra-siberian-moog', patch: { filterCutoffHz: 1200, fx: { ...GENO_ULTRA_FX_DEFAULTS, chorusMix: 0.12, delayMix: 0.18 } } },
  { id: 'bass-dxbell', label: 'FM Bell Bass', bassGroup: 'dx', baseId: 'ultra-pluck-bass', patch: { osc3: { level: 0.35, semitone: 24 }, filterCutoffHz: 3200, ampDecayMs: 520 } },
  { id: 'bass-dxrubber', label: 'FM Rubber', bassGroup: 'dx', baseId: 'ultra-rubber-funk', patch: { filterCutoffHz: 720, ampSustain: 0.55 } },
  { id: 'bass-obxa', label: 'Cross Bass', bassGroup: 'analog', baseId: 'ultra-moog-bass', patch: { osc1: { wave: 'saw' }, osc2: { level: 0.52, semitone: 0, fineCents: 6 }, filterDrive: 0.32 } },
  { id: 'bass-prophet', label: 'Pro Voice Bass', bassGroup: 'analog', baseId: 'ultra-moog-bass', patch: { osc1: { wave: 'saw' }, osc2: { wave: 'square', level: 0.4 }, filterCutoffHz: 560 } },
  { id: 'bass-matrix6', label: 'Matrix-6 Bass', bassGroup: 'analog', baseId: 'ultra-moog-bass', patch: { filterMode: 'lowpass', filterResonanceQ: 1.45, lfo1Depth: 0.22 } },
  { id: 'bass-odyssey', label: 'Odyssey Bass', bassGroup: 'analog', baseId: 'ultra-kingdom-bass', patch: { filterCutoffHz: 620, filterDrive: 0.38 } },
  { id: 'bass-2600', label: 'Modular 2600', bassGroup: 'analog', baseId: 'ultra-kingdom-bass', patch: { noiseLevel: 0.05, filterResonanceQ: 1.55 } },
  { id: 'bass-ms20', label: 'Sharp 20 Bass', bassGroup: 'analog', baseId: 'ultra-moog-bass', patch: { filterMode: 'lowpass', filterDrive: 0.58, filterCutoffHz: 480, filterResonanceQ: 1.85 } },
  { id: 'bass-cs80', label: 'Poly 80 Bass', bassGroup: 'analog', baseId: 'ultra-moog-bass', patch: { osc1: { wave: 'square', pwm: 0.45 }, unisonVoices: 2, fx: { ...GENO_ULTRA_FX_DEFAULTS, chorusMix: 0.35 } } },
  { id: 'bass-reese', label: 'Reese Classic', bassGroup: 'analog', baseId: 'ultra-reese-wide', patch: { unisonVoices: 2, unisonDetuneCents: 12 } },
  { id: 'bass-phase', label: 'Phase Bass', bassGroup: 'analog', baseId: 'ultra-phase-bass', patch: {} },
  { id: 'bass-planet-risk', label: 'Planet Risk Bass', bassGroup: 'roland', baseId: 'ultra-moog-bass', patch: { osc1: { wave: 'saw', level: 0.82 }, osc2: { wave: 'square', level: 0.18, semitone: -12 }, filterCutoffHz: 720, filterResonanceQ: 1.08, filterDrive: 0.4, filterKeyTrack: 0.42, ampAttackMs: 1, ampDecayMs: 260, ampSustain: 0.66, subLevel: 0.4, fx: { ...GENO_ULTRA_FX_DEFAULTS, eqLowDb: 6, eqLoMidDb: 1.5, chorusMix: 0.08 } } },
  { id: 'bass-siberian', label: 'Siberian Mooga', bassGroup: 'moog', baseId: 'ultra-siberian-moog', patch: {} },
  { id: 'bass-kingdom', label: 'Kingdom Bass', bassGroup: 'analog', baseId: 'ultra-kingdom-bass', patch: { osc1: { wave: 'saw', level: 0.7 }, osc2: { wave: 'square', level: 0.26, semitone: -12 }, filterCutoffHz: 460, filterResonanceQ: 1.52, filterDrive: 0.44, filterAttackMs: 4, filterDecayMs: 200, filterSustain: 0.32, ampAttackMs: 3, ampDecayMs: 340, ampSustain: 0.7, subLevel: 0.5, fx: { ...GENO_ULTRA_FX_DEFAULTS, eqLowDb: 6.5, eqLoMidDb: 2, delayMix: 0.1, delayTimeMs: 240 } } },
  { id: 'bass-sub-pure', label: 'Pure Sub', bassGroup: 'sub', baseId: 'ultra-sub-808', patch: { subLevel: 0.98, osc2: { level: 0 }, filterCutoffHz: 120 } },
  { id: 'bass-sub-long', label: 'Long 808', bassGroup: 'sub', baseId: 'ultra-sub-808', patch: { ampDecayMs: 820, ampReleaseMs: 520, subLevel: 0.88 } },
  { id: 'bass-club-sub', label: 'Club Sub', bassGroup: 'sub', baseId: 'ultra-growl-808', patch: { filterDrive: 0.42, fx: { ...GENO_ULTRA_FX_DEFAULTS, eqLowDb: 5.5 } } },
  { id: 'bass-cinema-sub', label: 'Cinema Sub', bassGroup: 'sub', baseId: 'ultra-cinema-sub', patch: {} },
  { id: 'bass-dub-sub', label: 'Dub Sub', bassGroup: 'sub', baseId: 'ultra-dub-sub', patch: { subLevel: 0.88, osc1: { wave: 'sine', level: 0.55 }, filterCutoffHz: 180, ampDecayMs: 420, ampSustain: 0.82, fx: { ...GENO_ULTRA_FX_DEFAULTS, eqLowDb: 7 } } },
  { id: 'bass-trap-sub', label: 'Trap Sub', bassGroup: 'sub', baseId: 'ultra-trap-sub', patch: {} },
  { id: 'bass-funk-rubber', label: 'Rubber Funk', bassGroup: 'funk', baseId: 'ultra-rubber-funk', patch: {} },
  { id: 'bass-boogie', label: 'Boogie Bass', bassGroup: 'funk', baseId: 'ultra-boogie-bass', patch: { osc1: { wave: 'saw', level: 0.62 }, osc2: { level: 0.42, semitone: 12, wave: 'square' }, filterCutoffHz: 620, filterResonanceQ: 1.28, filterDrive: 0.36, ampDecayMs: 280, ampSustain: 0.62, subLevel: 0.38 } },
  { id: 'bass-slap', label: 'Slap House', bassGroup: 'funk', baseId: 'ultra-slap-house', patch: {} },
  { id: 'bass-brass', label: 'Brass Bass', bassGroup: 'funk', baseId: 'ultra-brass-bass', patch: {} },
  { id: 'bass-wobble', label: 'Wobble Bass', bassGroup: 'funk', baseId: 'ultra-wobble-bass', patch: {} },
  { id: 'bass-deep-roller', label: 'Deep Roller', bassGroup: 'sub', baseId: 'ultra-deep-roller', patch: {} },
  { id: 'bass-pluck', label: 'Pluck Bass', bassGroup: 'funk', baseId: 'ultra-pluck-bass', patch: {} },
];

const CLASSIC_BASS = CLASSIC_BASS_SPECS.map((s) =>
  deriveBass(s.baseId, s.id, s.label, s.bassGroup, s.patch ?? {}),
);

const CINEMATIC_BASS: readonly GenoBassSynthPreset[] = [
  deriveBass('ultra-cine-impact', 'bass-cine-impact', 'Cinematic Impact', 'cinematic', {
    subLevel: 0.52,
    filterCutoffHz: 760,
    ampDecayMs: 360,
    ampSustain: 0.24,
    fx: { ...GENO_ULTRA_FX_DEFAULTS, reverbMix: 0.3, eqLowDb: 5.2, eqLoMidDb: -1.2 },
  }),
  deriveBass('ultra-cine-impact-dark', 'bass-cine-impact-dark', 'Cinematic Impact (Dark)', 'cinematic', {
    subLevel: 0.58,
    filterCutoffHz: 520,
    ampDecayMs: 430,
    ampSustain: 0.3,
    fx: { ...GENO_ULTRA_FX_DEFAULTS, reverbMix: 0.35, eqLowDb: 5.8, eqHighDb: -3.5 },
  }),
  deriveBass('ultra-cine-impact-sub', 'bass-cine-impact-sub', 'Cinematic Impact (Sub)', 'cinematic', {
    subLevel: 0.92,
    filterCutoffHz: 280,
    ampDecayMs: 520,
    ampSustain: 0.48,
    fx: { ...GENO_ULTRA_FX_DEFAULTS, reverbMix: 0.18, eqLowDb: 7.2, eqLoMidDb: -2.2 },
  }),
  deriveBass(
    'ultra-cine-impact-bright',
    'bass-cine-impact-bright',
    'Cinematic Impact (Bright)',
    'cinematic',
    {
      filterCutoffHz: 980,
      filterResonanceQ: 1.4,
      ampDecayMs: 280,
      ampSustain: 0.12,
      fx: { ...GENO_ULTRA_FX_DEFAULTS, eqHiMidDb: 2.2, eqHighDb: 2.4 },
    },
  ),
  deriveBass(
    'ultra-cine-impact-filtered',
    'bass-cine-impact-filtered',
    'Cinematic Impact (Filtered)',
    'cinematic',
    {
      filterMode: 'bandpass',
      filterCutoffHz: 900,
      filterResonanceQ: 2.1,
      ampDecayMs: 280,
      ampSustain: 0.16,
    },
  ),
  deriveBass('ultra-cine-symphony-hit', 'bass-cine-symphony-hit', 'Symphony Hit', 'cinematic', {
    filterCutoffHz: 660,
    ampDecayMs: 340,
    ampSustain: 0.22,
    subLevel: 0.5,
  }),
  deriveBass('ultra-cine-brass-impact', 'bass-cine-brass-impact', 'Brass Impact', 'cinematic', {
    filterCutoffHz: 760,
    ampDecayMs: 310,
    ampSustain: 0.18,
  }),
  deriveBass('ultra-cine-big-brass-hit', 'bass-cine-big-brass-hit', 'Big Brass Hit', 'cinematic', {
    filterCutoffHz: 720,
    ampDecayMs: 330,
    ampSustain: 0.2,
  }),
  deriveBass(
    'ultra-cine-classic-orch-hit',
    'bass-cine-classic-orch-hit',
    'Classic Orch Hit',
    'cinematic',
    {
      filterCutoffHz: 700,
      ampDecayMs: 290,
      ampSustain: 0.16,
    },
  ),
  deriveBass('ultra-cine-choir-stab', 'bass-cine-choir-stab', 'Choir Stab', 'cinematic', {
    filterCutoffHz: 640,
    ampDecayMs: 360,
    ampSustain: 0.24,
    fx: { ...GENO_ULTRA_FX_DEFAULTS, reverbMix: 0.4, eqLowDb: 3.2 },
  }),
  deriveBass('ultra-cine-tight-low-strings', 'bass-cine-tight-low-strings', 'Tight Low Strings', 'cinematic', {
    filterCutoffHz: 560,
    ampDecayMs: 360,
    ampSustain: 0.28,
    subLevel: 0.62,
  }),
  deriveBass('ultra-cine-pizzicato-stab', 'bass-cine-pizzicato-stab', 'Pizzicato Stab', 'cinematic', {
    filterCutoffHz: 1120,
    ampDecayMs: 170,
    ampSustain: 0.06,
  }),
  deriveBass('ultra-cine-pizz-chord', 'bass-cine-pizz-chord', 'Pizz Chord', 'cinematic', {
    filterCutoffHz: 980,
    ampDecayMs: 220,
    ampSustain: 0.08,
  }),
  deriveBass(
    'ultra-cine-sharp-brass-stab',
    'bass-cine-sharp-brass-stab',
    'Sharp Brass Stab',
    'cinematic',
    {
      filterMode: 'bandpass',
      filterCutoffHz: 860,
      filterResonanceQ: 2.4,
      ampDecayMs: 210,
      ampSustain: 0.05,
      subLevel: 0.4,
    },
  ),
];

const seen = new Set<string>();
const BANK: GenoBassSynthPreset[] = [];
for (const p of [...CINEMATIC_BASS, ...CLASSIC_BASS, ...ULTRA_BASS]) {
  if (seen.has(p.id)) continue;
  seen.add(p.id);
  BANK.push(p);
}

if (BANK.length < 64) {
  const padBases = ['ultra-moog-bass', 'ultra-sub-808', 'ultra-reese-wide'] as const;
  let i = 0;
  while (BANK.length < 64) {
    const base = padBases[i % padBases.length]!;
    BANK.push(
      deriveBass(base, `bass-variant-${BANK.length}`, `Bass Variant ${BANK.length}`, 'analog', {
        filterCutoffHz: 400 + (BANK.length % 12) * 40,
        ampDecayMs: 200 + (BANK.length % 8) * 30,
      }),
    );
    i += 1;
  }
}

/** Core bass library + cinematic hit bank for sound-design lanes. */
export const GENO_BASS_SYNTH_PRESETS: readonly GenoBassSynthPreset[] = BANK;

export const GENO_BASS_CINEMATIC_PRESET_IDS: readonly string[] = [
  ...GENO_ULTRA_CINEMATIC_HIT_PRESET_IDS.map((id) => id.replace('ultra-', 'bass-')),
];

export const GENO_BASS_SYNTH_PRESET_COUNT = GENO_BASS_SYNTH_PRESETS.length;

export const GENO_BASS_GROUP_LABELS: Record<GenoBassSynthGroup, string> = {
  moog: 'Mooga',
  roland: 'Retro Box',
  dx: 'FM / Digital',
  analog: 'Analog',
  sub: 'Sub / 808',
  funk: 'Funk / Pluck',
  cinematic: 'Cinematic Hits',
};

export function genoBassPresetById(id: string): GenoBassSynthPreset {
  const hit = GENO_BASS_SYNTH_PRESETS.find((p) => p.id === id);
  if (!hit) return { ...GENO_BASS_SYNTH_PRESETS[0]!, modSlots: genoUltraDefaultModSlots().map((s) => ({ ...s })) };
  return {
    ...hit,
    modSlots: hit.modSlots.map((s) => ({ ...s })),
    fx: { ...hit.fx },
    osc1: { ...hit.osc1 },
    osc2: { ...hit.osc2 },
    osc3: { ...hit.osc3 },
  };
}

export function genoBassSanitizePresetId(id: string | undefined): string {
  if (id && GENO_BASS_SYNTH_PRESETS.some((p) => p.id === id)) return id;
  return GENO_BASS_DEFAULT_PRESET_ID;
}

export function genoBassPresetsForGroup(group: GenoBassSynthGroup): readonly GenoBassSynthPreset[] {
  return GENO_BASS_SYNTH_PRESETS.filter((p) => p.bassGroup === group);
}
