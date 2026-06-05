/** Groove Lead register — C5 through C6 (above green chord stacks). */

import type { GrooveLabRollNote } from '@/app/lib/creationStation/grooveLabPitch';
import { grooveLabClampMelodyMidi, grooveLabIsMelodyMidi } from '@/app/lib/creationStation/grooveLabPitch';
import {
  sanitizeGrooveLabHits,
  type GrooveRollHit,
} from '@/app/lib/creationStation/grooveLabRoll';

/** Lead lane sits above green chord stacks (48–69) — no shared C4–A4 rows. */
export const WAVE_LEAF_MIDI_MIN = 72;
export const WAVE_LEAF_MIDI_MAX = 84;
export const WAVE_LEAF_REFERENCE_MIDI = 79;

export const WAVE_LEAF_REGISTER_LABEL = 'C5–C6';

export function waveLeafIsLeadMidi(midi: number): boolean {
  const m = Math.round(midi);
  return m >= WAVE_LEAF_MIDI_MIN && m <= WAVE_LEAF_MIDI_MAX;
}

export function waveLeafClampMidi(midi: number): number {
  const m = Math.round(midi);
  return Math.max(WAVE_LEAF_MIDI_MIN, Math.min(WAVE_LEAF_MIDI_MAX, m));
}

export function waveLeafTransposeHitsOctave<T extends { midi: number }>(
  hits: readonly T[],
  dir: 1 | -1,
): T[] {
  const delta = dir * 12;
  return hits.map((h) => ({ ...h, midi: waveLeafClampMidi(h.midi + delta) }));
}

export function waveLeafSanitizeHits<T extends { midi: number }>(hits: readonly T[]): T[] {
  return hits
    .filter((h) => waveLeafIsLeadMidi(h.midi))
    .map((h) => {
      const midi = waveLeafClampMidi(h.midi);
      return midi === h.midi ? h : { ...h, midi };
    });
}

function waveLeafSanitizeChannelHit<T extends GrooveLabRollNote>(h: T): T | null {
  if (!waveLeafIsLeadMidi(h.midi)) return null;
  const midi = waveLeafClampMidi(h.midi);
  return midi === h.midi ? h : { ...h, midi };
}

/** Exact duplicates only (same slot + midi) — roll edits must not drop other columns. */
export function waveLeafDedupeExactHits<T extends GrooveLabRollNote>(hits: readonly T[]): T[] {
  const seen = new Map<string, T>();
  for (const h of hits) {
    const norm = waveLeafSanitizeChannelHit(h);
    if (!norm) continue;
    seen.set(`${norm.slot}:${norm.midi}`, norm);
  }
  return [...seen.values()].sort((a, b) => a.slot - b.slot || a.midi - b.midi);
}

/** One lead pitch per grid slot — transport + roll stay monophonic on CH35. */
export function waveLeafDedupeHitsBySlot<T extends GrooveLabRollNote>(hits: readonly T[]): T[] {
  const bySlot = new Map<number, T>();
  for (const h of hits) {
    const norm = waveLeafSanitizeChannelHit(h);
    if (!norm) continue;
    const prev = bySlot.get(norm.slot);
    if (!prev || norm.midi > prev.midi) bySlot.set(norm.slot, norm);
  }
  return [...bySlot.values()].sort((a, b) => a.slot - b.slot || a.midi - b.midi);
}

export function waveLeafTrimHitsMonophonic<T extends GrooveLabRollNote>(hits: readonly T[]): T[] {
  const deduped = waveLeafDedupeHitsBySlot(hits);
  const out = deduped.map((h) => ({ ...h }));
  for (let i = 0; i < out.length; i++) {
    const cur = out[i]!;
    const next = out[i + 1];
    if (next) {
      const gap = next.slot - cur.slot;
      if (gap > 1) cur.sustainSlots = Math.min(cur.sustainSlots, Math.max(1, gap - 1));
      else cur.sustainSlots = 1;
    }
  }
  return out;
}

/** Lift old lead notes that sat in the chord register (C3–A4) into C5–C6. */
function waveLeafLiftLegacyRegister<T extends { midi: number }>(hits: readonly T[]): T[] {
  return hits.map((h) => {
    let m = Math.round(h.midi);
    if (waveLeafIsLeadMidi(m)) return h;
    if (m >= 48 && m <= 71) m += 12;
    else if (m < WAVE_LEAF_MIDI_MIN) m += 12;
    return { ...h, midi: waveLeafClampMidi(m) };
  });
}

/** Cap length only when sustain would overlap the next note (manual roll edits). */
function waveLeafCapOverlappingSustain(hits: readonly GrooveRollHit[]): GrooveRollHit[] {
  const sorted = [...hits].sort((a, b) => a.slot - b.slot || a.midi - b.midi);
  const out = sorted.map((h) => ({ ...h }));
  for (let i = 0; i < out.length - 1; i += 1) {
    const cur = out[i]!;
    const next = out[i + 1]!;
    const maxSus = Math.max(1, next.slot - cur.slot);
    if (cur.sustainSlots > maxSus) cur.sustainSlots = maxSus;
  }
  return out;
}

/**
 * Piano-roll drag / resize — keep user sustain & pitch edits; still one note per slot.
 * Full view (expanded) allows melody register; docked lane stays C5–C6.
 */
export function waveLeafSanitizeRollEdits(
  hits: readonly GrooveRollHit[],
  barCount: number,
  opts?: { expanded?: boolean },
): GrooveRollHit[] {
  const expanded = opts?.expanded === true;
  const lifted = waveLeafLiftLegacyRegister(hits);
  const lane = lifted
    .map((h) => {
      const midi = expanded ? grooveLabClampMelodyMidi(h.midi) : waveLeafClampMidi(h.midi);
      return { ...h, midi };
    })
    .filter((h) => (expanded ? grooveLabIsMelodyMidi(h.midi) : waveLeafIsLeadMidi(h.midi)));
  const deduped = waveLeafDedupeExactHits(lane);
  const capped = waveLeafCapOverlappingSustain(deduped);
  return sanitizeGrooveLabHits(capped, barCount);
}

/** Persist roll edits — clamp pitch only; never drop notes the user moved on the roll. */
export function waveLeafStoreRollEdits(
  hits: readonly GrooveRollHit[],
  barCount: number,
  opts?: { expanded?: boolean },
): GrooveRollHit[] {
  const expanded = opts?.expanded === true;
  const lane = hits.map((h) => {
    const midi = expanded ? grooveLabClampMelodyMidi(h.midi) : waveLeafClampMidi(h.midi);
    return { ...h, midi };
  });
  const deduped = waveLeafDedupeExactHits(lane);
  const capped = waveLeafCapOverlappingSustain(deduped);
  return sanitizeGrooveLabHits(capped, barCount);
}

/** CH35 roll + transport — clamp register, mono slot, snap grid rows. */
export function waveLeafPrepareRollHits(hits: readonly GrooveRollHit[], barCount: number): GrooveRollHit[] {
  const lifted = waveLeafLiftLegacyRegister(hits);
  const lane = waveLeafTrimHitsMonophonic(
    lifted
      .filter((h) => waveLeafIsLeadMidi(h.midi))
      .map((h) => ({ ...h, midi: waveLeafClampMidi(h.midi) })),
  );
  return sanitizeGrooveLabHits(lane, barCount);
}
