/**
 * Pattern Bank dice — invent a fresh same-style drum grid (not a catalog preset pick).
 * Keeps solid kick-on-1 + snare-on-2&4 habits; hats/perc vary by bank.
 */

import {
  BEAT_LAB_USER_SAVES_BANK_ID,
  type BeatLabPatternBankId,
} from '@/app/lib/creationStation/beatLabPatternBank';
import {
  BEAT_PADS_LANE_COUNT,
  emptyBeatPadsPattern,
  type BeatPadsDrumPattern,
  type BeatPadsGridStepsPerBar,
} from '@/app/lib/creationStation/beatLabDrumMachineSequencer';
import { beatPadsLaneFromBooleanTemplate } from '@/app/lib/creationStation/beatPadsPatternEdit';
import {
  beatPadsPlacementHasAdjacentHits,
  isSolidBeatPadsKickPlacement,
} from '@/app/lib/creationStation/beatPadsLanePlacementTemplates';

type StyleId =
  | 'upTempo'
  | 'trap'
  | 'rnb'
  | 'house'
  | 'dance'
  | 'disco'
  | 'techno'
  | 'afro'
  | 'reggae'
  | 'generic';

type StyleRecipe = {
  /** Extra kick slots (never 4 / 12 — those stay open for snare), except house four-on-floor. */
  kickExtras: readonly number[];
  kickExtraChance: number;
  /** Seed kick phrases — always include step 0; dice mutates from these. */
  kickSeeds: readonly (readonly number[])[];
  /** Four-on-floor house/disco kick (0,4,8,12). */
  fourOnFloor?: boolean;
  hatPools: readonly (readonly number[])[];
  openHatPools: readonly (readonly number[])[];
  rimPools: readonly (readonly number[])[];
  clapChance: number;
  openHatChance: number;
  rimChance: number;
};

const SNARE_STEPS = [4, 12] as const;

function bankToStyle(bankId: BeatLabPatternBankId): StyleId {
  switch (bankId) {
    case 'miami':
      return 'upTempo';
    case 'trap':
    case 'platinum-trap':
      return 'trap';
    case 'rnb':
    case 'platinum-urban':
      return 'rnb';
    case 'house':
      return 'house';
    case 'dance':
      return 'dance';
    case 'disco':
      return 'disco';
    case 'techno':
      return 'techno';
    case 'afro':
      return 'afro';
    case 'reggae':
      return 'reggae';
    default:
      return 'generic';
  }
}

const RECIPES: Readonly<Record<StyleId, StyleRecipe>> = {
  upTempo: {
    kickSeeds: [
      [0, 6, 9, 14],
      [0, 3, 6, 10, 14],
      [0, 3, 7, 10],
      [0, 5, 8, 11],
      [0, 3, 7, 10, 14],
      [0, 6, 10, 14],
      [0, 7, 10],
      [0, 3, 8, 11, 14],
    ],
    kickExtras: [3, 5, 6, 7, 8, 9, 10, 11, 14],
    kickExtraChance: 0.35,
    hatPools: [
      [0, 2, 6, 8, 10, 14],
      [0, 2, 8, 10],
      [0, 2, 4, 6, 9, 10, 12, 14],
      [0, 2, 4, 6, 8, 10, 12, 14],
      [2, 6, 10, 14],
    ],
    openHatPools: [[6], [14], [10], [2, 14]],
    rimPools: [[10], [6], [14], [3], [11]],
    clapChance: 0.35,
    openHatChance: 0.4,
    rimChance: 0.45,
  },
  trap: {
    kickSeeds: [
      [0, 10, 14],
      [0, 6, 10, 14],
      [0, 3, 7, 10, 14],
      [0, 7, 10, 14],
      [0, 8],
      [0, 8, 14],
      [0, 6, 10],
      [0, 3, 10, 14],
    ],
    kickExtras: [3, 6, 7, 8, 10, 14],
    kickExtraChance: 0.3,
    hatPools: [
      [0, 2, 4, 6, 8, 10, 12, 14],
      [0, 2, 6, 8, 10, 14],
      [0, 2, 4, 6, 8, 10, 12, 13, 14, 15],
      [0, 2, 4, 6, 8, 10, 11, 12, 13, 14, 15],
    ],
    openHatPools: [[14], [6, 14], [2, 10, 14], [10]],
    rimPools: [[7], [15], [3, 11], [1, 9]],
    clapChance: 0.55,
    openHatChance: 0.55,
    rimChance: 0.35,
  },
  rnb: {
    kickSeeds: [
      [0, 6, 10, 14],
      [0, 8, 11],
      [0, 7, 11, 14],
      [0, 10, 14],
      [0, 8],
      [0, 5, 10],
      [0, 8, 14],
      [0, 7, 8],
    ],
    kickExtras: [5, 6, 7, 8, 10, 11, 14],
    kickExtraChance: 0.28,
    hatPools: [
      [0, 2, 4, 6, 8, 10, 12, 14],
      [0, 2, 6, 8, 10, 14],
      [2, 6, 10, 14],
      [0, 4, 8, 12],
    ],
    openHatPools: [[6], [14], [10], [2]],
    rimPools: [[7], [15], [11]],
    clapChance: 0.4,
    openHatChance: 0.45,
    rimChance: 0.25,
  },
  house: {
    kickSeeds: [[0, 4, 8, 12]],
    kickExtras: [],
    kickExtraChance: 0,
    fourOnFloor: true,
    hatPools: [
      [0, 2, 4, 6, 8, 10, 12, 14],
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      [2, 6, 10, 14],
    ],
    openHatPools: [[14], [6, 14], [2, 10]],
    rimPools: [[4], [12], [8]],
    clapChance: 0.7,
    openHatChance: 0.5,
    rimChance: 0.2,
  },
  dance: {
    kickSeeds: [
      [0, 4, 8, 12],
      [0, 8, 12],
      [0, 6, 8, 14],
      [0, 4, 8, 10, 12],
    ],
    kickExtras: [4, 6, 8, 10, 12, 14],
    kickExtraChance: 0.25,
    fourOnFloor: true,
    hatPools: [
      [0, 2, 4, 6, 8, 10, 12, 14],
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      [0, 2, 6, 8, 10, 14],
    ],
    openHatPools: [[14], [6], [10, 14]],
    rimPools: [[4], [12]],
    clapChance: 0.65,
    openHatChance: 0.4,
    rimChance: 0.2,
  },
  disco: {
    kickSeeds: [
      [0, 4, 8, 12],
      [0, 8],
      [0, 4, 8, 12, 14],
    ],
    kickExtras: [4, 8, 12, 14],
    kickExtraChance: 0.2,
    fourOnFloor: true,
    hatPools: [
      [0, 2, 4, 6, 8, 10, 12, 14],
      [2, 6, 10, 14],
      [0, 4, 8, 12],
    ],
    openHatPools: [[14], [6, 14]],
    rimPools: [[4], [12]],
    clapChance: 0.75,
    openHatChance: 0.45,
    rimChance: 0.15,
  },
  techno: {
    kickSeeds: [
      [0, 4, 8, 12],
      [0, 8],
      [0, 4, 8, 12],
    ],
    kickExtras: [],
    kickExtraChance: 0,
    fourOnFloor: true,
    hatPools: [
      [0, 2, 4, 6, 8, 10, 12, 14],
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      [2, 6, 10, 14],
    ],
    openHatPools: [[14], [6], [2, 10, 14]],
    rimPools: [[8], [4], [12]],
    clapChance: 0.25,
    openHatChance: 0.35,
    rimChance: 0.3,
  },
  afro: {
    kickSeeds: [
      [0, 6, 10],
      [0, 3, 8, 11],
      [0, 7, 10, 14],
      [0, 6, 8, 14],
      [0, 3, 7, 12],
    ],
    kickExtras: [3, 6, 7, 8, 10, 11, 14],
    kickExtraChance: 0.35,
    hatPools: [
      [0, 2, 4, 6, 8, 10, 12, 14],
      [0, 3, 6, 8, 11, 14],
      [2, 4, 6, 10, 12, 14],
    ],
    openHatPools: [[6], [14], [3, 11]],
    rimPools: [[1, 5, 9, 13], [3, 7, 11, 15], [5, 13]],
    clapChance: 0.45,
    openHatChance: 0.4,
    rimChance: 0.55,
  },
  reggae: {
    kickSeeds: [
      [0, 6, 10],
      [0, 10],
      [0, 6],
      [0, 8, 14],
      [0, 6, 14],
    ],
    kickExtras: [6, 8, 10, 14],
    kickExtraChance: 0.25,
    hatPools: [
      [0, 2, 4, 6, 8, 10, 12, 14],
      [2, 6, 10, 14],
      [0, 4, 8, 12],
    ],
    openHatPools: [[6], [14], [2, 10]],
    rimPools: [[1, 5, 9, 13], [3, 11], [7, 15]],
    clapChance: 0.5,
    openHatChance: 0.35,
    rimChance: 0.4,
  },
  generic: {
    kickSeeds: [
      [0, 8],
      [0, 6, 10, 14],
      [0, 8, 14],
      [0, 4, 8, 12],
    ],
    kickExtras: [3, 6, 7, 8, 10, 14],
    kickExtraChance: 0.3,
    hatPools: [
      [0, 2, 4, 6, 8, 10, 12, 14],
      [0, 2, 6, 8, 10, 14],
    ],
    openHatPools: [[14], [6]],
    rimPools: [[7], [15]],
    clapChance: 0.4,
    openHatChance: 0.35,
    rimChance: 0.25,
  },
};

function rand(): number {
  return Math.random();
}

function pickOne<T>(list: readonly T[]): T {
  return list[Math.floor(rand() * list.length)]!;
}

function mutateKick(seed: readonly number[], recipe: StyleRecipe): number[] {
  if (recipe.fourOnFloor && seed.length >= 4 && seed.includes(0) && seed.includes(4)) {
    return [...seed].sort((a, b) => a - b);
  }
  const set = new Set<number>(seed.includes(0) ? seed : [0, ...seed]);
  // Clear snare steps for non-four-on-floor styles so snare stays clean.
  if (!recipe.fourOnFloor) {
    set.delete(4);
    set.delete(12);
  }
  for (const step of recipe.kickExtras) {
    if (recipe.fourOnFloor || (step !== 4 && step !== 12)) {
      if (rand() < recipe.kickExtraChance) set.add(step);
    }
  }
  // Drop a non-downbeat hit sometimes for variety.
  const droppable = [...set].filter((s) => s !== 0);
  if (droppable.length > 1 && rand() < 0.35) {
    set.delete(pickOne(droppable));
  }
  let out = [...set].sort((a, b) => a - b);
  // Repair adjacent rolls (except intentional four-on-floor).
  if (!recipe.fourOnFloor) {
    while (beatPadsPlacementHasAdjacentHits(out) && out.length > 2) {
      const adj = out.find((s, i) => i > 0 && s - out[i - 1]! === 1 && s !== 0);
      if (adj == null) break;
      out = out.filter((s) => s !== adj);
    }
  }
  if (!isSolidBeatPadsKickPlacement(out) && !recipe.fourOnFloor) {
    const extras = recipe.kickExtras.filter((s) => s !== 4 && s !== 12);
    const second = extras.length > 0 ? pickOne(extras) : 8;
    out = [0, second].sort((a, b) => a - b);
  }
  if (recipe.fourOnFloor) {
    return [0, 4, 8, 12];
  }
  if (!out.includes(0)) out = [0, ...out].sort((a, b) => a - b);
  if (out.length < 2) out = [0, 8];
  return out;
}

function maybeFlipHats(steps: readonly number[]): number[] {
  const set = new Set(steps);
  for (let s = 0; s < 16; s++) {
    if (s === 4 || s === 12) continue; // keep snare pocket clearer
    if (rand() < 0.12) {
      if (set.has(s)) set.delete(s);
      else set.add(s);
    }
  }
  if (set.size < 2) return [...steps];
  return [...set].sort((a, b) => a - b);
}

/** True when Pattern Bank dice can invent a groove for this bank. */
export function canGenerateBeatPadsBankStylePattern(bankId: BeatLabPatternBankId | null | undefined): boolean {
  return Boolean(bankId && bankId !== BEAT_LAB_USER_SAVES_BANK_ID);
}

/**
 * Invent a fresh drum grid in the bank’s style (Up Tempo / Trap / R&B / …).
 * Does not pull a catalog preset — composes kick/snare/hats from style atoms.
 */
export function generateBeatPadsBankStylePattern(
  bankId: BeatLabPatternBankId,
  loopBars: number,
  stepsPerBar: BeatPadsGridStepsPerBar = 16,
): BeatPadsDrumPattern {
  const style = bankToStyle(bankId);
  const recipe = RECIPES[style];
  const kick = mutateKick(pickOne(recipe.kickSeeds), recipe);
  const snare = [...SNARE_STEPS];
  const hats = maybeFlipHats(pickOne(recipe.hatPools));
  const clap = rand() < recipe.clapChance ? [...SNARE_STEPS] : [];
  const openHat =
    rand() < recipe.openHatChance ? [...pickOne(recipe.openHatPools)] : [];
  const rim = rand() < recipe.rimChance ? [...pickOne(recipe.rimPools)] : [];

  const lanes: (readonly number[])[] = Array.from({ length: BEAT_PADS_LANE_COUNT }, () => []);
  lanes[0] = kick;
  lanes[1] = snare;
  lanes[2] = clap;
  lanes[3] = hats;
  lanes[4] = openHat;
  lanes[7] = rim;

  const totalCols = Math.max(1, loopBars * stepsPerBar);
  const out = emptyBeatPadsPattern(loopBars);
  for (let lane = 0; lane < BEAT_PADS_LANE_COUNT; lane++) {
    const steps = lanes[lane] ?? [];
    out[lane] = steps.length
      ? beatPadsLaneFromBooleanTemplate(totalCols, steps, stepsPerBar)
      : [];
  }
  return out;
}
