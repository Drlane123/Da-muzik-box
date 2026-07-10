/** Pad Spread — help copy for Beat Pads FX toolbar + spread roll. */

export const BEAT_PADS_PAD_SPREAD_HELP = {
  title: 'Pad Spread',
  tagline: '808-style chromatic spread on CH 17 — your 16 pads stay untouched.',
  sections: [
    {
      heading: 'Lane placements first',
      body:
        'Use Lane Placements in the Pattern Bank sidebar to paint kicks, snares, hats, and FX on each grid lane. Highlight a pad lane, pick Kick · Snare · Hat, choose a genre, then Regen or Pick placement. That is your drum kit on CH 1–16.',
    },
    {
      heading: 'Pad Spread — one hit, 16 pitches',
      body:
        'Load any one-shot on a pad (808, kick, clap). Tap Pad Spread ↓16 or ↑16. A mini pitch roll opens on mixer CH 17–32. Row 1 = original pitch; each row steps one semitone down (↓16) or up (↑16). Draw your pattern in the roll — pads on the main grid are not replaced.',
    },
    {
      heading: 'Preview & lock in',
      body:
        'Pick 2b, 4b, or 8b loop length, then Play inside the roll to hear your spread at session BPM. Match it against the kit until it sits right. Export MIDI or WAV to a regular track when ready.',
    },
    {
      heading: 'Play together',
      body:
        'Hit Play on Beat Pads — the 16-lane step grid and Pad Spread roll share the same clock. Spread hits fire on CH 17+ while your lane-placement drums play on CH 1–16.',
    },
  ],
} as const;

/** Music Box gold + white — Pad Spread badge in FX toolbar. */
export const BEAT_PADS_PAD_SPREAD_BADGE_STYLE = {
  label: 'PAD SPREAD',
  color: '#ffe082',
  border: '1px solid rgba(255, 224, 130, 0.62)',
  background: 'linear-gradient(180deg, rgba(255, 224, 130, 0.28) 0%, rgba(255, 217, 102, 0.1) 100%)',
  textShadow: '0 0 10px rgba(255, 224, 130, 0.35)',
  boxShadow: '0 1px 0 rgba(255, 255, 255, 0.12) inset, 0 2px 8px rgba(0, 0, 0, 0.35)',
} as const;
