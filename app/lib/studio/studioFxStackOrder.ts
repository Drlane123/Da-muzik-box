/**
 * Per-lane F|X stack order — DA FX Suite · Pitch Tune DSP · Vocoder DSP.
 * Top of the picker = first in the signal chain.
 */

export type StudioFxStackSlot = 'suite' | 'pitchTune' | 'vocoder';

/** Matches legacy audio: Pitch Tune → Vocoder → DA FX Suite. */
export const DEFAULT_STUDIO_FX_STACK_ORDER: readonly [
  StudioFxStackSlot,
  StudioFxStackSlot,
  StudioFxStackSlot,
] = ['pitchTune', 'vocoder', 'suite'];

const VALID = new Set<string>(DEFAULT_STUDIO_FX_STACK_ORDER);

export function normalizeFxStackOrder(
  raw?: readonly string[] | null,
): [StudioFxStackSlot, StudioFxStackSlot, StudioFxStackSlot] {
  const seen = new Set<string>();
  const out: StudioFxStackSlot[] = [];
  for (const id of raw ?? DEFAULT_STUDIO_FX_STACK_ORDER) {
    if (!VALID.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id as StudioFxStackSlot);
  }
  for (const id of DEFAULT_STUDIO_FX_STACK_ORDER) {
    if (!seen.has(id)) out.push(id);
  }
  return [out[0]!, out[1]!, out[2]!];
}

export function fxStackOrderEqual(
  a: readonly StudioFxStackSlot[] | undefined,
  b: readonly StudioFxStackSlot[] | undefined,
): boolean {
  const na = normalizeFxStackOrder(a);
  const nb = normalizeFxStackOrder(b);
  return na[0] === nb[0] && na[1] === nb[1] && na[2] === nb[2];
}

export function reorderFxStack(
  order: readonly StudioFxStackSlot[],
  fromIndex: number,
  toIndex: number,
): [StudioFxStackSlot, StudioFxStackSlot, StudioFxStackSlot] {
  const next = [...normalizeFxStackOrder(order)];
  if (fromIndex < 0 || fromIndex > 2 || toIndex < 0 || toIndex > 2 || fromIndex === toIndex) {
    return normalizeFxStackOrder(next);
  }
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved!);
  return normalizeFxStackOrder(next);
}
