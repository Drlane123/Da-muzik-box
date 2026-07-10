/**
 * Minor-key progression add-ons for major-family genre packs.
 * Merged into {@link GENRES} at load — every pack gets minor presets for the wheel.
 */
import type { ChordMode, ProgressionDef } from '@/app/lib/creationStation/chordBuilder';

type MinorProg = ProgressionDef & { mode: ChordMode };

const soul4 = (pfx: string): MinorProg[] => [
  { id: `${pfx}-min-soul`, name: 'Minor Soul (i7-iv7-VImaj7-V7)', mode: 'minor', chords: ['i7', 'iv7', 'VImaj7', 'V7'] },
  { id: `${pfx}-min-walk`, name: 'Minor Walk (i7-VII7-VImaj7-iv7)', mode: 'minor', chords: ['i7', 'VII7', 'VImaj7', 'iv7'] },
  { id: `${pfx}-min-25`, name: 'Minor Two-Five (i7-iiø7-V7-i7)', mode: 'minor', chords: ['i7', 'iiø7', 'V7', 'i7'] },
  { id: `${pfx}-min-heart`, name: 'Minor Heart (i7-bVI-bVII-i7)', mode: 'minor', chords: ['i7', 'bVI', 'bVII', 'i7'] },
];

const pop4 = (pfx: string): MinorProg[] => [
  { id: `${pfx}-min-axis`, name: 'Minor Axis (i-VI-III-VII)', mode: 'minor', chords: ['i', 'VI', 'III', 'VII'] },
  { id: `${pfx}-min-walk`, name: 'Minor Walk (i-iv-VII-VI)', mode: 'minor', chords: ['i', 'iv', 'VII', 'VI'] },
  { id: `${pfx}-min-heart`, name: 'Minor Heart (i-bVI-bVII-i)', mode: 'minor', chords: ['i', 'bVI', 'bVII', 'i'] },
  { id: `${pfx}-min-loop`, name: 'Minor Loop (i-VII-VI-VII)', mode: 'minor', chords: ['i', 'VII', 'VI', 'VII'] },
];

const club4 = (pfx: string): MinorProg[] => [
  { id: `${pfx}-min-disco`, name: 'Minor Disco (i7-IV7-bVII-i7)', mode: 'dorian', chords: ['i7', 'IV7', 'bVII', 'i7'] },
  { id: `${pfx}-min-floor`, name: 'Minor Floor (i7-VImaj7-VII7-i7)', mode: 'minor', chords: ['i7', 'VImaj7', 'VII7', 'i7'] },
  { id: `${pfx}-min-drive`, name: 'Minor Drive (i7-iv7-V7-VImaj7)', mode: 'minor', chords: ['i7', 'iv7', 'V7', 'VImaj7'] },
  { id: `${pfx}-min-night`, name: 'Minor Night (i-VII-VI-V)', mode: 'minor', chords: ['i', 'VII', 'VI', 'V'] },
];

const jazz4 = (pfx: string): MinorProg[] => [
  { id: `${pfx}-min-251`, name: 'Minor ii-V-i (i7-iiø7-V7-i7)', mode: 'minor', chords: ['i7', 'iiø7', 'V7', 'i7'] },
  { id: `${pfx}-min-turn`, name: 'Minor Turn (i7-VImaj7-iiø7-V7)', mode: 'minor', chords: ['i7', 'VImaj7', 'iiø7', 'V7'] },
  { id: `${pfx}-min-blues`, name: 'Minor Blues (i7-iv7-V7-i7)', mode: 'minor', chords: ['i7', 'iv7', 'V7', 'i7'] },
  { id: `${pfx}-min-late`, name: 'Late Minor (i7-VII7-iv7-i7)', mode: 'minor', chords: ['i7', 'VII7', 'iv7', 'i7'] },
];

const blues4 = (pfx: string): MinorProg[] => [
  { id: `${pfx}-min-shuffle`, name: 'Minor Shuffle (i7-iv7-i7-V7)', mode: 'minor', chords: ['i7', 'iv7', 'i7', 'V7'] },
  { id: `${pfx}-min-slow`, name: 'Slow Minor (i7-iv7-V7-i7)', mode: 'minor', chords: ['i7', 'iv7', 'V7', 'i7'] },
  { id: `${pfx}-min-borrow`, name: 'Borrowed Minor (i-bVI-bVII-i)', mode: 'minor', chords: ['i', 'bVI', 'bVII', 'i'] },
  { id: `${pfx}-min-turn`, name: 'Minor Turn (i7-VII7-iv7-i7)', mode: 'minor', chords: ['i7', 'VII7', 'iv7', 'i7'] },
];

const latin4 = (pfx: string): MinorProg[] => [
  { id: `${pfx}-min-bossa`, name: 'Bossa Minor (i7-VImaj7-iiø7-V7)', mode: 'minor', chords: ['i7', 'VImaj7', 'iiø7', 'V7'] },
  { id: `${pfx}-min-montuno`, name: 'Montuno Minor (i7-iv7-V7-i7)', mode: 'minor', chords: ['i7', 'iv7', 'V7', 'i7'] },
  { id: `${pfx}-min-salsa`, name: 'Salsa Minor (i7-VII7-VImaj7-iv7)', mode: 'minor', chords: ['i7', 'VII7', 'VImaj7', 'iv7'] },
  { id: `${pfx}-min-night`, name: 'Latin Night (i-III-VII-i)', mode: 'minor', chords: ['i', 'III', 'VII', 'i'] },
];

const gospel4 = (pfx: string): MinorProg[] => [
  { id: `${pfx}-min-amen`, name: 'Minor Amen (i7-iv7-V7-i7)', mode: 'minor', chords: ['i7', 'iv7', 'V7', 'i7'] },
  { id: `${pfx}-min-praise`, name: 'Minor Praise (i-bVI-bVII-V7)', mode: 'minor', chords: ['i', 'bVI', 'bVII', 'V7'] },
  { id: `${pfx}-min-25`, name: 'Minor Gospel 2-5 (i7-iiø7-V7-i7)', mode: 'minor', chords: ['i7', 'iiø7', 'V7', 'i7'] },
  { id: `${pfx}-min-circle`, name: 'Minor Circle (i7-VImaj7-iv7-V7)', mode: 'minor', chords: ['i7', 'VImaj7', 'iv7', 'V7'] },
];

const rock4 = (pfx: string): MinorProg[] => [
  { id: `${pfx}-min-grunge`, name: 'Minor Grunge (i-VII-VI-VII)', mode: 'minor', chords: ['i', 'VII', 'VI', 'VII'] },
  { id: `${pfx}-min-power`, name: 'Minor Power (i-iv-VII-VI)', mode: 'minor', chords: ['i', 'iv', 'VII', 'VI'] },
  { id: `${pfx}-min-emo`, name: 'Minor Emo (i-bVI-bVII-V)', mode: 'minor', chords: ['i', 'bVI', 'bVII', 'V'] },
  { id: `${pfx}-min-anthem`, name: 'Minor Anthem (i-iv-V-VII)', mode: 'minor', chords: ['i', 'iv', 'V', 'VII'] },
];

const lofi4 = (pfx: string): MinorProg[] => [
  { id: `${pfx}-min-chill`, name: 'Minor Chill (i7-VImaj7-iv7-V7)', mode: 'minor', chords: ['i7', 'VImaj7', 'iv7', 'V7'] },
  { id: `${pfx}-min-rainy`, name: 'Rainy Minor (i7-VII7-VImaj7-iv7)', mode: 'minor', chords: ['i7', 'VII7', 'VImaj7', 'iv7'] },
  { id: `${pfx}-min-study`, name: 'Study Minor (i7-iv7-VII7-i7)', mode: 'minor', chords: ['i7', 'iv7', 'VII7', 'i7'] },
  { id: `${pfx}-min-dusk`, name: 'Dusk Minor (i7-iiø7-V7-i7)', mode: 'minor', chords: ['i7', 'iiø7', 'V7', 'i7'] },
];

const country4 = (pfx: string): MinorProg[] => [
  { id: `${pfx}-min-ballad`, name: 'Minor Ballad (i-VII-VI-V)', mode: 'minor', chords: ['i', 'VII', 'VI', 'V'] },
  { id: `${pfx}-min-highway`, name: 'Highway Minor (i-iv-VII-i)', mode: 'minor', chords: ['i', 'iv', 'VII', 'i'] },
  { id: `${pfx}-min-heartland`, name: 'Heartland (i-bVI-bVII-i)', mode: 'minor', chords: ['i', 'bVI', 'bVII', 'i'] },
  { id: `${pfx}-min-train`, name: 'Minor Train (i-iv-V-VII)', mode: 'minor', chords: ['i', 'iv', 'V', 'VII'] },
];

/** Four minor presets per major-family pack (ids are unique per genre prefix). */
export const GENRE_MINOR_EXPANSIONS: Record<string, readonly ProgressionDef[]> = {
  'pop-eras': pop4('poperas'),
  'rnb-eras': soul4('rnberas'),
  'disco-eras': club4('discoeras'),
  'soul-eras': soul4('souleras'),
  'neo-soul-eras': soul4('neosouleras'),
  'blues-eras': blues4('blueseras'),
  'latin-eras': latin4('latineras'),
  'kpop-eras': pop4('kpoperas'),
  pop: pop4('pop'),
  doowop: pop4('doowop'),
  'ballad-80s': soul4('ballad80s'),
  disco: club4('disco'),
  dance: club4('dance'),
  gospel: gospel4('gospel'),
  jazz: jazz4('jazz'),
  rock: rock4('rock'),
  blues: blues4('blues'),
  lofi: lofi4('lofi'),
  country: country4('country'),
};
