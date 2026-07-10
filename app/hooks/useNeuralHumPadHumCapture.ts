import { useCallback, useEffect, useRef } from 'react';

import type { NeuralHumLivePitch } from '@/app/hooks/useNeuralHumLivePitch';
import {
  enforceMonophonicHumNotes,
  snapMidiToNeuralHumScale,
  type NeuralHumKeyLockMode,
  type NeuralHumScaleId,
} from '@/app/lib/vocalLab/neuralHumKeyLock';
import type { TimedMonophonicNote } from '@/app/lib/studio/audioToMidiNotes';

const MIN_NOTE_SEC = 0.04;
const VOICE_CONF = 0.06;

/**
 * While recording: voice gate → timed notes.
 * Hold a pad to force pitch; otherwise snap live hum to key when key lock is on.
 */
export function useNeuralHumPadHumCapture(
  isRecording: boolean,
  live: NeuralHumLivePitch | null,
  armedPadMidi: number | null,
  keyLockMode: NeuralHumKeyLockMode,
  keyRoot: number,
  scaleId: NeuralHumScaleId,
) {
  const notesRef = useRef<TimedMonophonicNote[]>([]);
  const activeRef = useRef<{ startSec: number; pitch: number } | null>(null);
  const recordStartMsRef = useRef(0);
  const prevVoicedRef = useRef(false);
  const usedRef = useRef(false);

  useEffect(() => {
    if (!isRecording) return;
    notesRef.current = [];
    activeRef.current = null;
    prevVoicedRef.current = false;
    usedRef.current = false;
    recordStartMsRef.current = performance.now();
  }, [isRecording]);

  useEffect(() => {
    if (!isRecording) return;

    const voiced = live != null && live.confidence > VOICE_CONF;
    const nowSec = (performance.now() - recordStartMsRef.current) / 1000;
    const keyLockOn = keyLockMode !== 'off';

    let targetPitch: number | null = null;
    if (armedPadMidi != null) {
      targetPitch = Math.round(armedPadMidi);
    } else if (voiced && live) {
      targetPitch =
        keyLockOn
          ? snapMidiToNeuralHumScale(live.midi, keyRoot, scaleId)
          : Math.round(live.midi);
    }

    if (voiced && targetPitch != null) {
      if (!prevVoicedRef.current || !activeRef.current) {
        activeRef.current = { startSec: nowSec, pitch: targetPitch };
        if (armedPadMidi != null) usedRef.current = true;
      } else {
        activeRef.current.pitch = targetPitch;
        if (armedPadMidi != null) usedRef.current = true;
      }
    } else if (prevVoicedRef.current && activeRef.current) {
      const dur = Math.max(MIN_NOTE_SEC, nowSec - activeRef.current.startSec);
      notesRef.current.push({
        pitch: activeRef.current.pitch,
        startSec: activeRef.current.startSec,
        durationSec: dur,
        velocity: 100,
      });
      if (armedPadMidi != null) usedRef.current = true;
      activeRef.current = null;
    }

    prevVoicedRef.current = voiced;
  }, [armedPadMidi, isRecording, keyLockMode, keyRoot, live, scaleId]);

  const flushNotes = useCallback((): TimedMonophonicNote[] => {
    const out = [...notesRef.current];
    if (isRecording && activeRef.current) {
      const nowSec = (performance.now() - recordStartMsRef.current) / 1000;
      out.push({
        pitch: activeRef.current.pitch,
        startSec: activeRef.current.startSec,
        durationSec: Math.max(MIN_NOTE_SEC, nowSec - activeRef.current.startSec),
        velocity: 100,
      });
      activeRef.current = null;
    }
    notesRef.current = [];
    return enforceMonophonicHumNotes(out);
  }, [isRecording]);

  const wasUsed = useCallback(() => usedRef.current, []);

  const resetUsed = useCallback(() => {
    usedRef.current = false;
  }, []);

  return { flushNotes, wasUsed, resetUsed };
}
