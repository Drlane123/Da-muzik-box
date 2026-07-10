/**
 * Geno Bass 52 — piano-roll note helpers (re-exports + bar length).
 */
import type { GenoUltraArpSe2RollNote } from '@/app/lib/studio/genoUltraArpExport';
import type { GenoUltraSynthVoiceParams } from '@/app/lib/studio/genoUltraSynthTypes';
import {
  genoBassAudiblePreviewVoice,
  type GenoBassMixGroup,
} from '@/app/lib/studio/genoBassMixReadyVoice';
import { playGenoCinematicOrchestraHit } from '@/app/lib/studio/genoCinematicOrchestraPlayback';
import { previewGenoUltraSynthArpNote } from '@/app/lib/studio/se2GenoUltraSynthPreview';
import {
  SE2_GENO_BASS_PITCH_DEFAULT_HI,
  SE2_GENO_BASS_PITCH_DEFAULT_LO,
} from '@/app/lib/studio/se2GenoBassSynthTrack';
import {
  GENO_BASS_LOOP_BASE_ROOT,
  GENO_BASS_LOOP_EDITOR_MAX,
  GENO_BASS_LOOP_EDITOR_MIN,
} from '@/app/lib/studio/genoBassGroovePresets';
import { genoWrapMidiToRange } from '@/app/lib/studio/se2SynthGenoRanges';

export {
  GENO_BASS_LOOP_BASE_ROOT,
  GENO_BASS_LOOP_DEFAULT_ROOT,
  GENO_BASS_LOOP_EDITOR_MIN,
  GENO_BASS_LOOP_EDITOR_MAX,
  GENO_BASS_DEFAULT_GATE,
  genoBassPresetToRollNotes,
} from '@/app/lib/studio/genoBassGroovePresets';

export const GENO_BASS_LOOP_BAR_LENGTHS = [4, 8] as const;
export type GenoBassLoopBarLength = (typeof GENO_BASS_LOOP_BAR_LENGTHS)[number];

export const GENO_BASS_OCTAVE_SHIFTS = [-2, -1, 0, 1, 2] as const;
export type GenoBassOctaveShift = (typeof GENO_BASS_OCTAVE_SHIFTS)[number];

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/** Root MIDI from octave shift (base C2). */
export function genoBassRootFromOctaveShift(shift: number): number {
  return genoWrapMidiToRange(
    GENO_BASS_LOOP_BASE_ROOT + shift * 12,
    GENO_BASS_LOOP_EDITOR_MIN,
    GENO_BASS_LOOP_EDITOR_MAX,
  );
}

export function genoBassMidiNoteLabel(midi: number): string {
  const pc = ((Math.round(midi) % 12) + 12) % 12;
  const oct = Math.floor(Math.round(midi) / 12) - 1;
  return `${NOTE_NAMES[pc] ?? 'C'}${oct}`;
}

export function genoBassKeyboardStartOctave(rootMidi: number): number {
  return Math.max(1, Math.floor(rootMidi / 12));
}

/** Piano-roll rows aligned to the 2-octave AnaKeyboard beside the octave control. */
export function genoBassPianoRollKeyboardRange(rootMidi: number): { minMidi: number; maxMidi: number } {
  const startOct = genoBassKeyboardStartOctave(rootMidi);
  const minMidi = Math.max(GENO_BASS_LOOP_EDITOR_MIN, startOct * 12);
  const maxMidi = Math.min(GENO_BASS_LOOP_EDITOR_MAX, minMidi + 23);
  return { minMidi, maxMidi };
}

/** Editor is already bass register — apply notes at same pitch on track. */
const EDITOR_TO_TRACK_OCTAVE = 0;

export function genoBassSanitizeLoopBarLength(n: number): GenoBassLoopBarLength {
  return n >= 8 ? 8 : 4;
}

export function genoBassEditorRollNotesToTrackNotes(
  notes: readonly GenoUltraArpSe2RollNote[],
): GenoUltraArpSe2RollNote[] {
  return [...notes]
    .sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch)
    .map((n) => ({
      ...n,
      pitch: genoWrapMidiToRange(
        n.pitch + EDITOR_TO_TRACK_OCTAVE,
        SE2_GENO_BASS_PITCH_DEFAULT_LO,
        SE2_GENO_BASS_PITCH_DEFAULT_HI,
      ),
    }));
}

/** Shift every hit when the keyboard root moves (keeps rhythm, new key). */
export function genoBassTransposeRollNotes(
  notes: readonly GenoUltraArpSe2RollNote[],
  semitones: number,
): GenoUltraArpSe2RollNote[] {
  if (!semitones) return [...notes];
  return notes.map((n) => ({
    ...n,
    pitch: genoWrapMidiToRange(
      n.pitch + semitones,
      GENO_BASS_LOOP_EDITOR_MIN,
      GENO_BASS_LOOP_EDITOR_MAX,
    ),
  }));
}

/** @deprecated Roll notes are edited directly — use genoBassEditorRollNotesToTrackNotes on apply. */
export function genoBassLoopSnapshotToSe2RollNotes(
  notes: readonly GenoUltraArpSe2RollNote[],
  _bpm?: number,
): GenoUltraArpSe2RollNote[] {
  return genoBassEditorRollNotesToTrackNotes(notes);
}

/** Sub/808 presets — mix-ready punch (re-exported for panel + loop preview). */
export {
  genoBassAudiblePreviewVoice,
  genoBassGroovePreviewVoice,
  genoBassKeyboardPreviewVoice,
  genoBassPlaybackVoice,
} from '@/app/lib/studio/genoBassMixReadyVoice';

/** Geno Bass deck keys — click-free mono ARP path (not per-note oscillator spawn). */
export function previewGenoBassKeyboardNote(
  ctx: AudioContext,
  stripOutput: AudioNode,
  pitch: number,
  velocity: number,
  voice: GenoUltraSynthVoiceParams,
  bpm: number,
  holdSec: number,
  bassGroup?: GenoBassMixGroup,
): void {
  void (async () => {
    const played = await playGenoCinematicOrchestraHit(
      ctx,
      stripOutput,
      voice.id,
      pitch,
      velocity,
    );
    if (played) return;
    previewGenoUltraSynthArpNote(
      ctx,
      stripOutput,
      pitch,
      velocity,
      genoBassAudiblePreviewVoice(voice, bassGroup),
      holdSec,
      bpm,
    );
  })();
}

/** MIDI velocity 1–127 for Geno Ultra engine (not 0–1). */
export function genoBassPreviewVelocityMidi(velocity127 = 118): number {
  return Math.max(96, Math.min(127, Math.round(velocity127)));
}
