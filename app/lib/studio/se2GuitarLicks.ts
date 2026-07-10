/**
 * Starter guitar licks — 16th-note grid, one bar each (insert onto SE2 piano roll).
 */

export type Se2GuitarLickNote = {
  pitch: number;
  startBeat: number;
  durationBeats: number;
  velocity: number;
};

export type Se2GuitarLickId =
  | 'country_arpeggio'
  | 'funk_mute'
  | 'blues_turn'
  | 'rnb_pluck'
  | 'rock_power';

export type Se2GuitarLick = {
  id: Se2GuitarLickId;
  label: string;
  hint: string;
  notes: readonly Se2GuitarLickNote[];
};

/** Relative to bar 0 — caller adds bar offset. */
export const SE2_GUITAR_LICKS: readonly Se2GuitarLick[] = [
  {
    id: 'country_arpeggio',
    label: 'Country pick',
    hint: 'Open-position arpeggio — C major shape',
    notes: [
      { pitch: 48, startBeat: 0, durationBeats: 0.25, velocity: 92 },
      { pitch: 52, startBeat: 0.25, durationBeats: 0.25, velocity: 88 },
      { pitch: 55, startBeat: 0.5, durationBeats: 0.25, velocity: 90 },
      { pitch: 60, startBeat: 0.75, durationBeats: 0.25, velocity: 94 },
      { pitch: 55, startBeat: 1, durationBeats: 0.25, velocity: 86 },
      { pitch: 52, startBeat: 1.25, durationBeats: 0.25, velocity: 84 },
    ],
  },
  {
    id: 'funk_mute',
    label: 'Funk mute',
    hint: 'Staccato 16ths — muted electric pocket',
    notes: [
      { pitch: 50, startBeat: 0, durationBeats: 0.125, velocity: 110 },
      { pitch: 50, startBeat: 0.5, durationBeats: 0.125, velocity: 108 },
      { pitch: 50, startBeat: 0.75, durationBeats: 0.125, velocity: 106 },
      { pitch: 50, startBeat: 1, durationBeats: 0.125, velocity: 112 },
      { pitch: 50, startBeat: 1.5, durationBeats: 0.125, velocity: 108 },
      { pitch: 50, startBeat: 1.75, durationBeats: 0.125, velocity: 114 },
    ],
  },
  {
    id: 'blues_turn',
    label: 'Blues turn',
    hint: 'Classic turnaround — A blues box',
    notes: [
      { pitch: 57, startBeat: 0, durationBeats: 0.5, velocity: 96 },
      { pitch: 56, startBeat: 0.5, durationBeats: 0.25, velocity: 90 },
      { pitch: 54, startBeat: 0.75, durationBeats: 0.25, velocity: 88 },
      { pitch: 52, startBeat: 1, durationBeats: 0.5, velocity: 94 },
      { pitch: 50, startBeat: 1.5, durationBeats: 0.5, velocity: 92 },
    ],
  },
  {
    id: 'rnb_pluck',
    label: 'R&B pluck',
    hint: 'Soft chord pluck — soul / gospel pocket',
    notes: [
      { pitch: 48, startBeat: 0, durationBeats: 0.375, velocity: 82 },
      { pitch: 52, startBeat: 0, durationBeats: 0.375, velocity: 78 },
      { pitch: 55, startBeat: 0, durationBeats: 0.375, velocity: 80 },
      { pitch: 60, startBeat: 1, durationBeats: 0.25, velocity: 86 },
      { pitch: 57, startBeat: 1.5, durationBeats: 0.25, velocity: 84 },
    ],
  },
  {
    id: 'rock_power',
    label: 'Rock power',
    hint: 'Power-chord hits on 1 & 3',
    notes: [
      { pitch: 45, startBeat: 0, durationBeats: 0.5, velocity: 118 },
      { pitch: 52, startBeat: 0, durationBeats: 0.5, velocity: 112 },
      { pitch: 45, startBeat: 2, durationBeats: 0.5, velocity: 120 },
      { pitch: 52, startBeat: 2, durationBeats: 0.5, velocity: 114 },
      { pitch: 45, startBeat: 3, durationBeats: 0.25, velocity: 116 },
      { pitch: 52, startBeat: 3, durationBeats: 0.25, velocity: 110 },
    ],
  },
];

export function se2GuitarLickById(id: Se2GuitarLickId): Se2GuitarLick | undefined {
  return SE2_GUITAR_LICKS.find((l) => l.id === id);
}

export function se2GuitarLickNotesAtBar(
  lick: Se2GuitarLick,
  barIndex: number,
  beatsPerBar: number,
): Se2GuitarLickNote[] {
  const offset = Math.max(0, barIndex) * beatsPerBar;
  return lick.notes.map((n) => ({
    ...n,
    startBeat: n.startBeat + offset,
  }));
}
