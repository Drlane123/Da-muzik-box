/**
 * Round-robin sequencer — avoids machine-gun repetition (min 4 variations per note).
 */
import type { GuitarSampleZone } from '@/app/lib/studio/guitarEngine/types';

export type RoundRobinKey = string;

export function guitarRoundRobinKey(midi: number, articulation: string): RoundRobinKey {
  return `${articulation}:${midi}`;
}

export class GuitarRoundRobinSequencer {
  private readonly counters = new Map<RoundRobinKey, number>();

  /** Advance and return next RR index for this note lane. */
  nextIndex(key: RoundRobinKey, modulo: number): number {
    const prev = this.counters.get(key) ?? -1;
    const next = (prev + 1) % Math.max(1, modulo);
    this.counters.set(key, next);
    return next;
  }

  reset(): void {
    this.counters.clear();
  }
}

/** Pick the zone whose roundRobinIndex matches the sequencer slot. */
export function guitarSelectRoundRobinZone(
  candidates: readonly GuitarSampleZone[],
  rrIndex: number,
): GuitarSampleZone | null {
  if (!candidates.length) return null;
  const match = candidates.find((z) => z.roundRobinIndex === rrIndex);
  if (match) return match;
  return candidates[rrIndex % candidates.length] ?? candidates[0]!;
}
