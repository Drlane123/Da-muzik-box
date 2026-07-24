/**
 * Beat Lab disco bank — disco-7 … disco-30 (tail of expanded drums).
 * Pure Donna Summer / SNF grooves — see `beatLabDiscoPatternGrid.ts`.
 */

import {
  discoBloomPocket,
  discoBloomPlusPocket,
  discoBoogieDownPocket,
  discoBridgeTunnelPocket,
  discoClassicPocket,
  discoDrivePocket,
  discoGlitterFloorPocket,
  discoHeatPocket,
  discoHiNrgPocket,
  discoMirrorBallShimmer,
  discoPeakLiftPocket,
  discoRollerRinkPocket,
  discoSaturdayNightPocket,
  discoStudio54Pocket,
} from '@/app/lib/creationStation/beatLabDiscoPatternGrid';

interface DiscoExpandedDrumPreset {
  id: string;
  name: string;
  genre: string;
  role: 'drums';
  pattern: boolean[][];
  desc: string;
  bpm?: number;
}

const R = 8;
const S = 16;

function grid(hits: ReadonlyArray<[number, number]>): boolean[][] {
  const g: boolean[][] = Array.from({ length: R }, () => new Array<boolean>(S).fill(false));
  for (const [row, step] of hits) {
    if (row >= 0 && row < R && step >= 0 && step < S) g[row]![step] = true;
  }
  return g;
}

function discoPreset(
  id: string,
  name: string,
  desc: string,
  hits: ReadonlyArray<[number, number]>,
  bpm: number,
): DiscoExpandedDrumPreset {
  return {
    id,
    name,
    genre: 'Disco',
    role: 'drums',
    desc,
    pattern: grid(hits),
    bpm,
  };
}

/** disco-7 … disco-30 — authentic floor variants (houseDrive kit). */
export const BEATLAB_DISCO_EXPANDED_TAIL_PRESETS: DiscoExpandedDrumPreset[] = [
  discoPreset(
    'disco-7',
    'Disco Saturday Night',
    'SNF anthem — four-on-floor, shaker on 2 & 4, open hats on the &',
    discoSaturdayNightPocket(),
    122,
  ),
  discoPreset(
    'disco-8',
    'Disco Studio 54 Vibe',
    'Studio 54 glitter — 16th hats, offbeat OH, cowbell on 1 & 3',
    discoStudio54Pocket(),
    120,
  ),
  discoPreset(
    'disco-9',
    'Disco Glitter Floor',
    'Glitter floor — classic pocket + shaker + cowbell sparkle',
    discoGlitterFloorPocket(),
    118,
  ),
  discoPreset(
    'disco-10',
    'Disco Hi-NRG Step',
    'Hi-NRG drive — 16th shimmer, shaker, locked four-on-floor',
    discoHiNrgPocket(),
    128,
  ),
  discoPreset(
    'disco-11',
    'Disco Four On Chic',
    'Pure four-on-floor — snare 2 & 4, 8th hats, OH on every &',
    discoClassicPocket(),
    120,
  ),
  discoPreset(
    'disco-12',
    'Disco Open Hat Chic',
    'Open-hat chic — signature & lift over classic disco floor',
    discoClassicPocket(),
    118,
  ),
  discoPreset(
    'disco-13',
    'Disco Shimmer Step',
    'Mirror-ball shimmer — running 16ths + offbeat open hats',
    discoMirrorBallShimmer(),
    120,
  ),
  discoPreset(
    'disco-14',
    'Disco Bridge Tunnel',
    'Bridge tunnel — boogie kick push, broken 16ths, rim backbeat',
    discoBridgeTunnelPocket(),
    122,
  ),
  discoPreset(
    'disco-15',
    'Disco Uptown Boogie',
    'Uptown boogie — four-on-floor + & of 2 kick, rim on the snare',
    discoBoogieDownPocket(),
    122,
  ),
  discoPreset(
    'disco-16',
    'Disco Sunset Skate',
    'Sunset skate — roller-rink glide, shaker on 2 & 4',
    discoRollerRinkPocket(),
    118,
  ),
  discoPreset(
    'disco-17',
    'Disco Chrome Skate',
    'Chrome skate — 16th shimmer + rink shaker floor',
    discoHiNrgPocket(),
    124,
  ),
  discoPreset(
    'disco-18',
    'Disco Vinyl Chic',
    'Vinyl chic — warm classic pocket @ slow disco tempo',
    discoClassicPocket(),
    116,
  ),
  discoPreset(
    'disco-19',
    'Disco Dancefloor Gold',
    'Dancefloor gold — SNF floor + shaker glitter',
    discoSaturdayNightPocket(),
    120,
  ),
  discoPreset(
    'disco-20',
    'Disco Classic Chic',
    'Classic chic — Donna Summer pocket, locked backbeat',
    discoClassicPocket(),
    118,
  ),
  discoPreset(
    'disco-21',
    'Disco Night Chic',
    'Night chic — mirror shimmer for late-floor energy',
    discoMirrorBallShimmer(),
    122,
  ),
  discoPreset(
    'disco-22',
    'Disco Gold Chic',
    'Gold chic — Studio 54 shimmer + cowbell on 1 & 3',
    discoStudio54Pocket(),
    120,
  ),
  discoPreset(
    'disco-23',
    'Disco Silver Chic',
    'Silver chic — uptown boogie push + rim texture',
    discoBoogieDownPocket(),
    118,
  ),
  discoPreset(
    'disco-24',
    'Disco Disco Nap',
    'Slow-floor nap — pure classic pocket @ relaxed tempo',
    discoClassicPocket(),
    112,
  ),
  discoPreset(
    'disco-25',
    'Disco Disco Peak',
    'Peak anthem — tom lift + shaker over classic floor',
    discoPeakLiftPocket(),
    126,
  ),
  discoPreset(
    'disco-26',
    'Disco Disco Lift',
    'Lift groove — peak tom accent + shaker drive',
    discoPeakLiftPocket(),
    124,
  ),
  discoPreset(
    'disco-27',
    'Disco Disco Drive',
    'Drive pocket — boogie kicks + broken 16th hats',
    discoDrivePocket(),
    122,
  ),
  discoPreset(
    'disco-28',
    'Disco Disco Bloom',
    'Bloom floor — roller rink + rim backbeat layer',
    discoBloomPocket(),
    120,
  ),
  discoPreset(
    'disco-29',
    'Disco Disco Heat',
    'Heat peak — hi-NRG shimmer + rim punch',
    discoHeatPocket(),
    130,
  ),
  discoPreset(
    'disco-30',
    'Disco Disco BloomPlus',
    'Bloom+ peak — 16th shimmer, shaker, cowbell sparkle',
    discoBloomPlusPocket(),
    128,
  ),
  // ── Disco solid pack (+20) — same four-on-floor / SNF language ────────────
  discoPreset('disco-31', 'Disco Solid Floor', 'Solid disco floor — four-on-floor, snare+clap 2&4, 8ths, OH &s', discoClassicPocket(), 120),
  discoPreset('disco-32', 'Disco Mirror Solid', 'Mirror solid — 16th shimmer, offbeat OH, locked floor', discoMirrorBallShimmer(), 122),
  discoPreset('disco-33', 'Disco Boogie Solid', 'Boogie solid — four floor + & of 2 kick, rim backbeat', discoBoogieDownPocket(), 121),
  discoPreset('disco-34', 'Disco Rink Solid', 'Roller-rink solid — pure floor, shaker 2&4, OH &s', discoRollerRinkPocket(), 124),
  discoPreset('disco-35', 'Disco Saturday Solid', 'SNF solid — classic floor + shaker glitter', discoSaturdayNightPocket(), 122),
  discoPreset('disco-36', 'Disco Studio Solid', 'Studio 54 solid — 16ths, OH &s, cowbell 1&3', discoStudio54Pocket(), 120),
  discoPreset('disco-37', 'Disco Glitter Solid', 'Glitter solid — classic + shaker + cowbell sparkle', discoGlitterFloorPocket(), 118),
  discoPreset('disco-38', 'Disco Hi-NRG Solid', 'Hi-NRG solid — fast 16th shimmer, shaker drive', discoHiNrgPocket(), 128),
  discoPreset('disco-39', 'Disco Bridge Solid', 'Bridge solid — boogie kicks, broken 16ths, rim', discoBridgeTunnelPocket(), 123),
  discoPreset('disco-40', 'Disco Drive Solid', 'Drive solid — boogie kick + broken hats, OH lift', discoDrivePocket(), 122),
  discoPreset('disco-41', 'Disco Peak Solid', 'Peak solid — tom lift + shaker over classic floor', discoPeakLiftPocket(), 126),
  discoPreset('disco-42', 'Disco Bloom Solid', 'Bloom solid — rink floor + rim backbeat', discoBloomPocket(), 120),
  discoPreset('disco-43', 'Disco Heat Solid', 'Heat solid — hi-NRG shimmer + rim punch', discoHeatPocket(), 130),
  discoPreset('disco-44', 'Disco BloomPlus Solid', 'Bloom+ solid — 16th shimmer, shaker, cowbell', discoBloomPlusPocket(), 127),
  discoPreset('disco-45', 'Disco Night Floor', 'Night floor — mirror shimmer @ late disco tempo', discoMirrorBallShimmer(), 119),
  discoPreset('disco-46', 'Disco Gold Floor', 'Gold floor — Studio 54 shimmer + cowbell', discoStudio54Pocket(), 121),
  discoPreset('disco-47', 'Disco Chrome Floor', 'Chrome floor — hi-NRG shimmer + rink shaker', discoHiNrgPocket(), 125),
  discoPreset('disco-48', 'Disco Vinyl Floor', 'Vinyl floor — warm classic pocket', discoClassicPocket(), 116),
  discoPreset('disco-49', 'Disco Uptown Solid', 'Uptown solid — boogie push + rim texture', discoBoogieDownPocket(), 119),
  discoPreset('disco-50', 'Disco Forever Floor', 'Forever floor — SNF classic + shaker glitter', discoSaturdayNightPocket(), 120),
];

/** All disco Beat Lab presets that pair with houseDrive kit. */
export const BEAT_LAB_DISCO_HOUSE_DRIVE_IDS = [
  'disco-1', 'disco-2',
  'disco-3', 'disco-4', 'disco-5', 'disco-6',
  ...BEATLAB_DISCO_EXPANDED_TAIL_PRESETS.map((p) => p.id),
] as const;
