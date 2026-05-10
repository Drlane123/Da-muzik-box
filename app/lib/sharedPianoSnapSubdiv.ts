/**
 * Shared piano / step **grid snap** between Creation Station and Studio Editor 2.
 *
 * - **Beat** = one quarter note. `subdivisionsPerBeat` = how many equal cells fit in one beat.
 * - At **960 PPQ** (see `MasterClockContext.PPQ`), one 1/16 cell = `960 / 4` = **240 ticks**.
 * - **T** = triplet feel: `3` → three cells per beat (1/8 triplet); `6` → six per beat (1/16 triplet).
 */

export const PIANO_SNAP_SUBDIV_STORAGE_KEY = 'dmb_shared_piano_snap_subdiv';

/** Allowed snap values (cells per quarter). */
export const PIANO_SNAP_SUBDIV_CHOICES = [1, 2, 3, 4, 6, 8, 16, 32] as const;
export type PianoSnapSubdiv = (typeof PIANO_SNAP_SUBDIV_CHOICES)[number];

const ALLOWED = new Set<number>(PIANO_SNAP_SUBDIV_CHOICES);

/** Industry-style default: **1/16** → 16 cells per 4/4 bar when `beatsPerBar === 4`. */
export const PIANO_SNAP_SUBDIV_DEFAULT = 4;

export function isPianoSnapSubdiv(n: number): n is PianoSnapSubdiv {
  return ALLOWED.has(Math.round(n));
}

/** `number` (not a literal union) so React `useState` / callbacks accept parsed UI values. */
export function normalizePianoSnapSubdiv(n: number): number {
  const r = Math.round(n);
  return ALLOWED.has(r) ? r : PIANO_SNAP_SUBDIV_DEFAULT;
}

export function readPianoSnapSubdivFromStorage(): number {
  try {
    const raw = localStorage.getItem(PIANO_SNAP_SUBDIV_STORAGE_KEY);
    if (raw == null || raw === '') return PIANO_SNAP_SUBDIV_DEFAULT;
    const parsed = parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return PIANO_SNAP_SUBDIV_DEFAULT;
    return normalizePianoSnapSubdiv(parsed);
  } catch {
    return PIANO_SNAP_SUBDIV_DEFAULT;
  }
}

export function snapLabelFromPianoSnapSubdiv(s: number): string {
  switch (Math.round(s)) {
    case 1:
      return '1/4';
    case 2:
      return '1/8';
    case 3:
      return '1/8T';
    case 4:
      return '1/16';
    case 6:
      return '1/16T';
    case 8:
      return '1/32';
    case 16:
      return '1/64';
    case 32:
      return '1/128';
    default:
      return '1/16';
  }
}

/** Ticks per visible grid column at this snap (straight math on PPQ). */
export function ticksPerPianoSnapCell(ppq: number, subdivisionsPerBeat: number): number {
  const s = Math.max(1, Math.round(subdivisionsPerBeat));
  return ppq / s;
}
