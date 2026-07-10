/**
 * Geno Ultra — Retrologue-style dry sound bodies for step/grid sequencing.
 * Names (id + label) stay the same; oscillators are rebuilt as clean dry tones.
 * No FX / LFO / unison / noise — CTRL lanes and GATE shape the phrase.
 */
import {
  GENO_ULTRA_DEFAULT_OUTPUT_LEVEL,
  GENO_ULTRA_FILTER_OPEN_HZ,
  GENO_ULTRA_FX_INIT,
  genoUltraDefaultModSlots,
  type GenoUltraFxParams,
  type GenoUltraOscParams,
  type GenoUltraSynthVoiceParams,
} from '@/app/lib/studio/genoUltraSynthTypes';

/** Hard-dry FX rack. */
export const GENO_ULTRA_ARP_FX_OFF: GenoUltraFxParams = { ...GENO_ULTRA_FX_INIT };

/**
 * Electro / 80s pattern-writer sound ids.
 */
export const GENO_ULTRA_ELECTRO_DRY_SOUND_IDS: ReadonlySet<string> = new Set([
  'ultra-horror-keys',
  'ultra-dread-lead',
  'ultra-haunt-keys',
  'ultra-evil-arp',
  'ultra-shock-keys',
  'ultra-phantom-stab',
  'ultra-acid-line',
  'ultra-porta-lead',
  'ultra-wire-lead',
  'ultra-laser-lead',
  'ultra-bright-hook',
  'ultra-digi-pluck',
  'ultra-crystal-pluck',
  'ultra-guitar-pluck',
  'ultra-kingdom-bass',
  'ultra-boogie-bass',
  'ultra-dub-sub',
  'ultra-siberian-moog',
]);

export function genoUltraVoiceIsElectroDryTarget(id: string): boolean {
  return GENO_ULTRA_ELECTRO_DRY_SOUND_IDS.has(id);
}

const osc = (
  wave: GenoUltraOscParams['wave'],
  level: number,
  semitone = 0,
  pwm = 0.5,
): GenoUltraOscParams => ({ wave, level, semitone, fineCents: 0, pwm });

const silent = (wave: GenoUltraOscParams['wave'] = 'saw'): GenoUltraOscParams =>
  osc(wave, 0, 0);

type DryPatch = {
  osc1: GenoUltraOscParams;
  osc2: GenoUltraOscParams;
  osc3: GenoUltraOscParams;
  subLevel: number;
  filterCutoffHz?: number;
  filterResonanceQ?: number;
  /** Odyssey-style filter punch (not pitch bend). */
  filterAttackMs?: number;
  filterDecayMs?: number;
  filterSustain?: number;
  filterReleaseMs?: number;
  filterKeyTrack?: number;
  filterDrive?: number;
  ampAttackMs?: number;
  ampDecayMs?: number;
  ampSustain?: number;
  ampReleaseMs?: number;
  outputLevel?: number;
};

/**
 * Dry body shell — no FX/LFO/unison.
 * Optional filter+amp envelopes for Odyssey/303 punch (pitch stays snapped in the player).
 */
function dryGateShell(voice: GenoUltraSynthVoiceParams, patch: DryPatch): GenoUltraSynthVoiceParams {
  const fSus = patch.filterSustain ?? 1;
  const aSus = patch.ampSustain ?? 1;
  return {
    ...voice,
    osc1: { ...patch.osc1 },
    osc2: { ...patch.osc2 },
    osc3: { ...patch.osc3 },
    subLevel: patch.subLevel,
    noiseLevel: 0,
    unisonVoices: 1,
    unisonDetuneCents: 0,
    filterMode: 'lowpass',
    filterCutoffHz: patch.filterCutoffHz ?? GENO_ULTRA_FILTER_OPEN_HZ,
    filterResonanceQ: patch.filterResonanceQ ?? 0.1,
    filterDrive: patch.filterDrive ?? 0,
    filterKeyTrack: patch.filterKeyTrack ?? 0,
    filterAttackMs: patch.filterAttackMs ?? 0,
    filterDecayMs: patch.filterDecayMs ?? 0,
    filterSustain: fSus,
    filterReleaseMs: patch.filterReleaseMs ?? 10,
    ampAttackMs: patch.ampAttackMs ?? 0,
    ampDecayMs: patch.ampDecayMs ?? 0,
    ampSustain: aSus,
    ampReleaseMs: patch.ampReleaseMs ?? 25,
    modAttackMs: patch.filterAttackMs ?? 0,
    modDecayMs: patch.filterDecayMs ?? 0,
    modSustain: fSus,
    modReleaseMs: patch.filterReleaseMs ?? 25,
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
    outputLevel: patch.outputLevel ?? voice.outputLevel ?? GENO_ULTRA_DEFAULT_OUTPUT_LEVEL,
  };
}

/**
 * Electro ’80s filter baseline (user-tuned):
 * cutoff ~1800–2000 Hz, resonance ~2, filter env sustain 0.42, drive 0.
 * Keeps the saw from sitting flat — punch without opening the filter wide.
 */
const ELECTRO_80S_CUTOFF_HZ = 2000;
const ELECTRO_80S_RES = 2;
const ELECTRO_80S_FILTER_SUS = 0.42;

/**
 * Old-school electro hip-hop (Hashim / Clear / Kingdom / Newcleus mix):
 * clear mid presence, strong punch, bone-dry, rhythmic — no wash.
 * @see https://youtu.be/FASvb2hplmw
 */
function odysseyBassPatch(
  osc1: GenoUltraOscParams,
  osc2: GenoUltraOscParams,
  osc3: GenoUltraOscParams,
  subLevel: number,
  _cutoff: number,
  _res: number,
  outputLevel: number,
): DryPatch {
  return {
    osc1,
    osc2,
    osc3,
    subLevel,
    filterCutoffHz: ELECTRO_80S_CUTOFF_HZ,
    filterResonanceQ: ELECTRO_80S_RES,
    filterDrive: 0,
    filterKeyTrack: 0.2,
    filterAttackMs: 0,
    filterDecayMs: 160,
    filterSustain: ELECTRO_80S_FILTER_SUS,
    filterReleaseMs: 50,
    ampAttackMs: 1,
    ampDecayMs: 150,
    ampSustain: 0.28,
    ampReleaseMs: 40,
    outputLevel,
  };
}

/** Dry electro arp lead — cutoff ~2k, res 2, env 0.42, drive 0. */
function electroArpLeadPatch(
  osc1: GenoUltraOscParams,
  osc2: GenoUltraOscParams,
  osc3: GenoUltraOscParams,
  subLevel: number,
  _cutoff: number,
  _res: number,
  outputLevel: number,
): DryPatch {
  return {
    osc1,
    osc2,
    osc3,
    subLevel,
    filterCutoffHz: ELECTRO_80S_CUTOFF_HZ,
    filterResonanceQ: ELECTRO_80S_RES,
    filterDrive: 0,
    filterKeyTrack: 0.25,
    filterAttackMs: 0,
    filterDecayMs: 150,
    filterSustain: ELECTRO_80S_FILTER_SUS,
    filterReleaseMs: 45,
    ampAttackMs: 0,
    ampDecayMs: 110,
    ampSustain: 0.22,
    ampReleaseMs: 35,
    outputLevel,
  };
}

/** 70s funk bass — Minimoog/clav pocket, rubber square, mid LPF punch. */
function funkBassPatch(
  osc1: GenoUltraOscParams,
  osc2: GenoUltraOscParams,
  osc3: GenoUltraOscParams,
  subLevel: number,
  cutoff: number,
  res: number,
  outputLevel: number,
): DryPatch {
  return {
    osc1,
    osc2,
    osc3,
    subLevel,
    filterCutoffHz: cutoff,
    filterResonanceQ: res,
    filterDrive: 0.2,
    filterKeyTrack: 0.22,
    filterAttackMs: 2,
    filterDecayMs: 180,
    filterSustain: 0.28,
    filterReleaseMs: 80,
    ampAttackMs: 2,
    ampDecayMs: 240,
    ampSustain: 0.48,
    ampReleaseMs: 90,
    outputLevel,
  };
}

/** 70s soul keys / Rhodes — soft sine/tri, gentle filter bloom. */
function funkKeysPatch(
  osc1: GenoUltraOscParams,
  osc2: GenoUltraOscParams,
  osc3: GenoUltraOscParams,
  subLevel: number,
  cutoff: number,
  outputLevel: number,
): DryPatch {
  return {
    osc1,
    osc2,
    osc3,
    subLevel,
    filterCutoffHz: cutoff,
    filterResonanceQ: 0.55,
    filterDrive: 0.06,
    filterKeyTrack: 0.2,
    filterAttackMs: 4,
    filterDecayMs: 320,
    filterSustain: 0.4,
    filterReleaseMs: 140,
    ampAttackMs: 4,
    ampDecayMs: 280,
    ampSustain: 0.55,
    ampReleaseMs: 120,
    outputLevel,
  };
}

/** Keys / pluck melodies — low cutoff (~600–1000 Hz), fast gate to avoid note overlap pops. */
function melodyKeysPluckPatch(
  osc1: GenoUltraOscParams,
  osc2: GenoUltraOscParams,
  osc3: GenoUltraOscParams,
  subLevel: number,
  cutoff: number,
  outputLevel = 0.66,
): DryPatch {
  return {
    osc1,
    osc2,
    osc3,
    subLevel,
    filterCutoffHz: cutoff,
    filterResonanceQ: 0.72,
    filterDrive: 0.06,
    filterKeyTrack: 0.32,
    filterAttackMs: 1,
    filterDecayMs: 110,
    filterSustain: 0,
    filterReleaseMs: 55,
    ampAttackMs: 1,
    ampDecayMs: 165,
    ampSustain: 0,
    ampReleaseMs: 65,
    outputLevel,
  };
}

/** Horror slasher pluck — darker band, same tight gate. */
function horrorPluckPatch(
  osc1: GenoUltraOscParams,
  osc2: GenoUltraOscParams,
  osc3: GenoUltraOscParams,
  subLevel: number,
  cutoff: number,
  outputLevel = 0.64,
): DryPatch {
  return {
    ...melodyKeysPluckPatch(osc1, osc2, osc3, subLevel, cutoff, outputLevel),
    filterResonanceQ: 1.05,
    filterDrive: 0.1,
    ampDecayMs: 150,
    ampReleaseMs: 58,
  };
}

/** Funk wah / guitar — high res, mid cutoff, strong filter-env “quack”. */
function funkWahPatch(
  osc1: GenoUltraOscParams,
  osc2: GenoUltraOscParams,
  osc3: GenoUltraOscParams,
  subLevel: number,
  cutoff: number,
  res: number,
  outputLevel: number,
): DryPatch {
  return {
    osc1,
    osc2,
    osc3,
    subLevel,
    filterCutoffHz: cutoff,
    filterResonanceQ: res,
    filterDrive: 0.16,
    filterKeyTrack: 0.4,
    filterAttackMs: 2,
    filterDecayMs: 340,
    filterSustain: 0.12,
    filterReleaseMs: 110,
    ampAttackMs: 2,
    ampDecayMs: 260,
    ampSustain: 0.35,
    ampReleaseMs: 100,
    outputLevel,
  };
}

/** Disco / velvet lead — warm saw, softer punch. */
function discoLeadPatch(
  osc1: GenoUltraOscParams,
  osc2: GenoUltraOscParams,
  osc3: GenoUltraOscParams,
  subLevel: number,
  cutoff: number,
  outputLevel: number,
): DryPatch {
  return {
    osc1,
    osc2,
    osc3,
    subLevel,
    filterCutoffHz: cutoff,
    filterResonanceQ: 0.85,
    filterDrive: 0.08,
    filterKeyTrack: 0.25,
    filterAttackMs: 3,
    filterDecayMs: 300,
    filterSustain: 0.35,
    filterReleaseMs: 130,
    ampAttackMs: 3,
    ampDecayMs: 220,
    ampSustain: 0.6,
    ampReleaseMs: 110,
    outputLevel,
  };
}

/** Dance / euro / trance lead — bright dual saw, punchy filter. */
function danceLeadPatch(
  osc1: GenoUltraOscParams,
  osc2: GenoUltraOscParams,
  osc3: GenoUltraOscParams,
  subLevel: number,
  cutoff: number,
  res: number,
  outputLevel: number,
): DryPatch {
  return {
    osc1,
    osc2,
    osc3,
    subLevel,
    filterCutoffHz: cutoff,
    filterResonanceQ: res,
    filterDrive: 0.14,
    filterKeyTrack: 0.3,
    filterAttackMs: 1,
    filterDecayMs: 200,
    filterSustain: 0.25,
    filterReleaseMs: 90,
    ampAttackMs: 1,
    ampDecayMs: 180,
    ampSustain: 0.55,
    ampReleaseMs: 85,
    outputLevel,
  };
}

/** Festival / cinema rise — long attack bloom (no FX). */
function danceRisePatch(
  osc1: GenoUltraOscParams,
  osc2: GenoUltraOscParams,
  osc3: GenoUltraOscParams,
  subLevel: number,
  outputLevel: number,
): DryPatch {
  return {
    osc1,
    osc2,
    osc3,
    subLevel,
    filterCutoffHz: 900,
    filterResonanceQ: 0.9,
    filterDrive: 0.1,
    filterKeyTrack: 0.15,
    filterAttackMs: 1100,
    filterDecayMs: 200,
    filterSustain: 0.85,
    filterReleaseMs: 400,
    ampAttackMs: 1200,
    ampDecayMs: 400,
    ampSustain: 0.8,
    ampReleaseMs: 500,
    outputLevel,
  };
}

/** Category defaults — Retrologue-style dry VA stacks. */
function dryBodyForCategory(
  voice: GenoUltraSynthVoiceParams,
): GenoUltraSynthVoiceParams {
  switch (voice.category) {
    case 'bass':
      return dryGateShell(voice, {
        osc1: osc('saw', 0.88),
        osc2: osc('square', 0.28, -12, 0.42),
        osc3: silent('sine'),
        subLevel: 0.55,
        filterCutoffHz: 2400,
        filterResonanceQ: 0.45,
        outputLevel: 0.72,
      });
    case 'pluck':
      return dryGateShell(voice, {
        osc1: osc('triangle', 0.82),
        osc2: osc('sine', 0.28, 12),
        osc3: silent(),
        subLevel: 0.08,
        filterCutoffHz: GENO_ULTRA_FILTER_OPEN_HZ,
        outputLevel: 0.68,
      });
    case 'keys':
      return dryGateShell(voice, {
        osc1: osc('sine', 0.72),
        osc2: osc('triangle', 0.38),
        osc3: osc('sine', 0.18, 12),
        subLevel: 0.12,
        filterCutoffHz: 9800,
        outputLevel: 0.66,
      });
    case 'pad':
      return dryGateShell(voice, {
        osc1: osc('saw', 0.62),
        osc2: osc('triangle', 0.48),
        osc3: osc('sine', 0.22, 12),
        subLevel: 0.18,
        filterCutoffHz: 7200,
        outputLevel: 0.58,
      });
    case 'fx':
      return dryGateShell(voice, {
        osc1: osc('square', 0.72, 0, 0.28),
        osc2: osc('saw', 0.42),
        osc3: silent(),
        subLevel: 0.1,
        filterCutoffHz: GENO_ULTRA_FILTER_OPEN_HZ,
        outputLevel: 0.62,
      });
    case 'lead':
    default:
      return dryGateShell(voice, {
        osc1: osc('saw', 0.86),
        osc2: osc('square', 0.32, 0, 0.45),
        osc3: silent('triangle'),
        subLevel: 0.14,
        filterCutoffHz: GENO_ULTRA_FILTER_OPEN_HZ,
        outputLevel: 0.68,
      });
  }
}

/**
 * Named dry bodies — same preset ids/labels, better oscillators for step/grid.
 * Only osc mix / sub / open-filter balance differ; still fully dry.
 */
const DRY_BODY_BY_ID: Record<
  string,
  (v: GenoUltraSynthVoiceParams) => GenoUltraSynthVoiceParams
> = {
  'init-ultra': (v) =>
    dryGateShell(v, {
      osc1: osc('saw', 1),
      osc2: silent('square'),
      osc3: silent(),
      subLevel: 0,
      filterCutoffHz: GENO_ULTRA_FILTER_OPEN_HZ,
      outputLevel: GENO_ULTRA_DEFAULT_OUTPUT_LEVEL,
    }),
  'ultra-warm-lead': (v) =>
    dryGateShell(v, {
      osc1: osc('saw', 0.84),
      osc2: osc('square', 0.36, 0, 0.48),
      osc3: osc('triangle', 0.12),
      subLevel: 0.16,
    }),
  'ultra-hook-lead': (v) =>
    dryGateShell(v, {
      osc1: osc('saw', 0.9),
      osc2: osc('square', 0.28, 0, 0.4),
      osc3: osc('triangle', 0.1, 12),
      subLevel: 0.1,
    }),
  /**
   * Electro ’80s arp bodies (TB-303 / Pro-One / Clear / Odyssey tradition):
   * Osc A = saw or square only, little/no FX, LPF mid-low + resonance,
   * gate amp (step/GATE controls length). CTRL → Cutoff opens the filter.
   */
  'ultra-laser-lead': (v) =>
    dryGateShell(
      v,
      electroArpLeadPatch(
        osc('saw', 0.92),
        osc('saw', 0.48, 12),
        osc('square', 0.12, 0, 0.4),
        0.06,
        4200,
        1.2,
        0.78,
      ),
    ),
  'ultra-wire-lead': (v) =>
    dryGateShell(
      v,
      electroArpLeadPatch(
        /** Clear — bright dry square, present in the mix */
        osc('square', 0.96, 0, 0.45),
        silent('square'),
        silent(),
        0.02,
        6200,
        1.05,
        0.8,
      ),
    ),
  'ultra-porta-lead': (v) =>
    dryGateShell(
      v,
      electroArpLeadPatch(
        osc('saw', 0.96),
        osc('square', 0.1, 0, 0.5),
        silent(),
        0.05,
        2400,
        1.75,
        0.78,
      ),
    ),
  'ultra-bright-hook': (v) =>
    dryGateShell(
      v,
      electroArpLeadPatch(
        osc('saw', 0.94),
        osc('saw', 0.45, 12),
        osc('square', 0.1, 0, 0.35),
        0.05,
        4800,
        1.15,
        0.78,
      ),
    ),
  'ultra-dread-lead': (v) =>
    dryGateShell(
      v,
      electroArpLeadPatch(
        osc('square', 0.86, 0, 0.25),
        osc('saw', 0.38, -5),
        silent('triangle'),
        0.1,
        2000,
        1.85,
        0.76,
      ),
    ),
  'ultra-velvet-lead': (v) =>
    dryGateShell(
      v,
      discoLeadPatch(
        osc('saw', 0.78),
        osc('triangle', 0.48),
        osc('sine', 0.22, 12),
        0.14,
        4200,
        0.7,
      ),
    ),
  'ultra-soft-saw-lead': (v) =>
    dryGateShell(v, {
      osc1: osc('saw', 0.72),
      osc2: osc('triangle', 0.4),
      osc3: silent(),
      subLevel: 0.12,
      filterCutoffHz: 7800,
    }),
  'ultra-analog-memory': (v) =>
    dryGateShell(v, {
      osc1: osc('saw', 0.78),
      osc2: osc('square', 0.4, 0, 0.5),
      osc3: osc('triangle', 0.16, 12),
      subLevel: 0.14,
    }),

  'ultra-moog-bass': (v) =>
    dryGateShell(v, {
      /** Classic Moog bass — saw + pulse, low LPF, moderate res */
      osc1: osc('saw', 0.92),
      osc2: osc('square', 0.28, 0, 0.35),
      osc3: silent('sine'),
      subLevel: 0.5,
      filterCutoffHz: 980,
      filterResonanceQ: 1.25,
      outputLevel: 0.76,
    }),
  /**
   * Twilight 22 — Electric Kingdom + Siberian Nights (Gordon Bahary, ARP Odyssey live).
   * Dual saw (Odyssey grit), octave stack, low LPF, resonance for punch;
   * gate amp so step/GATE control length; CTRL→Cutoff = touch-filter expression.
   * @see https://youtu.be/5VmORkY7390 Electric Kingdom
   * @see https://youtu.be/jiW7NbkhbJ0 Siberian Nights
   * @see https://reverb.com/news/the-synths-and-drum-machines-of-classic-electro
   */
  'ultra-siberian-moog': (v) =>
    dryGateShell(
      v,
      odysseyBassPatch(
        osc('saw', 0.96),
        osc('saw', 0.7, -12),
        osc('square', 0.16, 0, 0.38),
        0.48,
        1100,
        1.55,
        0.84,
      ),
    ),
  'ultra-kingdom-bass': (v) =>
    dryGateShell(
      v,
      odysseyBassPatch(
        osc('saw', 0.97),
        osc('saw', 0.74, -12),
        osc('square', 0.18, 0, 0.36),
        0.45,
        1000,
        1.5,
        0.84,
      ),
    ),
  'ultra-boogie-bass': (v) =>
    dryGateShell(
      v,
      odysseyBassPatch(
        osc('saw', 0.94),
        osc('saw', 0.68, 12),
        osc('square', 0.16, 0, 0.4),
        0.4,
        1200,
        1.4,
        0.82,
      ),
    ),
  'ultra-sub-808': (v) =>
    dryGateShell(v, {
      osc1: osc('sine', 0.95),
      osc2: silent('sine'),
      osc3: silent('sine'),
      subLevel: 0.78,
      filterCutoffHz: 400,
      filterResonanceQ: 0.3,
      outputLevel: 0.8,
    }),
  'ultra-dub-sub': (v) =>
    dryGateShell(
      v,
      odysseyBassPatch(
        osc('saw', 0.5),
        osc('sine', 0.88),
        silent(),
        0.94,
        240,
        0.55,
        0.84,
      ),
    ),
  'ultra-reese-wide': (v) =>
    dryGateShell(v, {
      osc1: osc('saw', 0.78),
      osc2: osc('saw', 0.72, 0),
      osc3: osc('square', 0.2, -12),
      subLevel: 0.35,
      filterCutoffHz: 1200,
      outputLevel: 0.7,
    }),
  'ultra-deep-roller': (v) =>
    dryGateShell(v, {
      osc1: osc('saw', 0.82),
      osc2: osc('square', 0.25, -12),
      osc3: silent(),
      subLevel: 0.5,
      filterCutoffHz: 900,
      outputLevel: 0.72,
    }),
  'ultra-rubber-funk': (v) =>
    dryGateShell(
      v,
      funkBassPatch(
        osc('square', 0.88, 0, 0.28),
        osc('saw', 0.35),
        silent(),
        0.42,
        1100,
        1.35,
        0.76,
      ),
    ),
  'ultra-growl-808': (v) =>
    dryGateShell(v, {
      osc1: osc('saw', 0.7),
      osc2: osc('sine', 0.55),
      osc3: silent(),
      subLevel: 0.7,
      filterCutoffHz: 600,
      outputLevel: 0.76,
    }),
  'ultra-pluck-bass': (v) =>
    dryGateShell(v, {
      osc1: osc('triangle', 0.75),
      osc2: osc('saw', 0.35),
      osc3: silent(),
      subLevel: 0.45,
      filterCutoffHz: 2200,
      outputLevel: 0.7,
    }),

  'ultra-digi-pluck': (v) =>
    dryGateShell(
      v,
      electroArpLeadPatch(
        osc('square', 0.88, 0, 0.4),
        osc('triangle', 0.28, 12),
        silent(),
        0.02,
        5800,
        1.15,
        0.8,
      ),
    ),
  'ultra-crystal-pluck': (v) =>
    dryGateShell(
      v,
      electroArpLeadPatch(
        osc('square', 0.82, 0, 0.45),
        osc('sine', 0.28, 12),
        osc('sine', 0.1, 19),
        0.02,
        6400,
        1.1,
        0.78,
      ),
    ),
  'ultra-guitar-pluck': (v) =>
    dryGateShell(
      v,
      funkWahPatch(
        osc('triangle', 0.82),
        osc('saw', 0.32),
        silent(),
        0.08,
        2400,
        1.65,
        0.72,
      ),
    ),
  'ultra-wah-guitar': (v) =>
    dryGateShell(
      v,
      funkWahPatch(
        osc('saw', 0.8),
        osc('triangle', 0.4),
        osc('sine', 0.12, 12),
        0.1,
        1800,
        2.2,
        0.72,
      ),
    ),
  'ultra-wah-funk': (v) =>
    dryGateShell(
      v,
      funkWahPatch(
        osc('square', 0.78, 0, 0.35),
        osc('saw', 0.38),
        silent(),
        0.12,
        1400,
        2.4,
        0.7,
      ),
    ),
  'ultra-wah-cry': (v) =>
    dryGateShell(
      v,
      funkWahPatch(
        osc('saw', 0.85),
        osc('square', 0.3, 0, 0.25),
        silent(),
        0.08,
        2000,
        2.55,
        0.72,
      ),
    ),
  'ultra-pluck-glass': (v) =>
    dryGateShell(
      v,
      melodyKeysPluckPatch(
        osc('triangle', 0.72),
        osc('sine', 0.35, 12),
        silent(),
        0.05,
        820,
      ),
    ),
  'ultra-michael-pluck': (v) =>
    dryGateShell(
      v,
      horrorPluckPatch(
        osc('triangle', 0.72),
        osc('saw', 0.24, -5),
        osc('sine', 0.12, 6),
        0.22,
        780,
      ),
    ),
  'ultra-camp-pluck': (v) =>
    dryGateShell(
      v,
      horrorPluckPatch(
        osc('saw', 0.62),
        osc('square', 0.18, -7, 0.1),
        silent(),
        0.28,
        680,
      ),
    ),
  'ultra-creep-pluck': (v) =>
    dryGateShell(
      v,
      horrorPluckPatch(
        osc('triangle', 0.68),
        osc('triangle', 0.32, -5),
        osc('sine', 0.1, 1),
        0.24,
        620,
      ),
    ),
  'ultra-stab-pluck': (v) =>
    dryGateShell(
      v,
      horrorPluckPatch(
        osc('square', 0.58, 0, 0.08),
        osc('saw', 0.34, -8),
        osc('sine', 0.14, 7),
        0.2,
        920,
      ),
    ),
  'ultra-marimba-pluck': (v) =>
    dryGateShell(
      v,
      melodyKeysPluckPatch(
        osc('sine', 0.82),
        osc('triangle', 0.34, 12),
        silent(),
        0.06,
        820,
      ),
    ),
  'ultra-harp-spark': (v) =>
    dryGateShell(
      v,
      melodyKeysPluckPatch(
        osc('sine', 0.74),
        osc('sine', 0.42, 12),
        osc('sine', 0.22, 19),
        0.04,
        950,
      ),
    ),
  'ultra-lounge-organ': (v) =>
    dryGateShell(
      v,
      melodyKeysPluckPatch(
        osc('square', 0.42, 0, 0.32),
        osc('sine', 0.58),
        osc('sine', 0.22, 12),
        0.14,
        760,
        0.62,
      ),
    ),
  'ultra-ballad-keys': (v) =>
    dryGateShell(
      v,
      melodyKeysPluckPatch(
        osc('sine', 0.76),
        osc('triangle', 0.38),
        osc('sine', 0.22, 12),
        0.1,
        840,
        0.64,
      ),
    ),
  'ultra-bell-spark': (v) =>
    dryGateShell(v, {
      osc1: osc('sine', 0.8),
      osc2: osc('triangle', 0.35, 12),
      osc3: osc('sine', 0.28, 24),
      subLevel: 0.02,
    }),

  'ultra-horror-keys': (v) =>
    dryGateShell(
      v,
      electroArpLeadPatch(
        osc('saw', 0.92),
        osc('square', 0.32, 0, 0.4),
        silent('sine'),
        0.08,
        1800,
        1.75,
        0.8,
      ),
    ),
  'ultra-haunt-keys': (v) =>
    dryGateShell(
      v,
      electroArpLeadPatch(
        osc('square', 0.88, 0, 0.32),
        osc('saw', 0.32, -5),
        silent(),
        0.1,
        2200,
        1.55,
        0.78,
      ),
    ),
  'ultra-shock-keys': (v) =>
    dryGateShell(
      v,
      electroArpLeadPatch(
        osc('triangle', 0.78),
        osc('saw', 0.36, -7),
        silent(),
        0.08,
        2600,
        1.4,
        0.78,
      ),
    ),
  'ultra-rhodes-keys': (v) =>
    dryGateShell(
      v,
      melodyKeysPluckPatch(
        osc('sine', 0.78),
        osc('triangle', 0.42),
        osc('sine', 0.24, 12),
        0.1,
        880,
        0.66,
      ),
    ),
  'ultra-stage-keys': (v) =>
    dryGateShell(
      v,
      funkKeysPatch(
        osc('sine', 0.74),
        osc('triangle', 0.45),
        osc('saw', 0.14),
        0.12,
        6800,
        0.68,
      ),
    ),

  'ultra-acid-line': (v) =>
    dryGateShell(
      v,
      electroArpLeadPatch(
        osc('saw', 0.98),
        silent('square'),
        silent('sine'),
        0.03,
        1400,
        2.1,
        0.8,
      ),
    ),
  'ultra-evil-arp': (v) =>
    dryGateShell(
      v,
      electroArpLeadPatch(
        osc('saw', 0.94),
        osc('square', 0.18, -5, 0.42),
        silent(),
        0.06,
        1600,
        1.9,
        0.8,
      ),
    ),
  'ultra-phantom-stab': (v) =>
    dryGateShell(
      v,
      electroArpLeadPatch(
        osc('square', 0.92, 0, 0.22),
        osc('saw', 0.22, -5),
        silent('triangle'),
        0.08,
        2000,
        1.7,
        0.8,
      ),
    ),

  'ultra-silk-pad': (v) =>
    dryGateShell(v, {
      osc1: osc('saw', 0.58),
      osc2: osc('triangle', 0.5),
      osc3: osc('sine', 0.28, 12),
      subLevel: 0.16,
      filterCutoffHz: 6500,
      outputLevel: 0.55,
    }),
  'ultra-air-pad': (v) =>
    dryGateShell(v, {
      osc1: osc('triangle', 0.55),
      osc2: osc('saw', 0.4),
      osc3: osc('sine', 0.3, 12),
      subLevel: 0.12,
      filterCutoffHz: 7800,
      outputLevel: 0.52,
    }),
  'ultra-dark-cine': (v) =>
    dryGateShell(v, {
      osc1: osc('saw', 0.5),
      osc2: osc('triangle', 0.45, -5),
      osc3: osc('sine', 0.35, 7),
      subLevel: 0.28,
      filterCutoffHz: 4200,
      outputLevel: 0.58,
    }),

  /**
   * Dance / euro / trance melodies — bright supersaw-style leads + risers.
   */
  'ultra-dream-lead': (v) =>
    dryGateShell(
      v,
      danceLeadPatch(
        osc('saw', 0.72),
        osc('saw', 0.55, 0),
        osc('triangle', 0.28, 12),
        0.1,
        3600,
        1.05,
        0.68,
      ),
    ),
  'ultra-neon-lead': (v) =>
    dryGateShell(
      v,
      danceLeadPatch(
        osc('saw', 0.88),
        osc('square', 0.32, 0, 0.4),
        osc('saw', 0.2, 12),
        0.08,
        3200,
        1.25,
        0.72,
      ),
    ),
  'ultra-chorus-lead': (v) =>
    dryGateShell(
      v,
      danceLeadPatch(
        osc('saw', 0.8),
        osc('triangle', 0.45),
        osc('saw', 0.25, 7),
        0.1,
        3400,
        1.1,
        0.7,
      ),
    ),
  'ultra-supersaw-hook': (v) =>
    dryGateShell(
      v,
      danceLeadPatch(
        osc('saw', 0.9),
        osc('saw', 0.72, 0),
        osc('saw', 0.4, 12),
        0.06,
        4000,
        1.15,
        0.72,
      ),
    ),
  'ultra-grand-rise': (v) =>
    dryGateShell(
      v,
      danceRisePatch(
        osc('saw', 0.7),
        osc('saw', 0.55, 7),
        osc('saw', 0.4, 12),
        0.12,
        0.65,
      ),
    ),
  'ultra-cinema-rise': (v) =>
    dryGateShell(
      v,
      danceRisePatch(
        osc('saw', 0.65),
        osc('triangle', 0.5),
        osc('saw', 0.35, 12),
        0.15,
        0.62,
      ),
    ),
  'ultra-warehouse': (v) =>
    dryGateShell(
      v,
      funkBassPatch(
        osc('saw', 0.86),
        osc('square', 0.3, -12, 0.4),
        silent(),
        0.48,
        900,
        1.4,
        0.76,
      ),
    ),
  'ultra-slap-house': (v) =>
    dryGateShell(
      v,
      funkBassPatch(
        osc('square', 0.85, 0, 0.32),
        osc('saw', 0.32),
        silent(),
        0.4,
        1300,
        1.3,
        0.74,
      ),
    ),
  'ultra-shimmer-pad': (v) =>
    dryGateShell(
      v,
      discoLeadPatch(
        osc('saw', 0.55),
        osc('triangle', 0.5),
        osc('sine', 0.35, 12),
        0.12,
        5500,
        0.58,
      ),
    ),
};

/**
 * Apply a musical dry body — keeps id + label, rebuilds oscillators, strips FX.
 */
export function genoUltraApplyDrySoundBody(
  voice: GenoUltraSynthVoiceParams,
): GenoUltraSynthVoiceParams {
  const byId = DRY_BODY_BY_ID[voice.id];
  if (byId) return byId(voice);
  return dryBodyForCategory(voice);
}

/** Open LPF, flat env, no drive — engines must not auto-sweep cutoff. */
export function genoUltraVoiceFilterIsRaw(voice: GenoUltraSynthVoiceParams): boolean {
  return (
    voice.filterMode === 'lowpass' &&
    voice.filterCutoffHz >= GENO_ULTRA_FILTER_OPEN_HZ - 1 &&
    voice.filterResonanceQ <= 0.15 &&
    voice.filterDrive <= 0.04 &&
    voice.filterKeyTrack <= 0.001 &&
    voice.filterAttackMs <= 0 &&
    voice.filterDecayMs <= 0 &&
    voice.filterSustain >= 0.999
  );
}

/** True when the voice has no FX rack / LFO / unison (filter-env punch is allowed). */
export function genoUltraVoiceIsFullyDry(voice: GenoUltraSynthVoiceParams): boolean {
  return (
    voice.filterDrive <= 0.28 &&
    voice.noiseLevel <= 0.001 &&
    voice.unisonVoices <= 1 &&
    voice.unisonDetuneCents === 0 &&
    voice.lfo1Depth <= 0.001 &&
    voice.lfo2Depth <= 0.001 &&
    voice.fx.chorusMix <= 0.02 &&
    voice.fx.delayMix <= 0.02 &&
    voice.fx.reverbMix <= 0.02 &&
    voice.fx.delayEnabled === false &&
    voice.fx.eqEnabled === false &&
    voice.modSlots.every((s) => s.source === 'off' || Math.abs(s.amount) < 0.01)
  );
}

/**
 * Fully dry baseline — Retrologue-style osc bodies, gate amp, no FX.
 * Preserves id + label.
 */
export function genoUltraStripVoiceFx(voice: GenoUltraSynthVoiceParams): GenoUltraSynthVoiceParams {
  return genoUltraApplyDrySoundBody(voice);
}

/**
 * ARP preview: keep the user’s osc / filter / amp exactly as set.
 * Only forces mono (no unison stack) for the step player.
 */
export function applyGenoUltraArpDryVoice(voice: GenoUltraSynthVoiceParams): GenoUltraSynthVoiceParams {
  return {
    ...voice,
    unisonVoices: 1,
    unisonDetuneCents: 0,
    osc1: { ...voice.osc1 },
    osc2: { ...voice.osc2 },
    osc3: { ...voice.osc3 },
    modSlots: voice.modSlots.map((s) => ({ ...s })),
    fx: { ...voice.fx },
  };
}
