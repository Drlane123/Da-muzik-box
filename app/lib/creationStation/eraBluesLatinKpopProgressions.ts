/**
 * Synth Geno preset library — Blues, Latin, K-pop progression packs.
 * Mixed 5 / 6 / 7-chord loops; dominants and extended harmony where appropriate.
 */

import type { GenreDef } from '@/app/lib/creationStation/chordBuilder';

export const BLUES_ERA_GENRE: GenreDef = {
  id: 'blues-eras',
  label: 'Blues · Classic',
  mode: 'major',
  progressions: [
    { id: 'blues-quick5', name: 'Quick Change · 5', chords: ['IV7', 'I7', 'V7', 'IV7', 'I7'] },
    { id: 'blues-shuffle6', name: 'Shuffle · 6', chords: ['IV7', 'I7', 'I7', 'V7', 'IV7', 'I7'] },
    { id: 'blues-walk7', name: 'Walking Bars · 7', chords: ['IV7', 'IV7', 'I7', 'V7', 'IV7', 'I7', 'V7'] },
    { id: 'blues-turn5', name: 'Turnaround · 5', chords: ['V7', 'IV7', 'I7', 'V7', 'I7'] },
    { id: 'blues-stomp6', name: 'Stomp · 6', chords: ['IV7', 'V7', 'I7', 'IV7', 'I7', 'V7'] },
    { id: 'blues-jazz7', name: 'Jazz Blues · 7', chords: ['IV7', 'I7', 'V7', 'IV7', 'V7', 'I7', 'IV7'] },
    { id: 'blues-borrow5', name: 'Borrowed bVII · 5', chords: ['bVII', 'IV7', 'I7', 'V7', 'I7'] },
    { id: 'blues-gospel6', name: 'Gospel Blues · 6', chords: ['IV7', 'V7', 'I7', 'IV7', 'V7', 'I7'] },
    { id: 'blues-slow7', name: 'Slow Burn · 7', chords: ['IV7', 'I7', 'IV7', 'V7', 'IV7', 'I7', 'V7'] },
    { id: 'blues-minor6', name: 'Minor Tint · 6', chords: ['IV7', 'I7', 'vi7', 'ii7', 'V7', 'I7'] },
    { id: 'blues-8bar5', name: 'Eight-Bar · 5', chords: ['IV7', 'V7', 'IV7', 'I7', 'V7'] },
    { id: 'blues-texas6', name: 'Texas Shuffle · 6', chords: ['IV7', 'I7', 'V7', 'IV7', 'I7', 'V7'] },
    { id: 'blues-memphis7', name: 'Memphis · 7', chords: ['IV7', 'I7', 'V7', 'IV7', 'V7', 'I7', 'IV7'] },
    { id: 'blues-late5', name: 'Late Turn · 5', chords: ['V7', 'IV7', 'I7', 'IV7', 'V7'] },
    { id: 'blues-full6', name: 'Full Cycle · 6', chords: ['IV7', 'I7', 'V7', 'I7', 'IV7', 'V7'] },
  ],
};

export const LATIN_ERA_GENRE: GenreDef = {
  id: 'latin-eras',
  label: 'Latin · Bossa & Salsa',
  mode: 'major',
  progressions: [
    { id: 'latin-bossa5', name: 'Bossa · 5', chords: ['vi7', 'ii7', 'V7', 'IV', 'Imaj7'] },
    { id: 'latin-bossa6', name: 'Bossa Climb · 6', chords: ['IVmaj7', 'ii7', 'V7', 'Imaj7', 'vi7', 'iii7'] },
    { id: 'latin-bossa7', name: 'Bossa Wave · 7', chords: ['vi7', 'ii7', 'V7', 'iii7', 'vi7', 'IVmaj7', 'Imaj7'] },
    { id: 'latin-montuno5', name: 'Montuno · 5', chords: ['IV', 'I', 'V', 'IV', 'I'] },
    { id: 'latin-salsa6', name: 'Salsa Turn · 6', chords: ['vi7', 'IVmaj7', 'V7', 'ii7', 'V7', 'Imaj7'] },
    { id: 'latin-samba7', name: 'Samba Loop · 7', chords: ['iii7', 'vi7', 'ii7', 'V7', 'IVmaj7', 'Imaj7', 'vi7'] },
    { id: 'latin-2515', name: 'Two-Five · 5', chords: ['ii7', 'V7', 'Imaj7', 'IV', 'V'] },
    { id: 'latin-cuban6', name: 'Cuban · 6', chords: ['bVII', 'IVmaj7', 'V7', 'vi7', 'ii7', 'Imaj7'] },
    { id: 'latin-romantic7', name: 'Romantic · 7', chords: ['vi7', 'ii7', 'V7', 'Imaj7', 'IVmaj7', 'V7', 'iii7'] },
    { id: 'latin-cha5', name: 'Cha Frame · 5', chords: ['IVmaj7', 'Imaj7', 'V7', 'vi7', 'ii7'] },
    { id: 'latin-tres6', name: 'Tresillo · 6', chords: ['IVmaj7', 'iii7', 'vi7', 'ii7', 'V7', 'Imaj7'] },
    { id: 'latin-long7', name: 'Long Descent · 7', chords: ['vi', 'IV', 'V', 'iii', 'vi', 'ii', 'I'] },
    { id: 'latin-minor5', name: 'Relative · 5', chords: ['vi7', 'ii7', 'V7', 'Imaj7', 'IV'] },
    { id: 'latin-flam6', name: 'Flamenco Tint · 6', chords: ['iii7', 'IVmaj7', 'V7', 'vi7', 'IV', 'Imaj7'] },
    { id: 'latin-night7', name: 'Night Club · 7', chords: ['vi7', 'IVmaj7', 'iii7', 'ii7', 'V7', 'Imaj7', 'IVmaj7'] },
  ],
};

export const KPOP_ERA_GENRE: GenreDef = {
  id: 'kpop-eras',
  label: 'K-Pop · Hooks',
  mode: 'major',
  progressions: [
    { id: 'kpop-axis5', name: 'Axis Hook · 5', chords: ['vi', 'IV', 'I', 'V', 'vi'] },
    { id: 'kpop-axis6', name: 'Axis Double · 6', chords: ['IV', 'I', 'V', 'vi', 'IV', 'I'] },
    { id: 'kpop-axis7', name: 'Axis Extended · 7', chords: ['IV', 'I', 'V', 'iii', 'vi', 'IV', 'I'] },
    { id: 'kpop-maj5', name: 'Maj7 Lift · 5', chords: ['vi7', 'IVmaj7', 'V', 'Imaj7', 'V'] },
    { id: 'kpop-chant6', name: 'Chant · 6', chords: ['IV', 'I', 'V', 'vi', 'IV', 'I'] },
    { id: 'kpop-pre7', name: 'Pre-Chorus · 7', chords: ['vi', 'iii', 'IV', 'V', 'I', 'V', 'vi'] },
    { id: 'kpop-push5', name: 'Push · 5', chords: ['IV', 'V', 'iii', 'vi', 'IV'] },
    { id: 'kpop-glow6', name: 'Glow · 6', chords: ['iii7', 'vi7', 'IV', 'V', 'Imaj7', 'V'] },
    { id: 'kpop-loop7', name: 'Full Loop · 7', chords: ['IV', 'I', 'V', 'vi', 'IV', 'I', 'V'] },
    { id: 'kpop-teen5', name: 'Teen · 5', chords: ['IV', 'V', 'vi', 'I', 'V'] },
    { id: 'kpop-emo6', name: 'Emo Lift · 6', chords: ['IV', 'V', 'I', 'V', 'vi', 'IV'] },
    { id: 'kpop-stack7', name: 'Stack · 7', chords: ['vi7', 'IVmaj7', 'V7', 'iii7', 'vi7', 'IV', 'Imaj7'] },
    { id: 'kpop-indie5', name: 'Indie · 5', chords: ['iii', 'vi', 'IV', 'V', 'I'] },
    { id: 'kpop-ballad6', name: 'Ballad · 6', chords: ['IV', 'Imaj7', 'V7', 'vi7', 'IV', 'I'] },
    { id: 'kpop-anthem7', name: 'Anthem · 7', chords: ['IV', 'vi', 'iii', 'vi', 'ii', 'V', 'I'] },
  ],
};

export const ERA_BLUES_LATIN_KPOP_GENRES: GenreDef[] = [
  BLUES_ERA_GENRE,
  LATIN_ERA_GENRE,
  KPOP_ERA_GENRE,
];
