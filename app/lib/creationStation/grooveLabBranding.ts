/** User-facing names for Groove Lab (vs legacy Orchid labels elsewhere). */

export const GROOVE_LAB_STUDIO_LABEL = 'GROOVE STUDIO';
export const GROOVE_LAB_CHORD_LABEL = 'GROOVE CHORD';
export const GROOVE_LAB_CHORD_SHORT = 'Groove';

/** Blue-lane / sub keypad sound bank (808 & trap roots — not NEW SYNTH basslines). */
export const GROOVE_LAB_808_SUBROOTS_BANK_LABEL = '808 Trap SubRoots';
export const GROOVE_LAB_SUBROOT_KEYPAD_LABEL = '808 TRAP SUBROOTS';

export const ORCHID_STUDIO_LABEL = 'ORCHID STUDIO';
export const ORCHID_CHORD_LABEL = 'ORCHID CHORD';
export const ORCHID_CHORD_SHORT = 'Orchid';

export function grooveLabChordLabels(grooveBranding: boolean): {
  section: string;
  short: string;
  soundBank: string;
} {
  if (grooveBranding) {
    return {
      section: GROOVE_LAB_CHORD_LABEL,
      short: GROOVE_LAB_CHORD_SHORT,
      soundBank: GROOVE_LAB_CHORD_LABEL,
    };
  }
  return {
    section: ORCHID_CHORD_LABEL,
    short: ORCHID_CHORD_SHORT,
    soundBank: ORCHID_CHORD_LABEL,
  };
}
