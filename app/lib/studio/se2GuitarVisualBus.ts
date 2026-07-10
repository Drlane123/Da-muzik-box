/**
 * Lightweight pub/sub so guitar fretboard + piano keyboard can light up when
 * notes play from transport, piano-roll preview, or panel audition — without
 * threading callbacks through Studio Editor 2.
 */
import type { Se2GuitarFretDot } from '@/app/lib/studio/se2GuitarFretboard';

export type Se2GuitarVisualNoteEvent = {
  pitch: number;
  durationMs?: number;
  /** Preserve clicked string when the player chose a specific fret placement. */
  placement?: Se2GuitarFretDot;
};

type Listener = (ev: Se2GuitarVisualNoteEvent) => void;

const listeners = new Set<Listener>();

export function subscribeSe2GuitarVisualNotes(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitSe2GuitarVisualNote(ev: Se2GuitarVisualNoteEvent): void {
  for (const fn of listeners) {
    try {
      fn(ev);
    } catch {
      /* panel unmounted */
    }
  }
}
