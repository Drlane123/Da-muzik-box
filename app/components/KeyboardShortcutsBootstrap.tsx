'use client';

import { useEffect } from 'react';

import type { ScreenId } from '@/app/components/NavigationSidebar';
import { useMasterClock } from '@/app/context/MasterClockContext';
import { useSettings } from '@/app/context/SettingsContext';
import { isTypingTarget } from '@/app/lib/keyboardShortcuts';

const DMB_STUDIO_PRECOUNT_CANCEL = 'dmb-studio-precount-cancel';

/**
 * App-wide transport + file shortcuts. Per-screen editors (Beat Lab grid tools, SE2 piano roll, etc.)
 * register their own handlers when focused.
 */
export default function KeyboardShortcutsBootstrap({
  activeScreen,
  onOpenSettings,
}: {
  activeScreen: ScreenId;
  onOpenSettings: () => void;
}) {
  const { settings } = useSettings();
  const { transport, play, pause, stop } = useMasterClock();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!settings.keyboardShortcutsEnabled) return;
      if (isTypingTarget(e.target)) return;

      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const mod = isMac ? e.metaKey : e.ctrlKey;

      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('saveProject'));
        return;
      }

      if (mod && e.key === ',') {
        e.preventDefault();
        onOpenSettings();
        return;
      }

      if (e.code !== 'Space') return;

      // Creation Station and Studio Editor 2 own transport locally.
      if (
        activeScreen === 'creation-station' ||
        activeScreen === 'studio-editor-2'
      ) {
        return;
      }

      e.preventDefault();

      if (activeScreen === 'studio-editor') {
        if (transport === 'counting') {
          pause();
        } else if (transport === 'playing' || transport === 'recording') {
          window.dispatchEvent(new CustomEvent(DMB_STUDIO_PRECOUNT_CANCEL));
          stop();
        } else {
          window.dispatchEvent(new CustomEvent(DMB_STUDIO_PRECOUNT_CANCEL));
          play();
        }
        return;
      }

      if (transport === 'playing' || transport === 'recording') {
        stop();
      } else {
        play();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeScreen, onOpenSettings, pause, play, settings.keyboardShortcutsEnabled, stop, transport]);

  return null;
}
