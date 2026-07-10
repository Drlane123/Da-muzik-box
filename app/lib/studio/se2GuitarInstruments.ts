/**
 * SE2 Guitar lane — MusyngKite GM guitars via smplr (open-source gleitz/midi-js-soundfonts).
 * @see https://github.com/danigb/smplr
 * @see https://github.com/gleitz/midi-js-soundfonts
 */

export type Se2GuitarInstrumentId =
  | 'acoustic_guitar_nylon'
  | 'acoustic_guitar_steel'
  | 'electric_guitar_jazz'
  | 'electric_guitar_clean'
  | 'electric_guitar_muted'
  | 'overdriven_guitar'
  | 'distortion_guitar'
  | 'guitar_harmonics';

export type Se2GuitarInstrumentOption = {
  id: Se2GuitarInstrumentId;
  label: string;
  hint: string;
};

export const SE2_GUITAR_DEFAULT_INSTRUMENT: Se2GuitarInstrumentId = 'acoustic_guitar_steel';

export const SE2_GUITAR_INSTRUMENT_OPTIONS: readonly Se2GuitarInstrumentOption[] = [
  {
    id: 'acoustic_guitar_nylon',
    label: 'Nylon Acoustic',
    hint: 'Classical / fingerstyle — warm nylon strings',
  },
  {
    id: 'acoustic_guitar_steel',
    label: 'Steel Acoustic',
    hint: 'Folk / country — bright steel-string body',
  },
  {
    id: 'electric_guitar_jazz',
    label: 'Jazz Electric',
    hint: 'Smooth hollow-body jazz tone',
  },
  {
    id: 'electric_guitar_clean',
    label: 'Clean Electric',
    hint: 'Pop / R&B — balanced clean pickup',
  },
  {
    id: 'electric_guitar_muted',
    label: 'Muted Electric',
    hint: 'Funk / staccato — palm-muted plucks',
  },
  {
    id: 'overdriven_guitar',
    label: 'Overdrive',
    hint: 'Rock / blues crunch',
  },
  {
    id: 'distortion_guitar',
    label: 'Distortion',
    hint: 'Hard rock / lead sustain',
  },
  {
    id: 'guitar_harmonics',
    label: 'Harmonics',
    hint: 'Bell-like natural harmonics',
  },
];

export function se2SanitizeGuitarInstrumentId(raw: string | undefined): Se2GuitarInstrumentId {
  const hit = SE2_GUITAR_INSTRUMENT_OPTIONS.find((o) => o.id === raw);
  return hit?.id ?? SE2_GUITAR_DEFAULT_INSTRUMENT;
}

export function se2GuitarInstrumentLabel(id: Se2GuitarInstrumentId): string {
  return SE2_GUITAR_INSTRUMENT_OPTIONS.find((o) => o.id === id)?.label ?? 'Guitar';
}
