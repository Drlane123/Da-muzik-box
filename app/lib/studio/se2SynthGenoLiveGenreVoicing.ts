/**
 * Live Chord genre voicing + sound banks — leaf module (no ChordPlugin import).
 * Breaks LiveChordLibrary ↔ ChordPlugin cycle via GenreSoundBank.
 */
import type { GenoExtension, GenoPerfMode } from '@/app/lib/studio/se2SynthGenoChordEngine';
import type { GenoChordStyle } from '@/app/lib/studio/se2SynthGenoComposePrompt';
import type { Se2SynthGenoLiveGenreId } from '@/app/lib/studio/se2SynthGenoLiveChordTypes';
import {
  se2SynthGenoNormalizePluginSoundSelection,
  type Se2SynthGenoPluginSoundSelection,
} from '@/app/lib/studio/se2SynthGenoSoundBank';

export const GENRE_VOICING: Record<
  Se2SynthGenoLiveGenreId,
  {
    stylePreset: GenoChordStyle;
    extensions: GenoExtension[];
    inversion: number;
    perfMode: GenoPerfMode;
    soundSelection: Pick<Se2SynthGenoPluginSoundSelection, 'accordBankId' | 'melodyBankId' | 'bassBankId'> &
      Partial<Pick<Se2SynthGenoPluginSoundSelection, 'fillerBankId'>>;
  }
> = {
  trap: {
    stylePreset: 'trap',
    extensions: ['m7', '9'],
    inversion: 1,
    perfMode: 'block',
    soundSelection: { accordBankId: 'rhodes-lofi', melodyBankId: 'lead-silk', bassBankId: 'sub-808' },
  },
  'hip-hop': {
    stylePreset: 'dark',
    extensions: ['m7', 'M7', '9'],
    inversion: 1,
    perfMode: 'block',
    soundSelection: { accordBankId: 'rhodes-studio', melodyBankId: 'pluck-guitar', bassBankId: 'upright-bass' },
  },
  rnb: {
    stylePreset: 'rnb',
    extensions: ['M7', 'm7'],
    inversion: 0,
    perfMode: 'block',
    soundSelection: { accordBankId: 'rhodes-classic', melodyBankId: 'lead-silk', bassBankId: 'bass-guitar-finger' },
  },
  'rnb-pop': {
    stylePreset: 'rnb',
    extensions: ['M7', 'm7', '9', '11'],
    inversion: 0,
    perfMode: 'block',
    soundSelection: { accordBankId: 'rhodes-classic', melodyBankId: 'lead-silk', bassBankId: 'bass-guitar-finger' },
  },
  'dark-cinematic': {
    stylePreset: 'dark',
    extensions: ['M7', 'm7'],
    inversion: 1,
    perfMode: 'block',
    soundSelection: { accordBankId: 'piano-grand', melodyBankId: 'lead-soft', bassBankId: 'moog-low' },
  },
  drill: {
    stylePreset: 'trap',
    extensions: ['m7', '9'],
    inversion: 1,
    perfMode: 'block',
    soundSelection: { accordBankId: 'rhodes-lofi', melodyBankId: 'lead-silk', bassBankId: 'sub-808' },
  },
  lofi: {
    stylePreset: 'minor',
    extensions: ['m7', 'M7', '9'],
    inversion: 1,
    perfMode: 'block',
    soundSelection: { accordBankId: 'rhodes-lofi', melodyBankId: 'lead-soft', bassBankId: 'upright-bass' },
  },
  'neo-soul': {
    stylePreset: 'rnb',
    extensions: ['M7', 'm7', '9'],
    inversion: 2,
    perfMode: 'block',
    soundSelection: { accordBankId: 'rhodes-classic', melodyBankId: 'lead-silk', bassBankId: 'bass-guitar-finger' },
  },
  pop: {
    stylePreset: 'rnb',
    extensions: ['M7', 'm7', '9'],
    inversion: 0,
    perfMode: 'block',
    soundSelection: { accordBankId: 'rhodes-classic', melodyBankId: 'lead-silk', bassBankId: 'bass-guitar-finger' },
  },
  gospel: {
    stylePreset: 'gospel',
    extensions: ['M7', '9', '6'],
    inversion: 1,
    perfMode: 'block',
    soundSelection: { accordBankId: 'piano-gospel', melodyBankId: 'lead-silk', bassBankId: 'bass-guitar-finger' },
  },
  afrobeats: {
    stylePreset: 'rnb',
    extensions: ['M7', 'm7', '9'],
    inversion: 0,
    perfMode: 'block',
    soundSelection: { accordBankId: 'rhodes-classic', melodyBankId: 'lead-silk', bassBankId: 'bass-guitar-finger' },
  },
  'latin-trap': {
    stylePreset: 'trap',
    extensions: ['m7', '9'],
    inversion: 1,
    perfMode: 'block',
    soundSelection: { accordBankId: 'rhodes-lofi', melodyBankId: 'lead-silk', bassBankId: 'sub-808' },
  },
  'house-dance': {
    stylePreset: 'dance',
    extensions: ['M7', '9', '6'],
    inversion: 0,
    perfMode: 'block',
    soundSelection: { accordBankId: 'rhodes-bright', melodyBankId: 'lead-hook', bassBankId: 'bass-guitar-pick' },
  },
  'jersey-bounce': {
    stylePreset: 'trap',
    extensions: ['m7', '9'],
    inversion: 1,
    perfMode: 'block',
    soundSelection: { accordBankId: 'rhodes-lofi', melodyBankId: 'lead-silk', bassBankId: 'sub-808' },
  },
  'boom-bap': {
    stylePreset: 'dark',
    extensions: ['m7', 'M7', '9'],
    inversion: 1,
    perfMode: 'block',
    soundSelection: { accordBankId: 'rhodes-studio', melodyBankId: 'pluck-guitar', bassBankId: 'upright-bass' },
  },
  'plug-rage': {
    stylePreset: 'trap',
    extensions: ['m7', '9'],
    inversion: 1,
    perfMode: 'block',
    soundSelection: { accordBankId: 'rhodes-lofi', melodyBankId: 'lead-silk', bassBankId: 'sub-808' },
  },
  'lofi-cinematic': {
    stylePreset: 'minor',
    extensions: ['m7', 'M7'],
    inversion: 1,
    perfMode: 'block',
    soundSelection: { accordBankId: 'rhodes-lofi', melodyBankId: 'lead-soft', bassBankId: 'moog-low' },
  },
  jazz: {
    stylePreset: 'jazz',
    extensions: ['M7', 'm7', '9', '11'],
    inversion: 1,
    perfMode: 'block',
    soundSelection: {
      accordBankId: 'rhodes-classic',
      melodyBankId: 'lead-silk',
      bassBankId: 'bass-guitar-finger',
    },
  },
  'rich-jazz': {
    stylePreset: 'jazz',
    extensions: ['M7', 'm7', '9', '11', '13'],
    inversion: 1,
    perfMode: 'block',
    soundSelection: {
      accordBankId: 'rhodes-classic',
      melodyBankId: 'lead-silk',
      bassBankId: 'bass-guitar-finger',
    },
  },
  'deep-neo': {
    stylePreset: 'jazz',
    extensions: ['M7', 'm7', '9', '11', '13'],
    inversion: 2,
    perfMode: 'block',
    soundSelection: {
      accordBankId: 'rhodes-classic',
      melodyBankId: 'lead-silk',
      bassBankId: 'bass-guitar-finger',
    },
  },
  'guitar-lines': {
    stylePreset: 'rnb',
    extensions: ['M7', 'm7', '9', '6'],
    inversion: 0,
    perfMode: 'strum',
    soundSelection: {
      accordBankId: 'rhodes-classic',
      melodyBankId: 'pluck-guitar',
      bassBankId: 'bass-guitar-finger',
    },
  },
  kpop: {
    stylePreset: 'kpop',
    extensions: ['M7', 'm7', '9', '6'],
    inversion: 0,
    perfMode: 'block',
    soundSelection: {
      accordBankId: 'rhodes-classic',
      melodyBankId: 'lead-hook',
      bassBankId: 'sub-808',
    },
  },
};

/** Live Chord genre → accord / melody / bass banks (shared with Chord Generator). */
export function se2SynthGenoLiveGenreSoundSelection(
  genreId: Se2SynthGenoLiveGenreId,
): Se2SynthGenoPluginSoundSelection {
  const voicing = GENRE_VOICING[genreId];
  const base = voicing ? { ...voicing.soundSelection } : { ...GENRE_VOICING.rnb.soundSelection };
  return se2SynthGenoNormalizePluginSoundSelection(base);
}
