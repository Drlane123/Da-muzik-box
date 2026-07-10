/** Curated chord pianos — shared by Live Chord, Chord Generator, melody / arp lanes. */
export const SE2_SYNTH_GENO_CHORD_PIANO_BANK_IDS = [
  'rhodes-classic',
  'rhodes-studio',
  'rhodes-bright',
  'rhodes-wurli',
  'rhodes-lofi',
  'piano-grand',
  'piano-upright',
  'piano-rnb',
] as const;

export type Se2SynthGenoChordPianoBankId = (typeof SE2_SYNTH_GENO_CHORD_PIANO_BANK_IDS)[number];

const CHORD_PIANO_ID_SET = new Set<string>(SE2_SYNTH_GENO_CHORD_PIANO_BANK_IDS);

export function se2SynthGenoIsChordPianoBankId(id: string): id is Se2SynthGenoChordPianoBankId {
  return CHORD_PIANO_ID_SET.has(id);
}

export function se2SynthGenoSanitizeChordPianoBankId(id: string): Se2SynthGenoChordPianoBankId {
  if (se2SynthGenoIsChordPianoBankId(id)) return id;
  return 'rhodes-classic';
}
