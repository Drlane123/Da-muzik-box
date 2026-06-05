/**
 * Groove Lead — tight lock to green-stack pitch classes (Melody Sauce Chord Lock).
 * Every chord column gets a complementary anchor; no bleed from the previous chord.
 */
import type { GrooveComposerColumn, GrooveComposerHarmony } from '@/app/lib/creationStation/grooveLabComposerTypes';
import { GROOVE_LAB_CHORD_HARMONY_MIDI_MIN } from '@/app/lib/creationStation/grooveLabPitch';
import type { GrooveRollHit } from '@/app/lib/creationStation/grooveLabRoll';
import {
  WAVE_LEAF_MIDI_MAX,
  WAVE_LEAF_MIDI_MIN,
  WAVE_LEAF_REFERENCE_MIDI,
  waveLeafClampMidi,
} from '@/app/lib/creationStation/waveLeafPitch';

export function waveLeafPitchClass(midi: number): number {
  return ((Math.round(midi) % 12) + 12) % 12;
}

export function waveLeafHarmonyColumnAtSlot(
  harmony: GrooveComposerHarmony,
  slot: number,
): GrooveComposerColumn {
  const s = Math.max(0, Math.floor(slot));
  let col = harmony.columns[0]!;
  for (const c of harmony.columns) {
    if (c.slot <= s) col = c;
    else break;
  }
  return col;
}

export function waveLeafActiveChordSlot(chordHits: readonly GrooveRollHit[], slot: number): number {
  const s = Math.max(0, Math.floor(slot));
  let active = -1;
  for (const h of chordHits) {
    if (h.midi < GROOVE_LAB_CHORD_HARMONY_MIDI_MIN) continue;
    if (h.slot <= s && h.slot >= active) active = h.slot;
  }
  return active;
}

/** Sorted unique green chord column slots. */
export function waveLeafChordColumnSlots(chordHits: readonly GrooveRollHit[]): number[] {
  const slots = new Set<number>();
  for (const h of chordHits) {
    if (h.midi >= GROOVE_LAB_CHORD_HARMONY_MIDI_MIN) slots.add(h.slot);
  }
  return [...slots].sort((a, b) => a - b);
}

export function waveLeafGreenStackMidisAtSlot(
  chordHits: readonly GrooveRollHit[],
  slot: number,
  col: GrooveComposerColumn,
): number[] {
  const activeSlot = waveLeafActiveChordSlot(chordHits, slot);
  const fromHits =
    activeSlot >= 0
      ? chordHits
          .filter((h) => h.slot === activeSlot && h.midi >= GROOVE_LAB_CHORD_HARMONY_MIDI_MIN)
          .map((h) => Math.round(h.midi))
      : [];
  if (fromHits.length > 0) {
    return [...new Set(fromHits)].sort((a, b) => a - b);
  }
  const fromCol = col.tones.map((m) => Math.round(m)).filter((m) => m >= GROOVE_LAB_CHORD_HARMONY_MIDI_MIN);
  return [...new Set(fromCol)].sort((a, b) => a - b);
}

export function waveLeafStackPitchClasses(stackMidis: readonly number[]): Set<number> {
  const pcs = new Set<number>();
  for (const m of stackMidis) pcs.add(waveLeafPitchClass(m));
  return pcs;
}

/** Harmony root PC (not lowest voicing note — fixes inverted stacks & chord 3+). */
export function waveLeafChordRootPc(col: GrooveComposerColumn, stackMidis: readonly number[]): number {
  if (col.rootMidi >= GROOVE_LAB_CHORD_HARMONY_MIDI_MIN) {
    return waveLeafPitchClass(col.rootMidi);
  }
  if (stackMidis.length > 0) return waveLeafPitchClass(Math.min(...stackMidis));
  return 0;
}

export function waveLeafLeadMidisFromStackVoicing(stackMidis: readonly number[]): number[] {
  if (stackMidis.length === 0) return [waveLeafClampMidi(WAVE_LEAF_REFERENCE_MIDI)];
  const out: number[] = [];
  for (const raw of stackMidis) {
    let lead = Math.round(raw);
    while (lead < WAVE_LEAF_MIDI_MIN) lead += 12;
    while (lead > WAVE_LEAF_MIDI_MAX) lead -= 12;
    out.push(waveLeafClampMidi(lead));
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

export function waveLeafPickFromVoicing(
  allowed: readonly number[],
  prevMidi: number | null,
  prefer?: { higher?: boolean; lower?: boolean; anchor?: number; forbidPcs?: Set<number> },
): number {
  let pool = [...allowed];
  if (prefer?.forbidPcs && prefer.forbidPcs.size > 0) {
    const filtered = pool.filter((m) => !prefer.forbidPcs!.has(waveLeafPitchClass(m)));
    if (filtered.length > 0) pool = filtered;
  }
  if (pool.length === 0) return waveLeafClampMidi(WAVE_LEAF_REFERENCE_MIDI);
  if (prefer?.anchor != null && pool.includes(prefer.anchor)) {
    return prefer.anchor;
  }
  if (prevMidi == null) {
    return pool[Math.min(1, pool.length - 1)] ?? pool[0]!;
  }
  let best = pool[0]!;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const m of pool) {
    const leap = Math.abs(m - prevMidi);
    let score = leap * 2.5;
    if (leap <= 2) score -= 8;
    if (leap > 5) score += 25;
    if (prefer?.higher && m >= prevMidi) score -= 2;
    if (prefer?.lower && m <= prevMidi) score -= 2;
    if (score < bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}

function intervalFromRootPc(notePc: number, rootPc: number): number {
  return (notePc - rootPc + 12) % 12;
}

export type WaveLeafStackRole = 'root' | 'third' | 'fifth' | 'extension' | 'any';

export function waveLeafCandidatesForRole(
  stackMidis: readonly number[],
  role: WaveLeafStackRole,
  prevMidi: number | null,
  rootPc: number,
): number[] {
  const lead = waveLeafLeadMidisFromStackVoicing(stackMidis);
  if (role === 'any' || stackMidis.length === 0) return lead;

  const byRole: Record<WaveLeafStackRole, number[]> = {
    root: [],
    third: [],
    fifth: [],
    extension: [],
    any: lead,
  };

  for (const m of lead) {
    const iv = intervalFromRootPc(waveLeafPitchClass(m), rootPc);
    if (iv === 0) byRole.root.push(m);
    else if (iv === 3 || iv === 4) byRole.third.push(m);
    else if (iv === 7) byRole.fifth.push(m);
    else byRole.extension.push(m);
  }

  const pool = byRole[role];
  if (pool.length > 0) return pool;
  return lead;
}

/** Rotating complementary tone per chord column — 3rd chord always gets a strong stack tone. */
export function waveLeafComplementMidiForColumn(
  stackMidis: readonly number[],
  col: GrooveComposerColumn,
  columnIndex: number,
  prevMidi: number | null,
): number {
  const rootPc = waveLeafChordRootPc(col, stackMidis);
  const roles: WaveLeafStackRole[] = ['third', 'fifth', 'third', 'fifth', 'extension'];
  const role = roles[columnIndex % roles.length]!;
  const pool = waveLeafCandidatesForRole(stackMidis, role, prevMidi, rootPc);
  const anchor =
    pool.find((m) => {
      const iv = intervalFromRootPc(waveLeafPitchClass(m), rootPc);
      return role === 'third' ? iv === 3 || iv === 4 : role === 'fifth' ? iv === 7 : iv !== 0;
    }) ?? pool[0];
  return waveLeafPickFromVoicing(pool, prevMidi, { anchor });
}

export function waveLeafSnapMidiToStack(
  midi: number,
  stackMidis: readonly number[],
  prevMidi: number | null,
  opts?: { anchorMidi?: number; forbidPcs?: Set<number> },
): number {
  const allowed = waveLeafLeadMidisFromStackVoicing(stackMidis);
  const pc = waveLeafPitchClass(midi);
  const stackPcs = waveLeafStackPitchClasses(stackMidis);
  if (stackPcs.has(pc)) {
    const samePc = allowed.filter((m) => waveLeafPitchClass(m) === pc);
    if (samePc.length > 0) {
      return waveLeafPickFromVoicing(samePc, prevMidi, {
        anchor: opts?.anchorMidi,
        forbidPcs: opts?.forbidPcs,
      });
    }
  }
  return waveLeafPickFromVoicing(allowed, prevMidi, {
    anchor: opts?.anchorMidi,
    forbidPcs: opts?.forbidPcs,
  });
}

function snapHitToStack(
  h: GrooveRollHit,
  chordHits: readonly GrooveRollHit[],
  harmony: GrooveComposerHarmony,
  prev: number | null,
  lastChordSlot: number,
  prevStackPcs: Set<number>,
): { midi: number; lastChordSlot: number; prevStackPcs: Set<number> } {
  const col = waveLeafHarmonyColumnAtSlot(harmony, h.slot);
  const stack = waveLeafGreenStackMidisAtSlot(chordHits, h.slot, col);
  const activeSlot = waveLeafActiveChordSlot(chordHits, h.slot);
  const chordChanged = activeSlot >= 0 && activeSlot !== lastChordSlot;
  const forbidPcs = chordChanged ? new Set(prevStackPcs) : undefined;
  const colIdx = waveLeafChordColumnSlots(chordHits).indexOf(activeSlot);
  const anchor =
    chordChanged && colIdx >= 0
      ? waveLeafComplementMidiForColumn(stack, col, colIdx, null)
      : undefined;

  const midi = waveLeafSnapMidiToStack(h.midi, stack, prev, {
    anchorMidi: anchor,
    forbidPcs,
  });

  if (chordChanged) {
    return { midi, lastChordSlot: activeSlot, prevStackPcs: waveLeafStackPitchClasses(stack) };
  }
  return { midi, lastChordSlot, prevStackPcs };
}

/** Force every lead hit onto a green-stack voicing at its chord column. */
export function lockWaveLeafLaneToGreenStack(
  hits: readonly GrooveRollHit[],
  chordHits: readonly GrooveRollHit[],
  harmony: GrooveComposerHarmony,
): GrooveRollHit[] {
  const sorted = [...hits].sort((a, b) => a.slot - b.slot || a.midi - b.midi);
  let prev: number | null = null;
  let lastChordSlot = -1;
  let prevStackPcs = new Set<number>();
  const out: GrooveRollHit[] = [];

  for (const h of sorted) {
    const snap = snapHitToStack(h, chordHits, harmony, prev, lastChordSlot, prevStackPcs);
    prev = snap.midi;
    lastChordSlot = snap.lastChordSlot;
    prevStackPcs = snap.prevStackPcs;
    out.push({ ...h, midi: snap.midi });
  }

  return out;
}

/**
 * Each green chord column gets an early lead note on a complementary stack tone
 * (fixes “falls off” on chord 3+ when phrase rhythm skips a change).
 */
export function waveLeafComplimentEveryChordColumn(
  hits: readonly GrooveRollHit[],
  chordHits: readonly GrooveRollHit[],
  harmony: GrooveComposerHarmony,
): GrooveRollHit[] {
  const chordSlots = waveLeafChordColumnSlots(chordHits);
  if (chordSlots.length === 0) return [...hits];

  const sorted = [...hits].sort((a, b) => a.slot - b.slot || a.midi - b.midi);
  const out = sorted.map((h) => ({ ...h }));
  let prevMidi: number | null = null;
  let prevStackPcs = new Set<number>();

  for (let ci = 0; ci < chordSlots.length; ci += 1) {
    const chordSlot = chordSlots[ci]!;
    const nextSlot = chordSlots[ci + 1] ?? Number.MAX_SAFE_INTEGER;
    const col = waveLeafHarmonyColumnAtSlot(harmony, chordSlot);
    const stack = waveLeafGreenStackMidisAtSlot(chordHits, chordSlot, col);
    const stackPcs = waveLeafStackPitchClasses(stack);
    const complement = waveLeafComplementMidiForColumn(stack, col, ci, prevMidi);

    const inWindow = out
      .map((h, idx) => ({ h, idx }))
      .filter(({ h }) => h.slot >= chordSlot && h.slot < nextSlot);
    const earliest = inWindow.sort((a, b) => a.h.slot - b.h.slot)[0];

    if (earliest) {
      const pc = waveLeafPitchClass(earliest.h.midi);
      const needsFix = !stackPcs.has(pc) || (ci > 0 && prevStackPcs.has(pc));
      if (needsFix) {
        out[earliest.idx] = { ...earliest.h, midi: complement };
      }
      prevMidi = out[earliest.idx]!.midi;
    } else {
      out.push({
        slot: chordSlot,
        midi: complement,
        sustainSlots: 12,
        vel: 0.78,
      });
      prevMidi = complement;
    }
    prevStackPcs = stackPcs;
  }

  return out.sort((a, b) => a.slot - b.slot || a.midi - b.midi);
}
