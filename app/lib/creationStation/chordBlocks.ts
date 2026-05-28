/**
 * Chord-block model for Chord Builder.
 *
 * Why this module exists:
 *
 * The original Chord Builder represents a progression as a fixed-length
 * array of bar-precise `TimelineSlot`s — one slot per bar, each either
 * empty or holding a chord. That's perfect for the piano-roll view (which
 * draws notes at bar boundaries) but it can't express ChordSeqAI-style
 * variable-duration chord blocks where one chord might last 6 beats and
 * the next one 2.
 *
 * To deliver the ChordSeqAI "chord grid" UX without ripping out the piano
 * roll, we add this parallel representation:
 *
 *   - `ChordBlock[]` = contiguous sequence of chord blocks, each with a
 *      duration in beats (1 beat = one quarter-note column in 4/4).
 *   - The chord-block grid edits this array directly (drag right edge =
 *      resize, drop pad = append, click = select).
 *   - The piano roll continues to read a derived bar-precise timeline
 *      via {@link blocksToTimeline}, so it keeps working unchanged.
 *   - The playback scheduler walks blocks at beat precision, so the user
 *      actually hears the durations they drew.
 *
 * Pure data + pure functions only — no React, no audio. The host
 * component owns state and decides when to mutate.
 */

import type { ChordSymbol } from './chordBuilder';

/**
 * One contiguous chord segment in a progression. `durationBeats` is in
 * quarter-note units (1 bar = 4 beats in 4/4), which matches the
 * `colsPerBar = 4` convention the piano roll already uses, so beats and
 * piano-roll columns map 1:1.
 *
 * `id` is a stable identifier used for React keys and for diffing during
 * drag-resize / reorder operations — never written back to disk, so we
 * regenerate it on migration / load.
 */
export interface ChordBlock {
  id: string;
  chord: ChordSymbol;
  durationBeats: number;
}

/** Bar-precise slot used by the piano roll. Re-exported here so callers
 *  don't have to know about the original Chord Builder internal type. */
export interface TimelineSlot {
  chord: ChordSymbol | null;
}

/** Minimum block duration the grid will allow on resize. One quarter note
 *  is short enough for any musical use; tighter than that runs into the
 *  bar-precise piano roll's rounding behavior + the playback scheduler's
 *  minimum-event window. */
export const MIN_BLOCK_BEATS = 1;

/** Largest block duration the grid will allow. 16 beats = 4 bars in 4/4,
 *  which is long enough for a "hold this chord for a full phrase" gesture
 *  while keeping the grid scroll bar usable. Resizes clamp to this. */
export const MAX_BLOCK_BEATS = 64;

let blockCounter = 0;

/** Stable-ish block id. Counter + timestamp avoids accidental collisions
 *  when many blocks are created within a single millisecond (paste, auto-
 *  generate, etc.). */
export function newBlockId(): string {
  blockCounter += 1;
  return `cb-block-${Date.now().toString(36)}-${blockCounter}`;
}

// ─────────────────────────────────────────────────────────────────────────
// Derivation: blocks ↔ timeline
// ─────────────────────────────────────────────────────────────────────────

/**
 * Build a bar-precise {@link TimelineSlot} array from a contiguous blocks
 * sequence. Each block's chord fills every bar it overlaps; if a block
 * starts mid-bar (i.e. the previous block's duration wasn't bar-aligned),
 * the chord still occupies the starting bar because that's what a
 * listener would hear there.
 *
 * Result length is always `totalBars` — trailing bars beyond the last
 * block are padded with `{chord: null}`. Bars completely covered by an
 * earlier block keep that block's chord even if the next block hasn't
 * started yet.
 */
export function blocksToTimeline(
  blocks: ReadonlyArray<ChordBlock>,
  totalBars: number,
  beatsPerBar: number,
): TimelineSlot[] {
  const slots: TimelineSlot[] = Array.from({ length: Math.max(0, totalBars) }, () => ({
    chord: null,
  }));
  let beat = 0;
  for (const b of blocks) {
    if (b.durationBeats <= 0) continue;
    const startBar = Math.floor(beat / beatsPerBar);
    // Use an epsilon to avoid stretching into the next bar when the block
    // ends exactly on a bar boundary (e.g. 4 beats starting at beat 0 ends
    // at beat 4 = start of bar 1, NOT inside bar 1).
    const endBeatExclusive = beat + b.durationBeats;
    const lastBarTouched = Math.max(
      startBar,
      Math.ceil(endBeatExclusive / beatsPerBar) - 1,
    );
    for (let bar = startBar; bar <= lastBarTouched && bar < slots.length; bar++) {
      slots[bar] = { chord: b.chord };
    }
    beat = endBeatExclusive;
  }
  return slots;
}

/**
 * Build a contiguous blocks sequence from an existing bar-precise
 * timeline. Adjacent identical chords merge into one block whose duration
 * is `(slotCount * beatsPerBar)` beats; empty slots split the merge and
 * are NOT preserved (blocks are contiguous, there are no "rest" blocks).
 *
 * Used for one-shot migration of saved Progressions written before the
 * blocks model existed. Once a progression has a `blocks` field, this
 * function is no longer in the critical path.
 */
export function timelineToBlocks(
  timeline: ReadonlyArray<TimelineSlot>,
  beatsPerBar: number,
): ChordBlock[] {
  const blocks: ChordBlock[] = [];
  let i = 0;
  while (i < timeline.length) {
    const c = timeline[i]!.chord;
    if (c == null) {
      i++;
      continue;
    }
    let j = i + 1;
    while (j < timeline.length && timeline[j]!.chord === c) j++;
    blocks.push({
      id: newBlockId(),
      chord: c,
      durationBeats: (j - i) * beatsPerBar,
    });
    i = j;
  }
  return blocks;
}

// ─────────────────────────────────────────────────────────────────────────
// Pure block-level edit operations
// ─────────────────────────────────────────────────────────────────────────

/** Append a new block at the end of the sequence. Default duration is
 *  one bar so the user can immediately drag-resize from a sensible
 *  starting point. */
export function appendBlock(
  blocks: ReadonlyArray<ChordBlock>,
  chord: ChordSymbol,
  beatsPerBar: number,
): ChordBlock[] {
  return [
    ...blocks,
    { id: newBlockId(), chord, durationBeats: beatsPerBar },
  ];
}

/** Replace the chord of an existing block without touching its duration.
 *  Use this when the user drops a different chord pad onto an existing
 *  block, or when the AI Suggestions strip swaps a single chord. */
export function replaceBlockChord(
  blocks: ReadonlyArray<ChordBlock>,
  blockId: string,
  chord: ChordSymbol,
): ChordBlock[] {
  return blocks.map((b) => (b.id === blockId ? { ...b, chord } : b));
}

/** Resize an existing block's duration. The new value is clamped to
 *  `[MIN_BLOCK_BEATS, MAX_BLOCK_BEATS]`; pass an already-snapped value if
 *  you want beat-quantised resizing (`Math.round(rawBeats)` etc.). */
export function resizeBlock(
  blocks: ReadonlyArray<ChordBlock>,
  blockId: string,
  durationBeats: number,
): ChordBlock[] {
  const clamped = Math.max(MIN_BLOCK_BEATS, Math.min(MAX_BLOCK_BEATS, durationBeats));
  return blocks.map((b) =>
    b.id === blockId ? { ...b, durationBeats: clamped } : b,
  );
}

/** Remove a block from the sequence. Subsequent blocks shift left to keep
 *  the progression contiguous (no gaps). */
export function removeBlock(
  blocks: ReadonlyArray<ChordBlock>,
  blockId: string,
): ChordBlock[] {
  return blocks.filter((b) => b.id !== blockId);
}

/** Move a block from one index to another. Used by long-press reorder
 *  drags in the grid. Both indices are bounds-clamped so out-of-range
 *  values don't throw. */
export function reorderBlock(
  blocks: ReadonlyArray<ChordBlock>,
  fromIndex: number,
  toIndex: number,
): ChordBlock[] {
  if (blocks.length === 0) return [];
  const from = Math.max(0, Math.min(blocks.length - 1, fromIndex));
  const to = Math.max(0, Math.min(blocks.length - 1, toIndex));
  if (from === to) return blocks.slice();
  const out = blocks.slice();
  const [moved] = out.splice(from, 1);
  if (moved) out.splice(to, 0, moved);
  return out;
}

/** Replace ALL blocks with a fresh sequence. Used by Generate / Clear /
 *  Auto-Generate Song. Returns a *copy* so callers can keep the input
 *  array stable in React state. */
export function setBlocks(blocks: ReadonlyArray<ChordBlock>): ChordBlock[] {
  return blocks.slice();
}

// ─────────────────────────────────────────────────────────────────────────
// Convenience: cumulative beat positions for rendering
// ─────────────────────────────────────────────────────────────────────────

/**
 * Compute the start beat (inclusive) of every block in `blocks`. Returned
 * array has the same length as `blocks`; index N is the beat at which
 * `blocks[N]` begins. The grid renderer uses this to position blocks and
 * the playback scheduler uses it to schedule chord fires.
 */
export function cumulativeStartBeats(
  blocks: ReadonlyArray<ChordBlock>,
): number[] {
  const out: number[] = new Array(blocks.length);
  let beat = 0;
  for (let i = 0; i < blocks.length; i++) {
    out[i] = beat;
    beat += blocks[i]!.durationBeats;
  }
  return out;
}

/** Total length of the blocks sequence in beats — useful for resizing the
 *  grid viewport, computing playback loop length, and deciding when the
 *  user has filled past `totalBars`. */
export function totalBlockBeats(blocks: ReadonlyArray<ChordBlock>): number {
  let beat = 0;
  for (const b of blocks) beat += b.durationBeats;
  return beat;
}

/** One scheduled chord fire — one trigger per chord block with full duration. */
export interface ChordScheduleEvent {
  chord: ChordSymbol;
  startBeat: number;
  durationBeats: number;
}

/** One event per block — chord plays once and sustains for the block length. */
export function blocksToScheduleEvents(
  blocks: ReadonlyArray<ChordBlock>,
): ChordScheduleEvent[] {
  const events: ChordScheduleEvent[] = [];
  let beat = 0;
  for (const block of blocks) {
    if (block.durationBeats <= 0) continue;
    events.push({
      chord: block.chord,
      startBeat: beat,
      durationBeats: block.durationBeats,
    });
    beat += block.durationBeats;
  }
  return events;
}

/** Schedule from timeline via merged blocks (no hold-forward on empty bars). */
export function timelineToScheduleEvents(
  timeline: ReadonlyArray<TimelineSlot>,
  _totalBars: number,
  beatsPerBar = 4,
): ChordScheduleEvent[] {
  return blocksToScheduleEvents(timelineToBlocks(timeline, beatsPerBar));
}

export function scheduleEventStartBeats(events: ReadonlyArray<ChordScheduleEvent>): number[] {
  return events.map((e) => e.startBeat);
}

export function totalScheduleBeats(events: ReadonlyArray<ChordScheduleEvent>): number {
  if (events.length === 0) return 0;
  const last = events[events.length - 1]!;
  return last.startBeat + last.durationBeats;
}
