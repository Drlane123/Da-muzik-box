/**
 * Geno Bass — groove generation engine (Bass Dragon–style feel).
 * Rhythm mutation, mode-aware degrees, chord-tone mapping, bar approaches.
 */
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import {
  grooveLabClampBassRootMidi,
  grooveLabInferBassRootFromChordMidis,
} from '@/app/lib/creationStation/grooveLabPitch';
import { mulberry32 } from '@/app/lib/groovePatternEngine';
import type { GenoUltraArpChordSegment } from '@/app/lib/studio/genoUltraArpState';
import type { StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';
import { genoWrapMidiToRange } from '@/app/lib/studio/se2SynthGenoRanges';

export type GenoBassGrooveStepLike = {
  colInBar: number;
  degree: number;
  lenCols: number;
  vel?: number;
};

export const GENO_BASS_MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11] as const;
export const GENO_BASS_MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10] as const;

export const GENO_BASS_LOOP_EDITOR_MIN = 12;
export const GENO_BASS_LOOP_EDITOR_MAX = 60;

export type GenoBassKeyMode = StudioDetectedKeyMode | ChordMode;

export function genoBassScaleIntervals(mode: GenoBassKeyMode = 'major'): readonly number[] {
  return mode === 'minor' ? GENO_BASS_MINOR_INTERVALS : GENO_BASS_MAJOR_INTERVALS;
}

/** Diatonic degree → MIDI in key (mode-aware). */
export function genoBassDegreeToMidiInKey(
  rootMidi: number,
  degree: number,
  mode: GenoBassKeyMode = 'major',
): number {
  const intervals = genoBassScaleIntervals(mode);
  const diatonic = ((degree % intervals.length) + intervals.length) % intervals.length;
  const iv = intervals[diatonic]!;
  const oct = Math.floor(degree / intervals.length) * 12;
  return genoWrapMidiToRange(
    rootMidi + iv + oct,
    GENO_BASS_LOOP_EDITOR_MIN,
    GENO_BASS_LOOP_EDITOR_MAX,
  );
}

function chordThirdSemitones(pitches: readonly number[], bassRootMidi: number): number {
  const rootPc = ((Math.round(bassRootMidi) % 12) + 12) % 12;
  const pcs = new Set(pitches.map((p) => ((Math.round(p) % 12) + 12) % 12));
  const hasMinor = pcs.has((rootPc + 3) % 12);
  const hasMajor = pcs.has((rootPc + 4) % 12);
  if (hasMinor && !hasMajor) return 3;
  if (hasMajor && !hasMinor) return 4;
  if (hasMinor) return 3;
  return 4;
}

function chordSeventhSemitones(pitches: readonly number[], bassRootMidi: number): number | null {
  const rootPc = ((Math.round(bassRootMidi) % 12) + 12) % 12;
  const pcs = new Set(pitches.map((p) => ((Math.round(p) % 12) + 12) % 12));
  if (pcs.has((rootPc + 10) % 12)) return 10;
  if (pcs.has((rootPc + 11) % 12)) return 11;
  return null;
}

/**
 * Map template scale-degree role → pitch class relative to chord root.
 * 0 root · 2 third · 4 fifth · 5 fourth · 7 octave · 9 sixth · 11 seventh.
 */
export function genoBassChordToneMidi(opts: {
  templateDegree: number;
  chordRootMidi: number;
  chordPitches: readonly number[];
  keyRoot: number;
  keyMode: GenoBassKeyMode;
}): number {
  const bassRoot = grooveLabClampBassRootMidi(opts.chordRootMidi);
  const role = ((opts.templateDegree % 7) + 7) % 7;
  const octaveLift = Math.floor(opts.templateDegree / 7) * 12;
  let semitones = 0;

  switch (role) {
    case 0:
      semitones = 0;
      break;
    case 2:
      semitones = chordThirdSemitones(opts.chordPitches, bassRoot);
      break;
    case 4:
      semitones = 7;
      break;
    case 5:
      semitones = 5;
      break;
    case 7:
      semitones = 0;
      break;
    default: {
      const intervals = genoBassScaleIntervals(opts.keyMode);
      semitones = intervals[role] ?? 0;
      const seventh = role === 6 ? chordSeventhSemitones(opts.chordPitches, bassRoot) : null;
      if (seventh != null) semitones = seventh;
      break;
    }
  }

  if (role === 7 || opts.templateDegree >= 7) {
    semitones += 12;
  }

  return grooveLabClampBassRootMidi(bassRoot + semitones + (octaveLift > 12 ? octaveLift - 12 : 0));
}

/** Half-step approach into next chord root (walk / R&B pocket). */
export function genoBassApproachMidi(
  fromRootMidi: number,
  toRootMidi: number,
  beatInBar: number,
  beatsPerBar: number,
): number {
  const from = grooveLabClampBassRootMidi(fromRootMidi);
  const to = grooveLabClampBassRootMidi(toRootMidi);
  const delta = ((to % 12) - (from % 12) + 12) % 12;
  if (delta === 0) return from;
  const lateBar = beatInBar >= beatsPerBar * 0.72;
  if (!lateBar) return from;
  if (delta <= 2) return grooveLabClampBassRootMidi(from + 1);
  if (delta >= 10) return grooveLabClampBassRootMidi(from - 1);
  if (delta === 5 || delta === 7) return grooveLabClampBassRootMidi(from + (delta === 5 ? 1 : -1));
  return grooveLabClampBassRootMidi(from + (delta > 6 ? -1 : 1));
}

/** Seed-driven rhythm / degree mutation — real “Regenerate” variation. */
export function genoBassMutateGrooveSteps(
  steps: readonly GenoBassGrooveStepLike[],
  seed: number,
  intensity = 0.42,
): GenoBassGrooveStepLike[] {
  const rnd = mulberry32(seed ^ 0xba55da11);
  let out = steps.map((s) => ({ ...s }));

  if (rnd() < intensity) {
    out = out.filter((s) => {
      if (s.colInBar % 4 === 0) return true;
      if (s.vel != null && s.vel >= 0.95) return true;
      return rnd() > 0.22;
    });
  }

  for (const s of out) {
    if (rnd() < intensity * 0.55) {
      const nudge = rnd() < 0.5 ? -1 : 1;
      s.colInBar = Math.max(0, Math.min(15, s.colInBar + nudge));
    }
    if (rnd() < intensity * 0.35 && s.colInBar % 4 !== 0) {
      const palette = [0, 2, 4, 7] as const;
      s.degree = palette[Math.floor(rnd() * palette.length)]!;
    }
    if (rnd() < intensity * 0.2) {
      s.lenCols = Math.max(1, Math.min(8, s.lenCols + (rnd() < 0.5 ? -1 : 1)));
    }
  }

  if (rnd() < intensity * 0.45 && out.length > 0) {
    const anchor = out[Math.floor(rnd() * out.length)]!;
    const ghostCol = Math.max(0, anchor.colInBar - (rnd() < 0.5 ? 1 : 2));
    if (ghostCol !== anchor.colInBar && !out.some((s) => s.colInBar === ghostCol)) {
      out.push({
        colInBar: ghostCol,
        degree: rnd() < 0.6 ? 4 : 7,
        lenCols: 1,
        vel: 0.62 + rnd() * 0.12,
      });
    }
  }

  return out.sort((a, b) => a.colInBar - b.colInBar || a.degree - b.degree);
}

export function genoBassPhraseDegreeShift(
  phrase: readonly number[],
  bar: number,
  seed: number,
): number {
  const base = phrase[bar % phrase.length] ?? 0;
  const rnd = mulberry32(seed ^ bar * 7919);
  if (rnd() > 0.72) return base;
  const wobble = [0, 0, 2, 4, 5, 7];
  return wobble[Math.floor(rnd() * wobble.length)] ?? base;
}

export function genoBassResolveChordRoot(
  segment: GenoUltraArpChordSegment | undefined,
  keyRoot: number,
  keyMode: GenoBassKeyMode,
  fallbackRoot: number,
): number {
  if (!segment?.pitches?.length) return grooveLabClampBassRootMidi(fallbackRoot);
  return grooveLabInferBassRootFromChordMidis(segment.pitches, keyRoot, keyMode, fallbackRoot);
}
