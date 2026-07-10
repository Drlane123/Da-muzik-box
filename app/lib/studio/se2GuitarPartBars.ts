/**
 * SE2 Guitar — user-selected part length (strum progression / loop export).
 */
import type { Se2GuitarLoopNote } from '@/app/lib/studio/se2GuitarLoopPresets';

export type Se2GuitarPartBars = 4 | 8 | 12;

export const SE2_GUITAR_PART_BAR_OPTIONS: readonly Se2GuitarPartBars[] = [4, 8, 12];

export function se2GuitarPartBarLabel(bars: Se2GuitarPartBars): string {
  return `${bars} bar`;
}

/** Repeat a shorter loop preset to fill 4 / 8 / 12 bars on preview + insert. */
export function se2GuitarTileLoopNotesToPartBars(
  notes: readonly Se2GuitarLoopNote[],
  sourceBars: 4 | 8,
  targetBars: Se2GuitarPartBars,
  beatsPerBar: number,
): Se2GuitarLoopNote[] {
  const bpb = Math.max(1, beatsPerBar);
  const targetBeats = targetBars * bpb;

  if (targetBars <= sourceBars) {
    return notes
      .filter((n) => n.startBeat < targetBeats)
      .map((n) => ({ ...n }));
  }

  const sourceBeats = sourceBars * bpb;
  const tiled: Se2GuitarLoopNote[] = [];
  for (let offset = 0; offset < targetBeats; offset += sourceBeats) {
    for (const n of notes) {
      const startBeat = n.startBeat + offset;
      if (startBeat >= targetBeats) break;
      tiled.push({ ...n, startBeat });
    }
  }
  return tiled;
}
