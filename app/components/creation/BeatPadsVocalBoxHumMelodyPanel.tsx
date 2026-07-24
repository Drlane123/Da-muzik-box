'use client';

/**
 * Compact Hum Melody Capture inside Beat Pads VocalBox.
 *
 * NeuralNote-style workflow (our stack):
 *   Rec = gather audio + audible metro; scope only reads pitch
 *   Analyze = audio → MIDI from the mic take → piano roll
 *   Optional key lock + quantize after
 */
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { Lock, Mic, Play, Square } from 'lucide-react';

import { useNeuralHumLivePitch } from '@/app/hooks/useNeuralHumLivePitch';
import { useVocalCapture } from '@/app/hooks/useVocalCapture';
import {
  trimAudioBufferFromSec,
} from '@/app/lib/creationStation/beatPadsVocalBoxAnalyze';
import {
  createSe2PrecountRimshotBuffer,
  ensureSe2PrecountRimshotBuffer,
  SE2_PRECOUNT_CLICK_VOLUME,
} from '@/app/lib/studio/se2Precount';
import {
  runSe2PrecountThenMetro,
  se2ClickGridTempo,
  waitSe2AudioTime,
} from '@/app/lib/creationStation/vocalBoxAudioGrid';
import { clampBeatPadsBpm } from '@/app/lib/creationStation/beatLabDrumMachineSequencer';
import type { TimedMonophonicNote } from '@/app/lib/studio/audioToMidiNotes';
import { timedNotesToStudioMidiNotes } from '@/app/lib/vocalLab/neuralHumStudioExport';
import type { NeuralHumInstrumentId } from '@/app/lib/vocalLab/neuralHumToInstrument';
import {
  enforceMonophonicRollNotes,
  quantizeNeuralHumRollNotes,
  rollNotesToTimed,
  type NeuralHumRollBarCount,
  type NeuralHumRollNote,
  type NeuralHumRollQuantize,
} from '@/app/lib/vocalLab/neuralHumMelodyRoll';
import {
  NEURAL_HUM_KEY_NAMES,
  NEURAL_HUM_SCALES,
  neuralHumKeyLabel,
  neuralHumScalePitchClasses,
  snapMidiToNeuralHumScale,
  type NeuralHumKeyLockMode,
  type NeuralHumKeyLockSettings,
  type NeuralHumScaleId,
} from '@/app/lib/vocalLab/neuralHumKeyLock';
import {
  analyzeVocalBoxHumTake,
  clampHumCaptureIntensity,
  clampHumCaptureQuantize,
  lockVocalBoxHumCapture,
  VOCALBOX_HUM_DOWNBEAT_TRIM_SLACK_SEC,
  VOCALBOX_HUM_INTENSITY_DEFAULT,
  VOCALBOX_HUM_LIVE_OPTS,
} from '@/app/lib/vocalLab/vocalBoxHumCaptureLock';
import { VocalBoxHumIntensitySlider } from '@/app/components/creation/VocalBoxHumIntensitySlider';
import NeuralHumPitchScope from '@/app/screens/vocal-lab/NeuralHumPitchScope';
import '@/app/styles/beatPadsVocalBoxHumMelody.css';

const NeuralHumMelodyRollLazy = lazy(() => import('@/app/screens/vocal-lab/NeuralHumMelodyRoll'));

const HUM_ACCENT = '#00E5FF';
const BEATS_PER_BAR = 4;
const HUM_BEAT_RULER_H = 16;
/** Default open: 4 bars · 1/16 — hard grid lock for Hum Melody capture. */
const VOCALBOX_HUM_QUANTIZE_DEFAULT: NeuralHumRollQuantize = '1/16';
const VOCALBOX_HUM_BARS_DEFAULT: NeuralHumRollBarCount = 4;

/** 1–2–3–4 over each beat on the Hum Melody roll — same idea as VocalBox drums. */
function HumMelodyBeatRuler({
  captureBars,
  beatsPerBar,
  rulerRef,
}: {
  captureBars: number;
  beatsPerBar: number;
  rulerRef: RefObject<HTMLDivElement | null>;
}) {
  const bpb = Math.max(1, Math.round(beatsPerBar));
  const beatCount = Math.max(1, Math.round(captureBars) * bpb);
  const beatW = 100 / beatCount;
  return (
    <div
      className="vb-beat-ruler relative w-full shrink-0"
      ref={rulerRef}
      style={{ height: HUM_BEAT_RULER_H, marginBottom: 4 }}
      aria-hidden
    >
      {Array.from({ length: beatCount }, (_, i) => (
        <span
          key={`hum-beat-${i}`}
          data-vb-grid-beat={i}
          className="vb-beat-ruler-num"
          style={{ left: `${i * beatW}%`, width: `${beatW}%` }}
        >
          {(i % bpb) + 1}
        </span>
      ))}
    </div>
  );
}

const INSTRUMENTS: { id: NeuralHumInstrumentId; label: string }[] = [
  { id: 'piano', label: 'Piano' },
  { id: 'synth', label: 'Synth' },
  { id: 'guitar', label: 'Guitar' },
  { id: 'bass', label: 'Bass' },
  { id: 'violin', label: 'Violin' },
];

const KEY_MODES: { id: NeuralHumKeyLockMode; label: string }[] = [
  { id: 'off', label: 'Off' },
  { id: 'manual', label: 'Manual' },
  { id: 'auto', label: 'Auto' },
];

export type BeatPadsVocalBoxHumMelodyNote = {
  pitch: number;
  startBeat: number;
  durationBeats: number;
  velocity: number;
};

/** Overlapping VocalBox rolls — same piano UI, independent parts. */
export type BeatPadsVocalBoxHumRollLayer = 'melody' | 'bass' | 'lead';

export type BeatPadsVocalBoxHumMelodyApply = {
  notes: BeatPadsVocalBoxHumMelodyNote[];
  instrumentId: NeuralHumInstrumentId;
  rollBars: NeuralHumRollBarCount;
  layer: BeatPadsVocalBoxHumRollLayer;
};

type HumRollLayerDraft = {
  rollNotes: NeuralHumRollNote[];
  instrumentId: NeuralHumInstrumentId;
  dirty: boolean;
  hasRawTake: boolean;
};

const ROLL_LAYERS: {
  id: BeatPadsVocalBoxHumRollLayer;
  tab: string;
  rollLabel: string;
  saveLabel: string;
  defaultInstrument: NeuralHumInstrumentId;
  chipTone?: 'warm' | 'cool' | 'mint';
}[] = [
  {
    id: 'melody',
    tab: 'Melody Roll',
    rollLabel: 'Melody roll',
    saveLabel: 'Save melody',
    defaultInstrument: 'piano',
  },
  {
    id: 'bass',
    tab: 'Bass Roll',
    rollLabel: 'Bass roll',
    saveLabel: 'Save bass',
    defaultInstrument: 'bass',
    chipTone: 'mint',
  },
  {
    id: 'lead',
    tab: 'Lead Roll',
    rollLabel: 'Lead roll',
    saveLabel: 'Save lead',
    defaultInstrument: 'synth',
    chipTone: 'warm',
  },
];

function emptyHumRollLayers(): Record<BeatPadsVocalBoxHumRollLayer, HumRollLayerDraft> {
  return {
    melody: { rollNotes: [], instrumentId: 'piano', dirty: false, hasRawTake: false },
    bass: { rollNotes: [], instrumentId: 'bass', dirty: false, hasRawTake: false },
    lead: { rollNotes: [], instrumentId: 'synth', dirty: false, hasRawTake: false },
  };
}

function humCaptureDurationSec(bpm: number, captureBars: number): number {
  const b = Math.max(30, Math.min(300, bpm));
  return Math.max(1, captureBars) * BEATS_PER_BAR * (60 / b);
}

function clampCaptureBars(loopBars: number): NeuralHumRollBarCount {
  if (loopBars <= 4) return 4;
  return 8;
}

export type BeatPadsVocalBoxHumMelodyPanelProps = {
  bpm: number;
  /** Beat Pads / session loop length — melody capture matches this grid. */
  loopBars: number;
  disabled?: boolean;
  getAudioContext?: () => AudioContext | null;
  getAudioOutput?: () => AudioNode | null;
  getPreviewDestination?: (ctx: AudioContext) => AudioNode;
  warmAudio?: () => void | Promise<void>;
  songKeyRoot?: number;
  songKeyMode?: 'major' | 'minor';
  onApply?: (payload: BeatPadsVocalBoxHumMelodyApply) => void;
  /** True while VocalBox drum Rec is armed — blocks dual mic. */
  drumsBusy?: boolean;
  /** Change Beat Pads / VocalBox tempo (shared grid). */
  onBpmChange?: (bpm: number) => void;
  /** When on, Play fires drums + melody on the same downbeat. */
  partsSync?: boolean;
  onPartsSyncChange?: (on: boolean) => void;
  /** Parent bumps this after scheduling drums so melody starts on the same anchor. */
  syncAuditionNonce?: number;
  /** Parent bumps to cancel melody audition (Stop). */
  syncAuditionStopNonce?: number;
  /** Parent bumps when user hits To Pads — apply all roll layers. */
  syncToPadsNonce?: number;
  getSyncAuditionStartAtSec?: () => number | null;
  /** Called when user hits Play/Audition with Sync on — parent should preview drums. */
  onSyncPlayDrums?: () => void;
  /** Push drums + melody onto Beat Pads (parent owns drum send). */
  onSyncToBeatPads?: () => void;
  /** Match VocalBox drum quantize so both parts sit on the same grid. */
  gridQuantize?: NeuralHumRollQuantize;
};

export function BeatPadsVocalBoxHumMelodyPanel({
  bpm,
  loopBars,
  disabled = false,
  getAudioContext,
  getAudioOutput,
  getPreviewDestination,
  warmAudio,
  songKeyRoot = 0,
  songKeyMode = 'major',
  onApply,
  drumsBusy = false,
  onBpmChange,
  partsSync = false,
  onPartsSyncChange,
  syncAuditionNonce = 0,
  syncAuditionStopNonce = 0,
  syncToPadsNonce = 0,
  getSyncAuditionStartAtSec,
  onSyncPlayDrums,
  onSyncToBeatPads,
  gridQuantize,
}: BeatPadsVocalBoxHumMelodyPanelProps) {
  const maxBars = clampCaptureBars(loopBars);
  const [captureBars, setCaptureBars] = useState<NeuralHumRollBarCount>(() =>
    Math.min(VOCALBOX_HUM_BARS_DEFAULT, maxBars) as NeuralHumRollBarCount,
  );
  const [activeLayer, setActiveLayer] = useState<BeatPadsVocalBoxHumRollLayer>('melody');
  const [layers, setLayers] = useState(emptyHumRollLayers);
  const [status, setStatus] = useState('Rec = listen + click · Analyze = audio → MIDI');
  const [busy, setBusy] = useState(false);
  const [isAnalyzingTake, setIsAnalyzingTake] = useState(false);
  const [isPrecounting, setIsPrecounting] = useState(false);
  /** Cnt/Mtr + count box only — same Play click lock as VocalBox drums (no mic). */
  const [clickPlayActive, setClickPlayActive] = useState(false);
  /** Local Play bump when Sync is off (or melody-only). */
  const [localAuditionNonce, setLocalAuditionNonce] = useState(0);
  const [localAuditionStopNonce, setLocalAuditionStopNonce] = useState(0);
  /** True for whole Rec / Play session so the digit span stays mounted with the click grid. */
  const [recSessionActive, setRecSessionActive] = useState(false);
  /** Rec-button number: pre-count countdown (4…1) or metro beat-in-bar (1…4). */
  const [recBeatNumber, setRecBeatNumber] = useState<number | null>(null);
  /** precount | metro — styles the count box under Rec. */
  const [recCountPhase, setRecCountPhase] = useState<'precount' | 'metro' | null>(null);
  /** Imperative digit paint into the count box under Rec. */
  const recBeatDigitRef = useRef<HTMLSpanElement | null>(null);
  const recCountBoxRef = useRef<HTMLDivElement | null>(null);
  /** Last painted digit — restored after React clears empty <span /> children. */
  const recDigitPaintRef = useRef<{ text: string; phase: 'precount' | 'metro' | null }>({
    text: '—',
    phase: null,
  });

  const paintRecCountBox = useCallback((n: number | '—' | '…', phase: 'precount' | 'metro' | null) => {
    recDigitPaintRef.current = { text: String(n), phase };
    const digit = recBeatDigitRef.current;
    if (digit) digit.textContent = String(n);
    const box = recCountBoxRef.current;
    if (!box) return;
    // Classes owned here — do not also drive them from React className (commits fight the digit).
    box.classList.toggle('vb-rec-count-box--idle', phase == null);
    box.classList.toggle('vb-rec-count-box--metro', phase === 'metro');
  }, []);

  const beatRulerRef = useRef<HTMLDivElement | null>(null);
  const litGridBeatRef = useRef<number | null>(null);
  const litGridPhaseRef = useRef<'precount' | 'metro' | null>(null);
  const gridCellsRef = useRef<HTMLElement[]>([]);
  const clickCountBeatsRef = useRef(0);

  const paintGridBeatLit = useCallback(
    (gridBeatIndex: number | null, phase: 'precount' | 'metro' = 'metro') => {
      litGridBeatRef.current = gridBeatIndex;
      litGridPhaseRef.current = gridBeatIndex == null ? null : phase;
      let cells = gridCellsRef.current;
      if (cells.length === 0) {
        const root = beatRulerRef.current;
        if (root) {
          cells = Array.from(root.querySelectorAll('[data-vb-grid-beat]')) as HTMLElement[];
          gridCellsRef.current = cells;
        }
      }
      for (let i = 0; i < cells.length; i += 1) {
        const el = cells[i]!;
        const on = gridBeatIndex != null && i === gridBeatIndex;
        const pre = on && phase === 'precount';
        el.classList.toggle('vb-beat-ruler-num--lit', on && !pre);
        el.classList.toggle('vb-beat-ruler-num--lit-precount', pre);
        if (pre) {
          el.style.color = '#ffd0d8';
          el.style.textShadow = '0 0 12px rgba(255,80,100,1), 0 0 6px rgba(255,120,140,0.95)';
          el.style.transform = 'scale(1.35)';
          el.style.background = 'rgba(232,93,117,0.32)';
          el.style.borderRadius = '3px';
        } else if (on) {
          el.style.color = '#e8fff4';
          el.style.textShadow = '0 0 12px rgba(124,244,198,1), 0 0 6px rgba(255,255,255,0.9)';
          el.style.transform = 'scale(1.35)';
          el.style.background = 'rgba(124,244,198,0.28)';
          el.style.borderRadius = '3px';
        } else {
          el.style.color = '';
          el.style.textShadow = '';
          el.style.transform = '';
          el.style.background = '';
          el.style.borderRadius = '';
        }
      }
    },
    [],
  );

  const clearGridBeatLit = useCallback(() => {
    litGridBeatRef.current = null;
    litGridPhaseRef.current = null;
    const clearEl = (el: HTMLElement) => {
      el.classList.remove('vb-beat-ruler-num--lit', 'vb-beat-ruler-num--lit-precount');
      el.style.color = '';
      el.style.textShadow = '';
      el.style.transform = '';
      el.style.background = '';
      el.style.borderRadius = '';
    };
    for (const el of gridCellsRef.current) clearEl(el);
    beatRulerRef.current
      ?.querySelectorAll('.vb-beat-ruler-num--lit, .vb-beat-ruler-num--lit-precount')
      .forEach((n) => clearEl(n as HTMLElement));
  }, []);

  const armGridBeatCells = useCallback(() => {
    const root = beatRulerRef.current;
    gridCellsRef.current = root
      ? (Array.from(root.querySelectorAll('[data-vb-grid-beat]')) as HTMLElement[])
      : [];
  }, []);

  const paintClickDigit = useCallback(
    (n: number, phase: 'precount' | 'metro', absoluteBeat?: number) => {
      paintRecCountBox(n, phase);
      if (absoluteBeat == null) return;
      const countBeats = clickCountBeatsRef.current;
      const gridBeatIndex =
        phase === 'metro' ? absoluteBeat - countBeats - 1 : (absoluteBeat - 1) % BEATS_PER_BAR;
      if (gridBeatIndex >= 0) paintGridBeatLit(gridBeatIndex, phase);
    },
    [paintGridBeatLit, paintRecCountBox],
  );

  // Empty <span ref /> has no React children — every commit wipes textContent. Re-apply before paint.
  useLayoutEffect(() => {
    const { text, phase } = recDigitPaintRef.current;
    const digit = recBeatDigitRef.current;
    if (digit && digit.textContent !== text) digit.textContent = text;
    const box = recCountBoxRef.current;
    if (!box) return;
    box.classList.toggle('vb-rec-count-box--idle', phase == null);
    box.classList.toggle('vb-rec-count-box--metro', phase === 'metro');
  });

  useEffect(() => {
    paintRecCountBox('—', null);
  }, [paintRecCountBox]);
  const [precountBars, setPrecountBars] = useState<1 | 2>(1);
  const [precountEnabled, setPrecountEnabled] = useState(true);
  const [recordMetroEnabled, setRecordMetroEnabled] = useState(true);
  /** 40–200 — NeuralHumMelodyRoll divides by 100 for audition gain. */
  const [previewDynamics, setPreviewDynamics] = useState(140);
  const [quantize, setQuantize] = useState<NeuralHumRollQuantize>(
    () => clampHumCaptureQuantize(VOCALBOX_HUM_QUANTIZE_DEFAULT),
  );
  const quantizeRef = useRef(quantize);
  quantizeRef.current = quantize;
  /** Hum Melody Intensity only — independent from VocalBox drums. */
  const [intensity, setIntensity] = useState(VOCALBOX_HUM_INTENSITY_DEFAULT);
  const intensityRef = useRef(intensity);
  intensityRef.current = intensity;

  // Open locked to 1/16 (Hum Melody default) — ignore coarser shared drum grid.
  const seededQuantizeRef = useRef(false);
  useEffect(() => {
    if (seededQuantizeRef.current) return;
    seededQuantizeRef.current = true;
    setQuantize(clampHumCaptureQuantize(VOCALBOX_HUM_QUANTIZE_DEFAULT));
  }, [gridQuantize]);
  const [keyLockMode, setKeyLockMode] = useState<NeuralHumKeyLockMode>('off');
  const [keyRoot, setKeyRoot] = useState(() => ((songKeyRoot % 12) + 12) % 12);
  const [scaleId, setScaleId] = useState<NeuralHumScaleId>(
    songKeyMode === 'minor' ? 'minor' : 'major',
  );

  const activeLayerMeta = ROLL_LAYERS.find((l) => l.id === activeLayer) ?? ROLL_LAYERS[0]!;
  const activeDraft = layers[activeLayer];
  const rollNotes = activeDraft.rollNotes;
  const instrumentId = activeDraft.instrumentId;
  const rollDirty = activeDraft.dirty;
  const hasRawTake = activeDraft.hasRawTake;

  const gridOriginFileSecRef = useRef(0);
  /** Musical green 1 (audio clock) — auto-stop length measured from here. */
  const recordAnchorRef = useRef<number | null>(null);
  const precountCancelRef = useRef(false);
  const precountBufRef = useRef<AudioBuffer | null>(null);
  const scheduledNodesRef = useRef<AudioBufferSourceNode[]>([]);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Stable capture API — never gate stop on a stale `capture.isRecording` boolean. */
  const stopRecordRef = useRef<() => void>(() => {});
  const releaseMicRef = useRef<() => void>(() => {});
  const isRecordingCaptureRef = useRef(false);
  /** Audio-clock downbeat — metro Rec numbers (1–4) follow this + BPM. */
  const metroAnchorSecRef = useRef<number | null>(null);
  /** Exact metro tempo from runSe2PrecountThenMetro (rounded) — paint must use this, not raw bpm. */
  const gridBpmRef = useRef(se2ClickGridTempo(bpm).bpm);
  const gridSpbRef = useRef(se2ClickGridTempo(bpm).spb);
  /**
   * During Rec: keep click audible for pre-count + metro (counter stays synced).
   * Slight duck vs Click Play so the mic still leads.
   */
  const quietRecClicksRef = useRef(false);
  /** Stop synced Rec-number UI driver (same clock as clicks). */
  const stopClickUiRef = useRef<(() => void) | null>(null);
  const analyzingRef = useRef(false);
  const activeLayerRef = useRef<BeatPadsVocalBoxHumRollLayer>(activeLayer);
  const rawNotesByLayerRef = useRef<Record<BeatPadsVocalBoxHumRollLayer, TimedMonophonicNote[]>>({
    melody: [],
    bass: [],
    lead: [],
  });
  const keyLockRef = useRef<NeuralHumKeyLockSettings>({
    mode: 'manual',
    keyRoot: ((songKeyRoot % 12) + 12) % 12,
    scaleId: songKeyMode === 'minor' ? 'minor' : 'major',
  });

  useEffect(() => {
    activeLayerRef.current = activeLayer;
  }, [activeLayer]);

  useEffect(() => {
    setCaptureBars((prev) => (prev > maxBars ? maxBars : prev));
  }, [maxBars]);

  useEffect(() => {
    setKeyRoot(((songKeyRoot % 12) + 12) % 12);
    setScaleId(songKeyMode === 'minor' ? 'minor' : 'major');
  }, [songKeyRoot, songKeyMode]);

  useEffect(() => {
    keyLockRef.current = { mode: keyLockMode, keyRoot, scaleId };
  }, [keyLockMode, keyRoot, scaleId]);

  const patchActiveLayer = useCallback(
    (patch: Partial<HumRollLayerDraft>, layerId?: BeatPadsVocalBoxHumRollLayer) => {
      const id = layerId ?? activeLayerRef.current;
      setLayers((prev) => ({
        ...prev,
        [id]: { ...prev[id], ...patch },
      }));
    },
    [],
  );

  const flash = useCallback((msg: string) => setStatus(msg), []);

  const cancelScheduled = useCallback(() => {
    for (const n of scheduledNodesRef.current) {
      try {
        n.stop();
      } catch {
        /* */
      }
    }
    scheduledNodesRef.current = [];
  }, []);

  const resolveCtx = useCallback(async (): Promise<AudioContext | null> => {
    try {
      await warmAudio?.();
    } catch {
      /* */
    }
    const ctx = getAudioContext?.() ?? null;
    if (!ctx || ctx.state === 'closed') return null;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        /* */
      }
    }
    return ctx;
  }, [getAudioContext, warmAudio]);

  const commitFromRaw = useCallback(
    (raw: TimedMonophonicNote[], lock: NeuralHumKeyLockSettings, engineLabel?: string) => {
      const layerId = activeLayerRef.current;
      const layerMeta = ROLL_LAYERS.find((l) => l.id === layerId) ?? ROLL_LAYERS[0]!;
      const gridBpm = gridBpmRef.current || se2ClickGridTempo(bpm).bpm;
      const q = clampHumCaptureQuantize(quantizeRef.current);
      const intensityLevel = clampHumCaptureIntensity(intensityRef.current);
      // Recorded take → mic MIDI → optional key → Intensity gate → quantize grid.
      const locked = lockVocalBoxHumCapture({
        rawNotes: raw,
        lock,
        bpm: gridBpm,
        bars: captureBars,
        quantize: q,
        intensity: intensityLevel,
      });
      if (lock.mode === 'auto') {
        setKeyRoot(locked.effectiveKeyRoot);
        setScaleId(locked.effectiveScaleId);
      }
      patchActiveLayer(
        {
          rollNotes: locked.rollNotes,
          dirty: true,
          hasRawTake: raw.length > 0 || locked.noteCount > 0,
        },
        layerId,
      );
      const notes = timedNotesToStudioMidiNotes(locked.timedNotes, gridBpm, 0);
      const label =
        lock.mode === 'off'
          ? null
          : neuralHumKeyLabel(locked.effectiveKeyRoot, locked.effectiveScaleId);
      flash(
        locked.noteCount === 0
          ? 'No pitched notes — hum louder / closer to the mic.'
          : `${locked.noteCount} note${locked.noteCount === 1 ? '' : 's'} from mic → ${q} grid · ${layerMeta.rollLabel}${
              label ? ` · ${label}` : ''
            }${engineLabel ? ` · ${engineLabel}` : ''}${
              raw.length !== locked.noteCount ? ` · raw ${raw.length}` : ''
            }`,
      );
      return notes.length;
    },
    [bpm, captureBars, flash, patchActiveLayer],
  );

  const applyBlob = useCallback(
    async (blob: Blob | null) => {
      if (!blob || blob.size < 200 || analyzingRef.current) return;
      analyzingRef.current = true;
      setIsAnalyzingTake(true);
      setBusy(true);
      flash('Audio → MIDI…');
      try {
        const lock = keyLockRef.current;

        const ctx = await resolveCtx();
        if (!ctx) {
          flash('Audio not ready.');
          return;
        }
        const bytes = await blob.arrayBuffer();
        const decoded = await ctx.decodeAudioData(bytes.slice(0));
        const gridBpm = gridBpmRef.current || se2ClickGridTempo(bpm).bpm;
        const takeSec = humCaptureDurationSec(gridBpm, captureBars);
        // Trim to musical green 1 → take length (pre-count audio stays out of MIDI).
        const trimmed = trimAudioBufferFromSec(
          decoded,
          gridOriginFileSecRef.current,
          takeSec + 0.08,
        );

        // Mic ACF first (what you hummed); Basic Pitch only if ACF finds nothing.
        const analyzed = await analyzeVocalBoxHumTake(
          trimmed,
          undefined,
          intensityRef.current,
        );
        const layerId = activeLayerRef.current;
        rawNotesByLayerRef.current[layerId] = analyzed.rawNotes;
        patchActiveLayer({ hasRawTake: analyzed.rawNotes.length > 0 }, layerId);
        if (analyzed.rawNotes.length === 0) {
          flash('No hummed notes found — hum louder / closer, or try again.');
          patchActiveLayer({ rollNotes: [], dirty: false, hasRawTake: false }, layerId);
          return;
        }
        commitFromRaw(analyzed.rawNotes, lock, analyzed.engine);
      } catch (err) {
        flash(err instanceof Error ? err.message : 'Melody analyze failed');
      } finally {
        analyzingRef.current = false;
        setIsAnalyzingTake(false);
        setBusy(false);
      }
    },
    [bpm, captureBars, commitFromRaw, flash, patchActiveLayer, resolveCtx],
  );

  const applyBlobRef = useRef(applyBlob);
  applyBlobRef.current = applyBlob;

  const capture = useVocalCapture(
    useCallback((blob: Blob | null) => {
      void applyBlobRef.current(blob);
    }, []),
    // Echo cancel only — keep quiet hummed notes (no noise gate / AGC).
    { isolatedMic: true },
  );

  stopRecordRef.current = capture.stopRecord;
  releaseMicRef.current = capture.releaseMic;
  isRecordingCaptureRef.current = capture.isRecording;

  const { live, trail, clearTrail } = useNeuralHumLivePitch(
    // Scope only during the take (after green 1) — not during red pre-count.
    capture.isRecording && !isPrecounting,
    capture.captureStream,
    {
      minConfidence: VOCALBOX_HUM_LIVE_OPTS.minConfidence,
      minRms: VOCALBOX_HUM_LIVE_OPTS.minRms,
      silenceHoldFrames: VOCALBOX_HUM_LIVE_OPTS.silenceHoldFrames,
      fMinHz: VOCALBOX_HUM_LIVE_OPTS.fMinHz,
      fMaxHz: VOCALBOX_HUM_LIVE_OPTS.fMaxHz,
    },
  );

  // Keep AudioContext awake during countdown + take so scheduled metro clicks fire.
  useEffect(() => {
    if (!isPrecounting && !capture.isRecording) return;
    const ctx = getAudioContext?.();
    if (!ctx) return;
    let raf = 0;
    const keepAwake = () => {
      if (ctx.state === 'suspended') void ctx.resume();
      raf = requestAnimationFrame(keepAwake);
    };
    keepAwake();
    return () => cancelAnimationFrame(raf);
  }, [capture.isRecording, getAudioContext, isPrecounting]);

  /**
   * Auto-stop at end of take from green 1 (audio clock) — same pattern as VocalBox drums.
   * Must use stopRecordRef: the beginRecord closure’s `capture.isRecording` stays false
   * after startRecord and would skip MediaRecorder.stop(), chopping the take.
   */
  useEffect(() => {
    if (!capture.isRecording) return;
    const gridBpm = gridBpmRef.current || se2ClickGridTempo(bpm).bpm;
    const takeSec = humCaptureDurationSec(gridBpm, captureBars);
    const ctx = getAudioContext?.();
    let raf = 0;
    let t = 0;
    const armTimer = () => {
      const anchor = recordAnchorRef.current ?? metroAnchorSecRef.current;
      if (anchor == null || !ctx) {
        raf = requestAnimationFrame(armTimer);
        return;
      }
      const remainingMs = (anchor + takeSec - ctx.currentTime) * 1000 + 40;
      t = window.setTimeout(() => {
        if (!isRecordingCaptureRef.current) return;
        quietRecClicksRef.current = false;
        stopClickUiRef.current?.();
        stopClickUiRef.current = null;
        cancelScheduled();
        clearGridBeatLit();
        metroAnchorSecRef.current = null;
        setRecBeatNumber(null);
        setRecSessionActive(false);
        setRecCountPhase(null);
        paintRecCountBox('—', null);
        stopRecordRef.current();
        flash('Analyzing mic take…');
      }, Math.max(40, remainingMs));
    };
    armTimer();
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
    // Intentionally narrow deps — remounting mid-take would reset the stop timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- match VocalBox drums stop arm
  }, [bpm, capture.isRecording, captureBars, getAudioContext]);

  // Scope monitor only — optional key lock snaps the dial (not the roll during Rec).
  const liveLockedMidi = useMemo(() => {
    if (live == null) return null;
    if (keyLockMode === 'off') return Math.round(live.midi);
    return snapMidiToNeuralHumScale(live.midi, keyRoot, scaleId);
  }, [keyLockMode, keyRoot, live, scaleId]);
  const liveLockedPc =
    liveLockedMidi == null ? null : ((liveLockedMidi % 12) + 12) % 12;

  useEffect(
    () => () => {
      precountCancelRef.current = true;
      cancelScheduled();
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      if (isRecordingCaptureRef.current) stopRecordRef.current();
      else releaseMicRef.current();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount only
    [],
  );

  const previewGainRef = useRef<GainNode | null>(null);

  useEffect(() => {
    const g = previewGainRef.current;
    if (!g) return;
    const dyn = Math.max(40, Math.min(200, previewDynamics));
    g.gain.value = dyn / 90;
  }, [previewDynamics]);

  const ensurePreviewGain = useCallback(
    (ctx: AudioContext): GainNode => {
      let g = previewGainRef.current;
      if (!g || g.context !== ctx) {
        g = ctx.createGain();
        // Direct to speakers so VocalBox audition is always hearable (not buried in a quiet strip).
        g.connect(ctx.destination);
        previewGainRef.current = g;
      }
      // Map UI 40–200 → gain ~0.45–2.2
      const dyn = Math.max(40, Math.min(200, previewDynamics));
      g.gain.value = dyn / 90;
      return g;
    },
    [previewDynamics],
  );

  const scheduleClick = useCallback(
    (ctx: AudioContext, idealT: number, downbeat: boolean) => {
      let buf = precountBufRef.current;
      if (!buf && ctx.state !== 'closed') {
        buf = createSe2PrecountRimshotBuffer(ctx);
        precountBufRef.current = buf;
      }
      if (!buf) return;
      // Exact audio-clock time — never jam late clicks onto "now" (desyncs numbers).
      if (idealT < ctx.currentTime - 0.002) return;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      // Pre-count + Rec metro must stay audible, but duck hard on Rec so the
      // click isn’t pitched into MIDI when you’re not humming.
      const base = quietRecClicksRef.current
        ? SE2_PRECOUNT_CLICK_VOLUME * 0.38
        : SE2_PRECOUNT_CLICK_VOLUME;
      g.gain.value = downbeat ? base * 1.15 : base;
      src.connect(g);
      const dest = getAudioOutput?.() ?? ctx.destination;
      g.connect(dest);
      try {
        src.start(idealT);
        scheduledNodesRef.current.push(src);
      } catch {
        /* */
      }
    },
    [getAudioOutput],
  );

  const stopClickPlay = useCallback(() => {
    precountCancelRef.current = true;
    quietRecClicksRef.current = false;
    stopClickUiRef.current?.();
    stopClickUiRef.current = null;
    cancelScheduled();
    clearGridBeatLit();
    setIsPrecounting(false);
    setClickPlayActive(false);
    setRecSessionActive(false);
    setRecCountPhase(null);
    paintRecCountBox('—', null);
    setLocalAuditionStopNonce((n) => n + 1);
    flash('Play stopped.');
  }, [cancelScheduled, clearGridBeatLit, flash, paintRecCountBox]);

  const stopRecording = useCallback(() => {
    if (clickPlayActive) {
      stopClickPlay();
      return;
    }
    precountCancelRef.current = true;
    quietRecClicksRef.current = false;
    stopClickUiRef.current?.();
    stopClickUiRef.current = null;
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    cancelScheduled();
    clearGridBeatLit();
    if (isRecordingCaptureRef.current) stopRecordRef.current();
    else releaseMicRef.current();
    metroAnchorSecRef.current = null;
    recordAnchorRef.current = null;
    setIsPrecounting(false);
    setRecSessionActive(false);
    setRecBeatNumber(null);
    setRecCountPhase(null);
    paintRecCountBox('—', null);
    flash('Stopped.');
  }, [cancelScheduled, clearGridBeatLit, clickPlayActive, flash, paintRecCountBox, stopClickPlay]);

  /** Audition Cnt/Mtr + count box — same lock as VocalBox Play (no mic). */
  const beginClickPlay = useCallback(async () => {
    if (
      disabled ||
      busy ||
      drumsBusy ||
      capture.isRecording ||
      recSessionActive ||
      clickPlayActive
    ) {
      return;
    }
    if (!precountEnabled && !recordMetroEnabled) {
      flash('Turn on Cnt and/or Mtr, then Play.');
      return;
    }

    const ctx = await resolveCtx();
    if (!ctx) {
      flash('Audio not ready — tap Play once after audio warms.');
      return;
    }

    precountCancelRef.current = false;
    quietRecClicksRef.current = false;
    setClickPlayActive(true);
    setRecSessionActive(true);
    setIsPrecounting(precountEnabled);
    setRecCountPhase(precountEnabled ? 'precount' : 'metro');
    paintRecCountBox('…', precountEnabled ? 'precount' : 'metro');
    flash(
      precountEnabled
        ? `Play click @ ${Math.round(bpm)} BPM — count-in…`
        : `Play click @ ${Math.round(bpm)} BPM — metro…`,
    );

    try {
      const { bpm: gridBpm } = se2ClickGridTempo(bpm);
      const takeBeats = Math.max(captureBars, 4) * BEATS_PER_BAR;

      if (precountEnabled || recordMetroEnabled) {
        precountBufRef.current = await ensureSe2PrecountRimshotBuffer(ctx);
      }

      cancelScheduled();
      stopClickUiRef.current?.();
      stopClickUiRef.current = null;

      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      paintRecCountBox('…', precountEnabled ? 'precount' : 'metro');
      clearGridBeatLit();
      armGridBeatCells();
      clickCountBeatsRef.current = precountEnabled
        ? (precountBars === 2 ? 2 : 1) * BEATS_PER_BAR
        : 0;

      const result = await runSe2PrecountThenMetro({
        ctx,
        bpm: gridBpm,
        beatsPerBar: BEATS_PER_BAR,
        precountEnabled,
        precountBars,
        metroEnabled: recordMetroEnabled,
        metroBeatCount: takeBeats,
        schedulePrecountClick: (idealT, accent) => scheduleClick(ctx, idealT, accent),
        scheduleMetroClick: (idealT, downbeat) => scheduleClick(ctx, idealT, downbeat),
        isCancelled: () => precountCancelRef.current,
        paintDigit: (n, phase) => paintRecCountBox(n, phase),
        onDisplayNumber: (n, phase, absoluteBeat) => {
          paintClickDigit(n, phase, absoluteBeat);
        },
        onPhaseChange: (phase) => {
          if (phase === 'metro') setIsPrecounting(false);
        },
      });

      stopClickUiRef.current = result.stopUi;

      if (result.cancelled) {
        result.stopUi();
        stopClickUiRef.current = null;
        cancelScheduled();
        setClickPlayActive(false);
        setRecSessionActive(false);
        setRecCountPhase(null);
        paintRecCountBox('—', null);
        flash('Click play stopped.');
        return;
      }

      const metroBeats = recordMetroEnabled ? takeBeats : 0;
      const gridEnd = result.downbeatAudioTime + metroBeats * result.spb;
      const okEnd = await waitSe2AudioTime({
        ctx,
        whenSec: gridEnd,
        isCancelled: () => precountCancelRef.current,
      });

      result.stopUi();
      stopClickUiRef.current = null;
      cancelScheduled();
      setClickPlayActive(false);
      setRecSessionActive(false);
      setIsPrecounting(false);
      setRecCountPhase(null);
      paintRecCountBox('—', null);
      flash(
        okEnd && !precountCancelRef.current
          ? `Click play done @ ${gridBpm} BPM — number locked to clicks.`
          : 'Click play stopped.',
      );
    } catch (err) {
      cancelScheduled();
      stopClickUiRef.current?.();
      stopClickUiRef.current = null;
      setClickPlayActive(false);
      setRecSessionActive(false);
      setRecCountPhase(null);
      paintRecCountBox('—', null);
      flash(err instanceof Error ? err.message : 'Click play failed.');
    } finally {
      setIsPrecounting(false);
    }
  }, [
    bpm,
    busy,
    cancelScheduled,
    capture.isRecording,
    captureBars,
    clickPlayActive,
    disabled,
    drumsBusy,
    flash,
    paintClickDigit,
    paintRecCountBox,
    clearGridBeatLit,
    armGridBeatCells,
    precountBars,
    precountEnabled,
    recordMetroEnabled,
    recSessionActive,
    resolveCtx,
    scheduleClick,
  ]);

  const toggleClickPlay = useCallback(() => {
    if (disabled || drumsBusy || busy) return;
    if (clickPlayActive) {
      stopClickPlay();
      return;
    }
    // After a take: Play = roll bars. Sync On also kicks VocalBox drums.
    if (rollNotes.length > 0) {
      setClickPlayActive(true);
      if (partsSync) {
        // Stamp shared clock + drums; kick melody locally (parent skips melody nonce when syncFromMelody).
        onSyncPlayDrums?.();
        setLocalAuditionNonce((n) => n + 1);
      } else {
        setLocalAuditionNonce((n) => n + 1);
      }
      const gridBpm = gridBpmRef.current || se2ClickGridTempo(bpm).bpm;
      const timed = rollNotesToTimed(rollNotes, gridBpm);
      const last = timed[timed.length - 1];
      const endMs = last
        ? Math.max(500, (last.startSec + last.durationSec) * 1000 + 280)
        : 2000;
      window.setTimeout(() => {
        setClickPlayActive(false);
      }, endMs);
      flash(
        partsSync
          ? `Sync play — melody + drums @ ${Math.round(bpm)} BPM`
          : `Play ${activeLayerMeta.tab} @ ${Math.round(bpm)} BPM`,
      );
      return;
    }
    if (partsSync) {
      onSyncPlayDrums?.();
      flash('Sync play — drums (no melody notes yet)');
      return;
    }
    void beginClickPlay();
  }, [
    activeLayerMeta.tab,
    beginClickPlay,
    bpm,
    busy,
    clickPlayActive,
    disabled,
    drumsBusy,
    flash,
    onSyncPlayDrums,
    partsSync,
    rollNotes,
    stopClickPlay,
  ]);

  const beginRecord = useCallback(async () => {
    if (disabled || busy || drumsBusy || capture.isRecording || isPrecounting) return;
    if (clickPlayActive) {
      stopClickPlay();
    } else if (recSessionActive) {
      return;
    }
    setBusy(true);
    setIsPrecounting(true);
    setRecSessionActive(true);
    setRecBeatNumber(null);
    setRecCountPhase(precountEnabled ? 'precount' : 'metro');
    paintRecCountBox('…', precountEnabled ? 'precount' : 'metro');
    metroAnchorSecRef.current = null;
    // Audible pre-count + metro during Rec (counter + click stay on).
    quietRecClicksRef.current = true;
    clearTrail();
    // Clear roll for the take — MIDI lands only after Basic Pitch Analyze.
    patchActiveLayer({ rollNotes: [], dirty: false }, activeLayerRef.current);
    flash(`Arming @ ${Math.round(bpm)} BPM…`);

    const ctx = await resolveCtx();
    if (!ctx || ctx.state === 'closed') {
      setBusy(false);
      setIsPrecounting(false);
      setRecSessionActive(false);
      quietRecClicksRef.current = false;
      flash('Audio not ready — tap Play once, then Rec.');
      return;
    }
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        /* */
      }
    }
    if (ctx.state !== 'running') {
      setBusy(false);
      setIsPrecounting(false);
      setRecSessionActive(false);
      quietRecClicksRef.current = false;
      flash('Audio not ready — tap Play once, then Rec.');
      return;
    }

    const micOk = await capture.armMic();
    if (!micOk) {
      setBusy(false);
      setIsPrecounting(false);
      setRecSessionActive(false);
      quietRecClicksRef.current = false;
      flash('Mic blocked — allow microphone.');
      return;
    }

    precountCancelRef.current = false;
    try {
      if (precountEnabled || recordMetroEnabled) {
        precountBufRef.current = await ensureSe2PrecountRimshotBuffer(ctx);
      }

      const { bpm: gridBpm } = se2ClickGridTempo(bpm);
      const takeBeats = captureBars * BEATS_PER_BAR;

      cancelScheduled();
      stopClickUiRef.current?.();
      stopClickUiRef.current = null;
      flash(
        precountEnabled
          ? `${gridBpm} BPM — ${precountBars}-bar count-in…`
          : `${gridBpm} BPM — arming on downbeat…`,
      );

      // Wait one paint so the Rec digit span is mounted before the first click.
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      paintRecCountBox('…', precountEnabled ? 'precount' : 'metro');
      clearGridBeatLit();
      armGridBeatCells();
      clickCountBeatsRef.current = precountEnabled
        ? (precountBars === 2 ? 2 : 1) * BEATS_PER_BAR
        : 0;

      // Count box + beat ruler fire on the same audio-clock instant as each click.
      const result = await runSe2PrecountThenMetro({
        ctx,
        bpm: gridBpm,
        beatsPerBar: BEATS_PER_BAR,
        precountEnabled,
        precountBars,
        metroEnabled: recordMetroEnabled,
        metroBeatCount: takeBeats,
        schedulePrecountClick: (idealT, accent) => scheduleClick(ctx, idealT, accent),
        scheduleMetroClick: (idealT, downbeat) => scheduleClick(ctx, idealT, downbeat),
        isCancelled: () => precountCancelRef.current,
        onGridReady: ({ downbeatAudioTime, spb, bpm: readyBpm }) => {
          // Musical bar-1 beat-1 (first green 1) — not the red pre-count t0.
          metroAnchorSecRef.current = downbeatAudioTime;
          recordAnchorRef.current = downbeatAudioTime;
          gridSpbRef.current = spb;
          gridBpmRef.current = readyBpm;
        },
        onArmRecord: async () => {
          // Starts ~on green 1 (tiny lead only) — never at the start of red pre-count.
          await capture.startRecord();
        },
        // Tiny pre-roll so MediaRecorder is hot for the downbeat; trim maps file→green 1.
        recordArmLeadSec: Math.min(0.045, Math.max(0.02, (60 / Math.max(40, gridBpm)) * 0.06)),
        paintDigit: (n, phase) => paintRecCountBox(n, phase),
        onDisplayNumber: (n, phase, absoluteBeat) => {
          paintClickDigit(n, phase, absoluteBeat);
        },
        onPhaseChange: (phase) => {
          if (phase === 'metro') {
            setIsPrecounting(false);
            setRecCountPhase('metro');
          }
        },
      });

      stopClickUiRef.current = result.stopUi;

      if (result.cancelled) {
        result.stopUi();
        stopClickUiRef.current = null;
        cancelScheduled();
        clearGridBeatLit();
        quietRecClicksRef.current = false;
        metroAnchorSecRef.current = null;
        recordAnchorRef.current = null;
        releaseMicRef.current();
        if (isRecordingCaptureRef.current) stopRecordRef.current();
        setRecBeatNumber(null);
        setRecSessionActive(false);
        setRecCountPhase(null);
        paintRecCountBox('—', null);
        flash('Count-in cancelled.');
        return;
      }

      const { downbeatAudioTime, recordArmedAtSec } = result;
      const fileZero = recordArmedAtSec ?? downbeatAudioTime;
      // Musical 1 in the file = first green 1 after red pre-count (4→3→2→1).
      gridOriginFileSecRef.current = Math.max(
        0,
        downbeatAudioTime - fileZero + VOCALBOX_HUM_DOWNBEAT_TRIM_SLACK_SEC,
      );
      recordAnchorRef.current = downbeatAudioTime;
      metroAnchorSecRef.current = downbeatAudioTime;

      // Downbeat reached — pre-count done; take is bar 1 beat 1 onward.
      // Auto-stop is armed by the isRecording effect (stopRecordRef), not a stale closure.
      setIsPrecounting(false);
      setRecCountPhase('metro');
      flash(
        `Rec on 1 · ${captureBars} bars @ ${gridBpm} BPM · key ${
          keyLockMode === 'off' ? 'off' : neuralHumKeyLabel(keyRoot, scaleId)
        }`,
      );
    } catch (err) {
      metroAnchorSecRef.current = null;
      recordAnchorRef.current = null;
      quietRecClicksRef.current = false;
      cancelScheduled();
      releaseMicRef.current();
      setRecSessionActive(false);
      setRecCountPhase(null);
      paintRecCountBox('—', null);
      flash(err instanceof Error ? err.message : 'Record failed');
    } finally {
      setBusy(false);
      setIsPrecounting(false);
    }
  }, [
    bpm,
    busy,
    cancelScheduled,
    capture,
    captureBars,
    clearTrail,
    clickPlayActive,
    disabled,
    drumsBusy,
    flash,
    paintClickDigit,
    paintRecCountBox,
    clearGridBeatLit,
    armGridBeatCells,
    patchActiveLayer,
    precountBars,
    precountEnabled,
    recSessionActive,
    recordMetroEnabled,
    resolveCtx,
    scheduleClick,
    stopClickPlay,
    keyLockMode,
    keyRoot,
    scaleId,
  ]);

  const resnapToKey = useCallback(() => {
    const layerId = activeLayerRef.current;
    const raw = rawNotesByLayerRef.current[layerId];
    if (raw.length === 0) {
      flash('Record a take first, then change key.');
      return;
    }
    commitFromRaw(raw, keyLockRef.current, 're-key');
  }, [commitFromRaw, flash]);

  const syncDraftFromRoll = useCallback(
    (notes: NeuralHumRollNote[]) => {
      const mono = enforceMonophonicRollNotes(notes);
      patchActiveLayer({ rollNotes: mono, dirty: true });
    },
    [patchActiveLayer],
  );

  const handleQuantizeNow = useCallback(() => {
    const layerId = activeLayerRef.current;
    const raw = rawNotesByLayerRef.current[layerId];
    // Prefer full re-lock from the take so key + grid stay consistent.
    if (raw.length > 0) {
      commitFromRaw(raw, keyLockRef.current, 'quantize');
      return;
    }
    setLayers((prev) => {
      const next = quantizeNeuralHumRollNotes(prev[layerId].rollNotes, quantize, captureBars);
      return {
        ...prev,
        [layerId]: { ...prev[layerId], rollNotes: next, dirty: true },
      };
    });
  }, [captureBars, commitFromRaw, quantize]);

  // Intensity valve — re-gate the active take without re-recording.
  const prevIntensityRef = useRef(intensity);
  useEffect(() => {
    if (prevIntensityRef.current === intensity) return;
    prevIntensityRef.current = intensity;
    const layerId = activeLayerRef.current;
    const raw = rawNotesByLayerRef.current[layerId];
    if (!raw || raw.length === 0) return;
    commitFromRaw(raw, keyLockRef.current, `intensity ${clampHumCaptureIntensity(intensity)}`);
  }, [commitFromRaw, intensity]);

  // Changing quantize or BPM re-snaps the active take onto the new grid.
  const prevQuantizeForResnapRef = useRef(quantize);
  const prevBpmForResnapRef = useRef(bpm);
  useEffect(() => {
    const quantizeChanged = prevQuantizeForResnapRef.current !== quantize;
    const bpmChanged = prevBpmForResnapRef.current !== bpm;
    prevQuantizeForResnapRef.current = quantize;
    prevBpmForResnapRef.current = bpm;
    if (!quantizeChanged && !bpmChanged) return;
    const layerId = activeLayerRef.current;
    const raw = rawNotesByLayerRef.current[layerId];
    if (raw.length === 0) {
      if (quantizeChanged) {
        setLayers((prev) => {
          const next = quantizeNeuralHumRollNotes(prev[layerId].rollNotes, quantize, captureBars);
          return {
            ...prev,
            [layerId]: { ...prev[layerId], rollNotes: next, dirty: true },
          };
        });
      }
      return;
    }
    commitFromRaw(raw, keyLockRef.current, quantizeChanged ? 're-grid' : 're-tempo');
  }, [bpm, captureBars, commitFromRaw, quantize]);

  const handleApply = useCallback(() => {
    const layerId = activeLayerRef.current;
    const draft = layers[layerId];
    const mono = enforceMonophonicRollNotes(draft.rollNotes);
    if (mono.length === 0 || !onApply) return;
    const gridBpm = gridBpmRef.current || se2ClickGridTempo(bpm).bpm;
    const timed = rollNotesToTimed(mono, gridBpm);
    const notes = timedNotesToStudioMidiNotes(timed, gridBpm, 0);
    if (notes.length === 0) return;
    const meta = ROLL_LAYERS.find((l) => l.id === layerId) ?? ROLL_LAYERS[0]!;
    onApply({
      notes,
      instrumentId: draft.instrumentId,
      rollBars: captureBars,
      layer: layerId,
    });
    patchActiveLayer({ dirty: false }, layerId);
    flash(`${meta.saveLabel} → Beat Lab CH ${layerId === 'bass' ? 18 : layerId === 'lead' ? 19 : 17} (${notes.length} notes)`);
  }, [bpm, captureBars, flash, layers, onApply, patchActiveLayer]);

  const applyAllLayersToPads = useCallback(() => {
    if (!onApply) {
      flash('To Pads — wire Beat Lab first (reload / open from Beat Pads).');
      return;
    }
    const gridBpm = gridBpmRef.current || se2ClickGridTempo(bpm).bpm;
    let applied = 0;
    for (const meta of ROLL_LAYERS) {
      const draft = layers[meta.id];
      const mono = enforceMonophonicRollNotes(draft.rollNotes);
      if (mono.length === 0) continue;
      const timed = rollNotesToTimed(mono, gridBpm);
      const notes = timedNotesToStudioMidiNotes(timed, gridBpm, 0);
      if (notes.length === 0) continue;
      onApply({
        notes,
        instrumentId: draft.instrumentId,
        rollBars: captureBars,
        layer: meta.id,
      });
      patchActiveLayer({ dirty: false }, meta.id);
      applied += 1;
    }
    flash(
      applied > 0
        ? `To Pads — ${applied} Hum layer(s) → Beat Lab SYNTH`
        : 'To Pads — no melody notes yet (Rec first)',
    );
  }, [bpm, captureBars, flash, layers, onApply, patchActiveLayer]);

  const lastSyncToPadsNonceRef = useRef(syncToPadsNonce);
  useEffect(() => {
    if (syncToPadsNonce === lastSyncToPadsNonceRef.current) return;
    lastSyncToPadsNonceRef.current = syncToPadsNonce;
    if (syncToPadsNonce <= 0) return;
    applyAllLayersToPads();
  }, [applyAllLayersToPads, syncToPadsNonce]);

  const resolveRollAudioCtx = useCallback((): AudioContext => {
    const ctx = getAudioContext?.();
    if (ctx && ctx.state !== 'closed') {
      if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
      return ctx;
    }
    // Fallback so Play still works if Beat Pads ctx isn't ready.
    const fallback = new AudioContext();
    return fallback;
  }, [getAudioContext]);

  const resolveRollDest = useCallback((): AudioNode => {
    const ctx = resolveRollAudioCtx();
    return ensurePreviewGain(ctx);
  }, [ensurePreviewGain, resolveRollAudioCtx]);

  const recording =
    !clickPlayActive && (capture.isRecording || isPrecounting || recSessionActive);
  const blocked = disabled || drumsBusy;
  const toolsLocked = blocked || busy || recording || clickPlayActive;
  /** Same rounded tempo as metro clicks — audition / apply must match the 1/16 grid. */
  const rollBpm = se2ClickGridTempo(bpm).bpm;

  const scopeScalePcs = useMemo(
    () => (keyLockMode === 'off' ? [] : neuralHumScalePitchClasses(keyRoot, scaleId)),
    [keyLockMode, keyRoot, scaleId],
  );
  const scopeKeyLabel =
    keyLockMode === 'off' ? null : neuralHumKeyLabel(keyRoot, scaleId);

  const chipClass = (on: boolean, tone?: 'warm' | 'cool' | 'mint' | 'rec') => {
    const parts = ['vb-hum-chip'];
    if (on) parts.push('vb-hum-chip--on');
    if (tone === 'warm') parts.push('vb-hum-chip--warm');
    if (tone === 'cool') parts.push('vb-hum-chip--cool');
    if (tone === 'mint') parts.push('vb-hum-chip--mint');
    if (tone === 'rec') parts.push('vb-hum-chip--rec');
    return parts.join(' ');
  };

  return (
    <div
      className="flex flex-col gap-2 p-2 min-h-0 h-full overflow-y-auto"
      data-beat-pads-vocalbox-hum-melody
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 shrink-0">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="vb-hum-title">Hum Melody</span>
          <span className="vb-hum-subtitle">
            {Math.round(bpm)} BPM · {activeLayerMeta.tab} · audio → MIDI
            {scopeKeyLabel ? ` · key ${scopeKeyLabel}` : ' · key off'}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {onBpmChange ? (
            <label className="vb-hum-vol" title="Shared Beat Pads / VocalBox tempo" style={{ gap: 4 }}>
              BPM
              <button
                type="button"
                disabled={blocked || busy || recording}
                className={chipClass(false)}
                style={{ height: 22, minHeight: 22, padding: '0 6px' }}
                onClick={() => onBpmChange(clampBeatPadsBpm(bpm - 1))}
                aria-label="Decrease BPM"
              >
                −
              </button>
              <input
                type="number"
                min={40}
                max={240}
                value={Math.round(bpm)}
                disabled={blocked || busy || recording}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v)) onBpmChange(clampBeatPadsBpm(v));
                }}
                style={{
                  width: 44,
                  height: 22,
                  borderRadius: 4,
                  border: '1px solid rgba(0,229,255,0.35)',
                  background: 'rgba(0,0,0,0.35)',
                  color: '#c8f0ff',
                  fontFamily: "'Rajdhani', 'Exo 2', system-ui, sans-serif",
                  fontWeight: 700,
                  fontSize: 12,
                  textAlign: 'center',
                }}
                aria-label="Hum Melody BPM"
              />
              <button
                type="button"
                disabled={blocked || busy || recording}
                className={chipClass(false)}
                style={{ height: 22, minHeight: 22, padding: '0 6px' }}
                onClick={() => onBpmChange(clampBeatPadsBpm(bpm + 1))}
                aria-label="Increase BPM"
              >
                +
              </button>
            </label>
          ) : null}
          <button
            type="button"
            disabled={blocked}
            onClick={() => onPartsSyncChange?.(!partsSync)}
            className={chipClass(partsSync, 'mint')}
            title={
              partsSync
                ? 'Sync ON — Play starts VocalBox drums + Hum Melody together'
                : 'Sync OFF — Play each part alone'
            }
          >
            Sync {partsSync ? 'On' : 'Off'}
          </button>
          <button
            type="button"
            disabled={blocked || busy}
            onClick={() => {
              if (onSyncToBeatPads) onSyncToBeatPads();
              else applyAllLayersToPads();
            }}
            className={chipClass(false, 'mint')}
            title="Push drums + all Hum layers onto Beat Pads / Beat Lab"
          >
            To Pads
          </button>
        </div>
      </div>

      <VocalBoxHumIntensitySlider
        size="full"
        value={intensity}
        onChange={setIntensity}
        disabled={blocked || busy || recording}
        ariaLabel="Hum Melody note intensity gate"
        helpTitle="Hum Melody Intensity"
        helpBody={
          'Controls how easy hummed / sung notes get onto the piano roll after Analyze.\n\nHard (low) = only strong, clear melody notes pass — weak ghosts, clicks, and scraps stay out.\n\nOpen (high) = softer / quieter notes can also enter the roll.\n\nDefault 55 is the locked sweet spot. Drag after a take to re-gate without recording again. Independent from VocalBox Intensity.'
        }
      />

      <div className="flex flex-wrap items-start gap-3 min-w-0">
        <div className="vb-hum-panel shrink-0 p-1.5">
          <NeuralHumPitchScope
            dialSize={132}
            scalePitchClasses={scopeScalePcs}
            livePitchClass={liveLockedPc}
            liveMidi={liveLockedMidi}
            trail={trail}
            keyLabel={scopeKeyLabel}
            isRecording={recording}
          />
        </div>

        <div className="flex flex-col gap-2 flex-1 min-w-[180px]">
          <div className="flex items-center gap-1.5">
            <Lock size={12} strokeWidth={2.4} style={{ color: HUM_ACCENT, flexShrink: 0 }} aria-hidden />
            <span className="vb-hum-section-label">Key lock</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {KEY_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                disabled={blocked || busy}
                onClick={() => setKeyLockMode(m.id)}
                className={chipClass(keyLockMode === m.id)}
                title={
                  m.id === 'off'
                    ? 'Chromatic capture — keep raw pitches from the mic take'
                    : m.id === 'manual'
                      ? 'Optional — snap MIDI into the root + scale you pick (after Analyze)'
                      : 'Optional — detect key from your take, then snap (after Analyze)'
                }
              >
                {m.label}
              </button>
            ))}
          </div>

          {keyLockMode !== 'off' ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <select
                disabled={blocked || busy || keyLockMode === 'auto'}
                value={keyRoot}
                onChange={(e) => setKeyRoot(Number(e.target.value))}
                className="vb-hum-select"
                style={{ opacity: keyLockMode === 'auto' ? 0.55 : 1 }}
                title="Key root"
                aria-label="Key root"
              >
                {NEURAL_HUM_KEY_NAMES.map((name, i) => (
                  <option key={name} value={i}>
                    {name}
                  </option>
                ))}
              </select>
              <select
                disabled={blocked || busy || keyLockMode === 'auto'}
                value={scaleId}
                onChange={(e) => setScaleId(e.target.value as NeuralHumScaleId)}
                className="vb-hum-select max-w-[10rem]"
                style={{ opacity: keyLockMode === 'auto' ? 0.55 : 1 }}
                title="Scale"
                aria-label="Scale"
              >
                {NEURAL_HUM_SCALES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={blocked || busy || !hasRawTake}
                onClick={resnapToKey}
                className={chipClass(false, 'mint')}
                title="Re-snap last take to the key/scale above"
              >
                Re-key
              </button>
            </div>
          ) : (
            <p className="vb-hum-status m-0">Key off — pitches stay as sung (chromatic).</p>
          )}

          <div className="vb-hum-tools-row flex flex-wrap items-center">
            <button
              type="button"
              disabled={toolsLocked}
              onClick={() => setPrecountEnabled((v) => !v)}
              className={chipClass(precountEnabled, 'warm')}
              title={precountEnabled ? 'Pre-count 4-3-2-1 (synced to clicks)' : 'Count-in off'}
            >
              Cnt
            </button>
            {([1, 2] as const).map((bars) => (
              <button
                key={`cnt-${bars}`}
                type="button"
                disabled={toolsLocked || !precountEnabled}
                onClick={() => setPrecountBars(bars)}
                className={chipClass(precountEnabled && precountBars === bars, 'warm')}
                title={`${bars}-bar count-in`}
              >
                {bars}b
              </button>
            ))}
            <button
              type="button"
              disabled={toolsLocked}
              onClick={() => setRecordMetroEnabled((v) => !v)}
              className={chipClass(recordMetroEnabled, 'cool')}
              title={
                recordMetroEnabled
                  ? 'Metronome during melody capture'
                  : 'Metronome off during capture'
              }
            >
              Mtr
            </button>
            {([4, 8] as const).map((bars) => {
              const allowed = bars <= maxBars;
              return (
                <button
                  key={bars}
                  type="button"
                  disabled={toolsLocked || !allowed}
                  onClick={() => setCaptureBars(bars)}
                  className={chipClass(captureBars === bars)}
                  title={allowed ? `Capture ${bars} bars` : `Loop is only ${maxBars} bars`}
                >
                  {bars} bar
                </button>
              );
            })}
            <select
              disabled={toolsLocked}
              value={instrumentId}
              onChange={(e) =>
                patchActiveLayer({ instrumentId: e.target.value as NeuralHumInstrumentId })
              }
              className="vb-hum-select"
              title={`Instrument for ${activeLayerMeta.tab}`}
              aria-label={`${activeLayerMeta.tab} instrument`}
            >
              {INSTRUMENTS.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={blocked || busy || clickPlayActive}
              onClick={() => {
                if (recording) stopRecording();
                else void beginRecord();
              }}
              className={`inline-flex items-center gap-1.5 ${chipClass(recording, recording ? 'rec' : undefined)}`}
              title={
                drumsBusy
                  ? 'Stop VocalBox drum Rec first'
                  : recording
                    ? 'Stop'
                    : `Count-in then hum ${activeLayerMeta.tab.toLowerCase()}`
              }
            >
              {recording ? <Square size={10} fill="currentColor" /> : <Mic size={10} />}
              {recording ? 'Stop' : 'Rec'}
            </button>
            <button
              type="button"
              disabled={blocked || busy || recording}
              onClick={toggleClickPlay}
              className={`inline-flex items-center gap-1.5 ${chipClass(clickPlayActive, 'mint')}`}
              title={
                clickPlayActive
                  ? 'Stop click play'
                  : 'Play Cnt/Mtr + count box (no record) — lock number to clicks'
              }
            >
              {clickPlayActive ? (
                <Square size={10} fill="currentColor" />
              ) : (
                <Play size={10} fill="currentColor" />
              )}
              {clickPlayActive ? 'Stop' : 'Play'}
            </button>
            <label className="vb-hum-vol" title="Playback / preview volume">
              Vol
              <input
                type="range"
                min={40}
                max={200}
                step={5}
                value={previewDynamics}
                disabled={blocked}
                onChange={(e) => setPreviewDynamics(Number(e.target.value))}
                style={{ width: 72, accentColor: '#7cf4c6' }}
                aria-label="Melody preview volume"
              />
            </label>
            <button
              type="button"
              disabled={blocked || busy || rollNotes.length === 0 || !onApply}
              onClick={handleApply}
              className={chipClass(rollNotes.length > 0, 'mint')}
              title={`${activeLayerMeta.saveLabel} → Hum Capture track`}
            >
              {activeLayerMeta.saveLabel}
            </button>
          </div>
          <div className="vb-rec-count-below" title="Count locks to Cnt/Mtr clicks">
            <div
              ref={recCountBoxRef}
              className="vb-rec-count-box vb-rec-count-box--idle"
              aria-live="off"
              aria-label="Record beat count"
            >
              <span ref={recBeatDigitRef} />
            </div>
          </div>
        </div>
      </div>

      <div className="vb-hum-roll-shell min-h-0 flex flex-col" style={{ minHeight: 220 }}>
        <HumMelodyBeatRuler
          captureBars={captureBars}
          beatsPerBar={BEATS_PER_BAR}
          rulerRef={beatRulerRef}
        />
        <div className="vb-hum-roll-tabs" role="tablist" aria-label="Hum Capture rolls">
          {ROLL_LAYERS.map((layer) => {
            const count = layers[layer.id].rollNotes.length;
            const on = activeLayer === layer.id;
            return (
              <button
                key={layer.id}
                type="button"
                role="tab"
                aria-selected={on}
                disabled={blocked || recording || busy}
                onClick={() => setActiveLayer(layer.id)}
                className={`vb-hum-roll-tab${on ? ' vb-hum-roll-tab--on' : ''}${
                  layer.id === 'bass' ? ' vb-hum-roll-tab--bass' : ''
                }${layer.id === 'lead' ? ' vb-hum-roll-tab--lead' : ''}`}
                title={
                  on
                    ? `${layer.tab} (active)`
                    : `Switch to ${layer.tab} — same roll space, separate notes`
                }
              >
                {layer.tab}
                {count > 0 ? <span className="vb-hum-roll-tab-count">{count}</span> : null}
              </button>
            );
          })}
        </div>
        <Suspense
          fallback={
            <p className="vb-hum-status m-0 px-3 py-3">Loading {activeLayerMeta.rollLabel}…</p>
          }
        >
          <NeuralHumMelodyRollLazy
            key={activeLayer}
            rollNotes={rollNotes}
            onRollNotesChange={syncDraftFromRoll}
            onClearAll={() => {
              const id = activeLayerRef.current;
              rawNotesByLayerRef.current[id] = [];
              patchActiveLayer(
                { rollNotes: [], dirty: false, hasRawTake: false },
                id,
              );
              flash(`${activeLayerMeta.rollLabel} cleared.`);
            }}
            canClearAll={rollNotes.length > 0 || hasRawTake}
            bars={captureBars}
            onBarsChange={(bars) => {
              if (bars <= maxBars) setCaptureBars(bars);
            }}
            bpm={rollBpm}
            quantize={quantize}
            onQuantizeChange={(q) => setQuantize(clampHumCaptureQuantize(q))}
            onQuantizeNow={handleQuantizeNow}
            onApplyToTrack={onApply ? handleApply : undefined}
            applyToTrackDirty={rollDirty}
            instrumentId={instrumentId}
            transpose={0}
            dynamics={previewDynamics}
            keyRoot={keyRoot}
            scaleId={scaleId}
            keyLockOff={keyLockMode === 'off'}
            getAudioContext={resolveRollAudioCtx}
            getDestination={resolveRollDest}
            showExport={false}
            isAnalyzing={isAnalyzingTake}
            rollLabel={activeLayerMeta.rollLabel}
            showRollTitle={false}
            onAuditionStart={() => {
              if (partsSync) onSyncPlayDrums?.();
            }}
            auditionNonce={syncAuditionNonce + localAuditionNonce}
            auditionStopNonce={syncAuditionStopNonce + localAuditionStopNonce}
            getAuditionStartAtSec={getSyncAuditionStartAtSec}
          />
        </Suspense>
      </div>

      <p className="vb-hum-status m-0 shrink-0 line-clamp-2">
        {drumsBusy
          ? 'Drum Rec active — finish VocalBox drums (Send) first.'
          : status}
        {rollNotes.length > 0 ? (
          <span style={{ color: HUM_ACCENT }}>
            {' '}
            · {rollNotes.length} on {activeLayerMeta.tab.toLowerCase()}
          </span>
        ) : null}
      </p>
    </div>
  );
}
