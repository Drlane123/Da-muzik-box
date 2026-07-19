/**
 * Deep R&B Chords — original progressive chord packs for SE2 Chord Generator.
 * Quiet-storm / neo-soul / late-night R&B — lush maj9 / m9 / 13 / 13sus color.
 * Inspired by common slow-jam harmonic language; not copied from any commercial pack.
 */

import type { GenreDef } from '@/app/lib/creationStation/chordBuilder';

export const DEEP_RNB_GENRE: GenreDef = {
  id: 'deep-rnb',
  label: 'Deep R&B Chords',
  mode: 'major',
  progressions: [
    // ── Front shelf: lush 5–6 note slow-jam cards (maj9 / m9 / 13) ──────────
    {
      id: 'deeprnb-lush-ninth-vamp',
      name: 'Deep · Lush Ninth Vamp · 6',
      chords: ['Imaj9', 'vi9', 'IVmaj9', 'V13', 'ii9', 'V13sus'],
    },
    {
      id: 'deeprnb-quiet-storm-maj9',
      name: 'Deep · Quiet Storm Maj9 · 8',
      chords: ['Imaj9', 'vi9', 'ii9', 'V13', 'IVmaj9', 'iii9', 'vi9', 'V13'],
    },
    {
      id: 'deeprnb-glasper-cycle',
      name: 'Deep · Soft Jazz Cycle · 6',
      chords: ['ii9', 'V13', 'Imaj9', 'bVIImaj9', 'IVmaj9', 'V13sus'],
    },
    {
      id: 'deeprnb-bittersweet-ninth',
      name: 'Deep · Bittersweet Ninth · 7',
      chords: ['Imaj9', 'IVmaj9', 'iii9', 'bVIImaj9', 'vi9', 'ii9', 'V13'],
    },
    {
      id: 'deeprnb-silk-13sus',
      name: 'Deep · Silk 13sus · 7',
      chords: ['Imaj9', 'V13sus', 'V13', 'vi9', 'IVmaj9', 'ii9', 'V13'],
    },
    {
      id: 'deeprnb-candle-maj9',
      name: 'Deep · Candle Maj9 · 8',
      chords: ['Imaj9', 'IVmaj9', 'iii9', 'vi9', 'iiø7', 'V13', 'Imaj9', 'vi9'],
    },
    {
      id: 'deeprnb-orchid-maj9',
      name: 'Deep · Orchid Maj9 · 6',
      chords: ['Imaj9', 'bVImaj9', 'bVIImaj9', 'IVmaj9', 'V13', 'Imaj9'],
    },
    {
      id: 'deeprnb-honey-m9-line',
      name: 'Deep · Honey m9 Line · 7',
      chords: ['vi9', 'ii9', 'V13', 'Imaj9', 'IVmaj9', 'iii9', 'V13sus'],
    },
    {
      id: 'deeprnb-falsetto-ninths',
      name: 'Deep · Falsetto Ninths · 7',
      chords: ['iii9', 'vi9', 'ii9', 'V13', 'Imaj9', 'IVmaj9', 'V13sus'],
    },
    {
      id: 'deeprnb-widescreen-9',
      name: 'Deep · Widescreen 9 · 7',
      chords: ['Imaj9', 'bIIImaj9', 'IVmaj9', 'V13', 'vi9', 'ii9', 'Imaj9'],
    },
    {
      id: 'deeprnb-min-smoky-m9',
      name: 'Deep · Smoky Minor 9 · 7',
      mode: 'minor',
      chords: ['i9', 'VImaj9', 'iiø7', 'V13', 'i9', 'iv9', 'V13'],
    },
    {
      id: 'deeprnb-min-liquid-spirit',
      name: 'Deep · Liquid Minor · 6',
      mode: 'minor',
      chords: ['i9', 'iv9', 'VII7', 'bIIImaj9', 'VImaj9', 'V13'],
    },
    {
      id: 'deeprnb-dor-im9-iv13',
      name: 'Deep · Dorian im9–IV13 · 6',
      mode: 'dorian',
      chords: ['i9', 'IV13', 'i9', 'bVIImaj9', 'ii9', 'IV9'],
    },
    {
      id: 'deeprnb-dor-modal-ninths',
      name: 'Deep · Dorian Modal Ninths · 7',
      mode: 'dorian',
      chords: ['i9', 'ii9', 'bIIImaj9', 'IV13', 'i9', 'bVIImaj9', 'IV9'],
    },
    {
      id: 'deeprnb-min-heartbreak-9',
      name: 'Deep · Heartbreak m9 · 7',
      mode: 'minor',
      chords: ['i9', 'bVI', 'bVII', 'i9', 'iv9', 'V13', 'VImaj9'],
    },
    // ── Classic deep cards (maj7 / m7 color) ───────────────────────────────
    {
      id: 'deeprnb-velvet-crawl',
      name: 'Deep · Velvet Crawl · 6',
      chords: ['Imaj7', 'iii7', 'vi7', 'ii7', 'Vsus4', 'V7'],
    },
    {
      id: 'deeprnb-candle-glow',
      name: 'Deep · Candle Glow · 7',
      chords: ['Imaj7', 'IVmaj7', 'iii7', 'vi7', 'iiø7', 'V7', 'Imaj7'],
    },
    {
      id: 'deeprnb-silk-porch',
      name: 'Deep · Silk Porch · 6',
      chords: ['vi7', 'ii7', 'V7', 'Imaj7', 'IVmaj7', 'iii7'],
    },
    {
      id: 'deeprnb-amber-turn',
      name: 'Deep · Amber Turn · 7',
      chords: ['Imaj7', 'vi7', 'IVmaj7', 'ii7', 'Vsus4', 'V7', 'iii7'],
    },
    {
      id: 'deeprnb-orchid-haze',
      name: 'Deep · Orchid Haze · 6',
      chords: ['Imaj7', 'bVImaj7', 'bVII', 'IVmaj7', 'V7', 'Imaj7'],
    },
    {
      id: 'deeprnb-moonlit-iv',
      name: 'Deep · Moonlit IV · 8',
      chords: ['IVmaj7', 'iii7', 'vi7', 'ii7', 'V7', 'Imaj7', 'vi7', 'IVmaj7'],
    },
    {
      id: 'deeprnb-quiet-church',
      name: 'Deep · Quiet Church · 6',
      chords: ['Imaj7', 'iiø7', 'V7', 'IVmaj7', 'iii7', 'vi7'],
    },
    {
      id: 'deeprnb-falsetto-rain',
      name: 'Deep · Falsetto Rain · 7',
      chords: ['iii7', 'vi7', 'ii7', 'V7', 'Imaj7', 'IVmaj7', 'Vsus4'],
    },
    {
      id: 'deeprnb-backdoor-silk',
      name: 'Deep · Backdoor Silk · 6',
      chords: ['Imaj7', 'IV7', 'iv', 'Imaj7', 'ii7', 'V7'],
    },
    {
      id: 'deeprnb-widescreen-cry',
      name: 'Deep · Widescreen Cry · 7',
      chords: ['Imaj7', 'bIII', 'IVmaj7', 'V7', 'vi7', 'ii7', 'Imaj7'],
    },
    {
      id: 'deeprnb-prayer-ladder',
      name: 'Deep · Prayer Ladder · 8',
      chords: ['Imaj7', 'vii°', 'vi7', 'V7', 'IVmaj7', 'iii7', 'ii7', 'Imaj7'],
    },
    {
      id: 'deeprnb-soft-dominants',
      name: 'Deep · Soft Dominants · 6',
      chords: ['Imaj7', 'IV7', 'ii7', 'V7', 'Imaj7', 'IVmaj7'],
    },
    {
      id: 'deeprnb-honey-cycle',
      name: 'Deep · Honey Cycle · 7',
      chords: ['ii7', 'V7', 'iii7', 'vi7', 'IVmaj7', 'V7', 'Imaj7'],
    },
    {
      id: 'deeprnb-glass-resolve',
      name: 'Deep · Glass Resolve · 6',
      chords: ['Imaj7', 'IVmaj7', 'Vsus4', 'V7', 'vi7', 'ii7'],
    },
    {
      id: 'deeprnb-borrowed-sky',
      name: 'Deep · Borrowed Sky · 7',
      chords: ['Imaj7', 'bVI', 'bVII', 'IVmaj7', 'iii7', 'vi7', 'V7'],
    },
    {
      id: 'deeprnb-late-sus',
      name: 'Deep · Late Sus · 7',
      chords: ['IVmaj7', 'iii7', 'vi7', 'Vsus4', 'V7', 'ii7', 'Imaj7'],
    },
    {
      id: 'deeprnb-tender-half',
      name: 'Deep · Tender Half-Dim · 8',
      chords: ['Imaj7', 'iiø7', 'V7', 'vi7', 'IVmaj7', 'iii7', 'ii7', 'V7'],
    },
    {
      id: 'deeprnb-slow-bloom',
      name: 'Deep · Slow Bloom · 6',
      chords: ['vi7', 'IVmaj7', 'Imaj7', 'V7', 'iii7', 'ii7'],
    },
    {
      id: 'deeprnb-velvet-ii-v',
      name: 'Deep · Velvet II–V · 7',
      chords: ['ii7', 'V7', 'Imaj7', 'vi7', 'iiø7', 'V7', 'Imaj7'],
    },
    {
      id: 'deeprnb-neon-porch',
      name: 'Deep · Neon Porch · 6',
      chords: ['Imaj7', 'bVIImaj7', 'IVmaj7', 'iii7', 'vi7', 'V7'],
    },
    // ── Minor / dorian late-night cards ────────────────────────────────────
    {
      id: 'deeprnb-min-midnight',
      name: 'Deep · Midnight Minor · 7',
      mode: 'minor',
      chords: ['i7', 'VImaj7', 'iiø7', 'V7', 'i7', 'iv7', 'V7'],
    },
    {
      id: 'deeprnb-min-heartbreak',
      name: 'Deep · Heartbreak Glide · 6',
      mode: 'minor',
      chords: ['i7', 'bVI', 'bVII', 'i7', 'iv7', 'V7'],
    },
    {
      id: 'deeprnb-min-silk-down',
      name: 'Deep · Silk Descent Minor · 8',
      mode: 'minor',
      chords: ['i7', 'VImaj7', 'iv7', 'V7', 'bIIImaj7', 'VImaj7', 'iiø7', 'V7'],
    },
    {
      id: 'deeprnb-min-gospel',
      name: 'Deep · Minor Gospel · 6',
      mode: 'minor',
      chords: ['i7', 'iv7', 'V7', 'VImaj7', 'iiø7', 'V7'],
    },
    {
      id: 'deeprnb-min-late-neon',
      name: 'Deep · Late Neon · 7',
      mode: 'minor',
      chords: ['i7', 'VII7', 'VImaj7', 'V7', 'i7', 'bIIImaj7', 'VImaj7'],
    },
    {
      id: 'deeprnb-dor-warm-iv',
      name: 'Deep · Dorian Warm IV · 6',
      mode: 'dorian',
      chords: ['i7', 'IV7', 'i7', 'bVII', 'ii7', 'IV7'],
    },
    {
      id: 'deeprnb-dor-modal-crawl',
      name: 'Deep · Dorian Modal Crawl · 7',
      mode: 'dorian',
      chords: ['i7', 'ii7', 'bIIImaj7', 'IV7', 'i7', 'bVIImaj7', 'IV7'],
    },
    {
      id: 'deeprnb-min-open-sky',
      name: 'Deep · Minor Open Sky · 6',
      mode: 'minor',
      chords: ['i7', 'bIIImaj7', 'VImaj7', 'VII7', 'iv7', 'V7'],
    },
  ],
};

export const DEEP_RNB_GENRES: GenreDef[] = [DEEP_RNB_GENRE];
