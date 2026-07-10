/**
 * Piano Roll drum bank — 50 trap + modern R&B presets, each paired 1:1 with a
 * 16-pad producer kit. Fictional crew names only (no artist affiliation).
 */

import type { PatternPreset } from '@/app/lib/patternPresets';
import type { BeatLabProducerKitId } from '@/app/lib/creationStation/beatLabProducerKits';
import { BEAT_LAB_STREET_TRAP_PATTERNS, BEAT_LAB_STREET_TRAP_KIT_MAP } from '@/app/lib/creationStation/beatLabStreetTrapPatterns';
import { BEAT_LAB_MODERN_RNB_PATTERNS, BEAT_LAB_MODERN_RNB_KIT_MAP } from '@/app/lib/creationStation/beatLabModernRnbPatterns';
import { BEAT_LAB_SIGNATURE_TRAP_PATTERNS, BEAT_LAB_SIGNATURE_TRAP_KIT_MAP } from '@/app/lib/creationStation/beatLabSignatureTrapPatterns';
import { beatLabTrapTransportBpmFromProducer } from '@/app/lib/creationStation/beatLabTrapTempo';
import {
  trap808FollowKick,
  trap808OneThree,
  trapBackbeatStack,
  trapCoreClubBounce,
  trapCoreDirtySouthClub,
  trapCoreFinisher,
  trapCoreMetro,
  trapHatsEightThenRoll,
  trapHatsRollEnd,
  trapHatsSteadyThenRoll,
  trapHatsTripletFill,
  trapHatsTwoStep,
  trapKickBarRush,
  trapKickLean,
  trapKickMinimal,
  trapKickSlide,
  trapKickSparse,
  trapKickSyncopated,
  trapOh24,
  trapOhGroove,
  trapRimOff,
  trapSnare24,
  trapSnareBarPush,
  trapSnareHalfTime,
} from '@/app/lib/creationStation/beatLabTrapPatternGrid';

export type PianoRollDrumCategory = 'Trap' | 'R&B';

export type PianoRollDrumPreset = {
  id: string;
  name: string;
  category: PianoRollDrumCategory;
  /** Authoring / label BPM from the pattern preset. */
  producerBpm: number;
  kitId: BeatLabProducerKitId;
  /** 8-row × 16-step grid — rows map to pads 0–7 of the 16-pad kit. */
  pattern: boolean[][];
  desc?: string;
};

const R = 8;
const S = 16;

function grid(hits: ReadonlyArray<[number, number]>): boolean[][] {
  const g: boolean[][] = Array.from({ length: R }, () => new Array<boolean>(S).fill(false));
  for (const [row, step] of hits) {
    if (row >= 0 && row < R && step >= 0 && step < S) g[row]![step] = true;
  }
  return g;
}

function hats8(): ReadonlyArray<[number, number]> {
  return [0, 2, 4, 6, 8, 10, 12, 14].map((s) => [3, s] as [number, number]);
}

function fromPatternPreset(
  preset: PatternPreset,
  kitId: BeatLabProducerKitId,
  category: PianoRollDrumCategory,
): PianoRollDrumPreset {
  return {
    id: preset.id,
    name: preset.name,
    category,
    producerBpm: preset.bpm,
    kitId,
    pattern: preset.pattern.map((row) => [...row]),
    desc: preset.desc,
  };
}

function resolveKit(
  presetId: string,
  maps: ReadonlyArray<Partial<Record<string, BeatLabProducerKitId>>>,
  fallback: BeatLabProducerKitId,
): BeatLabProducerKitId {
  for (const map of maps) {
    const id = map[presetId];
    if (id) return id;
  }
  return fallback;
}

/** Piano Roll–exclusive presets (14) — original grids on flagship kits. */
const PIANO_ROLL_EXCLUSIVE: readonly PianoRollDrumPreset[] = [
  {
    id: 'pr-trap-mirror-bounce',
    name: 'Mirror · Memphis Bounce',
    category: 'Trap',
    producerBpm: 142,
    kitId: 'trapSlabAtl',
    desc: 'ATL slab bounce — sync kick, stacked snare/clap, triplet hat fill into bar 4',
    pattern: grid([
      ...trapKickSyncopated(),
      ...trapBackbeatStack(),
      ...trapHatsTwoStep(),
      ...trapHatsTripletFill(),
      ...trapOh24(),
      ...trap808FollowKick(trapKickSyncopated()),
    ]),
  },
  {
    id: 'pr-trap-vault-rush',
    name: 'Vault · Bar Rush',
    category: 'Trap',
    producerBpm: 138,
    kitId: 'trapDarkVault',
    desc: 'Dark vault pressure — lean kick, bar-end snare push, steady hats → roll',
    pattern: grid([
      ...trapKickLean(),
      ...trapSnare24(),
      ...trapSnareBarPush(),
      [2, 4], [2, 12],
      ...trapHatsSteadyThenRoll(),
      [4, 6], [4, 14],
      ...trap808OneThree(),
    ]),
  },
  {
    id: 'pr-trap-drill-chop',
    name: 'Drill · Chop Pocket',
    category: 'Trap',
    producerBpm: 144,
    kitId: 'trapSlabAtl',
    desc: 'Drill-adjacent chop — sparse kick, half-time snare, rim off-beats',
    pattern: grid([
      ...trapKickSparse(),
      ...trapSnareHalfTime(),
      [2, 8],
      ...trapHatsEightThenRoll(),
      ...trapRimOff(),
      ...trap808FollowKick(trapKickSparse()),
    ]),
  },
  {
    id: 'pr-trap-miami-wobble',
    name: 'Miami · Wobble Floor',
    category: 'Trap',
    producerBpm: 76,
    kitId: 'miamiBass808',
    desc: 'Miami bass stomp — trunk kick 1 & 3, clap stack, rolling hats',
    pattern: grid([
      [0, 0], [0, 8], [0, 10],
      ...trapSnare24(),
      ...trapBackbeatStack(),
      ...trapHatsTwoStep(),
      ...trapHatsRollEnd(),
      [4, 2], [4, 10],
      [6, 0], [6, 8],
    ]),
  },
  {
    id: 'pr-trap-bell-slide',
    name: 'Bell · Iron Slide',
    category: 'Trap',
    producerBpm: 140,
    kitId: 'bell808',
    desc: 'Bell 808 glide — slide kick, finisher hat burst, OH groove',
    pattern: grid([
      ...trapKickSlide(),
      ...trapBackbeatStack(),
      ...trapHatsTwoStep(),
      ...trapCoreFinisher(),
      ...trapOhGroove(),
      ...trap808FollowKick(trapKickSlide()),
    ]),
  },
  {
    id: 'pr-trap-mud-chamber',
    name: 'Mud · Chamber Stomp',
    category: 'Trap',
    producerBpm: 72,
    kitId: 'mudFloor',
    desc: 'Low mud floor — minimal kick, heavy snare 2 & 4, sparse rim',
    pattern: grid([
      ...trapKickMinimal(),
      ...trapSnare24(),
      [2, 4], [2, 12],
      ...trapHatsTwoStep(),
      [7, 3], [7, 7], [7, 11],
      [6, 0], [6, 8],
    ]),
  },
  {
    id: 'pr-trap-trunk-rattle',
    name: 'Trunk · Rattle Stack',
    category: 'Trap',
    producerBpm: 136,
    kitId: 'trunkRattle',
    desc: 'Trunk rattle — bar rush kick, metro snare, club bounce hats',
    pattern: grid([
      ...trapKickBarRush(),
      ...trapCoreMetro(),
      ...trapCoreClubBounce(),
      [4, 14],
      ...trap808FollowKick(trapKickBarRush()),
    ]),
  },
  {
    id: 'pr-trap-south-dirty',
    name: 'South · Dirty Club',
    category: 'Trap',
    producerBpm: 74,
    kitId: 'trapClapStack',
    desc: 'Dirty south club — half-time trunk, clap stack, southside hats',
    pattern: grid([
      ...trapCoreDirtySouthClub(),
      ...trapHatsSteadyThenRoll(),
      ...trap808OneThree(),
    ]),
  },
  {
    id: 'pr-rnb-champagne',
    name: 'Champagne · Silk Room',
    category: 'R&B',
    producerBpm: 92,
    kitId: 'smoothRnb',
    desc: 'Silk backbeat — dry kick behind the grid, snare 2 & 4, shaker air',
    pattern: grid([
      [0, 0], [0, 9], [0, 11],
      [1, 4], [1, 12], [1, 13],
      [2, 12],
      ...hats8(),
      [7, 0], [7, 4], [7, 8], [7, 12],
    ]),
  },
  {
    id: 'pr-rnb-neo-midnight',
    name: 'Neo · Midnight Stack',
    category: 'R&B',
    producerBpm: 86,
    kitId: 'rnbNeoStack',
    desc: 'Neo soul stack — kick pocket, layered clap on snare, brushed hats',
    pattern: grid([
      [0, 0], [0, 6], [0, 10],
      [1, 4], [1, 12],
      [2, 4], [2, 12], [2, 13],
      [3, 2], [3, 6], [3, 10], [3, 13], [3, 14], [3, 15],
      [4, 14],
      [7, 3], [7, 11],
    ]),
  },
  {
    id: 'pr-rnb-club-pocket',
    name: 'Club · Pocket Drive',
    category: 'R&B',
    producerBpm: 98,
    kitId: 'clubPocket',
    desc: 'Club R&B drive — four-on kick lean, snare/clap stack, open lift',
    pattern: grid([
      [0, 0], [0, 4], [0, 8], [0, 10], [0, 14],
      [1, 4], [1, 12],
      [2, 4], [2, 12], [2, 11],
      [3, 0], [3, 2], [3, 4], [3, 6], [3, 8], [3, 10], [3, 12], [3, 14],
      [4, 6], [4, 14],
    ]),
  },
  {
    id: 'pr-rnb-velvet-bloom',
    name: 'Velvet · Bloom Glide',
    category: 'R&B',
    producerBpm: 88,
    kitId: 'rnbVelvetBloom',
    desc: 'Velvet bloom — hybrid kick 1 & 3, ghost snare, silk hat shuffle',
    pattern: grid([
      [0, 0], [0, 8], [0, 11],
      [1, 4], [1, 12],
      [2, 4], [2, 12],
      [3, 0], [3, 2], [3, 4], [3, 6], [3, 8], [3, 10], [3, 12], [3, 14],
      [7, 3], [7, 11],
    ]),
  },
  {
    id: 'pr-rnb-night-sub',
    name: 'Night · Sub Glide',
    category: 'R&B',
    producerBpm: 78,
    kitId: 'nightSub',
    desc: 'After-hours sub — slow kick pocket, cross-stick ghosts, clap on 2 & 4',
    pattern: grid([
      [0, 0], [0, 7], [0, 10], [0, 14],
      [1, 3], [1, 4], [1, 11], [1, 12],
      [2, 4], [2, 12],
      [3, 0], [3, 2], [3, 4], [3, 6], [3, 8], [3, 10], [3, 12], [3, 14],
      [4, 6],
      [7, 2], [7, 6], [7, 10], [7, 14],
    ]),
  },
  {
    id: 'pr-rnb-vault-groove',
    name: 'Vault · Groove Hybrid',
    category: 'R&B',
    producerBpm: 84,
    kitId: 'vault808',
    desc: 'Hybrid vault groove — dry kick + soft 808 body, laid-back snare pocket',
    pattern: grid([
      [0, 0], [0, 8], [0, 11],
      [1, 4], [1, 12],
      [2, 4], [2, 12],
      ...hats8(),
      [5, 0], [5, 8],
      [7, 6], [7, 14],
    ]),
  },
];

const KIT_MAPS = [
  BEAT_LAB_STREET_TRAP_KIT_MAP,
  BEAT_LAB_SIGNATURE_TRAP_KIT_MAP,
  BEAT_LAB_MODERN_RNB_KIT_MAP,
] as const;

function buildImportedPresets(): PianoRollDrumPreset[] {
  const out: PianoRollDrumPreset[] = [];

  for (const p of BEAT_LAB_STREET_TRAP_PATTERNS) {
    const kitId = resolveKit(p.id, KIT_MAPS, 'trapStreetCyborgWoofer');
    out.push(fromPatternPreset(p, kitId, 'Trap'));
  }
  for (const p of BEAT_LAB_SIGNATURE_TRAP_PATTERNS) {
    const kitId = resolveKit(p.id, KIT_MAPS, 'trapDarkVault');
    out.push(fromPatternPreset(p, kitId, 'Trap'));
  }
  for (const p of BEAT_LAB_MODERN_RNB_PATTERNS) {
    const kitId = resolveKit(p.id, KIT_MAPS, 'rnbModern808NightGrind');
    out.push(fromPatternPreset(p, kitId, 'R&B'));
  }

  return out;
}

/** Full bank — 50 presets (36 imported + 14 Piano Roll exclusive). */
export const PIANO_ROLL_DRUM_CATALOG: readonly PianoRollDrumPreset[] = [
  ...buildImportedPresets(),
  ...PIANO_ROLL_EXCLUSIVE,
];

export const PIANO_ROLL_TRAP_PRESETS = PIANO_ROLL_DRUM_CATALOG.filter((p) => p.category === 'Trap');
export const PIANO_ROLL_RNB_PRESETS = PIANO_ROLL_DRUM_CATALOG.filter((p) => p.category === 'R&B');

export function pianoRollDrumPresetById(id: string): PianoRollDrumPreset | undefined {
  return PIANO_ROLL_DRUM_CATALOG.find((p) => p.id === id);
}

/** Master-clock BPM when a preset is loaded (trap presets halve producer grid tempo). */
export function pianoRollTransportBpmForPreset(preset: PianoRollDrumPreset): number {
  if (preset.category === 'Trap') {
    return beatLabTrapTransportBpmFromProducer(preset.producerBpm);
  }
  return preset.producerBpm;
}

export type PianoRollDrumNote = { row: number; col: number };

/** Convert an 8-row pattern grid into Piano Roll drum notes (pads 0–7). */
export function pianoRollPatternToNotes(pattern: boolean[][]): PianoRollDrumNote[] {
  const notes: PianoRollDrumNote[] = [];
  for (let row = 0; row < pattern.length; row++) {
    const steps = pattern[row];
    if (!steps) continue;
    for (let col = 0; col < steps.length; col++) {
      if (steps[col]) notes.push({ row, col });
    }
  }
  return notes;
}
