/**
 * Hum Capture inline melody roll — 4/8 bar max, 16th-note resolution grid.
 */
import {
  grooveLabQuantizeDivisionsPerBar,
  GROOVE_LAB_QUANTIZE_DEFAULT,
  GROOVE_LAB_QUANTIZE_OPTIONS,
  type GrooveLabQuantize,
} from '@/app/lib/creationStation/grooveLabRoll';
import type { TimedMonophonicNote } from '@/app/lib/studio/audioToMidiNotes';

export type NeuralHumRollBarCount = 4 | 8;

export type NeuralHumRollQuantize = GrooveLabQuantize;

export const NEURAL_HUM_QUANTIZE_OPTIONS = GROOVE_LAB_QUANTIZE_OPTIONS;

export const NEURAL_HUM_QUANTIZE_DEFAULT = GROOVE_LAB_QUANTIZE_DEFAULT;

export const NEURAL_HUM_ROLL_SLOTS_PER_BAR = 16;

export const NEURAL_HUM_ROLL_BAR_OPTIONS: readonly NeuralHumRollBarCount[] = [4, 8] as const;

export type NeuralHumRollNote = {
  id: string;
  pitch: number;
  startSlot: number;
  lenSlots: number;
  velocity: number;
};

const DRAFT_KEY = 'da-neural-hum-melody-roll-draft';

let rollNoteIdSeq = 0;

export function newNeuralHumRollNoteId(): string {
  rollNoteIdSeq += 1;
  return `nh-roll-${rollNoteIdSeq}-${Date.now()}`;
}

export function secPerBar(bpm: number): number {
  const b = Math.max(30, Math.min(300, bpm));
  return (60 / b) * 4;
}

export function totalRollSlots(bars: NeuralHumRollBarCount): number {
  return bars * NEURAL_HUM_ROLL_SLOTS_PER_BAR;
}

/** Slots per quantize step on the 16-slot/bar hum grid (1/16 = 1 slot). */
export function neuralHumQuantizeStepSlots(quantize: NeuralHumRollQuantize): number {
  const div = grooveLabQuantizeDivisionsPerBar(quantize);
  return Math.max(1, Math.floor(NEURAL_HUM_ROLL_SLOTS_PER_BAR / div));
}

export function snapNeuralHumRollSlot(
  slot: number,
  quantize: NeuralHumRollQuantize,
  maxSlot: number,
): number {
  const step = neuralHumQuantizeStepSlots(quantize);
  const snapped = Math.round(Math.max(0, slot) / step) * step;
  return Math.max(0, Math.min(maxSlot - 1, snapped));
}

export function snapNeuralHumRollLen(
  lenSlots: number,
  quantize: NeuralHumRollQuantize,
  maxLen: number,
): number {
  const step = neuralHumQuantizeStepSlots(quantize);
  const snapped = Math.max(step, Math.round(Math.max(step, lenSlots) / step) * step);
  return Math.max(step, Math.min(maxLen, snapped));
}

/** Snap note starts/lengths in seconds to project BPM + quantize grid. */
export function quantizeTimedMonophonicNotes(
  notes: readonly TimedMonophonicNote[],
  bpm: number,
  quantize: NeuralHumRollQuantize = NEURAL_HUM_QUANTIZE_DEFAULT,
): TimedMonophonicNote[] {
  const spb = secPerBar(bpm);
  const divisions = grooveLabQuantizeDivisionsPerBar(quantize);
  const stepSec = spb / divisions;

  const sorted = [...notes].sort((a, b) => a.startSec - b.startSec || a.pitch - b.pitch);
  const out: TimedMonophonicNote[] = [];

  for (const n of sorted) {
    const startSec = Math.round(n.startSec / stepSec) * stepSec;
    const endSec = Math.round((n.startSec + n.durationSec) / stepSec) * stepSec;
    const durationSec = Math.max(stepSec * 0.5, endSec - startSec);
    if (durationSec < stepSec * 0.25) continue;

    const prev = out[out.length - 1];
    if (prev && Math.abs(prev.startSec - startSec) < stepSec * 0.01 && prev.pitch === Math.round(n.pitch)) {
      prev.durationSec = Math.max(prev.durationSec, startSec + durationSec - prev.startSec);
      prev.velocity = Math.max(prev.velocity, n.velocity);
      continue;
    }

    out.push({
      pitch: n.pitch,
      startSec: Math.max(0, startSec),
      durationSec,
      velocity: n.velocity,
    });
  }

  return out;
}

/** Re-snap existing roll notes to quantize grid (same BPM grid). */
export function quantizeNeuralHumRollNotes(
  notes: readonly NeuralHumRollNote[],
  quantize: NeuralHumRollQuantize,
  bars: NeuralHumRollBarCount,
): NeuralHumRollNote[] {
  const maxSlot = totalRollSlots(bars);
  const mapped = notes.map((n) => {
    const startSlot = snapNeuralHumRollSlot(n.startSlot, quantize, maxSlot);
    const rawEnd = n.startSlot + n.lenSlots;
    const endSlot = snapNeuralHumRollSlot(rawEnd, quantize, maxSlot + 1);
    const lenSlots = snapNeuralHumRollLen(Math.max(1, endSlot - startSlot), quantize, maxSlot - startSlot);
    return { ...n, startSlot, lenSlots };
  });
  return enforceMonophonicRollNotes(
    mapped.filter((n) => n.startSlot < maxSlot).map((n) => ({
      ...n,
      lenSlots: Math.min(n.lenSlots, maxSlot - n.startSlot),
    })),
  );
}

export function timedNotesToRollNotes(
  notes: readonly TimedMonophonicNote[],
  bpm: number,
  bars: NeuralHumRollBarCount,
  quantize: NeuralHumRollQuantize = NEURAL_HUM_QUANTIZE_DEFAULT,
): NeuralHumRollNote[] {
  const spb = secPerBar(bpm);
  const maxSlot = totalRollSlots(bars);
  const quantized = quantizeTimedMonophonicNotes(notes, bpm, quantize);
  const mapped = quantized
    .map((n) => {
      const rawStart = (n.startSec / spb) * NEURAL_HUM_ROLL_SLOTS_PER_BAR;
      const rawEnd = ((n.startSec + n.durationSec) / spb) * NEURAL_HUM_ROLL_SLOTS_PER_BAR;
      const startSlot = snapNeuralHumRollSlot(rawStart, quantize, maxSlot);
      const endSlot = Math.max(startSlot + 1, snapNeuralHumRollSlot(rawEnd, quantize, maxSlot + 1));
      const lenSlots = snapNeuralHumRollLen(endSlot - startSlot, quantize, maxSlot - startSlot);
      return {
        id: newNeuralHumRollNoteId(),
        pitch: Math.max(0, Math.min(127, Math.round(n.pitch))),
        startSlot,
        lenSlots,
        velocity: Math.max(1, Math.min(127, Math.round(n.velocity))),
      };
    })
    .filter((n) => n.startSlot < maxSlot)
    .map((n) => ({
      ...n,
      lenSlots: Math.min(n.lenSlots, maxSlot - n.startSlot),
    }));

  return enforceMonophonicRollNotes(mapped);
}

/** Place one pad-locked note on the roll; advance write cursor by quantize step. */
export function addNeuralHumPadRollNote(
  notes: readonly NeuralHumRollNote[],
  opts: {
    pitch: number;
    slot: number;
    quantize: NeuralHumRollQuantize;
    bars: NeuralHumRollBarCount;
    velocity?: number;
  },
): { notes: NeuralHumRollNote[]; nextSlot: number } {
  const maxSlot = totalRollSlots(opts.bars);
  const step = neuralHumQuantizeStepSlots(opts.quantize);
  const startSlot = snapNeuralHumRollSlot(opts.slot, opts.quantize, maxSlot);
  const lenSlots = snapNeuralHumRollLen(step, opts.quantize, maxSlot - startSlot);
  const pitch = Math.max(0, Math.min(127, Math.round(opts.pitch)));
  const note: NeuralHumRollNote = {
    id: newNeuralHumRollNoteId(),
    pitch,
    startSlot,
    lenSlots,
    velocity: Math.max(1, Math.min(127, Math.round(opts.velocity ?? 100))),
  };
  const filtered = notes.filter((n) => n.startSlot !== startSlot);
  const merged = enforceMonophonicRollNotes([...filtered, note].sort((a, b) => a.startSlot - b.startSlot));
  const nextRaw = startSlot + step;
  const nextSlot = nextRaw >= maxSlot ? snapNeuralHumRollSlot(0, opts.quantize, maxSlot) : nextRaw;
  return { notes: merged, nextSlot };
}

export function padWriteSlotLabel(slot: number, bars: NeuralHumRollBarCount): string {
  const bar = Math.floor(slot / NEURAL_HUM_ROLL_SLOTS_PER_BAR) + 1;
  const beatInBar = Math.floor((slot % NEURAL_HUM_ROLL_SLOTS_PER_BAR) / 4) + 1;
  return `Bar ${bar} · beat ${beatInBar}`;
}

/**
 * Strict mono grid — one note starts per step; tails cut when the next note begins.
 */
export function enforceMonophonicRollNotes(notes: readonly NeuralHumRollNote[]): NeuralHumRollNote[] {
  if (notes.length === 0) return [];

  const sorted = [...notes]
    .map((n) => ({ ...n, lenSlots: Math.max(1, n.lenSlots) }))
    .sort((a, b) => a.startSlot - b.startSlot || b.velocity - a.velocity);

  const byStart = new Map<number, NeuralHumRollNote>();
  for (const n of sorted) {
    const existing = byStart.get(n.startSlot);
    if (!existing || n.velocity > existing.velocity) {
      byStart.set(n.startSlot, { ...n });
    }
  }

  const starts = [...byStart.values()].sort((a, b) => a.startSlot - b.startSlot);
  for (let i = 0; i < starts.length; i++) {
    const cur = starts[i]!;
    const next = starts[i + 1];
    if (next) {
      const maxLen = next.startSlot - cur.startSlot;
      cur.lenSlots = Math.max(1, Math.min(cur.lenSlots, maxLen));
    }
  }

  return starts;
}

export function rollNotesToTimed(
  notes: readonly NeuralHumRollNote[],
  bpm: number,
): TimedMonophonicNote[] {
  const spb = secPerBar(bpm);
  const slotSec = spb / NEURAL_HUM_ROLL_SLOTS_PER_BAR;
  const timed = enforceMonophonicRollNotes(notes).map((n) => ({
    pitch: n.pitch,
    startSec: n.startSlot * slotSec,
    durationSec: Math.max(slotSec * 0.5, n.lenSlots * slotSec),
    velocity: n.velocity,
  }));
  return timed.sort((a, b) => a.startSec - b.startSec || a.pitch - b.pitch);
}

export function clampRollNotesToBars(
  notes: readonly NeuralHumRollNote[],
  bars: NeuralHumRollBarCount,
): NeuralHumRollNote[] {
  const maxSlot = totalRollSlots(bars);
  return notes
    .filter((n) => n.startSlot < maxSlot)
    .map((n) => ({
      ...n,
      lenSlots: Math.max(1, Math.min(n.lenSlots, maxSlot - n.startSlot)),
    }));
}

export function rollPitchBounds(notes: readonly NeuralHumRollNote[]): { lo: number; hi: number } {
  if (notes.length === 0) return { lo: 60, hi: 72 };
  let lo = notes[0]!.pitch;
  let hi = notes[0]!.pitch;
  for (const n of notes) {
    lo = Math.min(lo, n.pitch);
    hi = Math.max(hi, n.pitch);
  }
  lo = Math.max(36, Math.floor((lo - 2) / 12) * 12);
  hi = Math.min(96, Math.max(hi + 2, lo + 12));
  if (hi - lo < 12) hi = lo + 12;
  return { lo, hi };
}

export type NeuralHumRollDraft = {
  bars: NeuralHumRollBarCount;
  notes: NeuralHumRollNote[];
  savedAt: number;
};

export function saveNeuralHumRollDraft(draft: Omit<NeuralHumRollDraft, 'savedAt'>): void {
  if (typeof localStorage === 'undefined') return;
  const payload: NeuralHumRollDraft = { ...draft, savedAt: Date.now() };
  localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
}

export function loadNeuralHumRollDraft(): NeuralHumRollDraft | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NeuralHumRollDraft;
    if (!parsed?.notes?.length) return null;
    const bars = parsed.bars === 4 ? 4 : 8;
    return {
      bars,
      savedAt: parsed.savedAt ?? 0,
      notes: clampRollNotesToBars(parsed.notes, bars),
    };
  } catch {
    return null;
  }
}

export function clearNeuralHumRollDraft(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(DRAFT_KEY);
}

export const NEURAL_HUM_ROLL_NOTE_NAMES = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
] as const;

export function rollKeyLabel(midi: number): string {
  const pc = ((midi % 12) + 12) % 12;
  const oct = Math.floor(midi / 12) - 1;
  return `${NEURAL_HUM_ROLL_NOTE_NAMES[pc] ?? '?'}${oct}`;
}
