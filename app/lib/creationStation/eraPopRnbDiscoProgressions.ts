/**
 * Curated Pop / R&B / Disco progression packs for Chord Sequencer.
 * Roman numerals only — every symbol resolves in major via {@link MODE_TABLES}.
 * Heavy maj7 / m7 / sus / borrowed-chord vocabulary for 5–7 note voicings (rich/pro).
 */

import type { GenreDef } from '@/app/lib/creationStation/chordBuilder';

/** Pop hooks and ballads — 70s through early 2000s. */
export const POP_ERA_GENRE: GenreDef = {
  id: 'pop-eras',
  label: 'Pop · 70s–2000s',
  mode: 'major',
  progressions: [
    { id: 'pop70-yacht', name: '70s · Yacht Maj7 Walk', chords: ['iii7', 'vi7', 'IVmaj7', 'ii7', 'V7', 'Imaj7'] },
    { id: 'pop70-soft', name: '70s · Soft Rock Glow', chords: ['vi7', 'IVmaj7', 'V7', 'iii7', 'Imaj7', 'ii7'] },
    { id: 'pop70-piano', name: '70s · Piano-Bar Frame', chords: ['IVmaj7', 'Imaj7', 'V7', 'vi7', 'IV', 'I'] },
    { id: 'pop70-writer', name: '70s · Writer Lift', chords: ['IV', 'V', 'I', 'IV', 'V', 'I'] },
    { id: 'pop80-power', name: '80s · Power Ballad · 5', chords: ['vi', 'V', 'IV', 'V', 'Imaj7'] },
    { id: 'pop80-whitney', name: '80s · Maj7 Turnaround · 6', chords: ['vi7', 'ii7', 'V7', 'iii7', 'IVmaj7', 'Imaj7'] },
    { id: 'pop80-synth', name: '80s · Synth Sus Resolve · 5', chords: ['IVmaj7', 'Vsus4', 'V7', 'Imaj7', 'vi7'] },
    { id: 'pop80-arena', name: '80s · Arena Axis · 4', chords: ['vi', 'IV', 'I', 'V'] },
    { id: 'pop90-axis', name: '90s · Teen Axis', chords: ['vi', 'IV', 'I', 'V', 'vi', 'IV'] },
    { id: 'pop90-sensitive', name: '90s · Sensitive Flip', chords: ['vi', 'IV', 'I', 'V', 'vi', 'IV', 'I', 'V'] },
    { id: 'pop90-boyband', name: '90s · Group Harmony', chords: ['iii7', 'vi7', 'IV', 'ii7', 'V7', 'Imaj7'] },
    { id: 'pop90-cloud', name: '90s · Maj7 Cloud', chords: ['IVmaj7', 'ii7', 'V7', 'vi7', 'Imaj7', 'iii7'] },
    { id: 'pop90-vamp', name: '90s · Two-Chord Vamp', chords: ['IVmaj7', 'Imaj7', 'IVmaj7', 'iii7', 'vi7', 'ii7'] },
    { id: 'pop00-axis', name: '2000s · Axis Hook', chords: ['vi', 'IV', 'I', 'V', 'vi', 'IV'] },
    { id: 'pop00-emo', name: '2000s · Emo Lift', chords: ['vi', 'V', 'IV', 'V', 'I', 'V', 'vi', 'IV'] },
    { id: 'pop00-indie', name: '2000s · Indie Color', chords: ['iii', 'vi', 'IV', 'ii', 'V', 'I', 'iii'] },
    { id: 'pop00-borrow', name: '2000s · Borrowed Sky', chords: ['bVII', 'IV', 'V', 'vi7', 'Imaj7', 'IVmaj7'] },
    { id: 'pop00-dark', name: '2000s · Dark Topline', chords: ['vi', 'bVI', 'bVII', 'V', 'IV', 'I'] },
    { id: 'pop80-rise', name: '80s · Pre-Chorus Rise', chords: ['vi', 'iii', 'IV', 'V', 'I', 'V', 'vi', 'IV'] },
  ],
};

/** Classic R&B / quiet storm — slow jams through alt-R&B. */
export const RNB_ERA_GENRE: GenreDef = {
  id: 'rnb-eras',
  label: 'R&B · Slow Jam',
  mode: 'major',
  progressions: [
    { id: 'rnb70-soulturn', name: '70s · Soul Turnaround · 5', chords: ['vi7', 'ii7', 'V7', 'Imaj7', 'IVmaj7'] },
    { id: 'rnb70-lush', name: '70s · Lush Descent · 6', chords: ['IVmaj7', 'iii7', 'vi7', 'ii7', 'V7', 'Imaj7'] },
    { id: 'rnb70-quiet', name: '70s · Quiet Storm · 5', chords: ['vi7', 'ii7', 'Imaj7', 'IVmaj7', 'V7'] },
    { id: 'rnb70-philly', name: '70s · Philly Strings', chords: ['bIII', 'IVmaj7', 'V7', 'vi7', 'ii7', 'Imaj7'] },
    { id: 'rnb70-ewf', name: '70s · Horn Section Loop', chords: ['bVII', 'IVmaj7', 'Imaj7', 'iii7', 'vi7', 'ii7'] },
    { id: 'rnb70-marvin', name: '70s · Dominant-IV Soul', chords: ['IV7', 'iii7', 'vi7', 'ii7', 'V7', 'Imaj7'] },
    { id: 'rnb70-curtis', name: '70s · Jazz-Soul Walk', chords: ['vi7', 'ii7', 'V7', 'Imaj7', 'IVmaj7', 'iii7'] },
    { id: 'rnb70-stevie', name: '70s · Sunny Climb · 7', chords: ['iii7', 'IVmaj7', 'V7', 'vi7', 'ii7', 'V7', 'Imaj7'] },
    { id: 'rnb80-vandross', name: '80s · Smooth Ballad', chords: ['vi7', 'IVmaj7', 'V7', 'iii7', 'ii7', 'V7', 'Imaj7', 'IVmaj7'] },
    { id: 'rnb80-luther', name: '80s · Turnaround Cycle', chords: ['ii7', 'V7', 'iii7', 'vi7', 'IVmaj7', 'Imaj7'] },
    { id: 'rnb80-sade', name: '80s · Silk Descent', chords: ['IVmaj7', 'iii7', 'ii7', 'Imaj7', 'vi7', 'ii7', 'V7'] },
    { id: 'rnb80-prayer', name: '80s · Prayer Cadence', chords: ['iiø7', 'V7', 'IVmaj7', 'iii7', 'vi7', 'Imaj7'] },
    { id: 'rnb90-slowjam', name: '90s · Slow Jam', chords: ['vi7', 'ii7', 'V7', 'IVmaj7', 'iii7', 'Imaj7', 'IVmaj7'] },
    { id: 'rnb90-jodeci', name: '90s · Group Harmony', chords: ['iii7', 'vi7', 'V7', 'IVmaj7', 'ii7', 'Imaj7'] },
    { id: 'rnb90-sus', name: '90s · Sus Resolve', chords: ['IVmaj7', 'Vsus4', 'V7', 'vi7', 'Imaj7', 'ii7'] },
    { id: 'rnb90-church', name: '90s · Church Color', chords: ['bVII', 'IVmaj7', 'V7', 'vi7', 'ii7', 'Imaj7'] },
    { id: 'rnb90-diva', name: '90s · Diva Turn', chords: ['vi7', 'IVmaj7', 'Imaj7', 'V7', 'iii7', 'vi7', 'IVmaj7'] },
    { id: 'rnb00-neo', name: '2000s · Neo Loop', chords: ['ii7', 'iii7', 'vi7', 'IVmaj7', 'V7', 'Imaj7'] },
    { id: 'rnb00-tender', name: '2000s · Tender Half-Dim', chords: ['iiø7', 'V7', 'Imaj7', 'vi7', 'IVmaj7', 'iii7'] },
    { id: 'rnb00-deepsoul', name: '2000s · Deep Soul Borrow', chords: ['bVI', 'bVII', 'Imaj7', 'vi7', 'IVmaj7', 'V7', 'ii7'] },
    { id: 'rnb90-babyface', name: '90s · Babyface Ballad · 6', chords: ['vi7', 'IVmaj7', 'V7', 'iii7', 'ii7', 'Imaj7'] },
    { id: 'rnb90-tlc', name: '90s · New Jack Turn · 5', chords: ['vi7', 'IVmaj7', 'Imaj7', 'V7', 'ii7'] },
    { id: 'rnb00-usher', name: '2000s · Club R&B · 5', chords: ['iii7', 'vi7', 'V7', 'IVmaj7', 'Imaj7'] },
    { id: 'rnb00-alicia', name: '2000s · Piano Soul · 6', chords: ['IVmaj7', 'ii7', 'V7', 'vi7', 'Imaj7', 'iii7'] },
    { id: 'rnb10-weeknd', name: '2010s · Dark R&B · 6', chords: ['vi7', 'bVI', 'bVII', 'V7', 'IVmaj7', 'Imaj7'] },
    { id: 'rnb10-sza', name: '2010s · Alt R&B Loop · 5', chords: ['vi7', 'IVmaj7', 'Imaj7', 'V7', 'iii7'] },
    { id: 'rnb10-brent', name: '2010s · Late-Night · 6', chords: ['vi7', 'ii7', 'V7', 'IVmaj7', 'iii7', 'Imaj7'] },
  ],
};

/** Disco / boogie / nu-disco — four-on-the-floor harmony. */
export const DISCO_ERA_GENRE: GenreDef = {
  id: 'disco-eras',
  label: 'Disco · 70s–2000s',
  mode: 'major',
  progressions: [
    { id: 'disco70-classic', name: '70s · Classic Turn · 5', chords: ['vi7', 'ii7', 'V7', 'Imaj7', 'IVmaj7'] },
    { id: 'disco70-vamp', name: '70s · Mirror-Ball Vamp · 4', chords: ['IVmaj7', 'Imaj7', 'IVmaj7', 'Imaj7'] },
    { id: 'disco70-strings', name: '70s · String Descent · 6', chords: ['IVmaj7', 'iii7', 'ii7', 'Imaj7', 'vi7', 'V7'] },
    { id: 'disco70-saturday', name: '70s · Saturday Night', chords: ['vi7', 'ii7', 'V7', 'Imaj7', 'IVmaj7', 'V7'] },
    { id: 'disco70-funk', name: '70s · Funk Disco', chords: ['ii7', 'V7', 'Imaj7', 'IV7', 'vi7', 'ii7'] },
    { id: 'disco70-anthem', name: '70s · Dominant Anthem', chords: ['V7', 'vi7', 'IV7', 'Imaj7', 'V7', 'ii7'] },
    { id: 'disco70-nile', name: '70s · Boogie Shine', chords: ['iii7', 'IV7', 'V7', 'Imaj7', 'IVmaj7', 'vi7'] },
    { id: 'disco70-chic', name: '70s · Chic Boogie', chords: ['ii7', 'V7', 'Imaj7', 'IV7', 'V7', 'vi7'] },
    { id: 'disco70-philly', name: '70s · Philly Disco', chords: ['bIII', 'IVmaj7', 'V7', 'vi7', 'ii7', 'Imaj7'] },
    { id: 'disco70-love', name: '70s · Love Unlimited', chords: ['iii7', 'vi7', 'IVmaj7', 'ii7', 'V7', 'Imaj7', 'IV7'] },
    { id: 'disco80-euro', name: '80s · Euro Disco', chords: ['bVII', 'IVmaj7', 'V7', 'vi7', 'Imaj7', 'ii7'] },
    { id: 'disco80-italo', name: '80s · Italo Lift', chords: ['vi7', 'IVmaj7', 'Imaj7', 'V7', 'iii7', 'vi7'] },
    { id: 'disco80-post', name: '80s · Post-Disco', chords: ['vi7', 'ii7', 'V7', 'IVmaj7', 'Imaj7', 'V7'] },
    { id: 'disco80-boogie', name: '80s · Boogie Dominant', chords: ['I7', 'IVmaj7', 'V7', 'vi7', 'IV7', 'Imaj7'] },
    { id: 'disco90-filter', name: '90s · Filter House', chords: ['vi7', 'IVmaj7', 'V7', 'ii7', 'Imaj7', 'V7'] },
    { id: 'disco90-french', name: '90s · French Touch', chords: ['ii7', 'V7', 'Imaj7', 'IVmaj7', 'vi7', 'V7'] },
    { id: 'disco00-nu', name: '2000s · Nu-Disco Loop', chords: ['IVmaj7', 'ii7', 'V7', 'vi7', 'Imaj7', 'iii7'] },
    { id: 'disco00-dancepop', name: '2000s · Dance-Pop Turn', chords: ['vi7', 'IVmaj7', 'I', 'V', 'vi7', 'IVmaj7', 'I', 'V'] },
    { id: 'disco00-daft', name: '2000s · Filter Borrow', chords: ['bVI', 'IVmaj7', 'V7', 'vi7', 'ii7', 'Imaj7'] },
    { id: 'disco70-roll', name: '70s · Rolling Turn', chords: ['IV7', 'ii7', 'V7', 'Imaj7', 'IVmaj7', 'iii7', 'vi7', 'ii7'] },
  ],
};

export const ERA_POP_RNB_DISCO_GENRES: GenreDef[] = [
  POP_ERA_GENRE,
  RNB_ERA_GENRE,
  DISCO_ERA_GENRE,
];
