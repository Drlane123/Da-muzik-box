/** 808 Kick/Bass piano-roll edit — selection, copy, paste, duplicate (manual notes). */

import {
  quantizeStepBeats,
  snapBeatToQuantize,
  snapDurationBeats,
  type Lab808Quantize,
} from '@/app/lib/creationStation/lab808RollQuantize';

export type Lab808ToneRollNote = {
  id: string;
  startBeat: number;
  midi: number;
  durBeats: number;
  chord?: string;
};

export type Lab808ToneRollRegion = {
  beat0: number;
  beat1: number;
  midiLo: number;
  midiHi: number;
};

export type Lab808ToneRollClipNote = {
  relBeat: number;
  relMidi: number;
  durBeats: number;
  chord?: string;
};

export type Lab808ToneRollClip = {
  wBeats: number;
  beat0: number;
  midiOrigin: number;
  notes: Lab808ToneRollClipNote[];
};

function noteOverlapsRegion(note: Lab808ToneRollNote, region: Lab808ToneRollRegion): boolean {
  if (note.midi < region.midiLo || note.midi > region.midiHi) return false;
  const end = note.startBeat + note.durBeats;
  return end > region.beat0 && note.startBeat <= region.beat1;
}

export function lab808ToneRollNoteInRegion(
  note: Lab808ToneRollNote,
  region: Lab808ToneRollRegion | null | undefined,
): boolean {
  if (!region) return false;
  return noteOverlapsRegion(note, region);
}

/** Selection box around one manual note (for click-select + duplicate). */
export function lab808ToneRollNoteRegion(note: Lab808ToneRollNote): Lab808ToneRollRegion {
  const end = note.startBeat + Math.max(1e-6, note.durBeats);
  return {
    beat0: note.startBeat,
    beat1: end,
    midiLo: note.midi,
    midiHi: note.midi,
  };
}

export function lab808ToneRollRegionFromPoints(
  beatA: number,
  midiA: number,
  beatB: number,
  midiB: number,
): Lab808ToneRollRegion {
  return {
    beat0: Math.min(beatA, beatB),
    beat1: Math.max(beatA, beatB),
    midiLo: Math.min(midiA, midiB),
    midiHi: Math.max(midiA, midiB),
  };
}

export function lab808ToneRollRegionHasNotes(
  notes: readonly Lab808ToneRollNote[],
  region: Lab808ToneRollRegion,
): boolean {
  return notes.some((n) => noteOverlapsRegion(n, region));
}

export function lab808ToneRollExtractClip(
  notes: readonly Lab808ToneRollNote[],
  region: Lab808ToneRollRegion,
): Lab808ToneRollClip | null {
  const picked = notes.filter((n) => noteOverlapsRegion(n, region));
  if (picked.length === 0) return null;
  const beat0 = region.beat0;
  const midiOrigin = region.midiHi;
  const clipNotes: Lab808ToneRollClipNote[] = picked.map((n) => ({
    relBeat: n.startBeat - beat0,
    relMidi: n.midi - midiOrigin,
    durBeats: n.durBeats,
    chord: n.chord,
  }));
  const wBeats = Math.max(
    region.beat1 - beat0,
    ...picked.map((n) => n.startBeat + n.durBeats - beat0),
  );
  return { wBeats, beat0, midiOrigin, notes: clipNotes };
}

export function lab808ToneRollEraseRegion(
  notes: readonly Lab808ToneRollNote[],
  region: Lab808ToneRollRegion,
): Lab808ToneRollNote[] {
  return notes.filter((n) => !noteOverlapsRegion(n, region));
}

export function lab808ToneRollPasteClip(
  notes: readonly Lab808ToneRollNote[],
  clip: Lab808ToneRollClip,
  destBeat: number,
  destMidiOrigin: number,
  newId: () => string,
): Lab808ToneRollNote[] {
  const added: Lab808ToneRollNote[] = clip.notes.map((n) => ({
    id: newId(),
    startBeat: destBeat + n.relBeat,
    midi: destMidiOrigin + n.relMidi,
    durBeats: n.durBeats,
    chord: n.chord,
  }));
  return [...notes, ...added];
}

export function lab808ToneRollSnapNoteStart(
  beat: number,
  q: Lab808Quantize,
  beatsPerBar = 4,
): number {
  return Math.max(0, snapBeatToQuantize(beat, q, beatsPerBar));
}

export function lab808ToneRollSnapNoteDuration(
  durBeats: number,
  q: Lab808Quantize,
  beatsPerBar = 4,
  maxBeats = 64,
): number {
  return snapDurationBeats(durBeats, q, { beatsPerBar, maxBeats });
}

/** Duplicate selection to the next bar line (grid-locked). */
export function lab808ToneRollDuplicateNotes(
  notes: readonly Lab808ToneRollNote[],
  region: Lab808ToneRollRegion,
  maxBeat: number,
  beatsPerBar: number,
  q: Lab808Quantize,
  newId: () => string,
): { notes: Lab808ToneRollNote[]; region: Lab808ToneRollRegion } | null {
  const clip = lab808ToneRollExtractClip(notes, region);
  if (!clip) return null;

  const step = quantizeStepBeats(q, beatsPerBar);
  const clipEnd = Math.max(
    region.beat1,
    clip.beat0 + clip.wBeats,
    ...clip.notes.map((n) => clip.beat0 + n.relBeat + n.durBeats),
  );
  const nextBarStart = Math.ceil((clipEnd - step * 0.05) / beatsPerBar) * beatsPerBar;
  let destBeat = snapBeatToQuantize(nextBarStart, q, beatsPerBar);
  if (destBeat <= region.beat0 + step * 0.25) {
    destBeat = snapBeatToQuantize(region.beat0 + beatsPerBar, q, beatsPerBar);
  }
  if (destBeat + clip.wBeats > maxBeat + step) return null;

  const nextNotes = lab808ToneRollPasteClip(notes, clip, destBeat, clip.midiOrigin, newId);
  const span = Math.max(step, region.beat1 - region.beat0);
  return {
    notes: nextNotes,
    region: {
      beat0: destBeat,
      beat1: destBeat + span,
      midiLo: region.midiLo,
      midiHi: region.midiHi,
    },
  };
}
