/**
 * NEW SYNTH piano-roll sound bank — keys, organs, jazz, strings (not bass synth presets).
 */
import {
  BEAT_LAB_MELODIC_INSTRUMENT_OPTIONS,
  type BeatLabMelodicInstrumentOption,
} from '@/app/lib/creationStation/beatLabMelodicSoundfont';

export type BeatLabSynth2PianoInstrument = BeatLabMelodicInstrumentOption;

/** Curated GM bank for the harmony / piano-roll channel only. */
export const BEAT_LAB_SYNTH2_PIANO_ROLL_BANK: readonly BeatLabSynth2PianoInstrument[] =
  BEAT_LAB_MELODIC_INSTRUMENT_OPTIONS.filter((o) => o.group !== 'Bass');

export const BEAT_LAB_SYNTH2_DEFAULT_PIANO_INSTRUMENT = 'acoustic_grand_piano';

const PIANO_BANK_IDS = new Set(BEAT_LAB_SYNTH2_PIANO_ROLL_BANK.map((o) => o.id));

export function normalizeBeatLabSynth2PianoInstrument(id: string | undefined): string {
  if (id && PIANO_BANK_IDS.has(id)) return id;
  return BEAT_LAB_SYNTH2_DEFAULT_PIANO_INSTRUMENT;
}

export function beatLabSynth2PianoInstrumentLabel(id: string): string {
  return (
    BEAT_LAB_SYNTH2_PIANO_ROLL_BANK.find((o) => o.id === id)?.label ??
    BEAT_LAB_SYNTH2_DEFAULT_PIANO_INSTRUMENT
  );
}

/**
 * Piano-roll bank loudness (not the mixer CH fader).
 * GM strings / pads are quiet in MusyngKite — boost so they sit with bass V2.
 */
const PIANO_ROLL_BANK_BASE_GAIN = 1.18;

const PIANO_ROLL_GROUP_GAIN: Record<string, number> = {
  Keys: 1.12,
  Strings: 1.42,
  Synth: 1.28,
  Guitar: 1.15,
  Brass: 1.18,
  Reed: 1.2,
  Wind: 1.2,
  Mallet: 1.22,
  Chromatic: 1.15,
};

export function beatLabSynth2PianoRollInstrumentGain(instrumentId: string): number {
  const id = normalizeBeatLabSynth2PianoInstrument(instrumentId);
  const group =
    BEAT_LAB_SYNTH2_PIANO_ROLL_BANK.find((o) => o.id === id)?.group ?? 'Keys';
  const groupMul = PIANO_ROLL_GROUP_GAIN[group] ?? 1.2;
  return PIANO_ROLL_BANK_BASE_GAIN * groupMul;
}
