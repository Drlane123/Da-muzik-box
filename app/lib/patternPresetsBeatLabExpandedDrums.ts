/**
 * Expanded Beat Lab drum templates.
 * REGENERATE: `node scripts/gen-beatlab-expanded-drums.mjs`
 *
 * Structural match for {@link import('./patternPresets').PatternPreset} without importing patternPresets
 * (avoids circular deps). Imported by patternPresets.ts into DRUM_PRESETS.
 */

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
    desc: "Beat Lab R&B template — pocket kick and backbeat, airy hats",
    pattern: grid([[0,0],[0,8],[1,2],[1,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[7,4],[7,12]]),
    bpm: 76,
  },
  {
    id: "rnb-17", name: "R&B Candle Glow", genre: "R&B", role: 'drums' as const,
    desc: "Beat Lab R&B template — pocket kick and backbeat, airy hats",
    pattern: grid([[0,2],[0,12],[0,14],[1,2],[1,10],[3,1],[3,3],[3,5],[3,7],[3,9],[3,11],[3,13],[7,6],[7,12]]),
    bpm: 78,
  },
  {
    id: "rnb-18", name: "R&B Uptown Step", genre: "R&B", role: 'drums' as const,
    desc: "Beat Lab R&B template — pocket kick and backbeat, airy hats",
    pattern: grid([[0,2],[0,10],[0,12],[1,2],[1,10],[3,0],[3,4],[3,6],[3,10],[3,12],[3,14],[7,4],[7,12]]),
  },
  {
    id: "rnb-19", name: "R&B Silk Pillow", genre: "R&B", role: 'drums' as const,
    desc: "Beat Lab R&B template — pocket kick and backbeat, airy hats",
    pattern: grid([[0,6],[0,10],[0,14],[1,2],[1,10],[3,1],[3,3],[3,5],[3,7],[3,9],[3,11],[3,13],[3,15],[7,6],[7,12]]),
  },
  {
    id: "rnb-20", name: "R&B 3AM Text", genre: "R&B", role: 'drums' as const,
    desc: "Beat Lab R&B template — pocket kick and backbeat, airy hats",
    pattern: grid([[0,0],[0,8],[1,2],[1,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,14],[7,4],[7,12]]),
  },
  {
    id: "rnb-21", name: "R&B Smooth Operator", genre: "R&B", role: 'drums' as const,
    desc: "Beat Lab R&B template — pocket kick and backbeat, airy hats",
    pattern: grid([[0,4],[0,6],[0,10],[1,2],[1,10],[3,1],[3,3],[3,7],[3,9],[3,11],[3,13],[7,6],[7,12]]),
  },
  {
    id: "rnb-22", name: "R&B Champagne Mist", genre: "R&B", role: 'drums' as const,
    desc: "Beat Lab R&B template — pocket kick and backbeat, airy hats",
    pattern: grid([[0,2],[0,4],[0,10],[1,2],[1,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[7,4],[7,12]]),
  },
  {
    id: "rnb-23", name: "R&B Loft Session", genre: "R&B", role: 'drums' as const,
    desc: "Beat Lab R&B template — pocket kick and backbeat, airy hats",
    pattern: grid([[0,2],[0,6],[0,14],[1,2],[1,10],[3,1],[3,3],[3,5],[3,7],[3,11],[3,13],[3,15],[7,6],[7,12]]),
    bpm: 76,
  },
  {
    id: "rnb-24", name: "R&B Afterparty", genre: "R&B", role: 'drums' as const,
    desc: "Beat Lab R&B template — pocket kick and backbeat, airy hats",
    pattern: grid([[0,0],[0,8],[1,2],[1,10],[3,0],[3,4],[3,6],[3,8],[3,10],[3,14],[7,4],[7,12]]),
    bpm: 78,
  },
  {
    id: "rnb-25", name: "R&B Neon Pillow", genre: "R&B", role: 'drums' as const,
    desc: "Beat Lab R&B template — pocket kick and backbeat, airy hats",
    pattern: grid([[0,2],[0,12],[0,14],[1,2],[1,10],[3,1],[3,3],[3,5],[3,7],[3,9],[3,11],[3,13],[3,15],[7,6],[7,12]]),
  },
  {
    id: "rnb-26", name: "R&B Slow Burn", genre: "R&B", role: 'drums' as const,
    desc: "Beat Lab R&B template — pocket kick and backbeat, airy hats",
    pattern: grid([[0,2],[0,10],[0,12],[1,2],[1,10],[3,0],[3,2],[3,4],[3,8],[3,10],[3,12],[3,14],[7,4],[7,12]]),
  },
  {
    id: "rnb-27", name: "R&B Two Step Bliss", genre: "R&B", role: 'drums' as const,
    desc: "Beat Lab R&B template — pocket kick and backbeat, airy hats",
    pattern: grid([[0,6],[0,10],[0,14],[1,2],[1,10],[3,1],[3,3],[3,5],[3,7],[3,11],[3,13],[7,6],[7,12]]),
  },
  {
    id: "rnb-28", name: "R&B High Rise Mood", genre: "R&B", role: 'drums' as const,
    desc: "Beat Lab R&B template — pocket kick and backbeat, airy hats",
    pattern: grid([[0,0],[0,8],[1,2],[1,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[7,4],[7,12]]),
  },
  {
    id: "rnb-29", name: "R&B Satin Glide", genre: "R&B", role: 'drums' as const,
    desc: "Beat Lab R&B template — pocket kick and backbeat, airy hats",
    pattern: grid([[0,4],[0,6],[0,10],[1,2],[1,10],[3,1],[3,5],[3,7],[3,9],[3,11],[3,13],[3,15],[7,6],[7,12]]),
  },
  {
    id: "rnb-30", name: "R&B City Rain", genre: "R&B", role: 'drums' as const,
    desc: "Beat Lab R&B template — pocket kick and backbeat, airy hats",
    pattern: grid([[0,2],[0,4],[0,10],[1,2],[1,10],[3,0],[3,2],[3,4],[3,8],[3,10],[3,14],[7,4],[7,12]]),
    bpm: 76,
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
  {
    id: "disco-3", name: "Disco Mirror Ball A", genre: "Disco", role: 'drums' as const,
    desc: "Beat Lab disco template — driving kick and shimmering hats",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[1,2],[1,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[4,2],[4,6],[4,10],[4,14],[7,4],[7,12]]),
  },
  {
    id: "disco-4", name: "Disco Mirror Ball B", genre: "Disco", role: 'drums' as const,
    desc: "Beat Lab disco template — driving kick and shimmering hats",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[1,2],[1,10],[3,1],[3,3],[3,5],[3,7],[3,9],[3,11],[3,13],[3,15],[4,3],[4,7],[4,11],[4,15]]),
  },
  {
    id: "disco-5", name: "Disco Boogie Down", genre: "Disco", role: 'drums' as const,
    desc: "Beat Lab disco template — driving kick and shimmering hats",
    pattern: grid([[0,0],[0,4],[0,6],[0,8],[0,12],[1,2],[1,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[4,0],[4,4],[4,8],[4,12]]),
  },
  {
    id: "disco-6", name: "Disco Roller Rink", genre: "Disco", role: 'drums' as const,
    desc: "Beat Lab disco template — driving kick and shimmering hats",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[1,2],[1,10],[3,1],[3,3],[3,5],[3,7],[3,9],[3,11],[3,13],[3,15],[4,1],[4,5],[4,9],[4,13]]),
  },
  {
    id: "disco-7", name: "Disco Saturday Night", genre: "Disco", role: 'drums' as const,
    desc: "Beat Lab disco template — driving kick and shimmering hats",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[1,2],[1,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[4,2],[4,6],[4,10],[4,14],[7,4],[7,12]]),
  },
  {
    id: "disco-8", name: "Disco Studio 54 Vibe", genre: "Disco", role: 'drums' as const,
    desc: "Beat Lab disco template — driving kick and shimmering hats",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[1,2],[1,10],[3,1],[3,3],[3,5],[3,7],[3,9],[3,11],[3,13],[3,15],[4,3],[4,7],[4,11],[4,15]]),
  },
  {
    id: "disco-9", name: "Disco Glitter Floor", genre: "Disco", role: 'drums' as const,
    desc: "Beat Lab disco template — driving kick and shimmering hats",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[1,2],[1,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[4,0],[4,4],[4,8],[4,12]]),
  },
  {
    id: "disco-10", name: "Disco Hi-NRG Step", genre: "Disco", role: 'drums' as const,
    desc: "Beat Lab disco template — driving kick and shimmering hats",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[1,2],[1,10],[3,1],[3,3],[3,5],[3,7],[3,9],[3,11],[3,13],[3,15],[4,1],[4,5],[4,9],[4,13]]),
  },
  {
    id: "disco-11", name: "Disco Four On Chic", genre: "Disco", role: 'drums' as const,
    desc: "Beat Lab disco template — driving kick and shimmering hats",
    pattern: grid([[0,0],[0,4],[0,6],[0,8],[0,12],[1,2],[1,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[4,2],[4,6],[4,10],[4,14],[7,4],[7,12]]),
  },
  {
    id: "disco-12", name: "Disco Open Hat Chic", genre: "Disco", role: 'drums' as const,
    desc: "Beat Lab disco template — driving kick and shimmering hats",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[1,2],[1,10],[3,1],[3,3],[3,5],[3,7],[3,9],[3,11],[3,13],[3,15],[4,3],[4,7],[4,11],[4,15]]),
  },
  {
    id: "disco-13", name: "Disco Shimmer Step", genre: "Disco", role: 'drums' as const,
    desc: "Beat Lab disco template — driving kick and shimmering hats",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[1,2],[1,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[4,0],[4,4],[4,8],[4,12]]),
  },
  {
    id: "disco-14", name: "Disco Bridge Tunnel", genre: "Disco", role: 'drums' as const,
    desc: "Beat Lab disco template — driving kick and shimmering hats",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[1,2],[1,10],[3,1],[3,3],[3,5],[3,7],[3,9],[3,11],[3,13],[3,15],[4,1],[4,5],[4,9],[4,13]]),
  },
  {
    id: "disco-15", name: "Disco Uptown Boogie", genre: "Disco", role: 'drums' as const,
    desc: "Beat Lab disco template — driving kick and shimmering hats",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[1,2],[1,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[4,2],[4,6],[4,10],[4,14],[7,4],[7,12]]),
  },
  {
    id: "disco-16", name: "Disco Sunset Skate", genre: "Disco", role: 'drums' as const,
    desc: "Beat Lab disco template — driving kick and shimmering hats",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[1,2],[1,10],[3,1],[3,3],[3,5],[3,7],[3,9],[3,11],[3,13],[3,15],[4,3],[4,7],[4,11],[4,15]]),
  },
  {
    id: "disco-17", name: "Disco Chrome Skate", genre: "Disco", role: 'drums' as const,
    desc: "Beat Lab disco template — driving kick and shimmering hats",
    pattern: grid([[0,0],[0,4],[0,6],[0,8],[0,12],[1,2],[1,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[4,0],[4,4],[4,8],[4,12]]),
  },
  {
    id: "disco-18", name: "Disco Vinyl Chic", genre: "Disco", role: 'drums' as const,
    desc: "Beat Lab disco template — driving kick and shimmering hats",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[1,2],[1,10],[3,1],[3,3],[3,5],[3,7],[3,9],[3,11],[3,13],[3,15],[4,1],[4,5],[4,9],[4,13]]),
  },
  {
    id: "disco-19", name: "Disco Dancefloor Gold", genre: "Disco", role: 'drums' as const,
    desc: "Beat Lab disco template — driving kick and shimmering hats",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[1,2],[1,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[4,2],[4,6],[4,10],[4,14],[7,4],[7,12]]),
  },
  {
    id: "disco-20", name: "Disco Classic Chic", genre: "Disco", role: 'drums' as const,
    desc: "Beat Lab disco template — driving kick and shimmering hats",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[1,2],[1,10],[3,1],[3,3],[3,5],[3,7],[3,9],[3,11],[3,13],[3,15],[4,3],[4,7],[4,11],[4,15]]),
  },
  {
    id: "disco-21", name: "Disco Night Chic", genre: "Disco", role: 'drums' as const,
    desc: "Beat Lab disco template — driving kick and shimmering hats",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[1,2],[1,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[4,0],[4,4],[4,8],[4,12]]),
  },
  {
    id: "disco-22", name: "Disco Gold Chic", genre: "Disco", role: 'drums' as const,
    desc: "Beat Lab disco template — driving kick and shimmering hats",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[1,2],[1,10],[3,1],[3,3],[3,5],[3,7],[3,9],[3,11],[3,13],[3,15],[4,1],[4,5],[4,9],[4,13]]),
  },
  {
    id: "disco-23", name: "Disco Silver Chic", genre: "Disco", role: 'drums' as const,
    desc: "Beat Lab disco template — driving kick and shimmering hats",
    pattern: grid([[0,0],[0,4],[0,6],[0,8],[0,12],[1,2],[1,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[4,2],[4,6],[4,10],[4,14],[7,4],[7,12]]),
  },
  {
    id: "disco-24", name: "Disco Disco Nap", genre: "Disco", role: 'drums' as const,
    desc: "Beat Lab disco template — driving kick and shimmering hats",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[1,2],[1,10],[3,1],[3,3],[3,5],[3,7],[3,9],[3,11],[3,13],[3,15],[4,3],[4,7],[4,11],[4,15]]),
  },
  {
    id: "disco-25", name: "Disco Disco Peak", genre: "Disco", role: 'drums' as const,
    desc: "Beat Lab disco template — driving kick and shimmering hats",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[1,2],[1,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[4,0],[4,4],[4,8],[4,12]]),
  },
  {
    id: "disco-26", name: "Disco Disco Lift", genre: "Disco", role: 'drums' as const,
    desc: "Beat Lab disco template — driving kick and shimmering hats",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[1,2],[1,10],[3,1],[3,3],[3,5],[3,7],[3,9],[3,11],[3,13],[3,15],[4,1],[4,5],[4,9],[4,13]]),
  },
  {
    id: "disco-27", name: "Disco Disco Drive", genre: "Disco", role: 'drums' as const,
    desc: "Beat Lab disco template — driving kick and shimmering hats",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[1,2],[1,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[4,2],[4,6],[4,10],[4,14],[7,4],[7,12]]),
  },
  {
    id: "disco-28", name: "Disco Disco Bloom", genre: "Disco", role: 'drums' as const,
    desc: "Beat Lab disco template — driving kick and shimmering hats",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[1,2],[1,10],[3,1],[3,3],[3,5],[3,7],[3,9],[3,11],[3,13],[3,15],[4,3],[4,7],[4,11],[4,15]]),
  },
  {
    id: "disco-29", name: "Disco Disco Heat", genre: "Disco", role: 'drums' as const,
    desc: "Beat Lab disco template — driving kick and shimmering hats",
    pattern: grid([[0,0],[0,4],[0,6],[0,8],[0,12],[1,2],[1,10],[3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],[4,0],[4,4],[4,8],[4,12]]),
  },
  {
    id: "disco-30", name: "Disco Disco BloomPlus", genre: "Disco", role: 'drums' as const,
    desc: "Beat Lab disco template — driving kick and shimmering hats",
    pattern: grid([[0,0],[0,4],[0,8],[0,12],[1,2],[1,10],[3,1],[3,3],[3,5],[3,7],[3,9],[3,11],[3,13],[3,15],[4,1],[4,5],[4,9],[4,13]]),
  },
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
];
