import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useSyncExternalStore,
  useRef,
  useCallback,
  useMemo,
  memo,
} from 'react';
import type { MutableRefObject } from 'react';
import { createPortal } from 'react-dom';
import { Send, ZoomIn, ZoomOut, Maximize2, Minimize2, Zap, ChevronUp, ChevronDown, Volume2, Play, Pause, Square, Circle, SkipBack, Repeat, Save, Cable, Mic, Upload, FolderOpen, X, Download, Plus, SlidersHorizontal, Music2, Waves, Copy, Undo2 } from 'lucide-react';

import {
  useMasterClock,
  PPQ,
} from '@/app/context/MasterClockContext';
import { useSettings } from '@/app/context/SettingsContext';

import { usePianoNotes } from '@/app/context/PianoNotesContext';
import LoopMarkersBrace, { LoopVerticalGuides } from '@/app/components/LoopMarkersBrace';


import {
  computeUsedCreationChannelMeta,
  writeCreationChannelManifestToStorage,
  DA_SESSION_TRACKS_SYNC_EVENT,
  CREATION_PAD_NAMES as PAD_NAMES,
  CREATION_PAD_COLORS as PAD_COLORS,
} from '@/app/lib/sessionChannelTracks';

import { CREATION_STATION_CLIP_DATA_KEY } from '@/app/lib/sessionClipContent';

/* Beat Lab: **own** transport (CreationStation + creationStation/*). Mirrors proven DAW patterns
 * that also exist in Studio Editor 2 — SE2 is read-only reference; never import/link/edit SE2 here.
 * `se2TransportClock` = shared math/constants only, not SE2 transport state. */
import {
  SE2_AUDIO_START_FLOOR_SEC,
  refillCreationMetronome,
  refillCreationTransportLookahead,
  resetCreationTransportStepClock,
  reanchorNextStepWhileRunning,
  reanchorNextStepWhileStopped,
  seedCreationTransportOnPlay,
} from '@/app/lib/creationStation/creationTransportSystem';
import { useCreationTransportPump } from '@/app/hooks/useCreationTransportPump';
import {
  getCreationTransportBeatEpoch,
  publishCreationTransportBeat,
  subscribeCreationTransportBeat,
} from '@/app/lib/creationStation/creationTransportBeatExternal';
import {
  beatAtSessionTime,
  ensureCreationMetronomeClickBuffers,
  scheduleCreationMetronomeClickAt,
  setCreationBeatLabTransportRunning,
  type CreationMetronomeClickBuffers,
  type CreationScheduledMetroNode,
} from '@/app/lib/creationStation/creationTransportSync';
import { smoothSchedNow, updateSchedAnchor } from '@/app/lib/studio/se2TransportClock';
import {
  beatFromCreationPlaylineWapiAnim,
  CREATION_DRUM_PLAYLINE_CENTER_X,
  CREATION_PIANO_PLAYLINE_CENTER_X,
  CREATION_PLAYLINE_WAPI_SEG_IDLE,
  cancelCreationPlaylineWapi,
  creationPlaylineColFAndPx,
  launchCreationPlaylineWapi,
  seekRunningCreationPlaylineWapi,
  setCreationPlaylineTransformStatic,
  type CreationPlaylineWapiSegState,
} from '@/app/lib/creationStation/creationPlaylineWapi';
import {
  beatLabMeasureRulerLabel,
  creationDrumGridStepBottomBorder,
  creationDrumGridVerticalLineColor,
} from '@/app/lib/creationStation/creationDrumGridAdaptive';
import {
  beatLabDrumStepTileLook,
  beatLabTileGridActive,
  loadBeatLabTileGridPref,
  saveBeatLabTileGridPref,
} from '@/app/lib/creationStation/beatLabTileGrid';

import {
  defaultPadSamplerPlaybackOpts,
  fileToStoredPadSample,
  loadPadSampleStore,
  padSampleKey,
  type PadSamplerPlaybackOpts,
  type StoredPadSample,
  samplerOptsFromStored,
  savePadSampleStore,
  storedToArrayBuffer,
  writeSamplerOptsToStored,
} from '@/app/lib/padSampleStorage';
import {
  clonePadSamplerFxRack,
  connectPadSamplerFxRack,
  padSamplerDelayTimeLabel,
  padSamplerDelayTimeMs,
  PAD_SAMPLER_DELAY_NOTE_OPTIONS,
  defaultPadSamplerFxRack,
  fxRackFromStored,
  padSamplerFxRackIsActive,
  writeFxRackToStored,
  type PadSamplerFxRack,
} from '@/app/lib/creationStation/padSamplerFxRack';
import { DrumKitGeneratorModal } from '@/app/components/creation/DrumKitGeneratorModal';
import { TrapKitBrowserPanel } from '@/app/components/creation/TrapKitBrowserPanel';
import { SoundFamiliesBar } from '@/app/components/creation/SoundFamiliesBar';
import { PatternBankPanel } from '@/app/components/creation/PatternBankPanel';
import { presetToBeatLabDrums } from '@/app/lib/creationStation/beatLabPatternBank';
import { BEAT_LAB_DEFAULT_BPM } from '@/app/lib/creationStation/beatLabFactoryDefaults';
import type { PatternPreset } from '@/app/lib/patternPresets';
import {
  audioBufferToStoredKitSample,
  buildKitGroovePattern,
  synthesizeKitPadBuffer,
  type DrumKitGeneratorStyle,
} from '@/app/lib/creationStation/drumKitGenerator';
import { ChordBuilderTab } from '@/app/components/creation/ChordBuilderTab';
import {
  beatLabPatternColsForLoop,
  chordBuilderSongRollToBeatLabRoll,
} from '@/app/lib/creationStation/chordBuilderBeatLabImport';
import type { ChordBuilderBeatLabImportSection } from '@/app/lib/creationStation/chordBuilderBeatLabImport';
import { BeatLabPianoRoll } from '@/app/components/creation/BeatLabPianoRoll';
import { BeatLabSnapGridOverlay } from '@/app/components/creation/BeatLabSnapGridOverlay';
import { BeatLabMelodicChannelPanel } from '@/app/components/creation/BeatLabMelodicChannelPanel';
import { BeatLabSynthPianoRoll } from '@/app/components/creation/BeatLabSynthPianoRoll';
import {
  BEAT_LAB_MELODIC_DEFAULT_INSTRUMENTS,
  BEAT_LAB_MELODIC_INSTRUMENT_OPTIONS,
  beatLabMelodicSlotIndex,
  normalizeBeatLabMelodicInstruments,
  previewBeatLabMelodicNote,
  scheduleBeatLabMelodicNote,
  resetBeatLabMelodicWarmupFlag,
  startBeatLabMelodicPreview,
  warmupBeatLabMelodicSoundfont,
} from '@/app/lib/creationStation/beatLabMelodicSoundfont';
import { beatLabSynthWapiPianoColW } from '@/app/lib/creationStation/beatLabChordPianoRollAdapter';
import { beatLabNoteMidi, beatLabPitchSemiForMidi } from '@/app/lib/creationStation/beatLabMelodicSynth';
import {
  BeatLabEditToolToggle,
  BeatLabHistoryControls,
} from '@/app/components/creation/BeatLabGridControls';
import {
  BEAT_LAB_UNDO_STACK_MAX,
  BEAT_LAB_DUP_UNDO_STACK_MAX,
  captureBeatLabHistorySnapshot,
  cloneBeatLabBanks,
  restoreBeatLabHistorySnapshot,
  type BeatLabHistorySnapshot,
} from '@/app/lib/creationStation/beatLabBankHistory';
import {
  beatLabMelodicLanePitch,
  beatLabPadPlaybackRateDetune,
  beatLabLaneIsPad,
  beatLabRollNotesOverlap,
  BEAT_LAB_PAD_LANES,
  BEAT_LAB_MIDI_LANES,
  BEAT_LAB_MELODIC_LANE_START,
  BEAT_LAB_ROLL_LABEL_W,
  clampBeatLabNoteLen,
  beatLabNoteResizeFromStartHead,
  beatLabSliceColForPointer,
  normalizeBeatLabMidiRoll,
  beatLabSplitMidiNoteAt,
  type BeatLabDeckFocus,
  type BeatLabGridZoomMode,
  type BeatLabGridLayoutMode,
  type BeatLabEditTool,
  type BeatLabMidiNote,
} from '@/app/lib/creationStation/beatLabMidiRoll';
import {
  beatLabDrumBrushValue,
  beatLabDrumCellKey,
  beatLabDrumCellsAlongSegment,
  beatLabDrumCellFromPointer,
  beatLabToolUsesDrumBrush,
} from '@/app/lib/creationStation/beatLabGridPaint';
import type { BeatLabPitchAutomationSelection } from '@/app/components/creation/BeatLabBarAutomationLanes';
import {
  beatLabBarFineStart,
  beatLabCopyAutomationSegment,
  beatLabEffectiveVelocity,
  beatLabFineColsPerBar,
  beatLabPasteAutomationSegment,
  beatLabPitchSemiAtColumn,
  beatLabPitchSliceMidiNoteAt,
  normalizeBeatLabPitchAutomation,
  normalizeBeatLabVolAutomation,
} from '@/app/lib/creationStation/beatLabAutomation';
import {
  creationSubScreenToTab,
  type CreationSubScreenId,
} from '@/app/lib/creationStation/creationSubScreens';
import ChordSequencerScreen from '@/app/screens/ChordSequencerScreen';
import GrooveLabScreen from '@/app/screens/GrooveLabScreen';
import EightZeroEightTab from '@/app/screens/EightZeroEightTab';
import { uint8ArrayToBase64 } from '@/app/lib/creationStation/chordRender';
import {
  assignTrapDrumFolderToPads,
  BRASS_ROOM_BANK_INDEX,
  BRASS_ROOM_KIT_DISPLAY_NAME,
  trapPadSamplerOpts,
} from '@/app/lib/creationStation/beatLabFolderImport';
import { trapKitInstrumentLabel } from '@/app/lib/creationStation/trapKitBrowser';
import {
  familyInstrumentLabel,
  fetchAndDecodeFamilySample,
  fetchSoundFamiliesCatalog,
  samplerOptsForFamily,
  type SoundFamily,
} from '@/app/lib/creationStation/soundFamiliesCatalog';
import { soundFamilySampleDisplayTitle } from '@/app/lib/creationStation/soundFamilySampleTitles';
import { loadBrassRoomBankFromPublic } from '@/app/lib/creationStation/brassRoomBankLoader';
import {
  BEAT_LAB_PRODUCER_KITS,
  beatLabProducerKitMeta,
  loadBeatLabProducerKitPads,
  type BeatLabProducerKitId,
} from '@/app/lib/creationStation/beatLabProducerKits';
import {
  captureActiveBankKitPads,
  countSavedKitPads,
  deleteBeatLabSavedKit,
  findBeatLabSavedKit,
  loadBeatLabSavedKits,
  renameBeatLabSavedKit,
  upsertBeatLabSavedKit,
  type BeatLabSavedKit,
} from '@/app/lib/creationStation/beatLabSavedKits';
import {
  captureBeatLabSongSnapshot,
  countSequenceSteps,
  deleteBeatLabSavedSong,
  findBeatLabSavedSong,
  loadBeatLabSavedSongs,
  renameBeatLabSavedSong,
  upsertBeatLabSavedSong,
  type BeatLabSavedSong,
} from '@/app/lib/creationStation/beatLabSavedSongs';

import {
  BEAT_LAB_DRUMLOOP_SNAP_SUBDIV,
  drumloopLoopBarsForVariant,
  type BeatLabDrumloopPresetVariant,
} from '@/app/lib/creationStation/beatLabDrumloopPreset';
import {
  beatLabDuplicateLoopPattern,
  beatLabLoopSpanPatternCols,
} from '@/app/lib/creationStation/beatLabDuplicateLoop';
import {
  normalizePianoSnapSubdiv,
  PIANO_SNAP_SUBDIV_STORAGE_KEY,
  readPianoSnapSubdivFromStorage,
  snapLabelFromPianoSnapSubdiv,
  ticksPerPianoSnapCell,
} from '@/app/lib/sharedPianoSnapSubdiv';

const DMB_STUDIO_PRECOUNT_CANCEL = 'dmb-studio-precount-cancel';

// ?? MIDI Note to Frequency (standard A=440Hz) ??????????????????????????????????

const NOTE_NAMES   = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

function midiNoteToFreq(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

function noteNameToMidi(name: string): number {
  const octave = parseInt(name[name.length - 1]);
  const noteName = name.slice(0, -1);
  const noteIdx = NOTE_NAMES.indexOf(noteName);
  return octave * 12 + noteIdx + 12;
}

function midiToNoteName(midi: number): string {
  const safeMidi = Math.max(12, Math.min(119, midi));
  const noteName = NOTE_NAMES[safeMidi % 12];
  const octave = Math.floor(safeMidi / 12) - 1;
  return `${noteName}${octave}`;
}


// ?? Constants ?????????????????????????????????????????????????????????????????

const KITS         = ['Default','Trap 808','Lo-Fi','Acoustic','Electronic','Afrobeats'];

const BANKS        = ['A','B','C','D','E','F','G','H'];

const NOTES        = ['C5','B4','A#4','A4','G#4','G4','F#4','F4','E4','D#4','D4','C#4','C4','B3','A#3','A3'];

const PAD_VEL      = [115,90,90,90,90,90,90,90,90,90,90,90,90,90,90,127];

const INSTRUMENTS  = ['Piano','Synth','Bass','Lead'];


const DRUM_GRID_BARS   = 16;
const CREATION_PIANO_BARS = 64;

const TOTAL_BARS       = CREATION_PIANO_BARS;

const MEASURES_PER_BAR = 4;
/** User rule: four metronome quarter-clicks = four ?measures? = one Creation ?bar? ? never use time-sig `qpb` here. */
const CREATION_QUARTERS_PER_BAR = MEASURES_PER_BAR;
/** 4/4 phrase: one measure = 4 quarter-note beats; bar-group cycles every 4 measures (16 beats). */
const BEATS_PER_MEASURE_44 = MEASURES_PER_BAR;
const MEASURES_PER_4BAR_PHRASE = 4;

const TOTAL_COLS       = TOTAL_BARS * MEASURES_PER_BAR;

/** Piano roll ruler: each song bar is always `MEASURES_PER_BAR` quarter columns (4 clicks = 1 bar). */
const PIANO_RULER_BAR_STEP_COUNTS = Array.from(
  { length: CREATION_PIANO_BARS },
  () => MEASURES_PER_BAR,
);

const KEY_W            = 64;

/** Wider rail for Genius-style sound-bank labels (group + name + CH). */
const LABEL_W          = 124;

/** Piano-roll note mode: one row height per semitone (pitch lane). */
const ROW_H            = 22;

const MIN_CW           = 24;

const MAX_CW           = 128;

/** Default column width on app open (slider minimum = widest zoom-out view). */
const DEF_CW           = MIN_CW;

const ZOOM_STEP        = 4;

/** Step sequencer lane height (16 pad lanes). */
const DRUM_GRID_ROW_H  = 40;
/** Sticky MEASURES row above the step grid. */
const DRUM_SEQ_MEASURES_ROW_H = 16;
/** BARS + quant label band (two stacked sub-rows). */
const DRUM_SEQ_QUANT_SUBROW_H = 11;
const DRUM_SEQ_QUANT_BAND_H = DRUM_SEQ_QUANT_SUBROW_H * 2;
/** Bar labels inside the sticky quant {@link Ruler} (drum grid only). */
const DRUM_SEQ_RULER_BAR_ROW_H = 9;
/** Step digits (1?16) inside the sticky quant {@link Ruler} (drum grid only). */
const DRUM_SEQ_RULER_STEP_ROW_H = DRUM_SEQ_QUANT_BAND_H - DRUM_SEQ_RULER_BAR_ROW_H;
const DRUM_SEQ_HEADER_H = DRUM_SEQ_MEASURES_ROW_H + DRUM_SEQ_QUANT_BAND_H;
/** Step grid scroll area ? sticky ruler height before pad lanes (for brush hit-tests). */
const DRUM_GRID_SCROLL_HEADER_H = DRUM_SEQ_HEADER_H;
/** Sampler pad cell min height in 8?2 grid. */
const BEAT_LAB_PAD_CELL_MIN_H = 54;
const DRUM_GRID_MIN_CW = MIN_CW;
const PIANO_GRID_MIN_CW = 24;

/** Max ?cells per quarter? (1/128 straight ? 32; triplet modes use 3 / 6). */
const DRUM_MAX_SUBDIV = 32;

function resetCreationLoopWrapDetectRefs(
  wapiPrevPhaseMsRef: MutableRefObject<number>,
  wapiLoopCycleSeenRef: MutableRefObject<number>,
  loopPhaseRef: MutableRefObject<number>,
): void {
  wapiPrevPhaseMsRef.current = -1;
  wapiLoopCycleSeenRef.current = -1;
  loopPhaseRef.current = -1;
}

/** Compositor loop segment repeated (infinite iterations) — same edge test as SE2 WAAPI loop splice. */
function creationPlaylineWapiLoopWrapped(
  anim: Animation | null,
  prevPhaseMsRef: MutableRefObject<number>,
  cycleSeenRef: MutableRefObject<number>,
): boolean {
  if (!anim) return false;
  const timing = anim.effect?.getComputedTiming?.() ?? anim.effect?.getTiming?.();
  const rawDur = timing?.duration;
  const durMs = typeof rawDur === 'number' ? rawDur : rawDur != null ? Number(rawDur) : NaN;
  if (!Number.isFinite(durMs) || durMs < 16) return false;
  const phaseMs = anim.currentTime ?? 0;
  const prev = prevPhaseMsRef.current;
  const cycle = Math.floor(phaseMs / durMs);
  const cycleBumped = cycle > cycleSeenRef.current;
  const phaseRewind = prev >= 0 && phaseMs < prev - durMs * 0.25;
  prevPhaseMsRef.current = phaseMs;
  if (cycleBumped || phaseRewind) {
    if (phaseRewind && !cycleBumped) {
      cycleSeenRef.current = Math.max(cycleSeenRef.current, cycle);
    } else {
      cycleSeenRef.current = cycle;
    }
    return true;
  }
  return false;
}

function creationAudioLoopPhaseWrapped(
  bDisplay: number,
  loopStart: number,
  loopEnd: number,
  phaseRef: MutableRefObject<number>,
): boolean {
  const span = loopEnd - loopStart;
  if (span <= 0) return false;
  const phase = ((bDisplay - loopStart) % span + span) % span;
  const prev = phaseRef.current;
  phaseRef.current = phase;
  return prev >= 0 && phase < prev - span * 0.25;
}

/** One readout for BAR / MSR / phrase ? derived from the same pattern column as the playhead + ruler. */
type CreationHudSync = { bar: number; measure: number; phrase: number };

function creationDrumColOffsetSteps(
  loopOn: boolean,
  loopStartBeat: number,
  subdiv: number,
): number {
  const s = Math.max(1, Math.min(DRUM_MAX_SUBDIV, Math.round(subdiv)));
  return Math.floor(Math.max(0, loopOn ? loopStartBeat * s : 0) + 1e-8);
}

/** Integer pattern column `ci` ? same math as `beatMathCol` / playline loop wrap. */
function creationPatternColFromTransportStep(
  transportStepIndexLive: number,
  subdiv: number,
  patternColsDrums: number,
  loopOn: boolean,
  loopStartBeat: number,
  loopEndBeat: number,
  playMode: 'single' | 'chainAB',
): number {
  const subdivR = Math.max(1, Math.min(DRUM_MAX_SUBDIV, Math.round(subdiv)));
  const pcols = Math.max(1, patternColsDrums);
  const ls = Math.floor(loopStartBeat + 1e-8);
  const le = Math.floor(loopEndBeat + 1e-8);
  const lsStep = ls * subdivR;
  const leStep = le * subdivR;
  const drumColOffset = creationDrumColOffsetSteps(loopOn, loopStartBeat, subdivR);

  if (loopOn && leStep > lsStep) {
    if (transportStepIndexLive < lsStep) {
      return Math.max(0, Math.min(pcols - 1, transportStepIndexLive));
    }
    const span = Math.max(1, leStep - lsStep);
    const relLoop = Math.max(0, transportStepIndexLive - lsStep);
    const pos = (relLoop % span + span) % span;
    return ((pos % pcols) + pcols) % pcols;
  }
  const rel = Math.max(0, transportStepIndexLive - drumColOffset);
  if (playMode === 'chainAB') {
    return ((rel % pcols) + pcols) % pcols;
  }
  return Math.max(0, Math.min(pcols - 1, rel));
}

/** Pattern column from fractional beat ? same mapping as `creationPatternColFromTransportStep` + playline. */
function creationPatternColFromDisplayBeat(
  bDisplay: number,
  subdiv: number,
  patternColsDrums: number,
  loopOn: boolean,
  loopStartBeat: number,
  loopEndBeat: number,
  playMode: 'single' | 'chainAB',
): number {
  const subdivR = Math.max(1, Math.min(DRUM_MAX_SUBDIV, Math.round(subdiv)));
  const stepIdx = Math.floor(Math.max(0, bDisplay * subdivR) + 1e-8);
  return creationPatternColFromTransportStep(
    stepIdx,
    subdivR,
    patternColsDrums,
    loopOn,
    loopStartBeat,
    loopEndBeat,
    playMode,
  );
}

/** Resets quant cell imperative styles (legacy pump tint ? kept for tab switches / cleanup). */
function clearQuantMeasureCellImperativeLit(el: HTMLElement | null): void {
  if (!el) return;
  el.style.background = '#121212';
  el.style.color = '#b98ab9';
  el.style.boxShadow = 'none';
  el.removeAttribute('data-drum-quant-imperative-lit');
}

/** Parse `translate3d(tx px,?)` or CSS `matrix` / `matrix3d` translate X (px) from a keyframe string. */
function readTranslateXFromTransformString(t: string | undefined): number | null {
  if (!t) return null;
  const td = t.match(/translate3d\(\s*([-0-9.eE+]+)\s*px/i);
  if (td) {
    const v = parseFloat(td[1]!);
    return Number.isFinite(v) ? v : null;
  }
  if (t.startsWith('matrix3d(')) {
    const parts = t.slice(9, -1).split(/\s*,\s*/);
    if (parts.length >= 13) {
      const tx = parseFloat(parts[12]!);
      return Number.isFinite(tx) ? tx : null;
    }
    return null;
  }
  if (t.startsWith('matrix(')) {
    const parts = t.slice(7, -1).split(/\s*,\s*/);
    if (parts.length >= 6) {
      const tx = parseFloat(parts[4]!);
      return Number.isFinite(tx) ? tx : null;
    }
    return null;
  }
  return null;
}

/**
 * Read-only: translate X from the stored drum playline `Animation` (same timeline as compositor arrow).
 * Does not modify `currentTime` ? only reads keyframes + timing.
 */
function readDrumPlaylineTxFromKeyframeEffect(a: Animation | null): number | null {
  if (!a || (a.playState !== 'running' && a.playState !== 'paused')) return null;
  const eff = a.effect;
  if (!eff || !(eff instanceof KeyframeEffect)) return null;
  const kfs = eff.getKeyframes() as { transform?: string | string[] }[];
  if (kfs.length < 2) return null;
  const tf0 = kfs[0]?.transform;
  const tfL = kfs[kfs.length - 1]?.transform;
  const s0 = Array.isArray(tf0) ? tf0[0] : tf0;
  const s1 = Array.isArray(tfL) ? tfL[0] : tfL;
  const t0 = readTranslateXFromTransformString(s0);
  const t1 = readTranslateXFromTransformString(s1);
  if (t0 == null || t1 == null) return null;
  const span = t1 - t0;
  if (Math.abs(span) < 1e-6) return null;
  const ct = eff.getComputedTiming();
  const lp = (ct as ComputedEffectTiming & { localProgress?: number | null }).localProgress;
  let u: number;
  if (typeof lp === 'number' && Number.isFinite(lp)) {
    u = Math.min(1, Math.max(0, lp));
  } else {
    const dur = ct.duration;
    const cur = a.currentTime;
    if (typeof dur !== 'number' || dur <= 0 || typeof cur !== 'number' || !Number.isFinite(cur)) return null;
    const local = ((cur % dur) + dur) % dur;
    u = Math.min(1, Math.max(0, local / dur));
  }
  return t0 + (t1 - t0) * u;
}

function readTranslateXFromWapiKeyframeAnim(el: HTMLElement | null): number | null {
  if (!el) return null;
  for (const anim of el.getAnimations()) {
    const tx = readDrumPlaylineTxFromKeyframeEffect(anim);
    if (tx != null) return tx;
  }
  return null;
}

function readTranslateXFromComputedTransform(el: HTMLElement | null): number | null {
  if (!el) return null;
  const t = getComputedStyle(el).transform;
  if (!t || t === 'none') return null;
  return readTranslateXFromTransformString(t);
}

/**
 * BAR / MSR / phrase from **global** integer beat (same clock as SE2 `refillMetronome` / `k`).
 * - **Bar** stays anchored to the visible loop (`loopStartBar` + `loopStartBeat`) for ruler alignment.
 * - **Measure** uses the same phase as the metronome: `(?beat? ? transportOriginBeat) % q` so MSR
 *   rolls with **k % bpb** downbeats (Studio Editor 2), not pattern column `ci` (which repeats in a loop).
 */
function computeCreationTransportHudFromBeat(
  beatNow: number,
  opts: {
    subdiv: number;
    pcols: number;
    loopOn: boolean;
    loopStartBeat: number;
    loopEndBeat: number;
    playMode: 'single' | 'chainAB';
    loopStartBar: number;
    qpb: number;
    /** Same quarter index as `nextStepBeatRef` / SE2 `nextMetroKRef` at play (session origin beat). */
    transportOriginBeat: number;
  },
): CreationHudSync {
  const { loopStartBeat, loopStartBar, qpb, transportOriginBeat } = opts;
  void opts.subdiv;
  void opts.pcols;
  void opts.loopOn;
  void opts.loopEndBeat;
  void opts.playMode;
  const q = Math.max(2, Math.min(16, Math.round(qpb)));
  const bInt = Math.floor(Math.max(0, beatNow) + 1e-8);
  const lsB = Math.floor(Math.max(0, loopStartBeat) + 1e-8);
  const orgB = Math.floor(Math.max(0, transportOriginBeat) + 1e-8);
  const beatInRegion = Math.max(0, bInt - lsB);
  const bar = loopStartBar + Math.floor(beatInRegion / q);
  const measure = (((bInt - orgB) % q) + q) % q + 1;
  const phrase = Math.floor((Math.max(1, bar) - 1) / MEASURES_PER_4BAR_PHRASE) + 1;
  return { bar, measure, phrase };
}

/** Studio Editor 2 `formatBarsBeatsTicks` ? global bar ? beat-in-bar ? centisecond tick. */
function formatCreationSe2BarsBeatsTicks(displayBeats: number, beatsPerBar: number): string {
  const bpb = Math.max(1, beatsPerBar);
  const db = Math.max(0, displayBeats);
  const bar = Math.floor(db / bpb) + 1;
  const beatInBar = Math.floor(db % bpb) + 1;
  const tick = Math.floor((db % 1) * 100);
  return `${bar}.${beatInBar}.${String(tick).padStart(2, '0')}`;
}

/** Studio Editor 2 `formatTimeMmSsFf` ? MM:SS:cs from musical time at BPM. */
function formatCreationSe2TimeMmSsFf(beats: number, bpm: number): string {
  const totalSeconds = (Math.max(0, beats) / Math.max(1, bpm)) * 60;
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  const f = Math.floor((totalSeconds % 1) * 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
}

/** Fixed 1:1 pad index ? mixer channel (CH1?CH16); not user-editable. */
function creationPadMixerCh(padIndex: number): number {
  return padIndex + 1;
}

const CREATION_PAD_CHANNELS_FIXED = Array.from({ length: 16 }, (_, i) => i + 1);

// ?? BAR/MEASURE HUD: display-only from master transport frame state ????????????????????????????????

let creationRulerSeq = 0;
let creationRulerBeatHighlight: number | null = null;
const creationRulerListeners = new Set<() => void>();

function subscribeCreationRulerBeat(cb: () => void) {
  creationRulerListeners.add(cb);
  return () => creationRulerListeners.delete(cb);
}

function getCreationRulerSeq() {
  return creationRulerSeq;
}

function publishCreationRulerBeat(m: number | null) {
  if (creationRulerBeatHighlight === m) return;
  creationRulerBeatHighlight = m;
  creationRulerSeq += 1;
  creationRulerListeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

/** DOM slots RAF paints for BAR + beat-in-bar fraction + phrase (no separate MSR LED strip). */
type CreationHudDomSlots = {
  barDigits: HTMLSpanElement | null;
  msrFrac: HTMLSpanElement | null;
  phrase: HTMLSpanElement | null;
};

function paintCreationHudQuarterIntoDom(
  slots: CreationHudDomSlots,
  hud: CreationHudSync,
  qpb: number,
  opts: { active: boolean },
  holdRef: MutableRefObject<{ m: number; b: number; ph: number }>,
  publishBeatToRuler: boolean,
): void {
  const q = Math.max(2, Math.min(16, Math.round(qpb)));
  const m = Math.max(1, Math.min(q, hud.measure));
  const bar = Math.max(1, hud.bar);
  const ph = hud.phrase;
  holdRef.current = { m, b: bar, ph };
  const { active } = opts;
  const bEl = slots.barDigits;
  if (bEl) {
    bEl.textContent = String(bar).padStart(3, '0');
    bEl.style.color = active ? '#00E5FF' : '#4a4a58';
  }
  const msrEl = slots.msrFrac;
  if (msrEl) {
    msrEl.textContent = `${m}/${q}`;
  }
  const phEl = slots.phrase;
  if (phEl) {
    phEl.textContent = `PH${ph}`;
  }
  if (publishBeatToRuler) {
    publishCreationRulerBeat(m);
  }
}

type CreationTransportHudBarProps = {
  transportNotStopped: boolean;
  displayBarNumber: number;
  measureInBar: number;
  measureLedCount: number;
  paintHudFromRaf?: boolean;
  hudDomSlotsRef?: MutableRefObject<CreationHudDomSlots>;
  /** Compact row (sequence toolbar) vs transport strip */
  compact?: boolean;
};

/** BAR digits only ? {@link paintCreationHudQuarterIntoDom} updates `barDigits` during play/rec. */
function CreationTransportHudBar({
  transportNotStopped,
  displayBarNumber,
  measureInBar,
  measureLedCount,
  paintHudFromRaf,
  hudDomSlotsRef,
  compact,
}: CreationTransportHudBarProps) {
  const barTitle = `Creation bar ${displayBarNumber}. Measure ${measureInBar} of ${measureLedCount}.`;
  const showReactHudText = !paintHudFromRaf;
  return (
    <div
      role="group"
      aria-label={`Bar ${displayBarNumber}`}
      title={barTitle}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontFamily: 'monospace',
        padding: compact ? '0 2px' : undefined,
      }}
    >
      <span style={{ fontSize: compact ? 4 : 5, color: '#4a4a58', letterSpacing: 1.2, lineHeight: 1 }}>BAR</span>
      <span
        ref={(el) => {
          if (hudDomSlotsRef) hudDomSlotsRef.current.barDigits = el;
        }}
        style={{
          fontSize: compact ? 12 : 14,
          fontWeight: 900,
          color: paintHudFromRaf ? '#00E5FF' : transportNotStopped ? '#00E5FF' : '#4a4a58',
          lineHeight: 1,
        }}
      >
        {showReactHudText ? String(displayBarNumber).padStart(3, '0') : '\u2007\u2007\u2007'}
      </span>
    </div>
  );
}

/** Master volume ? rotary knob + vertical fader (shared 0?1 level). */
function BeatLabMasterVolume({
  value,
  onChange,
  disabled = false,
}: {
  value: number;
  onChange: (linear: number) => void;
  disabled?: boolean;
}) {
  const dragRef = useRef<{ startY: number; startVal: number } | null>(null);
  const linear = Math.max(0, Math.min(1, value));
  const pct = Math.round(linear * 100);
  const norm = pct / 100;
  const angle = -135 + norm * 270;
  const faderH = 72;

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const d = dragRef.current;
      if (!d) return;
      const dy = d.startY - e.clientY;
      const next = d.startVal + dy / 120;
      onChange(Math.max(0, Math.min(1, next)));
    }
    function onUp() {
      dragRef.current = null;
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [onChange]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 8,
        flexShrink: 0,
        padding: '4px 8px',
        borderRadius: 4,
        border: '1px solid #2a2a32',
        background: '#0a0a0e',
        opacity: disabled ? 0.45 : 1,
      }}
      title={`Master volume: ${pct}%`}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <Volume2 size={10} style={{ color: '#7cf4c6' }} />
          <span style={{ fontSize: 8, fontWeight: 800, color: '#7a7a88', letterSpacing: 0.3 }}>Master</span>
        </div>
        <div
          title="Volume knob ? drag up/down"
          data-touch-drag
          onMouseDown={(e) => {
            if (disabled) return;
            e.preventDefault();
            dragRef.current = { startY: e.clientY, startVal: linear };
          }}
          style={{
            width: 30,
            height: 30,
            touchAction: 'none',
          borderRadius: '50%',
          border: `2px solid ${disabled ? 'rgba(255,255,255,0.12)' : 'rgba(124,244,198,0.35)'}`,
          background: 'radial-gradient(circle at 35% 30%, rgba(124,244,198,0.16) 0%, rgba(10,10,14,0.95) 70%)',
          position: 'relative',
          cursor: disabled ? 'not-allowed' : 'ns-resize',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 2,
            height: 9,
            marginLeft: -1,
            marginTop: -9,
            background: disabled ? '#6a6a78' : '#7cf4c6',
            borderRadius: 1,
            transform: `rotate(${angle}deg)`,
            transformOrigin: '50% 100%',
          }}
        />
      </div>
        <span style={{ fontSize: 9, fontWeight: 800, color: disabled ? '#5a5a66' : '#e8e8f0', fontFamily: 'monospace' }}>
          {pct}%
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          paddingLeft: 6,
          borderLeft: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <span style={{ fontSize: 7, fontWeight: 800, color: '#6a6a78', letterSpacing: 0.4 }}>FADER</span>
        <div
          style={{
            position: 'relative',
            width: 28,
            height: faderH,
            borderRadius: 3,
            background: '#050507',
            border: '1px solid #1e1e26',
          }}
          title="Volume fader ? drag up for louder"
        >
          <div
            style={{
              position: 'absolute',
              left: '50%',
              bottom: 2,
              transform: 'translateX(-50%)',
              width: 4,
              height: `calc(${pct}% - 4px)`,
              minHeight: 2,
              maxHeight: faderH - 4,
              background: 'linear-gradient(180deg, rgba(124,244,198,0.55) 0%, rgba(124,244,198,0.9) 100%)',
              borderRadius: 2,
              pointerEvents: 'none',
            }}
          />
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            disabled={disabled}
            value={pct}
            onChange={(e) => onChange(Number(e.target.value) / 100)}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              margin: 0,
              opacity: 0,
              cursor: disabled ? 'not-allowed' : 'ns-resize',
              writingMode: 'vertical-lr',
              direction: 'rtl',
            }}
            aria-label="Master volume fader"
          />
          <div
            style={{
              position: 'absolute',
              left: '50%',
              bottom: `calc(${pct}% - 7px)`,
              transform: 'translateX(-50%)',
              width: 18,
              height: 8,
              borderRadius: 2,
              background: disabled
                ? '#3a3a44'
                : 'linear-gradient(180deg, #b8f5dc 0%, #7cf4c6 55%, #4ac998 100%)',
              border: '1px solid rgba(0,0,0,0.35)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>
    </div>
  );
}

const BAR_PALETTE = ['#ffff00','#00E5FF','#00ff88','#ff6b35','#a78bfa','#f472b6','#60a5fa','#c4b5fd'];

function barColor(b: number) { return BAR_PALETTE[b % BAR_PALETTE.length]; }

function colColor(ci: number) { return barColor(Math.floor(ci / MEASURES_PER_BAR)); }

const PAD_BANK_GROUP_TAGS = [
  'KICK', 'KICK', 'SNR', 'HAT', 'HAT', 'TOM', 'TOM', 'RIM',
  'PERC', 'PERC', 'CYM', 'CYM', 'FX', 'FX', 'FX', 'SUB',
] as const;

/** Beat Lab lane labels (left rail + pattern rows). */
const GENIUS_LANE_LABELS = [
  'Kick 1',
  'Snare 1',
  'Snare 2',
  'Hi Hat 2',
  'Open Hat',
  'Pan Crash',
  'Tom',
  'Rim',
  'Perc 1',
  'Perc 2',
  'China',
  'Ride',
  'FX 1',
  'FX 2',
  'FX 3',
  'My Place',
] as const;

/** Beat Lab only ? vivid pad colors (sampler + drum grid; piano roll stays neutral). */
const BEAT_LAB_PAD_COLORS: readonly string[] = [
  '#00F5FF',
  '#FF4DA6',
  '#C4A3FF',
  '#3DFFA8',
  '#FFEB3B',
  '#FF6B6B',
  '#5CE1FF',
  '#FFB84D',
  '#D946FF',
  '#67E8F9',
  '#FFA3D4',
  '#6EE7B7',
  '#FCD34D',
  '#F87171',
  '#A5B4FC',
  '#F9A8D4',
];

function beatLabPadColor(padIndex: number): string {
  return BEAT_LAB_PAD_COLORS[Math.max(0, Math.min(15, padIndex))] ?? '#b8c0d0';
}

/** Lane / sampler surface ? lighter base so pads read clearly. */
function beatLabPadSurfaceBg(padIndex: number, mixPct = 52): string {
  return `color-mix(in srgb, ${beatLabPadColor(padIndex)} ${mixPct}%, #2a3044)`;
}

function beatLabPadBorder(padIndex: number): string {
  return `color-mix(in srgb, ${beatLabPadColor(padIndex)} 80%, #505868)`;
}

function beatLabPadAccentBg(padIndex: number): string {
  return `color-mix(in srgb, ${beatLabPadColor(padIndex)} 68%, #323848)`;
}

/** Lane rail button fill ? pad color on the button face (not the rail backdrop). */
function beatLabPadButtonFill(padIndex: number, selected = false): string {
  const mix = selected ? 84 : 74;
  return `color-mix(in srgb, ${beatLabPadColor(padIndex)} ${mix}%, #222836)`;
}

function beatLabLaneBackdropBorder(): string {
  return '#343a4c';
}

/** Beat Lab grid ? all painted steps use the same green (not per-pad color). */
const BEAT_LAB_STEP_NOTE_GREEN = '#7cf4c6';
const BEAT_LAB_STEP_CELL_ON_BG = '#0f2218';

function beatLabGridStepOnFill(): string {
  return `linear-gradient(180deg, ${BEAT_LAB_STEP_NOTE_GREEN}, #34d399)`;
}

/** Loaded sample name when set; otherwise default lane name (Kick 1, Snare 1, ?). */
function beatLabLaneDisplayLabel(padIndex: number, sampleLabel?: string): string {
  const custom = sampleLabel?.trim();
  if (custom) return custom;
  return GENIUS_LANE_LABELS[padIndex] ?? PAD_NAMES[padIndex] ?? `Pad ${padIndex + 1}`;
}

function drumLaneBg(rowIndex: number): string {
  return rowIndex % 2 === 0 ? '#12182a' : '#0e1626';
}

function drumStepBg(
  ci: number,
  rowIndex: number,
  isHead: boolean,
  stepsPerBar: number = MEASURES_PER_BAR,
): string {
  if (isHead) return '#1f3d5c';
  const lane = drumLaneBg(rowIndex);
  /* Genius-style bar banding: every 4 steps (one ?measure? strip) slightly lifted */
  if (ci % (stepsPerBar * 4) === 0) return '#1a2840';
  if (ci % stepsPerBar === 0) return '#162238';
  return lane;
}

function pianoLaneBg(rowIndex: number): string {
  return rowIndex % 2 === 0 ? '#102938' : '#0e2432';
}

function pianoStepBg(
  ci: number,
  rowIndex: number,
  isHead: boolean,
  stepsPerBar: number = MEASURES_PER_BAR,
): string {
  if (isHead) return '#1a3a4f';
  if (ci % (stepsPerBar * 4) === 0) return '#1c3e54';
  if (ci % stepsPerBar === 0) return '#18405a';
  return pianoLaneBg(rowIndex);
}


/**
 * One-shot sample through the same master bus / pan as drum synth (MPC-style pad sample).
 * Returns `stop()` to cut this voice (long files, stacking hits, accidental ?loops? from retriggers).
 */
function playPadSampleBuffer(
  ctx: AudioContext,
  buffer: AudioBuffer,
  chId: number,
  vel: number,
  when: number,
  channelVolumes: Record<number, number>,
  /** 1 = native file speed ? rate also shifts pitch (Web Audio). */
  playbackRate = 1,
  /** Fires when this voice ends (natural or `stop()`) ? for sampler voice bookkeeping. */
  afterDispose?: () => void,
  sampler: PadSamplerPlaybackOpts = defaultPadSamplerPlaybackOpts(),
  timeStretch = false,
  fxRack: PadSamplerFxRack = defaultPadSamplerFxRack(),
  sessionBpm = 120,
): () => void {
  const chVol = (channelVolumes[chId] ?? 80) / 100;
  const vol = (vel / 127) * 0.85 * chVol;
  const rawPan =
    ((window as unknown as { __daMusicChannelPans?: Record<number, number> }).__daMusicChannelPans?.[chId] ?? 0) / 100;
  const panNode = ctx.createStereoPanner();
  panNode.pan.value = Math.max(-1, Math.min(1, rawPan));
  const master = (window as unknown as { __daMusicMasterGain?: GainNode | null }).__daMusicMasterGain;
  const dest =
    master && master.context === ctx ? master : ctx.destination;
  panNode.connect(dest);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const { playbackRate: playRate, detuneCents } = beatLabPadPlaybackRateDetune(
    playbackRate,
    sampler.fineSemi,
    timeStretch,
  );
  src.playbackRate.value = playRate;
  src.detune.value = detuneCents;
  const dryG = ctx.createGain();
  const wetG = ctx.createGain();
  dryG.connect(panNode);
  wetG.connect(panNode);
  const snap = Math.max(0, Math.min(1, sampler.triggerSnap ?? 0));

  const sr = buffer.sampleRate;
  const ny = sr * 0.48;
  const hpNode =
    sampler.hpHz >= 25
      ? (() => {
          const hp = ctx.createBiquadFilter();
          hp.type = 'highpass';
          hp.frequency.value = Math.min(sampler.hpHz, ny);
          hp.Q.value = 0.707;
          return hp;
        })()
      : null;
  const lpNode =
    sampler.lpHz >= 200 && sampler.lpHz < 19900
      ? (() => {
          const lp = ctx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.value = Math.min(sampler.lpHz, ny);
          lp.Q.value = 0.707;
          return lp;
        })()
      : null;

  let tail: AudioNode = src;
  if (hpNode) {
    src.connect(hpNode);
    tail = hpNode;
  }
  if (lpNode) {
    tail.connect(lpNode);
    tail = lpNode;
  }

  const fxNodes: AudioNode[] = [];
  let fxTailSec = 0;
  if (padSamplerFxRackIsActive(fxRack)) {
    const fx = connectPadSamplerFxRack(ctx, tail, dryG, wetG, fxRack, sessionBpm);
    fxNodes.push(...fx.nodes);
    fxTailSec = fx.tailSec;
  } else {
    tail.connect(dryG);
  }

  const dur = buffer.duration;
  const t0 = Math.max(0, Math.min(0.9999, sampler.trim0)) * dur;
  const t1 = Math.max(t0 + 0.002, Math.min(dur, sampler.trim1 * dur));
  const playDur = Math.max(0.002, t1 - t0);

  let disposed = false;
  const disposeGraph = () => {
    if (disposed) return;
    disposed = true;
    try {
      dryG.gain.cancelScheduledValues(ctx.currentTime);
      wetG.gain.cancelScheduledValues(ctx.currentTime);
    } catch {
      /* */
    }
    try {
      src.disconnect();
      hpNode?.disconnect();
      lpNode?.disconnect();
      for (const n of fxNodes) {
        try {
          n.disconnect();
        } catch {
          /* */
        }
      }
      dryG.disconnect();
      wetG.disconnect();
      panNode.disconnect();
    } catch {
      /* */
    }
    afterDispose?.();
  };
  src.onended = () => {
    const now = ctx.currentTime;
    try {
      dryG.gain.cancelScheduledValues(now);
      dryG.gain.setValueAtTime(dryG.gain.value, now);
      dryG.gain.linearRampToValueAtTime(0, now + 0.025);
    } catch {
      /* */
    }
    if (fxTailSec > 0.02) {
      const disposeAt = now + fxTailSec;
      try {
        wetG.gain.cancelScheduledValues(now);
        wetG.gain.setValueAtTime(wetG.gain.value, now);
        wetG.gain.linearRampToValueAtTime(0, disposeAt);
      } catch {
        /* */
      }
      window.setTimeout(disposeGraph, Math.ceil(fxTailSec * 1000) + 50);
    } else {
      try {
        wetG.gain.cancelScheduledValues(now);
        wetG.gain.setValueAtTime(wetG.gain.value, now);
        wetG.gain.linearRampToValueAtTime(0, now + 0.03);
      } catch {
        /* */
      }
      window.setTimeout(disposeGraph, 40);
    }
  };

  const stop = () => {
    if (disposed) return;
    try {
      src.stop(0);
    } catch {
      /* InvalidStateError ? already stopped or not started */
    }
    disposeGraph();
  };

  const whenPlay = Math.max(when, ctx.currentTime + 0.001);
  try {
    /** MPC-style sample trigger: brief overshoot on the output gain, then settle (harder one-shot punch). */
    if (snap < 1e-4) {
      dryG.gain.setValueAtTime(vol, whenPlay);
      wetG.gain.setValueAtTime(vol, whenPlay);
    } else {
      const peakMul = 1 + snap * 0.62;
      const decaySec = 0.0012 + (1 - snap) * 0.016;
      dryG.gain.cancelScheduledValues(whenPlay);
      wetG.gain.cancelScheduledValues(whenPlay);
      dryG.gain.setValueAtTime(vol * peakMul, whenPlay);
      wetG.gain.setValueAtTime(vol * peakMul, whenPlay);
      dryG.gain.linearRampToValueAtTime(vol, whenPlay + decaySec);
      wetG.gain.linearRampToValueAtTime(vol, whenPlay + decaySec);
    }
    src.start(whenPlay, t0, playDur);
  } catch {
    disposeGraph();
    return () => {};
  }
  return stop;
}

/** Decimated peaks for sample-edit waveform (absolute sample magnitudes, 0?1 per bucket). */
function computePadSampleWaveformPeaks(buf: AudioBuffer, bucketCount = 400): number[] {
  const channels = Math.min(buf.numberOfChannels, 2);
  const len = buf.length;
  if (len <= 0 || bucketCount <= 0) {
    return Array.from({ length: Math.max(1, bucketCount) }, () => 0);
  }
  const step = len / bucketCount;
  const peaks: number[] = new Array(bucketCount);
  for (let i = 0; i < bucketCount; i++) {
    let max = 0;
    const j0 = Math.floor(i * step);
    const j1 = Math.min(Math.floor((i + 1) * step), len);
    for (let c = 0; c < channels; c++) {
      const ch = buf.getChannelData(c);
      for (let j = j0; j < j1; j++) {
        const v = Math.abs(ch[j]!);
        if (v > max) max = v;
      }
    }
    peaks[i] = max;
  }
  return peaks;
}

function formatBeatLabSampleTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00.000';
  const totalMs = Math.round(seconds * 1000);
  const m = Math.floor(totalMs / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;
  return `${m}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

const PAD_TRIM_WAVE_CSS_H = 56;

/** Keep trim window valid (same constraints as the % sliders under the waveform). */
function clampBeatLabTrimPair(t0: number, t1: number): { trim0: number; trim1: number } {
  let trim0 = Math.max(0, Math.min(0.95, t0));
  let trim1 = Math.max(0.05, Math.min(1, t1));
  if (trim1 <= trim0 + 0.02) {
    trim1 = Math.min(1, trim0 + 0.08);
  }
  if (trim1 <= trim0 + 0.02) {
    trim0 = Math.max(0, trim1 - 0.08);
  }
  return { trim0, trim1 };
}

const PadSampleTrimWaveform = memo(function PadSampleTrimWaveform({
  peaks,
  trim0,
  trim1,
  onTrimChange,
}: {
  peaks: number[] | null;
  trim0: number;
  trim1: number;
  /** When set, drag the yellow start/end lines on the waveform (same as the % sliders). */
  onTrimChange?: (trim0: number, trim1: number) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const latestTrimRef = useRef({ trim0, trim1 });
  latestTrimRef.current = { trim0, trim1 };
  const dragWhichRef = useRef<0 | 1 | null>(null);

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const draw = () => {
      const ctx2 = canvas.getContext('2d');
      if (!ctx2) return;
      const cssW = Math.max(120, canvas.clientWidth || 280);
      const cssH = PAD_TRIM_WAVE_CSS_H;
      const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
      canvas.width = Math.max(1, Math.floor(cssW * dpr));
      canvas.height = Math.floor(cssH * dpr);
      ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx2.clearRect(0, 0, cssW, cssH);
      ctx2.fillStyle = '#060b0a';
      ctx2.fillRect(0, 0, cssW, cssH);
      if (!peaks || peaks.length < 1) {
        ctx2.fillStyle = '#4b5563';
        ctx2.font = '10px ui-monospace, system-ui, sans-serif';
        ctx2.fillText('No waveform', 8, cssH / 2 + 3);
        return;
      }
      const n = peaks.length;
      let peakMax = 1e-6;
      for (let i = 0; i < n; i++) peakMax = Math.max(peakMax, peaks[i]!);
      const scale = Math.min((cssH * 0.46) / peakMax, cssH * 4);
      const midY = cssH / 2;
      const barW = Math.max(1, cssW / n);
      const t0 = Math.max(0, Math.min(1, trim0));
      const t1 = Math.max(t0 + 1e-4, Math.min(1, trim1));
      const iStart = Math.max(0, Math.min(n - 1, Math.floor(t0 * n)));
      const iEnd = Math.max(iStart + 1, Math.min(n, Math.ceil(t1 * n)));
      for (let i = 0; i < n; i++) {
        const x = (i / n) * cssW;
        const bh = Math.min(peaks[i]! * scale, cssH * 0.48);
        const outside = i < iStart || i >= iEnd;
        ctx2.fillStyle = outside ? 'rgba(45, 55, 52, 0.65)' : '#5eead4';
        ctx2.fillRect(x, midY - bh / 2, barW - 0.55, Math.max(1, bh));
      }
      ctx2.strokeStyle = 'rgba(251, 191, 72, 0.95)';
      ctx2.lineWidth = 1.25;
      const x0 = t0 * cssW;
      const x1 = t1 * cssW;
      ctx2.beginPath();
      ctx2.moveTo(x0 + 0.5, 0);
      ctx2.lineTo(x0 + 0.5, cssH);
      ctx2.stroke();
      ctx2.beginPath();
      ctx2.moveTo(x1 - 0.5, 0);
      ctx2.lineTo(x1 - 0.5, cssH);
      ctx2.stroke();
    };
    draw();
    const ro = new ResizeObserver(() => draw());
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [peaks, trim0, trim1]);

  const applyPointerTrim = useCallback(
    (clientX: number, canvas: HTMLCanvasElement, which: 0 | 1) => {
      if (!onTrimChange) return;
      const rect = canvas.getBoundingClientRect();
      const u = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
      const { trim0: cur0, trim1: cur1 } = latestTrimRef.current;
      const next = which === 0 ? clampBeatLabTrimPair(u, cur1) : clampBeatLabTrimPair(cur0, u);
      onTrimChange(next.trim0, next.trim1);
    },
    [onTrimChange],
  );

  const onWavePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!onTrimChange) return;
      const canvas = e.currentTarget;
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const w = Math.max(1, rect.width);
      const x0 = trim0 * w;
      const x1 = trim1 * w;
      const hit = 12;
      const near0 = Math.abs(px - x0) <= hit;
      const near1 = Math.abs(px - x1) <= hit;
      let which: 0 | 1;
      if (near0 && near1) which = Math.abs(px - x0) <= Math.abs(px - x1) ? 0 : 1;
      else if (near0) which = 0;
      else if (near1) which = 1;
      else which = px / w < (trim0 + trim1) / 2 ? 0 : 1;
      dragWhichRef.current = which;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* */
      }
      applyPointerTrim(e.clientX, canvas, which);
      e.preventDefault();
    },
    [onTrimChange, trim0, trim1, applyPointerTrim],
  );

  const onWavePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (dragWhichRef.current === null || !onTrimChange) return;
      applyPointerTrim(e.clientX, e.currentTarget, dragWhichRef.current);
    },
    [onTrimChange, applyPointerTrim],
  );

  const endWaveDrag = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragWhichRef.current === null) return;
    dragWhichRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* */
    }
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      onPointerDown={onWavePointerDown}
      onPointerMove={onWavePointerMove}
      onPointerUp={endWaveDrag}
      onPointerCancel={endWaveDrag}
      onLostPointerCapture={() => {
        dragWhichRef.current = null;
      }}
      style={{
        width: '100%',
        height: PAD_TRIM_WAVE_CSS_H,
        display: 'block',
        borderRadius: 4,
        border: '1px solid #1a2824',
        background: '#060b0a',
        cursor: onTrimChange ? 'ew-resize' : 'default',
        touchAction: onTrimChange ? 'none' : undefined,
      }}
    />
  );
});


type DrumPattern = boolean[][];

type PianoNote   = { row: number; col: number };

interface Bank {
  drums: DrumPattern;
  notes: PianoNote[];
  midiRoll: BeatLabMidiNote[];
  /** Per-pattern-column volume automation 0?127 (FL event lane). */
  volAutomation?: number[];
  /** Per-pattern-column pitch automation (64 = 0 st). */
  pitchAutomation?: number[];
  /** MusyngKite GM instrument per melodic lane (CH 17?32). */
  melodicInstruments?: string[];
}

function emptyDrums(): DrumPattern {
  return Array.from({ length: 16 }, () => Array(TOTAL_COLS).fill(false));
}

/** Restore saved song patterns to the current grid column count. */
function normalizeSavedDrumPattern(pat: boolean[][]): DrumPattern {
  return Array.from({ length: 16 }, (_, pi) => {
    const row = pat[pi];
    if (!Array.isArray(row)) return Array(TOTAL_COLS).fill(false);
    return Array.from({ length: TOTAL_COLS }, (_, ci) => Boolean(row[ci]));
  });
}

/** Coerce localStorage / pattern-slot payloads into a valid 16?TOTAL_COLS grid. */
function normalizeBankDrumPattern(pat: unknown): DrumPattern {
  if (!Array.isArray(pat)) return emptyDrums();
  return normalizeSavedDrumPattern(pat as boolean[][]);
}

type PatternSlot = 'A' | 'B';


// ?? Ruler ?????????????????????????????????????????????????????????????????????

function Ruler({
  activeCol,
  colWidth,
  maxBars = TOTAL_BARS,
  barNumberStart = 1,
  onRangeCommit,
  stepsPerBar = MEASURES_PER_BAR,
  /** If set (sum must match drum pattern column count), beat row uses variable widths per bar ? keeps ruler aligned with the grid in odd meters. */
  barStepCounts,
  /** When `barStepCounts` groups columns differently from one DAW bar per segment, set header labels (e.g. DAW bar at each segment start). */
  segmentHeaderLabels,
  /** Map pattern column index ? DAW bar for loop drag; required when segment count ? DAW bars in range. */
  patternColToDawBar,
  /**
   * When set, the beat row highlights the **beat within the bar** (1?`creationBeatsPerBar`) that contains `activeCol`,
   * using `creationStepSubdiv` columns per beat (e.g. 4 for 16ths). Omit `creationStepSubdiv` for 1 column = 1 beat.
   */
  creationBeatHighlight,
  creationBeatsPerBar,
  creationStepSubdiv,
  disablePlayheadHighlight = false,
  /** When set, each beat cell is exactly `colWidth` px (border-box) with pad-matching vertical grid lines ? required for playline ? digit alignment. */
  drumGridBeatBorders,
  onSeekPatternCol,
}: {
  activeCol: number;
  colWidth: number;
  maxBars?: number;
  /** First bar label (1-based) ? use for global bar numbers when the loop is not at bar 1. */
  barNumberStart?: number;
  /** Drag across bar headers to set shared loop range (master loop state). */
  onRangeCommit?: (startBar: number, endBar: number) => void;
  /** Quarter-note columns per bar ? fallback when `barStepCounts` omitted. */
  stepsPerBar?: number;
  barStepCounts?: number[];
  segmentHeaderLabels?: number[];
  patternColToDawBar?: (patternCol: number) => number;
  creationBeatHighlight?: number | null;
  creationBeatsPerBar?: number;
  creationStepSubdiv?: number;
  disablePlayheadHighlight?: boolean;
  drumGridBeatBorders?: { bankColOffset: number; qpb: number; subdiv: number };
  onSeekPatternCol?: (patternCol: number) => void;
}) {
  const headerRef = useRef<HTMLDivElement>(null);
  const dragStartBarRef = useRef<number | null>(null);
  const highlightBeats = Math.max(1, Math.min(16, Math.round(creationBeatsPerBar ?? MEASURES_PER_BAR)));
  const highlightSubdiv = Math.max(1, Math.round(creationStepSubdiv ?? 1));

  const counts =
    barStepCounts && barStepCounts.length > 0
      ? barStepCounts
      : Array.from({ length: maxBars }, () => stepsPerBar);
  const barN = counts.length;

  const pxToBarIndex = (clientX: number) => {
    const el = headerRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    let acc = 0;
    for (let bi = 0; bi < barN; bi++) {
      const w = colWidth * counts[bi]!;
      if (x < acc + w) return Math.max(0, Math.min(barN - 1, bi));
      acc += w;
    }
    return Math.max(0, barN - 1);
  };

  const pxToPatternCol = (clientX: number): number => {
    const el = headerRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    let accPx = 0;
    let colAcc = 0;
    for (let bi = 0; bi < barN; bi++) {
      const w = colWidth * counts[bi]!;
      if (x < accPx + w) {
        const within = x - accPx;
        const colInSeg = Math.min(
          counts[bi]! - 1,
          Math.max(0, Math.floor(within / colWidth)),
        );
        return colAcc + colInSeg;
      }
      accPx += w;
      colAcc += counts[bi]!;
    }
    return Math.max(0, colAcc - 1);
  };

  const dawBarFromPointer = (clientX: number) =>
    patternColToDawBar
      ? patternColToDawBar(pxToPatternCol(clientX))
      : barNumberStart + pxToBarIndex(clientX);

  const compactDrumRuler = drumGridBeatBorders != null;
  const rulerH = compactDrumRuler ? DRUM_SEQ_QUANT_BAND_H : 28;
  const barRowH = compactDrumRuler ? DRUM_SEQ_RULER_BAR_ROW_H : 14;
  const stepRowH = compactDrumRuler ? DRUM_SEQ_RULER_STEP_ROW_H : 14;

  let colStartAcc = 0;
  return (
    <div ref={headerRef} style={{ display: 'flex', height: rulerH, flexShrink: 0, overflow: compactDrumRuler ? 'visible' : 'hidden' }}>
      {Array.from({ length: barN }, (_, bi) => {
        const stepsThisBar = counts[bi]!;
        const colStart = colStartAcc;
        colStartAcc += stepsThisBar;
        /** Drum Beat Lab: no segment-wide header tint ? only the digit under the playline column turns violet. */
        const isActiveBar =
          drumGridBeatBorders == null &&
          !disablePlayheadHighlight &&
          activeCol >= colStart &&
          activeCol < colStart + stepsThisBar;
        const color = barColor(bi);
        const barLabel =
          segmentHeaderLabels && segmentHeaderLabels.length === barN
            ? segmentHeaderLabels[bi]!
            : barNumberStart + bi;
        const segmentOuterStyle =
          drumGridBeatBorders != null
            ? {
                width: colWidth * stepsThisBar,
                flexShrink: 0 as const,
                boxSizing: 'border-box' as const,
                /** Flat column model ? pad grid has no per-bar inset; extra 1px here skewed playline vs digits. */
                borderLeft: 'none',
                display: 'flex' as const,
                flexDirection: 'column' as const,
              }
            : {
                width: colWidth * stepsThisBar,
                flexShrink: 0 as const,
                borderLeft: `1px solid ${bi % 4 === 0 ? '#2a2a32' : '#1c1c24'}`,
                display: 'flex' as const,
                flexDirection: 'column' as const,
              };
        return (
          <div key={bi} style={segmentOuterStyle}>
            <div
              onPointerDown={onRangeCommit ? (e) => {
                dragStartBarRef.current = dawBarFromPointer(e.clientX);
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              } : undefined}
              onPointerUp={onRangeCommit ? (e) => {
                if (dragStartBarRef.current == null) return;
                const endBar = dawBarFromPointer(e.clientX);
                const s = dragStartBarRef.current;
                onRangeCommit(Math.min(s, endBar), Math.max(s, endBar));
                dragStartBarRef.current = null;
                try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* */ }
              } : undefined}
              style={{
                height: barRowH,
                flexShrink: 0,
                fontSize: compactDrumRuler ? 11 : 8,
                fontFamily: 'monospace',
                fontWeight: 900,
                color: isActiveBar ? color : '#4a4a58',
                textAlign: 'center',
                lineHeight: `${barRowH}px`,
                background: isActiveBar ? `${color}15` : 'transparent',
                borderBottom: `1px solid ${isActiveBar ? color : '#1a1a24'}`,
                cursor: onRangeCommit ? 'ew-resize' : 'default',
                touchAction: 'none',
                overflow: compactDrumRuler ? 'visible' : 'hidden',
                position: 'relative' as const,
                zIndex: compactDrumRuler ? 2 : undefined,
              }}
            >
              {barLabel}
            </div>
            <div
              style={{
                display: 'flex',
                flex: compactDrumRuler ? undefined : 1,
                height: compactDrumRuler ? stepRowH : undefined,
                flexShrink: 0,
                alignItems: 'center',
              }}
            >
              {Array.from({ length: stepsThisBar }, (_, mi) => {
                const ci = colStart + mi;
                const inActiveSeg =
                  activeCol >= colStart &&
                  activeCol < colStart + stepsThisBar;
                const beatInSeg = Math.floor(mi / highlightSubdiv) + 1;
                const useCreationHighlight =
                  creationBeatHighlight != null &&
                  creationBeatHighlight >= 1 &&
                  creationBeatHighlight <= highlightBeats;
                const isHead = disablePlayheadHighlight
                  ? false
                  : useCreationHighlight
                  ? inActiveSeg && beatInSeg === creationBeatHighlight
                  : activeCol === ci;
                /** Drum grid: playline column only tints digit (violet), not bar-color cell wash. */
                const drumBeatPlayline =
                  drumGridBeatBorders != null && isHead;
                /** Drum quant row: quarter count 1–4 per bar (same as MEASURES row), not 1–N step index per column. */
                const quantStepLabel =
                  drumGridBeatBorders != null
                    ? mi % highlightSubdiv === 0
                      ? String(beatInSeg)
                      : ''
                    : String(mi + 1);
                const bankCol =
                  drumGridBeatBorders != null ? ci + drumGridBeatBorders.bankColOffset : -1;
                const beatBorderLeft =
                  drumGridBeatBorders != null && bankCol >= 0
                    ? `1px solid ${creationDrumGridVerticalLineColor({
                        colWidthPx: colWidth,
                        bankCol,
                        qpb: drumGridBeatBorders.qpb,
                        subdiv: drumGridBeatBorders.subdiv,
                        blendTo: '#0a0a0e',
                      })}`
                    : mi > 0
                      ? '1px solid #181818'
                      : 'none';
                const beatCellSizing =
                  drumGridBeatBorders != null
                    ? {
                        width: colWidth,
                        minWidth: colWidth,
                        maxWidth: colWidth,
                        flexShrink: 0 as const,
                        boxSizing: 'border-box' as const,
                      }
                    : { flex: 1 };
                return (
                  <div
                    key={mi}
                    onClick={
                      onSeekPatternCol && drumGridBeatBorders
                        ? (e) => {
                            e.stopPropagation();
                            onSeekPatternCol(ci);
                          }
                        : undefined
                    }
                    data-drum-pattern-col={drumGridBeatBorders != null ? ci : undefined}
                    data-drum-playline-lit-cell={drumGridBeatBorders != null ? '1' : undefined}
                    style={{
                      ...beatCellSizing,
                      fontSize: 7,
                      textAlign: 'center',
                      color: drumBeatPlayline ? '#7cf4c6' : isHead ? color : '#2a2a32',
                      fontWeight: drumBeatPlayline ? 900 : isHead ? 700 : 400,
                      background: drumBeatPlayline
                        ? 'rgba(124, 244, 198, 0.18)'
                        : isHead
                          ? `${color}20`
                          : 'transparent',
                      boxShadow: drumBeatPlayline ? 'inset 0 0 0 1px rgba(124, 244, 198, 0.45)' : undefined,
                      borderLeft: beatBorderLeft,
                      fontFamily: 'monospace',
                      lineHeight: compactDrumRuler ? `${stepRowH}px` : '13px',
                      height: compactDrumRuler ? stepRowH : undefined,
                      display: compactDrumRuler ? 'flex' : undefined,
                      alignItems: compactDrumRuler ? 'center' : undefined,
                      justifyContent: compactDrumRuler ? 'center' : undefined,
                      overflow: compactDrumRuler ? 'hidden' : undefined,
                      position: 'relative' as const,
                      cursor: onSeekPatternCol && drumGridBeatBorders ? 'pointer' : undefined,
                    }}
                    title={onSeekPatternCol && drumGridBeatBorders ? 'Move playhead here' : undefined}
                  >
                    {quantStepLabel}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}


// ?? BankButtons (memoized to prevent re-render on BPM change) ?????????????????

interface BankButtonsProps {
  activeBank: number;
  setActiveBank: (i: number) => void;
  hasDrums: (i: number) => boolean;
  hasNotes: (i: number) => boolean;
}


const BankButtons = memo(({ activeBank, setActiveBank, hasDrums, hasNotes }: BankButtonsProps) => (
  <div style={{ display: 'flex', gap: 3 }}>
    {BANKS.map((b, i) => (
      <button key={b} onClick={() => setActiveBank(i)} style={{ position: 'relative', width: 24, height: 24, borderRadius: 4, fontSize: 10, fontWeight: 900, background: activeBank === i ? '#193025' : '#1a1a24', color: activeBank === i ? '#7cf4c6' : '#6a6a78', border: `1px solid ${activeBank === i ? 'rgba(124,244,198,0.45)' : '#2a2a32'}`, cursor: 'pointer' }}>
        {b}
        {hasDrums(i) && <div style={{ position: 'absolute', top: 1, right: 1, width: 4, height: 4, borderRadius: '50%', background: '#ff6b35' }} />}
        {hasNotes(i) && <div style={{ position: 'absolute', bottom: 1, right: 1, width: 4, height: 4, borderRadius: '50%', background: '#00E5FF' }} />}
      </button>
    ))}
  </div>
));

BankButtons.displayName = 'BankButtons';


// ?? Beat Lab deck toolbar (under transport ? preset, uploads, kit, sampler) ?

type CreationSe2ReadoutRegistry = {
  bars: React.MutableRefObject<Set<HTMLSpanElement>>;
  time: React.MutableRefObject<Set<HTMLSpanElement>>;
};

function CreationSe2BarsClockChip({ registry }: { registry: CreationSe2ReadoutRegistry }) {
  const valueRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = valueRef.current;
    if (!el) return;
    registry.bars.current.add(el);
    return () => {
      registry.bars.current.delete(el);
    };
  }, [registry]);
  return (
    <div
      style={{
        height: 32,
        borderRadius: 4,
        border: '1px solid #2a2a32',
        padding: '0 8px',
        boxSizing: 'border-box',
        background: 'rgba(0,0,0,0.45)',
        minWidth: 112,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
      }}
      title="Bar ? beat ? tick (Studio Editor 2)"
    >
      <span
        style={{
          fontSize: 7,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          lineHeight: 1,
          color: '#6a6a78',
        }}
      >
        Bars
      </span>
      <span
        ref={valueRef}
        style={{
          fontSize: 12,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
          marginTop: 2,
          color: '#fff',
          textAlign: 'center',
          whiteSpace: 'nowrap',
          width: '100%',
        }}
      >
        1.1.00
      </span>
    </div>
  );
}

function CreationSe2TimeClockChip({ registry }: { registry: CreationSe2ReadoutRegistry }) {
  const valueRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = valueRef.current;
    if (!el) return;
    registry.time.current.add(el);
    return () => {
      registry.time.current.delete(el);
    };
  }, [registry]);
  return (
    <div
      style={{
        height: 32,
        borderRadius: 4,
        border: '1px solid #2a2a32',
        padding: '0 6px',
        boxSizing: 'border-box',
        background: 'rgba(0,0,0,0.45)',
        minWidth: 72,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
      }}
      title="Elapsed time at playhead"
    >
      <span
        style={{
          fontSize: 7,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          lineHeight: 1,
          color: '#6a6a78',
        }}
      >
        Time
      </span>
      <span
        ref={valueRef}
        style={{
          fontSize: 12,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
          marginTop: 2,
          color: '#9dc6ff',
        }}
      >
        00:00:00
      </span>
    </div>
  );
}

function CreationSe2TransportClockChips({ registry }: { registry: CreationSe2ReadoutRegistry }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
      <CreationSe2BarsClockChip registry={registry} />
      <CreationSe2TimeClockChip registry={registry} />
    </div>
  );
}

function BeatLabDeckFocusChip({
  active,
  label,
  onClick,
  title,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        fontSize: 9,
        fontWeight: 800,
        color: active ? '#7cf4c6' : '#8a8a98',
        background: active ? 'rgba(124, 244, 198, 0.14)' : 'rgba(255, 255, 255, 0.04)',
        border: `1px solid ${active ? 'rgba(124, 244, 198, 0.45)' : 'rgba(255, 255, 255, 0.08)'}`,
        borderRadius: 4,
        padding: '3px 7px',
        cursor: 'pointer',
        letterSpacing: 0.4,
      }}
    >
      {label}
    </button>
  );
}

function BeatLabGridLayoutToggle({
  mode,
  onDefault,
  onFull,
}: {
  mode: BeatLabGridLayoutMode;
  onDefault: () => void;
  onFull: () => void;
}) {
  const chip = (active: boolean) => ({
    display: 'inline-flex' as const,
    alignItems: 'center' as const,
    gap: 3,
    fontSize: 9,
    fontWeight: 800 as const,
    color: active ? '#7cf4c6' : '#8a8a98',
    background: active ? 'rgba(124, 244, 198, 0.14)' : 'rgba(255, 255, 255, 0.04)',
    border: `1px solid ${active ? 'rgba(124, 244, 198, 0.45)' : 'rgba(255, 255, 255, 0.08)'}`,
    borderRadius: 4,
    padding: '3px 6px',
    cursor: 'pointer' as const,
  });
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        marginLeft: 4,
        paddingLeft: 8,
        borderLeft: '1px solid rgba(124, 244, 198, 0.18)',
      }}
    >
      <span style={{ fontSize: 8, fontWeight: 800, color: '#5c5c68', letterSpacing: 0.6 }}>GRID</span>
      <button
        type="button"
        onClick={onDefault}
        title="Standard layout ? sampler pads and tools above the step grid"
        style={chip(mode === 'default')}
      >
        <Minimize2 size={10} aria-hidden />
        STD
      </button>
      <button
        type="button"
        onClick={onFull}
        title="Full grid editor ? maximize step sequencer workspace for editing"
        style={chip(mode === 'full')}
      >
        <Maximize2 size={10} aria-hidden />
        FULL
      </button>
    </div>
  );
}


interface BeatLabDeckToolbarProps {
  kit: string;
  setKit: (k: string) => void;
  hasPadSample: (padIndex: number) => boolean;
  onLoadPadSample: (padIndex: number) => void;
  onClearPadSample: (padIndex: number) => void;
  onGeniusRecord?: () => void;
  onGeniusUpload?: () => void;
  /** Pick a folder of drum samples from disk ? auto-maps to pads. */
  onGeniusImportFolder?: () => void;
  /** Load trap drum folder into Bank B with renamed instruments (808 / clap / hits). */
  onLoadBrassRoomFolder?: () => void;
  onLoadBrassRoomFromProject?: () => void;
  brassRoomLoading?: boolean;
  onOpenTrapKitBrowser?: () => void;
  kitImportHint?: string | null;
  producerKitId?: BeatLabProducerKitId;
  onProducerKitIdChange?: (id: BeatLabProducerKitId) => void;
  onLoadProducerKit?: () => void;
  producerKitLoading?: boolean;
  producerKitTribute?: string | null;
  onGeniusMySoundPlay?: (padIndex: number) => void;
  /** Stop all currently playing sample voices on this pad (long samples / stacked hits). */
  onStopPadSamplePlayback?: (padIndex: number) => void;
  /** Pad index 0?15 that receives the next file from ?Upload sound?. */
  geniusSamplerTargetPad?: number;
  onGeniusSamplerTargetPadChange?: (padIndex: number) => void;
  /** Source BPM for tempo sync (optional per pad). */
  padSampleRootBpmForPad?: (padIndex: number) => number | undefined;
  onCommitPadSampleRootBpm?: (padIndex: number, raw: string) => void;
  /** Loaded sample display name (matches sequencer lane when set). */
  padSampleLabelForPad?: (padIndex: number) => string | undefined;
  /** Persist display name for this pad?s sample (localStorage + lane label). */
  onCommitPadSampleLabel?: (padIndex: number, label: string) => void;
  /** Bump local numeric field when bank / stored root changes */
  samplerUiBank?: number;
  /** Per-pad HPF/LPF/trim/fine (stored with sample). */
  getPadSamplerOpts?: (padIndex: number) => PadSamplerPlaybackOpts;
  commitPadSamplerOpts?: (padIndex: number, o: PadSamplerPlaybackOpts) => void;
  /** One-shot preview using these opts (does not persist until Apply). */
  onPreviewSamplerFx?: (padIndex: number, o: PadSamplerPlaybackOpts) => void;
  getPadSamplerFxRack?: (padIndex: number) => PadSamplerFxRack;
  commitPadSamplerFxRack?: (padIndex: number, rack: PadSamplerFxRack) => void;
  /** Keep pad playback in sync while EFX popover is open (before Apply). */
  onLivePadFxRackDraft?: (padIndex: number, rack: PadSamplerFxRack) => void;
  onPreviewSamplerFxRack?: (padIndex: number, rack: PadSamplerFxRack) => void;
  /** Preview with SRC BPM field value (does not persist until blur/Enter). */
  onPreviewSamplerRootBpmDraft?: (padIndex: number, raw: string) => void;
  /** Loaded buffer for trim waveform + time readouts (same pad as Beat Lab lane). */
  getPadSampleAudioBuffer?: (padIndex: number) => AudioBuffer | undefined;
  /** Same row as kit: clear grid/lane + Studio handoff */
  patternActionsDisabled?: boolean;
  onClearGrid?: () => void;
  onClearLane?: () => void;
  clearLaneDisabled?: boolean;
  clearLaneTitle?: string;
  onDownloadHandoff?: () => void;
  /** Kit dropdown: `preset:Name` or `saved:<id>` */
  kitSelectValue?: string;
  onKitSelectChange?: (value: string) => void;
  presetKitNames?: readonly string[];
  savedKits?: { id: string; name: string }[];
  onSaveKit?: (name: string) => void;
  onRenameSavedKit?: (id: string, name: string) => void;
  onDeleteSavedKit?: (id: string) => void;
  saveKitStatus?: string | null;
  savedSongs?: { id: string; name: string }[];
  onSaveSong?: (name: string) => void;
  onLoadSavedSong?: (id: string) => void;
  onRenameSavedSong?: (id: string, name: string) => void;
  onDeleteSavedSong?: (id: string) => void;
  saveSongStatus?: string | null;
  /** SESSION link + grid zoom (px slider, FIT) */
  sessionZoomTools?: React.ReactNode;
  /** Bars / Time readouts ? beside Save and under grid zoom */
  deckTransportClocks?: React.ReactNode;
  /** 32-ch piano roll panel (under sampler pads) */
  pianoRollSlot?: React.ReactNode;
  beatLabDeckFocus?: BeatLabDeckFocus;
  onBeatLabDeckFocusChange?: (focus: BeatLabDeckFocus) => void;
  /** GRID full editor ? hide 16-pad sampler block; kit row stays visible. */
  hideSamplerPads?: boolean;
  /** Lane 1?16 focus ? lights matching sampler pad + grid rail. */
  selectedDrumPad?: number | null;
  onSelectDrumPad?: (padIndex: number) => void;
  selectedMelodicLane?: number | null;
  melodicInstruments?: string[];
  channelVolumes?: Record<number, number>;
  getAudioContext?: () => AudioContext;
  onMelodicInstrumentChange?: (slotIndex: number, instrumentId: string) => void;
  creationBackendBlank?: boolean;
  /** Project BPM ? delay sync + readout in EFX rack. */
  sessionBpm?: number;
}

function BeatLabDeckToolbar({
  kit,
  setKit,
  hasPadSample,
  onLoadPadSample,
  onClearPadSample,
  onGeniusRecord,
  onGeniusUpload,
  onGeniusImportFolder,
  onLoadBrassRoomFolder,
  onLoadBrassRoomFromProject,
  brassRoomLoading = false,
  onOpenTrapKitBrowser,
  kitImportHint,
  producerKitId = 'brassTrap',
  onProducerKitIdChange,
  onLoadProducerKit,
  producerKitLoading = false,
  producerKitTribute,
  onGeniusMySoundPlay,
  onStopPadSamplePlayback,
  geniusSamplerTargetPad = 14,
  onGeniusSamplerTargetPadChange,
  padSampleRootBpmForPad,
  onCommitPadSampleRootBpm,
  padSampleLabelForPad,
  onCommitPadSampleLabel,
  samplerUiBank = 0,
  getPadSamplerOpts,
  commitPadSamplerOpts,
  onPreviewSamplerFx,
  getPadSamplerFxRack,
  commitPadSamplerFxRack,
  onLivePadFxRackDraft,
  onPreviewSamplerFxRack,
  onPreviewSamplerRootBpmDraft,
  getPadSampleAudioBuffer,
  patternActionsDisabled = false,
  onClearGrid,
  onClearLane,
  clearLaneDisabled = true,
  clearLaneTitle,
  onDownloadHandoff,
  kitSelectValue,
  onKitSelectChange,
  presetKitNames = KITS,
  savedKits = [],
  onSaveKit,
  onRenameSavedKit,
  onDeleteSavedKit,
  saveKitStatus = null,
  savedSongs = [],
  onSaveSong,
  onLoadSavedSong,
  onRenameSavedSong,
  onDeleteSavedSong,
  saveSongStatus = null,
  sessionZoomTools,
  deckTransportClocks,
  pianoRollSlot,
  beatLabDeckFocus = 'sequence',
  onBeatLabDeckFocusChange,
  hideSamplerPads = false,
  selectedDrumPad = null,
  onSelectDrumPad,
  selectedMelodicLane = null,
  melodicInstruments = [...BEAT_LAB_MELODIC_DEFAULT_INSTRUMENTS],
  channelVolumes = {},
  getAudioContext,
  onMelodicInstrumentChange,
  creationBackendBlank = false,
  sessionBpm = 120,
}: BeatLabDeckToolbarProps) {
  const kitDropdownValue = kitSelectValue ?? `preset:${presetKitNames[0] ?? KITS[0]}`;
  const [saveKitOpen, setSaveKitOpen] = useState(false);
  const [saveKitNameDraft, setSaveKitNameDraft] = useState('');
  const [saveSongNameDraft, setSaveSongNameDraft] = useState('');
  const [renameKitId, setRenameKitId] = useState<string | null>(null);
  const [renameKitDraft, setRenameKitDraft] = useState('');
  const [renameSongId, setRenameSongId] = useState<string | null>(null);
  const [renameSongDraft, setRenameSongDraft] = useState('');
  const saveKitPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!saveKitOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('[data-save-kit-root]')) return;
      setSaveKitOpen(false);
      setRenameKitId(null);
      setRenameSongId(null);
    };
    document.addEventListener('mousedown', onDocMouseDown, true);
    return () => document.removeEventListener('mousedown', onDocMouseDown, true);
  }, [saveKitOpen]);

  /** Which pad?s SRC BPM popover is open (null = all closed). */
  const [srcBpmOpenPad, setSrcBpmOpenPad] = useState<number | null>(null);
  const [srcBpmDraft, setSrcBpmDraft] = useState('');
  const srcBpmDraftRef = useRef('');
  srcBpmDraftRef.current = srcBpmDraft;
  const srcBpmOpenPadRef = useRef<number | null>(null);
  srcBpmOpenPadRef.current = srcBpmOpenPad;
  /** Stable ref ? parent recreates `onCommitPadSampleRootBpm` when `padSamplePresence` changes; must not re-run bank-switch FX close. */
  const onCommitPadSampleRootBpmRef = useRef(onCommitPadSampleRootBpm);
  onCommitPadSampleRootBpmRef.current = onCommitPadSampleRootBpm;

  const [fxOpenPad, setFxOpenPad] = useState<number | null>(null);
  const [fxDraft, setFxDraft] = useState<PadSamplerPlaybackOpts>(() => defaultPadSamplerPlaybackOpts());
  const fxDraftRef = useRef(fxDraft);
  fxDraftRef.current = fxDraft;

  const [efxOpenPad, setEfxOpenPad] = useState<number | null>(null);
  const [efxDraft, setEfxDraft] = useState<PadSamplerFxRack>(() => defaultPadSamplerFxRack());
  const efxDraftRef = useRef(efxDraft);
  efxDraftRef.current = efxDraft;
  /** Lane / pad name while SAMPLE EDIT is open ? kept in ref for document dismiss + pad switch commits. */
  const [fxLabelDraft, setFxLabelDraft] = useState('');
  const fxLabelDraftRef = useRef('');
  fxLabelDraftRef.current = fxLabelDraft;
  const onCommitPadSampleLabelRef = useRef(onCommitPadSampleLabel);
  onCommitPadSampleLabelRef.current = onCommitPadSampleLabel;

  useEffect(() => {
    if (fxOpenPad === null) {
      setFxLabelDraft('');
      return;
    }
    setFxLabelDraft((padSampleLabelForPad?.(fxOpenPad) ?? '').trim());
    // Only when opening a pad or switching bank ? not when `padSampleLabelForPad` identity changes (parent inline fn).
  }, [fxOpenPad, samplerUiBank]);

  const fxOpenTrimBuffer =
    fxOpenPad !== null ? getPadSampleAudioBuffer?.(fxOpenPad) : undefined;
  const fxTrimWavePeaks = useMemo(() => {
    if (!fxOpenTrimBuffer || fxOpenTrimBuffer.length === 0) return null;
    return computePadSampleWaveformPeaks(fxOpenTrimBuffer, 400);
  }, [fxOpenPad, fxOpenTrimBuffer]);

  const toggleSrcBpmMenu = useCallback(
    (padIndex: number) => {
      if (srcBpmOpenPad === padIndex) {
        onCommitPadSampleRootBpm?.(padIndex, srcBpmDraftRef.current);
        setSrcBpmOpenPad(null);
        return;
      }
      if (fxOpenPad !== null) {
        onCommitPadSampleLabelRef.current?.(fxOpenPad, fxLabelDraftRef.current.trim());
        commitPadSamplerOpts?.(fxOpenPad, fxDraftRef.current);
        setFxOpenPad(null);
      }
      if (efxOpenPad !== null) {
        commitPadSamplerFxRack?.(efxOpenPad, efxDraftRef.current);
        setEfxOpenPad(null);
      }
      if (srcBpmOpenPad !== null && srcBpmOpenPad !== padIndex) {
        onCommitPadSampleRootBpm?.(srcBpmOpenPad, srcBpmDraftRef.current);
      }
      setSrcBpmOpenPad(padIndex);
      const r = padSampleRootBpmForPad?.(padIndex);
      setSrcBpmDraft(r != null && r > 0 ? String(r) : '');
    },
    [srcBpmOpenPad, fxOpenPad, efxOpenPad, padSampleRootBpmForPad, onCommitPadSampleRootBpm, commitPadSamplerOpts, commitPadSamplerFxRack],
  );

  const toggleFxMenu = useCallback(
    (padIndex: number) => {
      if (!commitPadSamplerOpts || !getPadSamplerOpts) return;
      if (fxOpenPad === padIndex) {
        onCommitPadSampleLabelRef.current?.(padIndex, fxLabelDraftRef.current.trim());
        commitPadSamplerOpts(padIndex, fxDraftRef.current);
        setFxOpenPad(null);
        return;
      }
      if (srcBpmOpenPad !== null) {
        onCommitPadSampleRootBpm?.(srcBpmOpenPad, srcBpmDraftRef.current);
        setSrcBpmOpenPad(null);
      }
      if (efxOpenPad !== null) {
        commitPadSamplerFxRack?.(efxOpenPad, efxDraftRef.current);
        setEfxOpenPad(null);
      }
      if (fxOpenPad !== null && fxOpenPad !== padIndex) {
        onCommitPadSampleLabelRef.current?.(fxOpenPad, fxLabelDraftRef.current.trim());
        commitPadSamplerOpts(fxOpenPad, fxDraftRef.current);
      }
      setFxOpenPad(padIndex);
      setFxDraft({ ...getPadSamplerOpts(padIndex) });
    },
    [fxOpenPad, efxOpenPad, srcBpmOpenPad, commitPadSamplerOpts, getPadSamplerOpts, onCommitPadSampleRootBpm, commitPadSamplerFxRack],
  );

  const toggleEfxMenu = useCallback(
    (padIndex: number) => {
      if (!commitPadSamplerFxRack || !getPadSamplerFxRack) return;
      if (efxOpenPad === padIndex) {
        commitPadSamplerFxRack(padIndex, efxDraftRef.current);
        setEfxOpenPad(null);
        return;
      }
      if (srcBpmOpenPad !== null) {
        onCommitPadSampleRootBpm?.(srcBpmOpenPad, srcBpmDraftRef.current);
        setSrcBpmOpenPad(null);
      }
      if (fxOpenPad !== null) {
        onCommitPadSampleLabelRef.current?.(fxOpenPad, fxLabelDraftRef.current.trim());
        commitPadSamplerOpts?.(fxOpenPad, fxDraftRef.current);
        setFxOpenPad(null);
      }
      if (efxOpenPad !== null && efxOpenPad !== padIndex) {
        commitPadSamplerFxRack(efxOpenPad, efxDraftRef.current);
      }
      setEfxOpenPad(padIndex);
      setEfxDraft({ ...getPadSamplerFxRack(padIndex) });
    },
    [efxOpenPad, fxOpenPad, srcBpmOpenPad, commitPadSamplerFxRack, getPadSamplerFxRack, commitPadSamplerOpts, onCommitPadSampleRootBpm],
  );

  useEffect(() => {
    const pad = srcBpmOpenPadRef.current;
    if (pad !== null) {
      onCommitPadSampleRootBpmRef.current?.(pad, srcBpmDraftRef.current);
      setSrcBpmOpenPad(null);
    }
    /** Bank switch: close FX panel without auto-commit (avoids writing to wrong bank index). */
    setFxOpenPad(null);
    setEfxOpenPad(null);
  }, [samplerUiBank]);

  useEffect(() => {
    if (srcBpmOpenPad === null) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('[data-src-bpm-root]')) return;
      if (t?.closest?.('[data-fx-root]')) return;
      if (t?.closest?.('[data-efx-root]')) return;
      if (t?.closest?.('[data-beatlab-portal-popover]')) return;
      onCommitPadSampleRootBpmRef.current?.(srcBpmOpenPad, srcBpmDraftRef.current);
      setSrcBpmOpenPad(null);
    };
    document.addEventListener('mousedown', onDocMouseDown, true);
    return () => document.removeEventListener('mousedown', onDocMouseDown, true);
  }, [srcBpmOpenPad]);

  useEffect(() => {
    if (fxOpenPad === null) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('[data-fx-root]')) return;
      if (t?.closest?.('[data-efx-root]')) return;
      if (t?.closest?.('[data-src-bpm-root]')) return;
      if (t?.closest?.('[data-beatlab-portal-popover]')) return;
      onCommitPadSampleLabelRef.current?.(fxOpenPad, fxLabelDraftRef.current.trim());
      commitPadSamplerOpts?.(fxOpenPad, fxDraftRef.current);
      setFxOpenPad(null);
    };
    document.addEventListener('mousedown', onDocMouseDown, true);
    return () => document.removeEventListener('mousedown', onDocMouseDown, true);
  }, [fxOpenPad, commitPadSamplerOpts]);

  useEffect(() => {
    if (efxOpenPad === null) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('[data-efx-root]')) return;
      if (t?.closest?.('[data-fx-root]')) return;
      if (t?.closest?.('[data-src-bpm-root]')) return;
      if (t?.closest?.('[data-beatlab-portal-popover]')) return;
      commitPadSamplerFxRack?.(efxOpenPad, efxDraftRef.current);
      setEfxOpenPad(null);
    };
    document.addEventListener('mousedown', onDocMouseDown, true);
    return () => document.removeEventListener('mousedown', onDocMouseDown, true);
  }, [efxOpenPad, commitPadSamplerFxRack]);

  useEffect(() => {
    if (efxOpenPad === null || !onLivePadFxRackDraft) return;
    onLivePadFxRackDraft(efxOpenPad, clonePadSamplerFxRack(efxDraftRef.current));
  }, [efxDraft, efxOpenPad, onLivePadFxRackDraft]);

  /** Anchors for fixed popovers (portaled to `document.body` ? avoids Creation root `overflow:hidden`). */
  const srcBpmTriggerRefs = useRef<Array<HTMLButtonElement | null>>(Array.from({ length: 16 }, () => null));
  const fxTriggerRefs = useRef<Array<HTMLButtonElement | null>>(Array.from({ length: 16 }, () => null));
  const efxTriggerRefs = useRef<Array<HTMLButtonElement | null>>(Array.from({ length: 16 }, () => null));
  const srcBpmPopoverMeasureRef = useRef<HTMLDivElement | null>(null);
  const fxPopoverMeasureRef = useRef<HTMLDivElement | null>(null);
  const efxPopoverMeasureRef = useRef<HTMLDivElement | null>(null);
  type BeatLabPopRect = { left: number; top: number; width: number };
  const [srcBpmPopRect, setSrcBpmPopRect] = useState<BeatLabPopRect | null>(null);
  const [fxPopRect, setFxPopRect] = useState<BeatLabPopRect | null>(null);
  const [efxPopRect, setEfxPopRect] = useState<BeatLabPopRect | null>(null);

  const layoutBeatLabPortals = useCallback(() => {
    const VIEW = 8;
    const GAP = 4;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 768;

    if (fxOpenPad !== null) {
      const btn = fxTriggerRefs.current[fxOpenPad];
      if (btn) {
        const br = btn.getBoundingClientRect();
        const w = Math.min(220, vw - 2 * VIEW);
        const panel = fxPopoverMeasureRef.current;
        const rawH = panel?.offsetHeight ?? 360;
        const h = Math.min(rawH, vh - 2 * VIEW);
        let left = br.right - w;
        left = Math.max(VIEW, Math.min(left, vw - w - VIEW));
        let top = br.bottom + GAP;
        if (top + h > vh - VIEW) {
          top = br.top - GAP - h;
        }
        if (top < VIEW) {
          top = VIEW;
        }
        setFxPopRect({ left, top, width: w });
      } else {
        setFxPopRect(null);
      }
    } else {
      setFxPopRect(null);
    }

    if (efxOpenPad !== null) {
      const btn = efxTriggerRefs.current[efxOpenPad];
      if (btn) {
        const br = btn.getBoundingClientRect();
        const w = Math.min(248, vw - 2 * VIEW);
        const panel = efxPopoverMeasureRef.current;
        const rawH = panel?.offsetHeight ?? 320;
        const h = Math.min(rawH, vh - 2 * VIEW);
        let left = br.right - w;
        left = Math.max(VIEW, Math.min(left, vw - w - VIEW));
        let top = br.bottom + GAP;
        if (top + h > vh - VIEW) {
          top = br.top - GAP - h;
        }
        if (top < VIEW) {
          top = VIEW;
        }
        setEfxPopRect({ left, top, width: w });
      } else {
        setEfxPopRect(null);
      }
    } else {
      setEfxPopRect(null);
    }

    if (srcBpmOpenPad !== null) {
      const btn = srcBpmTriggerRefs.current[srcBpmOpenPad];
      if (btn) {
        const br = btn.getBoundingClientRect();
        const w = Math.min(Math.max(br.width, 180), vw - 2 * VIEW);
        let left = br.left;
        left = Math.max(VIEW, Math.min(left, vw - w - VIEW));
        const panel = srcBpmPopoverMeasureRef.current;
        const rawH = panel?.offsetHeight ?? 120;
        const h = Math.min(rawH, vh - 2 * VIEW);
        let top = br.bottom + GAP;
        if (top + h > vh - VIEW) {
          top = br.top - GAP - h;
        }
        if (top < VIEW) {
          top = VIEW;
        }
        setSrcBpmPopRect({ left, top, width: w });
      } else {
        setSrcBpmPopRect(null);
      }
    } else {
      setSrcBpmPopRect(null);
    }
  }, [fxOpenPad, efxOpenPad, srcBpmOpenPad]);

  useLayoutEffect(() => {
    layoutBeatLabPortals();
    const id = requestAnimationFrame(() => layoutBeatLabPortals());
    return () => cancelAnimationFrame(id);
  }, [layoutBeatLabPortals, fxDraft, efxDraft, srcBpmDraft]);

  useEffect(() => {
    if (fxOpenPad === null && efxOpenPad === null && srcBpmOpenPad === null) return;
    const onResizeOrScroll = () => layoutBeatLabPortals();
    window.addEventListener('resize', onResizeOrScroll);
    window.addEventListener('scroll', onResizeOrScroll, true);
    return () => {
      window.removeEventListener('resize', onResizeOrScroll);
      window.removeEventListener('scroll', onResizeOrScroll, true);
    };
  }, [fxOpenPad, efxOpenPad, srcBpmOpenPad, layoutBeatLabPortals]);

  const showGeniusDeck = typeof onGeniusImportFolder === 'function';

  const miniBtn = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '5px 10px',
    borderRadius: 6,
    border: '1px solid #2a2a32',
    background: '#0c0c12',
    color: '#9dc6ff',
    cursor: 'pointer',
    fontSize: 10,
    fontWeight: 800,
    whiteSpace: 'nowrap',
  } as const;

  return (
    <>
    <div
      style={{
        width: '100%',
        maxWidth: '100%',
        padding: '5px 7px 6px',
        borderRadius: 10,
        border: '1px solid rgba(124, 244, 198, 0.22)',
        background: 'linear-gradient(165deg, rgba(11, 11, 16, 0.55) 0%, rgba(8, 8, 12, 0.95) 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        overflow: 'visible',
        position: 'relative',
        zIndex: 120,
        isolation: 'isolate',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 6,
          rowGap: 4,
          flexShrink: 0,
        }}
      >
        {showGeniusDeck ? (
          <>
            <button type="button" onClick={() => onGeniusRecord?.()} style={{ ...miniBtn }}>
              <Mic size={16} strokeWidth={2} />
              Record vocals
            </button>
            <button type="button" onClick={() => onGeniusUpload?.()} style={{ ...miniBtn }}>
              <Upload size={16} strokeWidth={2} />
              Upload
            </button>
            <button
              type="button"
              onClick={() => onGeniusImportFolder?.()}
              title="Load your own drum folder from PC ? 808s, claps, snares, hats auto-map to pads (use this for custom kits)"
              style={{ ...miniBtn }}
            >
              <FolderOpen size={16} strokeWidth={2} />
              Import folder
            </button>
            <button
              type="button"
              onClick={() => onOpenTrapKitBrowser?.()}
              title="Browse kit folders (808s, Claps, Kicks, Hats?) ? load any sound onto any pad"
              style={{
                ...miniBtn,
                borderColor: 'rgba(255, 200, 80, 0.55)',
                color: '#ffd966',
                fontWeight: 900,
              }}
            >
              <FolderOpen size={16} strokeWidth={2} />
              Kit browser
            </button>
            {sessionZoomTools && !hideSamplerPads ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                {sessionZoomTools}
              </div>
            ) : null}
            {kitImportHint ? (
              <span style={{ fontSize: 9, fontWeight: 700, color: '#7cf4c6', maxWidth: 200 }}>{kitImportHint}</span>
            ) : null}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 4,
                padding: '4px 6px',
                borderRadius: 6,
                border: '1px solid rgba(255, 200, 80, 0.35)',
                background: 'rgba(20, 16, 8, 0.55)',
                maxWidth: 360,
              }}
              title="Built-in kits: long 808 tails, claps, trap hits ? or Import folder for your own drums"
            >
              <span style={{ fontSize: 7, color: '#c9a227', fontWeight: 900, letterSpacing: 0.8 }}>CREW KITS</span>
              <select
                value={producerKitId}
                onChange={(e) => onProducerKitIdChange?.(e.target.value as BeatLabProducerKitId)}
                disabled={producerKitLoading}
                style={{
                  padding: '4px 6px',
                  borderRadius: 4,
                  border: '1px solid #3a3020',
                  background: '#0c0c12',
                  color: '#f0e6c8',
                  fontSize: 9,
                  fontWeight: 700,
                  cursor: producerKitLoading ? 'wait' : 'pointer',
                  maxWidth: 168,
                }}
              >
                {BEAT_LAB_PRODUCER_KITS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={producerKitLoading || typeof onLoadProducerKit !== 'function'}
                onClick={() => onLoadProducerKit?.()}
                style={{
                  ...miniBtn,
                  opacity: producerKitLoading ? 0.55 : 1,
                  borderColor: 'rgba(255, 200, 80, 0.45)',
                  color: '#ffd966',
                }}
              >
                {producerKitLoading ? 'Loading?' : 'Load kit'}
              </button>
              {producerKitTribute ? (
                <span style={{ fontSize: 8, fontWeight: 700, color: '#c9a227', lineHeight: 1.25, flex: '1 1 140px' }}>
                  {producerKitTribute}
                </span>
              ) : null}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 140, maxWidth: 220 }}>
              <label style={{ fontSize: 7, color: '#6a6a78', fontWeight: 800 }}>Upload ? pad</label>
              <select
                value={geniusSamplerTargetPad}
                title="File from Upload assigns here"
                onChange={(e) => onGeniusSamplerTargetPadChange?.(Number(e.target.value))}
                style={{
                  padding: '4px 8px',
                  borderRadius: 4,
                  border: '1px solid #2a2a32',
                  background: '#1a1a24',
                  color: '#ccc',
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {Array.from({ length: 16 }, (_, i) => (
                  <option key={i} value={i}>
                    {i + 1}. {PAD_NAMES[i]}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ width: 1, height: 32, background: 'rgba(124, 244, 198, 0.2)', flexShrink: 0 }} aria-hidden />
          </>
        ) : null}

        <div
          style={{
            display: 'inline-flex',
            flexDirection: 'row',
            flexWrap: 'nowrap',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
            minWidth: 0,
            padding: '4px 6px 4px 8px',
            borderRadius: 8,
            border: '1px solid rgba(167, 139, 250, 0.4)',
            background: '#0a0a0e',
            boxSizing: 'border-box',
          }}
          title="Kit preset or your saved kit ? Save sounds + edits ? Clear pattern ? Download"
        >
          <select
            value={kitDropdownValue}
            onChange={(e) => {
              const v = e.target.value;
              if (v.startsWith('preset:')) setKit(v.slice(7));
              onKitSelectChange?.(v);
            }}
            title="Preset label or load a saved kit (all pads + FX)"
            style={{
              padding: '5px 8px',
              borderRadius: 4,
              border: '1px solid rgba(167, 139, 250, 0.35)',
              background: '#0c0c12',
              color: '#e8e8f0',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              maxWidth: 140,
              minWidth: 0,
              flex: '0 1 auto',
              boxSizing: 'border-box',
            }}
          >
            <optgroup label="Presets">
              {presetKitNames.map((k) => (
                <option key={`preset:${k}`} value={`preset:${k}`}>
                  {k}
                </option>
              ))}
            </optgroup>
            {savedKits.length > 0 ? (
              <optgroup label="My saved kits">
                {savedKits.map((sk) => (
                  <option key={`saved:${sk.id}`} value={`saved:${sk.id}`}>
                    ? {sk.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
          {typeof onClearGrid === 'function' ? (
            <button
              type="button"
              disabled={patternActionsDisabled}
              onClick={() => {
                if (patternActionsDisabled) return;
                onClearGrid();
              }}
              title="Clear all steps on the drum grid (current bank + pattern slot)"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                height: 28,
                padding: '0 8px',
                borderRadius: 4,
                border: '1px solid #633',
                background: '#1a1218',
                color: '#f6a9a9',
                fontSize: 10,
                fontWeight: 800,
                cursor: patternActionsDisabled ? 'not-allowed' : 'pointer',
                opacity: patternActionsDisabled ? 0.45 : 1,
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
            >
              <X size={12} strokeWidth={2.5} />
              Clear grid
            </button>
          ) : null}
          {typeof onClearLane === 'function' ? (
            <button
              type="button"
              disabled={patternActionsDisabled || clearLaneDisabled}
              onClick={() => {
                if (patternActionsDisabled || clearLaneDisabled) return;
                onClearLane();
              }}
              title={clearLaneTitle ?? 'Select a lane, then clear that row'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                height: 28,
                padding: '0 8px',
                borderRadius: 4,
                border: '1px solid #4a3a32',
                background: '#141018',
                color: '#d4a88a',
                fontSize: 10,
                fontWeight: 800,
                cursor:
                  patternActionsDisabled || clearLaneDisabled ? 'not-allowed' : 'pointer',
                opacity: patternActionsDisabled || clearLaneDisabled ? 0.45 : 1,
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
            >
              <X size={11} strokeWidth={2.5} />
              Clear lane
            </button>
          ) : null}
          {typeof onDownloadHandoff === 'function' ? (
            <button
              type="button"
              disabled={patternActionsDisabled}
              onClick={() => {
                if (patternActionsDisabled) return;
                onDownloadHandoff();
              }}
              title="Export / Studio handoff (closest to Genius Home Studio Download WAV ? full render uses Export)."
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                height: 28,
                padding: '0 8px',
                borderRadius: 4,
                border: '1px solid rgba(124, 244, 198, 0.35)',
                background: 'rgba(11, 11, 16, 0.65)',
                color: '#7cf4c6',
                fontSize: 10,
                fontWeight: 800,
                cursor: patternActionsDisabled ? 'not-allowed' : 'pointer',
                opacity: patternActionsDisabled ? 0.45 : 1,
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
            >
              <Download size={13} />
              Download
            </button>
          ) : null}
          {deckTransportClocks}
          {typeof onLoadBrassRoomFolder === 'function' ? (
            <button
              type="button"
              disabled={brassRoomLoading}
              onClick={() => onLoadBrassRoomFolder()}
              title={`Auto-load whole folder into Bank ${BANKS[BRASS_ROOM_BANK_INDEX]}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                height: 28,
                padding: '0 8px',
                borderRadius: 4,
                border: '1px solid rgba(124, 244, 198, 0.35)',
                background: 'rgba(11, 11, 16, 0.65)',
                color: '#7cf4c6',
                fontSize: 10,
                fontWeight: 800,
                cursor: brassRoomLoading ? 'wait' : 'pointer',
                opacity: brassRoomLoading ? 0.55 : 1,
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
            >
              {brassRoomLoading ? 'Loading?' : `Load all ? ${BANKS[BRASS_ROOM_BANK_INDEX]}`}
            </button>
          ) : null}
          {typeof onLoadBrassRoomFromProject === 'function' ? (
            <button
              type="button"
              disabled={brassRoomLoading}
              onClick={() => onLoadBrassRoomFromProject()}
              title="Load optional extra WAVs from public/samples/brass-room/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                height: 28,
                padding: '0 8px',
                borderRadius: 4,
                border: '1px solid rgba(124, 244, 198, 0.35)',
                background: 'rgba(11, 11, 16, 0.65)',
                color: '#7cf4c6',
                fontSize: 9,
                fontWeight: 800,
                cursor: brassRoomLoading ? 'wait' : 'pointer',
                opacity: brassRoomLoading ? 0.55 : 1,
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
            >
              Load project folder
            </button>
          ) : null}
          {typeof onSaveKit === 'function' ? (
            <div data-save-kit-root style={{ position: 'relative', flexShrink: 0 }}>
              <button
                type="button"
                disabled={patternActionsDisabled}
                onClick={() => {
                  if (patternActionsDisabled) return;
                  setSaveKitOpen((o) => !o);
                  if (!saveKitOpen) {
                    const preset =
                      kitDropdownValue.startsWith('preset:') ? kitDropdownValue.slice(7) : kit;
                    const savedName = savedKits.find((s) => kitDropdownValue === `saved:${s.id}`)?.name;
                    const draft = savedName ?? preset ?? '';
                    setSaveKitNameDraft(draft);
                    setSaveSongNameDraft(draft);
                  }
                }}
                title="Save kit and/or song (sequence + kit with all edits)"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  height: 28,
                  padding: '0 8px',
                  borderRadius: 4,
                  border: '1px solid rgba(167, 139, 250, 0.45)',
                  background: saveKitOpen ? 'rgba(167, 139, 250, 0.12)' : 'rgba(11, 11, 16, 0.65)',
                  color: '#c4b5fd',
                  fontSize: 10,
                  fontWeight: 800,
                  cursor: patternActionsDisabled ? 'not-allowed' : 'pointer',
                  opacity: patternActionsDisabled ? 0.45 : 1,
                  whiteSpace: 'nowrap',
                }}
              >
                <Save size={13} />
                Save
              </button>
              {saveKitOpen ? (
                <div
                  ref={saveKitPanelRef}
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    zIndex: 500,
                    width: 280,
                    padding: 10,
                    borderRadius: 8,
                    border: '1px solid rgba(167, 139, 250, 0.45)',
                    background: '#0c0c12',
                    boxShadow: '0 12px 32px rgba(0,0,0,0.55)',
                    maxHeight: 'min(70vh, 420px)',
                    overflowY: 'auto',
                  }}
                >
                  <div style={{ fontSize: 9, fontWeight: 800, color: '#7cf4c6', marginBottom: 6, letterSpacing: 0.4 }}>
                    SAVE SONG / SEQUENCE + KIT
                  </div>
                  <div style={{ fontSize: 9, color: '#8a8a98', marginBottom: 8, lineHeight: 1.35 }}>
                    Pattern A and B, BPM, loop, and full kit (samples + FX) on this bank.
                  </div>
                  <input
                    type="text"
                    value={saveSongNameDraft}
                    onChange={(e) => setSaveSongNameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && onSaveSong) {
                        e.preventDefault();
                        onSaveSong(saveSongNameDraft);
                        setSaveKitOpen(false);
                      }
                    }}
                    placeholder="Song name?"
                    maxLength={56}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '6px 8px',
                      marginBottom: 6,
                      borderRadius: 4,
                      border: '1px solid rgba(124, 244, 198, 0.35)',
                      background: '#1a1a24',
                      color: '#e8e8f0',
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  />
                  {typeof onSaveSong === 'function' ? (
                    <button
                      type="button"
                      onClick={() => {
                        onSaveSong(saveSongNameDraft);
                        setSaveKitOpen(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        marginBottom: 10,
                        borderRadius: 4,
                        border: '1px solid rgba(124, 244, 198, 0.5)',
                        background: 'rgba(124, 244, 198, 0.14)',
                        color: '#7cf4c6',
                        fontSize: 10,
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      Save song + kit
                    </button>
                  ) : null}
                  {saveSongStatus ? (
                    <div style={{ marginBottom: 8, fontSize: 9, fontWeight: 700, color: '#7cf4c6' }}>{saveSongStatus}</div>
                  ) : null}
                  {savedSongs.length > 0 ? (
                    <div style={{ marginBottom: 10, borderBottom: '1px solid #2a2a32', paddingBottom: 8 }}>
                      <div style={{ fontSize: 8, fontWeight: 800, color: '#6a6a78', marginBottom: 6 }}>MY SAVED SONGS</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 120, overflowY: 'auto' }}>
                        {savedSongs.map((ss) => (
                          <div key={ss.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
                            {renameSongId === ss.id ? (
                              <input
                                type="text"
                                value={renameSongDraft}
                                onChange={(e) => setRenameSongDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    onRenameSavedSong?.(ss.id, renameSongDraft);
                                    setRenameSongId(null);
                                  }
                                  if (e.key === 'Escape') setRenameSongId(null);
                                }}
                                onBlur={() => {
                                  if (renameSongDraft.trim()) onRenameSavedSong?.(ss.id, renameSongDraft);
                                  setRenameSongId(null);
                                }}
                                autoFocus
                                style={{
                                  flex: 1,
                                  minWidth: 0,
                                  padding: '3px 6px',
                                  borderRadius: 3,
                                  border: '1px solid #2a2a32',
                                  background: '#1a1a24',
                                  color: '#e8e8f0',
                                  fontSize: 10,
                                }}
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => onLoadSavedSong?.(ss.id)}
                                title="Load sequence + kit on current bank"
                                style={{
                                  flex: 1,
                                  minWidth: 0,
                                  textAlign: 'left',
                                  padding: '4px 6px',
                                  borderRadius: 3,
                                  border: '1px solid transparent',
                                  background: 'transparent',
                                  color: '#e8e8f0',
                                  fontSize: 10,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                ? {ss.name}
                              </button>
                            )}
                            {renameSongId !== ss.id ? (
                              <>
                                <button
                                  type="button"
                                  title="Rename"
                                  onClick={() => {
                                    setRenameSongId(ss.id);
                                    setRenameSongDraft(ss.name);
                                  }}
                                  style={{
                                    padding: '2px 5px',
                                    borderRadius: 3,
                                    border: '1px solid #2a2a32',
                                    background: '#1a1a24',
                                    color: '#9ca3af',
                                    fontSize: 8,
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                  }}
                                >
                                  Rename
                                </button>
                                <button
                                  type="button"
                                  title="Delete saved song"
                                  onClick={() => onDeleteSavedSong?.(ss.id)}
                                  style={{
                                    padding: '2px 5px',
                                    borderRadius: 3,
                                    border: '1px solid #633',
                                    background: '#1a1014',
                                    color: '#f6a9a9',
                                    fontSize: 8,
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                  }}
                                >
                                  Del
                                </button>
                              </>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div style={{ fontSize: 9, fontWeight: 800, color: '#a78bfa', marginBottom: 6, letterSpacing: 0.4 }}>
                    KIT ONLY (CURRENT BANK)
                  </div>
                  <div style={{ fontSize: 9, color: '#8a8a98', marginBottom: 8, lineHeight: 1.35 }}>
                    Pads only ? no sequence.
                  </div>
                  <input
                    type="text"
                    value={saveKitNameDraft}
                    onChange={(e) => setSaveKitNameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        onSaveKit(saveKitNameDraft);
                        setSaveKitOpen(false);
                      }
                    }}
                    placeholder="Kit name?"
                    maxLength={48}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '6px 8px',
                      marginBottom: 8,
                      borderRadius: 4,
                      border: '1px solid #2a2a32',
                      background: '#1a1a24',
                      color: '#e8e8f0',
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      onSaveKit(saveKitNameDraft);
                      setSaveKitOpen(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      borderRadius: 4,
                      border: '1px solid rgba(167, 139, 250, 0.5)',
                      background: 'rgba(167, 139, 250, 0.18)',
                      color: '#e9d5ff',
                      fontSize: 10,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Save to My kits
                  </button>
                  {saveKitStatus ? (
                    <div style={{ marginTop: 8, fontSize: 9, fontWeight: 700, color: '#7cf4c6' }}>{saveKitStatus}</div>
                  ) : null}
                  {savedKits.length > 0 ? (
                    <div style={{ marginTop: 10, borderTop: '1px solid #2a2a32', paddingTop: 8 }}>
                      <div style={{ fontSize: 8, fontWeight: 800, color: '#6a6a78', marginBottom: 6 }}>MY SAVED KITS</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 140, overflowY: 'auto' }}>
                        {savedKits.map((sk) => (
                          <div key={sk.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
                            {renameKitId === sk.id ? (
                              <input
                                type="text"
                                value={renameKitDraft}
                                onChange={(e) => setRenameKitDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    onRenameSavedKit?.(sk.id, renameKitDraft);
                                    setRenameKitId(null);
                                  }
                                  if (e.key === 'Escape') setRenameKitId(null);
                                }}
                                onBlur={() => {
                                  if (renameKitDraft.trim()) onRenameSavedKit?.(sk.id, renameKitDraft);
                                  setRenameKitId(null);
                                }}
                                autoFocus
                                style={{
                                  flex: 1,
                                  minWidth: 0,
                                  padding: '3px 6px',
                                  borderRadius: 3,
                                  border: '1px solid #2a2a32',
                                  background: '#1a1a24',
                                  color: '#e8e8f0',
                                  fontSize: 10,
                                }}
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => onKitSelectChange?.(`saved:${sk.id}`)}
                                title="Load this kit on the current bank"
                                style={{
                                  flex: 1,
                                  minWidth: 0,
                                  textAlign: 'left',
                                  padding: '4px 6px',
                                  borderRadius: 3,
                                  border: '1px solid transparent',
                                  background:
                                    kitDropdownValue === `saved:${sk.id}`
                                      ? 'rgba(124,244,198,0.1)'
                                      : 'transparent',
                                  color: '#e8e8f0',
                                  fontSize: 10,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                ? {sk.name}
                              </button>
                            )}
                            {renameKitId !== sk.id ? (
                              <>
                                <button
                                  type="button"
                                  title="Rename"
                                  onClick={() => {
                                    setRenameKitId(sk.id);
                                    setRenameKitDraft(sk.name);
                                  }}
                                  style={{
                                    padding: '2px 5px',
                                    borderRadius: 3,
                                    border: '1px solid #2a2a32',
                                    background: '#1a1a24',
                                    color: '#9ca3af',
                                    fontSize: 8,
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                  }}
                                >
                                  Rename
                                </button>
                                <button
                                  type="button"
                                  title="Delete saved kit"
                                  onClick={() => onDeleteSavedKit?.(sk.id)}
                                  style={{
                                    padding: '2px 5px',
                                    borderRadius: 3,
                                    border: '1px solid #633',
                                    background: '#1a1014',
                                    color: '#f6a9a9',
                                    fontSize: 8,
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                  }}
                                >
                                  Del
                                </button>
                              </>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

        {!hideSamplerPads ? (
        <div
          style={{
            borderTop: '1px solid rgba(124, 244, 198, 0.15)',
            paddingTop: 4,
            overflow: 'visible',
            position: 'relative',
            zIndex: 1,
          }}
        >
        <div
          style={{
            fontSize: 8,
            color: '#7cf4c6',
            fontWeight: 800,
            marginBottom: 3,
            letterSpacing: 0.5,
            width: '100%',
            flexShrink: 0,
          }}
          title={
            'Sampler pad 1?16 is the same pad as Beat Lab lane 1?16: a sound loaded here is that lane?s sample. 8?2 MPC layout. FX/SRC BPM per pad; Apply FX before switching bank.'
          }
        >
          SAMPLER ? 16 PADS
        </div>
        {/* Fixed 8?2 MPC layout ? short BAR/MSR header frees vertical space for taller pad cells */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
            gridTemplateRows: `repeat(2, minmax(${BEAT_LAB_PAD_CELL_MIN_H}px, auto))`,
            gap: 4,
            width: '100%',
            overflow: 'visible',
          }}
        >
          {Array.from({ length: 16 }, (_, padIndex) => {
            const has = hasPadSample(padIndex);
            const root = padSampleRootBpmForPad?.(padIndex);
            const uploadHere = padIndex === geniusSamplerTargetPad;
            const padSelected = selectedDrumPad === padIndex;
            const displayLabel = beatLabLaneDisplayLabel(padIndex, has ? padSampleLabelForPad?.(padIndex) : undefined);
            const padTint = beatLabPadColor(padIndex);
            return (
              <div
                key={padIndex}
                className="cs-pad-hit"
                role="button"
                tabIndex={0}
                onMouseDown={() => onSelectDrumPad?.(padIndex)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectDrumPad?.(padIndex);
                  }
                }}
                title={`Sampler pad ${padIndex + 1} = Beat Lab lane ${padIndex + 1} ? ${displayLabel}${has ? ' ? sample loaded' : ''}${uploadHere ? ' ? UPLOAD ? this pad' : ''}${padSelected ? ' ? selected channel' : ''}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  gap: 4,
                  minWidth: 0,
                  minHeight: BEAT_LAB_PAD_CELL_MIN_H,
                  padding: '3px 4px 4px',
                  borderRadius: 6,
                  border: `2px solid ${
                    padSelected
                      ? 'rgba(124, 244, 198, 0.85)'
                      : uploadHere
                      ? `color-mix(in srgb, ${padTint} 70%, white 12%)`
                      : beatLabPadBorder(padIndex)
                  }`,
                  background: padSelected
                    ? `linear-gradient(165deg, ${beatLabPadButtonFill(padIndex, true)} 0%, #1a1e2a 100%)`
                    : `linear-gradient(165deg, ${beatLabPadSurfaceBg(padIndex, has ? 58 : 50)} 0%, #1a1e2a 100%)`,
                  boxShadow: padSelected
                    ? [
                        '0 0 16px rgba(124, 244, 198, 0.55)',
                        `0 0 8px color-mix(in srgb, ${padTint} 55%, transparent)`,
                        'inset 0 0 0 1px rgba(124, 244, 198, 0.4)',
                      ].join(', ')
                    : uploadHere
                    ? 'inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(0,0,0,0.40)'
                    : has
                      ? 'inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.40)'
                      : 'inset 0 1px 0 rgba(255,255,255,0.03), inset 0 -1px 0 rgba(0,0,0,0.40)',
                  position: 'relative',
                  overflow: 'visible',
                  cursor: onSelectDrumPad ? 'pointer' : undefined,
                }}
              >
                {has ? (
                  <button
                    type="button"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      onClearPadSample(padIndex);
                    }}
                    style={{
                      position: 'absolute',
                      top: 3,
                      right: 3,
                      zIndex: 6,
                      width: 20,
                      height: 20,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 4,
                      border: '1px solid rgba(248, 113, 113, 0.75)',
                      background: 'rgba(24, 6, 6, 0.94)',
                      color: '#fecaca',
                      cursor: 'pointer',
                      padding: 0,
                      boxShadow: '0 1px 6px rgba(0,0,0,0.55)',
                    }}
                    title="Clear sample from this pad"
                  >
                    <X size={12} strokeWidth={2.75} />
                  </button>
                ) : null}
                <div
                  style={{
                    width: '100%',
                    flexShrink: 0,
                    padding: '3px 4px',
                    paddingRight: has ? 22 : 4,
                    borderRadius: 4,
                    background: 'rgba(0, 0, 0, 0.42)',
                    borderBottom: `1px solid color-mix(in srgb, ${padTint} 55%, transparent)`,
                    boxSizing: 'border-box',
                  }}
                >
                  <span
                    style={{
                      width: '100%',
                      fontSize: 9,
                      fontWeight: 800,
                      lineHeight: 1.2,
                      textAlign: 'center',
                      color: has ? '#ffffff' : '#c8cdd8',
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      wordBreak: 'break-word',
                      textShadow: '0 1px 2px rgba(0,0,0,0.65)',
                    }}
                  >
                    {displayLabel}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, minWidth: 0, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 900, color: padTint, flexShrink: 0, width: 14, textAlign: 'center' }}>
                    {padIndex + 1}
                  </span>
                  {getPadSamplerOpts && commitPadSamplerOpts ? (
                    <div data-fx-root={padIndex} style={{ display: 'inline-flex', flexShrink: 0, gap: 3, lineHeight: 0 }}>
                      <button
                        type="button"
                        ref={(el) => {
                          fxTriggerRefs.current[padIndex] = el;
                        }}
                        disabled={!has}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!has) return;
                          toggleFxMenu(padIndex);
                        }}
                        title={
                          has
                            ? 'Sample edit: filters, trim, pitch, trigger (saved with this pad)'
                            : 'Load a sample on this pad first ? then you can open sample edit'
                        }
                        style={{
                          width: 26,
                          height: 22,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 4,
                          border: `1px solid ${
                            !has ? '#2a2a32' : fxOpenPad === padIndex ? 'rgba(255, 255, 255, 0.28)' : '#2a2a32'
                          }`,
                          background: !has
                            ? '#0a0a0e'
                            : fxOpenPad === padIndex
                              ? 'rgba(255, 255, 255, 0.08)'
                              : '#101014',
                          color: !has ? '#4b5563' : fxOpenPad === padIndex ? '#e8e8f0' : '#9dc6ff',
                          cursor: !has ? 'not-allowed' : 'pointer',
                          padding: 0,
                          opacity: has ? 1 : 0.75,
                        }}
                      >
                        <SlidersHorizontal size={12} strokeWidth={2.2} />
                      </button>
                      {getPadSamplerFxRack && commitPadSamplerFxRack ? (
                        <div data-efx-root={padIndex} style={{ display: 'inline-flex', flexShrink: 0, lineHeight: 0 }}>
                        <button
                          type="button"
                          ref={(el) => {
                            efxTriggerRefs.current[padIndex] = el;
                          }}
                          disabled={!has}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!has) return;
                            toggleEfxMenu(padIndex);
                          }}
                          title={
                            has
                              ? 'EFX rack: drive, delay, reverb (per pad)'
                              : 'Load a sample first ? then open the EFX rack'
                          }
                          style={{
                            width: 26,
                            height: 22,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 4,
                            border: `1px solid ${
                              !has ? '#2a2a32' : efxOpenPad === padIndex ? 'rgba(124, 244, 198, 0.45)' : '#2a2a32'
                            }`,
                            background: !has
                              ? '#0a0a0e'
                              : efxOpenPad === padIndex
                                ? 'rgba(124, 244, 198, 0.12)'
                                : '#101014',
                            color: !has ? '#4b5563' : efxOpenPad === padIndex ? '#7cf4c6' : '#c4b5fd',
                            cursor: !has ? 'not-allowed' : 'pointer',
                            padding: 0,
                            opacity: has ? 1 : 0.75,
                          }}
                        >
                          <Waves size={11} strokeWidth={2.4} />
                      </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <div style={{ flex: 1, minWidth: 4 }} aria-hidden />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0, marginLeft: 'auto' }}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        onGeniusMySoundPlay?.(padIndex);
                      }}
                      style={{ border: 'none', background: 'transparent', color: '#9dc6ff', cursor: 'pointer', padding: 2, flexShrink: 0, lineHeight: 0 }}
                      title="Play"
                    >
                      <Play size={15} fill="currentColor" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onStopPadSamplePlayback?.(padIndex)}
                      style={{ border: 'none', background: 'transparent', color: '#9ca3af', cursor: 'pointer', padding: 2, flexShrink: 0, lineHeight: 0 }}
                      title="Stop ? cut all playing sample voices on this pad (long loops / stacked hits)"
                    >
                      <Square size={12} fill="currentColor" strokeWidth={0} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onLoadPadSample(padIndex)}
                      style={{ border: 'none', background: 'transparent', color: '#9dc6ff', cursor: 'pointer', padding: 2, flexShrink: 0, lineHeight: 0 }}
                      title="Load sample"
                    >
                      <Plus size={15} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    width: '100%',
                    minWidth: 0,
                  }}
                >
                  <div data-src-bpm-root={padIndex} style={{ minWidth: 0, position: 'relative', width: '100%' }}>
                    <button
                      type="button"
                      ref={(el) => {
                        srcBpmTriggerRefs.current[padIndex] = el;
                      }}
                      onClick={() => toggleSrcBpmMenu(padIndex)}
                      title="Source BPM (optional) ? click to set. Session BPM scales sample speed+pitch."
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 4,
                        padding: '3px 6px',
                        borderRadius: 4,
                        border: `1px solid ${
                          srcBpmOpenPad === padIndex ? 'rgba(124, 244, 198, 0.5)' : '#2a2a32'
                        }`,
                        background:
                          srcBpmOpenPad === padIndex
                            ? 'linear-gradient(165deg, rgba(11, 11, 16, 0.75) 0%, rgba(10, 9, 16, 0.95) 100%)'
                            : '#101014',
                        color: '#7d87a2',
                        cursor: 'pointer',
                        fontSize: 6,
                        fontWeight: 800,
                        letterSpacing: 0.5,
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                        <span style={{ color: '#6a6a78', letterSpacing: 0.4 }}>SRC BPM</span>
                        {root != null && root > 0 ? (
                          <span style={{ color: '#9dc6ff', fontFamily: 'monospace', fontSize: 9, fontWeight: 700 }}>{root}</span>
                        ) : (
                          <span style={{ color: '#4b5563', fontSize: 7, fontWeight: 700 }}>?</span>
                        )}
                      </span>
                      <ChevronDown
                        size={11}
                        style={{
                          flexShrink: 0,
                          color: srcBpmOpenPad === padIndex ? '#7cf4c6' : '#6a6a78',
                          transform: srcBpmOpenPad === padIndex ? 'rotate(180deg)' : 'none',
                          transition: 'transform 0.12s',
                        }}
                      />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
        ) : null}
        {beatLabDeckFocus === 'roll' &&
        selectedMelodicLane != null &&
        selectedMelodicLane >= BEAT_LAB_MELODIC_LANE_START &&
        getAudioContext &&
        onMelodicInstrumentChange ? (
          <BeatLabMelodicChannelPanel
            lane={selectedMelodicLane}
            instrumentId={
              melodicInstruments[beatLabMelodicSlotIndex(selectedMelodicLane)] ??
              BEAT_LAB_MELODIC_DEFAULT_INSTRUMENTS[beatLabMelodicSlotIndex(selectedMelodicLane)]!
            }
            melodicInstruments={melodicInstruments}
            channelVolumes={channelVolumes}
            disabled={creationBackendBlank}
            getAudioContext={getAudioContext}
            onInstrumentChange={onMelodicInstrumentChange}
          />
        ) : null}
    </div>
    {typeof document !== 'undefined' &&
      srcBpmOpenPad !== null &&
      srcBpmPopRect &&
      createPortal(
        <div
          data-beatlab-portal-popover=""
          ref={srcBpmPopoverMeasureRef}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            left: srcBpmPopRect.left,
            top: srcBpmPopRect.top,
            width: srcBpmPopRect.width,
            zIndex: 50000,
            padding: 8,
            borderRadius: 6,
            border: '1px solid rgba(124, 244, 198, 0.35)',
            background: 'linear-gradient(165deg, rgba(11, 11, 16, 0.75) 0%, rgba(8, 8, 12, 0.96) 100%)',
            boxShadow: '0 10px 28px rgba(0,0,0,0.65)',
            boxSizing: 'border-box',
            maxHeight: 'min(280px, calc(100vh - 16px))',
            overflow: 'auto',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              marginBottom: 6,
            }}
          >
            <div style={{ fontSize: 8, color: '#777', fontWeight: 700 }}>Source tempo (40?320)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <button
                type="button"
                title="Preview ? hear sample at this tempo (not saved until you leave the field or press Enter)"
                onClick={() => {
                  if (srcBpmOpenPad === null) return;
                  onPreviewSamplerRootBpmDraft?.(srcBpmOpenPad, srcBpmDraft);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 26,
                  borderRadius: 4,
                  border: '1px solid rgba(124, 244, 198, 0.35)',
                  background: 'rgba(11, 11, 16, 0.75)',
                  color: '#9dc6ff',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <Play size={13} fill="currentColor" />
              </button>
              <button
                type="button"
                title="Stop sample on this pad"
                onClick={() => {
                  if (srcBpmOpenPad === null) return;
                  onStopPadSamplePlayback?.(srcBpmOpenPad);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 26,
                  borderRadius: 4,
                  border: '1px solid #444',
                  background: '#141418',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <Square size={11} fill="currentColor" strokeWidth={0} />
              </button>
            </div>
          </div>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            placeholder="40?320 or clear"
            value={srcBpmDraft}
            onChange={(e) => setSrcBpmDraft(e.target.value)}
            onBlur={(e) => {
              if (srcBpmOpenPad === null) return;
              const rel = e.relatedTarget as HTMLElement | null;
              if (rel?.closest?.('[data-beatlab-portal-popover]')) return;
              onCommitPadSampleRootBpmRef.current?.(srcBpmOpenPad, srcBpmDraftRef.current);
              setSrcBpmOpenPad(null);
            }}
            onKeyDown={(e) => {
              if (srcBpmOpenPad === null) return;
              if (e.key === 'Enter') {
                onCommitPadSampleRootBpmRef.current?.(srcBpmOpenPad, srcBpmDraft);
                setSrcBpmOpenPad(null);
              } else if (e.key === 'Escape') {
                const r = padSampleRootBpmForPad?.(srcBpmOpenPad);
                setSrcBpmDraft(r != null && r > 0 ? String(r) : '');
                setSrcBpmOpenPad(null);
              }
            }}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 4,
              border: '1px solid #444',
              background: '#0a0a0e',
              color: '#e8eef5',
              fontSize: 13,
              fontFamily: 'monospace',
              fontWeight: 700,
              boxSizing: 'border-box',
            }}
          />
        </div>,
        document.body,
      )}
    {typeof document !== 'undefined' &&
      fxOpenPad !== null &&
      fxPopRect &&
      commitPadSamplerOpts &&
      getPadSamplerOpts &&
      createPortal(
        <div
          data-beatlab-portal-popover=""
          ref={fxPopoverMeasureRef}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            left: fxPopRect.left,
            top: fxPopRect.top,
            width: fxPopRect.width,
            zIndex: 50000,
            boxSizing: 'border-box',
            padding: 10,
            borderRadius: 6,
            border: '1px solid rgba(124, 244, 198, 0.35)',
            background: 'linear-gradient(165deg, rgba(11, 11, 16, 0.92) 0%, rgba(8, 8, 12, 0.98) 100%)',
            boxShadow: '0 12px 36px rgba(0,0,0,0.75)',
            overflow: 'hidden',
            maxHeight: 'min(420px, calc(100vh - 16px))',
          }}
        >
          <div
            style={{
              maxHeight: 'min(62vh, 380px)',
              overflowY: 'auto',
              overflowX: 'hidden',
              margin: '-2px',
              padding: '2px 6px 2px 2px',
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                marginBottom: 8,
              }}
            >
              <div style={{ fontSize: 8, color: '#6b7280', fontWeight: 800 }}>SAMPLE EDIT</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <button
                  type="button"
                  title="Preview ? hear current slider settings (saved with Apply or when you close this panel)"
                  onClick={() => {
                    if (fxOpenPad === null) return;
                    onPreviewSamplerFx?.(fxOpenPad, { ...fxDraft });
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 26,
                    borderRadius: 4,
                    border: '1px solid rgba(124, 244, 198, 0.45)',
                    background: 'rgba(124, 244, 198, 0.12)',
                    color: '#7cf4c6',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  <Play size={13} fill="currentColor" />
                </button>
                <button
                  type="button"
                  title="Stop sample on this pad"
                  onClick={() => {
                    if (fxOpenPad === null) return;
                    onStopPadSamplePlayback?.(fxOpenPad);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 26,
                    borderRadius: 4,
                    border: '1px solid #444',
                    background: '#141418',
                    color: '#9ca3af',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  <Square size={11} fill="currentColor" strokeWidth={0} />
                </button>
              </div>
            </div>
            {onCommitPadSampleLabel ? (
              <>
                <label
                  htmlFor={`creation-fx-label-${fxOpenPad}`}
                  style={{ fontSize: 7, color: '#888', display: 'block', marginBottom: 3 }}
                >
                  Pad / lane name
                </label>
                <input
                  id={`creation-fx-label-${fxOpenPad}`}
                  type="text"
                  autoComplete="off"
                  value={fxLabelDraft}
                  onChange={(e) => setFxLabelDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && fxOpenPad !== null) {
                      onCommitPadSampleLabel?.(fxOpenPad, fxLabelDraft.trim());
                    }
                  }}
                  placeholder="Shown on pad + sequencer lane"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    marginBottom: 10,
                    padding: '6px 8px',
                    borderRadius: 4,
                    border: '1px solid #444',
                    background: '#0a0a0e',
                    color: '#e8eef5',
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                />
              </>
            ) : null}
            <label style={{ fontSize: 7, color: '#888', display: 'block', marginBottom: 2 }}>High-pass (0 = off)</label>
            <input
              type="range"
              min={0}
              max={8000}
              step={10}
              value={fxDraft.hpHz < 25 ? 0 : fxDraft.hpHz}
              onChange={(e) => {
                const v = Number(e.target.value);
                setFxDraft((d) => ({ ...d, hpHz: v < 25 ? 0 : v }));
              }}
              style={{
                width: '100%',
                maxWidth: '100%',
                boxSizing: 'border-box',
                display: 'block',
                margin: '6px 0',
                accentColor: '#7cf4c6',
              }}
            />
            <div style={{ fontSize: 8, color: '#9ca3af', marginBottom: 6 }}>
              {fxDraft.hpHz < 25 ? 'Off' : `${Math.round(fxDraft.hpHz)} Hz`}
            </div>
            <label style={{ fontSize: 7, color: '#888', display: 'block', marginBottom: 2 }}>Low-pass (max = open)</label>
            <input
              type="range"
              min={200}
              max={20000}
              step={50}
              value={fxDraft.lpHz >= 200 && fxDraft.lpHz < 19900 ? fxDraft.lpHz : 20000}
              onChange={(e) => {
                const v = Number(e.target.value);
                setFxDraft((d) => ({ ...d, lpHz: v >= 19900 ? 0 : v }));
              }}
              style={{
                width: '100%',
                maxWidth: '100%',
                boxSizing: 'border-box',
                display: 'block',
                margin: '6px 0',
                accentColor: '#7cf4c6',
              }}
            />
            <div style={{ fontSize: 8, color: '#9ca3af', marginBottom: 6 }}>
              {fxDraft.lpHz >= 200 && fxDraft.lpHz < 19900 ? `${Math.round(fxDraft.lpHz)} Hz` : 'Full bandwidth'}
            </div>
            <label
              style={{ fontSize: 7, color: '#888', display: 'block', marginBottom: 2 }}
              title="MPC-style pad trigger: short gain spike on hit so one-shots bite harder (more hardware sampler punch)."
            >
              Sample trigger (MPC punch)
            </label>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round((fxDraft.triggerSnap ?? 0) * 100)}
              onChange={(e) =>
                setFxDraft((d) => ({ ...d, triggerSnap: Math.max(0, Math.min(1, Number(e.target.value) / 100)) }))
              }
              style={{
                width: '100%',
                maxWidth: '100%',
                boxSizing: 'border-box',
                display: 'block',
                margin: '6px 0',
                accentColor: '#f472b6',
              }}
            />
            <div style={{ fontSize: 8, color: '#9ca3af', marginBottom: 6 }}>
              {Math.round((fxDraft.triggerSnap ?? 0) * 100)}% ? harder hit / less soft fade-in to level
            </div>
            <label
              style={{ fontSize: 7, color: '#888', display: 'block', marginBottom: 4 }}
              title="Studio-style trim: waveform = full file; teal = plays back; dim = outside region. Yellow lines = start / end."
            >
              Trim ? wave + time (start / end)
            </label>
            <PadSampleTrimWaveform
              peaks={fxTrimWavePeaks}
              trim0={fxDraft.trim0}
              trim1={fxDraft.trim1}
              onTrimChange={(t0, t1) => setFxDraft((d) => ({ ...d, trim0: t0, trim1: t1 }))}
            />
            {(() => {
              const dur = fxOpenPad !== null ? getPadSampleAudioBuffer?.(fxOpenPad)?.duration ?? 0 : 0;
              const t0s = fxDraft.trim0 * dur;
              const t1s = fxDraft.trim1 * dur;
              const playLen = Math.max(0, t1s - t0s);
              return (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px 12px',
                    fontSize: 8,
                    color: '#9ca3af',
                    marginBottom: 6,
                    marginTop: 4,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    lineHeight: 1.4,
                  }}
                >
                  <span>
                    Start <strong style={{ color: '#fcd34d' }}>{formatBeatLabSampleTime(t0s)}</strong>{' '}
                    <span style={{ color: '#6b7280' }}>({Math.round(fxDraft.trim0 * 100)}%)</span>
                  </span>
                  <span>
                    End <strong style={{ color: '#fcd34d' }}>{formatBeatLabSampleTime(t1s)}</strong>{' '}
                    <span style={{ color: '#6b7280' }}>({Math.round(fxDraft.trim1 * 100)}%)</span>
                  </span>
                  <span>
                    Play <strong style={{ color: '#a7f3d0' }}>{formatBeatLabSampleTime(playLen)}</strong>
                    {dur > 0 ? <span style={{ color: '#6b7280' }}>{` ? file ${dur.toFixed(3)} s`}</span> : null}
                  </span>
                </div>
              );
            })()}
            <div style={{ fontSize: 7, color: '#6b7280', marginBottom: 4 }}>Start % (top) ? end % (bottom)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', boxSizing: 'border-box' }}>
              <input
                type="range"
                min={0}
                max={95}
                step={1}
                value={Math.round(fxDraft.trim0 * 100)}
                onChange={(e) => {
                  const t0 = Math.min(0.95, Number(e.target.value) / 100);
                  setFxDraft((d) => {
                    let t1 = d.trim1;
                    if (t1 <= t0 + 0.02) t1 = Math.min(1, t0 + 0.08);
                    return { ...d, trim0: t0, trim1: t1 };
                  });
                }}
                style={{
                  width: '100%',
                  maxWidth: '100%',
                  boxSizing: 'border-box',
                  display: 'block',
                  margin: '4px 0',
                  accentColor: '#fbbf24',
                }}
              />
              <input
                type="range"
                min={5}
                max={100}
                step={1}
                value={Math.round(fxDraft.trim1 * 100)}
                onChange={(e) => {
                  const t1 = Math.max(0.05, Math.min(1, Number(e.target.value) / 100));
                  setFxDraft((d) => {
                    let t0 = d.trim0;
                    if (t1 <= t0 + 0.02) t0 = Math.max(0, t1 - 0.08);
                    return { ...d, trim0: t0, trim1: t1 };
                  });
                }}
                style={{
                  width: '100%',
                  maxWidth: '100%',
                  boxSizing: 'border-box',
                  display: 'block',
                  margin: '4px 0',
                  accentColor: '#fbbf24',
                }}
              />
            </div>
            <label style={{ fontSize: 7, color: '#888', display: 'block', marginBottom: 2 }}>
              Fine pitch (semitones, on top of SRC BPM rate)
            </label>
            <input
              type="range"
              min={-12}
              max={12}
              step={0.25}
              value={fxDraft.fineSemi}
              onChange={(e) => setFxDraft((d) => ({ ...d, fineSemi: Number(e.target.value) }))}
              style={{
                width: '100%',
                maxWidth: '100%',
                boxSizing: 'border-box',
                display: 'block',
                margin: '6px 0',
                accentColor: '#7cf4c6',
              }}
            />
            <div style={{ fontSize: 8, color: '#9ca3af', marginBottom: 8 }}>
              {fxDraft.fineSemi >= 0 ? '+' : ''}
              {fxDraft.fineSemi.toFixed(2)} st
            </div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setFxDraft(defaultPadSamplerPlaybackOpts())}
                style={{
                  padding: '4px 8px',
                  borderRadius: 4,
                  border: '1px solid #444',
                  background: '#1a1a24',
                  color: '#888',
                  fontSize: 9,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => {
                  if (fxOpenPad === null) return;
                  onCommitPadSampleLabel?.(fxOpenPad, fxLabelDraft.trim());
                  commitPadSamplerOpts(fxOpenPad, fxDraft);
                  setFxOpenPad(null);
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: 4,
                  border: '1px solid rgba(124, 244, 198, 0.45)',
                  background: 'rgba(124, 244, 198, 0.14)',
                  color: '#7cf4c6',
                  fontSize: 9,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    {typeof document !== 'undefined' &&
      efxOpenPad !== null &&
      efxPopRect &&
      commitPadSamplerFxRack &&
      getPadSamplerFxRack &&
      createPortal(
        <div
          data-beatlab-portal-popover=""
          ref={efxPopoverMeasureRef}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            left: efxPopRect.left,
            top: efxPopRect.top,
            width: efxPopRect.width,
            zIndex: 50000,
            boxSizing: 'border-box',
            padding: 10,
            borderRadius: 6,
            border: '1px solid rgba(167, 139, 250, 0.4)',
            background: 'linear-gradient(165deg, rgba(14, 11, 22, 0.94) 0%, rgba(8, 8, 14, 0.98) 100%)',
            boxShadow: '0 12px 36px rgba(0,0,0,0.75)',
            overflow: 'hidden',
            maxHeight: 'min(420px, calc(100vh - 16px))',
          }}
        >
          <div
            style={{
              maxHeight: 'min(62vh, 380px)',
              overflowY: 'auto',
              overflowX: 'hidden',
              margin: '-2px',
              padding: '2px 6px 2px 2px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                marginBottom: 8,
              }}
            >
              <div style={{ fontSize: 8, color: '#a78bfa', fontWeight: 900, letterSpacing: 0.8 }}>EFX RACK</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <button
                  type="button"
                  title="Preview ? hear current rack settings"
                  onClick={() => {
                    if (efxOpenPad === null) return;
                    onPreviewSamplerFxRack?.(efxOpenPad, { ...efxDraft });
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 26,
                    borderRadius: 4,
                    border: '1px solid rgba(167, 139, 250, 0.4)',
                    background: 'rgba(11, 11, 16, 0.75)',
                    color: '#c4b5fd',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  <Play size={13} fill="currentColor" />
                </button>
                <button
                  type="button"
                  title="Stop sample on this pad"
                  onClick={() => {
                    if (efxOpenPad === null) return;
                    onStopPadSamplePlayback?.(efxOpenPad);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 26,
                    borderRadius: 4,
                    border: '1px solid #444',
                    background: '#141418',
                    color: '#9ca3af',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  <Square size={11} fill="currentColor" strokeWidth={0} />
                </button>
              </div>
            </div>
            <label style={{ fontSize: 7, color: '#888', display: 'block', marginBottom: 2 }}>Drive / saturation</label>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(efxDraft.drive * 100)}
              onChange={(e) =>
                setEfxDraft((d) => ({ ...d, drive: Math.max(0, Math.min(1, Number(e.target.value) / 100)) }))
              }
              style={{ width: '100%', margin: '6px 0', accentColor: '#a78bfa' }}
            />
            <div style={{ fontSize: 8, color: '#9ca3af', marginBottom: 8 }}>
              {Math.round(efxDraft.drive * 100)}%
            </div>
            <div style={{ fontSize: 7, color: '#6b7280', fontWeight: 800, marginBottom: 4 }}>DELAY</div>
            <button
              type="button"
              onClick={() => setEfxDraft((d) => ({ ...d, delay: { ...d.delay, enabled: !d.delay.enabled } }))}
              style={{
                fontSize: 8,
                fontWeight: 800,
                padding: '3px 8px',
                borderRadius: 4,
                marginBottom: 6,
                border: `1px solid ${efxDraft.delay.enabled ? 'rgba(167, 139, 250, 0.5)' : '#444'}`,
                background: efxDraft.delay.enabled ? 'rgba(167, 139, 250, 0.14)' : '#101014',
                color: efxDraft.delay.enabled ? '#c4b5fd' : '#888',
                cursor: 'pointer',
              }}
            >
              {efxDraft.delay.enabled ? 'ON' : 'OFF'}
            </button>
            {efxDraft.delay.enabled ? (
              <>
                <div
                  style={{
                    fontSize: 8,
                    color: '#c4b5fd',
                    fontWeight: 700,
                    marginBottom: 6,
                    fontFamily: 'monospace',
                  }}
                >
                  {padSamplerDelayTimeLabel(sessionBpm, efxDraft.delay)}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setEfxDraft((d) => ({
                      ...d,
                      delay: { ...d.delay, syncToBpm: !d.delay.syncToBpm },
                    }))
                  }
                  style={{
                    fontSize: 7,
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: 4,
                    marginBottom: 6,
                    border: `1px solid ${efxDraft.delay.syncToBpm ? 'rgba(167, 139, 250, 0.55)' : '#444'}`,
                    background: efxDraft.delay.syncToBpm ? 'rgba(167, 139, 250, 0.18)' : '#101014',
                    color: efxDraft.delay.syncToBpm ? '#c4b5fd' : '#888',
                    cursor: 'pointer',
                  }}
                  title="Lock delay time to project BPM"
                >
                  {efxDraft.delay.syncToBpm ? 'BPM SYNC ON' : 'BPM SYNC OFF'}
                </button>
                {efxDraft.delay.syncToBpm ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 8 }}>
                    {PAD_SAMPLER_DELAY_NOTE_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          setEfxDraft((d) => ({
                            ...d,
                            delay: { ...d.delay, note: opt.id },
                          }))
                        }
                        style={{
                          fontSize: 7,
                          fontWeight: 800,
                          padding: '3px 5px',
                          borderRadius: 3,
                          border: `1px solid ${
                            efxDraft.delay.note === opt.id ? 'rgba(167, 139, 250, 0.6)' : '#3a3a44'
                          }`,
                          background:
                            efxDraft.delay.note === opt.id ? 'rgba(167, 139, 250, 0.2)' : '#0c0c10',
                          color: efxDraft.delay.note === opt.id ? '#e9d5ff' : '#7a7a88',
                          cursor: 'pointer',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <>
                    <label style={{ fontSize: 7, color: '#888' }}>Time (ms) ? free</label>
                    <input
                      type="range"
                      min={20}
                      max={2000}
                      step={5}
                      value={efxDraft.delay.timeMs}
                      onChange={(e) =>
                        setEfxDraft((d) => ({
                          ...d,
                          delay: { ...d.delay, timeMs: Number(e.target.value) },
                        }))
                      }
                      style={{ width: '100%', margin: '4px 0 4px', accentColor: '#a78bfa' }}
                    />
                    <div style={{ fontSize: 8, color: '#9ca3af', marginBottom: 8, fontFamily: 'monospace' }}>
                      {efxDraft.delay.timeMs} ms
                    </div>
                  </>
                )}
                <label style={{ fontSize: 7, color: '#888' }}>Repeats (feedback)</label>
                <input
                  type="range"
                  min={0}
                  max={92}
                  step={1}
                  value={Math.round(efxDraft.delay.feedback * 100)}
                  onChange={(e) =>
                    setEfxDraft((d) => ({
                      ...d,
                      delay: { ...d.delay, feedback: Number(e.target.value) / 100 },
                    }))
                  }
                  style={{ width: '100%', margin: '4px 0 4px', accentColor: '#a78bfa' }}
                />
                <div style={{ fontSize: 8, color: '#9ca3af', marginBottom: 6 }}>
                  {Math.round(efxDraft.delay.feedback * 100)}% ? higher = longer echo tail
                </div>
                <label style={{ fontSize: 7, color: '#888' }}>Wet mix</label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={Math.round(efxDraft.delay.mix * 100)}
                  onChange={(e) =>
                    setEfxDraft((d) => ({
                      ...d,
                      delay: { ...d.delay, mix: Number(e.target.value) / 100 },
                    }))
                  }
                  style={{ width: '100%', margin: '4px 0 8px', accentColor: '#a78bfa' }}
                />
              </>
            ) : null}
            <div style={{ fontSize: 7, color: '#6b7280', fontWeight: 800, marginBottom: 4, marginTop: 4 }}>REVERB</div>
            <button
              type="button"
              onClick={() => setEfxDraft((d) => ({ ...d, reverb: { ...d.reverb, enabled: !d.reverb.enabled } }))}
              style={{
                fontSize: 8,
                fontWeight: 800,
                padding: '3px 8px',
                borderRadius: 4,
                marginBottom: 6,
                border: `1px solid ${efxDraft.reverb.enabled ? 'rgba(167, 139, 250, 0.5)' : '#444'}`,
                background: efxDraft.reverb.enabled ? 'rgba(167, 139, 250, 0.14)' : '#101014',
                color: efxDraft.reverb.enabled ? '#c4b5fd' : '#888',
                cursor: 'pointer',
              }}
            >
              {efxDraft.reverb.enabled ? 'ON' : 'OFF'}
            </button>
            {efxDraft.reverb.enabled ? (
              <>
                <label style={{ fontSize: 7, color: '#888' }}>Mix</label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={Math.round(efxDraft.reverb.mix * 100)}
                  onChange={(e) =>
                    setEfxDraft((d) => ({
                      ...d,
                      reverb: { ...d.reverb, mix: Number(e.target.value) / 100 },
                    }))
                  }
                  style={{ width: '100%', margin: '4px 0 8px', accentColor: '#a78bfa' }}
                />
                <label style={{ fontSize: 7, color: '#888' }}>Decay (s)</label>
                <input
                  type="range"
                  min={20}
                  max={300}
                  step={5}
                  value={Math.round(efxDraft.reverb.decaySec * 100)}
                  onChange={(e) =>
                    setEfxDraft((d) => ({
                      ...d,
                      reverb: { ...d.reverb, decaySec: Number(e.target.value) / 100 },
                    }))
                  }
                  style={{ width: '100%', margin: '4px 0 8px', accentColor: '#a78bfa' }}
                />
              </>
            ) : null}
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 8 }}>
              <button
                type="button"
                onClick={() => setEfxDraft(defaultPadSamplerFxRack())}
                style={{
                  padding: '4px 8px',
                  borderRadius: 4,
                  border: '1px solid #444',
                  background: '#1a1a24',
                  color: '#888',
                  fontSize: 9,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => {
                  if (efxOpenPad === null) return;
                  commitPadSamplerFxRack(efxOpenPad, efxDraft);
                  setEfxOpenPad(null);
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: 4,
                  border: '1px solid rgba(167, 139, 250, 0.5)',
                  background: 'rgba(167, 139, 250, 0.14)',
                  color: '#c4b5fd',
                  fontSize: 9,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
  </>
  );
}

/** Isolated rAF tick so elapsed `m:ss` updates smoothly without forcing the whole screen to re-render. */
function CreationGeniusElapsedDisplay({
  displayBeatRef,
  bpmRef,
  isPlaybackOrRecord,
}: {
  displayBeatRef: MutableRefObject<number>;
  bpmRef: MutableRefObject<number>;
  isPlaybackOrRecord: boolean;
}) {
  const [, setRafTick] = useState(0);
  useEffect(() => {
    if (!isPlaybackOrRecord) return;
    let raf = 0;
    const loop = () => {
      setRafTick((n) => (n + 1) & 0xffff);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isPlaybackOrRecord]);
  const beatNow = Math.max(0, displayBeatRef.current);
  const sec = beatNow * (60 / Math.max(1, bpmRef.current));
  const total = Math.floor(Math.min(5999, Math.max(0, sec)));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return <>{`${m}:${String(s).padStart(2, '0')}`}</>;
}


// ?? Main Screen ????????????????????????????????????????????????????????????????

const BEAT_LAB_STORAGE_KEYS = ['creationStation_banks', 'creationStation_patternSlots'] as const;

function clearBeatLabStorage(): void {
  for (const key of BEAT_LAB_STORAGE_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

class CreationStationErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            height: '100%',
            padding: 24,
            background: '#060607',
            color: '#e8e8f0',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: 14, fontWeight: 800, color: '#7cf4c6' }}>Beat Lab could not load</p>
          <p style={{ fontSize: 12, color: '#9a9aa8', maxWidth: 420, lineHeight: 1.5 }}>
            Saved pattern data may be corrupt. Reset Beat Lab storage and reload, or open another screen from the sidebar.
          </p>
          <button
            type="button"
            onClick={() => {
              clearBeatLabStorage();
              window.location.reload();
            }}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid rgba(124,244,198,0.45)',
              background: 'rgba(124,244,198,0.12)',
              color: '#7cf4c6',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Reset Beat Lab data &amp; reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function CreationStationScreenBody({
  onExport,
  isScreenActive = true,
  creationSubScreen = 'beat-lab',
  onCreationSubScreenChange,
}: {
  onExport: (dest: string) => void;
  isScreenActive?: boolean;
  creationSubScreen?: CreationSubScreenId;
  onCreationSubScreenChange?: (sub: CreationSubScreenId) => void;
}) {
  /** Transport: audio = `creationTransportSystem`; UI pump = `useCreationTransportPump` (single rAF + single 25ms timer). */
  const CREATION_BACKEND_BLANK = false;
  const isScreenActiveRef = useRef(isScreenActive);
  isScreenActiveRef.current = isScreenActive;
  const creationSubScreenRef = useRef(creationSubScreen);
  creationSubScreenRef.current = creationSubScreen;

  const {
    triggerChannel,
    channelVolumes,
    getOrCreateAudioContext,
    getMetronomeBusGain,
    masterOutputLinear,
    setMasterOutputLinear,
    // Keep shared audio routing / synth only; Creation transport is local.
  } = useMasterClock();
  const { settings, updateSetting } = useSettings();

  useEffect(() => {
    setMasterOutputLinear(settings.masterVolume);
  }, [settings.masterVolume, setMasterOutputLinear]);

  const onMasterVolumeChange = useCallback(
    (v: number) => {
      const clamped = Math.max(0, Math.min(1, v));
      setMasterOutputLinear(clamped);
      updateSetting('masterVolume', clamped);
    },
    [setMasterOutputLinear, updateSetting],
  );

  type LocalTransportState = 'stopped' | 'playing' | 'paused' | 'recording';
  const [transport, setTransport] = useState<LocalTransportState>('stopped');
  /**
   * Keep master `pause`/`stop` from suspending the shared graph while Beat Lab is playing.
   * `runningRef` is set before `setTransport` — never clear the flag from stale React transport alone.
   */
  useLayoutEffect(() => {
    setCreationBeatLabTransportRunning(
      runningRef.current ||
        transport === 'playing' ||
        transport === 'recording',
    );
  }, [transport]);
  /** Audio lookahead + rAF gate ? set only in start / pause / stop (do not mirror from React state here). */
  const runningRef = useRef(false);
  const recordingRef = useRef(false);

  const [bpm, setBpm] = useState(() => {
    try {
      const raw = localStorage.getItem('da-music-box-creation-station-clip-data-v1');
      if (raw) {
        const clip = JSON.parse(raw) as { bpm?: number };
        if (typeof clip.bpm === 'number' && Number.isFinite(clip.bpm) && clip.bpm > 0) {
          return Math.round(clip.bpm);
        }
      }
    } catch {
      /* fall through */
    }
    return BEAT_LAB_DEFAULT_BPM;
  });
  const bpmRef = useRef(bpm);
  bpmRef.current = bpm;
  const [metronomeEnabled, setMetronomeEnabled] = useState(true);
  const metroOnRef = useRef(true);
  metroOnRef.current = metronomeEnabled;
  const currentDrumsRef = useRef<boolean[][]>([]);

  // SE2-style loop region in beats (bars * beatsPerBar).
  /** 4/4: four quarter-note measures per bar (matches {@link MEASURES_PER_BAR} + MEASURES row). */
  const [beatsPerBar, setBeatsPerBar] = useState(MEASURES_PER_BAR);
  const beatsPerBarRef = useRef(MEASURES_PER_BAR);
  beatsPerBarRef.current = MEASURES_PER_BAR;
  const [loopOn, setLoopOn] = useState(false);
  const loopOnRef = useRef(false);
  loopOnRef.current = loopOn;
  const [loopBars, setLoopBars] = useState(4);
  const loopBarsRef = useRef(4);
  loopBarsRef.current = loopBars;
  /** Which DL chip (4×16 / 2×16 / 1×16) is active — drives highlight on the toolbar. */
  const [beatLabDrumloopPresetActive, setBeatLabDrumloopPresetActive] =
    useState<BeatLabDrumloopPresetVariant>('4bar');
  /** Same subdivision key as Studio Editor 2 piano/drum grid (1/4 ? 1/64). */
  const [pianoSnapSubdiv, setPianoSnapSubdiv] = useState(readPianoSnapSubdivFromStorage);
  const [loopStartBeat, setLoopStartBeat] = useState(0);
  const [loopEndBeat, setLoopEndBeat] = useState(() => beatsPerBarRef.current * 4);
  const loopStartBeatRef = useRef(0);
  const loopEndBeatRef = useRef(loopEndBeat);
  loopStartBeatRef.current = loopStartBeat;
  loopEndBeatRef.current = loopEndBeat;
  const [patternPlayMode, setPatternPlayMode] = useState<'single' | 'chainAB'>('single');
  const patternPlayModeRef = useRef<'single' | 'chainAB'>('single');
  patternPlayModeRef.current = patternPlayMode;
  const [colWidth, setColWidth]     = useState(DEF_CW);
  const [follow, setFollow]         = useState(true);
  const followRef = useRef(follow);
  followRef.current = follow;
  const isPlaybackOrRecordRef = useRef(false);
  const transportNotStoppedRef = useRef(false);
  const [pianoMode, setPianoMode]   = useState<'notes'|'drums'>('notes');
  const [pianoRegisterShift, setPianoRegisterShift] = useState(0);

  const qpb = beatsPerBarRef.current; // SE2 grid: beats per bar (denom fixed 4)
  const ticksPerBar = qpb * PPQ;
  const loopStartTick = Math.round(loopStartBeatRef.current * PPQ);
  const drumStepSubdiv = Math.max(1, Math.min(DRUM_MAX_SUBDIV, normalizePianoSnapSubdiv(pianoSnapSubdiv)));
  const patternColsDrumsBeats = Math.max(1, Math.round((loopBars * ticksPerBar) / PPQ + 1e-6));
  const patternColsDrums = Math.max(
    1,
    Math.min(TOTAL_COLS, patternColsDrumsBeats * drumStepSubdiv),
  );

  const ctxRef = useRef<AudioContext | null>(null);
  const sessionStartRef = useRef(0);
  const originBeatRef = useRef(0);
  const cursorBeatRef = useRef(0);
  const displayBeatRef = useRef(0);
  /** SE2 sched anchor — extrapolate audio time for BAR/MSR/time (`smoothSchedNow` → `bDisplay`). */
  const schedAnchorTimeRef = useRef(0);
  const schedAnchorPerfRef = useRef(0);
  /** Maps `sessionStart` (audio) → `performance.now()` for optional visual re-anchor (SE2 contract). */
  const creationPerfSessionStartMsRef = useRef(0);
  const creationWapiSegStateRef = useRef<CreationPlaylineWapiSegState>({
    ...CREATION_PLAYLINE_WAPI_SEG_IDLE,
  });
  const creationWapiBpmRef = useRef(120);
  const creationMetroClickBuffersRef = useRef<CreationMetronomeClickBuffers | null>(null);
  /** Last BAR/MEASURE/PH; RAF paints BAR + beat-in-bar + phrase into `creationHudDomRef` during playback. */
  const creationHudHoldRef = useRef({ m: 1, b: 1, ph: 1 });
  const creationHudDomRef = useRef<CreationHudDomSlots>({
    barDigits: null,
    msrFrac: null,
    phrase: null,
  });
  /** Studio Editor 2?style Bars / Time chips in deck toolbar (imperative `textContent`, same strings as SE2). */
  const creationSe2BarsReadoutElsRef = useRef(new Set<HTMLSpanElement>());
  const creationSe2TimeReadoutElsRef = useRef(new Set<HTMLSpanElement>());
  const creationSe2ReadoutRegistry = useMemo<CreationSe2ReadoutRegistry>(
    () => ({
      bars: creationSe2BarsReadoutElsRef,
      time: creationSe2TimeReadoutElsRef,
    }),
    [],
  );
  /** Last painted BAR|MSR key ? from `computeCreationTransportHudFromBeat` during playback. */
  const creationHudQuarterPaintedRef = useRef('');
  const colWidthRef = useRef(colWidth);
  const patternColsDrumsRef = useRef(patternColsDrums);
  const drumStepSubdivRef = useRef(drumStepSubdiv);
  const patternColsDrumsBeatsRef = useRef(patternColsDrumsBeats);
  /** Active pad `BufferSource` stop fns — cleared on pause/stop/play so lookahead hits do not stack. */
  const padSampleActiveStoppersRef = useRef<Map<string, Set<() => void>>>(new Map());
  const drumPlaylineRef = useRef<HTMLDivElement>(null);
  const drumGridContentRef = useRef<HTMLDivElement>(null);
  const pianoPlaylineRef = useRef<HTMLDivElement>(null);
  const beatLabRollPlaylineRef = useRef<HTMLDivElement>(null);
  const beatLabSynthPlaylineRef = useRef<HTMLDivElement>(null);
  const beatLabRollScrollRef = useRef<HTMLDivElement>(null);
  const beatLabSynthScrollRef = useRef<HTMLDivElement>(null);
  const beatLabRollScrollSync = useRef<'roll' | 'drum' | null>(null);
  const tabRef = useRef<'drums' | 'grid' | 'groove-lab' | 'piano' | 'chord' | 'chord-seq' | '808-lab'>('grid');
  const beatLabDeckFocusRef = useRef<BeatLabDeckFocus>('sequence');
  const beatLabSynthFocusRef = useRef<{ lane: number; col: number } | null>(null);

  const beatLabPianoPlaylineEl = (): HTMLDivElement | null => {
    if (tabRef.current !== 'grid') return pianoPlaylineRef.current;
    if (beatLabDeckFocusRef.current === 'synth') return beatLabSynthPlaylineRef.current;
    return beatLabRollPlaylineRef.current;
  };

  /** Step-grid col width (ROLL) or scaled width so WAAPI `colF` matches SYNTH quarter columns. */
  const beatLabPianoColWForView = (gridColW: number): number => {
    if (beatLabDeckFocusRef.current === 'synth') {
      return beatLabSynthWapiPianoColW(
        drumStepSubdivRef.current,
        beatsPerBarRef.current,
        MEASURES_PER_BAR,
      );
    }
    return gridColW;
  };
  /** Compositor-thread playline (Studio Editor 2 pattern); RAF must not overwrite while `playState === 'running'`. */
  const creationDrumPlaylineAnimRef = useRef<Animation | null>(null);
  const creationPianoPlaylineAnimRef = useRef<Animation | null>(null);
  const creationDrumQuantGlowAnimRef = useRef<Animation | null>(null);
  /** Loop-wrap edge detect (WAAPI cycle + audio phase fallback) — sound-only refill, no session reanchor. */
  const creationWapiPrevPhaseMsRef = useRef(-1);
  const creationWapiLoopCycleSeenRef = useRef(-1);
  const creationLoopPhaseRef = useRef(-1);
  /** Debounce loop-edge refill — WAAPI + audio can both fire in one frame. */
  const creationLastLoopWrapMsRef = useRef(-1);
  /** Ignore spurious loop-wrap during the first moments after Play (was canceling metronome). */
  const creationTransportPlayStartMsRef = useRef(-1);
  /** Beat Lab quant row cells ? ref array for clearing any legacy imperative styles on tab change. */
  const quantMeasureCellElsRef = useRef<(HTMLDivElement | null)[]>([]);
  colWidthRef.current = colWidth;
  patternColsDrumsRef.current = patternColsDrums;
  drumStepSubdivRef.current = drumStepSubdiv;
  patternColsDrumsBeatsRef.current = patternColsDrumsBeats;

  /** Latest rAF frame handler (assigned each render so the pump always calls current HUD/playline logic). */
  const creationTransportOnFrameRef = useRef<(bDisplay: number) => void>(() => {});
  /**
   * Last values for which we publish {@link publishCreationTransportBeat}.
   * We only bump on **pattern column** or **BAR|MSR|PH** changes ? not every subdiv step ? so the main
   * screen is not re-rendered ~32?/s while the playline still moves on the compositor (WAAPI).
   */
  const creationTransportUiPublishRef = useRef<{
    activeCol: number;
    hudKey: string;
  }>({
    activeCol: Number.NaN,
    hudKey: '',
  });
  /** Solid transport clock: next step index/time are advanced monotonically from the audio clock only. */
  const nextStepBeatRef = useRef(0);
  const nextStepTimeRef = useRef(0);
  const nextMetroKRef = useRef(0);
  const lastScheduledQuarterRef = useRef<number>(Number.NEGATIVE_INFINITY);
  /** Caller audio-time snapshot for the active refill (DAW chain rule — do not re-read `ctx.currentTime` in steps). */
  const creationRefillCtSnapRef = useRef(0);
  /** Set from `refillCreationSchedule` (defined after `fireStepAt`) so cold start can call it. */
  const refillCreationScheduleRef = useRef<
    (
      ctx: AudioContext,
      ctSnap: number,
      opts?: { loopContinuation?: boolean; skipOverdueCatchUp?: boolean },
    ) => void
  >(() => {});
  const onAudioContextRebuiltRef = useRef<(ctx: AudioContext) => void>();

  /** Same idea as SE2 `scheduledMetroNodesRef` — buffer clicks queued ~3s ahead; stop on pause/stop. */
  const scheduledCreationMetroNodesRef = useRef<CreationScheduledMetroNode[]>([]);

  const cancelScheduledCreationMetroNodes = useCallback(() => {
    const arr = scheduledCreationMetroNodesRef.current;
    for (const { src, gain } of arr) {
      try {
        const c = src.context;
        if (c.state !== 'closed') src.stop(c.currentTime);
      } catch {
        /* already stopped */
      }
      try {
        src.disconnect();
        gain.disconnect();
      } catch {
        /* */
      }
    }
    arr.length = 0;
  }, []);

  /** Stop queued pad voices only — does not touch transport clock / metronome / playhead. */
  const stopAllScheduledPadVoices = useCallback(() => {
    const map = padSampleActiveStoppersRef.current;
    for (const bag of map.values()) {
      for (const fn of [...bag]) {
        try {
          fn();
        } catch {
          /* */
        }
      }
    }
    map.clear();
  }, []);

  /** Metronome click — SE2 `playClick` / Musio buffer contract via {@link scheduleCreationMetronomeClickAt}. */
  const scheduleMetronomeClickAt = useCallback(
    (ctx: AudioContext, idealT: number, accent: boolean, audioNowForClamp: number) => {
      if (!metroOnRef.current) return;
      const buffers = ensureCreationMetronomeClickBuffers(
        ctx,
        creationMetroClickBuffersRef.current,
      );
      creationMetroClickBuffersRef.current = buffers;
      scheduleCreationMetronomeClickAt(
        ctx,
        idealT,
        accent,
        audioNowForClamp,
        buffers,
        getMetronomeBusGain,
        scheduledCreationMetroNodesRef.current,
      );
    },
    [getMetronomeBusGain],
  );

  const ensureCtx = useCallback(async (): Promise<AudioContext> => {
    const ctx = ctxRef.current ?? getOrCreateAudioContext();
    ctxRef.current = ctx;
    if (ctx.state === 'suspended') {
      try { await ctx.resume(); } catch { /* autoplay */ }
    }
    return ctx;
  }, [getOrCreateAudioContext]);

  const resetCreationPlaylineTransforms = useCallback(() => {
    const cw = Math.max(colWidthRef.current, DRUM_GRID_MIN_CW);
    cancelCreationPlaylineWapi(
      {
        drumAnimRef: creationDrumPlaylineAnimRef,
        pianoAnimRef: creationPianoPlaylineAnimRef,
        drumQuantGlowAnimRef: creationDrumQuantGlowAnimRef,
      },
      drumPlaylineRef.current,
      beatLabPianoPlaylineEl(),
      null,
    );
    const drumEl = drumPlaylineRef.current;
    const pianoEl = beatLabPianoPlaylineEl();
    if (drumEl) drumEl.style.transform = `translate3d(${-CREATION_DRUM_PLAYLINE_CENTER_X}px, 0, 0)`;
    if (pianoEl) pianoEl.style.transform = `translate3d(${-CREATION_PIANO_PLAYLINE_CENTER_X}px, 0, 0)`;
  }, []);

  /**
   * Imperative snap: cancel WAAPI + `transform` ? **only while transport is not running**.
   * During play, motion + loop wrap are owned by {@link launchCreationPlaylineWapiNow} (compositor);
   * calling this with `runningRef` true would cancel that anim and desync the line from audio.
   */
  /** Cancel compositor motion and snap playline to `beatNow` (stop / rewind / scrub while halted). */
  const haltCreationPlaylineAtBeat = useCallback((beatNow: number) => {
    cancelCreationPlaylineWapi(
      {
        drumAnimRef: creationDrumPlaylineAnimRef,
        pianoAnimRef: creationPianoPlaylineAnimRef,
        drumQuantGlowAnimRef: creationDrumQuantGlowAnimRef,
        wapiSegStateRef: creationWapiSegStateRef,
        wapiBpmRef: creationWapiBpmRef,
      },
      drumPlaylineRef.current,
      beatLabPianoPlaylineEl(),
      null,
    );
    creationWapiSegStateRef.current = { ...CREATION_PLAYLINE_WAPI_SEG_IDLE };
    const cw = Math.max(colWidthRef.current, DRUM_GRID_MIN_CW);
    const pcw = beatLabPianoColWForView(Math.max(colWidthRef.current, PIANO_GRID_MIN_CW));
    setCreationPlaylineTransformStatic({
      drumEl: drumPlaylineRef.current,
      pianoEl: beatLabPianoPlaylineEl(),
      drumQuantGlowEl: null,
      beatNow,
      subdiv: drumStepSubdivRef.current,
      pcols: patternColsDrumsRef.current,
      drumColW: cw,
      pianoColW: pcw,
      loopOn: loopOnRef.current,
      loopStartBeat: loopStartBeatRef.current,
      loopEndBeat: loopEndBeatRef.current,
      playMode: patternPlayModeRef.current,
    });
    for (const el of [drumPlaylineRef.current, beatLabPianoPlaylineEl()]) {
      if (!el) continue;
      el.getAnimations().forEach((a) => a.cancel());
      el.style.removeProperty('will-change');
    }
  }, []);

  const updateCreationPlaylineTransforms = useCallback((beatNow: number) => {
    if (runningRef.current) return;
    haltCreationPlaylineAtBeat(beatNow);
  }, [haltCreationPlaylineAtBeat]);

  /** Scroll drum + piano/synth decks so `beat` is visible; beat 0 → grid start (measure 1). */
  const scrollCreationGridsToBeat = useCallback((beat: number) => {
    const atStart = beat <= 1e-6;
    const scrollEl = (el: HTMLDivElement | null) => {
      if (!el) return;
      if (atStart) {
        el.scrollLeft = 0;
        return;
      }
      const subdivR = Math.max(1, Math.min(DRUM_MAX_SUBDIV, Math.round(drumStepSubdivRef.current)));
      const pcolsR = Math.max(1, patternColsDrumsRef.current);
      const cwD = Math.max(colWidthRef.current, DRUM_GRID_MIN_CW);
      const cwP = beatLabPianoColWForView(Math.max(colWidthRef.current, PIANO_GRID_MIN_CW));
      const { drumX, pianoX } = creationPlaylineColFAndPx(
        beat,
        subdivR,
        pcolsR,
        loopOnRef.current,
        loopStartBeatRef.current,
        loopEndBeatRef.current,
        patternPlayModeRef.current,
        cwD,
        cwP,
      );
      const px = el === drumScrollRef.current ? drumX : pianoX;
      const left = el.scrollLeft;
      const right = left + el.clientWidth;
      const m = el.clientWidth * 0.3;
      if (px < left + m || px > right - m) {
        el.scrollLeft = Math.max(0, px - el.clientWidth * 0.35);
      }
    };
    scrollEl(drumScrollRef.current);
    if (tabRef.current === 'grid') {
      scrollEl(
        beatLabDeckFocusRef.current === 'synth'
          ? beatLabSynthScrollRef.current
          : beatLabRollScrollRef.current,
      );
    } else {
      scrollEl(pianoScrollRef.current);
    }
  }, []);

  const creationPlaylineWapiRefs = useMemo(
    () => ({
      drumAnimRef: creationDrumPlaylineAnimRef,
      pianoAnimRef: creationPianoPlaylineAnimRef,
      drumQuantGlowAnimRef: creationDrumQuantGlowAnimRef,
      wapiSegStateRef: creationWapiSegStateRef,
      wapiBpmRef: creationWapiBpmRef,
    }),
    [],
  );

  /** WAAPI owns drum/piano playline motion + loop segment (pause → seek → play); SE2 `launchWapiAnims`. */
  const launchCreationPlaylineWapiNow = useCallback((
    beatNow: number,
    play: boolean,
    opts?: { immediateCompositorStart?: boolean },
  ) => {
    const cw = Math.max(colWidthRef.current, DRUM_GRID_MIN_CW);
    const pcw = beatLabPianoColWForView(Math.max(colWidthRef.current, PIANO_GRID_MIN_CW));
    resetCreationLoopWrapDetectRefs(
      creationWapiPrevPhaseMsRef,
      creationWapiLoopCycleSeenRef,
      creationLoopPhaseRef,
    );
    launchCreationPlaylineWapi(creationPlaylineWapiRefs, {
      drumEl: drumPlaylineRef.current,
      pianoEl: beatLabPianoPlaylineEl(),
      drumQuantGlowEl: null,
      beatNow,
      play,
      bpm: bpmRef.current,
      subdiv: drumStepSubdivRef.current,
      pcols: patternColsDrumsRef.current,
      drumColW: cw,
      pianoColW: pcw,
      loopOn: loopOnRef.current,
      loopStartBeat: loopStartBeatRef.current,
      loopEndBeat: loopEndBeatRef.current,
      playMode: patternPlayModeRef.current,
      totalBeats: Math.max(1e-9, patternColsDrumsBeatsRef.current),
      audioStartLeadSec: SE2_AUDIO_START_FLOOR_SEC,
      immediateCompositorStart: opts?.immediateCompositorStart,
    });
  }, [creationPlaylineWapiRefs]);

  /** Studio Editor 2?style Bars / Time text (same `formatBarsBeatsTicks` + `formatTimeMmSsFf` as SE2). */
  const paintCreationSe2TransportReadouts = useCallback((beats: number, paused: boolean) => {
    const db = Math.max(0, beats);
    const bpb = Math.max(2, Math.min(16, Math.round(beatsPerBarRef.current)));
    const bpmR = Math.max(1, bpmRef.current);
    const bars = formatCreationSe2BarsBeatsTicks(db, bpb);
    const time = formatCreationSe2TimeMmSsFf(db, bpmR);
    const barsText = paused ? `pause ${bars}` : bars;
    for (const el of creationSe2BarsReadoutElsRef.current) el.textContent = barsText;
    for (const el of creationSe2TimeReadoutElsRef.current) el.textContent = time;
  }, []);

  const startTransport = useCallback(async (mode: 'play' | 'record') => {
    /** Preserve fractional beat (stop / pause / scrub) ? snapping to `floor` here caused playhead + audio to jump on Play. */
    const origin = Math.max(0, cursorBeatRef.current);
    cursorBeatRef.current = origin;
    originBeatRef.current = origin;
    displayBeatRef.current = origin;

    recordingRef.current = mode === 'record';
    creationTransportPlayStartMsRef.current = performance.now();
    setCreationBeatLabTransportRunning(true);
    resetCreationLoopWrapDetectRefs(
      creationWapiPrevPhaseMsRef,
      creationWapiLoopCycleSeenRef,
      creationLoopPhaseRef,
    );
    for (const el of [drumPlaylineRef.current, beatLabPianoPlaylineEl()]) {
      if (el) el.style.opacity = '1';
    }
    /** Compositor starts on the click — do not wait for `ensureCtx()` (was causing hesitate + lag vs metronome). */
    launchCreationPlaylineWapiNow(origin, true, { immediateCompositorStart: true });
    const ctx = await ensureCtx();
    stopAllScheduledPadVoices();
    const tNow = Math.max(0, ctx.currentTime);
    sessionStartRef.current = tNow + SE2_AUDIO_START_FLOOR_SEC;
    schedAnchorTimeRef.current = tNow;
    schedAnchorPerfRef.current = performance.now();
    creationPerfSessionStartMsRef.current =
      performance.now() + SE2_AUDIO_START_FLOOR_SEC * 1000;
    const spb = 60 / Math.max(1, bpmRef.current);
    /** Next quarter boundary at/after `origin` ? `floor` put `tGrid` in the past mid-beat and broke refill sync. */
    const k0 = Math.ceil(origin - 1e-8);
    nextStepBeatRef.current = k0;
    nextStepTimeRef.current = sessionStartRef.current + (k0 - origin) * spb;
    nextMetroKRef.current = k0;
    lastScheduledQuarterRef.current = k0 - 1;
    displayBeatRef.current = origin;
    runningRef.current = true;
    void warmupBeatLabMelodicSoundfont(ctx, melodicInstrumentsRef.current);
    /** SE2 order: anchor audio, immediate refill, then compositor WAAPI locked to `sessionStart`. */
    refillCreationScheduleRef.current(ctx, tNow, { skipOverdueCatchUp: true });
    /** Lock playline to cursor + audio session anchor (no cancel — avoids flash). */
    seekRunningCreationPlaylineWapi(creationPlaylineWapiRefs, origin, bpmRef.current);
    /** After `resume()` / first refill, top up lookahead so beat-0 isn't followed by a dry gap. */
    queueMicrotask(() => {
      if (!runningRef.current) return;
      const c = ctxRef.current;
      if (!c || c.state === 'closed') return;
      refillCreationScheduleRef.current(c, Math.max(0, c.currentTime), {
        skipOverdueCatchUp: true,
      });
    });
    setTransport(mode === 'record' ? 'recording' : 'playing');
    const beatLaunch = origin;
    /**
     * Defer follow-scroll + HUD paint to the next macrotask so the compositor can commit the first WAAPI
     * frame before this thread runs heavy DOM ? removes a slight ?stuck then moves? feel on Play.
     */
    window.setTimeout(() => {
      if (!runningRef.current) return;
      if (followRef.current) {
        const subdivR = Math.max(1, Math.min(DRUM_MAX_SUBDIV, Math.round(drumStepSubdivRef.current)));
        const pcolsR = Math.max(1, patternColsDrumsRef.current);
        const cwD = Math.max(colWidthRef.current, DRUM_GRID_MIN_CW);
        const cwP = beatLabPianoColWForView(Math.max(colWidthRef.current, PIANO_GRID_MIN_CW));
        const pos0 = creationPlaylineColFAndPx(
          beatLaunch,
          subdivR,
          pcolsR,
          loopOnRef.current,
          loopStartBeatRef.current,
          loopEndBeatRef.current,
          patternPlayModeRef.current,
          cwD,
          cwP,
        );
        const scrollOne = (el: HTMLDivElement | null, px: number) => {
          if (!el) return;
          const left = el.scrollLeft;
          const right = left + el.clientWidth;
          const m = el.clientWidth * 0.3;
          if (px < left + m || px > right - m) {
            el.scrollLeft = Math.max(0, px - el.clientWidth * 0.35);
          }
        };
        scrollOne(drumScrollRef.current, pos0.drumX);
        if (tabRef.current === 'grid') {
          scrollOne(
            beatLabDeckFocusRef.current === 'synth'
              ? beatLabSynthScrollRef.current
              : beatLabRollScrollRef.current,
            pos0.pianoX,
          );
        } else {
          scrollOne(pianoScrollRef.current, pos0.pianoX);
        }
      }
      const qpbR = Math.max(2, Math.min(16, Math.round(beatsPerBarRef.current)));
      const subdiv = Math.max(1, Math.min(DRUM_MAX_SUBDIV, Math.round(drumStepSubdivRef.current)));
      const pcols = Math.max(1, patternColsDrumsRef.current);
      const loopStartBarR = Math.floor(loopStartBeatRef.current / qpbR) + 1;
      const hud = computeCreationTransportHudFromBeat(beatLaunch, {
        subdiv,
        pcols,
        loopOn: loopOnRef.current,
        loopStartBeat: loopStartBeatRef.current,
        loopEndBeat: loopEndBeatRef.current,
        playMode: patternPlayModeRef.current,
        loopStartBar: loopStartBarR,
        qpb: qpbR,
        transportOriginBeat: originBeatRef.current,
      });
      creationHudQuarterPaintedRef.current = `${hud.bar}|${hud.measure}|${hud.phrase}`;
      paintCreationHudQuarterIntoDom(
        creationHudDomRef.current,
        hud,
        qpbR,
        { active: true },
        creationHudHoldRef,
        true,
      );
      creationTransportUiPublishRef.current = { activeCol: Number.NaN, hudKey: '' };
      publishCreationTransportBeat();
      paintCreationSe2TransportReadouts(beatLaunch, false);
    }, 0);
  }, [
    ensureCtx,
    SE2_AUDIO_START_FLOOR_SEC,
    launchCreationPlaylineWapiNow,
    paintCreationSe2TransportReadouts,
    stopAllScheduledPadVoices,
  ]);

  const pauseTransport = useCallback(async () => {
    cancelScheduledCreationMetroNodes();
    stopAllScheduledPadVoices();
    const ctx = await ensureCtx();
    updateSchedAnchor(ctx, schedAnchorTimeRef, schedAnchorPerfRef);
    const tNow = smoothSchedNow(schedAnchorTimeRef, schedAnchorPerfRef, ctx);
    const b = beatAtSessionTime(tNow, sessionStartRef.current, originBeatRef.current, bpmRef.current);
    cursorBeatRef.current = b;
    displayBeatRef.current = b;
    originBeatRef.current = b;
    runningRef.current = false;
    recordingRef.current = false;
    creationTransportPlayStartMsRef.current = -1;
    setCreationBeatLabTransportRunning(false);
    resetCreationLoopWrapDetectRefs(
      creationWapiPrevPhaseMsRef,
      creationWapiLoopCycleSeenRef,
      creationLoopPhaseRef,
    );
    haltCreationPlaylineAtBeat(b);
    const qpbR = Math.max(2, Math.min(16, Math.round(beatsPerBarRef.current)));
    const subdiv = Math.max(1, Math.min(DRUM_MAX_SUBDIV, Math.round(drumStepSubdivRef.current)));
    const pcols = Math.max(1, patternColsDrumsRef.current);
    const loopStartBarR = Math.floor(loopStartBeatRef.current / qpbR) + 1;
    const hudPause = computeCreationTransportHudFromBeat(b, {
      subdiv,
      pcols,
      loopOn: loopOnRef.current,
      loopStartBeat: loopStartBeatRef.current,
      loopEndBeat: loopEndBeatRef.current,
      playMode: patternPlayModeRef.current,
      loopStartBar: loopStartBarR,
      qpb: qpbR,
      transportOriginBeat: originBeatRef.current,
    });
    creationHudQuarterPaintedRef.current = `${hudPause.bar}|${hudPause.measure}|${hudPause.phrase}`;
    paintCreationHudQuarterIntoDom(
      creationHudDomRef.current,
      hudPause,
      qpbR,
      { active: false },
      creationHudHoldRef,
      true,
    );
    creationTransportUiPublishRef.current = {
      activeCol: Number.NaN,
      hudKey: '',
    };
    paintCreationSe2TransportReadouts(b, true);
    setTransport('paused');
    publishCreationTransportBeat();
  }, [
    cancelScheduledCreationMetroNodes,
    ensureCtx,
    haltCreationPlaylineAtBeat,
    paintCreationSe2TransportReadouts,
    stopAllScheduledPadVoices,
  ]);

  const stopTransport = useCallback(() => {
    cancelScheduledCreationMetroNodes();
    stopAllScheduledPadVoices();
    let b = displayBeatRef.current;
    const ctx = ctxRef.current;
    if (ctx && ctx.state !== 'closed' && sessionStartRef.current > 0 && runningRef.current) {
      updateSchedAnchor(ctx, schedAnchorTimeRef, schedAnchorPerfRef);
      const tNow = smoothSchedNow(schedAnchorTimeRef, schedAnchorPerfRef, ctx);
      b = beatAtSessionTime(tNow, sessionStartRef.current, originBeatRef.current, bpmRef.current);
    }
    runningRef.current = false;
    recordingRef.current = false;
    creationTransportPlayStartMsRef.current = -1;
    setCreationBeatLabTransportRunning(false);
    schedAnchorTimeRef.current = 0;
    schedAnchorPerfRef.current = 0;
    creationPerfSessionStartMsRef.current = 0;
    resetCreationLoopWrapDetectRefs(
      creationWapiPrevPhaseMsRef,
      creationWapiLoopCycleSeenRef,
      creationLoopPhaseRef,
    );
    cursorBeatRef.current = b;
    originBeatRef.current = b;
    displayBeatRef.current = b;
    sessionStartRef.current = 0;
    lastScheduledQuarterRef.current = Number.NEGATIVE_INFINITY;
    resetCreationTransportStepClock({ nextStepBeatRef, nextStepTimeRef });
    reanchorNextStepWhileStopped({ nextStepBeatRef, nextStepTimeRef }, b);
    haltCreationPlaylineAtBeat(b);
    const z = creationHudDomRef.current;
    const qpbR = Math.max(2, Math.min(16, Math.round(beatsPerBarRef.current)));
    const subdiv = Math.max(1, Math.min(DRUM_MAX_SUBDIV, Math.round(drumStepSubdivRef.current)));
    const pcols = Math.max(1, patternColsDrumsRef.current);
    const loopStartBarR = Math.floor(loopStartBeatRef.current / qpbR) + 1;
    const hudStop = computeCreationTransportHudFromBeat(b, {
      subdiv,
      pcols,
      loopOn: loopOnRef.current,
      loopStartBeat: loopStartBeatRef.current,
      loopEndBeat: loopEndBeatRef.current,
      playMode: patternPlayModeRef.current,
      loopStartBar: loopStartBarR,
      qpb: qpbR,
      transportOriginBeat: originBeatRef.current,
    });
    creationHudQuarterPaintedRef.current = `${hudStop.bar}|${hudStop.measure}|${hudStop.phrase}`;
    paintCreationHudQuarterIntoDom(z, hudStop, qpbR, { active: false }, creationHudHoldRef, true);
    paintCreationSe2TransportReadouts(b, false);
    setTransport('stopped');
    creationTransportUiPublishRef.current = { activeCol: Number.NaN, hudKey: '' };
    publishCreationTransportBeat();
  }, [
    cancelScheduledCreationMetroNodes,
    haltCreationPlaylineAtBeat,
    lastScheduledQuarterRef,
    stopAllScheduledPadVoices,
    paintCreationSe2TransportReadouts,
  ]);

  /** Stop transport + return to bar 1 / beat 0 (Skip Back) — playhead, HUD, and scroll. */
  const rewindTransport = useCallback(() => {
    cancelScheduledCreationMetroNodes();
    stopAllScheduledPadVoices();
    runningRef.current = false;
    recordingRef.current = false;
    creationTransportPlayStartMsRef.current = -1;
    setCreationBeatLabTransportRunning(false);
    schedAnchorTimeRef.current = 0;
    schedAnchorPerfRef.current = 0;
    creationPerfSessionStartMsRef.current = 0;
    sessionStartRef.current = 0;
    lastScheduledQuarterRef.current = Number.NEGATIVE_INFINITY;
    resetCreationTransportStepClock({ nextStepBeatRef, nextStepTimeRef });
    resetCreationLoopWrapDetectRefs(
      creationWapiPrevPhaseMsRef,
      creationWapiLoopCycleSeenRef,
      creationLoopPhaseRef,
    );
    cursorBeatRef.current = 0;
    originBeatRef.current = 0;
    displayBeatRef.current = 0;
    reanchorNextStepWhileStopped({ nextStepBeatRef, nextStepTimeRef }, 0);
    haltCreationPlaylineAtBeat(0);
    scrollCreationGridsToBeat(0);
    const qpbR = Math.max(2, Math.min(16, Math.round(beatsPerBarRef.current)));
    const subdiv = Math.max(1, Math.min(DRUM_MAX_SUBDIV, Math.round(drumStepSubdivRef.current)));
    const pcols = Math.max(1, patternColsDrumsRef.current);
    const hud0 = computeCreationTransportHudFromBeat(0, {
      subdiv,
      pcols,
      loopOn: loopOnRef.current,
      loopStartBeat: loopStartBeatRef.current,
      loopEndBeat: loopEndBeatRef.current,
      playMode: patternPlayModeRef.current,
      loopStartBar: 1,
      qpb: qpbR,
      transportOriginBeat: 0,
    });
    creationHudQuarterPaintedRef.current = `${hud0.bar}|${hud0.measure}|${hud0.phrase}`;
    paintCreationHudQuarterIntoDom(
      creationHudDomRef.current,
      hud0,
      qpbR,
      { active: false },
      creationHudHoldRef,
      true,
    );
    paintCreationSe2TransportReadouts(0, false);
    setTransport('stopped');
    creationTransportUiPublishRef.current = { activeCol: Number.NaN, hudKey: '' };
    publishCreationTransportBeat();
  }, [
    cancelScheduledCreationMetroNodes,
    haltCreationPlaylineAtBeat,
    scrollCreationGridsToBeat,
    stopAllScheduledPadVoices,
    paintCreationSe2TransportReadouts,
  ]);

  const seekBeats = useCallback((b: number) => {
    const nb = Math.max(0, b);
    cursorBeatRef.current = nb;
    displayBeatRef.current = nb;
    if (runningRef.current && ctxRef.current) {
      const ctx = ctxRef.current;
      const tCapture = Math.max(0, ctx.currentTime);
      sessionStartRef.current = tCapture + SE2_AUDIO_START_FLOOR_SEC;
      originBeatRef.current = nb;
      const spb = 60 / Math.max(1, bpmRef.current);
      reanchorNextStepWhileRunning(
        {
          nextStepBeatRef,
          nextStepTimeRef,
          sessionStartRef,
          originBeatRef,
          lastScheduledQuarterRef,
        },
        sessionStartRef.current,
        nb,
        spb,
      );
    } else {
      originBeatRef.current = nb;
      sessionStartRef.current = 0;
      reanchorNextStepWhileStopped({ nextStepBeatRef, nextStepTimeRef }, nb);
    }
    if (runningRef.current) {
      launchCreationPlaylineWapiNow(nb, true);
    } else {
      haltCreationPlaylineAtBeat(nb);
    }
    scrollCreationGridsToBeat(nb);
    const qpbR = Math.max(2, Math.min(16, Math.round(beatsPerBarRef.current)));
    const subdiv = Math.max(1, Math.min(DRUM_MAX_SUBDIV, Math.round(drumStepSubdivRef.current)));
    const pcols = Math.max(1, patternColsDrumsRef.current);
    const loopStartBarR = Math.floor(loopStartBeatRef.current / qpbR) + 1;
    const hudSeek = computeCreationTransportHudFromBeat(nb, {
      subdiv,
      pcols,
      loopOn: loopOnRef.current,
      loopStartBeat: loopStartBeatRef.current,
      loopEndBeat: loopEndBeatRef.current,
      playMode: patternPlayModeRef.current,
      loopStartBar: loopStartBarR,
      qpb: qpbR,
      transportOriginBeat: originBeatRef.current,
    });
    if (runningRef.current) {
      creationHudQuarterPaintedRef.current = '';
    } else {
      creationHudQuarterPaintedRef.current = `${hudSeek.bar}|${hudSeek.measure}|${hudSeek.phrase}`;
      paintCreationHudQuarterIntoDom(
        creationHudDomRef.current,
        hudSeek,
        qpbR,
        { active: false },
        creationHudHoldRef,
        true,
      );
    }
    creationTransportUiPublishRef.current = { activeCol: Number.NaN, hudKey: '' };
    publishCreationTransportBeat();
    paintCreationSe2TransportReadouts(nb, false);
  }, [
    SE2_AUDIO_START_FLOOR_SEC,
    haltCreationPlaylineAtBeat,
    scrollCreationGridsToBeat,
    launchCreationPlaylineWapiNow,
    paintCreationSe2TransportReadouts,
  ]);

  /** Click timeline column (ruler / quant row / Ctrl+pad) ? move playhead to that step. */
  const seekTransportToPatternColumn = useCallback(
    (patternColCi: number) => {
      if (CREATION_BACKEND_BLANK) return;
      const s = Math.max(1, Math.min(DRUM_MAX_SUBDIV, Math.round(drumStepSubdivRef.current)));
      const off = creationDrumColOffsetSteps(loopOnRef.current, loopStartBeatRef.current, s);
      const pc = Math.max(1, patternColsDrumsRef.current);
      const ci = Math.max(0, Math.min(pc - 1, Math.floor(patternColCi)));
      const beat = (ci + off) / s;
      seekBeats(beat);
    },
    [seekBeats],
  );

  const setLoopRangeBeats = useCallback((startB: number, endB: number) => {
    const s = Math.max(0, Math.min(startB, endB));
    const e = Math.max(s + beatsPerBarRef.current, Math.max(startB, endB));
    setLoopStartBeat(s);
    setLoopEndBeat(e);
    setLoopBars(Math.max(1, Math.round((e - s) / beatsPerBarRef.current)));
  }, []);

  // Compatibility vars for existing UI components (Creation now uses local SE2-style loop).
  const loopEnabled = loopOn;
  const setLoopEnabled = setLoopOn;
  const loopStartBar = Math.floor(loopStartBeatRef.current / beatsPerBarRef.current) + 1;
  const loopEndBar = Math.floor(loopEndBeatRef.current / beatsPerBarRef.current);
  const loopSection: string | null = null;
  const setLoopRange = useCallback(
    (startBar: number, endBar: number) => {
      const s = Math.max(1, Math.round(startBar));
      const e = Math.max(s, Math.round(endBar));
      setLoopRangeBeats((s - 1) * beatsPerBarRef.current, e * beatsPerBarRef.current);
    },
    [setLoopRangeBeats],
  );

  const drumStepSubdivUi = Math.max(1, Math.min(DRUM_MAX_SUBDIV, Math.round(drumStepSubdiv)));

  /** Ruler segments: one header per DAW bar = `beatsPerBar` ? current step subdivision. */
  const creationDrumRulerCounts = useMemo(() => {
    const cols = patternColsDrums;
    const q = MEASURES_PER_BAR;
    const step = q * drumStepSubdivUi;
    const out: number[] = [];
    for (let o = 0; o < cols; o += step) {
      out.push(Math.min(step, cols - o));
    }
    return out;
  }, [patternColsDrums, drumStepSubdivUi]);
  const { notes: sharedNotes, addNote: addSharedNote, removeNote: removeSharedNote } = usePianoNotes();

  /** Land on Genius Home Studio layout (sounds rail + sequence) ? sub-tools live in the module sidebar. */
  const [tab, setTab]               = useState<'drums' | 'grid' | 'groove-lab' | 'piano' | 'chord' | 'chord-seq' | '808-lab'>('grid');
  tabRef.current = tab;

  /** Master transport UI only exists on Beat Lab ? pause if the user leaves while playing so audio is not stuck with no controls. */
  useEffect(() => {
    if (tab === 'grid') return;
    if (!runningRef.current) return;
    void pauseTransport();
  }, [tab, pauseTransport]);

  const [drumKitGenOpen, setDrumKitGenOpen] = useState(false);

  const goToCreationSub = useCallback(
    (sub: CreationSubScreenId) => {
      onCreationSubScreenChange?.(sub);
      setTab(creationSubScreenToTab(sub));
      if (sub === 'drum-kit-generator') setDrumKitGenOpen(true);
    },
    [onCreationSubScreenChange],
  );

  useEffect(() => {
    const nextTab = creationSubScreenToTab(creationSubScreen);
    setTab((prev) => (prev === nextTab ? prev : nextTab));
    if (creationSubScreen === 'drum-kit-generator') setDrumKitGenOpen(true);
  }, [creationSubScreen]);
  const [drumKitGenStyle, setDrumKitGenStyle] = useState<DrumKitGeneratorStyle>('house');
  const [drumKitGenBusy, setDrumKitGenBusy] = useState(false);
  const [bpmInput, setBpmInput]     = useState(String(bpm));
  const [kit, setKit]               = useState(KITS[0]);
  const [kitSelectValue, setKitSelectValue] = useState(`preset:${KITS[0]}`);
  const [savedKits, setSavedKits] = useState<BeatLabSavedKit[]>(() => loadBeatLabSavedKits());
  const [savedSongs, setSavedSongs] = useState<BeatLabSavedSong[]>(() => loadBeatLabSavedSongs());
  const [saveKitStatus, setSaveKitStatus] = useState<string | null>(null);
  const [saveSongStatus, setSaveSongStatus] = useState<string | null>(null);
  const [activeBank, setActiveBank] = useState(0);
  const [rollInstr, setRollInstr]   = useState(0);
  const [banks, setBanks]           = useState<Bank[]>(() => {
    try {
      const saved = localStorage.getItem('creationStation_banks');
      if (saved) {
        const parsed = JSON.parse(saved) as unknown;
        if (Array.isArray(parsed)) {
          return BANKS.map((_, i) => {
            const b = parsed[i] as { drums?: unknown; notes?: unknown } | undefined;
            if (!b) return { drums: emptyDrums(), notes: [], midiRoll: [] };
            return {
              drums: normalizeBankDrumPattern(b.drums),
              notes: Array.isArray(b.notes) ? (b.notes as PianoNote[]) : [],
              midiRoll: normalizeBeatLabMidiRoll((b as { midiRoll?: unknown }).midiRoll),
              volAutomation: Array.isArray((b as { volAutomation?: unknown }).volAutomation)
                ? ((b as { volAutomation: number[] }).volAutomation)
                : undefined,
              pitchAutomation: Array.isArray((b as { pitchAutomation?: unknown }).pitchAutomation)
                ? ((b as { pitchAutomation: number[] }).pitchAutomation)
                : undefined,
              melodicInstruments: normalizeBeatLabMelodicInstruments(
                (b as { melodicInstruments?: unknown }).melodicInstruments,
              ),
            };
          });
        }
      }
    } catch (e) {
      console.warn('Beat Lab: corrupt bank storage, resetting', e);
      clearBeatLabStorage();
    }
    return BANKS.map(() => ({
      drums: emptyDrums(),
      notes: [],
      midiRoll: [],
      volAutomation: undefined,
      pitchAutomation: undefined,
      melodicInstruments: normalizeBeatLabMelodicInstruments(undefined),
    }));
  });
  const [beatLabDeckFocus, setBeatLabDeckFocusState] = useState<BeatLabDeckFocus>('sequence');
  const setBeatLabDeckFocus = useCallback((focus: BeatLabDeckFocus) => {
    setBeatLabDeckFocusState(focus);
  }, []);
  useEffect(() => {
    setBeatLabDeckFocusState((f) => {
      const legacy = f as string;
      if (legacy === 'pads' || legacy === 'split') return 'roll';
      return f;
    });
  }, []);
  useEffect(() => {
    if (beatLabDeckFocus === 'synth') {
      setSelectedBeatLabLane((lane) =>
        lane != null && lane >= BEAT_LAB_MELODIC_LANE_START ? lane : BEAT_LAB_MELODIC_LANE_START,
      );
      return;
    }
    if (beatLabDeckFocus === 'sequence') {
      setSelectedBeatLabLane((lane) =>
        lane != null && lane >= BEAT_LAB_MELODIC_LANE_START ? null : lane,
      );
    }
  }, [beatLabDeckFocus]);

  useEffect(() => {
    if (beatLabDeckFocus !== 'synth' || CREATION_BACKEND_BLANK) return;
    resetBeatLabMelodicWarmupFlag();
    const ctx = getOrCreateAudioContext();
    void ctx.resume().then(() => {
      void warmupBeatLabMelodicSoundfont(ctx, melodicInstrumentsRef.current, true);
    });
  }, [beatLabDeckFocus, getOrCreateAudioContext]);

  const [beatLabGridZoomMode, setBeatLabGridZoomMode] = useState<BeatLabGridZoomMode>('min');
  const [beatLabTileGrid, setBeatLabTileGrid] = useState(() => loadBeatLabTileGridPref());
  const [beatLabGridLayoutMode, setBeatLabGridLayoutMode] = useState<BeatLabGridLayoutMode>('default');
  const [beatLabEditTool, setBeatLabEditTool] = useState<BeatLabEditTool>('pointer');
  const [beatLabRollSelection, setBeatLabRollSelection] = useState<{ lane: number; col: number } | null>(
    null,
  );
  const beatLabRollSelectionRef = useRef(beatLabRollSelection);
  beatLabRollSelectionRef.current = beatLabRollSelection;
  /** Last grid cell pointer-down (any tool) ? shortcuts work without PTR selection state. */
  const beatLabGridFocusRef = useRef<{ lane: number; col: number } | null>(null);
  beatLabDeckFocusRef.current = beatLabDeckFocus;
  const beatLabRollClipboardRef = useRef<BeatLabMidiNote[]>([]);
  const [beatLabTimeStretch, setBeatLabTimeStretch] = useState(false);
  const beatLabTimeStretchRef = useRef(false);
  const beatLabGridFullView =
    beatLabDeckFocus === 'sequence' && beatLabGridLayoutMode === 'full';
  const drumPaintRef = useRef<{
    active: boolean;
    on: boolean;
    lastKey: string;
    lastX: number;
    lastY: number;
  } | null>(null);
  const beatLabGridResizeRef = useRef<{
    lane: number;
    headCol: number;
    startX: number;
    startLen: number;
    previewLen: number;
  } | null>(null);
  const beatLabGridDragRef = useRef<{
    fromLane: number;
    fromCol: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const beatLabGridJustDraggedRef = useRef(false);
  const resizeBeatLabMidiRollNoteRef = useRef<
    (lane: number, col: number, len: number) => void
  >(() => {});
  const moveBeatLabMidiRollNoteRef = useRef<
    (fromLane: number, fromCol: number, toLane: number, toCol: number) => void
  >(() => {});
  const banksBootRef = useRef(banks);
  banksBootRef.current = banks;
  const [patternSlot, setPatternSlot] = useState<PatternSlot>('A');
  const [bankPatternSlots, setBankPatternSlots] = useState<
    Array<Record<PatternSlot, DrumPattern>>
  >(() => BANKS.map(() => ({ A: emptyDrums(), B: emptyDrums() })));
  const patternSlotsInitializedRef = useRef(false);
  const bankPatternSlotsRef = useRef<Array<Record<PatternSlot, DrumPattern>>>(
    bankPatternSlots,
  );
  bankPatternSlotsRef.current = bankPatternSlots;

  useEffect(() => {
    setBpmInput(String(Math.round(bpm)));
  }, [bpm]);

  useEffect(() => {
    try {
      localStorage.setItem(
        PIANO_SNAP_SUBDIV_STORAGE_KEY,
        String(normalizePianoSnapSubdiv(pianoSnapSubdiv)),
      );
    } catch {
      /* ignore */
    }
  }, [pianoSnapSubdiv]);

  useEffect(() => {
    saveBeatLabTileGridPref(beatLabTileGrid);
  }, [beatLabTileGrid]);

  useEffect(() => {
    if (!isScreenActive) return;
    setPianoSnapSubdiv(readPianoSnapSubdivFromStorage());
  }, [isScreenActive]);

  // Persist banks to localStorage
  useEffect(() => {
    localStorage.setItem('creationStation_banks', JSON.stringify(banks));
  }, [banks]);
  useEffect(() => {
    try {
      localStorage.setItem('creationStation_patternSlots', JSON.stringify(bankPatternSlots));
    } catch {
      /* ignore */
    }
  }, [bankPatternSlots]);
  useEffect(() => {
    if (patternSlotsInitializedRef.current) return;
    let loaded: Array<Record<PatternSlot, DrumPattern>> | null = null;
    try {
      const raw = localStorage.getItem('creationStation_patternSlots');
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          loaded = parsed.map((entry) => {
            const e = entry as Partial<Record<PatternSlot, unknown>>;
            return {
              A: normalizeBankDrumPattern(e.A),
              B: normalizeBankDrumPattern(e.B),
            };
          });
        }
      }
    } catch (e) {
      console.warn('Beat Lab: corrupt pattern-slot storage, resetting slots', e);
      try {
        localStorage.removeItem('creationStation_patternSlots');
      } catch {
        /* ignore */
      }
    }
    const boot = banksBootRef.current;
    const nextSlots = BANKS.map((_, i) => ({
      A: loaded?.[i]?.A ?? normalizeBankDrumPattern(boot[i]?.drums),
      B: loaded?.[i]?.B ?? emptyDrums(),
    }));
    bankPatternSlotsRef.current = nextSlots;
    setBankPatternSlots(nextSlots);
    patternSlotsInitializedRef.current = true;
  }, []);

  const syncActiveBankDrumsFromSlot = useCallback(
    (slot: PatternSlot = patternSlot) => {
      const slotDrums = normalizeBankDrumPattern(
        bankPatternSlotsRef.current[activeBank]?.[slot],
      );
      setBanks((prev) =>
        prev.map((b, i) =>
          i === activeBank ? { ...b, drums: slotDrums.map((r) => r.slice()) } : b,
        ),
      );
    },
    [activeBank, patternSlot],
  );

  useEffect(() => {
    if (!patternSlotsInitializedRef.current) return;
    syncActiveBankDrumsFromSlot(patternSlot);
  }, [activeBank, patternSlot, syncActiveBankDrumsFromSlot]);

  const [pressedPianoKeyRow, setPressedPianoKeyRow] = useState<number | null>(null);
  const [selectedBeatLabLane, setSelectedBeatLabLane] = useState<number | null>(null);

  useEffect(() => {
    const lane = beatLabRollSelection?.lane;
    if (lane != null && lane >= 0 && lane < BEAT_LAB_MIDI_LANES) {
      setSelectedBeatLabLane(lane);
    }
  }, [beatLabRollSelection]);

  const selectedDrumPad =
    selectedBeatLabLane != null && selectedBeatLabLane < BEAT_LAB_PAD_LANES
      ? selectedBeatLabLane
      : null;
  const selectedBeatLabLaneRef = useRef<number | null>(selectedBeatLabLane);
  selectedBeatLabLaneRef.current = selectedBeatLabLane;
  const [mutedPads, setMutedPads] = useState<boolean[]>(() => Array(16).fill(false));
  const mutedPadsRef = useRef<boolean[]>(Array(16).fill(false));
  mutedPadsRef.current = mutedPads;
  /** MPC-style: per-bank pad samples (key `${bank}_${pad}`) ? presence drives UI; buffers in ref for playback. */
  const [padSamplePresence, setPadSamplePresence] = useState<Record<string, boolean>>({});
  /** Optional source BPM per sample key (pad SRC-BPM UI + preview; not tied to main tempo slider). */
  const [padSampleRootBpms, setPadSampleRootBpms] = useState<Record<string, number>>({});
  const padSampleRootBpmRef = useRef<Record<string, number>>({});
  /** Display name per pad sample key ? mirrors `StoredPadSample.label` (sampler + sequencer lane). */
  const [padSampleLabels, setPadSampleLabels] = useState<Record<string, string>>({});
  const [geniusSamplerTargetPad, setGeniusSamplerTargetPad] = useState(14);

  /** Keep Sound Families target aligned with the highlighted drum pad (snare, kick, etc.). */
  useEffect(() => {
    if (selectedDrumPad != null) setGeniusSamplerTargetPad(selectedDrumPad);
  }, [selectedDrumPad]);

  const padSampleBuffersRef = useRef<Map<string, AudioBuffer>>(new Map());
  /** HPF/LPF/trim/fine-tune per `${bank}_${pad}` ? mirrors optional fields on `StoredPadSample`. */
  const padSamplePlaybackOptsRef = useRef<Record<string, PadSamplerPlaybackOpts>>({});
  const padSampleFxRackRef = useRef<Record<string, PadSamplerFxRack>>({});
  const playPadSoundRef = useRef<
    (
      pi: number,
      vel: number,
      when?: number,
      notePitchSemi?: number,
      opts?: { tempoSyncRate?: number },
    ) => void
  >(() => {});
  const activeBankRef = useRef(activeBank);
  const channelVolumesRef = useRef(channelVolumes);
  const pendingPadSampleRef = useRef<number | null>(null);
  const padSampleFileInputRef = useRef<HTMLInputElement | null>(null);
  const padSampleFolderInputRef = useRef<HTMLInputElement | null>(null);
  /** `true` = next folder pick loads Bank B with cleaned labels. */
  const folderImportBrassRoomRef = useRef(false);
  const trapKitFolderInputRef = useRef<HTMLInputElement | null>(null);
  const [trapKitBrowserOpen, setTrapKitBrowserOpen] = useState(false);
  const [trapKitBrowserFiles, setTrapKitBrowserFiles] = useState<File[]>([]);
  const [brassRoomLoading, setBrassRoomLoading] = useState(false);
  const [kitImportHint, setKitImportHint] = useState<string | null>(null);
  const kitImportHintTimerRef = useRef<number | null>(null);
  const [producerKitId, setProducerKitId] = useState<BeatLabProducerKitId>('brassTrap');
  const [producerKitLoading, setProducerKitLoading] = useState(false);

  useEffect(() => {
    beatLabTimeStretchRef.current = beatLabTimeStretch;
  }, [beatLabTimeStretch]);

  useEffect(() => { activeBankRef.current = activeBank; }, [activeBank]);
  useEffect(() => { channelVolumesRef.current = channelVolumes; }, [channelVolumes]);
  useEffect(() => {
    padSampleRootBpmRef.current = padSampleRootBpms;
  }, [padSampleRootBpms]);

  // Load persisted pad samples (decode once into AudioBuffers).
  useEffect(() => {
    let cancelled = false;
    const store = loadPadSampleStore();
    const keys = Object.keys(store);
    if (keys.length === 0) return;
    const ctx = getOrCreateAudioContext();
    void (async () => {
      const nextPresence: Record<string, boolean> = {};
      const nextRoots: Record<string, number> = {};
      const nextLabels: Record<string, string> = {};
      for (const k of keys) {
        if (cancelled) return;
        try {
          const st = store[k];
          const ab = storedToArrayBuffer(st);
          const buf = await ctx.decodeAudioData(ab.slice(0));
          if (cancelled) return;
          padSampleBuffersRef.current.set(k, buf);
          padSamplePlaybackOptsRef.current[k] = samplerOptsFromStored(st);
          padSampleFxRackRef.current[k] = fxRackFromStored(st);
          nextPresence[k] = true;
          const rb = st.rootBpm;
          if (typeof rb === 'number' && rb > 0) nextRoots[k] = rb;
          const lb = typeof st.label === 'string' ? st.label.trim() : '';
          if (lb) nextLabels[k] = lb;
        } catch {
          /* skip corrupt entry */
        }
      }
      if (!cancelled) {
        setPadSamplePresence((prev) => ({ ...prev, ...nextPresence }));
        setPadSampleRootBpms((prev) => ({ ...prev, ...nextRoots }));
        setPadSampleLabels((prev) => ({ ...prev, ...nextLabels }));
      }
    })();
    return () => { cancelled = true; };
  }, [getOrCreateAudioContext]);

  // Pad hit + sequencer use this (refs keep scheduler callback stable).
  useEffect(() => {
    const MIN_TRIGGER = 0.02;
    const MIN_AUDIBLE_VELOCITY = 0.12;
    playPadSoundRef.current = (
      pi: number,
      vel: number,
      when?: number,
      notePitchSemi = 0,
      playOpts?: { tempoSyncRate?: number },
    ) => {
      const ctx = getOrCreateAudioContext();
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => {});
      }
      const t = Math.max(when ?? ctx.currentTime, ctx.currentTime + 0.001);
      const rawVelocity = Math.max(0, Math.min(1, vel / 127));
      if (rawVelocity <= MIN_TRIGGER) return;
      const shapedVelocity = Math.pow(rawVelocity, 0.7);
      const safeVelocity = Math.round(
        Math.max(MIN_AUDIBLE_VELOCITY, Math.min(1, shapedVelocity)) * 127,
      );
      const key = `${activeBankRef.current}_${pi}`;
      const buf = padSampleBuffersRef.current.get(key);
      if (buf) {
        /**
         * Session BPM only moves the grid/metronome — not sample speed/pitch.
         * Pad pitch = fine-tune / roll automation (`fineSemi`). Optional `tempoSyncRate`
         * is for SRC-BPM pad preview only (time-stretch keeps pitch stable).
         */
        const rate =
          typeof playOpts?.tempoSyncRate === 'number' && playOpts.tempoSyncRate > 0
            ? Math.min(4, Math.max(0.25, playOpts.tempoSyncRate))
            : 1;
        const useTimeStretch = rate !== 1 || beatLabTimeStretchRef.current;
        let bag = padSampleActiveStoppersRef.current.get(key);
        if (!bag) {
          bag = new Set();
          padSampleActiveStoppersRef.current.set(key, bag);
        }
        let voiceStop: () => void;
        const afterVoice = () => {
          bag!.delete(voiceStop);
          if (bag!.size === 0) padSampleActiveStoppersRef.current.delete(key);
        };
        const sampOpts =
          padSamplePlaybackOptsRef.current[key] ?? defaultPadSamplerPlaybackOpts();
        const optsWithPitch = {
          ...sampOpts,
          fineSemi: Math.max(-12, Math.min(12, (sampOpts.fineSemi ?? 0) + notePitchSemi)),
        };
        const fxRack = padSampleFxRackRef.current[key] ?? defaultPadSamplerFxRack();
        voiceStop = playPadSampleBuffer(
          ctx,
          buf,
          creationPadMixerCh(pi),
          safeVelocity,
          t,
          channelVolumesRef.current,
          rate,
          afterVoice,
          optsWithPitch,
          useTimeStretch,
          fxRack,
          Math.max(1, bpmRef.current),
        );
        bag.add(voiceStop);
      } else {
        triggerChannel(creationPadMixerCh(pi), safeVelocity, t);
      }
    };
  }, [triggerChannel, getOrCreateAudioContext]);

  // Shared DAW session: manifest + per-channel sequencer data ? Studio tracks/clips (audioTrack === mixer CH).
  useEffect(() => {
    const meta = computeUsedCreationChannelMeta(banks, CREATION_PAD_CHANNELS_FIXED, false);
    writeCreationChannelManifestToStorage(meta);
    const maxCols = patternColsDrums;
    const payload = {
      bpm,
      drumLoopBars: loopBars,
      measuresPerBar: qpb,
      drumStepSubdiv,
      padChannels: CREATION_PAD_CHANNELS_FIXED,
      activeBank,
      subOn: false,
      drums: (banks[activeBank]?.drums ?? []).map((row) => row.slice(0, maxCols)),
    };
    try {
      localStorage.setItem(CREATION_STATION_CLIP_DATA_KEY, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(DA_SESSION_TRACKS_SYNC_EVENT));
  }, [banks, bpm, loopBars, activeBank, qpb, drumStepSubdiv, patternColsDrums, CREATION_BACKEND_BLANK]);

  // Re-sync Studio [CS] clips when pad samples load/clear (payload unchanged; Studio reads pad sample store).
  useEffect(() => {
    window.dispatchEvent(new Event(DA_SESSION_TRACKS_SYNC_EVENT));
  }, [padSamplePresence]);

  const drumScrollRef  = useRef<HTMLDivElement>(null);
  const pianoScrollRef = useRef<HTMLDivElement>(null);
  /** Beat Lab: keep lane labels ? pattern rows scrolled together. */
  const geniusLaneScrollRef = useRef<HTMLDivElement>(null);
  const geniusLaneGridScrollSync = useRef<'lane' | 'grid' | null>(null);

  const onGeniusPatternScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const lane = geniusLaneScrollRef.current;
    if (!lane || geniusLaneGridScrollSync.current === 'lane') return;
    geniusLaneGridScrollSync.current = 'grid';
    lane.scrollTop = e.currentTarget.scrollTop;
    const roll = beatLabRollScrollRef.current;
    if (roll && beatLabRollScrollSync.current !== 'roll') {
      beatLabRollScrollSync.current = 'drum';
      roll.scrollLeft = e.currentTarget.scrollLeft;
      queueMicrotask(() => {
        beatLabRollScrollSync.current = null;
      });
    }
    queueMicrotask(() => {
      geniusLaneGridScrollSync.current = null;
    });
  }, []);

  const onBeatLabRollScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const grid = drumScrollRef.current;
    if (!grid || beatLabRollScrollSync.current === 'drum') return;
    beatLabRollScrollSync.current = 'roll';
    grid.scrollLeft = e.currentTarget.scrollLeft;
    queueMicrotask(() => {
      beatLabRollScrollSync.current = null;
    });
  }, []);

  const onGeniusLaneRailScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const grid = drumScrollRef.current;
    if (!grid || geniusLaneGridScrollSync.current === 'grid') return;
    geniusLaneGridScrollSync.current = 'lane';
    grid.scrollTop = e.currentTarget.scrollTop;
    queueMicrotask(() => {
      geniusLaneGridScrollSync.current = null;
    });
  }, []);

  const isPlaybackOrRecord = transport === 'playing' || transport === 'recording';
  const isRecording = transport === 'recording';
  const isCounting = false;
  const isPaused = transport === 'paused';
  const transportNeedsPause = isPlaybackOrRecord || isCounting;
  const isPlaying = isPlaybackOrRecord;
  const transportNotStopped = transport !== 'stopped';
  isPlaybackOrRecordRef.current = isPlaybackOrRecord;
  transportNotStoppedRef.current = transportNotStopped;

  /** When not playing, keep SE2 Bars/Time in sync with scrub / BPM (rAF pump only runs while `runningRef`). */
  useEffect(() => {
    if (tab !== 'grid') return;
    if (isPlaybackOrRecord) return;
    paintCreationSe2TransportReadouts(Math.max(0, displayBeatRef.current), transport === 'paused');
  }, [tab, transport, isPlaybackOrRecord, bpm, paintCreationSe2TransportReadouts]);

  /** Ruler highlight: updates only when isolated HUD changes measure (avoids 60fps full-screen repaints). */
  const _creationRulerPulse = useSyncExternalStore(
    subscribeCreationRulerBeat,
    getCreationRulerSeq,
    () => 0,
  );
  void _creationRulerPulse;

  const transportBeatEpoch = useSyncExternalStore(
    subscribeCreationTransportBeat,
    getCreationTransportBeatEpoch,
    () => 0,
  );
  /** `displayBeatRef` is advanced every rAF; React re-reads it when `transportBeatEpoch` bumps (see `creationTransportBeatExternal.ts`). */
  const displayBeatLive = displayBeatRef.current;
  void transportBeatEpoch;

  /** Same subdiv the audio scheduler + playline use (`drumStepSubdivRef`) ? avoids one-frame HUD/grid mismatch after snap changes. */
  const subdivHud = Math.max(1, Math.min(DRUM_MAX_SUBDIV, Math.round(drumStepSubdivRef.current)));
  const transportStepIndexLive = Math.floor(Math.max(0, displayBeatLive * subdivHud) + 1e-8);

  /**
   * Quarter index of **loopStartTick** ? matches `floor(tick / PPQ)`; avoids
   * `(loopStartBar - 1) * round(qpb)` when `ticksPerBar` and PPQ don?t line up with rounded quarters.
   */
  const drumColOffset = Math.floor(
    Math.max(0, loopOnRef.current ? loopStartBeatRef.current * subdivHud : 0) + 1e-8,
  );
  const drumColOffsetRef = useRef(drumColOffset);
  drumColOffsetRef.current = drumColOffset;

  /** 4/4 Beat Lab: one bar = four quarter-note measures (grid lines + MEASURES row). */
  const beatLabQpb = MEASURES_PER_BAR;

  const creationDrumRulerHeaderLabels = useMemo(() => {
    const labels: number[] = [];
    const colsPerBar = Math.max(1, beatLabQpb * subdivHud);
    const base = Math.floor(drumColOffset / colsPerBar);
    let acc = 0;
    for (let i = 0; i < creationDrumRulerCounts.length; i++) {
      labels.push(
        loopStartBar +
          Math.floor((drumColOffset + acc) / colsPerBar) -
          base,
      );
      acc += creationDrumRulerCounts[i]!;
    }
    return labels;
  }, [creationDrumRulerCounts, drumColOffset, loopStartBar, subdivHud]);

  const drumPatternColToDawBar = useCallback(
    (ci: number) =>
      loopStartBar +
      Math.floor((drumColOffset + ci) / Math.max(1, beatLabQpb * subdivHud)) -
      Math.floor(drumColOffset / Math.max(1, beatLabQpb * subdivHud)),
    [loopStartBar, drumColOffset, subdivHud],
  );

  /** Pattern column index ? shared helper with playline / scheduler / transport rAF. */
  const visualSyncCol = creationPatternColFromDisplayBeat(
    displayBeatLive,
    subdivHud,
    patternColsDrums,
    loopOnRef.current,
    loopStartBeatRef.current,
    loopEndBeatRef.current,
    patternPlayModeRef.current,
  );
  // Single source of truth for visible transport column (grid + HUD stay linked).
  let activeCol = -1;
  if (transportNotStopped) activeCol = visualSyncCol;

  const qpbHud = Math.max(2, Math.min(16, Math.round(qpb)));

  useEffect(() => {
    if (!transportNotStopped) {
      publishCreationRulerBeat(null);
    }
  }, [transportNotStopped]);

  const currentDrums = banks[activeBank]?.drums ?? emptyDrums();
  const currentMidiRoll = banks[activeBank]?.midiRoll ?? [];
  const currentMelodicInstruments = useMemo(
    () =>
      banks[activeBank]?.melodicInstruments ??
      normalizeBeatLabMelodicInstruments(undefined),
    [activeBank, banks],
  );
  const melodicInstrumentsRef = useRef(currentMelodicInstruments);
  melodicInstrumentsRef.current = currentMelodicInstruments;

  const patchMelodicInstrument = useCallback((slotIndex: number, instrumentId: string) => {
    setBanks((prev) =>
      prev.map((b, i) => {
        if (i !== activeBank) return b;
        const next = normalizeBeatLabMelodicInstruments(b.melodicInstruments);
        next[slotIndex] = instrumentId;
        return { ...b, melodicInstruments: next };
      }),
    );
  }, [activeBank]);
  const currentMidiRollRef = useRef(currentMidiRoll);
  currentMidiRollRef.current = currentMidiRoll;

  const currentVolAutomation = useMemo(
    () => normalizeBeatLabVolAutomation(banks[activeBank]?.volAutomation, patternColsDrums),
    [banks, activeBank, patternColsDrums],
  );
  const currentVolAutomationRef = useRef(currentVolAutomation);
  currentVolAutomationRef.current = currentVolAutomation;

  const currentPitchAutomation = useMemo(
    () => normalizeBeatLabPitchAutomation(banks[activeBank]?.pitchAutomation, patternColsDrums),
    [banks, activeBank, patternColsDrums],
  );
  const currentPitchAutomationRef = useRef(currentPitchAutomation);
  currentPitchAutomationRef.current = currentPitchAutomation;

  const patchVolAutomation = useCallback(
    (next: number[]) => {
      setBanks((prev) =>
        prev.map((b, i) => (i === activeBank ? { ...b, volAutomation: next } : b)),
      );
    },
    [activeBank],
  );

  const patchPitchAutomation = useCallback(
    (next: number[]) => {
      setBanks((prev) =>
        prev.map((b, i) => (i === activeBank ? { ...b, pitchAutomation: next } : b)),
      );
    },
    [activeBank],
  );

  const pitchAutomationClipboardRef = useRef<number[] | null>(null);
  const pitchAutomationSelectionRef = useRef<BeatLabPitchAutomationSelection | null>(null);

  const banksRef = useRef(banks);
  banksRef.current = banks;
  const beatLabUndoStackRef = useRef<Bank[][]>([]);
  const beatLabRedoStackRef = useRef<Bank[][]>([]);
  const beatLabUndoGestureRef = useRef(false);
  const [beatLabHistoryRev, setBeatLabHistoryRev] = useState(0);
  /** Loop DUP undo — restores pattern + loop length (grid undo alone cannot revert DUP). */
  const beatLabDupUndoStackRef = useRef<BeatLabHistorySnapshot<Bank>[]>([]);
  const [beatLabDupUndoRev, setBeatLabDupUndoRev] = useState(0);

  const captureCurrentBeatLabSnapshot = useCallback((): BeatLabHistorySnapshot<Bank> => {
    return captureBeatLabHistorySnapshot({
      banks: banksRef.current,
      bankPatternSlots: bankPatternSlotsRef.current,
      loopBars: loopBarsRef.current,
      loopStartBeat: loopStartBeatRef.current,
      loopEndBeat: loopEndBeatRef.current,
      loopOn: loopOnRef.current,
    });
  }, []);

  const pushBeatLabUndo = useCallback(() => {
    beatLabUndoStackRef.current = [
      ...beatLabUndoStackRef.current.slice(-(BEAT_LAB_UNDO_STACK_MAX - 1)),
      cloneBeatLabBanks(banksRef.current),
    ];
    beatLabRedoStackRef.current = [];
    setBeatLabHistoryRev((n) => n + 1);
  }, []);

  const beginBeatLabUndoGesture = useCallback(() => {
    if (!beatLabUndoGestureRef.current) {
      pushBeatLabUndo();
      beatLabUndoGestureRef.current = true;
    }
  }, [pushBeatLabUndo]);

  const endBeatLabUndoGesture = useCallback(() => {
    beatLabUndoGestureRef.current = false;
  }, []);

  const beatLabPitchColsPerBar = Math.max(1, beatLabQpb * subdivHud);

  const copyPitchAutomation = useCallback(() => {
    const vals = currentPitchAutomationRef.current;
    const sel = pitchAutomationSelectionRef.current;
    if (sel) {
      pitchAutomationClipboardRef.current = beatLabCopyAutomationSegment(
        vals,
        sel.fineLo,
        sel.fineHi,
      );
      return;
    }
    const col = Math.max(0, activeCol >= 0 ? activeCol : 0);
    const fineStart = beatLabBarFineStart(col, beatLabPitchColsPerBar);
    const fineLen = beatLabFineColsPerBar(beatLabPitchColsPerBar);
    pitchAutomationClipboardRef.current = beatLabCopyAutomationSegment(
      vals,
      fineStart,
      fineStart + fineLen - 1,
    );
  }, [activeCol, beatLabPitchColsPerBar]);

  const pastePitchAutomation = useCallback(() => {
    const clip = pitchAutomationClipboardRef.current;
    if (!clip?.length) return;
    pushBeatLabUndo();
    const col = Math.max(0, activeCol >= 0 ? activeCol : 0);
    const fineDest = beatLabBarFineStart(col, beatLabPitchColsPerBar);
    const next = beatLabPasteAutomationSegment(
      currentPitchAutomationRef.current,
      clip,
      fineDest,
    );
    patchPitchAutomation(next);
  }, [activeCol, beatLabPitchColsPerBar, patchPitchAutomation, pushBeatLabUndo]);

  const beatLabUndo = useCallback(() => {
    const stack = beatLabUndoStackRef.current;
    if (!stack.length) return;
    const snap = stack[stack.length - 1]!;
    beatLabRedoStackRef.current = [
      ...beatLabRedoStackRef.current.slice(-(BEAT_LAB_UNDO_STACK_MAX - 1)),
      cloneBeatLabBanks(banksRef.current),
    ];
    beatLabUndoStackRef.current = stack.slice(0, -1);
    setBanks(cloneBeatLabBanks(snap));
    setBeatLabHistoryRev((n) => n + 1);
  }, []);

  const beatLabRedo = useCallback(() => {
    const stack = beatLabRedoStackRef.current;
    if (!stack.length) return;
    const snap = stack[stack.length - 1]!;
    beatLabUndoStackRef.current = [
      ...beatLabUndoStackRef.current.slice(-(BEAT_LAB_UNDO_STACK_MAX - 1)),
      cloneBeatLabBanks(banksRef.current),
    ];
    beatLabRedoStackRef.current = stack.slice(0, -1);
    setBanks(cloneBeatLabBanks(snap));
    setBeatLabHistoryRev((n) => n + 1);
  }, []);

  const canBeatLabUndo = useMemo(() => {
    void beatLabHistoryRev;
    return beatLabUndoStackRef.current.length > 0;
  }, [beatLabHistoryRev]);

  const canBeatLabRedo = useMemo(() => {
    void beatLabHistoryRev;
    return beatLabRedoStackRef.current.length > 0;
  }, [beatLabHistoryRev]);

  useEffect(() => {
    beatLabUndoStackRef.current = [];
    beatLabRedoStackRef.current = [];
    setBeatLabHistoryRev((n) => n + 1);
  }, [patternColsDrums]);

  const resetBeatLabVolAutomation = useCallback(() => {
    pushBeatLabUndo();
    const next = normalizeBeatLabVolAutomation(undefined, patternColsDrums);
    setBanks((prev) =>
      prev.map((b, i) => (i === activeBank ? { ...b, volAutomation: next } : b)),
    );
  }, [activeBank, patternColsDrums, pushBeatLabUndo]);

  const resetBeatLabPitchAutomation = useCallback(() => {
    pushBeatLabUndo();
    const next = normalizeBeatLabPitchAutomation(undefined, patternColsDrums);
    setBanks((prev) =>
      prev.map((b, i) => (i === activeBank ? { ...b, pitchAutomation: next } : b)),
    );
  }, [activeBank, patternColsDrums, pushBeatLabUndo]);

  const patchActiveBankMidiRoll = useCallback((next: BeatLabMidiNote[]) => {
    const roll = normalizeBeatLabMidiRoll(next);
    setBanks((prev) =>
      prev.map((b, i) => (i === activeBank ? { ...b, midiRoll: roll } : b)),
    );
  }, [activeBank]);

  const patchActiveBankMidiRollWithUndo = useCallback(
    (next: BeatLabMidiNote[]) => {
      pushBeatLabUndo();
      patchActiveBankMidiRoll(next);
    },
    [patchActiveBankMidiRoll, pushBeatLabUndo],
  );

  const toggleBeatLabMidiRollNote = useCallback(
    (lane: number, col: number) => {
      if (CREATION_BACKEND_BLANK) return;
      const existing = currentMidiRoll.find((n) => n.lane === lane && n.col === col);
      if (existing) {
        patchActiveBankMidiRollWithUndo(
          currentMidiRoll.filter((n) => !(n.lane === lane && n.col === col)),
        );
        return;
      }
      patchActiveBankMidiRollWithUndo([
        ...currentMidiRoll,
        { lane, col, len: 1, vel: PAD_VEL[lane] ?? 100 },
      ]);
    },
    [currentMidiRoll, patchActiveBankMidiRollWithUndo],
  );

  const setBeatLabMidiRollStep = useCallback(
    (lane: number, col: number, on: boolean) => {
      if (CREATION_BACKEND_BLANK) return;
      const existing = currentMidiRoll.find((n) => n.lane === lane && n.col === col);
      if (on) {
        if (!existing) {
          patchActiveBankMidiRoll([
            ...currentMidiRoll,
            { lane, col, len: 1, vel: PAD_VEL[lane] ?? 100 },
          ]);
        }
        return;
      }
      if (existing) {
        patchActiveBankMidiRoll(currentMidiRoll.filter((n) => !(n.lane === lane && n.col === col)));
      }
    },
    [currentMidiRoll, patchActiveBankMidiRoll],
  );

  const toggleBeatLabMelodicSynthNote = useCallback(
    (lane: number, col: number, midi: number) => {
      if (CREATION_BACKEND_BLANK) return;
      const semi = beatLabPitchSemiForMidi(lane, midi);
      const existing = currentMidiRoll.find(
        (n) => n.lane === lane && n.col === col && (n.pitchSemi ?? 0) === semi,
      );
      if (existing) {
        patchActiveBankMidiRollWithUndo(
          currentMidiRoll.filter(
            (n) => !(n.lane === lane && n.col === col && (n.pitchSemi ?? 0) === semi),
          ),
        );
        return;
      }
      patchActiveBankMidiRollWithUndo([
        ...currentMidiRoll,
        { lane, col, len: 1, vel: 100, pitchSemi: semi },
      ]);
    },
    [currentMidiRoll, patchActiveBankMidiRollWithUndo],
  );

  const setBeatLabMelodicSynthNote = useCallback(
    (lane: number, col: number, midi: number, on: boolean) => {
      if (CREATION_BACKEND_BLANK) return;
      const semi = beatLabPitchSemiForMidi(lane, midi);
      const existing = currentMidiRoll.find(
        (n) => n.lane === lane && n.col === col && (n.pitchSemi ?? 0) === semi,
      );
      if (on) {
        if (!existing) {
          patchActiveBankMidiRoll([
            ...currentMidiRoll,
            { lane, col, len: 1, vel: 100, pitchSemi: semi },
          ]);
        }
        return;
      }
      if (existing) {
        patchActiveBankMidiRoll(
          currentMidiRoll.filter(
            (n) => !(n.lane === lane && n.col === col && (n.pitchSemi ?? 0) === semi),
          ),
        );
      }
    },
    [currentMidiRoll, patchActiveBankMidiRoll],
  );

  const previewBeatLabMelodicMidi = useCallback((lane: number, midi: number) => {
    if (CREATION_BACKEND_BLANK) return;
    setSelectedBeatLabLane(lane);
    const ctx = getOrCreateAudioContext();
    void ctx.resume().then(() => {
      const slot = beatLabMelodicSlotIndex(lane);
      const instId =
        melodicInstrumentsRef.current[slot] ?? BEAT_LAB_MELODIC_DEFAULT_INSTRUMENTS[slot]!;
      const when = ctx.currentTime + 0.01;
      previewBeatLabMelodicNote(ctx, {
        lane,
        midi,
        velocity: 100,
        when,
        instrumentId: instId,
        channelVolumes: channelVolumesRef.current,
        durationSec: 0.45,
      });
    });
  }, [getOrCreateAudioContext]);

  const applyDrumSpanForPadNote = useCallback(
    (
      drums: DrumPattern,
      pad: number,
      patternCol: number,
      len: number,
      on: boolean,
    ): DrumPattern =>
      drums.map((row, r) => {
        if (r !== pad) return row;
        return row.map((v, c) => {
          const pc = c - drumColOffset;
          if (pc >= patternCol && pc < patternCol + len) return on;
          return v;
        });
      }),
    [drumColOffset],
  );

  const beatLabNoteFromDrumSpan = useCallback(
    (lane: number, patternCol: number, drums: DrumPattern, off: number): BeatLabMidiNote | null => {
      if (lane >= BEAT_LAB_PAD_LANES || !drums[lane]?.[patternCol + off]) return null;
      let headCol = patternCol;
      while (headCol > 0 && drums[lane]![headCol - 1 + off]) headCol -= 1;
      let len = 1;
      while (headCol + len < patternColsDrums && drums[lane]![headCol + len + off]) len += 1;
      return { lane, col: headCol, len, vel: PAD_VEL[lane] ?? 100 };
    },
    [patternColsDrums],
  );

  const beatLabNoteHeadAt = useCallback(
    (lane: number, patternCol: number): BeatLabMidiNote | null => {
      const rollHead = currentMidiRoll.find(
        (n) => n.lane === lane && patternCol >= n.col && patternCol < n.col + n.len,
      );
      if (rollHead) return rollHead;
      return beatLabNoteFromDrumSpan(lane, patternCol, currentDrums, drumColOffset);
    },
    [beatLabNoteFromDrumSpan, currentDrums, currentMidiRoll, drumColOffset],
  );

  /** Always reads latest bank pattern (keyboard handler must not use a stale render). */
  const beatLabNoteHeadAtLive = useCallback((lane: number, patternCol: number): BeatLabMidiNote | null => {
    const roll = currentMidiRollRef.current;
    const drums = currentDrumsRef.current;
    const off = drumColOffsetRef.current;
    const rollHead = roll.find(
      (n) => n.lane === lane && patternCol >= n.col && patternCol < n.col + n.len,
    );
    if (rollHead) return rollHead;
    return beatLabNoteFromDrumSpan(lane, patternCol, drums, off);
  }, [beatLabNoteFromDrumSpan]);

  const moveBeatLabMidiRollNote = useCallback(
    (fromLane: number, fromCol: number, toLane: number, toCol: number) => {
      if (CREATION_BACKEND_BLANK) return;
      pushBeatLabUndo();
      let moved = false;
      setBanks((prev) => {
        const bank = prev[activeBank];
        if (!bank) return prev;
        const roll = bank.midiRoll ?? [];
        const drums = normalizeBankDrumPattern(bank.drums);
        let note = roll.find((n) => n.lane === fromLane && n.col === fromCol);
        if (!note && fromLane < BEAT_LAB_PAD_LANES && drums[fromLane]?.[fromCol + drumColOffset]) {
          note = { lane: fromLane, col: fromCol, len: 1, vel: PAD_VEL[fromLane] ?? 100 };
        }
        if (!note) return prev;
        const len = clampBeatLabNoteLen(note.len, toCol, patternColsDrums);
        if (
          beatLabRollNotesOverlap(roll, toLane, toCol, len, {
            lane: fromLane,
            col: fromCol,
          })
        ) {
          return prev;
        }
        moved = true;
        const nextRoll = [
          ...roll.filter((n) => !(n.lane === fromLane && n.col === fromCol)),
          { ...note, lane: toLane, col: toCol, len },
        ];
        let nextDrums = drums;
        if (fromLane < BEAT_LAB_PAD_LANES) {
          nextDrums = applyDrumSpanForPadNote(nextDrums, fromLane, fromCol, note.len, false);
          nextDrums = applyDrumSpanForPadNote(nextDrums, toLane, toCol, len, true);
        }
        return prev.map((b, i) =>
          i === activeBank ? { ...b, midiRoll: nextRoll, drums: nextDrums } : b,
        );
      });
      if (moved) setBeatLabRollSelection({ lane: toLane, col: toCol });
    },
    [activeBank, applyDrumSpanForPadNote, drumColOffset, patternColsDrums, pushBeatLabUndo],
  );

  const insertBeatLabMidiNoteAt = useCallback(
    (note: BeatLabMidiNote, toLane: number, toCol: number) => {
      if (CREATION_BACKEND_BLANK) return false;
      pushBeatLabUndo();
      let inserted = false;
      setBanks((prev) => {
        const bank = prev[activeBank];
        if (!bank) return prev;
        const roll = bank.midiRoll ?? [];
        const len = clampBeatLabNoteLen(note.len, toCol, patternColsDrums);
        if (beatLabRollNotesOverlap(roll, toLane, toCol, len)) return prev;
        inserted = true;
        const nextRoll = [
          ...roll,
          {
            lane: toLane,
            col: toCol,
            len,
            vel: note.vel,
            ...(note.muted ? { muted: true } : {}),
          },
        ];
        let nextDrums = normalizeBankDrumPattern(bank.drums);
        if (toLane < BEAT_LAB_PAD_LANES) {
          nextDrums = applyDrumSpanForPadNote(nextDrums, toLane, toCol, len, true);
        }
        return prev.map((b, i) =>
          i === activeBank ? { ...b, midiRoll: nextRoll, drums: nextDrums } : b,
        );
      });
      if (inserted) setBeatLabRollSelection({ lane: toLane, col: toCol });
      return inserted;
    },
    [activeBank, applyDrumSpanForPadNote, patternColsDrums, pushBeatLabUndo],
  );

  const deleteBeatLabMidiRollNote = useCallback(
    (lane: number, col: number) => {
      if (CREATION_BACKEND_BLANK) return;
      pushBeatLabUndo();
      setBanks((prev) => {
        const bank = prev[activeBank];
        if (!bank) return prev;
        const roll = bank.midiRoll ?? [];
        const note = roll.find((n) => n.lane === lane && n.col === col);
        const len = note?.len ?? 1;
        const nextRoll = roll.filter((n) => !(n.lane === lane && n.col === col));
        const hadDrum =
          lane < BEAT_LAB_PAD_LANES && bank.drums[lane]?.[col + drumColOffset];
        if (nextRoll.length === roll.length && !hadDrum) return prev;
        let nextDrums = normalizeBankDrumPattern(bank.drums);
        if (lane < BEAT_LAB_PAD_LANES) {
          nextDrums = applyDrumSpanForPadNote(nextDrums, lane, col, len, false);
        }
        return prev.map((b, i) =>
          i === activeBank ? { ...b, midiRoll: nextRoll, drums: nextDrums } : b,
        );
      });
      setBeatLabRollSelection((sel) =>
        sel && sel.lane === lane && sel.col === col ? null : sel,
      );
    },
    [activeBank, applyDrumSpanForPadNote, drumColOffset, pushBeatLabUndo],
  );

  const resizeBeatLabMidiRollNoteFromStart = useCallback(
    (lane: number, headCol: number, newHeadCol: number) => {
      if (CREATION_BACKEND_BLANK) return;
      let nextHeadCol = headCol;
      setBanks((prev) => {
        const bank = prev[activeBank];
        if (!bank) return prev;
        const roll = bank.midiRoll ?? [];
        const drums = normalizeBankDrumPattern(bank.drums);
        let note = roll.find((n) => n.lane === lane && n.col === headCol);
        if (!note) {
          const fromDrums = beatLabNoteFromDrumSpan(lane, headCol, drums, drumColOffset);
          if (!fromDrums || fromDrums.col !== headCol) return prev;
          note = fromDrums;
        }
        const { col, len } = beatLabNoteResizeFromStartHead(
          headCol,
          note.len,
          newHeadCol,
          patternColsDrums,
        );
        nextHeadCol = col;
        if (col === headCol && len === note.len) return prev;
        if (beatLabRollNotesOverlap(roll, lane, col, len, { lane, col: headCol })) return prev;
        const nextRoll = [
          ...roll.filter((n) => !(n.lane === lane && n.col === headCol)),
          { ...note, col, len },
        ];
        let nextDrums = drums;
        if (lane < BEAT_LAB_PAD_LANES) {
          nextDrums = applyDrumSpanForPadNote(nextDrums, lane, headCol, note.len, false);
          nextDrums = applyDrumSpanForPadNote(nextDrums, lane, col, len, true);
        }
        return prev.map((b, i) =>
          i === activeBank ? { ...b, midiRoll: nextRoll, drums: nextDrums } : b,
        );
      });
      setBeatLabRollSelection((sel) =>
        sel && sel.lane === lane && sel.col === headCol ? { lane, col: nextHeadCol } : sel,
      );
    },
    [activeBank, applyDrumSpanForPadNote, beatLabNoteFromDrumSpan, drumColOffset, patternColsDrums],
  );

  const resizeBeatLabMidiRollNote = useCallback(
    (lane: number, col: number, len: number) => {
      if (CREATION_BACKEND_BLANK) return;
      setBanks((prev) => {
        const bank = prev[activeBank];
        if (!bank) return prev;
        const roll = bank.midiRoll ?? [];
        const drums = normalizeBankDrumPattern(bank.drums);
        let note = roll.find((n) => n.lane === lane && n.col === col);
        if (!note) {
          const fromDrums = beatLabNoteFromDrumSpan(lane, col, drums, drumColOffset);
          if (!fromDrums || fromDrums.col !== col) return prev;
          note = fromDrums;
        }
        let nextLen = clampBeatLabNoteLen(len, col, patternColsDrums);
        while (
          nextLen > 1 &&
          beatLabRollNotesOverlap(roll, lane, col, nextLen, { lane, col })
        ) {
          nextLen -= 1;
        }
        if (nextLen === note.len && roll.some((n) => n.lane === lane && n.col === col)) return prev;
        const inRoll = roll.some((n) => n.lane === lane && n.col === col);
        const nextRoll = inRoll
          ? roll.map((n) => (n.lane === lane && n.col === col ? { ...n, len: nextLen } : n))
          : [...roll, { ...note, len: nextLen }];
        let nextDrums = drums;
        if (lane < BEAT_LAB_PAD_LANES) {
          nextDrums = applyDrumSpanForPadNote(nextDrums, lane, col, note.len, false);
          nextDrums = applyDrumSpanForPadNote(nextDrums, lane, col, nextLen, true);
        }
        return prev.map((b, i) =>
          i === activeBank ? { ...b, midiRoll: nextRoll, drums: nextDrums } : b,
        );
      });
    },
    [activeBank, applyDrumSpanForPadNote, beatLabNoteFromDrumSpan, drumColOffset, patternColsDrums],
  );

  resizeBeatLabMidiRollNoteRef.current = resizeBeatLabMidiRollNote;
  moveBeatLabMidiRollNoteRef.current = moveBeatLabMidiRollNote;

  const clearBeatLabMidiRoll = useCallback(() => {
    if (CREATION_BACKEND_BLANK) return;
    pushBeatLabUndo();
    patchActiveBankMidiRoll([]);
  }, [patchActiveBankMidiRoll, pushBeatLabUndo]);

  /** Pad lane to clear — grid selection, else highlighted sampler pad (0–15). */
  const resolveBeatLabClearLaneIndex = useCallback((): number | null => {
    const lane = selectedBeatLabLaneRef.current;
    if (lane != null && lane >= 0 && lane < BEAT_LAB_PAD_LANES) return lane;
    const pad = geniusSamplerTargetPad;
    if (pad >= 0 && pad < BEAT_LAB_PAD_LANES) return pad;
    return null;
  }, [geniusSamplerTargetPad]);

  /** Wipe drum grid steps — `drums` + pad-lane `midiRoll` (both drive playback). */
  const wipeBeatLabDrumPattern = useCallback(
    (laneOnly?: number) => {
      if (CREATION_BACKEND_BLANK) return;
      pushBeatLabUndo();

      const wipeDrums = (drumsIn: DrumPattern): DrumPattern => {
        const drums = normalizeBankDrumPattern(drumsIn).map((row) => row.slice());
        if (laneOnly != null) {
          /** Full bank row — not only visible loop columns (long spans / DUP can extend past view). */
          return drums.map((row, i) =>
            i === laneOnly ? Array(TOTAL_COLS).fill(false) : row,
          );
        }
        return emptyDrums().map((row) => row.slice());
      };

      const wipeRoll = (rollIn: BeatLabMidiNote[]): BeatLabMidiNote[] => {
        const roll = normalizeBeatLabMidiRoll(rollIn);
        if (laneOnly != null) {
          return roll.filter((n) => n.lane !== laneOnly);
        }
        return roll.filter((n) => !beatLabLaneIsPad(n.lane));
      };

      setBanks((prev) =>
        prev.map((b, i) => {
          if (i !== activeBank) return b;
          return {
            ...b,
            drums: wipeDrums(b.drums),
            midiRoll: wipeRoll(b.midiRoll ?? []),
          };
        }),
      );
      setBankPatternSlots((prev) => {
        const next = prev.map((slots, i) =>
          i !== activeBank
            ? slots
            : { ...slots, [patternSlot]: wipeDrums(slots[patternSlot]) },
        );
        bankPatternSlotsRef.current = next;
        return next;
      });
      setBeatLabRollSelection(null);
    },
    [activeBank, patternSlot, pushBeatLabUndo],
  );

  const clearDrumLaneRef = useRef<(padIndex: number) => void>(() => {});
  const clearPatternDrumsRef = useRef<() => void>(() => {});

  const setBeatLabMidiRollMuted = useCallback(
    (lane: number, col: number, muted: boolean) => {
      if (CREATION_BACKEND_BLANK) return;
      const note = currentMidiRoll.find((n) => n.lane === lane && n.col === col);
      if (!note) return;
      patchActiveBankMidiRoll(
        currentMidiRoll.map((n) =>
          n.lane === lane && n.col === col
            ? { ...n, muted: muted ? true : undefined }
            : n,
        ),
      );
    },
    [currentMidiRoll, patchActiveBankMidiRoll],
  );

  const setBeatLabMidiRollVelocity = useCallback(
    (lane: number, col: number, vel: number) => {
      if (CREATION_BACKEND_BLANK) return;
      const note = currentMidiRoll.find((n) => n.lane === lane && n.col === col);
      if (!note) return;
      const v = Math.max(1, Math.min(127, Math.round(vel)));
      patchActiveBankMidiRoll(
        currentMidiRoll.map((n) => (n.lane === lane && n.col === col ? { ...n, vel: v } : n)),
      );
    },
    [currentMidiRoll, patchActiveBankMidiRoll],
  );

  const sliceBeatLabMidiRollNote = useCallback(
    (lane: number, headCol: number, splitCol: number, pitchSlice = false) => {
      if (CREATION_BACKEND_BLANK) return;
      setBanks((prev) => {
        const bank = prev[activeBank];
        if (!bank) return prev;
        const roll = bank.midiRoll ?? [];
        const drums = normalizeBankDrumPattern(bank.drums);
        let note = roll.find((n) => n.lane === lane && n.col === headCol);
        if (!note) {
          const fromDrums = beatLabNoteFromDrumSpan(lane, headCol, drums, drumColOffset);
          if (!fromDrums) return prev;
          note = fromDrums;
          headCol = fromDrums.col;
        }
        const split = beatLabSliceColForPointer(headCol, note.len, splitCol);
        if (split == null) return prev;
        const nextRoll = pitchSlice
          ? beatLabPitchSliceMidiNoteAt(roll, lane, headCol, split, patternColsDrums)
          : beatLabSplitMidiNoteAt(roll, lane, headCol, split, patternColsDrums);
        if (nextRoll.length === roll.length) return prev;
        let nextDrums = drums;
        if (lane < BEAT_LAB_PAD_LANES) {
          nextDrums = applyDrumSpanForPadNote(nextDrums, lane, headCol, note.len, false);
          const left = nextRoll.find((n) => n.lane === lane && n.col === headCol);
          const right = nextRoll.find((n) => n.lane === lane && n.col === split);
          if (left) nextDrums = applyDrumSpanForPadNote(nextDrums, lane, left.col, left.len, true);
          if (right) nextDrums = applyDrumSpanForPadNote(nextDrums, lane, right.col, right.len, true);
        }
        return prev.map((b, i) =>
          i === activeBank ? { ...b, midiRoll: nextRoll, drums: nextDrums } : b,
        );
      });
      setBeatLabRollSelection((sel) =>
        sel && sel.lane === lane && sel.col === headCol ? { lane, col: headCol } : sel,
      );
    },
    [activeBank, applyDrumSpanForPadNote, beatLabNoteFromDrumSpan, drumColOffset, patternColsDrums],
  );

  const resolveBeatLabGridTarget = useCallback(() => {
    if (beatLabDeckFocusRef.current === 'synth' && beatLabSynthFocusRef.current) {
      return beatLabSynthFocusRef.current;
    }
    return beatLabRollSelectionRef.current ?? beatLabGridFocusRef.current;
  }, []);

  const copyBeatLabRollSelection = useCallback(() => {
    const sel = resolveBeatLabGridTarget();
    if (!sel) return false;
    const note = beatLabNoteHeadAtLive(sel.lane, sel.col);
    if (!note) return false;
    beatLabRollClipboardRef.current = [{ ...note, col: note.col }];
    return true;
  }, [beatLabNoteHeadAtLive, resolveBeatLabGridTarget]);

  const resolveBeatLabPasteTarget = useCallback(
    (src: BeatLabMidiNote, explicitCol?: number) => {
      const focus = resolveBeatLabGridTarget();
      const lane = focus?.lane ?? src.lane;
      let col =
        explicitCol ??
        focus?.col ??
        (activeCol >= 0 ? activeCol : undefined);
      if (col == null) {
        col = src.col + Math.max(1, src.len);
        if (col >= patternColsDrums) col = Math.max(0, src.col - 1);
      }
      col = Math.max(0, Math.min(patternColsDrums - 1, col));
      if (lane === src.lane && col >= src.col && col < src.col + src.len) {
        col = Math.min(patternColsDrums - 1, src.col + Math.max(1, src.len));
      }
      return { lane, col };
    },
    [activeCol, patternColsDrums, resolveBeatLabGridTarget],
  );

  const pasteBeatLabRollClipboard = useCallback(
    (atCol?: number) => {
      if (CREATION_BACKEND_BLANK || beatLabRollClipboardRef.current.length === 0) return false;
      const src = beatLabRollClipboardRef.current[0]!;
      const { lane, col } = resolveBeatLabPasteTarget(src, atCol);
      return insertBeatLabMidiNoteAt(src, lane, col);
    },
    [insertBeatLabMidiNoteAt, resolveBeatLabPasteTarget],
  );

  const duplicateBeatLabRollSelection = useCallback(() => {
    const sel = resolveBeatLabGridTarget();
    if (!sel) return false;
    const note = beatLabNoteHeadAtLive(sel.lane, sel.col);
    if (!note) return false;
    const col = Math.min(patternColsDrums - 1, note.col + Math.max(1, note.len));
    return insertBeatLabMidiNoteAt(note, note.lane, col);
  }, [beatLabNoteHeadAtLive, insertBeatLabMidiNoteAt, patternColsDrums, resolveBeatLabGridTarget]);

  const beatLabGridShortcutsRef = useRef({
    copy: copyBeatLabRollSelection,
    paste: pasteBeatLabRollClipboard,
    duplicate: duplicateBeatLabRollSelection,
    deleteNote: deleteBeatLabMidiRollNote,
    noteHeadAt: beatLabNoteHeadAtLive,
    resolveTarget: resolveBeatLabGridTarget,
  });
  beatLabGridShortcutsRef.current = {
    copy: copyBeatLabRollSelection,
    paste: pasteBeatLabRollClipboard,
    duplicate: duplicateBeatLabRollSelection,
    deleteNote: deleteBeatLabMidiRollNote,
    noteHeadAt: beatLabNoteHeadAtLive,
    resolveTarget: resolveBeatLabGridTarget,
  };

  useEffect(() => {
    const isBeatLabGridView = () => {
      const sub = creationSubScreenRef.current;
      if (sub === 'beat-lab' || sub === 'drum-kit-generator') return true;
      return tabRef.current === 'grid';
    };
    const keyMatch = (e: KeyboardEvent, letter: string) =>
      e.code === `Key${letter.toUpperCase()}` || e.key.toLowerCase() === letter;

    function handleKeyDown(e: KeyboardEvent) {
      if (!isScreenActiveRef.current) return;

      const target = e.target as HTMLElement | null;
      const typing = Boolean(
        target?.closest('input, textarea, select, [contenteditable="true"]'),
      );

      if (isBeatLabGridView() && !typing) {
        const mod = e.ctrlKey || e.metaKey;
        if (mod && keyMatch(e, 'z') && !e.shiftKey) {
          e.preventDefault();
          beatLabUndo();
          return;
        }
        if (mod && (keyMatch(e, 'y') || (keyMatch(e, 'z') && e.shiftKey))) {
          e.preventDefault();
          beatLabRedo();
          return;
        }
        if (!mod) {
          if (keyMatch(e, 'p')) {
            e.preventDefault();
            setBeatLabEditTool('pointer');
            return;
          }
          if (keyMatch(e, 'b')) {
            e.preventDefault();
            setBeatLabEditTool('draw');
            return;
          }
          if (keyMatch(e, 'd')) {
            e.preventDefault();
            setBeatLabEditTool('erase');
            return;
          }
          if (keyMatch(e, 't')) {
            e.preventDefault();
            setBeatLabEditTool('mute');
            return;
          }
          if (keyMatch(e, 'v')) {
            e.preventDefault();
            setBeatLabEditTool('velocity');
            return;
          }
          if (keyMatch(e, 'c')) {
            e.preventDefault();
            setBeatLabEditTool('slice');
            return;
          }
          if (keyMatch(e, 'a')) {
            e.preventDefault();
            setBeatLabEditTool('automation');
            return;
          }
          if (keyMatch(e, 'h')) {
            e.preventDefault();
            setBeatLabEditTool('pitch');
            return;
          }
        }
        const sc = beatLabGridShortcutsRef.current;
        const sel = sc.resolveTarget();
        const head = sel ? sc.noteHeadAt(sel.lane, sel.col) : null;

        if (e.key === 'Delete' || e.key === 'Backspace') {
          if (head) {
            e.preventDefault();
            sc.deleteNote(head.lane, head.col);
            return;
          }
          const lane = resolveBeatLabClearLaneIndex();
          if (lane != null && isBeatLabGridView()) {
            e.preventDefault();
            clearDrumLaneRef.current(lane);
            return;
          }
        }
        if (mod && keyMatch(e, 'c')) {
          if (beatLabEditTool === 'pitch') {
            e.preventDefault();
            copyPitchAutomation();
            return;
          }
          if (head) {
            e.preventDefault();
            sc.copy();
            return;
          }
        }
        if (mod && keyMatch(e, 'x') && head) {
          e.preventDefault();
          sc.copy();
          sc.deleteNote(head.lane, head.col);
          return;
        }
        if (mod && keyMatch(e, 'v')) {
          if (beatLabEditTool === 'pitch' && pitchAutomationClipboardRef.current?.length) {
            e.preventDefault();
            pastePitchAutomation();
            return;
          }
          e.preventDefault();
          sc.paste();
          return;
        }
        if (mod && keyMatch(e, 'd') && head) {
          e.preventDefault();
          sc.duplicate();
          return;
        }
      }

      // Bank switches: 1?8
      if (e.key >= '1' && e.key <= '8') {
        setActiveBank(parseInt(e.key) - 1);
        return;
      }
      // Clear current bank: Ctrl+K
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        if (confirm(`Clear bank ${BANKS[activeBank]}?`)) {
          setBanks(prev => prev.map((b, i) => i === activeBank ? { drums: emptyDrums(), notes: [], midiRoll: [] } : b));
        }
        return;
      }
      // Tab switch: Ctrl+T more, Ctrl+G Beat Lab, Ctrl+H chord builder, Ctrl+A AI pattern, Ctrl+8 808 Lab
      if (e.ctrlKey) {
        if (e.key === 't') { e.preventDefault(); goToCreationSub('more'); }
        else if (e.key === 'g') { e.preventDefault(); goToCreationSub('beat-lab'); }
        else if (e.key === 'h') { e.preventDefault(); goToCreationSub('chord-builder'); }
        else if (e.key === '8') { e.preventDefault(); goToCreationSub('808-lab'); }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeBank,
    beatLabEditTool,
    beatLabRedo,
    beatLabUndo,
    copyPitchAutomation,
    goToCreationSub,
    pastePitchAutomation,
    resolveBeatLabClearLaneIndex,
  ]);

  const beatLabPianoRollExpanded = beatLabDeckFocus === 'sequence';
  const beatLabSynthLane =
    selectedBeatLabLane != null && selectedBeatLabLane >= BEAT_LAB_MELODIC_LANE_START
      ? selectedBeatLabLane
      : BEAT_LAB_MELODIC_LANE_START;

  const fitBeatLabGridToViewport = useCallback(() => {
    const el = beatLabRollScrollRef.current;
    if (!el) return;
    const gutter = BEAT_LAB_ROLL_LABEL_W + 8;
    const visible = Math.max(120, el.clientWidth - gutter);
    const n = Math.max(1, patternColsDrums);
    const next = Math.floor(visible / n);
    setColWidth(Math.max(MIN_CW, Math.min(MAX_CW, next)));
    el.scrollLeft = 0;
  }, [beatLabPianoRollExpanded, patternColsDrums]);
  const applyBeatLabGridLayoutDefault = useCallback(() => {
    setBeatLabGridLayoutMode('default');
  }, []);
  const applyBeatLabGridLayoutFull = useCallback(() => {
    setBeatLabGridLayoutMode('full');
    if (beatLabDeckFocus !== 'sequence') {
      setBeatLabDeckFocus('sequence');
    }
    setBeatLabGridZoomMode('max');
    requestAnimationFrame(() => fitBeatLabGridToViewport());
  }, [beatLabDeckFocus, fitBeatLabGridToViewport]);

  useEffect(() => {
    if (beatLabDeckFocus !== 'sequence' && beatLabGridLayoutMode === 'full') {
      setBeatLabGridLayoutMode('default');
    }
  }, [beatLabDeckFocus, beatLabGridLayoutMode]);

  useEffect(() => {
    if (!beatLabGridFullView) return;
    const id = requestAnimationFrame(() => fitBeatLabGridToViewport());
    return () => cancelAnimationFrame(id);
  }, [beatLabGridFullView, fitBeatLabGridToViewport]);

  const beatLabPianoRollPanel = useMemo(
    () => (
      <BeatLabPianoRoll
        notes={currentMidiRoll}
        patternCols={patternColsDrums}
        colWidth={colWidth}
        activeCol={activeCol >= 0 ? activeCol : visualSyncCol}
        transportNotStopped={transportNotStopped}
        playheadElRef={beatLabRollPlaylineRef}
        scrollRef={beatLabRollScrollRef}
        onScroll={onBeatLabRollScroll}
        onSeekCol={seekTransportToPatternColumn}
        onToggleNote={toggleBeatLabMidiRollNote}
        onSetNote={setBeatLabMidiRollStep}
        editTool={beatLabEditTool}
        onModeChange={setBeatLabEditTool}
        onSetNoteMuted={setBeatLabMidiRollMuted}
        onSetNoteVelocity={setBeatLabMidiRollVelocity}
        onSliceNote={sliceBeatLabMidiRollNote}
        volAutomation={currentVolAutomation}
        pitchAutomation={currentPitchAutomation}
        onVolAutomationPaint={patchVolAutomation}
        onPitchAutomationPaint={patchPitchAutomation}
        onAutomationGestureStart={beginBeatLabUndoGesture}
        onAutomationGestureEnd={endBeatLabUndoGesture}
        pitchSelectionRef={pitchAutomationSelectionRef}
        onEditGestureStart={beginBeatLabUndoGesture}
        onEditGestureEnd={endBeatLabUndoGesture}
        onMoveNote={moveBeatLabMidiRollNote}
        onResizeNote={resizeBeatLabMidiRollNote}
        onResizeNoteFromStart={resizeBeatLabMidiRollNoteFromStart}
        onDeleteNote={deleteBeatLabMidiRollNote}
        onDuplicateNote={(fromLane, fromCol, toLane, toCol) => {
          const note = currentMidiRoll.find(
            (n) => n.lane === fromLane && n.col === fromCol,
          );
          if (note) insertBeatLabMidiNoteAt(note, toLane, toCol);
        }}
        selectedNote={beatLabRollSelection}
        onSelectNote={(sel) => {
          beatLabGridFocusRef.current = sel;
          setBeatLabRollSelection(sel);
        }}
        onClearNotes={() => {
          clearBeatLabMidiRoll();
        }}
        laneLabelForPad={(pi) =>
          beatLabLaneDisplayLabel(pi, padSampleLabels[padSampleKey(activeBank, pi)])
        }
        laneColorForPad={beatLabPadColor}
        selectedLane={selectedBeatLabLane}
        onLaneSelect={setSelectedBeatLabLane}
        onPadLanePreview={(pi) => {
          if (CREATION_BACKEND_BLANK) return;
          setSelectedBeatLabLane(pi);
          if (pi < BEAT_LAB_PAD_LANES) {
            playPadSoundRef.current(pi, PAD_VEL[pi] ?? 90);
            return;
          }
          const ctx = getOrCreateAudioContext();
          void ctx.resume().then(() => {
            const slot = beatLabMelodicSlotIndex(pi);
            const instId =
              melodicInstrumentsRef.current[slot] ??
              BEAT_LAB_MELODIC_DEFAULT_INSTRUMENTS[slot]!;
            previewBeatLabMelodicNote(ctx, {
              lane: pi,
              midi: beatLabMelodicLanePitch(pi),
              velocity: 100,
              when: ctx.currentTime + 0.01,
              instrumentId: instId,
              channelVolumes: channelVolumesRef.current,
            });
          });
        }}
        deckFocus={beatLabDeckFocus}
        onDeckFocusChange={setBeatLabDeckFocus}
        melodicLanesOnly={false}
        gridSnap={{
          qpb: beatLabQpb,
          subdiv: subdivHud,
          bankColOffset: drumColOffset,
        }}
        editToolSnapHint={snapLabelFromPianoSnapSubdiv(pianoSnapSubdiv)}
        disabled={CREATION_BACKEND_BLANK}
        hideHeaderToolbar
      />
    ),
    [
      activeBank,
      activeCol,
      beatLabDeckFocus,
      beatLabEditTool,
      setBeatLabMidiRollMuted,
      setBeatLabMidiRollVelocity,
      sliceBeatLabMidiRollNote,
      currentVolAutomation,
      currentPitchAutomation,
      patchVolAutomation,
      patchPitchAutomation,
      clearBeatLabMidiRoll,
      colWidth,
      setBeatLabMidiRollStep,
      loopBars,
      pianoSnapSubdiv,
      qpbHud,
      subdivHud,
      drumColOffset,
      currentMidiRoll,
      moveBeatLabMidiRollNote,
      onBeatLabRollScroll,
      padSampleLabels,
      patternColsDrums,
      selectedBeatLabLane,
      resizeBeatLabMidiRollNote,
      seekTransportToPatternColumn,
      toggleBeatLabMidiRollNote,
      transportNotStopped,
      visualSyncCol,
    ],
  );

  const beatLabMelodicChannelLabel = useCallback(
    (lane: number) => {
      const slot = beatLabMelodicSlotIndex(lane);
      const instId =
        currentMelodicInstruments[slot] ?? BEAT_LAB_MELODIC_DEFAULT_INSTRUMENTS[slot]!;
      return (
        BEAT_LAB_MELODIC_INSTRUMENT_OPTIONS.find((o) => o.id === instId)?.label ??
        beatLabLaneDisplayLabel(lane)
      );
    },
    [currentMelodicInstruments],
  );

  const patchBeatLabSynthLaneNotes = useCallback(
    (lane: number, laneNotes: BeatLabMidiNote[]) => {
      if (CREATION_BACKEND_BLANK) return;
      const kept = currentMidiRoll.filter((n) => n.lane !== lane);
      patchActiveBankMidiRollWithUndo([...kept, ...laneNotes]);
    },
    [currentMidiRoll, patchActiveBankMidiRollWithUndo],
  );

  const beatLabSynthPanel = useMemo(
    () => (
      <BeatLabSynthPianoRoll
        notes={currentMidiRoll}
        lane={beatLabSynthLane}
        patternCols={patternColsDrums}
        beatsPerBar={beatsPerBar}
        colsPerBar={MEASURES_PER_BAR}
        stepSubdiv={subdivHud}
        playheadStepCol={activeCol >= 0 ? activeCol : 0}
        isPlaying={isPlaying}
        playheadElRef={beatLabSynthPlaylineRef}
        scrollContainerRef={beatLabSynthScrollRef}
        playingMidis={new Set()}
        onNotesChange={patchBeatLabSynthLaneNotes}
        onSeekStepCol={seekTransportToPatternColumn}
        onPreviewMidi={previewBeatLabMelodicMidi}
        onSelectLane={setSelectedBeatLabLane}
        onPreviewLane={(pi) => {
          if (CREATION_BACKEND_BLANK) return;
          setSelectedBeatLabLane(pi);
          const ctx = getOrCreateAudioContext();
          void ctx.resume().then(() => {
            const slot = beatLabMelodicSlotIndex(pi);
            const instId =
              melodicInstrumentsRef.current[slot] ??
              BEAT_LAB_MELODIC_DEFAULT_INSTRUMENTS[slot]!;
            previewBeatLabMelodicNote(ctx, {
              lane: pi,
              midi: beatLabMelodicLanePitch(pi),
              velocity: 100,
              when: ctx.currentTime + 0.01,
              instrumentId: instId,
              channelVolumes: channelVolumesRef.current,
            });
          });
        }}
        channelLabelForLane={beatLabMelodicChannelLabel}
        melodicInstruments={currentMelodicInstruments}
        onMelodicInstrumentChange={patchMelodicInstrument}
        editTool={beatLabEditTool}
        onEditGestureStart={beginBeatLabUndoGesture}
        onEditGestureEnd={endBeatLabUndoGesture}
        onGridCellFocus={(stepCol) => {
          beatLabSynthFocusRef.current = { lane: beatLabSynthLane, col: stepCol };
        }}
        disabled={CREATION_BACKEND_BLANK}
      />
    ),
    [
      activeCol,
      beatLabEditTool,
      beatLabMelodicChannelLabel,
      beatLabMelodicLanePitch,
      beatLabSynthLane,
      beginBeatLabUndoGesture,
      endBeatLabUndoGesture,
      getOrCreateAudioContext,
      setSelectedBeatLabLane,
      beatsPerBar,
      currentMelodicInstruments,
      currentMidiRoll,
      patchBeatLabSynthLaneNotes,
      patchMelodicInstrument,
      patternColsDrums,
      previewBeatLabMelodicMidi,
      seekTransportToPatternColumn,
      subdivHud,
      isPlaying,
    ],
  );

  const currentNotes = banks[activeBank]?.notes ?? [];
  const displayNotes = useMemo(
    () =>
      NOTES.map((n) => {
        const shifted = noteNameToMidi(n) + pianoRegisterShift * 12;
        return midiToNoteName(shifted);
      }),
    [pianoRegisterShift],
  );
  currentDrumsRef.current = currentDrums;

  const fireStepAt = useCallback((k: number, idealGridT: number, ctx: AudioContext) => {
    const subdiv = Math.max(1, Math.min(DRUM_MAX_SUBDIV, Math.round(drumStepSubdivRef.current)));
    const drumBeatOff = Math.floor(Math.max(0, loopOnRef.current ? loopStartBeatRef.current : 0) + 1e-8);
    const drumColOff = Math.floor(Math.max(0, loopOnRef.current ? loopStartBeatRef.current * subdiv : 0) + 1e-8);
    /** Must match {@link patternColsDrums} / playline / grid ? `patternColsDrumsBeats * subdiv` can exceed `TOTAL_COLS`. */
    const gridCols = Math.max(1, patternColsDrumsRef.current);
    const quarterSpan = Math.max(1, Math.floor(gridCols / subdiv));
    let posInPattern = k - drumBeatOff;
    if (loopOnRef.current && loopEndBeatRef.current > loopStartBeatRef.current) {
      const ls = Math.floor(loopStartBeatRef.current + 1e-8);
      const le = Math.floor(loopEndBeatRef.current + 1e-8);
      const span = Math.max(1, le - ls);
      posInPattern = ((k - ls) % span + span) % span;
    }
    const playModeR = patternPlayModeRef.current;
    const activeSlots = bankPatternSlotsRef.current[activeBank];
    const patternDrums =
      playModeR === 'chainAB' && activeSlots
        ? (((Math.floor(posInPattern / Math.max(1, quarterSpan)) % 2 + 2) % 2) === 0 ? activeSlots.A : activeSlots.B)
        : currentDrumsRef.current;
    const ctSnap = creationRefillCtSnapRef.current;
    const whenSnap = Math.max(idealGridT, ctSnap + SE2_AUDIO_START_FLOOR_SEC);
    const subSpb = (60 / Math.max(1, bpmRef.current)) / subdiv;
    for (let s = 0; s < subdiv; s += 1) {
      const colInPattern = ((posInPattern * subdiv + s) % gridCols + gridCols) % gridCols;
      const bankCol = colInPattern + drumColOff;
      const whenSub = whenSnap + s * subSpb;
      const colPitch = beatLabPitchSemiAtColumn(
        currentPitchAutomationRef.current,
        colInPattern,
        0,
      );
      patternDrums.forEach((row, pi) => {
        if (row[bankCol] && !mutedPadsRef.current[pi]) {
          playPadSoundRef.current(
            pi,
            beatLabEffectiveVelocity(PAD_VEL[pi], currentVolAutomationRef.current, colInPattern),
            whenSub,
            colPitch,
          );
        }
      });
      const roll = currentMidiRollRef.current;
      for (const n of roll) {
        if (n.col !== colInPattern || n.muted) continue;
        if (beatLabLaneIsPad(n.lane)) {
          if (!mutedPadsRef.current[n.lane]) {
            const effVel = beatLabEffectiveVelocity(
              n.vel,
              currentVolAutomationRef.current,
              colInPattern,
            );
            playPadSoundRef.current(
              n.lane,
              effVel,
              whenSub,
              n.pitchSemi ?? 0,
            );
          }
          continue;
        }
        const slot = beatLabMelodicSlotIndex(n.lane);
        const instId =
          melodicInstrumentsRef.current[slot] ??
          BEAT_LAB_MELODIC_DEFAULT_INSTRUMENTS[slot] ??
          'acoustic_grand_piano';
        const autoSemi = beatLabPitchSemiAtColumn(
          currentPitchAutomationRef.current,
          colInPattern,
          0,
        );
        const midi = Math.max(
          0,
          Math.min(127, Math.round(beatLabNoteMidi(n.lane, n) + autoSemi)),
        );
        const effVel = beatLabEffectiveVelocity(
          n.vel,
          currentVolAutomationRef.current,
          colInPattern,
        );
        const noteSteps = Math.max(1, n.len);
        scheduleBeatLabMelodicNote(ctx, {
          lane: n.lane,
          midi,
          velocity: effVel,
          when: whenSub,
          durationSec: Math.min(4, Math.max(0.08, subSpb * noteSteps * 0.95)),
          instrumentId: instId,
          channelVolumes: channelVolumesRef.current,
        });
      }
    }
    /**
     * Downbeat matches MSR / quant row: same quarter phase as {@link computeCreationTransportHudFromBeat}
     * (`floor(originBeat)`), not raw global `k % bpb` (which desyncs accents when play/seek starts mid-bar).
     */
    return true;
  }, [activeBank, originBeatRef, patternPlayModeRef, triggerChannel]);

  const playCreationMetronomeClick = useCallback(
    (k: number, idealGridT: number, ctx: AudioContext) => {
      const bpb = Math.max(2, Math.min(16, Math.round(beatsPerBarRef.current)));
      const orgQ = Math.floor(Math.max(0, originBeatRef.current) + 1e-8);
      const downbeat = (((k - orgQ) % bpb) + bpb) % bpb === 0;
      scheduleMetronomeClickAt(ctx, idealGridT, downbeat, creationRefillCtSnapRef.current);
    },
    [scheduleMetronomeClickAt],
  );

  const refillCreationSchedule = useCallback(
    (ctx: AudioContext, ctSnap: number, opts?: { loopContinuation?: boolean }) => {
      creationRefillCtSnapRef.current = ctSnap;
      if (runningRef.current && sessionStartRef.current > 0) {
        creationPerfSessionStartMsRef.current =
          performance.now() + (sessionStartRef.current - ctSnap) * 1000;
      }
      const spb = 60 / Math.max(1, bpmRef.current);
      refillCreationMetronome(
        ctx,
        ctSnap,
        spb,
        {
          nextMetroKRef,
          sessionStartRef,
          originBeatRef,
        },
        playCreationMetronomeClick,
        () => runningRef.current,
        () => metroOnRef.current,
        opts,
      );
      refillCreationTransportLookahead(
        ctx,
        ctSnap,
        spb,
        {
          nextStepBeatRef,
          nextStepTimeRef,
          sessionStartRef,
          originBeatRef,
          lastScheduledQuarterRef,
        },
        fireStepAt,
        () => runningRef.current,
        opts,
      );
    },
    [fireStepAt, playCreationMetronomeClick],
  );

  refillCreationScheduleRef.current = refillCreationSchedule;

  onAudioContextRebuiltRef.current = (ctx: AudioContext) => {
    if (!runningRef.current) return;
    const tCapture = Math.max(0, ctx.currentTime);
    sessionStartRef.current = tCapture + SE2_AUDIO_START_FLOOR_SEC;
    schedAnchorTimeRef.current = tCapture;
    schedAnchorPerfRef.current = performance.now();
    creationPerfSessionStartMsRef.current =
      performance.now() + (sessionStartRef.current - tCapture) * 1000;
    const spb = 60 / Math.max(1, bpmRef.current);
    const k0 = Math.ceil(originBeatRef.current - 1e-8);
    seedCreationTransportOnPlay(
      { nextStepBeatRef, nextStepTimeRef },
      originBeatRef.current,
      sessionStartRef.current,
      spb,
    );
    nextMetroKRef.current = k0;
    creationMetroClickBuffersRef.current = null;
    refillCreationScheduleRef.current(ctx, tCapture, { skipOverdueCatchUp: true });
    launchCreationPlaylineWapiNow(displayBeatRef.current, true);
  };

  const clearAllQuantMeasureImperativeLit = useCallback(() => {
    const cells = quantMeasureCellElsRef.current;
    for (let i = 0; i < cells.length; i++) {
      const el = cells[i];
      if (!el) continue;
      if (el.hasAttribute('data-drum-quant-imperative-lit')) {
        clearQuantMeasureCellImperativeLit(el);
      }
    }
  }, []);

  /** Clear any legacy imperative quant styles after React commits / transport bumps. */
  useLayoutEffect(() => {
    if (tab !== 'grid') {
      for (const el of quantMeasureCellElsRef.current) {
        clearQuantMeasureCellImperativeLit(el);
      }
      return;
    }
    void transportBeatEpoch;
    clearAllQuantMeasureImperativeLit();
  }, [tab, transportBeatEpoch, clearAllQuantMeasureImperativeLit]);

  creationTransportOnFrameRef.current = (bDisplay: number) => {
    /** SE2 split: `b` = compositor (scroll / loop edge); `bDisplay` = audio clock (BAR/MSR/time/steps). */
    let b = bDisplay;
    if (runningRef.current) {
      const anim = creationDrumPlaylineAnimRef.current;
      const seg = creationWapiSegStateRef.current;
      if (anim && anim.playState !== 'idle') {
        const animMs = Number(anim.currentTime ?? 0);
        b = beatFromCreationPlaylineWapiAnim(animMs, seg, creationWapiBpmRef.current);
      }
    }

    if (runningRef.current && loopOnRef.current) {
      const ls = loopStartBeatRef.current;
      const le = loopEndBeatRef.current;
      if (le > ls) {
        const seg = creationWapiSegStateRef.current;
        /** Only seamless loop segment WAAPI — open-pattern cycles must not cancel voices (SE2). */
        const wapiWrap =
          seg.seamlessLoop &&
          creationPlaylineWapiLoopWrapped(
            creationDrumPlaylineAnimRef.current,
            creationWapiPrevPhaseMsRef,
            creationWapiLoopCycleSeenRef,
          );
        const audioWrap = creationAudioLoopPhaseWrapped(bDisplay, ls, le, creationLoopPhaseRef);
        if (
          (wapiWrap || audioWrap) &&
          performance.now() - creationTransportPlayStartMsRef.current > 150
        ) {
          const spanMs = ((le - ls) * 60 * 1000) / Math.max(1, bpmRef.current);
          const debounceMs = Math.max(80, spanMs * 0.35);
          const nowMs = performance.now();
          if (nowMs - creationLastLoopWrapMsRef.current >= debounceMs) {
            creationLastLoopWrapMsRef.current = nowMs;
            const ctx = ctxRef.current;
            if (ctx && ctx.state !== 'closed') {
              const tCapture = Math.max(0, ctx.currentTime);
              /** Do not cancel queued clicks — that blanks the metronome until refill catches up. */
              refillCreationScheduleRef.current(ctx, tCapture, { loopContinuation: true });
            }
          }
        }
      }
    } else {
      resetCreationLoopWrapDetectRefs(
        creationWapiPrevPhaseMsRef,
        creationWapiLoopCycleSeenRef,
        creationLoopPhaseRef,
      );
    }

    const qpbR = Math.max(2, Math.min(16, Math.round(beatsPerBarRef.current)));
    const subdiv = Math.max(1, Math.min(DRUM_MAX_SUBDIV, Math.round(drumStepSubdivRef.current)));
    const pcols = Math.max(1, patternColsDrumsRef.current);
    const loopStartBarR = Math.floor(loopStartBeatRef.current / qpbR) + 1;
    const acFromAudio = creationPatternColFromDisplayBeat(
      bDisplay,
      subdiv,
      pcols,
      loopOnRef.current,
      loopStartBeatRef.current,
      loopEndBeatRef.current,
      patternPlayModeRef.current,
    );
    const ac = acFromAudio;

    if (!runningRef.current) clearAllQuantMeasureImperativeLit();

    const hudRaf = computeCreationTransportHudFromBeat(bDisplay, {
      subdiv,
      pcols,
      loopOn: loopOnRef.current,
      loopStartBeat: loopStartBeatRef.current,
      loopEndBeat: loopEndBeatRef.current,
      playMode: patternPlayModeRef.current,
      loopStartBar: loopStartBarR,
      qpb: qpbR,
      transportOriginBeat: originBeatRef.current,
    });
    const gqHudKey = `${hudRaf.bar}|${hudRaf.measure}|${hudRaf.phrase}`;
    if (gqHudKey !== creationHudQuarterPaintedRef.current) {
      creationHudQuarterPaintedRef.current = gqHudKey;
      paintCreationHudQuarterIntoDom(
        creationHudDomRef.current,
        hudRaf,
        qpbR,
        { active: true },
        creationHudHoldRef,
        true,
      );
    }

    if (followRef.current && isPlaybackOrRecordRef.current && transportNotStoppedRef.current) {
      const cwD = Math.max(colWidthRef.current, DRUM_GRID_MIN_CW);
      const cwP = beatLabPianoColWForView(Math.max(colWidthRef.current, PIANO_GRID_MIN_CW));
      const pos = creationPlaylineColFAndPx(
        b,
        subdiv,
        pcols,
        loopOnRef.current,
        loopStartBeatRef.current,
        loopEndBeatRef.current,
        patternPlayModeRef.current,
        cwD,
        cwP,
      );
      const txD = readTranslateXFromWapiKeyframeAnim(drumPlaylineRef.current);
      const rollLineEl = beatLabPianoPlaylineEl();
      const txP = readTranslateXFromWapiKeyframeAnim(rollLineEl);
      const pxDrum =
        runningRef.current && txD != null ? txD + CREATION_DRUM_PLAYLINE_CENTER_X : pos.drumX;
      const pxPiano =
        runningRef.current && txP != null ? txP + CREATION_PIANO_PLAYLINE_CENTER_X : pos.pianoX;
      const scrollFollowPx = (el: HTMLDivElement | null, px: number) => {
        if (!el) return;
        const left = el.scrollLeft;
        const right = left + el.clientWidth;
        const m = el.clientWidth * 0.3;
        if (px < left + m || px > right - m) el.scrollLeft = Math.max(0, px - el.clientWidth * 0.35);
      };
      scrollFollowPx(drumScrollRef.current, pxDrum);
      if (tab === 'grid') {
        scrollFollowPx(
          beatLabDeckFocusRef.current === 'synth'
            ? beatLabSynthScrollRef.current
            : beatLabRollScrollRef.current,
          pxPiano,
        );
      } else {
        scrollFollowPx(pianoScrollRef.current, pxPiano);
      }
    }

    const pub = creationTransportUiPublishRef.current;
    const churn = ac !== pub.activeCol || gqHudKey !== pub.hudKey;
    if (churn) {
      pub.activeCol = ac;
      pub.hudKey = gqHudKey;
      publishCreationTransportBeat();
    }
    paintCreationSe2TransportReadouts(bDisplay, false);
  };

  useCreationTransportPump(
    {
      ctxRef,
      runningRef,
      sessionStartRef,
      originBeatRef,
      displayBeatRef,
      bpmRef,
      lastScheduledQuarterRef,
      schedAnchorTimeRef,
      schedAnchorPerfRef,
    },
    {
      isScreenActive: !!isScreenActive,
      isPlaying,
      getOrCreateAudioContext,
      refillRef: refillCreationScheduleRef,
      onFrameRef: creationTransportOnFrameRef,
      onAudioContextRebuiltRef,
    },
  );

  /**
   * Playline relaunch ? **same split as Studio Editor 2** (`StudioEditor2Screen` ~6220?6231):
   * 1) ?zoom? (here: column width + Creation-only grid geometry: snap subdiv, chain mode, pattern width).
   * 2) Loop bounds only (`loopOn` / `loopStartBeat` / `loopEndBeat`).
   * 3) **BPM / pattern column count** ? separate effects below so WAAPI `durationMs` always matches
   *    `60/bpm` like the metronome / lookahead when tempo or loop bar count changes during play.
   * Uses `runningRef` like SE2 uses `runningRef`, **not** `isPlaying` in deps, so Play/Resume does not
   * immediately re-cancel the anim that `startTransport` just started.
   */
  useEffect(() => {
    if (!isScreenActive) return;
    if (runningRef.current) {
      launchCreationPlaylineWapiNow(displayBeatRef.current, true);
    } else {
      updateCreationPlaylineTransforms(cursorBeatRef.current);
    }
  }, [
    colWidth,
    drumStepSubdiv,
    patternPlayMode,
    patternColsDrums,
    isScreenActive,
    launchCreationPlaylineWapiNow,
    updateCreationPlaylineTransforms,
  ]);

  /** Tempo change during play — re-anchor step/metro clocks to audio beat, then rebuild WAAPI. */
  useEffect(() => {
    if (!isScreenActive || !runningRef.current) return;
    const ctx = ctxRef.current;
    if (!ctx || ctx.state === 'closed') return;
    const b = displayBeatRef.current;
    const spb = 60 / Math.max(1, bpmRef.current);
    reanchorNextStepWhileRunning(
      {
        nextStepBeatRef,
        nextStepTimeRef,
        sessionStartRef,
        originBeatRef,
        lastScheduledQuarterRef,
      },
      sessionStartRef.current,
      b,
      spb,
    );
    nextMetroKRef.current = Math.ceil(b - 1e-8);
    cancelScheduledCreationMetroNodes();
    refillCreationScheduleRef.current(ctx, Math.max(0, ctx.currentTime), { skipOverdueCatchUp: true });
    launchCreationPlaylineWapiNow(b, true);
  }, [bpm, isScreenActive, launchCreationPlaylineWapiNow]);

  useEffect(() => {
    if (!isScreenActive || !runningRef.current) return;
    launchCreationPlaylineWapiNow(displayBeatRef.current, true);
  }, [loopOn, loopStartBeat, loopEndBeat, isScreenActive, launchCreationPlaylineWapiNow]);

  /** SYNTH vs ROLL: same WAAPI clock, different playline element + quarter-scaled `pianoColW`. */
  useEffect(() => {
    if (!isScreenActive || tab !== 'grid') return;
    if (runningRef.current) {
      launchCreationPlaylineWapiNow(displayBeatRef.current, true);
    } else {
    updateCreationPlaylineTransforms(cursorBeatRef.current);
    }
  }, [
    beatLabDeckFocus,
    pianoSnapSubdiv,
    isScreenActive,
    launchCreationPlaylineWapiNow,
    updateCreationPlaylineTransforms,
    tab,
  ]);

  /** Loop bounds change while stopped ? static playline only (no second WAAPI launch with zoom effect). */
  useEffect(() => {
    if (!isScreenActive || runningRef.current) return;
    updateCreationPlaylineTransforms(cursorBeatRef.current);
  }, [loopOn, loopStartBeat, loopEndBeat, isScreenActive, updateCreationPlaylineTransforms]);

  const zoomIn    = useCallback(() => {
    setBeatLabGridZoomMode('min');
    setColWidth(w => Math.min(MAX_CW, w + ZOOM_STEP));
  }, []);
  const zoomOut   = useCallback(() => {
    setBeatLabGridZoomMode('min');
    setColWidth(w => Math.max(MIN_CW, w - ZOOM_STEP));
  }, []);
  const zoomReset = useCallback(() => {
    setBeatLabGridZoomMode('min');
    setColWidth(DEF_CW);
  }, []);
  /** Toolbar FIT + MAX zoom ? fit loop columns to the active grid viewport. */
  const fitDrumGridToLoop = useCallback(() => {
    setBeatLabGridZoomMode('max');
    fitBeatLabGridToViewport();
  }, [fitBeatLabGridToViewport]);
  /** Refit column width whenever loop length / step count changes (MAX zoom only). */
  useEffect(() => {
    if (tab !== 'grid' || beatLabGridZoomMode !== 'max') return;
    const run = () => fitBeatLabGridToViewport();
    const id = requestAnimationFrame(() => {
      if (beatLabDeckFocus === 'sequence') requestAnimationFrame(run);
      else run();
    });
    return () => cancelAnimationFrame(id);
  }, [fitBeatLabGridToViewport, patternColsDrums, loopBars, pianoSnapSubdiv, tab, beatLabDeckFocus, beatLabGridZoomMode]);

  /** MAX zoom: keep columns fitted when the active grid viewport resizes. */
  useEffect(() => {
    if (tab !== 'grid' || beatLabGridZoomMode !== 'max') return;
    const el = beatLabPianoRollExpanded
      ? beatLabRollScrollRef.current
      : drumScrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => fitBeatLabGridToViewport());
    ro.observe(el);
    return () => ro.disconnect();
  }, [tab, beatLabPianoRollExpanded, beatLabGridZoomMode, beatLabGridFullView, fitBeatLabGridToViewport]);

  /** MAX zoom: refit when switching GRID / ROLL. */
  useEffect(() => {
    if (tab !== 'grid' || beatLabGridZoomMode !== 'max') return;
    const id = requestAnimationFrame(() => fitBeatLabGridToViewport());
    return () => cancelAnimationFrame(id);
  }, [beatLabDeckFocus, beatLabGridZoomMode, fitBeatLabGridToViewport, tab]);

  const beatLabSessionZoomTools = useMemo(
    () => (
      <>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '4px 8px',
            borderRadius: 6,
            border: '1px solid #2a2a32',
            background: '#090909',
            flexShrink: 0,
          }}
          title="Creation patterns sync to the DAW session when you arrange or open Studio"
        >
          <span style={{ fontSize: 8, color: '#6a6a78', fontFamily: 'monospace', letterSpacing: 0.5 }}>SESSION</span>
          <span style={{ fontSize: 9, color: '#666', fontFamily: 'monospace', fontWeight: 700 }}>LINKED</span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: '#0a0a0e',
            border: '1px solid #2a2a32',
            borderRadius: 4,
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <button type="button" onClick={zoomOut} style={{ padding: '3px 7px', background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}><ZoomOut size={11} /></button>
          <span style={{ padding: '0 6px', fontFamily: 'monospace', fontSize: 10, color: '#4a4a58', borderLeft: '1px solid #2a2a32', borderRight: '1px solid #2a2a32' }}>{colWidth}px</span>
          <input
            type="range"
            min={MIN_CW}
            max={MAX_CW}
            step={1}
            value={colWidth}
            onChange={(e) => {
              setBeatLabGridZoomMode('min');
              setColWidth(Number(e.target.value));
            }}
            style={{ width: 92, height: 4, margin: '0 6px', accentColor: '#00E5FF', cursor: 'ew-resize' }}
            title="Drag to zoom grid in/out"
          />
          <button type="button" onClick={zoomIn} style={{ padding: '3px 7px', background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}><ZoomIn size={11} /></button>
          <button type="button" onClick={zoomReset} style={{ padding: '3px 7px', background: 'none', border: 'none', color: '#666', cursor: 'pointer', borderLeft: '1px solid #2a2a32' }}><Maximize2 size={11} /></button>
          <button
            type="button"
            onClick={fitDrumGridToLoop}
            style={{ padding: '3px 8px', background: 'none', border: 'none', color: '#7aa2b8', cursor: 'pointer', borderLeft: '1px solid #2a2a32', fontSize: 10, fontFamily: 'monospace', fontWeight: 700 }}
            title={`Fit ${loopBars} bar${loopBars !== 1 ? 's' : ''} to screen`}
          >
            FIT
          </button>
          <button
            type="button"
            onClick={() => setBeatLabTileGrid((v) => !v)}
            style={{
              padding: '3px 8px',
              background: beatLabTileGrid ? 'rgba(124, 244, 198, 0.12)' : 'none',
              border: 'none',
              borderLeft: '1px solid #2a2a32',
              color: beatLabTileGrid ? '#7cf4c6' : '#666',
              cursor: 'pointer',
              fontSize: 10,
              fontFamily: 'monospace',
              fontWeight: 700,
            }}
            title={
              beatLabTileGrid
                ? 'Square step tiles on — click for classic full-cell grid'
                : 'Square step tiles off — click for Drumloop-style square grid'
            }
          >
            TILES
          </button>
        </div>
      </>
    ),
    [beatLabTileGrid, colWidth, fitDrumGridToLoop, loopBars, zoomIn, zoomOut, zoomReset],
  );

  const stopPadSamplePlayback = useCallback((padIndex: number) => {
    const key = padSampleKey(activeBank, padIndex);
    const bag = padSampleActiveStoppersRef.current.get(key);
    if (!bag?.size) return;
    padSampleActiveStoppersRef.current.delete(key);
    for (const fn of [...bag]) {
      try {
        fn();
      } catch {
        /* */
      }
    }
  }, [activeBank]);

  const clearPadSample = useCallback((padIndex: number) => {
    stopPadSamplePlayback(padIndex);
    const k = padSampleKey(activeBank, padIndex);
    padSampleBuffersRef.current.delete(k);
    delete padSamplePlaybackOptsRef.current[k];
    delete padSampleFxRackRef.current[k];
    setPadSamplePresence(prev => {
      const n = { ...prev };
      delete n[k];
      return n;
    });
    setPadSampleRootBpms((prev) => {
      const n = { ...prev };
      delete n[k];
      return n;
    });
    setPadSampleLabels((prev) => {
      const n = { ...prev };
      delete n[k];
      return n;
    });
    const store = loadPadSampleStore();
    delete store[k];
    savePadSampleStore(store);
  }, [activeBank, stopPadSamplePlayback]);

  const flashKitImportHint = useCallback((msg: string) => {
    setKitImportHint(msg);
    if (kitImportHintTimerRef.current != null) {
      window.clearTimeout(kitImportHintTimerRef.current);
    }
    kitImportHintTimerRef.current = window.setTimeout(() => {
      setKitImportHint(null);
      kitImportHintTimerRef.current = null;
    }, 4500);
  }, []);

  /** DrumloopAI-style grid: 1/16 snap, loop on, full grid + FIT (4-bar default or 1-bar classic). */
  const applyDrumloopGridPreset = useCallback(
    (variant: BeatLabDrumloopPresetVariant = '4bar') => {
      const bars = drumloopLoopBarsForVariant(variant);
      const bpb = beatsPerBarRef.current;
      setBeatLabDrumloopPresetActive(variant);
      setLoopBars(bars);
      setPianoSnapSubdiv(BEAT_LAB_DRUMLOOP_SNAP_SUBDIV);
      setLoopOn(true);
      setLoopRangeBeats(0, bars * bpb);
      setBeatLabEditTool('draw');
      setBeatLabGridLayoutMode('full');
      if (beatLabDeckFocus !== 'sequence') setBeatLabDeckFocus('sequence');
      setBeatLabGridZoomMode('max');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => fitBeatLabGridToViewport());
      });
      flashKitImportHint(
        `Drumloop grid · 1/16 · ${bars} bar${bars === 1 ? '' : 's'} · loop on · draw tool`,
      );
    },
    [beatLabDeckFocus, fitBeatLabGridToViewport, flashKitImportHint, setLoopRangeBeats],
  );

  const canUndoBeatLabDup = useMemo(() => {
    void beatLabDupUndoRev;
    return beatLabDupUndoStackRef.current.length > 0;
  }, [beatLabDupUndoRev]);

  const undoBeatLabDup = useCallback(() => {
    const stack = beatLabDupUndoStackRef.current;
    if (!stack.length) return;
    const snap = stack[stack.length - 1]!;
    beatLabDupUndoStackRef.current = stack.slice(0, -1);
    const restored = restoreBeatLabHistorySnapshot(snap);
    setBanks(restored.banks);
    setBankPatternSlots(restored.bankPatternSlots);
    setLoopBars(restored.loopBars);
    setLoopStartBeat(restored.loopStartBeat);
    setLoopEndBeat(restored.loopEndBeat);
    setLoopOn(restored.loopOn);
    setBeatLabDupUndoRev((n) => n + 1);
    flashKitImportHint('Undid loop duplicate');
  }, [flashKitImportHint]);

  /** Append a copy of the current loop region (doubles bar count, e.g. 4 → 8). */
  const duplicateBeatLabLoop = useCallback(() => {
    if (CREATION_BACKEND_BLANK) return;
    const subdiv = Math.max(1, Math.min(DRUM_MAX_SUBDIV, Math.round(drumStepSubdivRef.current)));
    const spanCols = beatLabLoopSpanPatternCols(
      loopStartBeatRef.current,
      loopEndBeatRef.current,
      subdiv,
    );
    const currentBars = loopBarsRef.current;
    const newLoopBars = currentBars * 2;
    const bpb = beatsPerBarRef.current;
    const maxCols = Math.min(TOTAL_COLS, Math.round(newLoopBars * bpb * subdiv + 1e-6));
    if (spanCols * 2 > maxCols) {
      const maxBars = Math.max(1, Math.floor(maxCols / Math.max(1, bpb * subdiv)));
      flashKitImportHint(`Cannot duplicate — max about ${maxBars} bars at this snap`);
      return;
    }

    const bank = banksRef.current[activeBank];
    if (!bank) return;
    const result = beatLabDuplicateLoopPattern({
      drums: normalizeBankDrumPattern(bank.drums),
      midiRoll: bank.midiRoll ?? [],
      drumColOffset: drumColOffsetRef.current,
      spanCols,
      maxPatternCols: maxCols,
    });
    if (!result) {
      flashKitImportHint('Nothing to duplicate');
      return;
    }

    beatLabDupUndoStackRef.current = [
      ...beatLabDupUndoStackRef.current.slice(-(BEAT_LAB_DUP_UNDO_STACK_MAX - 1)),
      captureCurrentBeatLabSnapshot(),
    ];
    setBeatLabDupUndoRev((n) => n + 1);
    setBanks((prev) =>
      prev.map((b, i) =>
        i === activeBank
          ? {
              ...b,
              drums: result.drums,
              midiRoll: result.midiRoll,
            }
          : b,
      ),
    );
    setBankPatternSlots((prev) =>
      prev.map((slots, i) =>
        i !== activeBank
          ? slots
          : {
              ...slots,
              [patternSlot]: result.drums.map((row) => row.slice()),
            },
      ),
    );
    setLoopBars(newLoopBars);
    setLoopRangeBeats(loopStartBeatRef.current, loopStartBeatRef.current + newLoopBars * bpb);
    setLoopOn(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => fitBeatLabGridToViewport());
    });
    flashKitImportHint(
      `Duplicated ${currentBars} bar${currentBars === 1 ? '' : 's'} → ${newLoopBars} bars total`,
    );
  }, [
    activeBank,
    captureCurrentBeatLabSnapshot,
    fitBeatLabGridToViewport,
    flashKitImportHint,
    patternSlot,
    setLoopRangeBeats,
  ]);

  const applyKitPadsToActiveBank = useCallback(
    async (pads: Record<string, StoredPadSample>) => {
      const ctx = await ensureCtx();
      const store = loadPadSampleStore();
      for (let pi = 0; pi < 16; pi++) {
        stopPadSamplePlayback(pi);
        const k = padSampleKey(activeBank, pi);
        padSampleBuffersRef.current.delete(k);
        delete padSamplePlaybackOptsRef.current[k];
    delete padSampleFxRackRef.current[k];
        delete store[k];
      }
      let loaded = 0;
      const nextPresence: Record<string, boolean> = {};
      const nextRoots: Record<string, number> = {};
      const nextLabels: Record<string, string> = {};
      for (const [piStr, stored] of Object.entries(pads)) {
        const pi = Number(piStr);
        if (!Number.isFinite(pi) || pi < 0 || pi > 15 || !stored?.data) continue;
        try {
          const ab = storedToArrayBuffer(stored);
          const buf = await ctx.decodeAudioData(ab.slice(0));
          const k = padSampleKey(activeBank, pi);
          const row = JSON.parse(JSON.stringify(stored)) as typeof stored;
          padSampleBuffersRef.current.set(k, buf);
          padSamplePlaybackOptsRef.current[k] = samplerOptsFromStored(row);
          padSampleFxRackRef.current[k] = fxRackFromStored(row);
          store[k] = row;
          nextPresence[k] = true;
          const rb = row.rootBpm;
          if (typeof rb === 'number' && rb > 0) nextRoots[k] = rb;
          const lb = typeof row.label === 'string' ? row.label.trim() : '';
          if (lb) nextLabels[k] = lb;
          loaded++;
        } catch {
          /* skip corrupt pad */
        }
      }
      savePadSampleStore(store);
      setPadSamplePresence((prev) => {
        const n = { ...prev };
        for (let pi = 0; pi < 16; pi++) delete n[padSampleKey(activeBank, pi)];
        return { ...n, ...nextPresence };
      });
      setPadSampleRootBpms((prev) => {
        const n = { ...prev };
        for (let pi = 0; pi < 16; pi++) delete n[padSampleKey(activeBank, pi)];
        return { ...n, ...nextRoots };
      });
      setPadSampleLabels((prev) => {
        const n = { ...prev };
        for (let pi = 0; pi < 16; pi++) delete n[padSampleKey(activeBank, pi)];
        return { ...n, ...nextLabels };
      });
      return loaded;
    },
    [activeBank, ensureCtx, stopPadSamplePlayback],
  );

  const applySavedBeatLabKit = useCallback(
    async (kitId: string) => {
      const saved = findBeatLabSavedKit(savedKits, kitId);
      if (!saved) {
        flashKitImportHint('Saved kit not found');
        return;
      }
      const loaded = await applyKitPadsToActiveBank(saved.pads);
      setKit(saved.name);
      setKitSelectValue(`saved:${saved.id}`);
      flashKitImportHint(
        loaded > 0
          ? `Loaded "${saved.name}" ? ${loaded} pad${loaded === 1 ? '' : 's'} on bank ${BANKS[activeBank]}`
          : `Kit "${saved.name}" had no valid samples`,
      );
    },
    [activeBank, applyKitPadsToActiveBank, flashKitImportHint, savedKits],
  );

  const applySavedBeatLabSong = useCallback(
    async (songId: string) => {
      const song = findBeatLabSavedSong(savedSongs, songId);
      if (!song) {
        flashKitImportHint('Saved song not found');
        return;
      }
      const seq = song.sequence;
      setBpm(seq.bpm);
      setBpmInput(String(Math.round(seq.bpm)));
      setLoopBars(Math.max(1, seq.loopBars));
      setBeatsPerBar(MEASURES_PER_BAR);
      setPatternPlayMode(seq.patternPlayMode);
      setPianoSnapSubdiv(normalizePianoSnapSubdiv(seq.drumStepSubdiv));
      const patA = normalizeSavedDrumPattern(seq.patternA);
      const patB = normalizeSavedDrumPattern(seq.patternB);
      const activePat = seq.activePatternSlot === 'B' ? patB : patA;
      setPatternSlot(seq.activePatternSlot);
      setBankPatternSlots((prev) =>
        prev.map((slots, i) => (i !== activeBank ? slots : { A: patA, B: patB })),
      );
      setBanks((prev) =>
        prev.map((b, i) =>
          i !== activeBank ? b : { ...b, drums: activePat.map((row) => row.slice()) },
        ),
      );
      const loaded = await applyKitPadsToActiveBank(song.kit.pads);
      setKit(song.kit.label?.trim() || song.name);
      setKitSelectValue(`preset:${KITS[0]}`);
      const steps = countSequenceSteps(seq);
      flashKitImportHint(
        `Loaded "${song.name}" ? ${steps} step${steps === 1 ? '' : 's'}, ${loaded} pad${loaded === 1 ? '' : 's'} (bank ${BANKS[activeBank]}, slot ${seq.activePatternSlot})`,
      );
      setSaveSongStatus(`Loaded "${song.name}"`);
    },
    [activeBank, applyKitPadsToActiveBank, flashKitImportHint, savedSongs],
  );

  const handleKitSelectChange = useCallback(
    (value: string) => {
      setKitSelectValue(value);
      if (value.startsWith('saved:')) {
        void applySavedBeatLabKit(value.slice(6));
      } else if (value.startsWith('preset:')) {
        setKit(value.slice(7));
      }
    },
    [applySavedBeatLabKit],
  );

  const handleSaveBeatLabKit = useCallback(
    (rawName: string) => {
      const pads = captureActiveBankKitPads(activeBank);
      const n = countSavedKitPads(pads);
      if (n === 0) {
        setSaveKitStatus('Load at least one pad sample on this bank first');
        flashKitImportHint('Nothing to save ? load or record sounds on the pads first');
        return;
      }
      const { kits, kit: saved } = upsertBeatLabSavedKit(savedKits, rawName, pads);
      setSavedKits(kits);
      setKit(saved.name);
      setKitSelectValue(`saved:${saved.id}`);
      setSaveKitStatus(`Saved ${n} pad${n === 1 ? '' : 's'}`);
      flashKitImportHint(`Saved kit "${saved.name}" (${n} pads)`);
    },
    [activeBank, flashKitImportHint, savedKits],
  );

  const handleRenameSavedBeatLabKit = useCallback((id: string, name: string) => {
    const next = renameBeatLabSavedKit(savedKits, id, name);
    setSavedKits(next);
    if (kitSelectValue === `saved:${id}`) {
      const row = findBeatLabSavedKit(next, id);
      if (row) setKit(row.name);
    }
    flashKitImportHint('Kit renamed');
  }, [flashKitImportHint, kitSelectValue, savedKits]);

  const handleDeleteSavedBeatLabKit = useCallback(
    (id: string) => {
      const row = findBeatLabSavedKit(savedKits, id);
      if (!row) return;
      if (!window.confirm(`Delete saved kit "${row.name}"?`)) return;
      const next = deleteBeatLabSavedKit(savedKits, id);
      setSavedKits(next);
      if (kitSelectValue === `saved:${id}`) {
        setKitSelectValue(`preset:${KITS[0]}`);
        setKit(KITS[0]);
      }
      flashKitImportHint(`Deleted "${row.name}"`);
    },
    [flashKitImportHint, kitSelectValue, savedKits],
  );

  const handleSaveBeatLabSong = useCallback(
    (rawName: string) => {
      const { kit: kitSnapshot, sequence } = captureBeatLabSongSnapshot({
        bankIndex: activeBank,
        bankPatternSlots,
        patternSlot,
        bpm,
        drumStepSubdiv,
        loopBars,
        beatsPerBar,
        patternPlayMode,
        kitLabel: kit,
      });
      const padCount = countSavedKitPads(kitSnapshot.pads);
      const stepCount = countSequenceSteps(sequence);
      if (padCount === 0 && stepCount === 0) {
        setSaveSongStatus('Add pattern steps or load pad samples first');
        flashKitImportHint('Nothing to save ? paint the grid or load kit sounds');
        return;
      }
      const { songs, song } = upsertBeatLabSavedSong(savedSongs, rawName, kitSnapshot, sequence);
      setSavedSongs(songs);
      setSaveSongStatus(
        `Saved ${stepCount} step${stepCount === 1 ? '' : 's'} + ${padCount} pad${padCount === 1 ? '' : 's'}`,
      );
      flashKitImportHint(`Saved song "${song.name}"`);
    },
    [
      activeBank,
      bankPatternSlots,
      bpm,
      beatsPerBar,
      drumStepSubdiv,
      flashKitImportHint,
      kit,
      loopBars,
      patternPlayMode,
      patternSlot,
      savedSongs,
    ],
  );

  const handleRenameSavedBeatLabSong = useCallback(
    (id: string, name: string) => {
      const next = renameBeatLabSavedSong(savedSongs, id, name);
      setSavedSongs(next);
      flashKitImportHint('Song renamed');
    },
    [flashKitImportHint, savedSongs],
  );

  const handleDeleteSavedBeatLabSong = useCallback(
    (id: string) => {
      const row = findBeatLabSavedSong(savedSongs, id);
      if (!row) return;
      if (!window.confirm(`Delete saved song "${row.name}"?`)) return;
      const next = deleteBeatLabSavedSong(savedSongs, id);
      setSavedSongs(next);
      flashKitImportHint(`Deleted "${row.name}"`);
    },
    [flashKitImportHint, savedSongs],
  );

  const ingestPadSampleToBank = useCallback(
    async (
      file: File,
      pad: number,
      bank: number,
      label?: string,
      samplerOpts = defaultPadSamplerPlaybackOpts(),
    ) => {
      const ctx = getOrCreateAudioContext();
      const storedBase = await fileToStoredPadSample(file);
      const stored = { ...storedBase, rootBpm: bpm };
      const display = (label ?? stored.label ?? '').trim();
      if (display) stored.label = display;
      const ab = storedToArrayBuffer(stored);
      const buffer = await ctx.decodeAudioData(ab.slice(0));
      const k = padSampleKey(bank, pad);
      padSampleBuffersRef.current.set(k, buffer);
      setPadSamplePresence((prev) => ({ ...prev, [k]: true }));
      setPadSampleRootBpms((prev) => ({ ...prev, [k]: bpm }));
      if (display) setPadSampleLabels((prev) => ({ ...prev, [k]: display }));
      else
        setPadSampleLabels((prev) => {
          const n = { ...prev };
          delete n[k];
          return n;
        });
      const store = loadPadSampleStore();
      store[k] = stored;
      writeSamplerOptsToStored(stored, samplerOpts);
      writeFxRackToStored(stored, defaultPadSamplerFxRack());
      savePadSampleStore(store);
      padSamplePlaybackOptsRef.current[k] = samplerOptsFromStored(stored);
      padSampleFxRackRef.current[k] = fxRackFromStored(stored);
    },
    [bpm, getOrCreateAudioContext],
  );

  const ingestPadSample = useCallback(
    async (file: File, pad: number) => {
      await ingestPadSampleToBank(file, pad, activeBank);
    },
    [activeBank, ingestPadSampleToBank],
  );

  const beginLoadPadSample = useCallback((padIndex: number) => {
    pendingPadSampleRef.current = padIndex;
    padSampleFileInputRef.current?.click();
  }, []);

  const beginImportPadFolder = useCallback(() => {
    folderImportBrassRoomRef.current = false;
    padSampleFolderInputRef.current?.click();
  }, []);

  const beginImportBrassRoomFolder = useCallback(() => {
    folderImportBrassRoomRef.current = true;
    padSampleFolderInputRef.current?.click();
  }, []);

  const beginOpenTrapKitBrowser = useCallback(() => {
    trapKitFolderInputRef.current?.click();
  }, []);

  const handleTrapKitFolder = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    e.target.value = '';
    if (!list?.length) return;
    const files = Array.from(list).filter((f) => /\.(wav|mp3|ogg|flac|m4a|aac|aif|aiff)$/i.test(f.name));
    if (files.length === 0) {
      flashKitImportHint('No audio in that folder');
      return;
    }
    setTrapKitBrowserFiles(files);
    setTrapKitBrowserOpen(true);
    setActiveBank(BRASS_ROOM_BANK_INDEX);
    flashKitImportHint(`Kit browser ? ${files.length} samples (pick 808s, claps, kicks per pad)`);
  }, [flashKitImportHint]);

  const loadTrapKitSampleToPad = useCallback(
    async (file: File, pad: number, label: string) => {
      try {
        await ingestPadSampleToBank(file, pad, BRASS_ROOM_BANK_INDEX, label, trapPadSamplerOpts(pad));
        flashKitImportHint(`Pad ${pad + 1}: ${label}`);
        playPadSoundRef.current(pad, PAD_VEL[pad] ?? 100);
      } catch (err) {
        console.debug('Kit browser load failed:', err);
        flashKitImportHint('Could not load that sample');
      }
    },
    [ingestPadSampleToBank, flashKitImportHint],
  );

  const loadSoundFamilySample = useCallback(
    async (args: { familyId: string; pad: number; label: string; relFile: string }) => {
      const { familyId, pad, label, relFile } = args;
      const bank = activeBankRef.current;
      try {
        const ctx = getOrCreateAudioContext();
        const buf = await fetchAndDecodeFamilySample(relFile, ctx);
        const stored = audioBufferToStoredKitSample(buf, label, bpm);
        const k = padSampleKey(bank, pad);
        padSampleBuffersRef.current.set(k, buf);
        const opts = samplerOptsForFamily(familyId, pad);
        const store = loadPadSampleStore();
        writeSamplerOptsToStored(stored, opts);
        writeFxRackToStored(stored, defaultPadSamplerFxRack());
        store[k] = stored;
        savePadSampleStore(store);
        padSamplePlaybackOptsRef.current[k] = samplerOptsFromStored(stored);
        padSampleFxRackRef.current[k] = fxRackFromStored(stored);
        setPadSamplePresence((prev) => ({ ...prev, [k]: true }));
        setPadSampleRootBpms((prev) => ({ ...prev, [k]: bpm }));
        setPadSampleLabels((prev) => ({ ...prev, [k]: label }));
        setGeniusSamplerTargetPad(pad);
        flashKitImportHint(`${label} → ${PAD_NAMES[pad] ?? `pad ${pad + 1}`} (bank ${BANKS[bank]})`);
        playPadSoundRef.current(pad, PAD_VEL[pad] ?? 100);
      } catch (err) {
        console.debug('Sound family load failed:', err);
        flashKitImportHint('Built-in sound not found');
      }
    },
    [bpm, flashKitImportHint, getOrCreateAudioContext],
  );

  const loadSoundFamilyFullBank = useCallback(
    async (primaryFamily: SoundFamily) => {
      void primaryFamily;
      setBrassRoomLoading(true);
      try {
        const catalog = await fetchSoundFamiliesCatalog();
        if (!catalog) {
          flashKitImportHint('Built-in drum library unavailable');
          return;
        }
        const ctx = getOrCreateAudioContext();
        let ok = 0;
        for (const family of catalog.families) {
          const sample = family.samples[0];
          if (!sample) continue;
          try {
            const buf = await fetchAndDecodeFamilySample(sample.file, ctx);
            const pad = family.defaultPad;
            const title = soundFamilySampleDisplayTitle(family.id, 0);
            const label = familyInstrumentLabel(pad, title);
            const stored = audioBufferToStoredKitSample(buf, label, bpm);
            const k = padSampleKey(BRASS_ROOM_BANK_INDEX, pad);
            padSampleBuffersRef.current.set(k, buf);
            const opts = samplerOptsForFamily(family.id, pad);
            writeSamplerOptsToStored(stored, opts);
            writeFxRackToStored(stored, defaultPadSamplerFxRack());
            const store = loadPadSampleStore();
            store[k] = stored;
            savePadSampleStore(store);
            padSamplePlaybackOptsRef.current[k] = samplerOptsFromStored(stored);
            padSampleFxRackRef.current[k] = fxRackFromStored(stored);
            setPadSamplePresence((prev) => ({ ...prev, [k]: true }));
            setPadSampleRootBpms((prev) => ({ ...prev, [k]: bpm }));
            setPadSampleLabels((prev) => ({ ...prev, [k]: label }));
            ok++;
          } catch {
            /* skip */
          }
        }
        setActiveBank(BRASS_ROOM_BANK_INDEX);
        flashKitImportHint(`Sound families ? ${ok} pads on bank ${BANKS[BRASS_ROOM_BANK_INDEX]} (808 main)`);
      } finally {
        setBrassRoomLoading(false);
      }
    },
    [bpm, flashKitImportHint, getOrCreateAudioContext],
  );

  const applyPadsToBank = useCallback(
    async (
      bank: number,
      items: ReadonlyArray<{ pad: number; label: string; stored: StoredPadSample }>,
    ) => {
      const ctx = getOrCreateAudioContext();
      const store = loadPadSampleStore();
      for (const { pad, label, stored } of items) {
        const k = padSampleKey(bank, pad);
        const row = { ...stored, label, rootBpm: bpm };
        const ab = storedToArrayBuffer(row);
        const decoded = await ctx.decodeAudioData(ab.slice(0));
        padSampleBuffersRef.current.set(k, decoded);
        const opts = trapPadSamplerOpts(pad);
        writeSamplerOptsToStored(row, opts);
        writeFxRackToStored(row, defaultPadSamplerFxRack());
        store[k] = row;
        padSamplePlaybackOptsRef.current[k] = samplerOptsFromStored(row);
        padSampleFxRackRef.current[k] = fxRackFromStored(row);
        setPadSamplePresence((prev) => ({ ...prev, [k]: true }));
        setPadSampleRootBpms((prev) => ({ ...prev, [k]: bpm }));
        setPadSampleLabels((prev) => ({ ...prev, [k]: label }));
      }
      savePadSampleStore(store);
      setActiveBank(bank);
    },
    [bpm, getOrCreateAudioContext],
  );

  const loadBrassRoomFromProjectFolder = useCallback(async () => {
    setBrassRoomLoading(true);
    flashKitImportHint(`Loading ${BRASS_ROOM_KIT_DISPLAY_NAME} from project folder?`);
    try {
      const ctx = getOrCreateAudioContext();
      const { bankIndex, pads, kitName } = await loadBrassRoomBankFromPublic(ctx);
      if (pads.length === 0) {
        flashKitImportHint(
          `Use Sound Families in Beat Lab, or copy WAVs to public/samples/brass-room/`,
        );
        return;
      }
      await applyPadsToBank(
        bankIndex,
        pads.map((p) => ({ pad: p.pad, label: p.label, stored: p.stored })),
      );
      flashKitImportHint(
        `${kitName} ? ${pads.length} sounds on bank ${BANKS[bankIndex]} (renamed instruments)`,
      );
    } catch (err) {
      console.debug('Built-in kit folder load failed:', err);
      flashKitImportHint('Use Sound Families ? built-in drums are already in the app');
    } finally {
      setBrassRoomLoading(false);
    }
  }, [applyPadsToBank, flashKitImportHint]);

  const handlePadSampleFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      const padRaw = pendingPadSampleRef.current;
      pendingPadSampleRef.current = null;
      if (padRaw == null || !file) return;
      const pad = Math.max(0, Math.min(15, Math.floor(Number(padRaw))));
      try {
        await ingestPadSample(file, pad);
      } catch (err) {
        console.debug('Pad sample load failed:', err);
        flashKitImportHint('Could not load that file ? try .wav or .mp3');
      }
    },
    [ingestPadSample, flashKitImportHint],
  );

  const handlePadSampleFolder = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const list = e.target.files;
      e.target.value = '';
      const brassRoom = folderImportBrassRoomRef.current;
      folderImportBrassRoomRef.current = false;
      if (!list?.length) return;
      const files = Array.from(list);
      const assignments = brassRoom
        ? assignTrapDrumFolderToPads(files, BRASS_ROOM_KIT_DISPLAY_NAME)
        : assignTrapDrumFolderToPads(files, `Bank ${BANKS[activeBank]}`);
      if (assignments.length === 0) {
        flashKitImportHint('No audio files in folder (.wav, .mp3, .ogg, ?)');
        return;
      }
      const bank = brassRoom ? BRASS_ROOM_BANK_INDEX : activeBank;
      if (brassRoom) setBrassRoomLoading(true);
      let ok = 0;
      try {
        for (const { file, pad, label } of assignments) {
          try {
            await ingestPadSampleToBank(file, pad, bank, label, trapPadSamplerOpts(pad));
            ok++;
          } catch (err) {
            console.debug('Folder import skip:', file.name, err);
          }
        }
      } finally {
        if (brassRoom) setBrassRoomLoading(false);
      }
      if (ok === 0) {
        flashKitImportHint('Import failed ? files too large or unsupported format');
        return;
      }
      if (brassRoom) setActiveBank(BRASS_ROOM_BANK_INDEX);
      flashKitImportHint(
        brassRoom
          ? `${BRASS_ROOM_KIT_DISPLAY_NAME} ? ${ok} sounds on bank ${BANKS[bank]} (808/clap/hits renamed)`
          : `Loaded ${ok} sample${ok === 1 ? '' : 's'} on bank ${BANKS[bank]} (renamed)`,
      );
    },
    [activeBank, ingestPadSampleToBank, flashKitImportHint],
  );

  const commitPadSamplerPlaybackOpts = useCallback((padIndex: number, o: PadSamplerPlaybackOpts) => {
    const k = padSampleKey(activeBank, padIndex);
    if (!padSampleBuffersRef.current.get(k)) return;
    const store = loadPadSampleStore();
    const row = store[k];
    if (!row) return;
    writeSamplerOptsToStored(row, o);
    savePadSampleStore(store);
    padSamplePlaybackOptsRef.current[k] = samplerOptsFromStored(row);
  }, [activeBank]);

  const getPadSamplerPlaybackOpts = useCallback((padIndex: number) => {
    const k = padSampleKey(activeBank, padIndex);
    return padSamplePlaybackOptsRef.current[k] ?? defaultPadSamplerPlaybackOpts();
  }, [activeBank]);

  /** Preview sample edit sliders without committing (restores saved opts after trigger). */
  const previewSamplerFxDraft = useCallback((padIndex: number, o: PadSamplerPlaybackOpts) => {
    const k = padSampleKey(activeBank, padIndex);
    if (!padSampleBuffersRef.current.get(k)) return;
    const saved = padSamplePlaybackOptsRef.current[k] ?? defaultPadSamplerPlaybackOpts();
    padSamplePlaybackOptsRef.current[k] = { ...o };
    playPadSoundRef.current(padIndex, PAD_VEL[padIndex] ?? 90);
    padSamplePlaybackOptsRef.current[k] = saved;
  }, [activeBank]);

  const applyPadFxRackLive = useCallback((padIndex: number, rack: PadSamplerFxRack) => {
    const k = padSampleKey(activeBank, padIndex);
    if (!padSampleBuffersRef.current.get(k)) return;
    padSampleFxRackRef.current[k] = clonePadSamplerFxRack(rack);
  }, [activeBank]);

  const commitPadSamplerFxRack = useCallback((padIndex: number, rack: PadSamplerFxRack) => {
    const k = padSampleKey(activeBank, padIndex);
    if (!padSampleBuffersRef.current.get(k)) return;
    const store = loadPadSampleStore();
    const row = store[k];
    if (!row) return;
    writeFxRackToStored(row, rack);
    savePadSampleStore(store);
    padSampleFxRackRef.current[k] = clonePadSamplerFxRack(rack);
  }, [activeBank]);

  const getPadSamplerFxRack = useCallback((padIndex: number) => {
    const k = padSampleKey(activeBank, padIndex);
    return padSampleFxRackRef.current[k] ?? defaultPadSamplerFxRack();
  }, [activeBank]);

  const previewPadSamplerFxRack = useCallback((padIndex: number, rack: PadSamplerFxRack) => {
    const k = padSampleKey(activeBank, padIndex);
    if (!padSampleBuffersRef.current.get(k)) return;
    const saved = padSampleFxRackRef.current[k] ?? defaultPadSamplerFxRack();
    padSampleFxRackRef.current[k] = clonePadSamplerFxRack(rack);
    playPadSoundRef.current(padIndex, PAD_VEL[padIndex] ?? 90);
    padSampleFxRackRef.current[k] = saved;
  }, [activeBank]);

  /** Preview with the SRC BPM typed in the popover (restores committed root after trigger). */
  const previewSamplerRootBpmDraft = useCallback((padIndex: number, raw: string) => {
    const k = padSampleKey(activeBank, padIndex);
    if (!padSampleBuffersRef.current.get(k)) return;
    const t = raw.trim();
    let previewRate: number | undefined;
    if (t !== '') {
      const parsed = parseFloat(t);
      if (!Number.isFinite(parsed)) return;
      const root = Math.round(Math.max(40, Math.min(320, parsed)));
      previewRate = Math.min(4, Math.max(0.25, bpmRef.current / root));
    }
    playPadSoundRef.current(padIndex, PAD_VEL[padIndex] ?? 90, undefined, 0, {
      tempoSyncRate: previewRate,
    });
  }, [activeBank]);

  /** Persist a Chord Builder / AI Pattern bounce into a Beat Lab sampler
   *  pad. Shared by both embedded modules so the on-pad behavior is
   *  identical (decode, label, root-BPM, persistence). Pattern mirrors
   *  `handlePadSampleFile` (uploads) and `applyDrumKitGenSinglePad`
   *  (kit gen). Stable identity via useCallback so the embedded screens
   *  don't see their `onExportToPad` prop change every parent render. */
  const onPadBounceExport = useCallback(
    async (args: { padIndex: number; wavBytes: Uint8Array; label: string; rootBpm: number }) => {
      const { padIndex, wavBytes, label, rootBpm } = args;
      if (padIndex < 0 || padIndex > 15) return;
      try {
        const data = uint8ArrayToBase64(wavBytes);
        const stored = { mime: 'audio/wav', data, label, rootBpm };
        const ctx = getOrCreateAudioContext();
        const ab = storedToArrayBuffer(stored);
        const buffer = await ctx.decodeAudioData(ab.slice(0));
        const k = padSampleKey(activeBank, padIndex);
        padSampleBuffersRef.current.set(k, buffer);
        setPadSamplePresence((prev) => ({ ...prev, [k]: true }));
        setPadSampleRootBpms((prev) => ({ ...prev, [k]: rootBpm }));
        setPadSampleLabels((prev) => ({ ...prev, [k]: label }));
        const store = loadPadSampleStore();
        store[k] = stored;
        writeSamplerOptsToStored(stored, defaultPadSamplerPlaybackOpts());
        writeFxRackToStored(stored, defaultPadSamplerFxRack());
        savePadSampleStore(store);
        padSamplePlaybackOptsRef.current[k] = defaultPadSamplerPlaybackOpts();
        padSampleFxRackRef.current[k] = defaultPadSamplerFxRack();
      } catch (err) {
        console.debug('Pad bounce export failed:', err);
      }
    },
    [activeBank, getOrCreateAudioContext],
  );

  /** Chord Builder ? Beat Lab SYNTH: merge MIDI into channels 17?32 and open SYNTH view. */
  const onSendChordMidiToBeatLabSynth = useCallback(
    (args: {
      sections: ReadonlyArray<ChordBuilderBeatLabImportSection>;
      bpm: number;
      label: string;
    }) => {
      if (CREATION_BACKEND_BLANK) return;
      const subdiv = Math.max(
        1,
        Math.min(DRUM_MAX_SUBDIV, Math.round(drumStepSubdivRef.current)),
      );
      const bpb = Math.max(1, Math.round(beatsPerBarRef.current));
      let maxQuarterEnd = 0;
      let colsPerBarChord = MEASURES_PER_BAR;
      for (const sec of args.sections) {
        maxQuarterEnd = Math.max(maxQuarterEnd, sec.totalQuarterCols);
        colsPerBarChord = Math.max(1, Math.round(sec.colsPerBar));
      }
      const barsNeeded = Math.max(1, Math.ceil(maxQuarterEnd / colsPerBarChord));
      const patternColsForImport = beatLabPatternColsForLoop(
        barsNeeded,
        subdiv,
        bpb,
        TOTAL_COLS,
      );
      setLoopStartBeat(0);
      setLoopEndBeat(barsNeeded * bpb);
      setLoopBars(barsNeeded);
      const imported = chordBuilderSongRollToBeatLabRoll(args.sections, {
        stepSubdiv: subdiv,
        patternCols: patternColsForImport,
        beatsPerBar: bpb,
        targetLane: BEAT_LAB_MELODIC_LANE_START,
      });
      if (imported.length === 0) return;
      const kept = currentMidiRoll.filter((n) => n.lane < BEAT_LAB_MELODIC_LANE_START);
      patchActiveBankMidiRollWithUndo([...kept, ...imported]);
      setBeatLabDeckFocus('synth');
      goToCreationSub('beat-lab');
      setSelectedBeatLabLane(BEAT_LAB_MELODIC_LANE_START);
    },
    [
      currentMidiRoll,
      goToCreationSub,
      patchActiveBankMidiRollWithUndo,
      setBeatLabDeckFocus,
    ],
  );

  const applyDrumKitGenSinglePad = useCallback(
    async (padIndex: number) => {
      const ctx = await ensureCtx();
      setDrumKitGenBusy(true);
      try {
        const pi = Math.max(0, Math.min(15, Math.floor(padIndex)));
        const sr = ctx.sampleRate;
        const seed = (Date.now() ^ (activeBank * 31 + pi) * 0x85ebca6b) >>> 0;
        const buf = synthesizeKitPadBuffer(sr, pi, drumKitGenStyle, seed);
        const label = `${PAD_NAMES[pi]} (kit gen)`;
        const stored = audioBufferToStoredKitSample(buf, label, bpm);
        const ab = storedToArrayBuffer(stored);
        const buffer = await ctx.decodeAudioData(ab.slice(0));
        const k = padSampleKey(activeBank, pi);
        padSampleBuffersRef.current.set(k, buffer);
        setPadSamplePresence((prev) => ({ ...prev, [k]: true }));
        setPadSampleRootBpms((prev) => ({ ...prev, [k]: bpm }));
        setPadSampleLabels((prev) => ({ ...prev, [k]: label }));
        const store = loadPadSampleStore();
        store[k] = stored;
        writeSamplerOptsToStored(stored, defaultPadSamplerPlaybackOpts());
        writeFxRackToStored(stored, defaultPadSamplerFxRack());
        savePadSampleStore(store);
        padSamplePlaybackOptsRef.current[k] = defaultPadSamplerPlaybackOpts();
        padSampleFxRackRef.current[k] = defaultPadSamplerFxRack();
      } catch (err) {
        console.debug('Drum kit generator (single pad) failed:', err);
      } finally {
        setDrumKitGenBusy(false);
      }
    },
    [activeBank, bpm, drumKitGenStyle, ensureCtx],
  );

  const applyBeatLabProducerKit = useCallback(async () => {
    const meta = beatLabProducerKitMeta(producerKitId);
    if (!meta) return;
    const ctx = await ensureCtx();
    setProducerKitLoading(true);
    flashKitImportHint(`Loading ${meta.title}?`);
    try {
      const pads = await loadBeatLabProducerKitPads(producerKitId, ctx);
      if (pads.length === 0) {
        flashKitImportHint('Kit download failed ? check your connection');
        return;
      }
      for (const { pad, buffer, label, sampler } of pads) {
        const stored = audioBufferToStoredKitSample(buffer, label, bpm);
        const ab = storedToArrayBuffer(stored);
        const decoded = await ctx.decodeAudioData(ab.slice(0));
        const k = padSampleKey(activeBank, pad);
        padSampleBuffersRef.current.set(k, decoded);
        setPadSamplePresence((prev) => ({ ...prev, [k]: true }));
        setPadSampleRootBpms((prev) => ({ ...prev, [k]: bpm }));
        setPadSampleLabels((prev) => ({ ...prev, [k]: label }));
        const store = loadPadSampleStore();
        store[k] = stored;
        writeSamplerOptsToStored(store[k], sampler);
        writeFxRackToStored(store[k], defaultPadSamplerFxRack());
        savePadSampleStore(store);
        padSamplePlaybackOptsRef.current[k] = samplerOptsFromStored(store[k]);
        padSampleFxRackRef.current[k] = fxRackFromStored(store[k]);
      }
      flashKitImportHint(
        `${meta.tribute} ? ${pads.length} pads on bank ${activeBank + 1} (loud 808s)`,
      );
    } catch (err) {
      console.debug('Producer kit load failed:', err);
      flashKitImportHint('Could not load crew kit');
    } finally {
      setProducerKitLoading(false);
    }
  }, [activeBank, bpm, ensureCtx, flashKitImportHint, producerKitId]);

  const applyDrumKitGenFullKit = useCallback(async () => {
    const ctx = await ensureCtx();
    setDrumKitGenBusy(true);
    try {
      const sr = ctx.sampleRate;
      const seed = (Date.now() ^ (activeBank + 1) * 0x1a2b3c4d) >>> 0;
      for (let pi = 0; pi < 16; pi++) {
        const buf = synthesizeKitPadBuffer(sr, pi, drumKitGenStyle, seed);
        const label = `${PAD_NAMES[pi]} (kit gen)`;
        const stored = audioBufferToStoredKitSample(buf, label, bpm);
        const ab = storedToArrayBuffer(stored);
        const buffer = await ctx.decodeAudioData(ab.slice(0));
        const k = padSampleKey(activeBank, pi);
        padSampleBuffersRef.current.set(k, buffer);
        setPadSamplePresence((prev) => ({ ...prev, [k]: true }));
        setPadSampleRootBpms((prev) => ({ ...prev, [k]: bpm }));
        setPadSampleLabels((prev) => ({ ...prev, [k]: label }));
        const store = loadPadSampleStore();
        store[k] = stored;
        writeSamplerOptsToStored(stored, defaultPadSamplerPlaybackOpts());
        savePadSampleStore(store);
        padSamplePlaybackOptsRef.current[k] = defaultPadSamplerPlaybackOpts();
      }
    } catch (err) {
      console.debug('Drum kit generator (full kit) failed:', err);
    } finally {
      setDrumKitGenBusy(false);
    }
  }, [activeBank, bpm, drumKitGenStyle, ensureCtx]);

  const applyDrumKitGenPattern = useCallback(() => {
    const seed = (Date.now() ^ (activeBank + 3) * 0x4d5e6f70) >>> 0;
    const q = Math.max(2, Math.min(16, Math.round(beatsPerBar)));
    const pat = buildKitGroovePattern({
      totalCols: TOTAL_COLS,
      patternCols: patternColsDrums,
      subdiv: drumStepSubdiv,
      qpb: q,
      style: drumKitGenStyle,
      seed,
    });
    setBankPatternSlots((prev) =>
      prev.map((slots, i) =>
        i !== activeBank ? slots : { ...slots, [patternSlot]: pat.map((r) => r.slice()) },
      ),
    );
    setBanks((prev) =>
      prev.map((b, i) => (i !== activeBank ? b : { ...b, drums: pat.map((row) => row.slice()) })),
    );
    goToCreationSub('beat-lab');
  }, [activeBank, beatsPerBar, drumKitGenStyle, drumStepSubdiv, patternColsDrums, patternSlot, goToCreationSub]);

  const [patternBankHint, setPatternBankHint] = useState<string | null>(null);

  const applyBeatLabPatternPreset = useCallback(
    (preset: PatternPreset) => {
      const pat = presetToBeatLabDrums(preset, { totalCols: patternColsDrums }).map((r) => r.slice());
      setBanks((prev) =>
        prev.map((b, i) => (i === activeBank ? { ...b, drums: pat.map((row) => row.slice()) } : b)),
      );
      setBankPatternSlots((prev) =>
        prev.map((slots, i) =>
          i !== activeBank ? slots : { ...slots, [patternSlot]: pat.map((row) => row.slice()) },
        ),
      );
      setPatternBankHint(`Loaded ?${preset.name}? ? bank ${BANKS[activeBank]} ? slot ${patternSlot}`);
      goToCreationSub('beat-lab');
    },
    [activeBank, patternColsDrums, patternSlot, goToCreationSub],
  );

  useEffect(() => {
    if (!patternBankHint) return;
    const t = window.setTimeout(() => setPatternBankHint(null), 4000);
    return () => window.clearTimeout(t);
  }, [patternBankHint]);

  const applyDrumKitGenBoth = useCallback(async () => {
    await applyDrumKitGenFullKit();
    applyDrumKitGenPattern();
    setDrumKitGenOpen(false);
  }, [applyDrumKitGenFullKit, applyDrumKitGenPattern]);

  const commitPadSampleLabel = useCallback((padIndex: number, raw: string) => {
    const k = padSampleKey(activeBank, padIndex);
    if (!padSampleBuffersRef.current.get(k)) return;
    const store = loadPadSampleStore();
    const row = store[k];
    if (!row) return;
    const t = raw.trim();
    if (t) row.label = t;
    else delete row.label;
    savePadSampleStore(store);
    if (t) setPadSampleLabels((prev) => ({ ...prev, [k]: t }));
    else {
      setPadSampleLabels((prev) => {
        const n = { ...prev };
        delete n[k];
        return n;
      });
    }
  }, [activeBank]);

  const commitPadSampleRootBpm = useCallback(
    (padIndex: number, raw: string) => {
      const k = padSampleKey(activeBank, padIndex);
      if (!padSamplePresence[k]) return;
      const store = loadPadSampleStore();
      const row = store[k];
      if (!row) return;
      const t = raw.trim();
      if (t === '') {
        delete row.rootBpm;
        savePadSampleStore(store);
        setPadSampleRootBpms((prev) => {
          const n = { ...prev };
          delete n[k];
          return n;
        });
        return;
      }
      const parsed = parseFloat(t);
      if (!Number.isFinite(parsed)) return;
      const v = Math.round(Math.max(40, Math.min(320, parsed)));
      row.rootBpm = v;
      savePadSampleStore(store);
      setPadSampleRootBpms((prev) => ({ ...prev, [k]: v }));
    },
    [activeBank, padSamplePresence],
  );

  const hasPadSampleForActiveBank = useCallback(
    (padIndex: number) => {
      const k = padSampleKey(activeBank, padIndex);
      return !!(padSamplePresence[k] || padSampleBuffersRef.current.get(k));
    },
    [padSamplePresence, activeBank],
  );

  function toggleDrum(pad: number, col: number) {
    const mutate = (drums: DrumPattern) =>
      drums.map((row, r) => row.map((v, c) => (r === pad && c === col ? !v : v)));
    setBanks((prev) =>
      prev.map((b, i) =>
        i !== activeBank ? b : { ...b, drums: mutate(normalizeBankDrumPattern(b.drums)) },
      ),
    );
    setBankPatternSlots((prev) =>
      prev.map((slots, i) =>
        i !== activeBank
          ? slots
          : { ...slots, [patternSlot]: mutate(normalizeBankDrumPattern(slots[patternSlot])) },
      ),
    );
  }

  function setDrumStep(pad: number, col: number, enabled: boolean, slot: PatternSlot = patternSlot) {
    const mutate = (drums: DrumPattern) =>
      drums.map((row, r) => row.map((v, c) => (r === pad && c === col ? enabled : v)));
    setBanks((prev) =>
      prev.map((b, i) =>
        i !== activeBank ? b : { ...b, drums: mutate(normalizeBankDrumPattern(b.drums)) },
      ),
    );
    setBankPatternSlots((prev) =>
      prev.map((slots, i) =>
        i !== activeBank
          ? slots
          : { ...slots, [slot]: mutate(normalizeBankDrumPattern(slots[slot])) },
      ),
    );
  }

  const auditionDrumLane = useCallback((padIndex: number) => {
    setSelectedBeatLabLane(padIndex);
    playPadSoundRef.current(padIndex, PAD_VEL[padIndex] ?? 90);
  }, []);

  const clearDrumLane = useCallback(
    (padIndex: number) => {
      if (CREATION_BACKEND_BLANK) return;
      wipeBeatLabDrumPattern(padIndex);
    },
    [wipeBeatLabDrumPattern],
  );

  clearDrumLaneRef.current = clearDrumLane;

  /** Genius-style Clear — full drum grid for current bank + pattern slot. */
  const clearCurrentPatternDrums = useCallback(() => {
    if (CREATION_BACKEND_BLANK) return;
    if (!confirm(`Clear all drum steps for bank ${BANKS[activeBank]}, slot ${patternSlot}?`)) return;
    wipeBeatLabDrumPattern();
  }, [activeBank, patternSlot, wipeBeatLabDrumPattern]);

  clearPatternDrumsRef.current = clearCurrentPatternDrums;

  const copyPatternAToB = useCallback(() => {
    setBankPatternSlots((prev) =>
      prev.map((slots, i) => {
        if (i !== activeBank) return slots;
        const nextB = normalizeBankDrumPattern(slots.A).map((r) => r.slice());
        if (patternSlot === 'B') {
          setBanks((bprev) =>
            bprev.map((b, bi) => (bi !== activeBank ? b : { ...b, drums: nextB.map((r) => r.slice()) })),
          );
        }
        return { ...slots, B: nextB };
      }),
    );
  }, [activeBank, patternSlot]);

  const swapPatternAB = useCallback(() => {
    setBankPatternSlots((prev) =>
      prev.map((slots, i) => {
        if (i !== activeBank) return slots;
        const nextA = normalizeBankDrumPattern(slots.B).map((r) => r.slice());
        const nextB = normalizeBankDrumPattern(slots.A).map((r) => r.slice());
        const activePat = patternSlot === 'B' ? nextB : nextA;
        setBanks((bprev) =>
          bprev.map((b, bi) =>
            bi !== activeBank ? b : { ...b, drums: activePat.map((r) => r.slice()) },
          ),
        );
        return { A: nextA, B: nextB };
      }),
    );
  }, [activeBank, patternSlot]);
  function toggleNote(row: number, col: number) {
    if (sharedNotes.some(n => n.row === row && n.col === col)) {
      removeSharedNote(row, col);
    } else {
      addSharedNote(row, col);
    }
  }

  // Piano note synthesis ? use shared MasterClock AudioContext (same graph as drums/transport).
  const playingOscsRef = useRef(new Map<string, { osc: OscillatorNode; gain: GainNode }>());

  const playPianoNote = useCallback((noteRow: number, duration = 0.5) => {
    try {
      const ctx = getOrCreateAudioContext();
      if (ctx.state === 'suspended') void ctx.resume();
      const now = ctx.currentTime;
      const midiNote = noteNameToMidi(displayNotes[noteRow] ?? NOTES[noteRow]);
      const freq = midiNoteToFreq(midiNote);
      const key = `${midiNote}`;
      
      // Create oscillator + gain
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      const master = (window as unknown as { __daMusicMasterGain?: GainNode | null })
        .__daMusicMasterGain;
      const dest =
        master && master.context === ctx ? master : ctx.destination;
      gain.connect(dest);
      
      // Instrument selection
      switch (rollInstr) {
        case 0: // Piano
          osc.type = 'sine';
          gain.gain.setValueAtTime(0.15, now);
          gain.gain.exponentialRampToValueAtTime(0.02, now + duration);
          break;
        case 1: // Synth
          osc.type = 'triangle';
          gain.gain.setValueAtTime(0.12, now);
          gain.gain.linearRampToValueAtTime(0.1, now + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
          break;
        case 2: // Bass
          osc.type = 'sawtooth';
          gain.gain.setValueAtTime(0.15, now);
          gain.gain.exponentialRampToValueAtTime(0.03, now + duration);
          break;
        case 3: // Lead
          osc.type = 'square';
          gain.gain.setValueAtTime(0.10, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + duration * 0.8);
          break;
      }
      
      osc.frequency.setValueAtTime(freq, now);
      osc.start(now);
      osc.stop(now + duration);
      
      if (playingOscsRef.current) {
        playingOscsRef.current.set(key, { osc, gain });
        setTimeout(() => playingOscsRef.current?.delete(key), duration * 1000);
      }
    } catch (e) {
      console.debug('Piano synth error:', e);
    }
  }, [rollInstr, getOrCreateAudioContext, displayNotes]);

  // Trigger piano notes from Piano Roll during playback.
  useEffect(() => {
    if (!isScreenActive) return;
    if (!isPlaying || activeCol < 0) return;
    if (tab !== 'piano' || pianoMode !== 'notes') return;
    const notesAtCol = sharedNotes.filter(n => n.col === activeCol);
    notesAtCol.forEach(note => playPianoNote(note.row, 0.3));
  }, [activeCol, isPlaying, sharedNotes, playPianoNote, tab, pianoMode, isScreenActive]);

  const hasDrums = (i: number) => {
    const drums = banks[i]?.drums;
    if (!Array.isArray(drums)) return false;
    return drums.some((r) => Array.isArray(r) && r.some(Boolean));
  };
  const hasNotes = (i: number) => (banks[i]?.notes?.length ?? 0) > 0;
  const drumGridColW = Math.max(colWidth, DRUM_GRID_MIN_CW);
  const beatLabTileGridOn = beatLabTileGridActive(beatLabTileGrid, drumGridColW);
  const pianoGridColW = Math.max(colWidth, PIANO_GRID_MIN_CW);

  /** Place or clear a grid step ? keeps drums + midiRoll in sync for pad lanes (single bank write). */
  const placeBeatLabGridStep = useCallback(
    (pad: number, patternCol: number, on: boolean) => {
      if (CREATION_BACKEND_BLANK) return;
      const bankCol = patternCol + drumColOffset;
      const mutateDrums = (drums: DrumPattern) =>
        drums.map((row, r) =>
          row.map((v, c) => (r === pad && c === bankCol ? on : v)),
        );

      setBanks((prev) => {
        const bank = prev[activeBank];
        if (!bank) return prev;
        const roll = bank.midiRoll ?? [];
        const nextDrums = mutateDrums(normalizeBankDrumPattern(bank.drums));

        if (pad >= BEAT_LAB_PAD_LANES) {
          return prev.map((b, i) =>
            i === activeBank ? { ...b, drums: nextDrums } : b,
          );
        }

        if (on) {
          if (roll.some((n) => n.lane === pad && n.col === patternCol)) {
            return prev.map((b, i) =>
              i === activeBank ? { ...b, drums: nextDrums } : b,
            );
          }
          const nextRoll = [
            ...roll,
            { lane: pad, col: patternCol, len: 1, vel: PAD_VEL[pad] ?? 100 },
          ];
          return prev.map((b, i) =>
            i === activeBank ? { ...b, drums: nextDrums, midiRoll: nextRoll } : b,
          );
        }

        const note = roll.find((n) => n.lane === pad && n.col === patternCol);
        const nextRoll = roll.filter((n) => !(n.lane === pad && n.col === patternCol));
        if (nextRoll.length === roll.length && !nextDrums[pad]?.[bankCol]) {
          return prev.map((b, i) =>
            i === activeBank ? { ...b, drums: nextDrums } : b,
          );
        }
        let drumsOut = nextDrums;
        if (note) {
          drumsOut = applyDrumSpanForPadNote(drumsOut, pad, patternCol, note.len, false);
        } else {
          drumsOut = applyDrumSpanForPadNote(drumsOut, pad, patternCol, 1, false);
        }
        return prev.map((b, i) =>
          i === activeBank ? { ...b, drums: drumsOut, midiRoll: nextRoll } : b,
        );
      });

      setBankPatternSlots((prev) =>
        prev.map((slots, i) =>
          i !== activeBank
            ? slots
            : {
                ...slots,
                [patternSlot]: mutateDrums(normalizeBankDrumPattern(slots[patternSlot])),
              },
        ),
      );
    },
    [activeBank, applyDrumSpanForPadNote, drumColOffset, patternSlot],
  );

  const paintDrumAtClient = useCallback(
    (clientX: number, clientY: number, on: boolean) => {
      const el = drumScrollRef.current;
      if (!el || CREATION_BACKEND_BLANK) return;
      const cell = beatLabDrumCellFromPointer(clientX, clientY, el, {
        colWidth: drumGridColW,
        headerH: DRUM_GRID_SCROLL_HEADER_H,
        rowH: DRUM_GRID_ROW_H,
        laneCount: PAD_NAMES.length,
        patternCols: patternColsDrums,
        colOffset: drumColOffset,
      });
      if (!cell) return;
      const key = beatLabDrumCellKey(cell.pad, cell.bankCol);
      const paint = drumPaintRef.current;
      if (paint?.active && paint.lastKey === key) return;
      if (paint?.active) paint.lastKey = key;
      placeBeatLabGridStep(cell.pad, cell.patternCol, on);
    },
    [CREATION_BACKEND_BLANK, drumColOffset, drumGridColW, patternColsDrums, placeBeatLabGridStep],
  );

  const paintDrumSegment = useCallback(
    (x0: number, y0: number, x1: number, y1: number, on: boolean) => {
      const el = drumScrollRef.current;
      if (!el || CREATION_BACKEND_BLANK) return;
      const cells = beatLabDrumCellsAlongSegment(x0, y0, x1, y1, el, {
        colWidth: drumGridColW,
        headerH: DRUM_GRID_SCROLL_HEADER_H,
        rowH: DRUM_GRID_ROW_H,
        laneCount: PAD_NAMES.length,
        patternCols: patternColsDrums,
        colOffset: drumColOffset,
      });
      for (const cell of cells) {
        placeBeatLabGridStep(cell.pad, cell.patternCol, on);
      }
      const last = cells[cells.length - 1];
      if (last && drumPaintRef.current?.active) {
        drumPaintRef.current.lastKey = beatLabDrumCellKey(last.pad, last.bankCol);
      }
    },
    [CREATION_BACKEND_BLANK, drumColOffset, drumGridColW, patternColsDrums, placeBeatLabGridStep],
  );

  const beginDrumPaint = useCallback(
    (clientX: number, clientY: number, shiftKey: boolean) => {
      if (CREATION_BACKEND_BLANK || !beatLabToolUsesDrumBrush(beatLabEditTool)) return;
      const on = beatLabDrumBrushValue(beatLabEditTool, shiftKey);
      if (on === null) return;
      drumPaintRef.current = {
        active: true,
        on,
        lastKey: '',
        lastX: clientX,
        lastY: clientY,
      };
      paintDrumAtClient(clientX, clientY, on);
    },
    [CREATION_BACKEND_BLANK, beatLabEditTool, paintDrumAtClient],
  );

  const beginGridNoteResize = useCallback(
    (
      e: { preventDefault(): void; stopPropagation(): void; clientX: number; pointerId?: number },
      lane: number,
      headCol: number,
      note: BeatLabMidiNote,
      captureTarget?: HTMLElement | null,
    ) => {
      if (CREATION_BACKEND_BLANK || beatLabEditTool !== 'pointer') return;
      e.preventDefault();
      e.stopPropagation();
      beatLabGridDragRef.current = null;
      beatLabGridFocusRef.current = { lane, col: headCol };
      setBeatLabRollSelection({ lane, col: headCol });
      beatLabGridResizeRef.current = {
        lane,
        headCol,
        startX: e.clientX,
        startLen: note.len,
        previewLen: note.len,
      };
      if (captureTarget != null && e.pointerId != null) {
        try {
          captureTarget.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
    },
    [beatLabEditTool],
  );

  useEffect(() => {
    const onUp = () => {
      drumPaintRef.current = null;
    };
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, []);

  useEffect(() => {
    if (!beatLabToolUsesDrumBrush(beatLabEditTool)) return;
    const onMove = (e: MouseEvent) => {
      const paint = drumPaintRef.current;
      if (!paint?.active) return;
      paintDrumSegment(paint.lastX, paint.lastY, e.clientX, e.clientY, paint.on);
      paint.lastX = e.clientX;
      paint.lastY = e.clientY;
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [beatLabEditTool, paintDrumSegment]);

  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      const r = beatLabGridResizeRef.current;
      if (!r) return;
      e.preventDefault();
      const deltaCols = Math.round((e.clientX - r.startX) / drumGridColW);
      const nextLen = Math.max(1, r.startLen + deltaCols);
      if (nextLen === r.previewLen) return;
      r.previewLen = nextLen;
      resizeBeatLabMidiRollNoteRef.current(r.lane, r.headCol, r.previewLen);
    }
    function onPointerUp() {
      const r = beatLabGridResizeRef.current;
      if (r) {
        resizeBeatLabMidiRollNoteRef.current(r.lane, r.headCol, r.previewLen);
        beatLabGridJustDraggedRef.current = true;
        beatLabGridResizeRef.current = null;
      }
    }
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [drumGridColW]);

  useEffect(() => {
    if (beatLabEditTool !== 'pointer') return;
    function onMove(e: MouseEvent) {
      const drag = beatLabGridDragRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (!drag.moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
      drag.moved = true;
    }
    function onUp(e: MouseEvent) {
      const drag = beatLabGridDragRef.current;
      if (!drag) return;
      if (drag.moved) {
        const el = drumScrollRef.current;
        if (el) {
          const cell = beatLabDrumCellFromPointer(e.clientX, e.clientY, el, {
            colWidth: drumGridColW,
            headerH: DRUM_GRID_SCROLL_HEADER_H,
            rowH: DRUM_GRID_ROW_H,
            laneCount: PAD_NAMES.length,
            patternCols: patternColsDrums,
            colOffset: drumColOffset,
          });
          if (
            cell &&
            (cell.pad !== drag.fromLane || cell.patternCol !== drag.fromCol)
          ) {
            moveBeatLabMidiRollNoteRef.current(
              drag.fromLane,
              drag.fromCol,
              cell.pad,
              cell.patternCol,
            );
          }
        }
        beatLabGridJustDraggedRef.current = true;
      }
      beatLabGridDragRef.current = null;
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [beatLabEditTool, drumColOffset, drumGridColW, patternColsDrums]);

  const drumGridW = patternColsDrums * drumGridColW;
  const totalW   = TOTAL_COLS * pianoGridColW;
  const pianoLoopEndBar = loopStartBar + loopBars - 1;
  const pianoVisLoopStart = Math.max(1, loopStartBar);
  const pianoVisLoopEnd = Math.min(TOTAL_BARS, pianoLoopEndBar);
  const pianoLoopRegionOk = loopEnabled && pianoVisLoopEnd >= pianoVisLoopStart;
  const pianoLoopLeftPx = (pianoVisLoopStart - 1) * MEASURES_PER_BAR * pianoGridColW;
  const pianoLoopWidthPx = (pianoVisLoopEnd - pianoVisLoopStart + 1) * MEASURES_PER_BAR * pianoGridColW;
  const pianoRollLoopGridH =
    (pianoMode === 'notes' ? displayNotes.length : 1) * (pianoMode === 'drums' ? DRUM_GRID_ROW_H : ROW_H);
  const activeDrumPadIndex = selectedDrumPad ?? 0;
  /** Sourced from transport HUD via {@link publishCreationRulerBeat} ? integer change only. */
  const rulerCreationBeatHighlight = creationRulerBeatHighlight;

  const persistCreationToStorage = useCallback(() => {
    try {
      localStorage.setItem('creationStation_banks', JSON.stringify(banks));
      localStorage.setItem(
        PIANO_SNAP_SUBDIV_STORAGE_KEY,
        String(normalizePianoSnapSubdiv(pianoSnapSubdiv)),
      );
    } catch {
      /* ignore */
    }
  }, [banks, pianoSnapSubdiv]);

  const beatLabDeckTransportClocks = (
    <CreationSe2TransportClockChips registry={creationSe2ReadoutRegistry} />
  );

  const beatLabPatternBankRow = (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 10,
        flexWrap: 'wrap',
        padding: '4px 2px 0',
        position: 'relative',
        zIndex: 50,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          flex: '1.2 1 320px',
          minWidth: 280,
          padding: '5px 8px 6px',
          borderRadius: 10,
          border: '1px solid rgba(124, 244, 198, 0.22)',
          background: 'linear-gradient(165deg, rgba(11, 11, 16, 0.55) 0%, rgba(8, 8, 12, 0.95) 100%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, color: '#7cf4c6', fontWeight: 800, letterSpacing: 0.8 }}>PATTERN BANK</span>
          {patternBankHint && (
            <span style={{ fontSize: 9, color: '#7cf4c6', fontWeight: 700 }}>{patternBankHint}</span>
          )}
        </div>
        <PatternBankPanel
          patternSlot={patternSlot}
          onPatternSlotChange={setPatternSlot}
          onLoadPreset={applyBeatLabPatternPreset}
          onCopyAToB={copyPatternAToB}
          disabled={CREATION_BACKEND_BLANK}
        />
      </div>

      <div
        style={{
          flex: '2 1 360px',
          minWidth: 260,
          borderRadius: 10,
          border: '1px solid rgba(52, 211, 153, 0.18)',
          background: 'linear-gradient(165deg, rgba(6, 40, 32, 0.35) 0%, rgba(8, 8, 10, 0.95) 100%)',
          overflow: 'visible',
          minHeight: 72,
          position: 'relative',
          zIndex: 50,
        }}
      >
        <SoundFamiliesBar
          bankLabel={BANKS[activeBank] ?? 'A'}
          targetPad={geniusSamplerTargetPad}
          onTargetPadChange={setGeniusSamplerTargetPad}
          onLoadSample={(args) => {
            void loadSoundFamilySample(args);
          }}
        />
      </div>

      <button onClick={() => setFollow(p => !p)} style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, fontFamily: 'monospace', background: follow ? '#00E5FF18' : '#1a1a24', color: follow ? '#00E5FF' : '#4a4a58', border: `1px solid ${follow ? '#00E5FF44' : '#2a2a32'}`, cursor: 'pointer' }}>
        ? FOLLOW
      </button>

      <BankButtons activeBank={activeBank} setActiveBank={setActiveBank} hasDrums={hasDrums} hasNotes={hasNotes} />

      <button type="button" disabled={CREATION_BACKEND_BLANK} onClick={() => {
        if (CREATION_BACKEND_BLANK) return;
        onExport('master-arranger');
      }} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: '#1a1a24', color: '#7cf4c6', border: '1px solid rgba(124,244,198,0.27)', cursor: CREATION_BACKEND_BLANK ? 'not-allowed' : 'pointer', opacity: CREATION_BACKEND_BLANK ? 0.45 : 1 }}>
        <Send size={9} /> Arrange
      </button>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: '#060607', color: '#c8c8d0', overflow: 'hidden', position: 'relative' }}>
      <style>{`
        .cs-pad-hit { transition: filter 0.14s ease-out; }
        .cs-pad-hit:active,
        .cs-pad-hit:has(*:active) {
          filter: brightness(1.7) saturate(0.95);
        }
      `}</style>

      {tab === 'grid' && (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          padding: '4px 10px 6px',
          background: 'linear-gradient(180deg, #0b0b10 0%, #09090d 100%)',
          borderBottom: '1px solid #141418',
          flexShrink: 0,
          gap: 6,
          boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
        }}
      >
        {/* ?? Top: Genius-style beat lab deck (transport + status) ? Beat Lab only; other tabs ship their own transport. ?? */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            gap: 8,
            flexWrap: 'nowrap',
            minWidth: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'nowrap', flexShrink: 0 }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 1,
              padding: '1px 10px 1px 2px',
              borderRight: '1px solid rgba(124, 244, 198, 0.35)',
              minWidth: 0,
            }}
            title="Elapsed musical time from playhead (m:ss)."
          >
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#e8e8f0', lineHeight: 1.1 }}>Creation</span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  color: '#f0d060',
                  fontFamily: 'monospace',
                  lineHeight: 1,
                  letterSpacing: 0.5,
                }}
              >
                <CreationGeniusElapsedDisplay
                  displayBeatRef={displayBeatRef}
                  bpmRef={bpmRef}
                  isPlaybackOrRecord={isPlaybackOrRecord}
                />
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 6, letterSpacing: 2, color: '#7cf4c6', fontWeight: 800 }}>BEAT LAB</span>
              <span style={{ fontSize: 5, color: '#6a6a78', fontWeight: 800, letterSpacing: 1 }}>TIME</span>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={CREATION_BACKEND_BLANK ? false : metronomeEnabled}
            disabled={CREATION_BACKEND_BLANK}
            title="Metronome"
            onClick={() => {
              if (CREATION_BACKEND_BLANK) return;
              setMetronomeEnabled(!metronomeEnabled);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 36,
              minWidth: 36,
              flexShrink: 0,
              padding: '0 8px',
              borderRadius: 6,
              border: '1px solid',
              borderColor: CREATION_BACKEND_BLANK ? '#2a2a32' : metronomeEnabled ? '#2a4a3c' : '#2a2a32',
              color: CREATION_BACKEND_BLANK ? '#5c5c68' : metronomeEnabled ? '#7cf4c6' : '#5c5c68',
              background: CREATION_BACKEND_BLANK ? 'transparent' : metronomeEnabled ? '#14221c' : 'transparent',
              fontSize: 11,
              fontWeight: 700,
              cursor: CREATION_BACKEND_BLANK ? 'not-allowed' : 'pointer',
              opacity: CREATION_BACKEND_BLANK ? 0.45 : 1,
            }}
          >
            Met
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0, alignSelf: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, background: '#0a0a0e', border: '1px solid #2a2a32', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px' }}>
                <Zap size={11} style={{ color: '#7cf4c6' }} />
                <input
                  type="text"
                  inputMode="numeric"
                  readOnly={CREATION_BACKEND_BLANK}
                  value={bpmInput}
                  onChange={(e) => {
                    if (CREATION_BACKEND_BLANK) return;
                    setBpmInput(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (CREATION_BACKEND_BLANK) return;
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                    } else if (e.key === 'Escape') {
                      setBpmInput(String(bpm));
                      e.currentTarget.blur();
                    }
                  }}
                  onBlur={() => {
                    if (CREATION_BACKEND_BLANK) return;
                    const v = parseInt(bpmInput.trim(), 10);
                    if (Number.isFinite(v)) {
                      const clamped = Math.max(40, Math.min(240, v));
                      setBpm(clamped);
                      setBpmInput(String(clamped));
                    } else {
                      setBpmInput(String(bpm));
                    }
                  }}
                  onFocus={(e) => e.currentTarget.select()}
                  style={{
                    width: 50,
                    background: 'transparent',
                    border: 'none',
                    color: '#7cf4c6',
                    fontSize: 13,
                    fontFamily: 'monospace',
                    fontWeight: 'bold',
                    outline: 'none',
                    textAlign: 'center',
                    cursor: CREATION_BACKEND_BLANK ? 'not-allowed' : 'text',
                    opacity: CREATION_BACKEND_BLANK ? 0.45 : 1,
                  }}
                  title={CREATION_BACKEND_BLANK ? 'Creation backend disabled' : 'Type tempo (40-240), press Enter'}
                />
                <span style={{ fontSize: 9, color: '#666' }}>BPM</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0, borderLeft: '1px solid #2a2a32' }}>
                <button
                  type="button"
                  disabled={CREATION_BACKEND_BLANK}
                  onClick={() => {
                    if (CREATION_BACKEND_BLANK) return;
                    const n = Math.min(240, bpm + 1);
                    setBpm(n);
                    setBpmInput(String(n));
                  }}
                  style={{
                    flex: 1,
                    padding: '0 6px',
                    border: 'none',
                    background: '#1a1a24',
                    color: '#7cf4c6',
                    cursor: CREATION_BACKEND_BLANK ? 'not-allowed' : 'pointer',
                    fontSize: 10,
                    fontWeight: 'bold',
                    transition: 'all 0.1s',
                    opacity: CREATION_BACKEND_BLANK ? 0.45 : 1,
                  }}
                >
                  <ChevronUp size={13} />
                </button>
                <button
                  type="button"
                  disabled={CREATION_BACKEND_BLANK}
                  onClick={() => {
                    if (CREATION_BACKEND_BLANK) return;
                    const n = Math.max(40, bpm - 1);
                    setBpm(n);
                    setBpmInput(String(n));
                  }}
                  style={{
                    flex: 1,
                    padding: '0 6px',
                    border: 'none',
                    background: '#0a0a0e',
                    color: '#7cf4c6',
                    cursor: CREATION_BACKEND_BLANK ? 'not-allowed' : 'pointer',
                    fontSize: 10,
                    fontWeight: 'bold',
                    transition: 'all 0.1s',
                    borderTop: '1px solid #2a2a32',
                    opacity: CREATION_BACKEND_BLANK ? 0.45 : 1,
                  }}
                >
                  <ChevronDown size={13} />
                </button>
              </div>
            </div>
            <input
              type="range"
              min={40}
              max={240}
              step={1}
              disabled={CREATION_BACKEND_BLANK}
              value={bpm}
              onChange={(e) => {
                if (CREATION_BACKEND_BLANK) return;
                const n = Number(e.target.value);
                setBpm(n);
                setBpmInput(String(n));
              }}
              style={{
                width: '100%',
                minWidth: 132,
                maxWidth: 200,
                height: 6,
                margin: 0,
                cursor: CREATION_BACKEND_BLANK ? 'not-allowed' : 'pointer',
                accentColor: '#7cf4c6',
                opacity: CREATION_BACKEND_BLANK ? 0.45 : 1,
              }}
              title="Drag to set tempo ? 40?240 BPM"
            />
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              flexWrap: 'nowrap',
              gap: 4,
              padding: '4px 8px',
              borderRadius: 4,
              background: '#0a0a0e',
              border: '1px solid #2a2a32',
            }}
            title="Creation Station dedicated transport controls"
          >
            <button
              type="button"
              disabled={CREATION_BACKEND_BLANK}
              onClick={() => {
                if (CREATION_BACKEND_BLANK) return;
                rewindTransport();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                flexShrink: 0,
                border: 'none',
                borderRadius: 6,
                background: '#101014',
                color: '#8aa0b5',
                cursor: CREATION_BACKEND_BLANK ? 'not-allowed' : 'pointer',
                opacity: CREATION_BACKEND_BLANK ? 0.45 : 1,
              }}
              title="Return to start"
            >
              <SkipBack size={18} />
            </button>
            <button
              type="button"
              disabled={CREATION_BACKEND_BLANK}
              onClick={() => {
                stopTransport();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                flexShrink: 0,
                border: 'none',
                borderRadius: 6,
                background: '#101014',
                color: '#8aa0b5',
                cursor: CREATION_BACKEND_BLANK ? 'not-allowed' : 'pointer',
                opacity: CREATION_BACKEND_BLANK ? 0.45 : 1,
              }}
              title="Stop"
            >
              <Square size={18} />
            </button>
            <button
              type="button"
              disabled={CREATION_BACKEND_BLANK}
              onClick={() => {
                if (CREATION_BACKEND_BLANK) return;
                if (transportNeedsPause) {
                  void pauseTransport();
                } else {
                  void startTransport('play');
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 44,
                height: 36,
                flexShrink: 0,
                border: 'none',
                borderRadius: 6,
                background: transportNeedsPause ? 'rgba(0, 229, 255, 0.18)' : 'linear-gradient(145deg, #1e3a5f, #122032)',
                color: transportNeedsPause ? '#5eead4' : '#cffafe',
                boxShadow: transportNeedsPause ? 'inset 0 0 0 1px rgba(94,234,212,0.35)' : '0 0 18px rgba(0,229,255,0.12)',
                cursor: CREATION_BACKEND_BLANK ? 'not-allowed' : 'pointer',
                opacity: CREATION_BACKEND_BLANK ? 0.45 : 1,
              }}
              title={
                transportNeedsPause
                  ? (isRecording ? 'Pause recording' : isCounting ? 'Pause count-in' : 'Pause playback')
                  : isPaused
                    ? 'Resume'
                    : 'Play'
              }
            >
              {transportNeedsPause ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <button
              type="button"
              disabled={CREATION_BACKEND_BLANK}
              onClick={() => {
                if (CREATION_BACKEND_BLANK) return;
                void startTransport('record');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 38,
                height: 36,
                flexShrink: 0,
                border: `1px solid ${isRecording ? '#f8717188' : '#7f1d1d'}`,
                borderRadius: 6,
                background: isRecording
                  ? 'linear-gradient(180deg, #f87171, #dc2626)'
                  : 'linear-gradient(180deg, #2a1518, #1a0f0f)',
                color: isRecording ? '#fff' : '#fecaca',
                cursor: CREATION_BACKEND_BLANK ? 'not-allowed' : 'pointer',
                opacity: CREATION_BACKEND_BLANK ? 0.45 : 1,
              }}
              title={isRecording ? 'Recording' : 'Record'}
            >
              <Circle size={18} />
            </button>
          </div>

          <BeatLabMasterVolume
            value={masterOutputLinear}
            onChange={onMasterVolumeChange}
            disabled={CREATION_BACKEND_BLANK}
          />
          </div>

          <div
            style={{
              flex: '1 1 0%',
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flexWrap: 'nowrap',
              overflowX: 'auto',
              padding: '2px 0 2px 8px',
              borderLeft: '1px solid #2a2a32',
              scrollbarWidth: 'thin',
            }}
            title="Snap / loop / length / click timing / zoom ? scroll horizontally if the window is narrow"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <span style={{ fontSize: 8, color: '#6a6a78', fontWeight: 700 }}>SNAP</span>
              <select
                value={normalizePianoSnapSubdiv(pianoSnapSubdiv)}
                title={`Snap ? ${PPQ} PPQ; one column = ${Math.round(ticksPerPianoSnapCell(PPQ, normalizePianoSnapSubdiv(pianoSnapSubdiv)))} ticks at this grid; zoom changes pixel width`}
                onChange={(e) => setPianoSnapSubdiv(Number(e.target.value))}
                style={{
                  height: 28,
                  borderRadius: 4,
                  border: '1px solid #2a2a32',
                  background: '#0a0a0e',
                  color: '#7cf4c6',
                  fontSize: 11,
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  cursor: 'pointer',
                  minWidth: 56,
                }}
              >
                <option value={1}>{snapLabelFromPianoSnapSubdiv(1)}</option>
                <option value={2}>{snapLabelFromPianoSnapSubdiv(2)}</option>
                <option value={3}>{snapLabelFromPianoSnapSubdiv(3)}</option>
                <option value={4}>{snapLabelFromPianoSnapSubdiv(4)}</option>
                <option value={6}>{snapLabelFromPianoSnapSubdiv(6)}</option>
                <option value={8}>{snapLabelFromPianoSnapSubdiv(8)}</option>
                <option value={16}>{snapLabelFromPianoSnapSubdiv(16)}</option>
                <option value={32}>{snapLabelFromPianoSnapSubdiv(32)}</option>
              </select>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                flexShrink: 0,
                paddingLeft: 6,
                borderLeft: '1px solid #2a2a32',
              }}
              title="DrumloopAI-style step grid: 1/16, loop on, full grid fitted to screen"
            >
              <span style={{ fontSize: 8, color: '#6a6a78', fontWeight: 700 }}>DL</span>
              {(
                [
                  { variant: '4bar' as const, label: '4×16', title: 'Four bars · 64 steps at 1/16' },
                  { variant: '2bar' as const, label: '2×16', title: 'Two bars · 32 steps at 1/16' },
                  {
                    variant: '1bar' as const,
                    label: '1×16',
                    title: 'One bar · 16 steps (classic drum machine)',
                  },
                ] as const
              ).map(({ variant, label, title }) => {
                const active = beatLabDrumloopPresetActive === variant;
                return (
                  <button
                    key={variant}
                    type="button"
                    aria-pressed={active}
                    title={title}
                    onClick={() => applyDrumloopGridPreset(variant)}
                    style={{
                      height: 28,
                      padding: active ? '0 8px' : '0 6px',
                      borderRadius: 4,
                      border: active
                        ? '1px solid rgba(0, 229, 255, 0.45)'
                        : '1px solid rgba(0, 229, 255, 0.28)',
                      background: active
                        ? 'rgba(0, 229, 255, 0.1)'
                        : 'rgba(0, 229, 255, 0.06)',
                      color: active ? '#00E5FF' : '#7aa2b8',
                      fontSize: 9,
                      fontWeight: 800,
                      fontFamily: 'monospace',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div
              style={{
                flexShrink: 0,
                padding: '0 6px',
                borderLeft: '1px solid #2a2a32',
                borderRight: '1px solid #2a2a32',
              }}
            >
              <BeatLabEditToolToggle
                embedded
                compact
                mode={beatLabEditTool}
                onModeChange={setBeatLabEditTool}
                snapHint={snapLabelFromPianoSnapSubdiv(drumStepSubdiv)}
              />
            </div>

            <button
              type="button"
              aria-pressed={loopOn}
              title={
                loopOn
                  ? `Loop on ? ${loopBars} bar${loopBars !== 1 ? 's' : ''}`
                  : 'Loop off ? click to enable'
              }
              onClick={() => {
                setLoopOn((v) => !v);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                height: 36,
                padding: '0 8px',
                borderRadius: 6,
                border: '1px solid',
                borderColor: loopOn ? '#2a4a3c' : '#3a3a46',
                background: loopOn ? '#14221c' : '#1c1c24',
                color: loopOn ? '#7cf4c6' : '#6a6a78',
                fontSize: 9,
                fontWeight: 800,
                fontFamily: 'monospace',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <Repeat size={12} strokeWidth={2.5} />
              <span>Loop</span>
            </button>

            <button
              type="button"
              disabled={CREATION_BACKEND_BLANK || !canUndoBeatLabDup}
              title="Undo last loop duplicate (pattern + loop length)"
              onClick={() => undoBeatLabDup()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                height: 36,
                padding: '0 8px',
                borderRadius: 6,
                border: '1px solid rgba(124, 244, 198, 0.28)',
                background: 'rgba(124, 244, 198, 0.06)',
                color: '#7cf4c6',
                fontSize: 9,
                fontWeight: 800,
                fontFamily: 'monospace',
                cursor:
                  CREATION_BACKEND_BLANK || !canUndoBeatLabDup ? 'not-allowed' : 'pointer',
                flexShrink: 0,
                opacity: CREATION_BACKEND_BLANK || !canUndoBeatLabDup ? 0.45 : 1,
              }}
            >
              <Undo2 size={12} strokeWidth={2.5} />
              <span>Undo DUP</span>
            </button>

            <button
              type="button"
              title={`Duplicate loop (${loopBars} bar${loopBars !== 1 ? 's' : ''}) — paste copy right after, double length`}
              onClick={() => duplicateBeatLabLoop()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                height: 36,
                padding: '0 8px',
                borderRadius: 6,
                border: '1px solid rgba(124, 244, 198, 0.35)',
                background: 'rgba(124, 244, 198, 0.08)',
                color: '#7cf4c6',
                fontSize: 9,
                fontWeight: 800,
                fontFamily: 'monospace',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <Copy size={12} strokeWidth={2.5} />
              <span>DUP</span>
            </button>

            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                flexShrink: 0,
                minWidth: 0,
              }}
              title="Loop length (bars) ? dropdown; 64 = full board"
            >
              <span style={{ fontSize: 8, color: '#6a6a78', fontWeight: 700 }}>LEN</span>
              <select
                value={loopBars}
                title="Loop length (bars) ? same preset set as Studio; 64 = full piano board span"
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (!Number.isFinite(n) || n < 1) return;
                  setLoopBars(n);
                  setLoopRangeBeats(
                    loopStartBeatRef.current,
                    loopStartBeatRef.current + n * beatsPerBarRef.current,
                  );
                }}
                style={{
                  height: 28,
                  borderRadius: 4,
                  border: '1px solid #2a2a32',
                  background: '#0a0a0e',
                  color: '#aeb7c6',
                  fontSize: 10,
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  cursor: 'pointer',
                  maxWidth: 108,
                  flexShrink: 0,
                }}
              >
                {Array.from(new Set([1, 2, 4, 8, 12, 16, 24, 32, 64, loopBars]))
                  .sort((a, b) => a - b)
                  .map((n) => (
                  <option key={n} value={n}>
                    {n} bar{n !== 1 ? 's' : ''}{n === 64 ? ' ? full' : ''}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              title="Save banks + pad routing + snap to local storage"
              onClick={persistCreationToStorage}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                height: 36,
                flexShrink: 0,
                padding: '0 10px',
                borderRadius: 6,
                border: '1px solid #2a2a32',
                background: '#1a1a24',
                color: '#aeb7be',
                fontSize: 10,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Save size={14} />
              Save
            </button>

            <button
              type="button"
              title="Send session to Studio Editor 2 (pattern / MIDI handoff)"
              disabled={CREATION_BACKEND_BLANK}
              onClick={() => {
                if (CREATION_BACKEND_BLANK) return;
                onExport('studio-editor');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                height: 36,
                flexShrink: 0,
                padding: '0 10px',
                borderRadius: 6,
                border: '1px solid #00E5FF44',
                background: '#1a1a24',
                color: '#00E5FF',
                fontSize: 10,
                fontWeight: 700,
                cursor: CREATION_BACKEND_BLANK ? 'not-allowed' : 'pointer',
                opacity: CREATION_BACKEND_BLANK ? 0.45 : 1,
              }}
            >
              <Cable size={14} />
              MIDI
            </button>
          </div>

        </div>

        {/* Beat Lab: kit + sampler pads (GRID / ROLL). SYNTH view uses the workspace below only. */}
          {beatLabDeckFocus !== 'synth' ? (
          <div
            style={{
              position: 'relative',
              zIndex: 200,
              overflow: 'visible',
              flexShrink: 0,
            }}
          >
          <BeatLabDeckToolbar
            kit={kit}
            setKit={setKit}
            hasPadSample={hasPadSampleForActiveBank}
            onLoadPadSample={beginLoadPadSample}
            onClearPadSample={clearPadSample}
            onGeniusRecord={() => {
              if (CREATION_BACKEND_BLANK) return;
              void startTransport('record');
            }}
            onGeniusUpload={() => beginLoadPadSample(geniusSamplerTargetPad)}
            onGeniusImportFolder={beginImportPadFolder}
            onLoadBrassRoomFolder={beginImportBrassRoomFolder}
            onLoadBrassRoomFromProject={() => {
              void loadBrassRoomFromProjectFolder();
            }}
            onOpenTrapKitBrowser={beginOpenTrapKitBrowser}
            brassRoomLoading={brassRoomLoading}
            kitImportHint={kitImportHint}
            producerKitId={producerKitId}
            onProducerKitIdChange={setProducerKitId}
            onLoadProducerKit={() => {
              void applyBeatLabProducerKit();
            }}
            producerKitLoading={producerKitLoading}
            producerKitTribute={beatLabProducerKitMeta(producerKitId)?.tribute ?? null}
            onGeniusMySoundPlay={(pi) => {
              playPadSoundRef.current(pi, PAD_VEL[pi] ?? 90);
            }}
            onStopPadSamplePlayback={stopPadSamplePlayback}
            geniusSamplerTargetPad={geniusSamplerTargetPad}
            onGeniusSamplerTargetPadChange={setGeniusSamplerTargetPad}
            padSampleRootBpmForPad={(pi) => padSampleRootBpms[padSampleKey(activeBank, pi)]}
            onCommitPadSampleRootBpm={commitPadSampleRootBpm}
            padSampleLabelForPad={(pi) => padSampleLabels[padSampleKey(activeBank, pi)]}
            onCommitPadSampleLabel={commitPadSampleLabel}
            samplerUiBank={activeBank}
            getPadSamplerOpts={getPadSamplerPlaybackOpts}
            commitPadSamplerOpts={commitPadSamplerPlaybackOpts}
            onPreviewSamplerFx={previewSamplerFxDraft}
            getPadSamplerFxRack={getPadSamplerFxRack}
            commitPadSamplerFxRack={commitPadSamplerFxRack}
            onLivePadFxRackDraft={applyPadFxRackLive}
            onPreviewSamplerFxRack={previewPadSamplerFxRack}
            onPreviewSamplerRootBpmDraft={previewSamplerRootBpmDraft}
            getPadSampleAudioBuffer={(pi) => padSampleBuffersRef.current.get(padSampleKey(activeBank, pi))}
            patternActionsDisabled={CREATION_BACKEND_BLANK}
            onClearGrid={() => {
              clearPatternDrumsRef.current();
            }}
            onClearLane={() => {
              const lane = resolveBeatLabClearLaneIndex();
              if (lane == null) return;
              clearDrumLaneRef.current(lane);
            }}
            clearLaneDisabled={resolveBeatLabClearLaneIndex() == null}
            clearLaneTitle={
              resolveBeatLabClearLaneIndex() != null
                ? (() => {
                    const li = resolveBeatLabClearLaneIndex()!;
                    return `Clear lane ${li + 1} (${beatLabLaneDisplayLabel(li, padSampleLabels[padSampleKey(activeBank, li)])})`;
                  })()
                : 'Click a lane name on the left (or a sampler pad), then Clear lane'
            }
            onDownloadHandoff={() => {
              onExport('studio-editor');
            }}
            kitSelectValue={kitSelectValue}
            onKitSelectChange={handleKitSelectChange}
            presetKitNames={KITS}
            savedKits={savedKits.map((k) => ({ id: k.id, name: k.name }))}
            onSaveKit={handleSaveBeatLabKit}
            onRenameSavedKit={handleRenameSavedBeatLabKit}
            onDeleteSavedKit={handleDeleteSavedBeatLabKit}
            saveKitStatus={saveKitStatus}
            savedSongs={savedSongs.map((s) => ({ id: s.id, name: s.name }))}
            onSaveSong={handleSaveBeatLabSong}
            onLoadSavedSong={(id) => {
              void applySavedBeatLabSong(id);
            }}
            onRenameSavedSong={handleRenameSavedBeatLabSong}
            onDeleteSavedSong={handleDeleteSavedBeatLabSong}
            saveSongStatus={saveSongStatus}
            sessionZoomTools={beatLabSessionZoomTools}
            deckTransportClocks={beatLabDeckTransportClocks}
            beatLabDeckFocus={beatLabDeckFocus}
            onBeatLabDeckFocusChange={setBeatLabDeckFocus}
            hideSamplerPads={beatLabGridFullView}
            selectedDrumPad={selectedDrumPad}
            onSelectDrumPad={setSelectedBeatLabLane}
            selectedMelodicLane={
              selectedBeatLabLane != null && selectedBeatLabLane >= BEAT_LAB_MELODIC_LANE_START
                ? selectedBeatLabLane
                : null
            }
            melodicInstruments={currentMelodicInstruments}
            channelVolumes={channelVolumes}
            getAudioContext={getOrCreateAudioContext}
            onMelodicInstrumentChange={patchMelodicInstrument}
            sessionBpm={bpm}
            creationBackendBlank={CREATION_BACKEND_BLANK}
          />
          </div>
          ) : null}

      </div>
      )}

      <input
        ref={padSampleFileInputRef}
        type="file"
        accept="audio/*"
        style={{ display: 'none' }}
        onChange={handlePadSampleFile}
      />
      <input
        ref={padSampleFolderInputRef}
        type="file"
        accept="audio/*,.wav,.mp3,.ogg,.flac,.m4a,.aif,.aiff"
        multiple
        // @ts-expect-error ? non-standard directory picker (Chrome / Edge)
        webkitdirectory=""
        directory=""
        style={{ display: 'none' }}
        onChange={handlePadSampleFolder}
      />
      <input
        ref={trapKitFolderInputRef}
        type="file"
        accept="audio/*,.wav,.mp3,.ogg,.flac,.m4a,.aif,.aiff"
        multiple
        // @ts-expect-error ? kit browser folder pick
        webkitdirectory=""
        directory=""
        style={{ display: 'none' }}
        onChange={handleTrapKitFolder}
      />
      <TrapKitBrowserPanel
        open={trapKitBrowserOpen}
        files={trapKitBrowserFiles}
        bankLabel={BANKS[BRASS_ROOM_BANK_INDEX] ?? 'B'}
        targetPad={geniusSamplerTargetPad}
        onTargetPadChange={setGeniusSamplerTargetPad}
        onClose={() => setTrapKitBrowserOpen(false)}
        onLoadSample={(file, pad, label) => {
          void loadTrapKitSampleToPad(file, pad, label);
        }}
        onPreviewSample={(file) => {
          const title = file.name.replace(/\.[^/.]+$/i, '');
          void loadTrapKitSampleToPad(file, geniusSamplerTargetPad, trapKitInstrumentLabel(geniusSamplerTargetPad, title));
        }}
      />

      {/* Creation sub-tools live in the module sidebar under Creation Station. */}
      {/* Full-height shell for tab bodies (Beat Lab, Piano, overlays).
          Ensures a flex:1 region below the tab bar when Chord Builder is
          unmounted (returns null) so module tabs still get real height. */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
      {/* ?? MORE (placeholder ? former Drums tab; primary workflow is Beat Lab) ?? */}
      {tab === 'drums' && (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 32,
            background: '#08080c',
            color: '#8a8a9a',
            textAlign: 'center',
            gap: 12,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 800, color: '#7cf4c6', letterSpacing: 2 }}>MORE</span>
          <span style={{ fontSize: 12, maxWidth: 420, lineHeight: 1.6 }}>
            This area is reserved for a future module. Drum programming, kit, and sampler live under{' '}
            <strong style={{ color: '#7cf4c6' }}>Beat Lab</strong>.
          </span>
          <button
            type="button"
            onClick={() => goToCreationSub('beat-lab')}
            style={{
              marginTop: 8,
              padding: '8px 20px',
              borderRadius: 8,
              border: '1px solid rgba(124, 244, 198, 0.45)',
              background: 'rgba(124, 244, 198, 0.12)',
              color: '#7cf4c6',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Open Beat Lab
          </button>
        </div>
      )}

      {/* ?? Chord Builder (SongEngine-style chord-pad rail + bar timeline) ?? */}
      <ChordBuilderTab
        active={tab === 'chord'}
        bpm={bpm}
        colsPerBar={MEASURES_PER_BAR}
        getAudioContext={() => {
          try {
            return getOrCreateAudioContext();
          } catch {
            return null;
          }
        }}
        onClose={() => goToCreationSub('beat-lab')}
        onExportToPad={onPadBounceExport}
        onSendMidiToBeatLabSynth={onSendChordMidiToBeatLabSynth}
        onOpen808Lab={() => goToCreationSub('808-lab')}
      />

      {tab === 'groove-lab' && (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            background: '#030303',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <GrooveLabScreen
            embedded
            isScreenActive={tab === 'groove-lab'}
            bpm={bpm}
            onBpmChange={(next) => {
              const clamped = Math.max(40, Math.min(240, Math.round(next)));
              setBpm(clamped);
              setBpmInput(String(clamped));
            }}
            getAudioContext={getOrCreateAudioContext}
          />
        </div>
      )}

      {/* ?? Chord Sequencer (full tab body) ?? */}
      {tab === 'chord-seq' && (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            background: '#030303',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <ChordSequencerScreen
            embedded
            isScreenActive={tab === 'chord-seq'}
            onBack={() => goToCreationSub('beat-lab')}
            onExportToPad={onPadBounceExport}
            onOpen808Lab={() => goToCreationSub('808-lab')}
            bpm={bpm}
            getAudioContext={getOrCreateAudioContext}
          />
        </div>
      )}

      {tab === '808-lab' && (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            background: '#07070a',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <EightZeroEightTab
            embedded
            isScreenActive={tab === '808-lab'}
            onBack={() => goToCreationSub('beat-lab')}
            getAudioContext={getOrCreateAudioContext}
            fallbackBpm={bpm}
          />
        </div>
      )}

      {/* ?? Beat Lab workspace ? step grid fills center (same slot as ROLL piano roll) ?? */}
      {tab === 'grid' && (
        <div
          style={{
            display: 'flex',
            flex: 1,
            flexDirection: 'column',
            overflow: 'hidden',
            minHeight: 0,
            background: '#050505',
          }}
        >
          <div
            style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
              rowGap: 6,
              padding: '5px 10px',
              borderBottom: '1px solid rgba(124, 244, 198, 0.12)',
              background: 'rgba(0,0,0,0.35)',
            }}
          >
            <span style={{ fontSize: 9, fontWeight: 900, color: '#7cf4c6', letterSpacing: 1 }}>VIEW</span>
            <BeatLabDeckFocusChip
              active={beatLabDeckFocus === 'sequence'}
              label="GRID"
              title="Center the step sequencer in the workspace"
              onClick={() => setBeatLabDeckFocus('sequence')}
            />
            <BeatLabDeckFocusChip
              active={beatLabDeckFocus === 'roll'}
              label="ROLL"
              title="32-channel piano roll ? edit all lanes"
              onClick={() => setBeatLabDeckFocus('roll')}
            />
            <BeatLabDeckFocusChip
              active={beatLabDeckFocus === 'synth'}
              label="SYNTH"
              title="MIDI synth channels 17?32 ? piano keyboard + pitch roll"
              onClick={() => setBeatLabDeckFocus('synth')}
            />
            {beatLabDeckFocus === 'sequence' ? (
              <BeatLabGridLayoutToggle
                mode={beatLabGridLayoutMode}
                onDefault={applyBeatLabGridLayoutDefault}
                onFull={applyBeatLabGridLayoutFull}
              />
            ) : null}
            <BeatLabEditToolToggle
              mode={beatLabEditTool}
              onModeChange={setBeatLabEditTool}
              timeStretch={beatLabTimeStretch}
              onTimeStretchChange={setBeatLabTimeStretch}
              snapHint={snapLabelFromPianoSnapSubdiv(
                beatLabDeckFocus === 'roll' || beatLabDeckFocus === 'synth'
                  ? pianoSnapSubdiv
                  : drumStepSubdiv,
              )}
            />
            <BeatLabHistoryControls
              canUndo={canBeatLabUndo}
              canRedo={canBeatLabRedo}
              onUndo={beatLabUndo}
              onRedo={beatLabRedo}
              onResetVol={resetBeatLabVolAutomation}
              onResetPitch={resetBeatLabPitchAutomation}
              disabled={CREATION_BACKEND_BLANK}
            />
            {beatLabPianoRollExpanded ? (
              <button
                type="button"
                disabled={CREATION_BACKEND_BLANK}
                onClick={() => {
                  if (CREATION_BACKEND_BLANK) return;
                  clearBeatLabMidiRoll();
                }}
                title="Clear all notes in this bank's piano roll"
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  color: '#7cf4c6',
                  background: 'rgba(124, 244, 198, 0.10)',
                  border: '1px solid rgba(124, 244, 198, 0.30)',
                  borderRadius: 4,
                  padding: '3px 8px',
                  cursor: CREATION_BACKEND_BLANK ? 'not-allowed' : 'pointer',
                  opacity: CREATION_BACKEND_BLANK ? 0.45 : 1,
                }}
              >
                CLEAR
              </button>
            ) : null}
            {beatLabGridFullView || beatLabDeckFocus === 'synth' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', flexWrap: 'wrap' }}>
                {beatLabSessionZoomTools}
                {beatLabDeckTransportClocks}
              </div>
            ) : null}
          </div>
          {beatLabDeckFocus === 'roll' && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: '1 1 auto',
                minHeight: 0,
                overflow: 'hidden',
                flexShrink: 1,
              }}
            >
              {beatLabPianoRollPanel}
            </div>
          )}
          {beatLabDeckFocus === 'synth' && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: '1 1 auto',
                minHeight: 0,
                overflow: 'hidden',
                flexShrink: 1,
              }}
            >
              {beatLabSynthPanel}
            </div>
          )}
          {beatLabDeckFocus === 'sequence' && (
        <div
          style={{
            display: 'flex',
            flex: 1,
            flexDirection: 'column',
            overflow: 'hidden',
            minHeight: 0,
            background: '#050505',
          }}
        >
        <div
          style={{
            display: 'flex',
            flex: 1,
            overflow: 'hidden',
            minHeight: 0,
            ...(beatLabDeckFocus === 'sequence'
              ? {
                  alignItems: 'stretch',
                  justifyContent: 'stretch',
                  padding: beatLabGridFullView ? '2px 4px' : '4px 6px',
                  width: '100%',
                }
              : {}),
          }}
        >
          <div
            style={{
              flex: 1,
              width: beatLabDeckFocus === 'sequence' ? '100%' : undefined,
              minWidth: 0,
              maxWidth: beatLabDeckFocus === 'sequence' ? '100%' : undefined,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              background: '#070708',
              boxShadow: 'inset 0 1px 0 rgba(124, 244, 198, 0.08)',
              borderRadius: beatLabDeckFocus === 'sequence' ? 8 : undefined,
              border:
                beatLabDeckFocus === 'sequence' ? '1px solid rgba(124, 244, 198, 0.22)' : undefined,
            }}
          >
            <div
              style={{
                flex: 1,
                display: 'flex',
                minHeight: 0,
                overflow: 'hidden',
              }}
            >
          {/* Track labels (sync with grid rows) */}
          <div
            ref={geniusLaneScrollRef}
            onScroll={onGeniusLaneRailScroll}
            style={{
              width: LABEL_W,
              flexShrink: 0,
              background: 'linear-gradient(180deg, rgba(12, 12, 18, 0.98) 0%, rgba(8, 8, 12, 0.99) 100%)',
              borderRight: '1px solid rgba(124, 244, 198, 0.18)',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
              overflowX: 'hidden',
            }}
          >
            <div
              aria-hidden
              style={{
                height: DRUM_SEQ_MEASURES_ROW_H,
                flexShrink: 0,
                borderBottom: '1px solid #1e1e1e',
                background: '#080808',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: 9, fontWeight: 900, color: '#7cf4c6', letterSpacing: 1.2 }}>MEASURES</span>
            </div>
            <div
              style={{
                height: DRUM_SEQ_QUANT_BAND_H,
                flexShrink: 0,
                borderBottom: '1px solid #1e1e1e',
                background: '#050505',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                justifyContent: 'flex-start',
              }}
            >
              <div
                style={{
                  height: DRUM_SEQ_QUANT_SUBROW_H,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 9,
                  fontWeight: 900,
                  color: '#9ec7d4',
                  letterSpacing: 1,
                  borderBottom: '1px solid #1e1e1e',
                }}
              >
                BARS
              </div>
              <div
                style={{
                  height: DRUM_SEQ_QUANT_SUBROW_H,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 9,
                  fontWeight: 900,
                  color: '#c8d2dd',
                  letterSpacing: 0.8,
                }}
              >
                Q {snapLabelFromPianoSnapSubdiv(drumStepSubdiv)}
              </div>
            </div>
            {PAD_NAMES.map((_, pi) => {
              const laneText = beatLabLaneDisplayLabel(
                pi,
                padSampleLabels[padSampleKey(activeBank, pi)],
              );
              const laneTint = beatLabPadColor(pi);
              const laneSelected = pi === selectedDrumPad;
              return (
              <div
                key={pi}
                style={{
                  height: DRUM_GRID_ROW_H,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'stretch',
                  padding: '3px 5px',
                  textAlign: 'left',
                  borderTop: '1px solid #1c1c20',
                  borderBottom: '1px solid #2a2a32',
                  background: laneSelected ? '#12151c' : '#08090c',
                  borderLeft: `3px solid ${beatLabLaneBackdropBorder()}`,
                  borderRadius: 0,
                  overflow: 'visible',
                  boxSizing: 'border-box',
                }}
              >
                <button
                  type="button"
                  className="cs-pad-hit"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setSelectedBeatLabLane(pi);
                  }}
                  onClick={() => auditionDrumLane(pi)}
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: 10,
                    border: `2px solid ${beatLabLaneBackdropBorder()}`,
                    backgroundColor: beatLabPadButtonFill(pi, laneSelected),
                    backgroundImage: laneSelected
                      ? `radial-gradient(ellipse 90% 80% at 50% 20%, color-mix(in srgb, ${laneTint} 45%, white) 0%, transparent 65%)`
                      : `radial-gradient(ellipse 80% 60% at 50% 15%, rgba(255,255,255,0.12) 0%, transparent 70%)`,
                    color: '#e8e8f0',
                    fontFamily: 'monospace',
                    cursor: 'pointer',
                    padding: '2px 6px 4px',
                    textAlign: 'center',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    justifyContent: 'flex-end',
                    gap: 2,
                    boxSizing: 'border-box',
                    textShadow: '0 1px 2px rgba(0,0,0,0.65)',
                    boxShadow: laneSelected
                      ? [
                          `0 0 16px color-mix(in srgb, ${laneTint} 65%, transparent)`,
                          `0 0 4px color-mix(in srgb, ${laneTint} 40%, transparent)`,
                          'inset 0 1px 0 rgba(255,255,255,0.35)',
                          'inset 0 -2px 6px rgba(0,0,0,0.35)',
                        ].join(', ')
                      : [
                          '0 2px 5px rgba(0,0,0,0.5)',
                          'inset 0 1px 0 rgba(255,255,255,0.14)',
                          'inset 0 -2px 6px rgba(0,0,0,0.4)',
                        ].join(', '),
                    transition: 'box-shadow 0.12s ease, background-color 0.12s ease, filter 0.12s ease',
                    filter: laneSelected ? 'brightness(1.08)' : 'none',
                  }}
                  title={`Beat Lab lane ${pi + 1} = sampler pad ${pi + 1} ? ${laneText}`}
                >
                  <span
                    style={{
                      width: '100%',
                      fontSize: 8,
                      fontWeight: 800,
                      lineHeight: 1.15,
                      color: '#ffffff',
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      wordBreak: 'break-word',
                      textAlign: 'center',
                      textShadow: '0 1px 2px rgba(0,0,0,0.7)',
                      flexShrink: 0,
                    }}
                  >
                    {laneText}
                  </span>
                  <span
                    aria-hidden
                    style={{
                      fontSize: 12,
                      fontWeight: 900,
                      color: '#ffffff',
                      letterSpacing: 0.6,
                      lineHeight: 1,
                      textShadow: '0 1px 2px rgba(0,0,0,0.7)',
                    }}
                  >
                    {pi + 1}
                  </span>
                </button>
              </div>
            );
            })}
          </div>

          {/* RIGHT: drum grid ? horizontal = timeline, vertical synced with lane rail */}
          <div
            ref={drumScrollRef}
            data-touch-scroll
            onScroll={onGeniusPatternScroll}
            onWheel={(e) => {
              if (!(e.ctrlKey || e.metaKey)) return;
              e.preventDefault();
              if (e.deltaY < 0) zoomIn();
              else if (e.deltaY > 0) zoomOut();
            }}
            style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', background: '#050505', minWidth: 0 }}
          >
            <div
              ref={drumGridContentRef}
              data-touch-draw
              style={{ width: drumGridW, minWidth: drumGridW, position: 'relative' }}
            >
              <BeatLabSnapGridOverlay
                colWidthPx={drumGridColW}
                qpb={beatLabQpb}
                subdiv={subdivHud}
                bankColOffset={drumColOffset}
                style={{
                  top: 0,
                  width: drumGridW,
                  height: DRUM_SEQ_HEADER_H + PAD_NAMES.length * DRUM_GRID_ROW_H,
                  zIndex: 0,
                }}
              />
              <div
                ref={drumPlaylineRef}
                aria-hidden
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  /** Match `CREATION_DRUM_PLAYLINE_CENTER_X` in `creationPlaylineWapi` so column hit-tests align with motion. */
                  width: 2,
                  height: DRUM_SEQ_HEADER_H + PAD_NAMES.length * DRUM_GRID_ROW_H,
                  background: 'transparent',
                  pointerEvents: 'none',
                  /** Above sticky quant row (`zIndex` 20) so the playhead arrow can meet the number boxes. */
                  zIndex: 22,
                  /** Stopped: dimmed so column 0 / count ?1? anchor is still visible; playing/recording full opacity. */
                  opacity: transportNotStopped ? 1 : 0.42,
                }}
              >
                {/** Tip at y=0, base at measures row ? flush with bottom of sticky quant strip. */}
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: 0,
                    width: 10,
                    height: DRUM_SEQ_MEASURES_ROW_H,
                    marginLeft: -5,
                    clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
                    background: '#7cf4c6',
                    pointerEvents: 'none',
                  }}
                />
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: DRUM_SEQ_MEASURES_ROW_H,
                    width: 2,
                    height: DRUM_SEQ_QUANT_BAND_H + PAD_NAMES.length * DRUM_GRID_ROW_H,
                    background: 'rgba(124, 244, 198, 0.4)',
                    pointerEvents: 'none',
                  }}
                />
              </div>
              <div
                aria-hidden
                title="Live measure and metronome counters"
                style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 20,
                  height: DRUM_SEQ_MEASURES_ROW_H,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  justifyContent: 'flex-start',
                  gap: 0,
                  padding: 0,
                  borderBottom: '1px solid #1e1e1e',
                  background: '#080808',
                  pointerEvents: 'none',
                }}
              >
                <div
                  style={{
                    position: 'relative',
                    height: DRUM_SEQ_MEASURES_ROW_H,
                    flexShrink: 0,
                    width: '100%',
                  }}
                >
                  <div
                    data-drum-measure-cells-row
                    style={{
                      position: 'relative',
                      /** Above WAAPI glow undertint so playhead-lit digit + border read clearly. */
                      zIndex: 2,
                      height: DRUM_SEQ_MEASURES_ROW_H,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                  {Array.from({ length: patternColsDrums }, (_, i) => {
                    const colsPB = Math.max(1, beatLabQpb * subdivHud);
                    const bankCol = i + drumColOffset;
                    /** 4/4: measures 1?4 between each bar (one measure = one quarter = `subdiv` columns). */
                    const measureInBarLabel = beatLabMeasureRulerLabel(i, drumColOffset, subdivHud, beatLabQpb);
                    const qFont =
                      colsPB <= 8 ? 10 : colsPB <= 16 ? 8 : colsPB <= 32 ? 7 : 6;
                    const isPlayheadCol = i === visualSyncCol;
                    const litQuantPausedOnly = isPlayheadCol && isPaused;
                    const litQuantStoppedOnly = isPlayheadCol && !transportNotStopped;
                    const quantCellBg = litQuantPausedOnly
                      ? 'rgba(124, 244, 198, 0.2)'
                      : litQuantStoppedOnly
                        ? 'rgba(124, 244, 198, 0.1)'
                        : '#121212';
                    const quantBorderBlend = isPlaying ? '#121212' : quantCellBg;
                    return (
                      <div
                        key={`grid-measure-${i}`}
                        data-drum-pattern-col={i}
                        data-drum-quant-playhead-lit={isPlayheadCol && !isPlaying ? '1' : undefined}
                        onClick={
                          CREATION_BACKEND_BLANK
                            ? undefined
                            : () => {
                                seekTransportToPatternColumn(i);
                              }
                        }
                        title={CREATION_BACKEND_BLANK ? undefined : 'Move playhead to this column'}
                        ref={(el) => {
                          if (quantMeasureCellElsRef.current.length !== patternColsDrums) {
                            quantMeasureCellElsRef.current = Array.from(
                              { length: patternColsDrums },
                              () => null,
                            );
                          }
                          quantMeasureCellElsRef.current[i] = el;
                        }}
                        style={{
                          width: drumGridColW,
                          height: 16,
                          boxSizing: 'border-box',
                          borderRadius: 0,
                          border: 'none',
                          borderTop: 'none',
                          borderRight: 'none',
                          pointerEvents: 'auto',
                          /** Same left-edge model as pad cells ? full box border was stealing horizontal space and drifting labels vs playhead. */
                          borderLeft: `1px solid ${creationDrumGridVerticalLineColor({
                            colWidthPx: drumGridColW,
                            bankCol,
                            qpb: beatLabQpb,
                            subdiv: subdivHud,
                            blendTo: quantBorderBlend,
                          })}`,
                          borderBottom: '1px solid #474747',
                          fontFamily: 'monospace',
                          fontSize: qFont,
                          lineHeight: '14px',
                          fontWeight: 900,
                          textAlign: 'center',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          position: 'relative' as const,
                          cursor: CREATION_BACKEND_BLANK ? undefined : 'pointer',
                          ...(isPlaying
                            ? {
                                background: '#121212',
                                color: '#b98ab9',
                              }
                            : {
                                background: quantCellBg,
                                color: litQuantPausedOnly
                                  ? '#7cf4c6'
                                  : litQuantStoppedOnly
                                    ? '#9b8ab8'
                                    : '#b98ab9',
                                ...(litQuantPausedOnly
                                  ? { boxShadow: 'inset 0 0 0 1px rgba(124, 244, 198, 0.45)' }
                                  : litQuantStoppedOnly
                                    ? { boxShadow: 'inset 0 0 0 1px rgba(124, 244, 198, 0.22)' }
                                    : {}),
                              }),
                        }}
                      >
                        {measureInBarLabel}
                      </div>
                    );
                  })}
                  </div>
                </div>
              </div>
              <div
                style={{
                  position: 'sticky',
                  top: DRUM_SEQ_MEASURES_ROW_H,
                  zIndex: 20,
                  display: 'flex',
                  height: DRUM_SEQ_QUANT_BAND_H,
                  overflow: 'visible',
                  borderBottom: '1px solid #1e1e1e',
                  background: '#0a0a0e',
                }}
              >
                <Ruler
                  activeCol={-1}
                  colWidth={drumGridColW}
                  barNumberStart={loopStartBar}
                  onRangeCommit={(s, e) => {
                    if (CREATION_BACKEND_BLANK) return;
                    setLoopRange(s, e);
                  }}
                  stepsPerBar={beatLabQpb * subdivHud}
                  barStepCounts={creationDrumRulerCounts}
                  segmentHeaderLabels={creationDrumRulerHeaderLabels}
                  patternColToDawBar={drumPatternColToDawBar}
                  creationBeatHighlight={null}
                  creationBeatsPerBar={beatLabQpb}
                  creationStepSubdiv={subdivHud}
                  disablePlayheadHighlight
                  drumGridBeatBorders={{
                    bankColOffset: drumColOffset,
                    qpb: beatLabQpb,
                    subdiv: subdivHud,
                  }}
                  onSeekPatternCol={CREATION_BACKEND_BLANK ? undefined : seekTransportToPatternColumn}
                />
                <LoopMarkersBrace
                  visible={loopEnabled}
                  leftPx={0}
                  widthPx={drumGridW}
                  height={DRUM_SEQ_QUANT_BAND_H}
                  variant="dark"
                />
              </div>
              {PAD_NAMES.map((name, pi) => (
                <div
                  key={pi}
                  className="cs-pad-hit"
                  style={{
                    display: 'flex',
                    height: DRUM_GRID_ROW_H,
                    alignItems: 'stretch',
                    borderTop: '1px solid #1c1c20',
                    borderBottom: `1px solid rgba(42, 42, 50, ${drumGridColW < 6 ? 0.3 : drumGridColW < 10 ? 0.55 : 1})`,
                    background: pi === selectedDrumPad ? '#141820' : drumLaneBg(pi),
                    cursor: 'pointer',
                    boxShadow: pi === selectedDrumPad ? 'inset 0 0 0 1px rgba(255,255,255,0.08)' : 'none',
                    position: 'relative',
                    zIndex: 1,
                  }}
                  onClick={(e) => {
                    if (e.target !== e.currentTarget) return;
                    auditionDrumLane(pi);
                  }}
                >
                  {Array.from({ length: patternColsDrums }, (_, ci) => {
                    const bankCol = ci + drumColOffset;
                    const onDrum = currentDrums[pi]?.[bankCol] ?? false;
                    const noteHere = beatLabNoteHeadAt(pi, ci);
                    const on = onDrum || !!noteHere;
                    const isHead = false;
                    const isNoteSelected = (() => {
                      if (!beatLabRollSelection || beatLabRollSelection.lane !== pi) return false;
                      const n = beatLabNoteHeadAt(pi, beatLabRollSelection.col);
                      if (!n) return false;
                      return ci >= n.col && ci < n.col + n.len;
                    })();
                    const isNoteEnd =
                      !!noteHere && ci === noteHere.col + noteHere.len - 1;
                    const isNoteSpanHead = !!noteHere && ci === noteHere.col;
                    const isNoteSpanMid =
                      !!noteHere &&
                      ci > noteHere.col &&
                      ci < noteHere.col + noteHere.len - 1;
                    const padStepBg = drumStepBg(bankCol, pi, isHead, beatLabQpb * subdivHud);
                    const noteCellRadius =
                      isNoteSpanHead && isNoteEnd
                        ? 4
                        : isNoteSpanHead
                          ? '4px 0 0 4px'
                          : isNoteEnd
                            ? '0 4px 4px 0'
                            : isNoteSpanMid
                              ? 0
                              : 4;
                    const stepTileLook = beatLabDrumStepTileLook({
                      tileGrid: beatLabTileGridOn,
                      colWidthPx: drumGridColW,
                      rowHeightPx: DRUM_GRID_ROW_H,
                      bankCol,
                      qpb: beatLabQpb,
                      subdiv: subdivHud,
                      padStepBg,
                      on,
                      isNoteSelected,
                      isHead,
                      noteCellRadius,
                      beatLabGridStepOnFill,
                    });
                    const stepCursor = beatLabToolUsesDrumBrush(beatLabEditTool)
                      ? 'crosshair'
                      : beatLabEditTool === 'pointer' && on && isNoteEnd
                        ? 'ew-resize'
                        : beatLabEditTool === 'pointer' && noteHere && on
                          ? 'grab'
                          : 'pointer';
                    return (
                      <button
                        key={ci}
                        type="button"
                        className="touch-compact"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          if (CREATION_BACKEND_BLANK) return;
                          if ((e.target as HTMLElement).closest('[data-beat-lab-resize]')) return;
                          if (e.ctrlKey || e.metaKey) {
                            seekTransportToPatternColumn(ci);
                            return;
                          }
                          beatLabGridFocusRef.current = { lane: pi, col: ci };
                          if (beatLabToolUsesDrumBrush(beatLabEditTool)) {
                            beginDrumPaint(e.clientX, e.clientY, e.shiftKey);
                            return;
                          }
                          if (beatLabEditTool === 'pointer' && on && noteHere) {
                            beatLabGridFocusRef.current = {
                              lane: noteHere.lane,
                              col: noteHere.col,
                            };
                            setBeatLabRollSelection({
                              lane: noteHere.lane,
                              col: noteHere.col,
                            });
                            const rect = e.currentTarget.getBoundingClientRect();
                            const resizeZone = Math.max(
                              14,
                              Math.min(Math.floor(drumGridColW * 0.48), drumGridColW - 1),
                            );
                            if (
                              isNoteEnd &&
                              e.clientX > rect.right - resizeZone
                            ) {
                              beginGridNoteResize(e, noteHere.lane, noteHere.col, noteHere);
                              return;
                            }
                            beatLabGridDragRef.current = {
                              fromLane: noteHere.lane,
                              fromCol: noteHere.col,
                              startX: e.clientX,
                              startY: e.clientY,
                              moved: false,
                            };
                          }
                        }}
                        onMouseEnter={(e) => {
                          if (CREATION_BACKEND_BLANK || !beatLabToolUsesDrumBrush(beatLabEditTool)) return;
                          if (!drumPaintRef.current?.active) return;
                          paintDrumAtClient(e.clientX, e.clientY, drumPaintRef.current.on);
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (beatLabGridJustDraggedRef.current) {
                            beatLabGridJustDraggedRef.current = false;
                            return;
                          }
                          if (!CREATION_BACKEND_BLANK && (e.ctrlKey || e.metaKey)) {
                            seekTransportToPatternColumn(ci);
                            return;
                          }
                          if (beatLabToolUsesDrumBrush(beatLabEditTool)) return;
                          if (beatLabEditTool === 'pointer') {
                            if (noteHere) {
                              beatLabGridFocusRef.current = {
                                lane: noteHere.lane,
                                col: noteHere.col,
                              };
                              setBeatLabRollSelection({
                                lane: noteHere.lane,
                                col: noteHere.col,
                              });
                              return;
                            }
                            placeBeatLabGridStep(pi, ci, true);
                            setBeatLabRollSelection({ lane: pi, col: ci });
                            return;
                          }
                          placeBeatLabGridStep(pi, ci, !on);
                        }}
                        style={{
                          width: drumGridColW,
                          boxSizing: 'border-box',
                          flexShrink: 0,
                          height: DRUM_GRID_ROW_H,
                          position: 'relative',
                          cursor: stepCursor,
                          ...stepTileLook.button,
                        }}
                        title={
                          CREATION_BACKEND_BLANK
                            ? undefined
                            : beatLabEditTool === 'draw'
                              ? 'Draw ? drag to paint steps ? Ctrl+click playhead'
                              : beatLabEditTool === 'erase'
                                ? 'Erase ? drag to clear steps ? Ctrl+click playhead'
                                : beatLabEditTool === 'pointer'
                                  ? 'PTR ? drag note to move ? drag right edge to resize ? Ctrl+C/V/X'
                                  : 'Ctrl+click: move playhead ? click: toggle step'
                        }
                      >
                        {stepTileLook.inner ? (
                          <span aria-hidden style={stepTileLook.inner} />
                        ) : null}
                        {on && isNoteEnd && beatLabEditTool === 'pointer' && noteHere ? (
                          <span
                            role="separator"
                            aria-label="Resize note"
                            data-beat-lab-resize="end"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onPointerDown={(e) => {
                              beginGridNoteResize(
                                e,
                                noteHere.lane,
                                noteHere.col,
                                noteHere,
                                e.currentTarget as HTMLElement,
                              );
                            }}
                            style={{
                              position: 'absolute',
                              right: 0,
                              top: 0,
                              bottom: 0,
                              width: Math.max(
                                14,
                                Math.min(Math.floor(drumGridColW * 0.48), drumGridColW - 1),
                              ),
                              cursor: 'ew-resize',
                              zIndex: 2,
                              touchAction: 'none',
                              background: 'transparent',
                            }}
                            title="Drag to resize note length"
                          />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
            </div>
          </div>
        </div>
          {beatLabDeckFocus === 'sequence' && (
            <div
              style={{
                flexShrink: 0,
                padding: '8px 10px 10px',
                borderTop: '1px solid rgba(124, 244, 198, 0.15)',
                background: 'linear-gradient(180deg, rgba(8, 8, 12, 0.92) 0%, rgba(5, 5, 8, 0.98) 100%)',
              }}
            >
              {beatLabPatternBankRow}
            </div>
          )}
        </div>
          )}
        </div>
      )}

      {/* ?? PIANO ROLL TAB ?? */}
      {tab === 'piano' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 0 }}>
          {/* Sub-tab + instruments */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', flexShrink: 0, background: '#080808', borderBottom: '1px solid #1a1a1a' }}>
            {(['notes','drums'] as const).map(st => (
              <button key={st} onClick={() => setPianoMode(st)} style={{ padding: '3px 10px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: pianoMode===st ? '#193025' : '#1a1a24', color: pianoMode===st ? '#7cf4c6' : '#6a6a78', border: `1px solid ${pianoMode===st ? 'rgba(124,244,198,0.45)' : '#2a2a32'}`, cursor: 'pointer' }}>
                {st === 'notes' ? '?? Notes' : '?? Drums'}
              </button>
            ))}
            {pianoMode === 'notes' && (
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginRight: 6 }}>
                  <button
                    onClick={() => setPianoRegisterShift((v) => Math.max(-2, v - 1))}
                    style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: '#1a1a24', color: '#b8b8ca', border: '1px solid #2a2a32', cursor: 'pointer' }}
                  >
                    OCT-
                  </button>
                  <span style={{ fontSize: 9, color: '#888', fontFamily: 'monospace', minWidth: 44, textAlign: 'center' }}>
                    {pianoRegisterShift >= 0 ? `+${pianoRegisterShift}` : pianoRegisterShift}
                  </span>
                  <button
                    onClick={() => setPianoRegisterShift((v) => Math.min(2, v + 1))}
                    style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: '#1a1a24', color: '#b8b8ca', border: '1px solid #2a2a32', cursor: 'pointer' }}
                  >
                    OCT+
                  </button>
                </div>
                {INSTRUMENTS.map((ins, i) => (
                  <button key={ins} onClick={() => setRollInstr(i)} style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: rollInstr===i ? '#00E5FF' : '#1a1a24', color: rollInstr===i ? '#000' : '#6a6a78', border: `1px solid ${rollInstr===i ? '#00E5FF' : '#2a2a32'}`, cursor: 'pointer' }}>
                    {ins}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Piano roll */}
          <div style={{ flex: '1 1 0%', display: 'flex', overflow: 'hidden', minHeight: 0, borderTop: '2px solid #1a1a1a' }}>
            {/* Fixed keys */}
            <div style={{ width: KEY_W, flexShrink: 0, background: '#0c141a', borderRight: '1px solid #213646', display: 'flex', flexDirection: 'column' }}>
              <div style={{ height: DRUM_SEQ_QUANT_BAND_H, flexShrink: 0, borderBottom: '1px solid #1e1e1e', background: '#050505' }} />
              <div style={{ overflowY: 'hidden', flex: 1 }}>
                {(pianoMode === 'notes' ? displayNotes : [PAD_NAMES[activeDrumPadIndex]]).map((label, ri) => {
                  const padIndex = pianoMode === 'drums' ? activeDrumPadIndex : ri;
                  if (pianoMode === 'drums') {
                    return (
                      <div
                        key={ri}
                        style={{
                          height: DRUM_GRID_ROW_H,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          paddingRight: 6,
                          fontSize: 10,
                          fontWeight: 700,
                          fontFamily: 'monospace',
                          color: '#aeb7be',
                          background: drumLaneBg(0),
                          borderBottom: '1px solid #1f3a4a',
                          flexShrink: 0,
                        }}
                      >
                        {label}
                      </div>
                    );
                  }
                  const isBlack = label.includes('#');
                  return (
                    <div
                      key={ri}
                      onPointerDown={() => {
                        if (pianoMode === 'notes') setPressedPianoKeyRow(ri);
                      }}
                      onPointerUp={() => setPressedPianoKeyRow((v) => (v === ri ? null : v))}
                      onPointerLeave={() => setPressedPianoKeyRow((v) => (v === ri ? null : v))}
                      onClick={() => {
                        if (pianoMode === 'notes') playPianoNote(ri, 0.35);
                      }}
                      style={{
                        height: ROW_H,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: isBlack ? 'flex-end' : 'space-between',
                        paddingRight: 5,
                        paddingLeft: 6,
                        fontSize: 9,
                        fontFamily: 'monospace',
                        color: isBlack ? '#aeb7be' : '#2c3136',
                        background: isBlack
                          ? pressedPianoKeyRow === ri ? '#161b1f' : '#1f2429'
                          : pressedPianoKeyRow === ri ? '#b8c2cb' : '#d6dce1',
                        borderBottom: '1px solid #2b3c48',
                        flexShrink: 0,
                        boxShadow: isBlack
                          ? pressedPianoKeyRow === ri
                            ? 'inset 0 2px 0 #0f1316, inset 0 -1px 0 #0b0f12'
                            : 'inset 0 -1px 0 #14191d'
                          : pressedPianoKeyRow === ri
                            ? 'inset 0 2px 0 #9ea8b2, inset 0 -1px 0 #8a949e'
                            : 'inset 0 -1px 0 #bcc6ce',
                        cursor: 'pointer',
                        transform: pressedPianoKeyRow === ri ? 'translateX(2px) scaleX(0.98)' : 'translateX(0) scaleX(1)',
                        transition: 'transform 0.06s ease, background 0.06s ease, box-shadow 0.06s ease',
                      }}
                    >
                      
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Note grid */}
            <div ref={pianoScrollRef} style={{ flex: 1, overflowX: 'auto', overflowY: 'auto' }}>
              <div style={{ width: totalW, minWidth: totalW, position: 'relative' }}>
                <div style={{ position: 'relative' }}>
                  <Ruler
                    activeCol={activeCol}
                    colWidth={pianoGridColW}
                    maxBars={CREATION_PIANO_BARS}
                    stepsPerBar={pianoMode === 'drums' ? qpbHud * subdivHud : MEASURES_PER_BAR}
                    barStepCounts={PIANO_RULER_BAR_STEP_COUNTS}
                    creationBeatHighlight={rulerCreationBeatHighlight}
                    creationBeatsPerBar={pianoMode === 'drums' ? qpbHud : MEASURES_PER_BAR}
                    creationStepSubdiv={pianoMode === 'drums' ? subdivHud : 1}
                    disablePlayheadHighlight
                  />
                  <LoopMarkersBrace
                    visible={pianoLoopRegionOk}
                    leftPx={pianoLoopLeftPx}
                    widthPx={pianoLoopWidthPx}
                    height={28}
                    variant="dark"
                  />
                </div>
              <div
                ref={pianoPlaylineRef}
                aria-hidden
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 28,
                  width: 1,
                  height: pianoRollLoopGridH,
                  background: '#00e5ff',
                  pointerEvents: 'none',
                  zIndex: 16,
                  visibility: transportNotStopped ? 'visible' : 'hidden',
                }}
              />
                {(pianoMode === 'notes' ? displayNotes : [PAD_NAMES[activeDrumPadIndex]]).map((note, ri) => {
                  const padIndex = pianoMode === 'drums' ? activeDrumPadIndex : ri;
                  return (
                    <div
                      key={ri}
                      style={{
                        display: 'flex',
                        height: pianoMode === 'drums' ? DRUM_GRID_ROW_H : ROW_H,
                        borderTop: '1px solid #1c1c20',
                        borderBottom: '1px solid #35566e',
                        background: pianoMode === 'drums' ? drumLaneBg(0) : pianoLaneBg(ri),
                      }}
                    >
                      {Array.from({ length: TOTAL_COLS }, (_, ci) => {
                        const on = pianoMode === 'drums'
                          ? (currentDrums[padIndex]?.[ci] ?? false)
                          : sharedNotes.some(n => n.row === ri && n.col === ci);
                        const isHead = false;
                        return (
                          <button
                            key={ci}
                            onClick={() => {
                              if (pianoMode === 'drums') {
                                toggleDrum(padIndex, ci);
                                playPadSoundRef.current(padIndex, PAD_VEL[padIndex] ?? 90);
                              } else {
                                toggleNote(ri, ci);
                                playPianoNote(ri, 0.3);
                              }
                            }}
                            style={{
                              width: pianoGridColW,
                              boxSizing: 'border-box',
                              flexShrink: 0,
                              height: pianoMode === 'drums' ? DRUM_GRID_ROW_H : ROW_H,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: pianoMode === 'drums' ? drumStepBg(ci, padIndex, isHead) : pianoStepBg(ci, ri, isHead),
                              borderLeft: `1px solid ${ci % (MEASURES_PER_BAR * 4) === 0 ? '#7ba5bf' : ci % MEASURES_PER_BAR === 0 ? '#5e88a3' : '#3f6278'}`,
                              borderTop: 'none',
                              borderRight: 'none',
                              borderBottom: '1px solid #000',
                              boxShadow: on && isHead ? '0 0 8px #b8f5c599' : 'none',
                              cursor: 'pointer',
                              transition: isHead ? 'none' : 'background 0.05s',
                              padding: 0,
                            }}
                          >
                            {on && (
                              <div
                                style={{
                                  width: Math.max(6, Math.floor(pianoGridColW * (pianoMode === 'drums' ? 0.78 : 0.72))),
                                  height: Math.floor((pianoMode === 'drums' ? DRUM_GRID_ROW_H : ROW_H) * (pianoMode === 'drums' ? 0.82 : 0.68)),
                                  borderRadius: pianoMode === 'drums' ? 1 : 2,
                                  background: '#b8f5c5',
                                  border: '1px solid #dbffe2',
                                  boxShadow: '0 0 7px #b8f5c599',
                                }}
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
                <LoopVerticalGuides
                  visible={pianoLoopRegionOk}
                  leftPx={pianoLoopLeftPx}
                  widthPx={pianoLoopWidthPx}
                  height={pianoRollLoopGridH}
                  topPx={28}
                  zIndex={12}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      </div>

      <DrumKitGeneratorModal
        open={drumKitGenOpen}
        onClose={() => !drumKitGenBusy && setDrumKitGenOpen(false)}
        style={drumKitGenStyle}
        onStyleChange={setDrumKitGenStyle}
        busy={drumKitGenBusy}
        onApplySinglePad={applyDrumKitGenSinglePad}
        onApplyFullKit={applyDrumKitGenFullKit}
        onApplyPattern={applyDrumKitGenPattern}
        onApplyBoth={applyDrumKitGenBoth}
      />

    </div>
  );
}

export default function CreationStationScreen(props: {
  onExport: (dest: string) => void;
  isScreenActive?: boolean;
  creationSubScreen?: CreationSubScreenId;
  onCreationSubScreenChange?: (sub: CreationSubScreenId) => void;
}) {
  return (
    <CreationStationErrorBoundary>
      <CreationStationScreenBody {...props} />
    </CreationStationErrorBoundary>
  );
}

