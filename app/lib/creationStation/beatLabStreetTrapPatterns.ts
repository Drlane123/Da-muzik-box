/**
 * Beat Lab Street Trap Series — ten hand-tuned drum patterns paired 1:1 with
 * {@link BEAT_LAB_STREET_TRAP_KIT_METAS} (bundled sound-family kits only).
 *
 * Grids follow authentic trap pocket: sparse half-time kicks, snap snare 2 & 4,
 * two-step hats with bar-end rolls, open hats on the &s.
 *
 * Row layout: 0=Kick  1=Snare  2=Clap  3=Hi-Hat  4=Open Hat  5=TomHi  6=808 body  7=Rim/Perc
 */

import type { PatternPreset } from '@/app/lib/patternPresets';
import type { BeatLabStreetTrapKitId } from '@/app/lib/creationStation/beatLabStreetTrapKits';
import {
  trap808OneThree,
  trapBackbeatStack,
  trapCoreClassic,
  trapCoreFinisher,
  trapCoreMetro,
  trapHatsEightThenRoll,
  trapHatsRollEnd,
  trapHatsSteadyThenRoll,
  trapHatsTwoStep,
  trapKickBarRush,
  trapOh24,
  trapRimOff,
  trapSnare24,
  trapSnareBarPush,
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

/** Explicit preset → street trap kit (1:1 pairing). */
export const BEAT_LAB_STREET_TRAP_KIT_MAP: Readonly<
  Partial<Record<string, BeatLabStreetTrapKitId>>
> = {
  'trap-street-cyborg-pocket': 'trapStreetCyborgWoofer',
  'trap-street-bedrock-stomp': 'trapStreetBedrockSlab',
  'trap-street-zay-slide': 'trapStreetZayTunnel',
  'trap-street-pink-vault': 'trapStreetPinkVault',
  'trap-street-redd-bounce': 'trapStreetReddBlock',
  'trap-street-tm88-haze': 'trapStreetTm88Night',
  'trap-street-trunk-pressure': 'trapStreetTrunkSk',
  'trap-street-jc-push': 'trapStreetJcStack',
  'trap-street-sine-minimal': 'trapStreetGuudSine',
  'trap-street-negative-floor': 'trapStreetNegativeFloor',
};

export function isBeatLabStreetTrapPattern(presetId: string): boolean {
  return presetId.startsWith('trap-street-');
}

export const BEAT_LAB_STREET_TRAP_PATTERNS: readonly PatternPreset[] = [
  {
    id: 'trap-street-cyborg-pocket',
    name: 'Cyborg · Hidden Pocket',
    genre: 'Trap',
    role: 'drums',
    bpm: 140,
    desc: 'Canonical trap — sparse kick, snap 2 & 4, 8ths→roll hats, OH on &s',
    pattern: grid(trapCoreClassic()),
  },
  {
    id: 'trap-street-bedrock-stomp',
    name: 'Bedrock · Block Stomp',
    genre: 'Trap',
    role: 'drums',
    bpm: 74,
    desc: 'Bedrock @ 74 — rolling 808 kick, snare+clap snap 2 & 4, 8ths→roll, no sub layer',
    pattern: grid([
      [0, 0], [0, 8], [0, 10], [0, 11], [0, 14],
      ...trapBackbeatStack(),
      ...trapHatsEightThenRoll(),
      [4, 14],
    ]),
  },
  {
    id: 'trap-street-zay-slide',
    name: 'Zay · Tunnel Slide',
    genre: 'Trap',
    role: 'drums',
    bpm: 74,
    desc: 'Zay tunnel @ 74 — metro kick + slide pickup, snare+clap 2 & 4, two-step → roll',
    pattern: grid([
      [0, 0], [0, 6], [0, 10], [0, 11], [0, 14],
      ...trapBackbeatStack(),
      ...trapHatsTwoStep(),
      ...trapHatsRollEnd(),
      [4, 14],
    ]),
  },
  {
    id: 'trap-street-pink-vault',
    name: 'Pink Vault · Dark Sparse',
    genre: 'Trap',
    role: 'drums',
    bpm: 144,
    desc: 'Vault dark — sync kick pocket, snap 2 & 4, quarter hats → roll, no sub layer',
    pattern: grid([
      [0, 0], [0, 6], [0, 10], [0, 14],
      ...trapSnare24(),
      ...trapSnareBarPush(),
      [3, 0], [3, 4], [3, 8], [3, 12],
      ...trapHatsRollEnd(),
      [4, 6], [4, 14],
      [7, 3], [7, 11],
    ]),
  },
  {
    id: 'trap-street-redd-bounce',
    name: 'Redd · Block Bounce',
    genre: 'Trap',
    role: 'drums',
    bpm: 145,
    desc: 'Redd block stomp — metro kick + bar rush, snap 2 & 4, 8ths→roll, no sub layer',
    pattern: grid([
      [0, 0], [0, 6], [0, 10], [0, 11],
      ...trapKickBarRush(),
      ...trapSnare24(),
      ...trapSnareBarPush(),
      ...trapHatsEightThenRoll(),
      [4, 10], [4, 14],
      [7, 2], [7, 6], [7, 10], [7, 14],
    ]),
  },
  {
    id: 'trap-street-tm88-haze',
    name: 'TM88 · Night Haze',
    genre: 'Trap',
    role: 'drums',
    bpm: 146,
    desc: 'TM88 night — sync kick pocket, snap 2 & 4 + bar double, steady→roll, no sub layer',
    pattern: grid([
      [0, 0], [0, 6], [0, 10], [0, 14],
      ...trapSnare24(),
      ...trapSnareBarPush(),
      [1, 15],
      ...trapHatsSteadyThenRoll(),
      [4, 7], [4, 15],
      [7, 5], [7, 13],
    ]),
  },
  {
    id: 'trap-street-trunk-pressure',
    name: 'Trunk SK · Pressure',
    genre: 'Trap',
    role: 'drums',
    bpm: 145,
    desc: 'Trunk SK — sync trunk kicks + bar rush, snap 2 & 4, hat burst, 808 locked',
    pattern: grid([
      [0, 0], [0, 8], [0, 10], [0, 11],
      ...trapKickBarRush(),
      ...trapSnare24(),
      ...trapSnareBarPush(),
      ...trapHatsEightThenRoll(),
      [4, 6], [4, 14],
      [6, 0], [6, 8], [6, 11], [6, 14],
    ]),
  },
  {
    id: 'trap-street-jc-push',
    name: 'JC Stack · Late Push',
    genre: 'Trap',
    role: 'drums',
    bpm: 140,
    desc: 'Metro bounce — sync kick, snare bar-push, steady→roll hats',
    pattern: grid(trapCoreMetro()),
  },
  {
    id: 'trap-street-sine-minimal',
    name: 'Guud Sine · Minimal',
    genre: 'Trap',
    role: 'drums',
    bpm: 72,
    desc: 'Clean minimal trap @ 72 — sync kick, hard trap snare 2 & 4, two-step → roll, kick only low',
    pattern: grid([
      [0, 0], [0, 6], [0, 10], [0, 14],
      ...trapSnare24(),
      ...trapSnareBarPush(),
      [1, 15],
      ...trapHatsTwoStep(),
      ...trapHatsRollEnd(),
      ...trapOh24(),
    ]),
  },
  {
    id: 'trap-street-negative-floor',
    name: 'Negative · Mud Floor',
    genre: 'Trap',
    role: 'drums',
    bpm: 139,
    desc: 'Floor finisher — lean kick + bar rush, hat roll, open lift',
    pattern: grid(trapCoreFinisher()),
  },
];
