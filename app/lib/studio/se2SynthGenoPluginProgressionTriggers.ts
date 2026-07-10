/**
 * Chord Generator — progression triggers + play order (mirrors Live Chord UX, plugin-only).
 */
import type { ChordSymbol } from '@/app/lib/creationStation/chordBuilder';
import type { StudioDetectedKeyMode } from '@/app/lib/studio/studioAudioClipAnalysis';
import {
  GENO_PROGRESSIONS,
  type GenoBarChordSpec,
} from '@/app/lib/studio/se2SynthGenoChordEngine';
import type { Se2SynthGenoChordPluginState } from '@/app/lib/studio/se2SynthGenoChordPlugin';
import {
  se2SynthGenoLiveDefaultPlayOrder,
  se2SynthGenoLiveReplaceSlotChord,
  se2SynthGenoLiveSwapPlayOrder,
  type Se2SynthGenoLiveKeyboardKey,
} from '@/app/lib/studio/se2SynthGenoLiveChordMap';
import {
  se2SynthGenoEraCategoryLiveGenre,
  se2SynthGenoEraPresetById,
  se2SynthGenoEraProgressionMode,
  se2SynthGenoPluginMapPatternToBarCount,
  se2SynthGenoPluginRomansForBarCount,
  se2SynthGenoSpecsToDegrees,
} from '@/app/lib/studio/se2SynthGenoEraProgressionLibrary';
import {
  se2SynthGenoPluginBaseLoop,
  se2SynthGenoPluginPatternLoop,
  se2SynthGenoPluginSlotSpecForVoice,
} from '@/app/lib/studio/se2SynthGenoPluginLoopSpec';
import { se2SynthGenoPluginChordRootNote } from '@/app/lib/studio/se2SynthGenoPluginChordVoicing';

const MAJOR_ROMANS: ChordSymbol[] = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
const MINOR_ROMANS: ChordSymbol[] = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'];

function romanForDegree(degree: number, keyMode: StudioDetectedKeyMode): ChordSymbol {
  const d = ((Math.round(degree) % 7) + 7) % 7;
  if (keyMode === 'minor') return MINOR_ROMANS[d] ?? 'i';
  return MAJOR_ROMANS[d] ?? 'I';
}

function romansFromProgressionLabel(progressionId: Se2SynthGenoChordPluginState['progressionId']): ChordSymbol[] {
  const def = GENO_PROGRESSIONS.find((p) => p.id === progressionId);
  if (!def) return ['I'];
  return def.label.split('·').map((s) => s.trim()) as ChordSymbol[];
}

export { se2SynthGenoPluginBaseLoop, se2SynthGenoPluginSlotSpecForVoice } from '@/app/lib/studio/se2SynthGenoPluginLoopSpec';

/** Geno Build 2 — trigger cards always match the 4- or 8-bar loop, never preset cycle length. */
export function se2SynthGenoPluginChordCount(state: Se2SynthGenoChordPluginState): number {
  return state.barCount;
}

export function se2SynthGenoPluginPlayOrder(
  state: Se2SynthGenoChordPluginState,
  chordCount: number,
): number[] {
  const stored = state.pluginPlayOrder;
  if (stored?.length) {
    return Array.from({ length: chordCount }, (_, i) => stored[i] ?? i + 1);
  }
  return se2SynthGenoLiveDefaultPlayOrder(chordCount);
}

export function se2SynthGenoPluginSlotEnabled(
  state: Se2SynthGenoChordPluginState,
  chordCount: number,
): boolean[] {
  const stored = state.pluginSlotEnabled;
  if (stored?.length) {
    return Array.from({ length: chordCount }, (_, i) => stored[i] ?? true);
  }
  return Array.from({ length: chordCount }, () => true);
}

/** Reorder slots by play order — never compress (compression caused 5/6-card loops to wrap early). */
export function se2SynthGenoPluginApplyPlayOrderPermute<T>(
  items: readonly T[],
  playOrder: readonly number[],
): T[] {
  const count = items.length;
  if (count === 0) return [];
  const slotsByPosition = Array.from({ length: count }, (_, i) => i).sort(
    (a, b) => (playOrder[a] ?? a + 1) - (playOrder[b] ?? b + 1),
  );
  return slotsByPosition.map((slotIdx) => items[slotIdx]!);
}

/** Loop order for play-order swap — keeps full barCount slots. */
export function se2SynthGenoPluginOrderedLoopSpecs(
  loop: readonly GenoBarChordSpec[],
  playOrder: readonly number[],
  slotEnabled: readonly boolean[],
): GenoBarChordSpec[] {
  void slotEnabled;
  return se2SynthGenoPluginApplyPlayOrderPermute(loop, playOrder).map((s) => ({ ...s }));
}

export function se2SynthGenoPluginRomansForLoop(
  state: Se2SynthGenoChordPluginState,
  loop: readonly GenoBarChordSpec[],
  keyMode: StudioDetectedKeyMode,
): ChordSymbol[] {
  const preset = state.eraPresetId ? se2SynthGenoEraPresetById(state.eraPresetId) : undefined;
  const categoryId = state.eraCategoryId ?? 'pop-eras';
  const mode = se2SynthGenoEraProgressionMode(categoryId);
  const genreId = se2SynthGenoEraCategoryLiveGenre(categoryId);
  if (preset?.romans?.length) {
    return se2SynthGenoPluginRomansForBarCount(
      preset.romans,
      state.barCount,
      mode,
      genreId,
      preset.id,
      categoryId,
    );
  }
  const stored = state.progressionRomans;
  if (stored?.length) {
    return se2SynthGenoPluginRomansForBarCount(
      stored.length >= loop.length ? stored.slice(0, loop.length) : stored,
      state.barCount,
      mode,
      genreId,
      state.eraPresetId ?? '',
      categoryId,
    );
  }
  if (
    (state.progressionLoop?.length ?? 0) > 0
    || loop.some((spec) => (spec.chordIntervals?.length ?? 0) > 0)
  ) {
    return loop.map((spec) => romanForDegree(spec.degree, keyMode));
  }
  const fromLabel = romansFromProgressionLabel(state.progressionId);
  if (fromLabel.length === loop.length) return fromLabel;
  return loop.map((spec) => romanForDegree(spec.degree, keyMode));
}

export function se2SynthGenoPluginBuildProgressionKeyboard(opts: {
  state: Se2SynthGenoChordPluginState;
  keyRoot: number;
  keyMode: StudioDetectedKeyMode;
}): Se2SynthGenoLiveKeyboardKey[] {
  const loop = se2SynthGenoPluginBaseLoop(opts.state);
  const count = se2SynthGenoPluginChordCount(opts.state);
  const romans = se2SynthGenoPluginRomansForLoop(opts.state, loop, opts.keyMode);
  const keys: Se2SynthGenoLiveKeyboardKey[] = [];
  for (let i = 0; i < count; i += 1) {
    const spec = se2SynthGenoPluginSlotSpecForVoice(opts.state, i, opts.keyMode);
    const roman = romans[i];
    if (!spec || !roman) continue;
    const { rootMidi, noteName } = se2SynthGenoPluginChordRootNote(
      opts.keyRoot,
      opts.keyMode,
      opts.state,
      spec,
    );
    keys.push({
      slotIndex: i,
      rootMidi,
      triggerLabel: noteName,
      roman,
      chordLabel: `${i + 1} · ${roman}`,
      hasChord: true,
    });
  }
  return keys;
}

function pluginSeedRomans(
  state: Se2SynthGenoChordPluginState,
  rawPattern: readonly GenoBarChordSpec[],
  keyMode: StudioDetectedKeyMode,
): ChordSymbol[] {
  const preset = state.eraPresetId ? se2SynthGenoEraPresetById(state.eraPresetId) : undefined;
  if (preset?.romans?.length) return preset.romans;
  if (state.progressionRomans?.length) {
    if (state.progressionRomans.length <= rawPattern.length) {
      return state.progressionRomans.slice(0, rawPattern.length) as ChordSymbol[];
    }
    if (state.progressionRomans.length === state.barCount) {
      return state.progressionRomans as ChordSymbol[];
    }
  }
  return rawPattern.map((spec) => romanForDegree(spec.degree, keyMode));
}

/** Apply slot loop + play order → full barCount barChordSpecs on state. */
export function se2SynthGenoPluginSyncLoopToBars(
  state: Se2SynthGenoChordPluginState,
  keyMode: StudioDetectedKeyMode = 'major',
): Se2SynthGenoChordPluginState {
  const rawPattern = se2SynthGenoPluginPatternLoop(state);
  const categoryId = state.eraCategoryId ?? 'pop-eras';
  const mode = se2SynthGenoEraProgressionMode(categoryId);
  const genreId = se2SynthGenoEraCategoryLiveGenre(categoryId);
  const preset = state.eraPresetId ? se2SynthGenoEraPresetById(state.eraPresetId) : undefined;
  const seedRomans = pluginSeedRomans(state, rawPattern, keyMode);
  const loop = se2SynthGenoPluginMapPatternToBarCount(rawPattern, state.barCount, {
    romans: seedRomans,
    eraCategoryId: categoryId,
    presetId: preset?.id ?? state.eraPresetId,
  });
  const progressionRomans = se2SynthGenoPluginRomansForBarCount(
    seedRomans,
    state.barCount,
    mode,
    genreId,
    preset?.id ?? state.eraPresetId ?? '',
    categoryId,
  );
  const chordCount = state.barCount;
  const playOrder = se2SynthGenoPluginPlayOrder(state, chordCount);
  const slotEnabled = se2SynthGenoPluginSlotEnabled(state, chordCount);
  const orderedSpecs = se2SynthGenoPluginOrderedLoopSpecs(loop, playOrder, slotEnabled);
  const orderedRomans = se2SynthGenoPluginApplyPlayOrderPermute(progressionRomans, playOrder);
  return {
    ...state,
    progressionLoop: orderedSpecs,
    progressionRomans: orderedRomans,
    pluginPlayOrder: playOrder,
    pluginSlotEnabled: slotEnabled,
    barChordSpecs: orderedSpecs,
    barDegrees: se2SynthGenoSpecsToDegrees(orderedSpecs),
  };
}

export function se2SynthGenoPluginSwapPlayOrder(
  state: Se2SynthGenoChordPluginState,
  slotIndex: number,
  newPosition: number,
): Se2SynthGenoChordPluginState {
  const chordCount = se2SynthGenoPluginChordCount(state);
  const playOrder = se2SynthGenoLiveSwapPlayOrder(
    se2SynthGenoPluginPlayOrder(state, chordCount),
    slotIndex,
    newPosition,
    chordCount,
  );
  return se2SynthGenoPluginSyncLoopToBars({ ...state, pluginPlayOrder: playOrder });
}

/** Copy one slot's chord onto another slot — same card count (source unchanged). */
export function se2SynthGenoPluginReplaceSlotChord(
  state: Se2SynthGenoChordPluginState,
  fromIndex: number,
  toIndex: number,
  keyMode: StudioDetectedKeyMode = 'major',
): Se2SynthGenoChordPluginState {
  const loop = se2SynthGenoPluginBaseLoop(state);
  const romans = se2SynthGenoPluginRomansForLoop(state, loop, keyMode);
  const replaced = se2SynthGenoLiveReplaceSlotChord(loop, romans, fromIndex, toIndex);
  if (!replaced) return state;
  return se2SynthGenoPluginSyncLoopToBars({
    ...state,
    progressionLoop: replaced.specs,
    progressionRomans: replaced.romans,
  });
}

export function se2SynthGenoPluginToggleSlot(
  state: Se2SynthGenoChordPluginState,
  slotIndex: number,
): Se2SynthGenoChordPluginState {
  const chordCount = se2SynthGenoPluginChordCount(state);
  const slotEnabled = [...se2SynthGenoPluginSlotEnabled(state, chordCount)];
  slotEnabled[slotIndex] = !slotEnabled[slotIndex];
  return se2SynthGenoPluginSyncLoopToBars({ ...state, pluginSlotEnabled: slotEnabled });
}

export function se2SynthGenoPluginSetSlotVoicingDepth(
  state: Se2SynthGenoChordPluginState,
  slotIndex: number,
  depth: GenoBarChordSpec['voicingDepth'],
): Se2SynthGenoChordPluginState {
  const loop = se2SynthGenoPluginBaseLoop(state);
  if (!loop[slotIndex]) return state;
  loop[slotIndex] = { ...loop[slotIndex]!, voicingDepth: depth };
  return se2SynthGenoPluginSyncLoopToBars({ ...state, progressionLoop: loop });
}

export function se2SynthGenoPluginApplyAllVoicingDepth(
  state: Se2SynthGenoChordPluginState,
  depth: GenoBarChordSpec['voicingDepth'],
): Se2SynthGenoChordPluginState {
  const loop = se2SynthGenoPluginBaseLoop(state).map((spec) => ({ ...spec, voicingDepth: depth }));
  return se2SynthGenoPluginSyncLoopToBars({ ...state, progressionLoop: loop });
}

export function se2SynthGenoPluginResetPlayOrder(
  state: Se2SynthGenoChordPluginState,
): Se2SynthGenoChordPluginState {
  const chordCount = se2SynthGenoPluginChordCount(state);
  return se2SynthGenoPluginSyncLoopToBars({
    ...state,
    pluginPlayOrder: se2SynthGenoLiveDefaultPlayOrder(chordCount),
    pluginSlotEnabled: Array.from({ length: chordCount }, () => true),
  });
}
