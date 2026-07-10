import { useCallback, useRef, useState } from 'react';

import type { NeuralHumDetectedKey, NeuralHumKeyLockMode, NeuralHumScaleId } from '@/app/lib/vocalLab/neuralHumKeyLock';
import type { NeuralHumRollNote } from '@/app/lib/vocalLab/neuralHumMelodyRoll';
import type { TimedMonophonicNote } from '@/app/lib/studio/audioToMidiNotes';

export type NeuralHumRekeySnapshot = {
  keyRoot: number;
  keyLockMode: NeuralHumKeyLockMode;
  scaleId: NeuralHumScaleId;
  melodyNotes: TimedMonophonicNote[];
  melodyMeta: {
    rawNoteCount: number;
    keyLabel: string | null;
    detectedKey: NeuralHumDetectedKey | null;
    effectiveKeyRoot: number;
    effectiveScaleId: NeuralHumScaleId;
  } | null;
  rollNotes: NeuralHumRollNote[];
};

const MAX_STEPS = 48;

export function useNeuralHumRekeyHistory() {
  const undoRef = useRef<NeuralHumRekeySnapshot[]>([]);
  const redoRef = useRef<NeuralHumRekeySnapshot[]>([]);
  const [rev, setRev] = useState(0);

  const clear = useCallback(() => {
    undoRef.current = [];
    redoRef.current = [];
    setRev((n) => n + 1);
  }, []);

  const pushBefore = useCallback((snap: NeuralHumRekeySnapshot) => {
    undoRef.current.push(snap);
    if (undoRef.current.length > MAX_STEPS) undoRef.current.shift();
    redoRef.current = [];
    setRev((n) => n + 1);
  }, []);

  const undo = useCallback((current: NeuralHumRekeySnapshot): NeuralHumRekeySnapshot | null => {
    if (undoRef.current.length === 0) return null;
    redoRef.current.push(current);
    const prev = undoRef.current.pop()!;
    setRev((n) => n + 1);
    return prev;
  }, []);

  const redo = useCallback((current: NeuralHumRekeySnapshot): NeuralHumRekeySnapshot | null => {
    if (redoRef.current.length === 0) return null;
    undoRef.current.push(current);
    const next = redoRef.current.pop()!;
    setRev((n) => n + 1);
    return next;
  }, []);

  const undoLen = undoRef.current.length;
  const redoLen = redoRef.current.length;

  return {
    pushBefore,
    undo,
    redo,
    clear,
    canUndo: undoLen > 0,
    canRedo: redoLen > 0,
    rev,
  };
}
