/** Visual + mix constants — bass (808 library) vs chords (Groove chord sound bank). */

export const GROOVE_LAB_BASS_NOTE_COLOR = '#3b82f6';
export const GROOVE_LAB_BASS_NOTE_EDGE = '#1e40af';
export const GROOVE_LAB_BASS_NOTE_INSET = '#1e3a8a';

export const GROOVE_LAB_CHORD_NOTE_COLOR = '#4ade80';
export const GROOVE_LAB_CHORD_NOTE_EDGE = '#15803d';
export const GROOVE_LAB_CHORD_NOTE_INSET = '#166534';

/** Roll / transport chord level vs bass (keeps harmony under the sub). */
export const GROOVE_LAB_MELODY_NOTE_COLOR = '#fbbf24';
export const GROOVE_LAB_MELODY_NOTE_EDGE = '#b45309';
export const GROOVE_LAB_MELODY_NOTE_INSET = '#92400e';

export const GROOVE_LAB_CHORD_MIX_GAIN = 0.62;

/** Keypad audition: Groove chord layer under bass when CHORD ON. */
export const GROOVE_LAB_KEYPAD_CHORD_MIX_GAIN = 0.72;

export const GROOVE_LAB_LAYER_LEGEND = {
  bass: {
    short: 'SUB',
    title: '808 Trap SubRoots (C1–C3) · production basslines live in NEW SYNTH',
    color: GROOVE_LAB_BASS_NOTE_COLOR,
  },
  melody: {
    short: 'LEAD',
    title: 'Melody / riff / arp · C4–B4 mid lane (subs stay C1–C3)',
    color: GROOVE_LAB_MELODY_NOTE_COLOR,
  },
  chord: {
    short: 'CHORD',
    title: 'Harmony stack · C5+ top lane (Groove chord sound bank)',
    color: GROOVE_LAB_CHORD_NOTE_COLOR,
  },
} as const;
