/**
 * SE2 Guitar Strummer — open-position chord voicings (6-string aware).
 */
import type { Se2GuitarLoopNote } from '@/app/lib/studio/se2GuitarLoopPresets';

export type Se2GuitarChordId =
  | 'C'
  | 'Am'
  | 'G'
  | 'F'
  | 'Dm'
  | 'Em'
  | 'D'
  | 'A'
  | 'E'
  | 'Bm'
  | 'Cmaj7'
  | 'Am7'
  | 'Dm7'
  | 'G7'
  | 'Fmaj7'
  | 'Em7'
  | 'Bm7'
  | 'Dmaj7'
  | 'Amaj7'
  | 'E7'
  | 'B7'
  | 'Gmaj7'
  | 'G6'
  | 'Cadd9'
  | 'Csus2'
  | 'Asus4'
  | 'Dsus4'
  | 'Am9'
  | 'Dm9'
  | 'D9';

export type Se2GuitarChordDef = {
  id: Se2GuitarChordId;
  label: string;
  /** MIDI pitches — one per played string. */
  pitches: readonly number[];
};

export const SE2_GUITAR_CHORDS: readonly Se2GuitarChordDef[] = [
  { id: 'C', label: 'C', pitches: [48, 52, 55, 60, 64] },
  { id: 'Am', label: 'Am', pitches: [45, 52, 57, 60, 64] },
  { id: 'G', label: 'G', pitches: [43, 47, 50, 55, 59, 64] },
  { id: 'F', label: 'F', pitches: [41, 48, 53, 57, 60] },
  { id: 'Dm', label: 'Dm', pitches: [50, 53, 57, 62] },
  { id: 'Em', label: 'Em', pitches: [40, 47, 52, 55, 59, 64] },
  { id: 'D', label: 'D', pitches: [50, 54, 57, 62] },
  { id: 'A', label: 'A', pitches: [45, 52, 57, 61] },
  { id: 'E', label: 'E', pitches: [40, 47, 52, 56, 59, 64] },
  { id: 'Bm', label: 'Bm', pitches: [47, 54, 59, 62, 66] },
  { id: 'Cmaj7', label: 'Cmaj7', pitches: [48, 52, 55, 59, 62] },
  { id: 'Am7', label: 'Am7', pitches: [45, 52, 55, 57, 62] },
  { id: 'Dm7', label: 'Dm7', pitches: [50, 53, 57, 60, 65] },
  { id: 'G7', label: 'G7', pitches: [43, 47, 50, 53, 57, 61] },
  { id: 'Fmaj7', label: 'Fmaj7', pitches: [41, 48, 53, 57, 60, 65] },
  { id: 'Em7', label: 'Em7', pitches: [40, 47, 52, 55, 58, 62] },
  { id: 'Bm7', label: 'Bm7', pitches: [47, 54, 57, 59, 64] },
  { id: 'Dmaj7', label: 'Dmaj7', pitches: [50, 54, 57, 61, 66] },
  { id: 'Amaj7', label: 'Amaj7', pitches: [45, 52, 57, 61, 64] },
  { id: 'E7', label: 'E7', pitches: [40, 44, 47, 50, 54, 58] },
  { id: 'A7', label: 'A7', pitches: [45, 49, 52, 55, 59, 63] },
  { id: 'B7', label: 'B7', pitches: [47, 51, 54, 57, 61] },
  { id: 'Gmaj7', label: 'Gmaj7', pitches: [43, 47, 50, 54, 57, 62] },
  { id: 'G6', label: 'G6', pitches: [43, 47, 50, 55, 59, 62] },
  { id: 'Cadd9', label: 'Cadd9', pitches: [48, 52, 55, 57, 62] },
  { id: 'Csus2', label: 'Csus2', pitches: [48, 50, 55, 60, 64] },
  { id: 'Asus4', label: 'Asus4', pitches: [45, 52, 57, 62, 64] },
  { id: 'Dsus4', label: 'Dsus4', pitches: [50, 55, 57, 62] },
  { id: 'Am9', label: 'Am9', pitches: [45, 52, 55, 57, 62, 67] },
  { id: 'Dm9', label: 'Dm9', pitches: [50, 53, 57, 60, 65, 69] },
  { id: 'D9', label: 'D9', pitches: [50, 54, 57, 60, 64, 68] },
];

export type Se2GuitarStrumPatternId =
  | 'down'
  | 'up'
  | 'down_up'
  | 'arpeggio_down'
  | 'arpeggio_up'
  | 'mute';

export type Se2GuitarStrumPattern = {
  id: Se2GuitarStrumPatternId;
  label: string;
  hint: string;
};

export const SE2_GUITAR_STRUM_PATTERNS: readonly Se2GuitarStrumPattern[] = [
  { id: 'down', label: 'Down', hint: 'Low → high strum' },
  { id: 'up', label: 'Up', hint: 'High → low strum' },
  { id: 'down_up', label: 'Down-Up', hint: 'Classic folk strum' },
  { id: 'arpeggio_down', label: 'Arp ↓', hint: 'Fingerpick low to high' },
  { id: 'arpeggio_up', label: 'Arp ↑', hint: 'Fingerpick high to low' },
  { id: 'mute', label: 'Mute', hint: 'Palm-muted staccato' },
];

function strumNotes(
  pitches: readonly number[],
  beat: number,
  spread: number,
  dur: number,
  vel: number,
  order: 'down' | 'up',
): Se2GuitarLoopNote[] {
  const sorted = order === 'down' ? [...pitches] : [...pitches].reverse();
  return sorted.map((pitch, i) => ({
    pitch,
    startBeat: beat + i * spread,
    durationBeats: dur,
    velocity: Math.max(40, vel - i * 2),
  }));
}

/** Build one-bar strum MIDI at beat 0 — caller offsets to playhead. */
export function se2GuitarStrumNotesAtBar(
  chord: Se2GuitarChordDef,
  pattern: Se2GuitarStrumPatternId,
  beatsPerBar = 4,
): Se2GuitarLoopNote[] {
  const pitches = chord.pitches;
  switch (pattern) {
    case 'down':
      return strumNotes(pitches, 0, 0.035, 0.85, 84, 'down');
    case 'up':
      return strumNotes(pitches, 0, 0.035, 0.85, 80, 'up');
    case 'down_up':
      return [
        ...strumNotes(pitches, 0, 0.03, 0.5, 82, 'down'),
        ...strumNotes(pitches, 2, 0.03, 0.5, 78, 'up'),
      ];
    case 'arpeggio_down':
      return strumNotes(pitches, 0, 0.2, 0.35, 76, 'down');
    case 'arpeggio_up':
      return strumNotes(pitches, 0, 0.2, 0.35, 74, 'up');
    case 'mute':
      return pitches.map((pitch, i) => ({
        pitch,
        startBeat: i * 0.04,
        durationBeats: 0.12,
        velocity: Math.max(52, 86 - i * 3),
      }));
    default:
      return strumNotes(pitches, 0, 0.035, 0.85, 96, 'down');
  }
}

export function se2GuitarStrumNotesAtPlayhead(
  chord: Se2GuitarChordDef,
  pattern: Se2GuitarStrumPatternId,
  insertBar: number,
  beatsPerBar = 4,
): Se2GuitarLoopNote[] {
  const barOff = insertBar * beatsPerBar;
  return se2GuitarStrumNotesAtBar(chord, pattern, beatsPerBar).map((n) => ({
    ...n,
    startBeat: n.startBeat + barOff,
  }));
}

/** Four-bar progression strum — one chord per bar from insertBar. */
export function se2GuitarProgressionStrumNotesAtPlayhead(
  chordIds: readonly Se2GuitarChordId[],
  pattern: Se2GuitarStrumPatternId,
  insertBar: number,
  beatsPerBar = 4,
): Se2GuitarLoopNote[] {
  const batch: Se2GuitarLoopNote[] = [];
  for (let b = 0; b < chordIds.length; b += 1) {
    const ch = SE2_GUITAR_CHORDS.find((c) => c.id === chordIds[b]) ?? SE2_GUITAR_CHORDS[0]!;
    batch.push(...se2GuitarStrumNotesAtPlayhead(ch, pattern, insertBar + b, beatsPerBar));
  }
  return batch;
}

/** Chord quality label for UI (extension after root). */
export function se2GuitarChordQualityLabel(ch: Se2GuitarChordDef): string {
  const root = ch.label.match(/^[A-G][#b]?/)?.[0] ?? '';
  const rest = ch.label.slice(root.length);
  return rest || 'Maj';
}
