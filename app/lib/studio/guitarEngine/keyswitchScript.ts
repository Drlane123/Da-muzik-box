/**
 * Keyswitch articulation map — low MIDI notes select performance style.
 * Default layout mirrors Shreddage / Impact Soundworks conventions.
 */
import type { GuitarEngineArticulation, GuitarKeyswitchBinding } from '@/app/lib/studio/guitarEngine/types';

export const GUITAR_DEFAULT_KEYSWITCHES: readonly GuitarKeyswitchBinding[] = [
  { midiLo: 21, midiHi: 21, articulation: 'sustain', label: 'Sustain' },
  { midiLo: 22, midiHi: 22, articulation: 'palm_mute', label: 'Palm Mute' },
  { midiLo: 23, midiHi: 23, articulation: 'legato', label: 'Legato' },
  { midiLo: 24, midiHi: 24, articulation: 'slide', label: 'Slide' },
  { midiLo: 25, midiHi: 25, articulation: 'harmonic', label: 'Harmonic' },
  { midiLo: 26, midiHi: 26, articulation: 'staccato', label: 'Staccato' },
] as const;

export const GUITAR_KEYSWITCH_MIDI_LO = 21;
export const GUITAR_KEYSWITCH_MIDI_HI = 26;
export const GUITAR_PLAYABLE_MIDI_LO = 40;

export type GuitarKeyswitchState = {
  activeArticulation: GuitarEngineArticulation;
  lastKeyswitchMidi: number | null;
};

export function createGuitarKeyswitchState(
  defaultArticulation: GuitarEngineArticulation = 'sustain',
): GuitarKeyswitchState {
  return { activeArticulation: defaultArticulation, lastKeyswitchMidi: null };
}

export function guitarIsKeyswitchMidi(midi: number): boolean {
  return midi >= GUITAR_KEYSWITCH_MIDI_LO && midi <= GUITAR_KEYSWITCH_MIDI_HI;
}

/** Returns new articulation if midi is a keyswitch; null if playable note. */
export function guitarKeyswitchNoteOn(
  state: GuitarKeyswitchState,
  midi: number,
  bindings: readonly GuitarKeyswitchBinding[] = GUITAR_DEFAULT_KEYSWITCHES,
): GuitarEngineArticulation | null {
  for (const b of bindings) {
    if (midi >= b.midiLo && midi <= b.midiHi) {
      state.activeArticulation = b.articulation;
      state.lastKeyswitchMidi = midi;
      return b.articulation;
    }
  }
  return null;
}
