/**
 * Soul · R&B · Neo-Soul progression packs for Synth Geno preset library + Chord Sequencer.
 * Rich maj7 / m7 / sus / borrowed-chord vocabulary — resolves in major unless noted.
 */

import type { GenreDef } from '@/app/lib/creationStation/chordBuilder';

/** Classic soul — Motown, Philly, quiet storm, gospel-soul. */
export const SOUL_ERA_GENRE: GenreDef = {
  id: 'soul-eras',
  label: 'Soul · Classic',
  mode: 'major',
  progressions: [
    { id: 'soul-motown', name: 'Soul · Motown Turn · 5', chords: ['vi7', 'ii7', 'V7', 'Imaj7', 'IVmaj7'] },
    { id: 'soul-marvin', name: 'Soul · Dominant IV · 6', chords: ['IV7', 'iii7', 'vi7', 'ii7', 'V7', 'Imaj7'] },
    { id: 'soul-philly', name: 'Soul · Philly Strings · 6', chords: ['bIII', 'IVmaj7', 'V7', 'vi7', 'ii7', 'Imaj7'] },
    { id: 'soul-ewf', name: 'Soul · Horn Loop · 6', chords: ['bVII', 'IVmaj7', 'Imaj7', 'iii7', 'vi7', 'ii7'] },
    { id: 'soul-curtis', name: 'Soul · Jazz Walk · 6', chords: ['vi7', 'ii7', 'V7', 'Imaj7', 'IVmaj7', 'iii7'] },
    { id: 'soul-aretha', name: 'Soul · Church Lift · 5', chords: ['IVmaj7', 'ii7', 'V7', 'vi7', 'Imaj7'] },
    { id: 'soul-algreen', name: 'Soul · Quiet Fire · 5', chords: ['vi7', 'ii7', 'Imaj7', 'IVmaj7', 'V7'] },
    { id: 'soul-stevie', name: 'Soul · Sunny Climb · 7', chords: ['iii7', 'IVmaj7', 'V7', 'vi7', 'ii7', 'V7', 'Imaj7'] },
    { id: 'soul-backdoor', name: 'Soul · Minor iv Color · 6', chords: ['iv', 'IVmaj7', 'V7', 'vi7', 'Imaj7', 'ii7'] },
    { id: 'soul-sam', name: 'Soul · Gentle Change · 5', chords: ['vi7', 'IVmaj7', 'V7', 'Imaj7', 'iii7'] },
    { id: 'soul-temptations', name: 'Soul · Circle Glow · 6', chords: ['iii7', 'vi7', 'ii7', 'V7', 'Imaj7', 'IVmaj7'] },
    { id: 'soul-borrow', name: 'Soul · Borrowed Sky · 6', chords: ['bVI', 'bVII', 'IVmaj7', 'V7', 'Imaj7', 'vi7'] },
  ],
};

/** Neo-soul — D'Angelo, Maxwell, Erykah, Jill Scott, Frank Ocean palette. */
export const NEO_SOUL_ERA_GENRE: GenreDef = {
  id: 'neo-soul-eras',
  label: 'Neo-Soul · Groove',
  mode: 'major',
  progressions: [
    { id: 'neo-dangelo', name: 'Neo · Warm Glide · 6', chords: ['ii7', 'iii7', 'vi7', 'IVmaj7', 'V7', 'Imaj7'] },
    { id: 'neo-erykah', name: 'Neo · Silk Descent · 7', chords: ['IVmaj7', 'iii7', 'ii7', 'Imaj7', 'vi7', 'ii7', 'V7'] },
    { id: 'neo-maxwell', name: 'Neo · Tender Half-Dim · 6', chords: ['iiø7', 'V7', 'Imaj7', 'vi7', 'IVmaj7', 'iii7'] },
    { id: 'neo-dwele', name: 'Neo · Step Down · 5', chords: ['IVmaj7', 'iii7', 'vi7', 'ii7', 'Imaj7'] },
    { id: 'neo-bilal', name: 'Neo · Modal Borrow · 6', chords: ['bVII', 'IVmaj7', 'V7', 'vi7', 'ii7', 'Imaj7'] },
    { id: 'neo-jill', name: 'Neo · Prayer Turn · 6', chords: ['iiø7', 'V7', 'IVmaj7', 'iii7', 'vi7', 'Imaj7'] },
    { id: 'neo-musiq', name: 'Neo · Sus Resolve · 5', chords: ['IVmaj7', 'Vsus4', 'V7', 'Imaj7', 'vi7'] },
    { id: 'neo-common', name: 'Neo · Jazz-Soul Cycle · 6', chords: ['ii7', 'V7', 'iii7', 'vi7', 'IVmaj7', 'Imaj7'] },
    { id: 'neo-frank', name: 'Neo · Bittersweet · 6', chords: ['bVI', 'bVII', 'Imaj7', 'vi7', 'IVmaj7', 'ii7'] },
    { id: 'neo-lish', name: 'Neo · Lush Vamp · 4', chords: ['IVmaj7', 'iii7', 'vi7', 'Imaj7'] },
    { id: 'neo-baduh', name: 'Neo · On & On · 5', chords: ['vi7', 'ii7', 'V7', 'Imaj7', 'IVmaj7'] },
    { id: 'neo-sza', name: 'Neo · Modern Turn · 6', chords: ['vi7', 'IVmaj7', 'Imaj7', 'V7', 'iii7', 'ii7'] },
  ],
};

export const ERA_SOUL_RNB_NEO_GENRES: GenreDef[] = [SOUL_ERA_GENRE, NEO_SOUL_ERA_GENRE];
