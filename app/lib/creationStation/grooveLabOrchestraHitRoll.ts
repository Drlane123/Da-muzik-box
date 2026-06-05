/**
 * Groove Lab — Orchestra hit roll placement (locks to green chord attack columns).
 * Same grid alignment as guitar bar/stab drops — one hit at each chord downbeat / subroot.
 */
import type { ChordMode } from '@/app/lib/creationStation/chordBuilder';
import type { OrchestraHitId } from '@/app/lib/creationStation/grooveLabOrchestraHitBank';
import {
  GROOVE_LAB_BASS_REFERENCE_MIDI,
  GROOVE_LAB_CHORD_ROLL_MIDI_MAX,
  GROOVE_LAB_CHORD_ROLL_MIDI_MIN,
  grooveLabIsChordStackMidi,
} from '@/app/lib/creationStation/grooveLabPitch';
import {
  GROOVE_LAB_SLOTS_PER_BAR,
  grooveLabChordAttackColumns,
  grooveLabSlotsPerCell,
  grooveLabTotalSlots,
  normalizeGrooveBarCount,
  snapGrooveSlot,
  snapGrooveSustain,
  type GrooveLabBarCount,
  type GrooveLabQuantize,
  type GrooveRollHit,
} from '@/app/lib/creationStation/grooveLabRoll';

/** Lift sub/bass root into the green chord-stack register for ORCH roll rows. */
export function grooveLabOrchestraHitRollMidiFromRoot(rootMidi: number): number {
  const m = Math.round(rootMidi);
  if (grooveLabIsChordStackMidi(m)) return m;
  return Math.max(
    GROOVE_LAB_CHORD_ROLL_MIDI_MIN,
    Math.min(GROOVE_LAB_CHORD_ROLL_MIDI_MAX, m + 12),
  );
}

export type GrooveOrchestraHitRollBuild = {
  orchestraHits: GrooveRollHit[];
  hitId: OrchestraHitId;
  barCount: GrooveLabBarCount;
};

export function buildOrchestraHitRoll(
  hitId: OrchestraHitId,
  opts: {
    keyRoot: number;
    mode: ChordMode;
    quantize: GrooveLabQuantize;
    barCount: number;
    sustainSlots: number;
    chordHits: readonly GrooveRollHit[];
    referenceMidi?: number;
  },
): GrooveOrchestraHitRollBuild | { message: string } {
  const barCount: GrooveLabBarCount = normalizeGrooveBarCount(opts.barCount);
  const slotsPerBar = GROOVE_LAB_SLOTS_PER_BAR;
  const cellStep = grooveLabSlotsPerCell(opts.quantize);
  const refMidi = opts.referenceMidi ?? GROOVE_LAB_BASS_REFERENCE_MIDI;
  const columns = grooveLabChordAttackColumns(opts.chordHits, {
    keyRoot: opts.keyRoot,
    mode: opts.mode,
    referenceMidi: refMidi,
    quantize: opts.quantize,
  });
  if (columns.length === 0) {
    return { message: 'Drop green chords on the roll first — orchestra hits lock to chord roots.' };
  }

  const loopEnd = grooveLabTotalSlots(barCount);
  const hits: GrooveRollHit[] = [];

  for (let i = 0; i < columns.length; i += 1) {
    const col = columns[i]!;
    const next = columns[i + 1];
    const slot = snapGrooveSlot(col.slot, opts.quantize, barCount);
    const midi = grooveLabOrchestraHitRollMidiFromRoot(col.rootMidi);
    const span = next ? next.slot - slot : loopEnd - slot;
    const sustainSlots = snapGrooveSustain(
      slot,
      Math.max(cellStep, Math.min(slotsPerBar, span)),
      opts.quantize,
      barCount,
    );
    hits.push({ slot, midi, sustainSlots, vel: 0.9 });
  }

  if (hits.length === 0) {
    return { message: 'Could not place orchestra hits on the roll.' };
  }

  return { orchestraHits: hits, hitId, barCount };
}
