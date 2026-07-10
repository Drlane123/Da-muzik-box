/** AI Vocal Lab tools — sub-nav under the Vocal Lab module (sidebar dropdown). */

export type VocalLabSubScreenId =
  | 'vocal-lab'
  | 'melody-transcription'
  | 'harmony-match';

export const VOCAL_LAB_SUB_SCREENS: {
  id: VocalLabSubScreenId;
  label: string;
  shortLabel: string;
}[] = [
  { id: 'vocal-lab', label: 'Vocal Lab', shortLabel: 'Vocal Lab' },
  { id: 'melody-transcription', label: 'Melody-to-MIDI', shortLabel: 'Melody-to-MIDI' },
  { id: 'harmony-match', label: 'Harmony Match', shortLabel: 'Harmony' },
];

export function isVocalLabScreen(screen: string): screen is VocalLabSubScreenId {
  return screen === 'vocal-lab' || screen === 'melody-transcription' || screen === 'harmony-match';
}

export function screenToVocalLabSubScreen(screen: string): VocalLabSubScreenId | null {
  return isVocalLabScreen(screen) ? screen : null;
}
