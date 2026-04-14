'use client';

import { useEffect } from 'react';
import { useMasterClock } from '@/app/context/MasterClockContext';
import { useSettings } from '@/app/context/SettingsContext';
import { applyAudioOutputSink } from '@/app/lib/audioRouting';

/**
 * Applies Settings → audioOutput to the shared AudioContext (master bus unchanged).
 */
export default function AudioSinkBinder() {
  const { settings } = useSettings();
  const { getOrCreateAudioContext } = useMasterClock();

  useEffect(() => {
    const sinkId = settings.audioOutput ?? 'default';
    const ctx = getOrCreateAudioContext();
    void applyAudioOutputSink(ctx, sinkId);
  }, [settings.audioOutput, getOrCreateAudioContext]);

  return null;
}
