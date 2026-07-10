/**
 * Chord Generator ↔ Live Chord — same genre-matched accord / melody / bass banks.
 */
import type { GenoChordStyle } from '@/app/lib/studio/se2SynthGenoComposePrompt';
import type { Se2SynthGenoEraCategoryId } from '@/app/lib/studio/se2SynthGenoEraProgressionLibrary';
import { se2SynthGenoLiveGenreSoundSelection } from '@/app/lib/studio/se2SynthGenoLiveGenreVoicing';
import type { Se2SynthGenoLiveGenreId } from '@/app/lib/studio/se2SynthGenoLiveChordTypes';
import type { Se2SynthGenoPluginSoundSelection } from '@/app/lib/studio/se2SynthGenoSoundBank';

const STYLE_TO_LIVE_GENRE: Record<GenoChordStyle, Se2SynthGenoLiveGenreId> = {
  pop: 'pop',
  rnb: 'rnb',
  gospel: 'gospel',
  trap: 'trap',
  dance: 'house-dance',
  disco: 'house-dance',
  dark: 'dark-cinematic',
  bright: 'pop',
  major: 'pop',
  minor: 'lofi',
  kpop: 'kpop',
  jazz: 'jazz',
  default: 'rnb',
};

const ERA_TO_LIVE_GENRE: Record<Se2SynthGenoEraCategoryId, Se2SynthGenoLiveGenreId> = {
  'soul-eras': 'rnb',
  'rnb-eras': 'rnb',
  'neo-soul-eras': 'neo-soul',
  'pop-eras': 'pop',
  'disco-eras': 'house-dance',
  'blues-eras': 'boom-bap',
  'latin-eras': 'afrobeats',
  'kpop-eras': 'kpop',
};

export function se2SynthGenoLiveGenreForChordStyle(
  style: GenoChordStyle,
): Se2SynthGenoLiveGenreId {
  return STYLE_TO_LIVE_GENRE[style] ?? 'rnb';
}

export function se2SynthGenoSoundSelectionForChordStyle(
  style: GenoChordStyle,
): Se2SynthGenoPluginSoundSelection {
  return se2SynthGenoLiveGenreSoundSelection(se2SynthGenoLiveGenreForChordStyle(style));
}

export function se2SynthGenoSoundSelectionForEraCategory(
  categoryId: Se2SynthGenoEraCategoryId,
): Se2SynthGenoPluginSoundSelection {
  return se2SynthGenoLiveGenreSoundSelection(ERA_TO_LIVE_GENRE[categoryId] ?? 'rnb');
}
