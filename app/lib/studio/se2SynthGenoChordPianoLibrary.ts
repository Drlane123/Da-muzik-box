/**
 * Shared chord piano library — Live Chord + Chord Generator (phase 1: 8 presets).
 * Rhodes Pianet stays the default lead timbre.
 */
import {
  se2SynthGenoSoundBankEntries,
  se2SynthGenoSoundBankVoice,
  type Se2SynthGenoSoundBankEntry,
} from '@/app/lib/studio/se2SynthGenoSoundBank';
import {
  SE2_SYNTH_GENO_CHORD_PIANO_BANK_IDS,
  se2SynthGenoSanitizeChordPianoBankId,
  type Se2SynthGenoChordPianoBankId,
} from '@/app/lib/studio/se2SynthGenoPianoBankIds';

export { SE2_SYNTH_GENO_CHORD_PIANO_BANK_IDS, type Se2SynthGenoChordPianoBankId };
export { se2SynthGenoSanitizeChordPianoBankId };

export function se2SynthGenoChordPianoBankEntries(): Se2SynthGenoSoundBankEntry[] {
  const all = se2SynthGenoSoundBankEntries('accord');
  const byId = new Map(all.map((e) => [e.id, e]));
  return SE2_SYNTH_GENO_CHORD_PIANO_BANK_IDS.map(
    (id) => byId.get(id) ?? all[0]!,
  ).filter(Boolean);
}

/** User morph on top of the selected piano preset (filter + delay). */
export type Se2SynthGenoChordPianoMorph = {
  lowCutHz: number;
  highCutHz: number;
  delayMix: number;
};

export function se2SynthGenoChordPianoMorphDefaults(bankId: string): Se2SynthGenoChordPianoMorph {
  const v = se2SynthGenoSoundBankVoice('accord', se2SynthGenoSanitizeChordPianoBankId(bankId));
  return {
    lowCutHz: 90,
    highCutHz: Math.round(v.filterCutoffHz),
    delayMix: Math.round((v.delayMix ?? 0.08) * 100) / 100,
  };
}
