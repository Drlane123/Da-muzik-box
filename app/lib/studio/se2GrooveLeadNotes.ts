/**
 * SE2 piano-roll notes ↔ Groove Lab roll hits (Groove Lead lane).
 */
import {
  GROOVE_LAB_SLOTS_PER_BAR,
  type GrooveRollHit,
} from '@/app/lib/creationStation/grooveLabRoll';

export type Se2MockMidiNote = {
  pitch: number;
  startBeat: number;
  durationBeats: number;
  velocity: number;
};

const SLOTS_PER_BEAT = GROOVE_LAB_SLOTS_PER_BAR / 4;

/** Groove Lab lead register — C4–C6 (SE2 piano roll; wider than Groove Lab melody lane). */
export const SE2_GROOVE_LEAD_PITCH_DEFAULT_LO = 60;
export const SE2_GROOVE_LEAD_PITCH_DEFAULT_HI = 84;

export function se2GrooveLeadEmptyPitchRange(): { min: number; max: number } {
  return { min: SE2_GROOVE_LEAD_PITCH_DEFAULT_LO, max: SE2_GROOVE_LEAD_PITCH_DEFAULT_HI };
}

/** Piano-roll span from notes — Groove Lead register with padding. */
export function se2GrooveLeadPitchRangeForNotes(
  notes: readonly { pitch: number }[],
): { min: number; max: number } {
  const base = se2GrooveLeadEmptyPitchRange();
  if (notes.length === 0) return base;
  const lo = Math.min(...notes.map((n) => Math.round(n.pitch)));
  const hi = Math.max(...notes.map((n) => Math.round(n.pitch)));
  return {
    min: Math.max(48, Math.min(base.min, lo - 2)),
    max: Math.min(96, Math.max(base.max, hi + 2)),
  };
}

export function se2GrooveLeadPitchSpanNotes(): Se2MockMidiNote[] {
  const { min, max } = se2GrooveLeadEmptyPitchRange();
  return [
    { pitch: min, startBeat: 0, durationBeats: 1, velocity: 100 },
    { pitch: max, startBeat: 0, durationBeats: 1, velocity: 100 },
  ];
}

export function se2MockNotesToGrooveRollHits(notes: readonly Se2MockMidiNote[]): GrooveRollHit[] {
  const out: GrooveRollHit[] = [];
  for (const n of notes) {
    const midi = Math.round(n.pitch);
    if (!Number.isFinite(midi)) continue;
    out.push({
      slot: Math.max(0, Math.round(n.startBeat * SLOTS_PER_BEAT)),
      sustainSlots: Math.max(1, Math.round(n.durationBeats * SLOTS_PER_BEAT)),
      midi,
      vel: Math.max(0.05, Math.min(1, n.velocity / 127)),
    });
  }
  return out;
}

export function se2GrooveRollHitsToMockNotes(hits: readonly GrooveRollHit[]): Se2MockMidiNote[] {
  const out: Se2MockMidiNote[] = [];
  for (const h of hits) {
    const midi = Math.round(h.midi);
    if (!Number.isFinite(midi)) continue;
    out.push({
      pitch: midi,
      startBeat: h.slot / SLOTS_PER_BEAT,
      durationBeats: Math.max(0.25, h.sustainSlots / SLOTS_PER_BEAT),
      velocity: Math.max(1, Math.min(127, Math.round((h.vel ?? 0.88) * 127))),
    });
  }
  return out.sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
}
