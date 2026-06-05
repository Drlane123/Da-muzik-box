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

/** Roll + transport green chords (user-tuned: previous 0.62 was too hot). */
export const GROOVE_LAB_CHORD_MIX_GAIN = 0.31;

/** Voice level when chords route through a CH strip — user fader is on the strip bus only. */
export function grooveLabChordStripVoiceMix(): number {
  return GROOVE_LAB_CHORD_MIX_GAIN;
}

/** Keypad audition: Groove chord layer under bass when CHORD ON. */
export const GROOVE_LAB_KEYPAD_CHORD_MIX_GAIN = 0.72;

export const GROOVE_LAB_LAYER_LEGEND = {
  bass: {
    short: 'SUB',
    title: 'Legacy sub lane (removed from Groove Lab)',
    color: GROOVE_LAB_BASS_NOTE_COLOR,
  },
  melody: {
    short: 'LEAD',
    title: 'Legacy melody lane (removed from Groove Lab)',
    color: GROOVE_LAB_MELODY_NOTE_COLOR,
  },
  chord: {
    short: 'CHORD',
    title: 'Harmony stack · Groove chord sound bank (production bass → NEW SYNTH)',
    color: GROOVE_LAB_CHORD_NOTE_COLOR,
  },
} as const;
