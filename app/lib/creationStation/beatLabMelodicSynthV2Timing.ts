import { beatLabStepColToQuarterCol } from '@/app/lib/creationStation/beatLabChordPianoRollAdapter';
import type { BeatLabImportedChordRail } from '@/app/lib/creationStation/chordBuilderBeatLabImport';
import { chordSymbolToRootMidi } from '@/app/lib/creationStation/chordBuilder';
import type { BeatLabMidiNote } from '@/app/lib/creationStation/beatLabMidiRoll';
import type { BeatLabBassSynthVoiceParams } from '@/app/lib/creationStation/beatLabMelodicSynthV2State';

export type BeatLabSynthGlideDivision = '1/32' | '1/16' | '1/8' | '1/4';

const GLIDE_DIV_BEATS: Record<BeatLabSynthGlideDivision, number> = {
  '1/32': 1 / 8,
  '1/16': 1 / 4,
  '1/8': 1 / 2,
  '1/4': 1,
};

/** Map Beat Lab step quant (subdiv per beat) to a tempo-synced glide division. */
export function beatLabSynthV2GlideDivisionFromQuantSubdiv(
  quantSubdiv: number,
): BeatLabSynthGlideDivision {
  const s = Math.max(1, Math.round(quantSubdiv));
  if (s >= 16) return '1/32';
  if (s >= 8) return '1/32';
  if (s >= 4) return '1/16';
  if (s >= 2) return '1/8';
  return '1/4';
}

export function beatLabSynthV2GlideSeconds(
  voice: BeatLabBassSynthVoiceParams,
  bpm = 120,
): number {
  if ((voice.glideMode ?? 'mono') === 'off') return 0;
  if (voice.glideSync === true) {
    const div = (voice.glideDivision ?? '1/16') as BeatLabSynthGlideDivision;
    const beatSec = 60 / Math.max(1, bpm);
    return beatSec * (GLIDE_DIV_BEATS[div] ?? GLIDE_DIV_BEATS['1/16']);
  }
  if (voice.glideMs < 1) return 0;
  return voice.glideMs / 1000;
}

/** Note length in seconds from Beat Lab grid (one column = one sub-step). */
export function beatLabSynthV2GridDurationSec(subSpb: number, noteLenCols: number): number {
  const step = Math.max(1 / 256, subSpb);
  return step * Math.max(1, noteLenCols);
}

/**
 * Transport-locked duration: grid length, at least one sub-step, capped for safety.
 * Envelope tail may extend past note-off via amp release in the engine.
 */
export function beatLabSynthV2TransportDurationSec(
  subSpb: number,
  noteLenCols: number,
  voice: BeatLabBassSynthVoiceParams,
): number {
  const gridDur = beatLabSynthV2GridDurationSec(subSpb, noteLenCols);
  const minStep = Math.max(subSpb * 0.5, 0.03);
  const envHint =
    (voice.ampAttackMs + voice.ampDecayMs) / 1000 + voice.ampReleaseMs / 1000 * 0.35;
  return Math.min(8, Math.max(minStep, gridDur, envHint * 0.5));
}

const lastNoteByLane = new Map<number, { midi: number; when: number }>();

/**
 * Logic Legato: glide only when a prior note on this lane still sustains into `noteCol`.
 */
export function beatLabSynthV2LegatoSourceMidi(
  notes: readonly BeatLabMidiNote[],
  lane: number,
  noteCol: number,
  midiAtNote: (note: BeatLabMidiNote) => number,
): number | undefined {
  for (const other of notes) {
    if (other.lane !== lane || other.muted) continue;
    if (other.col >= noteCol) continue;
    const endCol = other.col + Math.max(1, other.len);
    if (endCol > noteCol) return midiAtNote(other);
  }
  return undefined;
}

export type BeatLabSynthV2GlideOpts = {
  legatoFromMidi?: number;
  /** Prior bar chord root (Beat Lab chord rail) — used when glideMode is chord. */
  chordFromMidi?: number;
  bpm?: number;
};

/** Place chord root in the same octave neighborhood as the target bass note. */
export function beatLabSynthV2FitRootNearMidi(rootMidi: number, targetMidi: number): number {
  let r = rootMidi;
  while (r > targetMidi + 7) r -= 12;
  while (r < targetMidi - 14) r += 12;
  return Math.max(0, Math.min(127, Math.round(r)));
}

function stepColToBarIdx(
  stepCol: number,
  subdiv: number,
  beatsPerBar: number,
  colsPerBar: number,
): number {
  const qCol = beatLabStepColToQuarterCol(stepCol, subdiv, beatsPerBar, colsPerBar);
  return Math.max(0, Math.floor(qCol / Math.max(1, colsPerBar)));
}

/**
 * First note in a bar with a chord rail: glide from the previous bar’s chord root.
 * Walking notes in the same bar still use mono (last note on lane).
 */
export function beatLabSynthV2ChordGlideSourceMidi(
  notes: readonly BeatLabMidiNote[],
  lane: number,
  noteCol: number,
  targetMidi: number,
  rail: BeatLabImportedChordRail,
  subdiv: number,
  beatsPerBar = 4,
  colsPerBar = 4,
  barMask = 0xffffffff,
): number | undefined {
  const barIdx = stepColToBarIdx(noteCol, subdiv, beatsPerBar, colsPerBar);
  if (barIdx < 1) return undefined;
  if (barIdx <= 31 && (barMask & (1 << barIdx)) === 0) return undefined;

  for (const other of notes) {
    if (other.lane !== lane || other.muted) continue;
    if (other.col >= noteCol) continue;
    const otherBar = stepColToBarIdx(other.col, subdiv, beatsPerBar, colsPerBar);
    if (otherBar === barIdx) return undefined;
  }

  const prevChord = rail.timeline[barIdx - 1]?.chord;
  if (!prevChord) return undefined;
  const root = chordSymbolToRootMidi(prevChord, rail.keyRoot, rail.mode, 2);
  if (root == null) return undefined;
  const from = beatLabSynthV2FitRootNearMidi(root, targetMidi);
  if (from === targetMidi) return undefined;
  return from;
}

/**
 * Glide / portamento (Logic ES2 / Retro Synth style).
 * - mono: every new note slides from the previous note on the lane
 * - legato: slide only when `legatoFromMidi` is set (overlapping notes in the roll)
 * - chord: first note each bar slides from prior bar chord root; same bar = mono
 * Glide time is fixed (glideMs / sync division), not stretched by interval size.
 */
export function beatLabSynthV2GlideInfo(
  lane: number,
  midi: number,
  whenSec: number,
  voice: BeatLabBassSynthVoiceParams,
  opts?: BeatLabSynthV2GlideOpts,
): { glideSec: number; fromMidi?: number } {
  const mode = voice.glideMode ?? 'mono';
  const glideSec = beatLabSynthV2GlideSeconds(voice, opts?.bpm ?? 120);
  if (mode === 'off' || glideSec <= 0.0005) {
    lastNoteByLane.set(lane, { midi, when: whenSec });
    return { glideSec: 0 };
  }

  if (mode === 'legato') {
    const from = opts?.legatoFromMidi;
    const prev = lastNoteByLane.get(lane);
    lastNoteByLane.set(lane, { midi, when: whenSec });
    if (from != null && from !== midi) return { glideSec, fromMidi: from };
    // Bass/808 usability: if there is no overlap source, gracefully fall back to mono glide.
    if (!prev || prev.midi === midi) return { glideSec: 0 };
    const dt = Math.max(0, whenSec - prev.when);
    if (dt > 4) return { glideSec: 0 };
    return { glideSec, fromMidi: prev.midi };
  }

  if (mode === 'chord') {
    const chordFrom = opts?.chordFromMidi;
    if (chordFrom != null && chordFrom !== midi) {
      lastNoteByLane.set(lane, { midi, when: whenSec });
      return { glideSec, fromMidi: chordFrom };
    }
    const prev = lastNoteByLane.get(lane);
    lastNoteByLane.set(lane, { midi, when: whenSec });
    if (!prev || prev.midi === midi) return { glideSec: 0 };
    const dt = Math.max(0, whenSec - prev.when);
    if (dt > 4) return { glideSec: 0 };
    return { glideSec, fromMidi: prev.midi };
  }

  const prev = lastNoteByLane.get(lane);
  lastNoteByLane.set(lane, { midi, when: whenSec });
  if (!prev || prev.midi === midi) return { glideSec: 0 };
  const dt = Math.max(0, whenSec - prev.when);
  if (dt > 4) return { glideSec: 0 };
  return { glideSec, fromMidi: prev.midi };
}

export function resetBeatLabSynthV2GlideState(lane?: number): void {
  if (lane == null) lastNoteByLane.clear();
  else lastNoteByLane.delete(lane);
}
