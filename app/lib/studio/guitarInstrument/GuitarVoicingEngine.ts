/**
 * Note-to-string assignment — strict fret = midi - openMidi subtraction.
 */
import { GuitarHandPosition } from '@/app/lib/studio/guitarInstrument/GuitarHandPosition';
import {
  GUITAR_STANDARD_OPEN_MIDI,
  stringIndexToNumber,
  type GuitarStringPlacement,
  type GuitarVoicingResult,
} from '@/app/lib/studio/guitarInstrument/types';
import {
  logMidiStringConnection,
  mapMidiToStringFret,
} from '@/app/lib/studio/guitarInstrument/midiStringMap';
import type { GuitarStringMatrix } from '@/app/lib/studio/guitarInstrument/GuitarStringMatrix';

export type VoicingEngineOpts = {
  openMidis?: readonly number[];
  capo?: number;
};

function openMidisForOpts(opts?: VoicingEngineOpts): readonly number[] {
  return opts?.openMidis ?? GUITAR_STANDARD_OPEN_MIDI;
}

/**
 * Assign MIDI notes to unique strings using strict subtraction mapping.
 * Scans high string → low string; first valid fret 0–24 per note.
 */
export function assignMidisToStrings(
  midis: readonly number[],
  hand: GuitarHandPosition,
  opts?: VoicingEngineOpts,
): { placements: GuitarStringPlacement[]; unassigned: number[] } {
  const openMidis = openMidisForOpts(opts);
  const uniqueMidis = [...new Set(midis.map((m) => Math.round(m)))].filter(
    (m) => m >= 0 && m <= 127,
  );

  const sortedMidis = [...uniqueMidis].sort((a, b) => {
    let ca = 0;
    let cb = 0;
    for (let s = openMidis.length - 1; s >= 0; s -= 1) {
      const fa = a - (openMidis[s] ?? 0);
      const fb = b - (openMidis[s] ?? 0);
      if (fa >= 0 && fa <= 24) ca += 1;
      if (fb >= 0 && fb <= 24) cb += 1;
    }
    if (ca !== cb) return ca - cb;
    return b - a;
  });

  let excludeMask = 0;
  const placements: GuitarStringPlacement[] = [];
  const unassigned: number[] = [];

  for (const midi of sortedMidis) {
    const connection = mapMidiToStringFret(midi, openMidis, excludeMask);
    logMidiStringConnection(midi, connection);

    if (!connection) {
      unassigned.push(midi);
      continue;
    }

    excludeMask |= 1 << connection.stringIndex;
    placements.push({
      stringIndex: connection.stringIndex,
      stringNumber: stringIndexToNumber(connection.stringIndex),
      fret: connection.fret,
      midi,
    });
  }

  for (const p of placements) {
    hand.moveToCoverFret(p.fret);
  }

  placements.sort((a, b) => a.stringIndex - b.stringIndex);
  return { placements, unassigned };
}

export function voiceChordOnMatrix(
  matrix: GuitarStringMatrix,
  hand: GuitarHandPosition,
  midis: readonly number[],
  opts?: VoicingEngineOpts,
): GuitarVoicingResult {
  const { placements, unassigned } = assignMidisToStrings(midis, hand, opts);
  const transitions = matrix.applyVoicing(placements, opts?.capo ?? 0);

  return {
    handPosition: hand.value,
    placements,
    transitions,
    unassignedMidis: unassigned,
  };
}

export function voiceSingleNoteOnMatrix(
  matrix: GuitarStringMatrix,
  hand: GuitarHandPosition,
  midi: number,
  opts?: VoicingEngineOpts,
): GuitarVoicingResult {
  return voiceChordOnMatrix(matrix, hand, [midi], opts);
}

export function connectIncomingMidiNote(
  matrix: GuitarStringMatrix,
  hand: GuitarHandPosition,
  incomingNote: number,
  opts?: VoicingEngineOpts,
): GuitarVoicingResult | null {
  const openMidis = openMidisForOpts(opts);
  const connection = mapMidiToStringFret(incomingNote, openMidis, 0);
  logMidiStringConnection(incomingNote, connection);

  if (!connection) return null;

  hand.moveToCoverFret(connection.fret);
  const placement: GuitarStringPlacement = {
    stringIndex: connection.stringIndex,
    stringNumber: stringIndexToNumber(connection.stringIndex),
    fret: connection.fret,
    midi: Math.round(incomingNote),
  };

  const transitions = matrix.applyVoicing([placement], opts?.capo ?? 0);
  return {
    handPosition: hand.value,
    placements: [placement],
    transitions,
    unassignedMidis: [],
  };
}
