/**
 * SE2 Guitar — classic progression palettes for strummer / loop sequencer slots.
 */
import type { Se2GuitarChordId } from '@/app/lib/studio/se2GuitarChords';
import type { Se2GuitarPartBars } from '@/app/lib/studio/se2GuitarPartBars';

export type Se2GuitarProgression = {
  id: string;
  label: string;
  hint: string;
  /** Four-bar chord roots (slot indices map via chord ids). */
  chords: readonly [Se2GuitarChordId, Se2GuitarChordId, Se2GuitarChordId, Se2GuitarChordId];
  /** Optional 8-bar extension (bars 5–8). */
  chords8?: readonly [Se2GuitarChordId, Se2GuitarChordId, Se2GuitarChordId, Se2GuitarChordId];
};

export const SE2_GUITAR_PROGRESSIONS: readonly Se2GuitarProgression[] = [
  {
    id: 'pop_1564',
    label: 'I–V–vi–IV',
    hint: 'Axis of Awesome — pop / rock standard',
    chords: ['C', 'G', 'Am', 'F'],
    chords8: ['C', 'G', 'Am', 'F'],
  },
  {
    id: 'pop_6415',
    label: 'vi–IV–I–V',
    hint: 'Sensitive female chord progression — Adele / Beyoncé ballads',
    chords: ['Am', 'F', 'C', 'G'],
    chords8: ['Am', 'F', 'C', 'G'],
  },
  {
    id: 'pop_1625',
    label: 'I–vi–ii–V',
    hint: 'Doo-wop / 50s pop — classic turnaround',
    chords: ['C', 'Am', 'Dm', 'G'],
    chords8: ['C', 'Am', 'Dm', 'G7'],
  },
  {
    id: 'rnb_2516',
    label: 'ii–V–I–vi',
    hint: 'Jazz-pop cadence — neo-soul session staple',
    chords: ['Dm7', 'G7', 'Cmaj7', 'Am7'],
    chords8: ['Dm7', 'G7', 'Cmaj7', 'Am9'],
  },
  {
    id: 'rnb_gospel',
    label: 'Gospel lift',
    hint: 'I–IV–vi–V church climb',
    chords: ['C', 'F', 'Am', 'G'],
    chords8: ['Cmaj7', 'Fmaj7', 'Am7', 'G6'],
  },
  {
    id: 'rnb_neo',
    label: 'Neo loop',
    hint: 'Am7–D9–Gmaj7–Cmaj7 floating minor-major',
    chords: ['Am7', 'D9', 'Gmaj7', 'Cmaj7'],
    chords8: ['Am9', 'D9', 'G6', 'Cadd9'],
  },
  {
    id: 'pop_edm',
    label: 'EDM pop',
    hint: 'vi–IV–I–V with sus extensions — festival hook',
    chords: ['Am', 'F', 'C', 'G'],
    chords8: ['Am7', 'Fmaj7', 'Csus2', 'G6'],
  },
  {
    id: 'pop_indie',
    label: 'Indie folk',
    hint: 'Em–C–G–D open voicings',
    chords: ['Em', 'C', 'G', 'D'],
    chords8: ['Em7', 'Cadd9', 'G6', 'D'],
  },
  {
    id: 'pop_top40',
    label: 'Top 40',
    hint: 'D–A–Bm–G modern radio progression',
    chords: ['D', 'A', 'Bm', 'G'],
    chords8: ['D', 'A', 'Bm7', 'G6'],
  },
  {
    id: 'rnb_90s',
    label: '90s R&B',
    hint: 'I–♭VII–IV–I — G major color',
    chords: ['G', 'F', 'C', 'G'],
    chords8: ['G6', 'Fmaj7', 'Cadd9', 'G'],
  },
  {
    id: 'soul_ballad',
    label: 'Soul ballad',
    hint: 'Dmaj9–Bm9–Gmaj9–A13 emotional arc',
    chords: ['Dmaj7', 'Bm7', 'Gmaj7', 'A7'],
    chords8: ['Dmaj7', 'Bm7', 'G6', 'Asus4'],
  },
  {
    id: 'country_pop',
    label: 'Country pop',
    hint: 'G–C–Em–D Nashville crossover',
    chords: ['G', 'C', 'Em', 'D'],
    chords8: ['G6', 'Cadd9', 'Em7', 'D'],
  },
  // ─── Pop expansions ───────────────────────────────────────────────────────
  {
    id: 'pop_standby',
    label: 'I–IV–vi–V',
    hint: 'Stand By Me / every heartstring ballad — C–F–Am–G',
    chords: ['C', 'F', 'Am', 'G'],
    chords8: ['Cmaj7', 'Fmaj7', 'Am7', 'G6'],
  },
  {
    id: 'pop_iveiv',
    label: 'I–V–IV–V',
    hint: 'Arena / Springsteen lift — chant-ready chorus',
    chords: ['C', 'G', 'F', 'G'],
    chords8: ['C', 'G', 'F', 'G7'],
  },
  {
    id: 'pop_ivvivi',
    label: 'IV–V–vi–I',
    hint: 'Bridge climb — pre-chorus tension into the tonic',
    chords: ['F', 'G', 'Am', 'C'],
    chords8: ['Fmaj7', 'G6', 'Am7', 'Cadd9'],
  },
  {
    id: 'pop_iviii',
    label: 'IV–V–iii–vi',
    hint: 'Locked Out hook — modern radio lift',
    chords: ['F', 'G', 'Em', 'Am'],
    chords8: ['Fmaj7', 'G6', 'Em7', 'Am7'],
  },
  {
    id: 'pop_viiviii',
    label: 'vi–IV–I–V',
    hint: 'Sensitive / TikTok viral — Am–F–C–G',
    chords: ['Am', 'F', 'C', 'G'],
    chords8: ['Am7', 'Fmaj7', 'Csus2', 'G6'],
  },
  {
    id: 'pop_iiivi',
    label: 'iii–vi–IV–I',
    hint: 'Emotional verse — Em–Am–F–C singer-songwriter',
    chords: ['Em', 'Am', 'F', 'C'],
    chords8: ['Em7', 'Am7', 'Fmaj7', 'Cadd9'],
  },
  {
    id: 'pop_iiviv',
    label: 'I–ii–vi–V',
    hint: '50s turnaround extended — C–Dm–Am–G',
    chords: ['C', 'Dm', 'Am', 'G'],
    chords8: ['Cmaj7', 'Dm7', 'Am7', 'G7'],
  },
  {
    id: 'pop_vivvi',
    label: 'vi–I–IV–V',
    hint: 'Relative-minor opener — Am–C–F–G',
    chords: ['Am', 'C', 'F', 'G'],
    chords8: ['Am7', 'Cadd9', 'Fmaj7', 'G6'],
  },
  {
    id: 'pop_ivivi',
    label: 'IV–I–V–vi',
    hint: 'Deceptive tag — F–C–G–Am surprise ending',
    chords: ['F', 'C', 'G', 'Am'],
    chords8: ['Fmaj7', 'Cadd9', 'G6', 'Am7'],
  },
  {
    id: 'pop_iveii',
    label: 'I–V–ii–V',
    hint: 'Jazz-pop turnaround — C–G–Dm–G7',
    chords: ['C', 'G', 'Dm', 'G7'],
    chords8: ['Cmaj7', 'G6', 'Dm7', 'G7'],
  },
  {
    id: 'pop_worship',
    label: 'G–D–Em–C',
    hint: 'Worship / congregational crossover — G major',
    chords: ['G', 'D', 'Em', 'C'],
    chords8: ['G6', 'D', 'Em7', 'Cadd9'],
  },
  {
    id: 'pop_duet',
    label: 'I–iii–vi–IV',
    hint: 'Duet verse — C–Em–Am–F emotional motion',
    chords: ['C', 'Em', 'Am', 'F'],
    chords8: ['Cmaj7', 'Em7', 'Am7', 'Fmaj7'],
  },
  // ─── R&B expansions ─────────────────────────────────────────────────────
  {
    id: 'rnb_mary',
    label: 'Mary J bed',
    hint: 'I–vi–IV–V maj7 — 90s R&B comp',
    chords: ['Cmaj7', 'Am7', 'Fmaj7', 'G6'],
    chords8: ['Cmaj7', 'Am9', 'Fmaj7', 'Gmaj7'],
  },
  {
    id: 'rnb_coltrane',
    label: 'Coltrane changes',
    hint: 'iii–VI–ii–V — jazz-R&B turnaround',
    chords: ['Em7', 'A7', 'Dm7', 'G7'],
    chords8: ['Em7', 'A7', 'Dm9', 'G7'],
  },
  {
    id: 'rnb_sade',
    label: 'Sade cadence',
    hint: 'vi–ii–V–I — late-night minor resolution',
    chords: ['Am7', 'Dm9', 'G7', 'Cmaj7'],
    chords8: ['Am9', 'Dm9', 'G7', 'Cmaj7'],
  },
  {
    id: 'rnb_dangelo',
    label: "D'Angelo pocket",
    hint: 'ii–iii–vi–V — neo-soul lazy motion',
    chords: ['Dm9', 'Em7', 'Am9', 'Gmaj7'],
    chords8: ['Dm9', 'Em7', 'Am9', 'G6'],
  },
  {
    id: 'rnb_beyonce',
    label: 'Soul pre-chorus',
    hint: 'vi–IV–ii–V — emotional R&B lift',
    chords: ['Am7', 'Fmaj7', 'Dm7', 'G7'],
    chords8: ['Am9', 'Fmaj7', 'Dm9', 'G7'],
  },
  {
    id: 'rnb_usher',
    label: 'Usher crossover',
    hint: 'I–V–vi–IV with maj7 color — pop-R&B radio',
    chords: ['Cmaj7', 'Gmaj7', 'Am7', 'Fmaj7'],
    chords8: ['Cmaj7', 'G6', 'Am9', 'Fmaj7'],
  },
  {
    id: 'rnb_stevie',
    label: 'Stevie cycle',
    hint: 'I–IV–V–IV — Motown / Stevie Wonder lift',
    chords: ['Cmaj7', 'Fmaj7', 'Gmaj7', 'Fmaj7'],
    chords8: ['Cmaj7', 'Fmaj7', 'G6', 'Fmaj7'],
  },
  {
    id: 'rnb_passing',
    label: 'Passing ii–V',
    hint: 'I–vi–ii–V — session standard with extensions',
    chords: ['Cmaj7', 'Am7', 'Dm9', 'G7'],
    chords8: ['Cadd9', 'Am9', 'Dm9', 'G7'],
  },
  {
    id: 'rnb_morning',
    label: 'Morning soul',
    hint: 'vi–IV–ii–V — 8-bar R&B verse cycle',
    chords: ['Am7', 'Fmaj7', 'Dm7', 'G7'],
    chords8: ['Am9', 'Fmaj7', 'Dm9', 'G7'],
  },
  {
    id: 'rnb_frank',
    label: 'Sparse soul',
    hint: 'I–IV–ii–V — minimal Frank Ocean-style space',
    chords: ['Cmaj7', 'Fmaj7', 'Dm9', 'G7'],
    chords8: ['Cmaj7', 'Fmaj7', 'Dm7', 'G7'],
  },
  {
    id: 'rnb_gospel_walk',
    label: 'Gospel walk',
    hint: 'I–IV–I–V — church walk-up with passing tones',
    chords: ['C', 'F', 'C', 'G'],
    chords8: ['Cmaj7', 'Fmaj7', 'Cadd9', 'G6'],
  },
  {
    id: 'rnb_minor_plagal',
    label: 'Minor plagal',
    hint: 'vi–IV–I–V — neo-soul relative-minor bed',
    chords: ['Am9', 'Fmaj7', 'Cmaj7', 'G6'],
    chords8: ['Am7', 'Fmaj7', 'Cadd9', 'Gmaj7'],
  },
];

/** Chord-per-bar list for 4-, 8-, or 12-bar strum / progression preview + insert. */
export function se2GuitarProgressionChordsForBars(
  prog: Se2GuitarProgression,
  bars: Se2GuitarPartBars,
): Se2GuitarChordId[] {
  const four = [...prog.chords];
  const eight = prog.chords8 ? [...prog.chords, ...prog.chords8] : [...four, ...four];
  if (bars === 4) return four;
  if (bars === 8) return eight.slice(0, 8);
  const twelve =
    eight.length >= 8 ? [...eight.slice(0, 8), ...four] : [...four, ...four, ...four];
  return twelve.slice(0, 12);
}

/** Fill 12 chord slots from a progression (repeat / pad for sequencer). */
export function se2GuitarProgressionToSlots(
  prog: Se2GuitarProgression,
  eightBars = false,
): Se2GuitarChordId[] {
  const base = eightBars && prog.chords8
    ? [...prog.chords, ...prog.chords8]
    : [...prog.chords, ...prog.chords];
  const out: Se2GuitarChordId[] = [];
  while (out.length < 12) {
    out.push(...base);
  }
  return out.slice(0, 12);
}
