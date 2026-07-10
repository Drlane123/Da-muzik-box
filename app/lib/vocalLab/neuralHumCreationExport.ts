/**
 * Neural Hum → Creation Station (Groove Lab melody / Beat Lab NEW SYNTH harmony).
 */
import {
  chordQuarterColToStepCol,
  chordQuarterDurationToStepLen,
  melodicLanePitchSemi,
} from '@/app/lib/creationStation/chordBuilderBeatLabImport';
import {
  BEAT_LAB_MELODIC_LANE_START,
  clampBeatLabNoteLen,
  normalizeBeatLabMidiNote,
  type BeatLabMidiNote,
} from '@/app/lib/creationStation/beatLabMidiRoll';
import { grooveLabClampChordRollMidi } from '@/app/lib/creationStation/grooveLabPitch';
import {
  GROOVE_LAB_SLOTS_PER_BAR,
  normalizeGrooveBarCount,
  snapGrooveSlot,
  snapGrooveSustain,
  type GrooveLabBarCount,
  type GrooveLabQuantize,
  type GrooveRollHit,
} from '@/app/lib/creationStation/grooveLabRoll';
import type { TimedMonophonicNote } from '@/app/lib/studio/audioToMidiNotes';

export type NeuralHumCreationExportTarget = 'groove-lab' | 'new-synth';

export type PendingNeuralHumCreationImport = {
  target: NeuralHumCreationExportTarget;
  notes: TimedMonophonicNote[];
  bpm: number;
  quantize?: GrooveLabQuantize;
  transposeSemis?: number;
  label?: string;
};

export const NEURAL_HUM_CREATION_IMPORT_EVENT = 'da-neural-hum-creation-import';

let pendingCreationImport: PendingNeuralHumCreationImport | null = null;

export function publishNeuralHumCreationImport(payload: PendingNeuralHumCreationImport): void {
  pendingCreationImport = payload;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(NEURAL_HUM_CREATION_IMPORT_EVENT));
  }
}

export function takeNeuralHumCreationImport(
  target: NeuralHumCreationExportTarget,
): PendingNeuralHumCreationImport | null {
  if (!pendingCreationImport || pendingCreationImport.target !== target) return null;
  const out = pendingCreationImport;
  pendingCreationImport = null;
  return out;
}

function secPerBar(bpm: number): number {
  const b = Math.max(30, Math.min(300, bpm));
  return (60 / b) * 4;
}

/** Monophonic hum → Groove Lab melody lane (WaveLeaf roll). */
export function timedNotesToGrooveMelodyHits(
  notes: readonly TimedMonophonicNote[],
  bpm: number,
  opts?: {
    quantize?: GrooveLabQuantize;
    barCount?: number;
    transposeSemis?: number;
  },
): { hits: GrooveRollHit[]; barCount: GrooveLabBarCount; bpm: number } {
  const quantize = opts?.quantize ?? '1/16';
  const transpose = opts?.transposeSemis ?? 0;
  const spb = secPerBar(bpm);
  let maxSlot = 0;
  const hits: GrooveRollHit[] = [];

  for (const n of notes) {
    const startSlot = (n.startSec / spb) * GROOVE_LAB_SLOTS_PER_BAR;
    const endSlot = ((n.startSec + n.durationSec) / spb) * GROOVE_LAB_SLOTS_PER_BAR;
    const barCountGuess = Math.max(4, opts?.barCount ?? 4);
    const slot = snapGrooveSlot(startSlot, quantize, barCountGuess);
    const sustain = Math.max(1, Math.round(endSlot - startSlot));
    const sustainSlots = snapGrooveSustain(slot, sustain, quantize, barCountGuess);
    const midi = grooveLabClampChordRollMidi(Math.round(n.pitch + transpose));
    const vel = Math.max(0.05, Math.min(1, n.velocity / 127));
    hits.push({ slot, sustainSlots, midi, vel });
    maxSlot = Math.max(maxSlot, slot + sustainSlots);
  }

  const barsNeeded = Math.max(1, Math.ceil(maxSlot / GROOVE_LAB_SLOTS_PER_BAR));
  const barCount = normalizeGrooveBarCount(Math.max(opts?.barCount ?? 4, barsNeeded));

  return {
    hits: hits.map((h) => ({
      ...h,
      slot: snapGrooveSlot(h.slot, quantize, barCount),
      sustainSlots: snapGrooveSustain(h.slot, h.sustainSlots, quantize, barCount),
    })),
    barCount,
    bpm,
  };
}

/** Monophonic hum → NEW SYNTH harmony lane on the Beat Lab step grid. */
export function timedNotesToBeatLabHarmonyRoll(
  notes: readonly TimedMonophonicNote[],
  opts: {
    bpm: number;
    stepSubdiv: number;
    patternCols: number;
    beatsPerBar?: number;
    colsPerBar?: number;
    harmonyLane?: number;
    transposeSemis?: number;
  },
): BeatLabMidiNote[] {
  const bpm = Math.max(30, Math.min(300, opts.bpm));
  const spb = 60 / bpm;
  const subdiv = Math.max(1, Math.round(opts.stepSubdiv));
  const bpb = Math.max(1, Math.round(opts.beatsPerBar ?? 4));
  const cpb = Math.max(1, Math.round(opts.colsPerBar ?? 4));
  const maxCol = Math.max(1, Math.round(opts.patternCols));
  const lane = Math.max(
    BEAT_LAB_MELODIC_LANE_START,
    Math.min(31, Math.round(opts.harmonyLane ?? BEAT_LAB_MELODIC_LANE_START + 1)),
  );
  const transpose = opts.transposeSemis ?? 0;
  const out: BeatLabMidiNote[] = [];

  for (const n of notes) {
    const startBeat = n.startSec / spb;
    const durBeat = Math.max(spb / 64, n.durationSec / spb);
    const qCol = startBeat;
    const col = chordQuarterColToStepCol(qCol, subdiv, cpb, bpb);
    if (col >= maxCol) continue;
    const len = chordQuarterDurationToStepLen(durBeat, subdiv, cpb, bpb);
    const midi = Math.max(0, Math.min(127, Math.round(n.pitch + transpose)));
    const pitchSemi = melodicLanePitchSemi(lane, midi);
    if (pitchSemi == null) continue;
    const vel = Math.max(1, Math.min(127, Math.round(n.velocity)));
    const note = normalizeBeatLabMidiNote({
      lane,
      col,
      len: clampBeatLabNoteLen(len, col, maxCol),
      vel,
      pitchSemi,
    });
    if (note) out.push(note);
  }

  out.sort((a, b) => a.col - b.col || (a.pitchSemi ?? 0) - (b.pitchSemi ?? 0));
  return out;
}
