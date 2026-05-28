/**
 * Expand Roman-numeral chord spellings to 3–7 note voicings for playback / export.
 */

import type { ChordSymbol } from '@/app/lib/creationStation/chordBuilder';

export type ChordVoicingSize = 3 | 4 | 5 | 6 | 7;

export const CHORD_VOICING_OPTIONS: { value: ChordVoicingSize; label: string; hint: string }[] = [
  { value: 3, label: '3 keys · Triad', hint: 'Root, 3rd, 5th' },
  { value: 4, label: '4 keys · 7th', hint: 'Adds the 7th color' },
  { value: 5, label: '5 keys · 9th', hint: 'Adds the 9th extension' },
  { value: 6, label: '6 keys · 11th', hint: 'Adds the 11th extension' },
  { value: 7, label: '7 keys · Full', hint: 'Adds up through the 13th' },
];

/** Detect whether the spelled chord is minor-flavored from its third. */
function triadIsMinor(sorted: number[]): boolean {
  if (sorted.length < 2) return false;
  const third = ((sorted[1]! - sorted[0]!) % 12 + 12) % 12;
  return third === 3;
}

/** Add diatonic-style extensions above the root until we reach `targetSize`. */
export function expandChordVoicing(
  baseMidis: ReadonlyArray<number>,
  targetSize: ChordVoicingSize,
): number[] {
  if (baseMidis.length === 0) return [];
  const sorted = Array.from(new Set(baseMidis)).sort((a, b) => a - b);
  const root = sorted[0]!;
  const minor = triadIsMinor(sorted);
  const out = new Set(sorted);

  const ext7 = minor ? 10 : 11;
  const ext9 = 14;
  const ext11 = 17;
  const ext13 = 21;

  const tryAdd = (semi: number) => {
    const m = root + semi;
    if (m >= 36 && m <= 96) out.add(m);
  };

  const has7 = [...out].some((m) => ((m - root) % 12 + 12) % 12 === ext7);
  if (targetSize >= 4 && !has7) tryAdd(ext7);
  if (targetSize >= 5) tryAdd(ext9);
  if (targetSize >= 6) tryAdd(ext11);
  if (targetSize >= 7) tryAdd(ext13);

  const notes = [...out].sort((a, b) => a - b);
  if (notes.length <= targetSize) return notes;
  return notes.slice(0, targetSize);
}

export function chordVoicingSizeFromSymbol(symbol: ChordSymbol): ChordVoicingSize {
  if (/13/.test(symbol)) return 7;
  if (/11/.test(symbol)) return 6;
  if (/9/.test(symbol)) return 5;
  if (/7|ø|maj7/i.test(symbol)) return 4;
  return 3;
}
