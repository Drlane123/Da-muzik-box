/**

 * Synth Geno — curated starter library (Accord / Melody / Bass) for Saint Gino Generator.

 */

import { se2SynthGenoVoiceFromRole } from '@/app/lib/studio/se2SynthGenoVoiceCore';

import { genoAccordGmInstrument } from '@/app/lib/studio/se2SynthGenoAccordSoundfont';
import {
  SE2_SYNTH_GENO_CHORD_PIANO_BANK_IDS,
  se2SynthGenoIsChordPianoBankId,
} from '@/app/lib/studio/se2SynthGenoPianoBankIds';
import { se2SynthGenoSanitizeChordPianoBankId } from '@/app/lib/studio/se2SynthGenoChordPianoLibrary';
import type { Se2SynthGenoRole, Se2SynthGenoVoiceParams } from '@/app/lib/studio/se2SynthGenoTypes';



export type Se2SynthGenoSoundBankCategory = 'accord' | 'melody' | 'bass';



export type Se2SynthGenoSoundBankEntry = {

  id: string;

  label: string;

  category: Se2SynthGenoSoundBankCategory;

  voice: Se2SynthGenoVoiceParams;

};



export type Se2SynthGenoPluginSoundSelection = {

  accordBankId: string;

  melodyBankId: string;

  bassBankId: string;

  fillerBankId: string;

};



export const SE2_SYNTH_GENO_DEFAULT_SOUND_SELECTION: Se2SynthGenoPluginSoundSelection = {

  accordBankId: 'rhodes-classic',

  melodyBankId: 'rhodes-classic',

  bassBankId: 'upright-bass',

  fillerBankId: 'lead-soft',

};

/** Note Filler lane — soft lead / pluck ornaments (distinct from arp/melody default). */
export const SE2_SYNTH_GENO_FILLER_LANE_DEFAULT_BANK = 'lead-soft';

/** Canonical comp chord timbre — Rhodes Pianet (R&B reference). All Live Chord pads use this. */
export const SE2_SYNTH_GENO_CHORD_ACCORD_BANK = 'rhodes-classic';

/** Default arp / melody timbre — Rhodes Pianet (matches chord piano stack). */
export const SE2_SYNTH_GENO_MELODY_LANE_DEFAULT_BANK = 'rhodes-classic';

/** Melody sounds hidden from Chord Generator (melody / arp lane). */
export const SE2_SYNTH_GENO_PLUGIN_MELODY_EXCLUDED = new Set<string>(['lead-silk']);



function entry(

  id: string,

  label: string,

  category: Se2SynthGenoSoundBankCategory,

  role: Se2SynthGenoRole,

  patch: Partial<Se2SynthGenoVoiceParams>,

): Se2SynthGenoSoundBankEntry {

  return {

    id,

    label,

    category,

    voice: { ...se2SynthGenoVoiceFromRole(role, label), ...patch, role, label },

  };

}



const ACCORD_BANK: Se2SynthGenoSoundBankEntry[] = [

  entry('rhodes-studio', 'Rhodes CP80', 'accord', 'keys', {

    osc1Wave: 'sine',

    osc1Level: 0.68,

    osc2Wave: 'triangle',

    osc2Level: 0.42,

    subLevel: 0,

    unisonVoices: 4,

    unisonDetuneCents: 11,

    filterCutoffHz: 5200,

    filterResonanceQ: 1.05,

    filterDrive: 0.14,

    ampAttackMs: 7,

    ampDecayMs: 520,

    ampSustain: 0.58,

    ampReleaseMs: 420,

    chorusMix: 0.18,

    reverbMix: 0.2,

    outputLevel: 0.56,

  }),

  entry('rhodes-classic', 'Rhodes Pianet', 'accord', 'keys', {

    osc1Wave: 'sine',

    osc1Level: 0.7,

    osc2Wave: 'triangle',

    osc2Level: 0.38,

    subLevel: 0,

    unisonVoices: 4,

    unisonDetuneCents: 10,

    filterCutoffHz: 4800,

    filterResonanceQ: 1.0,

    filterDrive: 0.12,

    ampAttackMs: 8,

    ampDecayMs: 480,

    ampSustain: 0.54,

    ampReleaseMs: 380,

    chorusMix: 0.14,

    reverbMix: 0.18,

    outputLevel: 0.55,

  }),

  entry('rhodes-bright', 'Rhodes FM Piano', 'accord', 'keys', {

    osc1Wave: 'triangle',

    osc1Level: 0.64,

    osc2Wave: 'sine',

    osc2Level: 0.32,

    subLevel: 0,

    unisonVoices: 3,

    unisonDetuneCents: 8,

    filterCutoffHz: 5200,

    filterResonanceQ: 1.1,

    ampAttackMs: 6,

    ampDecayMs: 380,

    ampSustain: 0.46,

    ampReleaseMs: 320,

    chorusMix: 0.1,

    reverbMix: 0.12,

    outputLevel: 0.52,

  }),

  entry('rhodes-wurli', 'Wurlitzer EP200', 'accord', 'keys', {

    osc1Wave: 'square',

    osc1Level: 0.48,

    osc2Wave: 'triangle',

    osc2Level: 0.44,

    subLevel: 0,

    unisonVoices: 3,

    unisonDetuneCents: 7,

    filterCutoffHz: 2800,

    filterResonanceQ: 1.2,

    filterDrive: 0.18,

    ampAttackMs: 4,

    ampDecayMs: 340,

    ampSustain: 0.4,

    distortion: 0.06,

    chorusMix: 0.08,

    reverbMix: 0.1,

    outputLevel: 0.5,

  }),

  entry('rhodes-lofi', 'Lo-Fi Rhodes', 'accord', 'keys', {

    osc1Wave: 'sine',

    osc1Level: 0.62,

    osc2Wave: 'triangle',

    osc2Level: 0.28,

    subLevel: 0,

    noiseLevel: 0,

    unisonVoices: 1,

    unisonDetuneCents: 0,

    filterCutoffHz: 3200,

    filterResonanceQ: 0.75,

    filterDrive: 0,

    ampAttackMs: 8,

    ampDecayMs: 420,

    ampSustain: 0.52,

    ampReleaseMs: 280,

    chorusMix: 0,

    delayMix: 0,

    reverbMix: 0,

    distortion: 0,

    outputLevel: 0.52,

  }),

  entry('piano-grand', 'Steinway Grand', 'accord', 'keys', {

    osc1Wave: 'triangle',

    osc1Level: 0.62,

    osc2Wave: 'sine',

    osc2Level: 0.28,

    subLevel: 0,

    unisonVoices: 4,

    unisonDetuneCents: 5,

    filterCutoffHz: 5200,

    filterResonanceQ: 0.82,

    ampAttackMs: 2,

    ampDecayMs: 720,

    ampSustain: 0.38,

    ampReleaseMs: 520,

    reverbMix: 0.24,

    chorusMix: 0.06,

    outputLevel: 0.56,

  }),

  entry('piano-upright', 'Upright Piano', 'accord', 'keys', {

    osc1Wave: 'triangle',

    osc1Level: 0.64,

    osc2Wave: 'square',

    osc2Level: 0.1,

    subLevel: 0,

    unisonVoices: 3,

    unisonDetuneCents: 6,

    filterCutoffHz: 3000,

    filterResonanceQ: 0.9,

    filterDrive: 0.1,

    ampAttackMs: 4,

    ampDecayMs: 520,

    ampSustain: 0.3,

    ampReleaseMs: 380,

    reverbMix: 0.14,

    outputLevel: 0.52,

  }),

  entry('piano-rnb', 'R&B Keys', 'accord', 'keys', {

    osc1Wave: 'sine',

    osc1Level: 0.68,

    osc2Wave: 'triangle',

    osc2Level: 0.36,

    subLevel: 0,

    unisonVoices: 4,

    unisonDetuneCents: 9,

    filterCutoffHz: 3600,

    filterResonanceQ: 0.95,

    filterDrive: 0.12,

    ampAttackMs: 7,

    ampDecayMs: 520,

    ampSustain: 0.6,

    ampReleaseMs: 420,

    chorusMix: 0.16,

    reverbMix: 0.2,

    outputLevel: 0.55,

  }),

  entry('piano-gospel', 'Gospel Organ', 'accord', 'keys', {

    osc1Wave: 'saw',

    osc1Level: 0.46,

    osc2Wave: 'square',

    osc2Level: 0.38,

    subLevel: 0,

    unisonVoices: 4,

    unisonDetuneCents: 10,

    filterCutoffHz: 2600,

    filterResonanceQ: 1.05,

    ampAttackMs: 18,

    ampDecayMs: 460,

    ampSustain: 0.68,

    ampReleaseMs: 480,

    chorusMix: 0.14,

    reverbMix: 0.24,

    outputLevel: 0.52,

  }),

];



const BASS_BANK: Se2SynthGenoSoundBankEntry[] = [

  entry('bass-line', 'Bass Line', 'bass', 'bass', {

    osc1Wave: 'sine',

    osc1Level: 0.88,

    osc2Wave: 'saw',

    osc2Level: 0.18,

    subLevel: 0.55,

    filterCutoffHz: 420,

    ampDecayMs: 260,

    ampSustain: 0.68,

    outputLevel: 0.52,

  }),

  entry('moog-low', 'Moog Bass', 'bass', 'bass', {

    osc1Wave: 'saw',

    osc1Level: 0.72,

    osc2Wave: 'square',

    osc2Level: 0.24,

    subLevel: 0.42,

    filterCutoffHz: 680,

    filterResonanceQ: 1.8,

    filterDrive: 0.22,

    ampAttackMs: 2,

    ampDecayMs: 180,

    ampSustain: 0.78,

    distortion: 0.28,

    outputLevel: 0.5,

  }),

  entry('moog-squelch', 'Moog Squelch', 'bass', 'bass', {

    osc1Wave: 'saw',

    osc1Level: 0.78,

    osc2Wave: 'saw',

    osc2Level: 0.32,

    subLevel: 0.28,

    filterCutoffHz: 920,

    filterResonanceQ: 2.4,

    filterDrive: 0.35,

    ampAttackMs: 1,

    ampDecayMs: 140,

    ampSustain: 0.55,

    distortion: 0.42,

    outputLevel: 0.48,

  }),

  entry('bass-guitar-finger', 'Finger Bass', 'bass', 'bass', {

    osc1Wave: 'triangle',

    osc1Level: 0.78,

    osc2Wave: 'sine',

    osc2Level: 0.26,

    subLevel: 0.38,

    filterCutoffHz: 880,

    filterResonanceQ: 0.85,

    ampAttackMs: 5,

    ampDecayMs: 340,

    ampSustain: 0.66,

    ampReleaseMs: 220,

    chorusMix: 0.04,

    outputLevel: 0.52,

  }),

  entry('bass-guitar-pick', 'Pick Bass', 'bass', 'bass', {

    osc1Wave: 'saw',

    osc1Level: 0.68,

    osc2Wave: 'triangle',

    osc2Level: 0.2,

    filterCutoffHz: 1100,

    filterResonanceQ: 1.1,

    ampAttackMs: 2,

    ampDecayMs: 240,

    ampSustain: 0.58,

    distortion: 0.08,

    outputLevel: 0.51,

  }),

  entry('sub-808', '808 Sub', 'bass', 'bass', {

    osc1Wave: 'sine',

    osc1Level: 0.95,

    osc2Level: 0,

    subLevel: 0.72,

    filterCutoffHz: 280,

    filterResonanceQ: 0.5,

    ampAttackMs: 2,

    ampDecayMs: 480,

    ampSustain: 0.82,

    ampReleaseMs: 320,

    outputLevel: 0.54,

  }),

  entry('synth-funk', 'Funk Synth', 'bass', 'bass', {

    osc1Wave: 'square',

    osc1Level: 0.62,

    osc2Wave: 'saw',

    osc2Level: 0.38,

    subLevel: 0.35,

    filterCutoffHz: 540,

    filterResonanceQ: 1.5,

    ampAttackMs: 3,

    ampDecayMs: 200,

    ampSustain: 0.7,

    distortion: 0.2,

    outputLevel: 0.49,

  }),

  entry('upright-bass', 'Upright Bass', 'bass', 'bass', {

    osc1Wave: 'sine',

    osc1Level: 0.82,

    osc2Wave: 'triangle',

    osc2Level: 0.12,

    filterCutoffHz: 620,

    ampAttackMs: 8,

    ampDecayMs: 380,

    ampSustain: 0.55,

    ampReleaseMs: 260,

    reverbMix: 0.06,

    outputLevel: 0.5,

  }),

];



const MELODY_BANK: Se2SynthGenoSoundBankEntry[] = [

  entry('lead-silk', 'Silk Lead', 'melody', 'lead', {

    osc1Wave: 'saw',

    osc1Level: 0.52,

    osc2Wave: 'triangle',

    osc2Level: 0.34,

    subLevel: 0.08,

    unisonVoices: 3,

    unisonDetuneCents: 9,

    filterCutoffHz: 4200,

    filterResonanceQ: 0.85,

    ampAttackMs: 12,

    ampDecayMs: 380,

    ampSustain: 0.52,

    ampReleaseMs: 320,

    chorusMix: 0.14,

    reverbMix: 0.16,

    delayMix: 0.08,

    outputLevel: 0.5,

  }),

  entry('lead-hook', 'Hook Lead', 'melody', 'lead', {

    osc1Wave: 'triangle',

    osc1Level: 0.58,

    osc2Wave: 'saw',

    osc2Level: 0.28,

    unisonVoices: 2,

    unisonDetuneCents: 7,

    filterCutoffHz: 5200,

    filterResonanceQ: 0.95,

    ampAttackMs: 6,

    ampDecayMs: 280,

    ampSustain: 0.5,

    ampReleaseMs: 260,

    chorusMix: 0.1,

    delayMix: 0.1,

    reverbMix: 0.12,

    outputLevel: 0.5,

  }),

  entry('lead-vox', 'Vox Lead', 'melody', 'lead', {

    osc1Wave: 'saw',

    osc1Level: 0.46,

    osc2Wave: 'square',

    osc2Level: 0.22,

    unisonVoices: 3,

    unisonDetuneCents: 8,

    filterType: 'bandpass',

    filterCutoffHz: 2400,

    filterResonanceQ: 1.4,

    ampAttackMs: 14,

    ampDecayMs: 340,

    ampSustain: 0.48,

    ampReleaseMs: 300,

    chorusMix: 0.12,

    reverbMix: 0.14,

    outputLevel: 0.48,

  }),

  entry('lead-soft', 'Soft Lead', 'melody', 'lead', {

    osc1Wave: 'triangle',

    osc1Level: 0.56,

    osc2Wave: 'sine',

    osc2Level: 0.32,

    subLevel: 0.06,

    unisonVoices: 3,

    unisonDetuneCents: 7,

    filterCutoffHz: 4600,

    filterResonanceQ: 0.75,

    ampAttackMs: 14,

    ampDecayMs: 360,

    ampSustain: 0.5,

    ampReleaseMs: 300,

    chorusMix: 0.1,

    reverbMix: 0.14,

    delayMix: 0.06,

    outputLevel: 0.48,

  }),

  entry('lead-saw', 'Saw Hook', 'melody', 'lead', {

    osc1Wave: 'saw',

    osc1Level: 0.58,

    osc2Wave: 'square',

    osc2Level: 0.18,

    unisonVoices: 2,

    unisonDetuneCents: 6,

    filterCutoffHz: 4800,

    filterResonanceQ: 0.9,

    filterDrive: 0.08,

    ampAttackMs: 5,

    ampDecayMs: 220,

    ampSustain: 0.46,

    ampReleaseMs: 240,

    chorusMix: 0.08,

    delayMix: 0.1,

    outputLevel: 0.48,

  }),

  entry('pluck-kalimba', 'Kalimba', 'melody', 'pluck', {

    osc1Wave: 'sine',

    osc1Level: 0.62,

    osc2Wave: 'triangle',

    osc2Level: 0.28,

    filterCutoffHz: 5800,

    filterResonanceQ: 1.6,

    ampAttackMs: 1,

    ampDecayMs: 520,

    ampSustain: 0.04,

    ampReleaseMs: 280,

    delayMix: 0.14,

    reverbMix: 0.18,

    outputLevel: 0.46,

  }),

  entry('pluck-classic', 'Classic Pluck', 'melody', 'pluck', {

    osc1Wave: 'triangle',

    osc1Level: 0.6,

    osc2Wave: 'sine',

    osc2Level: 0.22,

    filterCutoffHz: 4800,

    filterResonanceQ: 1.3,

    ampAttackMs: 1,

    ampDecayMs: 320,

    ampSustain: 0.08,

    ampReleaseMs: 180,

    delayMix: 0.12,

    reverbMix: 0.1,

    outputLevel: 0.46,

  }),

  entry('pluck-glass', 'Glass Pluck', 'melody', 'pluck', {

    osc1Wave: 'sine',

    osc1Level: 0.58,

    osc2Wave: 'triangle',

    osc2Level: 0.34,

    subLevel: 0.04,

    filterCutoffHz: 6800,

    filterResonanceQ: 1.5,

    ampAttackMs: 1,

    ampDecayMs: 440,

    ampSustain: 0.05,

    ampReleaseMs: 260,

    delayMix: 0.14,

    reverbMix: 0.18,

    chorusMix: 0.06,

    outputLevel: 0.45,

  }),

  entry('pluck-marimba', 'Marimba', 'melody', 'pluck', {

    osc1Wave: 'sine',

    osc1Level: 0.66,

    osc2Wave: 'triangle',

    osc2Level: 0.22,

    filterCutoffHz: 5200,

    filterResonanceQ: 1.35,

    ampAttackMs: 1,

    ampDecayMs: 420,

    ampSustain: 0.03,

    ampReleaseMs: 220,

    reverbMix: 0.1,

    outputLevel: 0.47,

  }),

  entry('pluck-guitar', 'Nylon Guitar', 'melody', 'pluck', {

    osc1Wave: 'triangle',

    osc1Level: 0.58,

    osc2Wave: 'saw',

    osc2Level: 0.12,

    filterCutoffHz: 4200,

    filterResonanceQ: 1.2,

    ampAttackMs: 2,

    ampDecayMs: 480,

    ampSustain: 0.1,

    ampReleaseMs: 280,

    reverbMix: 0.14,

    delayMix: 0.08,

    outputLevel: 0.46,

  }),

  entry('bell-shimmer', 'Bell Shimmer', 'melody', 'bell', {

    osc1Wave: 'sine',

    osc1Level: 0.6,

    osc2Wave: 'triangle',

    osc2Level: 0.36,

    filterType: 'bandpass',

    filterCutoffHz: 3200,

    filterResonanceQ: 2.1,

    ampAttackMs: 2,

    ampDecayMs: 1100,

    ampSustain: 0.12,

    ampReleaseMs: 720,

    delayMix: 0.16,

    reverbMix: 0.3,

    chorusMix: 0.08,

    outputLevel: 0.44,

  }),

  entry('arp-sparkle', 'Arp Sparkle', 'melody', 'pluck', {

    osc1Wave: 'triangle',

    osc1Level: 0.48,

    osc2Wave: 'sine',

    osc2Level: 0.36,

    filterCutoffHz: 6400,

    filterResonanceQ: 1.4,

    ampAttackMs: 1,

    ampDecayMs: 200,

    ampSustain: 0.05,

    ampReleaseMs: 140,

    delayMix: 0.18,

    chorusMix: 0.08,

    reverbMix: 0.12,

    outputLevel: 0.42,

  }),

];



export const SE2_SYNTH_GENO_SOUND_BANK: readonly Se2SynthGenoSoundBankEntry[] = [

  ...ACCORD_BANK,

  ...BASS_BANK,

  ...MELODY_BANK,

];



const bankById = new Map(SE2_SYNTH_GENO_SOUND_BANK.map((e) => [e.id, e]));



export function se2SynthGenoSoundBankEntries(

  category: Se2SynthGenoSoundBankCategory,

): readonly Se2SynthGenoSoundBankEntry[] {

  return SE2_SYNTH_GENO_SOUND_BANK.filter((e) => e.category === category);

}

/** Chord Generator melody picker — excludes Silk Lead and other blocked ids. */
export function se2SynthGenoPluginSoundBankEntries(
  category: Se2SynthGenoSoundBankCategory,
): readonly Se2SynthGenoSoundBankEntry[] {
  const entries = se2SynthGenoSoundBankEntries(category);
  if (category !== 'melody') return entries;
  return entries.filter((e) => !SE2_SYNTH_GENO_PLUGIN_MELODY_EXCLUDED.has(e.id));
}

/** Melody / arp lane — chord pianos first, then plucks & leads. */
export function se2SynthGenoMelodyLaneSoundEntries(): readonly Se2SynthGenoSoundBankEntry[] {
  const pianos = SE2_SYNTH_GENO_CHORD_PIANO_BANK_IDS.map((id) => {
    const accord = se2SynthGenoSoundBankEntry('accord', id)!;
    return { ...accord, category: 'melody' as const };
  });
  return [...pianos, ...se2SynthGenoPluginSoundBankEntries('melody')];
}

export function se2SynthGenoSanitizePluginMelodyBankId(id: string): string {
  if (SE2_SYNTH_GENO_PLUGIN_MELODY_EXCLUDED.has(id)) return SE2_SYNTH_GENO_MELODY_LANE_DEFAULT_BANK;
  if (se2SynthGenoIsChordPianoBankId(id)) return id;
  return se2SynthGenoSoundBankEntry('melody', id)?.id ?? SE2_SYNTH_GENO_MELODY_LANE_DEFAULT_BANK;
}

/** Note Filler — same piano / pluck / lead pool as melody lane. */
export function se2SynthGenoFillerLaneSoundEntries(): readonly Se2SynthGenoSoundBankEntry[] {
  return se2SynthGenoMelodyLaneSoundEntries();
}

export function se2SynthGenoSanitizePluginFillerBankId(id: string): string {
  return se2SynthGenoSanitizePluginMelodyBankId(id || SE2_SYNTH_GENO_FILLER_LANE_DEFAULT_BANK);
}

export function se2SynthGenoNormalizePluginSoundSelection(
  partial: Partial<Se2SynthGenoPluginSoundSelection> & {
    accordBankId: string;
    melodyBankId: string;
    bassBankId: string;
  },
): Se2SynthGenoPluginSoundSelection {
  return {
    accordBankId: se2SynthGenoSanitizeChordPianoBankId(partial.accordBankId),
    melodyBankId: se2SynthGenoSanitizePluginMelodyBankId(partial.melodyBankId),
    bassBankId: se2SynthGenoSanitizeSoundBankId('bass', partial.bassBankId),
    fillerBankId: se2SynthGenoSanitizePluginFillerBankId(
      partial.fillerBankId ?? SE2_SYNTH_GENO_FILLER_LANE_DEFAULT_BANK,
    ),
  };
}



export function se2SynthGenoDefaultBankId(category: Se2SynthGenoSoundBankCategory): string {

  switch (category) {

    case 'accord':

      return SE2_SYNTH_GENO_DEFAULT_SOUND_SELECTION.accordBankId;

    case 'melody':

      return SE2_SYNTH_GENO_DEFAULT_SOUND_SELECTION.melodyBankId;

    case 'bass':

      return SE2_SYNTH_GENO_DEFAULT_SOUND_SELECTION.bassBankId;

  }

}



export function se2SynthGenoSoundBankEntry(

  category: Se2SynthGenoSoundBankCategory,

  id: string,

): Se2SynthGenoSoundBankEntry | undefined {

  if (category === 'melody' && se2SynthGenoIsChordPianoBankId(id)) {
    const piano = bankById.get(id);
    if (piano && piano.category === 'accord') return piano;
  }

  const hit = bankById.get(id);

  if (hit && hit.category === category) return hit;

  return se2SynthGenoSoundBankEntries(category)[0];

}



export function se2SynthGenoSoundBankVoice(

  category: Se2SynthGenoSoundBankCategory,

  id: string,

): Se2SynthGenoVoiceParams {

  if (category === 'melody' && se2SynthGenoIsChordPianoBankId(id)) {
    const accord = se2SynthGenoSoundBankEntry('accord', id);
    if (accord) {
      return {
        ...accord.voice,
        role: 'keys',
        label: accord.label,
        gmInstrumentId: genoAccordGmInstrument(id),
      };
    }
  }

  const base = se2SynthGenoSoundBankEntry(category, id)?.voice ?? se2SynthGenoSoundBankEntries(category)[0]!.voice;

  if (category === 'accord') {

    return { ...base, role: 'keys', gmInstrumentId: genoAccordGmInstrument(id) };

  }

  return base;

}



export function se2SynthGenoSoundBankCategoryForStackRole(

  role: 'bass' | 'chords' | 'melody' | 'keys' | 'strings',

): Se2SynthGenoSoundBankCategory | null {

  if (role === 'bass') return 'bass';

  if (role === 'melody') return 'melody';

  if (role === 'chords' || role === 'keys') return 'accord';

  return null;

}



export function se2SynthGenoSoundBankCount(): number {

  return SE2_SYNTH_GENO_SOUND_BANK.length;

}

/** User filter morph on top of a lane sound preset (arp / bass / etc.). */
export type Se2SynthGenoLaneFilterMorph = {
  lowCutHz: number;
  highCutHz: number;
};

export function se2SynthGenoLaneFilterMorphDefaults(
  category: Se2SynthGenoSoundBankCategory,
  bankId: string,
): Se2SynthGenoLaneFilterMorph {
  const v = se2SynthGenoSoundBankVoice(category, bankId);
  return {
    lowCutHz: 90,
    highCutHz: Math.round(v.filterCutoffHz),
  };
}

export function se2SynthGenoSanitizeSoundBankId(
  category: Se2SynthGenoSoundBankCategory,
  id: string,
): string {
  return se2SynthGenoSoundBankEntry(category, id)?.id ?? se2SynthGenoDefaultBankId(category);
}


