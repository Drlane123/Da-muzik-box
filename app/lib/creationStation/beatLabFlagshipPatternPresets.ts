/**
 * Hand-crafted Pattern Bank drums tuned for the Default kit lineup (banks A–H).
 * Each preset loads its paired flagship kit when picked from Trap / R&B / Dance banks.
 *
 * Row layout (matches patternPresets.ts):
 *   0=Kick  1=Snare  2=Clap  3=Hi-Hat  4=Open Hat  5=TomHi  6=TomLo  7=Rim/Perc
 * Beat Lab lane map: row 6 → pad 5 (808 body on trap kits), row 7 → pad 7 rim/shaker.
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

/** Explicit preset → Default kit pairing (checked before genre pool hash). */
export const BEAT_LAB_FLAGSHIP_PATTERN_KIT_MAP: Readonly<
  Partial<Record<string, BeatLabProducerKitId>>
> = {
  'trap-flag-dark-vault': 'trapDarkVault',
  'trap-flag-atl-slab': 'trapSlabAtl',
  'trap-flag-trunk808': 'trapTrunk808',
  'rnb-flag-smooth': 'smoothRnb',
  'rnb-flag-velvet': 'rnbVelvetBloom',
  'rnb-flag-neo': 'rnbNeoStack',
  'dance-flag-house': 'houseDrive',
  'dance-flag-club': 'clubPocket',
  'dance-flag-lift': 'houseDrive',
};

/** Curated drums — listed first in Pattern Bank genre menus. */
export const BEAT_LAB_FLAGSHIP_DRUM_PATTERNS: readonly PatternPreset[] = [
  // ── TRAP (Dark Vault · ATL Slab · Trunk 808) ─────────────────────────────
  {
    id: 'trap-flag-dark-vault',
    name: 'Dark Vault · Classic',
    genre: 'Trap',
    role: 'drums',
    bpm: 140,
    desc: 'Metro-style pocket — kick 1 & 2.5, stacked clap 2 & 4, 16th hats, 808 body under the one',
    pattern: grid([
      [0, 0], [0, 6], [0, 10], [0, 14],
      [2, 4], [2, 12],
      [3, 0], [3, 1], [3, 2], [3, 3], [3, 4], [3, 5], [3, 6], [3, 7],
      [3, 8], [3, 9], [3, 10], [3, 11], [3, 12], [3, 13], [3, 14], [3, 15],
      [4, 6], [4, 14],
      [6, 0], [6, 10],
    ]),
  },
  {
    id: 'trap-flag-atl-slab',
    name: 'ATL Slab · Bounce',
    genre: 'Trap',
    role: 'drums',
    bpm: 142,
    desc: 'Southern bounce — syncopated kicks, double clap tail, rim pushes, hat roll into bar 4',
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
    id: 'trap-flag-trunk808',
    name: 'Trunk 808 · Glide',
    genre: 'Trap',
    role: 'drums',
    bpm: 145,
    desc: 'Long 808 tail — sparse trunk kicks, clap 2 & 4, dense hats, sub body on the downbeats',
    pattern: grid([
      [0, 0], [0, 8], [0, 11], [0, 14],
      [2, 4], [2, 12],
      [3, 0], [3, 1], [3, 2], [3, 3], [3, 4], [3, 5], [3, 6], [3, 7],
      [3, 8], [3, 9], [3, 10], [3, 11], [3, 12], [3, 13], [3, 14], [3, 15],
      [4, 7], [4, 15],
      [6, 0], [6, 8], [6, 14],
    ]),
  },

  // ── R&B (Smooth Pocket · Velvet Bloom · Neo Stack) ───────────────────────
  {
    id: 'rnb-flag-smooth',
    name: 'Smooth Pocket · Glide',
    genre: 'R&B',
    role: 'drums',
    bpm: 88,
    desc: 'Late-90s pocket — snare 2 & 4, ghost on the & of 4, shaker air, kick behind the beat',
    pattern: grid([
      [0, 0], [0, 9], [0, 11],
      [1, 4], [1, 12], [1, 13],
      [3, 0], [3, 2], [3, 4], [3, 6], [3, 8], [3, 10], [3, 12], [3, 14],
      [7, 0], [7, 4], [7, 8], [7, 12],
    ]),
  },
  {
    id: 'rnb-flag-velvet',
    name: 'Velvet Bloom · Brush',
    genre: 'R&B',
    role: 'drums',
    bpm: 90,
    desc: 'Silk hats — soft backbeat, breathed open lift on 4, clap layer on the snare',
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
    id: 'rnb-flag-neo',
    name: 'Neo Stack · Shuffle',
    genre: 'R&B',
    role: 'drums',
    bpm: 94,
    desc: 'Neo-soul shuffle — cross-stick ghosts, syncopated kick, shaker on the off-grid',
    pattern: grid([
      [0, 0], [0, 7], [0, 10], [0, 14],
      [1, 3], [1, 4], [1, 11], [1, 12],
      [3, 0], [3, 2], [3, 4], [3, 6], [3, 8], [3, 10], [3, 12], [3, 14],
      [4, 6],
      [7, 2], [7, 6], [7, 10], [7, 14],
    ]),
  },

  // ── DANCE (House Drive · Club Pocket) ────────────────────────────────────
  {
    id: 'dance-flag-house',
    name: 'House Drive · 4x4',
    genre: 'Dance',
    role: 'drums',
    bpm: 124,
    desc: 'Four-on-the-floor club — kick every beat, clap 2 & 4, off-beat open hats',
    pattern: grid([
      [0, 0], [0, 4], [0, 8], [0, 12],
      [2, 4], [2, 12],
      [3, 0], [3, 2], [3, 4], [3, 6], [3, 8], [3, 10], [3, 12], [3, 14],
      [4, 2], [4, 6], [4, 10], [4, 14],
    ]),
  },
  {
    id: 'dance-flag-club',
    name: 'Club Pocket · Bounce',
    genre: 'Dance',
    role: 'drums',
    bpm: 126,
    desc: 'Pop-club bounce — 4x4 with syncopated kick pickups, 16th hats, clap on 2 & 4',
    pattern: grid([
      [0, 0], [0, 4], [0, 6], [0, 8], [0, 10], [0, 12], [0, 14],
      [2, 4], [2, 12],
      [3, 0], [3, 1], [3, 2], [3, 3], [3, 4], [3, 5], [3, 6], [3, 7],
      [3, 8], [3, 9], [3, 10], [3, 11], [3, 12], [3, 13], [3, 14], [3, 15],
      [4, 6], [4, 14],
    ]),
  },
  {
    id: 'dance-flag-lift',
    name: 'Festival · Lift',
    genre: 'Dance',
    role: 'drums',
    bpm: 128,
    desc: 'Festival build — steady 4x4, hat roll into the drop, tom accents on 2 & 4',
    pattern: grid([
      [0, 0], [0, 4], [0, 8], [0, 12],
      [2, 4], [2, 12],
      [3, 0], [3, 2], [3, 4], [3, 6], [3, 8], [3, 10], [3, 12], [3, 13], [3, 14], [3, 15],
      [4, 0], [4, 8],
      [5, 4], [5, 12],
    ]),
  },
];
