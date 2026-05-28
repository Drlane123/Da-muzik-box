import {
  GROOVE_LAB_BASS_MIDI_MAX,
  GROOVE_LAB_BASS_MIDI_MIN,
  GROOVE_LAB_CHORD_HARMONY_MIDI_MIN,
  grooveLabClampMelodyMidi,
  grooveLabIsMelodyMidi,
  grooveLabTransposeChordHitsOctave,
  type GrooveLabRollNote,
  type GrooveLabTransposeChordOctaveOpts,
} from '@/app/lib/creationStation/grooveLabPitch';
import { grooveLabIsBassSubMidi } from '@/app/lib/creationStation/grooveComposerEngine';
import type { GrooveRollHit } from '@/app/lib/creationStation/grooveLabRoll';

/** Full piano-roll range for chord octave moves (split lane can use C1–C6). */
export const GROOVE_LAB_ROLL_OCTAVE_OPTS: GrooveLabTransposeChordOctaveOpts = {
  rollMinMidi: 24,
  rollMaxMidi: 96,
  lowFloorMidi: 24,
};

export function grooveLabIsChordStackMidi(midi: number): boolean {
  const m = Math.round(midi);
  if (grooveLabIsBassSubMidi(m)) return false;
  if (grooveLabIsMelodyMidi(m)) return false;
  return m >= GROOVE_LAB_CHORD_HARMONY_MIDI_MIN;
}

function dedupeRollHits<T extends GrooveLabRollNote>(hits: readonly T[]): T[] {
  const byKey = new Map<string, T>();
  for (const h of hits) {
    byKey.set(`${h.slot}:${h.midi}`, h);
  }
  return [...byKey.values()].sort((a, b) => a.slot - b.slot || a.midi - b.midi);
}

/** Shift green chord stacks only. */
export function grooveLabTransposeChordStackHitsOctave(
  hits: readonly GrooveRollHit[],
  dir: 1 | -1,
  bassRootMidi: number,
  opts?: GrooveLabTransposeChordOctaveOpts,
): GrooveRollHit[] {
  const chordOnly = hits.filter((h) => grooveLabIsChordStackMidi(h.midi));
  if (chordOnly.length === 0) return [...hits];
  const keep = hits.filter((h) => !grooveLabIsChordStackMidi(h.midi));
  const moved = grooveLabTransposeChordHitsOctave(chordOnly, dir, bassRootMidi, opts);
  return dedupeRollHits([...keep, ...moved]);
}

/** Shift amber melody / riff lane only. */
export function grooveLabTransposeMelodyHitsOctave(
  hits: readonly GrooveRollHit[],
  dir: 1 | -1,
): GrooveRollHit[] {
  const delta = dir * 12;
  const out: GrooveRollHit[] = [];
  for (const h of hits) {
    if (!grooveLabIsMelodyMidi(h.midi)) {
      out.push(h);
      continue;
    }
    const next = grooveLabClampMelodyMidi(h.midi + delta);
    out.push(next === h.midi ? h : { ...h, midi: next });
  }
  return dedupeRollHits(out);
}

/** Shift blue 808 sub roots only (C1–C3). */
export function grooveLabTransposeSubHitsOctave(
  hits: readonly GrooveRollHit[],
  dir: 1 | -1,
): GrooveRollHit[] {
  const delta = dir * 12;
  const out: GrooveRollHit[] = [];
  for (const h of hits) {
    if (!grooveLabIsBassSubMidi(h.midi)) {
      out.push(h);
      continue;
    }
    const next = Math.max(
      GROOVE_LAB_BASS_MIDI_MIN,
      Math.min(GROOVE_LAB_BASS_MIDI_MAX, h.midi + delta),
    );
    out.push(next === h.midi ? h : { ...h, midi: next });
  }
  return dedupeRollHits(out);
}

export type GrooveLabOctaveLayer = 'chord' | 'melody' | 'sub';

export function grooveLabCountLayerHits(
  hits: readonly GrooveRollHit[],
  layer: GrooveLabOctaveLayer,
): number {
  if (layer === 'chord') return hits.filter((h) => grooveLabIsChordStackMidi(h.midi)).length;
  if (layer === 'melody') return hits.filter((h) => grooveLabIsMelodyMidi(h.midi)).length;
  return hits.filter((h) => grooveLabIsBassSubMidi(h.midi)).length;
}
