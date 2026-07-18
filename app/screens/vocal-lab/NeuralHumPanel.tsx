import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Download, Lock, Pause, Play, Send, Volume2 } from 'lucide-react';

import { useMasterClock } from '@/app/context/MasterClockContext';
import { useNeuralHumLivePitch } from '@/app/hooks/useNeuralHumLivePitch';
import { useNeuralHumPadHumCapture } from '@/app/hooks/useNeuralHumPadHumCapture';
import {
  useNeuralHumRekeyHistory,
  type NeuralHumRekeySnapshot,
} from '@/app/hooks/useNeuralHumRekeyHistory';
import { useVocalCapture } from '@/app/hooks/useVocalCapture';
import VocalCapturePanel from '@/app/screens/vocal-lab/VocalCapturePanel';
import NeuralHumDrumPads from '@/app/screens/vocal-lab/NeuralHumDrumPads';
import NeuralHumMelodyRoll from '@/app/screens/vocal-lab/NeuralHumMelodyRoll';
import NeuralHumMiniKeyboard from '@/app/screens/vocal-lab/NeuralHumMiniKeyboard';
import NeuralHumPitchScope from '@/app/screens/vocal-lab/NeuralHumPitchScope';
import { NH_SCALE } from '@/app/lib/vocalLab/neuralHumTheme';
import {
  downloadNeuralHumMidiFile,
  timedNotesToStudioMidiNotes,
  type PendingNeuralHumStudioImport,
} from '@/app/lib/vocalLab/neuralHumStudioExport';
import type { PendingNeuralHumCreationImport } from '@/app/lib/vocalLab/neuralHumCreationExport';
import {
  NEURAL_HUM_KEY_NAMES,
  NEURAL_HUM_SCALES,
  detectNeuralHumKey,
  neuralHumKeyLabel,
  neuralHumScalePitchClasses,
  processNeuralHumMelody,
  retargetNeuralHumNotesToKeyRoot,
  snapMidiToNeuralHumScale,
  type NeuralHumKeyLockMode,
  type NeuralHumScaleId,
} from '@/app/lib/vocalLab/neuralHumKeyLock';
import {
  timedNotesToRollNotes,
  rollNotesToTimed,
  clearNeuralHumRollDraft,
  enforceMonophonicRollNotes,
  quantizeNeuralHumRollNotes,
  NEURAL_HUM_QUANTIZE_DEFAULT,
  type NeuralHumRollBarCount,
  type NeuralHumRollNote,
  type NeuralHumRollQuantize,
} from '@/app/lib/vocalLab/neuralHumMelodyRoll';
import {
  analyzeNeuralHumMelodyAsync,
  downloadNeuralHumWav,
  NEURAL_HUM_INSTRUMENTS,
  renderNeuralHumNotesToInstrument,
  transformNeuralHumToInstrument,
  type NeuralHumInstrumentId,
  type NeuralHumMelodyAnalysis,
  type NeuralHumTransformResult,
} from '@/app/lib/vocalLab/neuralHumToInstrument';
import { previewNeuralHumNote, scheduleNeuralHumRollAudition, stopNeuralHumPreview } from '@/app/lib/vocalLab/neuralHumPreview';
import type { TimedMonophonicNote } from '@/app/lib/studio/audioToMidiNotes';
import { BASIC_PITCH_DEFAULT_THRESHOLDS } from '@/app/lib/studio/basicPitchEngine';
import { BASIC_PITCH_DEFAULT_MIN_NOTE_SEC } from '@/app/lib/studio/basicPitchTranscribe';
import { VocalLabHelpTip } from '@/app/components/vocalLab/VocalLabHelpHub';

export type NeuralHumSe2LaneBinding = {
  /** Changes when lane / notes seed changes — re-hydrates melody roll. */
  trackKey: string;
  initialRollNotes: NeuralHumRollNote[];
  rollBars: NeuralHumRollBarCount;
  onRollBarsChange: (bars: NeuralHumRollBarCount) => void;
  instrumentId: NeuralHumInstrumentId;
  onInstrumentIdChange: (id: NeuralHumInstrumentId) => void;
  onRollNotesCommit: (notes: NeuralHumRollNote[]) => void;
  getPreviewDestination: (ctx: AudioContext) => AudioNode;
};

interface NeuralHumPanelProps {
  /** Notifies Vocal Lab when capture blob changes (Voice Swap, exports). */
  onCaptureBlobChange?: (blob: Blob | null) => void;
  onNeuralHumToStudio?: (payload: PendingNeuralHumStudioImport) => void;
  onNeuralHumToCreation?: (payload: PendingNeuralHumCreationImport) => void;
  /** Studio Editor 2 Hum Capture lane — hides Vocal Lab exports, syncs roll to track. */
  se2Lane?: NeuralHumSe2LaneBinding;
  disabled?: boolean;
}

type PlaybackMode = 'original' | 'instrument';

export default function NeuralHumPanel({
  onCaptureBlobChange,
  onNeuralHumToStudio,
  onNeuralHumToCreation,
  se2Lane,
  disabled = false,
}: NeuralHumPanelProps) {
  const { bpm, getOrCreateAudioContext } = useMasterClock();
  const capture = useVocalCapture(onCaptureBlobChange);
  const audioBlob = capture.blob;

  const [keyLockMode, setKeyLockMode] = useState<NeuralHumKeyLockMode>('auto');
  const [keyRoot, setKeyRoot] = useState(0);
  const [scaleId, setScaleId] = useState<NeuralHumScaleId>('major');
  const [melodyPreview, setMelodyPreview] = useState<NeuralHumMelodyAnalysis | null>(
    null,
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [rollBars, setRollBars] = useState<NeuralHumRollBarCount>(se2Lane?.rollBars ?? 8);
  const [rollNotes, setRollNotes] = useState<NeuralHumRollNote[]>([]);
  const [quantize, setQuantize] = useState<NeuralHumRollQuantize>(NEURAL_HUM_QUANTIZE_DEFAULT);
  /** Basic Pitch sensitivity — applied on next analyze / Re-run. */
  const [onsetThreshold, setOnsetThreshold] = useState(BASIC_PITCH_DEFAULT_THRESHOLDS.onsetThreshold);
  const [frameThreshold, setFrameThreshold] = useState(BASIC_PITCH_DEFAULT_THRESHOLDS.frameThreshold);
  /** Ghost-note filter in ms (default 50). */
  const [minNoteMs, setMinNoteMs] = useState(Math.round(BASIC_PITCH_DEFAULT_MIN_NOTE_SEC * 1000));
  const [analyzeNonce, setAnalyzeNonce] = useState(0);

  const [selected, setSelected] = useState<NeuralHumInstrumentId>(se2Lane?.instrumentId ?? 'piano');
  const [keyboardOctave, setKeyboardOctave] = useState(4);
  const [armedPadMidi, setArmedPadMidi] = useState<number | null>(null);
  const [pressedMidi, setPressedMidi] = useState<number | null>(null);
  const [transpose, setTranspose] = useState(0);
  const [dynamics, setDynamics] = useState(85);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isTransforming, setIsTransforming] = useState(false);
  const [result, setResult] = useState<NeuralHumTransformResult | null>(null);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('instrument');
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(75);
  const [meterLevel, setMeterLevel] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const originalUrlRef = useRef<string | null>(null);
  const instrumentUrlRef = useRef<string | null>(null);
  const meterRafRef = useRef<number | null>(null);
  const transformGenRef = useRef(0);
  const previewGainRef = useRef<GainNode | null>(null);
  /** Pad + voice gate notes captured during the last recording take. */
  const padCapturedNotesRef = useRef<TimedMonophonicNote[] | null>(null);
  const padCaptureUsedRef = useRef(false);
  /** Raw pitch-tracked notes — stable source for pad re-keying. */
  const rawMelodyNotesRef = useRef<TimedMonophonicNote[] | null>(null);
  /** Key root when raw notes were captured (auto-detect anchor). */
  const keyAnchorRootRef = useRef(0);
  const stopAuditionRef = useRef<(() => void) | null>(null);
  /** After Clear all — do not refill roll from cached analyze until a new recording. */
  const skipAutoFillRef = useRef(false);
  const rollUserEditedRef = useRef(false);
  const se2CommitRef = useRef<NeuralHumSe2LaneBinding['onRollNotesCommit'] | undefined>(undefined);
  se2CommitRef.current = se2Lane?.onRollNotesCommit;
  const decodeOptsRef = useRef({
    onsetThreshold,
    frameThreshold,
    minNoteSec: minNoteMs / 1000,
  });
  decodeOptsRef.current = {
    onsetThreshold,
    frameThreshold,
    minNoteSec: minNoteMs / 1000,
  };

  useEffect(() => {
    if (se2Lane) return;
    clearNeuralHumRollDraft();
    setRollNotes([]);
    setMelodyPreview(null);
    setResult(null);
  }, [se2Lane]);

  useEffect(() => {
    if (!se2Lane) return;
    setRollBars(se2Lane.rollBars);
    setSelected(se2Lane.instrumentId);
    setRollNotes(enforceMonophonicRollNotes(se2Lane.initialRollNotes));
    rollUserEditedRef.current = false;
    skipAutoFillRef.current = false;
  }, [se2Lane?.trackKey, se2Lane]);

  const keyLockSettings = useMemo(
    () => ({ mode: keyLockMode, keyRoot, scaleId }),
    [keyLockMode, keyRoot, scaleId],
  );
  const keyLockSettingsRef = useRef(keyLockSettings);
  keyLockSettingsRef.current = keyLockSettings;

  const { live, trail, clearTrail } = useNeuralHumLivePitch(capture.isRecording, capture.captureStream);

  const padCapture = useNeuralHumPadHumCapture(
    capture.isRecording,
    live,
    armedPadMidi,
    keyLockMode,
    keyRoot,
    scaleId,
  );

  const rekeyHistory = useNeuralHumRekeyHistory();
  const {
    pushBefore: pushRekeyHistory,
    undo: undoRekeyHistory,
    redo: redoRekeyHistory,
    clear: clearRekeyHistory,
    canUndo: canUndoRekey,
    canRedo: canRedoRekey,
    rev: rekeyHistoryRev,
  } = rekeyHistory;
  void rekeyHistoryRev;

  const effectiveKeyRoot = melodyPreview?.effectiveKeyRoot ?? keyRoot;
  const effectiveScaleId = melodyPreview?.effectiveScaleId ?? scaleId;
  const scopeScalePcs =
    keyLockMode === 'off' ? [] : neuralHumScalePitchClasses(effectiveKeyRoot, effectiveScaleId);

  const scopeKeyLabel =
    keyLockMode === 'off'
      ? null
      : melodyPreview?.keyLabel ?? neuralHumKeyLabel(keyRoot, scaleId);

  const liveScopeMidi =
    armedPadMidi ??
    (live && keyLockMode !== 'off'
      ? snapMidiToNeuralHumScale(live.midi, effectiveKeyRoot, effectiveScaleId)
      : live?.midi ?? null);
  const liveScopePc =
    liveScopeMidi != null ? ((Math.round(liveScopeMidi) % 12) + 12) % 12 : live?.pitchClass ?? null;

  const keyboardLiveMidi = liveScopeMidi != null ? Math.round(liveScopeMidi) : null;

  const melodyMidis = useMemo(() => {
    const timed = rollNotesToTimed(rollNotes, bpm);
    const s = new Set<number>();
    for (const n of timed) {
      s.add(Math.round(n.pitch) + transpose);
    }
    return s;
  }, [bpm, rollNotes, transpose]);

  useEffect(() => {
    if (capture.isRecording) {
      padCapturedNotesRef.current = null;
      padCaptureUsedRef.current = false;
      padCapture.resetUsed();
      return;
    }
    const notes = padCapture.flushNotes();
    if (notes.length > 0 && padCapture.wasUsed()) {
      padCapturedNotesRef.current = notes;
      padCaptureUsedRef.current = true;
    }
  }, [capture.isRecording, padCapture]);

  const getPreviewDestination = useCallback(() => {
    const ctx = getOrCreateAudioContext();
    if (se2Lane) {
      const dest = se2Lane.getPreviewDestination(ctx);
      if (dest instanceof GainNode) {
        dest.gain.value = volume / 100;
      }
      return dest;
    }
    if (!previewGainRef.current || previewGainRef.current.context !== ctx) {
      previewGainRef.current = ctx.createGain();
      previewGainRef.current.connect(ctx.destination);
    }
    previewGainRef.current.gain.value = volume / 100;
    return previewGainRef.current;
  }, [getOrCreateAudioContext, se2Lane, volume]);

  const handleKeyboardNoteDown = useCallback(
    (midi: number) => {
      setPressedMidi(midi);
      const ctx = getOrCreateAudioContext();
      if (ctx.state === 'suspended') void ctx.resume();
      previewNeuralHumNote(ctx, getPreviewDestination(), selected, midi, dynamics / 127);
    },
    [dynamics, getOrCreateAudioContext, getPreviewDestination, selected],
  );

  const handleKeyboardNoteUp = useCallback(() => {
    setPressedMidi(null);
    stopNeuralHumPreview();
  }, []);

  const revokeUrl = (url: string | null) => {
    if (url) URL.revokeObjectURL(url);
  };

  useEffect(() => {
    revokeUrl(originalUrlRef.current);
    originalUrlRef.current = audioBlob && audioBlob.size > 0 ? URL.createObjectURL(audioBlob) : null;
    setResult(null);
    setError(null);
    setProgress(0);
    setStage('');
    setIsPlaying(false);
    setMelodyPreview(null);
  }, [audioBlob]);

  useEffect(() => {
    return () => {
      revokeUrl(originalUrlRef.current);
      revokeUrl(instrumentUrlRef.current);
      if (meterRafRef.current != null) cancelAnimationFrame(meterRafRef.current);
    };
  }, []);

  /** Auto-analyze melody + detect key when capture finishes (Dubler-style). */
  useEffect(() => {
    if (!audioBlob || audioBlob.size === 0) {
      setMelodyPreview(null);
      setIsAnalyzing(false);
      return;
    }

    if (skipAutoFillRef.current) {
      setMelodyPreview(null);
      setRollNotes([]);
      setIsAnalyzing(false);
      return;
    }

    let cancelled = false;
    setIsAnalyzing(true);
    setProgress(4);

    void (async () => {
      try {
        const ctx = getOrCreateAudioContext();
        const bytes = await audioBlob.arrayBuffer();
        const buffer = await ctx.decodeAudioData(bytes.slice(0));
        if (cancelled) return;

        const padNotes = padCapturedNotesRef.current;
        const usePadCapture = padCaptureUsedRef.current && padNotes != null && padNotes.length > 0;

        if (skipAutoFillRef.current) return;

        clearRekeyHistory();

        if (usePadCapture) {
          if (skipAutoFillRef.current) return;
          rawMelodyNotesRef.current = padNotes;
          const processed = processNeuralHumMelody(padNotes, keyLockSettingsRef.current);
          keyAnchorRootRef.current = processed.effectiveKeyRoot;
          const lock = keyLockSettingsRef.current;
          setMelodyPreview({
            notes: processed.notes,
            rawNotes: padNotes,
            rawNoteCount: padNotes.length,
            keyLabel:
              lock.mode === 'off'
                ? null
                : neuralHumKeyLabel(processed.effectiveKeyRoot, processed.effectiveScaleId),
            detectedKey: processed.detectedKey,
            effectiveKeyRoot: processed.effectiveKeyRoot,
            effectiveScaleId: processed.effectiveScaleId,
            engine: 'acf',
          });
          setProgress(100);
        } else {
          const analyzed = await analyzeNeuralHumMelodyAsync(
            buffer,
            keyLockSettingsRef.current,
            undefined,
            (pct, _message) => {
              if (!cancelled) setProgress(Math.max(4, Math.round(pct * 100)));
            },
            decodeOptsRef.current,
          );
          if (cancelled) return;
          if (skipAutoFillRef.current) return;
          rawMelodyNotesRef.current = analyzed.rawNotes;
          keyAnchorRootRef.current = analyzed.effectiveKeyRoot;
          setMelodyPreview(analyzed);
          if (keyLockSettingsRef.current.mode === 'auto' && analyzed.detectedKey) {
            setKeyRoot(analyzed.effectiveKeyRoot);
            setScaleId(analyzed.effectiveScaleId);
          }
          setProgress(100);
        }
      } catch {
        if (!cancelled) setMelodyPreview(null);
      } finally {
        if (!cancelled) {
          setIsAnalyzing(false);
          window.setTimeout(() => {
            if (!cancelled) setProgress(0);
          }, 600);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [analyzeNonce, audioBlob, clearRekeyHistory, getOrCreateAudioContext]);

  /** Map analyzed MIDI → quantized roll grid (BPM + quantize). */
  useEffect(() => {
    if (skipAutoFillRef.current || !melodyPreview?.notes.length) return;
    if (rollUserEditedRef.current) {
      setRollNotes((prev) => quantizeNeuralHumRollNotes(prev, quantize, rollBars));
      return;
    }
    const mapped = timedNotesToRollNotes(melodyPreview.notes, bpm, rollBars, quantize);
    setRollNotes(mapped);
    // Push onto SE2 piano roll / timeline as soon as auto-analyze fills the melody roll.
    se2CommitRef.current?.(enforceMonophonicRollNotes(mapped));
  }, [bpm, melodyPreview, quantize, rollBars]);

  useEffect(() => {
    if (!audioBlob || audioBlob.size === 0) {
      setRollNotes([]);
    }
  }, [audioBlob]);

  const handleStartRecord = useCallback(() => {
    skipAutoFillRef.current = false;
    rollUserEditedRef.current = false;
    clearTrail();
    setMelodyPreview(null);
    setRollNotes([]);
    setArmedPadMidi(null);
    clearRekeyHistory();
    setResult(null);
    void capture.startRecord();
  }, [capture, clearRekeyHistory, clearTrail]);

  const handleRollNotesChange = useCallback(
    (notes: NeuralHumRollNote[]) => {
      rollUserEditedRef.current = true;
      const mono = enforceMonophonicRollNotes(notes);
      setRollNotes(mono);
      se2Lane?.onRollNotesCommit(mono);
    },
    [se2Lane],
  );

  const handleQuantizeNow = useCallback(() => {
    if (rollNotes.length === 0) return;
    rollUserEditedRef.current = true;
    const snapped = quantizeNeuralHumRollNotes(rollNotes, quantize, rollBars);
    setRollNotes(snapped);
    se2CommitRef.current?.(snapped);
  }, [quantize, rollBars, rollNotes]);

  const handleRerunBasicPitch = useCallback(() => {
    if (!audioBlob || audioBlob.size === 0 || isAnalyzing) return;
    skipAutoFillRef.current = false;
    rollUserEditedRef.current = false;
    // Prefer Basic Pitch path (ignore pad-locked notes from the take).
    padCaptureUsedRef.current = false;
    setResult(null);
    setAnalyzeNonce((n) => n + 1);
  }, [audioBlob, isAnalyzing]);

  const auditionMelodyNotes = useCallback(
    (notes: TimedMonophonicNote[]) => {
      if (notes.length === 0) return;
      stopAuditionRef.current?.();
      stopNeuralHumPreview();
      const ctx = getOrCreateAudioContext();
      if (ctx.state === 'suspended') void ctx.resume();
      stopAuditionRef.current = scheduleNeuralHumRollAudition(
        ctx,
        getPreviewDestination(),
        selected,
        notes,
        { dynamics: dynamics / 127, transposeSemis: transpose },
      );
    },
    [dynamics, getOrCreateAudioContext, getPreviewDestination, selected, transpose],
  );

  const buildRekeySnapshot = useCallback((): NeuralHumRekeySnapshot => {
    return {
      keyRoot,
      keyLockMode,
      scaleId,
      melodyNotes: melodyPreview?.notes ? [...melodyPreview.notes] : [],
      melodyMeta: melodyPreview
        ? {
            rawNoteCount: melodyPreview.rawNoteCount,
            keyLabel: melodyPreview.keyLabel,
            detectedKey: melodyPreview.detectedKey,
            effectiveKeyRoot: melodyPreview.effectiveKeyRoot,
            effectiveScaleId: melodyPreview.effectiveScaleId,
          }
        : null,
      rollNotes: [...rollNotes],
    };
  }, [keyLockMode, keyRoot, melodyPreview, rollNotes, scaleId]);

  const applyRekeySnapshot = useCallback(
    (snap: NeuralHumRekeySnapshot) => {
      setKeyRoot(snap.keyRoot);
      setKeyLockMode(snap.keyLockMode);
      setScaleId(snap.scaleId);
      if (snap.melodyMeta && snap.melodyNotes.length > 0) {
        setMelodyPreview({
          notes: snap.melodyNotes,
          rawNotes: snap.melodyNotes,
          rawNoteCount: snap.melodyMeta.rawNoteCount,
          keyLabel: snap.melodyMeta.keyLabel,
          detectedKey: snap.melodyMeta.detectedKey,
          effectiveKeyRoot: snap.melodyMeta.effectiveKeyRoot,
          effectiveScaleId: snap.melodyMeta.effectiveScaleId,
        });
      } else {
        setMelodyPreview(null);
      }
      rollUserEditedRef.current = false;
      const restoredRoll =
        snap.rollNotes.length > 0
          ? snap.rollNotes
          : snap.melodyNotes.length > 0
            ? timedNotesToRollNotes(snap.melodyNotes, bpm, rollBars, quantize)
            : [];
      setRollNotes(restoredRoll);
      setResult(null);
      if (snap.melodyNotes.length > 0) auditionMelodyNotes(snap.melodyNotes);
    },
    [auditionMelodyNotes, bpm, quantize, rollBars],
  );

  /** Tap pad → Set mode + new root, re-key captured melody from anchor, audition. */
  const applyKeyRootFromPad = useCallback(
    (pc: number) => {
      let source = rawMelodyNotesRef.current;
      let anchor = keyAnchorRootRef.current;

      if (!source?.length) {
        const fromRoll = rollNotes.length > 0 ? rollNotesToTimed(rollNotes, bpm) : null;
        const fromPreview =
          melodyPreview?.notes?.length ? melodyPreview.notes : null;
        const fallback = fromRoll ?? fromPreview;
        if (fallback?.length) {
          source = [...fallback];
          rawMelodyNotesRef.current = source;
          anchor = effectiveKeyRoot;
          keyAnchorRootRef.current = anchor;
        }
      }

      if (!source?.length) {
        setKeyLockMode('set');
        setKeyRoot(pc);
        setResult(null);
        return;
      }

      const currentPc = ((effectiveKeyRoot % 12) + 12) % 12;
      if (pc === currentPc && keyLockMode === 'set') {
        const rekeyed = retargetNeuralHumNotesToKeyRoot(source, anchor, pc, scaleId);
        auditionMelodyNotes(rekeyed);
        return;
      }

      pushRekeyHistory(buildRekeySnapshot());

      setKeyLockMode('set');
      setKeyRoot(pc);
      setResult(null);

      const rekeyed = retargetNeuralHumNotesToKeyRoot(source, anchor, pc, scaleId);
      const label = neuralHumKeyLabel(pc, scaleId);
      const nextRoll = timedNotesToRollNotes(rekeyed, bpm, rollBars, quantize);

      setMelodyPreview({
        notes: rekeyed,
        rawNoteCount: source.length,
        keyLabel: label,
        detectedKey: null,
        effectiveKeyRoot: pc,
        effectiveScaleId: scaleId,
      });
      rollUserEditedRef.current = false;
      setRollNotes(nextRoll);
      auditionMelodyNotes(rekeyed);
    },
    [
      auditionMelodyNotes,
      bpm,
      buildRekeySnapshot,
      effectiveKeyRoot,
      keyLockMode,
      melodyPreview,
      quantize,
      pushRekeyHistory,
      rollBars,
      rollNotes,
      scaleId,
    ],
  );

  const handleUndoRekey = useCallback(() => {
    const prev = undoRekeyHistory(buildRekeySnapshot());
    if (prev) applyRekeySnapshot(prev);
  }, [applyRekeySnapshot, buildRekeySnapshot, undoRekeyHistory]);

  const handleRedoRekey = useCallback(() => {
    const next = redoRekeyHistory(buildRekeySnapshot());
    if (next) applyRekeySnapshot(next);
  }, [applyRekeySnapshot, buildRekeySnapshot, redoRekeyHistory]);

  const handlePadDown = useCallback(
    ({ midi, pc, velocity01 }: { midi: number; pc: number; velocity01: number }) => {
      if (!capture.isRecording) {
        applyKeyRootFromPad(pc);
      } else if (keyLockMode === 'set') {
        setKeyRoot(pc);
      }
      setArmedPadMidi(midi);
      const ctx = getOrCreateAudioContext();
      if (ctx.state === 'suspended') void ctx.resume();
      previewNeuralHumNote(
        ctx,
        getPreviewDestination(),
        selected,
        midi,
        (dynamics / 127) * velocity01,
      );
    },
    [
      applyKeyRootFromPad,
      capture.isRecording,
      dynamics,
      getOrCreateAudioContext,
      getPreviewDestination,
      keyLockMode,
      selected,
    ],
  );

  const handlePadUp = useCallback(() => {
    setArmedPadMidi(null);
  }, []);

  const lockKeyFromRoll = useCallback(() => {
    const timed = rollNotesToTimed(rollNotes, bpm);
    if (timed.length === 0) return;
    pushRekeyHistory(buildRekeySnapshot());
    const detected = detectNeuralHumKey(timed, scaleId);
    if (!detected) return;
    rawMelodyNotesRef.current = timed;
    keyAnchorRootRef.current = detected.keyRoot;
    setKeyRoot(detected.keyRoot);
    setScaleId(detected.scaleId);
    setKeyLockMode('set');
    setResult(null);
    const rekeyed = retargetNeuralHumNotesToKeyRoot(timed, detected.keyRoot, detected.keyRoot, scaleId);
    setMelodyPreview({
      notes: rekeyed,
      rawNoteCount: timed.length,
      keyLabel: neuralHumKeyLabel(detected.keyRoot, detected.scaleId),
      detectedKey: detected,
      effectiveKeyRoot: detected.keyRoot,
      effectiveScaleId: detected.scaleId,
    });
    rollUserEditedRef.current = false;
  }, [bpm, buildRekeySnapshot, pushRekeyHistory, rollNotes, scaleId]);

  const handleClearAllMelody = useCallback(() => {
    skipAutoFillRef.current = true;
    rollUserEditedRef.current = false;
    setRollNotes([]);
    setArmedPadMidi(null);
    rawMelodyNotesRef.current = null;
    keyAnchorRootRef.current = 0;
    clearRekeyHistory();
    stopAuditionRef.current?.();
    stopAuditionRef.current = null;
    setMelodyPreview(null);
    setResult(null);
    setError(null);
    setProgress(0);
    setStage('');
    clearNeuralHumRollDraft();
  }, [clearRekeyHistory]);

  const stopMeter = useCallback(() => {
    if (meterRafRef.current != null) {
      cancelAnimationFrame(meterRafRef.current);
      meterRafRef.current = null;
    }
    setMeterLevel(0);
  }, []);

  const startMeter = useCallback(() => {
    stopMeter();
    const tick = () => {
      const el = audioRef.current;
      if (el && !el.paused && el.duration > 0) {
        setMeterLevel(Math.min(100, (el.currentTime / el.duration) * 100 + Math.random() * 8));
      }
      meterRafRef.current = requestAnimationFrame(tick);
    };
    meterRafRef.current = requestAnimationFrame(tick);
  }, [stopMeter]);

  const pausePlayback = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
    stopMeter();
  }, [stopMeter]);

  const playUrl = useCallback(
    (url: string | null) => {
      if (!url) return;
      const el = audioRef.current;
      if (!el) return;
      pausePlayback();
      el.src = url;
      el.volume = volume / 100;
      void el
        .play()
        .then(() => {
          setIsPlaying(true);
          startMeter();
        })
        .catch(() => setIsPlaying(false));
    },
    [pausePlayback, startMeter, volume],
  );

  const handlePlayPause = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;

    if (isPlaying) {
      pausePlayback();
      return;
    }

    if (playbackMode === 'original') {
      playUrl(originalUrlRef.current);
    } else {
      playUrl(instrumentUrlRef.current);
    }
  }, [isPlaying, pausePlayback, playUrl, playbackMode]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume / 100;
  }, [volume]);

  const handleTransform = useCallback(async () => {
    const rollTimed = rollNotesToTimed(rollNotes, bpm);
    const useRoll = rollTimed.length >= 3;
    if (!selected || (!useRoll && (!audioBlob || audioBlob.size === 0))) return;

    const gen = transformGenRef.current + 1;
    transformGenRef.current = gen;
    setIsTransforming(true);
    setError(null);
    setResult(null);
    setProgress(0);
    setStage('Starting…');
    pausePlayback();
    revokeUrl(instrumentUrlRef.current);
    instrumentUrlRef.current = null;

    try {
      const ctx = getOrCreateAudioContext();
      if (ctx.state === 'suspended') await ctx.resume();

      const out = useRoll
        ? await renderNeuralHumNotesToInstrument(
            ctx,
            rollTimed,
            {
              instrumentId: selected,
              transposeSemis: transpose,
              dynamics: dynamics / 100,
              keyLabel: melodyPreview?.keyLabel ?? null,
              detectedKey: melodyPreview?.detectedKey ?? null,
            },
            (p) => {
              if (transformGenRef.current !== gen) return;
              setProgress(p.progress);
              setStage(p.message);
            },
          )
        : await transformNeuralHumToInstrument(
            ctx,
            audioBlob!,
            {
              instrumentId: selected,
              transposeSemis: transpose,
              dynamics: dynamics / 100,
              keyLock: keyLockSettings,
            },
            (p) => {
              if (transformGenRef.current !== gen) return;
              setProgress(p.progress);
              setStage(p.message);
            },
          );

      if (transformGenRef.current !== gen) return;

      revokeUrl(instrumentUrlRef.current);
      instrumentUrlRef.current = URL.createObjectURL(out.wavBlob);
      setResult(out);
      setPlaybackMode('instrument');
    } catch (err) {
      if (transformGenRef.current !== gen) return;
      const msg = err instanceof Error ? err.message : 'Transformation failed.';
      setError(msg);
      setProgress(0);
      setStage('');
    } finally {
      if (transformGenRef.current === gen) setIsTransforming(false);
    }
  }, [
    audioBlob,
    bpm,
    dynamics,
    getOrCreateAudioContext,
    keyLockSettings,
    melodyPreview?.detectedKey,
    melodyPreview?.keyLabel,
    pausePlayback,
    rollNotes,
    selected,
    transpose,
  ]);

  const rollTimedNotes = useMemo(() => rollNotesToTimed(rollNotes, bpm), [rollNotes, bpm]);

  const hasAudio = Boolean(audioBlob && audioBlob.size > 0);
  const selectedMeta = selected ? NEURAL_HUM_INSTRUMENTS.find((i) => i.id === selected) : null;

  /** Edited roll is source of truth for export / render. */
  const exportMidiNotes: TimedMonophonicNote[] | null =
    rollTimedNotes.length > 0 ? rollTimedNotes : result?.notes ?? null;
  const hasExportMidi = rollTimedNotes.length > 0;
  const exportKeyLabel = result?.keyLabel ?? melodyPreview?.keyLabel ?? null;
  const exportMidiLabel = exportKeyLabel ?? selectedMeta?.label ?? 'hum-melody';

  const sendMidiToGrooveLab = useCallback(() => {
    if (!exportMidiNotes?.length || !onNeuralHumToCreation) return;
    onNeuralHumToCreation({
      target: 'groove-lab',
      notes: exportMidiNotes,
      bpm,
      quantize,
      transposeSemis: transpose,
      label: exportMidiLabel,
    });
  }, [bpm, exportMidiLabel, exportMidiNotes, onNeuralHumToCreation, quantize, transpose]);

  const sendMidiToNewSynth = useCallback(() => {
    if (!exportMidiNotes?.length || !onNeuralHumToCreation) return;
    onNeuralHumToCreation({
      target: 'new-synth',
      notes: exportMidiNotes,
      bpm,
      transposeSemis: transpose,
      label: exportMidiLabel,
    });
  }, [bpm, exportMidiLabel, exportMidiNotes, onNeuralHumToCreation, transpose]);

  const sendMidiToStudio = useCallback(() => {
    if (!exportMidiNotes?.length || !onNeuralHumToStudio) return;
    onNeuralHumToStudio({
      notes: timedNotesToStudioMidiNotes(exportMidiNotes, bpm, transpose),
      wavBlob: result?.wavBlob,
      trackName: exportMidiLabel,
    });
  }, [bpm, exportMidiLabel, exportMidiNotes, onNeuralHumToStudio, result?.wavBlob, transpose]);

  const downloadMidiFile = useCallback(() => {
    if (!exportMidiNotes?.length) return;
    downloadNeuralHumMidiFile(exportMidiNotes, bpm, exportMidiLabel, transpose);
  }, [bpm, exportMidiLabel, exportMidiNotes, transpose]);

  return (
    <div className={`flex flex-col gap-4 h-full ${disabled ? 'pointer-events-none opacity-55' : ''}`}>
      {!se2Lane ? (
        <div>
          <span className="text-sm font-bold uppercase tracking-widest inline-flex items-center gap-1.5" style={{ color: '#00E5FF' }}>
            Hum Capture
            <VocalLabHelpTip tab="hum-capture" title="Hum Capture — melody from your voice" />
          </span>
          <p className="text-xs mt-1" style={{ color: '#888' }}>
            Hum → Basic Pitch → melody roll (4/8 bars). Edit MIDI here, audition, then export or render.
          </p>
        </div>
      ) : null}

      <div
        className="rounded-lg p-3 flex flex-col gap-3"
        style={{ background: '#0d0d14', border: '1px solid #00E5FF22' }}
      >
        <div className="flex flex-wrap gap-4 items-start justify-between">
          <div className="flex-1 min-w-[200px]">
            <VocalCapturePanel
              title="Hum capture"
              accentColor="#00E5FF"
              showPreviewPlay={false}
              hasAudio={capture.hasAudio}
              isRecording={capture.isRecording}
              recordingTime={capture.recordingTime}
              onStartRecord={handleStartRecord}
              onStopRecord={capture.stopRecord}
              onDelete={capture.handleDelete}
              onUpload={capture.handleUpload}
              meterStream={capture.captureStream}
            />
          </div>
          <NeuralHumPitchScope
            scalePitchClasses={scopeScalePcs}
            livePitchClass={liveScopePc}
            liveMidi={liveScopeMidi}
            trail={trail}
            keyLabel={scopeKeyLabel}
            isRecording={capture.isRecording}
          />
        </div>

        <div
          className="rounded-md p-3 flex flex-col gap-2"
          style={{ background: '#0d0d14', border: '1px solid #222' }}
        >
          <div className="flex items-center gap-2">
            <Lock size={14} style={{ color: NH_SCALE.primary }} />
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: NH_SCALE.primary }}>
              Key lock
            </span>
            {isAnalyzing && (
              <span className="text-xs ml-auto" style={{ color: '#00E5FF' }}>
                Basic Pitch…
              </span>
            )}
            {melodyPreview && !isAnalyzing && rollNotes.length > 0 && (
              <span className="text-xs ml-auto font-bold" style={{ color: '#00ff88' }}>
                MIDI: {rollNotes.length} notes
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(['auto', 'set', 'manual', 'off'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setKeyLockMode(mode);
                  setResult(null);
                }}
                className="px-2.5 py-1 rounded text-xs font-bold capitalize"
                style={{
                  background: keyLockMode === mode ? NH_SCALE.bgTintStrong : '#121218',
                  color: keyLockMode === mode ? NH_SCALE.primary : '#666',
                  border: `1px solid ${keyLockMode === mode ? NH_SCALE.borderHi : '#1a1a24'}`,
                }}
              >
                {mode === 'auto' ? 'Auto detect' : mode === 'set' ? 'Set (pads)' : mode}
              </button>
            ))}
          </div>

          {keyLockMode !== 'off' && rollNotes.length > 0 && (
            <button
              type="button"
              onClick={lockKeyFromRoll}
              className="text-xs font-bold rounded px-2.5 py-1.5 w-full"
              style={{
                background: NH_SCALE.bgTint,
                color: NH_SCALE.primary,
                border: `1px solid ${NH_SCALE.borderHi}`,
              }}
            >
              Lock key from melody roll ({rollNotes.length} notes)
            </button>
          )}

          {keyLockMode !== 'off' && (
            <>
              {keyLockMode === 'manual' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs shrink-0" style={{ color: '#666' }}>
                    Root
                  </span>
                  <select
                    value={keyRoot}
                    onChange={(e) => {
                      setKeyRoot(Number(e.target.value));
                      setResult(null);
                    }}
                    className="text-xs rounded px-2 py-1 flex-1"
                    style={{ background: '#121218', color: '#ccc', border: '1px solid #333' }}
                  >
                    {NEURAL_HUM_KEY_NAMES.map((name, i) => (
                      <option key={name} value={i}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <select
                value={scaleId}
                onChange={(e) => {
                  setScaleId(e.target.value as NeuralHumScaleId);
                  setResult(null);
                }}
                className="text-xs rounded px-2 py-1.5 w-full"
                style={{ background: '#121218', color: '#ccc', border: '1px solid #333' }}
              >
                {NEURAL_HUM_SCALES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </>
          )}

          {keyLockMode === 'auto' && melodyPreview?.keyLabel && (
            <p className="text-xs" style={{ color: NH_SCALE.primary }}>
              Detected: {melodyPreview.keyLabel}
              {melodyPreview.notes.length > 0
                ? ' — tap any key pad to switch root (Set mode) and hear the melody re-keyed'
                : ''}
            </p>
          )}
          {keyLockMode === 'manual' && (
            <p className="text-xs" style={{ color: '#666' }}>
              Notes snap to {neuralHumKeyLabel(keyRoot, scaleId)}.
            </p>
          )}
          {keyLockMode === 'set' && (
            <p className="text-xs" style={{ color: NH_SCALE.primary }}>
              Key: {neuralHumKeyLabel(keyRoot, scaleId)} — tap pads to re-key &amp; audition · hold while recording to lock hum
            </p>
          )}
        </div>

        {!isAnalyzing && hasAudio && melodyPreview && melodyPreview.notes.length === 0 && (
          <p className="text-xs font-semibold" style={{ color: '#ffaa44' }}>
            No MIDI notes detected — raise Min note / Onset, hum longer, or turn Key Lock off.
          </p>
        )}

        {!capture.hasAudio && !capture.isRecording && rollNotes.length === 0 && (
          <p className="text-xs" style={{ color: '#666' }}>
            Hum into the mic — scope tracks pitch live. MIDI appears in the melody roll below.
          </p>
        )}

        {/* Basic Pitch cleanup — thresholds + ghost filter (apply via Re-run) */}
        <div
          className="rounded-md p-2.5 flex flex-col gap-2"
          style={{ background: '#0a1218', border: '1px solid #1a3a4a' }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wide" style={{ color: '#00E5FF' }}>
              Basic Pitch tune
            </span>
            <button
              type="button"
              onClick={handleRerunBasicPitch}
              disabled={!hasAudio || isAnalyzing}
              className="ml-auto px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide"
              style={{
                background: hasAudio && !isAnalyzing ? '#00E5FF22' : '#121218',
                color: hasAudio && !isAnalyzing ? '#00E5FF' : '#555',
                border: `1px solid ${hasAudio && !isAnalyzing ? '#00E5FF66' : '#333'}`,
              }}
              title="Re-run transcription with the slider settings below"
            >
              {isAnalyzing ? 'Running…' : 'Re-run'}
            </button>
          </div>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold flex justify-between" style={{ color: '#8ab' }}>
              Onset <span className="font-mono text-[#00E5FF]">{onsetThreshold.toFixed(2)}</span>
            </span>
            <input
              type="range"
              min={0.1}
              max={0.9}
              step={0.01}
              value={onsetThreshold}
              onChange={(e) => setOnsetThreshold(Number(e.target.value))}
              className="w-full accent-[#00E5FF]"
              title="Higher = fewer note starts (less breath / click noise)"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold flex justify-between" style={{ color: '#8ab' }}>
              Frame <span className="font-mono text-[#00E5FF]">{frameThreshold.toFixed(2)}</span>
            </span>
            <input
              type="range"
              min={0.1}
              max={0.9}
              step={0.01}
              value={frameThreshold}
              onChange={(e) => setFrameThreshold(Number(e.target.value))}
              className="w-full accent-[#00E5FF]"
              title="Higher = drop quieter / shorter held notes"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold flex justify-between" style={{ color: '#8ab' }}>
              Min note <span className="font-mono text-[#00E5FF]">{minNoteMs} ms</span>
            </span>
            <input
              type="range"
              min={20}
              max={200}
              step={5}
              value={minNoteMs}
              onChange={(e) => setMinNoteMs(Number(e.target.value))}
              className="w-full accent-[#00E5FF]"
              title="Delete ghost notes shorter than this (breath / mouth clicks)"
            />
          </label>
          <p className="text-[9px] leading-snug" style={{ color: '#567' }}>
            Adjust, then <strong style={{ color: '#8ab' }}>Re-run</strong>. Use <strong style={{ color: '#8ab' }}>Quantize</strong> on the roll to snap timing to the grid.
          </p>
        </div>
      </div>

      <div
        className="rounded-lg p-3 flex flex-col gap-2 shrink-0"
        style={{ background: '#0d0d14', border: `1px solid ${NH_SCALE.borderHi}`, minHeight: 280 }}
      >
        <NeuralHumMelodyRoll
          rollNotes={rollNotes}
          onRollNotesChange={handleRollNotesChange}
          onClearAll={handleClearAllMelody}
          canClearAll={rollNotes.length > 0 || melodyPreview != null || result != null}
          bars={rollBars}
          onBarsChange={(bars) => {
            setRollBars(bars);
            se2Lane?.onRollBarsChange(bars);
          }}
          bpm={bpm}
          quantize={quantize}
          onQuantizeChange={setQuantize}
          onQuantizeNow={handleQuantizeNow}
          instrumentId={selected}
          transpose={transpose}
          dynamics={dynamics}
          keyRoot={effectiveKeyRoot}
          scaleId={effectiveScaleId}
          keyLockOff={keyLockMode === 'off'}
          isAnalyzing={isAnalyzing}
          getAudioContext={getOrCreateAudioContext}
          getDestination={getPreviewDestination}
          onExportGroove={!se2Lane && onNeuralHumToCreation ? sendMidiToGrooveLab : undefined}
          onExportSynth={!se2Lane && onNeuralHumToCreation ? sendMidiToNewSynth : undefined}
          onExportStudio={!se2Lane && onNeuralHumToStudio ? sendMidiToStudio : undefined}
          onDownloadMidi={!se2Lane ? downloadMidiFile : undefined}
          showExport={!se2Lane && hasExportMidi}
        />
      </div>

      <div
        className="rounded-lg p-3 flex flex-col gap-3"
        style={{ background: '#0d0d14', border: '1px solid #222' }}
      >
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#888' }}>
            Instrument
          </span>
          <select
            value={selected}
            onChange={(e) => {
              const id = e.target.value as NeuralHumInstrumentId;
              setSelected(id);
              se2Lane?.onInstrumentIdChange(id);
              setResult(null);
              setError(null);
            }}
            className="text-sm rounded px-3 py-2 w-full font-semibold"
            style={{ background: '#121218', color: '#00E5FF', border: '1px solid #00E5FF44' }}
          >
            {NEURAL_HUM_INSTRUMENTS.map((inst) => (
              <option key={inst.id} value={inst.id}>
                {inst.emoji} {inst.label} — {inst.desc}
              </option>
            ))}
          </select>
        </div>

        <NeuralHumMiniKeyboard
          keyRoot={effectiveKeyRoot}
          scaleId={effectiveScaleId}
          keyLockMode={keyLockMode}
          keyLabel={scopeKeyLabel}
          octave={keyboardOctave}
          onOctaveChange={setKeyboardOctave}
          liveMidi={keyboardLiveMidi}
          melodyMidis={melodyMidis}
          pressedMidi={pressedMidi}
          onNoteDown={handleKeyboardNoteDown}
          onNoteUp={handleKeyboardNoteUp}
        />
      </div>

      <div
        className="rounded-lg p-3"
        style={{ background: '#0d0d14', border: '1px solid #222' }}
      >
        <NeuralHumDrumPads
          octave={keyboardOctave}
          onOctaveChange={setKeyboardOctave}
          keyRoot={effectiveKeyRoot}
          keyLockMode={keyLockMode}
          scalePitchClasses={scopeScalePcs}
          armedPadMidi={armedPadMidi}
          isRecording={capture.isRecording}
          canUndoRekey={canUndoRekey}
          canRedoRekey={canRedoRekey}
          onUndoRekey={handleUndoRekey}
          onRedoRekey={handleRedoRekey}
          onPadDown={handlePadDown}
          onPadUp={handlePadUp}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs" style={{ color: '#888' }}>
            <span>Transpose</span>
            <span style={{ color: '#00E5FF' }}>{transpose > 0 ? `+${transpose}` : transpose} st</span>
          </div>
          <input
            type="range"
            min={-12}
            max={12}
            value={transpose}
            onChange={(e) => {
              setTranspose(Number(e.target.value));
              setResult(null);
            }}
            style={{ accentColor: '#00E5FF', width: '100%' }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs" style={{ color: '#888' }}>
            <span>Expression</span>
            <span style={{ color: '#00E5FF' }}>{dynamics}%</span>
          </div>
          <input
            type="range"
            min={25}
            max={100}
            value={dynamics}
            onChange={(e) => {
              setDynamics(Number(e.target.value));
              setResult(null);
            }}
            style={{ accentColor: '#00E5FF', width: '100%' }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => void handleTransform()}
          disabled={(!hasAudio && rollTimedNotes.length < 3) || isTransforming}
          className="py-3 rounded-lg text-sm font-bold transition-all"
          style={{
            background:
              (hasAudio || rollTimedNotes.length >= 3) && !isTransforming ? '#00E5FF' : '#0d0d14',
            color: (hasAudio || rollTimedNotes.length >= 3) && !isTransforming ? '#000' : '#444',
            cursor:
              (hasAudio || rollTimedNotes.length >= 3) && !isTransforming ? 'pointer' : 'not-allowed',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {isTransforming
            ? 'Rendering…'
            : `Render ${selectedMeta?.label ?? 'instrument'}${result?.keyLabel ? ` · ${result.keyLabel}` : ''}`}
        </button>

        {(isTransforming || isAnalyzing || progress > 0) && !error && (
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-sm" style={{ color: '#888' }}>
              <span>{stage}</span>
              <span style={{ color: '#00E5FF', fontWeight: 'bold' }}>{Math.round(progress)}%</span>
            </div>
            <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: '#0d0d14' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, background: '#00E5FF', boxShadow: '0 0 12px #00E5FF' }}
              />
            </div>
          </div>
        )}

        {error && (
          <p className="text-xs font-semibold text-center" style={{ color: '#ff6666' }}>
            {error}
          </p>
        )}

        {result && (
          <p className="text-xs text-center" style={{ color: '#888' }}>
            Preview sound: {result.renderEngine === 'soundfont' ? 'GM' : 'synth'} ({result.durationSec.toFixed(1)}s)
            {result.keyLabel ? ` · ${result.keyLabel}` : ''}
          </p>
        )}
      </div>

      {(result || hasAudio) && (
        <div className="flex flex-col gap-3 border-t border-gray-700 pt-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setPlaybackMode('original');
                pausePlayback();
              }}
              className="flex-1 py-1.5 rounded text-xs font-bold"
              style={{
                background: playbackMode === 'original' ? '#1a2a2a' : '#121218',
                color: playbackMode === 'original' ? '#00E5FF' : '#555',
                border: `1px solid ${playbackMode === 'original' ? '#00E5FF44' : '#1a1a24'}`,
              }}
            >
              Hum
            </button>
            <button
              type="button"
              disabled={!result}
              onClick={() => {
                setPlaybackMode('instrument');
                pausePlayback();
              }}
              className="flex-1 py-1.5 rounded text-xs font-bold"
              style={{
                background: playbackMode === 'instrument' ? '#1a2a2a' : '#121218',
                color: playbackMode === 'instrument' ? '#00ff88' : '#555',
                border: `1px solid ${playbackMode === 'instrument' ? '#00ff8844' : '#1a1a24'}`,
                opacity: result ? 1 : 0.45,
                cursor: result ? 'pointer' : 'not-allowed',
              }}
            >
              Instrument
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePlayPause}
              disabled={playbackMode === 'instrument' ? !result : !hasAudio}
              className="flex items-center justify-center gap-1 px-4 py-2 rounded-lg font-bold text-sm transition-all"
              style={{
                background: isPlaying ? '#00ff88' : '#0d0d14',
                color: isPlaying ? '#000' : '#00ff88',
                border: '1px solid #00ff8844',
                cursor: 'pointer',
                opacity: (playbackMode === 'instrument' ? result : hasAudio) ? 1 : 0.45,
              }}
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
              {isPlaying ? 'PAUSE' : 'PLAY'}
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              style={{ flex: 1, cursor: 'pointer', accentColor: '#00ff88' }}
            />
            <span style={{ color: '#888', fontSize: '12px', minWidth: '30px' }}>{volume}%</span>
            {result && (
              <button
                type="button"
                onClick={() => downloadNeuralHumWav(result.wavBlob, selectedMeta?.label ?? 'instrument')}
                className="flex items-center justify-center p-2 rounded-lg"
                style={{ background: '#0d0d14', color: '#00E5FF', border: '1px solid #00E5FF44' }}
                title="Download WAV"
              >
                <Download size={14} />
              </button>
            )}
          </div>

          {isPlaying && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Volume2 size={14} style={{ color: '#00ff88' }} />
                <span style={{ fontSize: '11px', color: '#888', fontWeight: 'bold' }}>LEVEL</span>
              </div>
              <div style={{ display: 'flex', gap: '2px', height: '20px' }}>
                {Array.from({ length: 12 }).map((_, i) => {
                  const threshold = (i / 12) * 100;
                  const isActive = meterLevel > threshold;
                  return (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        background: isActive
                          ? threshold > 80
                            ? '#ff4444'
                            : threshold > 60
                              ? '#ffaa00'
                              : '#00ff88'
                          : '#0d0d14',
                        borderRadius: '2px',
                        transition: 'all 50ms',
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <audio
        ref={audioRef}
        onEnded={() => {
          setIsPlaying(false);
          stopMeter();
        }}
        style={{ display: 'none' }}
      />
    </div>
  );
}
