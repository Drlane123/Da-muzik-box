/**
 * Strict MIDI → string + fret mapping.
 * Fret = incomingMidi - openStringMidiRoot (frets 0–24).
 */
import {
  GUITAR_MAX_FRET,
  GUITAR_STANDARD_OPEN_MIDI,
  GUITAR_STRING_COUNT,
  stringIndexToNumber,
} from '@/app/lib/studio/guitarInstrument/types';

export type MidiStringConnection = {
  stringIndex: number;
  fret: number;
};

export function mapMidiToStringFret(
  incomingNote: number,
  openMidis: readonly number[] = GUITAR_STANDARD_OPEN_MIDI,
  excludeMask = 0,
): MidiStringConnection | null {
  const midi = Math.round(incomingNote);

  for (let stringIdx = GUITAR_STRING_COUNT - 1; stringIdx >= 0; stringIdx -= 1) {
    if ((excludeMask & (1 << stringIdx)) !== 0) continue;

    const openMidi = openMidis[stringIdx];
    if (openMidi == null) continue;

    const fret = midi - openMidi;
    if (fret >= 0 && fret <= GUITAR_MAX_FRET) {
      return { stringIndex: stringIdx, fret };
    }
  }

  return null;
}

/** Log connection for dev verification (browser console). */
export function logMidiStringConnection(incomingNote: number, connection: MidiStringConnection | null): void {
  if (!connection) {
    console.warn(`[Guitar] Error: MIDI Note ${incomingNote} is outside the playable range of this guitar.`);
    return;
  }

  console.info(
    `[Guitar] Connected MIDI ${incomingNote} to String ${stringIndexToNumber(connection.stringIndex)}, Fret ${connection.fret}`,
  );
}
