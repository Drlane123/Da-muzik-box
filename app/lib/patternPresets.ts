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
}

// ─────────────────────────────────────────────────────────────────────────────
// DRUM PRESETS  (R0=Kick R1=Snare R2=Clap R3=HiHat R4=OpenHat R5=TomHi R6=TomLo R7=Rim)
// ─────────────────────────────────────────────────────────────────────────────

const DRUM_PRESETS: PatternPreset[] = [

  // ══ TRAP ══════════════════════════════════════════════════════════════════
  {
    id: 'trap-1', name: 'Trap 808 Classic', genre: 'Trap', role: 'drums',
    desc: 'Kick 1 & 2.5, 808 clap on 2 & 4, 16th-note hats, open hat on the &',
    pattern: grid([
      [0,0],[0,6],[0,10],[0,14],           // Kick
      [2,4],[2,12],                         // Clap
      [3,0],[3,1],[3,2],[3,3],[3,4],[3,5],  // Hat 16ths
      [3,6],[3,7],[3,8],[3,9],[3,10],[3,11],
      [3,12],[3,13],[3,14],[3,15],
      [4,6],[4,14],                         // Open hat on & of 2 & 4
    ]),
  },
  {
    id: 'trap-2', name: 'Trap Skippy 808', genre: 'Trap', role: 'drums',
    desc: 'Double-kick roll at bar end, triplet clap, hat rolls on 15 & 16',
    pattern: grid([
      [0,0],[0,8],[0,13],[0,15],
      [2,4],[2,12],
      [3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,13],[3,14],[3,15],
      [4,10],[4,14],
    ]),
  },
  {
    id: 'trap-3', name: 'Trap Half-Time', genre: 'Trap', role: 'drums',
    desc: 'Half-time: clap only on beat 3, rolling kick, busy hi-hat with open accent',
    pattern: grid([
      [0,0],[0,5],[0,9],[0,14],
      [2,8],                                // Half-time clap on beat 3 only
      [3,0],[3,1],[3,2],[3,3],[3,4],[3,5],
      [3,6],[3,7],[3,8],[3,9],[3,10],[3,11],
      [3,12],[3,13],[3,14],[3,15],
      [4,7],[4,15],
    ]),
  },
  {
    id: 'trap-4', name: 'Trap Dark Roll', genre: 'Trap', role: 'drums',
    desc: 'Dark trap: sparse kick, snare chop on 2.5, hat 32nds at phrase end',
    pattern: grid([
      [0,0],[0,11],[0,14],
      [1,4],[1,7],[1,12],
      [3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,13],[3,14],[3,15],
      [4,6],[4,14],
    ]),
  },
  {
    id: 'trap-5', name: 'Trap Drill Hybrid', genre: 'Trap', role: 'drums',
    desc: 'Trap/drill crossover: sliding kick, double clap, open hat stabs',
    pattern: grid([
      [0,0],[0,3],[0,8],[0,11],[0,15],
      [2,4],[2,12],[2,13],
      [3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],
      [3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],
      [4,7],[4,11],[4,15],
    ]),
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
      [2,4],[2,12],
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
      [2,4],[2,12],
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
      [2,8],
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
      [2,4],[2,12],
      [3,0],[3,2],[3,4],[3,6],[3,8],[3,10],[3,12],[3,14],
      [4,2],[4,6],[4,10],[4,14],
    ]),
  },
  {
    id: 'house-2', name: 'Deep House Groove', genre: 'House', role: 'drums',
    desc: 'Deep house: 4x4 kick, clap 2 & 4, ride pattern with open accents',
    pattern: grid([
      [0,0],[0,4],[0,8],[0,12],
      [2,4],[2,12],
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
      [2,4],[2,12],
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
  ...DRUM_PRESETS,
  ...BASS_PRESETS,
  ...MELODY_PRESETS,
  ...PAD_PRESETS,
];

export const PRESET_GENRES = [
  'All', 'Trap', 'Boom Bap', 'Drill', 'House', 'Disco',
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
    drill: 'Drill', house: 'House', disco: 'Disco',
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
