/**
 * Progression chord map — Rip Chord / Chord Prism style (not chromatic C→B slots).
 */
import type { ChordMode, ChordSymbol } from '@/app/lib/creationStation/chordBuilder';
import type { GenoBarChordSpec } from '@/app/lib/studio/se2SynthGenoChordEngine';
import {
  SE2_SYNTH_GENO_LIVE_ZONE_SIZE,
  type Se2SynthGenoLiveKeySlot,
} from '@/app/lib/studio/se2SynthGenoLiveChordTypes';
import { se2SynthGenoLiveChordRootNote } from '@/app/lib/studio/se2SynthGenoLiveChordVoicing';
import type { GenoChordStyle } from '@/app/lib/studio/se2SynthGenoComposePrompt';
import type { Se2SynthGenoLiveGenreId } from '@/app/lib/studio/se2SynthGenoLiveChordTypes';

export function se2SynthGenoLiveChordCountForPreset(chordCount: number): number {
  return Math.min(chordCount, SE2_SYNTH_GENO_LIVE_ZONE_SIZE);
}

/** Default play order 1…N for the first N chord slots. */
export function se2SynthGenoLiveDefaultPlayOrder(chordCount: number): number[] {
  return Array.from({ length: SE2_SYNTH_GENO_LIVE_ZONE_SIZE }, (_, i) =>
    i < chordCount ? i + 1 : 0,
  );
}

/** Swap positions when user picks a new order on one trigger (unique 1…N). */
export function se2SynthGenoLiveSwapPlayOrder(
  playOrder: readonly number[],
  slotIndex: number,
  newPosition: number,
  chordCount: number,
): number[] {
  const next = [...playOrder];
  const oldPos = next[slotIndex] ?? 0;
  if (
    oldPos === newPosition
    || newPosition < 1
    || newPosition > chordCount
    || slotIndex < 0
    || slotIndex >= chordCount
  ) {
    return next;
  }
  const swapSlot = next.findIndex((p, i) => i < chordCount && p === newPosition);
  if (swapSlot < 0) return next;
  next[slotIndex] = newPosition;
  next[swapSlot] = oldPos;
  return next;
}

/**
 * Copy one slot's chord onto another existing slot (fixed card count).
 * Source slot is unchanged — e.g. C G G → C G C.
 */
export function se2SynthGenoLiveReplaceSlotChord<T extends object, R>(
  specs: readonly T[],
  romans: readonly R[],
  fromIndex: number,
  toIndex: number,
): { specs: T[]; romans: R[] } | null {
  if (fromIndex === toIndex) return null;
  if (
    fromIndex < 0
    || toIndex < 0
    || fromIndex >= specs.length
    || toIndex >= specs.length
    || fromIndex >= romans.length
    || toIndex >= romans.length
  ) {
    return null;
  }
  const nextSpecs = [...specs];
  const nextRomans = [...romans];
  nextSpecs[toIndex] = { ...specs[fromIndex]! };
  nextRomans[toIndex] = romans[fromIndex]!;
  return { specs: nextSpecs, romans: nextRomans };
}

/** Slot indices sorted by play order (1st chord in progression first). */
export function se2SynthGenoLiveOrderedSlotIndices(
  playOrder: readonly number[],
  chordCount: number,
): number[] {
  return Array.from({ length: chordCount }, (_, i) => i).sort(
    (a, b) => (playOrder[a] ?? a + 1) - (playOrder[b] ?? b + 1),
  );
}

export type Se2SynthGenoLiveKeyboardKey = {
  /** Stable slot in the progression (0 = first chord). */
  slotIndex: number;
  /** Chord root MIDI — label only; triggers are UI slots, not a piano map. */
  rootMidi: number;
  /** Root letter for this progression step (E, G, D, A♯…). */
  triggerLabel: string;
  roman: ChordSymbol;
  chordLabel: string;
  hasChord: boolean;
};

export function se2SynthGenoLiveBuildProgressionKeyboard(opts: {
  romans: readonly ChordSymbol[];
  specs: readonly GenoBarChordSpec[];
  keyRoot: number;
  chordMode: ChordMode;
  stylePreset: GenoChordStyle;
  genreId: Se2SynthGenoLiveGenreId;
  chordLabels?: readonly string[];
}): Se2SynthGenoLiveKeyboardKey[] {
  const count = se2SynthGenoLiveChordCountForPreset(
    Math.max(opts.specs.length, opts.romans.length),
  );
  const keys: Se2SynthGenoLiveKeyboardKey[] = [];
  for (let i = 0; i < count; i += 1) {
    const spec = opts.specs[i];
    const roman = opts.romans[i]!;
    if (!spec) continue;
    const { rootMidi, noteName } = se2SynthGenoLiveChordRootNote(
      opts.keyRoot,
      spec,
      opts.stylePreset,
      opts.genreId,
    );
    keys.push({
      slotIndex: i,
      rootMidi,
      triggerLabel: noteName,
      roman,
      chordLabel: opts.chordLabels?.[i] ?? `${i + 1} · ${roman}`,
      hasChord: true,
    });
  }
  return keys;
}

/** @deprecated Chromatic C3–B3 map — use se2SynthGenoLiveBuildProgressionKeyboard. */
export function se2SynthGenoLiveBuildKeyMap(
  romans: readonly ChordSymbol[],
  chordLabels?: readonly string[],
): Se2SynthGenoLiveKeySlot[] {
  const count = se2SynthGenoLiveChordCountForPreset(romans.length);
  const slots: Se2SynthGenoLiveKeySlot[] = [];
  for (let i = 0; i < count; i += 1) {
    slots.push({
      slotIndex: i,
      triggerMidi: 48 + i,
      triggerLabel: `Slot ${i + 1}`,
      chordIndex: i,
      chordLabel: chordLabels?.[i] ?? `Chord ${i + 1}`,
      roman: romans[i]!,
    });
  }
  return slots;
}

/** Progression trigger slot that plays at timeline bar index (0-based), respecting play order. */
export function se2SynthGenoLiveSlotForTimelineBar(
  playOrder: readonly number[],
  timelineBar: number,
): number {
  const want = timelineBar + 1;
  const idx = playOrder.findIndex((pos, slot) => (pos ?? slot + 1) === want);
  if (idx >= 0) return idx;
  return Math.min(Math.max(0, timelineBar), Math.max(0, playOrder.length - 1));
}

/** Active progression card during loop preview from the audio playhead beat. */
export function se2SynthGenoLiveSlotForPreviewBeat(
  previewBeat: number,
  beatsPerBar: number,
  barCount: number,
  playOrder: readonly number[],
  /** Chord-cycle length when the loop tiles (defaults to barCount). */
  cycleLength?: number,
): number {
  const bpb = Math.max(1, beatsPerBar);
  const bars = Math.max(1, barCount);
  const cycle = Math.max(1, cycleLength ?? bars);
  const bar = Math.floor(previewBeat / bpb) % bars;
  const cycleBar = bar % cycle;
  return se2SynthGenoLiveSlotForTimelineBar(playOrder, cycleBar);
}
