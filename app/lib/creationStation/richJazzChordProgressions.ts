/**
 * Rich Jazz · Neo — original progressive packs for SE2 Chord Generator.
 * Building-blocks style shelves: rich jazz, 70s soul jazz, neo-jazz / modal,
 * dark jazz, gospel jazz. Public-domain harmonic language (ii–V color,
 * maj9 / m9 / 13 / ø7) — not copied from any commercial MIDI pack.
 */

import type { GenreDef } from '@/app/lib/creationStation/chordBuilder';

export const RICH_JAZZ_GENRE: GenreDef = {
  id: 'rich-jazz',
  label: 'Rich Jazz · Neo',
  mode: 'major',
  progressions: [
    // ── Rich jazz — extended ii–V / turnarounds ────────────────────────────
    {
      id: 'rjazz-lush-251',
      name: 'Jazz · Lush ii–V–I · 6',
      chords: ['ii9', 'V13', 'Imaj9', 'vi9', 'ii9', 'V13sus'],
    },
    {
      id: 'rjazz-circle-fourths',
      name: 'Jazz · Circle of Fourths · 8',
      chords: ['ii9', 'V13', 'Imaj9', 'IVmaj9', 'vii°', 'iii9', 'vi9', 'V13'],
    },
    {
      id: 'rjazz-rhythm-turn',
      name: 'Jazz · Rhythm Turnaround · 8',
      chords: ['Imaj9', 'vi9', 'ii9', 'V13', 'Imaj9', 'vi9', 'ii9', 'V13sus'],
    },
    {
      id: 'rjazz-tender-half',
      name: 'Jazz · Tender Half-Dim · 7',
      chords: ['Imaj9', 'iiø7', 'V13', 'Imaj9', 'IVmaj9', 'iii9', 'V13'],
    },
    {
      id: 'rjazz-backdoor',
      name: 'Jazz · Backdoor Cadence · 6',
      chords: ['Imaj9', 'bVIImaj9', 'IVmaj9', 'Imaj9', 'ii9', 'V13'],
    },
    {
      id: 'rjazz-tritone-glide',
      name: 'Jazz · Tritone Glide · 7',
      chords: ['ii9', 'bIImaj7', 'Imaj9', 'vi9', 'ii9', 'V13', 'Imaj9'],
    },
    {
      id: 'rjazz-west-coast',
      name: 'Jazz · West Coast Cool · 8',
      chords: ['IVmaj9', 'iii9', 'vi9', 'ii9', 'V13', 'Imaj9', 'vi9', 'V13sus'],
    },
    {
      id: 'rjazz-ballad-mist',
      name: 'Jazz · Ballad Mist · 8',
      chords: ['Imaj9', 'IVmaj9', 'iii9', 'vi9', 'iiø7', 'V13', 'Imaj9', 'vi9'],
    },
    {
      id: 'rjazz-chromatic-maj9',
      name: 'Jazz · Chromatic Maj9 · 6',
      chords: ['Imaj9', 'bIIImaj9', 'bVImaj9', 'Imaj9', 'ii9', 'V13'],
    },
    {
      id: 'rjazz-bird-blues',
      name: 'Jazz · Bebop Blues Pocket · 8',
      chords: ['Imaj7', 'IV7', 'Imaj7', 'vi7', 'ii7', 'V7', 'Imaj7', 'V7'],
    },
    // ── 70s soul jazz ──────────────────────────────────────────────────────
    {
      id: 'rjazz-70s-velvet',
      name: '70s · Velvet Soul Jazz · 7',
      chords: ['Imaj9', 'vi9', 'ii9', 'V13', 'IVmaj9', 'iii9', 'V13sus'],
    },
    {
      id: 'rjazz-70s-porch',
      name: '70s · Porch Rhodes · 8',
      chords: ['Imaj9', 'iii9', 'IVmaj9', 'V13', 'vi9', 'ii9', 'V13', 'Imaj9'],
    },
    {
      id: 'rjazz-70s-honey',
      name: '70s · Honey Cycle · 6',
      chords: ['ii9', 'V13', 'iii9', 'vi9', 'IVmaj9', 'V13'],
    },
    {
      id: 'rjazz-70s-church',
      name: '70s · Quiet Church · 7',
      chords: ['Imaj9', 'iiø7', 'V13', 'IVmaj9', 'iii9', 'vi9', 'V13sus'],
    },
    {
      id: 'rjazz-70s-falsetto',
      name: '70s · Falsetto Ninths · 7',
      chords: ['iii9', 'vi9', 'ii9', 'V13', 'Imaj9', 'IVmaj9', 'V13sus'],
    },
    {
      id: 'rjazz-70s-silk-13',
      name: '70s · Silk 13sus · 8',
      chords: ['Imaj9', 'V13sus', 'V13', 'vi9', 'IVmaj9', 'iii9', 'ii9', 'V13'],
    },
    {
      id: 'rjazz-70s-philly',
      name: '70s · Philly Walk · 6',
      chords: ['vi9', 'ii9', 'V13', 'Imaj9', 'IVmaj9', 'V13sus'],
    },
    {
      id: 'rjazz-70s-memphis',
      name: '70s · Memphis Glow · 7',
      chords: ['Imaj9', 'IVmaj9', 'iii9', 'vi9', 'iiø7', 'V13', 'Imaj9'],
    },
    {
      id: 'rjazz-70s-backdoor',
      name: '70s · Soft Backdoor · 6',
      chords: ['Imaj9', 'IV7', 'iv', 'Imaj9', 'ii9', 'V13'],
    },
    {
      id: 'rjazz-70s-widescreen',
      name: '70s · Widescreen Soul · 8',
      chords: ['Imaj9', 'bIIImaj9', 'IVmaj9', 'V13', 'vi9', 'ii9', 'V13sus', 'Imaj9'],
    },
    // ── Neo-jazz / modal ───────────────────────────────────────────────────
    {
      id: 'rjazz-neo-modal',
      name: 'Neo · Modal Crawl · 7',
      mode: 'dorian',
      chords: ['i9', 'ii9', 'bIIImaj9', 'IV13', 'i9', 'bVIImaj9', 'IV9'],
    },
    {
      id: 'rjazz-neo-im9-iv13',
      name: 'Neo · im9–IV13 Vamp · 6',
      mode: 'dorian',
      chords: ['i9', 'IV13', 'i9', 'bVIImaj9', 'ii9', 'IV9'],
    },
    {
      id: 'rjazz-neo-float',
      name: 'Neo · Float Turn · 8',
      chords: ['Imaj9', 'iii9', 'vi9', 'IVmaj9', 'ii9', 'V13', 'iii9', 'vi9'],
    },
    {
      id: 'rjazz-neo-earth',
      name: 'Neo · Earth Tone · 7',
      mode: 'dorian',
      chords: ['bIIImaj9', 'i9', 'IV13', 'bVIImaj9', 'ii9', 'i9', 'IV9'],
    },
    {
      id: 'rjazz-neo-candle',
      name: 'Neo · Candlelight · 6',
      chords: ['Imaj9', 'vi9', 'iiø7', 'V13', 'IVmaj9', 'iii9'],
    },
    {
      id: 'rjazz-neo-liquid',
      name: 'Neo · Liquid Minor · 7',
      mode: 'minor',
      chords: ['i9', 'iv9', 'VII7', 'bIIImaj9', 'VImaj9', 'iiø7', 'V13'],
    },
    {
      id: 'rjazz-neo-soft-jazz',
      name: 'Neo · Soft Jazz Cycle · 6',
      chords: ['ii9', 'V13', 'Imaj9', 'bVIImaj9', 'IVmaj9', 'V13sus'],
    },
    {
      id: 'rjazz-neo-orchid',
      name: 'Neo · Orchid Pad · 8',
      chords: ['Imaj9', 'bVImaj9', 'bVIImaj9', 'IVmaj9', 'iii9', 'vi9', 'ii9', 'V13'],
    },
    {
      id: 'rjazz-neo-prayer',
      name: 'Neo · Prayer Ladder · 7',
      chords: ['Imaj9', 'iiø7', 'V13', 'IVmaj9', 'iii9', 'vi9', 'ii9'],
    },
    {
      id: 'rjazz-neo-velvet-ii',
      name: 'Neo · Velvet II–V · 8',
      chords: ['ii9', 'V13', 'Imaj9', 'vi9', 'iiø7', 'V13', 'Imaj9', 'IVmaj9'],
    },
    // ── Dark jazz / late-night ─────────────────────────────────────────────
    {
      id: 'rjazz-dark-smoke',
      name: 'Dark · Smoky Minor 9 · 7',
      mode: 'minor',
      chords: ['i9', 'VImaj9', 'iiø7', 'V13', 'i9', 'iv9', 'V13'],
    },
    {
      id: 'rjazz-dark-midnight',
      name: 'Dark · Midnight Minor · 8',
      mode: 'minor',
      chords: ['i9', 'VImaj9', 'iv9', 'V13', 'bIIImaj9', 'VImaj9', 'iiø7', 'V13'],
    },
    {
      id: 'rjazz-dark-boom',
      name: 'Dark · Boom-Bap Jazz · 6',
      mode: 'minor',
      chords: ['i9', 'bVImaj9', 'bVII', 'i9', 'iv9', 'V13'],
    },
    {
      id: 'rjazz-dark-neon',
      name: 'Dark · Late Neon · 7',
      mode: 'minor',
      chords: ['i9', 'VII7', 'VImaj9', 'V13', 'i9', 'bIIImaj9', 'VImaj9'],
    },
    {
      id: 'rjazz-dark-heartbreak',
      name: 'Dark · Heartbreak m9 · 6',
      mode: 'minor',
      chords: ['i9', 'bVI', 'bVII', 'i9', 'iv9', 'V13'],
    },
    {
      id: 'rjazz-dark-crate',
      name: 'Dark · Crate Dig · 8',
      mode: 'dorian',
      chords: ['i9', 'IV13', 'bVIImaj9', 'ii9', 'i9', 'bIIImaj9', 'IV9', 'bVIImaj9'],
    },
    // ── Gospel jazz lifts ──────────────────────────────────────────────────
    {
      id: 'rjazz-gospel-lift',
      name: 'Gospel · Jazz Lift · 7',
      chords: ['Imaj9', 'IVmaj9', 'ii9', 'V13', 'iii9', 'vi9', 'V13sus'],
    },
    {
      id: 'rjazz-gospel-shout',
      name: 'Gospel · Soft Shout · 6',
      chords: ['IVmaj9', 'Imaj9', 'V13', 'IVmaj9', 'iii9', 'vi9'],
    },
    {
      id: 'rjazz-gospel-walk',
      name: 'Gospel · Walk-Up · 8',
      chords: ['vi9', 'ii9', 'V13', 'Imaj9', 'IVmaj9', 'iii9', 'vi9', 'V13'],
    },
    {
      id: 'rjazz-gospel-amen',
      name: 'Gospel · Amen Jazz · 6',
      chords: ['Imaj9', 'IVmaj9', 'Imaj9', 'V13', 'ii9', 'V13sus'],
    },
    {
      id: 'rjazz-gospel-minor',
      name: 'Gospel · Minor Resolve · 7',
      mode: 'minor',
      chords: ['i9', 'iv9', 'V13', 'VImaj9', 'iiø7', 'V13', 'i9'],
    },
    // ── Extra rich shelf (building-blocks depth) ───────────────────────────
    {
      id: 'rjazz-rootless-251',
      name: 'Jazz · Rootless ii–V · 6',
      chords: ['ii9', 'V13', 'Imaj9', 'vi9', 'iiø7', 'V13'],
    },
    {
      id: 'rjazz-descending-maj9',
      name: 'Jazz · Descending Maj9 · 8',
      chords: ['Imaj9', 'vii°', 'vi9', 'V13', 'IVmaj9', 'iii9', 'ii9', 'V13sus'],
    },
    {
      id: 'rjazz-secondary-dom',
      name: 'Jazz · Secondary Color · 7',
      chords: ['Imaj9', 'iii9', 'vi9', 'ii9', 'V13', 'IVmaj9', 'V13sus'],
    },
    {
      id: 'rjazz-plagal-soul',
      name: 'Jazz · Plagal Soul · 6',
      chords: ['Imaj9', 'IVmaj9', 'Imaj9', 'vi9', 'ii9', 'V13'],
    },
    {
      id: 'rjazz-sus-resolve',
      name: 'Jazz · Sus Resolve · 8',
      chords: ['ii9', 'V13sus', 'V13', 'Imaj9', 'vi9', 'ii9', 'V13sus', 'Imaj9'],
    },
    {
      id: 'rjazz-70s-amber',
      name: '70s · Amber Turn · 7',
      chords: ['Imaj9', 'vi9', 'IVmaj9', 'ii9', 'V13sus', 'V13', 'iii9'],
    },
    {
      id: 'rjazz-70s-candle',
      name: '70s · Candle Maj9 · 8',
      chords: ['Imaj9', 'IVmaj9', 'iii9', 'vi9', 'iiø7', 'V13', 'Imaj9', 'vi9'],
    },
    {
      id: 'rjazz-70s-bittersweet',
      name: '70s · Bittersweet Ninth · 7',
      chords: ['Imaj9', 'IVmaj9', 'iii9', 'bVIImaj9', 'vi9', 'ii9', 'V13'],
    },
    {
      id: 'rjazz-70s-orchid',
      name: '70s · Orchid Maj9 · 6',
      chords: ['Imaj9', 'bVImaj9', 'bVIImaj9', 'IVmaj9', 'V13', 'Imaj9'],
    },
    {
      id: 'rjazz-70s-quiet-storm',
      name: '70s · Quiet Storm Maj9 · 8',
      chords: ['Imaj9', 'vi9', 'ii9', 'V13', 'IVmaj9', 'iii9', 'vi9', 'V13'],
    },
    {
      id: 'rjazz-neo-wick',
      name: 'Neo · Wick Groove · 6',
      mode: 'dorian',
      chords: ['ii9', 'i9', 'IV13', 'bVIImaj9', 'ii9', 'IV9'],
    },
    {
      id: 'rjazz-neo-silk-turn',
      name: 'Neo · Silk Turn · 8',
      chords: ['ii9', 'V13', 'Imaj9', 'vi9', 'IVmaj9', 'iii9', 'vi9', 'ii9'],
    },
    {
      id: 'rjazz-neo-pocket',
      name: 'Neo · Pocket Love · 7',
      mode: 'dorian',
      chords: ['bVIImaj9', 'i9', 'IV13', 'ii9', 'i9', 'bVIImaj9', 'IV9'],
    },
    {
      id: 'rjazz-neo-warm-spoken',
      name: 'Neo · Warm Spoken · 6',
      mode: 'dorian',
      chords: ['ii9', 'i9', 'IV13', 'bVIImaj9', 'i9', 'ii9'],
    },
    {
      id: 'rjazz-neo-electric',
      name: 'Neo · Electric Church · 8',
      chords: ['IVmaj9', 'Imaj9', 'iii9', 'vi9', 'ii9', 'V13', 'IVmaj9', 'Imaj9'],
    },
    {
      id: 'rjazz-dark-rain',
      name: 'Dark · Rain Window · 7',
      mode: 'minor',
      chords: ['i9', 'iv9', 'bVImaj9', 'bVII', 'i9', 'iiø7', 'V13'],
    },
    {
      id: 'rjazz-dark-vinyl',
      name: 'Dark · Dusty Vinyl · 8',
      mode: 'minor',
      chords: ['i9', 'bVImaj9', 'iv9', 'V13', 'bIIImaj9', 'bVImaj9', 'iiø7', 'i9'],
    },
    {
      id: 'rjazz-dark-offbeat',
      name: 'Dark · Offbeat Vamp · 6',
      mode: 'dorian',
      chords: ['i9', 'IV13', 'i9', 'bVIImaj9', 'ii9', 'IV13'],
    },
    {
      id: 'rjazz-gospel-choir',
      name: 'Gospel · Choir Stack · 7',
      chords: ['IVmaj9', 'Imaj9', 'vi9', 'V13', 'iii9', 'IVmaj9', 'V13sus'],
    },
    // ── Extra building-blocks shelf ────────────────────────────────────────
    {
      id: 'rjazz-coltrane-lite',
      name: 'Jazz · Soft Matrix · 8',
      chords: ['Imaj9', 'bVImaj9', 'bIIImaj9', 'IVmaj9', 'ii9', 'V13', 'vi9', 'V13sus'],
    },
    {
      id: 'rjazz-drop-two-251',
      name: 'Jazz · Drop-Two ii–V · 6',
      chords: ['ii9', 'V13', 'Imaj9', 'IVmaj9', 'iii9', 'V13sus'],
    },
    {
      id: 'rjazz-side-slip',
      name: 'Jazz · Side-Slip Color · 7',
      chords: ['Imaj9', 'bIIImaj9', 'ii9', 'V13', 'vi9', 'IVmaj9', 'V13sus'],
    },
    {
      id: 'rjazz-tonicization',
      name: 'Jazz · Soft Tonicization · 8',
      chords: ['Imaj9', 'iii9', 'vi9', 'ii9', 'V13', 'Imaj9', 'vi9', 'V13sus'],
    },
    {
      id: 'rjazz-70s-copper',
      name: '70s · Copper Rhodes · 7',
      chords: ['Imaj9', 'IVmaj9', 'V13sus', 'V13', 'vi9', 'ii9', 'Imaj9'],
    },
    {
      id: 'rjazz-70s-suede',
      name: '70s · Suede Walk · 8',
      chords: ['vi9', 'ii9', 'V13', 'Imaj9', 'iii9', 'vi9', 'IVmaj9', 'V13sus'],
    },
    {
      id: 'rjazz-70s-late-show',
      name: '70s · Late Show · 6',
      chords: ['Imaj9', 'vi9', 'bVIImaj9', 'IVmaj9', 'ii9', 'V13'],
    },
    {
      id: 'rjazz-neo-dew',
      name: 'Neo · Morning Dew · 7',
      mode: 'dorian',
      chords: ['i9', 'bVIImaj9', 'IV13', 'ii9', 'i9', 'IV9', 'bIIImaj9'],
    },
    {
      id: 'rjazz-neo-linen',
      name: 'Neo · Linen Pad · 8',
      chords: ['Imaj9', 'vi9', 'iiø7', 'V13sus', 'IVmaj9', 'iii9', 'vi9', 'ii9'],
    },
    {
      id: 'rjazz-neo-cedar',
      name: 'Neo · Cedar Modal · 6',
      mode: 'dorian',
      chords: ['bVIImaj9', 'IV13', 'i9', 'ii9', 'bIIImaj9', 'IV9'],
    },
    {
      id: 'rjazz-dark-ink',
      name: 'Dark · Ink Pool · 7',
      mode: 'minor',
      chords: ['i9', 'iiø7', 'V13', 'bVImaj9', 'iv9', 'V13', 'i9'],
    },
    {
      id: 'rjazz-dark-foghorn',
      name: 'Dark · Foghorn Minor · 8',
      mode: 'minor',
      chords: ['i9', 'bIIImaj9', 'VImaj9', 'iv9', 'iiø7', 'V13', 'i9', 'VImaj9'],
    },
    {
      id: 'rjazz-gospel-rise',
      name: 'Gospel · Soft Rise · 7',
      chords: ['Imaj9', 'iii9', 'IVmaj9', 'V13', 'vi9', 'IVmaj9', 'V13sus'],
    },
    {
      id: 'rjazz-gospel-harbor',
      name: 'Gospel · Harbor Amen · 6',
      chords: ['IVmaj9', 'Imaj9', 'ii9', 'V13', 'Imaj9', 'V13sus'],
    },
  ],
};

export const RICH_JAZZ_GENRES: GenreDef[] = [RICH_JAZZ_GENRE];
