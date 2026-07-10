/**
 * Multi-step undo stacks for full-lane Regenerate and chord loop edits in Geno Loop Editor.
 */
import type { GenoBarChordSpec } from '@/app/lib/studio/se2SynthGenoChordEngine';
import type { StudioEditor2GenNote } from '@/app/lib/studio/studioEditor2PartGenerator';

export const GENO_LANE_REGEN_UNDO_MAX = 32;

/** Chord lane snapshot — bar cards, regen, and piano-roll commits (B01 + B02). */
export type GenoChordLoopUndoSnapshot = {
  chordNotes: StudioEditor2GenNote[];
  /** Geno Build 2 — per-bar specs on plugin state. */
  barChordSpecs?: GenoBarChordSpec[];
  /** Geno Build 1 — slot specs + independent loop-bar patches. */
  editSpecs?: GenoBarChordSpec[];
  liveBarSpecPatches?: Record<number, GenoBarChordSpec>;
};

export type GenoChordLoopUndoStack = GenoChordLoopUndoSnapshot[];

function cloneBarChordSpec(spec: GenoBarChordSpec): GenoBarChordSpec {
  return {
    ...spec,
    chordIntervals: spec.chordIntervals ? [...spec.chordIntervals] : undefined,
    passingTail: spec.passingTail
      ? {
          ...spec.passingTail,
          spec: cloneBarChordSpec(spec.passingTail.spec),
        }
      : undefined,
  };
}

export function genoCloneBarChordSpecs(
  specs: readonly GenoBarChordSpec[] | undefined,
): GenoBarChordSpec[] | undefined {
  if (!specs) return undefined;
  return specs.map(cloneBarChordSpec);
}

export function genoCloneBarSpecPatches(
  patches: Record<number, GenoBarChordSpec> | undefined,
): Record<number, GenoBarChordSpec> | undefined {
  if (!patches) return undefined;
  const next: Record<number, GenoBarChordSpec> = {};
  for (const [bar, spec] of Object.entries(patches)) {
    next[Number(bar)] = cloneBarChordSpec(spec);
  }
  return next;
}

export function genoPushChordLoopUndoStack(
  stack: readonly GenoChordLoopUndoSnapshot[] | undefined,
  snapshot: GenoChordLoopUndoSnapshot,
): GenoChordLoopUndoStack {
  const entry: GenoChordLoopUndoSnapshot = {
    chordNotes: genoCloneGenNotes(snapshot.chordNotes),
    barChordSpecs: genoCloneBarChordSpecs(snapshot.barChordSpecs),
    editSpecs: genoCloneBarChordSpecs(snapshot.editSpecs),
    liveBarSpecPatches: genoCloneBarSpecPatches(snapshot.liveBarSpecPatches),
  };
  const next = [...(stack ?? []), entry];
  while (next.length > GENO_LANE_REGEN_UNDO_MAX) next.shift();
  return next;
}

export function genoPopChordLoopUndoStack(stack: readonly GenoChordLoopUndoSnapshot[] | undefined): {
  snapshot: GenoChordLoopUndoSnapshot | undefined;
  stack: GenoChordLoopUndoStack | undefined;
} {
  if (!stack?.length) return { snapshot: undefined, stack: undefined };
  const raw = stack[stack.length - 1]!;
  const snapshot: GenoChordLoopUndoSnapshot = {
    chordNotes: genoCloneGenNotes(raw.chordNotes),
    barChordSpecs: genoCloneBarChordSpecs(raw.barChordSpecs),
    editSpecs: genoCloneBarChordSpecs(raw.editSpecs),
    liveBarSpecPatches: genoCloneBarSpecPatches(raw.liveBarSpecPatches),
  };
  const rest = stack.slice(0, -1);
  return { snapshot, stack: rest.length > 0 ? rest : undefined };
}

export function genoChordLoopStackCanUndo(
  stack: readonly GenoChordLoopUndoSnapshot[] | undefined,
): boolean {
  return Boolean(stack?.length);
}

export type GenoLaneRegenNoteStack = StudioEditor2GenNote[][];

export function genoCloneGenNotes(notes: readonly StudioEditor2GenNote[]): StudioEditor2GenNote[] {
  return notes.map((n) => ({ ...n }));
}

export function genoPushLaneRegenStack(
  stack: readonly StudioEditor2GenNote[][] | undefined,
  notes: readonly StudioEditor2GenNote[],
): StudioEditor2GenNote[][] {
  const next = [...(stack ?? []), genoCloneGenNotes(notes)];
  while (next.length > GENO_LANE_REGEN_UNDO_MAX) next.shift();
  return next;
}

export function genoPopLaneRegenStack(stack: readonly StudioEditor2GenNote[][] | undefined): {
  notes: StudioEditor2GenNote[] | undefined;
  stack: GenoLaneRegenNoteStack | undefined;
} {
  if (!stack?.length) return { notes: undefined, stack: undefined };
  const notes = genoCloneGenNotes(stack[stack.length - 1]!);
  const rest = stack.slice(0, -1);
  return { notes, stack: rest.length > 0 ? rest : undefined };
}

export function genoLaneRegenStackCanUndo(
  stack: readonly StudioEditor2GenNote[][] | undefined,
): boolean {
  return Boolean(stack?.length);
}
