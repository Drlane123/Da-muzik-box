/**
 * Display-only titles for built-in sound families — no producer / brand names in the UI.
 */

const FAMILY_PREFIX: Record<string, string> = {
  '808-sub': '808',
  kick: 'Kick',
  snare: 'Snare',
  clap: 'Clap',
  hihat: 'Hi-Hat',
  'open-hat': 'Open Hat',
  perc: 'Perc',
  perc2: 'Perc',
  cymbal: 'Cymbal',
  fx: 'FX',
  extra: 'Extra',
  vox: 'Vox',
  tag: 'Tag',
};

/** Neutral numbered label shown in Sound Families (e.g. "808 001"). */
export function soundFamilySampleDisplayTitle(familyId: string, index: number): string {
  const prefix = FAMILY_PREFIX[familyId] ?? 'Sound';
  return `${prefix} ${String(index + 1).padStart(3, '0')}`;
}
