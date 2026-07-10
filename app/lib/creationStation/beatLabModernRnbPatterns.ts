/**
 * Beat Lab Modern R&B Series — hand-tuned drum patterns paired with
 * {@link BEAT_LAB_MODERN_RNB_KIT_METAS}. Dry kick / snare / clap pocket + classic silk.
 *
 * Row layout: 0=Kick  1=Snare  2=Clap  3=Hi-Hat  4=Open Hat  5=TomHi  6=TomLo  7=Rim/Perc
 */

import type { PatternPreset } from '@/app/lib/patternPresets';
import type { BeatLabModernRnbKitId } from '@/app/lib/creationStation/beatLabModernRnbKits';

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

/** Explicit preset → modern R&B kit (1:1 pairing). */
export const BEAT_LAB_MODERN_RNB_KIT_MAP: Readonly<
  Partial<Record<string, BeatLabModernRnbKitId>>
> = {
  'rnb-modern-night-grind': 'rnbModern808NightGrind',
  'rnb-modern-night-grind-v2': 'rnbModern808NightGrindV2',
  'rnb-modern-after-dark': 'rnbModern808AfterDark',
  'rnb-modern-velvet-sub': 'rnbModern808VelvetSub',
  'rnb-modern-heavy-pulse': 'rnbModern808HeavyPulse',
  'rnb-modern-silk-pocket': 'rnbClassicSilkRoom',
  'rnb-modern-velvet-brush': 'rnbClassicVelvetPocket',
  'rnb-modern-808-bloom': 'rnbHybrid808Bloom',
  'rnb-modern-slow-burn': 'rnbHybridSlowBurn',
};

export function isBeatLabModernRnbPattern(presetId: string): boolean {
  return presetId.startsWith('rnb-modern-');
}

/** No-op hook — kept for CreationStationScreen import stability. */
export function beatLabModernRnbDrumsPostProcess(presetId: string, drums: boolean[][]): boolean[][] {
  return drums;
}

export const BEAT_LAB_MODERN_RNB_PATTERNS: readonly PatternPreset[] = [
  {
    id: 'rnb-modern-night-grind',
    name: 'Night Grind · 808',
    genre: 'R&B',
    role: 'drums',
    bpm: 68,
    desc: 'Slow R&B pocket — fat dry kick, laid-back snare on the &s, clap stack, no sub',
    pattern: grid([
      [0, 0], [0, 6], [0, 10], [0, 14],
      [1, 2], [1, 10],
      [2, 2], [2, 10], [2, 11],
      [3, 0], [3, 2], [3, 4], [3, 6], [3, 8], [3, 10], [3, 12], [3, 14],
      [4, 14],
      [7, 6], [7, 12],
    ]),
  },
  {
    id: 'rnb-modern-night-grind-v2',
    name: 'Night Grind · II',
    genre: 'R&B',
    role: 'drums',
    bpm: 68,
    desc: 'Tight dry pocket — solid kick 1 & 3, snare/clap 2 & 4, shuffle hats, rim ghosts',
    pattern: grid([
      [0, 0], [0, 8], [0, 11],
      [1, 4], [1, 12],
      [2, 4], [2, 12],
      [3, 1], [3, 3], [3, 5], [3, 7], [3, 9], [3, 11], [3, 13], [3, 15],
      [4, 6],
      [7, 3], [7, 11],
    ]),
  },
  {
    id: 'rnb-modern-after-dark',
    name: 'After Dark · Trunk',
    genre: 'R&B',
    role: 'drums',
    bpm: 70,
    desc: 'After-hours pocket — dry kick behind the grid, snappy snare/clap on 2 & 4, sparse hats',
    pattern: grid([
      [0, 0], [0, 7], [0, 11], [0, 14],
      [1, 4], [1, 12],
      [2, 4], [2, 12], [2, 13],
      [3, 2], [3, 6], [3, 10], [3, 14],
      [4, 6],
      [7, 3], [7, 11],
    ]),
  },
  {
    id: 'rnb-modern-velvet-sub',
    name: 'Velvet Sub · Slow',
    genre: 'R&B',
    role: 'drums',
    bpm: 72,
    desc: 'Velvet slow jam — fat dry kick 1 & late-2, ghost snare into 2 & 4, clap stack',
    pattern: grid([
      [0, 0], [0, 6], [0, 11],
      [1, 3], [1, 4], [1, 11], [1, 12],
      [2, 4], [2, 12],
      [3, 2], [3, 6], [3, 10], [3, 14],
      [4, 14],
      [7, 6],
    ]),
  },
  {
    id: 'rnb-modern-heavy-pulse',
    name: 'Heavy Pulse · Club',
    genre: 'R&B',
    role: 'drums',
    bpm: 74,
    desc: 'Club R&B punch — heavy dry kick, laid-back snare on the &s, stacked clap, rolling hats',
    pattern: grid([
      [0, 0], [0, 6], [0, 10], [0, 14],
      [1, 2], [1, 10],
      [2, 2], [2, 10], [2, 11],
      [3, 0], [3, 1], [3, 2], [3, 3], [3, 4], [3, 5], [3, 6], [3, 7],
      [3, 8], [3, 9], [3, 10], [3, 11], [3, 12], [3, 13], [3, 14], [3, 15],
      [7, 6], [7, 14],
    ]),
  },
  {
    id: 'rnb-modern-silk-pocket',
    name: 'Silk · Pocket Glide',
    genre: 'R&B',
    role: 'drums',
    bpm: 88,
    desc: 'Classic silk pocket — snare 2 & 4, ghost on & of 4, kick behind the beat, shaker air',
    pattern: grid([
      [0, 0], [0, 9], [0, 11],
      [1, 4], [1, 12], [1, 13],
      ...hats8(),
      [7, 0], [7, 4], [7, 8], [7, 12],
    ]),
  },
  {
    id: 'rnb-modern-velvet-brush',
    name: 'Velvet · Brush Stack',
    genre: 'R&B',
    role: 'drums',
    bpm: 90,
    desc: 'Silk hats — soft backbeat, clap layer on snare, open lift on beat 4',
    pattern: grid([
      [0, 0], [0, 6], [0, 10],
      [1, 4], [1, 12],
      [2, 12],
      [3, 2], [3, 6], [3, 10], [3, 13], [3, 14], [3, 15],
      [4, 14],
      [7, 3], [7, 11],
    ]),
  },
  {
    id: 'rnb-modern-808-bloom',
    name: '808 Bloom · Hybrid',
    genre: 'R&B',
    role: 'drums',
    bpm: 76,
    desc: 'Hybrid pocket — solid dry kick 1 & 3, snare/clap 2 & 4, silk hats, rim ghosts',
    pattern: grid([
      [0, 0], [0, 8], [0, 11],
      [1, 4], [1, 12],
      [2, 4], [2, 12],
      [3, 0], [3, 2], [3, 4], [3, 6], [3, 8], [3, 10], [3, 12], [3, 14],
      [7, 3], [7, 11],
    ]),
  },
  {
    id: 'rnb-modern-slow-burn',
    name: 'Slow Burn · Grind',
    genre: 'R&B',
    role: 'drums',
    bpm: 94,
    desc: 'Slow burn push — syncopated dry kick, cross-stick snare ghosts, clap on 2 & 4',
    pattern: grid([
      [0, 0], [0, 7], [0, 10], [0, 14],
      [1, 3], [1, 4], [1, 11], [1, 12],
      [2, 4], [2, 12],
      [3, 0], [3, 2], [3, 4], [3, 6], [3, 8], [3, 10], [3, 12], [3, 14],
      [4, 6],
      [7, 2], [7, 6], [7, 10], [7, 14],
    ]),
  },
];
