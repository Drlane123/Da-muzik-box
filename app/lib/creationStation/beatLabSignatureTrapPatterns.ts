/**
 * Beat Lab Signature Trap Series — hand-tuned patterns paired with producer kits.
 * Trap `bpm` = producer grid tempo (130–150); transport plays half-time feel via beatLabTrapTempo.ts.
 *
 * Row layout: 0=Kick  1=Snare  2=Clap  3=Hi-Hat  4=Open Hat  5=TomHi  6=808 body  7=Rim/Perc
 */

import type { PatternPreset } from '@/app/lib/patternPresets';
import type { BeatLabProducerKitId } from '@/app/lib/creationStation/beatLabProducerKits';
import {
  trap808FollowKick,
  trap808OneThree,
  trapAtlMemphisBounce,
  trapBackbeatStack,
  trapCoreClubBounce,
  trapCoreDirtySouthClub,
  trapCoreFinisher,
  trapCoreHalfTime,
  trapCoreMetro,
  trapCoreSouth,
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

const R = 8;
const S = 16;

function grid(hits: ReadonlyArray<[number, number]>): boolean[][] {
  const g: boolean[][] = Array.from({ length: R }, () => new Array<boolean>(S).fill(false));
  for (const [row, step] of hits) {
    if (row >= 0 && row < R && step >= 0 && step < S) g[row]![step] = true;
  }
  return g;
}

export const BEAT_LAB_SIGNATURE_TRAP_KIT_MAP: Readonly<
  Partial<Record<string, BeatLabProducerKitId>>
> = {
  'trap-sig-night-shift': 'trapDarkVault',
  'trap-sig-southside-stack': 'trapClapStack',
  'trap-sig-phantom-roll': 'trapTrunk808',
  'trap-sig-chrome-bounce': 'trapSlabAtl',
  'trap-sig-mud-stomp': 'trapStreetNegativeFloor',
  'trap-sig-bell-bounce': 'trapSlabAtl',
  'trap-sig-vault-mirage': 'trapStreetPinkVault',
  'trap-sig-iron-glide': 'trapStreetBedrockSlab',
  'trap-sig-long-tail': 'trapTrunk808',
  'trap-sig-brass-anthem': 'brassTrap',
  'trap-sig-analog-dust': 'trapAnalogRoom',
  'trap-sig-clap-push': 'trapClapStack',
  'trap-sig-rim-rider': 'trapDarkVault',
  'trap-sig-half-haze': 'trapTrunk808',
  'trap-sig-drill-pocket': 'trapSlabAtl',
  'trap-sig-sparse-pressure': 'trapDarkVault',
  'trap-sig-hat-finisher': 'trapTrunk808',
};

export function isBeatLabSignatureTrapPattern(presetId: string): boolean {
  return presetId.startsWith('trap-sig-');
}

export const BEAT_LAB_SIGNATURE_TRAP_PATTERNS: readonly PatternPreset[] = [
  {
    id: 'trap-sig-night-shift',
    name: 'Night Shift · Lean',
    genre: 'Trap',
    role: 'drums',
    bpm: 72,
    desc: 'Lean night trap @ 72 — late kick pocket, hard trap snare 2 & 4 + push, steady→roll, no sub',
    pattern: grid([
      [0, 0], [0, 7], [0, 10], [0, 14],
      ...trapSnare24(),
      ...trapSnareBarPush(),
      [1, 15],
      ...trapHatsSteadyThenRoll(),
      ...trapOh24(),
    ]),
  },
  {
    id: 'trap-sig-southside-stack',
    name: 'Southside · Stack',
    genre: 'Trap',
    role: 'drums',
    bpm: 142,
    desc: 'Southern bounce — sync kick, triplet hat fill, rim accents',
    pattern: grid(trapCoreSouth()),
  },
  {
    id: 'trap-sig-phantom-roll',
    name: 'Phantom · Roll',
    genre: 'Trap',
    role: 'drums',
    bpm: 144,
    desc: 'Roll finisher — sync into 3, kick bar rush, snap 2 & 4 + push, steady→burst hats',
    pattern: grid([
      [0, 0], [0, 6], [0, 10], [0, 11],
      ...trapKickBarRush(),
      ...trapSnare24(),
      ...trapSnareBarPush(),
      [1, 15],
      ...trapHatsSteadyThenRoll(),
      [4, 10], [4, 14],
    ]),
  },
  {
    id: 'trap-sig-chrome-bounce',
    name: 'Chrome · Bounce',
    genre: 'Trap',
    role: 'drums',
    bpm: 142,
    desc: 'ATL bounce — metro kick pocket, hard trap snare 2 & 4, 8ths→roll, OH lift',
    pattern: grid([
      [0, 0], [0, 6], [0, 10], [0, 14],
      ...trapSnare24(),
      ...trapSnareBarPush(),
      ...trapHatsEightThenRoll(),
      ...trapOh24(),
    ]),
  },
  {
    id: 'trap-sig-mud-stomp',
    name: 'Mud Floor · Stomp',
    genre: 'Trap',
    role: 'drums',
    bpm: 143,
    desc: 'Mud stomp — metro kick + bar rush, hard trap snare 2 & 4, 8ths→roll, rim grit',
    pattern: grid([
      [0, 0], [0, 6], [0, 10], [0, 11],
      ...trapKickBarRush(),
      ...trapSnare24(),
      ...trapSnareBarPush(),
      ...trapHatsEightThenRoll(),
      [4, 10], [4, 14],
      ...trapRimOff(),
    ]),
  },
  {
    id: 'trap-sig-bell-bounce',
    name: 'Bell Trap · Bounce',
    genre: 'Trap',
    role: 'drums',
    bpm: 146,
    desc: 'ATL club — metro kick pocket, snare+clap stacked 2 & 4, two-step hats → roll',
    pattern: grid([
      [0, 0], [0, 6], [0, 10], [0, 14],
      ...trapBackbeatStack(),
      ...trapHatsTwoStep(),
      ...trapHatsRollEnd(),
      [4, 14],
    ]),
  },
  {
    id: 'trap-sig-vault-mirage',
    name: 'Vault · Mirage',
    genre: 'Trap',
    role: 'drums',
    bpm: 147,
    desc: 'Vault ATL bounce — sync into 3 + bar rush, snare pocket 2 & 4, 8ths→roll, block perc',
    pattern: grid([
      ...trapAtlMemphisBounce(),
      [7, 3], [7, 11],
    ]),
  },
  {
    id: 'trap-sig-iron-glide',
    name: 'Iron Slide · Glide',
    genre: 'Trap',
    role: 'drums',
    bpm: 149,
    desc: 'Memphis club glide — metro kick lock, hard snare 2 & 4, 8th hats → roll, one OH turn',
    pattern: grid([
      [0, 0], [0, 6], [0, 10], [0, 14],
      ...trapKickBarRush(),
      ...trapSnare24(),
      ...trapSnareBarPush(),
      [1, 15],
      [3, 0], [3, 2], [3, 4], [3, 6], [3, 8], [3, 10], [3, 12],
      ...trapHatsRollEnd(),
      [4, 14],
      [7, 6], [7, 14],
    ]),
  },
  {
    id: 'trap-sig-long-tail',
    name: 'Long Hit · Tail',
    genre: 'Trap',
    role: 'drums',
    bpm: 147,
    desc: 'ATL stomp tail — sync into 3, kick bar rush, snap snare, quarter hats → roll, OH on 4',
    pattern: grid([
      [0, 0], [0, 8], [0, 10], [0, 11],
      ...trapKickBarRush(),
      ...trapSnare24(),
      ...trapSnareBarPush(),
      [1, 15],
      [3, 0], [3, 4], [3, 8], [3, 12],
      ...trapHatsRollEnd(),
      [4, 15],
    ]),
  },
  {
    id: 'trap-sig-brass-anthem',
    name: 'Brass · Anthem',
    genre: 'Trap',
    role: 'drums',
    bpm: 148,
    desc: 'Anthem pressure — sync kick + bar rush, dense hat finish, tom accent',
    pattern: grid([
      [0, 0], [0, 6], [0, 10],
      ...trapKickBarRush(),
      ...trapSnare24(),
      ...trapSnareBarPush(),
      ...trapHatsSteadyThenRoll(),
      [5, 12],
      ...trap808OneThree(),
    ]),
  },
  {
    id: 'trap-sig-analog-dust',
    name: 'Analog Room · Dust',
    genre: 'Trap',
    role: 'drums',
    bpm: 136,
    desc: 'Dusty room — late kick, two-step hats, rim chatter, breathed OH',
    pattern: grid([
      [0, 0], [0, 9], [0, 14],
      ...trapSnare24(),
      ...trapHatsTwoStep(),
      ...trapHatsRollEnd(),
      [4, 6],
      ...trapRimOff(),
    ]),
  },
  {
    id: 'trap-sig-clap-push',
    name: 'Snap Stack · Push',
    genre: 'Trap',
    role: 'drums',
    bpm: 142,
    desc: 'Metro push — sync kick, snare ghost bar-end, steady→roll hats',
    pattern: grid(trapCoreMetro()),
  },
  {
    id: 'trap-sig-rim-rider',
    name: 'Rim Rider · Perc',
    genre: 'Trap',
    role: 'drums',
    bpm: 141,
    desc: 'Syncopated kick, snap 2 & 4, two-step hats, rim rides 16ths',
    pattern: grid([
      [0, 0], [0, 10], [0, 14],
      ...trapSnare24(),
      ...trapHatsTwoStep(),
      [7, 1], [7, 3], [7, 5], [7, 7], [7, 9], [7, 11], [7, 13], [7, 15],
      ...trap808OneThree(),
    ]),
  },
  {
    id: 'trap-sig-half-haze',
    name: 'Half-Time · Haze',
    genre: 'Trap',
    role: 'drums',
    bpm: 74,
    desc: 'Half-time trap — snare beat 3, lean kick, rolling hats, OH lift',
    pattern: grid(trapCoreHalfTime()),
  },
  {
    id: 'trap-sig-drill-pocket',
    name: 'Drill Pocket · Hybrid',
    genre: 'Trap',
    role: 'drums',
    bpm: 148,
    desc: 'Trap/drill — slide kick, snap 2 & 4, steady→roll, open stabs',
    pattern: grid([
      [0, 0], [0, 3], [0, 8], [0, 11], [0, 15],
      ...trapSnare24(),
      ...trapHatsSteadyThenRoll(),
      [4, 7], [4, 11], [4, 15],
    ]),
  },
  {
    id: 'trap-sig-sparse-pressure',
    name: 'Sparse · Pressure',
    genre: 'Trap',
    role: 'drums',
    bpm: 134,
    desc: 'Minimal trunk — two kicks, snap 2 & 4, two-step + roll, OH on 4',
    pattern: grid([
      ...trapKickSparse(),
      ...trapSnare24(),
      ...trapHatsTwoStep(),
      ...trapHatsRollEnd(),
      [4, 14],
      [6, 0],
    ]),
  },
  {
    id: 'trap-sig-hat-finisher',
    name: 'Hat Roll · Finisher',
    genre: 'Trap',
    role: 'drums',
    bpm: 150,
    desc: 'Drop finisher — lean kick + bar rush, hat burst, open lift',
    pattern: grid(trapCoreFinisher()),
  },
];
