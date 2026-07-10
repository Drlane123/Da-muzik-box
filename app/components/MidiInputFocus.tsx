'use client';

import { useEffect } from 'react';

import type { ScreenId } from '@/app/components/NavigationSidebar';
import type { CreationSubScreenId } from '@/app/lib/creationStation/creationSubScreens';
import { setActiveMidiInputRoute } from '@/app/lib/midi/midiInputBus';
import { resolveMidiInputRouteId } from '@/app/lib/midi/midiInputFocus';

type MidiInputFocusProps = {
  activeScreen: ScreenId;
  creationSubScreen: CreationSubScreenId;
  midiInputEnabled: boolean;
};

/** Keeps the active MIDI route in sync with sidebar navigation (like an armed track in a DAW). */
export default function MidiInputFocus({
  activeScreen,
  creationSubScreen,
  midiInputEnabled,
}: MidiInputFocusProps) {
  useEffect(() => {
    if (!midiInputEnabled) {
      setActiveMidiInputRoute(null);
      return;
    }
    setActiveMidiInputRoute(resolveMidiInputRouteId(activeScreen, creationSubScreen));
  }, [activeScreen, creationSubScreen, midiInputEnabled]);

  return null;
}
