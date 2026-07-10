/** SE2 Chord Generator — typed compose help copy. */

export const SE2_CHORD_GENIE_COMPOSE_HELP = {
  title: 'Chord Generator — type & Go',
  sections: [
    {
      heading: 'Describe the progression',
      body:
        'Type style, mood, and length in plain words, then Go. The status line echoes what was understood — genre, key, bars, BPM, and which preset loaded.',
    },
    {
      heading: 'Go · Regen',
      body:
        'Go matches your phrase to a curated preset in the library (same catalog as Preset pattern). Regen tries another preset for the same phrase. Enter runs Go.',
    },
    {
      heading: 'What you can say',
      body:
        'Name any card from the Preset pattern list — the full library (400+ cards) is indexed. Type the card title, genre, decade, or mood: Axis, Quiet Storm, seventies soul, eighties R&B, nineties slow jam. Key: in F major. Length: 4 or 8 bars (or four bar chart). Tempo: bpm 88 or tempo 120 — your BPM is applied to the session. Passing chord adds a transition on the last bar.',
    },
    {
      heading: 'Examples',
      body:
        'pop axis 8 bars bpm 120 · gospel 2-5-1 in F major · trap dark minor 4 bars · R&B slow jam with passing chord · kpop chorus bpm 128 · jazz ii v i in Bb · afro amapiano · reggae skank bpm 90',
    },
  ],
} as const;
