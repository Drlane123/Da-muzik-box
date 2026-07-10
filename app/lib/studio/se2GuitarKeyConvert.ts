/**
 * SE2 Guitar — transpose loops / progressions to the user's chosen key.
 */
import { SE2_GUITAR_PITCH_HI, SE2_GUITAR_PITCH_LO } from '@/app/lib/studio/se2GuitarTrack';
import type { Se2GuitarChordId } from '@/app/lib/studio/se2GuitarChords';
import { SE2_GUITAR_CHORDS } from '@/app/lib/studio/se2GuitarChords';
import type { Se2GuitarLoopNote, Se2GuitarLoopPreset } from '@/app/lib/studio/se2GuitarLoopPresets';
import type { Se2GuitarScaleId } from '@/app/lib/studio/se2GuitarScales';
import { SE2_GUITAR_SCALE_OPTIONS } from '@/app/lib/studio/se2GuitarScales';

const ROOT_TO_PC: Record<string, number> = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
};

const PC_TO_ROOT = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export function se2GuitarRootToPc(root: string): number {
  return ROOT_TO_PC[root] ?? 0;
}

export function se2GuitarPcToRoot(pc: number): string {
  return PC_TO_ROOT[((pc % 12) + 12) % 12] ?? 'C';
}

/** Semitone shift from source key root → target key root (chromatic). */
export function se2GuitarKeySemitoneDelta(fromRoot: string, toRoot: string): number {
  const from = se2GuitarRootToPc(fromRoot);
  const to = se2GuitarRootToPc(toRoot);
  let d = to - from;
  if (d > 6) d -= 12;
  if (d < -6) d += 12;
  return d;
}

export function se2GuitarClampGuitarPitch(pitch: number): number {
  return Math.max(SE2_GUITAR_PITCH_LO, Math.min(SE2_GUITAR_PITCH_HI, Math.round(pitch)));
}

export function se2GuitarTransposePitch(pitch: number, semis: number): number {
  return se2GuitarClampGuitarPitch(pitch + semis);
}

export function se2GuitarTransposeLoopNotes(
  notes: readonly Se2GuitarLoopNote[],
  semis: number,
): Se2GuitarLoopNote[] {
  if (semis === 0) return notes.map((n) => ({ ...n }));
  return notes.map((n) => ({
    ...n,
    pitch: se2GuitarTransposePitch(n.pitch, semis),
  }));
}

export function se2GuitarTransposeMockNotes<T extends { pitch: number }>(
  notes: readonly T[],
  semis: number,
): T[] {
  if (semis === 0) return notes.map((n) => ({ ...n }));
  return notes.map((n) => ({
    ...n,
    pitch: se2GuitarTransposePitch(n.pitch, semis),
  }));
}

/** First chord token in a card line — "C · G · Am" → "C". */
export function se2GuitarInferKeyFromChordLine(chordLine: string): string {
  const token = chordLine.split('·')[0]?.trim().split(/\s+/)[0] ?? 'C';
  const m = token.match(/^([A-G](?:#|b)?)/i);
  if (!m) return 'C';
  const raw = m[1]!;
  if (raw.length === 1) return raw.toUpperCase();
  return raw[0]!.toUpperCase() + raw.slice(1);
}

export function se2GuitarInferLoopSourceKey(preset: Pick<Se2GuitarLoopPreset, 'chordLine'>): string {
  return se2GuitarInferKeyFromChordLine(preset.chordLine);
}

export function se2GuitarChordRootName(chordId: Se2GuitarChordId): string {
  const ch = SE2_GUITAR_CHORDS.find((c) => c.id === chordId);
  if (!ch || ch.pitches.length === 0) return 'C';
  return se2GuitarPcToRoot(ch.pitches[0]!);
}

/** Shift a chord symbol root — "Am7" + 9 → "F#m7". */
export function se2GuitarTransposeChordSymbol(symbol: string, semis: number): string {
  const trimmed = symbol.trim();
  if (!trimmed || semis === 0) return trimmed;
  const m = trimmed.match(/^([A-G])([#b]?)(.*)$/i);
  if (!m) return trimmed;
  const pc = se2GuitarRootToPc(m[1]!.toUpperCase() + (m[2] ?? ''));
  const next = se2GuitarPcToRoot(pc + semis);
  return `${next}${m[3] ?? ''}`;
}

export function se2GuitarTransposeChordLine(chordLine: string, semis: number): string {
  if (semis === 0) return chordLine;
  return chordLine
    .split('·')
    .map((part) => se2GuitarTransposeChordSymbol(part.trim(), semis))
    .join(' · ');
}

export function se2GuitarScaleLabel(scaleId: Se2GuitarScaleId): string {
  return SE2_GUITAR_SCALE_OPTIONS.find((o) => o.id === scaleId)?.label ?? scaleId;
}

export function se2GuitarKeyShiftLabel(
  sourceKey: string,
  targetKey: string,
  scaleId: Se2GuitarScaleId,
  semis: number,
): string {
  if (semis === 0) return `${sourceKey} (original)`;
  const sign = semis > 0 ? `+${semis}` : `${semis}`;
  return `${sourceKey} → ${targetKey} ${se2GuitarScaleLabel(scaleId)} (${sign})`;
}

export type Se2GuitarKeyConvertSelection = {
  label: string;
  sourceKey: string;
  chordLine?: string;
};
