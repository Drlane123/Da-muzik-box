'use client';

import { useEffect, useRef } from 'react';
import { useMasterClock } from '@/app/context/MasterClockContext';
import { useSettings } from '@/app/context/SettingsContext';
import { applyAudioOutputSink } from '@/app/lib/audioRouting';

/**
 * Applies Settings → audio engine (sample rate, latency hint, output sink) on the shared AudioContext.
 */
export default function AudioDeviceBinder() {
  const { settings } = useSettings();
  const { getOrCreateAudioContext, audioCtxRef } = useMasterClock();
  const engineKeyRef = useRef('');

  useEffect(() => {
    const sinkId = settings.audioOutput ?? 'default';
    const engineKey = `${settings.audioSampleRate}|${settings.audioLatencyHint}|${sinkId}`;
    const prevKey = engineKeyRef.current;
    const engineChanged =
      prevKey.length > 0 &&
      prevKey !== engineKey &&
      (prevKey.split('|')[0] !== String(settings.audioSampleRate) ||
        prevKey.split('|')[1] !== settings.audioLatencyHint);

    if (engineChanged) {
      const prev = audioCtxRef.current;
      if (prev && prev.state !== 'closed') {
        void prev.close().catch(() => {});
      }
      audioCtxRef.current = null;
      (window as unknown as { __daMusicAudioCtx?: AudioContext }).__daMusicAudioCtx = undefined;
      (window as unknown as { __daMusicMasterGain?: GainNode | null }).__daMusicMasterGain =
        undefined;
      (window as unknown as { __daMusicMasterAnalyser?: AnalyserNode | null }).__daMusicMasterAnalyser =
        undefined;
    }

    const ctx = getOrCreateAudioContext();
    void applyAudioOutputSink(ctx, sinkId);
    engineKeyRef.current = engineKey;
  }, [
    settings.audioOutput,
    settings.audioSampleRate,
    settings.audioLatencyHint,
    getOrCreateAudioContext,
    audioCtxRef,
  ]);

  return null;
}
