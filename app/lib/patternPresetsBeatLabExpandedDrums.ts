/**
 * Expanded Beat Lab drum templates.
 * REGENERATE: `node scripts/gen-beatlab-expanded-drums.mjs`
 *
 * Structural match for {@link import('./patternPresets').PatternPreset} without importing patternPresets
 * (avoids circular deps). Imported by patternPresets.ts into DRUM_PRESETS.
 */

import {
  discoBoogieDownPocket,
  discoClassicPocket,
  discoMirrorBallShimmer,
  discoRollerRinkPocket,
} from '@/app/lib/creationStation/beatLabDiscoPatternGrid';
import { BEATLAB_DISCO_EXPANDED_TAIL_PRESETS } from '@/app/lib/creationStation/beatLabDiscoExpandedPatterns';

export interface BeatLabExpandedDrumPreset {
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

export const BEATLAB_EXPANDED_DRUM_PRESETS: BeatLabExpandedDrumPreset[] = [
  {
    id: "trap-18", name: "Trap Velvet Pocket", genre: "Trap", role: 'drums' as const,
    desc: "Beat Lab trap template — map your drums to pads and tune swing",
    pattern: grid([[0,0],[0,4],[0,7],[0,9],[0,13],[2,2],[2,10],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,4],[4,12]]),
  },
  {
    id: "trap-19", name: "Trap Metro South", genre: "Trap", role: 'drums' as const,
    desc: "Beat Lab trap template — map your drums to pads and tune swing",
    pattern: grid([[0,4],[0,8],[0,12],[0,14],[2,2],[2,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[4,1],[4,9]]),
  },
  {
    id: "trap-20", name: "Trap Phonk Lean", genre: "Trap", role: 'drums' as const,
    desc: "Beat Lab trap template — map your drums to pads and tune swing",
    pattern: grid([[0,0],[0,6],[0,9],[0,12],[2,8],[3,0],[3,4],[3,8],[3,12],[4,6],[4,14]]),
    bpm: 74,
  },
  {
    id: "trap-21", name: "Trap Nocturnal", genre: "Trap", role: 'drums' as const,
    desc: "Beat Lab trap template — map your drums to pads and tune swing",
    pattern: grid([[0,1],[0,3],[0,7],[0,10],[0,14],[2,2],[2,10],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,3],[4,11]]),
  },
  {
    id: "trap-22", name: "Trap 808 Mirage", genre: "Trap", role: 'drums' as const,
    desc: "Beat Lab trap template — map your drums to pads and tune swing",
    pattern: grid([[0,2],[0,6],[0,8],[0,14],[2,2],[2,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[4,0],[4,8]]),
  },
  {
    id: "trap-23", name: "Trap Chrome Lean", genre: "Trap", role: 'drums' as const,
    desc: "Beat Lab trap template — map your drums to pads and tune swing",
    pattern: grid([[0,0],[0,3],[0,6],[0,10],[2,2],[2,10],[3,1],[3,5],[3,9],[3,13],[4,5],[4,13]]),
  },
  {
    id: "trap-24", name: "Trap Mythic Glide", genre: "Trap", role: 'drums' as const,
    desc: "Beat Lab trap template — map your drums to pads and tune swing",
    pattern: grid([[0,1],[0,4],[0,8],[0,11],[0,13],[2,2],[2,10],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,2],[4,10]]),
  },
  {
    id: "trap-25", name: "Trap Haze Rider", genre: "Trap", role: 'drums' as const,
    desc: "Beat Lab trap template — map your drums to pads and tune swing",
    pattern: grid([[0,0],[0,2],[0,8],[0,12],[2,8],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[4,7],[4,15]]),
    bpm: 74,
  },
  {
    id: "trap-26", name: "Trap Subway Ghost", genre: "Trap", role: 'drums' as const,
    desc: "Beat Lab trap template — map your drums to pads and tune swing",
    pattern: grid([[0,0],[0,4],[0,10],[0,13],[2,2],[2,10],[3,2],[3,6],[3,10],[3,14],[4,4],[4,12]]),
  },
  {
    id: "trap-27", name: "Trap Purple Mist", genre: "Trap", role: 'drums' as const,
    desc: "Beat Lab trap template — map your drums to pads and tune swing",
    pattern: grid([[0,2],[0,5],[0,7],[0,11],[0,14],[2,2],[2,10],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,1],[4,9]]),
  },
  {
    id: "trap-28", name: "Trap Southside Lean", genre: "Trap", role: 'drums' as const,
    desc: "Beat Lab trap template — map your drums to pads and tune swing",
    pattern: grid([[0,2],[0,6],[0,10],[0,12],[2,2],[2,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[4,6],[4,14]]),
  },
  {
    id: "trap-29", name: "Trap Midnight Stroll", genre: "Trap", role: 'drums' as const,
    desc: "Beat Lab trap template — map your drums to pads and tune swing",
    pattern: grid([[0,4],[0,7],[0,10],[0,14],[2,2],[2,10],[3,3],[3,7],[3,11],[3,15],[4,3],[4,11]]),
  },
  {
    id: "trap-30", name: "Trap Low End Theory", genre: "Trap", role: 'drums' as const,
    desc: "Beat Lab trap template — map your drums to pads and tune swing",
    pattern: grid([[0,1],[0,5],[0,8],[0,12],[0,15],[2,8],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,0],[4,8]]),
    bpm: 74,
  },
  {
    id: "rnb-16", name: "R&B Velvet Sheets", genre: "R&B", role: 'drums' as const,
    desc: "Slow 90s silk — funk sync kick, snare & clap lock on the &s, shuffle hats",
    bpm: 76,
    pattern: grid([
      [0,0],[0,3],[0,6],[0,9],[0,11],[0,14],
      [1,2],[1,10],
      [3,1],[3,3],[3,5],[3,7],[3,9],[3,11],[3,13],[3,15],
      [4,6],[4,14],
      [7,4],[7,12],
    ]),
  },
  {
    id: "rnb-17", name: "R&B Candle Glow", genre: "R&B", role: 'drums' as const,
    desc: "Candle-lit pocket — late funk kick, snare & clap lock on the &s, shuffle hats",
    bpm: 78,
    pattern: grid([
      [0,0],[0,6],[0,9],[0,11],[0,14],
      [1,2],[1,10],
      [3,1],[3,3],[3,5],[3,7],[3,9],[3,11],[3,13],[3,15],
      [4,6],[4,14],
      [7,6],[7,12],
    ]),
  },
  {
    id: "rnb-18", name: "R&B Uptown Step", genre: "R&B", role: 'drums' as const,
    desc: "Uptown 90s step — sync funk kick, snare & clap solid on 2 & 4, shuffle hats",
    pattern: grid([
      [0,0],[0,3],[0,6],[0,10],[0,11],[0,14],
      [1,4],[1,12],
      [3,1],[3,3],[3,5],[3,7],[3,9],[3,11],[3,13],[3,15],
      [4,6],[4,14],
      [7,4],[7,12],
    ]),
  },
  {
    id: "rnb-19", name: "R&B Silk Pillow", genre: "R&B", role: 'drums' as const,
    desc: "Silk pillow groove — Teddy Riley kick pocket, snare & clap lock on the &s",
    pattern: grid([
      [0,0],[0,3],[0,6],[0,9],[0,14],
      [1,2],[1,10],
      [3,1],[3,3],[3,5],[3,7],[3,9],[3,11],[3,13],[3,15],
      [4,6],[4,14],
      [7,6],[7,12],
    ]),
  },
  {
    id: "rnb-20", name: "R&B 3 AM", genre: "R&B", role: 'drums' as const,
    desc: "Late-night funk R&B — Teddy Riley sync kick pocket, snare & clap lock on the &s, shuffle hats",
    bpm: 92,
    pattern: grid([
      [0,0],[0,3],[0,6],[0,9],[0,11],[0,14],
      [1,2],[1,10],
      [3,1],[3,3],[3,5],[3,7],[3,9],[3,11],[3,13],[3,15],
      [4,6],[4,14],
      [7,4],[7,12],
    ]),
  },
  {
    id: "rnb-21", name: "R&B Smooth Operator", genre: "R&B", role: 'drums' as const,
    desc: "Smooth 90s operator — funk sync kick, snare & clap lock on the &s, shuffle hats",
    pattern: grid([
      [0,0],[0,3],[0,6],[0,9],[0,11],[0,14],
      [1,2],[1,10],
      [3,1],[3,3],[3,5],[3,7],[3,9],[3,11],[3,13],[3,15],
      [4,6],[4,14],
      [7,6],[7,12],
    ]),
  },
  {
    id: "rnb-22", name: "R&B Champagne Mist", genre: "R&B", role: 'drums' as const,
    desc: "Champagne pocket — sync funk kick, snare & clap solid on 2 & 4, 8th hats",
    pattern: grid([
      [0,0],[0,3],[0,6],[0,10],[0,14],
      [1,4],[1,12],
      [3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],
      [4,6],[4,14],
      [7,4],[7,12],
    ]),
  },
  {
    id: "rnb-23", name: "R&B Loft Session", genre: "R&B", role: 'drums' as const,
    desc: "Loft session slow jam — funk kick pocket, snare & clap lock on the &s",
    bpm: 76,
    pattern: grid([
      [0,0],[0,6],[0,9],[0,11],[0,14],
      [1,2],[1,10],
      [3,1],[3,3],[3,5],[3,7],[3,9],[3,11],[3,13],[3,15],
      [4,6],[4,14],
      [7,6],[7,12],
    ]),
  },
  {
    id: "rnb-24", name: "R&B Afterparty", genre: "R&B", role: 'drums' as const,
    desc: "Afterparty groove — Teddy Riley kick, snare & clap lock on the &s, shuffle hats",
    bpm: 78,
    pattern: grid([
      [0,0],[0,3],[0,6],[0,9],[0,11],[0,14],
      [1,2],[1,10],
      [3,1],[3,3],[3,5],[3,7],[3,9],[3,11],[3,13],[3,15],
      [4,6],[4,14],
      [7,4],[7,12],
    ]),
  },
  {
    id: "rnb-25", name: "R&B Neon Pillow", genre: "R&B", role: 'drums' as const,
    desc: "Neon slow jam — sync funk kick, snare & clap lock on the &s, shuffle hats",
    pattern: grid([
      [0,0],[0,3],[0,6],[0,9],[0,14],
      [1,2],[1,10],
      [3,1],[3,3],[3,5],[3,7],[3,9],[3,11],[3,13],[3,15],
      [4,6],[4,14],
      [7,6],[7,12],
    ]),
  },
  {
    id: "rnb-26", name: "R&B Slow Burn", genre: "R&B", role: 'drums' as const,
    desc: "Slow burn 90s — funk kick pocket, snare & clap solid on 2 & 4, silk hats",
    pattern: grid([
      [0,0],[0,3],[0,6],[0,10],[0,14],
      [1,4],[1,12],
      [3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],
      [4,6],[4,14],
      [7,4],[7,12],
    ]),
  },
  {
    id: "rnb-27", name: "R&B Two Step Bliss", genre: "R&B", role: 'drums' as const,
    desc: "Two-step bliss — sync funk kick, snare & clap lock on the &s, shuffle hats",
    pattern: grid([
      [0,0],[0,6],[0,9],[0,11],[0,14],
      [1,2],[1,10],
      [3,1],[3,3],[3,5],[3,7],[3,9],[3,11],[3,13],[3,15],
      [4,6],[4,14],
      [7,6],[7,12],
    ]),
  },
  {
    id: "rnb-28", name: "R&B High Rise Mood", genre: "R&B", role: 'drums' as const,
    desc: "High-rise mood — Teddy Riley kick, snare & clap lock on the &s, 8th hats",
    pattern: grid([
      [0,0],[0,3],[0,6],[0,9],[0,11],[0,14],
      [1,2],[1,10],
      [3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],
      [4,6],[4,14],
      [7,4],[7,12],
    ]),
  },
  {
    id: "rnb-29", name: "R&B Satin Glide", genre: "R&B", role: 'drums' as const,
    desc: "Satin glide — funk sync kick, snare & clap lock on the &s, shuffle hats",
    pattern: grid([
      [0,0],[0,3],[0,6],[0,9],[0,11],[0,14],
      [1,2],[1,10],
      [3,1],[3,3],[3,5],[3,7],[3,9],[3,11],[3,13],[3,15],
      [4,6],[4,14],
      [7,6],[7,12],
    ]),
  },
  {
    id: "rnb-30", name: "R&B City Rain", genre: "R&B", role: 'drums' as const,
    desc: "City rain pocket — sync funk kick, snare & clap solid on 2 & 4, shuffle hats",
    bpm: 76,
    pattern: grid([
      [0,0],[0,3],[0,6],[0,10],[0,14],
      [1,4],[1,12],
      [3,1],[3,3],[3,5],[3,7],[3,9],[3,11],[3,13],[3,15],
      [4,6],[4,14],
      [7,4],[7,12],
    ]),
  },
  {
    id: "house-4", name: "House Warehouse A", genre: "House", role: 'drums' as const,
    desc: "Beat Lab house template — steady four-on-the-floor groove",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[4,2],[4,6],[4,10],[4,14],[7,4],[7,12]]),
  },
  {
    id: "house-5", name: "House Warehouse B", genre: "House", role: 'drums' as const,
    desc: "Beat Lab house template — steady four-on-the-floor groove",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,2],[3,5],[3,8],[3,11],[3,15],[4,0],[4,4],[4,8],[4,12]]),
  },
  {
    id: "house-6", name: "House Garage Pump", genre: "House", role: 'drums' as const,
    desc: "Beat Lab house template — steady four-on-the-floor groove",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,2],[4,6],[4,10],[4,14]]),
  },
  {
    id: "house-7", name: "House Basement Jack", genre: "House", role: 'drums' as const,
    desc: "Beat Lab house template — steady four-on-the-floor groove",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,3],[3,5],[3,9],[3,11],[3,13],[3,15],[4,0],[4,4],[4,8],[4,12]]),
  },
  {
    id: "house-8", name: "House Sidechain Dream", genre: "House", role: 'drums' as const,
    desc: "Beat Lab house template — steady four-on-the-floor groove",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[4,2],[4,6],[4,10],[4,14]]),
  },
  {
    id: "house-9", name: "House Organ House", genre: "House", role: 'drums' as const,
    desc: "Beat Lab house template — steady four-on-the-floor groove",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,1],[3,4],[3,7],[3,11],[3,14],[4,0],[4,4],[4,8],[4,12],[7,7],[7,15]]),
  },
  {
    id: "house-10", name: "House Filter Night", genre: "House", role: 'drums' as const,
    desc: "Beat Lab house template — steady four-on-the-floor groove",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,2],[4,6],[4,10],[4,14]]),
  },
  {
    id: "house-11", name: "House Sunrise Set", genre: "House", role: 'drums' as const,
    desc: "Beat Lab house template — steady four-on-the-floor groove",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,1],[3,5],[3,7],[3,9],[3,11],[3,15],[4,0],[4,4],[4,8],[4,12]]),
  },
  {
    id: "house-12", name: "House Rooftop Jack", genre: "House", role: 'drums' as const,
    desc: "Beat Lab house template — steady four-on-the-floor groove",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[4,2],[4,6],[4,10],[4,14]]),
  },
  {
    id: "house-13", name: "House Vinyl Warmth", genre: "House", role: 'drums' as const,
    desc: "Beat Lab house template — steady four-on-the-floor groove",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,0],[3,3],[3,7],[3,10],[3,13],[4,0],[4,4],[4,8],[4,12]]),
  },
  {
    id: "house-14", name: "House Pump Session", genre: "House", role: 'drums' as const,
    desc: "Beat Lab house template — steady four-on-the-floor groove",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,2],[4,6],[4,10],[4,14],[7,2],[7,10]]),
  },
  {
    id: "house-15", name: "House Classic Jack", genre: "House", role: 'drums' as const,
    desc: "Beat Lab house template — steady four-on-the-floor groove",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,1],[3,3],[3,5],[3,7],[3,11],[3,13],[4,0],[4,4],[4,8],[4,12]]),
  },
  {
    id: "house-16", name: "House Peak Hour", genre: "House", role: 'drums' as const,
    desc: "Beat Lab house template — steady four-on-the-floor groove",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[4,2],[4,6],[4,10],[4,14]]),
  },
  {
    id: "house-17", name: "House Afters Groove", genre: "House", role: 'drums' as const,
    desc: "Beat Lab house template — steady four-on-the-floor groove",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,3],[3,6],[3,9],[3,12],[3,15],[4,0],[4,4],[4,8],[4,12]]),
  },
  {
    id: "house-18", name: "House Percolate", genre: "House", role: 'drums' as const,
    desc: "Beat Lab house template — steady four-on-the-floor groove",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,2],[4,6],[4,10],[4,14]]),
  },
  {
    id: "house-19", name: "House Tom Lift", genre: "House", role: 'drums' as const,
    desc: "Beat Lab house template — steady four-on-the-floor groove",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,1],[3,3],[3,7],[3,9],[3,13],[3,15],[4,0],[4,4],[4,8],[4,12],[7,5],[7,13]]),
  },
  {
    id: "house-20", name: "House Open Air", genre: "House", role: 'drums' as const,
    desc: "Beat Lab house template — steady four-on-the-floor groove",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[4,2],[4,6],[4,10],[4,14]]),
  },
  {
    id: "house-21", name: "House Sub Pump", genre: "House", role: 'drums' as const,
    desc: "Beat Lab house template — steady four-on-the-floor groove",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,2],[3,5],[3,8],[3,11],[3,15],[4,0],[4,4],[4,8],[4,12]]),
  },
  {
    id: "house-22", name: "House Hat Swing", genre: "House", role: 'drums' as const,
    desc: "Beat Lab house template — steady four-on-the-floor groove",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,2],[4,6],[4,10],[4,14]]),
  },
  {
    id: "house-23", name: "House Clap Jack", genre: "House", role: 'drums' as const,
    desc: "Beat Lab house template — steady four-on-the-floor groove",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,3],[3,5],[3,9],[3,11],[3,13],[3,15],[4,0],[4,4],[4,8],[4,12]]),
  },
  {
    id: "house-24", name: "House Late Jack", genre: "House", role: 'drums' as const,
    desc: "Beat Lab house template — steady four-on-the-floor groove",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[4,2],[4,6],[4,10],[4,14],[7,0],[7,8]]),
  },
  {
    id: "house-25", name: "House Drive Jack", genre: "House", role: 'drums' as const,
    desc: "Beat Lab house template — steady four-on-the-floor groove",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,1],[3,4],[3,7],[3,11],[3,14],[4,0],[4,4],[4,8],[4,12]]),
  },
  {
    id: "house-26", name: "House Floor Jack", genre: "House", role: 'drums' as const,
    desc: "Beat Lab house template — steady four-on-the-floor groove",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,2],[4,6],[4,10],[4,14]]),
  },
  {
    id: "house-27", name: "House Lift Jack", genre: "House", role: 'drums' as const,
    desc: "Beat Lab house template — steady four-on-the-floor groove",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,1],[3,5],[3,7],[3,9],[3,11],[3,15],[4,0],[4,4],[4,8],[4,12]]),
  },
  {
    id: "house-28", name: "House Deep Floor", genre: "House", role: 'drums' as const,
    desc: "Beat Lab house template — steady four-on-the-floor groove",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[4,2],[4,6],[4,10],[4,14]]),
  },
  {
    id: "house-29", name: "House Peak Jack", genre: "House", role: 'drums' as const,
    desc: "Beat Lab house template — steady four-on-the-floor groove",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,0],[3,3],[3,7],[3,10],[3,13],[4,0],[4,4],[4,8],[4,12],[7,3],[7,11]]),
  },
  {
    id: "house-30", name: "House Solid Jack", genre: "House", role: 'drums' as const,
    desc: "Beat Lab house template — steady four-on-the-floor groove",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,2],[4,6],[4,10],[4,14]]),
  },
  // ── House solid pack (+15) — kick ALWAYS on beat 1 ─────────────────────────
  {
    id: "house-31", name: "House Solid Floor", genre: "House", role: 'drums' as const, bpm: 124,
    desc: "Solid house — kick on 1, four-on-floor, clap offs, 8ths, OH &s",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[4,2],[4,6],[4,10],[4,14]]),
  },
  {
    id: "house-32", name: "House Solid Jack Plus", genre: "House", role: 'drums' as const, bpm: 126,
    desc: "Solid jack — kick on 1, four floor, clap offs, full 16ths, OH &s",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,2],[4,6],[4,10],[4,14]]),
  },
  {
    id: "house-33", name: "House Solid Deep", genre: "House", role: 'drums' as const, bpm: 122,
    desc: "Solid deep — kick on 1, four floor, clap offs, 8ths, OH",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[4,2],[4,6],[4,10],[4,14]]),
  },
  {
    id: "house-34", name: "House Solid Peak", genre: "House", role: 'drums' as const, bpm: 128,
    desc: "Solid peak — kick on 1, four floor, clap offs, sparse hats, OH downs, rim",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,0],[3,3],[3,7],[3,10],[3,13],[4,0],[4,4],[4,8],[4,12],[7,3],[7,11]]),
  },
  {
    id: "house-35", name: "House Solid Drive", genre: "House", role: 'drums' as const, bpm: 125,
    desc: "Solid drive — kick on 1, four floor, clap offs, skip hats, OH downs",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,1],[3,4],[3,7],[3,11],[3,14],[4,0],[4,4],[4,8],[4,12]]),
  },
  {
    id: "house-36", name: "House Solid Swing", genre: "House", role: 'drums' as const, bpm: 124,
    desc: "Solid swing — kick on 1, four floor, clap offs, full hats, OH &s",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,2],[4,6],[4,10],[4,14]]),
  },
  {
    id: "house-37", name: "House Solid Clap", genre: "House", role: 'drums' as const, bpm: 126,
    desc: "Solid clap jack — kick on 1, four floor, clap offs, sparse hats, OH downs",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,3],[3,5],[3,9],[3,11],[3,13],[3,15],[4,0],[4,4],[4,8],[4,12]]),
  },
  {
    id: "house-38", name: "House Solid Late", genre: "House", role: 'drums' as const, bpm: 123,
    desc: "Solid late — kick on 1, four floor, clap offs, 8ths, OH &s, rim",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[4,2],[4,6],[4,10],[4,14],[7,0],[7,8]]),
  },
  {
    id: "house-39", name: "House Solid Lift", genre: "House", role: 'drums' as const, bpm: 127,
    desc: "Solid lift — kick on 1, four floor, clap offs, skip hats, OH downs",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,1],[3,5],[3,7],[3,9],[3,11],[3,15],[4,0],[4,4],[4,8],[4,12]]),
  },
  {
    id: "house-40", name: "House Solid Pump", genre: "House", role: 'drums' as const, bpm: 124,
    desc: "Solid sub pump — kick on 1, four floor, clap offs, sparse hats, OH downs",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,2],[3,5],[3,8],[3,11],[3,15],[4,0],[4,4],[4,8],[4,12]]),
  },
  {
    id: "house-41", name: "House Solid Air", genre: "House", role: 'drums' as const, bpm: 122,
    desc: "Solid open air — kick on 1, four floor, clap offs, 8ths, OH &s",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[4,2],[4,6],[4,10],[4,14]]),
  },
  {
    id: "house-42", name: "House Solid Tom", genre: "House", role: 'drums' as const, bpm: 125,
    desc: "Solid tom lift — kick on 1, four floor, clap offs, skip hats, OH downs, rim",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,1],[3,3],[3,7],[3,9],[3,13],[3,15],[4,0],[4,4],[4,8],[4,12],[7,5],[7,13]]),
  },
  {
    id: "house-43", name: "House Solid Garage", genre: "House", role: 'drums' as const, bpm: 128,
    desc: "Solid garage — kick on 1, four floor + & of 2, clap offs, 8ths, OH",
    pattern: grid([[0,0],[0,4],[0,6],[0,8],[0,12],[2,2],[2,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[4,2],[4,10]]),
  },
  {
    id: "house-44", name: "House Solid Chicago", genre: "House", role: 'drums' as const, bpm: 124,
    desc: "Solid Chicago — kick on 1, four floor, clap offs, full 16ths, OH &s",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,2],[4,6],[4,10],[4,14]]),
  },
  {
    id: "house-45", name: "House Solid Forever", genre: "House", role: 'drums' as const, bpm: 126,
    desc: "Solid forever — kick on 1, four-on-floor, clap offs, 8ths, OH &s",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[4,2],[4,6],[4,10],[4,14]]),
  },
  {
    id: "disco-3", name: "Disco Mirror Ball A", genre: "Disco", role: 'drums' as const,
    desc: "Pure SNF disco — 4-on-floor, snare 2 & 4, 8th hats, open hat on every &",
    pattern: grid([...discoClassicPocket()]),
    bpm: 120,
  },
  {
    id: "disco-4", name: "Disco Mirror Ball B", genre: "Disco", role: 'drums' as const,
    desc: "Mirror-ball shimmer — 16th hats, offbeat open hats, locked four-on-floor",
    pattern: grid([...discoMirrorBallShimmer()]),
    bpm: 118,
  },
  {
    id: "disco-5", name: "Disco Boogie Down", genre: "Disco", role: 'drums' as const,
    desc: "Boogie disco-funk — four-on-floor + & of 2 kick, rim on the backbeat",
    pattern: grid([...discoBoogieDownPocket()]),
    bpm: 120,
  },
  {
    id: "disco-6", name: "Disco Roller Rink", genre: "Disco", role: 'drums' as const,
    desc: "Roller-rink glide — pure floor, shaker on 2 & 4, open hats on the &",
    pattern: grid([...discoRollerRinkPocket()]),
    bpm: 124,
  },
  ...BEATLAB_DISCO_EXPANDED_TAIL_PRESETS,
  {
    id: "dance-15", name: "Dance Arena Rise", genre: "Dance", role: 'drums' as const,
    desc: "Beat Lab dance template — anthem kick and lifts",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[4,4],[4,12],[5,2],[5,10]]),
  },
  {
    id: "dance-16", name: "Dance Radio Rush", genre: "Dance", role: 'drums' as const,
    desc: "Beat Lab dance template — anthem kick and lifts",
    pattern: grid([[0,3],[0,7],[0,11],[0,14],[0,15],[1,2],[1,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[4,2],[4,10]]),
  },
  {
    id: "dance-17", name: "Dance Chart Climb", genre: "Dance", role: 'drums' as const,
    desc: "Beat Lab dance template — anthem kick and lifts",
    pattern: grid([[0,2],[0,6],[0,10],[0,13],[0,14],[2,2],[2,10],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,0],[4,8]]),
  },
  {
    id: "dance-18", name: "Dance Laser Lane", genre: "Dance", role: 'drums' as const,
    desc: "Beat Lab dance template — anthem kick and lifts",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[1,2],[1,10],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,6],[4,14]]),
  },
  {
    id: "dance-19", name: "Dance Drop Lane", genre: "Dance", role: 'drums' as const,
    desc: "Beat Lab dance template — anthem kick and lifts",
    pattern: grid([[0,0],[0,4],[0,8],[0,11],[0,12],[2,2],[2,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[4,4],[4,12]]),
  },
  {
    id: "dance-20", name: "Dance Hyper Step", genre: "Dance", role: 'drums' as const,
    desc: "Beat Lab dance template — anthem kick and lifts",
    pattern: grid([[0,3],[0,7],[0,10],[0,11],[0,15],[1,2],[1,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[4,2],[4,10],[5,2],[5,10]]),
  },
  {
    id: "dance-21", name: "Dance Glow Stick", genre: "Dance", role: 'drums' as const,
    desc: "Beat Lab dance template — anthem kick and lifts",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,0],[4,8]]),
  },
  {
    id: "dance-22", name: "Dance Mainstage", genre: "Dance", role: 'drums' as const,
    desc: "Beat Lab dance template — anthem kick and lifts",
    pattern: grid([[0,1],[0,5],[0,8],[0,9],[0,13],[1,2],[1,10],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,6],[4,14]]),
  },
  {
    id: "dance-23", name: "Dance Sidechain Pop", genre: "Dance", role: 'drums' as const,
    desc: "Beat Lab dance template — anthem kick and lifts",
    pattern: grid([[0,0],[0,4],[0,7],[0,8],[0,12],[2,2],[2,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[4,4],[4,12]]),
  },
  {
    id: "dance-24", name: "Dance Stadium Pop", genre: "Dance", role: 'drums' as const,
    desc: "Beat Lab dance template — anthem kick and lifts",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[1,2],[1,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[4,2],[4,10]]),
  },
  {
    id: "dance-25", name: "Dance Night Drive", genre: "Dance", role: 'drums' as const,
    desc: "Beat Lab dance template — anthem kick and lifts",
    pattern: grid([[0,2],[0,5],[0,6],[0,10],[0,14],[2,2],[2,10],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,0],[4,8],[5,2],[5,10]]),
  },
  {
    id: "dance-26", name: "Dance City Lights", genre: "Dance", role: 'drums' as const,
    desc: "Beat Lab dance template — anthem kick and lifts",
    pattern: grid([[0,1],[0,4],[0,5],[0,9],[0,13],[1,2],[1,10],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,6],[4,14]]),
  },
  {
    id: "dance-27", name: "Dance Skyline", genre: "Dance", role: 'drums' as const,
    desc: "Beat Lab dance template — anthem kick and lifts",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[4,4],[4,12]]),
  },
  {
    id: "dance-28", name: "Dance Coastline", genre: "Dance", role: 'drums' as const,
    desc: "Beat Lab dance template — anthem kick and lifts",
    pattern: grid([[0,2],[0,3],[0,7],[0,11],[0,15],[1,2],[1,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[4,2],[4,10]]),
  },
  {
    id: "dance-29", name: "Dance Waveform", genre: "Dance", role: 'drums' as const,
    desc: "Beat Lab dance template — anthem kick and lifts",
    pattern: grid([[0,1],[0,2],[0,6],[0,10],[0,14],[2,2],[2,10],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,0],[4,8]]),
  },
  {
    id: "dance-30", name: "Dance Pulse Line", genre: "Dance", role: 'drums' as const,
    desc: "Beat Lab dance template — anthem kick and lifts",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[1,2],[1,10],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,6],[4,14],[5,2],[5,10]]),
  },
  // ── Dance solid pack (+15) — kick ALWAYS on beat 1 (step 0) ────────────────
  {
    id: "dance-31", name: "Dance Solid Floor", genre: "Dance", role: 'drums' as const, bpm: 128,
    desc: "Solid dance floor — kick on 1, four-on-floor, clap offs, 8th hats, OH mid",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[4,4],[4,12]]),
  },
  {
    id: "dance-32", name: "Dance Anthem Thump", genre: "Dance", role: 'drums' as const, bpm: 130,
    desc: "Anthem thump — kick on 1, four floor, snare offs, full 16ths, OH lift",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[1,2],[1,10],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,6],[4,14]]),
  },
  {
    id: "dance-33", name: "Dance Club Pulse", genre: "Dance", role: 'drums' as const, bpm: 126,
    desc: "Club pulse — kick on 1, four floor, clap offs, 8ths, OH + tom lift",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[4,4],[4,12],[5,2],[5,10]]),
  },
  {
    id: "dance-34", name: "Dance Radio Solid", genre: "Dance", role: 'drums' as const, bpm: 128,
    desc: "Radio solid — kick on 1, four floor + late push, snare offs, 8ths, OH",
    pattern: grid([[0,0],[0,4],[0,8],[0,11],[0,12],[1,2],[1,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[4,2],[4,10]]),
  },
  {
    id: "dance-35", name: "Dance Chart Solid", genre: "Dance", role: 'drums' as const, bpm: 132,
    desc: "Chart solid — kick on 1, four floor, clap offs, full hats, OH downs",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,0],[4,8]]),
  },
  {
    id: "dance-36", name: "Dance Laser Solid", genre: "Dance", role: 'drums' as const, bpm: 129,
    desc: "Laser solid — kick on 1, four floor, snare offs, full 16ths, OH mid",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[1,2],[1,10],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,6],[4,14]]),
  },
  {
    id: "dance-37", name: "Dance Drop Solid", genre: "Dance", role: 'drums' as const, bpm: 127,
    desc: "Drop solid — kick on 1, four floor + late kick, clap offs, 8ths, OH",
    pattern: grid([[0,0],[0,4],[0,8],[0,11],[0,12],[2,2],[2,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[4,4],[4,12]]),
  },
  {
    id: "dance-38", name: "Dance Hyper Solid", genre: "Dance", role: 'drums' as const, bpm: 134,
    desc: "Hyper solid — kick on 1, four floor + & pushes, snare offs, 8ths, OH + tom",
    pattern: grid([[0,0],[0,4],[0,6],[0,8],[0,12],[0,14],[1,2],[1,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[4,2],[4,10],[5,2],[5,10]]),
  },
  {
    id: "dance-39", name: "Dance Glow Solid", genre: "Dance", role: 'drums' as const, bpm: 128,
    desc: "Glow solid — kick on 1, four floor, clap offs, full 16ths, OH downs",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,0],[4,8]]),
  },
  {
    id: "dance-40", name: "Dance Mainstage Solid", genre: "Dance", role: 'drums' as const, bpm: 131,
    desc: "Mainstage solid — kick on 1, four floor + push, snare offs, full hats, OH mid",
    pattern: grid([[0,0],[0,4],[0,8],[0,9],[0,12],[1,2],[1,10],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,6],[4,14]]),
  },
  {
    id: "dance-41", name: "Dance Sidechain Solid", genre: "Dance", role: 'drums' as const, bpm: 126,
    desc: "Sidechain solid — kick on 1, four floor + & of 2, clap offs, 8ths, OH",
    pattern: grid([[0,0],[0,4],[0,7],[0,8],[0,12],[2,2],[2,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[4,4],[4,12]]),
  },
  {
    id: "dance-42", name: "Dance Stadium Solid", genre: "Dance", role: 'drums' as const, bpm: 129,
    desc: "Stadium solid — kick on 1, four floor, snare offs, 8ths, OH lift",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[1,2],[1,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[4,2],[4,10]]),
  },
  {
    id: "dance-43", name: "Dance Night Solid", genre: "Dance", role: 'drums' as const, bpm: 130,
    desc: "Night drive solid — kick on 1, four floor + sync pushes, clap, full 16ths, OH + tom",
    pattern: grid([[0,0],[0,4],[0,6],[0,8],[0,10],[0,12],[2,2],[2,10],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,0],[4,8],[5,2],[5,10]]),
  },
  {
    id: "dance-44", name: "Dance City Solid", genre: "Dance", role: 'drums' as const, bpm: 128,
    desc: "City lights solid — kick on 1, four floor + push, snare offs, full hats, OH mid",
    pattern: grid([[0,0],[0,4],[0,5],[0,8],[0,12],[1,2],[1,10],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,6],[4,14]]),
  },
  {
    id: "dance-45", name: "Dance Forever Floor", genre: "Dance", role: 'drums' as const, bpm: 128,
    desc: "Forever floor — kick on 1, four-on-floor, clap offs, 8ths, OH mid + tom",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[4,4],[4,12],[5,2],[5,10]]),
  },
  {
    id: "techno-1", name: "Techno Berlin 1", genre: "Techno", role: 'drums' as const,
    desc: "Beat Lab techno template — minimal kick loop with perc detail",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,0],[4,8],[5,8],[7,1],[7,9],[7,15]]),
  },
  {
    id: "techno-2", name: "Techno Berlin 2", genre: "Techno", role: 'drums' as const,
    desc: "Beat Lab techno template — minimal kick loop with perc detail",
    pattern: grid([[0,2],[0,6],[0,10],[0,14],[2,2],[2,10],[3,1],[3,2],[3,4],[3,6],[3,7],[3,9],[3,11],[3,12],[3,14],[3,15],[4,4],[4,12],[7,0],[7,8],[7,14]]),
  },
  {
    id: "techno-3", name: "Techno Warehouse Acid", genre: "Techno", role: 'drums' as const,
    desc: "Beat Lab techno template — minimal kick loop with perc detail",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,0],[4,8],[7,7],[7,13],[7,15]]),
  },
  {
    id: "techno-4", name: "Techno Loop Drive", genre: "Techno", role: 'drums' as const,
    desc: "Beat Lab techno template — minimal kick loop with perc detail",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[3,0],[3,2],[3,4],[3,5],[3,7],[3,9],[3,10],[3,12],[3,13],[3,15],[4,4],[4,12],[7,6],[7,12],[7,14]]),
  },
  {
    id: "techno-5", name: "Techno Hi-Hat March", genre: "Techno", role: 'drums' as const,
    desc: "Beat Lab techno template — minimal kick loop with perc detail",
    pattern: grid([[0,2],[0,6],[0,10],[0,14],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,0],[4,8],[7,5],[7,11],[7,13]]),
  },
  {
    id: "techno-6", name: "Techno Open Hat Tribe", genre: "Techno", role: 'drums' as const,
    desc: "Beat Lab techno template — minimal kick loop with perc detail",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[3,0],[3,2],[3,3],[3,5],[3,7],[3,8],[3,10],[3,11],[3,13],[3,14],[4,4],[4,12],[7,4],[7,10],[7,12]]),
  },
  {
    id: "techno-7", name: "Techno Rim Tribe", genre: "Techno", role: 'drums' as const,
    desc: "Beat Lab techno template — minimal kick loop with perc detail",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,0],[4,8],[7,3],[7,9],[7,11]]),
  },
  {
    id: "techno-8", name: "Techno Tom Minimal", genre: "Techno", role: 'drums' as const,
    desc: "Beat Lab techno template — minimal kick loop with perc detail",
    pattern: grid([[0,2],[0,6],[0,10],[0,14],[3,0],[3,1],[3,3],[3,5],[3,6],[3,8],[3,9],[3,11],[3,12],[3,14],[4,4],[4,12],[5,8],[7,2],[7,8],[7,10]]),
  },
  {
    id: "techno-9", name: "Techno Clap Tribe", genre: "Techno", role: 'drums' as const,
    desc: "Beat Lab techno template — minimal kick loop with perc detail",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,0],[4,8],[7,1],[7,7],[7,9]]),
  },
  {
    id: "techno-10", name: "Techno Filter Tribe", genre: "Techno", role: 'drums' as const,
    desc: "Beat Lab techno template — minimal kick loop with perc detail",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[3,1],[3,3],[3,4],[3,6],[3,7],[3,9],[3,10],[3,12],[3,14],[3,15],[4,4],[4,12],[7,0],[7,6],[7,8]]),
  },
  {
    id: "techno-11", name: "Techno Peak Techno", genre: "Techno", role: 'drums' as const,
    desc: "Beat Lab techno template — minimal kick loop with perc detail",
    pattern: grid([[0,2],[0,6],[0,10],[0,14],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,0],[4,8],[7,5],[7,7],[7,15]]),
  },
  {
    id: "techno-12", name: "Techno Afterhours", genre: "Techno", role: 'drums' as const,
    desc: "Beat Lab techno template — minimal kick loop with perc detail",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,1],[3,2],[3,4],[3,5],[3,7],[3,8],[3,10],[3,12],[3,13],[3,15],[4,4],[4,12],[7,4],[7,6],[7,14]]),
  },
  {
    id: "techno-13", name: "Techno Strobe Minimal", genre: "Techno", role: 'drums' as const,
    desc: "Beat Lab techno template — minimal kick loop with perc detail",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,0],[4,8],[7,3],[7,5],[7,13]]),
  },
  {
    id: "techno-14", name: "Techno Concrete", genre: "Techno", role: 'drums' as const,
    desc: "Beat Lab techno template — minimal kick loop with perc detail",
    pattern: grid([[0,2],[0,6],[0,10],[0,14],[3,0],[3,2],[3,3],[3,5],[3,6],[3,8],[3,10],[3,11],[3,13],[3,15],[4,4],[4,12],[7,2],[7,4],[7,12]]),
  },
  {
    id: "techno-15", name: "Techno Industrial Step", genre: "Techno", role: 'drums' as const,
    desc: "Beat Lab techno template — minimal kick loop with perc detail",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,0],[4,8],[5,8],[7,1],[7,3],[7,11]]),
  },
  {
    id: "techno-16", name: "Techno Pulse Nation", genre: "Techno", role: 'drums' as const,
    desc: "Beat Lab techno template — minimal kick loop with perc detail",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[3,0],[3,1],[3,3],[3,4],[3,6],[3,8],[3,9],[3,11],[3,13],[3,14],[4,4],[4,12],[7,0],[7,2],[7,10]]),
  },
  {
    id: "techno-17", name: "Techno Drive Nation", genre: "Techno", role: 'drums' as const,
    desc: "Beat Lab techno template — minimal kick loop with perc detail",
    pattern: grid([[0,2],[0,6],[0,10],[0,14],[2,2],[2,10],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,0],[4,8],[7,1],[7,9],[7,15]]),
  },
  {
    id: "techno-18", name: "Techno Tribe Nation", genre: "Techno", role: 'drums' as const,
    desc: "Beat Lab techno template — minimal kick loop with perc detail",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[3,1],[3,2],[3,4],[3,6],[3,7],[3,9],[3,11],[3,12],[3,14],[3,15],[4,4],[4,12],[7,0],[7,8],[7,14]]),
  },
  {
    id: "techno-19", name: "Techno Rim Nation", genre: "Techno", role: 'drums' as const,
    desc: "Beat Lab techno template — minimal kick loop with perc detail",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,0],[4,8],[7,7],[7,13],[7,15]]),
  },
  {
    id: "techno-20", name: "Techno Tom Nation", genre: "Techno", role: 'drums' as const,
    desc: "Beat Lab techno template — minimal kick loop with perc detail",
    pattern: grid([[0,2],[0,6],[0,10],[0,14],[3,0],[3,2],[3,4],[3,5],[3,7],[3,9],[3,10],[3,12],[3,13],[3,15],[4,4],[4,12],[7,6],[7,12],[7,14]]),
  },
  {
    id: "techno-21", name: "Techno Acid Whisper", genre: "Techno", role: 'drums' as const,
    desc: "Beat Lab techno template — minimal kick loop with perc detail",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,0],[4,8],[7,5],[7,11],[7,13]]),
  },
  {
    id: "techno-22", name: "Techno Acid Punch", genre: "Techno", role: 'drums' as const,
    desc: "Beat Lab techno template — minimal kick loop with perc detail",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,0],[3,2],[3,3],[3,5],[3,7],[3,8],[3,10],[3,11],[3,13],[3,14],[4,4],[4,12],[5,8],[7,4],[7,10],[7,12]]),
  },
  {
    id: "techno-23", name: "Techno Detroit Tilt", genre: "Techno", role: 'drums' as const,
    desc: "Beat Lab techno template — minimal kick loop with perc detail",
    pattern: grid([[0,2],[0,6],[0,10],[0,14],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,0],[4,8],[7,3],[7,9],[7,11]]),
  },
  {
    id: "techno-24", name: "Techno Motor City", genre: "Techno", role: 'drums' as const,
    desc: "Beat Lab techno template — minimal kick loop with perc detail",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[3,0],[3,1],[3,3],[3,5],[3,6],[3,8],[3,9],[3,11],[3,12],[3,14],[4,4],[4,12],[7,2],[7,8],[7,10]]),
  },
  {
    id: "techno-25", name: "Techno Grid Lock", genre: "Techno", role: 'drums' as const,
    desc: "Beat Lab techno template — minimal kick loop with perc detail",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,0],[4,8],[7,1],[7,7],[7,9]]),
  },
  {
    id: "techno-26", name: "Techno Smoke Stack", genre: "Techno", role: 'drums' as const,
    desc: "Beat Lab techno template — minimal kick loop with perc detail",
    pattern: grid([[0,2],[0,6],[0,10],[0,14],[3,1],[3,3],[3,4],[3,6],[3,7],[3,9],[3,10],[3,12],[3,14],[3,15],[4,4],[4,12],[7,0],[7,6],[7,8]]),
  },
  {
    id: "techno-27", name: "Techno Red Light", genre: "Techno", role: 'drums' as const,
    desc: "Beat Lab techno template — minimal kick loop with perc detail",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,0],[4,8],[7,5],[7,7],[7,15]]),
  },
  {
    id: "techno-28", name: "Techno Blue Hour", genre: "Techno", role: 'drums' as const,
    desc: "Beat Lab techno template — minimal kick loop with perc detail",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[3,1],[3,2],[3,4],[3,5],[3,7],[3,8],[3,10],[3,12],[3,13],[3,15],[4,4],[4,12],[7,4],[7,6],[7,14]]),
  },
  {
    id: "techno-29", name: "Techno 4AM Floor", genre: "Techno", role: 'drums' as const,
    desc: "Beat Lab techno template — minimal kick loop with perc detail",
    pattern: grid([[0,2],[0,6],[0,10],[0,14],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,0],[4,8],[5,8],[7,3],[7,5],[7,13]]),
  },
  {
    id: "techno-30", name: "Techno Techno Forever", genre: "Techno", role: 'drums' as const,
    desc: "Beat Lab techno template — minimal kick loop with perc detail",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[3,0],[3,2],[3,3],[3,5],[3,6],[3,8],[3,10],[3,11],[3,13],[3,15],[4,4],[4,12],[7,2],[7,4],[7,12]]),
  },
  // ── Techno solid pack (+25) — four-on-floor + hat/OH/rim/clap variants ────
  {
    id: "techno-31", name: "Techno Solid Floor", genre: "Techno", role: 'drums' as const, bpm: 130,
    desc: "Solid four-on-floor — kick lock, full 16th hats, OH on 1 & 3, rim ticks",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,0],[4,8],[7,2],[7,6],[7,10],[7,14]]),
  },
  {
    id: "techno-32", name: "Techno Hard Pulse", genre: "Techno", role: 'drums' as const, bpm: 132,
    desc: "Hard pulse — four floor, offbeat clap, marching hats, OH mid",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[4,4],[4,12],[7,1],[7,9]]),
  },
  {
    id: "techno-33", name: "Techno Warehouse Thump", genre: "Techno", role: 'drums' as const, bpm: 128,
    desc: "Warehouse thump — four floor, dense hats, OH downs, tom on 3",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,0],[4,8],[5,8],[7,3],[7,11]]),
  },
  {
    id: "techno-34", name: "Techno Offbeat Drive", genre: "Techno", role: 'drums' as const, bpm: 134,
    desc: "Offbeat kick drive — &s only, sparse hats, OH lift, rim push",
    pattern: grid([[0,2],[0,6],[0,10],[0,14],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[4,4],[4,12],[7,0],[7,8],[7,12]]),
  },
  {
    id: "techno-35", name: "Techno Berlin Solid", genre: "Techno", role: 'drums' as const, bpm: 130,
    desc: "Berlin solid — four floor, full hats, OH 1·3, clap offs",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,0],[4,8],[7,5],[7,13]]),
  },
  {
    id: "techno-36", name: "Techno Acid Floor", genre: "Techno", role: 'drums' as const, bpm: 133,
    desc: "Acid floor — four kick, skipping hats, OH mid, rim chatter",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[3,0],[3,2],[3,3],[3,5],[3,7],[3,8],[3,10],[3,11],[3,13],[3,15],[4,4],[4,12],[7,1],[7,6],[7,9],[7,14]]),
  },
  {
    id: "techno-37", name: "Techno Peak Drive", genre: "Techno", role: 'drums' as const, bpm: 136,
    desc: "Peak-time drive — offbeat kicks, full hats, OH downs, clap layer",
    pattern: grid([[0,2],[0,6],[0,10],[0,14],[2,2],[2,10],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,0],[4,8],[7,4],[7,12]]),
  },
  {
    id: "techno-38", name: "Techno Minimal Knock", genre: "Techno", role: 'drums' as const, bpm: 126,
    desc: "Minimal knock — four floor, light 8ths, OH sparse, rim ghosts",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[3,0],[3,4],[3,8],[3,12],[4,8],[7,2],[7,6],[7,10],[7,14]]),
  },
  {
    id: "techno-39", name: "Techno Industrial Thump", genre: "Techno", role: 'drums' as const, bpm: 131,
    desc: "Industrial thump — four floor, dense hats, OH, tom + rim",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,0],[4,8],[5,8],[7,1],[7,7],[7,9],[7,15]]),
  },
  {
    id: "techno-40", name: "Techno Loop Solid", genre: "Techno", role: 'drums' as const, bpm: 129,
    desc: "Loop solid — four floor, skip-hat pocket, OH mid, rim offs",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[3,0],[3,2],[3,4],[3,5],[3,7],[3,9],[3,10],[3,12],[3,13],[3,15],[4,4],[4,12],[7,3],[7,11],[7,14]]),
  },
  {
    id: "techno-41", name: "Techno Strobe Floor", genre: "Techno", role: 'drums' as const, bpm: 135,
    desc: "Strobe floor — four kick, full hats, OH 1·3, sharp rim",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,0],[4,8],[7,2],[7,8],[7,10]]),
  },
  {
    id: "techno-42", name: "Techno Concrete Pulse", genre: "Techno", role: 'drums' as const, bpm: 132,
    desc: "Concrete pulse — offbeat kick, sparse hats, OH mid, rim ticks",
    pattern: grid([[0,2],[0,6],[0,10],[0,14],[3,0],[3,2],[3,3],[3,5],[3,6],[3,8],[3,10],[3,11],[3,13],[3,15],[4,4],[4,12],[7,1],[7,7],[7,13]]),
  },
  {
    id: "techno-43", name: "Techno Afterhours Solid", genre: "Techno", role: 'drums' as const, bpm: 127,
    desc: "Afterhours solid — four floor, clap offs, skip hats, OH mid",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,1],[3,2],[3,4],[3,5],[3,7],[3,8],[3,10],[3,12],[3,13],[3,15],[4,4],[4,12],[7,0],[7,8]]),
  },
  {
    id: "techno-44", name: "Techno Motor Drive", genre: "Techno", role: 'drums' as const, bpm: 134,
    desc: "Motor City drive — four floor, light hats, OH mid, rim chatter",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[3,0],[3,1],[3,3],[3,5],[3,6],[3,8],[3,9],[3,11],[3,12],[3,14],[4,4],[4,12],[7,2],[7,6],[7,10],[7,14]]),
  },
  {
    id: "techno-45", name: "Techno Grid Solid", genre: "Techno", role: 'drums' as const, bpm: 130,
    desc: "Grid solid — four floor, full 16ths, OH downs, rim lock",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,0],[4,8],[7,1],[7,5],[7,9],[7,13]]),
  },
  {
    id: "techno-46", name: "Techno Smoke Floor", genre: "Techno", role: 'drums' as const, bpm: 128,
    desc: "Smoke floor — offbeat kick, skip hats, OH mid, rim offs",
    pattern: grid([[0,2],[0,6],[0,10],[0,14],[3,1],[3,3],[3,4],[3,6],[3,7],[3,9],[3,10],[3,12],[3,14],[3,15],[4,4],[4,12],[7,0],[7,8],[7,12]]),
  },
  {
    id: "techno-47", name: "Techno Red Floor", genre: "Techno", role: 'drums' as const, bpm: 133,
    desc: "Red light floor — four kick, clap offs, full hats, OH 1·3",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,10],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,0],[4,8],[7,4],[7,12],[7,15]]),
  },
  {
    id: "techno-48", name: "Techno Blue Pulse", genre: "Techno", role: 'drums' as const, bpm: 129,
    desc: "Blue hour pulse — four floor, skip hats, OH mid, rim push",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[3,1],[3,2],[3,4],[3,5],[3,7],[3,8],[3,10],[3,12],[3,13],[3,15],[4,4],[4,12],[7,3],[7,7],[7,11]]),
  },
  {
    id: "techno-49", name: "Techno 4AM Solid", genre: "Techno", role: 'drums' as const, bpm: 131,
    desc: "4AM solid — offbeat kick, full hats, OH downs, tom + rim",
    pattern: grid([[0,2],[0,6],[0,10],[0,14],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,0],[4,8],[5,8],[7,2],[7,10]]),
  },
  {
    id: "techno-50", name: "Techno Forever Floor", genre: "Techno", role: 'drums' as const, bpm: 132,
    desc: "Forever floor — four kick, skip hats, OH mid, rim ticks",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[3,0],[3,2],[3,3],[3,5],[3,6],[3,8],[3,10],[3,11],[3,13],[3,15],[4,4],[4,12],[7,1],[7,5],[7,9],[7,13]]),
  },
  {
    id: "techno-51", name: "Techno Tribe Solid", genre: "Techno", role: 'drums' as const, bpm: 135,
    desc: "Tribe solid — four floor, open-hat mid, skip closed hats, rim",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[3,0],[3,2],[3,3],[3,5],[3,7],[3,8],[3,10],[3,11],[3,13],[3,14],[4,4],[4,12],[7,2],[7,6],[7,10],[7,14]]),
  },
  {
    id: "techno-52", name: "Techno Clap Drive", genre: "Techno", role: 'drums' as const, bpm: 134,
    desc: "Clap drive — four floor, clap offs, full hats, OH downs",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[2,2],[2,6],[2,10],[2,14],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,0],[4,8],[7,4],[7,12]]),
  },
  {
    id: "techno-53", name: "Techno Rim March", genre: "Techno", role: 'drums' as const, bpm: 130,
    desc: "Rim march — four floor, full hats, OH 1·3, marching rim",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,0],[4,8],[7,0],[7,4],[7,8],[7,12]]),
  },
  {
    id: "techno-54", name: "Techno Filter Solid", genre: "Techno", role: 'drums' as const, bpm: 128,
    desc: "Filter solid — four floor, sparse hats, OH mid, rim offs",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[3,1],[3,3],[3,4],[3,6],[3,7],[3,9],[3,10],[3,12],[3,14],[3,15],[4,4],[4,12],[7,2],[7,8],[7,14]]),
  },
  {
    id: "techno-55", name: "Techno Peak Solid", genre: "Techno", role: 'drums' as const, bpm: 137,
    desc: "Peak solid — offbeat kick, full hats, OH downs, clap + rim",
    pattern: grid([[0,2],[0,6],[0,10],[0,14],[2,2],[2,10],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[4,0],[4,8],[7,5],[7,11],[7,15]]),
  },
];
