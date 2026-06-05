/**
 * Beat Lab Signature Trap Series — hand-tuned patterns paired with producer kits.
 * Listed first in the Trap Pattern Bank menu (see patternPresets.ts merge order).
 * Trap `bpm` = producer grid tempo (130–150); transport plays half-time feel via beatLabTrapTempo.ts.
 *
 * Row layout (patternPresets.ts):
 *   0=Kick  1=Snare  2=Clap  3=Hi-Hat  4=Open Hat  5=TomHi  6=808 body  7=Rim/Perc
 * Steps 0,4,8,12 = beats 1–4 in 4/4 @ 16th resolution.
 */

import type { PatternPreset } from '@/app/lib/patternPresets';
import type { BeatLabProducerKitId } from '@/app/lib/creationStation/beatLabProducerKits';

const R = 8;
const S = 16;

function grid(hits: ReadonlyArray<[number, number]>): boolean[][] {
  const g: boolean[][] = Array.from({ length: R }, () => new Array<boolean>(S).fill(false));
  for (const [row, step] of hits) {
    if (row >= 0 && row < R && step >= 0 && step < S) g[row]![step] = true;
  }
  return g;
}

/** Full 16th closed-hat run (rows 3). */
function hats16(): ReadonlyArray<[number, number]> {
  const out: [number, number][] = [];
  for (let s = 0; s < S; s++) out.push([3, s]);
  return out;
}

/** Explicit preset → trap kit (checked before genre hash pool). */
export const BEAT_LAB_SIGNATURE_TRAP_KIT_MAP: Readonly<
  Partial<Record<string, BeatLabProducerKitId>>
> = {
  'trap-sig-night-shift': 'vault808',
  'trap-sig-southside-stack': 'trapClapStack',
  'trap-sig-phantom-roll': 'trunkRattle',
  'trap-sig-chrome-bounce': 'slab808',
  'trap-sig-mud-stomp': 'mudFloor',
  'trap-sig-bell-bounce': 'bell808',
  'trap-sig-vault-mirage': 'vault808',
  'trap-sig-iron-glide': 'ironSlide',
  'trap-sig-long-tail': 'long808Hits',
  'trap-sig-brass-anthem': 'brassTrap',
  'trap-sig-analog-dust': 'trapAnalogRoom',
  'trap-sig-clap-push': 'trapClapStack',
  'trap-sig-rim-rider': 'trapDarkVault',
  'trap-sig-half-haze': 'trapTrunk808',
  'trap-sig-drill-pocket': 'trapSlabAtl',
  'trap-sig-sparse-pressure': 'trapDarkVault',
  'trap-sig-hat-finisher': 'trapTrunk808',
};

/** Signature Trap Series — 17 curated grooves (plus 3 flagship trap patterns elsewhere = 20 total). */
export function isBeatLabSignatureTrapPattern(presetId: string): boolean {
  return presetId.startsWith('trap-sig-');
}

export const BEAT_LAB_SIGNATURE_TRAP_PATTERNS: readonly PatternPreset[] = [
  {
    id: 'trap-sig-night-shift',
    name: 'Night Shift · Lean',
    genre: 'Trap',
    role: 'drums',
    bpm: 140,
    desc: 'Late-night pocket — kick 1 & 2.5, stacked clap 2 & 4, rolling 16ths, 808 under the one',
    pattern: grid([
      [0, 0], [0, 6], [0, 10], [0, 14],
      [2, 4], [2, 12],
      ...hats16(),
      [4, 6], [4, 14],
      [6, 0], [6, 10],
    ]),
  },
  {
    id: 'trap-sig-southside-stack',
    name: 'Southside · Stack',
    genre: 'Trap',
    role: 'drums',
    bpm: 142,
    desc: 'Southern stack — syncopated kicks, double clap tail on 4, rim pushes on the &',
    pattern: grid([
      [0, 0], [0, 3], [0, 7], [0, 10], [0, 14],
      [1, 7],
      [2, 4], [2, 12], [2, 13],
      [3, 0], [3, 2], [3, 4], [3, 6], [3, 8], [3, 10], [3, 12], [3, 13], [3, 14], [3, 15],
      [4, 10], [4, 14],
      [7, 6], [7, 14],
    ]),
  },
  {
    id: 'trap-sig-phantom-roll',
    name: 'Phantom · Roll',
    genre: 'Trap',
    role: 'drums',
    bpm: 144,
    desc: 'Sliding kick phrase with bar-end roll, clap 2 & 4, open hat lift before the turn',
    pattern: grid([
      [0, 0], [0, 5], [0, 8], [0, 11], [0, 13], [0, 14], [0, 15],
      [2, 4], [2, 12],
      [3, 0], [3, 2], [3, 4], [3, 6], [3, 8], [3, 10], [3, 12], [3, 13], [3, 14], [3, 15],
      [4, 10], [4, 14],
      [6, 0], [6, 8],
    ]),
  },
  {
    id: 'trap-sig-chrome-bounce',
    name: 'Chrome · Bounce',
    genre: 'Trap',
    role: 'drums',
    bpm: 141,
    desc: 'Bouncy syncopation — kick behind the grid, 8th hats, open lifts on the & of 2 & 4',
    pattern: grid([
      [0, 0], [0, 7], [0, 10], [0, 14],
      [2, 4], [2, 12],
      [3, 0], [3, 2], [3, 4], [3, 6], [3, 8], [3, 10], [3, 12], [3, 14],
      [4, 6], [4, 14],
      [6, 0], [6, 8],
    ]),
  },
  {
    id: 'trap-sig-mud-stomp',
    name: 'Mud Floor · Stomp',
    genre: 'Trap',
    role: 'drums',
    bpm: 138,
    desc: 'Heavy floor — four-on kick pressure, clap stack, sparse hats with late-bar fill',
    pattern: grid([
      [0, 0], [0, 4], [0, 8], [0, 10], [0, 12],
      [2, 4], [2, 12],
      [3, 0], [3, 4], [3, 8], [3, 12], [3, 13], [3, 14], [3, 15],
      [4, 14],
      [6, 0], [6, 4],
      [7, 8],
    ]),
  },
  {
    id: 'trap-sig-bell-bounce',
    name: 'Bell Trap · Bounce',
    genre: 'Trap',
    role: 'drums',
    bpm: 143,
    desc: 'Perc-forward bounce — rim bell accents, lean kick, clap 2 & 4, swung 8th hats',
    pattern: grid([
      [0, 0], [0, 6], [0, 11],
      [2, 4], [2, 12],
      [3, 0], [3, 2], [3, 4], [3, 6], [3, 8], [3, 10], [3, 12], [3, 14],
      [4, 14],
      [7, 3], [7, 7], [7, 11], [7, 15],
      [6, 0],
    ]),
  },
  {
    id: 'trap-sig-vault-mirage',
    name: 'Vault · Mirage',
    genre: 'Trap',
    role: 'drums',
    bpm: 146,
    desc: 'Dark sparse vault — long 808 tail, minimal kick, clap 2 & 4, breathing hat space',
    pattern: grid([
      [0, 0], [0, 8], [0, 11],
      [2, 4], [2, 12],
      [3, 0], [3, 2], [3, 4], [3, 6], [3, 8], [3, 10], [3, 12], [3, 14],
      [4, 6],
      [6, 0], [6, 8], [6, 14],
    ]),
  },
  {
    id: 'trap-sig-iron-glide',
    name: 'Iron Slide · Glide',
    genre: 'Trap',
    role: 'drums',
    bpm: 145,
    desc: 'Slide pocket — trunk kick on 1 & 3, triplet-lean hats, open stab on the pickup',
    pattern: grid([
      [0, 0], [0, 8], [0, 14],
      [2, 4], [2, 12],
      [3, 0], [3, 1], [3, 2], [3, 4], [3, 5], [3, 6], [3, 8], [3, 9], [3, 10],
      [3, 12], [3, 13], [3, 14], [3, 15],
      [4, 7], [4, 11],
      [6, 0], [6, 8], [6, 11],
    ]),
  },
  {
    id: 'trap-sig-long-tail',
    name: 'Long Hit · Tail',
    genre: 'Trap',
    role: 'drums',
    bpm: 140,
    desc: '808 tail focus — two trunk hits per bar, full hat grid, body under downbeats',
    pattern: grid([
      [0, 0], [0, 8],
      [2, 4], [2, 12],
      ...hats16(),
      [4, 6], [4, 14],
      [6, 0], [6, 8], [6, 14],
    ]),
  },
  {
    id: 'trap-sig-brass-anthem',
    name: 'Brass · Anthem',
    genre: 'Trap',
    role: 'drums',
    bpm: 148,
    desc: 'Anthem pressure — steady kick pulse, stacked clap, dense hats, tom accent on 4',
    pattern: grid([
      [0, 0], [0, 4], [0, 6], [0, 8], [0, 12], [0, 14],
      [2, 4], [2, 12], [2, 13],
      ...hats16(),
      [5, 12],
      [6, 0], [6, 8],
    ]),
  },
  {
    id: 'trap-sig-analog-dust',
    name: 'Analog Room · Dust',
    genre: 'Trap',
    role: 'drums',
    bpm: 136,
    desc: 'Dusty room — behind-the-beat kick, snare layer on 2, rim chatter, breathed hats',
    pattern: grid([
      [0, 0], [0, 9], [0, 14],
      [1, 4], [1, 12],
      [2, 12],
      [3, 0], [3, 3], [3, 6], [3, 9], [3, 12], [3, 15],
      [4, 6],
      [7, 2], [7, 6], [7, 10], [7, 14],
    ]),
  },
  {
    id: 'trap-sig-clap-push',
    name: 'Clap Stack · Push',
    genre: 'Trap',
    role: 'drums',
    bpm: 142,
    desc: 'Late clap push — backbeat clap lands behind the grid, snare under clap, 16th drive',
    pattern: grid([
      [0, 0], [0, 6], [0, 10], [0, 14],
      [1, 4], [1, 12],
      [2, 5], [2, 13],
      ...hats16(),
      [4, 10],
    ]),
  },
  {
    id: 'trap-sig-rim-rider',
    name: 'Rim Rider · Perc',
    genre: 'Trap',
    role: 'drums',
    bpm: 141,
    desc: 'Perc groove — rim rides the offbeats, classic clap 2 & 4, syncopated kick',
    pattern: grid([
      [0, 0], [0, 10], [0, 14],
      [2, 4], [2, 12],
      [3, 0], [3, 2], [3, 4], [3, 6], [3, 8], [3, 10], [3, 12], [3, 14],
      [7, 1], [7, 3], [7, 5], [7, 7], [7, 9], [7, 11], [7, 13], [7, 15],
      [6, 0],
    ]),
  },
  {
    id: 'trap-sig-half-haze',
    name: 'Half-Time · Haze',
    genre: 'Trap',
    role: 'drums',
    bpm: 74,
    desc: 'Phonk half-time — clap on beat 3 only, rolling kick, 808 body on 1 & 3',
    pattern: grid([
      [0, 0], [0, 5], [0, 9], [0, 14],
      [2, 8],
      [3, 0], [3, 1], [3, 2], [3, 3], [3, 4], [3, 5], [3, 6], [3, 7],
      [3, 8], [3, 9], [3, 10], [3, 11], [3, 12], [3, 13], [3, 14], [3, 15],
      [4, 7], [4, 15],
      [6, 0], [6, 8],
    ]),
  },
  {
    id: 'trap-sig-drill-pocket',
    name: 'Drill Pocket · Hybrid',
    genre: 'Trap',
    role: 'drums',
    bpm: 148,
    desc: 'Trap/drill crossover — sliding kick phrase, snare on the 3-e, double clap tail',
    pattern: grid([
      [0, 0], [0, 3], [0, 8], [0, 11], [0, 15],
      [1, 7],
      [2, 4], [2, 12], [2, 13],
      [3, 0], [3, 1], [3, 2], [3, 3], [3, 4], [3, 5], [3, 6], [3, 7],
      [3, 8], [3, 9], [3, 10], [3, 11], [3, 12], [3, 13], [3, 14], [3, 15],
      [4, 7], [4, 11], [4, 15],
    ]),
  },
  {
    id: 'trap-sig-sparse-pressure',
    name: 'Sparse · Pressure',
    genre: 'Trap',
    role: 'drums',
    bpm: 134,
    desc: 'Minimal pressure — two kick hits, clap 2 & 4, hat fill into bar 4, sub on the one',
    pattern: grid([
      [0, 0], [0, 14],
      [2, 4], [2, 12],
      [3, 0], [3, 4], [3, 8], [3, 12], [3, 13], [3, 14], [3, 15],
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
    desc: 'Drop finisher — lean kick, clap 2 & 4, 32nd-feel hat roll on beats 3–4',
    pattern: grid([
      [0, 0], [0, 6], [0, 10],
      [2, 4], [2, 12],
      [3, 0], [3, 2], [3, 4], [3, 6], [3, 8], [3, 10],
      [3, 12], [3, 13], [3, 14], [3, 15],
      [4, 14], [4, 15],
      [6, 0], [6, 10],
    ]),
  },
];
