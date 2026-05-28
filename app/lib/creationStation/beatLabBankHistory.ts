/**
 * Deep snapshots for Beat Lab bank undo / redo.
 */
import type { BeatLabMidiNote } from './beatLabMidiRoll';
import type { BeatLabBassSynthVoiceParams } from './beatLabMelodicSynthV2State';

export type BeatLabBankHistoryEntry = {
  drums: boolean[][];
  notes: { row: number; col: number }[];
  midiRoll: BeatLabMidiNote[];
  volAutomation?: number[];
  pitchAutomation?: number[];
  /** GM soundfont id per melodic lane (CH 17–32). */
  melodicInstruments?: string[];
  /** Synth preset id per melodic lane (CH 17–32). */
  melodicSynthPresetIds?: string[];
  /** Editable synth v2 params per melodic lane (CH 17–32). */
  melodicSynthVoices?: BeatLabBassSynthVoiceParams[];
};

export type BeatLabPatternSlotId = 'A' | 'B';

export type BeatLabBankPatternSlots = Record<BeatLabPatternSlotId, boolean[][]>;

export type BeatLabHistorySnapshot<T extends BeatLabBankHistoryEntry = BeatLabBankHistoryEntry> = {
  banks: T[];
  bankPatternSlots: BeatLabBankPatternSlots[];
  loopBars: number;
  loopStartBeat: number;
  loopEndBeat: number;
  loopOn: boolean;
};

export const BEAT_LAB_UNDO_STACK_MAX = 50;

/** Loop DUP only — not mixed with grid edit undo. */
export const BEAT_LAB_DUP_UNDO_STACK_MAX = 8;

export function cloneBeatLabBanks<T extends BeatLabBankHistoryEntry>(banks: readonly T[]): T[] {
  return banks.map((b) => ({
    ...b,
    drums: b.drums.map((row) => row.slice()),
    notes: b.notes.map((n) => ({ ...n })),
    midiRoll: b.midiRoll.map((n) => ({ ...n })),
    volAutomation: b.volAutomation?.slice(),
    pitchAutomation: b.pitchAutomation?.slice(),
    melodicInstruments: b.melodicInstruments?.slice(),
    melodicSynthPresetIds: b.melodicSynthPresetIds?.slice(),
    melodicSynthVoices: b.melodicSynthVoices?.map((v) => ({ ...v })),
  })) as T[];
}

function cloneDrumPattern(pattern: readonly boolean[][]): boolean[][] {
  return pattern.map((row) => row.slice());
}

export function cloneBeatLabBankPatternSlots(
  slots: readonly BeatLabBankPatternSlots[],
): BeatLabBankPatternSlots[] {
  return slots.map((bank) => ({
    A: cloneDrumPattern(bank.A),
    B: cloneDrumPattern(bank.B),
  }));
}

export function captureBeatLabHistorySnapshot<T extends BeatLabBankHistoryEntry>(
  input: BeatLabHistorySnapshot<T>,
): BeatLabHistorySnapshot<T> {
  return {
    banks: cloneBeatLabBanks(input.banks),
    bankPatternSlots: cloneBeatLabBankPatternSlots(input.bankPatternSlots),
    loopBars: input.loopBars,
    loopStartBeat: input.loopStartBeat,
    loopEndBeat: input.loopEndBeat,
    loopOn: input.loopOn,
  };
}

/** Restore banks, pattern slots, and loop region (e.g. undo loop DUP). */
export function restoreBeatLabHistorySnapshot<T extends BeatLabBankHistoryEntry>(
  snap: BeatLabHistorySnapshot<T>,
): {
  banks: T[];
  bankPatternSlots: BeatLabBankPatternSlots[];
  loopBars: number;
  loopStartBeat: number;
  loopEndBeat: number;
  loopOn: boolean;
} {
  return {
    banks: cloneBeatLabBanks(snap.banks),
    bankPatternSlots: cloneBeatLabBankPatternSlots(snap.bankPatternSlots),
    loopBars: snap.loopBars,
    loopStartBeat: snap.loopStartBeat,
    loopEndBeat: snap.loopEndBeat,
    loopOn: snap.loopOn,
  };
}
