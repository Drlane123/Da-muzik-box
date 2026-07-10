/**
 * Beat Lab Pattern Bank — maps hand-crafted {@link PatternPreset} drums
 * (16-step MIDI-style grids) onto the 16-lane Creation Station drum matrix.
 */

import { DRUM_PATTERN_PRESETS, getPatternPresetBpm, type PatternPreset } from '@/app/lib/patternPresets';
import { beatLabModernRnbDrumsPostProcess } from '@/app/lib/creationStation/beatLabModernRnbPatterns';
import {
  BEAT_PADS_MAX_LOOP_BARS,
  BEAT_PADS_MIN_LOOP_BARS,
  BEAT_PADS_STEPS_PER_BAR,
  normalizeBeatPadsPattern,
} from '@/app/lib/creationStation/beatLabDrumMachineSequencer';

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

/** User-saved patterns chip in Pattern Bank (not a factory genre column). */
export const BEAT_LAB_USER_SAVES_BANK_ID = 'my-saves' as const;

export type BeatLabPatternBankId =
  | 'trap'
  | 'rnb'
  | 'house'
  | 'dance'
  | 'disco'
  | 'techno'
  | 'afro'
  | 'reggae'
  | 'miami'
  | 'platinum-trap'
  | 'platinum-urban'
  | typeof BEAT_LAB_USER_SAVES_BANK_ID;

export type BeatLabPatternSlotId = 'A' | 'B';

export interface BeatLabPatternBankCategory {
  id: BeatLabPatternBankId;
  label: string;
  /** Matches {@link PatternPreset.genre} labels in patternPresets.ts */
  genres: readonly string[];
}

/** A bank — Trap / R&B / Up Tempo / Dance / Disco / Techno (pattern slot A). */
export const BEAT_LAB_PATTERN_BANKS_A: readonly BeatLabPatternBankCategory[] = [
  { id: 'trap', label: 'Trap', genres: ['Trap'] },
  { id: 'rnb', label: 'R&B', genres: ['R&B'] },
  { id: 'miami', label: 'Up Tempo', genres: ['Up Tempo'] },
  { id: 'dance', label: 'Dance', genres: ['Dance'] },
  { id: 'disco', label: 'Disco', genres: ['Disco'] },
  { id: 'techno', label: 'Techno', genres: ['Techno'] },
] as const;

/** B bank — Afro / Reggae / House + Platinum Urban (pattern slot B). */
export const BEAT_LAB_PATTERN_BANKS_B: readonly BeatLabPatternBankCategory[] = [
  { id: 'afro', label: 'Afro', genres: ['Afro'] },
  { id: 'reggae', label: 'Reggae', genres: ['Reggae'] },
  { id: 'house', label: 'House', genres: ['House'] },
  { id: 'platinum-trap', label: 'Trap · Hip-Hop', genres: ['Platinum Trap'] },
  { id: 'platinum-urban', label: 'R&B · Pop', genres: ['Platinum R&B', 'Platinum Pop'] },
] as const;

/** All genre columns (lookup by preset genre). */
export const BEAT_LAB_PATTERN_BANKS: readonly BeatLabPatternBankCategory[] = [
  ...BEAT_LAB_PATTERN_BANKS_A,
  ...BEAT_LAB_PATTERN_BANKS_B,
] as const;

export function getBeatLabPatternBanksForSlot(slot: BeatLabPatternSlotId): readonly BeatLabPatternBankCategory[] {
  return slot === 'B' ? BEAT_LAB_PATTERN_BANKS_B : BEAT_LAB_PATTERN_BANKS_A;
}

export function isBeatLabPatternBankBSlotId(id: BeatLabPatternBankId): boolean {
  return (
    id === 'afro' ||
    id === 'reggae' ||
    id === 'house' ||
    id === 'platinum-trap' ||
    id === 'platinum-urban'
  );
}

/** Auto-generated trap templates — hidden once Signature Trap Series ships. */
const TRAP_LEGACY_EXPANDED_IDS = new Set(
  Array.from({ length: 13 }, (_, i) => `trap-${18 + i}`),
);

export function getBeatLabDrumPresets(bankId: BeatLabPatternBankId): PatternPreset[] {
  const cat = BEAT_LAB_PATTERN_BANKS.find((b) => b.id === bankId);
  if (!cat) return [];
  const presets = DRUM_PATTERN_PRESETS.filter((p) => cat.genres.includes(p.genre));
  if (bankId === 'trap') {
    return presets.filter((p) => !TRAP_LEGACY_EXPANDED_IDS.has(p.id));
  }
  return presets;
}

export function countBeatLabDrumPresets(bankId: BeatLabPatternBankId): number {
  return getBeatLabDrumPresets(bankId).length;
}

/** Pattern bank column (Trap, R&B, …) for a preset genre string. */
export function beatLabPatternBankIdForPresetGenre(genre: string): BeatLabPatternBankId | undefined {
  const normalized = genre === 'Miami' ? 'Up Tempo' : genre;
  return BEAT_LAB_PATTERN_BANKS.find((b) => b.genres.includes(normalized))?.id;
}

export function beatLabPatternBankCategoryLabel(id: BeatLabPatternBankId): string {
  if (id === BEAT_LAB_USER_SAVES_BANK_ID) return 'My saves';
  return BEAT_LAB_PATTERN_BANKS.find((b) => b.id === id)?.label ?? id;
}

/** Hand-crafted presets use one bar of 16th-note steps (16 cells per 4/4 bar). */
export const BEAT_LAB_PRESET_STEPS_PER_BAR = 16;

/** Pattern-bank presets default loop length (grid + transport span). */
export const BEAT_LAB_PRESET_LOOP_BARS = 8;

/** Max loop length offered when loading pattern-bank presets. */
export const BEAT_LAB_PRESET_LOOP_BARS_MAX = 16;

/** Tile one bar of preset steps across `totalCols` columns at the current grid resolution. */
export function presetToBeatLabDrums(
  preset: PatternPreset,
  opts: { totalCols: number; gridStepsPerBar: number; presetStepsPerBar?: number },
): boolean[][] {
  const cols = Math.max(1, opts.totalCols);
  const presetSpb = Math.max(1, opts.presetStepsPerBar ?? preset.pattern[0]?.length ?? BEAT_LAB_PRESET_STEPS_PER_BAR);
  const gridSpb = Math.max(1, opts.gridStepsPerBar);
  const out: boolean[][] = Array.from({ length: 16 }, () => Array(cols).fill(false));

  for (let presetRow = 0; presetRow < preset.pattern.length; presetRow++) {
    const labRow = PRESET_TO_BEAT_LAB_ROW[presetRow];
    if (labRow === undefined) continue;
    const src = preset.pattern[presetRow];
    if (!src) continue;
    const dst = out[labRow]!;
    for (let ps = 0; ps < src.length; ps++) {
      if (!src[ps]) continue;
      const stepInBar = Math.min(gridSpb - 1, Math.round((ps * gridSpb) / presetSpb));
      for (let c = stepInBar; c < cols; c += gridSpb) {
        dst[c] = true;
      }
    }
  }

  return out;
}

/** Load a Pattern Bank preset into the Beat Pads 16th-note loop (4–16 bars). */
export function presetToBeatPadsPattern(
  preset: PatternPreset,
  loopBars = BEAT_LAB_PRESET_LOOP_BARS,
): { pattern: boolean[][]; loopBars: number; bpm: number } {
  const bars = Math.max(
    BEAT_PADS_MIN_LOOP_BARS,
    Math.min(BEAT_PADS_MAX_LOOP_BARS, Math.round(loopBars)),
  );
  const cols = bars * BEAT_PADS_STEPS_PER_BAR;
  let drums = presetToBeatLabDrums(preset, {
    totalCols: cols,
    gridStepsPerBar: BEAT_PADS_STEPS_PER_BAR,
    presetStepsPerBar: BEAT_LAB_PRESET_STEPS_PER_BAR,
  });
  drums = beatLabModernRnbDrumsPostProcess(preset.id, drums);
  return {
    pattern: normalizeBeatPadsPattern(drums, bars),
    loopBars: bars,
    bpm: getPatternPresetBpm(preset),
  };
}
