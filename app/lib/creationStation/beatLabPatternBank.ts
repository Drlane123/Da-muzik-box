/**
 * Beat Lab Pattern Bank — maps hand-crafted {@link PatternPreset} drums
 * (16-step MIDI-style grids) onto the 16-lane Creation Station drum matrix.
 */

import { DRUM_PATTERN_PRESETS, type PatternPreset } from '@/app/lib/patternPresets';

/** patternPresets row → Beat Lab lane (see GENIUS_LANE_LABELS in CreationStationScreen). */
const PRESET_TO_BEAT_LAB_ROW: readonly number[] = [
  0, // Kick
  1, // Snare
  2, // Clap → Snare 2
  3, // Hi-hat
  4, // Open hat
  6, // Tom hi → Tom
  5, // Tom lo → Pan crash
  7, // Rim
];

export type BeatLabPatternBankId = 'trap' | 'rnb' | 'house' | 'dance' | 'disco' | 'techno';

export interface BeatLabPatternBankCategory {
  id: BeatLabPatternBankId;
  label: string;
  /** Matches {@link PatternPreset.genre} labels in patternPresets.ts */
  genres: readonly string[];
}

export const BEAT_LAB_PATTERN_BANKS: readonly BeatLabPatternBankCategory[] = [
  { id: 'trap', label: 'Trap', genres: ['Trap'] },
  { id: 'rnb', label: 'R&B', genres: ['R&B'] },
  { id: 'house', label: 'House', genres: ['House'] },
  { id: 'dance', label: 'Dance', genres: ['Dance'] },
  { id: 'disco', label: 'Disco', genres: ['Disco'] },
  { id: 'techno', label: 'Techno', genres: ['Techno'] },
] as const;

export function getBeatLabDrumPresets(bankId: BeatLabPatternBankId): PatternPreset[] {
  const cat = BEAT_LAB_PATTERN_BANKS.find((b) => b.id === bankId);
  if (!cat) return [];
  return DRUM_PATTERN_PRESETS.filter((p) => cat.genres.includes(p.genre));
}

export function countBeatLabDrumPresets(bankId: BeatLabPatternBankId): number {
  return getBeatLabDrumPresets(bankId).length;
}

/** Pattern bank column (Trap, R&B, …) for a preset genre string. */
export function beatLabPatternBankIdForPresetGenre(genre: string): BeatLabPatternBankId | undefined {
  return BEAT_LAB_PATTERN_BANKS.find((b) => b.genres.includes(genre))?.id;
}

export function beatLabPatternBankCategoryLabel(id: BeatLabPatternBankId): string {
  return BEAT_LAB_PATTERN_BANKS.find((b) => b.id === id)?.label ?? id;
}

/** Tile one bar of preset steps across `totalCols` columns. */
export function presetToBeatLabDrums(
  preset: PatternPreset,
  opts: { totalCols: number },
): boolean[][] {
  const cols = Math.max(1, opts.totalCols);
  const out: boolean[][] = Array.from({ length: 16 }, () => Array(cols).fill(false));
  const baseLen = preset.pattern[0]?.length ?? 16;

  for (let presetRow = 0; presetRow < preset.pattern.length; presetRow++) {
    const labRow = PRESET_TO_BEAT_LAB_ROW[presetRow];
    if (labRow === undefined) continue;
    const src = preset.pattern[presetRow];
    if (!src) continue;
    const dst = out[labRow]!;
    for (let c = 0; c < cols; c++) {
      if (src[c % baseLen]) dst[c] = true;
    }
  }

  return out;
}
