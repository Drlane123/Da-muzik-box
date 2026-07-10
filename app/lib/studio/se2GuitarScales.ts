/** Scale intervals from root (semitones). */
export const SE2_GUITAR_SCALE_INTERVALS = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentMajor: [0, 2, 4, 7, 9],
  pentMinor: [0, 3, 5, 7, 10],
  blues: [0, 3, 5, 6, 7, 10],
} as const;

export type Se2GuitarScaleId = keyof typeof SE2_GUITAR_SCALE_INTERVALS;

export const SE2_GUITAR_SCALE_OPTIONS: { id: Se2GuitarScaleId; label: string }[] = [
  { id: 'major', label: 'Major' },
  { id: 'minor', label: 'Minor' },
  { id: 'pentMajor', label: 'Pent Maj' },
  { id: 'pentMinor', label: 'Pent Min' },
  { id: 'blues', label: 'Blues' },
];

export const SE2_GUITAR_ROOT_OPTIONS = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
] as const;

const ROOT_PC: Record<string, number> = {
  C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11,
};

export function se2GuitarPitchClassInScale(
  midi: number,
  rootName: string,
  scaleId: Se2GuitarScaleId,
  capo = 0,
): boolean {
  const root = ROOT_PC[rootName] ?? 0;
  const pc = ((midi - capo) % 12 + 12) % 12;
  const rel = ((pc - root) % 12 + 12) % 12;
  return SE2_GUITAR_SCALE_INTERVALS[scaleId].includes(rel);
}
