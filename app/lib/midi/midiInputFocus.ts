import type { ScreenId } from '@/app/components/NavigationSidebar';
import type { CreationSubScreenId } from '@/app/lib/creationStation/creationSubScreens';
import { creationSubScreenToTab } from '@/app/lib/creationStation/creationSubScreens';
import { MIDI_INPUT_ROUTES } from '@/app/lib/midi/midiInputBus';

/** Which MIDI route receives hardware notes for the current navigation state. */
export function resolveMidiInputRouteId(
  activeScreen: ScreenId,
  creationSubScreen: CreationSubScreenId,
): string | null {
  if (activeScreen === 'creation-station') {
    const tab = creationSubScreenToTab(creationSubScreen);
    if (tab === '808-lab') return MIDI_INPUT_ROUTES.lab808;
    if (tab === 'groove-lab') return MIDI_INPUT_ROUTES.grooveLab;
    if (tab === 'grid') return MIDI_INPUT_ROUTES.beatLab;
    return MIDI_INPUT_ROUTES.beatLab;
  }
  if (activeScreen === 'studio-editor-2') return MIDI_INPUT_ROUTES.studioEditor2;
  if (activeScreen === 'vocal-lab' || activeScreen === 'melody-transcription' || activeScreen === 'harmony-match') {
    return MIDI_INPUT_ROUTES.vocalLab;
  }
  if (activeScreen === 'master-arranger') return MIDI_INPUT_ROUTES.masterArranger;
  if (activeScreen === 'ai-pattern') return MIDI_INPUT_ROUTES.aiPattern;
  return null;
}
