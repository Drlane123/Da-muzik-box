/**
 * Web-side sample filename helpers — mirrors JUCE GuitarSampleMatrix naming.
 */
import { GUITAR_STRING_COUNT } from '@/app/lib/studio/guitarInstrument/types';

/** Coordinator stringIdx 0 = low E → file string_6; stringIdx 5 = high e → file string_1. */
export function coordinatorIndexToFileStringNumber(stringIdx: number): number {
  return GUITAR_STRING_COUNT - stringIdx;
}

export function buildGuitarSampleFileName(stringIdx: number, fret: number): string {
  const stringNum = coordinatorIndexToFileStringNumber(stringIdx);
  return `string_${stringNum}_fret_${fret}.wav`;
}

export function parseGuitarSampleFileName(
  fileName: string,
): { stringIdx: number; fret: number } | null {
  const m = /^string_([1-6])_fret_(\d{1,2})\.wav$/i.exec(fileName);
  if (!m) return null;
  const fileStringNum = Number(m[1]);
  const fret = Number(m[2]);
  if (fret < 0 || fret > 24) return null;
  const stringIdx = GUITAR_STRING_COUNT - fileStringNum;
  if (stringIdx < 0 || stringIdx >= GUITAR_STRING_COUNT) return null;
  return { stringIdx, fret };
}

export const GUITAR_SAMPLE_ASSET_DIR = 'samples/guitar-fretboard';
