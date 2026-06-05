export type NoteDivision = '1/4' | '1/4D' | '1/4T' | '1/8' | '1/8D' | '1/8T' | '1/16';

export const NOTE_DIVISION_OPTIONS: readonly NoteDivision[] = [
  '1/4',
  '1/4D',
  '1/4T',
  '1/8',
  '1/8D',
  '1/8T',
  '1/16',
] as const;

export const NOTE_DIVISION_LABELS: Record<NoteDivision, string> = {
  '1/4': '1/4',
  '1/4D': '1/4 dotted',
  '1/4T': '1/4 triplet',
  '1/8': '1/8',
  '1/8D': '1/8 dotted',
  '1/8T': '1/8 triplet',
  '1/16': '1/16',
};

/**
 * Exact delay time in seconds from project tempo and musical grid division.
 */
export function calculateDelayTime(bpm: number, division: NoteDivision): number {
  const quarterNoteTime = 60 / Math.max(40, bpm);

  switch (division) {
    case '1/4':
      return quarterNoteTime;
    case '1/4D':
      return quarterNoteTime * 1.5;
    case '1/4T':
      return quarterNoteTime * (2 / 3);
    case '1/8':
      return quarterNoteTime * 0.5;
    case '1/8D':
      return quarterNoteTime * 0.5 * 1.5;
    case '1/8T':
      return quarterNoteTime * 0.5 * (2 / 3);
    case '1/16':
      return quarterNoteTime * 0.25;
    default:
      return quarterNoteTime;
  }
}
