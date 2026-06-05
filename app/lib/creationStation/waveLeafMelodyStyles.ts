/**
 * Groove Lead melody styles — genre + preset (Melody Sauce / Eva Beat–style workflow).
 * Maps to chord-locked phrase engine params; chords come from Groove chord.
 */
import type { GrooveComposerPart } from '@/app/lib/creationStation/grooveComposerEngine';
import type { GrooveLabQuantize } from '@/app/lib/creationStation/grooveLabRoll';

export type WaveLeafMelodyStyleId = string;

export type WaveLeafMelodyStyleDef = {
  id: WaveLeafMelodyStyleId;
  label: string;
  part: GrooveComposerPart;
  complexity: number;
  phraseGrid: boolean;
  rate: GrooveLabQuantize;
  /** Bias toward stepwise / chord-tone motion (Chord Fit). */
  chordFit: number;
  /** Rhythmic / contour activity (Movement). */
  movement: number;
};

export type WaveLeafMelodyGenreDef = {
  id: string;
  label: string;
  styles: WaveLeafMelodyStyleDef[];
};

export const WAVE_LEAF_MELODY_GENRES: WaveLeafMelodyGenreDef[] = [
  {
    id: 'rnb',
    label: 'R&B',
    styles: [
      { id: 'rnb-sine', label: 'Sine Glide', part: 'melody', complexity: 0.42, phraseGrid: false, rate: '1/4', chordFit: 0.94, movement: 0.35 },
      { id: 'rnb-hook', label: 'Hook Line', part: 'melody', complexity: 0.55, phraseGrid: true, rate: '1/8', chordFit: 0.75, movement: 0.5 },
      { id: 'rnb-riff', label: 'Neo Riff', part: 'riff', complexity: 0.62, phraseGrid: true, rate: '1/16', chordFit: 0.7, movement: 0.65 },
    ],
  },
  {
    id: 'hiphop',
    label: 'Hip Hop',
    styles: [
      { id: 'hh-pluck', label: 'Pluck Hook', part: 'melody', complexity: 0.48, phraseGrid: true, rate: '1/8', chordFit: 0.9, movement: 0.55 },
      { id: 'hh-riff', label: 'Punch Riff', part: 'riff', complexity: 0.7, phraseGrid: true, rate: '1/16', chordFit: 0.6, movement: 0.78 },
      { id: 'hh-arp', label: 'Trap Arp', part: 'arp', complexity: 0.58, phraseGrid: false, rate: '1/16', chordFit: 0.8, movement: 0.6 },
    ],
  },
  {
    id: 'trap',
    label: 'Trap',
    styles: [
      { id: 'trap-dark', label: 'Dark Lead', part: 'melody', complexity: 0.52, phraseGrid: true, rate: '1/8', chordFit: 0.68, movement: 0.62 },
      { id: 'trap-arp', label: 'Bell Arp', part: 'arp', complexity: 0.65, phraseGrid: false, rate: '1/16', chordFit: 0.75, movement: 0.7 },
      { id: 'trap-riff', label: 'Slide Riff', part: 'riff', complexity: 0.75, phraseGrid: true, rate: '1/16', chordFit: 0.55, movement: 0.85 },
    ],
  },
  {
    id: 'pop',
    label: 'Pop',
    styles: [
      { id: 'pop-hook', label: 'Topline', part: 'melody', complexity: 0.5, phraseGrid: true, rate: '1/8', chordFit: 0.82, movement: 0.48 },
      { id: 'pop-arp', label: 'Shiny Arp', part: 'arp', complexity: 0.45, phraseGrid: false, rate: '1/8', chordFit: 0.85, movement: 0.4 },
    ],
  },
  {
    id: 'edm',
    label: 'EDM / House',
    styles: [
      { id: 'edm-lead', label: 'Festival Lead', part: 'melody', complexity: 0.6, phraseGrid: true, rate: '1/8', chordFit: 0.7, movement: 0.72 },
      { id: 'edm-arp', label: 'Sidechain Arp', part: 'arp', complexity: 0.68, phraseGrid: false, rate: '1/16', chordFit: 0.78, movement: 0.75 },
    ],
  },
  {
    id: 'guitar',
    label: 'Guitar / Wah',
    styles: [
      { id: 'gtr-lick', label: 'Wah Lick', part: 'riff', complexity: 0.72, phraseGrid: true, rate: '1/16', chordFit: 0.65, movement: 0.8 },
      { id: 'gtr-sing', label: 'Sing Melody', part: 'melody', complexity: 0.55, phraseGrid: true, rate: '1/8', chordFit: 0.8, movement: 0.52 },
    ],
  },
  {
    id: 'moog',
    label: 'Moog / Analog',
    styles: [
      { id: 'moog-lead', label: 'Mono Lead', part: 'melody', complexity: 0.58, phraseGrid: true, rate: '1/8', chordFit: 0.76, movement: 0.58 },
      { id: 'moog-seq', label: 'Analog Seq', part: 'arp', complexity: 0.64, phraseGrid: false, rate: '1/16', chordFit: 0.72, movement: 0.66 },
    ],
  },
  {
    id: 'flute',
    label: 'Flute / Woodwind',
    styles: [
      { id: 'flute-line', label: 'Breath Line', part: 'melody', complexity: 0.5, phraseGrid: true, rate: '1/8', chordFit: 0.88, movement: 0.42 },
      { id: 'flute-moog-line', label: 'Moog Flute', part: 'melody', complexity: 0.54, phraseGrid: true, rate: '1/8', chordFit: 0.82, movement: 0.48 },
    ],
  },
  {
    id: 'free',
    label: 'Free',
    styles: [
      { id: 'free-custom', label: 'Custom', part: 'melody', complexity: 0.55, phraseGrid: true, rate: '1/8', chordFit: 0.75, movement: 0.55 },
    ],
  },
];

export const WAVE_LEAF_DEFAULT_STYLE_ID = 'hh-pluck';

export function waveLeafMelodyStyleById(id: string): WaveLeafMelodyStyleDef {
  for (const g of WAVE_LEAF_MELODY_GENRES) {
    const s = g.styles.find((x) => x.id === id);
    if (s) return s;
  }
  return WAVE_LEAF_MELODY_GENRES[0]!.styles[0]!;
}

export function waveLeafMelodyGenreForStyle(styleId: string): WaveLeafMelodyGenreDef {
  for (const g of WAVE_LEAF_MELODY_GENRES) {
    if (g.styles.some((s) => s.id === styleId)) return g;
  }
  return WAVE_LEAF_MELODY_GENRES[0]!;
}
