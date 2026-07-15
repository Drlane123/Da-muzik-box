/**
 * Pattern Presets — the single source of truth for musically correct
 * patterns in the AI Pattern Generator.
 *
 * Every pattern here was designed by hand with the 16th-note step grid
 * in mind (16 steps = 1 bar at any tempo). This is what a real producer
 * would program into a drum machine or MIDI piano roll.
 *
 * Row layout (MUST match AiPatternScreen's row order):
 *   DRUMS:  0=Kick  1=Snare  2=Clap  3=Hi-Hat  4=Open Hat  5=TomHi  6=TomLo  7=Rim/Perc
 *   MELODY: 0=Root  1=2nd    2=3rd   3=4th     4=5th       5=6th    6=7th    7=Oct
 *
 * Step numbers (0–15) = 16th note positions within one bar:
 *   Step 0  = Beat 1       (downbeat)
 *   Step 4  = Beat 2
 *   Step 8  = Beat 3
 *   Step 12 = Beat 4
 *   Step 2  = 1-and (8th)
 *   Step 1  = 1-e   (16th)
 *   Step 3  = 1-ah  (16th before beat 2)
 */

import { BEATLAB_EXPANDED_DRUM_PRESETS } from '@/app/lib/patternPresetsBeatLabExpandedDrums';
import { BEAT_LAB_AFRO_REGGAE_MIAMI_PATTERNS } from '@/app/lib/creationStation/beatLabAfroReggaeMiamiPatterns';
import { BEAT_LAB_FLAGSHIP_DRUM_PATTERNS } from '@/app/lib/creationStation/beatLabFlagshipPatternPresets';
import { BEAT_LAB_SIGNATURE_TRAP_PATTERNS } from '@/app/lib/creationStation/beatLabSignatureTrapPatterns';
import { BEAT_LAB_STREET_TRAP_PATTERNS } from '@/app/lib/creationStation/beatLabStreetTrapPatterns';
import { BEAT_LAB_MODERN_RNB_PATTERNS } from '@/app/lib/creationStation/beatLabModernRnbPatterns';
import { BEAT_LAB_PLATINUM_URBAN_PATTERNS } from '@/app/lib/creationStation/beatLabPlatinumUrbanPatterns';
import {
  BEAT_LAB_SE2_BEAT_PADS_BANK_BPM,
  BEAT_LAB_SE2_BEAT_PADS_BANK_PACK,
} from '@/app/lib/creationStation/beatLabSe2BeatPadsBankPack';
import { beatLabTrapTransportBpmFromProducer } from '@/app/lib/creationStation/beatLabTrapTempo';
import {
  trap808FollowKick,
  trap808OneThree,
  trapCoreClassic,
  trapCoreFinisher,
  trapCoreHalfTime,
  trapCoreMetro,
  trapHatsEightThenRoll,
  trapHatsRollEnd,
  trapHatsSteadyThenRoll,
  trapHatsTwoStep,
  trapKickBarRush,
  trapKickLean,
  trapBaseFormat808Minimal,
  trapKickSlide,
  trapKickSouth,
  trapKickSparse,
  trapKickSyncopated,
  trapOh24,
  trapOhGroove,
  trapRimOff,
  trapSnare24,
  trapSnareBarPush,
  trapSnareHalfTime,
} from '@/app/lib/creationStation/beatLabTrapPatternGrid';

const R = 8;   // rows
const S = 16;  // steps per bar

function grid(hits: ReadonlyArray<[number, number]>): boolean[][] {
  const g: boolean[][] = Array.from({ length: R }, () =>
    new Array<boolean>(S).fill(false),
  );
  for (const [row, step] of hits) {
    if (row >= 0 && row < R && step >= 0 && step < S) g[row]![step] = true;
  }
  return g;
}

export interface PatternPreset {
  id: string;
  name: string;
  genre: string;
  role: 'drums' | 'bass' | 'melody' | 'pad';
  pattern: boolean[][];
  desc: string;
  /** Recommended project tempo when loading this preset (Beat Lab Pattern Bank). */
  bpm?: number;
}

/** Fallback tempo when a preset has no explicit `bpm`. */
const GENRE_DEFAULT_BPM: Readonly<Record<string, number>> = {
  Trap: 140,
  'Boom Bap': 90,
  Drill: 142,
  House: 124,
  Dance: 126,
  Disco: 120,
  Techno: 132,
  'R&B': 92,
  Soul: 94,
  'Lo-Fi': 80,
  Jazz: 120,
  Latin: 98,
  Afro: 105,
  Reggae: 92,
  'Up Tempo': 135,
  Country: 112,
  Any: 120,
  'Platinum Trap': 140,
  'Platinum R&B': 90,
  'Platinum Pop': 110,
};

/** Hand-tuned tempo per drum preset (matches groove feel — half-time patterns use slower BPM). */
const DRUM_PRESET_BPM: Readonly<Record<string, number>> = {
  'trap-1': 140, 'trap-2': 145, 'trap-3': 72, 'trap-4': 138, 'trap-5': 142,
  'trap-6': 144, 'trap-7': 150, 'trap-8': 74, 'trap-9': 136, 'trap-10': 148,
  'trap-11': 142, 'trap-12': 146, 'trap-13': 140, 'trap-14': 138, 'trap-15': 144,
  'trap-16': 152, 'trap-17': 74,
  'boombap-1': 90, 'boombap-2': 88, 'boombap-3': 92,
  'drill-1': 142, 'drill-2': 140, 'drill-3': 138,
  'house-1': 124, 'house-2': 122, 'house-3': 126,
  'disco-1': 120, 'disco-2': 118,
  'rnb-1': 92, 'rnb-2': 74, 'rnb-3': 88, 'rnb-4': 72, 'rnb-5': 96,
  'rnb-6': 90, 'rnb-7': 86, 'rnb-8': 76, 'rnb-9': 94, 'rnb-10': 88,
  'rnb-11': 90, 'rnb-12': 100, 'rnb-13': 84, 'rnb-14': 92, 'rnb-15': 94,
  ...BEAT_LAB_SE2_BEAT_PADS_BANK_BPM,
  'soul-1': 94, 'soul-2': 96,
  'lofi-1': 78, 'lofi-2': 82, 'lofi-3': 86,
  'jazz-1': 128, 'jazz-2': 168,
  'latin-1': 96, 'latin-2': 104,
  'dance-1': 128, 'dance-2': 118, 'dance-3': 128, 'dance-4': 120,
  'dance-5': 124, 'dance-6': 128, 'dance-7': 122, 'dance-8': 126,
  'dance-9': 120, 'dance-10': 130, 'dance-11': 124, 'dance-12': 128,
  'dance-13': 122, 'dance-14': 124,
  'country-1': 112,
  'trap-flag-dark-vault': 140, 'trap-flag-atl-slab': 142, 'trap-flag-trunk808': 145,
  'rnb-flag-smooth': 88, 'rnb-flag-velvet': 90, 'rnb-flag-neo': 94,
  'dance-flag-house': 124, 'dance-flag-club': 90, 'dance-flag-lift': 128,
};

/** Resolve producer-grid / authored tempo (before trap half-time conversion). */
export function getPatternPresetProducerGridBpm(preset: PatternPreset): number {
  const raw =
    preset.bpm ??
    (preset.role === 'drums' ? DRUM_PRESET_BPM[preset.id] : undefined) ??
    GENRE_DEFAULT_BPM[preset.genre] ??
    120;
  return Math.max(40, Math.min(240, Math.round(raw)));
}

/** Resolve and clamp the tempo Beat Lab transport uses when loading a preset. */
export function getPatternPresetBpm(preset: PatternPreset): number {
  const producer = getPatternPresetProducerGridBpm(preset);
  if (
    preset.role === 'drums' &&
    (preset.genre === 'Trap' || preset.genre === 'Platinum Trap')
  ) {
    return beatLabTrapTransportBpmFromProducer(producer);
  }
  return producer;
}

// ─────────────────────────────────────────────────────────────────────────────
// DRUM PRESETS  (R0=Kick R1=Snare R2=Clap R3=HiHat R4=OpenHat R5=TomHi R6=TomLo R7=Rim)
// ─────────────────────────────────────────────────────────────────────────────

const DRUM_PRESETS: PatternPreset[] = [

  // ══ TRAP ══════════════════════════════════════════════════════════════════
  {
    id: 'trap-1', name: 'Trap 808 Classic', genre: 'Trap', role: 'drums',
    desc: 'Canonical trap — sparse kick, snap 2 & 4, 8ths→roll hats, OH groove',
    pattern: grid(trapCoreClassic()),
  },
  {
    id: 'trap-2', name: 'Trap Skippy 808', genre: 'Trap', role: 'drums',
    desc: 'Bar-end kick rush, snare push ghost, steady→burst hats',
    pattern: grid([
      ...trapKickSparse(),
      ...trapKickBarRush(),
      ...trapSnare24(),
      ...trapSnareBarPush(),
      ...trapHatsEightThenRoll(),
      [4,10],[4,14],
      ...trap808OneThree(),
    ]),
  },
  {
    id: 'trap-3', name: 'Trap Half-Time', genre: 'Trap', role: 'drums',
    desc: 'Half-time trap — snare beat 3, lean kick, rolling hats into bar 4',
    pattern: grid(trapCoreHalfTime()),
  },
  {
    id: 'trap-4', name: 'Trap Dark Roll', genre: 'Trap', role: 'drums',
    desc: 'Dark pocket — sparse kick, snap 2 & 4, steady→roll hats, OH lift',
    pattern: grid([
      ...trapKickSparse(),
      ...trapSnare24(),
      ...trapHatsSteadyThenRoll(),
      ...trapOh24(),
      ...trap808OneThree(),
    ]),
  },
  {
    id: 'trap-5', name: 'Trap Drill Hybrid', genre: 'Trap', role: 'drums',
    desc: 'Trap/drill — slide kick, snap 2 & 4, steady→roll, open stabs',
    pattern: grid([
      ...trapKickSlide(),
      ...trapSnare24(),
      ...trapHatsSteadyThenRoll(),
      [4,7],[4,11],[4,15],
    ]),
  },
  {
    id: 'trap-6', name: 'Trap 808 Bounce', genre: 'Trap', role: 'drums',
    desc: 'Southern bounce — sync kick, snap 2 & 4, two-step hats, OH groove',
    pattern: grid([
      ...trapKickSouth(),
      ...trapSnare24(),
      ...trapHatsTwoStep(),
      ...trapOhGroove(),
      ...trap808FollowKick(trapKickSouth()),
    ]),
  },
  {
    id: 'trap-7', name: 'Trap Stutter Hats', genre: 'Trap', role: 'drums',
    desc: 'Metro bounce — sync kick, snare bar-push, steady→roll, rim &s',
    pattern: grid([
      ...trapCoreMetro(),
      ...trapRimOff(),
    ]),
  },
  {
    id: 'trap-8', name: 'Trap Half-Time Bounce', genre: 'Trap', role: 'drums',
    desc: 'Half-time bounce — snare beat 3, sync kick, 8ths→roll, OH lift',
    pattern: grid([
      [0,0],[0,3],[0,10],[0,14],
      ...trapSnareHalfTime(),
      ...trapHatsEightThenRoll(),
      [4,7],[4,15],
      ...trap808OneThree(),
    ]),
  },
  {
    id: 'trap-9', name: 'Trap Sparse + Fill', genre: 'Trap', role: 'drums',
    desc: 'Sparse trunk — sync kick, snap 2 & 4, two-step + roll, OH on 4',
    pattern: grid([
      ...trapKickSyncopated(),
      ...trapSnare24(),
      ...trapHatsTwoStep(),
      ...trapHatsRollEnd(),
      [4,14],
      ...trap808FollowKick(trapKickSyncopated()),
    ]),
  },
  {
    id: 'trap-10', name: 'Trap Rolling Kicks', genre: 'Trap', role: 'drums',
    desc: 'Kick sync into 3 + bar rush, snap 2 & 4, hat burst finish',
    pattern: grid([
      [0,0],[0,10],[0,11],
      ...trapKickBarRush(),
      ...trapSnare24(),
      ...trapHatsSteadyThenRoll(),
      ...trapOh24(),
      ...trap808OneThree(),
    ]),
  },
  {
    id: 'trap-11', name: 'Trap Rim Groove', genre: 'Trap', role: 'drums',
    desc: 'Sync kick, snap 2 & 4, two-step hats, rim on offbeats',
    pattern: grid([
      ...trapKickSyncopated(),
      ...trapSnare24(),
      ...trapHatsTwoStep(),
      ...trapOh24(),
      ...trapRimOff(),
      ...trap808OneThree(),
    ]),
  },
  {
    id: 'trap-12', name: 'Trap Cut-Time Snare', genre: 'Trap', role: 'drums',
    desc: 'Lean kick pickups, snap 2 & 4, steady→roll hats, snare push',
    pattern: grid([
      ...trapKickLean(),
      ...trapSnare24(),
      ...trapSnareBarPush(),
      ...trapHatsSteadyThenRoll(),
      ...trapOh24(),
      ...trap808FollowKick(trapKickLean()),
    ]),
  },
  {
    id: 'trap-13', name: 'Trap Open Hat Swings', genre: 'Trap', role: 'drums',
    desc: 'Open hats on every &, sync kick, two-step + roll hats',
    pattern: grid([
      ...trapKickSyncopated(),
      ...trapSnare24(),
      ...trapHatsTwoStep(),
      ...trapHatsRollEnd(),
      ...trapOhGroove(),
      ...trap808FollowKick(trapKickSyncopated()),
    ]),
  },
  {
    id: 'trap-14', name: 'Trap Triplet Illusion', genre: 'Trap', role: 'drums',
    desc: 'Triplet-lean hat fill, sparse kick, snap 2 & 4, rim accent',
    pattern: grid([
      ...trapKickSparse(),
      ...trapSnare24(),
      ...trapHatsTwoStep(),
      [3,9],[3,10],[3,11],[3,13],[3,14],[3,15],
      [4,10],[4,14],
      [7,11],
      ...trap808OneThree(),
    ]),
  },
  {
    id: 'trap-15', name: 'Trap Perc + Tom', genre: 'Trap', role: 'drums',
    desc: 'Metro pocket — sync kick, snap 2 & 4, two-step hats, tom accent',
    pattern: grid([
      ...trapKickSouth(),
      ...trapSnare24(),
      ...trapHatsTwoStep(),
      [4,14],
      [5,11],
      ...trap808FollowKick(trapKickSouth()),
      [7,6],[7,10],
    ]),
  },
  {
    id: 'trap-16', name: 'Trap Late Clap Push', genre: 'Trap', role: 'drums',
    desc: 'Snare bar-push ghost, kick doubles at bar end, hat finisher',
    pattern: grid(trapCoreFinisher()),
  },
  {
    id: 'trap-17', name: 'Trap Minimal + Hats', genre: 'Trap', role: 'drums',
    desc: 'Base trap @ 74 — sparse 808 kick, snare+clap 2 & 4, two-step hats → roll',
    pattern: grid(trapBaseFormat808Minimal()),
  },

  // ══ BOOM BAP ══════════════════════════════════════════════════════════════
  {
    id: 'boombap-1', name: 'Boom Bap OG', genre: 'Boom Bap', role: 'drums',
    desc: 'Kick on 1 & 3.5, snare on 2 & 4, swung 8th hats, ghost snare',
    pattern: grid([
      [0,0],[0,10],
      [1,4],[1,12],[1,13],                  // Ghost on 13
      [3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],
      [4,11],
    ]),
  },
  {
    id: 'boombap-2', name: 'Boom Bap Pocket', genre: 'Boom Bap', role: 'drums',
    desc: 'Laid-back kick with open hat on & of 3, cross-stick on 2 & 4',
    pattern: grid([
      [0,0],[0,6],[0,10],
      [1,4],[1,12],
      [3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],
      [4,10],
      [7,3],[7,11],
    ]),
  },
  {
    id: 'boombap-3', name: 'Boom Bap Dusty', genre: 'Boom Bap', role: 'drums',
    desc: 'Dusty boom bap: double snare ghost, kick on 1 & late-2, open hat accents',
    pattern: grid([
      [0,0],[0,9],
      [1,4],[1,7],[1,12],[1,15],
      [3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],
      [4,3],[4,11],
    ]),
  },

  // ══ DRILL ══════════════════════════════════════════════════════════════════
  {
    id: 'drill-1', name: 'UK Drill Standard', genre: 'Drill', role: 'drums',
    desc: 'UK drill: triplet-feel kicks, clap on 2 & 4, 16th hats with open accents',
    pattern: grid([
      [0,0],[0,5],[0,8],[0,11],[0,14],
      [1,4],[1,12],
      [3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],
      [3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],
      [4,10],[4,14],
    ]),
  },
  {
    id: 'drill-2', name: 'Brooklyn Drill', genre: 'Drill', role: 'drums',
    desc: '3+3+2 kick feel, rim shot ghost, open hat stabs, clap on 2 & 4',
    pattern: grid([
      [0,0],[0,3],[0,8],[0,11],[0,13],
      [1,4],[1,12],
      [3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],
      [3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],
      [4,7],[4,15],
      [7,14],
    ]),
  },
  {
    id: 'drill-3', name: 'Drill Menacing', genre: 'Drill', role: 'drums',
    desc: 'Sparse drill: only 2 claps, aggressive kick slides, dark open hat',
    pattern: grid([
      [0,0],[0,6],[0,11],[0,14],[0,15],
      [1,8],
      [3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],
      [3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],
      [4,5],[4,13],
    ]),
  },

  // ══ HOUSE ══════════════════════════════════════════════════════════════════
  {
    id: 'house-1', name: 'House 4x4 Classic', genre: 'House', role: 'drums',
    desc: '4-on-the-floor kick, clap on 2 & 4, 8th hats, open hat on every &',
    pattern: grid([
      [0,0],[0,4],[0,8],[0,12],
      [1,4],[1,12],
      [3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],
      [4,2],[4,6],[4,10],[4,14],
    ]),
  },
  {
    id: 'house-2', name: 'Deep House Groove', genre: 'House', role: 'drums',
    desc: 'Deep house: 4x4 kick, clap 2 & 4, ride pattern with open accents',
    pattern: grid([
      [0,0],[0,4],[0,8],[0,12],
      [1,4],[1,12],
      [3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],
      [4,6],[4,14],
      [7,3],[7,11],
    ]),
  },
  {
    id: 'house-3', name: 'Tech House Drive', genre: 'House', role: 'drums',
    desc: 'Tech house: 4x4 with conga accent, 16th hats, punchy open hits',
    pattern: grid([
      [0,0],[0,4],[0,8],[0,12],
      [1,4],[1,12],
      [3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],
      [3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],
      [4,2],[4,6],[4,10],[4,14],
      [5,3],[5,11],
    ]),
  },

  // ══ DISCO ══════════════════════════════════════════════════════════════════
  {
    id: 'disco-1', name: 'Disco Fever', genre: 'Disco', role: 'drums',
    desc: '4-on-the-floor, snare 2 & 4, running 8th hats, open hat on the &',
    pattern: grid([
      [0,0],[0,4],[0,8],[0,12],
      [1,4],[1,12],
      [3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],
      [4,2],[4,6],[4,10],[4,14],
    ]),
  },
  {
    id: 'disco-2', name: 'Disco Funk', genre: 'Disco', role: 'drums',
    desc: 'Funky disco: 4x4 kick with extra "and" hit, snare with rim shot, busy open hat',
    pattern: grid([
      [0,0],[0,4],[0,6],[0,8],[0,12],
      [1,4],[1,12],
      [3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],
      [4,2],[4,6],[4,10],[4,14],
      [7,3],[7,11],
    ]),
  },

  // ══ R&B ════════════════════════════════════════════════════════════════════
  {
    id: 'rnb-1', name: 'R&B Pocket', genre: 'R&B', role: 'drums',
    desc: 'Smooth R&B: snare on 2 & 4, ghost notes, kick on the pocket',
    pattern: grid([
      [0,0],[0,9],[0,11],
      [1,4],[1,12],
      [3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],
      [7,3],[7,11],
    ]),
  },
  {
    id: 'rnb-2', name: 'R&B Half-Time Snare', genre: 'R&B', role: 'drums',
    desc: 'Half-time: snare only on beat 3, rolling 16th kicks, open hat fills',
    pattern: grid([
      [0,0],[0,6],[0,10],[0,14],
      [1,8],
      [3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],
      [3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],
      [4,6],[4,14],
    ]),
  },
  {
    id: 'rnb-3', name: 'Neo-Soul Groove', genre: 'R&B', role: 'drums',
    desc: 'Neo-soul: cross-stick snare, syncopated kick, 8th-note hats',
    pattern: grid([
      [0,0],[0,7],[0,10],
      [1,4],[1,12],
      [3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],
      [4,6],
      [7,4],[7,8],[7,12],
    ]),
  },
  {
    id: 'rnb-4', name: 'R&B Slow Jam', genre: 'R&B', role: 'drums',
    desc: 'Slow jam pocket: kick on 1 and late-2, snare 2 & 4, soft hats with open lift',
    pattern: grid([
      [0,0],[0,6],[0,11],
      [1,4],[1,12],
      [3,2],[3,6],[3,10],[3,14],
      [4,14],
    ]),
  },
  {
    id: 'rnb-5', name: 'R&B Tight Pocket', genre: 'R&B', role: 'drums',
    desc: 'Tight modern pocket: kick syncopation, rim ghosts, 8th hats',
    pattern: grid([
      [0,0],[0,9],[0,11],[0,14],
      [1,4],[1,12],
      [3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],
      [7,3],[7,11],[7,15],
    ]),
  },
  {
    id: 'rnb-6', name: 'R&B Ghost Snare', genre: 'R&B', role: 'drums',
    desc: 'Snare ghosts into 2 & 4, kick anchors 1 & 3, hats breathe',
    pattern: grid([
      [0,0],[0,8],[0,11],
      [1,3],[1,4],[1,11],[1,12],[1,13],
      [3,2],[3,6],[3,10],[3,14],
      [4,6],
    ]),
  },
  {
    id: 'rnb-7', name: 'R&B Late Kick', genre: 'R&B', role: 'drums',
    desc: 'Late kick pocket (behind the beat), snare 2 & 4, open hat on & of 3',
    pattern: grid([
      [0,1],[0,7],[0,10],[0,15],
      [1,4],[1,12],
      [3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],
      [4,10],
    ]),
  },
  {
    id: 'rnb-8', name: 'R&B Half-Time Chill', genre: 'R&B', role: 'drums',
    desc: 'Slow half-time — funk sync kick, snare & clap lock on beat 3, silk hats',
    pattern: grid([
      [0,0],[0,6],[0,10],[0,14],
      [1,8],
      [3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],
      [4,14],
      [7,6],
    ]),
  },
  {
    id: 'rnb-9', name: 'R&B Clap Layer', genre: 'R&B', role: 'drums',
    desc: '90s pocket — funk sync kick, snare & clap solid on 2 & 4, 8th hats',
    pattern: grid([
      [0,0],[0,3],[0,6],[0,9],[0,11],[0,14],
      [1,4],[1,12],
      [3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],
      [4,14],
    ]),
  },
  {
    id: 'rnb-10', name: 'R&B Shaker Flow', genre: 'R&B', role: 'drums',
    desc: 'Shaker hats — Teddy Riley kick pocket, snare & clap lock on the &s',
    pattern: grid([
      [0,0],[0,6],[0,9],[0,11],[0,14],
      [1,2],[1,10],
      [3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],
      [4,6],
      [7,6],[7,14],
    ]),
  },
  {
    id: 'rnb-11', name: 'R&B Neo-Soul Push', genre: 'R&B', role: 'drums',
    desc: 'Neo-soul push — sync funk kick, snare & clap lock on 2 & 4, open on & of 2',
    pattern: grid([
      [0,0],[0,3],[0,7],[0,10],[0,14],
      [1,4],[1,12],
      [3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],
      [4,6],
      [7,4],[7,12],
    ]),
  },
  {
    id: 'rnb-12', name: 'R&B Club Step', genre: 'R&B', role: 'drums',
    desc: 'Club R&B — punchy funk kick, snare & clap lock on 2 & 4, steady hats',
    pattern: grid([
      [0,0],[0,3],[0,6],[0,8],[0,11],[0,14],
      [1,4],[1,12],
      [3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],
      [4,8],
    ]),
  },
  {
    id: 'rnb-13', name: 'R&B Minimal Pocket', genre: 'R&B', role: 'drums',
    desc: 'Minimal 90s pocket — sparse funk kick, snare & clap lock on 2 & 4',
    pattern: grid([
      [0,0],[0,6],[0,11],[0,14],
      [1,4],[1,12],
      [3,2],[3,6],[3,10],[3,14],
    ]),
  },
  {
    id: 'rnb-14', name: 'R&B Snare Drag', genre: 'R&B', role: 'drums',
    desc: 'Energetic 90s pocket — funk sync kick, solid snare & clap on 2 & 4, rolling hats',
    pattern: grid([
      [0,0],[0,3],[0,6],[0,9],[0,14],
      [1,4],[1,12],
      [3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],
      [3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],
      [4,6],[4,14],
    ]),
  },
  {
    id: 'rnb-15', name: 'R&B Late Night Bounce', genre: 'R&B', role: 'drums',
    desc: 'Late-night bounce — funk sync kick, snare & clap lock on the &s, open hat air',
    pattern: grid([
      [0,0],[0,3],[0,6],[0,9],[0,11],[0,14],
      [1,2],[1,10],
      [3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],
      [4,6],[4,14],
      [7,4],[7,12],
    ]),
  },

  // ══ SOUL ═══════════════════════════════════════════════════════════════════
  {
    id: 'soul-1', name: 'Soul Pocket', genre: 'Soul', role: 'drums',
    desc: 'Classic soul: kick on 1 & late-2, snare 2 & 4, cross-stick ghosts',
    pattern: grid([
      [0,0],[0,6],[0,8],
      [1,4],[1,12],
      [3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],
      [7,3],[7,11],
    ]),
  },
  {
    id: 'soul-2', name: 'Soul Shuffle', genre: 'Soul', role: 'drums',
    desc: 'Shuffle groove: swung kick & snare, open hat on the & of 2 & 4',
    pattern: grid([
      [0,0],[0,6],[0,10],
      [1,4],[1,12],
      [3,0],[3,3],[3,4],[3,7],[3,8],[3,11],[3,12],[3,15],
      [4,6],[4,14],
    ]),
  },

  // ══ LO-FI ══════════════════════════════════════════════════════════════════
  {
    id: 'lofi-1', name: 'Lo-Fi Chill', genre: 'Lo-Fi', role: 'drums',
    desc: 'Loose lo-fi: off-beat kick, snare 2 & 4, sparse filtered hats',
    pattern: grid([
      [0,0],[0,7],[0,11],
      [1,4],[1,12],
      [3,2],[3,6],[3,9],[3,14],
    ]),
  },
  {
    id: 'lofi-2', name: 'Lo-Fi Swing', genre: 'Lo-Fi', role: 'drums',
    desc: 'Swung 8th hats, laid-back kick, ghost snare on step 13',
    pattern: grid([
      [0,0],[0,6],[0,10],
      [1,4],[1,12],[1,13],
      [3,1],[3,5],[3,9],[3,13],
    ]),
  },
  {
    id: 'lofi-3', name: 'Lo-Fi Boom Bap', genre: 'Lo-Fi', role: 'drums',
    desc: 'Lo-fi boom bap hybrid: kick on 1 & and-of-2, snare 2 & 4, swung hats',
    pattern: grid([
      [0,0],[0,6],[0,10],
      [1,4],[1,12],
      [3,0],[3,3],[3,4],[3,7],[3,8],[3,11],[3,12],[3,15],
      [4,11],
    ]),
  },

  // ══ JAZZ ═══════════════════════════════════════════════════════════════════
  {
    id: 'jazz-1', name: 'Jazz Swing', genre: 'Jazz', role: 'drums',
    desc: 'Swing ride, kick on 1, snare brushed on 2 & 4, rim shot accents',
    pattern: grid([
      [0,0],[0,11],
      [1,4],[1,12],
      [3,0],[3,3],[3,4],[3,7],[3,8],[3,11],[3,12],[3,15],
      [7,6],[7,14],
    ]),
  },
  {
    id: 'jazz-2', name: 'Jazz Waltz', genre: 'Jazz', role: 'drums',
    desc: 'Jazz waltz feel: kick on 1 & 3, ride on triplets, snare on 2',
    pattern: grid([
      [0,0],[0,8],
      [1,4],
      [3,0],[3,3],[3,4],[3,7],[3,8],[3,11],[3,12],[3,15],
      [4,4],
      [7,6],[7,10],
    ]),
  },

  // ══ LATIN / REGGAETON ══════════════════════════════════════════════════════
  {
    id: 'latin-1', name: 'Reggaeton Dembow', genre: 'Latin', role: 'drums',
    desc: 'Dembow: kick on 3+3+2, snare every beat, running 8ths',
    pattern: grid([
      [0,0],[0,3],[0,6],[0,8],[0,11],[0,14],
      [1,0],[1,4],[1,8],[1,12],
      [3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],
    ]),
  },
  {
    id: 'latin-2', name: 'Afrobeats', genre: 'Latin', role: 'drums',
    desc: 'Afrobeats: syncopated kick, clave snare, shaker 8ths, open tom accents',
    pattern: grid([
      [0,0],[0,4],[0,6],[0,10],[0,13],
      [1,2],[1,8],[1,14],
      [3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],
      [5,3],[5,11],
    ]),
  },

  // ══ DANCE / EDM ════════════════════════════════════════════════════════════
  {
    id: 'dance-1', name: 'Dance 4x4', genre: 'Dance', role: 'drums',
    desc: 'Club four-on-the-floor: kick every beat, snare 2 & 4, running 8th hats',
    pattern: grid([
      [0,0],[0,4],[0,8],[0,12],
      [1,4],[1,12],
      [3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],
      [4,2],[4,6],[4,10],[4,14],
    ]),
  },
  {
    id: 'dance-2', name: 'Dance Pop Pocket', genre: 'Dance', role: 'drums',
    desc: 'Pop-dance: syncopated kick, clap layer, open hat on the &',
    pattern: grid([
      [0,0],[0,6],[0,10],[0,14],
      [1,4],[1,12],
      [3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],
      [4,2],[4,10],
    ]),
  },
  {
    id: 'dance-3', name: 'Festival Drive', genre: 'Dance', role: 'drums',
    desc: 'Festival EDM: 4x4 kick, 16th hats, crash accents, clap on 2 & 4',
    pattern: grid([
      [0,0],[0,4],[0,8],[0,12],
      [1,4],[1,12],
      [3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],
      [3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],
      [4,0],[4,8],
      [5,4],[5,12],
    ]),
  },
  {
    id: 'dance-4', name: 'Dance Shuffle', genre: 'Dance', role: 'drums',
    desc: 'Shuffle-dance feel: swung hats, kick on 1 & late-3, rim pushes',
    pattern: grid([
      [0,0],[0,10],
      [1,4],[1,12],
      [3,0],[3,3],[3,4],[3,7],[3,8],[3,11],[3,12],[3,15],
      [4,6],[4,14],
      [7,3],[7,11],
    ]),
  },
  {
    id: 'dance-5', name: 'Dance Electro Pop', genre: 'Dance', role: 'drums',
    desc: 'Electro-pop: 4x4 kick, clap on 2 & 4, off-beat open hat, rim pushes',
    pattern: grid([
      [0,0],[0,4],[0,8],[0,12],
      [1,4],[1,12],
      [3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],
      [4,2],[4,6],[4,10],[4,14],
      [7,6],[7,14],
    ]),
  },
  {
    id: 'dance-6', name: 'Dance Big Room Lift', genre: 'Dance', role: 'drums',
    desc: 'Big-room: 4x4 kick, build hats into bar-end roll, crash accents',
    pattern: grid([
      [0,0],[0,4],[0,8],[0,12],
      [1,4],[1,12],
      [3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,13],[3,14],[3,15],
      [4,0],[4,8],[4,14],
    ]),
  },
  {
    id: 'dance-7', name: 'Dance Groove Kick', genre: 'Dance', role: 'drums',
    desc: 'Groovy kick: extra syncopation, clap 2 & 4, hats 8ths, open on the &',
    pattern: grid([
      [0,0],[0,6],[0,8],[0,10],[0,14],
      [1,4],[1,12],
      [3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],
      [4,2],[4,10],
    ]),
  },
  {
    id: 'dance-8', name: 'Dance Techy 16ths', genre: 'Dance', role: 'drums',
    desc: 'Techy dance: 4x4 kick, 16th hats, open hats on & of 2 and 4',
    pattern: grid([
      [0,0],[0,4],[0,8],[0,12],
      [1,4],[1,12],
      [3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],
      [3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],
      [4,6],[4,14],
    ]),
  },
  {
    id: 'dance-9', name: 'Dance Funky Offbeat', genre: 'Dance', role: 'drums',
    desc: 'Funky dance: kick anchors, clap 2 & 4, offbeat hats, rim on 3-and',
    pattern: grid([
      [0,0],[0,4],[0,9],[0,12],
      [1,4],[1,12],
      [3,2],[3,6],[3,10],[3,14],
      [4,6],[4,14],
      [7,10],
    ]),
  },
  {
    id: 'dance-10', name: 'Dance Breakbeat Hybrid', genre: 'Dance', role: 'drums',
    desc: 'Breakbeat hybrid: kicks syncopated, snare on 2 & 4, hats run 16ths',
    pattern: grid([
      [0,0],[0,3],[0,6],[0,10],[0,14],
      [1,4],[1,12],
      [3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],
      [3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],
      [4,14],
    ]),
  },
  {
    id: 'dance-11', name: 'Dance Euro Pop', genre: 'Dance', role: 'drums',
    desc: 'Euro-pop: 4x4 kick, clap 2 & 4, hats 8ths, open hat on beat 3',
    pattern: grid([
      [0,0],[0,4],[0,8],[0,12],
      [1,4],[1,12],
      [3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],
      [4,8],
      [7,14],
    ]),
  },
  {
    id: 'dance-12', name: 'Dance Build + Drop', genre: 'Dance', role: 'drums',
    desc: 'Build into drop: kick 4x4, clap 2 & 4, hat ramp (more density after beat 3)',
    pattern: grid([
      [0,0],[0,4],[0,8],[0,12],
      [1,4],[1,12],
      [3,0],[3,2],[3,4],[3,6],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],
      [4,6],[4,14],
    ]),
  },
  {
    id: 'dance-13', name: 'Dance Disco Lift', genre: 'Dance', role: 'drums',
    desc: 'Disco-leaning dance: 4x4 kick, snare 2 & 4, open hats every &',
    pattern: grid([
      [0,0],[0,4],[0,8],[0,12],
      [1,4],[1,12],
      [3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],
      [4,2],[4,6],[4,10],[4,14],
      [7,3],[7,11],
    ]),
  },
  {
    id: 'dance-14', name: 'Dance Minimal Club', genre: 'Dance', role: 'drums',
    desc: 'Minimal club: kick on 1-2-3-4, clap 2 & 4, hats sparse, open on & of 4',
    pattern: grid([
      [0,0],[0,4],[0,8],[0,12],
      [1,4],[1,12],
      [3,2],[3,6],[3,10],[3,14],
      [4,14],
    ]),
  },

  // ══ COUNTRY ════════════════════════════════════════════════════════════════
  {
    id: 'country-1', name: 'Country Train', genre: 'Country', role: 'drums',
    desc: 'Train beat: kick on 1 & 3, snare 2 & 4, 16th hat chug',
    pattern: grid([
      [0,0],[0,8],
      [1,4],[1,12],
      [3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],
      [3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],
    ]),
  },
];

/** Beat Lab drum expansion pack (Trap/R&B/House/Dance/Disco/Techno templates). */
const BEATLAB_EXPANDED_DRUMS_AS_PATTERN: PatternPreset[] = BEATLAB_EXPANDED_DRUM_PRESETS.map((p) => ({
  ...p,
  role: 'drums' as const,
}));

/** Core + signature trap + afro/reggae/miami + flagship kit pairs + Beat Lab expansions. */
const ALL_DRUM_PATTERN_SRC: PatternPreset[] = [
  ...BEAT_LAB_STREET_TRAP_PATTERNS,
  ...BEAT_LAB_MODERN_RNB_PATTERNS,
  ...BEAT_LAB_SIGNATURE_TRAP_PATTERNS,
  ...BEAT_LAB_PLATINUM_URBAN_PATTERNS,
  ...BEAT_LAB_AFRO_REGGAE_MIAMI_PATTERNS,
  ...BEAT_LAB_FLAGSHIP_DRUM_PATTERNS,
  ...DRUM_PRESETS,
  ...BEATLAB_EXPANDED_DRUMS_AS_PATTERN,
  ...BEAT_LAB_SE2_BEAT_PADS_BANK_PACK,
];

/** All hand-crafted drum grids for Beat Lab Pattern Bank + AI Pattern. */
export const DRUM_PATTERN_PRESETS: ReadonlyArray<PatternPreset> = ALL_DRUM_PATTERN_SRC;

// ─────────────────────────────────────────────────────────────────────────────
// BASS PRESETS
// Rows for melody instruments (where row 0 = root, row 4 = fifth, etc.):
//   minor: 0=Root 1=2 2=b3 3=4 4=5 5=b6 6=b7 7=Oct
//   major: 0=Root 1=2 2=3  3=4 4=5 5=6  6=7  7=Oct
// ─────────────────────────────────────────────────────────────────────────────

const BASS_PRESETS: PatternPreset[] = [
  // ══ TRAP 808 BASS ══════════════════════════════════════════════════════════
  {
    id: 'trap-bass-1', name: 'Trap 808 Drop', genre: 'Trap', role: 'bass',
    desc: 'Root on 1 & 3, fifth on the "and", octave slide phrase-end',
    pattern: grid([[0,0],[0,8],[4,6],[4,10],[7,14]]),
  },
  {
    id: 'trap-bass-2', name: 'Trap 808 Slide', genre: 'Trap', role: 'bass',
    desc: 'Root drops with b3 approach and octave jump for tension',
    pattern: grid([[0,0],[0,5],[0,10],[2,14],[2,15],[7,8]]),
  },
  {
    id: 'trap-bass-3', name: 'Trap 808 Bounce', genre: 'Trap', role: 'bass',
    desc: 'Root-octave bounce per 2 beats, fifth on the 3rd kick hit',
    pattern: grid([[0,0],[7,4],[0,8],[4,10],[7,12],[0,14]]),
  },
  {
    id: 'drill-bass-1', name: 'Drill Dark 808', genre: 'Drill', role: 'bass',
    desc: 'Ominous: root pedal, minor-3rd hit, b7 for tension, resolves to root',
    pattern: grid([[0,0],[0,3],[0,8],[0,11],[2,5],[2,13],[6,14],[0,15]]),
  },

  // ══ BOOM BAP BASS ══════════════════════════════════════════════════════════
  {
    id: 'boombap-bass-1', name: 'Boom Bap Walk', genre: 'Boom Bap', role: 'bass',
    desc: 'Walking: root → 3rd → 5th → octave, resolves back on beat 4',
    pattern: grid([[0,0],[2,4],[4,8],[6,12],[4,14],[0,15]]),
  },
  {
    id: 'boombap-bass-2', name: 'Boom Bap Pedal', genre: 'Boom Bap', role: 'bass',
    desc: 'Pedal root with 5th on beat 3 pickup, octave on phrase end',
    pattern: grid([[0,0],[0,4],[0,8],[4,10],[4,12],[7,14]]),
  },

  // ══ HOUSE / DISCO BASS ═════════════════════════════════════════════════════
  {
    id: 'house-bass-1', name: 'House Pump', genre: 'House', role: 'bass',
    desc: 'Pumping root every quarter with fifth on every "and"',
    pattern: grid([[0,0],[4,2],[0,4],[4,6],[0,8],[4,10],[0,12],[4,14]]),
  },
  {
    id: 'house-bass-2', name: 'House Octave Walk', genre: 'House', role: 'bass',
    desc: 'Root-octave bounce per bar with 5th transitions between beats 2 & 3',
    pattern: grid([[0,0],[0,4],[7,6],[0,8],[0,12],[4,14]]),
  },
  {
    id: 'disco-bass-1', name: 'Disco 16th Funk', genre: 'Disco', role: 'bass',
    desc: 'Funky running 16th line: root-2-3-5-6-5-3-2 cycle',
    pattern: grid([
      [0,0],[1,2],[2,4],[4,6],[5,8],[4,10],[2,12],[1,14],
    ]),
  },

  // ══ R&B / SOUL BASS ════════════════════════════════════════════════════════
  {
    id: 'rnb-bass-1', name: 'R&B Smooth Walk', genre: 'R&B', role: 'bass',
    desc: 'Root → 5th → octave, b3 passing tone, resolves to root',
    pattern: grid([[0,0],[0,4],[4,6],[7,8],[4,12],[2,14],[0,15]]),
  },
  {
    id: 'rnb-bass-2', name: 'R&B Lock Groove', genre: 'R&B', role: 'bass',
    desc: 'Locks to kick: root on 1 & 3, 5th approach on beat 4',
    pattern: grid([[0,0],[0,9],[0,11],[4,5],[4,13]]),
  },
  {
    id: 'soul-bass-1', name: 'Soul Funk Walk', genre: 'Soul', role: 'bass',
    desc: 'Root-3-5-octave walk, punchy 16th feel, classic soul pocket',
    pattern: grid([[0,0],[0,4],[2,6],[4,8],[4,12],[6,10],[6,14],[7,2]]),
  },

  // ══ LO-FI BASS ═════════════════════════════════════════════════════════════
  {
    id: 'lofi-bass-1', name: 'Lo-Fi Chill Root', genre: 'Lo-Fi', role: 'bass',
    desc: 'Sparse root with b7 touch at phrase end — mellow and warm',
    pattern: grid([[0,0],[0,8],[6,12],[4,14]]),
  },
  {
    id: 'lofi-bass-2', name: 'Lo-Fi Jazzy Walk', genre: 'Lo-Fi', role: 'bass',
    desc: 'Root → 4th → 5th → oct with a b7 turnaround',
    pattern: grid([[0,0],[0,8],[3,4],[3,10],[4,6],[4,14],[6,12],[7,2]]),
  },

  // ══ JAZZ BASS ═════════════════════════════════════════════════════════════
  {
    id: 'jazz-bass-1', name: 'Jazz Walking', genre: 'Jazz', role: 'bass',
    desc: 'Full quarter-note walking bass: 1-2-3-5 each beat, chromatic fills',
    pattern: grid([[0,0],[1,4],[2,8],[4,12],[6,10],[4,14]]),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// MELODY PRESETS
// Row 0 = root, row 4 = fifth. All phrases designed to start on root and
// resolve to root or 5th at bar end for a sense of completion.
// ─────────────────────────────────────────────────────────────────────────────

const MELODY_PRESETS: PatternPreset[] = [
  // ══ TRAP MELODIES ══════════════════════════════════════════════════════════
  {
    id: 'trap-mel-1', name: 'Trap Minor Hook', genre: 'Trap', role: 'melody',
    desc: 'Classic minor pentatonic trap hook: root-b3-5, resolves home',
    pattern: grid([[0,0],[2,3],[3,5],[4,8],[4,10],[2,12],[2,13],[0,14],[0,15]]),
  },
  {
    id: 'trap-mel-2', name: 'Trap Stab Hook', genre: 'Trap', role: 'melody',
    desc: 'Short off-beat stabs on the &s, root-5th-octave ascending phrase',
    pattern: grid([[0,0],[4,4],[4,5],[7,8],[7,9],[4,12],[0,14],[0,15]]),
  },
  {
    id: 'trap-mel-3', name: 'Trap Dark Arp', genre: 'Trap', role: 'melody',
    desc: 'Dark ascending minor arp: root-b3-5-b7, repeat with octave peak',
    pattern: grid([[0,0],[2,2],[4,4],[6,6],[7,8],[4,10],[2,12],[0,14]]),
  },
  {
    id: 'trap-mel-4', name: 'Trap Emotional', genre: 'Trap', role: 'melody',
    desc: 'Emotional trap: root held, b3 float, 5th peak, resolve to root',
    pattern: grid([[0,0],[0,1],[2,4],[2,5],[4,8],[4,9],[2,12],[0,14],[0,15]]),
  },

  // ══ BOOM BAP MELODIES ══════════════════════════════════════════════════════
  {
    id: 'boombap-mel-1', name: 'Boom Bap Sample Flip', genre: 'Boom Bap', role: 'melody',
    desc: 'Soulful ascending phrase: root → 3rd → 5th → 7th → resolve',
    pattern: grid([[0,0],[2,2],[4,4],[6,6],[4,8],[2,10],[0,12],[4,14]]),
  },
  {
    id: 'boombap-mel-2', name: 'Boom Bap Call & Response', genre: 'Boom Bap', role: 'melody',
    desc: 'Classic call (root-4th-5th) then response (b7-5th-root)',
    pattern: grid([[0,0],[3,2],[3,3],[4,4],[6,8],[6,9],[4,10],[0,12],[0,13]]),
  },

  // ══ DRILL MELODIES ═════════════════════════════════════════════════════════
  {
    id: 'drill-mel-1', name: 'Drill Piano Stabs', genre: 'Drill', role: 'melody',
    desc: 'Dark drill piano: root-b3 stabs, b6-b7 tension, resolves root',
    pattern: grid([[0,0],[0,1],[2,3],[5,6],[5,7],[6,9],[6,10],[2,12],[0,14],[0,15]]),
  },
  {
    id: 'drill-mel-2', name: 'Drill Dark Lead', genre: 'Drill', role: 'melody',
    desc: 'Sparse sinister lead: b3-root-5 motif, b6 for tension',
    pattern: grid([[2,0],[0,2],[4,5],[5,8],[5,9],[2,12],[0,14],[0,15]]),
  },

  // ══ HOUSE / DISCO MELODIES ═════════════════════════════════════════════════
  {
    id: 'house-mel-1', name: 'House Lead Bright', genre: 'House', role: 'melody',
    desc: 'Uplifting house lead: root-2-3-5 ascending, doubles on the off-beat',
    pattern: grid([[0,0],[1,2],[2,4],[4,6],[4,7],[2,10],[0,12],[0,13],[4,14]]),
  },
  {
    id: 'house-mel-2', name: 'House Chord Stab', genre: 'House', role: 'melody',
    desc: 'Two-note root+5 chord hit on every quarter note — classic house stab',
    pattern: grid([[0,0],[4,0],[0,4],[4,4],[0,8],[4,8],[0,12],[4,12]]),
  },
  {
    id: 'disco-mel-1', name: 'Disco String Run', genre: 'Disco', role: 'melody',
    desc: 'Running 8th-note string line up the scale and back down',
    pattern: grid([
      [0,0],[0,1],[1,2],[1,3],[2,4],[2,5],[4,6],[4,7],
      [5,8],[5,9],[4,10],[4,11],[2,12],[2,13],[0,14],[0,15],
    ]),
  },

  // ══ R&B / SOUL MELODIES ════════════════════════════════════════════════════
  {
    id: 'rnb-mel-1', name: 'R&B Piano Riff', genre: 'R&B', role: 'melody',
    desc: 'Root-b3-5 with b7 soul approach, resolves to root at bar end',
    pattern: grid([[0,0],[2,2],[2,3],[4,4],[6,7],[6,8],[4,10],[2,12],[2,13],[0,14]]),
  },
  {
    id: 'rnb-mel-2', name: 'R&B Late Night', genre: 'R&B', role: 'melody',
    desc: 'Slow-burn: b7→octave resolve, smooth voice leading down',
    pattern: grid([[0,0],[4,3],[6,6],[6,7],[7,8],[6,10],[4,12],[2,14],[0,15]]),
  },
  {
    id: 'soul-mel-1', name: 'Soul Punchy Motif', genre: 'Soul', role: 'melody',
    desc: 'Funky 16th soul motif: root-4-5 punches with b7 passing note',
    pattern: grid([[0,0],[0,1],[3,3],[3,4],[4,5],[4,6],[3,8],[3,9],[6,10],[4,12],[4,13],[0,14],[0,15]]),
  },

  // ══ LO-FI MELODIES ═════════════════════════════════════════════════════════
  {
    id: 'lofi-mel-1', name: 'Lo-Fi Piano Chill', genre: 'Lo-Fi', role: 'melody',
    desc: 'Pentatonic chill: notes hang on downbeats, breathe on off-beats',
    pattern: grid([[0,0],[2,4],[4,6],[4,7],[6,10],[4,12],[0,14]]),
  },
  {
    id: 'lofi-mel-2', name: 'Lo-Fi Jazzy Vibe', genre: 'Lo-Fi', role: 'melody',
    desc: 'Jazz-inflected lo-fi: root-4-5-maj7, resolves to root',
    pattern: grid([[0,0],[3,3],[4,5],[6,7],[6,8],[4,10],[4,11],[2,13],[0,14],[0,15]]),
  },
  {
    id: 'lofi-mel-3', name: 'Lo-Fi Sad Keys', genre: 'Lo-Fi', role: 'melody',
    desc: 'Sad lo-fi piano: b3-root motif, b7 sigh, 5th resolve',
    pattern: grid([[2,0],[0,2],[2,4],[0,6],[6,8],[6,9],[4,12],[0,14],[0,15]]),
  },

  // ══ JAZZ MELODIES ══════════════════════════════════════════════════════════
  {
    id: 'jazz-mel-1', name: 'Jazz Bebop Run', genre: 'Jazz', role: 'melody',
    desc: 'Bebop run up the scale to the 7th, chromatic approach tone back down',
    pattern: grid([[0,0],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[4,9],[2,11],[0,13],[0,14]]),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// PAD / STRINGS / BRASS PRESETS
// ─────────────────────────────────────────────────────────────────────────────

const PAD_PRESETS: PatternPreset[] = [
  {
    id: 'pad-minor-triad', name: 'Minor Triad Pad', genre: 'Any', role: 'pad',
    desc: 'Root + b3 + 5 held across the bar — warm minor chord',
    pattern: grid([[0,0],[2,0],[4,0]]),
  },
  {
    id: 'pad-minor-7th', name: 'Minor 7th Pad', genre: 'R&B', role: 'pad',
    desc: 'Root + b3 + 5 + b7 — classic R&B/soul minor-7 voicing',
    pattern: grid([[0,0],[2,0],[4,0],[6,0]]),
  },
  {
    id: 'pad-major-triad', name: 'Major Triad Pad', genre: 'House', role: 'pad',
    desc: 'Root + 3 + 5 — bright major pad',
    pattern: grid([[0,0],[2,0],[4,0]]),
  },
  {
    id: 'pad-major-7th', name: 'Major 7th Pad', genre: 'House', role: 'pad',
    desc: 'Root + 3 + 5 + 7 — lush major-7 for neo-soul / house',
    pattern: grid([[0,0],[2,0],[4,0],[6,0]]),
  },
  {
    id: 'pad-sus2', name: 'Sus2 Open Pad', genre: 'Lo-Fi', role: 'pad',
    desc: 'Root + 2 + 5 — dreamy suspended-2, great for lo-fi/cinematic',
    pattern: grid([[0,0],[1,0],[4,0]]),
  },
  {
    id: 'pad-trap-stab', name: 'Trap Chord Stab', genre: 'Trap', role: 'pad',
    desc: 'Minor chord chops on beats 1, 2.5, 3, 4 — classic trap chop',
    pattern: grid([
      [0,0],[2,0],[4,0],
      [0,6],[2,6],[4,6],
      [0,8],[2,8],[4,8],
      [0,12],[2,12],[4,12],
    ]),
  },
  {
    id: 'pad-rnb-offbeat', name: 'R&B Off-Beat Stab', genre: 'R&B', role: 'pad',
    desc: 'Minor-7 chord hits on every off-beat 8th — smooth R&B feel',
    pattern: grid([
      [0,2],[2,2],[4,2],[6,2],
      [0,6],[2,6],[4,6],[6,6],
      [0,10],[2,10],[4,10],[6,10],
      [0,14],[2,14],[4,14],[6,14],
    ]),
  },
  {
    id: 'pad-house-pump', name: 'House Pulsing Stab', genre: 'House', role: 'pad',
    desc: 'Root+5 stab on every 8th note — driving house pad',
    pattern: grid([
      [0,0],[4,0],[0,2],[4,2],[0,4],[4,4],[0,6],[4,6],
      [0,8],[4,8],[0,10],[4,10],[0,12],[4,12],[0,14],[4,14],
    ]),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Combined export + query helpers
// ─────────────────────────────────────────────────────────────────────────────

export const ALL_PRESETS: ReadonlyArray<PatternPreset> = [
  ...ALL_DRUM_PATTERN_SRC,
  ...BASS_PRESETS,
  ...MELODY_PRESETS,
  ...PAD_PRESETS,
];

export const PRESET_GENRES = [
  'All', 'Trap', 'Boom Bap', 'Drill', 'House', 'Dance', 'Disco', 'Techno',
  'R&B', 'Soul', 'Lo-Fi', 'Jazz', 'Latin', 'Country', 'Any',
] as const;

export function filterPresets(
  role: PatternPreset['role'] | 'all',
  genre: string,
): ReadonlyArray<PatternPreset> {
  return ALL_PRESETS.filter((p) => {
    if (role !== 'all' && p.role !== role) return false;
    if (genre !== 'All' && p.genre !== genre && p.genre !== 'Any') return false;
    return true;
  });
}

export function instrumentToPresetRole(instrument: string): PatternPreset['role'] {
  const i = instrument.toLowerCase();
  if (i.includes('drum') || i.includes('percussion')) return 'drums';
  if (i.includes('bass')) return 'bass';
  if (i.includes('pad') || i.includes('string') || i.includes('brass')) return 'pad';
  return 'melody';
}

/** Pick presets for a given role and genre, filtered for Generate (not
 *  the full browser — excludes "Any" genre pads from drum-style lookups). */
export function getPresetsForGenerate(
  role: PatternPreset['role'],
  genre: string,
): ReadonlyArray<PatternPreset> {
  const normalized = genre.toLowerCase().trim();
  const styleMap: Record<string, string> = {
    trap: 'Trap', 'boom bap': 'Boom Bap', boombap: 'Boom Bap',
    drill: 'Drill', house: 'House', dance: 'Dance', disco: 'Disco', techno: 'Techno',
    'r&b': 'R&B', rnb: 'R&B', soul: 'Soul', 'lo-fi': 'Lo-Fi',
    lofi: 'Lo-Fi', jazz: 'Jazz', latin: 'Latin', afro: 'Latin',
    country: 'Country', cinematic: 'Any', dark: 'Trap',
  };
  // Find best matching genre label
  let mappedGenre = 'Trap'; // default
  for (const [key, val] of Object.entries(styleMap)) {
    if (normalized.includes(key)) { mappedGenre = val; break; }
  }
  const matches = ALL_PRESETS.filter(
    (p) => p.role === role && (p.genre === mappedGenre || p.genre === 'Any'),
  );
  // If no matches for that genre, fall back to Trap or first available
  if (matches.length === 0) {
    return ALL_PRESETS.filter((p) => p.role === role).slice(0, 3);
  }
  return matches;
}
