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

/** Roll + transport chord sound bank (pianos/stacks) — not the mixer CH fader. */
export const GROOVE_LAB_CHORD_MIX_GAIN = 0.04;

/** GUITAR ▾ sound bank — licks + synth voices (not mixer CH fader). */
export const GROOVE_LAB_GUITAR_BANK_GAIN = 0.08;

/** GROOVE LEAD ▾ sound bank + Wave Leaf engine (not mixer CH fader). */
export const GROOVE_LAB_LEAD_BANK_GAIN = 0.08;

/** Voice level when chords route through a CH strip — user fader is on the strip bus only. */
export function grooveLabChordStripVoiceMix(): number {
  return GROOVE_LAB_CHORD_MIX_GAIN;
}

export function grooveLabGuitarBankVoiceMix(): number {
  return GROOVE_LAB_GUITAR_BANK_GAIN;
}

export function grooveLabLeadBankVoiceMix(): number {
  return GROOVE_LAB_LEAD_BANK_GAIN;
}

/** Wave Leaf panel gain × lead bank trim (transport + roll preview). */
export function grooveLabWaveLeafBankOutputGain(panelGain: number): number {
  return Math.max(0.12, Math.min(1, panelGain * GROOVE_LAB_LEAD_BANK_GAIN));
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
