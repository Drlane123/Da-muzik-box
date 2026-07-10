/**
 * SE2 piano-roll notes ↔ Beat Lab roll adapters (bass generator + glide helpers).
 */
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import { beatLabMelodicLanePitch } from '@/app/lib/creationStation/beatLabMidiRoll';
import { normalizeBeatLabMidiNote, type BeatLabMidiNote } from '@/app/lib/creationStation/beatLabMidiRoll';
import type { BeatLabImportedChordRail } from '@/app/lib/creationStation/chordBuilderBeatLabImport';
import { chordSymbolToRootMidi } from '@/app/lib/creationStation/chordBuilder';
import { beatLabSynthV2FitRootNearMidi } from '@/app/lib/creationStation/beatLabMelodicSynthV2Timing';

export type Se2MockMidiNote = {
  pitch: number;
  startBeat: number;
  durationBeats: number;
  velocity: number;
};

export function studioTrackDetectedKeyFromFields(
  tr: {
    trackKeyRoot?: number;
    trackKeyMode?: ChordMode;
    a2mKeyRoot?: number;
    a2mKeyMode?: ChordMode;
  },
  fallbackRoot = 0,
  fallbackMode: ChordMode = 'major',
): { keyRoot: number; keyMode: ChordMode } {
  if (tr.trackKeyRoot != null && tr.trackKeyMode) {
    return { keyRoot: tr.trackKeyRoot, keyMode: tr.trackKeyMode };
  }
  if (tr.a2mKeyRoot != null && tr.a2mKeyMode) {
    return { keyRoot: tr.a2mKeyRoot, keyMode: tr.a2mKeyMode };
  }
  return { keyRoot: fallbackRoot, keyMode: fallbackMode };
}

/** Beat Lab melodic lanes CH 17–32 (index 16–31). */
export function se2BeatLabLaneForTrack(trackIndex: number): number {
  return 16 + Math.max(0, Math.min(15, trackIndex % 16));
}

/** Default piano-roll pitch window when a Bass Glide lane has no notes yet. */
export const SE2_GLIDE_BASS_PITCH_DEFAULT_LO = 28;
export const SE2_GLIDE_BASS_PITCH_DEFAULT_HI = 55;

export function se2GlideBassEmptyPitchRange(): { min: number; max: number } {
  return { min: SE2_GLIDE_BASS_PITCH_DEFAULT_LO, max: SE2_GLIDE_BASS_PITCH_DEFAULT_HI };
}

export function se2GlideBassPitchSpanNotes(): Se2MockMidiNote[] {
  const { min, max } = se2GlideBassEmptyPitchRange();
  return [
    { pitch: min, startBeat: 0, durationBeats: 1, velocity: 100 },
    { pitch: max, startBeat: 0, durationBeats: 1, velocity: 100 },
  ];
}

export function se2MockNoteToBeatLabMidi(
  note: Se2MockMidiNote,
  lane: number,
  subdiv: number,
): BeatLabMidiNote | null {
  const base = beatLabMelodicLanePitch(lane);
  const pitchSemi = note.pitch - base;
  const col = Math.max(0, Math.round(note.startBeat * subdiv));
  const len = Math.max(1, Math.round(note.durationBeats * subdiv));
  return normalizeBeatLabMidiNote({
    lane,
    col,
    len,
    vel: Math.max(1, Math.min(127, Math.round(note.velocity))),
    pitchSemi,
  });
}

export function se2MockNotesToBeatLabRoll(
  notes: readonly Se2MockMidiNote[],
  lane: number,
  subdiv: number,
): BeatLabMidiNote[] {
  const out: BeatLabMidiNote[] = [];
  for (const n of notes) {
    const bn = se2MockNoteToBeatLabMidi(n, lane, subdiv);
    if (bn) out.push(bn);
  }
  out.sort((a, b) => a.col - b.col || (a.pitchSemi ?? 0) - (b.pitchSemi ?? 0));
  return out;
}

export function se2BeatLabMidiToMockNotes(
  notes: readonly BeatLabMidiNote[],
  lane: number,
  subdiv: number,
): Se2MockMidiNote[] {
  const base = beatLabMelodicLanePitch(lane);
  return notes
    .filter((n) => n.lane === lane && !n.muted)
    .map((n) => ({
      pitch: base + (n.pitchSemi ?? 0),
      startBeat: n.col / Math.max(1, subdiv),
      durationBeats: Math.max(1 / subdiv, (n.len ?? 1) / Math.max(1, subdiv)),
      velocity: n.vel ?? 100,
    }));
}

export function se2LegatoSourceMidi(
  notes: readonly Se2MockMidiNote[],
  noteStartBeat: number,
): number | undefined {
  for (const other of notes) {
    if (other.startBeat >= noteStartBeat) continue;
    const end = other.startBeat + other.durationBeats;
    if (end > noteStartBeat + 1e-6) return other.pitch;
  }
  return undefined;
}

export function se2ChordGlideSourceMidi(
  notes: readonly Se2MockMidiNote[],
  noteStartBeat: number,
  targetMidi: number,
  rail: BeatLabImportedChordRail,
  beatsPerBar: number,
  barMask = 0xffffffff,
): number | undefined {
  const barIdx = Math.floor(noteStartBeat / Math.max(1, beatsPerBar));
  if (barIdx < 1) return undefined;
  if (barIdx <= 31 && (barMask & (1 << barIdx)) === 0) return undefined;

  for (const other of notes) {
    if (other.startBeat >= noteStartBeat) continue;
    const otherBar = Math.floor(other.startBeat / Math.max(1, beatsPerBar));
    if (otherBar === barIdx) return undefined;
  }

  const prevChord = rail.timeline[barIdx - 1]?.chord;
  if (!prevChord) return undefined;
  const root = chordSymbolToRootMidi(prevChord as never, rail.keyRoot, rail.mode, 2);
  if (root == null) return undefined;
  const from = beatLabSynthV2FitRootNearMidi(root, targetMidi);
  if (from === targetMidi) return undefined;
  return from;
}
